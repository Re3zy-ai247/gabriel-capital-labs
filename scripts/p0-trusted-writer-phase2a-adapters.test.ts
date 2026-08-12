import assert from "node:assert/strict";
import {
  createP0PrismaSensitiveAccessRepository,
} from "../lib/creditTruth/prismaSensitiveAccessRepository";
import {
  createP0PrismaConsumerConfirmationRepository,
} from "../lib/creditTruth/prismaConsumerConfirmationRepository";
import {
  createP0PrismaCaseActionRepository,
} from "../lib/creditTruth/prismaCaseActionRepository";
import {
  createP0PrismaRound0Repositories,
} from "../lib/creditTruth/prismaRound0Repository";
import { appendConsumerAssertion } from "../lib/creditTruth/consumerConfirmationRuntime";
import {
  appendCaseActionDecision,
  computeCaseActionSourceSetSha256,
} from "../lib/creditTruth/caseActionDecision";
import {
  attestLocalSyntheticP0Phase2AFlags,
  evaluateAndMintP0Phase2AGatePermit,
  verifyP0Phase2ACohortDecision,
} from "../lib/creditTruth/phase2Flags";
import {
  P0_PHASE2A_READINESS_CONTRACT_VERSION,
  P0_REPOSITORY_CAPABILITIES,
  verifyP0RepositoryReadinessReceipt,
} from "../lib/creditTruth/phase2Readiness";
import {
  p0ScopeFromPrincipal,
  verifyP0PrincipalCandidate,
} from "../lib/creditTruth/principal";

const HASH = "a".repeat(64);
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return (expected as any[]).some((item) => matches(row, item));
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if ("in" in (expected as any)) return (expected as any).in.includes(row[key]);
      return matches(row[key], expected);
    }
    return row[key] === expected;
  });
}

function delegate(rows: any[]) {
  return {
    async findFirst({ where }: any) { return rows.find((row) => matches(row, where)) ?? null; },
    async findMany({ where, orderBy }: any = {}) {
      const found = rows.filter((row) => matches(row, where));
      const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
      return found.sort((left, right) => {
        for (const order of orders) {
          const [key, direction] = Object.entries(order)[0] as [string, string];
          if (left[key] < right[key]) return direction === "desc" ? 1 : -1;
          if (left[key] > right[key]) return direction === "desc" ? -1 : 1;
        }
        return 0;
      });
    },
    async create({ data }: any) { const row = { id: data.id ?? `generated-${rows.length + 1}`, ...data }; rows.push(row); return row; },
  };
}

async function gate(operationId: string, stage: "ROUND0_REVIEW" | "ASSERTION_RUNTIME") {
  const principal = await verifyP0PrincipalCandidate({
    actorId: "consumer-1", tenantId: "consumer-1", consumerId: "consumer-1",
    authorizationKind: "DIRECT_CONSUMER", authorizationVersion: "grant-v1",
  }, { verifyCandidate: async () => true });
  assert(principal);
  const scope = p0ScopeFromPrincipal(principal);
  const now = Date.now();
  const receipt = await verifyP0RepositoryReadinessReceipt({
    contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION,
    receiptId: "local-adapters", receiptKind: "LOCAL_SYNTHETIC",
    repositoryAdapterId: "p0-prisma-adapter-test", repositoryAdapterVersion: "v1",
    codeRevision: "local", migrationSha256: HASH, semanticsVersion: "v1",
    capabilities: P0_REPOSITORY_CAPABILITIES,
    issuedAt: new Date(now - 1_000).toISOString(), expiresAt: new Date(now + 60_000).toISOString(),
  }, { verifierId: "local", verifyRepositoryReceipt: async () => true });
  assert(receipt);
  const cohort = await verifyP0Phase2ACohortDecision({
    contractVersion: "p0-phase2a-flags-v1", decisionId: `cohort-${operationId}`,
    stage, actorId: principal.actorId, tenantId: scope.tenantId, consumerId: scope.consumerId,
    authorizationKind: principal.authorizationKind, authorizationVersion: principal.authorizationVersion,
    cohortVersion: "v1", included: true, decidedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
  }, { resolverId: "server-test", verifyServerResolvedCohort: async () => true });
  assert(cohort);
  const flags = await attestLocalSyntheticP0Phase2AFlags({
    phase2Enabled: true, killSwitchEngaged: false, ingestionShadowEnabled: true,
    round0ReviewEnabled: true, assertionRuntimeEnabled: true,
  }, { attestorId: "adapter-test", verifyLocalSyntheticFlags: async () => true });
  assert(flags);
  const gatePermit = evaluateAndMintP0Phase2AGatePermit({
    stage, mode: "LOCAL_BUILD", operationId, flags, principal, scope,
    cohortDecision: cohort,
    readinessEvidence: {
      migrationVerified: true, migrationSha256: HASH, principalBoundaryVerified: true,
      repositoryBoundaryVerified: true, sourceArtifactBoundaryVerified: true,
      ingestionBoundaryVerified: true, round0BoundaryVerified: true,
      assertionBoundaryVerified: true, repositoryReceipt: receipt,
    },
  });
  assert(gatePermit);
  return { principal, scope, gatePermit };
}

