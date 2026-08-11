import assert from "node:assert/strict";
import {
  ROUND0_ACCOUNT_REVIEW_STATES,
  accountReviewContainsForbiddenAuthority,
  appendConsumerAccountReviewReceipt,
  buildRound0AccountReviewProjection,
  computeRound0AccountReviewSeriesKey,
  computeRound0AccountReviewSourceSetSha256,
  isValidConsumerAccountReviewReceipt,
  round0AccountReviewSourceFromSeal,
  type ConsumerAccountReviewReceiptRecord,
  type ConsumerAccountReviewRepository,
  type Round0AccountReviewSource,
} from "../lib/creditTruth/accountReview";
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
import {
  ROUND0_SOURCE_SEAL_CONTRACT_VERSION,
  ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS,
  bindRound0SourceSnapshotInputSetSha256,
  computeRound0CompletenessMembershipSha256,
  verifyRound0SourceSnapshot,
  type Round0SourceSnapshot,
  type VerifiedRound0SourceSeal,
} from "../lib/creditTruth/round0SourceSeal";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
let passed = 0;

async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

async function auth(
  operationId: string,
  authorizationKind:
    | "DIRECT_CONSUMER"
    | "AGENCY_MANAGED_CLIENT"
    | "ADMIN_IMPERSONATION"
    | "SYSTEM_WORKER" = "DIRECT_CONSUMER",
) {
  const principal = await verifyP0PrincipalCandidate(
    {
      actorId: `${authorizationKind}-actor`,
      tenantId:
        authorizationKind === "DIRECT_CONSUMER" ? "consumer-1" : "tenant-1",
      consumerId: "consumer-1",
      authorizationKind,
      authorizationVersion: "grant-v1",
    },
    { verifyCandidate: async () => true },
  );
  assert(principal);
  const scope = p0ScopeFromPrincipal(principal);
  const now = Date.now();
  const repositoryReceipt = await verifyP0RepositoryReadinessReceipt(
    {
      contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION,
      receiptId: `receipt-${authorizationKind}`,
      receiptKind: "LOCAL_SYNTHETIC",
      repositoryAdapterId: "synthetic",
      repositoryAdapterVersion: "v1",
      codeRevision: "local",
      migrationSha256: HASH_A,
      semanticsVersion: "v1",
      capabilities: P0_REPOSITORY_CAPABILITIES,
      issuedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 3_600_000).toISOString(),
    },
    {
      verifierId: "local",
      verifyRepositoryReceipt: async () => true,
    },
  );
  assert(repositoryReceipt);
  const cohort = await verifyP0Phase2ACohortDecision(
    {
      contractVersion: "p0-phase2a-flags-v1",
      decisionId: `account-review-${authorizationKind}`,
      stage: "ROUND0_REVIEW",
      actorId: principal.actorId,
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      authorizationKind: principal.authorizationKind,
      authorizationVersion: principal.authorizationVersion,
      cohortVersion: "v1",
      included: true,
      decidedAt: new Date(now - 1_000).toISOString(),
      expiresAt: new Date(now + 600_000).toISOString(),
    },
    {
      resolverId: "server",
      verifyServerResolvedCohort: async () => true,
    },
  );
  assert(cohort);
  const flags = await attestLocalSyntheticP0Phase2AFlags(
    {
      phase2Enabled: true,
      killSwitchEngaged: false,
      ingestionShadowEnabled: true,
      round0ReviewEnabled: true,
      assertionRuntimeEnabled: true,
    },
    {
      attestorId: "account-review-test",
      verifyLocalSyntheticFlags: async () => true,
    },
  );
  assert(flags);
  const gatePermit = evaluateAndMintP0Phase2AGatePermit({
    stage: "ROUND0_REVIEW",
    mode: "LOCAL_BUILD",
    operationId,
    flags,
    principal,
    scope,
    cohortDecision: cohort,
    readinessEvidence: {
      migrationVerified: true,
      migrationSha256: HASH_A,
      principalBoundaryVerified: true,
      repositoryBoundaryVerified: true,
      sourceArtifactBoundaryVerified: true,
      ingestionBoundaryVerified: true,
      round0BoundaryVerified: true,
      assertionBoundaryVerified: true,
      repositoryReceipt,
    },
  });
  assert(gatePermit);
  return { principal, scope, gatePermit };
}

