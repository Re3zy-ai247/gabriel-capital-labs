"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Briefcase, LogOut } from "lucide-react";
import { clearKaiPresenceCache } from "@/components/kai/KaiPresence";
import { clearOnboardingStatusCache } from "@/components/onboarding/useOnboardingStatus";

// Shown across the top of every page when an agency has a client workspace open,
// so it's always obvious whose file you're working in (and easy to step out).
export function AgencyBar() {
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agency/context")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setClient(d.client || null);
      })
      .catch(() => {});
    // T2 persistence-safety fix (T2-SPEC.md §1 item 3): this is a raw fetch
    // with no TTL cache (unlike useAdminContext/useCommunityAccess/
    // useOnboardingStatus) — it already re-fetches on every mount today
    // (AppShell remounts per page.tsx). Reacting to `pathname` under the new
    // persistent RoomsShell (mounted once) restores that exact per-
    // navigation cadence; there is no cache here to double-suppress against.
  }, [pathname]);

  if (!client) return null;

  async function exit() {
    // T2 persistence-safety fix (T2-SPEC.md §1 item 3, "fixes the
    // stale-banner break recon confirmed"): under the OLD per-page AppShell
    // mount, navigating to /agency after exiting remounted this whole
    // component, so the stale `client` from before the exit call could never
    // outlive the navigation. RoomsShell now keeps this component mounted
    // across that same navigation, so without this line the banner would
    // keep showing the just-exited client's name until the effect above's
    // fetch resolves. Clearing synchronously, before the async calls below,
    // makes the banner disappear the instant "Exit to agency" is clicked —
    // never a stale name surviving into the destination room's first paint.
    setClient(null);
    await fetch("/api/agency/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: null }),
    });
    // Stepping back to the agency's own subject — the same cache-bleed risk
    // as opening a client, in reverse (Phase 1A cache fix, SIM-REVIEW finding 4).
    clearKaiPresenceCache();
    clearOnboardingStatusCache();
    router.push("/agency");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gold-500/30 bg-gold-500/10 px-5 py-2 text-xs text-gold-200">
      <span className="flex items-center gap-2">
        <Briefcase className="h-3.5 w-3.5" />
        Working in <span className="font-semibold">{client.name}</span>&apos;s workspace
      </span>
      <button onClick={exit} className="flex items-center gap-1 font-semibold underline hover:text-gold-100">
        <LogOut className="h-3.5 w-3.5" /> Exit to agency
      </button>
    </div>
  );
}
