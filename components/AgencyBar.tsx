"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, LogOut } from "lucide-react";
import { clearKaiPresenceCache } from "@/components/kai/KaiPresence";
import { clearOnboardingStatusCache } from "@/components/onboarding/useOnboardingStatus";

// Shown across the top of every page when an agency has a client workspace open,
// so it's always obvious whose file you're working in (and easy to step out).
export function AgencyBar() {
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agency/context")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setClient(d.client || null);
      })
      .catch(() => {});
  }, []);

  if (!client) return null;

  async function exit() {
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