async function seal(input: {
  readonly tenantId?: string;
  readonly consumerId?: string;
  readonly reportVersionId?: string;
  readonly extractionRunId?: string;
  readonly bureau?: "EQUIFAX" | "EXPERIAN" | "TRANSUNION";
  readonly accountPresence?: "PRESENT" | "UNKNOWN";
  readonly revision?: number;
  readonly integritySha256?: string;
  readonly sourceLocatorToken?: string | null;
  readonly accountIndexCompletenessStatus?:
    | "COMPLETE"
    | "PARTIAL"
    | "FAILED"
    | "NOT_PROVIDED"
    | "UNKNOWN";
} = {}): Promise<VerifiedRound0SourceSeal> {
  const tenantId = input.tenantId ?? "consumer-1";
  const consumerId = input.consumerId ?? "consumer-1";
  const bureau = input.bureau ?? "EXPERIAN";
  const accountPresence = input.accountPresence ?? "PRESENT";
  const coverage = (["EQUIFAX", "EXPERIAN", "TRANSUNION"] as const).map(
    (candidateBureau) => ({
      bureauCoverageId: `coverage-${candidateBureau}`,
      bureau: candidateBureau,
      coverageStatus:
        candidateBureau === bureau
          ? ("COVERED" as const)
          : ("OUTSIDE_COVERAGE" as const),
    }),
  );
  const accountMembers: Round0SourceSnapshot["accountMembers"] = [
    {
      reportAccountId: "report-account-1",
      accountId: "account-1",
      sourceAccountOrdinal: 0,
      membershipOrigin: "SOURCE_LISTED",
      authorityStatus: "SHADOW_V2",
      bureau,
      bureauCoverageId: `coverage-${bureau}`,
      coverageStatus: "COVERED",
      accountPresenceId: "presence-1",
      accountPresence,
      accountPresenceSeriesKey: "presence-series-1",
      accountPresenceRevision: input.revision ?? 1,
      accountPresenceIntegritySha256: input.integritySha256 ?? HASH_A,
      accountPresenceSourceLocatorToken:
        input.sourceLocatorToken === undefined
          ? accountPresence === "PRESENT"
            ? "locator-account-1"
            : null
          : input.sourceLocatorToken,
      accountIndexCompletenessId: "account-index-1",
      accountIndexStatus: "COMPLETE",
    },
  ];
  const completenessMembers = coverage.flatMap((coverageMember) =>
    ([
      ...ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS,
      "UNRECOGNIZED_ACCOUNT",
    ] as const).map((category) => {
      const covered = coverageMember.coverageStatus === "COVERED";
      const status = covered
        ? category === "UNRECOGNIZED_ACCOUNT"
          ? input.accountIndexCompletenessStatus ?? "COMPLETE"
          : "COMPLETE"
        : "NOT_PROVIDED";
      return {
        id: `complete-${coverageMember.bureau}-${category}`,
        bureau: coverageMember.bureau,
        coverageStatus: coverageMember.coverageStatus,
        bureauCoverageId: coverageMember.bureauCoverageId,
        identityBaselineId: "baseline-v1",
        baselineInputSetSha256: HASH_A,
        category,
        status,
        sourceMemberCount:
          category === "UNRECOGNIZED_ACCOUNT" && covered ? 1 : 0,
        sourceMembershipSha256:
          computeRound0CompletenessMembershipSha256({
            category,
            bureau: coverageMember.bureau,
            accountMembers,
            identityFacts: [],
          }),
        sourceLocatorToken:
          covered && (status === "COMPLETE" || status === "PARTIAL")
          ? `locator-complete-${coverageMember.bureau}-${category}`
          : null,
        integritySha256: HASH_B,
        ruleKey: "parser-v2-round0-completeness",
        ruleVersion: "v1",
      };
    }),
  );
  const snapshot = bindRound0SourceSnapshotInputSetSha256({
    contractVersion: ROUND0_SOURCE_SEAL_CONTRACT_VERSION,
    repositoryReadId: "round0-source-read-1",
    tenantId,
    consumerId,
    reportIngestionId: "ingestion-1",
    reportVersionId: input.reportVersionId ?? "report-v1",
    reportSeriesKey: "report-series-1",
    reportVersion: 1,
    reportSourceSha256: HASH_A,
    sourceArtifact: {
      artifactId: "source-artifact-1",
      artifactVersion: 1,
      kind: "REPORT_SOURCE",
      representation: "ORIGINAL_BYTES",
      sha256: HASH_A,
    },
    extractionRunId: input.extractionRunId ?? "extract-v1",
    extractionStatus: "SUCCEEDED",
    inputArtifact: {
      artifactId: "normalized-artifact-1",
      artifactVersion: 1,
      kind: "NORMALIZED_TEXT",
      representation: "DERIVED_NORMALIZED_TEXT",
      sha256: HASH_B,
    },
    identityBaselineId: "baseline-v1",
    baselineSeriesKey: "baseline-series-1",
    baselineVersion: 1,
    expectedCoverageCount: 3,
    coverage,
    expectedCompletenessCount: completenessMembers.length,
    completenessMembers,
    expectedAccountMemberCount: 1,
    accountMembers,
    expectedIdentityFactCount: 0,
    identityFacts: [],
  });
  const verified = await verifyRound0SourceSnapshot(snapshot, {
    verifierId: "authenticated-local-repository",
    verifyExactRound0SourceSnapshot: async () => true,
  });
  assert(verified);
  return verified;
}

