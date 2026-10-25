"""Nashville Demolition Permits Actor.

Queries Metro Nashville's "Building Permits Issued" ArcGIS layer for recent
demolition permits and pushes them to the default dataset in the same shape
the Before the Bulldozer app uses (see lib/types.ts -> Permit).
"""

import re
from datetime import datetime, timedelta, timezone

import httpx
from apify import Actor

LAYER_URL = (
    "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/"
    "Building_Permits_Issued_2/FeatureServer/0/query"
)
OUT_FIELDS = (
    "Permit__,Permit_Subtype_Description,Date_Issued,Address,City,ZIP,"
    "Contact,Purpose,Lat,Lon"
)
PAGE_SIZE = 1000  # the layer's Max Record Count


def title_case(s: str) -> str:
    return re.sub(r"\b([a-z])", lambda m: m.group(1).upper(), s.lower())


def clip(s: str, n: int) -> str:
    if len(s) <= n:
        return s
    cut = s.rfind(" ", 0, n)
    return s[: cut if cut > 0 else n] + "…"


def to_permit(a: dict) -> dict | None:
    """Convert one ArcGIS record into the app's Permit shape. Skips records without coordinates."""
    if not a.get("Lat") or not a.get("Lon") or not a.get("Permit__"):
        return None
    city = title_case(a.get("City") or "Nashville")
    zip_code = (a.get("ZIP") or "").strip()
    address = f"{title_case(a.get('Address') or '')}, {city}, TN {zip_code}".strip()
    purpose = re.sub(r"\s+", " ", a.get("Purpose") or "").strip()
    contact = re.sub(r"\s+", " ", a.get("Contact") or "").strip()
    issued = a.get("Date_Issued")
    permit = {
        "id": a["Permit__"],
        "address": address,
        "lat": a["Lat"],
        "lng": a["Lon"],
        "dateIssued": (
            datetime.fromtimestamp(issued / 1000, tz=timezone.utc).strftime("%Y-%m-%d") if issued else None
        ),
        "permitType": a.get("Permit_Subtype_Description") or "Demolition",
        "zip": zip_code or None,
    }
    if purpose:
        permit["description"] = clip(purpose, 280)
    if contact:
        permit["contractor"] = title_case(contact)
    return permit


async def main() -> None:
    async with Actor:
        actor_input = await Actor.get_input() or {}
        days_back = int(actor_input.get("daysBack", 90))
        max_results = int(actor_input.get("maxResults", 100))
        residential_only = bool(actor_input.get("residentialOnly", True))

        since = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")
        where = f"Permit_Type_Description LIKE '%Demolition%' AND Date_Issued >= DATE '{since}'"
        if residential_only:
            where += " AND Permit_Subtype_Description LIKE '%Residential%'"
        Actor.log.info(f"Querying Metro Nashville permits: {where}")

        seen: set[str] = set()
        pushed = 0
        offset = 0
        async with httpx.AsyncClient(timeout=30) as client:
            while pushed < max_results:
                params = {
                    "where": where,
                    "outFields": OUT_FIELDS,
                    "orderByFields": "Date_Issued DESC",
                    "resultOffset": offset,
                    "resultRecordCount": PAGE_SIZE,
                    "f": "json",
                }
                resp = await client.get(LAYER_URL, params=params)
                resp.raise_for_status()
                body = resp.json()
                if "error" in body:
                    raise RuntimeError(f"ArcGIS returned an error: {body['error']}")

                features = body.get("features", [])
                if not features:
                    break

                for feature in features:
                    permit = to_permit(feature.get("attributes", {}))
                    if not permit or permit["id"] in seen:
                        continue
                    seen.add(permit["id"])
                    await Actor.push_data(permit)
                    pushed += 1
                    if pushed >= max_results:
                        break

                if not body.get("exceededTransferLimit"):
                    break
                offset += len(features)

        Actor.log.info(f"Pushed {pushed} demolition permits issued since {since}")
