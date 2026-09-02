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
import { fallOffInsight, reportedDofd } from "@/lib/tradelineInsights";
import { getBureauData } from "@/lib/bureauData";
import { bureauTextBlob } from "@/lib/obsolescence";
import { ownOutcomeTrack, ownHistorySummary, type OwnTrack } from "@/lib/outcomeLedger";
import { listKaiEvents } from "@/lib/kaiEvents";

const DEROGATORY: ReadonlySet<AccountType> = new Set<AccountType>(["COLLECTION", "CHARGE_OFF", "PUBLIC_RECORD"]);

// ---------------------------------------------------------------------------
// RC1-S3 (Credit Truth Core) — the CONDITION model.
//
// `AccountType` answers "what KIND of account is this" (product type + the two
// legacy condition-ish types COLLECTION/CHARGE_OFF/PUBLIC_RECORD). It does NOT
// answer "what CONDITION is this account in" — a charged-off Capital One card
// is still typed REVOLVING, and a collection-status OneMain loan is still typed
// INSTALLMENT. The report says so in its per-bureau STATUS text, which lives in
// `bureauData` (lib/bureauData.ts) and was previously read by nobody making the
// negative/clean call. That is the whole of the false-"Clean" defect: type is
// not condition, and a missing date-of-first-delinquency is not evidence of
// good standing.
//
// The condition model below reads the report's own words. Three rules govern
// it, and none of them may be weakened:
//   1. Adverse evidence in the status/remarks text makes an account
//      DEROGATORY, whatever its product type says.
//   2. Absence of evidence is NEVER "clean". No adverse marker AND no
//      affirmative statement of standing => NEEDS_REVIEW (unknown stays
//      unknown; it is not laundered into either verdict).
//   3. A negated statement ("never late", "no late payments") is evidence the
//      adverse event did NOT happen — it must never be read as the event. The
//      same holds for a FIELD LABEL carrying a zero or "none" value: "Past due:
//      $0" is the report stating the account is NOT past due, and reading the
//      label as the event would flag a current account as derogatory — the
//      A2-01 harm inverted, and newly false rather than merely incomplete.
// ---------------------------------------------------------------------------

// Field LABELS that a report prints whether or not a value follows. They must
// never be read as evidence: "Date of first delinquency:" is a label, not a
// delinquency, and "current balance" is an amount, not a statement of standing.
const NEUTRAL_LABELS: RegExp[] = [
  /date of first delinquency/g,
  /first delinquency/g,
  /\bdofd\b/g,
  /current balance/g,
  /high balance/g,
  /original creditor/g,
  // Programs NAMED after the adverse event they exist to avoid. "Foreclosure
  // prevention" is the opposite of a foreclosure.
  /foreclos\w*\s+(?:prevention|avoidance|alternative|counsel\w*|assistance)/g,
  /loss mitigation/g,
];

// An adverse FIELD LABEL whose value says the thing it names did not happen.
// A value may only cancel the label it actually belongs to, and the two kinds
// of label are not the same:
//
//   • AMOUNT-BEARING labels — "past due", "late payments" — ARE quantities. A
//     zero is a direct statement about them: "Past due: $0" means the account
//     is not past due. A bare zero cancels these.
//   • EVENT labels — "charge-off", "collection", "delinquent" — name something
//     that either happened or did not. A number next to one is an amount
//     FIELD, not the event, so only an explicit `amount`/`amt` qualifier lets a
//     zero cancel it ("Charge-off amount: $0"). A word value that denies the
//     event outright ("Charge-off: none") still cancels it.
//
// `balance` is deliberately absent from every qualifier: a zero BALANCE says
// nothing about condition. A paid charge-off and a paid collection carry
// "Balance: $0" BY DEFINITION and stay derogatory for seven years from DOFD —
// letting a zero balance delete the status would print "Account in good
// standing" over exactly the item a consumer came here to work on.
//
// (Text is normalized first, so "$", ":" and "." are gone — "Charge-off
// amount: $0.00" arrives as "charge-off amount 0 00".)
const ZERO_VALUE = String.raw`(?:0+(?:\s+0+)*|none|n\/a|na|nil)`;
const ZERO_VALUED_AMOUNT_LABEL = new RegExp(
  String.raw`\b(?:amount\s+)?(?:past\s*due|late\s+payments?)\s*(?:amount|amt|payments?)?\s*${ZERO_VALUE}\b`,
  "g"
);
const EVENT_LABEL = String.raw`(?:charge[-\s]?off|collection|delinquen\w*)`;
const ZERO_VALUED_EVENT_AMOUNT = new RegExp(
  String.raw`\b(?:${EVENT_LABEL}\s*(?:amount|amt)|(?:amount|amt)\s+(?:of\s+)?${EVENT_LABEL})\s*${ZERO_VALUE}\b`,
  "g"
);
const NONE_VALUED_EVENT_LABEL = new RegExp(String.raw`\b${EVENT_LABEL}\s*(?:none|n\/a|na|nil)\b`, "g");

