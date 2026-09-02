// Run: npx tsx scripts/admin-migrate-security.test.ts
//
// Source guard for the retired human-triggerable schema mutation surfaces.
// Runtime schema changes belong to reviewed migrations or the explicitly
// allowlisted legacy self-heal layer — never an HTTP route or an ambiently
// armed repository integration script.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, extname, join, relative, resolve } from "node:path";
import { stripComments, stripCommentsSelfTest } from "./_source";

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
const retiredAdminRoute = join(root, "app/api/admin/migrate/route.ts");
const retiredEventbusScript = join(root, "scripts/eventbus-preview-integration.ts");

check("legacy admin migration route is absent", !existsSync(retiredAdminRoute));
check("ambiently armed event-bus integration script is absent", !existsSync(retiredEventbusScript));

const stripFailures = stripCommentsSelfTest();
check(
  `shared source tokenizer is not blind${stripFailures.length ? `: ${stripFailures.join(", ")}` : ""}`,
  stripFailures.length === 0,
);

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
const routeFilePattern = /\/route\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const rawDdl = /\b(?:ALTER\s+TABLE|CREATE\s+(?:TABLE|UNIQUE\s+INDEX|INDEX|SEQUENCE|TYPE)|DROP\s+(?:TABLE|INDEX|SEQUENCE|TYPE)|TRUNCATE\s+TABLE)\b/i;
const rawPrismaExecution = /\$(?:executeRawUnsafe|queryRawUnsafe)(?:\s*<[\s\S]{0,500}?>)?\s*\(|\$executeRaw(?:\s*<[\s\S]{0,500}?>)?\s*(?:\(|`)/;
const directSchemaMutation = (source: string): boolean => {
  const code = stripComments(source);
  return rawPrismaExecution.test(code) || rawDdl.test(code);
};

const detectorFixtures: Array<[string, string, boolean]> = [
  ["executeRawUnsafe call", 'await prisma.$executeRawUnsafe("SELECT 1")', true],
  ["executeRaw call", "await prisma.$executeRaw(Prisma.sql`SELECT 1`)", true],
  ["executeRaw tag", "await prisma.$executeRaw`SELECT 1`", true],
  ["queryRawUnsafe call", 'await prisma.$queryRawUnsafe("SELECT 1")', true],
  ["queryRawUnsafe generic call", 'await prisma.$queryRawUnsafe<Array<{ id: string }>>(sql)', true],
  ["dynamic unsafe SQL helper", "const sql = buildSql(); await prisma.$executeRawUnsafe(sql)", true],
  ["raw DDL string", 'const sql = `CREATE TABLE "Surprise" ("id" TEXT)`', true],
  ["commented mutation", '// prisma.$executeRawUnsafe("DROP TABLE x")\nconst safe = true', false],
  ["ordinary query", "await prisma.user.findMany()", false],
];
for (const [label, fixture, expected] of detectorFixtures) {
  check(`schema-mutation detector: ${label}`, directSchemaMutation(fixture) === expected);
}

const apiRouteFiles = filesUnder(join(root, "app/api"))
  .filter((path) => routeFilePattern.test(path))
  .sort();
check("API route inventory is non-empty", apiRouteFiles.length > 0);

const offenders = apiRouteFiles
  .filter((path) => directSchemaMutation(readFileSync(path, "utf8")))
  .map((path) => relative(root, path));

if (offenders.length > 0) console.error(`direct API schema mutation surface(s): ${offenders.join(", ")}`);
check("no supported app/api route contains direct raw SQL execution or DDL", offenders.length === 0);

// Freeze the grandfathered legacy DDL modules themselves. schema-safety.test.ts
// freezes their table names; this file-level inventory prevents a new raw-DDL
// helper from appearing and then being imported by a route without review.
const LEGACY_RAW_SQL_HELPER_ALLOWLIST = [
  "lib/aiMeter.ts",
  "lib/analytics/aggregate.ts",
  "lib/arena/ownProgress.ts",
  "lib/arena/read.ts",
  "lib/attachments.ts",
  "lib/billing.ts",
  "lib/brief.ts",
  "lib/briefDigest.ts",
  "lib/campaign/CampaignStore.ts",
  "lib/community.ts",
  "lib/decisionRegistry.ts",
  "lib/entitlements.ts",
  "lib/events.ts",
  "lib/furnisher.ts",
  "lib/kaiEvents.ts",
  "lib/kaiSeen.ts",
  "lib/mail/MailStore.ts",
  "lib/os/host/durable.ts",
  "lib/outcomeConsent.ts",
  "lib/outcomeLedger.ts",
  "lib/passwordReset.ts",
  "lib/platform/sessionStore.ts",
  "lib/platform/teamStore.ts",
  "lib/push.ts",
  "lib/rateLimit.ts",
  "lib/support.ts",
] as const;

const actualDdlHelpers = filesUnder(join(root, "lib"))
  .filter((path) => SOURCE_EXTENSIONS.includes(extname(path) as typeof SOURCE_EXTENSIONS[number]))
  .filter((path) => directSchemaMutation(readFileSync(path, "utf8")))
  .map((path) => relative(root, path))
  .sort();
const expectedDdlHelpers = [...LEGACY_RAW_SQL_HELPER_ALLOWLIST].sort();
if (JSON.stringify(actualDdlHelpers) !== JSON.stringify(expectedDdlHelpers)) {
  console.error("legacy DDL helper inventory expected:", JSON.stringify(expectedDdlHelpers));
  console.error("legacy DDL helper inventory actual:  ", JSON.stringify(actualDdlHelpers));
}
check(
  "legacy raw-SQL/DDL helper file inventory is exact",
  JSON.stringify(actualDdlHelpers) === JSON.stringify(expectedDdlHelpers),
);

function importSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const found = new Set<string>();
  for (const pattern of [
    /\b(?:import|export)\s+(?:type\s+)?[^;]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const match of code.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

const importFixture = [
  'import { a } from "@/lib/a";',
  'const b = await import("../lib/b");',
  'const c = require("./c");',
].join("\n");
check(
  "local import detector covers static, dynamic, and require forms",
  JSON.stringify(importSpecifiers(importFixture).sort()) ===
    JSON.stringify(["../lib/b", "./c", "@/lib/a"].sort()),
);

function resolveLocalImport(importer: string, specifier: string): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null;
  const base = specifier.startsWith("@/")
    ? join(root, specifier.slice(2))
    : resolve(dirname(importer), specifier);
  const candidates = extname(base)
    ? [base]
    : [
        ...SOURCE_EXTENSIONS.map((extension) => base + extension),
        ...SOURCE_EXTENSIONS.map((extension) => join(base, "index" + extension)),
      ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function reachableLocalFiles(entry: string): string[] {
  const visited = new Set<string>();
  const visit = (path: string) => {
    if (visited.has(path)) return;
    visited.add(path);
    const source = readFileSync(path, "utf8");
    for (const specifier of importSpecifiers(source)) {
      const target = resolveLocalImport(path, specifier);
      if (target) visit(target);
    }
  };
  visit(entry);
  return [...visited];
}

const importedDdlInventory = apiRouteFiles.flatMap((route) =>
  reachableLocalFiles(route)
    .map((path) => relative(root, path))
    .filter((path) => expectedDdlHelpers.includes(path as typeof LEGACY_RAW_SQL_HELPER_ALLOWLIST[number]))
    .map((helper) => `${relative(root, route)} -> ${helper}`),
).sort();

// Exact current transitive call-site inventory. A newly imported grandfathered
// DDL helper changes this list and fails review rather than silently widening
// the set of HTTP requests that may trigger runtime schema work.
const importedDdlDigest = createHash("sha256").update(importedDdlInventory.join("\n")).digest("hex");
const EXPECTED_ROUTE_DDL_INVENTORY = {
  count: 288,
  sha256: "b34cb60d4cb1ad4594fb2fe1c6f17556720175ebb91779faa680af8119989f97",
} as const;
const routeDdlInventoryMatches =
  importedDdlInventory.length === EXPECTED_ROUTE_DDL_INVENTORY.count &&
  importedDdlDigest === EXPECTED_ROUTE_DDL_INVENTORY.sha256;
if (!routeDdlInventoryMatches) {
  console.error(
    "route -> legacy DDL inventory actual:",
    JSON.stringify({ count: importedDdlInventory.length, sha256: importedDdlDigest }),
  );
  console.error("route -> legacy DDL pairs:", JSON.stringify(importedDdlInventory, null, 2));
}
check(
  "route-to-grandfathered-DDL transitive inventory is exact",
  routeDdlInventoryMatches,
);

// Repository-wide integration-script policy. Test fixtures are deliberately
// excluded; Gate-D's catalog code is not destructive and therefore does not
// match. Any executable script that combines ambient DB access with a destructive
// Prisma operation or raw DDL is a forbidden production-footgun, regardless of
// filename, so renaming the retired event-bus script cannot evade this guard.
const ambientDatabase = (source: string): boolean => {
  const code = stripComments(source);
  return /process\.env\.DATABASE_URL|from\s*["'][^"']*(?:lib\/prisma|@prisma\/client)["']|new\s+PrismaClient\s*\(/.test(code);
};
const rawWriteExecution = /\$(?:executeRawUnsafe|executeRaw)(?:\s*<[\s\S]{0,500}?>)?\s*(?:\(|`)/;
const READ_ONLY_GATE_D_CATALOG = "scripts/gate-d-preflight-catalog.ts";
const destructiveDatabaseOperation = (source: string, sourcePath = ""): boolean => {
  const code = stripComments(source);
  const destructiveModelCall = /\.(?:deleteMany|updateMany|delete)\s*\(/.test(code);
  const destructiveSql =
    /\b(?:DELETE\s+FROM|UPDATE\s+["A-Za-z_]|TRUNCATE\s+TABLE)\b/i.test(code) ||
    rawDdl.test(code);
  const rawWrite = rawWriteExecution.test(code);
  return destructiveModelCall || destructiveSql || (rawWrite && sourcePath !== READ_ONLY_GATE_D_CATALOG);
};
const destructiveFixtures: Array<[string, string, boolean]> = [
  ["renamed ambient Prisma deleteMany script", 'import { prisma } from "../lib/prisma"; await prisma.eventEnvelope.deleteMany({});', true],
  ["ambient Prisma updateMany script", 'const url = process.env.DATABASE_URL; await prisma.user.updateMany({});', true],
  ["ambient Prisma raw DDL script", 'import { PrismaClient } from "@prisma/client"; const sql = `ALTER TABLE "User" ADD COLUMN "x" TEXT`;', true],
  ["read-only Gate-D shape", 'import { PrismaClient } from "@prisma/client"; await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);', false],
  ["destructive fixture without ambient DB", 'fakePrisma.user.deleteMany({});', false],
];
for (const [label, fixture, expected] of destructiveFixtures) {
  const fixturePath = label === "read-only Gate-D shape" ? READ_ONLY_GATE_D_CATALOG : "scripts/fixture.ts";
  const detected = ambientDatabase(fixture) && destructiveDatabaseOperation(fixture, fixturePath);
  check(`destructive integration detector: ${label}`, detected === expected);
}

const destructiveImportGraph = (nodes: Array<{ source: string; path: string }>): boolean =>
  nodes.some((node) => ambientDatabase(node.source)) &&
  nodes.some((node) => destructiveDatabaseOperation(node.source, node.path));
check(
  "destructive integration detector follows a renamed wrapper into its imported helper",
  destructiveImportGraph([
    { source: 'import { run } from "../lib/renamed-helper"; run();', path: "scripts/renamed-wrapper.ts" },
    { source: 'import { prisma } from "../lib/prisma"; prisma.eventEnvelope.deleteMany({});', path: "lib/renamed-helper.ts" },
  ]),
);

const gateDCatalogPath = join(root, READ_ONLY_GATE_D_CATALOG);
const gateDCatalogCode = stripComments(readFileSync(gateDCatalogPath, "utf8"));
check(
  "Gate-D raw execution remains an exact read-only transaction declaration",
  [...gateDCatalogCode.matchAll(new RegExp(rawWriteExecution.source, "g"))].length === 1 &&
    /\$executeRaw\(Prisma\.sql`SET TRANSACTION READ ONLY`\)/.test(gateDCatalogCode) &&
    !/\.(?:deleteMany|updateMany|delete)\s*\(/.test(gateDCatalogCode) &&
    !rawDdl.test(gateDCatalogCode) &&
    !/\b(?:DELETE\s+FROM|UPDATE\s+["A-Za-z_]|TRUNCATE\s+TABLE)\b/i.test(gateDCatalogCode),
);

const destructiveIntegrationScripts = filesUnder(join(root, "scripts"))
  .filter((path) => SOURCE_EXTENSIONS.includes(extname(path) as typeof SOURCE_EXTENSIONS[number]))
  .filter((path) => !/\.(?:test|spec)\.[^.]+$/.test(path) && !path.includes("/scripts/runtime/"))
  .filter((entry) => {
    const graph = reachableLocalFiles(entry).map((path) => ({
      path: relative(root, path),
      source: readFileSync(path, "utf8"),
    }));
    return destructiveImportGraph(graph);
  })
  .map((path) => relative(root, path))
  .sort();
// The in-memory performance harness reaches the durable kernel module through a
// barrel import, but its own source selects in-memory ports and contains no DB
// access or destructive call. Keep this sole static-analysis overapproximation
// explicit; any second entry or any direct mutation in it fails.
const DESTRUCTIVE_SCRIPT_GRAPH_ALLOWLIST = ["scripts/perf-harness.ts"] as const;
for (const allowed of DESTRUCTIVE_SCRIPT_GRAPH_ALLOWLIST) {
  const source = readFileSync(join(root, allowed), "utf8");
  check(
    `${allowed} remains a direct-DB-free in-memory harness`,
    !ambientDatabase(source) && !destructiveDatabaseOperation(source, allowed),
  );
}
const perfHarnessGraph = reachableLocalFiles(join(root, "scripts/perf-harness.ts"))
  .map((path) => relative(root, path))
  .sort();
const perfHarnessGraphDigest = createHash("sha256").update(perfHarnessGraph.join("\n")).digest("hex");
const EXPECTED_PERF_HARNESS_GRAPH = {
  count: 33,
  sha256: "592ddfe7a6373033dff07eb204146ebde756daf7f4dc3bcea448af3d7cff122b",
} as const;
const perfHarnessGraphMatches =
  perfHarnessGraph.length === EXPECTED_PERF_HARNESS_GRAPH.count &&
  perfHarnessGraphDigest === EXPECTED_PERF_HARNESS_GRAPH.sha256;
if (!perfHarnessGraphMatches) {
  console.error(
    "perf-harness transitive graph actual:",
    JSON.stringify({ count: perfHarnessGraph.length, sha256: perfHarnessGraphDigest }),
  );
  console.error("perf-harness transitive files:", JSON.stringify(perfHarnessGraph, null, 2));
}
check("perf-harness transitive import graph is exact", perfHarnessGraphMatches);
const expectedDestructiveIntegrationScripts = [...DESTRUCTIVE_SCRIPT_GRAPH_ALLOWLIST].sort();
if (JSON.stringify(destructiveIntegrationScripts) !== JSON.stringify(expectedDestructiveIntegrationScripts)) {
  console.error("ambient destructive DB integration graph inventory expected:", JSON.stringify(expectedDestructiveIntegrationScripts));
  console.error("ambient destructive DB integration graph inventory actual:  ", JSON.stringify(destructiveIntegrationScripts));
}
check(
  "ambient destructive DB integration-script graph inventory is exact",
  JSON.stringify(destructiveIntegrationScripts) === JSON.stringify(expectedDestructiveIntegrationScripts),
);

console.log(`\nadmin-migrate-security.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
