import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tradelines = await prisma.tradeline.findMany({ where: { userId: user.id }, orderBy: { score: "desc" } });

  // Rank by the existing dispute-strength score only — no fabricated point-gain
  // projection (CROA/UDAAP: never imply a score outcome).
  const ranked = tradelines.map((t) => ({ ...t }));

  const counts = {
    HIGH: ranked.filter((t) => t.probability === "HIGH").length,
    MEDIUM: ranked.filter((t) => t.probability === "MEDIUM").length,
    LOW: ranked.filter((t) => t.probability === "LOW").length,
    NOT_RECOMMENDED: ranked.filter((t) => t.probability === "NOT_RECOMMENDED").length,
    RESOLVED: ranked.filter((t) => t.resolved).length,
  };

  return NextResponse.json({ ranked, counts });
}
