// Run: npx tsx scripts/reputation-migration-guard.test.ts
//
// Migration safety for the Operator Reputation ledger (Sprint 10): strictly additive,
// migration-first, and the canonical idempotency/latch constraints declared. DB-less.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const migDir = "prisma/migrations";
const mig = readdirSync(join(root, migDir)).find((d) => d.endsWith("_operator_reputation"));
check("operator_reputation migration exists", !!mig);
const sql = mig ? read(join(migDir, mig, "migration.sql")) : "";

// Additive-only.
const destructive = /\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX|TYPE|SCHEMA|DATABASE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|ALTER\s+TABLE[\s\S]*?\bDROP\b|ALTER\s+COLUMN|\bRENAME\b/i;
check("ZERO destructive statements", !destructive.test(sql));
check("does not alter any existing table (FKs onto OperatorIdentity only)", !/ALTER TABLE "(User|Organization|OrganizationMembership|OperatorIdentity|EventEnvelope)"/.test(sql.replace(/ALTER TABLE "(XpAward|ReputationMilestone)"/g, "")));
check("creates XpAward", /CREATE TABLE "XpAward"/.test(sql));
check("creates ReputationMilestone", /CREATE TABLE "ReputationMilestone"/.test(sql));
check("migration-first (no IF NOT EXISTS self-heal)", !/CREATE TABLE IF NOT EXISTS/i.test(sql));

// The canonical constraints (VECTOR-XP §5).
check("award idempotency triple UNIQUE(subjectId, operatorId, awardKind)", /CREATE UNIQUE INDEX "XpAward_subjectId_operatorId_awardKind_key"/.test(sql));
check("milestone latch UNIQUE(operatorId, milestoneKey)", /CREATE UNIQUE INDEX "ReputationMilestone_operatorId_milestoneKey_key"/.test(sql));
check("fold order index (operatorId, createdAt, id)", /CREATE INDEX "XpAward_operatorId_createdAt_id_idx"/.test(sql));
// Append-only integrity: the ledger FKs are RESTRICT, so a user/operator delete cannot
// silently cascade-hard-delete XP history or un-latch a milestone (erasure must retain
// pseudonymous rows explicitly — VECTOR-XP §6.1).
check("ledger FKs are ON DELETE RESTRICT (no silent cascade hard-delete of the audit ledger)", (sql.match(/REFERENCES "OperatorIdentity"\("id"\) ON DELETE RESTRICT/g) || []).length === 2);
check("ledger FKs are NOT cascade", !/REFERENCES "OperatorIdentity"\("id"\) ON DELETE CASCADE/.test(sql));

// Schema declares the same truth; sourceEventId is provenance, NOT part of the key.
{
  const schema = read("prisma/schema.prisma");
  check("schema: model XpAward with @@unique([subjectId, operatorId, awardKind])", /@@unique\(\[subjectId, operatorId, awardKind\]\)/.test(schema));
  check("schema: milestone @@unique([operatorId, milestoneKey])", /@@unique\(\[operatorId, milestoneKey\]\)/.test(schema));
  const awardBlock = (schema.match(/model XpAward \{[\s\S]*?\n\}/) || [""])[0];
  check("sourceEventId is NOT in any unique key (per-emission ids must never dedupe awards)", !/@@unique\(\[[^\]]*sourceEventId/.test(awardBlock));
  check("no updatedAt on XpAward (append-only rows are never updated)", !/updatedAt/.test(awardBlock));
}

// No runtime self-heal DDL for the reputation tables.
{
  let repCode = "";
  try { repCode = readdirSync(join(root, "lib/reputation")).map((f) => read(join("lib/reputation", f))).join("\n"); } catch { /* absent */ }
  check("reputation runtime issues NO CREATE TABLE", !/CREATE TABLE/i.test(repCode));
}

console.log(`\nreputation-migration-guard.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
