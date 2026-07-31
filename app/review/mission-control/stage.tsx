"use client";

import { useState } from "react";
import Link from "next/link";
import { MissionEntry, type MissionEntryProps } from "@/components/cxos/mission/MissionEntry";
import { CommandHeader } from "@/components/cxos/mission/CommandHeader";

// SYNTHETIC fixtures — clearly-marked review data. Names, counts and Kai lines
// are invented for review purposes only, hold the compliance bar (process,
// never outcome), and correspond to no real person or account.
const CONSUMER: Omit<MissionEntryProps, "forceVariant" | "forceReview"> = {
  firstName: "Jordan",
  identity: "cxreview-consumer",
  role: "OPERATOR",
  plan: "premium",
  health: [
    { label: "Response windows", status: "green" },
    { label: "Mail pipeline", status: "green" },
    { label: "Timeline health", status: "amber" },
  ],
  tasksCount: 3,
  waitingCount: 2,
  hasReport: true,
  nextAction: "Review the drafted Round 2 letter for the auto-loan tradeline — the reinvestigation window closes in 9 days.",
};

const AGENCY: Omit<MissionEntryProps, "forceVariant" | "forceReview"> = {
  firstName: "Avery",
  identity: "cxreview-agency",
  role: "AGENCY",
  plan: "agency",
  health: [
    { label: "Roster follow-ups", status: "amber" },
    { label: "Response windows", status: "green" },
    { label: "Capacity", status: "green" },
  ],
  tasksCount: 12,
  waitingCount: 7,
  hasReport: true,
  nextAction: "Three client files have bureau responses waiting to be read — start with the two whose windows close this week.",
};

const AGENCY_CAPACITY = { recommendedSize: 12, policyMax: 15, stagedCount: 9, reasons: [], family: "agency" };

type StateKey = "populated" | "empty" | "loading" | "error" | "disabled" | "billing" | "permission";

const STATES: { key: StateKey; label: string }[] = [
  { key: "populated", label: "Populated" },
  { key: "empty", label: "Empty (no report)" },
  { key: "loading", label: "Loading" },
  { key: "error", label: "Error" },
  { key: "disabled", label: "Disabled account" },
  { key: "billing", label: "Billing-restricted" },
  { key: "permission", label: "Permission denied" },
];

