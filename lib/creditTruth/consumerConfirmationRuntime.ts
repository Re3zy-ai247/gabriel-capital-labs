import { createHash } from "node:crypto";
import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import {
  CONSUMER_ASSERTION_BINDING_VERSION,
  CONSUMER_ASSERTION_DISPOSITIONS,
  validateConsumerAssertionBinding,
  type BoundConsumerAssertion,
  type ConsumerAssertionDisposition,
  type ObservationBinding,
} from "./consumerAssertion";
import { isStrictIsoInstant } from "./progressIntelligence";
import { CREDIT_TRUTH_FIELD_NAMES } from "./types";
import {
  p0Phase2AGatePermitAuthorizes,
  type P0Phase2AGatePermit,
} from "./phase2Flags";

export const CONSUMER_CONFIRMATION_RUNTIME_VERSION =
  "p0-consumer-confirmation-runtime-v1" as const;

export interface ConsumerAssertionAssessmentBinding {
  readonly assessmentId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly accountId: string;
  readonly assessmentVersion: number;
  readonly inputSetSha256: string;
}

export interface ConsumerAssertionSourceRead {
  readonly repositoryReadId: string;
  readonly observation: ObservationBinding;
  readonly assessment: ConsumerAssertionAssessmentBinding;
}

export interface ConsumerAssertionRuntimeRecord extends BoundConsumerAssertion {
  readonly runtimeVersion: typeof CONSUMER_CONFIRMATION_RUNTIME_VERSION;
  readonly operationId: string;
  readonly assessment: ConsumerAssertionAssessmentBinding;
  readonly assertionSeriesKey: string;
  readonly version: number;
  readonly supersedesAssertionId: string | null;
  readonly confirmedByActorId: string;
  readonly confirmedAt: string;
  readonly expiresAt: string | null;
  readonly integritySha256: string;
}

export interface ConsumerAssertionRuntimeRepository {
  readConsumerAssertionSource(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "CONSUMER_ASSERTION_SOURCE_READ";
    readonly observationId: string;
    readonly assessmentId: string;
  }): Promise<ConsumerAssertionSourceRead | null>;
  readConsumerAssertion(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose:
      | "CONSUMER_ASSERTION_SUPERSESSION_READ"
      | "CONSUMER_ASSERTION_READBACK";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly assertionId: string;
  }): Promise<ConsumerAssertionRuntimeRecord | null>;
  appendConsumerAssertion(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "CONSUMER_ASSERTION_APPEND";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly sourceReadId: string;
    readonly assertion: ConsumerAssertionRuntimeRecord;
  }): Promise<{ readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY" }>;
}

const VERIFIED_CONSUMER_ASSERTION_RECEIPT = Symbol(
  "verified-consumer-assertion-runtime-receipt",
);
const verifiedConsumerAssertionReceipts = new WeakSet<object>();
const verifiedConsumerAssertionDigests = new WeakMap<object, string>();

export interface VerifiedConsumerAssertionReceipt {
  readonly assertion: ConsumerAssertionRuntimeRecord;
  readonly semanticSha256: string;
  readonly [VERIFIED_CONSUMER_ASSERTION_RECEIPT]: true;
}

export interface ConsumerAssertionPersistedReceiptVerifier {
  readonly verifierId: string;
  verifyPersistedAssertion(input: {
    readonly assertion: ConsumerAssertionRuntimeRecord;
    readonly semanticSha256: string;
  }): Promise<boolean>;
}

export interface ConsumerAssertionCurrentHeadCandidate {
  readonly runtimeVersion: typeof CONSUMER_CONFIRMATION_RUNTIME_VERSION;
  readonly repositoryReadId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly assertionSeriesKey: string;
  readonly headAssertionId: string;
  readonly headVersion: number;
  readonly headIntegritySha256: string;
  readonly supersededByAssertionId: null;
  readonly verifiedAt: string;
  readonly expiresAt: string;
}

