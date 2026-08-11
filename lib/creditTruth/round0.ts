import { createHash } from "node:crypto";
import type { Bureau } from "@prisma/client";
import { isStrictIsoInstant } from "./progressIntelligence";
import {
  ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION,
  ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS,
  computeRound0CompletenessSetSha256,
  isVerifiedRound0AccountSetAbsence,
  isVerifiedRound0SourceSeal,
  round0SourceCompletenessSet,
  round0SourceSealHasCompleteCategory,
  type Round0SourceCompletenessEvidenceRef,
  type VerifiedRound0SourceSeal,
  type VerifiedRound0AccountSetAbsence,
} from "./round0SourceSeal";

/**
 * Pure Phase 2A Round 0 contracts.
 *
 * This module never reads request state, decrypts a value, or writes a row. It
 * accepts only value-free, repository-resolved identities. Consumer-visible
 * values remain behind the authenticated repository boundary.
 */
export const ROUND0_CONTRACT_VERSION = "p0-round0-v1" as const;
export const ROUND0_IDENTITY_CATEGORY_COMPLETENESS_RULE_VERSION =
  "p0-round0-category-absence-v1" as const;

export const ROUND0_FACT_CLASSIFICATIONS = [
  "CORRECT_CURRENT",
  "CORRECT_FORMER",
  "INCORRECT",
  "NEVER_MINE",
  "OUTDATED_UPDATE_REQUESTED",
  "REVIEW_NEEDED",
] as const;

export type Round0FactClassification =
  (typeof ROUND0_FACT_CLASSIFICATIONS)[number];

export type Round0FactDispositionProjection =
  | "CONFIRMED"
  | "DISPUTED"
  | "UNKNOWN";

// Account recognition is deliberately not an IdentityFact category. It has a
// distinct consumer-only receipt contract in accountReview.ts.
export const ROUND0_IDENTITY_REVIEW_CATEGORIES =
  ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS;
export type Round0IdentityReviewCategory =
  (typeof ROUND0_IDENTITY_REVIEW_CATEGORIES)[number];

export const IDENTITY_CORRESPONDENCE_PURPOSE_CODES = [
  "CORRESPONDENCE_SENDER_IDENTITY",
  "CORRESPONDENCE_IDENTITY_CORRECTION",
] as const;
export type IdentityCorrespondencePurposeCode =
  (typeof IDENTITY_CORRESPONDENCE_PURPOSE_CODES)[number];

export interface Round0FactSourceContext {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly baselineSeriesKey: string;
  readonly baselineVersion: number;
  readonly baselineInputSetSha256: string;
  readonly identityFactId: string;
  readonly factSeriesKey: string;
  readonly categoryKey: string;
  readonly bureau: Bureau;
  readonly sourceLocatorToken: string;
  readonly integritySha256: string;
  readonly presence: "PRESENT" | "UNKNOWN";
  readonly sourceKind: "SOURCE_REPORTED" | "PARSER_UNCERTAINTY";
  readonly classification: Round0FactClassification;
}

export interface ConfirmedRound0FactSourceContext
  extends Round0FactSourceContext {
  /** Exact original immutable DRAFT baseline from which this confirmation was made. */
  readonly sourceIdentityBaselineId: string;
  readonly baselineStatus: "CONFIRMED";
}

export interface Round0FactReviewProjection {
  readonly source: Round0FactSourceContext;
  readonly disposition: Round0FactDispositionProjection;
  readonly selectedClassification: null;
  readonly consumerDecisionRequired: boolean;
  readonly systemObservationIsConsumerTestimony: false;
}

export interface Round0CompleteSourceAbsenceCandidate {
  readonly contractVersion: typeof ROUND0_CONTRACT_VERSION;
  readonly attestationId: string;
  readonly repositoryReadId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly baselineSeriesKey: string;
  readonly baselineVersion: number;
  readonly baselineInputSetSha256: string;
  readonly categoryKey: string;
  readonly expectedCompletenessEvidenceCount: 3;
  readonly completenessEvidence: readonly Round0SourceCompletenessEvidenceRef[];
  readonly sourceCompletenessSha256: string;
  readonly matchingFactIds: readonly string[];
  readonly sourceSetSha256: string;
  readonly observedAt: string;
}

export interface Round0SourceAbsenceVerifier {
  verifyCompleteSourceAbsence(input: {
    readonly candidate: Round0CompleteSourceAbsenceCandidate;
    readonly semanticSha256: string;
    readonly sourceSealSha256: string;
  }): Promise<boolean>;
}

const VERIFIED_COMPLETE_SOURCE_ABSENCE = Symbol(
  "verified-round0-complete-source-absence",
);
const verifiedAbsenceIdentities = new WeakSet<object>();
const verifiedAbsenceDigests = new WeakMap<object, string>();

export interface VerifiedRound0CompleteSourceAbsence
  extends Round0CompleteSourceAbsenceCandidate {
  readonly semanticSha256: string;
  readonly [VERIFIED_COMPLETE_SOURCE_ABSENCE]: true;
}

export interface IdentityCategoryCompletionDraft {
  readonly contractVersion: typeof ROUND0_CONTRACT_VERSION;
  readonly completionId: string;
  readonly operationId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly sourceIdentityBaselineId: string;
  readonly baselineSeriesKey: string;
  readonly baselineVersion: number;
  readonly baselineInputSetSha256: string;
  readonly categoryKey: string;
  readonly completion: "NOT_APPLICABLE";
  readonly identityFactId: null;
  readonly absenceAttestationId: string;
  readonly absenceAttestationSha256: string;
  readonly sourceCompletenessRuleVersion: string;
  readonly sourceCompletenessEvidenceCount: 3;
  readonly equifaxSourceCompletenessEvidenceId: string;
  readonly experianSourceCompletenessEvidenceId: string;
  readonly transunionSourceCompletenessEvidenceId: string;
  readonly sourceCompletenessSha256: string;
  readonly categorySeriesKey: string;
  readonly version: number;
  readonly supersedesCompletionId: string | null;
  readonly completedByActorId: string;
  readonly completedAt: string;
}

