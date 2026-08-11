import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schemaPath = resolve(root, "prisma/schema.prisma");
const migrationPath = resolve(
  root,
  "prisma/migrations/20260810_p0_phase2a_ingestion_round0/migration.sql",
);
const verifierPath = resolve(root, "scripts/p0-phase2a-migration-verify.sh");
const rollbackPath = resolve(
  root,
  "scripts/sql/p0-phase2a-disposable-rollback.sql",
);

// Updated only after the exact integrated Lane A files pass review.
const expectedSchemaSha =
  "e5cd3765f0d60ff0757c41ee5fdd1ee4be758cbb729bc28633aa77f8fc89765a";
const expectedMigrationSha =
  "d9e9615318db3df0a484ead860523890041598115eade298e611b14af845fa55";

const schema = readFileSync(schemaPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const verifier = readFileSync(verifierPath, "utf8").replace(
  /^\\if false\s*$[\s\S]*?^\\endif\s*$/gm,
  "",
);
const rollback = readFileSync(rollbackPath, "utf8");

let passed = 0;
const failures: string[] = [];

function check(condition: boolean, label: string): void {
  if (condition) passed += 1;
  else failures.push(label);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

function captureSet(value: string, pattern: RegExp): Set<string> {
  return new Set([...value.matchAll(pattern)].map((match) => match[1]));
}

function capturePairs(value: string, pattern: RegExp): Set<string> {
  return new Set(
    [...value.matchAll(pattern)].map((match) => `${match[1]}.${match[2]}`),
  );
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((item) => right.has(item));
}

function stripSqlComments(value: string): string {
  return value
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

function captureModel(value: string, model: string): string {
  return value.match(new RegExp(`model ${model} \\{[^]*?\\n\\}`))?.[0] ?? "";
}

const migrationTables = captureSet(migration, /^CREATE TABLE "([^"]+)"/gm);
const migrationTypes = captureSet(migration, /^CREATE TYPE "([^"]+)"/gm);
const migrationFunctions = captureSet(
  migration,
  /^CREATE FUNCTION ([A-Za-z0-9_]+)/gm,
);
const rollbackTables = captureSet(
  rollback,
  /^DROP TABLE IF EXISTS "([^"]+)";/gm,
);
const rollbackTypes = captureSet(
  rollback,
  /^DROP TYPE IF EXISTS "([^"]+)";/gm,
);
const rollbackFunctions = captureSet(
  rollback,
  /^DROP FUNCTION IF EXISTS ([A-Za-z0-9_]+)\(/gm,
);
const rollbackIndexes = captureSet(
  rollback,
  /^DROP INDEX IF EXISTS "([^"]+)";/gm,
);
const frozenTriggerTables = new Set([
  "ExtractionRun",
  "CreditScoreObservation",
  "IdentityBaseline",
  "IdentityFact",
  "AccountPresenceObservation",
  "ReportVersionAccount",
]);
const forwardFrozenTriggers = new Set(
  migration
    .split(/;\s*\n/)
    .map((statement) =>
      statement.match(
        /^CREATE (?:CONSTRAINT )?TRIGGER "([^"]+)"[\s\S]*?\bON "([^"]+)"/,
      ),
    )
    .filter(
      (match): match is RegExpMatchArray =>
        match !== null && frozenTriggerTables.has(match[2]),
    )
    .map((match) => `${match[1]}.${match[2]}`),
);
const rollbackFrozenTriggers = capturePairs(
  rollback,
  /^DROP TRIGGER IF EXISTS "([^"]+)" ON "([^"]+)";/gm,
);
const forwardExistingColumns = capturePairs(
  migration,
  /^ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)"/gm,
);
const rollbackExistingColumns = capturePairs(
  rollback,
  /^ALTER TABLE "([^"]+)" DROP COLUMN IF EXISTS "([^"]+)";/gm,
);
const existingTableNames =
  "ExtractionRun|IdentityFact|IdentityBaseline|CreditScoreObservation|ConsumerAssertion";
const forwardExistingConstraints = captureSet(
  migration,
  new RegExp(
    `^ALTER TABLE "(?:${existingTableNames})" ADD CONSTRAINT "([^"]+)"`,
    "gm",
  ),
);
const rollbackExistingConstraints = captureSet(
  rollback,
  new RegExp(
    `^ALTER TABLE "(?:${existingTableNames})" DROP CONSTRAINT IF EXISTS "([^"]+)";`,
    "gm",
  ),
);
const executableMigration = stripSqlComments(migration);
const executableRollback = stripSqlComments(rollback);
const quotedMigrationIdentifiers = [
  ...migration.matchAll(/(?:CONSTRAINT|INDEX|TRIGGER) "([^"]+)"/g),
].map((match) => match[1]);

