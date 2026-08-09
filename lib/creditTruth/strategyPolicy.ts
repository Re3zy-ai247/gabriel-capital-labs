/**
 * Phase 1 correspondence strategy policy.
 *
 * This module is intentionally pure and dormant. It does not generate legal
 * text, select a strategy, write correspondence, or connect to a production
 * read path. Future activation requires a separately versioned policy set.
 */

import {
  CONSUMER_ASSERTION_BINDING_VERSION,
  validateConsumerAssertionBinding,
  type BoundConsumerAssertion,
  type ObservationBinding,
} from "./consumerAssertion";

export {
  CONSUMER_ASSERTION_BINDING_VERSION,
  validateConsumerAssertionBinding,
  type BoundConsumerAssertion,
  type ObservationBinding,
} from "./consumerAssertion";

export const STRATEGY_POLICY_SCHEMA_VERSION = "1.0.0" as const;
export const PHASE_1_STRATEGY_POLICY_SET_VERSION = "2026-08-08.phase1" as const;
export const PHASE_1_STRATEGY_POLICY_VERSION = "2026-08-08.1" as const;

export type StrategyPolicyId =
  | "fcra_611"
  | "fcra_609"
  | "validation"
  | "metro2"
  | "fcra_605"
  | "fcra_623"
  | "fdcpa"
  | "escalation"
  | "goodwill"
  | "pay_delete"
  | "cease_desist"
  | "cfpb_threat";

export type PolicySetStatus = "DORMANT_PHASE_1" | "ACTIVE" | "RETIRED";
export type StrategyPolicyStatus = "DRAFT" | "PENDING_COUNSEL" | "APPROVED" | "RETIRED";
export type CounselApprovalStatus = "NOT_REQUIRED" | "PENDING_COUNSEL" | "APPROVED" | "REJECTED";

export type PolicyRecipientType =
  | "CREDIT_REPORTING_AGENCY"
  | "DEBT_COLLECTOR"
  | "FURNISHER"
  | "COLLECTOR_FURNISHER"
  | "REGULATOR";

export type ApplicabilityPredicate =
  | "EXACT_BUREAU_FIELD_OBSERVED"
  | "DISCLOSURE_SCOPE_SPECIFIED"
  | "COLLECTION_ROLE_VERIFIED"
  | "ACCOUNT_RECIPIENT_LINK_VERIFIED"
  | "CONSUMER_VALIDATION_ELECTION"
  | "EXACT_FIELD_INCONSISTENCY_OBSERVED"
  | "REPORTING_PERIOD_INPUTS_COMPLETE"
  | "OBSOLESCENCE_RULE_APPLICABLE"
  | "FURNISHER_ROLE_VERIFIED"
  | "DIRECT_DISPUTE_RULE_APPLICABLE"
  | "DUAL_COLLECTOR_FURNISHER_ROLE_VERIFIED"
  | "UNRESOLVED_PRIOR_CASE"
  | "ACCURATE_ADVERSE_INFORMATION_ACKNOWLEDGED"
  | "CONSUMER_CONTEXT_PROVIDED"
  | "SETTLEMENT_AUTHORITY_VERIFIED"
  | "NEGOTIATION_POLICY_APPLICABLE"
  | "PRIOR_CORRESPONDENCE_HISTORY_SUPPORTED";

export type RequiredObservationType =
  | "BUREAU_SCOPED_FIELD"
  | "EXACT_DISCLOSURE_SCOPE"
  | "COLLECTOR_ROLE"
  | "ACCOUNT_RECIPIENT_LINK"
  | "FIELD_INCONSISTENCY"
  | "RELEVANT_ADVERSE_EVENT_DATES"
  | "ITEM_TYPE"
  | "POLICY_RULE_VERSION"
  | "FURNISHER_ROLE"
  | "DIRECT_DISPUTE_APPLICABILITY"
  | "DUAL_RECIPIENT_ROLE"
  | "PRIOR_CORRESPONDENCE_VERSION"
  | "DELIVERY_EVIDENCE"
  | "RECIPIENT_RESPONSE_OR_ELAPSED_WINDOW"
  | "RESPONSE_FINDING"
  | "UNRESOLVED_CONFIRMED_FIELD"
  | "NEW_SUPPORTING_EVIDENCE"
  | "ACTUAL_ADVERSE_FIELD"
  | "CONSUMER_PROVIDED_CONTEXT"
  | "OWNERSHIP_OR_SETTLEMENT_AUTHORITY"
  | "SETTLEMENT_TERMS"
  | "PRIOR_CORRESPONDENCE_CHRONOLOGY"
  | "UNRESOLVED_ISSUE_EVIDENCE";

export type ConsumerAssertionType =
  | "EXACT_FIELD_DISPUTED"
  | "DISCLOSURE_SCOPE_REQUESTED"
  | "VALIDATION_REQUEST_ELECTED"
  | "EXACT_INCONSISTENCY_CONFIRMED"
  | "OBSOLESCENCE_BASIS_CONFIRMED"
  | "DIRECT_DISPUTE_BASIS_CONFIRMED"
  | "FOLLOW_UP_APPROVED"
  | "ACCURACY_ACKNOWLEDGED"
  | "GOODWILL_REQUEST_ELECTED"
  | "NEGOTIATION_AUTHORIZED"
  | "NEGOTIATION_RISK_ACKNOWLEDGED"
  | "CEASE_COMMUNICATION_AUTHORIZED"
  | "CEASE_CONSEQUENCES_ACKNOWLEDGED"
  | "REGULATOR_ESCALATION_AUTHORIZED"
  | "COMPLAINT_FACTS_CONFIRMED";

export type ConsumerAssertionStatus = "CONFIRMED" | "REVOKED" | "EXPIRED";

export type ObservationBoundConsumerAssertionType =
  | "EXACT_FIELD_DISPUTED"
  | "EXACT_INCONSISTENCY_CONFIRMED"
  | "OBSOLESCENCE_BASIS_CONFIRMED"
  | "DIRECT_DISPUTE_BASIS_CONFIRMED"
  | "ACCURACY_ACKNOWLEDGED";

export type PolicyContextConsumerAssertionType = Exclude<
  ConsumerAssertionType,
  ObservationBoundConsumerAssertionType
>;

export interface PolicyContextBinding {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly caseId: string;
  readonly contextId: string;
  readonly contextVersion: string;
  readonly contextDigest: string;
  readonly strategyId: StrategyPolicyId;
  readonly policyVersion: string;
}

export interface ObservationBoundPolicyAssertion {
  readonly type: ObservationBoundConsumerAssertionType;
  readonly bindingKind: "OBSERVATION";
  readonly assertion: BoundConsumerAssertion;
}

export interface PolicyContextConsumerAssertion {
  readonly type: PolicyContextConsumerAssertionType;
  readonly bindingKind: "POLICY_CONTEXT";
  readonly assertionId: string;
  readonly assertionVersion: string;
  readonly assertionDigest: string;
  readonly status: ConsumerAssertionStatus;
  readonly policyContextBinding: PolicyContextBinding;
}

export type ConsumerAssertionEvidence =
  | ObservationBoundPolicyAssertion
  | PolicyContextConsumerAssertion;

export interface CurrentObservationBinding {
  readonly type: ObservationBoundConsumerAssertionType;
  readonly bindingKind: "OBSERVATION";
  readonly observationBinding: ObservationBinding;
}

export interface CurrentPolicyContextBinding {
  readonly type: PolicyContextConsumerAssertionType;
  readonly bindingKind: "POLICY_CONTEXT";
  readonly policyContextBinding: PolicyContextBinding;
}

export type CurrentConsumerAssertionBinding =
  | CurrentObservationBinding
  | CurrentPolicyContextBinding;

export type RecipientAddressStatus =
  | "VERIFIED_VERSIONED"
  | "UNVERIFIED"
  | "STALE"
  | "MISSING"
  | "UNKNOWN";

export type TimingFact =
  | "COLLECTOR_INITIAL_NOTICE_DATE_RECORDED"
  | "CONSUMER_WRITTEN_DISPUTE_DATE_RECORDED"
  | "VALIDATION_PERIOD_ELIGIBILITY_DETERMINED"
  | "ROUND_ONE_DELIVERY_RECORDED"
  | "RESPONSE_RECEIVED_OR_ELIGIBLE_WINDOW_ELAPSED";

