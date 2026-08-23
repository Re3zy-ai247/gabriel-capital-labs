"use client";

import { useEffect, useState } from "react";
import { CINEMATIC_PREF_KEY, cinematicEntranceOptIn } from "@/lib/cxos/capability";

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
// pressing "on" never overrides it.
//
// ── WHY THE "ON" DIRECTION DOES NOT APPLY LIVE (review H-1) ──────────────────
// An earlier revision of this file stamped `data-cxjourney` with the freshly
// detected tier so the choice would "apply live" in both directions (C-11, a
// P3 nicety). That is a content-hiding bug, and correctness beats liveness:
//
//   The stamp only selects the tier-A/B choreography rules. What DRIVES them
//   is `--cxp`, and only JourneyRuntime writes it — from an effect whose
//   dependency array is [active], where `active` comes from state set once at
//   mount. A visitor arriving with "off" persisted gets tier D, so that effect
//   returned early: no listeners, no observer, and `--cxp` left at its
//   declared default of 0. Stamping the tier from HERE made those rules match
//   at --cxp: 0 — which is the START of the choreography, not its rest state.
//   The three classification chips in IntelligenceAwakens ("Cross-bureau
//   mismatch", "Potential inaccuracy", "Unverifiable") computed to opacity 0,
//   the evidence spine stayed undrawn, and the alignment chapter froze
//   mis-aligned, until a full page load.
//
// So this component now NEVER stamps. `data-cxjourney` has exactly one writer,
// JourneyRuntime, which owns both the stamp and its listeners and can never
// set one without the other. The "off" direction still applies live because
// REMOVING the attribute can only ever fall content back to its rest state —
// it cannot strand anything. The "on" direction takes effect on the next load,
// and says so out loud rather than leaving the visitor to guess.
export function CinematicToggle({ className = "", label = "Cinematic entrance" }: { className?: string; label?: string }) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setOn(cinematicEntranceOptIn());
    setReady(true);
  }, []);

  // Server render and first paint agree (nothing), so no hydration mismatch.
  if (!ready) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-pressed={on}
        // Static, so this control never needs to read the motion preference in
        // order to describe it — and so it can never be mistaken for a way to
        // override one (review L-5).
        title="Reduced-motion settings always take priority over this choice."
        onClick={() => {
          const next = !on;
          setOn(next);
          try {
            localStorage.setItem(CINEMATIC_PREF_KEY, next ? "on" : "off");
          } catch {
            /* storage unavailable — the session keeps the in-memory choice */
          }
          // OFF applies immediately and safely: removing the stamp can only
          // return content to its rest state. ON is deferred to the next load
          // (see the note above) and disclosed below.
          if (next) {
            setPending(true);
          } else {
            document.documentElement.removeAttribute("data-cxjourney");
            setPending(false);
          }
        }}
        className={`transition hover:text-slate-300 ${className}`}
      >
        {label}: {on ? "on" : "off"}
      </button>
      {pending && (
        <span role="status" className="whitespace-nowrap text-[11px] text-slate-500">
          Plays on your next visit
        </span>
      )}
    </span>
  );
}
