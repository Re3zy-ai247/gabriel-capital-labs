import assert from "node:assert/strict";
import {
  p0ScopeFromPrincipal,
  isVerifiedP0Principal,
  verifyP0PrincipalCandidate,
  type P0Principal,
} from "../lib/creditTruth/principal";
import { resolveP0InteractivePrincipal, resolveP0WorkerPrincipal } from "../lib/creditTruth/principalServer";
import { createLocalSyntheticP0Repository } from "../lib/creditTruth/repository";
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

process.env.P0_PHASE2_ENABLED = "true";
process.env.P0_INGESTION_SHADOW_ENABLED = "true";
process.env.P0_PHASE2_KILL_SWITCH = "false";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run(); passed += 1; process.stdout.write(`ok ${passed} - ${name}\n`);
}

async function principal(candidate = {
  actorId: "authenticated-account-7", tenantId: "consumer-7", consumerId: "consumer-7",
  authorizationKind: "DIRECT_CONSUMER" as const, authorizationVersion: "grant-v7",
}): Promise<P0Principal> {
  const value = await verifyP0PrincipalCandidate(candidate, { verifyCandidate: async () => true });
  assert(value); return value;
}

async function gate(authenticated: P0Principal, operationId: string, now = new Date()): Promise<P0Phase2AGatePermit> {
  const scope = p0ScopeFromPrincipal(authenticated);
  const issuedAt = new Date(now.getTime() - 10_000).toISOString();
  const expiresAt = new Date(now.getTime() + 120_000).toISOString();
  const migrationSha256 = "a".repeat(64);
  const repositoryReceipt = await verifyP0RepositoryReadinessReceipt({
    contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION, receiptId: `receipt-${operationId}`,
    receiptKind: "LOCAL_SYNTHETIC", repositoryAdapterId: "local-repository",
    repositoryAdapterVersion: "v1", codeRevision: "local-build", migrationSha256,
    semanticsVersion: "v1", capabilities: P0_REPOSITORY_CAPABILITIES, issuedAt, expiresAt,
  }, { verifierId: "local-verifier", verifyRepositoryReceipt: async () => true });
  assert(repositoryReceipt);
  const cohortDecision = await verifyP0Phase2ACohortDecision({
    contractVersion: "p0-phase2a-flags-v1", decisionId: `cohort-${operationId}`,
    stage: "INGESTION_SHADOW", actorId: authenticated.actorId, tenantId: scope.tenantId,
    consumerId: scope.consumerId, authorizationKind: authenticated.authorizationKind,
    authorizationVersion: authenticated.authorizationVersion, cohortVersion: "local-v1",
    included: true, decidedAt: issuedAt, expiresAt,
  }, { resolverId: "local-cohort", verifyServerResolvedCohort: async () => true });
  assert(cohortDecision);
  const flags = await attestLocalSyntheticP0Phase2AFlags(
    { phase2Enabled: true, killSwitchEngaged: false, ingestionShadowEnabled: true, round0ReviewEnabled: false, assertionRuntimeEnabled: false },
    { attestorId: "local-test-flags", verifyLocalSyntheticFlags: async () => true },
  );
  assert(flags);
  const permit = evaluateAndMintP0Phase2AGatePermit({
    stage: "INGESTION_SHADOW", mode: "LOCAL_BUILD", operationId,
    flags,
    principal: authenticated, scope, cohortDecision,
    readinessEvidence: { migrationVerified: true, migrationSha256, principalBoundaryVerified: true, repositoryBoundaryVerified: true, sourceArtifactBoundaryVerified: true, ingestionBoundaryVerified: true, round0BoundaryVerified: false, assertionBoundaryVerified: false, repositoryReceipt },
  });
  assert(permit); return permit;
}