export type ClaimType =
  | "IDENTIFY_DISPUTED_FIELD"
  | "REQUEST_REINVESTIGATION"
  | "REQUEST_CORRECTION_IF_INACCURATE"
  | "REQUEST_DELETION_IF_UNVERIFIABLE"
  | "REQUEST_FILE_DISCLOSURE"
  | "REQUEST_SOURCE_DISCLOSURE"
  | "REQUEST_VALIDATION_INFORMATION"
  | "REQUEST_ACCOUNT_AUTHORITY_INFORMATION"
  | "ASSERT_CEASE_PENDING_VALIDATION"
  | "DESCRIBE_VERIFIED_DATA_INCONSISTENCY"
  | "REFERENCE_DATA_STANDARD_CONTEXT"
  | "REQUEST_OBSOLESCENCE_REVIEW"
  | "ASSERT_ITEM_OBSOLETE"
  | "REQUEST_DIRECT_FURNISHER_INVESTIGATION"
  | "REQUEST_DIRECT_FURNISHER_CORRECTION"
  | "DOCUMENT_ROUND_HISTORY"
  | "FOLLOW_UP_UNRESOLVED_FACT"
  | "REQUEST_COURTESY_ADJUSTMENT"
  | "PROPOSE_CONDITIONAL_SETTLEMENT"
  | "REQUEST_COMMUNICATION_CESSATION"
  | "PREPARE_COMPLAINT_DRAFT"
  | "INCLUDE_CROSS_BUREAU_FACT"
  | "GUARANTEE_DELETION"
  | "GUARANTEE_SCORE_CHANGE"
  | "GENERIC_ALL_INFORMATION_INACCURATE"
  | "ASSERT_SECTION_609_AUTOMATIC_DELETION"
  | "ASSERT_METRO2_INDEPENDENT_LEGAL_RIGHT"
  | "ASSERT_UNCONDITIONAL_CEASE"
  | "ASSERT_OBSOLETE_WITH_UNKNOWN_INPUTS"
  | "CITE_FCRA_611_TO_FURNISHER"
  | "ASSERT_ACCURATE_INFORMATION_INACCURATE"
  | "ASSERT_DELETION_REQUIRED_FOR_PAYMENT"
  | "ASSERT_DEBT_RESOLVED_BY_COMMUNICATION_CESSATION"
  | "THREATEN_REGULATOR_ACTION"
  | "FABRICATE_NONRESPONSE"
  | "AUTO_SUBMIT_REGULATOR_COMPLAINT";

export type StatuteReferenceId =
  | "FCRA_605"
  | "FCRA_607_B"
  | "FCRA_609"
  | "FCRA_611"
  | "FCRA_623"
  | "FDCPA_805_C"
  | "FDCPA_809";

export type EnclosureKind =
  | "REPORT_EXCERPT"
  | "CONSUMER_STATEMENT"
  | "SUPPORTING_RECORD"
  | "IDENTITY_VERIFICATION_COPY"
  | "ADDRESS_VERIFICATION_COPY"
  | "PRIOR_CORRESPONDENCE_COPY"
  | "DELIVERY_PROOF"
  | "RECIPIENT_RESPONSE_COPY"
  | "EVIDENCE_INDEX"
  | "FULL_CREDIT_REPORT"
  | "ORIGINAL_IDENTITY_DOCUMENT";

export type ConsolidationMode = "SAME_RECIPIENT_SAME_ROUND" | "STANDALONE";

export type EscalationPrerequisite =
  | "IMMUTABLE_PARENT_VERSION"
  | "SAME_RECIPIENT_AS_PARENT"
  | "PRIOR_DELIVERY_PROVEN"
  | "RESPONSE_OR_ELIGIBLE_WINDOW"
  | "UNRESOLVED_CONFIRMED_GROUND"
  | "NEW_EVIDENCE_PRESENT"
  | "EXPLICIT_FOLLOW_UP_APPROVAL"
  | "COMPLETE_PRIOR_CHRONOLOGY"
  | "EXPLICIT_REGULATOR_INTENT"
  | "EXPLICIT_REGULATOR_APPROVAL"
  | "SEPARATE_REGULATOR_WORKFLOW";

export interface ClaimRequirement {
  readonly requiredTimingFacts: readonly TimingFact[];
  readonly requiredObservationTypes: readonly RequiredObservationType[];
  readonly requiredConsumerAssertions: readonly ConsumerAssertionType[];
}

export interface EnclosurePolicy {
  readonly required: readonly EnclosureKind[];
  readonly allowed: readonly EnclosureKind[];
  readonly prohibited: readonly EnclosureKind[];
  readonly recipientScopedManifestRequired: true;
}

export interface ConsolidationPolicy {
  readonly mode: ConsolidationMode;
  readonly compatibleStrategyIds: readonly StrategyPolicyId[];
  readonly claimCompatibilityKey: string;
  readonly enclosureCompatibilityKey: string;
  readonly requiresSameRecipient: true;
  readonly requiresSameAddressVersion: true;
  readonly requiresSameRound: true;
  readonly requiresSamePolicyVersion: true;
  readonly prohibitsMixedRecipientTypes: true;
}

export interface RoundPolicy {
  readonly minimum: number;
  readonly maximum: number;
  readonly prerequisites: readonly EscalationPrerequisite[];
}

export interface StrategyPolicyDefinition {
  readonly schemaVersion: typeof STRATEGY_POLICY_SCHEMA_VERSION;
  readonly strategyId: StrategyPolicyId;
  readonly policyVersion: string;
  readonly status: StrategyPolicyStatus;
  readonly counselApprovalRequired: boolean;
  readonly counselApprovalStatus: CounselApprovalStatus;
  readonly recipientTypes: readonly PolicyRecipientType[];
  readonly applicabilityPredicates: readonly ApplicabilityPredicate[];
  readonly requiredObservationTypes: readonly RequiredObservationType[];
  readonly requiredConsumerAssertions: readonly ConsumerAssertionType[];
  readonly requiredAddressStatus: "VERIFIED_VERSIONED";
  readonly requiredTimingFacts: readonly TimingFact[];
  readonly allowedClaimTypes: readonly ClaimType[];
  readonly prohibitedClaimTypes: readonly ClaimType[];
  readonly claimRequirements: Readonly<Partial<Record<ClaimType, ClaimRequirement>>>;
  readonly statuteReferenceIds: readonly StatuteReferenceId[];
  readonly enclosurePolicy: EnclosurePolicy;
  readonly consolidationPolicy: ConsolidationPolicy;
  readonly roundPolicy: RoundPolicy;
}

export interface StrategyPolicySet {
  readonly schemaVersion: typeof STRATEGY_POLICY_SCHEMA_VERSION;
  readonly policySetVersion: string;
  readonly status: PolicySetStatus;
  readonly policies: readonly StrategyPolicyDefinition[];
}

export interface ConsolidationCandidate {
  readonly items: readonly ConsolidationItemMetadata[];
}

export interface ConsolidationItemMetadata {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly caseId: string;
  readonly itemId: string;
  readonly recipientId: string;
  readonly recipientAddressVersionId: string;
  readonly round: number;
  readonly policyVersion: string;
  readonly recipientType: PolicyRecipientType;
  readonly strategyId: StrategyPolicyId;
  readonly claimCompatibilityKey: string;
  readonly enclosureCompatibilityKey: string;
}

export interface StrategyPolicyEvaluationScope {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly caseId: string;
}

export interface StrategyPolicyEvaluationRequest {
  readonly scope: StrategyPolicyEvaluationScope;
  readonly strategyId: string;
  readonly policyVersion: string;
  readonly contextStatus: "COMPLETE" | "INCOMPLETE";
  readonly correspondenceItemId: string;
  readonly recipientId: string;
  readonly recipientAddressVersionId: string;
  readonly recipientType: PolicyRecipientType;
  readonly addressStatus: RecipientAddressStatus;
  readonly round: number;
  readonly applicabilityFacts: readonly ApplicabilityPredicate[];
  readonly observationTypes: readonly RequiredObservationType[];
  readonly consumerAssertions: readonly ConsumerAssertionEvidence[];
  readonly currentAssertionBindings: readonly CurrentConsumerAssertionBinding[];
  readonly timingFacts: readonly TimingFact[];
  readonly claimTypes: readonly ClaimType[];
  readonly statuteReferenceIds: readonly StatuteReferenceId[];
  readonly enclosures: readonly EnclosureKind[];
  readonly escalationFacts: readonly EscalationPrerequisite[];
  readonly consolidation?: ConsolidationCandidate;
}

