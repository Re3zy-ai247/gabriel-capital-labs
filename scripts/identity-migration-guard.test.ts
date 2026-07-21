// Run: npx tsx scripts/identity-migration-guard.test.ts
//
// Migration safety for the Operator Identity foundation (Sprint 9). Proves the new
// migration is strictly ADDITIVE (0 DROP, no modification of an existing table),
// migration-first (NOT self-heal), and that the schema declares the idempotency /
// isolation constraints the runtime relies on. DB-less: pure file scans.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Locate the operator_identity migration.
const migDir = "prisma/migrations";
const identityMig = readdirSync(join(root, migDir)).find((d) => d.endsWith("_operator_identity"));
check("operator_identity migration directory exists", !!identityMig);
const sql = identityMig ? read(join(migDir, identityMig, "migration.sql")) : "";

// ── Additive-only: zero destructive statements ───────────────────────────────
const destructive = /\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX|TYPE|SCHEMA|DATABASE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|ALTER\s+TABLE[\s\S]*?\bDROP\b|ALTER\s+COLUMN|\bRENAME\b/i;
check("migration has ZERO destructive statements (DROP/TRUNCATE/DELETE/RENAME/ALTER..DROP)", !destructive.test(sql));

// Every statement that touches an EXISTING table must be an additive FK only (no
// column add/alter on User/Organization pre-existing shapes). The only existing
// table referenced is User, and only as a FK REFERENCES target.
check("does not ALTER an existing table's columns (only ADD CONSTRAINT ... FK)", !/ALTER TABLE "User"/.test(sql));
check("references User only as a FK target", /REFERENCES "User"\("id"\)/.test(sql));

// ── Creates exactly the foundation's tables + enums ──────────────────────────
for (const t of ["OperatorIdentity", "Organization", "OrganizationMembership"]) {
  check(`creates table ${t}`, new RegExp(`CREATE TABLE "${t}"`).test(sql));
}
for (const e of ["OperatorState", "OrganizationKind", "OrganizationState", "OrgRole", "MembershipState"]) {
  check(`creates enum ${e}`, new RegExp(`CREATE TYPE "${e}"`).test(sql));
}

// ── Idempotency + isolation constraints the runtime depends on ───────────────
check("OperatorIdentity.accountId is UNIQUE (one identity per account, ever)", /CREATE UNIQUE INDEX "OperatorIdentity_accountId_key"/.test(sql));
check("OperatorIdentity.handle is UNIQUE (reserved handle)", /CREATE UNIQUE INDEX "OperatorIdentity_handle_key"/.test(sql));
check("Organization.slug is UNIQUE (stable org id, not the spoofable name)", /CREATE UNIQUE INDEX "Organization_slug_key"/.test(sql));
check("membership is UNIQUE(organizationId, operatorId) — no duplicate/orphan", /CREATE UNIQUE INDEX "OrganizationMembership_organizationId_operatorId_key"/.test(sql));

// ── Foreign keys wire the graph (cascade cleanup, no orphans) ────────────────
check("OperatorIdentity.accountId FK -> User", /"OperatorIdentity_accountId_fkey"[\s\S]*REFERENCES "User"/.test(sql));
check("Organization.ownerAccountId FK -> User", /"Organization_ownerAccountId_fkey"[\s\S]*REFERENCES "User"/.test(sql));
check("membership FK -> Organization", /"OrganizationMembership_organizationId_fkey"[\s\S]*REFERENCES "Organization"/.test(sql));
check("membership FK -> OperatorIdentity", /"OrganizationMembership_operatorId_fkey"[\s\S]*REFERENCES "OperatorIdentity"/.test(sql));

// ── Migration-first, NOT self-heal ───────────────────────────────────────────
check("migration is NOT self-heal (no CREATE TABLE IF NOT EXISTS)", !/CREATE TABLE IF NOT EXISTS/i.test(sql));

// ── Schema declares the same invariants ──────────────────────────────────────
{
  const schema = read("prisma/schema.prisma");
  check("schema: model OperatorIdentity", /model OperatorIdentity \{/.test(schema));
  check("schema: model Organization", /model Organization \{/.test(schema));
  check("schema: model OrganizationMembership", /model OrganizationMembership \{/.test(schema));
  check("schema: accountId @unique", /accountId\s+String\s+@unique/.test(schema));
  check("schema: membership @@unique([organizationId, operatorId])", /@@unique\(\[organizationId, operatorId\]\)/.test(schema));
  check("schema: role enum is still exactly {USER, ADMIN} (identity did NOT widen auth roles)", /enum UserRole \{\s*USER\s*ADMIN\s*\}/.test(schema.replace(/\s+/g, " ").replace(/enum UserRole \{ USER ADMIN \}/, "enum UserRole { USER ADMIN }")) || /enum UserRole \{[^}]*USER[^}]*ADMIN[^}]*\}/.test(schema) && !/enum UserRole \{[^}]*(OWNER|MEMBER|MODERATOR|STAFF)[^}]*\}/.test(schema));
  // No new column was added to User (only virtual back-relations).
  check("User gained only back-relations, no scalar identity column", !/model User \{[\s\S]*?operatorState[\s\S]*?\}/.test(schema));
}

// ── Runtime does not self-heal identity tables ───────────────────────────────
{
  // lib/identity may not exist yet at commit 1; guard tolerates absence.
  let identityCode = "";
  try { identityCode = readdirSync(join(root, "lib/identity")).map((f) => read(join("lib/identity", f))).join("\n"); } catch { /* dir not created yet */ }
  check("identity runtime never issues CREATE TABLE (no self-heal)", !/CREATE TABLE/i.test(identityCode));
}

console.log(`\nidentity-migration-guard.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