const IDENTITY_CATEGORY_COMPLETION_DRAFT_KEYS = [
  "contractVersion",
  "completionId",
  "operationId",
  "tenantId",
  "consumerId",
  "reportVersionId",
  "extractionRunId",
  "identityBaselineId",
  "sourceIdentityBaselineId",
  "baselineSeriesKey",
  "baselineVersion",
  "baselineInputSetSha256",
  "categoryKey",
  "completion",
  "identityFactId",
  "absenceAttestationId",
  "absenceAttestationSha256",
  "sourceCompletenessRuleVersion",
  "sourceCompletenessEvidenceCount",
  "equifaxSourceCompletenessEvidenceId",
  "experianSourceCompletenessEvidenceId",
  "transunionSourceCompletenessEvidenceId",
  "sourceCompletenessSha256",
  "categorySeriesKey",
  "version",
  "supersedesCompletionId",
  "completedByActorId",
  "completedAt",
] as const;

const mintedCategoryCompletionDrafts = new WeakSet<object>();
const mintedCategoryCompletionDigests = new WeakMap<object, string>();

/** Exact persistence projection for the additive Prisma model. */
export interface DurableIdentityCategoryCompletionRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly identityBaselineVersion: number;
  readonly baselineInputSetSha256: string;
  readonly category: Round0IdentityReviewCategory | "UNRECOGNIZED_ACCOUNT";
  readonly disposition: "NOT_APPLICABLE";
  readonly sourceCompletenessSha256: string;
  readonly sourceCompletenessAttestationKey: string;
  readonly sourceCompletenessRuleVersion: string;
  readonly sourceCompletenessEvidenceCount: 3;
  readonly equifaxSourceCompletenessEvidenceId: string;
  readonly experianSourceCompletenessEvidenceId: string;
  readonly transunionSourceCompletenessEvidenceId: string;
  readonly completedByActorId: string;
  readonly completedAt: string;
}

const DURABLE_IDENTITY_CATEGORY_COMPLETION_KEYS = [
  "id",
  "tenantId",
  "consumerId",
  "reportVersionId",
  "extractionRunId",
  "identityBaselineId",
  "identityBaselineVersion",
  "baselineInputSetSha256",
  "category",
  "disposition",
  "sourceCompletenessSha256",
  "sourceCompletenessAttestationKey",
  "sourceCompletenessRuleVersion",
  "sourceCompletenessEvidenceCount",
  "equifaxSourceCompletenessEvidenceId",
  "experianSourceCompletenessEvidenceId",
  "transunionSourceCompletenessEvidenceId",
  "completedByActorId",
  "completedAt",
] as const;

export interface IdentityCorrespondenceAssertionDraft {
  readonly contractVersion: typeof ROUND0_CONTRACT_VERSION;
  readonly assertionId: string;
  readonly operationId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly sourceIdentityBaselineId: string;
  readonly identityBaselineId: string;
  readonly baselineSeriesKey: string;
  readonly baselineVersion: number;
  readonly baselineInputSetSha256: string;
  readonly identityFactId: string;
  readonly factSeriesKey: string;
  readonly identityFactClassification: Round0FactClassification;
  readonly categoryKey: string;
  readonly bureau: Bureau | null;
  readonly sourceLocatorToken: string;
  readonly sourceIntegritySha256: string;
  readonly sourceSetSha256: string;
  readonly purposeCode: IdentityCorrespondencePurposeCode;
  readonly receiptState: "ATTESTED" | "REVOKED";
  readonly sourceSeriesKey: string;
  readonly assertionSeriesKey: string;
  readonly version: number;
  readonly supersedesAssertionId: string | null;
  readonly assertedByActorId: string;
  readonly assertedAt: string;
}

/** Exact persistence/readback projection for IdentityCorrespondenceAssertion. */
export interface DurableIdentityCorrespondenceAssertionRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly identityBaselineVersion: number;
  readonly baselineInputSetSha256: string;
  readonly identityFactSeriesKey: string;
  readonly identityFactId: string;
  readonly identityFactClassification: Round0FactClassification;
  readonly identityFactIntegritySha256: string;
  readonly factBureau: Bureau | null;
  readonly factSourceLocatorToken: string;
  readonly correspondencePurposeCode: IdentityCorrespondencePurposeCode;
  readonly sourceSeriesKey: string;
  readonly assertionSeriesKey: string;
  readonly version: number;
  readonly status: "ATTESTED" | "REVOKED";
  readonly sourceSetSha256: string;
  readonly attestedByActorId: string;
  readonly attestedAt: string;
  readonly supersedesAssertionId: string | null;
}

const mintedIdentityAssertionDrafts = new WeakSet<object>();
const mintedIdentityAssertionDigests = new WeakMap<object, string>();

const SHA256 = /^[0-9a-f]{64}$/;
const MACHINE_KEY = /^[A-Z][A-Z0-9_]{0,63}$/;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

const ROUND0_FACT_SOURCE_KEYS = [
  "tenantId",
  "consumerId",
  "reportVersionId",
  "extractionRunId",
  "identityBaselineId",
  "baselineSeriesKey",
  "baselineVersion",
  "baselineInputSetSha256",
  "identityFactId",
  "factSeriesKey",
  "categoryKey",
  "bureau",
  "sourceLocatorToken",
  "integritySha256",
  "presence",
  "sourceKind",
  "classification",
] as const;

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function mintIdentityCategoryCompletionDraft(
  value: IdentityCategoryCompletionDraft,
): IdentityCategoryCompletionDraft {
  const draft = Object.freeze(value);
  mintedCategoryCompletionDrafts.add(draft);
  mintedCategoryCompletionDigests.set(
    draft,
    computeRound0SemanticSha256(draft),
  );
  return draft;
}