check(sha256(schema) === expectedSchemaSha, "frozen integrated schema SHA-256");
check(
  sha256(migration) === expectedMigrationSha,
  "frozen Phase 2A migration SHA-256",
);
check(
  verifier.includes(
    `readonly EXPECTED_SCHEMA_SHA256="${expectedSchemaSha}"`,
  ) &&
    verifier.includes(
      `readonly EXPECTED_MIGRATION_SHA256="${expectedMigrationSha}"`,
    ),
  "disposable verifier freeze digests exactly match the static guard",
);
check(countMatches(migration, /^CREATE TYPE /gm) === 20, "20 additive enums");
check(countMatches(migration, /^CREATE TABLE /gm) === 10, "10 additive tables");
check(
  countMatches(migration, /^ALTER TABLE .* ADD COLUMN /gm) === 19,
  "19 nullable old-runtime-compatible columns",
);
check(
  countMatches(migration, /^CREATE UNIQUE INDEX /gm) === 46,
  "46 exact uniqueness indexes",
);
check(countMatches(migration, /^CREATE INDEX /gm) === 14, "14 query indexes");
check(
  countMatches(migration, /^ALTER TABLE .* FOREIGN KEY /gm) === 44,
  "44 exact composite foreign keys",
);
check(countMatches(migration, /^CREATE FUNCTION /gm) === 21, "21 validators");
check(
  countMatches(migration, /^CREATE (?:CONSTRAINT )?TRIGGER /gm) === 41,
  "41 transition/attestation/append-only triggers",
);
check(
  quotedMigrationIdentifiers.every(
    (identifier) => Buffer.byteLength(identifier, "utf8") <= 63,
  ),
  "quoted PostgreSQL constraint, index, and trigger identifiers fit the 63-byte catalog limit",
);
check(
  migration.includes(
    'INTO confirmed_baseline_status,\n         confirmed_baseline_source_id,\n         confirmed_baseline_semantic_sha256,\n         confirmed_baseline_expected_review_count,\n         confirmed_baseline_confirmed_at,\n         confirmed_baseline_xmin',
  ) &&
    !migration.includes(
      "INTO confirmed_baseline, confirmed_baseline_xmin",
    ),
  "account-review membership captures its locked baseline and xmin through scalar targets",
);
check(
  migration.includes(
    'CREATE FUNCTION p0_2a_reject_account_after_identity_completion()',
  ) &&
    migration.includes(
      'AND completeness."category" = \'UNRECOGNIZED_ACCOUNT\'\n      AND completeness."identityBaselineId" IS NOT NULL\n      AND completeness.xmin <>',
    ) &&
    countMatches(
      migration,
      /(?:completeness|sealed_run)\."category" = 'UNRECOGNIZED_ACCOUNT'\n\s+AND (?:completeness|sealed_run)\."identityBaselineId" IS NOT NULL/g,
    ) >= 5,
  "failed unbound uncertainty manifests cannot seal later source-listed account membership",
);
check(
  countMatches(
    migration,
    /completeness\."sourceMemberCount" < \(\n\s+SELECT count\(\*\)/g,
  ) >= 3 &&
    countMatches(
      migration,
      /completeness\."sourceMemberCount" < 1 \+ \(\n\s+SELECT count\(\*\)/g,
    ) >= 2 &&
    migration.includes(
      "NEW.\"presence\" IN ('PRESENT', 'UNKNOWN')\n          AND EXISTS (\n            SELECT 1\n            FROM \"ReportVersionAccount\" new_report_account",
    ) &&
    migration.includes(
      "new_report_account.\"membershipOrigin\" = 'SOURCE_LISTED'",
    ) &&
    migration.includes(
      "new_report_account.\"authorityStatus\" <> 'LEGACY_UNVERIFIED'",
    ) &&
    migration.includes(
      "identity source membership exceeds the sealed exact run bureau and category count",
    ) &&
    migration.includes(
      "account-index source membership exceeds the sealed exact run and bureau count",
    ) &&
    migration.includes(
      "source-listed account exceeds or is absent from the sealed account-index source membership",
    ) &&
    migration.includes(
      'presence."extractionRunId" = sealed_run."extractionRunId"',
    ) &&
    migration.includes(
      "member_completeness.\"category\" = 'UNRECOGNIZED_ACCOUNT'",
    ),
  "same-transaction source membership recomputes immutable count ceilings after an early constraint flush",
);
check(
  migration.includes(
    "WHEN 'IdentityFact' THEN baseline.\"expectedIdentityFactCount\"",
  ) &&
    migration.includes(
      "WHEN 'IdentityCategoryCompletion' THEN baseline.\"expectedCategoryCompletionCount\"",
    ) &&
    migration.includes(
      "WHEN 'IdentityBaselineAccountReviewMembership' THEN baseline.\"expectedAccountReviewReceiptCount\"",
    ) &&
    migration.includes("actual_child_count > expected_child_count") &&
    migration.includes(
      "confirmed baseline child count exceeds its immutable parent seal",
    ),
  "same-transaction confirmed children cannot exceed the already validated immutable parent seal",
);
check(
  migration.includes(
    "IF TG_TABLE_NAME = 'IdentityBaseline' THEN\n      IF NEW.\"status\" = 'CONFIRMED' THEN",
  ) &&
    !migration.includes(
      "TG_TABLE_NAME = 'IdentityBaseline' AND NEW.\"status\" = 'CONFIRMED'",
    ),
  "shared Round 0 trigger never casts CONFIRMED through a non-baseline status enum",
);
check(
  migration.includes(
    "IF TG_TABLE_NAME = 'Round0SourceCompletenessEvidence' THEN\n      IF NEW.\"identityBaselineId\" IS NULL THEN",
  ) &&
    !migration.includes(
      "TG_TABLE_NAME = 'Round0SourceCompletenessEvidence'\n       AND NEW.\"identityBaselineId\" IS NULL",
    ),
  "shared Round 0 trigger reads completeness-only fields only inside its table branch",
);
check(
  migration.includes(
    'SELECT baseline."status", baseline."sourceIdentityBaselineId", baseline.xmin\n    INTO target_baseline_status, source_identity_baseline_id, target_baseline_xmin\n  FROM "IdentityBaseline" baseline',
  ),
  "identity category completion declares the baseline alias used by its locked snapshot",
);

check(
  sameSet(
    migrationTables,
    new Set([
      "ReportIngestion",
      "BureauReportDateEvidence",
      "Round0SourceCompletenessEvidence",
      "IdentityCategoryCompletion",
      "IdentityCorrespondenceAssertion",
      "ConsumerAccountReviewReceipt",
      "IdentityBaselineAccountReviewMembership",
      "CaseActionDecision",
      "CaseActionSourceRef",
      "P0SensitiveAccessEvent",
    ]),
  ),
  "only accepted Phase 2A tables are created",
);
check(
  sameSet(migrationTables, rollbackTables),
  "rollback table manifest exactly matches forward tables",
);
check(
  sameSet(migrationTypes, rollbackTypes),
  "rollback enum manifest exactly matches forward enums",
);
check(
  sameSet(migrationFunctions, rollbackFunctions),
  "rollback function manifest exactly matches forward functions",
);
check(
  sameSet(forwardExistingColumns, rollbackExistingColumns),
  "rollback nullable-column manifest exactly matches forward additions",
);
check(
  sameSet(forwardExistingConstraints, rollbackExistingConstraints),
  "rollback existing-table constraint manifest exactly matches forward additions",
);
check(
  sameSet(forwardFrozenTriggers, rollbackFrozenTriggers),
  "rollback frozen-table trigger manifest exactly matches forward additions",
);
check(
  sameSet(
    rollbackIndexes,
    new Set([
      "artifact_extraction_input_pin_key",
      "identity_baseline_attestation_pin_key",
      "identity_fact_assertion_pin_key",
      "identity_baseline_source_seal_pin_key",
      "identity_baseline_round0_source_pin_key",
      "identity_baseline_single_successor_key",
      "identity_fact_source_seal_pin_key",
      "report_version_account_review_pin_key",
      "account_presence_review_pin_key",
    ]),
  ),
  "rollback touches only exact additive Phase 1-table indexes",
);

check(
  !/^\s*(?:DROP\b|TRUNCATE\b|DELETE\s+FROM\b|UPDATE\s+"|ALTER\s+TABLE\b.*\b(?:DROP|RENAME)\b)/gim.test(
    executableMigration,
  ),
  "forward migration has no drop/rename/update/delete/truncate",
);
check(
  migration
    .split("\n")
    .filter((line) => /^ALTER TABLE /.test(line))
    .every((line) => / ADD (?:COLUMN|CONSTRAINT) /.test(line)),
  "every forward ALTER TABLE is additive",
);
check(
  migration
    .split("\n")
    .filter((line) => / FOREIGN KEY /.test(line))
    .every(
      (line) =>
        / ON DELETE RESTRICT ON UPDATE RESTRICT(?: DEFERRABLE INITIALLY DEFERRED)?;$/.test(
          line,
        ) &&
        !/CASCADE|SET NULL|SET DEFAULT/.test(line),
    ),
  "all foreign keys are RESTRICT/RESTRICT",
);
check(
  !/(db push|self-heal|backfill|legacy-to-P0 inference)/i.test(
    executableMigration,
  ),
  "forward SQL contains no db-push, self-heal, backfill, or inference behavior",
);

check(
  !/^\s*(?:DROP|ALTER).*\bCASCADE\b/gim.test(executableRollback) &&
    !/^\s*DROP\s+(?:DATABASE|SCHEMA)\b/gim.test(executableRollback) &&
    !/_prisma_migrations/.test(executableRollback) &&
    !/^\s*DROP TABLE IF EXISTS "(?:User|Report|Tradeline|CreditTruthScope|ReportVersion|ExtractionRun|IdentityFact|ConsumerAssertion)"/gim.test(
      executableRollback,
    ),
  "rollback is sentinel-scoped and cannot drop baseline/Phase 1 authorities",
);
check(
  rollback.indexOf("current_database()") < rollback.indexOf("DROP TABLE") &&
    rollback.indexOf("current_user") < rollback.indexOf("DROP TABLE") &&
    rollback.indexOf("DISPOSABLE_DATABASE_ONLY") < rollback.indexOf("DROP TABLE"),
  "rollback guards precede every mutation",
);
check(
  rollback.indexOf('DROP TABLE IF EXISTS "IdentityBaselineAccountReviewMembership"') <
      rollback.indexOf('DROP TABLE IF EXISTS "ConsumerAccountReviewReceipt"') &&
    rollback.indexOf(
      'DROP CONSTRAINT IF EXISTS "identity_baseline_report_ingestion_fkey"',
    ) < rollback.indexOf('DROP TABLE IF EXISTS "ReportIngestion"') &&
    rollback.indexOf(
      'DROP CONSTRAINT IF EXISTS "identity_baseline_confirmation_source_fkey"',
    ) < rollback.indexOf('DROP INDEX IF EXISTS "identity_baseline_round0_source_pin_key"') &&
    rollback.indexOf(
      'DROP CONSTRAINT IF EXISTS "extraction_run_input_artifact_fkey"',
    ) < rollback.indexOf('DROP INDEX IF EXISTS "artifact_extraction_input_pin_key"'),
  "rollback drops leaf memberships and dependent FKs before parent tables/indexes",
);
check(
  rollback.indexOf(
    'ALTER TABLE "ReportIngestion" DROP CONSTRAINT IF EXISTS "report_ingestion_source_artifact_fkey"',
  ) < rollback.indexOf('DROP INDEX IF EXISTS "artifact_extraction_input_pin_key"'),
  "rollback drops the ReportIngestion source-artifact FK before its supporting Artifact index",
);

const ingestion = captureModel(schema, "ReportIngestion");
check(
  ingestion.includes("idempotencyKey") &&
    ingestion.includes("operationKey") &&
    ingestion.includes("reservedVersion") &&
    ingestion.includes("sourceReadbackSha256") &&
    ingestion.includes("revision") &&
    ingestion.includes("leaseExpiresAt") &&
    migration.includes('CREATE TRIGGER "ReportIngestion_state_cas_trg"') &&
    migration.includes('CREATE TRIGGER "ReportIngestion_no_delete_trg"'),
  "ReportIngestion is the sole revisioned CAS queue with verified source recovery",
);
check(
  migration.includes("live ingestion lease holder token and expiry are immutable") &&
    migration.includes("ingestion lease acquisition is not claimable or bounded") &&
    migration.includes("worker state transition requires the exact live ingestion lease") &&
    migration.includes("live_lease_completion BOOLEAN") &&
    migration.includes("AND state_transition_allowed") &&
    migration.includes('AND NEW."attemptCount" = OLD."attemptCount"') &&
    migration.includes('AND NEW."leaseToken" IS NULL') &&
    migration.includes('AND NEW."leaseOwnerId" IS NULL') &&
    migration.includes('AND NEW."leaseExpiresAt" IS NULL') &&
    migration.includes("old_lease_live AND lease_tuple_changed AND NOT live_lease_completion") &&
    migration.includes("lease_tuple_changed AND NOT expired_recovery AND NOT live_lease_completion") &&
    migration.includes("AND NOT live_lease_completion") &&
    migration.includes("NEW.\"leaseExpiresAt\" > db_now + INTERVAL '5 minutes'") &&
    migration.includes("OLD.\"state\" = 'FAILED' AND OLD.\"extractionRunId\" IS NULL") &&
    verifier.includes("pre-extraction failed ingestion is not assessable") &&
    migration.includes("extraction result requires an exact extraction run") &&
    migration.includes("extraction result must retain its exact live lease through assessment") &&
    verifier.includes("failed extraction requires an exact run") &&
    verifier.includes("extraction result cannot release lease before assessment") &&
    verifier.includes("extraction result retains live lease for assessment") &&
    migration.includes("trusted_writer_reconciliation BOOLEAN") &&
    migration.includes("OLD.\"state\" = 'OUTCOME_UNKNOWN'") &&
    migration.includes("NEW.\"updatedAt\" >= db_now - INTERVAL '30 seconds'") &&
    migration.includes("AND NOT trusted_writer_reconciliation") &&
    verifier.includes("stale reconciliation snapshot") &&
    verifier.includes("exact trusted-writer reconciliation without lease") &&
    migration.includes("OLD.\"state\" IN ('SUCCEEDED', 'PARTIAL', 'ASSESSED', 'OUTCOME_UNKNOWN')") &&
    migration.includes("NEW.\"state\" = 'QUARANTINED'") &&
    migration.includes("NEW.\"sourceDisposition\" <> 'RETAINED'") &&
    migration.includes("disposed ingestion cannot resume processing"),
  "queue leases permit only exact atomic live completion and disposed sources cannot resume work",
);
check(
  schema.includes("ORIGINAL_REPORT_BYTES") &&
    schema.includes("DERIVED_NORMALIZED_TEXT") &&
    migration.includes('CREATE TRIGGER "ExtractionRun_input_artifact_trg"') &&
    !/ALTER TYPE "ArtifactKind"/.test(migration),
  "extraction input distinguishes original/normalized without ArtifactKind drift",
);

const reportDateEvidence = captureModel(schema, "BureauReportDateEvidence");
const scoreObservation = captureModel(schema, "CreditScoreObservation");
check(
  /enum ReportDateEvidencePresence \{\s*PRESENT\s*EXPLICIT_NOT_PROVIDED\s*UNKNOWN\s*\}/s.test(
    schema,
  ) &&
    /enum ReportDatePrecision \{\s*DAY\s*MONTH\s*YEAR\s*UNKNOWN\s*\}/s.test(
      schema,
    ) &&
    [
      "reportVersionId",
      "extractionRunId",
      "bureau",
      "coverageStatus",
      "bureauCoverageId",
      "presence",
      "sourceValue",
      "precision",
      "provenance",
      "sourceLocatorToken",
      "integritySha256",
    ].every((field) => reportDateEvidence.includes(field)) &&
    !/sourceValue\s+DateTime/.test(reportDateEvidence) &&
    migration.includes('CONSTRAINT "BureauReportDateEvidence_shape_ck"') &&
    migration.includes('"sourceValue" IS NOT NULL') &&
    migration.includes('"sourceLocatorToken" IS NOT NULL') &&
    migration.includes("WHEN 'YEAR' THEN \"sourceValue\" ~") &&
    migration.includes("WHEN 'MONTH' THEN") &&
    migration.includes("to_date(\"sourceValue\", 'FXYYYY-MM-DD')") &&
    migration.includes('CREATE TRIGGER "BureauReportDateEvidence_validate_trg"') &&
    migration.includes('CREATE TRIGGER "BureauReportDateEvidence_append_only_trg"') &&
    migration.includes(
      "Phase 2A H1 metadata requires exactly one date evidence row for each covered bureau and none outside coverage",
    ) &&
    migration.includes(
      "Phase 2A H1 metadata requires an explicit score set or one uncertainty/absence sentinel for each covered bureau and none outside coverage",
    ) &&
    verifier.includes("lossless bureau report-date readback") &&
    verifier.includes("wrong-bureau report-date metadata substitution") &&
    verifier.includes("date precision fabrication rejected") &&
    verifier.includes("bureau A date / bureau B omitted date rejected") &&
    verifier.includes("covered bureau omitted score sentinel rejected") &&
    verifier.includes("outside-coverage report-date metadata rejected") &&
    verifier.includes("outside-coverage score metadata rejected"),
  "H1 report-date evidence is bureau/run scoped, lexical, lossless, and immutable",
);
check(
  /enum CreditScoreModelPresence \{\s*PRESENT\s*NOT_PROVIDED\s*UNKNOWN\s*\}/s.test(
    schema,
  ) &&
    scoreObservation.includes(
      "scoreModelPresence           CreditScoreModelPresence?",
    ) &&
    scoreObservation.includes("scoreModelEvidenceValue      String?") &&
    scoreObservation.includes("scoreModelSourceLocatorToken String?") &&
    migration.includes('CONSTRAINT "CreditScoreObservation_model_evidence_ck"') &&
    migration.includes('"scoreModelPresence" IS NULL') &&
    migration.includes('"scoreModelPresence" = \'PRESENT\'') &&
    migration.includes('"scoreModelEvidenceValue" IS NOT NULL') &&
    migration.includes('"scoreModelSourceLocatorToken" IS NOT NULL') &&
    migration.includes('"scoreModelPresence" = \'NOT_PROVIDED\'') &&
    migration.includes('"scoreModelPresence" = \'UNKNOWN\'') &&
    migration.includes('"scoreModelEvidenceValue" !~ \'[[:cntrl:]]\'') &&
    migration.includes("exact score-model evidence cannot invent a legacy model version") &&
    migration.includes(
      'CREATE TRIGGER "CreditScoreObservation_model_evidence_trg"',
    ) &&
    migration.includes(
      "exact-input report score requires explicit independent score-model evidence",
    ) &&
    verifier.includes("score-model-lexical-locator") &&
    verifier.includes("FICO® Score 8") &&
    verifier.includes("exact-input score cannot omit model presence") &&
    verifier.includes("score-model fabrication from not-provided") &&
    verifier.includes("score-unknown-model-present") &&
    verifier.includes("score-failed-unknown-model-unknown") &&
    verifier.includes("score extraction engine provenance substitution rejected") &&
    verifier.includes("score sentinel occurrence must be zero") &&
    verifier.includes("independent score-model readback"),
  "H1 score-model presence/uncertainty and locator are independent from score truth",
);
check(
  migration.includes(
    "Phase 2A score-model evidence must preserve exact extraction engine provenance",
  ) &&
    migration.includes('score."occurrence" = 0') &&
    verifier.includes("atomic H1 covered-bureau date and score manifest") &&
    verifier.includes("score extraction engine provenance substitution rejected") &&
    verifier.includes("score sentinel occurrence must be zero"),
  "H1 score manifests preserve parser provenance and canonical sentinel cardinality",
);

const identityBaseline = captureModel(schema, "IdentityBaseline");
const identityFact = captureModel(schema, "IdentityFact");
const identityCompletion = captureModel(schema, "IdentityCategoryCompletion");
const identityAssertion = captureModel(
  schema,
  "IdentityCorrespondenceAssertion",
);
const identityBaselineSourceSeal =
  migration.match(
    /CREATE FUNCTION p0_2a_validate_identity_baseline_source_seal\(\)[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
const baselineShaFields = new Set(
  [...identityBaseline.matchAll(/^\s+([A-Za-z0-9_]*Sha256)\s+/gm)].map(
    (match) => match[1],
  ),
);
check(
  identityBaseline.includes("extractionRunId    String?") &&
    identityBaseline.includes("reportIngestionId  String?") &&
    identityBaseline.includes("sourceIdentityBaselineId") &&
    identityBaseline.includes("supersedesIdentityBaselineId") &&
    identityBaseline.includes("semanticSha256") &&
    sameSet(baselineShaFields, new Set(["inputSetSha256", "semanticSha256"])) &&
    identityFact.includes("extractionRunId          String?") &&
    identityFact.includes("baselineInputSetSha256   String?") &&
    identityCompletion.includes("extractionRunId") &&
    !identityCompletion.includes("extractionRunId                  String?") &&
    identityAssertion.includes("extractionRunId") &&
    !identityAssertion.includes("extractionRunId             String?") &&
    migration.includes('CONSTRAINT "identity_baseline_extraction_run_fkey"') &&
    migration.includes('CONSTRAINT "identity_baseline_report_ingestion_fkey"') &&
    migration.includes('CONSTRAINT "identity_baseline_confirmation_source_fkey"') &&
    migration.includes('CONSTRAINT "identity_baseline_confirmation_predecessor_fkey"') &&
    migration.includes('CONSTRAINT "identity_fact_extraction_run_fkey"') &&
    migration.includes('CONSTRAINT "identity_category_completion_baseline_fkey"') &&
    migration.includes('CONSTRAINT "identity_correspondence_assertion_baseline_fkey"') &&
    migration.includes('CONSTRAINT "identity_correspondence_assertion_fact_fkey"') &&
    migration.includes("identity fact extraction or baseline source-set seal mismatch") &&
    migration.includes("WHEN 'UNRECOGNIZED_ACCOUNT' THEN FALSE") &&
    verifier.includes("IdentityFact all-null Phase2 tuple rejected") &&
    verifier.includes("ABSENT_CONFIRMED Phase2 IdentityFact rejected") &&
    verifier.includes("DRAFT to CONFIRMED exact source and review membership") &&
    verifier.includes("reconfirmation keeps original DRAFT and advances current head"),
  "H2 has one canonical baseline seal and exact run pins without a second disposition authority",
);
check(
  identityBaseline.includes("reportIngestionId  String?") &&
    migration.includes("identity source-set seal requires exact report ingestion authority") &&
    migration.includes("identity source-set seal requires verified retained original report ingestion truth") &&
    migration.includes("identity source-set seal requires exact original report source artifact") &&
    migration.includes("confirmed identity baseline must retain the original draft report ingestion authority") &&
    verifier.includes("Round 0 report ingestion substitution rejected"),
  "H2 source seals reconstruct exact retained original-artifact authority through ReportIngestion",
);
check(
  identityBaselineSourceSeal.includes("NEW.\"status\" = 'DRAFT'") &&
    identityBaselineSourceSeal.includes(
      "linked_ingestion.\"state\" = 'EXTRACTING'",
    ) &&
    identityBaselineSourceSeal.includes(
      'linked_ingestion."extractionRunId" IS NULL',
    ) &&
    identityBaselineSourceSeal.includes("NEW.\"status\" = 'CONFIRMED'") &&
    identityBaselineSourceSeal.includes(
      "linked_ingestion.\"state\" = 'ROUND0_READY'",
    ) &&
    !identityBaselineSourceSeal.includes(
      "linked_ingestion.\"state\" IN ('SUCCEEDED', 'PARTIAL', 'ASSESSED', 'ROUND0_READY')",
    ) &&
    identityBaselineSourceSeal.includes(
      'linked_ingestion."extractionRunId" IS NOT DISTINCT FROM NEW."extractionRunId"',
    ) &&
    verifier.includes(
      "DRAFT persists while ingestion EXTRACTING with unpinned result",
    ) &&
    verifier.includes(
      "premature confirmation while ingestion EXTRACTING rejected",
    ) &&
    verifier.includes(
      "premature confirmation while ingestion PARTIAL rejected",
    ) &&
    verifier.includes(
      "premature confirmation while ingestion SUCCEEDED rejected",
    ) &&
    verifier.includes(
      "premature confirmation while ingestion ASSESSED rejected",
    ) &&
    verifier.includes("late DRAFT after terminal ingestion rejected") &&
    verifier.includes("extraction result pins exact run after DRAFT persistence") &&
    verifier.indexOf(
      "DRAFT persists while ingestion EXTRACTING with unpinned result",
    ) <
      verifier.indexOf("extraction result pins exact run after DRAFT persistence") &&
    verifier.indexOf("extraction result pins exact run after DRAFT persistence") <
      verifier.indexOf("DRAFT to CONFIRMED exact source and review membership"),
  "H2 DRAFT follows runtime EXTRACTING chronology while confirmation requires a pinned terminal result",
);

const sourceCompleteness = captureModel(
  schema,
  "Round0SourceCompletenessEvidence",
);
check(
  [
    "reportVersionId",
    "extractionRunId",
    "identityBaselineId",
    "baselineInputSetSha256",
    "bureau",
    "coverageStatus",
    "bureauCoverageId",
    "category",
    "status",
    "sourceMemberCount",
    "sourceMembershipSha256",
    "sourceLocatorToken",
    "integritySha256",
    "ruleKey",
    "ruleVersion",
  ].every((field) => sourceCompleteness.includes(field)) &&
    migration.includes(
      'CONSTRAINT "Round0SourceCompletenessEvidence_shape_ck"',
    ) &&
    migration.includes(
      'CREATE TRIGGER "Round0SourceCompletenessEvidence_validate_trg"',
    ) &&
    migration.includes(
      'CREATE TRIGGER "Round0SourceCompletenessEvidence_append_only_trg"',
    ) &&
    migration.includes(
      "Round 0 completeness member count does not match exact durable source membership",
    ) &&
    migration.includes(
      "identity source membership is sealed for this exact run bureau and category",
    ) &&
    migration.includes(
      "account-index source membership is sealed for this exact run and bureau",
    ) &&
    migration.includes(
      "failed Round 0 completeness requires an exact unbound 3-bureau by 9-category non-affirmative manifest",
    ) &&
    migration.includes(
      "Round 0 source seal requires the exact 3-bureau by 9-category completeness manifest",
    ) &&
    identityCompletion.includes("sourceCompletenessEvidenceCount") &&
    identityCompletion.includes("equifaxSourceCompletenessEvidenceId") &&
    identityCompletion.includes("experianSourceCompletenessEvidenceId") &&
    identityCompletion.includes("transunionSourceCompletenessEvidenceId") &&
    verifier.includes("exact identity completeness catalog") &&
    verifier.includes("failed extraction exact unbound uncertainty manifest") &&
    verifier.includes("UNKNOWN account presence retained in DRAFT source membership") &&
    verifier.includes("sealed identity category rejects later source member") &&
    verifier.includes("sealed account-index rejects later presence member"),
  "H2/H3 exact 3x9 source completeness is counted, refs-only, immutable, and reverse sealed",
);

const accountReview = captureModel(schema, "ConsumerAccountReviewReceipt");
const accountReviewMembership = captureModel(
  schema,
  "IdentityBaselineAccountReviewMembership",
);
const accountReviewFieldNames = [
  ...accountReview.matchAll(/^\s+([A-Za-z][A-Za-z0-9_]*)\s+[A-Za-z]/gm),
]
  .map((match) => match[1])
  .join(" ");
check(
  /enum ConsumerAccountReviewState \{\s*RECOGNIZED\s*UNRECOGNIZED\s*UNKNOWN\s*DEFERRED\s*REVOKED\s*\}/s.test(
    schema,
  ) &&
    [
      "tenantId",
      "consumerId",
      "reportVersionId",
      "extractionRunId",
      "identityBaselineId",
      "identityBaselineVersion",
      "baselineInputSetSha256",
      "bureau",
      "accountId",
      "reportVersionAccountId",
      "accountPresenceObservationId",
      "accountPresenceObservationRevision",
      "accountPresenceIntegritySha256",
      "accountPresenceSourceLocatorToken",
      "accountIndexCompletenessEvidenceId",
      "accountIndexSourceMembershipSha256",
      "accountIndexCompletenessIntegritySha256",
      "sourceSeriesKey",
      "reviewSeriesKey",
      "version",
      "reviewState",
      "sourceSetSha256",
      "authorizationKind",
      "authorizationVersion",
      "reviewedByActorId",
      "reviewedAt",
      "supersedesReviewId",
    ].every((field) => accountReview.includes(field)) &&
    !/(fraud|identity.?theft|inaccura|unauthor|delet|violation|eligib|policy|legal|dispute|requested.?action|action.?code|action.?state)/i.test(
      accountReviewFieldNames,
    ) &&
    migration.includes('"authorizationKind" = \'DIRECT_CONSUMER\'') &&
    migration.includes("baseline_status <> 'DRAFT'") &&
    migration.includes("account recognition review requires exact draft source-set baseline") &&
    migration.includes("account recognition review requires exact source-listed v2 account membership") &&
    migration.includes("account recognition review source observation mismatch") &&
    migration.includes("account recognition review requires exact sealed account-index membership evidence") &&
    migration.includes("account review supersession changed exact source membership") &&
    migration.includes("account review series and source digest must derive from the exact evidence tuple") &&
    migration.includes("account-review membership requires the exact current receipt head at confirmation") &&
    migration.includes('"accountPresenceSourceLocatorToken" TEXT NOT NULL') &&
    migration.includes("account recognition review cannot confer correction, policy, or legal action authority") &&
    migration.includes("case action cannot bind a stale or revoked account recognition review") &&
    migration.includes('CREATE TRIGGER "ConsumerAccountReviewReceipt_append_only_trg"') &&
    verifier.includes("account review cannot pin confirmed successor baseline") &&
    verifier.includes("non-consumer authority cannot establish account review") &&
    verifier.includes("cross-tenant account review substitution") &&
    verifier.includes("cross-bureau account review substitution") &&
    verifier.includes("account review requires present source locator") &&
    verifier.includes("account-index completeness rejects omitted locator") &&
    verifier.includes("bounded current account-review action source") &&
    verifier.includes("unrecognized account cannot confer correction authority") &&
    verifier.includes("case action rejects stale account review receipt") &&
    verifier.includes("revoked account review is terminal") &&
    verifier.includes("account review mutation forbidden"),
  "H3 is a direct-consumer, source-membership-sealed, non-inferred append-only receipt",
);
check(
  [
    "confirmedIdentityBaselineId",
    "confirmedIdentityBaselineVersion",
    "confirmedBaselineInputSetSha256",
    "consumerAccountReviewReceiptId",
    "reviewSeriesKey",
    "reviewVersion",
    "reviewState",
    "receiptSourceSetSha256",
    "bureau",
    "accountId",
    "reportVersionAccountId",
    "ordinal",
  ].every((field) => accountReviewMembership.includes(field)) &&
    migration.includes("confirmed identity baseline account-review receipt count mismatch") &&
    migration.includes("confirmed account-review membership ordinals must be contiguous from zero") &&
    migration.includes("confirmed baseline children cannot be appended after the parent seal commits") &&
    migration.includes("confirmed baseline child count exceeds its immutable parent seal") &&
    verifier.includes("same-xact post-SET confirmed IdentityFact append rejected") &&
    verifier.includes("same-xact post-SET category completion append rejected") &&
    verifier.includes("same-xact post-SET account-review membership append rejected") &&
    verifier.includes("post-commit confirmed IdentityFact append rejected") &&
    verifier.includes("post-commit category completion append rejected") &&
    verifier.includes("post-commit account-review membership append rejected"),
  "H2 confirmed baselines normalize exact review membership and reject post-seal extension",
);
check(
  migration.includes("confirmed identity baseline must append from the exact current predecessor over the original draft source") &&
    migration.includes("confirmed identity fact does not exactly copy its unique draft source fact") &&
    migration.includes("confirmed identity baseline must exactly resolve every identity category source slot") &&
    verifier.includes("DRAFT to CONFIRMED exact source and review membership") &&
    verifier.includes("reconfirmation keeps original DRAFT and advances current head"),
  "H2 reconfirmation retains original DRAFT truth and exact append-only chronology",
);
check(
  migration.includes('CREATE TRIGGER "IdentityCategoryCompletion_no_fact_trg"') &&
    migration.includes('CREATE TRIGGER "IdentityFact_round0_category_trg"') &&
    migration.includes('CREATE TRIGGER "ReportVersionAccount_round0_category_trg"') &&
    !captureModel(schema, "IdentityCategoryCompletion").includes("bureau"),
  "NOT_APPLICABLE is global and bidirectionally conflicts with facts/accounts",
);
check(
  migration.includes("WHEN 'PHONE' THEN fact_type = 'IDENTIFIER'") &&
    migration.includes(
      "NEW.\"reviewCategory\" = 'PHONE' AND NEW.\"factType\" = 'IDENTIFIER'",
    ) &&
    !migration.includes("WHEN 'PHONE' THEN fact_type = 'OTHER'"),
  "PHONE is consistently an IDENTIFIER in exact and legacy category matching",
);
check(
  schema.includes("enum IdentityCorrespondencePurpose") &&
    schema.includes("CORRESPONDENCE_SENDER_IDENTITY") &&
    schema.includes("CORRESPONDENCE_IDENTITY_CORRECTION") &&
    !captureModel(schema, "IdentityCorrespondenceAssertion").includes(
      "disposition",
    ) &&
    migration.includes("identity correspondence assertion source context mismatch"),
  "identity claim receipt pins fact source without competing disposition",
);
check(
  migration.includes("sender identity purpose requires a confirmed current legal-name or return-address fact") &&
    migration.includes(
      "fact_row.\"reviewCategory\" NOT IN ('LEGAL_NAME', 'CURRENT_ADDRESS')",
    ) &&
    migration.includes("identity correction purpose requires a consumer correction classification") &&
    migration.includes(
      "('INCORRECT', 'NEVER_MINE', 'OUTDATED_UPDATE_REQUESTED')",
    ) &&
    migration.includes("identity correspondence assertion requires a source-reported present fact"),
  "identity purpose/classification/category compatibility is closed and fail-closed",
);

const actionSource = captureModel(schema, "CaseActionSourceRef");
const actionDecision = captureModel(schema, "CaseActionDecision");
check(
  [
    "FIELD_OBSERVATION",
    "DERIVED_ACCOUNT_ASSESSMENT",
    "CONSUMER_ASSERTION",
    "CONSUMER_ACCOUNT_REVIEW",
    "IDENTITY_FACT",
    "IDENTITY_CORRESPONDENCE_ASSERTION",
    "IDENTITY_CATEGORY_COMPLETION",
  ].every((sourceType) => schema.includes(sourceType)) &&
    actionSource.includes("sourceVersion") &&
    actionSource.includes("integritySha256") &&
    migration.includes("p0_2a_validate_case_action_source_ref"),
  "all seven action source types are durably recoverable and exact-validated",
);
check(
  migration.includes(
    "IF TG_TABLE_NAME = 'CaseActionDecision' THEN\n    target_decision_id := NEW.\"id\";\n  ELSIF TG_TABLE_NAME = 'CaseActionSourceRef' THEN\n    target_decision_id := NEW.\"decisionId\";",
  ) &&
    migration.includes("unknown case action source-seal validation table") &&
    !migration.includes(
      "target_decision_id := CASE\n    WHEN TG_TABLE_NAME = 'CaseActionDecision'",
    ),
  "case-action source seal branches before dereferencing table-specific trigger fields",
);
const actionSourceSql = migration.match(
  /CONSTRAINT "CaseActionSourceRef_source_id_ck" CHECK \([^]*?\n    \)/,
)?.[0] ?? "";
const sensitiveResourceSql = migration.match(
  /CONSTRAINT "P0SensitiveAccessEvent_refs_only_ck" CHECK \([^]*?\n    \)/,
)?.[0] ?? "";
check(
  !actionSourceSql.includes("[0-9]{9}") &&
    sensitiveResourceSql.includes("[0-9]{9}") &&
    verifier.includes("opaque digit-run account-review source id accepted"),
  "normalized action source IDs permit opaque digit runs without weakening sensitive-access PII guards",
);
check(
  migration.includes("identity correspondence assertion series must derive from its exact claim source tuple") &&
    migration.includes('CREATE UNIQUE INDEX "identity_correspondence_source_series_version_key"') &&
    migration.includes('CREATE UNIQUE INDEX "consumer_account_review_source_series_version_key"') &&
    verifier.includes("parallel v1 identity assertion head rejected") &&
    verifier.includes("parallel v1 account-review source head rejected"),
  "H2/H3 exact-source series prevent competing caller-selected assertion heads",
);
check(
  actionDecision.includes("expectedSourceCount") &&
    actionDecision.includes('map: "CaseActionDecision_case_fkey"') &&
    migration.includes('"expectedSourceCount" BETWEEN 1 AND 256') &&
    migration.includes("case action source count or canonical digest does not match the durable seal") &&
    migration.includes("sha256(convert_to(canonical_source_json, 'UTF8'))") &&
    migration.includes('CREATE CONSTRAINT TRIGGER "CaseActionSourceRef_source_membership_trg"') &&
    migration.includes("case action source set is already sealed"),
  "case action source count/digest is durably sealed with FK map parity",
);
check(
  migration.includes("parent_xmin xid;") &&
    migration.includes("pg_current_xact_id()::TEXT::NUMERIC") &&
    migration.includes("4294967296::NUMERIC") &&
    migration.includes(")::TEXT::xid THEN") &&
    !migration.includes("parent_xmin TEXT") &&
    migration.includes("^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$") &&
    migration.includes("convert_to(membership.\"sourceType\"::TEXT, 'UTF8')") &&
    migration.includes("convert_to(membership.\"sourceId\", 'UTF8')"),
  "case action current-transaction seal and canonical JSON inputs are wrap/escape safe",
);
check(
  migration.includes("case action supersession changed exact normalized source membership") &&
    migration.includes("selected account correction requires a current consumer correction assertion") &&
    migration.includes("selected identity correction requires a current identity correction assertion") &&
    migration.includes("membership.\"sourceType\" = 'CONSUMER_ASSERTION'") &&
    migration.includes("membership.\"sourceType\" = 'IDENTITY_CORRESPONDENCE_ASSERTION'"),
  "supersession equality and consumer-selected correction testimony are sealed",
);
check(
  migration.includes("initial case action decision must be proposed version one") &&
    migration.includes("case action decision supersession changed exact authority inputs") &&
    migration.includes("invalid case action decision state transition") &&
    migration.includes('CREATE TRIGGER "CaseActionDecision_append_only_trg"'),
  "case action chronology is append-only and not policy authority",
);

const accessEvent = captureModel(schema, "P0SensitiveAccessEvent");
check(
  !/(Json|Bytes|Text\?)/.test(accessEvent) &&
    !/(address|testimony|snippet|providerError|metadata)/i.test(accessEvent) &&
    migration.includes('CREATE TRIGGER "P0SensitiveAccessEvent_append_only_trg"'),
  "sensitive-access audit is refs-only and append-only",
);
check(
  accessEvent.includes("P0SensitiveAccessPurposeCode") &&
    accessEvent.includes("P0SensitiveAccessReasonCode") &&
    accessEvent.includes("P0SensitiveResourceType") &&
    [
      "REPORT_INGESTION",
      "ROUND0_REVIEW",
      "CONSUMER_CONFIRMATION",
      "INTEGRITY_VERIFICATION",
      "CONSUMER_EXPORT",
      "AGENCY_MANAGED_CLIENT_SERVICE",
      "ADMIN_SUPPORT",
      "WORKER_EXTRACTION",
      "AUTHORIZED",
      "RESOURCE_NOT_FOUND",
      "REPORT_SOURCE",
      "NORMALIZED_REPORT_TEXT",
      "IDENTITY_FACT_VALUE",
      "CONSUMER_ASSERTION_STATEMENT",
    ].every((code) => schema.includes(code)) &&
    migration.includes('CREATE TRIGGER "P0SensitiveAccessEvent_validate_trg"') &&
    migration.includes('NEW."resourceType" = \'REPORT_INGESTION\'') &&
    migration.includes('FROM "ReportIngestion" ingestion') &&
    migration.includes('ingestion."revision" = NEW."resourceVersion"') &&
    migration.includes("report ingestion resource access requires the exact pre-store worker purpose") &&
    migration.includes("allowed sensitive access requires an exact scoped resource version") &&
    migration.includes("person@example.com") === false,
  "sensitive-access codes are closed and ALLOW requires an exact scoped resource",
);
check(
  schema.includes("AGENCY_MANAGED_CLIENT") &&
    schema.includes("ADMIN_IMPERSONATION") &&
    schema.includes("SYSTEM_WORKER") &&
    !schema.includes("ADMIN_DELEGATION"),
  "durable authorization kinds match the authenticated principal contract",
);
check(
  !/(PolicyEvaluationReceipt|CorrespondenceItemEvidence|MailingEvent|FulfillmentAttempt|ResponseRecord|AccountMatchDecision)/.test(
    migration,
  ),
  "Phase 2B+ schema is absent",
);
check(
  !/(retentionDays|legalHold|expiresAfter|purgeAfter)/i.test(schema + migration),
  "no retention duration or legal-hold policy was invented",
);

check(
  verifier.includes("DISPOSABLE DATABASE ONLY") &&
    verifier.includes("127.0.0.1") &&
    verifier.includes("unset DATABASE_URL DIRECT_URL SHADOW_DATABASE_URL") &&
    verifier.includes("No pending migrations to apply") &&
    verifier.includes("schema parity") &&
    verifier.includes("rollback") &&
    verifier.includes("teardown"),
  "disposable verifier covers isolation, no-op, parity, rollback, and teardown",
);
check(
  verifier.includes(
    'local label="$1" url="$2" schema_path="$3"\n  local log_file="${tmp_root}/${label}.log"',
  ) &&
    !verifier.includes(
      'local label="$1" url="$2" schema_path="$3" log_file=',
    ),
  "disposable verifier initializes derived log paths after nounset-safe arguments",
);
check(
  verifier.includes(
    "'run-legacy-compatible', 'EQUIFAX', 'COVERED', 'cov-legacy-eq'",
  ),
  "legacy-compatible extraction fixture retains the frozen three-bureau covered-set invariant",
);
check(
  verifier.includes("for _ready_attempt in $(seq 1 240)") &&
    verifier.includes('say "postgres: ${postgres_version}"') &&
    verifier.includes('fail "disposable PostgreSQL major version is not 16"'),
  "disposable PostgreSQL readiness is bounded and its pinned major version is attested",
);
check(
  verifier.includes(
    "BEGIN;\nINSERT INTO \"ExtractionRun\" (\n  \"id\", \"tenantId\", \"consumerId\", \"reportVersionId\", \"runKey\", \"attempt\",\n  \"engine\", \"engineVersion\", \"schemaVersion\", \"normalizationVersion\", \"status\",\n  \"startedAt\", \"completedAt\", \"inputArtifactId\", \"inputSha256\",\n  \"inputRepresentation\"\n) VALUES\n  ('run-h1-partial'",
  ) &&
    verifier.includes(
      "('cov-old-exact-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-old-exact-compatible', 'TRANSUNION', 'OUTSIDE_COVERAGE');\nCOMMIT;",
    ),
  "active H1 extraction fixtures create each run and its three-bureau coverage atomically",
);
check(
  verifier.includes(String.raw`E'FICO\nScore 8'`) &&
    !verifier.includes(String.raw`E'FICO\\nScore 8'`),
  "score-model control-character fixture uses a PostgreSQL newline escape rather than a literal backslash",
);
check(
  [
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH",
    "DOCKER_CONFIG",
  ].every((name) => verifier.includes(name)) &&
    verifier.includes("docker context inspect") &&
    verifier.includes("Docker endpoint must be a local unix socket") &&
    verifier.includes('docker --host "${docker_endpoint}"') &&
    !/^docker (?:run|exec|stop|inspect|port|info|image)\b/gm.test(verifier),
  "Docker overrides/non-local endpoints fail before bound local Docker use",
);
check(
  [
    "duplicate ingestion operation",
    "duplicate report version reservation",
    "live same-state lease release",
    "exact live lease completion clears tuple",
    "stale worker completion token",
    "pre-store ingestion audit purpose substitution",
    "pre-store ingestion audit revision substitution",
    "stale reconciliation snapshot",
    "run-legacy-compatible",
    "wrong-bureau report-date metadata substitution",
    "date precision fabrication rejected",
    "present report date requires lexical value",
    "explicit absent report date requires locator",
    "bureau A date / bureau B omitted date rejected",
    "covered bureau omitted score sentinel rejected",
    "outside-coverage report-date metadata rejected",
    "outside-coverage score metadata rejected",
    "exact-input score cannot omit model presence",
    "score-model fabrication from not-provided",
    "score extraction engine provenance substitution rejected",
    "score sentinel occurrence must be zero",
    "failed extraction exact unbound uncertainty manifest",
    "UNKNOWN account presence cannot establish consumer account review",
    "same-xact post-SET source IdentityFact append rejected",
    "same-xact post-SET counted account membership append rejected",
    "same-xact post-SET source-listed report account append rejected",
    "sealed identity category rejects later source member",
    "IdentityFact all-null Phase2 tuple rejected",
    "ABSENT_CONFIRMED Phase2 IdentityFact rejected",
    "Round 0 report ingestion substitution rejected",
    "account-index completeness rejects omitted locator",
    "sealed account-index rejects later presence member",
    "parallel v1 account-review source head rejected",
    "account review cannot pin confirmed successor baseline",
    "non-consumer authority cannot establish account review",
    "cross-tenant account review substitution",
    "cross-bureau account review substitution",
    "account review requires present source locator",
    "post-commit confirmed IdentityFact append rejected",
    "post-commit category completion append rejected",
    "post-commit account-review membership append rejected",
    "same-xact post-SET confirmed IdentityFact append rejected",
    "same-xact post-SET category completion append rejected",
    "same-xact post-SET account-review membership append rejected",
    "parallel v1 identity assertion head rejected",
    "stale identity assertion after account review supersession rejected",
    "new confirmed baseline cannot masquerade as legacy",
    "opaque digit-run account-review source id accepted",
    "revoked account review is terminal",
    "account review mutation forbidden",
    "unrecognized account cannot confer correction authority",
    "case action rejects stale account review receipt",
    "v2 identity assertion rejected after v3 reconfirmation",
    "v2 category completion rejected after v3 reconfirmation",
  ].every((probe) => verifier.includes(probe)),
  "disposable verifier contains the Phase 2A and H1/H2/H3 negative probes",
);

if (failures.length > 0) {
  console.error("P0 Phase 2A migration guard FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`P0 Phase 2A migration guard PASS (${passed} static assertions)`);
console.log("DISPOSABLE DATABASE ONLY");
