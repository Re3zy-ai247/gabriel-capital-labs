// Run: npx --no-install tsx scripts/terms-acceptance.test.ts
//
// Guards B-06 — durable Terms-of-Service acceptance on the paid upgrade path.
//
// WHY (verified 2026-07-28): `consent_collection.terms_of_service` only reaches a
// Stripe CHECKOUT SESSION. The in-place plan upgrade calls
// `stripe.subscriptions.update` and never opens Checkout, so no checkbox rendered
// and Stripe recorded nothing — a customer could be moved to a higher-priced plan
// having agreed to nothing at the point of that charge, even with
// STRIPE_TOS_CONSENT=1.
//
// WHAT THIS GUARD PINS — the four properties that make the fix real rather than
// cosmetic. Each is checked against the SHAPE OF THE CODE, cross-file, never
// against a string this file also defines:
//   1. The gate runs BEFORE the Stripe mutation (positional, not merely present).
//   2. A request without an explicit assertion is REFUSED (428) — a direct API
//      call cannot bypass it, and no env flag can switch it off.
//   3. The version RECORDED is the server's published constant, not the client's
//      string, and it matches the terms text actually published at /legal/terms.
//   4. Nothing manufactures consent: no backfill in the migration, no bulk write
//      in the library, no default that would make an absent acceptance look given.
//
// Static analysis on purpose: node_modules is not installed in this environment
// and importing @prisma/client cannot run here.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.error(`  FAIL ${label}`); }
}

// Prose must never satisfy — or break — an assertion about behaviour. A comment
// explaining a rollback ("DROP TABLE …") or a rejected alternative ("catch →
// return true") is not the code doing it, so structural checks read code only.
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sqlOf = (src: string) => src.replace(/^\s*--.*$/gm, "");

const root = join(__dirname, "..");
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const route = readFileSync(join(root, "app/api/stripe/checkout/route.ts"), "utf8");
const lib = readFileSync(join(root, "lib/terms.ts"), "utf8");
const termsPage = readFileSync(join(root, "app/legal/terms/page.tsx"), "utf8");

const migrationsDir = join(root, "prisma/migrations");
const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
// The migration is found by CONTENT, not by a filename this file hard-codes: a
// renamed directory must not silently turn every migration check into a pass.
const migrationsWithTable = migrationDirs.filter((d) => {
  const p = join(migrationsDir, d, "migration.sql");
  return existsSync(p) && /CREATE TABLE\s+"TermsAcceptance"/.test(readFileSync(p, "utf8"));
});

console.log("\n1. the acceptance record is real schema, shipped as a migration");
check("schema.prisma declares the TermsAcceptance model",
  /^model TermsAcceptance \{/m.test(schema));
check("exactly one migration creates the table (no duplicate/competing migration)",
  migrationsWithTable.length === 1);
const migration = migrationsWithTable.length === 1
  ? readFileSync(join(migrationsDir, migrationsWithTable[0], "migration.sql"), "utf8")
  : "";

const model = (schema.match(/^model TermsAcceptance \{([\s\S]*?)^\}/m) || [, ""])[1];
const modelFields = Array.from(model.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\s+\S/gm))
  .map((m) => m[1])
  .filter((f) => f !== "user"); // relation field: no column of its own
check("the model declares fields (parity check below is not vacuous)", modelFields.length >= 4);
for (const field of modelFields) {
  check(`migration creates a column for model field "${field}"`,
    new RegExp(`"${field}"\\s`).test(migration));
}
check("acceptance is versioned (model carries a version field)", modelFields.includes("version"));
check("one acceptance per user per revision — UNIQUE(userId, version) in the model",
  /@@unique\(\[userId,\s*version\]\)/.test(model));
check("the same uniqueness exists in the database, not just in Prisma",
  /CREATE UNIQUE INDEX[^\n]*ON "TermsAcceptance"\("userId", "version"\)/.test(migration));
check("the record is tied to a real account (FK to User)",
  /ALTER TABLE "TermsAcceptance" ADD CONSTRAINT[^\n]*REFERENCES "User"/.test(migration));

console.log("\n2. nothing manufactures consent for people who never gave it");
// The single most dangerous possible line in this change is a backfill.
check("the migration writes no rows into TermsAcceptance (no retroactive consent)",
  !/\b(INSERT|UPDATE|COPY)\b[\s\S]{0,120}"TermsAcceptance"/i.test(migration));
