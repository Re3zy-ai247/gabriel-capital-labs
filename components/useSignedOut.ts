"use client";
import { useSession } from "next-auth/react";

// The one place the app decides whether to show a consumer a way OUT or a way
// IN (RC1 S2 — P0-5 correction G, review MEDIUM-2).
//
// Every control that used to be labelled "Log out" unconditionally was, for a
// consumer whose session had expired, the only route back into the product
// wearing the label of the one thing they did not want to do. The sidebar, the
// mobile drawer and the app header must agree about this — a screen that says
// "You're signed out" in its body and "Log out" in its header, three inches
// apart, is exactly the confusion this slice exists to remove.
//
// The SessionProvider is already mounted at the root layout
// (components/Providers.tsx via app/layout.tsx), so this costs no extra request:
// NextAuth resolves the session once per page load regardless.
//
// While the session is still resolving (`status === "loading"`) this returns
// false, keeping the signed-in spelling — the overwhelmingly common case — and
// settles to the truth the moment it resolves. Only a RESOLVED "unauthenticated"
// flips it, which includes the pre-RC1 uid-only JWTs lib/auth.ts now declines to
// honour: precisely the population that must be offered a way in.
export function useSignedOut(): boolean {
  const { status } = useSession();
  return status === "unauthenticated";
}