export interface ConsumerAssertionCurrentHeadVerifier {
  readonly verifierId: string;
  verifyCurrentHead(input: {
    readonly candidate: ConsumerAssertionCurrentHeadCandidate;
    readonly semanticSha256: string;
  }): Promise<boolean>;
}

const VERIFIED_CONSUMER_ASSERTION_CURRENT_HEAD = Symbol(
  "verified-consumer-assertion-current-head",
);
const verifiedCurrentHeads = new WeakSet<object>();
const verifiedCurrentHeadDigests = new WeakMap<object, string>();

export interface VerifiedConsumerAssertionCurrentHead
  extends ConsumerAssertionCurrentHeadCandidate {
  readonly verifierId: string;
  readonly semanticSha256: string;
  readonly [VERIFIED_CONSUMER_ASSERTION_CURRENT_HEAD]: true;
}

export type AppendConsumerAssertionResult =
  | {
      readonly ok: true;
      readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY";
      readonly receipt: VerifiedConsumerAssertionReceipt;
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
        | "ASSESSMENT_BINDING_MISMATCH"
        | "SUPERSESSION_MISMATCH"
        | "REPLAY_CONFLICT"
        | "READBACK_MISMATCH"
        | "OUTCOME_UNKNOWN";
    };

const SHA256 = /^[0-9a-f]{64}$/;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function validObservationBinding(binding: unknown): binding is ObservationBinding {
  if (!binding || typeof binding !== "object") return false;
  const value = binding as ObservationBinding;
  return (
    (value.bureau === "EQUIFAX" ||
      value.bureau === "EXPERIAN" ||
      value.bureau === "TRANSUNION") &&
    CREDIT_TRUTH_FIELD_NAMES.includes(value.field) &&
    validateConsumerAssertionBinding(
      {
        bindingVersion: CONSUMER_ASSERTION_BINDING_VERSION,
        assertionId: "binding-shape-check",
        disposition: "REVIEW_NEEDED",
        binding: value,
      },
      value,
    ).valid
  );
}

function validAssessment(
  assessment: unknown,
): assessment is ConsumerAssertionAssessmentBinding {
  if (!assessment || typeof assessment !== "object") return false;
  const value = assessment as ConsumerAssertionAssessmentBinding;
  return (
    Object.keys(value).length === 8 &&
    nonEmpty(value.assessmentId) &&
    nonEmpty(value.tenantId) &&
    nonEmpty(value.consumerId) &&
    nonEmpty(value.reportVersionId) &&
    nonEmpty(value.extractionRunId) &&
    nonEmpty(value.accountId) &&
    positiveInteger(value.assessmentVersion) &&
    SHA256.test(value.inputSetSha256)
  );
}

function assessmentMatchesObservation(
  assessment: ConsumerAssertionAssessmentBinding,
  observation: ObservationBinding,
): boolean {
  return (
    assessment.tenantId === observation.tenantId &&
    assessment.consumerId === observation.consumerId &&
    assessment.reportVersionId === observation.reportVersionId &&
    assessment.extractionRunId === observation.extractionRunId &&
    assessment.accountId === observation.accountId
  );
}

export function computeConsumerAssertionRuntimeIntegritySha256(
  record: Omit<ConsumerAssertionRuntimeRecord, "integritySha256">,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        record.runtimeVersion,
        record.bindingVersion,
        record.assertionId,
        record.operationId,
        record.disposition,
        [
          record.binding.tenantId,
          record.binding.consumerId,
          record.binding.observationId,
          record.binding.reportVersionId,
          record.binding.extractionRunId,
          record.binding.accountId,
          record.binding.bureau,
          record.binding.field,
          record.binding.observationSeriesKey,
          record.binding.observationRevision,
          record.binding.observationDigest,
        ],
        [
          record.assessment.assessmentId,
          record.assessment.tenantId,
          record.assessment.consumerId,
          record.assessment.reportVersionId,
          record.assessment.extractionRunId,
          record.assessment.accountId,
          record.assessment.assessmentVersion,
          record.assessment.inputSetSha256,
        ],
        record.assertionSeriesKey,
        record.version,
        record.supersedesAssertionId,
        record.confirmedByActorId,
        record.confirmedAt,
        record.expiresAt,
      ]),
      "utf8",
    )
    .digest("hex");
}

