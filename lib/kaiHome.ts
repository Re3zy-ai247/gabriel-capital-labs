// Kai Home data engine (roadmap #7/#8, ADR-0007 E2). Everything here is PASSIVE
// intelligence: deterministic rules over the user's own rows + the KaiEvent
// stream. No AI calls, no invented facts — every card renders a receipt.
import type { Letter, Report, Tradeline } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listKaiEvents } from "@/lib/kaiEvents";
import { recommendStrategy } from "@/lib/recommend";
import { yearsSince } from "@/lib/utils";
import { reportedDofd } from "@/lib/tradelineInsights";
import { daysElapsedSinceEstimatedReceipt } from "@/lib/forecast";
// Phase 1A-R M1 (CCO correction): the same RB-2 fact test every other
// negative-count/negative-presentation surface already applies (this file's
// own callers, app/tradelines/page.tsx, lib/missionControl.ts). No import
// cycle: lib/intelligence/snapshot.ts's own dependency closure (prisma,
// utils, forecast, tradelineInsights, outcomeLedger, kaiEvents, and THEIR
// transitive deps) never reaches back to lib/kaiHome.ts, so this is a plain
// import, not a shared-module extraction.
import { isFactualNegative } from "@/lib/intelligence/snapshot";

const DAY = 86_400_000;
// FCRA §611(a)(1): the bureau's reinvestigation window after a dispute is
// mailed (~30 days). All deadline math derives from this single constant.
export const REINVESTIGATION_DAYS = 30;
// Starvation guard (SIM-REVIEW finding 5, see pickRecommendation branches 1/2):
// reuses the same statutory unit rather than a new magic number — an absorbing
// branch yields the primary slot only after a FULL extra §611 window of its own
// inaction.
const STARVATION_DAYS = REINVESTIGATION_DAYS;

export type KaiDeadline = {
  letterId: string;
  recipient: string;
  round: number;
  daysElapsed: number;
  daysLeft: number; // negative = window passed with no logged response
};

export type KaiRecommendation = {
  title: string;
  body: string;
  cta: string;
  href: string;
  basis: string; // the receipt — which rule fired, in plain English
  // Present only when the starvation guard (pickRecommendation branches 1/2)
  // yields the primary slot to branch 3 for this cycle — the absorbing item
  // that would have been primary demotes to this line instead of vanishing.
  secondary?: { label: string; href: string };
};

export type OvernightItem = { text: string; href: string };

export type KaiHomeData = {
  overnight: OvernightItem[];
  recommendation: KaiRecommendation | null;
  deadlines: KaiDeadline[];
  recentEvents: Awaited<ReturnType<typeof listKaiEvents>>;
  responsesReceived: number;
  lettersMailed: number;
};

