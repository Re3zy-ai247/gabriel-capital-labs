import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { decryptText } from "@/lib/docCrypto";
import { resolveSenderPlaceholders, detectPlaceholders, letterAuthorizationRevoked } from "@/lib/letter";

export const dynamic = "force-dynamic";

// Lists the signed-in user's saved letters, newest first.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const letters = await prisma.letter.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { tradeline: { select: { creditorName: true } } },
  });

  // S11 AD-2 (cross-slice, additive read by S4's writer): which UNMAILED
  // letters no longer have an ACTIVE confirmation standing behind them. One
  // grouped count for the whole page, never one query per letter. A mailed
  // letter is never re-judged, so mailed rows are not counted at all — their
  // record and its evidence are untouched.
  const unmailedTradelineIds = Array.from(
    new Set(letters.filter((l) => !l.mailedAt && l.tradelineId).map((l) => l.tradelineId as string))
  );
  const activeCounts = new Map<string, number>();
  if (unmailedTradelineIds.length) {
    const grouped = await prisma.consumerAssertion.groupBy({
      by: ["tradelineId"],
      where: { userId: user.id, status: "ACTIVE", tradelineId: { in: unmailedTradelineIds } },
      _count: { _all: true },
    });
    for (const g of grouped) if (g.tradelineId) activeCounts.set(g.tradelineId, g._count._all);
  }

  // RB-4 (coordinator stitch): the card state on /letters must match what the
  // print/download surfaces will actually produce, so the placeholder check
  // runs on the RENDERED body — after render-time sender resolution against
  // the user's CURRENT profile — never on the frozen stored text alone.
  const consumerNow = {
    fullName: user.fullName,
    addressLine1: user.addressLine1,
    city: user.city,
    state: user.state,
    zip: user.zip,
  };

  return NextResponse.json({
    letters: letters.map((l) => ({
      id: l.id,
      strategy: l.strategy,
      recipientName: l.recipientName,
      recipientType: l.recipientType,
      targetBureau: l.targetBureau,
      status: l.status,
      round: l.round,
      creditorName: l.tradeline?.creditorName ?? null,
      // Phase 1A F1: lets the client compute the SAME derived package id
      // lib/mailCenter.ts's packageKeyFor uses (tl:{tradelineId}:{strategy}:
      // {round}), so a "Review & download package" action can link straight
      // to /mail/download/[packageId] — already-persisted field, no schema
      // change, just newly exposed here.
      tradelineId: l.tradelineId,
      complianceFlags: l.complianceFlags,
      createdAt: l.createdAt,
      mailedAt: l.mailedAt,
      // S11 AD-2: true only for a letter still pending action whose authorizing
      // confirmations have all been withdrawn (or whose report was replaced).
      // The letters page renders the banner + disables Approve from this flag.
      authorizationRevoked: letterAuthorizationRevoked({
        mailedAt: l.mailedAt,
        tradelineId: l.tradelineId,
        activeAssertionCount: l.tradelineId ? activeCounts.get(l.tradelineId) ?? 0 : 0,
        // The discriminator: a letter that never had a tradeline (personal_info)
        // is not an orphan (lib/letter.ts, letterAuthorization).
        strategy: l.strategy,
      }),
      responseAt: l.responseAt, // Engine 3: own-history response latency
      preview: decryptText(l.body).slice(0, 240),
      needsDetails: detectPlaceholders(resolveSenderPlaceholders(decryptText(l.body), consumerNow)).hasPlaceholder,
      hasResponse: Boolean(l.responseText),
      responseOutcome: l.responseOutcome,
      responseAnalysis: l.responseAnalysis ? decryptText(l.responseAnalysis) : l.responseAnalysis,
      parentLetterId: l.parentLetterId,
    })),
  });
}
