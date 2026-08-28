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
const POST_DB5_CANONICAL_TAIL = [
  "20260728000000_terms_acceptance",
  "20260823120000_consumer_assertion",
] as const;
const PRE_DB5_CANONICAL_PREFIX = GATE_D_MIGRATION_CHAIN.filter(
  (name) => !(POST_DB5_CANONICAL_TAIL as readonly string[]).includes(name),
);
// Test-only compatibility fixture: current repository truth has no authored
// migrations, but the generic exact-absence machinery must remain fail-closed
// when a later reviewed release introduces another authored set.
const syntheticAuthoredManifest: GateDManifest = {
  ...manifest,
  migrations: manifest.migrations.filter(
    (migration) => !(POST_DB5_CANONICAL_TAIL as readonly string[]).includes(migration.name),
  ),
  authoredUnappliedMigrations: manifest.migrations.filter(
    (migration) => (POST_DB5_CANONICAL_TAIL as readonly string[]).includes(migration.name),
  ),
  manifestHash: "synthetic-pre-db5-compatibility-fixture",
};
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
  const migration = syntheticAuthoredManifest.authoredUnappliedMigrations.find(
    (item) => item.name === name,
  );
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

function reportForSyntheticAuthored(snapshot: CatalogSnapshot) {
  return buildPreflightReport(syntheticAuthoredManifest, snapshot, expectedFingerprint);
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
const termsMigration = POST_DB5_CANONICAL_TAIL[0];
const consumerAssertionMigration = POST_DB5_CANONICAL_TAIL[1];

// HELD POST-DB5 CANONICAL TRUTH. This fixture describes the state that is valid
// only after retained successful DB5 evidence permits this patch to land.
const coverage = manifestCoverage(manifest);
check("manifest covers exactly eight canonical migrations", coverage.migrations === 8);
check(
  "canonical chain pins Terms then Consumer after the prior six",
  GATE_D_MIGRATION_CHAIN.join(",") ===
    "0_init,20260720204355_operator_network_messages,20260720223438_event_bus," +
      "20260720231803_event_bus_agency_index,20260721120000_operator_identity," +
      "20260721160000_operator_reputation,20260728000000_terms_acceptance," +
      "20260823120000_consumer_assertion" &&
    manifest.migrations.map((item) => item.name).join(",") === GATE_D_MIGRATION_CHAIN.join(","),
);

// ---------------------------------------------------------------------------
// The directory/history tripwire remains exact, never prefix- or count-based:
// the only accepted directory set is the same exact eight-name canonical chain.
// There is no currently authored/unapplied migration and therefore no DB5 deploy
// candidate. A ninth directory or history name remains an immediate abort.
// ---------------------------------------------------------------------------
check(
  "the held post-DB5 authored-but-unapplied set is exactly empty",
  AUTHORED_UNAPPLIED_MIGRATIONS.length === 0 &&
    manifest.authoredUnappliedMigrations.length === 0,
);
check(
  "expected directory set is exactly the eight-name reviewed chain",
  EXPECTED_MIGRATION_DIRECTORIES.join(",") === GATE_D_MIGRATION_CHAIN.join(","),
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
  "both DB5 migrations are canonical applied expectations in exact tail order",
  manifest.migrations.slice(-2).map((item) => item.name).join(",") ===
    POST_DB5_CANONICAL_TAIL.join(","),
);
check(
  "the exact-absence manifest and deploy-candidate list are empty after canonicalization",
  manifest.authoredUnappliedMigrations.length === 0 && db5DeployCandidateList(manifest).length === 0,
);
check(
  "both new tables contribute to canonical applied coverage",
  manifest.migrations
    .flatMap((migration) => migration.tables.map((table) => table.name))
    .filter((name) => name === "ConsumerAssertion" || name === "TermsAcceptance")
    .sort()
    .join(",") === "ConsumerAssertion,TermsAcceptance",
);
check(
  "canonical tail SQL checksums remain pinned byte-for-byte",
  manifest.migrations
    .filter((migration) =>
      (POST_DB5_CANONICAL_TAIL as readonly string[]).includes(migration.name),
    )
    .map((migration) => `${migration.name}:${migration.checksum}`)
    .join(",") ===
    "20260728000000_terms_acceptance:d67e5b4b4761d6328fb0786ea976a1f889a49e308bbd5b354a768e7324e3e922," +
      "20260823120000_consumer_assertion:d5a7ea7ac31a12119ad413e8fc1290c923b1f9b9a3fd4fa4e046f44904d15ad0",
);
check(
  "canonical eight-manifest hash is pinned",
  manifest.manifestHash === "3138c3a2d6a57bc3f45fec311e9019eafad569083e683683502e208f7db87dbd",
);
{
  const staticManifest = JSON.parse(
    execFileSync(
      process.execPath,
      ["--import", "tsx", join(root, "scripts", "gate-d-preflight.ts"), "--manifest"],
      { cwd: root, encoding: "utf8" },
    ),
  ) as {
    coverage: ReturnType<typeof manifestCoverage>;
    manifestHash: string;
    migrations: Array<{ name: string; checksum: string }>;
    mutationAuthorized: boolean;
    preDb5AbsenceGate: {
      authoredUnappliedMigrations: Array<{ name: string; checksum: string }>;
      deployCandidateList: Array<{ name: string; checksum: string }>;
      mutationAuthorized: boolean;
    };
  };
  check(
    "the actual --manifest CLI renders exact canonical names/checksums/order",
    staticManifest.migrations
      .map((migration) => `${migration.name}:${migration.checksum}`)
      .join(",") ===
      manifest.migrations
        .map((migration) => `${migration.name}:${migration.checksum}`)
        .join(","),
  );
  check(
    "the static manifest reports exact eight-migration coverage and hash",
    staticManifest.coverage.migrations === 8 &&
      staticManifest.coverage.enumTypes === 11 &&
      staticManifest.coverage.enumValues === 48 &&
      staticManifest.coverage.tables === 36 &&
      staticManifest.coverage.columns === 321 &&
      staticManifest.coverage.primaryKeys === 36 &&
      staticManifest.coverage.indexes === 66 &&
      staticManifest.coverage.foreignKeys === 24 &&
      staticManifest.manifestHash === manifest.manifestHash,
  );
  check(
    "the static post-DB5 manifest is non-authorizing with no authored candidates",
    staticManifest.mutationAuthorized === false &&
      staticManifest.preDb5AbsenceGate.mutationAuthorized === false &&
      staticManifest.preDb5AbsenceGate.authoredUnappliedMigrations.length === 0 &&
      staticManifest.preDb5AbsenceGate.deployCandidateList.length === 0,
  );
}
{
  const tempRoot = mkdtempSync(join(tmpdir(), "gate-d-manifest-"));
  try {
    // The fixture root mirrors the full exact eight-directory canonical set, so
    // each rejection below is attributable only to its one induced difference.
    for (const name of EXPECTED_MIGRATION_DIRECTORIES) {
      const target = join(tempRoot, "prisma", "migrations", name);
      mkdirSync(target, { recursive: true });
      copyFileSync(
        join(root, "prisma", "migrations", name, "migration.sql"),
        join(target, "migration.sql"),
      );
    }
    // Control: exact SQL bytes produce the exact canonical manifest.
    const fromTemp = loadGateDManifest(tempRoot);
    check(
      "manifest loads from a root holding the full expected directory set",
      fromTemp.migrations.length === 8 &&
        fromTemp.authoredUnappliedMigrations.length === 0 &&
        fromTemp.manifestHash === manifest.manifestHash,
    );

    const canonicalPath = join(
      tempRoot,
      "prisma",
      "migrations",
      termsMigration,
      "migration.sql",
    );
    const canonicalSql = readFileSync(canonicalPath, "utf8");
    writeFileSync(canonicalPath, `${canonicalSql}\n-- canonical-manifest hash negative control\n`);
    const changedCanonicalManifest = loadGateDManifest(tempRoot);
    check(
      "manifest hash covers canonical Terms SQL while applied coverage remains eight",
      changedCanonicalManifest.manifestHash !== manifest.manifestHash &&
        changedCanonicalManifest.migrations.find((migration) => migration.name === termsMigration)
          ?.checksum !== expectedMigration(termsMigration).checksum &&
        manifestCoverage(changedCanonicalManifest).migrations === 8,
    );
    writeFileSync(canonicalPath, canonicalSql);
    check(
      "restoring exact canonical SQL bytes restores the manifest hash",
      loadGateDManifest(tempRoot).manifestHash === manifest.manifestHash,
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
    rmSync(join(tempRoot, "prisma", "migrations", consumerAssertionMigration), { recursive: true });
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
check("manifest covers all 36 tables / 321 columns", coverage.tables === 36 && coverage.columns === 321);
check("manifest covers all 36 primary keys", coverage.primaryKeys === 36);
check("manifest covers all 66 explicit indexes", coverage.indexes === 66);
check("manifest covers all 24 foreign keys", coverage.foreignKeys === 24);
check("manifest records zero SQL unique constraints/checks/extensions", coverage.uniqueConstraints === 0 && coverage.checkConstraints === 0 && coverage.extensions === 0);

// CURRENT HELD POST-DB5 CLASSIFICATION.
{
  const snapshot = fixture();
  const report = reportFor(snapshot);
  check(
    "healthy exact-eight physical/history state is fully canonical",
    report.migrations.length === 8 &&
      report.migrations.every(
        (migration) =>
          migration.state === "ALL_PRESENT_AND_MATCHING" &&
          migration.physicalState === "ALL_PRESENT" &&
          migration.history === "APPLIED",
      ),
  );
  check(
    "healthy exact-eight state is NO_PENDING_MIGRATIONS and non-authorizing",
    report.decision === "NO_PENDING_MIGRATIONS" &&
      report.pendingDeployList.length === 0 &&
      report.proposedResolveList.length === 0 &&
      report.stopReasons.length === 0 &&
      report.mutationAuthorized === false,
  );
  check(
    "post-DB5 absence gate is NOT_REQUIRED with no candidates or evidence rows",
    report.preDb5AbsenceGate.decision === "NOT_REQUIRED" &&
      report.preDb5AbsenceGate.deployCandidateList.length === 0 &&
      report.preDb5AbsenceGate.migrations.length === 0 &&
      report.preDb5AbsenceGate.mutationAuthorized === false,
  );
  check(
    "healthy history set is exactly the canonical eight names in order",
    snapshot.historyRows.map((row) => row.migrationName).join(",") ===
      GATE_D_MIGRATION_CHAIN.join(","),
  );
  const rendered = renderPreflightReport(report);
  check(
    "rendered post-DB5 JSON pins NOT_REQUIRED, empty candidates, and NO_PENDING",
    rendered.includes('"decision":"NO_PENDING_MIGRATIONS"') &&
      rendered.includes('"preDb5AbsenceGate":{"decision":"NOT_REQUIRED"') &&
      rendered.includes('"deployCandidateList":[]') &&
      rendered.includes('"mutationAuthorized":false'),
  );
}
{
  const snapshot = fixture();
  const unknownHistoryName = "20260901000000_unreviewed_ninth";
  snapshot.historyRows.push({
    ...structuredClone(snapshot.historyRows.at(-1)!),
    id: "history-unreviewed-ninth",
    migrationName: unknownHistoryName,
    checksum: "9".repeat(64),
  });
  const report = reportFor(snapshot);
  check(
    "a ninth completed history row aborts the exact canonical history set",
    report.decision === "ABORT" &&
      report.stopReasons.includes(`UNEXPECTED_MIGRATION_HISTORY:${unknownHistoryName}`) &&
      report.pendingDeployList.length === 0 &&
      report.proposedResolveList.length === 0 &&
      report.mutationAuthorized === false,
  );
}
{
  const report = reportFor(
    fixture(PRE_DB5_CANONICAL_PREFIX, PRE_DB5_CANONICAL_PREFIX),
  );
  check(
    "both absent canonical tails are pending only in exact lexical order",
    state(report, termsMigration) === "ALL_ABSENT" &&
      state(report, consumerAssertionMigration) === "ALL_ABSENT" &&
      report.pendingDeployList.join(",") === POST_DB5_CANONICAL_TAIL.join(",") &&
      report.decision === "READY_FOR_OWNER_APPROVAL" &&
      report.preDb5AbsenceGate.decision === "NOT_REQUIRED",
  );
}
{
  const snapshot = fixture(
    [...PRE_DB5_CANONICAL_PREFIX, termsMigration],
    PRE_DB5_CANONICAL_PREFIX,
  );
  snapshot.indexes = snapshot.indexes.filter(
    (index) => index.name !== "TermsAcceptance_userId_acceptedAt_idx",
  );
  const report = reportFor(snapshot);
  check(
    "partial canonical Terms schema aborts",
    state(report, termsMigration) === "PARTIAL" &&
      report.decision === "ABORT" &&
      report.stopReasons.includes(`UNSAFE_MIGRATION_STATE:${termsMigration}:PARTIAL`),
  );
}
{
  const snapshot = fixture();
  snapshot.historyRows = snapshot.historyRows.filter(
    (row) => row.migrationName !== consumerAssertionMigration,
  );
  snapshot.columns.find(
    (column) => column.table === "ConsumerAssertion" && column.name === "assertionType",
  )!.type = "bigint";
  const report = reportFor(snapshot);
  check(
    "drifted canonical ConsumerAssertion schema aborts",
    state(report, consumerAssertionMigration) === "DRIFTED" &&
      report.decision === "ABORT" &&
      report.stopReasons.includes(
        `UNSAFE_MIGRATION_STATE:${consumerAssertionMigration}:DRIFTED`,
      ),
  );
}
{
  const snapshot = fixture();
  snapshot.indexes = snapshot.indexes.filter(
    (index) => index.name !== "TermsAcceptance_userId_version_key",
  );
  const report = reportFor(snapshot);
  check(
    "applied Terms history with incomplete physical schema is HISTORY_ONLY and aborts",
    state(report, termsMigration) === "HISTORY_ONLY" &&
      report.decision === "ABORT" &&
      report.stopReasons.includes(`UNSAFE_MIGRATION_STATE:${termsMigration}:HISTORY_ONLY`),
  );
}
{
  const snapshot = fixture();
  snapshot.historyRows.find(
    (row) => row.migrationName === consumerAssertionMigration,
  )!.checksum = "0".repeat(64);
  const report = reportFor(snapshot);
  check(
    "canonical ConsumerAssertion checksum mismatch is UNKNOWN and aborts",
    state(report, consumerAssertionMigration) === "UNKNOWN" &&
      report.decision === "ABORT" &&
      report.mutationAuthorized === false,
  );
}

// SYNTHETIC FUTURE-AUTHORED COMPATIBILITY. Current repository truth has no
// authored migrations; these fixtures keep the generic exact-absence machinery
// fail-closed for a later reviewed authored set without relabeling current truth.
{
  const report = reportForSyntheticAuthored(
    fixture(PRE_DB5_CANONICAL_PREFIX, PRE_DB5_CANONICAL_PREFIX),
  );
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
      db5DeployCandidateList(syntheticAuthoredManifest)
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
    authoredAbsence(report, termsMigration)?.expectedPhysicalObjects.length === 11 &&
      authoredAbsence(report, consumerAssertionMigration)?.expectedPhysicalObjects.length === 19,
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
      (name) => !(POST_DB5_CANONICAL_TAIL as readonly string[]).includes(name),
    ),
  );
}
{
  const snapshot = fixture(PRE_DB5_CANONICAL_PREFIX, PRE_DB5_CANONICAL_PREFIX);
  snapshot.permissions.schemaCreate = false;
  const report = reportForSyntheticAuthored(snapshot);
  check(
    "DB5 candidate schema-CREATE failure aborts with legacy proposal lists still empty",
    report.decision === "ABORT" &&
      report.pendingDeployList.length === 0 &&
      report.proposedResolveList.length === 0 &&
      report.stopReasons.includes("PRIVILEGE_FAIL:schema:public:create"),
  );
}
{
  const snapshot = fixture(PRE_DB5_CANONICAL_PREFIX, PRE_DB5_CANONICAL_PREFIX);
  snapshot.permissions.relations.find(
    (relation) => relation.schema === "public" && relation.table === "User",
  )!.references.id = false;
  const report = reportForSyntheticAuthored(snapshot);
  check(
    "DB5 candidate FK-reference failure aborts before approval",
    report.decision === "ABORT" &&
      report.stopReasons.includes("PRIVILEGE_FAIL:references:public.User.id"),
  );
}
{
  const snapshot = fixture(GATE_D_MIGRATION_CHAIN, PRE_DB5_CANONICAL_PREFIX);
  const report = reportForSyntheticAuthored(snapshot);
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
    POST_DB5_CANONICAL_TAIL.every((name) =>
      report.stopReasons.includes(`PRE_DB5_AUTHORED_PHYSICAL_PRESENT:${name}`),
    ),
  );
  check(
    "present authored migrations still never become pending or baseline proposals",
    [...report.pendingDeployList, ...report.proposedResolveList].every(
      (name) => !(POST_DB5_CANONICAL_TAIL as readonly string[]).includes(name),
    ),
  );
}
{
  const terms = termsMigration;
  const snapshot = fixture(
    [...PRE_DB5_CANONICAL_PREFIX, terms],
    PRE_DB5_CANONICAL_PREFIX,
  );
  snapshot.indexes = snapshot.indexes.filter(
    (index) => index.name !== "TermsAcceptance_userId_acceptedAt_idx",
  );
  const report = reportForSyntheticAuthored(snapshot);
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
  POST_DB5_CANONICAL_TAIL.map(
    (name) => authoredMigration(name).tables[0]?.primaryKey?.name,
  ).join(",") === "TermsAcceptance_pkey,ConsumerAssertion_pkey",
);
for (const name of POST_DB5_CANONICAL_TAIL) {
  const candidateTable = authoredMigration(name).tables[0];
  const snapshot = fixture(PRE_DB5_CANONICAL_PREFIX, PRE_DB5_CANONICAL_PREFIX);
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
  const report = reportForSyntheticAuthored(snapshot);
  check(
    `${candidateTable.name}: schema-global same-name index blocks candidate table creation`,
    report.decision === "ABORT" &&
      authoredAbsence(report, name)!.presentPhysicalObjects.includes(
        `table.${candidateTable.schema}.${candidateTable.name}`,
      ),
  );
}
for (const name of POST_DB5_CANONICAL_TAIL) {
  const migration = authoredMigration(name);
  const primaryKey = migration.tables[0]?.primaryKey;
  if (!primaryKey) throw new Error(`authored fixture primary key missing: ${name}`);
  const snapshot = fixture(PRE_DB5_CANONICAL_PREFIX, PRE_DB5_CANONICAL_PREFIX);
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
  const report = reportForSyntheticAuthored(snapshot);
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
  const uniqueManifest = structuredClone(syntheticAuthoredManifest);
  const migration = uniqueManifest.authoredUnappliedMigrations[0];
  const table = migration.tables[0];
  const unique = {
    schema: table.schema,
    table: table.name,
    name: "TermsAcceptance_future_unique_key",
    columns: ["id"],
  };
  table.uniqueConstraints.push(unique);

  const wrongTableSnapshot = fixture(PRE_DB5_CANONICAL_PREFIX, PRE_DB5_CANONICAL_PREFIX);
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

  const relationSnapshot = fixture(PRE_DB5_CANONICAL_PREFIX, PRE_DB5_CANONICAL_PREFIX);
  addUnrelatedTable(relationSnapshot, unique.name, unique.columns);
  const relationReport = buildPreflightReport(uniqueManifest, relationSnapshot, expectedFingerprint);
  check(
    "future unique backing index colliding with a schema relation is presence",
    authoredAbsence(relationReport, migration.name)!.presentPhysicalObjects.includes(
      `unique-index.${unique.schema}.${unique.table}.${unique.name}`,
    ) && relationReport.decision === "ABORT",
  );
}
for (const name of POST_DB5_CANONICAL_TAIL) {
  const snapshot = fixture(PRE_DB5_CANONICAL_PREFIX, [...PRE_DB5_CANONICAL_PREFIX, name]);
  const report = reportForSyntheticAuthored(snapshot);
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
  const chainWithoutFinal = GATE_D_MIGRATION_CHAIN.slice(0, -1);
  const report = reportFor(fixture(chainWithoutFinal, chainWithoutFinal));
  check(
    "1. entire final migration absent -> ALL_ABSENT",
    state(report, consumerAssertionMigration) === "ALL_ABSENT",
  );
  check(
    "1. absent canonical final migration is pending",
    report.pendingDeployList.at(-1) === consumerAssertionMigration,
  );
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
    "3. complete canonical eight-chain has no pending migrations",
    report.decision === "NO_PENDING_MIGRATIONS" &&
      report.preDb5AbsenceGate.decision === "NOT_REQUIRED" &&
      report.preDb5AbsenceGate.deployCandidateList.length === 0,
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
    "15. no authored set keeps the absence gate NOT_REQUIRED under unknown catalog evidence",
    report.preDb5AbsenceGate.decision === "NOT_REQUIRED" &&
      report.preDb5AbsenceGate.deployCandidateList.length === 0 &&
      report.preDb5AbsenceGate.mutationAuthorized === false &&
      report.preDb5AbsenceGate.migrations.length === 0,
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
  const chainWithoutFinal = GATE_D_MIGRATION_CHAIN.slice(0, -1);
  const report = reportFor(fixture(chainWithoutFinal, chainWithoutFinal));
  check("18. earlier complete + later absent is coherent", report.decision === "READY_FOR_OWNER_APPROVAL");
  check(
    "18. exact pending list contains only the canonical final migration",
    report.pendingDeployList.join(",") === consumerAssertionMigration,
  );
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
    "untrusted history leaves the empty authored-absence gate NOT_REQUIRED",
    report.preDb5AbsenceGate.decision === "NOT_REQUIRED" &&
      report.preDb5AbsenceGate.deployCandidateList.length === 0 &&
      !report.stopReasons.some((reason) => reason.startsWith("PRE_DB5_AUTHORED_")),
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
