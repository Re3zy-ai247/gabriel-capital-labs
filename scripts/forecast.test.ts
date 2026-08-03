// Guards for Engine 3 Tier A (lib/forecast.ts): own-data latency + statutory
// window forecast. Also covers Phase 1A's honesty-triple fix (SIM-REVIEW
// finding 2): the §611 clock must be RECEIPT-anchored (mailedAt + a
// conservative transit allowance), never mailing-anchored. Run:
// npx tsx scripts/forecast.test.ts
import {
  ownResponseLatencyDays, forecastFor, POSSIBLE_RESPONSES, MAIL_TRANSIT_DAYS,
  daysElapsedSinceEstimatedReceipt, REINVESTIGATION_DAYS, type ForecastLetterInput,
} from "../lib/forecast";

let failures = 0;
function eq(label: string, got: unknown, want: unknown) {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) { failures++; console.error(`✗ ${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`); }
  else console.log(`✓ ${label}`);
}
function ok(label: string, cond: boolean) {
  if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}

const NOW = Date.UTC(2026, 0, 100); // fixed clock
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000);

// ---- ownResponseLatencyDays ----
const answered: ForecastLetterInput[] = [
  { id: "a", targetBureau: "EQUIFAX", mailedAt: daysAgo(60), responseAt: daysAgo(40), round: 1, status: "RESPONSE_RECEIVED" }, // 20d
  { id: "b", targetBureau: "EXPERIAN", mailedAt: daysAgo(60), responseAt: daysAgo(30), round: 1, status: "RESPONSE_RECEIVED" }, // 30d
  { id: "c", targetBureau: "EQUIFAX", mailedAt: daysAgo(90), responseAt: daysAgo(65), round: 1, status: "RESPONSE_RECEIVED" }, // 25d
];
eq("median across all answered (20,25,30 → 25)", ownResponseLatencyDays(answered, null, 3), { medianDays: 25, sample: 3 });
eq("default minSample is 3 (2 EQUIFAX points → null, not a 'median')", ownResponseLatencyDays(answered, "EQUIFAX"), null);
eq("explicit minSample 2 still allowed (20,25 → 23 rounded)", ownResponseLatencyDays(answered, "EQUIFAX", 2), { medianDays: 23, sample: 2 });
eq("thin data below minSample → null", ownResponseLatencyDays(answered, "EXPERIAN", 3), null);
eq("no answered letters → null", ownResponseLatencyDays([], null, 3), null);

// ---- forecastFor: only mailed-unanswered rows ----
const notMailed: ForecastLetterInput = { id: "x", targetBureau: "EQUIFAX", mailedAt: null, responseAt: null, round: 1, status: "GENERATED" };
eq("un-mailed letter → no forecast", forecastFor(notMailed, null, NOW), null);

const midWindow: ForecastLetterInput = { id: "m", targetBureau: "EQUIFAX", mailedAt: daysAgo(12), responseAt: null, round: 1, status: "MAILED" };
const fMid = forecastFor(midWindow, { medianDays: 25, sample: 3 }, NOW)!;
// Receipt-anchored (Phase 1A honesty triple): mailed 12 days ago, minus the
// MAIL_TRANSIT_DAYS(5) transit allowance = 7 days on the §611 clock, not 12.
eq("mid-window elapsed/left is RECEIPT-anchored, not mailing-anchored (12 days mailed − 5-day transit = 7 elapsed, 23 left)",
  [fMid.daysElapsed, fMid.daysLeft, fMid.pastWindow], [12 - MAIL_TRANSIT_DAYS, 30 - (12 - MAIL_TRANSIT_DAYS), false]);
eq("mid-window surfaces own-history note", fMid.ownHistoryText?.includes("median of 25 days"), true);
ok("mid-window's windowText states the estimate honestly (receipt-anchored, not a tracking claim)",
  /receiv/i.test(fMid.windowText) && /not mailing it/i.test(fMid.windowText) && /estimat/i.test(fMid.windowText) && /aren't tracked/i.test(fMid.windowText));

// ---- Phase 1A honesty triple (SIM-REVIEW finding 2): receipt-anchored math ----
// A letter mailed WITHIN the transit allowance hasn't estimably started its
// clock yet — daysElapsed floors at 0, never negative, never claims the clock
// is already running before the letter could plausibly have arrived.
const justMailed: ForecastLetterInput = { id: "jm", targetBureau: "EQUIFAX", mailedAt: daysAgo(2), responseAt: null, round: 1, status: "MAILED" };
const fJustMailed = forecastFor(justMailed, null, NOW)!;
eq("mailed within the transit allowance → 0 days on the clock (not negative, not started early)", fJustMailed.daysElapsed, 0);
eq("...and the full statutory window is still ahead", fJustMailed.daysLeft, REINVESTIGATION_DAYS);

// The shared helper itself, exercised directly (mailCenter.ts and
// app/letters/page.tsx both call this exact function — single source of truth).
eq("daysElapsedSinceEstimatedReceipt floors at zero inside the transit allowance", daysElapsedSinceEstimatedReceipt(NOW - 3 * 86_400_000, NOW), 0);
eq("daysElapsedSinceEstimatedReceipt subtracts the transit allowance once past it", daysElapsedSinceEstimatedReceipt(NOW - 20 * 86_400_000, NOW), 20 - MAIL_TRANSIT_DAYS);
eq("daysElapsedSinceEstimatedReceipt never returns negative for a same-day mailing", daysElapsedSinceEstimatedReceipt(NOW, NOW), 0);

const pastWindow: ForecastLetterInput = { id: "p", targetBureau: "EQUIFAX", mailedAt: daysAgo(45), responseAt: null, round: 1, status: "MAILED" };
const fPast = forecastFor(pastWindow, { medianDays: 25, sample: 3 }, NOW)!;
eq("past-window flagged", [fPast.pastWindow, fPast.daysLeft <= 0], [true, true]);
eq("past window suppresses own-history note (no false reassurance)", fPast.ownHistoryText, null);
eq("past window escalation contingency", fPast.contingency.includes("CFPB"), true);

// thin own-data → no note even mid-window (never present 1 point as a pattern)
const fThin = forecastFor(midWindow, null, NOW)!;
eq("no own-history note when latency is null", fThin.ownHistoryText, null);

// ---- POSSIBLE_RESPONSES is the honest enumeration, not a prediction ----
eq("four enumerated outcomes", POSSIBLE_RESPONSES.map((r) => r.outcome), ["Deleted", "Corrected", "Verified", "No response"]);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
