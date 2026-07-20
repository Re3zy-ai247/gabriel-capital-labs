// Run: npx tsx scripts/schema-safety.test.ts
//
// Pins the schema-safety contract discovered on 2026-07-20.
//
// BACKGROUND (production truth, from Vercel build logs):
//   The build ran `prisma db push --skip-generate --accept-data-loss` on EVERY
//   production AND preview deployment, and it SUCCEEDED — the datasource resolves
//   to a direct Postgres endpoint (db.prisma.io:5432), not the Accelerate proxy.
//   The long-standing repo note that "db push silently fails through Accelerate"
//   was therefore FALSE in current production.
//
//   `db push` makes the database match schema.prisma, which means it DROPS tables
//   the schema does not declare. 15 tables in this repo are created at runtime by
//   self-heal DDL and are deliberately NOT in schema.prisma — so each deploy was
//   armed to drop them. Preview and production share one DATABASE_URL value, so
//   any branch could trigger it against production data.
//
//   The push was NOT idling: the Prisma CLI prints "already in sync" only when
//   executedSteps === 0, and our build logs printed "now in sync" — steps ran on
//   every build. No data-loss warning appeared, meaning those drops hit tables
//   while still empty; once one holds rows, --accept-data-loss suppresses the
//   refusal and the rows go with it.
//
// THE CONTRACT THIS GUARD ENFORCES:
//   1. No build step may mutate the database. Schema arrives either through a
//      reviewed migration or through runtime self-heal DDL (ADR-0001) — never as
//      a side effect of `next build`.
//   2. `--accept-data-loss` must not appear anywhere in build configuration.
//   3. The self-heal table inventory stays visible, so the two-world split
//      (schema.prisma-owned vs self-heal-owned) is a recorded decision rather
//      than an accident.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const vercelJson = readFileSync(join(root, "vercel.json"), "utf8");
const pkg = readFileSync(join(root, "package.json"), "utf8");
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");

// ── 1. No destructive schema operation in any BUILD path ─────────────────────
// Scoped to the commands a deploy actually runs (vercel.json buildCommand, which
// takes precedence, and package.json's build script, which a human runs locally).
// An explicit, human-invoked `db:push` escape hatch is deliberately still allowed:
// the danger was automation, not the tool.
const pkgScripts = JSON.parse(pkg).scripts as Record<string, string>;
const buildPaths: [string, string][] = [
  ["vercel.json buildCommand", JSON.parse(vercelJson).buildCommand as string],
  ["package.json build", pkgScripts.build],
];
for (const [name, src] of buildPaths) {
  check(`${name}: no --accept-data-loss`, !/--accept-data-loss/.test(src));
  check(`${name}: no 'prisma db push'`, !/prisma\s+db\s+push/.test(src));
  check(`${name}: no 'prisma migrate deploy'`, !/prisma\s+migrate\s+deploy/.test(src));
}
// Any db:push escape hatch must stay non-destructive (it prompts/refuses instead).
check("db:push escape hatch carries no --accept-data-loss",
  !/--accept-data-loss/.test(pkgScripts["db:push"] ?? ""));

// Deterministic installs: the deploy must resolve the exact committed lockfile,
// not a fresh `npm install` tree. CI already uses `npm ci`; if the deploy used
// `npm install`, the artifact CI green-lights is not the artifact that ships.
check("vercel installCommand is deterministic (npm ci)",
  /npm ci/.test((JSON.parse(vercelJson).installCommand as string) ?? ""));

// The build must still generate the client — removing the push must not have
// removed codegen, or the deployed bundle ships a stale Prisma client.
const build = JSON.parse(vercelJson).buildCommand as string;
check("build still runs prisma generate", /prisma generate/.test(build));
check("build still runs next build", /next build/.test(build));
check("build command performs no DB mutation", !/(push|migrate|execute|seed)/.test(build));

// ── 2. The self-heal inventory is real and visible ───────────────────────────
// Every table created by runtime DDL, whether or not schema.prisma declares it.
const libDir = join(root, "lib");
const healed = new Set<string>();
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".ts")) {
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS "([A-Za-z]+)"/g)) healed.add(m[1]);
    }
  }
};
walk(libDir);

check("self-heal DDL still present (ADR-0001 path intact)", healed.size > 0);

// Tables the runtime creates that schema.prisma does NOT declare. These are the
// ones a build-time `db push` would have dropped. The count is pinned so that
// adding another self-heal-only table is a conscious, reviewed act.
const declared = new Set(Array.from(schema.matchAll(/^model ([A-Za-z]+) \{/gm)).map((m) => m[1]));
const selfHealOnly = Array.from(healed).filter((t) => !declared.has(t)).sort();

// Recorded inventory as of 2026-07-20. If this list changes, update it in the
// same commit that changes the schema — the point is that the split is explicit.
const EXPECTED_SELF_HEAL_ONLY = [
  "Campaign",
  "ClientAssignment",
  "DecisionRegistry",
  "KernelAudit",
  "KernelEvent",
  "KernelIdempotency",
  "MailManifest",
  "OutcomeConsent",
  "StripeWebhookEvent",
  "TeamInvitation",
  "TeamMember",
  "TradelineContact",
  "UserDevice",
  "UserSession",
  "VerifiedOutcome",
];
check(
  `self-heal-only table inventory matches the recorded list (${selfHealOnly.length} tables)`,
  JSON.stringify(selfHealOnly) === JSON.stringify(EXPECTED_SELF_HEAL_ONLY)
);
if (JSON.stringify(selfHealOnly) !== JSON.stringify(EXPECTED_SELF_HEAL_ONLY)) {
  console.error("  expected:", JSON.stringify(EXPECTED_SELF_HEAL_ONLY));
  console.error("  actual:  ", JSON.stringify(selfHealOnly));
}

// These carry live user or money data — their loss is not recoverable from a
// re-run, so they are called out by name rather than left in a count.
for (const critical of ["VerifiedOutcome", "OutcomeConsent", "StripeWebhookEvent"]) {
  check(`${critical} is self-heal-owned and therefore must never face a build-time push`,
    healed.has(critical));
}

console.log(`\nschema-safety.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
