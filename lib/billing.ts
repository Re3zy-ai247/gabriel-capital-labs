import type Stripe from "stripe";
import { prisma } from "./prisma";
import { planForPrice } from "./stripe";
import { ACTIVE_SUBSCRIPTION_STATES } from "./os/host/billingTier";
import { reportError } from "./observability";

// Stripe reports "this id does not exist here" as an invalid_request_error with
// code `resource_missing` (HTTP 404) — that covers both a deleted customer and a
// TEST-mode id used with a LIVE key. Anything else (rate limit, API error,
// connection failure) is transient and must NOT be mistaken for "no customer".
function isMissingStripeResource(e: unknown): boolean {
  const err = (e ?? {}) as { type?: string; rawType?: string; code?: string; statusCode?: number };
  if (err.code === "resource_missing") return true;
  return err.statusCode === 404 && (err.type === "StripeInvalidRequestError" || err.rawType === "invalid_request_error");
}

// Ensure the user has a Stripe customer, creating one (and persisting the id) if
// needed. Reused by both checkout and the billing portal.
export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  user: { id: string; email: string; name?: string | null; stripeCustomerId?: string | null }
): Promise<string> {
  // A stored id can be stale — e.g. a TEST-mode customer after the secret key was
  // switched to LIVE. Verify it still exists in the current Stripe mode; only a
  // MISSING customer falls through to creating a fresh one.
  if (user.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId);
      if (existing && !(existing as { deleted?: boolean }).deleted) return user.stripeCustomerId;
    } catch (e) {
      // ONLY a genuinely missing customer (wrong mode / deleted) may fall through
      // to creating a new one. A transient 429/500/network blip must re-throw: a
      // bare catch here would mint a SECOND Stripe customer for a user who already
      // has one, which is how double-billing starts.
      if (!isMissingStripeResource(e)) throw e;
    }
  }
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
  if (!user) {
    // The money path just went nowhere: Stripe has a paying customer we cannot map
    // to a User, and the webhook answers 200 so Stripe never retries. Silence here
    // means the entitlement is simply lost, so make it visible.
    reportError(new Error("Stripe subscription has no matching User"), {
      scope: "stripe-billing",
      phase: "sync-subscription",
      customerId,
      subscriptionId: sub.id,
      subscriptionStatus: sub.status,
    });
    return;
  }

  const active = ACTIVE_SUBSCRIPTION_STATES.has(sub.status);
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  // Which tier did they actually buy? The agency price unlocks the agency workspace.
  // planForPrice fails CLOSED — an unrecognized price returns null rather than
  // guessing a paid tier, and we then leave `plan` exactly as it is.
  const price = sub.items.data[0]?.price;
  const tier = planForPrice(price);
  if (active && !tier) {
    reportError(new Error("Unrecognized Stripe price — plan left unchanged"), {
      scope: "stripe-billing",
      phase: "sync-subscription",
      customerId,
      subscriptionId: sub.id,
      priceId: price?.id ?? null,
      lookupKey: price?.lookup_key ?? null,
      unitAmount: price?.unit_amount ?? null,
    });
  }

  const data: {
    stripeSubscriptionId: string;
    subscriptionStatus: string;
    plan?: string;
    currentPeriodEnd: Date | null;
    isAgency?: boolean;
  } = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  };

  // Only write `plan` when we actually know what was bought. Revoking is always
  // safe (inactive → free); provisioning is not, so an active subscription on an
  // unrecognized price keeps whatever plan the account already had.
  if (!active) data.plan = "free";
  else if (tier) data.plan = tier;

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

// Claim a Stripe event id in the dedup ledger BEFORE any handling work.
// Stripe delivers webhooks AT LEAST ONCE and makes no ordering guarantee, so the
// same event can arrive twice (retry after a slow 2xx, a manual "Resend"). Returns
// true when this call was the first to record the id — the caller then owns the
// event; false means it was already processed and must NOT be handled again.
export async function claimStripeEvent(eventId: string, type: string): Promise<boolean> {
  await ensureDedupTable();
  const inserted = await prisma.$executeRawUnsafe(
    `INSERT INTO "StripeWebhookEvent" ("id", "type") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING`,
    eventId,
    type
  );
  return inserted > 0;
}

// Give the claim back when handling FAILED, so Stripe's retry can process the
// event instead of being deduped into oblivion. Best effort: if the release itself
// fails we report it rather than mask the original handler error.
export async function releaseStripeEvent(eventId: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "StripeWebhookEvent" WHERE "id" = $1`, eventId);
  } catch (e) {
    reportError(e, { scope: "stripe-billing", phase: "release-event", eventId });
  }
}

// Grant one-time letter credits (from a letter-pack purchase). Stripe delivers
// webhooks AT LEAST ONCE, so the same checkout.session.completed event can arrive
// more than once (retry on a slow 2xx, network hiccup, or a manual "Resend").
// When an eventId is supplied we record it in a ledger and increment in the SAME
// transaction, so a redelivery is a no-op and can never double-credit. Without an
// eventId the grant is unconditional (e.g. an admin/manual grant).
//
// The ledger row is keyed `<eventId>:letters_5`, NOT the bare event id, because
// the webhook now claims the bare id for the whole event (claimStripeEvent). Two
// claims on the same key would make the second a no-op and silently skip the
// credit; the suffix keeps this transactional grant as independent belt-and-braces
// (it still blocks a double credit if the event is re-handled after a release).
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
      `${eventId}:letters_5`,
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