export type StrategyPolicyDenialCode =
  | "UNKNOWN_STRATEGY"
  | "POLICY_VERSION_NOT_FOUND"
  | "POLICY_SET_DORMANT"
  | "POLICY_SET_RETIRED"
  | "STRATEGY_DRAFT"
  | "COUNSEL_APPROVAL_PENDING"
  | "COUNSEL_APPROVAL_REJECTED"
  | "STRATEGY_RETIRED"
  | "COUNSEL_APPROVAL_INCONSISTENT"
  | "CONTEXT_INCOMPLETE"
  | "EVALUATION_SCOPE_INCOMPLETE"
  | "OBSERVATION_ASSERTION_TENANT_SCOPE_MISMATCH"
  | "OBSERVATION_ASSERTION_CONSUMER_SCOPE_MISMATCH"
  | "POLICY_CONTEXT_TENANT_SCOPE_MISMATCH"
  | "POLICY_CONTEXT_CONSUMER_SCOPE_MISMATCH"
  | "POLICY_CONTEXT_CASE_SCOPE_MISMATCH"
  | "CORRESPONDENCE_ITEM_ID_MISSING"
  | "RECIPIENT_ID_MISSING"
  | "RECIPIENT_ADDRESS_VERSION_ID_MISSING"
  | "RECIPIENT_TYPE_NOT_ALLOWED"
  | "RECIPIENT_ADDRESS_NOT_VERIFIED_VERSIONED"
  | "APPLICABILITY_PREDICATE_MISSING"
  | "REQUIRED_OBSERVATION_MISSING"
  | "REQUIRED_CONSUMER_ASSERTION_MISSING"
  | "CONSUMER_ASSERTION_NOT_CONFIRMED"
  | "CONSUMER_ASSERTION_PROOF_INVALID"
  | "CONSUMER_ASSERTION_BINDING_KIND_INVALID"
  | "CONSUMER_ASSERTION_NOT_BOUND_TO_CURRENT_OBSERVATION"
  | "CONSUMER_ASSERTION_NOT_BOUND_TO_CURRENT_POLICY_CONTEXT"
  | "REQUIRED_TIMING_FACT_MISSING"
  | "CLAIM_SELECTION_MISSING"
  | "CLAIM_TYPE_NOT_ALLOWED"
  | "PROHIBITED_CLAIM_TYPE"
  | "STATUTE_REFERENCE_NOT_ALLOWED"
  | "REQUIRED_ENCLOSURE_MISSING"
  | "ENCLOSURE_NOT_ALLOWED"
  | "PROHIBITED_ENCLOSURE"
  | "ROUND_NOT_ALLOWED"
  | "ESCALATION_PREREQUISITE_MISSING"
  | "CONSOLIDATION_REQUIRES_STANDALONE"
  | "CONSOLIDATION_ITEM_METADATA_INCOMPLETE"
  | "CONSOLIDATION_DUPLICATE_ITEM_ID"
  | "CONSOLIDATION_CURRENT_ITEM_MISSING"
  | "CONSOLIDATION_TENANT_SCOPE_MISMATCH"
  | "CONSOLIDATION_CONSUMER_SCOPE_MISMATCH"
  | "CONSOLIDATION_CASE_SCOPE_MISMATCH"
  | "CONSOLIDATION_RECIPIENT_MISMATCH"
  | "CONSOLIDATION_ADDRESS_VERSION_MISMATCH"
  | "CONSOLIDATION_ROUND_MISMATCH"
  | "CONSOLIDATION_POLICY_VERSION_MISMATCH"
  | "CONSOLIDATION_MIXED_RECIPIENT_TYPES"
  | "CONSOLIDATION_RECIPIENT_TYPE_NOT_ALLOWED"
  | "CONSOLIDATION_CLAIM_INCOMPATIBLE"
  | "CONSOLIDATION_ENCLOSURE_INCOMPATIBLE"
  | "CONSOLIDATION_STRATEGY_INCOMPATIBLE";

export interface StrategyPolicyDenialReason {
  readonly code: StrategyPolicyDenialCode;
  readonly requirement?: string;
}

export interface StrategyPolicyEvaluation {
  readonly decision: "ALLOW" | "DENY";
  readonly strategyId: string;
  readonly requestedPolicyVersion: string;
  readonly resolvedPolicyVersion?: string;
  readonly policySetVersion: string;
  readonly reasons: readonly StrategyPolicyDenialReason[];
}

const UNIVERSAL_PROHIBITED_CLAIMS = [
  "INCLUDE_CROSS_BUREAU_FACT",
  "GUARANTEE_DELETION",
  "GUARANTEE_SCORE_CHANGE",
  "GENERIC_ALL_INFORMATION_INACCURATE",
] as const satisfies readonly ClaimType[];

const UNIVERSAL_PROHIBITED_ENCLOSURES = [
  "FULL_CREDIT_REPORT",
  "ORIGINAL_IDENTITY_DOCUMENT",
] as const satisfies readonly EnclosureKind[];

const CRA_ENCLOSURES = [
  "REPORT_EXCERPT",
  "CONSUMER_STATEMENT",
  "SUPPORTING_RECORD",
  "IDENTITY_VERIFICATION_COPY",
  "ADDRESS_VERIFICATION_COPY",
] as const satisfies readonly EnclosureKind[];

const SUPPORTING_ENCLOSURES = [
  "CONSUMER_STATEMENT",
  "SUPPORTING_RECORD",
  "IDENTITY_VERIFICATION_COPY",
  "ADDRESS_VERIFICATION_COPY",
] as const satisfies readonly EnclosureKind[];

function enclosurePolicy(
  allowed: readonly EnclosureKind[],
  required: readonly EnclosureKind[] = []
): EnclosurePolicy {
  return {
    required,
    allowed,
    prohibited: UNIVERSAL_PROHIBITED_ENCLOSURES,
    recipientScopedManifestRequired: true,
  };
}

function consolidationPolicy(
  mode: ConsolidationMode,
  compatibleStrategyIds: readonly StrategyPolicyId[] = []
): ConsolidationPolicy {
  const compatibilityScope =
    compatibleStrategyIds.length > 0
      ? [...compatibleStrategyIds].sort().join("+")
      : "standalone";
  return {
    mode,
    compatibleStrategyIds,
    claimCompatibilityKey: `${STRATEGY_POLICY_SCHEMA_VERSION}:claim:${compatibilityScope}`,
    enclosureCompatibilityKey: `${STRATEGY_POLICY_SCHEMA_VERSION}:enclosure:${compatibilityScope}`,
    requiresSameRecipient: true,
    requiresSameAddressVersion: true,
    requiresSameRound: true,
    requiresSamePolicyVersion: true,
    prohibitsMixedRecipientTypes: true,
  };
}

function policy(
  definition: Omit<StrategyPolicyDefinition, "schemaVersion" | "policyVersion" | "requiredAddressStatus">
): StrategyPolicyDefinition {
  return {
    schemaVersion: STRATEGY_POLICY_SCHEMA_VERSION,
    policyVersion: PHASE_1_STRATEGY_POLICY_VERSION,
    requiredAddressStatus: "VERIFIED_VERSIONED",
    ...definition,
  };
}

