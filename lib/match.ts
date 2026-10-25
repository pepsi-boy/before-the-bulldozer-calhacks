import nonprofitsFile from "@/data/nonprofits.json";
import type { ManifestItem, Match, Nonprofit } from "./types";
import { REASON_SYSTEM, chat, reasonPrompt, withTimeout } from "./oci";

export const nonprofits = nonprofitsFile as Nonprofit[];

const flagged = (i: ManifestItem) => i.safetyFlags.some((f) => f !== "none");

function eligible(n: Nonprofit, item: ManifestItem) {
  if (!item.reusable || item.condition === "poor") return false;
  if (!n.accepts.includes(item.category)) return false;
  if (n.noSafetyFlagged && flagged(item)) return false;
  return true;
}

/**
 * Rules engine: each reusable item goes to exactly one nonprofit (so claims never
 * double count). Prefer a nonprofit that lists the category in `prefers`, then the
 * most specialized one (fewest accepted categories).
 */
export function assignItems(items: ManifestItem[]): Omit<Match, "reason">[] {
  const buckets = new Map<string, string[]>();
  for (const item of items) {
    const candidates = nonprofits.filter((n) => eligible(n, item));
    if (!candidates.length) continue;
    candidates.sort((a, b) => {
      const pa = a.prefers?.includes(item.category) ? 0 : 1;
      const pb = b.prefers?.includes(item.category) ? 0 : 1;
      return pa - pb || a.accepts.length - b.accepts.length;
    });
    const winner = candidates[0].id;
    buckets.set(winner, [...(buckets.get(winner) ?? []), item.id]);
  }
  // Keep nonprofits.json order so the real org (ReStore) shows first.
  return nonprofits.filter((n) => buckets.has(n.id)).map((n) => ({ nonprofitId: n.id, itemIds: buckets.get(n.id)! }));
}

function fallbackReason(n: Nonprofit, names: string[]) {
  return `${n.name} can put ${names.slice(0, 3).join(", ").toLowerCase()} to use: ${n.blurb.charAt(0).toLowerCase()}${n.blurb.slice(1)}`;
}

/** The model writes only the human sentence; the rules above decide who gets what. */
export async function buildMatches(items: ManifestItem[], useAi = true): Promise<Match[]> {
  const byId = new Map(items.map((i) => [i.id, i]));
  return Promise.all(
    assignItems(items).map(async (m) => {
      const n = nonprofits.find((x) => x.id === m.nonprofitId)!;
      const names = m.itemIds.map((id) => byId.get(id)!).map((i) => `${i.quantity} ${i.unit === "each" ? "x" : i.unit.replace("_", " ") + " of"} ${i.name}`);
      if (!useAi) return { ...m, reason: fallbackReason(n, names) };
      try {
        const text = await withTimeout(chat(REASON_SYSTEM, reasonPrompt(n.name, n.blurb, names.join("; ")), [], 120), 10_000, "reason");
        const reason = text.replace(/^["'\s]+|["'\s]+$/g, "").split("\n")[0];
        return { ...m, reason: reason || fallbackReason(n, names) };
      } catch (e) {
        console.warn(`[match] reason fallback for ${n.id}:`, (e as Error).message);
        return { ...m, reason: fallbackReason(n, names) };
      }
    }),
  );
}
