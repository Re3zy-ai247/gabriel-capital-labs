import assert from "node:assert/strict";
import {
  attestLocalSyntheticP0Phase2AFlags,
  evaluateAndMintP0Phase2AGatePermit,
  evaluateP0Phase2AGate,
  p0Phase2AFlagsFromEnv,
  p0Phase2AGatePermitAuthorizes,
  verifyP0Phase2ACohortDecision,
  type P0Phase2AGatePermit,
} from "../lib/creditTruth/phase2Flags";
import {
  P0_PHASE2A_READINESS_CONTRACT_VERSION,
  P0_REPOSITORY_CAPABILITIES,
  evaluateP0Phase2AReadiness,
  verifyP0RepositoryReadinessReceipt,
  type P0Phase2AReadinessEvidence,
  type P0ReadinessMode,
} from "../lib/creditTruth/phase2Readiness";
import {
  authorizeAndAuditP0SensitiveAccess,
  p0SensitiveAccessGrantAllows,
  verifyAndDeriveP0SensitiveAuditRefs,
  verifyP0SensitiveResourceRef,
  type P0SensitiveAccessEventDraft,
  type P0SensitiveAccessKind,
  type P0SensitiveAccessPurposeCode,
  type P0SensitiveResourceRefCandidate,
} from "../lib/creditTruth/sensitiveAccessAudit";
import {
  p0ScopeFromPrincipal,
  verifyP0PrincipalCandidate,
  type P0Principal,
} from "../lib/creditTruth/principal";

const HASH = "a".repeat(64);
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run(); passed += 1; process.stdout.write(`ok ${passed} - ${name}\n`);
}
function enableLiveFlags() {
  process.env.P0_PHASE2_ENABLED = "true";
  process.env.P0_PHASE2_KILL_SWITCH = "false";
  process.env.P0_INGESTION_SHADOW_ENABLED = "true";
  process.env.P0_ROUND0_REVIEW_ENABLED = "true";
  process.env.P0_ASSERTION_RUNTIME_ENABLED = "true";
}
async function principal(): Promise<P0Principal> {
  const value = await verifyP0PrincipalCandidate({ actorId: "actor-1", tenantId: "consumer-1", consumerId: "consumer-1", authorizationKind: "DIRECT_CONSUMER", authorizationVersion: "grant-v1" }, { verifyCandidate: async () => true });
  assert(value); return value;
}
async function readyEvidence(): Promise<P0Phase2AReadinessEvidence> {
  const now = Date.now();
  const repositoryReceipt = await verifyP0RepositoryReadinessReceipt({ contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION, receiptId: "local-receipt-1", receiptKind: "LOCAL_SYNTHETIC", repositoryAdapterId: "synthetic-repository", repositoryAdapterVersion: "v1", codeRevision: "local-build", migrationSha256: HASH, semanticsVersion: "v1", capabilities: P0_REPOSITORY_CAPABILITIES, issuedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 3_600_000).toISOString() }, { verifierId: "local-verifier", verifyRepositoryReceipt: async () => true });
  assert(repositoryReceipt);
  return { migrationVerified: true, migrationSha256: HASH, principalBoundaryVerified: true, repositoryBoundaryVerified: true, sourceArtifactBoundaryVerified: true, ingestionBoundaryVerified: true, round0BoundaryVerified: true, assertionBoundaryVerified: true, repositoryReceipt };
}
async function gateFixture(stage: "ROOT" | "INGESTION_SHADOW" | "ROUND0_REVIEW" | "ASSERTION_RUNTIME", operationId: string, cohortTtlMs = 600_000) {
  const authenticated = await principal(); const scope = p0ScopeFromPrincipal(authenticated); const now = Date.now();
  const cohortDecision = await verifyP0Phase2ACohortDecision({ contractVersion: "p0-phase2a-flags-v1", decisionId: `cohort-${stage}-${operationId}`, stage, actorId: authenticated.actorId, tenantId: scope.tenantId, consumerId: scope.consumerId, authorizationKind: authenticated.authorizationKind, authorizationVersion: authenticated.authorizationVersion, cohortVersion: "cohort-v1", included: true, decidedAt: new Date(now - 1_000).toISOString(), expiresAt: new Date(now + cohortTtlMs).toISOString() }, { resolverId: "server-cohort", verifyServerResolvedCohort: async () => true });
  assert(cohortDecision);
  const flags = await attestLocalSyntheticP0Phase2AFlags({ phase2Enabled: true, killSwitchEngaged: false, ingestionShadowEnabled: true, round0ReviewEnabled: true, assertionRuntimeEnabled: true }, { attestorId: "flags-test", verifyLocalSyntheticFlags: async () => true });
  assert(flags);
  return { authenticated, scope, cohortDecision, flags, evidence: await readyEvidence() };
}
async function mintPermit(stage: "ROOT" | "INGESTION_SHADOW" | "ROUND0_REVIEW" | "ASSERTION_RUNTIME", operationId: string, cohortTtlMs = 600_000) {
  const f = await gateFixture(stage, operationId, cohortTtlMs);
  const permit = evaluateAndMintP0Phase2AGatePermit({ stage, mode: "LOCAL_BUILD", operationId, flags: f.flags, principal: f.authenticated, scope: f.scope, cohortDecision: f.cohortDecision, readinessEvidence: f.evidence });
  assert(permit); return { ...f, permit };
}
async function auditFixture(accessKind: P0SensitiveAccessKind, purposeCode: P0SensitiveAccessPurposeCode, candidate: P0SensitiveResourceRefCandidate) {
  const authenticated = await principal(); const scope = p0ScopeFromPrincipal(authenticated);
  const resource = await verifyP0SensitiveResourceRef({ principal: authenticated, scope, candidate, verifier: { verifierId: "resource-verifier", verifyResourceRef: async () => true } });
  assert(resource);
  const auditRefs = await verifyAndDeriveP0SensitiveAuditRefs({ principal: authenticated, scope, candidate: { operationRef: "server-operation-1", eventRef: "server-event-1" }, resource, accessKind, purposeCode, verifier: { verifierId: "audit-ref-verifier", verifyAuditRefs: async () => true } });
  assert(auditRefs);
  return { authenticated, scope, resource, auditRefs };
}