function validRecord(value: unknown): value is ConsumerAssertionRuntimeRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as ConsumerAssertionRuntimeRecord;
  const bindingValidation = validateConsumerAssertionBinding(record, record.binding);
  return (
    Object.keys(record).length === 14 &&
    record.runtimeVersion === CONSUMER_CONFIRMATION_RUNTIME_VERSION &&
    record.bindingVersion === CONSUMER_ASSERTION_BINDING_VERSION &&
    nonEmpty(record.assertionId) &&
    nonEmpty(record.operationId) &&
    CONSUMER_ASSERTION_DISPOSITIONS.includes(record.disposition) &&
    bindingValidation.status === "CURRENT" &&
    validObservationBinding(record.binding) &&
    validAssessment(record.assessment) &&
    assessmentMatchesObservation(record.assessment, record.binding) &&
    nonEmpty(record.assertionSeriesKey) &&
    positiveInteger(record.version) &&
    (record.supersedesAssertionId === null ||
      nonEmpty(record.supersedesAssertionId)) &&
    nonEmpty(record.confirmedByActorId) &&
    isStrictIsoInstant(record.confirmedAt) &&
    (record.expiresAt === null ||
      (isStrictIsoInstant(record.expiresAt) &&
        Date.parse(record.expiresAt) > Date.parse(record.confirmedAt))) &&
    SHA256.test(record.integritySha256) &&
    computeConsumerAssertionRuntimeIntegritySha256(record) ===
      record.integritySha256
  );
}

function sameRecord(
  expected: ConsumerAssertionRuntimeRecord,
  actual: ConsumerAssertionRuntimeRecord,
): boolean {
  return (
    validRecord(actual) &&
    expected.integritySha256 === actual.integritySha256 &&
    computeConsumerAssertionRuntimeIntegritySha256(expected) ===
      computeConsumerAssertionRuntimeIntegritySha256(actual)
  );
}

function validSupersession(
  record: ConsumerAssertionRuntimeRecord,
  prior: ConsumerAssertionRuntimeRecord | null,
): boolean {
  if (record.version === 1) {
    return record.supersedesAssertionId === null && record.disposition !== "REVOKED";
  }
  return Boolean(
    prior &&
      validRecord(prior) &&
      record.supersedesAssertionId === prior.assertionId &&
      record.version === prior.version + 1 &&
      record.assertionSeriesKey === prior.assertionSeriesKey &&
      record.binding.tenantId === prior.binding.tenantId &&
      record.binding.consumerId === prior.binding.consumerId &&
      record.binding.accountId === prior.binding.accountId &&
      record.binding.bureau === prior.binding.bureau &&
      record.binding.field === prior.binding.field &&
      record.binding.observationSeriesKey ===
        prior.binding.observationSeriesKey,
  );
}

