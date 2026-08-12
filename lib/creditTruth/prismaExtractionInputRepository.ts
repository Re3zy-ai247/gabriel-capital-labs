import type { P0Principal, P0Scope } from "./principal";
import { p0PrincipalAuthorizesScope, p0ScopeFromPrincipal } from "./principal";
import type { P0ReportIngestion, P0ReportVersionCommitReadback } from "./reportIngestion";
import {
  P0_PRISMA_REPOSITORY_ID,
  P0_PRISMA_REPOSITORY_SEMANTICS_VERSION,
  computeP0RepositorySemanticSha256,
  isVerifiedP0RepositoryAttestation,
  verifyPrismaP0RepositoryReadback,
  type P0PrismaRepositoryAttestationVerifier,
  type VerifiedP0RepositoryAttestation,
} from "./repositoryAttestation";
import {
  isVerifiedP0SourceArtifactWriteReceipt,
  type VerifiedP0SourceArtifactWriteReceipt,
} from "./sourceArtifact";
import { p0Phase2AGatePermitAuthorizes, type P0Phase2AGatePermit } from "./phase2Flags";

export const P0_PRISMA_EXTRACTION_INPUT_REPOSITORY_VERSION =
  "p0-prisma-extraction-input-repository-v1" as const;

export interface P0ExtractionInputArtifactReadback {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly artifactId: string;
  readonly artifactVersion: number;
  readonly sha256: string;
  readonly mimeType: "text/plain";
  readonly byteLength: number;
  readonly storageProviderKey: string;
  readonly createdByActorId: string;
}

export type P0ExtractionInputCommitResult =
  | {
      readonly kind: "CREATED" | "IDEMPOTENT_REPLAY";
      readonly value: P0ExtractionInputArtifactReadback;
      readonly attestation: VerifiedP0RepositoryAttestation<P0ExtractionInputArtifactReadback>;
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

export interface P0PrismaExtractionInputRepositoryDependencies {
  readonly client: {
    $transaction<T>(
      operation: (transaction: any) => Promise<T>,
      options?: { readonly isolationLevel?: "Serializable"; readonly maxWait?: number; readonly timeout?: number },
    ): Promise<T>;
  };
  revalidatePrincipal(input: {
    readonly transaction: any;
    readonly principal: P0Principal;
    readonly operationId: string;
    readonly repositoryPurpose: "EXTRACTION_INPUT_COMMIT";
  }): Promise<boolean>;
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
}

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;

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
    return input.adapterClass === "AUTHENTICATED_TENANT_SCOPED_PRISMA" &&
      input.repositoryId === P0_PRISMA_REPOSITORY_ID &&
      input.semanticsVersion === P0_PRISMA_REPOSITORY_SEMANTICS_VERSION;
  },
});

function bytes(value: string): Buffer {
  const decoded = Buffer.from(value, "base64");
  if (decoded.length < 1 || decoded.toString("base64") !== value) throw new Error("invalid base64");
  return decoded;
}

function safeNumber(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) throw new Error("invalid byte length");
  return result;
}

function expected(input: {
  readonly principal: P0Principal;
  readonly ingestion: P0ReportIngestion;
  readonly inputReceipt: VerifiedP0SourceArtifactWriteReceipt;
}): P0ExtractionInputArtifactReadback {
  const object = input.inputReceipt.object;
  return Object.freeze({
    tenantId: input.ingestion.tenantId,
    consumerId: input.ingestion.consumerId,
    reportVersionId: input.ingestion.reportVersionId!,
    artifactId: object.scope.artifactId,
    artifactVersion: object.scope.artifactVersion,
    sha256: object.sha256,
    mimeType: "text/plain" as const,
    byteLength: object.byteLength,
    storageProviderKey: object.providerKey,
    createdByActorId: input.principal.actorId,
  });
}

