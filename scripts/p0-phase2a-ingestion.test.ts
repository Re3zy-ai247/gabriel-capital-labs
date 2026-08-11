import assert from "node:assert/strict";
import { verifyP0PrincipalCandidate, p0ScopeFromPrincipal, type P0Principal } from "../lib/creditTruth/principal";
import { createLocalSyntheticP0Repository } from "../lib/creditTruth/repository";
import { createP0ReportIngestionService, p0ExhaustedRecoveryState, type P0ReportIngestion, type P0ReportVersionCommitReadback } from "../lib/creditTruth/reportIngestion";
import {
  P0_LOCAL_REPOSITORY_ID,
  P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
  verifyLocalP0RepositoryReadback,
} from "../lib/creditTruth/repositoryAttestation";
import { attestLocalSyntheticP0Phase2AFlags, evaluateAndMintP0Phase2AGatePermit, verifyP0Phase2ACohortDecision, type P0Phase2AGatePermit } from "../lib/creditTruth/phase2Flags";
import { P0_PHASE2A_READINESS_CONTRACT_VERSION, P0_REPOSITORY_CAPABILITIES, verifyP0RepositoryReadinessReceipt } from "../lib/creditTruth/phase2Readiness";
import {
  P0_LOCAL_SOURCE_PROVIDER_KEY, P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
  computeP0SourceArtifactSha256, createLocalSyntheticP0SourceArtifactProvider,
  createLocalSyntheticP0SourceRetentionState, deriveP0SourceArtifactOperationIdentity,
  dispatchP0SourceArtifactWrite, verifyP0SourceArtifactCapability,
  type VerifiedP0SourceArtifactWriteReceipt,
} from "../lib/creditTruth/sourceArtifact";
import {
  authorizeAndAuditP0SensitiveAccess,
  verifyAndDeriveP0SensitiveAuditRefs,
  verifyP0SensitiveResourceRef,
  type P0SensitiveAccessEventDraft,
  type VerifiedP0SensitiveAccessGrant,
} from "../lib/creditTruth/sensitiveAccessAudit";

