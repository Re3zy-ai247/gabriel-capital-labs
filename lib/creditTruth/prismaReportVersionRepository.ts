import { createHash } from "node:crypto";
import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  p0ScopeFromPrincipal,
} from "./principal";
import type {
  P0ReportIngestion,
  P0ReportVersionCommitReadback,
} from "./reportIngestion";
import {
  P0_PRISMA_REPOSITORY_ID,
  P0_PRISMA_REPOSITORY_SEMANTICS_VERSION,
  computeP0RepositorySemanticSha256,
  verifyPrismaP0RepositoryReadback,
  type P0PrismaRepositoryAttestationVerifier,
  type P0RepositorySourceRef,
  type VerifiedP0RepositoryAttestation,
} from "./repositoryAttestation";
import {
  isVerifiedP0SourceArtifactWriteReceipt,
  type VerifiedP0SourceArtifactWriteReceipt,
} from "./sourceArtifact";
import {
  p0Phase2AGatePermitAuthorizes,
  type P0Phase2AGatePermit,
} from "./phase2Flags";

export const P0_PRISMA_REPORT_VERSION_REPOSITORY_VERSION =
  "p0-prisma-report-version-repository-v1" as const;

export type P0ReportVersionCommitResult =
  | {
      readonly kind: "CREATED" | "IDEMPOTENT_REPLAY";
      readonly value: P0ReportVersionCommitReadback;
      readonly attestation: VerifiedP0RepositoryAttestation<P0ReportVersionCommitReadback>;
    }
  | {
      readonly kind: "DENIED" | "CONFLICT" | "OUTCOME_UNKNOWN";
      readonly code: string;
    }
  | {
      readonly kind: "DEADLOCK_DETECTED";
      readonly code: "POSTGRES_40P01_DEADLOCK_DETECTED";
      readonly databaseCode: "40P01";
      readonly retryable: false;
    };

export interface P0PrismaReportVersionRepository {
  commitExact(input: {
    readonly principal: P0Principal;
    readonly gatePermit: P0Phase2AGatePermit;
    readonly operationId: string;
    readonly ingestion: P0ReportIngestion;
    readonly legacyReportId: string;
    readonly sourceReceipt: VerifiedP0SourceArtifactWriteReceipt;
  }): Promise<P0ReportVersionCommitResult>;
}

export interface P0PrismaReportVersionRepositoryDependencies {
  readonly client: {
    $transaction<T>(
      operation: (transaction: any) => Promise<T>,
      options?: {
        readonly isolationLevel?: "Serializable";
        readonly maxWait?: number;
        readonly timeout?: number;
      },
    ): Promise<T>;
  };
  revalidatePrincipal(input: {
    readonly transaction: any;
    readonly principal: P0Principal;
    readonly operationId: string;
    readonly repositoryPurpose: "REPORT_VERSION_COMMIT";
  }): Promise<boolean>;
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
}

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function databaseCodes(error: unknown): readonly string[] {
  const found = new Set<string>();
  const seen = new WeakSet<object>();
  const queue: Array<{ readonly value: unknown; readonly depth: number }> = [
    { value: error, depth: 0 },
  ];
  const collect = (value: string): void => {
    const normalized = value.trim().toUpperCase();
    if (/^(?:[0-9A-Z]{5}|P[0-9]{4})$/.test(normalized)) {
      found.add(normalized);
    }
    for (const match of normalized.matchAll(/\b(?:[0-9A-Z]{5}|P[0-9]{4})\b/g)) {
      const candidate = match[0];
      if (/\d/.test(candidate)) found.add(candidate);
    }
  };
  while (queue.length > 0 && found.size < 12) {
    const current = queue.shift();
    if (!current || current.depth > 4) continue;
    const value = current.value;
    if (typeof value === "string") {
      collect(value);
      continue;
    }
    if (!value || (typeof value !== "object" && typeof value !== "function")) {
      continue;
    }
    const object = value as object;
    if (seen.has(object)) continue;
    seen.add(object);
    for (const key of Reflect.ownKeys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (descriptor && "value" in descriptor) {
        queue.push({ value: descriptor.value, depth: current.depth + 1 });
      }
    }
  }
  return Object.freeze([...found]);
}

function isExactPostgresDeadlock(error: unknown): boolean {
  return databaseCodes(error).includes("40P01");
}

const verifier: P0PrismaRepositoryAttestationVerifier = Object.freeze({
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

function digest(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts), "utf8").digest("hex");
}

