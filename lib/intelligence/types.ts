// Credit Intelligence Platform (CVI) — Sprint XV. The canonical internal
// intelligence layer: every future module (Funding Hub, Credit Builder, Business
// Credit, Monitoring, Mobile, AI API) asks THIS, once, and never computes its own
// intelligence. Pure orchestration over the existing deterministic engines — no
// new scoring, no duplicated business logic, no AI, no fabrication. When the data
// to answer a question isn't in the user's file, the platform SAYS SO (confidence
// = "insufficient") rather than invent a number.

// Confidence reflects DATA COMPLETENESS — how much of the needed evidence the
// file actually contains — NOT an outcome probability (CROA: never a prediction).
export type Confidence = "high" | "moderate" | "low" | "insufficient";

export interface Metric { key: string; label: string; value: string; note?: string }
export interface Reason { text: string; evidence?: string }
export interface Action { text: string; href?: string }

export type ReadinessLevel = "ready" | "almost" | "not_ready" | "unknown";

// The single envelope EVERY module returns (the directive's design rule).
export interface IntelligenceModule {
  summary: string;
  metrics: Metric[];
  reasons: Reason[];
  recommendedActions: Action[];
  confidence: Confidence;
  history: string | null;   // gate-free own verified-outcome history line, or null
  nextSteps: string[];
}

export interface ReadinessResult {
  goal: string;
  label: string;
  level: ReadinessLevel;
  reasons: Reason[];
  nextActions: Action[];
  estimatedTimeline: string;   // deterministic, from statutory windows — never an approval odds
  confidence: Confidence;
}

export interface RiskItem {
  key: string;
  severity: "high" | "medium" | "low";
  title: string;
  evidence: string;            // references ACTUAL data on file
  recommendedAction: string;
}

export interface Opportunity {
  key: string;
  title: string;
  detail: string;
  href: string;
  kind: "dispute" | "campaign" | "deadline" | "builder" | "funding" | "business" | "profile";
}

// The full platform response — what /api/intelligence returns and what any module
// consumes. Additive: modules can read only the slice they need.
export interface CreditIntelligence {
  generatedAtNote: string;      // provenance line (deterministic, no timestamp fabrication)
  hasReport: boolean;
  profile: IntelligenceModule;
  health: IntelligenceModule;
  risk: IntelligenceModule;
  opportunities: Opportunity[];
  readiness: ReadinessResult[]; // credit + funding + business goals, one engine
  builder: IntelligenceModule;
  business: IntelligenceModule;
  timeline: { past: string[]; present: string[]; upcoming: string[] };
}
