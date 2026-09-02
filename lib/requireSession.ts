// The one server-side session gate every authenticated page uses (RC1 S2 —
// P0-5 / A1-01).
//
// What it replaces: nine surfaces answered an absent session with a bare
// `<AppShell><p>Please sign in.</p></AppShell>` — no link, no button, no
// redirect (app/dashboard/page.tsx:60, app/journey/page.tsx:74 and friends) —
// and the "use client" pages had no server guard at all, so an expired session
// rendered a fully-chromed credit file reading 0 / 0 / 0. For a credit product
// the honest reading of that screen is "my data was deleted". The fix is that
// nothing authenticated ever renders for an unresolved principal: the request
// leaves for /login carrying the path it came from, and comes back to it.
//
// Layering, deliberately two-deep:
//   • middleware.ts is navigation-only. It runs on the edge, sees just the JWT,
//     and cannot ask the database whether the account is still there.
//   • THIS is the authority. It goes through lib/session.ts, which re-reads the
//     row on every call and fails closed on a disabled account, a blocked demo
//     identity, or a password-version mismatch — states a cookie alone cannot
//     reveal. A page that skipped this and trusted the edge check would still
//     show a disabled account its own dashboard.
//
// It mirrors app/scores/layout.tsx (slice S9), which is this repo's existing
// precedent for a segment-level gate, and app/admin/layout.tsx before it.
import { redirect } from "next/navigation";
import { currentUserOrDemo } from "@/lib/session";
import { loginPathFor } from "@/lib/callbackUrl";

/**
 * Leave for the sign-in screen, remembering where the visitor was headed.
 * Returns `never` — `redirect()` throws, so callers may use it as a terminal
 * expression and TypeScript will narrow correctly afterwards.
 */
export function redirectToLogin(callbackPath: string): never {
  redirect(loginPathFor(callbackPath));
}

/**
 * Resolve the effective user for an authenticated page, or leave for /login.
 *
 * `callbackPath` is this page's own path (e.g. "/letters") — a literal supplied
 * by the caller, never anything read off the request, so the return destination
 * can never be steered by a visitor.
 *
 * Returns the same row `currentUserOrDemo()` does, so a caller that previously
 * wrote `const user = await currentUserOrDemo(); if (!user) …` keeps identical
 * downstream behaviour, including the development demo-account fallback.
 */
export async function requireUser(callbackPath: string) {
  const user = await currentUserOrDemo();
  if (!user) redirectToLogin(callbackPath);
  return user;
}
