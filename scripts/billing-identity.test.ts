// Run: npx tsx scripts/billing-identity.test.ts
//
// Guards WHO a billing route acts for, and WHAT it is allowed to sell.
//
// THE DEFECT (B-03, found in the RC1 audit): every route under app/api/billing/
// and app/api/stripe/ resolved the account with
//   getServerSession -> session.user.email -> prisma.user.findUnique({ where: { email } })
// but email is USER-MUTABLE (app/api/profile/route.ts changes it, and says so:
// "sessions resolve by user id, so a change does not log the user out").
// Two consequences on LIVE billing:
//   1. A subscriber who changed their email carried a JWT holding the OLD address.
//      The lookup returned null and /api/stripe/portal answered 400 — they could no
//      longer reach Stripe to CANCEL.
//   2. If the released address was later registered by someone else, the stale JWT
//      resolved to THAT person's row and minted a Billing Portal session against a
//      stranger's stripeCustomerId. lib/auth.ts uses a JWT session with no maxAge,
//      so NextAuth's 30-day default bounds the window.
//
// THE CONTRACT NOW: billing identity comes from currentAccount() (lib/session.ts),
// which resolves prisma.user.findUnique({ where: { id } }) and re-checks `disabled`
// fail-closed. currentAccount() — NOT currentUser() — is the correct helper for a
// billing surface: it never follows the agency workspace or admin impersonation
// cookie, so nobody can operate someone else's billing under a "view as" context.
//
// THE SECOND DEFECT (B-02): the subscription branch coerced ANY unrecognized
// body.plan to "premium" instead of refusing it. A client posting plan:"agency_pro"
// (marketed at $699 on /pricing) was charged $99 and provisioned Professional, with
// no error. Unknown plans are a 400 now; only PURCHASABLE_PLANS may be sold.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