function isMintedIdentityCategoryCompletionDraft(
  value: unknown,
): value is IdentityCategoryCompletionDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as IdentityCategoryCompletionDraft;
  const accountCategory = draft.categoryKey === "UNRECOGNIZED_ACCOUNT";
  try {
    return (
      exactKeys(draft, IDENTITY_CATEGORY_COMPLETION_DRAFT_KEYS) &&
      mintedCategoryCompletionDrafts.has(draft) &&
      mintedCategoryCompletionDigests.get(draft) ===
        computeRound0SemanticSha256(draft) &&
      draft.contractVersion === ROUND0_CONTRACT_VERSION &&
      nonEmpty(draft.completionId) &&
      nonEmpty(draft.operationId) &&
      nonEmpty(draft.tenantId) &&
      nonEmpty(draft.consumerId) &&
      nonEmpty(draft.reportVersionId) &&
      nonEmpty(draft.extractionRunId) &&
      nonEmpty(draft.identityBaselineId) &&
      nonEmpty(draft.sourceIdentityBaselineId) &&
      nonEmpty(draft.baselineSeriesKey) &&
      positiveInteger(draft.baselineVersion) &&
      SHA256.test(draft.baselineInputSetSha256) &&
      (validCategoryKey(draft.categoryKey) || accountCategory) &&
      draft.completion === "NOT_APPLICABLE" &&
      draft.identityFactId === null &&
      nonEmpty(draft.absenceAttestationId) &&
      SHA256.test(draft.absenceAttestationSha256) &&
      draft.sourceCompletenessRuleVersion ===
        (accountCategory
          ? ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION
          : ROUND0_IDENTITY_CATEGORY_COMPLETENESS_RULE_VERSION) &&
      draft.sourceCompletenessEvidenceCount === 3 &&
      nonEmpty(draft.equifaxSourceCompletenessEvidenceId) &&
      nonEmpty(draft.experianSourceCompletenessEvidenceId) &&
      nonEmpty(draft.transunionSourceCompletenessEvidenceId) &&
      SHA256.test(draft.sourceCompletenessSha256) &&
      nonEmpty(draft.categorySeriesKey) &&
      positiveInteger(draft.version) &&
      ((draft.version === 1 && draft.supersedesCompletionId === null) ||
        (draft.version > 1 && nonEmpty(draft.supersedesCompletionId))) &&
      nonEmpty(draft.completedByActorId) &&
      isStrictIsoInstant(draft.completedAt)
    );
  } catch {
    return false;
  }
}

function validCategoryKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    MACHINE_KEY.test(value) &&
    ROUND0_IDENTITY_REVIEW_CATEGORIES.includes(
      value as Round0IdentityReviewCategory,
    )
  );
}

function validBureau(value: unknown): value is Bureau {
  return (
    value === "EQUIFAX" ||
    value === "EXPERIAN" ||
    value === "TRANSUNION"
  );
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite semantic value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value !== "object") throw new Error("non-JSON semantic value");
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

export function computeRound0SemanticSha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function freezeAbsenceCandidate(
  candidate: Round0CompleteSourceAbsenceCandidate,
): Round0CompleteSourceAbsenceCandidate {
  return Object.freeze({
    ...candidate,
    completenessEvidence: Object.freeze(
      candidate.completenessEvidence.map((member) =>
        Object.freeze({ ...member }),
      ),
    ),
    matchingFactIds: Object.freeze([...candidate.matchingFactIds]),
  });
}

function completenessEvidenceIds(
  evidence: readonly Round0SourceCompletenessEvidenceRef[],
): {
  readonly equifaxSourceCompletenessEvidenceId: string;
  readonly experianSourceCompletenessEvidenceId: string;
  readonly transunionSourceCompletenessEvidenceId: string;
} {
  const byBureau = new Map(evidence.map((member) => [member.bureau, member]));
  const equifax = byBureau.get("EQUIFAX");
  const experian = byBureau.get("EXPERIAN");
  const transunion = byBureau.get("TRANSUNION");
  if (!equifax || !experian || !transunion || byBureau.size !== 3) {
    throw new Error("incomplete three-bureau source completeness evidence");
  }
  return {
    equifaxSourceCompletenessEvidenceId: equifax.id,
    experianSourceCompletenessEvidenceId: experian.id,
    transunionSourceCompletenessEvidenceId: transunion.id,
  };
}

