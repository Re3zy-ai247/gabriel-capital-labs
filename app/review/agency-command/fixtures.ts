// CXOS Phase 6.2 — Agency Headquarters Founder Review fixtures.
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

export type AgencyHeartbeatMotion =
  | "entering"
  | "advancing"
  | "waiting"
  | "blocked"
  | "resolving";

export interface AgencyHeartbeatSignal {
  id: string;
  workspace: string;
  lane: string;
  motion: AgencyHeartbeatMotion;
  position: "entry" | "evidence" | "prepare" | "decision" | "follow-up";
  detail: string;
}

export interface AgencyWorkloadBand {
  id: string;
  label: string;
  count: string;
  pressure: "attention" | "moving" | "held";
  detail: string;
}

export interface AgencyEvidenceBand {
  id: string;
  workspace: string;
  state: "complete" | "verify" | "partial" | "gap" | "unavailable";
  detail: string;
}

export interface AgencyBottleneck {
  id: string;
  label: string;
  workspace: string;
  state: string;
  safeReview: string;
}

export type KaiWorkflowId =
  | "note-taking"
  | "reminders"
  | "scheduling"
  | "activity-summary"
  | "task-preparation"
  | "bottleneck-identification"
  | "follow-up-planning"
  | "client-work-organization"
  | "meeting-preparation"
  | "operational-explanation"
  | "suggested-next-actions";

export interface AgencyKaiWorkflow {
  id: KaiWorkflowId;
  label: string;
  classification:
    | "DISPLAYED FACT"
    | "INTERPRETATION"
    | "RECOMMENDATION"
    | "BOUNDARY"
    | "OPERATOR DRAFT";
  purpose: string;
  actionLabel: string;
  sources: string;
  previewLines: string[];
  receipt: string;
}

export type AgencyOperatingModel = "solo" | "team";

export type AgencyDistrictId =
  | "central-command"
  | "client-operations"
  | "team-operations"
  | "business-health"
  | "evidence-archive"
  | "kai-suite"
  | "growth-threshold";

export interface AgencyDistrict {
  id: AgencyDistrictId;
  index: string;
  name: string;
  shortName: string;
  purpose: string;
  kaiContext: string;
  truthBoundary: string;
  suggestions: readonly string[];
}

export interface AgencyPersonalization {
  operatingModel: AgencyOperatingModel;
  operatorDisplay: string;
  operatorRole: string;
  agencyName: string;
  agencyType: string;
  agencyTier: string;
  capacityCondition: string;
  displayedWorkspaces: string;
  priorityCondition: string;
  emphasizedDistrict: AgencyDistrictId;
  greeting: string;
  recommendedDestination: string;
}

export interface AgencyAuthorizedSource {
  owner: "Identity" | "Organizations" | "Membership" | "Agency" | "Billing" | "Kai";
  futureSource: string;
  reviewState: string;
}

export type AgencyKaiResolutionStatus = "supported" | "unsupported" | "empty";

export interface AgencyKaiResolution {
  status: AgencyKaiResolutionStatus;
  workflowId: KaiWorkflowId | null;
  normalizedCommand: string;
  headline: string;
  responseLines: readonly string[];
  sources: string;
  classification: AgencyKaiWorkflow["classification"] | "BOUNDARY";
  receipt: string;
}

