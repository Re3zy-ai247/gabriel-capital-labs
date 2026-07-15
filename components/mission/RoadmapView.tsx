// The Roadmap surface (Sprint XVII) — the customer's credit journey from today
// through future milestones. Presentational only; renders what the engine sequenced.
import Link from "next/link";
import type { FinancialRoadmap, StageStatus } from "@/lib/roadmap";
import { Map as MapIcon, CheckCircle2, Circle, ArrowUpRight, Lock } from "lucide-react";

const DOT: Record<StageStatus, string> = {
  completed: "bg-success-400", current: "bg-brand-400", active: "bg-ocean-400", waiting: "bg-gold-400",
  upcoming: "bg-slate-600", locked: "bg-slate-600", unavailable: "bg-slate-700",
};
const LABEL: Record<StageStatus, string> = {
  completed: "Done", current: "You are here", active: "In progress", waiting: "Waiting",
  upcoming: "Upcoming", locked: "Future module", unavailable: "Not tracked",
};

export function RoadmapView({ roadmap }: { roadmap: FinancialRoadmap }) {
  if (roadmap.stages.length <= 1) return null;
  return (
    <section aria-label="Credit roadmap" className="card mb-4 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MapIcon className="h-4 w-4 text-brand-300" aria-hidden />
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Your roadmap</h3>
        {roadmap.progressPct != null && <span className="text-[11px] text-slate-400">· {roadmap.progressPct}% of the journey underway</span>}
      </div>

      <ol className="relative space-y-1 border-l border-ink-700/70 pl-5">
        {roadmap.stages.map((s) => {
          const actionable = s.status !== "locked" && s.status !== "unavailable" && s.status !== "upcoming";
          const body = (
            <div className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* status dot on the spine + a text label (never color alone) */}
                <span className={`absolute -left-[25px] h-2.5 w-2.5 rounded-full ring-2 ring-ink-900 ${DOT[s.status]}`} aria-hidden />
                <span className="text-sm font-medium text-slate-200">{s.label}</span>
                <span className="pill inline-flex items-center gap-1 bg-ink-700 text-slate-300">
                  {s.status === "locked" && <Lock className="h-2.5 w-2.5" aria-hidden />}{LABEL[s.status]}
                </span>
                {actionable && <ArrowUpRight className="h-3.5 w-3.5 text-brand-300" aria-hidden />}
              </div>
              <p className="mt-0.5 text-[12px] text-slate-400">{s.summary}</p>
              {s.milestones.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {s.milestones.map((m, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      {m.done
                        ? <CheckCircle2 className="h-3 w-3 shrink-0 text-success-400" aria-hidden />
                        : <Circle className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />}
                      <span className="sr-only">{m.done ? "Done: " : "Not done: "}</span>{m.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
          return (
            <li key={s.id} className="relative">
              {actionable ? <Link href={s.href} aria-label={`${s.label} — ${LABEL[s.status]}`} className="block rounded-lg transition-colors hover:bg-ink-800/40">{body}</Link> : body}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] text-slate-400">{roadmap.note}</p>
    </section>
  );
}
