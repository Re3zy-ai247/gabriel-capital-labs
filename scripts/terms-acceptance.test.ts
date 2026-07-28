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
//   5. (§6) The UI half: the customer can SATISFY the gate — an explicit,
//      never-pre-checked box, a blocked submit, human-readable 428 recovery — and
//      the paths that were never gated stay exactly as they were.
//
// WHAT KIND OF CHECK THIS IS: every assertion below is SOURCE-LEVEL (static) —
// it reads the shape of the code, never a running process. It cannot prove the
// route returned 428 to a real browser, that a real checkbox rendered, or that
// Stripe was not called. Runtime evidence comes from `npx tsc --noEmit`,
// `npx next build`, and production verification — not from this file.
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

console.log("\n6. the UI half — the customer can satisfy the gate, and only where it applies");
// The set of UI callers is DERIVED by scanning app/ for the checkout endpoint, not
// hard-coded as a list this file also asserts against. A fifth caller added later
// trips the first check and gets reviewed instead of shipping unwired.
function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkTsx(p));
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}
const CHECKOUT_ENDPOINT = "/api/stripe/checkout";
const callers = walkTsx(join(root, "app"))
  .filter((f) => readFileSync(f, "utf8").includes(CHECKOUT_ENDPOINT))
  .map((f) => f.slice(root.length + 1).split("\\").join("/"))
  .sort();

// Classified by MECHANISM, from the request each caller actually sends:
//  · a caller that names a subscription `plan` (or names none, which the route
//    reads as Professional) can reach the in-place `subscriptions.update` branch
//    and therefore the 428.
//  · a caller that only buys `product: "letters_5"` opens a payment-mode Checkout
//    Session every time and can never reach that branch — Stripe's own
//    consent_collection is the only mechanism there. Wiring the checkbox into it
//    would be a consent prompt for a gate that does not exist.
const UPGRADE_CALLERS = ["app/agency/page.tsx", "app/billing/page.tsx", "app/pricing/PricingTiers.tsx"];
const PACK_ONLY_CALLERS = ["app/letters/page.tsx"];
check("the UI callers of the checkout API are exactly the known set " +
  `(found: ${callers.join(", ") || "none"})`,
  JSON.stringify(callers) === JSON.stringify([...UPGRADE_CALLERS, ...PACK_ONLY_CALLERS].sort()));

const componentPath = join(root, "components/TermsAccept.tsx");
check("the shared acceptance component exists", existsSync(componentPath));
const ui = existsSync(componentPath) ? readFileSync(componentPath, "utf8") : "";
const uiCode = codeOf(ui);

check("it is a client component", /^"use client";/m.test(ui));
check("it pulls in no server-only module (client/server split holds)",
  ui !== "" && !/@\/lib\/prisma|next\/headers/.test(uiCode));

// — the box itself —
check("there is a real checkbox", /type="checkbox"/.test(uiCode));
check("it is UNCHECKED BY DEFAULT (state seeded false, controlled, never defaultChecked)",
  /const \[accepted, setAccepted\] = useState\(false\)/.test(uiCode) &&
  /checked=\{accepted\}/.test(uiCode) &&
  !/defaultChecked/.test(uiCode) &&
  !/useState\(true\)/.test(uiCode));
// Association is checked by matching the label's target to the INPUT's own id
// expression, so renaming the identifier cannot make this pass vacuously.
const inputTag = (uiCode.match(/<input[\s\S]*?\/>/) || [""])[0];
const inputId = (inputTag.match(/id=\{([A-Za-z0-9_]+)\}/) || [, ""])[1];
check("the checkbox carries an id (label check below is not vacuous)", inputId !== "");
check(`a real <label htmlFor> points at that checkbox (id=${inputId || "?"})`,
  inputId !== "" && new RegExp(`<label[^>]*htmlFor=\\{${inputId}\\}`).test(uiCode));

// — the gate —
const iGuard = uiCode.indexOf("if (!accepted)");
const iAccept = uiCode.indexOf("onAccept()");
check("the confirm handler REFUSES to submit until acceptance is explicit",
  iGuard !== -1 && iAccept !== -1 && iGuard < iAccept);
check("the unavailable state is announced, not signalled by colour alone " +
  "(aria-disabled + describedby + a text hint)",
  /aria-disabled=/.test(uiCode) && /aria-describedby=/.test(uiCode) && /id=\{hintId\}/.test(uiCode));
