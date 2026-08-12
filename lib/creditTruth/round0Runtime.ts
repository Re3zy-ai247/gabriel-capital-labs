import type { Bureau } from "@prisma/client";
import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import {
  ROUND0_FACT_CLASSIFICATIONS,
  ROUND0_IDENTITY_REVIEW_CATEGORIES,
  buildAccountSetNotApplicableCategoryCompletion,
  buildIdentityCorrespondenceAssertionDraft,
  buildNotApplicableCategoryCompletion,
  computeRound0SemanticSha256,
  durableIdentityCategoryCompletionFromDraft,
  durableIdentityCorrespondenceAssertionFromDraft,
  isValidConfirmedRound0FactSourceContext,
  isValidDurableIdentityCategoryCompletionRecord,
  isValidDurableIdentityCorrespondenceAssertionRecord,
  isValidRound0FactSourceContext,
  verifyRound0CompleteSourceAbsence,
  type IdentityCategoryCompletionDraft,
  type IdentityCorrespondencePurposeCode,
  type DurableIdentityCategoryCompletionRecord,
  type DurableIdentityCorrespondenceAssertionRecord,
  type ConfirmedRound0FactSourceContext,
  type Round0CompleteSourceAbsenceCandidate,
  type Round0FactClassification,
  type Round0FactSourceContext,
  type Round0SourceAbsenceVerifier,
} from "./round0";
import { isStrictIsoInstant } from "./progressIntelligence";
import {
  p0Phase2AGatePermitAuthorizes,
  type P0Phase2AGatePermit,
} from "./phase2Flags";
import {
  consumerAccountReviewReceiptMatchesSource,
  isValidConsumerAccountReviewReceipt,
  round0AccountReviewSourceFromSeal,
  type ConsumerAccountReviewReceiptRecord,
} from "./accountReview";
import {
  isValidRound0AccountSetAbsenceEvidence,
  isVerifiedRound0SourceSeal,
  round0AccountSetAbsenceEvidence,
  round0SourceSealHasCompleteCategory,
  verifyRound0AccountSetAbsence,
  type Round0AccountSetAbsenceCandidate,
  type Round0AccountSetAbsenceEvidence,
  type Round0AccountSetAbsenceVerifier,
  type VerifiedRound0SourceSeal,
} from "./round0SourceSeal";

export const ROUND0_RUNTIME_VERSION = "p0-round0-runtime-v1" as const;
export const ROUND0_CONFIRMED_BASELINE_POLICY_VERSION =
  "p0-round0-source-review-v1" as const;

export interface Round0CategorySlot {
  readonly categoryKey: string;
}

export interface Round0BaselineSourceRead {
  readonly repositoryReadId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportIngestionId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly baselineSeriesKey: string;
  readonly baselineVersion: number;
  readonly status: "DRAFT";
  readonly inputSetSha256: string;
  readonly sourceSeal: VerifiedRound0SourceSeal;
  readonly requiredCategorySlots: readonly Round0CategorySlot[];
  readonly facts: readonly Round0FactSourceContext[];
}

export interface Round0CurrentAccountReviewReceiptRead {
  readonly repositoryReadId: string;
  readonly receipt: ConsumerAccountReviewReceiptRecord;
  readonly supersededByReviewId: null;
}

/** Server-resolved, successor-free current head of one immutable series. */
export interface Round0BaselineSeriesHeadRead {
  readonly repositoryReadId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportIngestionId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly sourceIdentityBaselineId: string | null;
  readonly supersedesIdentityBaselineId: string | null;
  readonly baselineSeriesKey: string;
  readonly baselineVersion: number;
  readonly status: "DRAFT" | "CONFIRMED";
  readonly inputSetSha256: string;
  readonly semanticSha256: string | null;
  readonly expectedIdentityFactCount: number | null;
  readonly expectedCategoryCompletionCount: number | null;
  readonly expectedAccountReviewReceiptCount: number | null;
  readonly supersededByIdentityBaselineId: null;
}

/** Exact refs-only normalized child row for confirmed account-review membership. */
export interface IdentityBaselineAccountReviewMembershipRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly confirmedIdentityBaselineId: string;
  readonly confirmedIdentityBaselineVersion: number;
  readonly confirmedBaselineInputSetSha256: string;
  readonly consumerAccountReviewReceiptId: string;
  readonly reviewSeriesKey: string;
  readonly reviewVersion: number;
  readonly reviewState: ConsumerAccountReviewReceiptRecord["reviewState"];
  readonly receiptSourceSetSha256: string;
  readonly bureau: Bureau;
  readonly accountId: string;
  readonly reportVersionAccountId: string;
  readonly ordinal: number;
}

/** Exact durable IdentityBaseline persistence/readback projection. */
export interface Round0ConfirmedBaselineRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportIngestionId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly sourceIdentityBaselineId: string;
  readonly supersedesIdentityBaselineId: string;
  readonly baselineSeriesKey: string;
  readonly version: number;
  readonly status: "CONFIRMED";
  readonly policyVersion: typeof ROUND0_CONFIRMED_BASELINE_POLICY_VERSION;
  readonly inputSetSha256: string;
  readonly expectedIdentityFactCount: number;
  readonly expectedCategoryCompletionCount: number;
  readonly expectedAccountReviewReceiptCount: number;
  readonly confirmedByActorId: string;
  readonly confirmedAt: string;
  readonly createdByActorId: string;
  readonly semanticSha256: string;
}

/** Exact value-free durable IdentityFact columns used by confirmation sealing. */
export interface Round0ConfirmedIdentityFactPinRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly baselineInputSetSha256: string;
  readonly factSeriesKey: string;
  readonly factOrdinal: number;
  readonly bureau: Bureau;
  readonly classification: Round0FactClassification;
  readonly reviewCategory: string;
  readonly integritySha256: string;
  readonly presence: "PRESENT" | "UNKNOWN";
  readonly sourceLocatorToken: string;
}

export interface Round0ConfirmedBaselinePersistenceBundle {
  readonly baseline: Round0ConfirmedBaselineRecord;
  readonly identityFactPins: readonly Round0ConfirmedIdentityFactPinRecord[];
  readonly categoryCompletions: readonly DurableIdentityCategoryCompletionRecord[];
  readonly accountReviewMemberships: readonly IdentityBaselineAccountReviewMembershipRecord[];
}

