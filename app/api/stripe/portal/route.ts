import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Opens the Stripe Billing Portal so the customer can update their card, view
// invoices, or cancel — all hosted by Stripe (no card data ever touches us).
export async function POST() {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No subscription found. Start with the Upgrade button." },
      { status: 400 }
    );
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${siteUrl()}/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    console.error("stripe portal error", e);
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
