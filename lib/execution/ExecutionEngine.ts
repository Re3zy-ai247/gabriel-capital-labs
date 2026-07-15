// CreditVector Execution Engine (Sprint XX, ADR-0020). The orchestration layer that
// turns every existing deterministic engine into an executive assistant: it answers
// "what should I do today, what's waiting on me, what happens if I do nothing, which
// action has the highest-impact unlock, what's blocked, what depends on what?".
//
// It is PURE ORCHESTRATION. It computes no new intelligence, runs no new query, and
// duplicates no business logic. It consumes ONLY what the platform already produced:
// the Mission Engine (ranks + states every item), the Credit Intelligence Platform,
// Mission Control, the Roadmap Engine, the Credit Builder OS, and the Knowledge
// Graph. Every execution item maps 1:1 from a mission the Mission Engine already
// ranked; this engine enriches it (timeline, dependencies, expected unlock, cost of
// inaction, citations) and files it into the five-bucket Executive Queue.
//
// No AI. No predictions. No fabricated priorities, timelines, or approvals. Every
// item cites its sources; `assembleExecution` is pure (no DB) so the whole thing is
// unit-testable and 100% reproducible.
import type {
  Mission, FinancialMission, Level, MissionState, MissionTimelineEntry,
} from "@/lib/missionEngine";
import type { CreditIntelligence, IntelSnapshot } from "@/lib/intelligence";
import type { BuilderOS } from "@/lib/builder";
import type { FinancialRoadmap } from "@/lib/roadmap";
import type { FinancialKnowledge } from "@/lib/knowledge";
import type { MissionControlData } from "@/lib/missionControl";

import { classifyPriority, LADDER, type ExecutionPriority } from "./ExecutionPriority";
import { bucketOf, groupIntoBuckets, type ExecutionBucket } from "./ExecutionQueue";
import { itemTimeline, caseTimeline } from "./ExecutionTimeline";
import { resolveDeps } from "./ExecutionDependencies";
import { expectedOutcome, biggestUnlock } from "./ExecutionRewards";
import { ifIgnored, caseRisk } from "./ExecutionRisk";

// Every recommendation cites its sources — no uncited recommendations. `mission` is
// always present (the originating mission), so every item is cited by construction;
// the rest attach only when they genuinely apply (never fabricated to fill a slot).
export interface ExecutionCitations {
  mission: string;
  ledger?: string;         // Outcome Ledger — your own verified-outcome history
  campaign?: string;       // Campaign Intelligence
  roadmap?: string;        // Roadmap Engine — the stage this advances
  builder?: string;        // Credit Builder OS
  knowledgeGraph?: string; // Knowledge Graph — a real journey chain / connected reason
}

export interface ExecutionItem {
  id: string;
  bucket: ExecutionBucket;
  title: string;               // ← mission.title
  why: string;                 // "why this matters" ← mission.reason
  requiredAction: string;      // the concrete next step
  href: string;
  expectedOutcome: string;     // factual unlock — never a promised score
  dependencies: string[];      // upstream
  blocks: string[];            // downstream
  effort: Level;               // ← mission.effort
  timeline: string;            // window-derived — never a fabricated date
  evidence: string;            // ← mission.evidence (cites real data)
  status: MissionState;        // ← mission.state
  blockingReason: string | null;
  ifIgnored: string;           // cost of inaction — factual, not predicted
  priority: ExecutionPriority; // deterministic ladder rung
  citations: ExecutionCitations;
}

export interface ExecutionResult {
  hasReport: boolean;
  today: ExecutionItem | null;                                    // the single most important DO_NOW
  biggestUnlock: { title: string; unlock: string; itemId: string } | null;
  caseRisk: { level: "high" | "medium" | "low"; note: string };   // "what happens if I do nothing"
  buckets: { key: ExecutionBucket; label: string; blurb: string; items: ExecutionItem[] }[];
  counts: Record<ExecutionBucket, number>;
  timeline: MissionTimelineEntry[];
  note: string;
}

// Everything the pure assembler needs — all already computed on the dashboard.
export interface ExecutionInputs {
  intel: CreditIntelligence;
  mission: FinancialMission;
  roadmap: FinancialRoadmap;
  builder: BuilderOS;
  knowledge: FinancialKnowledge;
  mc: MissionControlData;
  snap: IntelSnapshot;
}

const ACTION: Record<string, string> = {
  upload_reports: "Upload your credit reports",
  monitor_deadline: "Escalate the overdue reinvestigation",
  round_2: "Review the response and open the next round",
  dispute: "Review and approve the dispute",
  approve_campaign: "Review and approve the campaign",
  address_consistency: "Complete your mailing address",
  escalate_cfpb: "File the CFPB / state-AG escalation",
  wait_response: "No action needed — the statutory clock is running",
  builder: "Review this credit-building step",
  business_credit_setup: "Future module — nothing to do yet",
};

