"""Nonprofit data shared with the app (data/nonprofits.json) plus the eligibility rules
from lib/match.ts, so the Dispatcher can reroute items the app's first choice declines."""

import json

from .config import NONPROFITS_PATH
from .messages import OfferItem

NONPROFITS: list[dict] = json.loads(NONPROFITS_PATH.read_text())
BY_ID = {n["id"]: n for n in NONPROFITS}


def eligible(nonprofit: dict, item: OfferItem) -> bool:
    if item.condition == "poor":
        return False
    if item.category not in nonprofit["accepts"]:
        return False
    if nonprofit.get("noSafetyFlagged") and item.safety_flagged:
        return False
    return True


def next_choice(item: OfferItem, tried: set[str]) -> str | None:
    """Best nonprofit for an item that hasn't been offered it yet (same tie-breaks as the app)."""
    candidates = [n for n in NONPROFITS if n["id"] not in tried and eligible(n, item)]
    candidates.sort(key=lambda n: (0 if item.category in n.get("prefers", []) else 1, len(n["accepts"])))
    return candidates[0]["id"] if candidates else None
