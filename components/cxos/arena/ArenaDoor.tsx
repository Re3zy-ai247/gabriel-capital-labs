import Link from "next/link";

// CXOS Phase 5.1 — the call, restaged as an embedded threshold rather than
// an ordinary CTA card. Rendered by the dashboard ONLY when
// arenaAccessible(user) passed on the server: accounts outside the cohort
// see nothing — no teaser, no sealed-door upsell, no implied purchase path
// (ledger row "Arena door"). Still a plain, real link; the ceremony
// happens on arrival. The gold seam is architecture, not a badge.
export function ArenaDoor({ totalXp, level }: { totalXp: number; level: number }) {
  return (
    <Link href="/arena" className="group mb-4 block" aria-label="The Arena — proceed to the floor">
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-[#0a0705] px-5 py-4 transition-colors group-hover:border-amber-400/50">
        <div aria-hidden className="cx-ar-doorlight pointer-events-none absolute inset-0" />
        {/* the seam — light rising from the floor line of the recess */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(245,199,110,0.7), transparent)" }}
        />
        <div className="relative flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-bold tracking-[0.35em] text-amber-100/90">THE ARENA</div>
            <div className="mt-1 font-mono text-[12px] text-slate-400 tnum">
              clearance held · level {level} · {totalXp} lifetime XP
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-semibold tracking-[0.15em] text-amber-200/90 transition-colors group-hover:text-amber-200">
            PROCEED TO THE FLOOR →
          </span>
        </div>
      </div>
    </Link>
  );
}