const LEDGER_RELEVANT = new Set(["monitor_deadline", "escalate_cfpb", "round_2", "wait_response"]);

// Build the citation set for one mission — every field references a string an
// existing engine ALREADY produced; nothing here is computed or invented.
function cite(m: Mission, x: ExecutionInputs): ExecutionCitations {
  const c: ExecutionCitations = { mission: `Mission ${m.id} · ${m.type}` };

  const ledgerLine = x.mc.ownHistory ?? x.intel.health.history;
  if (ledgerLine && LEDGER_RELEVANT.has(m.type)) c.ledger = ledgerLine;

  if (m.type === "approve_campaign" || m.type === "dispute") {
    const tile = x.mc.command.find((t) => t.key === "campaigns");
    if (tile) c.campaign = `Campaigns: ${tile.stat} (${tile.sub})`;
  }

  const stage = x.roadmap.stages.find((s) => s.id === x.roadmap.currentStageId)
    ?? x.roadmap.stages.find((s) => s.status === "current");
  if (stage) c.roadmap = `Roadmap stage: ${stage.label}`;

  if (m.type === "builder") {
    const rec = x.builder.recommendations.find((r) => r.status === "recommended");
    c.builder = rec ? `Builder: ${rec.label} — ${rec.observed}` : `Builder OS: ${x.builder.summary}`;
  }

  // A REAL journey chain that touches this item's destination — matched by href, so
  // the citation is deterministic AND specifically relevant to THIS item. Omitted
  // (never faked, never loosely attached) when no chain pertains.
  const chain = x.knowledge.chains.find((ch) => ch.steps.some((s) => s.node.href === m.href));
  if (chain) c.knowledgeGraph = `Chain: ${chain.title}`;

  return c;
}

function toItem(m: Mission, x: ExecutionInputs): ExecutionItem {
  const deps = resolveDeps(m);
  return {
    id: m.id,
    bucket: bucketOf(m.state),
    title: m.title,
    why: m.reason,
    requiredAction: ACTION[m.type] ?? m.title,
    href: m.href,
    expectedOutcome: expectedOutcome(m, x.builder, x.roadmap),
    dependencies: deps.dependsOn,
    blocks: deps.blocks,
    effort: m.effort,
    timeline: itemTimeline(m),
    evidence: m.evidence,
    status: m.state,
    blockingReason: deps.blockingReason,
    ifIgnored: ifIgnored(m),
    priority: classifyPriority(m),
    citations: cite(m, x),
  };
}

// A completed item is a real, append-only event from the Outcome Ledger / event
// history (Mission Engine `completed` = CVI `timeline.past`). Lowest rung, no action.
function completedItem(text: string, i: number, x: ExecutionInputs): ExecutionItem {
  const rung = LADDER.length - 1;
  return {
    id: `done_${i}`,
    bucket: "COMPLETED",
    title: text,
    why: "Already completed — part of your verified history.",
    requiredAction: "Done",
    href: "/journey",
    expectedOutcome: "Recorded in your case history.",
    dependencies: [],
    blocks: [],
    effort: "low",
    timeline: "Completed",
    evidence: "Verified event history.",
    status: "completed",
    blockingReason: null,
    ifIgnored: "Already done — nothing at risk.",
    priority: { tier: "outcome_dependency", rank: rung, sub: 0, band: "low", reason: "Already completed." },
    citations: {
      mission: "Verified event history (Outcome Ledger)",
      ledger: x.mc.ownHistory ?? undefined,
      knowledgeGraph: x.knowledge.counts.edges > 0 ? `${x.knowledge.counts.nodes} linked records on file` : undefined,
    },
  };
}

// The pure composition — deterministic given its inputs. This is the whole engine.
export function assembleExecution(x: ExecutionInputs): ExecutionResult {
  const impactById = new Map<string, Mission["impact"]>();
  const items: ExecutionItem[] = x.mission.queue.map((m) => {
    impactById.set(m.id, m.impact);
    return toItem(m, x);
  });
  // Completed history → the COMPLETED bucket (cap at a readable 12, newest first are
  // already ordered by the Mission Engine's projection).
  x.mission.completed.slice(0, 12).forEach((text, i) => items.push(completedItem(text, i, x)));

  const buckets = groupIntoBuckets(items);
  const doNow = buckets.find((b) => b.key === "DO_NOW")?.items ?? [];
  const counts = buckets.reduce((acc, b) => { acc[b.key] = b.items.length; return acc; }, {} as Record<ExecutionBucket, number>);

  return {
    hasReport: x.intel.hasReport,
    today: doNow[0] ?? null,
    biggestUnlock: biggestUnlock(doNow, impactById),
    caseRisk: caseRisk(x.snap),
    buckets,
    counts,
    timeline: caseTimeline(x.mission),
    note: "Computed deterministically from your Mission queue, Roadmap, Credit Builder OS, Outcome Ledger and Knowledge Graph — no AI, no predictions, no fabricated priorities.",
  };
}
