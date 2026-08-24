import type { AccountType, Bureau } from "@prisma/client";
import { obsolescenceWindowYears, bureauTextBlob, reportingOffsetDays } from "./obsolescence";
import { getBureauData } from "./bureauData";

// Display-layer math for the §605 clock and duplicate-debt grouping. Everything
// here derives from engines that already drive scoring/recommendation/letters
// (lib/obsolescence.ts, Tradeline.duplicateGroup from lib/analyze.ts) — this file
// only makes them visible. It never invents a date: no DOFD on file → no claim.

const BUREAUS: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

// How many bureaus' reports actually told us something about this account —
// PRESENT or affirmatively ABSENT. `hasCrossBureauKnowledge` collapses this to a
// boolean (>= 2), which silently merges "one bureau" with "no bureau at all", so
// a caller branching on its negation and then saying "this bureau" names a
// bureau that does not exist. Every account of a multi-bureau report parsed by
// the fallback extractor has ZERO known bureaus, so that is not an edge case —
// it is the fail-closed default. Callers need the three states: 0, 1, 2+.
export function knownBureauCount(bureauData: unknown): number {
  const data = getBureauData(bureauData);
  // Only the three real bureaus: the account-level UNATTRIBUTED entry
  // (lib/parse.ts) is deliberately not a bureau and is UNKNOWN anyway.
  return BUREAUS.filter((b) => data[b]?.presence === "PRESENT" || data[b]?.presence === "ABSENT").length;
}

// ---------------------------------------------------------------------------
// Dates as reports actually print them.
//
// `new Date()` cannot read "08/2021" — one of the most common date-of-first-
// delinquency formats on a consumer report — so the §605 clock, the single
// strongest obsolescence argument the product has, simply never ran for those
// reports. It also silently WIDENS a month into a day: `new Date("2021-08")` is
// August 1st, a day the report never stated.
//
// That distinction is load-bearing, not pedantic: `Tradeline.dateOfFirstDelinquency`
// is printed inside a mailed dispute letter as "The date of first delinquency is
// reported as <full date>" (lib/letter.ts). A day we invented must never reach
// that sentence. So precision is carried, never discarded: a month-precision
// DOFD drives the clock but is not laundered into the day-precision column.
// ---------------------------------------------------------------------------
export type DatePrecision = "day" | "month";
export interface ParsedReportDate {
  date: Date;
  precision: DatePrecision;
}

