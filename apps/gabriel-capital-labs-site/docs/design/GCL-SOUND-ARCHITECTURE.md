# GCL Sound Architecture — R4 Design Document

**Status: DESIGN ONLY.** This document specifies the sound design contract for
the Gateway G Institutional Prologue (`components/ArrivalScene.tsx`). It ships
**zero code, zero audio assets, zero autoplay, and nothing wired into the
build.** Every claim below is a *contract a future implementation must
satisfy*, not a description of anything currently running. See "Scope fence"
at the end for exactly what is and is not authorized by this document.

Cue windows are keyed to the R4 beat table's wall-clock phases (full-motion
timing; the reduced-motion policy runs the identical windows — see
"Reduced motion & visibility policy" below).

---

## 1. Per-phase cue map

The guiding principle, matching the Founder's brief for the visual prologue:
**weight, mass, precision, inertia, silence, anticipation, architecture.**
Sound is a second, independently-legible channel carrying the same six-phase
narrative — never a decoration bolted onto the visuals, and never a cue whose
absence would make a phase feel unfinished (every cue is additive; muted
playback, the default state, must read as a complete institutional prologue
on the strength of the visuals alone).

Forbidden vocabulary, mirroring the visual FORBIDDEN list: risers, whooshes,
impacts with pitched "whoomph" designed for trailers, synth pads that read as
sci-fi UI, any element resembling a notification/success chime, reverb tails
long enough to read as a cathedral rather than a room, and anything
loop-jarring (an audible seam at a loop point breaks "precision").

| Phase | Window | Cue | Character |
|---|---|---|---|
| **P1 — Darkness** | 0.0s–2.6s | Room tone only. A near-silent, textured low-level bed, not a flat digital silence (true digital silence reads as "broken audio," not "anticipation"). | −60 dBFS integrated bed; no discernible pitch center; the instrument here *is* the silence — the bed exists only so silence has a floor to be measured against. |
| **P2 — Gold signal** | 2.6s–5.2s | A single restrained low-mid swell enters in lockstep with the signal hairline's draw. | Duration 2.2s, matching the visual `power2.inOut` draw exactly (same start time 2.2 units into the desktop timeline, same easing shape mapped to gain). No transient attack — the swell has no audible "start," it is simply present a moment after it wasn't. |
| **P3 — Gateway G revealed** | 5.2s–8.4s | Sub-weight bloom under the glow's rise, with a thin layer of "air" (high-frequency shimmer, extremely low level) as the mark settles. | No risers, no whooshes — this is mass arriving, not motion arriving. The bloom's envelope tracks the glow tween's opacity curve (2.4s, `power2.inOut`) so the two are locked, not merely synchronized by wall-clock coincidence. |
| **P4 — Hold** | 8.4s–10.0s | Silence, held. The mix ducks the P3 bloom's tail down to room-tone level over the phase's first ~400ms and stays there. | The Founder named silence as a material in its own right for this phase; the audio design treats P4 as literally the loudest possible statement made by having nothing to say. No cue is added here under any circumstance — a phase that is "held" visually cannot be "filled" sonically without contradicting the visual grammar it exists to support. |
| **P5 — The words** | 10.0s–12.8s | Two soft felt-mallet-style impacts, one per wordmark line, plus a lower third (a brief, quiet sustained tone, not a chime) under the tagline. | Impacts at the same "at" as `wordTopRef`/`wordBottomRef` (9.6/10.4 timeline-relative), tagline tone at `tagline1Ref`'s "at" (11.3). "Felt-mallet" specifically to avoid anything that reads as a UI notification — soft attack, fast but not percussive decay, no ring/resonance long enough to overlap the next impact. |
| **P6 — The institution awakens** | 12.8s–14.4s | The bed resolves into a slow breathing loop (matching `gcl-atmosphere-breathe`'s 9s ease-in-out alternate) and hands off into site ambience at −12 dB under everything else. | This is the only cue with a life beyond the prologue itself — it is the seed of an ambient bed that could (a future decision, not this document's to make) continue quietly under the composed site. The handoff must be level-matched so there is no audible jump at the exact moment `awaken()` fires. |

