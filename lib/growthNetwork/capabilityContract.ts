// Growth Experience Phase 1B — pure, synthetic Founder-review contracts.
//
// This module owns only review vocabulary, immutable fictional fixtures, and
// deterministic projection rules. It owns no participant agreement, platform
// entitlement, source record, enrollment, credential, reputation, economic
// state, persistence, model behavior, or canonical bounded-context fact.

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export const GROWTH_CAPABILITY_CONTRACT_VERSION = 1 as const;

export const CGN_ECONOMIC_PHASE_1A_STATUS =
  "CGN ECONOMIC PHASE 1A — BLOCKED" as const;
export const GROWTH_EXPERIENCE_PHASE_1A_STATUS =
  "GROWTH EXPERIENCE PHASE 1A — APPROVED FOUNDER PREVIEW" as const;
export const GROWTH_EXPERIENCE_PHASE_1B_STATUS =
  "GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK" as const;

export const GROWTH_CAPABILITY_REVIEW_DISCLOSURE =
  "Founder review · Synthetic capability-contract fixtures · No live Growth program. Nothing shown is a participant record, enrollment, mentor match, course, contribution, Community post, organization assessment, credential, certification, opportunity, qualification, Growth Reputation record, compensation, or promise of business or credit results. No participant data is read or saved, and no action is taken." as const;

export const GROWTH_CAPABILITY_REVIEW_SUMMARY =
  "Founder review · Synthetic · Non-monetary · Production hard-off" as const;

export const GROWTH_CAPABILITY_INTERNAL_CONTRACT_NOTICE =
  "Internal product contract for how future professional capability information may be represented. It is not a participant agreement, enrollment, credential, platform entitlement, or offer." as const;

export const GROWTH_CAPABILITY_UNSUPPORTED_COPY =
  "Unsupported review state · unavailable in this Preview. No status, eligibility, completion, review, or action has been inferred." as const;

export const GROWTH_CAPABILITY_AGENCY_BOUNDARY =
  "No live Growth Distribution. These stewardship examples create no eligibility, allocation, obligation, or payment right. Recruiting is not rewarded." as const;

export const GROWTH_CAPABILITY_KAI_RECEIPT =
  "Kai is explaining fixed synthetic review fixtures. Kai did not analyze a person, organization, evidence, eligibility, or opportunity. No model was called. Nothing was saved, submitted, reviewed, corrected, appealed, assigned, scheduled, published, enrolled, purchased, or changed." as const;

export const GROWTH_CAPABILITY_FIXTURE_SOURCE =
  "GXP1B-FIXTURE-01 · fictional Founder-review source · no participant record" as const;

export const CAPABILITY_CONTRACT_IDS = deepFreeze([
  "professional-capability",
  "development-pathway",
  "mentorship",
  "education",
  "operator-contribution",
  "community-contribution",
  "organizational-stewardship",
] as const);

export type CapabilityContractId = (typeof CAPABILITY_CONTRACT_IDS)[number];

export const CAPABILITY_FIXTURE_IDS = deepFreeze([
  "overview",
  "empty",
  "preparing",
  "completed-unreviewed",
  "in-review",
  "changes-requested",
  "source-corrected",
  "appeal-in-review",
  "privacy-restricted",
  "unsupported",
] as const);

export type CapabilityFixtureId = (typeof CAPABILITY_FIXTURE_IDS)[number];

export const CAPABILITY_EVIDENCE_ITEM_IDS = deepFreeze([
  "professional-purpose",
  "source-owner",
  "subject-scope",
  "evidence-category",
  "occurrence-source-confirmation",
  "reviewer-role",
  "policy-contract-version",
  "visibility",
  "correction-route",
  "appeal-route",
  "expiry-supersession",
] as const);

export type CapabilityEvidenceItemId =
  (typeof CAPABILITY_EVIDENCE_ITEM_IDS)[number];

export const CAPABILITY_KAI_QUESTION_IDS = deepFreeze([
  "explain-capability",
  "explain-owner",
  "explain-evidence",
  "explain-incomplete",
  "explain-correction",
  "explain-appeal",
  "explain-unsupported",
] as const);

export type CapabilityKaiQuestionId =
  (typeof CAPABILITY_KAI_QUESTION_IDS)[number];

export type CanonicalCapabilityOwner =
  | "IDENTITY"
  | "ORGANIZATIONS"
  | "MEMBERSHIP"
  | "LEARNING"
  | "COMMUNITY"
  | "OPERATOR_NETWORK"
  | "MARKETPLACE"
  | "REPUTATION"
  | "PERFORMANCE_INTELLIGENCE"
  | "AGENCY_COMMAND"
  | "MEETINGS"
  | "DOCUMENTS"
  | "KAI"
  | "GROWTH"
  | "OWNER_UNRESOLVED";

export const CAPABILITY_OWNER_LABELS = deepFreeze({
  IDENTITY: "Identity",
  ORGANIZATIONS: "Organizations",
  MEMBERSHIP: "Membership",
  LEARNING: "Learning",
  COMMUNITY: "Community",
  OPERATOR_NETWORK: "Operator Network",
  MARKETPLACE: "Marketplace",
  REPUTATION: "Reputation",
  PERFORMANCE_INTELLIGENCE: "Performance Intelligence",
  AGENCY_COMMAND: "Agency Command",
  MEETINGS: "Meetings",
  DOCUMENTS: "Documents",
  KAI: "Kai",
  GROWTH: "Growth",
  OWNER_UNRESOLVED: "Owner unresolved",
} as const satisfies Readonly<Record<CanonicalCapabilityOwner, string>>);