export const AGENCY_DISTRICTS: readonly AgencyDistrict[] = [
  {
    id: "central-command",
    index: "01",
    name: "Central Command",
    shortName: "Central",
    purpose: "Agency condition, immediate attention, and cross-business orientation.",
    kaiContext: "Kai is framing the top displayed priority and operating condition.",
    truthBoundary: "Cross-business overview uses only labeled synthetic fixture values.",
    suggestions: [
      "Prepare my morning priorities",
      "Explain the current agency condition",
      "Suggest what I should do next",
    ],
  },
  {
    id: "client-operations",
    index: "02",
    name: "Client Operations Floor",
    shortName: "Clients",
    purpose: "Portfolio movement, response work, follow-ups, evidence, and blocked flow.",
    kaiContext: "Kai can organize the displayed client-work lanes without changing them.",
    truthBoundary: "Client labels and work states are fictional; no customer system is connected.",
    suggestions: [
      "Organize today's client work",
      "Create a follow-up plan",
      "Take a note about Client 014",
    ],
  },
  {
    id: "team-operations",
    index: "03",
    name: "Team Operations Room",
    shortName: "Team",
    purpose: "Roles, illustrative assignments, workload, and coverage boundaries.",
    kaiContext: "Kai can prepare a synthetic operating brief for the selected model.",
    truthBoundary: "Solo is unconnected truth; Team is an explicitly synthetic specimen.",
    suggestions: [
      "Prepare my team meeting",
      "Build my schedule for today",
      "Identify current bottlenecks",
    ],
  },
  {
    id: "business-health",
    index: "04",
    name: "Business Health Observatory",
    shortName: "Health",
    purpose: "Capacity, utilization, qualitative health, and missing business inputs.",
    kaiContext: "Kai can explain disclosed drivers without inventing revenue or a score.",
    truthBoundary: "Revenue and agency billing remain uninstrumented and unestimated.",
    suggestions: [
      "Explain the current agency condition",
      "Identify current bottlenecks",
      "Summarize agency activity",
    ],
  },
  {
    id: "evidence-archive",
    index: "05",
    name: "Activity and Evidence Archive",
    shortName: "Evidence",
    purpose: "Displayed receipts, source coverage, document state, and fixture history.",
    kaiContext: "Kai can summarize displayed evidence while preserving every coverage gap.",
    truthBoundary: "This fixture ledger is not a production audit trail.",
    suggestions: [
      "Summarize agency activity",
      "Take a note about Client 014",
      "Create a follow-up plan",
    ],
  },
  {
    id: "kai-suite",
    index: "06",
    name: "Kai Executive Suite",
    shortName: "Kai",
    purpose: "Route-local conversation, delegation previews, and recommendations.",
    kaiContext: "Kai interprets and prepares; the operator verifies and decides.",
    truthBoundary: "No model, persistence, calendar, task, notification, or production action.",
    suggestions: [
      "Prepare my morning priorities",
      "Remind me to review this response tomorrow",
      "Suggest what I should do next",
    ],
  },
  {
    id: "growth-threshold",
    index: "07",
    name: "Growth / Capacity Threshold",
    shortName: "Capacity",
    purpose: "Occupied positions, reserve, limitations, and the next operating constraint.",
    kaiContext: "Kai can identify the next displayed constraint without offering a billing action.",
    truthBoundary: "Capacity is a fixed fixture; plan and billing systems are not connected.",
    suggestions: [
      "Identify current bottlenecks",
      "Explain the current agency condition",
      "Suggest what I should do next",
    ],
  },
] as const;

export const AGENCY_PERSONALIZATIONS: Record<
  AgencyOperatingModel,
  AgencyPersonalization
> = {
  solo: {
    operatingModel: "solo",
    operatorDisplay: "Founder specimen",
    operatorRole: "Owner-operator",
    agencyName: "Northstar Advisory",
    agencyType: "Solo education agency",
    agencyTier: "Founder review tier",
    capacityCondition: "12 of 15 illustrative positions occupied",
    displayedWorkspaces: "5 fictional workspaces displayed",
    priorityCondition: "One displayed response decision requires review",
    emphasizedDistrict: "client-operations",
    greeting:
      "Agency Command is ready. One displayed response decision requires your review.",
    recommendedDestination: "Client Operations Floor",
  },
  team: {
    operatingModel: "team",
    operatorDisplay: "Executive specimen",
    operatorRole: "Agency principal",
    agencyName: "Meridian Client Education",
    agencyType: "Synthetic team agency",
    agencyTier: "Team specimen tier",
    capacityCondition: "12 of 15 illustrative positions occupied",
    displayedWorkspaces: "5 fictional workspaces displayed",
    priorityCondition: "Coverage and response decisions lead the operating review",
    emphasizedDistrict: "team-operations",
    greeting:
      "Agency Command is ready. Team coverage and one displayed response decision lead the review.",
    recommendedDestination: "Team Operations Room",
  },
};

export const AGENCY_AUTHORIZED_SOURCES: readonly AgencyAuthorizedSource[] = [
  {
    owner: "Identity",
    futureSource: "Authorized operator display and role projection",
    reviewState: "Deterministic fixture only · not connected",
  },
  {
    owner: "Organizations",
    futureSource: "Agency identity and operating entity",
    reviewState: "Deterministic fixture only · not connected",
  },
  {
    owner: "Membership",
    futureSource: "Scoped team role and access context",
    reviewState: "Solo truth / synthetic team specimen",
  },
  {
    owner: "Agency",
    futureSource: "Authorized workspace, queue, evidence, and capacity projections",
    reviewState: "Fictional presentation fixtures only",
  },
  {
    owner: "Billing",
    futureSource: "Plan entitlement and capacity limit",
    reviewState: "Disconnected · no billing action or estimate",
  },
  {
    owner: "Kai",
    futureSource: "Contextual interpretation, preparation, and recommendations",
    reviewState: "Deterministic resolver · no model or invocation",
  },
] as const;

