// Guards for the §605 fall-off display math and duplicate-debt grouping that the
// tradelines page renders. Run: npx tsx scripts/tradeline-insights.test.ts
import { fallOffInsight, formatMonthYear, duplicateGroups, groupAdjacentOrder } from "../lib/tradelineInsights";
import { conflictFields, crossBureauConflicts, type BureauData } from "../lib/bureauData";

let failures = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failures++; console.error(`✗ ${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`); }
  else console.log(`✓ ${label}`);
}

// ---- fallOffInsight ----
eq("no DOFD → no claim (null)", fallOffInsight({ accountType: "COLLECTION", bureauData: {} }), null);
eq("invalid DOFD → null", fallOffInsight({ accountType: "COLLECTION", bureauData: {}, dateOfFirstDelinquency: "not-a-date" }), null);

const eightYrsAgo = new Date(); eightYrsAgo.setUTCFullYear(eightYrsAgo.getUTCFullYear() - 8);
const past = fallOffInsight({ accountType: "COLLECTION", creditorName: "Midland Funding", bureauData: {}, dateOfFirstDelinquency: eightYrsAgo });
eq("8yr-old collection → past the 7yr window", [past?.windowYears, past?.pastWindow, past?.monthsRemaining], [7, true, 0]);

const sixYrsAgo = new Date(); sixYrsAgo.setUTCFullYear(sixYrsAgo.getUTCFullYear() - 6);
const soon = fallOffInsight({ accountType: "CHARGE_OFF", creditorName: "Capital One", bureauData: {}, dateOfFirstDelinquency: sixYrsAgo });
eq("6yr-old charge-off → inside window, ~12 months left", [soon?.windowYears, soon?.pastWindow, soon != null && soon.monthsRemaining >= 11 && soon.monthsRemaining <= 13], [7, false, true]);

// Chapter 7 public record honors the 10-year window (same engine as scoring/letters).
const bk = fallOffInsight({
  accountType: "PUBLIC_RECORD",
  creditorName: "US Bankruptcy Court",
  bureauData: { EQUIFAX: { presence: "PRESENT", status: "Chapter 7 Bankruptcy" } },
  dateOfFirstDelinquency: eightYrsAgo,
});
eq("8yr-old Chapter 7 public record → 10yr window, NOT past", [bk?.windowYears, bk?.pastWindow], [10, false]);

// UTC calendar math — a fixed DOFD produces a fixed fall-off month regardless of local zone.
const fixed = fallOffInsight({ accountType: "COLLECTION", bureauData: {}, dateOfFirstDelinquency: "2020-03-15" });
eq("fall-off month is DOFD + window in UTC", fixed && formatMonthYear(fixed.fallOffDate), "Mar 2027");

// ---- duplicateGroups ----
const rows = [
  { id: "a", duplicateGroup: "g1" },
  { id: "b", duplicateGroup: null },
  { id: "c", duplicateGroup: "g1" },
  { id: "d", duplicateGroup: "solo" }, // singleton group ≠ duplicate
];
const groups = duplicateGroups(rows);
eq("pair kept, singleton dropped", [groups.get("g1"), groups.has("solo")], [2, false]);

// ---- groupAdjacentOrder ----
eq("group members pulled adjacent at strongest member's slot",
  groupAdjacentOrder(rows, groups).map((r) => r.id), ["a", "c", "b", "d"]);
eq("no groups → order untouched",
  groupAdjacentOrder(rows, new Map()).map((r) => r.id), ["a", "b", "c", "d"]);

// ---- conflictFields ↔ crossBureauConflicts (sentence text is load-bearing) ----
const conflicted: BureauData = {
  EQUIFAX: { presence: "PRESENT", status: "Open Collection", balanceCents: 101300, dofd: "2021-02-01" },
  EXPERIAN: { presence: "PRESENT", status: "Closed", balanceCents: 98000, dofd: "2021-06-01" },
};
eq("all three fields flagged when they disagree", [...conflictFields(conflicted)].sort(), ["balance", "dofd", "status"]);
eq("sentences unchanged by the conflictFields refactor", crossBureauConflicts(conflicted), [
  "Balance differs across bureaus reporting this account.",
  "Account status differs across bureaus reporting this account.",
  "Date of first delinquency differs across bureaus — possible re-aging.",
]);
eq("single-bureau knowledge → no conflict claims", [
  conflictFields({ EQUIFAX: { presence: "PRESENT", balanceCents: 5000 } }).size,
  crossBureauConflicts({ EQUIFAX: { presence: "PRESENT", balanceCents: 5000 } }).length,
], [0, 0]);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
