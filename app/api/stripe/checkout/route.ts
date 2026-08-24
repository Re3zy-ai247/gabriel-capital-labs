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

// ── RC1-S6a · NOTHING IS FOR SALE HERE (Founder D-3 / D-4) ───────────────────
//
// PURCHASABLE_PLANS is now EMPTY. It used to be ["premium", "agency"], and the
// one-time "letters_5" pack had its own branch below. All three are closed:
//
//   letters_5  D-3  consumer letter packs are retired — assistance is free, so
//                   there is nothing left to buy. Credits already purchased are
//                   preserved and frozen (lib/entitlements), never spent.
//   premium    D-3  the consumer subscription is retired. Existing subscribers
//                   keep their portal, their invoices and their self-cancel
//                   path; this route simply no longer opens new ones.
//   agency     D-4  Agency sales are PAUSED, not cancelled. Existing Agency
//                   accounts are untouched — workspaces, capacity and the
//                   webhook that keeps their billing in sync all keep working.
//
// The refusal happens FIRST, before the Stripe client is constructed, before the
// session is read and before any customer record is created or touched: a closed
// sale must cost the consumer nothing and must not reach the processor at all.
//
// This is a source constant, not an env flag. Re-opening a sale is a Founder
// decision and must arrive as a reviewed commit, not an ops toggle.
const PURCHASABLE_PLANS = [] as const;
type PurchasablePlan = (typeof PURCHASABLE_PLANS)[number];
function isPurchasablePlan(value: string): value is PurchasablePlan {
  return (PURCHASABLE_PLANS as readonly string[]).includes(value);
}

// 410 Gone is the honest code: these products existed and no longer do. The copy
// states the fact and stops — no pricing, no alternative to buy, no "contact us
// to upgrade", nothing that reads as a pitch.
// Prototype-free ON PURPOSE. A plain object literal inherits `constructor`,
// `__proto__`, `toString` and friends, so `SALES_CLOSED["constructor"]` returned
// a FUNCTION — truthy, so `?? SALES_CLOSED_DEFAULT` never fired — and the 410
// body then carried an `error` that does not serialize to a string. No sale ever
// occurred and Stripe was never touched, but the client renders `data.error`
// directly, so it must always be a string. Object.create(null) has no prototype,
// so every key that was not written here misses and falls through to the default.
const SALES_CLOSED: Record<string, string> = Object.assign(Object.create(null), {
  letters_5:
    "Letter packs are no longer sold. You don't need one: generating dispute letters is free, with no monthly limit. Any letter credits already on your account stay on it.",
  premium:
    "CreditVector no longer sells a consumer plan. Everything the paid plan used to gate — dispute letters, escalations, personal-information corrections, your action plan — is available to you at no cost.",
  agency:
    "New Agency sign-ups are paused. Existing Agency accounts are unaffected and continue to work as they are.",
});
const SALES_CLOSED_DEFAULT =
  "This isn't for sale. CreditVector doesn't charge consumers, and no new subscriptions are being opened.";

/**
 * Refuse a purchase before anything commercial happens.
 *
 * THIS FUNCTION IS TOTAL. It contains exactly one `return`, reached
 * unconditionally, so EVERY request to this route is answered 410 and nothing
 * below the call site can execute. The nullable return type is deliberate — it
 * is what keeps the dormant machinery below type-reachable rather than dead code
 * the compiler has to be told to ignore — but that same nullability means a
 * future edit could make the refusal CONDITIONAL and still compile. So the
 * totality is pinned in scripts/no-paid-advantage.test.ts (no branch, exactly
 * one return): re-opening a sale here turns guard assertions red in CI, it does
 * not slip through as a one-line change.
 */
function refuseSale(body: { product?: unknown; plan?: unknown }): NextResponse | null {
  const product = typeof body?.product === "string" ? body.product : null;
  // An OMITTED plan has always meant "premium" on this route (app/billing's
  // Upgrade button posts no body at all), so it is refused as premium.
  const plan = typeof body?.plan === "string" && body.plan.length > 0 ? body.plan : "premium";
  const key = product ?? plan;
  return NextResponse.json(
    { error: SALES_CLOSED[key] ?? SALES_CLOSED_DEFAULT, salesClosed: true, product: key },
    { status: 410 }
  );
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

// Refuses every purchase (see SALES_CLOSED above).
//
// Everything below the refusal is the DORMANT sell machinery, kept intact and
// unreachable: the existing-subscription lookup, the in-place prorated upgrade
// that stops a customer being billed twice, the 409s that refuse to guess which
// subscription to mutate, and both Checkout Sessions. It is preserved rather
// than deleted because it is reviewed, hard-won billing-safety code that must
// still hold the day the Founder re-opens a sale — deleting it would mean
// rebuilding the double-billing protection from scratch. Nothing in it runs
// while PURCHASABLE_PLANS is empty and refuseSale answers every request.
export async function POST(req: Request) {
  // Parse first, refuse first. No Stripe client, no session lookup, no customer
  // record: a closed sale never reaches the processor.
  const body = await req.json().catch(() => ({}));
  const refusal = refuseSale(body);
  if (refusal) return refusal;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured yet. Please try again later." }, { status: 503 });
  }

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

      // Modify in place. Stripe prorates the difference against the unused portion
      // of the current period, so the customer pays the difference — never twice.
      // `proration_behavior` is a named constant so the billing policy is one
      // reviewable decision rather than a literal buried in a call.
      //
      // ⚠️ KNOWN GAP — B-06 (ToS consent is NOT collected on this path).
      // CONSENT_COLLECTION above only applies to Checkout Sessions. This upgrade
      // never opens Checkout, so Stripe renders no Terms-of-Service checkbox and
      // records no acceptance on the customer — even with STRIPE_TOS_CONSENT=1.
      // A customer can therefore move onto a higher-priced plan having agreed to
      // nothing at the point of that charge. Stripe offers no consent mechanism on
      // subscriptions.update, so closing this needs an in-app acceptance captured
      // BEFORE this call and stored durably, which needs a schema change (a
      // consent timestamp + policy version on User) under the MIGRATION-FIRST
      // policy — out of scope for this wave, tracked in the RC1 blocker list.
      // scripts/checkout-consent.test.ts currently pins the two-spread reality on
      // purpose; it must be updated in the same change that closes this.
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