check("the acceptance error is announced to assistive tech", /role="alert"/.test(uiCode));
check("it links to the CURRENTLY published terms page, same route as lib/terms.ts",
  new RegExp(`DEFAULT_TERMS_URL = "${(lib.match(/TERMS_URL\s*=\s*"([^"]+)"/) || [, "\u0000"])[1]}"`).test(uiCode));
check("the component states no terms of its own and makes no outcome claim",
  ui !== "" && !/\b(guarantee|guaranteed|deletion|removal|raise your score|improve your score)\b/i.test(ui));

// — the version stays server-owned —
check("the component holds no terms version and cannot construct one",
  ui !== "" && !/\d{4}-\d{2}-\d{2}/.test(uiCode));
check("the version the client echoes is READ OFF the server's response",
  /body\.termsVersion/.test(uiCode) && /res\.status !== 428/.test(uiCode));

// — per-caller wiring —
const callerSrc = new Map(callers.map((c) => [c, readFileSync(join(root, c), "utf8")]));
for (const c of UPGRADE_CALLERS) {
  const src = callerSrc.get(c) ?? "";
  const code = codeOf(src);
  check(`${c}: recognises the acceptance precondition`, /readTermsChallenge\(/.test(code));
  check(`${c}: renders the acceptance UI (the 428 is not a dead end)`, /<TermsAccept/.test(code));
  check(`${c}: retries with the version the SERVER named`, /\.version\)/.test(code));
  check(`${c}: sends the assertion only when it was asked for`, /acceptTerms\s*\?/.test(code));
  check(`${c}: hard-codes no terms version`, src !== "" && !/\d{4}-\d{2}-\d{2}/.test(code));
}
for (const c of [...UPGRADE_CALLERS, ...PACK_ONLY_CALLERS]) {
  // A status code is a protocol detail. The customer reads the server's sentence.
  // Comments stripped — a comment naming the status is documentation, not display.
  check(`${c}: shows the customer no raw status code`, !/\b428\b/.test(codeOf(callerSrc.get(c) ?? "")));
}

// — the paths that were never gated are untouched —
for (const c of PACK_ONLY_CALLERS) {
  const code = codeOf(callerSrc.get(c) ?? "");
  check(`${c}: still buys the one-time pack the same way`, /product: "letters_5"/.test(code));
  check(`${c}: is NOT wired to the acceptance UI (no gate exists on that path)`,
    !/TermsAccept/.test(code) && !/acceptTerms/.test(code));
}
const pricing = codeOf(callerSrc.get("app/pricing/PricingTiers.tsx") ?? "");
check("the free tier still registers rather than paying (no checkout, no gate)",
  /freeRegister/.test(pricing) && /href=\{signedIn \? "\/dashboard" : "\/register"\}/.test(pricing));
check("the letter pack on /pricing still calls checkout with its original shape",
  /checkout\(\{ product: "letters_5" \}, "\/letters", "letters_5"\)/.test(pricing));

// ── The FK action is pinned, in BOTH the model and the migration ─────────────
// Wave 2.2 proved this guard was needed by building the package with the RESTRICT
// corrective (717697f) deliberately omitted: the tree cherry-picked clean, typechecked,
// and passed THIS guard, schema-safety, gate-d-preflight and the terms runtime guard —
// every one exit 0 — while shipping ON DELETE CASCADE. That FK destroys consent evidence
// on any User delete, and once applied to production the loss is silent and irreversible
// (no backfill exists and none is permitted). The corrective was protected by nothing but
// human memory. .ai/IDENTITY-CONSTITUTION.md §12.3 forbids erasure by cascade; §18 names
// FK cascade as the forbidden mechanism. Precedent for pinning it in a guard:
// scripts/identity-migration-guard.test.ts:52 does exactly this for Organization.owner.
check("migration FK on TermsAcceptance is ON DELETE RESTRICT, never CASCADE",
  /"TermsAcceptance_userId_fkey"[\s\S]*?REFERENCES "User"\("id"\) ON DELETE RESTRICT/.test(migration));
check("the migration contains NO cascading delete on TermsAcceptance",
  !/ON DELETE CASCADE/.test(migration));
check("the Prisma model declares onDelete: Restrict (model and migration in lockstep)",
  /onDelete:\s*Restrict/.test(model));
check("the Prisma model declares no Cascade on the user relation",
  !/onDelete:\s*Cascade/.test(model));

console.log(`\nterms-acceptance.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
