import { createHash } from "node:crypto";
import type { Bureau } from "@prisma/client";
import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import { isStrictIsoInstant } from "./progressIntelligence";
import {
  p0Phase2AGatePermitAuthorizes,
  type P0Phase2AGatePermit,
} from "./phase2Flags";
import {
  findRound0AccountMember,
  isVerifiedRound0SourceSeal,
  round0SourceCompletenessSet,
  type VerifiedRound0SourceSeal,
} from "./round0SourceSeal";

export const ROUND0_ACCOUNT_REVIEW_CONTRACT_VERSION =
  "p0-round0-account-review-v1" as const;
export const ROUND0_ACCOUNT_REVIEW_CATEGORY =
  "UNRECOGNIZED_ACCOUNT" as const;

export const ROUND0_ACCOUNT_REVIEW_STATES = [
  "RECOGNIZED",
  "UNRECOGNIZED",
  "UNKNOWN",
  "DEFERRED",
  "REVOKED",
] as const;
export type Round0AccountReviewState =
  (typeof ROUND0_ACCOUNT_REVIEW_STATES)[number];

/**
 * Exact value-free source used for one account-recognition review. It is derived
 * only from a repository-verified Round 0 seal and a PRESENT source-listed
 * account member. No request selector can manufacture this authority.
 */
export interface Round0AccountReviewSource {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly identityBaselineVersion: number;
  readonly baselineInputSetSha256: string;
  readonly bureau: Bureau;
  readonly accountId: string;
  readonly reportVersionAccountId: string;
  readonly accountPresenceObservationId: string;
  readonly accountPresenceObservationRevision: number;
  readonly accountPresenceIntegritySha256: string;
  readonly accountPresenceSourceLocatorToken: string;
  readonly accountIndexCompletenessEvidenceId: string;
  readonly accountIndexSourceMembershipSha256: string;
  readonly accountIndexCompletenessIntegritySha256: string;
}

export interface Round0AccountReviewProjection {
  readonly category: typeof ROUND0_ACCOUNT_REVIEW_CATEGORY;
  readonly source: Round0AccountReviewSource;
  readonly selectedState: null;
  readonly consumerDecisionRequired: true;
  readonly systemObservationIsConsumerTestimony: false;
}

/** Field names intentionally align with the additive durable schema model. */
export interface ConsumerAccountReviewReceiptRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly identityBaselineId: string;
  readonly identityBaselineVersion: number;
  readonly baselineInputSetSha256: string;
  readonly bureau: Bureau;
  readonly accountId: string;
  readonly reportVersionAccountId: string;
  readonly accountPresenceObservationId: string;
  readonly accountPresenceObservationRevision: number;
  readonly accountPresenceIntegritySha256: string;
  readonly accountPresenceSourceLocatorToken: string;
  readonly accountIndexCompletenessEvidenceId: string;
  readonly accountIndexSourceMembershipSha256: string;
  readonly accountIndexCompletenessIntegritySha256: string;
  /** Full canonical exact-source digest; never derived from consumer state. */
  readonly sourceSeriesKey: string;
  readonly reviewSeriesKey: string;
  readonly version: number;
  readonly reviewState: Round0AccountReviewState;
  /** Digest of the exact value-free account source above. */
  readonly sourceSetSha256: string;
  readonly authorizationKind: "DIRECT_CONSUMER";
  readonly authorizationVersion: string;
  readonly reviewedByActorId: string;
  readonly reviewedAt: string;
  readonly supersedesReviewId: string | null;
}

export interface Round0AccountReviewSourceRead {
  readonly repositoryReadId: string;
  readonly sourceSeal: VerifiedRound0SourceSeal;
}

export interface ConsumerAccountReviewRepository {
  readRound0AccountReviewSource(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "ROUND0_ACCOUNT_REVIEW_SOURCE_READ";
    readonly identityBaselineId: string;
    readonly baselineInputSetSha256: string;
    readonly reportVersionAccountId: string;
    readonly bureau: Bureau;
  }): Promise<Round0AccountReviewSourceRead | null>;
  readConsumerAccountReviewReceipt(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose:
      | "ROUND0_ACCOUNT_REVIEW_SUPERSESSION_READ"
      | "ROUND0_ACCOUNT_REVIEW_READBACK";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly reviewId: string;
  }): Promise<ConsumerAccountReviewReceiptRecord | null>;
  appendConsumerAccountReviewReceipt(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "ROUND0_ACCOUNT_REVIEW_APPEND";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly sourceReadId: string;
    readonly receipt: ConsumerAccountReviewReceiptRecord;
  }): Promise<{ readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY" }>;
}