// Phase 1A F2 (§611 split-brain): RECEIPT-anchored, matching lib/forecast.ts /
// lib/mailCenter.ts / app/letters / app/journey / lib/intelligence/snapshot.ts
// — never a bare mailedAt diff. `daysElapsed` here is genuinely "estimated
// days since the bureau received it," so every consumer of this deadline
// (operatorSession.ts, mailCenter.ts's pickMailBand, and branch 2 below) is
// now looking at the same clock the row copy already shows.
function deadlinesFrom(letters: Letter[]): KaiDeadline[] {
  const now = Date.now();
  return letters
    .filter((l) => l.mailedAt && !l.responseAt)
    .map((l) => {
      const daysElapsed = daysElapsedSinceEstimatedReceipt(new Date(l.mailedAt as Date).getTime(), now);
      return {
        letterId: l.id,
        recipient: l.recipientName,
        round: l.round,
        daysElapsed,
        daysLeft: REINVESTIGATION_DAYS - daysElapsed,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6);
}

// One recommendation at a time (KAI-PRODUCT-DESIGN §7 anti-overwhelm law),
// picked by fixed priority. Each branch states its receipt in `basis`.
// Exported for the CROA guard (scripts/kai-recommendation.test.ts) — pure, no DB.
export function pickRecommendation(
  tradelines: Tradeline[],
  letters: Letter[],
  reports: Report[]
): KaiRecommendation | null {
  // RB-1 (Founder Experience Gate): an item with a letter already generated —
  // mailed or not — must never be re-offered as a fresh "review & dispute"
  // pick anywhere below. Hoisted above branch 3's candidate (next) so BOTH
  // the direct §605 pick and its starvation-guard secondary-note use
  // (branches 1/2, further down) see the same exclusion — a single fix point
  // rather than two. Branch 5 (undisputed ranking, further down) needs this
  // identical set; it's built once here and reused there instead of rebuilt.
  const disputedIds = new Set(letters.map((l) => l.tradelineId).filter(Boolean));

  // Branch 3's candidate is computed FIRST, out of priority order — the
  // starvation guard on branches 1/2 (below) needs to know whether §605 has
  // anything to say before it can decide whether to keep absorbing the
  // primary slot (SIM-REVIEW finding 5: branches 1/2 are ABSORBING — true on
  // every call until the user acts — and can otherwise eclipse §605 forever,
  // the one branch that becomes true by time alone).
  const obsolete = tradelines.find(
    (t) =>
      !t.resolved &&
      !disputedIds.has(t.id) &&
      recommendStrategy({
        accountType: t.accountType,
        isDebtBuyer: t.isDebtBuyer,
        probability: t.probability,
        dateOfFirstDelinquency: t.dateOfFirstDelinquency,
        bureauData: t.bureauData,
        creditorName: t.creditorName,
      }).strategyId === "fcra_605"
  );

  // Branch 3's recommendation, factored out so its normal-priority return and
  // its starvation-guard return (from branches 1/2, below) render identical
  // copy — the only difference is an optional `secondary` receipt.
  function obsoleteRecommendation(secondary?: KaiRecommendation["secondary"]): KaiRecommendation {
    // S11 addendum 3 (adopting S3's rc1/s3-s11-fix @ b2551f4). This used to read
    // the raw persisted column, which is null whenever the report printed a
    // month-precision date like "03/2019" — the parser could not store it. The
    // §605 clock, scoring and factualCondition all read `reportedDofd()` now, so
    // reading the column here made THIS sentence disagree with the very engine
    // that produced the recommendation: the strategy desk flagged the item as
    // past its window while Kai said its first delinquency was "about 0 years
    // old". One derivation, read everywhere.
    //
    // A month-precision date is anchored to the LAST instant of that month by
    // reportedDofd, so the age below can never be rounded up past what the
    // report actually attests.
    const dofd = reportedDofd(obsolete!);
    const age = dofd ? Math.floor(yearsSince(dofd.date) ?? 0) : null;
    // If no date is readable at all, say so rather than asserting "0 years".
    // The §605 flag still stands — it came from the strategy engine, which has
    // its own basis — but the age claim is dropped, not invented.
    const ageLine = age === null
      ? "Its date of first delinquency is not readable from your report."
      : `Its first delinquency is about ${age} year${age === 1 ? "" : "s"} old.`;
    return {
      title: `${obsolete!.creditorName} may be past its FCRA §605 reporting window.`,
      body: `${ageLine} Under FCRA §605, most adverse items are reported for seven years from the date of first delinquency — ten years for a Chapter 7 or 11 bankruptcy public record, and collections and charge-offs add a 180-day offset. Because this item appears to sit beyond that window, disputing it asks the bureau to verify the reporting period and remove the item if it can't be substantiated.`,
      cta: "Review this item & dispute",
      href: `/letters?tradeline=${obsolete!.id}&strategy=fcra_605`,
      basis: "Rule: the strategy engine flags this item as past its §605 reporting window (bankruptcy and collection/charge-off offsets applied).",
      ...(secondary ? { secondary } : {}),
    };
  }

  // 1. A bureau answered "verified" and no follow-up round exists yet — the
  //    highest-uncertainty moment in the journey (CX review §2 stage 6).
  const followedUp = new Set(letters.map((l) => l.parentLetterId).filter(Boolean));
  const verified = letters.find(
    (l) => l.responseOutcome === "verified" && !followedUp.has(l.id)
  );
  if (verified) {
    // Starvation guard: "verified" is ABSORBING — true every call until a
    // Round 2 is filed. Once THIS letter has sat verified-with-no-follow-up
    // for a full extra §611 window (read straight off its own `responseAt` —
    // no new storage, nothing counts "how many times shown") AND §605 has a
    // real hit, yield the slot for this cycle; the verified item demotes to
    // `secondary` rather than disappearing. No stale timestamp → never stale.
    const staleDays = verified.responseAt
      ? Math.floor((Date.now() - new Date(verified.responseAt).getTime()) / DAY)
      : 0;
    if (obsolete && staleDays >= STARVATION_DAYS) {
      return obsoleteRecommendation({
        label: `${verified.recipientName} still reads “verified” with no Round ${verified.round + 1} filed — day ${staleDays} since that response.`,
        href: "/letters",
      });
    }
    return {
      title: "A response came back “verified” — that isn't the end of the road.",
      body: `${verified.recipientName} verified the item without saying how. Under FCRA §611(a)(7) you can request their method of verification and escalate to Round ${verified.round + 1}.`,
      cta: "Review response & start Round 2",
      href: "/letters",
      basis: `Rule: “verified” response with no follow-up round on file (letter to ${verified.recipientName}).`,
    };
  }

  // 2. A reinvestigation window has fully lapsed with no response logged.
  const lapsed = deadlinesFrom(letters).find((d) => d.daysLeft <= 0);
  if (lapsed) {
    // Same starvation guard as branch 1 — an overdue window is equally
    // absorbing. Yields once it has been overdue a FURTHER full §611 window.
    const overdueDays = -lapsed.daysLeft;
    if (obsolete && overdueDays >= STARVATION_DAYS) {
      return obsoleteRecommendation({
        label: `The ${lapsed.recipient} window has been overdue ${overdueDays} day${overdueDays === 1 ? "" : "s"} with nothing logged.`,
        href: "/letters",
      });
    }
    return {
      // Phase 1A F2: `lapsed.daysElapsed` is now RECEIPT-anchored (deadlinesFrom
      // above) — the copy must say so too, or a receipt-anchored number would
      // read as a (wrong, larger) days-since-mailed count. Matches the
      // "estimating from receipt" idiom app/letters/page.tsx already uses.
      title: `The ${lapsed.recipient} response window has passed.`,
      body: `Estimating from receipt, day ${lapsed.daysElapsed} of the ~${REINVESTIGATION_DAYS}-day FCRA §611 reinvestigation window — it's likely passed. Log any response you received, or escalate.`,
      cta: "Log the response",
      href: "/letters",
      basis: `Rule: an estimated ${lapsed.daysElapsed} days since the bureau received it, past the ${REINVESTIGATION_DAYS}-day window, with no response on file.`,
    };
  }

  // 3. An item the canonical strategy engine flags as past its FCRA §605
  //    reporting window (computed above, as `obsolete`). Detection is
  //    DELEGATED to recommendStrategy so Kai applies the same window math it
  //    uses everywhere — ten years for a Chapter 7/11 bankruptcy public
  //    record, plus the 180-day collection/charge-off offset — and never
  //    asserts obsolescence a bureau would reject. Kai observes the fact,
  //    explains the applicable law, flags the potential issue, and
  //    recommends verification — never a guaranteed removal.
  if (obsolete) {
    return obsoleteRecommendation();
  }

  // 4. Nothing on file yet — the first action is the only action.
  if (reports.length === 0) {
    return {
      title: "Upload your credit report and I'll get to work.",
      body: "I'll read every account, flag cross-bureau inconsistencies, and line up your dispute options — usually in under a minute.",
      cta: "Upload report",
      href: "/upload",
      basis: "Rule: no reports on file yet.",
    };
  }

  // 4b. RC1 S7 / A1-04 — a report IS on file, but analysis produced no
  //     accounts. This state used to fall through branch 5 (which finds no
  //     candidate) to `null`, and a null recommendation is how the room ended
  //     up telling the consumer who most needs help that "nothing needs your
  //     attention right now" while Mission Control simultaneously showed an
  //     upload task. Naming the state here is what lets every consumer of this
  //     engine - Mission Control, the Operator Session, Kai's presence - say
  //     the same sentence. It states the fact and offers the one move that
  //     helps; it promises nothing about what a re-run will find.
  if (tradelines.length === 0) {
    return {
      title: "Your report is on file, but I could not read any accounts from it.",
      body: "That usually means the file was an image, a partial export, or a format I could not parse. Upload that report again, or add another bureau's report, and I will re-run the analysis.",
      cta: "Open Upload",
      href: "/upload",
      basis: "Rule: a report is on file with no accounts extracted from it.",
    };
  }

  // 5. Analyzed items exist but nothing has been disputed yet. Ranked by
  //    `score` (which already determines `probability`'s band — lib/scoring.ts
  //    BANDS — so sorting by score alone orders by probability too), so the
  //    very first recommendation a new user ever sees is the highest-leverage
  //    item, never whichever row the DB happened to return first (SIM-REVIEW
  //    finding 3 — a live defect independent of this phase). Deterministic
  //    tie-break: the item analyzed LONGEST ago wins (oldest createdAt first),
  //    so an equal-score item can never be starved forever by newer arrivals;
  //    id breaks any remaining tie (identical timestamps). `disputedIds` is
  //    the same set hoisted above (RB-1) — built once, reused here.
  //    Phase 1A-R M1 (CCO correction, HIGH): the candidate pool is ALSO
  //    gated on the RB-2 fact test (isFactualNegative) and never
  //    NOT_RECOMMENDED (government/statutory — the Strategy Desk already
  //    refuses these). Without this, a first-time user with a clean or
  //    government-debt top-scored account was told "{Creditor} is flagged on
  //    your file" and steered into the letter builder — an affirmative false
  //    statement plus an inducement to dispute accurate/undisputable data,
  //    on the single highest-traffic surface in the product. A file with
  //    nothing factually disputable now correctly falls through to `null` —
  //    quiet is allowed, never a manufactured recommendation. The RB-2 fact
  //    model itself is untouched; this only makes branch 5 honor it.
  const undisputed = tradelines
    .filter((t) => !t.resolved && !disputedIds.has(t.id) && isFactualNegative(t) && t.probability !== "NOT_RECOMMENDED")
    .sort((a, b) =>
      b.score - a.score ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      a.id.localeCompare(b.id)
    )[0];
  if (undisputed && letters.length === 0) {
    return {
      title: "Your file is analyzed — ready to start the first dispute?",
      // Phase 1A-R rider: dropped the false "and the recipient's address"
      // claim — the letter builder pre-fills the recommended strategy only;
      // it never pre-fills a recipient address (gate finding X9).
      body: `${undisputed.creditorName} is flagged on your file. The letter builder pre-fills the recommended strategy.`,
      cta: "Start with this item",
      href: `/letters?tradeline=${undisputed.id}`,
      // "dispute-priority" (not bare "score") disambiguates this from a credit
      // score — it's the same internal metric app/tradelines/page.tsx already
      // labels "my dispute-priority read" elsewhere in the product.
      basis: `Rule: highest-signal item first among analyzed, undisputed accounts (dispute-priority score ${undisputed.score}/100).`,
    };
  }

  return null; // All quiet — quiet is allowed (no manufactured urgency).
}

function overnightFrom(events: KaiHomeData["recentEvents"]): OvernightItem[] {
  const cutoff = Date.now() - 2 * DAY;
  const fresh = events.filter((e) => new Date(e.occurredAt).getTime() >= cutoff);
  const items: OvernightItem[] = [];
  for (const e of fresh.slice(0, 4)) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    switch (e.type) {
      case "response.received":
        items.push({ text: `A bureau response was logged (outcome: ${String(p.outcome ?? "recorded")}).`, href: "/letters" });
        break;
      case "letter.mailed":
        // Phase 1A-R M4 (CCO adjudication): "is in the mail — the clock is
        // running" made the same mailing-anchored false claim as M2/M3 (the
        // clock starts on receipt, not mailing) — receipt-anchored to match
        // the established idiom (lib/operatorSession.ts's accomplishmentOf).
        items.push({ text: `Round ${String(p.round ?? "")} to ${String(p.recipient ?? "the bureau")} is in the mail — the §611 clock starts once the bureau receives it.`, href: "/journey" });
        break;
      case "letter.generated":
        // S11 NEW-3: this line is rendered from a HISTORICAL event, so it can
        // only truthfully report what happened — "is ready to mail" was a
        // present-tense claim about a letter this stream cannot re-check, and
        // it was wrong for every draft whose authorizing confirmation has since
        // been withdrawn (the server 409s those). /letters shows the real
        // current state, including the on-hold banner.
        items.push({ text: "A dispute letter was generated.", href: "/letters" });
        break;
      case "report.analyzed":
        items.push({ text: `Report analyzed — ${String(p.tradelines ?? "your")} accounts reviewed.`, href: "/tradelines" });
        break;
      case "dispute.resolved":
        items.push({ text: "An item was marked resolved. One down.", href: "/journey" });
        break;
      default:
        break;
    }
  }
  return items;
}

export async function getKaiHomeData(userId: string): Promise<KaiHomeData> {
  const [tradelines, letters, reports, recentEvents] = await Promise.all([
    prisma.tradeline.findMany({ where: { userId } }),
    prisma.letter.findMany({ where: { userId } }),
    prisma.report.findMany({ where: { userId } }),
    listKaiEvents(userId, 20),
  ]);

  return {
    overnight: overnightFrom(recentEvents),
    recommendation: pickRecommendation(tradelines, letters, reports),
    deadlines: deadlinesFrom(letters),
    recentEvents: recentEvents.slice(0, 5),
    responsesReceived: letters.filter((l) => l.responseAt).length,
    lettersMailed: letters.filter((l) => l.mailedAt).length,
  };
}
