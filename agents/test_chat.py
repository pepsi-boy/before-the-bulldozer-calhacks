"""Local end-to-end test: a fake ASI:One user chats with the Concierge while every agent runs.

Run the app first, then:
    WATCHER_ENABLED=false CONCIERGE_MAILBOX=false python test_chat.py
"""

import sys, asyncio
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from datetime import datetime, timezone
from uuid import uuid4
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import ChatMessage, ChatAcknowledgement, TextContent, chat_protocol_spec
import run_agents

user = Agent(name="fake_asi1_user", seed="test-user-seed-xyz")
proto = Protocol(spec=chat_protocol_spec)
script = ["what's being torn down in 37208?", "scan #1", "how much have you saved so far?"]
state = {"i": 0}

def msg(t): return ChatMessage(timestamp=datetime.now(timezone.utc), msg_id=uuid4(), content=[TextContent(type="text", text=t)])

@user.on_event("startup")
async def go(ctx: Context):
    await asyncio.sleep(2)
    print(f"\n>>> USER: {script[0]}", flush=True)
    await ctx.send(run_agents.concierge_mod.concierge.address, msg(script[0]))

@proto.on_message(ChatMessage)
async def reply(ctx: Context, sender: str, m: ChatMessage):
    texts = [c.text for c in m.content if isinstance(c, TextContent)]
    ended = any(getattr(c, "type", "") == "end-session" for c in m.content)
    print(f"\n<<< CONCIERGE:\n{texts[0]}\n", flush=True)
    if ended:
        state["i"] += 1
        if state["i"] < len(script):
            print(f">>> USER: {script[state['i']]}", flush=True)
            await ctx.send(sender, msg(script[state["i"]]))
        else:
            print("=== DONE ===", flush=True)

@proto.on_message(ChatAcknowledgement)
async def ack(ctx, s, m): pass

user.include(proto)
run_agents.bureau.add(user)
run_agents.bureau.run()
