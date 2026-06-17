import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/session";
import { canAccessCommunity, communityDisplayName } from "@/lib/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lightweight probe for nav + UI: may the signed-in account use the community,
// is it an admin (moderation controls), and what display name will its posts use?
export async function GET() {
  const account = await currentAccount();
  const canAccess = canAccessCommunity(account);
  return NextResponse.json({
    canAccess,
    isAdmin: account?.role === "ADMIN",
    displayName: account && canAccess ? communityDisplayName(account) : null,
  });
}