process.env.P0_PHASE2_ENABLED = "true";
process.env.P0_INGESTION_SHADOW_ENABLED = "true";
process.env.P0_PHASE2_KILL_SWITCH = "false";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) { await run(); passed += 1; process.stdout.write(`ok ${passed} - ${name}\n`); }
async function principal(): Promise<P0Principal> {
  const value = await verifyP0PrincipalCandidate({ actorId: "worker-account", tenantId: "consumer-ing", consumerId: "consumer-ing", authorizationKind: "SYSTEM_WORKER", authorizationVersion: "worker-v1" }, { verifyCandidate: async () => true });
  assert(value); return value;
}
async function gate(authenticated: P0Principal, operationId: string, now: Date): Promise<P0Phase2AGatePermit> {
  const scope = p0ScopeFromPrincipal(authenticated); const issuedAt = new Date(now.getTime() - 5_000).toISOString(); const expiresAt = new Date(now.getTime() + 120_000).toISOString(); const migrationSha256 = "b".repeat(64);
  const repositoryReceipt = await verifyP0RepositoryReadinessReceipt({ contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION, receiptId: `receipt-${operationId}`, receiptKind: "LOCAL_SYNTHETIC", repositoryAdapterId: "local", repositoryAdapterVersion: "v1", codeRevision: "local", migrationSha256, semanticsVersion: "v1", capabilities: P0_REPOSITORY_CAPABILITIES, issuedAt, expiresAt }, { verifierId: "local", verifyRepositoryReceipt: async () => true }); assert(repositoryReceipt);
  const cohortDecision = await verifyP0Phase2ACohortDecision({ contractVersion: "p0-phase2a-flags-v1", decisionId: `cohort-${operationId}`, stage: "INGESTION_SHADOW", actorId: authenticated.actorId, tenantId: scope.tenantId, consumerId: scope.consumerId, authorizationKind: authenticated.authorizationKind, authorizationVersion: authenticated.authorizationVersion, cohortVersion: "v1", included: true, decidedAt: issuedAt, expiresAt }, { resolverId: "local", verifyServerResolvedCohort: async () => true }); assert(cohortDecision);
  const flags = await attestLocalSyntheticP0Phase2AFlags({ phase2Enabled: true, killSwitchEngaged: false, ingestionShadowEnabled: true, round0ReviewEnabled: false, assertionRuntimeEnabled: false }, { attestorId: "local-test-flags", verifyLocalSyntheticFlags: async () => true }); assert(flags);
  const permit = evaluateAndMintP0Phase2AGatePermit({ stage: "INGESTION_SHADOW", mode: "LOCAL_BUILD", operationId, flags, principal: authenticated, scope, cohortDecision, readinessEvidence: { migrationVerified: true, migrationSha256, principalBoundaryVerified: true, repositoryBoundaryVerified: true, sourceArtifactBoundaryVerified: true, ingestionBoundaryVerified: true, round0BoundaryVerified: false, assertionBoundaryVerified: false, repositoryReceipt } }); assert(permit); return permit;
}
const digest = "c".repeat(64);
function reservation(authenticated: P0Principal, permit: P0Phase2AGatePermit, now: Date, overrides: Record<string, unknown> = {}) {
  void now;
  return { principal: authenticated, gatePermit: permit, idempotencyKey: "idem-1", operationKey: permit?.operationId ?? "reserve-missing-gate", reportSeriesKey: "series-1", reservedVersion: 1, sourceSha256: digest, sourceByteLength: 100, sourceDeclaredMimeType: "application/pdf", sourceDetectedMimeType: "application/pdf", ...overrides } as Parameters<ReturnType<typeof createP0ReportIngestionService>["reserve"]>[0];
}
async function writeSource(authenticated: P0Principal, ingestionId: string, artifactId: string, operationId: string, content: Uint8Array, ingestionRevision = 1): Promise<VerifiedP0SourceArtifactWriteReceipt> {
  void artifactId; const now = new Date(); const permit = await gate(authenticated, operationId, now); const principalScope = p0ScopeFromPrincipal(authenticated); const sourceOperationId = `source-${ingestionId}`; const identity = deriveP0SourceArtifactOperationIdentity({ ...principalScope, ingestionId, operationId: sourceOperationId, kind: "ORIGINAL_PDF" }); const scope = { ...principalScope, ingestionId, artifactId: identity.artifactId, artifactVersion: 1 }; const retentionState = createLocalSyntheticP0SourceRetentionState({ ...principalScope, ingestionId, sourceOperationId, revision: ingestionRevision, state: "RECEIVED", sourceDisposition: "RETAINED" });
  let audited: P0SensitiveAccessEventDraft | null = null;
  const sensitiveResource = await verifyP0SensitiveResourceRef({ principal: authenticated, scope: principalScope, candidate: { resourceType: "REPORT_INGESTION", resourceId: ingestionId, resourceVersion: ingestionRevision }, verifier: { verifierId: "local-resource", verifyResourceRef: async () => true } }); assert(sensitiveResource);
  const auditRefs = await verifyAndDeriveP0SensitiveAuditRefs({ principal: authenticated, scope: principalScope, candidate: { operationRef: operationId, eventRef: `audit-${operationId}` }, resource: sensitiveResource, accessKind: "WORKER", purposeCode: "REPORT_INGESTION", verifier: { verifierId: "local-audit-refs", verifyAuditRefs: async () => true } }); assert(auditRefs);
  const access = await authorizeAndAuditP0SensitiveAccess({ principal: authenticated, scope: principalScope, accessKind: "WORKER", purposeCode: "REPORT_INGESTION", resource: sensitiveResource, auditRefs, authorizer: { authorizeSensitiveAccess: async () => ({ allowed: true, reasonCode: "AUTHORIZED" }) }, repository: { appendSensitiveAccessEvent: async ({ event }) => { audited = event; return { disposition: "CREATED" }; }, readSensitiveAccessEvent: async () => audited } });
  assert(access.allowed); const sensitiveAccessGrant: VerifiedP0SensitiveAccessGrant = access.grant;
  const capability = await verifyP0SourceArtifactCapability({ scope, purpose: "STORE_SOURCE", actorId: authenticated.actorId, authorizationDecisionId: operationId, authorizationVersion: authenticated.authorizationVersion, issuedAt: new Date(now.getTime() - 1_000).toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }, { verifyDecision: async () => true }, { principal: authenticated, permit, operationId }); assert(capability);
  const result = await dispatchP0SourceArtifactWrite(createLocalSyntheticP0SourceArtifactProvider(), { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, selectedProviderKey: P0_LOCAL_SOURCE_PROVIDER_KEY, capability: capability as typeof capability & { purpose: "STORE_SOURCE" }, principal: authenticated, gatePermit: permit, operationId, sourceOperationId, writeFence: retentionState.writeFence, ingestionRevision, sensitiveAccessGrant, sensitiveResource, sensitiveAccessKind: "WORKER", sensitiveAccessPurposeCode: "REPORT_INGESTION", scope, kind: "ORIGINAL_PDF", mimeType: "application/pdf", content, sha256: computeP0SourceArtifactSha256(content), byteLength: content.byteLength, idempotencyKey: identity.providerOperationId });
  assert(result.ok); return result.value;
}

