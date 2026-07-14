// Engine 1 — Outcome Intelligence (Sprint X, ADR-0010). Deterministic aggregation
// of REAL dispute outcomes into k-anonymous historical patterns. NO AI, NO
// prediction model, NO hallucination — only counts over verified outcomes the
// product already recorded. This is the compounding moat (MOAT #4): every
// completed dispute adds one observation and the patterns sharpen.
//
// PRIVACY (non-negotiable, MOAT.md §Rules rule 2 + INTELLIGENCE-LAYER.md gates):
//  - The corpus passed in MUST already be consent-filtered (via the OutcomeConsent
//    table + consentingUserIds()) and carry NO raw identifiers — records carry only
//    outcome facts plus a salted, non-reversible `userKey` used ONLY to count
//    distinct contributors (it never appears in any output).
//  - k-anonymity, enforced three ways so no individual's outcome is inferable:
//    (a) the cell has ≥ K_ANON_MIN observations, AND ≥ MIN_CONTRIBUTORS distinct
//        contributors, AND no single contributor exceeds MAX_CONTRIBUTOR_SHARE;
//    (b) a favorable RATE is reported only when its own denominator (responded)
//        clears K_ANON_MIN — not the total sample;
//    (c) a median latency is reported only when its own base (latencies) clears
//        K_ANON_MIN. Below any threshold we return null and the caller shows an
//        honest "still gathering data" (BI Art. II: thin data discloses itself).
//  - Aggregate patterns only; a single user's outcome is never exposed.
//
// CROA: these are HISTORICAL patterns, not predictions. Framing must always be
// "of past disputes that did X, N did Y" — never "your dispute will…". Consumer
// display of these aggregates is gated on a CCO sign-off; /admin may view them for
// internal validation first (the blueprint's rollout order).

export const K_ANON_MIN = 20;          // minimum observations for any reported statistic
export const MIN_CONTRIBUTORS = 20;    // minimum DISTINCT contributors per reportable cell
export const MAX_CONTRIBUTOR_SHARE = 0.5; // no single contributor may exceed this share of a cell

// One anonymized outcome observation. Built by the caller from a Letter row with
// the raw userId dropped. `userKey` is a salted, non-reversible per-user token
// used ONLY to count distinct contributors — it is never emitted in any output.
export interface OutcomeRecord {
  strategy: string;
  bureau: string | null;
  round: number;
  accountType: string;
  isDebtBuyer: boolean;
  outcome: string | null;     // deleted | updated | verified | no_response | unknown | null(unanswered)
  latencyDays: number | null; // mailed→response; null if no response logged
  userKey?: string;           // salted contributor token (internal to aggregation only)
}

const FAVORABLE = new Set(["deleted", "updated"]); // the item changed or was removed
const RESPONDED = new Set(["deleted", "updated", "verified", "no_response", "unknown"]);

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// A pattern cell. `sample` is always the honest observation count; the rate/median
// fields are null when sample < K_ANON_MIN so nothing thin is ever presented.
export interface PatternCell {
  key: string;
  sample: number;
  responded: number;
  favorable: number;
  favorableRate: number | null;   // favorable / responded, k-anon gated
  medianLatencyDays: number | null;
  sufficient: boolean;            // sample >= K_ANON_MIN
}

function cell(key: string, records: OutcomeRecord[]): PatternCell {
  const sample = records.length;
  const responded = records.filter((r) => r.outcome != null && RESPONDED.has(r.outcome)).length;
  const favorable = records.filter((r) => r.outcome != null && FAVORABLE.has(r.outcome)).length;
  const latencies = records.map((r) => r.latencyDays).filter((d): d is number => d != null);

  // Distinct-contributor k-anonymity: count unique salted user keys and the
  // largest single-contributor share, so one heavy user can never BE a cell.
  const byUser = new Map<string, number>();
  for (const r of records) if (r.userKey) byUser.set(r.userKey, (byUser.get(r.userKey) ?? 0) + 1);
  const contributors = byUser.size;
  const maxShare = sample && byUser.size ? Math.max(...byUser.values()) / sample : 1;
  const sufficient = sample >= K_ANON_MIN && contributors >= MIN_CONTRIBUTORS && maxShare <= MAX_CONTRIBUTOR_SHARE;

  return {
    key, sample, responded, favorable,
    // Each statistic is gated on the size of ITS OWN base, not the total sample.
    favorableRate: sufficient && responded >= K_ANON_MIN ? Math.round((favorable / responded) * 100) / 100 : null,
    medianLatencyDays: sufficient && latencies.length >= K_ANON_MIN ? median(latencies) : null,
    sufficient,
  };
}

