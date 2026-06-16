import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { presentBureaus, getBureauData } from "@/lib/bureauData";
import { recommendStrategy } from "@/lib/recommend";

export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tradelines = await prisma.tradeline.findMany({
    where: { userId: user.id },
    orderBy: [{ score: "desc" }],
  });

  // Enrich each tradeline with which bureaus report it and the recommended
  // opening strategy, so the letter builder can auto-target + auto-suggest.
  const enriched = tradelines.map((t) => {
    const rec = recommendStrategy({
      accountType: t.accountType,
      isDebtBuyer: t.isDebtBuyer,
      probability: t.probability,
      dateOfFirstDelinquency: t.dateOfFirstDelinquency,
      bureauData: t.bureauData,
      creditorName: t.creditorName,
    });
    return {
      ...t,
      bureaus: presentBureaus(getBureauData(t.bureauData)),
      recommendedStrategy: rec.strategyId,
      recommendedReason: rec.reason,
    };
  });

  return NextResponse.json({ tradelines: enriched });
}
