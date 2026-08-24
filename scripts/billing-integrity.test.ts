// Run: npx tsx scripts/billing-integrity.test.ts
//
// Guards the letter-metering + capacity-copy contract. Four defects are pinned here.
//
// B-01 · The free-letter paywall was bypassable. getEntitlement metered usage with
//   prisma.letter.count over rows the user can DELETE (DELETE /api/letters/[id]), so:
//   generate 3 free letters -> GET each (the response body is decrypted) -> DELETE all
//   three -> the meter reads 0 again, forever. The 402 in /api/letters/generate never
//   fired. Usage must now be derived from the APPEND-ONLY ProductEvent ledger
//   (dispute_created, meta.count) and combined with the row count via MAX, so the meter
//   can never read LOWER than it did before and no existing account loses history.
//
// B-01b · Round 2 letters were entirely free: the route created a Letter but never
//   spent a credit and never emitted dispute_created, so escalations were invisible to
//   the meter. Round 2 now consumes entitlement on the same terms as generate.
//
// B-01c · letterCredits could be driven NEGATIVE — an unconditional
//   `{ decrement: n }` with no balance guard and no clamp. A negative balance silently
//   eats the next letter-pack purchase. The spend is now clamped and conditional.
//
// B-04b · Capacity copy misrepresented a sold entitlement (a repeat of the ratified
//   regression pinned in scripts/agency-capacity.test.ts): the billing and agency pages
//   advertised 40/100 workspaces while the server enforces Agency 15 · Pro 30 · Scale 50.
//   Both surfaces must now quote the canonical resolver/constants, never a literal.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKSPACE_BASE_V3 } from "../lib/agencyCapacity";
// lib/events is read as SOURCE, not imported: importing it would construct the Prisma
// client, and these guards must run with no DATABASE_URL.

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const ent = read("lib/entitlements.ts");
const generate = read("app/api/letters/generate/route.ts");
const round2 = read("app/api/letters/[id]/round2/route.ts");
const identityLetter = read("app/api/identity/letter/route.ts");
const strategistPlan = read("app/api/strategist/plan/route.ts");
const billingPage = read("app/billing/page.tsx");
const agencyPage = read("app/agency/page.tsx");
const events = read("lib/events.ts");

// ── B-01 · monthly usage is derived from the append-only ledger ──────────────
check("A1· entitlements reads the ProductEvent ledger", /FROM "ProductEvent"/.test(ent));
check("A2· the ledger read filters on the dispute_created event name",
  /PRODUCT_EVENTS\.disputeCreated/.test(ent) && /disputeCreated: "dispute_created"/.test(events));
check("A3· the ledger read is scoped to the user and the current month",
  /"userId" = \$1/.test(ent) && /"createdAt" >= \$3/.test(ent) && /startOfMonthUTC\(\)/.test(ent));
check("A4· usage is not derived SOLELY from deletable Letter rows",
  /Math\.max\(letterRowsThisMonth, ledgerUsedThisMonth\)/.test(ent));
