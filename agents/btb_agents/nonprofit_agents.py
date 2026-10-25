"""One agent per nonprofit in data/nonprofits.json. Each one decides which offered items
it can actually take, based on its intake policy.

These policies are SIMULATED for the demo. In production each nonprofit would run its own
agent (or approve offers through one) with its real intake rules."""

from uagents import Agent, Context

from .config import seed
from .messages import OfferItem, OfferResponse, PickupOffer
from .nonprofits import NONPROFITS, eligible

# Simulated intake policies (per pickup). Keys are nonprofit ids.
POLICIES: dict[str, dict] = {
    # Many ReStores won't take old windows that may have lead paint.
    "habitat-restore": {"decline_flagged_categories": ["windows"], "max_sq_ft": 400},
    "sample-home-repair": {"max_items": 6},
    "sample-family-furnishing": {},
    "sample-maker-space": {},
}

DISPATCHER_ADDRESS: str = ""


def decide(nonprofit: dict, items: list[OfferItem]) -> tuple[list[str], list[str], str | None]:
    policy = POLICIES.get(nonprofit["id"], {})
    accepted, declined, reasons = [], [], []
    sq_ft = 0.0
    for item in items:
        if not eligible(nonprofit, item):
            declined.append(item.id)
            reasons.append(f"we don't take {item.category.replace('_', ' ')}")
            continue
        if item.safety_flagged and item.category in policy.get("decline_flagged_categories", []):
            declined.append(item.id)
            reasons.append(f"can't accept {item.name.lower()} with a possible lead paint flag")
            continue
        if item.unit == "sq_ft" and sq_ft + item.quantity > policy.get("max_sq_ft", float("inf")):
            declined.append(item.id)
            reasons.append(f"no floor space for {item.name.lower()} this week")
            continue
        if len(accepted) >= policy.get("max_items", float("inf")):
            declined.append(item.id)
            reasons.append("truck is full for this pickup")
            continue
        if item.unit == "sq_ft":
            sq_ft += item.quantity
        accepted.append(item.id)
    note = None
    if accepted:
        note = f"Taking {len(accepted)} items"
    if reasons:
        note = (note + "; " if note else "") + "passing because " + "; ".join(sorted(set(reasons)))
    return accepted, declined, note


def make_nonprofit_agent(nonprofit: dict) -> Agent:
    agent = Agent(name=f"np_{nonprofit['id'].replace('-', '_')}", seed=seed(f"nonprofit-{nonprofit['id']}"))

    @agent.on_message(model=PickupOffer)
    async def handle_offer(ctx: Context, sender: str, offer: PickupOffer):
        accepted, declined, note = decide(nonprofit, offer.items)
        ctx.logger.info(
            f"{nonprofit['name']}: offer from {offer.address} ({offer.pickup_window}) -> "
            f"accept {len(accepted)}, pass {len(declined)}"
        )
        await ctx.send(
            sender,
            OfferResponse(
                scan_id=offer.scan_id,
                nonprofit_id=nonprofit["id"],
                accepted_ids=accepted,
                declined_ids=declined,
                note=note,
                reroute=offer.reroute,
            ),
        )

    return agent


NONPROFIT_AGENTS: dict[str, Agent] = {n["id"]: make_nonprofit_agent(n) for n in NONPROFITS}
