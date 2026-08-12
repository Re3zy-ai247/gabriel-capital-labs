import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign as signPayload,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, type Bureau } from "@prisma/client";
import {
  createP0PrismaServerPrincipalDependencies,
  issueP0WorkerOperationToken,
  revalidateP0PrismaPrincipal,
  type P0PrincipalPrismaClient,
  type P0PrincipalUserRow,
  type P0WorkerOperationPurpose,
  type P0WorkerTokenConfiguration,
} from "../lib/creditTruth/principalPrismaAdapter";
import {
  resolveP0InteractivePrincipal,
  resolveP0WorkerPrincipal,
} from "../lib/creditTruth/principalServer";
import {
  p0ScopeFromPrincipal,
  type P0Principal,
  type P0Scope,
} from "../lib/creditTruth/principal";
import {
  evaluateAndMintP0Phase2AGatePermit,
  p0Phase2ACohortScopeSha256,
  p0Phase2AFlagsFromEnv,
  resolveP0Phase2ACohortFromServerEnvironment,
  type P0Phase2AGatePermit,
} from "../lib/creditTruth/phase2Flags";
import {
  P0_PHASE2A_READINESS_CONTRACT_VERSION,
  P0_REPOSITORY_CAPABILITIES,
  type P0Phase2AStage,
  type P0Phase2AReadinessEvidence,
} from "../lib/creditTruth/phase2Readiness";
import {
  P0_TRUSTED_WRITER_CAPABILITIES,
  P0_TRUSTED_WRITER_IMPLEMENTATION_SOURCE_MANIFEST,
  P0_TRUSTED_WRITER_READINESS_CONTRACT_VERSION,
  P0_TRUSTED_WRITER_REQUIRED_ADAPTERS,
  P0_TRUSTED_WRITER_REQUIRED_SAFETY_FLAGS,
  isVerifiedP0TrustedWriterReadinessReceipt,
  loadP0TrustedWriterReadinessFromServerEnvironment,
  p0TrustedWriterAttestationSigningPayload,
  type P0TrustedWriterReadinessCandidate,
  type VerifiedP0TrustedWriterReadinessReceipt,
} from "../lib/creditTruth/trustedWriterReadiness";
import {
  assertP0TrustedWriterDatabaseRoleInTransaction,
  bindP0TrustedWriterPrismaClientToDatabaseRole,
  p0TrustedWriterDatabaseRoleIdentitySha256,
} from "../lib/creditTruth/trustedWriterPrismaClient";
import {
  P0_TRUSTED_WRITER_DISPOSABLE_MODE,
  P0_TRUSTED_WRITER_RUNTIME_MODE_ENV,
  createP0ProductionTrustedWriterUploadHook,
  createP0TrustedWriterPrismaUploadHook,
  createP0TrustedWriterPrismaSourcePersister,
  selectP0TrustedWriterUploadSource,
  withP0DisposableTrustedWriterUploadHook,
  type P0TrustedWriterSourcePersister,
} from "../lib/creditTruth/trustedWriterUploadHook";
import {
  createPrismaP0ReportIngestionRepository,
  type P0PrismaTransactionalPrincipalRevalidator,
} from "../lib/creditTruth/prismaReportIngestionRepository";
import { createP0ReportIngestionService, type P0ReportIngestion } from "../lib/creditTruth/reportIngestion";
import {
  createP0PrismaReportVersionRepository,
  deriveP0ReportSeriesKey,
  type P0PrismaReportVersionRepository,
} from "../lib/creditTruth/prismaReportVersionRepository";
import { createP0PrismaExtractionInputRepository } from "../lib/creditTruth/prismaExtractionInputRepository";
import { createP0PrismaSensitiveAccessRepository } from "../lib/creditTruth/prismaSensitiveAccessRepository";
import { createP0PrismaRound0Repositories } from "../lib/creditTruth/prismaRound0Repository";
import {
  createP0PrismaSourceArtifactAdapter,
  type P0PrismaSourceArtifactAdapterBundle,
} from "../lib/creditTruth/prismaSourceArtifactProvider";
import { createPrismaP0ShadowTruthGraphRepository } from "../lib/creditTruth/prismaShadowTruthGraphRepository";
import {
  P0_PRISMA_SOURCE_PROVIDER_KEY,
  P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
  computeP0SourceArtifactSha256,
  deriveP0SourceArtifactOperationIdentity,
  dispatchP0SourceArtifactRead,
  dispatchP0SourceArtifactWrite,
  verifyP0SourceArtifactCapability,
  type VerifiedP0SourceArtifactWriteReceipt,
} from "../lib/creditTruth/sourceArtifact";
import {
  authorizeAndAuditP0SensitiveAccess,
  verifyAndDeriveP0SensitiveAuditRefs,
  verifyP0SensitiveResourceRef,
  type P0SensitiveAccessRepository,
} from "../lib/creditTruth/sensitiveAccessAudit";
import { extractP0ReportSource } from "../lib/creditTruth/reportSourceExtraction";
import {
  P0_PARSER_SHADOW_ENVELOPE_VERSION,
  P0_ROUND0_COMPLETENESS_CATEGORIES,
  verifyP0ParserShadowEnvelope,
  type P0ParserShadowEnvelopeCandidate,
  type P0Round0CompletenessEvidence,
  type VerifiedP0ParserShadowEnvelope,
} from "../lib/creditTruth/parserShadowEnvelope";
import {
  P0_TRUSTED_PARSER_EXECUTION_CONTRACT_VERSION,
  computeP0TrustedParserExecutionSigningPayload,
  verifyP0TrustedParserExecutionFromServerEnvironment,
  type P0TrustedParserExecutionCandidate,
  type VerifiedP0TrustedParserExecution,
} from "../lib/creditTruth/trustedWriterParserExecution";
import {
  createP0ShadowExtractionService,
  type P0ShadowTruthGraphBatch,
  type P0ShadowTruthGraphRepository,
  type VerifiedP0ShadowWriterAuthority,
} from "../lib/creditTruth/shadowExtractionService";
import { createP0TrustedShadowValueProtector } from "../lib/creditTruth/trustedWriterShadowValueProtector";
import {
  createDeterministicDisposableP0ValueProtectionAdapter,
  type P0TrustedWriterProtectedValue,
} from "../lib/creditTruth/trustedWriterValueProtection";
import { computeP0RepositorySemanticSha256 } from "../lib/creditTruth/repositoryAttestation";
import type { P0Repository } from "../lib/creditTruth/repository";

const ROOT = resolve(import.meta.dirname, "..");
const WRITER_URL_ENV = "P0_TW_DISPOSABLE_WRITER_URL";
const ADMIN_URL_ENV = "P0_TW_DISPOSABLE_ADMIN_URL";
const WRITER_ROLE_ENV = "P0_TW_DISPOSABLE_WRITER_ROLE";
const VALIDATOR_OWNER_ENV = "P0_TW_DISPOSABLE_VALIDATOR_OWNER";
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ROLE = /^p0_writer_[a-z0-9_]{1,48}$/;
const SAFE_VALIDATOR_OWNER = /^p0_validator_owner$/;
const EXACT_VALIDATOR_SEARCH_PATH = Object.freeze([
  "search_path=pg_catalog, public, pg_temp",
]);

interface ExpectedPrivilegedRoutine {
  readonly name: string;
  readonly lookupSignature: string;
  readonly identityArgs: string;
  readonly securityDefiner: boolean;
  readonly volatility: "v" | "i";
  readonly directCallArguments: string;
}

const PRIVILEGED_VALIDATOR_ROUTINES: readonly ExpectedPrivilegedRoutine[] =
  Object.freeze(
    [
      "p0_validate_report_account_subject",
      "p0_reject_post_assessment_account_input",
      "p0_reject_post_assessment_coverage",
      "p0_validate_credit_score_insert",
      "p0_reject_post_comparison_identity_input",
      "p0_validate_artifact_seal",
      "p0_2a_validate_extraction_input",
      "p0_2a_validate_score_model_evidence",
      "p0_2a_validate_bureau_report_date",
      "p0_2a_validate_round0_source_completeness",
      "p0_2a_validate_identity_baseline_source_seal",
      "p0_2a_validate_round0_source_seal_deferred",
      "p0_2a_validate_report_ingestion_mutation",
      "p0_2a_validate_identity_fact_insert",
      "p0_2a_validate_identity_category_completion",
      "p0_2a_reject_account_presence_after_source_completeness",
      "p0_2a_reject_account_after_identity_completion",
      "p0_2a_validate_identity_correspondence_assertion",
      "p0_2a_validate_consumer_account_review",
      "p0_2a_validate_identity_baseline_account_review_membership",
      "p0_2a_validate_confirmed_baseline_child_deferred",
      "p0_2a_validate_case_action_decision",
      "p0_2a_validate_case_action_source_ref",
      "p0_2a_validate_case_action_source_membership",
    ].map((name) => ({
      name,
      lookupSignature: `public.${name}()`,
      identityArgs: "",
      securityDefiner: true,
      volatility: "v" as const,
      directCallArguments: "",
    })),
  );

const PRIVILEGED_VALIDATOR_HELPERS: readonly ExpectedPrivilegedRoutine[] =
  Object.freeze([
    {
      name: "p0_lock_extraction_run",
      lookupSignature: "public.p0_lock_extraction_run(text,text,text,text)",
      identityArgs: "text, text, text, text",
      securityDefiner: false,
      volatility: "v",
      directCallArguments:
        "NULL::text, NULL::text, NULL::text, NULL::text",
    },
    {
      name: "p0_lock_assessment_input",
      lookupSignature:
        "public.p0_lock_assessment_input(text,text,text,text,text)",
      identityArgs: "text, text, text, text, text",
      securityDefiner: false,
      volatility: "v",
      directCallArguments:
        "NULL::text, NULL::text, NULL::text, NULL::text, NULL::text",
    },
    {
      name: "p0_reject_if_run_is_compared",
      lookupSignature:
        "public.p0_reject_if_run_is_compared(text,text,text,text)",
      identityArgs: "text, text, text, text",
      securityDefiner: false,
      volatility: "v",
      directCallArguments:
        "NULL::text, NULL::text, NULL::text, NULL::text",
    },
    {
      name: "p0_2a_identity_fact_matches_category",
      lookupSignature:
        'public.p0_2a_identity_fact_matches_category(public."IdentityFactType",public."IdentityReviewCategory",public."IdentityReviewCategory")',
      identityArgs:
        '"IdentityFactType", "IdentityReviewCategory", "IdentityReviewCategory"',
      securityDefiner: false,
      volatility: "i",
      directCallArguments:
        'NULL::public."IdentityFactType", NULL::public."IdentityReviewCategory", NULL::public."IdentityReviewCategory"',
    },
  ]);

const EXACT_PRIVILEGED_ROUTINES = Object.freeze([
  ...PRIVILEGED_VALIDATOR_ROUTINES,
  ...PRIVILEGED_VALIDATOR_HELPERS,
]);

const VALIDATOR_OWNER_SELECT_TABLES = Object.freeze([
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

const VALIDATOR_OWNER_UPDATE_ID_TABLES = Object.freeze([
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

// The disposable verifier generates the exact-current Prisma client before
// executing this module. Repository-level typecheck may still resolve an older
// installed client, so name only the exact delegates used by this harness.
interface P0ExactCurrentDelegate {
  count(input?: unknown): Promise<any>;
  create(input: unknown): Promise<any>;
  createMany(input: unknown): Promise<any>;
  findFirst(input?: unknown): Promise<any>;
  findUnique(input: unknown): Promise<any>;
}

interface P0ExactCurrentDelegates {
  readonly artifact: P0ExactCurrentDelegate;
  readonly consumerAccountReviewReceipt: P0ExactCurrentDelegate;
  readonly creditTruthScope: P0ExactCurrentDelegate;
  readonly extractionRun: P0ExactCurrentDelegate;
  readonly fieldObservation: P0ExactCurrentDelegate;
  readonly p0SensitiveAccessEvent: P0ExactCurrentDelegate;
  readonly p0SourceObject: P0ExactCurrentDelegate;
  readonly reportIngestion: P0ExactCurrentDelegate;
  readonly reportVersion: P0ExactCurrentDelegate;
  readonly reportVersionAccount: P0ExactCurrentDelegate;
}

type P0GeneratedPrismaClient = PrismaClient & P0ExactCurrentDelegates;

let passed = 0;
let attacksPassed = 0;
let privilegedBoundaryAttacksPassed = 0;

async function test(name: string, run: () => void | Promise<void>): Promise<void> {
  await run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

interface AttackResult {
  readonly observed: string;
  readonly durableResult: string;
  readonly pass: boolean;
}

async function attack(input: {
  readonly number: number;
  readonly name: string;
  readonly setup: string;
  readonly attack: string;
  readonly expected: string;
  run(): Promise<AttackResult>;
}): Promise<void> {
  assert.equal(input.number, attacksPassed + 1, "attack matrix must be ordered and complete");
  const result = await input.run();
  assert.equal(result.pass, true, `attack ${input.number} failed: ${result.observed}`);
  attacksPassed += 1;
  passed += 1;
  process.stdout.write(
    `ok ${passed} - attack ${input.number}: ${input.name}` +
      ` | setup=${input.setup}` +
      ` | attack=${input.attack}` +
      ` | expected=${input.expected}` +
      ` | observed=${result.observed}` +
      ` | durable=${result.durableResult}` +
      " | PASS\n",
  );
}

async function privilegedBoundaryAttack(input: {
  readonly number: number;
  readonly name: string;
  readonly attack: string;
  readonly expected: string;
  run(): Promise<AttackResult>;
}): Promise<void> {
  assert.equal(
    input.number,
    privilegedBoundaryAttacksPassed + 1,
    "privileged-boundary attack matrix must be ordered and complete",
  );
  const result = await input.run();
  assert.equal(
    result.pass,
    true,
    `privileged-boundary attack ${input.number} failed: ${result.observed}`,
  );
  privilegedBoundaryAttacksPassed += 1;
  passed += 1;
  process.stdout.write(
    `ok ${passed} - privileged-boundary attack ${input.number}: ${input.name}` +
      ` | attack=${input.attack}` +
      ` | expected=${input.expected}` +
      ` | observed=${result.observed}` +
      ` | durable=${result.durableResult}` +
      " | PASS\n",
  );
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function diagnosticCanonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(diagnosticCanonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, diagnosticCanonical(item)]),
    );
  }
  return value;
}

function exactFileSha256(relativePath: string): string {
  return sha256(readFileSync(resolve(ROOT, relativePath)));
}

interface P0SqlClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
}

interface PrivilegedRoutineCatalogRow {
  readonly schema_name: string;
  readonly routine_name: string;
  readonly identity_args: string;
  readonly owner_name: string;
  readonly security_definer: boolean;
  readonly configuration: readonly string[] | null;
  readonly language_name: string;
  readonly volatility: string;
  readonly parallel_mode: string;
  readonly leakproof: boolean;
  readonly source_body: string;
  readonly definition: string;
}

interface PrivilegedRoutineAclRow {
  readonly routine_name: string;
  readonly identity_args: string;
  readonly grantee_name: string;
  readonly privilege_type: string;
  readonly is_grantable: boolean;
}

interface PrivilegedTriggerCatalogRow {
  readonly table_schema: string;
  readonly table_name: string;
  readonly trigger_name: string;
  readonly routine_name: string;
  readonly identity_args: string;
  readonly trigger_type: number;
  readonly is_deferrable: boolean;
  readonly initially_deferred: boolean;
  readonly enabled_mode: string;
  readonly is_constraint: boolean;
  readonly when_expression: string | null;
  readonly update_columns: string;
  readonly old_transition_table: string | null;
  readonly new_transition_table: string | null;
  readonly has_parent_trigger: boolean;
  readonly argument_hex: string;
  readonly definition: string;
}

interface PrivilegedValidatorCatalogAttestation {
  readonly manifestSha256: string;
  readonly definitionHashes: readonly {
    readonly signature: string;
    readonly bodySha256: string;
    readonly definitionSha256: string;
  }[];
  readonly triggerCount: number;
}

const VALIDATOR_SOURCE_MIGRATIONS = Object.freeze([
  "prisma/migrations/20260808_p0_credit_truth_foundation/migration.sql",
  "prisma/migrations/20260810_p0_phase2a_ingestion_round0/migration.sql",
  "prisma/migrations/20260811_p0_trusted_writer_gate/migration.sql",
]);

const TRUSTED_WRITER_TRIGGER_TABLES = Object.freeze([
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
  "DerivedAccountAssessment",
  "DisputeCase",
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
  "Report",
  "ReportIngestion",
  "ReportVersion",
  "ReportVersionAccount",
  "Round0SourceCompletenessEvidence",
  "SectionCompleteness",
  "User",
]);

function canonicalIdentityArgs(value: string): string {
  return value.replaceAll("public.", "").replace(/\s+/g, " ").trim();
}

function expectedValidatorBody(name: string): string {
  for (const relativePath of VALIDATOR_SOURCE_MIGRATIONS) {
    const source = readFileSync(resolve(ROOT, relativePath), "utf8");
    const marker = `CREATE FUNCTION ${name}(`;
    const start = source.indexOf(marker);
    if (start < 0) continue;
    const bodyStartMarker = "AS $$";
    const bodyStart = source.indexOf(bodyStartMarker, start);
    const nextFunction = source.indexOf("CREATE FUNCTION ", start + marker.length);
    assert(
      bodyStart >= 0 && (nextFunction < 0 || bodyStart < nextFunction),
      `source body missing for ${name}`,
    );
    const bodyEnd = source.indexOf("$$;", bodyStart + bodyStartMarker.length);
    assert(bodyEnd >= 0, `source body terminator missing for ${name}`);
    return source.slice(bodyStart + bodyStartMarker.length, bodyEnd);
  }
  assert.fail(`migration source definition missing for ${name}`);
}

function expectedTrustedWriterTriggerCatalog(): Readonly<{
  triggerMap: readonly string[];
  functionNames: readonly string[];
}> {
  const tableNames = new Set(TRUSTED_WRITER_TRIGGER_TABLES);
  const results: string[] = [];
  const functionNames = new Set<string>();
  const triggerPattern =
    /CREATE\s+(CONSTRAINT\s+)?TRIGGER\s+"([^"]+)"\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+([\s\S]*?)\s+ON\s+"([^"]+)"([\s\S]*?)EXECUTE\s+FUNCTION\s+(?:public\.)?([a-z0-9_]+)\(([^;]*)\);/gi;
  for (const relativePath of VALIDATOR_SOURCE_MIGRATIONS) {
    const source = readFileSync(resolve(ROOT, relativePath), "utf8");
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
      if (!tableNames.has(tableName!)) continue;
      functionNames.add(functionName!);
      assert.doesNotMatch(fullDefinition!, /\bUPDATE\s+OF\b/i);
      assert.doesNotMatch(triggerOptions!, /\bWHEN\s*\(/i);
      assert.doesNotMatch(triggerOptions!, /\bREFERENCING\b/i);
      const rowTrigger = /\bFOR\s+EACH\s+ROW\b/i.test(triggerOptions!);
      const statementTrigger = /\bFOR\s+EACH\s+STATEMENT\b/i.test(
        triggerOptions!,
      );
      assert.notEqual(
        rowTrigger,
        statementTrigger,
        `exact trigger level for ${triggerName}`,
      );
      const timing = rawTiming!.replace(/\s+/g, " ").toUpperCase();
      const events = rawEvents!
        .split(/\s+OR\s+/i)
        .map((event) => event.trim().toUpperCase());
      assert(events.length > 0);
      assert(events.every((event) => ["INSERT", "UPDATE", "DELETE", "TRUNCATE"].includes(event)));
      const triggerType =
        (rowTrigger ? 1 : 0) |
        (timing === "BEFORE" ? 2 : timing === "INSTEAD OF" ? 64 : 0) |
        (events.includes("INSERT") ? 4 : 0) |
        (events.includes("DELETE") ? 8 : 0) |
        (events.includes("UPDATE") ? 16 : 0) |
        (events.includes("TRUNCATE") ? 32 : 0);
      const args = Array.from(
        rawArguments!.matchAll(/'((?:''|[^'])*)'/g),
        (argument) => argument[1]!.replaceAll("''", "'"),
      );
      results.push(
        JSON.stringify([
          "public",
          tableName,
          triggerName,
          functionName,
          "",
          args,
          triggerType,
          Boolean(constraintKeyword),
          /\bDEFERRABLE\b/i.test(triggerOptions!),
          /\bINITIALLY\s+DEFERRED\b/i.test(triggerOptions!),
          "O",
          null,
          "",
          null,
          null,
          false,
        ]),
      );
    }
  }
  results.sort();
  assert.equal(results.length, 87, "exact trusted-writer trigger source map drift");
  assert.equal(new Set(results).size, results.length, "duplicate trigger source map");
  assert.equal(functionNames.size, 37, "exact trigger-function source set drift");
  return Object.freeze({
    triggerMap: Object.freeze(results),
    functionNames: Object.freeze([...functionNames].sort()),
  });
}

function decodeTriggerArguments(argumentHex: string): readonly string[] {
  if (!argumentHex) return Object.freeze([]);
  const bytes = Buffer.from(argumentHex, "hex");
  return Object.freeze(
    bytes
      .toString("utf8")
      .split("\0")
      .filter((value) => value.length > 0),
  );
}

function expectedRoutineForRow(
  row: Pick<PrivilegedRoutineCatalogRow, "routine_name" | "identity_args">,
): ExpectedPrivilegedRoutine | undefined {
  // Every exact routine is selected by its frozen to_regprocedure signature.
  // pg_get_function_identity_arguments includes source argument names for the
  // enum helper on PostgreSQL 16, so routine_name is the stable join key here;
  // the boundary audit separately rejects every overload of these unique names.
  return EXACT_PRIVILEGED_ROUTINES.find(
    (expected) => expected.name === row.routine_name,
  );
}

function isForbiddenValidatorStatement(sourceBody: string): boolean {
  return /(?:^|[;\n])\s*(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|COPY)\b/i.test(
    sourceBody,
  );
}

