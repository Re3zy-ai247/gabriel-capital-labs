// Executable Phase-1 progress-intelligence contract guard.
// Synthetic facts only; no consumer identity, report content, or production paths.
// Run: npx --no-install tsx scripts/p0-progress-intelligence.test.ts
import assert from "node:assert/strict";
import type { Bureau } from "@prisma/client";
import {
  NO_CAUSAL_ATTRIBUTION_NOTICE,
  PROGRESS_INTELLIGENCE_ROLLOUT_MODE,
  assessCausalityStatement,
  bindApprovedCorrespondenceTarget,
  bindHumanOutcomeConfirmation,
  bindPersistedReportDifference,
  buildProgressProjection,
  compareAccountPresence,
  compareBureauCoverage,
  compareCreditScores,
  compareFieldObservations,
  compareIdentityFacts,
  createCreditScoreObservation,
  createReportComparisonContext,
  deriveCreditScoreObservationSeriesKey,
  determineDisputeOutcome,
  renderNoncausalProgressNarrative,
  toCreditScoreInsertCandidate,
  toReportDifferenceInsertCandidate,
  type AccountPresenceEvidence,
  type BureauCoverageEvidence,
  type CorrespondenceItemBindingSnapshot,
  type CorrespondenceVersionBindingSnapshot,
  type CorrespondenceVersionItemBindingSnapshot,
  type CreditScoreObservation,
  type CreditScoreObservationInput,
  type EncryptedScoreEnvelope,
  type ConsumerAssertionBindingSnapshot,
  type FieldObservationEvidence,
  type HumanOutcomeConfirmationSnapshot,
  type IdentityFactEvidence,
  type ReportCheckpoint,
  type ReportComparisonContext,
  type ReportDifferenceDecision,
  type VerifiedApprovedCorrespondenceTarget,
  type VerifiedReportDifferenceBinding,
} from "../lib/creditTruth/progressIntelligence";

let passed = 0;
let failed = 0;

function contract(label: string, run: () => void): void {
  try {
    run();
    passed += 1;
    console.log(`✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${label}`);
    console.error(error);
  }
}

const SYNTHETIC_SCOPE = {
  tenantId: "synthetic-tenant-progress",
  consumerId: "synthetic-consumer-progress",
} as const;

function digest(character: string): string {
  return character.repeat(64);
}

function encryptedScoreEnvelope(seed = 1): EncryptedScoreEnvelope {
  return {
    ciphertext: new Uint8Array([seed, seed + 1, seed + 2]),
    iv: new Uint8Array(12).fill(seed),
    authTag: new Uint8Array(16).fill(seed + 1),
    keyVersion: "synthetic-key-v1",
    algorithm: "AES_256_GCM",
    envelopeVersion: "synthetic-envelope-v1",
    aadVersion: "synthetic-aad-v1",
  };
}

function checkpoint(
  version: number,
  options: {
    reportVersionId?: string;
    extractionRunId?: string;
    reportSeriesKey?: string;
    inputDigestCharacter?: string;
    date?: string;
    reportDateEvidence?: ReportCheckpoint["reportDateEvidence"];
  } = {}
): ReportCheckpoint {
  return {
    ...SYNTHETIC_SCOPE,
    reportVersionId:
      options.reportVersionId ?? `synthetic-report-version-${version}`,
    extractionRunId:
      options.extractionRunId ?? `synthetic-extraction-run-${version}`,
    reportSeriesKey: options.reportSeriesKey ?? "synthetic-report-series-a",
    reportVersion: version,
    reportInputSha256: digest(
      options.inputDigestCharacter ?? String.fromCharCode(96 + version)
    ),
    reportDateEvidence:
      options.reportDateEvidence ??
      ({
        provenance: "SOURCE_REPORTED",
        reportDate: options.date ?? `2026-0${version}-01`,
        sourceLocatorToken: `synthetic-report-date-locator-${version}`,
        ruleKey: "synthetic-report-date-rule",
        ruleVersion: "1",
      } as const),
  };
}

function comparison(
  prior: ReportCheckpoint,
  current: ReportCheckpoint,
  comparisonId = "synthetic-comparison-1",
  version = 1
): ReportComparisonContext {
  return createReportComparisonContext({
    comparisonId,
    comparisonSeriesKey: `synthetic-comparison-series-${comparisonId}`,
    version,
    idempotencyKey: `synthetic-comparison-idempotency-${comparisonId}-${version}`,
    ...(version > 1
      ? { supersedesComparisonId: `synthetic-comparison-${version - 1}` }
      : {}),
    prior,
    current,
    comparisonModelKey: "synthetic-exact-observation-comparison",
    comparisonModelVersion: "1",
  });
}

const REPORT_V1 = checkpoint(1, { date: "2026-01-10" });
const REPORT_V2 = checkpoint(2, { date: "2026-02-10" });
const TEMPORAL_COMPARISON = comparison(REPORT_V1, REPORT_V2);

function reportScore(
  point: ReportCheckpoint,
  bureau: Bureau,
  score: number,
  options: {
    observationId?: string;
    occurrence?: number;
    sourceMethodKey?: string;
    sourceMethodVersion?: string;
    modelKey?: string;
    modelVersion?: string;
    revision?: number;
    supersedesObservationId?: string | null;
    priorRevision?: CreditScoreObservation;
  } = {}
): CreditScoreObservation {
  const occurrence = options.occurrence ?? 0;
  const revision = options.revision ?? 1;
  const observationId =
    options.observationId ??
    `synthetic-score-${point.reportVersionId}-${bureau}-${occurrence}`;
  return createCreditScoreObservation({
    ...SYNTHETIC_SCOPE,
    observationId,
    revision,
    idempotencyKey: `synthetic-score-idempotency-${observationId}-${revision}`,
    supersedesObservationId: options.supersedesObservationId ?? null,
    bureau,
    occurrence,
    sourceType: "REPORT_DERIVED",
    checkpoint: point,
    bureauCoverageId: `synthetic-coverage-${point.reportVersionId}-${bureau}`,
    coverageStatus: "COVERED",
    presence: "SCORE_REPORTED",
    evidenceCompleteness: "COMPLETE",
    score,
    model: {
      completeness: "COMPLETE",
      modelKey: options.modelKey ?? "SYNTHETIC_SCORE_MODEL",
      modelVersion: options.modelVersion ?? "1",
      scaleMin: 300,
      scaleMax: 850,
    },
    sourceMethodKey: options.sourceMethodKey ?? "synthetic-report-score-parser",
    sourceMethodVersion: options.sourceMethodVersion ?? "1",
    sourceLocatorToken: `synthetic-score-locator-${point.reportVersionId}-${bureau}`,
    observedAt: `${
      point.reportDateEvidence.provenance === "SOURCE_REPORTED"
        ? point.reportDateEvidence.reportDate
        : "2026-01-01"
    }T12:00:00.000Z`,
  }, options.priorRevision);
}

function scoreNotProvided(
  point: ReportCheckpoint,
  bureau: Bureau
): CreditScoreObservation {
  return createCreditScoreObservation({
    ...SYNTHETIC_SCOPE,
    observationId: `synthetic-score-not-provided-${point.reportVersionId}-${bureau}`,
    revision: 1,
    idempotencyKey: `synthetic-score-not-provided-idempotency-${point.reportVersionId}-${bureau}`,
    supersedesObservationId: null,
    bureau,
    occurrence: 0,
    sourceType: "REPORT_DERIVED",
    checkpoint: point,
    bureauCoverageId: `synthetic-coverage-${point.reportVersionId}-${bureau}`,
    coverageStatus: "COVERED",
    presence: "SCORE_NOT_PROVIDED",
    evidenceCompleteness: "NOT_PROVIDED",
    model: { completeness: "UNKNOWN" },
    sourceMethodKey: "synthetic-report-score-parser",
    sourceMethodVersion: "1",
    sourceLocatorToken: `synthetic-score-section-${point.reportVersionId}-${bureau}`,
    observedAt: "2026-02-10T12:00:00.000Z",
  });
}

