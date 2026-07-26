import { Prisma, PrismaClient } from "@prisma/client";

import {
  ActualColumn,
  ActualConstraint,
  ActualEnum,
  ActualExtension,
  ActualForeignKey,
  ActualIndex,
  ActualTable,
  CatalogPermissions,
  CatalogSnapshot,
  DatabaseIdentity,
  DefaultExpectation,
  MigrationHistoryRow,
  MigrationHistoryTable,
  RelationPrivilege,
  UnsupportedMigrationSqlError,
  canonicalDefault,
  databaseFingerprint,
  migrationHistoryTrustIssues,
} from "./gate-d-preflight-core";

export class GateDDatabaseInspectionError extends Error {
  readonly code:
    | "CATALOG_PERMISSION_DENIED"
    | "DATABASE_CONNECTION_FAILED"
    | "DATABASE_FINGERPRINT_MISMATCH"
    | "DATABASE_IDENTITY_UNAVAILABLE"
    | "DATABASE_SCHEMA_NOT_PUBLIC"
    | "DIRECT_POSTGRES_URL_REQUIRED"
    | "MIGRATION_LOCK_UNAVAILABLE";
  readonly observedFingerprint: string | null;

  constructor(
    code: GateDDatabaseInspectionError["code"],
    observedFingerprint: string | null = null,
  ) {
    super(code);
    this.name = "GateDDatabaseInspectionError";
    this.code = code;
    this.observedFingerprint = observedFingerprint;
  }
}

type IdentityRow = {
  system_identifier: string;
  database_oid: string;
  database_name: string;
  schema_oid: string;
  schema_name: string;
  current_schema_name: string | null;
  search_path: string[];
  current_user_name: string;
};

type BoolRow = { value: boolean };

type PermissionRow = {
  database_connect: boolean | null;
  database_create: boolean | null;
  schema_usage: boolean | null;
  schema_create: boolean | null;
};

type HistoryPermissionRow = {
  can_insert: boolean | null;
  can_update: boolean | null;
};

type EnumRow = {
  schema_name: string;
  enum_name: string;
  type_kind: string;
  enum_value: string | null;
  sort_order: number | null;
};

type TableRow = {
  schema_name: string;
  table_name: string;
  relation_kind: string;
  persistence: string;
  is_partition: boolean;
  inheritance_parent_count: number;
  inheritance_child_count: number;
  owner_usable: boolean | null;
  row_security_enabled: boolean;
  force_row_security: boolean;
  policy_count: number;
  rule_count: number;
  trigger_count: number;
};

type ColumnRow = {
  schema_name: string;
  table_name: string;
  column_name: string;
  formatted_type: string;
  type_schema: string;
  type_name: string;
  type_kind: string;
  nullable: boolean;
  default_expression: string | null;
  default_collation: boolean;
  identity_kind: string;
  generated_kind: string;
  can_reference: boolean | null;
};

type IndexRow = {
  schema_name: string;
  table_name: string;
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  is_valid: boolean;
  is_ready: boolean;
  method_name: string;
  keys: string[];
  key_options: number[];
  default_opclasses: boolean[];
  default_collations: boolean[];
  include_keys: string[];
  predicate: string | null;
  is_exclusion: boolean;
  nulls_not_distinct: boolean;
};

type ConstraintRow = {
  schema_name: string;
  table_name: string;
  constraint_name: string;
  constraint_type: "p" | "u" | "c" | "f";
  source_columns: string[];
  referenced_schema: string | null;
  referenced_table: string | null;
  referenced_columns: string[];
  match_type: string | null;
  on_delete: string | null;
  on_update: string | null;
  is_deferrable: boolean;
  is_initially_deferred: boolean;
  is_validated: boolean;
  check_expression: string | null;
};

type ExtensionRow = {
  extension_name: string;
  schema_name: string;
};

type HistoryRow = {
  id: string;
  migration_name: string;
  checksum: string;
  started_at: Date;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  finished: boolean;
  rolled_back: boolean;
  unresolved: boolean;
  applied_steps_count: number;
  logs_present: boolean;
};