function fixture(initialSeal: VerifiedRound0SourceSeal) {
  let currentSeal = initialSeal;
  let mutateReadback:
    | ((receipt: ConsumerAccountReviewReceiptRecord) => ConsumerAccountReviewReceiptRecord)
    | null = null;
  const records = new Map<string, ConsumerAccountReviewReceiptRecord>();
  const repository: ConsumerAccountReviewRepository = {
    readRound0AccountReviewSource: async () => ({
      repositoryReadId: currentSeal.repositoryReadId,
      sourceSeal: currentSeal,
    }),
    readConsumerAccountReviewReceipt: async ({ reviewId }) => {
      const record = records.get(reviewId) ?? null;
      return record && mutateReadback ? mutateReadback(record) : record;
    },
    appendConsumerAccountReviewReceipt: async ({ receipt }) => {
      const existing = records.get(receipt.id);
      if (existing) return { disposition: "IDEMPOTENT_REPLAY" };
      if (
        [...records.values()].some(
          (candidate) =>
            candidate.sourceSeriesKey === receipt.sourceSeriesKey &&
            candidate.version === receipt.version,
        ) ||
        receipt.supersedesReviewId !== null &&
        [...records.values()].some(
          (candidate) =>
            candidate.supersedesReviewId === receipt.supersedesReviewId,
        )
      ) {
        throw new Error("stale account review fork");
      }
      records.set(receipt.id, receipt);
      return { disposition: "CREATED" };
    },
  };
  return {
    repository,
    records,
    setSeal(next: VerifiedRound0SourceSeal) {
      currentSeal = next;
    },
    setReadbackMutation(
      mutation:
        | ((receipt: ConsumerAccountReviewReceiptRecord) => ConsumerAccountReviewReceiptRecord)
        | null,
    ) {
      mutateReadback = mutation;
    },
  };
}

function exactSource(
  sourceSeal: VerifiedRound0SourceSeal,
): Round0AccountReviewSource {
  const source = round0AccountReviewSourceFromSeal({
    seal: sourceSeal,
    reportVersionAccountId: "report-account-1",
    bureau: sourceSeal.accountMembers[0]!.bureau,
  });
  assert(source);
  return source;
}

