import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import {
  createP0PrismaServerPrincipalDependencies,
  issueP0WorkerOperationToken,
  type P0PrincipalIngestionRow,
  type P0PrincipalPrismaClient,
  type P0PrincipalUserRow,
  type P0WorkerTokenConfiguration,
} from "../lib/creditTruth/principalPrismaAdapter";
import {
  P0_PHASE2A_FLAG_CONTRACT_VERSION,
  verifyP0Phase2ACohortDecision,
} from "../lib/creditTruth/phase2Flags";
import {
  P0_PHASE2A_READINESS_CONTRACT_VERSION,
  P0_REPOSITORY_CAPABILITIES,
  verifyP0RepositoryReadinessReceipt,
  type P0Phase2AReadinessEvidence,
} from "../lib/creditTruth/phase2Readiness";
import type { P0Principal } from "../lib/creditTruth/principal";
import {
  p0ScopeFromPrincipal,
} from "../lib/creditTruth/principal";
import type {
  P0ReportIngestion,
  P0ReportIngestionService,
} from "../lib/creditTruth/reportIngestion";
import type { P0PrismaReportVersionRepository } from "../lib/creditTruth/prismaReportVersionRepository";
import {
  P0_LOCAL_SOURCE_PROVIDER_KEY,
  P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
  createLocalSyntheticP0SourceArtifactProvider,
  createLocalSyntheticP0SourceRetentionState,
  deriveP0SourceArtifactOperationIdentity,
  dispatchP0SourceArtifactWrite,
  verifyP0SourceArtifactCapability,
} from "../lib/creditTruth/sourceArtifact";
import {
  authorizeAndAuditP0SensitiveAccess,
  verifyAndDeriveP0SensitiveAuditRefs,
  verifyP0SensitiveResourceRef,
  type P0SensitiveAccessEventDraft,
} from "../lib/creditTruth/sensitiveAccessAudit";
import {
  createP0ProductionTrustedWriterUploadHook,
  createP0TrustedWriterPrismaUploadHook,
  createP0TrustedWriterUploadHook,
  P0_TRUSTED_WRITER_DISPOSABLE_MODE,
  P0_TRUSTED_WRITER_PRODUCTION_DORMANT_MODE,
  P0_TRUSTED_WRITER_RUNTIME_MODE_ENV,
  selectP0TrustedWriterUploadSource,
  withP0DisposableTrustedWriterUploadHook,
  type P0TrustedWriterSourcePersister,
  type P0TrustedWriterUploadRuntimeDependencies,
} from "../lib/creditTruth/trustedWriterUploadHook";
import { createDeterministicDisposableP0ValueProtectionAdapter } from "../lib/creditTruth/trustedWriterValueProtection";
import {
  assertP0TrustedWriterDatabaseRoleInTransaction,
  bindP0TrustedWriterPrismaClientToDatabaseRole,
  createP0ProductionTrustedWriterPrismaClientProvider,
  p0TrustedWriterDatabaseRoleIdentitySha256,
  P0_TRUSTED_WRITER_DATABASE_ROLE_ENV,
  P0_TRUSTED_WRITER_DATABASE_URL_ENV,
} from "../lib/creditTruth/trustedWriterPrismaClient";
import {
  P0_TRUSTED_WRITER_CAPABILITIES,
  P0_TRUSTED_WRITER_READINESS_CONTRACT_VERSION,
  P0_TRUSTED_WRITER_REQUIRED_ADAPTERS,
  P0_TRUSTED_WRITER_REQUIRED_SAFETY_FLAGS,
  p0TrustedWriterAttestationSigningPayload,
  type P0TrustedWriterReadinessCandidate,
  type P0TrustedWriterReadinessEnvelope,
} from "../lib/creditTruth/trustedWriterReadiness";

process.env.P0_PHASE2_ENABLED = "true";
process.env.P0_INGESTION_SHADOW_ENABLED = "true";
process.env.P0_PHASE2_KILL_SWITCH = "false";
process.env.P0_ROUND0_REVIEW_ENABLED = "false";
process.env.P0_ASSERTION_RUNTIME_ENABLED = "false";

