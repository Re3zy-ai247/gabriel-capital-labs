# CXOS Phase 5.2 — Architectural Cinematics

**Gabriel Capital Labs · CreditVector™ Experience OS**
Date 2026-07-30 · Branch `feat/cxos-phase3` · Implementation commit `e7d2152` (parent `324c0f6`, Phase 5.1) · Production truth `f449c35` on `main` — **untouched**.
Refinement only: no new product feature, no production touch, no authentication change, no database logic, no Arena ownership change, no XP, no architecture redesign. The existing route, state machine, timeline, scene grammar and guards were reused; every change is surgical.

## 1. Executive summary

Phase 5.1 built a journey between two rooms. The Founder's verdict was that it still read as navigating between web pages rather than moving through one facility — and that a responsive animation defect made words unreadable on phones.

Phase 5.2 does two things. It **closes the release blocker with measurement**, and it **converts the transition into architecture**: the origin room now visibly powers down when the Arena is called, its floor separates and an aperture forms on the command axis, a small gold light appears late and far beyond it, the Arena's warmth and suspended motes bleed back up the hallway before the chamber is seen, the threshold reveals a colonnade receding into the dark, and the room then **reads the operator's record aloud** — clearance, standing, evidence, lifetime record — on the settled floor where nothing is rushed. The chamber itself is alive: a breathing standing core, rings turning once per four minutes, drifting motes, slow shafts, haze, a soft floor reflection — for **zero JavaScript**, because every one of them is compositor-only CSS.

The blocker: reproduced at **11 text-collision frames per width across all five mandated widths** (not only mobile) plus overflow at 320 px, root-caused to three captions sharing one absolute point with overlapping visibility windows, and fixed structurally rather than by retiming. Re-measured: **59 defect frames → 0**.

Validation: `cxos-passage` **83/83** with **33 mutations all RED** (two guards were caught *vacuous* mid-pass and closed), responsive probe **0 defects at 320/360/390/430/tablet**, journey battery **48/48**, suite **85/85**, both builds green, production-flagged build still inert with zero fixture bytes, `/arena` still 307-dormant, landing **99.1 kB unchanged**.

## 2. The release blocker — evidence, cause, fix, proof

**Evidence (before).** A probe walks the whole journey at 150 ms intervals at each mandated width and records every perceptible text box (opacity > 0.08), any pairwise intersection, any horizontal overflow, and the smallest rendered font size:

| Width | Collision frames | Overflow frames |
|---|---|---|
| 320 | 11 | 4 |
| 360 | 11 | 0 |
| 390 | 11 | 0 |
| 430 | 11 | 0 |
| tablet 768 | 11 | 0 |

Sample collision at 320 px: `"Clearance confirmed."` and `"Record located."` intersecting by **190 × 20 px at full opacity on both**. Captured frames are in the gallery — the words render straight through each other exactly as reported.

**Cause.** Not timing. Three clearance stencils were absolutely positioned at the *same* point (`left: 50%; top: 44%`) while their visibility windows overlapped by design error — stencil 1 faded out at 19 % of the timeline while stencil 2 was already appearing at 14 %. On top of that, `white-space: nowrap` with fixed `15px` type and `0.35em` tracking cannot fit "NO EVIDENCE ON RECORD." into 320 px. The condensed mobile windows I had added in 5.1 made the overlap wider, not narrower.

**Fix — removing the possibility, not the symptom.**
1. **Exactly one in-world stencil exists.** A stack cannot collide. Guard-pinned by count.
2. **Fluid type everywhere in flight** — `clamp()` font-size *and* letter-spacing on the stencil, the welcome line and the engraved wordmark.
3. **It wraps** (`text-wrap: balance` + `overflow-wrap: break-word`), and `white-space: nowrap` is banned by guard.
4. **The scaled frame fits too** — the box is `80vw` and the exit scale was reduced 1.22 → 1.14, so even the transformed frame stays inside 320 px. (The final 3 px clip was found by measurement, not assumed.)
5. **Everything the ceremony said mid-flight moved to arrival, in normal flow** — the arrival register is a flex column, so overlap is structurally impossible at any width.
6. **The mobile run was slowed**, 8.2 s → **10.6 s** (still shorter than desktop and still under the ratified 12 s first-entry ceiling), with the readable beats given the most room.

