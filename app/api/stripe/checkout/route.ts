import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, resolvePriceId, siteUrl, type PaidPlan } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/billing";

export const dynamic = "force-dynamic";

// Creates a Stripe Checkout Session for a paid subscription and returns its URL.
// Body: { plan?: "premium" | "agency" } — defaults to "premium" ($99/mo). The
// "agency" plan is the $399/mo tier that unlocks the multi-client workspace.
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Please try again later." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const plan: PaidPlan = body?.plan === "agency" ? "agency" : "premium";

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (plan === "agency") {
    if (user.plan === "agency") {
      return NextResponse.json({ error: "You're already on the Agency plan." }, { status: 400 });
    }
  } else if (user.plan === "premium" || user.plan === "agency") {
    return NextResponse.json(
      { error: user.plan === "agency" ? "Your Agency plan already includes Premium." : "You're already on Premium." },
      { status: 400 }
    );
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, user);
    const priceId = await resolvePriceId(stripe, plan);
    const base = siteUrl();
    // Agency buyers land back on /agency (their workspace); premium on /billing.
    const successPath = plan === "agency" ? "/agency?checkout=success" : "/billing?checkout=success";
    const cancelPath = plan === "agency" ? "/agency?checkout=cancelled" : "/pricing?checkout=cancelled";

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${base}${successPath}`,
      cancel_url: `${base}${cancelPath}`,
      subscription_data: { metadata: { userId: user.id, plan } },
      metadata: { userId: user.id, plan },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    console.error("stripe checkout error", e);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