export const AGENCY_KAI_NO_ACTION_RECEIPT =
  "Nothing was saved, sent, scheduled, assigned, created, contacted, or changed.";

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

export const AGENCY_HEARTBEAT_SIGNALS: AgencyHeartbeatSignal[] = [
  {
    id: "flow-intake-038",
    workspace: "Client 038",
    lane: "Intake",
    motion: "entering",
    position: "entry",
    detail: "The intake record is present; its source report is not displayed.",
  },
  {
    id: "flow-draft-031",
    workspace: "Client 031",
    lane: "Draft review",
    motion: "advancing",
    position: "prepare",
    detail: "A draft is staged for operator review; no outcome is implied.",
  },
  {
    id: "flow-response-014",
    workspace: "Client 014",
    lane: "Response decision",
    motion: "waiting",
    position: "decision",
    detail: "The displayed response record is waiting for an operator decision.",
  },
  {
    id: "flow-mail-022",
    workspace: "Client 022",
    lane: "Mail evidence",
    motion: "blocked",
    position: "evidence",
    detail: "A delivery or receipt event is not displayed.",
  },
  {
    id: "flow-follow-up-027",
    workspace: "Client 027",
    lane: "Follow-up review",
    motion: "resolving",
    position: "follow-up",
    detail: "Receipt, response status, and applicable timing still need review.",
  },
];

export const AGENCY_WORKLOAD_FIELD: AgencyWorkloadBand[] = [
  {
    id: "workload-decision",
    label: "Decision",
    count: "1 displayed record",
    pressure: "attention",
    detail: "Operator choice waiting",
  },
  {
    id: "workload-preparation",
    label: "Preparation",
    count: "1 illustrative draft",
    pressure: "moving",
    detail: "Review sequence advancing",
  },
  {
    id: "workload-evidence",
    label: "Evidence",
    count: "2 source checks",
    pressure: "held",
    detail: "Coverage constrains movement",
  },
  {
    id: "workload-intake",
    label: "Intake",
    count: "1 displayed record",
    pressure: "held",
    detail: "Report source unavailable",
  },
];

export const AGENCY_EVIDENCE_FIELD: AgencyEvidenceBand[] = [
  {
    id: "evidence-014",
    workspace: "Client 014",
    state: "complete",
    detail: "Displayed fixture complete",
  },
  {
    id: "evidence-027",
    workspace: "Client 027",
    state: "verify",
    detail: "Receipt verification needed",
  },
  {
    id: "evidence-031",
    workspace: "Client 031",
    state: "partial",
    detail: "Displayed fixture partial",
  },
  {
    id: "evidence-022",
    workspace: "Client 022",
    state: "gap",
    detail: "Mail evidence gap displayed",
  },
  {
    id: "evidence-038",
    workspace: "Client 038",
    state: "unavailable",
    detail: "Source report unavailable",
  },
];

export const AGENCY_BOTTLENECKS: AgencyBottleneck[] = [
  {
    id: "bottleneck-decision",
    label: "Decision gate",
    workspace: "Client 014",
    state: "WAITING",
    safeReview: "Inspect the response and verify its source record.",
  },
  {
    id: "bottleneck-mail",
    label: "Evidence gate",
    workspace: "Client 022",
    state: "BLOCKED",
    safeReview: "Verify mailing evidence before relying on a timing marker.",
  },
  {
    id: "bottleneck-intake",
    label: "Source gate",
    workspace: "Client 038",
    state: "HELD",
    safeReview: "Confirm the intended source material before staging work.",
  },
];

export const AGENCY_KAI_NOTE_SEED =
  "Verify the Client 014 response record and mail receipt before choosing a next step.";