**Proof (after).** Same probe, same widths: **0 collisions, 0 overflow frames, at 320 / 360 / 390 / 430 / 768.** The probe now ships as `p52_typo_probe.py` so the blocker can never silently return.

## 3. The transition, beat by beat

Desktop 11.8 s (the envelope is unchanged — the beats were redistributed, not lengthened); mobile 10.6 s on a single plane.

| Beat | Window | What the operator experiences |
|---|---|---|
| **THE CALL** | 0 – 1.0 s | The room *pauses*. Instrument light recedes, panels dim to 0.28, the command axis contracts to a point, the aperture ring stops pulsing and holds. Seen through the still-transparent veil, so Mission Control is watched acknowledging the call before anything moves |
| **CLEARANCE** | 1.0 – 3.4 s | The camera is already moving. One line — "CLEARANCE CONFIRMED." — passes the lens as an object in the world. The floor separates along the axis; a circular aperture forms |
| **THE PASSAGE** | 3.4 – 5.8 s | Wall planes retract past the camera; the rails converge. Far beyond the aperture a small gold light appears — **late and tiny**, the first evidence that something ahead is enormous |
| **CONVERSION** | 5.8 – 8.0 s | Rectilinear blue bends into concentric gold arcs; the haze warms. The Arena's light shafts and suspended motes begin bleeding back up the hallway |
| **THE THRESHOLD** | 8.0 – 10.4 s | The chamber opens full-frame: establishing ring, engraved wordmark, and a **colonnade of perimeter piers receding into the dark**. Silence and scale — no text but the SYNTHETIC tab |
| **THE WELCOME** | 10.4 – 11.8 s | One line: "Welcome to the Arena, Jordan." |
| **THE RECOGNITION** | on the settled floor | The room reads the record, one line every 700 ms over ~3.8 s. Unhurried, because nothing here is forced |

**The recognition register** (each line bound to the record, never to a constant):

```
CLEARANCE          Verified
STANDING           Operator · Level 6
EVIDENCE           5 Accepted
LIFETIME RECORD    820 XP Loaded
KAI                the floor is ready
```

A failed read is told the truth instead: `STANDING fail-safe · EVIDENCE unavailable · LIFETIME RECORD unavailable`. The same words are spoken to assistive technology from a single source (`registerSpeech`), so a screen-reader listener and a sighted visitor receive the identical recognition.

## 4. The chamber is alive — for zero JavaScript

| Element | Motion | Period |
|---|---|---|
| Standing core (establishing ring + dais) | breathing scale 1 → 1.018 | 9 s |
| Gold rings | rotation, opposed directions | 240 s · 420 s |
| Ambient motes | drift | 90 s |
| Light shafts | opacity breathing | 16 s |
| Haze · floor reflection | static atmosphere | — |

Every ambient keyframe body is extracted and tested by the guard: atmosphere may animate **transform and opacity only**. Nothing conveys data — the standing ring's *sweep* is the data, its rotation is not — and each element carries a ledger row. Under reduced motion all of it stops; the room stays monumental and simply does not move.

**This deliberately amends a Phase 5.1 law.** The old battery asserted *zero* running animations on the settled floor. The Founder asked for a living chamber, so that check was wrong in spirit: the real requirement is that **no JavaScript frame loop runs while settled**. That is now measured directly by instrumenting `requestAnimationFrame` for 1.2 s on the settled floor (result: ≤ 2 calls) while separately asserting the ambient animations exist and touch only compositor properties. The amendment is recorded here rather than made quietly.

## 5. Scroll as physical movement

The stations carry an 1100 px `perspective`, and each approaches through real depth — tier A translates up to 190 px in Z as it comes toward the lens and settles as it passes; tier B walks on a single plane with scale instead of a 3D stack. Native scroll remains authoritative: no hijack, no lock, no `preventDefault`. Tier C/D and no-JS keep the natural-height document with plain links.

## 6. What was deliberately not done

