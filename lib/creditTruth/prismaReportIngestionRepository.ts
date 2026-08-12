import { createHash } from "node:crypto";
import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import {
  P0_REPOSITORY_PURPOSES,
  type P0Repository,
  type P0RepositoryContext,
  type P0RepositoryResourceKey,
  type P0RepositoryWriteResult,
} from "./repository";
import {
  P0_PRISMA_REPOSITORY_ID,
  P0_PRISMA_REPOSITORY_SEMANTICS_VERSION,
  computeP0RepositorySemanticSha256,
  verifyPrismaP0RepositoryReadback,
  type P0PrismaRepositoryAttestationVerifier,
  type P0RepositorySourceRef,
  type VerifiedP0RepositoryAttestation,
} from "./repositoryAttestation";
import type { P0ReportIngestion } from "./reportIngestion";
import { P0_REPORT_INGESTION_CONTRACT_VERSION } from "./reportIngestion";
import { p0Phase2AGatePermitAuthorizes } from "./phase2Flags";
import { isStrictIsoInstant } from "./progressIntelligence";

export const P0_PRISMA_REPORT_INGESTION_REPOSITORY_VERSION =
  "p0-prisma-report-ingestion-repository-v1" as const;
export const P0_PRISMA_SCOPE_BOOTSTRAP_VERSION =
  "p0-prisma-scope-bootstrap-v1" as const;

/** Minimal Prisma surface; the concrete application PrismaClient satisfies it. */
export interface P0PrismaTransactionalClient {
  $transaction<T>(
    operation: (transaction: any) => Promise<T>,
    options?: {
      readonly isolationLevel?: "Serializable";
      readonly maxWait?: number;
      readonly timeout?: number;
    },
  ): Promise<T>;
}

/**
 * The concrete principal adapter must re-read the live actor/grant inside every
 * authority transaction. A process-local principal brand alone is insufficient.
 */
export interface P0PrismaTransactionalPrincipalRevalidator {
  revalidateInTransaction(input: {
    readonly transaction: any;
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: string;
    readonly operationId: string;
  }): Promise<boolean>;
}

export interface P0PrismaReportIngestionRepositoryDependencies {
  readonly client: P0PrismaTransactionalClient;
  readonly principalRevalidator: P0PrismaTransactionalPrincipalRevalidator;
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
}

const SHA256 = /^[0-9a-f]{64}$/;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const MIME = /^(?:application\/pdf|text\/plain)$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const INGESTION_RESOURCE_VERSION = "state-v1";

const PRISMA_ATTESTATION_VERIFIER: P0PrismaRepositoryAttestationVerifier =
  Object.freeze({
    repositoryId: P0_PRISMA_REPOSITORY_ID,
    semanticsVersion: P0_PRISMA_REPOSITORY_SEMANTICS_VERSION,
    async verifyReadback(
      input: Parameters<P0PrismaRepositoryAttestationVerifier["verifyReadback"]>[0],
    ) {
      return (
        input.adapterClass === "AUTHENTICATED_TENANT_SCOPED_PRISMA" &&
        input.repositoryId === P0_PRISMA_REPOSITORY_ID &&
        input.semanticsVersion === P0_PRISMA_REPOSITORY_SEMANTICS_VERSION
      );
    },
  });

function stable(value: unknown): value is string {
  return typeof value === "string" && STABLE_ID.test(value);
}

function strictBase64(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || !BASE64.test(value)) {
    return false;
  }
  try {
    return Buffer.from(value, "base64").toString("base64") === value;
  } catch {
    return false;
  }
}

function nullableStable(value: unknown): value is string | null {
  return value === null || stable(value);
}

function nullableInstant(value: unknown): value is string | null {
  return value === null || isStrictIsoInstant(value);
}

function nullableBase64(value: unknown): value is string | null {
  return value === null || strictBase64(value);
}