export type ProjectionAvailability =
  | "SYNTHETIC_AVAILABLE"
  | "FUTURE_UNAVAILABLE"
  | "OWNER_UNRESOLVED"
  | "OWNER_NOT_CONNECTED"
  | "NOT_AUTHORIZED"
  | "SOURCE_MISSING"
  | "SOURCE_STALE"
  | "SOURCE_CONFLICT"
  | "PRIVATE"
  | "UNSUPPORTED_CONTRACT_VERSION"
  | "ERROR";

export interface Phase1BReviewHeader {
  contractId: CapabilityContractId | "unsupported";
  contractVersion: typeof GROWTH_CAPABILITY_CONTRACT_VERSION;
  phaseLabel: typeof GROWTH_EXPERIENCE_PHASE_1B_STATUS;
  mode: "SYNTHETIC_FOUNDER_REVIEW";
  synthetic: true;
  canonicalOwner: CanonicalCapabilityOwner;
  projectionOwner: "GROWTH";
  source: {
    kind: "SYNTHETIC_FIXTURE";
    ref: typeof GROWTH_CAPABILITY_FIXTURE_SOURCE;
  };
  visibility: "FOUNDER_REVIEW_ONLY";
  availability: ProjectionAvailability;
}

export interface CapabilityContractDefinition {
  id: CapabilityContractId;
  label: string;
  shortLabel: string;
  purpose: string;
  canonicalOwner: CanonicalCapabilityOwner;
  ownerExplanation: string;
  supportingOwners: readonly string[];
  growthMay: string;
  growthMustNot: string;
  participationBoundary: string;
  evidenceOwner: CanonicalCapabilityOwner;
  evidenceRequirements: readonly string[];
  refusedShortcuts: readonly string[];
  completionOwner: CanonicalCapabilityOwner;
  reviewOwner: CanonicalCapabilityOwner;
  visibilityOwner: CanonicalCapabilityOwner;
  correctionOwner: CanonicalCapabilityOwner;
  appealOwner: CanonicalCapabilityOwner;
  privacyBoundary: string;
  kaiAllowed: string;
  unsupportedStates: readonly string[];
  unsupportedFixtureIds: readonly CapabilityFixtureId[];
  economicBoundary: string;
}

