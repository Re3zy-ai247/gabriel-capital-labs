"use client";

import { useEffect, useId, useState } from "react";
import { cinematicPreference, setCinematicPreference, type CinematicPreference } from "@/lib/cxos/capability";

// CXOS Phase 3 — the user-facing cinematic control (navigation law 5: "users
// may disable cinematic transitions").
//
// RC1 / Founder Decision D-6 (2026-08-23) rebuilt what this control MEANS.
// Before: cinematic was the default and this was the (unreachable — finding
// C-01) opt-out. Now: task-first is the default for everyone and this is where
// a visitor chooses something else.
//
// ── THREE STATES, THREE CHOICES (S11 E-3) ────────────────────────────────────
// The stored preference has always had three meanings, and an earlier revision
// rendered them through a two-state button: "absent" displayed as "off", and
// pressing on→off moved the visitor from the tier A/B landing choreography all
// the way to tier D while the control claimed it had already been off. Worse,
// "absent" was a one-way door — once touched, there was no way back to the RC1
// default. The control is a three-way select now, so what it shows is what the
// model holds:
//
//   Default (task-first)  no key. No entrance; the non-blocking tier ladder
//                         still applies. This is the RC1 default and it is
//                         reachable again.
//   On                    "on": play the cinematic entrance on the landing.
//   Off                   "off": no cinematic motion at all — tier D
//                         everywhere, the meaning this key has always carried.
//
// prefers-reduced-motion needs no control — it is tier D absolutely, before
// this preference is even read, and choosing "On" never overrides it.
//
// ── WHY ONLY "OFF" APPLIES LIVE (review H-1) ─────────────────────────────────
// An earlier revision stamped `data-cxjourney` with the freshly detected tier
// so the choice would apply live in both directions (C-11, a P3 nicety). That
// is a content-hiding bug, and correctness beats liveness:
//
//   The stamp only SELECTS the tier-A/B choreography rules. What DRIVES them is
//   `--cxp`, and only JourneyRuntime writes it — from an effect whose
//   dependency array is [active], where `active` comes from state set once at
//   mount. A visitor arriving with "off" persisted gets tier D, so that effect
//   returned early: no listeners, no observer, and `--cxp` left at its declared
//   default of 0. Stamping the tier from HERE made those rules match at
//   --cxp: 0 — the START of the choreography, not its rest state. The three
//   classification chips in IntelligenceAwakens ("Cross-bureau mismatch",
//   "Potential inaccuracy", "Unverifiable") computed to opacity 0, the evidence
//   spine stayed undrawn, and the alignment chapter froze mis-aligned, until a
//   full page load.
//
// So this component NEVER stamps. `data-cxjourney` has exactly one writer,
// JourneyRuntime, which owns both the stamp and its listeners and can never set
// one without the other. Choosing "Off" still applies live because REMOVING the
// attribute can only fall content back to its rest state — it cannot strand
// anything. Every other choice takes effect on the next load, and says so out
// loud rather than leaving the visitor to guess.
const OPTIONS: { value: CinematicPreference; label: string }[] = [
  { value: "default", label: "Default (task-first)" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

export function CinematicToggle({ className = "", label = "Cinematic entrance" }: { className?: string; label?: string }) {
  const [pref, setPref] = useState<CinematicPreference>("default");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const id = useId();

  useEffect(() => {
    setPref(cinematicPreference());
    setReady(true);
  }, []);

  // Server render and first paint agree (nothing), so no hydration mismatch.
  if (!ready) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <label htmlFor={id}>{label}:</label>
      <select
        id={id}
        value={pref}
        // Static, so this control never needs to read the motion preference in
        // order to describe it — and so it can never be mistaken for a way to
        // override one (review L-5).
        title="Reduced-motion settings always take priority over this choice."
        onChange={(e) => {
          const next = e.target.value as CinematicPreference;
          setPref(next);
          setCinematicPreference(next);
          // "Off" applies immediately and safely: removing the stamp can only
          // return content to its rest state. Nothing else touches the DOM —
          // motion cannot be turned back ON without a fresh load (see above),
          // so the honest thing is to say so.
          if (next === "off") {
            document.documentElement.removeAttribute("data-cxjourney");
            setPending(false);
          } else {
            setPending(true);
          }
        }}
        className="rounded border border-ink-700/70 bg-transparent px-1.5 py-0.5 text-inherit transition hover:text-slate-300"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-900 text-slate-200">{o.label}</option>
        ))}
      </select>
      {pending && (
        <span role="status" className="whitespace-nowrap text-[11px] text-slate-500">
          Applies on your next visit
        </span>
      )}
    </span>
  );
}
