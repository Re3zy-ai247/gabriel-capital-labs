// Kai Reasoning Engine (Phase C, Sprint 1) — CVI module.
// ─────────────────────────────────────────────────────────────────────────────
// The DETERMINISTIC reasoning pipeline behind every Kai recommendation:
//   Facts → Evidence → Conflicts → Applicable law → Risk → Confidence
//   → Recommendation → Action → Expected outcome
// PURE orchestration over the Credit Graph — no LLM anywhere in this core, no
// clock, no randomness. LLM surfaces (lib/kai.ts, strategist prompt) may RENDER
// a trace into prose (inside the ADR-0005 untrusted-content fence — traces
// contain report-derived strings); they never produce the reasoning.
//
// NO-HALLUCINATION LAW (V8 precedent): every finding cites ≥1 evidence ref that
// exists in the graph; validateReasoningTrace rejects uncited findings, dangling
// refs (including focusRef), and forbidden outcome language on EVERY text
// surface. LAW LAW: statute references come ONLY from lib/statutes.ts — the
// citation sentence is built from the canonical desc, never fresh prose.
// STRATEGY LAW (ownership): strategy SELECTION belongs to the canonical engine
// (lib/recommend.ts). This module never picks a strategy itself — the caller
// may inject `strategyFor` (wired to recommendStrategy at the loader); absent
// injection, actions use neutral process language naming no strategy, so the
// two engines can never contradict. CROA LAW: expected outcomes describe
// PROCESS and TIMELINE, never result probabilities (forecast precedent).
import { STATUTES, type StatuteKey } from "@/lib/statutes";
import type { CreditGraph, CreditNode } from "./graph";

export type ReasoningStage =
  | "facts" | "evidence" | "conflicts" | "law" | "risk"
  | "confidence" | "recommendation" | "action" | "expected_outcome";

export interface Finding {
  stage: ReasoningStage;
  text: string;
  evidence: readonly string[]; // graph node refs — MUST be non-empty and resolvable
  lawRefs?: readonly StatuteKey[]; // citations only, from the canonical vocabulary
}

export interface KaiConfidence {
  level: "high" | "moderate" | "low" | "insufficient";
  basis: string; // WHY this level — always stated, never bare
  evidenceQuality: "verified_own_outcomes" | "documented_case_records" | "report_only" | "insufficient";
  missingInformation: readonly string[];
}

/** Renamed from KaiRecommendation — lib/kaiHome.ts already exports that name. */
export interface ReasonedRecommendation {
  action: string;
  expectedOutcome: string; // PROCESS/TIMELINE only (CROA) — validated
  confidence: KaiConfidence; // computed PER ITEM (focus-scoped), never whole-case
  riskFactors: readonly string[];
  alternatives: readonly string[];
  evidence: readonly string[];
  lawRefs: readonly StatuteKey[];
}

export interface ReasoningTrace {
  focusRef: string | null;
  findings: readonly Finding[];
  recommendations: readonly ReasonedRecommendation[];
}

/** Optional injection point for the CANONICAL strategy engine (lib/recommend.ts).
 *  The loader wires it; reasoning itself never selects strategies. */
export type StrategyHook = (tradelineNodeId: string) => { label: string } | null;

// Forbidden-conclusion vocabulary (CROA bar). Applied to EVERY text surface a
// trace/signal/plan carries. Deliberately fail-closed: a creditor label that
// itself matches (e.g. "Guaranteed Rate") blocks the trace rather than risking
// a deceptive net impression — the renderer must then re-phrase, never bypass.
const FORBIDDEN_OUTCOME_PATTERNS: readonly RegExp[] = [
  /will be (deleted|removed)/i, /guarantee/i, /\d+\s*%\s*(chance|probability)/i,
  /score (will|should) (increase|improve|go up)/i, /definitely/i, /documented path to/i,
  // Obsolescence/deletion certainty — a §605 item is disputed to REQUEST that a
  // bureau verify and remove it, never asserted to drop off on its own. These
  // catch the class the six patterns above missed (e.g. "must drop off under §605").
  /must (drop off|be removed|be deleted)/i, /will (drop off|fall off|be dropped)/i,
  /automatically (removed|deleted|dropped|drops? off)/i,
];

export function scanForbiddenLanguage(text: string): string | null {
  for (const p of FORBIDDEN_OUTCOME_PATTERNS) if (p.test(text)) return p.source;
  return null;
}