export interface Round0RuntimeRepository
  extends Round0SourceAbsenceVerifier,
    Round0AccountSetAbsenceVerifier {
  readRound0Baseline(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "ROUND0_BASELINE_SOURCE_READ";
    readonly identityBaselineId: string;
  }): Promise<Round0BaselineSourceRead | null>;
  readCurrentRound0BaselineSeriesHead(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "ROUND0_CURRENT_BASELINE_HEAD_READ";
    readonly baselineSeriesKey: string;
    readonly sourceIdentityBaselineId: string;
  }): Promise<Round0BaselineSeriesHeadRead | null>;
  readCompleteCategoryAbsence(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "ROUND0_COMPLETE_CATEGORY_ABSENCE_READ";
    readonly identityBaselineId: string;
    readonly categoryKey: string;
  }): Promise<Round0CompleteSourceAbsenceCandidate | null>;
  readCompleteAccountSetAbsence(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "ROUND0_COMPLETE_ACCOUNT_SET_ABSENCE_READ";
    readonly identityBaselineId: string;
    readonly attestationId: string;
  }): Promise<Round0AccountSetAbsenceCandidate | null>;
  readCurrentConsumerAccountReviewReceipt(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "ROUND0_CURRENT_ACCOUNT_REVIEW_READ";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly reviewId: string;
  }): Promise<Round0CurrentAccountReviewReceiptRead | null>;
  appendConfirmedRound0Baseline(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "ROUND0_BASELINE_APPEND";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly sourceReadId: string;
    readonly currentHeadReadId: string;
    readonly persistence: Round0ConfirmedBaselinePersistenceBundle;
  }): Promise<{ readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY" }>;
  readConfirmedRound0Baseline(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "ROUND0_BASELINE_READBACK";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly identityBaselineId: string;
  }): Promise<Round0ConfirmedBaselinePersistenceBundle | null>;
  readIdentityFactForAssertion(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "IDENTITY_ASSERTION_SOURCE_READ";
    readonly identityBaselineId: string;
    readonly identityFactId: string;
  }): Promise<ConfirmedRound0FactSourceContext | null>;
  verifyCurrentIdentityBaselineForAssertionSource(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "IDENTITY_ASSERTION_CURRENT_BASELINE_VERIFY";
    readonly gatePermit: P0Phase2AGatePermit;
    /**
     * Must prove both that the confirmed baseline has no successor and that
     * every normalized account-review membership still resolves to its current,
     * non-REVOKED receipt head. A stale baseline remains immutable history only.
     */
    readonly source: ConfirmedRound0FactSourceContext;
  }): Promise<boolean>;
  readIdentityCorrespondenceAssertion(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose:
      | "IDENTITY_ASSERTION_SUPERSESSION_READ"
      | "IDENTITY_ASSERTION_READBACK";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly assertionId: string;
  }): Promise<DurableIdentityCorrespondenceAssertionRecord | null>;
  appendIdentityCorrespondenceAssertion(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "IDENTITY_ASSERTION_APPEND";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly assertion: DurableIdentityCorrespondenceAssertionRecord;
  }): Promise<{ readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY" }>;
}

export type ConfirmRound0BaselineResult =
  | {
      readonly ok: true;
      readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY";
      readonly baseline: Round0ConfirmedBaselineRecord;
      readonly identityFactPins: readonly Round0ConfirmedIdentityFactPinRecord[];
      readonly categoryCompletions: readonly DurableIdentityCategoryCompletionRecord[];
      readonly accountReviewMemberships: readonly IdentityBaselineAccountReviewMembershipRecord[];
    }
  | {
      readonly ok: false;
      readonly code:
        | "INVALID_PRINCIPAL_OR_SCOPE"
        | "CONSUMER_AUTHORITY_REQUIRED"
        | "GATE_DENIED"
        | "INVALID_REQUEST"
        | "SOURCE_NOT_FOUND"
        | "FACT_SET_MISMATCH"
        | "CATEGORY_COMPLETION_INVALID"
        | "ACCOUNT_REVIEW_INVALID"
        | "REPLAY_CONFLICT"
        | "READBACK_MISMATCH"
        | "OUTCOME_UNKNOWN";
    };

export type AppendIdentityAssertionResult =
  | {
      readonly ok: true;
      readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY";
      readonly assertion: DurableIdentityCorrespondenceAssertionRecord;
      readonly semanticSha256: string;
    }
  | {
      readonly ok: false;
      readonly code:
        | "INVALID_PRINCIPAL_OR_SCOPE"
        | "CONSUMER_AUTHORITY_REQUIRED"
        | "GATE_DENIED"
        | "INVALID_REQUEST"
        | "SOURCE_NOT_FOUND"
        | "STALE_SOURCE_RECONFIRMATION_REQUIRED"
        | "SUPERSESSION_MISMATCH"
        | "REPLAY_CONFLICT"
        | "READBACK_MISMATCH"
        | "OUTCOME_UNKNOWN";
    };

const SHA256 = /^[0-9a-f]{64}$/;
const MACHINE_KEY = /^[A-Z][A-Z0-9_]{0,63}$/;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validSlot(slot: unknown): slot is Round0CategorySlot {
  if (!slot || typeof slot !== "object") return false;
  const value = slot as Round0CategorySlot;
  return (
    Object.keys(value).length === 1 &&
    MACHINE_KEY.test(value.categoryKey) &&
    ROUND0_IDENTITY_REVIEW_CATEGORIES.includes(
      value.categoryKey as (typeof ROUND0_IDENTITY_REVIEW_CATEGORIES)[number],
    )
  );
}

function slotKey(slot: Round0CategorySlot): string {
  return slot.categoryKey;
}

function factSlotKey(fact: Round0FactSourceContext): string {
  return fact.categoryKey;
}

function sameFactSource(
  left: Round0FactSourceContext,
  right: Round0FactSourceContext,
  includeClassification = true,
): boolean {
  const leftSnapshot = { ...left } as Record<string, unknown>;
  const rightSnapshot = { ...right } as Record<string, unknown>;
  if (!includeClassification) {
    delete leftSnapshot.classification;
    delete rightSnapshot.classification;
    delete leftSnapshot.identityBaselineId;
    delete rightSnapshot.identityBaselineId;
    delete leftSnapshot.baselineVersion;
    delete rightSnapshot.baselineVersion;
    delete leftSnapshot.identityFactId;
    delete rightSnapshot.identityFactId;
  }
  return computeRound0SemanticSha256(leftSnapshot) === computeRound0SemanticSha256(rightSnapshot);
}

function factMatchesSourceSeal(
  fact: Round0FactSourceContext,
  seal: VerifiedRound0SourceSeal,
): boolean {
  const member = seal.identityFacts.find(
    (candidate) => candidate.identityFactId === fact.identityFactId,
  );
  return Boolean(
    member &&
      fact.baselineInputSetSha256 === seal.sourceSetSha256 &&
      member.factSeriesKey === fact.factSeriesKey &&
      member.categoryKey === fact.categoryKey &&
      member.bureau === fact.bureau &&
      member.presence === fact.presence &&
      member.sourceKind === fact.sourceKind &&
      member.classification === fact.classification &&
      member.integritySha256 === fact.integritySha256 &&
      member.sourceLocatorToken === fact.sourceLocatorToken,
  );
}

const ROUND0_HEAD_KEYS = [
  "repositoryReadId",
  "tenantId",
  "consumerId",
  "reportIngestionId",
  "reportVersionId",
  "extractionRunId",
  "identityBaselineId",
  "sourceIdentityBaselineId",
  "supersedesIdentityBaselineId",
  "baselineSeriesKey",
  "baselineVersion",
  "status",
  "inputSetSha256",
  "semanticSha256",
  "expectedIdentityFactCount",
  "expectedCategoryCompletionCount",
  "expectedAccountReviewReceiptCount",
  "supersededByIdentityBaselineId",
] as const;

