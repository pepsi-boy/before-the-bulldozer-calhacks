// Permits live in data/permits.json. Read at request time (not bundled at build time)
// so new permits synced from the Apify Actor show up without a rebuild.
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { Permit } from "./types";

const PERMITS_PATH = join(process.cwd(), "data", "permits.json");

export function getPermits(): Permit[] {
  try {
    return JSON.parse(readFileSync(PERMITS_PATH, "utf8")) as Permit[];
  } catch {
    return [];
  }
}

export const getPermit = (id: string) => getPermits().find((p) => p.id === id) ?? null;

/** Merge incoming permits (newest first). Returns the ones we didn't have before. */
export function mergePermits(incoming: Permit[], max = 500): { added: Permit[]; total: number } {
  const current = getPermits();
  const known = new Set(current.map((p) => p.id));
  const added = incoming.filter((p) => !known.has(p.id));
  const merged = [...added, ...current]
    .sort((a, b) => b.dateIssued.localeCompare(a.dateIssued))
    .slice(0, max);
  const tmp = `${PERMITS_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(merged, null, 2) + "\n");
  renameSync(tmp, PERMITS_PATH);
  return { added, total: merged.length };
}
