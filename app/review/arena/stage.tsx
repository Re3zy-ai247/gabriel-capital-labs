"use client";

import { useState } from "react";
import Link from "next/link";
import { ArenaEntry, type ArenaEntryProps } from "@/components/cxos/arena/ArenaEntry";
import {
  StandingRing,
  MilestoneSeals,
  CompetitionAperture,
  KaiArenaBrief,
} from "@/components/cxos/arena/ArenaChamber";

// SYNTHETIC fixtures — clearly-marked review data corresponding to no real
// account. XP numbers are arbitrary review values; award labels reuse the
// real evidence-class vocabulary so the Founder reviews true shapes.
const POPULATED: Omit<ArenaEntryProps, "forceVariant" | "forceReview"> = {
  identity: "cxreview-consumer",
  rank: "operator",
  level: 3,
  totalXp: 640,
  awardCount: 5,
  badges: ["First evidenced outcome", "Round 2 completed"],
  topAwards: [
    { label: "Bureau response logged — deletion", xp: 220, cls: "documented" },
    { label: "Bureau response logged — correction", xp: 180, cls: "documented" },
    { label: "Reinvestigation completed", xp: 120, cls: "documented" },
  ],
  policyVersion: 1,
};

const EMPTY: Omit<ArenaEntryProps, "forceVariant" | "forceReview"> = {
  identity: "cxreview-consumer",
  rank: "novice",
  level: 0,
  totalXp: 0,
  awardCount: 0,
  badges: [],
  topAwards: [],
  policyVersion: 1,
};

type StateKey = "populated" | "empty" | "locked" | "permission" | "error";
const STATES: { key: StateKey; label: string }[] = [
  { key: "populated", label: "Populated" },
  { key: "empty", label: "Empty vault" },
  { key: "locked", label: "Flag off / dormant" },
  { key: "permission", label: "Outside cohort" },
  { key: "error", label: "Data error" },
];

export function ArenaStage() {
  const [state, setState] = useState<StateKey>("populated");
  const [entryKey, setEntryKey] = useState(0);
  const [entryVariant, setEntryVariant] = useState<"first" | "returning" | null>(null);
  const fx = state === "empty" ? EMPTY : POPULATED;

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-10 text-white">
      {entryVariant !== null && (
        <ArenaEntry key={entryKey} {...fx} forceVariant={entryVariant} forceReview />
      )}

      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-200">Founder Review · Phase 5</p>
        <h1 className="h-display mt-2 text-3xl md:text-4xl">The Arena</h1>
        <p className="mt-2 inline-block rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[11px] font-bold tracking-widest text-gold-400">
          SYNTHETIC REVIEW DATA — no real account, no database, no reputation read
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          The entry and chamber over synthetic fixtures. The live surface (<code className="rounded bg-ink-800 px-1">/arena</code>)
          stays exactly as dormant as before: flag + internal-cohort gated, own-data only,
          server-side redirect for everyone else. Reduced-motion projection: the entry mounts
          nothing — the chamber is simply there. Agency projection: policy v1 is own-record
          only (cross-user surfaces are in REFUSED_V1), so there is no agency Arena to show —
          stated here rather than faked.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-[12px]">
          <span className="text-slate-500">entry:</span>
          <button type="button" className="rounded border border-ink-600 px-2 py-1 hover:border-amber-400/60"
            onClick={() => { setEntryVariant("first"); setEntryKey((k) => k + 1); }}>
            ▶ first entry (~8.6s)
          </button>
          <button type="button" className="rounded border border-ink-600 px-2 py-1 hover:border-amber-400/60"
            onClick={() => { setEntryVariant("returning"); setEntryKey((k) => k + 1); }}>
            ▶ returning (~1.1s)
          </button>
          <span className="ml-4 text-slate-500">state:</span>
          {STATES.map((s) => (
            <button key={s.key} type="button" aria-pressed={state === s.key}
              className={`rounded border px-2 py-1 ${state === s.key ? "border-amber-400/70 text-amber-200" : "border-ink-600 hover:border-amber-400/60"}`}
              onClick={() => setState(s.key)}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-ink-700/60 bg-ink-900/30 p-5">
          {(state === "populated" || state === "empty") && (
            <>
              <StandingRing
                pct={state === "empty" ? 0 : 64}
                rank={fx.rank}
                level={fx.level}
                totalXp={fx.totalXp}
              />
              <MilestoneSeals badges={fx.badges} />
              <KaiArenaBrief awardCount={fx.awardCount} level={fx.level} xpToNext={state === "empty" ? 100 : 160} />
              <div className="mt-5">
                <CompetitionAperture />
              </div>
            </>
          )}
          {state === "locked" && (
            <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-5 text-sm text-slate-300">
              Real behavior: <code className="rounded bg-ink-800 px-1">ARENA_ENABLED</code> is fail-closed
              opt-in (only the exact string &ldquo;true&rdquo; enables it). Flag off ⇒ every account —
              including admins — is redirected to /dashboard by the server before any Arena
              markup exists. The entry can never mount for a locked account.
            </div>
          )}
          {state === "permission" && (
            <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-5 text-sm text-slate-300">
              Real behavior: flag ON but the account is outside the internal cohort ⇒ the same
              server redirect. No teaser, no locked-door upsell, no implied purchase path —
              accounts outside the cohort see nothing at all (including the Mission Control door).
            </div>
          )}
          {state === "error" && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-300">
              Real behavior: <code className="rounded bg-ink-900 px-1">readOwnProgress</code> fails closed
              to the EMPTY standing on any error — the chamber renders the truthful empty vault,
              never a stale or invented number.
            </div>
          )}
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-slate-600">
          Review instruments exist only in review builds; production is hard-off. Review runs
          never consume the visitor&apos;s first-entry marker.{" "}
          <Link href="/review" className="text-brand-300">← All rooms</Link>
        </p>
      </div>
    </main>
  );
}
