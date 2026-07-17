// Kai Strategic Planner (Phase C, Sprint 4) — CVI module.
// ─────────────────────────────────────────────────────────────────────────────
// Multi-step, goal-directed strategy composition over the Credit Graph + Case
// Memory. PURE and adaptive-by-recompute: the plan is a deterministic function
// of the current case, so when new evidence arrives (a response is logged, a
// window closes) the same call yields the updated plan — no stored plan state
// to drift. Reuses the reasoning engine's recommendations and the proactive
// scanner's signals; owns only SEQUENCING. Steps cite evidence; nothing here
// promises outcomes (CROA) or concludes law (citations come from reasoning).
import type { CreditGraph } from "./graph";
import { projectCaseMemory } from "./caseMemory";
import { reason, validateReasoningTrace, type StrategyHook } from "./reasoning";
import { scanProactive, validateSignals } from "./proactive";

export type StrategyGoal =
  | "ninety_day_repair" | "mortgage_preparation" | "funding_readiness"
  | "business_credit_roadmap" | "inquiry_strategy" | "collection_strategy"
  | "chargeoff_strategy" | "timeline_optimization";

export interface PlanStep {
  order: number;
  phase: "now" | "next_30" | "day_31_60" | "day_61_90";
  action: string;
  why: string;
  evidence: readonly string[];
}

export interface StrategicPlan {
  goal: StrategyGoal;
  steps: readonly PlanStep[];
  adaptationNote: string; // how the plan changes as evidence arrives
  degraded: boolean; // true = validation failed upstream; steps withheld (fail-closed)
}

// Display labels are PROCESS-framed (CROA): never render the raw goal id as a
// results timeline ("90-Day Repair" implies a substantiated time-to-results).
export const GOAL_DISPLAY_LABELS: Record<StrategyGoal, string> = {
  ninety_day_repair: "90-Day Action Plan (a working cadence, not a results timeline)",
  mortgage_preparation: "Mortgage Preparation Review",
  funding_readiness: "Funding Readiness Review",
  business_credit_roadmap: "Business Credit Roadmap",
  inquiry_strategy: "Inquiry Review",
  collection_strategy: "Collections Workflow",
  chargeoff_strategy: "Charge-off Workflow",
  timeline_optimization: "Deadline & Timeline Review",
};

const GOAL_FILTERS: Record<StrategyGoal, (g: CreditGraph) => readonly string[]> = {
  ninety_day_repair: (g) => g.nodes.filter((n) => n.kind === "tradeline" || n.kind === "collection").map((n) => n.ref),
  mortgage_preparation: (g) => g.nodes.filter((n) => n.kind === "readiness_goal" && /mortgage/i.test(n.label)).map((n) => n.ref),
  funding_readiness: (g) => g.nodes.filter((n) => n.kind === "readiness_goal" && /fund/i.test(n.label)).map((n) => n.ref),
  business_credit_roadmap: (g) => g.nodes.filter((n) => n.kind === "business_entity").map((n) => n.ref),
  inquiry_strategy: (g) => g.nodes.filter((n) => n.kind === "inquiry").map((n) => n.ref),
  collection_strategy: (g) => g.nodes.filter((n) => n.kind === "collection").map((n) => n.ref),
  chargeoff_strategy: (g) => g.nodes.filter((n) => (n.kind === "tradeline") && /charge.?off/i.test(String(n.facts.accountType))).map((n) => n.ref),
  timeline_optimization: (g) => g.nodes.filter((n) => n.kind === "dispute_window").map((n) => n.ref),
};

export function composeStrategy(g: CreditGraph, goal: StrategyGoal, strategyFor?: StrategyHook): StrategicPlan {
  const memory = projectCaseMemory(g);
  const signals = scanProactive(g, memory);
  const trace = reason(g, null, strategyFor);
  // FAIL-CLOSED: a plan is never composed from an invalid trace or invalid
  // signals — the no-hallucination/CROA net covers the planner path too.
  const errors = [...validateReasoningTrace(trace, g), ...validateSignals(signals, g)];
  if (errors.length > 0) {
    return { goal, steps: [], degraded: true, adaptationNote: `Plan withheld: upstream validation failed (${errors.length} error${errors.length === 1 ? "" : "s"}). Fix the reasoning inputs; never adapt the output.` };
  }
  const scope = new Set(GOAL_FILTERS[goal](g));
  const steps: PlanStep[] = [];
  let order = 1;

  // Phase NOW: urgent signals first (deadlines beat everything).
  for (const s of signals.filter((x) => x.urgency === "now")) {
    steps.push({ order: order++, phase: "now", action: s.suggestedAction, why: s.headline, evidence: s.evidence });
  }
  // Phase NEXT_30: goal-scoped recommendations from the reasoning engine.
  for (const r of trace.recommendations.filter((r) => scope.size === 0 || r.evidence.some((e) => scope.has(e)))) {
    steps.push({ order: order++, phase: "next_30", action: r.action, why: `Confidence ${r.confidence.level}: ${r.confidence.basis}`, evidence: r.evidence });
  }
  // Phase 31-60: follow-up structure driven by case memory.
  if (memory.openDeadlines > 0 || steps.some((s) => s.phase === "next_30")) {
    const windowRefs = g.nodes.filter((n) => n.kind === "dispute_window").map((n) => n.ref);
    const consumer = g.nodes.find((n) => n.kind === "consumer");
    steps.push({
      order: order++, phase: "day_31_60",
      action: "Log every bureau response as it arrives and run response analysis before drafting any follow-up.",
      why: "Round-two strength comes from what the bureau actually said, not from re-sending round one.",
      evidence: windowRefs.length ? windowRefs : consumer ? [consumer.ref] : [],
    });
  }
  // Phase 61-90: escalation/readiness review.
  const goals = g.nodes.filter((n) => n.kind === "readiness_goal");
  const consumer = g.nodes.find((n) => n.kind === "consumer");
  steps.push({
    order: order++, phase: "day_61_90",
    action: goals.length ? "Re-assess readiness goals against the updated case record and re-run the plan." : "Re-run the strategy review on the updated case record.",
    why: "The plan adapts by recomputation — day-90 decisions should rest on day-89 evidence.",
    evidence: goals.length ? goals.map((n) => n.ref) : consumer ? [consumer.ref] : [],
  });

  return {
    goal,
    steps,
    degraded: false,
    adaptationNote: "This plan is a pure function of the case record: logging a response, closing a window, or resolving an item changes the next recomputation — nothing is locked in.",
  };
}