function validReportIngestion(value: unknown): value is P0ReportIngestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as P0ReportIngestion;
  const locatorAllNull = [
    row.sourceStorageProviderKey,
    row.sourceLocatorCiphertext,
    row.sourceLocatorIv,
    row.sourceLocatorAuthTag,
    row.sourceLocatorKeyVersion,
    row.sourceLocatorAlgorithm,
    row.sourceLocatorEnvelopeVersion,
    row.sourceLocatorAadVersion,
  ].every((item) => item === null);
  const locatorAllPresent =
    stable(row.sourceStorageProviderKey) &&
    strictBase64(row.sourceLocatorCiphertext) &&
    strictBase64(row.sourceLocatorIv) &&
    strictBase64(row.sourceLocatorAuthTag) &&
    stable(row.sourceLocatorKeyVersion) &&
    row.sourceLocatorAlgorithm === "AES_256_GCM" &&
    stable(row.sourceLocatorEnvelopeVersion) &&
    stable(row.sourceLocatorAadVersion);
  const readbackAllNull =
    row.sourceReadbackSha256 === null &&
    row.sourceReadbackByteLength === null &&
    row.sourceVerifiedAt === null;
  const readbackAllPresent =
    SHA256.test(row.sourceReadbackSha256 ?? "") &&
    Number.isSafeInteger(row.sourceReadbackByteLength) &&
    (row.sourceReadbackByteLength ?? 0) > 0 &&
    isStrictIsoInstant(row.sourceVerifiedAt);

  return Boolean(
    row.contractVersion === P0_REPORT_INGESTION_CONTRACT_VERSION &&
      stable(row.id) &&
      stable(row.tenantId) &&
      stable(row.consumerId) &&
      stable(row.actorId) &&
      ["DIRECT_CONSUMER", "AGENCY_MANAGED_CLIENT", "ADMIN_DELEGATED", "SYSTEM_WORKER"].includes(
        row.authorizationKind,
      ) &&
      stable(row.authorizationVersion) &&
      stable(row.idempotencyKey) &&
      stable(row.operationKey) &&
      stable(row.reportSeriesKey) &&
      Number.isSafeInteger(row.reservedVersion) &&
      row.reservedVersion > 0 &&
      SHA256.test(row.sourceSha256) &&
      Number.isSafeInteger(row.sourceByteLength) &&
      row.sourceByteLength > 0 &&
      row.sourceByteLength <= 15_728_640 &&
      MIME.test(row.sourceDeclaredMimeType) &&
      MIME.test(row.sourceDetectedMimeType) &&
      (locatorAllNull || locatorAllPresent) &&
      (readbackAllNull || readbackAllPresent) &&
      ["RETAINED", "TOMBSTONE_REQUESTED", "OBJECT_DELETED", "CRYPTO_SHREDDED", "DISPOSITION_FAILED"].includes(
        row.sourceDisposition,
      ) &&
      (row.sourceDispositionReasonCode === null || SAFE_CODE.test(row.sourceDispositionReasonCode)) &&
      nullableInstant(row.sourceDispositionAt) &&
      [
        "RECEIVED",
        "SOURCE_STORED_AND_VERIFIED",
        "VERSION_COMMITTED",
        "EXTRACTING",
        "SUCCEEDED",
        "PARTIAL",
        "FAILED",
        "ASSESSED",
        "ROUND0_READY",
        "OUTCOME_UNKNOWN",
        "QUARANTINED",
      ].includes(row.state) &&
      (row.safeFailureCode === null || SAFE_CODE.test(row.safeFailureCode)) &&
      Number.isSafeInteger(row.revision) &&
      row.revision > 0 &&
      Number.isSafeInteger(row.attemptCount) &&
      row.attemptCount >= 0 &&
      Number.isSafeInteger(row.maxAttempts) &&
      row.maxAttempts >= 1 &&
      row.maxAttempts <= 3 &&
      row.attemptCount <= row.maxAttempts &&
      nullableStable(row.leaseToken) &&
      nullableStable(row.leaseOwnerId) &&
      nullableInstant(row.leaseExpiresAt) &&
      nullableInstant(row.nextAttemptAt) &&
      nullableStable(row.reportVersionId) &&
      nullableStable(row.sourceArtifactId) &&
      nullableStable(row.extractionRunId) &&
      isStrictIsoInstant(row.createdAt) &&
      isStrictIsoInstant(row.updatedAt) &&
      nullableBase64(row.sourceLocatorCiphertext) &&
      nullableBase64(row.sourceLocatorIv) &&
      nullableBase64(row.sourceLocatorAuthTag)
  );
}

