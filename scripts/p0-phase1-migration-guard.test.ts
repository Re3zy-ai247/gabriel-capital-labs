import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schemaPath = resolve(root, "prisma/schema.prisma");
const migrationPath = resolve(
  root,
  "prisma/migrations/20260808_p0_credit_truth_foundation/migration.sql",
);
const verifierPath = resolve(root, "scripts/p0-phase1-migration-verify.sh");
const rollbackPath = resolve(root, "scripts/sql/p0-phase1-disposable-rollback.sql");

const expectedSchemaSha =
  "a18b04ab0026c3e1b6e4dd6f034fa59182acf39fdcc1181f714bb79039bb9d91";
const expectedMigrationSha =
  "bd2c03aa76f29d1f25258bb23786adaf39601c9401e4e5eafdf92ba0a8eeb7c9";

const schema = readFileSync(schemaPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const verifier = readFileSync(verifierPath, "utf8");
const rollback = readFileSync(rollbackPath, "utf8");

let passed = 0;
const failures: string[] = [];

function check(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
  } else {
    failures.push(label);
  }
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

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return (
    left.size === right.size && [...left].every((entry) => right.has(entry))
  );
}

function stripSqlComments(value: string): string {
  return value
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

function captureSqlFunction(value: string, functionName: string): string {
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    value.match(
      new RegExp(
        `CREATE FUNCTION ${escapedName}\\([^]*?\\n\\$\\$;`,
      ),
    )?.[0] ?? ""
  );
}

const migrationTables = captureSet(
  migration,
  /^CREATE TABLE "([^"]+)"/gm,
);
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
const executableRollback = stripSqlComments(rollback);
const scoreValidator = captureSqlFunction(
  migration,
  "p0_validate_credit_score_insert",
);
const differenceValidator = captureSqlFunction(
  migration,
  "p0_validate_report_difference_insert",
);
const outcomeValidator = captureSqlFunction(
  migration,
  "p0_validate_dispute_outcome_insert",
);

check(sha256(schema) === expectedSchemaSha, "frozen schema SHA-256");
check(
  sha256(migration) === expectedMigrationSha,
  "frozen migration SHA-256",
);
check(countMatches(migration, /^CREATE TYPE /gm) === 49, "49 P0 enums");
check(countMatches(migration, /^CREATE TABLE /gm) === 32, "32 P0 tables");
check(
  countMatches(migration, /^CREATE UNIQUE INDEX /gm) === 122,
  "122 P0 unique indexes",
);
check(
  countMatches(migration, /^CREATE INDEX /gm) === 38,
  "38 P0 secondary indexes",
);
check(
  countMatches(migration, /^ALTER TABLE .* FOREIGN KEY /gm) === 106,
  "106 P0 foreign keys",
);
check(
  countMatches(migration, /^\s*CONSTRAINT .* CHECK /gm) === 128,
  "128 P0 checks",
);
check(
  countMatches(migration, /^CREATE (?:CONSTRAINT )?TRIGGER /gm) === 74,
  "74 P0 triggers",
);
check(
  countMatches(migration, /^CREATE FUNCTION /gm) === 31,
  "31 P0 functions",
);

const forwardTopLevelDestruction = migration
  .split("\n")
  .filter(
    (line) =>
      /^\s*(?:DROP\b|TRUNCATE\b|DELETE\s+FROM\b|UPDATE\s+"|ALTER\s+TABLE\b.*\bRENAME\b)/i.test(
        line,
      ),
  );
check(
  forwardTopLevelDestruction.length === 0,
  "forward migration has no destructive top-level operation",
);
const alterLines = migration
  .split("\n")
  .filter((line) => /^ALTER TABLE /.test(line));
check(
  alterLines.every((line) => / ADD CONSTRAINT /.test(line)),
  "every forward ALTER TABLE only adds a constraint",
);
const foreignKeyLines = alterLines.filter((line) => / FOREIGN KEY /.test(line));
check(
  foreignKeyLines.length === 106 &&
    foreignKeyLines.every(
      (line) =>
        / ON DELETE RESTRICT ON UPDATE RESTRICT;$/.test(line) &&
        !/CASCADE|SET NULL|SET DEFAULT/.test(line),
    ),
  "all 106 foreign keys are RESTRICT/RESTRICT",
);

