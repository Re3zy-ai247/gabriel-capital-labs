// Run: npx --no-install tsx scripts/verify-production.test.ts
//
// Offline regression proof for the production-verifier contract. Every checkout,
// catalog, dirty state, and curl response is a disposable local fixture. The fake
// curl executable never opens a socket, and the catalog parser only reads source.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean): void {
  if (condition) pass++;
  else {
    fail++;
    console.error("FAIL: " + label);
  }
}

const sourceRoot = join(dirname(resolve(process.argv[1])), "..");
const verifierSource = readFileSync(join(sourceRoot, "scripts/verify-production.sh"), "utf8");
const testDir = mkdtempSync(join(tmpdir(), "verify-production-contract-"));
const transportDir = join(testDir, "transport");
const fakeCurl = join(transportDir, "curl");
const fakeGit = join(transportDir, "git");
const fakeMv = join(transportDir, "mv");
mkdirSync(transportDir, { recursive: true });

writeFileSync(
  fakeCurl,
  [
    "#!/usr/bin/env bash",
    "set -u",
    'url=""',
    'for arg in "$@"; do',
    '  case "$arg" in https://*) url="$arg" ;; esac',
    "done",
    'printf "%s\\t%s\\n" "$url" "$*" >> "$CV_VERIFY_TEST_CURL_LOG"',
    'code="${CV_VERIFY_TEST_DEFAULT_CODE:-403}"',
    'rc="${CV_VERIFY_TEST_CURL_EXIT:-0}"',
    'case "$url" in',
    '  */api/admin/bootstrap) code="${CV_VERIFY_TEST_BOOTSTRAP_CODE:-404}"; rc="${CV_VERIFY_TEST_BOOTSTRAP_EXIT:-$rc}" ;;',
    '  */api/admin/migrate) code="${CV_VERIFY_TEST_MIGRATE_CODE:-404}"; rc="${CV_VERIFY_TEST_MIGRATE_EXIT:-$rc}" ;;',
    '  */api/stripe/webhook) code="${CV_VERIFY_TEST_WEBHOOK_CODE:-400}"; rc="${CV_VERIFY_TEST_WEBHOOK_EXIT:-$rc}" ;;',
    "esac",
    'printf "%s" "$code"',
    'exit "$rc"',
    "",
  ].join("\n"),
);
chmodSync(fakeCurl, 0o700);

const realGitResult = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" });
if (realGitResult.status !== 0 || !realGitResult.stdout.trim()) throw new Error("git executable not found for verifier fixtures");
const realGit = realGitResult.stdout.trim();
writeFileSync(
  fakeGit,
  [
    "#!/usr/bin/env bash",
    "set -u",
    `real_git=${JSON.stringify(realGit)}`,
    'if [ "${CV_VERIFY_TEST_MUTATE_AFTER_FIRST_STATUS:-0}" = "1" ]; then',
    '  is_status=0',
    '  for arg in "$@"; do [ "$arg" = "status" ] && is_status=1; done',
    '  if [ "$is_status" -eq 1 ]; then',
    '    "$real_git" "$@"',
    '    rc=$?',
    '    count=0',
    '    if [ -f "$CV_VERIFY_TEST_GIT_COUNT" ]; then read -r count < "$CV_VERIFY_TEST_GIT_COUNT"; fi',
    '    count=$((count + 1))',
    '    printf "%s\\n" "$count" > "$CV_VERIFY_TEST_GIT_COUNT"',
    '    if [ "$count" -eq 1 ]; then printf "changed during verification\\n" > "$CV_VERIFY_TEST_MUTATE_ROOT/mid-run-mutation.txt"; fi',
    '    exit "$rc"',
    "  fi",
    "fi",
    'exec "$real_git" "$@"',
    "",
  ].join("\n"),
);
chmodSync(fakeGit, 0o700);

const realMvResult = spawnSync("sh", ["-c", "command -v mv"], { encoding: "utf8" });
if (realMvResult.status !== 0 || !realMvResult.stdout.trim()) throw new Error("mv executable not found for verifier fixtures");
const realMv = realMvResult.stdout.trim();
writeFileSync(
  fakeMv,
  [
    "#!/usr/bin/env bash",
    "set -u",
    `real_mv=${JSON.stringify(realMv)}`,
    'if [ "${CV_VERIFY_TEST_MV_FAIL_SUMMARY:-0}" = "1" ]; then',
    '  destination=""',
    '  for arg in "$@"; do destination="$arg"; done',
    '  case "$destination" in */verify-production-summary.txt) exit 73 ;; esac',
    "fi",
    'exec "$real_mv" "$@"',
    "",
  ].join("\n"),
);
chmodSync(fakeMv, 0o700);

const CONSTANTS = String.raw`
export const PREMIUM_PRICE_CENTS = 9900;
export const AGENCY_PRICE_CENTS = 39900;
export const AGENCY_PRO_PRICE_CENTS = 69900;
export const AGENCY_PRO_LEGACY_MONTH_CENTS = 79900;
export const AGENCY_PRO_LEGACY_YEAR_CENTS = 799000;
export const LETTER_PACK_PRICE_CENTS = 1900;
export const PREMIUM_LOOKUP_KEY = "gcl_premium_monthly";
export const AGENCY_LOOKUP_KEY = "gcl_agency_monthly";
export const TAX_CODE_SAAS_PERSONAL = process.env.STRIPE_TAX_CODE_SAAS_PERSONAL || "txcd_10103000";
export const TAX_CODE_SAAS_BUSINESS = process.env.STRIPE_TAX_CODE_SAAS_BUSINESS || "txcd_10103001";
`;

const ENTRIES = [
  'premium_month: { lookup: PREMIUM_LOOKUP_KEY, product: "premium", amountCents: PREMIUM_PRICE_CENTS, interval: "month" },',
  'premium_year: { lookup: "gcl_premium_yearly", product: "premium", amountCents: 99000, interval: "year" },',
  'agency_month: { lookup: AGENCY_LOOKUP_KEY, product: "agency", amountCents: AGENCY_PRICE_CENTS, interval: "month" },',
  'agency_year: { lookup: "gcl_agency_yearly", product: "agency", amountCents: 399000, interval: "year" },',
  'agency_pro_month: { lookup: "gcl_agency_pro_monthly_v2", product: "agency_pro", amountCents: AGENCY_PRO_PRICE_CENTS, interval: "month" },',
  'agency_pro_year: { lookup: "gcl_agency_pro_yearly_v2", product: "agency_pro", amountCents: 699000, interval: "year" },',
  'letters_5: { lookup: "gcl_letters_5", product: "letters_5", amountCents: LETTER_PACK_PRICE_CENTS, interval: null },',
];

const PLAN = String.raw`
export function planForPrice(price: { lookup_key?: string | null; unit_amount?: number | null } | null | undefined) {
  const lk = price?.lookup_key ?? "";
  if (lk.startsWith("gcl_agency_pro")) return "agency_pro";
  if (lk.startsWith("gcl_agency")) return "agency";
  if (lk.startsWith("gcl_premium")) return "premium";
  const amt = price?.unit_amount ?? 0;
  if (
    amt === AGENCY_PRO_PRICE_CENTS ||
    amt === 699000 ||
    amt === AGENCY_PRO_LEGACY_MONTH_CENTS ||
    amt === AGENCY_PRO_LEGACY_YEAR_CENTS
  ) return "agency_pro";
  if (amt === AGENCY_PRICE_CENTS || amt === 399000) return "agency";
  if (amt === PREMIUM_PRICE_CENTS || amt === 99000) return "premium";
  return null;
}
`;

const PRODUCTS = String.raw`
const PRODUCTS: Record<string, ProductDef> = {
  premium: {
    key: "premium",
    name: "CreditVector — Professional",
    description: "Unlimited AI-refined dispute letters, the AI dispute strategist, and 90-day progress tracking.",
    taxCode: TAX_CODE_SAAS_PERSONAL,
  },
  agency: {
    key: "agency",
    name: "CreditVector — Agency",
    description: "Manage clients in their own workspaces with the full analysis and letter engine. Up to 15 active client workspaces — built for solo operators.",
    taxCode: TAX_CODE_SAAS_BUSINESS,
  },
  agency_pro: {
    key: "agency_pro",
    name: "CreditVector — Agency Pro",
    description: "Everything in Agency with up to 40 active client workspaces, team collaboration, analytics, and bulk actions — built for growing teams.",
    taxCode: TAX_CODE_SAAS_BUSINESS,
  },
  letters_5: {
    key: "letters_5",
    name: "CreditVector — 5 Dispute Letters",
    description: "A one-time pack of 5 additional dispute letters.",
    taxCode: TAX_CODE_SAAS_PERSONAL,
  },
};
`;

const RESOLVE_PRODUCT = String.raw`
async function resolveProduct(stripe: any, productKey: string): Promise<string> {
  const def = PRODUCTS[productKey];
  const list = await stripe.products.list({ active: true, limit: 100 });
  const existing = list.data.find((p) => p.metadata?.gcl_product === productKey || p.name === def.name);
  if (existing) {
    const current = typeof existing.tax_code === "string" ? existing.tax_code : existing.tax_code?.id ?? null;
    if (def.taxCode && current !== def.taxCode) {
      await stripe.products.update(existing.id, { tax_code: def.taxCode });
    }
    return existing.id;
  }
  const created = await stripe.products.create({
    name: def.name,
    description: def.description,
    tax_code: def.taxCode,
    metadata: { gcl_product: productKey },
  });
  return created.id;
}
`;

const RESOLVE_PRICE = String.raw`
export async function resolvePrice(stripe: any, key: string) {
  const def = PRICES[key];
  if (!def) throw new Error("Unknown price key");
  const existing = await stripe.prices.list({ lookup_keys: [def.lookup], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const product = await resolveProduct(stripe, def.product);
  const price = await stripe.prices.create({
    product,
    unit_amount: def.amountCents,
    currency: "usd",
    lookup_key: def.lookup,
    ...(def.interval ? { recurring: { interval: def.interval } } : {}),
  });
  return price.id;
}
`;

function catalog(
  entries = ENTRIES,
  plan = PLAN,
  constants = CONSTANTS,
  resolver = RESOLVE_PRICE,
  productResolver = RESOLVE_PRODUCT,
  products = PRODUCTS,
): string {
  return `${constants}\n${products}\nexport const PRICES: Record<string, PriceDef> = {\n${entries.join("\n")}\n};\n${productResolver}\n${resolver}\n${plan}`;
}

const FORMATTED_CATALOG = String.raw`
// Constants may wrap, change quote style, and contain harmless comments.
export const PREMIUM_PRICE_CENTS
  = 9900;
export const AGENCY_PRICE_CENTS = 39900;
export const AGENCY_PRO_PRICE_CENTS = 69900;
export const AGENCY_PRO_LEGACY_MONTH_CENTS = 79900;
export const AGENCY_PRO_LEGACY_YEAR_CENTS = 799000;
export const LETTER_PACK_PRICE_CENTS = 1900;
export const PREMIUM_LOOKUP_KEY
  = 'gcl_premium_monthly';
export const AGENCY_LOOKUP_KEY = 'gcl_agency_monthly';
export const TAX_CODE_SAAS_PERSONAL =
  process.env.STRIPE_TAX_CODE_SAAS_PERSONAL || 'txcd_10103000';
export const TAX_CODE_SAAS_BUSINESS = process.env.STRIPE_TAX_CODE_SAAS_BUSINESS || 'txcd_10103001';

${PRODUCTS}

export const PRICES : Record<string, PriceDef> =
{
  premium_month : {
    interval : 'month',
    amountCents : PREMIUM_PRICE_CENTS,
    product : 'premium',
    lookup : PREMIUM_LOOKUP_KEY,
  },
  premium_year: {
    product: 'premium', lookup: 'gcl_premium_yearly',
    interval: 'year', amountCents: 99000,
  },
  agency_month: {
    amountCents: AGENCY_PRICE_CENTS,
    lookup: AGENCY_LOOKUP_KEY,
    interval: 'month',
    product: 'agency',
  },
  agency_year: { interval: 'year', lookup: 'gcl_agency_yearly', amountCents: 399000, product: 'agency' },
  /* lookup: 'comment-decoy' must not become an eighth entry. */
  agency_pro_month: { product: 'agency_pro', interval: 'month', lookup: 'gcl_agency_pro_monthly_v2', amountCents: AGENCY_PRO_PRICE_CENTS },
  agency_pro_year: { amountCents: 699000, lookup: 'gcl_agency_pro_yearly_v2', product: 'agency_pro', interval: 'year' },
  letters_5: { interval: null, product: 'letters_5', amountCents: LETTER_PACK_PRICE_CENTS, lookup: 'gcl_letters_5' },
};

${RESOLVE_PRODUCT}

export async function resolvePrice(stripe: any, key: string) {
  const def
    = PRICES [ key ];
  if (!def) throw new Error('Unknown price key');
  const existing = await stripe.prices.list({ lookup_keys: [def.lookup], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const product = await resolveProduct(stripe, def.product);
  const price = await stripe.prices.create({
    product,
    unit_amount: def.amountCents,
    currency: 'usd',
    lookup_key: def.lookup,
    ...(def.interval ? { recurring: { interval: def.interval } } : {}),
  });
  return price.id;
}

export function planForPrice(price: { lookup_key?: string | null; unit_amount?: number | null } | null | undefined) {
  const lk = price?.lookup_key ?? '';
  if (
    lk.startsWith('gcl_agency_pro')
  ) return 'agency_pro';
  if (lk.startsWith('gcl_agency')) return 'agency';
  if (lk.startsWith('gcl_premium')) return 'premium';
  const amt = price?.unit_amount ?? 0;
  if (
    amt === AGENCY_PRO_PRICE_CENTS ||
    amt === 699000 ||
    amt === AGENCY_PRO_LEGACY_MONTH_CENTS ||
    amt === AGENCY_PRO_LEGACY_YEAR_CENTS
  ) return 'agency_pro';
  if (amt === AGENCY_PRICE_CENTS || amt === 399000) return 'agency';
  if (amt === PREMIUM_PRICE_CENTS || amt === 99000) return 'premium';
  return null;
}
`;

type Fixture = { commit: string; root: string; tree: string };
type RunResult = { calls: string[]; output: string; status: number | null };

function write(root: string, relative: string, contents: string, executable = false): void {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  if (executable) chmodSync(path, 0o700);
}

function runGit(root: string, args: string[]): string {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return (result.stdout || "").trim();
}

function createFixture(catalogSource = catalog(), marker = ""): Fixture {
  const root = mkdtempSync(join(testDir, "repo-"));
  write(root, ".gitignore", "node_modules/\n");
  write(root, "scripts/verify-production.sh", verifierSource, true);
  write(root, "scripts/dummy.test.ts", "export {};\n");
  write(root, "lib/stripe.ts", catalogSource);
  write(root, "lib/observability.ts", 'const target = process.env.ALERT_WEBHOOK_URL;\nvoid fetch(target || "", { body: JSON.stringify({ event: "fixture" }) });\n');
  write(root, "lib/docCrypto.ts", 'const TEXT_PREFIX = "cv1:";\n');
  write(root, "lib/billing.ts", 'const fixture = `ON CONFLICT ("id") DO UPDATE`;\n');
  write(root, "lib/session.ts", [
    "token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });",
    "const id = token?.uid;",
    "passwordSessionVersionMatches(account, token);",
    'return account.disabled ? { state: "disabled", account } : { state: "enabled", account };',
    "",
  ].join("\n"));
  write(root, "lib/auth.ts", [
    "if (token.cancellationOnly === true) {",
    "  return null as unknown as typeof session;",
    "}",
    "",
  ].join("\n"));
  write(root, "app/api/admin/diagnostics/route.ts", [
    'const keys = ["ALERT_WEBHOOK_URL", "SETUP_SECRET"];',
    "const envPresent: Record<string, boolean> = {};",
    "for (const k of keys) envPresent[k] = Boolean(process.env[k]);",
    "await requireAdmin();",
    "",
  ].join("\n"));
  for (const route of ["encrypt-reports", "encrypt-letters"]) {
    write(root, `app/api/admin/${route}/route.ts`, "await requireAdmin();\nisEncryptedText(value);\n");
  }
  write(root, "app/api/stripe/portal/route.ts", "const account = await currentAccount();\n");
  write(root, "app/api/billing/self-cancel/route.ts", [
    "const state = await sessionAccountState(req);",
    'if (state.state === "enabled") return refused;',
    "stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });",
    "",
  ].join("\n"));
  write(root, "app/api/admin/billing/cancel/route.ts", "export {};\n");
  write(root, "app/api/stripe/webhook/route.ts", "await completeStripeEvent(event.id, event.type);\n");
  write(root, "package.json", JSON.stringify({ scripts: { typecheck: "fixture", lint: "fixture", build: "fixture" } }, null, 2) + "\n");
  if (marker) write(root, "fixture-marker.txt", marker + "\n");

  runGit(root, ["init", "-q"]);
  runGit(root, ["config", "user.email", "fixture@example.invalid"]);
  runGit(root, ["config", "user.name", "Verifier Fixture"]);
  runGit(root, ["add", "."]);
  runGit(root, ["-c", "commit.gpgSign=false", "commit", "-qm", "fixture"]);
  mkdirSync(join(root, "node_modules"), { recursive: true });
  symlinkSync(join(sourceRoot, "node_modules", "typescript"), join(root, "node_modules", "typescript"), "dir");
  return {
    root,
    commit: runGit(root, ["rev-parse", "HEAD"]),
    tree: runGit(root, ["rev-parse", "HEAD^{tree}"]),
  };
}

let runNumber = 0;
function runVerifier(
  fixture: Fixture,
  options: {
    args?: string[];
    env?: Record<string, string>;
    expectations?: boolean;
    outputDir?: string;
    probe?: boolean;
  } = {},
): RunResult {
  const curlLog = join(testDir, `curl-${runNumber++}.log`);
  writeFileSync(curlLog, "");
  const args = [join(fixture.root, "scripts/verify-production.sh")];
  if (options.probe) args.push("--probe");
  if (options.expectations !== false) args.push("--expect-commit", fixture.commit, "--expect-tree", fixture.tree);
  if (options.args) args.push(...options.args);
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.CV_EXPECTED_COMMIT;
  delete env.CV_EXPECTED_TREE;
  delete env.CV_VERIFY_CATALOG_SOURCE;
  delete env.CV_VERIFY_OUT;
  delete env.CV_VERIFY_TEST_MV_FAIL_SUMMARY;
  Object.assign(env, {
    CV_BASE_URL: "https://example.invalid",
    CV_VERIFY_TEST_CURL_LOG: curlLog,
    PATH: transportDir + ":" + (process.env.PATH || ""),
    ...(options.outputDir ? { CV_VERIFY_OUT: options.outputDir } : {}),
    ...options.env,
  });
  const result = spawnSync("bash", args, { cwd: fixture.root, encoding: "utf8", env });
  return {
    calls: readFileSync(curlLog, "utf8").trim().split("\n").filter(Boolean),
    output: (result.stdout || "") + (result.stderr || ""),
    status: result.status,
  };
}

function includesAll(haystack: string, needles: string[]): boolean {
  return needles.every((needle) => haystack.includes(needle));
}

const PROTECTED_MUTATION_DIAGNOSTIC =
  "catalog source contains binding-aware protected mutation";

function expectProtectedMutationFailure(label: string, executableSource: string): RunResult {
  const result = runVerifier(createFixture(`${catalog()}\n${executableSource}\n`));
  const rejected =
    result.status === 1 &&
      result.output.includes(PROTECTED_MUTATION_DIAGNOSTIC) &&
      result.output.includes("── RELEASE RESULT: FAIL") &&
      !result.output.includes("catalog ↔ planForPrice mapping is consistent");
  if (!rejected) console.error(`MALICIOUS FAILURE DETAIL (${label}):\n${result.output}`);
  check(label, rejected);
  return result;
}

function expectBenignCatalogPass(label: string, executableSource: string): RunResult {
  const result = runVerifier(createFixture(`${catalog()}\n${executableSource}\n`));
  const accepted =
    result.status === 2 &&
      result.output.includes("── OFFLINE RESULT: PASS_OFFLINE") &&
      result.output.includes("── RELEASE RESULT: VERIFICATION_REQUIRED") &&
      result.output.includes("catalog ↔ planForPrice mapping is consistent") &&
      result.output.includes("unknown price fails closed");
  if (!accepted) console.error(`BENIGN FAILURE DETAIL (${label}):\n${result.output}`);
  check(label, accepted);
  return result;
}

