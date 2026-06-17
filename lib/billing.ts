import type Stripe from "stripe";
import { prisma } from "./prisma";
import { planForPrice } from "./stripe";

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
  // Which tier did they actually buy? The agency price unlocks the agency workspace.
  const tier = planForPrice(sub.items.data[0]?.price);

  const data: {
    stripeSubscriptionId: string;
    subscriptionStatus: string;
    plan: string;
    currentPeriodEnd: Date | null;
    isAgency?: boolean;
  } = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    plan: active ? tier : "free",
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  };

  // Agency access follows the agency subscription: an active agency (or Agency Pro)
  // plan unlocks it; a lapse revokes it — but never for an ADMIN (the owner keeps
  // preview access and the secret-based enable path independent of billing).
  if (active && (tier === "agency" || tier === "agency_pro")) {
    data.isAgency = true;
  } else if (!active && user.isAgency && user.role !== "ADMIN") {
    data.isAgency = false;
  }

  await prisma.user.update({ where: { id: user.id }, data });
}

// Lazily ensure the webhook-dedup ledger exists. Runtime raw SQL works through
// the Prisma Accelerate proxy (only build-time `prisma db push` does not), so we
// create the table on demand rather than depending on a migration having run.
let dedupTableReady = false;
async function ensureDedupTable(): Promise<void> {
  if (dedupTableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "StripeWebhookEvent" ("id" TEXT PRIMARY KEY, "type" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
  dedupTableReady = true;
}

// Grant one-time letter credits (from a letter-pack purchase). Stripe delivers
// webhooks AT LEAST ONCE, so the same checkout.session.completed event can arrive
// more than once (retry on a slow 2xx, network hiccup, or a manual "Resend").
// When an eventId is supplied we record it in a ledger and increment in the SAME
// transaction, so a redelivery is a no-op and can never double-credit. Without an
// eventId the grant is unconditional (e.g. an admin/manual grant).
export async function creditLetters(userId: string, credits: number, eventId?: string): Promise<void> {
  if (!eventId) {
    await prisma.user.update({
      where: { id: userId },
      data: { letterCredits: { increment: credits } },
    });
    return;
  }
  await ensureDedupTable();
  await prisma.$transaction(async (tx) => {
    const inserted = await tx.$executeRawUnsafe(
      `INSERT INTO "StripeWebhookEvent" ("id", "type") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING`,
      eventId,
      "letters_5"
    );
    // 0 rows inserted → this event was already processed; do not credit again.
    if (inserted === 0) return;
    await tx.user.update({
      where: { id: userId },
      data: { letterCredits: { increment: credits } },
    });
  });
}
