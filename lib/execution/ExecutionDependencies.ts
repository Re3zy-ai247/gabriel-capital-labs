// Execution Engine — dependency resolution (Sprint XX, ADR-0020). Answers "which
// actions depend on other actions?" and "which are blocked?" deterministically from
// the §611 dispute lifecycle, reusing the Mission Engine's own `mission.dependency`
// string as the authoritative blocking reason. No inference, no invented edges.
import type { Mission, MissionState } from "@/lib/missionEngine";

// The natural §611 lifecycle order, keyed by mission.type. Each stage names what it
// waits on (upstream) and what it unblocks (downstream) — the real, fixed sequence
// a dispute travels: complete profile → approve → mail → wait → review → escalate.
const LIFECYCLE: Record<string, { dependsOn: string[]; blocks: string[] }> = {
  address_consistency: { dependsOn: [], blocks: ["Mailing your approved disputes"] },
  approve_campaign: { dependsOn: ["A complete mailing address"], blocks: ["Mailing", "The reinvestigation window", "Round 2"] },
  dispute: { dependsOn: ["A complete mailing address"], blocks: ["Mailing", "The reinvestigation window"] },
  wait_response: { dependsOn: ["A mailed dispute"], blocks: ["Round 2", "CFPB / state-AG escalation"] },
  round_2: { dependsOn: ["A returned bureau/furnisher response"], blocks: ["A stronger follow-up round"] },
  monitor_deadline: { dependsOn: ["A lapsed §611 window"], blocks: [] },
  escalate_cfpb: { dependsOn: ["An overdue reinvestigation"], blocks: [] },
  builder: { dependsOn: [], blocks: [] },
  business_credit_setup: { dependsOn: ["The Business Credit module"], blocks: [] },
  upload_reports: { dependsOn: [], blocks: ["Your entire mission queue"] },
};

const BLOCKED_STATES: ReadonlySet<MissionState> = new Set<MissionState>(["blocked", "locked"]);

export interface ExecutionDeps {
  dependsOn: string[];         // what must clear first (upstream)
  blocks: string[];            // what this unblocks (downstream)
  blockingReason: string | null; // set only when this item is itself blocked/locked
}

export function resolveDeps(m: Mission): ExecutionDeps {
  const lc = LIFECYCLE[m.type] ?? { dependsOn: [], blocks: [] };
  // The Mission Engine's own dependency string is the authoritative extra upstream.
  const dependsOn = m.dependency && !lc.dependsOn.includes(m.dependency)
    ? [...lc.dependsOn, m.dependency]
    : lc.dependsOn;
  return {
    dependsOn,
    blocks: lc.blocks,
    // A blocked/locked mission's blocking reason is exactly its (already computed)
    // dependency — never a fabricated one.
    blockingReason: BLOCKED_STATES.has(m.state) ? (m.dependency ?? "A prerequisite module or step") : null,
  };
}
