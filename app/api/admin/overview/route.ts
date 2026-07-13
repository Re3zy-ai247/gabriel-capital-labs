import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { PREMIUM_PRICE_CENTS, AGENCY_PRICE_CENTS, liveMrrCents } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalUsers, signups30d, premiumUsers, agencyUsers, activeSubs, totalLetters, totalReports, managedClients, churnedSubs, pastDueSubs] =
    await Promise.all([
      prisma.user.count({ where: { managedByAgencyId: null } }),
      prisma.user.count({ where: { createdAt: { gte: since30 }, managedByAgencyId: null } }),
      prisma.user.count({ where: { plan: "premium", isAgency: false } }),
      prisma.user.count({ where: { isAgency: true } }),
      prisma.user.count({ where: { subscriptionStatus: { in: ["active", "trialing", "past_due"] } } }),
      prisma.letter.count(),
      prisma.report.count(),
      prisma.user.count({ where: { managedByAgencyId: { not: null } } }),
      prisma.user.count({ where: { subscriptionStatus: { in: ["canceled", "unpaid"] } } }),
      prisma.user.count({ where: { subscriptionStatus: "past_due" } }),
    ]);

  // G-14: real Stripe revenue first; the counts×price estimate only as a labeled
  // fallback (it overcounts comped accounts and ignores annual discounts).
  const stripeMrrCents = await liveMrrCents();
  const mrrCents = stripeMrrCents ?? premiumUsers * PREMIUM_PRICE_CENTS + agencyUsers * AGENCY_PRICE_CENTS;
  const paid = premiumUsers + agencyUsers;

  return NextResponse.json({
    totalUsers,
    signups30d,
    premiumUsers,
    agencyUsers,
    managedClients,
    activeSubs,
    totalLetters,
    totalReports,
    mrr: mrrCents / 100,
    arr: (mrrCents * 12) / 100,
    mrrSource: stripeMrrCents != null ? "stripe" : "estimated",
    conversionRate: totalUsers ? Math.round((paid / totalUsers) * 1000) / 10 : 0,
    churnedSubs,
    pastDueSubs,
    // Churn = ever-canceled / (currently-active + ever-canceled). A lifetime proxy until
    // time-series billing history is instrumented (backlog G-14).
    churnRate: activeSubs + churnedSubs ? Math.round((churnedSubs / (activeSubs + churnedSubs)) * 1000) / 10 : 0,
  });
}
