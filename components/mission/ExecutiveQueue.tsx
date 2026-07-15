// The Executive Queue (Sprint XX, ADR-0020) — one prioritized answer to "what should
// I do next?", replacing scattered recommendations. Presentational only: it renders
// what the Execution Engine already orchestrated and computes nothing. Cards expand
// (native <details>, no client JS) into Kai's reasoning, evidence, the Knowledge
// Graph chain, dependencies, the expected unlock, the cost of inaction, and every
// citation — nothing on this screen is uncited.
import Link from "next/link";
import type { ExecutionResult, ExecutionItem } from "@/lib/execution";
import type { PriorityBand, MissionState, Level } from "@/lib/missionEngine";
import {
  Target, Clock, ArrowUpRight, Lock, AlertTriangle, Sparkles, ListChecks, ChevronDown, ShieldAlert, Gauge,
} from "lucide-react";

const BAND_DOT: Record<PriorityBand, string> = { critical: "bg-rose-400", high: "bg-gold-400", medium: "bg-ocean-400", low: "bg-slate-500" };
const STATE_LABEL: Record<MissionState, string> = {
  locked: "Locked", available: "Ready", waiting: "Waiting", blocked: "Blocked", in_progress: "In progress",
  needs_review: "Needs review", completed: "Done", deferred: "Optional", expired: "Expired",
};
const RISK_TONE: Record<"high" | "medium" | "low", string> = { high: "text-rose-300", medium: "text-gold-300", low: "text-slate-300" };
const ACTIONABLE: ReadonlySet<MissionState> = new Set<MissionState>(["available", "needs_review", "in_progress"]);

export function ExecutiveQueue({ execution }: { execution: ExecutionResult }) {
  const { today, biggestUnlock, caseRisk, readiness, buckets, note } = execution;
  const visible = buckets.filter((b) => b.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <section aria-label="Executive queue" className="mb-4 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-brand-300" aria-hidden />
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Executive queue</h3>
        <span className="text-[11px] text-slate-500">· Kai's one-list of what to do next</span>
      </div>

      {/* The three questions every login should answer, up top. */}
      <div className="grid gap-3 md:grid-cols-3">
        <HeadTile icon={<ListChecks className="h-4 w-4 text-brand-300" aria-hidden />} label="Do this first"
          title={today ? today.title : "You're all caught up"} sub={today ? today.requiredAction : "No action waiting on you."} href={today?.href} />
        <HeadTile icon={<Sparkles className="h-4 w-4 text-gold-400" aria-hidden />} label="Highest-impact unlock"
          title={biggestUnlock ? biggestUnlock.title : "—"} sub={biggestUnlock ? biggestUnlock.unlock : "Nothing to unlock right now."} />
        <HeadTile icon={<ShieldAlert className={`h-4 w-4 ${RISK_TONE[caseRisk.level]}`} aria-hidden />} label="If you do nothing"
          title={caseRisk.level === "high" ? "Time-sensitive" : caseRisk.level === "medium" ? "Worth watching" : "Nothing at risk"}
          sub={caseRisk.note} tone={RISK_TONE[caseRisk.level]} />
      </div>

      {/* Readiness — a first-class signal feeding the queue (Phase 4). */}
      {readiness.focus && (
        <div className="card flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-[12px]">
          <span className="pill inline-flex items-center gap-1 bg-ink-700 text-slate-300"><Gauge className="h-2.5 w-2.5" aria-hidden />Readiness: {readiness.band}</span>
          <span className="text-slate-300">Next goal: <span className="font-medium text-slate-100">{readiness.focus.label}</span></span>
          {readiness.focus.blocker && <span className="min-w-0 text-slate-400">· {readiness.focus.blocker}</span>}
          <span className="text-slate-500">· {readiness.focus.timeline}</span>
        </div>
      )}

      {visible.map((b) => (
        <div key={b.key}>
          <div className="mb-2 flex items-baseline gap-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-300">{b.label}</h4>
            <span className="tnum text-[11px] text-slate-500">{b.items.length}</span>
            <span className="text-[11px] text-slate-500">· {b.blurb}</span>
          </div>
          <ol className="space-y-2">
            {b.items.map((it) => <ExecutionCard key={it.id} it={it} />)}
          </ol>
        </div>
      ))}

      <p className="text-[10px] leading-relaxed text-slate-500">{note}</p>
    </section>
  );
}

