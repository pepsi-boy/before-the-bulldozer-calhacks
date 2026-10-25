import { NextResponse } from "next/server";
import { z } from "zod";
import { addClaim, getStats } from "@/lib/db";

export const runtime = "nodejs";

const Body = z.object({ scanId: z.string(), nonprofitId: z.string(), itemIds: z.array(z.string()).min(1), reroute: z.boolean().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { scanId, nonprofitId, itemIds, reroute } = parsed.data;
  const scan = await addClaim(scanId, nonprofitId, itemIds, reroute ?? false);
  if (!scan) return NextResponse.json({ error: "scan or match not found" }, { status: 404 });
  return NextResponse.json({ scan, stats: await getStats() });
}
