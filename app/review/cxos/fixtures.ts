// CXOS Phase 1A-CX2 (C) — Mission Boot's own MissionEntry props.
//
// TRUTH BOUNDARY: only repository-backed fixtures already used by the
// review stages. This is a VERBATIM copy of the CONSUMER fixture in
// app/review/mission-control/stage.tsx (same firstName, identity, role,
// plan, health, counts, and Kai line) — duplicated, not reinvented, because
// that module does not export it and stage.tsx is a prohibited internal for
// this packet (compose via public exports only). If that fixture is ever
// retuned, update this copy to match — scripts/cxos-walkthrough.test.ts
// checks that this stays the same cxreview-* identity family, not the
// literal wording, so a deliberate retune here will not fail the guard by
// itself.
import type { MissionEntryProps } from "@/components/cxos/mission/MissionEntry";

export const MISSION_BOOT_FIXTURE: Omit<
  MissionEntryProps,
  "forceVariant" | "forceReview"
> = {
  firstName: "Jordan",
  identity: "cxreview-consumer",
  role: "OPERATOR",
  plan: "premium",
  health: [
    { label: "Response windows", status: "green" },
    { label: "Mail pipeline", status: "green" },
    { label: "Timeline health", status: "amber" },
  ],
  tasksCount: 3,
  waitingCount: 2,
  hasReport: true,
  nextAction:
    "Review the drafted Round 2 letter for the auto-loan tradeline — the reinvestigation window closes in 9 days.",
};
