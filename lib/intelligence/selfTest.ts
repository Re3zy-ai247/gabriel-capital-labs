// Kai reasoning SELF-TEST (Phase C) — CVI module, the ONE canonical synthetic
// fixture. Consumed by lib/platform/health.ts (dashboard) and the guard script
// so the platform layer never embeds Kai domain fixtures (ownership boundary).
// Everything derived from this fixture is SYNTHETIC and must be labeled so
// wherever displayed — it proves the pipeline works; it measures no customer.
import { buildCreditGraph, type GraphInput } from "./graph";
import { reason, validateReasoningTrace } from "./reasoning";
import { projectCaseMemory } from "./caseMemory";
import { scanProactive, validateSignals } from "./proactive";

export const SELF_TEST_CASE: GraphInput = {
  userId: "healthcheck",
  tradelines: [
    { id: "t1", creditorName: "Synthetic Collections LLC", accountType: "collection", probability: "HIGH", balance: 120000, bureaus: ["equifax", "experian"], isDebtBuyer: true },
    { id: "t2", creditorName: "Synthetic Bank", accountType: "charge-off", probability: "MEDIUM", balance: 80000, bureaus: ["equifax", "experian", "transunion"] },
  ],
  letters: [{ id: "l1", tradelineId: "t1", recipient: "equifax", round: 1, status: "mailed", responseOutcome: "verified", responseAt: "2026-07-01" }],
  openWindows: [{ letterId: "l1", recipient: "equifax", daysElapsed: 25, daysLeft: 5, recipientType: "bureau" }],
  readinessGoals: [{ id: "g1", label: "Mortgage readiness", level: "not_ready", blockers: ["t1", "t2"] }],
};

export function kaiSelfTest() {
  const g = buildCreditGraph(SELF_TEST_CASE);
  const trace = reason(g);
  const memory = projectCaseMemory(g);
  const signals = scanProactive(g, memory);
  const errors = [...validateReasoningTrace(trace, g), ...validateSignals(signals, g)];
  const cited = trace.findings.filter((f) => f.evidence.length > 0).length;
  return {
    pass: errors.length === 0,
    findings: trace.findings.length,
    recommendations: trace.recommendations.length,
    citedFindings: cited,
    signals: signals.length,
    signalsCarryReceipts: signals.every((s) => s.evidence.length > 0),
    errors,
  };
}
