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

// A claim is written as `pending:<eventType>` and rewritten to the bare
// `<eventType>` by completeStripeEvent once handling has actually finished. The
// existing `type` column therefore carries the pending-vs-completed distinction —
// no new column, no new table, no migration.
//
// Rows written before this change hold a bare type, so they read as COMPLETED and
// keep refusing duplicates exactly as they did. The letter-pack ledger row
// (`<eventId>:letters_5`) is likewise bare and unaffected.
const PENDING_PREFIX = "pending:";

// A claim still pending after this long cannot belong to a live invocation: the
// longest maxDuration this app declares is 60s and Vercel's ceiling is far below
// 15 minutes, so the instance that held it was timed out, OOM-killed or evicted
// before it could complete or release. Such a claim is abandoned by definition and
// may be re-claimed, which is what lets Stripe's retry actually run instead of
// being deduped into oblivion. The window is deliberately far wider than any
// possible execution so a SLOW invocation is never stolen from mid-flight.
const STALE_CLAIM_MINUTES = 15;

// Claim a Stripe event id in the dedup ledger BEFORE any handling work.
// Stripe delivers webhooks AT LEAST ONCE and makes no ordering guarantee, so the
// same event can arrive twice (retry after a slow 2xx, a manual "Resend"). Returns
// true when this call now owns the event; false means it is already completed, or
// another invocation is handling it right now, and it must NOT be handled again.
//
// Still ONE atomic statement: the INSERT wins the race for a fresh id, and the
// ON CONFLICT arm re-claims ONLY a row that is both still pending and older than
// the abandonment window. A completed row never matches the WHERE, so a genuine
// duplicate is still refused forever.
/** Outcome of trying to take the processing claim for a Stripe event.
 *  - `claimed`    — this invocation owns the event and must handle it.
 *  - `completed`  — a previous delivery handled it to completion. Acknowledge (200);
 *                   Stripe should stop retrying, which is correct.
 *  - `in_flight`  — a claim exists, is still PENDING, and has not aged out. Either a
 *                   concurrent invocation is working on it, or one died less than
 *                   STALE_CLAIM_MINUTES ago. The caller MUST answer non-2xx.
 *
 *  The third state is the whole point. Collapsing `in_flight` into `completed` and
 *  answering 200 was the residual defect: Stripe treats 200 as "delivered", stops
 *  retrying, and if the claim-holder had actually died the event is lost forever —
 *  the exact failure the pending/stale mechanism exists to prevent. */
export type StripeEventClaim = "claimed" | "completed" | "in_flight";

export async function claimStripeEvent(eventId: string, type: string): Promise<StripeEventClaim> {
  await ensureDedupTable();
  const claimed = await prisma.$executeRawUnsafe(
    `INSERT INTO "StripeWebhookEvent" ("id", "type") VALUES ($1, $2)
     ON CONFLICT ("id") DO UPDATE
       SET "type" = EXCLUDED."type", "createdAt" = CURRENT_TIMESTAMP
     WHERE "StripeWebhookEvent"."type" LIKE '${PENDING_PREFIX}%'
       AND "StripeWebhookEvent"."createdAt" < CURRENT_TIMESTAMP - INTERVAL '${STALE_CLAIM_MINUTES} minutes'`,
    eventId,
    PENDING_PREFIX + type
  );
  if (claimed > 0) return "claimed";

  // The claim was refused. Read the surviving row to learn WHY: a settled row has
  // the bare event type, a live claim still carries the pending marker.
  const rows = await prisma.$queryRawUnsafe<Array<{ type: string }>>(
    `SELECT "type" FROM "StripeWebhookEvent" WHERE "id" = $1`,
    eventId
  );
  const existing = rows[0]?.type;
  // No row at all should be impossible after an ON CONFLICT refusal, but if it
  // happens, treat it as in-flight so Stripe retries rather than dropping the event.
  if (!existing) return "in_flight";
  return existing.startsWith(PENDING_PREFIX) ? "in_flight" : "completed";
}

// Settle the claim once handling has SUCCEEDED. Until this runs the row is only a
// pending claim, so an invocation killed between the claim and the response leaves
// a claim that expires instead of one that silently swallows Stripe's retry.
// Best effort: the work is already done and Stripe must not be told to retry it,
// so a failure here is reported, not thrown. The row then expires and a manual
// "Resend" could re-handle the event — every handler is idempotent (subscription
// syncs re-retrieve current state; the letter-pack grant has its own transactional
// ledger key), so that is the safe direction to fail in.
export async function completeStripeEvent(eventId: string, type: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "StripeWebhookEvent" SET "type" = $2 WHERE "id" = $1`,
      eventId,
      type
    );
  } catch (e) {
    reportError(e, { scope: "stripe-billing", phase: "complete-event", eventId });
  }
}

// Give the claim back when handling FAILED, so Stripe's retry can process the
// event immediately instead of waiting out the abandonment window. Scoped to a
// PENDING row so it can never delete a settled one. Best effort: if the release
// itself fails we report it rather than mask the original handler error.
export async function releaseStripeEvent(eventId: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "StripeWebhookEvent" WHERE "id" = $1 AND "type" LIKE '${PENDING_PREFIX}%'`,
      eventId
    );
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
