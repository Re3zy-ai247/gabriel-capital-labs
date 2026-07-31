// CXOS Phase 6 — Agency Command Founder Review fixtures.
//
// Every value in this module is invented, deterministic, and presentation-only.
// The fixtures do not correspond to a person, customer, agency, subscription,
// legal deadline, billing record, or production capability.

export type AgencyFixtureState =
  | "populated"
  | "empty"
  | "loading"
  | "unavailable"
  | "error"
  | "permission"
  | "capacity";

export type AgencyQueueKind =
  | "responses"
  | "follow-ups"
  | "campaigns"
  | "mail"
  | "intake";

export interface AgencyQueueItem {
  id: string;
  rank: string;
  workspace: string;
  kind: AgencyQueueKind;
  label: string;
  marker: string;
  reason: string;
  receipt: string;
  nextReview: string;
}

export interface AgencyPortfolioItem {
  id: string;
  workspace: string;
  region: string;
  workState: string;
  reportedItems: string;
  letterRecord: string;
  latestRound: string;
  timing: string;
  coverage: string;
}

export interface AgencyHealthDriver {
  label: string;
  value: string;
  note: string;
}

export interface AgencyTeamSeat {
  id: string;
  role: string;
  assigned: string;
  load: string;
  note: string;
}

export const AGENCY_FIXTURE_STATES: {
  key: AgencyFixtureState;
  label: string;
}[] = [
  { key: "populated", label: "Populated" },
  { key: "empty", label: "Empty" },
  { key: "loading", label: "Loading" },
  { key: "unavailable", label: "Unavailable" },
  { key: "error", label: "Error" },
  { key: "permission", label: "Permission denied" },
  { key: "capacity", label: "Capacity reached" },
];

export const AGENCY_QUEUE_FILTERS: {
  key: "all" | AgencyQueueKind;
  label: string;
}[] = [
  { key: "all", label: "All work" },
  { key: "responses", label: "Responses" },
  { key: "follow-ups", label: "Follow-ups" },
  { key: "campaigns", label: "Campaigns" },
  { key: "mail", label: "Mail" },
  { key: "intake", label: "Intake" },
];

export const AGENCY_QUEUE: AgencyQueueItem[] = [
  {
    id: "response-014",
    rank: "01",
    workspace: "Client 014",
    kind: "responses",
    label: "Response decision",
    marker: "Review next",
    reason:
      "A bureau response is displayed in the fixture; an operator decision is not recorded.",
    receipt:
      "Displayed sources: response record · mail receipt · workspace coverage",
    nextReview:
      "Inspect the displayed response and verify the source record before choosing any next step.",
  },
  {
    id: "follow-up-027",
    rank: "02",
    workspace: "Client 027",
    kind: "follow-ups",
    label: "Follow-up review",
    marker: "Marker passed",
    reason:
      "An estimated follow-up marker has passed in the fixture. It is not a legal deadline.",
    receipt:
      "Displayed sources: logged mailed date · response status · fixture timing marker",
    nextReview:
      "Confirm delivery or receipt, response status, and applicable timing before acting.",
  },
  {
    id: "campaign-031",
    rank: "03",
    workspace: "Client 031",
    kind: "campaigns",
    label: "Campaign draft",
    marker: "Operator review",
    reason:
      "A draft educational dispute workflow is staged for operator review.",
    receipt:
      "Displayed sources: reported-item record · draft state · workspace coverage",
    nextReview:
      "Review the displayed source facts and the draft language. No outcome is guaranteed.",
  },
  {
    id: "mail-022",
    rank: "04",
    workspace: "Client 022",
    kind: "mail",
    label: "Mail evidence",
    marker: "Receipt missing",
    reason:
      "The fixture shows a mailed record without a displayed delivery or receipt event.",
    receipt:
      "Displayed sources: mailed record · evidence coverage gap",
    nextReview:
      "Verify the mailing evidence before relying on any timing marker.",
  },
  {
    id: "intake-038",
    rank: "05",
    workspace: "Client 038",
    kind: "intake",
    label: "Intake review",
    marker: "Report absent",
    reason:
      "The fixture shows an intake workspace without a displayed credit-report record.",
    receipt:
      "Displayed sources: workspace record · report coverage gap",
    nextReview:
      "Confirm the client supplied the intended source material before staging work.",
  },
];