// "Never late", "no late payments", "0 times 30 days late" — statements that
// the adverse event did NOT occur. Stripped before adverse matching (rule 3).
const NEGATED_ADVERSE =
  /\b(?:never|no|not|zero|0)\s+(?:\w+\s+){0,3}?(?:late|lates|delinquen\w*|past\s*due|derogator\w*|missed\s+payments?|charge[-\s]?offs?|collections?|repossess\w*)\b/g;

// Adverse condition as consumer reports actually word it.
const ADVERSE_MARKERS: RegExp[] = [
  /charge[-\s]?off/, /charged[-\s]?off/, /\bchargeoff\b/,
  /\bcollection/, /placed (?:for|with) collection/, /assigned to collection/,
  /past\s*due/, /\bdelinquen/, /\bderogator/,
  /\d+\s*days?\s*late/, /\bwas\s+late\b/, /\blate\s+payments?\b/, /\bpaid\s+late\b/,
  /repossess/, /voluntary surrender/, /\bforeclos/,
  /\bdefault(?:ed)?\b/,
  // L-1 (review): rating-code and hand-off wordings the first pass missed.
  // `late 30`, `late 60 x2` — but never a "late 0", which the zero-value strip
  // above has already removed anyway.
  /\blate\s+[1-9]\d*/, /transferred to (?:recovery|attorney|legal)/,
  /settled(?!\s+in\s+full)/, /less than (?:the )?full/,
  /written\s+off/, /write[-\s]?off/, /\bbad debt\b/, /profit and loss/,
  /\bbankrupt/, /\bjudgment\b/, /\bjudgement\b/, /\blien\b/, /garnish/,
];

// Affirmative statements of standing. Required before any CLEAN verdict —
// a "Clean" claim has to be earned by what the report SAYS, never by what it
// omits.
const AFFIRMATIVE_STANDING: RegExp[] = [
  /pay(?:s|ing)? as agreed/, /paid as agreed/, /\bas agreed\b/,
  /\bcurrent\b/, /account (?:is )?current/,
  /never late/, /no late payments?/, /\bnever delinquent\b/,
  /\bin good standing\b/, /no derogator/,
  /paid in full/, /paid on time/, /exceptional payment history/,
];

// Lowercase, drop punctuation, collapse whitespace, then remove label noise.
function normalizeConditionText(raw: string): string {
  let t = (raw || "").toLowerCase().replace(/[^a-z0-9/\-\s]+/g, " ").replace(/\s+/g, " ").trim();
  for (const label of NEUTRAL_LABELS) t = t.replace(label, " ");
  return t.replace(/\s+/g, " ").trim();
}

export function hasAdverseStatusEvidence(text: string): boolean {
  // Order matters: remove the zero/none-valued labels BEFORE the negated
  // phrases, so "Current, amount past due $0" loses "past due 0" outright
  // rather than leaving a bare "past due" behind.
  const t = normalizeConditionText(text)
    .replace(ZERO_VALUED_AMOUNT_LABEL, " ")
    .replace(ZERO_VALUED_EVENT_AMOUNT, " ")
    .replace(NONE_VALUED_EVENT_LABEL, " ")
    .replace(NEGATED_ADVERSE, " ");
  return ADVERSE_MARKERS.some((re) => re.test(t));
}

export function hasAffirmativeStandingEvidence(text: string): boolean {
  const t = normalizeConditionText(text);
  return AFFIRMATIVE_STANDING.some((re) => re.test(t));
}

