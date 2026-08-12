import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  p0PrincipalAuthorizesScope,
  type P0Principal,
} from "./principal";
import {
  P0_MAX_SOURCE_ARTIFACT_BYTES,
  P0_PRISMA_SOURCE_PROVIDER_KEY,
  P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
  computeP0SourceArtifactSha256,
  computeP0StoredSourceObjectBindingSha256,
  createAuthenticatedP0SourceArtifactWriteFence,
  deriveP0SourceArtifactOperationIdentity,
  p0SourceArtifactProviderErasureAuthorizes,
  p0SourceArtifactProviderOrphanReadAuthorizes,
  p0SourceArtifactProviderReadAuthorizes,
  p0SourceArtifactProviderWriteAuthorizes,
  p0SourceArtifactProviderWriteReadbackAuthorizes,
  type P0AuthenticatedSourceWriteFenceBackend,
  type P0SourceArtifactOrphanReconciliationRequest,
  type P0SourceArtifactProvider,
  type P0SourceArtifactReadRequest,
  type P0SourceArtifactReadback,
  type P0SourceArtifactScope,
  type P0SourceArtifactTombstoneRequest,
  type P0SourceArtifactTombstoneResult,
  type P0SourceArtifactWriteFence,
  type P0SourceArtifactWriteReadbackRequest,
  type P0SourceArtifactWriteRequest,
  type P0StoredSourceArtifact,
  type P0SourceWriteFenceResult,
  type VerifiedP0SourceWriteFencePermit,
} from "./sourceArtifact";
import {
  P0_TRUSTED_WRITER_VALUE_PROTECTION_VERSION,
  type P0TrustedWriterProtectedValue,
  type P0TrustedWriterValueProtectionAdapter,
} from "./trustedWriterValueProtection";

export const P0_PRISMA_SOURCE_ARTIFACT_ADAPTER_ID =
  "p0-prisma-encrypted-source-v1" as const;
export const P0_PRISMA_SOURCE_BYTES_ENVELOPE_VERSION =
  "p0-prisma-source-bytes-v1" as const;
export const P0_PRISMA_SOURCE_LOCATOR_ENVELOPE_VERSION =
  "p0-prisma-source-locator-v1" as const;
export const P0_PRISMA_SOURCE_BYTES_AAD_VERSION =
  "p0-source-object-aad-v1" as const;
export const P0_PRISMA_SOURCE_LOCATOR_AAD_VERSION =
  "p0-source-locator-aad-v1" as const;

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export interface P0PrismaSourceObjectRow {
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly ingestionId: string;
  readonly artifactId: string;
  readonly artifactVersion: number;
  readonly providerOperationId: string;
  readonly providerObjectVersion: string;
  readonly kind: string;
  readonly mimeType: string;
  readonly sha256: string;
  readonly byteLength: bigint;
  readonly ciphertext: Uint8Array;
  readonly iv: Uint8Array;
  readonly authTag: Uint8Array;
  readonly keyVersion: string;
  readonly algorithm: "AES_256_GCM";
  readonly envelopeVersion: string;
  readonly aadVersion: string;
  readonly aadSha256: string;
  readonly locatorCiphertext: Uint8Array;
  readonly locatorIv: Uint8Array;
  readonly locatorAuthTag: Uint8Array;
  readonly locatorKeyVersion: string;
  readonly locatorAlgorithm: "AES_256_GCM";
  readonly locatorEnvelopeVersion: string;
  readonly locatorAadVersion: string;
  readonly locatorAadSha256: string;
  readonly storedAt: Date;
}

interface P0PrismaSourceObjectDelegate {
  findFirst(input: {
    readonly where: Readonly<Record<string, unknown>>;
  }): Promise<P0PrismaSourceObjectRow | null>;
  create(input: {
    readonly data: Readonly<Record<string, unknown>>;
  }): Promise<P0PrismaSourceObjectRow>;
}

export interface P0PrismaSourceTransaction {
  readonly p0SourceObject: P0PrismaSourceObjectDelegate;
  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: readonly unknown[]
  ): Promise<T>;
}

interface P0PrismaSourceClient {
  readonly p0SourceObject: P0PrismaSourceObjectDelegate;
  $transaction<T>(
    execute: (transaction: P0PrismaSourceTransaction) => Promise<T>,
    options?: { readonly isolationLevel: "Serializable" },
  ): Promise<T>;
}

