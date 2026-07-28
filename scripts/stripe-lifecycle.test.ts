// Run: npx tsx scripts/stripe-lifecycle.test.ts
//
// Guards the Stripe subscription lifecycle: the webhook is the single writer of
// entitlements, and everything it writes must survive Stripe's actual delivery
// semantics rather than the ones we wish it had.
//
// THE DEFECTS (found in the RC1 audit, 2026-07-28):
//
//   B-04  Stripe guarantees AT-LEAST-ONCE, NOT in-order delivery. The handler
//         passed `event.data.object` — a snapshot taken when the event was
//         CREATED — straight into syncSubscriptionToUser, and nothing deduped the
//         event id. A reordered or redelivered `customer.subscription.updated`
//         landing after `customer.subscription.deleted` RESTORED a revoked plan;
//         the reverse REVOKED a paying customer. The StripeWebhookEvent ledger
//         already existed but was wired only into creditLetters.
//   B-04c invoice.payment_failed stamped subscriptionStatus="past_due" with no
//         check that the invoice belonged to a subscription at all, so a failed
//         $19 one-time letter-pack invoice flipped a healthy subscriber past_due.
//   B-02b planForPrice fell back to "premium" for any unrecognized price — an
//         imported, hand-created or legacy price silently provisioned a PAID tier.
//   B-04d lib/billing.ts hardcoded ["active","trialing","past_due"] instead of the
//         canonical ACTIVE_SUBSCRIPTION_STATES that lib/entitlements.ts reads —
//         two sources of truth for "is this customer paying?", and the copy that
//         drifted was the one that writes money.
//   B-04e getOrCreateStripeCustomer's bare `catch {}` treated a transient 429/500
//         exactly like a deleted customer and created a SECOND Stripe customer.
//   B-04f new Stripe(key) with no apiVersion — an npm ci against a bumped
//         lockfile could shift live response shapes under billing.
//   B-10b The money path failed silently: no matching User → bare return + 200, and
//         the missing-signing-key 503 emitted nothing at all.
//
// THE CONTRACT NOW:
//   claim the event id  -> handle       (redelivery is acknowledged, not re-run)
//   handler threw       -> release      (so Stripe's retry is not deduped away)
//   subscription event  -> re-retrieve  (act on CURRENT state; ordering is moot)
//   unknown price       -> null         (never guess a paid tier)
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
const read = (p: string) => readFileSync(join(root, p), "utf8");
const webhook = read("app/api/stripe/webhook/route.ts");
const billing = read("lib/billing.ts");
const stripeLib = read("lib/stripe.ts");

