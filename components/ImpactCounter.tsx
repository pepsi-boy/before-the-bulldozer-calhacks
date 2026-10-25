"use client";

import { useEffect, useState } from "react";
import type { Stats } from "@/lib/types";
import { SHOW_CO2, num, usd } from "@/lib/format";

const STATS_EVENT = "btb:stats";
const DELTA_EVENT = "btb:delta";

/** Broadcast authoritative stats (from /api/claim) to every counter on the page. */
export function publishStats(stats: Stats) {
  window.dispatchEvent(new CustomEvent<Stats>(STATS_EVENT, { detail: stats }));
}

/** Optimistic bump before the server answers. */
export function publishDelta(delta: { weightLb: number; valueUsd: number; co2Kg: number; items: number }) {
  window.dispatchEvent(new CustomEvent(DELTA_EVENT, { detail: delta }));
}

export default function ImpactCounter() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    fetch("/api/stats", { cache: "no-store" }).then((r) => r.json()).then(setStats).catch(() => {});
    const onStats = (e: Event) => setStats((e as CustomEvent<Stats>).detail);
    const onDelta = (e: Event) => {
      const d = (e as CustomEvent).detail as { weightLb: number; valueUsd: number; co2Kg: number; items: number };
      setStats((s) => s && {
        ...s,
        tonsDiverted: Math.round((s.tonsDiverted + d.weightLb / 2000) * 100) / 100,
        valueUsd: s.valueUsd + d.valueUsd,
        co2Kg: s.co2Kg + d.co2Kg,
        itemsClaimed: s.itemsClaimed + d.items,
      });
      setBump((b) => b + 1);
    };
    window.addEventListener(STATS_EVENT, onStats);
    window.addEventListener(DELTA_EVENT, onDelta);
    return () => { window.removeEventListener(STATS_EVENT, onStats); window.removeEventListener(DELTA_EVENT, onDelta); };
  }, []);

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-1" aria-live="polite">
      <div className="flex items-baseline gap-2">
        <span key={bump} className={`font-mono text-3xl sm:text-4xl font-bold text-safety inline-block ${bump ? "tick" : ""}`}>
          {stats ? stats.tonsDiverted.toFixed(2) : "—"}
        </span>
        <span className="font-display uppercase tracking-wider text-concrete-100 text-sm sm:text-base leading-tight">
          tons kept out<br className="hidden sm:block" /> of the landfill
        </span>
      </div>
      {stats && (
        <dl className="flex gap-4 font-mono text-xs text-concrete-200">
          <div><dt className="label-caps !text-concrete-300">Materials</dt><dd>{usd(stats.valueUsd)}</dd></div>
          {SHOW_CO2 && <div><dt className="label-caps !text-concrete-300">CO₂ avoided</dt><dd>{num(stats.co2Kg)} kg</dd></div>}
          <div><dt className="label-caps !text-concrete-300">Houses</dt><dd>{stats.housesScanned}</dd></div>
          <div><dt className="label-caps !text-concrete-300">Items</dt><dd>{num(stats.itemsClaimed)}</dd></div>
        </dl>
      )}
    </div>
  );
}
