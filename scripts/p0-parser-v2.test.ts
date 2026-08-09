// Production-linked parser-v2 shadow-contract guard.
// Synthetic data only: no consumer identity, report text, account numbers, or addresses.
// Run: npx --no-install tsx scripts/p0-parser-v2.test.ts
import type { Bureau } from "@prisma/client";
import {
  AI_PARSER_V2_SHADOW_RULES,
  adaptAiParserV2ShadowOutput,
  type AiParserV2ShadowOutput,
} from "../lib/aiParse";
import {
  extractRawTradelines,
  extractRegexParserV2Shadow,
  type RegexParserV2ShadowOutput,
} from "../lib/parse";
import type {
  CreditTruthSection,
  ParserObservationInput,
  ParserV2BureauInput,
  SourceLocator,
} from "../lib/creditTruth/types";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

function equal(label: string, actual: unknown, expected: unknown): void {
  const matches = JSON.stringify(actual) === JSON.stringify(expected);
  if (!matches) console.error(`  actual: ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
  check(label, matches);
}

function locator(section: CreditTruthSection, lineStart = 1): SourceLocator {
  return { section, page: 1, lineStart, lineEnd: lineStart, blockId: `synthetic-${section.toLowerCase()}` };
}

function present<T>(
  value: T,
  section: CreditTruthSection,
  lineStart = 1,
  confidence = 0.99
): ParserObservationInput<T> {
  return {
    presence: "PRESENT",
    value,
    locator: locator(section, lineStart),
    confidence,
    normalizationRule: "synthetic-test/v1",
  };
}

function absent(section: CreditTruthSection, lineStart = 1) {
  return {
    presence: "ABSENT_CONFIRMED" as const,
    locator: locator(section, lineStart),
    confidence: 0.99,
    normalizationRule: "synthetic-test/explicit-absence-v1",
  };
}

function presentBureau(fields: ParserV2BureauInput["fields"]): ParserV2BureauInput {
  return {
    accountPresence: present(true, "ACCOUNT_INDEX"),
    sectionCompleteness: {
      ACCOUNT_INDEX: { state: "COMPLETE", locator: locator("ACCOUNT_INDEX") },
      ACCOUNT_SUMMARY: { state: "COMPLETE", locator: locator("ACCOUNT_SUMMARY") },
      ACCOUNT_DETAIL: { state: "COMPLETE", locator: locator("ACCOUNT_DETAIL") },
      PAYMENT_HISTORY: { state: "COMPLETE", locator: locator("PAYMENT_HISTORY") },
      COLLECTIONS: { state: "COMPLETE", locator: locator("COLLECTIONS") },
      REMARKS: { state: "COMPLETE", locator: locator("REMARKS") },
    },
    fields,
  };
}

const covered: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

// ---- AI v2: bureau isolation + UNKNOWN versus confirmed absence ----
const aiOutput: AiParserV2ShadowOutput = {
  parserVersion: "ai-shadow-test-v1",
  accounts: [
    {
      sourceAccountKey: "synthetic-account-isolation",
      creditorName: present("Synthetic Harbor Account", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: presentBureau({
          summaryStatus: present("Collection Account", "ACCOUNT_SUMMARY", 2, 0.93),
          balanceCents: present(51_000, "ACCOUNT_SUMMARY", 3),
          dofd: absent("ACCOUNT_DETAIL", 7),
          chargeOffMarker: present(true, "ACCOUNT_DETAIL", 8),
          productType: present("REVOLVING", "ACCOUNT_DETAIL", 9),
        }),
        EXPERIAN: {
          accountPresence: {
            presence: "ABSENT_CONFIRMED",
            locator: locator("ACCOUNT_INDEX", 10),
            confidence: 0.98,
          },
          sectionCompleteness: {
            ACCOUNT_INDEX: { state: "COMPLETE", locator: locator("ACCOUNT_INDEX", 10) },
          },
        },
        TRANSUNION: presentBureau({
          summaryStatus: present("Closed", "ACCOUNT_SUMMARY", 12),
          balanceCents: present(0, "ACCOUNT_SUMMARY", 13),
          productType: present("REVOLVING", "ACCOUNT_DETAIL", 14),
        }),
      },
    },
    {
      sourceAccountKey: "synthetic-account-silence",
      creditorName: present("Synthetic Quiet Account", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: {
          accountPresence: present(true, "ACCOUNT_INDEX"),
          sectionCompleteness: {
            ACCOUNT_INDEX: { state: "COMPLETE", locator: locator("ACCOUNT_INDEX") },
            ACCOUNT_SUMMARY: { state: "PARTIAL", locator: locator("ACCOUNT_SUMMARY") },
          },
          fields: {},
        },
      },
    },
    {
      sourceAccountKey: "synthetic-unsupported-absence",
      creditorName: present("Synthetic Incomplete Index Account", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: {
          accountPresence: {
            presence: "ABSENT_CONFIRMED",
            locator: locator("ACCOUNT_INDEX"),
          },
          sectionCompleteness: {
            ACCOUNT_INDEX: { state: "PARTIAL", locator: locator("ACCOUNT_INDEX") },
          },
        },
      },
    },
    {
      sourceAccountKey: "synthetic-failed-section",
      creditorName: present("Synthetic Failed Section Account", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: {
          accountPresence: present(true, "ACCOUNT_INDEX"),
          sectionCompleteness: {
            ACCOUNT_INDEX: { state: "COMPLETE", locator: locator("ACCOUNT_INDEX") },
            PAYMENT_HISTORY: {
              state: "FAILED",
              locator: locator("PAYMENT_HISTORY"),
              errors: [{ code: "SYNTHETIC_PARSE_FAILURE", message: "Synthetic section failure." }],
            },
            ACCOUNT_DETAIL: { state: "PARTIAL", locator: locator("ACCOUNT_DETAIL") },
            ACCOUNT_SUMMARY: { state: "COMPLETE", locator: locator("ACCOUNT_SUMMARY") },
            COLLECTIONS: {
              state: "FAILED",
              locator: locator("COLLECTIONS"),
              errors: [{ code: "SYNTHETIC_COLLECTION_FAILURE", message: "Synthetic section failure." }],
            },
            REMARKS: {
              state: "FAILED",
              locator: locator("REMARKS"),
              errors: [{ code: "SYNTHETIC_REMARKS_FAILURE", message: "Synthetic section failure." }],
            },
          },
          fields: {
            dofd: absent("ACCOUNT_DETAIL"),
            paymentHistory: absent("ACCOUNT_SUMMARY"),
            collectionFacts: absent("COLLECTIONS"),
          },
        },
      },
    },
    {
      sourceAccountKey: "synthetic-conflicting-payment-entry",
      creditorName: present("Synthetic Numeric History Account", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: presentBureau({
          paymentHistory: present(
            [{ period: "synthetic-period", rating: "Never late", daysLate: 30 }],
            "PAYMENT_HISTORY"
          ),
        }),
      },
    },
    {
      sourceAccountKey: "synthetic-account-absence-alternate-locator",
      creditorName: present("Synthetic Alternate Locator Account", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: {
          accountPresence: absent("ACCOUNT_DETAIL"),
          sectionCompleteness: {
            ACCOUNT_INDEX: { state: "COMPLETE", locator: locator("ACCOUNT_INDEX") },
          },
        },
      },
    },
    {
      sourceAccountKey: "synthetic-account-index-provenance-mismatch",
      creditorName: present("Synthetic Index Provenance Account", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: {
          accountPresence: absent("ACCOUNT_INDEX"),
          sectionCompleteness: {
            ACCOUNT_INDEX: { state: "COMPLETE", locator: locator("ACCOUNT_DETAIL") },
          },
        },
      },
    },
  ],
};

const aiBefore = JSON.stringify(aiOutput);
const aiAccounts = adaptAiParserV2ShadowOutput(aiOutput, covered);
const isolated = aiAccounts[0];
const silent = aiAccounts[1];
const unsupportedAbsence = aiAccounts[2];
const failedSection = aiAccounts[3];
const conflictingPayment = aiAccounts[4];
const alternatePresenceLocator = aiAccounts[5];
const mismatchedIndexProvenance = aiAccounts[6];
const conflictingPaymentEvidence = conflictingPayment.bureaus.EQUIFAX.historicalEvidence.find(
  (item) => item.kind === "PAYMENT_DELINQUENCY"
);

equal("AI adapter does not mutate its structured output", JSON.stringify(aiOutput), aiBefore);
equal("Equifax keeps only its own summary status", isolated.bureaus.EQUIFAX.fields.summaryStatus.presence === "PRESENT" ? isolated.bureaus.EQUIFAX.fields.summaryStatus.value : null, "Collection Account");
equal("TransUnion keeps its independent summary status", isolated.bureaus.TRANSUNION.fields.summaryStatus.presence === "PRESENT" ? isolated.bureaus.TRANSUNION.fields.summaryStatus.value : null, "Closed");
check("Equifax status never populates TransUnion", isolated.bureaus.TRANSUNION.fields.summaryStatus.presence === "PRESENT" && isolated.bureaus.TRANSUNION.fields.summaryStatus.value !== "Collection Account");
check("Equifax charge-off never populates TransUnion", isolated.bureaus.EQUIFAX.fields.chargeOffMarker.presence === "PRESENT" && isolated.bureaus.TRANSUNION.fields.chargeOffMarker.presence === "UNKNOWN");
equal("explicit bureau absence remains ABSENT_CONFIRMED", isolated.bureaus.EXPERIAN.accountPresence.presence, "ABSENT_CONFIRMED");
equal("parser silence remains UNKNOWN", silent.bureaus.EQUIFAX.fields.summaryStatus.presence, "UNKNOWN");
equal("missing covered bureau input remains UNKNOWN", silent.bureaus.EXPERIAN.accountPresence.presence, "UNKNOWN");
check("UNKNOWN is never coerced to confirmed absence", silent.bureaus.EQUIFAX.fields.summaryStatus.presence !== "ABSENT_CONFIRMED");
equal("partial section completeness is preserved", silent.bureaus.EQUIFAX.sectionCompleteness.ACCOUNT_SUMMARY.state, "PARTIAL");
equal("omitted section completeness becomes UNKNOWN", silent.bureaus.EQUIFAX.sectionCompleteness.PAYMENT_HISTORY.state, "UNKNOWN");
equal("field absence from a complete sourced section remains confirmed", isolated.bureaus.EQUIFAX.fields.dofd.presence, "ABSENT_CONFIRMED");
equal("partial account index cannot prove absence", unsupportedAbsence.bureaus.EQUIFAX.accountPresence.presence, "UNKNOWN");
check("unsupported absence records a contract error", unsupportedAbsence.bureaus.EQUIFAX.errors.some((error) => error.code === "UNSUPPORTED_ABSENCE_CONFIRMATION"));
equal("alternate account-presence locator cannot prove absence", alternatePresenceLocator.bureaus.EQUIFAX.accountPresence.presence, "UNKNOWN");
equal("alternate account-presence locator is invalid input", alternatePresenceLocator.bureaus.EQUIFAX.accountPresence.provenance.origin, "INVALID_INPUT");
check("alternate account-presence locator records an explicit mismatch", alternatePresenceLocator.bureaus.EQUIFAX.accountPresence.errors.some((error) => error.code === "ACCOUNT_PRESENCE_SECTION_MISMATCH"));
equal("mismatched account-index completeness provenance cannot prove absence", mismatchedIndexProvenance.bureaus.EQUIFAX.accountPresence.presence, "UNKNOWN");
check("mismatched account-index completeness locator records an explicit error", mismatchedIndexProvenance.bureaus.EQUIFAX.accountPresence.errors.some((error) => error.code === "ACCOUNT_INDEX_COMPLETENESS_PROVENANCE_MISMATCH"));
equal("failed section silence remains UNKNOWN", failedSection.bureaus.EQUIFAX.fields.remarks.presence, "UNKNOWN");
equal("failed section silence is labeled PARSE_FAILURE", failedSection.bureaus.EQUIFAX.fields.remarks.provenance.origin, "PARSE_FAILURE");
check("section parse errors remain represented", failedSection.bureaus.EQUIFAX.errors.some((error) => error.code === "SYNTHETIC_PARSE_FAILURE"));
equal("partial section cannot prove field absence", failedSection.bureaus.EQUIFAX.fields.dofd.presence, "UNKNOWN");
equal("partial section field absence is invalid input", failedSection.bureaus.EQUIFAX.fields.dofd.provenance.origin, "INVALID_INPUT");
check("partial absence records a field contract error", failedSection.bureaus.EQUIFAX.fields.dofd.errors.some((error) => error.code === "UNSUPPORTED_FIELD_ABSENCE_CONFIRMATION"));
equal("failed section cannot prove field absence", failedSection.bureaus.EQUIFAX.fields.collectionFacts.presence, "UNKNOWN");
equal("failed section field absence is invalid input", failedSection.bureaus.EQUIFAX.fields.collectionFacts.provenance.origin, "INVALID_INPUT");
check("failed absence records a field contract error", failedSection.bureaus.EQUIFAX.fields.collectionFacts.errors.some((error) => error.code === "UNSUPPORTED_FIELD_ABSENCE_CONFIRMATION"));
equal("noncanonical complete section cannot prove field absence", failedSection.bureaus.EQUIFAX.fields.paymentHistory.presence, "UNKNOWN");
equal("section-locator mismatch is invalid input", failedSection.bureaus.EQUIFAX.fields.paymentHistory.provenance.origin, "INVALID_INPUT");
check("section-locator bypass records an explicit mismatch error", failedSection.bureaus.EQUIFAX.fields.paymentHistory.errors.some((error) => error.code === "FIELD_ABSENCE_SECTION_MISMATCH"));
check("positive daysLate survives conflicting clean-negated text", conflictingPaymentEvidence?.observation.value.daysLate === 30);
check("conflicting numeric and clean payment signals record a warning", conflictingPaymentEvidence?.observation.errors.some((error) => error.code === "CONFLICTING_PAYMENT_HISTORY_ENTRY") === true);
equal("field provenance names its parser", isolated.bureaus.EQUIFAX.fields.summaryStatus.presence === "PRESENT" ? isolated.bureaus.EQUIFAX.fields.summaryStatus.provenance.parser : null, "AI_V2");
equal("field provenance retains its source section", isolated.bureaus.EQUIFAX.fields.summaryStatus.presence === "PRESENT" ? isolated.bureaus.EQUIFAX.fields.summaryStatus.provenance.locator.section : null, "ACCOUNT_SUMMARY");
equal("field confidence is preserved", isolated.bureaus.EQUIFAX.fields.summaryStatus.confidence, 0.93);

// ---- Product type: explicit source truth outranks current name heuristic ----
const productTypeOutput: AiParserV2ShadowOutput = {
  parserVersion: "ai-shadow-test-v1",
  accounts: [
    {
      sourceAccountKey: "synthetic-explicit-type",
      creditorName: present("Synthetic Onemain-Like Lender", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: presentBureau({ productType: present("REVOLVING", "ACCOUNT_DETAIL") }),
      },
    },
    {
      sourceAccountKey: "synthetic-inferred-type",
      creditorName: present("Synthetic Onemain-Like Lender", "ACCOUNT_INDEX"),
      bureaus: { EQUIFAX: presentBureau({}) },
    },
  ],
};
const productTypes = adaptAiParserV2ShadowOutput(productTypeOutput, ["EQUIFAX"]);
equal("explicit source product type outranks creditor-name heuristic", productTypes[0].productTypeResolution.value, "REVOLVING");
equal("explicit product type is labeled source evidence", productTypes[0].productTypeResolution.basis, "EXPLICIT_SOURCE");
check("explicit product type is not labeled inference", productTypes[0].productTypeResolution.isInference === false);
equal("name heuristic applies only when source type is absent", productTypes[1].productTypeResolution.value, "INSTALLMENT");
equal("name heuristic is labeled inference", productTypes[1].productTypeResolution.basis, "CREDITOR_NAME_HEURISTIC");
check("name heuristic cannot masquerade as observation", productTypes[1].productTypeResolution.isInference === true && productTypes[1].bureaus.EQUIFAX.fields.productType.presence === "UNKNOWN");

// ---- Regex v2: bureau-scoped historical evidence extraction ----
const regexOutput: RegexParserV2ShadowOutput = {
  parserVersion: "regex-shadow-test-v1",
  accounts: [
    {
      sourceAccountKey: "synthetic-regex-history",
      creditorName: present("Synthetic Cedar Account", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: {
          accountPresence: present(true, "ACCOUNT_INDEX"),
          sections: {
            ACCOUNT_INDEX: {
              text: "Synthetic account entry",
              completeness: "COMPLETE",
              locator: locator("ACCOUNT_INDEX"),
            },
            ACCOUNT_SUMMARY: {
              text: "Status: Closed\nBalance: $0\nProduct Type: Revolving\nReported Date: 2025-01-15",
              completeness: "COMPLETE",
              locator: locator("ACCOUNT_SUMMARY", 10),
            },
            ACCOUNT_DETAIL: {
              text: "Detailed Status: Closed\nDOFD: 2020-01-01\nDate Closed: 2025-01-01",
              completeness: "COMPLETE",
              locator: locator("ACCOUNT_DETAIL", 20),
            },
            PAYMENT_HISTORY: {
              text: "2023-12: Never late\n2024-01: 120 days late\n2024-02: CO",
              completeness: "COMPLETE",
              locator: locator("PAYMENT_HISTORY", 30),
            },
            COLLECTIONS: {
              text: "Collection Account\nCharge-off reported\nLoss reported",
              completeness: "COMPLETE",
              locator: locator("COLLECTIONS", 40),
            },
            REMARKS: {
              text: "Remarks: Account transferred or sold\nConsumer disputes account information",
              completeness: "COMPLETE",
              locator: locator("REMARKS", 50),
            },
          },
        },
        TRANSUNION: {
          accountPresence: {
            presence: "ABSENT_CONFIRMED",
            locator: locator("ACCOUNT_INDEX", 70),
          },
          sections: {
            ACCOUNT_INDEX: {
              text: "Account not listed in complete index",
              completeness: "COMPLETE",
              locator: locator("ACCOUNT_INDEX", 70),
            },
          },
        },
      },
    },
    {
      sourceAccountKey: "synthetic-regex-unrecognized-type",
      creditorName: present("Synthetic Onemain-Like Lender", "ACCOUNT_INDEX"),
      bureaus: {
        EQUIFAX: {
          accountPresence: present(true, "ACCOUNT_INDEX"),
          sections: {
            ACCOUNT_INDEX: {
              text: "Synthetic account entry",
              completeness: "COMPLETE",
              locator: locator("ACCOUNT_INDEX", 80),
            },
            ACCOUNT_SUMMARY: {
              text: "Status: Closed\nProduct Type: Flexible Builder Lease",
              completeness: "COMPLETE",
              locator: locator("ACCOUNT_SUMMARY", 90),
            },
          },
        },
      },
    },
  ],
};

const regexBefore = JSON.stringify(regexOutput);
const regexAccounts = extractRegexParserV2Shadow(regexOutput, ["EQUIFAX", "TRANSUNION"]);
const regexAccount = regexAccounts[0];
const regexUnrecognizedType = regexAccounts[1];
const historyKinds = new Set(regexAccount.bureaus.EQUIFAX.historicalEvidence.map((item) => item.kind));
const paymentDelinquencies = regexAccount.bureaus.EQUIFAX.historicalEvidence.filter(
  (item) => item.kind === "PAYMENT_DELINQUENCY"
);

equal("regex adapter does not mutate bureau-scoped source blocks", JSON.stringify(regexOutput), regexBefore);
equal("regex summary status stays distinct", regexAccount.bureaus.EQUIFAX.fields.summaryStatus.presence === "PRESENT" ? regexAccount.bureaus.EQUIFAX.fields.summaryStatus.value : null, "Closed");
equal("regex detailed status stays distinct", regexAccount.bureaus.EQUIFAX.fields.detailedStatus.presence === "PRESENT" ? regexAccount.bureaus.EQUIFAX.fields.detailedStatus.value : null, "Closed");
equal("regex zero balance is a present value", regexAccount.bureaus.EQUIFAX.fields.balanceCents.presence === "PRESENT" ? regexAccount.bureaus.EQUIFAX.fields.balanceCents.value : null, 0);
check("payment delinquency survives closed/$0 current fields", historyKinds.has("PAYMENT_DELINQUENCY"));
equal("clean negation does not create payment delinquency", paymentDelinquencies.length, 1);
equal("separate adverse payment marker still creates delinquency", paymentDelinquencies[0]?.observation.value.period, "2024-01");
check("payment-grid charge-off survives", historyKinds.has("CHARGE_OFF"));
check("collection-section evidence survives", historyKinds.has("COLLECTION"));
check("loss evidence survives", historyKinds.has("LOSS_REPORTED"));
check("transfer/sale evidence survives", historyKinds.has("TRANSFER_OR_SALE"));
check("consumer-dispute remarks survive", historyKinds.has("CONSUMER_DISPUTE_REMARK"));
check("DOFD survives as historical evidence", historyKinds.has("FIRST_DELINQUENCY_DATE"));
check("transfer/sale evidence is context-only", regexAccount.bureaus.EQUIFAX.historicalEvidence.some((item) => item.kind === "TRANSFER_OR_SALE" && item.assessmentSignal === "CONTEXT_ONLY"));
check("consumer-dispute remarks are context-only", regexAccount.bureaus.EQUIFAX.historicalEvidence.some((item) => item.kind === "CONSUMER_DISPUTE_REMARK" && item.assessmentSignal === "CONTEXT_ONLY"));
equal("regex TransUnion absence stays independent", regexAccount.bureaus.TRANSUNION.accountPresence.presence, "ABSENT_CONFIRMED");
equal("uncovered Experian remains UNKNOWN", regexAccount.bureaus.EXPERIAN.accountPresence.presence, "UNKNOWN");
equal("uncovered bureau is labeled outside coverage", regexAccount.bureaus.EXPERIAN.accountPresence.provenance.origin, "OUTSIDE_COVERAGE");
equal("unrecognized explicit product label is preserved as OTHER", regexUnrecognizedType.bureaus.EQUIFAX.fields.productType.presence === "PRESENT" ? regexUnrecognizedType.bureaus.EQUIFAX.fields.productType.value : null, "OTHER");
equal("unrecognized explicit product type still outranks name heuristic", regexUnrecognizedType.productTypeResolution.value, "OTHER");
equal("unrecognized explicit product type remains source-based", regexUnrecognizedType.productTypeResolution.basis, "EXPLICIT_SOURCE");
check("unrecognized explicit product label records a normalization warning", regexUnrecognizedType.bureaus.EQUIFAX.fields.productType.errors.some((error) => error.code === "UNRECOGNIZED_EXPLICIT_PRODUCT_TYPE"));

// ---- Shadow-only/no legacy mutation ----
const legacyRows = extractRawTradelines("Synthetic Legacy Account\nBalance: $10", ["EQUIFAX"]);
const legacyBefore = JSON.stringify(legacyRows);
void adaptAiParserV2ShadowOutput(aiOutput, covered);
void extractRegexParserV2Shadow(regexOutput, ["EQUIFAX", "TRANSUNION"]);
equal("shadow adapters do not mutate current legacy parser results", JSON.stringify(legacyRows), legacyBefore);
equal("v2 result declares SHADOW_ONLY", isolated.rolloutMode, "SHADOW_ONLY");
check("v2 contract forbids legacy writes", isolated.legacyWriteAllowed === false);
check("v2 output is not the legacy perBureau projection", !("perBureau" in isolated));
check("AI shadow rules explicitly forbid cross-bureau copying", AI_PARSER_V2_SHADOW_RULES.some((rule) => rule.includes("Never copy")));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