let passed = 0;
async function test(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

const sha256 = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");

const users = new Map<string, P0PrincipalUserRow>();
const workerRows = new Map<string, P0PrincipalIngestionRow>();
let sessionActorId: string | null = null;
const workerConfiguration: P0WorkerTokenConfiguration = Object.freeze({
  workerActorId: "p0-upload-worker",
  hmacKey: new Uint8Array(Buffer.alloc(32, 0x63)),
});
const PRODUCTION_TEST_DATABASE_ROLE = "p0_writer_upload_test";
const principalClient: P0PrincipalPrismaClient = {
  user: {
    async findUnique({ where }) {
      const row = users.get(where.id);
      return row ? { ...row } : null;
    },
  },
  reportIngestion: {
    async findUnique({ where }) {
      const row = workerRows.get(where.id);
      return row ? { ...row } : null;
    },
  },
};

function user(
  id: string,
  overrides: Partial<P0PrincipalUserRow> = {},
): P0PrincipalUserRow {
  return {
    id,
    disabled: false,
    role: "USER",
    isAgency: false,
    managedByAgencyId: null,
    p0AuthorizationRevision: 1,
    ...overrides,
  };
}

const principalDependencies = createP0PrismaServerPrincipalDependencies({
  client: principalClient,
  async resolveAuthenticatedAccount() {
    const value = sessionActorId ? users.get(sessionActorId) : null;
    return value ? { ...value } : null;
  },
  resolveWorkerTokenConfiguration: () => workerConfiguration,
});

async function readiness(): Promise<P0Phase2AReadinessEvidence> {
  const now = Date.now();
  const migrationSha256 = "a".repeat(64);
  const repositoryReceipt = await verifyP0RepositoryReadinessReceipt(
    {
      contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION,
      receiptId: "upload-hook-local-repository",
      receiptKind: "LOCAL_SYNTHETIC",
      repositoryAdapterId: "upload-hook-local",
      repositoryAdapterVersion: "v1",
      codeRevision: "upload-hook-test",
      migrationSha256,
      semanticsVersion: "v1",
      capabilities: P0_REPOSITORY_CAPABILITIES,
      issuedAt: new Date(now - 1_000).toISOString(),
      expiresAt: new Date(now + 120_000).toISOString(),
    },
    {
      verifierId: "upload-hook-local-verifier",
      verifyRepositoryReceipt: async () => true,
    },
  );
  assert(repositoryReceipt);
  return {
    migrationVerified: true,
    migrationSha256,
    principalBoundaryVerified: true,
    repositoryBoundaryVerified: true,
    sourceArtifactBoundaryVerified: true,
    ingestionBoundaryVerified: true,
    round0BoundaryVerified: false,
    assertionBoundaryVerified: false,
    repositoryReceipt,
  };
}

function ingestionRow(input: {
  readonly principal: P0Principal;
  readonly id: string;
  readonly idempotencyKey: string;
  readonly operationKey: string;
  readonly reportSeriesKey: string;
  readonly sourceSha256: string;
  readonly sourceByteLength: number;
  readonly mimeType: string;
}): P0ReportIngestion {
  const now = new Date().toISOString();
  return Object.freeze({
    contractVersion: "p0-report-ingestion-v1",
    id: input.id,
    tenantId: input.principal.tenantId,
    consumerId: input.principal.consumerId,
    actorId: input.principal.actorId,
    authorizationKind: input.principal.authorizationKind,
    authorizationVersion: input.principal.authorizationVersion,
    idempotencyKey: input.idempotencyKey,
    operationKey: input.operationKey,
    reportSeriesKey: input.reportSeriesKey,
    reservedVersion: 1,
    sourceSha256: input.sourceSha256,
    sourceByteLength: input.sourceByteLength,
    sourceDeclaredMimeType: input.mimeType,
    sourceDetectedMimeType: input.mimeType,
    sourceStorageProviderKey: null,
    sourceLocatorCiphertext: null,
    sourceLocatorIv: null,
    sourceLocatorAuthTag: null,
    sourceLocatorKeyVersion: null,
    sourceLocatorAlgorithm: null,
    sourceLocatorEnvelopeVersion: null,
    sourceLocatorAadVersion: null,
    sourceReadbackSha256: null,
    sourceReadbackByteLength: null,
    sourceVerifiedAt: null,
    sourceDisposition: "RETAINED",
    sourceDispositionReasonCode: null,
    sourceDispositionAt: null,
    state: "RECEIVED",
    safeFailureCode: null,
    revision: 1,
    attemptCount: 0,
    maxAttempts: 3,
    leaseToken: null,
    leaseOwnerId: null,
    leaseExpiresAt: null,
    nextAttemptAt: now,
    reportVersionId: null,
    sourceArtifactId: null,
    extractionRunId: null,
    createdAt: now,
    updatedAt: now,
  });
}

function createFakeIngestionService(): {
  readonly service: P0ReportIngestionService;
  readonly state: { row: P0ReportIngestion | null };
} {
  const state: { row: P0ReportIngestion | null } = { row: null };
  const service: P0ReportIngestionService = {
    async reserve(input) {
      if (state.row) {
        return { ok: true, kind: "IDEMPOTENT_REPLAY", ingestion: state.row };
      }
      const row = ingestionRow({
        principal: input.principal,
        id: `p0ing_${sha256(input.idempotencyKey).slice(0, 40)}`,
        idempotencyKey: input.idempotencyKey,
        operationKey: input.operationKey,
        reportSeriesKey: input.reportSeriesKey,
        sourceSha256: input.sourceSha256,
        sourceByteLength: input.sourceByteLength,
        mimeType: input.sourceDetectedMimeType,
      });
      state.row = row;
      workerRows.set(row.id, {
        id: row.id,
        tenantId: row.tenantId,
        consumerId: row.consumerId,
        revision: row.revision,
        state: row.state,
      });
      return { ok: true, kind: "RESERVED", ingestion: row };
    },
    async read() {
      return state.row
        ? { ok: true, kind: "FOUND", ingestion: state.row }
        : { ok: false, kind: "NOT_FOUND", code: "INGESTION_NOT_FOUND" };
    },
    async claim(input) {
      if (!state.row) return { ok: false, kind: "NOT_FOUND", code: "MISSING" };
      const now = Date.now();
      state.row = Object.freeze({
        ...state.row,
        revision: state.row.revision + 1,
        attemptCount: state.row.attemptCount + 1,
        leaseToken: "lease-upload-hook",
        leaseOwnerId: input.principal.actorId,
        leaseExpiresAt: new Date(now + 60_000).toISOString(),
        updatedAt: new Date(now).toISOString(),
      });
      workerRows.set(state.row.id, {
        id: state.row.id,
        tenantId: state.row.tenantId,
        consumerId: state.row.consumerId,
        revision: state.row.revision,
        state: state.row.state,
      });
      return { ok: true, kind: "CLAIMED", ingestion: state.row };
    },
    async transition(input) {
      if (!state.row) return { ok: false, kind: "NOT_FOUND", code: "MISSING" };
      const source = input.sourceReceipt?.object;
      const version = input.reportVersionReceipt?.snapshot;
      state.row = Object.freeze({
        ...state.row,
        state: input.to,
        revision: state.row.revision + 1,
        sourceStorageProviderKey:
          source?.providerKey ?? state.row.sourceStorageProviderKey,
        sourceLocatorCiphertext:
          source?.locator.ciphertextBase64 ?? state.row.sourceLocatorCiphertext,
        sourceLocatorIv: source?.locator.ivBase64 ?? state.row.sourceLocatorIv,
        sourceLocatorAuthTag:
          source?.locator.authTagBase64 ?? state.row.sourceLocatorAuthTag,
        sourceLocatorKeyVersion:
          source?.locator.keyVersion ?? state.row.sourceLocatorKeyVersion,
        sourceLocatorAlgorithm:
          source?.locator.algorithm ?? state.row.sourceLocatorAlgorithm,
        sourceLocatorEnvelopeVersion:
          source?.locator.envelopeVersion ??
          state.row.sourceLocatorEnvelopeVersion,
        sourceLocatorAadVersion:
          source?.locator.aadVersion ?? state.row.sourceLocatorAadVersion,
        sourceReadbackSha256:
          input.sourceReceipt?.readbackSha256 ?? state.row.sourceReadbackSha256,
        sourceReadbackByteLength:
          input.sourceReceipt?.readbackByteLength ??
          state.row.sourceReadbackByteLength,
        sourceVerifiedAt:
          input.sourceReceipt?.verifiedAt ?? state.row.sourceVerifiedAt,
        reportVersionId:
          version?.reportVersionId ?? state.row.reportVersionId,
        sourceArtifactId:
          version?.sourceArtifact.artifactId ?? state.row.sourceArtifactId,
        updatedAt: new Date().toISOString(),
      });
      workerRows.set(state.row.id, {
        id: state.row.id,
        tenantId: state.row.tenantId,
        consumerId: state.row.consumerId,
        revision: state.row.revision,
        state: state.row.state,
      });
      return { ok: true, kind: "TRANSITIONED", ingestion: state.row };
    },
    async recoverExpired() {
      return { ok: false, kind: "DENIED", code: "NOT_USED" };
    },
    async reconcile() {
      return { ok: false, kind: "DENIED", code: "NOT_USED" };
    },
  };
  return { service, state };
}

function localSourcePersister(
  observe?: (value: { readonly sha256: string; readonly content: Uint8Array }) => void,
): P0TrustedWriterSourcePersister {
  return {
    async persistExact(input) {
      observe?.({ sha256: input.source.sha256, content: input.source.content });
      const principalScope = p0ScopeFromPrincipal(input.principal);
      const identity = deriveP0SourceArtifactOperationIdentity({
        ...principalScope,
        ingestionId: input.ingestion.id,
        operationId: input.ingestion.operationKey,
        kind: input.source.kind,
      });
      const scope = {
        ...principalScope,
        ingestionId: input.ingestion.id,
        artifactId: identity.artifactId,
        artifactVersion: 1,
      };
      const resource = await verifyP0SensitiveResourceRef({
        principal: input.principal,
        scope: principalScope,
        candidate: {
          resourceType: "REPORT_INGESTION",
          resourceId: input.ingestion.id,
          resourceVersion: input.ingestion.revision,
        },
        verifier: {
          verifierId: "upload-hook-resource",
          verifyResourceRef: async () => true,
        },
      });
      if (!resource) return { kind: "DENIED", safeCode: "ACCESS_RESOURCE_DENIED" };
      const ref = `p0op_${sha256(input.operationId).slice(0, 40)}`;
      const auditRefs = await verifyAndDeriveP0SensitiveAuditRefs({
        principal: input.principal,
        scope: principalScope,
        candidate: { operationRef: ref, eventRef: ref },
        resource,
        accessKind: "WORKER",
        purposeCode: "REPORT_INGESTION",
        verifier: {
          verifierId: "upload-hook-audit-ref",
          verifyAuditRefs: async () => true,
        },
      });
      if (!auditRefs) return { kind: "DENIED", safeCode: "ACCESS_REFS_DENIED" };
      let event: P0SensitiveAccessEventDraft | null = null;
      const access = await authorizeAndAuditP0SensitiveAccess({
        principal: input.principal,
        scope: principalScope,
        accessKind: "WORKER",
        purposeCode: "REPORT_INGESTION",
        resource,
        auditRefs,
        authorizer: {
          authorizeSensitiveAccess: async () => ({
            allowed: true,
            reasonCode: "AUTHORIZED",
          }),
        },
        repository: {
          async appendSensitiveAccessEvent(value) {
            event = value.event;
            return { disposition: "CREATED" };
          },
          async readSensitiveAccessEvent() {
            return event;
          },
        },
      });
      if (!access.allowed) return { kind: "DENIED", safeCode: access.code };
      const now = Date.now();
      const capability = await verifyP0SourceArtifactCapability(
        {
          scope,
          purpose: "STORE_SOURCE",
          actorId: input.principal.actorId,
          authorizationDecisionId: input.operationId,
          authorizationVersion: input.principal.authorizationVersion,
          issuedAt: new Date(now - 1_000).toISOString(),
          expiresAt: new Date(now + 60_000).toISOString(),
        },
        { verifyDecision: async () => true },
        {
          principal: input.principal,
          permit: input.gatePermit,
          operationId: input.operationId,
        },
      );
      if (!capability) return { kind: "DENIED", safeCode: "SOURCE_CAPABILITY_DENIED" };
      const retention = createLocalSyntheticP0SourceRetentionState({
        ...principalScope,
        ingestionId: input.ingestion.id,
        sourceOperationId: input.ingestion.operationKey,
        revision: input.ingestion.revision,
        state: input.ingestion.state,
        sourceDisposition: input.ingestion.sourceDisposition,
      });
      const stored = await dispatchP0SourceArtifactWrite(
        createLocalSyntheticP0SourceArtifactProvider(),
        {
          contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
          selectedProviderKey: P0_LOCAL_SOURCE_PROVIDER_KEY,
          capability: capability as typeof capability & { purpose: "STORE_SOURCE" },
          principal: input.principal,
          gatePermit: input.gatePermit,
          operationId: input.operationId,
          sourceOperationId: input.ingestion.operationKey,
          writeFence: retention.writeFence,
          ingestionRevision: input.ingestion.revision,
          sensitiveAccessGrant: access.grant,
          sensitiveResource: resource,
          sensitiveAccessKind: "WORKER",
          sensitiveAccessPurposeCode: "REPORT_INGESTION",
          scope,
          kind: input.source.kind,
          mimeType: input.source.mimeType,
          content: input.source.content,
          sha256: input.source.sha256,
          byteLength: input.source.byteLength,
          idempotencyKey: identity.providerOperationId,
        },
      );
      return stored.ok
        ? { kind: "VERIFIED", receipt: stored.value }
        : { kind: "OUTCOME_UNKNOWN", safeCode: stored.code };
    },
  };
}

async function makeDependencies(input: {
  readonly reportOwner?: string;
  readonly sourcePersister?: P0TrustedWriterSourcePersister;
  readonly reportCommitFails?: boolean;
} = {}): Promise<{
  readonly dependencies: P0TrustedWriterUploadRuntimeDependencies;
  readonly ingestion: ReturnType<typeof createFakeIngestionService>;
}> {
  const ingestion = createFakeIngestionService();
  const evidence = await readiness();
  const reportVersionRepository: P0PrismaReportVersionRepository = {
    async commitExact(value) {
      if (input.reportCommitFails) {
        return { kind: "OUTCOME_UNKNOWN", code: "REPORT_VERSION_TRANSACTION_UNKNOWN" };
      }
      const snapshot = {
        tenantId: value.ingestion.tenantId,
        consumerId: value.ingestion.consumerId,
        reportVersionId: "report-version-upload-hook",
        reportSeriesKey: value.ingestion.reportSeriesKey,
        version: 1,
        inputSha256: value.ingestion.sourceSha256,
        authorityStatus: "SHADOW_V2" as const,
        sourceArtifact: {
          tenantId: value.ingestion.tenantId,
          consumerId: value.ingestion.consumerId,
          artifactId: value.sourceReceipt.object.scope.artifactId,
          artifactVersion: 1,
          artifactKind: "REPORT_SOURCE" as const,
          reportVersionId: "report-version-upload-hook",
          sha256: value.sourceReceipt.object.sha256,
          mimeType: value.sourceReceipt.object.mimeType,
          byteLength: value.sourceReceipt.object.byteLength,
          storageProviderKey: value.sourceReceipt.object.providerKey,
          storageLocatorCiphertext: value.sourceReceipt.object.locator.ciphertextBase64,
          storageLocatorIv: value.sourceReceipt.object.locator.ivBase64,
          storageLocatorAuthTag: value.sourceReceipt.object.locator.authTagBase64,
          storageLocatorKeyVersion: value.sourceReceipt.object.locator.keyVersion,
          storageLocatorAlgorithm: "AES_256_GCM" as const,
          storageLocatorEnvelopeVersion: value.sourceReceipt.object.locator.envelopeVersion,
          storageLocatorAadVersion: value.sourceReceipt.object.locator.aadVersion,
          createdByActorId: value.principal.actorId,
        },
      };
      return {
        kind: "CREATED",
        value: snapshot,
        attestation: { snapshot } as never,
      };
    },
  };
  return {
    ingestion,
    dependencies: {
      mode: "LOCAL_BUILD",
      principalDependencies,
      ingestionService: ingestion.service,
      sourcePersister: input.sourcePersister ?? localSourcePersister(),
      reportVersionRepository,
      readLegacyReportOwner: async (reportId) => ({
        reportId,
        consumerId: input.reportOwner ?? "consumer-upload",
      }),
      resolveReadinessEvidence: () => evidence,
      async resolveCohort({ principal, scope }) {
        const now = Date.now();
        return verifyP0Phase2ACohortDecision(
          {
            contractVersion: P0_PHASE2A_FLAG_CONTRACT_VERSION,
            decisionId: `cohort_${sha256(`${principal.actorId}:${Date.now()}`)}`,
            stage: "INGESTION_SHADOW",
            actorId: principal.actorId,
            tenantId: scope.tenantId,
            consumerId: scope.consumerId,
            authorizationKind: principal.authorizationKind,
            authorizationVersion: principal.authorizationVersion,
            cohortVersion: "upload-hook-local-v1",
            included: true,
            decidedAt: new Date(now - 1).toISOString(),
            expiresAt: new Date(now + 60_000).toISOString(),
          },
          {
            resolverId: "upload-hook-local-cohort",
            verifyServerResolvedCohort: async () => true,
          },
        );
      },
      issueWorkerOperationToken: (request) =>
        issueP0WorkerOperationToken(request, {
          client: principalClient,
          configuration: workerConfiguration,
        }),
    },
  };
}

const validText = new TextEncoder().encode(
  "Synthetic report source with enough exact text for safe local hook testing.",
);
const validPdf = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);