Two structural rules apply across every row above:

1. **Cue timing is derived from the same "at" values the visual beat table
   already uses**, never a second, independently-authored timeline. A future
   implementation should read cue offsets directly off the GSAP timeline's
   own label/position values (see §2.4) so the two channels cannot drift
   apart the way two hand-authored timelines eventually would.
2. **No cue is louder, longer, or more eventful than its visual counterpart.**
   Sound follows the visual grammar's restraint (no bounce/elastic/overshoot
   equivalent in audio — no pitch-bend flourishes, no percussive accents that
   would read as "arcade").

---

## 2. Web Audio architecture

### 2.1 Context lifecycle

- **One `AudioContext`, created in the `suspended` state** at module load (or
  lazily on first user interaction — whichever is cheaper; the state is
  `suspended` either way until explicitly resumed, see 2.2). Never call
  `.resume()` automatically on mount, on scroll, on the prologue starting, or
  on any programmatic event — only a direct user gesture on the sound
  affordance may resume it.
- The context is **destroyed and recreated, not merely suspended, across a
  full page reload** — no persistence of AudioContext state across
  navigations is implied or required.

### 2.2 Muted by default; explicit-gesture unlock only

- **Sound starts OFF for every visitor, every time**, independent of the
  `gcl-arrival-seen` session flag that governs the *visual* prologue's
  seen-path. Sound preference is not implied by "have they seen the
  prologue before" — those are orthogonal facts.
- A visible, labeled **"Sound" affordance** (a toggle, not a hidden gesture)
  is the *only* control that may call `AudioContext.resume()` and begin
  scheduling cues. It lives adjacent to the existing skip chip so it shares
  that element's a11y treatment (focusable, visible by the same ~3.0s
  window P2 reveals the skip chip, announced via the existing `role=status`
  region: e.g. "Sound available — press S to enable" or an equivalent visible
  label, never audio-only discovery).
- **No autoplay under any browser policy path.** This is not a workaround for
  Chrome's autoplay-gating — it is the actual design requirement,
  independent of what any browser would technically allow. A user who never
  touches the Sound affordance gets total silence for the entire session,
  every visit, forever.
- If the user enables sound on one visit, that preference **may** persist
  (e.g. via the same `sessionStorage` mechanism `gcl-arrival-seen` already
  uses) for the remainder of that session only — never across sessions
  without a fresh gesture, and this persistence choice is itself a future
  implementation's decision to confirm with the Founder, not something this
  document mandates.

### 2.3 Gain graph

```
AudioContext (suspended by default)
  └─ masterGain (GainNode)          — 0 → target on unlock, 150ms power-curve ramp;
     │                                 target → 0, 120ms ramp on skip/Esc/visibilitychange
     ├─ cueGain[P1 bed]     (GainNode) → destination
     ├─ cueGain[P2 swell]   (GainNode) → destination
     ├─ cueGain[P3 bloom]   (GainNode) → destination
     ├─ cueGain[P5 impact1] (GainNode) → destination
     ├─ cueGain[P5 impact2] (GainNode) → destination
     ├─ cueGain[P5 tagline] (GainNode) → destination
     └─ cueGain[P6 breathe] (GainNode) → destination (survives past prologue end)
```

- **One `GainNode` per cue**, each ramped independently via
  `AudioParam.linearRampToValueAtTime` / `setTargetAtTime` — never a raw
  `.gain.value =` step assignment, which produces an audible click.
- All per-cue gains sum into a single **`masterGain`**, which is the one node
  every global mute/unlock/skip/duck operation touches. This makes "hard-stop
  everything" (skip, Esc, tab hidden) a single-node operation instead of a
  fan-out across every live cue.
