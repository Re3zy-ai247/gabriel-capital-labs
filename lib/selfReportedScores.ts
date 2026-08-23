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

// ── Server-side future-date guard (M-1 remediation) ─────────────────────────
// The client's `<input type="date">` always sends a bare "YYYY-MM-DD" string
// (via todayIso() above), never a full timestamp. Comparing that string's
// UTC-midnight parse against the SERVER's `Date.now()` — the original
// server-side S-02 fix — rejects the visitor's own "today" for anyone whose
// local time is ahead of UTC: their calendar day has turned over locally
// while the server's UTC day has not, so `new Date("<their today>")` (UTC
// midnight of that date) is still numerically in the future relative to the
// server's instant. isFutureLocalDate compares CALENDAR DATES in the
// SUBMITTER's own frame instead, using a client-declared UTC-offset —
// exactly the shape of the actual, only production payload — while leaving
// every other input shape byte-for-byte on the original strict check.
export const MAX_TIMEZONE_OFFSET_MINUTES = 14 * 60; // ±14h spans every real-world zone (UTC-12..UTC+14)

// Shifts a true UTC instant (in ms) into a given zone's wall-clock reading,
// then reads its calendar date. `offsetMinutes` uses the same sign
// convention as `Date.prototype.getTimezoneOffset()` (positive = behind
// UTC, e.g. +300 for New York; negative = ahead, e.g. -120 for Berlin in
// summer) — local = utc − offsetMinutes.
function localDateFromInstant(ms: number, offsetMinutes: number): string {
  return new Date(ms - offsetMinutes * 60000).toISOString().slice(0, 10);
}

// Returns true when `recordedAtRaw` should be refused as a future date.
//
//  - When `recordedAtRaw` is a bare "YYYY-MM-DD" string AND `offsetMinutes`
//    is present and finite: the offset is clamped to ±MAX_TIMEZONE_OFFSET_MINUTES
//    (bounding the maximum leniency any client — honest or malicious — can
//    claim to exactly one calendar day, never more) and the two calendar
//    DATE STRINGS are compared directly — never instants, so no timezone
//    math is applied to `recordedAtRaw` itself (it already IS the caller's
//    stated calendar date, verbatim; shifting it by an offset would corrupt
//    it, not correct it).
//  - Every other case — no offset, a non-finite offset, or `recordedAtRaw`
//    not date-only-shaped (a full timestamp, which this app's own client
//    never sends but a direct API call could) — fails closed to the
//    original instant-vs-instant check, unchanged.
export function isFutureLocalDate(
  recordedAtRaw: unknown,
  recordedAtMs: number,
  offsetMinutes: unknown,
  nowMs: number,
): boolean {
  if (typeof recordedAtRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(recordedAtRaw)) {
    const offset = Number(offsetMinutes);
    if (Number.isFinite(offset)) {
      const clamped = Math.max(-MAX_TIMEZONE_OFFSET_MINUTES, Math.min(MAX_TIMEZONE_OFFSET_MINUTES, offset));
      const callerToday = localDateFromInstant(nowMs, clamped);
      return recordedAtRaw > callerToday;
    }
  }
  return recordedAtMs > nowMs;
}
