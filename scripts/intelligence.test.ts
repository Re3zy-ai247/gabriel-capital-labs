// Guards for Credit Intelligence Engine I (Sprint X). Deterministic — no DB, no
// AI. Run: npx tsx scripts/intelligence.test.ts
import { aggregateOutcomes, reportablePatterns, rankStrategiesByHistory, K_ANON_MIN, type OutcomeRecord } from "../lib/outcomeStats";
import { recommendationIntel, type IntelInput } from "../lib/recommendationIntel";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }
function eq(label: string, got: unknown, want: unknown) { ok(`${label} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want)); }

// ---- k-anonymity: thin cells never report a rate/median ----
// Each rec gets a DISTINCT userKey by default (u0, u1, …) so sample == distinct
// contributors, isolating the contributor floor for its own dedicated tests.
let uid = 0;
function rec(over: Partial<OutcomeRecord>): OutcomeRecord {
  return { strategy: "validation", bureau: "EQUIFAX", round: 1, accountType: "COLLECTION", isDebtBuyer: true, outcome: "deleted", latencyDays: 20, userKey: `u${uid++}`, ...over };
}
const tiny = aggregateOutcomes([rec({}), rec({ outcome: "verified" })]);
ok("below K_ANON_MIN → no reportable cells", tiny.reportableCells === 0);
ok("thin strategy cell hides its rate", tiny.byStrategy.every((c) => c.favorableRate === null));
ok("thin cell still reports honest sample count", tiny.byStrategy[0].sample === 2);
ok("thin data yields NO pattern lines", reportablePatterns(tiny).length === 0);
ok("thin data yields NO history ranking", rankStrategiesByHistory(tiny) === null);

// ---- sufficient data: rates appear, k-anon respected ----
const big: OutcomeRecord[] = [];
for (let i = 0; i < K_ANON_MIN; i++) big.push(rec({ outcome: i < 14 ? "deleted" : "verified" })); // 14/20 favorable, 20 users
const bigStats = aggregateOutcomes(big);
const vCell = bigStats.byStrategy.find((c) => c.key === "strategy:validation")!;
ok("sufficient sample reports a rate", vCell.sufficient && vCell.favorableRate === 0.7);
ok("median latency reported when sufficient", vCell.medianLatencyDays === 20);
ok("ranking available with sufficient data", (rankStrategiesByHistory(bigStats)?.length ?? 0) >= 1);

// ---- PRIVACY regression: rate/median gate on their OWN base, not total sample ----
// 20 observations (20 users) but only 1 responded / 1 latency → NO rate, NO median.
const thinResponse: OutcomeRecord[] = [];
for (let i = 0; i < K_ANON_MIN; i++) thinResponse.push(rec({ outcome: i === 0 ? "deleted" : null, latencyDays: i === 0 ? 37 : null }));
const trCell = aggregateOutcomes(thinResponse).byStrategy[0];
ok("sample≥20 but responded=1 → rate withheld", trCell.sample === K_ANON_MIN && trCell.responded === 1 && trCell.favorableRate === null);
ok("sample≥20 but latencies=1 → median withheld", trCell.medianLatencyDays === null);

// ---- PRIVACY regression: distinct-contributor floor + dominance cap ----
const oneUser: OutcomeRecord[] = [];
for (let i = 0; i < 25; i++) oneUser.push(rec({ userKey: "solo", outcome: "deleted", latencyDays: 20 }));
const soloCell = aggregateOutcomes(oneUser).byStrategy[0];
ok("25 obs from ONE contributor → cell not sufficient (no rate leaks)", soloCell.sample === 25 && soloCell.sufficient === false && soloCell.favorableRate === null);
const dominated: OutcomeRecord[] = [];
for (let i = 0; i < 21; i++) dominated.push(rec({ userKey: "whale", outcome: "deleted", latencyDays: 20 })); // one user 21/40
for (let i = 0; i < 19; i++) dominated.push(rec({ outcome: "deleted", latencyDays: 20 }));
ok("one contributor >50% of a cell → withheld", aggregateOutcomes(dominated).byStrategy[0].favorableRate === null);

// two strategies, enough each (distinct users) → a comparative pattern line appears
const mixed: OutcomeRecord[] = [];
for (let i = 0; i < K_ANON_MIN; i++) mixed.push(rec({ strategy: "validation", outcome: i < 16 ? "deleted" : "verified" }));
for (let i = 0; i < K_ANON_MIN; i++) mixed.push(rec({ strategy: "fcra_611", outcome: i < 4 ? "deleted" : "verified" }));
ok("comparative pattern line emitted with 2 sufficient strategies", reportablePatterns(aggregateOutcomes(mixed)).length >= 1);
// equal rates → NO 'more often' line (avoids a false comparison)
const equalRates: OutcomeRecord[] = [];
for (let i = 0; i < K_ANON_MIN; i++) equalRates.push(rec({ strategy: "validation", outcome: i < 10 ? "deleted" : "verified" }));
for (let i = 0; i < K_ANON_MIN; i++) equalRates.push(rec({ strategy: "fcra_611", outcome: i < 10 ? "deleted" : "verified" }));
ok("equal favorable rates → no comparative line", reportablePatterns(aggregateOutcomes(equalRates)).filter((l) => /more often/.test(l)).length === 0);

// ---- Engine 2: own-data panels are deterministic + CROA-safe ----
const tl: IntelInput = {
  accountType: "COLLECTION", isDebtBuyer: true, balance: 50000, probability: "HIGH",
  reasons: ["Third-party debt-buyer collection — high deletion potential."],
  dateOfFirstDelinquency: null, bureauData: { EQUIFAX: { presence: "PRESENT", status: "Open collection" } },
  creditorName: "Midland Funding", recommendedStrategy: "validation",
};
const intel = recommendationIntel(tl);
ok("recommends a strategy with a why", intel.strategy !== null && intel.whyStrategy.length > 10);
ok("expected timeline is recipient-correct (collector §1692g)", /1692g/.test(intel.expectedTimeline));
ok("case confidence is about GROUNDS not outcome", /grounds/i.test(intel.caseConfidence.basis) && !/deleted|removed|will/i.test(intel.caseConfidence.basis));
ok("alternatives offered", intel.alternatives.length >= 1);
ok("evidence is present (own-data)", intel.evidence.length >= 1);

// historical support is GATED off by default (no CCO approval, no stats)
ok("historical support gated off by default", intel.historicalSupport.available === false);
// even WITH sufficient stats, still gated until CCO approval flag is set
const intelWithStats = recommendationIntel(tl, { stats: bigStats, consumerDisplayApproved: false });
ok("history stays gated without CCO approval", intelWithStats.historicalSupport.available === false);
const intelApproved = recommendationIntel(tl, { stats: bigStats, consumerDisplayApproved: true });
ok("history shows ONLY with CCO approval + sufficient sample", intelApproved.historicalSupport.available === true);
if (intelApproved.historicalSupport.available) {
  ok("history line is framed as pattern, not prediction", /pattern, not a prediction/i.test(intelApproved.historicalSupport.lines[0]));
}

// CROA sweep across all Engine-2 strings
const FORBIDDEN = /guarantee|will be deleted|will delete|we('| wi)ll remove|guaranteed|your score will|likely to be removed/i;
const strings = [intel.whyStrategy, intel.whyBureau ?? "", intel.whyNow, intel.expectedTimeline, intel.recommendedNextStep, intel.caseConfidence.basis, ...intel.whyNotAlternatives, ...intel.alternatives.map((a) => a.note)];
ok("no forbidden outcome-promise in any Engine-2 string", !strings.some((s) => FORBIDDEN.test(s)));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
