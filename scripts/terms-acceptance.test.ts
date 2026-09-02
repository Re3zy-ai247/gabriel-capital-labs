// Run: npx --no-install tsx scripts/terms-acceptance.test.ts
//
// RC1-S8 / P1-10 (D-02) — durable Terms-of-Service acceptance at REGISTRATION.
//
// ADOPTED from the m2 lane (4ece50622b1e6b1a3f7c9cb40aef3dd411d5b80d,
// scripts/terms-acceptance.test.ts) and adapted. What carried over unchanged is
// everything that is about the RECORD rather than about the path: the schema and
// migration parity checks, the "nothing manufactures consent" section, the
// server-owns-the-version section, the published-revision cross-check, and the
// FK-action pin (§7) that m2 proved was necessary by shipping ON DELETE CASCADE
// past four green suites. What was REPLACED is m2's §3/§6 — those asserted a 428
// gate inside app/api/stripe/checkout/route.ts and a set of paid upgrade
// callers. RC1's gate is registration, and this slice deliberately does not
// touch the Stripe route or any commercial surface.
//
// WHY IT MATTERS. Before this slice there was no lib/terms.ts, no acceptance
// table, and no acceptedTermsAt anywhere in the schema: NOTHING recorded that any
// user had agreed to anything, on the path every single user takes.
//
// WHAT THIS GUARD PINS
//   1. The record is real schema, shipped as exactly one migration.
//   2. Nothing manufactures consent — no backfill, no default, no bulk write.
//   3. Registration cannot complete without one, the refusal is server-side, and
//      the write shares the account's transaction.
//   4. The client asserts; the SERVER decides the version and records it.
//   5. The recorded version describes the terms actually published.
//   6. The UI half: the customer can satisfy the gate — an explicit, never
//      pre-checked box that links to both documents.
//   7. The FK is RESTRICT, in the model AND in the SQL.
//
// WHAT KIND OF CHECK THIS IS: every assertion is SOURCE-LEVEL. It cannot prove
// the route returned 400 or that a row was written. That is
// scripts/runtime/terms-acceptance.runtime.test.ts's job.
//
// NON-VACUITY (measured 2026-08-23, pre-slice files restored into a working copy
// and reverted immediately afterwards, never committed):
//   · With `git show 31d4e35:` restored for app/api/register/route.ts and
//     app/register/page.tsx: **44 passed, 13 failed** (exit 1). Every §3/§4
//     check fails, because that route creates the account and records nothing,
//     and the §6 client-gate checks fail with it. The 44 that PASS are §1, §2,
//     §5 and §7 — the record's own shape, which those two files do not define.
//   · Unmodified slice tree: **57 passed, 0 failed** (exit 0).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  AUTHORED_UNAPPLIED_MIGRATIONS,
  GATE_D_MIGRATION_CHAIN,
} from "./gate-d-preflight-core";

export {};

