// Mission Control — the Mission Card (Sprint XIII). Answers "what should I do
// today / what am I waiting on / what happens next", entirely from the
// deterministic MissionControlData the orchestrator composed. Presentational only.
import Link from "next/link";
import type { MissionControlData } from "@/lib/missionControl";
import { CheckCircle2, Circle, Clock, ArrowRight, Sparkles, Mail, Upload, Layers, ArrowUpRight } from "lucide-react";
import gxl from "./mc.module.css";

const KIND_ICON: Record<string, React.ReactNode> = {
  review: <Layers className="h-4 w-4 text-brand-300" aria-hidden />,
  mail: <Mail className="h-4 w-4 text-brand-300" aria-hidden />,
  upload: <Upload className="h-4 w-4 text-brand-300" aria-hidden />,
  escalate: <ArrowUpRight className="h-4 w-4 text-gold-400" aria-hidden />,
  start: <Sparkles className="h-4 w-4 text-brand-300" aria-hidden />,
};

export function MissionControl({ data }: { data: MissionControlData }) {
  const { tasks, waiting, automatic, nextAction, nextUnlock } = data;
  const onTrack = tasks.length === 0;

  return (
    <section aria-label="Mission Control">
      {/* The greeting + returning-user catch-up moved to the session-aware blocks
          (components/mission/SessionBlocks.tsx, Phase 1A Agent B) — SessionHeader
          + AccomplishmentPanel now own that copy, composed from
          lib/operatorSession.ts rather than caseMemory/overnight, so the room
          never shows the greeting twice. GXL: no entrance animation — the room
          renders, it does not perform. */}

      {/* TODAY'S MISSION — the slab, under the room's one key pool. */}
      <div className={`card ${gxl.slab} mb-4 border-ink-600 p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className={gxl.engraved}>Today&apos;s mission</h3>
          {/* On-track is a state of watch, not a verification — green stays
              reserved (GXL §16); the watch speaks in the engraved register. */}
          {onTrack && <span className={gxl.engravedDim}>Watch kept — on track</span>}
        </div>

        {onTrack ? (
          <div>
            <p className={`${gxl.record} text-[15px] text-slate-200`}>Everything&apos;s on track. No action needed today.</p>
            <p className="mt-1 text-sm text-slate-400">You&apos;ll see it here as soon as something changes — a response arrives, a window opens, or the next campaign unlocks.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t, i) => (
              <li key={i}>
                <Link href={t.href} className={`group flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-900/40 p-3 transition-colors hover:border-brand-500/50 ${gxl.detent}`}>
                  <Circle className="h-4 w-4 shrink-0 text-slate-600 group-hover:hidden" aria-hidden />
                  <CheckCircle2 className="hidden h-4 w-4 shrink-0 text-brand-400 group-hover:block" aria-hidden />
                  <span className={`${gxl.record} min-w-0 flex-1 text-[15px] leading-snug text-slate-100`}>{t.text}</span>
                  <span className="shrink-0">{KIND_ICON[t.kind]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* What am I waiting on */}
        {waiting.length > 0 && (
          <div className="mt-4 border-t border-ink-700/70 pt-3">
            <h3 className={`${gxl.engravedDim} mb-2`}>Waiting on</h3>
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

      {/* KAI'S NEXT ACTION — the single deterministic next step, with its receipt.
          The receipt is a CLAIM: press-and-hold (or click) pulls its provenance. */}
      {nextAction && !onTrack && (
        <div className={`card ${gxl.lifted} mb-4 border-brand-500/40 p-5`}>
          <h3 className={`${gxl.engraved} text-brand-300`}>Kai&apos;s next action</h3>
          <div className={`${gxl.record} mt-1.5 text-base text-slate-100`}>{nextAction.title}</div>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{nextAction.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href={nextAction.href} className={`btn-primary ${gxl.detent}`}>{nextAction.cta} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <span
              data-gxl-claim
              data-gxl-title={nextAction.title}
              data-gxl-room="Mission Control"
              data-gxl-filed="today"
              data-gxl-author="Execution Engine (deterministic)"
              data-gxl-responses="—"
              data-gxl-state={nextAction.basis}
              tabIndex={0}
              className="cursor-pointer text-xs text-slate-400 underline decoration-ink-600 decoration-dotted underline-offset-2 hover:text-slate-300"
              title="Press and hold (or click) to pull this recommendation's provenance"
            >
              {nextAction.basis}
            </span>
          </div>
        </div>
      )}

      {/* What's happening automatically */}
      {automatic.length > 0 && (
        <div className="card mb-4 border-ink-700 p-4">
          <h3 className={`${gxl.engravedDim} mb-2`}>Happening automatically</h3>
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
