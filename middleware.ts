import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDemoIdentityBlocked } from "./lib/demoIdentity";

// Signed-in visitors skip the marketing landing and go straight to Kai Home.
// Doing this here (instead of getServerSession inside app/page.tsx) lets the
// landing render fully static — the auth check was the only thing forcing it
// dynamic. getToken reads the JWT cookie on the edge; no DB hit.
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  // A historic demo token must fail downward to the public landing page outside
  // explicit development. Redirecting it to /dashboard would create a loop once
  // currentAccount() correctly rejects the same principal.
  // The JWT callback returns `{}` for invalid/stale evidence and a marked minimal
  // token for disabled cancellation. NextAuth re-encodes either with standard
  // claims, so decoded-token truthiness alone is not an authentication signal. This edge check is
  // navigation-only and cannot DB-revalidate staleness, but it must at least require
  // the exact structural evidence every valid password session carries.
  const hasSessionEvidence =
    token?.cancellationOnly !== true &&
    typeof token?.uid === "string" &&
    token.uid.length > 0 &&
    typeof token.sessionVersion === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(token.sessionVersion);
  if (hasSessionEvidence && !isDemoIdentityBlocked(process.env.NODE_ENV, token.email)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

// Only the landing needs this — app routes guard themselves server-side.
export const config = { matcher: ["/"] };