function client(transaction: any) {
  return {
    async $transaction<T>(work: (value: any) => Promise<T>, options?: any): Promise<T> {
      assert.equal(options?.isolationLevel, "Serializable");
      transaction.inTransaction = true;
      try { return await work(transaction); } finally { transaction.inTransaction = false; }
    },
  };
}

async function main() {
  Reflect.set(process.env, "NODE_ENV", "test");
  process.env.P0_PHASE2_ENABLED = "true";
  process.env.P0_PHASE2_KILL_SWITCH = "false";
  process.env.P0_INGESTION_SHADOW_ENABLED = "true";
  process.env.P0_ROUND0_REVIEW_ENABLED = "true";
  process.env.P0_ASSERTION_RUNTIME_ENABLED = "true";
  const auth = await gate("audit-op", "ROUND0_REVIEW");

  await check("sensitive audit append revalidates live scope in its serializable transaction", async () => {
    const rows: any[] = [];
    const tx: any = { inTransaction: false, p0SensitiveAccessEvent: delegate(rows) };
    let revalidations = 0;
    const repository = createP0PrismaSensitiveAccessRepository({
      client: client(tx),
      principalRevalidator: { async revalidateInTransaction({ transaction, principal, scope }) {
        revalidations += 1; return transaction.inTransaction && principal === auth.principal && scope === auth.scope;
      } },
    });
    const event = Object.freeze({
      eventKey: `p0evt_${"1".repeat(64)}`, correlationId: `p0corr_${"2".repeat(64)}`,
      actorId: auth.principal.actorId, tenantId: auth.scope.tenantId, consumerId: auth.scope.consumerId,
      authorizationKind: auth.principal.authorizationKind, authorizationVersion: auth.principal.authorizationVersion,
      accessKind: "PREVIEW" as const, purposeCode: "ROUND0_REVIEW" as const,
      decision: "ALLOW" as const, decisionCode: "AUTHORIZED" as const,
      resourceType: "REPORT_VERSION" as const, resourceId: "report-v1", resourceVersion: 1,
      occurredAt: new Date().toISOString(),
    });
    assert.deepEqual(await repository.appendSensitiveAccessEvent({ ...auth, operationId: "audit-op", purpose: "SENSITIVE_ACCESS_AUDIT_APPEND", event }), { disposition: "CREATED" });
    assert.deepEqual(await repository.appendSensitiveAccessEvent({ ...auth, operationId: "audit-op", purpose: "SENSITIVE_ACCESS_AUDIT_APPEND", event }), { disposition: "IDEMPOTENT_REPLAY" });
    assert.equal(rows.length, 1);
    assert.equal(revalidations, 2);
  });

  await check("sensitive audit rejects caller-forged actor authority before persistence", async () => {
    const tx: any = { p0SensitiveAccessEvent: delegate([]) };
    const repository = createP0PrismaSensitiveAccessRepository({ client: client(tx), principalRevalidator: { revalidateInTransaction: async () => true } });
    await assert.rejects(() => repository.appendSensitiveAccessEvent({
      ...auth, operationId: "audit-op", purpose: "SENSITIVE_ACCESS_AUDIT_APPEND",
      event: { eventKey: `p0evt_${"3".repeat(64)}`, correlationId: `p0corr_${"4".repeat(64)}`, actorId: "attacker", tenantId: auth.scope.tenantId,
        consumerId: auth.scope.consumerId, authorizationKind: auth.principal.authorizationKind,
        authorizationVersion: auth.principal.authorizationVersion, accessKind: "PREVIEW", purposeCode: "ROUND0_REVIEW",
        decision: "ALLOW", decisionCode: "AUTHORIZED", resourceType: "REPORT_VERSION", resourceId: "report-v1",
        resourceVersion: 1, occurredAt: new Date().toISOString() },
    }), /authority denied/);
  });

  await check("consumer assertion adapter rereads exact PRESENT observation and assessment", async () => {
    const observationRows: any[] = [{
      id: "obs-1", tenantId: "consumer-1", consumerId: "consumer-1", reportVersionId: "report-v1",
      extractionRunId: "run-1", accountId: "account-1", bureau: "EXPERIAN", fieldKey: "summaryStatus",
      observationSeriesKey: "obs-series", revision: 1, integritySha256: "b".repeat(64),
      sourceLocatorToken: "loc-1", presence: "PRESENT", coverageStatus: "COVERED", sectionStatus: "COMPLETE",
    }];
    const assessmentRows: any[] = [{ id: "assessment-1", tenantId: "consumer-1", consumerId: "consumer-1",
      reportVersionId: "report-v1", extractionRunId: "run-1", accountId: "account-1",
      assessmentVersion: 1, inputSetSha256: "c".repeat(64) }];
    const assertionRows: any[] = [];
    const tx: any = {
      fieldObservation: delegate(observationRows), derivedAccountAssessment: delegate(assessmentRows),
      consumerAssertion: delegate(assertionRows),
    };
    const assertionGate = await gate("assertion-op", "ASSERTION_RUNTIME");
    const repository = createP0PrismaConsumerConfirmationRepository({ client: client(tx), principalRevalidator: { revalidateInTransaction: async ({ transaction }) => transaction.inTransaction } });
    const result = await appendConsumerAssertion({ ...assertionGate, repository, request: {
      assertionId: "assertion-1", operationId: "assertion-op", assessmentId: "assessment-1",
      disposition: "CONFIRMED_INACCURATE", assertionSeriesKey: "assertion-series", version: 1,
      expectedBinding: { tenantId: "consumer-1", consumerId: "consumer-1", observationId: "obs-1",
        reportVersionId: "report-v1", extractionRunId: "run-1", accountId: "account-1",
        bureau: "EXPERIAN", field: "summaryStatus", observationSeriesKey: "obs-series",
        observationRevision: 1, observationDigest: "b".repeat(64) },
    } });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(assertionRows.length, 1);
  });

  await check("consumer assertion adapter denies ABSENT_CONFIRMED as testimony authority", async () => {
    const tx: any = {
      fieldObservation: delegate([{ id: "obs-absent", tenantId: "consumer-1", consumerId: "consumer-1",
        reportVersionId: "report-v1", extractionRunId: "run-1", accountId: "account-1", bureau: "EXPERIAN",
        fieldKey: "summaryStatus", observationSeriesKey: "series", revision: 1, integritySha256: HASH,
        sourceLocatorToken: "loc", presence: "ABSENT_CONFIRMED", coverageStatus: "COVERED", sectionStatus: "COMPLETE" }]),
      derivedAccountAssessment: delegate([]), consumerAssertion: delegate([]),
    };
    const repository = createP0PrismaConsumerConfirmationRepository({ client: client(tx), principalRevalidator: { revalidateInTransaction: async () => true } });
    assert.equal(await repository.readConsumerAssertionSource({ ...auth, purpose: "CONSUMER_ASSERTION_SOURCE_READ", observationId: "obs-absent", assessmentId: "missing" }), null);
  });

  await check("case action adapter resolves source from exact tenant/report/case and verifies readback", async () => {
    const fieldRows: any[] = [{ id: "field-1", tenantId: "consumer-1", consumerId: "consumer-1",
      reportVersionId: "report-v1", presence: "PRESENT", revision: 1, bureau: "EXPERIAN", integritySha256: "d".repeat(64) }];
    const decisionRows: any[] = [];
    const sourceRows: any[] = [];
    const empty = () => delegate([]);
    const tx: any = {
      disputeCase: delegate([{ id: "case-1", tenantId: "consumer-1", consumerId: "consumer-1", reportVersionId: "report-v1" }]),
      fieldObservation: delegate(fieldRows), derivedAccountAssessment: empty(), consumerAssertion: empty(),
      consumerAccountReviewReceipt: empty(), identityFact: empty(), identityBaseline: empty(),
      identityCorrespondenceAssertion: empty(), identityCategoryCompletion: empty(),
      caseActionDecision: delegate(decisionRows), caseActionSourceRef: delegate(sourceRows),
    };
    const actionGate = await gate("action-op", "ROUND0_REVIEW");
    const repository = createP0PrismaCaseActionRepository({ client: client(tx), principalRevalidator: { revalidateInTransaction: async ({ transaction }) => transaction.inTransaction } });
    const sources = [{ sourceType: "FIELD_OBSERVATION" as const, sourceId: "field-1", sourceVersion: 1, bureau: "EXPERIAN" as const, integritySha256: "d".repeat(64) }];
    const result = await appendCaseActionDecision({ ...actionGate, repository, request: {
      decisionId: "decision-1", operationId: "action-op", reportVersionId: "report-v1", caseId: "case-1",
      actionCode: "REVIEW_ACCOUNT_FACT", state: "PROPOSED", chronologyRound: 1,
      sourceSelectors: [{ sourceType: "FIELD_OBSERVATION", sourceId: "field-1" }],
      expectedSourceCount: 1, expectedSourceSetSha256: computeCaseActionSourceSetSha256(sources),
      decisionSeriesKey: "decision-series", version: 1,
    } });
    assert.equal(result.ok, true);
    assert.equal(decisionRows.length, 1);
    assert.equal(sourceRows.length, 1);
  });

  await check("case action adapter denies a report selector outside the exact tenant scope", async () => {
    const empty = () => delegate([]);
    const tx: any = { disputeCase: delegate([{ id: "case-1", tenantId: "other", consumerId: "other", reportVersionId: "report-v1" }]),
      fieldObservation: empty(), derivedAccountAssessment: empty(), consumerAssertion: empty(), consumerAccountReviewReceipt: empty(),
      identityFact: empty(), identityBaseline: empty(), identityCorrespondenceAssertion: empty(), identityCategoryCompletion: empty(),
      caseActionDecision: empty(), caseActionSourceRef: empty() };
    const repository = createP0PrismaCaseActionRepository({ client: client(tx), principalRevalidator: { revalidateInTransaction: async () => true } });
    assert.deepEqual(await repository.readCaseActionSourceSet({ ...auth, purpose: "CASE_ACTION_SOURCE_READ", reportVersionId: "report-v1", caseId: "case-1", sourceSelectors: [] }), []);
  });

  await check("Round 0 adapters invoke live revalidation before any scoped Prisma read", async () => {
    let reads = 0;
    const tx: any = { inTransaction: false };
    Object.defineProperty(tx, "identityBaseline", {
      get() { reads += 1; throw new Error("query should not run"); },
    });
    const repositories = createP0PrismaRound0Repositories({ client: client(tx), principalRevalidator: { revalidateInTransaction: async ({ transaction }) => transaction.inTransaction && false } });
    assert.equal(await repositories.round0.readRound0Baseline({ ...auth, purpose: "ROUND0_BASELINE_SOURCE_READ", identityBaselineId: "baseline-1" }), null);
    assert.equal(reads, 0);
  });

  process.stdout.write(`1..${passed}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
