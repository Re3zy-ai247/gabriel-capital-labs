import { createHash } from "node:crypto";
import type { Bureau } from "@prisma/client";

/**
 * Phase-1-only, dormant contracts for future report progress intelligence.
 *
 * This module is deliberately pure: no database, network, UI, production read
 * path, or generic-AI dependency. Consumer values used while comparing exact
 * observations are ephemeral and are never copied into durable difference or
 * outcome candidates.
 */
export const PROGRESS_INTELLIGENCE_CONTRACT_VERSION =
  "credit-progress-intelligence-v1" as const;
export const PROGRESS_INTELLIGENCE_ROLLOUT_MODE = "DORMANT_PHASE_1" as const;
export const TRUSTED_PROGRESS_WRITER_ID =
  "CREDIT_TRUTH_REPOSITORY" as const;
export const TRUSTED_PROGRESS_WRITER_SEMANTICS_VERSION =
  "credit-truth-repository-semantics-v1" as const;

export const PROGRESS_REPOSITORY_READ_KINDS = [
  "ACCOUNT_PRESENCE_PAIR",
  "FIELD_OBSERVATION_PAIR",
  "BUREAU_COVERAGE_PAIR",
  "IDENTITY_FACT_PAIR",
  "CREDIT_SCORE_PAIR",
  "PERSISTED_REPORT_DIFFERENCE",
  "APPROVED_CORRESPONDENCE_CHAIN",
  "HUMAN_OUTCOME_CONFIRMATION",
] as const;

export type ProgressRepositoryReadKind =
  (typeof PROGRESS_REPOSITORY_READ_KINDS)[number];

export interface ProgressRepositoryReadVerification {
  readonly kind: ProgressRepositoryReadKind;
  readonly repositoryReadId: string;
  /** Ephemeral verifier binding; must never be persisted or logged. */
  readonly semanticSha256: string;
  /** Value-free durable source identity; never a plaintext-value fingerprint. */
  readonly sourceSetSha256: string;
  readonly snapshot: unknown;
}

/**
 * Activation must supply the authenticated repository implementation for this
 * verifier. The pure Phase-1 contract never treats a repository-shaped object
 * as proof that a read occurred.
 */
export interface TrustedProgressRepositoryVerifier {
  readonly writerId: typeof TRUSTED_PROGRESS_WRITER_ID;
  readonly semanticsVersion: typeof TRUSTED_PROGRESS_WRITER_SEMANTICS_VERSION;
  verifyRepositoryRead(input: ProgressRepositoryReadVerification): boolean;
}

const VERIFIED_PROGRESS_REPOSITORY_READ = Symbol(
  "verified-progress-repository-read"
);
const verifiedProgressRepositoryReads = new WeakMap<object, string>();

export interface VerifiedProgressRepositoryRead<T = unknown> {
  readonly kind: ProgressRepositoryReadKind;
  readonly repositoryReadId: string;
  /** Ephemeral verifier binding; must never be persisted or logged. */
  readonly semanticSha256: string;
  readonly sourceSetSha256: string;
  readonly snapshot: T;
  readonly [VERIFIED_PROGRESS_REPOSITORY_READ]: true;
}

export const REPORT_DIFFERENCE_SCOPES = [
  "ACCOUNT_PRESENCE",
  "FIELD_VALUE",
  "CREDIT_SCORE",
  "BUREAU_COVERAGE",
  "IDENTITY_FACT",
] as const;

export const REPORT_DIFFERENCE_CHANGE_KINDS = [
  "NEW_ITEM",
  "NO_LONGER_REPORTED",
  "STATUS_CHANGED",
  "BALANCE_CHANGED",
  "PAYMENT_HISTORY_CHANGED",
  "REMARK_CHANGED",
  "DISPUTE_NOTATION_CHANGED",
  "BUREAU_COVERAGE_CHANGED",
  "IDENTITY_INFORMATION_CHANGED",
  "SCORE_CHANGED",
  "OTHER_FIELD_CHANGED",
  "UNCHANGED",
  "UNABLE_TO_DETERMINE",
] as const;

export const DISPUTE_OUTCOME_STATES = [
  "PENDING_EVIDENCE",
  "CORRECTED",
  "DELETED",
  "UNCHANGED",
  "CHANGED_DIFFERENTLY",
  "NO_LONGER_REPORTED",
  "NEW_CONFLICT",
  "UNABLE_TO_DETERMINE",
] as const;

export const OUTCOME_CAUSALITY_STATES = [
  "NO_CAUSAL_CLAIM",
  "TEMPORAL_ASSOCIATION_ONLY",
  "INSUFFICIENT_EVIDENCE",
] as const;

export const NO_CAUSAL_ATTRIBUTION_NOTICE =
  "These report changes occurred during the same comparison period. The evidence does not establish that an item, correspondence, or dispute caused a score change." as const;

export type ReportDifferenceScope = (typeof REPORT_DIFFERENCE_SCOPES)[number];
export type ReportDifferenceChangeKind =
  (typeof REPORT_DIFFERENCE_CHANGE_KINDS)[number];
export type DisputeOutcomeState = (typeof DISPUTE_OUTCOME_STATES)[number];
export type OutcomeCausalityState = (typeof OUTCOME_CAUSALITY_STATES)[number];

export type ReportComparisonPurpose =
  | "EXTRACTION_RECONCILIATION"
  | "TEMPORAL_REPORT_CHANGE";
export type ComparisonChronologyBasis =
  | "SAME_SERIES_VERSION_ORDER"
  | "NOT_ESTABLISHED";
export type ReportComparisonState =
  | "PENDING_EVIDENCE"
  | "COMPARABLE"
  | "PARTIALLY_COMPARABLE"
  | "NOT_COMPARABLE";
export type ComparisonEvidenceCompleteness =
  | "COMPLETE"
  | "PARTIAL"
  | "INCOMPLETE"
  | "UNKNOWN";
export type DifferenceComparability =
  | "COMPARABLE"
  | "PARTIAL"
  | "NOT_COMPARABLE"
  | "UNKNOWN";
export type ReportDifferenceState =
  | "CHANGED"
  | "UNCHANGED"
  | "NOT_COMPARABLE"
  | "REVIEW_REQUIRED";
export type DeletionInferenceState =
  | "NOT_APPLICABLE"
  | "ABSENT_CONFIRMED_ON_CURRENT_REPORT"
  | "PRESENT_ON_CURRENT_REPORT"
  | "UNKNOWN_INCOMPLETE";

export type ObservationPresence = "PRESENT" | "ABSENT_CONFIRMED" | "UNKNOWN";
export type SourceCompleteness =
  | "COMPLETE"
  | "PARTIAL"
  | "FAILED"
  | "NOT_PROVIDED"
  | "UNKNOWN";
export type BureauCoverageStatus = "COVERED" | "OUTSIDE_COVERAGE";

export type ReportDateEvidence =
  | {
      provenance: "SOURCE_REPORTED";
      reportDate: string;
      sourceLocatorToken: string;
      ruleKey: string;
      ruleVersion: string;
    }
  | {
      provenance: "EXPLICIT_NOT_PROVIDED";
      sourceLocatorToken: string;
      ruleKey: string;
      ruleVersion: string;
    }
  | {
      provenance: "UNKNOWN";
      reasonCode: string;
    };

export interface ProgressScope {
  tenantId: string;
  consumerId: string;
}

export interface ReportCheckpoint extends ProgressScope {
  reportVersionId: string;
  extractionRunId: string;
  reportSeriesKey: string;
  reportVersion: number;
  reportInputSha256: string;
  reportDateEvidence: ReportDateEvidence;
}

export interface ReportComparisonContext extends ProgressScope {
  comparisonId: string;
  comparisonSeriesKey: string;
  version: number;
  idempotencyKey: string;
  supersedesComparisonId: string | null;
  prior: ReportCheckpoint;
  current: ReportCheckpoint;
  purpose: ReportComparisonPurpose;
  chronologyBasis: ComparisonChronologyBasis;
  state: ReportComparisonState;
  evidenceCompleteness: ComparisonEvidenceCompleteness;
  sourcePolicy: "REPORT_DERIVED_ONLY";
  comparisonModelKey: string;
  comparisonModelVersion: string;
  reasonCodes: readonly string[];
}

export type ScoreModelMetadata =
  | {
      completeness: "COMPLETE";
      modelKey: string;
      modelVersion: string;
      scaleMin: number;
      scaleMax: number;
    }
  | {
      completeness: "PARTIAL";
      modelKey?: string;
      modelVersion?: string;
      scaleMin?: number;
      scaleMax?: number;
    }
  | { completeness: "UNKNOWN" };

interface CreditScoreObservationBase extends ProgressScope {
  observationId: string;
  observationSeriesKey: string;
  revision: number;
  idempotencyKey: string;
  supersedesObservationId: string | null;
  bureau: Bureau;
  occurrence: number;
  sourceMethodKey: string;
  sourceMethodVersion: string;
  observedAt: string;
}

export type ReportDerivedCreditScoreObservation = CreditScoreObservationBase & {
  sourceType: "REPORT_DERIVED";
  evidenceRole: "PRIMARY_REPORT_EVIDENCE";
  checkpoint: ReportCheckpoint;
  bureauCoverageId: string;
  coverageStatus: BureauCoverageStatus;
  sourceLocatorToken?: string;
} & (
    | {
        presence: "SCORE_REPORTED";
        evidenceCompleteness: "COMPLETE" | "PARTIAL";
        score: number;
        model: ScoreModelMetadata;
      }
    | {
        presence: "SCORE_NOT_PROVIDED";
        evidenceCompleteness: "NOT_PROVIDED";
        model: { completeness: "UNKNOWN" };
      }
    | {
        presence: "UNKNOWN";
        evidenceCompleteness: "UNKNOWN" | "PARTIAL";
        model: { completeness: "UNKNOWN" };
      }
  );

export type ManualCreditScoreObservation = CreditScoreObservationBase & {
  sourceType: "MANUAL_ENTRY";
  evidenceRole: "SECONDARY_MANUAL_CONTEXT";
  presence: "SCORE_REPORTED";
  evidenceCompleteness: "MANUAL_UNVERIFIED";
  score: number;
  model: ScoreModelMetadata;
  enteredByActorId: string;
  enteredAt: string;
};

export type CreditScoreObservation =
  | ReportDerivedCreditScoreObservation
  | ManualCreditScoreObservation;

// CreditScoreObservation is an in-memory decision view. Its durable Prisma row
// stores the numeric score only inside an authenticated ciphertext envelope.

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, Extract<keyof T, K>>
  : never;

export type CreditScoreObservationInput =
  | (DistributiveOmit<
      ReportDerivedCreditScoreObservation,
      "evidenceRole" | "observationSeriesKey"
    > & {
      evidenceRole?: "PRIMARY_REPORT_EVIDENCE";
    })
  | (DistributiveOmit<
      ManualCreditScoreObservation,
      "evidenceRole" | "observationSeriesKey"
    > & {
      evidenceRole?: "SECONDARY_MANUAL_CONTEXT";
    });

export interface EncryptedScoreEnvelope {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
  keyVersion: string;
  algorithm: "AES_256_GCM";
  envelopeVersion: string;
  aadVersion: string;
}

export interface CreditScoreInsertMetadata {
  integritySha256: string;
  encryptedScore?: EncryptedScoreEnvelope;
  normalizationRuleKey?: string;
  normalizationRuleVersion?: string;
  parserConfidence?: number;
  errorCodes?: readonly string[];
}

export interface CreditScoreInsertCandidate extends ProgressScope {
  reportVersionId: string | null;
  extractionRunId: string | null;
  bureau: Bureau;
  coverageStatus: BureauCoverageStatus | null;
  bureauCoverageId: string | null;
  sourceType: "REPORT_DERIVED" | "MANUAL_ENTRY";
  evidenceRole: "PRIMARY_REPORT_EVIDENCE" | "SECONDARY_MANUAL_CONTEXT";
  presence: "SCORE_REPORTED" | "SCORE_NOT_PROVIDED" | "UNKNOWN";
  evidenceCompleteness:
    | "COMPLETE"
    | "PARTIAL"
    | "NOT_PROVIDED"
    | "UNKNOWN"
    | "MANUAL_UNVERIFIED";
  observationSeriesKey: string;
  revision: number;
  occurrence: number;
  idempotencyKey: string;
  integritySha256: string;
  scoreCiphertext: Uint8Array | null;
  scoreIv: Uint8Array | null;
  scoreAuthTag: Uint8Array | null;
  scoreKeyVersion: string | null;
  scoreAlgorithm: "AES_256_GCM" | null;
  scoreEnvelopeVersion: string | null;
  scoreAadVersion: string | null;
  scoreModelKey: string | null;
  scoreModelVersion: string | null;
  scoreScaleMin: number | null;
  scoreScaleMax: number | null;
  modelMetadataCompleteness: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  sourceMethodKey: string;
  sourceMethodVersion: string;
  sourceLocatorToken: string | null;
  pageNumber: number | null;
  sectionOrdinal: number | null;
  normalizationRuleKey: string | null;
  normalizationRuleVersion: string | null;
  parserConfidence: number | null;
  errorCodes: readonly string[];
  enteredByActorId: string | null;
  enteredAt: string | null;
  supersedesObservationId: string | null;
  observedAt: string;
}

export type ComparableValue =
  | null
  | boolean
  | number
  | string
  | readonly ComparableValue[]
  | { readonly [key: string]: ComparableValue };

interface ObservationEvidenceBase extends ProgressScope {
  checkpoint: ReportCheckpoint;
  bureau: Bureau;
  coverageStatus: BureauCoverageStatus;
  completeness: SourceCompleteness;
}

export interface AccountPresenceEvidence extends ObservationEvidenceBase {
  sourceObservationId: string;
  accountId: string;
  presence: ObservationPresence;
}

export interface FieldObservationEvidence extends ObservationEvidenceBase {
  sourceObservationId: string;
  accountId: string;
  fieldKey: string;
  normalizationRuleKey: string;
  normalizationRuleVersion: string;
  presence: ObservationPresence;
  /** Ephemeral decrypted/normalized value; never copied to a difference candidate. */
  comparableValue?: ComparableValue;
}

export interface BureauCoverageEvidence extends ProgressScope {
  checkpoint: ReportCheckpoint;
  bureau: Bureau;
  sourceObservationId: string;
  coverageStatus: BureauCoverageStatus;
}

