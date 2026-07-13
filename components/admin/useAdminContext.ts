"use client";
import { useEffect, useState } from "react";

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

// Returns null until loaded (unchanged contract for all existing callers).
export function useAdminContext(): AdminContext | null {
  const [ctx, setCtx] = useState<AdminContext | null>(cached);
  useEffect(() => {
    let cancelled = false;
    load().then((d) => {
      if (!cancelled && d) setCtx(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ctx;
}
