import materialsFile from "@/data/materials.json";
import type { Manifest, ManifestItem, Material, Totals } from "./types";

const materials = materialsFile.materials as Material[];
const multiplier = materialsFile.conditionMultiplier as Record<ManifestItem["condition"], number>;
const byCategory = new Map(materials.map((m) => [m.category, m]));

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * The AI only identifies and counts. Value, weight and CO2 come from our table:
 *   value  = $/unit  x qty x condition multiplier
 *   weight = lb/unit x qty            (only if reusable and not "poor")
 *   co2    = weight  x kg CO2e per lb (EPA WARM source-reduction approximation)
 */
export function enrichItem(item: ManifestItem): ManifestItem {
  const m = byCategory.get(item.category) ?? byCategory.get("other")!;
  const mult = multiplier[item.condition] ?? 0;
  const salvageable = item.reusable && mult > 0;
  const weight = salvageable ? m.weightLbPerUnit * item.quantity : 0;
  return {
    ...item,
    estValueUsd: salvageable ? Math.round(m.valueUsdPerUnit * item.quantity * mult) : 0,
    estWeightLb: round(weight),
    estCo2Kg: round(weight * m.co2KgPerLb),
  };
}

export function enrichManifest(manifest: Manifest): Manifest {
  return { ...manifest, items: manifest.items.map(enrichItem) };
}

export function totalsFor(items: ManifestItem[]): Totals {
  return items.reduce(
    (t, i) => ({
      valueUsd: t.valueUsd + (i.estValueUsd ?? 0),
      weightLb: round(t.weightLb + (i.estWeightLb ?? 0)),
      co2Kg: round(t.co2Kg + (i.estCo2Kg ?? 0)),
    }),
    { valueUsd: 0, weightLb: 0, co2Kg: 0 },
  );
}
