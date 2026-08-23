// Run: npx tsx scripts/gate-d-preflight.test.ts
//
// DB-less deterministic fixtures for the Gate D catalog classifier. No fixture
// opens a socket or touches Production/Preview.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ActualConstraint,
  CatalogSnapshot,
  GateDManifest,
  AUTHORED_UNAPPLIED_MIGRATIONS,
  EXPECTED_MIGRATION_DIRECTORIES,
  GATE_D_MIGRATION_CHAIN,
  MigrationHistoryTable,
  MigrationExpectation,
  MigrationState,
  UnsupportedMigrationSqlError,
  buildPreflightReport,
  buildUnknownPreflightReport,
  databaseFingerprint,
  loadGateDManifest,
  manifestCoverage,
  parseMigrationSql,
  renderPreflightReport,
} from "./gate-d-preflight-core";
import { validateDirectUrl } from "./gate-d-preflight-catalog";

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean): void {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

const root = join(__dirname, "..");
const manifest = loadGateDManifest(root);
const identity = {
  systemIdentifier: "7429384756102938475",
  databaseOid: "16384",
  databaseName: "creditvector",
  schemaOid: "2200",
  schemaName: "public",
  currentSchema: "public",
  searchPath: ["public"],
  currentUser: "gate_d_migrator",
};
const expectedFingerprint = databaseFingerprint(identity);

function prismaMigrationHistoryTable(): MigrationHistoryTable {
  return {
    relationKind: "regular",
    persistence: "permanent",
    isPartition: false,
    inheritanceParentCount: 0,
    inheritanceChildCount: 0,
    rowSecurityEnabled: false,
    forceRowSecurity: false,
    policyCount: 0,
    ruleCount: 0,
    triggerCount: 0,
    columns: [
      { name: "id", type: "character varying(36)", nullable: false, defaultExpression: null, identityKind: "", generatedKind: "" },
      { name: "checksum", type: "character varying(64)", nullable: false, defaultExpression: null, identityKind: "", generatedKind: "" },
      { name: "finished_at", type: "timestamp with time zone", nullable: true, defaultExpression: null, identityKind: "", generatedKind: "" },
      { name: "migration_name", type: "character varying(255)", nullable: false, defaultExpression: null, identityKind: "", generatedKind: "" },
      { name: "logs", type: "text", nullable: true, defaultExpression: null, identityKind: "", generatedKind: "" },
      { name: "rolled_back_at", type: "timestamp with time zone", nullable: true, defaultExpression: null, identityKind: "", generatedKind: "" },
      { name: "started_at", type: "timestamp with time zone", nullable: false, defaultExpression: "now()", identityKind: "", generatedKind: "" },
      { name: "applied_steps_count", type: "integer", nullable: false, defaultExpression: "0", identityKind: "", generatedKind: "" },
    ],
    constraints: [{ kind: "PRIMARY_KEY", columns: ["id"] }],
  };
}

function expectedMigration(name: string): MigrationExpectation {
  const migration = manifest.migrations.find((item) => item.name === name);
  if (!migration) throw new Error(`fixture migration missing: ${name}`);
  return migration;
}

function fixture(
  physicalNames: readonly string[] = GATE_D_MIGRATION_CHAIN,
  appliedNames: readonly string[] = GATE_D_MIGRATION_CHAIN,
): CatalogSnapshot {
  const physical = new Set(physicalNames);
  const applied = new Set(appliedNames);
  const enums = manifest.migrations
    .filter((migration) => physical.has(migration.name))
    .flatMap((migration) =>
      migration.enums.map((item) => ({
        schema: item.schema,
        name: item.name,
        kind: "enum",
        values: [...item.values],
      })),
    );
  const tables = manifest.migrations
    .filter((migration) => physical.has(migration.name))
    .flatMap((migration) =>
      migration.tables.map((item) => ({
        schema: item.schema,
        name: item.name,
        relationKind: "regular",
        persistence: "permanent",
        isPartition: false,
        inheritanceParentCount: 0,
        inheritanceChildCount: 0,
        rowSecurityEnabled: false,
        forceRowSecurity: false,
        policyCount: 0,
        ruleCount: 0,
        triggerCount: 0,
        ownerUsable: true,
      })),
    );
  const columns = manifest.migrations
    .filter((migration) => physical.has(migration.name))
    .flatMap((migration) =>
      migration.tables.flatMap((table) =>
        table.columns.map((column) => ({
          schema: table.schema,
          table: table.name,
          name: column.name,
          type: column.type,
          nullable: column.nullable,
          default: column.default,
          defaultCollation: true,
          identity: "",
          generated: "",
        })),
      ),
    );
  const constraints: ActualConstraint[] = manifest.migrations
    .filter((migration) => physical.has(migration.name))
    .flatMap((migration) =>
      migration.tables.flatMap((table) => [
        ...(table.primaryKey
          ? [
              {
                schema: table.schema,
                table: table.name,
                name: table.primaryKey.name,
                kind: "PRIMARY_KEY" as const,
                columns: [...table.primaryKey.columns],
                expression: null,
                deferrable: false,
                initiallyDeferred: false,
                validated: true,
              },
            ]
          : []),
        ...table.uniqueConstraints.map((unique) => ({
          schema: unique.schema,
          table: unique.table,
          name: unique.name,
          kind: "UNIQUE" as const,
          columns: [...unique.columns],
          expression: null,
          deferrable: false,
          initiallyDeferred: false,
          validated: true,
        })),
        ...table.checkConstraints.map((item) => ({
          schema: item.schema,
          table: item.table,
          name: item.name,
          kind: "CHECK" as const,
          columns: [],
          expression: item.expression,
          deferrable: false,
          initiallyDeferred: false,
          validated: true,
        })),
      ]),
    );
  const indexes = manifest.migrations
    .filter((migration) => physical.has(migration.name))
    .flatMap((migration) => [
      ...migration.tables.flatMap((table) => [
        ...(table.primaryKey
          ? [
              {
                schema: table.schema,
                table: table.name,
                name: table.primaryKey.name,
                unique: true,
                primary: true,
                valid: true,
                ready: true,
                method: "btree",
                keys: [...table.primaryKey.columns],
                keyOptions: table.primaryKey.columns.map(() => 0),
                defaultOpclasses: table.primaryKey.columns.map(() => true),
                defaultCollations: table.primaryKey.columns.map(() => true),
                includeKeys: [],
                predicate: null,
                exclusion: false,
                nullsNotDistinct: false,
              },
            ]
          : []),
        ...table.uniqueConstraints.map((unique) => ({
          schema: unique.schema,
          table: unique.table,
          name: unique.name,
          unique: true,
          primary: false,
          valid: true,
          ready: true,
          method: "btree",
          keys: [...unique.columns],
          keyOptions: unique.columns.map(() => 0),
          defaultOpclasses: unique.columns.map(() => true),
          defaultCollations: unique.columns.map(() => true),
          includeKeys: [],
          predicate: null,
          exclusion: false,
          nullsNotDistinct: false,
        })),
      ]),
      ...migration.indexes.map((item) => ({
        schema: item.schema,
        table: item.table,
        name: item.name,
        unique: item.unique,
        primary: false,
        valid: true,
        ready: true,
        method: item.method,
        keys: [...item.keys],
        keyOptions: item.keys.map(() => 0),
        defaultOpclasses: item.keys.map(() => true),
        defaultCollations: item.keys.map(() => true),
        includeKeys: [],
        predicate: item.predicate,
        exclusion: false,
        nullsNotDistinct: false,
      })),
    ]);
  const foreignKeys = manifest.migrations
    .filter((migration) => physical.has(migration.name))
    .flatMap((migration) =>
      migration.foreignKeys.map((item) => ({
        schema: item.schema,
        table: item.table,
        name: item.name,
        columns: [...item.columns],
        referencedSchema: item.referencedSchema,
        referencedTable: item.referencedTable,
        referencedColumns: [...item.referencedColumns],
        matchType: item.matchType,
        onDelete: item.onDelete,
        onUpdate: item.onUpdate,
        deferrable: item.deferrable,
        initiallyDeferred: item.initiallyDeferred,
        validated: item.validated,
      })),
    );
  const extensions = manifest.migrations
    .filter((migration) => physical.has(migration.name))
    .flatMap((migration) =>
      migration.extensions.map((item) => ({
        name: item.name,
        schema: item.schema ?? "public",
      })),
    );
  const relations = tables.map((table) => ({
    schema: table.schema,
    table: table.name,
    ownerUsable: true,
    references: Object.fromEntries(
      columns
        .filter((column) => column.schema === table.schema && column.table === table.name)
        .map((column) => [column.name, true]),
    ),
  }));
  return {
    identity: structuredClone(identity),
    fingerprint: expectedFingerprint,
    historyTable: prismaMigrationHistoryTable(),
    historyRows: manifest.migrations
      .filter((migration) => applied.has(migration.name))
      .map((migration) => ({
        id: `history-${migration.name}`,
        migrationName: migration.name,
        checksum: migration.checksum,
        startedAt: "2026-07-25T12:00:00.000Z",
        finishedAt: "2026-07-25T12:00:01.000Z",
        rolledBackAt: null,
        finished: true,
        rolledBack: false,
        unresolved: false,
        appliedStepsCount: 1,
        logsPresent: false,
      })),
    enums,
    tables,
    columns,
    indexes,
    constraints,
    foreignKeys,
    extensions,
    permissions: {
      transactionReadOnly: true,
      migrationLockHeld: true,
      catalogReadable: true,
      historyReadable: true,
      historyInsert: true,
      historyUpdate: true,
      databaseConnect: true,
      databaseCreate: true,
      schemaUsage: true,
      schemaCreate: true,
      relations,
    },
  };
}

function reportFor(snapshot: CatalogSnapshot) {
  return buildPreflightReport(manifest, snapshot, expectedFingerprint);
}

function state(report: ReturnType<typeof reportFor>, name: string): MigrationState | undefined {
  return report.migrations.find((migration) => migration.name === name)?.state;
}

function withoutMigration(
  source: CatalogSnapshot,
  migrationName: string,
  options: { keepHistory?: boolean } = {},
): CatalogSnapshot {
  const next = structuredClone(source);
  const migration = expectedMigration(migrationName);
  const tables = new Set(migration.tables.map((item) => `${item.schema}.${item.name}`));
  const enumNames = new Set(migration.enums.map((item) => `${item.schema}.${item.name}`));
  const indexes = new Set(migration.indexes.map((item) => `${item.schema}.${item.name}`));
  const foreignKeys = new Set(migration.foreignKeys.map((item) => `${item.schema}.${item.name}`));
  next.enums = next.enums.filter((item) => !enumNames.has(`${item.schema}.${item.name}`));
  next.tables = next.tables.filter((item) => !tables.has(`${item.schema}.${item.name}`));
  next.columns = next.columns.filter((item) => !tables.has(`${item.schema}.${item.table}`));
  next.constraints = next.constraints.filter((item) => !tables.has(`${item.schema}.${item.table}`));
  next.indexes = next.indexes.filter((item) => !indexes.has(`${item.schema}.${item.name}`));
  next.foreignKeys = next.foreignKeys.filter(
    (item) => !foreignKeys.has(`${item.schema}.${item.name}`),
  );
  next.permissions.relations = next.permissions.relations.filter(
    (item) => !tables.has(`${item.schema}.${item.table}`),
  );
  next.extensions = next.extensions.filter(
    (item) => !migration.extensions.some((expected) => expected.name === item.name),
  );
  if (!options.keepHistory) {
    next.historyRows = next.historyRows.filter((item) => item.migrationName !== migrationName);
  }
  return next;
}

const reputation = "20260721160000_operator_reputation";
const identityMigration = "20260721120000_operator_identity";

// Manifest coverage is derived from the exact six APPLIED SQL files.
const coverage = manifestCoverage(manifest);
check("manifest covers exactly six migrations", coverage.migrations === 6);
check(
  "manifest directory set exactly matches the reviewed Gate D chain",
  manifest.migrations.map((item) => item.name).join(",") === GATE_D_MIGRATION_CHAIN.join(","),
);

// ---------------------------------------------------------------------------
// 2026-08-23 — DIRECTORY SET vs APPLIED SET (RC1-S4).
//
// Migration: 20260823120000_consumer_assertion (ConsumerAssertion table, RC1-S4
// Consumer Fact Confirmation). It is AUTHORED AND REVIEWED BUT NOT APPLIED —
// RC1's migration-first law ships the file and applies it only at the
// owner-gated release step — so the folder exists on disk while the table does
// not exist in any database.
//
// That splits one list into two, and BOTH stay pinned:
//   · GATE_D_MIGRATION_CHAIN — the applied chain. The manifest, the coverage
//     counts, the manifest hash and every fixture's physical/applied set come
//     from this alone, so a Gate D database is still expected NOT to contain the
//     consumer_assertion table. Unchanged: still exactly the reviewed six.
//   · EXPECTED_MIGRATION_DIRECTORIES — what may exist under prisma/migrations.
//     Extended by exactly one entry. An eighth folder still fails loudly.
//
// The tripwire is extended, never weakened: the checks below pin the on-disk set
// exactly (no "startsWith"/"length >=" slack) and pin the authored entry OUT of
// the applied manifest, so applying a migration without review cannot pass by
// merely being on disk.
//
// SERIAL ARTIFACT (S4 → S8): S8 added 20260728000000_terms_acceptance — the
// TermsAcceptance table behind registration's consent capture — as the second
// authored-but-unapplied entry. Same treatment as S4's: on disk, absent from the
// applied manifest, absent from any Gate D database. One slice extends it per
// wave, and the set below stays EXACT — never a prefix or a length check.
// ---------------------------------------------------------------------------
check(
  "the authored-but-unapplied set is exactly the RC1-S8 + RC1-S4 migrations",
  AUTHORED_UNAPPLIED_MIGRATIONS.join(",") ===
    "20260728000000_terms_acceptance,20260823120000_consumer_assertion",
);
check(
  "expected directory set = the reviewed chain + the authored-unapplied set",
  EXPECTED_MIGRATION_DIRECTORIES.join(",") ===
    [...GATE_D_MIGRATION_CHAIN, ...AUTHORED_UNAPPLIED_MIGRATIONS].join(","),
);
check(
  "the on-disk migration directories are exactly that set (drift tripwire)",
  readdirSync(join(root, "prisma", "migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .join(",") === [...EXPECTED_MIGRATION_DIRECTORIES].sort().join(","),
);
check(
  "an authored-but-unapplied migration never enters the applied manifest",
  AUTHORED_UNAPPLIED_MIGRATIONS.every(
    (name) =>
      !manifest.migrations.some((item) => item.name === name) &&
      !(GATE_D_MIGRATION_CHAIN as readonly string[]).includes(name),
  ),
);
check(
  "…so its tables are absent from the schema the preflight expects",
  !manifest.migrations.some((migration) =>
    migration.tables.some((table) => table.name === "ConsumerAssertion" || table.name === "TermsAcceptance"),
  ),
);
{
  const tempRoot = mkdtempSync(join(tmpdir(), "gate-d-manifest-"));
  try {
    // The fixture root mirrors the FULL expected directory set — the applied
    // chain plus the authored-unapplied folders — so the rejection below is
    // attributable to the unexpected directory alone and not to a missing one.
    for (const name of EXPECTED_MIGRATION_DIRECTORIES) {
      const target = join(tempRoot, "prisma", "migrations", name);
      mkdirSync(target, { recursive: true });
      copyFileSync(
        join(root, "prisma", "migrations", name, "migration.sql"),
        join(target, "migration.sql"),
      );
    }
    // Control: the exact expected set loads, and yields the applied six only.
    const fromTemp = loadGateDManifest(tempRoot);
    check(
      "manifest loads from a root holding the full expected directory set",
      fromTemp.migrations.length === 6 && fromTemp.manifestHash === manifest.manifestHash,
    );

    mkdirSync(join(tempRoot, "prisma", "migrations", "unexpected_empty_directory"));
    let rejected = false;
    try {
      loadGateDManifest(tempRoot);
    } catch (error) {
      rejected = error instanceof UnsupportedMigrationSqlError;
    }
    check("manifest rejects an unexpected migration directory without SQL", rejected);

    // …and a MISSING expected directory is still drift, in the other direction.
    rmSync(join(tempRoot, "prisma", "migrations", "unexpected_empty_directory"), { recursive: true });
    rmSync(join(tempRoot, "prisma", "migrations", AUTHORED_UNAPPLIED_MIGRATIONS[0]), { recursive: true });
    let missingRejected = false;
    try {
      loadGateDManifest(tempRoot);
    } catch (error) {
      missingRejected = error instanceof UnsupportedMigrationSqlError;
    }
    check("manifest rejects a MISSING expected migration directory", missingRejected);
  } finally {
    rmSync(tempRoot, { recursive: true });
  }
}
check("manifest covers all 11 enum types / 48 values", coverage.enumTypes === 11 && coverage.enumValues === 48);
check("manifest covers all 34 tables / 304 columns", coverage.tables === 34 && coverage.columns === 304);
check("manifest covers all 34 primary keys", coverage.primaryKeys === 34);
check("manifest covers all 62 explicit indexes", coverage.indexes === 62);
check("manifest covers all 21 foreign keys", coverage.foreignKeys === 21);
check("manifest records zero SQL unique constraints/checks/extensions", coverage.uniqueConstraints === 0 && coverage.checkConstraints === 0 && coverage.extensions === 0);
{
  const directUrl = "postgresql://gate:password@db.prisma.io:5432/gate_d?sslmode=require";
  const rejects = (url: string) => {
    try {
      validateDirectUrl(url);
      return false;
    } catch {
      return true;
    }
  };
  check("direct URL accepts the exact reviewed endpoint shape", !rejects(directUrl));
  check(
    "direct URL rejects contradictory duplicate sslmode",
    rejects(`${directUrl}&sslmode=disable`),
  );
  check("direct URL rejects duplicate sslmode", rejects(`${directUrl}&sslmode=require`));
  check("direct URL rejects uppercase sslmode", rejects(directUrl.replace("sslmode", "SSLMODE")));
  for (const parameter of [
    "host=%2Fvar%2Frun%2Fpostgresql",
    "hostaddr=127.0.0.1",
    "port=5433",
    "service=other",
    "servicefile=%2Ftmp%2Fservice",
    "options=-c%20search_path%3Dother",
    "schema=other",
    "application_name=unreviewed",
    "pgbouncer=1",
    "PGBOUNCER=TRUE",
  ]) {
    check(`direct URL rejects unapproved parameter ${parameter.split("=")[0]}`, rejects(`${directUrl}&${parameter}`));
  }
  check(
    "direct URL rejects an implicit port",
    rejects("postgresql://gate:password@db.prisma.io/gate_d?sslmode=require"),
  );
  check("direct URL rejects a missing database path", rejects("postgresql://db.prisma.io:5432/?sslmode=require"));
  check("direct URL rejects a fragment", rejects(`${directUrl}#not-a-database-identity`));
}

// 1. Entire migration absent.
{
  const report = reportFor(withoutMigration(fixture(), reputation));
  check("1. entire migration absent -> ALL_ABSENT", state(report, reputation) === "ALL_ABSENT");
  check("1. absent final migration is pending", report.pendingDeployList.at(-1) === reputation);
}

// 2. Entire migration present and matching, no history.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  const report = reportFor(snapshot);
  check("2. complete migration without history -> SCHEMA_ONLY", state(report, reputation) === "SCHEMA_ONLY");
  check("2. schema-only migration is proposed for owner review", report.proposedResolveList.at(-1) === reputation);
}

// 3. Entire migration present and matching, history applied.
{
  const report = reportFor(fixture());
  check("3. complete migration with history -> ALL_PRESENT_AND_MATCHING", state(report, reputation) === "ALL_PRESENT_AND_MATCHING");
  check("3. complete chain needs no migration action", report.decision === "NO_PENDING_MIGRATIONS");
}

// 4. One expected table missing.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.tables = snapshot.tables.filter((item) => item.name !== "ReputationMilestone");
  snapshot.columns = snapshot.columns.filter((item) => item.table !== "ReputationMilestone");
  snapshot.constraints = snapshot.constraints.filter((item) => item.table !== "ReputationMilestone");
  snapshot.indexes = snapshot.indexes.filter((item) => item.table !== "ReputationMilestone");
  snapshot.foreignKeys = snapshot.foreignKeys.filter((item) => item.table !== "ReputationMilestone");
  const report = reportFor(snapshot);
  check("4. one table missing -> PARTIAL", state(report, reputation) === "PARTIAL");
}

// 5. One enum missing.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== identityMigration);
  snapshot.enums = snapshot.enums.filter((item) => item.name !== "MembershipState");
  const report = reportFor(snapshot);
  check("5. one enum missing -> PARTIAL", state(report, identityMigration) === "PARTIAL");
}

