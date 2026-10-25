import type { ManifestItem } from "@/lib/types";
import { CATEGORY_LABEL, FLAG_LABEL, SHOW_CO2, UNIT_LABEL, usd } from "@/lib/format";

const CONDITION_STYLE: Record<ManifestItem["condition"], string> = {
  excellent: "text-claimed border-claimed",
  good: "text-asphalt border-asphalt",
  fair: "text-[#B07A00] border-[#B07A00]",
  poor: "text-hazard border-hazard",
};

export default function ItemCard({ item, claimed, photoUrl, destination }: {
  item: ManifestItem; claimed: boolean; photoUrl?: string; destination?: string;
}) {
  const flags = item.safetyFlags.filter((f) => f !== "none");
  return (
    <article
      className={`relative border-2 border-asphalt pl-10 pr-4 py-4 shadow-[3px_3px_0_#1E1E1E] transition-colors
        ${claimed ? "bg-[#D3F0D9]" : "bg-tag"} ${!item.reusable ? "opacity-70" : ""}`}
    >
      <span className="hole-punch" aria-hidden />
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <p className="label-caps">{CATEGORY_LABEL(item.category)} · photo #{item.photoIndex + 1}</p>
          <h3 className="font-display text-lg uppercase leading-tight tracking-wide mt-0.5">{item.name}</h3>
          <p className="font-mono text-2xl font-bold mt-1">
            {item.quantity.toLocaleString()} <span className="text-sm font-normal">{UNIT_LABEL[item.unit]}</span>
          </p>
        </div>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-16 w-16 object-cover border-2 border-asphalt shrink-0" />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`stamp ${CONDITION_STYLE[item.condition]}`}>{item.condition}</span>
        {!item.reusable && <span className="stamp text-hazard border-hazard">Not reusable</span>}
        {claimed && <span className="stamp text-claimed border-claimed rotate-[3deg]">Claimed</span>}
      </div>
      {flags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {flags.map((f) => (
            <li key={f} className="inline-flex items-center gap-1 bg-hazard text-white text-xs font-semibold px-2 py-0.5">
              <span aria-hidden>⚠</span>{FLAG_LABEL[f] ?? f}
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t-2 border-dashed border-concrete-300 pt-2 font-mono text-xs">
        <div><dt className="label-caps">Value</dt><dd className="font-bold">{usd(item.estValueUsd ?? 0)}</dd></div>
        <div><dt className="label-caps">Weight</dt><dd className="font-bold">{Math.round(item.estWeightLb ?? 0).toLocaleString()} lb</dd></div>
        {SHOW_CO2 && <div><dt className="label-caps">CO₂</dt><dd className="font-bold">{Math.round(item.estCo2Kg ?? 0).toLocaleString()} kg</dd></div>}
      </dl>
      {item.notes && <p className="mt-2 text-xs text-concrete-700">{item.notes}</p>}
      <p className="mt-2 text-xs font-semibold">
        {destination ? <>→ {destination}</> : <span className="text-concrete-500">{!item.reusable || item.condition === "poor" ? "Too damaged to reuse: landfill or recycling" : flags.length ? "Held: needs a pro to assess before reuse" : "No match yet"}</span>}
      </p>
    </article>
  );
}