function validCurrentBaselineHead(
  head: Round0BaselineSeriesHeadRead,
  source: Round0BaselineSourceRead,
  scope: P0Scope,
): boolean {
  if (
    !head ||
    !exactKeys(head, ROUND0_HEAD_KEYS) ||
    !nonEmpty(head.repositoryReadId) ||
    head.tenantId !== scope.tenantId ||
    head.consumerId !== scope.consumerId ||
    head.reportIngestionId !== source.reportIngestionId ||
    head.reportVersionId !== source.reportVersionId ||
    head.extractionRunId !== source.extractionRunId ||
    head.baselineSeriesKey !== source.baselineSeriesKey ||
    !Number.isSafeInteger(head.baselineVersion) ||
    head.baselineVersion < source.baselineVersion ||
    head.inputSetSha256 !== source.inputSetSha256 ||
    head.supersededByIdentityBaselineId !== null
  ) {
    return false;
  }
  if (head.status === "DRAFT") {
    return (
      head.identityBaselineId === source.identityBaselineId &&
      head.baselineVersion === source.baselineVersion &&
      head.sourceIdentityBaselineId === null &&
      head.supersedesIdentityBaselineId === null &&
      head.semanticSha256 === null &&
      head.expectedIdentityFactCount === null &&
      head.expectedCategoryCompletionCount === null &&
      head.expectedAccountReviewReceiptCount === null
    );
  }
  return (
    head.status === "CONFIRMED" &&
    head.identityBaselineId !== source.identityBaselineId &&
    head.sourceIdentityBaselineId === source.identityBaselineId &&
    nonEmpty(head.supersedesIdentityBaselineId) &&
    head.baselineVersion > source.baselineVersion &&
    (head.baselineVersion === 2
      ? head.supersedesIdentityBaselineId === source.identityBaselineId
      : head.supersedesIdentityBaselineId !== source.identityBaselineId) &&
    typeof head.semanticSha256 === "string" &&
    SHA256.test(head.semanticSha256) &&
    nonNegativeInteger(head.expectedIdentityFactCount) &&
    nonNegativeInteger(head.expectedCategoryCompletionCount) &&
    nonNegativeInteger(head.expectedAccountReviewReceiptCount)
  );
}

const ACCOUNT_REVIEW_MEMBERSHIP_KEYS = [
  "id",
  "tenantId",
  "consumerId",
  "reportVersionId",
  "extractionRunId",
  "confirmedIdentityBaselineId",
  "confirmedIdentityBaselineVersion",
  "confirmedBaselineInputSetSha256",
  "consumerAccountReviewReceiptId",
  "reviewSeriesKey",
  "reviewVersion",
  "reviewState",
  "receiptSourceSetSha256",
  "bureau",
  "accountId",
  "reportVersionAccountId",
  "ordinal",
] as const;

function accountReviewMembershipMatchesReceipt(
  member: IdentityBaselineAccountReviewMembershipRecord,
  baseline: Pick<
    Round0ConfirmedBaselineRecord,
    | "tenantId"
    | "consumerId"
    | "reportVersionId"
    | "extractionRunId"
    | "id"
    | "version"
    | "inputSetSha256"
  >,
  receipt: ConsumerAccountReviewReceiptRecord,
): boolean {
  return (
    exactKeys(member, ACCOUNT_REVIEW_MEMBERSHIP_KEYS) &&
    nonEmpty(member.id) &&
    member.tenantId === baseline.tenantId &&
    member.consumerId === baseline.consumerId &&
    member.reportVersionId === baseline.reportVersionId &&
    member.extractionRunId === baseline.extractionRunId &&
    member.confirmedIdentityBaselineId === baseline.id &&
    member.confirmedIdentityBaselineVersion === baseline.version &&
    member.confirmedBaselineInputSetSha256 === baseline.inputSetSha256 &&
    member.consumerAccountReviewReceiptId === receipt.id &&
    member.reviewSeriesKey === receipt.reviewSeriesKey &&
    member.reviewVersion === receipt.version &&
    member.reviewState === receipt.reviewState &&
    member.reviewState !== "REVOKED" &&
    member.receiptSourceSetSha256 === receipt.sourceSetSha256 &&
    member.bureau === receipt.bureau &&
    member.accountId === receipt.accountId &&
    member.reportVersionAccountId === receipt.reportVersionAccountId &&
    nonNegativeInteger(member.ordinal)
  );
}

function buildAccountReviewMemberships(
  baseline: Pick<
    Round0ConfirmedBaselineRecord,
    | "tenantId"
    | "consumerId"
    | "reportVersionId"
    | "extractionRunId"
    | "id"
    | "version"
    | "inputSetSha256"
  >,
  receipts: readonly ConsumerAccountReviewReceiptRecord[],
): readonly IdentityBaselineAccountReviewMembershipRecord[] {
  return Object.freeze(
    receipts.map((receipt, ordinal) => {
      const identity = computeRound0SemanticSha256({
        tenantId: baseline.tenantId,
        consumerId: baseline.consumerId,
        confirmedIdentityBaselineId: baseline.id,
        consumerAccountReviewReceiptId: receipt.id,
        reviewVersion: receipt.version,
        ordinal,
      });
      return Object.freeze({
        id: `round0_account_membership_${identity.slice(0, 40)}`,
        tenantId: baseline.tenantId,
        consumerId: baseline.consumerId,
        reportVersionId: baseline.reportVersionId,
        extractionRunId: baseline.extractionRunId,
        confirmedIdentityBaselineId: baseline.id,
        confirmedIdentityBaselineVersion: baseline.version,
        confirmedBaselineInputSetSha256: baseline.inputSetSha256,
        consumerAccountReviewReceiptId: receipt.id,
        reviewSeriesKey: receipt.reviewSeriesKey,
        reviewVersion: receipt.version,
        reviewState: receipt.reviewState,
        receiptSourceSetSha256: receipt.sourceSetSha256,
        bureau: receipt.bureau,
        accountId: receipt.accountId,
        reportVersionAccountId: receipt.reportVersionAccountId,
        ordinal,
      });
    }),
  );
}

function baselineSemanticProjection(
  bundle: Round0ConfirmedBaselinePersistenceBundle,
): unknown {
  const { semanticSha256: _semanticSha256, ...baseline } = bundle.baseline;
  return {
    baseline,
    identityFactPins: [...bundle.identityFactPins].sort(
      (left, right) => left.factOrdinal - right.factOrdinal || left.id.localeCompare(right.id),
    ),
    categoryCompletions: [...bundle.categoryCompletions].sort((left, right) =>
      left.category.localeCompare(right.category) || left.id.localeCompare(right.id),
    ),
    accountReviewMemberships: [...bundle.accountReviewMemberships].sort(
      (left, right) => left.ordinal - right.ordinal || left.id.localeCompare(right.id),
    ),
  };
}

function freezeBaseline(
  baseline: Round0ConfirmedBaselineRecord,
): Round0ConfirmedBaselineRecord {
  return Object.freeze({ ...baseline });
}

const CONFIRMED_BASELINE_KEYS = [
  "id",
  "tenantId",
  "consumerId",
  "reportIngestionId",
  "reportVersionId",
  "extractionRunId",
  "sourceIdentityBaselineId",
  "supersedesIdentityBaselineId",
  "baselineSeriesKey",
  "version",
  "status",
  "policyVersion",
  "inputSetSha256",
  "expectedIdentityFactCount",
  "expectedCategoryCompletionCount",
  "expectedAccountReviewReceiptCount",
  "confirmedByActorId",
  "confirmedAt",
  "createdByActorId",
  "semanticSha256",
] as const;

const CONFIRMED_IDENTITY_FACT_PIN_KEYS = [
  "id",
  "tenantId",
  "consumerId",
  "reportVersionId",
  "extractionRunId",
  "identityBaselineId",
  "baselineInputSetSha256",
  "factSeriesKey",
  "factOrdinal",
  "bureau",
  "classification",
  "reviewCategory",
  "integritySha256",
  "presence",
  "sourceLocatorToken",
] as const;

