"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginPathFor } from "@/lib/callbackUrl";
import { useSignedOut } from "./useSignedOut";

// The app header's primary action (RC1 S2, review MEDIUM-2). Extracted from
// components/AppShell.tsx so it can read the session; the shell itself is
// imported by "use client" pages and must stay renderable in both worlds, so it
// cannot resolve a session of its own.
//
// AppShell renders on the two signed-out surfaces this slice authored
// (app/support/page.tsx's "You're signed out" panel and app/settings/page.tsx's
// "Your session ended" panel). Offering "+ New Dispute" there promises an action
// the visitor cannot take: /upload is gated, so the click lands on /login. The
// CTA therefore says what will actually happen instead of pretending.
//
// S7 reworks the header next wave; this is deliberately the smallest change that
// stops the header contradicting the body.
export function NewDisputeCta() {
  const signedOut = useSignedOut();
  const path = usePathname();
  if (signedOut) {
    return (
      <Link href={loginPathFor(path ?? "/upload")} className="btn-primary !py-1.5">
        Sign in to start a dispute
      </Link>
    );
  }
  return <Link href="/upload" className="btn-primary !py-1.5">+ New Dispute</Link>;
}
