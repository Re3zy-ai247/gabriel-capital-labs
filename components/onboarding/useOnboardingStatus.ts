"use client";
import { useEffect, useState } from "react";

export interface OnboardingProbe {
  incomplete: boolean;
}

// Probes whether the signed-in account (or its open client workspace) still
// has onboarding steps left — the only thing Sidebar needs to decide whether
// its "Getting Started" entry renders (derived, dismissible-by-completion
// only: there is no manual dismiss, it disappears once every step is
// genuinely done). Mounted by Sidebar AND MobileNav on every page — the
// module-level cache collapses that into one network call per page load,
// mirroring components/admin/useAdminContext.ts's exact pattern.
//
// This fact CAN change with an agency's open workspace (app/api/onboarding/
// status reads the client, not the agency, once one is open), so it carries
// the same cross-workspace staleness risk KaiPresence's cache had (SIM-REVIEW
// finding 4) — clearKaiPresenceCache's callers clear this one too, at the
// same three switch points (openClient, AgencyBar exit, Sidebar sign-out).
const TTL_MS = 60_000;
let cached: OnboardingProbe | null = null;
let fetchedAt = 0;
let inflight: Promise<OnboardingProbe | null> | null = null;

function load(): Promise<OnboardingProbe | null> {
  if (cached && Date.now() - fetchedAt < TTL_MS) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/onboarding/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: OnboardingProbe | null) => {
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

export function clearOnboardingStatusCache(): void {
  cached = null;
  fetchedAt = 0;
}

// Returns null until loaded (same contract as useAdminContext/
// useCommunityAccess, so Sidebar renders nothing extra during the probe).
export function useOnboardingStatus(): OnboardingProbe | null {
  const [ctx, setCtx] = useState<OnboardingProbe | null>(cached);
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
