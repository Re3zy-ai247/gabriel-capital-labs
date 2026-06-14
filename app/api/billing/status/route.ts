import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

// Returns the signed-in user's real billing state + monthly usage for the UI.
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entitlement = await getEntitlement(user);
  // Distinguish the agency tier from premium so the UI can label it correctly.
  const plan = user.isAgency || user.plan === "agency" ? "agency" : entitlement.premium ? "premium" : "free";
  return NextResponse.json({
    plan,
    isAgency: Boolean(user.isAgency),
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    memberSince: user.createdAt,
    hasStripeCustomer: Boolean(user.stripeCustomerId),
    entitlement,
  });
}
