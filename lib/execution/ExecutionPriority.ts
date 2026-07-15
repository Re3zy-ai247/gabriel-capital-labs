// Execution Engine — deterministic priority ladder (Sprint XX, ADR-0020). It does
// NOT score and does NOT predict. Every mission the Mission Engine already ranked
// is classified into the FIRST matching rung of the founder's fixed ladder; the
// existing `mission.priority` is only ever used as a tie-break WITHIN a rung. Fully
// reproducible: same mission → same rung, always.
import type { Mission, PriorityBand } from "@/lib/missionEngine";

// The ladder, in the exact order the directive specifies. Lower index = sooner.
export type LadderKey =
  | "legal_deadline"
  | "open_investigation"
  | "waiting_bureau"
  | "waiting_consumer"
  | "waiting_creditor"
  | "campaign_dependency"
  | "funding_dependency"
  | "builder_dependency"
  | "mortgage_dependency"
  | "business_dependency"
  | "timeline_dependency"
  | "outcome_dependency";

export const LADDER: readonly LadderKey[] = [
  "legal_deadline", "open_investigation", "waiting_bureau", "waiting_consumer",
  "waiting_creditor", "campaign_dependency", "funding_dependency", "builder_dependency",
  "mortgage_dependency", "business_dependency", "timeline_dependency", "outcome_dependency",
];

// mission.type → ladder rung. Every type the Mission Engine can emit is mapped
// explicitly; anything unforeseen sinks to the last rung rather than being invented.
const TYPE_TIER: Record<string, LadderKey> = {
  monitor_deadline: "legal_deadline",
  escalate_cfpb: "legal_deadline",
  round_2: "open_investigation",
  wait_response: "waiting_bureau",
  upload_reports: "waiting_consumer",
  address_consistency: "waiting_consumer",
  dispute: "campaign_dependency",
  approve_campaign: "campaign_dependency",
  builder: "builder_dependency",
  business_credit_setup: "business_dependency",
};

const TIER_REASON: Record<LadderKey, string> = {
  legal_deadline: "A statutory §611 window has already passed — this is time-sensitive.",
  open_investigation: "An investigation has come back and is waiting on your next move.",
  waiting_bureau: "In flight — a mailed dispute is inside the bureau's reinvestigation window.",
  waiting_consumer: "Waiting on you to provide something before anything else can proceed.",
  waiting_creditor: "In flight — waiting on a creditor/furnisher response.",
  campaign_dependency: "Sequenced inside your dispute campaign flow.",
  funding_dependency: "Gated by your funding readiness.",
  builder_dependency: "A credit-building step — optional, strengthens the file over time.",
  mortgage_dependency: "Gated by your mortgage readiness.",
  business_dependency: "A future business-credit module.",
  timeline_dependency: "Sequenced by your case timeline.",
  outcome_dependency: "Sequenced by a prior outcome.",
};

export interface ExecutionPriority {
  tier: LadderKey;
  rank: number;          // LADDER index — the primary, deterministic sort key
  sub: number;           // mission.priority — tie-break WITHIN a rung only
  band: PriorityBand;    // reused from the Mission Engine, never recomputed
  reason: string;        // why this rung, in plain English
}

export function classifyPriority(m: Mission): ExecutionPriority {
  const tier = TYPE_TIER[m.type] ?? "outcome_dependency";
  return { tier, rank: LADDER.indexOf(tier), sub: m.priority, band: m.band, reason: TIER_REASON[tier] };
}

// Total order across the whole queue: rung first, then the Mission Engine's own
// rank, then id — a stable, reproducible comparator with no randomness.
export function comparePriority(a: ExecutionPriority, b: ExecutionPriority, aId: string, bId: string): number {
  return a.rank - b.rank || b.sub - a.sub || aId.localeCompare(bId);
}