const RECEIPT_ENV = [
  "P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL",
  "P0_TRUSTED_WRITER_ATTESTATION_PUBLIC_KEY_DER_BASE64URL",
  "P0_TRUSTED_WRITER_ATTESTATION_KEY_ID",
  "P0_TRUSTED_WRITER_CODE_REVISION",
  "P0_TRUSTED_WRITER_IMPLEMENTATION_SHA256",
  "P0_TRUSTED_WRITER_SCHEMA_SHA256",
  "P0_TRUSTED_WRITER_MIGRATION_SHA256",
  "P0_TRUSTED_WRITER_ADAPTER_MANIFEST_SHA256",
  "P0_TRUSTED_WRITER_STORAGE_CONTRACT_SHA256",
  "P0_TRUSTED_WRITER_VALUE_PROTECTION_CONTRACT_SHA256",
  "P0_TRUSTED_WRITER_DB_ROLE_CONTRACT_SHA256",
  "P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256",
] as const;

const H1_ENV = [
  "NODE_ENV",
  "DATABASE_URL",
  "P0_PHASE2_ENABLED",
  "P0_PHASE2_KILL_SWITCH",
  "P0_INGESTION_SHADOW_ENABLED",
  P0_TRUSTED_WRITER_RUNTIME_MODE_ENV,
  "P0_WORKER_TOKEN_HMAC_KEY_BASE64URL",
  "P0_WORKER_PRINCIPAL_ID",
  "P0_TRUSTED_WRITER_ENCRYPTION_KEY",
  "P0_TRUSTED_WRITER_KEY_VERSION",
  P0_TRUSTED_WRITER_DATABASE_URL_ENV,
  P0_TRUSTED_WRITER_DATABASE_ROLE_ENV,
  "P0_TRUSTED_WRITER_DATABASE_ROLE_IDENTITY_SHA256",
  ...RECEIPT_ENV,
] as const;

