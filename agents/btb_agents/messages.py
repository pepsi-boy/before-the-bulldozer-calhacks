"""Messages the agents send each other."""

from typing import List, Optional

from uagents import Model


class NewPermit(Model):
    """Watcher or Concierge -> Scout: scan this house.
    `requester` is the ASI:One user to report back to (None when the Watcher found it on its own)."""
    permit_id: str
    address: str
    date_issued: str
    permit_type: str
    requester: Optional[str] = None


class OfferItem(Model):
    id: str
    name: str
    category: str
    quantity: float
    unit: str
    condition: str
    safety_flagged: bool


class SalvageManifest(Model):
    """Scout -> Dispatcher: what's inside the house, and the app's proposed matches."""
    scan_id: str
    permit_id: str
    address: str
    source: str  # "ai" or "demo" (cached fallback)
    items: List[OfferItem]
    matches: List[dict]  # [{"nonprofitId": str, "itemIds": [str]}]
    requester: Optional[str] = None
    photo_note: str = ""


class ScanFailed(Model):
    """Scout -> Concierge: couldn't scan the house."""
    permit_id: str
    address: str
    reason: str
    requester: str


class PickupOffer(Model):
    """Dispatcher -> Nonprofit: would you like these items?"""
    scan_id: str
    permit_id: str
    address: str
    items: List[OfferItem]
    pickup_window: str
    reroute: bool = False


class OfferResponse(Model):
    """Nonprofit -> Dispatcher: which items they'll take."""
    scan_id: str
    nonprofit_id: str
    accepted_ids: List[str]
    declined_ids: List[str]
    note: Optional[str] = None
    reroute: bool = False


class DispatchReport(Model):
    """Dispatcher -> Concierge: final outcome for a house, once every offer is answered."""
    scan_id: str
    permit_id: str
    address: str
    requester: str
    source: str
    photo_note: str
    pickup_window: str
    claims: List[dict]  # [{"nonprofit": name, "items": [item names], "rerouted": bool}]
    unplaced: List[str]  # item names nobody could take
    notes: List[str]  # nonprofit explanations (why they passed on something)
    stats: dict  # app-wide impact after these claims
    property_url: str
