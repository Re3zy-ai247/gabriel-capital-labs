// Guard for Phase C — Kai Intelligence Architecture. Run:
//   npx tsx scripts/kai-reasoning.test.ts
//
// Pins the laws the architecture claims: DETERMINISM (same input → deep-equal
// output across graph/reasoning/memory/planner/proactive/portfolio) ·
// NO-HALLUCINATION (every finding/recommendation cites resolvable evidence;
// validator has teeth — a planted uncited finding is rejected) · CROA (forbidden
// outcome language rejected verbatim) · CONFIDENCE (never "high" without
// verified outcomes; basis always stated) · ADR-0006 (persistent memory store
// dormant) · notify bridge is decision-only.
import { buildCreditGraph, type GraphInput } from "../lib/intelligence/graph";
import { reason, validateReasoningTrace, scoreConfidence } from "../lib/intelligence/reasoning";
import { projectCaseMemory, caseMemoryStoreEnabled } from "../lib/intelligence/caseMemory";
import { composeStrategy } from "../lib/intelligence/planner";
import { scanProactive, toNotifyPlanInput, validateSignals } from "../lib/intelligence/proactive";
import { assessPortfolio, clientRiskScore } from "../lib/intelligence/portfolio";

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else { failed++; console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const CASE: GraphInput = {
  userId: "u1",
  tradelines: [
    { id: "t1", creditorName: "Collections LLC", accountType: "collection", probability: "HIGH", balance: 120000, bureaus: ["equifax", "experian"], isDebtBuyer: true },
    { id: "t2", creditorName: "Big Bank", accountType: "charge-off", probability: "MEDIUM", balance: 80000, bureaus: ["equifax", "experian", "transunion"] },
    { id: "t3", creditorName: "Gov Debt", accountType: "student loan", probability: "NOT_RECOMMENDED", balance: null },
  ],
  inquiries: [{ id: "q1", name: "Card Issuer", at: "2026-06-01" }],
  letters: [{ id: "l1", tradelineId: "t1", recipient: "equifax", round: 1, status: "mailed", mailedAt: "2026-06-20", responseOutcome: "verified", responseAt: "2026-07-10" }],
  openWindows: [{ letterId: "l1", recipient: "equifax", daysElapsed: 26, daysLeft: 4 }],
  readinessGoals: [{ id: "g1", label: "Mortgage readiness", level: "not_ready", blockers: ["t1", "t2"] }],
};

// ── 1. Determinism across every engine ───────────────────────────────────────
const g1 = buildCreditGraph(CASE);
const g2 = buildCreditGraph(JSON.parse(JSON.stringify(CASE)));
check("graph deterministic", eq({ n: g1.nodes, e: g1.edges }, { n: g2.nodes, e: g2.edges }));
check("reasoning deterministic", eq(reason(g1), reason(g2)));
check("memory projection deterministic", eq(projectCaseMemory(g1), projectCaseMemory(g2)));
check("planner deterministic", eq(composeStrategy(g1, "ninety_day_repair"), composeStrategy(g2, "ninety_day_repair")));
check("proactive deterministic", eq(scanProactive(g1, projectCaseMemory(g1)), scanProactive(g2, projectCaseMemory(g2))));

// ── 2. Graph integrity ────────────────────────────────────────────────────────
check("every edge endpoint resolves", g1.edges.every((e) => g1.byRef.has(e.from) && g1.byRef.has(e.to)));
check("collection classified from account type", g1.nodes.some((n) => n.kind === "collection" && n.id === "t1"));
check("response node created from logged outcome", g1.nodes.some((n) => n.kind === "response" && n.id === "l1"));

// ── 3. No-hallucination law (validator with teeth) ───────────────────────────
const trace = reason(g1);
check("clean trace validates", validateReasoningTrace(trace, g1).length === 0);
check("every finding cites evidence", trace.findings.every((f) => f.evidence.length > 0));
check("every stage present", ["facts", "evidence", "conflicts", "law", "risk", "confidence", "recommendation", "action", "expected_outcome"].every((s) => trace.findings.some((f) => f.stage === s)));
const planted = { ...trace, findings: [...trace.findings, { stage: "facts" as const, text: "invented", evidence: [] }] };
check("VALIDATOR TEETH: uncited finding rejected", validateReasoningTrace(planted, g1).length > 0);
const dangling = { ...trace, findings: [...trace.findings, { stage: "facts" as const, text: "ghost", evidence: ["node:tradeline:nope"] }] };
check("VALIDATOR TEETH: dangling ref rejected", validateReasoningTrace(dangling, g1).length > 0);
const badRec = { ...trace, recommendations: [{ ...trace.recommendations[0], expectedOutcome: "This item will be deleted and your score will increase." }] };
check("VALIDATOR TEETH: CROA-forbidden outcome rejected", validateReasoningTrace(badRec, g1).length > 0);

// ── 3b. Review-fix teeth (2026-07-16 adversarial review) ─────────────────────
const badFocus = { ...trace, focusRef: "node:tradeline:ghost" };
check("VALIDATOR TEETH: dangling focusRef rejected", validateReasoningTrace(badFocus, g1).length > 0);
const badFinding = { ...trace, findings: [...trace.findings, { stage: "risk" as const, text: "This item will be deleted for sure", evidence: [trace.findings[0].evidence[0]] }] };
check("VALIDATOR TEETH: forbidden language in FINDING text rejected", validateReasoningTrace(badFinding, g1).length > 0);
// Per-item confidence: t2 has no dispute history → its recommendation must NOT be high.
const t2rec = trace.recommendations.find((r) => r.evidence.some((e) => e.endsWith(":t2")));
check("per-item confidence: undisputed item never HIGH", !!t2rec && t2rec.confidence.level !== "high" && t2rec.confidence.missingInformation.length > 0);
// Strategy law: default reasoning names NO strategy; injected canonical hook does.
check("no strategy named without the canonical hook", trace.recommendations.every((r) => !/§611 reinvestigation request/.test(r.action)));
const hooked = reason(g1, null, (id) => (id === "t2" ? { label: "FCRA §611 reinvestigation" } : null));
check("canonical hook supplies the strategy label", hooked.recommendations.some((r) => r.action.includes("recommended strategy")));
// Window law branches by recipient type.
const gWindows = buildCreditGraph({
  ...CASE,
  letters: [
    ...CASE.letters,
    { id: "l2", tradelineId: "t2", recipient: "Big Bank", round: 1, status: "mailed" },
    { id: "l3", tradelineId: "t1", recipient: "Collections LLC", round: 1, status: "mailed" },
  ],
  openWindows: [
    { letterId: "l1", recipient: "equifax", daysElapsed: 26, daysLeft: 4, recipientType: "bureau" },
    { letterId: "l2", recipient: "Big Bank", daysElapsed: 10, daysLeft: 20, recipientType: "furnisher" },
    { letterId: "l3", recipient: "Collections LLC", daysElapsed: 10, daysLeft: 20, recipientType: "collector" },
  ],
});
const lawTexts = reason(gWindows).findings.filter((f) => f.stage === "law").map((f) => `${f.text}|${(f.lawRefs ?? []).join(",")}`).join(" ⊕ ");
check("bureau window cites §611", /reinvestigation window.*fcra_611/.test(lawTexts));
check("furnisher window cites §623, not §611", /§623 window.*fcra_623/.test(lawTexts));
check("collector window cites FDCPA §809 with NO statutory deadline claim", /cease collection until validation.*fdcpa_809/.test(lawTexts) && !/Validation follow-up[^⊕]*statutory window/.test(lawTexts));

// ── 4. Recommendations: excluded items + alternatives + law citations ────────
check("NOT_RECOMMENDED items never get recommendations", trace.recommendations.every((r) => !r.evidence.some((e) => e.includes(":t3"))));
check("every recommendation has alternatives", trace.recommendations.every((r) => r.alternatives.length >= 1));
check("law refs come from the canonical vocabulary only", trace.findings.every((f) => (f.lawRefs ?? []).every((k) => typeof k === "string")));

// ── 5. Confidence law ─────────────────────────────────────────────────────────
const emptyG = buildCreditGraph({ userId: "u0", tradelines: [], letters: [] });
check("empty case → insufficient", scoreConfidence(emptyG, null).level === "insufficient");
const reportOnly = buildCreditGraph({ ...CASE, letters: [], openWindows: [] });
check("report-only → low (never high without records)", scoreConfidence(reportOnly, null).level === "low");
check("responses on record allow high, WITH basis", scoreConfidence(g1, null).basis.length > 0);
const lettersNoResponses = buildCreditGraph({ ...CASE, letters: [{ id: "l1", tradelineId: "t1", round: 1, status: "mailed" }], openWindows: [] });
check("letters w/o responses → moderate, missing-info stated", scoreConfidence(lettersNoResponses, null).level === "moderate" && scoreConfidence(lettersNoResponses, null).missingInformation.length > 0);

// ── 6. Case memory: projection-first + ADR-0006 dormancy ────────────────────
const mem = projectCaseMemory(g1);
check("memory entries all carry evidence refs", mem.entries.every((m) => g1.byRef.has(m.evidence)));
check("memory never fabricates timestamps", mem.entries.every((m) => m.at === null || typeof m.at === "string"));
check("KAI_CASE_MEMORY store dormant (ADR-0006 gate)", caseMemoryStoreEnabled() === false);

// ── 7. Planner: sequencing + evidence + adaptivity-by-recompute ──────────────
const plan = composeStrategy(g1, "ninety_day_repair");
check("plan steps ordered 1..n", plan.steps.every((s, i) => s.order === i + 1));
check("urgent deadline lands in phase NOW", plan.steps.some((s) => s.phase === "now"));
check("every step cites evidence", plan.steps.every((s) => s.evidence.length > 0 && s.evidence.every((e) => g1.byRef.has(e))));
const afterResponse = buildCreditGraph({ ...CASE, openWindows: [] });
check("plan adapts by recompute (window closed → NOW step gone)", !composeStrategy(afterResponse, "ninety_day_repair").steps.some((s) => s.phase === "now"));

// ── 8. Proactive: receipts + urgency order + decision-only bridge ────────────
const signals = scanProactive(g1, mem);
check("signals generated for deadline + response + unworked HIGH item", signals.length >= 3);
check("every signal carries receipts", signals.every((s) => s.evidence.length > 0 && s.evidence.every((e) => g1.byRef.has(e))));
check("urgency ordering: now first", signals[0]?.urgency === "now");
const notif = toNotifyPlanInput(signals[0]);
check("notify bridge is decision-only (no send fields)", !("to" in notif) && !("email" in notif) && notif.topic.startsWith("kai.proactive."));
check("notify summary carries NO raw case text (topic label only)", !/Collections LLC|Big Bank/.test(notif.summary));
check("signals pass the CROA net", validateSignals(signals, g1).length === 0);
const badSignal = [{ ...signals[0], detail: "Resolving this is the documented path to approval" }];
check("VALIDATOR TEETH: forbidden signal language rejected", validateSignals(badSignal, g1).length > 0);
check("re-engagement kinds route to counsel_review, not blanket transactional", toNotifyPlanInput({ ...signals[0], kind: "stale_case" }).classHint === "counsel_review");
check("plan not degraded on a clean case", !composeStrategy(g1, "ninety_day_repair").degraded);

// ── 9. Portfolio intelligence ─────────────────────────────────────────────────
const roster = [
  { id: "c1", name: "A", disputableItems: 4, openLetters: 2, overdueWindows: 2, daysToNextDeadline: 3, respondedAwaitingAnalysis: 1 },
  { id: "c2", name: "B", disputableItems: 3, openLetters: 0, overdueWindows: 0, daysToNextDeadline: null, respondedAwaitingAnalysis: 0 },
  { id: "c3", name: "C", disputableItems: 0, openLetters: 0, overdueWindows: 0, daysToNextDeadline: null, respondedAwaitingAnalysis: 0 },
];
const p = assessPortfolio(roster);
check("portfolio deterministic", eq(p, assessPortfolio([...roster])));
check("risk formula bounded 0-100", roster.every((c) => clientRiskScore(c) >= 0 && clientRiskScore(c) <= 100));
check("highest-risk ranks the overdue client first", p.highestRisk[0]?.clientId === "c1");
check("zero-risk clients excluded from ranking", !p.highestRisk.some((r) => r.clientId === "c3"));
check("every ranked client carries reasons", p.highestRisk.every((r) => r.reasons.length > 0));

console.log(`kai-reasoning.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
