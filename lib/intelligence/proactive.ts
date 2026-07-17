// Kai Proactive Intelligence (Phase C, Sprint 6) — CVI module.
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic scanner over the Credit Graph + Case Memory that surfaces what
// the user should know BEFORE they ask — every signal carries a receipt (graph
// ref) and a workflow action, never an outcome promise. Signals may be handed
// to the notify.plan.compose kernel module as a Layer-2 DECISION only: the
// email/push EFFECT remains designed-not-built (ADR-0027) and nothing here
// sends anything.
import type { CreditGraph } from "./graph";
import type { CaseMemory } from "./caseMemory";
import { scanForbiddenLanguage } from "./reasoning";

export type SignalKind =
  | "deadline_closing" | "followup_ready" | "missing_documentation"
  | "readiness_blocker" | "unworked_item" | "stale_case";

export interface ProactiveSignal {
  kind: SignalKind;
  headline: string;
  detail: string;
  evidence: readonly string[]; // graph refs — the receipt
  suggestedAction: string; // workflow language only
  urgency: "now" | "soon" | "planned";
}

/** Pure: same inputs → deep-equal signals, stable order (urgency, then headline). */
export function scanProactive(g: CreditGraph, memory: CaseMemory): ProactiveSignal[] {
  const out: ProactiveSignal[] = [];

  for (const w of g.nodes.filter((n) => n.kind === "dispute_window")) {
    const daysLeft = Number(w.facts.daysLeft);
    if (daysLeft <= 7) {
      out.push({
        kind: "deadline_closing", urgency: "now",
        headline: `A reinvestigation window closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        detail: `${w.label}. When it closes, the next move is reviewing what came back — or documenting that nothing did.`,
        evidence: [w.ref], suggestedAction: "Open the letter's tracking view and log any response received.",
      });
    }
  }

  for (const r of g.nodes.filter((n) => n.kind === "response")) {
    out.push({
      kind: "followup_ready", urgency: "soon",
      headline: "A logged response is ready for analysis",
      detail: `${r.label} — Kai can read it and recommend the strongest supported next round.`,
      evidence: [r.ref], suggestedAction: "Run response analysis on the logged reply.",
    });
  }

  const consumer = g.nodes.find((n) => n.kind === "consumer");
  const items = g.nodes.filter((n) => n.kind === "tradeline" || n.kind === "collection");
  for (const t of items) {
    const disputed = g.edges.some((e) => e.from === t.ref && e.kind === "disputed_via");
    const strong = String(t.facts.probability) === "HIGH";
    if (strong && !disputed) {
      out.push({
        kind: "unworked_item", urgency: "soon",
        headline: `${t.label} is a strong candidate with no dispute on record`,
        detail: "A HIGH-strength item is sitting unworked while weaker items may be consuming rounds.",
        evidence: [t.ref], suggestedAction: "Draft the first-round dispute for this item.",
      });
    }
  }

  for (const goal of g.nodes.filter((n) => n.kind === "readiness_goal")) {
    const blockers = g.edges.filter((e) => e.to === goal.ref && e.kind === "blocks");
    if (blockers.length) {
      out.push({
        kind: "readiness_blocker", urgency: "planned",
        headline: `${goal.label}: ${blockers.length} item${blockers.length === 1 ? "" : "s"} recorded as blockers`,
        detail: "These items are recorded as blockers on this goal — review them in the strategy desk. No outcome is promised; the record shows what stands in the way.",
        evidence: [goal.ref, ...blockers.map((e) => e.from)],
        suggestedAction: "Review the blocking items in the strategy desk queue.",
      });
    }
  }

  if (items.length > 0 && memory.entries.length === 0 && consumer) {
    out.push({
      kind: "stale_case", urgency: "planned",
      headline: "The report is analyzed but no case work has started",
      detail: `${items.length} item${items.length === 1 ? " is" : "s are"} scored and waiting.`,
      evidence: [consumer.ref], suggestedAction: "Start with the top item on the strategy desk.",
    });
  }

  const rank = { now: 0, soon: 1, planned: 2 } as const;
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency] || (a.headline < b.headline ? -1 : a.headline > b.headline ? 1 : 0));
}

/** CROA net over every signal text surface — a signal that fails is NEVER shown. */
export function validateSignals(signals: readonly ProactiveSignal[], g: CreditGraph): string[] {
  const errors: string[] = [];
  for (const s of signals) {
    if (s.evidence.length === 0) errors.push(`signal without receipt: ${s.headline.slice(0, 50)}`);
    for (const ref of s.evidence) if (!g.byRef.has(ref)) errors.push(`dangling signal evidence ${ref}`);
    for (const text of [s.headline, s.detail, s.suggestedAction]) {
      const hit = scanForbiddenLanguage(text);
      if (hit) errors.push(`forbidden language in signal (/${hit}/): "${text.slice(0, 50)}"`);
    }
  }
  return errors;
}

// CAN-SPAM classification is per-kind, NOT blanket: deadline/follow-up notices
// about the user's own open case are transactional; re-engagement nudges on a
// dormant case are relationship/commercial-adjacent — counsel reviews those
// before ANY send path exists (the effect stays designed-not-built, ADR-0027).
const SIGNAL_CLASS: Record<SignalKind, "transactional" | "counsel_review"> = {
  deadline_closing: "transactional",
  followup_ready: "transactional",
  missing_documentation: "transactional",
  readiness_blocker: "counsel_review",
  unworked_item: "counsel_review",
  stale_case: "counsel_review",
};

/** Bridge to the kernel notify module — DECISION input only (no send fields,
 *  no recipient). Summary is a topic label, never raw case text. */
export function toNotifyPlanInput(s: ProactiveSignal): { topic: string; classHint: "transactional" | "counsel_review"; summary: string } {
  return { topic: `kai.proactive.${s.kind}`, classHint: SIGNAL_CLASS[s.kind], summary: s.kind.replace(/_/g, " ") };
}
