import Link from "next/link";
import { CXOS_ROOMS } from "@/lib/cxos/rooms";
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { BRAND } from "@/lib/brand";

// CXOS — the Founder Review hub. Every room, one door each, with its phase and
// status stated honestly (PLANNED rooms are listed as planned — nothing is
// faked as live). This page is the map; the rooms are the experience.
export default function ReviewHub() {
  if (!reviewBuildAllowed()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 p-8 text-slate-400">
        <p className="text-sm">Founder Review is not enabled in this build.</p>
      </main>
    );
  }
  const badge: Record<string, string> = {
    PROTOTYPE: "border-brand-500/50 text-brand-300",
    LIVE: "border-success-500/50 text-success-400",
    PRODUCT: "border-ink-600 text-slate-400",
    PLANNED: "border-ink-700 text-slate-500",
  };
  return (
    <main className="min-h-screen bg-ink-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-300">
          {BRAND.product} · Experience OS
        </p>
        <h1 className="h-display mt-2 text-3xl md:text-4xl">Founder Review</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Every room of the operating system, individually reviewable. Rooms marked
          PROTOTYPE loop on their review stage with the Director console open — scrub the
          timeline, jump to a beat, thin the particles, read the frame budget. Append{" "}
          <code className="rounded bg-ink-800 px-1">?director</code> to any live surface for
          the same console. This build exposes review instruments; production never does.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CXOS_ROOMS.map((r) => (
            <div key={r.key} id={r.key} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-100">{r.name}</h2>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest ${badge[r.status]}`}>
                  {r.status}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{r.line}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>{r.phase}{r.authed ? " · sign-in required" : ""}</span>
                {r.status === "PLANNED" ? (
                  <span className="text-slate-600">no entry yet</span>
                ) : (
                  <Link href={r.href} className="font-semibold text-brand-300 hover:text-brand-200">
                    Enter →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[11px] leading-relaxed text-slate-600">
          Review artifacts per phase: handoff PDF · storyboard (captured frames) · before/after
          gallery · performance metrics — delivered with each phase report and archived in the
          repository (CXOS_*_REPORT.md/.html).
        </p>
      </div>
    </main>
  );
}
