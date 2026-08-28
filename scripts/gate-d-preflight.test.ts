// Run: npx tsx scripts/gate-d-preflight.test.ts
//
// DB-less deterministic fixtures for the Gate D catalog classifier. No fixture
// opens a socket or touches Production/Preview.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
  db5DeployCandidateList,
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
const catalogMigrations = [
  ...manifest.migrations,
  ...manifest.authoredUnappliedMigrations,
];
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

function authoredMigration(name: string): MigrationExpectation {
  const migration = manifest.authoredUnappliedMigrations.find((item) => item.name === name);
  if (!migration) throw new Error(`authored fixture migration missing: ${name}`);
  return migration;
}

function fixture(
  physicalNames: readonly string[] = GATE_D_MIGRATION_CHAIN,
  appliedNames: readonly string[] = GATE_D_MIGRATION_CHAIN,
): CatalogSnapshot {
  const physical = new Set(physicalNames);
  const applied = new Set(appliedNames);
  const enums = catalogMigrations
    .filter((migration) => physical.has(migration.name))
    .flatMap((migration) =>
      migration.enums.map((item) => ({
        schema: item.schema,
        name: item.name,
        kind: "enum",
        values: [...item.values],
      })),
    );
  const tables = catalogMigrations
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
  const columns = catalogMigrations
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
  const constraints: ActualConstraint[] = catalogMigrations
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
  const indexes = catalogMigrations
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
  const foreignKeys = catalogMigrations
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
  const extensions = catalogMigrations
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
    historyRows: catalogMigrations
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

function addUnrelatedTable(
  snapshot: CatalogSnapshot,
  name: string,
  columnNames: readonly string[],
) {
  const sourceTable = snapshot.tables.find(
    (table) => table.schema === "public" && table.name === "User",
  );
  if (!sourceTable) throw new Error("fixture User table missing");
  const table = { ...structuredClone(sourceTable), name };
  snapshot.tables.push(table);
  for (const columnName of columnNames) {
    const sourceColumn = snapshot.columns.find(
      (column) =>
        column.schema === "public" && column.table === "User" && column.name === columnName,
    );
    if (!sourceColumn) throw new Error(`fixture User.${columnName} column missing`);
    snapshot.columns.push({ ...structuredClone(sourceColumn), table: name });
  }
  snapshot.permissions.relations.push({
    schema: table.schema,
    table: name,
    ownerUsable: true,
    references: Object.fromEntries(columnNames.map((columnName) => [columnName, true])),
  });
  return table;
}

function addCatalogIndex(
  snapshot: CatalogSnapshot,
  input: {
    schema: string;
    table: string;
    name: string;
    keys: readonly string[];
    unique: boolean;
  },
) {
  snapshot.indexes.push({
    ...structuredClone(snapshot.indexes[0]),
    schema: input.schema,
    table: input.table,
    name: input.name,
    unique: input.unique,
    primary: false,
    keys: [...input.keys],
    keyOptions: input.keys.map(() => 0),
    defaultOpclasses: input.keys.map(() => true),
    defaultCollations: input.keys.map(() => true),
  });
  // gate-d-preflight-catalog emits the pg_class relation row as well as the
  // pg_index metadata row for every index.
  snapshot.tables.push({
    ...structuredClone(snapshot.tables[0]),
    schema: input.schema,
    name: input.name,
    relationKind: "index",
  });
}

function reportFor(snapshot: CatalogSnapshot) {
  return buildPreflightReport(manifest, snapshot, expectedFingerprint);
}

function state(report: ReturnType<typeof reportFor>, name: string): MigrationState | undefined {
  return report.migrations.find((migration) => migration.name === name)?.state;
}

function authoredAbsence(report: ReturnType<typeof reportFor>, name: string) {
  return report.preDb5AbsenceGate.migrations.find((migration) => migration.name === name);
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
//     counts and applied-set fixtures come from this alone. Unchanged: still
//     exactly the reviewed six.
//   · EXPECTED_MIGRATION_DIRECTORIES — what may exist under prisma/migrations.
//     It contains the six applied plus both acknowledged authored directories;
//     a ninth folder still fails loudly.
//   · manifest.authoredUnappliedMigrations — both SQL files are parsed and
//     hashed solely to drive the separate exact-absence gate. They never enter
//     applied coverage or a pending-deploy list.
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
  "authored migrations are parsed into the exact-absence manifest in exact order",
  manifest.authoredUnappliedMigrations.map((item) => item.name).join(",") ===
    AUTHORED_UNAPPLIED_MIGRATIONS.join(","),
);
check(
  "authored tables stay absent from applied coverage",
  !manifest.migrations.some((migration) =>
    migration.tables.some((table) => table.name === "ConsumerAssertion" || table.name === "TermsAcceptance"),
  ),
);
check(
  "the absence manifest covers both authored tables",
  manifest.authoredUnappliedMigrations
    .flatMap((migration) => migration.tables.map((table) => table.name))
    .sort()
    .join(",") === "ConsumerAssertion,TermsAcceptance",
);
check(
  "authored migration SQL checksums are pinned byte-for-byte before DB5",
  manifest.authoredUnappliedMigrations
    .map((migration) => `${migration.name}:${migration.checksum}`)
    .join(",") ===
    "20260728000000_terms_acceptance:d67e5b4b4761d6328fb0786ea976a1f889a49e308bbd5b354a768e7324e3e922," +
      "20260823120000_consumer_assertion:d5a7ea7ac31a12119ad413e8fc1290c923b1f9b9a3fd4fa4e046f44904d15ad0",
);
check(
  "DB5 deploy candidates are derived in exact authored order with exact checksums",
  db5DeployCandidateList(manifest)
    .map((candidate) => `${candidate.name}:${candidate.checksum}`)
    .join(",") ===
    "20260728000000_terms_acceptance:d67e5b4b4761d6328fb0786ea976a1f889a49e308bbd5b354a768e7324e3e922," +
      "20260823120000_consumer_assertion:d5a7ea7ac31a12119ad413e8fc1290c923b1f9b9a3fd4fa4e046f44904d15ad0",
);
check(
  "DB5 deploy candidate names come only from AUTHORED_UNAPPLIED_MIGRATIONS",
  db5DeployCandidateList(manifest).every(
    (candidate, index) => candidate.name === AUTHORED_UNAPPLIED_MIGRATIONS[index],
  ) && db5DeployCandidateList(manifest).length === AUTHORED_UNAPPLIED_MIGRATIONS.length,
);
{
  const staticManifest = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", join(root, "scripts", "gate-d-preflight.ts"), "--manifest"],
      { cwd: root, encoding: "utf8" },
    ),
  ) as {
    migrations: Array<{ name: string; checksum: string }>;
    mutationAuthorized: boolean;
    preDb5AbsenceGate: {
      deployCandidateList: Array<{ name: string; checksum: string }>;
      mutationAuthorized: boolean;
    };
  };
  check(
    "the actual --manifest CLI renders the exact checksummed DB5 candidate list",
    staticManifest.preDb5AbsenceGate.deployCandidateList
      .map((candidate) => `${candidate.name}:${candidate.checksum}`)
      .join(",") ===
      db5DeployCandidateList(manifest)
        .map((candidate) => `${candidate.name}:${candidate.checksum}`)
        .join(","),
  );
  check(
    "the static manifest is non-authorizing and keeps DB5 candidates out of applied migrations",
    staticManifest.mutationAuthorized === false &&
      staticManifest.preDb5AbsenceGate.mutationAuthorized === false &&
      staticManifest.preDb5AbsenceGate.deployCandidateList.every(
        (candidate) => !staticManifest.migrations.some((migration) => migration.name === candidate.name),
      ),
  );
}
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
    // Control: the exact expected set loads, yielding six applied expectations
    // plus the two separately parsed absence expectations.
    const fromTemp = loadGateDManifest(tempRoot);
    check(
      "manifest loads from a root holding the full expected directory set",
      fromTemp.migrations.length === 6 &&
        fromTemp.authoredUnappliedMigrations.length === 2 &&
        fromTemp.manifestHash === manifest.manifestHash,
    );

    const authoredPath = join(
      tempRoot,
      "prisma",
      "migrations",
      AUTHORED_UNAPPLIED_MIGRATIONS[0],
      "migration.sql",
    );
    const authoredSql = readFileSync(authoredPath, "utf8");
    writeFileSync(authoredPath, `${authoredSql}\n-- absence-manifest hash negative control\n`);
    const changedAuthoredManifest = loadGateDManifest(tempRoot);
    check(
      "manifest hash includes authored-unapplied SQL while applied coverage remains six",
      changedAuthoredManifest.manifestHash !== manifest.manifestHash &&
        changedAuthoredManifest.migrations.map((migration) => migration.checksum).join(",") ===
          manifest.migrations.map((migration) => migration.checksum).join(",") &&
        manifestCoverage(changedAuthoredManifest).migrations === 6,
    );
    writeFileSync(authoredPath, authoredSql);

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

