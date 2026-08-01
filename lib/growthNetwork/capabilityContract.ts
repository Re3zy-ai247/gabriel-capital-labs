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
  "GROWTH EXPERIENCE PHASE 1A — APPROVED FOUNDER PREVIEW ONLY" as const;
export const GROWTH_EXPERIENCE_PHASE_1B_WORK_STATUS =
  "GROWTH EXPERIENCE PHASE 1B WORK — AUTHORIZED NON-MONETARY CONTRACT WORK" as const;
export const GROWTH_EXPERIENCE_PHASE_1B_CONTRACT_STATUS =
  "GROWTH EXPERIENCE PHASE 1B CONTRACT — NOT FOUNDER-RATIFIED" as const;
export const GROWTH_EXPERIENCE_PHASE_1B_R_STATUS =
  "GROWTH EXPERIENCE PHASE 1B-R — AUTHORIZED REMEDIATION IN PROGRESS" as const;
export const GROWTH_LIVE_ECONOMICS_STATUS =
  "LIVE ECONOMICS — NO-GO" as const;
export const GROWTH_ACTIVATION_STATUS =
  "PUBLIC, PARTICIPANT, PAID, OR PRODUCTION ACTIVATION — NOT AUTHORIZED" as const;

export const GROWTH_CAPABILITY_REVIEW_DISCLOSURE =
  "Founder review · Synthetic capability-contract fixtures · No live Growth program. Nothing shown is a participant record, enrollment, mentor match, course, contribution, Community post, organization assessment, credential, certification, opportunity, qualification, Growth Reputation record, compensation, or promise of business or credit results. Growth Experience consumes no participant input or participant record and writes none. The inherited application shell may read authentication/session, theme, and presentation state; Growth Experience does not consume or mutate those reads. No action is taken." as const;

export const GROWTH_CAPABILITY_REVIEW_SUMMARY =
  "Founder review · Synthetic · Non-monetary · Production hard-off" as const;

export const GROWTH_CAPABILITY_INTERNAL_CONTRACT_NOTICE =
  "Internal product contract for how future professional capability information may be represented. It is not a participant agreement, enrollment, credential, platform entitlement, or offer." as const;

export const GROWTH_CAPABILITY_UNSUPPORTED_COPY =
  "Unsupported review state · unavailable in this Preview. No status, eligibility, completion, review, or action has been inferred." as const;

export const GROWTH_CAPABILITY_AGENCY_BOUNDARY =
  "No live Growth Distribution. These stewardship examples create no eligibility, allocation, obligation, or payment right. Recruiting is not rewarded." as const;

export const GROWTH_CAPABILITY_KAI_RECEIPT =
  "Canonical Kai is represented only by a deterministic route-local synthetic explanation mode. This is not a separate Kai identity or authority. No person, organization, evidence, eligibility, or opportunity was analyzed. No model, memory, persistence, tool, or action capability was used. Nothing was saved, submitted, reviewed, corrected, appealed, assigned, scheduled, published, enrolled, purchased, or changed." as const;

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

export type CapabilityOwnerReference =
  | "IDENTITY"
  | "ORGANIZATIONS"
  | "MEMBERSHIP"
  | "LEARNING"
  | "MENTORSHIP"
  | "COMMUNITY"
  | "OPERATOR_NETWORK"
  | "MARKETPLACE"
  | "REPUTATION"
  | "PERFORMANCE_INTELLIGENCE"
  | "AGENCY_COMMAND"
  | "MEETINGS"
  | "DOCUMENTS"
  | "KAI"
  | "GROWTH_EXPERIENCE"
  | "OWNER_UNRESOLVED";

export type CapabilityOwnerMaturity =
  | "RATIFIED_ACTIVE"
  | "BUILT_DORMANT"
  | "PROPOSED"
  | "FUTURE_OWNED"
  | "OWNER_UNRESOLVED";

export type CapabilityReviewResultKind =
  | "SUPPORTED_SYNTHETIC_REVIEW"
  | "PROPOSED"
  | "OWNER_UNRESOLVED"
  | "UNSUPPORTED"
  | "INVALID";

export type CapabilityKnownDecisionKind = Exclude<
  CapabilityReviewResultKind,
  "INVALID"
>;

