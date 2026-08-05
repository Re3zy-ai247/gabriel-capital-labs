// The platform loads the user's case ONCE into an immutable snapshot; every module
// is a pure function over it, so no calculation is ever duplicated. Reuses the
// existing engines (Outcome Ledger, the §605 obsolescence engine, Kai events) and
// the §611 window constant — it computes no scoring, strategy, or obsolescence
// logic those engines already own; the only inline math is the trivial day-count
// against that constant.
import type { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { yearsSince } from "@/lib/utils";
import { REINVESTIGATION_DAYS, daysElapsedSinceEstimatedReceipt } from "@/lib/forecast";
import { fallOffInsight } from "@/lib/tradelineInsights";
import { ownOutcomeTrack, ownHistorySummary, type OwnTrack } from "@/lib/outcomeLedger";
import { listKaiEvents } from "@/lib/kaiEvents";

const DEROGATORY: ReadonlySet<AccountType> = new Set<AccountType>(["COLLECTION", "CHARGE_OFF", "PUBLIC_RECORD"]);

// RB-2 (Founder Experience Gate): the single fact-test for "is this tradeline
// an actual negative" — reused everywhere a per-item or aggregate negative
// state is shown (the `negatives` count below, Mission Control's Deferred
// Queue, and the Strategy Desk / Tradelines per-item presentation). NEVER the
// disputability `probability`/`score` band: the scoring engine (lib/scoring.ts,
// untouched here) gives every non-government account TYPE a nonzero baseline
// "worth a look" score regardless of payment history, so a clean, never-late
// account (e.g. a student loan or auto loan with no missed payment) still
// scores > 0 and would be miscounted as a negative if `probability !==
// NOT_RECOMMENDED` were the test — the bug this replaces. A derogatory
// account TYPE (collection/charge-off/public-record) is always a negative;
// otherwise a genuine derogatory EVENT in the account's own history — a
// first-delinquency date actually on file (e.g. a late-payment history the
// account has since cured, still current) — counts it too. An account with
// neither (e.g. "Pays as agreed / Never late", no DOFD) has nothing to
// dispute.
export function isFactualNegative(t: { accountType: AccountType; dateOfFirstDelinquency: Date | string | null }): boolean {
  return (
    t.accountType !== "INQUIRY" &&
    t.accountType !== "GOVERNMENT" &&
    (DEROGATORY.has(t.accountType) || t.dateOfFirstDelinquency != null)
  );
}

export interface OpenWindow { recipient: string; daysElapsed: number; daysLeft: number; letterId: string }

export interface IntelSnapshot {
  userId: string;
  hasReport: boolean;
  // counts
  totalAccounts: number;
  negatives: number;            // unresolved derogatory-or-disputable, excluding inquiries
  resolved: number;
  collections: number;
  chargeOffs: number;
  publicRecords: number;
  inquiries: number;
  revolving: number;
  installment: number;
  mortgage: number;
  studentLoans: number;
  positives: number;            // reporting-positive accounts on file (we parse negatives → usually 0)
  disputable: number;
  duplicateGroups: number;
  // ages (years; null when no dated accounts)
  avgAccountAgeYears: number | null;
  oldestDerogatoryYears: number | null;
  youngestDerogatoryYears: number | null;
  // investigations
  openInvestigations: number;
  completedInvestigations: number;
  round2Ready: number;          // responded, not deleted, not yet followed up
  obsoleteOpportunities: number;// §605 window passed, unresolved
  // outcome intelligence (own, gate-free)
  ownTrack: OwnTrack;
  favorableRate: number | null; // deleted+updated / responded, own data
  respondedCount: number;
  ownHistoryLine: string | null;
  // windows
  openWindows: OpenWindow[];
  overdueWindows: number;
  // scores
  scoreByBureau: { bureau: string; latest: number; delta: number | null }[];
  // profile completeness (for mailability / readiness prerequisites)
  addressComplete: boolean;
  // recent events (timeline past)
  recentEvents: { type: string; at: string; payload: Record<string, unknown> }[];
  // capability we DON'T have from a credit report (disclosed honestly, never faked)
  utilizationTracked: false;
}

export async function loadSnapshot(userId: string): Promise<IntelSnapshot> {
  const [tradelines, letters, scoreEntries, user, ownTrack, events] = await Promise.all([
    prisma.tradeline.findMany({ where: { userId }, select: { accountType: true, creditorName: true, dateOpened: true, dateOfFirstDelinquency: true, resolved: true, duplicateGroup: true, probability: true, bureauData: true } }),
    prisma.letter.findMany({ where: { userId }, select: { id: true, recipientName: true, mailedAt: true, responseAt: true, responseOutcome: true, parentLetterId: true, status: true } }),
    prisma.scoreEntry.findMany({ where: { userId }, select: { bureau: true, score: true, recordedAt: true }, orderBy: { recordedAt: "asc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { addressLine1: true, city: true, state: true, zip: true } }),
    ownOutcomeTrack(userId),
    listKaiEvents(userId, 8),
  ]);

  const count = (t: AccountType) => tradelines.filter((x) => x.accountType === t).length;               // all on file (for credit mix)
  const active = (t: AccountType) => tradelines.filter((x) => x.accountType === t && !x.resolved).length; // unresolved only
  const derog = tradelines.filter(isFactualNegative);
  const ages = tradelines.map((t) => yearsSince(t.dateOpened)).filter((n): n is number => n != null);
  const derogAges = tradelines.filter((t) => DEROGATORY.has(t.accountType)).map((t) => yearsSince(t.dateOfFirstDelinquency)).filter((n): n is number => n != null);

  const followedUp = new Set(letters.map((l) => l.parentLetterId).filter(Boolean));
  const now = Date.now();
  const openWindows: OpenWindow[] = letters
    .filter((l) => l.status === "MAILED" && l.mailedAt && !l.responseAt)
    .map((l) => {
      // Receipt-anchored (lib/forecast.ts), not mailing-anchored — this feeds
      // operator-visible copy across modules.ts/academy.ts/portfolio.ts/
      // ExecutionRisk.ts, so it has to agree with every other §611 estimate
      // in the app (Phase 1A honesty-triple reconcile).
      const elapsed = daysElapsedSinceEstimatedReceipt(new Date(l.mailedAt as Date).getTime(), now);
      return { recipient: l.recipientName, daysElapsed: elapsed, daysLeft: REINVESTIGATION_DAYS - elapsed, letterId: l.id };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // own favorable rate across all strategies (deleted+updated / responded)
  let favorable = 0, responded = 0;
  for (const c of Object.values(ownTrack.byStrategy)) { favorable += c.favorable; responded += c.responded; }

  const byBureau = new Map<string, { score: number; at: number }[]>();
  for (const e of scoreEntries) {
    const a = byBureau.get(e.bureau) ?? []; a.push({ score: e.score, at: e.recordedAt.getTime() }); byBureau.set(e.bureau, a);
  }
  const scoreByBureau = [...byBureau.entries()].map(([bureau, arr]) => {
    const s = arr.sort((a, b) => a.at - b.at);
    return { bureau, latest: s[s.length - 1].score, delta: s.length >= 2 ? s[s.length - 1].score - s[0].score : null };
  });

  const avg = (ns: number[]) => (ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : null);

  return {
    userId,
    hasReport: tradelines.length > 0,
    totalAccounts: tradelines.length,
    negatives: derog.filter((t) => !t.resolved).length,
    resolved: tradelines.filter((t) => t.resolved).length,
    collections: active("COLLECTION"),
    chargeOffs: active("CHARGE_OFF"),
    publicRecords: active("PUBLIC_RECORD"),
    inquiries: count("INQUIRY"),
    revolving: count("REVOLVING"),
    installment: count("INSTALLMENT"),
    mortgage: count("MORTGAGE"),
    studentLoans: count("STUDENT_LOAN"),
    positives: tradelines.filter((t) => !DEROGATORY.has(t.accountType) && t.accountType !== "INQUIRY" && t.resolved).length,
    // RB-2 RESIDUAL-1: same fact test as `negatives` above — a factually
    // clean account (e.g. "pays as agreed, never late") is never disputable,
    // regardless of the nonzero baseline the scoring engine's `probability`
    // band would otherwise give it. Feeds "Plan a focused campaign for N
    // disputable items" and "Campaign ready" (lib/intelligence/modules.ts)
    // and the readiness timeline note — fixed once here, not per consumer.
    disputable: tradelines.filter((t) => !t.resolved && isFactualNegative(t)).length,
    duplicateGroups: new Set(tradelines.map((t) => t.duplicateGroup).filter(Boolean)).size,
    avgAccountAgeYears: avg(ages),
    oldestDerogatoryYears: derogAges.length ? Math.max(...derogAges) : null,
    youngestDerogatoryYears: derogAges.length ? Math.min(...derogAges) : null,
    openInvestigations: letters.filter((l) => l.status === "MAILED" && !l.responseAt).length,
    completedInvestigations: letters.filter((l) => l.responseAt).length,
    round2Ready: letters.filter((l) => l.responseAt && l.responseOutcome && l.responseOutcome !== "deleted" && !followedUp.has(l.id)).length,
    // §605 obsolescence via the canonical engine (applies the §1681c(c)(1) 180-day
    // collection/charge-off offset AND the 10-year bankruptcy window — never a bare 7).
    obsoleteOpportunities: tradelines.filter((t) => !t.resolved && DEROGATORY.has(t.accountType) && fallOffInsight({ accountType: t.accountType, creditorName: t.creditorName, bureauData: t.bureauData, dateOfFirstDelinquency: t.dateOfFirstDelinquency })?.pastWindow).length,
    ownTrack,
    favorableRate: responded > 0 ? Math.round((favorable / responded) * 100) / 100 : null,
    respondedCount: responded,
    ownHistoryLine: ownHistorySummary(ownTrack),
    openWindows,
    overdueWindows: openWindows.filter((w) => w.daysLeft <= 0).length,
    scoreByBureau,
    addressComplete: Boolean(user?.addressLine1 && user?.city && user?.state && user?.zip),
    recentEvents: events.map((e) => ({ type: e.type, at: new Date(e.occurredAt).toISOString(), payload: (e.payload ?? {}) as Record<string, unknown> })),
    utilizationTracked: false,
  };
}
