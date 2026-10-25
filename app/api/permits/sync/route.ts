import { NextResponse } from "next/server";
import { apifyConfigured, fetchApifyPermits } from "@/lib/apify";
import { mergePermits } from "@/lib/permits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pull the latest permits from our Apify Actor's dataset and merge them in.
 * Called by the Permit Watcher agent (agents/) on an interval.
 * Returns only the permits that are new since the last sync.
 */
export async function POST(req: Request) {
  const key = process.env.AGENT_API_KEY;
  if (key && req.headers.get("x-agent-key") !== key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!apifyConfigured()) {
    return NextResponse.json({ error: "Apify is not configured (APIFY_TOKEN, APIFY_ACTOR_ID)" }, { status: 503 });
  }
  try {
    const incoming = await fetchApifyPermits();
    const { added, total } = mergePermits(incoming);
    console.log(`[sync] apify=${incoming.length} added=${added.length} total=${total}`);
    return NextResponse.json({ fetched: incoming.length, added, total });
  } catch (e) {
    console.error("[sync] failed:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
