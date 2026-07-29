import { Lock } from "lucide-react";
import { REFUSED_V1 } from "@/lib/arena/policy";

// CXOS Phase 5 — the Arena chamber surfaces. PRESENTATION ONLY over the same
// server load the page already performs: no fetch, no prisma, no reputation
// write surface, no invented numbers (mutation-guarded). Every element here
// has a row in lib/cxos/arenaLedger.ts.

// The standing ring — progress through the CURRENT level, as architecture.
// Conic ring at the REAL percentage; reduced motion renders it statically.
export function StandingRing({
  pct,
  rank,
  level,
  totalXp,
}: {
  pct: number;
  rank: string;
  level: number;
  totalXp: number;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <div className="relative mx-auto grid h-44 w-44 place-items-center">
      <div
        aria-hidden
        className="cx-ar-standing absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#f5c76e ${clamped * 3.6}deg, rgba(148,163,184,0.14) 0deg)`,
          WebkitMask: "radial-gradient(circle, transparent 62%, black 63%)",
          mask: "radial-gradient(circle, transparent 62%, black 63%)",
        }}
      />
      <div className="text-center">
        <div className="text-3xl font-semibold text-slate-100 tnum">{totalXp}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">lifetime XP</div>
        <div className="mt-1 text-[11px] capitalize text-amber-200/90">{rank} · L{level}</div>
      </div>
    </div>
  );
}

// Milestone seals — earned badges from the reputation fold. Absent badges
// render NOTHING (no placeholder seals, ever — ledger law).
export function MilestoneSeals({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {badges.map((b) => (
        <span
          key={b}
          className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-200"
        >
          {b}
        </span>
      ))}
    </div>
  );
}

// The competition aperture — seasons/competitions are REFUSED in policy v1
// (REFUSED_V1). This surface renders that refusal as architecture: a sealed
// aperture with the truthful label. There is no live branch to fake — the
// component cannot render an open state (mutation-guarded).
export function CompetitionAperture() {
  const refused = REFUSED_V1.includes("seasons");
  return (
    <section className="card relative overflow-hidden p-5 text-center">
      <div aria-hidden className="cx-ar-aperture pointer-events-none absolute inset-0" />
      <Lock className="mx-auto h-5 w-5 text-slate-500" aria-hidden />
      <h2 className="mt-2 text-sm font-semibold text-slate-200">Competition aperture</h2>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
        Seasons and competitions are {refused ? "deliberately not part of policy v1" : "not yet defined"} —
        this aperture opens only when real competition truth exists.
      </p>
      <span className="mt-3 inline-block rounded-full border border-ink-600 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-slate-500">
        PLANNED
      </span>
    </section>
  );
}

// Kai's brief — interpretation of the operator's OWN record, computed from the
// data already on this page. No AI call, no forecast, no praise, no ownership.
export function KaiArenaBrief({
  awardCount,
  level,
  xpToNext,
}: {
  awardCount: number;
  level: number;
  xpToNext: number;
}) {
  const line =
    awardCount === 0
      ? "Your vault is empty. Only evidenced activity builds this record — logging a real bureau response to a dispute is what starts it."
      : `Your record holds ${awardCount} evidenced award${awardCount === 1 ? "" : "s"} at level ${level}. ${xpToNext} XP of verified work reaches the next level — the evidence, not the number, is the asset.`;
  return (
    <div className="mt-4 border-l-2 border-amber-400/40 pl-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-amber-200">KAI</span>
        <span className="text-[11px] text-slate-500">reading your record</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{line}</p>
    </div>
  );
}