check("A5· the Letter row count is still one of the inputs (meter never reads lower)",
  /prisma\.letter\.count\(/.test(ent));
check("A6· no bare `lettersUsedThisMonth = await prisma.letter.count` remains",
  !/lettersUsedThisMonth = await prisma\.letter\.count\(/.test(ent));
check("A7· a missing/unparseable meta.count falls back to 1, never 0 (fails toward charging)",
  /Number\.isFinite\(n\) && n >= 1 \? Math\.floor\(n\) : 1/.test(ent));
check("A8· the ledger read degrades to the row count instead of throwing", /catch \(e\)[\s\S]{0,400}?return 0;/.test(ent));

// ── B-01b (RE-EXPRESSED, RC1-S6a) · Round 2 answers to the FREE model ────────
// B1/B2/B5 protected "cost-before-commit": nothing may be charged before the
// work is committed, and the quota must actually bite. Under Founder D-3 there
// is no charge and no quota, so the protective intent is INVERTED rather than
// deleted — the ordering pin becomes "refuse before you write a row", and the
// charge pins become "no charge is reachable at all".
check("B1· round2 refuses an unconfirmed fact BEFORE writing a letter row",
  round2.indexOf("needsAssertion") < round2.indexOf("prisma.letter.create("));
check("B2· neither letter route can emit a payment-required refusal",
  !/status: 402/.test(round2) && !/status: 402/.test(generate) && !/upgrade:/.test(round2) && !/upgrade:/.test(generate));
check("B3· round2 emits the dispute_created product event",
  /track\(PRODUCT_EVENTS\.disputeCreated/.test(round2));
check("B4· round2 emits meta.count so the ledger sum is exact", /meta: \{ count: 1/.test(round2));
check("B5· round2 neither imports nor calls the spend path (D-3)",
  !/spendLetterCredits/.test(round2));
check("B6· round2 meters BEFORE returning the refreshed entitlement", (() => {
  const trackAt = round2.indexOf("PRODUCT_EVENTS.disputeCreated");
  const afterAt = round2.indexOf("const after = await getEntitlement(user)");
  return trackAt > -1 && afterAt > -1 && trackAt < afterAt;
})());
check("B7· round2 does not duplicate the credit accounting inline",
  !/letterCredits: \{ decrement/.test(round2));

// ── B-01c · the credit decrement is clamped + conditional ────────────────────
check("C1· the decrement lives in one place (lib/entitlements.spendLetterCredits)",
  /export async function spendLetterCredits\(/.test(ent));
check("C2· the spend is clamped to the credits actually held",
  /Math\.min\(beyondFree, Math\.max\(0, e\.letterCredits\)\)/.test(ent));
check("C3· the decrement is conditional on the row still holding the balance",
  /letterCredits: \{ gte: fromCredits \}/.test(ent) && /letterCredits: \{ decrement: fromCredits \}/.test(ent));
check("C4· a lost race clamps at zero instead of going negative",
  /letterCredits: \{ lt: fromCredits \}/.test(ent) && /data: \{ letterCredits: 0 \}/.test(ent));
check("C5· generate neither imports nor calls the spend path (D-3)",
  !/spendLetterCredits/.test(generate));
check("C6· no unguarded decrement remains in the generate route",
  !/letterCredits: \{ decrement/.test(generate));
// C7 now asserts the REASON nothing spends, so C1-C4's clamp cannot be quietly
// re-armed by a future caller: the single decrement path is frozen at source.
check("C7· the single decrement path is frozen at source",
  /const LETTER_CREDITS_FROZEN: boolean = true;/.test(ent) &&
  /export async function spendLetterCredits\([\s\S]{0,240}?\{\s*\n\s*if \(LETTER_CREDITS_FROZEN\) return;/.test(ent));

// B8 · the honest translation of "before anything is charged". Without it, the
// charge-protection semantics of B1/B2/B5/C5 really would only be deleted: this
// asserts that no consumer-assistance route can reach a payment processor at all.
check("B8· no consumer assistance route touches Stripe at all",
  ![generate, round2, identityLetter, strategistPlan].some((s) => /getStripe\(|stripe\./.test(s)));

// ── B-04b · capacity copy quotes the canonical caps, never a literal ─────────
// The enforced v3 base, restated so a cap change must be a deliberate, reviewed edit.
check("D0· canonical v3 base is still Agency 15 · Pro 30 · Scale 50",
  WORKSPACE_BASE_V3.agency === 15 && WORKSPACE_BASE_V3.agency_pro === 30 && WORKSPACE_BASE_V3.scale === 50);
check("D1· billing page derives capacity from the canonical resolver",
  /from ['"]@\/lib\/agencyCapacity['"]/.test(billingPage) && /resolveAgencyCapacity\(/.test(billingPage));
check("D2· billing page feeds the resolver server-owned inputs only (no client-set capacity)",
  /plan: status\?\.plan/.test(billingPage) && /isAgency: status\?\.isAgency/.test(billingPage) &&
  /createdAt: status\?\.memberSince/.test(billingPage));
check("D3· agency page quotes the canonical constants",
  /from ['"]@\/lib\/agencyCapacity['"]/.test(agencyPage) && /WORKSPACE_BASE_V3\./.test(agencyPage));
check("D4· no stale 40-workspace claim on either surface",
  !/40 (active )?(client )?workspaces|40 active clients/.test(billingPage + agencyPage));
check("D5· no stale 100-workspace claim on either surface",
  !/100 (active )?(client )?workspaces|100 active clients/.test(billingPage + agencyPage));
check("D6· agency upsell thresholds are constants, not the old 20/40 literals",
  !/clientLimit > 40|clientLimit > 20/.test(agencyPage));

// Structural: NO literal integer may sit next to workspace/client-workspace capacity
// copy on either surface — every such number must be interpolated from the resolver.
// Two shapes: a bare literal ("up to 40 workspaces") and a literal smuggled through a
// template expression ("${isAgencyPro ? '40' : '15'} active client workspaces").
const CAP_LITERAL =
  /\b\d+\s*(active\s+)?(client\s+)?(workspaces|clients)\b|\d+['"]?\s*\}\s*(active\s+)?(client\s+)?(workspaces|clients)\b/gi;
for (const [name, src] of [["app/billing/page.tsx", billingPage], ["app/agency/page.tsx", agencyPage]] as const) {
  const hits = (src.match(CAP_LITERAL) ?? []).filter((h) => !/^0\s/.test(h));
  check(`D7· ${name} hardcodes no workspace-capacity integer (found: ${hits.join(", ") || "none"})`, hits.length === 0);
}

console.log(`\nbilling-integrity.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