async function withRestoredH1Environment<T>(execute: () => Promise<T>): Promise<T> {
  const before = new Map(H1_ENV.map((key) => [key, process.env[key]] as const));
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  try {
    return await execute();
  } finally {
    for (const [key, value] of before) {
      if (value === undefined) delete process.env[key];
      else mutableEnvironment[key] = value;
    }
  }
}

function installSignedProductionReadiness(): void {
  const now = Date.now();
  const hash = (character: string) => character.repeat(64);
  const candidate: P0TrustedWriterReadinessCandidate = {
    contractVersion: P0_TRUSTED_WRITER_READINESS_CONTRACT_VERSION,
    receiptKind: "AUTHENTICATED_PRODUCTION",
    receiptId: "upload-route-installation-attestation",
    configurationMode: "DORMANT_DEFAULT_OFF",
    codeRevision: "upload-route-installation-v1",
    implementationSourceSha256: hash("a"),
    schemaSha256: hash("b"),
    migrationSha256: hash("c"),
    adapterManifestSha256: hash("d"),
    storageContractSha256: hash("e"),
    valueProtectionContractSha256: hash("f"),
    dbRoleContractSha256: hash("1"),
    databaseRoleIdentitySha256: p0TrustedWriterDatabaseRoleIdentitySha256(
      PRODUCTION_TEST_DATABASE_ROLE,
    ),
    privilegedValidatorManifestSha256: hash("2"),
    dbRoleContractStatus: "LOCAL_CONTRACT_PROVEN",
    trustedWriterVerifierId: "p0-upload-route-installation-test",
    trustedWriterVerifierVersion: "v1",
    requiredAdapters: P0_TRUSTED_WRITER_REQUIRED_ADAPTERS,
    safetyFlags: P0_TRUSTED_WRITER_REQUIRED_SAFETY_FLAGS,
    capabilities: P0_TRUSTED_WRITER_CAPABILITIES,
    attestationResult: "PASS",
    issuedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
  };
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const envelope: P0TrustedWriterReadinessEnvelope = {
    keyId: "upload-route-installation-key-v1",
    candidate,
    signatureBase64Url: sign(
      null,
      p0TrustedWriterAttestationSigningPayload(candidate),
      privateKey,
    ).toString("base64url"),
  };
  process.env.P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL = Buffer.from(
    JSON.stringify(envelope),
    "utf8",
  ).toString("base64url");
  process.env.P0_TRUSTED_WRITER_ATTESTATION_PUBLIC_KEY_DER_BASE64URL = (
    publicKey.export({ format: "der", type: "spki" }) as Buffer
  ).toString("base64url");
  process.env.P0_TRUSTED_WRITER_ATTESTATION_KEY_ID = envelope.keyId;
  process.env.P0_TRUSTED_WRITER_CODE_REVISION = candidate.codeRevision;
  process.env.P0_TRUSTED_WRITER_IMPLEMENTATION_SHA256 =
    candidate.implementationSourceSha256;
  process.env.P0_TRUSTED_WRITER_SCHEMA_SHA256 = candidate.schemaSha256;
  process.env.P0_TRUSTED_WRITER_MIGRATION_SHA256 = candidate.migrationSha256;
  process.env.P0_TRUSTED_WRITER_ADAPTER_MANIFEST_SHA256 =
    candidate.adapterManifestSha256;
  process.env.P0_TRUSTED_WRITER_STORAGE_CONTRACT_SHA256 =
    candidate.storageContractSha256;
  process.env.P0_TRUSTED_WRITER_VALUE_PROTECTION_CONTRACT_SHA256 =
    candidate.valueProtectionContractSha256;
  process.env.P0_TRUSTED_WRITER_DB_ROLE_CONTRACT_SHA256 =
    candidate.dbRoleContractSha256;
  process.env.P0_TRUSTED_WRITER_DATABASE_ROLE_IDENTITY_SHA256 =
    candidate.databaseRoleIdentitySha256;
  process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256 =
    candidate.privilegedValidatorManifestSha256;
}

