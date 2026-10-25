"use client";

import { useRef, useState } from "react";
import { resizeToJpeg } from "@/lib/resize";
import { DEMO_PHOTOS } from "@/lib/demo";

export type Photo = { blob: Blob; url: string; name: string };
const MAX = 8;

export default function PhotoDropzone({ photos, onChange, disabled }: {
  photos: Photo[]; onChange: (p: Photo[]) => void; disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(blobs: { blob: Blob; name: string }[], base: Photo[] = photos) {
    setError(null);
    const images = blobs.filter((b) => /^image\/(jpe?g|png|webp|heic)$/i.test(b.blob.type) || b.blob.type === "");
    if (images.length < blobs.length) setError("Only photos (jpg/png) are accepted.");
    const room = MAX - base.length;
    if (images.length > room) setError(`Max ${MAX} photos. Kept the first ${room}.`);
    setBusy(true);
    try {
      const resized = await Promise.all(images.slice(0, Math.max(0, room)).map(async ({ blob, name }) => {
        const small = await resizeToJpeg(blob);
        return { blob: small, url: URL.createObjectURL(small), name };
      }));
      onChange([...base, ...resized]);
    } catch {
      setError("Couldn't read one of those photos. Try a jpg or png.");
    } finally {
      setBusy(false);
    }
  }

  async function loadDemo() {
    const blobs = await Promise.all(DEMO_PHOTOS.map(async (src) => ({ blob: await (await fetch(src)).blob(), name: src.split("/").pop()! })));
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    await add(blobs, []);
  }

  function remove(i: number) {
    URL.revokeObjectURL(photos[i].url);
    onChange(photos.filter((_, j) => j !== i));
  }

  return (
    <div>
      <div
        role="button" tabIndex={0} aria-disabled={disabled}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setOver(false);
          if (!disabled) add(Array.from(e.dataTransfer.files).map((f) => ({ blob: f, name: f.name })));
        }}
        className={`border-4 border-dashed border-asphalt p-6 sm:p-8 text-center cursor-pointer transition focus:outline-none focus-visible:ring-4 focus-visible:ring-safety
          ${over ? "bg-safety/40" : "bg-concrete-50 hover:bg-safety/20"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <p className="font-display text-xl sm:text-2xl uppercase tracking-wide">Drop room photos here</p>
        <p className="text-sm text-concrete-700 mt-1">Kitchen, bathroom, doors, floors, windows, exterior · 3–8 photos · or tap to choose</p>
        {busy && <p className="label-caps mt-2">Shrinking photos…</p>}
        <input
          ref={input} type="file" accept="image/jpeg,image/png" multiple hidden
          onChange={(e) => { add(Array.from(e.target.files ?? []).map((f) => ({ blob: f, name: f.name }))); e.target.value = ""; }}
        />
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-hazard">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-concrete-500">{photos.length}/{MAX} photos · resized to ≤1024px in your browser</p>
        {DEMO_PHOTOS.length > 0 && !disabled && (
          <button type="button" onClick={loadDemo} className="label-caps underline decoration-2 underline-offset-4 hover:text-asphalt">
            Use demo house photos
          </button>
        )}
      </div>
      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 sm:grid-cols-8 gap-2">
          {photos.map((p, i) => (
            <li key={p.url} className="relative aspect-square border-2 border-asphalt bg-concrete-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Photo ${i + 1}: ${p.name}`} className="h-full w-full object-cover" />
              <span className="absolute bottom-0 left-0 bg-asphalt text-safety font-mono text-[10px] px-1">#{i + 1}</span>
              {!disabled && (
                <button type="button" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`}
                  className="absolute -top-2 -right-2 h-6 w-6 bg-asphalt text-safety font-bold leading-none border-2 border-safety">×</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