export const CAPABILITY_OWNER_LABELS = deepFreeze({
  IDENTITY: "Identity",
  ORGANIZATIONS: "Organizations",
  MEMBERSHIP: "Membership",
  LEARNING: "Learning (proposed candidate)",
  MENTORSHIP: "Mentorship (proposed context)",
  COMMUNITY: "Community (proposed context)",
  OPERATOR_NETWORK: "Operator Network",
  MARKETPLACE: "Marketplace (future-owned)",
  REPUTATION: "Reputation",
  PERFORMANCE_INTELLIGENCE: "Performance Intelligence (proposed)",
  AGENCY_COMMAND: "Agency Command",
  MEETINGS: "Meetings (future/unresolved)",
  DOCUMENTS: "Documents (future/unresolved)",
  KAI: "Kai",
  GROWTH_EXPERIENCE: "Growth Experience",
  OWNER_UNRESOLVED: "Owner unresolved",
} as const satisfies Readonly<Record<CapabilityOwnerReference, string>>);

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
  contractId: CapabilityContractId | "invalid";
  contractVersion: typeof GROWTH_CAPABILITY_CONTRACT_VERSION;
  phaseLabel: typeof GROWTH_EXPERIENCE_PHASE_1B_WORK_STATUS;
  contractStatus: typeof GROWTH_EXPERIENCE_PHASE_1B_CONTRACT_STATUS;
  remediationStatus: typeof GROWTH_EXPERIENCE_PHASE_1B_R_STATUS;
  mode: "SYNTHETIC_FOUNDER_REVIEW";
  synthetic: true;
  live: false;
  authorized: false;
  ownerReference: CapabilityOwnerReference;
  ownerMaturity: CapabilityOwnerMaturity;
  projectionOwner: "GROWTH_EXPERIENCE";
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
  ownerReference: CapabilityOwnerReference;
  ownerMaturity: CapabilityOwnerMaturity;
  candidateOwnerReference?: CapabilityOwnerReference;
  registryEvidence: string;
  ownerExplanation: string;
  supportingOwners: readonly string[];
  growthMay: string;
  growthMustNot: string;
  participationBoundary: string;
  evidenceOwner: CapabilityOwnerReference;
  evidenceRequirements: readonly string[];
  refusedShortcuts: readonly string[];
  completionOwner: CapabilityOwnerReference;
  reviewOwner: CapabilityOwnerReference;
  visibilityOwner: CapabilityOwnerReference;
  correctionOwner: CapabilityOwnerReference;
  appealOwner: CapabilityOwnerReference;
  privacyBoundary: string;
  kaiAllowed: string;
  unsupportedStates: readonly string[];
  economicBoundary: string;
}

