import Link from "next/link";
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";

// CXOS Phase 3 — the Landing Journey review stage.
//
// The journey lives on the real landing page; this stage is the Founder's
// operating map for reviewing it: chapter doors, every projection (tier,
// reduced-motion, viewport), the transition replay, and the failure
// simulations. Inherits the review layout's noindex; renders "not enabled"
// outside review builds exactly like every other review surface.
const CHAPTERS = [
  { id: "problem", name: "CH 1 · The Problem Chamber", line: "Three bureaus, three versions — fragments drift apart; nothing resolves. Uncertainty, made visible." },
  { id: "awakens", name: "CH 2 · Intelligence Awakens", line: "The same tellings align into one classified evidence column; the spine draws; deadlines dock." },
];

const PROJECTIONS: [string, string][] = [
  ["Tier A (desktop)", "full choreography + depth planes — the default on this preview"],
  ["Tier B (mobile)", "same choreography, single plane. Open on a phone, or force with the JOURNEY strip's tier button"],
  ["Tier C (low-power / data-saver)", "no scroll-driven transforms; settles only. Force via the tier button"],
  ["Tier D (reduced motion / toggle off)", "no motion at all; chapters at rest state; navigation instant. Force via the tier button, or enable reduced motion in the OS"],
  ["Failure / no-JS", "disable JavaScript: the full page renders at rest state — every law holds by construction"],
  ["Transition timeout", "append ?cxsim=timeout before clicking a pricing link: the veil holds and the 1800 ms fail-open clock forces arrival"],
];

export default function LandingJourneyReview() {
  if (!reviewBuildAllowed()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 p-8 text-slate-400">
        <p className="text-sm">Founder Review is not enabled in this build.</p>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-ink-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-300">
          Founder Review · Phase 3
        </p>
        <h1 className="h-display mt-2 text-3xl md:text-4xl">The Landing Journey</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          The journey runs on the real landing page — native scroll, no hijacking, chapters
          driven by scroll progress. Open it with the Director instruments and the JOURNEY
          strip reports the live chapter, its progress, and the active capability tier.
        </p>

        <div className="mt-8 space-y-3">
          <Link href="/?director" className="card block p-4 hover:border-brand-500/40">
            <div className="text-sm font-semibold text-brand-300">▶ Walk the full journey (Director) →</div>
            <p className="mt-1 text-xs text-slate-400">
              Threshold → Hero → chapters → pricing transition, with the JOURNEY strip live.
              The Threshold replays under review; Escape skips it.
            </p>
          </Link>
          {CHAPTERS.map((c) => (
            <Link key={c.id} href={`/?director#${c.id}`} className="card block p-4 hover:border-brand-500/40">
              <div className="text-sm font-semibold text-slate-100">{c.name} →</div>
              <p className="mt-1 text-xs text-slate-400">{c.line}</p>
            </Link>
          ))}
          <Link href="/?director#pricing" className="card block p-4 hover:border-brand-500/40">
            <div className="text-sm font-semibold text-slate-100">Route transition · &ldquo;The commercial surface&rdquo; →</div>
            <p className="mt-1 text-xs text-slate-400">
              From the pricing section, follow any /pricing link: cover-in ≤ 420 ms (navigation
              fires at its end), rails meet, open-out onto the calm commercial surface. Escape
              skips; repeats in a session run short; billing/checkout routes are never staged.
            </p>
          </Link>
        </div>

        <h2 className="mt-10 text-sm font-bold uppercase tracking-widest text-slate-300">Projections</h2>
        <div className="mt-3 space-y-2">
          {PROJECTIONS.map(([name, how]) => (
            <div key={name} className="rounded-lg border border-ink-700/60 bg-ink-900/50 px-4 py-3">
              <span className="text-xs font-semibold text-slate-200">{name}</span>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{how}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[11px] leading-relaxed text-slate-600">
          Review instruments exist only in review builds; production is hard-off. Director runs
          never consume the public session markers (Threshold memory, returning-visitor
          transition shortening). <Link href="/review" className="text-brand-300">← All rooms</Link>
        </p>
      </div>
    </main>
  );
}
