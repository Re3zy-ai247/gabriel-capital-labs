// Contract guard for the sanitized P0 fixtures. This intentionally validates
// the target invariants without importing the current production classifier:
// that implementation cannot yet represent the fixture's historical evidence,
// field provenance, consumer confirmation, or immutable artifact versions.
// Run: npx --no-install tsx scripts/p0-credit-truth-fixture.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

type AnyRecord = Record<string, any>;

const fixturePath = join(__dirname, "fixtures", "p0-credit-truth.synthetic.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as AnyRecord;

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

check("fixture is explicitly synthetic", fixture.synthetic === true);
check("fixture declares no consumer PII", fixture.containsConsumerPii === false);
check("fixture declares no source-report content", fixture.containsSourceReportContent === false);

const serialized = JSON.stringify(fixture);
check("all provenance locators are synthetic", !serialized.includes("file://") && !serialized.includes("/Users/"));
check("fixture contains no account-number field", !serialized.includes("accountNumber"));

const tradeline = (id: string) => fixture.tradelineCases.find((c: AnyRecord) => c.id === id);
const confirmation = (id: string) => fixture.confirmationCases.find((c: AnyRecord) => c.id === id);
const packet = (id: string) => fixture.packetCases.find((c: AnyRecord) => c.id === id);
const artifact = (id: string) => fixture.artifactCases.find((c: AnyRecord) => c.id === id);

const mixed = tradeline("mixed-current-status");
check("mixed bureau status is never Clean", mixed.expected.cleanAllowed === false && mixed.expected.accountCondition === "MIXED");
check("bureau observations must remain isolated", mixed.expected.bureauObservationsRemainIsolated === true);
check("TransUnion summary may not inherit Equifax collection status", mixed.expected.transunionMayClaimSummaryCollectionStatus === false);
check("a generic collection claim must identify the exact source field", mixed.expected.genericCollectionClaimRequiresFieldQualification === true);

const historical = tradeline("closed-zero-with-late-history");
check("120-day history survives a closed/$0 projection", historical.expected.historicalEvidenceRemainsVisible === true);
check("historical derogatory evidence prevents Clean", historical.expected.cleanAllowed === false);

const cleanCases = fixture.tradelineCases.filter((c: AnyRecord) => c.expected.cleanAllowed === true);
check("positive controls remain available", cleanCases.length >= 4);
check("all positive controls have no historical derogatory evidence", cleanCases.every((c: AnyRecord) => c.historicalEvidence.length === 0));

const explicitType = tradeline("explicit-product-type-beats-name-rule");
check("explicit source product type beats a creditor-name rule", explicitType.expected.derivedProductType === "REVOLVING" && explicitType.expected.creditorNameRuleMayOverrideExplicitSourceType === false);

const incomplete = tradeline("incomplete-sections-block-clean");
check("unknown or incomplete covered sections block Clean", incomplete.expected.accountCondition === "NEEDS_REVIEW" && incomplete.expected.cleanAllowed === false && incomplete.expected.unknownPresenceIsNotAbsence === true);

const unconfirmed = confirmation("observed-but-unconfirmed");
check("unconfirmed evidence may be explained", unconfirmed.expected.mayExplainEvidence === true);
check("unconfirmed evidence may not become an inaccuracy assertion", unconfirmed.expected.mayGenerateInaccuracyAssertion === false);

check("three compatible CRA items consolidate into one packet", packet("one-cra-packet-three-items").expected.packetCount === 1);
check("incompatible recipient types remain separate", packet("incompatible-recipient-types").expected.recipientTypesRemainSeparate === true);

const pdf = artifact("canonical-pdf-contamination");
check("canonical artifact forbids browser and product chrome", pdf.forbiddenMetadataOrContent.length >= 7 && pdf.expected.forbiddenMatches === 0);
check("preview/download/print/fulfillment share one artifact", pdf.expected.previewDownloadPrintBytesShareCanonicalArtifact === true);

const missingAddress = artifact("missing-recipient-address");
check("missing recipient address blocks readiness", missingAddress.expected.mailReadiness === "NOT_READY" && missingAddress.expected.mayApproveAsReady === false);

const regeneration = artifact("immutable-regeneration");
check("regeneration retains immutable v1", regeneration.expected.currentVersion === 2 && regeneration.expected.versionOneRetrievable === true && regeneration.expected.versionOneOverwritten === false);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
