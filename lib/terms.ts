// Terms-of-Service acceptance — durable, versioned, server-side.
//
// ADOPTED from the m2 lane (4ece50622b1e6b1a3f7c9cb40aef3dd411d5b80d,
// lib/terms.ts, originally B-06) and adapted for RC1-S8: the m2 version existed
// only for the paid Stripe upgrade path, and its context vocabulary was the
// single literal "stripe_subscription_upgrade". RC1's gap is different and
// larger — D-02: NOTHING recorded that any user had agreed to anything, on any
// path, including the one every user takes. Registration is now a context, and
// the m2 context is preserved so an acceptance recorded on the purchase path
// keeps its meaning.
//
// WHY THIS MODULE EXISTS
// Nothing else records consent. Stripe records `consent.terms_of_service` only
// on a Checkout Session — nothing at all on signup, and nothing on the in-place
// plan upgrade (`stripe.subscriptions.update`), which never opens Checkout. This
// module is the record for the paths nothing else covers. It is not a second
// source of truth competing with Stripe — on those paths there is no first one.
//
// THE RULES THIS MODULE ENFORCES
//  1. Acceptance is EXPLICIT, never inferred. Nothing here derives an acceptance
//     from a purchase, a login, a plan, or an account age. The only way a row is
//     written is `recordTermsAcceptance`, called after the user asserted it.
//  2. Acceptance is VERSIONED. It records WHICH terms were agreed to, so
//     re-publishing the terms does not silently inherit an old agreement.
//  3. The recorded version is the SERVER's, never the client's string. The client
//     asserts; `isCurrentTermsVersion` verifies the assertion is about the terms
//     actually published; the server writes its own constant.
//  4. It FAILS CLOSED. Nothing here catches. A database error propagates to the
//     caller's error handler, which refuses the operation — the alternative
//     (catch → return false/true) either silently blocks with a wrong reason or,
//     far worse, silently reports consent that was never recorded.
//  5. There is NO backfill and NO default. An existing subscriber who never
//     agreed to anything has no row, and must not be given one.
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The narrowest client that can write an acceptance.
 *
 * Both the singleton and an interactive-transaction client satisfy it, which is
 * what lets registration record the acceptance and create the account in ONE
 * transaction: either both rows exist or neither does. An account that exists
 * with no acceptance is the exact condition D-02 reported, and a half-applied
 * signup must not be able to recreate it.
 */
export type TermsAcceptanceWriter = Pick<PrismaClient, "termsAcceptance">;

// The published revision of /legal/terms. Keep this in lockstep with the
// `updated` prop on app/legal/terms/page.tsx — scripts/terms-acceptance.test.ts
// fails the build's guard suite if the two drift, because a stale constant would
// let a NEW terms text be covered by an acceptance of the OLD one.
export const CURRENT_TERMS_VERSION = "2026-08-23";

// Where the user reads what they are accepting. Returned with every refusal so
// the client can link to it rather than hard-coding a path.
export const TERMS_URL = "/legal/terms";

// The privacy policy is presented alongside the terms at the point of
// acceptance, so the acceptance covers what the consumer was actually shown.
export const PRIVACY_URL = "/legal/privacy";

// Where an acceptance was given. Audit value: a row must be able to answer
// "agreed to what, and at the point of which action". A UNION, not a free
// string: a context nobody wrote down is a context nobody can audit.
//   · "registration"                — RC1-S8, the signup form (every user).
//   · "stripe_subscription_upgrade" — the m2 paid in-place upgrade path.
export type TermsContext = "registration" | "stripe_subscription_upgrade";

/** True only if the client asserted acceptance of the CURRENTLY published terms. */
export function isCurrentTermsVersion(value: unknown): boolean {
  return typeof value === "string" && value === CURRENT_TERMS_VERSION;
}

/**
 * Has this user already recorded acceptance of `version`?
 *
 * Deliberately un-caught: a read failure must surface as a refusal by the caller,
 * not as a quiet `false` (which would re-prompt a user who already agreed) and
 * never as a quiet `true`.
 */
export async function hasAcceptedTermsVersion(
  userId: string,
  version: string = CURRENT_TERMS_VERSION
): Promise<boolean> {
  const row = await prisma.termsAcceptance.findUnique({
    where: { userId_version: { userId, version } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Record an acceptance the user explicitly gave.
 *
 * Idempotent by UNIQUE(userId, version): a retried request updates nothing and
 * creates no duplicate, so the ORIGINAL acceptedAt survives — the first time they
 * agreed is the legally interesting timestamp, not the last time they retried.
 */
export async function recordTermsAcceptance(
  userId: string,
  version: string,
  context: TermsContext,
  // Defaults to the singleton so existing callers are unchanged. Registration
  // passes its transaction client — see TermsAcceptanceWriter above.
  client: TermsAcceptanceWriter = prisma
): Promise<void> {
  await client.termsAcceptance.upsert({
    where: { userId_version: { userId, version } },
    create: { userId, version, context },
    update: {}, // never overwrite an earlier acceptance of the same revision
  });
}
