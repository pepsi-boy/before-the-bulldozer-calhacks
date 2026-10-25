"""Dispatcher: offers each item to the nonprofit the app matched it with. If a nonprofit
passes on something, it reroutes that item to the next eligible nonprofit. Every accepted
pickup is recorded in the app (POST /api/claim), which ticks the landfill-diversion counter.
When every offer for a house is answered, it reports the outcome to the Concierge."""

from datetime import date, timedelta

import httpx
from uagents import Agent, Context

from .config import APP_URL, app_headers, seed
from .messages import DispatchReport, OfferResponse, PickupOffer, SalvageManifest
from .nonprofits import BY_ID, next_choice

dispatcher = Agent(name="dispatcher", seed=seed("dispatcher"))

# nonprofit id -> agent address. Set by run_agents.py.
NONPROFIT_ADDRESSES: dict[str, str] = {}
CONCIERGE_ADDRESS: str = ""

# scan id -> state for that house
SCANS: dict[str, dict] = {}


def pickup_window() -> str:
    """Two business days out, 9am-12pm (same proposal the app shows)."""
    d = date.today()
    added = 0
    while added < 2:
        d += timedelta(days=1)
        if d.weekday() < 5:
            added += 1
    return f"{d.strftime('%a %b %d')}, 9am-12pm"


def name_of(nonprofit_id: str) -> str:
    return BY_ID.get(nonprofit_id, {}).get("name", nonprofit_id)


async def offer(ctx: Context, scan_id: str, nonprofit_id: str, item_ids: list[str], reroute: bool):
    state = SCANS[scan_id]
    msg: SalvageManifest = state["msg"]
    address = NONPROFIT_ADDRESSES.get(nonprofit_id)
    items = [i for i in msg.items if i.id in item_ids]
    if not address or not items:
        state["unplaced"].update(item_ids)
        return
    for i in items:
        state["tried"].setdefault(i.id, set()).add(nonprofit_id)
    state["pending"] += 1
    ctx.logger.info(
        f"{'Rerouting' if reroute else 'Offering'} {len(items)} items from {msg.address} to {name_of(nonprofit_id)}"
    )
    await ctx.send(
        address,
        PickupOffer(
            scan_id=scan_id,
            permit_id=msg.permit_id,
            address=msg.address,
            items=items,
            pickup_window=state["window"],
            reroute=reroute,
        ),
    )


async def finish(ctx: Context, scan_id: str, stats: dict):
    state = SCANS.pop(scan_id)
    msg: SalvageManifest = state["msg"]
    names = {i.id: i.name for i in msg.items}
    ctx.logger.info(f"{msg.address}: all offers answered, {len(state['claims'])} pickups booked")
    if not msg.requester:
        return
    await ctx.send(
        CONCIERGE_ADDRESS,
        DispatchReport(
            scan_id=scan_id,
            permit_id=msg.permit_id,
            address=msg.address,
            requester=msg.requester,
            source=msg.source,
            photo_note=msg.photo_note,
            pickup_window=state["window"],
            claims=[
                {"nonprofit": name_of(c["nonprofit_id"]), "items": [names[i] for i in c["item_ids"]], "rerouted": c["rerouted"]}
                for c in state["claims"]
            ],
            unplaced=[names[i] for i in sorted(state["unplaced"]) if i in names],
            notes=state["notes"],
            stats=stats,
            property_url=f"{APP_URL}/property/{msg.permit_id}?scan={scan_id}",
        ),
    )


@dispatcher.on_message(model=SalvageManifest)
async def dispatch(ctx: Context, sender: str, msg: SalvageManifest):
    SCANS[msg.scan_id] = {
        "msg": msg, "tried": {}, "pending": 0, "claims": [], "unplaced": set(), "notes": [],
        "window": pickup_window(), "stats": {},
    }
    reusable = {i.id for i in msg.items}
    matched = set()
    for m in msg.matches:
        ids = [i for i in m["itemIds"] if i in reusable]
        matched.update(ids)
        if ids:
            await offer(ctx, msg.scan_id, m["nonprofitId"], ids, reroute=False)
    SCANS[msg.scan_id]["unplaced"].update(reusable - matched)
    if SCANS[msg.scan_id]["pending"] == 0:
        await finish(ctx, msg.scan_id, {})


@dispatcher.on_message(model=OfferResponse)
async def handle_response(ctx: Context, sender: str, resp: OfferResponse):
    state = SCANS.get(resp.scan_id)
    if not state:
        return
    state["pending"] -= 1
    name = name_of(resp.nonprofit_id)
    if resp.note:
        ctx.logger.info(f"{name}: {resp.note}")
        if resp.declined_ids:
            state["notes"].append(f"{name}: {resp.note}")

    if resp.accepted_ids:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{APP_URL}/api/claim",
                    json={
                        "scanId": resp.scan_id,
                        "nonprofitId": resp.nonprofit_id,
                        "itemIds": resp.accepted_ids,
                        "reroute": resp.reroute,
                    },
                    headers=app_headers(),
                )
            if r.status_code == 200:
                state["stats"] = r.json()["stats"]
                state["claims"].append(
                    {"nonprofit_id": resp.nonprofit_id, "item_ids": resp.accepted_ids, "rerouted": resp.reroute}
                )
                ctx.logger.info(
                    f"{name} claimed {len(resp.accepted_ids)} items. "
                    f"Total kept out of the landfill: {state['stats']['tonsDiverted']} tons"
                )
            else:
                ctx.logger.warning(f"Claim failed ({r.status_code}): {r.text}")
                state["unplaced"].update(resp.accepted_ids)
        except Exception as e:
            ctx.logger.warning(f"Claim request failed: {e}")
            state["unplaced"].update(resp.accepted_ids)

    # Reroute anything they passed on to the next nonprofit that could use it.
    by_next: dict[str, list[str]] = {}
    items = {i.id: i for i in state["msg"].items}
    for item_id in resp.declined_ids:
        item = items.get(item_id)
        if not item:
            continue
        nxt = next_choice(item, state["tried"].get(item_id, set()))
        if nxt:
            by_next.setdefault(nxt, []).append(item_id)
        else:
            state["unplaced"].add(item_id)
            ctx.logger.info(f"No other nonprofit can take '{item.name}', leaving it for a human to place")
    for nonprofit_id, ids in by_next.items():
        await offer(ctx, resp.scan_id, nonprofit_id, ids, reroute=True)

    if state["pending"] == 0:
        await finish(ctx, resp.scan_id, state["stats"])
