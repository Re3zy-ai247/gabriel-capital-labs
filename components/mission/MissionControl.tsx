// Mission Control — the Mission Card (Sprint XIII). Answers "what should I do
// today / what am I waiting on / what happens next", entirely from the
// deterministic MissionControlData the orchestrator composed. Presentational only.
import Link from "next/link";
import type { MissionControlData } from "@/lib/missionControl";
import { CheckCircle2, Circle, Clock, ArrowRight, Sparkles, Mail, Upload, Layers, ArrowUpRight } from "lucide-react";

const KIND_ICON: Record<string, React.ReactNode> = {
  review: <Layers className="h-4 w-4 text-brand-300" aria-hidden />,
  mail: <Mail className="h-4 w-4 text-brand-300" aria-hidden />,
  upload: <Upload className="h-4 w-4 text-brand-300" aria-hidden />,
  escalate: <ArrowUpRight className="h-4 w-4 text-gold-400" aria-hidden />,
  start: <Sparkles className="h-4 w-4 text-brand-300" aria-hidden />,
};

export function MissionControl({ data }: { data: MissionControlData }) {
  const { firstName, caseMemory, overnight, tasks, waiting, automatic, nextAction, nextUnlock } = data;
  const onTrack = tasks.length === 0;

  return (
    <section aria-label="Mission Control">
      {/* Greeting + returning-user catch-up (reused Case Memory / overnight). */}
      <div className="mb-4 animate-rise">
        <div className="flex items-center gap-2">
          <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
          <h2 className="text-2xl font-bold">Welcome{caseMemory || overnight.length > 0 ? " back" : ""}, {firstName}.</h2>
        </div>
        {caseMemory ? (
          <>
            <p className="mt-1 text-sm text-slate-400">While you were away — since {new Date(caseMemory.since).toLocaleDateString("en-US", { month: "long", day: "numeric" })}:</p>
            <ul className="mt-2 space-y-1">
              {caseMemory.items.map((o, i) => (
                <li key={i} className="text-sm text-slate-300">
                  <span className="mr-2 inline-block h-1 w-1 rounded-full bg-brand-400 align-middle" aria-hidden />
                  <Link href={o.href} className="underline decoration-ink-600 underline-offset-2 transition-colors hover:text-slate-100 hover:decoration-brand-400">{o.text}</Link>
                </li>
              ))}
            </ul>
          </>
        ) : overnight.length > 0 ? (
          <>
            <p className="mt-1 text-sm text-slate-400">Here&apos;s what I logged in the last two days:</p>
            <ul className="mt-2 space-y-1">
              {overnight.map((o, i) => (
                <li key={i} className="text-sm text-slate-300">
                  <span className="mr-2 inline-block h-1 w-1 rounded-full bg-brand-400 align-middle" aria-hidden />
                  <Link href={o.href} className="underline decoration-ink-600 underline-offset-2 transition-colors hover:text-slate-100 hover:decoration-brand-400">{o.text}</Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {/* TODAY'S MISSION */}
      <div className="card animate-rise-stagger mb-4 p-5" style={{ animationDelay: "80ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-300">Today&apos;s mission</h3>
          {onTrack && <span className="pill bg-success-500/15 text-success-300">On track</span>}
        </div>

        {onTrack ? (
          <div>
            <p className="text-sm font-medium text-slate-200">Everything&apos;s on track. No action needed today.</p>
            <p className="mt-1 text-sm text-slate-400">You&apos;ll see it here as soon as something changes — a response arrives, a window opens, or the next campaign unlocks.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t, i) => (
              <li key={i}>
                <Link href={t.href} className="group flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-900/40 p-3 transition-colors hover:border-brand-500/50">
                  <Circle className="h-4 w-4 shrink-0 text-slate-600 group-hover:hidden" aria-hidden />
                  <CheckCircle2 className="hidden h-4 w-4 shrink-0 text-brand-400 group-hover:block" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm text-slate-200">{t.text}</span>
                  <span className="shrink-0">{KIND_ICON[t.kind]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* What am I waiting on */}
        {waiting.length > 0 && (
          <div className="mt-4 border-t border-ink-700/70 pt-3">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Waiting on</h3>
            <ul className="space-y-1.5">
              {waiting.map((w, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-ocean-300" aria-hidden />
                  <span className="min-w-0 flex-1">{w.text}</span>
                  <Link href={w.href} className="shrink-0 text-xs font-semibold text-slate-400 hover:text-slate-300 hover:underline">view</Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-400">No action recommended while a window is running — Kai is watching the clock.</p>
          </div>
        )}

        {nextUnlock && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Layers className="h-3 w-3 shrink-0" aria-hidden /> {nextUnlock}
          </p>
        )}
      </div>

      {/* KAI'S NEXT ACTION — the single deterministic next step, with its receipt. */}
      {nextAction && !onTrack && (
        <div className="card mb-4 border-brand-500/40 bg-brand-500/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-300">Kai&apos;s next action</h3>
          <div className="mt-1.5 text-base font-semibold">{nextAction.title}</div>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{nextAction.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href={nextAction.href} className="btn-primary">{nextAction.cta} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <span className="text-xs text-slate-400">{nextAction.basis}</span>
          </div>
        </div>
      )}

      {/* What's happening automatically */}
      {automatic.length > 0 && (
        <div className="card mb-4 border-ink-700 p-4">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Happening automatically</h3>
          <ul className="space-y-1.5">
            {automatic.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-slate-400">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" aria-hidden />{a.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