export interface IdentityFactEvidence extends ProgressScope {
  checkpoint: ReportCheckpoint;
  bureau: Bureau | null;
  sourceObservationId: string;
  identityBaselineId: string;
  factSeriesKey: string;
  completeness: SourceCompleteness;
  presence: ObservationPresence;
  /** Ephemeral decrypted/normalized value; never copied to a difference candidate. */
  comparableValue?: ComparableValue;
}

export type DifferenceSourceKind =
  | "ACCOUNT_PRESENCE_OBSERVATION"
  | "FIELD_OBSERVATION"
  | "CREDIT_SCORE_OBSERVATION"
  | "BUREAU_COVERAGE_OBSERVATION"
  | "IDENTITY_FACT";

export interface ReportDifferenceDecision extends ProgressScope {
  /** OMIT is an evaluated no-row result and must never be sent to persistence. */
  persistenceDisposition: "PERSIST" | "OMIT";
  comparisonId: string;
  priorReportVersionId: string;
  priorExtractionRunId: string;
  currentReportVersionId: string;
  currentExtractionRunId: string;
  scopeType: ReportDifferenceScope;
  changeKind: ReportDifferenceChangeKind;
  comparability: DifferenceComparability;
  differenceState: ReportDifferenceState;
  deletionState: DeletionInferenceState;
  priorCompleteness: ComparisonEvidenceCompleteness;
  currentCompleteness: ComparisonEvidenceCompleteness;
  bureau: Bureau | null;
  accountId: string | null;
  fieldKey: string | null;
  scoreOccurrence: number | null;
  priorScoreSourceMethodKey: string | null;
  priorScoreSourceMethodVersion: string | null;
  currentScoreSourceMethodKey: string | null;
  currentScoreSourceMethodVersion: string | null;
  sourceKind: DifferenceSourceKind;
  priorSourceId: string;
  currentSourceId: string;
  priorIdentityBaselineId: string | null;
  currentIdentityBaselineId: string | null;
  identityFactSeriesKey: string | null;
  reasonCodes: readonly string[];
}

export interface ScoreComparisonDecision extends ProgressScope {
  comparisonId: string;
  bureau: Bureau;
  occurrence: number;
  priorObservationId: string;
  currentObservationId: string;
  sourceMethodKey: string | null;
  sourceMethodVersion: string | null;
  modelKey: string | null;
  modelVersion: string | null;
  scaleMin: number | null;
  scaleMax: number | null;
  /** Null when a secondary/manual row cannot legally back a durable difference. */
  difference: ReportDifferenceDecision | null;
  directlyComparable: boolean;
  priorScore: number | null;
  currentScore: number | null;
  delta: number | null;
  reasonCodes: readonly string[];
}

interface ApprovedCorrespondenceTarget extends ProgressScope {
  caseId: string;
  priorReportVersionId: string;
  correspondenceId: string;
  correspondenceItemId: string;
  correspondenceVersionId: string;
  correspondenceVersionMembershipId: string;
  consumerAssertionId: string;
  priorObservationId: string;
  bureau: Bureau;
  accountId: string;
  fieldKey: string;
}

export interface ConsumerAssertionBindingSnapshot extends ProgressScope {
  id: string;
  reportVersionId: string;
  accountId: string;
  bureau: Bureau;
  fieldKey: string;
  observationId: string;
  disposition:
    | "CONFIRMED_ACCURATE"
    | "CONFIRMED_INACCURATE"
    | "NOT_MINE"
    | "OUTDATED_UPDATE_REQUESTED"
    | "REVIEW_NEEDED"
    | "REVOKED";
  confirmedByActorId: string;
  confirmedAt: string;
}

export interface CorrespondenceItemBindingSnapshot extends ProgressScope {
  id: string;
  reportVersionId: string;
  caseId: string;
  correspondenceId: string;
  accountId: string;
  bureau: Bureau;
  fieldKey: string;
  observationId: string;
  consumerAssertionId: string;
}

export interface CorrespondenceVersionBindingSnapshot extends ProgressScope {
  id: string;
  reportVersionId: string;
  caseId: string;
  correspondenceId: string;
  status: "DRAFT" | "READY_FOR_REVIEW" | "APPROVED" | "VOID";
}

export interface CorrespondenceVersionItemBindingSnapshot extends ProgressScope {
  id: string;
  reportVersionId: string;
  caseId: string;
  correspondenceId: string;
  correspondenceVersionId: string;
  correspondenceItemId: string;
}

const VERIFIED_APPROVED_TARGET = Symbol("verified-approved-correspondence-target");
const verifiedApprovedTargets = new WeakSet<object>();

export interface VerifiedApprovedCorrespondenceTarget {
  readonly target: ApprovedCorrespondenceTarget;
  readonly [VERIFIED_APPROVED_TARGET]: true;
}

interface DisputeOutcomeCandidateBase extends ProgressScope {
  caseId: string;
  comparisonId: string;
  differenceId: string;
  priorReportVersionId: string;
  priorExtractionRunId: string;
  currentReportVersionId: string;
  currentExtractionRunId: string;
  bureau: Bureau;
  accountId: string;
  targetFieldKey: string;
  targetConsumerAssertionId: string;
  targetCorrespondenceId: string;
  targetCorrespondenceItemId: string;
  targetCorrespondenceVersionId: string;
  targetVersionMembershipId: string;
  priorCompleteness: ComparisonEvidenceCompleteness;
  currentCompleteness: ComparisonEvidenceCompleteness;
  causalityState: OutcomeCausalityState;
  outcomeSeriesKey: string;
  version: number;
  idempotencyKey: string;
  decisionModelKey: string;
  decisionModelVersion: string;
  sourceSetSha256: string;
  integritySha256: string;
  supersedesOutcomeId: string | null;
  reasonCodes: readonly string[];
}

export type DisputeOutcomeCandidate = DisputeOutcomeCandidateBase &
  (
    | {
        outcomeState: "PENDING_EVIDENCE";
        decisionSource: null;
        decidedByActorId: null;
        decidedAt: null;
      }
    | {
        outcomeState: "CORRECTED" | "NEW_CONFLICT";
        decisionSource: "HUMAN_CONFIRMED";
        decidedByActorId: string;
        decidedAt: string;
      }
    | {
        outcomeState:
          | "UNCHANGED"
          | "CHANGED_DIFFERENTLY"
          | "NO_LONGER_REPORTED"
          | "UNABLE_TO_DETERMINE";
        decisionSource: "SYSTEM_DERIVED";
        decidedByActorId: null;
        decidedAt: string;
      }
  );

export interface DetermineDisputeOutcomeInput {
  difference: VerifiedReportDifferenceBinding;
  target: VerifiedApprovedCorrespondenceTarget;
  outcomeSeriesKey: string;
  version: number;
  idempotencyKey: string;
  supersedesOutcomeId?: string;
  decidedAt: string;
  decisionModelKey: string;
  decisionModelVersion: string;
  sourceSetSha256: string;
  integritySha256: string;
  humanConfirmation?: VerifiedHumanOutcomeConfirmation;
}

export interface HumanOutcomeConfirmationSnapshot extends ProgressScope {
  id: string;
  comparisonId: string;
  differenceId: string;
  correspondenceItemId: string;
  currentSourceObservationId: string;
  confirmedState: "CORRECTED" | "NEW_CONFLICT";
  confirmedByActorId: string;
  confirmedAt: string;
}

const VERIFIED_HUMAN_OUTCOME_CONFIRMATION = Symbol(
  "verified-human-outcome-confirmation"
);
const verifiedHumanOutcomeConfirmations = new WeakSet<object>();

export interface VerifiedHumanOutcomeConfirmation {
  readonly confirmation: HumanOutcomeConfirmationSnapshot;
  readonly [VERIFIED_HUMAN_OUTCOME_CONFIRMATION]: true;
}

export interface ReportDifferenceInsertMetadata {
  differenceSeriesKey: string;
  version: number;
  idempotencyKey: string;
  comparisonRuleKey: string;
  comparisonRuleVersion: string;
  sourceSetSha256: string;
  integritySha256: string;
  supersedesDifferenceId?: string;
  createdByActorId: string;
}

export interface ReportDifferenceInsertCandidate extends ProgressScope {
  priorReportVersionId: string;
  priorExtractionRunId: string;
  currentReportVersionId: string;
  currentExtractionRunId: string;
  comparisonId: string;
  scopeType: ReportDifferenceScope;
  bureau: Bureau | null;
  accountId: string | null;
  fieldKey: string | null;
  scoreOccurrence: number | null;
  priorScoreSourceMethodKey: string | null;
  priorScoreSourceMethodVersion: string | null;
  currentScoreSourceMethodKey: string | null;
  currentScoreSourceMethodVersion: string | null;
  priorPresenceObservationId: string | null;
  currentPresenceObservationId: string | null;
  priorFieldObservationId: string | null;
  currentFieldObservationId: string | null;
  priorScoreObservationId: string | null;
  currentScoreObservationId: string | null;
  priorCoverageObservationId: string | null;
  currentCoverageObservationId: string | null;
  identityFactSeriesKey: string | null;
  priorIdentityBaselineId: string | null;
  priorIdentityFactId: string | null;
  currentIdentityBaselineId: string | null;
  currentIdentityFactId: string | null;
  priorCompleteness: ComparisonEvidenceCompleteness;
  currentCompleteness: ComparisonEvidenceCompleteness;
  comparability: DifferenceComparability;
  differenceState: ReportDifferenceState;
  changeKind: ReportDifferenceChangeKind;
  deletionState: DeletionInferenceState;
  differenceSeriesKey: string;
  version: number;
  idempotencyKey: string;
  comparisonRuleKey: string;
  comparisonRuleVersion: string;
  sourceSetSha256: string;
  integritySha256: string;
  reasonCodes: readonly string[];
  supersedesDifferenceId: string | null;
  createdByActorId: string;
}

export interface PersistedReportDifferenceSnapshot {
  id: string;
  candidate: ReportDifferenceInsertCandidate;
}

const VERIFIED_REPORT_DIFFERENCE = Symbol("verified-report-difference");
const verifiedReportDifferences = new WeakSet<object>();

export interface VerifiedReportDifferenceBinding {
  readonly id: string;
  readonly decision: ReportDifferenceDecision;
  readonly candidate: ReportDifferenceInsertCandidate;
  readonly [VERIFIED_REPORT_DIFFERENCE]: true;
}

export interface BureauProgressProjection {
  bureau: Bureau;
  directlyComparableScores: readonly {
    occurrence: number;
    priorObservationId: string;
    currentObservationId: string;
    prior: number;
    current: number;
    delta: number;
    modelKey: string;
    modelVersion: string;
  }[];
  changeCounts: Partial<Record<ReportDifferenceChangeKind, number>>;
  outcomeCounts: Partial<Record<DisputeOutcomeState, number>>;
}

export interface ProgressProjection extends ProgressScope {
  comparisonId: string;
  priorReportVersionId: string;
  priorExtractionRunId: string;
  currentReportVersionId: string;
  currentExtractionRunId: string;
  bureaus: readonly BureauProgressProjection[];
  causalityState: "NO_CAUSAL_CLAIM";
  causalityNotice: typeof NO_CAUSAL_ATTRIBUTION_NOTICE;
}

const verifiedReportComparisonContexts = new WeakMap<object, string>();
const verifiedCreditScoreObservations = new WeakMap<object, string>();
const verifiedDifferenceDecisions = new WeakMap<object, string>();
const differenceSourceSetDigests = new WeakMap<object, string>();

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
const SHA_256 = /^[a-f0-9]{64}$/i;
const MACHINE_CODE = /^[A-Z][A-Z0-9_]{0,127}$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function validCalendarParts(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

/** Strict day-precision ISO date. Partial source dates must remain non-exact. */
export function isStrictIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  return Boolean(
    match &&
      validCalendarParts(Number(match[1]), Number(match[2]), Number(match[3]))
  );
}

/**
 * Strict ISO-8601 instant with an explicit timezone. The original string is
 * validated, never normalized, so invalid calendar values and extra precision
 * cannot be silently changed by `Date.parse` or a database millisecond column.
 */
export function isStrictIsoInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_INSTANT.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    !validCalendarParts(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }
  const zone = match[8]!;
  if (zone === "Z") return true;
  if (zone === "-00:00") return false;
  const offsetHour = Number(zone.slice(1, 3));
  const offsetMinute = Number(zone.slice(4, 6));
  return (
    offsetHour <= 14 &&
    offsetMinute <= 59 &&
    (offsetHour < 14 || offsetMinute === 0)
  );
}

