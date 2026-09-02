import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/session";
import {
  canAccessCommunity,
  communityEnabled,
  communityDisplayName,
  COMMUNITY_UNAVAILABLE,
} from "@/lib/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lightweight probe for nav + UI: may the signed-in account use the community,
// is it an admin (moderation controls), and what display name will its posts use?
//
// RC1-S6a (D-8): `canAccess` used to mean "has paid". It now means only "the
// network is switched on and you are signed in" — there is no tier to report.
// `available` + `unavailableReason` are additive so the UI can render the honest
// feature-off state instead of a membership pitch.
export async function GET() {
  const account = await currentAccount();
  const available = communityEnabled();
  const canAccess = canAccessCommunity(account);
  return NextResponse.json({
    canAccess,
    available,
    unavailableReason: available ? null : COMMUNITY_UNAVAILABLE,
    isAdmin: account?.role === "ADMIN",
    displayName: account && canAccess ? communityDisplayName(account) : null,
  });
}