export function buildAccountSetNotApplicableCategoryCompletion(input: {
  readonly verifiedAbsence: VerifiedRound0AccountSetAbsence;
  readonly targetIdentityBaselineId: string;
  readonly targetBaselineVersion: number;
  readonly operationId: string;
  readonly actorId: string;
  readonly completedAt: string;
}): IdentityCategoryCompletionDraft {
  const absence = input.verifiedAbsence;
  if (
    !isVerifiedRound0AccountSetAbsence(absence) ||
    !nonEmpty(input.targetIdentityBaselineId) ||
    !positiveInteger(input.targetBaselineVersion) ||
    !nonEmpty(input.operationId) ||
    !nonEmpty(input.actorId) ||
    !isStrictIsoInstant(input.completedAt)
  ) {
    throw new Error("invalid verified account-set completion source");
  }
  const completionIdentity = computeRound0SemanticSha256({
    absenceSemanticSha256: absence.semanticSha256,
    targetIdentityBaselineId: input.targetIdentityBaselineId,
    targetBaselineVersion: input.targetBaselineVersion,
  });
  const digestPrefix = completionIdentity.slice(0, 40);
  const evidenceIds = completenessEvidenceIds(absence.completenessEvidence);
  return mintIdentityCategoryCompletionDraft({
    contractVersion: ROUND0_CONTRACT_VERSION,
    completionId: `round0_account_absence_${digestPrefix}`,
    operationId: input.operationId,
    tenantId: absence.tenantId,
    consumerId: absence.consumerId,
    reportVersionId: absence.reportVersionId,
    extractionRunId: absence.extractionRunId,
    identityBaselineId: input.targetIdentityBaselineId,
    sourceIdentityBaselineId: absence.identityBaselineId,
    baselineSeriesKey: absence.baselineSeriesKey,
    baselineVersion: input.targetBaselineVersion,
    baselineInputSetSha256: absence.sourceSetSha256,
    categoryKey: "UNRECOGNIZED_ACCOUNT",
    completion: "NOT_APPLICABLE",
    identityFactId: null,
    absenceAttestationId: absence.attestationId,
    absenceAttestationSha256: absence.semanticSha256,
    sourceCompletenessRuleVersion:
      ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION,
    sourceCompletenessEvidenceCount: 3,
    ...evidenceIds,
    sourceCompletenessSha256: absence.sourceCompletenessSha256,
    categorySeriesKey: `round0_account_absence_series_${completionIdentity.slice(0, 40)}`,
    version: 1,
    supersedesCompletionId: null,
    completedByActorId: input.actorId,
    completedAt: input.completedAt,
  });
}

export function isValidRound0FactSourceContext(
  source: unknown,
): source is Round0FactSourceContext {
  if (!source || typeof source !== "object") return false;
  const value = source as Round0FactSourceContext;
  return (
    exactKeys(value, ROUND0_FACT_SOURCE_KEYS) &&
    nonEmpty(value.tenantId) &&
    nonEmpty(value.consumerId) &&
    nonEmpty(value.reportVersionId) &&
    nonEmpty(value.extractionRunId) &&
    nonEmpty(value.identityBaselineId) &&
    nonEmpty(value.baselineSeriesKey) &&
    positiveInteger(value.baselineVersion) &&
    SHA256.test(value.baselineInputSetSha256) &&
    nonEmpty(value.identityFactId) &&
    nonEmpty(value.factSeriesKey) &&
    validCategoryKey(value.categoryKey) &&
    validBureau(value.bureau) &&
    nonEmpty(value.sourceLocatorToken) &&
    SHA256.test(value.integritySha256) &&
    ((value.presence === "PRESENT" && value.sourceKind === "SOURCE_REPORTED") ||
      (value.presence === "UNKNOWN" &&
        value.sourceKind === "PARSER_UNCERTAINTY" &&
        value.classification === "REVIEW_NEEDED")) &&
    ROUND0_FACT_CLASSIFICATIONS.includes(value.classification)
  );
}

function factSourceProjection(
  source: Round0FactSourceContext,
): Round0FactSourceContext {
  return {
    tenantId: source.tenantId,
    consumerId: source.consumerId,
    reportVersionId: source.reportVersionId,
    extractionRunId: source.extractionRunId,
    identityBaselineId: source.identityBaselineId,
    baselineSeriesKey: source.baselineSeriesKey,
    baselineVersion: source.baselineVersion,
    baselineInputSetSha256: source.baselineInputSetSha256,
    identityFactId: source.identityFactId,
    factSeriesKey: source.factSeriesKey,
    categoryKey: source.categoryKey,
    bureau: source.bureau,
    sourceLocatorToken: source.sourceLocatorToken,
    integritySha256: source.integritySha256,
    presence: source.presence,
    sourceKind: source.sourceKind,
    classification: source.classification,
  };
}

export function isValidConfirmedRound0FactSourceContext(
  source: unknown,
): source is ConfirmedRound0FactSourceContext {
  if (!source || typeof source !== "object") return false;
  const value = source as ConfirmedRound0FactSourceContext;
  return (
    exactKeys(value, [
      ...ROUND0_FACT_SOURCE_KEYS,
      "sourceIdentityBaselineId",
      "baselineStatus",
    ]) &&
    nonEmpty(value.sourceIdentityBaselineId) &&
    value.sourceIdentityBaselineId !== value.identityBaselineId &&
    value.baselineStatus === "CONFIRMED" &&
    isValidRound0FactSourceContext(factSourceProjection(value))
  );
}

function identityAssertionSourceSetProjection(input: {
  readonly source: ConfirmedRound0FactSourceContext;
  readonly purposeCode: IdentityCorrespondencePurposeCode;
}): unknown {
  const { source } = input;
  return {
    tenantId: source.tenantId,
    consumerId: source.consumerId,
    reportVersionId: source.reportVersionId,
    extractionRunId: source.extractionRunId,
    sourceIdentityBaselineId: source.sourceIdentityBaselineId,
    identityBaselineId: source.identityBaselineId,
    identityBaselineVersion: source.baselineVersion,
    baselineInputSetSha256: source.baselineInputSetSha256,
    identityFactSeriesKey: source.factSeriesKey,
    identityFactId: source.identityFactId,
    identityFactClassification: source.classification,
    identityFactIntegritySha256: source.integritySha256,
    factBureau: source.bureau,
    factSourceLocatorToken: source.sourceLocatorToken,
    correspondencePurposeCode: input.purposeCode,
  };
}

export function computeIdentityCorrespondenceAssertionSourceSeriesKey(input: {
  readonly source: ConfirmedRound0FactSourceContext;
  readonly purposeCode: IdentityCorrespondencePurposeCode;
}): string {
  if (
    !isValidConfirmedRound0FactSourceContext(input.source) ||
    !IDENTITY_CORRESPONDENCE_PURPOSE_CODES.includes(input.purposeCode)
  ) {
    throw new Error("invalid identity assertion source-series input");
  }
  return computeRound0SemanticSha256(
    identityAssertionSourceSetProjection(input),
  );
}

