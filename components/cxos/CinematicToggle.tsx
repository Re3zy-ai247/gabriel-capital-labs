"use client";

import { useEffect, useState } from "react";
import { CINEMATIC_PREF_KEY, cinematicEntranceOptIn, detectTier } from "@/lib/cxos/capability";

// CXOS Phase 3 — the user-facing cinematic control (navigation law 5: "users
// may disable cinematic transitions").
//
// RC1 / Founder Decision D-6 (2026-08-23) rebuilt what this control MEANS.
// Before: cinematic was the default and this was the (unreachable — finding
// C-01) opt-out. Now: task-first is the default for everyone and this is the
// opt-IN. The two persisted values are the visitor's own explicit choice:
//
//   pressed on  → "on":  play the cinematic entrance on the landing.
//   pressed off → "off": no cinematic motion at all (tier D everywhere) —
//                        the same meaning this key has always carried.
//
// An untouched control (no key) is the RC1 default: no entrance, and the
// non-blocking tier ladder still applies. prefers-reduced-motion needs no
// toggle — it is tier D absolutely, before this preference is even read, and
// it is never overridden by pressing "on".
//
// C-11: the choice applies LIVE in both directions. The journey runtime reads
// the tier once at mount, so this restamps `data-cxjourney` itself rather than
// leaving the visitor to guess that a reload is required.
export function CinematicToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOn(cinematicEntranceOptIn());
    setReady(true);
  }, []);

  // Server render and first paint agree (nothing), so no hydration mismatch.
  if (!ready) return null;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        try {
          localStorage.setItem(CINEMATIC_PREF_KEY, next ? "on" : "off");
        } catch {
          /* storage unavailable — the session keeps the in-memory choice */
        }
        // Reflect the choice on this page immediately, in BOTH directions.
        // detectTier() re-reads the value just written, so "on" restamps the
        // real tier (which may still be D under reduced motion — the opt-in
        // never overrides that) and "off" clears the stamp.
        if (next) document.documentElement.setAttribute("data-cxjourney", detectTier());
        else document.documentElement.removeAttribute("data-cxjourney");
      }}
      className={`transition hover:text-slate-300 ${className}`}
    >
      Cinematic entrance: {on ? "on" : "off"}
    </button>
  );
}
