import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import {
  P0_PRISMA_SOURCE_PROVIDER_KEY,
  P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
  computeP0SourceArtifactSha256,
  deriveP0SourceArtifactOperationIdentity,
  dispatchP0SourceArtifactRead,
  dispatchP0SourceArtifactWrite,
  verifyP0SourceArtifactCapability,
  type P0SourceArtifactReadRequest,
  type P0SourceArtifactWriteRequest,
  type P0StoredSourceArtifact,
  type VerifiedP0SourceWriteFencePermit,
} from "../lib/creditTruth/sourceArtifact";
import {
  createP0PrismaSourceArtifactAdapter,
  type P0PrismaSourceObjectRow,
  type P0PrismaSourceTransaction,
} from "../lib/creditTruth/prismaSourceArtifactProvider";
import {
  createDeterministicDisposableP0ValueProtectionAdapter,
  createServerEnvironmentP0ValueProtectionAdapter,
} from "../lib/creditTruth/trustedWriterValueProtection";
import {
  p0ScopeFromPrincipal,
  verifyP0PrincipalCandidate,
  type P0Principal,
} from "../lib/creditTruth/principal";
import {
  attestLocalSyntheticP0Phase2AFlags,
  evaluateAndMintP0Phase2AGatePermit,
  verifyP0Phase2ACohortDecision,
  type P0Phase2AGatePermit,
} from "../lib/creditTruth/phase2Flags";
import {
  P0_PHASE2A_READINESS_CONTRACT_VERSION,
  P0_REPOSITORY_CAPABILITIES,
  verifyP0RepositoryReadinessReceipt,
} from "../lib/creditTruth/phase2Readiness";
import {
  authorizeAndAuditP0SensitiveAccess,
  verifyAndDeriveP0SensitiveAuditRefs,
  verifyP0SensitiveResourceRef,
  type P0SensitiveAccessEventDraft,
  type VerifiedP0SensitiveAccessGrant,
  type VerifiedP0SensitiveResourceRef,
} from "../lib/creditTruth/sensitiveAccessAudit";

process.env.P0_PHASE2_ENABLED = "true";
process.env.P0_INGESTION_SHADOW_ENABLED = "true";
process.env.P0_PHASE2_KILL_SWITCH = "false";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

interface FakeIngestion {
  id: string;
  tenantId: string;
  consumerId: string;
  operationKey: string;
  revision: number;
  state: string;
  sourceDisposition: string;
}

class FakePrismaSourceDatabase {
  readonly rows = new Map<string, P0PrismaSourceObjectRow>();
  readonly auditRows = new Map<string, Readonly<Record<string, unknown>>>();
  ingestion: FakeIngestion;
  sourceFinds = 0;
  private serial = Promise.resolve();

  constructor(ingestion: FakeIngestion) {
    this.ingestion = { ...ingestion };
  }

  private readonly delegate = {
    findFirst: async (input: { readonly where: Readonly<Record<string, unknown>> }) => {
      this.sourceFinds += 1;
      return (
        [...this.rows.values()].find((row) =>
          Object.entries(input.where).every(
            ([key, value]) => row[key as keyof P0PrismaSourceObjectRow] === value,
          ),
        ) ?? null
      );
    },
    create: async (input: { readonly data: Readonly<Record<string, unknown>> }) => {
      const row = input.data as unknown as P0PrismaSourceObjectRow;
      if (
        [...this.rows.values()].some(
          (existing) =>
            existing.id === row.id ||
            (existing.tenantId === row.tenantId &&
              existing.consumerId === row.consumerId &&
              (existing.providerOperationId === row.providerOperationId ||
                (existing.artifactId === row.artifactId &&
                  existing.artifactVersion === row.artifactVersion))),
        )
      ) {
        throw Object.assign(new Error("unique conflict"), { code: "P2002" });
      }
      this.rows.set(row.id, row);
      return row;
    },
  };

