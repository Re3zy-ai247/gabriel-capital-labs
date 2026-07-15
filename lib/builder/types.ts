// Credit Builder Operating System (Sprint XVIII, ADR-0018). CreditVector no longer
// ends when negatives are removed — it guides the customer toward EXCELLENT credit.
// Every recommendation is deterministic, explainable, and cites the data that
// produced it. Pure orchestration over the CVI snapshot + readiness (already
// loaded). No AI, no fabricated recommendations; when the data to evaluate a
// module isn't on file, the recommendation says "Not enough information to
// evaluate." (never invented).

export type BuilderStatus =
  | "recommended"     // an action that would strengthen the file
  | "in_progress"     // already being worked (e.g. derogatory items being disputed)
  | "on_track"        // this factor already looks healthy
  | "not_applicable"
  | "unavailable"     // the data to evaluate this isn't on file (honest)
  | "locked";         // a future module

// The literal string the directive requires when required info is missing.
export const NOT_ENOUGH_INFO = "Not enough information to evaluate.";

export interface BuilderRecommendation {
  id: string;
  label: string;
  status: BuilderStatus;
  why: string;                  // Kai's plain-English reason (or NOT_ENOUGH_INFO)
  currentProfile: string;       // reference to the current profile
  observed: string;             // the observed data, cited
  expectedImprovement: string;  // what the action DOES — never a promised score
  dependencies: string;         // or "None"
  estimatedTiming: string;      // deterministic ("reports monthly") — never a fabricated date
  evidence: string;             // the exact data point behind this
  action: { text: string; href: string } | null;
}

export interface BuilderOS {
  summary: string;
  recommendations: BuilderRecommendation[];  // the 11 builder modules
  recommendedCount: number;
  onTrackCount: number;
  note: string;
}
