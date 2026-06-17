import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { syncSubscriptionToUser, creditLetters } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

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
    console.error("stripe webhook signature verification failed", e);
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
    console.error("stripe webhook handler error", e);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