function validConfirmedBaselineRecord(
  baseline: unknown,
): baseline is Round0ConfirmedBaselineRecord {
  if (!baseline || typeof baseline !== "object") return false;
  const value = baseline as Round0ConfirmedBaselineRecord;
  return (
    exactKeys(value, CONFIRMED_BASELINE_KEYS) &&
    nonEmpty(value.id) &&
    nonEmpty(value.tenantId) &&
    nonEmpty(value.consumerId) &&
    nonEmpty(value.reportIngestionId) &&
    nonEmpty(value.reportVersionId) &&
    nonEmpty(value.extractionRunId) &&
    nonEmpty(value.sourceIdentityBaselineId) &&
    nonEmpty(value.supersedesIdentityBaselineId) &&
    value.id !== value.sourceIdentityBaselineId &&
    value.id !== value.supersedesIdentityBaselineId &&
    nonEmpty(value.baselineSeriesKey) &&
    Number.isSafeInteger(value.version) &&
    value.version >= 2 &&
    value.status === "CONFIRMED" &&
    value.policyVersion === ROUND0_CONFIRMED_BASELINE_POLICY_VERSION &&
    SHA256.test(value.inputSetSha256) &&
    nonNegativeInteger(value.expectedIdentityFactCount) &&
    nonNegativeInteger(value.expectedCategoryCompletionCount) &&
    nonNegativeInteger(value.expectedAccountReviewReceiptCount) &&
    nonEmpty(value.confirmedByActorId) &&
    isStrictIsoInstant(value.confirmedAt) &&
    nonEmpty(value.createdByActorId) &&
    SHA256.test(value.semanticSha256)
  );
}

function validConfirmedIdentityFactPin(
  value: unknown,
  baseline: Round0ConfirmedBaselineRecord,
): value is Round0ConfirmedIdentityFactPinRecord {
  if (!value || typeof value !== "object") return false;
  const pin = value as Round0ConfirmedIdentityFactPinRecord;
  return (
    exactKeys(pin, CONFIRMED_IDENTITY_FACT_PIN_KEYS) &&
    nonEmpty(pin.id) &&
    pin.tenantId === baseline.tenantId &&
    pin.consumerId === baseline.consumerId &&
    pin.reportVersionId === baseline.reportVersionId &&
    pin.extractionRunId === baseline.extractionRunId &&
    pin.identityBaselineId === baseline.id &&
    pin.baselineInputSetSha256 === baseline.inputSetSha256 &&
    nonEmpty(pin.factSeriesKey) &&
    nonNegativeInteger(pin.factOrdinal) &&
    (pin.bureau === "EQUIFAX" ||
      pin.bureau === "EXPERIAN" ||
      pin.bureau === "TRANSUNION") &&
    ROUND0_FACT_CLASSIFICATIONS.includes(pin.classification) &&
    validSlot({ categoryKey: pin.reviewCategory }) &&
    SHA256.test(pin.integritySha256) &&
    (pin.presence === "PRESENT" || pin.presence === "UNKNOWN") &&
    (pin.presence !== "UNKNOWN" || pin.classification === "REVIEW_NEEDED") &&
    nonEmpty(pin.sourceLocatorToken)
  );
}

function validAccountReviewMembership(
  value: unknown,
  baseline: Round0ConfirmedBaselineRecord,
): value is IdentityBaselineAccountReviewMembershipRecord {
  if (!value || typeof value !== "object") return false;
  const member = value as IdentityBaselineAccountReviewMembershipRecord;
  return (
    exactKeys(member, ACCOUNT_REVIEW_MEMBERSHIP_KEYS) &&
    nonEmpty(member.id) &&
    member.tenantId === baseline.tenantId &&
    member.consumerId === baseline.consumerId &&
    member.reportVersionId === baseline.reportVersionId &&
    member.extractionRunId === baseline.extractionRunId &&
    member.confirmedIdentityBaselineId === baseline.id &&
    member.confirmedIdentityBaselineVersion === baseline.version &&
    member.confirmedBaselineInputSetSha256 === baseline.inputSetSha256 &&
    nonEmpty(member.consumerAccountReviewReceiptId) &&
    nonEmpty(member.reviewSeriesKey) &&
    Number.isSafeInteger(member.reviewVersion) &&
    member.reviewVersion > 0 &&
    member.reviewState !== "REVOKED" &&
    SHA256.test(member.receiptSourceSetSha256) &&
    (member.bureau === "EQUIFAX" ||
      member.bureau === "EXPERIAN" ||
      member.bureau === "TRANSUNION") &&
    nonEmpty(member.accountId) &&
    nonEmpty(member.reportVersionAccountId) &&
    nonNegativeInteger(member.ordinal)
  );
}

function validConfirmedBaselinePersistenceBundle(
  value: unknown,
): value is Round0ConfirmedBaselinePersistenceBundle {
  if (!value || typeof value !== "object") return false;
  const bundle = value as Round0ConfirmedBaselinePersistenceBundle;
  if (
    !exactKeys(bundle, [
      "baseline",
      "identityFactPins",
      "categoryCompletions",
      "accountReviewMemberships",
    ]) ||
    !validConfirmedBaselineRecord(bundle.baseline) ||
    !Array.isArray(bundle.identityFactPins) ||
    !Array.isArray(bundle.categoryCompletions) ||
    !Array.isArray(bundle.accountReviewMemberships) ||
    bundle.baseline.expectedIdentityFactCount !== bundle.identityFactPins.length ||
    bundle.baseline.expectedCategoryCompletionCount !==
      bundle.categoryCompletions.length ||
    bundle.baseline.expectedAccountReviewReceiptCount !==
      bundle.accountReviewMemberships.length
  ) {
    return false;
  }
  if (
    bundle.identityFactPins.some(
      (pin) => !validConfirmedIdentityFactPin(pin, bundle.baseline),
    ) ||
    new Set(bundle.identityFactPins.map((pin) => pin.id)).size !==
      bundle.identityFactPins.length ||
    new Set(bundle.identityFactPins.map((pin) => pin.factSeriesKey)).size !==
      bundle.identityFactPins.length ||
    bundle.identityFactPins.some((pin, index) => pin.factOrdinal !== index) ||
    bundle.categoryCompletions.some(
      (completion) =>
        !isValidDurableIdentityCategoryCompletionRecord(completion) ||
        completion.tenantId !== bundle.baseline.tenantId ||
        completion.consumerId !== bundle.baseline.consumerId ||
        completion.reportVersionId !== bundle.baseline.reportVersionId ||
        completion.extractionRunId !== bundle.baseline.extractionRunId ||
        completion.identityBaselineId !== bundle.baseline.id ||
        completion.identityBaselineVersion !== bundle.baseline.version ||
        completion.baselineInputSetSha256 !== bundle.baseline.inputSetSha256,
    ) ||
    new Set(bundle.categoryCompletions.map((completion) => completion.id)).size !==
      bundle.categoryCompletions.length ||
    new Set(bundle.categoryCompletions.map((completion) => completion.category)).size !==
      bundle.categoryCompletions.length ||
    new Set(bundle.accountReviewMemberships.map((member) => member.id)).size !==
      bundle.accountReviewMemberships.length ||
    new Set(
      bundle.accountReviewMemberships.map(
        (member) => member.consumerAccountReviewReceiptId,
      ),
    ).size !== bundle.accountReviewMemberships.length ||
    bundle.accountReviewMemberships.some(
      (member, index) =>
        member.ordinal !== index ||
        !validAccountReviewMembership(member, bundle.baseline),
    )
  ) {
    return false;
  }
  return (
    computeRound0SemanticSha256(baselineSemanticProjection(bundle)) ===
    bundle.baseline.semanticSha256
  );
}