- Ramp durations are deliberately short (120–150ms) — long enough to avoid a
  click, short enough that a skip feels immediate, matching the visual skip
  path's own near-instant `tl.progress(1, false)` jump.

### 2.4 Scheduling — locked to the visual timeline, not a second clock

- Cue start times are expressed as **offsets into the same GSAP timeline**
  the visual prologue already runs (the one-timeline architecture — see
  ArrivalScene's `introCtx`/`tl` in the accepted R4 contract). A future
  implementation should add `tl.call(...)` entries at the exact same
  position arguments already used for the corresponding visual tween (0,
  2.2, 4.8, 5.6, 9.6, 10.4, 11.3, 12.4 …), scheduling each cue via
  `AudioContext.currentTime + smallOffset` computed from GSAP's own elapsed
  time at the moment the call fires — **not** a hand-maintained parallel
  `setTimeout`/`requestAnimationFrame` schedule that could drift from the
  visual beats over a 14.4s run.
- Because `tl.progress(1, false)` (skip, seen-path replay-jump, hash-bypass)
  fires every intervening `tl.call` synchronously, the *same* scheduling
  calls that emit cues on a normal forward play will also fire on a jump —
  the sound layer's skip handling is therefore: **stop everything hard**
  (ramp `masterGain` to 0 over 120ms and cancel any scheduled-but-not-yet-
  started cue nodes) rather than let a skip fire 8 cues' worth of scheduling
  calls in one frame. This mirrors the visual skip contract (`awaken()`
  still runs; sound does not).

### 2.5 Visibility handling

- `document.addEventListener("visibilitychange", ...)`: on `hidden`,
  `masterGain` ramps to 0 over ~150ms and `AudioContext.suspend()` is called
  once the ramp completes. On `visible` again, **the context stays suspended
  and silent** — resuming audio on tab-refocus without a fresh gesture would
  violate the same "never auto-unlock" rule as autoplay. A visitor who
  enabled sound, backgrounded the tab, and returns must press the Sound
  affordance again (a small friction, deliberately: audio resuming
  unannounced when a backgrounded tab regains focus is a classic
  startle/UDAAP-adjacent-annoyance pattern this design explicitly avoids in
  spirit even though it isn't a compliance surface here).

### 2.6 Esc / Skip hard-stop

- The existing Esc/skip path (`handleSkip()` in ArrivalScene) gains one
  additional call in a future implementation: ramp `masterGain` to 0 over a
  **120ms** power-curve and cancel all pending cue schedules. This number is
  deliberately faster than the 150ms unlock ramp — stopping should never
  feel slower than starting.

---

## 3. Reduced-motion & visibility policy

- **`prefers-reduced-motion: reduce` does not mean `prefers-no-audio`** —
  these are different accessibility axes. However, the *loop-based* cues
  (P1's room-tone bed, P6's breathing loop) are exactly the kind of
  continuous, slowly-modulating stimulus that vestibular-motion-sensitive
  users are not necessarily bothered by, but users with certain auditory
  sensitivities (hyperacusis, some autism-spectrum sensory profiles) may be.
  Because this document cannot resolve that population overlap without
  Founder input, it flags the decision rather than silently picking one:
  - **Option A (default posture):** reduced-motion runs the identical cue
    map as full-motion — discrete cues only for P2/P3/P5, no change. This
    treats "reduced motion" and "reduced audio" as unrelated preferences,
    consistent with how the third motion class treats the *visual* channel
    (opacity/luminance-only, not "less content").
  - **Option B (conservative fallback):** reduced-motion suppresses the two
    loop/bed cues (P1 room tone, P6 breathing loop) entirely and keeps only
    the discrete, bounded cues (P2 swell, P3 bloom, P5 impacts/tone) — i.e.
    the sound channel gets its own "no ambient / no continuous" analogue to
    the visual channel's "no spatial motion."
  - **This document recommends Option A** (sound preference and motion
    preference are orthogonal; muted-by-default already protects every user
    who hasn't opted in) but explicitly marks the choice as a **Founder
    decision**, not something a future implementer should silently resolve
    either way.
- Regardless of which option is chosen, sound is **muted by default in both
  motion policies** — this section only governs what happens *after* a user
  has explicitly opted in via the Sound affordance.

---

## 4. Asset strategy

- **≤ 6 short audio files, ≤ 100KB total**, covering: P1 bed loop, P2 swell,
  P3 bloom, P5 impact ×2 (or one impact sample played twice, pitch-identical,
  if that reads as intentional rather than lazy — a future implementer's
  call), P6 breathing loop. The P5 lower-third tone may be synthesized at
  runtime via a simple oscillator + envelope rather than shipped as an asset
  at all, since it's a single sustained tone — this trims the asset count
  further and is the preferred approach if it sounds acceptable in testing.
- **Format: OGG (Vorbis) + AAC (M4A) pairs**, feature-detected at runtime
  (`audio.canPlayType(...)`), for broad browser coverage without a third
  format. No MP3 — patent concerns are moot today but OGG/AAC already covers
  every evergreen browser GCL needs to support.
- **Zero network cost for the silent majority**: assets are fetched lazily,
  only *after* the user presses the Sound affordance — never preloaded, never
  fetched speculatively "in case they enable it later." This keeps LCP/CLS
  and the R4 perf plan's numbers completely unaffected by the existence of
  this feature for every visitor who never opts in (which, muted-by-default,
  is expected to be nearly everyone).
- **Static-export friendly**: assets live under `/public/audio/`, served as
  plain static files — no server-side transcoding, no edge function, nothing
  that would be incompatible with the site's existing static-export
  pipeline (`next build` → `out/`).
- **No external CDNs.** Self-hosted only, consistent with the rest of the
  site's asset strategy and with not introducing a new third-party network
  dependency for a purely decorative feature.
- **Sprite vs. individual files:** a single concatenated sprite (one file,
  cues addressed by offset/duration) reduces request count from ~6 to 1 but
  complicates lazy-loading granularity (the whole sprite loads even if, say,
  only P2 and P3 will actually play before a skip) and complicates swapping
  or re-cutting one cue later without re-exporting the whole sprite.
  Individual files cost a few extra requests (trivial at this file count and
  size) but keep each cue independently replaceable and independently
  cacheable. **Recommendation: individual files** — the file count is small
  enough that the sprite's main advantage (fewer requests) doesn't outweigh
  its authoring friction, and cues are fetched post-gesture anyway so
  request count isn't a first-paint concern.

---

## 5. Explicit non-goals / scope fence

This document is **the contract a future R5 (or later) implements after
Founder sign-off on both the cue map and the two flagged decisions above (the
reduced-motion posture in §3, and the persistence-across-sessions question in
§2.2).** As of R4:

- **No audio files exist in this repository.** `/public/audio/` is not
  created by this document.
- **No `AudioContext`, `GainNode`, or any Web Audio API call exists in
  `components/ArrivalScene.tsx` or anywhere else in the codebase.** The
  scheduling design in §2.4 describes *where a future implementer should
  hook in*, not code that runs today.
- **No autoplay is implemented, proposed, or left as a "just this once"
  exception anywhere in this document.** Every path to sound starting
  requires an explicit user gesture on a visible, labeled control.
- **No changes to `tsc`/lint/build output are implied** — this is a markdown
  file with zero effect on the build graph.
- **No changes to any of Implementer A's files** — this document does not
  modify `ArrivalScene.tsx`, `globals.css`, `content/site.ts`, or
  `layout.tsx`; it only specifies, in prose, what a *later* change to those
  files (or new files) would need to satisfy.

A future implementation should treat this document as the acceptance
criteria for that work, not as a starting-point sketch to freely deviate
from without a corresponding update here.