function canonicalSemanticValue(
  value: unknown,
  ancestors: ReadonlySet<object> = new Set<object>()
): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("semantic attestation numbers must be finite");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new Error("semantic attestation accepts JSON-domain values only");
  }
  if (ancestors.has(value)) {
    throw new Error("semantic attestation snapshots cannot be cyclic");
  }
  const nestedAncestors = new Set(ancestors);
  nestedAncestors.add(value);
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => canonicalSemanticValue(item, nestedAncestors))
      .join(",")}]`;
  }
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    throw new Error("semantic attestation snapshots must use plain objects");
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalSemanticValue(record[key], nestedAncestors)}`
    )
    .join(",")}}`;
}

function immutableSemanticSnapshot<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => immutableSemanticSnapshot(item))) as T;
  }
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    throw new Error("semantic attestation snapshots must use plain objects");
  }
  const clone: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    clone[key] = immutableSemanticSnapshot(nested);
  }
  return Object.freeze(clone) as T;
}

export function computeProgressSemanticSha256(value: unknown): string {
  return createHash("sha256")
    .update(canonicalSemanticValue(value), "utf8")
    .digest("hex");
}

function valueFreeSourceIdentity(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(valueFreeSourceIdentity);
  const record = value as Readonly<Record<string, unknown>>;
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key !== "comparableValue" && key !== "score")
      .map(([key, nested]) => [key, valueFreeSourceIdentity(nested)])
  );
}

export function computeProgressSourceSetSha256(
  kind: ProgressRepositoryReadKind,
  snapshot: unknown
): string {
  return computeProgressSemanticSha256({
    kind,
    sourceIdentity: valueFreeSourceIdentity(snapshot),
  });
}

export function verifyTrustedProgressRepositoryRead<T>(
  input: {
    kind: ProgressRepositoryReadKind;
    repositoryReadId: string;
    snapshot: T;
  },
  verifier: TrustedProgressRepositoryVerifier
): VerifiedProgressRepositoryRead<T> {
  requireNonEmpty(input.repositoryReadId, "repository read id");
  if (!PROGRESS_REPOSITORY_READ_KINDS.includes(input.kind)) {
    throw new Error("repository read kind is not recognized");
  }
  if (
    verifier.writerId !== TRUSTED_PROGRESS_WRITER_ID ||
    verifier.semanticsVersion !== TRUSTED_PROGRESS_WRITER_SEMANTICS_VERSION
  ) {
    throw new Error("repository writer semantic attestation is stale or unauthorized");
  }
  const snapshot = immutableSemanticSnapshot(input.snapshot);
  const semanticSha256 = computeProgressSemanticSha256(snapshot);
  const sourceSetSha256 = computeProgressSourceSetSha256(input.kind, snapshot);
  const verification = Object.freeze({
    kind: input.kind,
    repositoryReadId: input.repositoryReadId,
    semanticSha256,
    sourceSetSha256,
    snapshot,
  });
  if (!verifier.verifyRepositoryRead(verification)) {
    throw new Error("repository read semantic attestation was not established");
  }
  const verified = {
    ...verification,
  } as VerifiedProgressRepositoryRead<T>;
  Object.defineProperty(verified, VERIFIED_PROGRESS_REPOSITORY_READ, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedProgressRepositoryReads.set(verified, semanticSha256);
  return Object.freeze(verified);
}

function requireExactTrustedRepositoryRead<T>(
  read: VerifiedProgressRepositoryRead<T> | undefined,
  kind: ProgressRepositoryReadKind,
  expectedSnapshot: T
): string {
  if (
    !read ||
    read[VERIFIED_PROGRESS_REPOSITORY_READ] !== true ||
    !verifiedProgressRepositoryReads.has(read) ||
    !Object.isFrozen(read) ||
    !Object.isFrozen(read.snapshot) ||
    read.kind !== kind
  ) {
    throw new Error("operation requires a verified repository semantic read");
  }
  const currentSha256 = computeProgressSemanticSha256(read.snapshot);
  const currentSourceSetSha256 = computeProgressSourceSetSha256(
    read.kind,
    read.snapshot
  );
  if (
    currentSha256 !== read.semanticSha256 ||
    currentSourceSetSha256 !== read.sourceSetSha256 ||
    verifiedProgressRepositoryReads.get(read) !== currentSha256 ||
    currentSha256 !== computeProgressSemanticSha256(expectedSnapshot)
  ) {
    throw new Error("repository semantic read does not match the exact writer input");
  }
  return currentSourceSetSha256;
}

function sealReportComparisonContext(
  context: ReportComparisonContext
): ReportComparisonContext {
  const sealed = immutableSemanticSnapshot(context);
  verifiedReportComparisonContexts.set(
    sealed,
    computeProgressSemanticSha256(sealed)
  );
  return sealed;
}

function requireVerifiedReportComparisonContext(
  context: ReportComparisonContext
): void {
  const expectedSha256 = verifiedReportComparisonContexts.get(context);
  if (
    !expectedSha256 ||
    !Object.isFrozen(context) ||
    expectedSha256 !== computeProgressSemanticSha256(context)
  ) {
    throw new Error("comparison requires a verified immutable context factory result");
  }
}

function sealCreditScoreObservation<T extends CreditScoreObservation>(
  observation: T
): T {
  const sealed = immutableSemanticSnapshot(observation);
  verifiedCreditScoreObservations.set(
    sealed,
    computeProgressSemanticSha256(sealed)
  );
  return sealed;
}

function requireVerifiedCreditScoreObservation(
  observation: CreditScoreObservation
): void {
  const expectedSha256 = verifiedCreditScoreObservations.get(observation);
  if (
    !expectedSha256 ||
    !Object.isFrozen(observation) ||
    expectedSha256 !== computeProgressSemanticSha256(observation)
  ) {
    throw new Error("score writer requires a verified immutable observation factory result");
  }
}

function sealDifferenceDecision(
  decision: ReportDifferenceDecision,
  sourceSetSha256: string
): ReportDifferenceDecision {
  if (!SHA_256.test(sourceSetSha256)) {
    throw new Error("difference source set attestation must be a SHA-256 digest");
  }
  const sealed = immutableSemanticSnapshot(decision);
  verifiedDifferenceDecisions.set(sealed, computeProgressSemanticSha256(sealed));
  differenceSourceSetDigests.set(sealed, sourceSetSha256);
  return sealed;
}

function requireVerifiedDifferenceDecision(
  decision: ReportDifferenceDecision
): string {
  const expectedDecisionSha256 = verifiedDifferenceDecisions.get(decision);
  const sourceSetSha256 = differenceSourceSetDigests.get(decision);
  if (
    !expectedDecisionSha256 ||
    !sourceSetSha256 ||
    !Object.isFrozen(decision) ||
    expectedDecisionSha256 !== computeProgressSemanticSha256(decision)
  ) {
    throw new Error("difference writer requires a verified semantic comparison decision");
  }
  return sourceSetSha256;
}

export function deriveVerifiedDifferenceSourceSetSha256(
  decision: ReportDifferenceDecision
): string {
  return requireVerifiedDifferenceDecision(decision);
}

function requireNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function requireStrictIsoInstant(value: unknown, field: string): asserts value is string {
  if (!isStrictIsoInstant(value)) {
    throw new Error(`${field} must be a strict ISO instant with an explicit timezone`);
  }
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
}

function validateMachineCodes(
  values: readonly string[],
  field: string
): void {
  if (values.some((value) => !MACHINE_CODE.test(value))) {
    throw new Error(`${field} must contain bounded machine codes only`);
  }
}

function validateAppendOnlyVersion(
  version: number,
  supersedesId: string | null | undefined,
  label: string
): void {
  requirePositiveInteger(version, `${label} version`);
  if (version === 1 && supersedesId) {
    throw new Error(`the first ${label} version cannot supersede another row`);
  }
  if (version > 1 && !supersedesId) {
    throw new Error(`later ${label} versions require an exact superseded row id`);
  }
}

function requireScope(expected: ProgressScope, actual: ProgressScope, label: string): void {
  if (
    expected.tenantId !== actual.tenantId ||
    expected.consumerId !== actual.consumerId
  ) {
    throw new Error(`${label} must remain in one tenant/consumer scope`);
  }
}

function validateReportDateEvidence(evidence: ReportDateEvidence): void {
  if (evidence.provenance === "SOURCE_REPORTED") {
    if (!isStrictIsoCalendarDate(evidence.reportDate)) {
      throw new Error("SOURCE_REPORTED requires an explicit ISO report date");
    }
    requireNonEmpty(evidence.sourceLocatorToken, "report date source locator");
    requireNonEmpty(evidence.ruleKey, "report date rule key");
    requireNonEmpty(evidence.ruleVersion, "report date rule version");
    return;
  }

  if (evidence.provenance === "EXPLICIT_NOT_PROVIDED") {
    requireNonEmpty(evidence.sourceLocatorToken, "report-date absence source locator");
    requireNonEmpty(evidence.ruleKey, "report date rule key");
    requireNonEmpty(evidence.ruleVersion, "report date rule version");
    return;
  }

  validateMachineCodes([evidence.reasonCode], "unknown report-date reason code");
}

export function validateReportCheckpoint(checkpoint: ReportCheckpoint): void {
  requireNonEmpty(checkpoint.tenantId, "tenantId");
  requireNonEmpty(checkpoint.consumerId, "consumerId");
  requireNonEmpty(checkpoint.reportVersionId, "reportVersionId");
  requireNonEmpty(checkpoint.extractionRunId, "extractionRunId");
  requireNonEmpty(checkpoint.reportSeriesKey, "reportSeriesKey");
  requirePositiveInteger(checkpoint.reportVersion, "reportVersion");
  if (!SHA_256.test(checkpoint.reportInputSha256)) {
    throw new Error("reportInputSha256 must be a SHA-256 hex digest");
  }
  validateReportDateEvidence(checkpoint.reportDateEvidence);
}

export function createReportComparisonContext(input: {
  comparisonId: string;
  comparisonSeriesKey: string;
  version: number;
  idempotencyKey: string;
  supersedesComparisonId?: string;
  prior: ReportCheckpoint;
  current: ReportCheckpoint;
  comparisonModelKey: string;
  comparisonModelVersion: string;
}): ReportComparisonContext {
  validateReportCheckpoint(input.prior);
  validateReportCheckpoint(input.current);
  requireScope(input.prior, input.current, "report comparison");
  requireNonEmpty(input.comparisonId, "comparisonId");
  requireNonEmpty(input.comparisonSeriesKey, "comparisonSeriesKey");
  requireNonEmpty(input.idempotencyKey, "comparison idempotencyKey");
  validateAppendOnlyVersion(
    input.version,
    input.supersedesComparisonId,
    "comparison"
  );
  requireNonEmpty(input.comparisonModelKey, "comparisonModelKey");
  requireNonEmpty(input.comparisonModelVersion, "comparisonModelVersion");

  const sameReport =
    input.prior.reportVersionId === input.current.reportVersionId;
  if (sameReport) {
    const exactRetry =
      input.prior.extractionRunId === input.current.extractionRunId;
    return sealReportComparisonContext({
      tenantId: input.prior.tenantId,
      consumerId: input.prior.consumerId,
      comparisonId: input.comparisonId,
      comparisonSeriesKey: input.comparisonSeriesKey,
      version: input.version,
      idempotencyKey: input.idempotencyKey,
      supersedesComparisonId: input.supersedesComparisonId ?? null,
      prior: { ...input.prior },
      current: { ...input.current },
      purpose: "EXTRACTION_RECONCILIATION",
      chronologyBasis: "NOT_ESTABLISHED",
      state: exactRetry ? "NOT_COMPARABLE" : "COMPARABLE",
      evidenceCompleteness: exactRetry ? "INCOMPLETE" : "COMPLETE",
      sourcePolicy: "REPORT_DERIVED_ONLY",
      comparisonModelKey: input.comparisonModelKey,
      comparisonModelVersion: input.comparisonModelVersion,
      reasonCodes: exactRetry
        ? ["IDENTICAL_REPORT_AND_EXTRACTION_RUN"]
        : ["SAME_REPORT_REANALYSIS_IS_NOT_TEMPORAL_PROGRESS"],
    });
  }

  const orderedSameSeries =
    input.prior.reportSeriesKey === input.current.reportSeriesKey &&
    input.prior.reportVersion < input.current.reportVersion &&
    input.prior.reportInputSha256 !== input.current.reportInputSha256;

  return sealReportComparisonContext({
    tenantId: input.prior.tenantId,
    consumerId: input.prior.consumerId,
    comparisonId: input.comparisonId,
    comparisonSeriesKey: input.comparisonSeriesKey,
    version: input.version,
    idempotencyKey: input.idempotencyKey,
    supersedesComparisonId: input.supersedesComparisonId ?? null,
    prior: { ...input.prior },
    current: { ...input.current },
    purpose: "TEMPORAL_REPORT_CHANGE",
    chronologyBasis: orderedSameSeries
      ? "SAME_SERIES_VERSION_ORDER"
      : "NOT_ESTABLISHED",
    state: orderedSameSeries ? "COMPARABLE" : "NOT_COMPARABLE",
    evidenceCompleteness: orderedSameSeries ? "COMPLETE" : "UNKNOWN",
    sourcePolicy: "REPORT_DERIVED_ONLY",
    comparisonModelKey: input.comparisonModelKey,
    comparisonModelVersion: input.comparisonModelVersion,
    reasonCodes: orderedSameSeries
      ? []
      : ["REPORT_CHRONOLOGY_NOT_ESTABLISHED"],
  });
}

function validateScore(score: number, model: ScoreModelMetadata): void {
  if (!Number.isInteger(score)) throw new Error("score must be an integer");
  if (model.completeness === "COMPLETE") {
    requireNonEmpty(model.modelKey, "score model key");
    requireNonEmpty(model.modelVersion, "score model version");
    if (
      !Number.isInteger(model.scaleMin) ||
      !Number.isInteger(model.scaleMax) ||
      model.scaleMin >= model.scaleMax ||
      score < model.scaleMin ||
      score > model.scaleMax
    ) {
      throw new Error("score must be inside its complete model scale");
    }
  }
}

export function deriveCreditScoreObservationSeriesKey(
  input: CreditScoreObservationInput
): string {
  if (input.sourceType === "MANUAL_ENTRY") {
    // A manual timeline point is always a new secondary observation. A later
    // correction is another point rather than a rewrite/supersession.
    return ["MANUAL_ENTRY", input.observationId].join("|");
  }
  return [
    "REPORT_DERIVED",
    input.checkpoint.reportVersionId,
    input.checkpoint.extractionRunId,
    input.bureau,
    input.sourceMethodKey,
    input.sourceMethodVersion,
    String(input.occurrence),
  ].join("|");
}

function validateScoreSupersession(
  input: CreditScoreObservationInput,
  priorRevision: CreditScoreObservation | undefined,
  derivedSeriesKey: string
): void {
  validateAppendOnlyVersion(
    input.revision,
    input.supersedesObservationId,
    "score observation"
  );
  if (input.sourceType === "MANUAL_ENTRY") {
    if (input.revision !== 1 || input.supersedesObservationId || priorRevision) {
      throw new Error("manual score points append as new revision-1 secondary observations");
    }
    return;
  }
  if (input.revision === 1) {
    if (priorRevision) {
      throw new Error("score revision 1 cannot receive a prior revision binding");
    }
    return;
  }
  if (!priorRevision) {
    throw new Error("score supersession requires the exact prior revision binding");
  }
  requireScope(input, priorRevision, "score supersession");
  if (
    priorRevision.sourceType !== "REPORT_DERIVED" ||
    priorRevision.observationId !== input.supersedesObservationId ||
    priorRevision.observationSeriesKey !== derivedSeriesKey ||
    priorRevision.revision !== input.revision - 1 ||
    priorRevision.bureau !== input.bureau ||
    priorRevision.occurrence !== input.occurrence ||
    priorRevision.checkpoint.reportVersionId !== input.checkpoint.reportVersionId ||
    priorRevision.checkpoint.extractionRunId !== input.checkpoint.extractionRunId ||
    priorRevision.sourceMethodKey !== input.sourceMethodKey ||
    priorRevision.sourceMethodVersion !== input.sourceMethodVersion
  ) {
    throw new Error(
      "score supersession must bind the exact prior revision in the same report/run/source/bureau/occurrence slot"
    );
  }
}

export function createCreditScoreObservation(
  input: CreditScoreObservationInput,
  priorRevision?: CreditScoreObservation
): CreditScoreObservation {
  if (priorRevision) requireVerifiedCreditScoreObservation(priorRevision);
  requireNonEmpty(input.observationId, "observationId");
  requireNonEmpty(input.idempotencyKey, "score observation idempotencyKey");
  requireNonEmpty(input.tenantId, "tenantId");
  requireNonEmpty(input.consumerId, "consumerId");
  requireNonEmpty(input.sourceMethodKey, "sourceMethodKey");
  requireNonEmpty(input.sourceMethodVersion, "sourceMethodVersion");
  requireStrictIsoInstant(input.observedAt, "score observedAt");
  if (!Number.isInteger(input.occurrence) || input.occurrence < 0) {
    throw new Error("occurrence must be a non-negative integer");
  }
  const observationSeriesKey = deriveCreditScoreObservationSeriesKey(input);
  validateScoreSupersession(input, priorRevision, observationSeriesKey);

  const common = {
    tenantId: input.tenantId,
    consumerId: input.consumerId,
    observationId: input.observationId,
    observationSeriesKey,
    revision: input.revision,
    idempotencyKey: input.idempotencyKey,
    supersedesObservationId: input.supersedesObservationId,
    bureau: input.bureau,
    occurrence: input.occurrence,
    sourceMethodKey: input.sourceMethodKey,
    sourceMethodVersion: input.sourceMethodVersion,
    observedAt: input.observedAt,
  } as const;

  if (input.sourceType === "MANUAL_ENTRY") {
    const raw = input as unknown as Record<string, unknown>;
    if (
      "checkpoint" in raw ||
      "bureauCoverageId" in raw ||
      "coverageStatus" in raw ||
      "sourceLocatorToken" in raw
    ) {
      throw new Error("manual score evidence cannot masquerade as report-derived evidence");
    }
    if (
      input.presence !== "SCORE_REPORTED" ||
      input.evidenceCompleteness !== "MANUAL_UNVERIFIED"
    ) {
      throw new Error("manual score evidence must remain reported and unverified");
    }
    validateScore(input.score, input.model);
    requireNonEmpty(input.enteredByActorId, "enteredByActorId");
    requireStrictIsoInstant(input.enteredAt, "manual score enteredAt");
    return sealCreditScoreObservation({
      ...common,
      sourceType: "MANUAL_ENTRY",
      evidenceRole: "SECONDARY_MANUAL_CONTEXT",
      presence: "SCORE_REPORTED",
      evidenceCompleteness: "MANUAL_UNVERIFIED",
      score: input.score,
      model: { ...input.model },
      enteredByActorId: input.enteredByActorId,
      enteredAt: input.enteredAt,
    });
  }

  validateReportCheckpoint(input.checkpoint);
  requireScope(input, input.checkpoint, "report-derived score");
  requireNonEmpty(input.bureauCoverageId, "bureauCoverageId");
  if (input.coverageStatus !== "COVERED") {
    if (
      input.presence !== "UNKNOWN" ||
      input.evidenceCompleteness !== "UNKNOWN" ||
      input.sourceLocatorToken !== undefined
    ) {
      throw new Error(
        "out-of-coverage score evidence must remain UNKNOWN without a source locator"
      );
    }
  } else if (
    input.presence !== "UNKNOWN" &&
    (!input.sourceLocatorToken || input.sourceLocatorToken.trim().length === 0)
  ) {
    throw new Error("covered reported/not-provided score evidence requires a source locator");
  }

  if (input.presence === "SCORE_REPORTED") {
    validateScore(input.score, input.model);
    return sealCreditScoreObservation({
      ...common,
      sourceType: "REPORT_DERIVED",
      evidenceRole: "PRIMARY_REPORT_EVIDENCE",
      checkpoint: { ...input.checkpoint },
      bureauCoverageId: input.bureauCoverageId,
      coverageStatus: input.coverageStatus,
      ...(input.sourceLocatorToken
        ? { sourceLocatorToken: input.sourceLocatorToken }
        : {}),
      presence: "SCORE_REPORTED",
      evidenceCompleteness: input.evidenceCompleteness,
      score: input.score,
      model: { ...input.model },
    });
  }

  if ("score" in input && input.score !== undefined) {
    throw new Error(`${input.presence} cannot carry an invented score`);
  }
  if (input.model.completeness !== "UNKNOWN") {
    throw new Error(`${input.presence} cannot claim established score-model metadata`);
  }
  if (
    input.presence === "SCORE_NOT_PROVIDED" &&
    input.evidenceCompleteness !== "NOT_PROVIDED"
  ) {
    throw new Error("SCORE_NOT_PROVIDED requires NOT_PROVIDED completeness");
  }

  const absentBase = {
    ...common,
    sourceType: "REPORT_DERIVED",
    evidenceRole: "PRIMARY_REPORT_EVIDENCE",
    checkpoint: { ...input.checkpoint },
    bureauCoverageId: input.bureauCoverageId,
    coverageStatus: input.coverageStatus,
    ...(input.sourceLocatorToken
      ? { sourceLocatorToken: input.sourceLocatorToken }
      : {}),
    model: { completeness: "UNKNOWN" },
  } as const;
  if (input.presence === "SCORE_NOT_PROVIDED") {
    return sealCreditScoreObservation({
      ...absentBase,
      presence: "SCORE_NOT_PROVIDED",
      evidenceCompleteness: "NOT_PROVIDED",
    });
  }
  return sealCreditScoreObservation({
    ...absentBase,
    presence: "UNKNOWN",
    evidenceCompleteness: input.evidenceCompleteness,
  });
}

export function toCreditScoreInsertCandidate(
  observation: CreditScoreObservation,
  metadata: CreditScoreInsertMetadata
): CreditScoreInsertCandidate {
  requireVerifiedCreditScoreObservation(observation);
  validateMachineCodes(metadata.errorCodes ?? [], "score errorCodes");
  if (!SHA_256.test(metadata.integritySha256)) {
    throw new Error("score integritySha256 must be a SHA-256 hex digest");
  }
  if (
    metadata.parserConfidence !== undefined &&
    (!Number.isFinite(metadata.parserConfidence) ||
      metadata.parserConfidence < 0 ||
      metadata.parserConfidence > 1)
  ) {
    throw new Error("score parser confidence must be between zero and one");
  }
  const reported = observation.presence === "SCORE_REPORTED";
  if (reported && !metadata.encryptedScore) {
    throw new Error("reported score persistence requires an encrypted score envelope");
  }
  if (!reported && metadata.encryptedScore) {
    throw new Error("score absence/unknown rows cannot carry a score ciphertext envelope");
  }
  const encrypted = metadata.encryptedScore;
  if (encrypted) {
    requireNonEmpty(encrypted.keyVersion, "score encryption keyVersion");
    requireNonEmpty(encrypted.envelopeVersion, "score encryption envelopeVersion");
    requireNonEmpty(encrypted.aadVersion, "score encryption aadVersion");
    if (
      encrypted.ciphertext.byteLength === 0 ||
      encrypted.iv.byteLength === 0 ||
      encrypted.authTag.byteLength === 0
    ) {
      throw new Error("score encryption envelope byte fields cannot be empty");
    }
    if (encrypted.algorithm !== "AES_256_GCM") {
      throw new Error("score encryption envelope must use AES_256_GCM");
    }
  }
  const model = observation.model;
  const reportDerived = observation.sourceType === "REPORT_DERIVED";
  if (model.completeness === "PARTIAL") {
    const populated = [
      model.modelKey,
      model.modelVersion,
      model.scaleMin,
      model.scaleMax,
    ].filter((value) => value !== undefined).length;
    if (populated < 1 || populated > 3) {
      throw new Error("partial score-model metadata requires one to three fields");
    }
    if (model.modelVersion !== undefined && !model.modelKey) {
      throw new Error("score model version requires a model key");
    }
    if ((model.scaleMin === undefined) !== (model.scaleMax === undefined)) {
      throw new Error("score model scale bounds must be provided together");
    }
    if (
      model.scaleMin !== undefined &&
      model.scaleMax !== undefined &&
      (!Number.isInteger(model.scaleMin) ||
        !Number.isInteger(model.scaleMax) ||
        model.scaleMin >= model.scaleMax)
    ) {
      throw new Error("score model scale bounds must be ordered integers");
    }
  }
  if (reportDerived) {
    requireNonEmpty(
      metadata.normalizationRuleKey ?? "",
      "report-derived score normalizationRuleKey"
    );
    requireNonEmpty(
      metadata.normalizationRuleVersion ?? "",
      "report-derived score normalizationRuleVersion"
    );
    if (
      observation.coverageStatus === "COVERED" &&
      observation.presence !== "UNKNOWN" &&
      !observation.sourceLocatorToken
    ) {
      throw new Error(
        "covered reported/not-provided score persistence requires a source locator"
      );
    }
  } else if (
    metadata.normalizationRuleKey !== undefined ||
    metadata.normalizationRuleVersion !== undefined ||
    metadata.parserConfidence !== undefined
  ) {
    throw new Error(
      "manual score persistence cannot carry parser normalization/confidence metadata"
    );
  }
  return {
    tenantId: observation.tenantId,
    consumerId: observation.consumerId,
    reportVersionId: reportDerived
      ? observation.checkpoint.reportVersionId
      : null,
    extractionRunId: reportDerived
      ? observation.checkpoint.extractionRunId
      : null,
    bureau: observation.bureau,
    coverageStatus: reportDerived ? observation.coverageStatus : null,
    bureauCoverageId: reportDerived ? observation.bureauCoverageId : null,
    sourceType: observation.sourceType,
    evidenceRole: observation.evidenceRole,
    presence: observation.presence,
    evidenceCompleteness: observation.evidenceCompleteness,
    observationSeriesKey: observation.observationSeriesKey,
    revision: observation.revision,
    occurrence: observation.occurrence,
    idempotencyKey: observation.idempotencyKey,
    integritySha256: metadata.integritySha256,
    scoreCiphertext: encrypted ? new Uint8Array(encrypted.ciphertext) : null,
    scoreIv: encrypted ? new Uint8Array(encrypted.iv) : null,
    scoreAuthTag: encrypted ? new Uint8Array(encrypted.authTag) : null,
    scoreKeyVersion: encrypted?.keyVersion ?? null,
    scoreAlgorithm: encrypted?.algorithm ?? null,
    scoreEnvelopeVersion: encrypted?.envelopeVersion ?? null,
    scoreAadVersion: encrypted?.aadVersion ?? null,
    scoreModelKey:
      model.completeness === "UNKNOWN" ? null : (model.modelKey ?? null),
    scoreModelVersion:
      model.completeness === "UNKNOWN" ? null : (model.modelVersion ?? null),
    scoreScaleMin:
      model.completeness === "UNKNOWN" ? null : (model.scaleMin ?? null),
    scoreScaleMax:
      model.completeness === "UNKNOWN" ? null : (model.scaleMax ?? null),
    modelMetadataCompleteness: model.completeness,
    sourceMethodKey: observation.sourceMethodKey,
    sourceMethodVersion: observation.sourceMethodVersion,
    sourceLocatorToken:
      reportDerived && observation.sourceLocatorToken
        ? observation.sourceLocatorToken
        : null,
    pageNumber: null,
    sectionOrdinal: null,
    normalizationRuleKey: metadata.normalizationRuleKey ?? null,
    normalizationRuleVersion: metadata.normalizationRuleVersion ?? null,
    parserConfidence: metadata.parserConfidence ?? null,
    errorCodes: [...(metadata.errorCodes ?? [])],
    enteredByActorId: reportDerived ? null : observation.enteredByActorId,
    enteredAt: reportDerived ? null : observation.enteredAt,
    supersedesObservationId: observation.supersedesObservationId,
    observedAt: observation.observedAt,
  };
}

function toComparisonCompleteness(
  completeness: SourceCompleteness
): ComparisonEvidenceCompleteness {
  if (completeness === "COMPLETE") return "COMPLETE";
  if (completeness === "PARTIAL") return "PARTIAL";
  if (completeness === "UNKNOWN") return "UNKNOWN";
  return "INCOMPLETE";
}

function validateEvidenceCheckpoint(
  context: ReportComparisonContext,
  evidence: { checkpoint: ReportCheckpoint } & ProgressScope,
  side: "prior" | "current"
): void {
  requireScope(context, evidence, `${side} evidence`);
  const expected = context[side];
  if (
    evidence.checkpoint.reportVersionId !== expected.reportVersionId ||
    evidence.checkpoint.extractionRunId !== expected.extractionRunId ||
    computeProgressSemanticSha256(evidence.checkpoint) !==
      computeProgressSemanticSha256(expected)
  ) {
    throw new Error(
      `${side} evidence must pin the comparison's exact immutable report/run checkpoint`
    );
  }
}

