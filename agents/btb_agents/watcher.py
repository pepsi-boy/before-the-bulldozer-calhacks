"""Permit Watcher: every few minutes, asks the app to sync the latest demolition permits
from our Apify Actor's dataset, then hands each new house to the Scout."""

import httpx
from uagents import Agent, Context

import os

from .config import APP_URL, MAX_NEW_PER_SYNC, POLL_SECONDS, app_headers, seed
from .messages import NewPermit

watcher = Agent(name="permit_watcher", seed=seed("permit-watcher"))

# Set by run_agents.py once all agents exist.
SCOUT_ADDRESS: str = ""

# New permits waiting to be scanned (the sync only reports each permit as "new" once).
QUEUE: list[dict] = []


@watcher.on_interval(period=POLL_SECONDS)
async def poll_apify(ctx: Context):
    if os.getenv("WATCHER_ENABLED", "true").lower() != "true":
        return
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{APP_URL}/api/permits/sync", headers=app_headers())
        body = resp.json()
    except Exception as e:  # app down, network hiccup, etc. Try again next tick.
        ctx.logger.warning(f"Sync failed: {e}")
        body, resp = {"added": []}, None
    if resp is not None and resp.status_code != 200:
        ctx.logger.warning(f"Sync returned {resp.status_code}: {body.get('error')}")
        body = {"added": []}

    added = body.get("added", [])
    QUEUE.extend(added)
    ctx.logger.info(
        f"Apify sync: {body.get('fetched')} permits fetched, {len(added)} new, {len(QUEUE)} waiting to scan"
    )
    batch = QUEUE[:MAX_NEW_PER_SYNC]
    del QUEUE[:MAX_NEW_PER_SYNC]
    for p in batch:
        ctx.logger.info(f"New demolition permit {p['id']} at {p['address']}, sending to Scout")
        await ctx.send(
            SCOUT_ADDRESS,
            NewPermit(
                permit_id=p["id"],
                address=p["address"],
                date_issued=p.get("dateIssued", ""),
                permit_type=p.get("permitType", ""),
            ),
        )
