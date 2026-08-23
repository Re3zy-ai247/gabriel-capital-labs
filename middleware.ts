import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDemoIdentityBlocked } from "./lib/demoIdentity";
import { loginPathFor } from "./lib/callbackUrl";

// The only surface a suspended account can use. Never redirected away from.
const CANCEL_PATH = "/billing/cancel";

// Authenticated route roots (RC1 S2 — P0-5). A visitor with no session evidence
// is sent to /login carrying the path they asked for, instead of arriving at a
// fully-chromed page that renders their credit file as 0 / 0 / 0.
//
// Kept as a literal prefix list rather than "everything except a public
// allowlist" on purpose: an inverted rule silently captures every route added
// later, including a public one, and the failure mode is a page nobody can
// reach. Adding a route here is a deliberate act.
//
// Deliberately ABSENT:
//   /                      public landing (its own branch below)
//   /login /register /forgot-password /reset-password /pricing /legal /help
//                          public by design
//   /support               must work signed-out — a consumer who cannot sign in
//                          still has to be able to ask for help (A1-09). The
//                          page shows the support address and says plainly that
//                          tickets need a session.
//   /billing/*             the suspended payer's only remedy lives at
//                          /billing/cancel, and slices S1 + the
//                          password-session-revocation guard pin the invariant
//                          that NOTHING under /billing is ever matched. The
//                          whole prefix is therefore left out, and the remedy is
//                          ALSO excluded in code below, so the invariant holds
//                          in behaviour and not only in configuration.
//   /api/*                 routes answer 401 as JSON; a redirect would turn an
//                          honest error into an HTML page a fetch() cannot read.
const AUTHED_ROUTES = [
  "/academy", "/admin", "/agency", "/arena", "/brief", "/builder",
  "/campaigns", "/community", "/dashboard", "/identity", "/journey", "/letters",
  "/mail", "/modules", "/network", "/onboarding", "/scores", "/settings",
  "/strategist", "/tradelines", "/upload",
];

function isAuthedRoute(pathname: string): boolean {
  return AUTHED_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

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
  const usable = hasSessionEvidence && !isDemoIdentityBlocked(process.env.NODE_ENV, token.email);
  // Only the landing sends a signed-in visitor onward; /dashboard is matched
  // both for the cancellation-only branch above and the authed branch below,
  // and must never self-redirect.
  if (pathname === "/" && usable) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // P0-5 / A1-01. Defence in depth, deliberately kept even though /billing is
  // absent from the matcher above: if a later edit ever adds the prefix, the
  // suspended payer's only remedy still cannot be redirected away.
  if (pathname === CANCEL_PATH) return NextResponse.next();

  // An expired, stale or absent session leaves for /login and returns here.
  // This is NAVIGATION only and is not the authority: it reads a cookie and
  // cannot ask the database whether the account still exists or was disabled
  // after sign-in. lib/requireSession.ts (and app/scores/layout.tsx, and
  // app/admin/layout.tsx) do that on the server, and must stay in place — this
  // check exists so the consumer never reaches a screen that shows their credit
  // file empty, not to replace the server gate.
  //
  // Development is exempt for the same reason lib/session.ts's
  // currentUserOrDemo() has a demo fallback: the app has to stay explorable
  // without configured auth. The test is positive ("development"), so every
  // other runtime — production, preview, test, unset — fails closed.
  if (isAuthedRoute(pathname) && !usable && process.env.NODE_ENV !== "development") {
    const target = pathname + req.nextUrl.search;
    return NextResponse.redirect(new URL(loginPathFor(target), req.url));
  }

  return NextResponse.next();
}

// The landing (redirect a signed-in visitor onward) plus every authenticated
// route root, so an expired session is caught at navigation rather than at the
// bottom of a rendered page. Public routes and /api are absent by design; see
// AUTHED_ROUTES above for the full rationale, including why /support and
// /billing/cancel stay reachable signed-out.
export const config = {
  matcher: [
    "/",
    "/academy/:path*", "/admin/:path*", "/agency/:path*", "/arena/:path*",
    "/brief/:path*", "/builder/:path*", "/campaigns/:path*",
    "/community/:path*", "/dashboard/:path*", "/identity/:path*",
    "/journey/:path*", "/letters/:path*", "/mail/:path*", "/modules/:path*",
    "/network/:path*", "/onboarding/:path*", "/scores/:path*",
    "/settings/:path*", "/strategist/:path*", "/tradelines/:path*",
    "/upload/:path*",
  ],
};