async function attestPrivilegedValidatorCatalog(
  client: P0SqlClient,
  writerRole: string,
  ownerRole: string,
  expectedManifestSha256?: string,
): Promise<PrivilegedValidatorCatalogAttestation> {
  const lookupPlaceholders = EXACT_PRIVILEGED_ROUTINES.map(
    (_, index) => `to_regprocedure($${index + 1})`,
  ).join(", ");
  const lookupValues = EXACT_PRIVILEGED_ROUTINES.map(
    (routine) => routine.lookupSignature,
  );
  const routines = await client.$queryRawUnsafe<PrivilegedRoutineCatalogRow[]>(
    `SELECT
      n.nspname AS schema_name,
      p.proname AS routine_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      owner.rolname AS owner_name,
      p.prosecdef AS security_definer,
      p.proconfig AS configuration,
      language.lanname AS language_name,
      p.provolatile::text AS volatility,
      p.proparallel::text AS parallel_mode,
      p.proleakproof AS leakproof,
      p.prosrc AS source_body,
      pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles owner ON owner.oid = p.proowner
    JOIN pg_language language ON language.oid = p.prolang
    WHERE p.oid IN (${lookupPlaceholders})
    ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`,
    ...lookupValues,
  );
  assert.equal(routines.length, 28, "exact privileged routine inventory drift");

  for (const row of routines) {
    const expected = expectedRoutineForRow(row);
    assert(expected, `unexpected privileged routine ${row.routine_name}`);
    assert.equal(row.schema_name, "public");
    assert.equal(row.owner_name, ownerRole);
    assert.equal(row.security_definer, expected.securityDefiner);
    assert.deepEqual(row.configuration, EXACT_VALIDATOR_SEARCH_PATH);
    assert.equal(row.language_name, "plpgsql");
    assert.equal(row.volatility, expected.volatility);
    assert.equal(row.leakproof, false);
    assert.equal(row.parallel_mode, "u");
    assert.equal(
      sha256(row.source_body),
      sha256(expectedValidatorBody(expected.name)),
      `migration-bound source body drift for ${expected.lookupSignature}`,
    );
    assert.equal(
      /\bEXECUTE\s+(?!FUNCTION\b)/i.test(row.source_body),
      false,
      `dynamic SQL in privileged routine ${expected.lookupSignature}`,
    );
    assert.equal(
      isForbiddenValidatorStatement(row.source_body),
      false,
      `DML/DDL in privileged routine ${expected.lookupSignature}`,
    );
  }

  const unexpectedDefiners = await client.$queryRawUnsafe<
    Array<{ routine_name: string; identity_args: string }>
  >(
    `SELECT p.proname AS routine_name,
            pg_get_function_identity_arguments(p.oid) AS identity_args
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname LIKE 'p0_%'
        AND p.prosecdef
      ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)`,
  );
  assert.deepEqual(
    unexpectedDefiners.map((row) =>
      `${row.routine_name}(${canonicalIdentityArgs(row.identity_args)})`,
    ),
    [...PRIVILEGED_VALIDATOR_ROUTINES]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((routine) => `${routine.name}()`),
    "unexpected SECURITY DEFINER P0 routine",
  );

  const aclRows = await client.$queryRawUnsafe<PrivilegedRoutineAclRow[]>(
    `SELECT
      p.proname AS routine_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      COALESCE(grantee.rolname, 'PUBLIC') AS grantee_name,
      access.privilege_type::text AS privilege_type,
      access.is_grantable AS is_grantable
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) access
    LEFT JOIN pg_roles grantee ON grantee.oid = access.grantee
    WHERE p.oid IN (${lookupPlaceholders})
    ORDER BY p.proname, pg_get_function_identity_arguments(p.oid),
             grantee_name, privilege_type`,
    ...lookupValues,
  );
  assert.equal(aclRows.length, 28, "exact validator ACL inventory drift");
  for (const acl of aclRows) {
    assert(expectedRoutineForRow(acl), `unexpected routine ACL ${acl.routine_name}`);
    assert.deepEqual(
      {
        grantee: acl.grantee_name,
        privilege: acl.privilege_type,
        grantable: acl.is_grantable,
      },
      { grantee: ownerRole, privilege: "EXECUTE", grantable: false },
      `validator EXECUTE drift for ${acl.routine_name}`,
    );
  }

  const roleRows = await client.$queryRawUnsafe<
    Array<{
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolinherit: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
    }>
  >(
    `SELECT rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolinherit,
            rolreplication, rolbypassrls
       FROM pg_roles
      WHERE rolname = $1`,
    ownerRole,
  );
  assert.deepEqual(roleRows, [
    {
      rolcanlogin: false,
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolinherit: false,
      rolreplication: false,
      rolbypassrls: false,
    },
  ]);
  const memberships = await client.$queryRawUnsafe<Array<{ edge: string }>>(
    `SELECT pg_get_userbyid(roleid) || '->' || pg_get_userbyid(member) AS edge
       FROM pg_auth_members
      WHERE roleid = (SELECT oid FROM pg_roles WHERE rolname = $1)
         OR member = (SELECT oid FROM pg_roles WHERE rolname = $1)`,
    ownerRole,
  );
  assert.deepEqual(memberships, [], "validator owner must have no memberships");

  const ownership = await client.$queryRawUnsafe<
    Array<{ object_kind: string; object_name: string }>
  >(
    `SELECT 'RELATION' AS object_kind, n.nspname || '.' || c.relname AS object_name
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relowner = (SELECT oid FROM pg_roles WHERE rolname = $1)
    UNION ALL
     SELECT 'SCHEMA', n.nspname FROM pg_namespace n
      WHERE n.nspowner = (SELECT oid FROM pg_roles WHERE rolname = $1)
    UNION ALL
     SELECT 'TYPE', n.nspname || '.' || t.typname
       FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typowner = (SELECT oid FROM pg_roles WHERE rolname = $1)
        AND NOT EXISTS (
          SELECT 1 FROM pg_class c
           WHERE c.reltype = t.oid
             AND c.relowner = t.typowner
        )
    ORDER BY object_kind, object_name`,
    ownerRole,
  );
  assert.deepEqual(ownership, [], "validator owner owns a non-routine object");

  const tablePrivileges = await client.$queryRawUnsafe<
    Array<{ table_name: string; privilege_type: string }>
  >(
    `SELECT table_name, privilege_type
       FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = $1
      ORDER BY table_name, privilege_type`,
    ownerRole,
  );
  assert.deepEqual(
    tablePrivileges.map((row) => `${row.privilege_type}:${row.table_name}`),
    VALIDATOR_OWNER_SELECT_TABLES.map((table) => `SELECT:${table}`).sort(),
    "validator owner table privilege matrix drift",
  );
  const updatePrivileges = await client.$queryRawUnsafe<
    Array<{ table_name: string; column_name: string; privilege_type: string }>
  >(
    `SELECT table_name, column_name, privilege_type
       FROM information_schema.role_column_grants
      WHERE table_schema = 'public'
        AND grantee = $1
        AND privilege_type = 'UPDATE'
      ORDER BY table_name, column_name`,
    ownerRole,
  );
  assert.deepEqual(
    updatePrivileges.map(
      (row) => `${row.privilege_type}:${row.table_name}.${row.column_name}`,
    ),
    VALIDATOR_OWNER_UPDATE_ID_TABLES.map((table) => `UPDATE:${table}.id`).sort(),
    "validator owner column privilege matrix drift",
  );

  const roleCapabilities = await client.$queryRawUnsafe<
    Array<{
      schema_usage: boolean;
      schema_create: boolean;
      database_create: boolean;
      database_temp: boolean;
      writer_is_owner_member: boolean;
    }>
  >(
    `SELECT
      has_schema_privilege($1, 'public', 'USAGE') AS schema_usage,
      has_schema_privilege($1, 'public', 'CREATE') AS schema_create,
      has_database_privilege($1, current_database(), 'CREATE') AS database_create,
      has_database_privilege($1, current_database(), 'TEMP') AS database_temp,
      pg_has_role($2, $1, 'MEMBER') AS writer_is_owner_member`,
    ownerRole,
    writerRole,
  );
  assert.deepEqual(roleCapabilities, [
    {
      schema_usage: true,
      schema_create: false,
      database_create: false,
      database_temp: false,
      writer_is_owner_member: false,
    },
  ]);
  const writerBroadUpdates = await client.$queryRawUnsafe<
    Array<{ table_name: string }>
  >(
    `SELECT relation.relname AS table_name
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
        AND has_table_privilege($1, relation.oid, 'UPDATE')
      ORDER BY relation.relname`,
    writerRole,
  );
  assert.deepEqual(
    writerBroadUpdates,
    [],
    "application writer acquired table-level UPDATE",
  );
  const writerDirectRoutineExecution = await client.$queryRawUnsafe<
    Array<{ routine_name: string; identity_args: string }>
  >(
    `SELECT routine.proname AS routine_name,
            pg_get_function_identity_arguments(routine.oid) AS identity_args
       FROM pg_proc routine
       JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
      WHERE namespace.nspname = 'public'
        AND routine.proname LIKE 'p0_%'
        AND has_function_privilege($1, routine.oid, 'EXECUTE')
      ORDER BY routine.proname, pg_get_function_identity_arguments(routine.oid)`,
    writerRole,
  );
  assert.deepEqual(
    writerDirectRoutineExecution,
    [],
    "application writer acquired direct P0 routine EXECUTE",
  );

  const expectedTriggerCatalog = expectedTrustedWriterTriggerCatalog();
  const authorityTablePlaceholders = TRUSTED_WRITER_TRIGGER_TABLES.map(
    (_, index) => `$${index + 1}`,
  ).join(", ");
  const triggers = await client.$queryRawUnsafe<PrivilegedTriggerCatalogRow[]>(
    `SELECT
      table_ns.nspname AS table_schema,
      relation.relname AS table_name,
      trigger.tgname AS trigger_name,
      routine.proname AS routine_name,
      pg_get_function_identity_arguments(routine.oid) AS identity_args,
      trigger.tgtype::integer AS trigger_type,
      trigger.tgdeferrable AS is_deferrable,
      trigger.tginitdeferred AS initially_deferred,
      trigger.tgenabled::text AS enabled_mode,
      (trigger.tgconstraint <> 0) AS is_constraint,
      pg_get_expr(trigger.tgqual, trigger.tgrelid) AS when_expression,
      trigger.tgattr::text AS update_columns,
      trigger.tgoldtable AS old_transition_table,
      trigger.tgnewtable AS new_transition_table,
      (trigger.tgparentid <> 0) AS has_parent_trigger,
      encode(trigger.tgargs, 'hex') AS argument_hex,
      pg_get_triggerdef(trigger.oid, true) AS definition
    FROM pg_trigger trigger
    JOIN pg_class relation ON relation.oid = trigger.tgrelid
    JOIN pg_namespace table_ns ON table_ns.oid = relation.relnamespace
    JOIN pg_proc routine ON routine.oid = trigger.tgfoid
    WHERE NOT trigger.tgisinternal
      AND table_ns.nspname = 'public'
      AND relation.relname IN (${authorityTablePlaceholders})
    ORDER BY table_ns.nspname, relation.relname, trigger.tgname`,
    ...TRUSTED_WRITER_TRIGGER_TABLES,
  );
  assert.equal(triggers.length, 87, "exact trusted-writer trigger catalog drift");
  const actualTriggerMap = triggers
    .map((trigger) =>
      JSON.stringify([
        trigger.table_schema,
        trigger.table_name,
        trigger.trigger_name,
        trigger.routine_name,
        canonicalIdentityArgs(trigger.identity_args),
        decodeTriggerArguments(trigger.argument_hex),
        trigger.trigger_type,
        trigger.is_constraint,
        trigger.is_deferrable,
        trigger.initially_deferred,
        trigger.enabled_mode,
        trigger.when_expression,
        trigger.update_columns,
        trigger.old_transition_table,
        trigger.new_transition_table,
        trigger.has_parent_trigger,
      ]),
    )
    .sort();
  assert.deepEqual(
    actualTriggerMap,
    expectedTriggerCatalog.triggerMap,
    "trusted-writer trigger/function linkage drift",
  );

  const authorityRoutineLookups = expectedTriggerCatalog.functionNames.map(
    (name) => `public.${name}()`,
  );
  const authorityRoutinePlaceholders = authorityRoutineLookups.map(
    (_, index) => `to_regprocedure($${index + 1})`,
  ).join(", ");
  const authorityTriggerRoutines =
    await client.$queryRawUnsafe<PrivilegedRoutineCatalogRow[]>(
      `SELECT
        n.nspname AS schema_name,
        p.proname AS routine_name,
        pg_get_function_identity_arguments(p.oid) AS identity_args,
        owner.rolname AS owner_name,
        p.prosecdef AS security_definer,
        p.proconfig AS configuration,
        language.lanname AS language_name,
        p.provolatile::text AS volatility,
        p.proparallel::text AS parallel_mode,
        p.proleakproof AS leakproof,
        p.prosrc AS source_body,
        pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_roles owner ON owner.oid = p.proowner
      JOIN pg_language language ON language.oid = p.prolang
      WHERE p.oid IN (${authorityRoutinePlaceholders})
      ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`,
      ...authorityRoutineLookups,
    );
  assert.equal(
    authorityTriggerRoutines.length,
    37,
    "exact trusted-writer trigger-function catalog drift",
  );
  for (const row of authorityTriggerRoutines) {
    const controlled = PRIVILEGED_VALIDATOR_ROUTINES.some(
      (routine) => routine.name === row.routine_name,
    );
    assert.equal(row.schema_name, "public");
    assert.equal(row.identity_args, "");
    assert.equal(row.security_definer, controlled);
    assert.deepEqual(
      row.configuration,
      controlled ? EXACT_VALIDATOR_SEARCH_PATH : null,
    );
    assert.equal(row.language_name, "plpgsql");
    assert.equal(row.volatility, "v");
    assert.equal(row.leakproof, false);
    assert.equal(row.parallel_mode, "u");
    assert.equal(
      sha256(row.source_body),
      sha256(expectedValidatorBody(row.routine_name)),
      `migration-bound trigger-function body drift for ${row.routine_name}()`,
    );
    assert.equal(
      /\bEXECUTE\s+(?!FUNCTION\b)/i.test(row.source_body),
      false,
      `dynamic SQL in trusted-writer trigger function ${row.routine_name}()`,
    );
  }

  const definitions = routines
    .map((row) => ({
      signature: `public.${row.routine_name}(${canonicalIdentityArgs(row.identity_args)})`,
      bodySha256: sha256(row.source_body),
      definitionSha256: sha256(row.definition),
    }))
    .sort((left, right) => left.signature.localeCompare(right.signature));
  const canonicalPayload = JSON.stringify(
    diagnosticCanonical({
      contractVersion: "p0-trusted-writer-privileged-validator-manifest-v2",
      owner: { name: ownerRole, ...roleRows[0], memberships },
      routines: routines.map((row) => ({
        schema: row.schema_name,
        name: row.routine_name,
        identityArgs: canonicalIdentityArgs(row.identity_args),
        owner: row.owner_name,
        securityDefiner: row.security_definer,
        configuration: row.configuration,
        language: row.language_name,
        volatility: row.volatility,
        parallel: row.parallel_mode,
        leakproof: row.leakproof,
        bodySha256: sha256(row.source_body),
        definitionSha256: sha256(row.definition),
        acl: aclRows
          .filter(
            (acl) =>
              acl.routine_name === row.routine_name &&
              canonicalIdentityArgs(acl.identity_args) ===
                canonicalIdentityArgs(row.identity_args),
          )
          .map((acl) => ({
            grantee: acl.grantee_name,
            privilege: acl.privilege_type,
            grantable: acl.is_grantable,
          })),
      })),
      authorityTriggerFunctions: authorityTriggerRoutines.map((row) => ({
        schema: row.schema_name,
        name: row.routine_name,
        identityArgs: canonicalIdentityArgs(row.identity_args),
        owner: row.owner_name,
        securityDefiner: row.security_definer,
        configuration: row.configuration,
        language: row.language_name,
        volatility: row.volatility,
        parallel: row.parallel_mode,
        leakproof: row.leakproof,
        bodySha256: sha256(row.source_body),
        definitionSha256: sha256(row.definition),
      })),
      triggers: triggers.map((trigger) => ({
        schema: trigger.table_schema,
        table: trigger.table_name,
        name: trigger.trigger_name,
        function: `${trigger.routine_name}(${canonicalIdentityArgs(trigger.identity_args)})`,
        type: trigger.trigger_type,
        constraint: trigger.is_constraint,
        deferrable: trigger.is_deferrable,
        initiallyDeferred: trigger.initially_deferred,
        enabled: trigger.enabled_mode,
        when: trigger.when_expression,
        updateColumns: trigger.update_columns,
        oldTransitionTable: trigger.old_transition_table,
        newTransitionTable: trigger.new_transition_table,
        hasParentTrigger: trigger.has_parent_trigger,
        arguments: decodeTriggerArguments(trigger.argument_hex),
        definition: trigger.definition,
      })),
      privileges: {
        table: tablePrivileges,
        columnUpdate: updatePrivileges,
        roleCapabilities: roleCapabilities[0],
        writerBroadUpdates,
        writerDirectRoutineExecution,
      },
    }),
  );
  const manifestSha256 = sha256(canonicalPayload);
  assert(SHA256.test(manifestSha256));
  if (expectedManifestSha256 !== undefined) {
    assert.equal(
      manifestSha256,
      expectedManifestSha256,
      "privileged validator catalog manifest drift",
    );
  }
  return Object.freeze({
    manifestSha256,
    definitionHashes: Object.freeze(definitions),
    triggerCount: triggers.length,
  });
}

function requireDisposableUrl(name: string): string {
  const value = process.env[name];
  assert(value, `${name} is required`);
  const parsed = new URL(value);
  assert.equal(parsed.protocol, "postgresql:");
  assert.equal(parsed.hostname, "127.0.0.1");
  assert(/^[0-9]{1,5}$/.test(parsed.port));
  assert(parsed.pathname.length > 1);
  assert.equal(parsed.searchParams.get("schema"), "public");
  assert(!/prod|production|supabase|neon|render|railway/i.test(value));
  return value;
}

function userSelect() {
  return {
    id: true,
    disabled: true,
    role: true,
    isAgency: true,
    managedByAgencyId: true,
    p0AuthorizationRevision: true,
  } as const;
}

function canonicalReadinessCandidate(
  now: number,
  privilegedValidatorManifestSha256: string,
  writerRole: string,
): P0TrustedWriterReadinessCandidate {
  const sourceManifest = P0_TRUSTED_WRITER_IMPLEMENTATION_SOURCE_MANIFEST;
  const implementationSourceSha256 = sha256(
    sourceManifest.map((path) => `${path}:${exactFileSha256(path)}`).join("\n"),
  );
  return Object.freeze({
    contractVersion: P0_TRUSTED_WRITER_READINESS_CONTRACT_VERSION,
    receiptKind: "AUTHENTICATED_PRODUCTION",
    receiptId: `p0tw-disposable-${implementationSourceSha256.slice(0, 32)}`,
    configurationMode: "DORMANT_DEFAULT_OFF",
    codeRevision: "p0-tw-disposable-exact-source",
    implementationSourceSha256,
    schemaSha256: exactFileSha256("prisma/schema.prisma"),
    migrationSha256: exactFileSha256(
      "prisma/migrations/20260811_p0_trusted_writer_gate/migration.sql",
    ),
    adapterManifestSha256: sha256(sourceManifest.join("\n")),
    storageContractSha256: exactFileSha256(
      "lib/creditTruth/prismaSourceArtifactProvider.ts",
    ),
    valueProtectionContractSha256: exactFileSha256(
      "lib/creditTruth/trustedWriterValueProtection.ts",
    ),
    dbRoleContractSha256: exactFileSha256(
      "scripts/sql/p0-trusted-writer-db-role-contract.sql",
    ),
    databaseRoleIdentitySha256:
      p0TrustedWriterDatabaseRoleIdentitySha256(writerRole),
    privilegedValidatorManifestSha256,
    dbRoleContractStatus: "LOCAL_CONTRACT_PROVEN",
    trustedWriterVerifierId: "p0-trusted-writer-real-adapter",
    trustedWriterVerifierVersion: "v2",
    requiredAdapters: P0_TRUSTED_WRITER_REQUIRED_ADAPTERS,
    safetyFlags: P0_TRUSTED_WRITER_REQUIRED_SAFETY_FLAGS,
    capabilities: P0_TRUSTED_WRITER_CAPABILITIES,
    attestationResult: "PASS",
    issuedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 20 * 60_000).toISOString(),
  });
}

function installSignedReadinessEnvironment(
  privilegedValidatorManifestSha256: string,
  writerRole: string,
): VerifiedP0TrustedWriterReadinessReceipt {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const candidate = canonicalReadinessCandidate(
    Date.now(),
    privilegedValidatorManifestSha256,
    writerRole,
  );
  const keyId = "p0-tw-disposable-ed25519-v1";
  const signatureBase64Url = signPayload(
    null,
    p0TrustedWriterAttestationSigningPayload(candidate),
    privateKey,
  ).toString("base64url");
  const envelope = { keyId, candidate, signatureBase64Url };
  process.env.P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL = Buffer.from(
    JSON.stringify(envelope),
    "utf8",
  ).toString("base64url");
  process.env.P0_TRUSTED_WRITER_ATTESTATION_PUBLIC_KEY_DER_BASE64URL = publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64url");
  process.env.P0_TRUSTED_WRITER_ATTESTATION_KEY_ID = keyId;
  process.env.P0_TRUSTED_WRITER_CODE_REVISION = candidate.codeRevision;
  process.env.P0_TRUSTED_WRITER_IMPLEMENTATION_SHA256 =
    candidate.implementationSourceSha256;
  process.env.P0_TRUSTED_WRITER_SCHEMA_SHA256 = candidate.schemaSha256;
  process.env.P0_TRUSTED_WRITER_MIGRATION_SHA256 = candidate.migrationSha256;
  process.env.P0_TRUSTED_WRITER_ADAPTER_MANIFEST_SHA256 =
    candidate.adapterManifestSha256;
  process.env.P0_TRUSTED_WRITER_STORAGE_CONTRACT_SHA256 =
    candidate.storageContractSha256;
  process.env.P0_TRUSTED_WRITER_VALUE_PROTECTION_CONTRACT_SHA256 =
    candidate.valueProtectionContractSha256;
  process.env.P0_TRUSTED_WRITER_DB_ROLE_CONTRACT_SHA256 =
    candidate.dbRoleContractSha256;
  process.env.P0_TRUSTED_WRITER_DATABASE_ROLE_IDENTITY_SHA256 =
    candidate.databaseRoleIdentitySha256;
  process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256 =
    candidate.privilegedValidatorManifestSha256;
  const receipt = loadP0TrustedWriterReadinessFromServerEnvironment();
  assert(receipt && isVerifiedP0TrustedWriterReadinessReceipt(receipt));
  return receipt;
}