async function reportVersionCommitReceipt(
  authenticated: P0Principal,
  row: P0ReportIngestion,
  sourceReceipt: VerifiedP0SourceArtifactWriteReceipt,
  operationId: string,
) {
  const reportVersionId = `report-version-${row.id}`;
  const snapshot: P0ReportVersionCommitReadback = {
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId,
    reportSeriesKey: row.reportSeriesKey,
    version: row.reservedVersion,
    inputSha256: row.sourceSha256,
    authorityStatus: "SHADOW_V2",
    sourceArtifact: {
      tenantId: row.tenantId,
      consumerId: row.consumerId,
      artifactId: sourceReceipt.object.scope.artifactId,
      artifactVersion: sourceReceipt.object.scope.artifactVersion,
      artifactKind: "REPORT_SOURCE",
      reportVersionId,
      sha256: row.sourceSha256,
      mimeType: row.sourceDetectedMimeType,
      byteLength: row.sourceByteLength,
      storageProviderKey: sourceReceipt.object.providerKey,
      storageLocatorCiphertext: sourceReceipt.object.locator.ciphertextBase64,
      storageLocatorIv: sourceReceipt.object.locator.ivBase64,
      storageLocatorAuthTag: sourceReceipt.object.locator.authTagBase64,
      storageLocatorKeyVersion: sourceReceipt.object.locator.keyVersion,
      storageLocatorAlgorithm: sourceReceipt.object.locator.algorithm,
      storageLocatorEnvelopeVersion: sourceReceipt.object.locator.envelopeVersion,
      storageLocatorAadVersion: sourceReceipt.object.locator.aadVersion,
      createdByActorId: authenticated.actorId,
    },
  };
  const attestation = await verifyLocalP0RepositoryReadback({
    operationId,
    purpose: "REPORT_VERSION_COMMIT",
    scope: p0ScopeFromPrincipal(authenticated),
    expectedSnapshot: snapshot,
    readbackSnapshot: structuredClone(snapshot),
    sourceRefs: [
      { resourceType: "REPORT_VERSION", resourceId: reportVersionId, resourceVersion: String(row.reservedVersion), integritySha256: row.sourceSha256 },
      { resourceType: "SOURCE_ARTIFACT", resourceId: sourceReceipt.object.scope.artifactId, resourceVersion: String(sourceReceipt.object.scope.artifactVersion), integritySha256: row.sourceSha256 },
    ],
    verifier: { repositoryId: P0_LOCAL_REPOSITORY_ID, semanticsVersion: P0_LOCAL_REPOSITORY_SEMANTICS_VERSION, verifyReadback: async () => true },
  });
  assert(attestation);
  return attestation;
}

