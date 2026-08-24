import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/session";
import { getStripe, siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Opens the Stripe Billing Portal so the customer can update their card, view
// invoices, or cancel — all hosted by Stripe (no card data ever touches us).
export async function POST() {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  // Resolve the account by user ID, never by the session's email. Email is
  // user-mutable (app/api/profile/route.ts changes it) while the JWT keeps the
  // address it was minted with. Resolving by email broke this route two ways:
  // a subscriber who changed their email fell through to the 400 below and could
  // no longer reach Stripe to CANCEL, and if the released address was later
  // registered by someone else the stale token resolved to THAT person's row and
  // opened a Billing Portal session against a stranger's Stripe customer.
  // currentAccount() resolves by id and re-checks `disabled` fail-closed. It is
  // also the correct helper here specifically because — unlike currentUser() —
  // it never follows the agency workspace or admin impersonation cookie, so an
  // agency can never open a consumer's billing portal.
  const user = await currentAccount();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  // RC1-S6a (D-3): this portal exists for people who ALREADY paid — invoices,
  // card updates, cancellation. It must not point anyone at a purchase. The
  // control this refusal used to name now answers 410 Gone, so telling a
  // consumer to press it would send them to a dead end for a product that is
  // no longer sold. The refusal states the fact and stops.
  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: "No subscription is associated with this account." },
      { status: 400 }
    );
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${siteUrl()}/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    console.error("stripe portal error", e);
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
