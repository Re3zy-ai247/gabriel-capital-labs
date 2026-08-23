"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, LogIn } from "lucide-react";
import { loginPathFor } from "@/lib/callbackUrl";
import { useSignedOut } from "./useSignedOut";

// Logout affordance in the top bar — always visible, including on mobile where
// the sidebar (which also has a logout) is hidden.
//
// RC1 S2 (review MEDIUM-2): this said "Log out" unconditionally, in the header of
// EVERY AppShell page — including the two signed-out panels this slice authored
// (app/support/page.tsx, app/settings/page.tsx). The body told the consumer their
// session had ended while the header offered to end it again. It now reads the
// same shared decision the sidebar does (components/useSignedOut.ts), so the app
// says one thing about the session rather than two.
export function HeaderLogout() {
  const signedOut = useSignedOut();
  const path = usePathname();

  if (signedOut) {
    return (
      <Link
        href={loginPathFor(path ?? "/dashboard")}
        className="flex items-center gap-1 text-slate-400 transition hover:text-brand-300"
        title="Sign in"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-1 text-slate-400 transition hover:text-rose-300"
      title="Log out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
