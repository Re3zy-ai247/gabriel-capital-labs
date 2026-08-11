import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureText = readFileSync(
  join(root, "scripts/fixtures/p0-phase2a.synthetic.json"),
  "utf8",
);
const fixture = JSON.parse(fixtureText) as {
  _meta: {
    synthetic: boolean;
    containsConsumerPii: boolean;
    containsSourceReportContent: boolean;
  };
  scope: { actorId: string; tenantId: string; consumerId: string };
  agencyScope: { actorId: string; tenantId: string; consumerId: string };
  ingestion: { bureauSourceSelectors: string[] };
  bureauScopedAccounts: Array<{
    sourceAccountKey: string;
    bureau: string;
    currentStatus: string;
    historicalEvidence: string[];
    expectedCondition: string;
  }>;
  scores: Array<{ bureau: string; presence: string; score?: number }>;
  identityFacts: Array<{
    category: string;
    classification: string;
  }>;
  adversarialSelectors: {
    otherTenantId: string;
    otherConsumerId: string;
    staleObservationRevision: number;
    currentObservationRevision: number;
  };
};

let passed = 0;
function check(name: string, run: () => void): void {
  run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

check("fixture is explicitly synthetic and contains no consumer source payload", () => {
  assert.equal(fixture._meta.synthetic, true);
  assert.equal(fixture._meta.containsConsumerPii, false);
  assert.equal(fixture._meta.containsSourceReportContent, false);
});

check("fixture has no account-number or plaintext-report keys", () => {
  assert.equal(
    /"(?:accountNumber|fullAccountNumber|address|reportText|rawText|plaintext|testimony)"\s*:/i.test(
      fixtureText,
    ),
    false,
  );
});

check("direct and agency principals keep actor tenant and consumer roles distinct", () => {
  assert.equal(fixture.scope.tenantId, fixture.scope.consumerId);
  assert.notEqual(fixture.scope.actorId, fixture.scope.consumerId);
  assert.notEqual(fixture.agencyScope.actorId, fixture.agencyScope.tenantId);
  assert.notEqual(fixture.agencyScope.tenantId, fixture.agencyScope.consumerId);
});

check("three-bureau coverage is an exact selector set rather than shared fact authority", () => {
  assert.deepEqual(
    [...fixture.ingestion.bureauSourceSelectors].sort(),
    ["EQUIFAX", "EXPERIAN", "TRANSUNION"],
  );
});

check("one logical account retains divergent bureau-specific facts", () => {
  const rows = fixture.bureauScopedAccounts.filter(
    (row) => row.sourceAccountKey === "account-synthetic-history",
  );
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((row) => row.bureau)).size, 3);
  assert.equal(new Set(rows.map((row) => row.currentStatus)).size, 3);
});

check("paid closed zero balance does not erase supported historical derogatory evidence", () => {
  const row = fixture.bureauScopedAccounts.find(
    (candidate) =>
      candidate.bureau === "EQUIFAX" &&
      candidate.sourceAccountKey === "account-synthetic-history",
  );
  assert(row);
  assert.equal(row.currentStatus, "PAID_CLOSED_ZERO_BALANCE");
  assert(row.historicalEvidence.includes("PAYMENT_DELINQUENCY_120_DAYS"));
  assert.equal(row.expectedCondition, "DEROGATORY");
});

check("genuinely clean control remains clean", () => {
  const row = fixture.bureauScopedAccounts.find(
    (candidate) =>
      candidate.sourceAccountKey === "account-synthetic-clean-control",
  );
  assert(row);
  assert.deepEqual(row.historicalEvidence, []);
  assert.equal(row.expectedCondition, "CLEAN");
});

check("no-score and unknown-score sentinels carry no invented score", () => {
  const missing = fixture.scores.filter(
    (score) => score.presence !== "SCORE_REPORTED",
  );
  assert.equal(missing.length, 2);
  assert(missing.every((score) => score.score === undefined));
});

check("accurate former address and employment controls are not pre-disputed", () => {
  const protectedCategories = fixture.identityFacts.filter((fact) =>
    ["FORMER_ADDRESS", "EMPLOYMENT"].includes(fact.category),
  );
  assert.equal(protectedCategories.length, 2);
  assert(protectedCategories.every((fact) => !fact.classification.includes("DISPUT")));
});

check("stale assertion and cross-scope adversarial selectors are genuinely distinct", () => {
  assert.notEqual(fixture.adversarialSelectors.otherTenantId, fixture.scope.tenantId);
  assert.notEqual(fixture.adversarialSelectors.otherConsumerId, fixture.scope.consumerId);
  assert(
    fixture.adversarialSelectors.staleObservationRevision <
      fixture.adversarialSelectors.currentObservationRevision,
  );
});

check("upload integration is build-only and cannot install a hook from request data", () => {
  const route = readFileSync(join(root, "app/api/reports/upload/route.ts"), "utf8");
  assert(route.includes("createP0ReportUploadShadowDispatcher({ hook: null })"));
  assert.equal(/P0_[A-Z0-9_]+.*createP0ReportUploadShadowDispatcher/.test(route), false);
});

check("Phase 2B durable authorities remain absent from the Phase 2A migration", () => {
  const migration = readFileSync(
    join(
      root,
      "prisma/migrations/20260810_p0_phase2a_ingestion_round0/migration.sql",
    ),
    "utf8",
  );
  assert.equal(
    /(PolicyEvaluationReceipt|CorrespondenceItemEvidence|MailingEvent|FulfillmentAttempt|ResponseRecord|AccountMatchDecision)/.test(
      migration,
    ),
    false,
  );
});

check("trusted-writer production dependency remains explicitly bounded", () => {
  const readiness = readFileSync(
    join(root, "lib/creditTruth/phase2Readiness.ts"),
    "utf8",
  );
  assert(readiness.includes('trustedWriterDependency: "BOUNDED"'));
  assert(
    readiness.includes("AUTHENTICATED_PRODUCTION_REPOSITORY_RECEIPT_REQUIRED"),
  );
});

process.stdout.write(
  `${passed}/${passed} PASS p0-phase2a-adversarial-fixture\n`,
);
