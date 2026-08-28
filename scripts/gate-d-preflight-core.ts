import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// THE REVIEWED, APPLIED Gate D chain. This is the schema the preflight compares a
// live database against, so a name may be added here ONLY once its migration has
// been reviewed AND applied as part of a Gate D release. Everything downstream —
// applied-manifest contents, coverage counts, and every fixture's applied set —
// is derived from exactly this list.
//
// HELD POST-DB5 CANONICALIZATION: the last two entries are eligible to become
// canonical here only after Control Tower retains successful DB5 execution
// evidence for those exact SQL checksums in this exact lexical order. This patch
// must not land before that evidence exists; its presence in a review branch is
// not evidence that DB5 ran.
export const GATE_D_MIGRATION_CHAIN = [
  "0_init",
  "20260720204355_operator_network_messages",
  "20260720223438_event_bus",
  "20260720231803_event_bus_agency_index",
  "20260721120000_operator_identity",
  "20260721160000_operator_reputation",
  "20260728000000_terms_acceptance",
  "20260823120000_consumer_assertion",
] as const;

// AUTHORED-BUT-UNAPPLIED migration directories awaiting a future owner-gated
// release step. The held post-DB5 state has no such directories.
//
// `loadGateDManifest` pins the migration DIRECTORY SET as a drift tripwire: an
// unreviewed folder appearing under prisma/migrations must fail loudly. In this
// held post-DB5 state, the directory set and applied chain are the same exact
// eight names. If a later owner-gated release authors an unapplied migration,
// this second exact list makes the intentional difference explicit without
// relaxing the tripwire.
//
// An entry here is ACKNOWLEDGED ON DISK AND REQUIRED ABSENT FROM THE DATABASE.
// It is deliberately NOT part of GATE_D_MIGRATION_CHAIN and contributes nothing
// to applied coverage. `loadGateDManifest` still parses and hashes its SQL so the
// separate pre-DB5 absence gate can prove every authored table, column, primary
// key/index, explicit index and foreign key — plus every same-name history row —
// is absent. When one is applied in a future reviewed release it MOVES to the
// chain above; it is never in both.
//
// A later slice appends its exact reviewed name and updates the exact-set tests;
// it never relaxes the set into a prefix or length check.
export const AUTHORED_UNAPPLIED_MIGRATIONS = [] as const;

// Every directory legitimately present under prisma/migrations: the applied
// chain plus the authored-but-unapplied set. Anything else is drift.
export const EXPECTED_MIGRATION_DIRECTORIES = [
  ...GATE_D_MIGRATION_CHAIN,
  ...AUTHORED_UNAPPLIED_MIGRATIONS,
] as const;

export type MigrationState =
  | "ALL_PRESENT_AND_MATCHING"
  | "ALL_ABSENT"
  | "PARTIAL"
  | "DRIFTED"
  | "HISTORY_ONLY"
  | "SCHEMA_ONLY"
  | "UNKNOWN";

export type PhysicalMigrationState = "ALL_PRESENT" | "ALL_ABSENT" | "PARTIAL" | "DRIFTED" | "UNKNOWN";

export type DefaultExpectation =
  | { kind: "boolean"; value: boolean }
  | { kind: "current_timestamp" }
  | { kind: "empty_array"; elementType: string }
  | { kind: "number"; value: string }
  | { kind: "string"; value: string };

export interface EnumExpectation {
  schema: string;
  name: string;
  values: string[];
}

export interface ColumnExpectation {
  name: string;
  type: string;
  nullable: boolean;
  default: DefaultExpectation | null;
}

export interface KeyExpectation {
  schema: string;
  table: string;
  name: string;
  columns: string[];
}

export interface CheckExpectation {
  schema: string;
  table: string;
  name: string;
  expression: string;
}

export interface TableExpectation {
  schema: string;
  name: string;
  columns: ColumnExpectation[];
  primaryKey: KeyExpectation | null;
  uniqueConstraints: KeyExpectation[];
  checkConstraints: CheckExpectation[];
}

export interface IndexExpectation {
  schema: string;
  table: string;
  name: string;
  unique: boolean;
  method: "btree";
  keys: string[];
  predicate: null;
}

export interface ForeignKeyExpectation {
  schema: string;
  table: string;
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
  matchType: "SIMPLE";
  onDelete: "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET DEFAULT";
  onUpdate: "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET DEFAULT";
  deferrable: false;
  initiallyDeferred: false;
  validated: true;
}

export interface ExtensionExpectation {
  name: string;
  schema: string | null;
}

export interface MigrationExpectation {
  name: string;
  checksum: string;
  sqlBytes: number;
  enums: EnumExpectation[];
  tables: TableExpectation[];
  indexes: IndexExpectation[];
  foreignKeys: ForeignKeyExpectation[];
  extensions: ExtensionExpectation[];
}

export interface GateDManifest {
  formatVersion: 1;
  defaultSchema: "public";
  migrations: MigrationExpectation[];
  authoredUnappliedMigrations: MigrationExpectation[];
  manifestHash: string;
}

export interface Db5DeployCandidate {
  name: string;
  checksum: string;
}

export interface DatabaseIdentity {
  systemIdentifier: string;
  databaseOid: string;
  databaseName: string;
  schemaOid: string;
  schemaName: string;
  currentSchema: string;
  searchPath: string[];
  currentUser: string;
}

export interface ActualEnum {
  schema: string;
  name: string;
  kind: string;
  values: string[];
}

export interface ActualColumn {
  schema: string;
  table: string;
  name: string;
  type: string;
  nullable: boolean;
  default: DefaultExpectation | null | { kind: "unsupported"; value: string };
  defaultCollation: boolean;
  identity: string;
  generated: string;
}

export interface ActualTable {
  schema: string;
  name: string;
  relationKind: string;
  persistence: string;
  isPartition: boolean;
  inheritanceParentCount: number;
  inheritanceChildCount: number;
  rowSecurityEnabled: boolean;
  forceRowSecurity: boolean;
  policyCount: number;
  ruleCount: number;
  triggerCount: number;
  ownerUsable: boolean | null;
}

export interface ActualIndex {
  schema: string;
  table: string;
  name: string;
  unique: boolean;
  primary: boolean;
  valid: boolean;
  ready: boolean;
  method: string;
  keys: string[];
  keyOptions: number[];
  defaultOpclasses: boolean[];
  defaultCollations: boolean[];
  includeKeys: string[];
  predicate: string | null;
  exclusion: boolean;
  nullsNotDistinct: boolean;
}

export interface ActualConstraint {
  schema: string;
  table: string;
  name: string;
  kind: "PRIMARY_KEY" | "UNIQUE" | "CHECK";
  columns: string[];
  expression: string | null;
  deferrable: boolean;
  initiallyDeferred: boolean;
  validated: boolean;
}

export interface ActualForeignKey {
  schema: string;
  table: string;
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
  matchType: string;
  onDelete: string;
  onUpdate: string;
  deferrable: boolean;
  initiallyDeferred: boolean;
  validated: boolean;
}

export interface ActualExtension {
  name: string;
  schema: string;
}

export interface MigrationHistoryRow {
  id: string;
  migrationName: string;
  checksum: string;
  startedAt: string;
  finishedAt: string | null;
  rolledBackAt: string | null;
  finished: boolean;
  rolledBack: boolean;
  unresolved: boolean;
  appliedStepsCount: number;
  logsPresent: boolean;
}

export interface MigrationHistoryColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultExpression: string | null;
  identityKind: string;
  generatedKind: string;
}

export interface MigrationHistoryConstraint {
  kind: "PRIMARY_KEY" | "UNIQUE" | "CHECK" | "FOREIGN_KEY";
  columns: string[];
}

export interface MigrationHistoryTable {
  relationKind: string;
  persistence: string;
  isPartition: boolean;
  inheritanceParentCount: number;
  inheritanceChildCount: number;
  rowSecurityEnabled: boolean;
  forceRowSecurity: boolean;
  policyCount: number;
  ruleCount: number;
  triggerCount: number;
  columns: MigrationHistoryColumn[];
  constraints: MigrationHistoryConstraint[];
}

export interface RelationPrivilege {
  schema: string;
  table: string;
  ownerUsable: boolean | null;
  references: Record<string, boolean | null>;
}

export interface CatalogPermissions {
  transactionReadOnly: boolean | null;
  migrationLockHeld: boolean | null;
  catalogReadable: boolean | null;
  historyReadable: boolean | null;
  historyInsert: boolean | null;
  historyUpdate: boolean | null;
  databaseConnect: boolean | null;
  databaseCreate: boolean | null;
  schemaUsage: boolean | null;
  schemaCreate: boolean | null;
  relations: RelationPrivilege[];
}

export interface CatalogSnapshot {
  identity: DatabaseIdentity;
  fingerprint: string;
  historyTable: MigrationHistoryTable | null;
  historyRows: MigrationHistoryRow[];
  enums: ActualEnum[];
  tables: ActualTable[];
  columns: ActualColumn[];
  indexes: ActualIndex[];
  constraints: ActualConstraint[];
  foreignKeys: ActualForeignKey[];
  extensions: ActualExtension[];
  permissions: CatalogPermissions;
}