let pass = 0,
  fail = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}`);
  }
}

// Prose must never satisfy — or break — an assertion about behaviour. A comment
// explaining a rollback ("DROP TABLE …") or a rejected alternative ("catch →
// return true") is not the code doing it, so structural checks read code only.
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sqlOf = (src: string) => src.replace(/^\s*--.*$/gm, "");

const root = join(__dirname, "..");
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const route = readFileSync(join(root, "app/api/register/route.ts"), "utf8");
const page = readFileSync(join(root, "app/register/page.tsx"), "utf8");
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
check("schema.prisma declares the TermsAcceptance model", /^model TermsAcceptance \{/m.test(schema));
check(
  "exactly one migration creates the table (no duplicate/competing migration)",
  migrationsWithTable.length === 1
);
const migration =
  migrationsWithTable.length === 1
    ? readFileSync(join(migrationsDir, migrationsWithTable[0], "migration.sql"), "utf8")
    : "";

const model = (schema.match(/^model TermsAcceptance \{([\s\S]*?)^\}/m) || [, ""])[1];
const modelFields = Array.from(model.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\s+\S/gm))
  .map((m) => m[1])
  .filter((f) => f !== "user"); // relation field: no column of its own
check("the model declares fields (parity check below is not vacuous)", modelFields.length >= 4);
for (const field of modelFields) {
  check(`migration creates a column for model field "${field}"`, new RegExp(`"${field}"\\s`).test(migration));
}
check("acceptance is versioned (model carries a version field)", modelFields.includes("version"));
check(
  "one acceptance per user per revision — UNIQUE(userId, version) in the model",
  /@@unique\(\[userId,\s*version\]\)/.test(model)
);
check(
  "the same uniqueness exists in the database, not just in Prisma",
  /CREATE UNIQUE INDEX[^\n]*ON "TermsAcceptance"\("userId", "version"\)/.test(migration)
);
check(
  "the record is tied to a real account (FK to User)",
  /ALTER TABLE "TermsAcceptance" ADD CONSTRAINT[^\n]*REFERENCES "User"/.test(migration)
);
// HELD POST-DB5 truth: this patch may land only after retained successful DB5
// evidence. Once eligible to land, the migration is canonical applied history;
// the review branch itself is not evidence that the database changed.
check(
  "the migration is canonical in Gate D and absent from authored/unapplied",
  migrationsWithTable.length === 1 &&
    (GATE_D_MIGRATION_CHAIN as readonly string[]).includes(migrationsWithTable[0]) &&
    !(AUTHORED_UNAPPLIED_MIGRATIONS as readonly string[]).includes(migrationsWithTable[0]),
);

console.log("\n2. nothing manufactures consent for people who never gave it");
// The single most dangerous possible line in this change is a backfill.
check(
  "the migration writes no rows into TermsAcceptance (no retroactive consent)",
  !/\b(INSERT|UPDATE|COPY)\b[\s\S]{0,120}"TermsAcceptance"/i.test(migration)
);
check("the migration is additive: it drops nothing", migration.length > 0 && !/\bDROP\b/i.test(sqlOf(migration)));
check(
  "the migration alters no pre-existing table",
  Array.from(sqlOf(migration).matchAll(/ALTER TABLE "([A-Za-z]+)"/g)).every((m) => m[1] === "TermsAcceptance")
);
check(
  "no column defaults an acceptance into existence (version/context have no @default)",
  !/^\s{2}(version|context)\b[^\n]*@default/m.test(model)
);
check(
  "the library performs no bulk write that could mark many users at once",
  !/createMany|updateMany|executeRaw/.test(codeOf(lib))
);

console.log("\n3. registration cannot complete without a recorded acceptance");
// Call SITES, not mentions: indexOf("recordTermsAcceptance") alone would match
// the import line and make every ordering check pass for free.
const routeCode = codeOf(route);
const iSchema = routeCode.indexOf("acceptTerms: z.literal(true)");
const iRefuse = routeCode.indexOf("termsRequired: true");
const iTx = routeCode.indexOf("prisma.$transaction");
const iCreate = routeCode.indexOf("tx.user.create");
const iRecord = routeCode.indexOf("await recordTermsAcceptance(created.id");
check("the route imports the acceptance library", /from "@\/lib\/terms"/.test(route));
check(
  "all call sites were located (the ordering checks below are not vacuous)",
  [iSchema, iRefuse, iTx, iCreate, iRecord].every((i) => i !== -1)
);
check(
  "acceptance is required by the request SCHEMA as a literal true — absent, false, \"true\" and 1 are all refused",
  iSchema !== -1 && !/acceptTerms:\s*z\.boolean/.test(routeCode)
);
check("a request without acceptance is refused with a truthful reason", iRefuse !== -1 && /status: 400/.test(routeCode));
check(
  "the refusal names both documents the user is being asked to accept",
  /termsUrl: TERMS_URL/.test(routeCode) && /privacyUrl: PRIVACY_URL/.test(routeCode)
);
check(
  "the refusal happens BEFORE the account is created (fail closed)",
  iRefuse !== -1 && iCreate !== -1 && iRefuse < iCreate
);
check(
  "the account and the acceptance share ONE transaction — no account without a record",
  iTx !== -1 && iCreate > iTx && iRecord > iCreate
);
check(
  "the acceptance write uses the transaction client, not the singleton",
  /recordTermsAcceptance\([^)]*,\s*tx\s*\)/.test(routeCode)
);
// A gate an env var can switch off is not a gate. Checked over the REGION
// between the parse and the create, so a flag called anything at all trips it.
check(
  "no environment flag can disable the acceptance gate",
  iSchema !== -1 && iCreate !== -1 && !/process\.env/.test(routeCode.slice(iSchema, iCreate))
);
check(
  "the pre-existing password policy and rate limit are still enforced (S1 not regressed)",
  /enforceRateLimit\(`register:/.test(routeCode) && /validatePassword\(password\)/.test(routeCode)
);

