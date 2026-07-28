import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import type { StripeEventClaim } from "@/lib/billing";
import {
  syncSubscriptionToUser,
  creditLetters,
  claimStripeEvent,
  completeStripeEvent,
  releaseStripeEvent,
} from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/observability";
import { track, PRODUCT_EVENTS } from "@/lib/events";

export const dynamic = "force-dynamic";
// Stripe needs the raw, unparsed body to verify the signature.
export const runtime = "nodejs";

// The event types this route actually acts on. Only these are recorded in the
// dedup ledger — everything else is acknowledged and ignored, so the ledger never
// grows with events we do not process.
const HANDLED_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

// Resolve the subscription an invoice belongs to, across BOTH Stripe payload
// shapes. Stripe moved this field in API version 2025-03-31.basil: it used to be
// the top-level `invoice.subscription`, and is now
// `invoice.parent.subscription_details.subscription`. Which one arrives depends on
// the API version pinned on the WEBHOOK ENDPOINT in the Dashboard, not on the
// version the SDK sends outbound — so reading only one shape silently yields
// undefined on the other. Returning undefined here means "not a subscription
// invoice", which gates a `past_due` write, so a wrong read is not cosmetic: it
// either flips healthy subscribers on one-time invoices, or never flags real
// dunning failures at all. Read both; prefer whichever is present.
function invoiceSubscriptionId(inv: Stripe.Invoice): string | undefined {
  const legacy = (inv as { subscription?: string | { id: string } | null }).subscription;
  const fromLegacy = typeof legacy === "string" ? legacy : legacy?.id;
  if (fromLegacy) return fromLegacy;
  const modern = (
    inv as {
      parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
    }
  ).parent?.subscription_details?.subscription;
  return typeof modern === "string" ? modern : modern?.id;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    // A rotated/missing signing key breaks EVERY entitlement event indefinitely,
    // and a silent 503 looks identical to "no traffic". Make it visible.
    reportError(new Error("Stripe webhook not configured"), {
      scope: "stripe-webhook",
      phase: "config",
      stripeConfigured: Boolean(stripe),
      signingKeyConfigured: Boolean(webhookSecret),
    });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    reportError(e, { scope: "stripe-webhook", phase: "signature" });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) return NextResponse.json({ received: true });

  // Idempotency gate. Stripe guarantees AT-LEAST-ONCE delivery, so claim the event
  // id before doing any work: a redelivery finds the id already recorded and is
  // acknowledged without being handled a second time. A ledger failure returns 500
  // so Stripe retries — handling an event with no dedup available risks double
  // credits, which is worse than a retry.
  //
  // The claim is PENDING until completeStripeEvent settles it below. That matters
  // because the only release used to be the handler catch: if this instance were
  // timed out, OOM-killed or evicted between the claim and the response, the claim
  // survived, Stripe's retry was deduped away, and the event was lost forever.
  // A pending claim instead expires (lib/billing.ts STALE_CLAIM_MINUTES), so the
  // retry is processed — while a genuine duplicate of a COMPLETED event is still
  // refused.
  let claim: StripeEventClaim;
  try {
    claim = await claimStripeEvent(event.id, event.type);
  } catch (e) {
    reportError(e, { scope: "stripe-webhook", phase: "dedupe", eventId: event.id, eventType: event.type });
    return NextResponse.json({ error: "Dedupe unavailable" }, { status: 500 });
  }
  // Already handled to completion: acknowledge, and Stripe correctly stops.
  if (claim === "completed") return NextResponse.json({ received: true, duplicate: true });
  // Still PENDING and not yet aged out. Answering 200 here would be the old bug in a
  // new place: Stripe would mark the event delivered and stop retrying, so if the
  // claim-holder had died the event would be lost anyway. Answer non-2xx and let
  // Stripe retry — by the next attempt the claim is either settled (-> 200 above) or
  // stale (-> re-claimable). 409 because this is a conflict, not a server fault.
  if (claim === "in_flight") {
    return NextResponse.json({ error: "Event already in flight", retry: true }, { status: 409 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        if (cs.subscription) {
          const subId = typeof cs.subscription === "string" ? cs.subscription : cs.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscriptionToUser(sub);
          await track(PRODUCT_EVENTS.subscriptionCompleted, {
            userId: cs.metadata?.userId ?? null,
            meta: {
              plan: cs.metadata?.plan ?? null,
              // ToS acceptance evidence. Stripe is the SYSTEM OF RECORD — it stores
              // consent.terms_of_service on the Session permanently and it is visible
              // in the Dashboard — so this is a queryable local pointer, not a second
              // source of truth. null when STRIPE_TOS_CONSENT is off (no checkbox shown).
              tosConsent: cs.consent?.terms_of_service ?? null,
              checkoutSessionId: cs.id,
            },
          });
        } else if (cs.mode === "payment" && cs.metadata?.product === "letters_5") {
          // One-time letter pack — grant the purchased credits.
          const userId = cs.metadata.userId;
          const credits = Number(cs.metadata.credits) || 0;
          if (userId && credits > 0) await creditLetters(userId, credits, event.id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // event.data.object is a SNAPSHOT from when the event was created, and
        // Stripe does not guarantee delivery order. Acting on it lets a delayed
        // `updated` arriving after `deleted` restore a revoked plan (or the
        // reverse revoke a paying customer). Re-retrieve the subscription so the
        // handler always writes CURRENT state and ordering stops mattering.
        const snapshot = event.data.object as Stripe.Subscription;
        const sub = await stripe.subscriptions.retrieve(snapshot.id);
        await syncSubscriptionToUser(sub);
        break;
      }
      case "invoice.payment_succeeded": {
        // A successful (re)payment re-syncs the subscription so a previously-set
        // past_due status is cleared back to the live Stripe status.
        const inv = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(inv);
        if (subId) await syncSubscriptionToUser(await stripe.subscriptions.retrieve(subId));
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        // Only a SUBSCRIPTION invoice may move subscription status. A failed
        // one-time invoice (e.g. the $19 letter pack) must never flip a healthy
        // subscriber to past_due — same test the success case above uses.
        const failedSubId = invoiceSubscriptionId(inv);
        if (!failedSubId) break;
        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (customerId) {
          const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: { subscriptionStatus: "past_due" },
            });
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    reportError(e, { scope: "stripe-webhook", phase: "handler", eventId: event.id, eventType: event.type }); // payment-processing failure — alert-worthy
    // Handling failed, so give the dedup claim back: without this the 500 makes
    // Stripe retry and the retry would be deduped away, losing the event forever.
    await releaseStripeEvent(event.id);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  // Handling succeeded — settle the claim. Only now does the ledger row become a
  // permanent "already processed" record; before this line it was a claim that
  // expires if this instance dies.
  await completeStripeEvent(event.id, event.type);

  return NextResponse.json({ received: true });
}