async function failedExtractionRunReceipt(authenticated: P0Principal, row: P0ReportIngestion, operationId: string) {
  assert(row.reportVersionId); assert(row.sourceArtifactId);
  const snapshot = {
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    extractionRunId: `failed-run-${row.id}`,
    inputArtifactId: row.sourceArtifactId,
    inputSha256: row.sourceSha256,
    inputRepresentation: "ORIGINAL_REPORT_BYTES" as const,
    status: "FAILED" as const,
  };
  const attestation = await verifyLocalP0RepositoryReadback({
    operationId,
    purpose: "SHADOW_EXTRACTION_WRITE",
    scope: p0ScopeFromPrincipal(authenticated),
    expectedSnapshot: snapshot,
    readbackSnapshot: structuredClone(snapshot),
    sourceRefs: [{ resourceType: "SOURCE_ARTIFACT", resourceId: row.sourceArtifactId, resourceVersion: "1", integritySha256: row.sourceSha256 }],
    verifier: { repositoryId: P0_LOCAL_REPOSITORY_ID, semanticsVersion: P0_LOCAL_REPOSITORY_SEMANTICS_VERSION, verifyReadback: async () => true },
  });
  assert(attestation); return attestation;
}

async function reconciliationReceipt(authenticated: P0Principal, snapshot: P0ReportIngestion, operationId: string) {
  const attestation = await verifyLocalP0RepositoryReadback({
    operationId,
    purpose: "INGESTION_RECONCILIATION",
    scope: p0ScopeFromPrincipal(authenticated),
    expectedSnapshot: snapshot,
    readbackSnapshot: structuredClone(snapshot),
    sourceRefs: [{ resourceType: "REPORT_INGESTION", resourceId: snapshot.id, resourceVersion: String(snapshot.revision) }],
    verifier: { repositoryId: P0_LOCAL_REPOSITORY_ID, semanticsVersion: P0_LOCAL_REPOSITORY_SEMANTICS_VERSION, verifyReadback: async () => true },
  });
  assert(attestation); return attestation;
}

