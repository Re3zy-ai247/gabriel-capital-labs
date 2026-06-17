"use client";
import { useEffect, useState } from "react";

export interface CommunityAccess {
  canAccess: boolean;
  isAdmin: boolean;
  displayName: string | null;
}

// Probes whether the signed-in account may use the Agency Community Hub. Returns
// null until loaded; used to gate the nav link and the pages.
export function useCommunityAccess(): CommunityAccess | null {
  const [ctx, setCtx] = useState<CommunityAccess | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/community/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setCtx(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return ctx;
}
