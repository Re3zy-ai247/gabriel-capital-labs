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
