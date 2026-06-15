import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { AGENCY_PRICE_CENTS } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// GET: every agency account with its managed-client count and MRR contribution.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const agencies = await prisma.user.findMany({
    where: { isAgency: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true, agencyName: true, plan: true,
      subscriptionStatus: true, createdAt: true,
      _count: { select: { managedClients: true } },
    },
  });

  return NextResponse.json({
    agencies: agencies.map((a) => ({ ...a, mrr: AGENCY_PRICE_CENTS / 100 })),
    totalAgencies: agencies.length,
    totalManagedClients: agencies.reduce((s, a) => s + a._count.managedClients, 0),
  });
}
