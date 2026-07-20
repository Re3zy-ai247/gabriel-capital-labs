import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getStripe, resolvePrice, resolvePriceId, siteUrl,
  LETTER_PACK_CREDITS, type PaidPlan, type BillingInterval,
} from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/billing";
import { ACTIVE_SUBSCRIPTION_STATES } from "@/lib/os/host/billingTier";
import { track, PRODUCT_EVENTS } from "@/lib/events";

export const dynamic = "force-dynamic";

// Creates a Stripe Checkout Session. Body:
//   { plan: "premium"|"agency"|"agency_pro", interval?: "month"|"year" }  — subscription
//   { product: "letters_5" }                                              — one-time letter pack
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured yet. Please try again later." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const base = siteUrl();

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, user);

    // ── One-time letter pack ────────────────────────────────────────────────
    if (body.product === "letters_5") {
      const priceId = await resolvePrice(stripe, "letters_5");
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${base}/letters?purchase=success`,
        cancel_url: `${base}/letters?purchase=cancelled`,
        metadata: { userId: user.id, product: "letters_5", credits: String(LETTER_PACK_CREDITS) },
      });
      return NextResponse.json({ url: checkout.url });
    }

    // ── Subscriptions ───────────────────────────────────────────────────────
    // Purchasable plans ONLY. agency_pro is "Coming soon" on /pricing — the page
    // promises "you can't be charged for a plan that isn't available yet", so the
    // API must not sell it either (it was previously reachable by hand-crafted
    // POST at a stale price). Re-add it here the day the tier goes live.
    const plan: PaidPlan = ["premium", "agency"].includes(body.plan) ? body.plan : "premium";
    const interval: BillingInterval = body.interval === "year" ? "year" : "month";

    // Block buying a plan you already have (or better).
    const tier = (p: string) => (p === "agency_pro" ? 3 : p === "agency" ? 2 : p === "premium" ? 1 : 0);
    if (tier(user.plan) >= tier(plan)) {
      const label = user.plan === "agency_pro" ? "Agency Pro" : user.plan === "agency" ? "Agency" : "Professional";
      return NextResponse.json(
        { error: plan === user.plan ? `You're already on ${label}.` : `Your ${label} plan already includes this.` },
        { status: 400 }
      );
    }

    // UPGRADE GUARD (fail-closed). The tier check above only blocks buying the SAME
    // or a LOWER plan — an upgrade passes it. But this route only ever creates a NEW
    // subscription; nothing here cancels or prorates an existing one, and no
    // customer-facing subscriptions.update path exists anywhere in the app. So a
    // Professional subscriber who bought Agency ended up billed for BOTH
    // ($99 + $399 = $498/mo) instead of $399. Plan changes belong in the billing
    // portal, which prorates. Refuse rather than risk a double charge; if the Stripe
    // lookup itself fails, the surrounding catch returns 500 and no session is
    // created — also fail-closed.
    const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    const billing = existing.data.filter((s) => ACTIVE_SUBSCRIPTION_STATES.has(s.status));
    if (billing.length > 0) {
      return NextResponse.json(
        {
          error:
            "You already have an active subscription. Change your plan from the billing portal " +
            "so you're charged the difference instead of being billed twice.",
          portal: true,
        },
        { status: 409 }
      );
    }

    const priceId = await resolvePriceId(stripe, plan, interval);
    const successPath = plan === "premium" ? "/billing?checkout=success" : "/agency?checkout=success";
    const cancelPath = plan === "premium" ? "/pricing?checkout=cancelled" : "/agency?checkout=cancelled";

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${base}${successPath}`,
      cancel_url: `${base}${cancelPath}`,
      subscription_data: { metadata: { userId: user.id, plan, interval } },
      metadata: { userId: user.id, plan, interval },
    });

    await track(PRODUCT_EVENTS.subscriptionStarted, { userId: user.id, meta: { plan, interval } });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    console.error("stripe checkout error", e);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
