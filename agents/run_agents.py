"""Runs every Before the Bulldozer agent in one process:

  Concierge (ASI:One chat, Agentverse mailbox)
  Permit Watcher -> Salvage Scout -> Dispatcher <-> Nonprofit agents

    python run_agents.py
"""

import os

from uagents import Bureau

from btb_agents import concierge as concierge_mod
from btb_agents import dispatcher as dispatcher_mod
from btb_agents import nonprofit_agents as np_mod
from btb_agents import scout as scout_mod
from btb_agents import watcher as watcher_mod
from btb_agents.config import APP_URL, BUREAU_PORT, DEMO_MODE, POLL_SECONDS

# Wire up who talks to whom.
concierge_mod.SCOUT_ADDRESS = scout_mod.scout.address
watcher_mod.SCOUT_ADDRESS = scout_mod.scout.address
scout_mod.DISPATCHER_ADDRESS = dispatcher_mod.dispatcher.address
scout_mod.CONCIERGE_ADDRESS = concierge_mod.concierge.address
dispatcher_mod.CONCIERGE_ADDRESS = concierge_mod.concierge.address
dispatcher_mod.NONPROFIT_ADDRESSES.update({nid: a.address for nid, a in np_mod.NONPROFIT_AGENTS.items()})

ALL_AGENTS = [
    concierge_mod.concierge,
    watcher_mod.watcher,
    scout_mod.scout,
    dispatcher_mod.dispatcher,
    *np_mod.NONPROFIT_AGENTS.values(),
]

bureau = Bureau(port=BUREAU_PORT, endpoint=[os.environ["PUBLIC_ENDPOINT"]])
for agent in ALL_AGENTS:
    bureau.add(agent)

if __name__ == "__main__":
    print(f"App: {APP_URL} | Apify sync every {POLL_SECONDS:.0f}s | demo photos: {DEMO_MODE}")
    print("Agent addresses (paste these into the README table):")
    for agent in ALL_AGENTS:
        print(f"  {agent.name:<32} {agent.address}")
    if os.getenv("WATCHER_ENABLED", "true").lower() != "true":
        print("Permit Watcher autoscan is off (WATCHER_ENABLED=false); chat requests still work.")
    bureau.run()
