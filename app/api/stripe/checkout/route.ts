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

// Billing policy for an in-place plan upgrade, in ONE reviewable place.
// "create_prorations" charges the difference against the unused portion of the
// current period — the customer pays the delta, never a second subscription.
// Changing this changes what customers are charged: treat it as a pricing
// decision, not an implementation detail.
const UPGRADE_PRORATION_BEHAVIOR = "create_prorations" as const;

// Terms-of-Service acceptance at the point of payment, in ONE reviewable place.
//
// Stripe renders a required "I agree to the Terms of Service" checkbox and records
// the acceptance on the Session as `consent.terms_of_service = "accepted"` with a
// timestamp — Stripe is the durable system of record, so we invent no parallel
// consent workflow (CROA wants a durable, retrievable acceptance; this is it).
//
// WHY THIS IS A FLAG AND NOT ALWAYS-ON: Stripe REJECTS session creation with
// "You cannot collect consent to your terms of service unless a URL is set in the
// Stripe Dashboard" (Settings → Public details → Terms of Service + Privacy Policy).
// Shipping this unconditionally before those URLs exist would 500 every checkout —
// a total billing outage. So it stays off until the Dashboard is configured, and
// STRIPE_TOS_CONSENT=1 turns it on with no redeploy of logic.
//
// Turn-on order (both required, in this order):
//   1. Stripe Dashboard → Settings → Public details → set Terms of Service URL
//      (https://www.creditvector.app/legal/terms) and Privacy Policy URL
//      (https://www.creditvector.app/legal/privacy).
//   2. Set STRIPE_TOS_CONSENT=1 in Vercel and redeploy.
// Verify on a preview deploy first: the checkbox appears and checkout still opens.
const TOS_CONSENT_ENABLED = process.env.STRIPE_TOS_CONSENT === "1";
const CONSENT_COLLECTION = TOS_CONSENT_ENABLED
  ? { consent_collection: { terms_of_service: "required" as const } }
  : {};

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
        ...CONSENT_COLLECTION,
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

    const priceId = await resolvePriceId(stripe, plan, interval);

    // ── UPGRADE PATH ────────────────────────────────────────────────────────
    // The tier check above only blocks buying the SAME or a LOWER plan; an upgrade
    // passes it. Creating a Checkout Session at that point opened a SECOND
    // subscription, leaving the customer billed for both ($99 + $399 = $498/mo).
    // An upgrade must MODIFY the subscription the customer already has.
    //
    // Fail-closed ordering: the lookup happens before anything is created, and if
    // it throws, the surrounding catch returns 500 with no session and no mutation.
    const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    const billing = existing.data.filter((s) => ACTIVE_SUBSCRIPTION_STATES.has(s.status));

    if (billing.length > 1) {
      // Ambiguous: we cannot know which subscription the customer meant to upgrade,
      // and guessing risks mutating the wrong one or leaving a duplicate behind.
      // Refuse and route to a human — 409, never a silent choice.
      return NextResponse.json(
        {
          error:
            "Your account has more than one active subscription, so we can't safely change your plan " +
            "automatically. Contact support and we'll sort it out without charging you twice.",
          portal: true,
        },
        { status: 409 }
      );
    }

    if (billing.length === 1) {
      const sub = billing[0];
      const items = sub.items?.data ?? [];
      if (items.length !== 1) {
        // A multi-item subscription is not a shape this app creates. Swapping a
        // price on it could drop a line the customer is paying for.
        return NextResponse.json(
          {
            error:
              "Your subscription has a custom configuration we can't change automatically. " +
              "Contact support and we'll move you across without charging you twice.",
            portal: true,
          },
          { status: 409 }
        );
      }
      if (items[0].price?.id === priceId) {
        // Already on exactly this price — nothing to do. (The tier guard above
        // catches same-plan by name; this catches same-price by identity.)
        return NextResponse.json({ error: "You're already on this plan." }, { status: 400 });
      }

      // Modify in place. Stripe prorates the difference against the unused portion
      // of the current period, so the customer pays the difference — never twice.
      // `proration_behavior` is a named constant so the billing policy is one
      // reviewable decision rather than a literal buried in a call.
      const updated = await stripe.subscriptions.update(sub.id, {
        items: [{ id: items[0].id, price: priceId }],
        proration_behavior: UPGRADE_PRORATION_BEHAVIOR,
        payment_behavior: "pending_if_incomplete",
        metadata: { userId: user.id, plan, interval },
      });

      // Entitlements are NOT written here. `customer.subscription.updated` fires and
      // the existing webhook is the single source of truth for plan state — keeping
      // one writer, and keeping this route safe to retry.
      await track(PRODUCT_EVENTS.subscriptionStarted, {
        userId: user.id,
        meta: { plan, interval, upgradedFrom: user.plan },
      });
      return NextResponse.json({
        upgraded: true,
        status: updated.status,
        message: "Your plan is updated. You'll be charged the prorated difference, not a second subscription.",
      });
    }

    // ── NEW SUBSCRIPTION PATH (no existing subscription) ────────────────────
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
      ...CONSENT_COLLECTION,
    });

    await track(PRODUCT_EVENTS.subscriptionStarted, { userId: user.id, meta: { plan, interval } });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    console.error("stripe checkout error", e);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
