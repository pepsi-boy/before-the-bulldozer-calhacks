import Link from "next/link";
import ImpactCounter from "./ImpactCounter";

export default function Header() {
  return (
    <header className="bg-asphalt text-concrete-50">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-3">
        <Link href="/" className="group flex items-center gap-3">
          <span aria-hidden className="grid h-10 w-10 place-items-center bg-safety border-2 border-safety">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#1E1E1E"><path d="M3 15a9 9 0 0 1 18 0v1H3v-1Zm8-8.9V4h2v2.1a8 8 0 0 1 2 .6V5h2v2.9A9 9 0 0 1 20.9 14H3.1A9 9 0 0 1 7 7.9V5h2v1.7a8 8 0 0 1 2-.6ZM2 17h20v2H2v-2Z"/></svg>
          </span>
          <span className="leading-none">
            <span className="block font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-safety group-hover:text-concrete-50">Before the Bulldozer</span>
            <span className="block label-caps !text-concrete-300 mt-1">Nashville salvage radar</span>
          </span>
        </Link>
        <ImpactCounter />
      </div>
      <div className="caution-tape h-3" aria-hidden />
    </header>
  );
}
