import { createHash, randomUUID } from "node:crypto";
import type { P0Principal } from "./principal";
import { p0ScopeFromPrincipal } from "./principal";
import type { P0Repository, P0RepositoryPurpose } from "./repository";
import {
  computeP0RepositorySemanticSha256,
  computeP0RepositorySourceSetSha256,
  isVerifiedP0RepositoryAttestation,
  type VerifiedP0RepositoryAttestation,
} from "./repositoryAttestation";
import {
  isVerifiedP0SourceArtifactWriteReceipt,
  type VerifiedP0SourceArtifactWriteReceipt,
} from "./sourceArtifact";
import {
  runP0PostgresTransaction,
  type VerifiedP0PostgresRetryAttestation,
} from "./postgresTransaction";
import {
  p0Phase2AGatePermitAuthorizes,
  type P0Phase2AGatePermit,
} from "./phase2Flags";

export const P0_REPORT_INGESTION_CONTRACT_VERSION = "p0-report-ingestion-v1" as const;
export const P0_REPORT_INGESTION_STATES = [
  "RECEIVED", "SOURCE_STORED_AND_VERIFIED", "VERSION_COMMITTED", "EXTRACTING",
  "SUCCEEDED", "PARTIAL", "FAILED", "ASSESSED", "ROUND0_READY",
  "OUTCOME_UNKNOWN", "QUARANTINED",
] as const;
export type P0ReportIngestionState = (typeof P0_REPORT_INGESTION_STATES)[number];

export interface P0ReportVersionCommitReadback {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly reportSeriesKey: string;
  readonly version: number;
  readonly inputSha256: string;
  readonly authorityStatus: "SHADOW_V2";
  /** Artifact is created only after exact source storage/readback succeeds. */
  readonly sourceArtifact: {
    readonly tenantId: string;
    readonly consumerId: string;
    readonly artifactId: string;
    readonly artifactVersion: number;
    readonly artifactKind: "REPORT_SOURCE";
    readonly reportVersionId: string;
    readonly sha256: string;
    readonly mimeType: string;
    readonly byteLength: number;
    readonly storageProviderKey: string;
    readonly storageLocatorCiphertext: string;
    readonly storageLocatorIv: string;
    readonly storageLocatorAuthTag: string;
    readonly storageLocatorKeyVersion: string;
    readonly storageLocatorAlgorithm: "AES_256_GCM";
    readonly storageLocatorEnvelopeVersion: string;
    readonly storageLocatorAadVersion: string;
    readonly createdByActorId: string;
  };
}

export interface P0ExtractionRunReadback {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly extractionRunId: string;
  readonly inputArtifactId: string;
  readonly inputSha256: string;
  readonly inputRepresentation: "ORIGINAL_REPORT_BYTES" | "DERIVED_NORMALIZED_TEXT";
  readonly status: "SUCCEEDED" | "PARTIAL" | "FAILED";
}