export function scoreConfidence(g: CreditGraph, focus: CreditNode | null): KaiConfidence {
  const responses = g.nodes.filter((n) => n.kind === "response").length;
  const letters = g.nodes.filter((n) => n.kind === "letter").length;
  const missing: string[] = [];
  if (!focus && g.nodes.length <= 1) missing.push("no report data on file");
  if (letters > 0 && responses === 0) missing.push("no bureau responses logged yet");
  if (focus && (focus.kind === "tradeline" || focus.kind === "collection")) {
    const disputed = g.edges.some((e) => e.from === focus.ref && e.kind === "disputed_via");
    if (!disputed) missing.push("no dispute history for this item yet");
  }
  // NEVER "high" without verified own outcomes AND nothing material missing.
  if (g.nodes.length <= 1) return { level: "insufficient", basis: "No case data to reason over.", evidenceQuality: "insufficient", missingInformation: missing };
  if (responses > 0) {
    const level = missing.length ? "moderate" : "high";
    return { level, basis: `${responses} logged response${responses === 1 ? "" : "s"} ground this read in the case record${missing.length ? `; still missing: ${missing.join("; ")}` : ""}.`, evidenceQuality: "verified_own_outcomes", missingInformation: missing };
  }
  if (letters > 0) return { level: "moderate", basis: "Dispute records exist but no responses are logged yet — the read rests on documented case records.", evidenceQuality: "documented_case_records", missingInformation: missing };
  return { level: "low", basis: "Only the parsed report is available — no dispute history to corroborate.", evidenceQuality: "report_only", missingInformation: missing };
}

/** The pipeline. Pure; same graph + focus + hook → deep-equal trace. */
export function reason(g: CreditGraph, focusRef: string | null = null, strategyFor?: StrategyHook): ReasoningTrace {
  const focus = focusRef ? g.byRef.get(focusRef) ?? null : null;
  const findings: Finding[] = [];
  const consumer = g.nodes.find((n) => n.kind === "consumer");
  const consumerRef = consumer ? [consumer.ref] : [];

  // 1 FACTS
  const items = g.nodes.filter((n) => n.kind === "tradeline" || n.kind === "collection");
  for (const n of focus ? items.filter((i) => i.ref === focus.ref) : items) {
    findings.push({ stage: "facts", text: `${n.label}: ${String(n.facts.accountType)} — dispute strength ${String(n.facts.probability)}.`, evidence: [n.ref] });
  }
  if (findings.length === 0 && consumer) {
    findings.push({ stage: "facts", text: "No disputable items are on file for this case.", evidence: consumerRef });
  }

  // 2 EVIDENCE
  for (const l of g.nodes.filter((n) => n.kind === "letter")) {
    findings.push({ stage: "evidence", text: `${l.label} (status: ${String(l.facts.status ?? "draft")}).`, evidence: [l.ref] });
  }
  for (const r of g.nodes.filter((n) => n.kind === "response")) {
    findings.push({ stage: "evidence", text: `${r.label}.`, evidence: [r.ref] });
  }

  // 3 CONFLICTS — neutral factual observations; never manufactured dispute-worthiness.
  const conflictRefs = new Set<string>();
  for (const t of items) {
    const bureauEdges = g.edges.filter((e) => e.from === t.ref && e.kind === "reported_by");
    if (bureauEdges.length > 0 && bureauEdges.length < 3) {
      conflictRefs.add(t.ref);
      findings.push({
        stage: "conflicts",
        text: `${t.label} is reported by ${bureauEdges.length} of 3 bureaus — confirm the reporting is accurate and consistent where it appears.`,
        evidence: [t.ref, ...bureauEdges.map((e) => e.to)],
      });
    }
    if (t.facts.isDebtBuyer === true) {
      conflictRefs.add(t.ref);
      findings.push({ stage: "conflicts", text: `${t.label} is held by a debt buyer — requesting validation and chain-of-title documentation is an available step.`, evidence: [t.ref], lawRefs: ["fdcpa_809"] });
    }
  }

  // 4 LAW — the citation sentence comes from the canonical statute text home.
  const lawEvidence = items.length ? items.map((i) => i.ref) : consumerRef;
  if (items.length) {
    findings.push({ stage: "law", text: `${STATUTES.fcra_611.short} (${STATUTES.fcra_611.usc}): ${STATUTES.fcra_611.desc}`, evidence: lawEvidence, lawRefs: ["fcra_611"] });
  }
  for (const w of g.nodes.filter((n) => n.kind === "dispute_window")) {
    const rt = String(w.facts.recipientType ?? "bureau");
    if (rt === "collector") {
      findings.push({ stage: "law", text: `${w.label}: ${STATUTES.fdcpa_809.short} requires the collector to cease collection until validation is provided — it sets no response deadline; this window tracks OUR follow-up cadence, not a statutory clock.`, evidence: [w.ref], lawRefs: ["fdcpa_809"] });
    } else if (rt === "furnisher") {
      findings.push({ stage: "law", text: `${w.label}: ${STATUTES.fcra_623.short} (${STATUTES.fcra_623.usc}) governs furnisher investigation duties; ${String(w.facts.daysLeft)} days remain on the tracked window.`, evidence: [w.ref], lawRefs: ["fcra_623"] });
    } else {
      findings.push({ stage: "law", text: `${w.label}: ${String(w.facts.daysLeft)} days remain in the reinvestigation window (${STATUTES.fcra_611.short}, subject to its statutory exceptions).`, evidence: [w.ref], lawRefs: ["fcra_611"] });
    }
  }

  // 5 RISK
  for (const w of g.nodes.filter((n) => n.kind === "dispute_window" && Number(n.facts.daysLeft) <= 7)) {
    findings.push({ stage: "risk", text: `${w.label} closes in ${String(w.facts.daysLeft)} days — follow-up readiness matters now.`, evidence: [w.ref] });
  }
  for (const goal of g.nodes.filter((n) => n.kind === "readiness_goal")) {
    const blockers = g.edges.filter((e) => e.to === goal.ref && e.kind === "blocks");
    if (blockers.length) {
      findings.push({ stage: "risk", text: `${goal.label} has ${blockers.length} item${blockers.length === 1 ? "" : "s"} recorded as blockers.`, evidence: [goal.ref, ...blockers.map((e) => e.from)] });
    }
  }

  // 6 CONFIDENCE — whole-case line for the trace; per-item below.
  const caseConfidence = scoreConfidence(g, focus);
  findings.push({ stage: "confidence", text: `${caseConfidence.level.toUpperCase()}: ${caseConfidence.basis}`, evidence: focus ? [focus.ref] : consumerRef });

  // 7-9 RECOMMENDATION / ACTION / EXPECTED OUTCOME — strategy comes ONLY from
  // the injected canonical engine; the default names no strategy.
  const recommendations: ReasonedRecommendation[] = [];
  const targets = (focus ? items.filter((i) => i.ref === focus.ref) : items)
    .filter((i) => String(i.facts.probability) !== "NOT_RECOMMENDED");
  for (const t of targets) {
    const disputed = g.edges.some((e) => e.from === t.ref && e.kind === "disputed_via");
    const itemConfidence = scoreConfidence(g, t); // per-item — the missing-history guard fires
    const canonical = strategyFor ? strategyFor(t.id) : null;
    const basisPhrase = conflictRefs.has(t.ref)
      ? "citing the reporting difference documented above"
      : "stating the specific information you believe is inaccurate or incomplete";
    const rec: ReasonedRecommendation = {
      action: disputed
        ? `Review the response status for ${t.label} and prepare the follow-up round if the tracked window has closed.`
        : canonical
        ? `Draft the first-round dispute for ${t.label} using the recommended strategy (${canonical.label}), ${basisPhrase}.`
        : `Draft the first-round dispute for ${t.label}, ${basisPhrase}.`,
      expectedOutcome: disputed
        ? "The case record advances one round: either a logged response to analyze, or a documented follow-up on an expired window. Outcomes rest with the recipient."
        : "A compliant dispute enters the record and starts the tracked review window (typically 30 days for bureau reinvestigations, subject to statutory exceptions). Outcomes rest with the recipient.",
      confidence: itemConfidence,
      riskFactors: t.facts.isDebtBuyer === true ? ["Debt-buyer accounts often route to furnisher-side follow-up."] : [],
      alternatives: ["Gather supporting documentation first", "Prioritize a different item with stronger evidence"],
      evidence: [t.ref],
      lawRefs: ["fcra_611"],
    };
    findings.push({ stage: "recommendation", text: rec.action, evidence: rec.evidence });
    findings.push({ stage: "action", text: rec.action, evidence: rec.evidence });
    findings.push({ stage: "expected_outcome", text: rec.expectedOutcome, evidence: rec.evidence });
    recommendations.push(rec);
  }

  return { focusRef, findings, recommendations };
}