const POLICIES: readonly StrategyPolicyDefinition[] = [
  policy({
    strategyId: "fcra_611",
    status: "DRAFT",
    counselApprovalRequired: false,
    counselApprovalStatus: "NOT_REQUIRED",
    recipientTypes: ["CREDIT_REPORTING_AGENCY"],
    applicabilityPredicates: ["EXACT_BUREAU_FIELD_OBSERVED"],
    requiredObservationTypes: ["BUREAU_SCOPED_FIELD"],
    requiredConsumerAssertions: ["EXACT_FIELD_DISPUTED"],
    requiredTimingFacts: [],
    allowedClaimTypes: [
      "IDENTIFY_DISPUTED_FIELD",
      "REQUEST_REINVESTIGATION",
      "REQUEST_CORRECTION_IF_INACCURATE",
      "REQUEST_DELETION_IF_UNVERIFIABLE",
    ],
    prohibitedClaimTypes: UNIVERSAL_PROHIBITED_CLAIMS,
    claimRequirements: {},
    statuteReferenceIds: ["FCRA_611"],
    enclosurePolicy: enclosurePolicy(CRA_ENCLOSURES),
    consolidationPolicy: consolidationPolicy("SAME_RECIPIENT_SAME_ROUND", [
      "fcra_611",
      "fcra_609",
      "metro2",
      "fcra_605",
    ]),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "fcra_609",
    status: "DRAFT",
    counselApprovalRequired: false,
    counselApprovalStatus: "NOT_REQUIRED",
    recipientTypes: ["CREDIT_REPORTING_AGENCY"],
    applicabilityPredicates: ["DISCLOSURE_SCOPE_SPECIFIED", "EXACT_BUREAU_FIELD_OBSERVED"],
    requiredObservationTypes: ["EXACT_DISCLOSURE_SCOPE", "BUREAU_SCOPED_FIELD"],
    requiredConsumerAssertions: ["DISCLOSURE_SCOPE_REQUESTED", "EXACT_FIELD_DISPUTED"],
    requiredTimingFacts: [],
    allowedClaimTypes: [
      "REQUEST_FILE_DISCLOSURE",
      "REQUEST_SOURCE_DISCLOSURE",
      "IDENTIFY_DISPUTED_FIELD",
      "REQUEST_REINVESTIGATION",
    ],
    prohibitedClaimTypes: [
      ...UNIVERSAL_PROHIBITED_CLAIMS,
      "ASSERT_SECTION_609_AUTOMATIC_DELETION",
    ],
    claimRequirements: {},
    statuteReferenceIds: ["FCRA_609", "FCRA_611"],
    enclosurePolicy: enclosurePolicy(CRA_ENCLOSURES),
    consolidationPolicy: consolidationPolicy("SAME_RECIPIENT_SAME_ROUND", [
      "fcra_611",
      "fcra_609",
      "metro2",
      "fcra_605",
    ]),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "validation",
    status: "PENDING_COUNSEL",
    counselApprovalRequired: true,
    counselApprovalStatus: "PENDING_COUNSEL",
    recipientTypes: ["DEBT_COLLECTOR"],
    applicabilityPredicates: [
      "COLLECTION_ROLE_VERIFIED",
      "ACCOUNT_RECIPIENT_LINK_VERIFIED",
      "CONSUMER_VALIDATION_ELECTION",
    ],
    requiredObservationTypes: ["COLLECTOR_ROLE", "ACCOUNT_RECIPIENT_LINK"],
    requiredConsumerAssertions: ["VALIDATION_REQUEST_ELECTED"],
    requiredTimingFacts: [],
    allowedClaimTypes: [
      "REQUEST_VALIDATION_INFORMATION",
      "REQUEST_ACCOUNT_AUTHORITY_INFORMATION",
      "ASSERT_CEASE_PENDING_VALIDATION",
    ],
    prohibitedClaimTypes: [...UNIVERSAL_PROHIBITED_CLAIMS, "ASSERT_UNCONDITIONAL_CEASE"],
    claimRequirements: {
      ASSERT_CEASE_PENDING_VALIDATION: {
        requiredTimingFacts: [
          "COLLECTOR_INITIAL_NOTICE_DATE_RECORDED",
          "CONSUMER_WRITTEN_DISPUTE_DATE_RECORDED",
          "VALIDATION_PERIOD_ELIGIBILITY_DETERMINED",
        ],
        requiredObservationTypes: [],
        requiredConsumerAssertions: [],
      },
    },
    statuteReferenceIds: ["FDCPA_809"],
    enclosurePolicy: enclosurePolicy(SUPPORTING_ENCLOSURES),
    consolidationPolicy: consolidationPolicy("STANDALONE"),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "metro2",
    status: "DRAFT",
    counselApprovalRequired: false,
    counselApprovalStatus: "NOT_REQUIRED",
    recipientTypes: ["CREDIT_REPORTING_AGENCY"],
    applicabilityPredicates: ["EXACT_FIELD_INCONSISTENCY_OBSERVED"],
    requiredObservationTypes: ["FIELD_INCONSISTENCY", "BUREAU_SCOPED_FIELD"],
    requiredConsumerAssertions: ["EXACT_INCONSISTENCY_CONFIRMED"],
    requiredTimingFacts: [],
    allowedClaimTypes: [
      "IDENTIFY_DISPUTED_FIELD",
      "DESCRIBE_VERIFIED_DATA_INCONSISTENCY",
      "REFERENCE_DATA_STANDARD_CONTEXT",
      "REQUEST_REINVESTIGATION",
      "REQUEST_CORRECTION_IF_INACCURATE",
    ],
    prohibitedClaimTypes: [
      ...UNIVERSAL_PROHIBITED_CLAIMS,
      "ASSERT_METRO2_INDEPENDENT_LEGAL_RIGHT",
    ],
    claimRequirements: {},
    statuteReferenceIds: ["FCRA_607_B", "FCRA_611"],
    enclosurePolicy: enclosurePolicy(CRA_ENCLOSURES),
    consolidationPolicy: consolidationPolicy("SAME_RECIPIENT_SAME_ROUND", [
      "fcra_611",
      "fcra_609",
      "metro2",
      "fcra_605",
    ]),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "fcra_605",
    status: "DRAFT",
    counselApprovalRequired: false,
    counselApprovalStatus: "NOT_REQUIRED",
    recipientTypes: ["CREDIT_REPORTING_AGENCY"],
    applicabilityPredicates: [
      "EXACT_BUREAU_FIELD_OBSERVED",
      "REPORTING_PERIOD_INPUTS_COMPLETE",
      "OBSOLESCENCE_RULE_APPLICABLE",
    ],
    requiredObservationTypes: [
      "BUREAU_SCOPED_FIELD",
      "RELEVANT_ADVERSE_EVENT_DATES",
      "ITEM_TYPE",
      "POLICY_RULE_VERSION",
    ],
    requiredConsumerAssertions: ["OBSOLESCENCE_BASIS_CONFIRMED"],
    requiredTimingFacts: [],
    allowedClaimTypes: ["IDENTIFY_DISPUTED_FIELD", "REQUEST_OBSOLESCENCE_REVIEW", "ASSERT_ITEM_OBSOLETE"],
    prohibitedClaimTypes: [...UNIVERSAL_PROHIBITED_CLAIMS, "ASSERT_OBSOLETE_WITH_UNKNOWN_INPUTS"],
    claimRequirements: {},
    statuteReferenceIds: ["FCRA_605"],
    enclosurePolicy: enclosurePolicy(CRA_ENCLOSURES, ["REPORT_EXCERPT"]),
    consolidationPolicy: consolidationPolicy("SAME_RECIPIENT_SAME_ROUND", [
      "fcra_611",
      "fcra_609",
      "metro2",
      "fcra_605",
    ]),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "fcra_623",
    status: "PENDING_COUNSEL",
    counselApprovalRequired: true,
    counselApprovalStatus: "PENDING_COUNSEL",
    recipientTypes: ["FURNISHER"],
    applicabilityPredicates: [
      "FURNISHER_ROLE_VERIFIED",
      "DIRECT_DISPUTE_RULE_APPLICABLE",
      "EXACT_BUREAU_FIELD_OBSERVED",
    ],
    requiredObservationTypes: ["FURNISHER_ROLE", "DIRECT_DISPUTE_APPLICABILITY", "BUREAU_SCOPED_FIELD"],
    requiredConsumerAssertions: ["DIRECT_DISPUTE_BASIS_CONFIRMED", "EXACT_FIELD_DISPUTED"],
    requiredTimingFacts: [],
    allowedClaimTypes: [
      "IDENTIFY_DISPUTED_FIELD",
      "REQUEST_DIRECT_FURNISHER_INVESTIGATION",
      "REQUEST_DIRECT_FURNISHER_CORRECTION",
    ],
    prohibitedClaimTypes: [...UNIVERSAL_PROHIBITED_CLAIMS, "CITE_FCRA_611_TO_FURNISHER"],
    claimRequirements: {},
    statuteReferenceIds: ["FCRA_623"],
    enclosurePolicy: enclosurePolicy(SUPPORTING_ENCLOSURES),
    consolidationPolicy: consolidationPolicy("STANDALONE"),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "fdcpa",
    status: "PENDING_COUNSEL",
    counselApprovalRequired: true,
    counselApprovalStatus: "PENDING_COUNSEL",
    recipientTypes: ["COLLECTOR_FURNISHER"],
    applicabilityPredicates: [
      "DUAL_COLLECTOR_FURNISHER_ROLE_VERIFIED",
      "ACCOUNT_RECIPIENT_LINK_VERIFIED",
      "DIRECT_DISPUTE_RULE_APPLICABLE",
    ],
    requiredObservationTypes: [
      "DUAL_RECIPIENT_ROLE",
      "ACCOUNT_RECIPIENT_LINK",
      "DIRECT_DISPUTE_APPLICABILITY",
      "BUREAU_SCOPED_FIELD",
    ],
    requiredConsumerAssertions: [
      "VALIDATION_REQUEST_ELECTED",
      "DIRECT_DISPUTE_BASIS_CONFIRMED",
      "EXACT_FIELD_DISPUTED",
    ],
    requiredTimingFacts: [],
    allowedClaimTypes: [
      "REQUEST_VALIDATION_INFORMATION",
      "REQUEST_ACCOUNT_AUTHORITY_INFORMATION",
      "ASSERT_CEASE_PENDING_VALIDATION",
      "IDENTIFY_DISPUTED_FIELD",
      "REQUEST_DIRECT_FURNISHER_INVESTIGATION",
      "REQUEST_DIRECT_FURNISHER_CORRECTION",
    ],
    prohibitedClaimTypes: [...UNIVERSAL_PROHIBITED_CLAIMS, "ASSERT_UNCONDITIONAL_CEASE"],
    claimRequirements: {
      ASSERT_CEASE_PENDING_VALIDATION: {
        requiredTimingFacts: [
          "COLLECTOR_INITIAL_NOTICE_DATE_RECORDED",
          "CONSUMER_WRITTEN_DISPUTE_DATE_RECORDED",
          "VALIDATION_PERIOD_ELIGIBILITY_DETERMINED",
        ],
        requiredObservationTypes: [],
        requiredConsumerAssertions: [],
      },
    },
    statuteReferenceIds: ["FDCPA_809", "FCRA_623"],
    enclosurePolicy: enclosurePolicy(SUPPORTING_ENCLOSURES),
    consolidationPolicy: consolidationPolicy("STANDALONE"),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "escalation",
    status: "DRAFT",
    counselApprovalRequired: false,
    counselApprovalStatus: "NOT_REQUIRED",
    recipientTypes: ["CREDIT_REPORTING_AGENCY", "DEBT_COLLECTOR", "FURNISHER", "COLLECTOR_FURNISHER"],
    applicabilityPredicates: ["UNRESOLVED_PRIOR_CASE"],
    requiredObservationTypes: [
      "PRIOR_CORRESPONDENCE_VERSION",
      "DELIVERY_EVIDENCE",
      "RECIPIENT_RESPONSE_OR_ELAPSED_WINDOW",
      "RESPONSE_FINDING",
      "UNRESOLVED_CONFIRMED_FIELD",
      "NEW_SUPPORTING_EVIDENCE",
    ],
    requiredConsumerAssertions: ["FOLLOW_UP_APPROVED", "EXACT_FIELD_DISPUTED"],
    requiredTimingFacts: ["ROUND_ONE_DELIVERY_RECORDED", "RESPONSE_RECEIVED_OR_ELIGIBLE_WINDOW_ELAPSED"],
    allowedClaimTypes: ["DOCUMENT_ROUND_HISTORY", "FOLLOW_UP_UNRESOLVED_FACT"],
    prohibitedClaimTypes: [
      ...UNIVERSAL_PROHIBITED_CLAIMS,
      "THREATEN_REGULATOR_ACTION",
      "FABRICATE_NONRESPONSE",
    ],
    claimRequirements: {},
    statuteReferenceIds: [],
    enclosurePolicy: enclosurePolicy(
      [
        "REPORT_EXCERPT",
        "CONSUMER_STATEMENT",
        "SUPPORTING_RECORD",
        "PRIOR_CORRESPONDENCE_COPY",
        "DELIVERY_PROOF",
        "RECIPIENT_RESPONSE_COPY",
      ],
      ["PRIOR_CORRESPONDENCE_COPY", "DELIVERY_PROOF"]
    ),
    consolidationPolicy: consolidationPolicy("SAME_RECIPIENT_SAME_ROUND", ["escalation"]),
    roundPolicy: {
      minimum: 2,
      maximum: 2,
      prerequisites: [
        "IMMUTABLE_PARENT_VERSION",
        "SAME_RECIPIENT_AS_PARENT",
        "PRIOR_DELIVERY_PROVEN",
        "RESPONSE_OR_ELIGIBLE_WINDOW",
        "UNRESOLVED_CONFIRMED_GROUND",
        "NEW_EVIDENCE_PRESENT",
        "EXPLICIT_FOLLOW_UP_APPROVAL",
      ],
    },
  }),
  policy({
    strategyId: "goodwill",
    status: "PENDING_COUNSEL",
    counselApprovalRequired: true,
    counselApprovalStatus: "PENDING_COUNSEL",
    recipientTypes: ["FURNISHER"],
    applicabilityPredicates: [
      "FURNISHER_ROLE_VERIFIED",
      "ACCURATE_ADVERSE_INFORMATION_ACKNOWLEDGED",
      "CONSUMER_CONTEXT_PROVIDED",
    ],
    requiredObservationTypes: ["FURNISHER_ROLE", "ACTUAL_ADVERSE_FIELD", "CONSUMER_PROVIDED_CONTEXT"],
    requiredConsumerAssertions: ["ACCURACY_ACKNOWLEDGED", "GOODWILL_REQUEST_ELECTED"],
    requiredTimingFacts: [],
    allowedClaimTypes: ["REQUEST_COURTESY_ADJUSTMENT"],
    prohibitedClaimTypes: [...UNIVERSAL_PROHIBITED_CLAIMS, "ASSERT_ACCURATE_INFORMATION_INACCURATE"],
    claimRequirements: {},
    statuteReferenceIds: [],
    enclosurePolicy: enclosurePolicy(["CONSUMER_STATEMENT", "SUPPORTING_RECORD"]),
    consolidationPolicy: consolidationPolicy("STANDALONE"),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "pay_delete",
    status: "PENDING_COUNSEL",
    counselApprovalRequired: true,
    counselApprovalStatus: "PENDING_COUNSEL",
    recipientTypes: ["DEBT_COLLECTOR"],
    applicabilityPredicates: [
      "COLLECTION_ROLE_VERIFIED",
      "ACCOUNT_RECIPIENT_LINK_VERIFIED",
      "SETTLEMENT_AUTHORITY_VERIFIED",
      "NEGOTIATION_POLICY_APPLICABLE",
    ],
    requiredObservationTypes: [
      "COLLECTOR_ROLE",
      "ACCOUNT_RECIPIENT_LINK",
      "OWNERSHIP_OR_SETTLEMENT_AUTHORITY",
      "SETTLEMENT_TERMS",
    ],
    requiredConsumerAssertions: ["NEGOTIATION_AUTHORIZED", "NEGOTIATION_RISK_ACKNOWLEDGED"],
    requiredTimingFacts: [],
    allowedClaimTypes: ["PROPOSE_CONDITIONAL_SETTLEMENT"],
    prohibitedClaimTypes: [...UNIVERSAL_PROHIBITED_CLAIMS, "ASSERT_DELETION_REQUIRED_FOR_PAYMENT"],
    claimRequirements: {},
    statuteReferenceIds: [],
    enclosurePolicy: enclosurePolicy(["CONSUMER_STATEMENT", "SUPPORTING_RECORD"]),
    consolidationPolicy: consolidationPolicy("STANDALONE"),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "cease_desist",
    status: "PENDING_COUNSEL",
    counselApprovalRequired: true,
    counselApprovalStatus: "PENDING_COUNSEL",
    recipientTypes: ["DEBT_COLLECTOR"],
    applicabilityPredicates: ["COLLECTION_ROLE_VERIFIED", "ACCOUNT_RECIPIENT_LINK_VERIFIED"],
    requiredObservationTypes: ["COLLECTOR_ROLE", "ACCOUNT_RECIPIENT_LINK"],
    requiredConsumerAssertions: [
      "CEASE_COMMUNICATION_AUTHORIZED",
      "CEASE_CONSEQUENCES_ACKNOWLEDGED",
    ],
    requiredTimingFacts: [],
    allowedClaimTypes: ["REQUEST_COMMUNICATION_CESSATION"],
    prohibitedClaimTypes: [
      ...UNIVERSAL_PROHIBITED_CLAIMS,
      "ASSERT_DEBT_RESOLVED_BY_COMMUNICATION_CESSATION",
    ],
    claimRequirements: {},
    statuteReferenceIds: ["FDCPA_805_C"],
    enclosurePolicy: enclosurePolicy(["CONSUMER_STATEMENT"]),
    consolidationPolicy: consolidationPolicy("STANDALONE"),
    roundPolicy: { minimum: 1, maximum: 1, prerequisites: [] },
  }),
  policy({
    strategyId: "cfpb_threat",
    status: "PENDING_COUNSEL",
    counselApprovalRequired: true,
    counselApprovalStatus: "PENDING_COUNSEL",
    recipientTypes: ["REGULATOR"],
    applicabilityPredicates: ["PRIOR_CORRESPONDENCE_HISTORY_SUPPORTED", "UNRESOLVED_PRIOR_CASE"],
    requiredObservationTypes: [
      "PRIOR_CORRESPONDENCE_VERSION",
      "PRIOR_CORRESPONDENCE_CHRONOLOGY",
      "UNRESOLVED_ISSUE_EVIDENCE",
    ],
    requiredConsumerAssertions: ["REGULATOR_ESCALATION_AUTHORIZED", "COMPLAINT_FACTS_CONFIRMED"],
    requiredTimingFacts: ["ROUND_ONE_DELIVERY_RECORDED", "RESPONSE_RECEIVED_OR_ELIGIBLE_WINDOW_ELAPSED"],
    allowedClaimTypes: ["PREPARE_COMPLAINT_DRAFT"],
    prohibitedClaimTypes: [
      ...UNIVERSAL_PROHIBITED_CLAIMS,
      "THREATEN_REGULATOR_ACTION",
      "FABRICATE_NONRESPONSE",
      "AUTO_SUBMIT_REGULATOR_COMPLAINT",
    ],
    claimRequirements: {},
    statuteReferenceIds: [],
    enclosurePolicy: enclosurePolicy(
      [
        "REPORT_EXCERPT",
        "CONSUMER_STATEMENT",
        "SUPPORTING_RECORD",
        "PRIOR_CORRESPONDENCE_COPY",
        "DELIVERY_PROOF",
        "RECIPIENT_RESPONSE_COPY",
        "EVIDENCE_INDEX",
      ],
      ["PRIOR_CORRESPONDENCE_COPY", "EVIDENCE_INDEX"]
    ),
    consolidationPolicy: consolidationPolicy("STANDALONE"),
    roundPolicy: {
      minimum: 2,
      maximum: 99,
      prerequisites: [
        "IMMUTABLE_PARENT_VERSION",
        "PRIOR_DELIVERY_PROVEN",
        "RESPONSE_OR_ELIGIBLE_WINDOW",
        "UNRESOLVED_CONFIRMED_GROUND",
        "COMPLETE_PRIOR_CHRONOLOGY",
        "EXPLICIT_REGULATOR_INTENT",
        "EXPLICIT_REGULATOR_APPROVAL",
        "SEPARATE_REGULATOR_WORKFLOW",
      ],
    },
  }),
];

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export const PHASE_1_STRATEGY_POLICY_SET: StrategyPolicySet = deepFreeze({
  schemaVersion: STRATEGY_POLICY_SCHEMA_VERSION,
  policySetVersion: PHASE_1_STRATEGY_POLICY_SET_VERSION,
  status: "DORMANT_PHASE_1",
  policies: POLICIES,
});