export function computeIdentityCorrespondenceAssertionSeriesKey(
  sourceSeriesKey: string,
): string {
  if (!SHA256.test(sourceSeriesKey)) {
    throw new Error("invalid identity assertion source-series key");
  }
  return `identity_assertion_${sourceSeriesKey.slice(0, 40)}`;
}

export function projectRound0FactDisposition(
  classification: Round0FactClassification,
): Round0FactDispositionProjection {
  switch (classification) {
    case "CORRECT_CURRENT":
    case "CORRECT_FORMER":
      return "CONFIRMED";
    case "INCORRECT":
    case "NEVER_MINE":
    case "OUTDATED_UPDATE_REQUESTED":
      return "DISPUTED";
    case "REVIEW_NEEDED":
      return "UNKNOWN";
  }
}

/** A review projection is always neutral and can never contain a preselection. */
export function buildRound0FactReviewProjection(
  source: Round0FactSourceContext,
): Round0FactReviewProjection {
  if (!isValidRound0FactSourceContext(source)) {
    throw new Error("invalid source-reported Round 0 fact context");
  }
  return Object.freeze({
    source: Object.freeze(factSourceProjection(source)),
    disposition:
      source.presence === "PRESENT"
        ? projectRound0FactDisposition(source.classification)
        : "UNKNOWN",
    selectedClassification: null,
    consumerDecisionRequired: source.presence === "PRESENT",
    systemObservationIsConsumerTestimony: false,
  });
}

function validAbsenceCandidate(
  candidate: Round0CompleteSourceAbsenceCandidate,
): boolean {
  const keys = [
    "contractVersion",
    "attestationId",
    "repositoryReadId",
    "tenantId",
    "consumerId",
    "reportVersionId",
    "extractionRunId",
    "identityBaselineId",
    "baselineSeriesKey",
    "baselineVersion",
    "baselineInputSetSha256",
    "categoryKey",
    "expectedCompletenessEvidenceCount",
    "completenessEvidence",
    "sourceCompletenessSha256",
    "matchingFactIds",
    "sourceSetSha256",
    "observedAt",
  ] as const;
  const exactCandidate = exactKeys(candidate, keys);
  const exactVerified =
    verifiedAbsenceIdentities.has(candidate) &&
    exactKeys(candidate, [...keys, "semanticSha256"]);
  return (
    (exactCandidate || exactVerified) &&
    candidate.contractVersion === ROUND0_CONTRACT_VERSION &&
    nonEmpty(candidate.attestationId) &&
    nonEmpty(candidate.repositoryReadId) &&
    nonEmpty(candidate.tenantId) &&
    nonEmpty(candidate.consumerId) &&
    nonEmpty(candidate.reportVersionId) &&
    nonEmpty(candidate.extractionRunId) &&
    nonEmpty(candidate.identityBaselineId) &&
    nonEmpty(candidate.baselineSeriesKey) &&
    positiveInteger(candidate.baselineVersion) &&
    SHA256.test(candidate.baselineInputSetSha256) &&
    candidate.baselineInputSetSha256 === candidate.sourceSetSha256 &&
    validCategoryKey(candidate.categoryKey) &&
    candidate.expectedCompletenessEvidenceCount === 3 &&
    Array.isArray(candidate.completenessEvidence) &&
    candidate.completenessEvidence.length === 3 &&
    candidate.completenessEvidence.every(
      (member) => member.category === candidate.categoryKey,
    ) &&
    SHA256.test(candidate.sourceCompletenessSha256) &&
    computeRound0CompletenessSetSha256(candidate.completenessEvidence) ===
      candidate.sourceCompletenessSha256 &&
    Array.isArray(candidate.matchingFactIds) &&
    candidate.matchingFactIds.length === 0 &&
    SHA256.test(candidate.sourceSetSha256) &&
    isStrictIsoInstant(candidate.observedAt)
  );
}

/**
 * Mints absence authority only after an authenticated repository verifies an
 * exact COMPLETE source read and proves that the matching fact set is empty.
 * Parser silence, a partial section, and an uncovered bureau cannot mint it.
 */
export async function verifyRound0CompleteSourceAbsence(
  candidate: Round0CompleteSourceAbsenceCandidate,
  sourceSeal: VerifiedRound0SourceSeal,
  verifier: Round0SourceAbsenceVerifier,
): Promise<VerifiedRound0CompleteSourceAbsence | null> {
  if (
    !validAbsenceCandidate(candidate) ||
    !isVerifiedRound0SourceSeal(sourceSeal) ||
    candidate.tenantId !== sourceSeal.tenantId ||
    candidate.consumerId !== sourceSeal.consumerId ||
    candidate.reportVersionId !== sourceSeal.reportVersionId ||
    candidate.extractionRunId !== sourceSeal.extractionRunId ||
    candidate.identityBaselineId !== sourceSeal.identityBaselineId ||
    candidate.baselineSeriesKey !== sourceSeal.baselineSeriesKey ||
    candidate.baselineVersion !== sourceSeal.baselineVersion ||
    candidate.sourceSetSha256 !== sourceSeal.sourceSetSha256 ||
    !round0SourceSealHasCompleteCategory(
      sourceSeal,
      candidate.categoryKey as Round0IdentityReviewCategory,
    ) ||
    sourceSeal.identityFacts.some(
      (fact) => fact.categoryKey === candidate.categoryKey,
    ) ||
    computeRound0SemanticSha256(candidate.completenessEvidence) !==
      computeRound0SemanticSha256(
        round0SourceCompletenessSet(
          sourceSeal,
          candidate.categoryKey as Round0IdentityReviewCategory,
        ),
      ) ||
    !verifier?.verifyCompleteSourceAbsence
  ) {
    return null;
  }
  const snapshot = freezeAbsenceCandidate(candidate);
  const semanticSha256 = computeRound0SemanticSha256(snapshot);
  let approved = false;
  try {
    approved = await verifier.verifyCompleteSourceAbsence({
      candidate: snapshot,
      semanticSha256,
      sourceSealSha256: sourceSeal.sourceSetSha256,
    });
  } catch {
    return null;
  }
  if (!approved) {
    return null;
  }
  const verified = { ...snapshot, semanticSha256 } as VerifiedRound0CompleteSourceAbsence;
  Object.defineProperty(verified, VERIFIED_COMPLETE_SOURCE_ABSENCE, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedAbsenceIdentities.add(verified);
  verifiedAbsenceDigests.set(verified, semanticSha256);
  return Object.freeze(verified);
}

function validVerifiedAbsence(
  value: VerifiedRound0CompleteSourceAbsence,
): boolean {
  return (
    value?.[VERIFIED_COMPLETE_SOURCE_ABSENCE] === true &&
    verifiedAbsenceIdentities.has(value) &&
    verifiedAbsenceDigests.get(value) === value.semanticSha256 &&
    validAbsenceCandidate(value) &&
    computeRound0SemanticSha256(
      Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== "semanticSha256"),
      ),
    ) === value.semanticSha256
  );
}

