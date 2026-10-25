"""Concierge: the agent users talk to on ASI:One (Agent Chat Protocol).

The whole workflow runs from the chat:
  1. "What's being torn down in 37208?"  -> pulls fresh permits from our Apify Actor and lists houses
  2. "Scan #2"                           -> Scout inventories the house, Dispatcher negotiates with
                                            nonprofit agents, reroutes what they pass on, books pickups
  3. The Concierge replies with the salvage plan: who's taking what, when, and the impact.
"""

import json
import os
import re
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    StartSessionContent,
    TextContent,
    chat_protocol_spec,
)

from .config import APP_URL, REPO_ROOT, app_headers, seed
from .messages import DispatchReport, NewPermit, ScanFailed

concierge = Agent(
    name="before_the_bulldozer",
    seed=seed("concierge"),
    mailbox=os.getenv("CONCIERGE_MAILBOX", "true").lower() == "true",
    readme_path=str(REPO_ROOT / "agents" / "CONCIERGE.md"),
    description=(
        "Finds Nashville houses with new demolition permits, inventories the reusable materials inside "
        "(doors, cabinets, flooring, fixtures) and books pickups with local nonprofits before the bulldozer arrives."
    ),
)

SCOUT_ADDRESS: str = ""  # set by run_agents.py

ASI1_API_KEY = os.getenv("ASI1_API_KEY", "")
ASI1_MODEL = os.getenv("ASI1_MODEL", "asi1-mini")
ASI1_URL = "https://api.asi1.ai/v1/chat/completions"

# sender -> the last list of permits we showed them (so "scan #2" works)
LAST_LIST: dict[str, list[dict]] = {}

HELP = (
    "I'm Before the Bulldozer. I find Nashville houses that are about to be demolished and get the reusable "
    "stuff inside (doors, cabinets, flooring, fixtures) to nonprofits instead of the landfill.\n\n"
    "Try:\n"
    "- **What's being torn down in 37208?**\n"
    "- **Scan #1** (after I show you a list), or **scan** plus an address or permit number\n"
    "- **How much have you saved so far?**"
)

ORDINALS = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5}


def chat_msg(text: str, end: bool = False) -> ChatMessage:
    content = [TextContent(type="text", text=text)]
    if end:
        content.append(EndSessionContent(type="end-session"))
    return ChatMessage(timestamp=datetime.now(timezone.utc), msg_id=uuid4(), content=content)


async def app_get(path: str):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{APP_URL}{path}")
        r.raise_for_status()
        return r.json()


async def sync_permits(ctx: Context) -> int | None:
    """Pull the latest permits from our Apify Actor via the app. Returns how many were new."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{APP_URL}/api/permits/sync", headers=app_headers())
        if r.status_code == 200:
            return len(r.json().get("added", []))
        ctx.logger.warning(f"Sync returned {r.status_code}")
    except Exception as e:
        ctx.logger.warning(f"Sync failed: {e}")
    return None


# ---------- understanding the request ----------

def rule_intent(text: str) -> dict:
    t = text.lower()
    zip_match = re.search(r"\b(37\d{3})\b", t)
    if re.search(r"\b(scan|salvage|inventory|inspect|look inside|rescue|save stuff|dispatch)\b", t):
        return {"intent": "scan", "target": text}
    if any(w in t for w in ("saved", "impact", "diverted", "landfill", "stats", "tons", "so far")):
        return {"intent": "stats"}
    if zip_match or any(w in t for w in ("permit", "demoli", "torn", "tear", "bulldoz", "houses", "list", "refresh")):
        return {"intent": "list", "zip": zip_match.group(1) if zip_match else None}
    return {"intent": "help"}


async def understand(ctx: Context, text: str) -> dict:
    """Use the ASI:One LLM to read the user's intent if a key is set; fall back to simple rules."""
    if not ASI1_API_KEY:
        return rule_intent(text)
    system = (
        "You route requests for a service that finds Nashville houses with demolition permits and saves "
        "reusable materials for nonprofits. Reply with JSON only: "
        '{"intent": "list" | "scan" | "stats" | "help", "zip": "37xxx" or null, "target": string or null}. '
        "'list' = they want houses being demolished (optionally in a ZIP). 'scan' = they want a specific house "
        "inventoried and its materials dispatched; put the house reference (list number, address, or permit "
        "number) in target. 'stats' = impact so far."
    )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                ASI1_URL,
                headers={"Authorization": f"Bearer {ASI1_API_KEY}"},
                json={"model": ASI1_MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": text}]},
            )
        r.raise_for_status()
        raw = r.json()["choices"][0]["message"]["content"]
        parsed = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
        if parsed.get("intent") in {"list", "scan", "stats", "help"}:
            if parsed["intent"] == "scan" and not parsed.get("target"):
                parsed["target"] = text
            return parsed
    except Exception as e:
        ctx.logger.warning(f"ASI:One intent parse failed, using rules: {e}")
    return rule_intent(text)


def resolve_permit(target: str, sender: str, permits: list[dict]) -> dict | None:
    t = (target or "").lower()
    last = LAST_LIST.get(sender, [])
    m = re.search(r"#?\b([1-9])\b", t)
    for word, n in ORDINALS.items():
        if word in t:
            m = None
            if n <= len(last):
                return last[n - 1]
    if m and int(m.group(1)) <= len(last) and not re.search(r"\d{4,}", t):
        return last[int(m.group(1)) - 1]
    for p in permits:
        if p["id"].lower() in t:
            return p
    for p in permits:
        street = p["address"].split(",")[0].lower()
        if street and street in t:
            return p
    if len(last) == 1:
        return last[0]
    return None


