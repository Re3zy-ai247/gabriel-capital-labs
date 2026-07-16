import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { syncSubscriptionToUser, creditLetters } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/observability";
import { track, PRODUCT_EVENTS } from "@/lib/events";

export const dynamic = "force-dynamic";
// Stripe needs the raw, unparsed body to verify the signature.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
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
            meta: { plan: cs.metadata?.plan ?? null },
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
        await syncSubscriptionToUser(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_succeeded": {
        // A successful (re)payment re-syncs the subscription so a previously-set
        // past_due status is cleared back to the live Stripe status.
        const inv = event.data.object as Stripe.Invoice;
        const subRef = (inv as { subscription?: string | { id: string } | null }).subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) await syncSubscriptionToUser(await stripe.subscriptions.retrieve(subId));
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
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
    reportError(e, { scope: "stripe-webhook", phase: "handler" }); // payment-processing failure — alert-worthy
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