export function validateDirectUrl(databaseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new GateDDatabaseInspectionError("DIRECT_POSTGRES_URL_REQUIRED");
  }
  const parameters = [...parsed.searchParams.entries()];
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.hostname.toLowerCase() !== "db.prisma.io" ||
    parsed.port !== "5432" ||
    parsed.hash !== "" ||
    !/^\/[^/]+$/.test(parsed.pathname) ||
    parameters.length !== 1 ||
    parameters[0]?.[0] !== "sslmode" ||
    parameters[0]?.[1] !== "require"
  ) {
    throw new GateDDatabaseInspectionError("DIRECT_POSTGRES_URL_REQUIRED");
  }
}

function actualDefault(
  expression: string | null,
): DefaultExpectation | null | { kind: "unsupported"; value: string } {
  try {
    return canonicalDefault(expression);
  } catch (error) {
    if (!(error instanceof UnsupportedMigrationSqlError)) throw error;
    return { kind: "unsupported", value: "UNSUPPORTED_CATALOG_DEFAULT" };
  }
}

function actualType(row: ColumnRow): string {
  if (row.type_kind === "e") {
    return `${row.type_schema}."${row.type_name.replace(/"/g, '""')}"`;
  }
  if (/^"(?:[^"]|"")+"\[\]$/.test(row.formatted_type)) {
    return `${row.type_schema}.${row.formatted_type}`;
  }
  return row.formatted_type.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeExpression(value: string | null): string | null {
  return value === null ? null : value.trim().replace(/\s+/g, " ");
}

function mapIdentity(row: IdentityRow | undefined): DatabaseIdentity {
  if (
    !row?.system_identifier ||
    !row.database_oid ||
    !row.database_name ||
    !row.schema_oid ||
    !row.schema_name ||
    !row.current_schema_name ||
    !Array.isArray(row.search_path) ||
    !row.current_user_name
  ) {
    throw new GateDDatabaseInspectionError("DATABASE_IDENTITY_UNAVAILABLE");
  }
  if (row.schema_name !== "public" || row.current_schema_name !== "public" || row.search_path[0] !== "public") {
    throw new GateDDatabaseInspectionError("DATABASE_SCHEMA_NOT_PUBLIC");
  }
  return {
    systemIdentifier: row.system_identifier,
    databaseOid: row.database_oid,
    databaseName: row.database_name,
    schemaOid: row.schema_oid,
    schemaName: row.schema_name,
    currentSchema: row.current_schema_name,
    searchPath: row.search_path,
    currentUser: row.current_user_name,
  };
}

async function setAndVerifyReadOnly(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
  const lock = await tx.$queryRaw<BoolRow[]>(
    Prisma.sql`SELECT pg_try_advisory_xact_lock(72707369) AS value`,
  );
  if (lock[0]?.value !== true) {
    throw new GateDDatabaseInspectionError("MIGRATION_LOCK_UNAVAILABLE");
  }
  const rows = await tx.$queryRaw<BoolRow[]>(
    Prisma.sql`SELECT current_setting('transaction_read_only') = 'on' AS value`,
  );
  if (rows[0]?.value !== true) {
    throw new GateDDatabaseInspectionError("CATALOG_PERMISSION_DENIED");
  }
}

async function readIdentity(tx: Prisma.TransactionClient): Promise<DatabaseIdentity> {
  const rows = await tx.$queryRaw<IdentityRow[]>(Prisma.sql`
    SELECT
      control.system_identifier::text AS system_identifier,
      database.oid::text AS database_oid,
      database.datname AS database_name,
      namespace.oid::text AS schema_oid,
      namespace.nspname AS schema_name,
      current_schema() AS current_schema_name,
      current_schemas(false) AS search_path,
      current_user AS current_user_name
    FROM pg_catalog.pg_database AS database
    CROSS JOIN pg_catalog.pg_control_system() AS control
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.nspname = 'public'
    WHERE database.datname = current_database()
  `);
  return mapIdentity(rows[0]);
}