function mintReceipt(
  assertion: ConsumerAssertionRuntimeRecord,
): VerifiedConsumerAssertionReceipt {
  const snapshot = Object.freeze({
    ...assertion,
    binding: Object.freeze({ ...assertion.binding }),
    assessment: Object.freeze({ ...assertion.assessment }),
  });
  const semanticSha256 = snapshot.integritySha256;
  const receipt = { assertion: snapshot, semanticSha256 } as VerifiedConsumerAssertionReceipt;
  Object.defineProperty(receipt, VERIFIED_CONSUMER_ASSERTION_RECEIPT, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedConsumerAssertionReceipts.add(receipt);
  verifiedConsumerAssertionDigests.set(receipt, semanticSha256);
  return Object.freeze(receipt);
}

/**
 * Rehydrates a persisted immutable receipt only after an authenticated
 * repository verifies its exact semantic digest. This does not attest current
 * head status; callers must still supply current-head evidence below.
 */
export async function verifyPersistedConsumerAssertionReceipt(
  assertion: ConsumerAssertionRuntimeRecord,
  verifier: ConsumerAssertionPersistedReceiptVerifier,
): Promise<VerifiedConsumerAssertionReceipt | null> {
  if (!validRecord(assertion) || !nonEmpty(verifier?.verifierId)) return null;
  const snapshot = Object.freeze({
    ...assertion,
    binding: Object.freeze({ ...assertion.binding }),
    assessment: Object.freeze({ ...assertion.assessment }),
  });
  let approved = false;
  try {
    approved = await verifier.verifyPersistedAssertion({
      assertion: snapshot,
      semanticSha256: snapshot.integritySha256,
    });
  } catch {
    return null;
  }
  return approved ? mintReceipt(snapshot) : null;
}

export async function appendConsumerAssertion(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly gatePermit: P0Phase2AGatePermit;
  readonly repository: ConsumerAssertionRuntimeRepository;
  readonly request: {
    readonly assertionId: string;
    readonly operationId: string;
    readonly expectedBinding: ObservationBinding;
    readonly assessmentId: string;
    readonly disposition: ConsumerAssertionDisposition;
    readonly assertionSeriesKey: string;
    readonly version: number;
    readonly supersedesAssertionId?: string | null;
  };
}): Promise<AppendConsumerAssertionResult> {
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
      mode: "LOCAL_BUILD",
      operationId: request.operationId,
    })
  ) {
    return { ok: false, code: "GATE_DENIED" };
  }
  if (
    !nonEmpty(request.assertionId) ||
    !nonEmpty(request.operationId) ||
    !nonEmpty(request.assessmentId) ||
    !CONSUMER_ASSERTION_DISPOSITIONS.includes(request.disposition) ||
    !nonEmpty(request.assertionSeriesKey) ||
    !positiveInteger(request.version) ||
    !validObservationBinding(request.expectedBinding)
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  const expectedAssertion: BoundConsumerAssertion = {
    bindingVersion: CONSUMER_ASSERTION_BINDING_VERSION,
    assertionId: request.assertionId,
    disposition: request.disposition,
    binding: request.expectedBinding,
  };
  try {
    const source = await repository.readConsumerAssertionSource({
      principal,
      scope,
      purpose: "CONSUMER_ASSERTION_SOURCE_READ",
      observationId: request.expectedBinding.observationId,
      assessmentId: request.assessmentId,
    });
    if (!source) return { ok: false, code: "SOURCE_NOT_FOUND" };
    const bindingValidation = validateConsumerAssertionBinding(
      expectedAssertion,
      source.observation,
    );
    if (!bindingValidation.valid) {
      return { ok: false, code: "STALE_SOURCE_RECONFIRMATION_REQUIRED" };
    }
    if (
      !validObservationBinding(source.observation) ||
      source.observation.tenantId !== scope.tenantId ||
      source.observation.consumerId !== scope.consumerId ||
      !validAssessment(source.assessment) ||
      source.assessment.assessmentId !== request.assessmentId ||
      !assessmentMatchesObservation(source.assessment, source.observation)
    ) {
      return { ok: false, code: "ASSESSMENT_BINDING_MISMATCH" };
    }
    const prior = request.supersedesAssertionId
      ? await repository.readConsumerAssertion({
          principal,
          scope,
          purpose: "CONSUMER_ASSERTION_SUPERSESSION_READ",
          gatePermit: input.gatePermit,
          assertionId: request.supersedesAssertionId,
        })
      : null;
    const withoutIntegrity = {
      runtimeVersion: CONSUMER_CONFIRMATION_RUNTIME_VERSION,
      bindingVersion: CONSUMER_ASSERTION_BINDING_VERSION,
      assertionId: request.assertionId,
      operationId: request.operationId,
      disposition: request.disposition,
      binding: Object.freeze({ ...source.observation }),
      assessment: Object.freeze({ ...source.assessment }),
      assertionSeriesKey: request.assertionSeriesKey,
      version: request.version,
      supersedesAssertionId: request.supersedesAssertionId ?? null,
      confirmedByActorId: principal.actorId,
      confirmedAt: input.gatePermit.issuedAt,
      // Phase 2A has no counsel-approved expiry policy. Request timestamps are
      // never authority; null is the explicit server-derived no-expiry value.
      expiresAt: null,
    } as const;
    const record: ConsumerAssertionRuntimeRecord = Object.freeze({
      ...withoutIntegrity,
      integritySha256:
        computeConsumerAssertionRuntimeIntegritySha256(withoutIntegrity),
    });
    if (!validRecord(record)) return { ok: false, code: "INVALID_REQUEST" };
    if (!validSupersession(record, prior)) {
      return { ok: false, code: "SUPERSESSION_MISMATCH" };
    }
    const write = await repository.appendConsumerAssertion({
      principal,
      scope,
      purpose: "CONSUMER_ASSERTION_APPEND",
      gatePermit: input.gatePermit,
      sourceReadId: source.repositoryReadId,
      assertion: record,
    });
    if (
      write.disposition !== "CREATED" &&
      write.disposition !== "IDEMPOTENT_REPLAY"
    ) {
      return { ok: false, code: "OUTCOME_UNKNOWN" };
    }
    const readback = await repository.readConsumerAssertion({
      principal,
      scope,
      purpose: "CONSUMER_ASSERTION_READBACK",
      gatePermit: input.gatePermit,
      assertionId: record.assertionId,
    });
    if (!readback || !sameRecord(record, readback)) {
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
      receipt: mintReceipt(readback),
    });
  } catch {
    return { ok: false, code: "OUTCOME_UNKNOWN" };
  }
}

