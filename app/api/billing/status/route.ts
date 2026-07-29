import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { currentAccount } from "@/lib/session";
import { getEntitlement } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

// Returns the signed-in user's real billing state + monthly usage for the UI.
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
  // Distinguish the tiers so the UI can label + price them correctly.
  const plan =
    user.plan === "agency_pro" ? "agency_pro"
    : user.isAgency || user.plan === "agency" ? "agency"
    : entitlement.premium ? "premium"
    : "free";
  return NextResponse.json({
    plan,
    isAgency: Boolean(user.isAgency),
    letterCredits: entitlement.letterCredits,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    memberSince: user.createdAt,
    hasStripeCustomer: Boolean(user.stripeCustomerId),
    entitlement,
  });
}
