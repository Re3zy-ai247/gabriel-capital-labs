import assert from "node:assert/strict";
import {
  CASE_ACTION_SOURCE_TYPES,
  appendCaseActionDecision,
  caseActionDecisionContainsForbiddenAuthority,
  computeCaseActionSourceSetSha256,
  type CaseActionDecisionRecord,
  type CaseActionDecisionRepository,
  type CaseActionSourceRef,
} from "../lib/creditTruth/caseActionDecision";
import { attestLocalSyntheticP0Phase2AFlags, evaluateAndMintP0Phase2AGatePermit, verifyP0Phase2ACohortDecision } from "../lib/creditTruth/phase2Flags";
import { P0_PHASE2A_READINESS_CONTRACT_VERSION, P0_REPOSITORY_CAPABILITIES, verifyP0RepositoryReadinessReceipt } from "../lib/creditTruth/phase2Readiness";
import { p0ScopeFromPrincipal, verifyP0PrincipalCandidate } from "../lib/creditTruth/principal";

const NOW = new Date();
const HASH = "d".repeat(64);
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) { await run(); passed += 1; process.stdout.write(`ok ${passed} - ${name}\n`); }
function sources(): CaseActionSourceRef[] {
  return CASE_ACTION_SOURCE_TYPES.map((sourceType, index) => ({ sourceType, sourceId: `source-${index + 1}`, sourceVersion: 1, bureau: sourceType === "CONSUMER_ACCOUNT_REVIEW" || index % 2 === 0 ? "EXPERIAN" : null, integritySha256: String((index + 1) % 10).repeat(64) }));
}
async function auth(operationId: string, authorizationKind: "DIRECT_CONSUMER" | "AGENCY_MANAGED_CLIENT" | "ADMIN_IMPERSONATION" | "SYSTEM_WORKER" = "DIRECT_CONSUMER") {
  const principal = await verifyP0PrincipalCandidate({ actorId: `${authorizationKind}-actor`, tenantId: authorizationKind === "DIRECT_CONSUMER" ? "consumer-1" : "tenant-1", consumerId: "consumer-1", authorizationKind, authorizationVersion: "grant-v1" }, { verifyCandidate: async () => true }); assert(principal);
  const scope = p0ScopeFromPrincipal(principal);
  const now = Date.now();
  const receipt = await verifyP0RepositoryReadinessReceipt({ contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION, receiptId: "local", receiptKind: "LOCAL_SYNTHETIC", repositoryAdapterId: "synthetic", repositoryAdapterVersion: "v1", codeRevision: "local", migrationSha256: HASH, semanticsVersion: "v1", capabilities: P0_REPOSITORY_CAPABILITIES, issuedAt: new Date(now - 60_000).toISOString(), expiresAt: new Date(now + 3_600_000).toISOString() }, { verifierId: "local", verifyRepositoryReceipt: async () => true }); assert(receipt);
  const cohort = await verifyP0Phase2ACohortDecision({ contractVersion: "p0-phase2a-flags-v1", decisionId: `cohort-round0-${authorizationKind}`, stage: "ROUND0_REVIEW", actorId: principal.actorId, tenantId: scope.tenantId, consumerId: scope.consumerId, authorizationKind: principal.authorizationKind, authorizationVersion: principal.authorizationVersion, cohortVersion: "v1", included: true, decidedAt: new Date(now - 1_000).toISOString(), expiresAt: new Date(now + 600_000).toISOString() }, { resolverId: "server", verifyServerResolvedCohort: async () => true }); assert(cohort);
  const flags = await attestLocalSyntheticP0Phase2AFlags({ phase2Enabled: true, killSwitchEngaged: false, ingestionShadowEnabled: true, round0ReviewEnabled: true, assertionRuntimeEnabled: true }, { attestorId: "action-test", verifyLocalSyntheticFlags: async () => true }); assert(flags);
  const gatePermit = evaluateAndMintP0Phase2AGatePermit({ stage: "ROUND0_REVIEW", mode: "LOCAL_BUILD", operationId, flags, principal, scope, cohortDecision: cohort, readinessEvidence: { migrationVerified: true, migrationSha256: HASH, principalBoundaryVerified: true, repositoryBoundaryVerified: true, sourceArtifactBoundaryVerified: true, ingestionBoundaryVerified: true, round0BoundaryVerified: true, assertionBoundaryVerified: true, repositoryReceipt: receipt } }); assert(gatePermit);
  return { principal, scope, gatePermit };
}
function fixture(sourceSet = sources()) {
  const records = new Map<string, CaseActionDecisionRecord>();
  const repository: CaseActionDecisionRepository = {
    readCaseActionSourceSet: async () => sourceSet,
    readCaseActionDecision: async ({ decisionId }) => records.get(decisionId) ?? null,
    appendCaseActionDecision: async ({ decision }) => { records.set(decision.decisionId, decision); return { disposition: "CREATED" }; },
    verifyCurrentCaseActionAssertionSource: async () => true,
    verifyCurrentCaseActionAccountReviewSource: async () => true,
    verifyCurrentCaseActionIdentityCategoryCompletionSource: async () => true,
  };
  return { repository, records };
}
function request(operationId: string, sourceSet = sources()) {
  return { decisionId: "decision-v1", operationId, reportVersionId: "report-v1", caseId: "case-1", actionCode: "REVIEW_ACCOUNT_FACT" as const, state: "PROPOSED" as const, chronologyRound: 1, sourceSelectors: sourceSet.map(({ sourceType, sourceId }) => ({ sourceType, sourceId })), expectedSourceCount: sourceSet.length, expectedSourceSetSha256: computeCaseActionSourceSetSha256(sourceSet), decisionSeriesKey: "decision-series-1", version: 1 };
}