export function buildNotApplicableCategoryCompletion(input: {
  readonly verifiedAbsence: VerifiedRound0CompleteSourceAbsence;
  readonly completionId: string;
  readonly operationId: string;
  readonly categorySeriesKey: string;
  readonly targetIdentityBaselineId?: string;
  readonly targetBaselineSeriesKey?: string;
  readonly targetBaselineVersion?: number;
  readonly version: number;
  readonly supersedesCompletionId?: string | null;
  readonly actorId: string;
  readonly completedAt: string;
}): IdentityCategoryCompletionDraft {
  const absence = input.verifiedAbsence;
  if (!validVerifiedAbsence(absence)) {
    throw new Error("NOT_APPLICABLE requires verified complete source absence");
  }
  const evidenceIds = completenessEvidenceIds(absence.completenessEvidence);
  if (
    !nonEmpty(input.completionId) ||
    !nonEmpty(input.operationId) ||
    !nonEmpty(input.categorySeriesKey) ||
    (input.targetIdentityBaselineId !== undefined &&
      !nonEmpty(input.targetIdentityBaselineId)) ||
    (input.targetBaselineSeriesKey !== undefined &&
      !nonEmpty(input.targetBaselineSeriesKey)) ||
    (input.targetBaselineVersion !== undefined &&
      !positiveInteger(input.targetBaselineVersion)) ||
    !positiveInteger(input.version) ||
    !nonEmpty(input.actorId) ||
    !isStrictIsoInstant(input.completedAt) ||
    (input.version === 1 && input.supersedesCompletionId != null) ||
    (input.version > 1 && !nonEmpty(input.supersedesCompletionId))
  ) {
    throw new Error("invalid identity category completion metadata");
  }
  return mintIdentityCategoryCompletionDraft({
    contractVersion: ROUND0_CONTRACT_VERSION,
    completionId: input.completionId,
    operationId: input.operationId,
    tenantId: absence.tenantId,
    consumerId: absence.consumerId,
    reportVersionId: absence.reportVersionId,
    extractionRunId: absence.extractionRunId,
    identityBaselineId: input.targetIdentityBaselineId ?? absence.identityBaselineId,
    sourceIdentityBaselineId: absence.identityBaselineId,
    baselineSeriesKey:
      input.targetBaselineSeriesKey ?? absence.baselineSeriesKey,
    baselineVersion: input.targetBaselineVersion ?? absence.baselineVersion,
    baselineInputSetSha256: absence.baselineInputSetSha256,
    categoryKey: absence.categoryKey,
    completion: "NOT_APPLICABLE",
    identityFactId: null,
    absenceAttestationId: absence.attestationId,
    absenceAttestationSha256: absence.semanticSha256,
    sourceCompletenessRuleVersion:
      ROUND0_IDENTITY_CATEGORY_COMPLETENESS_RULE_VERSION,
    sourceCompletenessEvidenceCount: 3,
    ...evidenceIds,
    sourceCompletenessSha256: absence.sourceCompletenessSha256,
    categorySeriesKey: input.categorySeriesKey,
    version: input.version,
    supersedesCompletionId: input.supersedesCompletionId ?? null,
    completedByActorId: input.actorId,
    completedAt: input.completedAt,
  });
}

export function durableIdentityCategoryCompletionFromDraft(
  draft: IdentityCategoryCompletionDraft,
): DurableIdentityCategoryCompletionRecord {
  if (!isMintedIdentityCategoryCompletionDraft(draft)) {
    throw new Error("invalid durable identity category completion draft");
  }
  return Object.freeze({
    id: draft.completionId,
    tenantId: draft.tenantId,
    consumerId: draft.consumerId,
    reportVersionId: draft.reportVersionId,
    extractionRunId: draft.extractionRunId,
    identityBaselineId: draft.identityBaselineId,
    identityBaselineVersion: draft.baselineVersion,
    baselineInputSetSha256: draft.baselineInputSetSha256,
    category: draft.categoryKey as
      | Round0IdentityReviewCategory
      | "UNRECOGNIZED_ACCOUNT",
    disposition: draft.completion,
    sourceCompletenessSha256: draft.sourceCompletenessSha256,
    sourceCompletenessAttestationKey: draft.absenceAttestationId,
    sourceCompletenessRuleVersion: draft.sourceCompletenessRuleVersion,
    sourceCompletenessEvidenceCount: draft.sourceCompletenessEvidenceCount,
    equifaxSourceCompletenessEvidenceId:
      draft.equifaxSourceCompletenessEvidenceId,
    experianSourceCompletenessEvidenceId:
      draft.experianSourceCompletenessEvidenceId,
    transunionSourceCompletenessEvidenceId:
      draft.transunionSourceCompletenessEvidenceId,
    completedByActorId: draft.completedByActorId,
    completedAt: draft.completedAt,
  });
}

