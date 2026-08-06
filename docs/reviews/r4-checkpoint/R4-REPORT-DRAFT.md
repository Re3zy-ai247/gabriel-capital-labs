## R4 · Gateway G Institutional Prologue (Founder round 4, 2026-08-06)

**Mission:** make arriving at Gabriel Capital Labs feel like the opening sequence of a major
institution — entering, not loading. Six phases, ~12–16s first visit, replayable, skippable,
reduced-motion identical narrative, mobile untouched, prologue seamlessly *becoming* the site.

### R4.1 What was built

A ~15.1s six-phase prologue that extends the existing arrival timeline (one-timeline
architecture — the prologue IS the arrival intro, so P6 is a hand-off inside the same DOM, never
intro→website):

| Phase | Window | Treatment |
|---|---|---|
| P1 Darkness | 0.0–2.6s | Pure obsidian (measured: brightest pixel RGB(8,8,8) = the background). A new atmosphere layer breathes the void to barely-visible. Scroll locked pre-paint; no UI; Esc armed from t=0 |
| P2 Gold signal | 2.6–5.2s | A 1px gold hairline draws outward from centre at the mark's future base — almost invisible, purposeful. Skip affordance appears ~3.1s, resting below the signal's luminance |
| P3 The G revealed | 5.2–8.4s | Light, never redraw: the glow rises, the monolith emerges by the approved wrap grammar, the hairline dissolves into the glow that replaces it. Zero filters on the mark or any ancestor |
| P4 Hold | 8.4–10.7s | ~2.9–3.2s of genuine stillness. The G exists alone in risen light |
| P5 The words | →13.5s | "Gabriel Capital Labs", then the Founder line — "Building the Infrastructure for Intelligent Capital." Sequential, after the symbol |
| P6 Awakening | →15.1s | Scroll releases, nav fades in, the atmosphere begins its slow breathe, the R3 cinematic architecture arms. Institution → institution |

Reduced motion receives the identical narrative — every beat is opacity/luminance; the two
spatial touches (signal draw, wrap settle) strip through the R3 channel policy. Mobile (<1024px)
never runs the prologue.

**Session logic:** first visit → full prologue · same-session return → the existing short
arrival, untouched · deep-link/hash → full bypass, lands 84px on target · Replay → the true
sequence, scroll-locked like a first visit · below 1024px → unreachable.

**Safety architecture:** the pre-paint scroll lock carries two independent dead-man switches
(pure-CSS overflow keyframe + inline timeout, 22s) so a failed or slow bundle can never trap a
visitor; the lock only ever applies on `/`; prologue-active has a single source of truth (the
html class), so the watchdogs, inert containment and scene gating can never disagree; a mid-
prologue viewport crossing aborts to the composed page in <100ms with zero desktop residue.

**Mission (Founder-preferred option):** the pin extends 150%→210% (reduce 90%→126%) restoring
the approved 60%-per-unit beat density with the held resolved frame retained — gate-measured at
the exact approved fractions.

**Sound:** `docs/design/GCL-SOUND-ARCHITECTURE.md` — design only. Per-phase cue map, Web Audio
graph, muted by default, gesture-unlocked, reduced-motion policy. No implementation, no autoplay.

### R4.2 Measured results

- **LCP 252–352ms** on first-visit desktop — *better* than the R3 control (1248–1272ms): the mark
  is the LCP element from first paint at an imperceptible floor (P1 pixel-compares as pure black).
- axe: **0 violations** at 2s/6s/16s, both policies.
- Gateway G: zero filter/blend/dim across the mark's full ancestor chain, sampled through the
  entire sequence (38+ instants) — light reveals it; nothing touches it.
- Keyboard/AT: Tab during the prologue reaches only the skip control; focus is never trapped
  after awaken; the sequence announces start and completion via `role=status`; Esc skips at any
  moment from any phase.
- Total wall ~15.1s (inside the 12–16s window); watchdog margin restored (22s).

### R4.3 Verdict trail

| Round | Outcome |
|---|---|
| Architecture + implementation | 6-phase contract; two implementers, disjoint files |
| Verification | Honest: caught 2 undisclosed bugs (mid-prologue crossing strand; wrong mobile-delta claim) |
| Gate round 1 (dual, max effort) | Craft: **exceedsR3 TRUE**, quality bar met. Regression: STOP on 2 engineering blockers (hydration-failure lock trap; crossing strand) |
| R4.1 remediation | All 16 findings fixed; gates re-ran: blockers dead, but replay-coherence regression caught (inert on a scrollable replay) + 3 narrow items |
| R4.2 final polish | Six root-cause rulings (replay locks like first visit; single source of truth for prologue-active; crossing residue zero; tagline consistency; skip hierarchy; overrun disclosure) |
| Confirmation gate | «GATE_VERDICT» |

### R4.4 Founder-confirm items

1. **The tagline** — your line "Building the Infrastructure for Intelligent Capital." is now the
   single arrival tagline (replacing the two-line pair) for prologue→site continuity, on all
   devices. The SEO `<title>`/meta strings still carry the old line (SEO untouched by order) —
   reconcile when ready.
2. **Chrome withholding** — first visits see no navigation until P6 (~13s), per the mission. This
   supersedes R3's immediate-nav behaviour on first visit only; mitigations: skip visible ~3s,
   Esc always, hash bypass, same-session returns unaffected.
3. **Replay locks the page** like a first visit for sequence fidelity (Esc/skip exit instantly).

### R4.5 Disclosures

«GATE_DISCLOSURES»

### R4.6 Files changed

`components/ArrivalScene.tsx` (prologue + replay + session logic) · `app/globals.css` (prologue
layers, watchdog keyframe, awake breathe, tagline wrap) · `app/layout.tsx` (pre-paint lock +
dead-man switches) · `content/site.ts` (tagline ruling) · `components/MissionSection.tsx` (pin
210%/126%) · `docs/design/GCL-SOUND-ARCHITECTURE.md` (new, design-only).

### R4.7 Founder review checklist

1. Fresh tab, desktop: darkness → gold signal → the G revealed by light → hold → the words →
   the institution awakens. ~15s. It should feel like entering, not loading.
2. Press Esc (or the skip control) mid-sequence — instant composed arrival, everything
   interactive.
3. Replay Arrival — the full sequence again, from anywhere, repeatedly.
4. Open `…/#contact` directly — no prologue, lands on Engagement.
5. Reload (same tab) — the short returning-visitor arrival, unchanged from R3.
6. Scroll through Mission — the pillars now hold at your approved pacing with the resolved frame.
7. Mobile — unchanged except the tagline line itself.
