import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const foundationPath =
  "prisma/migrations/20260808_p0_credit_truth_foundation/migration.sql";
const phase2aPath =
  "prisma/migrations/20260810_p0_phase2a_ingestion_round0/migration.sql";
const trustedWriterPath =
  "prisma/migrations/20260811_p0_trusted_writer_gate/migration.sql";
const boundaryPath =
  "scripts/sql/p0-trusted-writer-validator-boundary.sql";
const roleContractPath =
  "scripts/sql/p0-trusted-writer-db-role-contract.sql";

const foundation = readFileSync(resolve(root, foundationPath), "utf8");
const phase2a = readFileSync(resolve(root, phase2aPath), "utf8");
const trustedWriter = readFileSync(resolve(root, trustedWriterPath), "utf8");
const boundary = readFileSync(resolve(root, boundaryPath), "utf8");
const roleContract = readFileSync(resolve(root, roleContractPath), "utf8");
const migrationSources = [foundation, phase2a, trustedWriter];
const allMigrationSources = readdirSync(resolve(root, "prisma/migrations"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((entry) =>
    readFileSync(resolve(root, "prisma/migrations", entry.name, "migration.sql"), "utf8"),
  );

interface ExpectedFunction {
  readonly identity: string;
  readonly ddl: string;
  readonly name: string;
  readonly definer: boolean;
  readonly sha256: string;
}

interface ExpectedAuthorityTrigger {
  readonly tableName: string;
  readonly triggerName: string;
  readonly routineIdentity: string;
  readonly triggerType: number;
  readonly isConstraint: boolean;
  readonly isDeferrable: boolean;
  readonly initiallyDeferred: boolean;
  readonly enabledMode: "O";
  readonly argumentHex: string;
}

const expectedFunctions: readonly ExpectedFunction[] = Object.freeze([
  { identity: "public.p0_validate_artifact_seal()", ddl: "public.p0_validate_artifact_seal()", name: "p0_validate_artifact_seal", definer: true, sha256: "1d608a8f885dc0b0c1966284a5592f997074bf81f6ff5fae095083315ace7759" },
  { identity: "public.p0_validate_report_account_subject()", ddl: "public.p0_validate_report_account_subject()", name: "p0_validate_report_account_subject", definer: true, sha256: "17a0c43aca18f98ed07a8df12185beb0350539a01fa65b97a6561f204619605a" },
  { identity: "public.p0_reject_post_assessment_account_input()", ddl: "public.p0_reject_post_assessment_account_input()", name: "p0_reject_post_assessment_account_input", definer: true, sha256: "3b9a5e5c2b0d8daed5850306de0e2a8d383847db98907cf9b13d39331f750923" },
  { identity: "public.p0_reject_post_assessment_coverage()", ddl: "public.p0_reject_post_assessment_coverage()", name: "p0_reject_post_assessment_coverage", definer: true, sha256: "661786850fcaeeff24d5865595d5d56b5a73d6f1c5c997965283bed700eb260f" },
  { identity: "public.p0_validate_credit_score_insert()", ddl: "public.p0_validate_credit_score_insert()", name: "p0_validate_credit_score_insert", definer: true, sha256: "5e814b4b1e315b89dcee488503e3670d33e47dfd2ce08a9f16cadf9a07fad3ba" },
  { identity: "public.p0_reject_post_comparison_identity_input()", ddl: "public.p0_reject_post_comparison_identity_input()", name: "p0_reject_post_comparison_identity_input", definer: true, sha256: "6980f52fef7531727c3e4315b99204b388f8b45415af8d0a90d4536d4d2ec861" },
  { identity: "public.p0_2a_validate_extraction_input()", ddl: "public.p0_2a_validate_extraction_input()", name: "p0_2a_validate_extraction_input", definer: true, sha256: "310db03be26e73f6e9cdd3e38b6f18095efbc2404804371160f85d5efa98b8ea" },
  { identity: "public.p0_2a_validate_score_model_evidence()", ddl: "public.p0_2a_validate_score_model_evidence()", name: "p0_2a_validate_score_model_evidence", definer: true, sha256: "45267e4a7b04080a4af65f07eb1a6b92bcc625d3ac3316e828957fe242dd801f" },
  { identity: "public.p0_2a_validate_bureau_report_date()", ddl: "public.p0_2a_validate_bureau_report_date()", name: "p0_2a_validate_bureau_report_date", definer: true, sha256: "f7288d1057824cf3cf71cc489b29a1d1a6a666462feb1efd704864e7c6c229c9" },
  { identity: "public.p0_2a_validate_round0_source_completeness()", ddl: "public.p0_2a_validate_round0_source_completeness()", name: "p0_2a_validate_round0_source_completeness", definer: true, sha256: "f32135f3eda156e4e1b24defab93ff11784e2cf5a00ef8e359179fd3889333a5" },
  { identity: "public.p0_2a_validate_identity_baseline_source_seal()", ddl: "public.p0_2a_validate_identity_baseline_source_seal()", name: "p0_2a_validate_identity_baseline_source_seal", definer: true, sha256: "3fd2e45195a3e21da7e6bf69eb10595e76526ecabe5f72c8c07bf5ad1f8442f5" },
  { identity: "public.p0_2a_validate_round0_source_seal_deferred()", ddl: "public.p0_2a_validate_round0_source_seal_deferred()", name: "p0_2a_validate_round0_source_seal_deferred", definer: true, sha256: "be3ab78770b6e552689265a4c47d00ec79994de863cdee2b47c3d9d30956573a" },
  { identity: "public.p0_2a_validate_report_ingestion_mutation()", ddl: "public.p0_2a_validate_report_ingestion_mutation()", name: "p0_2a_validate_report_ingestion_mutation", definer: true, sha256: "3f226333428af5761f279ffa0a57c56e5cefc18c90a619b565b92b2aee270105" },
  { identity: "public.p0_2a_validate_identity_fact_insert()", ddl: "public.p0_2a_validate_identity_fact_insert()", name: "p0_2a_validate_identity_fact_insert", definer: true, sha256: "a0e1045e7dd2addbce6396bc45151cfbf1a18ccd7712f661fdf81ced2c538268" },
  { identity: "public.p0_2a_validate_identity_category_completion()", ddl: "public.p0_2a_validate_identity_category_completion()", name: "p0_2a_validate_identity_category_completion", definer: true, sha256: "8e846b9ef7af667d3f94e3a5b8bb514ef4905c1ddc8e30ced7167efca711e043" },
  { identity: "public.p0_2a_reject_account_presence_after_source_completeness()", ddl: "public.p0_2a_reject_account_presence_after_source_completeness()", name: "p0_2a_reject_account_presence_after_source_completeness", definer: true, sha256: "cb02f7e087241c27d3ece5f110709ba535a24c5e3c6e998ddb2e49fe957332b1" },
  { identity: "public.p0_2a_reject_account_after_identity_completion()", ddl: "public.p0_2a_reject_account_after_identity_completion()", name: "p0_2a_reject_account_after_identity_completion", definer: true, sha256: "adf17da0fefc0c85423647e336f33190ca7db3dd0f5c5360d9ad8df18f235895" },
  { identity: "public.p0_2a_validate_identity_correspondence_assertion()", ddl: "public.p0_2a_validate_identity_correspondence_assertion()", name: "p0_2a_validate_identity_correspondence_assertion", definer: true, sha256: "655e06940782b9834fa647bcbbfdbd6be55262e686054aac51001cfd9b05d425" },
  { identity: "public.p0_2a_validate_consumer_account_review()", ddl: "public.p0_2a_validate_consumer_account_review()", name: "p0_2a_validate_consumer_account_review", definer: true, sha256: "ebb9cb1589d6d9e86057e2174cfe55147fc7082d8189dca8d8181311cbf29382" },
  { identity: "public.p0_2a_validate_identity_baseline_account_review_membership()", ddl: "public.p0_2a_validate_identity_baseline_account_review_membership()", name: "p0_2a_validate_identity_baseline_account_review_membership", definer: true, sha256: "9634f4ddece91e54e534fc898fe537d4bfcba5a64e76e77f730a4944de4c6fb6" },
  { identity: "public.p0_2a_validate_confirmed_baseline_child_deferred()", ddl: "public.p0_2a_validate_confirmed_baseline_child_deferred()", name: "p0_2a_validate_confirmed_baseline_child_deferred", definer: true, sha256: "7bf3ddc8ef72c03a0f1b10cb9d0307a4c7e933fe959e1004d4e780a2724f567d" },
  { identity: "public.p0_2a_validate_case_action_decision()", ddl: "public.p0_2a_validate_case_action_decision()", name: "p0_2a_validate_case_action_decision", definer: true, sha256: "ef3d13ac3d1b87a5cccfc6df2d27789ddd39b6c974e7dc0f9ce3e06e5f22eceb" },
  { identity: "public.p0_2a_validate_case_action_source_ref()", ddl: "public.p0_2a_validate_case_action_source_ref()", name: "p0_2a_validate_case_action_source_ref", definer: true, sha256: "4ae00541347da78825e33ec30d4589608b866c7fc0e77e8291919f4f08bafd1f" },
  { identity: "public.p0_2a_validate_case_action_source_membership()", ddl: "public.p0_2a_validate_case_action_source_membership()", name: "p0_2a_validate_case_action_source_membership", definer: true, sha256: "ceef5ade280fdc45eaa36e74002e66e3b94408a44a8c992090e2a438eaf8314b" },
  { identity: "public.p0_lock_extraction_run(text,text,text,text)", ddl: "public.p0_lock_extraction_run(text, text, text, text)", name: "p0_lock_extraction_run", definer: false, sha256: "04988bd7d94cbd3a0cf100467354fbfc675ef4509ce1dc11f463a85e82139368" },
  { identity: "public.p0_lock_assessment_input(text,text,text,text,text)", ddl: "public.p0_lock_assessment_input(text, text, text, text, text)", name: "p0_lock_assessment_input", definer: false, sha256: "5a1845a681a657babcae257c5a4042392c5611c3a2d93474adc738cd3af3c066" },
  { identity: "public.p0_reject_if_run_is_compared(text,text,text,text)", ddl: "public.p0_reject_if_run_is_compared(text, text, text, text)", name: "p0_reject_if_run_is_compared", definer: false, sha256: "6925e3418574288ceefc7a17bb3d95b443f8a135e61ec1a3277788de10e9c485" },
  { identity: 'public.p0_2a_identity_fact_matches_category(public."IdentityFactType",public."IdentityReviewCategory",public."IdentityReviewCategory")', ddl: 'public.p0_2a_identity_fact_matches_category(public."IdentityFactType", public."IdentityReviewCategory", public."IdentityReviewCategory")', name: "p0_2a_identity_fact_matches_category", definer: false, sha256: "9c35391788b30fe188cc1308273b7db026d310548841855f9716ed24e3c9dbcb" },
]);

const writerMutableTables = Object.freeze([
  "Account",
  "AccountPresenceObservation",
  "Artifact",
  "BureauReportDateEvidence",
  "CaseActionDecision",
  "CaseActionSourceRef",
  "ConsumerAccountReviewReceipt",
  "ConsumerAssertion",
  "CreditScoreObservation",
  "CreditTruthScope",
  "ExtractionBureauCoverage",
  "ExtractionRun",
  "FieldObservation",
  "HistoricalEvidence",
  "IdentityBaseline",
  "IdentityBaselineAccountReviewMembership",
  "IdentityCategoryCompletion",
  "IdentityCorrespondenceAssertion",
  "IdentityFact",
  "P0SensitiveAccessEvent",
  "P0SourceObject",
  "ReportIngestion",
  "ReportVersion",
  "ReportVersionAccount",
  "Round0SourceCompletenessEvidence",
  "SectionCompleteness",
]);

const trustedReadAuthorityTables = Object.freeze([
  "DerivedAccountAssessment",
  "DisputeCase",
  "Report",
  "User",
]);

const authorityTables = Object.freeze(
  [...writerMutableTables, ...trustedReadAuthorityTables].sort(),
);

const readableTables = Object.freeze([
  "AccountPresenceObservation",
  "Artifact",
  "ArtifactCorrespondenceVersion",
  "CaseActionDecision",
  "CaseActionSourceRef",
  "ConsumerAccountReviewReceipt",
  "ConsumerAssertion",
  "CreditScoreObservation",
  "DerivedAccountAssessment",
  "ExtractionBureauCoverage",
  "ExtractionRun",
  "FieldObservation",
  "IdentityBaseline",
  "IdentityBaselineAccountReviewMembership",
  "IdentityCategoryCompletion",
  "IdentityCorrespondenceAssertion",
  "IdentityFact",
  "ReportComparison",
  "ReportIngestion",
  "ReportVersion",
  "ReportVersionAccount",
  "Round0SourceCompletenessEvidence",
]);

const lockTables = Object.freeze([
  "AccountPresenceObservation",
  "Artifact",
  "CaseActionDecision",
  "ConsumerAccountReviewReceipt",
  "ConsumerAssertion",
  "DerivedAccountAssessment",
  "ExtractionRun",
  "FieldObservation",
  "IdentityBaseline",
  "IdentityCategoryCompletion",
  "IdentityCorrespondenceAssertion",
  "IdentityFact",
  "ReportIngestion",
  "ReportVersion",
  "ReportVersionAccount",
  "Round0SourceCompletenessEvidence",
]);

let passed = 0;
function check(name: string, condition: unknown): void {
  assert(condition, name);
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

function digest(algorithm: "sha256" | "md5", value: string): string {
  return createHash(algorithm).update(value).digest("hex");
}

function sameSet(actual: Iterable<string>, expected: Iterable<string>): boolean {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceBody(name: string): string {
  const pattern = new RegExp(
    `CREATE(?: OR REPLACE)? FUNCTION\\s+${escapeRegExp(name)}\\s*\\([\\s\\S]*?\\)\\s*RETURNS[\\s\\S]*?\\bAS\\s+\\$\\$([\\s\\S]*?)\\$\\$;`,
  );
  const matches = migrationSources
    .map((source) => source.match(pattern)?.[1])
    .filter((body): body is string => body !== undefined);
  assert.equal(matches.length, 1, `exactly one migration body for ${name}`);
  return matches[0]!;
}

function authorityTriggerKey(trigger: ExpectedAuthorityTrigger): string {
  return JSON.stringify([
    trigger.tableName,
    trigger.triggerName,
    trigger.routineIdentity,
    trigger.triggerType,
    trigger.isConstraint,
    trigger.isDeferrable,
    trigger.initiallyDeferred,
    trigger.enabledMode,
    trigger.argumentHex,
  ]);
}

function sourceAuthorityTriggers(): readonly ExpectedAuthorityTrigger[] {
  const targetTables = new Set(authorityTables);
  const triggerPattern =
    /CREATE\s+(CONSTRAINT\s+)?TRIGGER\s+"([^"]+)"\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+([\s\S]*?)\s+ON\s+"([^"]+)"([\s\S]*?)EXECUTE\s+FUNCTION\s+(?:public\.)?([a-z0-9_]+)\(([^;]*)\);/gi;
  const triggers: ExpectedAuthorityTrigger[] = [];
  for (const source of allMigrationSources) {
    for (const match of source.matchAll(triggerPattern)) {
      const [
        fullDefinition,
        constraintKeyword,
        triggerName,
        rawTiming,
        rawEvents,
        tableName,
        triggerOptions,
        functionName,
        rawArguments,
      ] = match;
      if (!targetTables.has(tableName!)) continue;
      assert.doesNotMatch(fullDefinition!, /\bUPDATE\s+OF\b/i);
      assert.doesNotMatch(triggerOptions!, /\bWHEN\s*\(/i);
      assert.doesNotMatch(triggerOptions!, /\bREFERENCING\b/i);
      const rowTrigger = /\bFOR\s+EACH\s+ROW\b/i.test(triggerOptions!);
      const statementTrigger = /\bFOR\s+EACH\s+STATEMENT\b/i.test(triggerOptions!);
      assert.notEqual(rowTrigger, statementTrigger, `exact trigger level for ${triggerName}`);
      const timing = rawTiming!.replace(/\s+/g, " ").toUpperCase();
      const events = rawEvents!
        .split(/\s+OR\s+/i)
        .map((event) => event.trim().toUpperCase());
      assert(events.length > 0, `trigger events exist for ${triggerName}`);
      assert(
        events.every((event) =>
          ["INSERT", "UPDATE", "DELETE", "TRUNCATE"].includes(event),
        ),
        `trigger events are closed-code for ${triggerName}`,
      );
      const triggerType =
        (rowTrigger ? 1 : 0) |
        (timing === "BEFORE" ? 2 : timing === "INSTEAD OF" ? 64 : 0) |
        (events.includes("INSERT") ? 4 : 0) |
        (events.includes("DELETE") ? 8 : 0) |
        (events.includes("UPDATE") ? 16 : 0) |
        (events.includes("TRUNCATE") ? 32 : 0);
      const argumentsList = Array.from(
        rawArguments!.matchAll(/'((?:''|[^'])*)'/g),
        (argument) => argument[1]!.replaceAll("''", "'"),
      );
      triggers.push({
        tableName: tableName!,
        triggerName: triggerName!,
        routineIdentity: `public.${functionName}()`,
        triggerType,
        isConstraint: Boolean(constraintKeyword),
        isDeferrable: /\bDEFERRABLE\b/i.test(triggerOptions!),
        initiallyDeferred: /\bINITIALLY\s+DEFERRED\b/i.test(triggerOptions!),
        enabledMode: "O",
        argumentHex: Buffer.from(
          argumentsList.length > 0 ? `${argumentsList.join("\0")}\0` : "",
          "utf8",
        ).toString("hex"),
      });
    }
  }
  triggers.sort((left, right) =>
    authorityTriggerKey(left).localeCompare(authorityTriggerKey(right)),
  );
  return Object.freeze(triggers);
}

const authorityTableBlock = boundary.slice(
  boundary.indexOf("INSERT INTO p0_validator_authority_table_expected"),
  boundary.indexOf("CREATE TEMP TABLE p0_validator_trigger_expected"),
);
const sqlAuthorityTables = Array.from(
  authorityTableBlock.matchAll(/\('([^']+)'\)/g),
  (match) => match[1]!,
);
const triggerInventoryBlock = boundary.slice(
  boundary.indexOf("INSERT INTO p0_validator_trigger_expected"),
  boundary.indexOf("DO $p0_validator_preflight$"),
);
const sqlAuthorityTriggers: readonly ExpectedAuthorityTrigger[] = Array.from(
  triggerInventoryBlock.matchAll(
    /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(TRUE|FALSE),\s*(TRUE|FALSE),\s*(TRUE|FALSE),\s*'([A-Z])',\s*'([0-9a-f]*)'\)/g,
  ),
  (match) => ({
    tableName: match[1]!,
    triggerName: match[2]!,
    routineIdentity: match[3]!,
    triggerType: Number(match[4]),
    isConstraint: match[5] === "TRUE",
    isDeferrable: match[6] === "TRUE",
    initiallyDeferred: match[7] === "TRUE",
    enabledMode: match[8]! as "O",
    argumentHex: match[9]!,
  }),
);

const writableArrayStart = roleContract.indexOf(
  "FROM unnest(ARRAY[",
  roleContract.indexOf("'GRANT SELECT, INSERT ON TABLE"),
);
const writableArrayEnd = roleContract.indexOf(
  "]) AS allowed_tables",
  writableArrayStart,
);
assert(writableArrayStart >= 0 && writableArrayEnd > writableArrayStart);
const roleContractWritableTables = Array.from(
  roleContract
    .slice(writableArrayStart, writableArrayEnd)
    .matchAll(/'"([A-Za-z0-9]+)"'/g),
  (match) => match[1]!,
);
const referenceArray = roleContract.match(
  /FROM unnest\(ARRAY\[([^\]]+)\]\) AS reference_tables/,
)?.[1];
assert(referenceArray !== undefined);
const roleContractReferenceTables = Array.from(
  referenceArray.matchAll(/'"([A-Za-z0-9]+)"'/g),
  (match) => match[1]!,
);
const migrationAuthorityTriggers = sourceAuthorityTriggers();

const sqlInventoryRows = [...boundary.matchAll(
  /\('([^']+)',\s*'([^']+)',\s*(TRUE|FALSE),\s*'([0-9a-f]{64})',\s*'([0-9a-f]{32})'\)/g,
)].map((match) => ({
  identity: match[1]!,
  name: match[2]!,
  definer: match[3] === "TRUE",
  sha256: match[4]!,
  md5: match[5]!,
}));

check("exact inventory contains 28 functions", expectedFunctions.length === 28);
check(
  "exact inventory contains 24 entry definers",
  expectedFunctions.filter((entry) => entry.definer).length === 24,
);
check(
  "exact inventory contains four owner-only invoker helpers",
  expectedFunctions.filter((entry) => !entry.definer).length === 4,
);
check("SQL inventory has exactly 28 rows", sqlInventoryRows.length === 28);
check(
  "SQL and verifier inventories have identical identities",
  sameSet(sqlInventoryRows.map((row) => row.identity), expectedFunctions.map((entry) => entry.identity)),
);
check(
  "all privileged function names are unique",
  new Set(expectedFunctions.map((entry) => entry.name)).size === expectedFunctions.length,
);
check("trusted-chain relation scope contains exact 30 tables", authorityTables.length === 30);
check("trusted-chain relation scope contains exact 26 mutable tables", writerMutableTables.length === 26);
check("trusted-chain relation scope contains exact four read/auth roots", trustedReadAuthorityTables.length === 4);
check(
  "writer-mutable trigger scope matches the database role contract",
  roleContractWritableTables.length === writerMutableTables.length &&
    sameSet(roleContractWritableTables, writerMutableTables),
);
check(
  "read-only assessment/case roots match the database role contract",
  sameSet(roleContractReferenceTables, ["DerivedAccountAssessment", "DisputeCase"]),
);
check(
  "User and Report authentication/source roots are column-scoped by the role contract",
  roleContract.includes('GRANT SELECT (%s) ON TABLE public."User"') &&
    roleContract.includes('GRANT SELECT (%s) ON TABLE public."Report"'),
);
check(
  "SQL trusted-chain table allowlist is exact",
  sqlAuthorityTables.length === authorityTables.length &&
    sameSet(sqlAuthorityTables, authorityTables),
);
check("all repository migration sources yield exact 87 authority trigger edges", migrationAuthorityTriggers.length === 87);
check(
  "migration source authority graph has exact 37 trigger functions",
  new Set(migrationAuthorityTriggers.map((trigger) => trigger.routineIdentity)).size === 37,
);
check(
  "Report and DisputeCase are pinned zero-trigger authority roots",
  migrationAuthorityTriggers.every(
    (trigger) => trigger.tableName !== "Report" && trigger.tableName !== "DisputeCase",
  ) &&
    sqlAuthorityTriggers.every(
      (trigger) => trigger.tableName !== "Report" && trigger.tableName !== "DisputeCase",
    ),
);
check("SQL authority trigger manifest contains exact 87 edges", sqlAuthorityTriggers.length === 87);
check(
  "SQL and migration-source authority trigger manifests are identical",
  sameSet(
    sqlAuthorityTriggers.map(authorityTriggerKey),
    migrationAuthorityTriggers.map(authorityTriggerKey),
  ),
);
check(
  "SQL authority trigger manifest contains no duplicate edge",
  new Set(sqlAuthorityTriggers.map(authorityTriggerKey)).size === sqlAuthorityTriggers.length,
);
check(
  "SQL authority trigger manifest has exact 37 function identities",
  new Set(sqlAuthorityTriggers.map((trigger) => trigger.routineIdentity)).size === 37,
);
check(
  "trusted-chain table allowlist imports no Phase 2B-only relation",
  [
    "Correspondence",
    "CorrespondenceItem",
    "CorrespondenceVersion",
    "Packet",
    "PacketCorrespondenceVersion",
    "PacketEnclosure",
  ].every((tableName) => !authorityTables.includes(tableName)),
);

for (const expected of expectedFunctions) {
  const body = sourceBody(expected.name);
  const sqlRow = sqlInventoryRows.find((row) => row.identity === expected.identity);
  check(`${expected.name} migration SHA-256 is frozen`, digest("sha256", body) === expected.sha256);
  check(`${expected.name} SQL SHA-256 receipt is exact`, sqlRow?.sha256 === expected.sha256);
  check(`${expected.name} SQL runtime MD5 receipt is exact`, sqlRow?.md5 === digest("md5", body));
  check(`${expected.name} SQL security class is exact`, sqlRow?.definer === expected.definer);
  check(
    `${expected.name} body has no dynamic SQL or DML`,
    !/^\s*(?:EXECUTE\s|INSERT\s+INTO\s|UPDATE\s+[^;]+\s+SET\s|DELETE\s+FROM\s|TRUNCATE\s)/im.test(body),
  );
  check(
    `${expected.name} receives the dedicated owner explicitly`,
    boundary.includes(`ALTER FUNCTION ${expected.ddl} OWNER TO p0_validator_owner;`),
  );
  check(
    `${expected.name} receives the exact security class explicitly`,
    boundary.includes(
      `ALTER FUNCTION ${expected.ddl} SECURITY ${expected.definer ? "DEFINER" : "INVOKER"};`,
    ),
  );
  check(
    `${expected.name} has the exact fixed search_path`,
    boundary.includes(
      `ALTER FUNCTION ${expected.ddl} SET search_path = pg_catalog, public, pg_temp;`,
    ),
  );
  check(
    `${expected.name} revokes PUBLIC and direct writer execution`,
    boundary.includes(
      `REVOKE ALL PRIVILEGES ON FUNCTION ${expected.ddl} FROM PUBLIC, :"p0_writer_role";`,
    ),
  );
}

const ownerStatements = [...boundary.matchAll(/^ALTER FUNCTION (.+) OWNER TO p0_validator_owner;$/gm)].map((match) => match[1]!);
const definerStatements = [...boundary.matchAll(/^ALTER FUNCTION (.+) SECURITY DEFINER;$/gm)].map((match) => match[1]!);
const invokerStatements = [...boundary.matchAll(/^ALTER FUNCTION (.+) SECURITY INVOKER;$/gm)].map((match) => match[1]!);
const searchPathStatements = [...boundary.matchAll(/^ALTER FUNCTION (.+) SET search_path = pg_catalog, public, pg_temp;$/gm)].map((match) => match[1]!);
const revokeStatements = [...boundary.matchAll(/^REVOKE ALL PRIVILEGES ON FUNCTION (.+) FROM PUBLIC, :"p0_writer_role";$/gm)].map((match) => match[1]!);
const executeGrantStatements = [...boundary.matchAll(/^GRANT EXECUTE ON FUNCTION (.+) TO p0_validator_owner;$/gm)].map((match) => match[1]!);
const allExecuteGrantLines = boundary.split("\n").filter((line) => /^GRANT\s+EXECUTE\b/i.test(line));

check("owner ALTER allowlist is exact", sameSet(ownerStatements, expectedFunctions.map((entry) => entry.ddl)));
check("SECURITY DEFINER ALTER allowlist is exact", sameSet(definerStatements, expectedFunctions.filter((entry) => entry.definer).map((entry) => entry.ddl)));
check("SECURITY INVOKER helper allowlist is exact", sameSet(invokerStatements, expectedFunctions.filter((entry) => !entry.definer).map((entry) => entry.ddl)));
check("fixed search_path ALTER allowlist is exact", sameSet(searchPathStatements, expectedFunctions.map((entry) => entry.ddl)));
check("direct execution revocation allowlist is exact", sameSet(revokeStatements, expectedFunctions.map((entry) => entry.ddl)));
check(
  "owner-only EXECUTE grant allowlist is exact",
  executeGrantStatements.length === expectedFunctions.length &&
    allExecuteGrantLines.length === expectedFunctions.length &&
    sameSet(executeGrantStatements, expectedFunctions.map((entry) => entry.ddl)),
);
check("boundary never creates or replaces a function body", !/\bCREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\b/i.test(boundary));
check("boundary does not create or alter the dedicated role", !/\b(?:CREATE|ALTER)\s+ROLE\b/i.test(boundary));
check("boundary contains no dynamic SQL EXECUTE", !/^\s*EXECUTE\b/im.test(boundary));
check(
  "boundary grants routine execution only to the exact owner allowlist",
  [...boundary.matchAll(/^GRANT EXECUTE ON FUNCTION (.+) TO ([^;]+);$/gm)].every(
    (match) => match[2] === "p0_validator_owner" && executeGrantStatements.includes(match[1]!),
  ),
);

const selectGrantTables = [...boundary.matchAll(
  /^GRANT SELECT ON TABLE public\."([A-Za-z0-9]+)" TO p0_validator_owner;$/gm,
)].map((match) => match[1]!);
const updateGrantTables = [...boundary.matchAll(
  /^GRANT UPDATE \("id"\) ON TABLE public\."([A-Za-z0-9]+)" TO p0_validator_owner;$/gm,
)].map((match) => match[1]!);
check("validator SELECT grant union is exact", sameSet(selectGrantTables, readableTables));
check("ArtifactCorrespondenceVersion is read-only", selectGrantTables.includes("ArtifactCorrespondenceVersion") && !updateGrantTables.includes("ArtifactCorrespondenceVersion"));
check("validator row-lock UPDATE(id) union is exact", sameSet(updateGrantTables, lockTables));
check(
  "no broad or non-id UPDATE grant exists",
  !/^GRANT UPDATE ON TABLE/im.test(boundary) &&
    [...boundary.matchAll(/^GRANT UPDATE \(([^)]+)\) ON TABLE/gm)]
      .every((match) => match[1] === '"id"'),
);
check(
  "validator owner receives no mutation or delegation grant",
  !/^GRANT\s+(?:INSERT|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL\s+PRIVILEGES)\b/im.test(boundary),
);
check(
  "schema CREATE is transaction-scoped only for ownership transfer",
  boundary.match(/^GRANT CREATE ON SCHEMA public TO p0_validator_owner;$/gm)?.length === 1 &&
    boundary.match(/^REVOKE CREATE ON SCHEMA public FROM p0_validator_owner;$/gm)?.length === 1,
);
check(
  "schema CREATE is revoked before the post-audit",
  boundary.indexOf("REVOKE CREATE ON SCHEMA public FROM p0_validator_owner;") <
    boundary.indexOf("DO $p0_validator_post_audit$"),
);

