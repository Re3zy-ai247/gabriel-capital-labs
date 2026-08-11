import assert from "node:assert/strict";
import {
  ROUND0_CONTRACT_VERSION,
  ROUND0_IDENTITY_REVIEW_CATEGORIES,
  buildIdentityCorrespondenceAssertionDraft,
  buildNotApplicableCategoryCompletion,
  buildRound0FactReviewProjection,
  computeIdentityCorrespondenceAssertionSeriesKey,
  computeIdentityCorrespondenceAssertionSourceSeriesKey,
  durableIdentityCategoryCompletionFromDraft,
  durableIdentityCorrespondenceAssertionFromDraft,
  projectRound0FactDisposition,
  verifyRound0CompleteSourceAbsence,
  type ConfirmedRound0FactSourceContext,
  type DurableIdentityCorrespondenceAssertionRecord,
  type Round0CompleteSourceAbsenceCandidate,
  type Round0FactSourceContext,
} from "../lib/creditTruth/round0";
import {
  appendIdentityCorrespondenceAssertion,
  confirmRound0Baseline,
  identityAssertionCarriesCompetingDisposition,
  type Round0BaselineSeriesHeadRead,
  type Round0BaselineSourceRead,
  type Round0ConfirmedBaselinePersistenceBundle,
  type Round0RuntimeRepository,
} from "../lib/creditTruth/round0Runtime";
import {
  computeRound0AccountReviewSeriesKey,
  computeRound0AccountReviewSourceSetSha256,
  round0AccountReviewSourceFromSeal,
  type ConsumerAccountReviewReceiptRecord,
} from "../lib/creditTruth/accountReview";
import {
  ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION,
  ROUND0_SOURCE_SEAL_CONTRACT_VERSION,
  bindRound0SourceSnapshotInputSetSha256,
  computeRound0CompletenessMembershipSha256,
  computeRound0CompletenessSetSha256,
  computeRound0SourceSetSha256,
  round0SourceCompletenessSet,
  verifyRound0SourceSnapshot,
  type Round0AccountSetAbsenceCandidate,
  type Round0SourceListedAccountMember,
  type Round0SourceSnapshot,
  type VerifiedRound0SourceSeal,
} from "../lib/creditTruth/round0SourceSeal";
import {
  evaluateAndMintP0Phase2AGatePermit,
  attestLocalSyntheticP0Phase2AFlags,
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

const NOW = new Date();
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
let passed = 0;

async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

function fact(
  overrides: Partial<Round0FactSourceContext> = {},
): Round0FactSourceContext {
  return {
    tenantId: "consumer-1",
    consumerId: "consumer-1",
    reportVersionId: "report-v1",
    extractionRunId: "extract-v1",
    identityBaselineId: "baseline-v1",
    baselineSeriesKey: "baseline-series-1",
    baselineVersion: 1,
    baselineInputSetSha256: HASH_A,
    identityFactId: "fact-former-1",
    factSeriesKey: "fact-series-former",
    categoryKey: "FORMER_ADDRESS",
    bureau: "EXPERIAN",
    sourceLocatorToken: "locator-former-1",
    integritySha256: HASH_B,
    presence: "PRESENT",
    sourceKind: "SOURCE_REPORTED",
    classification: "REVIEW_NEEDED",
    ...overrides,
  };
}

function confirmedFact(
  overrides: Partial<Round0FactSourceContext> = {},
): ConfirmedRound0FactSourceContext {
  return {
    ...fact({
      identityBaselineId: "baseline-v2",
      baselineVersion: 2,
      ...overrides,
    }),
    sourceIdentityBaselineId: "baseline-v1",
    baselineStatus: "CONFIRMED",
  };
}

function identityAssertionSeriesKey(
  source: ConfirmedRound0FactSourceContext,
  purposeCode:
    | "CORRESPONDENCE_SENDER_IDENTITY"
    | "CORRESPONDENCE_IDENTITY_CORRECTION",
): string {
  return computeIdentityCorrespondenceAssertionSeriesKey(
    computeIdentityCorrespondenceAssertionSourceSeriesKey({
      source,
      purposeCode,
    }),
  );
}

function accountMember(
  overrides: Partial<Round0SourceListedAccountMember> = {},
): Round0SourceListedAccountMember {
  return {
    reportAccountId: "report-account-1",
    accountId: "account-1",
    sourceAccountOrdinal: 0,
    membershipOrigin: "SOURCE_LISTED",
    authorityStatus: "SHADOW_V2",
    bureau: "EXPERIAN",
    bureauCoverageId: "coverage-EXPERIAN",
    coverageStatus: "COVERED",
    accountPresenceId: "presence-1",
    accountPresence: "PRESENT",
    accountPresenceSeriesKey: "presence-series-1",
    accountPresenceRevision: 1,
    accountPresenceIntegritySha256: HASH_A,
    accountPresenceSourceLocatorToken: "locator-account-1",
    accountIndexCompletenessId: "account-index-1",
    accountIndexStatus: "COMPLETE",
    ...overrides,
  };
}

function sourceSnapshot(input: {
  readonly facts?: readonly Round0FactSourceContext[];
  readonly accounts?: readonly Round0SourceListedAccountMember[];
  readonly extractionStatus?: "SUCCEEDED" | "PARTIAL";
  readonly inputArtifactSha256?: string;
  readonly reportIngestionId?: string;
  readonly sourceArtifactId?: string;
  readonly sourceArtifactVersion?: number;
  readonly accountIndexStatus?:
    | "COMPLETE"
    | "PARTIAL"
    | "FAILED"
    | "NOT_PROVIDED"
    | "UNKNOWN";
  readonly repositoryReadId?: string;
} = {}): Round0SourceSnapshot {
  const facts = input.facts ?? [];
  const accounts = input.accounts ?? [];
  const coverage = (["EQUIFAX", "EXPERIAN", "TRANSUNION"] as const).map(
    (bureau) => ({
      bureauCoverageId: `coverage-${bureau}`,
      bureau,
      coverageStatus: "COVERED" as const,
    }),
  );
  const identityFacts = facts.map((sourceFact, factOrdinal) => ({
    identityFactId: sourceFact.identityFactId,
    factSeriesKey: sourceFact.factSeriesKey,
    factOrdinal,
    categoryKey:
      sourceFact.categoryKey as (typeof ROUND0_IDENTITY_REVIEW_CATEGORIES)[number],
    bureau: sourceFact.bureau as
      | "EQUIFAX"
      | "EXPERIAN"
      | "TRANSUNION",
    presence: sourceFact.presence,
    sourceKind: sourceFact.sourceKind,
    classification: "REVIEW_NEEDED" as const,
    integritySha256: sourceFact.integritySha256,
    sourceLocatorToken: sourceFact.sourceLocatorToken,
  }));
  const completenessMembers = coverage.flatMap((coverageMember) =>
    ([
      ...ROUND0_IDENTITY_REVIEW_CATEGORIES,
      "UNRECOGNIZED_ACCOUNT",
    ] as const).map((category) => {
      const status =
        category === "UNRECOGNIZED_ACCOUNT"
          ? input.accountIndexStatus ?? "COMPLETE"
          : "COMPLETE";
      const sourceMemberCount =
        category === "UNRECOGNIZED_ACCOUNT"
          ? accounts.filter(
              (member) => member.bureau === coverageMember.bureau,
            ).length
          : identityFacts.filter(
              (member) =>
                member.bureau === coverageMember.bureau &&
                member.categoryKey === category,
            ).length;
      return {
        id: `complete-${coverageMember.bureau}-${category}`,
        bureau: coverageMember.bureau,
        coverageStatus: coverageMember.coverageStatus,
        bureauCoverageId: coverageMember.bureauCoverageId,
        identityBaselineId: "baseline-v1",
        baselineInputSetSha256: HASH_A,
        category,
        status,
        sourceMemberCount,
        sourceMembershipSha256:
          computeRound0CompletenessMembershipSha256({
            category,
            bureau: coverageMember.bureau,
            accountMembers: accounts,
            identityFacts,
          }),
        sourceLocatorToken:
          status === "COMPLETE" || status === "PARTIAL"
            ? `locator-complete-${coverageMember.bureau}-${category}`
            : null,
        integritySha256: HASH_A,
        ruleKey: "parser-v2-round0-completeness",
        ruleVersion: "v1",
      };
    }),
  );
  return bindRound0SourceSnapshotInputSetSha256({
    contractVersion: ROUND0_SOURCE_SEAL_CONTRACT_VERSION,
    repositoryReadId: input.repositoryReadId ?? "round0-source-read-1",
    tenantId: "consumer-1",
    consumerId: "consumer-1",
    reportIngestionId: input.reportIngestionId ?? "ingestion-1",
    reportVersionId: "report-v1",
    reportSeriesKey: "report-series-1",
    reportVersion: 1,
    reportSourceSha256: HASH_A,
    sourceArtifact: {
      artifactId: input.sourceArtifactId ?? "source-artifact-1",
      artifactVersion: input.sourceArtifactVersion ?? 1,
      kind: "REPORT_SOURCE",
      representation: "ORIGINAL_BYTES",
      sha256: HASH_A,
    },
    extractionRunId: "extract-v1",
    extractionStatus: input.extractionStatus ?? "SUCCEEDED",
    inputArtifact: {
      artifactId: "normalized-artifact-1",
      artifactVersion: 1,
      kind: "NORMALIZED_TEXT",
      representation: "DERIVED_NORMALIZED_TEXT",
      sha256: input.inputArtifactSha256 ?? HASH_B,
    },
    identityBaselineId: "baseline-v1",
    baselineSeriesKey: "baseline-series-1",
    baselineVersion: 1,
    expectedCoverageCount: 3,
    coverage,
    expectedCompletenessCount: completenessMembers.length,
    completenessMembers,
    expectedAccountMemberCount: accounts.length,
    accountMembers: accounts,
    expectedIdentityFactCount: facts.length,
    identityFacts,
  });
}

async function sourceSeal(
  input: Parameters<typeof sourceSnapshot>[0] = {},
): Promise<VerifiedRound0SourceSeal> {
  const verified = await verifyRound0SourceSnapshot(sourceSnapshot(input), {
    verifierId: "authenticated-local-round0-repository",
    verifyExactRound0SourceSnapshot: async () => true,
  });
  assert(verified);
  return verified;
}

function baselineSource(
  seal: VerifiedRound0SourceSeal,
  facts: readonly Round0FactSourceContext[],
  slots: readonly string[] = ROUND0_IDENTITY_REVIEW_CATEGORIES,
): Round0BaselineSourceRead {
  return {
    repositoryReadId: seal.repositoryReadId,
    tenantId: seal.tenantId,
    consumerId: seal.consumerId,
    reportIngestionId: seal.reportIngestionId,
    reportVersionId: seal.reportVersionId,
    extractionRunId: seal.extractionRunId,
    identityBaselineId: seal.identityBaselineId,
    baselineSeriesKey: seal.baselineSeriesKey,
    baselineVersion: seal.baselineVersion,
    status: "DRAFT",
    inputSetSha256: seal.sourceSetSha256,
    sourceSeal: seal,
    requiredCategorySlots: slots.map((categoryKey) => ({ categoryKey })),
    facts: facts.map((sourceFact) => ({
      ...sourceFact,
      baselineInputSetSha256: seal.sourceSetSha256,
    })),
  };
}

function absence(
  seal: VerifiedRound0SourceSeal,
  overrides: Partial<Round0CompleteSourceAbsenceCandidate> = {},
): Round0CompleteSourceAbsenceCandidate {
  const categoryKey = overrides.categoryKey ?? "PHONE";
  const completenessEvidence = round0SourceCompletenessSet(
    seal,
    categoryKey as (typeof ROUND0_IDENTITY_REVIEW_CATEGORIES)[number],
  );
  assert(completenessEvidence);
  return {
    contractVersion: ROUND0_CONTRACT_VERSION,
    attestationId: "absence-phone-1",
    repositoryReadId: "absence-read-1",
    tenantId: seal.tenantId,
    consumerId: seal.consumerId,
    reportVersionId: seal.reportVersionId,
    extractionRunId: seal.extractionRunId,
    identityBaselineId: seal.identityBaselineId,
    baselineSeriesKey: seal.baselineSeriesKey,
    baselineVersion: seal.baselineVersion,
    baselineInputSetSha256: seal.sourceSetSha256,
    categoryKey,
    expectedCompletenessEvidenceCount: 3,
    completenessEvidence,
    sourceCompletenessSha256:
      computeRound0CompletenessSetSha256(completenessEvidence),
    matchingFactIds: [],
    sourceSetSha256: seal.sourceSetSha256,
    observedAt: "2026-08-10T11:58:00.000Z",
    ...overrides,
  };
}

function emptyAccountSetAbsence(
  seal: VerifiedRound0SourceSeal,
  overrides: Partial<Round0AccountSetAbsenceCandidate> = {},
): Round0AccountSetAbsenceCandidate {
  return {
    contractVersion: ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION,
    attestationId: "empty-account-set-1",
    repositoryReadId: "empty-account-read-1",
    tenantId: seal.tenantId,
    consumerId: seal.consumerId,
    reportVersionId: seal.reportVersionId,
    extractionRunId: seal.extractionRunId,
    identityBaselineId: seal.identityBaselineId,
    baselineSeriesKey: seal.baselineSeriesKey,
    baselineVersion: seal.baselineVersion,
    sourceSetSha256: seal.sourceSetSha256,
    expectedCompletenessEvidenceCount: 3,
    completenessEvidence:
      round0SourceCompletenessSet(
        seal,
        "UNRECOGNIZED_ACCOUNT",
      )!,
    sourceCompletenessSha256: computeRound0CompletenessSetSha256(
      round0SourceCompletenessSet(
        seal,
        "UNRECOGNIZED_ACCOUNT",
      )!,
    ),
    extractionStatus: "SUCCEEDED",
    expectedAccountMemberCount: 0,
    accountMemberIds: [],
    observedAt: "2026-08-10T11:59:00.000Z",
    ...overrides,
  };
}

function accountReceipt(
  seal: VerifiedRound0SourceSeal,
  overrides: Partial<ConsumerAccountReviewReceiptRecord> = {},
): ConsumerAccountReviewReceiptRecord {
  const source = round0AccountReviewSourceFromSeal({
    seal,
    reportVersionAccountId: seal.accountMembers[0]!.reportAccountId,
    bureau: seal.accountMembers[0]!.bureau,
  });
  assert(source);
  return {
    id: "account-review-1",
    ...source,
    sourceSeriesKey: computeRound0AccountReviewSourceSetSha256(source),
    reviewSeriesKey: computeRound0AccountReviewSeriesKey(source),
    version: 1,
    reviewState: "UNKNOWN",
    sourceSetSha256: computeRound0AccountReviewSourceSetSha256(source),
    authorizationKind: "DIRECT_CONSUMER",
    authorizationVersion: "grant-v1",
    reviewedByActorId: "actor-1",
    reviewedAt: "2026-08-10T11:59:30.000Z",
    supersedesReviewId: null,
    ...overrides,
  };
}

async function gate(
  stage: "ROUND0_REVIEW" | "ASSERTION_RUNTIME",
  operationId: string,
) {
  const principal = await verifyP0PrincipalCandidate(
    {
      actorId: "actor-1",
      tenantId: "consumer-1",
      consumerId: "consumer-1",
      authorizationKind: "DIRECT_CONSUMER",
      authorizationVersion: "grant-v1",
    },
    { verifyCandidate: async () => true },
  );
  assert(principal);
  const scope = p0ScopeFromPrincipal(principal);
  const now = Date.now();
  const readinessReceipt = await verifyP0RepositoryReadinessReceipt(
    {
      contractVersion: P0_PHASE2A_READINESS_CONTRACT_VERSION,
      receiptId: "local-receipt",
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
    { verifierId: "local", verifyRepositoryReceipt: async () => true },
  );
  assert(readinessReceipt);
  const cohort = await verifyP0Phase2ACohortDecision(
    {
      contractVersion: "p0-phase2a-flags-v1",
      decisionId: `cohort-${stage}`,
      stage,
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
    { resolverId: "server", verifyServerResolvedCohort: async () => true },
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
      attestorId: "round0-test",
      verifyLocalSyntheticFlags: async () => true,
    },
  );
  assert(flags);
  const permit = evaluateAndMintP0Phase2AGatePermit({
    stage,
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
      repositoryReceipt: readinessReceipt,
    },
  });
  assert(permit);
  return { principal, scope, permit };
}

function runtimeRepository(input: {
  readonly source: Round0BaselineSourceRead | null;
  readonly currentReviews?: ReadonlyMap<string, ConsumerAccountReviewReceiptRecord>;
  readonly currentHead?: Round0BaselineSeriesHeadRead;
  readonly mutateReadback?: (
    bundle: Round0ConfirmedBaselinePersistenceBundle,
  ) => Round0ConfirmedBaselinePersistenceBundle;
  readonly verifyIdentityBaselineForAssertion?: () => boolean;
}) {
  let stored: Round0ConfirmedBaselinePersistenceBundle | null = null;
  let writes = 0;
  const source = input.source;
  let currentHead: Round0BaselineSeriesHeadRead | null =
    input.currentHead ??
    (source
      ? {
          repositoryReadId: "current-head-draft-read",
          tenantId: source.tenantId,
          consumerId: source.consumerId,
          reportIngestionId: source.reportIngestionId,
          reportVersionId: source.reportVersionId,
          extractionRunId: source.extractionRunId,
          identityBaselineId: source.identityBaselineId,
          sourceIdentityBaselineId: null,
          supersedesIdentityBaselineId: null,
          baselineSeriesKey: source.baselineSeriesKey,
          baselineVersion: source.baselineVersion,
          status: "DRAFT",
          inputSetSha256: source.inputSetSha256,
          semanticSha256: null,
          expectedIdentityFactCount: null,
          expectedCategoryCompletionCount: null,
          expectedAccountReviewReceiptCount: null,
          supersededByIdentityBaselineId: null,
        }
      : null);
  const repository: Round0RuntimeRepository = {
    verifierId: "authenticated-local-round0-repository",
    readRound0Baseline: async () => source,
    readCurrentRound0BaselineSeriesHead: async () => currentHead,
    readCompleteCategoryAbsence: async ({ categoryKey }) =>
      source
        ? absence(source.sourceSeal, {
            categoryKey,
            attestationId: `absence-${categoryKey}`,
            repositoryReadId: `absence-read-${categoryKey}`,
          })
        : null,
    verifyCompleteSourceAbsence: async () => true,
    readCompleteAccountSetAbsence: async ({ attestationId }) =>
      source
        ? emptyAccountSetAbsence(source.sourceSeal, { attestationId })
        : null,
    verifyExactEmptyRound0AccountSet: async () => true,
    readCurrentConsumerAccountReviewReceipt: async ({ reviewId }) => {
      const receipt = input.currentReviews?.get(reviewId) ?? null;
      return receipt
        ? {
            repositoryReadId: `current-review-${reviewId}`,
            receipt,
            supersededByReviewId: null,
          }
        : null;
    },
    appendConfirmedRound0Baseline: async ({ persistence }) => {
      writes += 1;
      stored = persistence;
      const { baseline } = persistence;
      currentHead = {
        repositoryReadId: `current-head-${baseline.id}`,
        tenantId: baseline.tenantId,
        consumerId: baseline.consumerId,
        reportIngestionId: baseline.reportIngestionId,
        reportVersionId: baseline.reportVersionId,
        extractionRunId: baseline.extractionRunId,
        identityBaselineId: baseline.id,
        sourceIdentityBaselineId: baseline.sourceIdentityBaselineId,
        supersedesIdentityBaselineId:
          baseline.supersedesIdentityBaselineId,
        baselineSeriesKey: baseline.baselineSeriesKey,
        baselineVersion: baseline.version,
        status: "CONFIRMED",
        inputSetSha256: baseline.inputSetSha256,
        semanticSha256: baseline.semanticSha256,
        expectedIdentityFactCount: baseline.expectedIdentityFactCount,
        expectedCategoryCompletionCount:
          baseline.expectedCategoryCompletionCount,
        expectedAccountReviewReceiptCount:
          baseline.expectedAccountReviewReceiptCount,
        supersededByIdentityBaselineId: null,
      };
      return { disposition: "CREATED" };
    },
    readConfirmedRound0Baseline: async () =>
      stored && input.mutateReadback ? input.mutateReadback(stored) : stored,
    readIdentityFactForAssertion: async () => null,
    verifyCurrentIdentityBaselineForAssertionSource: async () =>
      input.verifyIdentityBaselineForAssertion?.() ?? true,
    readIdentityCorrespondenceAssertion: async () => null,
    appendIdentityCorrespondenceAssertion: async () => ({
      disposition: "CREATED",
    }),
  };
  return {
    repository,
    get writes() {
      return writes;
    },
    get currentHead() {
      return currentHead;
    },
  };
}

function confirmationRequest(input: {
  readonly operationId: string;
  readonly sourceFacts: readonly Round0FactSourceContext[];
  readonly classification?: "CORRECT_FORMER" | "INCORRECT" | "REVIEW_NEEDED";
  readonly reviewIds?: readonly string[];
  readonly emptyAccountSet?: boolean;
  readonly supersedesIdentityBaselineId?: string;
  readonly identityBaselineId?: string;
  readonly baselineVersion?: number;
}) {
  const factCategories = new Set(input.sourceFacts.map((item) => item.categoryKey));
  return {
    operationId: input.operationId,
    sourceIdentityBaselineId: "baseline-v1",
    supersedesIdentityBaselineId:
      input.supersedesIdentityBaselineId ?? "baseline-v1",
    identityBaselineId: input.identityBaselineId ?? "baseline-v2",
    baselineVersion: input.baselineVersion ?? 2,
    factDecisions: input.sourceFacts.map((sourceFact, index) => ({
      sourceIdentityFactId: sourceFact.identityFactId,
      identityFactId: `${sourceFact.identityFactId}-v${input.baselineVersion ?? 2}-${index}`,
      classification: input.classification ?? ("CORRECT_FORMER" as const),
    })),
    notApplicableCompletions: ROUND0_IDENTITY_REVIEW_CATEGORIES.filter(
      (categoryKey) => !factCategories.has(categoryKey),
    ).map((categoryKey) => ({
      categoryKey,
      completionId: `completion-${categoryKey}-v${input.baselineVersion ?? 2}`,
      categorySeriesKey: `category-${categoryKey}-v${input.baselineVersion ?? 2}`,
      version: 1,
    })),
    accountReviewReceiptIds: input.reviewIds ?? [],
    accountSetAbsenceAttestationId:
      input.emptyAccountSet === false ? null : "empty-account-set-1",
  };
}

async function main() {
  Reflect.set(process.env, "NODE_ENV", "test");
  process.env.P0_PHASE2_ENABLED = "true";
  process.env.P0_PHASE2_KILL_SWITCH = "false";
  process.env.P0_INGESTION_SHADOW_ENABLED = "true";
  process.env.P0_ROUND0_REVIEW_ENABLED = "true";
  process.env.P0_ASSERTION_RUNTIME_ENABLED = "true";

  await check("classification projection keeps correct former address clean", () => {
    assert.equal(projectRound0FactDisposition("CORRECT_FORMER"), "CONFIRMED");
    assert.equal(projectRound0FactDisposition("CORRECT_CURRENT"), "CONFIRMED");
    assert.equal(projectRound0FactDisposition("INCORRECT"), "DISPUTED");
    assert.equal(projectRound0FactDisposition("REVIEW_NEEDED"), "UNKNOWN");
  });

  await check("review projection is neutral and never consumer testimony", () => {
    const projection = buildRound0FactReviewProjection(fact());
    assert.equal(projection.selectedClassification, null);
    assert.equal(projection.consumerDecisionRequired, true);
    assert.equal(projection.systemObservationIsConsumerTestimony, false);
    const uncertainty = buildRound0FactReviewProjection(
      fact({
        presence: "UNKNOWN",
        sourceKind: "PARSER_UNCERTAINTY",
        classification: "REVIEW_NEEDED",
      }),
    );
    assert.equal(uncertainty.disposition, "UNKNOWN");
    assert.equal(uncertainty.consumerDecisionRequired, false);
    assert.throws(() =>
      buildIdentityCorrespondenceAssertionDraft({
        source: {
          ...uncertainty.source,
          identityBaselineId: "baseline-v2",
          baselineVersion: 2,
          sourceIdentityBaselineId: "baseline-v1",
          baselineStatus: "CONFIRMED",
        },
        assertionId: "phantom-assertion",
        operationId: "phantom-operation",
        purposeCode: "CORRESPONDENCE_IDENTITY_CORRECTION",
        assertionSeriesKey: "phantom-series",
        version: 1,
        actorId: "actor-1",
        assertedAt: NOW.toISOString(),
      }),
    );
  });

  await check("N/A requires global complete verified source absence", async () => {
    const seal = await sourceSeal();
    const verified = await verifyRound0CompleteSourceAbsence(
      absence(seal),
      seal,
      { verifyCompleteSourceAbsence: async () => true },
    );
    assert(verified);
    const completion = buildNotApplicableCategoryCompletion({
      verifiedAbsence: verified,
      completionId: "completion-phone-v1",
      operationId: "round0-op",
      categorySeriesKey: "category-phone",
      targetIdentityBaselineId: "baseline-v2",
      targetBaselineSeriesKey: "baseline-series-1",
      targetBaselineVersion: 2,
      version: 1,
      actorId: "actor-1",
      completedAt: NOW.toISOString(),
    });
    assert.equal(completion.completion, "NOT_APPLICABLE");
    assert.equal(completion.identityFactId, null);
    assert.equal(
      durableIdentityCategoryCompletionFromDraft(completion)
        .baselineInputSetSha256,
      seal.sourceSetSha256,
    );
    const completenessEvidence = round0SourceCompletenessSet(seal, "PHONE")!;
    assert.equal(
      await verifyRound0CompleteSourceAbsence(
        absence(seal, {
          completenessEvidence: completenessEvidence.slice(0, 1),
        }),
        seal,
        { verifyCompleteSourceAbsence: async () => true },
      ),
      null,
    );
    assert.equal(
      await verifyRound0CompleteSourceAbsence(
        absence(seal, { matchingFactIds: ["fact-1"] }),
        seal,
        { verifyCompleteSourceAbsence: async () => true },
      ),
      null,
    );
  });

  await check("identity assertion pins exact source and carries no disposition", () => {
    const assertionSource = confirmedFact({
      categoryKey: "CURRENT_ADDRESS",
      classification: "CORRECT_CURRENT",
    });
    const assertion = buildIdentityCorrespondenceAssertionDraft({
      source: assertionSource,
      assertionId: "identity-assertion-1",
      operationId: "identity-op",
      purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
      assertionSeriesKey: identityAssertionSeriesKey(
        assertionSource,
        "CORRESPONDENCE_SENDER_IDENTITY",
      ),
      version: 1,
      actorId: "actor-1",
      assertedAt: NOW.toISOString(),
    });
    assert.equal(assertion.bureau, "EXPERIAN");
    assert.equal(assertion.identityFactClassification, "CORRECT_CURRENT");
    assert.match(assertion.sourceSetSha256, /^[0-9a-f]{64}$/);
    assert.equal(identityAssertionCarriesCompetingDisposition(assertion), false);
    const durableAssertion =
      durableIdentityCorrespondenceAssertionFromDraft(assertion);
    assert.equal(
      durableAssertion.sourceSeriesKey,
      durableAssertion.sourceSetSha256,
    );
    assert.equal(
      durableAssertion.assertionSeriesKey,
      computeIdentityCorrespondenceAssertionSeriesKey(
        durableAssertion.sourceSetSha256,
      ),
    );
    assert.equal("operationId" in durableAssertion, false);
    assert.equal("contractVersion" in durableAssertion, false);
    assert.throws(() =>
      buildIdentityCorrespondenceAssertionDraft({
        source: assertionSource,
        assertionId: "identity-assertion-parallel-v1",
        operationId: "identity-op-parallel",
        purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
        assertionSeriesKey: "caller-selected-competing-series",
        version: 1,
        actorId: "actor-1",
        assertedAt: NOW.toISOString(),
      }),
    );
    assert.notEqual(
      computeIdentityCorrespondenceAssertionSourceSeriesKey({
        source: assertionSource,
        purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
      }),
      computeIdentityCorrespondenceAssertionSourceSeriesKey({
        source: assertionSource,
        purposeCode: "CORRESPONDENCE_IDENTITY_CORRECTION",
      }),
    );
    const incorrectSource = confirmedFact({ classification: "INCORRECT" });
    const incorrect = buildIdentityCorrespondenceAssertionDraft({
      source: incorrectSource,
      assertionId: "classification-pin-1",
      operationId: "classification-pin-op",
      purposeCode: "CORRESPONDENCE_IDENTITY_CORRECTION",
      assertionSeriesKey: identityAssertionSeriesKey(
        incorrectSource,
        "CORRESPONDENCE_IDENTITY_CORRECTION",
      ),
      version: 1,
      actorId: "actor-1",
      assertedAt: NOW.toISOString(),
    });
    const neverMineSource = confirmedFact({ classification: "NEVER_MINE" });
    const neverMine = buildIdentityCorrespondenceAssertionDraft({
      source: neverMineSource,
      assertionId: "classification-pin-2",
      operationId: "classification-pin-op-2",
      purposeCode: "CORRESPONDENCE_IDENTITY_CORRECTION",
      assertionSeriesKey: identityAssertionSeriesKey(
        neverMineSource,
        "CORRESPONDENCE_IDENTITY_CORRECTION",
      ),
      version: 1,
      actorId: "actor-1",
      assertedAt: NOW.toISOString(),
    });
    assert.notEqual(incorrect.sourceSetSha256, neverMine.sourceSetSha256);
    assert.throws(() =>
      durableIdentityCategoryCompletionFromDraft({
        contractVersion: ROUND0_CONTRACT_VERSION,
        completionId: "forged-completion",
        operationId: "forged-operation",
        tenantId: "other-tenant",
        consumerId: "other-consumer",
        reportVersionId: "report-v1",
        extractionRunId: "extract-v1",
        identityBaselineId: "baseline-v2",
        sourceIdentityBaselineId: "baseline-v1",
        baselineSeriesKey: "baseline-series-1",
        baselineVersion: 0,
        baselineInputSetSha256: HASH_A,
        categoryKey: "PHONE",
        completion: "NOT_APPLICABLE",
        identityFactId: null,
        absenceAttestationId: "",
        absenceAttestationSha256: HASH_B,
        sourceCompletenessRuleVersion: "p0-round0-category-absence-v1",
        sourceCompletenessEvidenceCount: 3,
        equifaxSourceCompletenessEvidenceId: "forged-eq-completeness",
        experianSourceCompletenessEvidenceId: "forged-ex-completeness",
        transunionSourceCompletenessEvidenceId: "forged-tu-completeness",
        sourceCompletenessSha256: HASH_A,
        categorySeriesKey: "forged-series",
        version: 1,
        supersedesCompletionId: null,
        completedByActorId: "",
        completedAt: "not-an-instant",
      }),
    );
    for (const source of [
      fact({ classification: "CORRECT_FORMER" }),
      fact({ classification: "REVIEW_NEEDED" }),
      fact({ categoryKey: "EMPLOYMENT", classification: "CORRECT_CURRENT" }),
    ]) {
      const confirmed = confirmedFact({
        ...source,
        identityBaselineId: "baseline-v2",
        baselineVersion: 2,
      });
      assert.throws(() =>
        buildIdentityCorrespondenceAssertionDraft({
          source: confirmed,
          assertionId: `bad-${source.categoryKey}`,
          operationId: "bad-purpose-op",
          purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
          assertionSeriesKey: "bad-series",
          version: 1,
          actorId: "actor-1",
          assertedAt: NOW.toISOString(),
        }),
      );
    }
  });

  await check("Round 0 runtime seals successor baseline and exact empty account set", async () => {
    const auth = await gate("ROUND0_REVIEW", "round0-op");
    const sourceFact = fact();
    const seal = await sourceSeal({ facts: [sourceFact] });
    const source = baselineSource(seal, [sourceFact]);
    const f = runtimeRepository({ source });
    const result = await confirmRound0Baseline({
      ...auth,
      gatePermit: auth.permit,
      repository: f.repository,
      request: confirmationRequest({
        operationId: "round0-op",
        sourceFacts: [sourceFact],
      }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.identityFactPins[0]?.classification, "CORRECT_FORMER");
      assert.equal(result.baseline.inputSetSha256, seal.sourceSetSha256);
      assert.equal(result.accountReviewMemberships.length, 0);
      const accountCompletion = result.categoryCompletions.find(
        (item) => item.category === "UNRECOGNIZED_ACCOUNT",
      );
      assert(accountCompletion);
      assert.equal(
        accountCompletion.baselineInputSetSha256,
        seal.sourceSetSha256,
      );
      assert.equal(
        accountCompletion.sourceCompletenessSha256,
        computeRound0CompletenessSetSha256(
          round0SourceCompletenessSet(
            seal,
            "UNRECOGNIZED_ACCOUNT",
          )!,
        ),
      );
      assert.equal(
        accountCompletion.sourceCompletenessAttestationKey,
        "empty-account-set-1",
      );
      assert(result.categoryCompletions.some((item) => item.category === "PHONE"));
      assert.equal(result.baseline.confirmedAt, auth.permit.issuedAt);
      assert.equal("operationId" in result.baseline, false);
      assert.equal("runtimeVersion" in result.baseline, false);
    }
  });

  await check("exact eight-category identity manifest excludes account recognition", async () => {
    assert.equal(ROUND0_IDENTITY_REVIEW_CATEGORIES.length, 8);
    assert.equal(
      ROUND0_IDENTITY_REVIEW_CATEGORIES.includes("UNRECOGNIZED_ACCOUNT" as never),
      false,
    );
    assert.throws(() =>
      buildRound0FactReviewProjection(
        fact({ categoryKey: "UNRECOGNIZED_ACCOUNT" }),
      ),
    );
    const auth = await gate("ROUND0_REVIEW", "manifest-op");
    const sourceFact = fact();
    const seal = await sourceSeal({ facts: [sourceFact] });
    const source = baselineSource(
      seal,
      [sourceFact],
      ROUND0_IDENTITY_REVIEW_CATEGORIES.slice(0, 7),
    );
    const f = runtimeRepository({ source });
    const result = await confirmRound0Baseline({
      ...auth,
      gatePermit: auth.permit,
      repository: f.repository,
      request: confirmationRequest({
        operationId: "manifest-op",
        sourceFacts: [sourceFact],
      }),
    });
    assert.deepEqual(result, { ok: false, code: "INVALID_REQUEST" });
    assert.equal(f.writes, 0);

    const completeSource = baselineSource(seal, [sourceFact]);
    const completeRepo = runtimeRepository({ source: completeSource });
    const hostileRequest = confirmationRequest({
      operationId: "manifest-op",
      sourceFacts: [sourceFact],
    });
    hostileRequest.notApplicableCompletions.push({
      categoryKey: "UNRECOGNIZED_ACCOUNT" as never,
      completionId: "forged-account-identity-completion",
      categorySeriesKey: "forged-account-identity-series",
      version: 1,
    });
    const hostile = await confirmRound0Baseline({
      ...auth,
      gatePermit: auth.permit,
      repository: completeRepo.repository,
      request: hostileRequest,
    });
    assert.deepEqual(hostile, {
      ok: false,
      code: "CATEGORY_COMPLETION_INVALID",
    });
    assert.equal(completeRepo.writes, 0);
  });

  await check("parser uncertainty cannot become consumer identity correction", async () => {
    const auth = await gate("ROUND0_REVIEW", "uncertainty-op");
    const uncertainFact = fact({
      identityFactId: "fact-uncertain-1",
      factSeriesKey: "fact-series-uncertain",
      categoryKey: "MIXED_FILE_INDICATOR",
      presence: "UNKNOWN",
      sourceKind: "PARSER_UNCERTAINTY",
      classification: "REVIEW_NEEDED",
    });
    const seal = await sourceSeal({ facts: [uncertainFact] });
    const source = baselineSource(seal, [uncertainFact]);
    const f = runtimeRepository({ source });
    const result = await confirmRound0Baseline({
      ...auth,
      gatePermit: auth.permit,
      repository: f.repository,
      request: confirmationRequest({
        operationId: "uncertainty-op",
        sourceFacts: [uncertainFact],
        classification: "INCORRECT",
      }),
    });
    assert.deepEqual(result, { ok: false, code: "FACT_SET_MISMATCH" });
    assert.equal(f.writes, 0);
  });

  await check("agency admin and worker cannot create identity testimony", async () => {
    const direct = await gate("ROUND0_REVIEW", "hostile-op");
    for (const authorizationKind of [
      "AGENCY_MANAGED_CLIENT",
      "ADMIN_IMPERSONATION",
      "SYSTEM_WORKER",
    ] as const) {
      const principal = await verifyP0PrincipalCandidate(
        {
          actorId: `${authorizationKind}-actor`,
          tenantId: "tenant-hostile",
          consumerId: "consumer-1",
          authorizationKind,
          authorizationVersion: "grant-v1",
        },
        { verifyCandidate: async () => true },
      );
      assert(principal);
      const scope = p0ScopeFromPrincipal(principal);
      const repository = {} as Round0RuntimeRepository;
      const baseline = await confirmRound0Baseline({
        principal,
        scope,
        gatePermit: direct.permit,
        repository,
        request: {
          ...confirmationRequest({
            operationId: "hostile-op",
            sourceFacts: [],
          }),
        },
      });
      assert.deepEqual(baseline, {
        ok: false,
        code: "CONSUMER_AUTHORITY_REQUIRED",
      });
      const assertion = await appendIdentityCorrespondenceAssertion({
        principal,
        scope,
        gatePermit: direct.permit,
        repository,
        request: {
          expectedSource: {
            ...fact({ tenantId: scope.tenantId, consumerId: scope.consumerId }),
            sourceIdentityBaselineId: "baseline-source-hostile",
            baselineStatus: "CONFIRMED",
          },
          assertionId: "hostile-assertion",
          operationId: "hostile-op",
          purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
          assertionSeriesKey: "hostile-series",
          version: 1,
        },
      });
      assert.deepEqual(assertion, {
        ok: false,
        code: "CONSUMER_AUTHORITY_REQUIRED",
      });
    }
  });

  await check("existing fact forbids N/A and operation mismatch denies", async () => {
    const auth = await gate("ROUND0_REVIEW", "permitted-op");
    const sourceFact = fact();
    const seal = await sourceSeal({ facts: [sourceFact] });
    const source = baselineSource(seal, [sourceFact]);
    const f = runtimeRepository({ source });
    const request = confirmationRequest({
      operationId: "different-op",
      sourceFacts: [sourceFact],
    });
    request.notApplicableCompletions.push({
      categoryKey: "FORMER_ADDRESS",
      completionId: "bad-na",
      categorySeriesKey: "former-series",
      version: 1,
    });
    const result = await confirmRound0Baseline({
      ...auth,
      gatePermit: auth.permit,
      repository: f.repository,
      request,
    });
    assert.deepEqual(result, { ok: false, code: "GATE_DENIED" });
    assert.equal(f.writes, 0);
  });

  await check("identity runtime rereads appends and verifies exact receipt", async () => {
    const auth = await gate("ASSERTION_RUNTIME", "identity-op");
    const source = confirmedFact({
      identityFactId: "fact-v2",
      categoryKey: "CURRENT_ADDRESS",
      classification: "CORRECT_CURRENT",
    });
    const exactSeriesKey = identityAssertionSeriesKey(
      source,
      "CORRESPONDENCE_SENDER_IDENTITY",
    );
    let stored: DurableIdentityCorrespondenceAssertionRecord | null = null;
    let baselineCurrent = true;
    const base = runtimeRepository({ source: null }).repository;
    const repository: Round0RuntimeRepository = {
      ...base,
      readIdentityFactForAssertion: async () => source,
      verifyCurrentIdentityBaselineForAssertionSource: async () =>
        baselineCurrent,
      readIdentityCorrespondenceAssertion: async () => stored,
      appendIdentityCorrespondenceAssertion: async ({ assertion }) => {
        stored = assertion;
        return { disposition: "CREATED" };
      },
    };
    const result = await appendIdentityCorrespondenceAssertion({
      ...auth,
      gatePermit: auth.permit,
      repository,
      request: {
        expectedSource: source,
        assertionId: "identity-assertion-1",
        operationId: "identity-op",
        purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
        assertionSeriesKey: exactSeriesKey,
        version: 1,
      },
    });
    assert(result.ok);
    const attestedV1 = result.assertion;
    baselineCurrent = false; // A v3 baseline now supersedes source baseline v2.
    const staleBaseline = await appendIdentityCorrespondenceAssertion({
      ...auth,
      gatePermit: auth.permit,
      repository,
      request: {
        expectedSource: source,
        assertionId: "identity-assertion-stale-baseline",
        operationId: "identity-op",
        purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
        assertionSeriesKey: exactSeriesKey,
        version: 1,
      },
    });
    assert.deepEqual(staleBaseline, {
      ok: false,
      code: "STALE_SOURCE_RECONFIRMATION_REQUIRED",
    });
    baselineCurrent = true;
    stored = {
      ...attestedV1,
      identityFactClassification: "INCORRECT",
    };
    const mismatch = await appendIdentityCorrespondenceAssertion({
      ...auth,
      gatePermit: auth.permit,
      repository,
      request: {
        expectedSource: source,
        assertionId: "identity-assertion-forged",
        operationId: "identity-op",
        purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
        assertionSeriesKey: exactSeriesKey,
        version: 2,
        supersedesAssertionId: "identity-assertion-1",
      },
    });
    assert.deepEqual(mismatch, { ok: false, code: "SUPERSESSION_MISMATCH" });
    stored = attestedV1;
    const revoked = await appendIdentityCorrespondenceAssertion({
      ...auth,
      gatePermit: auth.permit,
      repository,
      request: {
        expectedSource: source,
        assertionId: "identity-assertion-2",
        operationId: "identity-op",
        purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
        receiptState: "REVOKED",
        assertionSeriesKey: exactSeriesKey,
        version: 2,
        supersedesAssertionId: "identity-assertion-1",
      },
    });
    assert(revoked.ok);
  });

  await check("identity assertion readback rejects runtime-only and durable substitutions", async () => {
    const source = confirmedFact({
      identityFactId: "fact-durable-readback",
      categoryKey: "CURRENT_ADDRESS",
      classification: "CORRECT_CURRENT",
    });
    const exactSeriesKey = identityAssertionSeriesKey(
      source,
      "CORRESPONDENCE_SENDER_IDENTITY",
    );
    for (const mutation of ["RUNTIME_ONLY", "DURABLE"] as const) {
      const operationId = `assertion-readback-${mutation.toLowerCase()}`;
      const auth = await gate("ASSERTION_RUNTIME", operationId);
      let stored: DurableIdentityCorrespondenceAssertionRecord | null = null;
      const base = runtimeRepository({ source: null }).repository;
      const repository: Round0RuntimeRepository = {
        ...base,
        readIdentityFactForAssertion: async () => source,
        verifyCurrentIdentityBaselineForAssertionSource: async () => true,
        appendIdentityCorrespondenceAssertion: async ({ assertion }) => {
          stored = assertion;
          return { disposition: "CREATED" };
        },
        readIdentityCorrespondenceAssertion: async () => {
          if (!stored) return null;
          return mutation === "RUNTIME_ONLY"
            ? ({ ...stored, operationId } as never)
            : { ...stored, identityFactIntegritySha256: HASH_A };
        },
      };
      const result = await appendIdentityCorrespondenceAssertion({
        ...auth,
        gatePermit: auth.permit,
        repository,
        request: {
          expectedSource: source,
          assertionId: `assertion-${mutation.toLowerCase()}`,
          operationId,
          purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
          assertionSeriesKey: exactSeriesKey,
          version: 1,
        },
      });
      assert.deepEqual(result, { ok: false, code: "READBACK_MISMATCH" });
    }
  });

  await check("superseded account receipt stales baseline authority before v3 exists", async () => {
    const operationId = "assertion-stale-membership-no-v3";
    const auth = await gate("ASSERTION_RUNTIME", operationId);
    const source = confirmedFact({
      identityFactId: "fact-stale-membership",
      categoryKey: "CURRENT_ADDRESS",
      classification: "CORRECT_CURRENT",
    });
    let currentChecks = 0;
    let appends = 0;
    const repository: Round0RuntimeRepository = {
      ...runtimeRepository({ source: null }).repository,
      readIdentityFactForAssertion: async () => source,
      verifyCurrentIdentityBaselineForAssertionSource: async () => {
        currentChecks += 1;
        // No v3 baseline exists, but a normalized v2 membership points to an
        // account review receipt that now has a successor/revocation.
        return false;
      },
      appendIdentityCorrespondenceAssertion: async () => {
        appends += 1;
        return { disposition: "CREATED" };
      },
    };
    const result = await appendIdentityCorrespondenceAssertion({
      ...auth,
      gatePermit: auth.permit,
      repository,
      request: {
        expectedSource: source,
        assertionId: "assertion-stale-membership",
        operationId,
        purposeCode: "CORRESPONDENCE_SENDER_IDENTITY",
        assertionSeriesKey: identityAssertionSeriesKey(
          source,
          "CORRESPONDENCE_SENDER_IDENTITY",
        ),
        version: 1,
      },
    });
    assert.deepEqual(result, {
      ok: false,
      code: "STALE_SOURCE_RECONFIRMATION_REQUIRED",
    });
    assert.equal(currentChecks, 1);
    assert.equal(appends, 0);
  });

  await check("source seal is order-stable and artifact substitution-sensitive", async () => {
    const sourceFact = fact();
    const first = sourceSnapshot({ facts: [sourceFact] });
    const reversed: Round0SourceSnapshot = {
      ...first,
      repositoryReadId: "another-read",
      coverage: [...first.coverage].reverse(),
      identityFacts: [...first.identityFacts].reverse(),
    };
    assert.equal(
      computeRound0SourceSetSha256(first),
      computeRound0SourceSetSha256(reversed),
    );
    assert.notEqual(
      computeRound0SourceSetSha256(first),
      computeRound0SourceSetSha256(
        sourceSnapshot({ facts: [sourceFact], inputArtifactSha256: HASH_A }),
      ),
    );
    assert.notEqual(
      computeRound0SourceSetSha256(first),
      computeRound0SourceSetSha256(
        sourceSnapshot({
          facts: [sourceFact],
          reportIngestionId: "ingestion-substituted",
        }),
      ),
    );
    assert.notEqual(
      computeRound0SourceSetSha256(first),
      computeRound0SourceSetSha256(
        sourceSnapshot({
          facts: [sourceFact],
          sourceArtifactId: "source-artifact-substituted",
        }),
      ),
    );
    assert.notEqual(
      computeRound0SourceSetSha256(first),
      computeRound0SourceSetSha256(
        sourceSnapshot({
          facts: [sourceFact],
          sourceArtifactVersion: 2,
        }),
      ),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256({
        ...first,
        expectedIdentityFactCount: 2,
      }),
    );
    const completenessSubstitution = bindRound0SourceSnapshotInputSetSha256({
      ...first,
      completenessMembers: first.completenessMembers.map((member, index) =>
        index === 0
          ? { ...member, id: "substituted-completeness-id" }
          : member,
      ),
    });
    assert.notEqual(
      computeRound0SourceSetSha256(first),
      computeRound0SourceSetSha256(completenessSubstitution),
    );
    const substitutedSelfPin: Round0SourceSnapshot = {
      ...first,
      completenessMembers: first.completenessMembers.map((member, index) =>
        index === 0
          ? { ...member, baselineInputSetSha256: HASH_B }
          : member,
      ),
    };
    assert.throws(() =>
      computeRound0SourceSetSha256(substitutedSelfPin),
    );
    const reboundSelfPin = bindRound0SourceSnapshotInputSetSha256(
      substitutedSelfPin,
    );
    assert.equal(
      computeRound0SourceSetSha256(reboundSelfPin),
      computeRound0SourceSetSha256(first),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256({
        ...first,
        completenessMembers: first.completenessMembers.map((member, index) =>
          index === 1
            ? { ...member, id: first.completenessMembers[0]!.id }
            : member,
        ),
      }),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256({
        ...first,
        completenessMembers: first.completenessMembers.map((member, index) =>
          index === 0
            ? {
                ...member,
                status: "PARTIAL" as const,
                sourceLocatorToken: null,
              }
            : member,
        ),
      }),
    );
    const outsideTransunion = bindRound0SourceSnapshotInputSetSha256({
      ...first,
      coverage: first.coverage.map((member) =>
        member.bureau === "TRANSUNION"
          ? { ...member, coverageStatus: "OUTSIDE_COVERAGE" as const }
          : member,
      ),
      completenessMembers: first.completenessMembers.map((member) =>
        member.bureau === "TRANSUNION"
          ? {
              ...member,
              coverageStatus: "OUTSIDE_COVERAGE" as const,
              status: "NOT_PROVIDED" as const,
              sourceMemberCount: 0,
              sourceLocatorToken: null,
            }
          : member,
      ),
    });
    assert.doesNotThrow(() =>
      computeRound0SourceSetSha256(outsideTransunion),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256({
        ...outsideTransunion,
        completenessMembers: outsideTransunion.completenessMembers.map(
          (member) =>
            member.bureau === "TRANSUNION" &&
            member.category === "PHONE"
              ? {
                  ...member,
                  status: "FAILED" as const,
                  sourceLocatorToken: "forged-outside-locator",
                }
              : member,
        ),
      }),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256({
        ...first,
        expectedCoverageCount: 1,
        coverage: first.coverage.slice(0, 1),
      }),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256({
        ...first,
        coverage: first.coverage.map((item) => ({
          ...item,
          coverageStatus: "OUTSIDE_COVERAGE" as const,
        })),
      }),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256(
        sourceSnapshot({
          facts: [fact({ bureau: null as never })],
        }),
      ),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256(
        sourceSnapshot({
          facts: [
            fact(),
            fact({
              identityFactId: "fact-series-duplicate",
              factSeriesKey: "fact-series-former",
            }),
          ],
        }),
      ),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256(
        sourceSnapshot({
          accounts: [
            accountMember(),
            accountMember({
              reportAccountId: "report-account-2",
              accountPresenceId: "presence-2",
              accountPresenceSeriesKey: "presence-series-2",
            }),
          ],
        }),
      ),
    );
    assert.throws(() =>
      buildRound0FactReviewProjection({
        ...fact(),
        baselineStatus: { fraudFinding: true },
      } as never),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256({
        ...first,
        unexpectedAuthoritativeField: "forged",
      } as Round0SourceSnapshot),
    );
    assert.throws(() =>
      computeRound0SourceSetSha256({
        ...first,
        expectedCoverageCount: 2,
        coverage: first.coverage.filter(
          (item) => item.bureau !== "EXPERIAN",
        ),
      }),
    );
  });

  await check("runtime rejects free hash and sealed identity substitution", async () => {
    const auth = await gate("ROUND0_REVIEW", "seal-attack-op");
    const sourceFact = fact();
    const seal = await sourceSeal({ facts: [sourceFact] });
    const forgedHashSource = {
      ...baselineSource(seal, [sourceFact]),
      inputSetSha256: HASH_A,
    };
    const forgedHashRepo = runtimeRepository({ source: forgedHashSource });
    const forgedHash = await confirmRound0Baseline({
      ...auth,
      gatePermit: auth.permit,
      repository: forgedHashRepo.repository,
      request: confirmationRequest({
        operationId: "seal-attack-op",
        sourceFacts: [sourceFact],
      }),
    });
    assert.deepEqual(forgedHash, { ok: false, code: "INVALID_REQUEST" });

    const substitutedFact = fact({ integritySha256: HASH_A });
    const substitutedSource = baselineSource(seal, [substitutedFact]);
    const substitutedRepo = runtimeRepository({ source: substitutedSource });
    const substituted = await confirmRound0Baseline({
      ...auth,
      gatePermit: auth.permit,
      repository: substitutedRepo.repository,
      request: confirmationRequest({
        operationId: "seal-attack-op",
        sourceFacts: [substitutedFact],
      }),
    });
    assert.deepEqual(substituted, { ok: false, code: "INVALID_REQUEST" });
  });

  await check("zero-account authority requires SUCCEEDED exact empty sealed set", async () => {
    const auth = await gate("ROUND0_REVIEW", "partial-empty-op");
    const seal = await sourceSeal({ extractionStatus: "PARTIAL" });
    const source = baselineSource(seal, []);
    const f = runtimeRepository({ source });
    const result = await confirmRound0Baseline({
      ...auth,
      gatePermit: auth.permit,
      repository: f.repository,
      request: confirmationRequest({
        operationId: "partial-empty-op",
        sourceFacts: [],
      }),
    });
    assert.deepEqual(result, { ok: false, code: "INVALID_REQUEST" });
    assert.equal(f.writes, 0);

    const incompleteSeal = await sourceSeal({
      accountIndexStatus: "PARTIAL",
    });
    const incompleteSource = baselineSource(incompleteSeal, []);
    const incompleteRepository = runtimeRepository({ source: incompleteSource });
    const incompleteGate = await gate(
      "ROUND0_REVIEW",
      "incomplete-account-index-op",
    );
    const incomplete = await confirmRound0Baseline({
      ...incompleteGate,
      gatePermit: incompleteGate.permit,
      repository: incompleteRepository.repository,
      request: confirmationRequest({
        operationId: "incomplete-account-index-op",
        sourceFacts: [],
      }),
    });
    assert.deepEqual(incomplete, { ok: false, code: "INVALID_REQUEST" });
    assert.equal(incompleteRepository.writes, 0);
  });

  await check("confirmed set rejects UNKNOWN accounts and requires one current receipt per PRESENT member", async () => {
    // A source-listed account with UNKNOWN presence cannot produce a consumer
    // review source and cannot be projected as an empty account set.
    const unknownMember = accountMember({
      accountPresence: "UNKNOWN",
      accountPresenceSourceLocatorToken: null,
    });
    const unknownSeal = await sourceSeal({ accounts: [unknownMember] });
    assert.equal(
      round0AccountReviewSourceFromSeal({
        seal: unknownSeal,
        reportVersionAccountId: unknownMember.reportAccountId,
        bureau: unknownMember.bureau,
      }),
      null,
    );
    const unknownOperationId = "unknown-source-account";
    const unknownAuth = await gate("ROUND0_REVIEW", unknownOperationId);
    const unknownRepository = runtimeRepository({
      source: baselineSource(unknownSeal, []),
    });
    const unknownResult = await confirmRound0Baseline({
      ...unknownAuth,
      gatePermit: unknownAuth.permit,
      repository: unknownRepository.repository,
      request: confirmationRequest({
        operationId: unknownOperationId,
        sourceFacts: [],
        reviewIds: [],
        emptyAccountSet: false,
      }),
    });
    assert.deepEqual(unknownResult, {
      ok: false,
      code: "ACCOUNT_REVIEW_INVALID",
    });
    assert.equal(unknownRepository.writes, 0);

    const auth = await gate("ROUND0_REVIEW", "account-baseline-op");
    const seal = await sourceSeal({ accounts: [accountMember()] });
    const source = baselineSource(seal, []);
    const receipt = accountReceipt(seal, { reviewState: "DEFERRED" });
    const reviews = new Map([[receipt.id, receipt]]);
    const f = runtimeRepository({ source, currentReviews: reviews });
    const result = await confirmRound0Baseline({
      ...auth,
      gatePermit: auth.permit,
      repository: f.repository,
      request: confirmationRequest({
        operationId: "account-baseline-op",
        sourceFacts: [],
        reviewIds: [receipt.id],
        emptyAccountSet: false,
      }),
    });
    assert(result.ok);
    assert.equal(result.baseline.expectedAccountReviewReceiptCount, 1);
    assert.equal(result.accountReviewMemberships.length, 1);
    assert.equal(
      result.accountReviewMemberships[0]?.consumerAccountReviewReceiptId,
      receipt.id,
    );
    assert.equal(result.accountReviewMemberships[0]?.reviewVersion, 1);
    assert.equal(result.accountReviewMemberships[0]?.ordinal, 0);

    const missingGate = await gate("ROUND0_REVIEW", "account-missing-op");
    const missing = await confirmRound0Baseline({
      ...missingGate,
      gatePermit: missingGate.permit,
      repository: runtimeRepository({ source }).repository,
      request: confirmationRequest({
        operationId: "account-missing-op",
        sourceFacts: [],
        reviewIds: [],
        emptyAccountSet: false,
      }),
    });
    assert.deepEqual(missing, { ok: false, code: "ACCOUNT_REVIEW_INVALID" });
  });

  await check("normalized account-review membership is exact in semantic readback", async () => {
    const seal = await sourceSeal({ accounts: [accountMember()] });
    const source = baselineSource(seal, []);
    const receipt = accountReceipt(seal);
    const reviews = new Map([[receipt.id, receipt]]);
    for (const mutation of ["DROP", "SUBSTITUTE"] as const) {
      const operationId = `membership-readback-${mutation.toLowerCase()}`;
      const auth = await gate("ROUND0_REVIEW", operationId);
      const f = runtimeRepository({
        source,
        currentReviews: reviews,
        mutateReadback: (bundle) => ({
          ...bundle,
          accountReviewMemberships:
            mutation === "DROP"
              ? []
              : bundle.accountReviewMemberships.map((member) => ({
                  ...member,
                  receiptSourceSetSha256: HASH_B,
                })),
        }),
      });
      const result = await confirmRound0Baseline({
        ...auth,
        gatePermit: auth.permit,
        repository: f.repository,
        request: confirmationRequest({
          operationId,
          sourceFacts: [],
          reviewIds: [receipt.id],
          emptyAccountSet: false,
        }),
      });
      assert.deepEqual(result, { ok: false, code: "READBACK_MISMATCH" });
    }
  });

  await check("confirmed baseline readback accepts only exact durable projections", async () => {
    const sourceFact = fact();
    const seal = await sourceSeal({ facts: [sourceFact] });
    const source = baselineSource(seal, [sourceFact]);
    for (const mutation of [
      "RUNTIME_ONLY",
      "BASELINE_DURABLE",
      "FACT_DURABLE",
      "COMPLETION_DURABLE",
    ] as const) {
      const operationId = `durable-readback-${mutation.toLowerCase()}`;
      const auth = await gate("ROUND0_REVIEW", operationId);
      const f = runtimeRepository({
        source,
        mutateReadback: (bundle) => {
          switch (mutation) {
            case "RUNTIME_ONLY":
              return {
                ...bundle,
                baseline: {
                  ...bundle.baseline,
                  operationId: "forged-runtime-only-field",
                } as typeof bundle.baseline,
              };
            case "BASELINE_DURABLE":
              return {
                ...bundle,
                baseline: {
                  ...bundle.baseline,
                  policyVersion: "forged-policy-version",
                } as unknown as typeof bundle.baseline,
              };
            case "FACT_DURABLE":
              return {
                ...bundle,
                identityFactPins: bundle.identityFactPins.map((pin, index) =>
                  index === 0 ? { ...pin, classification: "INCORRECT" } : pin,
                ),
              };
            case "COMPLETION_DURABLE":
              return {
                ...bundle,
                categoryCompletions: bundle.categoryCompletions.map(
                  (completion, index) =>
                    index === 0
                      ? { ...completion, completedByActorId: "other-actor" }
                      : completion,
                ),
              };
          }
        },
      });
      const result = await confirmRound0Baseline({
        ...auth,
        gatePermit: auth.permit,
        repository: f.repository,
        request: confirmationRequest({
          operationId,
          sourceFacts: [sourceFact],
        }),
      });
      assert.deepEqual(result, { ok: false, code: "READBACK_MISMATCH" });
    }
  });

  await check("receipt supersession reconfirms from the exact original DRAFT source", async () => {
    const seal = await sourceSeal({ accounts: [accountMember()] });
    const source = baselineSource(seal, []);
    const receiptV1 = accountReceipt(seal, {
      id: "account-review-v1",
      reviewState: "UNKNOWN",
    });
    const reviews = new Map<string, ConsumerAccountReviewReceiptRecord>([
      [receiptV1.id, receiptV1],
    ]);
    const f = runtimeRepository({ source, currentReviews: reviews });
    const authV2 = await gate("ROUND0_REVIEW", "reconfirm-v2");
    const confirmedV2 = await confirmRound0Baseline({
      ...authV2,
      gatePermit: authV2.permit,
      repository: f.repository,
      request: confirmationRequest({
        operationId: "reconfirm-v2",
        sourceFacts: [],
        reviewIds: [receiptV1.id],
        emptyAccountSet: false,
      }),
    });
    assert(confirmedV2.ok);
    assert.equal(confirmedV2.baseline.sourceIdentityBaselineId, "baseline-v1");
    assert.equal(
      confirmedV2.baseline.supersedesIdentityBaselineId,
      "baseline-v1",
    );

    const receiptV2 = accountReceipt(seal, {
      id: "account-review-v2",
      version: 2,
      reviewState: "UNRECOGNIZED",
      supersedesReviewId: receiptV1.id,
    });
    reviews.delete(receiptV1.id);
    reviews.set(receiptV2.id, receiptV2);
    const staleReceiptGate = await gate(
      "ROUND0_REVIEW",
      "reconfirm-stale-receipt",
    );
    const staleReceipt = await confirmRound0Baseline({
      ...staleReceiptGate,
      gatePermit: staleReceiptGate.permit,
      repository: f.repository,
      request: confirmationRequest({
        operationId: "reconfirm-stale-receipt",
        sourceFacts: [],
        reviewIds: [receiptV1.id],
        emptyAccountSet: false,
        supersedesIdentityBaselineId: "baseline-v2",
        identityBaselineId: "baseline-v3-stale",
        baselineVersion: 3,
      }),
    });
    assert.deepEqual(staleReceipt, {
      ok: false,
      code: "ACCOUNT_REVIEW_INVALID",
    });
    assert.equal(f.currentHead?.identityBaselineId, "baseline-v2");
    const authV3 = await gate("ROUND0_REVIEW", "reconfirm-v3");
    const confirmedV3 = await confirmRound0Baseline({
      ...authV3,
      gatePermit: authV3.permit,
      repository: f.repository,
      request: confirmationRequest({
        operationId: "reconfirm-v3",
        sourceFacts: [],
        reviewIds: [receiptV2.id],
        emptyAccountSet: false,
        supersedesIdentityBaselineId: "baseline-v2",
        identityBaselineId: "baseline-v3",
        baselineVersion: 3,
      }),
    });
    assert(confirmedV3.ok);
    assert.equal(confirmedV3.baseline.sourceIdentityBaselineId, "baseline-v1");
    assert.equal(
      confirmedV3.baseline.supersedesIdentityBaselineId,
      "baseline-v2",
    );
    assert.equal(confirmedV3.baseline.version, 3);
    assert.equal(confirmedV3.accountReviewMemberships[0]?.reviewVersion, 2);
    assert.equal(
      confirmedV3.accountReviewMemberships[0]?.reviewState,
      "UNRECOGNIZED",
    );
    assert.notEqual(
      confirmedV3.baseline.semanticSha256,
      confirmedV2.baseline.semanticSha256,
    );
    assert.equal(confirmedV2.baseline.version, 2);
    assert.equal(f.currentHead?.identityBaselineId, "baseline-v3");

    const staleGate = await gate("ROUND0_REVIEW", "reconfirm-stale-head");
    const stale = await confirmRound0Baseline({
      ...staleGate,
      gatePermit: staleGate.permit,
      repository: f.repository,
      request: confirmationRequest({
        operationId: "reconfirm-stale-head",
        sourceFacts: [],
        reviewIds: [receiptV2.id],
        emptyAccountSet: false,
        supersedesIdentityBaselineId: "baseline-v2",
        identityBaselineId: "baseline-v4",
        baselineVersion: 4,
      }),
    });
    assert.deepEqual(stale, { ok: false, code: "INVALID_REQUEST" });
  });

  process.stdout.write(`${passed}/${passed} PASS p0-phase2a-round0\n`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