function addReason(
  reasons: StrategyPolicyDenialReason[],
  code: StrategyPolicyDenialCode,
  requirement?: string
): void {
  if (!reasons.some((reason) => reason.code === code && reason.requirement === requirement)) {
    reasons.push(requirement ? { code, requirement } : { code });
  }
}

function missing<T extends string>(required: readonly T[], actual: ReadonlySet<T>): T[] {
  return required.filter((value) => !actual.has(value));
}

const OBSERVATION_BOUND_ASSERTION_TYPES = new Set<ConsumerAssertionType>([
  "EXACT_FIELD_DISPUTED",
  "EXACT_INCONSISTENCY_CONFIRMED",
  "OBSOLESCENCE_BASIS_CONFIRMED",
  "DIRECT_DISPUTE_BASIS_CONFIRMED",
  "ACCURACY_ACKNOWLEDGED",
]);

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isSha256Digest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function validPolicyContextBinding(binding: PolicyContextBinding): boolean {
  return (
    isNonEmpty(binding.tenantId) &&
    isNonEmpty(binding.consumerId) &&
    isNonEmpty(binding.caseId) &&
    isNonEmpty(binding.contextId) &&
    isNonEmpty(binding.contextVersion) &&
    isSha256Digest(binding.contextDigest) &&
    isNonEmpty(binding.policyVersion)
  );
}

