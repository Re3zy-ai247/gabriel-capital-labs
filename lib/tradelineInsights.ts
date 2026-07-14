import type { AccountType } from "@prisma/client";
import { obsolescenceWindowYears, bureauTextBlob, reportingOffsetDays } from "./obsolescence";
import { getBureauData } from "./bureauData";

// Display-layer math for the §605 clock and duplicate-debt grouping. Everything
// here derives from engines that already drive scoring/recommendation/letters
// (lib/obsolescence.ts, Tradeline.duplicateGroup from lib/analyze.ts) — this file
// only makes them visible. It never invents a date: no DOFD on file → no claim.

export interface FallOffInsight {
  windowYears: number;
  fallOffDate: Date; // DOFD + window, UTC calendar math
  monthsRemaining: number; // 0 once the window has passed
  pastWindow: boolean;
}

export function fallOffInsight(t: {
  accountType: AccountType;
  creditorName?: string | null;
  bureauData: unknown;
  dateOfFirstDelinquency?: Date | string | null;
}): FallOffInsight | null {
  if (!t.dateOfFirstDelinquency) return null;
  const dofd = typeof t.dateOfFirstDelinquency === "string" ? new Date(t.dateOfFirstDelinquency) : t.dateOfFirstDelinquency;
  if (isNaN(dofd.getTime())) return null;

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
  return { windowYears, fallOffDate, monthsRemaining, pastWindow: msLeft <= 0 };
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
