import { NextResponse } from "next/server";
import { sessionAccountState } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/admin";
import { enforceRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// CANCELLATION-ONLY billing path for a SUSPENDED account that is still being
// charged.
//
// THE PROBLEM: currentAccount() fails closed on `disabled`, so every ordinary
// surface — including /api/stripe/portal — answers a suspended user as if they
// were signed out. A user we disabled while they held a live paid subscription
// therefore kept getting billed with no self-service way to stop it. That is a
// consumer-harm and chargeback problem, not merely a UX one.
//
// WHY NOT THE STRIPE BILLING PORTAL: owner policy forbids handing a disabled user
// an unrestricted portal session. The portal's surface (update card, change plan,
// resume, buy) is controlled by a Billing Portal *configuration* that lives in the
// Stripe dashboard, NOT in this repository — `stripe.billingPortal.sessions.create`
// in app/api/stripe/portal/route.ts passes no `configuration`, and there is no
// configuration object anywhere in the tree. So "portal is cancellation-only"
// cannot be PROVEN from repository truth and must not be assumed. This route
// instead performs the cancellation server-side, which is exactly what
// app/api/admin/billing/cancel/route.ts already does — the same Stripe primitive,
// reused, with the subject fixed to the caller.
//
// WHAT THIS ROUTE CANNOT DO, BY CONSTRUCTION: it never creates a Checkout session,
// a subscription, a price or a portal session; it never writes to the User row; it
// never changes `disabled`, `plan` or `role`. It calls exactly one mutating Stripe
// method — subscriptions.update(..., { cancel_at_period_end: true }) — on the
// subscription id stored on the CALLER'S OWN row. No identifier is ever read from
// the request body, so there is no parameter through which one account could name
// another account's subscription.
//
// DEFAULT = cancel at period end (matching the admin route's default). The user has
// already paid for the current period; an immediate cancel would forfeit paid time
// they are still entitled to, and would be the harsher outcome to apply by default
// to someone we suspended. Consequence, stated plainly: billing stops at the end of
// the current period, not instantly, and one already-paid period may still elapse.
// Immediate cancellation stays an ADMIN action (app/api/admin/billing/cancel).

const SUPPORT_HINT =
  "If this keeps failing, email support@creditvector.app from the address on your account and we will cancel it for you.";

// One shared refusal for "you are not the subject of this path". Suspension itself
// is not a billing state we explain here; the ordinary billing page is where an
// active account belongs.
const ENABLED_REFUSAL =
  "This path is only for suspended accounts. Your account is active — manage your subscription from the billing page.";

const NO_SUBSCRIPTION =
  "We have no active paid subscription on file for this account, so there is nothing to cancel.";

// Read-only eligibility, from the User row alone (no Stripe call, no mutation).
// Exists so the cancellation page can render truthfully for a disabled user, who
// cannot load any ordinary authenticated surface to find out. Returns booleans and
// human copy only — never a Stripe customer or subscription id.
export async function GET() {
  const state = await sessionAccountState();
  if (state.state === "anonymous") {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }
  if (state.state === "enabled") {
    return NextResponse.json({ eligible: false, reason: "enabled", message: ENABLED_REFUSAL });
  }
  const eligible = Boolean(state.account.stripeCustomerId && state.account.stripeSubscriptionId);
  return NextResponse.json({
    eligible,
    reason: eligible ? "eligible" : "no_subscription",
    message: eligible
      ? "Your account is suspended. You can cancel your paid subscription here so you are not billed again."
      : NO_SUBSCRIPTION,
  });
}

export async function POST() {
  // 1. Identity: immutable session user id only. Not email, not any cookie, and
  //    nothing from the request body — this handler reads no body at all.
  const state = await sessionAccountState();
  if (state.state === "anonymous") {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  // 2. This path is for SUSPENDED accounts and no one else. An active account is
  //    refused here and sent back to the ordinary portal, which is what keeps the
  //    normal billing path provably unchanged by this route's existence.
  if (state.state === "enabled") {
    return NextResponse.json({ error: ENABLED_REFUSAL }, { status: 403 });
  }
  const account = state.account;

  // 3. Rate limit, keyed by the resolved user id (not IP): the subject is already
  //    authenticated, so the id is the precise, unspoofable bucket, and it cannot
  //    be shared by an unrelated user behind the same NAT. Cancellation is a rare
  //    action; 5 attempts per 5 minutes leaves room to retry a Stripe blip. The
  //    limiter fails OPEN by design, so it can never be what strands a subscriber.
  const limited = await enforceRateLimit(`billing:self-cancel:${account.id}`, 5, 300);
  if (limited) return limited;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: `Billing is not configured, so we cannot cancel automatically right now. ${SUPPORT_HINT}` },
      { status: 503 }
    );
  }

  // 4. Fail closed for a disabled NON-paying account: no customer or no
  //    subscription on the row means there is nothing here to cancel, and we do
  //    not go looking for one by email or by name.
  if (!account.stripeCustomerId || !account.stripeSubscriptionId) {
    return NextResponse.json({ error: NO_SUBSCRIPTION }, { status: 404 });
  }
  const customerId = account.stripeCustomerId;
  const subscriptionId = account.stripeSubscriptionId;

  // Whether the cancellation request was actually handed to Stripe. A throw AFTER
  // that point may be a lost RESPONSE to a request that already applied, so the
  // failure copy below must not claim nothing changed. See the catch block.
  let mutationAttempted = false;

  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    // 5. Defense in depth: the id came from this user's own row, but if that row
    //    were ever mis-stitched by a webhook, cancelling would hit someone else's
    //    subscription. Refuse unless Stripe agrees the subscription belongs to
    //    this user's customer.
    const owner = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (owner !== customerId) {
      console.error("self-cancel ownership mismatch", { userId: account.id });
      await logAudit({
        actor: { id: account.id, email: account.email },
        action: "billing.self_cancel_refused",
        summary: "Refused self-cancellation: stored subscription does not belong to this account's Stripe customer",
        targetType: "subscription",
        targetId: subscriptionId,
      });
      return NextResponse.json(
        { error: `We could not verify this subscription against your account, so we did not change it. ${SUPPORT_HINT}` },
        { status: 409 }
      );
    }

    // 6. Idempotent: if it is already gone, or already scheduled to end, report
    //    success WITHOUT issuing a second mutation.
    const alreadyGone = sub.status === "canceled" || sub.status === "incomplete_expired";
    const alreadyScheduled = sub.cancel_at_period_end === true;
    if (alreadyGone || alreadyScheduled) {
      return NextResponse.json({
        ok: true,
        alreadyCanceled: true,
        cancelAtPeriodEnd: !alreadyGone,
        message: alreadyGone
          ? "This subscription is already canceled. You will not be billed again."
          : "Cancellation is already scheduled. You will not be billed again after the current period ends.",
      });
    }

    mutationAttempted = true;
    const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

    await logAudit({
      actor: { id: account.id, email: account.email },
      action: "billing.self_cancel",
      summary: "Suspended account canceled its own subscription (at period end) via the cancellation-only path",
      targetType: "subscription",
      targetId: subscriptionId,
    });

    return NextResponse.json({
      ok: true,
      alreadyCanceled: false,
      cancelAtPeriodEnd: updated.cancel_at_period_end === true,
      message:
        "Your subscription is canceled. You will not be billed again after the current period ends. Your account remains suspended.",
    });
  } catch (e) {
    // Recoverable, human-readable, and deliberately opaque: Stripe error messages
    // embed live identifiers ("No such subscription: sub_...") and this caller is a
    // suspended account, so the message text goes to the server log only. Never
    // e.message, never a stack, never an id.
    //
    // The message also must not overstate what we know. The failure can land on
    // either side of the mutation: a throw from `retrieve` means nothing was sent,
    // but a throw from `update` may be a LOST RESPONSE to a request Stripe already
    // applied. Claiming "nothing was changed" in that second case is a categorical
    // statement about a state this handler cannot observe — and it is the case
    // where the subscription IS in fact scheduled to cancel. Retrying is safe
    // either way, because the idempotency branch above reports an already-scheduled
    // cancellation as success rather than issuing a second mutation.
    console.error("self-cancel stripe error", e);
    return NextResponse.json(
      {
        error: mutationAttempted
          ? `We sent the cancellation but did not get a confirmation back, so we cannot tell you yet whether it went through. Please try again in a few minutes — it is safe to retry, and if the first attempt did go through the retry will simply tell you it is already cancelled. ${SUPPORT_HINT}`
          : `We could not reach the payment processor, so nothing was sent and nothing was changed — please try again in a few minutes. ${SUPPORT_HINT}`,
      },
      { status: 502 }
    );
  }
}
