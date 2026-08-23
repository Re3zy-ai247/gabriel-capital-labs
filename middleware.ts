import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDemoIdentityBlocked } from "./lib/demoIdentity";

// The only surface a suspended account can use. Kept out of the matcher below.
const CANCEL_PATH = "/billing/cancel";

// Signed-in visitors skip the marketing landing and go straight to Kai Home.
// Doing this here (instead of getServerSession inside app/page.tsx) lets the
// landing render fully static — the auth check was the only thing forcing it
// dynamic. getToken reads the JWT cookie on the edge; no DB hit.
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const pathname = req.nextUrl.pathname;

  // A cancellation-only principal is a SUSPENDED account that authenticated for
  // exactly one purpose: to stop being charged (lib/auth.ts, M-1). It holds no
  // application session — the session callback returns null for it — so every
  // ordinary page would bounce it to /login, and app/login/page.tsx pushes to
  // /dashboard on a successful sign-in. Without this branch a suspended payer
  // would sign in successfully and land in a /dashboard → /login loop, never
  // reaching the one surface that works for them. Send them there instead. This
  // grants nothing: /billing/cancel renders from a booleans-only eligibility
  // call and links nowhere into the app.
  if (token?.cancellationOnly === true) {
    if (pathname === CANCEL_PATH) return NextResponse.next();
    return NextResponse.redirect(new URL(CANCEL_PATH, req.url));
  }

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
  // Only the landing sends a signed-in visitor onward; /dashboard is matched
  // solely for the cancellation-only branch above, and must never self-redirect.
  if (
    pathname === "/" &&
    hasSessionEvidence &&
    !isDemoIdentityBlocked(process.env.NODE_ENV, token.email)
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

// The landing (redirect a signed-in visitor onward) plus /dashboard (the one
// place app/login/page.tsx sends a successful sign-in, so a cancellation-only
// principal has to be caught there). Everything else guards itself server-side.
// /billing/cancel is deliberately NOT matched, so the suspended user's only
// remedy can never be redirected away from.
export const config = { matcher: ["/", "/dashboard"] };