function readinessEvidence(
  receipt: VerifiedP0TrustedWriterReadinessReceipt,
): P0Phase2AReadinessEvidence {
  return Object.freeze({
    migrationVerified: true,
    migrationSha256: receipt.migrationSha256,
    principalBoundaryVerified: true,
    repositoryBoundaryVerified: true,
    sourceArtifactBoundaryVerified: true,
    ingestionBoundaryVerified: true,
    round0BoundaryVerified: true,
    assertionBoundaryVerified: true,
    repositoryReceipt: null,
    productionRepositoryReceipt: receipt,
    deployedDbRoleAttested: false,
    hardProcessIsolatedPdfTerminationVerified: false,
    retentionLegalHoldApproved: false,
  });
}

function parserEnvelope(
  receipt: VerifiedP0SourceArtifactWriteReceipt,
  presence: "PRESENT" | "UNKNOWN" | "ABSENT_CONFIRMED" = "PRESENT",
): P0ParserShadowEnvelopeCandidate {
  const locator = {
    section: "ACCOUNT_DETAIL" as const,
    page: 1,
    lineStart: 2,
    lineEnd: 3,
    charStart: 0,
    charEnd: 18,
  };
  const round0: readonly P0Round0CompletenessEvidence[] =
    P0_ROUND0_COMPLETENESS_CATEGORIES.map((category) => ({
      category,
      status: "COMPLETE" as const,
      sourceLocator: {
        ...locator,
        section:
          category === "UNRECOGNIZED_ACCOUNT"
            ? ("ACCOUNT_INDEX" as const)
            : ("REPORT_HEADER" as const),
      },
      ruleKey: "regex-v2-round0-completeness",
      ruleVersion: "regex-v2.1",
    }));
  const accountPresence =
    presence === "PRESENT"
      ? ({
          presence: "PRESENT" as const,
          value: true,
          locator: { ...locator, section: "ACCOUNT_INDEX" as const },
        } as const)
      : presence === "ABSENT_CONFIRMED"
        ? ({
            presence: "ABSENT_CONFIRMED" as const,
            value: false,
            locator: { ...locator, section: "ACCOUNT_INDEX" as const },
          } as const)
        : ({ presence: "UNKNOWN" as const, reason: "PARSER_SILENCE" } as const);
  return {
    contractVersion: P0_PARSER_SHADOW_ENVELOPE_VERSION,
    parser: "REGEX_V2",
    parserVersion: "regex-v2.1",
    source: {
      ingestionId: receipt.object.scope.ingestionId,
      artifactId: receipt.object.scope.artifactId,
      artifactVersion: receipt.object.scope.artifactVersion,
      artifactKind: "NORMALIZED_TEXT",
      mimeType: "text/plain",
      sha256: receipt.object.sha256,
      byteLength: receipt.object.byteLength,
      normalizationVersion: "newline-preserving-v1",
    },
    coveredBureaus: ["EQUIFAX"],
    accounts: [
      {
        bureau: "EQUIFAX",
        account: {
          sourceAccountKey: "synthetic-source-account-1",
          creditorName: {
            presence: "PRESENT",
            value: "Synthetic Bank",
            locator,
          },
          bureaus: {
            EQUIFAX: {
              accountPresence,
              sectionCompleteness: {
                ACCOUNT_INDEX: {
                  state: "COMPLETE",
                  locator: { ...locator, section: "ACCOUNT_INDEX" },
                },
                ACCOUNT_SUMMARY: {
                  state: "COMPLETE",
                  locator: { ...locator, section: "ACCOUNT_SUMMARY" },
                },
                ACCOUNT_DETAIL: { state: "PARTIAL", locator },
                PAYMENT_HISTORY: {
                  state: "COMPLETE",
                  locator: { ...locator, section: "PAYMENT_HISTORY" },
                },
                COLLECTIONS: {
                  state: "UNKNOWN",
                  locator: { ...locator, section: "COLLECTIONS" },
                },
                REMARKS: {
                  state: "UNKNOWN",
                  locator: { ...locator, section: "REMARKS" },
                },
              },
              fields: {
                summaryStatus: {
                  presence: "PRESENT",
                  value: "Paid as agreed",
                  locator: { ...locator, section: "ACCOUNT_SUMMARY" },
                },
                balanceCents: {
                  presence: "PRESENT",
                  value: 0,
                  locator: { ...locator, section: "ACCOUNT_SUMMARY" },
                },
                reportedDate: {
                  presence: "PRESENT",
                  value: "2026-08-01",
                  locator: { ...locator, section: "ACCOUNT_SUMMARY" },
                },
                dofd: {
                  presence: "PRESENT",
                  value: "2024-02-15",
                  locator,
                },
                paymentHistory: {
                  presence: "PRESENT",
                  value: [{ period: "2025-01", rating: "90", daysLate: 90 }],
                  locator: { ...locator, section: "PAYMENT_HISTORY" },
                },
                chargeOffMarker: {
                  presence: "PRESENT",
                  value: true,
                  locator,
                },
              },
              errors: [],
            },
          },
        },
      },
    ],
    bureauEvidence: [
      {
        bureau: "EQUIFAX",
        reportDate: {
          presence: "PRESENT",
          precision: "DAY",
          value: "2026-08-01",
          sourceLocator: locator,
        },
        scores: [
          {
            presence: "PRESENT",
            occurrence: 0,
            score: 704,
            scaleMin: 300,
            scaleMax: 850,
            model: {
              presence: "NOT_PROVIDED",
              sourceLocator: { ...locator, section: "SCORE_MODEL" },
            },
            sourceLocator: locator,
            confidence: 0.94,
          },
        ],
        identity: [
          {
            presence: "PRESENT",
            factKey: "former-address-1",
            factType: "FORMER_ADDRESS",
            value: "12 Synthetic Road",
            sourceLocator: locator,
            confidence: 0.93,
          },
        ],
        round0Completeness: round0,
        errors: [],
      },
    ],
    status: "SUCCEEDED",
    safeErrorCodes: [],
  };
}

interface ConcreteRuntime {
  readonly admin: P0GeneratedPrismaClient;
  readonly writer: P0GeneratedPrismaClient;
  readonly workerConfiguration: P0WorkerTokenConfiguration;
  readonly principalDependencies: ReturnType<
    typeof createP0PrismaServerPrincipalDependencies
  >;
  readonly principalRevalidator: P0PrismaTransactionalPrincipalRevalidator;
  readonly ingestionService: ReturnType<typeof createP0ReportIngestionService>;
  readonly ingestionRepository: ReturnType<
    typeof createPrismaP0ReportIngestionRepository
  >;
  readonly sourceAdapter: P0PrismaSourceArtifactAdapterBundle;
  readonly sensitiveAccessRepository: P0SensitiveAccessRepository;
  readonly sourcePersister: P0TrustedWriterSourcePersister;
  readonly reportVersionRepository: P0PrismaReportVersionRepository;
  readonly extractionInputRepository: ReturnType<
    typeof createP0PrismaExtractionInputRepository
  >;
  readonly graphRepository: P0ShadowTruthGraphRepository;
  readonly round0Repositories: ReturnType<typeof createP0PrismaRound0Repositories>;
  readonly valueProtection: ReturnType<
    typeof createDeterministicDisposableP0ValueProtectionAdapter
  >;
  readonly readiness: P0Phase2AReadinessEvidence;
  readonly parserPrivateKey: ReturnType<typeof generateKeyPairSync>["privateKey"];
  readonly session: { actorId: string | null };
  readonly ingestionDiagnostics: {
    last: {
      readonly resultKind: string;
      readonly operationIdLength: number;
      readonly purpose: string;
      readonly resourceType: string;
      readonly resourceVersion: string;
      readonly callerSourceRefCount: number;
      readonly undefinedKeys: readonly string[];
      readonly mismatchKeys: readonly string[];
      readonly expectedSemanticSha256: string | null;
      readonly readbackSemanticSha256: string | null;
    } | null;
  };
}

async function createRuntime(input: {
  readonly adminUrl: string;
  readonly writerUrl: string;
  readonly writerRole: string;
  readonly privilegedValidatorManifestSha256: string;
}): Promise<ConcreteRuntime> {
  const admin = new PrismaClient({
    datasources: { db: { url: input.adminUrl } },
  }) as P0GeneratedPrismaClient;
  const rawWriter = new PrismaClient({
    datasources: { db: { url: input.writerUrl } },
  }) as P0GeneratedPrismaClient;
  const writer = bindP0TrustedWriterPrismaClientToDatabaseRole({
    client: rawWriter,
    expectedRole: input.writerRole,
  }) as P0GeneratedPrismaClient;
  await Promise.all([admin.$connect(), rawWriter.$connect()]);

  const session: { actorId: string | null } = { actorId: null };
  const workerConfiguration: P0WorkerTokenConfiguration = Object.freeze({
    workerActorId: "p0-disposable-worker",
    hmacKey: new Uint8Array(Buffer.alloc(32, 0x71)),
  });
  const principalClient = writer as unknown as P0PrincipalPrismaClient;
  const principalDependencies = createP0PrismaServerPrincipalDependencies({
    client: principalClient,
    async resolveAuthenticatedAccount() {
      if (!session.actorId) return null;
      return (await writer.user.findUnique({
        where: { id: session.actorId },
        select: userSelect(),
      })) as P0PrincipalUserRow | null;
    },
    resolveWorkerTokenConfiguration: () => workerConfiguration,
  });
  const principalRevalidator: P0PrismaTransactionalPrincipalRevalidator =
    Object.freeze({
      async revalidateInTransaction(
        request: Parameters<
          P0PrismaTransactionalPrincipalRevalidator["revalidateInTransaction"]
        >[0],
      ) {
        return revalidateP0PrismaPrincipal({
          client: request.transaction as never,
          principal: request.principal,
          operationId: request.operationId,
          repositoryPurpose: request.purpose,
          workerConfiguration,
        });
      },
    });
  const concreteIngestionRepository = createPrismaP0ReportIngestionRepository({
    client: writer,
    principalRevalidator,
  });
  const ingestionDiagnostics: ConcreteRuntime["ingestionDiagnostics"] = {
    last: null,
  };
  const ingestionRepository: P0Repository = Object.freeze({
    readExact<T>(
      context: Parameters<P0Repository["readExact"]>[0],
      resource: Parameters<P0Repository["readExact"]>[1],
      sourceRefs: Parameters<P0Repository["readExact"]>[2] = [],
    ) {
      return concreteIngestionRepository.readExact<T>(
        context,
        resource,
        sourceRefs,
      );
    },
    createExact<T>(
      context: Parameters<P0Repository["createExact"]>[0],
      resource: Parameters<P0Repository["createExact"]>[1],
      value: T,
      sourceRefs: Parameters<P0Repository["createExact"]>[3] = [],
    ) {
      return concreteIngestionRepository.createExact<T>(
        context,
        resource,
        value,
        sourceRefs,
      );
    },
    async compareAndSwapExact<T>(
      context: Parameters<P0Repository["compareAndSwapExact"]>[0],
      resource: Parameters<P0Repository["compareAndSwapExact"]>[1],
      expected: T,
      next: T,
      sourceRefs: Parameters<P0Repository["compareAndSwapExact"]>[4] = [],
    ) {
      const result = await concreteIngestionRepository.compareAndSwapExact(
        context,
        resource,
        expected,
        next,
        sourceRefs,
      );
      if (result.kind === "OUTCOME_UNKNOWN") {
        const row = (await admin.reportIngestion.findFirst({
          where: {
            tenantId: context.scope.tenantId,
            consumerId: context.scope.consumerId,
            id: resource.resourceId,
          },
        })) as Record<string, unknown> | null;
        const expectedRecord = next as Record<string, unknown>;
        const readbackRecord: Record<string, unknown> = {};
        for (const [key, expectedValue] of Object.entries(expectedRecord)) {
          const persistedValue = row?.[key];
          readbackRecord[key] =
            key === "contractVersion"
              ? expectedValue
              : persistedValue instanceof Date
                ? persistedValue.toISOString()
                : Buffer.isBuffer(persistedValue) ||
                    persistedValue instanceof Uint8Array
                  ? Buffer.from(persistedValue).toString("base64")
                  : typeof persistedValue === "bigint"
                    ? Number(persistedValue)
                    : persistedValue;
        }
        const keys = Object.keys(expectedRecord).sort();
        const mismatchKeys = keys.filter(
          (key) =>
            JSON.stringify(diagnosticCanonical(expectedRecord[key])) !==
            JSON.stringify(diagnosticCanonical(readbackRecord[key])),
        );
        const undefinedKeys = keys.filter(
          (key) => expectedRecord[key] === undefined,
        );
        let expectedSemanticSha256: string | null = null;
        let readbackSemanticSha256: string | null = null;
        try {
          expectedSemanticSha256 = computeP0RepositorySemanticSha256(next);
        } catch {
          expectedSemanticSha256 = null;
        }
        try {
          readbackSemanticSha256 = computeP0RepositorySemanticSha256(
            readbackRecord,
          );
        } catch {
          readbackSemanticSha256 = null;
        }
        ingestionDiagnostics.last = Object.freeze({
          resultKind: result.kind,
          operationIdLength: context.operationId.length,
          purpose: context.purpose,
          resourceType: resource.resourceType,
          resourceVersion: resource.resourceVersion,
          callerSourceRefCount: sourceRefs.length,
          undefinedKeys: Object.freeze(undefinedKeys),
          mismatchKeys: Object.freeze(mismatchKeys),
          expectedSemanticSha256,
          readbackSemanticSha256,
        });
      }
      return result;
    },
  });
  const ingestionService = createP0ReportIngestionService(ingestionRepository);
  const valueProtection = createDeterministicDisposableP0ValueProtectionAdapter({
    seed: "creditvector-p0-real-adapter-disposable-only-v1",
    keyVersion: "disposable-real-adapter-v1",
  });
  const sensitiveAccessRepository = createP0PrismaSensitiveAccessRepository({
    client: writer,
    principalRevalidator,
  });
  const sourceAdapter = createP0PrismaSourceArtifactAdapter({
    prisma: writer,
    protector: valueProtection,
    revalidatePrincipal: (
      transaction,
      principal,
      operationId,
      repositoryPurpose,
    ) =>
      revalidateP0PrismaPrincipal({
        client: transaction as never,
        principal,
        operationId,
        repositoryPurpose,
        workerConfiguration,
      }),
  });
  const sourcePersister = createP0TrustedWriterPrismaSourcePersister({
    sourceAdapter,
    sensitiveAccessRepository,
  });
  const reportVersionRepository = createP0PrismaReportVersionRepository({
    client: writer,
    revalidatePrincipal: ({
      transaction,
      principal,
      operationId,
      repositoryPurpose,
    }) =>
      revalidateP0PrismaPrincipal({
        client: transaction,
        principal,
        operationId,
        repositoryPurpose,
        workerConfiguration,
      }),
  });
  const extractionInputRepository = createP0PrismaExtractionInputRepository({
    client: writer,
    revalidatePrincipal: ({
      transaction,
      principal,
      operationId,
      repositoryPurpose,
    }) =>
      revalidateP0PrismaPrincipal({
        client: transaction,
        principal,
        operationId,
        repositoryPurpose,
        workerConfiguration,
      }),
  });
  const graphRepository = createPrismaP0ShadowTruthGraphRepository({
    client: writer,
    principalRevalidator,
  });
  const round0Repositories = createP0PrismaRound0Repositories({
    client: writer,
    principalRevalidator,
  });
  const signedReceipt = installSignedReadinessEnvironment(
    input.privilegedValidatorManifestSha256,
    input.writerRole,
  );
  assert.equal(
    signedReceipt.privilegedValidatorManifestSha256,
    input.privilegedValidatorManifestSha256,
  );
  const readiness = readinessEvidence(signedReceipt);
  const parserKeys = generateKeyPairSync("ed25519");
  process.env.P0_TRUSTED_PARSER_PUBLIC_KEY_SPKI_BASE64 = parserKeys.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
  process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_ID =
    "creditvector-regex-v2-disposable";
  process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_VERSION = "regex-v2.1";
  process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_SHA256 = exactFileSha256(
    "lib/creditTruth/parserShadowAdapter.ts",
  );
  return Object.freeze({
    admin,
    writer,
    workerConfiguration,
    principalDependencies,
    principalRevalidator,
    ingestionService,
    ingestionRepository,
    sourceAdapter,
    sensitiveAccessRepository,
    sourcePersister,
    reportVersionRepository,
    extractionInputRepository,
    graphRepository,
    round0Repositories,
    valueProtection,
    readiness,
    parserPrivateKey: parserKeys.privateKey,
    session,
    ingestionDiagnostics,
  });
}

async function prepareSourceStored(input: {
  readonly runtime: ConcreteRuntime;
  readonly principal: P0Principal;
  readonly legacyReportId: string;
  readonly content: Uint8Array;
  readonly reservedVersion?: number;
}): Promise<{
  readonly ingestion: P0ReportIngestion;
  readonly receipt: VerifiedP0SourceArtifactWriteReceipt;
}> {
  const scope = p0ScopeFromPrincipal(input.principal);
  const source = selectP0TrustedWriterUploadSource([
    {
      kind: "ORIGINAL_TEXT",
      mimeType: "text/plain",
      content: input.content,
    },
  ]);
  assert(source);
  const binding = sha256(
    `${scope.tenantId}:${scope.consumerId}:${input.legacyReportId}:${source.sha256}`,
  );
  const operationKey = `p0manualop_${binding.slice(0, 40)}`;
  const reserve = await input.runtime.ingestionService.reserve({
    principal: input.principal,
    gatePermit: await gatePermit(input.runtime, input.principal, operationKey),
    idempotencyKey: `p0manualidem_${binding.slice(0, 40)}`,
    operationKey,
    reportSeriesKey: deriveP0ReportSeriesKey(input.legacyReportId),
    reservedVersion: input.reservedVersion ?? 1,
    sourceSha256: source.sha256,
    sourceByteLength: source.byteLength,
    sourceDeclaredMimeType: source.mimeType,
    sourceDetectedMimeType: source.mimeType,
    maxAttempts: 3,
  });
  assert(reserve.ok, JSON.stringify(reserve));
  const claimAuthority = await workerAuthority(
    input.runtime,
    reserve.ingestion.id,
    "CLAIM",
  );
  const claim = await input.runtime.ingestionService.claim({
    principal: claimAuthority.principal,
    gatePermit: claimAuthority.permit,
    ingestionId: reserve.ingestion.id,
    operationId: claimAuthority.operationId,
    leaseMs: 60_000,
  });
  assert(claim.ok && claim.ingestion.leaseToken, JSON.stringify(claim));
  const storeAuthority = await workerAuthority(
    input.runtime,
    reserve.ingestion.id,
    "STORE_SOURCE",
  );
  const stored = await input.runtime.sourcePersister.persistExact({
    principal: storeAuthority.principal,
    gatePermit: storeAuthority.permit,
    operationId: storeAuthority.operationId,
    ingestion: claim.ingestion,
    source,
  });
  assert("receipt" in stored, JSON.stringify(stored));
  const transitionAuthority = await workerAuthority(
    input.runtime,
    reserve.ingestion.id,
    "TRANSITION",
  );
  const transitioned = await input.runtime.ingestionService.transition({
    principal: transitionAuthority.principal,
    gatePermit: transitionAuthority.permit,
    ingestionId: reserve.ingestion.id,
    operationId: transitionAuthority.operationId,
    expectedRevision: claim.ingestion.revision,
    leaseToken: claim.ingestion.leaseToken,
    to: "SOURCE_STORED_AND_VERIFIED",
    sourceReceipt: stored.receipt,
  });
  assert(
    transitioned.ok,
    JSON.stringify({
      transition: transitioned,
      repositoryDiagnostic: input.runtime.ingestionDiagnostics.last,
    }),
  );
  return Object.freeze({ ingestion: transitioned.ingestion, receipt: stored.receipt });
}

async function interactivePrincipal(
  runtime: ConcreteRuntime,
  actorId: string,
  consumerId: string,
): Promise<P0Principal> {
  runtime.session.actorId = actorId;
  const principal = await resolveP0InteractivePrincipal(
    {
      authorizationIntent: "DIRECT_OR_MANAGED",
      consumerSelector: consumerId,
    },
    runtime.principalDependencies,
  );
  assert(principal, `interactive principal denied for ${actorId}/${consumerId}`);
  return principal;
}

async function workerAuthority(
  runtime: ConcreteRuntime,
  ingestionId: string,
  purpose: P0WorkerOperationPurpose,
): Promise<{
  readonly principal: P0Principal;
  readonly operationId: string;
  readonly permit: P0Phase2AGatePermit;
}> {
  const operationId = await issueP0WorkerOperationToken(
    { ingestionId, purpose },
    {
      client: runtime.writer as unknown as P0PrincipalPrismaClient,
      configuration: runtime.workerConfiguration,
    },
  );
  assert(operationId, `worker token denied for ${purpose}`);
  const principal = await resolveP0WorkerPrincipal(
    operationId,
    runtime.principalDependencies,
  );
  assert(principal, `worker principal denied for ${purpose}`);
  const permit = await gatePermit(runtime, principal, operationId);
  return Object.freeze({ principal, operationId, permit });
}