function exactPolicyContextBinding(left: PolicyContextBinding, right: PolicyContextBinding): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.consumerId === right.consumerId &&
    left.caseId === right.caseId &&
    left.contextId === right.contextId &&
    left.contextVersion === right.contextVersion &&
    left.contextDigest === right.contextDigest &&
    left.strategyId === right.strategyId &&
    left.policyVersion === right.policyVersion
  );
}

function observationDispositionMatchesPolicyAssertion(
  assertion: ObservationBoundPolicyAssertion
): boolean {
  if (assertion.type === "ACCURACY_ACKNOWLEDGED") {
    return assertion.assertion.disposition === "CONFIRMED_ACCURATE";
  }
  return validateConsumerAssertionBinding(
    assertion.assertion,
    assertion.assertion.binding
  ).supportsDisputeGround;
}

function policyAssertionBindingIsCurrent(
  assertion: ConsumerAssertionEvidence,
  current: CurrentConsumerAssertionBinding,
  expected: {
    strategyId: StrategyPolicyId;
    policyVersion: string;
    scope: StrategyPolicyEvaluationScope;
  }
): boolean {
  if (assertion.type !== current.type || assertion.bindingKind !== current.bindingKind) {
    return false;
  }

  const expectsObservation = OBSERVATION_BOUND_ASSERTION_TYPES.has(assertion.type);
  if (expectsObservation && assertion.bindingKind !== "OBSERVATION") return false;
  if (!expectsObservation && assertion.bindingKind !== "POLICY_CONTEXT") return false;

  if (assertion.bindingKind === "OBSERVATION" && current.bindingKind === "OBSERVATION") {
    const validation = validateConsumerAssertionBinding(
      assertion.assertion,
      current.observationBinding
    );
    return (
      validation.status === "CURRENT" &&
      assertion.assertion.binding.tenantId === expected.scope.tenantId &&
      assertion.assertion.binding.consumerId === expected.scope.consumerId &&
      current.observationBinding.tenantId === expected.scope.tenantId &&
      current.observationBinding.consumerId === expected.scope.consumerId &&
      observationDispositionMatchesPolicyAssertion(assertion)
    );
  }

  if (assertion.bindingKind === "POLICY_CONTEXT" && current.bindingKind === "POLICY_CONTEXT") {
    return (
      assertion.status === "CONFIRMED" &&
      isNonEmpty(assertion.assertionId) &&
      isNonEmpty(assertion.assertionVersion) &&
      isSha256Digest(assertion.assertionDigest) &&
      validPolicyContextBinding(assertion.policyContextBinding) &&
      validPolicyContextBinding(current.policyContextBinding) &&
      current.policyContextBinding.tenantId === expected.scope.tenantId &&
      current.policyContextBinding.consumerId === expected.scope.consumerId &&
      current.policyContextBinding.caseId === expected.scope.caseId &&
      current.policyContextBinding.strategyId === expected.strategyId &&
      current.policyContextBinding.policyVersion === expected.policyVersion &&
      exactPolicyContextBinding(assertion.policyContextBinding, current.policyContextBinding)
    );
  }

  return false;
}

