import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, resolvePremiumPriceId, siteUrl } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/billing";

export const dynamic = "force-dynamic";

// Creates a Stripe Checkout Session for the $99/mo Premium subscription and
// returns its URL. The client redirects the browser to it.
export async function POST() {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Please try again later." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (user.plan === "premium") {
    return NextResponse.json({ error: "You're already on Premium." }, { status: 400 });
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, user);
    const priceId = await resolvePremiumPriceId(stripe);
    const base = siteUrl();

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${base}/billing?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
      subscription_data: { metadata: { userId: user.id } },
      metadata: { userId: user.id },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    console.error("stripe checkout error", e);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
