import assert from "node:assert/strict";
import type { ObservationBinding } from "../lib/creditTruth/consumerAssertion";
import {
  appendConsumerAssertion,
  computeConsumerAssertionRuntimeIntegritySha256,
  verifyPersistedConsumerAssertionReceipt,
  verifyConsumerAssertionCurrentHead,
  verifiedConsumerAssertionReceiptIsCurrent,
  type ConsumerAssertionRuntimeRecord,
  type ConsumerAssertionRuntimeRepository,
  type ConsumerAssertionSourceRead,
} from "../lib/creditTruth/consumerConfirmationRuntime";
import { attestLocalSyntheticP0Phase2AFlags, evaluateAndMintP0Phase2AGatePermit, verifyP0Phase2ACohortDecision } from "../lib/creditTruth/phase2Flags";
import { P0_PHASE2A_READINESS_CONTRACT_VERSION, P0_REPOSITORY_CAPABILITIES, verifyP0RepositoryReadinessReceipt } from "../lib/creditTruth/phase2Readiness";
import { p0ScopeFromPrincipal, verifyP0PrincipalCandidate } from "../lib/creditTruth/principal";

const NOW = new Date();
const HASH = "c".repeat(64);
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) { await run(); passed += 1; process.stdout.write(`ok ${passed} - ${name}\n`); }

function observation(overrides: Partial<ObservationBinding> = {}): ObservationBinding {
  return { tenantId: "consumer-1", consumerId: "consumer-1", observationId: "observation-1", reportVersionId: "report-v1", extractionRunId: "extract-v1", accountId: "account-1", bureau: "EXPERIAN", field: "detailedStatus", observationSeriesKey: "observation-series-1", observationRevision: 1, observationDigest: HASH, ...overrides };
}
function source(binding = observation()): ConsumerAssertionSourceRead {
  return { repositoryReadId: "source-read-1", observation: binding, assessment: { assessmentId: "assessment-1", tenantId: binding.tenantId, consumerId: binding.consumerId, reportVersionId: binding.reportVersionId, extractionRunId: binding.extractionRunId, accountId: binding.accountId, assessmentVersion: 1, inputSetSha256: HASH } };
}
async function auth(operationId: string) {
  const principal = await verifyP0PrincipalCandidate({ actorId: "actor-1", tenantId: "consumer-1", consumerId: "consumer-1", authorizationKind: "DIRECT_CONSUMER", authorizationVersion: "grant-v1" }, { verifyCandidate: async () => true });
  assert(principal); const scope = p0ScopeFromPrincipal(principal);
  const now = Date.now();
  const receipt = await verifyP0RepositoryReadinessReceipt({ contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION, receiptId: "local", receiptKind: "LOCAL_SYNTHETIC", repositoryAdapterId: "synthetic", repositoryAdapterVersion: "v1", codeRevision: "local", migrationSha256: HASH, semanticsVersion: "v1", capabilities: P0_REPOSITORY_CAPABILITIES, issuedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 3_600_000).toISOString() }, { verifierId: "local", verifyRepositoryReceipt: async () => true });
  assert(receipt);
  const cohort = await verifyP0Phase2ACohortDecision({ contractVersion: "p0-phase2a-flags-v1", decisionId: "cohort-assertion", stage: "ASSERTION_RUNTIME", actorId: principal.actorId, tenantId: scope.tenantId, consumerId: scope.consumerId, authorizationKind: principal.authorizationKind, authorizationVersion: principal.authorizationVersion, cohortVersion: "v1", included: true, decidedAt: new Date(now - 1_000).toISOString(), expiresAt: new Date(now + 600_000).toISOString() }, { resolverId: "server", verifyServerResolvedCohort: async () => true });
  assert(cohort);
  const flags = await attestLocalSyntheticP0Phase2AFlags({ phase2Enabled: true, killSwitchEngaged: false, ingestionShadowEnabled: true, round0ReviewEnabled: true, assertionRuntimeEnabled: true }, { attestorId: "confirmation-test", verifyLocalSyntheticFlags: async () => true }); assert(flags);
  const permit = evaluateAndMintP0Phase2AGatePermit({ stage: "ASSERTION_RUNTIME", mode: "LOCAL_BUILD", operationId, flags, principal, scope, cohortDecision: cohort, readinessEvidence: { migrationVerified: true, migrationSha256: HASH, principalBoundaryVerified: true, repositoryBoundaryVerified: true, sourceArtifactBoundaryVerified: true, ingestionBoundaryVerified: true, round0BoundaryVerified: true, assertionBoundaryVerified: true, repositoryReceipt: receipt } });
  assert(permit); return { principal, scope, gatePermit: permit };
}
function repositoryFor(getSource: () => ConsumerAssertionSourceRead | null) {
  const records = new Map<string, ConsumerAssertionRuntimeRecord>();
  const repository: ConsumerAssertionRuntimeRepository = {
    readConsumerAssertionSource: async () => getSource(),
    readConsumerAssertion: async ({ assertionId }) => records.get(assertionId) ?? null,
    appendConsumerAssertion: async ({ assertion }) => { records.set(assertion.assertionId, assertion); return { disposition: "CREATED" }; },
  };
  return { repository, records };
}

