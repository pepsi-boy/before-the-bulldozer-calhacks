// JSON-file storage (data/db.json). Production path: OCI Autonomous Database.
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { Scan, Stats } from "./types";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "db.json");

type Db = { scans: Scan[] };

let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, "utf8")) as Db;
  } catch {
    return { scans: [] };
  }
}

async function write(db: Db) {
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_PATH);
}

/** Serialize read-modify-write so concurrent claims don't clobber each other. */
function mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await read();
    const result = await fn(db);
    await write(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function getScan(id: string) {
  return (await read()).scans.find((s) => s.id === id) ?? null;
}

export async function latestScanForPermit(permitId: string) {
  const scans = (await read()).scans.filter((s) => s.permitId === permitId);
  return scans.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function saveScan(scan: Scan) {
  return mutate((db) => { db.scans.push(scan); return scan; });
}

export function addClaim(scanId: string, nonprofitId: string, itemIds: string[], reroute = false) {
  return mutate((db) => {
    const scan = db.scans.find((s) => s.id === scanId);
    if (!scan) return null;
    let match = scan.matches.find((m) => m.nonprofitId === nonprofitId);
    if (reroute) {
      // The dispatcher agent moved items here after their first nonprofit declined them.
      // Move each unclaimed, reusable item out of its old match and into this one.
      const claimed = new Set(scan.claims.flatMap((c) => c.itemIds));
      const movable = itemIds.filter((id) => {
        const item = scan.manifest.items.find((i) => i.id === id);
        return item?.reusable && !claimed.has(id);
      });
      if (movable.length) {
        if (!match) {
          match = { nonprofitId, itemIds: [], reason: "Rerouted by the dispatcher agent after another nonprofit passed on these items." };
          scan.matches.push(match);
        }
        for (const m of scan.matches) if (m !== match) m.itemIds = m.itemIds.filter((id) => !movable.includes(id));
        for (const id of movable) if (!match.itemIds.includes(id)) match.itemIds.push(id);
        scan.matches = scan.matches.filter((m) => m.itemIds.length);
      }
    }
    if (!match) return null;
    const already = new Set(scan.claims.flatMap((c) => c.itemIds));
    const fresh = itemIds.filter((id) => match.itemIds.includes(id) && !already.has(id));
    if (fresh.length) scan.claims.push({ nonprofitId, itemIds: fresh, at: new Date().toISOString() });
    return scan;
  });
}

export async function getStats(): Promise<Stats> {
  const { scans } = await read();
  const stats: Stats = { housesScanned: new Set(scans.map((s) => s.permitId)).size, itemsClaimed: 0, tonsDiverted: 0, valueUsd: 0, co2Kg: 0 };
  let lb = 0;
  for (const s of scans) {
    const claimed = new Set(s.claims.flatMap((c) => c.itemIds));
    for (const item of s.manifest.items) {
      if (!claimed.has(item.id)) continue;
      stats.itemsClaimed += item.unit === "each" ? item.quantity : 1;
      lb += item.estWeightLb ?? 0;
      stats.valueUsd += item.estValueUsd ?? 0;
      stats.co2Kg += item.estCo2Kg ?? 0;
    }
  }
  stats.tonsDiverted = Math.round((lb / 2000) * 100) / 100;
  stats.co2Kg = Math.round(stats.co2Kg);
  return stats;
}