export function MissionControlStage() {
  const [projection, setProjection] = useState<"consumer" | "agency">("consumer");
  const [state, setState] = useState<StateKey>("populated");
  const [entryKey, setEntryKey] = useState(0);
  const [entryVariant, setEntryVariant] = useState<"first" | "returning" | null>(null);

  const fx = projection === "consumer" ? CONSUMER : AGENCY;

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-10 text-white">
      {entryVariant !== null && (
        <MissionEntry key={entryKey} {...fx} forceVariant={entryVariant} forceReview />
      )}

      <div className="mx-auto max-w-4xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-300">Founder Review · Phase 4</p>
        <h1 className="h-display mt-2 text-3xl md:text-4xl">Mission Control</h1>
        <p className="mt-2 inline-block rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[11px] font-bold tracking-widest text-gold-400">
          SYNTHETIC REVIEW DATA — no real account, no database, no customer record
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          The authenticated entry and the room shell, reviewable in every projection. On the live
          page every line is real resolved state; here the same components run on the synthetic
          fixtures above. The live room is <code className="rounded bg-ink-800 px-1">/dashboard</code>{" "}
          once preview sign-in is enabled (see the Phase 4 report&apos;s access plan).
        </p>

        {/* controls */}
        <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-[12px]">
          <span className="text-slate-500">entry:</span>
          <button type="button" className="rounded border border-ink-600 px-2 py-1 hover:border-brand-500/60"
            onClick={() => { setEntryVariant("first"); setEntryKey((k) => k + 1); }}>
            ▶ first entry (~7s)
          </button>
          <button type="button" className="rounded border border-ink-600 px-2 py-1 hover:border-brand-500/60"
            onClick={() => { setEntryVariant("returning"); setEntryKey((k) => k + 1); }}>
            ▶ returning (~1s)
          </button>
          <span className="ml-4 text-slate-500">projection:</span>
          {(["consumer", "agency"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={projection === p}
              className={`rounded border px-2 py-1 ${projection === p ? "border-brand-500/70 text-brand-300" : "border-ink-600 hover:border-brand-500/60"}`}
              onClick={() => setProjection(p)}>
              {p}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[12px]">
          <span className="text-slate-500">state:</span>
          {STATES.map((s) => (
            <button key={s.key} type="button" aria-pressed={state === s.key}
              className={`rounded border px-2 py-1 ${state === s.key ? "border-brand-500/70 text-brand-300" : "border-ink-600 hover:border-brand-500/60"}`}
              onClick={() => setState(s.key)}>
              {s.label}
            </button>
          ))}
        </div>

        {/* the room shell under review */}
        <div className="mt-8 rounded-2xl border border-ink-700/60 bg-ink-900/30 p-4">
          {state === "populated" && (
            <>
              <CommandHeader
                firstName={fx.firstName} identity={fx.identity} role={fx.role} plan={fx.plan}
                health={fx.health} capacity={projection === "agency" ? AGENCY_CAPACITY : null}
                isAgency={projection === "agency"}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <ZoneCard label="Today" value={`${fx.tasksCount} items need you`} sub={projection === "agency" ? "across 4 client files" : "on your case"} />
                <ZoneCard label="Waiting" value={`${fx.waitingCount} responses due`} sub="response windows tracked" />
                <ZoneCard label="Kai — executive brief" value={fx.nextAction ?? ""} sub="evidence-bound · with its receipt" wide />
              </div>
            </>
          )}
          {state === "empty" && (
            <>
              <CommandHeader firstName={fx.firstName} identity={fx.identity} role={fx.role} plan="free"
                health={[{ label: "Timeline health", status: "green" }]} capacity={null} isAgency={false} />
              <ZoneCard label="First mission" value="No report on file yet — your first mission is staged" sub="upload a report to begin" wide />
            </>
          )}
          {state === "loading" && (
            <div aria-hidden className="space-y-3">
              <div className="h-14 animate-pulse rounded-2xl bg-ink-800/60" />
              <div className="h-24 animate-pulse rounded-2xl bg-ink-800/40" />
              <p className="text-[11px] text-slate-500">The live room is server-rendered — loading is the navigation itself; this skeleton is the in-room refresh state.</p>
            </div>
          )}
          {state === "error" && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              Something went wrong loading this view. Your data is safe — reload to try again.
              <p className="mt-2 text-[11px] text-rose-400/80">Real behavior: the route&apos;s error boundary renders immediately; no animation ever covers it.</p>
            </div>
          )}
          {state === "disabled" && (
            <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4 text-sm text-slate-300">
              Please sign in.
              <p className="mt-2 text-[11px] text-slate-500">Real behavior: a disabled account is refused at sign-in AND evicted from live sessions (lib/auth.ts + lib/session.ts, both guard-pinned). The only surface that may differ is the cancellation-only billing path.</p>
            </div>
          )}
          {state === "billing" && (
            <div className="rounded-xl border border-gold-400/30 bg-gold-400/10 p-4 text-sm text-slate-200">
              You&apos;ve used your 3 free letters this month.
              <Link href="/pricing" className="ml-2 font-semibold text-brand-300">See plans</Link>
              <p className="mt-2 text-[11px] text-slate-500">Real behavior: the letter gate names the reason; billing links stay immediate (no cinematic staging on /billing — CRITICAL_NEVER).</p>
            </div>
          )}
          {state === "permission" && (
            <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4 text-sm text-slate-300">
              Not found.
              <p className="mt-2 text-[11px] text-slate-500">Real behavior: an agency can only open clients it manages (tenant-scoped 404); admin surfaces refuse non-admins; the workspace cookie cannot cross organizations (lib/session.ts, guard-pinned).</p>
            </div>
          )}
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-slate-600">
          Reduced-motion projection: the entry mounts nothing — the room is simply there (tier D is
          absolute). Mobile: open this stage on a phone; the entry and header are fluid.
          <Link href="/review" className="ml-2 text-brand-300">← All rooms</Link>
        </p>
      </div>
    </main>
  );
}

function ZoneCard({ label, value, sub, wide }: { label: string; value: string; sub: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-ink-700/60 bg-ink-800/40 p-4 ${wide ? "sm:col-span-3" : ""}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-100">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
