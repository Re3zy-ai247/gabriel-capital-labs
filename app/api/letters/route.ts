import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";

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
      complianceFlags: l.complianceFlags,
      createdAt: l.createdAt,
      mailedAt: l.mailedAt,
      preview: l.body.slice(0, 240),
      hasResponse: Boolean(l.responseText),
      responseOutcome: l.responseOutcome,
      responseAnalysis: l.responseAnalysis,
      parentLetterId: l.parentLetterId,
    })),
  });
}