async function gatePermit(
  runtime: ConcreteRuntime,
  principal: P0Principal,
  operationId: string,
  stage: P0Phase2AStage = "INGESTION_SHADOW",
): Promise<P0Phase2AGatePermit> {
  const scope = p0ScopeFromPrincipal(principal);
  const cohortDecision = await resolveP0Phase2ACohortFromServerEnvironment({
    principal,
    scope,
    stage,
  });
  assert(cohortDecision?.included, `cohort denied for ${stage}`);
  const permit = evaluateAndMintP0Phase2AGatePermit({
    stage,
    mode: "PRE_ACTIVATION_ATTESTATION",
    operationId,
    flags: p0Phase2AFlagsFromEnv(),
    principal,
    scope,
    cohortDecision,
    readinessEvidence: runtime.readiness,
  });
  assert(permit, `gate permit denied for ${stage}`);
  return permit;
}

async function readIngestion(
  runtime: ConcreteRuntime,
  principal: P0Principal,
  ingestionId: string,
): Promise<P0ReportIngestion> {
  const read = await runtime.ingestionService.read({
    principal,
    ingestionId,
    operationId: `read_${sha256(`${ingestionId}:${Date.now()}`).slice(0, 32)}`,
  });
  assert(read.ok, JSON.stringify(read));
  return read.ingestion;
}

async function auditAccess(input: {
  readonly runtime: ConcreteRuntime;
  readonly authority: Awaited<ReturnType<typeof workerAuthority>>;
  readonly ingestion: P0ReportIngestion;
}) {
  const scope = p0ScopeFromPrincipal(input.authority.principal);
  const candidate = Object.freeze({
    resourceType: "REPORT_INGESTION" as const,
    resourceId: input.ingestion.id,
    resourceVersion: input.ingestion.revision,
  });
  const resource = await verifyP0SensitiveResourceRef({
    principal: input.authority.principal,
    scope,
    candidate,
    verifier: {
      verifierId: "p0-real-adapter-resource-v1",
      async verifyResourceRef(request) {
        return (
          request.principal === input.authority.principal &&
          request.scope.tenantId === scope.tenantId &&
          request.scope.consumerId === scope.consumerId &&
          request.candidate.resourceType === candidate.resourceType &&
          request.candidate.resourceId === candidate.resourceId &&
          request.candidate.resourceVersion === candidate.resourceVersion
        );
      },
    },
  });
  assert(resource);
  const opaque = `p0op_${sha256(input.authority.operationId)}`;
  const refs = await verifyAndDeriveP0SensitiveAuditRefs({
    principal: input.authority.principal,
    scope,
    candidate: { operationRef: opaque, eventRef: opaque },
    resource,
    accessKind: "WORKER",
    purposeCode: "REPORT_INGESTION",
    verifier: {
      verifierId: "p0-real-adapter-audit-refs-v1",
      async verifyAuditRefs(request) {
        return (
          request.principal === input.authority.principal &&
          request.resource === resource &&
          request.candidate.operationRef === opaque &&
          request.candidate.eventRef === opaque
        );
      },
    },
  });
  assert(refs);
  const access = await authorizeAndAuditP0SensitiveAccess({
    principal: input.authority.principal,
    scope,
    operationId: input.authority.operationId,
    accessKind: "WORKER",
    purposeCode: "REPORT_INGESTION",
    resource,
    auditRefs: refs,
    grantTtlSeconds: 30,
    authorizer: {
      async authorizeSensitiveAccess(request) {
        return request.principal === input.authority.principal &&
          request.resource === resource
          ? { allowed: true as const, reasonCode: "AUTHORIZED" as const }
          : { allowed: false as const, reasonCode: "SCOPE_DENIED" as const };
      },
    },
    repository: input.runtime.sensitiveAccessRepository,
  });
  assert(access.allowed, JSON.stringify(access));
  return Object.freeze({ grant: access.grant, resource });
}

async function authorizeStoredSourceRead(input: {
  readonly runtime: ConcreteRuntime;
  readonly authority: Awaited<ReturnType<typeof workerAuthority>>;
  readonly receipt: VerifiedP0SourceArtifactWriteReceipt;
}) {
  const scope = p0ScopeFromPrincipal(input.authority.principal);
  const object = input.receipt.object;
  assert.equal(object.scope.tenantId, scope.tenantId);
  assert.equal(object.scope.consumerId, scope.consumerId);
  const resourceCandidate = Object.freeze({
    resourceType:
      object.kind === "NORMALIZED_TEXT"
        ? ("NORMALIZED_REPORT_TEXT" as const)
        : ("REPORT_SOURCE" as const),
    resourceId: object.scope.artifactId,
    resourceVersion: object.scope.artifactVersion,
  });
  const resource = await verifyP0SensitiveResourceRef({
    principal: input.authority.principal,
    scope,
    candidate: resourceCandidate,
    verifier: {
      verifierId: "p0-real-adapter-stored-source-v1",
      async verifyResourceRef(request) {
        return (
          request.principal === input.authority.principal &&
          request.scope.tenantId === object.scope.tenantId &&
          request.scope.consumerId === object.scope.consumerId &&
          request.candidate.resourceType === resourceCandidate.resourceType &&
          request.candidate.resourceId === object.scope.artifactId &&
          request.candidate.resourceVersion === object.scope.artifactVersion
        );
      },
    },
  });
  assert(resource);
  const opaque = `p0op_${sha256(`source-read:${input.authority.operationId}`)}`;
  const refs = await verifyAndDeriveP0SensitiveAuditRefs({
    principal: input.authority.principal,
    scope,
    candidate: { operationRef: opaque, eventRef: opaque },
    resource,
    accessKind: "WORKER",
    purposeCode: "WORKER_EXTRACTION",
    verifier: {
      verifierId: "p0-real-adapter-source-read-audit-v1",
      async verifyAuditRefs(request) {
        return (
          request.principal === input.authority.principal &&
          request.resource === resource &&
          request.candidate.operationRef === opaque &&
          request.candidate.eventRef === opaque
        );
      },
    },
  });
  assert(refs);
  const access = await authorizeAndAuditP0SensitiveAccess({
    principal: input.authority.principal,
    scope,
    operationId: input.authority.operationId,
    accessKind: "WORKER",
    purposeCode: "WORKER_EXTRACTION",
    resource,
    auditRefs: refs,
    grantTtlSeconds: 30,
    authorizer: {
      async authorizeSensitiveAccess(request) {
        return request.principal === input.authority.principal &&
          request.resource === resource
          ? { allowed: true as const, reasonCode: "AUTHORIZED" as const }
          : { allowed: false as const, reasonCode: "SCOPE_DENIED" as const };
      },
    },
    repository: input.runtime.sensitiveAccessRepository,
  });
  assert(access.allowed, JSON.stringify(access));
  const now = Date.now();
  const capability = await verifyP0SourceArtifactCapability(
    {
      scope: object.scope,
      purpose: "READ_SOURCE",
      actorId: input.authority.principal.actorId,
      authorizationDecisionId: input.authority.operationId,
      authorizationVersion: input.authority.principal.authorizationVersion,
      issuedAt: new Date(now - 1_000).toISOString(),
      expiresAt: new Date(now + 30_000).toISOString(),
    },
    {
      async verifyDecision({ candidate }) {
        return (
          candidate.scope.artifactId === object.scope.artifactId &&
          candidate.authorizationDecisionId === input.authority.operationId &&
          (await revalidateP0PrismaPrincipal({
            client:
              input.runtime.writer as unknown as P0PrincipalPrismaClient,
            principal: input.authority.principal,
            operationId: input.authority.operationId,
            repositoryPurpose: "SOURCE_ARTIFACT_READ",
            workerConfiguration: input.runtime.workerConfiguration,
          }))
        );
      },
    },
  );
  assert(capability);
  return Object.freeze({ capability, grant: access.grant, resource });
}

async function storeNormalizedInput(input: {
  readonly runtime: ConcreteRuntime;
  readonly ingestion: P0ReportIngestion;
  readonly content: Uint8Array;
}): Promise<{
  readonly authority: Awaited<ReturnType<typeof workerAuthority>>;
  readonly receipt: VerifiedP0SourceArtifactWriteReceipt;
}> {
  const authority = await workerAuthority(
    input.runtime,
    input.ingestion.id,
    "STORE_SOURCE",
  );
  const scope = p0ScopeFromPrincipal(authority.principal);
  const identity = deriveP0SourceArtifactOperationIdentity({
    ...scope,
    ingestionId: input.ingestion.id,
    operationId: input.ingestion.operationKey,
    kind: "NORMALIZED_TEXT",
  });
  const sourceScope = Object.freeze({
    ...scope,
    ingestionId: input.ingestion.id,
    artifactId: identity.artifactId,
    artifactVersion: 1,
  });
  const access = await auditAccess({
    runtime: input.runtime,
    authority,
    ingestion: input.ingestion,
  });
  const now = Date.now();
  const capability = await verifyP0SourceArtifactCapability(
    {
      scope: sourceScope,
      purpose: "STORE_SOURCE",
      actorId: authority.principal.actorId,
      authorizationDecisionId: authority.operationId,
      authorizationVersion: authority.principal.authorizationVersion,
      issuedAt: new Date(now - 1_000).toISOString(),
      expiresAt: new Date(now + 30_000).toISOString(),
    },
    {
      async verifyDecision({ candidate }) {
        return (
          candidate.scope.artifactId === identity.artifactId &&
          candidate.authorizationDecisionId === authority.operationId &&
          candidate.authorizationVersion ===
            authority.principal.authorizationVersion
        );
      },
    },
    {
      principal: authority.principal,
      permit: authority.permit,
      operationId: authority.operationId,
    },
  );
  assert(capability);
  const digest = computeP0SourceArtifactSha256(input.content);
  const write = await dispatchP0SourceArtifactWrite(
    input.runtime.sourceAdapter.provider,
    {
      contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
      selectedProviderKey: P0_PRISMA_SOURCE_PROVIDER_KEY,
      capability: capability as typeof capability & { purpose: "STORE_SOURCE" },
      principal: authority.principal,
      gatePermit: authority.permit,
      operationId: authority.operationId,
      sourceOperationId: input.ingestion.operationKey,
      writeFence: input.runtime.sourceAdapter.writeFence,
      ingestionRevision: input.ingestion.revision,
      sensitiveAccessGrant: access.grant,
      sensitiveResource: access.resource,
      sensitiveAccessKind: "WORKER",
      sensitiveAccessPurposeCode: "REPORT_INGESTION",
      scope: sourceScope,
      kind: "NORMALIZED_TEXT",
      mimeType: "text/plain",
      content: input.content,
      sha256: digest,
      byteLength: input.content.byteLength,
      idempotencyKey: identity.providerOperationId,
    },
  );
  assert(write.ok, JSON.stringify(write));
  return Object.freeze({ authority, receipt: write.value });
}

function signParserExecution(input: {
  readonly runtime: ConcreteRuntime;
  readonly envelope: VerifiedP0ParserShadowEnvelope;
  readonly scope: P0Scope;
  readonly operationId: string;
  readonly ingestionId: string;
  readonly reportVersionId: string;
  readonly issuedAt?: string;
  readonly expiresAt?: string;
  readonly mutate?: (
    candidate: P0TrustedParserExecutionCandidate,
  ) => P0TrustedParserExecutionCandidate;
}): VerifiedP0TrustedParserExecution | null {
  const now = Date.now();
  let candidate: P0TrustedParserExecutionCandidate = {
    contractVersion: P0_TRUSTED_PARSER_EXECUTION_CONTRACT_VERSION,
    executionId: `p0parser_${sha256(`${input.operationId}:${now}`).slice(0, 40)}`,
    parserImplementationId: process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_ID!,
    parserImplementationVersion:
      process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_VERSION!,
    parserImplementationSha256:
      process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_SHA256!,
    operationId: input.operationId,
    tenantId: input.scope.tenantId,
    consumerId: input.scope.consumerId,
    ingestionId: input.ingestionId,
    reportVersionId: input.reportVersionId,
    sourceArtifactId: input.envelope.source.artifactId,
    sourceArtifactVersion: input.envelope.source.artifactVersion,
    sourceSha256: input.envelope.source.sha256,
    envelopeSemanticSha256: computeP0RepositorySemanticSha256(input.envelope),
    issuedAt: input.issuedAt ?? new Date(now - 1_000).toISOString(),
    expiresAt: input.expiresAt ?? new Date(now + 30_000).toISOString(),
    signatureBase64: Buffer.alloc(64, 0x41).toString("base64"),
  };
  if (input.mutate) candidate = input.mutate(candidate);
  candidate = Object.freeze({
    ...candidate,
    signatureBase64: signPayload(
      null,
      computeP0TrustedParserExecutionSigningPayload(candidate),
      input.runtime.parserPrivateKey,
    ).toString("base64"),
  });
  return verifyP0TrustedParserExecutionFromServerEnvironment({
    candidate,
    envelope: input.envelope,
    scope: input.scope,
    operationId: input.operationId,
    ingestionId: input.ingestionId,
    reportVersionId: input.reportVersionId,
    now: new Date(),
  });
}

async function seedSyntheticLegacyRows(runtime: ConcreteRuntime): Promise<void> {
  await runtime.admin.user.createMany({
    data: [
      {
        id: "tw-consumer-direct",
        email: "tw-consumer-direct@synthetic.invalid",
        role: "USER",
        isAgency: false,
      },
      {
        id: "tw-agency",
        email: "tw-agency@synthetic.invalid",
        role: "USER",
        isAgency: true,
      },
      {
        id: "tw-managed-consumer",
        email: "tw-managed-consumer@synthetic.invalid",
        role: "USER",
        isAgency: false,
        managedByAgencyId: "tw-agency",
      },
      {
        id: "tw-other-consumer",
        email: "tw-other-consumer@synthetic.invalid",
        role: "USER",
        isAgency: false,
      },
      {
        id: "tw-rollback-consumer",
        email: "tw-rollback-consumer@synthetic.invalid",
        role: "USER",
        isAgency: false,
      },
    ],
  });
  await runtime.admin.report.createMany({
    data: [
      {
        id: "tw-report-direct",
        userId: "tw-consumer-direct",
        fileName: "synthetic-direct.txt",
        bureaus: ["EQUIFAX"],
      },
      {
        id: "tw-report-graph",
        userId: "tw-consumer-direct",
        fileName: "synthetic-graph.txt",
        bureaus: ["EQUIFAX"],
      },
      {
        id: "tw-report-graph-unknown",
        userId: "tw-consumer-direct",
        fileName: "synthetic-graph-unknown.txt",
        bureaus: ["EQUIFAX"],
      },
      {
        id: "tw-report-graph-readback-rollback",
        userId: "tw-consumer-direct",
        fileName: "synthetic-graph-readback-rollback.txt",
        bureaus: ["EQUIFAX"],
      },
      {
        id: "tw-report-diagnostic",
        userId: "tw-consumer-direct",
        fileName: "synthetic-diagnostic.txt",
        bureaus: ["EQUIFAX"],
      },
      {
        id: "tw-report-managed",
        userId: "tw-managed-consumer",
        fileName: "synthetic-managed.txt",
        bureaus: ["EXPERIAN"],
      },
      {
        id: "tw-report-other",
        userId: "tw-other-consumer",
        fileName: "synthetic-other.txt",
        bureaus: ["TRANSUNION"],
      },
      {
        id: "tw-report-race",
        userId: "tw-consumer-direct",
        fileName: "synthetic-race.txt",
        bureaus: ["EQUIFAX"],
      },
      {
        id: "tw-report-deadlock",
        userId: "tw-consumer-direct",
        fileName: "synthetic-deadlock.txt",
        bureaus: ["EQUIFAX"],
      },
      {
        id: "tw-report-read-revoke",
        userId: "tw-consumer-direct",
        fileName: "synthetic-read-revoke.txt",
        bureaus: ["EQUIFAX"],
      },
      {
        id: "tw-report-reanalysis",
        userId: "tw-consumer-direct",
        fileName: "synthetic-reanalysis.txt",
        bureaus: ["EQUIFAX"],
      },
    ],
  });
}

async function durableCounts(runtime: ConcreteRuntime) {
  const [
    ingestions,
    sourceObjects,
    reportVersions,
    artifacts,
    extractionRuns,
    reportAccounts,
    accountReviews,
    sensitiveEvents,
  ] = await Promise.all([
    runtime.admin.reportIngestion.count(),
    runtime.admin.p0SourceObject.count(),
    runtime.admin.reportVersion.count(),
    runtime.admin.artifact.count(),
    runtime.admin.extractionRun.count(),
    runtime.admin.reportVersionAccount.count(),
    runtime.admin.consumerAccountReviewReceipt.count(),
    runtime.admin.p0SensitiveAccessEvent.count(),
  ]);
  return Object.freeze({
    ingestions,
    sourceObjects,
    reportVersions,
    artifacts,
    extractionRuns,
    reportAccounts,
    accountReviews,
    sensitiveEvents,
  });
}

async function writerSqlDenied(
  writer: P0SqlClient,
  sql: string,
  ...values: any[]
): Promise<string> {
  try {
    await writer.$queryRawUnsafe(sql, ...values);
    return "UNEXPECTEDLY_ALLOWED";
  } catch (error) {
    return error instanceof Error ? error.message : "DATABASE_DENIED";
  }
}

function exactDatabaseSqlState(error: unknown): string | null {
  const seen = new Set<object>();
  const visit = (value: unknown): string | null => {
    if (typeof value === "string") {
      return (
        value
          .match(/(?:^|\b)([0-9A-Z]{5})(?:\b|$)/g)
          ?.map((candidate) => candidate.trim())
          .find(
            (candidate) =>
              /\d/.test(candidate) && !/^P\d{4}$/.test(candidate),
          ) ?? null
      );
    }
    if (!value || typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ["databaseCode", "sqlState", "sqlstate"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && /^[0-9A-Z]{5}$/.test(candidate)) {
        return candidate;
      }
    }
    for (const key of ["meta", "cause"]) {
      const nested = visit(record[key]);
      if (nested) return nested;
    }
    for (const [key, candidate] of Object.entries(record)) {
      if (["code", "meta", "cause"].includes(key)) continue;
      const nested = visit(candidate);
      if (nested) return nested;
    }
    const code = record.code;
    if (
      typeof code === "string" &&
      /^[0-9A-Z]{5}$/.test(code) &&
      !/^P\d{4}$/.test(code)
    ) {
      return code;
    }
    return null;
  };
  return visit(error);
}

async function observedSqlState(
  client: P0SqlClient,
  sql: string,
  ...values: any[]
): Promise<string> {
  try {
    await client.$queryRawUnsafe(sql, ...values);
    return "ALLOWED";
  } catch (error) {
    return exactDatabaseSqlState(error) ?? "UNKNOWN_DENIAL";
  }
}

async function observedExecuteSqlState(
  client: P0SqlClient,
  sql: string,
  ...values: any[]
): Promise<string> {
  try {
    await client.$executeRawUnsafe(sql, ...values);
    return "ALLOWED";
  } catch (error) {
    return exactDatabaseSqlState(error) ?? "UNKNOWN_DENIAL";
  }
}

async function observedSqlStateAsRole(
  admin: PrismaClient,
  role: string,
  sql: string,
): Promise<string> {
  try {
    await admin.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      await transaction.$queryRawUnsafe(sql);
    });
    return "ALLOWED";
  } catch (error) {
    return exactDatabaseSqlState(error) ?? "UNKNOWN_DENIAL";
  }
}

async function catalogDriftIsDetectedAndRolledBack(input: {
  readonly runtime: ConcreteRuntime;
  readonly writerRole: string;
  readonly ownerRole: string;
  readonly manifestSha256: string;
  readonly label: string;
  mutate(transaction: P0SqlClient): Promise<unknown>;
}): Promise<boolean> {
  const rollbackMarker = `P0_PRIVILEGED_VALIDATOR_ROLLBACK:${input.label}`;
  let driftDetected = false;
  let rollbackObserved = false;
  try {
    await input.runtime.admin.$transaction(async (transaction) => {
      await input.mutate(transaction as unknown as P0SqlClient);
      try {
        await attestPrivilegedValidatorCatalog(
          transaction as unknown as P0SqlClient,
          input.writerRole,
          input.ownerRole,
          input.manifestSha256,
        );
      } catch {
        driftDetected = true;
      }
      assert.equal(driftDetected, true, `${input.label} drift was not detected`);
      throw new Error(rollbackMarker);
    });
  } catch (error) {
    rollbackObserved =
      error instanceof Error && error.message === rollbackMarker;
  }
  assert.equal(rollbackObserved, true, `${input.label} rollback was not observed`);
  await attestPrivilegedValidatorCatalog(
    input.runtime.admin,
    input.writerRole,
    input.ownerRole,
    input.manifestSha256,
  );
  return driftDetected && rollbackObserved;
}

