// The Credit Builder surface (Sprint XVIII). Renders the Builder OS's deterministic
// recommendations, each with Kai's WHY and the cited data behind it. Presentational
// only — it displays what the engine produced.
import Link from "next/link";
import type { BuilderOS, BuilderRecommendation, BuilderStatus } from "@/lib/builder";
import { Hammer, ChevronDown, ArrowUpRight, Lock } from "lucide-react";

const DOT: Record<BuilderStatus, string> = {
  recommended: "bg-brand-400", in_progress: "bg-ocean-400", on_track: "bg-success-400",
  not_applicable: "bg-slate-600", unavailable: "bg-slate-600", locked: "bg-slate-600",
};
const LABEL: Record<BuilderStatus, string> = {
  recommended: "Recommended", in_progress: "In progress", on_track: "On track",
  not_applicable: "N/A", unavailable: "Not enough info", locked: "Future module",
};

export function BuilderView({ builder }: { builder: BuilderOS }) {
  if (builder.recommendations.length === 0) return null;
  return (
    <section aria-label="Credit builder" className="card mb-4 p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Hammer className="h-4 w-4 text-brand-300" aria-hidden />
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Credit builder</h3>
      </div>
      <p className="mb-3 text-[12px] text-slate-400">{builder.summary}</p>
      <ul className="divide-y divide-ink-700/50">
        {builder.recommendations.map((r) => <BuilderRow key={r.id} r={r} />)}
      </ul>
      <p className="mt-3 text-[11px] text-slate-400">{builder.note}</p>
    </section>
  );
}

function BuilderRow({ r }: { r: BuilderRecommendation }) {
  return (
    <li className="py-2.5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[r.status]}`} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-200">{r.label}</span>
            <span className="ml-2 pill inline-flex items-center gap-1 bg-ink-700 text-slate-300">
              {r.status === "locked" && <Lock className="h-2.5 w-2.5" aria-hidden />}{LABEL[r.status]}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-2 space-y-2 pl-[18px]">
          <p className="flex items-start gap-1.5 text-[12px] text-slate-300">
            <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>
            <span>{r.why}</span>
          </p>
          {r.status !== "unavailable" && r.status !== "locked" && (
            <dl className="grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2">
              <Field label="Current profile" value={r.currentProfile} />
              <Field label="Observed" value={r.observed} />
              <Field label="Expected improvement" value={r.expectedImprovement} />
              <Field label="Dependencies" value={r.dependencies} />
              <Field label="Estimated timing" value={r.estimatedTiming} />
              <Field label="Evidence" value={r.evidence} />
            </dl>
          )}
          {(r.status === "unavailable" || r.status === "locked") && (
            <p className="text-[11px] text-slate-400"><span className="text-slate-300">Needs:</span> {r.dependencies} · <span className="text-slate-300">Observed:</span> {r.observed}</p>
          )}
          {r.action && (
            <Link href={r.action.href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-300 hover:underline">
              {r.action.text} <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          )}
        </div>
      </details>
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-400">{label}</dt><dd className="text-slate-300">{value}</dd></div>;
}