export function isValidDurableIdentityCategoryCompletionRecord(
  value: unknown,
): value is DurableIdentityCategoryCompletionRecord {
  if (!value || typeof value !== "object") return false;
  const completion = value as DurableIdentityCategoryCompletionRecord;
  return (
    exactKeys(completion, DURABLE_IDENTITY_CATEGORY_COMPLETION_KEYS) &&
    nonEmpty(completion.id) &&
    nonEmpty(completion.tenantId) &&
    nonEmpty(completion.consumerId) &&
    nonEmpty(completion.reportVersionId) &&
    nonEmpty(completion.extractionRunId) &&
    nonEmpty(completion.identityBaselineId) &&
    positiveInteger(completion.identityBaselineVersion) &&
    SHA256.test(completion.baselineInputSetSha256) &&
    (validCategoryKey(completion.category) ||
      completion.category === "UNRECOGNIZED_ACCOUNT") &&
    completion.disposition === "NOT_APPLICABLE" &&
    SHA256.test(completion.sourceCompletenessSha256) &&
    nonEmpty(completion.sourceCompletenessAttestationKey) &&
    nonEmpty(completion.sourceCompletenessRuleVersion) &&
    completion.sourceCompletenessEvidenceCount === 3 &&
    nonEmpty(completion.equifaxSourceCompletenessEvidenceId) &&
    nonEmpty(completion.experianSourceCompletenessEvidenceId) &&
    nonEmpty(completion.transunionSourceCompletenessEvidenceId) &&
    new Set([
      completion.equifaxSourceCompletenessEvidenceId,
      completion.experianSourceCompletenessEvidenceId,
      completion.transunionSourceCompletenessEvidenceId,
    ]).size === 3 &&
    nonEmpty(completion.completedByActorId) &&
    isStrictIsoInstant(completion.completedAt)
  );
}

export function buildIdentityCorrespondenceAssertionDraft(input: {
  readonly source: ConfirmedRound0FactSourceContext;
  readonly assertionId: string;
  readonly operationId: string;
  readonly purposeCode: IdentityCorrespondencePurposeCode;
  readonly receiptState?: "ATTESTED" | "REVOKED";
  readonly assertionSeriesKey: string;
  readonly version: number;
  readonly supersedesAssertionId?: string | null;
  readonly actorId: string;
  readonly assertedAt: string;
}): IdentityCorrespondenceAssertionDraft {
  const source = input.source;
  const purposeAllowsClassification =
    (input.purposeCode === "CORRESPONDENCE_SENDER_IDENTITY" &&
      source.classification === "CORRECT_CURRENT" &&
      (source.categoryKey === "LEGAL_NAME" ||
        source.categoryKey === "CURRENT_ADDRESS")) ||
    (input.purposeCode === "CORRESPONDENCE_IDENTITY_CORRECTION" &&
      (source.classification === "INCORRECT" ||
        source.classification === "NEVER_MINE" ||
        source.classification === "OUTDATED_UPDATE_REQUESTED"));
  if (
    !isValidConfirmedRound0FactSourceContext(source) ||
    source.presence !== "PRESENT" ||
    source.sourceKind !== "SOURCE_REPORTED" ||
    source.baselineStatus !== "CONFIRMED" ||
    source.classification === "REVIEW_NEEDED" ||
    !nonEmpty(input.assertionId) ||
    !nonEmpty(input.operationId) ||
    !IDENTITY_CORRESPONDENCE_PURPOSE_CODES.includes(input.purposeCode) ||
    !purposeAllowsClassification ||
    (input.receiptState !== undefined &&
      input.receiptState !== "ATTESTED" &&
      input.receiptState !== "REVOKED") ||
    !nonEmpty(input.assertionSeriesKey) ||
    !positiveInteger(input.version) ||
    !nonEmpty(input.actorId) ||
    !isStrictIsoInstant(input.assertedAt) ||
    (input.version === 1 && input.supersedesAssertionId != null) ||
    (input.version > 1 && !nonEmpty(input.supersedesAssertionId)) ||
    (input.version === 1 && input.receiptState === "REVOKED")
  ) {
    throw new Error("invalid identity correspondence assertion source or metadata");
  }
  // One branded digest pins the original DRAFT source, the current confirmed
  // fact, and the bounded purpose. It is also the source-series identity, so a
  // caller cannot create a parallel v1 series over the same exact authority.
  const sourceSetSha256 = computeIdentityCorrespondenceAssertionSourceSeriesKey({
    source,
    purposeCode: input.purposeCode,
  });
  const sourceSeriesKey = sourceSetSha256;
  const expectedAssertionSeriesKey =
    computeIdentityCorrespondenceAssertionSeriesKey(sourceSeriesKey);
  if (input.assertionSeriesKey !== expectedAssertionSeriesKey) {
    throw new Error("identity assertion series must be server-derived from source");
  }
  const draft = Object.freeze({
    contractVersion: ROUND0_CONTRACT_VERSION,
    assertionId: input.assertionId,
    operationId: input.operationId,
    tenantId: source.tenantId,
    consumerId: source.consumerId,
    reportVersionId: source.reportVersionId,
    extractionRunId: source.extractionRunId,
    sourceIdentityBaselineId: source.sourceIdentityBaselineId,
    identityBaselineId: source.identityBaselineId,
    baselineSeriesKey: source.baselineSeriesKey,
    baselineVersion: source.baselineVersion,
    baselineInputSetSha256: source.baselineInputSetSha256,
    identityFactId: source.identityFactId,
    factSeriesKey: source.factSeriesKey,
    identityFactClassification: source.classification,
    categoryKey: source.categoryKey,
    bureau: source.bureau,
    sourceLocatorToken: source.sourceLocatorToken,
    sourceIntegritySha256: source.integritySha256,
    sourceSetSha256,
    purposeCode: input.purposeCode,
    receiptState: input.receiptState ?? "ATTESTED",
    sourceSeriesKey,
    assertionSeriesKey: expectedAssertionSeriesKey,
    version: input.version,
    supersedesAssertionId: input.supersedesAssertionId ?? null,
    assertedByActorId: input.actorId,
    assertedAt: input.assertedAt,
  });
  mintedIdentityAssertionDrafts.add(draft);
  mintedIdentityAssertionDigests.set(draft, computeRound0SemanticSha256(draft));
  return draft;
}