async function withReadOnlyClient<T>(
  databaseUrl: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  validateDirectUrl(databaseUrl);
  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: [],
  });
  try {
    return await client.$transaction(
      async (tx) => {
        await setAndVerifyReadOnly(tx);
        return operation(tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 5_000,
        timeout: 30_000,
      },
    );
  } catch (error) {
    if (error instanceof GateDDatabaseInspectionError) throw error;
    const candidate =
      typeof error === "object" && error !== null
        ? (error as { code?: unknown; meta?: { code?: unknown } })
        : {};
    const sqlState = String(candidate.meta?.code ?? candidate.code ?? "");
    if (
      sqlState === "42501" ||
      (String(candidate.code) === "P2010" && String(candidate.meta?.code) === "42501")
    ) {
      throw new GateDDatabaseInspectionError("CATALOG_PERMISSION_DENIED");
    }
    throw new GateDDatabaseInspectionError("DATABASE_CONNECTION_FAILED");
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

export async function observeGateDDatabaseFingerprint(databaseUrl: string): Promise<string> {
  return withReadOnlyClient(databaseUrl, async (tx) => databaseFingerprint(await readIdentity(tx)));
}

export async function inspectGateDDatabase(
  databaseUrl: string,
  expectedFingerprint: string,
): Promise<CatalogSnapshot> {
  return withReadOnlyClient(databaseUrl, async (tx) => {
    const identity = await readIdentity(tx);
    const fingerprint = databaseFingerprint(identity);
    if (fingerprint !== expectedFingerprint) {
      throw new GateDDatabaseInspectionError("DATABASE_FINGERPRINT_MISMATCH", fingerprint);
    }

    const permissionRows = await tx.$queryRaw<PermissionRow[]>(Prisma.sql`
      SELECT
        has_database_privilege(current_user, current_database(), 'CONNECT') AS database_connect,
        has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
        has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
        has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create
    `);

    const historyPresence = await tx.$queryRaw<BoolRow[]>(
      Prisma.sql`SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS value`,
    );
    const historyTablePresent = historyPresence[0]?.value === true;

    const [enumRows, tableRows, columnRows, indexRows, constraintRows, extensionRows] =
      await Promise.all([
        tx.$queryRaw<EnumRow[]>(Prisma.sql`
          SELECT
            namespace.nspname AS schema_name,
            type.typname AS enum_name,
            type.typtype::text AS type_kind,
            enum.enumlabel AS enum_value,
            enum.enumsortorder::double precision AS sort_order
          FROM pg_catalog.pg_type AS type
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = type.typnamespace
          LEFT JOIN pg_catalog.pg_enum AS enum ON enum.enumtypid = type.oid
          WHERE namespace.nspname = 'public'
          ORDER BY namespace.nspname, type.typname, enum.enumsortorder NULLS FIRST
        `),
        tx.$queryRaw<TableRow[]>(Prisma.sql`
          SELECT
            namespace.nspname AS schema_name,
            relation.relname AS table_name,
            CASE relation.relkind
              WHEN 'r' THEN 'regular'
              WHEN 'p' THEN 'partitioned'
              WHEN 'v' THEN 'view'
              WHEN 'm' THEN 'materialized_view'
              WHEN 'S' THEN 'sequence'
              WHEN 'f' THEN 'foreign_table'
              WHEN 'i' THEN 'index'
              WHEN 'I' THEN 'partitioned_index'
              WHEN 'c' THEN 'composite_type'
              ELSE relation.relkind::text
            END AS relation_kind,
            CASE relation.relpersistence
              WHEN 'p' THEN 'permanent'
              WHEN 'u' THEN 'unlogged'
              WHEN 't' THEN 'temporary'
              ELSE relation.relpersistence::text
            END AS persistence,
            relation.relispartition AS is_partition,
            (
              SELECT count(*)::integer
              FROM pg_catalog.pg_inherits AS inheritance
              WHERE inheritance.inhrelid = relation.oid
            ) AS inheritance_parent_count,
            (
              SELECT count(*)::integer
              FROM pg_catalog.pg_inherits AS inheritance
              WHERE inheritance.inhparent = relation.oid
            ) AS inheritance_child_count,
            pg_has_role(current_user, relation.relowner, 'USAGE') AS owner_usable,
            relation.relrowsecurity AS row_security_enabled,
            relation.relforcerowsecurity AS force_row_security,
            (
              SELECT count(*)::integer
              FROM pg_catalog.pg_policy AS policy
              WHERE policy.polrelid = relation.oid
            ) AS policy_count,
            (
              SELECT count(*)::integer
              FROM pg_catalog.pg_rewrite AS rewrite_rule
              WHERE rewrite_rule.ev_class = relation.oid
            ) AS rule_count,
            (
              SELECT count(*)::integer
              FROM pg_catalog.pg_trigger AS trigger_meta
              WHERE trigger_meta.tgrelid = relation.oid
            ) AS trigger_count
          FROM pg_catalog.pg_class AS relation
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'public'
            AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f', 'i', 'I', 'c')
          ORDER BY namespace.nspname, relation.relname
        `),
        tx.$queryRaw<ColumnRow[]>(Prisma.sql`
          SELECT
            namespace.nspname AS schema_name,
            relation.relname AS table_name,
            attribute.attname AS column_name,
            pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) AS formatted_type,
            type_namespace.nspname AS type_schema,
            type.typname AS type_name,
            type.typtype::text AS type_kind,
            NOT attribute.attnotnull AS nullable,
            pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid, true) AS default_expression,
            attribute.attcollation = type.typcollation AS default_collation,
            attribute.attidentity::text AS identity_kind,
            attribute.attgenerated::text AS generated_kind,
            has_column_privilege(current_user, relation.oid, attribute.attnum, 'REFERENCES') AS can_reference
          FROM pg_catalog.pg_attribute AS attribute
          JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          JOIN pg_catalog.pg_type AS type ON type.oid = attribute.atttypid
          JOIN pg_catalog.pg_namespace AS type_namespace ON type_namespace.oid = type.typnamespace
          LEFT JOIN pg_catalog.pg_attrdef AS default_value
            ON default_value.adrelid = relation.oid
            AND default_value.adnum = attribute.attnum
          WHERE namespace.nspname = 'public'
            AND relation.relkind IN ('r', 'p')
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
          ORDER BY namespace.nspname, relation.relname, attribute.attnum
        `),
        tx.$queryRaw<IndexRow[]>(Prisma.sql`
          SELECT
            namespace.nspname AS schema_name,
            table_relation.relname AS table_name,
            index_relation.relname AS index_name,
            index_meta.indisunique AS is_unique,
            index_meta.indisprimary AS is_primary,
            index_meta.indisvalid AS is_valid,
            index_meta.indisready AS is_ready,
            access_method.amname AS method_name,
            ARRAY(
              SELECT CASE
                WHEN key_column.attnum = 0
                  THEN pg_catalog.pg_get_indexdef(index_meta.indexrelid, key_column.ordinality::integer, true)
                ELSE table_attribute.attname
              END
              FROM unnest(index_meta.indkey::smallint[]) WITH ORDINALITY
                AS key_column(attnum, ordinality)
              LEFT JOIN pg_catalog.pg_attribute AS table_attribute
                ON table_attribute.attrelid = index_meta.indrelid
                AND table_attribute.attnum = key_column.attnum
              WHERE key_column.ordinality <= index_meta.indnkeyatts
              ORDER BY key_column.ordinality
            ) AS keys,
            ARRAY(
              SELECT option_value::integer
              FROM unnest(index_meta.indoption::smallint[]) WITH ORDINALITY
                AS key_option(option_value, ordinality)
              WHERE key_option.ordinality <= index_meta.indnkeyatts
              ORDER BY key_option.ordinality
            ) AS key_options,
            ARRAY(
              SELECT operator_class.opcdefault
              FROM unnest(index_meta.indclass::oid[]) WITH ORDINALITY
                AS operator_class_key(operator_class_oid, ordinality)
              JOIN pg_catalog.pg_opclass AS operator_class
                ON operator_class.oid = operator_class_key.operator_class_oid
              WHERE operator_class_key.ordinality <= index_meta.indnkeyatts
              ORDER BY operator_class_key.ordinality
            ) AS default_opclasses,
            ARRAY(
              SELECT index_collation.collation_oid = COALESCE(table_attribute.attcollation, 0)
              FROM unnest(index_meta.indcollation::oid[]) WITH ORDINALITY
                AS index_collation(collation_oid, ordinality)
              JOIN unnest(index_meta.indkey::smallint[]) WITH ORDINALITY
                AS collation_key(attnum, ordinality) USING (ordinality)
              LEFT JOIN pg_catalog.pg_attribute AS table_attribute
                ON table_attribute.attrelid = index_meta.indrelid
                AND table_attribute.attnum = collation_key.attnum
              WHERE index_collation.ordinality <= index_meta.indnkeyatts
              ORDER BY index_collation.ordinality
            ) AS default_collations,
            ARRAY(
              SELECT CASE
                WHEN include_column.attnum = 0
                  THEN pg_catalog.pg_get_indexdef(index_meta.indexrelid, include_column.ordinality::integer, true)
                ELSE table_attribute.attname
              END
              FROM unnest(index_meta.indkey::smallint[]) WITH ORDINALITY
                AS include_column(attnum, ordinality)
              LEFT JOIN pg_catalog.pg_attribute AS table_attribute
                ON table_attribute.attrelid = index_meta.indrelid
                AND table_attribute.attnum = include_column.attnum
              WHERE include_column.ordinality > index_meta.indnkeyatts
              ORDER BY include_column.ordinality
            ) AS include_keys,
            pg_catalog.pg_get_expr(index_meta.indpred, index_meta.indrelid, true) AS predicate,
            index_meta.indisexclusion AS is_exclusion,
            index_meta.indnullsnotdistinct AS nulls_not_distinct
          FROM pg_catalog.pg_index AS index_meta
          JOIN pg_catalog.pg_class AS table_relation ON table_relation.oid = index_meta.indrelid
          JOIN pg_catalog.pg_class AS index_relation ON index_relation.oid = index_meta.indexrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = table_relation.relnamespace
          JOIN pg_catalog.pg_am AS access_method ON access_method.oid = index_relation.relam
          WHERE namespace.nspname = 'public'
          ORDER BY namespace.nspname, table_relation.relname, index_relation.relname
        `),
        tx.$queryRaw<ConstraintRow[]>(Prisma.sql`
          SELECT
            namespace.nspname AS schema_name,
            source_relation.relname AS table_name,
            constraint_meta.conname AS constraint_name,
            constraint_meta.contype::text AS constraint_type,
            ARRAY(
              SELECT source_attribute.attname
              FROM unnest(COALESCE(constraint_meta.conkey, ARRAY[]::smallint[]))
                WITH ORDINALITY AS source_key(attnum, ordinality)
              JOIN pg_catalog.pg_attribute AS source_attribute
                ON source_attribute.attrelid = constraint_meta.conrelid
                AND source_attribute.attnum = source_key.attnum
              ORDER BY source_key.ordinality
            ) AS source_columns,
            referenced_namespace.nspname AS referenced_schema,
            referenced_relation.relname AS referenced_table,
            ARRAY(
              SELECT referenced_attribute.attname
              FROM unnest(COALESCE(constraint_meta.confkey, ARRAY[]::smallint[]))
                WITH ORDINALITY AS referenced_key(attnum, ordinality)
              JOIN pg_catalog.pg_attribute AS referenced_attribute
                ON referenced_attribute.attrelid = constraint_meta.confrelid
                AND referenced_attribute.attnum = referenced_key.attnum
              ORDER BY referenced_key.ordinality
            ) AS referenced_columns,
            CASE constraint_meta.confmatchtype
              WHEN 's' THEN 'SIMPLE'
              WHEN 'f' THEN 'FULL'
              WHEN 'p' THEN 'PARTIAL'
              ELSE NULL
            END AS match_type,
            CASE constraint_meta.confdeltype
              WHEN 'a' THEN 'NO ACTION'
              WHEN 'r' THEN 'RESTRICT'
              WHEN 'c' THEN 'CASCADE'
              WHEN 'n' THEN 'SET NULL'
              WHEN 'd' THEN 'SET DEFAULT'
              ELSE NULL
            END AS on_delete,
            CASE constraint_meta.confupdtype
              WHEN 'a' THEN 'NO ACTION'
              WHEN 'r' THEN 'RESTRICT'
              WHEN 'c' THEN 'CASCADE'
              WHEN 'n' THEN 'SET NULL'
              WHEN 'd' THEN 'SET DEFAULT'
              ELSE NULL
            END AS on_update,
            constraint_meta.condeferrable AS is_deferrable,
            constraint_meta.condeferred AS is_initially_deferred,
            constraint_meta.convalidated AS is_validated,
            pg_catalog.pg_get_expr(constraint_meta.conbin, constraint_meta.conrelid, true) AS check_expression
          FROM pg_catalog.pg_constraint AS constraint_meta
          JOIN pg_catalog.pg_class AS source_relation ON source_relation.oid = constraint_meta.conrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = source_relation.relnamespace
          LEFT JOIN pg_catalog.pg_class AS referenced_relation
            ON referenced_relation.oid = constraint_meta.confrelid
          LEFT JOIN pg_catalog.pg_namespace AS referenced_namespace
            ON referenced_namespace.oid = referenced_relation.relnamespace
          WHERE namespace.nspname = 'public'
            AND constraint_meta.contype IN ('p', 'u', 'c', 'f')
          ORDER BY namespace.nspname, source_relation.relname, constraint_meta.conname
        `),
        tx.$queryRaw<ExtensionRow[]>(Prisma.sql`
          SELECT
            extension.extname AS extension_name,
            namespace.nspname AS schema_name
          FROM pg_catalog.pg_extension AS extension
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = extension.extnamespace
          ORDER BY extension.extname
        `),
      ]);

    const historyRelation = tableRows.find(
      (row) => row.schema_name === "public" && row.table_name === "_prisma_migrations",
    );
    const historyTable: MigrationHistoryTable | null = historyTablePresent
      ? {
          relationKind: historyRelation?.relation_kind ?? "missing",
          persistence: historyRelation?.persistence ?? "missing",
          isPartition: historyRelation?.is_partition ?? true,
          inheritanceParentCount: historyRelation?.inheritance_parent_count ?? -1,
          inheritanceChildCount: historyRelation?.inheritance_child_count ?? -1,
          rowSecurityEnabled: historyRelation?.row_security_enabled ?? true,
          forceRowSecurity: historyRelation?.force_row_security ?? true,
          policyCount: historyRelation?.policy_count ?? -1,
          ruleCount: historyRelation?.rule_count ?? -1,
          triggerCount: historyRelation?.trigger_count ?? -1,
          columns: columnRows
            .filter(
              (row) => row.schema_name === "public" && row.table_name === "_prisma_migrations",
            )
            .map((row) => ({
              name: row.column_name,
              type: actualType(row),
              nullable: row.nullable,
              defaultExpression: normalizeExpression(row.default_expression),
              identityKind: row.identity_kind,
              generatedKind: row.generated_kind,
            })),
          constraints: constraintRows
            .filter(
              (row) => row.schema_name === "public" && row.table_name === "_prisma_migrations",
            )
            .map((row) => ({
              kind:
                row.constraint_type === "p"
                  ? "PRIMARY_KEY"
                  : row.constraint_type === "u"
                    ? "UNIQUE"
                    : row.constraint_type === "c"
                      ? "CHECK"
                      : "FOREIGN_KEY",
              columns: row.source_columns,
            })),
        }
      : null;
    const trustedHistoryTable = historyTable !== null && migrationHistoryTrustIssues(historyTable).length === 0;
    const [historyRows, historyPermissionRows] = trustedHistoryTable
      ? await Promise.all([
          tx.$queryRaw<HistoryRow[]>(Prisma.sql`
            SELECT
              id,
              migration_name,
              checksum,
              started_at,
              finished_at,
              rolled_back_at,
              finished_at IS NOT NULL AS finished,
              rolled_back_at IS NOT NULL AS rolled_back,
              finished_at IS NULL AND rolled_back_at IS NULL AS unresolved,
              applied_steps_count::integer AS applied_steps_count,
              COALESCE(logs, '') <> '' AS logs_present
            FROM public."_prisma_migrations"
            ORDER BY migration_name, id
          `),
          tx.$queryRaw<HistoryPermissionRow[]>(Prisma.sql`
            SELECT
              has_table_privilege(current_user, 'public."_prisma_migrations"', 'INSERT') AS can_insert,
              has_table_privilege(current_user, 'public."_prisma_migrations"', 'UPDATE') AS can_update
          `),
        ])
      : [[], []];

    const enumsByName = new Map<string, ActualEnum>();
    for (const row of enumRows) {
      const key = `${row.schema_name}.${row.enum_name}`;
      const current = enumsByName.get(key) ?? {
        schema: row.schema_name,
        name: row.enum_name,
        kind: row.type_kind === "e" ? "enum" : row.type_kind,
        values: [],
      };
      if (row.enum_value !== null) current.values.push(row.enum_value);
      enumsByName.set(key, current);
    }

    const tables: ActualTable[] = tableRows.map((row) => ({
      schema: row.schema_name,
      name: row.table_name,
      relationKind: row.relation_kind,
      persistence: row.persistence,
      ownerUsable: row.owner_usable,
    }));
    const columns: ActualColumn[] = columnRows.map((row) => ({
      schema: row.schema_name,
      table: row.table_name,
      name: row.column_name,
      type: actualType(row),
      nullable: row.nullable,
      default: actualDefault(row.default_expression),
      defaultCollation: row.default_collation,
      identity: row.identity_kind,
      generated: row.generated_kind,
    }));
    const indexes: ActualIndex[] = indexRows.map((row) => ({
      schema: row.schema_name,
      table: row.table_name,
      name: row.index_name,
      unique: row.is_unique,
      primary: row.is_primary,
      valid: row.is_valid,
      ready: row.is_ready,
      method: row.method_name,
      keys: row.keys,
      keyOptions: row.key_options,
      defaultOpclasses: row.default_opclasses,
      defaultCollations: row.default_collations,
      includeKeys: row.include_keys,
      predicate: normalizeExpression(row.predicate),
      exclusion: row.is_exclusion,
      nullsNotDistinct: row.nulls_not_distinct,
    }));

    const constraints: ActualConstraint[] = constraintRows
      .filter((row) => row.constraint_type !== "f")
      .map((row) => ({
        schema: row.schema_name,
        table: row.table_name,
        name: row.constraint_name,
        kind:
          row.constraint_type === "p"
            ? "PRIMARY_KEY"
            : row.constraint_type === "u"
              ? "UNIQUE"
              : "CHECK",
        columns: row.source_columns,
        expression: normalizeExpression(row.check_expression),
        deferrable: row.is_deferrable,
        initiallyDeferred: row.is_initially_deferred,
        validated: row.is_validated,
      }));
    const foreignKeys: ActualForeignKey[] = constraintRows
      .filter((row) => row.constraint_type === "f")
      .map((row) => ({
        schema: row.schema_name,
        table: row.table_name,
        name: row.constraint_name,
        columns: row.source_columns,
        referencedSchema: row.referenced_schema ?? "",
        referencedTable: row.referenced_table ?? "",
        referencedColumns: row.referenced_columns,
        matchType: row.match_type ?? "",
        onDelete: row.on_delete ?? "",
        onUpdate: row.on_update ?? "",
        deferrable: row.is_deferrable,
        initiallyDeferred: row.is_initially_deferred,
        validated: row.is_validated,
      }));
    const extensions: ActualExtension[] = extensionRows.map((row) => ({
      name: row.extension_name,
      schema: row.schema_name,
    }));

    const relationPrivileges = new Map<string, RelationPrivilege>();
    for (const table of tableRows) {
      if (!["regular", "partitioned"].includes(table.relation_kind)) continue;
      relationPrivileges.set(`${table.schema_name}.${table.table_name}`, {
        schema: table.schema_name,
        table: table.table_name,
        ownerUsable: table.owner_usable,
        references: {},
      });
    }
    for (const column of columnRows) {
      const relation = relationPrivileges.get(`${column.schema_name}.${column.table_name}`);
      if (relation) relation.references[column.column_name] = column.can_reference;
    }

    const permission = permissionRows[0];
    const historyPermission = historyPermissionRows[0];
    const permissions: CatalogPermissions = {
      transactionReadOnly: true,
      migrationLockHeld: true,
      catalogReadable: true,
      historyReadable: historyTablePresent && !trustedHistoryTable ? null : true,
      historyInsert: trustedHistoryTable ? (historyPermission?.can_insert ?? null) : null,
      historyUpdate: trustedHistoryTable ? (historyPermission?.can_update ?? null) : null,
      databaseConnect: permission?.database_connect ?? null,
      databaseCreate: permission?.database_create ?? null,
      schemaUsage: permission?.schema_usage ?? null,
      schemaCreate: permission?.schema_create ?? null,
      relations: Array.from(relationPrivileges.values()).sort((left, right) =>
        `${left.schema}.${left.table}`.localeCompare(`${right.schema}.${right.table}`),
      ),
    };

    return {
      identity,
      fingerprint,
      historyTable,
      historyRows: historyRows.map(
        (row): MigrationHistoryRow => ({
          id: row.id,
          migrationName: row.migration_name,
          checksum: row.checksum,
          startedAt: row.started_at.toISOString(),
          finishedAt: row.finished_at?.toISOString() ?? null,
          rolledBackAt: row.rolled_back_at?.toISOString() ?? null,
          finished: row.finished,
          rolledBack: row.rolled_back,
          unresolved: row.unresolved,
          appliedStepsCount: row.applied_steps_count,
          logsPresent: row.logs_present,
        }),
      ),
      enums: Array.from(enumsByName.values()),
      tables,
      columns,
      indexes,
      constraints,
      foreignKeys,
      extensions,
      permissions,
    };
  });
}
