// Self-Reported Score Tracker — pure helpers shared by the page and the API route.
//
// Adopted from the p0 score-intelligence lane, commit 96da6d1 ("fix: make Score
// Tracker explicitly self-reported"), which added this file unmodified through
// the rest of that lane's history. No session/DB/network imports — every export
// here is a pure function over plain data, so it is directly unit-testable and
// carries no dependency on how the caller resolves the current user.
//
// RC1 addition (not in the p0 source): localDateIso/todayIso. The p0 lane put an
// equivalent inline, un-exported `todayISO()` in app/scores/page.tsx that used
// getFullYear/getMonth/getDate (local-time getters) instead of the OLD base
// bug — `new Date().toISOString().slice(0, 10)` (UTC) — which defaults the date
// picker to TOMORROW for any US-evening visitor (already past UTC midnight).
// That is the identical defect class the letters lane already fixed for the
// mark-mailed picker (`localDateIso`, app/letters/page.tsx:535-542, RB-5). This
// file exports the equivalent as testable pure functions — named to match that
// established convention — so app/scores/page.tsx can stay a thin consumer and
// scripts/score-tracker-self-reported.test.ts can pin the exact UTC-evening case
// with a real Date instant instead of only a source-text regex.

export interface SelfReportedScoreEntry {
  id: string;
  bureau: string;
  score: number;
  recordedAt: Date | string;
  createdAt: Date | string;
}

export interface SelfReportedScoreSeries {
  bureau: string;
  entries: SelfReportedScoreEntry[];
  first: SelfReportedScoreEntry;
  latest: SelfReportedScoreEntry;
  change: number | null;
}

export const SELF_REPORTED_SCORE_DISCLOSURE =
  "Every score and change shown here was entered by you. CreditVector does not pull live scores and has not independently verified these values against a credit report or with the selected bureau. Scores can differ by model, source, and date.";

export const SELF_REPORTED_SCORE_COMPARABILITY_NOTE =
  "Changes compare the values you entered for the same bureau. They do not establish that the scoring model or monitoring source was the same.";

function recordedAtMs(entry: SelfReportedScoreEntry): number {
  const value = entry.recordedAt instanceof Date ? entry.recordedAt.getTime() : new Date(entry.recordedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function createdAtMs(entry: SelfReportedScoreEntry): number {
  const value = entry.createdAt instanceof Date ? entry.createdAt.getTime() : new Date(entry.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

// Stable same-day tie-break: recordedAt is day-granular in the UI, so two
// same-day entries for one bureau have no natural order. Without this, "first
// to latest" (and therefore the delta's sign and color) could invert on every
// reload depending on whatever order the DB happened to return rows in.
export function compareSelfReportedScoreEntries(
  left: SelfReportedScoreEntry,
  right: SelfReportedScoreEntry,
): number {
  return recordedAtMs(left) - recordedAtMs(right)
    || createdAtMs(left) - createdAtMs(right)
    || left.id.localeCompare(right.id);
}

export function buildSelfReportedScoreSeries(entries: readonly SelfReportedScoreEntry[]): SelfReportedScoreSeries[] {
  const byBureau = new Map<string, SelfReportedScoreEntry[]>();
  for (const entry of entries) {
    const current = byBureau.get(entry.bureau) ?? [];
    current.push(entry);
    byBureau.set(entry.bureau, current);
  }

  return [...byBureau.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bureau, values]) => {
      const sorted = [...values].sort(compareSelfReportedScoreEntries);
      const first = sorted[0];
      const latest = sorted[sorted.length - 1];
      return {
        bureau,
        entries: sorted,
        first,
        latest,
        change: sorted.length >= 2 ? latest.score - first.score : null,
      };
    });
}

export function selfReportedScoreInventory(entries: readonly { bureau: string }[]): {
  entryCount: number;
  bureauCount: number;
  stat: string;
  sub: string;
} {
  const entryCount = entries.length;
  const bureauCount = new Set(entries.map((entry) => entry.bureau)).size;
  if (entryCount === 0) {
    return { entryCount, bureauCount, stat: "Add a score", sub: "self-reported entries only" };
  }
  return {
    entryCount,
    bureauCount,
    stat: `${entryCount} ${entryCount === 1 ? "entry" : "entries"}`,
    sub: `self-reported · ${bureauCount} ${bureauCount === 1 ? "bureau" : "bureaus"}`,
  };
}

export function formatUserRecordedScoreChange(change: number): string {
  const value = change > 0 ? `+${change}` : change < 0 ? `−${Math.abs(change)}` : "0";
  return `User-recorded score change: ${value} ${Math.abs(change) === 1 ? "point" : "points"}.`;
}

// The visitor's own wall-clock calendar date, as YYYY-MM-DD — NOT the UTC
// calendar date. getFullYear/getMonth/getDate are local-time getters (unlike
// their UTC counterparts), so this reads the browser's (or, in a server
// context, the process's) own timezone. Accepts a Date so it is directly
// testable against a fixed instant instead of only against "now".
export function localDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return localDateIso(new Date());
}