interface FenceRow {
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly operationKey: string;
  readonly revision: number;
  readonly state: string;
  readonly sourceDisposition: string;
}

interface P0PrismaSourceReadAuditRow {
  readonly eventKey: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly authorizationKind: string;
  readonly authorizationVersion: string;
  readonly accessKind: string;
  readonly purposeCode: string;
  readonly decision: string;
  readonly decisionCode: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceVersion: number;
  readonly occurredAt: Date;
}

export interface P0PrismaSourceArtifactAdapterBundle {
  readonly adapterClass: "AUTHENTICATED_PRODUCTION";
  readonly adapterId: typeof P0_PRISMA_SOURCE_ARTIFACT_ADAPTER_ID;
  readonly provider: P0SourceArtifactProvider;
  readonly writeFence: P0SourceArtifactWriteFence;
  readonly valueProtectionAdapterId: string;
  readonly valueProtectionKeyVersion: string;
}

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(parts: readonly unknown[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(parts));
}

function sameScope(
  row: P0PrismaSourceObjectRow,
  scope: P0SourceArtifactScope,
): boolean {
  return (
    row.tenantId === scope.tenantId &&
    row.consumerId === scope.consumerId &&
    row.ingestionId === scope.ingestionId &&
    row.artifactId === scope.artifactId &&
    row.artifactVersion === scope.artifactVersion
  );
}

function sourceAad(input: {
  readonly scope: P0SourceArtifactScope;
  readonly providerOperationId: string;
  readonly providerObjectVersion: string;
  readonly kind: string;
  readonly mimeType: string;
  readonly sha256: string;
  readonly byteLength: number;
}): Uint8Array {
  return canonical([
    P0_PRISMA_SOURCE_ARTIFACT_ADAPTER_ID,
    "SOURCE_BYTES",
    input.scope.tenantId,
    input.scope.consumerId,
    input.scope.ingestionId,
    input.scope.artifactId,
    input.scope.artifactVersion,
    input.providerOperationId,
    input.providerObjectVersion,
    input.kind,
    input.mimeType,
    input.sha256,
    input.byteLength,
  ]);
}

function locatorAad(input: {
  readonly scope: P0SourceArtifactScope;
  readonly providerOperationId: string;
  readonly providerObjectVersion: string;
}): Uint8Array {
  return canonical([
    P0_PRISMA_SOURCE_ARTIFACT_ADAPTER_ID,
    "SOURCE_LOCATOR",
    input.scope.tenantId,
    input.scope.consumerId,
    input.scope.ingestionId,
    input.scope.artifactId,
    input.scope.artifactVersion,
    input.providerOperationId,
    input.providerObjectVersion,
  ]);
}

export function deriveP0PrismaSourcePhysicalIdentity(input: {
  readonly scope: P0SourceArtifactScope;
  readonly providerOperationId: string;
  readonly sha256: string;
}): { readonly id: string; readonly providerObjectVersion: string } {
  const binding = digest(
    JSON.stringify([
      P0_PRISMA_SOURCE_ARTIFACT_ADAPTER_ID,
      input.scope.tenantId,
      input.scope.consumerId,
      input.scope.ingestionId,
      input.scope.artifactId,
      input.scope.artifactVersion,
      input.providerOperationId,
      input.sha256,
    ]),
  );
  return Object.freeze({
    id: `p0obj_${binding.slice(0, 40)}`,
    providerObjectVersion: `p0objv_${binding}`,
  });
}

function protectedValueFromRow(
  row: P0PrismaSourceObjectRow,
  kind: "CONTENT" | "LOCATOR",
): P0TrustedWriterProtectedValue {
  const locator = kind === "LOCATOR";
  return {
    contractVersion: P0_TRUSTED_WRITER_VALUE_PROTECTION_VERSION,
    ciphertext: new Uint8Array(
      locator ? row.locatorCiphertext : row.ciphertext,
    ),
    iv: new Uint8Array(locator ? row.locatorIv : row.iv),
    authTag: new Uint8Array(locator ? row.locatorAuthTag : row.authTag),
    algorithm: "AES_256_GCM",
    keyVersion: locator ? row.locatorKeyVersion : row.keyVersion,
    envelopeVersion: locator
      ? P0_PRISMA_SOURCE_LOCATOR_ENVELOPE_VERSION
      : P0_PRISMA_SOURCE_BYTES_ENVELOPE_VERSION,
    aadVersion: locator ? row.locatorAadVersion : row.aadVersion,
    aadSha256: locator ? row.locatorAadSha256 : row.aadSha256,
  };
}

