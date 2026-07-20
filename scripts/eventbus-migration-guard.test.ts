// Run: npx tsx scripts/eventbus-migration-guard.test.ts
//
// Guards that the Event Bus store is MIGRATION-FIRST (owner-ratified policy), not
// runtime self-heal: the EventEnvelope table ships as a reviewed, additive-only
// migration and NOTHING creates it at runtime. Also asserts it is NOT smuggled onto
// the legacy self-heal allowlist.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const root = join(__dirname, "..");

// ── The migration exists and is additive-only ────────────────────────────────
const migRoot = join(root, "prisma/migrations");
const dir = readdirSync(migRoot).find((d) => d.endsWith("_event_bus"));
check("the event_bus migration exists", !!dir);
if (dir) {
  const sql = readFileSync(join(migRoot, dir, "migration.sql"), "utf8");
  check("migration creates exactly one table", (sql.match(/CREATE TABLE/g) || []).length === 1);
  check("migration creates EventEnvelope", /CREATE TABLE "EventEnvelope"/.test(sql));
  check("migration has ZERO DROP", (sql.match(/\bDROP\b/g) || []).length === 0);
  check("migration has ZERO ALTER TABLE (no mutation of an existing table)", (sql.match(/ALTER TABLE/g) || []).length === 0);
  check("migration creates the tenant cursor index", /"EventEnvelope_tenantId_createdAt_id_idx"/.test(sql));
  check("migration creates the tenant+agency cursor index", /"EventEnvelope_tenantId_agencyId_createdAt_id_idx"/.test(sql));
  check("migration creates the correlationId index", /"EventEnvelope_correlationId_idx"/.test(sql));
}

// ── ALL event_bus* migrations are additive-only (0 DROP / 0 ALTER TABLE) ─────
{
  const busMigrations = readdirSync(migRoot).filter((d) => d.includes("_event_bus"));
  check("at least the base + agency-index event_bus migrations exist", busMigrations.length >= 2);
  for (const d of busMigrations) {
    const sql = readFileSync(join(migRoot, d, "migration.sql"), "utf8");
    check(`${d}: 0 DROP`, (sql.match(/\bDROP\b/g) || []).length === 0);
    check(`${d}: 0 ALTER TABLE`, (sql.match(/ALTER TABLE/g) || []).length === 0);
  }
  const idxDir = busMigrations.find((d) => d.endsWith("_event_bus_agency_index"));
  check("the agency-index migration exists and creates the agency-leading index", !!idxDir &&
    /CREATE INDEX "EventEnvelope_agencyId_createdAt_id_idx"/.test(readFileSync(join(migRoot, idxDir!, "migration.sql"), "utf8")));
}

// ── EventEnvelope is migration-first, NOT on the legacy self-heal allowlist ───
{
  const guard = readFileSync(join(root, "scripts/schema-safety.test.ts"), "utf8");
  const allow = guard.slice(guard.indexOf("LEGACY_SELF_HEAL_ALLOWLIST"), guard.indexOf("]", guard.indexOf("LEGACY_SELF_HEAL_ALLOWLIST")));
  check("EventEnvelope is NOT on the legacy self-heal allowlist", !/EventEnvelope/.test(allow));
}

// ── No runtime self-heal DDL for EventEnvelope anywhere in lib/ or app/ ───────
{
  const offenders: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      const src = readFileSync(p, "utf8");
      if (/CREATE TABLE[^;]*EventEnvelope/i.test(src) || /EventEnvelope[^;]*IF NOT EXISTS/i.test(src)) offenders.push(p);
    }
  };
  walk(join(root, "lib"));
  walk(join(root, "app"));
  check(`no runtime self-heal DDL for EventEnvelope (offenders: ${offenders.length})`, offenders.length === 0);
}

// ── The model is present in schema.prisma exactly once (Prisma-managed, type-safe)
{
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  check("EventEnvelope model declared once in schema.prisma", (schema.match(/^model EventEnvelope /gm) || []).length === 1);
  check("EventEnvelope has NO foreign key to User (events outlive entities)", !/model EventEnvelope[\s\S]*?@relation[\s\S]*?\n}/.test(schema.slice(schema.indexOf("model EventEnvelope"))));
}

console.log(`\neventbus-migration-guard.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
