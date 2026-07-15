// Financial Roadmap Engine (Sprint XVII, ADR-0017). Answers "where is my credit
// journey heading?" — a deterministic roadmap of stages from today through future
// milestones. PURE orchestration over CVI + the Mission Engine + Mission Control
// (all already loaded on the dashboard). No new intelligence, no fabricated dates,
// no promised outcomes; when data is unavailable a stage says so honestly.

export type StageStatus =
  | "completed"     // this stretch of the journey is done
  | "current"       // where you are right now (the anchor)
  | "active"        // in progress
  | "waiting"       // in flight, waiting on an external party
  | "upcoming"      // ahead of you, not started
  | "locked"        // a future module (honestly not available yet)
  | "unavailable";  // the data to assess this isn't on file (disclosed, never faked)

export interface RoadmapMilestone { text: string; done: boolean }

export interface RoadmapStage {
  id: string;
  label: string;
  status: StageStatus;
  summary: string;
  milestones: RoadmapMilestone[];
  evidence: string;        // references actual data on file
  href: string;
}

export interface FinancialRoadmap {
  stages: RoadmapStage[];
  progressPct: number | null;   // how far along the journey (never a credit score)
  currentStageId: string | null;
  nextStageId: string | null;
  note: string;                 // deterministic provenance line
}