function groupBy<K>(records: OutcomeRecord[], keyOf: (r: OutcomeRecord) => K | null): Map<K, OutcomeRecord[]> {
  const m = new Map<K, OutcomeRecord[]>();
  for (const r of records) {
    const k = keyOf(r);
    if (k == null) continue;
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return m;
}

export interface OutcomeStats {
  totalObservations: number;
  byStrategy: PatternCell[];
  byBureau: PatternCell[];
  byRound: PatternCell[];
  byAccountType: PatternCell[];
  // Only cells that clear k-anonymity — the safe set for any display.
  reportableCells: number;
  generatedFrom: number; // corpus size (for the "N completed disputes" honesty line)
}

export function aggregateOutcomes(corpus: OutcomeRecord[]): OutcomeStats {
  // Deterministic order: by sample desc, then key asc as a total tiebreak (so the
  // output never depends on Map insertion / DB row order).
  const mk = (m: Map<string | number, OutcomeRecord[]>, prefix: string) =>
    [...m.entries()].map(([k, recs]) => cell(`${prefix}:${k}`, recs))
      .sort((a, b) => (b.sample - a.sample) || a.key.localeCompare(b.key));

  const byStrategy = mk(groupBy(corpus, (r) => r.strategy), "strategy");
  const byBureau = mk(groupBy(corpus, (r) => r.bureau), "bureau");
  const byRound = mk(groupBy(corpus, (r) => r.round), "round");
  const byAccountType = mk(groupBy(corpus, (r) => r.accountType), "type");

  const all = [...byStrategy, ...byBureau, ...byRound, ...byAccountType];
  return {
    totalObservations: corpus.length,
    byStrategy, byBureau, byRound, byAccountType,
    reportableCells: all.filter((c) => c.sufficient).length,
    generatedFrom: corpus.length,
  };
}

// Historical Pattern Engine — human-readable, k-anon-safe pattern lines derived
// ONLY from cells that clear the threshold. Returns [] when nothing is reportable
// yet (the honest early state). Every line is a factual historical statement.
export function reportablePatterns(stats: OutcomeStats): string[] {
  const out: string[] = [];
  const label = (c: PatternCell) => c.key.split(":")[1];

  const strat = stats.byStrategy.filter((c) => c.sufficient && c.favorableRate != null)
    .sort((a, b) => (b.favorableRate! - a.favorableRate!) || a.key.localeCompare(b.key));
  if (strat.length >= 2 && strat[0].favorableRate! > strat[strat.length - 1].favorableRate!) {
    out.push(`Across ${strat[0].responded} responded disputes, the “${label(strat[0])}” approach saw the item changed or removed more often than “${label(strat[strat.length - 1])}.”`);
  }
  const bureau = stats.byBureau.filter((c) => c.sufficient && c.medianLatencyDays != null)
    .sort((a, b) => (a.medianLatencyDays! - b.medianLatencyDays!) || a.key.localeCompare(b.key));
  if (bureau.length >= 2 && bureau[0].medianLatencyDays! < bureau[bureau.length - 1].medianLatencyDays!) {
    out.push(`${label(bureau[0])} has historically responded fastest (median ${bureau[0].medianLatencyDays} days) among bureaus with enough data.`);
  }
  // Rank rounds by the SAME metric the sentence asserts (favorable rate), not by
  // round number, and emit only when the top strictly beats the bottom.
  const round = stats.byRound.filter((c) => c.sufficient && c.favorableRate != null)
    .sort((a, b) => (b.favorableRate! - a.favorableRate!) || a.key.localeCompare(b.key));
  if (round.length >= 2 && round[0].favorableRate! > round[round.length - 1].favorableRate!) {
    out.push(`Round ${label(round[0])} disputes changed the item more often than Round ${label(round[round.length - 1])} in the logged history.`);
  }
  return out;
}

// Strategy Ranking — orders candidate strategies for a context by their HISTORICAL
// favorable rate, but ONLY among cells that clear k-anonymity. Returns null when
// there isn't enough data, so the caller falls back to the deterministic rule
// engine (recommend.ts) rather than an unearned "ranking".
export function rankStrategiesByHistory(stats: OutcomeStats): { strategy: string; favorableRate: number; sample: number; responded: number }[] | null {
  const ranked = stats.byStrategy
    .filter((c) => c.sufficient && c.favorableRate != null)
    .map((c) => ({ strategy: c.key.split(":")[1], favorableRate: c.favorableRate!, sample: c.sample, responded: c.responded }))
    .sort((a, b) => (b.favorableRate - a.favorableRate) || a.strategy.localeCompare(b.strategy));
  return ranked.length ? ranked : null;
}