function deterministicIngestionId(row: P0ReportIngestion): string {
  return `p0ing_${createHash("sha256")
    .update(JSON.stringify([row.tenantId, row.consumerId, row.idempotencyKey]))
    .digest("hex")
    .slice(0, 40)}`;
}

function exactResource(resource: P0RepositoryResourceKey): boolean {
  return Boolean(
    resource &&
      resource.resourceType === "REPORT_INGESTION" &&
      resource.resourceVersion === INGESTION_RESOURCE_VERSION &&
      stable(resource.resourceId),
  );
}

function exactContext(context: P0RepositoryContext, write: boolean): boolean {
  if (
    !context ||
    !P0_REPOSITORY_PURPOSES.includes(context.purpose) ||
    !stable(context.operationId) ||
    validateP0Principal(context.principal).length > 0 ||
    !p0PrincipalAuthorizesScope(context.principal, context.scope)
  ) {
    return false;
  }
  if (!write) return true;
  const permit = context.gatePermit;
  return Boolean(
    permit &&
      p0Phase2AGatePermitAuthorizes({
        permit,
        principal: context.principal,
        scope: context.scope,
        stage: "INGESTION_SHADOW",
        mode: permit.mode,
        operationId: context.operationId,
      }),
  );
}

function bytesToBase64(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  throw new Error("unexpected Prisma byte value");
}

function dateToIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error("unexpected Prisma date value");
  return date.toISOString();
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("unsafe Prisma integer value");
  return number;
}

function fromDatabase(row: any): P0ReportIngestion {
  const value: P0ReportIngestion = Object.freeze({
    contractVersion: P0_REPORT_INGESTION_CONTRACT_VERSION,
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    actorId: row.actorId,
    authorizationKind: row.authorizationKind,
    authorizationVersion: row.authorizationVersion,
    idempotencyKey: row.idempotencyKey,
    operationKey: row.operationKey,
    reportSeriesKey: row.reportSeriesKey,
    reservedVersion: row.reservedVersion,
    sourceSha256: row.sourceSha256,
    sourceByteLength: safeNumber(row.sourceByteLength)!,
    sourceDeclaredMimeType: row.sourceDeclaredMimeType,
    sourceDetectedMimeType: row.sourceDetectedMimeType,
    sourceStorageProviderKey: row.sourceStorageProviderKey,
    sourceLocatorCiphertext: bytesToBase64(row.sourceLocatorCiphertext),
    sourceLocatorIv: bytesToBase64(row.sourceLocatorIv),
    sourceLocatorAuthTag: bytesToBase64(row.sourceLocatorAuthTag),
    sourceLocatorKeyVersion: row.sourceLocatorKeyVersion,
    sourceLocatorAlgorithm: row.sourceLocatorAlgorithm,
    sourceLocatorEnvelopeVersion: row.sourceLocatorEnvelopeVersion,
    sourceLocatorAadVersion: row.sourceLocatorAadVersion,
    sourceReadbackSha256: row.sourceReadbackSha256,
    sourceReadbackByteLength: safeNumber(row.sourceReadbackByteLength),
    sourceVerifiedAt: dateToIso(row.sourceVerifiedAt),
    sourceDisposition: row.sourceDisposition,
    sourceDispositionReasonCode: row.sourceDispositionReasonCode,
    sourceDispositionAt: dateToIso(row.sourceDispositionAt),
    state: row.state,
    safeFailureCode: row.safeFailureCode,
    revision: row.revision,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    leaseToken: row.leaseToken,
    leaseOwnerId: row.leaseOwnerId,
    leaseExpiresAt: dateToIso(row.leaseExpiresAt),
    nextAttemptAt: dateToIso(row.nextAttemptAt),
    reportVersionId: row.reportVersionId,
    sourceArtifactId: row.sourceArtifactId,
    extractionRunId: row.extractionRunId,
    createdAt: dateToIso(row.createdAt)!,
    updatedAt: dateToIso(row.updatedAt)!,
  });
  if (!validReportIngestion(value)) throw new Error("invalid Prisma ingestion readback");
  return value;
}

function nullableBytes(value: string | null): Buffer | null {
  return value === null ? null : Buffer.from(value, "base64");
}