export const AGENCY_KAI_WORKFLOWS: AgencyKaiWorkflow[] = [
  {
    id: "note-taking",
    label: "Note taking",
    classification: "OPERATOR DRAFT",
    purpose:
      "Stage a fixture-only operator observation in this open route instance.",
    actionLabel: "Stage note preview",
    sources: "Client 014 response record · displayed mail receipt",
    previewLines: [
      "The editable note is rendered as a local preview only.",
      "Refresh or exit discards the draft.",
    ],
    receipt: "No note store, customer record, or audit log is connected.",
  },
  {
    id: "reminders",
    label: "Reminders",
    classification: "RECOMMENDATION",
    purpose:
      "Prepare a reminder preview for the displayed response review after source verification.",
    actionLabel: "Prepare reminder preview",
    sources: "Client 014 response record · source-verification boundary",
    previewLines: [
      "Reminder preview: review Client 014 after the displayed source record is verified.",
      "No notification time, recipient, or delivery channel is registered.",
    ],
    receipt: "No reminder, notification, or follow-up event was created.",
  },
  {
    id: "scheduling",
    label: "Scheduling",
    classification: "RECOMMENDATION",
    purpose:
      "Prepare a fixed specimen agenda without reading a clock or calendar.",
    actionLabel: "Prepare schedule preview",
    sources: "Response review · evidence receipt · operator decision point",
    previewLines: [
      "Proposed review block: 20 illustrative minutes.",
      "Agenda: inspect response · verify source · record operator decision.",
    ],
    receipt: "No date was resolved and no calendar event or invitation was created.",
  },
  {
    id: "activity-summary",
    label: "Activity summary",
    classification: "DISPLAYED FACT",
    purpose:
      "Summarize the fixed portfolio and queue fixtures without presenting an audit trail.",
    actionLabel: "Prepare activity summary",
    sources: "Five portfolio rows · five ranked queue records · coverage field",
    previewLines: [
      "Five portfolio rows are displayed: one response decision, one follow-up review, one draft review, one mail-evidence gap, and one intake source gap.",
      "This is a fixture summary, not an activity history or production audit log.",
    ],
    receipt: "The summary reads only deterministic route-local fixture values.",
  },
  {
    id: "task-preparation",
    label: "Task preparation",
    classification: "BOUNDARY",
    purpose:
      "Prepare the inputs and verification steps for the displayed response decision.",
    actionLabel: "Prepare task preview",
    sources: "response-014 · response record · mail receipt · workspace coverage",
    previewLines: [
      "Inputs: displayed response record, mail receipt, and workspace coverage.",
      "Review sequence: verify source · inspect response · retain operator decision authority.",
    ],
    receipt: "No task was created, assigned, prioritized, or written to a record.",
  },
  {
    id: "bottleneck-identification",
    label: "Bottleneck identification",
    classification: "INTERPRETATION",
    purpose:
      "Explain which displayed source gates constrain the fixed workflow specimen.",
    actionLabel: "Prepare bottleneck analysis",
    sources: "Client 022 mail evidence · Client 038 source report · capacity fixture",
    previewLines: [
      "Source verification is the default fixture constraint: Client 022 lacks displayed mail evidence and Client 038 lacks a displayed report.",
      "Capacity pressure is separate and appears only when the 15 of 15 fixture is selected.",
    ],
    receipt: "This is a bounded interpretation, not a live diagnosis or health score.",
  },
  {
    id: "follow-up-planning",
    label: "Follow-up planning",
    classification: "RECOMMENDATION",
    purpose:
      "Prepare a verification-first sequence for the displayed Client 027 marker.",
    actionLabel: "Prepare follow-up preview",
    sources: "Logged mailed date · response status · illustrative timing marker",
    previewLines: [
      "Review Client 027 in this order: verify delivery or receipt, inspect response state, then confirm applicable timing.",
      "The displayed marker is illustrative and is not a legal deadline.",
    ],
    receipt: "No follow-up, deadline, message, or customer action was created.",
  },
  {
    id: "client-work-organization",
    label: "Client-work organization",
    classification: "DISPLAYED FACT",
    purpose:
      "Group the five displayed records into their existing fixed work lanes.",
    actionLabel: "Prepare organization preview",
    sources: "Response · follow-up · draft · evidence · intake fixture lanes",
    previewLines: [
      "Displayed lanes: response decision, follow-up review, draft review, mail evidence, and intake.",
      "The preview changes no rank, owner, assignment, or workspace state.",
    ],
    receipt: "No client record was moved, relabeled, reassigned, or changed.",
  },
  {
    id: "meeting-preparation",
    label: "Meeting preparation",
    classification: "RECOMMENDATION",
    purpose:
      "Prepare a fixed operating-review agenda from the displayed fixtures.",
    actionLabel: "Prepare meeting brief",
    sources: "Capacity horizon · response decision · evidence gaps · operator boundaries",
    previewLines: [
      "Specimen agenda: capacity position · response decision · evidence gaps · required operator choices.",
      "No participants, date, conferencing link, or invitation are connected.",
    ],
    receipt: "No meeting, invitation, calendar event, or participant action was created.",
  },
  {
    id: "operational-explanation",
    label: "Operational explanation",
    classification: "INTERPRETATION",
    purpose:
      "Explain the qualitative WATCH state using its disclosed fixture drivers.",
    actionLabel: "Prepare operational explanation",
    sources: "Response attention · queue marker · capacity · source coverage",
    previewLines: [
      "WATCH means displayed attention and source-verification work remain in the fixed specimen.",
      "It is not a financial-health assessment, compliance certification, or prediction.",
    ],
    receipt: "The explanation does not create a score or infer missing inputs.",
  },
  {
    id: "suggested-next-actions",
    label: "Suggested next actions",
    classification: "RECOMMENDATION",
    purpose:
      "Order review-safe next steps while preserving operator authority.",
    actionLabel: "Prepare next-action preview",
    sources: "Ranked queue · evidence coverage · source-verification boundaries",
    previewLines: [
      "Suggested review order: inspect response · verify mail receipt · confirm source report · review draft.",
      "Kai recommends; the operator verifies the displayed evidence and decides.",
    ],
    receipt: "No automated production action or customer mutation is available.",
  },
];

