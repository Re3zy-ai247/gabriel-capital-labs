// Standalone assertions for the §605 obsolescence-window logic and the
// furnisher/collector recipient block. Run: npx tsx scripts/obsolescence.test.ts
import { obsolescenceWindowYears, bureauTextBlob } from "../lib/obsolescence";
import { buildContext } from "../lib/letter";
import { recommendStrategy } from "../lib/recommend";
import type { BureauData } from "../lib/bureauData";

let failures = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failures++; console.error(`✗ ${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`); }
  else console.log(`✓ ${label}`);
}

// ---- obsolescenceWindowYears ----
eq("ordinary collection → 7yr", obsolescenceWindowYears({ accountType: "COLLECTION", creditorName: "Midland Funding" }), 7);
eq("charge-off → 7yr", obsolescenceWindowYears({ accountType: "CHARGE_OFF", creditorName: "Capital One" }), 7);
eq("Chapter 7 bankruptcy public record → 10yr",
  obsolescenceWindowYears({ accountType: "PUBLIC_RECORD", creditorName: "US Bankruptcy Court", text: "Chapter 7 Bankruptcy" }), 10);
eq("bankruptcy, chapter unstated → 10yr (conservative)",
  obsolescenceWindowYears({ accountType: "PUBLIC_RECORD", creditorName: "Bankruptcy" }), 10);
eq("completed Chapter 13 → 7yr",
  obsolescenceWindowYears({ accountType: "PUBLIC_RECORD", creditorName: "US Bankruptcy Court", text: "Chapter 13 Bankruptcy - Discharged" }), 7);
eq("dismissed Chapter 13 → 10yr",
  obsolescenceWindowYears({ accountType: "PUBLIC_RECORD", creditorName: "US Bankruptcy Court", text: "Chapter 13 Bankruptcy - Dismissed" }), 10);
eq("tax lien public record (no bankruptcy) → 7yr",
  obsolescenceWindowYears({ accountType: "PUBLIC_RECORD", creditorName: "State Tax Lien" }), 7);
eq("ordinary account flagged 'included in bankruptcy' → still 7yr (not a public-record BK)",
  obsolescenceWindowYears({ accountType: "COLLECTION", creditorName: "ABC Collections", text: "Included in Chapter 7 Bankruptcy" }), 7);

// bureauTextBlob pulls status + remarks across bureaus
const bk: BureauData = { EQUIFAX: { presence: "PRESENT", status: "Chapter 7 Bankruptcy" } };
eq("bureauTextBlob surfaces status", bureauTextBlob(bk).includes("Chapter 7"), true);

// ---- recommendStrategy honors the window ----
const eightYrsAgo = new Date(); eightYrsAgo.setFullYear(eightYrsAgo.getFullYear() - 8);
const elevenYrsAgo = new Date(); elevenYrsAgo.setFullYear(elevenYrsAgo.getFullYear() - 11);

eq("8yr-old ordinary item → recommends §605 obsolescence",
  recommendStrategy({ accountType: "CHARGE_OFF", isDebtBuyer: false, probability: "HIGH", dateOfFirstDelinquency: eightYrsAgo, bureauData: {}, creditorName: "Capital One" }).strategyId, "fcra_605");
eq("8yr-old Chapter 7 bankruptcy → NOT yet obsolete (no §605)",
  recommendStrategy({ accountType: "PUBLIC_RECORD", isDebtBuyer: false, probability: "MEDIUM", dateOfFirstDelinquency: eightYrsAgo, bureauData: { EQUIFAX: { presence: "PRESENT", status: "Chapter 7 Bankruptcy" } }, creditorName: "US Bankruptcy Court" }).strategyId !== "fcra_605", true);
eq("11yr-old Chapter 7 bankruptcy → now obsolete (§605)",
  recommendStrategy({ accountType: "PUBLIC_RECORD", isDebtBuyer: false, probability: "MEDIUM", dateOfFirstDelinquency: elevenYrsAgo, bureauData: { EQUIFAX: { presence: "PRESENT", status: "Chapter 7 Bankruptcy" } }, creditorName: "US Bankruptcy Court" }).strategyId, "fcra_605");

// ---- furnisher recipient block in buildContext ----
const tl = { creditorName: "Midland Funding LLC", balance: 50000, bureauData: {}, accountType: "COLLECTION" as const };
const noAddr = buildContext("validation", tl, {});
eq("furnisher, no address → placeholder + recipientComplete=false", [noAddr.recipientLines[0], noAddr.recipientComplete], ["[Furnisher mailing address]", false]);

const withAddr = buildContext("validation", tl, {}, undefined, 1, { name: "Midland Credit Management", address: "P.O. Box 939069\nSan Diego, CA 92193" });
eq("furnisher with address → uses provided lines", withAddr.recipientLines, ["P.O. Box 939069", "San Diego, CA 92193"]);
eq("furnisher with name override → uses it", withAddr.recipientName, "Midland Credit Management");
eq("furnisher with address → recipientComplete=true", withAddr.recipientComplete, true);

const bureauCtx = buildContext("fcra_611", tl, {}, "EQUIFAX");
eq("bureau letter → recipientComplete=true (known address)", bureauCtx.recipientComplete, true);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