function createNoIoConcretePrismaHook() {
  const unexpected = async () => {
    throw new Error("concrete hook construction must not perform database I/O");
  };
  const client = bindP0TrustedWriterPrismaClientToDatabaseRole({
    client: {
    $transaction: unexpected,
    report: { findUnique: unexpected },
    p0SourceObject: { findFirst: unexpected, create: unexpected },
    } as unknown as PrismaClient,
    expectedRole: "p0_writer_component_test",
  });
  return createP0TrustedWriterPrismaUploadHook({
    client,
    mode: "LOCAL_BUILD",
    principalDependencies,
    workerConfiguration,
    valueProtection: createDeterministicDisposableP0ValueProtectionAdapter({
      seed: "upload-hook-async-local-installation",
    }),
    resolveReadinessEvidence: readiness,
  });
}

const main = async () => {
  users.clear();
  workerRows.clear();
  users.set("consumer-upload", user("consumer-upload"));

  await test("production route factory is null for absent or partial server configuration", async () => {
    await withRestoredH1Environment(async () => {
      for (const key of RECEIPT_ENV) delete process.env[key];
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.P0_PHASE2_ENABLED = "false";
      process.env.P0_INGESTION_SHADOW_ENABLED = "true";
      process.env.P0_PHASE2_KILL_SWITCH = "false";
      process.env[P0_TRUSTED_WRITER_RUNTIME_MODE_ENV] =
        P0_TRUSTED_WRITER_PRODUCTION_DORMANT_MODE;
      assert.equal(createP0ProductionTrustedWriterUploadHook(), null);
      process.env.P0_PHASE2_ENABLED = "true";
      assert.equal(createP0ProductionTrustedWriterUploadHook(), null);
    });
  });

  await test("disposable installer rejects fake, spread, and production hooks", async () => {
    await withRestoredH1Environment(async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      process.env.P0_PHASE2_ENABLED = "true";
      process.env.P0_INGESTION_SHADOW_ENABLED = "true";
      process.env.P0_PHASE2_KILL_SWITCH = "false";
      process.env[P0_TRUSTED_WRITER_RUNTIME_MODE_ENV] =
        P0_TRUSTED_WRITER_DISPOSABLE_MODE;
      const concrete = createNoIoConcretePrismaHook();
      const fake = Object.freeze({ dispatch: concrete.dispatch });
      const spread = Object.freeze({ ...concrete });
      await assert.rejects(
        withP0DisposableTrustedWriterUploadHook({
          hook: fake,
          execute: async () => null,
        }),
        /installation denied/,
      );
      await assert.rejects(
        withP0DisposableTrustedWriterUploadHook({
          hook: spread,
          execute: async () => null,
        }),
        /installation denied/,
      );
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      await assert.rejects(
        withP0DisposableTrustedWriterUploadHook({
          hook: concrete,
          execute: async () => null,
        }),
        /installation denied/,
      );
    });
  });

  await test("disposable real-hook route seam is async-local and invalidates detached descendants", async () => {
    await withRestoredH1Environment(async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      process.env.P0_PHASE2_ENABLED = "true";
      process.env.P0_INGESTION_SHADOW_ENABLED = "true";
      process.env.P0_PHASE2_KILL_SWITCH = "false";
      process.env[P0_TRUSTED_WRITER_RUNTIME_MODE_ENV] =
        P0_TRUSTED_WRITER_DISPOSABLE_MODE;
      const concrete = createNoIoConcretePrismaHook();
      let releaseInstallation!: () => void;
      const installationGate = new Promise<void>((resolve) => {
        releaseInstallation = resolve;
      });
      let releaseDetached!: () => void;
      const detachedGate = new Promise<void>((resolve) => {
        releaseDetached = resolve;
      });
      let detachedLookup!: Promise<ReturnType<typeof createP0ProductionTrustedWriterUploadHook>>;
      const installed = withP0DisposableTrustedWriterUploadHook({
        hook: concrete,
        async execute() {
          assert.equal(createP0ProductionTrustedWriterUploadHook(), concrete);
          detachedLookup = (async () => {
            await detachedGate;
            return createP0ProductionTrustedWriterUploadHook();
          })();
          await installationGate;
        },
      });
      await Promise.resolve();
      // This caller is concurrent but not descended from the installation.
      assert.equal(createP0ProductionTrustedWriterUploadHook(), null);
      releaseInstallation();
      await installed;
      releaseDetached();
      assert.equal(await detachedLookup, null);
      assert.equal(createP0ProductionTrustedWriterUploadHook(), null);
    });
  });

  await test("fully configured production-dormant composition constructs without dispatch or I/O", async () => {
    await withRestoredH1Environment(async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.P0_PHASE2_ENABLED = "true";
      process.env.P0_INGESTION_SHADOW_ENABLED = "true";
      process.env.P0_PHASE2_KILL_SWITCH = "false";
      process.env[P0_TRUSTED_WRITER_RUNTIME_MODE_ENV] =
        P0_TRUSTED_WRITER_PRODUCTION_DORMANT_MODE;
      process.env.P0_WORKER_PRINCIPAL_ID = "p0-production-worker";
      process.env.P0_WORKER_TOKEN_HMAC_KEY_BASE64URL = Buffer.alloc(
        32,
        0x51,
      ).toString("base64url");
      process.env.P0_TRUSTED_WRITER_ENCRYPTION_KEY = "a5".repeat(32);
      process.env.P0_TRUSTED_WRITER_KEY_VERSION = "production-test-v1";
      process.env[P0_TRUSTED_WRITER_DATABASE_ROLE_ENV] =
        PRODUCTION_TEST_DATABASE_ROLE;
      process.env[P0_TRUSTED_WRITER_DATABASE_URL_ENV] =
        `postgresql://${PRODUCTION_TEST_DATABASE_ROLE}:local-only-not-used@127.0.0.1:1/p0_no_connect?schema=public`;
      installSignedProductionReadiness();
      const hook = createP0ProductionTrustedWriterUploadHook();
      assert(hook);
      assert.equal(typeof hook.dispatch, "function");
      // Deliberately no dispatch: installation authority is not activation.
    });
  });

  await test("dedicated database config rejects absence, malformed URLs, shared-global credentials, and role mismatch", async () => {
    await withRestoredH1Environment(async () => {
      delete process.env[P0_TRUSTED_WRITER_DATABASE_URL_ENV];
      delete process.env[P0_TRUSTED_WRITER_DATABASE_ROLE_ENV];
      assert.equal(createP0ProductionTrustedWriterPrismaClientProvider(), null);

      process.env[P0_TRUSTED_WRITER_DATABASE_ROLE_ENV] =
        PRODUCTION_TEST_DATABASE_ROLE;
      process.env[P0_TRUSTED_WRITER_DATABASE_URL_ENV] = "not-a-database-url";
      assert.equal(createP0ProductionTrustedWriterPrismaClientProvider(), null);

      process.env[P0_TRUSTED_WRITER_DATABASE_URL_ENV] =
        "postgresql://p0_writer_wrong:secret@127.0.0.1:1/no_connect";
      assert.equal(createP0ProductionTrustedWriterPrismaClientProvider(), null);

      const dedicatedUrl =
        `postgresql://${PRODUCTION_TEST_DATABASE_ROLE}:secret@127.0.0.1:1/no_connect`;
      process.env[P0_TRUSTED_WRITER_DATABASE_URL_ENV] = dedicatedUrl;
      process.env.DATABASE_URL = dedicatedUrl;
      assert.equal(createP0ProductionTrustedWriterPrismaClientProvider(), null);
      delete process.env.DATABASE_URL;

      const provider = createP0ProductionTrustedWriterPrismaClientProvider();
      assert(provider);
      assert.equal(provider.expectedRole, PRODUCTION_TEST_DATABASE_ROLE);
      assert.equal(
        provider.roleIdentitySha256,
        p0TrustedWriterDatabaseRoleIdentitySha256(
          PRODUCTION_TEST_DATABASE_ROLE,
        ),
      );
      assert.deepEqual(Object.keys(provider).sort(), [
        "contractVersion",
        "expectedRole",
        "getClient",
        "roleIdentitySha256",
      ]);
    });
  });

  await test("transaction role assertion requires both effective and login role", async () => {
    const transaction = (currentRole: string, sessionRole: string) => ({
      async $queryRaw<T>() {
        return [{ currentRole, sessionRole }] as T;
      },
    });
    await assert.doesNotReject(
      assertP0TrustedWriterDatabaseRoleInTransaction(
        transaction(PRODUCTION_TEST_DATABASE_ROLE, PRODUCTION_TEST_DATABASE_ROLE),
        PRODUCTION_TEST_DATABASE_ROLE,
      ),
    );
    await assert.rejects(
      assertP0TrustedWriterDatabaseRoleInTransaction(
        transaction(PRODUCTION_TEST_DATABASE_ROLE, "postgres"),
        PRODUCTION_TEST_DATABASE_ROLE,
      ),
      /database role verification failed/,
    );
  });

  await test("concrete Prisma composition is side-effect-free until dispatch", () => {
    let databaseCalls = 0;
    const unexpected = async () => {
      databaseCalls += 1;
      throw new Error("construction must not touch the database");
    };
    const rawClient = {
      $transaction: unexpected,
      report: { findUnique: unexpected },
      p0SourceObject: { findFirst: unexpected, create: unexpected },
    } as unknown as PrismaClient;
    assert.throws(
      () =>
        createP0TrustedWriterPrismaUploadHook({
          client: rawClient,
          mode: "LOCAL_BUILD",
          principalDependencies,
          workerConfiguration,
          valueProtection:
            createDeterministicDisposableP0ValueProtectionAdapter({
              seed: "upload-hook-unbound-client-denial",
            }),
          resolveReadinessEvidence: readiness,
        }),
      /role-bound client required/,
    );
    const client = bindP0TrustedWriterPrismaClientToDatabaseRole({
      client: rawClient,
      expectedRole: "p0_writer_component_test",
    });
    const hook = createP0TrustedWriterPrismaUploadHook({
      client,
      mode: "LOCAL_BUILD",
      principalDependencies,
      workerConfiguration,
      valueProtection: createDeterministicDisposableP0ValueProtectionAdapter({
        seed: "upload-hook-concrete-composition",
      }),
      resolveReadinessEvidence: readiness,
    });
    assert(hook);
    assert.equal(databaseCalls, 0);
  });

  await test("caller-shaped enable fields cannot install a hook", async () => {
    sessionActorId = null;
    const { dependencies } = await makeDependencies();
    const hook = createP0TrustedWriterUploadHook(dependencies);
    const result = await hook.dispatch({
      legacyReportId: "legacy-caller-enable",
      bureauSelectors: ["EQUIFAX"],
      sources: [{ kind: "ORIGINAL_TEXT", mimeType: "text/plain", content: validText }],
      P0_PHASE2_ENABLED: true,
      enableP0: true,
    } as never);
    assert.deepEqual(result, {
      kind: "FAILED",
      safeCode: "AUTHENTICATED_PRINCIPAL_REQUIRED",
    });
  });

  await test("demo fallback is excluded because no real authenticated account exists", async () => {
    sessionActorId = null;
    const { dependencies } = await makeDependencies();
    const result = await createP0TrustedWriterUploadHook(dependencies).dispatch({
      legacyReportId: "legacy-demo",
      bureauSelectors: ["EXPERIAN"],
      sources: [{ kind: "ORIGINAL_TEXT", mimeType: "text/plain", content: validText }],
    });
    assert.equal(result.kind, "FAILED");
    if (result.kind === "FAILED") {
      assert.equal(result.safeCode, "AUTHENTICATED_PRINCIPAL_REQUIRED");
    }
  });

  await test("cross-user legacy report ownership fails closed", async () => {
    sessionActorId = "consumer-upload";
    users.set("other-consumer", user("other-consumer"));
    const { dependencies } = await makeDependencies({ reportOwner: "other-consumer" });
    const result = await createP0TrustedWriterUploadHook(dependencies).dispatch({
      legacyReportId: "legacy-other-owner",
      bureauSelectors: ["TRANSUNION"],
      sources: [{ kind: "ORIGINAL_TEXT", mimeType: "text/plain", content: validText }],
    });
    assert.equal(result.kind, "FAILED");
    if (result.kind === "FAILED") {
      assert.equal(result.safeCode, "AUTHENTICATED_PRINCIPAL_REQUIRED");
    }
  });

  await test("one PDF is authoritative over pasted text and source bytes are cloned", () => {
    const mutable = new Uint8Array(validPdf);
    const source = selectP0TrustedWriterUploadSource([
      { kind: "ORIGINAL_PDF", mimeType: "application/pdf", content: mutable },
      { kind: "ORIGINAL_TEXT", mimeType: "text/plain", content: validText },
    ]);
    assert(source);
    assert.equal(source.kind, "ORIGINAL_PDF");
    assert.equal(source.sha256, sha256(validPdf));
    mutable[0] = 0;
    assert.equal(source.content[0], 0x25);
  });

  await test("ambiguous duplicate originals and malformed MIME fail preflight", () => {
    assert.equal(
      selectP0TrustedWriterUploadSource([
        { kind: "ORIGINAL_TEXT", mimeType: "text/plain", content: validText },
        { kind: "ORIGINAL_TEXT", mimeType: "text/plain", content: validText },
      ]),
      null,
    );
    assert.equal(
      selectP0TrustedWriterUploadSource([
        { kind: "ORIGINAL_PDF", mimeType: "application/pdf", content: validText },
      ]),
      null,
    );
  });

  await test("caller digest and bureau selectors cannot substitute server-derived source authority", async () => {
    sessionActorId = "consumer-upload";
    const observed: {
      value: { readonly sha256: string; readonly content: Uint8Array } | null;
    } = { value: null };
    const { dependencies } = await makeDependencies({
      sourcePersister: localSourcePersister((value) => {
        observed.value = value;
      }),
    });
    const result = await createP0TrustedWriterUploadHook(dependencies).dispatch({
      legacyReportId: "legacy-success",
      bureauSelectors: ["EQUIFAX", "EXPERIAN", "TRANSUNION"],
      sources: [
        {
          kind: "ORIGINAL_TEXT",
          mimeType: "text/plain",
          content: validText,
          sha256: "f".repeat(64),
          bureau: "EQUIFAX",
        },
      ],
    } as never);
    assert.equal(result.kind, "ACCEPTED", JSON.stringify(result));
    assert(observed.value);
    assert.equal(observed.value.sha256, sha256(validText));
    assert.deepEqual(observed.value.content, validText);
  });

  await test("partial source failure is explicit and never reported as accepted", async () => {
    sessionActorId = "consumer-upload";
    const { dependencies, ingestion } = await makeDependencies({
      sourcePersister: {
        persistExact: async () => ({
          kind: "OUTCOME_UNKNOWN",
          safeCode: "SOURCE_WRITE_OUTCOME_UNKNOWN",
        }),
      },
    });
    const result = await createP0TrustedWriterUploadHook(dependencies).dispatch({
      legacyReportId: "legacy-partial-source",
      bureauSelectors: ["EQUIFAX"],
      sources: [{ kind: "ORIGINAL_TEXT", mimeType: "text/plain", content: validText }],
    });
    assert.deepEqual(result, {
      kind: "FAILED",
      safeCode: "SOURCE_WRITE_OUTCOME_UNKNOWN",
    });
    assert.equal(ingestion.state.row?.state, "RECEIVED");
  });

  await test("partial report-version failure leaves recoverable source-verified state", async () => {
    sessionActorId = "consumer-upload";
    const { dependencies, ingestion } = await makeDependencies({ reportCommitFails: true });
    const result = await createP0TrustedWriterUploadHook(dependencies).dispatch({
      legacyReportId: "legacy-partial-version",
      bureauSelectors: ["EXPERIAN"],
      sources: [{ kind: "ORIGINAL_TEXT", mimeType: "text/plain", content: validText }],
    });
    assert.deepEqual(result, {
      kind: "FAILED",
      safeCode: "REPORT_VERSION_TRANSACTION_UNKNOWN",
    });
    assert.equal(ingestion.state.row?.state, "SOURCE_STORED_AND_VERIFIED");
  });

  await test("successful hook stops at VERSION_COMMITTED and does not parse or enter Phase 2B", async () => {
    sessionActorId = "consumer-upload";
    const { dependencies, ingestion } = await makeDependencies();
    const result = await createP0TrustedWriterUploadHook(dependencies).dispatch({
      legacyReportId: "legacy-final-success",
      bureauSelectors: ["TRANSUNION"],
      sources: [{ kind: "ORIGINAL_TEXT", mimeType: "text/plain", content: validText }],
    });
    assert.equal(result.kind, "ACCEPTED", JSON.stringify(result));
    assert.equal(ingestion.state.row?.state, "VERSION_COMMITTED");
    assert.equal(ingestion.state.row?.extractionRunId, null);
  });

  await test("legacy route ignores shadow result and preserves its existing response authority", () => {
    const route = readFileSync("app/api/reports/upload/route.ts", "utf8");
    assert(route.includes("await dispatchP0ReportUploadShadow(() => ({"));
    assert.equal(/const\s+\w+\s*=\s*await dispatchP0ReportUploadShadow/.test(route), false);
    assert(route.includes("analyzeReportText("));
    assert(route.includes("reportId: report.id"));
    assert.equal(route.includes("req.headers.get(\"x-p0"), false);
    assert.equal(route.includes("body.P0_"), false);
  });

  process.stdout.write(`${passed}/${passed} PASS p0-trusted-writer-upload-hook\n`);
};

void main();