export function isValidP0PrismaSourceObjectRow(
  row: P0PrismaSourceObjectRow | null,
): row is P0PrismaSourceObjectRow {
  if (!row) return false;
  const byteLength = Number(row.byteLength);
  return Boolean(
    STABLE.test(row.id) &&
      STABLE.test(row.tenantId) &&
      STABLE.test(row.consumerId) &&
      STABLE.test(row.ingestionId) &&
      STABLE.test(row.artifactId) &&
      Number.isSafeInteger(row.artifactVersion) &&
      row.artifactVersion >= 1 &&
      STABLE.test(row.providerOperationId) &&
      STABLE.test(row.providerObjectVersion) &&
      ["ORIGINAL_PDF", "ORIGINAL_TEXT", "NORMALIZED_TEXT"].includes(row.kind) &&
      ((row.kind === "ORIGINAL_PDF" && row.mimeType === "application/pdf") ||
        (row.kind !== "ORIGINAL_PDF" && row.mimeType === "text/plain")) &&
      SHA256.test(row.sha256) &&
      Number.isSafeInteger(byteLength) &&
      byteLength > 0 &&
      byteLength <= P0_MAX_SOURCE_ARTIFACT_BYTES &&
      row.ciphertext instanceof Uint8Array &&
      row.ciphertext.byteLength > 0 &&
      row.iv instanceof Uint8Array &&
      row.iv.byteLength === 12 &&
      row.authTag instanceof Uint8Array &&
      row.authTag.byteLength === 16 &&
      STABLE.test(row.keyVersion) &&
      row.algorithm === "AES_256_GCM" &&
      row.envelopeVersion === P0_PRISMA_SOURCE_BYTES_ENVELOPE_VERSION &&
      row.aadVersion === P0_PRISMA_SOURCE_BYTES_AAD_VERSION &&
      SHA256.test(row.aadSha256) &&
      row.locatorCiphertext instanceof Uint8Array &&
      row.locatorCiphertext.byteLength > 0 &&
      row.locatorIv instanceof Uint8Array &&
      row.locatorIv.byteLength === 12 &&
      row.locatorAuthTag instanceof Uint8Array &&
      row.locatorAuthTag.byteLength === 16 &&
      STABLE.test(row.locatorKeyVersion) &&
      row.locatorAlgorithm === "AES_256_GCM" &&
      row.locatorEnvelopeVersion ===
        P0_PRISMA_SOURCE_LOCATOR_ENVELOPE_VERSION &&
      row.locatorAadVersion === P0_PRISMA_SOURCE_LOCATOR_AAD_VERSION &&
      SHA256.test(row.locatorAadSha256) &&
      row.storedAt instanceof Date &&
      Number.isFinite(row.storedAt.getTime()),
  );
}

function rowToObject(
  row: P0PrismaSourceObjectRow,
  writeDisposition: "CREATED" | "IDEMPOTENT_REPLAY",
): P0StoredSourceArtifact {
  return Object.freeze({
    contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
    scope: Object.freeze({
      tenantId: row.tenantId,
      consumerId: row.consumerId,
      ingestionId: row.ingestionId,
      artifactId: row.artifactId,
      artifactVersion: row.artifactVersion,
    }),
    providerKey: P0_PRISMA_SOURCE_PROVIDER_KEY,
    providerOperationId: row.providerOperationId,
    providerObjectVersion: row.providerObjectVersion,
    locator: Object.freeze({
      ciphertextBase64: Buffer.from(row.locatorCiphertext).toString("base64"),
      ivBase64: Buffer.from(row.locatorIv).toString("base64"),
      authTagBase64: Buffer.from(row.locatorAuthTag).toString("base64"),
      algorithm: "AES_256_GCM" as const,
      keyVersion: row.locatorKeyVersion,
      envelopeVersion: P0_PRISMA_SOURCE_LOCATOR_ENVELOPE_VERSION,
      aadVersion: row.locatorAadVersion,
      aadSha256: row.locatorAadSha256,
    }),
    kind: row.kind as P0StoredSourceArtifact["kind"],
    mimeType: row.mimeType,
    sha256: row.sha256,
    byteLength: Number(row.byteLength),
    writeDisposition,
    immutable: true as const,
    storedAt: row.storedAt.toISOString(),
  });
}