// Last instant-of-month, UTC. A month-precision DOFD is anchored to the LAST day
// of that month for window math: the §605 window then expires at the latest date
// the report's own wording allows, so the product can never claim an item is
// obsolete before it provably is (the same conservatism as the §1681c(c)(1)
// 180-day offset).
function endOfMonthUTC(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

// A two-digit year on a credit report is in the past — a date of first
// delinquency cannot be in the future. Standard sliding window: 2000+yy unless
// that lands ahead of the current year, in which case it was last century.
function expandTwoDigitYear(yy: number): number {
  const thisYear = new Date().getUTCFullYear();
  return 2000 + yy <= thisYear ? 2000 + yy : 1900 + yy;
}

export function parseReportDate(raw: string | Date | null | undefined): ParsedReportDate | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : { date: raw, precision: "day" };
  const v = raw.trim();
  if (!v) return null;

  const inRange = (y: number) => y >= 1900 && y <= 2100;

  // Day precision: YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY (and 1-2 digit month/day).
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    if (!inRange(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCMonth() === m - 1 ? { date, precision: "day" } : null;
  }
  const mdy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(v);
  if (mdy) {
    const [m, d, y] = [Number(mdy[1]), Number(mdy[2]), Number(mdy[3])];
    if (!inRange(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCMonth() === m - 1 ? { date, precision: "day" } : null;
  }
  // MM/DD/YY — three components, so the day is stated; only the century is not.
  const mdyy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/.exec(v);
  if (mdyy) {
    const [m, d] = [Number(mdyy[1]), Number(mdyy[2])];
    const y = expandTwoDigitYear(Number(mdyy[3]));
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCMonth() === m - 1 ? { date, precision: "day" } : null;
  }

  // Month precision: MM/YYYY, MM-YYYY, YYYY-MM.
  const my = /^(\d{1,2})[\/-](\d{4})$/.exec(v);
  if (my) {
    const [m, y] = [Number(my[1]), Number(my[2])];
    if (!inRange(y) || m < 1 || m > 12) return null;
    return { date: endOfMonthUTC(y, m - 1), precision: "month" };
  }
  const ym = /^(\d{4})[\/-](\d{1,2})$/.exec(v);
  if (ym) {
    const [y, m] = [Number(ym[1]), Number(ym[2])];
    if (!inRange(y) || m < 1 || m > 12) return null;
    return { date: endOfMonthUTC(y, m - 1), precision: "month" };
  }
  // MM/YY — MONTH precision. Two numbers, and the second one is a YEAR, not a
  // day: a date of first delinquency without a year cannot anchor anything, so
  // "08/21" is August 2021. Left to the loose branch below it parsed as
  // 2001-08-21 at DAY precision — a fabricated day AND a twenty-year-early
  // anchor, which would let the §605 clock call a 2021 delinquency obsolete.
  // The month is what the report stated, so the month is what we keep.
  const myy = /^(\d{1,2})[\/-](\d{2})$/.exec(v);
  if (myy) {
    const m = Number(myy[1]);
    if (m < 1 || m > 12) return null; // 21/08 and the like: ambiguous, refused
    return { date: endOfMonthUTC(expandTwoDigitYear(Number(myy[2])), m - 1), precision: "month" };
  }

  // A bare year is YEAR precision. There is no honest month to anchor a §605
  // clock to, and `new Date("2021")` would silently claim January — so refuse.
  if (/^\d{4}$/.test(v)) return null;

  // Anything else ("Aug 2021", "August 15, 2021") — let the platform try, but
  // only after the string states a four-digit year itself. Without that guard
  // `new Date` invents one: "Aug 21" becomes the 21st of August in the CURRENT
  // year, a date the report never gave, at a precision it never gave either.
  // Every shape whose year is only two digits is resolved explicitly above, so
  // by this point a two-digit number left over can only be a day.
  if (!/\b\d{4}\b/.test(v)) return null;

  // Read the result through UTC getters: the platform parses a bare month-name
  // string in LOCAL time, and a behind-UTC zone would otherwise roll it back
  // into the previous month.
  const loose = new Date(v + " UTC");
  if (isNaN(loose.getTime()) || !inRange(loose.getUTCFullYear())) return null;
  const namesADay = /\d{1,2}(?!\d)/.test(v.replace(/\d{4}/g, ""));
  return namesADay
    ? { date: loose, precision: "day" }
    : { date: endOfMonthUTC(loose.getUTCFullYear(), loose.getUTCMonth()), precision: "month" };
}

// THE date of first delinquency for this account, from the persisted column
// first and the report's own per-bureau text second. One derivation, so the
// §605 clock, the scoring engine, the condition model and the "what stays
// uncertain" copy can never disagree about whether a DOFD exists.
export interface ReportedDofd extends ParsedReportDate {
  source: "column" | "report";
}

export function reportedDofd(t: {
  dateOfFirstDelinquency?: Date | string | null;
  bureauData?: unknown;
}): ReportedDofd | null {
  const fromColumn = parseReportDate(t.dateOfFirstDelinquency ?? null);
  if (fromColumn) return { ...fromColumn, source: "column" };

  // Nothing in the column: read what the report printed. Values live under each
  // bureau AND under the account-level UNATTRIBUTED key, so take every entry.
  const data = getBureauData(t.bureauData) as Record<string, { dofd?: string } | undefined>;
  let latest: ParsedReportDate | null = null;
  for (const entry of Object.values(data)) {
    const parsed = parseReportDate(entry?.dofd);
    // When bureaus disagree, the LATEST date is the conservative one: the §605
    // window closes last, so obsolescence is never claimed early.
    if (parsed && (!latest || parsed.date.getTime() > latest.date.getTime())) latest = parsed;
  }
  return latest ? { ...latest, source: "report" } : null;
}

export interface FallOffInsight {
  windowYears: number;
  fallOffDate: Date; // DOFD + window, UTC calendar math
  monthsRemaining: number; // 0 once the window has passed
  pastWindow: boolean;
  // "month" when the report gave a month but no day — the window is anchored to
  // the last day of that month, so the date shown is the latest the report
  // allows and obsolescence is never claimed early.
  dofdPrecision: DatePrecision;
}

export function fallOffInsight(t: {
  accountType: AccountType;
  creditorName?: string | null;
  bureauData: unknown;
  dateOfFirstDelinquency?: Date | string | null;
}): FallOffInsight | null {
  // Reads the column first, then the report's own text — so a "08/2021" DOFD,
  // which the column cannot hold at day precision, still runs the clock instead
  // of silently disabling the product's strongest obsolescence argument.
  const reported = reportedDofd(t);
  if (!reported) return null;
  const dofd = reported.date;

  const windowYears = obsolescenceWindowYears({
    accountType: t.accountType,
    creditorName: t.creditorName,
    text: bureauTextBlob(getBureauData(t.bureauData)),
  });
  // §1681c(c)(1): collection/charge-off clocks start 180 days after DOFD.
  const offsetMs = reportingOffsetDays(t.accountType) * 24 * 60 * 60 * 1000;
  const fallOffDate = new Date(
    Date.UTC(dofd.getUTCFullYear() + windowYears, dofd.getUTCMonth(), dofd.getUTCDate()) + offsetMs
  );
  const msLeft = fallOffDate.getTime() - Date.now();
  const monthsRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24 * 30.44)));
  return { windowYears, fallOffDate, monthsRemaining, pastWindow: msLeft <= 0, dofdPrecision: reported.precision };
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

// Groups with 2+ members only — a singleton "group" is not a duplicate.
export function duplicateGroups(tradelines: { duplicateGroup: string | null }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tradelines) {
    if (t.duplicateGroup) counts.set(t.duplicateGroup, (counts.get(t.duplicateGroup) ?? 0) + 1);
  }
  for (const [key, n] of counts) if (n < 2) counts.delete(key);
  return counts;
}

// Keep the priority (score-desc) order, but pull members of the same duplicate
// group adjacent — anchored at the position of the group's strongest member — so
// "these entries are the same debt" reads side-by-side instead of scattered.
export function groupAdjacentOrder<T extends { id: string; duplicateGroup: string | null }>(
  tradelines: T[],
  groups: Map<string, number>
): T[] {
  const emitted = new Set<string>();
  const out: T[] = [];
  for (const t of tradelines) {
    if (emitted.has(t.id)) continue;
    out.push(t);
    emitted.add(t.id);
    if (t.duplicateGroup && groups.has(t.duplicateGroup)) {
      for (const other of tradelines) {
        if (!emitted.has(other.id) && other.duplicateGroup === t.duplicateGroup) {
          out.push(other);
          emitted.add(other.id);
        }
      }
    }
  }
  return out;
}
