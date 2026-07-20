// Run: npx tsx scripts/checkout-guard.test.ts
//
// Guards the subscription checkout path: upgrades must MODIFY the subscription the
// customer already has, and must never open a second one.
//
// THE DEFECT (found 2026-07-20): app/api/stripe/checkout/route.ts blocked buying the
// SAME or a LOWER plan, but an UPGRADE passed that check and then created a second
// `mode: "subscription"` Checkout Session for the same customer. Nothing cancelled or
// prorated the first, and the app had no customer-facing `subscriptions.update` path
// at all (the only one is an ADMIN cancel route). A Professional subscriber ($99/mo)
// who bought Agency ($399/mo) was left paying BOTH — $498/mo.
//
// THE CONTRACT NOW:
//   0 active subscriptions  -> create a Checkout Session (first purchase)
//   1 active subscription   -> stripe.subscriptions.update in place, prorated
//   >1 active subscription  -> 409, never guess which one to mutate
//   multi-item subscription -> 409, never swap a price on a shape we didn't create
//   already on that price   -> 400
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

// ── The existing-subscription lookup gates everything ────────────────────────
const listAt = route.indexOf("stripe.subscriptions.list");
const updateAt = route.indexOf("stripe.subscriptions.update");
const subSessionAt = route.indexOf('mode: "subscription"');

check("checkout looks up existing subscriptions", listAt > -1);
check("lookup happens BEFORE any subscription session is created",
  listAt > -1 && subSessionAt > -1 && listAt < subSessionAt);
check("lookup happens BEFORE the in-place update", listAt > -1 && updateAt > -1 && listAt < updateAt);

// ── An upgrade MODIFIES the existing subscription ────────────────────────────
check("an upgrade calls subscriptions.update (does not open a second one)", updateAt > -1);
check("the update swaps the price on the existing item",
  /items:\s*\[\{\s*id:\s*items\[0\]\.id,\s*price:\s*priceId\s*\}\]/.test(route));
check("the update is prorated", /proration_behavior:\s*UPGRADE_PRORATION_BEHAVIOR/.test(route));
check("proration policy is a named constant, not a buried literal",
  /const UPGRADE_PRORATION_BEHAVIOR = "create_prorations"/.test(route));
check("the in-place update runs BEFORE the new-subscription session",
  updateAt > -1 && subSessionAt > -1 && updateAt < subSessionAt);

// ── Ambiguity is refused, never guessed ──────────────────────────────────────
check("more than one active subscription returns 409", /billing\.length > 1/.test(route) && /status: 409/.test(route));
check("a multi-item subscription is refused rather than price-swapped",
  /items\.length !== 1/.test(route));
check("already-on-this-price returns 400", /already on this plan/i.test(route));

// ── Entitlements stay single-writer ──────────────────────────────────────────
// The webhook owns plan state. If this route also wrote it, a retry or a webhook
// re-delivery could disagree about what the customer is entitled to.
const upgradeBlock = route.slice(updateAt, subSessionAt > updateAt ? subSessionAt : undefined);
check("the upgrade path does not write plan/entitlements directly",
  !/prisma\.user\.update/.test(upgradeBlock));
check("the upgrade path defers to the webhook as source of truth",
  /webhook is the single source of truth|customer\.subscription\.updated/.test(route));

// ── Canonical billing states, not an ad-hoc list ─────────────────────────────
check("filters on the canonical ACTIVE_SUBSCRIPTION_STATES", /ACTIVE_SUBSCRIPTION_STATES/.test(route));
check("no second hardcoded status list is minted",
  !/\[\s*"active"\s*,\s*"trialing"\s*,\s*"past_due"\s*\]/.test(route));
// past_due still bills, so it must count as an existing subscription.
check("past_due counts as an existing subscription", ACTIVE_SUBSCRIPTION_STATES.has("past_due"));
check("trialing counts as an existing subscription", ACTIVE_SUBSCRIPTION_STATES.has("trialing"));
check("active counts as an existing subscription", ACTIVE_SUBSCRIPTION_STATES.has("active"));
check("canceled does not block a new purchase", !ACTIVE_SUBSCRIPTION_STATES.has("canceled"));
check("incomplete_expired does not block a new purchase", !ACTIVE_SUBSCRIPTION_STATES.has("incomplete_expired"));

// ── The pre-existing same-or-better-plan block must remain ───────────────────
check("same-or-better-plan block still present", /tier\(user\.plan\) >= tier\(plan\)/.test(route));

console.log(`\ncheckout-guard.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