// 6. One enum value drifted.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== identityMigration);
  snapshot.enums.find((item) => item.name === "OperatorState")!.values[0] = "WRONG";
  const report = reportFor(snapshot);
  check("6. enum value drift -> DRIFTED", state(report, identityMigration) === "DRIFTED");
}

// 7. One column type drifted.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.columns.find((item) => item.table === "XpAward" && item.name === "xp")!.type = "bigint";
  const report = reportFor(snapshot);
  check("7. column type drift -> DRIFTED", state(report, reputation) === "DRIFTED");
}

// 8. One nullability mismatch.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.columns.find((item) => item.table === "XpAward" && item.name === "xp")!.nullable = true;
  const report = reportFor(snapshot);
  check("8. nullability mismatch -> DRIFTED", state(report, reputation) === "DRIFTED");
}

// 9. One index missing.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.indexes = snapshot.indexes.filter((item) => item.name !== "XpAward_operatorId_createdAt_id_idx");
  const report = reportFor(snapshot);
  check("9. index missing -> PARTIAL", state(report, reputation) === "PARTIAL");
}

// 10. One index definition mismatch.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.indexes.find((item) => item.name === "XpAward_operatorId_createdAt_id_idx")!.keys = [
    "operatorId",
    "id",
    "createdAt",
  ];
  const report = reportFor(snapshot);
  check("10. index definition mismatch -> DRIFTED", state(report, reputation) === "DRIFTED");
}

