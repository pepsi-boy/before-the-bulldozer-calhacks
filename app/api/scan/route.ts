import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { MANIFEST_SYSTEM, chat, manifestPrompt, withTimeout } from "@/lib/oci";
import { extractJson, normalizeManifest } from "@/lib/validate";
import { enrichManifest, totalsFor } from "@/lib/enrich";
import { buildMatches } from "@/lib/match";
import { saveScan } from "@/lib/db";
import { getPermit } from "@/lib/permits";
import type { Manifest, Scan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PHOTOS = 8;
const MAX_BYTES = 5 * 1024 * 1024; // OCI per-image limit
const VISION_BUDGET_MS = 30_000; // spec: >30 s on stage => cached scan

async function demoManifest(): Promise<Manifest | null> {
  try {
    const demo = JSON.parse(await fs.readFile(join(process.cwd(), "data", "demo-scan.json"), "utf8")) as Scan;
    return demo.manifest;
  } catch {
    return null;
  }
}

/** One vision call; if the JSON is bad, retry once with a stricter nudge. */
async function visionManifest(photos: string[], address: string, permitType: string, deadline: number) {
  const prompt = manifestPrompt(photos.length, address, permitType);
  const left = () => Math.max(1_000, deadline - Date.now());
  const first = await withTimeout(chat(MANIFEST_SYSTEM, prompt, photos), left(), "vision");
  try {
    return normalizeManifest(extractJson(first), photos.length);
  } catch (e) {
    console.warn("[scan] bad manifest JSON, retrying once:", (e as Error).message);
    const second = await withTimeout(chat(MANIFEST_SYSTEM, `${prompt}\n\nReturn only valid JSON.`, photos), left(), "vision retry");
    return normalizeManifest(extractJson(second), photos.length);
  }
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "expected multipart form" }, { status: 400 });

  const permit = getPermit(String(form.get("permitId") ?? ""));
  if (!permit) return NextResponse.json({ error: "unknown permit" }, { status: 404 });

  const files = form.getAll("photos").filter((f): f is File => f instanceof File).slice(0, MAX_PHOTOS);
  const offline = form.get("offline") === "1";
  if (!files.length && !offline) return NextResponse.json({ error: "upload at least one photo" }, { status: 400 });

  const photos: string[] = [];
  for (const f of files) {
    if (!/^image\/(jpe?g|png)$/.test(f.type)) return NextResponse.json({ error: `${f.name}: jpg or png only` }, { status: 400 });
    if (f.size > MAX_BYTES) return NextResponse.json({ error: `${f.name}: over 5 MB` }, { status: 400 });
    photos.push(Buffer.from(await f.arrayBuffer()).toString("base64"));
  }

  const started = Date.now();
  let manifest: Manifest | null = null;
  let source: Scan["source"] = "ai";
  if (!offline) {
    try {
      manifest = await visionManifest(photos, permit.address, permit.permitType, started + VISION_BUDGET_MS);
    } catch (e) {
      console.error("[scan] vision failed, using demo fallback:", (e as Error).message);
    }
  }
  if (!manifest) {
    manifest = await demoManifest();
    source = "demo";
    if (!manifest) return NextResponse.json({ error: "AI scan failed and no demo fallback is available" }, { status: 502 });
  }

  const enriched = enrichManifest(manifest);
  const matches = await buildMatches(enriched.items, source === "ai");
  const scan: Scan = {
    id: randomUUID().slice(0, 8),
    permitId: permit.id,
    createdAt: new Date().toISOString(),
    manifest: enriched,
    matches,
    totals: totalsFor(enriched.items),
    claims: [],
    source,
    latencyMs: Date.now() - started,
  };
  console.log(`[scan] ${scan.id} permit=${permit.id} photos=${photos.length} items=${enriched.items.length} source=${source} total=${scan.latencyMs}ms`);
  await saveScan(scan);
  return NextResponse.json(scan);
}
