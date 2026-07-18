// Run: npx tsx scripts/kai-recommendation.test.ts
// CROA guard for Kai's Home recommendation reasoning. Locks two properties of
// the §605 obsolescence fix:
//   1. DELEGATION — Kai's "past its reporting window" recommendation fires only
//      when the canonical strategy engine (lib/recommend.ts) says fcra_605, so
//      it honors the 10-year bankruptcy window + 180-day collection/charge-off
//      offset and never contradicts the authority.
//   2. LANGUAGE — the recommendation copy carries no forbidden outcome language
//      (no "must drop off", "will be removed", guarantees). Kai observes facts,
//      explains the law, flags the issue, and recommends verification.
import { pickRecommendation } from "../lib/kaiHome";
import { scanForbiddenLanguage } from "../lib/intelligence/reasoning";
import type { Letter, Report, Tradeline } from "@prisma/client";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const DAY = 86_400_000;
const yearsAgo = (y: number) => new Date(Date.now() - y * 365.25 * DAY);

function tl(over: Partial<Tradeline>): Tradeline {
  return {
    id: "t1", userId: "u1", reportId: "r1", creditorName: "Test Creditor",
    accountType: "CHARGE_OFF", isDebtBuyer: false, probability: "HIGH",
    dateOfFirstDelinquency: yearsAgo(8), bureauData: {}, resolved: false,
    // fields not read by pickRecommendation/recommendStrategy:
    accountNumber: null, balance: null, status: null, reasons: [] as unknown,
    createdAt: new Date(), updatedAt: new Date(),
    ...over,
  } as unknown as Tradeline;
}
const oneReport = [{ id: "r1" }] as unknown as Report[];

// --- 1. DELEGATION: an 8yr charge-off IS obsolete → the §605 recommendation fires
const chargeoff = pickRecommendation([tl({ accountType: "CHARGE_OFF", dateOfFirstDelinquency: yearsAgo(8) })], [], oneReport);
check("8yr charge-off → §605 obsolescence recommendation fires", chargeoff?.href.includes("strategy=fcra_605") ?? false);

// --- 1b. DELEGATION: an 8yr Chapter 7 bankruptcy public record is NOT yet obsolete
//     (10-year window). The OLD hardcoded `>= 7` bug would have wrongly fired §605.
const bk8 = pickRecommendation(
  [tl({ accountType: "PUBLIC_RECORD", creditorName: "US Bankruptcy Court", dateOfFirstDelinquency: yearsAgo(8), bureauData: { EQUIFAX: { presence: "PRESENT", status: "Chapter 7 Bankruptcy" } } as unknown as Tradeline["bureauData"] })],
  [], oneReport
);
check("8yr Chapter 7 bankruptcy → does NOT fire §605 (10yr window honored)", !(bk8?.href.includes("strategy=fcra_605") ?? false));

// --- 1c. DELEGATION: an 11yr Chapter 7 bankruptcy IS obsolete → §605 fires
const bk11 = pickRecommendation(
  [tl({ accountType: "PUBLIC_RECORD", creditorName: "US Bankruptcy Court", dateOfFirstDelinquency: yearsAgo(11), bureauData: { EQUIFAX: { presence: "PRESENT", status: "Chapter 7 Bankruptcy" } } as unknown as Tradeline["bureauData"] })],
  [], oneReport
);
check("11yr Chapter 7 bankruptcy → fires §605", bk11?.href.includes("strategy=fcra_605") ?? false);

// --- 2. LANGUAGE: the obsolescence recommendation carries no forbidden outcome copy
for (const [name, rec] of [["charge-off", chargeoff], ["11yr bankruptcy", bk11]] as const) {
  const combined = `${rec?.title} ${rec?.body} ${rec?.cta} ${rec?.basis}`;
  const hit = scanForbiddenLanguage(combined);
  check(`${name} recommendation copy passes scanForbiddenLanguage (hit: ${hit ?? "none"})`, hit === null);
  check(`${name} copy avoids "must drop off"`, !/must drop off/i.test(combined));
  check(`${name} copy avoids "will be removed"`, !/will be removed/i.test(combined));
}

// --- 3. SCANNER TEETH: the extended patterns now catch the old defect string
check("scanner catches the OLD 'must drop off under FCRA §605' copy",
  scanForbiddenLanguage("Items older than 7 years must drop off under FCRA §605.") !== null);
check("scanner catches 'will fall off'", scanForbiddenLanguage("this will fall off your report") !== null);
check("scanner catches 'automatically removed'", scanForbiddenLanguage("the item is automatically removed") !== null);
// ...but does NOT over-match legitimate process language ("must complete its reinvestigation")
check("scanner allows legitimate process language ('must complete its reinvestigation')",
  scanForbiddenLanguage("the bureau must complete its reinvestigation within 30 days") === null);

console.log(`\nkai-recommendation.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