function freezePersistenceBundle(
  bundle: Round0ConfirmedBaselinePersistenceBundle,
): Round0ConfirmedBaselinePersistenceBundle {
  return Object.freeze({
    baseline: freezeBaseline(bundle.baseline),
    identityFactPins: Object.freeze(
      bundle.identityFactPins.map((pin) => Object.freeze({ ...pin })),
    ),
    categoryCompletions: Object.freeze(
      bundle.categoryCompletions.map((completion) =>
        Object.freeze({ ...completion }),
      ),
    ),
    accountReviewMemberships: Object.freeze(
      bundle.accountReviewMemberships.map((member) =>
        Object.freeze({ ...member }),
      ),
    ),
  });
}

function validBaselineSource(
  source: Round0BaselineSourceRead,
  scope: P0Scope,
): boolean {
  const seal = source.sourceSeal;
  return (
    Object.keys(source).length === 14 &&
    nonEmpty(source.repositoryReadId) &&
    isVerifiedRound0SourceSeal(seal) &&
    seal.repositoryReadId === source.repositoryReadId &&
    source.tenantId === scope.tenantId &&
    source.consumerId === scope.consumerId &&
    seal.tenantId === source.tenantId &&
    seal.consumerId === source.consumerId &&
    nonEmpty(source.reportIngestionId) &&
    seal.reportIngestionId === source.reportIngestionId &&
    nonEmpty(source.reportVersionId) &&
    seal.reportVersionId === source.reportVersionId &&
    nonEmpty(source.extractionRunId) &&
    seal.extractionRunId === source.extractionRunId &&
    nonEmpty(source.identityBaselineId) &&
    seal.identityBaselineId === source.identityBaselineId &&
    nonEmpty(source.baselineSeriesKey) &&
    seal.baselineSeriesKey === source.baselineSeriesKey &&
    Number.isSafeInteger(source.baselineVersion) &&
    source.baselineVersion === 1 &&
    seal.baselineVersion === source.baselineVersion &&
    source.status === "DRAFT" &&
    SHA256.test(source.inputSetSha256) &&
    source.inputSetSha256 === seal.sourceSetSha256 &&
    round0SourceSealHasCompleteCategory(
      seal,
      "UNRECOGNIZED_ACCOUNT",
    ) &&
    Array.isArray(source.requiredCategorySlots) &&
    source.requiredCategorySlots.every(validSlot) &&
    new Set(source.requiredCategorySlots.map(slotKey)).size ===
      source.requiredCategorySlots.length &&
    source.requiredCategorySlots.length ===
      ROUND0_IDENTITY_REVIEW_CATEGORIES.length &&
    ROUND0_IDENTITY_REVIEW_CATEGORIES.every((categoryKey) =>
      source.requiredCategorySlots.some(
        (slot) => slot.categoryKey === categoryKey,
      ),
    ) &&
    Array.isArray(source.facts) &&
    source.facts.length === seal.expectedIdentityFactCount &&
    new Set(source.facts.map((fact) => fact.identityFactId)).size ===
      source.facts.length &&
    source.facts.every(
      (fact) =>
        isValidRound0FactSourceContext(fact) &&
        fact.tenantId === source.tenantId &&
        fact.consumerId === source.consumerId &&
        fact.reportVersionId === source.reportVersionId &&
        fact.extractionRunId === source.extractionRunId &&
        fact.identityBaselineId === source.identityBaselineId &&
        fact.baselineSeriesKey === source.baselineSeriesKey &&
        fact.baselineVersion === source.baselineVersion &&
        factMatchesSourceSeal(fact, seal),
    )
  );
}