function validateAssertionScopes(
  reasons: StrategyPolicyDenialReason[],
  assertions: readonly ConsumerAssertionEvidence[],
  currentBindings: readonly CurrentConsumerAssertionBinding[],
  scope: StrategyPolicyEvaluationScope
): void {
  for (const assertion of assertions) {
    if (assertion.bindingKind === "OBSERVATION") {
      if (assertion.assertion.binding.tenantId !== scope.tenantId) {
        addReason(reasons, "OBSERVATION_ASSERTION_TENANT_SCOPE_MISMATCH");
      }
      if (assertion.assertion.binding.consumerId !== scope.consumerId) {
        addReason(reasons, "OBSERVATION_ASSERTION_CONSUMER_SCOPE_MISMATCH");
      }
      continue;
    }
    if (assertion.policyContextBinding.tenantId !== scope.tenantId) {
      addReason(reasons, "POLICY_CONTEXT_TENANT_SCOPE_MISMATCH");
    }
    if (assertion.policyContextBinding.consumerId !== scope.consumerId) {
      addReason(reasons, "POLICY_CONTEXT_CONSUMER_SCOPE_MISMATCH");
    }
    if (assertion.policyContextBinding.caseId !== scope.caseId) {
      addReason(reasons, "POLICY_CONTEXT_CASE_SCOPE_MISMATCH");
    }
  }

  for (const current of currentBindings) {
    if (current.bindingKind === "OBSERVATION") {
      if (current.observationBinding.tenantId !== scope.tenantId) {
        addReason(reasons, "OBSERVATION_ASSERTION_TENANT_SCOPE_MISMATCH");
      }
      if (current.observationBinding.consumerId !== scope.consumerId) {
        addReason(reasons, "OBSERVATION_ASSERTION_CONSUMER_SCOPE_MISMATCH");
      }
      continue;
    }
    if (current.policyContextBinding.tenantId !== scope.tenantId) {
      addReason(reasons, "POLICY_CONTEXT_TENANT_SCOPE_MISMATCH");
    }
    if (current.policyContextBinding.consumerId !== scope.consumerId) {
      addReason(reasons, "POLICY_CONTEXT_CONSUMER_SCOPE_MISMATCH");
    }
    if (current.policyContextBinding.caseId !== scope.caseId) {
      addReason(reasons, "POLICY_CONTEXT_CASE_SCOPE_MISMATCH");
    }
  }
}

function requireConsumerAssertions(
  reasons: StrategyPolicyDenialReason[],
  required: readonly ConsumerAssertionType[],
  actual: readonly ConsumerAssertionEvidence[],
  currentBindings: readonly CurrentConsumerAssertionBinding[],
  expected: {
    strategyId: StrategyPolicyId;
    policyVersion: string;
    scope: StrategyPolicyEvaluationScope;
  }
): void {
  for (const assertionType of required) {
    const candidates = actual.filter((assertion) => assertion.type === assertionType);
    if (candidates.length === 0) {
      addReason(reasons, "REQUIRED_CONSUMER_ASSERTION_MISSING", assertionType);
      continue;
    }
    const confirmed = candidates.filter((assertion) =>
      assertion.bindingKind === "OBSERVATION"
        ? observationDispositionMatchesPolicyAssertion(assertion)
        : assertion.status === "CONFIRMED"
    );
    if (confirmed.length === 0) {
      addReason(reasons, "CONSUMER_ASSERTION_NOT_CONFIRMED", assertionType);
      continue;
    }

    const proofValid = confirmed.filter(
      (assertion) => {
        if (assertion.bindingKind === "OBSERVATION") {
          return (
            assertion.assertion.bindingVersion === CONSUMER_ASSERTION_BINDING_VERSION &&
            validateConsumerAssertionBinding(
              assertion.assertion,
              assertion.assertion.binding
            ).status !== "INVALID_BINDING"
          );
        }
        return (
          isNonEmpty(assertion.assertionId) &&
          isNonEmpty(assertion.assertionVersion) &&
          isSha256Digest(assertion.assertionDigest)
        );
      }
    );
    if (proofValid.length === 0) {
      addReason(reasons, "CONSUMER_ASSERTION_PROOF_INVALID", assertionType);
      continue;
    }

    const expectedBindingKind = OBSERVATION_BOUND_ASSERTION_TYPES.has(assertionType)
      ? "OBSERVATION"
      : "POLICY_CONTEXT";
    const correctKind = proofValid.filter(
      (assertion) => assertion.bindingKind === expectedBindingKind
    );
    if (correctKind.length === 0) {
      addReason(reasons, "CONSUMER_ASSERTION_BINDING_KIND_INVALID", assertionType);
      continue;
    }

    const currentForType = currentBindings.filter((binding) => binding.type === assertionType);
    const current = correctKind.some((assertion) =>
      currentForType.some((binding) =>
        policyAssertionBindingIsCurrent(assertion, binding, expected)
      )
    );
    if (!current) {
      addReason(
        reasons,
        expectedBindingKind === "OBSERVATION"
          ? "CONSUMER_ASSERTION_NOT_BOUND_TO_CURRENT_OBSERVATION"
          : "CONSUMER_ASSERTION_NOT_BOUND_TO_CURRENT_POLICY_CONTEXT",
        assertionType
      );
    }
  }
}

function evaluateConsolidation(
  reasons: StrategyPolicyDenialReason[],
  policySet: StrategyPolicySet,
  definition: StrategyPolicyDefinition,
  request: StrategyPolicyEvaluationRequest,
  candidate: ConsolidationCandidate | undefined
): void {
  if (!candidate || candidate.items.length <= 1) return;
  const consolidation = definition.consolidationPolicy;
  if (consolidation.mode === "STANDALONE") {
    addReason(reasons, "CONSOLIDATION_REQUIRES_STANDALONE", definition.strategyId);
  }

  for (const item of candidate.items) {
    if (
      !isNonEmpty(item.tenantId) ||
      !isNonEmpty(item.consumerId) ||
      !isNonEmpty(item.caseId) ||
      !isNonEmpty(item.itemId) ||
      !isNonEmpty(item.recipientId) ||
      !isNonEmpty(item.recipientAddressVersionId) ||
      !Number.isInteger(item.round) ||
      item.round < 1 ||
      !isNonEmpty(item.policyVersion) ||
      !isNonEmpty(item.claimCompatibilityKey) ||
      !isNonEmpty(item.enclosureCompatibilityKey)
    ) {
      addReason(reasons, "CONSOLIDATION_ITEM_METADATA_INCOMPLETE", item.itemId || "missing-item-id");
    }
  }

  const itemIds = candidate.items.map((item) => item.itemId);
  if (new Set(itemIds).size !== itemIds.length) {
    addReason(reasons, "CONSOLIDATION_DUPLICATE_ITEM_ID");
  }

  const currentItem = candidate.items.find((item) => item.itemId === request.correspondenceItemId);
  if (!currentItem) addReason(reasons, "CONSOLIDATION_CURRENT_ITEM_MISSING");

  if (candidate.items.some((item) => item.tenantId !== request.scope.tenantId)) {
    addReason(reasons, "CONSOLIDATION_TENANT_SCOPE_MISMATCH");
  }
  if (candidate.items.some((item) => item.consumerId !== request.scope.consumerId)) {
    addReason(reasons, "CONSOLIDATION_CONSUMER_SCOPE_MISMATCH");
  }
  if (candidate.items.some((item) => item.caseId !== request.scope.caseId)) {
    addReason(reasons, "CONSOLIDATION_CASE_SCOPE_MISMATCH");
  }
  if (candidate.items.some((item) => item.recipientId !== request.recipientId)) {
    addReason(reasons, "CONSOLIDATION_RECIPIENT_MISMATCH");
  }
  if (
    candidate.items.some(
      (item) => item.recipientAddressVersionId !== request.recipientAddressVersionId
    )
  ) {
    addReason(reasons, "CONSOLIDATION_ADDRESS_VERSION_MISMATCH");
  }
  if (candidate.items.some((item) => item.round !== request.round)) {
    addReason(reasons, "CONSOLIDATION_ROUND_MISMATCH");
  }
  if (candidate.items.some((item) => item.policyVersion !== definition.policyVersion)) {
    addReason(reasons, "CONSOLIDATION_POLICY_VERSION_MISMATCH");
  }

  const recipientTypes = new Set(candidate.items.map((item) => item.recipientType));
  if (recipientTypes.size > 1) {
    addReason(reasons, "CONSOLIDATION_MIXED_RECIPIENT_TYPES");
  }
  if (candidate.items.some((item) => item.recipientType !== request.recipientType)) {
    addReason(reasons, "CONSOLIDATION_RECIPIENT_TYPE_NOT_ALLOWED");
  }

  for (const item of candidate.items) {
    if (!consolidation.compatibleStrategyIds.includes(item.strategyId)) {
      addReason(reasons, "CONSOLIDATION_STRATEGY_INCOMPATIBLE", item.strategyId);
      continue;
    }
    const itemDefinition = policySet.policies.find(
      (candidateDefinition) =>
        candidateDefinition.strategyId === item.strategyId &&
        candidateDefinition.policyVersion === item.policyVersion
    );
    if (!itemDefinition) {
      addReason(reasons, "CONSOLIDATION_STRATEGY_INCOMPATIBLE", item.strategyId);
      continue;
    }
    if (
      item.claimCompatibilityKey !== itemDefinition.consolidationPolicy.claimCompatibilityKey ||
      item.claimCompatibilityKey !== consolidation.claimCompatibilityKey
    ) {
      addReason(reasons, "CONSOLIDATION_CLAIM_INCOMPATIBLE", item.itemId);
    }
    if (
      item.enclosureCompatibilityKey !==
        itemDefinition.consolidationPolicy.enclosureCompatibilityKey ||
      item.enclosureCompatibilityKey !== consolidation.enclosureCompatibilityKey
    ) {
      addReason(reasons, "CONSOLIDATION_ENCLOSURE_INCOMPATIBLE", item.itemId);
    }
  }
}