export const AGENCY_PORTFOLIO: AgencyPortfolioItem[] = [
  {
    id: "client-014",
    workspace: "Client 014",
    region: "Southwest region",
    workState: "Response review",
    reportedItems: "4 displayed items",
    letterRecord: "2 illustrative letters",
    latestRound: "Round 2 shown",
    timing: "Response awaiting review",
    coverage: "Displayed fixture: complete",
  },
  {
    id: "client-027",
    workspace: "Client 027",
    region: "Southeast region",
    workState: "Follow-up review",
    reportedItems: "3 displayed items",
    letterRecord: "1 illustrative letter",
    latestRound: "Round 1 shown",
    timing: "Estimated marker passed",
    coverage: "Receipt verification needed",
  },
  {
    id: "client-031",
    workspace: "Client 031",
    region: "Northeast region",
    workState: "Draft review",
    reportedItems: "5 displayed items",
    letterRecord: "1 illustrative draft",
    latestRound: "Round 1 staged",
    timing: "No follow-up marker shown",
    coverage: "Displayed fixture: partial",
  },
  {
    id: "client-022",
    workspace: "Client 022",
    region: "Midwest region",
    workState: "Mail evidence",
    reportedItems: "2 displayed items",
    letterRecord: "2 illustrative letters",
    latestRound: "Round 2 shown",
    timing: "Mail receipt not displayed",
    coverage: "Evidence gap displayed",
  },
  {
    id: "client-038",
    workspace: "Client 038",
    region: "Western region",
    workState: "Intake",
    reportedItems: "No report displayed",
    letterRecord: "No letter record",
    latestRound: "Not staged",
    timing: "Not rated",
    coverage: "Source material unavailable",
  },
];

export const AGENCY_HEALTH_DRIVERS: Record<
  AgencyFixtureState,
  AgencyHealthDriver[]
> = {
  populated: [
    {
      label: "Response attention",
      value: "1 displayed decision",
      note: "One specimen row",
    },
    {
      label: "Oldest queue marker",
      value: "2 illustrative days",
      note: "Not a legal deadline",
    },
    {
      label: "Workspace capacity",
      value: "12 of 15",
      note: "Aggregate synthetic count",
    },
    {
      label: "Portfolio rows shown",
      value: "5 of 5",
      note: "Specimen-row coverage",
    },
  ],
  empty: [
    {
      label: "Response attention",
      value: "0 displayed decisions",
      note: "No work staged",
    },
    {
      label: "Oldest queue marker",
      value: "Not rated",
      note: "No timing shown",
    },
    {
      label: "Workspace capacity",
      value: "0 of 15",
      note: "Aggregate synthetic count",
    },
    {
      label: "Portfolio rows shown",
      value: "0 of 0",
      note: "Empty fixture",
    },
  ],
  loading: [],
  unavailable: [
    {
      label: "Response attention",
      value: "1 displayed decision",
      note: "Available specimen only",
    },
    {
      label: "Oldest queue marker",
      value: "Unavailable",
      note: "Missing source is not guessed",
    },
    {
      label: "Workspace capacity",
      value: "12 of 15",
      note: "Aggregate synthetic count",
    },
    {
      label: "Portfolio rows shown",
      value: "2 of 5",
      note: "Partial specimen coverage",
    },
  ],
  error: [
    {
      label: "Response attention",
      value: "1 preserved decision",
      note: "Previously displayed specimen",
    },
    {
      label: "Oldest queue marker",
      value: "Interrupted",
      note: "No missing timing is guessed",
    },
    {
      label: "Workspace capacity",
      value: "12 of 15",
      note: "Aggregate synthetic count",
    },
    {
      label: "Portfolio rows shown",
      value: "2 of 5",
      note: "Preserved after display error",
    },
  ],
  permission: [],
  capacity: [
    {
      label: "Response attention",
      value: "1 displayed decision",
      note: "One specimen row",
    },
    {
      label: "Oldest queue marker",
      value: "2 illustrative days",
      note: "Not a legal deadline",
    },
    {
      label: "Workspace capacity",
      value: "15 of 15",
      note: "Aggregate synthetic count",
    },
    {
      label: "Portfolio rows shown",
      value: "5 of 5",
      note: "Specimen-row coverage",
    },
  ],
};

export const AGENCY_TEAM_SPECIMEN: AgencyTeamSeat[] = [
  {
    id: "seat-review",
    role: "Review specialist A",
    assigned: "4 illustrative records",
    load: "WATCH",
    note: "Synthetic workload specimen",
  },
  {
    id: "seat-mail",
    role: "Mail specialist B",
    assigned: "3 illustrative records",
    load: "AVAILABLE",
    note: "Synthetic workload specimen",
  },
  {
    id: "seat-intake",
    role: "Intake specialist C",
    assigned: "2 illustrative records",
    load: "AVAILABLE",
    note: "Synthetic workload specimen",
  },
];
