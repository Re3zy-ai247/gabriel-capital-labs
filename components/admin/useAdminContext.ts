"use client";
import { useEffect, useState } from "react";

export interface AdminContext {
  isAdmin: boolean;
  openReports?: number;
  pendingBrief?: number;
  impersonating: { active: boolean; email?: string; name?: string | null };
}

// Fetches the admin/impersonation probe once on mount. Returns null until loaded.
export function useAdminContext(): AdminContext | null {
  const [ctx, setCtx] = useState<AdminContext | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/context")
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