check("the migration is additive: it drops nothing",
  migration.length > 0 && !/\bDROP\b/i.test(sqlOf(migration)));
check("the migration alters no pre-existing table",
  Array.from(sqlOf(migration).matchAll(/ALTER TABLE "([A-Za-z]+)"/g)).every((m) => m[1] === "TermsAcceptance"));
check("no column defaults an acceptance into existence (version/context have no @default)",
  !/^\s{2}(version|context)\b[^\n]*@default/m.test(model));
check("the library performs no bulk write that could mark many users at once",
  !/createMany|updateMany|executeRaw/.test(codeOf(lib)));

console.log("\n3. the upgrade path cannot complete without a recorded acceptance");
// Call SITES, not mentions: `indexOf("hasAcceptedTermsVersion")` would match the
// import line at the top of the file and make every ordering check pass for free.
const iGate = route.indexOf("await hasAcceptedTermsVersion(user.id");
const iRefuse = route.indexOf("termsRequired: true");
const iRecord = route.indexOf("await recordTermsAcceptance(user.id");
const iUpdate = route.indexOf("await stripe.subscriptions.update(");
const iBranch = route.indexOf("if (billing.length === 1)");
check("the route imports the acceptance library", /from "@\/lib\/terms"/.test(route));
check("the upgrade branch and its Stripe mutation both still exist",
  iBranch !== -1 && iUpdate !== -1);
check("all four call sites were located (ordering checks are not vacuous)",
  [iGate, iRefuse, iRecord, iUpdate, iBranch].every((i) => i !== -1));
check("the acceptance check sits INSIDE the upgrade branch",
  iBranch !== -1 && iGate > iBranch && iGate < iUpdate);
check("the acceptance check runs BEFORE the subscription is mutated",
  iGate !== -1 && iGate < iUpdate);
check("the durable write happens BEFORE the subscription is mutated",
  iRecord !== -1 && iRecord < iUpdate);
check("a caller without acceptance is REFUSED before any Stripe call (fail closed)",
  iRefuse !== -1 && iRefuse < iUpdate);
check("the refusal is a distinct, machine-readable precondition status (428)",
  /status:\s*428/.test(route));
// A gate that an env var can switch off is not a gate. Checked over the REGION
// between the branch and the mutation rather than by flag name, so a flag called
// anything at all still trips it.
check("no environment flag can disable the acceptance gate",
  iBranch !== -1 && iUpdate !== -1 &&
  !/process\.env/.test(codeOf(route.slice(iBranch, iUpdate))));

console.log("\n4. the client asserts; the server decides and records");
check("the client's assertion is validated against the published version",
  /isCurrentTermsVersion\(\s*body\.[a-zA-Z]+\s*\)/.test(codeOf(route)));
check("the version RECORDED is the server constant, never the request body",
  /recordTermsAcceptance\(\s*user\.id,\s*CURRENT_TERMS_VERSION/.test(route));
check("the recorded subject is the id-resolved account (tenant-safe, not email)",
  /hasAcceptedTermsVersion\(\s*user\.id/.test(route));
check("acceptance is stored server-side through Prisma, not asserted in a response",
  /prisma\.termsAcceptance\.upsert/.test(lib));
check("the read is a real lookup of the stored row",
  /prisma\.termsAcceptance\.findUnique/.test(lib));
check("an existing acceptance is never overwritten (first agreement timestamp survives)",
  /update:\s*\{\s*\}/.test(lib));
// A swallowed database error would decide a legal question by accident.
check("the library never swallows an error (fail-closed by propagation)",
  !/\bcatch\b/.test(codeOf(lib)));

console.log("\n5. the recorded version describes the terms actually published");
const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const updated = termsPage.match(/updated="([A-Z][a-z]+) (\d{1,2}), (\d{4})"/);
const publishedVersion = updated
  ? `${updated[3]}-${String(MONTHS.indexOf(updated[1]) + 1).padStart(2, "0")}-${updated[2].padStart(2, "0")}`
  : "";
const declared = (lib.match(/CURRENT_TERMS_VERSION\s*=\s*"([^"]+)"/) || [, ""])[1];
check("the published terms page still exposes a revision date", publishedVersion !== "");
check("lib/terms.ts declares a version constant", declared !== "");
check("the recorded version equals the published revision of /legal/terms " +
  `(page=${publishedVersion || "?"} lib=${declared || "?"})`,
  publishedVersion !== "" && declared === publishedVersion);

console.log(`\nterms-acceptance.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