// DEROGATORY   — the report attests an adverse condition (or the account type
//                is itself a collection/charge-off/public record, or a
//                first-delinquency date is on file).
// CLEAN        — the report affirmatively states the account is in good
//                standing AND carries no adverse marker.
// NEEDS_REVIEW — we do not know. No adverse evidence, no affirmative standing.
//                This is the honest default for parser silence; it is NOT a
//                statement that the account is fine.
// NOT_APPLICABLE — inquiries and government/statutory debts are outside the
//                condition model entirely (they are excluded from the dispute
//                queue for their own, separate reasons).
export type FactualCondition = "DEROGATORY" | "CLEAN" | "NEEDS_REVIEW" | "NOT_APPLICABLE";

export interface ConditionInput {
  accountType: AccountType;
  dateOfFirstDelinquency: Date | string | null;
  // The stored per-bureau JSON (Prisma `Tradeline.bureauData`). Optional so
  // callers holding a narrowed projection still compile — but a caller that
  // omits it can only ever get DEROGATORY from type/DOFD, never from the
  // report's own status text, so pass the whole row wherever you have it.
  bureauData?: unknown;
}

export function factualCondition(t: ConditionInput): FactualCondition {
  if (t.accountType === "INQUIRY" || t.accountType === "GOVERNMENT") return "NOT_APPLICABLE";
  if (DEROGATORY.has(t.accountType)) return "DEROGATORY";
  // The report's own words, across every bureau entry we hold (and the
  // unattributed account-level observation — lib/parse.ts UNATTRIBUTED).
  const text = bureauTextBlob(getBureauData(t.bureauData));
  if (hasAdverseStatusEvidence(text)) return "DEROGATORY";
  // A first-delinquency date on file is a derogatory EVENT. Read it through the
  // shared derivation so a month-precision DOFD the column cannot hold
  // ("08/2021") still counts — the absence of a PARSED day must never launder a
  // reported delinquency into "we found nothing".
  if (reportedDofd(t) != null) return "DEROGATORY";
  if (hasAffirmativeStandingEvidence(text)) return "CLEAN";
  return "NEEDS_REVIEW";
}

// RB-2 (Founder Experience Gate): the single fact-test for "is this tradeline
// an actual negative" — reused everywhere a per-item or aggregate negative
// state is shown (the `negatives` count below, Mission Control's Deferred
// Queue, the Strategy Desk / Tradelines per-item presentation, and the AI
// Action Plan queue). NEVER the disputability `probability`/`score` band: the
// scoring engine (lib/scoring.ts, untouched here) gives every non-government
// account TYPE a nonzero baseline "worth a look" score regardless of payment
// history, so a clean, never-late account (e.g. a student loan or auto loan
// with no missed payment) still scores > 0 and would be miscounted as a
// negative if `probability !== NOT_RECOMMENDED` were the test — the bug this
// replaces.
//
// RC1-S3: this is now the DEROGATORY arm of `factualCondition` above, so the
// report's own per-bureau status text counts ("Charge-Off", "Collection",
// "120 days past due" on a REVOLVING/INSTALLMENT row) alongside a derogatory
// account TYPE and a first-delinquency date on file. The true-set only GROWS —
// every account this returned true for before still returns true.
//
// It stays strictly "the report attests something adverse". An account we
// could not read (NEEDS_REVIEW) is NOT a negative here — and it is NOT clean
// either. Callers that make the affirmative "in good standing" claim must ask
// for `factualCondition(t) === "CLEAN"`; `!isFactualNegative(t)` means
// "not a confirmed negative", which includes "we don't know".
export function isFactualNegative(t: ConditionInput): boolean {
  return factualCondition(t) === "DEROGATORY";
}

// THE dispute queue. Two surfaces used to compute this filter independently —
// the Strategy Desk page and the Action Plan route — and when only one of them
// changed basis the two disagreed, which is exactly what
// app/strategist/AiPlan.tsx compares to decide whether a generated plan has
// gone stale ("Your dispute queue has changed since this plan was written").
// A queue that two files derive separately WILL drift, and the drift renders as
// a false statement about the consumer's own case. So it is derived once, here.
//
// Both conditions are load-bearing and mean different things: NOT_RECOMMENDED
// is a government/statutory debt that generally cannot be disputed off a report
// (excluded for a legal reason), while `isFactualNegative` asks whether the
// report attests anything adverse at all (excluded for an evidentiary one).
export function disputeQueue<T extends ConditionInput & { probability: string }>(rows: T[]): T[] {
  return rows.filter((t) => t.probability !== "NOT_RECOMMENDED" && isFactualNegative(t));
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