function manualScore(bureau: Bureau, score: number): CreditScoreObservation {
  return createCreditScoreObservation({
    ...SYNTHETIC_SCOPE,
    observationId: `synthetic-manual-score-${bureau}`,
    revision: 1,
    idempotencyKey: `synthetic-manual-score-idempotency-${bureau}`,
    supersedesObservationId: null,
    bureau,
    occurrence: 0,
    sourceType: "MANUAL_ENTRY",
    presence: "SCORE_REPORTED",
    evidenceCompleteness: "MANUAL_UNVERIFIED",
    score,
    model: { completeness: "UNKNOWN" },
    sourceMethodKey: "synthetic-manual-entry",
    sourceMethodVersion: "1",
    observedAt: "2026-01-20T12:00:00.000Z",
    enteredByActorId: "synthetic-actor-manual",
    enteredAt: "2026-01-20T12:00:00.000Z",
  });
}

function accountPresence(
  point: ReportCheckpoint,
  bureau: Bureau,
  presence: AccountPresenceEvidence["presence"],
  options: {
    accountId?: string;
    completeness?: AccountPresenceEvidence["completeness"];
    coverageStatus?: AccountPresenceEvidence["coverageStatus"];
    suffix?: string;
  } = {}
): AccountPresenceEvidence {
  const accountId = options.accountId ?? "synthetic-account-a";
  return {
    ...SYNTHETIC_SCOPE,
    checkpoint: point,
    bureau,
    sourceObservationId: `synthetic-presence-${point.reportVersionId}-${bureau}-${accountId}-${
      options.suffix ?? "base"
    }`,
    accountId,
    presence,
    completeness: options.completeness ?? "COMPLETE",
    coverageStatus: options.coverageStatus ?? "COVERED",
  };
}

function fieldObservation(
  point: ReportCheckpoint,
  bureau: Bureau,
  fieldKey: string,
  presence: FieldObservationEvidence["presence"],
  options: {
    accountId?: string;
    completeness?: FieldObservationEvidence["completeness"];
    coverageStatus?: FieldObservationEvidence["coverageStatus"];
    comparableValue?: FieldObservationEvidence["comparableValue"];
    normalizationRuleKey?: string;
    normalizationRuleVersion?: string;
    suffix?: string;
  } = {}
): FieldObservationEvidence {
  const accountId = options.accountId ?? "synthetic-account-a";
  return {
    ...SYNTHETIC_SCOPE,
    checkpoint: point,
    bureau,
    sourceObservationId: `synthetic-field-${point.reportVersionId}-${bureau}-${fieldKey}-${
      options.suffix ?? "base"
    }`,
    accountId,
    fieldKey,
    normalizationRuleKey:
      options.normalizationRuleKey ?? "synthetic-field-normalization",
    normalizationRuleVersion: options.normalizationRuleVersion ?? "1",
    presence,
    completeness: options.completeness ?? "COMPLETE",
    coverageStatus: options.coverageStatus ?? "COVERED",
    ...(options.comparableValue === undefined
      ? {}
      : { comparableValue: options.comparableValue }),
  };
}

function approvedTarget(
  options: {
    fieldKey?: string;
    priorObservationId?: string;
    versionStatus?: CorrespondenceVersionBindingSnapshot["status"];
    membershipItemId?: string;
    assertionDisposition?: ConsumerAssertionBindingSnapshot["disposition"];
  } = {}
): VerifiedApprovedCorrespondenceTarget {
  const fieldKey = options.fieldKey ?? "detailedStatus";
  const priorObservationId =
    options.priorObservationId ??
    `synthetic-field-${REPORT_V1.reportVersionId}-EQUIFAX-${fieldKey}-base`;
  const assertion: ConsumerAssertionBindingSnapshot = {
    ...SYNTHETIC_SCOPE,
    id: "synthetic-assertion-a",
    reportVersionId: REPORT_V1.reportVersionId,
    accountId: "synthetic-account-a",
    bureau: "EQUIFAX",
    fieldKey,
    observationId: priorObservationId,
    disposition: options.assertionDisposition ?? "CONFIRMED_INACCURATE",
    confirmedByActorId: "synthetic-consumer-actor",
    confirmedAt: "2026-01-12T12:00:00.000Z",
  };
  const item: CorrespondenceItemBindingSnapshot = {
    ...SYNTHETIC_SCOPE,
    id: "synthetic-correspondence-item-a",
    reportVersionId: REPORT_V1.reportVersionId,
    caseId: "synthetic-case-a",
    correspondenceId: "synthetic-correspondence-a",
    accountId: "synthetic-account-a",
    bureau: "EQUIFAX",
    fieldKey,
    observationId: priorObservationId,
    consumerAssertionId: assertion.id,
  };
  const version: CorrespondenceVersionBindingSnapshot = {
    ...SYNTHETIC_SCOPE,
    id: "synthetic-approved-correspondence-version-a",
    reportVersionId: REPORT_V1.reportVersionId,
    caseId: item.caseId,
    correspondenceId: item.correspondenceId,
    status: options.versionStatus ?? "APPROVED",
  };
  const membership: CorrespondenceVersionItemBindingSnapshot = {
    ...SYNTHETIC_SCOPE,
    id: "synthetic-version-membership-a",
    reportVersionId: REPORT_V1.reportVersionId,
    caseId: item.caseId,
    correspondenceId: item.correspondenceId,
    correspondenceVersionId: version.id,
    correspondenceItemId: options.membershipItemId ?? item.id,
  };
  return bindApprovedCorrespondenceTarget({
    assertion,
    item,
    version,
    membership,
  });
}

function persistedDifference(
  decision: ReportDifferenceDecision,
  id = "synthetic-persisted-difference-a"
): VerifiedReportDifferenceBinding {
  const candidate = toReportDifferenceInsertCandidate(decision, {
    differenceSeriesKey: `synthetic-difference-series-${id}`,
    version: 1,
    idempotencyKey: `synthetic-difference-idempotency-${id}`,
    comparisonRuleKey: "synthetic-exact-source-rule",
    comparisonRuleVersion: "1",
    sourceSetSha256: digest("c"),
    integritySha256: digest("d"),
    createdByActorId: "synthetic-system-actor",
  });
  return bindPersistedReportDifference(decision, { id, candidate });
}

function outcomeMetadata(version = 1) {
  return {
    outcomeSeriesKey: "synthetic-outcome-series-status",
    version,
    idempotencyKey: `synthetic-outcome-idempotency-${version}`,
    ...(version > 1
      ? { supersedesOutcomeId: `synthetic-outcome-version-${version - 1}` }
      : {}),
    decidedAt: "2026-02-12T12:00:00.000Z",
    decisionModelKey: "synthetic-outcome-rule",
    decisionModelVersion: "1",
    sourceSetSha256: digest("e"),
    integritySha256: digest("f"),
  } as const;
}

function correctedFieldFacts(): {
  prior: FieldObservationEvidence;
  difference: ReportDifferenceDecision;
  current: FieldObservationEvidence;
} {
  const prior = fieldObservation(
    REPORT_V1,
    "EQUIFAX",
    "detailedStatus",
    "PRESENT",
    { comparableValue: "COLLECTION_ACCOUNT" }
  );
  const current = fieldObservation(
    REPORT_V2,
    "EQUIFAX",
    "detailedStatus",
    "PRESENT",
    { comparableValue: "CLOSED" }
  );
  return {
    prior,
    difference: compareFieldObservations(TEMPORAL_COMPARISON, prior, current),
    current,
  };
}