function HeadTile({ icon, label, title, sub, href, tone }: { icon: React.ReactNode; label: string; title: string; sub: string; href?: string; tone?: string }) {
  const inner = (
    <div className="card h-full p-4">
      <div className="mb-1.5 flex items-center gap-2"><span aria-hidden>{icon}</span><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span></div>
      <div className={`text-sm font-semibold ${tone ?? "text-slate-100"}`}>{title}</div>
      <div className="mt-0.5 text-[12px] leading-snug text-slate-400">{sub}</div>
    </div>
  );
  return href ? <Link href={href} className="block transition-colors hover:brightness-110">{inner}</Link> : inner;
}

function ExecutionCard({ it }: { it: ExecutionItem }) {
  const actionable = ACTIONABLE.has(it.status);
  return (
    <li className="card overflow-hidden p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-800/40 [&::-webkit-details-marker]:hidden">
          <span className={`h-2 w-2 shrink-0 rounded-full ${BAND_DOT[it.priority.band]}`} aria-hidden />
          <span className="sr-only">{it.priority.band} priority.</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-100">{it.title}</span>
              <span className="pill bg-ink-700 text-slate-300 inline-flex items-center gap-1">
                {it.status === "locked" && <Lock className="h-2.5 w-2.5" aria-hidden />}{STATE_LABEL[it.status]}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" aria-hidden />{it.timeline}</span>
              <span>effort: {it.effort}</span>
              <span className="text-slate-500">{it.priority.reason}</span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <div className="space-y-3 border-t border-ink-700/50 px-4 py-3 text-[12px]">
          <Field label="Why this matters">{it.why}</Field>
          <Field label="Kai's reasoning">{it.priority.reason}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Required action">
              {actionable
                ? <Link href={it.href} className="inline-flex items-center gap-1 font-medium text-brand-300 hover:text-brand-200">{it.requiredAction}<ArrowUpRight className="h-3 w-3" aria-hidden /></Link>
                : <span className="text-slate-300">{it.requiredAction}</span>}
            </Field>
            <Field label="Expected unlock">{it.expectedOutcome}</Field>
          </div>
          <Field label="If you do nothing"><span className="text-slate-400">{it.ifIgnored}</span></Field>
          {it.blockingReason && (
            <div className="flex items-start gap-2 rounded-md bg-rose-950/30 px-3 py-2 text-rose-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span>Blocked: {it.blockingReason}</span>
            </div>
          )}
          {(it.dependencies.length > 0 || it.blocks.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {it.dependencies.length > 0 && <Field label="Depends on">{it.dependencies.join(" · ")}</Field>}
              {it.blocks.length > 0 && <Field label="Unblocks">{it.blocks.join(" · ")}</Field>}
            </div>
          )}
          <Field label="Evidence"><span className="text-slate-400">{it.evidence}</span></Field>

          {/* Citations — every recommendation cites its sources. */}
          <div className="rounded-md bg-ink-800/50 p-3">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Cited from</div>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Cite k="Mission" v={it.citations.mission} />
              <Cite k="Outcome Ledger" v={it.citations.ledger} />
              <Cite k="Campaign" v={it.citations.campaign} />
              <Cite k="Roadmap" v={it.citations.roadmap} />
              <Cite k="Credit Builder" v={it.citations.builder} />
              <Cite k="Knowledge Graph" v={it.citations.knowledgeGraph} />
            </dl>
          </div>
        </div>
      </details>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-slate-300">{children}</div>
    </div>
  );
}

function Cite({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return <div className="flex min-w-0 gap-1.5 text-[11px]"><dt className="shrink-0 font-semibold text-slate-500">{k}:</dt><dd className="min-w-0 truncate text-slate-400" title={v}>{v}</dd></div>;
}