// PRE-DB5 AUTHORED/UNAPPLIED EXACT-ABSENCE GATE. This is deliberately
// independent of the six-migration applied-chain classifier above.
{
  const report = reportFor(fixture());
  check("pre-DB5 absence gate passes when both authored migrations are physically and historically absent", report.preDb5AbsenceGate.decision === "PASS");
  check(
    "clean applied-six plus authored absence is explicitly READY_FOR_DB5_APPROVAL",
    report.decision === "READY_FOR_DB5_APPROVAL" &&
      report.preDb5AbsenceGate.mutationAuthorized === false &&
      report.mutationAuthorized === false,
  );
  check(
    "runtime pre-DB5 evidence renders the exact checksummed DB5 candidate order",
    report.preDb5AbsenceGate.deployCandidateList
      .map((candidate) => `${candidate.name}:${candidate.checksum}`)
      .join(",") ===
      db5DeployCandidateList(manifest)
        .map((candidate) => `${candidate.name}:${candidate.checksum}`)
        .join(","),
  );
  check(
    "DB5 candidate privilege proof covers schema, history, indexes, constraints, and foreign keys",
    [
      "schema:public:create",
      "migration_history:insert",
      "migration_history:update",
      "capability:create_tables",
      "capability:create_indexes",
      "capability:add_constraints",
      "capability:add_foreign_keys",
      "capability:write_migration_history",
    ].every((name) =>
      report.privilegeChecks.some((check) => check.name === name && check.status === "PASS"),
    ),
  );
  check(
    "pre-DB5 clean absence proves both authored migrations ALL_ABSENT",
    report.preDb5AbsenceGate.migrations.length === 2 &&
      report.preDb5AbsenceGate.migrations.every(
        (migration) =>
          migration.state === "ALL_ABSENT" &&
          migration.physicalState === "ALL_ABSENT" &&
          migration.history === "ABSENT" &&
          migration.presentPhysicalObjects.length === 0,
      ),
  );
  check(
    "absence expectations explicitly cover tables, columns, PKs, PK indexes, explicit indexes and FKs",
    report.preDb5AbsenceGate.migrations.every((migration) => {
      const kinds = new Set(
        migration.expectedPhysicalObjects.map((path) => path.slice(0, path.indexOf("."))),
      );
      return ["table", "column", "primary-key", "primary-key-index", "index", "foreign-key"]
        .every((kind) => kinds.has(kind));
    }),
  );
  check(
    "absence inventories pin all 11 TermsAcceptance and 19 ConsumerAssertion physical objects",
    authoredAbsence(report, AUTHORED_UNAPPLIED_MIGRATIONS[0])?.expectedPhysicalObjects.length === 11 &&
      authoredAbsence(report, AUTHORED_UNAPPLIED_MIGRATIONS[1])?.expectedPhysicalObjects.length === 19,
  );
  const rendered = renderPreflightReport(report);
  check(
    "rendered JSON retains the distinct absence gate and its object inventory",
    rendered.includes('"preDb5AbsenceGate"') &&
      rendered.includes('"deployCandidateList"') &&
      rendered.includes('"requiredState":"ALL_ABSENT"') &&
      rendered.includes('"column.public.TermsAcceptance.acceptedAt"') &&
      rendered.includes('"foreign-key.public.ConsumerAssertion.ConsumerAssertion_tradelineId_fkey"'),
  );
  check(
    "authored/unapplied migrations never leak into mutation proposal output",
    [...report.pendingDeployList, ...report.proposedResolveList].every(
      (name) => !(AUTHORED_UNAPPLIED_MIGRATIONS as readonly string[]).includes(name),
    ),
  );
}
{
  const snapshot = fixture();
  snapshot.permissions.schemaCreate = false;
  const report = reportFor(snapshot);
  check(
    "DB5 candidate schema-CREATE failure aborts with legacy proposal lists still empty",
    report.decision === "ABORT" &&
      report.pendingDeployList.length === 0 &&
      report.proposedResolveList.length === 0 &&
      report.stopReasons.includes("PRIVILEGE_FAIL:schema:public:create"),
  );
}
{
  const snapshot = fixture();
  snapshot.permissions.relations.find(
    (relation) => relation.schema === "public" && relation.table === "User",
  )!.references.id = false;
  const report = reportFor(snapshot);
  check(
    "DB5 candidate FK-reference failure aborts before approval",
    report.decision === "ABORT" &&
      report.stopReasons.includes("PRIVILEGE_FAIL:references:public.User.id"),
  );
}
{
  const snapshot = fixture(
    [...GATE_D_MIGRATION_CHAIN, ...AUTHORED_UNAPPLIED_MIGRATIONS],
    GATE_D_MIGRATION_CHAIN,
  );
  const report = reportFor(snapshot);
  check("full db-push-shaped authored schema makes the pre-DB5 gate ABORT", report.preDb5AbsenceGate.decision === "ABORT" && report.decision === "ABORT");
  check(
    "full authored physical presence is exhaustively evidenced",
    report.preDb5AbsenceGate.migrations.every(
      (migration) =>
        migration.state === "PRESENT" &&
        migration.physicalState === "PRESENT" &&
        migration.history === "ABSENT" &&
        migration.presentPhysicalObjects.join(",") === migration.expectedPhysicalObjects.join(","),
    ),
  );
  check(
    "full authored physical presence emits one deterministic stop per migration",
    AUTHORED_UNAPPLIED_MIGRATIONS.every((name) =>
      report.stopReasons.includes(`PRE_DB5_AUTHORED_PHYSICAL_PRESENT:${name}`),
    ),
  );
  check(
    "present authored migrations still never become pending or baseline proposals",
    [...report.pendingDeployList, ...report.proposedResolveList].every(
      (name) => !(AUTHORED_UNAPPLIED_MIGRATIONS as readonly string[]).includes(name),
    ),
  );
}
{
  const terms = AUTHORED_UNAPPLIED_MIGRATIONS[0];
  const snapshot = fixture([...GATE_D_MIGRATION_CHAIN, terms], GATE_D_MIGRATION_CHAIN);
  snapshot.indexes = snapshot.indexes.filter(
    (index) => index.name !== "TermsAcceptance_userId_acceptedAt_idx",
  );
  const report = reportFor(snapshot);
  const absence = authoredAbsence(report, terms)!;
  check("partial authored physical presence makes the pre-DB5 gate ABORT", report.preDb5AbsenceGate.decision === "ABORT" && report.decision === "ABORT");
  check(
    "partial authored physical evidence is neither empty nor falsely complete",
    absence.physicalState === "PRESENT" &&
      absence.presentPhysicalObjects.length > 0 &&
      absence.presentPhysicalObjects.length < absence.expectedPhysicalObjects.length,
  );
  check(
    "partial authored physical presence emits the deterministic stop reason",
    report.stopReasons.includes(`PRE_DB5_AUTHORED_PHYSICAL_PRESENT:${terms}`),
  );
}
check(
  "authored PK namespace-collision fixtures cover the exact two backing-index names",
  AUTHORED_UNAPPLIED_MIGRATIONS.map(
    (name) => authoredMigration(name).tables[0]?.primaryKey?.name,
  ).join(",") === "TermsAcceptance_pkey,ConsumerAssertion_pkey",
);
for (const name of AUTHORED_UNAPPLIED_MIGRATIONS) {
  const candidateTable = authoredMigration(name).tables[0];
  const snapshot = fixture();
  const unrelatedTable = addUnrelatedTable(
    snapshot,
    "UnrelatedCandidateTableNameCollisionOwner",
    ["id"],
  );
  addCatalogIndex(snapshot, {
    schema: candidateTable.schema,
    table: unrelatedTable.name,
    name: candidateTable.name,
    keys: ["id"],
    unique: false,
  });
  const report = reportFor(snapshot);
  check(
    `${candidateTable.name}: schema-global same-name index blocks candidate table creation`,
    report.decision === "ABORT" &&
      authoredAbsence(report, name)!.presentPhysicalObjects.includes(
        `table.${candidateTable.schema}.${candidateTable.name}`,
      ),
  );
}
for (const name of AUTHORED_UNAPPLIED_MIGRATIONS) {
  const migration = authoredMigration(name);
  const primaryKey = migration.tables[0]?.primaryKey;
  if (!primaryKey) throw new Error(`authored fixture primary key missing: ${name}`);
  const snapshot = fixture();
  const unrelatedTable = addUnrelatedTable(
    snapshot,
    "UnrelatedCollisionOwner",
    primaryKey.columns,
  );
  addCatalogIndex(snapshot, {
    schema: primaryKey.schema,
    table: unrelatedTable.name,
    name: primaryKey.name,
    unique: true,
    keys: [...primaryKey.columns],
  });
  const report = reportFor(snapshot);
  const absence = authoredAbsence(report, name)!;
  check(
    `${primaryKey.name}: schema-global backing-index collision on another table aborts`,
    report.preDb5AbsenceGate.decision === "ABORT" && report.decision === "ABORT",
  );
  check(
    `${primaryKey.name}: wrong-table index is evidenced as primary-key-index presence`,
    absence.presentPhysicalObjects.includes(
      `primary-key-index.${primaryKey.schema}.${primaryKey.table}.${primaryKey.name}`,
    ),
  );
  check(
    `${primaryKey.name}: primary-key constraint evidence remains table-scoped`,
    !absence.presentPhysicalObjects.includes(
      `primary-key.${primaryKey.schema}.${primaryKey.table}.${primaryKey.name}`,
    ),
  );
}
{
  const uniqueManifest = structuredClone(manifest);
  const migration = uniqueManifest.authoredUnappliedMigrations[0];
  const table = migration.tables[0];
  const unique = {
    schema: table.schema,
    table: table.name,
    name: "TermsAcceptance_future_unique_key",
    columns: ["id"],
  };
  table.uniqueConstraints.push(unique);

  const wrongTableSnapshot = fixture();
  const unrelatedTable = addUnrelatedTable(
    wrongTableSnapshot,
    "UnrelatedUniqueCollisionOwner",
    unique.columns,
  );
  addCatalogIndex(wrongTableSnapshot, {
    schema: unique.schema,
    table: unrelatedTable.name,
    name: unique.name,
    unique: true,
    keys: [...unique.columns],
  });
  const wrongTableReport = buildPreflightReport(
    uniqueManifest,
    wrongTableSnapshot,
    expectedFingerprint,
  );
  const wrongTableAbsence = authoredAbsence(
    wrongTableReport,
    migration.name,
  )!;
  check(
    "future unique backing index colliding on another table is presence",
    wrongTableAbsence.presentPhysicalObjects.includes(
      `unique-index.${unique.schema}.${unique.table}.${unique.name}`,
    ) &&
      !wrongTableAbsence.presentPhysicalObjects.includes(
        `unique.${unique.schema}.${unique.table}.${unique.name}`,
      ) &&
      wrongTableReport.decision === "ABORT",
  );

  const relationSnapshot = fixture();
  addUnrelatedTable(relationSnapshot, unique.name, unique.columns);
  const relationReport = buildPreflightReport(uniqueManifest, relationSnapshot, expectedFingerprint);
  check(
    "future unique backing index colliding with a schema relation is presence",
    authoredAbsence(relationReport, migration.name)!.presentPhysicalObjects.includes(
      `unique-index.${unique.schema}.${unique.table}.${unique.name}`,
    ) && relationReport.decision === "ABORT",
  );
}
for (const name of AUTHORED_UNAPPLIED_MIGRATIONS) {
  const snapshot = fixture(GATE_D_MIGRATION_CHAIN, [...GATE_D_MIGRATION_CHAIN, name]);
  const report = reportFor(snapshot);
  const absence = authoredAbsence(report, name)!;
  check(`${name}: any authored migration-history row makes the pre-DB5 gate ABORT`, report.preDb5AbsenceGate.decision === "ABORT" && report.decision === "ABORT");
  check(
    `${name}: history presence is explicit while physical state remains ALL_ABSENT`,
    absence.state === "PRESENT" &&
      absence.physicalState === "ALL_ABSENT" &&
      absence.history === "PRESENT" &&
      absence.historyEvidence.length === 1,
  );
  check(
    `${name}: authored history retains both the dedicated and global exact-set stops`,
    report.stopReasons.includes(`PRE_DB5_AUTHORED_HISTORY_PRESENT:${name}`) &&
      report.stopReasons.includes(`UNEXPECTED_MIGRATION_HISTORY:${name}`),
  );
}
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
  check(
    "3. complete applied chain with DB5 candidates is not misreported as no pending migrations",
    report.decision === "READY_FOR_DB5_APPROVAL",
  );
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
  check(
    "15. unknown catalog evidence makes the authored-absence gate UNKNOWN",
    report.preDb5AbsenceGate.decision === "UNKNOWN" &&
      report.preDb5AbsenceGate.deployCandidateList
        .map((candidate) => candidate.name)
        .join(",") === AUTHORED_UNAPPLIED_MIGRATIONS.join(",") &&
      report.preDb5AbsenceGate.mutationAuthorized === false &&
      report.preDb5AbsenceGate.migrations.every(
        (migration) =>
          migration.state === "UNKNOWN" &&
          migration.physicalState === "UNKNOWN" &&
          migration.history === "UNKNOWN",
      ),
  );
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
  check(
    "untrusted history makes the pre-DB5 authored-absence gate UNKNOWN",
    report.preDb5AbsenceGate.decision === "UNKNOWN" &&
      AUTHORED_UNAPPLIED_MIGRATIONS.every((name) =>
        report.stopReasons.includes(`PRE_DB5_AUTHORED_ABSENCE_UNKNOWN:${name}`),
      ),
  );
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