function correctedOutcome(version = 1): ReturnType<typeof determineDisputeOutcome> {
  const facts = correctedFieldFacts();
  const difference = persistedDifference(
    facts.difference,
    "synthetic-difference-corrected-status"
  );
  const target = approvedTarget({ priorObservationId: facts.prior.sourceObservationId });
  const confirmationSnapshot: HumanOutcomeConfirmationSnapshot = {
    ...SYNTHETIC_SCOPE,
    id: `synthetic-human-confirmation-${version}`,
    comparisonId: facts.difference.comparisonId,
    differenceId: difference.id,
    correspondenceItemId: target.target.correspondenceItemId,
    currentSourceObservationId: facts.current.sourceObservationId,
    confirmedState: "CORRECTED",
    confirmedByActorId: "synthetic-reviewer-actor",
    confirmedAt: "2026-02-13T12:00:00.000Z",
  };
  const humanConfirmation = bindHumanOutcomeConfirmation({
    snapshot: confirmationSnapshot,
    difference,
    target,
  });
  return determineDisputeOutcome({
    difference,
    target,
    humanConfirmation,
    ...outcomeMetadata(version),
  });
}

// ---------------------------------------------------------------------------
// Founder addendum synthetic regressions A-J
// ---------------------------------------------------------------------------

contract("TEST A — SCORE AUTO CAPTURE", () => {
  const observation = reportScore(REPORT_V1, "EQUIFAX", 610);
  assert.equal(observation.sourceType, "REPORT_DERIVED");
  assert.equal(observation.evidenceRole, "PRIMARY_REPORT_EVIDENCE");
  assert.equal(observation.presence, "SCORE_REPORTED");
  assert.equal(observation.revision, 1);
  assert.equal(observation.supersedesObservationId, null);
  if (observation.sourceType !== "REPORT_DERIVED") assert.fail("wrong provenance");
  assert.equal(observation.checkpoint.reportVersionId, REPORT_V1.reportVersionId);
  assert.equal(observation.checkpoint.extractionRunId, REPORT_V1.extractionRunId);
});

contract("TEST B — NO SCORE PRESENT", () => {
  const observation = scoreNotProvided(REPORT_V2, "EQUIFAX");
  assert.equal(observation.presence, "SCORE_NOT_PROVIDED");
  assert.equal(observation.evidenceCompleteness, "NOT_PROVIDED");
  assert.equal("score" in observation, false);
  const invalid = {
    ...observation,
    evidenceRole: undefined,
    score: 640,
  } as unknown as CreditScoreObservationInput;
  assert.throws(
    () => createCreditScoreObservation(invalid),
    /cannot carry an invented score/
  );
});

contract("TEST C — SCORE MODEL MISMATCH", () => {
  const prior = reportScore(REPORT_V1, "EQUIFAX", 610, {
    modelKey: "SYNTHETIC_MODEL_A",
  });
  const current = reportScore(REPORT_V2, "EQUIFAX", 625, {
    modelKey: "SYNTHETIC_MODEL_B",
  });
  const decision = compareCreditScores(TEMPORAL_COMPARISON, prior, current);
  assert.equal(decision.directlyComparable, false);
  assert.equal(decision.delta, null);
  assert.equal(decision.difference?.changeKind, "UNABLE_TO_DETERMINE");
  assert.ok(decision.reasonCodes.includes("SCORE_MODEL_OR_SCALE_NOT_EXACTLY_COMPARABLE"));
});

contract("TEST D — COMPLETE ACCOUNT NO LONGER REPORTED", () => {
  const prior = accountPresence(REPORT_V1, "EQUIFAX", "PRESENT");
  const current = accountPresence(REPORT_V2, "EQUIFAX", "ABSENT_CONFIRMED");
  const difference = compareAccountPresence(TEMPORAL_COMPARISON, prior, current);
  assert.equal(difference.changeKind, "NO_LONGER_REPORTED");
  assert.equal(difference.deletionState, "ABSENT_CONFIRMED_ON_CURRENT_REPORT");
  assert.equal(difference.differenceState, "CHANGED");
});

contract("TEST E — PARSER FAILURE", () => {
  const prior = accountPresence(REPORT_V1, "EQUIFAX", "PRESENT");
  const current = accountPresence(REPORT_V2, "EQUIFAX", "UNKNOWN", {
    completeness: "FAILED",
  });
  const difference = compareAccountPresence(TEMPORAL_COMPARISON, prior, current);
  assert.equal(difference.changeKind, "UNABLE_TO_DETERMINE");
  assert.equal(difference.deletionState, "UNKNOWN_INCOMPLETE");
  assert.notEqual(difference.changeKind, "NO_LONGER_REPORTED");
});

contract("TEST F — CORRECTED FIELD", () => {
  const outcome = correctedOutcome();
  assert.equal(outcome.outcomeState, "CORRECTED");
  assert.equal(outcome.bureau, "EQUIFAX");
  assert.equal(outcome.accountId, "synthetic-account-a");
  assert.equal(outcome.targetFieldKey, "detailedStatus");
  assert.equal(outcome.targetCorrespondenceItemId, "synthetic-correspondence-item-a");
  assert.equal(outcome.targetVersionMembershipId, "synthetic-version-membership-a");
  assert.equal(outcome.causalityState, "TEMPORAL_ASSOCIATION_ONLY");
});

contract("TEST G — UNCHANGED FIELD", () => {
  const prior = fieldObservation(
    REPORT_V1,
    "EQUIFAX",
    "detailedStatus",
    "PRESENT",
    { comparableValue: "CLOSED" }
  );
  const current = fieldObservation(
    REPORT_V2,
    "EQUIFAX",
    "detailedStatus",
    "PRESENT",
    { comparableValue: "CLOSED" }
  );
  const difference = compareFieldObservations(TEMPORAL_COMPARISON, prior, current);
  const boundDifference = persistedDifference(
    difference,
    "synthetic-difference-unchanged-status"
  );
  const outcome = determineDisputeOutcome({
    difference: boundDifference,
    target: approvedTarget({ priorObservationId: prior.sourceObservationId }),
    ...outcomeMetadata(),
  });
  assert.equal(difference.changeKind, "UNCHANGED");
  assert.equal(outcome.outcomeState, "UNCHANGED");
});

contract("TEST H — NEW ACCOUNT", () => {
  const prior = accountPresence(REPORT_V1, "EXPERIAN", "ABSENT_CONFIRMED");
  const current = accountPresence(REPORT_V2, "EXPERIAN", "PRESENT");
  const difference = compareAccountPresence(TEMPORAL_COMPARISON, prior, current);
  assert.equal(difference.changeKind, "NEW_ITEM");
  assert.equal(difference.deletionState, "PRESENT_ON_CURRENT_REPORT");
});

contract("TEST I — CROSS-BUREAU ISOLATION", () => {
  const equifax = compareAccountPresence(
    TEMPORAL_COMPARISON,
    accountPresence(REPORT_V1, "EQUIFAX", "PRESENT"),
    accountPresence(REPORT_V2, "EQUIFAX", "ABSENT_CONFIRMED")
  );
  const transUnion = compareAccountPresence(
    TEMPORAL_COMPARISON,
    accountPresence(REPORT_V1, "TRANSUNION", "PRESENT"),
    accountPresence(REPORT_V2, "TRANSUNION", "PRESENT")
  );
  assert.deepEqual(
    [equifax.bureau, equifax.changeKind],
    ["EQUIFAX", "NO_LONGER_REPORTED"]
  );
  assert.deepEqual(
    [transUnion.bureau, transUnion.changeKind],
    ["TRANSUNION", "UNCHANGED"]
  );
  assert.equal(equifax.deletionState, "ABSENT_CONFIRMED_ON_CURRENT_REPORT");
  assert.equal(transUnion.deletionState, "PRESENT_ON_CURRENT_REPORT");
});