export const CAPABILITY_CONTRACTS = deepFreeze([
  {
    id: "professional-capability",
    label: "Professional capability",
    shortLabel: "Capability",
    purpose:
      "Represent a future professional capability definition without claiming that any person possesses it.",
    canonicalOwner: "LEARNING",
    ownerExplanation:
      "Learning would own the capability definition and version. Identity could later display an authorized reference but would not define the capability.",
    supportingOwners: ["Identity · future authorized reference only", "Reputation · no score, badge, or rank in this phase"],
    growthMay:
      "Explain the fictional definition, owner chain, evidence requirements, and unavailable states.",
    growthMustNot:
      "Create a profile fact, platform entitlement, assessment, credential, recognition, qualification, or economic signal.",
    participationBoundary:
      "Definition preview only. No person is participating, assessed, classified, or enrolled.",
    evidenceOwner: "LEARNING",
    evidenceRequirements: [
      "Versioned capability definition and permitted professional purpose",
      "Observable practice requirement with a stated limitation",
      "Source-owner reference and provenance class",
      "Human-review requirement for any future consequential use",
    ],
    refusedShortcuts: ["Self-claim", "Popularity", "Raw activity", "Recruiting or referrals"],
    completionOwner: "LEARNING",
    reviewOwner: "LEARNING",
    visibilityOwner: "IDENTITY",
    correctionOwner: "LEARNING",
    appealOwner: "LEARNING",
    privacyBoundary:
      "Founder-review-only fictional content. Public or named-person visibility is unsupported.",
    kaiAllowed:
      "Explain the definition, its owner, required evidence classes, and why no personal claim exists.",
    unsupportedStates: [
      "Credential or certification issuance",
      "Platform access or entitlement",
      "Named-person capability claim",
      "Economic or reputation mapping",
    ],
    unsupportedFixtureIds: [],
    economicBoundary:
      "This definition creates no eligibility, allocation, compensation, or promise of business results.",
  },
  {
    id: "development-pathway",
    label: "Professional-development pathway",
    shortLabel: "Development",
    purpose:
      "Show how a future operator learning pathway could separate preparation, practice, evidence, completion, and review.",
    canonicalOwner: "LEARNING",
    ownerExplanation:
      "Learning would own pathway definitions, assessment rules, and completion facts. Growth may explain a permitted projection only.",
    supportingOwners: ["Documents · future artifact reference only", "Identity · no profile fact in this phase"],
    growthMay:
      "Project a fictional pathway anatomy and owner-qualified state lanes.",
    growthMustNot:
      "Enroll, teach, assess, mark complete, issue a credential, update a profile, or infer professional competence.",
    participationBoundary:
      "No pathway enrollment, seat, cohort, instructor relationship, assessment, or completion record exists.",
    evidenceOwner: "LEARNING",
    evidenceRequirements: [
      "Learning objective tied to a professional operating capability",
      "Practice artifact with provenance and safe-use boundary",
      "Review rubric version and reviewer class",
      "Correction and supersession path",
    ],
    refusedShortcuts: ["Attendance alone", "Hours online", "Volume", "Purchases"],
    completionOwner: "LEARNING",
    reviewOwner: "LEARNING",
    visibilityOwner: "LEARNING",
    correctionOwner: "LEARNING",
    appealOwner: "LEARNING",
    privacyBoundary:
      "No learner identity, progress, assessment response, or instructor note is present.",
    kaiAllowed:
      "Prepare and explain a fixed fictional learning plan without personalization or enrollment.",
    unsupportedStates: [
      "Live class or course delivery",
      "Assessment result",
      "Credential or certification",
      "Employment or income outcome",
    ],
    unsupportedFixtureIds: [],
    economicBoundary:
      "Pathway activity creates no compensation, qualification, or earnings claim.",
  },
  {
    id: "mentorship",
    label: "Mentorship preparation and participation",
    shortLabel: "Mentorship",
    purpose:
      "Define a future B2B operator-development boundary while keeping matching, participation, and service delivery unavailable.",
    canonicalOwner: "OPERATOR_NETWORK",
    ownerExplanation:
      "Operator Network would own a future mentorship relationship and participation state; Meetings would own sessions and Documents would own protected notes or artifacts.",
    supportingOwners: ["Meetings · future session authority", "Documents · future protected artifact authority", "Membership · future role and scope authority"],
    growthMay:
      "Explain a fictional preparation format, owner handoffs, safety boundaries, and future unavailable states.",
    growthMustNot:
      "Match, screen, book, schedule, contract, pay, host, assess, or complete a mentorship relationship.",
    participationBoundary:
      "Future B2B operator professional development only. No live mentorship, consumer/client/file/case guidance, credit recommendation, dispute execution, representation, legal, tax, financial, employment, advance-fee, or business-opportunity advice is available.",
    evidenceOwner: "OPERATOR_NETWORK",
    evidenceRequirements: [
      "Professional-development goal and explicit scope boundary",
      "Future consent and role authority from the owning contexts",
      "Preparation artifact reference without private note content",
      "Human review for any future participation dispute",
    ],
    refusedShortcuts: ["Reciprocal acknowledgment", "Collusive confirmation", "Attendance alone", "Recruiting"],
    completionOwner: "OPERATOR_NETWORK",
    reviewOwner: "OPERATOR_NETWORK",
    visibilityOwner: "OPERATOR_NETWORK",
    correctionOwner: "OPERATOR_NETWORK",
    appealOwner: "OWNER_UNRESOLVED",
    privacyBoundary:
      "No mentor, operator, meeting, message, presence, note, protected attribute, or customer detail exists.",
    kaiAllowed:
      "Prepare and explain a fixed fictional mentorship brief; never match, schedule, judge, or participate.",
    unsupportedStates: [
      "Mentor match or screening",
      "Consent or participation",
      "Meeting or attendance",
      "Completion, credential, payment, or result claim",
      "Appeal until an independent owner is ratified",
    ],
    unsupportedFixtureIds: ["completed-unreviewed", "appeal-in-review"],
    economicBoundary:
      "Mentorship creates no compensation, allocation, qualification, or promised outcome in this phase.",
  },
  {
    id: "education",
    label: "Educational program and learning artifact",
    shortLabel: "Education",
    purpose:
      "Represent a future B2B operator education program and artifact-quality contract without delivering instruction.",
    canonicalOwner: "LEARNING",
    ownerExplanation:
      "Learning would own program definitions, learning artifacts, assessment policy, and completion. Marketplace would own any later listing or transaction.",
    supportingOwners: ["Documents · future protected bytes", "Marketplace · future commerce only after separate approval", "Identity · credential display unresolved and unsupported"],
    growthMay:
      "Explain fictional objectives, artifact requirements, provenance, accessibility, and review boundaries.",
    growthMustNot:
      "Create or deliver a class, webinar, course, credential, certification, listing, purchase, or instructor relationship.",
    participationBoundary:
      "Future B2B operator professional development only. No consumer-specific credit guidance, enrollment, instruction, assessment, credential, or result promise exists.",
    evidenceOwner: "LEARNING",
    evidenceRequirements: [
      "Clear professional learning objective",
      "Source attribution and limitation statement",
      "Accessible practice artifact specification",
      "Versioned human-review rubric",
    ],
    refusedShortcuts: ["Purchases", "Views", "Attendance alone", "Unattributed templates"],
    completionOwner: "LEARNING",
    reviewOwner: "LEARNING",
    visibilityOwner: "LEARNING",
    correctionOwner: "LEARNING",
    appealOwner: "LEARNING",
    privacyBoundary:
      "No learner, educator, submission, response, grade, or private feedback is represented.",
    kaiAllowed:
      "Prepare and explain a fixed fictional objective or artifact outline without teaching or evaluating a person.",
    unsupportedStates: [
      "Live program or webinar",
      "Enrollment or attendance",
      "Assessment or credential",
      "Marketplace listing or sale",
    ],
    unsupportedFixtureIds: [],
    economicBoundary:
      "Education activity creates no sale, compensation, qualification, or promised professional result.",
  },
  {
    id: "operator-contribution",
    label: "Operator-created contribution",
    shortLabel: "Created work",
    purpose:
      "Show why a generic contribution cannot become source truth until its destination owner is known.",
    canonicalOwner: "OWNER_UNRESOLVED",
    ownerExplanation:
      "There is no generic contribution owner. Learning owns educational artifacts, Community owns posts and moderation, Operator Network owns messages, Marketplace owns listings and commerce semantics, and Documents owns bytes.",
    supportingOwners: ["Destination owner required", "Documents · bytes only", "Growth · projection protocol only"],
    growthMay:
      "Explain destination-specific ownership and reject an ownerless contribution state.",
    growthMustNot:
      "Create a generic Contribution record, infer a destination, publish, list, recognize, rank, or accept created work.",
    participationBoundary:
      "No author, artifact, submission, destination, publication, listing, or review record exists.",
    evidenceOwner: "OWNER_UNRESOLVED",
    evidenceRequirements: [
      "Approved destination owner",
      "Provenance and authorship policy",
      "Purpose, audience, limitation, and privacy class",
      "Destination-owned review and correction route",
    ],
    refusedShortcuts: ["Self-review", "Copy volume", "Likes or views", "Plagiarism or template spam"],
    completionOwner: "OWNER_UNRESOLVED",
    reviewOwner: "OWNER_UNRESOLVED",
    visibilityOwner: "OWNER_UNRESOLVED",
    correctionOwner: "OWNER_UNRESOLVED",
    appealOwner: "OWNER_UNRESOLVED",
    privacyBoundary:
      "Unknown destination means hidden and unavailable. No content or record existence is disclosed.",
    kaiAllowed:
      "Explain why a destination owner is required and refuse to infer one.",
    unsupportedStates: [
      "Ownerless contribution",
      "Automatic publication",
      "Generic acceptance or recognition",
      "Any named-person or public visibility",
    ],
    unsupportedFixtureIds: [],
    economicBoundary:
      "Created work creates no recognition, eligibility, compensation, or earnings claim.",
  },
  {
    id: "community-contribution",
    label: "Community contribution",
    shortLabel: "Community",
    purpose:
      "Represent future contribution requirements without reading, creating, publishing, or moderating a Community post.",
    canonicalOwner: "COMMUNITY",
    ownerExplanation:
      "Community owns submission, publication, visibility, moderation, and correction. Growth may preview a fictional format only.",
    supportingOwners: ["Identity · future author reference", "Documents · future artifact bytes", "Reputation · no recognition state in this phase"],
    growthMay:
      "Explain fictional provenance, usefulness, privacy, moderation, and correction requirements.",
    growthMustNot:
      "Read or write Community, publish, moderate, count reactions, recognize an operator, or create a reputation fact.",
    participationBoundary:
      "No author, Community membership, post, audience, reaction, moderation, or publication state exists.",
    evidenceOwner: "COMMUNITY",
    evidenceRequirements: [
      "Named professional purpose and permitted audience class",
      "Source provenance and limitation",
      "No consumer, customer, worker, or organization PII",
      "Community-owned moderation and correction policy version",
    ],
    refusedShortcuts: ["Likes", "Views", "Followers", "Posting volume", "Recruiting or referrals"],
    completionOwner: "COMMUNITY",
    reviewOwner: "COMMUNITY",
    visibilityOwner: "COMMUNITY",
    correctionOwner: "COMMUNITY",
    appealOwner: "COMMUNITY",
    privacyBoundary:
      "Founder-review-only fictional format. Public, cross-organization, or named-peer visibility is unsupported.",
    kaiAllowed:
      "Explain a fixed fictional contribution format and Community ownership without drafting or publishing live content.",
    unsupportedStates: [
      "Published post",
      "Named author or audience",
      "Recognition, rank, score, or badge",
      "Cross-organization or public visibility",
    ],
    unsupportedFixtureIds: [],
    economicBoundary:
      "Community activity creates no qualification, allocation, compensation, or promise of results.",
  },
  {
    id: "organizational-stewardship",
    label: "Organizational stewardship",
    shortLabel: "Stewardship",
    purpose:
      "Separate organization stewardship scope from future health measurement, agency work, reputation, and economics.",
    canonicalOwner: "ORGANIZATIONS",
    ownerExplanation:
      "Organizations owns the organization entity and scope. Membership owns role and authority; Performance Intelligence would own health; Agency Command owns agency work.",
    supportingOwners: ["Membership · role and authority", "Performance Intelligence · future health projection", "Agency Command · tasks and routing"],
    growthMay:
      "Explain a fictional stewardship standard and the owner boundaries required for a future authorized projection.",
    growthMustNot:
      "Read organization data, infer authority, score health, assign work, evaluate named workers, qualify an agency, or create economic rights.",
    participationBoundary:
      "No organization, membership, operator, customer, health, task, retention, onboarding, or performance record is connected.",
    evidenceOwner: "PERFORMANCE_INTELLIGENCE",
    evidenceRequirements: [
      "Authorized organization scope and Membership authority",
      "Purpose-limited aggregate definition",
      "Performance Intelligence policy and provenance",
      "Human correction and review path without named-worker surveillance",
    ],
    refusedShortcuts: ["Headcount", "Paid retention", "Recruiting", "Operator purchases", "Credit outcomes"],
    completionOwner: "ORGANIZATIONS",
    reviewOwner: "PERFORMANCE_INTELLIGENCE",
    visibilityOwner: "ORGANIZATIONS",
    correctionOwner: "PERFORMANCE_INTELLIGENCE",
    appealOwner: "OWNER_UNRESOLVED",
    privacyBoundary:
      "No named operator assessment, presence, protected attribute, customer data, or private organization fact exists.",
    kaiAllowed:
      "Explain a fixed fictional stewardship standard and owner handoffs; never score, assign, judge, or act.",
    unsupportedStates: [
      "Organization health claim",
      "Named-worker evaluation",
      "Agency task or deadline",
      "Qualification, Growth Reputation, or allocation",
      "Appeal until an independent owner is ratified",
    ],
    unsupportedFixtureIds: ["appeal-in-review"],
    economicBoundary: GROWTH_CAPABILITY_AGENCY_BOUNDARY,
  },
] as const satisfies readonly CapabilityContractDefinition[]);