function rowMatchesWrite(
  row: P0PrismaSourceObjectRow,
  request: P0SourceArtifactWriteRequest,
): boolean {
  const identity = deriveP0PrismaSourcePhysicalIdentity({
    scope: request.scope,
    providerOperationId: request.idempotencyKey,
    sha256: computeP0SourceArtifactSha256(request.content),
  });
  return Boolean(
    isValidP0PrismaSourceObjectRow(row) &&
      sameScope(row, request.scope) &&
      row.id === identity.id &&
      row.providerOperationId === request.idempotencyKey &&
      row.providerObjectVersion === identity.providerObjectVersion &&
      row.kind === request.kind &&
      row.mimeType === request.mimeType &&
      row.sha256 === computeP0SourceArtifactSha256(request.content) &&
      Number(row.byteLength) === request.content.byteLength,
  );
}

function exactLocatorPlaintext(
  row: P0PrismaSourceObjectRow,
  plaintext: Uint8Array,
): boolean {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    return (
      Array.isArray(parsed) &&
      parsed.length === 5 &&
      parsed[0] === P0_PRISMA_SOURCE_ARTIFACT_ADAPTER_ID &&
      parsed[1] === row.id &&
      parsed[2] === row.providerObjectVersion &&
      parsed[3] === row.providerOperationId &&
      parsed[4] === row.sha256
    );
  } catch {
    return false;
  }
}

async function readAndVerifyRow(input: {
  readonly row: P0PrismaSourceObjectRow;
  readonly object: P0StoredSourceArtifact;
  readonly protector: P0TrustedWriterValueProtectionAdapter;
  readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY";
}): Promise<P0SourceArtifactReadback> {
  const { row, object, protector } = input;
  if (!isValidP0PrismaSourceObjectRow(row) || !sameScope(row, object.scope)) {
    throw new Error("invalid persisted source row");
  }
  const expectedObject = rowToObject(row, input.disposition);
  if (
    computeP0StoredSourceObjectBindingSha256(expectedObject) !==
    computeP0StoredSourceObjectBindingSha256(object)
  ) {
    throw new Error("persisted source object binding mismatch");
  }
  const bytesAad = sourceAad({
    scope: object.scope,
    providerOperationId: row.providerOperationId,
    providerObjectVersion: row.providerObjectVersion,
    kind: row.kind,
    mimeType: row.mimeType,
    sha256: row.sha256,
    byteLength: Number(row.byteLength),
  });
  const content = await protector.unprotect({
    protectedValue: protectedValueFromRow(row, "CONTENT"),
    aad: bytesAad,
    expectedEnvelopeVersion: P0_PRISMA_SOURCE_BYTES_ENVELOPE_VERSION,
    expectedAadVersion: P0_PRISMA_SOURCE_BYTES_AAD_VERSION,
  });
  const locator = await protector.unprotect({
    protectedValue: protectedValueFromRow(row, "LOCATOR"),
    aad: locatorAad({
      scope: object.scope,
      providerOperationId: row.providerOperationId,
      providerObjectVersion: row.providerObjectVersion,
    }),
    expectedEnvelopeVersion: P0_PRISMA_SOURCE_LOCATOR_ENVELOPE_VERSION,
    expectedAadVersion: P0_PRISMA_SOURCE_LOCATOR_AAD_VERSION,
  });
  if (
    !content ||
    !locator ||
    !exactLocatorPlaintext(row, locator) ||
    content.byteLength !== Number(row.byteLength) ||
    computeP0SourceArtifactSha256(content) !== row.sha256
  ) {
    throw new Error("persisted source decrypt/readback mismatch");
  }
  return Object.freeze({
    object: expectedObject,
    content: new Uint8Array(content),
    readAt: new Date().toISOString(),
  });
}