async function main(): Promise<void> {
  assert.equal(process.env.NODE_ENV, "test");
  const writerUrl = requireDisposableUrl(WRITER_URL_ENV);
  const adminUrl = requireDisposableUrl(ADMIN_URL_ENV);
  const adminRole = new URL(adminUrl).username;
  assert(/^[A-Za-z0-9_]{1,63}$/.test(adminRole));
  const writerRole = process.env[WRITER_ROLE_ENV];
  assert(writerRole && SAFE_ROLE.test(writerRole));
  const validatorOwner = process.env[VALIDATOR_OWNER_ENV];
  assert(validatorOwner && SAFE_VALIDATOR_OWNER.test(validatorOwner));
  assert.notEqual(new URL(writerUrl).username, new URL(adminUrl).username);

  const catalogClient = new PrismaClient({
    datasources: { db: { url: adminUrl } },
  });
  await catalogClient.$connect();
  let privilegedCatalog: PrivilegedValidatorCatalogAttestation;
  try {
    privilegedCatalog = await attestPrivilegedValidatorCatalog(
      catalogClient,
      writerRole,
      validatorOwner,
    );
  } finally {
    await catalogClient.$disconnect();
  }
  process.stdout.write(
    `privileged-validator-manifest=${privilegedCatalog.manifestSha256}` +
      `; routines=${privilegedCatalog.definitionHashes.length}` +
      `; triggers=${privilegedCatalog.triggerCount}\n`,
  );

  delete process.env.P0_PHASE2_ENABLED;
  delete process.env.P0_INGESTION_SHADOW_ENABLED;
  delete process.env.P0_PHASE2_KILL_SWITCH;
  delete process.env[P0_TRUSTED_WRITER_RUNTIME_MODE_ENV];
  await test("live-route trusted writer is hard-null before disposable installation", () => {
    assert.equal(createP0ProductionTrustedWriterUploadHook(), null);
  });

  process.env.P0_PHASE2_ENABLED = "true";
  process.env.P0_INGESTION_SHADOW_ENABLED = "true";
  process.env.P0_PHASE2_KILL_SWITCH = "false";
  process.env.P0_ROUND0_REVIEW_ENABLED = "true";
  process.env.P0_ASSERTION_RUNTIME_ENABLED = "true";
  process.env[P0_TRUSTED_WRITER_RUNTIME_MODE_ENV] =
    P0_TRUSTED_WRITER_DISPOSABLE_MODE;
  const runtime = await createRuntime({
    adminUrl,
    writerUrl,
    writerRole,
    privilegedValidatorManifestSha256: privilegedCatalog.manifestSha256,
  });
  try {
    await test("dedicated writer client rejects unbound/global and admin-session role substitution", async () => {
      let authorityCallbackEntered = false;
      const falselyLabeledAdmin = bindP0TrustedWriterPrismaClientToDatabaseRole({
        client: runtime.admin,
        expectedRole: writerRole,
      });
      await assert.rejects(
        falselyLabeledAdmin.$transaction(async () => {
          authorityCallbackEntered = true;
        }),
        /database role verification failed/,
      );
      assert.equal(authorityCallbackEntered, false);

      await runtime.admin.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(`SET LOCAL ROLE "${writerRole}"`);
        const identity = await transaction.$queryRaw<
          Array<{ currentRole: string; sessionRole: string }>
        >`
          SELECT
            current_user::text AS "currentRole",
            session_user::text AS "sessionRole"
        `;
        assert.equal(identity[0]?.currentRole, writerRole);
        assert.notEqual(identity[0]?.sessionRole, writerRole);
        await assert.rejects(
          assertP0TrustedWriterDatabaseRoleInTransaction(
            transaction,
            writerRole,
          ),
          /database role verification failed/,
        );
      });
    });
    await seedSyntheticLegacyRows(runtime);
    await test("privileged-validator catalog is exact before readiness is trusted", async () => {
      const readback = await attestPrivilegedValidatorCatalog(
        runtime.admin,
        writerRole,
        validatorOwner,
        privilegedCatalog.manifestSha256,
      );
      assert.equal(readback.definitionHashes.length, 28);
      assert.equal(readback.triggerCount, 87);
      assert.equal(
        runtime.readiness.productionRepositoryReceipt
          ?.privilegedValidatorManifestSha256,
        privilegedCatalog.manifestSha256,
      );
    });
    const directScope = {
      tenantId: "tw-consumer-direct",
      consumerId: "tw-consumer-direct",
    };
    const managedScope = {
      tenantId: "tw-agency",
      consumerId: "tw-managed-consumer",
    };
    process.env.P0_PHASE2_COHORT_VERSION = "tw-disposable-cohort-v1";
    process.env.P0_PHASE2_COHORT_SCOPE_SHA256S = [
      p0Phase2ACohortScopeSha256(directScope),
      p0Phase2ACohortScopeSha256(managedScope),
    ].join(",");
    const directPrincipal = await interactivePrincipal(
      runtime,
      directScope.tenantId,
      directScope.consumerId,
    );
    const managedPrincipal = await interactivePrincipal(
      runtime,
      managedScope.tenantId,
      managedScope.consumerId,
    );
    assert.deepEqual(p0ScopeFromPrincipal(directPrincipal), directScope);
    assert.deepEqual(p0ScopeFromPrincipal(managedPrincipal), managedScope);

    await test("transparent concrete repository observer proves source-store transition attestation", async () => {
      const prepared = await prepareSourceStored({
        runtime,
        principal: directPrincipal,
        legacyReportId: "tw-report-diagnostic",
        content: new TextEncoder().encode(
          "Synthetic source-transition attestation diagnostic bytes.",
        ),
      });
      assert.equal(prepared.ingestion.state, "SOURCE_STORED_AND_VERIFIED");
    });

    let auditPersistenceDiagnostic:
      | {
          readonly digitRun: Readonly<Record<string, boolean>>;
          readonly prismaCode: string | null;
          readonly refsOnlyConstraint: boolean;
        }
      | null = null;
    let pendingIngestionUpdate: Record<string, unknown> | null = null;
    let ingestionUpdateDiagnostic:
      | {
          readonly comparedKeys: readonly string[];
          readonly mismatchKeys: readonly string[];
          readonly expectedSubsetSha256: string;
          readonly readbackSubsetSha256: string;
        }
      | null = null;
    runtime.writer.$use(async (params, next) => {
      const model = String(params.model ?? "");
      if (model === "ReportIngestion" && params.action === "updateMany") {
        const result = await next(params);
        pendingIngestionUpdate = {
          ...((params.args?.data ?? {}) as Record<string, unknown>),
        };
        return result;
      }
      if (
        model === "ReportIngestion" &&
        params.action === "findUnique" &&
        pendingIngestionUpdate
      ) {
        const result = await next(params);
        const expected = pendingIngestionUpdate;
        pendingIngestionUpdate = null;
        const row = (result ?? {}) as Record<string, unknown>;
        const comparedKeys = Object.keys(expected).sort();
        const expectedSubset = Object.fromEntries(
          comparedKeys.map((key) => [key, diagnosticCanonical(expected[key])]),
        );
        const readbackSubset = Object.fromEntries(
          comparedKeys.map((key) => [key, diagnosticCanonical(row[key])]),
        );
        const mismatchKeys = comparedKeys.filter(
          (key) =>
            JSON.stringify(expectedSubset[key]) !==
            JSON.stringify(readbackSubset[key]),
        );
        ingestionUpdateDiagnostic = Object.freeze({
          comparedKeys: Object.freeze(comparedKeys),
          mismatchKeys: Object.freeze(mismatchKeys),
          expectedSubsetSha256: sha256(JSON.stringify(expectedSubset)),
          readbackSubsetSha256: sha256(JSON.stringify(readbackSubset)),
        });
        return result;
      }
      if (
        model !== "P0SensitiveAccessEvent" ||
        params.action !== "create"
      ) {
        return next(params);
      }
      const data = (params.args?.data ?? {}) as Record<string, unknown>;
      try {
        return await next(params);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { readonly code?: unknown }).code ?? "")
            : "";
        auditPersistenceDiagnostic = Object.freeze({
          digitRun: Object.freeze(
            Object.fromEntries(
              [
                "eventKey",
                "correlationId",
                "actorId",
                "authorizationVersion",
                "resourceId",
              ].map((key) => [
                key,
                typeof data[key] === "string" && /[0-9]{9}/.test(data[key]),
              ]),
            ),
          ),
          prismaCode: code || null,
          refsOnlyConstraint:
            /P0SensitiveAccessEvent_refs_only_ck/.test(message) ||
            /refs.only/i.test(message),
        });
        throw error;
      }
    });

    const hook = createP0TrustedWriterPrismaUploadHook({
      client: runtime.writer,
      mode: "PRE_ACTIVATION_ATTESTATION",
      principalDependencies: runtime.principalDependencies,
      workerConfiguration: runtime.workerConfiguration,
      valueProtection: runtime.valueProtection,
      resolveReadinessEvidence: () => runtime.readiness,
    });
    const directBytes = new TextEncoder().encode(
      "Synthetic Equifax report with exact source bytes and no consumer PII.",
    );
    runtime.session.actorId = directScope.tenantId;
    const beforeUpload = await durableCounts(runtime);
    const directUpload = await withP0DisposableTrustedWriterUploadHook({
      hook,
      async execute() {
        assert.equal(createP0ProductionTrustedWriterUploadHook(), hook);
        const installed = createP0ProductionTrustedWriterUploadHook();
        assert(installed);
        return installed.dispatch({
          legacyReportId: "tw-report-direct",
          bureauSelectors: ["EXPERIAN", "TRANSUNION"],
          sources: [
            {
              kind: "ORIGINAL_TEXT",
              mimeType: "text/plain",
              content: directBytes,
              sha256: "f".repeat(64),
              authorityStatus: "PRESENT",
            } as never,
          ],
        });
      },
    });
    assert.equal(createP0ProductionTrustedWriterUploadHook(), null);
    const routeRow = await runtime.admin.reportIngestion.findFirst({
      where: {
        tenantId: directScope.tenantId,
        consumerId: directScope.consumerId,
        reportSeriesKey: deriveP0ReportSeriesKey("tw-report-direct"),
      },
      select: {
        id: true,
        state: true,
        revision: true,
        attemptCount: true,
        sourceStorageProviderKey: true,
        sourceReadbackSha256: true,
        reportVersionId: true,
        sourceArtifactId: true,
      },
    });
    assert.equal(
      directUpload.kind,
      "ACCEPTED",
      JSON.stringify({
        routeResult: directUpload,
        durableStage: routeRow,
        auditPersistenceDiagnostic,
        ingestionUpdateDiagnostic,
        reportVersionCount: await runtime.admin.reportVersion.count({
          where: { sourceReportId: "tw-report-direct" },
        }),
      }),
    );
    assert(routeRow);
    const routeIngestion = await readIngestion(
      runtime,
      directPrincipal,
      routeRow.id,
    );
    assert.equal(routeIngestion.state, "VERSION_COMMITTED");
    const afterUpload = await durableCounts(runtime);

    await attack({
      number: 1,
      name: "forged authoritative status",
      setup: "real callback-scoped route, authenticated direct principal, synthetic report",
      attack: "caller supplied authorityStatus=PRESENT",
      expected: "field ignored; only SHADOW_V2 report authority persisted",
      async run() {
        const row = await runtime.admin.reportVersion.findUnique({
          where: { id: routeIngestion.reportVersionId! },
          select: { authorityStatus: true },
        });
        return {
          observed: `route=${directUpload.kind}; authority=${row?.authorityStatus}`,
          durableResult: `ReportVersion=${row?.authorityStatus}; extractionRuns=0`,
          pass:
            row?.authorityStatus === "SHADOW_V2" &&
            afterUpload.extractionRuns === beforeUpload.extractionRuns,
        };
      },
    });

    await attack({
      number: 2,
      name: "forged digest",
      setup: "same real upload carried a caller sha256 of all f",
      attack: "caller attempted to replace digest authority",
      expected: "server recomputes SHA-256 from exact source bytes",
      async run() {
        const [ingestionRow, sourceRow] = await Promise.all([
          runtime.admin.reportIngestion.findUnique({
            where: { id: routeIngestion.id },
            select: { sourceSha256: true },
          }),
          runtime.admin.p0SourceObject.findFirst({
            where: {
              tenantId: directScope.tenantId,
              consumerId: directScope.consumerId,
              ingestionId: routeIngestion.id,
              kind: "ORIGINAL_TEXT",
            },
            select: { sha256: true },
          }),
        ]);
        const expected = sha256(directBytes);
        return {
          observed: `ingestion=${ingestionRow?.sourceSha256}; object=${sourceRow?.sha256}`,
          durableResult: `both digests equal server digest ${expected}`,
          pass:
            ingestionRow?.sourceSha256 === expected &&
            sourceRow?.sha256 === expected &&
            expected !== "f".repeat(64),
        };
      },
    });

    await attack({
      number: 3,
      name: "cross-tenant report/version identifier",
      setup: "direct consumer authenticated; other consumer owns selected legacy report",
      attack: "dispatch tw-report-other under the direct-consumer session",
      expected: "authenticated-principal/scope denial and no durable P0 row",
      async run() {
        runtime.session.actorId = directScope.tenantId;
        const before = await durableCounts(runtime);
        const result = await hook.dispatch({
          legacyReportId: "tw-report-other",
          bureauSelectors: ["TRANSUNION"],
          sources: [
            {
              kind: "ORIGINAL_TEXT",
              mimeType: "text/plain",
              content: new TextEncoder().encode("Cross tenant synthetic attempt."),
            },
          ],
        });
        const after = await durableCounts(runtime);
        return {
          observed:
            result.kind === "FAILED"
              ? `${result.kind}:${result.safeCode}`
              : result.kind,
          durableResult: `ingestions ${before.ingestions}->${after.ingestions}; versions ${before.reportVersions}->${after.reportVersions}`,
          pass:
            result.kind === "FAILED" &&
            after.ingestions === before.ingestions &&
            after.reportVersions === before.reportVersions,
        };
      },
    });

    const graphBytes = new TextEncoder().encode(
      "Synthetic Equifax graph report with historical evidence and exact source bytes.",
    );
    const preparedGraph = await prepareSourceStored({
      runtime,
      principal: directPrincipal,
      legacyReportId: "tw-report-graph",
      content: graphBytes,
    });
    const graphCommitAuthority = await workerAuthority(
      runtime,
      preparedGraph.ingestion.id,
      "COMMIT_VERSION",
    );
    const exactReportVersionInput = Object.freeze({
      principal: graphCommitAuthority.principal,
      gatePermit: graphCommitAuthority.permit,
      operationId: graphCommitAuthority.operationId,
      ingestion: preparedGraph.ingestion,
      legacyReportId: "tw-report-graph",
      sourceReceipt: preparedGraph.receipt,
    });
    const exactReportVersion =
      await runtime.reportVersionRepository.commitExact(
        exactReportVersionInput,
      );
    assert(
      exactReportVersion.kind === "CREATED" ||
        exactReportVersion.kind === "IDEMPOTENT_REPLAY",
      JSON.stringify(exactReportVersion),
    );
    const graphVersionTransition = await runtime.ingestionService.transition({
      principal: graphCommitAuthority.principal,
      gatePermit: graphCommitAuthority.permit,
      ingestionId: preparedGraph.ingestion.id,
      operationId: graphCommitAuthority.operationId,
      expectedRevision: preparedGraph.ingestion.revision,
      leaseToken: preparedGraph.ingestion.leaseToken!,
      to: "VERSION_COMMITTED",
      reportVersionReceipt: exactReportVersion.attestation,
    });
    assert(graphVersionTransition.ok, JSON.stringify(graphVersionTransition));
    const initialIngestion = preparedGraph.ingestion;
    const versionCommitted = graphVersionTransition.ingestion;

    const extracted = await extractP0ReportSource({
      content: graphBytes,
      declaredMimeType: "text/plain",
      fileName: "synthetic-graph.txt",
    });
    assert(extracted.ok);
    const normalized = await storeNormalizedInput({
      runtime,
      ingestion: versionCommitted,
      content: extracted.value.normalizedText,
    });
    const extractionAuthority = await workerAuthority(
      runtime,
      versionCommitted.id,
      "EXTRACT",
    );

    await attack({
      number: 4,
      name: "correct tenant plus wrong ReportVersion",
      setup: "valid worker, exact normalized receipt, real extraction-input repository",
      attack: "substitute a different ReportVersion id in the ingestion snapshot",
      expected: "DENIED before Artifact creation",
      async run() {
        const before = await runtime.admin.artifact.count();
        const result = await runtime.extractionInputRepository.commitExact({
          principal: extractionAuthority.principal,
          gatePermit: extractionAuthority.permit,
          operationId: extractionAuthority.operationId,
          ingestion: {
            ...versionCommitted,
            reportVersionId: "p0rv_wrong_report_version",
          },
          reportVersionReceipt: exactReportVersion.attestation,
          inputReceipt: normalized.receipt,
        });
        const after = await runtime.admin.artifact.count();
        return {
          observed: `${result.kind}:${"code" in result ? result.code : "unexpected"}`,
          durableResult: `Artifact count ${before}->${after}`,
          pass: result.kind === "DENIED" && after === before,
        };
      },
    });

    await attack({
      number: 5,
      name: "correct report plus wrong source identity",
      setup: "captured exact real ReportVersion commit call",
      attack: "replace its branded original-source receipt with branded normalized source",
      expected: "DENIED; existing ReportVersion remains exact and singular",
      async run() {
        const before = await runtime.admin.reportVersion.count();
        const result = await runtime.reportVersionRepository.commitExact({
          ...exactReportVersionInput,
          sourceReceipt: normalized.receipt,
        });
        const after = await runtime.admin.reportVersion.count();
        return {
          observed: `${result.kind}:${"code" in result ? result.code : "unexpected"}`,
          durableResult: `ReportVersion count ${before}->${after}`,
          pass: result.kind === "DENIED" && after === before,
        };
      },
    });

    const normalizedCommit = await runtime.extractionInputRepository.commitExact({
      principal: extractionAuthority.principal,
      gatePermit: extractionAuthority.permit,
      operationId: extractionAuthority.operationId,
      ingestion: versionCommitted,
      reportVersionReceipt: exactReportVersion.attestation,
      inputReceipt: normalized.receipt,
    });
    assert(
      normalizedCommit.kind === "CREATED" ||
        normalizedCommit.kind === "IDEMPOTENT_REPLAY",
      JSON.stringify(normalizedCommit),
    );
    const extractingTransition = await runtime.ingestionService.transition({
      principal: extractionAuthority.principal,
      gatePermit: extractionAuthority.permit,
      ingestionId: versionCommitted.id,
      operationId: extractionAuthority.operationId,
      expectedRevision: versionCommitted.revision,
      leaseToken: versionCommitted.leaseToken!,
      to: "EXTRACTING",
      extractionInputReceipt: normalized.receipt,
    });
    assert(extractingTransition.ok, JSON.stringify(extractingTransition));
    const extracting = extractingTransition.ingestion;
    const defaultGraphFixture = Object.freeze({
      ingestion: extracting,
      inputReceipt: normalized.receipt,
      reportVersionReceipt: exactReportVersion.attestation,
    });
    const prepareIndependentGraphFixture = async (
      legacyReportId: string,
      content: Uint8Array,
    ) => {
      const prepared = await prepareSourceStored({
        runtime,
        principal: directPrincipal,
        legacyReportId,
        content,
      });
      const commitAuthority = await workerAuthority(
        runtime,
        prepared.ingestion.id,
        "COMMIT_VERSION",
      );
      const committed = await runtime.reportVersionRepository.commitExact({
        principal: commitAuthority.principal,
        gatePermit: commitAuthority.permit,
        operationId: commitAuthority.operationId,
        ingestion: prepared.ingestion,
        legacyReportId,
        sourceReceipt: prepared.receipt,
      });
      assert(
        committed.kind === "CREATED" ||
          committed.kind === "IDEMPOTENT_REPLAY",
        JSON.stringify(committed),
      );
      const versionTransition = await runtime.ingestionService.transition({
        principal: commitAuthority.principal,
        gatePermit: commitAuthority.permit,
        ingestionId: prepared.ingestion.id,
        operationId: commitAuthority.operationId,
        expectedRevision: prepared.ingestion.revision,
        leaseToken: prepared.ingestion.leaseToken!,
        to: "VERSION_COMMITTED",
        reportVersionReceipt: committed.attestation,
      });
      assert(versionTransition.ok, JSON.stringify(versionTransition));
      const extractedSource = await extractP0ReportSource({
        content,
        declaredMimeType: "text/plain",
        fileName: `${legacyReportId}.txt`,
      });
      assert(extractedSource.ok);
      const normalizedInput = await storeNormalizedInput({
        runtime,
        ingestion: versionTransition.ingestion,
        content: extractedSource.value.normalizedText,
      });
      const authority = await workerAuthority(
        runtime,
        versionTransition.ingestion.id,
        "EXTRACT",
      );
      const inputCommit = await runtime.extractionInputRepository.commitExact({
        principal: authority.principal,
        gatePermit: authority.permit,
        operationId: authority.operationId,
        ingestion: versionTransition.ingestion,
        reportVersionReceipt: committed.attestation,
        inputReceipt: normalizedInput.receipt,
      });
      assert(
        inputCommit.kind === "CREATED" ||
          inputCommit.kind === "IDEMPOTENT_REPLAY",
        JSON.stringify(inputCommit),
      );
      const extractionTransition = await runtime.ingestionService.transition({
        principal: authority.principal,
        gatePermit: authority.permit,
        ingestionId: versionTransition.ingestion.id,
        operationId: authority.operationId,
        expectedRevision: versionTransition.ingestion.revision,
        leaseToken: versionTransition.ingestion.leaseToken!,
        to: "EXTRACTING",
        extractionInputReceipt: normalizedInput.receipt,
      });
      assert(extractionTransition.ok, JSON.stringify(extractionTransition));
      return Object.freeze({
        ingestion: extractionTransition.ingestion,
        inputReceipt: normalizedInput.receipt,
        reportVersionReceipt: committed.attestation,
      });
    };
    let capturedGraphInput:
      | Parameters<P0ShadowTruthGraphRepository["persistExact"]>[0]
      | null = null;
    const recordingGraphRepository: P0ShadowTruthGraphRepository = {
      async persistExact(input) {
        capturedGraphInput = input;
        return runtime.graphRepository.persistExact(input);
      },
    };
    const shadowService = createP0ShadowExtractionService({
      repository: recordingGraphRepository,
      protector: createP0TrustedShadowValueProtector(runtime.valueProtection),
    });
    const runGraph = async (
      presence: "PRESENT" | "UNKNOWN" | "ABSENT_CONFIRMED",
      label: string,
      fixture: typeof defaultGraphFixture = defaultGraphFixture,
    ) => {
      const authority = await workerAuthority(runtime, fixture.ingestion.id, "EXTRACT");
      const candidate = parserEnvelope(fixture.inputReceipt, presence);
      const envelope = verifyP0ParserShadowEnvelope(candidate);
      assert(envelope, `${presence} parser envelope was malformed`);
      const parserReceipt = signParserExecution({
        runtime,
        envelope,
        scope: p0ScopeFromPrincipal(authority.principal),
        operationId: authority.operationId,
        ingestionId: fixture.ingestion.id,
        reportVersionId: fixture.ingestion.reportVersionId!,
      });
      assert(parserReceipt, `${presence} parser receipt denied`);
      return {
        authority,
        envelope,
        parserReceipt,
        result: await shadowService.persist({
          principal: authority.principal,
          gatePermit: authority.permit,
          ingestion: fixture.ingestion,
          reportVersionReceipt: fixture.reportVersionReceipt,
          inputReceipt: fixture.inputReceipt,
          envelope,
          parserExecutionReceipt: parserReceipt,
          operationId: authority.operationId,
          now: new Date(),
        }),
        label,
      };
    };

    await attack({
      number: 6,
      name: "ABSENT_CONFIRMED authority escalation",
      setup: "real normalized Artifact/source object and signed accepted parser execution",
      attack: "parser attempts source membership from ABSENT_CONFIRMED account presence",
      expected: "fail closed with no ExtractionRun or ReportVersionAccount",
      async run() {
        const before = await durableCounts(runtime);
        const attempted = await runGraph("ABSENT_CONFIRMED", "absent-escalation");
        const after = await durableCounts(runtime);
        return {
          observed: attempted.result.ok
            ? attempted.result.kind
            : `${attempted.result.kind}:${attempted.result.code}`,
          durableResult: `runs ${before.extractionRuns}->${after.extractionRuns}; memberships ${before.reportAccounts}->${after.reportAccounts}`,
          pass:
            !attempted.result.ok &&
            after.extractionRuns === before.extractionRuns &&
            after.reportAccounts === before.reportAccounts,
        };
      },
    });

    let unknownGraph: Awaited<ReturnType<typeof runGraph>> | null = null;
    await attack({
      number: 7,
      name: "unrecognized account to confirmed authority",
      setup: "real graph persists parser-uncertain UNKNOWN account presence",
      attack: "request Round 0 account-review authority for that UNKNOWN member",
      expected: "source review read is null and no consumer review receipt exists",
      async run() {
        const beforeReviews = await runtime.admin.consumerAccountReviewReceipt.count();
        const unknownFixture = await prepareIndependentGraphFixture(
          "tw-report-graph-unknown",
          new TextEncoder().encode(
            "Synthetic independent UNKNOWN account graph source.",
          ),
        );
        unknownGraph = await runGraph(
          "UNKNOWN",
          "unknown-account",
          unknownFixture,
        );
        assert(unknownGraph.result.ok, JSON.stringify(unknownGraph.result));
        const batch = unknownGraph.result.value;
        const source = await runtime.round0Repositories.accountReview
          .readRound0AccountReviewSource({
            principal: directPrincipal,
            scope: directScope,
            purpose: "ROUND0_ACCOUNT_REVIEW_SOURCE_READ",
            identityBaselineId: batch.identityBaselines[0]!.id,
            baselineInputSetSha256: batch.identityBaselines[0]!.inputSetSha256,
            reportVersionAccountId: batch.reportAccounts[0]!.id,
            bureau: batch.accountPresence[0]!.bureau,
          });
        const afterReviews = await runtime.admin.consumerAccountReviewReceipt.count();
        return {
          observed: `graph=${unknownGraph.result.kind}; reviewSource=${source === null ? "DENIED" : "UNEXPECTED"}`,
          durableResult: `ConsumerAccountReviewReceipt ${beforeReviews}->${afterReviews}`,
          pass: source === null && afterReviews === beforeReviews,
        };
      },
    });

    const exactReplayPermit = await gatePermit(
      runtime,
      directPrincipal,
      initialIngestion.operationKey,
    );
    const exactReservation = {
      principal: directPrincipal,
      gatePermit: exactReplayPermit,
      idempotencyKey: initialIngestion.idempotencyKey,
      operationKey: initialIngestion.operationKey,
      reportSeriesKey: initialIngestion.reportSeriesKey,
      reservedVersion: initialIngestion.reservedVersion,
      sourceSha256: initialIngestion.sourceSha256,
      sourceByteLength: initialIngestion.sourceByteLength,
      sourceDeclaredMimeType: initialIngestion.sourceDeclaredMimeType,
      sourceDetectedMimeType: initialIngestion.sourceDetectedMimeType,
      maxAttempts: initialIngestion.maxAttempts,
    } as const;

    await attack({
      number: 8,
      name: "retry changes evidence semantics",
      setup: "existing durable ingestion and original idempotency identity",
      attack: "same idempotency/operation with a substituted source digest",
      expected: "IDEMPOTENCY_CONFLICT and no additional durable row",
      async run() {
        const before = await runtime.admin.reportIngestion.count();
        const result = await runtime.ingestionService.reserve({
          ...exactReservation,
          sourceSha256: "e".repeat(64),
        });
        const after = await runtime.admin.reportIngestion.count();
        return {
          observed: result.ok ? result.kind : `${result.kind}:${result.code}`,
          durableResult: `ReportIngestion ${before}->${after}`,
          pass:
            !result.ok &&
            result.kind === "CONFLICT" &&
            after === before,
        };
      },
    });

    await attack({
      number: 9,
      name: "duplicate/replayed writer request",
      setup: "same exact reservation and server-derived digest",
      attack: "replay the original reserve operation",
      expected: "explicit IDEMPOTENT_REPLAY with one durable ingestion",
      async run() {
        const before = await runtime.admin.reportIngestion.count();
        const result = await runtime.ingestionService.reserve(exactReservation);
        const after = await runtime.admin.reportIngestion.count();
        return {
          observed: result.ok ? result.kind : `${result.kind}:${result.code}`,
          durableResult: `ReportIngestion ${before}->${after}`,
          pass:
            result.ok &&
            result.kind === "IDEMPOTENT_REPLAY" &&
            after === before,
        };
      },
    });

    await attack({
      number: 10,
      name: "worker race",
      setup: "one real RECEIVED ingestion and two worker tokens pinned to revision 1",
      attack: "concurrent real repository claims",
      expected: "exactly one claim wins; durable attemptCount=1 and one lease",
      async run() {
        const operationKey = `raceop_${sha256("tw-race-operation").slice(0, 40)}`;
        const raceBytes = new TextEncoder().encode("Synthetic race source bytes.");
        const reserve = await runtime.ingestionService.reserve({
          principal: directPrincipal,
          gatePermit: await gatePermit(runtime, directPrincipal, operationKey),
          idempotencyKey: `raceidem_${sha256("tw-race-idempotency").slice(0, 40)}`,
          operationKey,
          reportSeriesKey: deriveP0ReportSeriesKey("tw-report-race"),
          reservedVersion: 1,
          sourceSha256: sha256(raceBytes),
          sourceByteLength: raceBytes.byteLength,
          sourceDeclaredMimeType: "text/plain",
          sourceDetectedMimeType: "text/plain",
          maxAttempts: 3,
        });
        assert(reserve.ok, JSON.stringify(reserve));
        const [a, b] = await Promise.all([
          workerAuthority(runtime, reserve.ingestion.id, "CLAIM"),
          workerAuthority(runtime, reserve.ingestion.id, "CLAIM"),
        ]);
        const results = await Promise.all([
          runtime.ingestionService.claim({
            principal: a.principal,
            gatePermit: a.permit,
            ingestionId: reserve.ingestion.id,
            operationId: a.operationId,
            leaseMs: 60_000,
          }),
          runtime.ingestionService.claim({
            principal: b.principal,
            gatePermit: b.permit,
            ingestionId: reserve.ingestion.id,
            operationId: b.operationId,
            leaseMs: 60_000,
          }),
        ]);
        const row = await runtime.admin.reportIngestion.findUnique({
          where: { id: reserve.ingestion.id },
          select: { attemptCount: true, leaseToken: true, revision: true },
        });
        const winners = results.filter((result) => result.ok).length;
        return {
          observed: results
            .map((result) => (result.ok ? result.kind : `${result.kind}:${result.code}`))
            .join(","),
          durableResult: `attemptCount=${row?.attemptCount}; revision=${row?.revision}; lease=${Boolean(row?.leaseToken)}`,
          pass:
            winners === 1 &&
            row?.attemptCount === 1 &&
            row.revision === 2 &&
            Boolean(row.leaseToken),
        };
      },
    });

    await attack({
      number: 11,
      name: "partial transaction failure",
      setup: "real writer-role Prisma transaction on a fresh valid scope",
      attack: "insert scope then throw before commit",
      expected: "rollback leaves no CreditTruthScope",
      async run() {
        let observed = "";
        try {
          await runtime.writer.$transaction(async (transaction) => {
            await (
              transaction as unknown as Pick<
                P0ExactCurrentDelegates,
                "creditTruthScope"
              >
            ).creditTruthScope.create({
              data: {
                tenantId: "tw-rollback-consumer",
                consumerId: "tw-rollback-consumer",
              },
            });
            throw new Error("synthetic bounded rollback");
          });
          observed = "unexpected commit";
        } catch (error) {
          observed = error instanceof Error ? error.message : "rollback error";
        }
        const count = await runtime.admin.creditTruthScope.count({
          where: {
            tenantId: "tw-rollback-consumer",
            consumerId: "tw-rollback-consumer",
          },
        });
        return {
          observed,
          durableResult: `CreditTruthScope count=${count}`,
          pass: /synthetic bounded rollback/.test(observed) && count === 0,
        };
      },
    });

    await attack({
      number: 12,
      name: "direct repository invocation bypassing API validation",
      setup: "verified direct principal plus its genuine gate permit",
      attack: "invoke ingestion repository with a cross-tenant context/resource",
      expected: "repository DENIED before persistence",
      async run() {
        const before = await runtime.admin.reportIngestion.count();
        const result = await runtime.ingestionRepository.createExact(
          {
            principal: directPrincipal,
            scope: {
              tenantId: "tw-other-consumer",
              consumerId: "tw-other-consumer",
            },
            purpose: "INGESTION_RESERVE",
            operationId: initialIngestion.operationKey,
            gatePermit: exactReplayPermit,
          },
          {
            resourceType: "REPORT_INGESTION",
            resourceId: initialIngestion.id,
            resourceVersion: "state-v1",
          },
          initialIngestion,
        );
        const after = await runtime.admin.reportIngestion.count();
        return {
          observed: result.kind,
          durableResult: `ReportIngestion ${before}->${after}`,
          pass: result.kind === "DENIED" && after === before,
        };
      },
    });

    await attack({
      number: 13,
      name: "raw SQL/helper bypass",
      setup: "real writer role and a sealed UNKNOWN extraction source set",
      attack: "raw INSERT of an extra SOURCE_LISTED ReportVersionAccount",
      expected: "database role/semantic trigger rejects and transaction rolls back",
      async run() {
        assert(unknownGraph?.result.ok);
        const member = unknownGraph.result.value.reportAccounts[0]!;
        const before = await runtime.admin.reportVersionAccount.count();
        let denied = false;
        let observed = "";
        try {
          await runtime.writer.$executeRawUnsafe(
            'INSERT INTO "ReportVersionAccount" ("id","tenantId","consumerId","reportVersionId","accountId","sourceAccountOrdinal","membershipOrigin","authorityStatus") VALUES ($1,$2,$3,$4,$5,$6,CAST($7 AS "ReportAccountMembershipOrigin"),CAST($8 AS "TruthAuthorityStatus"))',
            "tw-raw-extra-membership",
            member.tenantId,
            member.consumerId,
            member.reportVersionId,
            member.accountId,
            99,
            "SOURCE_LISTED",
            "SHADOW_V2",
          );
          observed = "unexpected insert";
        } catch (error) {
          denied = true;
          observed = error instanceof Error ? error.name : "database denial";
        }
        const after = await runtime.admin.reportVersionAccount.count();
        return {
          observed,
          durableResult: `ReportVersionAccount ${before}->${after}`,
          pass: denied && after === before,
        };
      },
    });

    const verifiedPresentEnvelope = verifyP0ParserShadowEnvelope(
      parserEnvelope(normalized.receipt, "PRESENT"),
    );
    assert(verifiedPresentEnvelope);

    await attack({
      number: 14,
      name: "stale parser result",
      setup: "valid signed parser identity and exact real extraction source",
      attack: "receipt was issued and expired in the past",
      expected: "receipt verifier and graph service fail closed; no run persists",
      async run() {
        const authority = await workerAuthority(runtime, extracting.id, "EXTRACT");
        const now = Date.now();
        const receipt = signParserExecution({
          runtime,
          envelope: verifiedPresentEnvelope,
          scope: p0ScopeFromPrincipal(authority.principal),
          operationId: authority.operationId,
          ingestionId: extracting.id,
          reportVersionId: extracting.reportVersionId!,
          issuedAt: new Date(now - 120_000).toISOString(),
          expiresAt: new Date(now - 60_000).toISOString(),
        });
        assert.equal(receipt, null);
        const before = await runtime.admin.extractionRun.count();
        const result = await shadowService.persist({
          principal: authority.principal,
          gatePermit: authority.permit,
          ingestion: extracting,
          reportVersionReceipt: exactReportVersion.attestation,
          inputReceipt: normalized.receipt,
          envelope: verifiedPresentEnvelope,
          parserExecutionReceipt: receipt as never,
          operationId: authority.operationId,
          now: new Date(),
        });
        const after = await runtime.admin.extractionRun.count();
        return {
          observed: result.ok ? result.kind : `${result.kind}:${result.code}`,
          durableResult: `ExtractionRun ${before}->${after}`,
          pass:
            !result.ok &&
            result.code === "UNVERIFIED_TRUSTED_PARSER_EXECUTION" &&
            after === before,
        };
      },
    });

    await attack({
      number: 15,
      name: "parser/source hash mismatch",
      setup: "exact source envelope and accepted deployment parser identity",
      attack: "signed candidate substitutes the normalized source SHA-256",
      expected: "parser receipt verifier returns null and no graph persists",
      async run() {
        const authority = await workerAuthority(runtime, extracting.id, "EXTRACT");
        const receipt = signParserExecution({
          runtime,
          envelope: verifiedPresentEnvelope,
          scope: p0ScopeFromPrincipal(authority.principal),
          operationId: authority.operationId,
          ingestionId: extracting.id,
          reportVersionId: extracting.reportVersionId!,
          mutate: (candidate) => ({
            ...candidate,
            sourceSha256: "c".repeat(64),
          }),
        });
        assert.equal(receipt, null);
        const before = await runtime.admin.extractionRun.count();
        const result = await shadowService.persist({
          principal: authority.principal,
          gatePermit: authority.permit,
          ingestion: extracting,
          reportVersionReceipt: exactReportVersion.attestation,
          inputReceipt: normalized.receipt,
          envelope: verifiedPresentEnvelope,
          parserExecutionReceipt: receipt as never,
          operationId: authority.operationId,
          now: new Date(),
        });
        const after = await runtime.admin.extractionRun.count();
        return {
          observed: result.ok ? result.kind : `${result.kind}:${result.code}`,
          durableResult: `ExtractionRun ${before}->${after}`,
          pass:
            !result.ok &&
            result.code === "UNVERIFIED_TRUSTED_PARSER_EXECUTION" &&
            after === before,
        };
      },
    });

    await attack({
      number: 16,
      name: "reanalysis over newer accepted source",
      setup: "real source-stored reserved version 1, then synthetic admin seeds version 2",
      attack: "real ReportVersion repository attempts stale version-1 commit",
      expected: "CONFLICT and no stale ReportVersion insertion",
      async run() {
        const reanalysisBytes = new TextEncoder().encode(
          "Synthetic stale reanalysis source bytes.",
        );
        const prepared = await prepareSourceStored({
          runtime,
          principal: directPrincipal,
          legacyReportId: "tw-report-reanalysis",
          content: reanalysisBytes,
        });
        await runtime.admin.reportVersion.create({
          data: {
            id: "tw-reanalysis-newer-version",
            tenantId: directScope.tenantId,
            consumerId: directScope.consumerId,
            sourceReportId: "tw-report-reanalysis",
            reportSeriesKey: prepared.ingestion.reportSeriesKey,
            version: 2,
            origin: "AUTHORIZED_REANALYSIS",
            reanalysisAuthorizationRef: "p0-reanalysis-auth:newer-version",
            authorityStatus: "SHADOW_V2",
            schemaVersion: "credit-truth-v2",
            inputSha256: "b".repeat(64),
            createdByActorId: "p0-disposable-worker",
          },
        });
        const authority = await workerAuthority(
          runtime,
          prepared.ingestion.id,
          "COMMIT_VERSION",
        );
        const before = await runtime.admin.reportVersion.count();
        const result = await runtime.reportVersionRepository.commitExact({
          principal: authority.principal,
          gatePermit: authority.permit,
          operationId: authority.operationId,
          ingestion: prepared.ingestion,
          legacyReportId: "tw-report-reanalysis",
          sourceReceipt: prepared.receipt,
        });
        const after = await runtime.admin.reportVersion.count();
        const staleId = await runtime.admin.reportVersion.findFirst({
          where: {
            tenantId: directScope.tenantId,
            consumerId: directScope.consumerId,
            reportSeriesKey: prepared.ingestion.reportSeriesKey,
            version: 1,
          },
        });
        return {
          observed: `${result.kind}:${"code" in result ? result.code : "unexpected"}`,
          durableResult: `ReportVersion ${before}->${after}; staleVersion1=${Boolean(staleId)}`,
          pass:
            result.kind === "CONFLICT" &&
            "code" in result &&
            result.code === "STALE_REPORT_VERSION" &&
            after === before &&
            staleId === null,
        };
      },
    });

    await attack({
      number: 17,
      name: "malformed/null provenance",
      setup: "exact real source and worker authority",
      attack: "authoritative inner report-date evidence carries null source provenance",
      expected: "envelope remains unverified and graph service rejects without persistence",
      async run() {
        const malformed = structuredClone(
          parserEnvelope(normalized.receipt, "PRESENT"),
        ) as any;
        malformed.bureauEvidence[0].reportDate.sourceLocator = null;
        const verified = verifyP0ParserShadowEnvelope(malformed);
        assert.equal(verified, null);
        const authority = await workerAuthority(runtime, extracting.id, "EXTRACT");
        const before = await runtime.admin.extractionRun.count();
        const result = await shadowService.persist({
          principal: authority.principal,
          gatePermit: authority.permit,
          ingestion: extracting,
          reportVersionReceipt: exactReportVersion.attestation,
          inputReceipt: normalized.receipt,
          envelope: malformed,
          parserExecutionReceipt: null as never,
          operationId: authority.operationId,
          now: new Date(),
        });
        const after = await runtime.admin.extractionRun.count();
        return {
          observed: result.ok ? result.kind : `${result.kind}:${result.code}`,
          durableResult: `ExtractionRun ${before}->${after}`,
          pass:
            !result.ok &&
            result.code === "UNVERIFIED_TRUSTED_PARSER_EXECUTION" &&
            after === before,
        };
      },
    });

    const positiveGraph = await runGraph("PRESENT", "positive-present");
    assert(positiveGraph.result.ok, JSON.stringify(positiveGraph.result));
    const positiveGraphResult = positiveGraph.result;
    assert(positiveGraphResult.ok);
    assert.equal(positiveGraphResult.value.extractionRun.status, "SUCCEEDED");
    assert.equal(positiveGraphResult.value.reportAccounts.length, 1);
    assert.equal(positiveGraphResult.value.accountPresence[0]?.presence, "PRESENT");
    assert.equal(positiveGraphResult.value.historicalEvidence.length, 3);
    assert.deepEqual(
      new Set(
        positiveGraphResult.value.historicalEvidence.map(
          (item) => item.evidenceType,
        ),
      ),
      new Set([
        "PAYMENT_DELINQUENCY",
        "FIRST_DELINQUENCY_DATE",
        "CHARGE_OFF",
      ]),
    );
    assert.equal(positiveGraphResult.value.creditScoreObservations.length, 1);

    await test(
      "durable graph rows preserve exact historical subtypes and score-model provenance",
      async () => {
        const scope = p0ScopeFromPrincipal(positiveGraph.authority.principal);
        const extractionRunId =
          positiveGraphResult.value.extractionRun.extractionRunId;
        const reportVersionId = positiveGraphResult.value.reportVersionId;
        const historical = await runtime.admin.historicalEvidence.findMany({
          where: {
            tenantId: scope.tenantId,
            consumerId: scope.consumerId,
            reportVersionId,
            extractionRunId,
          },
          select: {
            id: true,
            evidenceType: true,
            detailCiphertext: true,
            detailIv: true,
            detailAuthTag: true,
            detailKeyVersion: true,
            detailAlgorithm: true,
            detailEnvelopeVersion: true,
            detailAadVersion: true,
          },
          orderBy: { id: "asc" },
        });
        assert.equal(historical.length, 3);
        assert.deepEqual(
          historical.map((row) => row.evidenceType).sort(),
          ["CHARGE_OFF", "DELINQUENCY", "DELINQUENCY"],
        );
        const historicalKinds: string[] = [];
        for (const row of historical) {
          assert(row.detailCiphertext && row.detailIv && row.detailAuthTag);
          assert.equal(row.detailAlgorithm, "AES_256_GCM");
          assert.equal(
            row.detailEnvelopeVersion,
            "p0-production-shadow-value-v1",
          );
          assert.equal(row.detailAadVersion, "p0-shadow-row-aad-v1");
          assert.equal(typeof row.detailKeyVersion, "string");
          const aad = new TextEncoder().encode(
            JSON.stringify([
              "CreditVector/P0/shadow-value/v1",
              scope.tenantId,
              scope.consumerId,
              row.id,
            ]),
          );
          const protectedValue: P0TrustedWriterProtectedValue = {
            contractVersion: "p0-trusted-writer-value-protection-v1",
            ciphertext: new Uint8Array(row.detailCiphertext),
            iv: new Uint8Array(row.detailIv),
            authTag: new Uint8Array(row.detailAuthTag),
            algorithm: "AES_256_GCM",
            keyVersion: row.detailKeyVersion!,
            envelopeVersion: "p0-production-shadow-value-v1",
            aadVersion: "p0-shadow-row-aad-v1",
            aadSha256: sha256(aad),
          };
          const plaintext = await runtime.valueProtection.unprotect({
            protectedValue,
            aad,
            expectedEnvelopeVersion: "p0-production-shadow-value-v1",
            expectedAadVersion: "p0-shadow-row-aad-v1",
          });
          assert(plaintext);
          const detail = JSON.parse(new TextDecoder().decode(plaintext)) as {
            readonly kind?: string;
          };
          assert.equal(typeof detail.kind, "string");
          historicalKinds.push(detail.kind!);
        }
        assert.deepEqual(
          historicalKinds.sort(),
          ["CHARGE_OFF", "FIRST_DELINQUENCY_DATE", "PAYMENT_DELINQUENCY"],
        );

        const score = await runtime.admin.creditScoreObservation.findFirst({
          where: {
            tenantId: scope.tenantId,
            consumerId: scope.consumerId,
            reportVersionId,
            extractionRunId,
          },
          select: {
            id: true,
            presence: true,
            scoreCiphertext: true,
            scoreIv: true,
            scoreAuthTag: true,
            scoreKeyVersion: true,
            scoreAlgorithm: true,
            scoreEnvelopeVersion: true,
            scoreAadVersion: true,
            scoreModelPresence: true,
            scoreModelEvidenceValue: true,
            scoreModelSourceLocatorToken: true,
            scoreScaleMin: true,
            scoreScaleMax: true,
            modelMetadataCompleteness: true,
            sourceMethodKey: true,
            sourceMethodVersion: true,
            sourceLocatorToken: true,
          },
        });
        assert(score?.scoreCiphertext && score.scoreIv && score.scoreAuthTag);
        const expectedScore =
          positiveGraphResult.value.creditScoreObservations[0]!;
        assert.deepEqual(
          {
            presence: score.presence,
            scoreModelPresence: score.scoreModelPresence,
            scoreModelEvidenceValue: score.scoreModelEvidenceValue,
            scoreModelSourceLocatorToken: score.scoreModelSourceLocatorToken,
            scoreScaleMin: score.scoreScaleMin,
            scoreScaleMax: score.scoreScaleMax,
            modelMetadataCompleteness: score.modelMetadataCompleteness,
            sourceMethodKey: score.sourceMethodKey,
            sourceMethodVersion: score.sourceMethodVersion,
            sourceLocatorToken: score.sourceLocatorToken,
          },
          {
            presence: "SCORE_REPORTED",
            scoreModelPresence: expectedScore.scoreModelPresence,
            scoreModelEvidenceValue: expectedScore.scoreModelEvidenceValue,
            scoreModelSourceLocatorToken:
              expectedScore.scoreModelSourceLocatorToken,
            scoreScaleMin: expectedScore.scoreScaleMin,
            scoreScaleMax: expectedScore.scoreScaleMax,
            modelMetadataCompleteness: "PARTIAL",
            sourceMethodKey: expectedScore.sourceMethodKey,
            sourceMethodVersion: expectedScore.sourceMethodVersion,
            sourceLocatorToken: expectedScore.sourceLocatorToken,
          },
        );
        assert.equal(score.scoreAlgorithm, "AES_256_GCM");
        assert.equal(
          score.scoreEnvelopeVersion,
          "p0-production-shadow-value-v1",
        );
        assert.equal(score.scoreAadVersion, "p0-shadow-row-aad-v1");
        assert.equal(typeof score.scoreKeyVersion, "string");
        const scoreAad = new TextEncoder().encode(
          JSON.stringify([
            "CreditVector/P0/shadow-value/v1",
            scope.tenantId,
            scope.consumerId,
            score.id,
          ]),
        );
        const scorePlaintext = await runtime.valueProtection.unprotect({
          protectedValue: {
            contractVersion: "p0-trusted-writer-value-protection-v1",
            ciphertext: new Uint8Array(score.scoreCiphertext),
            iv: new Uint8Array(score.scoreIv),
            authTag: new Uint8Array(score.scoreAuthTag),
            algorithm: "AES_256_GCM",
            keyVersion: score.scoreKeyVersion!,
            envelopeVersion: "p0-production-shadow-value-v1",
            aadVersion: "p0-shadow-row-aad-v1",
            aadSha256: sha256(scoreAad),
          },
          aad: scoreAad,
          expectedEnvelopeVersion: "p0-production-shadow-value-v1",
          expectedAadVersion: "p0-shadow-row-aad-v1",
        });
        assert(scorePlaintext);
        assert.equal(JSON.parse(new TextDecoder().decode(scorePlaintext)), 704);
      },
    );

    await attack({
      number: 18,
      name: "source membership before authority exists",
      setup: "captured exact real graph batch and concrete graph repository",
      attack: "invoke repository directly with a reconstructed writer-authority object",
      expected: "DENIED because process-local authority brand/binding is absent",
      async run() {
        assert(capturedGraphInput);
        const before = await runtime.admin.extractionRun.count();
        const forgedAuthority = {
          ...capturedGraphInput.writerAuthority,
        } as VerifiedP0ShadowWriterAuthority;
        const result = await runtime.graphRepository.persistExact({
          ...capturedGraphInput,
          writerAuthority: forgedAuthority,
        });
        const after = await runtime.admin.extractionRun.count();
        return {
          observed: result.kind,
          durableResult: `ExtractionRun ${before}->${after}`,
          pass: result.kind === "DENIED" && after === before,
        };
      },
    });

    await attack({
      number: 19,
      name: "mutation of sealed evidence",
      setup: "persisted real PRESENT FieldObservation with immutable integrity digest",
      attack: "writer-role raw UPDATE attempts to replace integritySha256",
      expected: "database denies; persisted digest remains byte-for-byte unchanged",
      async run() {
        const observation = await runtime.admin.fieldObservation.findFirst({
          where: {
            tenantId: directScope.tenantId,
            consumerId: directScope.consumerId,
            extractionRunId:
              positiveGraphResult.value.extractionRun.extractionRunId,
          },
          select: { id: true, integritySha256: true },
        });
        assert(observation);
        let denied = false;
        let observed = "";
        try {
          await runtime.writer.$executeRawUnsafe(
            'UPDATE "FieldObservation" SET "integritySha256" = $1 WHERE "id" = $2',
            "d".repeat(64),
            observation.id,
          );
          observed = "unexpected update";
        } catch (error) {
          denied = true;
          observed = error instanceof Error ? error.name : "database denial";
        }
        const durable = await runtime.admin.fieldObservation.findUnique({
          where: { id: observation.id },
          select: { integritySha256: true },
        });
        return {
          observed,
          durableResult: `integritySha256 unchanged=${durable?.integritySha256 === observation.integritySha256}`,
          pass:
            denied &&
            durable?.integritySha256 === observation.integritySha256,
        };
      },
    });

    await attack({
      number: 20,
      name: "test/dev/admin helper runtime reachability",
      setup: "exact concrete hook exists only in callback-scoped disposable process state",
      attack: "switch runtime to production and construct disposable crypto/install hook",
      expected: "both paths throw or remain null; no durable write occurs",
      async run() {
        const before = await durableCounts(runtime);
        const prior = process.env.NODE_ENV;
        Reflect.set(process.env, "NODE_ENV", "production");
        let cryptoDenied = false;
        let installDenied = false;
        try {
          createDeterministicDisposableP0ValueProtectionAdapter({
            seed: "this-must-not-exist-in-production",
          });
        } catch {
          cryptoDenied = true;
        }
        try {
          await withP0DisposableTrustedWriterUploadHook({
            hook,
            execute: async () => undefined,
          });
        } catch {
          installDenied = true;
        }
        const factoryDenied = createP0ProductionTrustedWriterUploadHook() === null;
        if (prior === undefined) {
          Reflect.deleteProperty(process.env, "NODE_ENV");
        } else {
          Reflect.set(process.env, "NODE_ENV", prior);
        }
        const after = await durableCounts(runtime);
        return {
          observed: `cryptoDenied=${cryptoDenied}; installDenied=${installDenied}; factoryDenied=${factoryDenied}`,
          durableResult: `ingestions ${before.ingestions}->${after.ingestions}; versions ${before.reportVersions}->${after.reportVersions}`,
          pass:
            cryptoDenied &&
            installDenied &&
            factoryDenied &&
            after.ingestions === before.ingestions &&
            after.reportVersions === before.reportVersions,
        };
      },
    });

    assert.equal(attacksPassed, 20, "all twenty real-adapter attacks must execute");

    await privilegedBoundaryAttack({
      number: 1,
      name: "PUBLIC and application-writer direct routine invocation",
      attack: "directly SELECT every one of the exact 24 validators and four helpers",
      expected: "all 28 invocations are denied while registered triggers remain usable",
      async run() {
        const probeRole = "p0_validator_public_probe";
        const writerStates: string[] = [];
        const publicStates: string[] = [];
        await runtime.admin.$executeRawUnsafe(
          `CREATE ROLE "${probeRole}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`,
        );
        try {
          for (const routine of EXACT_PRIVILEGED_ROUTINES) {
            const sql =
              `SELECT public."${routine.name}"(${routine.directCallArguments})`;
            writerStates.push(
              await observedSqlState(runtime.writer, sql),
            );
            publicStates.push(
              await observedSqlStateAsRole(runtime.admin, probeRole, sql),
            );
          }
        } finally {
          await runtime.admin.$executeRawUnsafe(`DROP ROLE "${probeRole}"`);
        }
        const writerDenied = writerStates.filter(
          (state) => state === "42501",
        ).length;
        const publicDenied = publicStates.filter(
          (state) => state === "42501",
        ).length;
        return {
          observed:
            `writer=${writerDenied}/28 SQLSTATE 42501; ` +
            `public=${publicDenied}/28 SQLSTATE 42501; ` +
            `writerStates=${JSON.stringify([...new Set(writerStates)])}; ` +
            `publicStates=${JSON.stringify([...new Set(publicStates)])}`,
          durableResult: `route=${directUpload.kind}; graph=${positiveGraphResult.kind}`,
          pass:
            writerDenied === 28 &&
            publicDenied === 28 &&
            directUpload.kind === "ACCEPTED" &&
            positiveGraphResult.ok,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 2,
      name: "validator-owner impersonation and trigger-bypass session settings",
      attack:
        `application writer attempts SET ROLE ${validatorOwner} and ` +
        "SET session_replication_role=replica",
      expected:
        "role membership and parameter-privilege boundaries deny both paths; a fresh writer session remains origin",
      async run() {
        const setRoleState = await observedExecuteSqlState(
          runtime.writer,
          `SET ROLE "${validatorOwner}"`,
        );
        if (setRoleState === "ALLOWED") {
          await runtime.writer.$executeRawUnsafe("RESET ROLE");
        }
        const setReplicationRoleState = await observedExecuteSqlState(
          runtime.writer,
          "SET session_replication_role=replica",
        );
        const replicationRole = await runtime.writer.$queryRawUnsafe<
          Array<{ session_replication_role: string }>
        >("SHOW session_replication_role");
        const owner = await runtime.admin.$queryRawUnsafe<
          Array<{ rolcanlogin: boolean; is_member: boolean }>
        >(
          `SELECT owner.rolcanlogin,
                  pg_has_role($1, owner.oid, 'MEMBER') AS is_member
             FROM pg_roles owner
            WHERE owner.rolname = $2`,
          writerRole,
          validatorOwner,
        );
        const writerBoundary = await runtime.admin.$queryRawUnsafe<
          Array<{
            membership_count: bigint;
            role_setting_count: bigint;
            can_set_replication_role: boolean;
            can_alter_system_replication_role: boolean;
          }>
        >(
          `SELECT
             (SELECT COUNT(*)
                FROM pg_auth_members membership
               WHERE membership.member = writer.oid
                  OR membership.roleid = writer.oid) AS membership_count,
             (SELECT COUNT(*)
                FROM pg_db_role_setting settings
               WHERE settings.setrole = writer.oid) AS role_setting_count,
             has_parameter_privilege(writer.oid, 'session_replication_role', 'SET')
               AS can_set_replication_role,
             has_parameter_privilege(writer.oid, 'session_replication_role', 'ALTER SYSTEM')
               AS can_alter_system_replication_role
           FROM pg_roles writer
          WHERE writer.rolname = $1`,
          writerRole,
        );
        return {
          observed:
            `setRoleSqlState=${setRoleState}; ` +
            `setReplicationRoleSqlState=${setReplicationRoleState}; ` +
            `sessionReplicationRole=${replicationRole[0]?.session_replication_role}`,
          durableResult: JSON.stringify(
            diagnosticCanonical({ owner, writerBoundary }),
          ),
          pass:
            setRoleState === "42501" &&
            setReplicationRoleState === "42501" &&
            replicationRole[0]?.session_replication_role === "origin" &&
            owner.length === 1 &&
            owner[0]?.rolcanlogin === false &&
            owner[0]?.is_member === false &&
            writerBoundary.length === 1 &&
            writerBoundary[0]?.membership_count === 0n &&
            writerBoundary[0]?.role_setting_count === 0n &&
            writerBoundary[0]?.can_set_replication_role === false &&
            writerBoundary[0]?.can_alter_system_replication_role === false,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 3,
      name: "search_path and shadow-object poisoning",
      attack: "set a hostile search_path, create a temporary shadow table, and create a same-name public function",
      expected: "fixed function config remains exact and both substitute-object creations are denied",
      async run() {
        let poisonedInvocationState = "ALLOWED";
        try {
          await runtime.writer.$transaction(async (transaction) => {
            await transaction.$executeRawUnsafe(
              "SET LOCAL search_path = pg_temp, public, pg_catalog",
            );
            await transaction.$queryRawUnsafe(
              'SELECT public."p0_validate_report_account_subject"()',
            );
          });
        } catch (error) {
          poisonedInvocationState =
            exactDatabaseSqlState(error) ?? "UNKNOWN_DENIAL";
        }
        const tempShadowState = await observedExecuteSqlState(
          runtime.writer,
          'CREATE TEMP TABLE "ReportVersion" ("id" text)',
        );
        const functionShadowState = await observedExecuteSqlState(
          runtime.writer,
          `CREATE FUNCTION public.p0_validate_report_account_subject()
             RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$`,
        );
        const stable = await attestPrivilegedValidatorCatalog(
          runtime.admin,
          writerRole,
          validatorOwner,
          privilegedCatalog.manifestSha256,
        );
        return {
          observed: `poisonedCall=${poisonedInvocationState}; temp=${tempShadowState}; publicShadow=${functionShadowState}`,
          durableResult: `manifest=${stable.manifestSha256}`,
          pass:
            poisonedInvocationState === "42501" &&
            tempShadowState === "42501" &&
            functionShadowState === "42501",
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 4,
      name: "caller-controlled identifier injection",
      attack: "pass identifier-shaped SQL through a helper's text arguments",
      expected: "direct helper invocation is denied before any identifier can be resolved",
      async run() {
        const before = await durableCounts(runtime);
        const sqlState = await observedSqlState(
          runtime.writer,
          "SELECT public.p0_lock_extraction_run($1,$2,$3,$4)",
          'public."ReportVersion"; DROP TABLE public."ReportVersion";--',
          directScope.consumerId,
          extracting.reportVersionId!,
          positiveGraphResult.value.extractionRun.extractionRunId,
        );
        const after = await durableCounts(runtime);
        return {
          observed: `sqlState=${sqlState}`,
          durableResult: `versions ${before.reportVersions}->${after.reportVersions}`,
          pass:
            sqlState === "42501" &&
            after.reportVersions === before.reportVersions,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 5,
      name: "function-body drift",
      attack: "replace one validator body inside a rollback-only admin transaction",
      expected: "source-bound hash mismatch is detected and the original body survives rollback",
      async run() {
        const pass = await catalogDriftIsDetectedAndRolledBack({
          runtime,
          writerRole,
          ownerRole: validatorOwner,
          manifestSha256: privilegedCatalog.manifestSha256,
          label: "body",
          mutate: (transaction) =>
            transaction.$executeRawUnsafe(`
              CREATE OR REPLACE FUNCTION public.p0_validate_report_account_subject()
              RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
              SET search_path = pg_catalog, public, pg_temp
              AS $$ BEGIN RETURN NEW; END $$
            `),
        });
        return {
          observed: `detectedAndRolledBack=${pass}`,
          durableResult: `manifest=${privilegedCatalog.manifestSha256}`,
          pass,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 6,
      name: "function-owner drift",
      attack: "change one validator owner to the migration administrator inside a rollback-only transaction",
      expected: "exact dedicated-owner validation detects drift and rollback restores ownership",
      async run() {
        const pass = await catalogDriftIsDetectedAndRolledBack({
          runtime,
          writerRole,
          ownerRole: validatorOwner,
          manifestSha256: privilegedCatalog.manifestSha256,
          label: "owner",
          mutate: (transaction) =>
            transaction.$executeRawUnsafe(
              `ALTER FUNCTION public.p0_validate_report_account_subject() OWNER TO "${adminRole}"`,
            ),
        });
        return {
          observed: `detectedAndRolledBack=${pass}`,
          durableResult: `owner=${validatorOwner}`,
          pass,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 7,
      name: "fixed search_path configuration drift",
      attack: "remove pg_temp-last ordering inside a rollback-only transaction",
      expected: "exact single-element proconfig validation detects drift",
      async run() {
        const pass = await catalogDriftIsDetectedAndRolledBack({
          runtime,
          writerRole,
          ownerRole: validatorOwner,
          manifestSha256: privilegedCatalog.manifestSha256,
          label: "search-path",
          mutate: (transaction) =>
            transaction.$executeRawUnsafe(
              "ALTER FUNCTION public.p0_validate_report_account_subject() SET search_path = public, pg_catalog",
            ),
        });
        return {
          observed: `detectedAndRolledBack=${pass}`,
          durableResult: `searchPath=${EXACT_VALIDATOR_SEARCH_PATH[0]}`,
          pass,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 8,
      name: "function EXECUTE grant drift",
      attack: "grant direct validator execution to the writer inside a rollback-only transaction",
      expected: "exact ACL and effective-execute audits detect drift",
      async run() {
        const pass = await catalogDriftIsDetectedAndRolledBack({
          runtime,
          writerRole,
          ownerRole: validatorOwner,
          manifestSha256: privilegedCatalog.manifestSha256,
          label: "execute-acl",
          mutate: (transaction) =>
            transaction.$executeRawUnsafe(
              `GRANT EXECUTE ON FUNCTION public.p0_validate_report_account_subject() TO "${writerRole}"`,
            ),
        });
        return {
          observed: `detectedAndRolledBack=${pass}`,
          durableResult: "writer effective P0 EXECUTE set remains empty",
          pass,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 9,
      name: "unexpected differently named SECURITY DEFINER trigger",
      attack:
        "attach a non-p0 SECURITY DEFINER function as an authority-mutating trigger on ReportVersion inside a rollback-only transaction",
      expected:
        "the exact trusted-chain trigger catalog rejects the added edge regardless of function name or owner",
      async run() {
        const pass = await catalogDriftIsDetectedAndRolledBack({
          runtime,
          writerRole,
          ownerRole: validatorOwner,
          manifestSha256: privilegedCatalog.manifestSha256,
          label: "unexpected-authority-trigger",
          async mutate(transaction) {
            await transaction.$executeRawUnsafe(`
              CREATE FUNCTION public.tw_injected_authority()
              RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
              SET search_path = pg_catalog, public, pg_temp
              AS $$
              BEGIN
                NEW."authorityStatus" := 'AUTHORITATIVE_V2'::public."TruthAuthorityStatus";
                RETURN NEW;
              END
              $$
            `);
            await transaction.$executeRawUnsafe(`
              CREATE TRIGGER "tw_injected_authority_trg"
              BEFORE INSERT ON public."ReportVersion"
              FOR EACH ROW EXECUTE FUNCTION public.tw_injected_authority()
            `);
          },
        });
        return {
          observed: `detectedAndRolledBack=${pass}`,
          durableResult: "unexpected trigger and routine absent after rollback",
          pass,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 10,
      name: "existing invoker trigger-function body drift",
      attack:
        "replace the accepted append-only trigger function body inside a rollback-only transaction",
      expected:
        "the source-derived 37-function definition manifest detects body drift",
      async run() {
        const pass = await catalogDriftIsDetectedAndRolledBack({
          runtime,
          writerRole,
          ownerRole: validatorOwner,
          manifestSha256: privilegedCatalog.manifestSha256,
          label: "invoker-body",
          mutate: (transaction) =>
            transaction.$executeRawUnsafe(`
              CREATE OR REPLACE FUNCTION public.p0_forbid_immutable_mutation()
              RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
              AS $$ BEGIN RETURN NEW; END $$
            `),
        });
        return {
          observed: `detectedAndRolledBack=${pass}`,
          durableResult: "accepted invoker trigger function restored by rollback",
          pass,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 11,
      name: "registered-trigger linkage drift",
      attack: "disable one exact validator trigger inside a rollback-only transaction",
      expected: "canonical trigger manifest mismatch is detected",
      async run() {
        const pass = await catalogDriftIsDetectedAndRolledBack({
          runtime,
          writerRole,
          ownerRole: validatorOwner,
          manifestSha256: privilegedCatalog.manifestSha256,
          label: "trigger",
          mutate: (transaction) =>
            transaction.$executeRawUnsafe(
              'ALTER TABLE public."ReportVersionAccount" DISABLE TRIGGER "ReportVersionAccount_validate_subject_trg"',
            ),
        });
        return {
          observed: `detectedAndRolledBack=${pass}`,
          durableResult: "trigger re-enabled by rollback",
          pass,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 12,
      name: "validator-owner privilege drift",
      attack: "grant an extra non-lock UPDATE column inside a rollback-only transaction",
      expected: "exact 22 SELECT plus 16 UPDATE(id) matrix rejects the grant",
      async run() {
        const pass = await catalogDriftIsDetectedAndRolledBack({
          runtime,
          writerRole,
          ownerRole: validatorOwner,
          manifestSha256: privilegedCatalog.manifestSha256,
          label: "owner-privilege",
          mutate: (transaction) =>
            transaction.$executeRawUnsafe(
              `GRANT UPDATE ("authorityStatus") ON public."ReportVersion" TO "${validatorOwner}"`,
            ),
        });
        return {
          observed: `detectedAndRolledBack=${pass}`,
          durableResult: "owner privilege matrix restored",
          pass,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 13,
      name: "unrelated and Phase 2B mutation reachability",
      attack: "application writer attempts no-op UPDATEs on Correspondence and ReportDifference",
      expected: "both statements are denied and both durable row counts remain unchanged",
      async run() {
        const before = await runtime.admin.$queryRawUnsafe<
          Array<{ correspondence: bigint; differences: bigint }>
        >(
          `SELECT
             (SELECT COUNT(*) FROM public."Correspondence") AS correspondence,
             (SELECT COUNT(*) FROM public."ReportDifference") AS differences`,
        );
        const correspondenceState = await observedSqlState(
          runtime.writer,
          'UPDATE public."Correspondence" SET "id" = "id" WHERE false RETURNING "id"',
        );
        const differencesState = await observedSqlState(
          runtime.writer,
          'UPDATE public."ReportDifference" SET "id" = "id" WHERE false RETURNING "id"',
        );
        const after = await runtime.admin.$queryRawUnsafe<
          Array<{ correspondence: bigint; differences: bigint }>
        >(
          `SELECT
             (SELECT COUNT(*) FROM public."Correspondence") AS correspondence,
             (SELECT COUNT(*) FROM public."ReportDifference") AS differences`,
        );
        return {
          observed: `correspondence=${correspondenceState}; difference=${differencesState}`,
          durableResult: JSON.stringify(diagnosticCanonical({ before, after })),
          pass:
            correspondenceState === "42501" &&
            differencesState === "42501" &&
            JSON.stringify(diagnosticCanonical(before)) ===
              JSON.stringify(diagnosticCanonical(after)),
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 14,
      name: "application-writer broad UPDATE",
      attack: "attempt table-level UPDATE of immutable ReportVersion authority",
      expected: "database privilege boundary denies the statement and authority remains exact",
      async run() {
        const before = await runtime.admin.reportVersion.findUnique({
          where: { id: exactReportVersion.value.reportVersionId },
          select: { authorityStatus: true },
        });
        const sqlState = await observedSqlState(
          runtime.writer,
          'UPDATE public."ReportVersion" SET "authorityStatus" = CAST($1 AS "TruthAuthorityStatus") WHERE "id" = $2 RETURNING "id"',
          "AUTHORITATIVE_V2",
          exactReportVersion.value.reportVersionId,
        );
        const after = await runtime.admin.reportVersion.findUnique({
          where: { id: exactReportVersion.value.reportVersionId },
          select: { authorityStatus: true },
        });
        return {
          observed: `sqlState=${sqlState}`,
          durableResult: `${before?.authorityStatus}->${after?.authorityStatus}`,
          pass:
            sqlState === "42501" &&
            after?.authorityStatus === before?.authorityStatus,
        };
      },
    });

    await privilegedBoundaryAttack({
      number: 15,
      name: "readiness receipt privileged-manifest forgery",
      attack: "replace the deployment-controlled expected manifest hash after signing",
      expected: "server readiness loader rejects the otherwise valid signed envelope",
      async run() {
        const exact =
          process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256;
        process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256 =
          "0".repeat(64);
        const forged = loadP0TrustedWriterReadinessFromServerEnvironment();
        process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256 = exact;
        const restored = loadP0TrustedWriterReadinessFromServerEnvironment();
        return {
          observed: `forgedAccepted=${Boolean(forged)}; restored=${Boolean(restored)}`,
          durableResult: `manifest=${privilegedCatalog.manifestSha256}`,
          pass:
            forged === null &&
            restored !== null &&
            restored.privilegedValidatorManifestSha256 ===
              privilegedCatalog.manifestSha256,
        };
      },
    });

    assert.equal(
      privilegedBoundaryAttacksPassed,
      15,
      "all fifteen privileged-boundary attacks must execute",
    );

    await test(
      "post-write graph readback mismatch rolls back the entire real transaction",
      async () => {
        const fixture = await prepareIndependentGraphFixture(
          "tw-report-graph-readback-rollback",
          new TextEncoder().encode(
            "Synthetic graph readback mismatch rollback source bytes.",
          ),
        );
        const scope = directScope;
        const reportVersionId = fixture.ingestion.reportVersionId!;
        const scopedGraphCounts = async (extractionRunId: string) => {
          const scoped = {
            tenantId: scope.tenantId,
            consumerId: scope.consumerId,
            reportVersionId,
          };
          const runScoped = { ...scoped, extractionRunId };
          const [
            extractionRuns,
            coverage,
            reportAccounts,
            presence,
            sections,
            fields,
            history,
            scores,
            dates,
            baselines,
            facts,
            completeness,
          ] = await Promise.all([
            runtime.admin.extractionRun.count({ where: { ...scoped, id: extractionRunId } }),
            runtime.admin.extractionBureauCoverage.count({ where: runScoped }),
            runtime.admin.reportVersionAccount.count({ where: scoped }),
            runtime.admin.accountPresenceObservation.count({ where: runScoped }),
            runtime.admin.sectionCompleteness.count({ where: runScoped }),
            runtime.admin.fieldObservation.count({ where: runScoped }),
            runtime.admin.historicalEvidence.count({ where: runScoped }),
            runtime.admin.creditScoreObservation.count({ where: runScoped }),
            runtime.admin.bureauReportDateEvidence.count({ where: runScoped }),
            runtime.admin.identityBaseline.count({ where: runScoped }),
            runtime.admin.identityFact.count({ where: runScoped }),
            runtime.admin.round0SourceCompletenessEvidence.count({ where: runScoped }),
          ]);
          return {
            extractionRuns,
            coverage,
            reportAccounts,
            presence,
            sections,
            fields,
            history,
            scores,
            dates,
            baselines,
            facts,
            completeness,
          };
        };
        const accountCountBefore = await runtime.admin.account.count({
          where: {
            tenantId: scope.tenantId,
            consumerId: scope.consumerId,
          },
        });
        await runtime.admin.$executeRawUnsafe(`
          CREATE OR REPLACE FUNCTION public.p0_tw_graph_readback_mismatch()
          RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            NEW."normalizationVersion" := 'tampered-by-readback-trigger';
            RETURN NEW;
          END
          $$
        `);
        await runtime.admin.$executeRawUnsafe(`
          CREATE TRIGGER p0_tw_graph_readback_mismatch_trg
          BEFORE INSERT ON public."ExtractionRun"
          FOR EACH ROW EXECUTE FUNCTION public.p0_tw_graph_readback_mismatch()
        `);
        let attempted: Awaited<ReturnType<typeof runGraph>>;
        try {
          attempted = await runGraph(
            "PRESENT",
            "post-write-readback-mismatch",
            fixture,
          );
        } finally {
          await runtime.admin.$executeRawUnsafe(
            'DROP TRIGGER IF EXISTS p0_tw_graph_readback_mismatch_trg ON public."ExtractionRun"',
          );
          await runtime.admin.$executeRawUnsafe(
            "DROP FUNCTION IF EXISTS public.p0_tw_graph_readback_mismatch()",
          );
        }
        assert(capturedGraphInput);
        const extractionRunId = capturedGraphInput.batch.extractionRun.extractionRunId;
        assert.equal(attempted!.result.ok, false);
        assert.equal(attempted!.result.kind, "OUTCOME_UNKNOWN");
        assert.equal(attempted!.result.code, "SHADOW_READBACK_MISMATCH");
        const durable = await scopedGraphCounts(extractionRunId);
        assert(
          Object.values(durable).every((count) => count === 0),
          JSON.stringify(durable),
        );
        assert.equal(
          await runtime.admin.account.count({
            where: {
              tenantId: scope.tenantId,
              consumerId: scope.consumerId,
            },
          }),
          accountCountBefore,
        );
      },
    );

    await test("normalized source replay is idempotent through the real source adapter", async () => {
      const replay = await storeNormalizedInput({
        runtime,
        ingestion: extracting,
        content: extracted.value.normalizedText,
      });
      assert.equal(replay.receipt.object.writeDisposition, "IDEMPOTENT_REPLAY");
      assert.equal(replay.receipt.object.sha256, normalized.receipt.object.sha256);
      assert.equal(
        replay.receipt.object.providerObjectVersion,
        normalized.receipt.object.providerObjectVersion,
      );
    });

    await test("successful real graph write can advance the exact ingestion", async () => {
      assert(positiveGraphResult.ok);
      const transitioned = await runtime.ingestionService.transition({
        principal: positiveGraph.authority.principal,
        gatePermit: positiveGraph.authority.permit,
        ingestionId: extracting.id,
        operationId: positiveGraph.authority.operationId,
        expectedRevision: extracting.revision,
        leaseToken: extracting.leaseToken!,
        to: "SUCCEEDED",
        extractionRunReceipt: positiveGraphResult.extractionRunReceipt,
        extractionInputReceipt: normalized.receipt,
      });
      assert(transitioned.ok, JSON.stringify(transitioned));
      assert.equal(transitioned.ingestion.state, "SUCCEEDED");
    });

    await test("exact concrete Prisma hook supports managed scope only inside the disposable route callback", async () => {
      const prismaHook = createP0TrustedWriterPrismaUploadHook({
        client: runtime.writer,
        mode: "PRE_ACTIVATION_ATTESTATION",
        principalDependencies: runtime.principalDependencies,
        workerConfiguration: runtime.workerConfiguration,
        valueProtection: runtime.valueProtection,
        resolveReadinessEvidence: () => runtime.readiness,
      });
      runtime.session.actorId = "tw-agency";
      const result = await withP0DisposableTrustedWriterUploadHook({
        hook: prismaHook,
        async execute() {
          assert.equal(createP0ProductionTrustedWriterUploadHook(), prismaHook);
          return prismaHook.dispatch({
            legacyReportId: "tw-report-managed",
            bureauSelectors: ["EQUIFAX"],
            sources: [
              {
                kind: "ORIGINAL_TEXT",
                mimeType: "text/plain",
                content: new TextEncoder().encode(
                  "Synthetic managed-client Experian source bytes.",
                ),
              },
            ],
          });
        },
      });
      assert.equal(result.kind, "ACCEPTED", JSON.stringify(result));
      assert.equal(createP0ProductionTrustedWriterUploadHook(), null);
      const durable = await runtime.admin.reportIngestion.findFirst({
        where: {
          tenantId: managedScope.tenantId,
          consumerId: managedScope.consumerId,
          reportSeriesKey: deriveP0ReportSeriesKey("tw-report-managed"),
        },
        select: { state: true, reportVersionId: true },
      });
      assert.equal(durable?.state, "VERSION_COMMITTED");
      assert.equal(typeof durable?.reportVersionId, "string");
    });

    await test("protected source read revalidates live worker authority in its read transaction", async () => {
      const prepared = await prepareSourceStored({
        runtime,
        principal: directPrincipal,
        legacyReportId: "tw-report-read-revoke",
        content: new TextEncoder().encode(
          "Synthetic protected read revocation source bytes.",
        ),
      });
      const commitAuthority = await workerAuthority(
        runtime,
        prepared.ingestion.id,
        "COMMIT_VERSION",
      );
      const committed = await runtime.reportVersionRepository.commitExact({
        principal: commitAuthority.principal,
        gatePermit: commitAuthority.permit,
        operationId: commitAuthority.operationId,
        ingestion: prepared.ingestion,
        legacyReportId: "tw-report-read-revoke",
        sourceReceipt: prepared.receipt,
      });
      assert.equal(committed.kind, "CREATED", JSON.stringify(committed));
      assert(committed.kind === "CREATED");
      const transitioned = await runtime.ingestionService.transition({
        principal: commitAuthority.principal,
        gatePermit: commitAuthority.permit,
        ingestionId: prepared.ingestion.id,
        operationId: commitAuthority.operationId,
        expectedRevision: prepared.ingestion.revision,
        leaseToken: prepared.ingestion.leaseToken!,
        to: "VERSION_COMMITTED",
        reportVersionReceipt: committed.attestation,
      });
      assert(transitioned.ok, JSON.stringify(transitioned));
      const authority = await workerAuthority(
        runtime,
        transitioned.ingestion.id,
        "STORE_SOURCE",
      );
      const authorization = await authorizeStoredSourceRead({
        runtime,
        authority,
        receipt: prepared.receipt,
      });
      const auditBefore = await runtime.admin.p0SensitiveAccessEvent.count({
        where: {
          tenantId: directScope.tenantId,
          consumerId: directScope.consumerId,
          resourceId: prepared.receipt.object.scope.artifactId,
        },
      });
      assert.equal(auditBefore, 1);
      const updated = await runtime.admin.$executeRawUnsafe(
        'UPDATE "ReportIngestion" SET "revision" = "revision" + 1 WHERE "id" = $1 AND "revision" = $2',
        transitioned.ingestion.id,
        transitioned.ingestion.revision,
      );
      assert.equal(updated, 1);
      const read = await dispatchP0SourceArtifactRead(
        runtime.sourceAdapter.provider,
        {
          contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
          capability: authorization.capability as typeof authorization.capability & {
            readonly purpose: "READ_SOURCE";
          },
          principal: authority.principal,
          sensitiveAccessGrant: authorization.grant,
          sensitiveResource: authorization.resource,
          sensitiveAccessKind: "WORKER",
          sensitiveAccessPurposeCode: "WORKER_EXTRACTION",
          object: prepared.receipt.object,
        },
      );
      assert.equal(read.ok, false);
      assert.equal(read.kind, "OUTCOME_UNKNOWN");
      const durable = await runtime.admin.p0SourceObject.findFirst({
        where: {
          tenantId: directScope.tenantId,
          consumerId: directScope.consumerId,
          ingestionId: prepared.ingestion.id,
          artifactId: prepared.receipt.object.scope.artifactId,
        },
        select: { sha256: true, ciphertext: true },
      });
      assert.equal(durable?.sha256, prepared.receipt.object.sha256);
      assert(durable?.ciphertext instanceof Uint8Array || Buffer.isBuffer(durable?.ciphertext));
    });

    await test("real repository transactions preserve exact PostgreSQL 40P01 classification without retry", async () => {
      const prepared = await prepareSourceStored({
        runtime,
        principal: directPrincipal,
        legacyReportId: "tw-report-deadlock",
        content: new TextEncoder().encode(
          "Synthetic exact PostgreSQL deadlock classification bytes.",
        ),
      });
      const commitAuthority = await workerAuthority(
        runtime,
        prepared.ingestion.id,
        "COMMIT_VERSION",
      );
      await runtime.admin.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION public.p0_tw_report_version_40p01()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW."sourceReportId" = 'tw-report-deadlock' THEN
            RAISE EXCEPTION USING ERRCODE = '40P01', MESSAGE = 'synthetic exact report-version deadlock';
          END IF;
          RETURN NEW;
        END
        $$
      `);
      await runtime.admin.$executeRawUnsafe(`
        CREATE TRIGGER p0_tw_report_version_40p01_trigger
        BEFORE INSERT ON "ReportVersion"
        FOR EACH ROW EXECUTE FUNCTION public.p0_tw_report_version_40p01()
      `);
      let deadlocked: Awaited<
        ReturnType<P0PrismaReportVersionRepository["commitExact"]>
      >;
      try {
        deadlocked = await runtime.reportVersionRepository.commitExact({
          principal: commitAuthority.principal,
          gatePermit: commitAuthority.permit,
          operationId: commitAuthority.operationId,
          ingestion: prepared.ingestion,
          legacyReportId: "tw-report-deadlock",
          sourceReceipt: prepared.receipt,
        });
      } finally {
        await runtime.admin.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS p0_tw_report_version_40p01_trigger ON "ReportVersion"',
        );
        await runtime.admin.$executeRawUnsafe(
          "DROP FUNCTION IF EXISTS public.p0_tw_report_version_40p01()",
        );
      }
      assert.deepEqual(deadlocked!, {
        kind: "DEADLOCK_DETECTED",
        code: "POSTGRES_40P01_DEADLOCK_DETECTED",
        databaseCode: "40P01",
        retryable: false,
      });
      assert.equal(
        await runtime.admin.reportVersion.count({
          where: { sourceReportId: "tw-report-deadlock" },
        }),
        0,
      );
      const committed = await runtime.reportVersionRepository.commitExact({
        principal: commitAuthority.principal,
        gatePermit: commitAuthority.permit,
        operationId: commitAuthority.operationId,
        ingestion: prepared.ingestion,
        legacyReportId: "tw-report-deadlock",
        sourceReceipt: prepared.receipt,
      });
      assert.equal(committed.kind, "CREATED", JSON.stringify(committed));
      assert(committed.kind === "CREATED");
      const transitioned = await runtime.ingestionService.transition({
        principal: commitAuthority.principal,
        gatePermit: commitAuthority.permit,
        ingestionId: prepared.ingestion.id,
        operationId: commitAuthority.operationId,
        expectedRevision: prepared.ingestion.revision,
        leaseToken: prepared.ingestion.leaseToken!,
        to: "VERSION_COMMITTED",
        reportVersionReceipt: committed.attestation,
      });
      assert(transitioned.ok, JSON.stringify(transitioned));
      const deadlockNormalized = await storeNormalizedInput({
        runtime,
        ingestion: transitioned.ingestion,
        content: new TextEncoder().encode(
          "Synthetic normalized exact PostgreSQL deadlock bytes.",
        ),
      });
      const extractAuthority = await workerAuthority(
        runtime,
        transitioned.ingestion.id,
        "EXTRACT",
      );
      await runtime.admin.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION public.p0_tw_artifact_40p01()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW."id" = '${deadlockNormalized.receipt.object.scope.artifactId}' THEN
            RAISE EXCEPTION USING ERRCODE = '40P01', MESSAGE = 'synthetic exact artifact deadlock';
          END IF;
          RETURN NEW;
        END
        $$
      `);
      await runtime.admin.$executeRawUnsafe(`
        CREATE TRIGGER p0_tw_artifact_40p01_trigger
        BEFORE INSERT ON "Artifact"
        FOR EACH ROW EXECUTE FUNCTION public.p0_tw_artifact_40p01()
      `);
      let inputDeadlocked: Awaited<
        ReturnType<ConcreteRuntime["extractionInputRepository"]["commitExact"]>
      >;
      try {
        inputDeadlocked =
          await runtime.extractionInputRepository.commitExact({
            principal: extractAuthority.principal,
            gatePermit: extractAuthority.permit,
            operationId: extractAuthority.operationId,
            ingestion: transitioned.ingestion,
            reportVersionReceipt: committed.attestation,
            inputReceipt: deadlockNormalized.receipt,
          });
      } finally {
        await runtime.admin.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS p0_tw_artifact_40p01_trigger ON "Artifact"',
        );
        await runtime.admin.$executeRawUnsafe(
          "DROP FUNCTION IF EXISTS public.p0_tw_artifact_40p01()",
        );
      }
      assert.deepEqual(inputDeadlocked!, {
        kind: "DEADLOCK_DETECTED",
        code: "POSTGRES_40P01_DEADLOCK_DETECTED",
        databaseCode: "40P01",
        retryable: false,
      });
      assert.equal(
        await runtime.admin.artifact.count({
          where: { id: deadlockNormalized.receipt.object.scope.artifactId },
        }),
        0,
      );
      const retried = await runtime.extractionInputRepository.commitExact({
        principal: extractAuthority.principal,
        gatePermit: extractAuthority.permit,
        operationId: extractAuthority.operationId,
        ingestion: transitioned.ingestion,
        reportVersionReceipt: committed.attestation,
        inputReceipt: deadlockNormalized.receipt,
      });
      assert.equal(retried.kind, "CREATED", JSON.stringify(retried));
    });

    await test("application writer role retains no schema or database administration authority", async () => {
      const roles = await runtime.admin.$queryRawUnsafe<
        Array<{
          rolsuper: boolean;
          rolcreaterole: boolean;
          rolcreatedb: boolean;
          rolbypassrls: boolean;
        }>
      >(
        "SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = $1",
        writerRole,
      );
      assert.equal(roles.length, 1);
      assert.deepEqual(roles[0], {
        rolsuper: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolbypassrls: false,
      });
      const privileges = await runtime.admin.$queryRawUnsafe<
        Array<{
          schema_create: boolean;
          database_create: boolean;
          database_temp: boolean;
        }>
      >(
        `SELECT
          has_schema_privilege($1, 'public', 'CREATE') AS schema_create,
          has_database_privilege($1, current_database(), 'CREATE') AS database_create,
          has_database_privilege($1, current_database(), 'TEMP') AS database_temp`,
        writerRole,
      );
      assert.deepEqual(privileges[0], {
        schema_create: false,
        database_create: false,
        database_temp: false,
      });
      let createDenied = false;
      try {
        await runtime.writer.$executeRawUnsafe(
          'CREATE TABLE "p0_tw_forbidden_schema_mutation" ("id" text PRIMARY KEY)',
        );
      } catch {
        createDenied = true;
      }
      assert.equal(createDenied, true);
      const forbidden = await runtime.admin.$queryRawUnsafe<
        Array<{ relation_name: string | null }>
      >("SELECT to_regclass('public.p0_tw_forbidden_schema_mutation')::text AS relation_name");
      assert.equal(forbidden[0]?.relation_name, null);
    });
  } finally {
    await Promise.allSettled([runtime.writer.$disconnect(), runtime.admin.$disconnect()]);
  }

  assert.equal(attacksPassed, 20);
  assert.equal(privilegedBoundaryAttacksPassed, 15);
  process.stdout.write(
    `1/1 PASS p0 trusted-writer real-adapter disposable attestation (` +
      `${passed} checks; original=${attacksPassed}/20 attacks; ` +
      `privileged-boundary=${privilegedBoundaryAttacksPassed}/15 attacks)\n`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown harness failure";
  process.stderr.write(`p0 trusted-writer real-adapter harness failed: ${message}\n`);
  process.exitCode = 1;
});