export interface CapabilityFixtureDefinition {
  id: CapabilityFixtureId;
  label: string;
  summary: string;
  availability: ProjectionAvailability;
  participation: string;
  evidence: string;
  completion: string;
  review: string;
  correction: string;
  appeal: string;
  visibility: string;
  detail: string;
}

export const CAPABILITY_FIXTURES = deepFreeze([
  {
    id: "overview",
    label: "Contract anatomy",
    summary: "A neutral orientation to owner boundaries and separate state lanes.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "No participation represented",
    evidence: "Requirements preview only",
    completion: "No completion represented",
    review: "Not requested",
    correction: "Preview path only",
    appeal: "Not applicable without a decision",
    visibility: "Founder review only",
    detail: "This fixture explains the contract; it makes no claim about a person or organization.",
  },
  {
    id: "empty",
    label: "No source record",
    summary: "No source-owned record is present and no favorable state is inferred.",
    availability: "SOURCE_MISSING",
    participation: "Not present",
    evidence: "Not present",
    completion: "Not present",
    review: "Not requested",
    correction: "Unavailable without a source fact",
    appeal: "Unavailable without a decision",
    visibility: "Record existence not disclosed",
    detail: "No source-owned record is present in this synthetic fixture. Growth shows no completion or evidence claim.",
  },
  {
    id: "preparing",
    label: "Preparation",
    summary: "Preparation is shown separately from participation, completion, and review.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "Preparing example · not participating",
    evidence: "Requirements visible · no submission",
    completion: "Not complete",
    review: "Not requested",
    correction: "Preview path only",
    appeal: "Not applicable without a decision",
    visibility: "Founder review only",
    detail: "This fixture displays fictional preparation only. Nothing has started, been submitted, or completed.",
  },
  {
    id: "completed-unreviewed",
    label: "Source completion / no review",
    summary: "A fictional source-completion example remains distinct from review and every consequential state.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "Fictional source participation ended",
    evidence: "Requirements-met example · not accepted",
    completion: "Fictional source-confirmed-state example",
    review: "Not reviewed",
    correction: "Source-owner path preview",
    appeal: "Not applicable without a review decision",
    visibility: "Founder review only",
    detail: "Completion here is fictional and is not a credential, certification, eligibility, endorsement, reputation fact, or economic signal.",
  },
  {
    id: "in-review",
    label: "Human review",
    summary: "A fictional evidence reference is under review with no acceptance or completion inference.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "No participation inference",
    evidence: "Fictional reference received",
    completion: "Unconfirmed",
    review: "Human review example · no decision",
    correction: "Available only for the source fact",
    appeal: "Unavailable until a review decision exists",
    visibility: "Authorized-reviewer concept only",
    detail: "This fixture displays a human-review boundary. Kai and Growth cannot decide it.",
  },
  {
    id: "changes-requested",
    label: "Correction needed",
    summary: "A fictional review asks the source owner to correct a specific fact or evidence defect.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "No change inferred",
    evidence: "Specific fictional defect identified",
    completion: "Unconfirmed while correction is reviewed",
    review: "Changes-requested example",
    correction: "Preview source-owner correction path",
    appeal: "Separate and unavailable without a decision policy",
    visibility: "Founder review only",
    detail: "A correction challenges a source fact. Growth can explain the destination but cannot open or resolve a case.",
  },
  {
    id: "source-corrected",
    label: "Source corrected",
    summary: "The fictional source owner changed a fact, so the earlier projection is superseded.",
    availability: "SOURCE_STALE",
    participation: "No new participation inference",
    evidence: "Prior fictional reference superseded",
    completion: "Prior projection no longer current",
    review: "Fresh review would be required",
    correction: "Fictional source correction acknowledged",
    appeal: "Not inferred",
    visibility: "Only the permitted summary is shown",
    detail: "The source owner changed this fictional record. The prior projection is superseded; Growth does not rewrite source truth.",
  },
  {
    id: "appeal-in-review",
    label: "Independent appeal review",
    summary: "A fictional decision appeal remains separate from source correction and requires a human reviewer.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "No effect while appeal is reviewed",
    evidence: "Underlying fictional decision reference only",
    completion: "No change inferred",
    review: "Prior fictional decision exists",
    correction: "Source fact unchanged",
    appeal: "Human-review-required example",
    visibility: "Authorized-reviewer concept only",
    detail: "An appeal challenges a decision, not a source fact. Growth and Kai cannot file, adjudicate, resolve, or change it.",
  },
  {
    id: "privacy-restricted",
    label: "Privacy restricted",
    summary: "Only a permitted fictional summary is rendered; restricted details do not exist in the fixture.",
    availability: "PRIVATE",
    participation: "Not disclosed",
    evidence: "Not disclosed",
    completion: "Not disclosed",
    review: "Not disclosed",
    correction: "Owner route only",
    appeal: "Owner route only",
    visibility: "Restricted · details absent",
    detail: "Details are restricted. Growth displays only the permitted summary; no hidden participant fields are present.",
  },
  {
    id: "unsupported",
    label: "Unsupported state",
    summary: GROWTH_CAPABILITY_UNSUPPORTED_COPY,
    availability: "UNSUPPORTED_CONTRACT_VERSION",
    participation: "No state inferred",
    evidence: "No state inferred",
    completion: "No state inferred",
    review: "No state inferred",
    correction: "Unavailable",
    appeal: "Unavailable",
    visibility: "Hidden / unavailable",
    detail: GROWTH_CAPABILITY_UNSUPPORTED_COPY,
  },
] as const satisfies readonly CapabilityFixtureDefinition[]);