// ── B-04a · every handled event is deduped BEFORE it is handled ──────────────
const claimAt = webhook.indexOf("claimStripeEvent(");
const switchAt = webhook.indexOf("switch (event.type)");
check("webhook claims the event id in the dedup ledger", claimAt > -1);
check("the claim happens BEFORE the handler switch", claimAt > -1 && switchAt > -1 && claimAt < switchAt);
check("the claim is keyed on the Stripe event id", /claimStripeEvent\(event\.id/.test(webhook));
check("a redelivery returns 200 without re-handling",
  /if \(!firstDelivery\) return NextResponse\.json\(\{ received: true/.test(webhook));
check("a ledger failure returns non-2xx so Stripe retries (never handled undeduped)",
  /phase: "dedupe"[\s\S]{0,200}status: 500/.test(webhook));

// The ledger claim must be given back when handling FAILS, or the 500 tells Stripe
// to retry and the retry is deduped into oblivion — losing the event permanently.
check("a failed handler releases the claim so the retry can run",
  /releaseStripeEvent\(event\.id\)/.test(webhook));
const releaseAt = webhook.indexOf("releaseStripeEvent(event.id)");
const handlerCatchAt = webhook.indexOf('phase: "handler"');
check("the release lives in the handler catch, not the success path",
  releaseAt > -1 && handlerCatchAt > -1 && releaseAt > handlerCatchAt);

// ── B-04a · the ledger is the EXISTING legacy table, not new schema ──────────
check("dedup reuses the existing StripeWebhookEvent ledger",
  /INSERT INTO "StripeWebhookEvent"/.test(billing));
check("dedup uses INSERT ... ON CONFLICT DO NOTHING (atomic claim)",
  /ON CONFLICT \("id"\) DO NOTHING/.test(billing));
check("no NEW table is created for dedup",
  (billing.match(/CREATE TABLE IF NOT EXISTS "([A-Za-z]+)"/g) || []).every((s) => s.includes("StripeWebhookEvent")));
// The top-level claim takes the bare event id, so the letter-pack grant must key
// its own row differently or the second claim no-ops and the credit is skipped.
check("the letter-pack grant keys its ledger row separately from the event claim",
  /`\$\{eventId\}:letters_5`/.test(billing));

// ── B-04b · subscription handlers act on CURRENT state, not the payload ──────
const subCaseAt = webhook.indexOf('case "customer.subscription.deleted"');
const subCaseEnd = webhook.indexOf('case "invoice.payment_succeeded"');
const subCase = subCaseAt > -1 && subCaseEnd > subCaseAt ? webhook.slice(subCaseAt, subCaseEnd) : "";
check("the subscription case block was located (the check is not vacuous)", subCase.length > 0);
check("subscription events re-retrieve the subscription from Stripe",
  /stripe\.subscriptions\.retrieve\(/.test(subCase));
check("the stale event payload is NOT handed to the sync",
  !/syncSubscriptionToUser\(event\.data\.object/.test(webhook));
const retrieveAt = subCase.indexOf("stripe.subscriptions.retrieve(");
const syncAt = subCase.indexOf("syncSubscriptionToUser(");
check("the retrieve precedes the sync", retrieveAt > -1 && syncAt > -1 && retrieveAt < syncAt);
check("all three subscription lifecycle events go through the same path",
  /case "customer\.subscription\.created":\s*\n\s*case "customer\.subscription\.updated":\s*\n\s*case "customer\.subscription\.deleted":/.test(webhook));

// ── B-04c · past_due is gated on a SUBSCRIPTION invoice ──────────────────────
const failedAt = webhook.indexOf('case "invoice.payment_failed"');
const failedBlock = failedAt > -1 ? webhook.slice(failedAt) : "";
check("the payment_failed case block was located (the check is not vacuous)", failedBlock.length > 0);
check("payment_failed resolves the invoice's subscription", /failedSubId/.test(failedBlock));
check("no subscription on the invoice → no status write at all",
  /if \(!failedSubId\) break;/.test(failedBlock));
const gateAt = failedBlock.indexOf("if (!failedSubId) break;");
const pastDueAt = failedBlock.indexOf('subscriptionStatus: "past_due"');
check("the gate precedes the past_due write", gateAt > -1 && pastDueAt > -1 && gateAt < pastDueAt);
check("past_due is written exactly once in the route (no ungated second writer)",
  (webhook.match(/subscriptionStatus: "past_due"/g) || []).length === 1);

// The gate above is only correct if the subscription id is resolved from BOTH
// Stripe payload shapes. Stripe moved the field in API version 2025-03-31.basil
// (top-level `invoice.subscription` → `invoice.parent.subscription_details`), and
// which one arrives depends on the API version pinned on the WEBHOOK ENDPOINT, not
// on the SDK's outbound pin. Reading only the legacy shape made the gate fire on
// every invoice under a modern endpoint, so past_due was never written at all —
// dunning silently stopped working. Reading only the modern shape breaks a
// legacy-pinned endpoint the same way. Both must be read.
const resolver = webhook.slice(webhook.indexOf("function invoiceSubscriptionId"));
const resolverBody = resolver.slice(0, resolver.indexOf("\n}\n") + 2);
check("an invoice→subscription resolver exists (the check is not vacuous)", resolverBody.length > 0);
check("the resolver reads the LEGACY top-level invoice.subscription shape",
  /\bsubscription\?: string \| \{ id: string \} \| null\b/.test(resolverBody));
// Trailing (?![A-Za-z_]) matters: without it `…?.subscriptionXX` still contains
// the literal as a substring and the assertion can never fail.
check("the resolver reads the MODERN parent.subscription_details shape",
  /parent\?\.subscription_details\?\.subscription(?![A-Za-z_])/.test(resolverBody));
check("both invoice cases resolve through the shared resolver (no open-coded read)",
  (webhook.match(/invoiceSubscriptionId\(inv\)/g) || []).length === 2);
check("no invoice case open-codes a bare `inv.subscription` read anymore",
  !/\binv\s*(as[^)]*\))?\s*\.subscription\b/.test(webhook.slice(webhook.indexOf('case "invoice.'))));

// ── B-02b · planForPrice fails CLOSED ────────────────────────────────────────
const planFn = stripeLib.slice(stripeLib.indexOf("export function planForPrice"));
const planBody = planFn.slice(0, planFn.indexOf("\n}\n") + 2);
check("planForPrice body was located (the check is not vacuous)", planBody.length > 0);
check("planForPrice can return null (unknown price)", /: PaidPlan \| null/.test(planBody));
check("no unconditional paid-tier fallback remains",
  !/^\s*return "(premium|agency|agency_pro)";\s*$/m.test(planBody.slice(planBody.lastIndexOf("if ("))));
check("the final statement is the fail-closed null", /return null;\s*\n\}/.test(planBody));
check("recognized premium amounts still resolve (fail-closed did not break real prices)",
  /amt === PREMIUM_PRICE_CENTS/.test(planBody));
// A null tier must never be written as a plan.
check("billing only writes plan when the tier is known", /else if \(tier\) data\.plan = tier;/.test(billing));
check("an unknown ACTIVE price leaves the plan untouched (plan is optional in the update)",
  /plan\?: string;/.test(billing));
check("an unknown price is reported, not swallowed",
  /Unrecognized Stripe price/.test(billing));

// ── B-04d · one source of truth for 'is this subscription paying?' ───────────
check("billing imports the canonical ACTIVE_SUBSCRIPTION_STATES",
  /import \{ ACTIVE_SUBSCRIPTION_STATES \} from "\.\/os\/host\/billingTier"/.test(billing));
check("billing uses it to decide active", /ACTIVE_SUBSCRIPTION_STATES\.has\(sub\.status\)/.test(billing));
check("the hardcoded status literal is gone",
  !/\[\s*"active"\s*,\s*"trialing"\s*,\s*"past_due"\s*\]/.test(billing));
check("past_due still counts as paying", ACTIVE_SUBSCRIPTION_STATES.has("past_due"));
check("canceled does not count as paying", !ACTIVE_SUBSCRIPTION_STATES.has("canceled"));

// ── B-04e · a transient Stripe error must not mint a second customer ─────────
check("the customer-retrieve catch is no longer bare", !/\}\s*catch\s*\{\s*\n\s*\/\/ not found in this mode/.test(billing));
check("only a missing resource falls through to creating a customer",
  /if \(!isMissingStripeResource\(e\)\) throw e;/.test(billing));
check("missing is identified by Stripe's own error code, not by guessing",
  /resource_missing/.test(billing));
check("anything else re-throws so the caller fails loudly", /throw e;/.test(billing));

// ── B-04f · the API version is pinned ────────────────────────────────────────
check("the Stripe client pins an apiVersion", /apiVersion: STRIPE_API_VERSION/.test(stripeLib));
check("the pinned version is an explicit literal constant",
  /export const STRIPE_API_VERSION = "\d{4}-\d{2}-\d{2}\.[a-z]+"/.test(stripeLib));
check("no unpinned client construction remains", !/new Stripe\(key\)/.test(stripeLib));

// ── B-10b · the money path is never silent ───────────────────────────────────
check("a subscription with no matching User is reported",
  /Stripe subscription has no matching User/.test(billing));
check("the unmapped-customer report carries the customer id", /customerId,/.test(billing));
check("the 503 misconfiguration path reports instead of failing silently",
  /Stripe webhook not configured/.test(webhook) && /phase: "config"/.test(webhook));
check("handler failures identify the event", /phase: "handler", eventId: event\.id/.test(webhook));
// Alert payloads carry identifiers only — never a credential.
check("no secret value is put in a report payload",
  !/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/.test(webhook.slice(webhook.indexOf("reportError(new Error(\"Stripe webhook not configured\")"), webhook.indexOf("return NextResponse.json({ error: \"Webhook not configured\" }"))));

// ── The webhook stays the single writer of entitlements ──────────────────────
check("the webhook writes no plan/isAgency directly (billing owns that)",
  !/data: \{[^}]*\bplan:/.test(webhook) && !/isAgency/.test(webhook));

console.log(`\nstripe-lifecycle.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
