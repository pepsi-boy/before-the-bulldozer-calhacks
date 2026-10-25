import { z } from "zod";
import { CATEGORIES, SAFETY_FLAGS, type Manifest, type ManifestItem } from "./types";

const ItemSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string(),
  quantity: z.coerce.number().finite(),
  unit: z.string().optional(),
  condition: z.string().optional(),
  reusable: z.boolean().optional(),
  safetyFlags: z.array(z.string()).optional(),
  photoIndex: z.coerce.number().optional(),
  notes: z.string().optional().nullable(),
});

const ManifestSchema = z.object({
  items: z.array(z.unknown()),
  houseNotes: z.string().optional().nullable(),
  confidence: z.string().optional(),
});

/** Pull the first JSON object out of model text (tolerates ```json fences and chatter). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const UNIT_BY_CATEGORY: Record<string, ManifestItem["unit"]> = {
  cabinets: "linear_ft", lumber_trim: "linear_ft",
  countertops: "sq_ft", flooring_hardwood: "sq_ft", flooring_tile: "sq_ft",
};
const CONDITIONS = ["excellent", "good", "fair", "poor"] as const;

/**
 * zod-validate the model's manifest: drop unknown categories, clamp quantities,
 * normalize units to the materials table so the lookup math stays consistent.
 */
export function normalizeManifest(raw: unknown, photoCount: number): Manifest {
  const m = ManifestSchema.parse(raw);
  const items: ManifestItem[] = [];
  m.items.forEach((rawItem, i) => {
    const parsed = ItemSchema.safeParse(rawItem);
    if (!parsed.success) return;
    const it = parsed.data;
    if (!(CATEGORIES as readonly string[]).includes(it.category)) return;
    const category = it.category as ManifestItem["category"];
    const unit = UNIT_BY_CATEGORY[category] ?? "each";
    let quantity = it.quantity;
    // A cabinet counted "each" is roughly a 2 ft run.
    if (category === "cabinets" && it.unit === "each") quantity *= 2;
    const max = unit === "each" ? 200 : 2000;
    quantity = Math.round(Math.min(max, Math.max(1, quantity)));
    const flags = (it.safetyFlags ?? []).filter(
      (f): f is ManifestItem["safetyFlags"][number] => (SAFETY_FLAGS as readonly string[]).includes(f) && f !== "none");
    items.push({
      id: `it${i + 1}`,
      name: it.name.trim(),
      category,
      quantity,
      unit,
      condition: (CONDITIONS as readonly string[]).includes(it.condition ?? "") ? (it.condition as ManifestItem["condition"]) : "fair",
      reusable: it.reusable ?? true,
      safetyFlags: flags.length ? flags : ["none"],
      photoIndex: Math.min(Math.max(0, Math.round(it.photoIndex ?? 0)), Math.max(0, photoCount - 1)),
      notes: it.notes ?? undefined,
    });
  });
  if (items.length === 0) throw new Error("manifest had no valid items");
  const confidence = m.confidence === "low" || m.confidence === "high" ? m.confidence : "medium";
  return { items: items.slice(0, 25), houseNotes: m.houseNotes ?? "", confidence };
}
