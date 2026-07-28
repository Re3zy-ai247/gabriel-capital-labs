// Run: npx tsx scripts/disabled-cancellation-scope.test.ts
//
// SOURCE-LEVEL companion to scripts/disabled-cancellation-runtime.test.ts. These
// are the invariants that cannot be proven by executing the handler — the ABSENCE
// of capability, the shape of the helper, and the existence of a surface a
// suspended user can actually reach. Behaviour is proven in the runtime guard;
// nothing here should be read as runtime evidence.
//
// The load-bearing premise this file locks down: there is NO Stripe Billing Portal
// *configuration* in this repository. Owner policy says that if cancellation-only
// cannot be PROVEN from repository truth, a disabled user must not be handed a
// portal session. The moment someone adds a configuration, the premise changes and
// this guard should fail loudly so the decision gets re-made deliberately.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const readRaw = (rel: string) => readFileSync(join(root, rel), "utf8");

// Absence assertions ("this file never calls X") must run against CODE, not prose.
// These files are heavily commented precisely because the security reasoning has to
// travel with them, and those comments name the very primitives being excluded
// ("does not open a Billing Portal session"). Strip comments first, or the guard
// fails on its own documentation. `//` is only treated as a comment when it is not
// preceded by `:`, so URLs inside string literals survive.
function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const read = (rel: string) => strip(readRaw(rel));

const ROUTE = "app/api/billing/self-cancel/route.ts";
const PAGE = "app/billing/cancel/page.tsx";
const route = read(ROUTE);
const page = read(PAGE);
const sessionLib = read("lib/session.ts");
check("the comment stripper actually removes commentary", !/Billing Portal \*configuration\*/.test(route));
check("the comment stripper keeps the code", /stripe\.subscriptions\.update\(/.test(route));

// ── The premise: no repository-controlled Billing Portal configuration ───────
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(root, dir))) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(rel)) out.push(rel);
  }
  return out;
}
const sourceFiles = [...walk("app"), ...walk("lib"), ...walk("scripts")];
const portalRefs = sourceFiles.filter((f) => /billingPortal/.test(read(f)) && !/\.test\.ts$/.test(f));
check("the scan sees through comments (self-cancel only mentions the portal in prose)",
  !portalRefs.includes(ROUTE));
check("the source tree was actually scanned", sourceFiles.length > 100);
check("app/api/stripe/portal/route.ts is still the ONLY billingPortal caller",
  portalRefs.length === 1 && portalRefs[0] === "app/api/stripe/portal/route.ts");
check("no Billing Portal configuration object is defined anywhere in the repo",
  !sourceFiles.some((f) => /billingPortal\s*\.\s*configurations/.test(read(f))));
const portalSrc = read("app/api/stripe/portal/route.ts");
const createCall = portalSrc.slice(portalSrc.indexOf("billingPortal.sessions.create"), portalSrc.indexOf("return NextResponse.json({ url"));
check("the portal session is created with NO `configuration` parameter",
  createCall.length > 0 && !/configuration/.test(createCall));
// Therefore: an unrestricted portal must never be the disabled user's remedy.
check("the cancellation path does not open a Billing Portal session",
  !/billingPortal/.test(route));