function comparisonCanDescribeProgress(context: ReportComparisonContext): boolean {
  return (
    context.purpose === "TEMPORAL_REPORT_CHANGE" &&
    context.chronologyBasis === "SAME_SERIES_VERSION_ORDER" &&
    context.state !== "NOT_COMPARABLE"
  );
}

function differenceBase(
  context: ReportComparisonContext,
  params: {
    scopeType: ReportDifferenceScope;
    changeKind: ReportDifferenceChangeKind;
    comparability: DifferenceComparability;
    differenceState: ReportDifferenceState;
    deletionState: DeletionInferenceState;
    priorCompleteness: ComparisonEvidenceCompleteness;
    currentCompleteness: ComparisonEvidenceCompleteness;
    bureau: Bureau | null;
    accountId?: string | null;
    fieldKey?: string | null;
    scoreOccurrence?: number | null;
    priorScoreSourceMethodKey?: string | null;
    priorScoreSourceMethodVersion?: string | null;
    currentScoreSourceMethodKey?: string | null;
    currentScoreSourceMethodVersion?: string | null;
    sourceKind: DifferenceSourceKind;
    priorSourceId: string;
    currentSourceId: string;
    priorIdentityBaselineId?: string | null;
    currentIdentityBaselineId?: string | null;
    identityFactSeriesKey?: string | null;
    reasonCodes?: readonly string[];
    sourceSetSha256: string;
  }
): ReportDifferenceDecision {
  return sealDifferenceDecision({
    persistenceDisposition: "PERSIST",
    tenantId: context.tenantId,
    consumerId: context.consumerId,
    comparisonId: context.comparisonId,
    priorReportVersionId: context.prior.reportVersionId,
    priorExtractionRunId: context.prior.extractionRunId,
    currentReportVersionId: context.current.reportVersionId,
    currentExtractionRunId: context.current.extractionRunId,
    scopeType: params.scopeType,
    changeKind: params.changeKind,
    comparability: params.comparability,
    differenceState: params.differenceState,
    deletionState: params.deletionState,
    priorCompleteness: params.priorCompleteness,
    currentCompleteness: params.currentCompleteness,
    bureau: params.bureau,
    accountId: params.accountId ?? null,
    fieldKey: params.fieldKey ?? null,
    scoreOccurrence: params.scoreOccurrence ?? null,
    priorScoreSourceMethodKey: params.priorScoreSourceMethodKey ?? null,
    priorScoreSourceMethodVersion:
      params.priorScoreSourceMethodVersion ?? null,
    currentScoreSourceMethodKey: params.currentScoreSourceMethodKey ?? null,
    currentScoreSourceMethodVersion:
      params.currentScoreSourceMethodVersion ?? null,
    sourceKind: params.sourceKind,
    priorSourceId: params.priorSourceId,
    currentSourceId: params.currentSourceId,
    priorIdentityBaselineId: params.priorIdentityBaselineId ?? null,
    currentIdentityBaselineId: params.currentIdentityBaselineId ?? null,
    identityFactSeriesKey: params.identityFactSeriesKey ?? null,
    reasonCodes: params.reasonCodes ?? [],
  }, params.sourceSetSha256);
}

