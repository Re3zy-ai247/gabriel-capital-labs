// Production-linked P0 assessment and ConsumerAssertion guard.
// Synthetic data only: no consumer identity, report text, account numbers, or addresses.
// Run: npx --no-install tsx scripts/p0-assessment.test.ts
import type { Bureau } from "@prisma/client";
import {
  assessCreditTruthAccount,
  type AssessCreditTruthAccountOptions,
} from "../lib/creditTruth/assessment";
import {
  CONSUMER_ASSERTION_BINDING_VERSION,
  validateConsumerAssertionBinding,
  type AssertionBindingComponent,
  type BoundConsumerAssertion,
  type ObservationBinding,
} from "../lib/creditTruth/consumerAssertion";
import { adaptAiParserV2ShadowOutput, type AiParserV2ShadowOutput } from "../lib/creditTruth/parserAiV2";
import type {
  CreditTruthSection,
  ParserObservationInput,
  ParserV2AccountInput,
  ParserV2BureauInput,
  SourceLocator,
} from "../lib/creditTruth/types";

let passed = 0;
let failed = 0;

type InvariantId = "I2" | "I3" | "I4" | "I5" | "I7" | "I8";
const invariantFailures: Record<InvariantId, number> = { I2: 0, I3: 0, I4: 0, I5: 0, I7: 0, I8: 0 };

function check(invariant: InvariantId, label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`✓ [${invariant}] ${label}`);
  } else {
    failed += 1;
    invariantFailures[invariant] += 1;
    console.error(`✗ [${invariant}] ${label}`);
  }
}

