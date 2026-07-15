// Execution Engine — cost of inaction (Sprint XX, ADR-0020). Answers "what happens
// if I do nothing?" with the FACTUAL consequence of leaving each item alone — never
// a prediction, never a score forecast, never fear-based copy. The case-level line
// is counted directly from the snapshot's real open/overdue windows.
import type { Mission } from "@/lib/missionEngine";
import type { IntelSnapshot } from "@/lib/intelligence";

const IF_IGNORED: Record<string, string> = {
  monitor_deadline: "The window has already passed. Left alone, the unverified item simply stays on your report — escalation is your remaining lever.",
  escalate_cfpb: "The window has already passed. Left alone, the unverified item simply stays on your report — escalation is your remaining lever.",
  round_2: "Skip the follow-up and the furnisher's response stands unchallenged; the item stays as reported.",
  dispute: "Left unmailed, no §611 reinvestigation clock starts and nothing is under review.",
  approve_campaign: "Left unapproved, no §611 reinvestigation clock starts and nothing is under review.",
  address_consistency: "Without a complete mailing address we can't generate mailable letters, so disputes can't go out.",
  wait_response: "Nothing to do — but if the window lapses with no answer, escalation becomes available.",
  upload_reports: "Nothing can start until a report is on file.",
  builder: "Optional. Skipping it doesn't harm your case; acting strengthens the file over time.",
  business_credit_setup: "A future module — nothing is required from you now.",
};

export function ifIgnored(m: Mission): string {
  return IF_IGNORED[m.type] ?? "No immediate consequence — this item is informational.";
}

// The one-line case risk, counted from REAL windows on file (never predicted). Uses
// the snapshot the platform already loaded: overdue count and total open windows.
export function caseRisk(snap: IntelSnapshot): { level: "high" | "medium" | "low"; note: string } {
  const overdue = snap.overdueWindows;
  const open = snap.openWindows.length;
  if (overdue > 0) {
    return { level: "high", note: `${overdue} response window${overdue === 1 ? " has" : "s have"} already passed — escalation is available and time-sensitive.` };
  }
  const closing = snap.openWindows.filter((w) => w.daysLeft > 0 && w.daysLeft <= 5).length;
  if (closing > 0) {
    return { level: "medium", note: `${closing} window${closing === 1 ? "" : "s"} closing within 5 days — keep an eye on your mail.` };
  }
  if (open > 0) {
    return { level: "low", note: `${open} dispute${open === 1 ? " is" : "s are"} in flight and inside the statutory window — no action needed.` };
  }
  return { level: "low", note: "No open response windows — nothing is at risk of lapsing." };
}