contract("TEST J — CAUSALITY GUARD", () => {
  const score = compareCreditScores(
    TEMPORAL_COMPARISON,
    reportScore(REPORT_V1, "EQUIFAX", 610),
    reportScore(REPORT_V2, "EQUIFAX", 625)
  );
  const removal = compareAccountPresence(
    TEMPORAL_COMPARISON,
    accountPresence(REPORT_V1, "EQUIFAX", "PRESENT"),
    accountPresence(REPORT_V2, "EQUIFAX", "ABSENT_CONFIRMED")
  );
  assert.ok(score.difference);
  const projection = buildProgressProjection({
    context: TEMPORAL_COMPARISON,
    differences: [score.difference, removal],
    scoreComparisons: [score],
    outcomes: [],
  });
  const eq = projection.bureaus.find((entry) => entry.bureau === "EQUIFAX");
  assert.deepEqual(eq?.directlyComparableScores, [
    {
      occurrence: 0,
      priorObservationId: score.priorObservationId,
      currentObservationId: score.currentObservationId,
      prior: 610,
      current: 625,
      delta: 15,
      modelKey: "SYNTHETIC_SCORE_MODEL",
      modelVersion: "1",
    },
  ]);
  assert.equal(eq?.changeCounts.NO_LONGER_REPORTED, 1);
  assert.equal(projection.causalityState, "NO_CAUSAL_CLAIM");
  assert.equal(
    assessCausalityStatement("The removal caused your score to increase.").allowed,
    false
  );
  const rendered = renderNoncausalProgressNarrative({
    kind: "SAME_PERIOD_SCORE_AND_REPORT_CHANGE",
    score,
    difference: removal,
  });
  assert.equal(assessCausalityStatement(rendered.statement, rendered).allowed, true);
});

// ---------------------------------------------------------------------------
// Founder addendum acceptance additions 1-12
// ---------------------------------------------------------------------------

contract("ACCEPTANCE 1 — reports are immutable/versioned", () => {
  const priorBefore = JSON.stringify(REPORT_V1);
  const currentBefore = JSON.stringify(REPORT_V2);
  const created = comparison(REPORT_V1, REPORT_V2, "synthetic-comparison-immutable");
  assert.equal(JSON.stringify(REPORT_V1), priorBefore);
  assert.equal(JSON.stringify(REPORT_V2), currentBefore);
  assert.notEqual(created.prior.reportVersionId, created.current.reportVersionId);
  assert.equal(created.prior.reportVersion, 1);
  assert.equal(created.current.reportVersion, 2);
  assert.equal(created.version, 1);
  assert.match(created.idempotencyKey, /synthetic-comparison-idempotency/);
  assert.equal(created.chronologyBasis, "SAME_SERIES_VERSION_ORDER");
  assert.equal("uploadedAt" in created.prior.reportDateEvidence, false);
});

contract("ACCEPTANCE 2 — reanalysis does not overwrite report truth", () => {
  const reanalysis = checkpoint(1, {
    reportVersionId: REPORT_V1.reportVersionId,
    extractionRunId: "synthetic-extraction-run-1-reanalysis",
    inputDigestCharacter: "a",
    date: "2026-01-10",
  });
  const originalBefore = JSON.stringify(REPORT_V1);
  const created = comparison(
    REPORT_V1,
    reanalysis,
    "synthetic-comparison-reanalysis"
  );
  assert.equal(created.purpose, "EXTRACTION_RECONCILIATION");
  assert.equal(created.chronologyBasis, "NOT_ESTABLISHED");
  assert.ok(created.reasonCodes.includes("SAME_REPORT_REANALYSIS_IS_NOT_TEMPORAL_PROGRESS"));
  assert.equal(JSON.stringify(REPORT_V1), originalBefore);
  assert.notEqual(created.prior.extractionRunId, created.current.extractionRunId);
});

contract("ACCEPTANCE 3 — report-derived scores retain provenance", () => {
  const observation = reportScore(REPORT_V1, "EXPERIAN", 615, {
    observationId: "synthetic-score-provenance",
    sourceMethodKey: "synthetic-parser-exact",
    sourceMethodVersion: "7",
    modelKey: "SYNTHETIC_MODEL_EXACT",
    modelVersion: "4",
  });
  assert.equal(observation.sourceType, "REPORT_DERIVED");
  if (observation.sourceType !== "REPORT_DERIVED") assert.fail("wrong provenance");
  assert.equal(observation.evidenceRole, "PRIMARY_REPORT_EVIDENCE");
  assert.equal(observation.bureauCoverageId, "synthetic-coverage-synthetic-report-version-1-EXPERIAN");
  assert.equal(observation.checkpoint.reportVersionId, REPORT_V1.reportVersionId);
  assert.equal(observation.checkpoint.extractionRunId, REPORT_V1.extractionRunId);
  assert.equal(observation.sourceMethodVersion, "7");
  assert.equal(observation.model.completeness, "COMPLETE");
  assert.equal(
    observation.observationSeriesKey,
    "REPORT_DERIVED|synthetic-report-version-1|synthetic-extraction-run-1|EXPERIAN|synthetic-parser-exact|7|0"
  );
  assert.equal(observation.revision, 1);
  assert.match(observation.idempotencyKey, /synthetic-score-idempotency/);
});

contract("ACCEPTANCE 4 — missing scores are never invented", () => {
  const absent = scoreNotProvided(REPORT_V2, "TRANSUNION");
  assert.equal(absent.presence, "SCORE_NOT_PROVIDED");
  assert.equal("score" in absent, false);
  assert.equal(absent.model.completeness, "UNKNOWN");
  assert.equal(JSON.stringify(absent).includes('"score":'), false);
  const comparisonResult = compareCreditScores(
    TEMPORAL_COMPARISON,
    reportScore(REPORT_V1, "TRANSUNION", 605),
    absent
  );
  assert.equal(comparisonResult.directlyComparable, false);
  assert.equal(comparisonResult.delta, null);
  assert.ok(
    comparisonResult.reasonCodes.includes("SCORE_NOT_REPORTED_ON_BOTH_REPORTS")
  );
});

contract("ACCEPTANCE 5 — incomparable score models are identified", () => {
  const prior = reportScore(REPORT_V1, "TRANSUNION", 605, {
    sourceMethodKey: "synthetic-source-a",
  });
  const current = reportScore(REPORT_V2, "TRANSUNION", 620, {
    sourceMethodKey: "synthetic-source-b",
  });
  const result = compareCreditScores(TEMPORAL_COMPARISON, prior, current);
  assert.equal(result.directlyComparable, false);
  assert.equal(result.delta, null);
  assert.equal(result.difference?.comparability, "NOT_COMPARABLE");
  assert.ok(result.reasonCodes.includes("SCORE_SOURCE_METHOD_MISMATCH"));

  const unknownDateReport = checkpoint(2, {
    reportVersionId: "synthetic-report-version-2-unknown-date",
    extractionRunId: "synthetic-extraction-run-2-unknown-date",
    inputDigestCharacter: "f",
    reportDateEvidence: {
      provenance: "UNKNOWN",
      reasonCode: "SYNTHETIC_DATE_NOT_ESTABLISHED",
    },
  });
  const unknownDateContext = comparison(
    REPORT_V1,
    unknownDateReport,
    "synthetic-comparison-unknown-date"
  );
  const unknownDateResult = compareCreditScores(
    unknownDateContext,
    reportScore(REPORT_V1, "EQUIFAX", 610),
    reportScore(unknownDateReport, "EQUIFAX", 625)
  );
  assert.equal(unknownDateResult.directlyComparable, false);
  assert.ok(
    unknownDateResult.reasonCodes.includes("SOURCE_REPORT_DATES_NOT_COMPARABLE")
  );
});