function toDatabaseCreate(row: P0ReportIngestion): Record<string, unknown> {
  return {
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    actorId: row.actorId,
    authorizationKind: row.authorizationKind,
    authorizationVersion: row.authorizationVersion,
    idempotencyKey: row.idempotencyKey,
    operationKey: row.operationKey,
    reportSeriesKey: row.reportSeriesKey,
    reservedVersion: row.reservedVersion,
    sourceSha256: row.sourceSha256,
    sourceByteLength: BigInt(row.sourceByteLength),
    sourceDeclaredMimeType: row.sourceDeclaredMimeType,
    sourceDetectedMimeType: row.sourceDetectedMimeType,
    sourceStorageProviderKey: row.sourceStorageProviderKey,
    sourceLocatorCiphertext: nullableBytes(row.sourceLocatorCiphertext),
    sourceLocatorIv: nullableBytes(row.sourceLocatorIv),
    sourceLocatorAuthTag: nullableBytes(row.sourceLocatorAuthTag),
    sourceLocatorKeyVersion: row.sourceLocatorKeyVersion,
    sourceLocatorAlgorithm: row.sourceLocatorAlgorithm,
    sourceLocatorEnvelopeVersion: row.sourceLocatorEnvelopeVersion,
    sourceLocatorAadVersion: row.sourceLocatorAadVersion,
    sourceReadbackSha256: row.sourceReadbackSha256,
    sourceReadbackByteLength:
      row.sourceReadbackByteLength === null
        ? null
        : BigInt(row.sourceReadbackByteLength),
    sourceVerifiedAt:
      row.sourceVerifiedAt === null ? null : new Date(row.sourceVerifiedAt),
    sourceDisposition: row.sourceDisposition,
    sourceDispositionReasonCode: row.sourceDispositionReasonCode,
    sourceDispositionAt:
      row.sourceDispositionAt === null ? null : new Date(row.sourceDispositionAt),
    state: row.state,
    safeFailureCode: row.safeFailureCode,
    revision: row.revision,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    leaseToken: row.leaseToken,
    leaseOwnerId: row.leaseOwnerId,
    leaseExpiresAt: row.leaseExpiresAt === null ? null : new Date(row.leaseExpiresAt),
    nextAttemptAt: row.nextAttemptAt === null ? null : new Date(row.nextAttemptAt),
    reportVersionId: row.reportVersionId,
    sourceArtifactId: row.sourceArtifactId,
    extractionRunId: row.extractionRunId,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

const IMMUTABLE_KEYS: readonly (keyof P0ReportIngestion)[] = Object.freeze([
  "contractVersion",
  "id",
  "tenantId",
  "consumerId",
  "actorId",
  "authorizationKind",
  "authorizationVersion",
  "idempotencyKey",
  "operationKey",
  "reportSeriesKey",
  "reservedVersion",
  "sourceSha256",
  "sourceByteLength",
  "sourceDeclaredMimeType",
  "sourceDetectedMimeType",
  "maxAttempts",
  "createdAt",
]);

function exactImmutableIdentity(
  current: P0ReportIngestion,
  next: P0ReportIngestion,
): boolean {
  return IMMUTABLE_KEYS.every((key) => current[key] === next[key]);
}

function toDatabaseUpdate(row: P0ReportIngestion): Record<string, unknown> {
  const create = toDatabaseCreate(row);
  for (const key of [
    "id",
    "tenantId",
    "consumerId",
    "actorId",
    "authorizationKind",
    "authorizationVersion",
    "idempotencyKey",
    "operationKey",
    "reportSeriesKey",
    "reservedVersion",
    "sourceSha256",
    "sourceByteLength",
    "sourceDeclaredMimeType",
    "sourceDetectedMimeType",
    "maxAttempts",
    "createdAt",
  ]) {
    delete create[key];
  }
  return create;
}

function resourceRef(resource: P0RepositoryResourceKey): P0RepositorySourceRef {
  return Object.freeze({ ...resource });
}

function databaseCodes(error: unknown): readonly string[] {
  const found = new Set<string>();
  const visit = (value: unknown, depth: number): void => {
    if (!value || typeof value !== "object" || depth > 5) return;
    const record = value as Record<string, unknown>;
    for (const key of ["code", "sqlState", "sqlstate"]) {
      if (typeof record[key] === "string") found.add(record[key] as string);
    }
    visit(record.cause, depth + 1);
    visit(record.originalError, depth + 1);
  };
  visit(error, 0);
  return Object.freeze([...found]);
}

function isUniqueConflict(error: unknown): boolean {
  return databaseCodes(error).includes("P2002") || databaseCodes(error).includes("23505");
}

function rethrowDeadlock(error: unknown): void {
  if (databaseCodes(error).includes("40P01")) throw error;
}

async function attest<T>(input: {
  readonly context: P0RepositoryContext;
  readonly resource: P0RepositoryResourceKey;
  readonly expected: T;
  readonly readback: T;
  readonly sourceRefs: readonly P0RepositorySourceRef[];
}): Promise<VerifiedP0RepositoryAttestation<T> | null> {
  return verifyPrismaP0RepositoryReadback({
    operationId: input.context.operationId,
    purpose: input.context.purpose,
    scope: input.context.scope,
    expectedSnapshot: input.expected,
    readbackSnapshot: input.readback,
    sourceRefs: [resourceRef(input.resource), ...input.sourceRefs],
    verifier: PRISMA_ATTESTATION_VERIFIER,
  });
}

export function createPrismaP0ReportIngestionRepository(
  dependencies: P0PrismaReportIngestionRepositoryDependencies,
): P0Repository {
  if (!dependencies?.client || !dependencies?.principalRevalidator) {
    throw new Error("authenticated Prisma repository dependencies are required");
  }
  const transactionOptions = Object.freeze({
    isolationLevel: "Serializable" as const,
    maxWait: dependencies.maxWaitMs ?? 5_000,
    timeout: dependencies.timeoutMs ?? 15_000,
  });

  async function authorize(
    transaction: any,
    context: P0RepositoryContext,
  ): Promise<boolean> {
    try {
      return (
        (await dependencies.principalRevalidator.revalidateInTransaction({
          transaction,
          principal: context.principal,
          scope: context.scope,
          purpose: context.purpose,
          operationId: context.operationId,
        })) === true
      );
    } catch {
      return false;
    }
  }

  async function replayAfterUnique<T>(input: {
    readonly context: P0RepositoryContext;
    readonly resource: P0RepositoryResourceKey;
    readonly expected: T;
    readonly sourceRefs: readonly P0RepositorySourceRef[];
  }): Promise<P0RepositoryWriteResult<T>> {
    try {
      return await dependencies.client.$transaction(async (transaction) => {
        if (!(await authorize(transaction, input.context))) return { kind: "DENIED" };
        const stored = await transaction.reportIngestion.findUnique({
          where: {
            tenantId_consumerId_id: {
              tenantId: input.context.scope.tenantId,
              consumerId: input.context.scope.consumerId,
              id: input.resource.resourceId,
            },
          },
        });
        if (!stored) return { kind: "CONFLICT" };
        const readback = fromDatabase(stored) as T;
        if (
          computeP0RepositorySemanticSha256(readback) !==
          computeP0RepositorySemanticSha256(input.expected)
        ) {
          return { kind: "CONFLICT" };
        }
        const receipt = await attest({
          ...input,
          readback,
        });
        return receipt
          ? { kind: "IDEMPOTENT_REPLAY", value: receipt.snapshot, attestation: receipt }
          : { kind: "OUTCOME_UNKNOWN" };
      }, transactionOptions);
    } catch (error) {
      rethrowDeadlock(error);
      return { kind: "OUTCOME_UNKNOWN" };
    }
  }

  return Object.freeze({
    async readExact<T>(
      context: P0RepositoryContext,
      resource: P0RepositoryResourceKey,
      sourceRefs: readonly P0RepositorySourceRef[] = [],
    ) {
      if (!exactContext(context, false) || !exactResource(resource)) {
        return { kind: "DENIED" } as const;
      }
      try {
        return await dependencies.client.$transaction(async (transaction) => {
          if (!(await authorize(transaction, context))) return { kind: "DENIED" } as const;
          const stored = await transaction.reportIngestion.findUnique({
            where: {
              tenantId_consumerId_id: {
                tenantId: context.scope.tenantId,
                consumerId: context.scope.consumerId,
                id: resource.resourceId,
              },
            },
          });
          if (!stored) return { kind: "NOT_FOUND" } as const;
          const readback = fromDatabase(stored) as T;
          const receipt = await attest({
            context,
            resource,
            expected: readback,
            readback,
            sourceRefs,
          });
          return receipt
            ? { kind: "FOUND", value: receipt.snapshot, attestation: receipt } as const
            : { kind: "OUTCOME_UNKNOWN" } as const;
        }, transactionOptions);
      } catch (error) {
        rethrowDeadlock(error);
        return { kind: "OUTCOME_UNKNOWN" } as const;
      }
    },

    async createExact<T>(
      context: P0RepositoryContext,
      resource: P0RepositoryResourceKey,
      value: T,
      sourceRefs: readonly P0RepositorySourceRef[] = [],
    ) {
      if (
        !exactContext(context, true) ||
        !exactResource(resource) ||
        !validReportIngestion(value) ||
        value.id !== resource.resourceId ||
        value.id !== deterministicIngestionId(value) ||
        value.tenantId !== context.scope.tenantId ||
        value.consumerId !== context.scope.consumerId ||
        value.actorId !== context.principal.actorId ||
        value.authorizationKind !== context.principal.authorizationKind ||
        value.authorizationVersion !== context.principal.authorizationVersion ||
        value.state !== "RECEIVED" ||
        value.revision !== 1 ||
        value.attemptCount !== 0
      ) {
        return { kind: "DENIED" } as const;
      }
      try {
        return await dependencies.client.$transaction(async (transaction) => {
          if (!(await authorize(transaction, context))) return { kind: "DENIED" } as const;
          // INSERT .. ON CONFLICT DO NOTHING is the least-privilege upsert
          // shape: the writer role has no UPDATE authority on immutable scope.
          await transaction.creditTruthScope.createMany({
            data: [{
              tenantId: context.scope.tenantId,
              consumerId: context.scope.consumerId,
            }],
            skipDuplicates: true,
          });
          const scope = await transaction.creditTruthScope.findUnique({
            where: {
              tenantId_consumerId: {
                tenantId: context.scope.tenantId,
                consumerId: context.scope.consumerId,
              },
            },
            select: { tenantId: true, consumerId: true },
          });
          if (
            !scope ||
            scope.tenantId !== context.scope.tenantId ||
            scope.consumerId !== context.scope.consumerId
          ) {
            return { kind: "OUTCOME_UNKNOWN" } as const;
          }

          const existing = await transaction.reportIngestion.findUnique({
            where: {
              tenantId_consumerId_id: {
                tenantId: context.scope.tenantId,
                consumerId: context.scope.consumerId,
                id: resource.resourceId,
              },
            },
          });
          if (existing) {
            const readback = fromDatabase(existing) as T;
            if (
              computeP0RepositorySemanticSha256(readback) !==
              computeP0RepositorySemanticSha256(value)
            ) {
              return { kind: "CONFLICT" } as const;
            }
            const receipt = await attest({
              context,
              resource,
              expected: value,
              readback,
              sourceRefs,
            });
            return receipt
              ? { kind: "IDEMPOTENT_REPLAY", value: receipt.snapshot, attestation: receipt } as const
              : { kind: "OUTCOME_UNKNOWN" } as const;
          }

          const [latestReservation, latestVersion] = await Promise.all([
            transaction.reportIngestion.findFirst({
              where: {
                tenantId: context.scope.tenantId,
                consumerId: context.scope.consumerId,
                reportSeriesKey: value.reportSeriesKey,
              },
              orderBy: { reservedVersion: "desc" },
              select: { reservedVersion: true },
            }),
            transaction.reportVersion.findFirst({
              where: {
                tenantId: context.scope.tenantId,
                consumerId: context.scope.consumerId,
                reportSeriesKey: value.reportSeriesKey,
              },
              orderBy: { version: "desc" },
              select: { version: true },
            }),
          ]);
          const latest = Math.max(
            latestReservation?.reservedVersion ?? 0,
            latestVersion?.version ?? 0,
          );
          if (value.reservedVersion !== latest + 1) return { kind: "CONFLICT" } as const;

          await transaction.reportIngestion.create({ data: toDatabaseCreate(value) });
          const stored = await transaction.reportIngestion.findUnique({
            where: {
              tenantId_consumerId_id: {
                tenantId: context.scope.tenantId,
                consumerId: context.scope.consumerId,
                id: resource.resourceId,
              },
            },
          });
          if (!stored) return { kind: "OUTCOME_UNKNOWN" } as const;
          const readback = fromDatabase(stored) as T;
          const receipt = await attest({
            context,
            resource,
            expected: value,
            readback,
            sourceRefs,
          });
          return receipt
            ? { kind: "CREATED", value: receipt.snapshot, attestation: receipt } as const
            : { kind: "OUTCOME_UNKNOWN" } as const;
        }, transactionOptions);
      } catch (error) {
        rethrowDeadlock(error);
        if (isUniqueConflict(error)) {
          return replayAfterUnique({ context, resource, expected: value, sourceRefs });
        }
        return { kind: "OUTCOME_UNKNOWN" } as const;
      }
    },

    async compareAndSwapExact<T>(
      context: P0RepositoryContext,
      resource: P0RepositoryResourceKey,
      expected: T,
      next: T,
      sourceRefs: readonly P0RepositorySourceRef[] = [],
    ) {
      if (
        !exactContext(context, true) ||
        !exactResource(resource) ||
        !validReportIngestion(expected) ||
        !validReportIngestion(next) ||
        expected.id !== resource.resourceId ||
        next.id !== resource.resourceId ||
        expected.tenantId !== context.scope.tenantId ||
        expected.consumerId !== context.scope.consumerId ||
        !exactImmutableIdentity(expected, next) ||
        next.revision !== expected.revision + 1
      ) {
        return { kind: "DENIED" } as const;
      }
      try {
        return await dependencies.client.$transaction(async (transaction) => {
          if (!(await authorize(transaction, context))) return { kind: "DENIED" } as const;
          const currentRow = await transaction.reportIngestion.findUnique({
            where: {
              tenantId_consumerId_id: {
                tenantId: context.scope.tenantId,
                consumerId: context.scope.consumerId,
                id: resource.resourceId,
              },
            },
          });
          if (!currentRow) return { kind: "CONFLICT" } as const;
          const current = fromDatabase(currentRow);
          const currentDigest = computeP0RepositorySemanticSha256(current);
          const nextDigest = computeP0RepositorySemanticSha256(next);
          if (currentDigest === nextDigest) {
            const receipt = await attest({
              context,
              resource,
              expected: next,
              readback: current as T,
              sourceRefs,
            });
            return receipt
              ? { kind: "IDEMPOTENT_REPLAY", value: receipt.snapshot, attestation: receipt } as const
              : { kind: "OUTCOME_UNKNOWN" } as const;
          }
          if (currentDigest !== computeP0RepositorySemanticSha256(expected)) {
            return { kind: "CONFLICT" } as const;
          }
          const updated = await transaction.reportIngestion.updateMany({
            where: {
              tenantId: context.scope.tenantId,
              consumerId: context.scope.consumerId,
              id: resource.resourceId,
              revision: expected.revision,
            },
            data: toDatabaseUpdate(next),
          });
          if (updated.count !== 1) return { kind: "CONFLICT" } as const;
          const stored = await transaction.reportIngestion.findUnique({
            where: {
              tenantId_consumerId_id: {
                tenantId: context.scope.tenantId,
                consumerId: context.scope.consumerId,
                id: resource.resourceId,
              },
            },
          });
          if (!stored) return { kind: "OUTCOME_UNKNOWN" } as const;
          const readback = fromDatabase(stored) as T;
          const receipt = await attest({
            context,
            resource,
            expected: next,
            readback,
            sourceRefs,
          });
          return receipt
            ? { kind: "UPDATED", value: receipt.snapshot, attestation: receipt } as const
            : { kind: "OUTCOME_UNKNOWN" } as const;
        }, transactionOptions);
      } catch (error) {
        rethrowDeadlock(error);
        if (isUniqueConflict(error)) return { kind: "CONFLICT" } as const;
        return { kind: "OUTCOME_UNKNOWN" } as const;
      }
    },
  });
}