const DURABLE_IDENTITY_ASSERTION_KEYS = [
  "id",
  "tenantId",
  "consumerId",
  "reportVersionId",
  "extractionRunId",
  "identityBaselineId",
  "identityBaselineVersion",
  "baselineInputSetSha256",
  "identityFactSeriesKey",
  "identityFactId",
  "identityFactClassification",
  "identityFactIntegritySha256",
  "factBureau",
  "factSourceLocatorToken",
  "correspondencePurposeCode",
  "sourceSeriesKey",
  "assertionSeriesKey",
  "version",
  "status",
  "sourceSetSha256",
  "attestedByActorId",
  "attestedAt",
  "supersedesAssertionId",
] as const;

export function isValidDurableIdentityCorrespondenceAssertionRecord(
  value: unknown,
): value is DurableIdentityCorrespondenceAssertionRecord {
  if (!value || typeof value !== "object") return false;
  const assertion = value as DurableIdentityCorrespondenceAssertionRecord;
  return (
    exactKeys(assertion, DURABLE_IDENTITY_ASSERTION_KEYS) &&
    nonEmpty(assertion.id) &&
    nonEmpty(assertion.tenantId) &&
    nonEmpty(assertion.consumerId) &&
    nonEmpty(assertion.reportVersionId) &&
    nonEmpty(assertion.extractionRunId) &&
    nonEmpty(assertion.identityBaselineId) &&
    positiveInteger(assertion.identityBaselineVersion) &&
    SHA256.test(assertion.baselineInputSetSha256) &&
    nonEmpty(assertion.identityFactSeriesKey) &&
    nonEmpty(assertion.identityFactId) &&
    ROUND0_FACT_CLASSIFICATIONS.includes(assertion.identityFactClassification) &&
    assertion.identityFactClassification !== "REVIEW_NEEDED" &&
    SHA256.test(assertion.identityFactIntegritySha256) &&
    (assertion.factBureau === null || validBureau(assertion.factBureau)) &&
    nonEmpty(assertion.factSourceLocatorToken) &&
    IDENTITY_CORRESPONDENCE_PURPOSE_CODES.includes(
      assertion.correspondencePurposeCode,
    ) &&
    SHA256.test(assertion.sourceSeriesKey) &&
    assertion.assertionSeriesKey ===
      computeIdentityCorrespondenceAssertionSeriesKey(
        assertion.sourceSeriesKey,
      ) &&
    positiveInteger(assertion.version) &&
    (assertion.status === "ATTESTED" || assertion.status === "REVOKED") &&
    SHA256.test(assertion.sourceSetSha256) &&
    nonEmpty(assertion.attestedByActorId) &&
    isStrictIsoInstant(assertion.attestedAt) &&
    ((assertion.version === 1 &&
      assertion.supersedesAssertionId === null &&
      assertion.status !== "REVOKED") ||
      (assertion.version > 1 && nonEmpty(assertion.supersedesAssertionId)))
  );
}

export function durableIdentityCorrespondenceAssertionFromDraft(
  draft: IdentityCorrespondenceAssertionDraft,
): DurableIdentityCorrespondenceAssertionRecord {
  if (
    !mintedIdentityAssertionDrafts.has(draft) ||
    mintedIdentityAssertionDigests.get(draft) !==
      computeRound0SemanticSha256(draft)
  ) {
    throw new Error("invalid durable identity assertion draft");
  }
  const durable = Object.freeze({
    id: draft.assertionId,
    tenantId: draft.tenantId,
    consumerId: draft.consumerId,
    reportVersionId: draft.reportVersionId,
    extractionRunId: draft.extractionRunId,
    identityBaselineId: draft.identityBaselineId,
    identityBaselineVersion: draft.baselineVersion,
    baselineInputSetSha256: draft.baselineInputSetSha256,
    identityFactSeriesKey: draft.factSeriesKey,
    identityFactId: draft.identityFactId,
    identityFactClassification: draft.identityFactClassification,
    identityFactIntegritySha256: draft.sourceIntegritySha256,
    factBureau: draft.bureau,
    factSourceLocatorToken: draft.sourceLocatorToken,
    correspondencePurposeCode: draft.purposeCode,
    sourceSeriesKey: draft.sourceSeriesKey,
    assertionSeriesKey: draft.assertionSeriesKey,
    version: draft.version,
    status: draft.receiptState,
    sourceSetSha256: draft.sourceSetSha256,
    attestedByActorId: draft.assertedByActorId,
    attestedAt: draft.assertedAt,
    supersedesAssertionId: draft.supersedesAssertionId,
  });
  if (!isValidDurableIdentityCorrespondenceAssertionRecord(durable)) {
    throw new Error("invalid durable identity assertion projection");
  }
  return durable;
}