contract("ACCEPTANCE 6 — bureau-specific changes remain isolated", () => {
  assert.throws(
    () =>
      compareAccountPresence(
        TEMPORAL_COMPARISON,
        accountPresence(REPORT_V1, "EQUIFAX", "PRESENT"),
        accountPresence(REPORT_V2, "EXPERIAN", "ABSENT_CONFIRMED")
      ),
    /bureau-isolated/
  );

  const priorCoverage: BureauCoverageEvidence = {
    ...SYNTHETIC_SCOPE,
    checkpoint: REPORT_V1,
    bureau: "EXPERIAN",
    sourceObservationId: "synthetic-coverage-row-v1-ex",
    coverageStatus: "COVERED",
  };
  const currentCoverage: BureauCoverageEvidence = {
    ...SYNTHETIC_SCOPE,
    checkpoint: REPORT_V2,
    bureau: "EXPERIAN",
    sourceObservationId: "synthetic-coverage-row-v2-ex",
    coverageStatus: "OUTSIDE_COVERAGE",
  };
  const coverageDifference = compareBureauCoverage(
    TEMPORAL_COMPARISON,
    priorCoverage,
    currentCoverage
  );
  assert.equal(coverageDifference.changeKind, "BUREAU_COVERAGE_CHANGED");
  assert.equal(coverageDifference.priorSourceId, "synthetic-coverage-row-v1-ex");
  assert.equal(coverageDifference.currentSourceId, "synthetic-coverage-row-v2-ex");
  assert.equal(coverageDifference.deletionState, "NOT_APPLICABLE");

  const priorIdentity: IdentityFactEvidence = {
    ...SYNTHETIC_SCOPE,
    checkpoint: REPORT_V1,
    bureau: "EQUIFAX",
    sourceObservationId: "synthetic-identity-fact-v1",
    identityBaselineId: "synthetic-identity-baseline-v1",
    factSeriesKey: "synthetic-identity-fact-series",
    completeness: "COMPLETE",
    presence: "PRESENT",
    comparableValue: "SYNTHETIC_VARIANT_A",
  };
  const currentIdentity: IdentityFactEvidence = {
    ...SYNTHETIC_SCOPE,
    checkpoint: REPORT_V2,
    bureau: "EQUIFAX",
    sourceObservationId: "synthetic-identity-fact-v2",
    identityBaselineId: "synthetic-identity-baseline-v2",
    factSeriesKey: "synthetic-identity-fact-series",
    completeness: "COMPLETE",
    presence: "PRESENT",
    comparableValue: "SYNTHETIC_VARIANT_B",
  };
  const identityDifference = compareIdentityFacts(
    TEMPORAL_COMPARISON,
    priorIdentity,
    currentIdentity
  );
  assert.equal(identityDifference.changeKind, "IDENTITY_INFORMATION_CHANGED");
  assert.equal(identityDifference.priorIdentityBaselineId, "synthetic-identity-baseline-v1");
  assert.equal(identityDifference.currentIdentityBaselineId, "synthetic-identity-baseline-v2");
  assert.equal(identityDifference.identityFactSeriesKey, "synthetic-identity-fact-series");
  assert.equal(JSON.stringify(identityDifference).includes("SYNTHETIC_VARIANT"), false);
});

contract(
  "ACCEPTANCE 7 — parser uncertainty is unable to establish NO_LONGER_REPORTED",
  () => {
    const difference = compareAccountPresence(
      TEMPORAL_COMPARISON,
      accountPresence(REPORT_V1, "EQUIFAX", "PRESENT"),
      accountPresence(REPORT_V2, "EQUIFAX", "ABSENT_CONFIRMED", {
        completeness: "PARTIAL",
        suffix: "partial-index",
      })
    );
    assert.equal(difference.changeKind, "UNABLE_TO_DETERMINE");
    assert.equal(difference.deletionState, "UNKNOWN_INCOMPLETE");
    assert.notEqual(difference.changeKind, "NO_LONGER_REPORTED");
  }
);

contract("ACCEPTANCE 8 — prior disputes map at exact-field scope", () => {
  const facts = correctedFieldFacts();
  const bound = persistedDifference(
    facts.difference,
    "synthetic-difference-wrong-field"
  );
  assert.throws(
    () =>
      determineDisputeOutcome({
        difference: bound,
        target: approvedTarget({ fieldKey: "balanceCents" }),
        ...outcomeMetadata(),
      }),
    /exact changed field/
  );
  const exact = correctedOutcome();
  assert.equal(exact.outcomeState, "CORRECTED");
  assert.equal(exact.targetFieldKey, "detailedStatus");
  assert.equal(exact.bureau, "EQUIFAX");
  assert.equal(exact.targetConsumerAssertionId, "synthetic-assertion-a");

  const priorRemark = fieldObservation(
    REPORT_V1,
    "EQUIFAX",
    "consumerDisputeRemarks",
    "PRESENT",
    { comparableValue: "SYNTHETIC_REMARK" }
  );
  const currentRemark = fieldObservation(
    REPORT_V2,
    "EQUIFAX",
    "consumerDisputeRemarks",
    "ABSENT_CONFIRMED",
    { suffix: "not-reported" }
  );
  const fieldPresenceDifference = compareFieldObservations(
    TEMPORAL_COMPARISON,
    priorRemark,
    currentRemark
  );
  const boundFieldPresenceDifference = persistedDifference(
    fieldPresenceDifference,
    "synthetic-difference-remark-not-reported"
  );
  const comparisonOnlyOutcome = determineDisputeOutcome({
    difference: boundFieldPresenceDifference,
    target: approvedTarget({
      fieldKey: "consumerDisputeRemarks",
      priorObservationId: priorRemark.sourceObservationId,
    }),
    ...outcomeMetadata(),
  });
  assert.equal(fieldPresenceDifference.changeKind, "DISPUTE_NOTATION_CHANGED");
  assert.ok(fieldPresenceDifference.reasonCodes.includes("FIELD_PRESENCE_CHANGED"));
  assert.equal(comparisonOnlyOutcome.outcomeState, "CHANGED_DIFFERENTLY");
  assert.notEqual(comparisonOnlyOutcome.outcomeState, "DELETED");
  assert.equal(comparisonOnlyOutcome.decisionSource, "SYSTEM_DERIVED");
});

contract("ACCEPTANCE 9 — outcome history is versioned/auditable", () => {
  const outcome = correctedOutcome(2);
  assert.equal(outcome.version, 2);
  assert.equal(outcome.supersedesOutcomeId, "synthetic-outcome-version-1");
  assert.equal(outcome.decisionSource, "HUMAN_CONFIRMED");
  assert.equal(outcome.decidedByActorId, "synthetic-reviewer-actor");
  assert.equal(outcome.idempotencyKey, "synthetic-outcome-idempotency-2");
  assert.equal(outcome.targetCorrespondenceId, "synthetic-correspondence-a");
  assert.equal(outcome.targetCorrespondenceItemId, "synthetic-correspondence-item-a");
  assert.equal(
    outcome.targetCorrespondenceVersionId,
    "synthetic-approved-correspondence-version-a"
  );
  assert.equal(outcome.targetVersionMembershipId, "synthetic-version-membership-a");
  assert.equal("requestedComparableValue" in outcome, false);
});

contract("ACCEPTANCE 10 — score-change causality is not fabricated", () => {
  const unsafe = assessCausalityStatement(
    "This dispute caused the consumer's score to rise."
  );
  const safe = assessCausalityStatement(
    "The comparable score increased during the same period that one account was no longer reported."
  );
  const rendered = renderNoncausalProgressNarrative({ kind: "CAUSALITY_NOTICE" });
  assert.equal(unsafe.allowed, false);
  assert.equal(unsafe.causalityState, "INSUFFICIENT_EVIDENCE");
  assert.equal(safe.allowed, false);
  assert.equal(safe.causalityState, "INSUFFICIENT_EVIDENCE");
  assert.equal(
    assessCausalityStatement(rendered.statement, rendered).allowed,
    true
  );
  assert.equal(
    assessCausalityStatement(`${rendered.statement} extra`, rendered).allowed,
    false
  );
  assert.match(NO_CAUSAL_ATTRIBUTION_NOTICE, /does not establish/);
});