async function main() {
  await check("direct scope permits a distinct real authenticated actor", async () => {
    const value = await principal();
    assert.equal(value.actorId, "authenticated-account-7");
    assert.equal(value.tenantId, value.consumerId);
    assert.notEqual(value.actorId, value.consumerId);
  });

  await check("direct server resolver rereads exact scope instead of deriving it from actor id", async () => {
    let revalidated = 0;
    const value = await resolveP0InteractivePrincipal({ consumerSelector: "consumer-direct-7", authorizationIntent: "DIRECT_OR_MANAGED" }, {
      resolveAuthenticatedActor: async () => ({ id: "authenticated-account-7", disabled: false, role: "USER", isAgency: false }),
      revalidateDirectConsumerGrant: async ({ actorId }) => {
        revalidated += 1;
        return { kind: "DIRECT_CONSUMER", grantId: "direct-grant-7", actorId, tenantId: "consumer-direct-7", consumerId: "consumer-direct-7", authorizationVersion: "direct-v7", active: true };
      },
      revalidateManagedClientGrant: async () => null,
      revalidateAdminDelegation: async () => null,
      resolveWorkerOperation: async () => null,
    });
    assert(value); assert.equal(revalidated, 1); assert.equal(value.actorId, "authenticated-account-7");
    assert.equal(value.tenantId, "consumer-direct-7"); assert.equal(value.consumerId, "consumer-direct-7");
  });

  await check("managed-client grant revalidation preserves distinct actor tenant and consumer", async () => {
    let revalidated = 0;
    const value = await resolveP0InteractivePrincipal({ consumerSelector: "managed-client-9", authorizationIntent: "DIRECT_OR_MANAGED" }, {
      resolveAuthenticatedActor: async () => ({ id: "agency-user-2", disabled: false, role: "USER", isAgency: true }),
      revalidateDirectConsumerGrant: async () => null,
      revalidateManagedClientGrant: async ({ actorId, consumerId }) => {
        revalidated += 1;
        return { kind: "AGENCY_MANAGED_CLIENT", grantId: "managed-grant-1", actorId, tenantId: "agency-tenant-2", consumerId, authorizationVersion: "managed-v3", active: true };
      },
      revalidateAdminDelegation: async () => null,
      resolveWorkerOperation: async () => null,
    });
    assert(value); assert.equal(revalidated, 1); assert.equal(value.actorId, "agency-user-2");
    assert.equal(value.tenantId, "agency-tenant-2"); assert.equal(value.consumerId, "managed-client-9");
  });

  await check("managed-client authority rejects a consumer self-tenant masquerading as agency scope", async () => {
    const candidate = await verifyP0PrincipalCandidate({ actorId: "agency-user-hostile", tenantId: "same-consumer", consumerId: "same-consumer", authorizationKind: "AGENCY_MANAGED_CLIENT", authorizationVersion: "managed-hostile-v1" }, { verifyCandidate: async () => true });
    assert.equal(candidate, null);
    const resolved = await resolveP0InteractivePrincipal({ consumerSelector: "same-consumer", authorizationIntent: "DIRECT_OR_MANAGED" }, {
      resolveAuthenticatedActor: async () => ({ id: "agency-user-hostile", disabled: false, role: "USER", isAgency: true }),
      revalidateDirectConsumerGrant: async () => null,
      revalidateManagedClientGrant: async ({ actorId, consumerId }) => ({ kind: "AGENCY_MANAGED_CLIENT", grantId: "hostile-managed-grant", actorId, tenantId: consumerId, consumerId, authorizationVersion: "managed-hostile-v1", active: true }),
      revalidateAdminDelegation: async () => null,
      resolveWorkerOperation: async () => null,
    });
    assert.equal(resolved, null);
  });

  await check("worker resolver uses live strict bounded expiry and rejects stale or unbounded grants", async () => {
    const resolve = (expiresAt: string) => resolveP0WorkerPrincipal("worker-operation-1", { resolveWorkerOperation: async () => ({ kind: "SYSTEM_WORKER", operationId: "worker-operation-1", actorId: "worker-actor", tenantId: "agency-tenant", consumerId: "managed-consumer", authorizationVersion: "worker-v1", active: true, expiresAt }) });
    assert.equal(await resolve(new Date(Date.now() - 1_000).toISOString()), null);
    assert.equal(await resolve("2026-02-30T12:00:00.000Z"), null);
    assert.equal(await resolve(new Date(Date.now() + 120_000).toISOString()), null);
  });

  await check("server-resolved worker principal brand expires with its exact grant", async () => {
    const value = await resolveP0WorkerPrincipal("worker-operation-live", { resolveWorkerOperation: async () => ({ kind: "SYSTEM_WORKER", operationId: "worker-operation-live", actorId: "worker-actor", tenantId: "agency-tenant", consumerId: "managed-consumer", authorizationVersion: "worker-v1", active: true, expiresAt: new Date(Date.now() + 1_000).toISOString() }) });
    assert(value); assert.equal(isVerifiedP0Principal(value), true); await new Promise((resolve) => setTimeout(resolve, 1_100)); assert.equal(isVerifiedP0Principal(value), false);
  });

  await check("request-shaped unbranded principal is denied", async () => {
    const repository = createLocalSyntheticP0Repository();
    const forged = { actorId: "actor", tenantId: "consumer", consumerId: "consumer", authorizationKind: "DIRECT_CONSUMER", authorizationVersion: "v1" } as unknown as P0Principal;
    const result = await repository.readExact({ principal: forged, scope: { tenantId: "consumer", consumerId: "consumer" }, purpose: "SHADOW_EXTRACTION_READ", operationId: "read-1" }, { resourceType: "REPORT_INGESTION", resourceId: "row-1", resourceVersion: "1" });
    assert.deepEqual(result, { kind: "DENIED" });
  });

  await check("direct repository write cannot bypass the operation gate", async () => {
    const authenticated = await principal(); const scope = p0ScopeFromPrincipal(authenticated);
    const repository = createLocalSyntheticP0Repository();
    const result = await repository.createExact({ principal: authenticated, scope, purpose: "INGESTION_RESERVE", operationId: "reserve-1" }, { resourceType: "REPORT_INGESTION", resourceId: "row-1", resourceVersion: "1" }, { revision: 1 });
    assert.deepEqual(result, { kind: "DENIED" });
  });

  await check("exact operation permit enables write then authoritative readback", async () => {
    const authenticated = await principal(); const scope = p0ScopeFromPrincipal(authenticated); const now = new Date();
    const permit = await gate(authenticated, "reserve-2", now); const repository = createLocalSyntheticP0Repository();
    const created = await repository.createExact({ principal: authenticated, scope, purpose: "INGESTION_RESERVE", operationId: "reserve-2", gatePermit: permit }, { resourceType: "REPORT_INGESTION", resourceId: "row-2", resourceVersion: "1" }, { revision: 1, state: "RECEIVED" });
    assert.equal(created.kind, "CREATED");
    const read = await repository.readExact({ principal: authenticated, scope, purpose: "INGESTION_RECOVERY", operationId: "read-2" }, { resourceType: "REPORT_INGESTION", resourceId: "row-2", resourceVersion: "1" });
    assert.equal(read.kind, "FOUND");
  });

  await check("permit for a different operation cannot authorize a write", async () => {
    const authenticated = await principal(); const scope = p0ScopeFromPrincipal(authenticated); const now = new Date();
    const permit = await gate(authenticated, "reserve-original", now); const repository = createLocalSyntheticP0Repository();
    const result = await repository.createExact({ principal: authenticated, scope, purpose: "INGESTION_RESERVE", operationId: "reserve-substituted", gatePermit: permit }, { resourceType: "REPORT_INGESTION", resourceId: "row-3", resourceVersion: "1" }, { revision: 1 });
    assert.equal(result.kind, "DENIED");
  });

  await check("cross-tenant scope substitution is denied despite a valid permit", async () => {
    const authenticated = await principal(); const now = new Date(); const permit = await gate(authenticated, "reserve-4", now);
    const repository = createLocalSyntheticP0Repository();
    const result = await repository.createExact({ principal: authenticated, scope: { tenantId: "other", consumerId: "other" }, purpose: "INGESTION_RESERVE", operationId: "reserve-4", gatePermit: permit }, { resourceType: "REPORT_INGESTION", resourceId: "row-4", resourceVersion: "1" }, { revision: 1 });
    assert.equal(result.kind, "DENIED");
  });

  await check("post-write readback mismatch is not reported as success", async () => {
    const authenticated = await principal(); const scope = p0ScopeFromPrincipal(authenticated); const now = new Date(); const permit = await gate(authenticated, "reserve-5", now);
    const repository = createLocalSyntheticP0Repository({ mutateReadback: ({ snapshot }) => ({ ...(snapshot as object), revision: 99 }) });
    const result = await repository.createExact({ principal: authenticated, scope, purpose: "INGESTION_RESERVE", operationId: "reserve-5", gatePermit: permit }, { resourceType: "REPORT_INGESTION", resourceId: "row-5", resourceVersion: "1" }, { revision: 1 });
    assert.equal(result.kind, "OUTCOME_UNKNOWN");
  });

  process.stdout.write(`${passed}/${passed} PASS p0-phase2a-principal-repository\n`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