export interface Difference {
  path: string;
  expected?: unknown;
  actual?: unknown;
}

export interface MigrationComparison {
  expectedComponents: number;
  matchedComponents: number;
  expectedRoots: number;
  presentRoots: number;
  missing: Difference[];
  mismatched: Difference[];
}

export interface PrivilegeCheck {
  name: string;
  status: "PASS" | "FAIL" | "NOT_REQUIRED" | "UNKNOWN";
}

export interface MigrationReport {
  name: string;
  state: MigrationState;
  physicalState: PhysicalMigrationState;
  history: "APPLIED" | "ABSENT" | "AMBIGUOUS" | "CHECKSUM_MISMATCH" | "INVALID";
  historyEvidence: Array<{
    id: string;
    checksumMatches: boolean;
    startedAt: string;
    finishedAt: string | null;
    rolledBackAt: string | null;
    unresolved: boolean;
    appliedStepsCount: number;
    logsPresent: boolean;
  }>;
  expectedComponents: number;
  matchedComponents: number;
  expectedRoots: number;
  presentRoots: number;
  missingCount: number;
  mismatchCount: number;
  differences: Difference[];
}

export interface AuthoredUnappliedAbsenceReport {
  name: string;
  state: "ALL_ABSENT" | "PRESENT" | "UNKNOWN";
  physicalState: "ALL_ABSENT" | "PRESENT" | "UNKNOWN";
  history: "ABSENT" | "PRESENT" | "UNKNOWN";
  expectedPhysicalObjects: string[];
  presentPhysicalObjects: string[];
  historyEvidence: MigrationReport["historyEvidence"];
}

export interface PreDb5AbsenceGateReport {
  decision: "PASS" | "ABORT" | "UNKNOWN" | "NOT_REQUIRED";
  deployCandidateList: Db5DeployCandidate[];
  mutationAuthorized: false;
  requiredState: "ALL_ABSENT";
  migrations: AuthoredUnappliedAbsenceReport[];
}

export interface PreflightReport {
  formatVersion: 1;
  decision:
    | "READY_FOR_OWNER_APPROVAL"
    | "READY_FOR_DB5_APPROVAL"
    | "NO_PENDING_MIGRATIONS"
    | "OWNER_BASELINE_REVIEW_REQUIRED"
    | "ABORT";
  manifestHash: string;
  coverage: ReturnType<typeof manifestCoverage>;
  database: {
    expectedFingerprint: string | null;
    observedFingerprint: string | null;
    matched: boolean | null;
    identitySource: "pg_control_system+pg_database+pg_namespace";
    fingerprintScope: "CONSISTENCY_EVIDENCE_ONLY";
  };
  migrations: MigrationReport[];
  preDb5AbsenceGate: PreDb5AbsenceGateReport;
  privilegeChecks: PrivilegeCheck[];
  proposedResolveList: string[];
  pendingDeployList: string[];
  stopReasons: string[];
  mutationAuthorized: false;
}

export class UnsupportedMigrationSqlError extends Error {
  readonly statement: string;

  constructor(statement: string) {
    super("Unsupported migration SQL");
    this.name = "UnsupportedMigrationSqlError";
    this.statement = statement;
  }
}

const qident = String.raw`"(?:[^"]|"")*"`;
const qname = String.raw`(?:${qident}\.)?${qident}`;

function unquoteIdentifier(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    throw new UnsupportedMigrationSqlError(value);
  }
  return value.slice(1, -1).replace(/""/g, '"');
}

function parseQualifiedName(value: string, defaultSchema = "public"): { schema: string; name: string } {
  const match = value.trim().match(new RegExp(`^(?:(${qident})\\.)?(${qident})$`));
  if (!match) throw new UnsupportedMigrationSqlError(value);
  return {
    schema: match[1] ? unquoteIdentifier(match[1]) : defaultSchema,
    name: unquoteIdentifier(match[2]),
  };
}

function stripSqlComments(sql: string): string {
  let result = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index++) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        result += "\n";
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (!singleQuoted && !doubleQuoted && char === "-" && next === "-") {
      lineComment = true;
      index++;
      continue;
    }
    if (!singleQuoted && !doubleQuoted && char === "/" && next === "*") {
      blockComment = true;
      index++;
      continue;
    }
    if (!doubleQuoted && char === "'") {
      result += char;
      if (singleQuoted && next === "'") {
        result += next;
        index++;
      } else {
        singleQuoted = !singleQuoted;
      }
      continue;
    }
    if (!singleQuoted && char === '"') {
      result += char;
      if (doubleQuoted && next === '"') {
        result += next;
        index++;
      } else {
        doubleQuoted = !doubleQuoted;
      }
      continue;
    }
    result += char;
  }

  if (singleQuoted || doubleQuoted || blockComment) {
    throw new UnsupportedMigrationSqlError("unterminated SQL quote or comment");
  }
  return result;
}

function splitSql(sql: string, delimiter: "," | ";"): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let singleQuoted = false;
  let doubleQuoted = false;

  for (let index = 0; index < sql.length; index++) {
    const char = sql[index];
    const next = sql[index + 1];
    if (!doubleQuoted && char === "'") {
      current += char;
      if (singleQuoted && next === "'") {
        current += next;
        index++;
      } else {
        singleQuoted = !singleQuoted;
      }
      continue;
    }
    if (!singleQuoted && char === '"') {
      current += char;
      if (doubleQuoted && next === '"') {
        current += next;
        index++;
      } else {
        doubleQuoted = !doubleQuoted;
      }
      continue;
    }
    if (!singleQuoted && !doubleQuoted) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === delimiter && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  if (singleQuoted || doubleQuoted || depth !== 0) {
    throw new UnsupportedMigrationSqlError(sql);
  }
  return parts;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function parseSqlString(value: string): string {
  const match = value.trim().match(/^'((?:[^']|'')*)'$/);
  if (!match) throw new UnsupportedMigrationSqlError(value);
  return match[1].replace(/''/g, "'");
}

function canonicalType(value: string): string {
  const type = normalizeWhitespace(value);
  const upper = type.toUpperCase();
  const builtins: Record<string, string> = {
    TEXT: "text",
    "TEXT[]": "text[]",
    BOOLEAN: "boolean",
    INTEGER: "integer",
    BIGINT: "bigint",
    "DOUBLE PRECISION": "double precision",
    JSONB: "jsonb",
    BYTEA: "bytea",
  };
  if (builtins[upper]) return builtins[upper];
  const timestamp = upper.match(/^TIMESTAMP\((\d+)\)$/);
  if (timestamp) return `timestamp(${timestamp[1]}) without time zone`;
  const custom = type.match(new RegExp(`^(${qname})(\\[\\])?$`));
  if (custom) {
    const parsed = parseQualifiedName(custom[1]);
    return `${parsed.schema}."${parsed.name.replace(/"/g, '""')}"${custom[2] ?? ""}`;
  }
  throw new UnsupportedMigrationSqlError(`column type: ${value}`);
}

export function canonicalDefault(value: string | null): DefaultExpectation | null {
  if (value === null) return null;
  let expression = normalizeWhitespace(value);
  while (expression.startsWith("(") && expression.endsWith(")")) {
    expression = expression.slice(1, -1).trim();
  }
  if (/^CURRENT_TIMESTAMP$/i.test(expression)) return { kind: "current_timestamp" };
  const emptyArray = expression.match(/^ARRAY\[\]::([A-Za-z ]+)\[\]$/i);
  if (emptyArray) {
    return { kind: "empty_array", elementType: normalizeWhitespace(emptyArray[1]).toLowerCase() };
  }
  const castEmptyArray = expression.match(/^'\{\}'::([A-Za-z ]+)\[\]$/i);
  if (castEmptyArray) {
    return { kind: "empty_array", elementType: normalizeWhitespace(castEmptyArray[1]).toLowerCase() };
  }
  if (/^(true|false)$/i.test(expression)) {
    return { kind: "boolean", value: expression.toLowerCase() === "true" };
  }
  if (/^-?(?:\d+)(?:\.\d+)?$/.test(expression)) {
    return { kind: "number", value: expression };
  }
  const stringMatch = expression.match(/^'((?:[^']|'')*)'(?:\s*::[\s\S]+)?$/);
  if (stringMatch) {
    return { kind: "string", value: stringMatch[1].replace(/''/g, "'") };
  }
  throw new UnsupportedMigrationSqlError(`default expression: ${value}`);
}

function parseIdentifierList(value: string): string[] {
  return splitSql(value, ",").map((part) => {
    if (!new RegExp(`^${qident}$`).test(part)) throw new UnsupportedMigrationSqlError(part);
    return unquoteIdentifier(part);
  });
}

