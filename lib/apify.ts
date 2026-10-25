// Reads the dataset from the latest successful run of our Apify Actor
// (apify-actor/, "nashville-demolition-permits").
import { z } from "zod";
import type { Permit } from "./types";

const ApifyPermit = z.object({
  id: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  dateIssued: z.string(),
  permitType: z.string(),
  description: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  contractor: z.string().optional().nullable(),
});

export const apifyConfigured = () => Boolean(process.env.APIFY_TOKEN && process.env.APIFY_ACTOR_ID);

export async function fetchApifyPermits(): Promise<Permit[]> {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_ACTOR_ID; // e.g. "your-username~nashville-demolition-permits"
  if (!token || !actor) throw new Error("APIFY_TOKEN and APIFY_ACTOR_ID must be set");

  const base = process.env.APIFY_API_BASE ?? "https://api.apify.com";
  const url = `${base}/v2/acts/${encodeURIComponent(actor)}/runs/last/dataset/items?status=SUCCEEDED&clean=true&format=json`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Apify dataset request failed: ${res.status}`);
  const rows = (await res.json()) as unknown[];

  const permits: Permit[] = [];
  for (const row of rows) {
    const p = ApifyPermit.safeParse(row);
    if (!p.success) continue;
    permits.push({
      ...p.data,
      description: p.data.description ?? undefined,
      zip: p.data.zip ?? undefined,
      contractor: p.data.contractor ?? undefined,
    });
  }
  return permits;
}