async function currentHead(
  assertion: ConsumerAssertionRuntimeRecord,
  overrides: Partial<{
    headAssertionId: string;
    headVersion: number;
    headIntegritySha256: string;
  }> = {},
) {
  const now = Date.now();
  const head = await verifyConsumerAssertionCurrentHead({
    runtimeVersion: "p0-consumer-confirmation-runtime-v1",
    repositoryReadId: "current-head-read",
    tenantId: assertion.binding.tenantId,
    consumerId: assertion.binding.consumerId,
    assertionSeriesKey: assertion.assertionSeriesKey,
    headAssertionId: overrides.headAssertionId ?? assertion.assertionId,
    headVersion: overrides.headVersion ?? assertion.version,
    headIntegritySha256:
      overrides.headIntegritySha256 ?? assertion.integritySha256,
    supersededByAssertionId: null,
    verifiedAt: new Date(now - 1).toISOString(),
    expiresAt: new Date(now + 30_000).toISOString(),
  }, { verifierId: "current-head-verifier", verifyCurrentHead: async () => true });
  assert(head);
  return head;
}

async function main() {
  Reflect.set(process.env, "NODE_ENV", "test");
  process.env.P0_PHASE2_ENABLED = "true";
  process.env.P0_PHASE2_KILL_SWITCH = "false";
  process.env.P0_INGESTION_SHADOW_ENABLED = "true";
  process.env.P0_ROUND0_REVIEW_ENABLED = "true";
  process.env.P0_ASSERTION_RUNTIME_ENABLED = "true";
  await check("exact observation and assessment append, read back, and attest", async () => {
    const gate = await auth("assert-op-1"); const f = repositoryFor(() => source());
    const result = await appendConsumerAssertion({ ...gate, repository: f.repository, request: { assertionId: "assertion-1", operationId: "assert-op-1", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "CONFIRMED_INACCURATE", assertionSeriesKey: "assertion-series-1", version: 1 } });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.receipt.assertion.integritySha256, /^[0-9a-f]{64}$/);
    assert.equal(result.receipt.semanticSha256, result.receipt.assertion.integritySha256);
    const head = await currentHead(result.receipt.assertion);
    assert(verifiedConsumerAssertionReceiptIsCurrent({ receipt: result.receipt, currentObservation: observation(), currentHead: head }));
    assert.equal(verifiedConsumerAssertionReceiptIsCurrent({ receipt: result.receipt, currentObservation: observation({ observationDigest: "d".repeat(64) }), currentHead: head }), false);
    const obsoleteHead = await currentHead(result.receipt.assertion, { headAssertionId: "new-head", headVersion: 2, headIntegritySha256: "e".repeat(64) });
    assert.equal(verifiedConsumerAssertionReceiptIsCurrent({ receipt: result.receipt, currentObservation: observation(), currentHead: obsoleteHead }), false);
  });

  await check("changed report/run/revision/digest requires reconfirmation", async () => {
    const gate = await auth("assert-op-stale");
    for (const changed of [observation({ reportVersionId: "report-v2" }), observation({ extractionRunId: "extract-v2" }), observation({ observationRevision: 2 }), observation({ observationDigest: "d".repeat(64) })]) {
      const f = repositoryFor(() => source(changed));
      const result = await appendConsumerAssertion({ ...gate, repository: f.repository, request: { assertionId: "stale-assertion", operationId: "assert-op-stale", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "series-stale", version: 1 } });
      assert.deepEqual(result, { ok: false, code: "STALE_SOURCE_RECONFIRMATION_REQUIRED" });
    }
  });

  await check("malformed bureau from request or repository fails closed", async () => {
    const gate = await auth("assert-op-bureau");
    const malformed = observation({ bureau: "OTHER" as ObservationBinding["bureau"] });
    const requestResult = await appendConsumerAssertion({ ...gate, repository: repositoryFor(() => source()).repository, request: { assertionId: "bad-request", operationId: "assert-op-bureau", expectedBinding: malformed, assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "bad-series", version: 1 } });
    assert.deepEqual(requestResult, { ok: false, code: "INVALID_REQUEST" });
    const sourceResult = await appendConsumerAssertion({ ...gate, repository: repositoryFor(() => source(malformed)).repository, request: { assertionId: "bad-source", operationId: "assert-op-bureau", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "bad-series", version: 1 } });
    assert.equal(sourceResult.ok, false);
  });

  await check("gate is exact to operation and cross-scope substitution fails", async () => {
    const gate = await auth("assert-op-exact"); let reads = 0;
    const f = repositoryFor(() => { reads += 1; return source(); });
    const operation = await appendConsumerAssertion({ ...gate, repository: f.repository, request: { assertionId: "gate-op", operationId: "different-op", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "gate-series", version: 1 } });
    assert.deepEqual(operation, { ok: false, code: "GATE_DENIED" });
    assert.equal(reads, 0);
    const scope = { ...gate.scope, consumerId: "consumer-2" };
    const cross = await appendConsumerAssertion({ ...gate, scope, repository: f.repository, request: { assertionId: "cross", operationId: "assert-op-exact", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "cross-series", version: 1 } });
    assert.deepEqual(cross, { ok: false, code: "INVALID_PRINCIPAL_OR_SCOPE" });
  });

  await check("supersession permits evidence revision only for same logical observation", async () => {
    const firstGate = await auth("assert-op-v1"); const current = { value: source() }; const f = repositoryFor(() => current.value);
    const first = await appendConsumerAssertion({ ...firstGate, repository: f.repository, request: { assertionId: "assertion-v1", operationId: "assert-op-v1", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "series-1", version: 1 } }); assert(first.ok);
    const revised = observation({ observationId: "observation-2", reportVersionId: "report-v2", extractionRunId: "extract-v2", observationRevision: 2, observationDigest: "d".repeat(64) }); current.value = source(revised);
    const secondGate = await auth("assert-op-v2");
    const second = await appendConsumerAssertion({ ...secondGate, repository: f.repository, request: { assertionId: "assertion-v2", operationId: "assert-op-v2", expectedBinding: revised, assessmentId: "assessment-1", disposition: "CONFIRMED_ACCURATE", assertionSeriesKey: "series-1", version: 2, supersedesAssertionId: "assertion-v1" } });
    assert.equal(second.ok, true);
  });

  await check("cross-account and cross-bureau supersession are denied", async () => {
    const firstGate = await auth("assert-cross-v1"); const current = { value: source() }; const f = repositoryFor(() => current.value);
    const first = await appendConsumerAssertion({ ...firstGate, repository: f.repository, request: { assertionId: "cross-v1", operationId: "assert-cross-v1", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "cross-series", version: 1 } }); assert(first.ok);
    for (const changed of [observation({ accountId: "account-2" }), observation({ bureau: "EQUIFAX" })]) {
      current.value = source(changed); const nextGate = await auth("assert-cross-v2");
      const next = await appendConsumerAssertion({ ...nextGate, repository: f.repository, request: { assertionId: `cross-v2-${changed.bureau}`, operationId: "assert-cross-v2", expectedBinding: changed, assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "cross-series", version: 2, supersedesAssertionId: "cross-v1" } });
      assert.deepEqual(next, { ok: false, code: "SUPERSESSION_MISMATCH" });
    }
  });

  await check("readback substitution fails semantic attestation", async () => {
    const gate = await auth("assert-readback"); let stored: ConsumerAssertionRuntimeRecord | null = null;
    const repository: ConsumerAssertionRuntimeRepository = { readConsumerAssertionSource: async () => source(), readConsumerAssertion: async () => stored ? { ...stored, operationId: "substituted" } : null, appendConsumerAssertion: async ({ assertion }) => { stored = assertion; return { disposition: "CREATED" }; } };
    const result = await appendConsumerAssertion({ ...gate, repository, request: { assertionId: "readback", operationId: "assert-readback", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "readback-series", version: 1 } });
    assert.deepEqual(result, { ok: false, code: "READBACK_MISMATCH" });
  });

  await check("revoked and expired receipts are never current", async () => {
    const firstGate = await auth("receipt-state-v1");
    const f = repositoryFor(() => source());
    const first = await appendConsumerAssertion({ ...firstGate, repository: f.repository, request: { assertionId: "receipt-state-v1", operationId: "receipt-state-v1", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "receipt-state-series", version: 1 } });
    assert(first.ok);
    const secondGate = await auth("receipt-state-v2");
    const revoked = await appendConsumerAssertion({ ...secondGate, repository: f.repository, request: { assertionId: "receipt-state-v2", operationId: "receipt-state-v2", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVOKED", assertionSeriesKey: "receipt-state-series", version: 2, supersedesAssertionId: "receipt-state-v1" } });
    assert(revoked.ok);
    if (!revoked.ok) return;
    const revokedHead = await currentHead(revoked.receipt.assertion);
    assert.equal(verifiedConsumerAssertionReceiptIsCurrent({ receipt: revoked.receipt, currentObservation: observation(), currentHead: revokedHead }), false);

    if (!first.ok) return;
    const { integritySha256: _priorDigest, ...base } = first.receipt.assertion;
    const expiredBase = { ...base, assertionId: "receipt-expired", operationId: "receipt-expired", assertionSeriesKey: "receipt-expired-series", version: 1, supersedesAssertionId: null, disposition: "CONFIRMED_ACCURATE" as const, confirmedAt: new Date(Date.now() - 120_000).toISOString(), expiresAt: new Date(Date.now() - 60_000).toISOString() };
    const expiredRecord: ConsumerAssertionRuntimeRecord = Object.freeze({ ...expiredBase, integritySha256: computeConsumerAssertionRuntimeIntegritySha256(expiredBase) });
    const expiredReceipt = await verifyPersistedConsumerAssertionReceipt(expiredRecord, { verifierId: "persisted-receipt-verifier", verifyPersistedAssertion: async () => true });
    assert(expiredReceipt);
    const expiredHead = await currentHead(expiredReceipt.assertion);
    assert.equal(verifiedConsumerAssertionReceiptIsCurrent({ receipt: expiredReceipt, currentObservation: observation(), currentHead: expiredHead }), false);
  });

  await check("agency/admin/worker principals cannot append consumer testimony", async () => {
    const direct = await auth("hostile-confirmation");
    for (const authorizationKind of ["AGENCY_MANAGED_CLIENT", "ADMIN_IMPERSONATION", "SYSTEM_WORKER"] as const) {
      const principal = await verifyP0PrincipalCandidate({ actorId: `${authorizationKind}-actor`, tenantId: "tenant-hostile", consumerId: "consumer-1", authorizationKind, authorizationVersion: "grant-v1" }, { verifyCandidate: async () => true });
      assert(principal);
      const scope = p0ScopeFromPrincipal(principal);
      const result = await appendConsumerAssertion({ principal, scope, gatePermit: direct.gatePermit, repository: repositoryFor(() => source()).repository, request: { assertionId: "hostile", operationId: "hostile-confirmation", expectedBinding: observation({ tenantId: scope.tenantId, consumerId: scope.consumerId }), assessmentId: "assessment-1", disposition: "CONFIRMED_INACCURATE", assertionSeriesKey: "hostile-series", version: 1 } });
      assert.deepEqual(result, { ok: false, code: "CONSUMER_AUTHORITY_REQUIRED" });
    }
  });

  await check("live kill switch rejects a retained pre-kill permit before source read", async () => {
    const gate = await auth("retained-permit");
    let reads = 0;
    const f = repositoryFor(() => { reads += 1; return source(); });
    process.env.P0_PHASE2_KILL_SWITCH = "true";
    const result = await appendConsumerAssertion({ ...gate, repository: f.repository, request: { assertionId: "retained", operationId: "retained-permit", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "REVIEW_NEEDED", assertionSeriesKey: "retained-series", version: 1 } });
    process.env.P0_PHASE2_KILL_SWITCH = "false";
    assert.deepEqual(result, { ok: false, code: "GATE_DENIED" });
    assert.equal(reads, 0);
  });

  await check("caller backdate/future expiry fields cannot control durable chronology", async () => {
    const gate = await auth("timestamp-attack"); const f = repositoryFor(() => source());
    const attackedRequest = { assertionId: "timestamp-attack", operationId: "timestamp-attack", expectedBinding: observation(), assessmentId: "assessment-1", disposition: "CONFIRMED_ACCURATE", assertionSeriesKey: "timestamp-series", version: 1, confirmedAt: "2000-01-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" } as unknown as Parameters<typeof appendConsumerAssertion>[0]["request"];
    const result = await appendConsumerAssertion({ ...gate, repository: f.repository, request: attackedRequest });
    assert(result.ok);
    if (result.ok) {
      assert.equal(result.receipt.assertion.confirmedAt, gate.gatePermit.issuedAt);
      assert.equal(result.receipt.assertion.expiresAt, null);
    }
  });

  process.stdout.write(`${passed}/${passed} PASS p0-phase2a-confirmation\n`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