// ── The helper does less, not more ───────────────────────────────────────────
const helper = sessionLib.slice(sessionLib.indexOf("export async function sessionAccountState"));
const helperBody = helper.slice(0, helper.indexOf("\n}") + 2);
check("lib/session.ts exports sessionAccountState", /export async function sessionAccountState\(/.test(sessionLib));
check("sessionAccountState resolves the row by immutable id",
  /findUnique\(\{\s*where:\s*\{\s*id\s*\}\s*\}\)/.test(helperBody));
check("sessionAccountState never looks a user up by email",
  !/where:\s*\{\s*email/.test(helperBody));
check("sessionAccountState reads NO cookie", !/cookies\(\)/.test(helperBody));
check("sessionAccountState mentions neither the workspace nor the impersonation cookie",
  !/WORKSPACE_COOKIE|IMPERSONATE_COOKIE/.test(helperBody));
check("sessionAccountState grants nothing — it only reports state",
  !/prisma\.user\.update|\.update\(/.test(helperBody));
check("a session id with no row reads as anonymous, not disabled",
  /if \(!account\) return \{ state: "anonymous"/.test(helperBody));

// The two existing resolvers must keep their fail-closed behaviour untouched.
const accountFn = sessionLib.slice(
  sessionLib.indexOf("export async function currentAccount"),
  sessionLib.indexOf("export async function currentUser"),
);
check("currentAccount() still fails closed on `disabled`",
  /if \(account\?\.disabled\) return null;/.test(accountFn));
check("currentAccount() still resolves by id",
  /findUnique\(\{\s*where:\s*\{\s*id\s*\}\s*\}\)/.test(accountFn));
check("currentUser() still routes through currentAccount()",
  /export async function currentUser\(\)\s*\{\s*const account = await currentAccount\(\);/.test(sessionLib));
// The new helper must not have been slipped in between them, where it would sit
// inside the slice that scripts/billing-identity.test.ts asserts over.
check("the new helper is declared outside the currentAccount block",
  !/sessionAccountState/.test(accountFn));

// ── The route has no capability beyond cancelling ────────────────────────────
check(`${ROUTE} imports sessionAccountState, not currentAccount/currentUser`,
  /import \{ sessionAccountState \} from "@\/lib\/session"/.test(route)
  && !/\bcurrentUser\b/.test(route) && !/await currentAccount\(/.test(route));
for (const forbidden of [
  "checkout.sessions.create", "subscriptions.create", "prices.create", "customers.create",
  "subscriptions.cancel", "paymentIntents", "invoices.create",
]) {
  check(`${ROUTE} never calls ${forbidden}`, !route.includes(forbidden));
}
check(`${ROUTE} issues exactly one mutating Stripe call`,
  (route.match(/stripe\.subscriptions\.update\(/g) ?? []).length === 1);
check(`${ROUTE} only ever schedules cancel_at_period_end`,
  /subscriptions\.update\(subscriptionId, \{ cancel_at_period_end: true \}\)/.test(route));
check(`${ROUTE} touches the database only through the audit log`,
  !/prisma\./.test(route) && !/from "@\/lib\/prisma"/.test(route));
check(`${ROUTE} cannot re-enable the account`,
  !/disabled\s*[:=]\s*false/.test(route) && !/user\.update/.test(route));
check(`${ROUTE} does not change plan, role or entitlements`,
  !/plan\s*:\s*["']/.test(route) && !/role\s*:\s*["']/.test(route));

// No identifier may enter from the request — that is what makes cross-account
// cancellation structurally impossible rather than merely validated.
check(`${ROUTE} reads no request body`, !/req\.json\(\)/.test(route) && !/request\.json\(\)/.test(route));
check(`${ROUTE} takes no request parameter on POST`, /export async function POST\(\)/.test(route));
check(`${ROUTE} reads no query parameters`, !/searchParams/.test(route));
check(`${ROUTE} uses only the ids stored on the caller's own row`,
  /account\.stripeCustomerId/.test(route) && /account\.stripeSubscriptionId/.test(route));

// ── Refusals, ownership, idempotency and leak-safety are structurally present ─
check(`${ROUTE} refuses an ENABLED account`, /state === "enabled"/.test(route) && /status: 403/.test(route));
check(`${ROUTE} verifies the subscription belongs to the caller's customer`,
  /owner !== customerId/.test(route));
check(`${ROUTE} short-circuits an already-cancelled subscription`,
  /alreadyGone \|\| alreadyScheduled/.test(route));
check(`${ROUTE} never returns the Stripe error message`,
  !/e instanceof Error \? e\.message/.test(route) && !/error:\s*msg/.test(route));
check(`${ROUTE} never returns a stack`, !/e\.stack/.test(route));
check(`${ROUTE} audits through the shared convention`,
  /import \{ logAudit \} from "@\/lib\/admin"/.test(route) && /action: "billing\.self_cancel"/.test(route));
check(`${ROUTE} rate-limits with the shared limiter, keyed by user id`,
  /enforceRateLimit\(`billing:self-cancel:\$\{account\.id\}`/.test(route));
// The limit must be applied before any Stripe work, and after identity is known.
const idAt = route.indexOf("await sessionAccountState()");
const rlAt = route.indexOf("enforceRateLimit(");
const stripeAt = route.indexOf("stripe.subscriptions.retrieve");
check(`${ROUTE} rate-limits after identity and before Stripe`,
  idAt > -1 && rlAt > idAt && stripeAt > rlAt);

// ── The remedy is REACHABLE, and restores nothing ────────────────────────────
// Every ordinary page resolves through currentUser()/currentAccount() and bounces a
// disabled user to /login, so the surface must be standalone or it does not exist
// in practice.
check("a cancellation page exists at /billing/cancel", existsSync(join(root, PAGE)));
check("the page calls the cancellation route", /\/api\/billing\/self-cancel/.test(page));
check("the page renders standalone — no AppShell to bounce a disabled user",
  !/AppShell/.test(page));
check("the page performs no server-side session gate that would redirect",
  !/redirect\(/.test(page) && !/currentUser\(|currentAccount\(/.test(page));
check("the page is not nested under a layout that gates access",
  !existsSync(join(root, "app/billing/layout.tsx")));
check("the page restores no application access — it links nowhere into the app",
  !/href="\/(dashboard|letters|settings|billing)/.test(page) && !/from "next\/link"/.test(page));
check("the page offers no upgrade or purchase action",
  !/upgrade/i.test(page) && !/checkout/i.test(page) && !/\/api\/stripe\//.test(page));
check("the page tells the user cancelling does not restore access",
  /does not restore access/i.test(page));
check("a dropped request is never reported as a completed cancellation",
  /Nothing was changed/.test(page));

// The middleware must not start redirecting this path away.
const middleware = read("middleware.ts");
check("middleware still only matches the landing page, so /billing/cancel is reachable",
  /matcher:\s*\["\/"\]/.test(middleware));

console.log(`\ndisabled-cancellation-scope.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
