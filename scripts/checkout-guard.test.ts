// Run: npx tsx scripts/checkout-guard.test.ts
//
// Guards the subscription checkout path against double-billing.
//
// THE DEFECT (found 2026-07-20): app/api/stripe/checkout/route.ts blocked buying
// the SAME or a LOWER plan, but an UPGRADE passed that check and then created a
// second `mode: "subscription"` Checkout Session for the same customer. Nothing in
// the route cancels or prorates the existing subscription, and the app has no
// customer-facing `subscriptions.update` path at all (the only one is an ADMIN
// cancel route). A Professional subscriber ($99/mo) who bought Agency ($399/mo)
// was therefore left paying BOTH — $498/mo.
//
// THE RULE: this route creates FIRST subscriptions only. Anyone who already has a
// billing-state subscription is sent to the portal, which prorates.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACTIVE_SUBSCRIPTION_STATES } from "../lib/os/host/billingTier";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const route = readFileSync(join(root, "app/api/stripe/checkout/route.ts"), "utf8");

// ── The guard exists and runs BEFORE any session is created ──────────────────
const listAt = route.indexOf("stripe.subscriptions.list");
const subSessionAt = route.indexOf('mode: "subscription"');
check("checkout queries existing subscriptions", listAt > -1);
check("the guard runs BEFORE the subscription session is created", listAt > -1 && subSessionAt > -1 && listAt < subSessionAt);
check("guard refuses with 409 rather than creating a second subscription", /status: 409/.test(route));
check("refusal points the user at the billing portal", /portal/.test(route));

// ── It must filter on the CANONICAL billing states, not an ad-hoc list ───────
check("guard uses the canonical ACTIVE_SUBSCRIPTION_STATES", /ACTIVE_SUBSCRIPTION_STATES/.test(route));
check("no second hardcoded status list is minted",
  !/\[\s*"active"\s*,\s*"trialing"\s*,\s*"past_due"\s*\]/.test(route));
// past_due still bills, so it must count as an existing subscription — a user in
// Stripe's grace window must not be able to open a second one.
check("past_due counts as an existing subscription", ACTIVE_SUBSCRIPTION_STATES.has("past_due"));
check("trialing counts as an existing subscription", ACTIVE_SUBSCRIPTION_STATES.has("trialing"));
check("active counts as an existing subscription", ACTIVE_SUBSCRIPTION_STATES.has("active"));
// Cancelled/incomplete subscriptions must NOT block a genuine new purchase.
check("canceled does not block a new purchase", !ACTIVE_SUBSCRIPTION_STATES.has("canceled"));
check("incomplete_expired does not block a new purchase", !ACTIVE_SUBSCRIPTION_STATES.has("incomplete_expired"));

// ── The route still must not attempt an un-prorated plan swap itself ─────────
check("route performs no subscription mutation (proration belongs to the portal)",
  !/stripe\.subscriptions\.update/.test(route));

// ── The pre-existing same-or-lower-tier block must remain ────────────────────
check("same-or-better-plan block still present", /tier\(user\.plan\) >= tier\(plan\)/.test(route));

console.log(`\ncheckout-guard.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