async function main() {
  Reflect.set(process.env, "NODE_ENV", "test"); enableLiveFlags();

  await check("environment reader has no injection seam and exact true semantics", () => {
    process.env.P0_PHASE2_ENABLED = "TRUE";
    assert.equal(p0Phase2AFlagsFromEnv().phase2Enabled, false);
    process.env.P0_PHASE2_ENABLED = "true";
    const resolved = p0Phase2AFlagsFromEnv();
    assert.equal(resolved.phase2Enabled, true);
    assert.equal(resolved.resolutionKind, "SERVER_ENVIRONMENT");
  });

  await check("plain request flags cannot forge enablement", async () => {
    const f = await gateFixture("ROUND0_REVIEW", "plain-flags");
    const decision = evaluateP0Phase2AGate({ stage: "ROUND0_REVIEW", mode: "LOCAL_BUILD", flags: { phase2Enabled: true, killSwitchEngaged: false, ingestionShadowEnabled: true, round0ReviewEnabled: true, assertionRuntimeEnabled: true } as typeof f.flags, principal: f.authenticated, scope: f.scope, cohortDecision: f.cohortDecision, readinessEvidence: f.evidence });
    assert.equal(decision.allowed, false);
    assert(decision.reasons.includes("SERVER_FLAGS_MISSING_OR_INVALID"));
  });

  await check("local synthetic flags cannot be minted or reused in production", async () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    const denied = await attestLocalSyntheticP0Phase2AFlags({ phase2Enabled: true, killSwitchEngaged: false, ingestionShadowEnabled: true, round0ReviewEnabled: true, assertionRuntimeEnabled: true }, { attestorId: "unsafe", verifyLocalSyntheticFlags: async () => true });
    assert.equal(denied, null);
    Reflect.set(process.env, "NODE_ENV", "test");
    const f = await mintPermit("ROUND0_REVIEW", "local-prod-reuse");
    Reflect.set(process.env, "NODE_ENV", "production");
    assert.equal(p0Phase2AGatePermitAuthorizes({ permit: f.permit, principal: f.authenticated, scope: f.scope, stage: "ROUND0_REVIEW", mode: "LOCAL_BUILD", operationId: "local-prod-reuse" }), false);
    Reflect.set(process.env, "NODE_ENV", "test");
  });

  await check("malformed readiness mode fails closed and retains production blocker", async () => {
    const result = evaluateP0Phase2AReadiness({ stage: "ROOT", mode: "MALFORMED" as P0ReadinessMode, evidence: await readyEvidence(), now: new Date() });
    assert.equal(result.ready, false);
    assert(result.reasons.includes("INVALID_READINESS_MODE"));
    assert(result.reasons.includes("AUTHENTICATED_PRODUCTION_REPOSITORY_RECEIPT_REQUIRED"));
  });

  await check("cohort and repository verifier exceptions fail closed", async () => {
    const f = await gateFixture("ROUND0_REVIEW", "throwing-verifier");
    const cohortCandidate = Object.fromEntries(Object.entries(f.cohortDecision).filter(([key]) => key !== "resolverId" && key !== "semanticSha256")) as unknown as Parameters<typeof verifyP0Phase2ACohortDecision>[0];
    assert.equal(await verifyP0Phase2ACohortDecision(cohortCandidate, { resolverId: "throw", verifyServerResolvedCohort: async () => { throw new Error("no"); } }), null);
    const now = Date.now();
    assert.equal(await verifyP0RepositoryReadinessReceipt({ contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION, receiptId: "throw", receiptKind: "LOCAL_SYNTHETIC", repositoryAdapterId: "synthetic", repositoryAdapterVersion: "v1", codeRevision: "local", migrationSha256: HASH, semanticsVersion: "v1", capabilities: P0_REPOSITORY_CAPABILITIES, issuedAt: new Date(now - 1_000).toISOString(), expiresAt: new Date(now + 60_000).toISOString() }, { verifierId: "throw", verifyRepositoryReceipt: async () => { throw new Error("no"); } }), null);
  });

  await check("permit is exact, unforgeable, live-clock validated, and operation-bound", async () => {
    const f = await mintPermit("ROUND0_REVIEW", "operation-1");
    assert(p0Phase2AGatePermitAuthorizes({ permit: f.permit, principal: f.authenticated, scope: f.scope, stage: "ROUND0_REVIEW", mode: "LOCAL_BUILD", operationId: "operation-1" }));
    assert.equal(p0Phase2AGatePermitAuthorizes({ permit: f.permit, principal: f.authenticated, scope: f.scope, stage: "ROUND0_REVIEW", mode: "LOCAL_BUILD", operationId: "operation-2" }), false);
    assert.equal(p0Phase2AGatePermitAuthorizes({ permit: { ...f.permit } as P0Phase2AGatePermit, principal: f.authenticated, scope: f.scope, stage: "ROUND0_REVIEW", mode: "LOCAL_BUILD", operationId: "operation-1" }), false);
    const realNow = Date.now;
    Date.now = () => Date.parse(f.permit.expiresAt) + 1;
    try { assert.equal(p0Phase2AGatePermitAuthorizes({ permit: f.permit, principal: f.authenticated, scope: f.scope, stage: "ROUND0_REVIEW", mode: "LOCAL_BUILD", operationId: "operation-1" }), false); } finally { Date.now = realNow; }
  });

  await check("live kill switch invalidates a retained permit", async () => {
    const f = await mintPermit("ASSERTION_RUNTIME", "kill-operation");
    process.env.P0_PHASE2_KILL_SWITCH = "true";
    assert.equal(p0Phase2AGatePermitAuthorizes({ permit: f.permit, principal: f.authenticated, scope: f.scope, stage: "ASSERTION_RUNTIME", mode: "LOCAL_BUILD", operationId: "kill-operation" }), false);
    process.env.P0_PHASE2_KILL_SWITCH = "false";
  });

  await check("permit cannot outlive a short cohort", async () => {
    const f = await mintPermit("ROUND0_REVIEW", "short-cohort", 500);
    assert(Date.parse(f.permit.expiresAt) <= Date.parse(f.cohortDecision.expiresAt));
    assert(Date.parse(f.permit.expiresAt) - Date.parse(f.permit.issuedAt) <= 500);
  });

  await check("audit requires branded resource and server-derived hashed refs", async () => {
    const f = await auditFixture("PREVIEW", "ROUND0_REVIEW", { resourceType: "REPORT_VERSION", resourceId: "report-v1", resourceVersion: 1 });
    assert.match(f.auditRefs.eventKey, /^p0evt_[0-9a-f]{64}$/);
    assert.match(f.auditRefs.correlationId, /^p0corr_[0-9a-f]{64}$/);
    const result = await authorizeAndAuditP0SensitiveAccess({ ...f, principal: f.authenticated, accessKind: "PREVIEW", purposeCode: "ROUND0_REVIEW", authorizer: { authorizeSensitiveAccess: async ({ resource }) => { assert.equal(resource, f.resource); return { allowed: true, reasonCode: "AUTHORIZED" }; } }, repository: { appendSensitiveAccessEvent: async () => ({ disposition: "CREATED" }), readSensitiveAccessEvent: async () => null } });
    assert.equal(result.allowed, false);
    const plain = await authorizeAndAuditP0SensitiveAccess({ principal: f.authenticated, scope: f.scope, resource: { resourceType: "REPORT_VERSION", resourceId: "report-v1", resourceVersion: 1 } as typeof f.resource, auditRefs: f.auditRefs, accessKind: "PREVIEW", purposeCode: "ROUND0_REVIEW", authorizer: { authorizeSensitiveAccess: async () => ({ allowed: true, reasonCode: "AUTHORIZED" }) }, repository: { appendSensitiveAccessEvent: async () => ({ disposition: "CREATED" }), readSensitiveAccessEvent: async () => null } });
    assert.deepEqual(plain, { allowed: false, code: "INVALID_ACCESS_REQUEST", grant: null });
  });

  await check("exact audit retry reuses event semantics and grant chronology", async () => {
    const f = await auditFixture("PREVIEW", "ROUND0_REVIEW", { resourceType: "REPORT_VERSION", resourceId: "report-v1", resourceVersion: 1 });
    let stored: P0SensitiveAccessEventDraft | null = null;
    const repository = { appendSensitiveAccessEvent: async ({ event }: { event: P0SensitiveAccessEventDraft }) => { const replay = stored !== null; stored = stored ?? event; return { disposition: replay ? "IDEMPOTENT_REPLAY" as const : "CREATED" as const }; }, readSensitiveAccessEvent: async () => stored };
    const call = () => authorizeAndAuditP0SensitiveAccess({ principal: f.authenticated, scope: f.scope, resource: f.resource, auditRefs: f.auditRefs, accessKind: "PREVIEW" as const, purposeCode: "ROUND0_REVIEW" as const, authorizer: { authorizeSensitiveAccess: async () => ({ allowed: true, reasonCode: "AUTHORIZED" as const }) }, repository });
    const first = await call(); const replay = await call();
    assert(first.allowed && replay.allowed);
    if (first.allowed && replay.allowed) {
      assert.equal(first.grant.auditSemanticSha256, replay.grant.auditSemanticSha256);
      assert.equal(first.grant.issuedAt, replay.grant.issuedAt);
      assert(p0SensitiveAccessGrantAllows({ grant: replay.grant, principal: f.authenticated, scope: f.scope, accessKind: "PREVIEW", purposeCode: "ROUND0_REVIEW", resource: f.resource }));
    }
  });

  await check("authorizer exception becomes exact persisted safe DENY", async () => {
    const f = await auditFixture("DECRYPT", "INTEGRITY_VERIFICATION", { resourceType: "REPORT_SOURCE", resourceId: "source-v1", resourceVersion: 1 });
    let stored: P0SensitiveAccessEventDraft | null = null;
    const result = await authorizeAndAuditP0SensitiveAccess({ principal: f.authenticated, scope: f.scope, resource: f.resource, auditRefs: f.auditRefs, accessKind: "DECRYPT", purposeCode: "INTEGRITY_VERIFICATION", authorizer: { authorizeSensitiveAccess: async () => { throw new Error("no"); } }, repository: { appendSensitiveAccessEvent: async ({ event }) => { stored = event; return { disposition: "CREATED" }; }, readSensitiveAccessEvent: async () => stored } });
    assert.deepEqual(result, { allowed: false, code: "ACCESS_DENIED_AND_AUDITED", grant: null });
    assert(stored); assert.equal((stored as P0SensitiveAccessEventDraft).decisionCode, "OTHER_SAFE_DENIAL");
  });

  await check("expired audit refs cannot mint a fresh grant", async () => {
    const f = await auditFixture("EXPORT", "CONSUMER_EXPORT", { resourceType: "ARTIFACT", resourceId: "artifact-v1", resourceVersion: 1 });
    const realNow = Date.now; let called = false;
    Date.now = () => Date.parse(f.auditRefs.expiresAt) + 1;
    try {
      const result = await authorizeAndAuditP0SensitiveAccess({ principal: f.authenticated, scope: f.scope, resource: f.resource, auditRefs: f.auditRefs, accessKind: "EXPORT", purposeCode: "CONSUMER_EXPORT", authorizer: { authorizeSensitiveAccess: async () => { called = true; return { allowed: true, reasonCode: "AUTHORIZED" }; } }, repository: { appendSensitiveAccessEvent: async () => { called = true; return { disposition: "CREATED" }; }, readSensitiveAccessEvent: async () => null } });
      assert.deepEqual(result, { allowed: false, code: "INVALID_ACCESS_REQUEST", grant: null }); assert.equal(called, false);
    } finally { Date.now = realNow; }
  });

  await check("pre-store worker audit binds the exact durable ingestion reservation", async () => {
    const authenticated = await verifyP0PrincipalCandidate(
      {
        actorId: "ingestion-worker",
        tenantId: "consumer-1",
        consumerId: "consumer-1",
        authorizationKind: "SYSTEM_WORKER",
        authorizationVersion: "worker-grant-v1",
      },
      { verifyCandidate: async () => true },
    );
    assert(authenticated);
    const scope = p0ScopeFromPrincipal(authenticated);
    const resource = await verifyP0SensitiveResourceRef({
      principal: authenticated,
      scope,
      candidate: {
        resourceType: "REPORT_INGESTION",
        resourceId: "ingestion-v1",
        resourceVersion: 3,
      },
      verifier: {
        verifierId: "ingestion-resource-verifier",
        verifyResourceRef: async ({ candidate }) =>
          candidate.resourceType === "REPORT_INGESTION" &&
          candidate.resourceId === "ingestion-v1" &&
          candidate.resourceVersion === 3,
      },
    });
    assert(resource);
    const auditRefs = await verifyAndDeriveP0SensitiveAuditRefs({
      principal: authenticated,
      scope,
      candidate: {
        operationRef: "store-source-operation-v1",
        eventRef: "store-source-audit-v1",
      },
      resource,
      accessKind: "WORKER",
      purposeCode: "REPORT_INGESTION",
      verifier: {
        verifierId: "ingestion-audit-ref-verifier",
        verifyAuditRefs: async () => true,
      },
    });
    assert(auditRefs);
    let stored: P0SensitiveAccessEventDraft | null = null;
    const result = await authorizeAndAuditP0SensitiveAccess({
      principal: authenticated,
      scope,
      resource,
      auditRefs,
      accessKind: "WORKER",
      purposeCode: "REPORT_INGESTION",
      authorizer: {
        authorizeSensitiveAccess: async ({ resource }) => ({
          allowed:
            resource.resourceType === "REPORT_INGESTION" &&
            resource.resourceId === "ingestion-v1" &&
            resource.resourceVersion === 3,
          reasonCode: "AUTHORIZED",
        }),
      },
      repository: {
        appendSensitiveAccessEvent: async ({ event }) => {
          stored = event;
          return { disposition: "CREATED" };
        },
        readSensitiveAccessEvent: async () => stored,
      },
    });
    assert.equal(result.allowed, true);
    assert(result.grant);
    assert.equal(result.grant.resource.resourceType, "REPORT_INGESTION");
    assert.equal(result.grant.resource.resourceId, "ingestion-v1");
    assert.equal(result.grant.resource.resourceVersion, 3);
  });

  await check("PII-like raw resource identifiers cannot be attested", async () => {
    const authenticated = await principal(); const scope = p0ScopeFromPrincipal(authenticated); let verifierCalled = false;
    const result = await verifyP0SensitiveResourceRef({ principal: authenticated, scope, candidate: { resourceType: "ARTIFACT", resourceId: "person@example.com", resourceVersion: 1 }, verifier: { verifierId: "resource", verifyResourceRef: async () => { verifierCalled = true; return true; } } });
    assert.equal(result, null); assert.equal(verifierCalled, false);
  });

  process.stdout.write(`${passed}/${passed} PASS p0-phase2a-flags-access-audit\n`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