function parseColumn(statement: string): ColumnExpectation {
  const identifier = statement.match(new RegExp(`^(${qident})\\s+([\\s\\S]+)$`));
  if (!identifier) throw new UnsupportedMigrationSqlError(statement);
  const name = unquoteIdentifier(identifier[1]);
  let remainder = identifier[2].trim();
  let defaultExpression: string | null = null;
  const defaultMatch = remainder.match(/\s+DEFAULT\s+([\s\S]+)$/i);
  if (defaultMatch) {
    defaultExpression = defaultMatch[1].trim();
    remainder = remainder.slice(0, defaultMatch.index!).trim();
  }
  const nullable = !/\s+NOT\s+NULL$/i.test(remainder);
  if (!nullable) remainder = remainder.replace(/\s+NOT\s+NULL$/i, "").trim();
  if (/\b(?:PRIMARY\s+KEY|UNIQUE|CHECK|REFERENCES|GENERATED|COLLATE)\b/i.test(remainder)) {
    throw new UnsupportedMigrationSqlError(statement);
  }
  return {
    name,
    type: canonicalType(remainder),
    nullable,
    default: canonicalDefault(defaultExpression),
  };
}

function parseTable(statement: string): TableExpectation {
  const match = statement.match(new RegExp(`^CREATE\\s+TABLE\\s+(${qname})\\s*\\(([\\s\\S]*)\\)$`, "i"));
  if (!match) throw new UnsupportedMigrationSqlError(statement);
  const table = parseQualifiedName(match[1]);
  const result: TableExpectation = {
    ...table,
    columns: [],
    primaryKey: null,
    uniqueConstraints: [],
    checkConstraints: [],
  };

  for (const entry of splitSql(match[2], ",")) {
    if (entry.startsWith('"')) {
      result.columns.push(parseColumn(entry));
      continue;
    }
    const primary = entry.match(new RegExp(`^CONSTRAINT\\s+(${qident})\\s+PRIMARY\\s+KEY\\s*\\(([\\s\\S]+)\\)$`, "i"));
    if (primary) {
      if (result.primaryKey) throw new UnsupportedMigrationSqlError(entry);
      result.primaryKey = {
        schema: table.schema,
        table: table.name,
        name: unquoteIdentifier(primary[1]),
        columns: parseIdentifierList(primary[2]),
      };
      continue;
    }
    const unique = entry.match(new RegExp(`^CONSTRAINT\\s+(${qident})\\s+UNIQUE\\s*\\(([\\s\\S]+)\\)$`, "i"));
    if (unique) {
      result.uniqueConstraints.push({
        schema: table.schema,
        table: table.name,
        name: unquoteIdentifier(unique[1]),
        columns: parseIdentifierList(unique[2]),
      });
      continue;
    }
    const check = entry.match(new RegExp(`^CONSTRAINT\\s+(${qident})\\s+CHECK\\s*\\(([\\s\\S]+)\\)$`, "i"));
    if (check) {
      result.checkConstraints.push({
        schema: table.schema,
        table: table.name,
        name: unquoteIdentifier(check[1]),
        expression: normalizeWhitespace(check[2]),
      });
      continue;
    }
    throw new UnsupportedMigrationSqlError(entry);
  }

  if (result.columns.length === 0) throw new UnsupportedMigrationSqlError(statement);
  return result;
}

function parseEnum(statement: string): EnumExpectation {
  const match = statement.match(new RegExp(`^CREATE\\s+TYPE\\s+(${qname})\\s+AS\\s+ENUM\\s*\\(([\\s\\S]+)\\)$`, "i"));
  if (!match) throw new UnsupportedMigrationSqlError(statement);
  return {
    ...parseQualifiedName(match[1]),
    values: splitSql(match[2], ",").map(parseSqlString),
  };
}

function parseIndex(statement: string): IndexExpectation {
  const match = statement.match(
    new RegExp(
      `^CREATE\\s+(UNIQUE\\s+)?INDEX\\s+(${qident})\\s+ON\\s+(${qname})(?:\\s+USING\\s+([A-Za-z0-9_]+))?\\s*\\(([\\s\\S]+)\\)(?:\\s+WHERE\\s+([\\s\\S]+))?$`,
      "i",
    ),
  );
  if (!match) throw new UnsupportedMigrationSqlError(statement);
  const table = parseQualifiedName(match[3]);
  const method = (match[4] ?? "btree").toLowerCase();
  if (method !== "btree" || match[6]) throw new UnsupportedMigrationSqlError(statement);
  return {
    schema: table.schema,
    table: table.name,
    name: unquoteIdentifier(match[2]),
    unique: Boolean(match[1]),
    method: "btree",
    keys: parseIdentifierList(match[5]),
    predicate: null,
  };
}

function parseForeignKey(statement: string): ForeignKeyExpectation {
  const match = statement.match(
    new RegExp(
      `^ALTER\\s+TABLE\\s+(${qname})\\s+ADD\\s+CONSTRAINT\\s+(${qident})\\s+FOREIGN\\s+KEY\\s*\\(([\\s\\S]+?)\\)\\s+REFERENCES\\s+(${qname})\\s*\\(([\\s\\S]+?)\\)\\s+ON\\s+DELETE\\s+(NO\\s+ACTION|RESTRICT|CASCADE|SET\\s+NULL|SET\\s+DEFAULT)\\s+ON\\s+UPDATE\\s+(NO\\s+ACTION|RESTRICT|CASCADE|SET\\s+NULL|SET\\s+DEFAULT)$`,
      "i",
    ),
  );
  if (!match) throw new UnsupportedMigrationSqlError(statement);
  const table = parseQualifiedName(match[1]);
  const referenced = parseQualifiedName(match[4]);
  return {
    schema: table.schema,
    table: table.name,
    name: unquoteIdentifier(match[2]),
    columns: parseIdentifierList(match[3]),
    referencedSchema: referenced.schema,
    referencedTable: referenced.name,
    referencedColumns: parseIdentifierList(match[5]),
    matchType: "SIMPLE",
    onDelete: normalizeWhitespace(match[6]).toUpperCase() as ForeignKeyExpectation["onDelete"],
    onUpdate: normalizeWhitespace(match[7]).toUpperCase() as ForeignKeyExpectation["onUpdate"],
    deferrable: false,
    initiallyDeferred: false,
    validated: true,
  };
}

function parseExtension(statement: string): ExtensionExpectation {
  const match = statement.match(
    new RegExp(`^CREATE\\s+EXTENSION(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(${qident})(?:\\s+WITH\\s+SCHEMA\\s+(${qident}))?$`, "i"),
  );
  if (!match) throw new UnsupportedMigrationSqlError(statement);
  return {
    name: unquoteIdentifier(match[1]),
    schema: match[2] ? unquoteIdentifier(match[2]) : null,
  };
}

export function parseMigrationSql(name: string, sql: string): MigrationExpectation {
  const migration: MigrationExpectation = {
    name,
    checksum: createHash("sha256").update(sql).digest("hex"),
    sqlBytes: Buffer.byteLength(sql),
    enums: [],
    tables: [],
    indexes: [],
    foreignKeys: [],
    extensions: [],
  };

  const statements = splitSql(stripSqlComments(sql), ";");
  for (const statement of statements) {
    const normalized = statement.trim();
    if (/^CREATE\s+TYPE\b/i.test(normalized)) migration.enums.push(parseEnum(normalized));
    else if (/^CREATE\s+TABLE\b/i.test(normalized)) migration.tables.push(parseTable(normalized));
    else if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(normalized)) migration.indexes.push(parseIndex(normalized));
    else if (/^ALTER\s+TABLE\b/i.test(normalized)) migration.foreignKeys.push(parseForeignKey(normalized));
    else if (/^CREATE\s+EXTENSION\b/i.test(normalized)) migration.extensions.push(parseExtension(normalized));
    else throw new UnsupportedMigrationSqlError(normalized);
  }
  return migration;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function loadGateDManifest(repoRoot: string): GateDManifest {
  const migrationsRoot = join(repoRoot, "prisma", "migrations");
  const discovered = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  // Directory set, not merely applied set: a future authored-but-unapplied
  // migration is a legitimate folder, but any unreviewed ninth directory still
  // fails. The held post-DB5 set is exactly the eight canonical chain entries.
  const expected = [...EXPECTED_MIGRATION_DIRECTORIES].sort();
  if (!same(discovered, expected)) {
    throw new UnsupportedMigrationSqlError(
      `migration directory set: expected=${expected.join(",")} actual=${discovered.join(",")}`,
    );
  }
  const readMigration = (name: string) => {
    const sql = readFileSync(join(migrationsRoot, name, "migration.sql"), "utf8");
    return parseMigrationSql(name, sql);
  };
  const migrations = GATE_D_MIGRATION_CHAIN.map(readMigration);
  const authoredUnappliedMigrations = AUTHORED_UNAPPLIED_MIGRATIONS.map(readMigration);
  const withoutHash = {
    formatVersion: 1 as const,
    defaultSchema: "public" as const,
    migrations,
    authoredUnappliedMigrations,
  };
  return {
    ...withoutHash,
    manifestHash: createHash("sha256").update(stableStringify(withoutHash)).digest("hex"),
  };
}

