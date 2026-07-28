import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { currentAccount } from "@/lib/session";
import {
  getStripe, resolvePrice, resolvePriceId, siteUrl,
  LETTER_PACK_CREDITS, type PaidPlan, type BillingInterval,
} from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/billing";
import { ACTIVE_SUBSCRIPTION_STATES } from "@/lib/os/host/billingTier";
import {
  CURRENT_TERMS_VERSION, TERMS_URL,
  hasAcceptedTermsVersion, isCurrentTermsVersion, recordTermsAcceptance,
} from "@/lib/terms";
import { track, PRODUCT_EVENTS } from "@/lib/events";
import { reportError } from "@/lib/observability";
import { requestId } from "@/lib/log";

export const dynamic = "force-dynamic";

// Billing policy for an in-place plan upgrade, in ONE reviewable place.
// "create_prorations" charges the difference against the unused portion of the
// current period — the customer pays the delta, never a second subscription.
// Changing this changes what customers are charged: treat it as a pricing
// decision, not an implementation detail.
const UPGRADE_PRORATION_BEHAVIOR = "create_prorations" as const;

// The plans this API will actually sell, in ONE reviewable place.
//
// agency_pro is deliberately ABSENT: it is "Coming soon" on /pricing, and that
// page promises "you can't be charged for a plan that isn't available yet".
// Re-add it here the day the tier goes live, together with its live price.
//
// This list is a REFUSAL list, not a default list — see the validation at the
// subscription branch below. Coercing an unrecognized plan into a purchasable one
// sells the customer a product they did not ask for.
const PURCHASABLE_PLANS = ["premium", "agency"] as const;
type PurchasablePlan = (typeof PURCHASABLE_PLANS)[number];
function isPurchasablePlan(value: string): value is PurchasablePlan {
  return (PURCHASABLE_PLANS as readonly string[]).includes(value);
}

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
//   { plan?: "premium"|"agency", interval?: "month"|"year" }  — subscription
//                                     (plan omitted = premium; any other value is a 400)
//   { product: "letters_5" }                                  — one-time letter pack
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured yet. Please try again later." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));

  // Resolve the account by user ID, never by the session's email. Email is
  // user-mutable (app/api/profile/route.ts changes it) while the JWT keeps the
  // address it was minted with, so an email lookup either misses the real owner
  // — blocking a paying customer from buying — or, once the released address is
  // registered by someone else, resolves to a STRANGER's row and would charge
  // this session against that person's Stripe customer. currentAccount()
  // resolves by id and re-checks `disabled` fail-closed. It is also the right
  // helper for billing specifically: unlike currentUser(), it never follows the
  // agency workspace or admin impersonation cookie, so a purchase is always made
  // by (and billed to) the account that is actually signed in.
  //
  // The 401/404 split is preserved: no session at all is 401, a session whose
  // account no longer resolves (deleted or disabled) is 404.
  const session = await getServerSession(authOptions);
  const signedIn = Boolean((session?.user as { id?: string } | undefined)?.id);
  if (!signedIn) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const user = await currentAccount();
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
    // An unrecognized plan is REFUSED, never coerced. This line previously fell
    // back to premium for any value it did not recognize, so a client posting
    // plan:"agency_pro" (marketed at $699 on /pricing) was silently charged $99
    // and provisioned Professional — the wrong product, at the wrong price, with
    // no error telling anyone. Anything outside PURCHASABLE_PLANS is a 400 now.
    //
    // An OMITTED plan still means "premium". That is the standing contract with
    // app/billing/page.tsx, whose Upgrade button posts no body at all and means
    // Professional; only a plan that was actually ASKED for and is not sellable is
    // rejected. (Changing that default is a client change in a file this route
    // does not own.)
    const requestedPlan: string =
      typeof body.plan === "string" && body.plan.length > 0 ? body.plan : "premium";
    if (!isPurchasablePlan(requestedPlan)) {
      return NextResponse.json(
        {
          error:
            requestedPlan === "agency_pro"
              ? "Agency Pro isn't available for purchase yet, so you can't be charged for it."
              : "That plan isn't available. Please choose a plan from the pricing page.",
        },
        { status: 400 }
      );
    }
    const plan: PaidPlan = requestedPlan;
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

      // ── B-06: acceptance gate for the upgrade path ────────────────────────
      // CONSENT_COLLECTION above reaches only Checkout Sessions. This branch never
      // opens Checkout, so Stripe renders no Terms-of-Service checkbox and records
      // no acceptance — even with STRIPE_TOS_CONSENT=1. Without this gate a
      // customer moves onto a higher-priced plan having agreed to nothing at the
      // point of that charge, and Stripe offers no consent mechanism on
      // subscriptions.update. So acceptance is captured HERE, before the mutation,
      // and stored durably by @/lib/terms.
      //
      // WHY THE BODY FLAG IS NOT THE MECHANISM: `acceptTerms` is the user's
      // assertion, not the record. The record is a row written server-side, keyed
      // to the account resolved by id, carrying the version the SERVER publishes —
      // a client cannot choose which terms it is deemed to have accepted, and a
      // client that sends nothing gets no row and no plan change.
      //
      // FAIL-CLOSED: this runs before every mutation in this branch. A caller
      // hitting the API directly without acceptance gets 428 with NO subscription
      // created or modified and NO charge — the only Stripe calls that precede it
      // are the customer lookup/creation and the read-only price and subscription
      // lookups above, none of which bills anyone; a database failure throws into
      // the catch below and returns 500 with no subscription changed. There is no
      // env flag that turns it off —
      // one would be a switch that re-opens the hole.
      //
      // NOT RETROACTIVE: an existing subscriber has no row (nothing backfilled
      // one), so their next upgrade asks them, once, for this version.
      if (!(await hasAcceptedTermsVersion(user.id))) {
        if (!isCurrentTermsVersion(body.acceptTerms)) {
          return NextResponse.json(
            {
              error: "Please review and accept the Terms of Service to change your plan.",
              termsRequired: true,
              termsVersion: CURRENT_TERMS_VERSION,
              termsUrl: TERMS_URL,
            },
            { status: 428 }
          );
        }
        // Durable first: if this write fails we never reach the charge.
        await recordTermsAcceptance(user.id, CURRENT_TERMS_VERSION, "stripe_subscription_upgrade");
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
    // Revenue path. A failure here is a customer who tried to pay and could not, and
    // it was previously invisible beyond a console line. Safe identifiers only — no
    // Stripe secrets, no card data, no request body. The user-facing response is
    // unchanged: reporting is additive and reportError never throws.
    reportError(e, {
      scope: "stripe-checkout",
      requestId: requestId(req),
      userId: user.id,
      plan: typeof body?.plan === "string" ? body.plan : null,
      product: typeof body?.product === "string" ? body.product : null,
    });
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
