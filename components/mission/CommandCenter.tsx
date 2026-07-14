// Command Center — the operating-system summary (Sprint XIII). Deep-linked
// sections, health signals, campaign capacity, and the deferred queue, all from
// the deterministic MissionControlData. Presentational only; nothing static.
import Link from "next/link";
import type { MissionControlData, Health } from "@/lib/missionControl";
import { ArrowUpRight, Layers, Clock, ShieldCheck } from "lucide-react";

const TONE_DOT: Record<Health | "neutral", string> = {
  green: "bg-success-400", amber: "bg-gold-400", red: "bg-rose-400", neutral: "bg-slate-500",
};
const TONE_TEXT: Record<Health, string> = { green: "text-success-300", amber: "text-gold-400", red: "text-rose-300" };
const TONE_BORDER: Record<Health, string> = {
  green: "border-success-500/30 bg-success-500/[0.05]",
  amber: "border-gold-500/30 bg-gold-500/[0.05]",
  red: "border-rose-500/40 bg-rose-500/[0.05]",
};

export function CommandCenter({ data }: { data: MissionControlData }) {
  const { command, capacity, deferred, health, caseHealth } = data;

  return (
    <section aria-label="Command Center" className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Command center</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_BORDER[caseHealth]} border`}>
          <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[caseHealth]}`} aria-hidden />
          Case {caseHealth === "green" ? "healthy" : caseHealth === "amber" ? "needs attention" : "action overdue"}
        </span>
      </div>

      {/* 8 deep-linked sections */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {command.map((s) => (
          <Link key={s.key} href={s.href}
            className="card group p-4 transition-colors hover:border-brand-500/50">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.title}</div>
              <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[s.tone]}`} aria-hidden />
            </div>
            <div className="mt-1.5 truncate text-lg font-bold text-slate-100">{s.stat}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
              <span className="min-w-0 truncate">{s.sub}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </div>
          </Link>
        ))}
      </div>

      {/* Health dashboard */}
      <div className="card p-5">
        <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Health dashboard</h4>
        <ul className="grid gap-2 sm:grid-cols-2">
          {health.map((h) => (
            <li key={h.key} className="flex items-start gap-2.5 rounded-lg border border-ink-700/70 bg-ink-900/40 p-3">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[h.status]}`} aria-hidden />
              <div className="min-w-0">
                <div className={`text-xs font-semibold ${h.status === "green" ? "text-slate-300" : TONE_TEXT[h.status]}`}>
                  {h.label}
                  <span className="sr-only"> — {h.status === "green" ? "healthy" : h.status === "amber" ? "attention" : "overdue"}</span>
                </div>
                <div className="text-[11px] text-slate-400">{h.message}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Campaign capacity */}
      {capacity && (
        <div className="card p-5">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-300" aria-hidden />
            <h4 className="text-sm font-semibold">Recommended campaign size</h4>
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <div className="tnum text-3xl font-bold text-brand-400">{capacity.recommendedSize}</div>
            <div className="text-sm text-slate-400">account{capacity.recommendedSize === 1 ? "" : "s"}{capacity.family ? ` · ${capacity.family}` : ""}</div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {capacity.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-slate-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" aria-hidden />{r}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-400">
            This is CreditVector&apos;s operational guidance (recommended up to {capacity.policyMax} per campaign), not a legal limit — you can always send more from the campaign planner.
          </p>
          <Link href="/campaigns" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:underline">
            Open the campaign planner <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      )}

      {/* Deferred queue */}
      {deferred.length > 0 && (
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-400" aria-hidden />
            <h4 className="text-sm font-semibold">Deferred queue</h4>
            <span className="pill bg-ink-700 text-slate-400">{deferred.length} staged</span>
          </div>
          <p className="mb-3 text-[11px] text-slate-400">Staged automatically — no spreadsheets. Each item shows why it&apos;s waiting and what unlocks it.</p>
          <ul className="divide-y divide-ink-700/50">
            {deferred.map((d, i) => (
              <li key={i} className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">{d.creditorName}</span>
                  {d.estReviewDate && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" aria-hidden /> est. review ~{d.estReviewDate}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">{d.why}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  <span className="text-slate-400">Unlocks:</span> {d.unlocks}{d.dependency ? ` · depends on: ${d.dependency}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
