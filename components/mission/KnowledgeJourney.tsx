// "My Financial Journey" (Sprint XIX) — the Knowledge Graph surface. Renders Kai's
// connected reasoning and the traceable relationship chains; every node is a real
// record and a clickable link. Presentational only.
import Link from "next/link";
import type { FinancialKnowledge, JourneyChain, NodeType, EdgeType } from "@/lib/knowledge";
import { Network, ChevronDown, ArrowRight, Sparkles } from "lucide-react";

const TYPE_LABEL: Record<NodeType, string> = {
  consumer: "You", profile: "Profile", tradeline: "Item", campaign: "Campaign", letter: "Letter",
  mail: "Mail", response: "Response", outcome: "Outcome", decision: "Recommendation", mission: "Mission",
  roadmap: "Roadmap", builder: "Builder", funding_readiness: "Funding", mortgage_readiness: "Mortgage", business_credit: "Business",
};
const EDGE_LABEL: Record<EdgeType, string> = {
  belongs_to: "belongs to", created: "created", generated: "generated for", recommended: "recommended",
  verified_by: "verified by", completed: "completed by", improved: "improved", blocked: "blocked", depends_on: "depends on",
  triggered: "triggered", resolved: "resolved", strengthened: "strengthened", unlocked: "unlocked", closed: "closed", superseded: "follows",
};

export function KnowledgeJourney({ knowledge }: { knowledge: FinancialKnowledge }) {
  if (knowledge.chains.length === 0 && knowledge.reasons.length === 0) return null;
  return (
    <section aria-label="My financial journey" className="card mb-4 p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Network className="h-4 w-4 text-brand-300" aria-hidden />
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">My financial journey</h3>
        <span className="text-[11px] text-slate-400">· {knowledge.counts.nodes} connected records</span>
      </div>
      <p className="mb-3 text-[12px] text-slate-400">Trace any recommendation through the disputes, responses, and verified outcomes it connects to — every step is a real record.</p>

      {knowledge.reasons.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {knowledge.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-ocean-500/20 bg-ocean-500/[0.04] p-2.5 text-[12px] text-slate-300">
              <span className="rounded bg-brand-500/15 px-1 py-px text-[9px] font-bold tracking-widest text-brand-300">KAI</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}

      {knowledge.chains.length > 0 && (
        <ul className="space-y-1">
          {knowledge.chains.map((c) => <ChainRow key={c.key} c={c} />)}
        </ul>
      )}
    </section>
  );
}

function ChainRow({ c }: { c: JourneyChain }) {
  return (
    <li>
      <details className="group rounded-lg border border-ink-700/70 bg-ink-900/40">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{c.title}</span>
          <span className="pill bg-ink-700 text-slate-300">{c.steps.length} steps</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ol className="space-y-1.5 px-3 pb-3">
          {c.steps.map((s, i) => (
            <li key={s.node.id} className="flex items-center gap-2 text-[12px]">
              {s.edge && i > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <ArrowRight className="h-3 w-3" aria-hidden />{EDGE_LABEL[s.edge]}
                </span>
              )}
              <Link href={s.node.href} className="inline-flex items-center gap-1.5 rounded px-1 text-slate-200 hover:bg-ink-800/60 hover:underline">
                <span className="rounded bg-ink-700 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-slate-400">{TYPE_LABEL[s.node.type]}</span>
                {s.node.label}
              </Link>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}
