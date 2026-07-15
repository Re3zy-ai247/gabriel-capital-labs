// Financial Mission Engine (Sprint XVI, ADR-0016). NOT another intelligence
// engine — an ORCHESTRATION engine. It ranks the opportunities the Credit
// Intelligence Platform (CVI) already computed into ONE prioritized mission queue,
// assigns deterministic state/priority/timeline/rewards/progress, and answers
// "what should I do next?" automatically. No new scoring, no new intelligence, no
// fabricated dates — everything derives from CVI + Mission Control (already loaded).
import type { Confidence } from "@/lib/intelligence";

export type MissionState =
  | "locked" | "available" | "waiting" | "blocked" | "in_progress"
  | "needs_review" | "completed" | "deferred" | "expired";

export type PriorityBand = "critical" | "high" | "medium" | "low";
export type Level = "low" | "medium" | "high";

export interface Mission {
  id: string;
  type: string;             // e.g. "round_2", "approve_campaign", "wait_response"
  title: string;
  reason: string;
  state: MissionState;
  priority: number;         // deterministic rank score (higher = sooner)
  band: PriorityBand;
  href: string;
  deadline: string | null;  // derived from an existing window — never invented
  dependency: string | null;
  effort: Level;
  impact: Level;
  unlocks: string | null;
  evidence: string;         // references actual data (the CVI opportunity detail)
  confidence: Confidence;
  progress: number | null;  // 0-100 for time-boxed missions, else null
}

export interface MissionTimelineEntry { when: string; title: string; state: MissionState }
export interface MissionReward { label: string; value: string }  // factual, never points
export interface MissionProgressSummary {
  completedCount: number;
  openCount: number;
  overallPct: number | null;      // mission completion, not a credit score
  caseHealthNote: string;
  estimatedCompletion: string;
}

export interface FinancialMission {
  today: Mission | null;          // the single most important thing to do now
  queue: Mission[];               // the full prioritized queue
  waiting: Mission[];             // what's in flight, no action needed
  automatic: string[];            // what happens automatically (reused from Mission Control)
  timeline: MissionTimelineEntry[];
  completed: string[];            // append-only projection over the real event history
  rewards: MissionReward[];
  progress: MissionProgressSummary;
}