console.log("\n4. the client asserts; the server decides and records");
check(
  "the version RECORDED is the server constant, never anything from the request body",
  /recordTermsAcceptance\(created\.id,\s*CURRENT_TERMS_VERSION/.test(routeCode)
);
check(
  "the request body carries no version at all, so a client cannot choose one",
  !/termsVersion/.test(routeCode) && !/\d{4}-\d{2}-\d{2}/.test(codeOf(page))
);
check("acceptance is stored server-side through Prisma", /prisma\.termsAcceptance\.upsert|client\.termsAcceptance\.upsert/.test(codeOf(lib)));
check("the read is a real lookup of the stored row", /termsAcceptance\.findUnique/.test(codeOf(lib)));
check(
  "an existing acceptance is never overwritten (first agreement timestamp survives)",
  /update:\s*\{\s*\}/.test(lib)
);
// A swallowed database error would decide a legal question by accident.
check("the library never swallows an error (fail-closed by propagation)", !/\bcatch\b/.test(codeOf(lib)));
check(
  "the context vocabulary is a closed union, and registration is in it",
  /export type TermsContext =[^;]*"registration"/.test(lib)
);

console.log("\n5. the recorded version describes the terms actually published");
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const updated = termsPage.match(/updated="([A-Z][a-z]+) (\d{1,2}), (\d{4})"/);
const publishedVersion = updated
  ? `${updated[3]}-${String(MONTHS.indexOf(updated[1]) + 1).padStart(2, "0")}-${updated[2].padStart(2, "0")}`
  : "";
const declared = (lib.match(/CURRENT_TERMS_VERSION\s*=\s*"([^"]+)"/) || [, ""])[1];
check("the published terms page still exposes a revision date", publishedVersion !== "");
check("lib/terms.ts declares a version constant", declared !== "");
check(
  "the recorded version equals the published revision of /legal/terms " +
    `(page=${publishedVersion || "?"} lib=${declared || "?"})`,
  publishedVersion !== "" && declared === publishedVersion
);

console.log("\n6. the UI half — the user can satisfy the gate, and it is never pre-satisfied");
const componentPath = join(root, "components/TermsAccept.tsx");
check("the shared acceptance component exists", existsSync(componentPath));
const ui = existsSync(componentPath) ? readFileSync(componentPath, "utf8") : "";
const uiCode = codeOf(ui);

check("it is a client component", /^"use client";/m.test(ui));
check(
  "it pulls in no server-only module (client/server split holds)",
  ui !== "" && !/@\/lib\/prisma|next\/headers/.test(uiCode)
);
check("there is a real checkbox", /type="checkbox"/.test(uiCode));
check(
  "the field cannot pre-check itself: no defaultChecked and no default value for the prop",
  ui !== "" && !/defaultChecked/.test(uiCode) && !/accepted\s*=\s*true/.test(uiCode)
);
check(
  "and the page seeds it FALSE on every mount",
  /const \[acceptTerms, setAcceptTerms\] = useState\(false\)/.test(codeOf(page))
);
// Association is checked by matching the label's target to the INPUT's own id
// expression, so renaming the identifier cannot make this pass vacuously.
const inputTag = (uiCode.match(/<input[\s\S]*?\/>/) || [""])[0];
const inputId = (inputTag.match(/id=\{([A-Za-z0-9_]+)\}/) || [, ""])[1];
check("the checkbox carries an id (the label check below is not vacuous)", inputId !== "");
check(
  `a real <label htmlFor> points at that checkbox (id=${inputId || "?"})`,
  inputId !== "" && new RegExp(`<label[^>]*htmlFor=\\{${inputId}\\}`).test(uiCode)
);
check(
  "it links to BOTH published documents, at the same routes lib/terms.ts names",
  new RegExp(`DEFAULT_TERMS_URL = "${(lib.match(/TERMS_URL\s*=\s*"([^"]+)"/) || [, "__MISSING_TERMS_URL__"])[1]}"`).test(uiCode) &&
    new RegExp(`DEFAULT_PRIVACY_URL = "${(lib.match(/PRIVACY_URL\s*=\s*"([^"]+)"/) || [, "__MISSING_PRIVACY_URL__"])[1]}"`).test(uiCode)
);
check(
  "the component states no terms of its own and makes no outcome claim",
  ui !== "" && !/\b(guarantee|guaranteed|deletion|removal|raise your score|improve your score)\b/i.test(ui)
);
check("the component holds no terms version and cannot construct one", ui !== "" && !/\d{4}-\d{2}-\d{2}/.test(uiCode));
check(
  "the blocked state is announced, not signalled by colour alone",
  /role="alert"/.test(uiCode) && /aria-describedby=/.test(uiCode) && /id=\{hintId\}/.test(uiCode)
);
// The client half of the gate: a submit with the box unchecked returns early.
const pageCode = codeOf(page);
const iClientGuard = pageCode.indexOf("if (!acceptTerms)");
const iFetch = pageCode.indexOf('fetch("/api/register"');
check(
  "the form REFUSES to submit until acceptance is explicit, before any network call",
  iClientGuard !== -1 && iFetch !== -1 && iClientGuard < iFetch
);
check("…and the request it does send carries the assertion", /acceptTerms: true/.test(pageCode));
check(
  "the auth shell shows the compliance disclaimer and the legal links at EVERY breakpoint (A1-03)",
  (() => {
    const shell = readFileSync(join(root, "components/marketing/AuthLayout.tsx"), "utf8");
    const i = codeOf(shell).indexOf("is an educational tool, not a credit-repair organization");
    if (i === -1) return false;
    // Nothing between the start of the form column and the disclaimer may hide
    // it at a breakpoint — that `hidden lg:block` was the whole finding.
    const before = codeOf(shell).slice(codeOf(shell).indexOf("{/* Form side */}"), i);
    return !/\bhidden\b/.test(before) && /href="\/legal\/terms"/.test(shell) && /href="\/legal\/privacy"/.test(shell);
  })()
);

console.log("\n7. the FK action is pinned, in BOTH the model and the migration");
// m2 proved this guard was needed by building the package with the RESTRICT
// corrective deliberately omitted: the tree cherry-picked clean, typechecked, and
// passed the terms guard, schema-safety, gate-d-preflight and the runtime guard —
// every one exit 0 — while shipping ON DELETE CASCADE. That FK destroys consent
// evidence on any User delete, and once applied the loss is silent and
// irreversible (no backfill exists and none is permitted).
check(
  "migration FK on TermsAcceptance is ON DELETE RESTRICT, never CASCADE",
  /"TermsAcceptance_userId_fkey"[\s\S]*?REFERENCES "User"\("id"\) ON DELETE RESTRICT/.test(migration)
);
check("the migration contains NO cascading delete on TermsAcceptance", !/ON DELETE CASCADE/.test(migration));
check(
  "the Prisma model declares onDelete: Restrict (model and migration in lockstep)",
  /onDelete:\s*Restrict/.test(model)
);
check("the Prisma model declares no Cascade on the user relation", !/onDelete:\s*Cascade/.test(model));

console.log(`\nterms-acceptance.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