export function db5DeployCandidateList(manifest: GateDManifest): Db5DeployCandidate[] {
  // loadGateDManifest constructs this ordered list solely from the exact
  // AUTHORED_UNAPPLIED_MIGRATIONS constant. Deriving from the parsed manifest
  // keeps the empty post-DB5 state and any future reviewed authored set generic.
  return manifest.authoredUnappliedMigrations.map(({ name, checksum }) => ({ name, checksum }));
}

export function manifestCoverage(manifest: GateDManifest) {
  let enumValues = 0;
  let columns = 0;
  let primaryKeys = 0;
  let uniqueConstraints = 0;
  let checkConstraints = 0;
  for (const migration of manifest.migrations) {
    enumValues += migration.enums.reduce((sum, item) => sum + item.values.length, 0);
    for (const table of migration.tables) {
      columns += table.columns.length;
      primaryKeys += table.primaryKey ? 1 : 0;
      uniqueConstraints += table.uniqueConstraints.length;
      checkConstraints += table.checkConstraints.length;
    }
  }
  return {
    migrations: manifest.migrations.length,
    schemas: 1,
    enumTypes: manifest.migrations.reduce((sum, item) => sum + item.enums.length, 0),
    enumValues,
    tables: manifest.migrations.reduce((sum, item) => sum + item.tables.length, 0),
    columns,
    primaryKeys,
    uniqueConstraints,
    indexes: manifest.migrations.reduce((sum, item) => sum + item.indexes.length, 0),
    foreignKeys: manifest.migrations.reduce((sum, item) => sum + item.foreignKeys.length, 0),
    checkConstraints,
    extensions: manifest.migrations.reduce((sum, item) => sum + item.extensions.length, 0),
  };
}

export function databaseFingerprint(identity: DatabaseIdentity): string {
  return createHash("sha256")
    .update(
      stableStringify({
        version: 1,
        systemIdentifier: identity.systemIdentifier,
        databaseOid: identity.databaseOid,
        databaseName: identity.databaseName,
        schemaOid: identity.schemaOid,
        schemaName: identity.schemaName,
        currentSchema: identity.currentSchema,
        searchPath: identity.searchPath,
        currentUser: identity.currentUser,
      }),
    )
    .digest("hex");
}

const PRISMA_5_22_MIGRATION_HISTORY_COLUMNS: readonly MigrationHistoryColumn[] = [
  { name: "id", type: "character varying(36)", nullable: false, defaultExpression: null, identityKind: "", generatedKind: "" },
  { name: "checksum", type: "character varying(64)", nullable: false, defaultExpression: null, identityKind: "", generatedKind: "" },
  { name: "finished_at", type: "timestamp with time zone", nullable: true, defaultExpression: null, identityKind: "", generatedKind: "" },
  { name: "migration_name", type: "character varying(255)", nullable: false, defaultExpression: null, identityKind: "", generatedKind: "" },
  { name: "logs", type: "text", nullable: true, defaultExpression: null, identityKind: "", generatedKind: "" },
  { name: "rolled_back_at", type: "timestamp with time zone", nullable: true, defaultExpression: null, identityKind: "", generatedKind: "" },
  { name: "started_at", type: "timestamp with time zone", nullable: false, defaultExpression: "now()", identityKind: "", generatedKind: "" },
  { name: "applied_steps_count", type: "integer", nullable: false, defaultExpression: "0", identityKind: "", generatedKind: "" },
];