export const CAPABILITY_CONTRACTS = deepFreeze([
  {
    id: "professional-capability",
    label: "Professional capability",
    shortLabel: "Capability",
    purpose:
      "Represent a future professional capability definition without claiming that any person possesses it.",
    ownerReference: "OWNER_UNRESOLVED",
    ownerMaturity: "OWNER_UNRESOLVED",
    candidateOwnerReference: "LEARNING",
    registryEvidence:
      "The frozen ownership registry has no Learning owner; Academy is a product surface, not a capability-truth authority.",
    ownerExplanation:
      "Learning is only a proposed candidate. No registry-resolved owner may define or attest this capability yet.",
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
    economicBoundary:
      "This definition creates no eligibility, allocation, compensation, or promise of business results.",
  },
  {
    id: "development-pathway",
    label: "Professional-development pathway",
    shortLabel: "Development",
    purpose:
      "Show how a future operator learning pathway could separate preparation, practice, evidence, completion, and review.",
    ownerReference: "OWNER_UNRESOLVED",
    ownerMaturity: "OWNER_UNRESOLVED",
    candidateOwnerReference: "LEARNING",
    registryEvidence:
      "The frozen ownership registry has no Learning owner for pathways, assessment, or completion.",
    ownerExplanation:
      "Learning is a proposed candidate only. Pathway, assessment, and completion authority remain unresolved.",
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
    economicBoundary:
      "Pathway activity creates no compensation, qualification, or earnings claim.",
  },
  {
    id: "mentorship",
    label: "Mentorship preparation and participation",
    shortLabel: "Mentorship",
    purpose:
      "Define a future B2B operator-development boundary while keeping matching, participation, and service delivery unavailable.",
    ownerReference: "OWNER_UNRESOLVED",
    ownerMaturity: "OWNER_UNRESOLVED",
    candidateOwnerReference: "MENTORSHIP",
    registryEvidence:
      "The frozen registry resolves Operator Network messaging only; mentorship relationship and service truth require a future ownership decision.",
    ownerExplanation:
      "Operator Network is registry-resolved only for messaging. A mentorship extension is proposed, while Meetings and Documents remain future/unresolved.",
    supportingOwners: ["Meetings · future session authority", "Documents · future protected artifact authority", "Membership · future role and scope authority"],
    growthMay:
      "Explain a fictional preparation format, owner handoffs, safety boundaries, and future unavailable states.",
    growthMustNot:
      "Match, screen, book, schedule, contract, pay, host, assess, or complete a mentorship relationship.",
    participationBoundary:
      "Future B2B operator professional development only. No live mentorship, consumer/client/file/case guidance, credit recommendation, dispute execution, representation, legal, tax, financial, employment, advance-fee, or business-opportunity advice is available.",
    evidenceOwner: "OWNER_UNRESOLVED",
    evidenceRequirements: [
      "Professional-development goal and explicit scope boundary",
      "Future consent and role authority from the owning contexts",
      "Preparation artifact reference without private note content",
      "Human review for any future participation dispute",
    ],
    refusedShortcuts: ["Reciprocal acknowledgment", "Collusive confirmation", "Attendance alone", "Recruiting"],
    completionOwner: "OWNER_UNRESOLVED",
    reviewOwner: "OWNER_UNRESOLVED",
    visibilityOwner: "OWNER_UNRESOLVED",
    correctionOwner: "OWNER_UNRESOLVED",
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
    economicBoundary:
      "Mentorship creates no compensation, allocation, qualification, or promised outcome in this phase.",
  },
  {
    id: "education",
    label: "Educational program and learning artifact",
    shortLabel: "Education",
    purpose:
      "Represent a future B2B operator education program and artifact-quality contract without delivering instruction.",
    ownerReference: "OWNER_UNRESOLVED",
    ownerMaturity: "OWNER_UNRESOLVED",
    candidateOwnerReference: "LEARNING",
    registryEvidence:
      "The frozen ownership registry has no Learning owner and records certification issuance as absent/future Identity work.",
    ownerExplanation:
      "Learning is a proposed candidate only. Program, assessment, completion, credential, and certification authority remain unresolved.",
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
    economicBoundary:
      "Education activity creates no sale, compensation, qualification, or promised professional result.",
  },
  {
    id: "operator-contribution",
    label: "Operator-created contribution",
    shortLabel: "Created work",
    purpose:
      "Show why a generic contribution cannot become source truth until its destination owner is known.",
    ownerReference: "OWNER_UNRESOLVED",
    ownerMaturity: "OWNER_UNRESOLVED",
    registryEvidence:
      "No generic contribution owner exists in the frozen registry; a destination-specific owner is required before any operational state.",
    ownerExplanation:
      "There is no generic contribution owner. Candidate destinations remain proposed or scope-limited and cannot be inferred by Growth Experience.",
    supportingOwners: ["Destination owner required", "Documents · bytes only", "Growth · projection protocol only"],
    growthMay:
      "Explain destination-specific ownership and reject an ownerless contribution state.",
    growthMustNot:
      "Create a generic Contribution record, infer a destination, publish, list, recognize, rank, or accept created work.",
    participationBoundary:
      "No author, artifact, submission, destination, publication, listing, or review record exists.",
    evidenceOwner: "OWNER_UNRESOLVED",
    evidenceRequirements: [
      "Registry-resolved destination owner",
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
    economicBoundary:
      "Created work creates no recognition, eligibility, compensation, or earnings claim.",
  },
  {
    id: "community-contribution",
    label: "Community contribution",
    shortLabel: "Community",
    purpose:
      "Represent future contribution requirements without reading, creating, publishing, or moderating a Community post.",
    ownerReference: "COMMUNITY",
    ownerMaturity: "PROPOSED",
    registryEvidence:
      "Community contribution semantics are not a sole-owner row in the frozen registry; the live surface does not ratify a general contribution authority.",
    ownerExplanation:
      "Community is a proposed context for submission, publication, visibility, moderation, and correction; this phase establishes no canonical ownership.",
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
    economicBoundary:
      "Community activity creates no qualification, allocation, compensation, or promise of results.",
  },
  {
    id: "organizational-stewardship",
    label: "Organizational stewardship",
    shortLabel: "Stewardship",
    purpose:
      "Separate organization stewardship scope from future health measurement, agency work, reputation, and economics.",
    ownerReference: "ORGANIZATIONS",
    ownerMaturity: "BUILT_DORMANT",
    registryEvidence:
      "The frozen registry resolves durable Organization scope as built and dormant; stewardship assessment and Performance Intelligence remain proposed.",
    ownerExplanation:
      "Organizations may anchor synthetic scope only. Stewardship assessment, health, performance, and improvement meaning remain proposed and non-operational.",
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
    economicBoundary: GROWTH_CAPABILITY_AGENCY_BOUNDARY,
  },
] as const satisfies readonly CapabilityContractDefinition[]);

export const CAPABILITY_SEMANTIC_LAWS = deepFreeze([
  "Completion is not approval.",
  "Correction is not appeal.",
  "Submission is not acceptance.",
  "Supported synthetic review is not authorization.",
  "Synthetic is not live.",
  "Visible is not public.",
  "Reviewable is not ratified.",
  "Evidence-present is not verified.",
  "Qualification is not eligibility.",
  "Proposed ownership is not canonical ownership.",
] as const);

export type CapabilityFailClosedResult =
  | "UNSUPPORTED"
  | "OWNER_UNRESOLVED"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTING_STATE"
  | "MALFORMED"
  | "NOT_AUTHORIZED";

export interface CapabilitySupportedCompatibilityContract {
  requiredOwnerState: string;
  requiredEvidenceState: string;
  allowedPresentationBehavior: string;
  prohibitedInference: string;
  correctionSemantics: string;
  appealSemantics: string;
  failClosedResult: CapabilityFailClosedResult;
}

export interface CapabilitySupportedFixtureDecision {
  kind: "SUPPORTED_SYNTHETIC_REVIEW";
  rationale: string;
  compatibility: CapabilitySupportedCompatibilityContract;
}

export interface CapabilityClosedFixtureDecision {
  kind: Exclude<CapabilityKnownDecisionKind, "SUPPORTED_SYNTHETIC_REVIEW">;
  rationale: string;
}

export type CapabilityFixtureDecision =
  | CapabilitySupportedFixtureDecision
  | CapabilityClosedFixtureDecision;

function decision(
  kind: CapabilityClosedFixtureDecision["kind"],
  rationale: string,
): CapabilityClosedFixtureDecision {
  return { kind, rationale };
}

function supportedDecision(
  rationale: string,
  compatibility: CapabilitySupportedCompatibilityContract,
): CapabilitySupportedFixtureDecision {
  return { kind: "SUPPORTED_SYNTHETIC_REVIEW", rationale, compatibility };
}

// Literal 7 × 10 policy table. Every known pair is classified. Nothing falls
// through to a favorable default, and every favorable/proposed result carries
// a pair-specific written rationale.
export const CAPABILITY_FIXTURE_DECISIONS = deepFreeze({
  "professional-capability": {
    overview: decision("OWNER_UNRESOLVED", "Learning is only a candidate owner; even the orientation view remains non-operational."),
    empty: decision("OWNER_UNRESOLVED", "An empty capability definition still lacks a registry-resolved definition owner."),
    preparing: decision("OWNER_UNRESOLVED", "Preparation cannot be attributed while capability-definition ownership is unresolved."),
    "completed-unreviewed": decision("OWNER_UNRESOLVED", "A capability definition cannot acquire a completion state without an authorized source owner."),
    "in-review": decision("OWNER_UNRESOLVED", "No review authority exists for the proposed capability definition."),
    "changes-requested": decision("OWNER_UNRESOLVED", "No source-fact correction owner exists for this capability definition."),
    "source-corrected": decision("OWNER_UNRESOLVED", "No source owner exists to issue or supersede a capability fact."),
    "appeal-in-review": decision("OWNER_UNRESOLVED", "No decision owner or independent appeal owner is registry-resolved."),
    "privacy-restricted": decision("OWNER_UNRESOLVED", "Privacy restriction cannot make an ownerless capability state operational."),
    unsupported: decision("UNSUPPORTED", "The explicit unsupported fixture always renders the generic closed state."),
  },
  "development-pathway": {
    overview: decision("OWNER_UNRESOLVED", "The pathway can be described only as an unresolved proposal because Learning is not a registry owner."),
    empty: decision("OWNER_UNRESOLVED", "An empty pathway still requires a registry-resolved pathway owner."),
    preparing: decision("OWNER_UNRESOLVED", "Preparation cannot become pathway participation without an authorized owner."),
    "completed-unreviewed": decision("OWNER_UNRESOLVED", "Completion authority is unresolved and cannot be simulated as operational."),
    "in-review": decision("OWNER_UNRESOLVED", "No assessment or review authority is registry-resolved."),
    "changes-requested": decision("OWNER_UNRESOLVED", "No pathway source owner exists to request a source correction."),
    "source-corrected": decision("OWNER_UNRESOLVED", "No pathway source owner exists to supersede a fact."),
    "appeal-in-review": decision("OWNER_UNRESOLVED", "No independent pathway appeal owner is registry-resolved."),
    "privacy-restricted": decision("OWNER_UNRESOLVED", "A privacy boundary does not establish pathway ownership."),
    unsupported: decision("UNSUPPORTED", "The explicit unsupported fixture always renders the generic closed state."),
  },
  mentorship: {
    overview: decision("PROPOSED", "A boundary-only mentorship orientation may name the proposed context without creating a relationship."),
    empty: decision("OWNER_UNRESOLVED", "An empty relationship record still requires a future mentorship owner."),
    preparing: decision("PROPOSED", "A fictional preparation checklist is reviewable while matching, participation, and service delivery remain unavailable."),
    "completed-unreviewed": decision("OWNER_UNRESOLVED", "Mentorship completion has no registry-resolved relationship or completion owner."),
    "in-review": decision("OWNER_UNRESOLVED", "Mentorship review authority is not established by Operator Network messaging ownership."),
    "changes-requested": decision("OWNER_UNRESOLVED", "No mentorship source owner exists to receive a source correction."),
    "source-corrected": decision("OWNER_UNRESOLVED", "No mentorship source owner exists to supersede a relationship fact."),
    "appeal-in-review": decision("OWNER_UNRESOLVED", "No independent mentorship decision or appeal owner is registry-resolved."),
    "privacy-restricted": decision("PROPOSED", "A deny-by-default privacy example can be reviewed without revealing or asserting a relationship."),
    unsupported: decision("UNSUPPORTED", "The explicit unsupported fixture always renders the generic closed state."),
  },
  education: {
    overview: decision("OWNER_UNRESOLVED", "Learning is only a candidate owner, so the education program remains non-operational."),
    empty: decision("OWNER_UNRESOLVED", "An empty program still lacks a registry-resolved program owner."),
    preparing: decision("OWNER_UNRESOLVED", "Preparation cannot imply enrollment, instruction, or participation without an owner."),
    "completed-unreviewed": decision("OWNER_UNRESOLVED", "No program completion or credential authority is registry-resolved."),
    "in-review": decision("OWNER_UNRESOLVED", "No assessment or artifact-review owner is registry-resolved."),
    "changes-requested": decision("OWNER_UNRESOLVED", "No education source owner exists to receive a correction."),
    "source-corrected": decision("OWNER_UNRESOLVED", "No education source owner exists to supersede a record."),
    "appeal-in-review": decision("OWNER_UNRESOLVED", "No independent education appeal owner is registry-resolved."),
    "privacy-restricted": decision("OWNER_UNRESOLVED", "Privacy restriction cannot establish program or artifact ownership."),
    unsupported: decision("UNSUPPORTED", "The explicit unsupported fixture always renders the generic closed state."),
  },
  "operator-contribution": {
    overview: decision("OWNER_UNRESOLVED", "A generic contribution has no destination owner and remains closed."),
    empty: decision("OWNER_UNRESOLVED", "An empty contribution still cannot infer a destination owner."),
    preparing: decision("OWNER_UNRESOLVED", "Preparation cannot select a destination or ownership context by implication."),
    "completed-unreviewed": decision("OWNER_UNRESOLVED", "Completion cannot exist for an ownerless contribution."),
    "in-review": decision("OWNER_UNRESOLVED", "No destination review authority exists."),
    "changes-requested": decision("OWNER_UNRESOLVED", "No source owner exists to receive a contribution correction."),
    "source-corrected": decision("OWNER_UNRESOLVED", "No source owner exists to supersede an ownerless contribution."),
    "appeal-in-review": decision("OWNER_UNRESOLVED", "No review decision or appeal owner exists."),
    "privacy-restricted": decision("OWNER_UNRESOLVED", "Hidden visibility cannot make an ownerless contribution operational."),
    unsupported: decision("UNSUPPORTED", "The explicit unsupported fixture always renders the generic closed state."),
  },
  "community-contribution": {
    overview: decision("PROPOSED", "A boundary-only Community contribution orientation is reviewable as a proposed context."),
    empty: decision("PROPOSED", "A fictional empty state may demonstrate absence without asserting a live Community record."),
    preparing: decision("PROPOSED", "A fictional preparation state may explain provenance requirements without accepting a submission."),
    "completed-unreviewed": decision("PROPOSED", "A fictional completion example states that submission and acceptance were not assessed."),
    "in-review": decision("PROPOSED", "A fictional receipt-under-review example does not imply acceptance, publication, or moderation authority."),
    "changes-requested": decision("PROPOSED", "A fictional source-correction request remains distinct from moderation and appeal."),
    "source-corrected": decision("PROPOSED", "A fictional supersession example demonstrates source correction without mutating Community."),
    "appeal-in-review": decision("PROPOSED", "An appeal concept remains hypothetical and establishes no independent reviewer authority."),
    "privacy-restricted": decision("PROPOSED", "A deny-by-default Community visibility example reveals no author, audience, or content."),
    unsupported: decision("UNSUPPORTED", "The explicit unsupported fixture always renders the generic closed state."),
  },
  "organizational-stewardship": {
    overview: supportedDecision(
      "The frozen registry supports Organization scope, so a boundary-only synthetic orientation is reviewable.",
      {
        requiredOwnerState:
          "Organizations remains the registry-resolved scope owner; stewardship and Performance Intelligence meaning remain proposed.",
        requiredEvidenceState:
          "Fixed fictional orientation fixture only; no organization, worker, participant, customer, health, or performance record exists.",
        allowedPresentationBehavior:
          "Show route-local orientation copy, independent state lanes, owner labels, and the synthetic evidence-requirement preview.",
        prohibitedInference:
          "Do not infer organization health, stewardship quality, qualification, eligibility, authority, reputation, or an operational program.",
        correctionSemantics:
          "No source fact exists to correct; the Preview may explain a future source-owner route but cannot open or resolve it.",
        appealSemantics:
          "No review decision exists to appeal; an independent appeal owner remains unresolved.",
        failClosedResult: "NOT_AUTHORIZED",
      },
    ),
    empty: supportedDecision(
      "A synthetic empty Organization-scope state asserts no stewardship assessment or health fact.",
      {
        requiredOwnerState:
          "Organizations remains the registry-resolved scope owner; no stewardship assessment owner is inferred.",
        requiredEvidenceState:
          "Explicit fixed synthetic absence only; evidence-present, verification, completion, and review are all false.",
        allowedPresentationBehavior:
          "Show an empty boundary state and the requirements that a separately authorized future source would need.",
        prohibitedInference:
          "Do not infer missing performance, failed stewardship, inactivity, qualification, eligibility, or public visibility.",
        correctionSemantics:
          "There is no source fact to correct; correction remains unavailable.",
        appealSemantics:
          "There is no review disposition to appeal; appeal remains unavailable.",
        failClosedResult: "INSUFFICIENT_EVIDENCE",
      },
    ),
    preparing: supportedDecision(
      "A preparation checklist may explain Organization scope while all assessment meaning stays unavailable.",
      {
        requiredOwnerState:
          "Organizations remains the registry-resolved scope owner; preparation grants no Performance Intelligence authority.",
        requiredEvidenceState:
          "Fixed synthetic preparation checklist only; no submission, occurrence, completion, review, or verification exists.",
        allowedPresentationBehavior:
          "Show inert preparation guidance and future evidence requirements without accepting, assigning, or scheduling work.",
        prohibitedInference:
          "Do not infer participation, completion, approval, qualification, eligibility, organization health, or authorization.",
        correctionSemantics:
          "Only a future source fact could be corrected; no correction route is opened by preparation.",
        appealSemantics:
          "Preparation creates no decision and therefore no appeal.",
        failClosedResult: "INSUFFICIENT_EVIDENCE",
      },
    ),
    "completed-unreviewed": decision("PROPOSED", "Completion would depend on unratified stewardship and Performance Intelligence semantics."),
    "in-review": decision("PROPOSED", "Review would depend on a proposed Performance Intelligence reviewer and policy."),
    "changes-requested": decision("PROPOSED", "Source correction would depend on a proposed Performance Intelligence source owner."),
    "source-corrected": decision("PROPOSED", "Supersession would depend on a proposed Performance Intelligence source fact."),
    "appeal-in-review": decision("OWNER_UNRESOLVED", "No independent stewardship appeal owner is registry-resolved."),
    "privacy-restricted": supportedDecision(
      "A deny-by-default Organization-scope summary can be reviewed without organization or worker data.",
      {
        requiredOwnerState:
          "Organizations remains the registry-resolved scope owner and visibility remains deny-by-default.",
        requiredEvidenceState:
          "Fixed synthetic restriction state only; no private organization, worker, participant, customer, or protected-attribute data exists.",
        allowedPresentationBehavior:
          "Show only the restriction, owner boundary, and unavailable state without revealing or implying hidden content.",
        prohibitedInference:
          "Do not infer that private data exists, that any named party was assessed, or that restricted visibility is public authorization.",
        correctionSemantics:
          "A restriction is not a source correction and does not open a correction workflow.",
        appealSemantics:
          "A restriction is not a review decision and does not create an appeal right in this Preview.",
        failClosedResult: "NOT_AUTHORIZED",
      },
    ),
    unsupported: decision("UNSUPPORTED", "The explicit unsupported fixture always renders the generic closed state."),
  },
} as const satisfies Readonly<Record<CapabilityContractId, Readonly<Record<CapabilityFixtureId, CapabilityFixtureDecision>>>>);

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
    label: "Completion condition / no review",
    summary: "A fictional completion condition was reached; submission, review, acceptance, approval, and consequence remain unassessed.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "Fictional source participation ended",
    evidence: "Fictional completion reference only · no submission or acceptance",
    completion: "Fictional source-confirmed-state example",
    review: "Not reviewed · acceptance not assessed",
    correction: "Source-owner path preview",
    appeal: "Not applicable without a review decision",
    visibility: "Founder review only",
    detail: "Completion is not submission, acceptance, approval, credential, certification, eligibility, endorsement, reputation, or economics.",
  },
  {
    id: "in-review",
    label: "Review receipt / no decision",
    summary: "A fictional review receipt exists; receipt or submission is not acceptance, approval, publication, or authorization.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "No participation inference",
    evidence: "Fictional reference received",
    completion: "Unconfirmed",
    review: "Human review concept pending · acceptance not assessed",
    correction: "Available only for the source fact",
    appeal: "Unavailable until a review decision exists",
    visibility: "Authorized-reviewer concept only",
    detail: "This fixture displays a human-review boundary. A receipt is not acceptance; canonical Kai and Growth Experience cannot decide it.",
  },
  {
    id: "changes-requested",
    label: "Source correction requested",
    summary: "A fictional source-fact issue was identified; correction returns to the source owner and is not an appeal.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "No change inferred",
    evidence: "Specific fictional defect identified",
    completion: "Unconfirmed while correction is reviewed",
    review: "Review disposition unchanged by the correction request",
    correction: "Preview source-owner correction path",
    appeal: "Not opened · correction is not appeal",
    visibility: "Founder review only",
    detail: "A correction challenges a source fact. Growth Experience and canonical Kai can explain the route but cannot open or resolve a correction or appeal.",
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
    label: "Appeal review concept",
    summary: "A fictional decision appeal remains separate from source correction; reviewer independence is not established in this phase.",
    availability: "SYNTHETIC_AVAILABLE",
    participation: "No effect while appeal is reviewed",
    evidence: "Underlying fictional decision reference only",
    completion: "No change inferred",
    review: "Prior fictional decision exists",
    correction: "Source fact unchanged",
    appeal: "Human-review-required concept · independence not established",
    visibility: "Authorized-reviewer concept only",
    detail: "An appeal challenges a decision, not a source fact. Growth Experience and canonical Kai cannot file, adjudicate, resolve, or change it.",
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
  owner: CapabilityOwnerReference;
  ownerLabel: string;
  value: string;
}