// 11. One FK missing.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.foreignKeys = snapshot.foreignKeys.filter((item) => item.name !== "XpAward_operatorId_fkey");
  const report = reportFor(snapshot);
  check("11. FK missing -> PARTIAL", state(report, reputation) === "PARTIAL");
}

// 12. One FK action mismatch.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.foreignKeys.find((item) => item.name === "XpAward_operatorId_fkey")!.onDelete = "CASCADE";
  const report = reportFor(snapshot);
  check("12. FK action mismatch -> DRIFTED", state(report, reputation) === "DRIFTED");
}

// 13. Migration history applied but schema incomplete.
{
  const snapshot = fixture();
  snapshot.indexes = snapshot.indexes.filter((item) => item.name !== "XpAward_operatorId_createdAt_id_idx");
  const report = reportFor(snapshot);
  check("13. applied history + incomplete schema -> HISTORY_ONLY", state(report, reputation) === "HISTORY_ONLY");
}

// 14. Schema complete but history absent.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  const report = reportFor(snapshot);
  check("14. complete schema + absent history -> SCHEMA_ONLY", state(report, reputation) === "SCHEMA_ONLY");
}

// 15. Insufficient catalog permissions.
{
  const report = buildUnknownPreflightReport(manifest, "CATALOG_PERMISSION_DENIED");
  check("15. insufficient catalog permission -> every state UNKNOWN", report.migrations.every((item) => item.state === "UNKNOWN"));
  check("15. insufficient catalog permission aborts", report.decision === "ABORT");
}

