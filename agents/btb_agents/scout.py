"""Scout: gets photos of a house slated for demolition, runs the app's vision scan
(Llama 4 Maverick on OCI), and sends the salvage manifest to the Dispatcher."""

from pathlib import Path

import httpx
from uagents import Agent, Context

from .config import APP_URL, DEMO_MODE, DEMO_PHOTOS_DIR, PHOTOS_DIR, app_headers, seed
from .messages import NewPermit, OfferItem, SalvageManifest, ScanFailed

scout = Agent(name="salvage_scout", seed=seed("salvage-scout"))

DISPATCHER_ADDRESS: str = ""
CONCIERGE_ADDRESS: str = ""
MAX_PHOTOS = 8
IMAGE_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}


def photos_for(permit_id: str) -> tuple[list[Path], bool]:
    """Real photos for this permit if someone uploaded them, else the demo house (if DEMO_MODE)."""
    folder = PHOTOS_DIR / permit_id
    real = sorted(p for p in folder.glob("*") if p.suffix.lower() in IMAGE_TYPES) if folder.exists() else []
    if real:
        return real[:MAX_PHOTOS], False
    if DEMO_MODE:
        demo = sorted(p for p in DEMO_PHOTOS_DIR.glob("*") if p.suffix.lower() in IMAGE_TYPES)
        return demo[:6], True
    return [], False


async def fail(ctx: Context, msg: NewPermit, reason: str):
    ctx.logger.warning(f"{msg.permit_id}: {reason}")
    if msg.requester:
        await ctx.send(
            CONCIERGE_ADDRESS,
            ScanFailed(permit_id=msg.permit_id, address=msg.address, reason=reason, requester=msg.requester),
        )


@scout.on_message(model=NewPermit)
async def scan_house(ctx: Context, sender: str, msg: NewPermit):
    photos, is_demo = photos_for(msg.permit_id)
    if not photos:
        await fail(ctx, msg, "no photos of this house yet. Add some to agents/photos/<permit id>/ after a site visit.")
        return
    photo_note = (
        f"No site photos for this permit yet, so I scanned our {len(photos)}-photo demo house as a stand-in."
        if is_demo
        else f"Scanned {len(photos)} site photos."
    )
    ctx.logger.info(f"{msg.permit_id}: scanning {len(photos)} photos" + (" (demo house)" if is_demo else ""))

    files = [("photos", (p.name, p.read_bytes(), IMAGE_TYPES[p.suffix.lower()])) for p in photos]
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{APP_URL}/api/scan", data={"permitId": msg.permit_id}, files=files, headers=app_headers()
            )
        scan = resp.json()
    except Exception as e:
        await fail(ctx, msg, f"the scan service didn't respond ({e.__class__.__name__}). Try again in a minute.")
        return
    if resp.status_code != 200:
        await fail(ctx, msg, f"the scan service returned an error: {scan.get('error', resp.status_code)}")
        return

    items = [
        OfferItem(
            id=i["id"],
            name=i["name"],
            category=i["category"],
            quantity=i["quantity"],
            unit=i["unit"],
            condition=i["condition"],
            safety_flagged=any(f != "none" for f in i.get("safetyFlags", [])),
        )
        for i in scan["manifest"]["items"]
        if i.get("reusable")
    ]
    ctx.logger.info(
        f"{msg.permit_id}: scan {scan['id']} found {len(items)} reusable items "
        f"(source={scan['source']}, {scan.get('latencyMs')} ms)"
    )
    await ctx.send(
        DISPATCHER_ADDRESS,
        SalvageManifest(
            scan_id=scan["id"],
            permit_id=msg.permit_id,
            address=msg.address,
            source=scan["source"],
            items=items,
            matches=[{"nonprofitId": m["nonprofitId"], "itemIds": m["itemIds"]} for m in scan["matches"]],
            requester=msg.requester,
            photo_note=photo_note,
        ),
    )
