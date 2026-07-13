// Guards for Engine 3 Tier A (lib/forecast.ts): own-data latency + statutory
// window forecast. Run: npx tsx scripts/forecast.test.ts
import { ownResponseLatencyDays, forecastFor, POSSIBLE_RESPONSES, type ForecastLetterInput } from "../lib/forecast";

let failures = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failures++; console.error(`✗ ${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`); }
  else console.log(`✓ ${label}`);
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
eq("mid-window elapsed/left", [fMid.daysElapsed, fMid.daysLeft, fMid.pastWindow], [12, 18, false]);
eq("mid-window surfaces own-history note", fMid.ownHistoryText?.includes("median of 25 days"), true);

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