export type AppendConsumerAccountReviewResult =
  | {
      readonly ok: true;
      readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY";
      readonly receipt: ConsumerAccountReviewReceiptRecord;
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
const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;

function nonEmptyStable(value: unknown): value is string {
  // Repository-resolved IDs may be hexadecimal and naturally contain long
  // numeric runs; they are opaque references, never copied consumer values.
  return typeof value === "string" && STABLE.test(value);
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function validBureau(value: unknown): value is Bureau {
  return (
    value === "EQUIFAX" ||
    value === "EXPERIAN" ||
    value === "TRANSUNION"
  );
}

function canonical(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite account review value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value !== "object") {
    throw new Error("non-JSON account review value");
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function validSource(value: unknown): value is Round0AccountReviewSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Round0AccountReviewSource;
  return (
    Object.keys(source).length === 17 &&
    nonEmptyStable(source.tenantId) &&
    nonEmptyStable(source.consumerId) &&
    nonEmptyStable(source.reportVersionId) &&
    nonEmptyStable(source.extractionRunId) &&
    nonEmptyStable(source.identityBaselineId) &&
    positiveInteger(source.identityBaselineVersion) &&
    SHA256.test(source.baselineInputSetSha256) &&
    validBureau(source.bureau) &&
    nonEmptyStable(source.accountId) &&
    nonEmptyStable(source.reportVersionAccountId) &&
    nonEmptyStable(source.accountPresenceObservationId) &&
    positiveInteger(source.accountPresenceObservationRevision) &&
    SHA256.test(source.accountPresenceIntegritySha256) &&
    nonEmptyStable(source.accountPresenceSourceLocatorToken) &&
    nonEmptyStable(source.accountIndexCompletenessEvidenceId) &&
    SHA256.test(source.accountIndexSourceMembershipSha256) &&
    SHA256.test(source.accountIndexCompletenessIntegritySha256)
  );
}

export function computeRound0AccountReviewSourceSetSha256(
  source: Round0AccountReviewSource,
): string {
  if (!validSource(source)) throw new Error("invalid Round 0 account review source");
  return sha256(source);
}

export function computeRound0AccountReviewSeriesKey(
  source: Round0AccountReviewSource,
): string {
  return `round0_account_review_${computeRound0AccountReviewSourceSetSha256(source).slice(0, 40)}`;
}

export function round0AccountReviewSourceFromSeal(input: {
  readonly seal: VerifiedRound0SourceSeal;
  readonly reportVersionAccountId: string;
  readonly bureau: Bureau;
}): Round0AccountReviewSource | null {
  if (!isVerifiedRound0SourceSeal(input.seal)) return null;
  const member = findRound0AccountMember(
    input.seal,
    input.reportVersionAccountId,
    input.bureau,
  );
  if (
    !member ||
    member.accountPresence !== "PRESENT" ||
    member.accountPresenceSourceLocatorToken === null
  ) {
    return null;
  }
  const completeness = round0SourceCompletenessSet(
    input.seal,
    "UNRECOGNIZED_ACCOUNT",
  )?.find((candidate) => candidate.bureau === member.bureau);
  if (
    !completeness ||
    completeness.coverageStatus !== "COVERED" ||
    (completeness.status !== "COMPLETE" &&
      completeness.status !== "PARTIAL") ||
    completeness.sourceMemberCount < 1
  ) {
    return null;
  }
  return Object.freeze({
    tenantId: input.seal.tenantId,
    consumerId: input.seal.consumerId,
    reportVersionId: input.seal.reportVersionId,
    extractionRunId: input.seal.extractionRunId,
    identityBaselineId: input.seal.identityBaselineId,
    identityBaselineVersion: input.seal.baselineVersion,
    baselineInputSetSha256: input.seal.sourceSetSha256,
    bureau: member.bureau,
    accountId: member.accountId,
    reportVersionAccountId: member.reportAccountId,
    accountPresenceObservationId: member.accountPresenceId,
    accountPresenceObservationRevision: member.accountPresenceRevision,
    accountPresenceIntegritySha256: member.accountPresenceIntegritySha256,
    accountPresenceSourceLocatorToken:
      member.accountPresenceSourceLocatorToken,
    accountIndexCompletenessEvidenceId: completeness.id,
    accountIndexSourceMembershipSha256:
      completeness.sourceMembershipSha256,
    accountIndexCompletenessIntegritySha256: completeness.integritySha256,
  });
}

export function buildRound0AccountReviewProjection(
  source: Round0AccountReviewSource,
): Round0AccountReviewProjection {
  if (!validSource(source)) throw new Error("invalid account review projection source");
  return Object.freeze({
    category: ROUND0_ACCOUNT_REVIEW_CATEGORY,
    source: Object.freeze({ ...source }),
    selectedState: null,
    consumerDecisionRequired: true,
    systemObservationIsConsumerTestimony: false,
  });
}

function receiptSource(
  receipt: ConsumerAccountReviewReceiptRecord,
): Round0AccountReviewSource {
  return {
    tenantId: receipt.tenantId,
    consumerId: receipt.consumerId,
    reportVersionId: receipt.reportVersionId,
    extractionRunId: receipt.extractionRunId,
    identityBaselineId: receipt.identityBaselineId,
    identityBaselineVersion: receipt.identityBaselineVersion,
    baselineInputSetSha256: receipt.baselineInputSetSha256,
    bureau: receipt.bureau,
    accountId: receipt.accountId,
    reportVersionAccountId: receipt.reportVersionAccountId,
    accountPresenceObservationId: receipt.accountPresenceObservationId,
    accountPresenceObservationRevision:
      receipt.accountPresenceObservationRevision,
    accountPresenceIntegritySha256: receipt.accountPresenceIntegritySha256,
    accountPresenceSourceLocatorToken:
      receipt.accountPresenceSourceLocatorToken,
    accountIndexCompletenessEvidenceId:
      receipt.accountIndexCompletenessEvidenceId,
    accountIndexSourceMembershipSha256:
      receipt.accountIndexSourceMembershipSha256,
    accountIndexCompletenessIntegritySha256:
      receipt.accountIndexCompletenessIntegritySha256,
  };
}

export function isValidConsumerAccountReviewReceipt(
  value: unknown,
): value is ConsumerAccountReviewReceiptRecord {
  if (!value || typeof value !== "object") return false;
  const receipt = value as ConsumerAccountReviewReceiptRecord;
  if (
    Object.keys(receipt).length !== 28 ||
    !nonEmptyStable(receipt.id) ||
    !validSource(receiptSource(receipt)) ||
    !nonEmptyStable(receipt.reviewSeriesKey) ||
    !SHA256.test(receipt.sourceSeriesKey) ||
    !positiveInteger(receipt.version) ||
    !ROUND0_ACCOUNT_REVIEW_STATES.includes(receipt.reviewState) ||
    !SHA256.test(receipt.sourceSetSha256) ||
    receipt.authorizationKind !== "DIRECT_CONSUMER" ||
    !nonEmptyStable(receipt.authorizationVersion) ||
    !nonEmptyStable(receipt.reviewedByActorId) ||
    !isStrictIsoInstant(receipt.reviewedAt) ||
    (receipt.supersedesReviewId !== null &&
      !nonEmptyStable(receipt.supersedesReviewId))
  ) {
    return false;
  }
  const source = receiptSource(receipt);
  return (
    receipt.sourceSetSha256 ===
      computeRound0AccountReviewSourceSetSha256(source) &&
    receipt.sourceSeriesKey === receipt.sourceSetSha256 &&
    receipt.reviewSeriesKey === computeRound0AccountReviewSeriesKey(source) &&
    ((receipt.version === 1 &&
      receipt.supersedesReviewId === null &&
      receipt.reviewState !== "REVOKED") ||
      (receipt.version > 1 && receipt.supersedesReviewId !== null))
  );
}

export function consumerAccountReviewReceiptMatchesSource(
  receipt: ConsumerAccountReviewReceiptRecord,
  source: Round0AccountReviewSource,
): boolean {
  return (
    isValidConsumerAccountReviewReceipt(receipt) &&
    validSource(source) &&
    computeRound0AccountReviewSourceSetSha256(receiptSource(receipt)) ===
      computeRound0AccountReviewSourceSetSha256(source)
  );
}

export function computeConsumerAccountReviewReceiptSemanticSha256(
  receipt: ConsumerAccountReviewReceiptRecord,
): string {
  if (!isValidConsumerAccountReviewReceipt(receipt)) {
    throw new Error("invalid consumer account review receipt");
  }
  return sha256(receipt);
}

function sameReceipt(
  expected: ConsumerAccountReviewReceiptRecord,
  actual: ConsumerAccountReviewReceiptRecord,
): boolean {
  try {
    return (
      isValidConsumerAccountReviewReceipt(expected) &&
      isValidConsumerAccountReviewReceipt(actual) &&
      computeConsumerAccountReviewReceiptSemanticSha256(expected) ===
        computeConsumerAccountReviewReceiptSemanticSha256(actual)
    );
  } catch {
    return false;
  }
}

function validSupersession(
  receipt: ConsumerAccountReviewReceiptRecord,
  prior: ConsumerAccountReviewReceiptRecord | null,
): boolean {
  if (receipt.version === 1) {
    return receipt.supersedesReviewId === null && receipt.reviewState !== "REVOKED";
  }
  return Boolean(
    prior &&
      isValidConsumerAccountReviewReceipt(prior) &&
      prior.reviewState !== "REVOKED" &&
      receipt.supersedesReviewId === prior.id &&
      receipt.version === prior.version + 1 &&
      receipt.sourceSeriesKey === prior.sourceSeriesKey &&
      receipt.reviewSeriesKey === prior.reviewSeriesKey &&
      receipt.tenantId === prior.tenantId &&
      receipt.consumerId === prior.consumerId &&
      receipt.sourceSetSha256 === prior.sourceSetSha256,
  );
}

export async function appendConsumerAccountReviewReceipt(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly gatePermit: P0Phase2AGatePermit;
  readonly repository: ConsumerAccountReviewRepository;
  readonly request: {
    readonly id: string;
    readonly operationId: string;
    readonly expectedSource: Round0AccountReviewSource;
    readonly reviewState: Round0AccountReviewState;
    readonly version: number;
    readonly supersedesReviewId?: string | null;
  };
}): Promise<AppendConsumerAccountReviewResult> {
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
      mode: "LOCAL_BUILD",
      operationId: request.operationId,
    })
  ) {
    return { ok: false, code: "GATE_DENIED" };
  }
  if (
    !nonEmptyStable(request.id) ||
    !nonEmptyStable(request.operationId) ||
    !validSource(request.expectedSource) ||
    request.expectedSource.tenantId !== scope.tenantId ||
    request.expectedSource.consumerId !== scope.consumerId ||
    !ROUND0_ACCOUNT_REVIEW_STATES.includes(request.reviewState) ||
    !positiveInteger(request.version) ||
    (request.version === 1 && request.supersedesReviewId != null) ||
    (request.version > 1 && !nonEmptyStable(request.supersedesReviewId))
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }

  try {
    const sourceRead = await repository.readRound0AccountReviewSource({
      principal,
      scope,
      purpose: "ROUND0_ACCOUNT_REVIEW_SOURCE_READ",
      identityBaselineId: request.expectedSource.identityBaselineId,
      baselineInputSetSha256:
        request.expectedSource.baselineInputSetSha256,
      reportVersionAccountId: request.expectedSource.reportVersionAccountId,
      bureau: request.expectedSource.bureau,
    });
    if (!sourceRead || !nonEmptyStable(sourceRead.repositoryReadId)) {
      return { ok: false, code: "SOURCE_NOT_FOUND" };
    }
    const currentSource = round0AccountReviewSourceFromSeal({
      seal: sourceRead.sourceSeal,
      reportVersionAccountId: request.expectedSource.reportVersionAccountId,
      bureau: request.expectedSource.bureau,
    });
    if (
      !currentSource ||
      computeRound0AccountReviewSourceSetSha256(currentSource) !==
        computeRound0AccountReviewSourceSetSha256(request.expectedSource)
    ) {
      return {
        ok: false,
        code: "STALE_SOURCE_RECONFIRMATION_REQUIRED",
      };
    }

    const prior = request.supersedesReviewId
      ? await repository.readConsumerAccountReviewReceipt({
          principal,
          scope,
          purpose: "ROUND0_ACCOUNT_REVIEW_SUPERSESSION_READ",
          gatePermit: input.gatePermit,
          reviewId: request.supersedesReviewId,
        })
      : null;
    const sourceSetSha256 =
      computeRound0AccountReviewSourceSetSha256(currentSource);
    const receipt: ConsumerAccountReviewReceiptRecord = Object.freeze({
      id: request.id,
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      reportVersionId: currentSource.reportVersionId,
      extractionRunId: currentSource.extractionRunId,
      identityBaselineId: currentSource.identityBaselineId,
      identityBaselineVersion: currentSource.identityBaselineVersion,
      baselineInputSetSha256: currentSource.baselineInputSetSha256,
      bureau: currentSource.bureau,
      accountId: currentSource.accountId,
      reportVersionAccountId: currentSource.reportVersionAccountId,
      accountPresenceObservationId:
        currentSource.accountPresenceObservationId,
      accountPresenceObservationRevision:
        currentSource.accountPresenceObservationRevision,
      accountPresenceIntegritySha256:
        currentSource.accountPresenceIntegritySha256,
      accountPresenceSourceLocatorToken:
        currentSource.accountPresenceSourceLocatorToken,
      accountIndexCompletenessEvidenceId:
        currentSource.accountIndexCompletenessEvidenceId,
      accountIndexSourceMembershipSha256:
        currentSource.accountIndexSourceMembershipSha256,
      accountIndexCompletenessIntegritySha256:
        currentSource.accountIndexCompletenessIntegritySha256,
      sourceSeriesKey: sourceSetSha256,
      reviewSeriesKey: computeRound0AccountReviewSeriesKey(currentSource),
      version: request.version,
      reviewState: request.reviewState,
      sourceSetSha256,
      authorizationKind: "DIRECT_CONSUMER",
      authorizationVersion: principal.authorizationVersion,
      reviewedByActorId: principal.actorId,
      reviewedAt: input.gatePermit.issuedAt,
      supersedesReviewId: request.supersedesReviewId ?? null,
    });
    if (!isValidConsumerAccountReviewReceipt(receipt)) {
      return { ok: false, code: "INVALID_REQUEST" };
    }
    if (!validSupersession(receipt, prior)) {
      return { ok: false, code: "SUPERSESSION_MISMATCH" };
    }
    const write = await repository.appendConsumerAccountReviewReceipt({
      principal,
      scope,
      purpose: "ROUND0_ACCOUNT_REVIEW_APPEND",
      gatePermit: input.gatePermit,
      sourceReadId: sourceRead.repositoryReadId,
      receipt,
    });
    if (
      write.disposition !== "CREATED" &&
      write.disposition !== "IDEMPOTENT_REPLAY"
    ) {
      return { ok: false, code: "OUTCOME_UNKNOWN" };
    }
    const readback = await repository.readConsumerAccountReviewReceipt({
      principal,
      scope,
      purpose: "ROUND0_ACCOUNT_REVIEW_READBACK",
      gatePermit: input.gatePermit,
      reviewId: receipt.id,
    });
    if (!readback || !sameReceipt(receipt, readback)) {
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
      receipt: Object.freeze({ ...readback }),
    });
  } catch {
    return { ok: false, code: "OUTCOME_UNKNOWN" };
  }
}

/** Phase 2A account review never carries policy, fraud, or dispute authority. */
export function accountReviewContainsForbiddenAuthority(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  const forbidden = [
    "fraud",
    "inaccur",
    "unauthor",
    "deletion",
    "delete",
    "policy",
    "legal",
    "dispute",
    "eligib",
  ];
  const visit = (current: unknown): boolean => {
    if (!current || typeof current !== "object") return false;
    if (Array.isArray(current)) return current.some(visit);
    return Object.entries(current as Record<string, unknown>).some(
      ([key, nested]) =>
        forbidden.some((fragment) => key.toLowerCase().includes(fragment)) ||
        visit(nested),
    );
  };
  return visit(value);
}
