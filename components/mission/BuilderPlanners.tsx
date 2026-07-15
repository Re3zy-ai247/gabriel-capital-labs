// Credit Builder — educational planners (Sprint XXI, Phase 2). Presentational. Each
// card is explicitly badged so the reader always knows whether they're seeing general
// EDUCATIONAL guidance or a DATA-DRIVEN point computed from their own file — the
// distinction the founder required. No numbers are shown unless they come from the file.
import type { BuilderPlanner } from "@/lib/builder/education";
import { BookOpen, Database, GraduationCap } from "lucide-react";

export function BuilderPlanners({ planners }: { planners: BuilderPlanner[] }) {
  return (
    <section aria-label="Credit building planners" className="mb-4 space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-brand-300" aria-hidden />
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Planning tools</h3>
        <span className="text-[11px] text-slate-500">· how each factor works</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {planners.map((p) => <PlannerCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}

function PlannerCard({ p }: { p: BuilderPlanner }) {
  const dataDriven = p.kind === "data-driven";
  return (
    <div className="card p-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100">{p.title}</span>
        <span className={`pill inline-flex items-center gap-1 ${dataDriven ? "bg-brand-500/15 text-brand-200" : "bg-ink-700 text-slate-400"}`}>
          {dataDriven ? <Database className="h-2.5 w-2.5" aria-hidden /> : <BookOpen className="h-2.5 w-2.5" aria-hidden />}
          {dataDriven ? "Data-driven" : "Educational"}
        </span>
      </div>
      {p.fromYourFile && (
        <div className="mb-2 rounded-md bg-ink-800/50 px-2.5 py-1.5 text-[11px]">
          <span className="font-bold uppercase tracking-widest text-slate-500">Your file · </span>
          <span className="text-slate-300">{p.fromYourFile}</span>
        </div>
      )}
      <ul className="space-y-1">
        {p.guidance.map((g, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-slate-400">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" aria-hidden />
            <span>{g}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