async function main() {
  Reflect.set(process.env, "NODE_ENV", "test");
  process.env.P0_PHASE2_ENABLED = "true";
  process.env.P0_PHASE2_KILL_SWITCH = "false";
  process.env.P0_INGESTION_SHADOW_ENABLED = "true";
  process.env.P0_ROUND0_REVIEW_ENABLED = "true";
  process.env.P0_ASSERTION_RUNTIME_ENABLED = "true";
  await check("all seven normalized source types are exact durable members", async () => {
    const gate = await auth("action-op-1"); const sourceSet = sources(); const f = fixture(sourceSet);
    const result = await appendCaseActionDecision({ ...gate, repository: f.repository, request: request("action-op-1", sourceSet) });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(new Set(result.decision.sourceSet.map((value) => value.sourceType)), new Set(CASE_ACTION_SOURCE_TYPES));
    assert.equal(result.decision.sourceSetSha256, computeCaseActionSourceSetSha256(sourceSet));
    assert.equal(result.decision.chronologyAuthority, "ORDERING_ONLY_NOT_POLICY_AUTHORITY");
    assert.equal(result.decision.decidedAt, gate.gatePermit.issuedAt);
    assert.equal(caseActionDecisionContainsForbiddenAuthority(result.decision), false);
  });

  await check("source digest is order independent but integrity sensitive", () => {
    const sourceSet = sources();
    assert.equal(computeCaseActionSourceSetSha256(sourceSet), computeCaseActionSourceSetSha256([...sourceSet].reverse()));
    assert.notEqual(computeCaseActionSourceSetSha256(sourceSet), computeCaseActionSourceSetSha256(sourceSet.map((source, index) => index === 0 ? { ...source, integritySha256: "e".repeat(64) } : source)));
  });

  await check("duplicate or substituted source membership fails closed", async () => {
    const gate = await auth("action-source-mismatch"); const sourceSet = sources();
    const missing = fixture(sourceSet.slice(1));
    const result = await appendCaseActionDecision({ ...gate, repository: missing.repository, request: request("action-source-mismatch", sourceSet) });
    assert.deepEqual(result, { ok: false, code: "SOURCE_SET_MISMATCH" });
    const duplicateRequest = request("action-source-mismatch", sourceSet);
    const duplicate = { ...duplicateRequest, sourceSelectors: [duplicateRequest.sourceSelectors[0]!, duplicateRequest.sourceSelectors[0]!] };
    const duplicateResult = await appendCaseActionDecision({ ...gate, repository: fixture([sourceSet[0]!, sourceSet[0]!]).repository, request: duplicate });
    assert.equal(duplicateResult.ok, false);
  });

  await check("decision state changes are append-only exact supersessions", async () => {
    const sourceSet = [sources().find((source) => source.sourceType === "CONSUMER_ASSERTION")!]; const f = fixture(sourceSet);
    const firstGate = await auth("action-v1");
    const first = await appendCaseActionDecision({ ...firstGate, repository: f.repository, request: { ...request("action-v1", sourceSet), decisionId: "decision-v1", actionCode: "REQUEST_ACCOUNT_CORRECTION" } }); assert(first.ok);
    const secondGate = await auth("action-v2");
    const second = await appendCaseActionDecision({ ...secondGate, repository: f.repository, request: { ...request("action-v2", sourceSet), decisionId: "decision-v2", actionCode: "REQUEST_ACCOUNT_CORRECTION", state: "CONSUMER_SELECTED", version: 2, supersedesDecisionId: "decision-v1" } });
    assert.equal(second.ok, true);
    assert.equal(f.records.get("decision-v1")?.state, "PROPOSED");
    assert.equal(f.records.get("decision-v2")?.state, "CONSUMER_SELECTED");

    const terminalGate = await auth("action-v3-terminal");
    const terminalRewrite = await appendCaseActionDecision({ ...terminalGate, repository: f.repository, request: { ...request("action-v3-terminal", sourceSet), decisionId: "decision-v3", actionCode: "REQUEST_ACCOUNT_CORRECTION", state: "WAITING", version: 3, supersedesDecisionId: "decision-v2" } });
    assert.deepEqual(terminalRewrite, { ok: false, code: "SUPERSESSION_MISMATCH" });

    const waitingFixture = fixture(sourceSet);
    const waitingProposalGate = await auth("action-waiting-v1");
    assert((await appendCaseActionDecision({ ...waitingProposalGate, repository: waitingFixture.repository, request: { ...request("action-waiting-v1", sourceSet), decisionId: "waiting-v1", actionCode: "REQUEST_ACCOUNT_CORRECTION", decisionSeriesKey: "waiting-series" } })).ok);
    const waitingGate = await auth("action-waiting-v2");
    assert((await appendCaseActionDecision({ ...waitingGate, repository: waitingFixture.repository, request: { ...request("action-waiting-v2", sourceSet), decisionId: "waiting-v2", actionCode: "REQUEST_ACCOUNT_CORRECTION", state: "WAITING", decisionSeriesKey: "waiting-series", version: 2, supersedesDecisionId: "waiting-v1" } })).ok);
    const selectedGate = await auth("action-waiting-v3");
    assert((await appendCaseActionDecision({ ...selectedGate, repository: waitingFixture.repository, request: { ...request("action-waiting-v3", sourceSet), decisionId: "waiting-v3", actionCode: "REQUEST_ACCOUNT_CORRECTION", state: "CONSUMER_SELECTED", decisionSeriesKey: "waiting-series", version: 3, supersedesDecisionId: "waiting-v2" } })).ok);
  });

  await check("version one cannot claim consumer selection or legal authority", async () => {
    const gate = await auth("action-bad-v1"); const sourceSet = [sources().find((source) => source.sourceType === "CONSUMER_ASSERTION")!]; const f = fixture(sourceSet);
    const selected = await appendCaseActionDecision({ ...gate, repository: f.repository, request: { ...request("action-bad-v1", sourceSet), actionCode: "REQUEST_ACCOUNT_CORRECTION", state: "CONSUMER_SELECTED" } });
    assert.deepEqual(selected, { ok: false, code: "SUPERSESSION_MISMATCH" });
    assert.equal(caseActionDecisionContainsForbiddenAuthority({ policyEligible: true }), true);
    assert.equal(caseActionDecisionContainsForbiddenAuthority({ correspondenceRecipient: "CRA" }), true);
  });

  await check("operation-mismatched gate blocks before repository read", async () => {
    const gate = await auth("permitted-action"); let reads = 0;
    const f = fixture(); f.repository.readCaseActionSourceSet = async () => { reads += 1; return sources(); };
    const result = await appendCaseActionDecision({ ...gate, repository: f.repository, request: request("different-action") });
    assert.deepEqual(result, { ok: false, code: "GATE_DENIED" });
    assert.equal(reads, 0);
  });

  await check("expected source count and canonical seal are exact", async () => {
    const gate = await auth("action-seal"); const sourceSet = sources(); const f = fixture(sourceSet);
    const wrongCount = await appendCaseActionDecision({ ...gate, repository: f.repository, request: { ...request("action-seal", sourceSet), expectedSourceCount: sourceSet.length - 1 } });
    assert.deepEqual(wrongCount, { ok: false, code: "INVALID_REQUEST" });
    const wrongSeal = await appendCaseActionDecision({ ...gate, repository: f.repository, request: { ...request("action-seal", sourceSet), expectedSourceSetSha256: "e".repeat(64) } });
    assert.deepEqual(wrongSeal, { ok: false, code: "SOURCE_SET_MISMATCH" });
  });

  await check("selected correction requires a current assertion on the current baseline", async () => {
    const accountSource = [sources().find((source) => source.sourceType === "CONSUMER_ASSERTION")!];
    const accountFixture = fixture(accountSource);
    const firstGate = await auth("account-proposal");
    const first = await appendCaseActionDecision({ ...firstGate, repository: accountFixture.repository, request: { ...request("account-proposal", accountSource), decisionId: "account-v1", actionCode: "REQUEST_ACCOUNT_CORRECTION", decisionSeriesKey: "account-series" } }); assert(first.ok);
    accountFixture.repository.verifyCurrentCaseActionAssertionSource = async () => false;
    const selectedGate = await auth("account-selected");
    const stale = await appendCaseActionDecision({ ...selectedGate, repository: accountFixture.repository, request: { ...request("account-selected", accountSource), decisionId: "account-v2", actionCode: "REQUEST_ACCOUNT_CORRECTION", state: "CONSUMER_SELECTED", decisionSeriesKey: "account-series", version: 2, supersedesDecisionId: "account-v1" } });
    assert.deepEqual(stale, { ok: false, code: "SOURCE_SET_MISMATCH" });

    const identitySource = [sources().find((source) => source.sourceType === "IDENTITY_CORRESPONDENCE_ASSERTION")!];
    const identityFixture = fixture(identitySource);
    const identityProposalGate = await auth("identity-proposal");
    const identityProposal = await appendCaseActionDecision({ ...identityProposalGate, repository: identityFixture.repository, request: { ...request("identity-proposal", identitySource), decisionId: "identity-v1", actionCode: "REQUEST_IDENTITY_CORRECTION", decisionSeriesKey: "identity-series" } }); assert(identityProposal.ok);
    const identitySelectedGate = await auth("identity-selected");
    const identitySelected = await appendCaseActionDecision({ ...identitySelectedGate, repository: identityFixture.repository, request: { ...request("identity-selected", identitySource), decisionId: "identity-v2", actionCode: "REQUEST_IDENTITY_CORRECTION", state: "CONSUMER_SELECTED", decisionSeriesKey: "identity-series", version: 2, supersedesDecisionId: "identity-v1" } });
    assert.equal(identitySelected.ok, true);

    const supersededBaselineFixture = fixture(identitySource);
    const supersededProposalGate = await auth("identity-baseline-v2-proposal");
    assert((await appendCaseActionDecision({ ...supersededProposalGate, repository: supersededBaselineFixture.repository, request: { ...request("identity-baseline-v2-proposal", identitySource), decisionId: "identity-baseline-v2-action", actionCode: "REQUEST_IDENTITY_CORRECTION", decisionSeriesKey: "identity-baseline-series" } })).ok);
    // The assertion itself is immutable/current in its own series, but its v2
    // confirmed IdentityBaseline has been superseded by v3.
    supersededBaselineFixture.repository.verifyCurrentCaseActionAssertionSource = async () => false;
    const supersededSelectedGate = await auth("identity-baseline-v3-selected");
    const supersededSelected = await appendCaseActionDecision({ ...supersededSelectedGate, repository: supersededBaselineFixture.repository, request: { ...request("identity-baseline-v3-selected", identitySource), decisionId: "identity-baseline-v3-action", actionCode: "REQUEST_IDENTITY_CORRECTION", state: "CONSUMER_SELECTED", decisionSeriesKey: "identity-baseline-series", version: 2, supersedesDecisionId: "identity-baseline-v2-action" } });
    assert.deepEqual(supersededSelected, { ok: false, code: "SOURCE_SET_MISMATCH" });
  });

  await check("superseded account-review membership stales identity action before baseline v3", async () => {
    const identitySource = [
      sources().find(
        (source) => source.sourceType === "IDENTITY_CORRESPONDENCE_ASSERTION",
      )!,
    ];
    const f = fixture(identitySource);
    const proposalGate = await auth("identity-membership-v2-proposal");
    const proposal = await appendCaseActionDecision({
      ...proposalGate,
      repository: f.repository,
      request: {
        ...request("identity-membership-v2-proposal", identitySource),
        decisionId: "identity-membership-action-v1",
        actionCode: "REQUEST_IDENTITY_CORRECTION",
        decisionSeriesKey: "identity-membership-action-series",
      },
    });
    assert(proposal.ok);
    f.repository.verifyCurrentCaseActionAssertionSource = async () => {
      // The assertion and baseline have no direct successors, but one normalized
      // baseline account-review membership no longer resolves to its current
      // receipt head. The v2 confirmation is stale before v3 is appended.
      return false;
    };
    const selectedGate = await auth("identity-membership-stale-selected");
    const selected = await appendCaseActionDecision({
      ...selectedGate,
      repository: f.repository,
      request: {
        ...request("identity-membership-stale-selected", identitySource),
        decisionId: "identity-membership-action-v2",
        actionCode: "REQUEST_IDENTITY_CORRECTION",
        state: "CONSUMER_SELECTED",
        decisionSeriesKey: "identity-membership-action-series",
        version: 2,
        supersedesDecisionId: "identity-membership-action-v1",
      },
    });
    assert.deepEqual(selected, { ok: false, code: "SOURCE_SET_MISMATCH" });
  });

  await check("account recognition is current-head only and cannot confer correction authority", async () => {
    const reviewSource: CaseActionSourceRef = {
      sourceType: "CONSUMER_ACCOUNT_REVIEW",
      sourceId: "review_abcdef1234567890",
      sourceVersion: 3,
      bureau: "EQUIFAX",
      integritySha256: "a".repeat(64),
    };
    const sourceSet = [reviewSource];
    const allowed = [
      "REVIEW_ACCOUNT_FACT",
      "DEFER_REVIEW",
      "TAKE_NO_ACTION",
    ] as const;
    for (const actionCode of allowed) {
      const operationId = `account-review-${actionCode.toLowerCase()}`;
      const gate = await auth(operationId);
      const f = fixture(sourceSet);
      let verifiedSource: CaseActionSourceRef | null = null;
      f.repository.verifyCurrentCaseActionAccountReviewSource = async ({
        purpose,
        source,
      }) => {
        assert.equal(purpose, "CASE_ACTION_CURRENT_ACCOUNT_REVIEW_VERIFY");
        verifiedSource = source;
        return true;
      };
      const result = await appendCaseActionDecision({
        ...gate,
        repository: f.repository,
        request: {
          ...request(operationId, sourceSet),
          decisionId: `decision-${actionCode.toLowerCase()}`,
          decisionSeriesKey: `series-${actionCode.toLowerCase()}`,
          actionCode,
        },
      });
      assert(result.ok);
      assert.deepEqual(verifiedSource, reviewSource);
    }

    for (const actionCode of [
      "REVIEW_IDENTITY_FACT",
      "REQUEST_ACCOUNT_CORRECTION",
      "REQUEST_IDENTITY_CORRECTION",
    ] as const) {
      const operationId = `account-review-forbidden-${actionCode.toLowerCase()}`;
      const gate = await auth(operationId);
      let currentChecks = 0;
      const f = fixture(sourceSet);
      f.repository.verifyCurrentCaseActionAccountReviewSource = async () => {
        currentChecks += 1;
        return true;
      };
      const result = await appendCaseActionDecision({
        ...gate,
        repository: f.repository,
        request: {
          ...request(operationId, sourceSet),
          actionCode,
        },
      });
      assert.deepEqual(result, { ok: false, code: "SOURCE_SET_MISMATCH" });
      assert.equal(currentChecks, 0);
    }

    const staleGate = await auth("account-review-stale");
    const stale = fixture(sourceSet);
    stale.repository.verifyCurrentCaseActionAccountReviewSource = async () =>
      false;
    const staleResult = await appendCaseActionDecision({
      ...staleGate,
      repository: stale.repository,
      request: request("account-review-stale", sourceSet),
    });
    assert.deepEqual(staleResult, {
      ok: false,
      code: "SOURCE_SET_MISMATCH",
    });
    assert.equal(stale.records.size, 0);
  });

  await check("account recognition rejects null or substituted bureau authority", async () => {
    const exact: CaseActionSourceRef = {
      sourceType: "CONSUMER_ACCOUNT_REVIEW",
      sourceId: "review-bureau-exact",
      sourceVersion: 2,
      bureau: "EQUIFAX",
      integritySha256: "b".repeat(64),
    };
    assert.throws(() =>
      computeCaseActionSourceSetSha256([{ ...exact, bureau: null }]),
    );

    const operationId = "account-review-wrong-bureau";
    const gate = await auth(operationId);
    const f = fixture([{ ...exact, bureau: "TRANSUNION" }]);
    let currentChecks = 0;
    f.repository.verifyCurrentCaseActionAccountReviewSource = async () => {
      currentChecks += 1;
      return true;
    };
    const result = await appendCaseActionDecision({
      ...gate,
      repository: f.repository,
      request: request(operationId, [exact]),
    });
    assert.deepEqual(result, { ok: false, code: "SOURCE_SET_MISMATCH" });
    assert.equal(currentChecks, 0);
    assert.equal(f.records.size, 0);
  });

  await check("identity category completion becomes historical when baseline v3 supersedes v2", async () => {
    const completionSource = [
      sources().find(
        (source) => source.sourceType === "IDENTITY_CATEGORY_COMPLETION",
      )!,
    ];
    const operationId = "stale-completion-baseline-v3";
    const gate = await auth(operationId);
    const f = fixture(completionSource);
    let verifiedPurpose: string | null = null;
    f.repository.verifyCurrentCaseActionIdentityCategoryCompletionSource =
      async ({ purpose, source }) => {
        verifiedPurpose = purpose;
        assert.deepEqual(source, completionSource[0]);
        // Repository reread found the completion's CONFIRMED v2 baseline has a
        // newer v3 successor; the immutable completion remains history only.
        return false;
      };
    const result = await appendCaseActionDecision({
      ...gate,
      repository: f.repository,
      request: request(operationId, completionSource),
    });
    assert.equal(
      verifiedPurpose,
      "CASE_ACTION_CURRENT_IDENTITY_COMPLETION_VERIFY",
    );
    assert.deepEqual(result, { ok: false, code: "SOURCE_SET_MISMATCH" });
    assert.equal(f.records.size, 0);
  });

  await check("raw evidence can propose but cannot become selected correction testimony", async () => {
    const raw = [sources().find((source) => source.sourceType === "FIELD_OBSERVATION")!];
    const f = fixture(raw);
    const firstGate = await auth("raw-proposal");
    const first = await appendCaseActionDecision({ ...firstGate, repository: f.repository, request: { ...request("raw-proposal", raw), decisionId: "raw-v1", actionCode: "REQUEST_ACCOUNT_CORRECTION", decisionSeriesKey: "raw-series" } }); assert(first.ok);
    const nextGate = await auth("raw-selected");
    const selected = await appendCaseActionDecision({ ...nextGate, repository: f.repository, request: { ...request("raw-selected", raw), decisionId: "raw-v2", actionCode: "REQUEST_ACCOUNT_CORRECTION", state: "CONSUMER_SELECTED", decisionSeriesKey: "raw-series", version: 2, supersedesDecisionId: "raw-v1" } });
    assert.deepEqual(selected, { ok: false, code: "SOURCE_SET_MISMATCH" });
  });

  await check("hostile actors cannot record consumer states, but worker chronology stays non-testimonial", async () => {
    const assertionSource = [sources().find((source) => source.sourceType === "CONSUMER_ASSERTION")!];
    for (const authorizationKind of ["AGENCY_MANAGED_CLIENT", "ADMIN_IMPERSONATION", "SYSTEM_WORKER"] as const) {
      for (const state of ["CONSUMER_SELECTED", "DECLINED", "WAITING"] as const) {
        const gate = await auth(`hostile-${authorizationKind}-${state}`, authorizationKind);
        const result = await appendCaseActionDecision({ ...gate, repository: fixture(assertionSource).repository, request: { ...request(`hostile-${authorizationKind}-${state}`, assertionSource), actionCode: "REQUEST_ACCOUNT_CORRECTION", state } });
        assert.deepEqual(result, { ok: false, code: "CONSUMER_AUTHORITY_REQUIRED" });
      }
    }
    const raw = [sources().find((source) => source.sourceType === "FIELD_OBSERVATION")!]; const f = fixture(raw);
    const proposalGate = await auth("worker-proposal", "SYSTEM_WORKER");
    const proposal = await appendCaseActionDecision({ ...proposalGate, repository: f.repository, request: { ...request("worker-proposal", raw), decisionId: "worker-v1", decisionSeriesKey: "worker-series" } }); assert(proposal.ok);
    const blockedGate = await auth("worker-blocked", "SYSTEM_WORKER");
    const blocked = await appendCaseActionDecision({ ...blockedGate, repository: f.repository, request: { ...request("worker-blocked", raw), decisionId: "worker-v2", state: "BLOCKED", decisionSeriesKey: "worker-series", version: 2, supersedesDecisionId: "worker-v1" } });
    assert.equal(blocked.ok, true);
    if (blocked.ok) {
      assert.equal(blocked.decision.chronologyAuthority, "ORDERING_ONLY_NOT_POLICY_AUTHORITY");
      assert.equal(caseActionDecisionContainsForbiddenAuthority(blocked.decision), false);
    }
  });

  await check("readback mutation fails exact semantic verification", async () => {
    const gate = await auth("action-readback"); let stored: CaseActionDecisionRecord | null = null;
    const repository: CaseActionDecisionRepository = { readCaseActionSourceSet: async () => sources(), readCaseActionDecision: async () => stored ? { ...stored, chronologyRound: 2 } : null, appendCaseActionDecision: async ({ decision }) => { stored = decision; return { disposition: "CREATED" }; }, verifyCurrentCaseActionAssertionSource: async () => true, verifyCurrentCaseActionAccountReviewSource: async () => true, verifyCurrentCaseActionIdentityCategoryCompletionSource: async () => true };
    const result = await appendCaseActionDecision({ ...gate, repository, request: request("action-readback") });
    assert.deepEqual(result, { ok: false, code: "READBACK_MISMATCH" });
  });

  process.stdout.write(`${passed}/${passed} PASS p0-phase2a-action-decision\n`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