function currentHeadSemanticSha256(
  head: ConsumerAssertionCurrentHeadCandidate,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        head.runtimeVersion,
        head.repositoryReadId,
        head.tenantId,
        head.consumerId,
        head.assertionSeriesKey,
        head.headAssertionId,
        head.headVersion,
        head.headIntegritySha256,
        head.supersededByAssertionId,
        head.verifiedAt,
        head.expiresAt,
      ]),
      "utf8",
    )
    .digest("hex");
}

function validCurrentHeadCandidate(
  value: unknown,
): value is ConsumerAssertionCurrentHeadCandidate {
  if (!value || typeof value !== "object") return false;
  const head = value as ConsumerAssertionCurrentHeadCandidate;
  const verifiedAt = isStrictIsoInstant(head.verifiedAt)
    ? Date.parse(head.verifiedAt)
    : Number.NaN;
  const expiresAt = isStrictIsoInstant(head.expiresAt)
    ? Date.parse(head.expiresAt)
    : Number.NaN;
  return (
    Object.keys(head).length === 11 &&
    head.runtimeVersion === CONSUMER_CONFIRMATION_RUNTIME_VERSION &&
    nonEmpty(head.repositoryReadId) &&
    nonEmpty(head.tenantId) &&
    nonEmpty(head.consumerId) &&
    nonEmpty(head.assertionSeriesKey) &&
    nonEmpty(head.headAssertionId) &&
    positiveInteger(head.headVersion) &&
    SHA256.test(head.headIntegritySha256) &&
    head.supersededByAssertionId === null &&
    Number.isFinite(verifiedAt) &&
    Number.isFinite(expiresAt) &&
    expiresAt > verifiedAt &&
    expiresAt - verifiedAt <= 60_000
  );
}

