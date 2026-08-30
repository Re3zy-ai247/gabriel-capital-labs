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
      reflectSetRun.output.includes("dynamic evaluation through a global or computed runtime capability is not allowed"),
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
      reflectedConstructorGadgetRun.output.includes("dynamic evaluation through a global or computed runtime capability is not allowed"),
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
      intrinsicMutationRun.output.includes("catalog source contains unmatched top-level executable syntax") &&
      !intrinsicMutationRun.output.includes("catalog ↔ planForPrice mapping is consistent"),
  );

  const bindingDefaultMutationRun = runVerifier(createFixture(
    catalog() + "\nconst { x = ((String.prototype as any).startsWith = () => true) } = {};\n",
  ));
  check(
    "a binding-pattern default cannot hide an executable top-level intrinsic mutation",
    bindingDefaultMutationRun.status === 1 &&
      bindingDefaultMutationRun.output.includes("catalog source contains an executable top-level variable initializer") &&
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
