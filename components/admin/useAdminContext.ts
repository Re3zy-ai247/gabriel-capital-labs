"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export interface AdminContext {
  isAdmin: boolean;
  openReports?: number;
  pendingBrief?: number;
  flaggedComments?: number;
  impersonating: { active: boolean; email?: string; name?: string | null };
}

// The probe is mounted by several shell components at once (Sidebar, MobileNav,
// ImpersonationBanner, AdminTabs) — a module-level cache collapses those into ONE
// network call per page load. A short TTL keeps the admin badges fresh across
// client-side navigations without refetching on every mount.
const TTL_MS = 60_000;
let cached: AdminContext | null = null;
let fetchedAt = 0;
let inflight: Promise<AdminContext | null> | null = null;

function load(): Promise<AdminContext | null> {
  if (cached && Date.now() - fetchedAt < TTL_MS) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/admin/context")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AdminContext | null) => {
        if (d) {
          cached = d;
          fetchedAt = Date.now();
        }
        return d;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// T2 (persistent shell — RoomsShell.tsx now mounts Sidebar/ImpersonationBanner
// ONCE instead of per-page): symmetry with useOnboardingStatus.ts's
// clearOnboardingStatusCache / KaiPresence.tsx's clearKaiPresenceCache. Admin
// status can change mid-session at the same switch points those two guard
// (impersonation start/stop) — ImpersonationBanner.exit() calls this before
// router.refresh() so a stale `impersonating.active` banner can never survive
// past the exit it's exiting from.
export function clearAdminContextCache(): void {
  cached = null;
  fetchedAt = 0;
}

// Returns null until loaded (unchanged contract for all existing callers).
export function useAdminContext(): AdminContext | null {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<AdminContext | null>(cached);
  useEffect(() => {
    let cancelled = false;
    load().then((d) => {
      if (!cancelled && d) setCtx(d);
    });
    return () => {
      cancelled = true;
    };
    // T2 persistence-safety fix (T2-SPEC.md §1 item 1): this hook used to be
    // remounted fresh on every navigation (AppShell called per page.tsx), so
    // its `[]` effect deps still ran once per page view. Under the NEW
    // persistent RoomsShell it mounts once for the whole session, so `[]`
    // alone would only ever probe on first load — reacting to `pathname`
    // restores an attempt per navigation while the module-level TTL (60s,
    // above) still suppresses the redundant network calls exactly as
    // before: net behavior = today's cadence, not a new fetch storm.
  }, [pathname]);
  return ctx;
}
