// Builds the anonymized Engine-1 corpus (Sprint X). Queries ONLY the letters of
// users who opted in (OutcomeConsent), strips every identifier, and returns bare
// OutcomeRecords. No userId, no name, no letter body ever leaves this function —
// downstream aggregation (outcomeStats) sees only outcome facts. This is the one
// place the cross-user dataset is assembled, and it is consent-gated at the source.
import { createHmac } from "crypto";
import type { PrismaClient } from "@prisma/client";
import type { OutcomeRecord } from "./outcomeStats";
import { consentingUserIds } from "./outcomeConsent";

const DAY = 86_400_000;

// Salted, non-reversible per-user token used ONLY to count distinct contributors
// in aggregation. Keyed on a server secret so it can't be reconstructed offline;
// deterministic (same user → same key) so aggregation is stable. The raw userId
// never leaves this function — only this hash does, and it never reaches output.
function userKeyFor(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "outcome-corpus-fallback-salt";
  return createHmac("sha256", secret).update(userId).digest("hex").slice(0, 16);
}

export async function buildOutcomeCorpus(prisma: PrismaClient): Promise<OutcomeRecord[]> {
  const ids = await consentingUserIds();
  if (!ids.length) return []; // no contributors → empty corpus, honestly

  const letters = await prisma.letter.findMany({
    where: { userId: { in: ids }, mailedAt: { not: null } },
    // Deterministic total order so identical DB states produce identical output.
    orderBy: [{ mailedAt: "asc" }, { id: "asc" }],
    select: {
      userId: true,
      strategy: true, targetBureau: true, round: true, responseOutcome: true,
      mailedAt: true, responseAt: true,
      tradeline: { select: { accountType: true, isDebtBuyer: true } },
    },
  });

  return letters.map((l): OutcomeRecord => {
    const m = l.mailedAt ? l.mailedAt.getTime() : null;
    const r = l.responseAt ? l.responseAt.getTime() : null;
    return {
      strategy: l.strategy,
      bureau: l.targetBureau ?? null,
      round: l.round,
      accountType: l.tradeline?.accountType ?? "OTHER",
      isDebtBuyer: l.tradeline?.isDebtBuyer ?? false,
      outcome: l.responseOutcome ?? null,
      latencyDays: m != null && r != null && r >= m ? Math.round((r - m) / DAY) : null,
      userKey: userKeyFor(l.userId), // salted; used only for distinct-contributor k-anon
    };
  });
}
