import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { currentAccount } from "@/lib/session";
import { getEntitlement } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

// Returns the signed-in account's billing state as HISTORY, plus the (uniform,
// free) entitlement that actually governs what it can do.
//
// RC1-S6a: the two are now different things and this route says so. `plan`,
// `subscriptionStatus`, `currentPeriodEnd` and `letterCredits` are records of
// what an account bought while CreditVector sold consumer plans; they no longer
// grant anything, and every field that is purely historical is flagged as such
// so no surface can present it as a live benefit or as a reason to buy.
export async function GET() {
  // Resolve the account by user ID, never by the session's email. Email is
  // user-mutable (app/api/profile/route.ts changes it) while the JWT keeps the
  // address it was minted with, so an email lookup either misses the real owner
  // or — once the released address is registered by someone else — resolves to a
  // STRANGER's row and reports their billing state. currentAccount() resolves by
  // id and re-checks `disabled` fail-closed. It is also the right helper for a
  // billing surface specifically: unlike currentUser(), it never follows the
  // agency workspace or admin impersonation cookie, so this always answers about
  // the payer who is actually signed in.
  //
  // The 401/404 split is preserved: no session at all is 401, a session whose
  // account no longer resolves (deleted or disabled) is 404.
  const session = await getServerSession(authOptions);
  const signedIn = Boolean((session?.user as { id?: string } | undefined)?.id);
  if (!signedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentAccount();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entitlement = await getEntitlement(user);

  // The plan OF RECORD, read straight off the account row. It is reported under
  // the same key as before because it is genuinely load-bearing for BUSINESS:
  // the Agency workspace-capacity resolver reads it, and an Agency account must
  // keep resolving to its real capacity. It is NOT read as a consumer
  // entitlement anywhere — `entitlement` above is, and it is identical for
  // everyone. (Previously the "premium" case was derived from the entitlement;
  // now that no entitlement is premium, that would have erased a legacy
  // Professional's own history, so it reads the row directly.)
  const plan =
    user.plan === "agency_pro" ? "agency_pro"
    : user.isAgency || user.plan === "agency" ? "agency"
    : user.plan === "premium" ? "premium"
    : "free";

  return NextResponse.json({
    plan,
    // True whenever the row carries a plan CreditVector no longer sells. The UI
    // must present it as "what you had", never as a current tier (copy is S6b).
    planIsHistorical: plan === "premium",
    isAgency: Boolean(user.isAgency),

    // FROZEN (D-3). Preserved exactly, shown as history, never spent — nothing
    // in the product decrements this, so the number a consumer sees today is the
    // number they will see after generating any quantity of letters.
    letterCredits: entitlement.letterCredits,
    letterCreditsFrozen: true,

    // Subscription facts, reported so a legacy payer can see and act on their own
    // billing (portal + self-cancel are untouched by this slice). No new consumer
    // subscription can be opened: /api/stripe/checkout refuses every purchase.
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    memberSince: user.createdAt,
    hasStripeCustomer: Boolean(user.stripeCustomerId),
    consumerSalesClosed: true,

    // What this account may actually do. Identical for every consumer, whatever
    // the historical fields above say.
    entitlement,
  });
}
