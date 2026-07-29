import Link from "next/link";
import { Trophy, ArrowUpRight } from "lucide-react";

// CXOS Phase 5 — the call. Rendered by the dashboard ONLY when
// arenaAccessible(user) passed on the server: accounts outside the cohort see
// nothing — no teaser, no sealed-door upsell, no implied purchase path (ledger row
// "Arena door"). A plain, real link; the ceremony happens on arrival.
export function ArenaDoor({ totalXp, level }: { totalXp: number; level: number }) {
  return (
    <Link href="/arena" className="mb-4 block">
      <div className="card relative flex items-center gap-3 overflow-hidden p-4 transition-colors hover:bg-ink-800/40">
        <div aria-hidden className="cx-ar-doorlight pointer-events-none absolute inset-0" />
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
          <Trophy className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80">The Arena · internal cohort</div>
          <div className="text-sm font-semibold text-slate-100">
            Your record stands at level {level} · {totalXp} lifetime XP
          </div>
          <div className="text-[12px] text-slate-400">Enter the floor — evidence becomes standing.</div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      </div>
    </Link>
  );
}
