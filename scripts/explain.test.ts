// Guards for the Kai Explainability Layer (lib/explain.ts). Asserts the "why" is
// assembled from real data only — never fabricated, uncertainty never hidden.
// Run: npx tsx scripts/explain.test.ts
import { explainTradeline, type ExplainInput } from "../lib/explain";
import type { BureauData } from "../lib/bureauData";

let failures = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}

const eightYrsAgo = new Date(); eightYrsAgo.setUTCFullYear(eightYrsAgo.getUTCFullYear() - 8);

// A debt-buyer collection reported by two bureaus with a balance conflict, past §605.
const conflicted: BureauData = {
  EQUIFAX: { presence: "PRESENT", status: "Open Collection", balanceCents: 101300 },
  EXPERIAN: { presence: "PRESENT", status: "Closed", balanceCents: 98000 },
};
const strong: ExplainInput = {
  accountType: "COLLECTION", isDebtBuyer: true, balance: 101300, probability: "HIGH",
  reasons: ["Third-party debt-buyer collection — the buyer must be able to validate the debt it purchased, including the chain of assignment.", "2 verifiable cross-bureau inconsistency(ies)."],
  dateOfFirstDelinquency: eightYrsAgo, bureauData: conflicted, creditorName: "Midland Funding", recommendedStrategy: "validation",
};
const e1 = explainTradeline(strong);
ok("observed includes the classification line", e1.observed[0].includes("debt buyer"));
ok("observed carries the scoring reasons verbatim", e1.observed.some((o) => o.includes("chain of assignment")));
ok("past-§605 observation surfaces", e1.observed.some((o) => o.includes("§605")));
ok("both bureaus contribute their own reported values", e1.bureauContributions.length === 2 && e1.bureauContributions.some((b) => b.note.includes("$")));
ok("laws include FDCPA §809 from the validation strategy", e1.laws.some((l) => l.short.includes("809")));
ok("laws include §605 because the clock is in play", e1.laws.some((l) => l.short.includes("605")));
ok("contradictions surface the balance conflict", e1.contradictions.some((c) => c.toLowerCase().includes("balance")));
ok("confidence echoes the probability band", e1.confidence === "HIGH");

// Single-bureau, no DOFD, LOW — uncertainty must be stated, not hidden.
const thin: ExplainInput = {
  accountType: "REVOLVING", isDebtBuyer: false, balance: 5000, probability: "LOW",
  reasons: ["Original-creditor account — accuracy of status/dates is disputable, deletion less likely."],
  dateOfFirstDelinquency: null, bureauData: { EQUIFAX: { presence: "PRESENT", balanceCents: 5000 } } as BureauData,
  creditorName: "Some Bank", recommendedStrategy: "fcra_611",
};
const e2 = explainTradeline(thin);
ok("single-bureau uncertainty is stated", e2.uncertainty.some((u) => u.includes("Only one bureau")));
ok("missing-DOFD uncertainty is stated", e2.uncertainty.some((u) => u.includes("date of first delinquency")));
ok("LOW-confidence caveat is stated", e2.uncertainty.some((u) => u.includes("LOW")));
ok("no fabricated contradictions on single-bureau data", e2.contradictions.length === 0);

// NOT_RECOMMENDED government debt — set-aside uncertainty must appear.
const gov: ExplainInput = {
  accountType: "GOVERNMENT", isDebtBuyer: false, balance: 0, probability: "NOT_RECOMMENDED",
  reasons: ["Government / statutory debt — generally cannot be disputed off a report."],
  dateOfFirstDelinquency: null, bureauData: {} as BureauData, creditorName: "State Tax", recommendedStrategy: null,
};
const e3 = explainTradeline(gov);
ok("government debt surfaces the set-aside uncertainty", e3.uncertainty.some((u) => u.includes("Set aside")));
ok("no strategy → no invented laws", e3.laws.length === 0);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