function normalizeHistoryDefinition(value: string | null): string | null {
  return value === null ? null : value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Prisma 5.22 creates this exact ordinary, permanent relation. The Gate D
 * package is pinned to that migration engine; a version change requires a
 * fresh review of these compatibility invariants rather than a permissive
 * best-effort interpretation of an arbitrary same-named relation.
 */
export function migrationHistoryTrustIssues(
  historyTable: MigrationHistoryTable | null,
): string[] {
  if (!historyTable) return [];

  const issues: string[] = [];
  if (historyTable.relationKind !== "regular") issues.push("RELATION_KIND");
  if (historyTable.persistence !== "permanent") issues.push("PERSISTENCE");
  if (
    historyTable.isPartition ||
    historyTable.inheritanceParentCount !== 0 ||
    historyTable.inheritanceChildCount !== 0
  ) {
    issues.push("PARTITION_OR_INHERITANCE");
  }
  if (historyTable.rowSecurityEnabled || historyTable.forceRowSecurity || historyTable.policyCount !== 0) {
    issues.push("ROW_SECURITY_OR_POLICY");
  }
  if (historyTable.ruleCount !== 0) issues.push("RULES");
  if (historyTable.triggerCount !== 0) issues.push("TRIGGERS");

  const actualByName = new Map(historyTable.columns.map((column) => [column.name, column]));
  if (actualByName.size !== PRISMA_5_22_MIGRATION_HISTORY_COLUMNS.length ||
      historyTable.columns.length !== PRISMA_5_22_MIGRATION_HISTORY_COLUMNS.length) {
    issues.push("COLUMN_SET");
  }
  for (const expected of PRISMA_5_22_MIGRATION_HISTORY_COLUMNS) {
    const actual = actualByName.get(expected.name);
    if (!actual) {
      issues.push(`COLUMN_MISSING:${expected.name}`);
      continue;
    }
    if (normalizeHistoryDefinition(actual.type) !== expected.type) {
      issues.push(`COLUMN_TYPE:${expected.name}`);
    }
    if (actual.nullable !== expected.nullable) issues.push(`COLUMN_NULLABILITY:${expected.name}`);
    if (normalizeHistoryDefinition(actual.defaultExpression) !== expected.defaultExpression) {
      issues.push(`COLUMN_DEFAULT:${expected.name}`);
    }
    if (actual.identityKind !== expected.identityKind || actual.generatedKind !== expected.generatedKind) {
      issues.push(`COLUMN_IDENTITY_OR_GENERATED:${expected.name}`);
    }
  }

  const primaryKeys = historyTable.constraints.filter((constraint) => constraint.kind === "PRIMARY_KEY");
  if (
    historyTable.constraints.length !== 1 ||
    primaryKeys.length !== 1 ||
    primaryKeys[0].columns.length !== 1 ||
    primaryKeys[0].columns[0] !== "id"
  ) {
    issues.push("PRIMARY_KEY_OR_CONSTRAINTS");
  }

  return Array.from(new Set(issues)).sort();
}

function same(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function objectPath(...parts: string[]): string {
  return parts.join(".");
}

function globalOwnership(manifest: GateDManifest) {
  const columns = new Map<string, Set<string>>();
  const indexes = new Map<string, Set<string>>();
  const constraints = new Map<string, Set<string>>();
  for (const migration of manifest.migrations) {
    for (const table of migration.tables) {
      const key = `${table.schema}.${table.name}`;
      columns.set(key, new Set(table.columns.map((item) => item.name)));
      const ownedConstraints = constraints.get(key) ?? new Set<string>();
      if (table.primaryKey) ownedConstraints.add(table.primaryKey.name);
      table.uniqueConstraints.forEach((item) => ownedConstraints.add(item.name));
      table.checkConstraints.forEach((item) => ownedConstraints.add(item.name));
      constraints.set(key, ownedConstraints);
    }
    for (const index of migration.indexes) {
      const key = `${index.schema}.${index.table}`;
      const owned = indexes.get(key) ?? new Set<string>();
      owned.add(index.name);
      indexes.set(key, owned);
    }
    for (const foreignKey of migration.foreignKeys) {
      const key = `${foreignKey.schema}.${foreignKey.table}`;
      const owned = constraints.get(key) ?? new Set<string>();
      owned.add(foreignKey.name);
      constraints.set(key, owned);
    }
  }
  return { columns, indexes, constraints };
}

function compareMigration(
  manifest: GateDManifest,
  migration: MigrationExpectation,
  snapshot: CatalogSnapshot,
): MigrationComparison {
  const missing: Difference[] = [];
  const mismatched: Difference[] = [];
  let expectedComponents = 0;
  let matchedComponents = 0;
  let expectedRoots = 0;
  let presentRoots = 0;
  const ownership = globalOwnership(manifest);
  const constraintCollision = (schema: string, table: string, name: string) => {
    const ordinary = snapshot.constraints.find(
      (item) => item.schema === schema && item.table === table && item.name === name,
    );
    if (ordinary) return ordinary.kind;
    const foreign = snapshot.foreignKeys.find(
      (item) => item.schema === schema && item.table === table && item.name === name,
    );
    return foreign ? "FOREIGN_KEY" : undefined;
  };
  const indexShape = (actual: ActualIndex) => ({
    table: actual.table,
    unique: actual.unique,
    primary: actual.primary,
    valid: actual.valid,
    ready: actual.ready,
    method: actual.method,
    keys: actual.keys,
    keyOptions: actual.keyOptions,
    defaultOpclasses: actual.defaultOpclasses,
    defaultCollations: actual.defaultCollations,
    includeKeys: actual.includeKeys,
    predicate: actual.predicate,
    exclusion: actual.exclusion,
    nullsNotDistinct: actual.nullsNotDistinct,
  });
  const expectedIndexShape = (
    table: string,
    keys: string[],
    unique: boolean,
    primary: boolean,
  ) => ({
    table,
    unique,
    primary,
    valid: true,
    ready: true,
    method: "btree",
    keys,
    keyOptions: keys.map(() => 0),
    defaultOpclasses: keys.map(() => true),
    defaultCollations: keys.map(() => true),
    includeKeys: [],
    predicate: null,
    exclusion: false,
    nullsNotDistinct: false,
  });

  const mark = (path: string, actual: unknown | undefined, expected: unknown, root = true) => {
    expectedComponents++;
    if (root) expectedRoots++;
    if (actual === undefined) {
      missing.push({ path, expected });
      return;
    }
    if (root) presentRoots++;
    if (same(actual, expected)) matchedComponents++;
    else mismatched.push({ path, expected, actual });
  };

  for (const expected of migration.enums) {
    const actual = snapshot.enums.find((item) => item.schema === expected.schema && item.name === expected.name);
    mark(
      objectPath("enum", expected.schema, expected.name),
      actual ? { kind: actual.kind, values: actual.values } : undefined,
      { kind: "enum", values: expected.values },
    );
  }

  for (const expected of migration.tables) {
    const tablePath = objectPath("table", expected.schema, expected.name);
    const actual = snapshot.tables.find((item) => item.schema === expected.schema && item.name === expected.name);
    const typeCollision = snapshot.enums.find(
      (item) => item.schema === expected.schema && item.name === expected.name,
    );
    mark(
      tablePath,
      actual
        ? {
            kind: actual.relationKind,
            persistence: actual.persistence,
            isPartition: actual.isPartition,
            inheritanceParentCount: actual.inheritanceParentCount,
            inheritanceChildCount: actual.inheritanceChildCount,
            rowSecurityEnabled: actual.rowSecurityEnabled,
            forceRowSecurity: actual.forceRowSecurity,
            policyCount: actual.policyCount,
            ruleCount: actual.ruleCount,
            triggerCount: actual.triggerCount,
          }
        : typeCollision
          ? { typeNamespaceCollision: typeCollision.kind }
          : undefined,
      {
        kind: "regular",
        persistence: "permanent",
        isPartition: false,
        inheritanceParentCount: 0,
        inheritanceChildCount: 0,
        rowSecurityEnabled: false,
        forceRowSecurity: false,
        policyCount: 0,
        ruleCount: 0,
        triggerCount: 0,
      },
    );

    for (const column of expected.columns) {
      const actualColumn = snapshot.columns.find(
        (item) => item.schema === expected.schema && item.table === expected.name && item.name === column.name,
      );
      mark(
        objectPath(tablePath, "column", column.name),
        actualColumn
          ? {
              type: actualColumn.type,
              nullable: actualColumn.nullable,
              default: actualColumn.default,
              defaultCollation: actualColumn.defaultCollation,
              identity: actualColumn.identity,
              generated: actualColumn.generated,
            }
          : undefined,
        {
          type: column.type,
          nullable: column.nullable,
          default: column.default,
          defaultCollation: true,
          identity: "",
          generated: "",
        },
        false,
      );
    }

    if (expected.primaryKey) {
      const actualKey = snapshot.constraints.find(
        (item) =>
          item.kind === "PRIMARY_KEY" &&
          item.schema === expected.schema &&
          item.table === expected.name &&
          item.name === expected.primaryKey!.name,
      );
      const relationCollision = snapshot.tables.find(
        (item) => item.schema === expected.schema && item.name === expected.primaryKey!.name,
      );
      const wrongConstraintKind = constraintCollision(
        expected.schema,
        expected.name,
        expected.primaryKey.name,
      );
      const backingIndex = snapshot.indexes.find(
        (item) =>
          item.schema === expected.schema &&
          item.table === expected.name &&
          item.name === expected.primaryKey!.name,
      );
      mark(
        objectPath(tablePath, "primary-key", expected.primaryKey.name),
        actualKey
          ? {
              columns: actualKey.columns,
              deferrable: actualKey.deferrable,
              initiallyDeferred: actualKey.initiallyDeferred,
              validated: actualKey.validated,
              backingIndex: backingIndex ? indexShape(backingIndex) : null,
            }
          : relationCollision
            ? { namespaceCollision: relationCollision.relationKind }
            : wrongConstraintKind
              ? { constraintKind: wrongConstraintKind }
            : undefined,
        {
          columns: expected.primaryKey.columns,
          deferrable: false,
          initiallyDeferred: false,
          validated: true,
          backingIndex: expectedIndexShape(
            expected.name,
            expected.primaryKey.columns,
            true,
            true,
          ),
        },
      );
    }
    for (const unique of expected.uniqueConstraints) {
      const actualUnique = snapshot.constraints.find(
        (item) =>
          item.kind === "UNIQUE" &&
          item.schema === unique.schema &&
          item.table === unique.table &&
          item.name === unique.name,
      );
      const relationCollision = snapshot.tables.find(
        (item) => item.schema === unique.schema && item.name === unique.name,
      );
      const wrongConstraintKind = constraintCollision(unique.schema, unique.table, unique.name);
      const backingIndex = snapshot.indexes.find(
        (item) =>
          item.schema === unique.schema &&
          item.table === unique.table &&
          item.name === unique.name,
      );
      mark(
        objectPath(tablePath, "unique", unique.name),
        actualUnique
          ? {
              columns: actualUnique.columns,
              deferrable: actualUnique.deferrable,
              initiallyDeferred: actualUnique.initiallyDeferred,
              validated: actualUnique.validated,
              backingIndex: backingIndex ? indexShape(backingIndex) : null,
            }
          : relationCollision
            ? { namespaceCollision: relationCollision.relationKind }
            : wrongConstraintKind
              ? { constraintKind: wrongConstraintKind }
            : undefined,
        {
          columns: unique.columns,
          deferrable: false,
          initiallyDeferred: false,
          validated: true,
          backingIndex: expectedIndexShape(unique.table, unique.columns, true, false),
        },
      );
    }
    for (const check of expected.checkConstraints) {
      const actualCheck = snapshot.constraints.find(
        (item) =>
          item.kind === "CHECK" &&
          item.schema === check.schema &&
          item.table === check.table &&
          item.name === check.name,
      );
      const wrongConstraintKind = constraintCollision(check.schema, check.table, check.name);
      mark(
        objectPath(tablePath, "check", check.name),
        actualCheck
          ? { expression: actualCheck.expression, validated: actualCheck.validated }
          : wrongConstraintKind
            ? { constraintKind: wrongConstraintKind }
            : undefined,
        // SQL CHECK constraints are not deferrable in PostgreSQL.
        { expression: check.expression, validated: true },
      );
    }

    if (actual?.relationKind === "regular" || actual?.relationKind === "partitioned") {
      const tableKey = `${expected.schema}.${expected.name}`;
      const allowedColumns = ownership.columns.get(tableKey) ?? new Set<string>();
      for (const extra of snapshot.columns
        .filter((item) => item.schema === expected.schema && item.table === expected.name && !allowedColumns.has(item.name))
        .sort((left, right) => left.name.localeCompare(right.name))) {
        mismatched.push({ path: objectPath(tablePath, "unexpected-column", extra.name), expected: "absent", actual: "present" });
      }
      const allowedConstraints = ownership.constraints.get(tableKey) ?? new Set<string>();
      for (const extra of [
        ...snapshot.constraints.filter(
          (item) => item.schema === expected.schema && item.table === expected.name && !allowedConstraints.has(item.name),
        ),
        ...snapshot.foreignKeys.filter(
          (item) => item.schema === expected.schema && item.table === expected.name && !allowedConstraints.has(item.name),
        ),
      ].sort((left, right) => left.name.localeCompare(right.name))) {
        mismatched.push({ path: objectPath(tablePath, "unexpected-constraint", extra.name), expected: "absent", actual: "present" });
      }
      const allowedIndexes = ownership.indexes.get(tableKey) ?? new Set<string>();
      for (const extra of snapshot.indexes
        .filter(
          (item) =>
            item.schema === expected.schema &&
            item.table === expected.name &&
            !item.primary &&
            !allowedIndexes.has(item.name),
        )
        .sort((left, right) => left.name.localeCompare(right.name))) {
        mismatched.push({ path: objectPath(tablePath, "unexpected-index", extra.name), expected: "absent", actual: "present" });
      }
    }
  }

  for (const expected of migration.indexes) {
    const actual = snapshot.indexes.find(
      (item) => item.schema === expected.schema && item.name === expected.name,
    );
    const relationCollision = snapshot.tables.find(
      (item) => item.schema === expected.schema && item.name === expected.name,
    );
    mark(
      objectPath("index", expected.schema, expected.name),
      actual
        ? indexShape(actual)
        : relationCollision
          ? { namespaceCollision: relationCollision.relationKind }
          : undefined,
      expectedIndexShape(expected.table, expected.keys, expected.unique, false),
    );
  }

  for (const expected of migration.foreignKeys) {
    const actual = snapshot.foreignKeys.find(
      (item) => item.schema === expected.schema && item.table === expected.table && item.name === expected.name,
    );
    const wrongConstraintKind = constraintCollision(expected.schema, expected.table, expected.name);
    mark(
      objectPath("foreign-key", expected.schema, expected.name),
      actual
        ? {
            table: actual.table,
            columns: actual.columns,
            referencedSchema: actual.referencedSchema,
            referencedTable: actual.referencedTable,
            referencedColumns: actual.referencedColumns,
            matchType: actual.matchType,
            onDelete: actual.onDelete,
            onUpdate: actual.onUpdate,
            deferrable: actual.deferrable,
            initiallyDeferred: actual.initiallyDeferred,
            validated: actual.validated,
          }
        : wrongConstraintKind
          ? { constraintKind: wrongConstraintKind }
          : undefined,
      {
        table: expected.table,
        columns: expected.columns,
        referencedSchema: expected.referencedSchema,
        referencedTable: expected.referencedTable,
        referencedColumns: expected.referencedColumns,
        matchType: expected.matchType,
        onDelete: expected.onDelete,
        onUpdate: expected.onUpdate,
        deferrable: expected.deferrable,
        initiallyDeferred: expected.initiallyDeferred,
        validated: expected.validated,
      },
    );
  }

  for (const expected of migration.extensions) {
    const actual = snapshot.extensions.find((item) => item.name === expected.name);
    mark(
      objectPath("extension", expected.name),
      actual ? { schema: actual.schema } : undefined,
      { schema: expected.schema ?? actual?.schema },
    );
  }

  return {
    expectedComponents,
    matchedComponents,
    expectedRoots,
    presentRoots,
    missing: missing.sort((left, right) => left.path.localeCompare(right.path)),
    mismatched: mismatched.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function historyEvidenceForMigration(
  migration: MigrationExpectation,
  snapshot: CatalogSnapshot,
): MigrationReport["historyEvidence"] {
  return snapshot.historyRows
    .filter((row) => row.migrationName === migration.name)
    .map((row) => ({
      id: row.id,
      checksumMatches: row.checksum === migration.checksum,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      rolledBackAt: row.rolledBackAt,
      unresolved: row.unresolved,
      appliedStepsCount: row.appliedStepsCount,
      logsPresent: row.logsPresent,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function authoredPhysicalObjectEvidence(
  migration: MigrationExpectation,
  snapshot: CatalogSnapshot | null,
): { expected: string[]; present: string[] } {
  const expected = new Set<string>();
  const present = new Set<string>();
  const enums = snapshot?.enums ?? [];
  const tables = snapshot?.tables ?? [];
  const columns = snapshot?.columns ?? [];
  const indexes = snapshot?.indexes ?? [];
  const constraints = snapshot?.constraints ?? [];
  const foreignKeys = snapshot?.foreignKeys ?? [];
  const extensions = snapshot?.extensions ?? [];
  const mark = (path: string, isPresent: boolean) => {
    expected.add(path);
    if (isPresent) present.add(path);
  };
  // PostgreSQL relation names, including index names, are schema-global. The
  // constraint itself remains table-scoped, but its backing relation collides
  // even when an index with that name belongs to a different table (or another
  // relation already owns the name).
  const relationNamePresent = (schema: string, name: string) =>
    indexes.some((actual) => actual.schema === schema && actual.name === name) ||
    tables.some((actual) => actual.schema === schema && actual.name === name);

  for (const item of migration.enums) {
    mark(
      objectPath("enum", item.schema, item.name),
      enums.some((actual) => actual.schema === item.schema && actual.name === item.name),
    );
  }

  for (const table of migration.tables) {
    const tablePath = objectPath("table", table.schema, table.name);
    mark(
      tablePath,
      relationNamePresent(table.schema, table.name) ||
        enums.some((actual) => actual.schema === table.schema && actual.name === table.name),
    );
    for (const column of table.columns) {
      mark(
        objectPath("column", table.schema, table.name, column.name),
        columns.some(
          (actual) =>
            actual.schema === table.schema &&
            actual.table === table.name &&
            actual.name === column.name,
        ),
      );
    }
    if (table.primaryKey) {
      const key = table.primaryKey;
      mark(
        objectPath("primary-key", key.schema, key.table, key.name),
        constraints.some(
          (actual) =>
            actual.schema === key.schema && actual.table === key.table && actual.name === key.name,
        ) ||
          foreignKeys.some(
            (actual) =>
              actual.schema === key.schema && actual.table === key.table && actual.name === key.name,
          ),
      );
      mark(
        objectPath("primary-key-index", key.schema, key.table, key.name),
        relationNamePresent(key.schema, key.name),
      );
    }
    for (const key of table.uniqueConstraints) {
      mark(
        objectPath("unique", key.schema, key.table, key.name),
        constraints.some(
          (actual) =>
            actual.schema === key.schema && actual.table === key.table && actual.name === key.name,
        ) ||
          foreignKeys.some(
            (actual) =>
              actual.schema === key.schema && actual.table === key.table && actual.name === key.name,
          ),
      );
      mark(
        objectPath("unique-index", key.schema, key.table, key.name),
        relationNamePresent(key.schema, key.name),
      );
    }
    for (const item of table.checkConstraints) {
      mark(
        objectPath("check", item.schema, item.table, item.name),
        constraints.some(
          (actual) =>
            actual.schema === item.schema &&
            actual.table === item.table &&
            actual.name === item.name,
        ) ||
          foreignKeys.some(
            (actual) =>
              actual.schema === item.schema &&
              actual.table === item.table &&
              actual.name === item.name,
          ),
      );
    }
  }

  for (const index of migration.indexes) {
    mark(
      objectPath("index", index.schema, index.table, index.name),
      relationNamePresent(index.schema, index.name),
    );
  }

  for (const foreignKey of migration.foreignKeys) {
    mark(
      objectPath("foreign-key", foreignKey.schema, foreignKey.table, foreignKey.name),
      foreignKeys.some(
        (actual) =>
          actual.schema === foreignKey.schema &&
          actual.table === foreignKey.table &&
          actual.name === foreignKey.name,
      ) ||
        constraints.some(
          (actual) =>
            actual.schema === foreignKey.schema &&
            actual.table === foreignKey.table &&
            actual.name === foreignKey.name,
        ),
    );
  }

  for (const extension of migration.extensions) {
    mark(
      objectPath("extension", extension.name),
      extensions.some((actual) => actual.name === extension.name),
    );
  }

  return {
    expected: Array.from(expected).sort(),
    present: Array.from(present).sort(),
  };
}

function unknownPreDb5AbsenceGate(
  manifest: GateDManifest,
): PreDb5AbsenceGateReport {
  const deployCandidateList = db5DeployCandidateList(manifest);
  if (manifest.authoredUnappliedMigrations.length === 0) {
    return {
      decision: "NOT_REQUIRED",
      deployCandidateList,
      mutationAuthorized: false,
      requiredState: "ALL_ABSENT",
      migrations: [],
    };
  }
  return {
    decision: "UNKNOWN",
    deployCandidateList,
    mutationAuthorized: false,
    requiredState: "ALL_ABSENT",
    migrations: manifest.authoredUnappliedMigrations.map((migration) => ({
      name: migration.name,
      state: "UNKNOWN",
      physicalState: "UNKNOWN",
      history: "UNKNOWN",
      expectedPhysicalObjects: authoredPhysicalObjectEvidence(migration, null).expected,
      presentPhysicalObjects: [],
      historyEvidence: [],
    })),
  };
}

function buildPreDb5AbsenceGate(
  manifest: GateDManifest,
  snapshot: CatalogSnapshot,
  historyIssues: readonly string[],
): PreDb5AbsenceGateReport {
  const deployCandidateList = db5DeployCandidateList(manifest);
  if (manifest.authoredUnappliedMigrations.length === 0) {
    return {
      decision: "NOT_REQUIRED",
      deployCandidateList,
      mutationAuthorized: false,
      requiredState: "ALL_ABSENT",
      migrations: [],
    };
  }
  const physicalKnown = snapshot.permissions.catalogReadable === true;
  const historyKnown =
    snapshot.permissions.historyReadable === true && historyIssues.length === 0;
  const migrations = manifest.authoredUnappliedMigrations.map(
    (migration): AuthoredUnappliedAbsenceReport => {
      const physical = authoredPhysicalObjectEvidence(migration, snapshot);
      const historyEvidence = historyEvidenceForMigration(migration, snapshot);
      const physicalState = !physicalKnown
        ? "UNKNOWN"
        : physical.present.length === 0
          ? "ALL_ABSENT"
          : "PRESENT";
      const history = !historyKnown
        ? "UNKNOWN"
        : historyEvidence.length === 0
          ? "ABSENT"
          : "PRESENT";
      const state =
        physicalState === "UNKNOWN" || history === "UNKNOWN"
          ? "UNKNOWN"
          : physicalState === "ALL_ABSENT" && history === "ABSENT"
            ? "ALL_ABSENT"
            : "PRESENT";
      return {
        name: migration.name,
        state,
        physicalState,
        history,
        expectedPhysicalObjects: physical.expected,
        presentPhysicalObjects: physical.present,
        historyEvidence,
      };
    },
  );
  const decision = migrations.some((migration) => migration.state === "UNKNOWN")
    ? "UNKNOWN"
    : migrations.every((migration) => migration.state === "ALL_ABSENT")
      ? "PASS"
      : "ABORT";
  return {
    decision,
    deployCandidateList,
    mutationAuthorized: false,
    requiredState: "ALL_ABSENT",
    migrations,
  };
}

function historyForMigration(
  migration: MigrationExpectation,
  snapshot: CatalogSnapshot,
  historyIssues: readonly string[],
): { status: MigrationReport["history"]; applied: boolean; reason?: string } {
  if (historyIssues.length > 0) {
    return {
      status: "INVALID",
      applied: false,
      reason: `MIGRATION_HISTORY_INVALID:${historyIssues.join(",")}`,
    };
  }
  const rows = snapshot.historyRows.filter((item) => item.migrationName === migration.name);
  const incoherent = rows.filter(
    (item) =>
      item.rolledBack ||
      item.unresolved ||
      item.finished !== (item.finishedAt !== null) ||
      item.rolledBack !== (item.rolledBackAt !== null) ||
      item.unresolved !== (!item.finished && !item.rolledBack),
  );
  const applied = rows.filter((item) => item.finished && !item.rolledBack);
  if (incoherent.length > 0 || applied.length > 1) {
    return { status: "AMBIGUOUS", applied: false, reason: `HISTORY_AMBIGUOUS:${migration.name}` };
  }
  if (applied.length === 1) {
    if (applied[0].checksum !== migration.checksum) {
      return { status: "CHECKSUM_MISMATCH", applied: false, reason: `HISTORY_CHECKSUM_MISMATCH:${migration.name}` };
    }
    return { status: "APPLIED", applied: true };
  }
  return { status: "ABSENT", applied: false };
}

function migrationState(
  comparison: MigrationComparison,
  history: ReturnType<typeof historyForMigration>,
): MigrationState {
  if (
    history.status === "AMBIGUOUS" ||
    history.status === "CHECKSUM_MISMATCH" ||
    history.status === "INVALID"
  ) {
    return "UNKNOWN";
  }
  const complete = comparison.missing.length === 0 && comparison.mismatched.length === 0;
  if (history.applied) return complete ? "ALL_PRESENT_AND_MATCHING" : "HISTORY_ONLY";
  if (complete) return "SCHEMA_ONLY";
  if (comparison.presentRoots === 0) return "ALL_ABSENT";
  if (comparison.mismatched.length > 0) return "DRIFTED";
  return "PARTIAL";
}

function physicalMigrationState(comparison: MigrationComparison): PhysicalMigrationState {
  if (comparison.missing.length === 0 && comparison.mismatched.length === 0) return "ALL_PRESENT";
  if (comparison.presentRoots === 0) return "ALL_ABSENT";
  if (comparison.mismatched.length > 0) return "DRIFTED";
  return "PARTIAL";
}

function statusFromBoolean(value: boolean | null, required: boolean): PrivilegeCheck["status"] {
  if (!required) return "NOT_REQUIRED";
  if (value === null) return "UNKNOWN";
  return value ? "PASS" : "FAIL";
}

function combinedPrivilegeStatus(
  required: boolean,
  checks: PrivilegeCheck[],
): PrivilegeCheck["status"] {
  if (!required) return "NOT_REQUIRED";
  if (checks.some((check) => check.status === "FAIL")) return "FAIL";
  if (checks.some((check) => check.status === "UNKNOWN" || check.status === "NOT_REQUIRED")) {
    return "UNKNOWN";
  }
  return "PASS";
}

function privilegeChecks(
  manifest: GateDManifest,
  snapshot: CatalogSnapshot,
  migrationReports: MigrationReport[],
  includeDb5Candidates: boolean,
): PrivilegeCheck[] {
  const historyTablePresent = snapshot.historyTable !== null;
  const historyIssues = migrationHistoryTrustIssues(snapshot.historyTable);
  const trustedHistoryTable = historyTablePresent && historyIssues.length === 0;
  const pending = new Set(
    migrationReports.filter((item) => item.state === "ALL_ABSENT").map((item) => item.name),
  );
  const checks: PrivilegeCheck[] = [
    { name: "catalog_read", status: statusFromBoolean(snapshot.permissions.catalogReadable, true) },
    { name: "database_connect", status: statusFromBoolean(snapshot.permissions.databaseConnect, true) },
    { name: "migration_advisory_lock", status: statusFromBoolean(snapshot.permissions.migrationLockHeld, true) },
    { name: "migration_history_read", status: statusFromBoolean(snapshot.permissions.historyReadable, true) },
    {
      name: "migration_history:shape",
      status: !historyTablePresent ? "NOT_REQUIRED" : historyIssues.length === 0 ? "PASS" : "FAIL",
    },
    { name: "schema:public:usage", status: statusFromBoolean(snapshot.permissions.schemaUsage, true) },
    { name: "transaction_read_only", status: statusFromBoolean(snapshot.permissions.transactionReadOnly, true) },
  ];
  const pendingMigrations = [
    ...manifest.migrations.filter((item) => pending.has(item.name)),
    ...(includeDb5Candidates ? manifest.authoredUnappliedMigrations : []),
  ];
  const historyMutationRequired = migrationReports.some(
    (item) => item.state === "ALL_ABSENT" || item.state === "SCHEMA_ONLY",
  ) || (includeDb5Candidates && manifest.authoredUnappliedMigrations.length > 0);
  const createsSchemaObjects = pendingMigrations.some(
    (item) => item.enums.length + item.tables.length + item.indexes.length > 0,
  );
  const schemaCreateRequired =
    createsSchemaObjects || (historyMutationRequired && !historyTablePresent);
  checks.push({
    name: "schema:public:create",
    status: statusFromBoolean(snapshot.permissions.schemaCreate, schemaCreateRequired),
  });
  checks.push({
    name: "migration_history:insert",
    status: statusFromBoolean(
      snapshot.permissions.historyInsert,
      historyMutationRequired && trustedHistoryTable,
    ),
  });
  checks.push({
    name: "migration_history:update",
    status: statusFromBoolean(
      snapshot.permissions.historyUpdate,
      historyMutationRequired && trustedHistoryTable,
    ),
  });
  checks.push({
    name: "database:create_extension",
    status: statusFromBoolean(
      snapshot.permissions.databaseCreate,
      pendingMigrations.some((item) => item.extensions.length > 0),
    ),
  });

  const createdBeforeOrDuring = new Set<string>();
  for (const migration of pendingMigrations) {
    migration.tables.forEach((table) => createdBeforeOrDuring.add(`${table.schema}.${table.name}`));
    for (const index of migration.indexes) {
      const tableKey = `${index.schema}.${index.table}`;
      if (!createdBeforeOrDuring.has(tableKey)) {
        const relation = snapshot.permissions.relations.find(
          (item) => item.schema === index.schema && item.table === index.table,
        );
        checks.push({
          name: `owner:${tableKey}:create_index`,
          status: statusFromBoolean(relation?.ownerUsable ?? null, true),
        });
      }
    }
    for (const foreignKey of migration.foreignKeys) {
      const sourceKey = `${foreignKey.schema}.${foreignKey.table}`;
      if (!createdBeforeOrDuring.has(sourceKey)) {
        const relation = snapshot.permissions.relations.find(
          (item) => item.schema === foreignKey.schema && item.table === foreignKey.table,
        );
        checks.push({
          name: `owner:${sourceKey}:add_constraint`,
          status: statusFromBoolean(relation?.ownerUsable ?? null, true),
        });
      }
      const targetKey = `${foreignKey.referencedSchema}.${foreignKey.referencedTable}`;
      if (!createdBeforeOrDuring.has(targetKey)) {
        const relation = snapshot.permissions.relations.find(
          (item) =>
            item.schema === foreignKey.referencedSchema && item.table === foreignKey.referencedTable,
        );
        for (const column of foreignKey.referencedColumns) {
          checks.push({
            name: `references:${targetKey}.${column}`,
            status: statusFromBoolean(relation?.references[column] ?? null, true),
          });
        }
      }
    }
  }

  const byName = new Map<string, PrivilegeCheck>();
  for (const check of checks) {
    const current = byName.get(check.name);
    if (!current || current.status === "NOT_REQUIRED") byName.set(check.name, check);
  }
  const deduplicated = Array.from(byName.values());
  const schemaCreateCheck = deduplicated.filter((item) => item.name === "schema:public:create");
  const ownerIndexChecks = deduplicated.filter((item) => item.name.endsWith(":create_index"));
  const ownerConstraintChecks = deduplicated.filter((item) => item.name.endsWith(":add_constraint"));
  const referenceChecks = deduplicated.filter((item) => item.name.startsWith("references:"));
  const historyWriteChecks = trustedHistoryTable
    ? deduplicated.filter((item) => item.name.startsWith("migration_history:"))
    : historyTablePresent
      ? deduplicated.filter((item) => item.name === "migration_history:shape")
      : schemaCreateCheck;
  const hasTypes = pendingMigrations.some((item) => item.enums.length > 0);
  const hasTables = pendingMigrations.some((item) => item.tables.length > 0);
  const hasIndexes = pendingMigrations.some((item) => item.indexes.length > 0);
  const hasForeignKeys = pendingMigrations.some((item) => item.foreignKeys.length > 0);
  deduplicated.push(
    {
      name: "capability:create_types",
      status: combinedPrivilegeStatus(hasTypes, schemaCreateCheck),
    },
    {
      name: "capability:create_tables",
      status: combinedPrivilegeStatus(hasTables, schemaCreateCheck),
    },
    {
      name: "capability:create_indexes",
      status: combinedPrivilegeStatus(hasIndexes, [...schemaCreateCheck, ...ownerIndexChecks]),
    },
    {
      name: "capability:add_constraints",
      status: combinedPrivilegeStatus(hasForeignKeys, [
        ...schemaCreateCheck,
        ...ownerConstraintChecks,
      ]),
    },
    {
      name: "capability:add_foreign_keys",
      status: combinedPrivilegeStatus(hasForeignKeys, [
        ...schemaCreateCheck,
        ...ownerConstraintChecks,
        ...referenceChecks,
      ]),
    },
    {
      name: "capability:write_migration_history",
      status: combinedPrivilegeStatus(historyMutationRequired, historyWriteChecks),
    },
  );
  return deduplicated.sort((left, right) => left.name.localeCompare(right.name));
}

function unknownMigrations(manifest: GateDManifest, reason: string): MigrationReport[] {
  return manifest.migrations.map((migration) => ({
    name: migration.name,
    state: "UNKNOWN",
    physicalState: "UNKNOWN",
    history: "AMBIGUOUS",
    historyEvidence: [],
    expectedComponents: 0,
    matchedComponents: 0,
    expectedRoots: 0,
    presentRoots: 0,
    missingCount: 0,
    mismatchCount: 1,
    differences: [{ path: "preflight", expected: "deterministic evidence", actual: reason }],
  }));
}

export function buildUnknownPreflightReport(
  manifest: GateDManifest,
  reason: string,
  expectedFingerprint: string | null = null,
  observedFingerprint: string | null = null,
): PreflightReport {
  return {
    formatVersion: 1,
    decision: "ABORT",
    manifestHash: manifest.manifestHash,
    coverage: manifestCoverage(manifest),
    database: {
      expectedFingerprint,
      observedFingerprint,
      matched:
        expectedFingerprint && observedFingerprint ? expectedFingerprint === observedFingerprint : null,
      identitySource: "pg_control_system+pg_database+pg_namespace",
      fingerprintScope: "CONSISTENCY_EVIDENCE_ONLY",
    },
    migrations: unknownMigrations(manifest, reason),
    preDb5AbsenceGate: unknownPreDb5AbsenceGate(manifest),
    privilegeChecks: [
      { name: "catalog_read", status: reason === "CATALOG_PERMISSION_DENIED" ? "FAIL" : "UNKNOWN" },
    ],
    proposedResolveList: [],
    pendingDeployList: [],
    stopReasons: [reason],
    mutationAuthorized: false,
  };
}

export function buildPreflightReport(
  manifest: GateDManifest,
  snapshot: CatalogSnapshot,
  expectedFingerprint: string,
): PreflightReport {
  if (snapshot.fingerprint !== expectedFingerprint) {
    return buildUnknownPreflightReport(
      manifest,
      "DATABASE_FINGERPRINT_MISMATCH",
      expectedFingerprint,
      snapshot.fingerprint,
    );
  }

  const historyIssues = migrationHistoryTrustIssues(snapshot.historyTable);
  const stopReasons: string[] = [];
  const preDb5AbsenceGate = buildPreDb5AbsenceGate(manifest, snapshot, historyIssues);
  for (const migration of preDb5AbsenceGate.migrations) {
    if (migration.physicalState === "PRESENT") {
      stopReasons.push(`PRE_DB5_AUTHORED_PHYSICAL_PRESENT:${migration.name}`);
    }
    if (migration.history === "PRESENT") {
      stopReasons.push(`PRE_DB5_AUTHORED_HISTORY_PRESENT:${migration.name}`);
    }
    if (migration.state === "UNKNOWN") {
      stopReasons.push(`PRE_DB5_AUTHORED_ABSENCE_UNKNOWN:${migration.name}`);
    }
  }
  const unexpectedHistory = snapshot.historyRows
    .filter((row) => !manifest.migrations.some((migration) => migration.name === row.migrationName))
    .map((row) => row.migrationName)
    .filter((name, index, values) => values.indexOf(name) === index)
    .sort();
  if (unexpectedHistory.length) {
    stopReasons.push(`UNEXPECTED_MIGRATION_HISTORY:${unexpectedHistory.join(",")}`);
  }

  const migrations = manifest.migrations.map((migration): MigrationReport => {
    const comparison = compareMigration(manifest, migration, snapshot);
    const history = historyForMigration(migration, snapshot, historyIssues);
    if (history.reason) stopReasons.push(history.reason);
    const state = migrationState(comparison, history);
    const physicalState = physicalMigrationState(comparison);
    const differences =
      state === "PARTIAL" || state === "DRIFTED" || state === "HISTORY_ONLY"
        ? [...comparison.missing, ...comparison.mismatched].sort((left, right) => left.path.localeCompare(right.path))
        : state === "UNKNOWN"
          ? [
              { path: "migration-history", expected: migration.checksum, actual: history.status },
              ...comparison.missing,
              ...comparison.mismatched,
            ].sort((left, right) => left.path.localeCompare(right.path))
          : [];
    return {
      name: migration.name,
      state,
      physicalState,
      history: history.status,
      historyEvidence: historyEvidenceForMigration(migration, snapshot),
      expectedComponents: comparison.expectedComponents,
      matchedComponents: comparison.matchedComponents,
      expectedRoots: comparison.expectedRoots,
      presentRoots: comparison.presentRoots,
      missingCount: comparison.missing.length,
      mismatchCount: comparison.mismatched.length,
      differences,
    };
  });

  for (const migration of migrations) {
    if (["PARTIAL", "DRIFTED", "HISTORY_ONLY", "UNKNOWN"].includes(migration.state)) {
      stopReasons.push(`UNSAFE_MIGRATION_STATE:${migration.name}:${migration.state}`);
    }
  }

  if (migrations[0]?.state === "ALL_ABSENT") {
    stopReasons.push("PRODUCTION_BASELINE_MISSING:0_init");
  }

  let pendingSeen = false;
  for (const migration of migrations) {
    if (migration.state === "ALL_ABSENT") pendingSeen = true;
    else if (pendingSeen) {
      stopReasons.push(`CHAIN_ORDER_INCOHERENT:${migration.name}:${migration.state}`);
    }
  }

  const checks = privilegeChecks(
    manifest,
    snapshot,
    migrations,
    preDb5AbsenceGate.decision === "PASS",
  );
  for (const check of checks) {
    if (check.status === "FAIL" || check.status === "UNKNOWN") {
      stopReasons.push(`PRIVILEGE_${check.status}:${check.name}`);
    }
  }

  const proposedResolveList = migrations
    .filter((item) => item.state === "SCHEMA_ONLY")
    .map((item) => item.name);
  const pendingDeployList = migrations
    .filter((item) => item.state === "ALL_ABSENT")
    .map((item) => item.name);

  const uniqueStopReasons = Array.from(new Set(stopReasons)).sort();
  let decision: PreflightReport["decision"];
  if (uniqueStopReasons.length > 0) decision = "ABORT";
  else if (proposedResolveList.length > 0) decision = "OWNER_BASELINE_REVIEW_REQUIRED";
  else if (pendingDeployList.length > 0) decision = "READY_FOR_OWNER_APPROVAL";
  else if (
    preDb5AbsenceGate.decision === "PASS" &&
    preDb5AbsenceGate.deployCandidateList.length > 0
  ) {
    decision = "READY_FOR_DB5_APPROVAL";
  } else decision = "NO_PENDING_MIGRATIONS";

  return {
    formatVersion: 1,
    decision,
    manifestHash: manifest.manifestHash,
    coverage: manifestCoverage(manifest),
    database: {
      expectedFingerprint,
      observedFingerprint: snapshot.fingerprint,
      matched: true,
      identitySource: "pg_control_system+pg_database+pg_namespace",
      fingerprintScope: "CONSISTENCY_EVIDENCE_ONLY",
    },
    migrations,
    preDb5AbsenceGate,
    privilegeChecks: checks,
    proposedResolveList,
    pendingDeployList,
    stopReasons: uniqueStopReasons,
    mutationAuthorized: false,
  };
}

export function renderPreflightReport(report: PreflightReport): string {
  return `${stableStringify(report)}\n`;
}