const KAI_INTENT_RULES: readonly {
  workflowId: KaiWorkflowId;
  patterns: readonly RegExp[];
  signals: readonly RegExp[];
}[] = [
  {
    workflowId: "meeting-preparation",
    patterns: [
      /^(?:please )?prepare (?:my |a |the )?(?:team )?meeting(?: brief)?[.!?]*$/,
    ],
    signals: [/\bmeeting\b/, /\bteam brief\b/],
  },
  {
    workflowId: "follow-up-planning",
    patterns: [
      /^(?:please )?(?:create|prepare|build) (?:a |the )?follow[ -]?up plan[.!?]*$/,
    ],
    signals: [/\bfollow[ -]?up\b/],
  },
  {
    workflowId: "bottleneck-identification",
    patterns: [
      /^(?:please )?(?:identify|explain|show) (?:the |our )?current bottlenecks?[.!?]*$/,
      /^(?:please )?identify (?:the |our )?(?:blocked|blocking) (?:work|flow)[.!?]*$/,
    ],
    signals: [/\bbottleneck/, /\bblock(?:ed|ing)?\b/, /\bconstraint/],
  },
  {
    workflowId: "client-work-organization",
    patterns: [
      /^(?:please )?organ(?:ize|ise) (?:today(?:'s|’s)? |the )?client work[.!?]*$/,
    ],
    signals: [/\borgan(?:ize|ise|izing|ising)\b/, /\bclient work\b/],
  },
  {
    workflowId: "activity-summary",
    patterns: [
      /^(?:please )?summari[sz]e (?:the |our )?agency activity[.!?]*$/,
      /^(?:please )?prepare (?:the |an )?activity summary[.!?]*$/,
    ],
    signals: [/\bsummari[sz]e\b/, /\bactivity summary\b/, /\bagency activity\b/],
  },
  {
    workflowId: "operational-explanation",
    patterns: [
      /^(?:please )?explain (?:the |our )?current agency condition[.!?]*$/,
      /^(?:please )?explain why (?:the )?agency condition is watch[.!?]*$/,
    ],
    signals: [/\bexplain\b/, /\bagency condition\b/, /\bwhy.*watch\b/],
  },
  {
    workflowId: "suggested-next-actions",
    patterns: [
      /^(?:please )?suggest what i should do next[.!?]*$/,
      /^(?:please )?what should i do next[.!?]*$/,
    ],
    signals: [/\bwhat should i\b/, /\bdo next\b/, /\bsuggest.*next\b/],
  },
  {
    workflowId: "reminders",
    patterns: [
      /^(?:please )?remind me to review (?:this|the) response tomorrow[.!?]*$/,
      /^(?:please )?prepare (?:a |the )?reminder preview[.!?]*$/,
    ],
    signals: [/\bremind(?:er)?\b/, /\btomorrow\b/],
  },
  {
    workflowId: "scheduling",
    patterns: [
      /^(?:please )?build my schedule for today[.!?]*$/,
      /^(?:please )?prepare (?:my |an )?agenda for today[.!?]*$/,
      /^(?:please )?plan my day[.!?]*$/,
    ],
    signals: [/\bschedul/, /\bagenda for today\b/, /\bplan my day\b/],
  },
  {
    workflowId: "note-taking",
    patterns: [
      /^(?:please )?take a note about client 014[.!?]*$/,
      /^(?:please )?prepare (?:a |the )?note preview for client 014[.!?]*$/,
    ],
    signals: [/\btake (?:a )?note\b/, /\bnote about\b/, /\bnote preview\b/],
  },
  {
    workflowId: "task-preparation",
    patterns: [
      /^(?:please )?prepare my morning priorities[.!?]*$/,
      /^(?:please )?prepare (?:the |a )?task preview[.!?]*$/,
    ],
    signals: [/\bprepare.*priorit/, /\bmorning priorit/, /\btask (?:preview|preparation)\b/],
  },
] as const;

export function resolveAgencyKaiIntent(command: string): AgencyKaiResolution {
  const normalizedCommand = command
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

  if (!normalizedCommand) {
    return {
      status: "empty",
      workflowId: null,
      normalizedCommand,
      headline: "Kai needs a review-safe request",
      responseLines: [
        "Ask for one of the displayed synthetic workflows or choose a contextual example.",
      ],
      sources: "No fixture source selected",
      classification: "BOUNDARY",
      receipt: AGENCY_KAI_NO_ACTION_RECEIPT,
    };
  }

  const unavailableAction =
    /\b(?:approve|book|cancel|close|complete|delete|edit|escalate|file|mark|remove|reject|reschedule|save|send|submit|update|assign|invite|contact|email|text|notify|call|use live|live customer|customer record|production|calendar)\b/.test(
      normalizedCommand
    ) ||
    /\bcreate (?:a |an )?(?:reminder|task|calendar|event|note|meeting)\b/.test(
      normalizedCommand
    );
  const legalOrOutcomeRequest =
    /(?:§|\b(?:fcra|fdcpa|croa|statute|law|legal|violate|violation|rights|attorney|lawsuit|dispute|challenge|bureau|guarantee|guaranteed|delete accurate|score increase|credit score|raise.*score|legal advice|act for|deadline)\b)/.test(
      normalizedCommand
    );
  const matchingRules = KAI_INTENT_RULES.filter((candidate) =>
    candidate.patterns.some((pattern) => pattern.test(normalizedCommand))
  );
  const signalMatches = KAI_INTENT_RULES.filter((candidate) =>
    candidate.signals.some((pattern) => pattern.test(normalizedCommand))
  );
  const rule =
    matchingRules.length === 1 && signalMatches.length === 1
      ? matchingRules[0]
      : null;
  const workflow = rule
    ? AGENCY_KAI_WORKFLOWS.find((candidate) => candidate.id === rule.workflowId)
    : null;

  if (unavailableAction || legalOrOutcomeRequest) {
    return {
      status: "unsupported",
      workflowId: null,
      normalizedCommand,
      headline: "Unavailable in this review",
      responseLines: [
        "Kai can prepare a synthetic preview, but cannot save, send, schedule an external event, assign, invite, contact anyone, use live customer data, provide case-specific legal advice, promise an outcome, or change a record.",
        "No model, external service, or owning system was invoked.",
      ],
      sources: "Request crossed the synthetic review boundary",
      classification: "BOUNDARY",
      receipt: AGENCY_KAI_NO_ACTION_RECEIPT,
    };
  }

  if (!workflow || matchingRules.length !== 1 || signalMatches.length !== 1) {
    return {
      status: "unsupported",
      workflowId: null,
      normalizedCommand,
      headline:
        signalMatches.length > 1
          ? "Enter one synthetic command at a time"
          : "That command is unavailable in this review",
      responseLines: [
        signalMatches.length > 1
          ? "This fixed local parser matched more than one fixture intent, so it prepared nothing."
          : "This fixed local parser did not match one supported synthetic command.",
        "No model, external system, customer record, calendar, task, message, or production action was invoked.",
      ],
      sources:
        signalMatches.length > 1
          ? "Multiple fixture intents matched · no artifact prepared"
          : "No authorized fixture intent matched",
      classification: "BOUNDARY",
      receipt: AGENCY_KAI_NO_ACTION_RECEIPT,
    };
  }

  return {
    status: "supported",
    workflowId: workflow.id,
    normalizedCommand,
    headline: workflow.label,
    responseLines: workflow.previewLines,
    sources: workflow.sources,
    classification: workflow.classification,
    receipt: `${workflow.receipt} ${AGENCY_KAI_NO_ACTION_RECEIPT}`,
  };
}