const FENCE_SQL = `
SELECT "id", "tenantId", "consumerId", "operationKey", "revision", "state", "sourceDisposition"
FROM "ReportIngestion"
WHERE "tenantId" = $1
  AND "consumerId" = $2
  AND "id" = $3
FOR UPDATE
`;

export function createP0PrismaSourceArtifactAdapter(input: {
  readonly prisma: PrismaClient;
  readonly protector: P0TrustedWriterValueProtectionAdapter;
  readonly revalidatePrincipal: (
    transaction: P0PrismaSourceTransaction,
    principal: P0Principal,
    operationId: string,
    repositoryPurpose: "SOURCE_ARTIFACT_WRITE" | "SOURCE_ARTIFACT_READ",
  ) => Promise<boolean>;
}): P0PrismaSourceArtifactAdapterBundle {
  if (
    !input?.prisma ||
    input.protector?.adapterClass !== "AUTHENTICATED_PRODUCTION" ||
    !STABLE.test(input.protector.adapterId) ||
    !STABLE.test(input.protector.keyVersion) ||
    typeof input.revalidatePrincipal !== "function"
  ) {
    throw new Error("invalid Prisma source-artifact adapter dependencies");
  }
  const client = input.prisma as unknown as P0PrismaSourceClient;
  if (
    typeof client.$transaction !== "function" ||
    typeof client.p0SourceObject?.findFirst !== "function" ||
    typeof client.p0SourceObject?.create !== "function"
  ) {
    throw new Error("P0SourceObject Prisma delegate unavailable");
  }
  const transactionContext = new AsyncLocalStorage<P0PrismaSourceTransaction>();
  const backend: P0AuthenticatedSourceWriteFenceBackend = Object.freeze({
    adapterClass: "AUTHENTICATED_PRODUCTION" as const,
    backendId: "p0-prisma-retained-ingestion-fence-v1",
    async runWhileRetained<T>(request: {
      readonly principal: Parameters<
        P0AuthenticatedSourceWriteFenceBackend["runWhileRetained"]
      >[0]["principal"];
      readonly scope: P0SourceArtifactScope;
      readonly ingestionRevision: number;
      readonly operationId: string;
      readonly sourceOperationId: string;
      readonly execute: () => Promise<T>;
    }): Promise<P0SourceWriteFenceResult<T>> {
      if (
        request.principal.authorizationKind !== "SYSTEM_WORKER" ||
        !p0PrincipalAuthorizesScope(request.principal, request.scope)
      ) {
        return { kind: "DENIED" };
      }
      try {
        return await client.$transaction(async (transaction) => {
          let principalStillAuthorized = false;
          try {
            principalStillAuthorized =
              (await input.revalidatePrincipal(
                transaction,
                request.principal,
                request.operationId,
                "SOURCE_ARTIFACT_WRITE",
              )) === true;
          } catch {
            principalStillAuthorized = false;
          }
          if (!principalStillAuthorized) {
            return { kind: "DENIED" } as const;
          }
          const rows = await transaction.$queryRawUnsafe<FenceRow[]>(
            FENCE_SQL,
            request.scope.tenantId,
            request.scope.consumerId,
            request.scope.ingestionId,
          );
          const row = rows[0];
          if (
            rows.length !== 1 ||
            !row ||
            row.tenantId !== request.scope.tenantId ||
            row.consumerId !== request.scope.consumerId ||
            row.id !== request.scope.ingestionId ||
            row.operationKey !== request.sourceOperationId ||
            row.revision !== request.ingestionRevision ||
            row.sourceDisposition !== "RETAINED" ||
            row.state === "QUARANTINED"
          ) {
            return { kind: "DENIED" } as const;
          }
          return transactionContext.run(transaction, async () => ({
            kind: "EXECUTED" as const,
            value: await request.execute(),
          }));
        }, { isolationLevel: "Serializable" });
      } catch {
        return { kind: "OUTCOME_UNKNOWN" };
      }
    },
  });
  const writeFence = createAuthenticatedP0SourceArtifactWriteFence(backend);

  async function exactRow(
    delegate: P0PrismaSourceObjectDelegate,
    scope: P0SourceArtifactScope,
  ): Promise<P0PrismaSourceObjectRow | null> {
    return delegate.findFirst({
      where: {
        tenantId: scope.tenantId,
        consumerId: scope.consumerId,
        ingestionId: scope.ingestionId,
        artifactId: scope.artifactId,
        artifactVersion: scope.artifactVersion,
      },
    });
  }

  const readAuditSql = `
SELECT "eventKey", "correlationId", "actorId", "tenantId", "consumerId",
       "authorizationKind", "authorizationVersion", "accessKind",
       "purposeCode", "decision", "decisionCode", "resourceType",
       "resourceId", "resourceVersion", "occurredAt"
FROM "P0SensitiveAccessEvent"
WHERE "tenantId" = $1
  AND "consumerId" = $2
  AND "eventKey" = $3
`;

  function exactPersistedReadAudit(
    row: P0PrismaSourceReadAuditRow | null,
    request: P0SourceArtifactReadRequest,
  ): boolean {
    return Boolean(
      row &&
        row.eventKey === request.sensitiveAccessGrant.auditEventKey &&
        row.correlationId === request.sensitiveAccessGrant.correlationId &&
        row.actorId === request.principal.actorId &&
        row.tenantId === request.object.scope.tenantId &&
        row.consumerId === request.object.scope.consumerId &&
        row.authorizationKind === request.principal.authorizationKind &&
        row.authorizationVersion === request.principal.authorizationVersion &&
        row.accessKind === request.sensitiveAccessKind &&
        row.purposeCode === request.sensitiveAccessPurposeCode &&
        row.decision === "ALLOW" &&
        row.decisionCode === "AUTHORIZED" &&
        row.resourceType === request.sensitiveResource.resourceType &&
        row.resourceId === request.sensitiveResource.resourceId &&
        row.resourceVersion === request.sensitiveResource.resourceVersion &&
        row.occurredAt instanceof Date &&
        Number.isFinite(row.occurredAt.getTime()) &&
        row.occurredAt.toISOString() === request.sensitiveAccessGrant.issuedAt,
    );
  }

  const provider: P0SourceArtifactProvider = Object.freeze({
    providerKey: P0_PRISMA_SOURCE_PROVIDER_KEY,
    async putImmutable(
      request: P0SourceArtifactWriteRequest & {
        readonly writeFencePermit: VerifiedP0SourceWriteFencePermit;
      },
    ): Promise<P0StoredSourceArtifact> {
      const transaction = transactionContext.getStore();
      if (
        !transaction ||
        !p0SourceArtifactProviderWriteAuthorizes(
          request,
          P0_PRISMA_SOURCE_PROVIDER_KEY,
        )
      ) {
        throw new Error("source write requires exact fenced authority");
      }
      const observedSha256 = computeP0SourceArtifactSha256(request.content);
      if (
        observedSha256 !== request.sha256 ||
        request.content.byteLength !== request.byteLength ||
        request.content.byteLength < 1
      ) {
        throw new Error("caller source digest is not authoritative");
      }
      const operationIdentity = deriveP0SourceArtifactOperationIdentity({
        tenantId: request.scope.tenantId,
        consumerId: request.scope.consumerId,
        ingestionId: request.scope.ingestionId,
        operationId: request.sourceOperationId,
        kind: request.kind,
      });
      if (
        request.scope.artifactId !== operationIdentity.artifactId ||
        request.idempotencyKey !== operationIdentity.providerOperationId
      ) {
        throw new Error("server-derived source identity mismatch");
      }
      const prior = await exactRow(transaction.p0SourceObject, request.scope);
      if (prior) {
        if (!rowMatchesWrite(prior, request)) {
          throw new Error("immutable source replay conflict");
        }
        const replay = rowToObject(prior, "IDEMPOTENT_REPLAY");
        await readAndVerifyRow({
          row: prior,
          object: replay,
          protector: input.protector,
          disposition: "IDEMPOTENT_REPLAY",
        });
        return replay;
      }
      const physical = deriveP0PrismaSourcePhysicalIdentity({
        scope: request.scope,
        providerOperationId: request.idempotencyKey,
        sha256: observedSha256,
      });
      const bytesAad = sourceAad({
        scope: request.scope,
        providerOperationId: request.idempotencyKey,
        providerObjectVersion: physical.providerObjectVersion,
        kind: request.kind,
        mimeType: request.mimeType,
        sha256: observedSha256,
        byteLength: request.content.byteLength,
      });
      const locatorAadBytes = locatorAad({
        scope: request.scope,
        providerOperationId: request.idempotencyKey,
        providerObjectVersion: physical.providerObjectVersion,
      });
      const protectedContent = await input.protector.protect({
        plaintext: new Uint8Array(request.content),
        aad: bytesAad,
        envelopeVersion: P0_PRISMA_SOURCE_BYTES_ENVELOPE_VERSION,
        aadVersion: P0_PRISMA_SOURCE_BYTES_AAD_VERSION,
      });
      const protectedLocator = await input.protector.protect({
        plaintext: canonical([
          P0_PRISMA_SOURCE_ARTIFACT_ADAPTER_ID,
          physical.id,
          physical.providerObjectVersion,
          request.idempotencyKey,
          observedSha256,
        ]),
        aad: locatorAadBytes,
        envelopeVersion: P0_PRISMA_SOURCE_LOCATOR_ENVELOPE_VERSION,
        aadVersion: P0_PRISMA_SOURCE_LOCATOR_AAD_VERSION,
      });
      if (!protectedContent || !protectedLocator) {
        throw new Error("source value protection failed");
      }
      const storedAt = new Date();
      await transaction.p0SourceObject.create({
        data: {
          id: physical.id,
          tenantId: request.scope.tenantId,
          consumerId: request.scope.consumerId,
          ingestionId: request.scope.ingestionId,
          artifactId: request.scope.artifactId,
          artifactVersion: request.scope.artifactVersion,
          providerOperationId: request.idempotencyKey,
          providerObjectVersion: physical.providerObjectVersion,
          kind: request.kind,
          mimeType: request.mimeType,
          sha256: observedSha256,
          byteLength: BigInt(request.content.byteLength),
          ciphertext: Buffer.from(protectedContent.ciphertext),
          iv: Buffer.from(protectedContent.iv),
          authTag: Buffer.from(protectedContent.authTag),
          keyVersion: protectedContent.keyVersion,
          algorithm: "AES_256_GCM",
          envelopeVersion: protectedContent.envelopeVersion,
          aadVersion: protectedContent.aadVersion,
          aadSha256: protectedContent.aadSha256,
          locatorCiphertext: Buffer.from(protectedLocator.ciphertext),
          locatorIv: Buffer.from(protectedLocator.iv),
          locatorAuthTag: Buffer.from(protectedLocator.authTag),
          locatorKeyVersion: protectedLocator.keyVersion,
          locatorAlgorithm: "AES_256_GCM",
          locatorEnvelopeVersion: protectedLocator.envelopeVersion,
          locatorAadVersion: protectedLocator.aadVersion,
          locatorAadSha256: protectedLocator.aadSha256,
          storedAt,
        },
      });
      const persisted = await exactRow(
        transaction.p0SourceObject,
        request.scope,
      );
      if (!persisted || !rowMatchesWrite(persisted, request)) {
        throw new Error("source persistence readback mismatch");
      }
      const object = rowToObject(persisted, "CREATED");
      await readAndVerifyRow({
        row: persisted,
        object,
        protector: input.protector,
        disposition: "CREATED",
      });
      return object;
    },
    async readBackAfterWrite(
      request: P0SourceArtifactWriteReadbackRequest,
    ): Promise<P0SourceArtifactReadback> {
      const transaction = transactionContext.getStore();
      if (
        !transaction ||
        !p0SourceArtifactProviderWriteReadbackAuthorizes(
          request,
          P0_PRISMA_SOURCE_PROVIDER_KEY,
        )
      ) {
        throw new Error("source readback requires exact fenced authority");
      }
      const row = await exactRow(
        transaction.p0SourceObject,
        request.object.scope,
      );
      if (!row) throw new Error("persisted source missing");
      return readAndVerifyRow({
        row,
        object: request.object,
        protector: input.protector,
        disposition: request.object.writeDisposition,
      });
    },
    async discoverAfterUnknownWrite(
      request: P0SourceArtifactOrphanReconciliationRequest & {
        readonly writeFencePermit: VerifiedP0SourceWriteFencePermit;
      },
    ): Promise<P0SourceArtifactReadback> {
      const transaction = transactionContext.getStore();
      if (
        !transaction ||
        !p0SourceArtifactProviderOrphanReadAuthorizes(
          request,
          P0_PRISMA_SOURCE_PROVIDER_KEY,
        )
      ) {
        throw new Error("source reconciliation requires exact fenced authority");
      }
      const row = await exactRow(transaction.p0SourceObject, request.scope);
      if (
        !row ||
        row.providerOperationId !==
          deriveP0SourceArtifactOperationIdentity({
            tenantId: request.scope.tenantId,
            consumerId: request.scope.consumerId,
            ingestionId: request.scope.ingestionId,
            operationId: request.sourceOperationId,
            kind: request.kind,
          }).providerOperationId ||
        row.sha256 !== request.sha256 ||
        Number(row.byteLength) !== request.byteLength ||
        row.kind !== request.kind ||
        row.mimeType !== request.mimeType
      ) {
        throw new Error("unknown source outcome cannot be adopted");
      }
      const object = rowToObject(row, "IDEMPOTENT_REPLAY");
      return readAndVerifyRow({
        row,
        object,
        protector: input.protector,
        disposition: "IDEMPOTENT_REPLAY",
      });
    },
    async readExact(
      request: P0SourceArtifactReadRequest,
    ): Promise<P0SourceArtifactReadback> {
      if (
        !p0SourceArtifactProviderReadAuthorizes(
          request,
          P0_PRISMA_SOURCE_PROVIDER_KEY,
        )
      ) {
        throw new Error("source read requires exact audited authority");
      }
      return client.$transaction(async (transaction) => {
        let principalStillAuthorized = false;
        try {
          principalStillAuthorized =
            (await input.revalidatePrincipal(
              transaction,
              request.principal,
              request.capability.authorizationDecisionId,
              "SOURCE_ARTIFACT_READ",
            )) === true;
        } catch {
          principalStillAuthorized = false;
        }
        if (
          !principalStillAuthorized ||
          !p0SourceArtifactProviderReadAuthorizes(
            request,
            P0_PRISMA_SOURCE_PROVIDER_KEY,
          )
        ) {
          throw new Error("live source-read authority denied");
        }
        const auditRows = await transaction.$queryRawUnsafe<
          P0PrismaSourceReadAuditRow[]
        >(
          readAuditSql,
          request.object.scope.tenantId,
          request.object.scope.consumerId,
          request.sensitiveAccessGrant.auditEventKey,
        );
        if (
          auditRows.length !== 1 ||
          !exactPersistedReadAudit(auditRows[0] ?? null, request)
        ) {
          throw new Error("persisted source-read audit mismatch");
        }
        const row = await exactRow(
          transaction.p0SourceObject,
          request.object.scope,
        );
        if (!row) throw new Error("persisted source missing");
        return readAndVerifyRow({
          row,
          object: request.object,
          protector: input.protector,
          disposition: request.object.writeDisposition,
        });
      }, { isolationLevel: "Serializable" });
    },
    async tombstoneExact(
      request: P0SourceArtifactTombstoneRequest,
    ): Promise<P0SourceArtifactTombstoneResult> {
      if (
        !p0SourceArtifactProviderErasureAuthorizes(
          request,
          P0_PRISMA_SOURCE_PROVIDER_KEY,
        )
      ) {
        throw new Error("source erasure requires exact policy authority");
      }
      // Physical erasure is deliberately not implemented until the separate
      // retention/legal-hold decision exists. Returning an explicit failure is
      // fail-closed and cannot be mistaken for object deletion or crypto-shred.
      return Object.freeze({
        status: "FAILED" as const,
        providerKey: P0_PRISMA_SOURCE_PROVIDER_KEY,
        providerObjectVersion: request.object.providerObjectVersion,
        objectBindingSha256:
          computeP0StoredSourceObjectBindingSha256(request.object),
        completedAt: new Date().toISOString(),
      });
    },
  });

  return Object.freeze({
    adapterClass: "AUTHENTICATED_PRODUCTION" as const,
    adapterId: P0_PRISMA_SOURCE_ARTIFACT_ADAPTER_ID,
    provider,
    writeFence,
    valueProtectionAdapterId: input.protector.adapterId,
    valueProtectionKeyVersion: input.protector.keyVersion,
  });
}
