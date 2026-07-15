import { prisma } from "@/lib/prisma";
import { PrismaCampaignStore } from "@/lib/campaign";
import { PrismaMailStore } from "@/lib/mail";
import { assembleKnowledge, type GraphRows } from "./engine";
import type { FinancialKnowledge } from "./types";

// Loads the link fields (ids + foreign keys) that define the relationships in one
// focused, userId-scoped batch: tradelines/letters/outcomes/decisions select only
// link columns; campaigns/mail come from their canonical stores. Every source is
// ordered so the graph is deterministic regardless of DB row order. Fail-open on
// the append-only ledger/registry tables (which may not exist for a brand-new user).
async function loadGraphRows(userId: string): Promise<GraphRows> {
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const [tradelines, letters, campaigns, mail, outcomes, decisions] = await Promise.all([
    prisma.tradeline.findMany({ where: { userId }, select: { id: true, creditorName: true }, orderBy: { id: "asc" } }),
    prisma.letter.findMany({ where: { userId }, select: { id: true, tradelineId: true, parentLetterId: true, strategy: true, recipientName: true, status: true, mailedAt: true, responseAt: true, responseOutcome: true }, orderBy: { id: "asc" } }),
    new PrismaCampaignStore().listByUser(userId, 100).catch(() => []),
    new PrismaMailStore().listByUser(userId, 100).catch(() => []),
    prisma.$queryRaw<{ letterId: string; decisionId: string | null; tradelineId: string | null; outcome: string | null }[]>`SELECT "letterId","decisionId","tradelineId","outcome" FROM "VerifiedOutcome" WHERE "userId" = ${userId} ORDER BY "letterId" ASC`.catch(() => []),
    prisma.$queryRaw<{ id: string; tradelineId: string | null; strategyId: string | null }[]>`SELECT "id","tradelineId","strategyId" FROM "DecisionRegistry" WHERE "userId" = ${userId} ORDER BY "id" ASC`.catch(() => []),
  ]);
  return {
    hasReport: tradelines.length > 0,
    tradelines,
    letters: letters.map((l) => ({ id: l.id, tradelineId: l.tradelineId, parentLetterId: l.parentLetterId, strategy: l.strategy, recipientName: l.recipientName, status: l.status, mailedAt: iso(l.mailedAt), responseAt: iso(l.responseAt), responseOutcome: l.responseOutcome })),
    campaigns: campaigns.map((c) => ({ id: c.id, sequence: c.sequence, status: c.status, items: c.items.map((it) => ({ tradelineId: it.tradelineId, recipientType: it.recipientType, letterId: it.letterId, decision: it.decision })) })).sort((a, b) => a.id.localeCompare(b.id)),
    mail: mail.map((m) => ({ mailId: m.mailId, letterId: m.letterId, status: m.status })).sort((a, b) => a.mailId.localeCompare(b.mailId)),
    outcomes,
    decisions,
  };
}

export async function financialGraph(userId: string): Promise<FinancialKnowledge> {
  return assembleKnowledge(await loadGraphRows(userId));
}
