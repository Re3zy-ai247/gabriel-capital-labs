// Server-side assembler for Kai Campaign Intelligence (Sprint XII). Turns a
// user's real case — tradelines (already scored + strategy-mapped by the existing
// engines) plus their own dispute-letter history and any live campaigns — into
// the pure ComposerItem[] the deterministic composer consumes. Keeps the composer
// free of prisma. Everything is scoped to the requesting user (tenant isolation).
import { prisma } from "@/lib/prisma";
import type { Bureau } from "@prisma/client";
import { presentBureaus, getBureauData, crossBureauConflicts } from "@/lib/bureauData";
import { recommendStrategy } from "@/lib/recommend";
import { STRATEGY_BY_ID, type RecipientType } from "@/lib/strategies";
import { fallOffInsight } from "@/lib/tradelineInsights";
import type { ComposerItem, LetterTarget } from "@/lib/campaign";
import { PrismaCampaignStore, CampaignService } from "@/lib/campaign";
import { recordKaiEvent, type KaiEventType } from "@/lib/kaiEvents";

// The production campaign service, wired to emit campaign milestones onto the
// existing fail-open KaiEvent stream (ADR-0007) so the Timeline, Case Memory, and
// Kai Home pick them up with no extra plumbing. A failed event never blocks a
// campaign transition.
export function campaignService(): CampaignService {
  return new CampaignService({
    sink: async (e) => {
      await recordKaiEvent(e.userId, e.type as KaiEventType, {
        refType: "campaign", refId: e.campaignId,
        payload: { sequence: e.sequence, detail: e.detail },
      });
    },
  });
}

// A dispute letter is one folded sheet or two — a stable, honest per-piece
// estimate for the package-burden math (the real page count is computed exactly
// at mail time from the letter body via lib/mailExecution).
const EST_PAGES_PER_PIECE = 2;

// Build the composer input for a user's whole case.
export async function buildComposerItems(userId: string): Promise<ComposerItem[]> {
  const [tradelines, letters, campaigns] = await Promise.all([
    prisma.tradeline.findMany({ where: { userId }, orderBy: [{ score: "desc" }] }),
    prisma.letter.findMany({
      where: { userId },
      select: { tradelineId: true, recipientType: true, status: true, round: true, responseOutcome: true, responseAt: true, mailedAt: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }],
    }),
    new PrismaCampaignStore().listByUser(userId, 100).catch(() => []),
  ]);

  // Letters grouped by tradeline (newest first), for prior-history signals.
  const byTradeline = new Map<string, typeof letters>();
  for (const l of letters) {
    if (!l.tradelineId) continue;
    const arr = byTradeline.get(l.tradelineId) ?? [];
    arr.push(l); byTradeline.set(l.tradelineId, arr);
  }

  // Tradelines already queued under a live (non-terminal) campaign — don't re-send.
  const queuedKeys = new Set<string>();
  for (const c of campaigns) {
    if (["COMPLETED", "CANCELED", "SUPERSEDED"].includes(c.status)) continue;
    for (const it of c.items) if (it.queued) queuedKeys.add(`${it.tradelineId}:${it.recipientType}`);
  }

  const items: ComposerItem[] = [];
  for (const t of tradelines) {
    if (t.resolved) continue; // resolved items aren't campaign candidates
    const rec = recommendStrategy({
      accountType: t.accountType, isDebtBuyer: t.isDebtBuyer, probability: t.probability,
      dateOfFirstDelinquency: t.dateOfFirstDelinquency, bureauData: t.bureauData, creditorName: t.creditorName,
    });
    const strat = rec.strategyId ? STRATEGY_BY_ID[rec.strategyId] : undefined;
    const recipientType: RecipientType = strat?.recipient ?? "bureau";
    const bureaus = presentBureaus(getBureauData(t.bureauData));
    const fall = fallOffInsight(t);
    const conflicts = crossBureauConflicts(getBureauData(t.bureauData));

    const history = byTradeline.get(t.id) ?? [];
    const latest = history[0];
    const openMailed = history.some((l) => l.status === "MAILED" && !l.responseAt);
    const key = `${t.id}:${recipientType}`;
    const alreadyInFlight = queuedKeys.has(key) || (latest?.status === "MAILED");

    items.push({
      tradelineId: t.id,
      creditorName: t.creditorName,
      accountType: t.accountType,
      isDebtBuyer: t.isDebtBuyer,
      probability: t.probability,
      score: t.score,
      recipientType,
      strategyId: rec.strategyId,
      strategyLabel: strat?.label ?? "the recommended strategy",
      strategyReason: rec.reason,
      bureaus,
      pastWindow: Boolean(fall?.pastWindow),
      monthsToFallOff: fall ? fall.monthsRemaining : null,
      hasConflicts: conflicts.length > 0,
      duplicateGroup: t.duplicateGroup,
      estimatedPages: EST_PAGES_PER_PIECE,
      activeInvestigation: openMailed,
      priorRounds: history.length,
      lastOutcome: latest?.responseOutcome ?? null,
      alreadyInFlight,
    });
  }
  return items;
}

// Build the mail gate's LetterTarget from a persisted Letter row + its tradeline.
export async function letterTarget(userId: string, letterId: string): Promise<LetterTarget | null> {
  const letter = await prisma.letter.findFirst({ where: { id: letterId, userId } });
  if (!letter) return null;
  const strat = STRATEGY_BY_ID[letter.strategy];
  const recipientType = (letter.recipientType as RecipientType) || strat?.recipient || "bureau";
  let creditorName = letter.recipientName;
  let bureaus: Bureau[] = letter.targetBureau ? [letter.targetBureau] : [];
  if (letter.tradelineId) {
    const t = await prisma.tradeline.findFirst({ where: { id: letter.tradelineId, userId }, select: { creditorName: true, bureauData: true } }).catch(() => null);
    if (t) {
      creditorName = t.creditorName;
      if (recipientType === "bureau") {
        const present = presentBureaus(getBureauData(t.bureauData));
        bureaus = present.length ? present : bureaus;
      }
    }
  }
  return {
    tradelineId: letter.tradelineId,
    recipientType,
    bureau: letter.targetBureau ?? null,
    creditorName,
    strategyId: letter.strategy,
    strategyLabel: strat?.label ?? "the recommended strategy",
    bureaus,
    pages: EST_PAGES_PER_PIECE,
  };
}
