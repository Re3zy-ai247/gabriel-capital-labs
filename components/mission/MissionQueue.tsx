// The Financial Operating System surface (Sprint XVI). Renders the Mission
// Engine's prioritized queue, timeline, progress, rewards, and completed history.
// Presentational only — it displays what the engine ranked, computes nothing.
import Link from "next/link";
import type { FinancialMission, Mission, PriorityBand, MissionState } from "@/lib/missionEngine";
import { ListChecks, Clock, CheckCircle2, Trophy, ArrowUpRight, Lock } from "lucide-react";

const BAND_DOT: Record<PriorityBand, string> = { critical: "bg-rose-400", high: "bg-gold-400", medium: "bg-ocean-400", low: "bg-slate-500" };
const STATE_LABEL: Record<MissionState, string> = {
  locked: "Locked", available: "Ready", waiting: "Waiting", blocked: "Blocked", in_progress: "In progress",
  needs_review: "Needs review", completed: "Done", deferred: "Later", expired: "Expired",
};

export function MissionQueue({ mission }: { mission: FinancialMission }) {
  const queue = mission.queue.slice(0, 8);
  if (queue.length === 0) return null;
  const p = mission.progress;

  return (
    <section aria-label="Mission queue" className="mb-4 space-y-4">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-brand-300" aria-hidden />
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Priority queue</h3>
        {p.overallPct != null && <span className="text-[11px] text-slate-400">· {p.overallPct}% mission completion</span>}
      </div>

      {/* Priority queue */}
      <ol className="card divide-y divide-ink-700/50 p-0">
        {queue.map((m, i) => <MissionRow key={m.id} m={m} rank={i + 1} />)}
      </ol>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Mission timeline */}
        {mission.timeline.length > 0 && (
          <div className="card p-5">
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Mission timeline</h4>
            <ul className="space-y-2">
              {mission.timeline.map((t, i) => (
                <li key={i} className="flex items-baseline gap-3 text-sm">
                  <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.when}</span>
                  <span className="min-w-0 flex-1 text-slate-300">{t.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mission progress */}
        <div className="card p-5">
          <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Mission progress</h4>
          {p.overallPct != null && (
            <div className="mb-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.overallPct} aria-label={`Mission completion: ${p.overallPct}%`}>
              <div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">Completion</span><span className="tnum text-brand-300">{p.overallPct}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full bg-brand-500" style={{ width: `${p.overallPct}%` }} /></div>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-2 text-[11px]">
            <Stat label="Case health" value={p.caseHealthNote} />
            <Stat label="Open" value={String(p.openCount)} />
            <Stat label="Completed" value={String(p.completedCount)} />
            <Stat label="Est. completion" value={p.estimatedCompletion} />
          </dl>
        </div>
      </div>

      {/* Rewards (factual) + Completed */}
      {(mission.rewards.length > 0 || mission.completed.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {mission.rewards.length > 0 && (
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-gold-400" aria-hidden /><h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Progress won</h4></div>
              <ul className="space-y-1.5">
                {mission.rewards.map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-sm"><span className="text-slate-400">{r.label}</span><span className="tnum font-semibold text-slate-200">{r.value}</span></li>
                ))}
              </ul>
            </div>
          )}
          {mission.completed.length > 0 && (
            <div className="card p-5">
              <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Completed missions</h4>
              <ul className="space-y-1.5">
                {mission.completed.slice(0, 6).map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-slate-400"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-400" aria-hidden />{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MissionRow({ m, rank }: { m: Mission; rank: number }) {
  const actionable = m.state !== "waiting" && m.state !== "locked" && m.state !== "completed" && m.state !== "deferred";
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="tnum w-5 shrink-0 text-xs font-bold text-slate-400">{rank}</span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${BAND_DOT[m.band]}`} aria-hidden />
      <span className="sr-only">{m.band} priority.</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-200">{m.title}</span>
          <span className="pill bg-ink-700 text-slate-300 inline-flex items-center gap-1">
            {m.state === "locked" && <Lock className="h-2.5 w-2.5" aria-hidden />}{STATE_LABEL[m.state]}
          </span>
        </div>
        <div className="truncate text-[11px] text-slate-400">{m.reason}</div>
        {(m.deadline || m.unlocks) && (
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-slate-400">
            {m.deadline && <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" aria-hidden />{m.deadline}</span>}
            {m.unlocks && <span>unlocks: {m.unlocks}</span>}
            <span>impact: {m.impact} · effort: {m.effort}</span>
          </div>
        )}
      </div>
      {actionable && <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-300" aria-hidden />}
    </div>
  );
  return (
    <li>
      {actionable ? <Link href={m.href} className="block transition-colors hover:bg-ink-800/40">{inner}</Link> : inner}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-400">{label}</dt><dd className="font-semibold text-slate-300">{value}</dd></div>;
}
