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

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: "No subscription found. Start with the Upgrade button." },
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