function unknownDifference(
  context: ReportComparisonContext,
  params: Omit<
    Parameters<typeof differenceBase>[1],
    "changeKind" | "comparability" | "differenceState" | "deletionState"
  > & { reasonCodes: readonly string[]; accountScope?: boolean }
): ReportDifferenceDecision {
  return differenceBase(context, {
    ...params,
    changeKind: "UNABLE_TO_DETERMINE",
    comparability: "NOT_COMPARABLE",
    differenceState: "NOT_COMPARABLE",
    deletionState: params.accountScope ? "UNKNOWN_INCOMPLETE" : "NOT_APPLICABLE",
  });
}

function validateMatchedBureauAccount(
  prior: { bureau: Bureau; accountId: string },
  current: { bureau: Bureau; accountId: string }
): void {
  if (prior.bureau !== current.bureau || prior.accountId !== current.accountId) {
    throw new Error("differences are bureau-isolated and account-exact");
  }
}

export function compareAccountPresence(
  context: ReportComparisonContext,
  prior: AccountPresenceEvidence,
  current: AccountPresenceEvidence,
  repositoryRead: VerifiedProgressRepositoryRead<{
    prior: AccountPresenceEvidence;
    current: AccountPresenceEvidence;
  }>
): ReportDifferenceDecision {
  requireVerifiedReportComparisonContext(context);
  const sourceSetSha256 = requireExactTrustedRepositoryRead(
    repositoryRead,
    "ACCOUNT_PRESENCE_PAIR",
    { prior, current }
  );
  validateEvidenceCheckpoint(context, prior, "prior");
  validateEvidenceCheckpoint(context, current, "current");
  validateMatchedBureauAccount(prior, current);
  const priorCompleteness = toComparisonCompleteness(prior.completeness);
  const currentCompleteness = toComparisonCompleteness(current.completeness);
  const base = {
    scopeType: "ACCOUNT_PRESENCE" as const,
    priorCompleteness,
    currentCompleteness,
    bureau: prior.bureau,
    accountId: prior.accountId,
    fieldKey: null,
    sourceKind: "ACCOUNT_PRESENCE_OBSERVATION" as const,
    priorSourceId: prior.sourceObservationId,
    currentSourceId: current.sourceObservationId,
    sourceSetSha256,
  };

  if (!comparisonCanDescribeProgress(context)) {
    return unknownDifference(context, {
      ...base,
      accountScope: true,
      reasonCodes: ["NON_TEMPORAL_OR_UNORDERED_COMPARISON"],
    });
  }

  const evidenceComplete =
    prior.coverageStatus === "COVERED" &&
    current.coverageStatus === "COVERED" &&
    prior.completeness === "COMPLETE" &&
    current.completeness === "COMPLETE" &&
    prior.presence !== "UNKNOWN" &&
    current.presence !== "UNKNOWN";
  if (!evidenceComplete) {
    return unknownDifference(context, {
      ...base,
      accountScope: true,
      reasonCodes: ["ACCOUNT_INDEX_NOT_COMPLETE_ON_BOTH_REPORTS"],
    });
  }

  if (
    prior.presence === "PRESENT" &&
    current.presence === "ABSENT_CONFIRMED"
  ) {
    return differenceBase(context, {
      ...base,
      changeKind: "NO_LONGER_REPORTED",
      comparability: "COMPARABLE",
      differenceState: "CHANGED",
      deletionState: "ABSENT_CONFIRMED_ON_CURRENT_REPORT",
    });
  }
  if (
    prior.presence === "ABSENT_CONFIRMED" &&
    current.presence === "PRESENT"
  ) {
    return differenceBase(context, {
      ...base,
      changeKind: "NEW_ITEM",
      comparability: "COMPARABLE",
      differenceState: "CHANGED",
      deletionState: "PRESENT_ON_CURRENT_REPORT",
    });
  }

  return differenceBase(context, {
    ...base,
    changeKind: "UNCHANGED",
    comparability: "COMPARABLE",
    differenceState: "UNCHANGED",
    deletionState:
      current.presence === "PRESENT"
        ? "PRESENT_ON_CURRENT_REPORT"
        : "NOT_APPLICABLE",
  });
}

