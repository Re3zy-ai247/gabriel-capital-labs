import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { presentBureaus, getBureauData } from "@/lib/bureauData";
import { recommendStrategy } from "@/lib/recommend";
import { getFurnisherContacts, formatFurnisherAddress } from "@/lib/furnisher";

export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tradelines = await prisma.tradeline.findMany({
    where: { userId: user.id },
    orderBy: [{ score: "desc" }],
  });

  // Furnisher/collector mailing contacts parsed from the report, so the letter
  // builder can pre-fill the recipient address.
  const contacts = await getFurnisherContacts(tradelines.map((t) => t.id));

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
    const contact = contacts[t.id];
    return {
      ...t,
      bureaus: presentBureaus(getBureauData(t.bureauData)),
      recommendedStrategy: rec.strategyId,
      recommendedReason: rec.reason,
      furnisherName: contact?.name || null,
      furnisherAddress: formatFurnisherAddress(contact) || null,
    };
  });

  return NextResponse.json({ tradelines: enriched });
}