export function deriveP0ReportSeriesKey(legacyReportId: string): string {
  if (!STABLE.test(legacyReportId)) throw new Error("invalid legacy report id");
  return `p0series_${digest(["legacy-report", legacyReportId]).slice(0, 40)}`;
}

export function deriveP0ReportVersionId(input: {
  readonly scope: P0Scope;
  readonly reportSeriesKey: string;
  readonly version: number;
  readonly sourceSha256: string;
}): string {
  if (
    !STABLE.test(input.scope.tenantId) ||
    !STABLE.test(input.scope.consumerId) ||
    !STABLE.test(input.reportSeriesKey) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    !SHA256.test(input.sourceSha256)
  ) {
    throw new Error("invalid report version identity");
  }
  return `p0rv_${digest([
    input.scope.tenantId,
    input.scope.consumerId,
    input.reportSeriesKey,
    input.version,
    input.sourceSha256,
  ]).slice(0, 40)}`;
}

function exactInput(input: Parameters<P0PrismaReportVersionRepository["commitExact"]>[0]): boolean {
  let scope: P0Scope;
  try {
    scope = p0ScopeFromPrincipal(input.principal);
  } catch {
    return false;
  }
  const ingestion = input.ingestion;
  const object = input.sourceReceipt?.object;
  if (
    !STABLE.test(input.operationId) ||
    !STABLE.test(input.legacyReportId) ||
    !input.gatePermit ||
    !p0PrincipalAuthorizesScope(input.principal, scope) ||
    !p0Phase2AGatePermitAuthorizes({
      permit: input.gatePermit,
      principal: input.principal,
      scope,
      stage: "INGESTION_SHADOW",
      mode: input.gatePermit.mode,
      operationId: input.operationId,
    }) ||
    !isVerifiedP0SourceArtifactWriteReceipt(input.sourceReceipt) ||
    !ingestion ||
    ingestion.tenantId !== scope.tenantId ||
    ingestion.consumerId !== scope.consumerId ||
    ingestion.state !== "SOURCE_STORED_AND_VERIFIED" ||
    ingestion.reportSeriesKey !== deriveP0ReportSeriesKey(input.legacyReportId) ||
    !Number.isSafeInteger(ingestion.reservedVersion) ||
    ingestion.reservedVersion < 1 ||
    !object ||
    object.scope.tenantId !== scope.tenantId ||
    object.scope.consumerId !== scope.consumerId ||
    object.scope.ingestionId !== ingestion.id ||
    object.sha256 !== ingestion.sourceSha256 ||
    object.byteLength !== ingestion.sourceByteLength ||
    object.mimeType !== ingestion.sourceDetectedMimeType ||
    input.sourceReceipt.readbackSha256 !== ingestion.sourceSha256 ||
    input.sourceReceipt.readbackByteLength !== ingestion.sourceByteLength ||
    ingestion.sourceStorageProviderKey !== object.providerKey ||
    ingestion.sourceLocatorCiphertext !== object.locator.ciphertextBase64 ||
    ingestion.sourceLocatorIv !== object.locator.ivBase64 ||
    ingestion.sourceLocatorAuthTag !== object.locator.authTagBase64 ||
    ingestion.sourceLocatorKeyVersion !== object.locator.keyVersion ||
    ingestion.sourceLocatorAlgorithm !== object.locator.algorithm ||
    ingestion.sourceLocatorEnvelopeVersion !== object.locator.envelopeVersion ||
    ingestion.sourceLocatorAadVersion !== object.locator.aadVersion
  ) {
    return false;
  }
  return true;
}

function base64ToBytes(value: string): Buffer {
  const decoded = Buffer.from(value, "base64");
  if (decoded.length < 1 || decoded.toString("base64") !== value) {
    throw new Error("invalid canonical base64");
  }
  return decoded;
}

function bigintToSafeNumber(value: unknown): number {
  const number = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error("unsafe byte length");
  return number;
}