/** Local mirror of the additive ReportIngestion schema; byte columns are base64. */
export interface P0ReportIngestion {
  readonly contractVersion: typeof P0_REPORT_INGESTION_CONTRACT_VERSION;
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly actorId: string;
  readonly authorizationKind: P0Principal["authorizationKind"];
  readonly authorizationVersion: string;
  readonly idempotencyKey: string;
  readonly operationKey: string;
  readonly reportSeriesKey: string;
  readonly reservedVersion: number;
  readonly sourceSha256: string;
  readonly sourceByteLength: number;
  readonly sourceDeclaredMimeType: string;
  readonly sourceDetectedMimeType: string;
  readonly sourceStorageProviderKey: string | null;
  readonly sourceLocatorCiphertext: string | null;
  readonly sourceLocatorIv: string | null;
  readonly sourceLocatorAuthTag: string | null;
  readonly sourceLocatorKeyVersion: string | null;
  readonly sourceLocatorAlgorithm: "AES_256_GCM" | null;
  readonly sourceLocatorEnvelopeVersion: string | null;
  readonly sourceLocatorAadVersion: string | null;
  readonly sourceReadbackSha256: string | null;
  readonly sourceReadbackByteLength: number | null;
  readonly sourceVerifiedAt: string | null;
  readonly sourceDisposition: "RETAINED" | "TOMBSTONE_REQUESTED" | "OBJECT_DELETED" | "CRYPTO_SHREDDED" | "DISPOSITION_FAILED";
  readonly sourceDispositionReasonCode: string | null;
  readonly sourceDispositionAt: string | null;
  readonly state: P0ReportIngestionState;
  readonly safeFailureCode: string | null;
  readonly revision: number;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly leaseToken: string | null;
  readonly leaseOwnerId: string | null;
  readonly leaseExpiresAt: string | null;
  readonly nextAttemptAt: string | null;
  readonly reportVersionId: string | null;
  readonly sourceArtifactId: string | null;
  readonly extractionRunId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type P0IngestionServiceResult =
  | { readonly ok: true; readonly kind: "RESERVED" | "IDEMPOTENT_REPLAY" | "FOUND" | "CLAIMED" | "TRANSITIONED" | "RECOVERED" | "RECONCILED"; readonly ingestion: P0ReportIngestion }
  | { readonly ok: false; readonly kind: "DENIED" | "NOT_FOUND" | "CONFLICT" | "BUSY" | "ATTEMPTS_EXHAUSTED" | "DEADLOCK_DETECTED" | "OUTCOME_UNKNOWN"; readonly code: string };

interface RetryInput { readonly retryAttestation?: VerifiedP0PostgresRetryAttestation }
export interface P0ReportIngestionService {
  reserve(input: RetryInput & {
    readonly principal: P0Principal; readonly idempotencyKey: string; readonly operationKey: string;
    readonly gatePermit: P0Phase2AGatePermit;
    readonly reportSeriesKey: string; readonly reservedVersion: number;
    readonly sourceSha256: string; readonly sourceByteLength: number;
    readonly sourceDeclaredMimeType: string; readonly sourceDetectedMimeType: string;
    readonly maxAttempts?: number;
  }): Promise<P0IngestionServiceResult>;
  read(input: { readonly principal: P0Principal; readonly ingestionId: string; readonly operationId: string }): Promise<P0IngestionServiceResult>;
  claim(input: RetryInput & { readonly principal: P0Principal; readonly gatePermit: P0Phase2AGatePermit; readonly ingestionId: string; readonly operationId: string; readonly leaseMs: number }): Promise<P0IngestionServiceResult>;
  transition(input: RetryInput & {
    readonly principal: P0Principal; readonly ingestionId: string; readonly operationId: string;
    readonly gatePermit: P0Phase2AGatePermit;
    readonly expectedRevision: number; readonly leaseToken: string; readonly to: P0ReportIngestionState;
    readonly sourceReceipt?: VerifiedP0SourceArtifactWriteReceipt;
    readonly reportVersionReceipt?: VerifiedP0RepositoryAttestation<P0ReportVersionCommitReadback>;
    readonly extractionRunReceipt?: VerifiedP0RepositoryAttestation<P0ExtractionRunReadback>;
    readonly extractionInputReceipt?: VerifiedP0SourceArtifactWriteReceipt;
    readonly safeFailureCode?: string; readonly nextAttemptAt?: string;
  }): Promise<P0IngestionServiceResult>;
  recoverExpired(input: RetryInput & { readonly principal: P0Principal; readonly gatePermit: P0Phase2AGatePermit; readonly ingestionId: string; readonly operationId: string }): Promise<P0IngestionServiceResult>;
  reconcile(input: {
    readonly principal: P0Principal;
    readonly gatePermit: P0Phase2AGatePermit;
    readonly ingestionId: string;
    readonly operationId: string;
    readonly expectedRevision: number;
    readonly receipt: VerifiedP0RepositoryAttestation<P0ReportIngestion>;
    readonly retryAttestation?: VerifiedP0PostgresRetryAttestation;
  }): Promise<P0IngestionServiceResult>;
}

const SHA256 = /^[a-f0-9]{64}$/;
const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SAFE = /^[A-Z][A-Z0-9_]{0,63}$/;
const MIME = /^(?:application\/pdf|text\/plain)$/;

function strictInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]! || hour > 23 || minute > 59 || second > 59) return false;
  if (match[8] === "-00:00") return false;
  if (match[8] !== "Z") {
    const oh = Number(match[8]!.slice(1, 3)), om = Number(match[8]!.slice(4, 6));
    if (oh > 14 || om > 59 || (oh === 14 && om !== 0)) return false;
  }
  return true;
}
const instantMs = (value: string | null): number | null => value && strictInstant(value) ? Date.parse(value) : null;

function idFor(scope: { tenantId: string; consumerId: string }, idempotencyKey: string): string {
  return `p0ing_${createHash("sha256").update(JSON.stringify([scope.tenantId, scope.consumerId, idempotencyKey])).digest("hex").slice(0, 40)}`;
}
const resource = (id: string) => Object.freeze({ resourceType: "REPORT_INGESTION", resourceId: id, resourceVersion: "state-v1" });
const context = (
  principal: P0Principal,
  purpose: P0RepositoryPurpose,
  operationId: string,
  gatePermit?: P0Phase2AGatePermit,
) => Object.freeze({ principal, scope: p0ScopeFromPrincipal(principal), purpose, operationId, gatePermit });

function exactRepositoryAttestation<T>(input: {
  readonly value: T;
  readonly attestation: VerifiedP0RepositoryAttestation<T> | undefined;
  readonly expected: T;
  readonly principal: P0Principal;
  readonly purpose: P0RepositoryPurpose;
  readonly operationId: string;
  readonly ingestionId: string;
}): boolean {
  try {
    const scope = p0ScopeFromPrincipal(input.principal);
    const expectedSha256 = computeP0RepositorySemanticSha256(input.expected);
    return Boolean(
      isVerifiedP0RepositoryAttestation(input.attestation) &&
      input.attestation.operationId === input.operationId &&
      input.attestation.purpose === input.purpose &&
      input.attestation.scope.tenantId === scope.tenantId &&
      input.attestation.scope.consumerId === scope.consumerId &&
      input.attestation.semanticSha256 === expectedSha256 &&
      input.attestation.sourceSetSha256 === computeP0RepositorySourceSetSha256([resource(input.ingestionId)]) &&
      computeP0RepositorySemanticSha256(input.attestation.snapshot) === expectedSha256 &&
      computeP0RepositorySemanticSha256(input.value) === expectedSha256
    );
  } catch {
    return false;
  }
}

function gateAllows(
  principal: P0Principal,
  permit: P0Phase2AGatePermit | undefined,
  operationId: string,
): boolean {
  if (!STABLE.test(operationId)) return false;
  try {
    return p0Phase2AGatePermitAuthorizes({
      permit,
      principal,
      scope: p0ScopeFromPrincipal(principal),
      stage: "INGESTION_SHADOW",
      mode: "LOCAL_BUILD",
      operationId,
    });
  } catch {
    return false;
  }
}