  readonly client = {
    p0SourceObject: this.delegate,
    $transaction: async <T>(
      execute: (transaction: P0PrismaSourceTransaction) => Promise<T>,
      options?: { readonly isolationLevel: "Serializable" },
    ): Promise<T> => {
      assert.equal(options?.isolationLevel, "Serializable");
      let release!: () => void;
      const prior = this.serial;
      this.serial = new Promise<void>((resolve) => {
        release = resolve;
      });
      await prior;
      const before = new Map(this.rows);
      const transaction = {
        p0SourceObject: this.delegate,
        $queryRawUnsafe: async <R>(
          sql: string,
          ...values: readonly unknown[]
        ): Promise<R> => {
          if (sql.includes('FROM "P0SensitiveAccessEvent"')) {
            const [tenantId, consumerId, eventKey] = values;
            const audit = this.auditRows.get(String(eventKey));
            return (audit &&
            audit.tenantId === tenantId &&
            audit.consumerId === consumerId
              ? [{ ...audit }]
              : []) as R;
          }
          const [tenantId, consumerId, ingestionId] = values;
          const row = this.ingestion;
          return (row.tenantId === tenantId &&
          row.consumerId === consumerId &&
          row.id === ingestionId
            ? [{ ...row }]
            : []) as R;
        },
      } as P0PrismaSourceTransaction;
      try {
        return await execute(transaction);
      } catch (error) {
        this.rows.clear();
        for (const [key, value] of before) this.rows.set(key, value);
        throw error;
      } finally {
        release();
      }
    },
  };

  tamperContent(): void {
    const [entry] = this.rows.entries();
    assert(entry);
    const [id, row] = entry;
    const ciphertext = new Uint8Array(row.ciphertext);
    ciphertext[0] = ciphertext[0]! ^ 0xff;
    this.rows.set(id, { ...row, ciphertext });
  }

  recordAudit(grant: VerifiedP0SensitiveAccessGrant): void {
    this.auditRows.set(grant.auditEventKey, Object.freeze({
      eventKey: grant.auditEventKey,
      correlationId: grant.correlationId,
      actorId: grant.actorId,
      tenantId: grant.tenantId,
      consumerId: grant.consumerId,
      authorizationKind: grant.authorizationKind,
      authorizationVersion: grant.authorizationVersion,
      accessKind: grant.accessKind,
      purposeCode: grant.purposeCode,
      decision: "ALLOW",
      decisionCode: "AUTHORIZED",
      resourceType: grant.resource.resourceType,
      resourceId: grant.resource.resourceId,
      resourceVersion: grant.resource.resourceVersion,
      occurredAt: new Date(grant.issuedAt),
    }));
  }
}

async function principal(): Promise<P0Principal> {
  const result = await verifyP0PrincipalCandidate(
    {
      actorId: "trusted-source-worker",
      tenantId: "tenant-source",
      consumerId: "consumer-source",
      authorizationKind: "SYSTEM_WORKER",
      authorizationVersion: "worker-grant-v1",
    },
    { verifyCandidate: async () => true },
  );
  assert(result);
  return result;
}

