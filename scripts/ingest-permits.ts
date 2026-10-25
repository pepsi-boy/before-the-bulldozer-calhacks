/**
 * Pulls recent demolition permits from Metro Nashville's open data
 * (Building Permits Issued, ArcGIS Feature Server) into data/permits.json.
 * Run once: `npm run ingest`.
 *
 * If APIFY_TOKEN and APIFY_ACTOR_ID are set, reads the latest run of our Apify Actor
 * (apify-actor/) instead of calling Metro directly. The app also syncs from Apify at
 * runtime via POST /api/permits/sync (used by the Permit Watcher agent).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Permit } from "../lib/types";
import { apifyConfigured, fetchApifyPermits } from "../lib/apify";

const LAYER =
  "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Building_Permits_Issued_2/FeatureServer/0/query";
const DAYS = Number(process.env.INGEST_DAYS ?? 90);
const MAX = Number(process.env.INGEST_MAX ?? 100);

type Attrs = {
  Permit__: string; Permit_Subtype_Description: string; Date_Issued: number;
  Address: string; City: string; ZIP: string; Contact: string; Purpose: string | null;
  Lat: number | null; Lon: number | null;
};

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)) + "…");
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());

async function main() {
  if (apifyConfigured()) {
    const permits = (await fetchApifyPermits()).slice(0, MAX);
    const out = join(process.cwd(), "data", "permits.json");
    writeFileSync(out, JSON.stringify(permits, null, 2) + "\n");
    console.log(`Wrote ${permits.length} demolition permits from Apify to ${out}`);
    return;
  }
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    where: `Permit_Type_Description LIKE '%Demolition%' AND Permit_Subtype_Description LIKE '%Residential%' AND Date_Issued >= DATE '${since}'`,
    outFields: "Permit__,Permit_Subtype_Description,Date_Issued,Address,City,ZIP,Contact,Purpose,Lat,Lon",
    orderByFields: "Date_Issued DESC",
    resultRecordCount: "500",
    f: "json",
  });
  const res = await fetch(`${LAYER}?${params}`);
  if (!res.ok) throw new Error(`Metro query failed: ${res.status}`);
  const body = (await res.json()) as { features?: { attributes: Attrs }[]; error?: unknown };
  if (!body.features) throw new Error(`Metro query error: ${JSON.stringify(body.error)}`);

  const seen = new Set<string>();
  const permits: Permit[] = [];
  for (const { attributes: a } of body.features) {
    if (!a.Lat || !a.Lon || seen.has(a.Permit__)) continue;
    seen.add(a.Permit__);
    permits.push({
      id: a.Permit__,
      address: `${titleCase(a.Address)}, ${titleCase(a.City ?? "Nashville")}, TN ${a.ZIP ?? ""}`.trim(),
      lat: a.Lat,
      lng: a.Lon,
      dateIssued: new Date(a.Date_Issued).toISOString().slice(0, 10),
      permitType: a.Permit_Subtype_Description,
      description: clip(a.Purpose?.replace(/\s+/g, " ").trim() ?? "", 280) || undefined,
      zip: a.ZIP,
      contractor: a.Contact ? titleCase(a.Contact.replace(/\s+/g, " ").trim()) : undefined,
    });
    if (permits.length >= MAX) break;
  }

  const out = join(process.cwd(), "data", "permits.json");
  writeFileSync(out, JSON.stringify(permits, null, 2) + "\n");
  console.log(`Wrote ${permits.length} demolition permits (since ${since}) to ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
