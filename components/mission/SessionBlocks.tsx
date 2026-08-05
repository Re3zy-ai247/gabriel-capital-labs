// Session-aware Mission Control blocks (Phase 1A, Agent B — Mission Control).
// Presentational only: every field renders exactly what lib/operatorSession.ts
// already assembled; nothing here computes, ranks, or invents (zero-fabrication
// law, PHASE-1A-BRIEF.md constraint 6). Shared across all three altitudes —
// consumer, agency-owner, workspace — so the SAME components render the
// greeting, the accomplishment lists, the resumable work, and the priority
// list. `PriorityList` in particular is deliberately ONE component: at
// consumer/workspace altitude it frames the kaiHome recommendation + nearest
// deadline; at agency-owner altitude it frames the roster ladder. Never two
// competing ladders — the Room Constitution's Executive-Queue idiom, reused,
// not forked.
import Link from "next/link";
import { ArrowUpRight, CalendarClock, CheckCircle2, ListChecks, Moon, Sparkles, Sun } from "lucide-react";
import type {
  OperatorIdentity,
  CappedList,
  AccomplishmentEntry,
  InterruptedItem,
  PriorityEntry,
  SessionCloseSummary,
} from "@/lib/operatorSession";
import gxl from "./mc.module.css";

// ---- greeting -----------------------------------------------------------------

export function SessionHeader({ identity }: { identity: OperatorIdentity }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2.5">
        <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
        <h2 className={`${gxl.record} text-2xl text-slate-100`}>
          {/* Phase 1A F7: the neutral, timezone-independent form — CreditVector
              has no per-user timezone, so a UTC-bucketed "Good morning/
              afternoon/evening" read wrong for ~8h/day for US users. */}
          Welcome back, {identity.greetingName}
          {/* Everyday on-behalf-of register (SIM-REVIEW minimum-set item 3) — the
              consumer/agency-owner variant stays plain; only a workspace altitude
              names whose case this is, in the same sentence, not a second line. */}
          {identity.onBehalfOf ? <> — you&apos;re in {identity.onBehalfOf.clientName}&apos;s workspace</> : null}.
        </h2>
      </div>
    </div>
  );
}

// ---- yesterday / today accomplishments -----------------------------------------

function AccomplishmentGroup({
  heading, icon, list, emptyText,
}: { heading: string; icon: React.ReactNode; list: CappedList<AccomplishmentEntry>; emptyText: string }) {
  return (
    <div>
      <h3 className={`${gxl.engravedDim} mb-1.5 flex items-center gap-1.5`}>{icon}{heading}</h3>
      {list.items.length === 0 ? (
        <p className="text-[13px] text-slate-500">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {list.items.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-slate-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" aria-hidden />
              <span>{a.label}</span>
            </li>
          ))}
          {list.moreCount > 0 && <li className="pl-5 text-[11px] text-slate-500">+{list.moreCount} more</li>}
        </ul>
      )}
    </div>
  );
}

export function AccomplishmentPanel({
  yesterday, today,
}: { yesterday: CappedList<AccomplishmentEntry>; today: CappedList<AccomplishmentEntry> }) {
  return (
    <div className="card mb-4 grid gap-4 p-4 sm:grid-cols-2">
      <AccomplishmentGroup
        heading="Yesterday you completed" icon={<Moon className="h-3 w-3" aria-hidden />}
        list={yesterday} emptyText="Quiet — nothing logged yesterday."
      />
      <AccomplishmentGroup
        heading="Today so far" icon={<Sun className="h-3 w-3" aria-hidden />}
        list={today} emptyText="Quiet — nothing logged yet today."
      />
    </div>
  );
}

// ---- continue where you left off ------------------------------------------------

export function ContinueWhereYouLeftOff({ items }: { items: InterruptedItem[] }) {
  if (items.length === 0) return null; // quiet is allowed — no fabricated "nothing to resume" filler
  return (
    <div className="card mb-4 p-4">
      <h3 className={`${gxl.engravedDim} mb-2 flex items-center gap-1.5`}>
        <CalendarClock className="h-3 w-3" aria-hidden />Continue where you left off
      </h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i}>
            <Link href={it.resumeHref} className="group flex items-center gap-2 text-[13px] text-slate-300 hover:text-slate-100">
              <span className="min-w-0 flex-1">{it.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-brand-300" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- today's priorities (the Executive-Queue idiom, shared by every altitude) ----

export function PriorityList({ heading, priorities }: { heading: string; priorities: PriorityEntry[] }) {
  if (priorities.length === 0) {
    return (
      <div className="card mb-4 p-4">
        <h3 className={`${gxl.engravedDim} mb-1 flex items-center gap-1.5`}><ListChecks className="h-3 w-3" aria-hidden />{heading}</h3>
        <p className="text-[13px] text-slate-500">Nothing needs your attention right now.</p>
      </div>
    );
  }
  return (
    <section aria-label={heading} className="mb-4">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-brand-300" aria-hidden />
        <h3 className={gxl.engraved}>{heading}</h3>
      </div>
      <ol className={gxl.folio}>
        {priorities.map((p, i) => (
          <li key={i} className={`${gxl.entry} ${gxl.lifted} ${gxl.flagged}`}>
            <Link href={p.href} className={`flex items-center gap-3 px-4 py-3 ${gxl.detent}`}>
              <div className="min-w-0 flex-1">
                <div className={`${gxl.record} text-[15px] text-slate-100`}>{p.label}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">{p.basis}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---- session close ---------------------------------------------------------------

export function SessionCloseBlock({ close }: { close: SessionCloseSummary }) {
  const quiet = close.doneToday.count === 0 && close.remaining.count === 0;
  return (
    <div className="card mb-2 mt-2 p-3">
      <p className={gxl.colophon}>
        {quiet
          // "Quiet is allowed" is this codebase's own established idiom for a
          // no-action state (lib/kaiHome.ts, app/journey/page.tsx) — reused
          // here rather than a fresh phrase, in Kai's register: pleased and
          // bounded, never celebratory (no work existing isn't a win to
          // announce, KAI-STATE emotional-range law).
          ? "Quiet is allowed — nothing needed you today."
          : `Done today: ${close.doneToday.count} · Still open: ${close.remaining.count}`}
      </p>
    </div>
  );
}