# ---------- formatting ----------

def plural(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")


def fmt_permits(permits: list[dict]) -> str:
    return "\n".join(
        f"{n}. **{p['address']}**, permit {p['id']}, issued {p['dateIssued']}" for n, p in enumerate(permits, 1)
    )


def fmt_items(names: list[str], limit: int = 6) -> str:
    shown = ", ".join(n.lower() for n in names[:limit])
    return shown + (f" and {len(names) - limit} more" if len(names) > limit else "")


def fmt_report(r: DispatchReport) -> str:
    lines = [f"**Salvage plan for {r.address}** (permit {r.permit_id})", r.photo_note]
    if r.source == "demo":
        lines.append("_The vision model was unavailable, so this uses our cached demo scan._")
    if r.claims:
        lines.append(f"\n**Pickups booked for {r.pickup_window}:**")
        for c in r.claims:
            extra = " (rerouted after another nonprofit passed)" if c["rerouted"] else ""
            lines.append(f"- **{c['nonprofit']}** is taking {fmt_items(c['items'])}{extra}")
    else:
        lines.append("\nNo nonprofit could take anything from this house.")
    if r.notes:
        lines.append("\n**Why some items moved:**")
        lines += [f"- {n}" for n in r.notes]
    if r.unplaced:
        lines.append(f"\n**No taker yet:** {fmt_items(r.unplaced)}. A person should find these a home.")
    if r.stats:
        s = r.stats
        lines.append(
            f"\n**Impact so far:** {plural(s['housesScanned'], 'house')} scanned, {s['tonsDiverted']} tons kept out of "
            f"the landfill, about ${round(s['valueUsd']):,} in reusable materials."
        )
    lines.append(f"\nFull manifest and photos: {r.property_url}")
    return "\n".join(lines)


# ---------- chat protocol ----------

chat = Protocol(spec=chat_protocol_spec)


@chat.on_message(ChatMessage)
async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(sender, ChatAcknowledgement(timestamp=datetime.now(timezone.utc), acknowledged_msg_id=msg.msg_id))
    text = " ".join(c.text for c in msg.content if isinstance(c, TextContent)).strip()
    if not text:
        if any(isinstance(c, StartSessionContent) for c in msg.content):
            return
        await ctx.send(sender, chat_msg(HELP, end=True))
        return

    intent = await understand(ctx, text)
    ctx.logger.info(f"Chat from {sender[:16]}...: {text!r} -> {intent}")

    try:
        if intent["intent"] == "stats":
            s = await app_get("/api/stats")
            await ctx.send(sender, chat_msg(
                f"So far: **{plural(s['housesScanned'], 'house')}** scanned, **{plural(s['itemsClaimed'], 'item')}** claimed by nonprofits, "
                f"**{s['tonsDiverted']} tons** kept out of the landfill (about ${round(s['valueUsd']):,} in reusable materials).",
                end=True,
            ))
            return

        if intent["intent"] == "list":
            new = await sync_permits(ctx)
            permits = await app_get("/api/permits")
            zip_code = intent.get("zip")
            if zip_code:
                permits = [p for p in permits if (p.get("zip") or "").startswith(zip_code)]
            if not permits:
                await ctx.send(sender, chat_msg(f"No recent residential demolition permits{f' in {zip_code}' if zip_code else ''}.", end=True))
                return
            top = permits[:5]
            LAST_LIST[sender] = top
            fresh = f" Just pulled {new} new permits from the city." if new else ""
            where = f" in {zip_code}" if zip_code else " in Nashville"
            await ctx.send(sender, chat_msg(
                f"{plural(len(permits), 'house')}{where} {'has' if len(permits) == 1 else 'have'} residential demolition permits.{fresh} Newest:\n\n{fmt_permits(top)}\n\n"
                "Say **scan #1** (or any number) and I'll inventory the house and line up nonprofits to take what's inside.",
                end=True,
            ))
            return

        if intent["intent"] == "scan":
            permits = await app_get("/api/permits")
            permit = resolve_permit(intent.get("target") or text, sender, permits)
            if not permit:
                await ctx.send(sender, chat_msg(
                    "Which house? Ask me what's being torn down (for example **demolitions in 37208**) and then say "
                    "**scan #1**, or give me an address or permit number.", end=True))
                return
            await ctx.send(sender, chat_msg(
                f"On it. Scanning **{permit['address']}** and offering what's inside to Nashville nonprofits. "
                "This takes about 10-30 seconds."))
            await ctx.send(SCOUT_ADDRESS, NewPermit(
                permit_id=permit["id"], address=permit["address"], date_issued=permit.get("dateIssued", ""),
                permit_type=permit.get("permitType", ""), requester=sender,
            ))
            return
    except Exception as e:
        ctx.logger.warning(f"Chat handling failed: {e}")
        await ctx.send(sender, chat_msg("I couldn't reach the Before the Bulldozer app just now. Try again in a minute.", end=True))
        return

    await ctx.send(sender, chat_msg(HELP, end=True))


@chat.on_message(ChatAcknowledgement)
async def on_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


concierge.include(chat, publish_manifest=True)


# ---------- results coming back from the pipeline ----------

@concierge.on_message(model=DispatchReport)
async def on_report(ctx: Context, sender: str, report: DispatchReport):
    await ctx.send(report.requester, chat_msg(fmt_report(report), end=True))


@concierge.on_message(model=ScanFailed)
async def on_failed(ctx: Context, sender: str, msg: ScanFailed):
    await ctx.send(msg.requester, chat_msg(f"I couldn't scan **{msg.address}**: {msg.reason}", end=True))