try {
  check(
    "the catalog verifier reads source and never imports or evaluates lib/stripe.ts",
    verifierSource.includes('fs.readFileSync(path, "utf8")') &&
      verifierSource.includes('ts.createSourceFile(path, original') &&
      verifierSource.includes("ts.transpileModule(original") &&
      !/require\([^)]*stripe/i.test(verifierSource) &&
      !/\bimport\s*\([^)]*stripe/i.test(verifierSource) &&
      !/\beval\s*\(/.test(verifierSource),
  );
  check(
    "the BSD-incompatible generated sed word-boundary substitution is gone",
    !verifierSource.includes('s/\\\\bPREMIUM_LOOKUP_KEY') && !verifierSource.includes('s/\\\\bAGENCY_LOOKUP_KEY'),
  );
  check(
    "catalog evidence cannot be swapped to source outside the bound repository tree",
    verifierSource.includes('STRIPE_SOURCE="$ROOT/lib/stripe.ts"') &&
      !verifierSource.includes("CV_VERIFY_CATALOG_SOURCE"),
  );
  check(
    "consumer checkout remains explicitly hard-closed while the historical key is verified",
    verifierSource.includes("consumer checkout remains disabled") && verifierSource.includes("disabled payer path is cancellation-only"),
  );

  const accepted = createFixture();
  const acceptedRun = runVerifier(accepted);
  check(
    "a clean accepted catalog yields PASS_OFFLINE for the offline scope",
    acceptedRun.status === 2 && acceptedRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE"),
  );
  check(
    "external facts keep the release result explicit and nonzero",
    acceptedRun.output.includes("── RELEASE RESULT: VERIFICATION_REQUIRED") &&
      acceptedRun.output.includes("VERIFICATION REQUIRED — PROVIDER") &&
      acceptedRun.output.includes("VERIFICATION REQUIRED — PRODUCTION"),
  );
  check(
    "the exact seven-entry and six-plus-one catalog shape passes",
    includesAll(acceptedRun.output, [
      "stripe catalog exact entry count — 7 catalog entries parsed",
      "stripe catalog recurrence shape is exact — 6 subscription entries and 1 one-time letter pack",
      "stripe catalog lookup-key set is exact — all seven RC1 lookup keys are represented",
      "stripe catalog exact entry tuples — every accepted entry key, lookup, product, amount, and interval is exact",
    ]),
  );
  check(
    "the premium and agency monthly constants resolve to nonblank historical keys",
    acceptedRun.output.includes("monthly premium lookup key parsed — gcl_premium_monthly") &&
      acceptedRun.output.includes("monthly agency lookup key parsed — gcl_agency_monthly"),
  );
  check(
    "the mapping and final unknown fallthrough pass",
    acceptedRun.output.includes("catalog ↔ planForPrice mapping is consistent") && acceptedRun.output.includes("unknown price fails closed"),
  );
  const symlinkedCatalog = createFixture();
  const externalCatalogPath = join(testDir, "external-stripe.ts");
  writeFileSync(externalCatalogPath, catalog());
  rmSync(join(symlinkedCatalog.root, "lib/stripe.ts"));
  symlinkSync(externalCatalogPath, join(symlinkedCatalog.root, "lib/stripe.ts"));
  const symlinkedCatalogRun = runVerifier(symlinkedCatalog);
  check(
    "catalog analysis rejects a symlink even when its external referent has accepted bytes",
    symlinkedCatalogRun.status === 1 &&
      symlinkedCatalogRun.output.includes("catalog source must be a regular non-symlink file") &&
      !symlinkedCatalogRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const substitutedCompiler = createFixture();
  const substitutedCompilerRoot = join(substitutedCompiler.root, "node_modules/typescript");
  rmSync(substitutedCompilerRoot, { recursive: true, force: true });
  write(
    substitutedCompiler.root,
    "node_modules/typescript/package.json",
    JSON.stringify({ name: "typescript", version: "5.9.3", main: "index.js" }) + "\n",
  );
  write(
    substitutedCompiler.root,
    "node_modules/typescript/index.js",
    `module.exports = require(${JSON.stringify(join(sourceRoot, "node_modules/typescript/lib/typescript.js"))});\n`,
  );
  const substitutedCompilerRun = runVerifier(substitutedCompiler);
  check(
    "catalog analysis binds the ignored local TypeScript implementation to accepted compiler bytes",
    substitutedCompilerRun.status === 1 &&
      substitutedCompilerRun.output.includes("installed TypeScript compiler bytes do not match accepted 5.9.3") &&
      !substitutedCompilerRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const preloadedCompiler = createFixture(
    `${catalog()}\n` +
      `/* CV_PRELOAD_STRIP_START */\n` +
      `export function poisonCompilerPreload(value:any):void{value.__proto__.__proto__.polluted=true}\n` +
      `/* CV_PRELOAD_STRIP_END */\n`,
  );
  const compilerPreloadPath = join(preloadedCompiler.root, "scripts/compiler-preload.cjs");
  const compilerPreloadMarker = join(preloadedCompiler.root, "compiler-preload-executed.txt");
  write(
    preloadedCompiler.root,
    "scripts/compiler-preload.cjs",
    String.raw`
const fs = require("node:fs");
const Module = require("node:module");
if (process.env.CV_TEST_PRELOAD_MARKER) {
  fs.writeFileSync(process.env.CV_TEST_PRELOAD_MARKER, "executed\n");
}
const originalLoad = Module._load;
const startMarker = "/* CV_PRELOAD_STRIP_START */";
const endMarker = "/* CV_PRELOAD_STRIP_END */";
const strip = (source) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return start >= 0 && end >= 0
    ? source.slice(0, start) + source.slice(end + endMarker.length)
    : source;
};
let wrapped;
Module._load = function(request, parent, isMain) {
  if (
    typeof request === "string" &&
    request.replaceAll("\\", "/").endsWith("/typescript/lib/typescript.js")
  ) {
    const real = originalLoad.apply(this, arguments);
    if (!wrapped) {
      wrapped = new Proxy(real, {
        get(target, key, receiver) {
          if (key === "createSourceFile") {
            return (fileName, sourceText, ...rest) =>
              target.createSourceFile(fileName, strip(sourceText), ...rest);
          }
          if (key === "transpileModule") {
            return (sourceText, options) => target.transpileModule(strip(sourceText), options);
          }
          return Reflect.get(target, key, receiver);
        },
      });
    }
    return wrapped;
  }
  return originalLoad.apply(this, arguments);
};
`,
  );
  runGit(preloadedCompiler.root, ["add", "scripts/compiler-preload.cjs"]);
  runGit(preloadedCompiler.root, ["-c", "commit.gpgSign=false", "commit", "-qm", "tracked hostile preload"]);
  preloadedCompiler.commit = runGit(preloadedCompiler.root, ["rev-parse", "HEAD"]);
  preloadedCompiler.tree = runGit(preloadedCompiler.root, ["rev-parse", "HEAD^{tree}"]);
  const preloadedCompilerRun = runVerifier(preloadedCompiler, {
    env: {
      NODE_OPTIONS: `--require=${compilerPreloadPath}`,
      npm_config_node_options: `--require=${compilerPreloadPath}`,
      NPM_CONFIG_NODE_OPTIONS: `--require=${compilerPreloadPath}`,
      CV_TEST_PRELOAD_MARKER: compilerPreloadMarker,
    },
  });
  check(
    "catalog parser clears inherited Node preload options before loading the bound compiler",
    preloadedCompilerRun.status === 1 &&
      preloadedCompilerRun.output.includes(PROTECTED_MUTATION_DIAGNOSTIC) &&
      !preloadedCompilerRun.output.includes("catalog ↔ planForPrice mapping is consistent") &&
      !existsSync(compilerPreloadMarker),
  );

  const substitutedCatalog = createFixture();
  appendFileSync(join(substitutedCatalog.root, "lib/stripe.ts"), "\n// transient unreviewed substitution\n");
  const substitutedCatalogRun = runVerifier(substitutedCatalog);
  check(
    "catalog analysis binds the exact parsed byte snapshot to the reviewed commit blob",
    substitutedCatalogRun.status === 1 &&
      substitutedCatalogRun.output.includes("stripe catalog source bound to reviewed Git blob") &&
      substitutedCatalogRun.output.includes("parsed=") &&
      substitutedCatalogRun.output.includes("reviewed blob=") &&
      substitutedCatalogRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );
  check(
    "all seven expected keys are emitted, including both constant-backed monthly keys",
    includesAll(acceptedRun.output, [
      "gcl_premium_monthly", "gcl_premium_yearly", "gcl_agency_monthly", "gcl_agency_yearly",
      "gcl_agency_pro_monthly_v2", "gcl_agency_pro_yearly_v2", "gcl_letters_5",
    ]),
  );
  check(
    "commit, tree, and clean state are bound to the exact fixture",
    acceptedRun.output.includes(`repository commit bound — ${accepted.commit}`) &&
      acceptedRun.output.includes(`repository tree bound — ${accepted.tree}`) &&
      acceptedRun.output.includes("repository custody clean — dirty=false") &&
      acceptedRun.output.includes("reviewed commit/tree pair is consistent"),
  );

  const noExpectation = runVerifier(accepted, { expectations: false });
  check(
    "missing reviewed input is VERIFICATION_REQUIRED rather than PASS or FAIL",
    noExpectation.status === 2 && noExpectation.output.includes("VERIFICATION REQUIRED — INPUT") &&
      noExpectation.output.includes("── OFFLINE RESULT: VERIFICATION_REQUIRED"),
  );

  const usageError = runVerifier(accepted, { args: ["--not-a-verifier-option"] });
  check(
    "invalid command-line input preserves the usage-error exit contract",
    usageError.status === 64 && usageError.output.includes("unknown option: --not-a-verifier-option"),
  );

  const badCommit = runVerifier(accepted, {
    expectations: false,
    args: ["--expect-commit", "0".repeat(40), "--expect-tree", accepted.tree],
  });
  check(
    "an expected commit mismatch hard-fails",
    badCommit.status === 1 && badCommit.output.includes("reviewed commit matches") && badCommit.output.includes("── RELEASE RESULT: FAIL"),
  );

  const badTree = runVerifier(accepted, {
    expectations: false,
    args: ["--expect-commit", accepted.commit, "--expect-tree", "0".repeat(40)],
  });
  check(
    "an expected tree mismatch hard-fails",
    badTree.status === 1 && badTree.output.includes("reviewed tree matches") && badTree.output.includes("reviewed commit/tree pair is consistent"),
  );

  const crossTree = createFixture();
  const firstCommit = crossTree.commit;
  appendFileSync(join(crossTree.root, "package.json"), "\n");
  runGit(crossTree.root, ["add", "package.json"]);
  runGit(crossTree.root, ["-c", "commit.gpgSign=false", "commit", "-qm", "second tree"]);
  crossTree.commit = runGit(crossTree.root, ["rev-parse", "HEAD"]);
  crossTree.tree = runGit(crossTree.root, ["rev-parse", "HEAD^{tree}"]);
  const mixedPair = runVerifier(crossTree, {
    expectations: false,
    args: ["--expect-commit", firstCommit, "--expect-tree", crossTree.tree],
  });
  check(
    "a commit from one tree cannot be reused with another tree",
    mixedPair.status === 1 && mixedPair.output.includes("reviewed commit/tree pair is consistent") &&
      mixedPair.output.includes("not " + crossTree.tree),
  );

  const dirtyTracked = createFixture();
  appendFileSync(join(dirtyTracked.root, "package.json"), " ");
  const dirtyTrackedRun = runVerifier(dirtyTracked);
  check(
    "tracked dirty bytes hard-fail custody",
    dirtyTrackedRun.status === 1 && dirtyTrackedRun.output.includes("repository custody clean — dirty=true"),
  );

  const dirtyUntracked = createFixture();
  write(dirtyUntracked.root, "untracked-candidate.txt", "candidate bytes\n");
  const dirtyUntrackedRun = runVerifier(dirtyUntracked);
  check(
    "untracked candidate bytes hard-fail custody",
    dirtyUntrackedRun.status === 1 && dirtyUntrackedRun.output.includes("repository custody clean — dirty=true"),
  );

  const inWorktreeOutput = createFixture();
  const inWorktreeOutputDir = join(inWorktreeOutput.root, "evidence");
  mkdirSync(inWorktreeOutputDir);
  const inWorktreeOutputRun = runVerifier(inWorktreeOutput, { outputDir: inWorktreeOutputDir });
  check(
    "evidence output inside the candidate repository is rejected before it can self-dirty custody",
    inWorktreeOutputRun.status === 1 &&
      inWorktreeOutputRun.output.includes("verification evidence output is outside the repository") &&
      !existsSync(join(inWorktreeOutputDir, "verify-production-summary.txt")),
  );

  const changingCustody = createFixture();
  const gitCount = join(testDir, `git-count-${runNumber}.txt`);
  writeFileSync(gitCount, "0\n");
  const changingCustodyRun = runVerifier(changingCustody, {
    env: {
      CV_VERIFY_TEST_MUTATE_AFTER_FIRST_STATUS: "1",
      CV_VERIFY_TEST_GIT_COUNT: gitCount,
      CV_VERIFY_TEST_MUTATE_ROOT: changingCustody.root,
    },
  });
  check(
    "a clean initial snapshot cannot certify bytes changed later in the same run",
    changingCustodyRun.status === 1 &&
      changingCustodyRun.output.includes("repository custody clean — dirty=false") &&
      changingCustodyRun.output.includes("repository custody stable through verification evidence") &&
      changingCustodyRun.output.includes("repository became dirty during verification"),
  );

  const formattedRun = runVerifier(createFixture(FORMATTED_CATALOG));
  check(
    "multiline, reordered, spaced, commented, and single-quoted formatting is deterministic",
    formattedRun.status === 2 && formattedRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE") &&
      formattedRun.output.includes("stripe catalog exact entry count — 7 catalog entries parsed"),
  );

  const astFormattedPlan = PLAN.replace(
    "export function planForPrice(",
    "export function /* harmless declaration formatting */ planForPrice\n(",
  );
  const astFormattedPlanRun = runVerifier(createFixture(catalog(ENTRIES, astFormattedPlan)));
  check(
    "semantically harmless comments and line breaks in the plan declaration remain accepted",
    astFormattedPlanRun.status === 2 &&
      astFormattedPlanRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE") &&
      astFormattedPlanRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const reorderedResolver = RESOLVE_PRICE
    .replace(
      "{ lookup_keys: [def.lookup], active: true, limit: 1 }",
      "{ limit: 1, lookup_keys: [def.lookup], active: true }",
    )
    .replace(
      String.raw`  const price = await stripe.prices.create({
    product,
    unit_amount: def.amountCents,
    currency: "usd",
    lookup_key: def.lookup,
    ...(def.interval ? { recurring: { interval: def.interval } } : {}),
  });`,
      String.raw`  const price = await stripe.prices.create({
    lookup_key: def.lookup,
    ...(def.interval ? { recurring: { interval: def.interval } } : {}),
    currency: "usd",
    product,
    unit_amount: def.amountCents,
  });`,
    );
  const reorderedResolverRun = runVerifier(createFixture(catalog(
    ENTRIES,
    PLAN,
    CONSTANTS,
    reorderedResolver,
  )));
  check(
    "semantically harmless resolver option-property reordering remains accepted",
    reorderedResolverRun.status === 2 &&
      reorderedResolverRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE") &&
      reorderedResolverRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const quotedOptionResolver = RESOLVE_PRICE
    .replace("lookup_keys:", '"lookup_keys":')
    .replace("active: true", '"active": true')
    .replace("limit: 1", '"limit": 1')
    .replace("unit_amount:", '"unit_amount":')
    .replace("currency:", '"currency":')
    .replace("lookup_key:", '"lookup_key":')
    .replace("recurring:", '"recurring":')
    .replace("interval: def.interval", '"interval": def.interval');
  const quotedOptionResolverRun = runVerifier(createFixture(catalog(
    ENTRIES,
    PLAN,
    CONSTANTS,
    quotedOptionResolver,
  )));
  check(
    "semantically equivalent quoted resolver option keys remain accepted",
    quotedOptionResolverRun.status === 2 &&
      quotedOptionResolverRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE") &&
      quotedOptionResolverRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const emptyStatementFormattingRun = runVerifier(createFixture(catalog() + "\n;\n"));
  check(
    "a semantically inert standalone semicolon remains accepted formatting",
    emptyStatementFormattingRun.status === 2 &&
      emptyStatementFormattingRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE") &&
      emptyStatementFormattingRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  expectBenignCatalogPass(
    "ordinary local arithmetic, counters, and object mutation remain accepted",
    String.raw`
function benignLocalMutation(per: number, n: number): number {
  let total = 0;
  total += per / n;
  let counter = 0;
  counter++;
  const local = { value: 0 };
  local.value = total;
  return local.value + counter;
}
`,
  );

  expectBenignCatalogPass(
    "a benign object property named String is not intrinsic provenance",
    String.raw`
export function benignStringProperty(): boolean {
  const local = { String: { prototype: { startsWith: false } } };
  local.String.prototype.startsWith = true;
  return local.String.prototype.startsWith;
}
`,
  );

  expectBenignCatalogPass(
    "benign local object and array assignment destructuring remains accepted",
    String.raw`
export function benignLocalAssignmentDestructuring(): number {
  const source = { value: 1, extra: 2 };
  let value = 0;
  let rest: any = {};
  ({ value, ...rest } = source);
  const sequence = [3];
  let first = 0;
  [first] = sequence;
  return value + rest.extra + first;
}
`,
  );

  expectBenignCatalogPass(
    "console.error JSON formatting accepts plain local data without callable hooks",
    String.raw`
export function benignConsoleJson(): void {
  console.error("%j", { safe: true, count: 1 });
}
`,
  );

  expectBenignCatalogPass(
    "console.error JSON formatting accepts a harmless bound toJSON hook",
    String.raw`
function benignBoundToJson(): string {
  return "safe";
}
export function benignConsoleBoundToJson(): void {
  console.error("%j", { toJSON: benignBoundToJson.bind(null) });
}
`,
  );

  expectBenignCatalogPass(
    "Array string coercion accepts a harmless local own join",
    String.raw`
export function benignArrayOwnJoin(): string {
  const value: any = [];
  value.join = function(this: any): string {
    return this.length === 0 ? "safe" : "other";
  };
  return "" + value;
}
`,
  );

  expectBenignCatalogPass(
    "Array string coercion accepts a harmless bound constant-return join",
    String.raw`
function benignBoundArrayJoin(): string {
  return "safe";
}
export function benignArrayBoundJoin(): string {
  const value: any = [];
  value.join = benignBoundArrayJoin.bind(null);
  return "" + value;
}
`,
  );

  expectBenignCatalogPass(
    "Array string coercion accepts a noncallable own join",
    String.raw`
export function benignArrayNoncallableJoin(): string {
  const value: any = [];
  value.join = 7;
  return "" + value;
}
`,
  );

  expectBenignCatalogPass(
    "lexically shadowed Object and String remain local values",
    String.raw`
export function benignShadowedIntrinsics(): number {
  const Object = {
    assign(target: { value: number }, patch: { value: number }) {
      target.value = patch.value;
      return target;
    },
  };
  const String = { prototype: { startsWith: false } };
  const local = { value: 0 };
  Object.assign(local, { value: 1 });
  String.prototype.startsWith = true;
  return local.value;
}
`,
  );

  expectBenignCatalogPass(
    "a fresh local constructor result is not tainted by the constructor binding name",
    String.raw`
function benignStripeConstruction(Stripe: any, key: string): any {
  let _stripe: any = null;
  _stripe = new Stripe(key, { apiVersion: "accepted" });
  return _stripe;
}
`,
  );

  expectBenignCatalogPass(
    "benign local array copies and shadowed Proxy/Promise helpers remain local",
    String.raw`
export function benignShadowedMetaobjects(): number {
  const Proxy = { revocable(target: any) { return { proxy: target }; } };
  const Promise = { resolve(value: any) { return { then(callback: any) { return callback(value); } }; } };
  const local = { value: [1, 2, 3].slice().length };
  Proxy.revocable(local).proxy.value += 1;
  Promise.resolve(local).then((value: any) => value).value += 1;
  return local.value;
}
`,
  );

  expectBenignCatalogPass(
    "strict equality does not invoke a local primitive-coercion hook",
    String.raw`
export function benignStrictEquality(): boolean {
  const local: any = { valueOf() { this.__proto__.polluted = true; return 0; } };
  return local === local;
}
`,
  );

  expectBenignCatalogPass(
    "ordinary bound invocation retains local argument alignment",
    String.raw`
function benignBoundAdd(left: number, right: number): number { return left + right; }
export function benignBoundInvocation(): number { return benignBoundAdd.bind(null, 2)(3); }
`,
  );

  expectBenignCatalogPass(
    "benign async primitive and ordinary-object returns remain accepted",
    String.raw`
export async function benignAsyncPrimitive(): Promise<number> { return 1; }
export async function benignAsyncObject(): Promise<{ safe: boolean }> { return { safe: true }; }
`,
  );

  expectBenignCatalogPass(
    "benign Error and RegExp stringification remains accepted",
    String.raw`
export function benignIntrinsicStringification(): string {
  const error: any = new EvalError();
  error.name = "SafeError";
  error.message = "safe";
  return "" + error + /safe/.toString();
}
`,
  );

  expectBenignCatalogPass(
    "benign process environment reads retain string-or-undefined scalar provenance",
    String.raw`
export function benignEnvironmentRead(): number {
  const value = process.env.CV_BENIGN_TEST_VALUE || "";
  return value.length;
}
`,
  );

  expectBenignCatalogPass(
    "new Object(null) remains an ordinary local object",
    String.raw`
export function benignNullObject(): number {
  const value: any = new Object(null);
  value.safe = 1;
  return value.safe;
}
`,
  );

  const currentCatalogSource = readFileSync(join(sourceRoot, "lib/stripe.ts"), "utf8");
  check(
    "the exact production source exercises Stripe construction and local MRR arithmetic",
    currentCatalogSource.includes("_stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });") &&
      currentCatalogSource.includes("total += per / n;") &&
      currentCatalogSource.includes("counter") === false,
  );
  const currentCatalogRun = runVerifier(createFixture(currentCatalogSource));
  check(
    "the exact current production catalog and resolver source remains accepted",
    currentCatalogRun.status === 2 &&
      currentCatalogRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE") &&
      currentCatalogRun.output.includes("catalog ↔ planForPrice mapping is consistent") &&
      currentCatalogRun.output.includes("unknown price fails closed"),
  );

  const zeroRun = runVerifier(createFixture(catalog([])));
  check(
    "a located zero-entry catalog fails closed and cannot emit the mapping pass",
    zeroRun.status === 1 && zeroRun.output.includes("0 catalog entries parsed; expected exactly 7") &&
      !zeroRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const partialRun = runVerifier(createFixture(catalog(ENTRIES.slice(0, 6))));
  check(
    "a partial six-entry parse fails the exact-count contract",
    partialRun.status === 1 && partialRun.output.includes("6 catalog entries parsed; expected exactly 7"),
  );

  const swappedPremiumAmounts = ENTRIES.map((entry, index) => {
    if (index === 0) return entry.replace("amountCents: PREMIUM_PRICE_CENTS", "amountCents: 99000");
    if (index === 1) return entry.replace("amountCents: 99000", "amountCents: PREMIUM_PRICE_CENTS");
    return entry;
  });
  const swappedPremiumAmountsRun = runVerifier(createFixture(catalog(swappedPremiumAmounts)));
  check(
    "premium monthly and yearly amounts cannot be swapped while preserving the broad tier mapping",
    swappedPremiumAmountsRun.status === 1 &&
      swappedPremiumAmountsRun.output.includes("✗ FAIL                                 stripe catalog exact entry tuples"),
  );

  const swappedAgencyProIntervals = ENTRIES.map((entry, index) => {
    if (index === 4) return entry.replace('interval: "month"', 'interval: "year"');
    if (index === 5) return entry.replace('interval: "year"', 'interval: "month"');
    return entry;
  });
  const swappedAgencyProIntervalsRun = runVerifier(createFixture(catalog(swappedAgencyProIntervals)));
  check(
    "agency-pro lookup keys remain bound to their exact monthly and yearly intervals",
    swappedAgencyProIntervalsRun.status === 1 &&
      swappedAgencyProIntervalsRun.output.includes("✗ FAIL                                 stripe catalog exact entry tuples"),
  );

  const oneCentLetterPack = ENTRIES.map((entry, index) => index === 6
    ? entry.replace("amountCents: LETTER_PACK_PRICE_CENTS", "amountCents: 1")
    : entry);
  const oneCentLetterPackRun = runVerifier(createFixture(catalog(oneCentLetterPack)));
  check(
    "the one-time letter lookup cannot drift to a one-cent amount",
    oneCentLetterPackRun.status === 1 &&
      oneCentLetterPackRun.output.includes("✗ FAIL                                 stripe catalog exact entry tuples"),
  );

  const spreadEntries = ENTRIES.map((entry, index) => index === 0
    ? entry.replace('interval: "month" }', 'interval: "month", ...{ lookup: "unexpected_paid_surface" } }')
    : entry);
  const spreadRun = runVerifier(createFixture(catalog(spreadEntries)));
  check(
    "a spread override cannot make the runtime catalog differ from parsed evidence",
    spreadRun.status === 1 && spreadRun.output.includes("unsupported catalog field syntax in premium_month"),
  );

  const computedEntries = ENTRIES.map((entry, index) => index === 0
    ? entry.replace('interval: "month" }', 'interval: "month", ["lookup"]: "unexpected_paid_surface" }')
    : entry);
  const computedRun = runVerifier(createFixture(catalog(computedEntries)));
  check(
    "a computed catalog property is rejected instead of silently ignored",
    computedRun.status === 1 && computedRun.output.includes("unsupported catalog field syntax in premium_month"),
  );

  const shorthandEntries = ENTRIES.map((entry, index) => index === 0
    ? entry.replace('interval: "month" }', 'interval: "month", unexpectedCatalogField }')
    : entry);
  const shorthandRun = runVerifier(createFixture(catalog(shorthandEntries)));
  check(
    "a shorthand catalog property is rejected instead of silently ignored",
    shorthandRun.status === 1 && shorthandRun.output.includes("unsupported catalog field syntax in premium_month"),
  );

  const postDeclarationMutationRun = runVerifier(createFixture(
    `${catalog()}\nPRICES.premium_month.lookup = "unexpected_paid_surface";\n`,
  ));
  check(
    "an executable PRICES mutation after the parsed declaration fails closed",
    postDeclarationMutationRun.status === 1 &&
      postDeclarationMutationRun.output.includes("executable PRICES reference outside the one accepted read"),
  );

  const templateExpressionMutationRun = runVerifier(createFixture(
    `${catalog()}\n\`\${(PRICES.premium_month.lookup = "unexpected_paid_surface")}\`;\n`,
  ));
  check(
    "an executable PRICES mutation inside a template expression is not masked as inert string text",
    templateExpressionMutationRun.status === 1 &&
      templateExpressionMutationRun.output.includes("executable PRICES reference outside the one accepted read"),
  );

  const unicodeEscapedMutationRun = runVerifier(createFixture(
    catalog() + "\n" + String.raw`PR\u0049CES.premium_month.lookup = "unexpected_paid_surface";` + "\n",
  ));
  check(
    "a Unicode-escaped PRICES identifier is decoded and rejected by the compiler AST",
    unicodeEscapedMutationRun.status === 1 &&
      unicodeEscapedMutationRun.output.includes("executable PRICES reference outside the one accepted read"),
  );

  const nonMutatingPricesAliasRun = runVerifier(createFixture(
    catalog() + "\nconst priceCatalogAlias = PRICES;\nvoid priceCatalogAlias;\n",
  ));
  check(
    "even a non-mutating extra PRICES reference fails the exact decoded-identifier set",
    nonMutatingPricesAliasRun.status === 1 &&
      nonMutatingPricesAliasRun.output.includes("executable PRICES reference outside the one accepted read"),
  );

  const ambientPricesRun = runVerifier(createFixture(
    catalog().replace("export const PRICES", "export declare const PRICES"),
  ));
  check(
    "an ambient PRICES declaration cannot masquerade as a runtime catalog",
    ambientPricesRun.status === 1 &&
      ambientPricesRun.output.includes("PRICES must be one top-level exported const object declaration"),
  );

  const ambientResolverRun = runVerifier(createFixture(
    catalog().replace("export async function resolvePrice", "export declare async function resolvePrice"),
  ));
  check(
    "an ambient resolvePrice declaration cannot satisfy the runtime resolver shape",
    ambientResolverRun.status === 1 &&
      ambientResolverRun.output.includes("resolvePrice must retain its top-level exported async"),
  );

  const asyncGeneratorResolverRun = runVerifier(createFixture(
    catalog().replace("export async function resolvePrice", "export async function* resolvePrice"),
  ));
  check(
    "an async generator cannot masquerade as the canonical resolvePrice call shape",
    asyncGeneratorResolverRun.status === 1 &&
      asyncGeneratorResolverRun.output.includes("resolvePrice must retain its top-level exported async"),
  );

  const predeclaredMutation = String.raw`
function mutateCatalogAfterDeclaration() {
  PRICES.premium_month.lookup = "unexpected_paid_surface";
}
`;
  const predeclaredMutationRun = runVerifier(createFixture(
    `${predeclaredMutation}\n${catalog()}\nmutateCatalogAfterDeclaration();\n`,
  ));
  check(
    "a mutation function declared before PRICES cannot hide executable catalog mutation",
    predeclaredMutationRun.status === 1 &&
      predeclaredMutationRun.output.includes("executable PRICES reference outside the one accepted read"),
  );

  const missingCanonicalReadResolver = RESOLVE_PRICE.replace(
    "  const def = PRICES[key];",
    "  const def = null;",
  );
  const missingCanonicalReadRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, missingCanonicalReadResolver)));
  check(
    "the runtime catalog must retain exactly one canonical keyed resolver read",
    missingCanonicalReadRun.status === 1 &&
      missingCanonicalReadRun.output.includes("exactly one canonical executable PRICES read"),
  );

  const ambientDefResolver = RESOLVE_PRICE.replace(
    "  const def = PRICES[key];",
    "  declare const def: any = PRICES[key];",
  );
  const ambientDefRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, ambientDefResolver)));
  check(
    "an erased ambient def declaration cannot satisfy the canonical runtime binding",
    ambientDefRun.status === 1 &&
      ambientDefRun.output.includes("exactly one canonical executable PRICES read"),
  );

  const typeOnlyDefResolver = RESOLVE_PRICE.replace(
    "  const existing = await stripe.prices.list",
    `  type LookupOne = typeof def.lookup;
  type LookupTwo = typeof def.lookup;
  type Product = typeof def.product;
  type Amount = typeof def.amountCents;
  type IntervalOne = typeof def.interval;
  type IntervalTwo = typeof def.interval;
  const existing = await stripe.prices.list`,
  );
  const typeOnlyDefRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, typeOnlyDefResolver)));
  check(
    "erased type queries cannot satisfy the accepted runtime def-read counts",
    typeOnlyDefRun.status === 1 &&
      typeOnlyDefRun.output.includes("def property reads must be runtime value expressions"),
  );

  const shadowedKeyResolver = RESOLVE_PRICE.replace(
    "  const def = PRICES[key];",
    '  function key() { return "premium_month"; }\n  const def = PRICES[key];',
  );
  const shadowedKeyRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, shadowedKeyResolver)));
  check(
    "a function declaration cannot shadow the resolvePrice key parameter",
    shadowedKeyRun.status === 1 && shadowedKeyRun.output.includes("resolvePrice key parameter must not be shadowed"),
  );

  const reassignedKeyResolver = RESOLVE_PRICE.replace(
    "  const def = PRICES[key];",
    '  key = "premium_month";\n  const def = PRICES[key];',
  );
  const reassignedKeyRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, reassignedKeyResolver)));
  check(
    "resolvePrice cannot rewrite the caller-selected key before the canonical catalog read",
    reassignedKeyRun.status === 1 &&
      reassignedKeyRun.output.includes("resolvePrice key parameter has an unaccepted runtime use"),
  );

  const earlyPaidReturnResolver = RESOLVE_PRICE.replace(
    "  const def = PRICES[key];",
    '  if (key === "evil") return "known_paid_price_id";\n  const def = PRICES[key];',
  );
  const earlyPaidReturnRun = runVerifier(createFixture(catalog(
    ENTRIES,
    PLAN,
    CONSTANTS,
    earlyPaidReturnResolver,
  )));
  check(
    "an unknown key cannot bypass the catalog with an inserted early paid-price return",
    earlyPaidReturnRun.status === 1 &&
      earlyPaidReturnRun.output.includes("resolvePrice body differs from the exact accepted AST statement/control-flow shape"),
  );

  const sideEffectGuardResolver = RESOLVE_PRICE.replace(
    'if (!def) throw new Error("Unknown price key");',
    "if (!def) throw ((String.prototype as any).startsWith = () => true);",
  );
  const sideEffectGuardRun = runVerifier(createFixture(catalog(
    ENTRIES,
    PLAN,
    CONSTANTS,
    sideEffectGuardResolver,
  )));
  check(
    "the unknown-key guard cannot execute an intrinsic mutation before throwing",
    sideEffectGuardRun.status === 1 &&
      sideEffectGuardRun.output.includes("resolvePrice def guard must throw only the canonical Error") &&
      !sideEffectGuardRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const shadowedErrorRun = runVerifier(createFixture(
    catalog() + '\nfunction Error(_message: string) { (String.prototype as any).startsWith = () => true; }\n',
  ));
  check(
    "a lexical Error binding cannot replace the intrinsic used by the unknown-key guard",
    shadowedErrorRun.status === 1 &&
      shadowedErrorRun.output.includes("resolvePrice def guard must use the unshadowed intrinsic Error constructor") &&
      !shadowedErrorRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const wrongProductResolver = RESOLVE_PRODUCT.replace(
    "  return created.id;",
    '  return "prod_unexpected";',
  );
  const wrongProductResolverRun = runVerifier(createFixture(catalog(
    ENTRIES,
    PLAN,
    CONSTANTS,
    RESOLVE_PRICE,
    wrongProductResolver,
  )));
  check(
    "resolvePrice cannot call a text-matched but semantically replaced resolveProduct dependency",
    wrongProductResolverRun.status === 1 &&
      wrongProductResolverRun.output.includes("resolveProduct body differs from the exact accepted runtime AST contract") &&
      !wrongProductResolverRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const wrongProducts = PRODUCTS.replace(
    'name: "CreditVector — Professional"',
    'name: "CreditVector — Wrong Product"',
  );
  const wrongProductsRun = runVerifier(createFixture(catalog(
    ENTRIES,
    PLAN,
    CONSTANTS,
    RESOLVE_PRICE,
    RESOLVE_PRODUCT,
    wrongProducts,
  )));
  check(
    "resolveProduct cannot consume a semantically replaced PRODUCTS catalog",
    wrongProductsRun.status === 1 &&
      wrongProductsRun.output.includes("PRODUCTS body differs from the exact accepted runtime AST contract") &&
      !wrongProductsRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const aliasMutatingReconcile = String.raw`
export async function reconcileTaxCodes(stripe: any) {
  void stripe;
  const defs = Object.values(PRODUCTS);
  defs[0].name = "unexpected";
  const key = "premium";
  void PRODUCTS[key];
  return [];
}
`;
  const aliasMutatingReconcileRun = runVerifier(createFixture(
    `${catalog()}\n${aliasMutatingReconcile}\n`,
  ));
  check(
    "reconciliation cannot alias and mutate PRODUCTS while preserving accepted read counts",
    aliasMutatingReconcileRun.status === 1 &&
      aliasMutatingReconcileRun.output.includes("reconcileTaxCodes body differs from the exact accepted runtime AST contract") &&
      !aliasMutatingReconcileRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const overriddenResolverRun = runVerifier(createFixture(
    catalog() + '\n(resolvePrice as any) = async (_stripe: any, _key: string) => "unexpected_paid_price_id";\n',
  ));
  check(
    "the exported resolvePrice live binding cannot be replaced after its canonical declaration",
    overriddenResolverRun.status === 1 &&
      overriddenResolverRun.output.includes("resolvePrice must retain its exact exported binding identity and accepted direct callers"),
  );

  const canonicalResolveWrappers = [
    "export async function resolvePriceId(stripe: any, plan: any, interval: any = \"month\") {",
    "  return resolvePrice(stripe, `${plan}_${interval}`);",
    "}",
    "export async function resolvePremiumPriceId(stripe: any) {",
    '  return resolvePrice(stripe, "premium_month");',
    "}",
    "export async function resolveAgencyPriceId(stripe: any) {",
    '  return resolvePrice(stripe, "agency_month");',
    "}",
  ].join("\n");
  const canonicalResolveWrappersRun = runVerifier(createFixture(
    `${catalog()}\n${canonicalResolveWrappers}\n`,
  ));
  check(
    "the exact three exported async resolvePrice wrappers remain accepted",
    canonicalResolveWrappersRun.status === 2 &&
      canonicalResolveWrappersRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE") &&
      canonicalResolveWrappersRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const generatorResolveWrapperRun = runVerifier(createFixture(
    `${catalog()}\n${canonicalResolveWrappers.replace(
      "export async function resolvePremiumPriceId",
      "export async function* resolvePremiumPriceId",
    )}\n`,
  ));
  check(
    "a generator cannot masquerade as an accepted resolvePrice wrapper",
    generatorResolveWrapperRun.status === 1 &&
      generatorResolveWrapperRun.output.includes("resolvePrice must retain its exact exported binding identity and accepted direct callers"),
  );

  const computedFunctionResolver = RESOLVE_PRICE.replace(
    "  const def = PRICES[key];",
    '  key = (globalThis as any)["Fun" + "ction"](\'return "premium_month"\')();\n  const def = PRICES[key];',
  );
  const computedFunctionRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, computedFunctionResolver)));
  check(
    "computed global Function construction is rejected structurally before it can rewrite key",
    computedFunctionRun.status === 1 &&
      computedFunctionRun.output.includes("dynamic evaluation through a global or computed runtime capability is not allowed"),
  );

  const aliasResolver = RESOLVE_PRICE.replace(
    "  const existing = await stripe.prices.list",
    '  const catalogAlias = def;\n  catalogAlias.lookup = "unexpected_paid_surface";\n  const existing = await stripe.prices.list',
  );
  const aliasMutationRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, aliasResolver)));
  check(
    "resolvePrice cannot alias the accepted def binding and mutate through that alias",
    aliasMutationRun.status === 1 &&
      aliasMutationRun.output.includes("resolvePrice def binding may not escape, alias, be passed, returned"),
  );

  const unicodeDefAliasResolver = RESOLVE_PRICE.replace(
    "  const existing = await stripe.prices.list",
    String.raw`  const escapedAlias = d\u0065f;` + "\n  void escapedAlias;\n  const existing = await stripe.prices.list",
  );
  const unicodeDefAliasRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, unicodeDefAliasResolver)));
  check(
    "a Unicode-escaped def identifier cannot bypass the binding escape rule",
    unicodeDefAliasRun.status === 1 &&
      unicodeDefAliasRun.output.includes("resolvePrice def binding may not escape, alias, be passed, returned"),
  );

  const returnedDefResolver = RESOLVE_PRICE.replace(
    "  const existing = await stripe.prices.list",
    '  if (key === "escape") return def;\n  const existing = await stripe.prices.list',
  );
  const returnedDefRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, returnedDefResolver)));
  check(
    "resolvePrice cannot return and expose the accepted def binding",
    returnedDefRun.status === 1 &&
      returnedDefRun.output.includes("resolvePrice def binding may not escape, alias, be passed, returned"),
  );

  const nestedDefResolver = RESOLVE_PRICE
    .replace(
      "  const existing = await stripe.prices.list",
      "  const nestedResolver = async () => {\n    const existing = await stripe.prices.list",
    )
    .replace(
      "  return price.id;\n}",
      "    return price.id;\n  };\n  return nestedResolver();\n}",
    );
  const nestedDefRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, nestedDefResolver)));
  check(
    "the accepted def binding cannot escape into a closure even when read counts stay exact",
    nestedDefRun.status === 1 &&
      nestedDefRun.output.includes("resolvePrice def binding may not escape into a nested function or closure"),
  );

  const computedDefMutationResolver = RESOLVE_PRICE.replace(
    "  const existing = await stripe.prices.list",
    '  def["lookup"] = "unexpected_paid_surface";\n  const existing = await stripe.prices.list',
  );
  const computedDefMutationRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, computedDefMutationResolver)));
  check(
    "a computed assignment through def is an AST mutation target",
    computedDefMutationRun.status === 1 &&
      computedDefMutationRun.output.includes("executable catalog mutation through the accepted PRICES read"),
  );

  const objectAssignResolver = RESOLVE_PRICE.replace(
    "  const existing = await stripe.prices.list",
    '  Object.assign(def, { lookup: "unexpected_paid_surface" });\n  const existing = await stripe.prices.list',
  );
  const objectAssignRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, objectAssignResolver)));
  check(
    "Object.assign cannot receive and mutate the accepted def binding",
    objectAssignRun.status === 1 &&
      objectAssignRun.output.includes("resolvePrice def binding may not escape, alias, be passed, returned"),
  );

  const reflectSetResolver = RESOLVE_PRICE.replace(
    "  const existing = await stripe.prices.list",
    '  Reflect.set(def, "lookup", "unexpected_paid_surface");\n  const existing = await stripe.prices.list',
  );
  const reflectSetRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS, reflectSetResolver)));
  check(
    "Reflect.set cannot receive and mutate the accepted def binding",
    reflectSetRun.status === 1 &&
      reflectSetRun.output.includes(PROTECTED_MUTATION_DIAGNOSTIC),
  );

  const originalIntrinsicExploitRun = expectProtectedMutationFailure(
    "A · an admitted function cannot poison String.prototype.startsWith",
    String.raw`
function poisonPlanMappingIntrinsic(): void {
  (String.prototype as any).startsWith = () => true;
}
export function triggerOriginalPoison(): void {
  poisonPlanMappingIntrinsic();
}
`,
  );
  const isolatedExploitOracle = spawnSync(
    process.execPath,
    [
      "-e",
      [
        'function planForPrice(price) { const lk = price?.lookup_key ?? ""; if (lk.startsWith("gcl_agency_pro")) return "agency_pro"; return null; }',
        'const unknown = { lookup_key: "unknown_lookup", unit_amount: 12345 };',
        'const before = planForPrice(unknown);',
        'String.prototype.startsWith = () => true;',
        'const after = planForPrice(unknown);',
        'process.stdout.write(JSON.stringify([before, after]));',
      ].join("\n"),
    ],
    { encoding: "utf8" },
  );
  check(
    "A · the original exploit oracle is isolated and the verifier now blocks its null-to-agency_pro transition",
    originalIntrinsicExploitRun.status === 1 &&
      isolatedExploitOracle.status === 0 &&
      isolatedExploitOracle.stdout === '[null,"agency_pro"]' &&
      "unknown_lookup".startsWith("gcl_agency_pro") === false,
  );

  expectProtectedMutationFailure(
    "B · protected provenance follows a helper parameter",
    String.raw`
function overwriteStartsWith(target: any): void {
  target.startsWith = () => true;
}
export function triggerHelperPoison(): void {
  overwriteStartsWith(String.prototype);
}
`,
  );

  expectProtectedMutationFailure(
    "C · protected provenance follows a callback parameter",
    String.raw`
export function triggerCallbackPoison(): void {
  [String.prototype].forEach((target) => {
    target.startsWith = () => true;
  });
}
`,
  );

  expectProtectedMutationFailure(
    "D · __proto__ assignment on a protected intrinsic is rejected",
    String.raw`
export function triggerProtoPoison(): void {
  (String.prototype as any).__proto__ = { poisoned: true };
}
`,
  );

  expectProtectedMutationFailure(
    "D2 · primitive __proto__ recovery cannot launder String.prototype",
    String.raw`
export function triggerPrimitiveProtoPoison(): void {
  ("unknown" as any).__proto__.startsWith = () => true;
}
`,
  );

  expectProtectedMutationFailure(
    "E · Object.assign.call cannot launder the protected target",
    String.raw`
export function triggerAssignCallPoison(): void {
  Object.assign.call(null, String.prototype, { startsWith: () => true });
}
`,
  );

  expectProtectedMutationFailure(
    "F · destructured Object.assign retains mutator provenance",
    String.raw`
export function triggerDestructuredAssignPoison(): void {
  const { assign } = Object;
  assign(String.prototype, { startsWith: () => true });
}
`,
  );

  expectProtectedMutationFailure(
    "G1 · Node global.String.prototype is protected",
    String.raw`
export function triggerNodeGlobalPoison(): void {
  (global as any).String.prototype.startsWith = () => true;
}
`,
  );

  expectProtectedMutationFailure(
    "G2 · globalThis.String.prototype is protected",
    String.raw`
export function triggerGlobalThisPoison(): void {
  (globalThis as any).String.prototype.startsWith = () => true;
}
`,
  );

  expectProtectedMutationFailure(
    "H · a protected reference cannot be laundered through a local property",
    String.raw`
export function triggerPropertyStashPoison(): void {
  const stash = { target: String.prototype };
  stash.target.startsWith = () => true;
}
`,
  );

  expectProtectedMutationFailure(
    "I · a statically returned protected reference remains protected",
    String.raw`
function protectedStringPrototype(): any {
  return String.prototype;
}
export function triggerReturnedAliasPoison(): void {
  const target = protectedStringPrototype();
  target.startsWith = () => true;
}
`,
  );

  expectProtectedMutationFailure(
    "J · a nested function cannot hide intrinsic mutation",
    String.raw`
export function triggerNestedPoison(): void {
  function nestedPoison(): void {
    (String.prototype as any).startsWith = () => true;
  }
  nestedPoison();
}
`,
  );

  expectProtectedMutationFailure(
    "K · Object.defineProperty cannot mutate a protected target",
    String.raw`
export function triggerDefinePropertyPoison(): void {
  Object.defineProperty(String.prototype, "startsWith", {
    value: () => true,
    configurable: true,
  });
}
`,
  );

  expectProtectedMutationFailure(
    "L · Object.setPrototypeOf cannot mutate a protected target",
    String.raw`
export function triggerSetPrototypePoison(): void {
  Object.setPrototypeOf(String.prototype, { poisoned: true });
}
`,
  );

  expectProtectedMutationFailure(
    "M · Reflect.set cannot mutate a protected target",
    String.raw`
export function triggerReflectSetPoison(): void {
  Reflect.set(String.prototype, "startsWith", () => true);
}
`,
  );

  expectProtectedMutationFailure(
    "mutation adapters preserve protected provenance through apply and bind",
    String.raw`
export function triggerAdapterPoison(): void {
  Object.assign.apply(null, [String.prototype, { startsWith: () => true }]);
  const mutate = Object.assign.bind(null, String.prototype);
  mutate({ startsWith: () => true });
}
`,
  );

  expectProtectedMutationFailure(
    "destructured helper parameters and returned property boxes retain protected provenance",
    String.raw`
function mutateBox({ target }: any): void {
  target.startsWith = () => true;
}
function protectedBox(): any {
  return { target: String.prototype };
}
export function triggerBoxPoison(): void {
  mutateBox(protectedBox());
}
`,
  );

  expectProtectedMutationFailure(
    "ambient declarations cannot counterfeit a runtime shadow of an intrinsic",
    String.raw`
declare const String: any;
export function triggerAmbientSpoofPoison(): void {
  String.prototype.startsWith = () => true;
}
`,
  );

  const extendedLaunderingRegressions: Array<[string, string]> = [
    [
      "Reflect.apply preserves Object.assign mutation-primitive provenance",
      String.raw`export function poisonReflectApply(){Reflect.apply(Object.assign, undefined, [String.prototype, { startsWith: () => true }])}`,
    ],
    [
      "ordinary object methods named call are invoked as methods, not misclassified as adapters",
      String.raw`export function poisonCustomCall(){const h={call(t:any){t.startsWith=()=>true}};h.call(String.prototype)}`,
    ],
    [
      "ordinary object methods named apply are invoked as methods, not misclassified as adapters",
      String.raw`export function poisonCustomApply(){const h={apply(t:any){t.startsWith=()=>true}};h.apply(String.prototype)}`,
    ],
    [
      "ordinary object methods named bind are invoked as methods, not misclassified as adapters",
      String.raw`export function poisonCustomBind(){const h={bind(t:any){t.startsWith=()=>true;return()=>{}}};h.bind(String.prototype)()}`,
    ],
    [
      "an unresolved callable cannot receive a protected explicit this value",
      String.raw`export function poisonValueOf(){Object.prototype.valueOf.call(String.prototype).startsWith=()=>true}`,
    ],
    [
      "Array.pop return provenance remains protected",
      String.raw`export function poisonPop(){[String.prototype].pop()!.startsWith=()=>true}`,
    ],
    [
      "Array.map callback-return provenance remains protected",
      String.raw`export function poisonMapReturn(){[0].map(()=>String.prototype)[0].startsWith=()=>true}`,
    ],
    [
      "Array.find returns protected receiver-element provenance",
      String.raw`export function poisonFind(){[String.prototype].find(()=>true)!.startsWith=()=>true}`,
    ],
    [
      "Array.reduce callback-return provenance remains protected",
      String.raw`export function poisonReduce(){[String.prototype].reduce((a)=>a).startsWith=()=>true}`,
    ],
    [
      "new Array arguments remain recoverable through collection operations",
      String.raw`export function poisonNewArray(){new Array(String.prototype).pop().startsWith=()=>true}`,
    ],
    [
      "new Map entry values remain recoverable through get",
      String.raw`export function poisonNewMap(){new Map([["p",String.prototype]]).get("p").startsWith=()=>true}`,
    ],
    [
      "object-rest assignment retains protected stored-property provenance",
      String.raw`export function poisonRest(){let rest:any;({...rest}={target:String.prototype});rest.target.startsWith=()=>true}`,
    ],
    [
      "Object.defineProperties reloads descriptor value provenance",
      String.raw`export function poisonDefineProperties(){const box:any={};Object.defineProperties(box,{target:{value:String.prototype}});box.target.startsWith=()=>true}`,
    ],
    [
      "Object.fromEntries reloads entry value provenance",
      String.raw`export function poisonFromEntries(){const box:any=Object.fromEntries([["target",String.prototype]]);box.target.startsWith=()=>true}`,
    ],
    [
      "exported parameter provenance reaches a module slot",
      String.raw`let externalSlot:any;export function storeExternal(v:any){externalSlot=v}export function poisonExternal(){externalSlot.startsWith=()=>true}`,
    ],
    [
      "accessor declarations fail closed outside the admitted static grammar",
      String.raw`export function poisonGetter(){const h={get target(){return String.prototype}};h.target.startsWith=()=>true}`,
    ],
    [
      "tagged-template invocation fails closed outside the admitted static grammar",
      'function tag(_s:any,t:any){t.startsWith=()=>true}export function poisonTag(){tag`${String.prototype}`}',
    ],
    [
      "for-in mutation targets fail closed outside the admitted static grammar",
      String.raw`export function poisonForIn(){for((String.prototype as any).startsWith in {x:1}){}}`,
    ],
    [
      "class declarations fail closed outside the admitted static grammar",
      String.raw`export function poisonClassGetter(){class H{static get target(){return String.prototype}}H.target.startsWith=()=>true}`,
    ],
    [
      "generator yields fail closed outside the admitted static grammar",
      String.raw`function* gen(){yield String.prototype}export function poisonGenerator(){(gen().next().value as any).startsWith=()=>true}`,
    ],
    [
      "Proxy traps fail closed outside the admitted static grammar",
      String.raw`export function poisonProxyGet(){const h=new Proxy({},{get(){return String.prototype}});(h as any).target.startsWith=()=>true}`,
    ],
    [
      "Reflect.construct fails closed outside the admitted static grammar",
      String.raw`function ReturnTarget():any{return String.prototype}export function poisonReflectConstruct(){const t:any=Reflect.construct(ReturnTarget,[]);t.startsWith=()=>true}`,
    ],
    [
      "bound constructors preserve an explicit protected object return",
      String.raw`function ReturnBoundTarget():any{return String.prototype}export function poisonBoundConstructor(){const Bound=ReturnBoundTarget.bind(null);const target:any=new Bound();target.startsWith=()=>true}`,
    ],
    [
      "Proxy.revocable fails closed because trap semantics are outside the admitted grammar",
      String.raw`export function poisonRevocableProxy(){const target:any=Proxy.revocable({},{get(){return String.prototype}}).proxy.target;target.startsWith=()=>true}`,
    ],
    [
      "unmodeled local-container methods cannot erase protected receiver elements",
      String.raw`export function poisonSlice(){const target:any=[String.prototype].slice()[0];target.startsWith=()=>true}`,
    ],
    [
      "iterator-producing local-container methods cannot erase protected receiver elements",
      String.raw`export function poisonValuesIterator(){const target:any=[String.prototype].values().next().value;target.startsWith=()=>true}`,
    ],
    [
      "Promise callback results retain protected provenance through await",
      String.raw`export async function poisonPromiseThen(){const target:any=await Promise.resolve().then(()=>String.prototype);target.startsWith=()=>true}`,
    ],
    [
      "Promise combinators retain protected element provenance through await",
      String.raw`export async function poisonPromiseAll(){const target:any=(await Promise.all([String.prototype]))[0];target.startsWith=()=>true}`,
    ],
    [
      "await rejection transfers protected provenance into catch bindings",
      String.raw`export async function poisonPromiseReject(){try{await Promise.reject(String.prototype)}catch(target){(target as any).startsWith=()=>true}}`,
    ],
    [
      "explicit Promise construction fails closed outside the admitted provenance grammar",
      String.raw`export async function poisonPromiseConstructor(){const target:any=await new Promise((resolve)=>resolve(String.prototype));target.startsWith=()=>true}`,
    ],
    [
      "throw-to-catch transfer preserves protected provenance",
      String.raw`export function poisonCatch(){try{throw String.prototype}catch(target){(target as any).startsWith=()=>true}}`,
    ],
    [
      "helper throws preserve protected provenance at the caller catch binding",
      String.raw`function throwTarget():never{throw String.prototype}export function poisonHelperCatch(){try{throwTarget()}catch(target){(target as any).startsWith=()=>true}}`,
    ],
    [
      "Object.create descriptor values retain protected provenance",
      String.raw`export function poisonCreateDescriptor(){const box:any=Object.create(null,{target:{value:String.prototype}});box.target.startsWith=()=>true}`,
    ],
    [
      "property-descriptor getters fail closed outside the admitted provenance grammar",
      String.raw`export function poisonDescriptorGetter(){const box:any=Object.create(null),descriptor:any=Object.create(null);descriptor.get=()=>String.prototype;Object.defineProperty(box,"target",descriptor);box.target.startsWith=()=>true}`,
    ],
    [
      "property-descriptor setters fail closed outside the admitted provenance grammar",
      String.raw`export function poisonDescriptorSetter(){const box:any=Object.create(null),descriptor:any=Object.create(null);descriptor.set=(target:any)=>{target.startsWith=()=>true};Object.defineProperty(box,"target",descriptor);box.target=String.prototype}`,
    ],
    [
      "array callbacks receive the protected source-array argument",
      String.raw`export function poisonCallbackSource(){[String.prototype].forEach((_value,_index,source)=>(source[0] as any).startsWith=()=>true)}`,
    ],
    [
      "sort comparators receive both protected element arguments",
      String.raw`export function poisonSortRhs(){[String.prototype,String.prototype].sort((_left,right)=>{(right as any).startsWith=()=>true;return 0})}`,
    ],
    [
      "an own function property named call takes precedence over the intrinsic adapter",
      String.raw`export function poisonOwnCall(){function helper(){};(helper as any).call=(target:any)=>{target.startsWith=()=>true};(helper as any).call(String.prototype)}`,
    ],
    [
      "an inherited local call override takes precedence over the intrinsic adapter",
      String.raw`export function poisonInheritedCall(){function helper(){};const prototype:any=Object.create(Object.getPrototypeOf(helper));prototype.call=(target:any)=>{target.startsWith=()=>true};Object.setPrototypeOf(helper,prototype);(helper as any).call(String.prototype)}`,
    ],
    [
      "legacy setter-definition helpers fail closed outside the admitted provenance grammar",
      String.raw`export function poisonLegacySetter(){const box:any={};box.__defineSetter__("target",(target:any)=>{target.startsWith=()=>true});box.target=String.prototype}`,
    ],
    [
      "protected accessor descriptors cannot be recovered as untracked local values",
      String.raw`export function poisonRecoveredGetter(){const descriptor:any=Object.getOwnPropertyDescriptor(Object.prototype,"__proto__");const target:any=descriptor.get.call(new String("x"));target.startsWith=()=>true}`,
    ],
    [
      "boxed built-in allocations retain their shared runtime prototype",
      String.raw`export function poisonBoxedPrototype(){const target:any=Object.getPrototypeOf(new String("x"));target.startsWith=()=>true}`,
    ],
    [
      "Object.getPrototypeOf preserves primitive boxing provenance",
      String.raw`export function poisonPrimitivePrototype(){const target:any=Object.getPrototypeOf("x");target.startsWith=()=>true}`,
    ],
    [
      "local function objects retain their shared Function prototype",
      String.raw`export function poisonFunctionPrototype(){function helper(){};const target:any=Object.getPrototypeOf(helper);target.apply=()=>undefined}`,
    ],
    [
      "unmodeled intrinsic identity methods cannot erase a protected receiver",
      String.raw`export function poisonIntrinsicValueOf(){(Object.prototype.valueOf() as any).polluted=true}`,
    ],
    [
      "findLast returns protected receiver-element provenance",
      String.raw`export function poisonFindLast(){([String.prototype].findLast(()=>true) as any).startsWith=()=>true}`,
    ],
    [
      "Set iterator chains cannot erase protected element provenance",
      String.raw`export function poisonSetIterator(){(new Set([String.prototype]).values().next().value as any).startsWith=()=>true}`,
    ],
    [
      "aliased Proxy constructors remain binding-resolved and fail closed",
      String.raw`export function poisonAliasedProxy(){const ProxyAlias=Proxy;const box:any=new ProxyAlias({},{get(){return String.prototype}});box.target.startsWith=()=>true}`,
    ],
    [
      "WeakRef dereference cannot erase a protected target graph",
      String.raw`export function poisonWeakRef(){const box:any=new WeakRef({target:String.prototype}).deref();box.target.startsWith=()=>true}`,
    ],
    [
      "Object construction preserves an object argument's protected graph",
      String.raw`export function poisonObjectWrapper(){const box:any=new Object({target:String.prototype});box.target.startsWith=()=>true}`,
    ],
    [
      "Array.from mapper returns retain protected provenance",
      String.raw`export function poisonArrayFromMapper(){(Array.from([0],()=>String.prototype)[0] as any).startsWith=()=>true}`,
    ],
    [
      "Array.of arguments retain protected provenance",
      String.raw`export function poisonArrayOf(){(Array.of(String.prototype)[0] as any).startsWith=()=>true}`,
    ],
    [
      "an unresolved exported callback return remains possibly protected",
      String.raw`export function poisonExternalCallback(callback:any){callback().startsWith=()=>true}`,
    ],
    [
      "an unresolved exported constructor result remains possibly protected",
      String.raw`export function poisonExternalConstructor(Constructor:any){const target:any=new Constructor();target.startsWith=()=>true}`,
    ],
    [
      "arrow functions inherit the enclosing arguments provenance",
      String.raw`function carryArgument(target:any):any{const recover=()=>arguments[0];return recover()}export function poisonLexicalArguments(){carryArgument(String.prototype).startsWith=()=>true}`,
    ],
    [
      "call adapters propagate protected thrown values into catch bindings",
      String.raw`function throwViaCall(target:any):never{throw target}export function poisonCallCatch(){try{throwViaCall.call(null,String.prototype)}catch(target){(target as any).startsWith=()=>true}}`,
    ],
    [
      "apply adapters propagate protected thrown values into catch bindings",
      String.raw`function throwViaApply(target:any):never{throw target}export function poisonApplyCatch(){try{throwViaApply.apply(null,[String.prototype])}catch(target){(target as any).startsWith=()=>true}}`,
    ],
    [
      "bound adapters propagate protected thrown values into catch bindings",
      String.raw`function throwViaBind(target:any):never{throw target}export function poisonBindCatch(){const bound=throwViaBind.bind(null,String.prototype);try{bound()}catch(target){(target as any).startsWith=()=>true}}`,
    ],
    [
      "Reflect.apply propagates protected thrown values into catch bindings",
      String.raw`function throwViaReflect(target:any):never{throw target}export function poisonReflectCatch(){try{Reflect.apply(throwViaReflect,null,[String.prototype])}catch(target){(target as any).startsWith=()=>true}}`,
    ],
    [
      "Reflect.get cannot recover a computed Function capability from globalThis",
      String.raw`export function poisonReflectGlobalFunction(){const DynamicFunction:any=Reflect.get(globalThis,"Fun"+"ction");DynamicFunction("String.prototype.startsWith=()=>true")()}`,
    ],
    [
      "Reflect.get cannot recover computed process/module execution capabilities",
      String.raw`export function poisonReflectProcessVm(){const getModule:any=Reflect.get(process,"getBuiltin"+"Module");const vm=getModule("node:vm");const run:any=Reflect.get(vm,"run"+"InThisContext");run("String.prototype.startsWith=()=>true")}`,
    ],
    [
      "callbacks cannot escape to unresolved external registrars for protected invocation",
      String.raw`export function poisonExternalRegistrar(register:any){register((target:any)=>{target.startsWith=()=>true})}`,
    ],
    [
      "method-bearing objects cannot escape to unresolved external registrars",
      String.raw`export function poisonExternalObjectRegistrar(register:any){register({handle(target:any){target.startsWith=()=>true}})}`,
    ],
    [
      "bound callback adapters cannot escape to unresolved external registrars",
      String.raw`function mutateRegistered(target:any){target.startsWith=()=>true}export function poisonExternalBoundRegistrar(register:any){register(mutateRegistered.bind(null))}`,
    ],
    [
      "unresolved external calls taint reachable local argument heaps",
      String.raw`export function poisonExternalArgumentHeap(fill:any){const box:any=Object.create(null);fill(box);box.target.startsWith=()=>true}`,
    ],
    [
      "unresolved external calls taint nested local argument heaps",
      String.raw`export function poisonExternalNestedHeap(fill:any){const box:any=Object.create(null);fill({nested:box});box.target.startsWith=()=>true}`,
    ],
    [
      "unresolved external calls taint explicit this heaps",
      String.raw`export function poisonExternalThisHeap(fill:any){const box:any=Object.create(null);fill.call(box);box.target.startsWith=()=>true}`,
    ],
    [
      "exported callable this values remain possibly protected",
      String.raw`export function poisonExportedThis(){(this as any).startsWith=()=>true}`,
    ],
    [
      "exported TypeScript this parameters remain possibly protected",
      String.raw`export function poisonExportedThisParameter(this:any){this.startsWith=()=>true}`,
    ],
    [
      "callables returned across an export boundary receive protected inputs",
      String.raw`export function poisonReturnedCallback(){return (target:any)=>{target.startsWith=()=>true}}`,
    ],
    [
      "method graphs returned across an export boundary receive protected inputs",
      String.raw`export function poisonReturnedMethod(){return {handle(target:any){target.startsWith=()=>true}}}`,
    ],
    [
      "new.target retains local constructor Function-prototype provenance",
      String.raw`function ConstructorTarget(){const target:any=Object.getPrototypeOf(new.target);target.apply=()=>undefined}export function poisonNewTarget(){new ConstructorTarget()}`,
    ],
    [
      "named function-expression self bindings retain Function-prototype provenance",
      String.raw`export function poisonNamedFunctionExpression(){(function self(){const target:any=Object.getPrototypeOf(self);target.apply=()=>undefined})()}`,
    ],
    [
      "arguments objects retain their shared Object prototype",
      String.raw`export function poisonArgumentsPrototype(){const target:any=Object.getPrototypeOf(arguments);target.polluted=true}`,
    ],
    [
      "runtime enum objects fail closed outside the admitted provenance grammar",
      String.raw`export function poisonRuntimeEnum(){enum RuntimeEnum{Value};const target:any=Object.getPrototypeOf(RuntimeEnum);target.polluted=true}`,
    ],
    [
      "local constructor instances retain the constructor prototype chain",
      String.raw`function LocalConstructor(){}export function poisonLocalConstructorChain(){const target:any=Object.getPrototypeOf(Object.getPrototypeOf(new LocalConstructor()));target.polluted=true}`,
    ],
    [
      "anonymous default exports receive protected external parameters",
      String.raw`export default function(target:any){target.startsWith=()=>true}`,
    ],
    [
      "protected runtime capability objects cannot be object-spread",
      String.raw`export function poisonSpreadProcess(){const copy:any={...process};copy.getBuiltinModule("node:vm")}`,
    ],
    [
      "protected runtime capability objects cannot be enumerated",
      String.raw`export function poisonEnumeratedProcess(){const load:any=Object.values(process).find((value:any)=>value?.name==="getBuiltinModule");load("node:vm")}`,
    ],
    [
      "unresolved host constructors retain shared prototype provenance",
      String.raw`export function poisonUnknownGlobalConstructor(){const target:any=Object.getPrototypeOf(new URL("https://example.invalid"));target.toString=()=>"poisoned"}`,
    ],
    [
      "unresolved host static factories retain shared prototype provenance",
      String.raw`export function poisonUnknownGlobalFactory(){const target:any=Object.getPrototypeOf(Buffer.from("safe"));target.toString=()=>"poisoned"}`,
    ],
    [
      "caller-controlled call results cannot be relayed to caller-controlled mutators",
      String.raw`export function poisonTwoCallLaundering(get:any,mutate:any){mutate(get())}`,
    ],
    [
      "implicit built-in exceptions retain shared error-prototype provenance",
      String.raw`export function poisonImplicitException(){try{Object.getPrototypeOf(null)}catch(error){const target:any=Object.getPrototypeOf(error);target.polluted=true}}`,
    ],
    [
      "exceptions from external getters remain possibly protected",
      String.raw`export function poisonExternalGetterException(source:any){try{void source.target}catch(target){(target as any).startsWith=()=>true}}`,
    ],
    [
      "string concatenation retains boxed String-prototype provenance",
      String.raw`export function poisonConcatenatedStringPrototype(){const target:any=Object.getPrototypeOf("sa"+"fe");target.startsWith=()=>true}`,
    ],
    [
      "comparison results retain boxed Boolean-prototype provenance",
      String.raw`export function poisonComparisonPrototype(){const target:any=Object.getPrototypeOf(1<2);target.valueOf=()=>true}`,
    ],
    [
      "numeric expression results retain boxed Number-prototype provenance",
      String.raw`export function poisonNumericExpressionPrototype(){const target:any=Object.getPrototypeOf(6/2);target.valueOf=()=>0}`,
    ],
    [
      "template results retain boxed String-prototype provenance",
      String.raw`export function poisonTemplatePrototype(){const target:any=Object.getPrototypeOf(` + "`safe-${1}`" + `);target.startsWith=()=>true}`,
    ],
    [
      "typeof results retain boxed String-prototype provenance",
      String.raw`export function poisonTypeofPrototype(){const target:any=Object.getPrototypeOf(typeof process);target.startsWith=()=>true}`,
    ],
    [
      "delete results retain boxed Boolean-prototype provenance",
      String.raw`export function poisonDeleteResultPrototype(){const box:any={x:1};const target:any=Object.getPrototypeOf(delete box.x);target.valueOf=()=>true}`,
    ],
    [
      "computed synchronous iterator methods fail closed",
      String.raw`export function poisonComputedIterator(){const iterable:any={[Symbol.iterator](){return {next(){return {value:String.prototype,done:false}}}}};for(const target of iterable){(target as any).startsWith=()=>true;break}}`,
    ],
    [
      "computed asynchronous iterator methods fail closed",
      String.raw`export async function poisonComputedAsyncIterator(){const iterable:any={[Symbol.asyncIterator](){return {async next(){return {value:String.prototype,done:false}}}}};for await(const target of iterable){(target as any).startsWith=()=>true;break}}`,
    ],
    [
      "descriptor-defined custom iterators cannot enter for-of",
      String.raw`export function poisonDescriptorIterator(){const iterable:any={};Object.defineProperty(iterable,Symbol.iterator,{value(){return {next(){return {value:String.prototype,done:false}}}}});for(const target of iterable){(target as any).startsWith=()=>true;break}}`,
    ],
    [
      "descriptor-defined custom iterators cannot enter array spread",
      String.raw`export function poisonIteratorSpread(){const iterable:any={};Object.defineProperty(iterable,Symbol.iterator,{value(){return {next(){return {value:String.prototype,done:true}}}}});const target:any=[...iterable][0];target.startsWith=()=>true}`,
    ],
    [
      "descriptor-defined custom iterators cannot enter Array.from",
      String.raw`export function poisonIteratorArrayFrom(){const iterable:any={};Object.defineProperty(iterable,Symbol.iterator,{value(){return {next(){return {value:String.prototype,done:true}}}}});const target:any=Array.from(iterable)[0];target.startsWith=()=>true}`,
    ],
    [
      "descriptor-defined custom iterators cannot enter Object.fromEntries",
      String.raw`export function poisonIteratorFromEntries(){const iterable:any={};Object.defineProperty(iterable,Symbol.iterator,{value(){return {next(){return {value:["target",String.prototype],done:true}}}}});const target:any=Object.fromEntries(iterable).target;target.startsWith=()=>true}`,
    ],
    [
      "custom Symbol.hasInstance protocols fail closed",
      String.raw`export function poisonHasInstance(){const handler:any={[Symbol.hasInstance](target:any){target.startsWith=()=>true;return false}};void(String.prototype instanceof handler)}`,
    ],
    [
      "descriptor-defined Symbol.hasInstance protocols fail closed",
      String.raw`export function poisonDescriptorHasInstance(){const handler:any={};Object.defineProperty(handler,Symbol.hasInstance,{value(target:any){target.startsWith=()=>true;return false}});void(String.prototype instanceof handler)}`,
    ],
    [
      "custom Symbol.toPrimitive protocols fail closed",
      String.raw`export function poisonToPrimitive(){const handler:any={[Symbol.toPrimitive](hint:any){hint.__proto__.startsWith=()=>true;return 0}};void +handler}`,
    ],
    [
      "descriptor-defined Symbol.toPrimitive protocols fail closed",
      String.raw`export function poisonDescriptorToPrimitive(){const handler:any={};Object.defineProperty(handler,Symbol.toPrimitive,{value(hint:any){hint.__proto__.startsWith=()=>true;return 0}});void +handler}`,
    ],
    [
      "exported variables cannot expose an intrinsic prototype",
      String.raw`export const leakedPrototype:any=String.prototype`,
    ],
    [
      "exported variable object graphs cannot expose an intrinsic prototype",
      String.raw`export const leakedBox:any={target:String.prototype}`,
    ],
    [
      "exported functions cannot return an intrinsic prototype",
      String.raw`export function leakPrototype(){return String.prototype}`,
    ],
    [
      "exported functions cannot return object graphs containing an intrinsic prototype",
      String.raw`export function leakPrototypeBox(){return {target:String.prototype}}`,
    ],
    [
      "flatMap flattens one callback-result layer without losing protected provenance",
      String.raw`export function poisonFlatMap(){const target:any=[0].flatMap(()=>[String.prototype])[0];target.startsWith=()=>true}`,
    ],
    [
      "bound callable objects retain Function-prototype provenance",
      String.raw`function localBoundTarget(){}export function poisonBoundFunctionPrototype(){const bound:any=localBoundTarget.bind(null);const target:any=Object.getPrototypeOf(bound);target.apply=()=>undefined}`,
    ],
    [
      "bound callable __proto__ reads retain Function-prototype provenance",
      String.raw`function localBoundProtoTarget(){}export function poisonBoundFunctionProtoRead(){const bound:any=localBoundProtoTarget.bind(null);bound.__proto__.apply=()=>undefined}`,
    ],
    [
      "WeakRef wrappers retain their own shared prototype",
      String.raw`export function poisonWeakRefWrapperPrototype(){const target:any=Object.getPrototypeOf(new WeakRef(Object.create(null)));target.deref=()=>undefined}`,
    ],
    [
      "TypeScript this pseudo-parameters do not consume runtime arguments",
      String.raw`function mutateAfterThis(this:any,target:any){target.startsWith=()=>true}export function poisonThisArgumentAlignment(){mutateAfterThis.call({},String.prototype)}`,
    ],
    [
      "unresolved external constructors exercise callable arguments",
      String.raw`export function poisonExternalConstructorCallback(Constructor:any){new Constructor((target:any)=>{target.startsWith=()=>true})}`,
    ],
    [
      "unresolved external constructors taint reachable argument heaps",
      String.raw`export function poisonExternalConstructorHeap(Constructor:any){const box:any=Object.create(null);new Constructor(box);box.target.startsWith=()=>true}`,
    ],
    [
      "returned explicit prototype method graphs receive protected inputs",
      String.raw`export function poisonReturnedPrototypeMethod(){const prototype={mutate(target:any){target.startsWith=()=>true}};return Object.create(prototype)}`,
    ],
    [
      "thrown method graphs receive protected inputs at the export boundary",
      String.raw`export function poisonThrownMethodGraph(){throw {mutate(target:any){target.startsWith=()=>true}}}`,
    ],
    [
      "untrusted member calls cannot relay caller-controlled protected results",
      String.raw`export function poisonUntrustedMemberRelay(api:any){api.mutate(api.get())}`,
    ],
    [
      "unmodeled process methods cannot mutate shared process state",
      String.raw`export function poisonProcessState(){process.chdir("/")}`,
    ],
    [
      "returned writable heaps are tainted before later module re-entry",
      String.raw`const exposedHolder:any={target:null};export function exposeHolder(){return exposedHolder}export function mutateExposedHolder(){exposedHolder.target.startsWith=()=>true}`,
    ],
    [
      "array length retains boxed Number-prototype provenance",
      String.raw`export function poisonArrayLengthPrototype(){const target:any=Object.getPrototypeOf([1].length);target.valueOf=()=>0}`,
    ],
    [
      "string length retains boxed Number-prototype provenance",
      String.raw`export function poisonStringLengthPrototype(){const target:any=("safe".length as any).__proto__;target.valueOf=()=>0}`,
    ],
    [
      "string index reads retain boxed String-prototype provenance",
      String.raw`export function poisonStringIndexPrototype(){const target:any=("safe"[0] as any).__proto__;target.startsWith=()=>true}`,
    ],
    [
      "primitive string method results cannot erase shared provenance",
      String.raw`export function poisonStringSlicePrototype(){const target:any="safe".slice(0);target.__proto__.startsWith=()=>true}`,
    ],
    [
      "local valueOf methods are invoked for numeric coercion",
      String.raw`export function poisonValueOfCoercion(){const handler:any={valueOf(){this.__proto__.polluted=true;return 0}};void +handler}`,
    ],
    [
      "local then methods are invoked during await assimilation",
      String.raw`export async function poisonAwaitThenable(){const handler:any={then(resolve:any){resolve.__proto__.apply=()=>undefined;resolve()}};await handler}`,
    ],
    [
      "thenable resolution preserves protected resolved values",
      String.raw`export async function poisonAwaitResolvedValue(){const handler:any={then(resolve:any){resolve(String.prototype)}};const target:any=await handler;target.startsWith=()=>true}`,
    ],
    [
      "update expressions invoke local numeric-coercion methods",
      String.raw`export function poisonUpdateCoercion(){const handler:any={valueOf(){this.__proto__.polluted=true;return 0}};handler++}`,
    ],
    [
      "using declarations fail closed outside the admitted disposal grammar",
      String.raw`export function poisonDisposeProtocol(){const resource:any=Object.create(String.prototype);Object.defineProperty(resource,Symbol.dispose,{value(){this.__proto__.startsWith=()=>true}});using disposable=resource;void disposable}`,
    ],
    [
      "exported functions cannot throw an intrinsic prototype",
      String.raw`export function throwPrototype():never{throw String.prototype}`,
    ],
    [
      "anonymous default functions cannot return an intrinsic prototype",
      String.raw`export default function(){return String.prototype}`,
    ],
    [
      "plain assignment cannot invoke a caller-controlled inherited setter with a callback",
      String.raw`export function poisonInheritedSetter(prototype:any){const child:any=Object.create(prototype);child.slot=(target:any)=>{target.startsWith=()=>true}}`,
    ],
    [
      "Object.assign cannot invoke a caller-controlled inherited setter with a callback",
      String.raw`export function poisonInheritedAssignSetter(prototype:any){const child:any=Object.create(prototype);Object.assign(child,{slot:(target:any)=>{target.startsWith=()=>true}})}`,
    ],
    [
      "Array allocating methods reject an unresolved custom Symbol.species constructor",
      String.raw`function PoisonArraySpecies(this:any){this.__proto__.__proto__.polluted=true}export function poisonArraySpecies(){const values:any=[];Object.defineProperty(values,"constructor",{value:{[Symbol.species]:PoisonArraySpecies}});values.map(()=>0)}`,
    ],
    [
      "directly exported writable heaps are tainted before module re-entry",
      String.raw`export const exportedHolder:any={target:{}};export function poisonExportedHolder(){exportedHolder.target.startsWith=()=>true}`,
    ],
    [
      "inherited descriptor-defined iterators cannot enter array spread",
      String.raw`export function poisonInheritedIterator(){const prototype:any=Object.create(Array.prototype);Object.defineProperty(prototype,Symbol.iterator,{value(){return {next(){return {value:String.prototype,done:false}}}}});const values:any=[];Object.setPrototypeOf(values,prototype);const target:any=[...values][0];target.startsWith=()=>true}`,
    ],
    [
      "inherited descriptor-defined Symbol.hasInstance protocols fail closed",
      String.raw`export function poisonInheritedHasInstance(){const prototype:any={};Object.defineProperty(prototype,Symbol.hasInstance,{value(target:any){target.startsWith=()=>true;return false}});const handler:any=Object.create(prototype);void(String.prototype instanceof handler)}`,
    ],
    [
      "inherited descriptor-defined Symbol.toPrimitive protocols fail closed",
      String.raw`export function poisonInheritedToPrimitive(){const prototype:any={};Object.defineProperty(prototype,Symbol.toPrimitive,{value(){this.__proto__.polluted=true;return 0}});const handler:any=Object.create(prototype);void +handler}`,
    ],
    [
      "array destructuring rejects a descriptor-defined custom iterator",
      String.raw`export function poisonIteratorDestructuring(){const values:any=[];Object.defineProperty(values,Symbol.iterator,{value(){return {next(){return {value:String.prototype,done:false}}}}});const [target]:any=values;target.startsWith=()=>true}`,
    ],
    [
      "call argument spread rejects a descriptor-defined custom iterator",
      String.raw`function mutateSpread(target:any){target.startsWith=()=>true}export function poisonIteratorCallSpread(){const values:any=[];Object.defineProperty(values,Symbol.iterator,{value(){return {next(){return {value:String.prototype,done:false}}}}});mutateSpread(...values)}`,
    ],
    [
      "Map construction rejects a descriptor-defined custom iterator",
      String.raw`export function poisonIteratorMapConstruction(){const values:any=[];Object.defineProperty(values,Symbol.iterator,{value(){return {next(){return {value:["target",String.prototype],done:false}}}}});const target:any=new Map(values).get("target");target.startsWith=()=>true}`,
    ],
    [
      "Array.from.call rejects a caller-selected result constructor",
      String.raw`function PoisonFrom(this:any){this.__proto__.__proto__.polluted=true}export function poisonArrayFromReceiver(){Array.from.call(PoisonFrom,[1])}`,
    ],
    [
      "Array.of.call rejects a caller-selected result constructor",
      String.raw`function PoisonOf(this:any){this.__proto__.__proto__.polluted=true}export function poisonArrayOfReceiver(){Array.of.call(PoisonOf,1)}`,
    ],
    [
      "Promise.resolve.call rejects a caller-selected Promise constructor",
      String.raw`function PoisonPromise(this:any){this.__proto__.__proto__.polluted=true}export function poisonPromiseReceiver(){Promise.resolve.call(PoisonPromise,1)}`,
    ],
    [
      "Promise reactions reject an unresolved custom Symbol.species constructor",
      String.raw`function PoisonReaction(this:any){this.__proto__.__proto__.polluted=true}export function poisonPromiseSpecies(){const value:any=Promise.resolve(1);Object.defineProperty(value,"constructor",{value:{[Symbol.species]:PoisonReaction}});value.then(()=>1)}`,
    ],
    [
      "primitive method results retain boxed String-prototype provenance",
      String.raw`export function poisonPrimitiveMethodResult(){const target:any=(1).toString().__proto__;target.startsWith=()=>true}`,
    ],
    [
      "instances of exported constructors treat their writable prototype as externally effectful",
      String.raw`export function ExportedConstructor(){}export function poisonExportedConstructorPrototype(){const child:any=new ExportedConstructor();child.slot=(target:any)=>{target.startsWith=()=>true}}`,
    ],
    [
      "Object.assign rejects caller-controlled enumerable accessor sources",
      String.raw`export function poisonAssignSource(source:any){Object.assign({},source)}`,
    ],
    [
      "property reads reject caller-controlled inherited getters",
      String.raw`export function poisonInheritedGetter(prototype:any){const child:any=Object.create(prototype);void child.trigger}`,
    ],
    [
      "borrowed Array methods retain custom species validation",
      String.raw`function PoisonBorrowedArray(this:any){this.__proto__.__proto__.polluted=true}export function poisonBorrowedArraySpecies(){const values:any=[];Object.defineProperty(values,"constructor",{value:{[Symbol.species]:PoisonBorrowedArray}});Array.prototype.map.call(values,()=>0)}`,
    ],
    [
      "borrowed Promise reactions retain custom species validation",
      String.raw`function PoisonBorrowedPromise(this:any){this.__proto__.__proto__.polluted=true}export function poisonBorrowedPromiseSpecies(){const value:any=Promise.resolve(1);Object.defineProperty(value,"constructor",{value:{[Symbol.species]:PoisonBorrowedPromise}});Promise.prototype.then.call(value,()=>1)}`,
    ],
    [
      "borrowed Array slice rejects a local custom Symbol.species constructor",
      String.raw`function PoisonBorrowedSlice(this:any){this.__proto__.__proto__.polluted=true}export function poisonBorrowedSliceSpecies(){const value:any=[];Object.defineProperty(value,"constructor",{value:{[Symbol.species]:PoisonBorrowedSlice}});Array.prototype.slice.call(value)}`,
    ],
    [
      "borrowed Array splice rejects an inherited local custom species constructor",
      String.raw`function PoisonBorrowedSplice(this:any):void{this.__proto__.__proto__.polluted=true}export function poisonBorrowedSpliceSpecies():void{Object.setPrototypeOf(PoisonBorrowedSplice,Promise);const value:any=[1];Object.defineProperty(value,"constructor",{value:PoisonBorrowedSplice});Array.prototype.splice.call(value,0,1)}`,
    ],
    [
      "typed-array methods reject a local custom Symbol.species constructor",
      String.raw`function PoisonTypedArray(this:any){this.__proto__.__proto__.polluted=true}export function poisonTypedArraySpecies(){const value:any=new Uint8Array([1]);Object.defineProperty(value,"constructor",{value:{[Symbol.species]:PoisonTypedArray}});value.slice()}`,
    ],
    [
      "ArrayBuffer methods reject a local custom Symbol.species constructor",
      String.raw`function PoisonArrayBuffer(this:any){this.__proto__.__proto__.polluted=true}export function poisonArrayBufferSpecies(){const value:any=new ArrayBuffer(8);Object.defineProperty(value,"constructor",{value:{[Symbol.species]:PoisonArrayBuffer}});value.slice(0)}`,
    ],
    [
      "Array.join invokes local element stringification hooks",
      String.raw`export function poisonArrayJoin(){const element:any={toString(){this.__proto__.polluted=true;return "x"}};[element].join()}`,
    ],
    [
      "Array.at invokes local index coercion hooks",
      String.raw`export function poisonArrayAtIndex(){const index:any={valueOf(){this.__proto__.polluted=true;return 0}};[1].at(index)}`,
    ],
    [
      "Array.copyWithin invokes local index coercion hooks",
      String.raw`export function poisonCopyWithinIndex(){const index:any={valueOf(){this.__proto__.polluted=true;return 0}};[1].copyWithin(index,0)}`,
    ],
    [
      "Object.defineProperty invokes local property-key coercion hooks",
      String.raw`export function poisonDescriptorKey(){const key:any={toString(){this.__proto__.polluted=true;return "x"}};Object.defineProperty({},key,{value:1})}`,
    ],
    [
      "Object.fromEntries invokes local property-key coercion hooks",
      String.raw`export function poisonFromEntriesKey(){const key:any={toString(){this.__proto__.polluted=true;return "x"}};Object.fromEntries([[key,1]])}`,
    ],
    [
      "computed property reads invoke local property-key coercion hooks",
      String.raw`export function poisonComputedReadKey(){const key:any={toString(){this.__proto__.polluted=true;return "x"}};void({} as any)[key]}`,
    ],
    [
      "bound function length retains boxed Number-prototype provenance",
      String.raw`function boundLengthTarget(){}export function poisonBoundLength(){const bound:any=boundLengthTarget.bind(null);bound.length.__proto__.valueOf=()=>0}`,
    ],
    [
      "bound function name retains boxed String-prototype provenance",
      String.raw`function boundNameTarget(){}export function poisonBoundName(){const bound:any=boundNameTarget.bind(null);bound.name.__proto__.startsWith=()=>true}`,
    ],
    [
      "bound function inherited methods retain Function-object provenance",
      String.raw`function boundStringTarget(){}export function poisonBoundToString(){const bound:any=boundStringTarget.bind(null);bound.toString().__proto__.startsWith=()=>true}`,
    ],
    [
      "Array.fromAsync rejects a caller-selected result constructor",
      String.raw`function PoisonFromAsync(this:any){this.__proto__.__proto__.polluted=true}export function poisonArrayFromAsyncReceiver(){(Array as any).fromAsync.call(PoisonFromAsync,[1])}`,
    ],
    [
      "typed-array static factories reject a caller-selected result constructor",
      String.raw`function PoisonTypedFrom(this:any){this.__proto__.__proto__.polluted=true}export function poisonTypedArrayFromReceiver(){Uint8Array.from.call(PoisonTypedFrom,[1])}`,
    ],
    [
      "Promise.withResolvers rejects a caller-selected Promise constructor",
      String.raw`function PoisonWithResolvers(this:any){this.__proto__.__proto__.polluted=true}export function poisonPromiseWithResolversReceiver(){(Promise as any).withResolvers.call(PoisonWithResolvers)}`,
    ],
    [
      "Promise.finally assimilates callback-returned local thenables",
      String.raw`export async function poisonPromiseFinallyThenable(){await Promise.resolve(1).finally(()=>({then(resolve:any){this.__proto__.polluted=true;resolve()}}))}`,
    ],
    [
      "Promise reactions retain callable heaps thrown into the rejection channel",
      String.raw`export function poisonPromiseRejectedCallableGraph(){return Promise.resolve(1).then(()=>{throw {handle(target:any){target.startsWith=()=>true}}})}`,
    ],
    [
      "Object.fromEntries results retain the ordinary Object prototype",
      String.raw`export function poisonFromEntriesPrototype(){const result:any=Object.fromEntries([]);result.__proto__.polluted=true}`,
    ],
    [
      "property-descriptor results retain the ordinary Object prototype",
      String.raw`export function poisonDescriptorResultPrototype(){const descriptor:any=Object.getOwnPropertyDescriptor({safe:1},"safe");descriptor.__proto__.polluted=true}`,
    ],
    [
      "borrowed Array species consumers reject unresolved receivers",
      String.raw`export function poisonBorrowedExternalArraySpecies(values:any){Array.prototype.map.call(values,()=>0)}`,
    ],
    [
      "borrowed Promise species consumers reject unresolved receivers",
      String.raw`export function poisonBorrowedExternalPromiseSpecies(value:any){Promise.prototype.then.call(value,()=>1)}`,
    ],
    [
      "borrowed typed-array species consumers reject unresolved receivers",
      String.raw`export function poisonBorrowedExternalTypedSpecies(value:any){Uint8Array.prototype.map.call(value,(item:any)=>item)}`,
    ],
    [
      "local helper throws propagate across exported call boundaries",
      String.raw`function throwIntrinsicFromHelper():never{throw String.prototype}export function poisonPropagatedHelperThrow(){throwIntrinsicFromHelper()}`,
    ],
    [
      "array callback throws propagate across exported call boundaries",
      String.raw`export function poisonPropagatedCallbackThrow(){[1].map(()=>{throw {handle(target:any){target.startsWith=()=>true}}})}`,
    ],
    [
      "Reflect.deleteProperty invokes local property-key coercion hooks",
      String.raw`export function poisonReflectDeleteKey(){const key:any={toString(){this.__proto__.polluted=true;return "safe"}};Reflect.deleteProperty({},key)}`,
    ],
    [
      "TypedArray.set invokes local offset coercion hooks",
      String.raw`export function poisonTypedArraySetOffset(){const offset:any={valueOf(){this.__proto__.polluted=true;return 0}};new Uint8Array(1).set([],offset)}`,
    ],
    [
      "Reflect.apply rejects inherited indexed getters on array-like argument lists",
      String.raw`function freezeApplied(value:any){Object.freeze(value)}export function poisonReflectApplyArguments(prototype:any){const args:any=Object.create(prototype);Object.defineProperty(args,"length",{value:1});Reflect.apply(freezeApplied,null,args)}`,
    ],
    [
      "borrowed Array callbacks reject inherited indexed getters",
      String.raw`function freezeBorrowedElement(value:any){Object.freeze(value)}export function poisonBorrowedArrayGetter(prototype:any){const value:any=Object.create(prototype);Object.defineProperty(value,"length",{value:1});Array.prototype.forEach.call(value,freezeBorrowedElement)}`,
    ],
    [
      "borrowed Array mutators reject inherited indexed getters",
      String.raw`export function poisonBorrowedPopGetter(prototype:any){const value:any=Object.create(prototype);Object.defineProperty(value,"length",{value:1});Object.freeze(Array.prototype.pop.call(value))}`,
    ],
    [
      "borrowed Array.at rejects inherited indexed getters",
      String.raw`export function poisonBorrowedAtGetter(prototype:any){const value:any=Object.create(prototype);Object.defineProperty(value,"length",{value:1});Object.freeze(Array.prototype.at.call(value,0))}`,
    ],
    [
      "Array length assignment invokes local numeric coercion hooks",
      String.raw`export function poisonArrayLength(){const value:any={valueOf(){this.__proto__.polluted=true;return 0}};const target:any=[];target.length=value}`,
    ],
    [
      "Array length descriptors invoke local numeric coercion hooks",
      String.raw`export function poisonArrayLengthDescriptor(){const value:any={valueOf(){this.__proto__.polluted=true;return 0}};Object.defineProperty([],"length",{value})}`,
    ],
    [
      "Object.assign cannot hide Array length coercion",
      String.raw`export function poisonAssignedArrayLength(){const value:any={valueOf(){this.__proto__.polluted=true;return 0}};Object.assign([],{length:value})}`,
    ],
    [
      "Reflect.set cannot hide Array length coercion",
      String.raw`export function poisonReflectedArrayLength(){const value:any={valueOf(){this.__proto__.polluted=true;return 0}};Reflect.set([],"length",value)}`,
    ],
    [
      "Array.slice invokes local index coercion hooks",
      String.raw`export function poisonSliceIndex(){const value:any={valueOf(){this.__proto__.polluted=true;return 0}};[1].slice(value)}`,
    ],
    [
      "Array.flat invokes local depth coercion hooks",
      String.raw`export function poisonFlatDepth(){const value:any={valueOf(){this.__proto__.polluted=true;return 1}};[[1]].flat(value)}`,
    ],
    [
      "Array.sort invokes local comparator-result coercion hooks",
      String.raw`export function poisonSortResult(){const value:any={valueOf(){this.__proto__.polluted=true;return 0}};[2,1].sort(()=>value)}`,
    ],
    [
      "borrowed Array.slice rejects unresolved inherited indexed getters",
      String.raw`export function poisonBorrowedSliceGetter(prototype:any){const value:any=Object.create(prototype);Object.defineProperty(value,"length",{value:1});Object.freeze(Array.prototype.slice.call(value).pop())}`,
    ],
    [
      "TypedArray construction is outside the admitted source-only grammar",
      String.raw`export function poisonTypedConstruction(){const value:any={valueOf(){this.__proto__.polluted=true;return 1}};new Uint8Array([value] as any)}`,
    ],
    [
      "TypedArray indexed writes cannot enter through the fail-closed binary-memory boundary",
      String.raw`export function poisonTypedIndex(){const value:any={valueOf(){this.__proto__.polluted=true;return 1}};const target:any=new Uint8Array(1);target[0]=value}`,
    ],
    [
      "TypedArray descriptor writes cannot enter through the fail-closed binary-memory boundary",
      String.raw`export function poisonTypedDescriptor(){const value:any={valueOf(){this.__proto__.polluted=true;return 1}};Object.defineProperty(new Uint8Array(1),"0",{value})}`,
    ],
    [
      "TypedArray Object.assign writes cannot enter through the fail-closed binary-memory boundary",
      String.raw`export function poisonTypedAssign(){const value:any={valueOf(){this.__proto__.polluted=true;return 1}};Object.assign(new Uint8Array(1),{"0":value})}`,
    ],
    [
      "TypedArray.set source conversion cannot enter through the fail-closed binary-memory boundary",
      String.raw`export function poisonTypedSetSource(){const value:any={valueOf(){this.__proto__.polluted=true;return 1}};new Uint8Array(1).set([value] as any)}`,
    ],
    [
      "TypedArray.fill conversion cannot enter through the fail-closed binary-memory boundary",
      String.raw`export function poisonTypedFill(){const value:any={valueOf(){this.__proto__.polluted=true;return 1}};new Uint8Array(1).fill(value)}`,
    ],
    [
      "TypedArray.map result conversion cannot enter through the fail-closed binary-memory boundary",
      String.raw`export function poisonTypedMap(){const value:any={valueOf(){this.__proto__.polluted=true;return 1}};new Uint8Array([1]).map(()=>value)}`,
    ],
    [
      "TypedArray static factories are outside the admitted source-only grammar",
      String.raw`export function poisonTypedFactory(){const value:any={valueOf(){this.__proto__.polluted=true;return 1}};Uint8Array.of(value)}`,
    ],
    [
      "ArrayBuffer construction is outside the admitted source-only grammar",
      String.raw`export function poisonArrayBufferLength(){const value:any={valueOf(){this.__proto__.polluted=true;return 8}};new ArrayBuffer(value)}`,
    ],
    [
      "ArrayBuffer.slice is outside the admitted source-only grammar",
      String.raw`export function poisonArrayBufferSlice(){const value:any={valueOf(){this.__proto__.polluted=true;return 0}};new ArrayBuffer(8).slice(value)}`,
    ],
    [
      "caller-controlled Function.apply argument containers retain external provenance",
      String.raw`function mutateApplied(target:any){target.startsWith=()=>true}export function poisonExternalApply(args:any){mutateApplied.apply(null,args)}`,
    ],
    [
      "caller-controlled Reflect.apply argument containers retain external provenance",
      String.raw`function mutateReflected(target:any){target.startsWith=()=>true}export function poisonExternalReflectApply(args:any){Reflect.apply(mutateReflected,null,args)}`,
    ],
    [
      "borrowed Array callbacks invoke local array-like length coercion hooks",
      String.raw`export function poisonBorrowedCallbackLength(){const value:any={length:{valueOf(){this.__proto__.polluted=true;return 0}}};Array.prototype.forEach.call(value,()=>undefined)}`,
    ],
    [
      "borrowed Array mutators invoke local array-like length coercion hooks",
      String.raw`export function poisonBorrowedMutationLength(){const value:any={length:{valueOf(){this.__proto__.polluted=true;return 0}}};Array.prototype.push.call(value,1)}`,
    ],
    [
      "borrowed Array.at invokes local array-like length coercion hooks",
      String.raw`export function poisonBorrowedAtLength(){const value:any={length:{valueOf(){this.__proto__.polluted=true;return 0}}};Array.prototype.at.call(value,0)}`,
    ],
    [
      "borrowed Array.slice invokes local array-like length coercion hooks",
      String.raw`export function poisonBorrowedSliceLength(){const value:any={length:{valueOf(){this.__proto__.polluted=true;return 0}}};Array.prototype.slice.call(value,0)}`,
    ],
    [
      "Reflect.apply invokes local array-like length coercion hooks",
      String.raw`function noopReflectedLength(){}export function poisonReflectApplyLength(){const value:any={length:{valueOf(){this.__proto__.polluted=true;return 0}}};Reflect.apply(noopReflectedLength,null,value)}`,
    ],
    [
      "aliased well-known Symbol descriptor keys cannot install concat spreadability",
      String.raw`export function poisonAliasedConcatProtocol(){const S=Symbol;const value:any={0:String.prototype,length:1};Object.defineProperty(value,S.isConcatSpreadable,{value:true});const result:any[]=[].concat(value);Object.freeze(result.pop())}`,
    ],
    [
      "Array.concat arguments remain in result provenance",
      String.raw`export function poisonConcatArgument(){const result:any[]=[].concat(String.prototype as any);Object.freeze(result.pop())}`,
    ],
    [
      "Array.flat retains flattened nested-element provenance",
      String.raw`export function poisonFlatElement(){const result:any[]=[[String.prototype] as any].flat();Object.freeze(result.pop())}`,
    ],
    [
      "Array stringification recursively invokes nested element coercion hooks",
      String.raw`export function poisonNestedArrayJoin(){const value:any={toString(){this.__proto__.polluted=true;return ""}};void [[value]].join()}`,
    ],
    [
      "Array string coercion invokes an own bound join adapter",
      String.raw`export function challengeArrayOwnJoin():void{const value:any=[];value.join=Object.defineProperty.bind(null,Object.prototype,"cvArrayOwnJoin",{value:true,configurable:true});void(""+value)}`,
    ],
    [
      "nested Array string coercion invokes an element's own bound join adapter",
      String.raw`export function challengeNestedArrayOwnJoin():void{const value:any=[];value.join=Object.defineProperty.bind(null,Object.prototype,"cvNestedArrayOwnJoin",{value:true,configurable:true});void(""+[value])}`,
    ],
    [
      "Array string coercion invokes a primitive-returning bound Reflect.set join",
      String.raw`export function challengeArrayReflectJoin():void{const value:any=[];value.join=Reflect.set.bind(null,Object.prototype,"cvArrayReflectJoin",true);void(""+value)}`,
    ],
    [
      "Array string coercion preserves a bound local join's receiver",
      String.raw`function challengeReceiverJoin(this:any):string{this.__proto__.__proto__.cvArrayReceiverJoin=true;return"safe"}export function challengeArrayReceiverJoin():void{const value:any=[];value.join=challengeReceiverJoin.bind(value);void(""+value)}`,
    ],
    [
      "language addition recursively stringifies nested Array elements",
      String.raw`export function poisonNestedArrayAddition(){const value:any={toString(){this.__proto__.polluted=true;return ""}};void (""+[[value]])}`,
    ],
    [
      "Array.reduce feeds callback-return provenance into the next accumulator",
      String.raw`export function poisonReduceRelay(){[0,0].reduce((acc:any)=>{if(typeof acc==="object")acc.startsWith=()=>true;return String.prototype},0)}`,
    ],
    [
      "Array.reduceRight feeds callback-return provenance into the next accumulator",
      String.raw`export function poisonReduceRightRelay(){[0,0].reduceRight((acc:any)=>{if(typeof acc==="object")acc.startsWith=()=>true;return String.prototype},0)}`,
    ],
    [
      "async function returns assimilate local thenables even when the Promise is discarded",
      String.raw`async function poisonAsyncThenable():PromiseLike<void>{return {then(resolve:any):void{resolve.__proto__.apply=()=>undefined;resolve()}}}export function triggerAsyncReturnPoison():void{void poisonAsyncThenable()}`,
    ],
    [
      "for-await-of assimilates each local yielded thenable",
      String.raw`export async function poisonForAwaitElement():Promise<void>{const value:any={then(resolve:any):void{resolve.__proto__.apply=()=>undefined;resolve(1)}};for await(const item of [value]){void item}}`,
    ],
    [
      "Array.join coerces a caller-supplied separator",
      String.raw`export function poisonJoinSeparator(){const value:any={toString(){this.__proto__.polluted=true;return ","}};[0].join(value)}`,
    ],
    [
      "Array.join adapter calls preserve separator coercion",
      String.raw`export function poisonJoinSeparatorAdapter(){const value:any={toString(){this.__proto__.polluted=true;return ","}};Array.prototype.join.apply([0],[value])}`,
    ],
    [
      "Error-family default stringification coerces own name and message values",
      String.raw`export function poisonEvalErrorPrimitive(){const value:any={toString(){this.__proto__.polluted=true;return "EvalError"}};const error:any=new EvalError();error.name=value;void(""+error)}`,
    ],
    [
      "explicit Error.prototype.toString preserves intrinsic field coercion",
      String.raw`export function poisonExplicitErrorString(){const value:any={toString(){this.__proto__.polluted=true;return "Error"}};const ErrorCtor:any=globalThis["Error"];const error:any=new ErrorCtor();error.name=value;error.toString()}`,
    ],
    [
      "global String conversion preserves Error intrinsic field coercion",
      String.raw`export function poisonStringError(){const value:any={toString(){this.__proto__.polluted=true;return "Error"}};const ErrorCtor:any=globalThis["Error"];const error:any=new ErrorCtor();error.name=value;String(error)}`,
    ],
    [
      "console.error format substitution preserves local coercion hooks",
      String.raw`export function poisonConsoleErrorPercentS():void{const value:any={toString(){this.__proto__.polluted=true;return "x"}};console.error("%s",value)}`,
    ],
    [
      "console.error Error rendering preserves intrinsic field coercion",
      String.raw`export function poisonConsoleErrorError():void{const value:any={toString(){this.__proto__.polluted=true;return "Error"}};const ErrorCtor:any=globalThis["Error"];const error:any=new ErrorCtor();error.name=value;console.error(error)}`,
    ],
    [
      "console.error JSON formatting preserves local toJSON hooks",
      String.raw`export function poisonConsolePercentJ():void{const value:any={toJSON(){this.__proto__.polluted=true;return "x"}};console.error("%j",value)}`,
    ],
    [
      "console.error JSON formatting invokes bound toJSON adapters",
      String.raw`export function poisonConsoleBoundToJSON():void{const hook:any=Array.prototype.splice.bind(Array.prototype,0,0,"POLLUTED");const value:any={toJSON:hook};console.error("%j",value)}`,
    ],
    [
      "console.error JSON formatting invokes bound static mutator adapters",
      String.raw`export function poisonConsoleBoundDefineProperty():void{const hook:any=Object.defineProperty.bind(null,Object.prototype,"pollutedByConsoleBoundDefine",{value:true,configurable:true});console.error("%j",{toJSON:hook})}`,
    ],
    [
      "console.error JSON formatting preserves bound splice species checks",
      String.raw`function PoisonBoundSpecies(this:any):void{this.__proto__.__proto__.pollutedByBoundSpecies=true}export function poisonConsoleBoundSpecies():void{Object.setPrototypeOf(PoisonBoundSpecies,Promise);const value:any=[1];Object.defineProperty(value,"constructor",{value:PoisonBoundSpecies});const hook:any=Array.prototype.splice.bind(value,0,1);console.error("%j",{toJSON:hook})}`,
    ],
    [
      "RegExp default stringification coerces own source and flags values",
      String.raw`export function poisonRegExpPrimitive(){const value:any={toString(){this.__proto__.polluted=true;return "x"}};const expression:any=/safe/;Object.defineProperty(expression,"source",{value});void(""+expression)}`,
    ],
    [
      "borrowed RegExp.prototype.toString coerces ordinary receiver fields",
      String.raw`export function poisonBorrowedRegExp(){const value:any={toString(){this.__proto__.polluted=true;return "x"}};RegExp.prototype.toString.call({source:value,flags:"g"})}`,
    ],
    [
      "borrowed RegExp.prototype.toString adapters preserve field coercion",
      String.raw`export function poisonBorrowedRegExpAdapter(){const value:any={toString(){this.__proto__.polluted=true;return "x"}};RegExp.prototype.toString.apply({source:value,flags:"g"},[])}`,
    ],
    [
      "aliased Reflect.set preserves the fourth receiver mutation target",
      String.raw`export function poisonAliasedReflectReceiver(){const set=Reflect.set;set({},"reflectReceiverPoison",true,String.prototype)}`,
    ],
    [
      "Error lazy stack formatting preserves intrinsic name coercion",
      String.raw`export function poisonErrorStack(){const value:any={toString(){this.__proto__.polluted=true;return "EvalError"}};const error:any=new EvalError();error.name=value;void error.stack}`,
    ],
    [
      "globalThis Error aliases preserve borrowed generic toString coercion",
      String.raw`export function poisonGlobalErrorAlias(){const value:any={toString(){this.__proto__.polluted=true;return "Error"}};(globalThis as any)["Error"].prototype.toString.call({name:value,message:"safe"})}`,
    ],
    [
      "local constructor prototype edges preserve inherited coercion methods",
      String.raw`function LocalUnaryHandler():void{}export function poisonInheritedLocalCtorUnary():void{(LocalUnaryHandler.prototype as any).valueOf=function(this:any):number{this.__proto__.__proto__.polluted=true;return 0};const handler:any=new LocalUnaryHandler();void +handler}`,
    ],
    [
      "local constructor prototype edges preserve inherited thenable methods",
      String.raw`function LocalThenable():void{}export async function poisonInheritedLocalThenable():Promise<void>{(LocalThenable.prototype as any).then=function(this:any,resolve:any):void{resolve.__proto__.apply=()=>undefined;resolve()};return new (LocalThenable as any)()}`,
    ],
    [
      "process environment values retain String prototype provenance",
      String.raw`export function poisonEnvironmentString():void{const value:any=process.env.PATH;value.__proto__.startsWith=()=>true}`,
    ],
    [
      "unknown host callbacks traverse local constructor prototype methods",
      String.raw`function LocalJsonHandler():void{}export function poisonInheritedToJson():void{(LocalJsonHandler.prototype as any).toJSON=function(this:any):string{this.__proto__.__proto__.polluted=true;return "safe"};JSON.stringify(new LocalJsonHandler())}`,
    ],
    [
      "unresolved intrinsic receiver calls traverse local constructor prototype methods",
      String.raw`function LocalLocaleHandler():void{}export function poisonInheritedLocaleString():void{(LocalLocaleHandler.prototype as any).toString=function(this:any):string{this.__proto__.__proto__.polluted=true;return "safe"};Object.prototype.toLocaleString.call(new LocalLocaleHandler())}`,
    ],
    [
      "new Object(null) retains the ordinary Object prototype",
      String.raw`export function poisonNewObjectNullPrototype(){const value:any=new Object(null);value.__proto__.polluted=true}`,
    ],
    [
      "new Object(undefined) retains the ordinary Object prototype",
      String.raw`export function poisonNewObjectUndefinedPrototype(){const value:any=new Object(undefined);value.__proto__.polluted=true}`,
    ],
    [
      "Object.fromEntries rejects inherited entry-key getters",
      String.raw`export function poisonFromEntriesInheritedKey(prototype:any):void{const entry:any=Object.create(null,{"1":{value:1}});Object.setPrototypeOf(entry,prototype);void Object.fromEntries([entry])}`,
    ],
    [
      "Object.fromEntries rejects inherited entry-value getters",
      String.raw`export function poisonFromEntriesInheritedValue(prototype:any):void{const entry:any=Object.create(null,{"0":{value:"x"}});Object.setPrototypeOf(entry,prototype);void Object.fromEntries([entry])}`,
    ],
    [
      "Object.fromEntries preserves inherited entry-value provenance",
      String.raw`export function poisonFromEntriesInheritedTarget(prototype:any):void{const entry:any=Object.create(null,{"0":{value:"x"}});Object.setPrototypeOf(entry,prototype);const target:any=Object.fromEntries([entry]).x;target.startsWith=()=>true}`,
    ],
    [
      "Object.fromEntries rejects caller-controlled entries wrapped in local arrays",
      String.raw`export function poisonWrappedExternalEntry(entry:any):void{void Object.fromEntries([entry])}`,
    ],
    [
      "Object.fromEntries local entry arms cannot suppress caller-controlled entry arms",
      String.raw`export function poisonUnionExternalEntry(flag:any,entry:any):void{const selected:any=flag?["x",1]:entry;const target:any=Object.fromEntries([selected]).x;target.startsWith=()=>true}`,
    ],
    [
      "Map rejects caller-controlled entries wrapped in local arrays",
      String.raw`export function poisonWrappedExternalMapEntry(entry:any):void{void new Map([entry])}`,
    ],
    [
      "descriptor-map local arms cannot suppress caller-controlled descriptor arms",
      String.raw`export function poisonUnionDescriptorMap(flag:any,descriptors:any):void{const maps:any=flag?{safe:{value:1}}:descriptors;const box:any=Object.create(null);Object.defineProperties(box,maps);box.target.startsWith=()=>true}`,
    ],
    [
      "Object.fromEntries local arms cannot suppress caller-factory result arms",
      String.raw`export function poisonFactoryEntryUnion(flag:any,get:any):void{const entry:any=flag?["x",1]:get();const target:any=Object.fromEntries([entry]).x;target.startsWith=()=>true}`,
    ],
    [
      "descriptor-map local arms cannot suppress caller-factory result arms",
      String.raw`export function poisonFactoryDescriptorUnion(flag:any,get:any):void{const maps:any=flag?{safe:{value:1}}:get();const box:any=Object.create(null);Object.defineProperties(box,maps);box.target.startsWith=()=>true}`,
    ],
    [
      "await rejects inherited caller-controlled then getters",
      String.raw`export async function poisonInheritedExternalThen(prototype:any):Promise<void>{void await Object.create(prototype)}`,
    ],
    [
      "iteration rejects inherited caller-controlled iterator hooks",
      String.raw`export function poisonInheritedExternalIterator(prototype:any):void{const values:any=[];Object.setPrototypeOf(values,prototype);for(const _ of values){break}}`,
    ],
    [
      "mixed Object and local constructor alternatives execute the local constructor",
      String.raw`function MixedObjectPoison(this:any):void{this.__proto__.__proto__.polluted=true}export function poisonMixedObjectConstructor(flag:any):void{const Constructor:any=flag?Object:MixedObjectPoison;new Constructor(null)}`,
    ],
    [
      "mixed Array and local constructor alternatives execute the local constructor",
      String.raw`function MixedArrayPoison(this:any):void{this.__proto__.__proto__.polluted=true}export function poisonMixedArrayConstructor(flag:any):void{const Constructor:any=flag?Array:MixedArrayPoison;new Constructor()}`,
    ],
    [
      "mixed WeakRef and local constructor alternatives execute the local constructor",
      String.raw`function MixedWeakRefPoison(this:any):void{this.__proto__.__proto__.polluted=true}export function poisonMixedWeakRefConstructor(flag:any):void{const Constructor:any=flag?WeakRef:MixedWeakRefPoison;new Constructor({})}`,
    ],
    [
      "mixed bound and local constructor alternatives execute the local constructor",
      String.raw`function MixedBoundBase():void{}function MixedBoundPoison(this:any):void{this.__proto__.__proto__.polluted=true}const mixedBound=MixedBoundBase.bind(null);export function poisonMixedBoundConstructor(flag:any):void{const Constructor:any=flag?mixedBound:MixedBoundPoison;new Constructor()}`,
    ],
    [
      "mixed Map and local constructor alternatives execute the local constructor",
      String.raw`function MixedMapPoison(this:any):void{this.__proto__.__proto__.polluted=true}export function poisonMixedMapConstructor(flag:any):void{const Constructor:any=flag?Map:MixedMapPoison;new Constructor()}`,
    ],
    [
      "mixed trusted import and local constructor alternatives execute the local constructor",
      String.raw`import Stripe from "stripe";function MixedStripePoison(this:any):void{this.__proto__.__proto__.polluted=true}export function poisonMixedStripeConstructor(flag:any):void{const Constructor:any=flag?Stripe:MixedStripePoison;new Constructor("safe")}`,
    ],
    [
      "for-of rejects a caller-controlled iterator protocol",
      String.raw`export function poisonExternalForOf(iterable:any):void{for(const _ of iterable){break}}`,
    ],
    [
      "Array.from rejects a caller-controlled iterator protocol",
      String.raw`export function poisonExternalArrayFrom(iterable:any):void{void Array.from(iterable)}`,
    ],
    [
      "Object.fromEntries rejects a caller-controlled iterator protocol",
      String.raw`export function poisonExternalFromEntries(iterable:any):void{void Object.fromEntries(iterable)}`,
    ],
    [
      "collection construction rejects a caller-controlled iterator protocol",
      String.raw`export function poisonExternalMap(iterable:any):void{void new Map(iterable)}`,
    ],
    [
      "direct caller-controlled property getters fail closed",
      String.raw`export function poisonExternalGetter(object:any):void{void object.x}`,
    ],
    [
      "caller-controlled inherited property getters fail closed",
      String.raw`export function poisonExternalInheritedGetter(object:any):void{void object.inherited}`,
    ],
    [
      "caller-controlled has traps fail closed",
      String.raw`export function poisonExternalHas(object:any):void{void("x" in object)}`,
    ],
    [
      "caller-controlled Symbol.hasInstance hooks fail closed",
      String.raw`export function poisonExternalHasInstance(Constructor:any):void{void({} instanceof Constructor)}`,
    ],
    [
      "instanceof rejects caller-controlled instance prototype traps",
      String.raw`export function poisonExternalInstanceTarget(object:any):void{void(object instanceof Object)}`,
    ],
    [
      "switch discriminants evaluate caller-controlled property getters",
      String.raw`export function poisonSwitchGetter(object:any):void{switch(object.x){default:break}}`,
    ],
    [
      "switch case expressions evaluate caller-controlled property getters",
      String.raw`export function poisonSwitchCaseGetter(object:any):void{switch(0){case object.x:break;default:break}}`,
    ],
    [
      "for-in source expressions evaluate caller-controlled property getters",
      String.raw`export function poisonForInGetter(object:any):void{for(const key in object.x){void key}}`,
    ],
    [
      "for-in rejects caller-controlled enumeration traps",
      String.raw`export function poisonForInTrap(object:any):void{for(const key in object){void key}}`,
    ],
    [
      "computed destructuring keys evaluate caller-controlled property getters",
      String.raw`export function poisonComputedDestructuringKey(object:any):void{const {[object.x]:value}={safe:1};void value}`,
    ],
    [
      "erased string annotations cannot hide direct protected receiver writes",
      String.raw`export function poisonTypedParameterDirect(value:string):void{(value as any).startsWith=()=>true}`,
    ],
    [
      "erased string annotations cannot hide protected indexed values",
      String.raw`export function poisonTypedParameterIndex(value:string):void{const target:any=(value as any)[0];target.startsWith=()=>true}`,
    ],
    [
      "erased string annotations cannot hide protected length values",
      String.raw`export function poisonTypedParameterLength(value:string):void{const target:any=(value as any).length;target.startsWith=()=>true}`,
    ],
    [
      "implicit built-in throws retain protected Error prototype provenance",
      String.raw`export function poisonImplicitCatchPrototype():void{try{Object.getPrototypeOf(null)}catch(error:any){error.__proto__.polluted=true}}`,
    ],
    [
      "implicit null-member TypeErrors retain protected Error prototype provenance",
      String.raw`export function poisonNullMemberCatchPrototype():void{try{void (null as any).x}catch(error:any){error.__proto__.polluted=true}}`,
    ],
    [
      "implicit undefined-member TypeErrors retain protected Error prototype provenance",
      String.raw`export function poisonUndefinedMemberCatchPrototype():void{try{void (undefined as any).x}catch(error:any){error.__proto__.polluted=true}}`,
    ],
    [
      "implicit non-callable TypeErrors retain protected Error prototype provenance",
      String.raw`export function poisonNonCallableCatchPrototype():void{try{(0 as any)()}catch(error:any){error.__proto__.polluted=true}}`,
    ],
    [
      "implicit non-constructable TypeErrors retain protected Error prototype provenance",
      String.raw`export function poisonNonConstructableCatchPrototype():void{try{new (0 as any)()}catch(error:any){error.__proto__.polluted=true}}`,
    ],
    [
      "BigInt property keys use runtime ToPropertyKey canonicalization",
      String.raw`export function poisonBigIntPropertyKey():void{const box:any=Object.create(null);Object.defineProperty(box,1n as any,{value:String.prototype});const target:any=box["1"];target.startsWith=()=>true}`,
    ],
    [
      "object assignment destructuring rejects caller-controlled getters",
      String.raw`export function poisonObjectAssignmentGetter(object:any):void{let value:any;({value}=object);void value}`,
    ],
    [
      "array assignment destructuring rejects caller-controlled iterators",
      String.raw`export function poisonArrayAssignmentIterator(iterable:any):void{let value:any;[value]=iterable;void value}`,
    ],
    [
      "object-rest assignment destructuring rejects caller-controlled enumeration",
      String.raw`export function poisonObjectRestAssignment(source:any):void{let rest:any;({...rest}=source);void rest}`,
    ],
    [
      "caller-controlled prototype traps fail closed",
      String.raw`export function poisonExternalGetPrototype(object:any):void{void Object.getPrototypeOf(object)}`,
    ],
    [
      "caller-controlled primitive coercion hooks fail closed",
      String.raw`export function poisonExternalPrimitive(value:any):void{void +value}`,
    ],
    [
      "known primitive conversions do not suppress caller-controlled callable alternatives",
      String.raw`export function poisonMixedExternalCallable(flag:any,callback:any):void{const callable:any=flag?String:callback;callable(String.prototype)}`,
    ],
    [
      "bound callables do not suppress caller-controlled callable alternatives",
      String.raw`function mixedCallableBase():void{}const mixedCallableBound=mixedCallableBase.bind(null);export function poisonMixedBoundCallable(flag:any,callback:any):void{const callable:any=flag?mixedCallableBound:callback;callable(String.prototype)}`,
    ],
  ];
  for (const [label, source] of extendedLaunderingRegressions) {
    expectProtectedMutationFailure(label, source);
  }

  const reflectedFunctionPrototypeRun = runVerifier(createFixture(
    `${catalog()}\nexport function poisonReflectedFunctionPrototype(){const prototype:any=Object.getPrototypeOf(()=>undefined);const DynamicFunction:any=Reflect.get(prototype,"constructor");DynamicFunction("String.prototype.startsWith = () => true")()}\n`,
  ));
  check(
    "Function.prototype reflection retains dynamic-Function provenance",
    reflectedFunctionPrototypeRun.status === 1 &&
      reflectedFunctionPrototypeRun.output.includes("dynamic evaluation via binding-resolved capability is not allowed") &&
      !reflectedFunctionPrototypeRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE"),
  );

  const directEvalRun = runVerifier(createFixture(
    catalog() + '\neval("PRICES.premium_month.lookup = \\\"unexpected_paid_surface\\\"");\n',
  ));
  check(
    "direct eval cannot hide a lexical PRICES mutation in a string",
    directEvalRun.status === 1 && directEvalRun.output.includes("dynamic evaluation via eval is not allowed"),
  );

  const indirectEvalRun = runVerifier(createFixture(
    catalog() + '\n(0, eval)("PRICES.premium_month.lookup = \\\"unexpected_paid_surface\\\"");\n',
  ));
  check(
    "indirect eval identifier calls are rejected by the AST boundary",
    indirectEvalRun.status === 1 && indirectEvalRun.output.includes("dynamic evaluation via eval is not allowed"),
  );

  const unicodeEvalRun = runVerifier(createFixture(
    catalog() + "\n" + String.raw`e\u0076al("PRICES.premium_month.lookup = 'unexpected_paid_surface'");` + "\n",
  ));
  check(
    "a Unicode-escaped eval identifier is decoded and rejected",
    unicodeEvalRun.status === 1 && unicodeEvalRun.output.includes("dynamic evaluation via eval is not allowed"),
  );

  const functionConstructorRun = runVerifier(createFixture(
    catalog() + '\nnew Function("PRICES.premium_month.lookup = \\\"unexpected_paid_surface\\\"")();\n',
  ));
  check(
    "Function constructors cannot hide executable catalog mutation",
    functionConstructorRun.status === 1 && functionConstructorRun.output.includes("dynamic evaluation via Function is not allowed"),
  );

  const unicodeBareFunctionRun = runVerifier(createFixture(
    catalog() + "\n" + String.raw`F\u0075nction("PRICES.premium_month.lookup = 'unexpected_paid_surface'")();` + "\n",
  ));
  check(
    "a bare Unicode-escaped Function call is decoded and rejected",
    unicodeBareFunctionRun.status === 1 &&
      unicodeBareFunctionRun.output.includes("dynamic evaluation via Function is not allowed"),
  );

  const directConstructorGadgetRun = runVerifier(createFixture(
    catalog() + '\n(() => {}).constructor("PRICES.premium_month.lookup = \\\"unexpected_paid_surface\\\"")();\n',
  ));
  check(
    "a constructor-derived Function call cannot execute a hidden catalog mutation",
    directConstructorGadgetRun.status === 1 &&
      directConstructorGadgetRun.output.includes("dynamic evaluation via constructor-derived Function is not allowed"),
  );

  const aliasedConstructorGadgetRun = runVerifier(createFixture(
    catalog() + '\nconst DynamicFunction = (() => {}).constructor;\nDynamicFunction("PRICES.premium_month.lookup = \\\"unexpected_paid_surface\\\"")();\n',
  ));
  check(
    "a constructor-derived Function cannot be aliased before invocation",
    aliasedConstructorGadgetRun.status === 1 &&
      aliasedConstructorGadgetRun.output.includes("dynamic evaluation via constructor-derived Function is not allowed"),
  );

  const templateConstructorGadgetRun = runVerifier(createFixture(
    catalog() + '\nconst DynamicFunction = (() => {})[`con${"structor"}`];\nDynamicFunction("return 1")();\n',
  ));
  check(
    "a template-computed constructor cannot hide a Function constructor",
    templateConstructorGadgetRun.status === 1 &&
      templateConstructorGadgetRun.output.includes("dynamic evaluation through a global or computed runtime capability is not allowed"),
  );

  const conditionalConstructorGadgetRun = runVerifier(createFixture(
    catalog() + '\n(() => {})[true ? "constructor" : "notConstructor"]("return 1")();\n',
  ));
  check(
    "an unknown conditional member cannot hide a Function constructor",
    conditionalConstructorGadgetRun.status === 1 &&
      conditionalConstructorGadgetRun.output.includes("dynamic evaluation through a global or computed runtime capability is not allowed"),
  );

  const destructuredConstructorGadgetRun = runVerifier(createFixture(
    catalog() + '\nexport function hidden() { const { [`con${"structor"}`]: DynamicFunction } = Object; return DynamicFunction("return 1")(); }\n',
  ));
  check(
    "a computed destructuring binding cannot hide a Function constructor",
    destructuredConstructorGadgetRun.status === 1 &&
      destructuredConstructorGadgetRun.output.includes("dynamic evaluation through a global or computed runtime capability is not allowed"),
  );

  const shorthandConstructorGadgetRun = runVerifier(createFixture(
    catalog() + '\nexport function hidden() { const { constructor } = Object; return constructor("return 1")(); }\n',
  ));
  check(
    "a shorthand destructuring binding cannot hide a Function constructor",
    shorthandConstructorGadgetRun.status === 1 &&
      shorthandConstructorGadgetRun.output.includes("dynamic evaluation through a global or computed runtime capability is not allowed"),
  );

  const assignmentDestructuredConstructorRun = runVerifier(createFixture(
    catalog() + '\nexport function hidden() { let DynamicFunction; ({ [`con${"structor"}`]: DynamicFunction } = Object); return DynamicFunction("return 1")(); }\n',
  ));
  check(
    "an assignment destructuring pattern cannot hide a Function constructor",
    assignmentDestructuredConstructorRun.status === 1 &&
      assignmentDestructuredConstructorRun.output.includes("dynamic evaluation through a global or computed runtime capability is not allowed"),
  );

  const textMatchedProductsGadgetRun = runVerifier(createFixture(
    catalog() + '\nexport function hidden(PRODUCTS: any = () => {}, key = "constructor") { return PRODUCTS[key]("return 1")(); }\n',
  ));
  check(
    "a text-matched PRODUCTS index outside the canonical bound function cannot hide a Function constructor",
    textMatchedProductsGadgetRun.status === 1 &&
      textMatchedProductsGadgetRun.output.includes("dynamic evaluation through a global or computed runtime capability is not allowed"),
  );

  const reflectedConstructorGadgetRun = runVerifier(createFixture(
    catalog() + '\nReflect.get(() => {}, "constructor")("return 1")();\n',
  ));
  check(
    "a reflective getter cannot recover a Function constructor",
    reflectedConstructorGadgetRun.status === 1 &&
      reflectedConstructorGadgetRun.output.includes("dynamic evaluation via binding-resolved capability is not allowed"),
  );

  const computedSelfImportRun = runVerifier(createFixture(
    catalog() + '\nvoid import("./stripe").then((module) => { module["PRI" + "CES"].premium_month.lookup = "unexpected_paid_surface"; });\n',
  ));
  check(
    "computed self-import mutation cannot reacquire the exported catalog namespace",
    computedSelfImportRun.status === 1 &&
      computedSelfImportRun.output.includes("dynamic module loading is not allowed in the catalog source"),
  );

  const computedSelfRequireRun = runVerifier(createFixture(
    catalog() + '\nmodule["re" + "quire"]("./stripe")["PRI" + "CES"].premium_month.lookup = "unexpected_paid_surface";\n',
  ));
  check(
    "computed module.require cannot reacquire and mutate the exported catalog namespace",
    computedSelfRequireRun.status === 1 &&
      computedSelfRequireRun.output.includes("dynamic module loading is not allowed in the catalog source"),
  );

  const ambientRequireVmRun = runVerifier(createFixture(
    catalog() + '\ndeclare const require: any;\nexport function hiddenVmMutation(){const vm=require("node:vm");const run:any=Reflect.get(vm,"run"+"InThisContext");run("String.prototype.startsWith = () => true")()}\n',
  ));
  check(
    "an erased ambient require declaration cannot hide runtime module loading",
    ambientRequireVmRun.status === 1 &&
      ambientRequireVmRun.output.includes("dynamic module loading is not allowed in the catalog source") &&
      !ambientRequireVmRun.output.includes("── OFFLINE RESULT: PASS_OFFLINE"),
  );

  const sideEffectCatalogImportRun = runVerifier(createFixture(
    catalog() + '\nimport "./catalog-mutator";\n',
  ));
  check(
    "an added side-effect module cannot reacquire and mutate the catalog out of file",
    sideEffectCatalogImportRun.status === 1 &&
      sideEffectCatalogImportRun.output.includes("dynamic module loading is not allowed in the catalog source"),
  );

  const computedCreateRequireRun = runVerifier(createFixture(
    catalog() + '\nconst loadSelf = (process as any).getBuiltinModule("node:" + "module")[`create${"Require"}`](import.meta.url);\nloadSelf("./stripe")["PRI" + "CES"].premium_month.lookup = "unexpected_paid_surface";\n',
  ));
  check(
    "a template-computed createRequire capability cannot reacquire the catalog module",
    computedCreateRequireRun.status === 1 &&
      computedCreateRequireRun.output.includes("dynamic module loading is not allowed in the catalog source"),
  );

  const conditionalCreateRequireRun = runVerifier(createFixture(
    catalog() + '\nconst loadSelf = (process as any).getBuiltinModule("node:module")[true ? "createRequire" : "x"](import.meta.url);\nloadSelf("./stripe")["PRI" + "CES"].premium_month.lookup = "unexpected_paid_surface";\n',
  ));
  check(
    "an unknown conditional member cannot hide createRequire module acquisition",
    conditionalCreateRequireRun.status === 1 &&
      conditionalCreateRequireRun.output.includes("dynamic module loading is not allowed in the catalog source"),
  );

  const destructuredCreateRequireRun = runVerifier(createFixture(
    catalog() + '\nexport function hidden() { const { [`getBuiltin${"Module"}`]: getMod } = process; const { [`create${"Require"}`]: makeLoad } = getMod("node:module"); return makeLoad(import.meta.url)("./stripe"); }\n',
  ));
  check(
    "a computed destructuring binding cannot hide createRequire module acquisition",
    destructuredCreateRequireRun.status === 1 &&
      destructuredCreateRequireRun.output.includes("dynamic module loading is not allowed in the catalog source"),
  );

  const assignmentDestructuredCreateRequireRun = runVerifier(createFixture(
    catalog() + '\nexport function hidden() { let getMod, makeLoad; ({ [`getBuiltin${"Module"}`]: getMod } = process); ({ [`create${"Require"}`]: makeLoad } = getMod("node:module")); return makeLoad(import.meta.url)("./stripe"); }\n',
  ));
  check(
    "assignment destructuring cannot hide createRequire module acquisition",
    assignmentDestructuredCreateRequireRun.status === 1 &&
      assignmentDestructuredCreateRequireRun.output.includes("dynamic module loading is not allowed in the catalog source"),
  );

  const reflectedCreateRequireRun = runVerifier(createFixture(
    catalog() + '\nconst loadSelf = Reflect.get((process as any).getBuiltinModule("node:module"), "createRequire")(import.meta.url);\nloadSelf("./stripe")["PRI" + "CES"].premium_month.lookup = "unexpected_paid_surface";\n',
  ));
  check(
    "a reflective getter cannot hide createRequire module acquisition",
    reflectedCreateRequireRun.status === 1 &&
      reflectedCreateRequireRun.output.includes("dynamic module loading is not allowed in the catalog source"),
  );

  const parseDiagnosticRun = runVerifier(createFixture(catalog() + "\nconst = ;\n"));
  check(
    "TypeScript parse diagnostics fail the source-only catalog evidence",
    parseDiagnosticRun.status === 1 && parseDiagnosticRun.output.includes("TypeScript parse diagnostics"),
  );

  const extraPrefixPlan = PLAN.replace(
    '  if (lk.startsWith("gcl_agency_pro")) return "agency_pro";',
    '  if (lk.startsWith("unexpected_paid_surface")) return "premium";\n  if (lk.startsWith("gcl_agency_pro")) return "agency_pro";',
  );
  const extraPrefixRun = runVerifier(createFixture(catalog(ENTRIES, extraPrefixPlan)));
  check(
    "an extra paid lookup prefix fails the exact accepted mapping contract",
    extraPrefixRun.status === 1 && extraPrefixRun.output.includes("prefix rule set or order differs from the exact accepted contract"),
  );

  const planDollarDecoy = PLAN.replace("function planForPrice(", "function planForPrice$(");
  const defaultedUnsafePlan = String.raw`
export function planForPrice(price = { lookup_key: "gcl_premium_monthly", unit_amount: 9900 }) {
  return "premium";
}
`;
  const defaultedPlanDecoyRun = runVerifier(createFixture(catalog(
    ENTRIES,
    `${planDollarDecoy}\n${defaultedUnsafePlan}`,
  )));
  check(
    "a $-suffixed safe decoy cannot hide a defaulted unsafe planForPrice implementation",
    defaultedPlanDecoyRun.status === 1 &&
      defaultedPlanDecoyRun.output.includes("planForPrice must retain its exact top-level exported function signature"),
  );

  const extraAmountPlan = PLAN.replace(
    '  if (amt === AGENCY_PRICE_CENTS || amt === 399000) return "agency";',
    '  if (amt === 12345) return "premium";\n  if (amt === AGENCY_PRICE_CENTS || amt === 399000) return "agency";',
  );
  const extraAmountRun = runVerifier(createFixture(catalog(ENTRIES, extraAmountPlan)));
  check(
    "an extra paid amount fails the exact accepted mapping contract",
    extraAmountRun.status === 1 && extraAmountRun.output.includes("amount rule set differs from the exact accepted contract"),
  );

  const unmatchedExecutablePlan = PLAN.replace(
    "  const amt = price?.unit_amount ?? 0;",
    "  price = null;\n  const amt = price?.unit_amount ?? 0;",
  );
  const unmatchedExecutableRun = runVerifier(createFixture(catalog(ENTRIES, unmatchedExecutablePlan)));
  check(
    "unmatched executable syntax in planForPrice fails closed",
    unmatchedExecutableRun.status === 1 && unmatchedExecutableRun.output.includes("unmatched executable syntax"),
  );

  const intrinsicMutationRun = runVerifier(createFixture(
    catalog() + "\n(String.prototype as any).startsWith = () => true;\n",
  ));
  check(
    "top-level intrinsic mutation cannot rewrite planForPrice lookup semantics",
    intrinsicMutationRun.status === 1 &&
      intrinsicMutationRun.output.includes(PROTECTED_MUTATION_DIAGNOSTIC) &&
      !intrinsicMutationRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const bindingDefaultMutationRun = runVerifier(createFixture(
    catalog() + "\nconst { x = ((String.prototype as any).startsWith = () => true) } = {};\n",
  ));
  check(
    "a binding-pattern default cannot hide an executable top-level intrinsic mutation",
    bindingDefaultMutationRun.status === 1 &&
      bindingDefaultMutationRun.output.includes(PROTECTED_MUTATION_DIAGNOSTIC) &&
      !bindingDefaultMutationRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const declarationDecoy = 'const decoy = `export const PRICES = { fake: {} }; export function planForPrice() { return "premium"; }`;';
  const decoyRun = runVerifier(createFixture(`${declarationDecoy}\n${catalog()}`));
  check(
    "catalog and plan declarations inside template strings cannot replace executable source evidence",
    decoyRun.status === 2 && decoyRun.output.includes("stripe catalog exact entry count — 7 catalog entries parsed"),
  );

  const namespaceConstantDecoy = catalog().replace(
    "export const PREMIUM_PRICE_CENTS = 9900;",
    "namespace Evidence { export const PREMIUM_PRICE_CENTS = 9900; }\nconst PREMIUM_PRICE_CENTS = 1;\nexport { PREMIUM_PRICE_CENTS };",
  );
  const namespaceConstantDecoyRun = runVerifier(createFixture(namespaceConstantDecoy));
  check(
    "a nested namespace constant cannot replace the top-level exported constant identity",
    namespaceConstantDecoyRun.status === 1 &&
      namespaceConstantDecoyRun.output.includes("unresolved number token PREMIUM_PRICE_CENTS") &&
      !namespaceConstantDecoyRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const regexConstantDecoy = catalog().replace(
    "export const PREMIUM_PRICE_CENTS = 9900;",
    "export const PREMIUM_PRICE_CENTS: number = 1;\nconst evidence = /export const PREMIUM_PRICE_CENTS = 9900;/;",
  );
  const regexConstantDecoyRun = runVerifier(createFixture(regexConstantDecoy));
  check(
    "a regex-literal declaration decoy cannot override the bound top-level constant value",
    regexConstantDecoyRun.status === 1 &&
      regexConstantDecoyRun.output.includes("planForPrice amount rule set differs from the exact accepted contract") &&
      !regexConstantDecoyRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const wrongTaxFallbackRun = runVerifier(createFixture(catalog(
    ENTRIES,
    PLAN,
    CONSTANTS.replace('"txcd_10103000"', '"txcd_unapproved"'),
  )));
  check(
    "a product tax-code binding cannot change its approved fallback",
    wrongTaxFallbackRun.status === 1 &&
      wrongTaxFallbackRun.output.includes("TAX_CODE_SAAS_PERSONAL must retain its exact exported environment/fallback binding"),
  );

  const wrongTaxEnvironmentRun = runVerifier(createFixture(catalog(
    ENTRIES,
    PLAN,
    CONSTANTS.replace("STRIPE_TAX_CODE_SAAS_BUSINESS", "STRIPE_TAX_CODE_SAAS_PERSONAL"),
  )));
  check(
    "a product tax-code binding cannot read a different environment override",
    wrongTaxEnvironmentRun.status === 1 &&
      wrongTaxEnvironmentRun.output.includes("TAX_CODE_SAAS_BUSINESS must retain its exact exported environment/fallback binding"),
  );

  const dynamicEntries = ENTRIES.map((entry, index) => index === 0 ? entry.replace("PREMIUM_LOOKUP_KEY", "makeLookup()") : entry);
  const dynamicRun = runVerifier(createFixture(catalog(dynamicEntries)));
  check(
    "a dynamic lookup expression fails closed",
    dynamicRun.status === 1 && dynamicRun.output.includes("catalog-parser: unresolved string token makeLookup()"),
  );

  const blankRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, CONSTANTS.replace('"gcl_premium_monthly"', '""'))));
  check(
    "a blank resolved lookup fails at the parser boundary",
    blankRun.status === 1 && blankRun.output.includes("catalog-parser: blank lookup or product in premium_month"),
  );

  const unknownIntervalEntries = ENTRIES.map((entry, index) => index === 0 ? entry.replace('interval: "month"', 'interval: "week"') : entry);
  const unknownIntervalRun = runVerifier(createFixture(catalog(unknownIntervalEntries)));
  check(
    "an unknown recurrence value fails closed",
    unknownIntervalRun.status === 1 && unknownIntervalRun.output.includes("catalog-parser: unknown interval week"),
  );

  const duplicateConstants = CONSTANTS.replace(
    'AGENCY_LOOKUP_KEY = "gcl_agency_monthly"',
    'AGENCY_LOOKUP_KEY = "gcl_premium_monthly"',
  );
  const duplicateLookupRun = runVerifier(createFixture(catalog(ENTRIES, PLAN, duplicateConstants)));
  check(
    "duplicate resolved lookup keys fail closed",
    duplicateLookupRun.status === 1 && duplicateLookupRun.output.includes("stripe catalog keys are unique and nonblank") &&
      duplicateLookupRun.output.includes("── RELEASE RESULT: FAIL"),
  );

  const unsafeFallback = PLAN.replace("  return null;\n}", '  return "premium";\n}');
  const unsafeFallbackRun = runVerifier(createFixture(catalog(ENTRIES, unsafeFallback)));
  check(
    "a conditional null mention cannot hide a paid final fallback",
    unsafeFallbackRun.status === 1 && unsafeFallbackRun.output.includes("catalog-parser: planForPrice final fallthrough is not return null"),
  );

  const oneTimeMaps = PLAN.replace("  return null;", '  if (amt === LETTER_PACK_PRICE_CENTS) return "premium";\n  return null;');
  const oneTimeMapsRun = runVerifier(createFixture(catalog(ENTRIES, oneTimeMaps)));
  check(
    "a one-time letter amount that grants a paid plan fails closed",
    oneTimeMapsRun.status === 1 &&
      (oneTimeMapsRun.output.includes("one-time price gcl_letters_5 does not map to a plan") ||
        oneTimeMapsRun.output.includes("amount rule set differs from the exact accepted contract")),
  );

  const probed = runVerifier(accepted, { probe: true });
  check(
    "the safe probe fixture makes exactly seven local fake-transport calls",
    probed.calls.length === 7 && probed.calls.every((call) => call.startsWith("https://example.invalid/")),
  );
  check("404 passes only the public bootstrap containment check", /PASS\s+bootstrap unavailable outside development — HTTP 404/.test(probed.output));
  const migrateCall = probed.calls.find((call) => call.includes("/api/admin/migrate"));
  check(
    "the retired migration route is still probed with GET and no body",
    typeof migrateCall === "string" && !migrateCall.includes("-X POST") && !migrateCall.includes("-d {}"),
  );

  const staleMigrate = runVerifier(accepted, { probe: true, env: { CV_VERIFY_TEST_MIGRATE_CODE: "405" } });
  check(
    "a stale POST-only migration route hard-fails without invoking POST",
    staleMigrate.status === 1 && staleMigrate.output.includes("legacy admin migrate route absent — HTTP 405") &&
      staleMigrate.calls.some((call) => call.includes("/api/admin/migrate") && !call.includes("-X POST")),
  );

  const unreachable = runVerifier(accepted, { probe: true, env: { CV_VERIFY_TEST_BOOTSTRAP_CODE: "000" } });
  check(
    "an external no-response value stays verification-required rather than pass",
    unreachable.status === 2 && unreachable.output.includes("NOT RUN — ENVIRONMENT") &&
      unreachable.output.includes("── RELEASE RESULT: VERIFICATION_REQUIRED"),
  );

  const failedTransportWithPassText = runVerifier(accepted, {
    probe: true,
    env: { CV_VERIFY_TEST_BOOTSTRAP_CODE: "404", CV_VERIFY_TEST_BOOTSTRAP_EXIT: "7" },
  });
  check(
    "curl exit failure cannot be overridden by pass-looking HTTP text",
    failedTransportWithPassText.status === 2 && failedTransportWithPassText.output.includes("transport-error:7:404") &&
      !/PASS\s+bootstrap unavailable outside development — HTTP 404/.test(failedTransportWithPassText.output),
  );

  const summaryDir = join(testDir, "evidence");
  mkdirSync(summaryDir, { recursive: true });
  const summarized = runVerifier(accepted, { outputDir: summaryDir });
  const summary = readFileSync(join(summaryDir, "verify-production-summary.txt"), "utf8");
  check(
    "machine evidence records result, exit, exact custody, and catalog identity",
    summarized.status === 2 && includesAll(summary, [
      "result=VERIFICATION_REQUIRED", "offline_result=PASS_OFFLINE", "exit_code=2", "evidence_complete=1",
      `commit=${accepted.commit}`, `tree=${accepted.tree}`, "dirty=false",
      `final_commit=${accepted.commit}`, `final_tree=${accepted.tree}`, "final_dirty=false", "catalog_entry_count=7",
      "gcl_premium_monthly", "gcl_agency_monthly", "gcl_letters_5",
    ]),
  );

  const reusedEvidenceDir = join(testDir, "reused-evidence");
  mkdirSync(reusedEvidenceDir, { recursive: true });
  const reusedSummaryPath = join(reusedEvidenceDir, "verify-production-summary.txt");
  const reusedReportPath = join(reusedEvidenceDir, "verify-production-report.txt");
  writeFileSync(reusedSummaryPath, "evidence_complete=1\nold_summary_sentinel=1\n");
  writeFileSync(reusedReportPath, "old_report_sentinel=1\n");
  const partialEvidenceRename = runVerifier(accepted, {
    outputDir: reusedEvidenceDir,
    env: {
      CV_VERIFY_TEST_MV_FAIL_SUMMARY: "1",
    },
  });
  const partialSummary = existsSync(reusedSummaryPath) ? readFileSync(reusedSummaryPath, "utf8") : "";
  const partialReport = existsSync(reusedReportPath) ? readFileSync(reusedReportPath, "utf8") : "";
  check(
    "a reused complete marker is invalidated before a partial report/summary rename can mix evidence generations",
    partialEvidenceRename.status === 1 &&
      partialEvidenceRename.output.includes("verification evidence draft written") &&
      !/^evidence_complete=1$/m.test(partialSummary) &&
      !partialSummary.includes("old_summary_sentinel=1") &&
      !partialReport.includes("old_report_sentinel=1"),
  );

  const notDirectory = join(testDir, "evidence-not-directory");
  writeFileSync(notDirectory, "not a directory\n");
  const unusableOutput = runVerifier(accepted, { outputDir: notDirectory });
  check(
    "a requested evidence path that cannot be used hard-fails instead of leaving a successful status",
    unusableOutput.status === 1 &&
      unusableOutput.output.includes("verification evidence output is usable") &&
      unusableOutput.output.includes("── RELEASE RESULT: FAIL"),
  );
} finally {
  rmSync(testDir, { recursive: true, force: true });
}

console.log(`\nverify-production.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
