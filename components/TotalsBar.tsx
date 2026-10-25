import type { Scan } from "@/lib/types";
import { SHOW_CO2, num, tons, usd } from "@/lib/format";

export default function TotalsBar({ scan }: { scan: Scan }) {
  const { totals, manifest } = scan;
  const flagged = manifest.items.filter((i) => i.safetyFlags.some((f) => f !== "none")).length;
  const cells = [
    { label: "Est. resale value", value: usd(totals.valueUsd) },
    { label: "Tons diverted", value: tons(totals.weightLb) },
    ...(SHOW_CO2 ? [{ label: "kg CO₂ avoided", value: num(totals.co2Kg) }] : []),
    { label: "Items found", value: String(manifest.items.length) },
  ];
  return (
    <section className="bg-asphalt text-concrete-50 border-2 border-asphalt">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-tar">
        {cells.map((c) => (
          <div key={c.label} className="p-4">
            <p className="label-caps !text-concrete-300">{c.label}</p>
            <p className="font-mono text-3xl font-bold text-safety mt-1">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t-2 border-tar px-4 py-2 font-mono text-xs text-concrete-200">
        <span>AI confidence: <b className="text-safety uppercase">{manifest.confidence}</b></span>
        {flagged > 0 && <span>⚠ {flagged} item{flagged > 1 ? "s" : ""} safety-flagged · routed away from families</span>}
        <span>{scan.source === "ai" ? `OCI Generative AI · Llama 4 Maverick${scan.latencyMs ? ` · ${(scan.latencyMs / 1000).toFixed(1)}s` : ""}` : "Cached demo scan (AI unavailable)"}</span>
      </div>
    </section>
  );
}