export async function verifyConsumerAssertionCurrentHead(
  candidate: ConsumerAssertionCurrentHeadCandidate,
  verifier: ConsumerAssertionCurrentHeadVerifier,
): Promise<VerifiedConsumerAssertionCurrentHead | null> {
  const nowMs = Date.now();
  if (
    !validCurrentHeadCandidate(candidate) ||
    !nonEmpty(verifier?.verifierId) ||
    Date.parse(candidate.verifiedAt) > nowMs ||
    Date.parse(candidate.expiresAt) <= nowMs
  ) {
    return null;
  }
  const snapshot = Object.freeze({ ...candidate });
  const semanticSha256 = currentHeadSemanticSha256(snapshot);
  let approved = false;
  try {
    approved = await verifier.verifyCurrentHead({
      candidate: snapshot,
      semanticSha256,
    });
  } catch {
    return null;
  }
  if (!approved) return null;
  const verified = {
    ...snapshot,
    verifierId: verifier.verifierId,
    semanticSha256,
  } as VerifiedConsumerAssertionCurrentHead;
  Object.defineProperty(verified, VERIFIED_CONSUMER_ASSERTION_CURRENT_HEAD, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedCurrentHeads.add(verified);
  verifiedCurrentHeadDigests.set(verified, semanticSha256);
  return Object.freeze(verified);
}

function validVerifiedCurrentHead(
  head: VerifiedConsumerAssertionCurrentHead | null | undefined,
  nowMs: number,
): head is VerifiedConsumerAssertionCurrentHead {
  if (
    !head ||
    head[VERIFIED_CONSUMER_ASSERTION_CURRENT_HEAD] !== true ||
    !verifiedCurrentHeads.has(head) ||
    verifiedCurrentHeadDigests.get(head) !== head.semanticSha256
  ) {
    return false;
  }
  const candidate = Object.fromEntries(
    Object.entries(head).filter(
      ([key]) => key !== "verifierId" && key !== "semanticSha256",
    ),
  ) as unknown as ConsumerAssertionCurrentHeadCandidate;
  return (
    validCurrentHeadCandidate(candidate) &&
    currentHeadSemanticSha256(candidate) === head.semanticSha256 &&
    Date.parse(head.verifiedAt) <= nowMs &&
    Date.parse(head.expiresAt) > nowMs
  );
}

export function verifiedConsumerAssertionReceiptIsCurrent(input: {
  readonly receipt: VerifiedConsumerAssertionReceipt;
  readonly currentObservation: ObservationBinding;
  readonly currentHead: VerifiedConsumerAssertionCurrentHead;
}): boolean {
  const { receipt } = input;
  const nowMs = Date.now();
  if (
    receipt?.[VERIFIED_CONSUMER_ASSERTION_RECEIPT] !== true ||
    !verifiedConsumerAssertionReceipts.has(receipt) ||
    verifiedConsumerAssertionDigests.get(receipt) !== receipt.semanticSha256 ||
    computeConsumerAssertionRuntimeIntegritySha256(receipt.assertion) !==
      receipt.semanticSha256 ||
    receipt.assertion.integritySha256 !== receipt.semanticSha256 ||
    !validRecord(receipt.assertion) ||
    receipt.assertion.disposition === "REVOKED" ||
    (receipt.assertion.expiresAt !== null &&
      Date.parse(receipt.assertion.expiresAt) <= nowMs) ||
    !validVerifiedCurrentHead(input.currentHead, nowMs) ||
    input.currentHead.tenantId !== receipt.assertion.binding.tenantId ||
    input.currentHead.consumerId !== receipt.assertion.binding.consumerId ||
    input.currentHead.assertionSeriesKey !==
      receipt.assertion.assertionSeriesKey ||
    input.currentHead.headAssertionId !== receipt.assertion.assertionId ||
    input.currentHead.headVersion !== receipt.assertion.version ||
    input.currentHead.headIntegritySha256 !==
      receipt.assertion.integritySha256
  ) {
    return false;
  }
  return validateConsumerAssertionBinding(
    receipt.assertion,
    input.currentObservation,
  ).valid;
}