export type CapabilityStateLaneId =
  | "availability"
  | "participation"
  | "evidence"
  | "completion"
  | "review"
  | "correction"
  | "appeal"
  | "visibility";

export interface CapabilityStateLane {
  id: CapabilityStateLaneId;
  label: string;
  owner: CanonicalCapabilityOwner;
  ownerLabel: string;
  value: string;
}

export interface CapabilityEvidenceItem {
  id: CapabilityEvidenceItemId;
  label: string;
  owner: CanonicalCapabilityOwner;
  ownerLabel: string;
  value: string;
}

export interface SupportedCapabilityProjection {
  kind: "SUPPORTED";
  header: Phase1BReviewHeader;
  contract: CapabilityContractDefinition;
  fixture: CapabilityFixtureDefinition;
  lanes: readonly CapabilityStateLane[];
  evidenceContract: readonly CapabilityEvidenceItem[];
  ownerResolved: boolean;
}

export interface UnsupportedCapabilityProjection {
  kind: "UNSUPPORTED";
  header: Phase1BReviewHeader;
  contract: null;
  fixture: CapabilityFixtureDefinition;
  lanes: readonly CapabilityStateLane[];
  ownerResolved: false;
  reason: typeof GROWTH_CAPABILITY_UNSUPPORTED_COPY;
}