// 16. Wrong database fingerprint.
{
  const report = buildPreflightReport(manifest, fixture(), "f".repeat(64));
  check("16. wrong fingerprint -> every state UNKNOWN", report.migrations.every((item) => item.state === "UNKNOWN"));
  check("16. wrong fingerprint aborts", report.stopReasons[0] === "DATABASE_FINGERPRINT_MISMATCH");
}

// 17. Unsupported SQL construct.
{
  let rejected = false;
  try {
    parseMigrationSql("unsupported", 'ALTER TABLE "User" ADD COLUMN "unsafe" TEXT;');
  } catch (error) {
    rejected = error instanceof UnsupportedMigrationSqlError;
  }
  check("17. unsupported SQL construct fails closed", rejected);
}

// 18. Partial chain: earlier migrations complete, later migration absent.
{
  const report = reportFor(withoutMigration(fixture(), reputation));
  check("18. earlier complete + later absent is coherent", report.decision === "READY_FOR_OWNER_APPROVAL");
  check("18. exact pending list contains only the later migration", report.pendingDeployList.join(",") === reputation);
}

// 19. Partial chain: a migration is half-applied.
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.indexes = snapshot.indexes.filter((item) => item.name !== "XpAward_operatorId_createdAt_id_idx");
  const report = reportFor(snapshot);
  check("19. half-applied migration -> PARTIAL", state(report, reputation) === "PARTIAL");
  check("19. half-applied chain aborts", report.decision === "ABORT");
}

