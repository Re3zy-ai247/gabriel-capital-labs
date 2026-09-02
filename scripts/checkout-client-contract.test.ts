// Run: npx tsx scripts/checkout-client-contract.test.ts
//
// Guards the CLIENT half of the /api/stripe/checkout contract.
// scripts/checkout-guard.test.ts guards the route; this guards its consumers.
//
// THE DEFECT (found 2026-07-20, during the in-place-upgrade change): the route
// stopped returning a redirect URL for an upgrade and began returning
// `{ upgraded: true, status, message }` after mutating the subscription. Every
// client still tested `if (res.ok && data.url)` and fell through to
// `setError(...)` on anything else — so a SUCCESSFUL upgrade, already charged as
// a prorated difference, showed the customer "we couldn't start checkout, please
// try again." Charged correctly, told it failed.
//
// THE CONTRACT every subscription caller must handle:
//   200 { url }                        -> redirect (first purchase)
//   200 { upgraded, status, message }  -> success ONLY if status is active|trialing
//   200 { upgraded, status: other }    -> NOT success: pending_if_incomplete means the
//                                        proration invoice needs authentication, so the
//                                        plan has not changed. Never claim success.
//   409 { error, portal }              -> surface an actual route to the billing portal
//   400/500 { error }                  -> plain error
//
// RC1-S6b: app/letters/page.tsx used to be excluded from this list because it
// posted { product: "letters_5" } down the one-time `mode: "payment"` path. It
// posts nothing now — that control was removed with the rest of the consumer
// purchase surface — so the exclusion note no longer describes anything.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.error(`  FAIL ${label}`); }
}

const root = join(__dirname, "..");

// RC1-S6b: consumer checkout is CLOSED. /api/stripe/checkout's PURCHASABLE_PLANS
// is empty and every consumer purchase is refused with a 410 before Stripe is
// touched. app/billing/page.tsx and app/pricing/PricingTiers.tsx no longer post
// to it, so the upgrade-response contract has exactly one remaining client.
// Shrinking this list is NOT enough on its own: what these rows gave consumers
// was "a checkout flow must not lie to you", and the honest successor is "no
// consumer surface starts a checkout at all" — asserted below, not assumed.
const CLIENTS = ["app/agency/page.tsx"];

// The PORTAL is a different contract and is deliberately still reachable:
// historical payers keep receipts, card updates and self-cancellation.
const PORTAL_CLIENTS = ["app/billing/page.tsx", "app/agency/page.tsx"];

for (const rel of CLIENTS) {
  const src = readFileSync(join(root, rel), "utf8");
  console.log(`\n${rel}`);

  check("handles the in-place upgrade response", /\.upgraded/.test(src));

  // The success claim must be conditional on the subscription actually being live.
  check("treats success as conditional on status active|trialing",
    /status === ["']active["']/.test(src) && /status === ["']trialing["']/.test(src));

  // A non-active status must not be reported as a completed plan change.
  check("does not claim success on a pending/incomplete upgrade",
    /needs a payment confirmation/.test(src));

  // The 409 refusals carry `portal: true` precisely so the customer has an exit.
  check("offers the billing portal when the route asks for it", /\.portal\b/.test(src));

  // Ordering: the upgraded branch must be evaluated before the generic error path,
  // otherwise a 200 success is swallowed by the fallback message again.
  const upgradedAt = src.indexOf(".upgraded");
  const genericErrorAt = Math.max(
    src.indexOf("Could not start checkout"),
    src.indexOf("We couldn't start checkout"),
  );
  check("the upgraded branch precedes the generic error fallback",
    upgradedAt > -1 && genericErrorAt > -1 && upgradedAt < genericErrorAt);
}

// One implementation of the portal opener, not one per page (lib/portalClient.ts).
const portalClient = readFileSync(join(root, "lib/portalClient.ts"), "utf8");
console.log("\nlib/portalClient.ts");
// Match an actual import STATEMENT, not the bare string — the file's own comment
// names these modules to explain why it must not import them, and a looser regex
// fails on its own documentation.
check("portal opener is client-safe (no prisma / next/headers import)",
  !/^\s*import[^\n]*from\s+["'](@\/lib\/prisma|next\/headers)["']/m.test(portalClient));
check("portal opener targets the prorating portal route",
  /\/api\/stripe\/portal/.test(portalClient));
for (const rel of PORTAL_CLIENTS) {
  const src = readFileSync(join(root, rel), "utf8");
  check(`${rel} reuses the shared portal opener`,
    /openBillingPortal/.test(src) && !/fetch\(\s*["']\/api\/stripe\/portal["']/.test(src));
}

// The new truth, executable. Comments are stripped first: these files narrate
// the checkout call they removed (PricingTiers.tsx:9, billing/page.tsx:95-99,
// letters/page.tsx:418, page.tsx:62), and a raw scan would fail on the
// documentation instead of on the product — the trap commit 1fbe901 exposed.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
   .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const CONSUMER_SURFACES = [
  "app/page.tsx", "app/pricing/page.tsx", "app/pricing/PricingTiers.tsx",
  "app/billing/page.tsx", "app/letters/page.tsx", "app/identity/page.tsx",
  "app/strategist/AiPlan.tsx", "app/onboarding/page.tsx", "app/help/page.tsx",
  "app/community/page.tsx",
];
console.log("\nconsumer surfaces — no checkout initiation remains");
for (const rel of CONSUMER_SURFACES) {
  const src = stripComments(readFileSync(join(root, rel), "utf8"));
  check(`${rel} posts to no checkout endpoint`, !/\/api\/stripe\/checkout/.test(src));
  check(`${rel} names no purchasable product or plan`,
    !/letters_5|["']plan["']\s*:\s*["'](premium|agency|agency_pro|scale)["']/.test(src));
}

console.log(`\ncheckout-client-contract.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