export type CapabilityReviewProjection =
  | SupportedCapabilityProjection
  | UnsupportedCapabilityProjection;

type RawReviewParameter = string | readonly string[] | undefined;

function isSingleAllowed<T extends string>(
  value: RawReviewParameter,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function ownerLabel(owner: CanonicalCapabilityOwner): string {
  return CAPABILITY_OWNER_LABELS[owner];
}

function evidenceContractFor(
  contract: CapabilityContractDefinition,
): readonly CapabilityEvidenceItem[] {
  if (contract.canonicalOwner === "OWNER_UNRESOLVED") {
    return deepFreeze(CAPABILITY_EVIDENCE_ITEM_IDS.map((id) => ({
      id,
      label: id.replaceAll("-", " "),
      owner: "OWNER_UNRESOLVED" as const,
      ownerLabel: ownerLabel("OWNER_UNRESOLVED"),
      value: GROWTH_CAPABILITY_UNSUPPORTED_COPY,
    })));
  }

  const item = (
    id: CapabilityEvidenceItemId,
    label: string,
    owner: CanonicalCapabilityOwner,
    value: string,
  ): CapabilityEvidenceItem => ({ id, label, owner, ownerLabel: ownerLabel(owner), value });

  return deepFreeze([
    item(
      "professional-purpose",
      "Professional purpose",
      contract.canonicalOwner,
      contract.purpose,
    ),
    item(
      "source-owner",
      "Source owner",
      contract.evidenceOwner,
      `${ownerLabel(contract.evidenceOwner)} would own any future source fact; no source is connected in this Preview.`,
    ),
    item(
      "subject-scope",
      "Subject and scope",
      contract.canonicalOwner,
      `Synthetic ${contract.label.toLowerCase()} review scope only; no person, participant, organization, or customer is represented.`,
    ),
    item(
      "evidence-category",
      "Evidence category",
      contract.evidenceOwner,
      "Purpose-bound professional capability evidence preview; no live artifact, submission, or verification exists.",
    ),
    item(
      "occurrence-source-confirmation",
      "Occurrence / source confirmation",
      contract.evidenceOwner,
      "A future source owner would have to confirm occurrence. Activity, attendance, popularity, recruiting, referrals, and self-claim cannot substitute.",
    ),
    item(
      "reviewer-role",
      "Reviewer role",
      contract.reviewOwner,
      contract.reviewOwner === "OWNER_UNRESOLVED"
        ? "No reviewer authority is inferred; human review is unavailable until an owner is ratified."
        : `A future authorized human reviewer under ${ownerLabel(contract.reviewOwner)} would decide; Growth and Kai cannot.`,
    ),
    item(
      "policy-contract-version",
      "Policy / contract version",
      "GROWTH",
      `Growth synthetic review grammar v${GROWTH_CAPABILITY_CONTRACT_VERSION}; any future source policy and version remain unconnected.`,
    ),
    item(
      "visibility",
      "Visibility",
      contract.visibilityOwner,
      contract.privacyBoundary,
    ),
    item(
      "correction-route",
      "Correction route",
      contract.correctionOwner,
      contract.correctionOwner === "OWNER_UNRESOLVED"
        ? "Unavailable until a source-fact correction owner is ratified."
        : `A future correction would challenge source truth under ${ownerLabel(contract.correctionOwner)}; Growth cannot open or resolve it.`,
    ),
    item(
      "appeal-route",
      "Appeal route",
      contract.appealOwner,
      contract.appealOwner === "OWNER_UNRESOLVED"
        ? "Unavailable until an independent decision-appeal owner is ratified."
        : `A future appeal would challenge a review decision under ${ownerLabel(contract.appealOwner)}; it would not rewrite source truth.`,
    ),
    item(
      "expiry-supersession",
      "Expiry / supersession",
      contract.evidenceOwner,
      "Any future projection would require an explicit expiry or supersession rule and fail closed when stale; no live validity period exists in this fixture.",
    ),
  ]);
}

function lanesFor(
  contract: CapabilityContractDefinition | null,
  fixture: CapabilityFixtureDefinition,
): readonly CapabilityStateLane[] {
  const noOwner: CanonicalCapabilityOwner = "OWNER_UNRESOLVED";
  const lane = (
    id: CapabilityStateLaneId,
    label: string,
    owner: CanonicalCapabilityOwner,
    value: string,
  ): CapabilityStateLane => ({ id, label, owner, ownerLabel: ownerLabel(owner), value });

  return deepFreeze([
    lane("availability", "Availability", "GROWTH", fixture.availability),
    lane("participation", "Participation", contract?.canonicalOwner ?? noOwner, fixture.participation),
    lane("evidence", "Evidence", contract?.evidenceOwner ?? noOwner, fixture.evidence),
    lane("completion", "Completion", contract?.completionOwner ?? noOwner, fixture.completion),
    lane("review", "Review", contract?.reviewOwner ?? noOwner, fixture.review),
    lane("correction", "Correction", contract?.correctionOwner ?? noOwner, fixture.correction),
    lane("appeal", "Appeal", contract?.appealOwner ?? noOwner, fixture.appeal),
    lane("visibility", "Visibility", contract?.visibilityOwner ?? noOwner, fixture.visibility),
  ]);
}

function unsupportedProjection(): UnsupportedCapabilityProjection {
  const fixture = CAPABILITY_FIXTURES.find((item) => item.id === "unsupported")!;
  return deepFreeze({
    kind: "UNSUPPORTED",
    header: {
      contractId: "unsupported",
      contractVersion: GROWTH_CAPABILITY_CONTRACT_VERSION,
      phaseLabel: GROWTH_EXPERIENCE_PHASE_1B_STATUS,
      mode: "SYNTHETIC_FOUNDER_REVIEW",
      synthetic: true,
      canonicalOwner: "OWNER_UNRESOLVED",
      projectionOwner: "GROWTH",
      source: { kind: "SYNTHETIC_FIXTURE", ref: GROWTH_CAPABILITY_FIXTURE_SOURCE },
      visibility: "FOUNDER_REVIEW_ONLY",
      availability: "UNSUPPORTED_CONTRACT_VERSION",
    },
    contract: null,
    fixture,
    lanes: lanesFor(null, fixture),
    ownerResolved: false,
    reason: GROWTH_CAPABILITY_UNSUPPORTED_COPY,
  });
}

export function resolveCapabilityReviewRequest(
  contractInput?: RawReviewParameter,
  fixtureInput?: RawReviewParameter,
): CapabilityReviewProjection {
  const bothMissing = contractInput === undefined && fixtureInput === undefined;
  if (!bothMissing && (contractInput === undefined || fixtureInput === undefined)) {
    return unsupportedProjection();
  }

  const contractValue = bothMissing ? CAPABILITY_CONTRACT_IDS[0] : contractInput;
  const fixtureValue = bothMissing ? CAPABILITY_FIXTURE_IDS[0] : fixtureInput;

  if (
    !isSingleAllowed(contractValue, CAPABILITY_CONTRACT_IDS) ||
    !isSingleAllowed(fixtureValue, CAPABILITY_FIXTURE_IDS)
  ) {
    return unsupportedProjection();
  }

  const contract = CAPABILITY_CONTRACTS.find((item) => item.id === contractValue);
  const fixture = CAPABILITY_FIXTURES.find((item) => item.id === fixtureValue);
  if (!contract || !fixture) return unsupportedProjection();
  if ((contract.unsupportedFixtureIds as readonly CapabilityFixtureId[]).includes(fixture.id)) {
    return unsupportedProjection();
  }

  const ownerResolved = contract.canonicalOwner !== "OWNER_UNRESOLVED";
  const effectiveFixture: CapabilityFixtureDefinition = ownerResolved
    ? fixture
    : deepFreeze({
        ...fixture,
        summary:
          "No canonical destination owner has been approved. This professional capability remains unsupported.",
        availability: "OWNER_UNRESOLVED",
        participation: "No state inferred",
        evidence: "No state inferred",
        completion: "No state inferred",
        review: "No state inferred",
        correction: "Unavailable until a source owner exists",
        appeal: "Unavailable until a decision owner exists",
        visibility: "Hidden / unavailable",
        detail: GROWTH_CAPABILITY_UNSUPPORTED_COPY,
      });

  return deepFreeze({
    kind: "SUPPORTED",
    header: {
      contractId: contract.id,
      contractVersion: GROWTH_CAPABILITY_CONTRACT_VERSION,
      phaseLabel: GROWTH_EXPERIENCE_PHASE_1B_STATUS,
      mode: "SYNTHETIC_FOUNDER_REVIEW",
      synthetic: true,
      canonicalOwner: contract.canonicalOwner,
      projectionOwner: "GROWTH",
      source: { kind: "SYNTHETIC_FIXTURE", ref: GROWTH_CAPABILITY_FIXTURE_SOURCE },
      visibility: "FOUNDER_REVIEW_ONLY",
      availability: effectiveFixture.availability,
    },
    contract,
    fixture: effectiveFixture,
    lanes: lanesFor(contract, effectiveFixture),
    evidenceContract: evidenceContractFor(contract),
    ownerResolved,
  });
}

export const CAPABILITY_KAI_QUESTIONS = deepFreeze([
  { id: "explain-capability", label: "Explain this professional capability" },
  { id: "explain-owner", label: "Why does this owner control the record?" },
  { id: "explain-evidence", label: "What evidence does this fixture require?" },
  { id: "explain-incomplete", label: "What remains incomplete?" },
  { id: "explain-correction", label: "What can be corrected?" },
  { id: "explain-appeal", label: "When is an appeal available?" },
  { id: "explain-unsupported", label: "Why is this state unsupported?" },
] as const satisfies readonly { id: CapabilityKaiQuestionId; label: string }[]);

export interface CapabilityKaiExplanation {
  questionId: CapabilityKaiQuestionId | "unsupported";
  title: string;
  summary: string;
  ownerExplanation: string;
  evidenceChecklist: readonly string[];
  permittedReviewSteps: readonly string[];
  refusals: readonly string[];
  fixtureSource: typeof GROWTH_CAPABILITY_FIXTURE_SOURCE;
  receipt: typeof GROWTH_CAPABILITY_KAI_RECEIPT;
}

export function resolveCapabilityKaiExplanation(
  projection: CapabilityReviewProjection,
  questionInput: string,
): CapabilityKaiExplanation {
  if (
    projection.kind !== "SUPPORTED" ||
    !projection.ownerResolved ||
    projection.fixture.id === "unsupported" ||
    !CAPABILITY_KAI_QUESTION_IDS.includes(questionInput as CapabilityKaiQuestionId)
  ) {
    return deepFreeze({
      questionId: "unsupported",
      title: "Unsupported explanation",
      summary: GROWTH_CAPABILITY_UNSUPPORTED_COPY,
      ownerExplanation: "No owner or source fact has been inferred.",
      evidenceChecklist: [],
      permittedReviewSteps: ["Select an approved synthetic contract and fixture."],
      refusals: ["No fallback to a model, network, storage, live record, or favorable state."],
      fixtureSource: GROWTH_CAPABILITY_FIXTURE_SOURCE,
      receipt: GROWTH_CAPABILITY_KAI_RECEIPT,
    });
  }

  const contract = projection.contract;
  const questionId = questionInput as CapabilityKaiQuestionId;
  const summaries: Readonly<Record<CapabilityKaiQuestionId, string>> = {
    "explain-capability": `This fixture displays the internal representation rules for ${contract.label.toLowerCase()}; it makes no claim about a person or organization.`,
    "explain-owner": contract.ownerExplanation,
    "explain-evidence": `The evidence-requirement preview is owned by ${ownerLabel(contract.evidenceOwner)} and remains fictional.`,
    "explain-incomplete": `${projection.fixture.detail} Completion, review, visibility, and every consequential state remain separate.`,
    "explain-correction": `A correction would challenge a source fact and route to ${ownerLabel(contract.correctionOwner)}. Growth can explain that destination only.`,
    "explain-appeal": contract.appealOwner === "OWNER_UNRESOLVED"
      ? "No independent appeal owner has been ratified for this contract, so appeal remains unavailable."
      : `An appeal would challenge a review decision and route to a future human process owned by ${ownerLabel(contract.appealOwner)}; it would not change source truth automatically.`,
    "explain-unsupported": contract.unsupportedStates.length > 0
      ? `This contract fails closed for ${contract.unsupportedStates.join(", ").toLowerCase()}.`
      : GROWTH_CAPABILITY_UNSUPPORTED_COPY,
  };

  return deepFreeze({
    questionId,
    title: CAPABILITY_KAI_QUESTIONS.find((question) => question.id === questionId)!.label,
    summary: summaries[questionId],
    ownerExplanation: contract.ownerExplanation,
    evidenceChecklist: contract.evidenceRequirements,
    permittedReviewSteps: [
      "Inspect the fictional owner-qualified state lanes.",
      "Compare the evidence requirement with its refused shortcuts.",
      "Preview the correction or appeal boundary without submitting anything.",
    ],
    refusals: [
      contract.growthMustNot,
      "Kai cannot review, approve, correct, appeal, enroll, schedule, publish, purchase, or change a record.",
    ],
    fixtureSource: GROWTH_CAPABILITY_FIXTURE_SOURCE,
    receipt: GROWTH_CAPABILITY_KAI_RECEIPT,
  });
}

export const CAPABILITY_CONTRACT_REJECTION_EXAMPLES = deepFreeze([
  "Self-authored evidence reviewed by the same actor",
  "Reciprocal or collusive acknowledgments",
  "Duplicate or replayed evidence",
  "Completion farming or volume incentives",
  "Likes, views, followers, attendance, referrals, recruiting, or popularity used as quality",
  "Plagiarism, template spam, or fabricated sources",
  "Reviewer conflict, capture, retaliation, or coercion",
  "Consumer, customer, operator, or organization PII embedded in a contribution",
  "Unauthorized named-worker, cross-organization, or public visibility",
  "Superseded, corrected, stale, or conflicting evidence",
] as const);
