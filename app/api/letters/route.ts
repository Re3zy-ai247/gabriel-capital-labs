import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { decryptText } from "@/lib/docCrypto";

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
      responseAt: l.responseAt, // Engine 3: own-history response latency
      preview: decryptText(l.body).slice(0, 240),
      hasResponse: Boolean(l.responseText),
      responseOutcome: l.responseOutcome,
      responseAnalysis: l.responseAnalysis ? decryptText(l.responseAnalysis) : l.responseAnalysis,
      parentLetterId: l.parentLetterId,
    })),
  });
}