async function gate(
  authenticated: P0Principal,
  operationId: string,
): Promise<P0Phase2AGatePermit> {
  const now = Date.now();
  const issuedAt = new Date(now - 1_000).toISOString();
  const expiresAt = new Date(now + 120_000).toISOString();
  const migrationSha256 = "a".repeat(64);
  const receipt = await verifyP0RepositoryReadinessReceipt(
    {
      contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION,
      receiptId: `source-receipt-${operationId}`,
      receiptKind: "LOCAL_SYNTHETIC",
      repositoryAdapterId: "trusted-source-test",
      repositoryAdapterVersion: "v1",
      codeRevision: "test",
      migrationSha256,
      semanticsVersion: "v1",
      capabilities: P0_REPOSITORY_CAPABILITIES,
      issuedAt,
      expiresAt,
    },
    { verifierId: "source-test", verifyRepositoryReceipt: async () => true },
  );
  assert(receipt);
  const scope = p0ScopeFromPrincipal(authenticated);
  const cohort = await verifyP0Phase2ACohortDecision(
    {
      contractVersion: "p0-phase2a-flags-v1",
      decisionId: `source-cohort-${operationId}`,
      stage: "INGESTION_SHADOW",
      actorId: authenticated.actorId,
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      authorizationKind: authenticated.authorizationKind,
      authorizationVersion: authenticated.authorizationVersion,
      cohortVersion: "source-test-v1",
      included: true,
      decidedAt: issuedAt,
      expiresAt,
    },
    { resolverId: "source-test", verifyServerResolvedCohort: async () => true },
  );
  assert(cohort);
  const flags = await attestLocalSyntheticP0Phase2AFlags(
    {
      phase2Enabled: true,
      killSwitchEngaged: false,
      ingestionShadowEnabled: true,
      round0ReviewEnabled: false,
      assertionRuntimeEnabled: false,
    },
    { attestorId: "source-test", verifyLocalSyntheticFlags: async () => true },
  );
  assert(flags);
  const permit = evaluateAndMintP0Phase2AGatePermit({
    stage: "INGESTION_SHADOW",
    mode: "LOCAL_BUILD",
    operationId,
    flags,
    principal: authenticated,
    scope,
    cohortDecision: cohort,
    readinessEvidence: {
      migrationVerified: true,
      migrationSha256,
      principalBoundaryVerified: true,
      repositoryBoundaryVerified: true,
      sourceArtifactBoundaryVerified: true,
      ingestionBoundaryVerified: true,
      round0BoundaryVerified: false,
      assertionBoundaryVerified: false,
      repositoryReceipt: receipt,
    },
  });
  assert(permit);
  return permit;
}

async function accessGrant(
  authenticated: P0Principal,
  input: {
    readonly resourceType: "REPORT_INGESTION" | "REPORT_SOURCE";
    readonly resourceId: string;
    readonly resourceVersion: number;
    readonly purposeCode: "REPORT_INGESTION" | "INTEGRITY_VERIFICATION";
    readonly eventKey: string;
  },
): Promise<{
  readonly grant: VerifiedP0SensitiveAccessGrant;
  readonly resource: VerifiedP0SensitiveResourceRef;
}> {
  const scope = p0ScopeFromPrincipal(authenticated);
  const resource = await verifyP0SensitiveResourceRef({
    principal: authenticated,
    scope,
    candidate: {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceVersion: input.resourceVersion,
    },
    verifier: { verifierId: "source-test", verifyResourceRef: async () => true },
  });
  assert(resource);
  const refs = await verifyAndDeriveP0SensitiveAuditRefs({
    principal: authenticated,
    scope,
    candidate: { operationRef: input.eventKey, eventRef: input.eventKey },
    resource,
    accessKind: "WORKER",
    purposeCode: input.purposeCode,
    verifier: { verifierId: "source-test", verifyAuditRefs: async () => true },
  });
  assert(refs);
  let event: P0SensitiveAccessEventDraft | null = null;
  const result = await authorizeAndAuditP0SensitiveAccess({
    principal: authenticated,
    scope,
    accessKind: "WORKER",
    purposeCode: input.purposeCode,
    resource,
    auditRefs: refs,
    authorizer: {
      authorizeSensitiveAccess: async () => ({
        allowed: true as const,
        reasonCode: "AUTHORIZED" as const,
      }),
    },
    repository: {
      appendSensitiveAccessEvent: async ({ event: draft }) => {
        event = draft;
        return { disposition: "CREATED" as const };
      },
      readSensitiveAccessEvent: async () => event,
    },
  });
  assert(result.allowed);
  return { grant: result.grant, resource };
}