async function main() {
  Reflect.set(process.env, "NODE_ENV", "test");
  process.env.P0_PHASE2_ENABLED = "true";
  process.env.P0_PHASE2_KILL_SWITCH = "false";
  process.env.P0_INGESTION_SHADOW_ENABLED = "true";
  process.env.P0_ROUND0_REVIEW_ENABLED = "true";
  process.env.P0_ASSERTION_RUNTIME_ENABLED = "true";

  await check("machine account projection is neutral and non-testimonial", async () => {
    const sourceSeal = await seal();
    const source = exactSource(sourceSeal);
    const projection = buildRound0AccountReviewProjection(source);
    assert.equal(projection.category, "UNRECOGNIZED_ACCOUNT");
    assert.equal(projection.selectedState, null);
    assert.equal(projection.consumerDecisionRequired, true);
    assert.equal(projection.systemObservationIsConsumerTestimony, false);
    assert.equal(accountReviewContainsForbiddenAuthority(projection), false);

    const uncertain = await seal({
      accountPresence: "UNKNOWN",
      sourceLocatorToken: null,
    });
    assert.equal(
      round0AccountReviewSourceFromSeal({
        seal: uncertain,
        reportVersionAccountId: "report-account-1",
        bureau: "EXPERIAN",
      }),
      null,
    );
    const partialIndex = await seal({
      accountIndexCompletenessStatus: "PARTIAL",
    });
    assert(
      round0AccountReviewSourceFromSeal({
        seal: partialIndex,
        reportVersionAccountId: "report-account-1",
        bureau: "EXPERIAN",
      }),
    );
  });

  await check("all bounded review states are explicit and separate from ConsumerAssertion", () => {
    assert.deepEqual(ROUND0_ACCOUNT_REVIEW_STATES, [
      "RECOGNIZED",
      "UNRECOGNIZED",
      "UNKNOWN",
      "DEFERRED",
      "REVOKED",
    ]);
    assert(!ROUND0_ACCOUNT_REVIEW_STATES.includes("NOT_MINE" as never));
    assert.equal(accountReviewContainsForbiddenAuthority({ disputeEligible: true }), true);
    assert.equal(accountReviewContainsForbiddenAuthority({ fraudFinding: true }), true);
  });

  await check("direct consumer append rereads source and verifies exact readback", async () => {
    const sourceSeal = await seal();
    const source = exactSource(sourceSeal);
    const f = fixture(sourceSeal);
    const gate = await auth("account-review-create");
    const result = await appendConsumerAccountReviewReceipt({
      ...gate,
      repository: f.repository,
      request: {
        id: "account-review-1",
        operationId: "account-review-create",
        expectedSource: source,
        reviewState: "UNRECOGNIZED",
        version: 1,
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.receipt.authorizationKind, "DIRECT_CONSUMER");
    assert.equal(result.receipt.reviewedByActorId, gate.principal.actorId);
    assert.equal(result.receipt.reviewedAt, gate.gatePermit.issuedAt);
    assert.equal(
      result.receipt.reviewSeriesKey,
      computeRound0AccountReviewSeriesKey(source),
    );
    assert.equal(
      result.receipt.sourceSetSha256,
      computeRound0AccountReviewSourceSetSha256(source),
    );
    assert.equal(result.receipt.sourceSeriesKey, result.receipt.sourceSetSha256);
    assert.equal("disposition" in result.receipt, false);
    assert.equal(accountReviewContainsForbiddenAuthority(result.receipt), false);
    const replay = await appendConsumerAccountReviewReceipt({
      ...gate,
      repository: f.repository,
      request: {
        id: "account-review-1",
        operationId: "account-review-create",
        expectedSource: source,
        reviewState: "UNRECOGNIZED",
        version: 1,
      },
    });
    assert(replay.ok);
    assert.equal(replay.disposition, "IDEMPOTENT_REPLAY");
  });

  await check("canonical source series forbids parallel version-one heads", async () => {
    const sourceSeal = await seal();
    const source = exactSource(sourceSeal);
    const f = fixture(sourceSeal);
    const firstGate = await auth("account-review-source-head-1");
    const first = await appendConsumerAccountReviewReceipt({
      ...firstGate,
      repository: f.repository,
      request: {
        id: "account-review-source-head-1",
        operationId: "account-review-source-head-1",
        expectedSource: source,
        reviewState: "UNKNOWN",
        version: 1,
      },
    });
    assert(first.ok);
    assert.equal(
      isValidConsumerAccountReviewReceipt({
        ...first.receipt,
        sourceSeriesKey: HASH_B,
      }),
      false,
    );
    const forkGate = await auth("account-review-source-head-fork");
    const fork = await appendConsumerAccountReviewReceipt({
      ...forkGate,
      repository: f.repository,
      request: {
        id: "account-review-source-head-fork",
        operationId: "account-review-source-head-fork",
        expectedSource: source,
        reviewState: "RECOGNIZED",
        version: 1,
      },
    });
    assert.deepEqual(fork, { ok: false, code: "OUTCOME_UNKNOWN" });
    assert.equal(f.records.size, 1);
  });

  await check("agency admin and worker cannot append consumer review states", async () => {
    const sourceSeal = await seal({ tenantId: "tenant-1" });
    const source = exactSource(sourceSeal);
    for (const kind of [
      "AGENCY_MANAGED_CLIENT",
      "ADMIN_IMPERSONATION",
      "SYSTEM_WORKER",
    ] as const) {
      const gate = await auth(`hostile-${kind}`, kind);
      const result = await appendConsumerAccountReviewReceipt({
        ...gate,
        repository: fixture(sourceSeal).repository,
        request: {
          id: `review-${kind}`,
          operationId: `hostile-${kind}`,
          expectedSource: source,
          reviewState: "UNRECOGNIZED",
          version: 1,
        },
      });
      assert.deepEqual(result, {
        ok: false,
        code: "CONSUMER_AUTHORITY_REQUIRED",
      });
    }
  });

  await check("source substitution and evidence revision require reconfirmation", async () => {
    const original = await seal();
    const changed = await seal({ revision: 2, integritySha256: HASH_B });
    const expected = exactSource(original);
    const changedSource = exactSource(changed);
    assert.notEqual(
      computeRound0AccountReviewSeriesKey(expected),
      computeRound0AccountReviewSeriesKey(changedSource),
    );
    const f = fixture(original);
    f.setSeal(changed);
    const gate = await auth("stale-account-review");
    const result = await appendConsumerAccountReviewReceipt({
      ...gate,
      repository: f.repository,
      request: {
        id: "stale-review-1",
        operationId: "stale-account-review",
        expectedSource: expected,
        reviewState: "RECOGNIZED",
        version: 1,
      },
    });
    assert.deepEqual(result, {
      ok: false,
      code: "STALE_SOURCE_RECONFIRMATION_REQUIRED",
    });
  });

  await check("exact supersession is append-only and revocation is terminal", async () => {
    const sourceSeal = await seal();
    const source = exactSource(sourceSeal);
    const f = fixture(sourceSeal);
    const firstGate = await auth("review-v1");
    const first = await appendConsumerAccountReviewReceipt({
      ...firstGate,
      repository: f.repository,
      request: {
        id: "review-v1",
        operationId: "review-v1",
        expectedSource: source,
        reviewState: "UNKNOWN",
        version: 1,
      },
    });
    assert(first.ok);
    const secondGate = await auth("review-v2");
    const second = await appendConsumerAccountReviewReceipt({
      ...secondGate,
      repository: f.repository,
      request: {
        id: "review-v2",
        operationId: "review-v2",
        expectedSource: source,
        reviewState: "DEFERRED",
        version: 2,
        supersedesReviewId: "review-v1",
      },
    });
    assert(second.ok);
    const forkGate = await auth("review-v2-fork");
    const staleFork = await appendConsumerAccountReviewReceipt({
      ...forkGate,
      repository: f.repository,
      request: {
        id: "review-v2-fork",
        operationId: "review-v2-fork",
        expectedSource: source,
        reviewState: "RECOGNIZED",
        version: 2,
        supersedesReviewId: "review-v1",
      },
    });
    assert.deepEqual(staleFork, { ok: false, code: "OUTCOME_UNKNOWN" });
    const revokeGate = await auth("review-v3");
    const revoked = await appendConsumerAccountReviewReceipt({
      ...revokeGate,
      repository: f.repository,
      request: {
        id: "review-v3",
        operationId: "review-v3",
        expectedSource: source,
        reviewState: "REVOKED",
        version: 3,
        supersedesReviewId: "review-v2",
      },
    });
    assert(revoked.ok);
    const afterGate = await auth("review-v4");
    const after = await appendConsumerAccountReviewReceipt({
      ...afterGate,
      repository: f.repository,
      request: {
        id: "review-v4",
        operationId: "review-v4",
        expectedSource: source,
        reviewState: "RECOGNIZED",
        version: 4,
        supersedesReviewId: "review-v3",
      },
    });
    assert.deepEqual(after, { ok: false, code: "SUPERSESSION_MISMATCH" });
    assert.equal(f.records.get("review-v1")?.reviewState, "UNKNOWN");
  });

  await check("malformed supersession shapes fail closed", async () => {
    const sourceSeal = await seal();
    const source = exactSource(sourceSeal);
    const f = fixture(sourceSeal);
    const gate = await auth("supersession-shape-v1");
    const first = await appendConsumerAccountReviewReceipt({
      ...gate,
      repository: f.repository,
      request: {
        id: "supersession-shape-v1",
        operationId: "supersession-shape-v1",
        expectedSource: source,
        reviewState: "UNKNOWN",
        version: 1,
      },
    });
    assert(first.ok);
    assert.equal(
      isValidConsumerAccountReviewReceipt({
        ...first.receipt,
        version: 2,
        supersedesReviewId: null,
      }),
      false,
    );
    assert.equal(
      isValidConsumerAccountReviewReceipt({
        ...first.receipt,
        reviewState: "REVOKED",
      }),
      false,
    );
    assert.equal(
      isValidConsumerAccountReviewReceipt({
        ...first.receipt,
        supersedesReviewId: "unexpected-prior",
      }),
      false,
    );
  });

  await check("cross-bureau and account selectors cannot become authority", async () => {
    const sourceSeal = await seal();
    assert.equal(
      round0AccountReviewSourceFromSeal({
        seal: sourceSeal,
        reportVersionAccountId: "report-account-1",
        bureau: "EQUIFAX",
      }),
      null,
    );
    assert.equal(
      round0AccountReviewSourceFromSeal({
        seal: sourceSeal,
        reportVersionAccountId: "report-account-other",
        bureau: "EXPERIAN",
      }),
      null,
    );
  });

  await check("readback mutation and replay conflict fail closed", async () => {
    const sourceSeal = await seal();
    const source = exactSource(sourceSeal);
    const f = fixture(sourceSeal);
    f.setReadbackMutation((receipt) => ({
      ...receipt,
      reviewState: "RECOGNIZED",
    }));
    const gate = await auth("review-readback");
    const result = await appendConsumerAccountReviewReceipt({
      ...gate,
      repository: f.repository,
      request: {
        id: "review-readback-1",
        operationId: "review-readback",
        expectedSource: source,
        reviewState: "UNKNOWN",
        version: 1,
      },
    });
    assert.deepEqual(result, { ok: false, code: "READBACK_MISMATCH" });
  });

  process.stdout.write(
    `${passed}/${passed} PASS p0-phase2a-account-review\n`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