contract("ACCEPTANCE 11 — Score Tracker projects from report history", () => {
  const score = compareCreditScores(
    TEMPORAL_COMPARISON,
    reportScore(REPORT_V1, "EXPERIAN", 600),
    reportScore(REPORT_V2, "EXPERIAN", 612)
  );
  assert.ok(score.difference);
  const statusDifference = compareFieldObservations(
    TEMPORAL_COMPARISON,
    fieldObservation(REPORT_V1, "EXPERIAN", "summaryStatus", "PRESENT", {
      comparableValue: "SYNTHETIC_STATUS_A",
    }),
    fieldObservation(REPORT_V2, "EXPERIAN", "summaryStatus", "PRESENT", {
      comparableValue: "SYNTHETIC_STATUS_B",
    })
  );
  const projection = buildProgressProjection({
    context: TEMPORAL_COMPARISON,
    differences: [score.difference, statusDifference],
    scoreComparisons: [score],
    outcomes: [],
  });
  const experian = projection.bureaus.find(
    (entry) => entry.bureau === "EXPERIAN"
  );
  assert.deepEqual(experian?.directlyComparableScores, [
    {
      occurrence: 0,
      priorObservationId: score.priorObservationId,
      currentObservationId: score.currentObservationId,
      prior: 600,
      current: 612,
      delta: 12,
      modelKey: "SYNTHETIC_SCORE_MODEL",
      modelVersion: "1",
    },
  ]);
  assert.equal(experian?.changeCounts.SCORE_CHANGED, 1);
  assert.equal(experian?.changeCounts.STATUS_CHANGED, 1);
  assert.equal(projection.causalityState, "NO_CAUSAL_CLAIM");
  assert.equal(PROGRESS_INTELLIGENCE_ROLLOUT_MODE, "DORMANT_PHASE_1");
});

contract("ACCEPTANCE 12 — manual entries remain secondary/provenance-labeled", () => {
  const manual = manualScore("EQUIFAX", 618);
  const report = reportScore(REPORT_V2, "EQUIFAX", 625);
  assert.equal(manual.sourceType, "MANUAL_ENTRY");
  assert.equal(manual.evidenceRole, "SECONDARY_MANUAL_CONTEXT");
  assert.equal(manual.evidenceCompleteness, "MANUAL_UNVERIFIED");
  assert.equal("checkpoint" in manual, false);
  const comparisonResult = compareCreditScores(
    TEMPORAL_COMPARISON,
    manual,
    report
  );
  assert.equal(comparisonResult.directlyComparable, false);
  assert.equal(comparisonResult.difference, null);
  assert.equal(comparisonResult.delta, null);
  assert.ok(comparisonResult.reasonCodes.includes("MANUAL_SCORE_IS_SECONDARY_CONTEXT"));
  assert.throws(
    () =>
      createCreditScoreObservation({
        ...manual,
        evidenceRole: undefined,
        checkpoint: REPORT_V1,
      } as unknown as CreditScoreObservationInput),
    /cannot masquerade as report-derived evidence/
  );
});

// ---------------------------------------------------------------------------
// Final red-team exploit regressions
// ---------------------------------------------------------------------------

contract("RED TEAM 1 — narrative allowlist is closed and tamper-evident", () => {
  const score = compareCreditScores(
    TEMPORAL_COMPARISON,
    reportScore(REPORT_V1, "EQUIFAX", 610),
    reportScore(REPORT_V2, "EQUIFAX", 625)
  );
  const rendered = renderNoncausalProgressNarrative({
    kind: "COMPARABLE_SCORE_CHANGE",
    score,
  });
  assert.equal(Object.isFrozen(rendered), true);
  assert.equal(Object.isFrozen(rendered.sourceObservationIds), true);
  assert.equal(
    assessCausalityStatement(rendered.statement, rendered).allowed,
    true
  );
  assert.equal(
    assessCausalityStatement(
      "The score rose after a report change, and this sentence avoids the word caused."
    ).allowed,
    false
  );
  assert.equal(
    assessCausalityStatement("The dispute produced a 15 point increase.").allowed,
    false
  );
  assert.throws(
    () =>
      renderNoncausalProgressNarrative({
        kind: "COMPARABLE_SCORE_CHANGE",
        score: {
          ...score,
          bureau:
            "EQUIFAX. The dispute caused a score increase" as unknown as Bureau,
        },
      }),
    /closed-domain validation/
  );

  const forged = {
    ...rendered,
    statement: "The dispute caused the score increase.",
  } as unknown as NonNullable<
    Parameters<typeof assessCausalityStatement>[1]
  >;
  assert.equal(
    assessCausalityStatement(forged.statement, forged).allowed,
    false
  );
  try {
    (rendered as unknown as { statement: string }).statement =
      "The dispute caused the score increase.";
  } catch {
    // Frozen branded results are intentionally immutable.
  }
  assert.notEqual(rendered.statement, "The dispute caused the score increase.");
});

contract("RED TEAM 2 — account-presence truth table is exhaustive", () => {
  const known = ["PRESENT", "ABSENT_CONFIRMED"] as const;
  const expected = {
    "PRESENT/PRESENT": ["UNCHANGED", "PRESENT_ON_CURRENT_REPORT"],
    "PRESENT/ABSENT_CONFIRMED": [
      "NO_LONGER_REPORTED",
      "ABSENT_CONFIRMED_ON_CURRENT_REPORT",
    ],
    "ABSENT_CONFIRMED/PRESENT": ["NEW_ITEM", "PRESENT_ON_CURRENT_REPORT"],
    "ABSENT_CONFIRMED/ABSENT_CONFIRMED": ["UNCHANGED", "NOT_APPLICABLE"],
  } as const;
  for (const priorPresence of known) {
    for (const currentPresence of known) {
      const decision = compareAccountPresence(
        TEMPORAL_COMPARISON,
        accountPresence(REPORT_V1, "EQUIFAX", priorPresence, {
          suffix: `${priorPresence}-prior`,
        }),
        accountPresence(REPORT_V2, "EQUIFAX", currentPresence, {
          suffix: `${currentPresence}-current`,
        })
      );
      const tuple = expected[`${priorPresence}/${currentPresence}`];
      assert.equal(decision.changeKind, tuple[0]);
      assert.equal(decision.deletionState, tuple[1]);
      assert.equal(decision.comparability, "COMPARABLE");
      assert.equal(decision.persistenceDisposition, "PERSIST");
    }
  }

  const all = ["PRESENT", "ABSENT_CONFIRMED", "UNKNOWN"] as const;
  for (const priorPresence of all) {
    for (const currentPresence of all) {
      if (priorPresence !== "UNKNOWN" && currentPresence !== "UNKNOWN") continue;
      const decision = compareAccountPresence(
        TEMPORAL_COMPARISON,
        accountPresence(REPORT_V1, "TRANSUNION", priorPresence),
        accountPresence(REPORT_V2, "TRANSUNION", currentPresence)
      );
      assert.equal(decision.changeKind, "UNABLE_TO_DETERMINE");
      assert.equal(decision.comparability, "NOT_COMPARABLE");
      assert.equal(decision.deletionState, "UNKNOWN_INCOMPLETE");
    }
  }
});

