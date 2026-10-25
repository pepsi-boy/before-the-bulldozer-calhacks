"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Permit } from "@/lib/types";
import { daysSince, prettyDate, urgency } from "@/lib/format";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center label-caps">Loading map…</div>,
});

const LEGEND = [0, 30, 60].map((d) => urgency(new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10)));

export default function RadarView({ permits }: { permits: Permit[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Permit | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? permits.filter((p) => p.address.toLowerCase().includes(q) || p.id.includes(q)) : permits;
  }, [permits, query]);

  return (
    <div className="flex flex-col md:flex-row md:flex-1 md:min-h-0">
      <aside className="order-2 md:order-1 md:w-[400px] shrink-0 flex flex-col md:border-r-4 border-asphalt bg-concrete-50 md:h-full">
        {selected ? (
          <SelectedPanel permit={selected} onClose={() => setSelected(null)} />
        ) : (
          <div className="p-4 border-b-2 border-asphalt">
            <h1 className="font-display text-2xl uppercase tracking-wide">Salvage Radar</h1>
            <p className="text-sm text-concrete-700 mt-1">
              Every pin is a real Nashville residential demolition permit from Metro open data.
              Pick one and look inside before the bulldozer does.
            </p>
          </div>
        )}
        <div className="p-3 border-b-2 border-asphalt bg-concrete-100">
          <label htmlFor="search" className="label-caps">Search address</label>
          <input
            id="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Rosebank Ave"
            className="mt-1 w-full border-2 border-asphalt bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-safety"
          />
          <p className="mt-2 font-mono text-xs text-concrete-500">{filtered.length} of {permits.length} permits · last 90 days</p>
        </div>
        <ul className="flex-1 overflow-y-auto max-h-[50vh] md:max-h-none divide-y divide-concrete-200">
          {filtered.map((p) => {
            const u = urgency(p.dateIssued);
            const active = selected?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  onClick={() => setSelected(p)}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-safety/30 focus-visible:bg-safety/40 focus:outline-none ${active ? "bg-safety/50" : ""}`}
                >
                  <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-asphalt" style={{ background: u.color }} />
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{p.address.split(",")[0]}</span>
                    <span className="block font-mono text-xs text-concrete-500">
                      #{p.id} · {prettyDate(p.dateIssued)} · {daysSince(p.dateIssued)}d ago
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <section className="order-1 md:order-2 relative isolate flex-none h-[55vh] md:flex-1 md:h-full border-b-4 md:border-b-0 border-asphalt">
        <Map permits={filtered} selected={selected} onSelect={setSelected} />
        <div className="absolute bottom-3 right-3 z-[500] bg-concrete-50 border-2 border-asphalt shadow-[3px_3px_0_#1E1E1E] p-2 space-y-1">
          <p className="label-caps !text-asphalt">Permit age</p>
          {LEGEND.map((u) => (
            <p key={u.key} className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 rounded-full border-2 border-asphalt" style={{ background: u.color }} />{u.label}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

function SelectedPanel({ permit, onClose }: { permit: Permit; onClose: () => void }) {
  const u = urgency(permit.dateIssued);
  return (
    <div className="border-b-2 border-asphalt bg-tag relative">
      <div className="caution-tape-thin h-2" aria-hidden />
      <div className="p-4">
        <div className="flex justify-between items-start gap-2">
          <p className="label-caps">Demolition permit #{permit.id}</p>
          <button onClick={onClose} className="label-caps hover:text-asphalt" aria-label="Close permit">✕ Close</button>
        </div>
        <h2 className="font-display text-2xl uppercase leading-tight mt-1">{permit.address.split(",")[0]}</h2>
        <p className="text-sm text-concrete-700">{permit.address.split(",").slice(1).join(",").trim()}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
          <div><dt className="label-caps">Issued</dt><dd>{prettyDate(permit.dateIssued)}</dd></div>
          <div><dt className="label-caps">Type</dt><dd>{permit.permitType.replace("Demolition Permit - ", "Demo · ")}</dd></div>
          {permit.contractor && <div className="col-span-2"><dt className="label-caps">Applicant</dt><dd>{permit.contractor}</dd></div>}
        </dl>
        <p className="mt-2 flex items-center gap-2 text-xs"><span className="h-3 w-3 rounded-full border-2 border-asphalt" style={{ background: u.color }} />{u.label}</p>
        <Link href={`/property/${permit.id}`} className="btn-safety w-full mt-4">Start salvage scan →</Link>
      </div>
    </div>
  );
}