/** The no-hallucination validator — a trace that fails this is NEVER shown. */
export function validateReasoningTrace(trace: ReasoningTrace, g: CreditGraph): string[] {
  const errors: string[] = [];
  if (trace.focusRef && !g.byRef.has(trace.focusRef)) errors.push(`dangling focusRef ${trace.focusRef}`);
  for (const f of trace.findings) {
    if (f.evidence.length === 0) errors.push(`uncited finding at stage ${f.stage}: "${f.text.slice(0, 60)}"`);
    for (const ref of f.evidence) if (!g.byRef.has(ref)) errors.push(`dangling evidence ref ${ref} at stage ${f.stage}`);
    for (const k of f.lawRefs ?? []) if (!(k in STATUTES)) errors.push(`unknown statute key ${String(k)}`);
    const hit = scanForbiddenLanguage(f.text);
    if (hit) errors.push(`forbidden language at stage ${f.stage} (/${hit}/): "${f.text.slice(0, 60)}"`);
  }
  for (const r of trace.recommendations) {
    if (r.evidence.length === 0) errors.push(`uncited recommendation: "${r.action.slice(0, 60)}"`);
    for (const text of [r.action, r.expectedOutcome, ...r.riskFactors, ...r.alternatives]) {
      const hit = scanForbiddenLanguage(text);
      if (hit) errors.push(`forbidden language in recommendation (/${hit}/): "${text.slice(0, 60)}"`);
    }
    if (r.alternatives.length === 0) errors.push("recommendation without alternatives");
    if (!r.confidence.basis) errors.push("confidence without a stated basis");
  }
  return errors;
}