contract("RED TEAM 3 — field disappearance uses field vocabulary and exact normalization", () => {
  const prior = fieldObservation(
    REPORT_V1,
    "EQUIFAX",
    "consumerDisputeRemarks",
    "PRESENT",
    { comparableValue: "SYNTHETIC_REMARK" }
  );
  const current = fieldObservation(
    REPORT_V2,
    "EQUIFAX",
    "consumerDisputeRemarks",
    "ABSENT_CONFIRMED"
  );
  const disappeared = compareFieldObservations(
    TEMPORAL_COMPARISON,
    prior,
    current
  );
  assert.equal(disappeared.changeKind, "DISPUTE_NOTATION_CHANGED");
  assert.equal(disappeared.deletionState, "NOT_APPLICABLE");
  assert.ok(disappeared.reasonCodes.includes("FIELD_PRESENCE_CHANGED"));
  const candidate = toReportDifferenceInsertCandidate(disappeared, {
    differenceSeriesKey: "synthetic-field-presence-series",
    version: 1,
    idempotencyKey: "synthetic-field-presence-idempotency",
    comparisonRuleKey: "synthetic-field-rule",
    comparisonRuleVersion: "1",
    sourceSetSha256: digest("1"),
    integritySha256: digest("2"),
    createdByActorId: "synthetic-system-actor",
  });
  assert.equal(candidate.priorFieldObservationId, prior.sourceObservationId);
  assert.equal(candidate.currentFieldObservationId, current.sourceObservationId);
  assert.equal(candidate.priorScoreSourceMethodKey, null);
  assert.equal(JSON.stringify(candidate).includes("SYNTHETIC_REMARK"), false);

  const normalizationMismatch = compareFieldObservations(
    TEMPORAL_COMPARISON,
    prior,
    fieldObservation(
      REPORT_V2,
      "EQUIFAX",
      "consumerDisputeRemarks",
      "PRESENT",
      {
        comparableValue: "SYNTHETIC_REMARK",
        normalizationRuleVersion: "2",
      }
    )
  );
  assert.equal(normalizationMismatch.changeKind, "UNABLE_TO_DETERMINE");
  assert.equal(normalizationMismatch.comparability, "NOT_COMPARABLE");
  assert.ok(
    normalizationMismatch.reasonCodes.includes(
      "FIELD_NORMALIZATION_RULE_MISMATCH"
    )
  );
});

contract("RED TEAM 4 — persisted difference and approved target cannot be substituted", () => {
  const facts = correctedFieldFacts();
  const candidate = toReportDifferenceInsertCandidate(facts.difference, {
    differenceSeriesKey: "synthetic-binding-series",
    version: 1,
    idempotencyKey: "synthetic-binding-idempotency",
    comparisonRuleKey: "synthetic-binding-rule",
    comparisonRuleVersion: "1",
    sourceSetSha256: digest("3"),
    integritySha256: digest("4"),
    createdByActorId: "synthetic-system-actor",
  });
  const binding = bindPersistedReportDifference(facts.difference, {
    id: "synthetic-exact-persisted-difference",
    candidate,
  });
  assert.equal(Object.isFrozen(binding), true);
  assert.equal(Object.isFrozen(binding.decision), true);
  candidate.currentFieldObservationId = "synthetic-attacker-source";
  assert.equal(
    binding.candidate.currentFieldObservationId,
    facts.current.sourceObservationId
  );

  const tamperedCandidate = {
    ...binding.candidate,
    currentFieldObservationId: "synthetic-attacker-source",
  };
  assert.throws(
    () =>
      bindPersistedReportDifference(facts.difference, {
        id: "synthetic-tampered-difference",
        candidate: tamperedCandidate,
      }),
    /does not match the exact evaluated source decision/
  );

  const target = approvedTarget({
    priorObservationId: facts.prior.sourceObservationId,
  });
  const forgedBinding = {
    ...binding,
    id: "synthetic-attacker-difference-id",
  } as unknown as VerifiedReportDifferenceBinding;
  assert.throws(
    () =>
      determineDisputeOutcome({
        difference: forgedBinding,
        target,
        ...outcomeMetadata(),
      }),
    /verified persisted difference binding/
  );
  const forgedTarget = {
    ...target,
    target: { ...target.target, fieldKey: "balanceCents" },
  } as unknown as VerifiedApprovedCorrespondenceTarget;
  assert.throws(
    () =>
      determineDisputeOutcome({
        difference: binding,
        target: forgedTarget,
        ...outcomeMetadata(),
      }),
    /verified approved correspondence binding/
  );
  assert.throws(
    () => approvedTarget({ versionStatus: "DRAFT" }),
    /exact APPROVED/
  );
  assert.throws(
    () => approvedTarget({ membershipItemId: "synthetic-wrong-item" }),
    /one exact correspondence chain/
  );
  assert.throws(
    () => approvedTarget({ assertionDisposition: "REVOKED" }),
    /active, closed-domain consumer assertion/
  );
});

contract("RED TEAM 5 — conflict and correction states require exact human confirmation", () => {
  const facts = correctedFieldFacts();
  const difference = persistedDifference(
    facts.difference,
    "synthetic-decision-source-difference"
  );
  const target = approvedTarget({
    priorObservationId: facts.prior.sourceObservationId,
  });
  const system = determineDisputeOutcome({
    difference,
    target,
    currentConflictsWithAssertion: true,
    differenceId: "synthetic-caller-controlled-id",
    decisionSource: "HUMAN_CONFIRMED",
    ...outcomeMetadata(),
  } as unknown as Parameters<typeof determineDisputeOutcome>[0]);
  assert.equal(system.differenceId, difference.id);
  assert.equal(system.outcomeState, "CHANGED_DIFFERENTLY");
  assert.equal(system.decisionSource, "SYSTEM_DERIVED");
  assert.equal(system.decidedByActorId, null);
  assert.equal("currentConflictsWithAssertion" in system, false);

  const confirmation = bindHumanOutcomeConfirmation({
    snapshot: {
      ...SYNTHETIC_SCOPE,
      id: "synthetic-new-conflict-confirmation",
      comparisonId: facts.difference.comparisonId,
      differenceId: difference.id,
      correspondenceItemId: target.target.correspondenceItemId,
      currentSourceObservationId: facts.current.sourceObservationId,
      confirmedState: "NEW_CONFLICT",
      confirmedByActorId: "synthetic-human-reviewer",
      confirmedAt: "2026-02-14T12:00:00.000Z",
    },
    difference,
    target,
  });
  const human = determineDisputeOutcome({
    difference,
    target,
    humanConfirmation: confirmation,
    ...outcomeMetadata(),
  });
  assert.equal(human.outcomeState, "NEW_CONFLICT");
  assert.equal(human.decisionSource, "HUMAN_CONFIRMED");
  assert.equal(human.decidedByActorId, "synthetic-human-reviewer");
  assert.notEqual(human.outcomeState, "DELETED");

  assert.throws(
    () =>
      bindHumanOutcomeConfirmation({
        snapshot: {
          ...confirmation.confirmation,
          id: "synthetic-mismatched-confirmation",
          currentSourceObservationId: "synthetic-attacker-source",
        },
        difference,
        target,
      }),
    /does not bind the exact changed field outcome/
  );
});

contract("RED TEAM 6 — score occurrences project deterministically without overwrite", () => {
  const occurrence0 = compareCreditScores(
    TEMPORAL_COMPARISON,
    reportScore(REPORT_V1, "EXPERIAN", 600, { occurrence: 0 }),
    reportScore(REPORT_V2, "EXPERIAN", 612, { occurrence: 0 })
  );
  const occurrence1 = compareCreditScores(
    TEMPORAL_COMPARISON,
    reportScore(REPORT_V1, "EXPERIAN", 650, { occurrence: 1 }),
    reportScore(REPORT_V2, "EXPERIAN", 649, { occurrence: 1 })
  );
  assert.ok(occurrence0.difference);
  assert.ok(occurrence1.difference);
  assert.equal(occurrence0.difference.scoreOccurrence, 0);
  assert.equal(occurrence1.difference.scoreOccurrence, 1);
  const projection = buildProgressProjection({
    context: TEMPORAL_COMPARISON,
    differences: [occurrence1.difference, occurrence0.difference],
    scoreComparisons: [occurrence1, occurrence0],
    outcomes: [],
  });
  const series = projection.bureaus.find(
    (entry) => entry.bureau === "EXPERIAN"
  )?.directlyComparableScores;
  assert.deepEqual(
    series?.map((entry) => [entry.occurrence, entry.delta]),
    [
      [0, 12],
      [1, -1],
    ]
  );
  assert.throws(
    () =>
      buildProgressProjection({
        context: TEMPORAL_COMPARISON,
        differences: [occurrence0.difference!],
        scoreComparisons: [occurrence0, occurrence0],
        outcomes: [],
      }),
    /duplicate comparable score occurrence/
  );

  const invalidPair = compareCreditScores(
    TEMPORAL_COMPARISON,
    reportScore(REPORT_V1, "TRANSUNION", 601, { occurrence: 0 }),
    reportScore(REPORT_V2, "TRANSUNION", 602, { occurrence: 1 })
  );
  assert.equal(invalidPair.directlyComparable, false);
  assert.equal(invalidPair.difference, null);
  assert.ok(invalidPair.reasonCodes.includes("SCORE_OCCURRENCE_MISMATCH"));
});