export interface CapabilityEvidenceItem {
  id: CapabilityEvidenceItemId;
  label: string;
  owner: CapabilityOwnerReference;
  ownerLabel: string;
  value: string;
}

interface CapabilityProjectionBase {
  header: Phase1BReviewHeader;
  contract: CapabilityContractDefinition;
  fixture: CapabilityFixtureDefinition;
  lanes: readonly CapabilityStateLane[];
  ownerMaturity: CapabilityOwnerMaturity;
  decisionRationale: string;
}

export interface SupportedSyntheticCapabilityProjection
  extends CapabilityProjectionBase {
  kind: "SUPPORTED_SYNTHETIC_REVIEW";
  compatibilityContract: CapabilitySupportedCompatibilityContract;
  evidenceContract: readonly CapabilityEvidenceItem[];
}

export interface ClosedKnownCapabilityProjection
  extends CapabilityProjectionBase {
  kind: "PROPOSED" | "OWNER_UNRESOLVED" | "UNSUPPORTED";
  evidenceContract?: never;
}

export interface InvalidCapabilityProjection {
  kind: "INVALID";
  header: Phase1BReviewHeader;
  contract: null;
  fixture: CapabilityFixtureDefinition;
  lanes: readonly CapabilityStateLane[];
  ownerMaturity: "OWNER_UNRESOLVED";
  decisionRationale: string;
  reason: typeof GROWTH_CAPABILITY_UNSUPPORTED_COPY;
}

