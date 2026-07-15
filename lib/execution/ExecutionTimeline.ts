// Execution Engine — deterministic timelines (Sprint XX, ADR-0020). NEVER a
// fabricated date and NEVER an approval-odds estimate. Per-item timing is reused
// straight from the Mission Engine's `mission.deadline` (already derived from the
// §611 window), falling back to a state-derived label. The case timeline is the
// Mission Engine's own timeline, unchanged.
import type { Mission, FinancialMission, MissionTimelineEntry } from "@/lib/missionEngine";

export function itemTimeline(m: Mission): string {
  if (m.deadline) return m.deadline; // e.g. "12 days left" — already window-derived
  switch (m.type) {
    case "monitor_deadline":
    case "escalate_cfpb":
      return "Overdue now";
    case "builder":
      return "Ongoing — reports monthly";
    case "business_credit_setup":
      return "Not scheduled — future module";
    default:
      break;
  }
  switch (m.state) {
    case "available":
    case "needs_review":
    case "in_progress":
      return "Ready now";
    case "waiting":
      return "In its statutory window";
    case "locked":
      return "Not available yet";
    default:
      return "—";
  }
}

// The case-level timeline is the Mission Engine's — reused verbatim, no new dates.
export function caseTimeline(mission: FinancialMission): MissionTimelineEntry[] {
  return mission.timeline;
}