// 20. Identical fixture retries render byte-identically.
{
  const snapshot = fixture();
  const first = renderPreflightReport(reportFor(structuredClone(snapshot)));
  const second = renderPreflightReport(reportFor(structuredClone(snapshot)));
  check("20. retry output is byte-identical", Buffer.from(first).equals(Buffer.from(second)));
}

// Additional fail-closed invariants.
{
  const snapshot = withoutMigration(fixture(), reputation);
  snapshot.permissions.schemaCreate = false;
  const report = reportFor(snapshot);
  check("schema CREATE privilege gap aborts a pending deploy", report.decision === "ABORT");
  check("schema CREATE privilege is reported FAIL", report.privilegeChecks.some((item) => item.name === "schema:public:create" && item.status === "FAIL"));
}
{
  const snapshot = fixture();
  snapshot.historyRows.find((item) => item.migrationName === reputation)!.checksum = "0".repeat(64);
  const report = reportFor(snapshot);
  check("migration-history checksum mismatch -> UNKNOWN", state(report, reputation) === "UNKNOWN");
}
{
  const physical = [...GATE_D_MIGRATION_CHAIN].filter((name) => name !== identityMigration);
  const applied = [...GATE_D_MIGRATION_CHAIN].filter((name) => name !== identityMigration);
  const report = reportFor(fixture(physical, applied));
  check("later-present after earlier-absent chain aborts", report.stopReasons.some((item) => item.startsWith("CHAIN_ORDER_INCOHERENT")));
}
{
  const catalogSource = readFileSync(join(root, "scripts", "gate-d-preflight-catalog.ts"), "utf8");
  check("catalog implementation explicitly starts a READ ONLY transaction", /SET TRANSACTION READ ONLY/.test(catalogSource));
  check("catalog implementation uses REPEATABLE READ", /TransactionIsolationLevel\.RepeatableRead/.test(catalogSource));
  check("catalog implementation excludes concurrent Prisma migration via its advisory key", /pg_try_advisory_xact_lock\(72707369\)/.test(catalogSource));
  check("catalog implementation pins the approved direct Prisma endpoint", /db\.prisma\.io/.test(catalogSource) && /sslmode/.test(catalogSource));
  check("catalog excludes internal FK triggers from table equivalence", /AND NOT trigger_meta\.tgisinternal/.test(catalogSource));
  check("catalog implementation contains no row/schema mutation SQL", !/\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z"]|DELETE\s+FROM|CREATE\s+(?:TABLE|TYPE|INDEX|EXTENSION)|ALTER\s+TABLE|DROP\s+|TRUNCATE\s+|GRANT\s+|REVOKE\s+)/i.test(catalogSource));
}
{
  const snapshot = fixture([], []);
  const report = reportFor(snapshot);
  check("live Production baseline cannot be entirely absent", report.stopReasons.includes("PRODUCTION_BASELINE_MISSING:0_init"));
  check("entirely absent production baseline aborts", report.decision === "ABORT");
}
{
  const snapshot = withoutMigration(fixture(), reputation);
  snapshot.tables.push({
    schema: "public",
    name: "XpAward",
    relationKind: "view",
    persistence: "permanent",
    isPartition: false,
    inheritanceParentCount: 0,
    inheritanceChildCount: 0,
    rowSecurityEnabled: false,
    forceRowSecurity: false,
    policyCount: 0,
    ruleCount: 0,
    triggerCount: 0,
    ownerUsable: false,
  });
  const report = reportFor(snapshot);
  check("same-name view colliding with expected table -> DRIFTED", state(report, reputation) === "DRIFTED");
}
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== identityMigration);
  snapshot.enums.find((item) => item.name === "OperatorState")!.kind = "domain";
  const report = reportFor(snapshot);
  check("same-name non-enum type collision -> DRIFTED", state(report, identityMigration) === "DRIFTED");
}
{
  const agency = "20260720231803_event_bus_agency_index";
  const snapshot = withoutMigration(fixture(), agency);
  const expectedIndex = expectedMigration(agency).indexes[0];
  snapshot.indexes.push({
    schema: expectedIndex.schema,
    table: "User",
    name: expectedIndex.name,
    unique: expectedIndex.unique,
    primary: false,
    valid: true,
    ready: true,
    method: expectedIndex.method,
    keys: [...expectedIndex.keys],
    keyOptions: expectedIndex.keys.map(() => 0),
    defaultOpclasses: expectedIndex.keys.map(() => true),
    defaultCollations: expectedIndex.keys.map(() => true),
    includeKeys: [],
    predicate: null,
    exclusion: false,
    nullsNotDistinct: false,
  });
  const report = reportFor(snapshot);
  check("same-name index on wrong table -> DRIFTED", state(report, agency) === "DRIFTED");
}
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.indexes.find((item) => item.name === "XpAward_operatorId_createdAt_id_idx")!.keyOptions[1] = 1;
  const report = reportFor(snapshot);
  check("index direction/null-order option mismatch -> DRIFTED", state(report, reputation) === "DRIFTED");
}
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.tables.find((item) => item.name === "XpAward")!.persistence = "unlogged";
  const report = reportFor(snapshot);
  check("unlogged table mismatch -> DRIFTED", state(report, reputation) === "DRIFTED");
}
{
  type UnsafeTableMetadata = {
    isPartition: boolean;
    inheritanceParentCount: number;
    inheritanceChildCount: number;
    rowSecurityEnabled: boolean;
    forceRowSecurity: boolean;
    policyCount: number;
    ruleCount: number;
    triggerCount: number;
  };
  for (const [label, mutate] of [
    ["partition leaf", (table: UnsafeTableMetadata) => { table.isPartition = true; }],
    ["inherited child", (table: UnsafeTableMetadata) => { table.inheritanceParentCount = 1; }],
    ["inheritance parent", (table: UnsafeTableMetadata) => { table.inheritanceChildCount = 1; }],
    ["row security", (table: UnsafeTableMetadata) => { table.rowSecurityEnabled = true; }],
    ["force row security", (table: UnsafeTableMetadata) => { table.forceRowSecurity = true; }],
    ["policy", (table: UnsafeTableMetadata) => { table.policyCount = 1; }],
    ["rule", (table: UnsafeTableMetadata) => { table.ruleCount = 1; }],
    ["trigger", (table: UnsafeTableMetadata) => { table.triggerCount = 1; }],
  ] as const) {
    const snapshot = fixture();
    snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
    const table = snapshot.tables.find((item) => item.name === "XpAward") as typeof snapshot.tables[number] & UnsafeTableMetadata;
    mutate(table);
    const report = reportFor(snapshot);
    check(`unsafe Gate D table ${label} -> DRIFTED`, state(report, reputation) === "DRIFTED");
  }
}
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.columns.find((item) => item.table === "XpAward" && item.name === "xp")!.generated = "s";
  const report = reportFor(snapshot);
  check("generated column mismatch -> DRIFTED", state(report, reputation) === "DRIFTED");
}
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.constraints.find((item) => item.name === "XpAward_pkey")!.deferrable = true;
  const report = reportFor(snapshot);
  check("deferrable primary key mismatch -> DRIFTED", state(report, reputation) === "DRIFTED");
}
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter((item) => item.migrationName !== reputation);
  snapshot.indexes.find((item) => item.name === "XpAward_pkey")!.keyOptions[0] = 1;
  const report = reportFor(snapshot);
  check("primary-key backing-index option mismatch -> DRIFTED", state(report, reputation) === "DRIFTED");
}
{
  const snapshot = fixture();
  const history = snapshot.historyRows.find((item) => item.migrationName === reputation)!;
  history.finished = false;
  history.finishedAt = null;
  history.unresolved = true;
  history.appliedStepsCount = 0;
  history.logsPresent = true;
  const migration = reportFor(snapshot).migrations.find((item) => item.name === reputation)!;
  check("unresolved history remains UNKNOWN", migration.state === "UNKNOWN");
  check("unresolved history retains physical ALL_PRESENT evidence", migration.physicalState === "ALL_PRESENT");
  check("unresolved history retains forensic row evidence", migration.historyEvidence[0]?.logsPresent === true);
}
{
  const snapshot = fixture();
  const history = snapshot.historyRows.find((item) => item.migrationName === reputation)!;
  history.rolledBack = true;
  history.rolledBackAt = "2026-07-25T12:00:02.000Z";
  const report = reportFor(snapshot);
  check("finished and rolled-back history row -> UNKNOWN", state(report, reputation) === "UNKNOWN");
}
{
  const snapshot = fixture();
  const history = snapshot.historyRows.find((item) => item.migrationName === reputation)!;
  history.finished = false;
  history.finishedAt = null;
  history.rolledBack = true;
  history.rolledBackAt = "2026-07-25T12:00:02.000Z";
  history.unresolved = false;
  const report = reportFor(snapshot);
  const migration = report.migrations.find((item) => item.name === reputation)!;
  check("rolled-back-only history -> UNKNOWN", migration.state === "UNKNOWN");
  check("rolled-back-only history aborts rather than proposing a baseline", report.decision === "ABORT" && !report.proposedResolveList.includes(reputation));
  check("rolled-back-only history retains forensic row evidence", migration.historyEvidence[0]?.rolledBackAt !== null);
}
{
  const snapshot = withoutMigration(fixture(), reputation, { keepHistory: true });
  const history = snapshot.historyRows.find((item) => item.migrationName === reputation)!;
  history.finished = false;
  history.finishedAt = null;
  history.rolledBack = true;
  history.rolledBackAt = "2026-07-25T12:00:02.000Z";
  history.unresolved = false;
  const report = reportFor(snapshot);
  check("rolled-back-only history with no physical objects -> UNKNOWN", state(report, reputation) === "UNKNOWN");
  check("rolled-back-only history never becomes pending deploy", !report.pendingDeployList.includes(reputation));
}
{
  const snapshot = fixture();
  snapshot.historyTable!.relationKind = "view";
  const report = reportFor(snapshot);
  check("migration-history view substitution -> UNKNOWN", report.migrations.every((item) => item.state === "UNKNOWN"));
  check("migration-history view substitution aborts", report.stopReasons.some((reason) => reason.includes("MIGRATION_HISTORY_INVALID:RELATION_KIND")));
}
{
  const snapshot = fixture();
  snapshot.historyTable!.rowSecurityEnabled = true;
  const report = reportFor(snapshot);
  check("migration-history RLS -> UNKNOWN", report.migrations.every((item) => item.history === "INVALID"));
}
{
  const snapshot = fixture();
  (snapshot.historyTable as MigrationHistoryTable & { isPartition: boolean }).isPartition = true;
  const report = reportFor(snapshot);
  check("migration-history partition leaf -> UNKNOWN", report.migrations.every((item) => item.history === "INVALID"));
  check("migration-history partition leaf aborts", report.stopReasons.some((reason) => reason.includes("MIGRATION_HISTORY_INVALID:PARTITION_OR_INHERITANCE")));
}
{
  const snapshot = fixture();
  (snapshot.historyTable as MigrationHistoryTable & { inheritanceParentCount: number }).inheritanceParentCount = 1;
  const report = reportFor(snapshot);
  check("migration-history inherited child -> UNKNOWN", report.migrations.every((item) => item.history === "INVALID"));
  check("migration-history inherited child aborts", report.stopReasons.some((reason) => reason.includes("MIGRATION_HISTORY_INVALID:PARTITION_OR_INHERITANCE")));
}
{
  const snapshot = fixture();
  (snapshot.historyTable as MigrationHistoryTable & { inheritanceChildCount: number }).inheritanceChildCount = 1;
  const report = reportFor(snapshot);
  check("migration-history inheritance parent -> UNKNOWN", report.migrations.every((item) => item.history === "INVALID"));
  check("migration-history inheritance parent aborts", report.stopReasons.some((reason) => reason.includes("MIGRATION_HISTORY_INVALID:PARTITION_OR_INHERITANCE")));
}
{
  const snapshot = fixture();
  const column = snapshot.historyTable!.columns.find((item) => item.name === "id")!;
  (column as typeof column & { identityKind: string }).identityKind = "a";
  const report = reportFor(snapshot);
  check("migration-history identity column -> UNKNOWN", report.migrations.every((item) => item.history === "INVALID"));
  check("migration-history identity column aborts", report.stopReasons.some((reason) => reason.includes("MIGRATION_HISTORY_INVALID:COLUMN_IDENTITY_OR_GENERATED:id")));
}
{
  const snapshot = fixture();
  const column = snapshot.historyTable!.columns.find((item) => item.name === "id")!;
  (column as typeof column & { generatedKind: string }).generatedKind = "s";
  const report = reportFor(snapshot);
  check("migration-history generated column -> UNKNOWN", report.migrations.every((item) => item.history === "INVALID"));
  check("migration-history generated column aborts", report.stopReasons.some((reason) => reason.includes("MIGRATION_HISTORY_INVALID:COLUMN_IDENTITY_OR_GENERATED:id")));
}
{
  const snapshot = withoutMigration(fixture(), reputation);
  snapshot.permissions.historyInsert = false;
  const report = reportFor(snapshot);
  check("missing migration-history INSERT privilege aborts pending work", report.decision === "ABORT");
}
{
  const snapshot = fixture();
  snapshot.historyTable = null;
  snapshot.historyRows = [];
  snapshot.permissions.historyInsert = null;
  snapshot.permissions.historyUpdate = null;
  snapshot.permissions.schemaCreate = false;
  const report = reportFor(snapshot);
  check("missing history table requires schema CREATE before baseline", report.decision === "ABORT");
}

console.log(`\ngate-d-preflight.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