export async function confirmRound0Baseline(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly gatePermit: P0Phase2AGatePermit;
  readonly repository: Round0RuntimeRepository;
  readonly request: {
    readonly operationId: string;
    readonly sourceIdentityBaselineId: string;
    readonly supersedesIdentityBaselineId: string;
    readonly identityBaselineId: string;
    readonly baselineVersion: number;
    readonly factDecisions: readonly {
      readonly sourceIdentityFactId: string;
      readonly identityFactId: string;
      readonly classification: Round0FactClassification;
    }[];
    readonly notApplicableCompletions: readonly {
      readonly categoryKey: string;
      readonly completionId: string;
      readonly categorySeriesKey: string;
      readonly version: number;
      readonly supersedesCompletionId?: string | null;
    }[];
    /** Selectors only; the repository must return exact current-head receipts. */
    readonly accountReviewReceiptIds: readonly string[];
    /** Required only when the exact sealed source account membership is empty. */
    readonly accountSetAbsenceAttestationId: string | null;
  };
}): Promise<ConfirmRound0BaselineResult> {
  const { principal, scope, repository, request } = input;
  if (
    validateP0Principal(principal).length > 0 ||
    !p0PrincipalAuthorizesScope(principal, scope)
  ) {
    return { ok: false, code: "INVALID_PRINCIPAL_OR_SCOPE" };
  }
  if (principal.authorizationKind !== "DIRECT_CONSUMER") {
    return { ok: false, code: "CONSUMER_AUTHORITY_REQUIRED" };
  }
  if (
    !p0Phase2AGatePermitAuthorizes({
      permit: input.gatePermit,
      principal,
      scope,
      stage: "ROUND0_REVIEW",
      mode: input.gatePermit.mode,
      operationId: request.operationId,
    })
  ) {
    return { ok: false, code: "GATE_DENIED" };
  }
  if (
    !nonEmpty(request.operationId) ||
    !nonEmpty(request.sourceIdentityBaselineId) ||
    !nonEmpty(request.supersedesIdentityBaselineId) ||
    !nonEmpty(request.identityBaselineId) ||
    request.sourceIdentityBaselineId === request.identityBaselineId ||
    request.supersedesIdentityBaselineId === request.identityBaselineId ||
    !Number.isSafeInteger(request.baselineVersion) ||
    request.baselineVersion < 2 ||
    !Array.isArray(request.factDecisions) ||
    !Array.isArray(request.notApplicableCompletions) ||
    !Array.isArray(request.accountReviewReceiptIds) ||
    (request.accountSetAbsenceAttestationId !== null &&
      !nonEmpty(request.accountSetAbsenceAttestationId))
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }

  try {
    const source = await repository.readRound0Baseline({
      principal,
      scope,
      purpose: "ROUND0_BASELINE_SOURCE_READ",
      identityBaselineId: request.sourceIdentityBaselineId,
    });
    if (!source) return { ok: false, code: "SOURCE_NOT_FOUND" };
    if (
      !validBaselineSource(source, scope) ||
      source.identityBaselineId !== request.sourceIdentityBaselineId
    ) {
      return { ok: false, code: "INVALID_REQUEST" };
    }
    const currentHead = await repository.readCurrentRound0BaselineSeriesHead({
      principal,
      scope,
      purpose: "ROUND0_CURRENT_BASELINE_HEAD_READ",
      baselineSeriesKey: source.baselineSeriesKey,
      sourceIdentityBaselineId: source.identityBaselineId,
    });
    if (!currentHead) return { ok: false, code: "SOURCE_NOT_FOUND" };
    if (
      !validCurrentBaselineHead(currentHead, source, scope) ||
      currentHead.identityBaselineId !==
        request.supersedesIdentityBaselineId ||
      request.baselineVersion !== currentHead.baselineVersion + 1
    ) {
      return { ok: false, code: "INVALID_REQUEST" };
    }

    const decisionBySource = new Map(
      request.factDecisions.map((decision) => [decision.sourceIdentityFactId, decision]),
    );
    const sourceFactById = new Map(
      source.facts.map((fact) => [fact.identityFactId, fact]),
    );
    if (
      decisionBySource.size !== request.factDecisions.length ||
      request.factDecisions.length !== source.facts.length ||
      request.factDecisions.some(
        (decision) => {
          const sourceFact = sourceFactById.get(decision.sourceIdentityFactId);
          return (
          !nonEmpty(decision.sourceIdentityFactId) ||
          !nonEmpty(decision.identityFactId) ||
          !ROUND0_FACT_CLASSIFICATIONS.includes(decision.classification) ||
          !sourceFact ||
          (sourceFact.presence === "UNKNOWN" &&
            decision.classification !== "REVIEW_NEEDED")
          );
        },
      ) ||
      new Set(request.factDecisions.map((decision) => decision.identityFactId)).size !==
        request.factDecisions.length
    ) {
      return { ok: false, code: "FACT_SET_MISMATCH" };
    }
    const targetFacts: Round0ConfirmedIdentityFactPinRecord[] = source.facts.map((fact) => {
      const decision = decisionBySource.get(fact.identityFactId);
      if (!decision) throw new Error("missing exact fact decision");
      const sealedFact = source.sourceSeal.identityFacts.find(
        (member) => member.identityFactId === fact.identityFactId,
      );
      if (!sealedFact) throw new Error("missing exact sealed fact member");
      return Object.freeze({
        id: decision.identityFactId,
        tenantId: scope.tenantId,
        consumerId: scope.consumerId,
        reportVersionId: source.reportVersionId,
        extractionRunId: source.extractionRunId,
        identityBaselineId: request.identityBaselineId,
        baselineInputSetSha256: source.inputSetSha256,
        factSeriesKey: fact.factSeriesKey,
        factOrdinal: sealedFact.factOrdinal,
        bureau: fact.bureau,
        classification: decision.classification,
        reviewCategory: fact.categoryKey,
        integritySha256: fact.integritySha256,
        presence: fact.presence,
        sourceLocatorToken: fact.sourceLocatorToken,
      });
    });

    const requestedReviewIds = request.accountReviewReceiptIds;
    if (
      new Set(requestedReviewIds).size !== requestedReviewIds.length ||
      requestedReviewIds.some((reviewId) => !nonEmpty(reviewId))
    ) {
      return { ok: false, code: "ACCOUNT_REVIEW_INVALID" };
    }
    const sealedAccountMembers = source.sourceSeal.accountMembers;
    const accountReviewReceipts: ConsumerAccountReviewReceiptRecord[] = [];
    let accountSetAbsence: Round0AccountSetAbsenceEvidence | null = null;
    let accountSetCompletion: IdentityCategoryCompletionDraft | null = null;
    if (sealedAccountMembers.length > 0) {
      if (
        request.accountSetAbsenceAttestationId !== null ||
        requestedReviewIds.length !== sealedAccountMembers.length
      ) {
        return { ok: false, code: "ACCOUNT_REVIEW_INVALID" };
      }
      for (const reviewId of requestedReviewIds) {
        const current = await repository.readCurrentConsumerAccountReviewReceipt({
          principal,
          scope,
          purpose: "ROUND0_CURRENT_ACCOUNT_REVIEW_READ",
          gatePermit: input.gatePermit,
          reviewId,
        });
        if (
          !current ||
          Object.keys(current).length !== 3 ||
          !nonEmpty(current.repositoryReadId) ||
          current.supersededByReviewId !== null ||
          current.receipt.id !== reviewId ||
          !isValidConsumerAccountReviewReceipt(current.receipt) ||
          current.receipt.reviewState === "REVOKED"
        ) {
          return { ok: false, code: "ACCOUNT_REVIEW_INVALID" };
        }
        const exactSource = round0AccountReviewSourceFromSeal({
          seal: source.sourceSeal,
          reportVersionAccountId: current.receipt.reportVersionAccountId,
          bureau: current.receipt.bureau,
        });
        if (
          !exactSource ||
          !consumerAccountReviewReceiptMatchesSource(
            current.receipt,
            exactSource,
          )
        ) {
          return { ok: false, code: "ACCOUNT_REVIEW_INVALID" };
        }
        accountReviewReceipts.push(Object.freeze({ ...current.receipt }));
      }
      const receiptMembership = accountReviewReceipts.map(
        (receipt) => `${receipt.reportVersionAccountId}:${receipt.bureau}`,
      );
      const sourceMembership = sealedAccountMembers.map(
        (member) => `${member.reportAccountId}:${member.bureau}`,
      );
      if (
        new Set(receiptMembership).size !== receiptMembership.length ||
        receiptMembership.length !== sourceMembership.length ||
        receiptMembership.some((identity) => !sourceMembership.includes(identity))
      ) {
        return { ok: false, code: "ACCOUNT_REVIEW_INVALID" };
      }
    } else {
      if (
        requestedReviewIds.length !== 0 ||
        !request.accountSetAbsenceAttestationId
      ) {
        return { ok: false, code: "ACCOUNT_REVIEW_INVALID" };
      }
      const absenceCandidate = await repository.readCompleteAccountSetAbsence({
        principal,
        scope,
        purpose: "ROUND0_COMPLETE_ACCOUNT_SET_ABSENCE_READ",
        identityBaselineId: source.identityBaselineId,
        attestationId: request.accountSetAbsenceAttestationId,
      });
      if (
        !absenceCandidate ||
        absenceCandidate.attestationId !==
          request.accountSetAbsenceAttestationId
      ) {
        return { ok: false, code: "ACCOUNT_REVIEW_INVALID" };
      }
      const verifiedAccountSetAbsence = await verifyRound0AccountSetAbsence(
        absenceCandidate,
        source.sourceSeal,
        repository,
      );
      if (!verifiedAccountSetAbsence) {
        return { ok: false, code: "ACCOUNT_REVIEW_INVALID" };
      }
      accountSetAbsence = round0AccountSetAbsenceEvidence(
        verifiedAccountSetAbsence,
      );
      if (!isValidRound0AccountSetAbsenceEvidence(accountSetAbsence)) {
        return { ok: false, code: "ACCOUNT_REVIEW_INVALID" };
      }
      accountSetCompletion = buildAccountSetNotApplicableCategoryCompletion({
        verifiedAbsence: verifiedAccountSetAbsence,
        targetIdentityBaselineId: request.identityBaselineId,
        targetBaselineVersion: request.baselineVersion,
        operationId: request.operationId,
        actorId: principal.actorId,
        completedAt: input.gatePermit.issuedAt,
      });
    }

    const factSlots = new Set(source.facts.map(factSlotKey));
    const completionBySlot = new Map(
      request.notApplicableCompletions.map((completion) => [
        slotKey(completion),
        completion,
      ]),
    );
    if (
      completionBySlot.size !== request.notApplicableCompletions.length ||
      request.notApplicableCompletions.some(
        (completion) =>
          !validSlot({ categoryKey: completion.categoryKey }) ||
          !nonEmpty(completion.completionId) ||
          !nonEmpty(completion.categorySeriesKey) ||
          !Number.isSafeInteger(completion.version) ||
          completion.version < 1 ||
          (completion.version === 1 && completion.supersedesCompletionId != null) ||
          (completion.version > 1 && !nonEmpty(completion.supersedesCompletionId)) ||
          factSlots.has(slotKey(completion)),
      )
    ) {
      return { ok: false, code: "CATEGORY_COMPLETION_INVALID" };
    }
    for (const required of source.requiredCategorySlots) {
      const key = slotKey(required);
      if (!factSlots.has(key) && !completionBySlot.has(key)) {
        return { ok: false, code: "CATEGORY_COMPLETION_INVALID" };
      }
    }

    const completions: IdentityCategoryCompletionDraft[] = [];
    for (const completion of request.notApplicableCompletions) {
      const absenceCandidate = await repository.readCompleteCategoryAbsence({
        principal,
        scope,
        purpose: "ROUND0_COMPLETE_CATEGORY_ABSENCE_READ",
        identityBaselineId: source.identityBaselineId,
        categoryKey: completion.categoryKey,
      });
      if (
        !absenceCandidate ||
        absenceCandidate.tenantId !== scope.tenantId ||
        absenceCandidate.consumerId !== scope.consumerId ||
        absenceCandidate.reportVersionId !== source.reportVersionId ||
        absenceCandidate.extractionRunId !== source.extractionRunId ||
        absenceCandidate.identityBaselineId !== source.identityBaselineId ||
        absenceCandidate.baselineSeriesKey !== source.baselineSeriesKey ||
        absenceCandidate.baselineVersion !== source.baselineVersion ||
        absenceCandidate.baselineInputSetSha256 !== source.inputSetSha256 ||
        absenceCandidate.categoryKey !== completion.categoryKey ||
        absenceCandidate.matchingFactIds.length !== 0 ||
        absenceCandidate.sourceSetSha256 !== source.inputSetSha256
      ) {
        return { ok: false, code: "CATEGORY_COMPLETION_INVALID" };
      }
      const verifiedAbsence = await verifyRound0CompleteSourceAbsence(
        absenceCandidate,
        source.sourceSeal,
        repository,
      );
      if (!verifiedAbsence) {
        return { ok: false, code: "CATEGORY_COMPLETION_INVALID" };
      }
      completions.push(
        buildNotApplicableCategoryCompletion({
          verifiedAbsence,
          completionId: completion.completionId,
          operationId: request.operationId,
          categorySeriesKey: completion.categorySeriesKey,
          targetIdentityBaselineId: request.identityBaselineId,
          targetBaselineSeriesKey: source.baselineSeriesKey,
          targetBaselineVersion: request.baselineVersion,
          version: completion.version,
          supersedesCompletionId: completion.supersedesCompletionId,
          actorId: principal.actorId,
          completedAt: input.gatePermit.issuedAt,
        }),
      );
    }
    if (accountSetCompletion) completions.push(accountSetCompletion);

    const durableCompletions = Object.freeze(
      completions.map((completion) =>
        durableIdentityCategoryCompletionFromDraft(completion),
      ),
    );
    const withoutDigest: Omit<Round0ConfirmedBaselineRecord, "semanticSha256"> = {
      id: request.identityBaselineId,
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      reportIngestionId: source.reportIngestionId,
      reportVersionId: source.reportVersionId,
      extractionRunId: source.extractionRunId,
      sourceIdentityBaselineId: source.identityBaselineId,
      supersedesIdentityBaselineId: currentHead.identityBaselineId,
      baselineSeriesKey: source.baselineSeriesKey,
      version: request.baselineVersion,
      status: "CONFIRMED" as const,
      policyVersion: ROUND0_CONFIRMED_BASELINE_POLICY_VERSION,
      inputSetSha256: source.inputSetSha256,
      expectedIdentityFactCount: targetFacts.length,
      expectedCategoryCompletionCount: durableCompletions.length,
      expectedAccountReviewReceiptCount: accountReviewReceipts.length,
      confirmedByActorId: principal.actorId,
      confirmedAt: input.gatePermit.issuedAt,
      createdByActorId: principal.actorId,
    };
    const sortedAccountReviewReceipts = Object.freeze(
      accountReviewReceipts.sort(
        (left, right) =>
          left.reportVersionAccountId.localeCompare(
            right.reportVersionAccountId,
          ) ||
          left.bureau.localeCompare(right.bureau) ||
          left.id.localeCompare(right.id),
      ),
    );
    const accountReviewMemberships = buildAccountReviewMemberships(
      withoutDigest,
      sortedAccountReviewReceipts,
    );
    const preimageBundle: Round0ConfirmedBaselinePersistenceBundle = {
      baseline: { ...withoutDigest, semanticSha256: "0".repeat(64) },
      identityFactPins: Object.freeze(targetFacts),
      categoryCompletions: durableCompletions,
      accountReviewMemberships,
    };
    const expectedBundle = freezePersistenceBundle({
      ...preimageBundle,
      baseline: {
        ...withoutDigest,
        semanticSha256: computeRound0SemanticSha256(
          baselineSemanticProjection(preimageBundle),
        ),
      },
    });
    if (!validConfirmedBaselinePersistenceBundle(expectedBundle)) {
      return { ok: false, code: "INVALID_REQUEST" };
    }
    const write = await repository.appendConfirmedRound0Baseline({
      principal,
      scope,
      purpose: "ROUND0_BASELINE_APPEND",
      gatePermit: input.gatePermit,
      sourceReadId: source.repositoryReadId,
      currentHeadReadId: currentHead.repositoryReadId,
      persistence: expectedBundle,
    });
    if (
      write.disposition !== "CREATED" &&
      write.disposition !== "IDEMPOTENT_REPLAY"
    ) {
      return { ok: false, code: "OUTCOME_UNKNOWN" };
    }
    const readback = await repository.readConfirmedRound0Baseline({
      principal,
      scope,
      purpose: "ROUND0_BASELINE_READBACK",
      gatePermit: input.gatePermit,
      identityBaselineId: expectedBundle.baseline.id,
    });
    if (
      !readback ||
      !validConfirmedBaselinePersistenceBundle(readback) ||
      computeRound0SemanticSha256(readback) !==
        computeRound0SemanticSha256(expectedBundle) ||
      readback.baseline.semanticSha256 !== expectedBundle.baseline.semanticSha256
    ) {
      return {
        ok: false,
        code:
          write.disposition === "IDEMPOTENT_REPLAY"
            ? "REPLAY_CONFLICT"
            : "READBACK_MISMATCH",
      };
    }
    return Object.freeze({
      ok: true,
      disposition: write.disposition,
      baseline: freezeBaseline(readback.baseline),
      identityFactPins: Object.freeze(
        readback.identityFactPins.map((pin) => Object.freeze({ ...pin })),
      ),
      categoryCompletions: Object.freeze(
        readback.categoryCompletions.map((completion) =>
          Object.freeze({ ...completion }),
        ),
      ),
      accountReviewMemberships: Object.freeze(
        readback.accountReviewMemberships.map((member) =>
          Object.freeze({ ...member }),
        ),
      ),
    });
  } catch {
    return { ok: false, code: "OUTCOME_UNKNOWN" };
  }
}