check("dedicated owner must pre-exist", boundary.includes("p0_validator_owner role must already exist"));
check("dedicated owner is required NOLOGIN", boundary.includes("NOT rolcanlogin"));
check("dedicated owner is required non-superuser", boundary.includes("NOT rolsuper"));
check("dedicated owner is required without CREATEDB", boundary.includes("NOT rolcreatedb"));
check("dedicated owner is required without CREATEROLE", boundary.includes("NOT rolcreaterole"));
check("dedicated owner is required without inheritance", boundary.includes("NOT rolinherit"));
check("dedicated owner is required without replication", boundary.includes("NOT rolreplication"));
check("dedicated owner is required without BYPASSRLS", boundary.includes("NOT rolbypassrls"));
check("dedicated owner memberships and members are both rejected", boundary.includes("member = owner_oid OR roleid = owner_oid"));
check("unrelated owner objects fail closed", boundary.includes("p0_validator_owner owns an unrelated database object"));
check("first apply requires current installer ownership", boundary.includes("function_owner = installer_oid"));
check("first apply requires original invoker/null config", boundary.includes("function_definer OR function_config IS NOT NULL"));
check("reapply requires exact final owner security/config", boundary.includes("function_owner = owner_oid") && boundary.includes("validator security/config drifted after installation"));
check("third-party validator ownership fails closed", boundary.includes("validator has an unexpected owner before installation"));
check("mixed first-install/final state fails closed", boundary.includes("validator inventory mixes first-install and final ownership states"));
check("owner PUBLIC/default ACL drift fails closed", boundary.includes("validator owner appears in a default ACL"));
check("writer schema substitution remains denied", boundary.includes("has_schema_privilege(writer_oid, 'public', 'CREATE')"));
check("owner schema substitution remains denied", boundary.includes("has_schema_privilege(owner_oid, namespace_row.oid, 'CREATE')"));
check("runtime function body drift uses built-in MD5", boundary.includes("md5(function_source) <> expected.source_md5"));
check("runtime needs no pgcrypto extension", !/CREATE\s+EXTENSION|digest\s*\(/i.test(boundary));
check("runtime exact P0 definer allowlist is audited", boundary.includes("routine.proname LIKE 'p0\\_%' ESCAPE '\\'"));
check("unexpected overloads fail closed", boundary.includes("unexpected overload exists for a privileged validator name"));
check("writer direct EXECUTE is audited", boundary.includes("has_function_privilege(writer_oid, function_oid, 'EXECUTE')"));
check("PUBLIC EXECUTE ACL is covered by the non-owner rejection", boundary.includes("acl.grantee <> owner_oid") && boundary.includes("acl.privilege_type = 'EXECUTE'"));
check("every non-owner validator EXECUTE ACL is rejected", boundary.includes("acl.grantee <> owner_oid"));
check("each validator requires one explicit owner EXECUTE ACL", boundary.includes("acl.grantee = owner_oid") && boundary.includes(") <> 1"));
check("owner cannot execute unrelated non-system routines", boundary.includes("validator owner can execute an unrelated non-system routine"));
check(
  "runtime trigger audit freezes exact 30/87/37 graph counts",
  boundary.includes("p0_validator_authority_table_expected) <> 30") &&
    boundary.includes("p0_validator_trigger_expected) <> 87") &&
    boundary.includes("count(DISTINCT routine_identity) FROM p0_validator_trigger_expected) <> 37"),
);
check(
  "runtime trigger audit enumerates all non-internal authority-table triggers",
  boundary.includes("JOIN p0_validator_authority_table_expected authority_table") &&
    boundary.includes("AND NOT trigger_row.tgisinternal") &&
    !boundary.includes("trigger_row.tgfoid IN"),
);
check(
  "runtime trigger graph comparison is bidirectional",
  boundary.includes("FROM p0_validator_trigger_expected expected_trigger\n    WHERE NOT EXISTS") &&
    boundary.includes("unexpected or drifted non-internal trigger on trusted-writer authority table"),
);
check(
  "runtime trigger audit binds exact function edge and full trigger shape",
  boundary.includes("trigger_row.tgfoid = to_regprocedure(expected_trigger.routine_identity)") &&
    boundary.includes("trigger_row.tgtype::INTEGER = expected_trigger.trigger_type") &&
    boundary.includes("trigger_row.tgparentid = 0") &&
    boundary.includes("trigger_row.tgqual IS NULL") &&
    boundary.includes("trigger_row.tgattr::TEXT = ''") &&
    boundary.includes("trigger_row.tgoldtable IS NULL") &&
    boundary.includes("trigger_row.tgnewtable IS NULL") &&
    boundary.includes("encode(trigger_row.tgargs, 'hex') = expected_trigger.argument_hex"),
);
check("fixed catalog search_path is audited exactly", boundary.includes("ARRAY['search_path=pg_catalog, public, pg_temp']::TEXT[]"));
check("schema privileges are audited across every non-system schema", boundary.includes("validator owner schema privilege drift on %"));
check("table privileges are audited across every non-system schema", boundary.includes("validator owner table privilege drift on %.%"));
check("column privileges are audited across every non-system schema", boundary.includes("validator owner column privilege drift on %.%.%"));
check("sequence privileges are audited as absent across every non-system schema", boundary.includes("validator owner unexpectedly reaches sequence %.%"));
check("column INSERT and REFERENCES authority is rejected", boundary.includes("column_row.attnum, 'INSERT'") && boundary.includes("column_row.attnum, 'REFERENCES'"));
check("column SELECT authority is exact to read matrix", boundary.includes("column_row.attnum, 'SELECT'") && boundary.includes("column_row.relname = ANY(readable_tables)"));
check("boundary is transaction atomic", boundary.startsWith("\\set ON_ERROR_STOP on") && boundary.includes("\nBEGIN;\n") && boundary.endsWith("COMMIT;\n"));

check(
  "accepted migration sources contain no pre-existing SECURITY DEFINER routine",
  migrationSources.every((source) => !/\bSECURITY\s+DEFINER\b/i.test(source)),
);
check(
  "trusted-writer source-object validator stays outside the privileged boundary",
  !expectedFunctions.some((entry) => entry.name === "p0_trusted_writer_validate_source_object_insert") &&
    trustedWriter.includes("CREATE FUNCTION p0_trusted_writer_validate_source_object_insert()"),
);
check(
  "no Phase 2B-only validator enters the allowlist",
  [
    "p0_validate_report_comparison_insert",
    "p0_validate_report_difference_insert",
    "p0_validate_correspondence_version_seal",
    "p0_validate_packet_seal",
    "p0_validate_correspondence_item_recipient_bureau",
  ].every((name) => !expectedFunctions.some((entry) => entry.name === name)),
);

process.stdout.write(
  `${passed}/${passed} PASS p0-trusted-writer-validator-boundary ` +
    `(24 definers, 4 invoker helpers, ${readableTables.length} read tables, ` +
    `${lockTables.length} lock tables, ${authorityTables.length} authority tables, ` +
    `${migrationAuthorityTriggers.length} trigger edges)\n`,
);