function validRow(row: P0ReportIngestion): boolean {
  return Boolean(row && row.contractVersion === P0_REPORT_INGESTION_CONTRACT_VERSION && STABLE.test(row.id) && STABLE.test(row.tenantId) && STABLE.test(row.consumerId) && STABLE.test(row.actorId) && STABLE.test(row.authorizationVersion) && STABLE.test(row.idempotencyKey) && STABLE.test(row.operationKey) && STABLE.test(row.reportSeriesKey) && Number.isSafeInteger(row.reservedVersion) && row.reservedVersion >= 1 && SHA256.test(row.sourceSha256) && Number.isSafeInteger(row.sourceByteLength) && row.sourceByteLength > 0 && MIME.test(row.sourceDeclaredMimeType) && MIME.test(row.sourceDetectedMimeType) && P0_REPORT_INGESTION_STATES.includes(row.state) && Number.isSafeInteger(row.revision) && row.revision >= 1 && Number.isSafeInteger(row.attemptCount) && row.attemptCount >= 0 && Number.isSafeInteger(row.maxAttempts) && row.maxAttempts >= 1 && row.maxAttempts <= 3 && (row.safeFailureCode === null || SAFE.test(row.safeFailureCode)) && strictInstant(row.createdAt) && strictInstant(row.updatedAt) && (row.nextAttemptAt === null || strictInstant(row.nextAttemptAt)) && (row.leaseExpiresAt === null || strictInstant(row.leaseExpiresAt)) && (row.sourceVerifiedAt === null || strictInstant(row.sourceVerifiedAt)) && (row.sourceDispositionAt === null || strictInstant(row.sourceDispositionAt)));
}

function exactImmutableIngestionIdentity(current: P0ReportIngestion, next: P0ReportIngestion): boolean {
  return ["id", "tenantId", "consumerId", "actorId", "authorizationKind", "authorizationVersion", "idempotencyKey", "operationKey", "reportSeriesKey", "reservedVersion", "sourceSha256", "sourceByteLength", "sourceDeclaredMimeType", "sourceDetectedMimeType", "maxAttempts", "createdAt"].every((key) => current[key as keyof P0ReportIngestion] === next[key as keyof P0ReportIngestion]);
}

function reconciliationPinsAreExact(current: P0ReportIngestion, next: P0ReportIngestion, nowMs: number): boolean {
  const allowedTargets: readonly P0ReportIngestionState[] = ["SOURCE_STORED_AND_VERIFIED", "VERSION_COMMITTED", "EXTRACTING", "SUCCEEDED", "PARTIAL", "FAILED", "ASSESSED", "ROUND0_READY", "QUARANTINED"];
  const sourceRequired = ["SOURCE_STORED_AND_VERIFIED", "VERSION_COMMITTED", "EXTRACTING", "SUCCEEDED", "PARTIAL", "ASSESSED", "ROUND0_READY"].includes(next.state);
  const versionRequired = ["VERSION_COMMITTED", "EXTRACTING", "SUCCEEDED", "PARTIAL", "ASSESSED", "ROUND0_READY"].includes(next.state);
  const runRequired = ["SUCCEEDED", "PARTIAL", "ASSESSED", "ROUND0_READY"].includes(next.state);
  const sourceExact = next.sourceStorageProviderKey !== null && next.sourceReadbackSha256 === next.sourceSha256 && next.sourceReadbackByteLength === next.sourceByteLength && next.sourceVerifiedAt !== null;
  const oneWay = ["sourceStorageProviderKey", "sourceLocatorCiphertext", "sourceLocatorIv", "sourceLocatorAuthTag", "sourceLocatorKeyVersion", "sourceLocatorAlgorithm", "sourceLocatorEnvelopeVersion", "sourceLocatorAadVersion", "sourceReadbackSha256", "sourceReadbackByteLength", "sourceVerifiedAt", "reportVersionId", "sourceArtifactId", "extractionRunId"].every((key) => current[key as keyof P0ReportIngestion] === null || current[key as keyof P0ReportIngestion] === next[key as keyof P0ReportIngestion]);
  const updatedAt = strictInstant(next.updatedAt) ? Date.parse(next.updatedAt) : NaN;
  return Boolean(
    current.state === "OUTCOME_UNKNOWN" &&
    allowedTargets.includes(next.state) &&
    next.revision === current.revision + 1 &&
    next.attemptCount === current.attemptCount &&
    next.leaseToken === null && next.leaseOwnerId === null && next.leaseExpiresAt === null &&
    next.sourceDisposition === current.sourceDisposition &&
    next.sourceDispositionReasonCode === current.sourceDispositionReasonCode &&
    next.sourceDispositionAt === current.sourceDispositionAt &&
    oneWay &&
    (!sourceRequired || sourceExact) &&
    (!versionRequired || (next.reportVersionId !== null && next.sourceArtifactId !== null)) &&
    (!runRequired || next.extractionRunId !== null) &&
    (["FAILED", "QUARANTINED"].includes(next.state) ? SAFE.test(next.safeFailureCode ?? "") : next.safeFailureCode === null) &&
    Number.isFinite(updatedAt) && updatedAt <= nowMs + 1_000 && nowMs - updatedAt <= 30_000
  );
}

const ALLOWED: Readonly<Record<P0ReportIngestionState, readonly P0ReportIngestionState[]>> = Object.freeze({
  RECEIVED: ["SOURCE_STORED_AND_VERIFIED", "FAILED", "OUTCOME_UNKNOWN", "QUARANTINED"],
  SOURCE_STORED_AND_VERIFIED: ["VERSION_COMMITTED", "FAILED", "OUTCOME_UNKNOWN", "QUARANTINED"],
  VERSION_COMMITTED: ["EXTRACTING", "FAILED", "OUTCOME_UNKNOWN", "QUARANTINED"],
  EXTRACTING: ["SUCCEEDED", "PARTIAL", "FAILED", "OUTCOME_UNKNOWN", "QUARANTINED"],
  SUCCEEDED: ["ASSESSED", "QUARANTINED"], PARTIAL: ["ASSESSED", "QUARANTINED"], FAILED: ["ASSESSED", "QUARANTINED"],
  ASSESSED: ["ROUND0_READY", "QUARANTINED"], ROUND0_READY: [], OUTCOME_UNKNOWN: ["QUARANTINED"], QUARANTINED: [],
});

