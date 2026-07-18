// Credit Intelligence Platform (CVI) — public surface (Sprint XV, ADR-0015).
// Every future module imports from "@/lib/intelligence" and never re-implements
// intelligence. Orchestration only; built inside CreditVector, extraction-ready.
export * from "./types";
export { loadSnapshot, type IntelSnapshot } from "./snapshot";
export { assembleIntelligence, creditIntelligence } from "./api";
export {
  creditProfile, creditHealth, riskAnalysis, opportunities, timelineIntel,
  readiness, builderIntelligence, businessReadiness, estimatedReadinessBand,
} from "./modules";
// Phase C — Kai Intelligence Architecture (graph · reasoning · memory · planner
// · proactive · portfolio). Pure modules; every recommendation evidence-backed.
export { buildCreditGraph, nodeRef, type CreditGraph, type CreditNode, type CreditEdge, type GraphInput } from "./graph";
export { projectGraphInput, type CaseRows, type TradelineRow, type LetterRow } from "./graphProject";
export { graphInputFromSnapshot } from "./graphLoader";
export { reason, validateReasoningTrace, scoreConfidence, scanForbiddenLanguage, type ReasoningTrace, type ReasonedRecommendation, type KaiConfidence, type Finding, type StrategyHook } from "./reasoning";
export { projectCaseMemory, caseMemoryStoreEnabled, type CaseMemory, type MemoryEntry } from "./caseMemory";
export { composeStrategy, GOAL_DISPLAY_LABELS, type StrategicPlan, type StrategyGoal, type PlanStep } from "./planner";
export { scanProactive, validateSignals, toNotifyPlanInput, type ProactiveSignal, type SignalKind } from "./proactive";
export { assessPortfolio, clientRiskScore, type PortfolioIntelligence, type RosterClientRow } from "./portfolio";
