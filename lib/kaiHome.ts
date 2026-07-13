// Kai Home data engine (roadmap #7/#8, ADR-0007 E2). Everything here is PASSIVE
// intelligence: deterministic rules over the user's own rows + the KaiEvent
// stream. No AI calls, no invented facts — every card renders a receipt.
import type { Letter, Report, Tradeline } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listKaiEvents } from "@/lib/kaiEvents";
import { yearsSince } from "@/lib/utils";

const DAY = 86_400_000;
// FCRA §611(a)(1): the bureau's reinvestigation window after a dispute is
// mailed (~30 days). All deadline math derives from this single constant.
export const REINVESTIGATION_DAYS = 30;

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

function deadlinesFrom(letters: Letter[]): KaiDeadline[] {
  const now = Date.now();
  return letters
    .filter((l) => l.mailedAt && !l.responseAt)
    .map((l) => {
      const daysElapsed = Math.floor((now - new Date(l.mailedAt as Date).getTime()) / DAY);
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
function pickRecommendation(
  tradelines: Tradeline[],
  letters: Letter[],
  reports: Report[]
): KaiRecommendation | null {
  // 1. A bureau answered "verified" and no follow-up round exists yet — the
  //    highest-uncertainty moment in the journey (CX review §2 stage 6).
  const followedUp = new Set(letters.map((l) => l.parentLetterId).filter(Boolean));
  const verified = letters.find(
    (l) => l.responseOutcome === "verified" && !followedUp.has(l.id)
  );
  if (verified) {
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
    return {
      title: `The ${lapsed.recipient} response window has passed.`,
      body: `Day ${lapsed.daysElapsed} since Round ${lapsed.round} was mailed — past the ~${REINVESTIGATION_DAYS}-day FCRA §611 reinvestigation window. Log any response you received, or escalate.`,
      cta: "Log the response",
      href: "/letters",
      basis: `Rule: mailed ${lapsed.daysElapsed} days ago with no response on file.`,
    };
  }

  // 3. Obsolete items are the cleanest disputes — attack them first.
  const obsolete = tradelines.find(
    (t) => !t.resolved && (yearsSince(t.dateOfFirstDelinquency) ?? 0) >= 7
  );
  if (obsolete) {
    return {
      title: `${obsolete.creditorName} is past the 7-year reporting window.`,
      body: "Items older than 7 years from first delinquency must drop off under FCRA §605 — the cleanest dispute available on your file.",
      cta: "Dispute as obsolete",
      href: `/letters?tradeline=${obsolete.id}&strategy=fcra_605`,
      basis: "Rule: date of first delinquency ≥ 7 years (§605 obsolescence).",
    };
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

  // 5. Analyzed items exist but nothing has been disputed yet.
  const disputedIds = new Set(letters.map((l) => l.tradelineId).filter(Boolean));
  const undisputed = tradelines.find((t) => !t.resolved && !disputedIds.has(t.id));
  if (undisputed && letters.length === 0) {
    return {
      title: "Your file is analyzed — ready to start the first dispute?",
      body: `${undisputed.creditorName} is flagged on your file. The letter builder pre-fills the recommended strategy and the recipient's address.`,
      cta: "Start with this item",
      href: `/letters?tradeline=${undisputed.id}`,
      basis: "Rule: analyzed items on file with zero letters generated.",
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
        items.push({ text: `Round ${String(p.round ?? "")} to ${String(p.recipient ?? "the bureau")} is in the mail — the §611 clock is running.`, href: "/journey" });
        break;
      case "letter.generated":
        items.push({ text: "A dispute letter was generated and is ready to mail.", href: "/letters" });
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