function readbackFromRows(reportVersion: any, artifact: any): P0ReportVersionCommitReadback {
  return Object.freeze({
    tenantId: reportVersion.tenantId,
    consumerId: reportVersion.consumerId,
    reportVersionId: reportVersion.id,
    reportSeriesKey: reportVersion.reportSeriesKey,
    version: reportVersion.version,
    inputSha256: reportVersion.inputSha256,
    authorityStatus: reportVersion.authorityStatus,
    sourceArtifact: Object.freeze({
      tenantId: artifact.tenantId,
      consumerId: artifact.consumerId,
      artifactId: artifact.id,
      artifactVersion: artifact.version,
      artifactKind: artifact.kind,
      reportVersionId: artifact.reportVersionId,
      sha256: artifact.sha256,
      mimeType: artifact.mimeType,
      byteLength: bigintToSafeNumber(artifact.byteLength),
      storageProviderKey: artifact.storageProviderKey,
      storageLocatorCiphertext: Buffer.from(artifact.storageLocatorCiphertext).toString("base64"),
      storageLocatorIv: Buffer.from(artifact.storageLocatorIv).toString("base64"),
      storageLocatorAuthTag: Buffer.from(artifact.storageLocatorAuthTag).toString("base64"),
      storageLocatorKeyVersion: artifact.storageLocatorKeyVersion,
      storageLocatorAlgorithm: artifact.storageLocatorAlgorithm,
      storageLocatorEnvelopeVersion: artifact.storageLocatorEnvelopeVersion,
      storageLocatorAadVersion: artifact.storageLocatorAadVersion,
      createdByActorId: artifact.createdByActorId,
    }),
  });
}

function expectedReadback(input: Parameters<P0PrismaReportVersionRepository["commitExact"]>[0]): P0ReportVersionCommitReadback {
  const scope = p0ScopeFromPrincipal(input.principal);
  const ingestion = input.ingestion;
  const object = input.sourceReceipt.object;
  return Object.freeze({
    tenantId: scope.tenantId,
    consumerId: scope.consumerId,
    reportVersionId: deriveP0ReportVersionId({
      scope,
      reportSeriesKey: ingestion.reportSeriesKey,
      version: ingestion.reservedVersion,
      sourceSha256: ingestion.sourceSha256,
    }),
    reportSeriesKey: ingestion.reportSeriesKey,
    version: ingestion.reservedVersion,
    inputSha256: ingestion.sourceSha256,
    authorityStatus: "SHADOW_V2",
    sourceArtifact: Object.freeze({
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      artifactId: object.scope.artifactId,
      artifactVersion: object.scope.artifactVersion,
      artifactKind: "REPORT_SOURCE",
      reportVersionId: deriveP0ReportVersionId({
        scope,
        reportSeriesKey: ingestion.reportSeriesKey,
        version: ingestion.reservedVersion,
        sourceSha256: ingestion.sourceSha256,
      }),
      sha256: object.sha256,
      mimeType: object.mimeType,
      byteLength: object.byteLength,
      storageProviderKey: object.providerKey,
      storageLocatorCiphertext: object.locator.ciphertextBase64,
      storageLocatorIv: object.locator.ivBase64,
      storageLocatorAuthTag: object.locator.authTagBase64,
      storageLocatorKeyVersion: object.locator.keyVersion,
      storageLocatorAlgorithm: object.locator.algorithm,
      storageLocatorEnvelopeVersion: object.locator.envelopeVersion,
      storageLocatorAadVersion: object.locator.aadVersion,
      createdByActorId: input.principal.actorId,
    }),
  });
}

function sourceRefs(input: Parameters<P0PrismaReportVersionRepository["commitExact"]>[0]): readonly P0RepositorySourceRef[] {
  return Object.freeze([
    Object.freeze({
      resourceType: "REPORT_INGESTION",
      resourceId: input.ingestion.id,
      resourceVersion: String(input.ingestion.revision),
      integritySha256: input.ingestion.sourceSha256,
    }),
    Object.freeze({
      resourceType: "SOURCE_OBJECT",
      resourceId: input.sourceReceipt.object.scope.artifactId,
      resourceVersion: String(input.sourceReceipt.object.scope.artifactVersion),
      integritySha256: input.sourceReceipt.object.sha256,
    }),
    Object.freeze({
      resourceType: "LEGACY_REPORT",
      resourceId: input.legacyReportId,
      resourceVersion: "ownership-v1",
    }),
  ]);
}