function exactIdentityAssertion(
  left: DurableIdentityCorrespondenceAssertionRecord,
  right: DurableIdentityCorrespondenceAssertionRecord,
): boolean {
  return (
    isValidDurableIdentityCorrespondenceAssertionRecord(left) &&
    isValidDurableIdentityCorrespondenceAssertionRecord(right) &&
    computeRound0SemanticSha256(left) === computeRound0SemanticSha256(right)
  );
}

export async function appendIdentityCorrespondenceAssertion(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly gatePermit: P0Phase2AGatePermit;
  readonly repository: Round0RuntimeRepository;
  readonly request: {
    readonly expectedSource: ConfirmedRound0FactSourceContext;
    readonly assertionId: string;
    readonly operationId: string;
    readonly purposeCode: IdentityCorrespondencePurposeCode;
    readonly receiptState?: "ATTESTED" | "REVOKED";
    readonly assertionSeriesKey: string;
    readonly version: number;
    readonly supersedesAssertionId?: string | null;
  };
}): Promise<AppendIdentityAssertionResult> {
  const { principal, scope, repository, request } = input;
  if (
    validateP0Principal(principal).length > 0 ||
    !p0PrincipalAuthorizesScope(principal, scope)
  ) {
    return { ok: false, code: "INVALID_PRINCIPAL_OR_SCOPE" };
  }
  if (principal.authorizationKind !== "DIRECT_CONSUMER") {
    return { ok: false, code: "CONSUMER_AUTHORITY_REQUIRED" };
  }
  if (
    !p0Phase2AGatePermitAuthorizes({
      permit: input.gatePermit,
      principal,
      scope,
      stage: "ASSERTION_RUNTIME",
      mode: input.gatePermit.mode,
      operationId: request.operationId,
    })
  ) {
    return { ok: false, code: "GATE_DENIED" };
  }
  if (
    !isValidConfirmedRound0FactSourceContext(request.expectedSource) ||
    request.expectedSource.tenantId !== scope.tenantId ||
    request.expectedSource.consumerId !== scope.consumerId ||
    request.expectedSource.baselineStatus !== "CONFIRMED"
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  try {
    const source = await repository.readIdentityFactForAssertion({
      principal,
      scope,
      purpose: "IDENTITY_ASSERTION_SOURCE_READ",
      identityBaselineId: request.expectedSource.identityBaselineId,
      identityFactId: request.expectedSource.identityFactId,
    });
    if (!source) return { ok: false, code: "SOURCE_NOT_FOUND" };
    if (
      source.baselineStatus !== "CONFIRMED" ||
      !sameFactSource(source, request.expectedSource)
    ) {
      return { ok: false, code: "STALE_SOURCE_RECONFIRMATION_REQUIRED" };
    }
    if (
      !(await repository.verifyCurrentIdentityBaselineForAssertionSource({
        principal,
        scope,
        purpose: "IDENTITY_ASSERTION_CURRENT_BASELINE_VERIFY",
        gatePermit: input.gatePermit,
        source,
      }))
    ) {
      return { ok: false, code: "STALE_SOURCE_RECONFIRMATION_REQUIRED" };
    }
    const assertionDraft = buildIdentityCorrespondenceAssertionDraft({
      source,
      assertionId: request.assertionId,
      operationId: request.operationId,
      purposeCode: request.purposeCode,
      receiptState: request.receiptState,
      assertionSeriesKey: request.assertionSeriesKey,
      version: request.version,
      supersedesAssertionId: request.supersedesAssertionId,
      actorId: principal.actorId,
      assertedAt: input.gatePermit.issuedAt,
    });
    const assertion =
      durableIdentityCorrespondenceAssertionFromDraft(assertionDraft);
    const prior = request.supersedesAssertionId
      ? await repository.readIdentityCorrespondenceAssertion({
          principal,
          scope,
          purpose: "IDENTITY_ASSERTION_SUPERSESSION_READ",
          gatePermit: input.gatePermit,
          assertionId: request.supersedesAssertionId,
        })
      : null;
    if (
      (assertion.version === 1 && prior !== null) ||
      (assertion.version > 1 &&
        (!prior ||
          !isValidDurableIdentityCorrespondenceAssertionRecord(prior) ||
          prior.status === "REVOKED" ||
          prior.id !== assertion.supersedesAssertionId ||
          prior.assertionSeriesKey !== assertion.assertionSeriesKey ||
          prior.sourceSeriesKey !== assertion.sourceSeriesKey ||
          prior.version + 1 !== assertion.version ||
          prior.tenantId !== assertion.tenantId ||
          prior.consumerId !== assertion.consumerId ||
          prior.reportVersionId !== assertion.reportVersionId ||
          prior.extractionRunId !== assertion.extractionRunId ||
          prior.identityBaselineId !== assertion.identityBaselineId ||
          prior.identityBaselineVersion !== assertion.identityBaselineVersion ||
          prior.baselineInputSetSha256 !== assertion.baselineInputSetSha256 ||
          prior.identityFactId !== assertion.identityFactId ||
          prior.identityFactSeriesKey !== assertion.identityFactSeriesKey ||
          prior.identityFactClassification !==
            assertion.identityFactClassification ||
          prior.factBureau !== assertion.factBureau ||
          prior.factSourceLocatorToken !== assertion.factSourceLocatorToken ||
          prior.identityFactIntegritySha256 !==
            assertion.identityFactIntegritySha256 ||
          prior.sourceSetSha256 !== assertion.sourceSetSha256 ||
          prior.correspondencePurposeCode !==
            assertion.correspondencePurposeCode))
    ) {
      return { ok: false, code: "SUPERSESSION_MISMATCH" };
    }
    const write = await repository.appendIdentityCorrespondenceAssertion({
      principal,
      scope,
      purpose: "IDENTITY_ASSERTION_APPEND",
      gatePermit: input.gatePermit,
      assertion,
    });
    if (
      write.disposition !== "CREATED" &&
      write.disposition !== "IDEMPOTENT_REPLAY"
    ) {
      return { ok: false, code: "OUTCOME_UNKNOWN" };
    }
    const readback = await repository.readIdentityCorrespondenceAssertion({
      principal,
      scope,
      purpose: "IDENTITY_ASSERTION_READBACK",
      gatePermit: input.gatePermit,
      assertionId: assertion.id,
    });
    if (!readback || !exactIdentityAssertion(assertion, readback)) {
      return {
        ok: false,
        code:
          write.disposition === "IDEMPOTENT_REPLAY"
            ? "REPLAY_CONFLICT"
            : "READBACK_MISMATCH",
      };
    }
    return Object.freeze({
      ok: true,
      disposition: write.disposition,
      assertion: Object.freeze({ ...readback }),
      semanticSha256: computeRound0SemanticSha256(readback),
    });
  } catch {
    return { ok: false, code: "OUTCOME_UNKNOWN" };
  }
}

export function identityAssertionCarriesCompetingDisposition(
  assertion: DurableIdentityCorrespondenceAssertionRecord | object,
): boolean {
  const keys = Object.keys(assertion).map((key) => key.toLowerCase());
  return keys.includes("classification") || keys.includes("disposition");
}