/**
 * Evaluates supplied facts against one exact policy version. It returns every
 * applicable fail-closed reason and never mutates its policy set or request.
 */
export function evaluateStrategyPolicy(
  policySet: StrategyPolicySet,
  request: StrategyPolicyEvaluationRequest
): StrategyPolicyEvaluation {
  const sameId = policySet.policies.filter((candidate) => candidate.strategyId === request.strategyId);
  if (sameId.length === 0) {
    return {
      decision: "DENY",
      strategyId: request.strategyId,
      requestedPolicyVersion: request.policyVersion,
      policySetVersion: policySet.policySetVersion,
      reasons: [{ code: "UNKNOWN_STRATEGY" }],
    };
  }

  const definition = sameId.find((candidate) => candidate.policyVersion === request.policyVersion);
  if (!definition) {
    return {
      decision: "DENY",
      strategyId: request.strategyId,
      requestedPolicyVersion: request.policyVersion,
      policySetVersion: policySet.policySetVersion,
      reasons: [{ code: "POLICY_VERSION_NOT_FOUND", requirement: request.policyVersion }],
    };
  }

  const reasons: StrategyPolicyDenialReason[] = [];
  if (policySet.status === "DORMANT_PHASE_1") addReason(reasons, "POLICY_SET_DORMANT");
  if (policySet.status === "RETIRED") addReason(reasons, "POLICY_SET_RETIRED");

  if (definition.status === "DRAFT") addReason(reasons, "STRATEGY_DRAFT");
  if (definition.status === "PENDING_COUNSEL") addReason(reasons, "COUNSEL_APPROVAL_PENDING");
  if (definition.status === "RETIRED") addReason(reasons, "STRATEGY_RETIRED");
  if (definition.counselApprovalStatus === "PENDING_COUNSEL") {
    addReason(reasons, "COUNSEL_APPROVAL_PENDING");
  }
  if (definition.counselApprovalStatus === "REJECTED") {
    addReason(reasons, "COUNSEL_APPROVAL_REJECTED");
  }
  if (
    definition.counselApprovalRequired &&
    definition.status === "APPROVED" &&
    definition.counselApprovalStatus !== "APPROVED"
  ) {
    addReason(reasons, "COUNSEL_APPROVAL_INCONSISTENT");
  }
  if (
    !definition.counselApprovalRequired &&
    !["NOT_REQUIRED", "APPROVED"].includes(definition.counselApprovalStatus)
  ) {
    addReason(reasons, "COUNSEL_APPROVAL_INCONSISTENT");
  }

  if (request.contextStatus !== "COMPLETE") addReason(reasons, "CONTEXT_INCOMPLETE");
  if (
    !isNonEmpty(request.scope.tenantId) ||
    !isNonEmpty(request.scope.consumerId) ||
    !isNonEmpty(request.scope.caseId)
  ) {
    addReason(reasons, "EVALUATION_SCOPE_INCOMPLETE");
  }
  if (!isNonEmpty(request.correspondenceItemId)) {
    addReason(reasons, "CORRESPONDENCE_ITEM_ID_MISSING");
  }
  if (!isNonEmpty(request.recipientId)) addReason(reasons, "RECIPIENT_ID_MISSING");
  if (!isNonEmpty(request.recipientAddressVersionId)) {
    addReason(reasons, "RECIPIENT_ADDRESS_VERSION_ID_MISSING");
  }
  if (!definition.recipientTypes.includes(request.recipientType)) {
    addReason(reasons, "RECIPIENT_TYPE_NOT_ALLOWED", request.recipientType);
  }
  if (request.addressStatus !== definition.requiredAddressStatus) {
    addReason(reasons, "RECIPIENT_ADDRESS_NOT_VERIFIED_VERSIONED", request.addressStatus);
  }
  if (request.round < definition.roundPolicy.minimum || request.round > definition.roundPolicy.maximum) {
    addReason(reasons, "ROUND_NOT_ALLOWED", String(request.round));
  }

  const applicability = new Set(request.applicabilityFacts);
  for (const requirement of missing(definition.applicabilityPredicates, applicability)) {
    addReason(reasons, "APPLICABILITY_PREDICATE_MISSING", requirement);
  }

  const observations = new Set(request.observationTypes);
  for (const requirement of missing(definition.requiredObservationTypes, observations)) {
    addReason(reasons, "REQUIRED_OBSERVATION_MISSING", requirement);
  }

  const timingFacts = new Set(request.timingFacts);
  for (const requirement of missing(definition.requiredTimingFacts, timingFacts)) {
    addReason(reasons, "REQUIRED_TIMING_FACT_MISSING", requirement);
  }

  validateAssertionScopes(
    reasons,
    request.consumerAssertions,
    request.currentAssertionBindings,
    request.scope
  );

  requireConsumerAssertions(
    reasons,
    definition.requiredConsumerAssertions,
    request.consumerAssertions,
    request.currentAssertionBindings,
    {
      strategyId: definition.strategyId,
      policyVersion: definition.policyVersion,
      scope: request.scope,
    }
  );

  if (request.claimTypes.length === 0) addReason(reasons, "CLAIM_SELECTION_MISSING");

  for (const claimType of request.claimTypes) {
    if (definition.prohibitedClaimTypes.includes(claimType)) {
      addReason(reasons, "PROHIBITED_CLAIM_TYPE", claimType);
    } else if (!definition.allowedClaimTypes.includes(claimType)) {
      addReason(reasons, "CLAIM_TYPE_NOT_ALLOWED", claimType);
    }

    const claimRequirement = definition.claimRequirements[claimType];
    if (claimRequirement) {
      for (const requirement of missing(claimRequirement.requiredTimingFacts, timingFacts)) {
        addReason(reasons, "REQUIRED_TIMING_FACT_MISSING", `${claimType}:${requirement}`);
      }
      for (const requirement of missing(claimRequirement.requiredObservationTypes, observations)) {
        addReason(reasons, "REQUIRED_OBSERVATION_MISSING", `${claimType}:${requirement}`);
      }
      requireConsumerAssertions(
        reasons,
        claimRequirement.requiredConsumerAssertions,
        request.consumerAssertions,
        request.currentAssertionBindings,
        {
          strategyId: definition.strategyId,
          policyVersion: definition.policyVersion,
          scope: request.scope,
        }
      );
    }
  }

  for (const referenceId of request.statuteReferenceIds) {
    if (!definition.statuteReferenceIds.includes(referenceId)) {
      addReason(reasons, "STATUTE_REFERENCE_NOT_ALLOWED", referenceId);
    }
  }

  const enclosures = new Set(request.enclosures);
  for (const requirement of missing(definition.enclosurePolicy.required, enclosures)) {
    addReason(reasons, "REQUIRED_ENCLOSURE_MISSING", requirement);
  }
  for (const enclosure of request.enclosures) {
    if (definition.enclosurePolicy.prohibited.includes(enclosure)) {
      addReason(reasons, "PROHIBITED_ENCLOSURE", enclosure);
    } else if (!definition.enclosurePolicy.allowed.includes(enclosure)) {
      addReason(reasons, "ENCLOSURE_NOT_ALLOWED", enclosure);
    }
  }

  const escalationFacts = new Set(request.escalationFacts);
  for (const requirement of missing(definition.roundPolicy.prerequisites, escalationFacts)) {
    addReason(reasons, "ESCALATION_PREREQUISITE_MISSING", requirement);
  }

  evaluateConsolidation(reasons, policySet, definition, request, request.consolidation);

  return {
    decision: reasons.length === 0 ? "ALLOW" : "DENY",
    strategyId: request.strategyId,
    requestedPolicyVersion: request.policyVersion,
    resolvedPolicyVersion: definition.policyVersion,
    policySetVersion: policySet.policySetVersion,
    reasons,
  };
}