check(
  sameSet(migrationTables, rollbackTables),
  "rollback table list exactly equals forward table list",
);
check(
  sameSet(migrationTypes, rollbackTypes),
  "rollback enum list exactly equals forward enum list",
);
check(
  sameSet(migrationFunctions, rollbackFunctions),
  "rollback function list exactly equals forward function list",
);
check(
  sameSet(
    rollbackIndexes,
    new Set(["Report_userId_id_p0_key", "Tradeline_userId_id_p0_key"]),
  ),
  "rollback baseline-index list is exact",
);
check(
  !/^\s*(?:DROP|ALTER).*\bCASCADE\b/gim.test(executableRollback) &&
    !/^\s*DROP\s+(?:DATABASE|SCHEMA)\b/gim.test(executableRollback) &&
    !/^\s*DROP TABLE IF EXISTS "(?:User|Report|Tradeline)"/gim.test(
      executableRollback,
    ) &&
    !/_prisma_migrations/.test(executableRollback),
  "rollback has no CASCADE, database/schema drop, baseline-table drop, or migration-history mutation",
);
const rollbackOrder = [
  'DROP TABLE IF EXISTS "PacketEnclosure"',
  'DROP TABLE IF EXISTS "ArtifactCorrespondenceVersion"',
  'DROP TABLE IF EXISTS "Artifact"',
  'DROP TABLE IF EXISTS "PacketCorrespondenceVersion"',
  'DROP TABLE IF EXISTS "Packet"',
].map((needle) => rollback.indexOf(needle));
check(
  rollbackOrder.every((position) => position >= 0) &&
    rollbackOrder.every(
      (position, index) => index === 0 || rollbackOrder[index - 1] < position,
    ),
  "rollback leaf order is enclosure/ACV, Artifact, PCV, Packet",
);
check(
  rollback.indexOf("current_database()") < rollback.indexOf("DROP TABLE") &&
    rollback.indexOf("current_user") < rollback.indexOf("DROP TABLE") &&
    rollback.indexOf("DISPOSABLE_DATABASE_ONLY") <
      rollback.indexOf("DROP TABLE"),
  "rollback sentinel, database-name, and role guards precede mutation",
);

