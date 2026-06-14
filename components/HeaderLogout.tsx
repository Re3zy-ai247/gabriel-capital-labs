"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

// Logout affordance in the top bar — always visible, including on mobile where
// the sidebar (which also has a logout) is hidden.
export function HeaderLogout() {
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