export function p0ExhaustedRecoveryState(state: P0ReportIngestionState): P0ReportIngestionState | null {
  if (["RECEIVED", "SOURCE_STORED_AND_VERIFIED", "VERSION_COMMITTED", "EXTRACTING"].includes(state)) return "FAILED";
  if (["SUCCEEDED", "PARTIAL", "ASSESSED", "OUTCOME_UNKNOWN"].includes(state)) return "QUARANTINED";
  if (state === "FAILED") return "FAILED";
  return null;
}

function txFailure(kind: string): P0IngestionServiceResult {
  return kind === "DEADLOCK_DETECTED" || kind === "DEADLOCK_RETRY_EXHAUSTED"
    ? { ok: false, kind: "DEADLOCK_DETECTED", code: kind }
    : kind === "INPUT_REJECTED" || kind === "VALIDATION_REJECTED"
      ? { ok: false, kind: "DENIED", code: kind }
      : { ok: false, kind: "OUTCOME_UNKNOWN", code: "INGESTION_WRITE_OUTCOME_UNKNOWN" };
}

async function transact<T>(operationId: string, retryAttestation: VerifiedP0PostgresRetryAttestation | undefined, execute: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; result: P0IngestionServiceResult }> {
  const result = await runP0PostgresTransaction({ operationId, retryAttestation, execute });
  return result.ok ? { ok: true, value: result.value } : { ok: false, result: txFailure(result.kind) };
}

function sourcePins(row: P0ReportIngestion, receipt: VerifiedP0SourceArtifactWriteReceipt | undefined): Partial<P0ReportIngestion> | null {
  if (!receipt || !isVerifiedP0SourceArtifactWriteReceipt(receipt)) return null;
  const object = receipt.object;
  if (object.scope.tenantId !== row.tenantId || object.scope.consumerId !== row.consumerId || object.scope.ingestionId !== row.id || object.sha256 !== row.sourceSha256 || object.byteLength !== row.sourceByteLength || object.mimeType !== row.sourceDetectedMimeType || receipt.readbackSha256 !== row.sourceSha256 || receipt.readbackByteLength !== row.sourceByteLength) return null;
  return {
    sourceStorageProviderKey: object.providerKey,
    sourceLocatorCiphertext: object.locator.ciphertextBase64,
    sourceLocatorIv: object.locator.ivBase64,
    sourceLocatorAuthTag: object.locator.authTagBase64,
    sourceLocatorKeyVersion: object.locator.keyVersion,
    sourceLocatorAlgorithm: object.locator.algorithm,
    sourceLocatorEnvelopeVersion: object.locator.envelopeVersion,
    sourceLocatorAadVersion: object.locator.aadVersion,
    sourceReadbackSha256: receipt.readbackSha256,
    sourceReadbackByteLength: receipt.readbackByteLength,
    sourceVerifiedAt: receipt.verifiedAt,
  };
}