- **No audio.** The mandate describes ambient room audio fading out. House law and WCAG forbid autoplay sound, and Phase 2's guard pins sound to a user gesture. The silence is rendered visually (the power-down) instead. Adding audio would need an explicit opt-in control and a separate review.
- **No WebGL.** "Reuse the existing scene graph" and the token constitution both point the same way; the CSS-3D world remains one implementation that is simultaneously the experience, the no-WebGL projection, the no-JS document and the reduced-motion page.
- **The forced journey was not lengthened.** The ratified first-entry ceiling is 7–12 s and it is numerically guard-pinned. Slowness was bought by *redistributing* beats and by moving the ceremony onto the settled floor, where the mandate's "first thirty seconds inside the Arena" actually live and nothing is on a timer.
- **Text was reduced in flight, not overall.** Three mid-flight captions became one; the recognition it displaced now happens where it can be read.

## 7. Validation

**Guard `scripts/cxos-passage.test.ts`: 83/83.** New laws pinned: one-stencil-only; fluid + wrapping type with the scaled frame fitting; flow-layout register with a ≥ 600 ms stagger; the mobile run ≥ 10 s; the power-down; the late gold light; the hallway bleed; the colonnade; both breathing bodies and both ring rotations; ambient keyframe bodies compositor-only; ambient periods genuinely slow; per-tier camera depth; all 25 ledger rows.

**Mutations: 33/33 RED**, every restore byte-identical. The Phase 5.2 additions: the caption stack returns · type made fixed-size · wrapping removed · register stagger collapsed · mobile sped back up · power-down disabled · gold light made immediate · chamber stops breathing · ambient motion made fast · an ambient keyframe animates layout · scroll depth removed · a ledger row omitted.

**Two guards were caught vacuous during this pass and are recorded, not hidden:** the `nowrap` ban used a fixed 420-character window that never reached the mutated line (now the whole rule body is extracted, and wrapping is required *positively*), and the "chamber is alive" check passed a presence test while one of two breathing bodies had been stripped (now both are counted, with exact class-token matching because `cx-p-live-ring-slow` contains the shorter name). Both mutations were re-run and are now RED.

**Responsive probe: 0 defect frames** at 320 / 360 / 390 / 430 / tablet.
**Journey battery: 48/48** — including the power-down measured as a real opacity drop, the register verified as strictly increasing row geometry (flow-stacked, never overlapping), the no-rAF proof, the ambient-property proof, and reduced motion confirmed completely still.
**Suite 85/85 · typecheck 0 · review and production builds green · production-flagged build:** route inert with zero fixture bytes, `/arena` 307-dormant. **Landing 99.1 kB — unchanged.**

## 8. Rollback

Single commit `e7d2152`, additive and presentational. Reverting it restores Phase 5.1 exactly; no migration, dependency, env var, flag or schema is involved. Production never contained any of it.

## 9. Honest limitations

1. **The colonnade and motes are gradient geometry, not modelled objects.** They read convincingly in motion and at rest; a modelled monument would need the WebGL path this phase deliberately declined.
2. **Ambient rotation is genuinely near-invisible** (240 s / 420 s). That is the intent — "nothing should feel random" — but on a short recording it can read as static. The director scrubber is the way to inspect it.
3. **The register's five lines are the one place text grew.** It replaced three mid-flight captions, so net forced reading fell; if the Founder wants it shorter, lines 3 and 4 are the candidates.
4. **Tier B drops the 3D wall stack, the floor grid and the floor split** by budget choice. The mobile recording shows exactly what ships.
5. **No audio, by law** (§6).

## 10. Founder decision block

- [ ] Approve the mobile typography fix
- [ ] Approve responsive pacing (320 · 360 · 390 · 430 · tablet)
- [ ] Approve the Mission Control power-down
- [ ] Approve the departure architecture (floor separation · aperture)
- [ ] Approve the distant-light anticipation
- [ ] Approve the hallway atmosphere
- [ ] Approve the monumental threshold
- [ ] Approve the arrival recognition ceremony
- [ ] Approve the living chamber
- [ ] Approve scroll-as-movement
- [ ] Approve the amended aliveness law (no JS frame loop, ambient CSS permitted)
- [ ] Approve Phase 5.2
- [ ] Request changes
- [ ] Reject

Silence is not treated as approval. Work stops here pending these decisions.
