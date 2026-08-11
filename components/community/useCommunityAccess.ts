"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export interface CommunityAccess {
  canAccess: boolean;
  isAdmin: boolean;
  displayName: string | null;
}

// Probes whether the signed-in account may use the Agency Community Hub. Mounted
// by Sidebar AND MobileNav on every page — the module-level cache collapses that
// into one network call per page load; the TTL covers access changes (rare).
const TTL_MS = 60_000;
let cached: CommunityAccess | null = null;
let fetchedAt = 0;
let inflight: Promise<CommunityAccess | null> | null = null;

function load(): Promise<CommunityAccess | null> {
  if (cached && Date.now() - fetchedAt < TTL_MS) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/community/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CommunityAccess | null) => {
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
export function useCommunityAccess(): CommunityAccess | null {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<CommunityAccess | null>(cached);
  useEffect(() => {
    let cancelled = false;
    load().then((d) => {
      if (!cancelled && d) setCtx(d);
    });
    return () => {
      cancelled = true;
    };
    // T2 persistence-safety fix (T2-SPEC.md §1 item 2) — same rationale as
    // useAdminContext.ts: RoomsShell now mounts this hook once for the whole
    // session instead of per-page, so `[]` deps would probe only on first
    // load. Reacting to `pathname` restores an attempt per navigation; the
    // module-level TTL above still collapses that into the same cadence as
    // today.
  }, [pathname]);
  return ctx;
}