contract("RED TEAM 7 — score revision chains are exact to report/run/method/occurrence", () => {
  const revision1 = reportScore(REPORT_V1, "EQUIFAX", 610, {
    observationId: "synthetic-score-slot-revision-1",
  });
  const revision2 = reportScore(REPORT_V1, "EQUIFAX", 611, {
    observationId: "synthetic-score-slot-revision-2",
    revision: 2,
    supersedesObservationId: revision1.observationId,
    priorRevision: revision1,
  });
  assert.equal(revision2.revision, 2);
  assert.equal(revision2.observationSeriesKey, revision1.observationSeriesKey);
  assert.equal(revision2.supersedesObservationId, revision1.observationId);

  const nextReport = reportScore(REPORT_V2, "EQUIFAX", 620, {
    observationId: "synthetic-score-next-report-revision-1",
  });
  assert.equal(nextReport.revision, 1);
  assert.equal(nextReport.supersedesObservationId, null);
  assert.notEqual(nextReport.observationSeriesKey, revision1.observationSeriesKey);
  assert.throws(
    () =>
      reportScore(REPORT_V2, "EQUIFAX", 620, {
        observationId: "synthetic-cross-report-revision-2",
        revision: 2,
        supersedesObservationId: revision1.observationId,
        priorRevision: revision1,
      }),
    /same report\/run\/source\/bureau\/occurrence slot/
  );

  const reanalysis = checkpoint(1, {
    reportVersionId: REPORT_V1.reportVersionId,
    extractionRunId: "synthetic-score-reanalysis-run",
    inputDigestCharacter: "9",
    date: "2026-01-10",
  });
  const reanalyzedScore = reportScore(reanalysis, "EQUIFAX", 612, {
    observationId: "synthetic-score-reanalysis-revision-1",
  });
  assert.equal(reanalyzedScore.revision, 1);
  assert.notEqual(
    reanalyzedScore.observationSeriesKey,
    revision1.observationSeriesKey
  );

  const attackerInput = {
    ...nextReport,
    observationId: "synthetic-attacker-series-override",
    idempotencyKey: "synthetic-attacker-series-idempotency",
    observationSeriesKey: "ATTACKER_CONTROLLED_SERIES",
    evidenceRole: undefined,
  } as unknown as CreditScoreObservationInput;
  const derivedSeries = deriveCreditScoreObservationSeriesKey(attackerInput);
  const rebuilt = createCreditScoreObservation(attackerInput);
  assert.notEqual(derivedSeries, "ATTACKER_CONTROLLED_SERIES");
  assert.equal(rebuilt.observationSeriesKey, derivedSeries);

  assert.throws(
    () =>
      createCreditScoreObservation(
        {
          ...revision1,
          tenantId: "synthetic-other-tenant",
          observationId: "synthetic-cross-tenant-revision",
          revision: 2,
          supersedesObservationId: revision1.observationId,
          evidenceRole: undefined,
        } as unknown as CreditScoreObservationInput,
        revision1
      ),
    /one tenant\/consumer scope/
  );
});

contract("RED TEAM 8 — insert candidates match durable encrypted/source-pin shapes", () => {
  const score = reportScore(REPORT_V1, "TRANSUNION", 607, {
    observationId: "synthetic-db-score-reported",
  });
  const envelope = encryptedScoreEnvelope(7);
  const scoreCandidate = toCreditScoreInsertCandidate(score, {
    integritySha256: digest("5"),
    encryptedScore: envelope,
    normalizationRuleKey: "synthetic-score-normalization",
    normalizationRuleVersion: "1",
    parserConfidence: 0.99,
  });
  assert.equal("score" in scoreCandidate, false);
  assert.equal(scoreCandidate.reportVersionId, REPORT_V1.reportVersionId);
  assert.equal(scoreCandidate.extractionRunId, REPORT_V1.extractionRunId);
  assert.equal(scoreCandidate.scoreAlgorithm, "AES_256_GCM");
  assert.notEqual(scoreCandidate.scoreCiphertext, envelope.ciphertext);
  envelope.ciphertext[0] = 255;
  assert.equal(scoreCandidate.scoreCiphertext?.[0], 7);
  assert.throws(
    () =>
      toCreditScoreInsertCandidate(score, {
        integritySha256: digest("5"),
        encryptedScore: encryptedScoreEnvelope(7),
        normalizationRuleKey: "synthetic-score-normalization",
        normalizationRuleVersion: "1",
        errorCodes: ["consumer supplied free-form text"],
      }),
    /bounded machine codes only/
  );

  const absent = scoreNotProvided(REPORT_V2, "TRANSUNION");
  const absentCandidate = toCreditScoreInsertCandidate(absent, {
    integritySha256: digest("6"),
    normalizationRuleKey: "synthetic-score-normalization",
    normalizationRuleVersion: "1",
  });
  assert.equal(absentCandidate.presence, "SCORE_NOT_PROVIDED");
  assert.equal(absentCandidate.scoreCiphertext, null);
  assert.equal(absentCandidate.scoreModelKey, null);
  assert.throws(
    () =>
      toCreditScoreInsertCandidate(absent, {
        integritySha256: digest("6"),
        encryptedScore: encryptedScoreEnvelope(8),
        normalizationRuleKey: "synthetic-score-normalization",
        normalizationRuleVersion: "1",
      }),
    /cannot carry a score ciphertext envelope/
  );

  const manualCandidate = toCreditScoreInsertCandidate(
    manualScore("EXPERIAN", 622),
    {
      integritySha256: digest("7"),
      encryptedScore: encryptedScoreEnvelope(9),
    }
  );
  assert.equal(manualCandidate.reportVersionId, null);
  assert.equal(manualCandidate.extractionRunId, null);
  assert.equal(manualCandidate.evidenceCompleteness, "MANUAL_UNVERIFIED");
  assert.equal(manualCandidate.normalizationRuleKey, null);

  const methodMismatch = compareCreditScores(
    TEMPORAL_COMPARISON,
    reportScore(REPORT_V1, "TRANSUNION", 607, {
      sourceMethodKey: "synthetic-method-a",
    }),
    reportScore(REPORT_V2, "TRANSUNION", 609, {
      sourceMethodKey: "synthetic-method-b",
    })
  );
  assert.ok(methodMismatch.difference);
  const differenceCandidate = toReportDifferenceInsertCandidate(
    methodMismatch.difference,
    {
      differenceSeriesKey: "synthetic-score-method-mismatch-series",
      version: 1,
      idempotencyKey: "synthetic-score-method-mismatch-idempotency",
      comparisonRuleKey: "synthetic-score-comparison-rule",
      comparisonRuleVersion: "1",
      sourceSetSha256: digest("8"),
      integritySha256: digest("9"),
      createdByActorId: "synthetic-system-actor",
    }
  );
  assert.equal(differenceCandidate.scopeType, "CREDIT_SCORE");
  assert.equal(differenceCandidate.scoreOccurrence, 0);
  assert.equal(
    differenceCandidate.priorScoreSourceMethodKey,
    "synthetic-method-a"
  );
  assert.equal(
    differenceCandidate.currentScoreSourceMethodKey,
    "synthetic-method-b"
  );
  assert.equal(
    differenceCandidate.priorScoreObservationId,
    methodMismatch.priorObservationId
  );
  assert.equal(
    differenceCandidate.currentScoreObservationId,
    methodMismatch.currentObservationId
  );
});

console.log(`\n${passed} contract groups passed; ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
