import type Stripe from "stripe";
import { prisma } from "./prisma";

// Ensure the user has a Stripe customer, creating one (and persisting the id) if
// needed. Reused by both checkout and the billing portal.
export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  user: { id: string; email: string; name?: string | null; stripeCustomerId?: string | null }
): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

// Reconcile a Stripe subscription into our User row. Called from the webhook on
// every subscription lifecycle event so `plan` and `subscriptionStatus` stay in
// sync with Stripe (the system of record for billing).
export async function syncSubscriptionToUser(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) return;

  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      plan: active ? "premium" : "free",
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
}