async function fixture(input: { readonly grantLive?: () => boolean } = {}) {
  const authenticated = await principal();
  const operationId = "store-source-operation";
  const sourceOperationId = "reserve-source-operation";
  const ingestionId = "ingestion-source-1";
  const scopeBase = p0ScopeFromPrincipal(authenticated);
  const database = new FakePrismaSourceDatabase({
    id: ingestionId,
    ...scopeBase,
    operationKey: sourceOperationId,
    revision: 1,
    state: "RECEIVED",
    sourceDisposition: "RETAINED",
  });
  const protector = createDeterministicDisposableP0ValueProtectionAdapter({
    seed: "trusted-writer-source-storage-test-seed",
  });
  let revalidations = 0;
  const revalidationPurposes: string[] = [];
  const adapter = createP0PrismaSourceArtifactAdapter({
    prisma: database.client as unknown as PrismaClient,
    protector,
    revalidatePrincipal: async (
      _transaction,
      candidate,
      candidateOperation,
      repositoryPurpose,
    ) => {
      revalidations += 1;
      revalidationPurposes.push(repositoryPurpose);
      return (
        candidate === authenticated &&
        ((candidateOperation === operationId &&
          repositoryPurpose === "SOURCE_ARTIFACT_WRITE") ||
          (candidateOperation.startsWith("read-source-operation") &&
            repositoryPurpose === "SOURCE_ARTIFACT_READ")) &&
        (input.grantLive?.() ?? true)
      );
    },
  });
  const identity = deriveP0SourceArtifactOperationIdentity({
    ...scopeBase,
    ingestionId,
    operationId: sourceOperationId,
    kind: "ORIGINAL_TEXT",
  });
  const scope = {
    ...scopeBase,
    ingestionId,
    artifactId: identity.artifactId,
    artifactVersion: 1,
  };
  const permit = await gate(authenticated, operationId);
  const capability = await verifyP0SourceArtifactCapability(
    {
      scope,
      purpose: "STORE_SOURCE",
      actorId: authenticated.actorId,
      authorizationDecisionId: operationId,
      authorizationVersion: authenticated.authorizationVersion,
      issuedAt: new Date(Date.now() - 1_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    { verifyDecision: async () => true },
    { principal: authenticated, permit, operationId },
  );
  assert(capability);
  const access = await accessGrant(authenticated, {
    resourceType: "REPORT_INGESTION",
    resourceId: ingestionId,
    resourceVersion: 1,
    purposeCode: "REPORT_INGESTION",
    eventKey: "audit-source-store",
  });
  const content = new TextEncoder().encode(
    "synthetic bureau-scoped report source for immutable storage",
  );
  const request: P0SourceArtifactWriteRequest = {
    contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
    selectedProviderKey: P0_PRISMA_SOURCE_PROVIDER_KEY,
    capability: capability as typeof capability & { readonly purpose: "STORE_SOURCE" },
    principal: authenticated,
    gatePermit: permit,
    operationId,
    sourceOperationId,
    writeFence: adapter.writeFence,
    ingestionRevision: 1,
    sensitiveAccessGrant: access.grant,
    sensitiveResource: access.resource,
    sensitiveAccessKind: "WORKER",
    sensitiveAccessPurposeCode: "REPORT_INGESTION",
    scope,
    kind: "ORIGINAL_TEXT",
    mimeType: "text/plain",
    content,
    sha256: computeP0SourceArtifactSha256(content),
    byteLength: content.byteLength,
    idempotencyKey: identity.providerOperationId,
  };
  return {
    authenticated,
    operationId,
    sourceOperationId,
    database,
    adapter,
    request,
    get revalidations() {
      return revalidations;
    },
    revalidationPurposes,
  };
}

async function protectedReadRequest(
  value: Awaited<ReturnType<typeof fixture>>,
  object: P0StoredSourceArtifact,
  operationId: string,
): Promise<{
  readonly request: P0SourceArtifactReadRequest;
  readonly access: Awaited<ReturnType<typeof accessGrant>>;
}> {
  const capability = await verifyP0SourceArtifactCapability(
    {
      scope: object.scope,
      purpose: "READ_SOURCE",
      actorId: value.authenticated.actorId,
      authorizationDecisionId: operationId,
      authorizationVersion: value.authenticated.authorizationVersion,
      issuedAt: new Date(Date.now() - 1_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    { verifyDecision: async () => true },
  );
  assert(capability);
  const access = await accessGrant(value.authenticated, {
    resourceType: "REPORT_SOURCE",
    resourceId: object.scope.artifactId,
    resourceVersion: object.scope.artifactVersion,
    purposeCode: "INTEGRITY_VERIFICATION",
    eventKey: `audit-${operationId}`,
  });
  return {
    request: {
      contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
      capability: capability as typeof capability & {
        readonly purpose: "READ_SOURCE";
      },
      principal: value.authenticated,
      sensitiveAccessGrant: access.grant,
      sensitiveResource: access.resource,
      sensitiveAccessKind: "WORKER",
      sensitiveAccessPurposeCode: "INTEGRITY_VERIFICATION",
      object,
    },
    access,
  };
}

async function main() {
  await check("server value protection fails closed without server key configuration", () => {
    const key = process.env.P0_TRUSTED_WRITER_ENCRYPTION_KEY;
    const version = process.env.P0_TRUSTED_WRITER_KEY_VERSION;
    delete process.env.P0_TRUSTED_WRITER_ENCRYPTION_KEY;
    delete process.env.P0_TRUSTED_WRITER_KEY_VERSION;
    try {
      assert.equal(createServerEnvironmentP0ValueProtectionAdapter(), null);
    } finally {
      if (key !== undefined) process.env.P0_TRUSTED_WRITER_ENCRYPTION_KEY = key;
      if (version !== undefined) process.env.P0_TRUSTED_WRITER_KEY_VERSION = version;
    }
  });

  await check("disposable value protection round-trips exact AAD-bound bytes", async () => {
    const protector = createDeterministicDisposableP0ValueProtectionAdapter({
      seed: "value-protection-roundtrip-seed",
    });
    const plaintext = new TextEncoder().encode("synthetic source value");
    const aad = new TextEncoder().encode("tenant/source/exact-aad");
    const envelope = await protector.protect({
      plaintext,
      aad,
      envelopeVersion: "p0-prisma-source-bytes-v1",
      aadVersion: "p0-source-object-aad-v1",
    });
    assert(envelope);
    const result = await protector.unprotect({
      protectedValue: envelope,
      aad,
      expectedEnvelopeVersion: "p0-prisma-source-bytes-v1",
      expectedAadVersion: "p0-source-object-aad-v1",
    });
    assert(result);
    assert.deepEqual(Buffer.from(result), Buffer.from(plaintext));
  });

  await check("value protection rejects ciphertext and AAD substitution", async () => {
    const protector = createDeterministicDisposableP0ValueProtectionAdapter({
      seed: "value-protection-substitution-seed",
    });
    const aad = new TextEncoder().encode("scope-a");
    const envelope = await protector.protect({
      plaintext: new TextEncoder().encode("source"),
      aad,
      envelopeVersion: "p0-prisma-source-bytes-v1",
      aadVersion: "p0-source-object-aad-v1",
    });
    assert(envelope);
    const ciphertext = new Uint8Array(envelope.ciphertext);
    ciphertext[0] = ciphertext[0]! ^ 1;
    assert.equal(
      await protector.unprotect({
        protectedValue: { ...envelope, ciphertext },
        aad,
        expectedEnvelopeVersion: "p0-prisma-source-bytes-v1",
        expectedAadVersion: "p0-source-object-aad-v1",
      }),
      null,
    );
    assert.equal(
      await protector.unprotect({
        protectedValue: envelope,
        aad: new TextEncoder().encode("scope-b"),
        expectedEnvelopeVersion: "p0-prisma-source-bytes-v1",
        expectedAadVersion: "p0-source-object-aad-v1",
      }),
      null,
    );
  });

  await check("authenticated Prisma path writes ciphertext then verifies exact persisted bytes", async () => {
    const value = await fixture();
    const result = await dispatchP0SourceArtifactWrite(
      value.adapter.provider,
      value.request,
    );
    assert(result.ok);
    assert.equal(result.value.object.providerKey, P0_PRISMA_SOURCE_PROVIDER_KEY);
    assert.equal(result.value.object.writeDisposition, "CREATED");
    assert.equal(value.revalidations, 1);
    const [row] = value.database.rows.values();
    assert(row);
    assert.notDeepEqual(Buffer.from(row.ciphertext), Buffer.from(value.request.content));
    assert.equal(row.sha256, computeP0SourceArtifactSha256(value.request.content));
  });

  await check("exact replay is idempotent and does not append a second physical source", async () => {
    const value = await fixture();
    const first = await dispatchP0SourceArtifactWrite(value.adapter.provider, value.request);
    const second = await dispatchP0SourceArtifactWrite(value.adapter.provider, value.request);
    assert(first.ok && second.ok);
    assert.equal(second.value.object.writeDisposition, "IDEMPOTENT_REPLAY");
    assert.equal(value.database.rows.size, 1);
    assert.equal(value.revalidations, 2);
  });

  await check("concurrent exact replay serializes to one source object", async () => {
    const value = await fixture();
    const results = await Promise.all([
      dispatchP0SourceArtifactWrite(value.adapter.provider, value.request),
      dispatchP0SourceArtifactWrite(value.adapter.provider, value.request),
    ]);
    assert(results.every((result) => result.ok));
    assert.equal(value.database.rows.size, 1);
    assert.deepEqual(
      results.map((result) => (result.ok ? result.value.object.writeDisposition : "FAIL")).sort(),
      ["CREATED", "IDEMPOTENT_REPLAY"],
    );
  });

  await check("caller-forged digest is denied before persistence", async () => {
    const value = await fixture();
    const result = await dispatchP0SourceArtifactWrite(value.adapter.provider, {
      ...value.request,
      sha256: "f".repeat(64),
    });
    assert.deepEqual(result, { ok: false, kind: "DENIED", code: "INVALID_SOURCE_WRITE" });
    assert.equal(value.database.rows.size, 0);
  });

  await check("direct provider invocation cannot reuse an expired fence permit", async () => {
    const value = await fixture();
    let stalePermit: VerifiedP0SourceWriteFencePermit | null = null;
    const fenced = await value.adapter.writeFence.runWhileRetained({
      principal: value.authenticated,
      scope: value.request.scope,
      ingestionRevision: value.request.ingestionRevision,
      operationId: value.operationId,
      sourceOperationId: value.sourceOperationId,
      execute: async (permit) => {
        stalePermit = permit;
        return true;
      },
    });
    assert.equal(fenced.kind, "EXECUTED");
    await assert.rejects(() =>
      value.adapter.provider.putImmutable({
        ...value.request,
        writeFencePermit: stalePermit!,
      }),
    );
    assert.equal(value.database.rows.size, 0);
  });

  await check("stale or revoked worker grant denies before the ingestion lock/write", async () => {
    let live = true;
    const value = await fixture({ grantLive: () => live });
    live = false;
    const result = await dispatchP0SourceArtifactWrite(value.adapter.provider, value.request);
    assert.deepEqual(result, {
      ok: false,
      kind: "DENIED",
      code: "SOURCE_WRITE_FENCE_DENIED",
    });
    assert.equal(value.revalidations, 1);
    assert.equal(value.database.rows.size, 0);
  });

  await check("wrong durable source operation cannot cross the ingestion fence", async () => {
    const value = await fixture();
    value.database.ingestion.operationKey = "different-operation";
    const result = await dispatchP0SourceArtifactWrite(value.adapter.provider, value.request);
    assert.deepEqual(result, {
      ok: false,
      kind: "DENIED",
      code: "SOURCE_WRITE_FENCE_DENIED",
    });
    assert.equal(value.revalidations, 1);
    assert.equal(value.database.rows.size, 0);
  });

  await check("protected read revalidates live authority and persisted audit in one transaction", async () => {
    const providerSource = readFileSync(
      new URL("../lib/creditTruth/prismaSourceArtifactProvider.ts", import.meta.url),
      "utf8",
    );
    const auditQuery = providerSource.match(
      /FROM "P0SensitiveAccessEvent"[\s\S]*?`;\n/,
    )?.[0];
    assert(auditQuery);
    assert.equal(
      /FOR\s+(?:NO\s+KEY\s+UPDATE|UPDATE|SHARE|KEY\s+SHARE)/.test(auditQuery),
      false,
    );

    const value = await fixture();
    const written = await dispatchP0SourceArtifactWrite(
      value.adapter.provider,
      value.request,
    );
    assert(written.ok);
    const read = await protectedReadRequest(
      value,
      written.value.object,
      "read-source-operation-valid",
    );
    value.database.recordAudit(read.access.grant);
    const result = await dispatchP0SourceArtifactRead(
      value.adapter.provider,
      read.request,
    );
    assert(result.ok);
    assert.deepEqual(
      Buffer.from(result.value.content),
      Buffer.from(value.request.content),
    );
    assert.deepEqual(value.revalidationPurposes, [
      "SOURCE_ARTIFACT_WRITE",
      "SOURCE_ARTIFACT_READ",
    ]);
  });

  await check("revocation after audit grant but before protected read fails before source access", async () => {
    let live = true;
    const value = await fixture({ grantLive: () => live });
    const written = await dispatchP0SourceArtifactWrite(
      value.adapter.provider,
      value.request,
    );
    assert(written.ok);
    const read = await protectedReadRequest(
      value,
      written.value.object,
      "read-source-operation-revoked",
    );
    value.database.recordAudit(read.access.grant);
    live = false;
    const sourceFindsBeforeRead = value.database.sourceFinds;
    const result = await dispatchP0SourceArtifactRead(
      value.adapter.provider,
      read.request,
    );
    assert.deepEqual(result, {
      ok: false,
      kind: "OUTCOME_UNKNOWN",
      code: "SOURCE_READ_OUTCOME_UNKNOWN",
    });
    assert.equal(value.database.sourceFinds, sourceFindsBeforeRead);
    assert.equal(value.revalidationPurposes.at(-1), "SOURCE_ARTIFACT_READ");
  });

  await check("missing persisted access audit fails before protected source access", async () => {
    const value = await fixture();
    const written = await dispatchP0SourceArtifactWrite(
      value.adapter.provider,
      value.request,
    );
    assert(written.ok);
    const read = await protectedReadRequest(
      value,
      written.value.object,
      "read-source-operation-no-audit",
    );
    const sourceFindsBeforeRead = value.database.sourceFinds;
    const result = await dispatchP0SourceArtifactRead(
      value.adapter.provider,
      read.request,
    );
    assert.deepEqual(result, {
      ok: false,
      kind: "OUTCOME_UNKNOWN",
      code: "SOURCE_READ_OUTCOME_UNKNOWN",
    });
    assert.equal(value.database.sourceFinds, sourceFindsBeforeRead);
  });

  await check("ciphertext substitution fails exact authorized readback", async () => {
    const value = await fixture();
    const written = await dispatchP0SourceArtifactWrite(value.adapter.provider, value.request);
    assert(written.ok);
    value.database.tamperContent();
    const capability = await verifyP0SourceArtifactCapability(
      {
        scope: written.value.object.scope,
        purpose: "READ_SOURCE",
        actorId: value.authenticated.actorId,
        authorizationDecisionId: "read-source-operation",
        authorizationVersion: value.authenticated.authorizationVersion,
        issuedAt: new Date(Date.now() - 1_000).toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      { verifyDecision: async () => true },
    );
    assert(capability);
    const access = await accessGrant(value.authenticated, {
      resourceType: "REPORT_SOURCE",
      resourceId: written.value.object.scope.artifactId,
      resourceVersion: written.value.object.scope.artifactVersion,
      purposeCode: "INTEGRITY_VERIFICATION",
      eventKey: "audit-source-read",
    });
    value.database.recordAudit(access.grant);
    const result = await dispatchP0SourceArtifactRead(value.adapter.provider, {
      contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
      capability: capability as typeof capability & { readonly purpose: "READ_SOURCE" },
      principal: value.authenticated,
      sensitiveAccessGrant: access.grant,
      sensitiveResource: access.resource,
      sensitiveAccessKind: "WORKER",
      sensitiveAccessPurposeCode: "INTEGRITY_VERIFICATION",
      object: written.value.object,
    });
    assert.deepEqual(result, {
      ok: false,
      kind: "OUTCOME_UNKNOWN",
      code: "SOURCE_READ_OUTCOME_UNKNOWN",
    });
  });

  process.stdout.write(`1..${passed}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
