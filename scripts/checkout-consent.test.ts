// Run: npx tsx scripts/checkout-consent.test.ts
//
// Guards Terms-of-Service consent collection at Checkout.
//
// WHY (found 2026-07-20): no customer had ever agreed to anything. There was no
// terms acceptance anywhere in the product — `termsAcceptedAt` / `tosVersion` /
// `acceptedTerms` returned zero hits repo-wide, /register posted only
// {name,email,password}, and neither Checkout Session collected consent. For a
// CROA-governed product that is a legal exposure, not a UX gap.
//
// THE MECHANISM: Stripe's own `consent_collection.terms_of_service = "required"`.
// Stripe renders the checkbox and stores `consent.terms_of_service = "accepted"`
// on the Session permanently — so Stripe is the system of record and the app
// invents no parallel consent workflow.
//
// THE TRAP THIS GUARDS: Stripe REJECTS session creation when the Dashboard has no
// Terms of Service URL ("You cannot collect consent to your terms of service
// unless a URL is set in the Stripe Dashboard"). Enabling this unconditionally
// would 500 EVERY checkout — a total billing outage — so it must stay behind a
// default-off flag that the owner flips only after configuring the Dashboard.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.error(`  FAIL ${label}`); }
}

const root = join(__dirname, "..");
const route = readFileSync(join(root, "app/api/stripe/checkout/route.ts"), "utf8");
const webhook = readFileSync(join(root, "app/api/stripe/webhook/route.ts"), "utf8");
const envExample = readFileSync(join(root, ".env.example"), "utf8");

console.log("\nconsent is collected via Stripe's supported mechanism");
check("uses consent_collection.terms_of_service", /terms_of_service:\s*["']required["']/.test(route));
check("consent is applied to BOTH Checkout Sessions (subscription + letter pack)",
  (route.match(/\.\.\.CONSENT_COLLECTION/g) || []).length === 2);
check("both sessions are still created (no session lost in the edit)",
  (route.match(/stripe\.checkout\.sessions\.create/g) || []).length === 2);

console.log("\nit cannot take checkout down before the Dashboard is configured");
check("consent is gated by an explicit flag", /process\.env\.STRIPE_TOS_CONSENT/.test(route));
check("the flag is opt-IN (=== \"1\"), so an unset env stays off",
  /STRIPE_TOS_CONSENT === ["']1["']/.test(route));
// If the spread were built unconditionally, an unset flag would still send the
// parameter and every session would 500.
check("the spread is empty when the flag is off",
  /TOS_CONSENT_ENABLED\s*\?[\s\S]{0,160}:\s*\{\}/.test(route));
check("the Dashboard precondition is written down where it is enabled",
  /Public details/.test(route));
check(".env.example documents the flag and its precondition",
  /STRIPE_TOS_CONSENT/.test(envExample) && /Public details/.test(envExample));

console.log("\nacceptance evidence is recorded, with Stripe as system of record");
check("the webhook reads consent off the completed session",
  /consent\?\.terms_of_service/.test(webhook));
check("the checkout session id is recorded so the evidence is retrievable",
  /checkoutSessionId/.test(webhook));
// A local column would be a second source of truth for a legal fact Stripe already
// stores permanently; the pointer must not become an invented consent workflow.
check("no parallel consent table/column was invented",
  !/termsAcceptedAt|tosVersion|acceptedTerms/.test(route + webhook));

console.log(`\ncheckout-consent.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