export type CapabilityReviewProjection =
  | SupportedSyntheticCapabilityProjection
  | ClosedKnownCapabilityProjection
  | InvalidCapabilityProjection;

type RawReviewParameter = string | readonly string[] | undefined;

function isSingleAllowed<T extends string>(
  value: RawReviewParameter,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function ownerLabel(owner: CapabilityOwnerReference): string {
  return CAPABILITY_OWNER_LABELS[owner];
}

function evidenceContractFor(
  contract: CapabilityContractDefinition,
): readonly CapabilityEvidenceItem[] {
  if (contract.ownerReference === "OWNER_UNRESOLVED") {
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
    owner: CapabilityOwnerReference,
    value: string,
  ): CapabilityEvidenceItem => ({ id, label, owner, ownerLabel: ownerLabel(owner), value });

  return deepFreeze([
    item(
      "professional-purpose",
      "Professional purpose",
      contract.ownerReference,
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
      contract.ownerReference,
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
      "GROWTH_EXPERIENCE",
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
  const noOwner: CapabilityOwnerReference = "OWNER_UNRESOLVED";
  const lane = (
    id: CapabilityStateLaneId,
    label: string,
    owner: CapabilityOwnerReference,
    value: string,
  ): CapabilityStateLane => ({ id, label, owner, ownerLabel: ownerLabel(owner), value });

  return deepFreeze([
    lane("availability", "Availability", "GROWTH_EXPERIENCE", fixture.availability),
    lane("participation", "Participation", contract?.ownerReference ?? noOwner, fixture.participation),
    lane("evidence", "Evidence", contract?.evidenceOwner ?? noOwner, fixture.evidence),
    lane("completion", "Completion", contract?.completionOwner ?? noOwner, fixture.completion),
    lane("review", "Review", contract?.reviewOwner ?? noOwner, fixture.review),
    lane("correction", "Correction", contract?.correctionOwner ?? noOwner, fixture.correction),
    lane("appeal", "Appeal", contract?.appealOwner ?? noOwner, fixture.appeal),
    lane("visibility", "Visibility", contract?.visibilityOwner ?? noOwner, fixture.visibility),
  ]);
}

function headerFor(
  contract: CapabilityContractDefinition | null,
  availability: ProjectionAvailability,
): Phase1BReviewHeader {
  return {
    contractId: contract?.id ?? "invalid",
    contractVersion: GROWTH_CAPABILITY_CONTRACT_VERSION,
    phaseLabel: GROWTH_EXPERIENCE_PHASE_1B_WORK_STATUS,
    contractStatus: GROWTH_EXPERIENCE_PHASE_1B_CONTRACT_STATUS,
    remediationStatus: GROWTH_EXPERIENCE_PHASE_1B_R_STATUS,
    mode: "SYNTHETIC_FOUNDER_REVIEW",
    synthetic: true,
    live: false,
    authorized: false,
    ownerReference: contract?.ownerReference ?? "OWNER_UNRESOLVED",
    ownerMaturity: contract?.ownerMaturity ?? "OWNER_UNRESOLVED",
    projectionOwner: "GROWTH_EXPERIENCE",
    source: { kind: "SYNTHETIC_FIXTURE", ref: GROWTH_CAPABILITY_FIXTURE_SOURCE },
    visibility: "FOUNDER_REVIEW_ONLY",
    availability,
  };
}

function closedFixtureFor(
  fixture: CapabilityFixtureDefinition,
  kind: "PROPOSED" | "OWNER_UNRESOLVED" | "UNSUPPORTED",
  rationale: string,
): CapabilityFixtureDefinition {
  const availability: ProjectionAvailability = kind === "PROPOSED"
    ? "FUTURE_UNAVAILABLE"
    : kind === "OWNER_UNRESOLVED"
      ? "OWNER_UNRESOLVED"
      : "NOT_AUTHORIZED";
  const label = kind === "PROPOSED"
    ? "Proposed state"
    : kind === "OWNER_UNRESOLVED"
      ? "Owner unresolved"
      : "Unsupported state";

  return deepFreeze({
    ...fixture,
    label: `${fixture.label} · ${label}`,
    summary: `${label} · non-operational and unavailable in this Preview.`,
    availability,
    participation: "No state inferred",
    evidence: "No state inferred",
    completion: "No state inferred",
    review: "No state inferred",
    correction: "Unavailable",
    appeal: "Unavailable",
    visibility: "Hidden / unavailable",
    detail: `${rationale} ${GROWTH_CAPABILITY_UNSUPPORTED_COPY}`,
  });
}

function invalidProjection(): InvalidCapabilityProjection {
  const fixture = CAPABILITY_FIXTURES.find((item) => item.id === "unsupported")!;
  return deepFreeze({
    kind: "INVALID",
    header: headerFor(null, "ERROR"),
    contract: null,
    fixture,
    lanes: lanesFor(null, fixture),
    ownerMaturity: "OWNER_UNRESOLVED",
    decisionRationale:
      "The request was missing, malformed, duplicated, contradictory, or outside the literal policy table.",
    reason: GROWTH_CAPABILITY_UNSUPPORTED_COPY,
  });
}

export function resolveCapabilityReviewRequest(
  contractInput?: RawReviewParameter,
  fixtureInput?: RawReviewParameter,
): CapabilityReviewProjection {
  if (contractInput === undefined || fixtureInput === undefined) {
    return invalidProjection();
  }

  if (
    !isSingleAllowed(contractInput, CAPABILITY_CONTRACT_IDS) ||
    !isSingleAllowed(fixtureInput, CAPABILITY_FIXTURE_IDS)
  ) {
    return invalidProjection();
  }

  const contract = CAPABILITY_CONTRACTS.find((item) => item.id === contractInput);
  const fixture = CAPABILITY_FIXTURES.find((item) => item.id === fixtureInput);
  if (!contract || !fixture) return invalidProjection();

  const fixtureDecision = CAPABILITY_FIXTURE_DECISIONS[contract.id][fixture.id];
  if (fixtureDecision.kind === "SUPPORTED_SYNTHETIC_REVIEW") {
    return deepFreeze({
      kind: "SUPPORTED_SYNTHETIC_REVIEW",
      header: headerFor(contract, fixture.availability),
      contract,
      fixture,
      lanes: lanesFor(contract, fixture),
      ownerMaturity: contract.ownerMaturity,
      decisionRationale: fixtureDecision.rationale,
      compatibilityContract: fixtureDecision.compatibility,
      evidenceContract: evidenceContractFor(contract),
    });
  }

  const effectiveFixture = closedFixtureFor(
    fixture,
    fixtureDecision.kind,
    fixtureDecision.rationale,
  );
  return deepFreeze({
    kind: fixtureDecision.kind,
    header: headerFor(contract, effectiveFixture.availability),
    contract,
    fixture: effectiveFixture,
    lanes: lanesFor(contract, effectiveFixture),
    ownerMaturity: contract.ownerMaturity,
    decisionRationale: fixtureDecision.rationale,
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
    projection.kind !== "SUPPORTED_SYNTHETIC_REVIEW" ||
    projection.fixture.id === "unsupported" ||
    !CAPABILITY_KAI_QUESTION_IDS.includes(questionInput as CapabilityKaiQuestionId)
  ) {
    return deepFreeze({
      questionId: "unsupported",
      title: "Explanation unavailable",
      summary: GROWTH_CAPABILITY_UNSUPPORTED_COPY,
      ownerExplanation: "No owner or source fact has been inferred.",
      evidenceChecklist: [],
      permittedReviewSteps: ["Select a supported synthetic-review pair."],
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