check(
  migration.includes('CONSTRAINT "field_observation_section_fkey"') &&
    migration.includes('CONSTRAINT "historical_evidence_section_fkey"') &&
    migration.includes('CONSTRAINT "FieldObservation_confirmed_absence_section_ck"') &&
    migration.includes('CONSTRAINT "HistoricalEvidence_confirmed_absence_section_ck"') &&
    migration.includes('CONSTRAINT "FieldObservation_primary_section_ck"') &&
    migration.includes('fo."sectionStatus" = \'COMPLETE\''),
  "section completeness is exactly pinned and CLEAN reads COMPLETE evidence",
);
check(
  verifier.includes("primary field cannot pin wrong section") &&
    verifier.includes("field cannot pin another section row") &&
    verifier.includes("ABSENT_CONFIRMED cannot pin PARTIAL section"),
  "verifier includes the three section-pin exploit regressions",
);
const correspondenceItemRoutingValidator = captureSqlFunction(
  migration,
  "p0_validate_correspondence_item_recipient_bureau",
);
const correspondenceRecipientUpdateValidator = captureSqlFunction(
  migration,
  "p0_validate_correspondence_recipient_update",
);
check(
  schema.includes("bureau                     Bureau?") &&
    migration.includes('CONSTRAINT "Recipient_bureau_authority_ck"') &&
    migration.includes("\"recipientType\" = 'CREDIT_REPORTING_AGENCY' AND \"bureau\" IS NOT NULL") &&
    migration.includes("\"recipientType\" <> 'CREDIT_REPORTING_AGENCY' AND \"bureau\" IS NULL") &&
    migration.includes('CREATE TRIGGER "Recipient_append_only_trg"'),
  "recipient has exact immutable CRA/non-CRA bureau authority",
);
check(
  correspondenceItemRoutingValidator.includes('JOIN "Recipient" r') &&
    correspondenceItemRoutingValidator.includes("FOR UPDATE OF c, r") &&
    correspondenceItemRoutingValidator.includes(
      "exact_recipient_type = 'CREDIT_REPORTING_AGENCY'",
    ) &&
    correspondenceItemRoutingValidator.includes(
      'exact_recipient_bureau IS DISTINCT FROM NEW."bureau"',
    ) &&
    correspondenceRecipientUpdateValidator.includes(
      'OLD."recipientId" IS DISTINCT FROM NEW."recipientId"',
    ) &&
    migration.includes('CREATE TRIGGER "Correspondence_recipient_identity_trg"') &&
    migration.includes('CREATE TRIGGER "CorrespondenceItem_recipient_bureau_trg"'),
  "CRA item routing and correspondence recipient identity fail closed",
);
check(
  verifier.includes("CRA recipient requires an exact bureau authority") &&
    verifier.includes("non-CRA recipient cannot claim bureau authority") &&
    verifier.includes("valid Equifax evidence cannot enter TransUnion CRA correspondence") &&
    verifier.includes("same Equifax CRA recipient rejects valid Experian evidence") &&
    verifier.includes("correspondence item cannot cross consumer ownership") &&
    verifier.includes("sealed correspondence cannot replace its CRA recipient") &&
    verifier.includes("version membership cannot cross CRA correspondence recipients") &&
    verifier.includes("Equifax CRA packet cannot consolidate a TransUnion CRA correspondence") &&
    verifier.includes("item-first race against correspondence recipient retarget") &&
    verifier.includes("retarget-first race against correspondence item insert") &&
    verifier.includes("immutable recipient authority races item insertion"),
  "verifier attacks direct, sealed, owner, downstream, and concurrent routing bypasses",
);
check(
  migration.includes('CONSTRAINT "packet_enclosure_packet_fkey"') &&
    migration.includes('CONSTRAINT "packet_enclosure_artifact_fkey"') &&
    migration.includes('CONSTRAINT "artifact_primary_packet_membership_fkey"') &&
    migration.includes('CONSTRAINT "acv_packet_membership_fkey"'),
  "packet enclosure, artifact primary, and ACV exact membership FKs exist",
);
check(
  migration.includes("p0_validate_approved_mailing_context") &&
    migration.includes("p0_validate_packet_correspondence_approval") &&
    migration.includes("p0_validate_canonical_artifact_context") &&
    migration.includes("p0_validate_artifact_correspondence_context"),
  "approved/canonical mailing context validators exist",
);
check(
  migration.includes("p0_validate_correspondence_version_seal") &&
    migration.includes("p0_validate_packet_seal") &&
    migration.includes("p0_validate_artifact_seal") &&
    countMatches(migration, /DEFERRABLE INITIALLY DEFERRED/g) === 10,
  "correspondence, packet, and artifact child counts are deferred-sealed",
);
check(
  verifier.includes("approved correspondence rejects post-seal child") &&
    verifier.includes("approved packet rejects post-seal child") &&
    verifier.includes("canonical artifact count mismatch rejected") &&
    verifier.includes("two concurrent writers against the sealed packet"),
  "verifier covers post-seal inserts, count mismatch, and concurrent writers",
);
check(
  migration.includes("CREATE FUNCTION p0_lock_assessment_input(") &&
    countMatches(migration, /PERFORM p0_lock_assessment_input\(/g) >= 2 &&
    migration.includes('FROM "ReportVersionAccount" rva') &&
    migration.includes("FOR UPDATE;"),
  "assessment and account evidence share the exact membership-row lock",
);
check(
  verifier.includes("assessment-first race against adverse evidence") &&
    verifier.includes("adverse-evidence-first race against CLEAN assessment") &&
    verifier.includes("stale_clean_adverse_count") &&
    verifier.includes("assessment_first_state") &&
    verifier.includes("evidence_first_state"),
  "verifier covers both assessment/evidence race orderings and forbids stale coexistence",
);
check(
  [
    "CreditScoreObservation",
    "ReportComparison",
    "ReportDifference",
    "DisputeOutcome",
  ].every((table) => migrationTables.has(table) && rollbackTables.has(table)),
  "score, comparison, difference, and outcome addendum tables have rollback parity",
);
check(
  verifier.includes("manual credit score cannot masquerade as primary report evidence") &&
    verifier.includes("comparison rejects duplicate exact extraction run pair") &&
    verifier.includes("difference rejects nonexistent exact comparison chain") &&
    verifier.includes("outcome rejects nonexistent temporal comparison chain"),
  "verifier includes score/comparison/difference/outcome negative cases",
);
check(
  differenceValidator.includes(
    "Field disappearance is a changed field fact, not whole-account deletion.",
  ) &&
    differenceValidator.includes(
      'prior_field."presence" IS DISTINCT FROM current_field."presence"',
    ) &&
    differenceValidator.includes(
      'NEW."changeKind" <> expected_field_change OR NEW."differenceState" <> \'CHANGED\'',
    ) &&
    differenceValidator.includes(
      "field presence transitions must use the exact field-specific changed kind, never account-deletion vocabulary",
    ),
  "field PRESENT-to-ABSENT semantics remain field-specific and non-deletion",
);
check(
  differenceValidator.includes(
    "account presence PRESENT to PRESENT must be unchanged and present on the current report",
  ) &&
    differenceValidator.includes(
      "account presence PRESENT to ABSENT_CONFIRMED must be exact current-report absence",
    ) &&
    differenceValidator.includes(
      "account presence ABSENT_CONFIRMED to PRESENT must be a new current-report item",
    ) &&
    differenceValidator.includes(
      "account presence ABSENT_CONFIRMED to ABSENT_CONFIRMED must be an unchanged non-deletion fact",
    ),
  "account presence exhaustively enforces P/P, P/A, A/P, and A/A",
);
check(
  migration.includes('CONSTRAINT "report_difference_prior_score_fkey"') &&
    migration.includes('CONSTRAINT "report_difference_current_score_fkey"') &&
    differenceValidator.includes(
      'prior_score."sourceMethodKey" IS NOT DISTINCT FROM NEW."priorScoreSourceMethodKey"',
    ) &&
    differenceValidator.includes(
      'current_score."sourceMethodVersion" IS NOT DISTINCT FROM NEW."currentScoreSourceMethodVersion"',
    ) &&
    differenceValidator.includes(
      'prior_score."occurrence" IS NOT DISTINCT FROM NEW."scoreOccurrence"',
    ) &&
    differenceValidator.includes(
      'current_score_report."reportDateProvenance" = \'SOURCE_REPORTED\'',
    ) &&
    differenceValidator.includes(
      'prior_score_report."reportDate" <= current_score_report."reportDate"',
    ),
  "score comparability pins side-specific method/version/occurrence and source dates",
);
check(
  migration.includes('CREATE UNIQUE INDEX "credit_score_supersession_key"') &&
    scoreValidator.includes(
      'prior_score."occurrence" IS DISTINCT FROM NEW."occurrence"',
    ) &&
    scoreValidator.includes(
      'prior_score."sourceMethodKey" IS DISTINCT FROM NEW."sourceMethodKey"',
    ) &&
    scoreValidator.includes(
      "credit score supersession must be the exact prior revision of the same report/run/method/occurrence context",
    ) &&
    differenceValidator.includes(
      "one immutable comparison may contain only one difference for an exact logical target",
    ) &&
    differenceValidator.includes(
      'prior_difference."currentScoreSourceMethodVersion" IS DISTINCT FROM NEW."currentScoreSourceMethodVersion"',
    ),
  "score and score-difference supersession preserve exact logical-target uniqueness",
);
check(
  migration.includes('CONSTRAINT "DisputeOutcome_decision_ck"') &&
    outcomeValidator.includes(
      'NEW."outcomeState" IN (\'CORRECTED\', \'NEW_CONFLICT\')',
    ) &&
    outcomeValidator.includes(
      'NEW."decisionSource" IS DISTINCT FROM \'HUMAN_CONFIRMED\'',
    ) &&
    outcomeValidator.includes(
      "NEW.\"outcomeState\" IN ('UNCHANGED', 'CHANGED_DIFFERENTLY', 'NO_LONGER_REPORTED', 'UNABLE_TO_DETERMINE')",
    ) &&
    outcomeValidator.includes(
      'NEW."decisionSource" IS DISTINCT FROM \'SYSTEM_DERIVED\'',
    ) &&
    outcomeValidator.includes(
      "pending outcomes cannot claim a decision source",
    ),
  "outcome decisionSource is state-exact for pending, human, and observable states",
);
const addendumRollbackOrder = [
  'DROP TABLE IF EXISTS "DisputeOutcome"',
  'DROP TABLE IF EXISTS "ReportDifference"',
  'DROP TABLE IF EXISTS "ReportComparison"',
  'DROP TABLE IF EXISTS "CreditScoreObservation"',
].map((needle) => rollback.indexOf(needle));
check(
  addendumRollbackOrder.every((position) => position >= 0) &&
    addendumRollbackOrder.every(
      (position, index) =>
        index === 0 || addendumRollbackOrder[index - 1] < position,
    ),
  "addendum rollback follows Outcome, Difference, Comparison, Score dependency order",
);

check(
  verifier.includes(`EXPECTED_SCHEMA_SHA256="${expectedSchemaSha}"`) &&
    verifier.includes(`EXPECTED_MIGRATION_SHA256="${expectedMigrationSha}"`),
  "verifier pins only the final frozen hashes",
);
const firstImageInspect = verifier.indexOf("docker image inspect");
check(
  firstImageInspect > 0 &&
    verifier.indexOf('sha256_file "${SCHEMA_FILE}"') < firstImageInspect &&
    verifier.indexOf('sha256_file "${MIGRATION_SQL}"') < firstImageInspect &&
    verifier.indexOf("verify_rollback_manifest") < firstImageInspect,
  "hash and rollback-manifest guards run before the first Docker operation",
);
check(
  verifier.includes("unset DATABASE_URL DIRECT_URL SHADOW_DATABASE_URL") &&
    verifier.includes("unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD") &&
    verifier.includes("env -i") &&
    verifier.includes("[[ $# -ne 0 ]]") &&
    verifier.includes("no arguments are accepted"),
  "ambient database targets are cleared and caller targets are rejected",
);
check(
  verifier.includes("--publish 127.0.0.1::5432") &&
    verifier.includes("--pull=never") &&
    verifier.includes("creditvector.p0.disposable=true") &&
    verifier.includes("^p0_disposable_") &&
    !verifier.includes("--network host") &&
    !/\bdocker pull\b|\bcurl\b|\bwget\b/.test(verifier),
  "Docker target is generated, loopback-only, pinned-local, and offline",
);
check(
  countMatches(verifier, /run_prisma_deploy/g) >= 6 &&
    verifier.includes("baseline-deploy") &&
    verifier.includes("p0-forward-deploy") &&
    verifier.includes("p0-second-deploy") &&
    verifier.includes("rebuild-full-deploy") &&
    !/prisma[^\n]*(?:db push|db execute)/.test(verifier),
  "verifier is migration-first and never uses db push/db execute",
);
check(
  verifier.includes("missing/wrong sentinel and unsafe target fail closed") &&
    verifier.includes("baseline_after_rollback") &&
    verifier.includes("rebuild-second-deploy") &&
    verifier.includes("teardown: disposable container removed=true"),
  "verifier covers rollback guards, baseline preservation, rebuild, and teardown",
);
check(
  verifier.includes("legacy origin cannot be promoted") &&
    verifier.includes("legacy report rejects v2 extraction") &&
    verifier.includes("baseline_after_forward") &&
    verifier.includes("baseline_after_rollback"),
  "legacy authority and unchanged baseline rows are covered",
);
check(
  verifier.includes("DISPOSABLE DATABASE ONLY") &&
    rollback.includes("DISPOSABLE DATABASE ONLY"),
  "disposable-only boundary is printed in verifier and rollback",
);
check(
  verifier.includes("EXPECTED_POSITIVE_SUITE_COUNT=3") &&
    verifier.includes("EXPECTED_NEGATIVE_CASE_COUNT=65") &&
    verifier.includes(
      '[[ "${negative_pass_count}" == "${EXPECTED_NEGATIVE_CASE_COUNT}" ]]',
    ),
  "behavioral suite counts are exact and fail closed",
);
check(
  verifier.includes("P0_POSITIVE_SUITE_PASS persisted_progress_chain") &&
    verifier.includes("P0_PROGRESS_CHAIN_ASSERT_PASS exact rows and pins") &&
    verifier.includes('[[ "${progress_chain_state}" == "2|1|3|2|2" ]]'),
  "verifier requires committed score/difference/outcome progress-chain pins",
);

const forbiddenTargetPattern =
  /(?:supabase|neon|railway|render\.com|amazonaws|cloudsql|azure|production|prod-db|creditvector\.app)/i;
check(
  !forbiddenTargetPattern.test(
    verifier
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n"),
  ),
  "verifier contains no production or hosted database target",
);
check(
  schema.includes("model PacketEnclosure") &&
    schema.includes("model ArtifactCorrespondenceVersion"),
  "final Prisma schema exposes packet enclosure and ACV models",
);

if (failures.length > 0) {
  console.error("P0 migration guard FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`P0 migration guard PASS (${passed} static assertions)`);
console.log("DISPOSABLE DATABASE ONLY");
