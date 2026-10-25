import type { ManifestItem, Match, Nonprofit } from "@/lib/types";
import { UNIT_LABEL, pickupWindow, tons, usd } from "@/lib/format";

export default function MatchCard({ match, nonprofit, items, claimedIds, onClaim, busy }: {
  match: Match; nonprofit: Nonprofit; items: ManifestItem[]; claimedIds: Set<string>;
  onClaim: () => void; busy: boolean;
}) {
  const mine = items.filter((i) => match.itemIds.includes(i.id));
  const allClaimed = mine.every((i) => claimedIds.has(i.id));
  const value = mine.reduce((s, i) => s + (i.estValueUsd ?? 0), 0);
  const lb = mine.reduce((s, i) => s + (i.estWeightLb ?? 0), 0);
  return (
    <article className={`border-2 border-asphalt bg-concrete-50 shadow-[4px_4px_0_#1E1E1E] flex flex-col ${allClaimed ? "!bg-[#D3F0D9]" : ""}`}>
      <div className={`h-2 ${allClaimed ? "bg-claimed" : "caution-tape-thin"}`} aria-hidden />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl uppercase leading-tight">
            {nonprofit.url ? <a href={nonprofit.url} target="_blank" rel="noreferrer" className="hover:underline">{nonprofit.name}</a> : nonprofit.name}
          </h3>
          {nonprofit.sample && <span className="stamp text-concrete-500 border-concrete-500 shrink-0">Sample</span>}
        </div>
        <p className="mt-2 text-sm">{match.reason}</p>
        <ul className="mt-3 flex flex-wrap gap-1">
          {mine.map((i) => (
            <li key={i.id} className={`font-mono text-xs px-2 py-0.5 border ${claimedIds.has(i.id) ? "bg-claimed text-white border-claimed" : "bg-white border-concrete-300"}`}>
              {i.quantity} {UNIT_LABEL[i.unit]} {i.name}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-x-4 font-mono text-xs text-concrete-700">
          <span>{usd(value)}</span><span>{tons(lb)} t</span>
          <span>{nonprofit.pickup ? `Proposed pickup: ${pickupWindow()}` : "Drop-off only (no truck)"}</span>
        </div>
        <div className="mt-auto pt-4">
          {allClaimed ? (
            <p className="font-display uppercase tracking-wider text-claimed text-lg">✓ Claimed · pickup requested</p>
          ) : (
            <button onClick={onClaim} disabled={busy} className="btn-safety w-full">
              {busy ? "Claiming…" : `Claim ${mine.length} item${mine.length > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
