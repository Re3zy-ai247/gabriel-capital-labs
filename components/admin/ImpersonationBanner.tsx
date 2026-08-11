"use client";
import { useRouter } from "next/navigation";
import { Eye, LogOut } from "lucide-react";
import { useAdminContext, clearAdminContextCache } from "./useAdminContext";

// Persistent banner shown while an admin is impersonating ("viewing as") a user,
// so it's always obvious — and one click to exit.
export function ImpersonationBanner() {
  const ctx = useAdminContext();
  const router = useRouter();

  if (!ctx?.impersonating.active) return null;

  async function exit() {
    await fetch("/api/admin/impersonate/stop", { method: "POST" });
    // T2 persistence-safety fix (T2-SPEC.md §1 item 4): under RoomsShell's
    // persistent mount, useAdminContext's module-level cache can otherwise
    // survive this exit and keep reporting `impersonating.active: true` for
    // up to its 60s TTL — clearing it before refresh() guarantees the next
    // fetch (triggered by router.refresh()'s server re-render, and by this
    // component's own pathname-reactive effect once /admin/users mounts) is
    // genuinely fresh, not a stale hit.
    clearAdminContextCache();
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-rose-500/40 bg-rose-500/10 px-5 py-2 text-xs text-rose-200">
      <span className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5" />
        Viewing as <span className="font-semibold">{ctx.impersonating.name || ctx.impersonating.email}</span> — actions
        affect their account.
      </span>
      <button onClick={exit} className="flex items-center gap-1 font-semibold underline hover:text-rose-100">
        <LogOut className="h-3.5 w-3.5" /> Exit
      </button>
    </div>
  );
}