function fromRow(row: any): P0ExtractionInputArtifactReadback {
  return Object.freeze({
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    artifactId: row.id,
    artifactVersion: row.version,
    sha256: row.sha256,
    mimeType: row.mimeType,
    byteLength: safeNumber(row.byteLength),
    storageProviderKey: row.storageProviderKey,
    createdByActorId: row.createdByActorId,
  });
}

export function createP0PrismaExtractionInputRepository(
  dependencies: P0PrismaExtractionInputRepositoryDependencies,
) {
  return Object.freeze({
    async commitExact(input: {
      readonly principal: P0Principal;
      readonly gatePermit: P0Phase2AGatePermit;
      readonly operationId: string;
      readonly ingestion: P0ReportIngestion;
      readonly reportVersionReceipt: VerifiedP0RepositoryAttestation<P0ReportVersionCommitReadback>;
      readonly inputReceipt: VerifiedP0SourceArtifactWriteReceipt;
    }): Promise<P0ExtractionInputCommitResult> {
      let scope: P0Scope;
      try { scope = p0ScopeFromPrincipal(input.principal); } catch {
        return { kind: "DENIED", code: "UNVERIFIED_PRINCIPAL" };
      }
      const object = input.inputReceipt?.object;
      if (
        !input.gatePermit ||
        !STABLE.test(input.operationId) ||
        !p0PrincipalAuthorizesScope(input.principal, scope) ||
        !p0Phase2AGatePermitAuthorizes({ permit: input.gatePermit, principal: input.principal, scope, stage: "INGESTION_SHADOW", mode: input.gatePermit.mode, operationId: input.operationId }) ||
        !isVerifiedP0RepositoryAttestation(input.reportVersionReceipt) ||
        input.reportVersionReceipt.purpose !== "REPORT_VERSION_COMMIT" ||
        input.reportVersionReceipt.scope.tenantId !== scope.tenantId ||
        input.reportVersionReceipt.scope.consumerId !== scope.consumerId ||
        !isVerifiedP0SourceArtifactWriteReceipt(input.inputReceipt) ||
        !input.ingestion ||
        input.ingestion.tenantId !== scope.tenantId ||
        input.ingestion.consumerId !== scope.consumerId ||
        !input.ingestion.reportVersionId ||
        !["VERSION_COMMITTED", "EXTRACTING"].includes(input.ingestion.state) ||
        input.reportVersionReceipt.snapshot.reportVersionId !== input.ingestion.reportVersionId ||
        input.reportVersionReceipt.snapshot.inputSha256 !== input.ingestion.sourceSha256 ||
        !object || object.kind !== "NORMALIZED_TEXT" || object.mimeType !== "text/plain" ||
        object.scope.tenantId !== scope.tenantId || object.scope.consumerId !== scope.consumerId ||
        object.scope.ingestionId !== input.ingestion.id ||
        object.scope.artifactId === input.ingestion.sourceArtifactId
      ) {
        return { kind: "DENIED", code: "INVALID_EXTRACTION_INPUT_COMMIT" };
      }
      const reportVersionId = input.ingestion.reportVersionId;
      const expectedValue = expected(input);
      try {
        return await dependencies.client.$transaction(async (transaction: any) => {
          if (!(await dependencies.revalidatePrincipal({ transaction, principal: input.principal, operationId: input.operationId, repositoryPurpose: "EXTRACTION_INPUT_COMMIT" }))) {
            return { kind: "DENIED", code: "LIVE_PRINCIPAL_REVALIDATION_FAILED" } as const;
          }
          const lockedRows = await transaction.$queryRawUnsafe(
            'SELECT * FROM "ReportIngestion" WHERE "tenantId" = $1 AND "consumerId" = $2 AND "id" = $3 FOR UPDATE',
            scope.tenantId, scope.consumerId, input.ingestion.id,
          );
          const locked = Array.isArray(lockedRows) ? lockedRows[0] : null;
          if (!locked || locked.revision !== input.ingestion.revision || locked.reportVersionId !== input.ingestion.reportVersionId || !["VERSION_COMMITTED", "EXTRACTING"].includes(locked.state)) {
            return { kind: "CONFLICT", code: "INGESTION_STATE_CHANGED" } as const;
          }
          const version = await transaction.reportVersion.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id: reportVersionId } });
          const physical = await transaction.p0SourceObject.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, ingestionId: input.ingestion.id, artifactId: object.scope.artifactId, artifactVersion: object.scope.artifactVersion } });
          if (!version || version.inputSha256 !== input.ingestion.sourceSha256 || !physical || physical.sha256 !== object.sha256 || safeNumber(physical.byteLength) !== object.byteLength || physical.providerOperationId !== object.providerOperationId) {
            return { kind: "DENIED", code: "EXTRACTION_INPUT_SOURCE_MISMATCH" } as const;
          }
          let disposition: "CREATED" | "IDEMPOTENT_REPLAY" = "CREATED";
          const existing = await transaction.artifact.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id: object.scope.artifactId } });
          if (!existing) {
            await transaction.artifact.create({ data: {
              id: expectedValue.artifactId,
              tenantId: scope.tenantId,
              consumerId: scope.consumerId,
              artifactSeriesKey: `p0-normalized-input:${reportVersionId}`,
              version: expectedValue.artifactVersion,
              kind: "OTHER",
              reportVersionId,
              storageProviderKey: object.providerKey,
              storageLocatorCiphertext: bytes(object.locator.ciphertextBase64),
              storageLocatorIv: bytes(object.locator.ivBase64),
              storageLocatorAuthTag: bytes(object.locator.authTagBase64),
              storageLocatorKeyVersion: object.locator.keyVersion,
              storageLocatorAlgorithm: "AES_256_GCM",
              storageLocatorEnvelopeVersion: object.locator.envelopeVersion,
              storageLocatorAadVersion: object.locator.aadVersion,
              sha256: object.sha256,
              mimeType: object.mimeType,
              byteLength: BigInt(object.byteLength),
              createdByActorId: input.principal.actorId,
            } });
          } else disposition = "IDEMPOTENT_REPLAY";
          const persisted = await transaction.artifact.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id: object.scope.artifactId, reportVersionId } });
          if (!persisted) return { kind: "OUTCOME_UNKNOWN", code: "EXTRACTION_INPUT_READBACK_MISSING" } as const;
          const readback = fromRow(persisted);
          if (computeP0RepositorySemanticSha256(readback) !== computeP0RepositorySemanticSha256(expectedValue)) {
            return { kind: "CONFLICT", code: "EXTRACTION_INPUT_REPLAY_MISMATCH" } as const;
          }
          const attestation = await verifyPrismaP0RepositoryReadback({
            operationId: input.operationId,
            purpose: "EXTRACTION_INPUT_COMMIT",
            scope,
            expectedSnapshot: expectedValue,
            readbackSnapshot: readback,
            sourceRefs: [
              { resourceType: "REPORT_VERSION", resourceId: reportVersionId, resourceVersion: String(input.ingestion.reservedVersion), integritySha256: input.ingestion.sourceSha256 },
              { resourceType: "SOURCE_OBJECT", resourceId: object.scope.artifactId, resourceVersion: String(object.scope.artifactVersion), integritySha256: object.sha256 },
            ],
            verifier,
          });
          return attestation ? { kind: disposition, value: attestation.snapshot, attestation } as const : { kind: "OUTCOME_UNKNOWN", code: "EXTRACTION_INPUT_ATTESTATION_FAILED" } as const;
        }, { isolationLevel: "Serializable", maxWait: dependencies.maxWaitMs ?? 5_000, timeout: dependencies.timeoutMs ?? 15_000 });
      } catch (error) {
        if (isExactPostgresDeadlock(error)) {
          return {
            kind: "DEADLOCK_DETECTED",
            code: "POSTGRES_40P01_DEADLOCK_DETECTED",
            databaseCode: "40P01",
            retryable: false,
          };
        }
        return { kind: "OUTCOME_UNKNOWN", code: "EXTRACTION_INPUT_TRANSACTION_UNKNOWN" };
      }
    },
  });
}