// Every route file under the two billing trees, discovered rather than listed, so
// a NEW billing route cannot be added outside this guard's reach.
function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...routeFiles(rel));
    else if (rel.endsWith(".ts") || rel.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

const BILLING_TREE = [...routeFiles("app/api/billing"), ...routeFiles("app/api/stripe")];

// The three routes that resolve a signed-in account (the webhook authenticates by
// Stripe signature instead, so it has no session identity to get wrong).
const IDENTITY_ROUTES = [
  "app/api/billing/status/route.ts",
  "app/api/stripe/portal/route.ts",
  "app/api/stripe/checkout/route.ts",
];

// ── No billing route resolves a user by email ────────────────────────────────
check("the billing + stripe route trees were discovered", BILLING_TREE.length >= 4);
for (const rel of IDENTITY_ROUTES) {
  check(`${rel} is present in the discovered tree`, BILLING_TREE.includes(rel));
}

for (const rel of BILLING_TREE) {
  const src = read(rel);
  check(`${rel} does not read identity off the session email`,
    !/session\s*\??\.\s*user\s*\??\.\s*email/.test(src));
  check(`${rel} does not look a user up by email`,
    !/findUnique\(\s*\{\s*where:\s*\{\s*email/.test(src) && !/findFirst\(\s*\{\s*where:\s*\{\s*email/.test(src));
}

// ── They resolve by id, through the one correct helper ───────────────────────
for (const rel of IDENTITY_ROUTES) {
  const src = read(rel);
  check(`${rel} imports currentAccount from lib/session`,
    /import\s*\{[^}]*\bcurrentAccount\b[^}]*\}\s*from\s*["']@\/lib\/session["']/.test(src));
  check(`${rel} resolves the account through currentAccount()`, /await currentAccount\(\)/.test(src));
  // currentUser()/currentUserOrDemo() follow the agency workspace + admin
  // impersonation cookies. On a billing surface that would let one account operate
  // another's subscription and card; the payer must be the signed-in account.
  check(`${rel} does not bill the impersonated/workspace subject`,
    !/await currentUser(OrDemo)?\(/.test(src)
    && !/import\s*\{[^}]*\bcurrentUser(OrDemo)?\b[^}]*\}\s*from\s*["']@\/lib\/session["']/.test(src));
}

// ── The helper itself still keeps its half of the contract ───────────────────
const sessionLib = read("lib/session.ts");
const accountFn = sessionLib.slice(
  sessionLib.indexOf("export async function currentAccount"),
  sessionLib.indexOf("export async function currentUser"),
);
check("currentAccount() resolves the row by id",
  /findUnique\(\{\s*where:\s*\{\s*id\s*\}\s*\}\)/.test(accountFn));
check("currentAccount() re-checks `disabled` fail-closed", /account\?\.disabled/.test(accountFn));

// ── Per-route status codes were preserved, not homogenised ───────────────────
const status = read("app/api/billing/status/route.ts");
const portal = read("app/api/stripe/portal/route.ts");
const checkout = read("app/api/stripe/checkout/route.ts");

check("billing/status keeps 401 unauthorized + 404 not found",
  /"Unauthorized"[\s\S]{0,40}status: 401/.test(status) && /"Not found"[\s\S]{0,40}status: 404/.test(status));
// RC1-S6a: the 400's COPY changed (it used to end "Start with the Upgrade
// button." — a pitch for a product that now answers 410 Gone). The status codes,
// which are what this check guards, are unchanged.
check("stripe/portal keeps 401 sign-in + 400 no-subscription",
  /Please sign in first\.[\s\S]{0,40}status: 401/.test(portal) &&
  /No subscription is associated with this account\.[\s\S]{0,120}status: 400/.test(portal) &&
  !/Upgrade button/.test(portal));
check("stripe/checkout keeps 401 sign-in + 404 account-not-found",
  /Please sign in first\.[\s\S]{0,40}status: 401/.test(checkout) && /Account not found\.[\s\S]{0,40}status: 404/.test(checkout));

// ── Checkout sells only what it is allowed to sell (B-02) ────────────────────
// The tier vocabulary is asserted literally here rather than imported, so a silent
// widening of the sellable set has to be made deliberately in BOTH places.
// RC1-S6a (Founder D-3 / D-4): the sellable set is now EMPTY. The constant stays
// named and in one reviewable place — that is what makes re-opening a sale a
// deliberate, visible edit — but it sells nothing.
check("checkout declares the purchasable set as a named constant, and it is empty",
  /const PURCHASABLE_PLANS = \[\] as const;/.test(checkout));
check("agency_pro is NOT purchasable while /pricing calls it Coming soon",
  !/PURCHASABLE_PLANS = \[[^\]]*agency_pro/.test(checkout));
check("the plan is validated by a type guard over that set",
  /function isPurchasablePlan\(/.test(checkout) && /isPurchasablePlan\(requestedPlan\)/.test(checkout));

// The refusal must sit BETWEEN reading the requested plan and binding the typed one,
// so no default can reach Stripe without passing the validator.
const planBlock = checkout.slice(
  checkout.indexOf("const requestedPlan"),
  checkout.indexOf("const plan: PaidPlan"),
);
check("an unrecognized plan is refused with 400 before the typed plan is bound",
  planBlock.length > 0 && /isPurchasablePlan\(requestedPlan\)/.test(planBlock) && /status: 400/.test(planBlock));
check("agency_pro is refused honestly, not silently downgraded",
  /isn't available for purchase yet/.test(checkout));
check("no unconditional coercion of an unrecognized plan survives",
  !/includes\(\s*body\.plan\s*\)/.test(checkout));

// The refusal has to happen before anything is priced, listed or created.
const guardAt = checkout.indexOf("isPurchasablePlan(requestedPlan)");
const priceAt = checkout.indexOf("resolvePriceId(");
const listAt = checkout.indexOf("stripe.subscriptions.list");
const subSessionAt = checkout.indexOf('mode: "subscription"');
check("plan validation precedes price resolution", guardAt > -1 && priceAt > -1 && guardAt < priceAt);
check("plan validation precedes the subscription lookup", guardAt > -1 && listAt > -1 && guardAt < listAt);
check("plan validation precedes any subscription session", guardAt > -1 && subSessionAt > -1 && guardAt < subSessionAt);
check("Stripe is priced from the validated plan, never the raw body",
  /resolvePriceId\(stripe, plan, interval\)/.test(checkout) && !/resolvePriceId\([^)]*body\.plan/.test(checkout));

// ── B-06 stays visible where it bites (no-schema portion) ────────────────────
// The in-place upgrade never opens Checkout, so Stripe collects no Terms-of-Service
// acceptance there. Closing it needs a durable consent column (MIGRATION-FIRST, a
// separate owner-approved release); until then the gap must be marked at the call
// site rather than silently inherited from the Checkout-only spread above.
const updateAt = checkout.indexOf("stripe.subscriptions.update");
const gapAt = checkout.indexOf("B-06");
check("the upgrade path documents the consent gap with its blocker id",
  gapAt > -1 && updateAt > -1 && gapAt < updateAt);

console.log(`\nbilling-identity.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
