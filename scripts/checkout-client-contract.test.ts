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
// app/letters/page.tsx is deliberately NOT in this list: it posts
// { product: "letters_5" }, which takes the one-time `mode: "payment"` path and
// still returns { url }.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.error(`  FAIL ${label}`); }
}

const root = join(__dirname, "..");

// Every client that can POST a subscription plan to checkout.
const CLIENTS = [
  "app/billing/page.tsx",
  "app/agency/page.tsx",
  "app/pricing/PricingTiers.tsx",
];

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
for (const rel of CLIENTS) {
  const src = readFileSync(join(root, rel), "utf8");
  check(`${rel} reuses the shared portal opener`,
    /openBillingPortal/.test(src) && !/fetch\(\s*["']\/api\/stripe\/portal["']/.test(src));
}

console.log(`\ncheckout-client-contract.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