function equal(invariant: InvariantId, label: string, actual: unknown, expected: unknown): void {
  const matches = JSON.stringify(actual) === JSON.stringify(expected);
  if (!matches) console.error(`  actual: ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
  check(invariant, label, matches);
}

function locator(section: CreditTruthSection, lineStart = 1): SourceLocator {
  return {
    section,
    page: 1,
    lineStart,
    lineEnd: lineStart,
    blockId: `synthetic-${section.toLowerCase()}-${lineStart}`,
  };
}

function present<T>(value: T, section: CreditTruthSection, lineStart = 1): ParserObservationInput<T> {
  return {
    presence: "PRESENT",
    value,
    locator: locator(section, lineStart),
    confidence: 0.99,
    normalizationRule: "synthetic-assessment-test/v1",
  };
}

function absent<T>(section: CreditTruthSection, lineStart = 1): ParserObservationInput<T> {
  return {
    presence: "ABSENT_CONFIRMED",
    locator: locator(section, lineStart),
    confidence: 0.99,
    normalizationRule: "synthetic-assessment-test/v1",
  };
}

type BureauFieldsInput = NonNullable<ParserV2BureauInput["fields"]>;

function completeBureau(
  fieldOverrides: Partial<BureauFieldsInput> = {},
  sectionOverrides: ParserV2BureauInput["sectionCompleteness"] = {}
): ParserV2BureauInput {
  return {
    accountPresence: present(true, "ACCOUNT_INDEX"),
    sectionCompleteness: {
      ACCOUNT_INDEX: { state: "COMPLETE", locator: locator("ACCOUNT_INDEX") },
      ACCOUNT_SUMMARY: { state: "COMPLETE", locator: locator("ACCOUNT_SUMMARY") },
      ACCOUNT_DETAIL: { state: "COMPLETE", locator: locator("ACCOUNT_DETAIL") },
      PAYMENT_HISTORY: { state: "COMPLETE", locator: locator("PAYMENT_HISTORY") },
      COLLECTIONS: { state: "COMPLETE", locator: locator("COLLECTIONS") },
      REMARKS: { state: "COMPLETE", locator: locator("REMARKS") },
      ...sectionOverrides,
    },
    fields: {
      summaryStatus: present("Closed", "ACCOUNT_SUMMARY", 2),
      detailedStatus: present("Paid as agreed", "ACCOUNT_DETAIL", 3),
      balanceCents: present(0, "ACCOUNT_SUMMARY", 4),
      reportedDate: present("2025-02-01", "ACCOUNT_SUMMARY", 5),
      dofd: absent<string>("ACCOUNT_DETAIL", 6),
      relevantDates: present([{ kind: "CLOSED", isoDate: "2025-01-15" }], "ACCOUNT_DETAIL", 7),
      paymentHistory: present([{ period: "2025-01", rating: "OK", daysLate: 0 }], "PAYMENT_HISTORY", 8),
      collectionFacts: absent("COLLECTIONS", 9),
      chargeOffMarker: present(false, "ACCOUNT_DETAIL", 10),
      lossReported: present(false, "ACCOUNT_DETAIL", 11),
      transferOrSale: present(false, "REMARKS", 12),
      consumerDisputeRemarks: absent("REMARKS", 13),
      productType: present("REVOLVING", "ACCOUNT_DETAIL", 14),
      remarks: absent("REMARKS", 15),
      ...fieldOverrides,
    },
  };
}

function account(sourceAccountKey: string, bureaus: ParserV2AccountInput["bureaus"]): ParserV2AccountInput {
  return {
    sourceAccountKey,
    creditorName: present(`Synthetic ${sourceAccountKey}`, "ACCOUNT_INDEX"),
    bureaus,
  };
}

const parserOutput: AiParserV2ShadowOutput = {
  parserVersion: "synthetic-assessment-parser-v1",
  accounts: [
    account("definite-adverse", {
      EQUIFAX: completeBureau({
        summaryStatus: present("Collection Account", "ACCOUNT_SUMMARY", 20),
        detailedStatus: present("Charged off", "ACCOUNT_DETAIL", 21),
        collectionFacts: present([{ kind: "COLLECTION_ACCOUNT", amountCents: 51_000 }], "COLLECTIONS", 22),
        chargeOffMarker: present(true, "ACCOUNT_DETAIL", 23),
      }),
    }),
    account("historical-adverse", {
      EQUIFAX: completeBureau({
        paymentHistory: present(
          [{ period: "2024-09", rating: "120 days late", daysLate: 120 }],
          "PAYMENT_HISTORY",
          30
        ),
      }),
    }),
    account("paid-good-standing", {
      EQUIFAX: completeBureau(),
    }),
    account("unknown-completeness", {
      EQUIFAX: completeBureau(
        { paymentHistory: { presence: "UNKNOWN", reason: "PARSER_SILENCE" } },
        { PAYMENT_HISTORY: { state: "UNKNOWN" } }
      ),
    }),
    account("never-late-clean", {
      EQUIFAX: completeBureau({
        detailedStatus: present("Never late", "ACCOUNT_DETAIL", 40),
      }),
    }),
    account("never-late-with-adverse", {
      EQUIFAX: completeBureau({
        detailedStatus: present("Never late; Collection Account", "ACCOUNT_DETAIL", 41),
      }),
    }),
    account("never-late-remark-clean", {
      EQUIFAX: completeBureau({
        remarks: present(["Never late"], "REMARKS", 42),
      }),
    }),
    account("never-late-remark-with-adverse", {
      EQUIFAX: completeBureau({
        remarks: present(["Never late; Collection Account"], "REMARKS", 43),
      }),
    }),
    account("neutral-only", {
      EQUIFAX: completeBureau({
        summaryStatus: present("Closed", "ACCOUNT_SUMMARY", 44),
        detailedStatus: present("Closed", "ACCOUNT_DETAIL", 45),
      }),
    }),
  ],
};

const parserBefore = JSON.stringify(parserOutput);
const parsed = adaptAiParserV2ShadowOutput(parserOutput, ["EQUIFAX"]);
equal("I2", "assessment input adapter remains pure", JSON.stringify(parserOutput), parserBefore);

const definiteAdverse = assessCreditTruthAccount(parsed[0]);
const historicalAdverse = assessCreditTruthAccount(parsed[1]);
const paidGoodStanding = assessCreditTruthAccount(parsed[2]);
const unknownCompleteness = assessCreditTruthAccount(parsed[3]);
const neverLateClean = assessCreditTruthAccount(parsed[4]);
const neverLateWithAdverse = assessCreditTruthAccount(parsed[5]);
const neverLateRemarkClean = assessCreditTruthAccount(parsed[6]);
const neverLateRemarkWithAdverse = assessCreditTruthAccount(parsed[7]);
const neutralOnly = assessCreditTruthAccount(parsed[8]);

// Invariant 2: collection + charge-off history cannot classify Clean.
equal("I2", "collection plus charge-off classifies DEROGATORY", definiteAdverse.accountCondition, "DEROGATORY");
check("I2", "collection plus charge-off can never classify CLEAN", definiteAdverse.accountCondition !== "CLEAN");
equal("I2", "definite adverse source evidence reports ADVERSE", definiteAdverse.reportedAdversity, "ADVERSE");
equal(
  "I2",
  "unconfirmed adverse observations require consumer review instead of asserted grounds",
  definiteAdverse.disputeGrounds,
  "CONSUMER_REVIEW_REQUIRED"
);
check("I2", "negated clean phrase cannot hide a separate adverse status", neverLateWithAdverse.accountCondition !== "CLEAN");
check(
  "I2",
  "negated clean remark cannot hide separate adverse remark text",
  neverLateRemarkWithAdverse.accountCondition !== "CLEAN"
);

// Invariant 3: Closed/$0 cannot erase historical 120-day delinquency.
check(
  "I3",
  "parser output retains 120-day historical delinquency",
  parsed[1].bureaus.EQUIFAX.historicalEvidence.some(
    (item) => item.kind === "PAYMENT_DELINQUENCY" && item.observation.value.daysLate === 120
  )
);
equal("I3", "current paid/closed plus adverse history classifies MIXED", historicalAdverse.accountCondition, "MIXED");
check("I3", "historical adversity is monotonic against CLEAN", historicalAdverse.accountCondition !== "CLEAN");
equal("I3", "historical adversity remains ADVERSE", historicalAdverse.reportedAdversity, "ADVERSE");

// Invariant 4: a complete paid/closed good-standing control may classify Clean.
equal("I4", "complete paid/closed control classifies CLEAN", paidGoodStanding.accountCondition, "CLEAN");
equal("I4", "clean control requires COMPLETE evidence", paidGoodStanding.evidenceCompleteness, "COMPLETE");
equal("I4", "affirmative good-standing control reports FAVORABLE", paidGoodStanding.reportedAdversity, "FAVORABLE");
equal("I4", "clean control has no detected unconfirmed dispute grounds", paidGoodStanding.disputeGrounds, "NONE_DETECTED");
equal("I4", "explicit Never late status is affirmative non-adverse", neverLateClean.accountCondition, "CLEAN");
equal("I4", "explicit Never late status reports FAVORABLE", neverLateClean.reportedAdversity, "FAVORABLE");
equal("I4", "Never late remark does not become adverse", neverLateRemarkClean.accountCondition, "CLEAN");
equal("I4", "Never late remark preserves FAVORABLE adversity roll-up", neverLateRemarkClean.reportedAdversity, "FAVORABLE");
equal("I4", "complete neutral-only status requires review", neutralOnly.accountCondition, "NEEDS_REVIEW");
equal("I4", "neutral-only evidence remains complete", neutralOnly.evidenceCompleteness, "COMPLETE");
equal("I4", "neutral-only status reports NEUTRAL adversity", neutralOnly.reportedAdversity, "NEUTRAL");
check(
  "I4",
  "neutral-only status records insufficient affirmative evidence",
  neutralOnly.rationaleCodes.includes("INSUFFICIENT_AFFIRMATIVE_EVIDENCE")
);

// Invariant 5: UNKNOWN completeness cannot classify Clean.
equal("I5", "UNKNOWN payment-history section classifies NEEDS_REVIEW", unknownCompleteness.accountCondition, "NEEDS_REVIEW");
equal("I5", "UNKNOWN evidence remains UNKNOWN", unknownCompleteness.evidenceCompleteness, "UNKNOWN");
check("I5", "UNKNOWN completeness can never classify CLEAN", unknownCompleteness.accountCondition !== "CLEAN");

const crossBureauOutput: AiParserV2ShadowOutput = {
  parserVersion: "synthetic-assessment-parser-v1",
  accounts: [
    account("cross-bureau-scope", {
      EQUIFAX: completeBureau(),
      TRANSUNION: completeBureau(
        { paymentHistory: { presence: "UNKNOWN", reason: "PARSE_FAILURE" } },
        { PAYMENT_HISTORY: { state: "FAILED", errors: [{ code: "SYNTHETIC_FAILURE", message: "Synthetic." }] } }
      ),
    }),
  ],
};
const scoped = assessCreditTruthAccount(
  adaptAiParserV2ShadowOutput(crossBureauOutput, ["EQUIFAX", "TRANSUNION"])[0]
);
equal("I5", "covered clean bureau remains independently CLEAN", scoped.bureauAssessments.EQUIFAX.accountCondition, "CLEAN");
equal("I5", "covered unknown bureau remains NEEDS_REVIEW", scoped.bureauAssessments.TRANSUNION.accountCondition, "NEEDS_REVIEW");
equal("I5", "one clean bureau cannot make an incomplete account globally CLEAN", scoped.accountCondition, "NEEDS_REVIEW");

const directAbsenceOutput: AiParserV2ShadowOutput = {
  parserVersion: "synthetic-assessment-parser-v1",
  accounts: [
    account("direct-absence-provenance", {
      EQUIFAX: {
        accountPresence: absent<true>("ACCOUNT_INDEX", 70),
        sectionCompleteness: {
          ACCOUNT_INDEX: { state: "COMPLETE", locator: locator("ACCOUNT_INDEX", 70) },
        },
      },
    }),
  ],
};
const validDirectAbsence = structuredClone(
  adaptAiParserV2ShadowOutput(directAbsenceOutput, ["EQUIFAX"])[0]
);
const validDirectAbsenceAssessment = assessCreditTruthAccount(validDirectAbsence);
equal(
  "I5",
  "direct valid account-index absence remains CONFIRMED_ABSENT",
  validDirectAbsenceAssessment.bureauAssessments.EQUIFAX.scope,
  "CONFIRMED_ABSENT"
);

const wrongAbsenceLocator = structuredClone(validDirectAbsence);
if (wrongAbsenceLocator.bureaus.EQUIFAX.accountPresence.presence === "ABSENT_CONFIRMED") {
  wrongAbsenceLocator.bureaus.EQUIFAX.accountPresence.provenance.locator.section = "ACCOUNT_DETAIL";
}
const wrongAbsenceLocatorAssessment = assessCreditTruthAccount(wrongAbsenceLocator);
equal(
  "I5",
  "direct absence outside ACCOUNT_INDEX is UNKNOWN",
  wrongAbsenceLocatorAssessment.bureauAssessments.EQUIFAX.scope,
  "UNKNOWN"
);
equal(
  "I5",
  "direct absence outside ACCOUNT_INDEX requires review",
  wrongAbsenceLocatorAssessment.bureauAssessments.EQUIFAX.accountCondition,
  "NEEDS_REVIEW"
);
check(
  "I5",
  "malformed absence records account-presence uncertainty",
  wrongAbsenceLocatorAssessment.bureauAssessments.EQUIFAX.rationaleCodes.includes("ACCOUNT_PRESENCE_UNKNOWN")
);

const wrongIndexCompletenessLocator = structuredClone(validDirectAbsence);
if (wrongIndexCompletenessLocator.bureaus.EQUIFAX.sectionCompleteness.ACCOUNT_INDEX.locator) {
  wrongIndexCompletenessLocator.bureaus.EQUIFAX.sectionCompleteness.ACCOUNT_INDEX.locator.section = "ACCOUNT_DETAIL";
}
equal(
  "I5",
  "direct non-index completeness locator cannot confirm absence",
  assessCreditTruthAccount(wrongIndexCompletenessLocator).bureauAssessments.EQUIFAX.scope,
  "UNKNOWN"
);

const exactBinding: ObservationBinding = {
  tenantId: "opaque-tenant-A",
  consumerId: "opaque-consumer-A",
  observationId: "opaque-observation-A",
  reportVersionId: "opaque-report-version-A",
  extractionRunId: "opaque-extraction-run-A",
  accountId: "opaque-account-A",
  bureau: "EQUIFAX",
  field: "detailedStatus",
  observationSeriesKey: "opaque-observation-series-A",
  observationRevision: 1,
  observationDigest: "a".repeat(64),
};
const assertion: BoundConsumerAssertion = {
  bindingVersion: CONSUMER_ASSERTION_BINDING_VERSION,
  assertionId: "opaque-assertion-A",
  disposition: "CONFIRMED_INACCURATE",
  binding: { ...exactBinding },
};
const exactObservationScope = {
  sourceAccountKey: parsed[2].sourceAccountKey,
  tenantId: exactBinding.tenantId,
  consumerId: exactBinding.consumerId,
  accountId: exactBinding.accountId,
  reportVersionId: exactBinding.reportVersionId,
  extractionRunId: exactBinding.extractionRunId,
  currentObservations: [{ ...exactBinding }],
};

// Invariant 7: the assertion must bind to the exact observation and versions.
const assertionBefore = JSON.stringify(assertion);
const exactValidation = validateConsumerAssertionBinding(assertion, { ...exactBinding });
equal("I7", "exact observation/version binding validates CURRENT", exactValidation.status, "CURRENT");
check("I7", "exact binding is valid without reconfirmation", exactValidation.valid && !exactValidation.requiresReconfirmation);
check("I7", "confirmed inaccuracy supports a dispute ground", exactValidation.supportsDisputeGround);
equal("I7", "binding validation is pure", JSON.stringify(assertion), assertionBefore);
check("I7", "binding carries no raw observation value", !("value" in exactBinding));

const forbiddenPrecomputedAuthority: AssessCreditTruthAccountOptions = {
  // @ts-expect-error Precomputed validation and caller strength are intentionally not accepted.
  confirmedDisputeGrounds: [{ strength: "STRONG", assertionValidation: exactValidation }],
};
void forbiddenPrecomputedAuthority;

const confirmedGroundAssessment = assessCreditTruthAccount(parsed[2], {
  observationScope: exactObservationScope,
  consumerAssertionCandidates: [assertion],
});
equal(
  "I7",
  "assessment verifies an exact in-scope assertion internally",
  confirmedGroundAssessment.disputeGrounds,
  "LIMITED"
);

const accurateValidation = validateConsumerAssertionBinding(
  { ...assertion, assertionId: "opaque-assertion-accurate", disposition: "CONFIRMED_ACCURATE" },
  { ...exactBinding }
);
check("I7", "confirmed-accurate binding is current but does not support a dispute ground", !accurateValidation.supportsDisputeGround);
equal(
  "I7",
  "confirmed-accurate assertion cannot elevate dispute grounds",
  assessCreditTruthAccount(parsed[2], {
    observationScope: exactObservationScope,
    consumerAssertionCandidates: [
      { ...assertion, assertionId: "opaque-assertion-accurate", disposition: "CONFIRMED_ACCURATE" },
    ],
  }).disputeGrounds,
  "NONE_DETECTED"
);

// Invariant 8: any changed observation identity/version requires reconfirmation.
const changedBindings: Array<{
  component: AssertionBindingComponent;
  binding: ObservationBinding;
}> = [
  { component: "tenantId", binding: { ...exactBinding, tenantId: "opaque-tenant-B" } },
  { component: "consumerId", binding: { ...exactBinding, consumerId: "opaque-consumer-B" } },
  { component: "observationId", binding: { ...exactBinding, observationId: "opaque-observation-B" } },
  { component: "reportVersionId", binding: { ...exactBinding, reportVersionId: "opaque-report-version-B" } },
  { component: "extractionRunId", binding: { ...exactBinding, extractionRunId: "opaque-extraction-run-B" } },
  { component: "accountId", binding: { ...exactBinding, accountId: "opaque-account-B" } },
  { component: "bureau", binding: { ...exactBinding, bureau: "TRANSUNION" } },
  { component: "field", binding: { ...exactBinding, field: "summaryStatus" } },
  {
    component: "observationSeriesKey",
    binding: { ...exactBinding, observationSeriesKey: "opaque-observation-series-B" },
  },
  { component: "observationRevision", binding: { ...exactBinding, observationRevision: 2 } },
  { component: "observationDigest", binding: { ...exactBinding, observationDigest: "b".repeat(64) } },
];

for (const { component, binding } of changedBindings) {
  const validation = validateConsumerAssertionBinding(assertion, binding);
  equal("I8", `${component} change requires reconfirmation`, validation.status, "RECONFIRMATION_REQUIRED");
  check(
    "I8",
    `${component} change invalidates current use`,
    !validation.valid && validation.requiresReconfirmation && validation.changedComponents.includes(component)
  );
}

function groundsAgainstCurrent(
  current: ObservationBinding,
  target = parsed[2],
  candidate: BoundConsumerAssertion = assertion
) {
  return assessCreditTruthAccount(target, {
    observationScope: {
      sourceAccountKey: target.sourceAccountKey,
      tenantId: current.tenantId,
      consumerId: current.consumerId,
      accountId: current.accountId,
      reportVersionId: current.reportVersionId,
      extractionRunId: current.extractionRunId,
      currentObservations: [current],
    },
    consumerAssertionCandidates: [candidate],
  }).disputeGrounds;
}

const groundReplayCases: Array<{ label: string; current: ObservationBinding }> = [
  { label: "unrelated tenant", current: { ...exactBinding, tenantId: "opaque-tenant-B" } },
  { label: "unrelated consumer", current: { ...exactBinding, consumerId: "opaque-consumer-B" } },
  { label: "unrelated observation", current: { ...exactBinding, observationId: "opaque-observation-B" } },
  { label: "unrelated account", current: { ...exactBinding, accountId: "opaque-account-B" } },
  { label: "unrelated bureau", current: { ...exactBinding, bureau: "TRANSUNION" } },
  { label: "unrelated field", current: { ...exactBinding, field: "summaryStatus" } },
  { label: "changed report version", current: { ...exactBinding, reportVersionId: "opaque-report-version-B" } },
  { label: "changed extraction run", current: { ...exactBinding, extractionRunId: "opaque-extraction-run-B" } },
  { label: "changed series", current: { ...exactBinding, observationSeriesKey: "opaque-observation-series-B" } },
  { label: "changed revision", current: { ...exactBinding, observationRevision: 2 } },
  { label: "changed digest", current: { ...exactBinding, observationDigest: "b".repeat(64) } },
];

for (const { label, current } of groundReplayCases) {
  equal("I8", `${label} cannot elevate grounds`, groundsAgainstCurrent(current), "NONE_DETECTED");
}

equal(
  "I8",
  "exact assertion scope cannot be replayed onto another assessed account",
  assessCreditTruthAccount(parsed[1], {
    observationScope: exactObservationScope,
    consumerAssertionCandidates: [assertion],
  }).disputeGrounds,
  "CONSUMER_REVIEW_REQUIRED"
);

equal(
  "I8",
  "precomputed validation without exact scope is not accepted as authority",
  assessCreditTruthAccount(parsed[2], { consumerAssertionCandidates: [assertion] }).disputeGrounds,
  "NONE_DETECTED"
);

const malformedValidation = validateConsumerAssertionBinding(assertion, {
  ...exactBinding,
  observationDigest: "",
});
equal("I8", "missing opaque integrity metadata is an invalid binding", malformedValidation.status, "INVALID_BINDING");

const uppercaseDigestValidation = validateConsumerAssertionBinding(assertion, {
  ...exactBinding,
  observationDigest: "A".repeat(64),
});
equal(
  "I8",
  "integrity digest must use durable-schema lowercase SHA-256 form",
  uppercaseDigestValidation.status,
  "INVALID_BINDING"
);

console.log("\nProduction-linked invariant status:");
for (const invariant of Object.keys(invariantFailures) as InvariantId[]) {
  console.log(`${invariant}: ${invariantFailures[invariant] === 0 ? "PASS" : "FAIL"}`);
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