export function createP0PrismaReportVersionRepository(
  dependencies: P0PrismaReportVersionRepositoryDependencies,
): P0PrismaReportVersionRepository {
  return Object.freeze({
    async commitExact(
      input: Parameters<P0PrismaReportVersionRepository["commitExact"]>[0],
    ): Promise<P0ReportVersionCommitResult> {
      if (!exactInput(input)) return { kind: "DENIED", code: "INVALID_REPORT_VERSION_COMMIT" };
      const expected = expectedReadback(input);
      const refs = sourceRefs(input);
      const scope = p0ScopeFromPrincipal(input.principal);
      try {
        return await dependencies.client.$transaction(async (transaction: any) => {
          const livePrincipal = await dependencies.revalidatePrincipal({
            transaction,
            principal: input.principal,
            operationId: input.operationId,
            repositoryPurpose: "REPORT_VERSION_COMMIT",
          });
          if (!livePrincipal) return { kind: "DENIED", code: "LIVE_PRINCIPAL_REVALIDATION_FAILED" } as const;

          const lockedRows = await transaction.$queryRawUnsafe(
            'SELECT * FROM "ReportIngestion" WHERE "tenantId" = $1 AND "consumerId" = $2 AND "id" = $3 FOR UPDATE',
            scope.tenantId,
            scope.consumerId,
            input.ingestion.id,
          );
          const locked = Array.isArray(lockedRows) ? lockedRows[0] : null;
          if (
            !locked ||
            locked.state !== "SOURCE_STORED_AND_VERIFIED" ||
            locked.revision !== input.ingestion.revision ||
            locked.reportSeriesKey !== input.ingestion.reportSeriesKey ||
            locked.reservedVersion !== input.ingestion.reservedVersion ||
            locked.sourceSha256 !== input.ingestion.sourceSha256 ||
            bigintToSafeNumber(locked.sourceByteLength) !== input.ingestion.sourceByteLength ||
            locked.reportVersionId !== null ||
            locked.sourceArtifactId !== null
          ) {
            return { kind: "CONFLICT", code: "INGESTION_STATE_CHANGED" } as const;
          }

          const report = await transaction.report.findFirst({
            where: { id: input.legacyReportId, userId: scope.consumerId },
            select: { id: true, userId: true },
          });
          if (!report || report.userId !== scope.consumerId) {
            return { kind: "DENIED", code: "REPORT_OWNERSHIP_MISMATCH" } as const;
          }

          const sourceObject = await transaction.p0SourceObject.findFirst({
            where: {
              tenantId: scope.tenantId,
              consumerId: scope.consumerId,
              ingestionId: input.ingestion.id,
              artifactId: input.sourceReceipt.object.scope.artifactId,
              artifactVersion: input.sourceReceipt.object.scope.artifactVersion,
            },
          });
          if (
            !sourceObject ||
            sourceObject.sha256 !== input.ingestion.sourceSha256 ||
            bigintToSafeNumber(sourceObject.byteLength) !== input.ingestion.sourceByteLength ||
            sourceObject.providerOperationId !== input.sourceReceipt.object.providerOperationId ||
            sourceObject.providerObjectVersion !== input.sourceReceipt.object.providerObjectVersion
          ) {
            return { kind: "DENIED", code: "SOURCE_OBJECT_MISMATCH" } as const;
          }

          const latest = await transaction.reportVersion.findFirst({
            where: {
              tenantId: scope.tenantId,
              consumerId: scope.consumerId,
              reportSeriesKey: input.ingestion.reportSeriesKey,
            },
            orderBy: { version: "desc" },
            select: { id: true, version: true, inputSha256: true },
          });
          if (latest && latest.version > input.ingestion.reservedVersion) {
            return { kind: "CONFLICT", code: "STALE_REPORT_VERSION" } as const;
          }
          if (
            (!latest && input.ingestion.reservedVersion !== 1) ||
            (latest &&
              latest.version < input.ingestion.reservedVersion &&
              latest.version !== input.ingestion.reservedVersion - 1)
          ) {
            return { kind: "CONFLICT", code: "NON_SEQUENTIAL_REPORT_VERSION" } as const;
          }

          const existingVersion = await transaction.reportVersion.findFirst({
            where: {
              tenantId: scope.tenantId,
              consumerId: scope.consumerId,
              reportSeriesKey: input.ingestion.reportSeriesKey,
              version: input.ingestion.reservedVersion,
            },
          });
          let disposition: "CREATED" | "IDEMPOTENT_REPLAY" = "CREATED";
          if (!existingVersion) {
            // INSERT .. ON CONFLICT DO NOTHING preserves least privilege: the
            // dedicated writer role needs no UPDATE on immutable tenant scope.
            await transaction.creditTruthScope.createMany({
              data: [{
                tenantId: scope.tenantId,
                consumerId: scope.consumerId,
              }],
              skipDuplicates: true,
            });
            const persistedScope = await transaction.creditTruthScope.findUnique({
              where: {
                tenantId_consumerId: {
                  tenantId: scope.tenantId,
                  consumerId: scope.consumerId,
                },
              },
              select: { tenantId: true, consumerId: true },
            });
            if (
              !persistedScope ||
              persistedScope.tenantId !== scope.tenantId ||
              persistedScope.consumerId !== scope.consumerId
            ) {
              return { kind: "DENIED", code: "SCOPE_BOOTSTRAP_MISMATCH" } as const;
            }
            await transaction.reportVersion.create({
              data: {
                id: expected.reportVersionId,
                tenantId: scope.tenantId,
                consumerId: scope.consumerId,
                sourceReportId: input.legacyReportId,
                reportSeriesKey: input.ingestion.reportSeriesKey,
                version: input.ingestion.reservedVersion,
                origin: "NEW_UPLOAD",
                authorityStatus: "SHADOW_V2",
                schemaVersion: "credit-truth-v2",
                inputSha256: input.ingestion.sourceSha256,
                reportDateProvenance: "UNKNOWN",
                createdByActorId: input.principal.actorId,
              },
            });
            await transaction.artifact.create({
              data: {
                id: expected.sourceArtifact.artifactId,
                tenantId: scope.tenantId,
                consumerId: scope.consumerId,
                artifactSeriesKey: `p0-report-source:${input.ingestion.reportSeriesKey}`,
                version: expected.sourceArtifact.artifactVersion,
                kind: "REPORT_SOURCE",
                reportVersionId: expected.reportVersionId,
                storageProviderKey: expected.sourceArtifact.storageProviderKey,
                storageLocatorCiphertext: base64ToBytes(expected.sourceArtifact.storageLocatorCiphertext),
                storageLocatorIv: base64ToBytes(expected.sourceArtifact.storageLocatorIv),
                storageLocatorAuthTag: base64ToBytes(expected.sourceArtifact.storageLocatorAuthTag),
                storageLocatorKeyVersion: expected.sourceArtifact.storageLocatorKeyVersion,
                storageLocatorAlgorithm: "AES_256_GCM",
                storageLocatorEnvelopeVersion: expected.sourceArtifact.storageLocatorEnvelopeVersion,
                storageLocatorAadVersion: expected.sourceArtifact.storageLocatorAadVersion,
                sha256: expected.sourceArtifact.sha256,
                mimeType: expected.sourceArtifact.mimeType,
                byteLength: BigInt(expected.sourceArtifact.byteLength),
                createdByActorId: expected.sourceArtifact.createdByActorId,
              },
            });
          } else {
            disposition = "IDEMPOTENT_REPLAY";
          }

          const persistedVersion = await transaction.reportVersion.findFirst({
            where: {
              tenantId: scope.tenantId,
              consumerId: scope.consumerId,
              id: expected.reportVersionId,
            },
          });
          const persistedArtifact = await transaction.artifact.findFirst({
            where: {
              tenantId: scope.tenantId,
              consumerId: scope.consumerId,
              id: expected.sourceArtifact.artifactId,
              reportVersionId: expected.reportVersionId,
            },
          });
          if (!persistedVersion || !persistedArtifact) {
            return { kind: "OUTCOME_UNKNOWN", code: "REPORT_VERSION_READBACK_MISSING" } as const;
          }
          const readback = readbackFromRows(persistedVersion, persistedArtifact);
          if (
            computeP0RepositorySemanticSha256(readback) !==
            computeP0RepositorySemanticSha256(expected)
          ) {
            return { kind: "OUTCOME_UNKNOWN", code: "REPORT_VERSION_READBACK_MISMATCH" } as const;
          }
          const attestation = await verifyPrismaP0RepositoryReadback({
            operationId: input.operationId,
            purpose: "REPORT_VERSION_COMMIT",
            scope,
            expectedSnapshot: expected,
            readbackSnapshot: readback,
            sourceRefs: refs,
            verifier,
          });
          if (!attestation) {
            return { kind: "OUTCOME_UNKNOWN", code: "REPORT_VERSION_ATTESTATION_FAILED" } as const;
          }
          return { kind: disposition, value: attestation.snapshot, attestation } as const;
        }, {
          isolationLevel: "Serializable",
          maxWait: dependencies.maxWaitMs ?? 5_000,
          timeout: dependencies.timeoutMs ?? 15_000,
        });
      } catch (error) {
        if (isExactPostgresDeadlock(error)) {
          return {
            kind: "DEADLOCK_DETECTED",
            code: "POSTGRES_40P01_DEADLOCK_DETECTED",
            databaseCode: "40P01",
            retryable: false,
          };
        }
        return { kind: "OUTCOME_UNKNOWN", code: "REPORT_VERSION_TRANSACTION_UNKNOWN" };
      }
    },
  });
}
