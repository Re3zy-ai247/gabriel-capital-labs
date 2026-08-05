"use client";

import { useEffect, useState } from "react";
import { CINEMATIC_PREF_KEY, cinematicDisabled } from "@/lib/cxos/capability";

// CXOS Phase 3 — the user-facing cinematic control (navigation law 5: "users
// may disable cinematic transitions"). Lives in the site footer. Off ⇒ tier D
// everywhere: the journey runtime mounts nothing and the transition shell
// never intercepts. prefers-reduced-motion needs no toggle — it is tier D
// absolutely, before this preference is even read.
export function CinematicToggle() {
  const [off, setOff] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOff(cinematicDisabled());
    setReady(true);
  }, []);

  if (!ready) return null;
  return (
    <button
      type="button"
      aria-pressed={!off}
      onClick={() => {
        const next = !off;
        setOff(next);
        try {
          if (next) localStorage.setItem(CINEMATIC_PREF_KEY, "off");
          else localStorage.removeItem(CINEMATIC_PREF_KEY);
        } catch {
          /* storage unavailable — the session keeps the in-memory choice */
        }
        // The journey runtime reads the tier at mount; reflect the choice now.
        if (next) document.documentElement.removeAttribute("data-cxjourney");
      }}
      className="transition hover:text-slate-300"
    >
      Cinematic effects: {off ? "off" : "on"}
    </button>
  );
}