export function createP0ReportIngestionService(repository: P0Repository): P0ReportIngestionService {
  const idempotencyReservations = new Map<string, string>();
  const versionReservations = new Map<string, string>();
  const indexKey = (tenantId: string, consumerId: string, value: string) => `${tenantId}\u001f${consumerId}\u001f${value}`;

  async function readRow(principal: P0Principal, id: string, operationId: string, purpose: P0RepositoryPurpose): Promise<P0IngestionServiceResult> {
    if (!STABLE.test(id) || !STABLE.test(operationId)) return { ok: false, kind: "DENIED", code: "INVALID_INGESTION_SELECTOR" };
    let result;
    try { result = await repository.readExact<P0ReportIngestion>(context(principal, purpose, operationId), resource(id)); }
    catch { return { ok: false, kind: "OUTCOME_UNKNOWN", code: "INGESTION_READ_OUTCOME_UNKNOWN" }; }
    if (result.kind === "DENIED") return { ok: false, kind: "DENIED", code: "REPOSITORY_DENIED" };
    if (result.kind === "NOT_FOUND") return { ok: false, kind: "NOT_FOUND", code: "INGESTION_NOT_FOUND" };
    if (result.kind === "OUTCOME_UNKNOWN" || !validRow(result.value) || !exactRepositoryAttestation({ value: result.value, attestation: result.attestation, expected: result.value, principal, purpose, operationId, ingestionId: id })) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "INGESTION_READ_UNATTESTED" };
    return { ok: true, kind: "FOUND", ingestion: result.value };
  }

  const service: P0ReportIngestionService = {
    async reserve(
      input: Parameters<P0ReportIngestionService["reserve"]>[0],
    ): Promise<P0IngestionServiceResult> {
      let scope; try { scope = p0ScopeFromPrincipal(input.principal); } catch { return { ok: false, kind: "DENIED", code: "UNVERIFIED_PRINCIPAL" }; }
      const maxAttempts = input.maxAttempts ?? 3;
      if (!gateAllows(input.principal, input.gatePermit, input.operationKey)) return { ok: false, kind: "DENIED", code: "INGESTION_GATE_DENIED" };
      if (!STABLE.test(input.idempotencyKey) || !STABLE.test(input.operationKey) || !STABLE.test(input.reportSeriesKey) || !Number.isSafeInteger(input.reservedVersion) || input.reservedVersion < 1 || !SHA256.test(input.sourceSha256) || !Number.isSafeInteger(input.sourceByteLength) || input.sourceByteLength < 1 || !MIME.test(input.sourceDeclaredMimeType) || !MIME.test(input.sourceDetectedMimeType) || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) return { ok: false, kind: "DENIED", code: "INVALID_INGESTION_RESERVATION" };
      const id = idFor(scope, input.idempotencyKey);
      const idKey = indexKey(scope.tenantId, scope.consumerId, `idempotency:${input.idempotencyKey}`);
      const versionKey = indexKey(scope.tenantId, scope.consumerId, `version:${input.reportSeriesKey}:${input.reservedVersion}`);
      const existingId = idempotencyReservations.get(idKey), existingVersion = versionReservations.get(versionKey);
      if ((existingId && existingId !== id) || (existingVersion && existingVersion !== id)) return { ok: false, kind: "CONFLICT", code: "DUPLICATE_REPORT_VERSION_RESERVATION" };
      if (existingId === id || existingVersion === id) {
        const replay = await readRow(input.principal, id, `${input.operationKey}:replay`, "INGESTION_RESERVE");
        if (replay.ok) {
          const row = replay.ingestion;
          const exact = row.actorId === input.principal.actorId && row.authorizationKind === input.principal.authorizationKind && row.authorizationVersion === input.principal.authorizationVersion && row.idempotencyKey === input.idempotencyKey && row.operationKey === input.operationKey && row.reportSeriesKey === input.reportSeriesKey && row.reservedVersion === input.reservedVersion && row.sourceSha256 === input.sourceSha256 && row.sourceByteLength === input.sourceByteLength && row.sourceDeclaredMimeType === input.sourceDeclaredMimeType && row.sourceDetectedMimeType === input.sourceDetectedMimeType && row.maxAttempts === maxAttempts;
          return exact ? { ok: true, kind: "IDEMPOTENT_REPLAY", ingestion: row } : { ok: false, kind: "CONFLICT", code: "IDEMPOTENCY_CONFLICT" };
        }
        if (replay.kind !== "NOT_FOUND") return replay;
      }
      idempotencyReservations.set(idKey, id); versionReservations.set(versionKey, id);
      const now = new Date().toISOString();
      const row: P0ReportIngestion = Object.freeze({
        contractVersion: P0_REPORT_INGESTION_CONTRACT_VERSION, id, tenantId: scope.tenantId, consumerId: scope.consumerId,
        actorId: input.principal.actorId, authorizationKind: input.principal.authorizationKind, authorizationVersion: input.principal.authorizationVersion,
        idempotencyKey: input.idempotencyKey, operationKey: input.operationKey, reportSeriesKey: input.reportSeriesKey, reservedVersion: input.reservedVersion,
        sourceSha256: input.sourceSha256, sourceByteLength: input.sourceByteLength, sourceDeclaredMimeType: input.sourceDeclaredMimeType, sourceDetectedMimeType: input.sourceDetectedMimeType,
        sourceStorageProviderKey: null, sourceLocatorCiphertext: null, sourceLocatorIv: null, sourceLocatorAuthTag: null, sourceLocatorKeyVersion: null, sourceLocatorAlgorithm: null, sourceLocatorEnvelopeVersion: null, sourceLocatorAadVersion: null,
        sourceReadbackSha256: null, sourceReadbackByteLength: null, sourceVerifiedAt: null, sourceDisposition: "RETAINED", sourceDispositionReasonCode: null, sourceDispositionAt: null,
        state: "RECEIVED", safeFailureCode: null, revision: 1, attemptCount: 0, maxAttempts, leaseToken: null, leaseOwnerId: null, leaseExpiresAt: null, nextAttemptAt: now,
        reportVersionId: null, sourceArtifactId: null, extractionRunId: null, createdAt: now, updatedAt: now,
      });
      const tx = await transact(input.operationKey, input.retryAttestation, () => repository.createExact(context(input.principal, "INGESTION_RESERVE", input.operationKey, input.gatePermit), resource(id), row));
      if (!tx.ok) return tx.result;
      const result = tx.value;
      if (result.kind === "DENIED") { idempotencyReservations.delete(idKey); versionReservations.delete(versionKey); return { ok: false, kind: "DENIED", code: "REPOSITORY_DENIED" }; }
      if (result.kind === "CONFLICT") return { ok: false, kind: "CONFLICT", code: "IDEMPOTENCY_CONFLICT" };
      if (result.kind === "OUTCOME_UNKNOWN") return { ok: false, kind: "OUTCOME_UNKNOWN", code: "RESERVATION_REQUIRES_RECONCILIATION" };
      if (!exactRepositoryAttestation({ value: result.value, attestation: result.attestation, expected: row, principal: input.principal, purpose: "INGESTION_RESERVE", operationId: input.operationKey, ingestionId: id })) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "RESERVATION_READBACK_UNATTESTED" };
      return { ok: true, kind: result.kind === "IDEMPOTENT_REPLAY" ? "IDEMPOTENT_REPLAY" : "RESERVED", ingestion: result.value };
    },
    async read(
      input: Parameters<P0ReportIngestionService["read"]>[0],
    ): Promise<P0IngestionServiceResult> { return readRow(input.principal, input.ingestionId, input.operationId, "INGESTION_TRANSITION"); },
    async claim(
      input: Parameters<P0ReportIngestionService["claim"]>[0],
    ): Promise<P0IngestionServiceResult> {
      if (input.principal.authorizationKind !== "SYSTEM_WORKER" || !gateAllows(input.principal, input.gatePermit, input.operationId)) return { ok: false, kind: "DENIED", code: "INGESTION_GATE_DENIED" };
      const read = await readRow(input.principal, input.ingestionId, `${input.operationId}:read`, "INGESTION_CLAIM"); if (!read.ok) return read;
      const row = read.ingestion, now = new Date(), nowMs = now.getTime();
      if (!Number.isSafeInteger(input.leaseMs) || input.leaseMs < 1_000 || input.leaseMs > 300_000) return { ok: false, kind: "DENIED", code: "INVALID_LEASE_DURATION" };
      if ((instantMs(row.leaseExpiresAt) ?? -Infinity) > nowMs || (instantMs(row.nextAttemptAt) ?? -Infinity) > nowMs) return { ok: false, kind: "BUSY", code: "INGESTION_NOT_CLAIMABLE" };
      if (row.attemptCount >= row.maxAttempts) return { ok: false, kind: "ATTEMPTS_EXHAUSTED", code: "INGESTION_ATTEMPTS_EXHAUSTED" };
      if (["ROUND0_READY", "QUARANTINED", "OUTCOME_UNKNOWN"].includes(row.state) || (row.state === "FAILED" && row.extractionRunId === null)) return { ok: false, kind: "CONFLICT", code: "INGESTION_STATE_NOT_CLAIMABLE" };
      const next = Object.freeze({ ...row, revision: row.revision + 1, attemptCount: row.attemptCount + 1, leaseOwnerId: input.principal.actorId, leaseToken: randomUUID(), leaseExpiresAt: new Date(nowMs + input.leaseMs).toISOString(), updatedAt: now.toISOString() });
      const tx = await transact(input.operationId, input.retryAttestation, () => repository.compareAndSwapExact(context(input.principal, "INGESTION_CLAIM", input.operationId, input.gatePermit), resource(row.id), row, next)); if (!tx.ok) return tx.result;
      if (tx.value.kind === "CONFLICT") return { ok: false, kind: "CONFLICT", code: "STALE_INGESTION_REVISION" }; if (tx.value.kind === "DENIED") return { ok: false, kind: "DENIED", code: "REPOSITORY_DENIED" }; if (tx.value.kind === "OUTCOME_UNKNOWN") return { ok: false, kind: "OUTCOME_UNKNOWN", code: "CLAIM_REQUIRES_RECONCILIATION" };
      if (!exactRepositoryAttestation({ value: tx.value.value, attestation: tx.value.attestation, expected: next, principal: input.principal, purpose: "INGESTION_CLAIM", operationId: input.operationId, ingestionId: row.id })) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "CLAIM_READBACK_UNATTESTED" };
      return { ok: true, kind: "CLAIMED", ingestion: tx.value.value };
    },
    async transition(
      input: Parameters<P0ReportIngestionService["transition"]>[0],
    ): Promise<P0IngestionServiceResult> {
      if (input.principal.authorizationKind !== "SYSTEM_WORKER" || !gateAllows(input.principal, input.gatePermit, input.operationId)) return { ok: false, kind: "DENIED", code: "INGESTION_GATE_DENIED" };
      const read = await readRow(input.principal, input.ingestionId, `${input.operationId}:read`, "INGESTION_TRANSITION"); if (!read.ok) return read;
      const row = read.ingestion, now = new Date();
      if (row.revision !== input.expectedRevision || row.leaseToken !== input.leaseToken || row.leaseOwnerId !== input.principal.actorId || (instantMs(row.leaseExpiresAt) ?? -Infinity) <= now.getTime()) return { ok: false, kind: "CONFLICT", code: "STALE_WORKER_LEASE" };
      if (!ALLOWED[row.state].includes(input.to)) return { ok: false, kind: "CONFLICT", code: "INVALID_INGESTION_TRANSITION" };
      if (row.state === "FAILED" && input.to === "ASSESSED" && row.extractionRunId === null) return { ok: false, kind: "CONFLICT", code: "FAILED_WITHOUT_EXTRACTION_NOT_ASSESSABLE" };
      let pins: Partial<P0ReportIngestion> = {};
      if (input.to === "SOURCE_STORED_AND_VERIFIED") { const exact = sourcePins(row, input.sourceReceipt); if (!exact || row.sourceArtifactId !== null || row.reportVersionId !== null) return { ok: false, kind: "DENIED", code: "UNVERIFIED_SOURCE_READBACK" }; pins = exact; }
      else if (input.to === "VERSION_COMMITTED") {
        const receipt = input.reportVersionReceipt;
        if (!receipt || !isVerifiedP0RepositoryAttestation(receipt) || receipt.operationId !== input.operationId || receipt.purpose !== "REPORT_VERSION_COMMIT" || row.reportVersionId !== null || row.sourceArtifactId !== null) return { ok: false, kind: "DENIED", code: "UNVERIFIED_REPORT_VERSION" };
        const v = receipt.snapshot;
        const artifact = v.sourceArtifact;
        if (
          v.tenantId !== row.tenantId ||
          v.consumerId !== row.consumerId ||
          v.reportSeriesKey !== row.reportSeriesKey ||
          v.version !== row.reservedVersion ||
          v.inputSha256 !== row.sourceSha256 ||
          v.authorityStatus !== "SHADOW_V2" ||
          !STABLE.test(v.reportVersionId) ||
          !artifact ||
          artifact.tenantId !== row.tenantId ||
          artifact.consumerId !== row.consumerId ||
          !STABLE.test(artifact.artifactId) ||
          !Number.isSafeInteger(artifact.artifactVersion) ||
          artifact.artifactVersion < 1 ||
          artifact.artifactKind !== "REPORT_SOURCE" ||
          artifact.reportVersionId !== v.reportVersionId ||
          artifact.sha256 !== row.sourceSha256 ||
          artifact.mimeType !== row.sourceDetectedMimeType ||
          artifact.byteLength !== row.sourceByteLength ||
          artifact.storageProviderKey !== row.sourceStorageProviderKey ||
          artifact.storageLocatorCiphertext !== row.sourceLocatorCiphertext ||
          artifact.storageLocatorIv !== row.sourceLocatorIv ||
          artifact.storageLocatorAuthTag !== row.sourceLocatorAuthTag ||
          artifact.storageLocatorKeyVersion !== row.sourceLocatorKeyVersion ||
          artifact.storageLocatorAlgorithm !== row.sourceLocatorAlgorithm ||
          artifact.storageLocatorEnvelopeVersion !== row.sourceLocatorEnvelopeVersion ||
          artifact.storageLocatorAadVersion !== row.sourceLocatorAadVersion ||
          artifact.createdByActorId !== input.principal.actorId
        ) return { ok: false, kind: "DENIED", code: "REPORT_VERSION_SUBSTITUTION" };
        pins = { reportVersionId: v.reportVersionId, sourceArtifactId: artifact.artifactId };
      } else if (["SUCCEEDED", "PARTIAL"].includes(input.to) || (input.to === "FAILED" && row.state === "EXTRACTING")) {
        const receipt = input.extractionRunReceipt;
        if (!receipt || !isVerifiedP0RepositoryAttestation(receipt) || receipt.operationId !== input.operationId || receipt.purpose !== "SHADOW_EXTRACTION_WRITE" || row.extractionRunId !== null || !row.reportVersionId) return { ok: false, kind: "DENIED", code: "UNVERIFIED_EXTRACTION_RUN" };
        const run = receipt.snapshot;
        const originalInputMatches = run.inputRepresentation === "ORIGINAL_REPORT_BYTES" && run.inputArtifactId === row.sourceArtifactId && run.inputSha256 === row.sourceSha256;
        const derivedReceipt = input.extractionInputReceipt;
        const derivedInputMatches = run.inputRepresentation === "DERIVED_NORMALIZED_TEXT" && Boolean(
          derivedReceipt &&
          isVerifiedP0SourceArtifactWriteReceipt(derivedReceipt) &&
          derivedReceipt.object.scope.tenantId === row.tenantId &&
          derivedReceipt.object.scope.consumerId === row.consumerId &&
          derivedReceipt.object.scope.ingestionId === row.id &&
          derivedReceipt.object.scope.artifactId === run.inputArtifactId &&
          derivedReceipt.object.kind === "NORMALIZED_TEXT" &&
          derivedReceipt.object.sha256 === run.inputSha256 &&
          derivedReceipt.readbackSha256 === run.inputSha256
        );
        if (run.tenantId !== row.tenantId || run.consumerId !== row.consumerId || run.reportVersionId !== row.reportVersionId || run.status !== input.to || run.inputArtifactId.length < 1 || !SHA256.test(run.inputSha256) || (!originalInputMatches && !derivedInputMatches)) return { ok: false, kind: "DENIED", code: "EXTRACTION_RUN_SUBSTITUTION" };
        pins = { extractionRunId: run.extractionRunId };
      } else if (input.to === "FAILED" && (input.extractionRunReceipt !== undefined || input.extractionInputReceipt !== undefined)) {
        return { ok: false, kind: "DENIED", code: "UNEXPECTED_EXTRACTION_RUN" };
      }
      if (["FAILED", "OUTCOME_UNKNOWN", "QUARANTINED"].includes(input.to) && (!input.safeFailureCode || !SAFE.test(input.safeFailureCode))) return { ok: false, kind: "DENIED", code: "SAFE_FAILURE_CODE_REQUIRED" };
      if (!["FAILED", "OUTCOME_UNKNOWN", "QUARANTINED"].includes(input.to) && input.safeFailureCode !== undefined) return { ok: false, kind: "DENIED", code: "UNEXPECTED_FAILURE_CODE" };
      const nextAttemptAt = input.nextAttemptAt ?? now.toISOString(); if (!strictInstant(nextAttemptAt)) return { ok: false, kind: "DENIED", code: "INVALID_NEXT_ATTEMPT" };
      const extractionResultPinned = ["SUCCEEDED", "PARTIAL", "FAILED"].includes(input.to) && pins.extractionRunId !== undefined;
      const retainLease = ["SOURCE_STORED_AND_VERIFIED", "VERSION_COMMITTED", "EXTRACTING", "ASSESSED"].includes(input.to) || extractionResultPinned;
      const next = Object.freeze({ ...row, ...pins, state: input.to, safeFailureCode: input.safeFailureCode ?? null, revision: row.revision + 1, leaseToken: retainLease ? row.leaseToken : null, leaseOwnerId: retainLease ? row.leaseOwnerId : null, leaseExpiresAt: retainLease ? row.leaseExpiresAt : null, nextAttemptAt, updatedAt: now.toISOString() });
      const tx = await transact(input.operationId, input.retryAttestation, () => repository.compareAndSwapExact(context(input.principal, "INGESTION_TRANSITION", input.operationId, input.gatePermit), resource(row.id), row, next)); if (!tx.ok) return tx.result;
      if (tx.value.kind === "CONFLICT") return { ok: false, kind: "CONFLICT", code: "STALE_INGESTION_REVISION" }; if (tx.value.kind === "DENIED") return { ok: false, kind: "DENIED", code: "REPOSITORY_DENIED" }; if (tx.value.kind === "OUTCOME_UNKNOWN") return { ok: false, kind: "OUTCOME_UNKNOWN", code: "TRANSITION_REQUIRES_RECONCILIATION" };
      if (!exactRepositoryAttestation({ value: tx.value.value, attestation: tx.value.attestation, expected: next, principal: input.principal, purpose: "INGESTION_TRANSITION", operationId: input.operationId, ingestionId: row.id })) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "TRANSITION_READBACK_UNATTESTED" };
      return { ok: true, kind: "TRANSITIONED", ingestion: tx.value.value };
    },
    async recoverExpired(
      input: Parameters<P0ReportIngestionService["recoverExpired"]>[0],
    ): Promise<P0IngestionServiceResult> {
      if (input.principal.authorizationKind !== "SYSTEM_WORKER" || !gateAllows(input.principal, input.gatePermit, input.operationId)) return { ok: false, kind: "DENIED", code: "INGESTION_RECOVERY_GATE_DENIED" };
      const read = await readRow(input.principal, input.ingestionId, `${input.operationId}:read`, "INGESTION_RECOVERY"); if (!read.ok) return read; const row = read.ingestion;
      const now = new Date();
      if ((instantMs(row.leaseExpiresAt) ?? Infinity) > now.getTime()) return { ok: false, kind: "BUSY", code: "LEASE_NOT_EXPIRED" };
      if (["ROUND0_READY", "QUARANTINED"].includes(row.state)) return { ok: false, kind: "CONFLICT", code: "INGESTION_STATE_NOT_RECOVERABLE" };
      const exhausted = row.attemptCount >= row.maxAttempts;
      const exhaustedState = p0ExhaustedRecoveryState(row.state) ?? row.state;
      const next = Object.freeze({
        ...row,
        state: exhausted ? exhaustedState : row.state,
        safeFailureCode: exhausted
          ? row.state === "FAILED"
            ? row.safeFailureCode ?? "INGESTION_ATTEMPTS_EXHAUSTED"
            : "INGESTION_ATTEMPTS_EXHAUSTED"
          : row.safeFailureCode,
        revision: row.revision + 1,
        leaseToken: null,
        leaseOwnerId: null,
        leaseExpiresAt: null,
        nextAttemptAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      const tx = await transact(input.operationId, input.retryAttestation, () => repository.compareAndSwapExact(context(input.principal, "INGESTION_RECOVERY", input.operationId, input.gatePermit), resource(row.id), row, next)); if (!tx.ok) return tx.result;
      if (tx.value.kind === "CONFLICT") return { ok: false, kind: "CONFLICT", code: "STALE_INGESTION_REVISION" }; if (tx.value.kind === "DENIED") return { ok: false, kind: "DENIED", code: "REPOSITORY_DENIED" }; if (tx.value.kind === "OUTCOME_UNKNOWN") return { ok: false, kind: "OUTCOME_UNKNOWN", code: "RECOVERY_REQUIRES_RECONCILIATION" };
      if (!exactRepositoryAttestation({ value: tx.value.value, attestation: tx.value.attestation, expected: next, principal: input.principal, purpose: "INGESTION_RECOVERY", operationId: input.operationId, ingestionId: row.id })) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "RECOVERY_READBACK_UNATTESTED" };
      return { ok: true, kind: "RECOVERED", ingestion: tx.value.value };
    },
    async reconcile(
      input: Parameters<P0ReportIngestionService["reconcile"]>[0],
    ): Promise<P0IngestionServiceResult> {
      if (input.principal.authorizationKind !== "SYSTEM_WORKER" || !gateAllows(input.principal, input.gatePermit, input.operationId)) return { ok: false, kind: "DENIED", code: "INGESTION_RECONCILIATION_GATE_DENIED" };
      const read = await readRow(input.principal, input.ingestionId, `${input.operationId}:read`, "INGESTION_RECOVERY"); if (!read.ok) return read;
      const current = read.ingestion, receipt = input.receipt, now = new Date();
      if (current.state !== "OUTCOME_UNKNOWN" || current.revision !== input.expectedRevision) return { ok: false, kind: "CONFLICT", code: "RECONCILIATION_EXPECTATION_MISMATCH" };
      if (!receipt || !isVerifiedP0RepositoryAttestation(receipt) || receipt.operationId !== input.operationId || receipt.purpose !== "INGESTION_RECONCILIATION" || receipt.scope.tenantId !== current.tenantId || receipt.scope.consumerId !== current.consumerId || !validRow(receipt.snapshot) || !exactImmutableIngestionIdentity(current, receipt.snapshot) || !reconciliationPinsAreExact(current, receipt.snapshot, now.getTime())) return { ok: false, kind: "DENIED", code: "UNATTESTED_INGESTION_RECONCILIATION" };
      const tx = await transact(input.operationId, input.retryAttestation, () => repository.compareAndSwapExact(context(input.principal, "INGESTION_RECOVERY", input.operationId, input.gatePermit), resource(current.id), current, receipt.snapshot)); if (!tx.ok) return tx.result;
      if (tx.value.kind === "CONFLICT") return { ok: false, kind: "CONFLICT", code: "STALE_INGESTION_REVISION" }; if (tx.value.kind === "DENIED") return { ok: false, kind: "DENIED", code: "REPOSITORY_DENIED" }; if (tx.value.kind === "OUTCOME_UNKNOWN") return { ok: false, kind: "OUTCOME_UNKNOWN", code: "RECONCILIATION_WRITE_OUTCOME_UNKNOWN" };
      if (!exactRepositoryAttestation({ value: tx.value.value, attestation: tx.value.attestation, expected: receipt.snapshot, principal: input.principal, purpose: "INGESTION_RECOVERY", operationId: input.operationId, ingestionId: current.id })) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "RECONCILIATION_READBACK_UNATTESTED" };
      return { ok: true, kind: "RECONCILED", ingestion: tx.value.value };
    },
  };
  return Object.freeze(service);
}
