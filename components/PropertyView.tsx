"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Nonprofit, Permit, Scan } from "@/lib/types";
import { daysSince, prettyDate, urgency } from "@/lib/format";
import PhotoDropzone, { type Photo } from "./PhotoDropzone";
import ItemCard from "./ItemCard";
import TotalsBar from "./TotalsBar";
import MatchCard from "./MatchCard";
import { publishDelta, publishStats } from "./ImpactCounter";

export default function PropertyView({ permit, initialScan, nonprofits }: {
  permit: Permit; initialScan: Scan | null; nonprofits: Nonprofit[];
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [scan, setScan] = useState<Scan | null>(initialScan);
  const [scanning, setScanning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [rescan, setRescan] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const u = urgency(permit.dateIssued);

  useEffect(() => {
    if (!scanning) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(t);
  }, [scanning]);

  const claimedIds = useMemo(() => new Set(scan?.claims.flatMap((c) => c.itemIds) ?? []), [scan]);
  const destination = useMemo(() => {
    const m = new Map<string, string>();
    scan?.matches.forEach((x) => x.itemIds.forEach((id) => m.set(id, nonprofits.find((n) => n.id === x.nonprofitId)?.name ?? "")));
    return m;
  }, [scan, nonprofits]);

  async function runScan() {
    setError(null);
    setScanning(true);
    setElapsed(0);
    try {
      const form = new FormData();
      form.set("permitId", permit.id);
      photos.forEach((p, i) => form.append("photos", p.blob, `photo-${i + 1}.jpg`));
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Scan failed");
      setScan(body as Scan);
      setRescan(false);
      window.history.replaceState(null, "", `/property/${permit.id}?scan=${body.id}`);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  async function claim(nonprofitId: string, itemIds: string[]) {
    if (!scan) return;
    const fresh = itemIds.filter((id) => !claimedIds.has(id));
    if (!fresh.length) return;
    const prev = scan;
    const items = scan.manifest.items.filter((i) => fresh.includes(i.id));
    // Optimistic: items turn green and the counter ticks up immediately.
    setScan({ ...scan, claims: [...scan.claims, { nonprofitId, itemIds: fresh, at: new Date().toISOString() }] });
    publishDelta({
      weightLb: items.reduce((s, i) => s + (i.estWeightLb ?? 0), 0),
      valueUsd: items.reduce((s, i) => s + (i.estValueUsd ?? 0), 0),
      co2Kg: items.reduce((s, i) => s + (i.estCo2Kg ?? 0), 0),
      items: items.reduce((s, i) => s + (i.unit === "each" ? i.quantity : 1), 0),
    });
    setClaiming(nonprofitId);
    try {
      const res = await fetch("/api/claim", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanId: scan.id, nonprofitId, itemIds: fresh }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Claim failed");
      setScan(body.scan);
      publishStats(body.stats);
    } catch (e) {
      setScan(prev);
      setError((e as Error).message);
      fetch("/api/stats").then((r) => r.json()).then(publishStats).catch(() => {});
    } finally {
      setClaiming(null);
    }
  }

  async function share() {
    if (!scan) return;
    const url = `${window.location.origin}/property/${permit.id}?scan=${scan.id}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt("Copy this link:", url); }
  }

  const showUpload = !scan || rescan;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
      <Link href="/" className="label-caps !text-asphalt hover:underline">← Back to Salvage Radar</Link>

      <section className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
        <div className="border-2 border-asphalt bg-tag shadow-[4px_4px_0_#1E1E1E] self-start">
          <div className="caution-tape-thin h-2" aria-hidden />
          <div className="p-4">
            <p className="label-caps">Demolition permit #{permit.id}</p>
            <h1 className="font-display text-3xl uppercase leading-tight mt-1">{permit.address.split(",")[0]}</h1>
            <p className="text-sm text-concrete-700">{permit.address.split(",").slice(1).join(",").trim()}</p>
            <dl className="mt-4 space-y-2 font-mono text-xs">
              <div><dt className="label-caps">Issued</dt><dd>{prettyDate(permit.dateIssued)} · {daysSince(permit.dateIssued)} days ago</dd></div>
              <div><dt className="label-caps">Permit type</dt><dd>{permit.permitType}</dd></div>
              {permit.contractor && <div><dt className="label-caps">Applicant</dt><dd>{permit.contractor}</dd></div>}
              {permit.description && <div><dt className="label-caps">Metro notes</dt><dd className="font-body text-[13px] leading-snug">{permit.description}</dd></div>}
            </dl>
            <p className="mt-3 flex items-center gap-2 text-xs"><span className="h-3 w-3 rounded-full border-2 border-asphalt" style={{ background: u.color }} />{u.label}</p>
            <p className="mt-3 text-[11px] text-concrete-500">Source: Metro Nashville Codes, Building Permits Issued (open data).</p>
          </div>
        </div>

        <div className="space-y-4">
          {showUpload ? (
            <>
              <h2 className="font-display text-2xl uppercase tracking-wide">Salvage scan</h2>
              <PhotoDropzone photos={photos} onChange={setPhotos} disabled={scanning} />
              {scanning ? (
                <div className="border-2 border-asphalt bg-asphalt text-safety p-5" role="status">
                  <div className="caution-tape caution-tape-anim h-3 -mx-5 -mt-5 mb-4" aria-hidden />
                  <p className="font-display text-2xl uppercase tracking-wide">Looking inside before the bulldozer…</p>
                  <p className="font-mono text-sm text-concrete-200 mt-1">
                    Llama 4 Maverick on OCI is appraising {photos.length} photo{photos.length === 1 ? "" : "s"} · {elapsed.toFixed(1)}s
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={runScan} disabled={photos.length === 0} className="btn-safety text-xl px-8">
                    Start salvage scan
                  </button>
                  {rescan && <button onClick={() => setRescan(false)} className="btn-ghost">Cancel</button>}
                  {photos.length > 0 && photos.length < 3 && <p className="text-sm text-concrete-700">Tip: 3+ photos give a fuller manifest.</p>}
                </div>
              )}
              {error && <p className="border-2 border-hazard bg-white p-3 text-sm font-semibold text-hazard">{error}</p>}
            </>
          ) : (
            <div className="border-2 border-asphalt bg-concrete-50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps">Salvage manifest · scan {scan!.id}</p>
                <p className="text-sm mt-1">{scan!.manifest.houseNotes || "Inventory ready."}</p>
                <p className="font-mono text-xs text-concrete-500 mt-1">{new Date(scan!.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={share} className="btn-ghost">{copied ? "Link copied" : "Share manifest"}</button>
                <button onClick={() => setRescan(true)} className="btn-ghost">New scan</button>
              </div>
            </div>
          )}
          {error && !showUpload && <p className="border-2 border-hazard bg-white p-3 text-sm font-semibold text-hazard">{error}</p>}
        </div>
      </section>

      {scan && (
        <div ref={resultsRef} className="space-y-6 scroll-mt-4">
          <TotalsBar scan={scan} />

          {scan.matches.length > 0 && (
            <section>
              <h2 className="font-display text-2xl uppercase tracking-wide mb-3">Matches · who wants it</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {scan.matches.map((m) => {
                  const n = nonprofits.find((x) => x.id === m.nonprofitId);
                  if (!n) return null;
                  return (
                    <MatchCard key={m.nonprofitId} match={m} nonprofit={n} items={scan.manifest.items}
                      claimedIds={claimedIds} busy={claiming === m.nonprofitId} onClaim={() => claim(m.nonprofitId, m.itemIds)} />
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-display text-2xl uppercase tracking-wide mb-3">Salvage manifest · {scan.manifest.items.length} items</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scan.manifest.items.map((item) => (
                <ItemCard key={item.id} item={item} claimed={claimedIds.has(item.id)}
                  photoUrl={photos[item.photoIndex]?.url} destination={destination.get(item.id)} />
              ))}
            </div>
            <p className="mt-4 text-xs text-concrete-700 max-w-3xl">
              The AI only identifies and counts what it can see. Value, weight and CO₂ come from our per-category lookup table
              (est. $/unit × qty × condition; lb/unit × qty). This is a starting inventory for a human to confirm on site.
              Safety flags are not an assessment: lead and asbestos need a licensed professional.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