async function main() {
  await check("reservation requires an exact operation gate permit", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date();
    const result = await service.reserve(reservation(authenticated, undefined as unknown as P0Phase2AGatePermit, now));
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, "INGESTION_GATE_DENIED");
  });

  await check("reservation is idempotent for the exact operation and source", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date(); const permit = await gate(authenticated, "reserve-idem", now);
    const first = await service.reserve(reservation(authenticated, permit, now)); const replay = await service.reserve(reservation(authenticated, permit, now));
    assert(first.ok); assert(replay.ok); if (replay.ok) assert.equal(replay.kind, "IDEMPOTENT_REPLAY");
  });

  await check("ingestion rejects shaped but unbranded repository read and write results", async () => {
    const authenticated = await principal(); const now = new Date();
    const createBase = createLocalSyntheticP0Repository(); const forgedCreate = Object.freeze({ ...createBase, createExact: async (...args: any[]) => { const result = await (createBase.createExact as any)(...args); return "value" in result ? { ...result, attestation: { ...result.attestation } } : result; } }) as any; const createService = createP0ReportIngestionService(forgedCreate); const created = await createService.reserve(reservation(authenticated, await gate(authenticated, "reserve-forged-create", now), now)); assert.equal(created.ok, false); if (!created.ok) assert.equal(created.code, "RESERVATION_READBACK_UNATTESTED");
    const readBase = createLocalSyntheticP0Repository(); const seedService = createP0ReportIngestionService(readBase); const seed = await seedService.reserve(reservation(authenticated, await gate(authenticated, "reserve-forged-read", now), now)); assert(seed.ok); if (!seed.ok) return; const forgedRead = Object.freeze({ ...readBase, readExact: async (...args: any[]) => { const result = await (readBase.readExact as any)(...args); return result.kind === "FOUND" ? { ...result, attestation: { ...result.attestation } } : result; } }) as any; const read = await createP0ReportIngestionService(forgedRead).read({ principal: authenticated, ingestionId: seed.ingestion.id, operationId: "forged-read" }); assert.equal(read.ok, false); if (!read.ok) assert.equal(read.code, "INGESTION_READ_UNATTESTED");
    const casBase = createLocalSyntheticP0Repository(); const forgedCas = Object.freeze({ ...casBase, compareAndSwapExact: async (...args: any[]) => { const result = await (casBase.compareAndSwapExact as any)(...args); return "value" in result ? { ...result, attestation: { ...result.attestation } } : result; } }) as any; const casService = createP0ReportIngestionService(forgedCas); const casSeed = await casService.reserve(reservation(authenticated, await gate(authenticated, "reserve-forged-cas", now), now)); assert(casSeed.ok); if (!casSeed.ok) return; const claim = await casService.claim({ principal: authenticated, gatePermit: await gate(authenticated, "claim-forged-cas", now), ingestionId: casSeed.ingestion.id, operationId: "claim-forged-cas", leaseMs: 30_000 }); assert.equal(claim.ok, false); if (!claim.ok) assert.equal(claim.code, "CLAIM_READBACK_UNATTESTED");
  });

  await check("same series/version under a different idempotency key conflicts", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date();
    const firstPermit = await gate(authenticated, "reserve-version-a", now); const secondPermit = await gate(authenticated, "reserve-version-b", now);
    assert((await service.reserve(reservation(authenticated, firstPermit, now))).ok);
    const duplicate = await service.reserve(reservation(authenticated, secondPermit, now, { idempotencyKey: "idem-2", operationKey: "reserve-version-b" }));
    assert.equal(duplicate.ok, false); if (!duplicate.ok) assert.equal(duplicate.code, "DUPLICATE_REPORT_VERSION_RESERVATION");
  });

  await check("a live lease prevents a second worker claim", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date(); const reservePermit = await gate(authenticated, "reserve-lease", now);
    const reserved = await service.reserve(reservation(authenticated, reservePermit, now)); assert(reserved.ok); if (!reserved.ok) return;
    const claimPermit = await gate(authenticated, "claim-lease-a", now); const claimed = await service.claim({ principal: authenticated, gatePermit: claimPermit, ingestionId: reserved.ingestion.id, operationId: "claim-lease-a", leaseMs: 30_000 }); assert(claimed.ok);
    const otherPermit = await gate(authenticated, "claim-lease-b", now); const other = await service.claim({ principal: authenticated, gatePermit: otherPermit, ingestionId: reserved.ingestion.id, operationId: "claim-lease-b", leaseMs: 30_000 });
    assert.equal(other.ok, false); if (!other.ok) assert.equal(other.kind, "BUSY");
  });

  await check("stale lease token cannot transition ingestion", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date(); const reserved = await service.reserve(reservation(authenticated, await gate(authenticated, "reserve-stale", now), now)); assert(reserved.ok); if (!reserved.ok) return;
    const claimed = await service.claim({ principal: authenticated, gatePermit: await gate(authenticated, "claim-stale", now), ingestionId: reserved.ingestion.id, operationId: "claim-stale", leaseMs: 30_000 }); assert(claimed.ok); if (!claimed.ok) return;
    const result = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-stale", now), ingestionId: claimed.ingestion.id, operationId: "transition-stale", expectedRevision: claimed.ingestion.revision, leaseToken: "forged-token", to: "FAILED", safeFailureCode: "SAFE_TEST_FAILURE" });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, "STALE_WORKER_LEASE");
  });

  await check("only a server-resolved worker can claim or transition the durable queue", async () => {
    const direct = await verifyP0PrincipalCandidate({ actorId: "authenticated-user", tenantId: "consumer-direct", consumerId: "consumer-direct", authorizationKind: "DIRECT_CONSUMER", authorizationVersion: "direct-v1" }, { verifyCandidate: async () => true }); assert(direct);
    const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date(); const reservePermit = await gate(direct, "reserve-direct", now); const reserved = await service.reserve(reservation(direct, reservePermit, now)); assert(reserved.ok); if (!reserved.ok) return;
    const claim = await service.claim({ principal: direct, gatePermit: await gate(direct, "claim-direct", now), ingestionId: reserved.ingestion.id, operationId: "claim-direct", leaseMs: 30_000 }); assert.equal(claim.ok, false); if (!claim.ok) assert.equal(claim.code, "INGESTION_GATE_DENIED");
  });

  await check("pre-extraction failure is durable without inventing an ExtractionRun", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date(); const reserved = await service.reserve(reservation(authenticated, await gate(authenticated, "reserve-pre-failure", now), now)); assert(reserved.ok); if (!reserved.ok) return;
    const claimed = await service.claim({ principal: authenticated, gatePermit: await gate(authenticated, "claim-pre-failure", now), ingestionId: reserved.ingestion.id, operationId: "claim-pre-failure", leaseMs: 30_000 }); assert(claimed.ok); if (!claimed.ok) return;
    const failed = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-pre-failure", now), ingestionId: claimed.ingestion.id, operationId: "transition-pre-failure", expectedRevision: claimed.ingestion.revision, leaseToken: claimed.ingestion.leaseToken!, to: "FAILED", safeFailureCode: "SOURCE_STORAGE_FAILED" }); assert(failed.ok); if (failed.ok) { assert.equal(failed.ingestion.extractionRunId, null); assert.equal(failed.ingestion.leaseToken, null); }
  });

  await check("OUTCOME_UNKNOWN requires an exact branded reconciliation CAS or quarantine", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date(); const reserved = await service.reserve(reservation(authenticated, await gate(authenticated, "reserve-unknown", now), now)); assert(reserved.ok); if (!reserved.ok) return;
    const claimed = await service.claim({ principal: authenticated, gatePermit: await gate(authenticated, "claim-unknown", now), ingestionId: reserved.ingestion.id, operationId: "claim-unknown", leaseMs: 30_000 }); assert(claimed.ok); if (!claimed.ok) return;
    const unknown = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-unknown", now), ingestionId: claimed.ingestion.id, operationId: "transition-unknown", expectedRevision: claimed.ingestion.revision, leaseToken: claimed.ingestion.leaseToken!, to: "OUTCOME_UNKNOWN", safeFailureCode: "WRITE_OUTCOME_UNKNOWN" }); assert(unknown.ok); if (!unknown.ok) return;
    const operationId = "reconcile-unknown"; const reconciledAt = new Date().toISOString(); const target = Object.freeze({ ...unknown.ingestion, state: "QUARANTINED" as const, safeFailureCode: "RECONCILIATION_QUARANTINE", revision: unknown.ingestion.revision + 1, leaseToken: null, leaseOwnerId: null, leaseExpiresAt: null, nextAttemptAt: reconciledAt, updatedAt: reconciledAt }); const receipt = await reconciliationReceipt(authenticated, target, operationId);
    const forged = structuredClone(receipt) as typeof receipt; const denied = await service.reconcile({ principal: authenticated, gatePermit: await gate(authenticated, operationId, new Date()), ingestionId: unknown.ingestion.id, operationId, expectedRevision: unknown.ingestion.revision, receipt: forged }); assert.equal(denied.ok, false); if (!denied.ok) assert.equal(denied.code, "UNATTESTED_INGESTION_RECONCILIATION");
    const result = await service.reconcile({ principal: authenticated, gatePermit: await gate(authenticated, operationId, new Date()), ingestionId: unknown.ingestion.id, operationId, expectedRevision: unknown.ingestion.revision, receipt }); assert(result.ok); if (result.ok) assert.equal(result.ingestion.state, "QUARANTINED");
  });

  await check("source transition rejects a receipt from another ingestion", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date(); const reserved = await service.reserve(reservation(authenticated, await gate(authenticated, "reserve-source", now), now)); assert(reserved.ok); if (!reserved.ok) return;
    const claimed = await service.claim({ principal: authenticated, gatePermit: await gate(authenticated, "claim-source", now), ingestionId: reserved.ingestion.id, operationId: "claim-source", leaseMs: 30_000 }); assert(claimed.ok); if (!claimed.ok) return;
    const content = new TextEncoder().encode("%PDF-1.4 synthetic"); const otherReceipt = await writeSource(authenticated, "other-ingestion", "artifact-other", "store-other", content);
    const result = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-source", now), ingestionId: claimed.ingestion.id, operationId: "transition-source", expectedRevision: claimed.ingestion.revision, leaseToken: claimed.ingestion.leaseToken!, to: "SOURCE_STORED_AND_VERIFIED", sourceReceipt: otherReceipt });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.code, "UNVERIFIED_SOURCE_READBACK");
  });

  await check("one end-to-end attempt retains its exact lease through extraction and assessment", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date(); const content = new TextEncoder().encode("%PDF-1.4 exact-source");
    const sourceSha256 = computeP0SourceArtifactSha256(content); const reserved = await service.reserve(reservation(authenticated, await gate(authenticated, "reserve-exact", now), now, { sourceSha256, sourceByteLength: content.byteLength, maxAttempts: 1 })); assert(reserved.ok); if (!reserved.ok) return;
    const claimed = await service.claim({ principal: authenticated, gatePermit: await gate(authenticated, "claim-exact", now), ingestionId: reserved.ingestion.id, operationId: "claim-exact", leaseMs: 30_000 }); assert(claimed.ok); if (!claimed.ok) return;
    const receipt = await writeSource(authenticated, reserved.ingestion.id, "artifact-exact", "store-exact", content, claimed.ingestion.revision);
    const transitioned = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-exact", now), ingestionId: claimed.ingestion.id, operationId: "transition-exact", expectedRevision: claimed.ingestion.revision, leaseToken: claimed.ingestion.leaseToken!, to: "SOURCE_STORED_AND_VERIFIED", sourceReceipt: receipt });
    assert(transitioned.ok); if (!transitioned.ok) return;
    assert.equal(transitioned.ingestion.leaseToken, claimed.ingestion.leaseToken); assert.equal(transitioned.ingestion.attemptCount, 1); assert.equal(transitioned.ingestion.sourceArtifactId, null); assert.equal(transitioned.ingestion.reportVersionId, null); assert.equal(transitioned.ingestion.sourceReadbackSha256, sourceSha256); assert.equal(transitioned.ingestion.sourceStorageProviderKey, P0_LOCAL_SOURCE_PROVIDER_KEY);
    const versionOperation = "transition-version-exact"; const commitReceipt = await reportVersionCommitReceipt(authenticated, transitioned.ingestion, receipt, versionOperation);
    const committed = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, versionOperation, new Date()), ingestionId: transitioned.ingestion.id, operationId: versionOperation, expectedRevision: transitioned.ingestion.revision, leaseToken: transitioned.ingestion.leaseToken!, to: "VERSION_COMMITTED", reportVersionReceipt: commitReceipt });
    assert(committed.ok); if (!committed.ok) return; assert.equal(committed.ingestion.leaseToken, claimed.ingestion.leaseToken); assert.equal(committed.ingestion.reportVersionId, commitReceipt.snapshot.reportVersionId); assert.equal(committed.ingestion.sourceArtifactId, receipt.object.scope.artifactId);
    const extracting = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-extracting", new Date()), ingestionId: committed.ingestion.id, operationId: "transition-extracting", expectedRevision: committed.ingestion.revision, leaseToken: committed.ingestion.leaseToken!, to: "EXTRACTING" }); assert(extracting.ok); if (!extracting.ok) return; assert.equal(extracting.ingestion.leaseToken, claimed.ingestion.leaseToken);
    const missingRun = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-failed-missing-run", new Date()), ingestionId: extracting.ingestion.id, operationId: "transition-failed-missing-run", expectedRevision: extracting.ingestion.revision, leaseToken: extracting.ingestion.leaseToken!, to: "FAILED", safeFailureCode: "PARSER_TIMEOUT" }); assert.equal(missingRun.ok, false); if (!missingRun.ok) assert.equal(missingRun.code, "UNVERIFIED_EXTRACTION_RUN");
    const failedOperation = "transition-failed-exact"; const runReceipt = await failedExtractionRunReceipt(authenticated, extracting.ingestion, failedOperation); const failed = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, failedOperation, new Date()), ingestionId: extracting.ingestion.id, operationId: failedOperation, expectedRevision: extracting.ingestion.revision, leaseToken: extracting.ingestion.leaseToken!, to: "FAILED", extractionRunReceipt: runReceipt, safeFailureCode: "PARSER_TIMEOUT" }); assert(failed.ok); if (!failed.ok) return; assert.equal(failed.ingestion.leaseToken, claimed.ingestion.leaseToken); assert.equal(failed.ingestion.attemptCount, 1); assert.equal(failed.ingestion.maxAttempts, 1);
    const assessed = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-assessed", new Date()), ingestionId: failed.ingestion.id, operationId: "transition-assessed", expectedRevision: failed.ingestion.revision, leaseToken: failed.ingestion.leaseToken!, to: "ASSESSED" }); assert(assessed.ok); if (!assessed.ok) return; assert.equal(assessed.ingestion.leaseToken, failed.ingestion.leaseToken); assert.equal(assessed.ingestion.attemptCount, 1);
    const ready = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-round0-ready", new Date()), ingestionId: assessed.ingestion.id, operationId: "transition-round0-ready", expectedRevision: assessed.ingestion.revision, leaseToken: assessed.ingestion.leaseToken!, to: "ROUND0_READY" }); assert(ready.ok); if (ready.ok) { assert.equal(ready.ingestion.leaseToken, null); assert.equal(ready.ingestion.attemptCount, 1); assert.equal(ready.ingestion.maxAttempts, 1); }
  });

  await check("expired worker recovery is bounded and attempt exhaustion becomes explicit failure", async () => {
    const authenticated = await principal(); const service = createP0ReportIngestionService(createLocalSyntheticP0Repository()); const now = new Date(); const reserved = await service.reserve(reservation(authenticated, await gate(authenticated, "reserve-recovery", now), now, { maxAttempts: 1 })); assert(reserved.ok); if (!reserved.ok) return;
    const claimed = await service.claim({ principal: authenticated, gatePermit: await gate(authenticated, "claim-recovery", now), ingestionId: reserved.ingestion.id, operationId: "claim-recovery", leaseMs: 1_000 }); assert(claimed.ok); if (!claimed.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const stale = await service.transition({ principal: authenticated, gatePermit: await gate(authenticated, "transition-after-expiry", new Date()), ingestionId: claimed.ingestion.id, operationId: "transition-after-expiry", expectedRevision: claimed.ingestion.revision, leaseToken: claimed.ingestion.leaseToken!, to: "FAILED", safeFailureCode: "LEASE_EXPIRED" }); assert.equal(stale.ok, false); if (!stale.ok) assert.equal(stale.code, "STALE_WORKER_LEASE");
    const recovered = await service.recoverExpired({ principal: authenticated, gatePermit: await gate(authenticated, "recover-expired", new Date()), ingestionId: claimed.ingestion.id, operationId: "recover-expired" });
    assert(recovered.ok); if (recovered.ok) { assert.equal(recovered.ingestion.state, "FAILED"); assert.equal(recovered.ingestion.safeFailureCode, "INGESTION_ATTEMPTS_EXHAUSTED"); }
  });

  await check("attempt exhaustion quarantines only late or ambiguous stages", () => {
    for (const state of ["RECEIVED", "SOURCE_STORED_AND_VERIFIED", "VERSION_COMMITTED", "EXTRACTING"] as const) assert.equal(p0ExhaustedRecoveryState(state), "FAILED");
    for (const state of ["SUCCEEDED", "PARTIAL", "ASSESSED", "OUTCOME_UNKNOWN"] as const) assert.equal(p0ExhaustedRecoveryState(state), "QUARANTINED");
    assert.equal(p0ExhaustedRecoveryState("FAILED"), "FAILED"); assert.equal(p0ExhaustedRecoveryState("ROUND0_READY"), null); assert.equal(p0ExhaustedRecoveryState("QUARANTINED"), null);
  });

  process.stdout.write(`${passed}/${passed} PASS p0-phase2a-ingestion\n`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