function canonicalComparableValue(value: ComparableValue): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("comparable numeric values must be finite");
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalComparableValue).join(",")}]`;
  }
  const record = value as Readonly<Record<string, ComparableValue>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalComparableValue(record[key]!)}`)
    .join(",")}}`;
}

function fieldChangeKind(fieldKey: string): ReportDifferenceChangeKind {
  if (fieldKey === "summaryStatus" || fieldKey === "detailedStatus") {
    return "STATUS_CHANGED";
  }
  if (fieldKey === "balanceCents") return "BALANCE_CHANGED";
  if (fieldKey === "paymentHistory") return "PAYMENT_HISTORY_CHANGED";
  if (fieldKey === "consumerDisputeRemarks") {
    return "DISPUTE_NOTATION_CHANGED";
  }
  if (fieldKey === "remarks" || fieldKey === "transferOrSale") {
    return "REMARK_CHANGED";
  }
  return "OTHER_FIELD_CHANGED";
}

export function compareFieldObservations(
  context: ReportComparisonContext,
  prior: FieldObservationEvidence,
  current: FieldObservationEvidence,
  repositoryRead: VerifiedProgressRepositoryRead<{
    prior: FieldObservationEvidence;
    current: FieldObservationEvidence;
  }>
): ReportDifferenceDecision {
  requireVerifiedReportComparisonContext(context);
  const sourceSetSha256 = requireExactTrustedRepositoryRead(
    repositoryRead,
    "FIELD_OBSERVATION_PAIR",
    { prior, current }
  );
  validateEvidenceCheckpoint(context, prior, "prior");
  validateEvidenceCheckpoint(context, current, "current");
  validateMatchedBureauAccount(prior, current);
  if (prior.fieldKey !== current.fieldKey) {
    throw new Error("field differences must pin the same exact field key");
  }
  const base = {
    scopeType: "FIELD_VALUE" as const,
    priorCompleteness: toComparisonCompleteness(prior.completeness),
    currentCompleteness: toComparisonCompleteness(current.completeness),
    bureau: prior.bureau,
    accountId: prior.accountId,
    fieldKey: prior.fieldKey,
    sourceKind: "FIELD_OBSERVATION" as const,
    priorSourceId: prior.sourceObservationId,
    currentSourceId: current.sourceObservationId,
    sourceSetSha256,
  };

  if (!comparisonCanDescribeProgress(context)) {
    return unknownDifference(context, {
      ...base,
      reasonCodes: ["NON_TEMPORAL_OR_UNORDERED_COMPARISON"],
    });
  }
  if (
    prior.coverageStatus !== "COVERED" ||
    current.coverageStatus !== "COVERED" ||
    prior.completeness !== "COMPLETE" ||
    current.completeness !== "COMPLETE" ||
    prior.presence === "UNKNOWN" ||
    current.presence === "UNKNOWN"
  ) {
    return unknownDifference(context, {
      ...base,
      reasonCodes: ["FIELD_EVIDENCE_NOT_COMPLETE_ON_BOTH_REPORTS"],
    });
  }
  if (
    prior.normalizationRuleKey !== current.normalizationRuleKey ||
    prior.normalizationRuleVersion !== current.normalizationRuleVersion
  ) {
    return unknownDifference(context, {
      ...base,
      reasonCodes: ["FIELD_NORMALIZATION_RULE_MISMATCH"],
    });
  }
  if (prior.presence !== current.presence) {
    return differenceBase(context, {
      ...base,
      changeKind: fieldChangeKind(prior.fieldKey),
      comparability: "COMPARABLE",
      differenceState: "CHANGED",
      deletionState: "NOT_APPLICABLE",
      reasonCodes: ["FIELD_PRESENCE_CHANGED"],
    });
  }
  if (prior.presence === "ABSENT_CONFIRMED") {
    return differenceBase(context, {
      ...base,
      changeKind: "UNCHANGED",
      comparability: "COMPARABLE",
      differenceState: "UNCHANGED",
      deletionState: "NOT_APPLICABLE",
    });
  }
  if (prior.comparableValue === undefined || current.comparableValue === undefined) {
    return unknownDifference(context, {
      ...base,
      reasonCodes: ["PRESENT_FIELD_VALUE_UNAVAILABLE_FOR_COMPARISON"],
    });
  }
  const unchanged =
    canonicalComparableValue(prior.comparableValue) ===
    canonicalComparableValue(current.comparableValue);
  return differenceBase(context, {
    ...base,
    changeKind: unchanged ? "UNCHANGED" : fieldChangeKind(prior.fieldKey),
    comparability: "COMPARABLE",
    differenceState: unchanged ? "UNCHANGED" : "CHANGED",
    deletionState: "NOT_APPLICABLE",
  });
}

export function compareBureauCoverage(
  context: ReportComparisonContext,
  prior: BureauCoverageEvidence,
  current: BureauCoverageEvidence,
  repositoryRead: VerifiedProgressRepositoryRead<{
    prior: BureauCoverageEvidence;
    current: BureauCoverageEvidence;
  }>
): ReportDifferenceDecision {
  requireVerifiedReportComparisonContext(context);
  const sourceSetSha256 = requireExactTrustedRepositoryRead(
    repositoryRead,
    "BUREAU_COVERAGE_PAIR",
    { prior, current }
  );
  validateEvidenceCheckpoint(context, prior, "prior");
  validateEvidenceCheckpoint(context, current, "current");
  if (prior.bureau !== current.bureau) {
    throw new Error("bureau coverage differences must remain bureau-isolated");
  }
  const base = {
    scopeType: "BUREAU_COVERAGE" as const,
    priorCompleteness: "COMPLETE" as const,
    currentCompleteness: "COMPLETE" as const,
    bureau: prior.bureau,
    accountId: null,
    fieldKey: null,
    sourceKind: "BUREAU_COVERAGE_OBSERVATION" as const,
    priorSourceId: prior.sourceObservationId,
    currentSourceId: current.sourceObservationId,
    sourceSetSha256,
  };
  if (!comparisonCanDescribeProgress(context)) {
    return unknownDifference(context, {
      ...base,
      reasonCodes: ["NON_TEMPORAL_OR_UNORDERED_COMPARISON"],
    });
  }
  const changed = prior.coverageStatus !== current.coverageStatus;
  return differenceBase(context, {
    ...base,
    changeKind: changed ? "BUREAU_COVERAGE_CHANGED" : "UNCHANGED",
    comparability: "COMPARABLE",
    differenceState: changed ? "CHANGED" : "UNCHANGED",
    deletionState: "NOT_APPLICABLE",
  });
}

export function compareIdentityFacts(
  context: ReportComparisonContext,
  prior: IdentityFactEvidence,
  current: IdentityFactEvidence,
  repositoryRead: VerifiedProgressRepositoryRead<{
    prior: IdentityFactEvidence;
    current: IdentityFactEvidence;
  }>
): ReportDifferenceDecision {
  requireVerifiedReportComparisonContext(context);
  const sourceSetSha256 = requireExactTrustedRepositoryRead(
    repositoryRead,
    "IDENTITY_FACT_PAIR",
    { prior, current }
  );
  validateEvidenceCheckpoint(context, prior, "prior");
  validateEvidenceCheckpoint(context, current, "current");
  if (
    prior.bureau !== current.bureau ||
    prior.factSeriesKey !== current.factSeriesKey
  ) {
    throw new Error("identity differences require the same bureau/fact series");
  }
  const base = {
    scopeType: "IDENTITY_FACT" as const,
    priorCompleteness: toComparisonCompleteness(prior.completeness),
    currentCompleteness: toComparisonCompleteness(current.completeness),
    bureau: prior.bureau,
    accountId: null,
    fieldKey: null,
    sourceKind: "IDENTITY_FACT" as const,
    priorSourceId: prior.sourceObservationId,
    currentSourceId: current.sourceObservationId,
    priorIdentityBaselineId: prior.identityBaselineId,
    currentIdentityBaselineId: current.identityBaselineId,
    identityFactSeriesKey: prior.factSeriesKey,
    sourceSetSha256,
  };
  if (
    !comparisonCanDescribeProgress(context) ||
    prior.completeness !== "COMPLETE" ||
    current.completeness !== "COMPLETE" ||
    prior.presence === "UNKNOWN" ||
    current.presence === "UNKNOWN"
  ) {
    return unknownDifference(context, {
      ...base,
      reasonCodes: ["IDENTITY_EVIDENCE_NOT_COMPARABLE"],
    });
  }
  let changed = prior.presence !== current.presence;
  if (!changed && prior.presence === "PRESENT") {
    if (prior.comparableValue === undefined || current.comparableValue === undefined) {
      return unknownDifference(context, {
        ...base,
        reasonCodes: ["PRESENT_IDENTITY_VALUE_UNAVAILABLE_FOR_COMPARISON"],
      });
    }
    changed =
      canonicalComparableValue(prior.comparableValue) !==
      canonicalComparableValue(current.comparableValue);
  }
  return differenceBase(context, {
    ...base,
    changeKind: changed ? "IDENTITY_INFORMATION_CHANGED" : "UNCHANGED",
    comparability: "COMPARABLE",
    differenceState: changed ? "CHANGED" : "UNCHANGED",
    deletionState: "NOT_APPLICABLE",
  });
}

function scoreModelMatches(
  prior: ReportDerivedCreditScoreObservation,
  current: ReportDerivedCreditScoreObservation
): boolean {
  if (
    prior.presence !== "SCORE_REPORTED" ||
    current.presence !== "SCORE_REPORTED" ||
    prior.model.completeness !== "COMPLETE" ||
    current.model.completeness !== "COMPLETE"
  ) {
    return false;
  }
  return (
    prior.model.modelKey === current.model.modelKey &&
    prior.model.modelVersion === current.model.modelVersion &&
    prior.model.scaleMin === current.model.scaleMin &&
    prior.model.scaleMax === current.model.scaleMax
  );
}

function scoreReportDatesAreComparable(
  prior: ReportDerivedCreditScoreObservation,
  current: ReportDerivedCreditScoreObservation
): boolean {
  const priorDate = prior.checkpoint.reportDateEvidence;
  const currentDate = current.checkpoint.reportDateEvidence;
  return (
    priorDate.provenance === "SOURCE_REPORTED" &&
    currentDate.provenance === "SOURCE_REPORTED" &&
    priorDate.reportDate <= currentDate.reportDate
  );
}

export function compareCreditScores(
  context: ReportComparisonContext,
  prior: CreditScoreObservation,
  current: CreditScoreObservation,
  repositoryRead: VerifiedProgressRepositoryRead<{
    prior: CreditScoreObservation;
    current: CreditScoreObservation;
  }>
): ScoreComparisonDecision {
  requireVerifiedReportComparisonContext(context);
  requireVerifiedCreditScoreObservation(prior);
  requireVerifiedCreditScoreObservation(current);
  const sourceSetSha256 = requireExactTrustedRepositoryRead(
    repositoryRead,
    "CREDIT_SCORE_PAIR",
    { prior, current }
  );
  requireScope(context, prior, "prior score");
  requireScope(context, current, "current score");
  if (prior.bureau !== current.bureau) {
    throw new Error("score comparisons must remain bureau-isolated");
  }
  const reportDerived =
    prior.sourceType === "REPORT_DERIVED" &&
    current.sourceType === "REPORT_DERIVED";
  if (reportDerived) {
    validateEvidenceCheckpoint(context, prior, "prior");
    validateEvidenceCheckpoint(context, current, "current");
  }
  const sourcePins = {
    scopeType: "CREDIT_SCORE" as const,
    priorCompleteness:
      prior.evidenceCompleteness === "COMPLETE"
        ? ("COMPLETE" as const)
        : prior.evidenceCompleteness === "PARTIAL"
          ? ("PARTIAL" as const)
          : prior.evidenceCompleteness === "UNKNOWN"
            ? ("UNKNOWN" as const)
            : ("INCOMPLETE" as const),
    currentCompleteness:
      current.evidenceCompleteness === "COMPLETE"
        ? ("COMPLETE" as const)
        : current.evidenceCompleteness === "PARTIAL"
          ? ("PARTIAL" as const)
          : current.evidenceCompleteness === "UNKNOWN"
            ? ("UNKNOWN" as const)
            : ("INCOMPLETE" as const),
    bureau: prior.bureau,
    accountId: null,
    fieldKey: null,
    scoreOccurrence: prior.occurrence,
    priorScoreSourceMethodKey: prior.sourceMethodKey,
    priorScoreSourceMethodVersion: prior.sourceMethodVersion,
    currentScoreSourceMethodKey: current.sourceMethodKey,
    currentScoreSourceMethodVersion: current.sourceMethodVersion,
    sourceKind: "CREDIT_SCORE_OBSERVATION" as const,
    priorSourceId: prior.observationId,
    currentSourceId: current.observationId,
    sourceSetSha256,
  };
  const exactModel =
    prior.presence === "SCORE_REPORTED" &&
    current.presence === "SCORE_REPORTED" &&
    prior.model.completeness === "COMPLETE" &&
    current.model.completeness === "COMPLETE" &&
    scoreModelMatches(
      prior as ReportDerivedCreditScoreObservation,
      current as ReportDerivedCreditScoreObservation
    )
      ? prior.model
      : null;
  const comparisonPins = {
    tenantId: context.tenantId,
    consumerId: context.consumerId,
    comparisonId: context.comparisonId,
    bureau: prior.bureau,
    occurrence: prior.occurrence,
    priorObservationId: prior.observationId,
    currentObservationId: current.observationId,
    sourceMethodKey:
      prior.sourceMethodKey === current.sourceMethodKey
        ? prior.sourceMethodKey
        : null,
    sourceMethodVersion:
      prior.sourceMethodVersion === current.sourceMethodVersion
        ? prior.sourceMethodVersion
        : null,
    modelKey: exactModel?.modelKey ?? null,
    modelVersion: exactModel?.modelVersion ?? null,
    scaleMin: exactModel?.scaleMin ?? null,
    scaleMax: exactModel?.scaleMax ?? null,
  } as const;

  const comparable =
    reportDerived &&
    comparisonCanDescribeProgress(context) &&
    prior.evidenceRole === "PRIMARY_REPORT_EVIDENCE" &&
    current.evidenceRole === "PRIMARY_REPORT_EVIDENCE" &&
    prior.coverageStatus === "COVERED" &&
    current.coverageStatus === "COVERED" &&
    prior.presence === "SCORE_REPORTED" &&
    current.presence === "SCORE_REPORTED" &&
    prior.evidenceCompleteness === "COMPLETE" &&
    current.evidenceCompleteness === "COMPLETE" &&
    prior.sourceMethodKey === current.sourceMethodKey &&
    prior.sourceMethodVersion === current.sourceMethodVersion &&
    prior.occurrence === current.occurrence &&
    scoreReportDatesAreComparable(prior, current) &&
    scoreModelMatches(prior, current);

  if (!comparable) {
    const reasons: string[] = [];
    if (!reportDerived) reasons.push("MANUAL_SCORE_IS_SECONDARY_CONTEXT");
    if (!comparisonCanDescribeProgress(context)) {
      reasons.push("NON_TEMPORAL_OR_UNORDERED_COMPARISON");
    }
    if (
      prior.presence !== "SCORE_REPORTED" ||
      current.presence !== "SCORE_REPORTED"
    ) {
      reasons.push("SCORE_NOT_REPORTED_ON_BOTH_REPORTS");
    }
    if (reportDerived && !scoreModelMatches(prior, current)) {
      reasons.push("SCORE_MODEL_OR_SCALE_NOT_EXACTLY_COMPARABLE");
    }
    if (
      prior.sourceMethodKey !== current.sourceMethodKey ||
      prior.sourceMethodVersion !== current.sourceMethodVersion
    ) {
      reasons.push("SCORE_SOURCE_METHOD_MISMATCH");
    }
    if (prior.occurrence !== current.occurrence) {
      reasons.push("SCORE_OCCURRENCE_MISMATCH");
    }
    if (reportDerived && !scoreReportDatesAreComparable(prior, current)) {
      reasons.push("SOURCE_REPORT_DATES_NOT_COMPARABLE");
    }
    if (!reportDerived) {
      return {
        ...comparisonPins,
        difference: null,
        directlyComparable: false,
        priorScore: null,
        currentScore: null,
        delta: null,
        reasonCodes: reasons,
      };
    }
    if (prior.occurrence !== current.occurrence) {
      return {
        ...comparisonPins,
        difference: null,
        directlyComparable: false,
        priorScore: null,
        currentScore: null,
        delta: null,
        reasonCodes: reasons,
      };
    }
    const difference = unknownDifference(context, {
      ...sourcePins,
      reasonCodes: reasons.length > 0 ? reasons : ["SCORE_EVIDENCE_NOT_COMPARABLE"],
    });
    return {
      ...comparisonPins,
      difference,
      directlyComparable: false,
      priorScore: null,
      currentScore: null,
      delta: null,
      reasonCodes: difference.reasonCodes,
    };
  }

  const exactPrior = prior as Extract<
    ReportDerivedCreditScoreObservation,
    { presence: "SCORE_REPORTED" }
  >;
  const exactCurrent = current as Extract<
    ReportDerivedCreditScoreObservation,
    { presence: "SCORE_REPORTED" }
  >;
  const delta = exactCurrent.score - exactPrior.score;
  const difference = differenceBase(context, {
    ...sourcePins,
    changeKind: delta === 0 ? "UNCHANGED" : "SCORE_CHANGED",
    comparability: "COMPARABLE",
    differenceState: delta === 0 ? "UNCHANGED" : "CHANGED",
    deletionState: "NOT_APPLICABLE",
  });
  return {
    ...comparisonPins,
    difference,
    directlyComparable: true,
    priorScore: exactPrior.score,
    currentScore: exactCurrent.score,
    delta,
    reasonCodes: [],
  };
}

export function toReportDifferenceInsertCandidate(
  decision: ReportDifferenceDecision,
  metadata: ReportDifferenceInsertMetadata
): ReportDifferenceInsertCandidate {
  const attestedSourceSetSha256 = requireVerifiedDifferenceDecision(decision);
  validateMachineCodes(decision.reasonCodes, "difference reasonCodes");
  if (decision.persistenceDisposition !== "PERSIST") {
    throw new Error("an omitted comparison evaluation cannot become a durable difference");
  }
  for (const [field, value] of Object.entries({
    differenceSeriesKey: metadata.differenceSeriesKey,
    idempotencyKey: metadata.idempotencyKey,
    comparisonRuleKey: metadata.comparisonRuleKey,
    comparisonRuleVersion: metadata.comparisonRuleVersion,
    createdByActorId: metadata.createdByActorId,
  })) {
    requireNonEmpty(value, `difference ${field}`);
  }
  validateAppendOnlyVersion(
    metadata.version,
    metadata.supersedesDifferenceId,
    "report difference"
  );
  if (!SHA_256.test(metadata.sourceSetSha256)) {
    throw new Error("difference sourceSetSha256 must be a SHA-256 hex digest");
  }
  if (metadata.sourceSetSha256 !== attestedSourceSetSha256) {
    throw new Error(
      "difference sourceSetSha256 must match the verified repository source set"
    );
  }
  if (!SHA_256.test(metadata.integritySha256)) {
    throw new Error("difference integritySha256 must be a SHA-256 hex digest");
  }
  if (
    decision.scopeType === "CREDIT_SCORE" &&
    (decision.scoreOccurrence === null ||
      !Number.isInteger(decision.scoreOccurrence) ||
      decision.scoreOccurrence < 0)
  ) {
    throw new Error("credit-score difference candidates require an exact occurrence");
  }
  if (
    decision.scopeType !== "CREDIT_SCORE" &&
    decision.scoreOccurrence !== null
  ) {
    throw new Error("only credit-score differences may carry scoreOccurrence");
  }
  const scoreMethodPins = [
    decision.priorScoreSourceMethodKey,
    decision.priorScoreSourceMethodVersion,
    decision.currentScoreSourceMethodKey,
    decision.currentScoreSourceMethodVersion,
  ];
  if (decision.scopeType === "CREDIT_SCORE") {
    for (const [index, pin] of scoreMethodPins.entries()) {
      requireNonEmpty(pin ?? "", `credit-score source method pin ${index + 1}`);
    }
  } else if (scoreMethodPins.some((pin) => pin !== null)) {
    throw new Error("only credit-score differences may carry score source-method pins");
  }

  const expectedSourceKind: Record<
    ReportDifferenceScope,
    DifferenceSourceKind
  > = {
    ACCOUNT_PRESENCE: "ACCOUNT_PRESENCE_OBSERVATION",
    FIELD_VALUE: "FIELD_OBSERVATION",
    CREDIT_SCORE: "CREDIT_SCORE_OBSERVATION",
    BUREAU_COVERAGE: "BUREAU_COVERAGE_OBSERVATION",
    IDENTITY_FACT: "IDENTITY_FACT",
  };
  if (decision.sourceKind !== expectedSourceKind[decision.scopeType]) {
    throw new Error("difference scope and exact source kind do not match");
  }
  requireNonEmpty(decision.priorSourceId, "difference prior source id");
  requireNonEmpty(decision.currentSourceId, "difference current source id");

  const accountScoped =
    decision.scopeType === "ACCOUNT_PRESENCE" ||
    decision.scopeType === "FIELD_VALUE";
  if (
    (decision.scopeType !== "IDENTITY_FACT" && !decision.bureau) ||
    (accountScoped && !decision.accountId) ||
    (!accountScoped && decision.accountId !== null)
  ) {
    throw new Error("difference account/bureau scope is not database-compatible");
  }
  if (
    (decision.scopeType === "FIELD_VALUE" && !decision.fieldKey) ||
    (decision.scopeType !== "FIELD_VALUE" && decision.fieldKey !== null)
  ) {
    throw new Error("difference field scope is not database-compatible");
  }
  if (
    decision.scopeType !== "IDENTITY_FACT" &&
    (decision.identityFactSeriesKey !== null ||
      decision.priorIdentityBaselineId !== null ||
      decision.currentIdentityBaselineId !== null)
  ) {
    throw new Error("only identity differences may carry identity source pins");
  }
  if (
    decision.scopeType === "IDENTITY_FACT" &&
    (!decision.identityFactSeriesKey ||
      !decision.priorIdentityBaselineId ||
      !decision.currentIdentityBaselineId)
  ) {
    throw new Error("identity differences require both exact baseline/fact-series pins");
  }
  if (
    decision.scopeType === "FIELD_VALUE" &&
    decision.differenceState === "CHANGED" &&
    decision.changeKind !== fieldChangeKind(decision.fieldKey!)
  ) {
    throw new Error("changed field difference must use its exact canonical change kind");
  }
  if (
    decision.scopeType !== "ACCOUNT_PRESENCE" &&
    decision.deletionState !== "NOT_APPLICABLE"
  ) {
    throw new Error("non-account differences cannot carry deletion inference");
  }

  const is = (kind: DifferenceSourceKind): boolean =>
    decision.sourceKind === kind;
  return {
    tenantId: decision.tenantId,
    consumerId: decision.consumerId,
    priorReportVersionId: decision.priorReportVersionId,
    priorExtractionRunId: decision.priorExtractionRunId,
    currentReportVersionId: decision.currentReportVersionId,
    currentExtractionRunId: decision.currentExtractionRunId,
    comparisonId: decision.comparisonId,
    scopeType: decision.scopeType,
    bureau: decision.bureau,
    accountId: decision.accountId,
    fieldKey: decision.fieldKey,
    scoreOccurrence: decision.scoreOccurrence,
    priorScoreSourceMethodKey: decision.priorScoreSourceMethodKey,
    priorScoreSourceMethodVersion: decision.priorScoreSourceMethodVersion,
    currentScoreSourceMethodKey: decision.currentScoreSourceMethodKey,
    currentScoreSourceMethodVersion: decision.currentScoreSourceMethodVersion,
    priorPresenceObservationId: is("ACCOUNT_PRESENCE_OBSERVATION")
      ? decision.priorSourceId
      : null,
    currentPresenceObservationId: is("ACCOUNT_PRESENCE_OBSERVATION")
      ? decision.currentSourceId
      : null,
    priorFieldObservationId: is("FIELD_OBSERVATION")
      ? decision.priorSourceId
      : null,
    currentFieldObservationId: is("FIELD_OBSERVATION")
      ? decision.currentSourceId
      : null,
    priorScoreObservationId: is("CREDIT_SCORE_OBSERVATION")
      ? decision.priorSourceId
      : null,
    currentScoreObservationId: is("CREDIT_SCORE_OBSERVATION")
      ? decision.currentSourceId
      : null,
    priorCoverageObservationId: is("BUREAU_COVERAGE_OBSERVATION")
      ? decision.priorSourceId
      : null,
    currentCoverageObservationId: is("BUREAU_COVERAGE_OBSERVATION")
      ? decision.currentSourceId
      : null,
    identityFactSeriesKey: decision.identityFactSeriesKey,
    priorIdentityBaselineId: decision.priorIdentityBaselineId,
    priorIdentityFactId: is("IDENTITY_FACT") ? decision.priorSourceId : null,
    currentIdentityBaselineId: decision.currentIdentityBaselineId,
    currentIdentityFactId: is("IDENTITY_FACT")
      ? decision.currentSourceId
      : null,
    priorCompleteness: decision.priorCompleteness,
    currentCompleteness: decision.currentCompleteness,
    comparability: decision.comparability,
    differenceState: decision.differenceState,
    changeKind: decision.changeKind,
    deletionState: decision.deletionState,
    differenceSeriesKey: metadata.differenceSeriesKey,
    version: metadata.version,
    idempotencyKey: metadata.idempotencyKey,
    comparisonRuleKey: metadata.comparisonRuleKey,
    comparisonRuleVersion: metadata.comparisonRuleVersion,
    sourceSetSha256: metadata.sourceSetSha256,
    integritySha256: metadata.integritySha256,
    reasonCodes: [...decision.reasonCodes],
    supersedesDifferenceId: metadata.supersedesDifferenceId ?? null,
    createdByActorId: metadata.createdByActorId,
  };
}

function decisionMatchesCandidate(
  decision: ReportDifferenceDecision,
  candidate: ReportDifferenceInsertCandidate
): boolean {
  const expected = toReportDifferenceInsertCandidate(decision, {
    differenceSeriesKey: candidate.differenceSeriesKey,
    version: candidate.version,
    idempotencyKey: candidate.idempotencyKey,
    comparisonRuleKey: candidate.comparisonRuleKey,
    comparisonRuleVersion: candidate.comparisonRuleVersion,
    sourceSetSha256: candidate.sourceSetSha256,
    integritySha256: candidate.integritySha256,
    ...(candidate.supersedesDifferenceId
      ? { supersedesDifferenceId: candidate.supersedesDifferenceId }
      : {}),
    createdByActorId: candidate.createdByActorId,
  });
  return (
    canonicalComparableValue(
      expected as unknown as Readonly<Record<string, ComparableValue>>
    ) ===
    canonicalComparableValue(
      candidate as unknown as Readonly<Record<string, ComparableValue>>
    )
  );
}

export function bindPersistedReportDifference(
  decision: ReportDifferenceDecision,
  persisted: PersistedReportDifferenceSnapshot,
  repositoryRead: VerifiedProgressRepositoryRead<PersistedReportDifferenceSnapshot>
): VerifiedReportDifferenceBinding {
  requireVerifiedDifferenceDecision(decision);
  requireExactTrustedRepositoryRead(
    repositoryRead,
    "PERSISTED_REPORT_DIFFERENCE",
    persisted
  );
  requireNonEmpty(persisted.id, "persisted difference id");
  if (!decisionMatchesCandidate(decision, persisted.candidate)) {
    throw new Error(
      "persisted difference does not match the exact evaluated source decision"
    );
  }
  const sealedDecision = Object.freeze({
    ...decision,
    reasonCodes: Object.freeze([...decision.reasonCodes]),
  });
  const sealedCandidate = Object.freeze({
    ...persisted.candidate,
    reasonCodes: Object.freeze([...persisted.candidate.reasonCodes]),
  });
  const binding: VerifiedReportDifferenceBinding = Object.freeze({
    id: persisted.id,
    decision: sealedDecision,
    candidate: sealedCandidate,
    [VERIFIED_REPORT_DIFFERENCE]: true as const,
  });
  verifiedReportDifferences.add(binding);
  return binding;
}

export function bindApprovedCorrespondenceTarget(input: {
  assertion: ConsumerAssertionBindingSnapshot;
  item: CorrespondenceItemBindingSnapshot;
  version: CorrespondenceVersionBindingSnapshot;
  membership: CorrespondenceVersionItemBindingSnapshot;
  repositoryRead: VerifiedProgressRepositoryRead<{
    assertion: ConsumerAssertionBindingSnapshot;
    item: CorrespondenceItemBindingSnapshot;
    version: CorrespondenceVersionBindingSnapshot;
    membership: CorrespondenceVersionItemBindingSnapshot;
  }>;
}): VerifiedApprovedCorrespondenceTarget {
  const { assertion, item, version, membership, repositoryRead } = input;
  requireExactTrustedRepositoryRead(
    repositoryRead,
    "APPROVED_CORRESPONDENCE_CHAIN",
    { assertion, item, version, membership }
  );
  requireScope(assertion, item, "correspondence assertion/item binding");
  requireScope(assertion, version, "correspondence assertion/version binding");
  requireScope(assertion, membership, "correspondence assertion/membership binding");
  if (version.status !== "APPROVED") {
    throw new Error("outcome target requires an exact APPROVED correspondence version");
  }
  if (
    !(
      [
        "CONFIRMED_ACCURATE",
        "CONFIRMED_INACCURATE",
        "NOT_MINE",
        "OUTDATED_UPDATE_REQUESTED",
        "REVIEW_NEEDED",
      ] as readonly string[]
    ).includes(assertion.disposition)
  ) {
    throw new Error(
      "only an active, closed-domain consumer assertion can back an outcome target"
    );
  }
  if (
    assertion.id !== item.consumerAssertionId ||
    assertion.reportVersionId !== item.reportVersionId ||
    assertion.accountId !== item.accountId ||
    assertion.bureau !== item.bureau ||
    assertion.fieldKey !== item.fieldKey ||
    assertion.observationId !== item.observationId ||
    version.reportVersionId !== item.reportVersionId ||
    version.caseId !== item.caseId ||
    version.correspondenceId !== item.correspondenceId ||
    membership.reportVersionId !== item.reportVersionId ||
    membership.caseId !== item.caseId ||
    membership.correspondenceId !== item.correspondenceId ||
    membership.correspondenceVersionId !== version.id ||
    membership.correspondenceItemId !== item.id
  ) {
    throw new Error(
      "approved target rows do not form one exact correspondence chain"
    );
  }
  requireStrictIsoInstant(assertion.confirmedAt, "consumer assertion confirmedAt");
  for (const [field, value] of Object.entries({
    tenantId: assertion.tenantId,
    consumerId: assertion.consumerId,
    assertionId: assertion.id,
    priorReportVersionId: assertion.reportVersionId,
    accountId: assertion.accountId,
    fieldKey: assertion.fieldKey,
    priorObservationId: assertion.observationId,
    assertionConfirmedByActorId: assertion.confirmedByActorId,
    assertionConfirmedAt: assertion.confirmedAt,
    caseId: item.caseId,
    correspondenceId: item.correspondenceId,
    itemId: item.id,
    versionId: version.id,
    membershipId: membership.id,
  })) {
    requireNonEmpty(value, `approved target ${field}`);
  }
  const target = Object.freeze({
    tenantId: item.tenantId,
    consumerId: item.consumerId,
    caseId: item.caseId,
    priorReportVersionId: item.reportVersionId,
    correspondenceId: item.correspondenceId,
    correspondenceItemId: item.id,
    correspondenceVersionId: version.id,
    correspondenceVersionMembershipId: membership.id,
    consumerAssertionId: assertion.id,
    priorObservationId: item.observationId,
    bureau: item.bureau,
    accountId: item.accountId,
    fieldKey: item.fieldKey,
  });
  const binding: VerifiedApprovedCorrespondenceTarget = Object.freeze({
    target,
    [VERIFIED_APPROVED_TARGET]: true as const,
  });
  verifiedApprovedTargets.add(binding);
  return binding;
}

export function bindHumanOutcomeConfirmation(input: {
  snapshot: HumanOutcomeConfirmationSnapshot;
  difference: VerifiedReportDifferenceBinding;
  target: VerifiedApprovedCorrespondenceTarget;
  repositoryRead: VerifiedProgressRepositoryRead<HumanOutcomeConfirmationSnapshot>;
}): VerifiedHumanOutcomeConfirmation {
  const { snapshot, difference, target, repositoryRead } = input;
  requireExactTrustedRepositoryRead(
    repositoryRead,
    "HUMAN_OUTCOME_CONFIRMATION",
    snapshot
  );
  requireScope(difference.decision, snapshot, "human outcome confirmation");
  if (
    (snapshot.confirmedState !== "CORRECTED" &&
      snapshot.confirmedState !== "NEW_CONFLICT") ||
    difference.decision.scopeType !== "FIELD_VALUE" ||
    difference.decision.differenceState !== "CHANGED" ||
    snapshot.comparisonId !== difference.decision.comparisonId ||
    snapshot.differenceId !== difference.id ||
    snapshot.correspondenceItemId !== target.target.correspondenceItemId ||
    snapshot.currentSourceObservationId !== difference.decision.currentSourceId
  ) {
    throw new Error(
      "human confirmation does not bind the exact changed field outcome"
    );
  }
  requireNonEmpty(snapshot.id, "human confirmation id");
  requireNonEmpty(snapshot.confirmedByActorId, "human confirmation actor");
  requireStrictIsoInstant(snapshot.confirmedAt, "human confirmation confirmedAt");
  const confirmation = Object.freeze({ ...snapshot });
  const binding: VerifiedHumanOutcomeConfirmation = Object.freeze({
    confirmation,
    [VERIFIED_HUMAN_OUTCOME_CONFIRMATION]: true as const,
  });
  verifiedHumanOutcomeConfirmations.add(binding);
  return binding;
}

export function determineDisputeOutcome(
  input: DetermineDisputeOutcomeInput
): DisputeOutcomeCandidate {
  if (
    input.difference[VERIFIED_REPORT_DIFFERENCE] !== true ||
    !verifiedReportDifferences.has(input.difference)
  ) {
    throw new Error("outcome requires a verified persisted difference binding");
  }
  if (
    input.target[VERIFIED_APPROVED_TARGET] !== true ||
    !verifiedApprovedTargets.has(input.target)
  ) {
    throw new Error("outcome requires a verified approved correspondence binding");
  }
  const differenceBinding = input.difference;
  const difference = differenceBinding.decision;
  const target = input.target.target;
  requireScope(difference, target, "dispute outcome target");
  requireNonEmpty(input.outcomeSeriesKey, "outcomeSeriesKey");
  requireNonEmpty(input.idempotencyKey, "idempotencyKey");
  requireNonEmpty(input.decisionModelKey, "outcome decisionModelKey");
  requireNonEmpty(input.decisionModelVersion, "outcome decisionModelVersion");
  if (!SHA_256.test(input.sourceSetSha256)) {
    throw new Error("outcome sourceSetSha256 must be a SHA-256 hex digest");
  }
  if (!SHA_256.test(input.integritySha256)) {
    throw new Error("outcome integritySha256 must be a SHA-256 hex digest");
  }
  requireStrictIsoInstant(input.decidedAt, "system outcome decidedAt");
  validateAppendOnlyVersion(
    input.version,
    input.supersedesOutcomeId,
    "dispute outcome"
  );
  for (const [field, value] of Object.entries({
    caseId: target.caseId,
    correspondenceId: target.correspondenceId,
    correspondenceItemId: target.correspondenceItemId,
    correspondenceVersionId: target.correspondenceVersionId,
    correspondenceVersionMembershipId:
      target.correspondenceVersionMembershipId,
    consumerAssertionId: target.consumerAssertionId,
    fieldKey: target.fieldKey,
  })) {
    requireNonEmpty(value, `outcome target ${field}`);
  }
  if (
    target.priorReportVersionId !== difference.priorReportVersionId ||
    target.bureau !== difference.bureau ||
    target.accountId !== difference.accountId
  ) {
    throw new Error("outcome target must match the exact report/bureau/account difference");
  }
  if (difference.scopeType === "FIELD_VALUE" && target.fieldKey !== difference.fieldKey) {
    throw new Error("field outcome target must match the exact changed field");
  }
  if (
    difference.scopeType === "FIELD_VALUE" &&
    target.priorObservationId !== difference.priorSourceId
  ) {
    throw new Error("field outcome target must pin the exact prior observation");
  }
  if (
    difference.scopeType === "CREDIT_SCORE" ||
    difference.scopeType === "BUREAU_COVERAGE" ||
    difference.scopeType === "IDENTITY_FACT"
  ) {
    throw new Error("score, coverage, and identity differences are facts, not dispute outcomes");
  }

  let outcomeState: DisputeOutcomeState;
  let decisionSource: "SYSTEM_DERIVED" | "HUMAN_CONFIRMED";
  let decidedByActorId: string | null = null;
  let decidedAt = input.decidedAt;
  const reasons: string[] = [];
  if (input.humanConfirmation) {
    if (
      input.humanConfirmation[VERIFIED_HUMAN_OUTCOME_CONFIRMATION] !== true ||
      !verifiedHumanOutcomeConfirmations.has(input.humanConfirmation)
    ) {
      throw new Error("human outcome requires a verified confirmation binding");
    }
    const confirmation = input.humanConfirmation.confirmation;
    if (
      confirmation.differenceId !== differenceBinding.id ||
      confirmation.correspondenceItemId !== target.correspondenceItemId ||
      confirmation.currentSourceObservationId !== difference.currentSourceId
    ) {
      throw new Error("human confirmation drifted from the exact bound outcome");
    }
    outcomeState = confirmation.confirmedState;
    decisionSource = "HUMAN_CONFIRMED";
    decidedByActorId = confirmation.confirmedByActorId;
    decidedAt = confirmation.confirmedAt;
  } else if (
    difference.differenceState === "NOT_COMPARABLE" ||
    difference.changeKind === "UNABLE_TO_DETERMINE"
  ) {
    outcomeState = "UNABLE_TO_DETERMINE";
    decisionSource = "SYSTEM_DERIVED";
    reasons.push("CURRENT_REPORT_EVIDENCE_INSUFFICIENT");
  } else if (difference.scopeType === "ACCOUNT_PRESENCE") {
    if (difference.changeKind === "NO_LONGER_REPORTED") {
      outcomeState = "NO_LONGER_REPORTED";
    } else if (difference.changeKind === "UNCHANGED") {
      outcomeState = "UNCHANGED";
    } else if (difference.changeKind === "NEW_ITEM") {
      throw new Error("a newly reported account cannot be attributed to a prior dispute item");
    } else {
      throw new Error("unsupported account-presence outcome state");
    }
    decisionSource = "SYSTEM_DERIVED";
  } else {
    if (difference.changeKind === "UNCHANGED") {
      outcomeState = "UNCHANGED";
    } else {
      outcomeState = "CHANGED_DIFFERENTLY";
      reasons.push("FIELD_CHANGED_WITHOUT_HUMAN_CORRECTION_CONFIRMATION");
    }
    decisionSource = "SYSTEM_DERIVED";
  }

  const candidateBase: DisputeOutcomeCandidateBase = {
    tenantId: difference.tenantId,
    consumerId: difference.consumerId,
    caseId: target.caseId,
    comparisonId: difference.comparisonId,
    differenceId: differenceBinding.id,
    priorReportVersionId: difference.priorReportVersionId,
    priorExtractionRunId: difference.priorExtractionRunId,
    currentReportVersionId: difference.currentReportVersionId,
    currentExtractionRunId: difference.currentExtractionRunId,
    bureau: target.bureau,
    accountId: target.accountId,
    targetFieldKey: target.fieldKey,
    targetConsumerAssertionId: target.consumerAssertionId,
    targetCorrespondenceId: target.correspondenceId,
    targetCorrespondenceItemId: target.correspondenceItemId,
    targetCorrespondenceVersionId: target.correspondenceVersionId,
    targetVersionMembershipId: target.correspondenceVersionMembershipId,
    priorCompleteness: difference.priorCompleteness,
    currentCompleteness: difference.currentCompleteness,
    causalityState:
      outcomeState === "UNABLE_TO_DETERMINE"
        ? "INSUFFICIENT_EVIDENCE"
        : "TEMPORAL_ASSOCIATION_ONLY",
    outcomeSeriesKey: input.outcomeSeriesKey,
    version: input.version,
    idempotencyKey: input.idempotencyKey,
    decisionModelKey: input.decisionModelKey,
    decisionModelVersion: input.decisionModelVersion,
    sourceSetSha256: input.sourceSetSha256,
    integritySha256: input.integritySha256,
    supersedesOutcomeId: input.supersedesOutcomeId ?? null,
    reasonCodes: reasons,
  };
  if (decisionSource === "HUMAN_CONFIRMED") {
    if (
      (outcomeState !== "CORRECTED" && outcomeState !== "NEW_CONFLICT") ||
      decidedByActorId === null
    ) {
      throw new Error("human outcome source requires a confirmed correction/conflict");
    }
    return {
      ...candidateBase,
      outcomeState,
      decisionSource: "HUMAN_CONFIRMED",
      decidedByActorId,
      decidedAt,
    };
  }
  if (
    outcomeState === "CORRECTED" ||
    outcomeState === "NEW_CONFLICT"
  ) {
    throw new Error("system-derived outcome attempted a human-only/unsupported state");
  }
  return {
    ...candidateBase,
    outcomeState,
    decisionSource: "SYSTEM_DERIVED",
    decidedByActorId: null,
    decidedAt,
  };
}

export type NoncausalNarrativeRequest =
  | { kind: "CAUSALITY_NOTICE" }
  | { kind: "COMPARABLE_SCORE_CHANGE"; score: ScoreComparisonDecision }
  | {
      kind: "SAME_PERIOD_SCORE_AND_REPORT_CHANGE";
      score: ScoreComparisonDecision;
      difference: ReportDifferenceDecision;
    };

const VERIFIED_NONCAUSAL_NARRATIVE = Symbol("verified-noncausal-narrative");
const verifiedNoncausalNarratives = new WeakSet<object>();

export interface RenderedNoncausalNarrative {
  templateId:
    | "CAUSALITY_NOTICE_V1"
    | "COMPARABLE_SCORE_CHANGE_V1"
    | "SAME_PERIOD_SCORE_AND_REPORT_CHANGE_V1";
  statement: string;
  causalityState: "NO_CAUSAL_CLAIM";
  sourceObservationIds: readonly string[];
  readonly [VERIFIED_NONCAUSAL_NARRATIVE]: true;
}

function sealNoncausalNarrative(
  narrative: Omit<
    RenderedNoncausalNarrative,
    typeof VERIFIED_NONCAUSAL_NARRATIVE
  >
): RenderedNoncausalNarrative {
  const sealed: RenderedNoncausalNarrative = Object.freeze({
    ...narrative,
    sourceObservationIds: Object.freeze([...narrative.sourceObservationIds]),
    [VERIFIED_NONCAUSAL_NARRATIVE]: true as const,
  });
  verifiedNoncausalNarratives.add(sealed);
  return sealed;
}

function renderDifferenceFact(changeKind: ReportDifferenceChangeKind): string {
  if (
    !(REPORT_DIFFERENCE_CHANGE_KINDS as readonly string[]).includes(changeKind)
  ) {
    throw new Error("narrative received an unsupported report-difference kind");
  }
  const facts: Record<ReportDifferenceChangeKind, string> = {
    NEW_ITEM: "an account was newly reported",
    NO_LONGER_REPORTED: "an account was no longer reported",
    STATUS_CHANGED: "an account status changed",
    BALANCE_CHANGED: "a reported balance changed",
    PAYMENT_HISTORY_CHANGED: "reported payment history changed",
    REMARK_CHANGED: "a reported remark changed",
    DISPUTE_NOTATION_CHANGED: "a reported dispute notation changed",
    BUREAU_COVERAGE_CHANGED: "the report's bureau coverage changed",
    IDENTITY_INFORMATION_CHANGED: "reported identity information changed",
    SCORE_CHANGED: "a comparable report-derived score changed",
    OTHER_FIELD_CHANGED: "a reported field changed",
    UNCHANGED: "the compared report fact was unchanged",
    UNABLE_TO_DETERMINE: "the report change could not be determined",
  };
  return facts[changeKind];
}

function requireComparableScoreForNarrative(
  score: ScoreComparisonDecision
): asserts score is ScoreComparisonDecision & {
  priorScore: number;
  currentScore: number;
  delta: number;
  modelKey: string;
  modelVersion: string;
} {
  if (
    !score.directlyComparable ||
    score.priorScore === null ||
    score.currentScore === null ||
    score.delta === null ||
    score.modelKey === null ||
    score.modelVersion === null
  ) {
    throw new Error("narrative requires an exact directly comparable score decision");
  }
  if (
    !(["EQUIFAX", "EXPERIAN", "TRANSUNION"] as readonly string[]).includes(
      score.bureau
    ) ||
    !Number.isInteger(score.occurrence) ||
    score.occurrence < 0 ||
    !Number.isInteger(score.priorScore) ||
    !Number.isInteger(score.currentScore) ||
    !Number.isInteger(score.delta) ||
    score.currentScore - score.priorScore !== score.delta
  ) {
    throw new Error("narrative score facts failed closed-domain validation");
  }
}

export function renderNoncausalProgressNarrative(
  request: NoncausalNarrativeRequest
): RenderedNoncausalNarrative {
  if (request.kind === "CAUSALITY_NOTICE") {
    return sealNoncausalNarrative({
      templateId: "CAUSALITY_NOTICE_V1",
      statement: NO_CAUSAL_ATTRIBUTION_NOTICE,
      causalityState: "NO_CAUSAL_CLAIM",
      sourceObservationIds: [],
    });
  }
  requireComparableScoreForNarrative(request.score);
  const direction =
    request.score.delta > 0
      ? `increased by ${request.score.delta} points`
      : request.score.delta < 0
        ? `decreased by ${Math.abs(request.score.delta)} points`
        : "did not change";
  const scoreFact = `${request.score.bureau} comparable report score occurrence ${request.score.occurrence} ${direction}, from ${request.score.priorScore} to ${request.score.currentScore}.`;
  if (request.kind === "COMPARABLE_SCORE_CHANGE") {
    return sealNoncausalNarrative({
      templateId: "COMPARABLE_SCORE_CHANGE_V1",
      statement: `${scoreFact} ${NO_CAUSAL_ATTRIBUTION_NOTICE}`,
      causalityState: "NO_CAUSAL_CLAIM",
      sourceObservationIds: [
        request.score.priorObservationId,
        request.score.currentObservationId,
      ],
    });
  }
  if (
    request.difference.comparisonId !== request.score.comparisonId ||
    request.difference.tenantId !== request.score.tenantId ||
    request.difference.consumerId !== request.score.consumerId
  ) {
    throw new Error("combined narrative facts must share one exact comparison scope");
  }
  const reportFact = renderDifferenceFact(request.difference.changeKind);
  return sealNoncausalNarrative({
    templateId: "SAME_PERIOD_SCORE_AND_REPORT_CHANGE_V1",
    statement: `${scoreFact} During the same report comparison, ${reportFact}. ${NO_CAUSAL_ATTRIBUTION_NOTICE}`,
    causalityState: "NO_CAUSAL_CLAIM",
    sourceObservationIds: [
      request.score.priorObservationId,
      request.score.currentObservationId,
      request.difference.priorSourceId,
      request.difference.currentSourceId,
    ],
  });
}

export function assessCausalityStatement(
  statement: string,
  expected?: RenderedNoncausalNarrative
): {
  allowed: boolean;
  causalityState: OutcomeCausalityState;
  reasonCodes: readonly string[];
} {
  const exactRenderedMatch =
    expected?.[VERIFIED_NONCAUSAL_NARRATIVE] === true &&
    verifiedNoncausalNarratives.has(expected) &&
    expected.statement === statement;
  if (statement === NO_CAUSAL_ATTRIBUTION_NOTICE || exactRenderedMatch) {
    return {
      allowed: true,
      causalityState: "NO_CAUSAL_CLAIM",
      reasonCodes: [],
    };
  }
  return {
    allowed: false,
    causalityState: "INSUFFICIENT_EVIDENCE",
    reasonCodes: ["UNRECOGNIZED_NONCAUSAL_TEMPLATE"],
  };
}

function increment<T extends string>(
  record: Partial<Record<T, number>>,
  key: T
): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function buildProgressProjection(input: {
  context: ReportComparisonContext;
  differences: readonly ReportDifferenceDecision[];
  scoreComparisons: readonly ScoreComparisonDecision[];
  outcomes: readonly DisputeOutcomeCandidate[];
}): ProgressProjection {
  const bureauMap = new Map<Bureau, BureauProgressProjection>();
  const forBureau = (bureau: Bureau): BureauProgressProjection => {
    const existing = bureauMap.get(bureau);
    if (existing) return existing;
    const created: BureauProgressProjection = {
      bureau,
      directlyComparableScores: [],
      changeCounts: {},
      outcomeCounts: {},
    };
    bureauMap.set(bureau, created);
    return created;
  };

  for (const difference of input.differences) {
    requireScope(input.context, difference, "progress difference");
    if (difference.comparisonId !== input.context.comparisonId) {
      throw new Error("progress projection cannot mix comparison snapshots");
    }
    if (difference.bureau) {
      increment(forBureau(difference.bureau).changeCounts, difference.changeKind);
    }
  }
  const scoreSlots = new Set<string>();
  for (const comparison of input.scoreComparisons) {
    requireScope(input.context, comparison, "score progress");
    if (comparison.comparisonId !== input.context.comparisonId) {
      throw new Error("progress projection cannot mix score comparison snapshots");
    }
    if (
      comparison.directlyComparable &&
      comparison.priorScore !== null &&
      comparison.currentScore !== null &&
      comparison.delta !== null &&
      comparison.modelKey !== null &&
      comparison.modelVersion !== null
    ) {
      const slot = `${comparison.bureau}:${comparison.occurrence}`;
      if (scoreSlots.has(slot)) {
        throw new Error(
          "progress projection received duplicate comparable score occurrence"
        );
      }
      scoreSlots.add(slot);
      const bureauProjection = forBureau(comparison.bureau);
      bureauProjection.directlyComparableScores = [
        ...bureauProjection.directlyComparableScores,
        {
          occurrence: comparison.occurrence,
          priorObservationId: comparison.priorObservationId,
          currentObservationId: comparison.currentObservationId,
          prior: comparison.priorScore,
          current: comparison.currentScore,
          delta: comparison.delta,
          modelKey: comparison.modelKey,
          modelVersion: comparison.modelVersion,
        },
      ];
    }
  }
  for (const outcome of input.outcomes) {
    requireScope(input.context, outcome, "progress outcome");
    if (outcome.comparisonId !== input.context.comparisonId) {
      throw new Error("progress projection cannot mix outcome comparison snapshots");
    }
    increment(forBureau(outcome.bureau).outcomeCounts, outcome.outcomeState);
  }

  return {
    tenantId: input.context.tenantId,
    consumerId: input.context.consumerId,
    comparisonId: input.context.comparisonId,
    priorReportVersionId: input.context.prior.reportVersionId,
    priorExtractionRunId: input.context.prior.extractionRunId,
    currentReportVersionId: input.context.current.reportVersionId,
    currentExtractionRunId: input.context.current.extractionRunId,
    bureaus: [...bureauMap.values()]
      .map((bureau) => ({
        ...bureau,
        directlyComparableScores: [...bureau.directlyComparableScores].sort(
          (a, b) =>
            a.occurrence - b.occurrence ||
            a.modelKey.localeCompare(b.modelKey) ||
            a.priorObservationId.localeCompare(b.priorObservationId)
        ),
      }))
      .sort((a, b) => a.bureau.localeCompare(b.bureau)),
    causalityState: "NO_CAUSAL_CLAIM",
    causalityNotice: NO_CAUSAL_ATTRIBUTION_NOTICE,
  };
}
