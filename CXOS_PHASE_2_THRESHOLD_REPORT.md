# CXOS Phase 2 — The Threshold Experience

**Architecture + implementation report · 2026-07-29 · branch `feat/cxos-threshold` · commit `aedf148`**
**Status: WORKING PROTOTYPE, verified on the production build. Not merged, not deployed.**

> On first visit, creditvector.app is no longer *loaded* — it is **entered**. Darkness. A particle
> field with real depth. A distant light. The architecture assembles. The parent name is carved
> into the environment. CreditVector materializes. The corridor opens — and the Hero is
> **discovered**, not loaded. Ten seconds, skippable in one keystroke, once per session, silent by
> default — and the plain landing remains fully intact beneath for crawlers, no-JS, reduced-motion
> and every returning visitor.

---

## 1. Constitutional adjudication — read this first

This mandate **amended** two previously ratified decisions, and the amendment was executed
deliberately, not drifted into:

| Ratified position | This mandate | Resolution |
|---|---|---|
| D-6: WebGL/Three.js **rejected** for core (Tier 3 "not approved") | Tech stack names Three.js/R3F/WebGL | Treated as the Founder invoking Tier 3's own clause ("requires separate Founder approval + its own performance case") — **approved for the Threshold only, on a feature branch, with the performance case in §8** |
| §5.10: scroll never hijacked | "Scrolling moves the CAMERA" | Scroll capture exists **only inside the Threshold dialog** — a modal experience with a visible skip, an Escape hatch, forward-only strides and an auto-advance floor. Page scroll is never touched |

**Held without amendment (never rescinded, and verified in §9):** LCP-first · SEO intact · the
landing stays static · skippable · once-per-session · silent by default (no autoplay, ever) ·
reduced-motion parity · progressive enhancement · no blocking hydration.

Orchestration note: the mandated 10-agent mode ran as ten sequential passes solo — workflow
sub-agents are broken in this environment (two documented harness failures; every tool input is
stripped). The adversarial pass (Agent 10) produced the phase's most important fix (§7).

## 2. Architecture

```
app/page.tsx                          server-rendered landing (unchanged content)
 ├─ <script> pre-paint entry decision  ~230 bytes, runs BEFORE the hero parses:
 │    reduced-motion? seen this session? WebGL?  →  html[data-cxenter]
 │    └─ CSS: html[data-cxenter]::after = darkness at first paint
 │            + pure-CSS 12s safety fade (nothing can strand a black screen)
 ├─ <ThresholdGate/>          client, ~1.6 kB — the ONLY sync Threshold code
 │    re-checks every condition (fail-closed → lifts darkness on any miss),
 │    then AFTER window load + idle:  import("./Threshold")
 │         └─ Threshold.tsx   the experience shell (dialog, input, GSAP master
 │            │               timeline, opt-in WebAudio hum, a11y, cleanup)
 │            └─ thresholdScene.ts  imperative three.js environment
 └─ (hero, sections… — Phase 1 arrival still plays for non-Threshold visits)
```

**Folder structure:** `components/cxos/{ThresholdGate.tsx, Threshold.tsx, thresholdScene.ts}` ·
guard `scripts/cxos-threshold.test.ts`. **Component hierarchy** is exactly the tree above — one
gate, one shell, one scene module; nothing else in the app knows the Threshold exists.

**Dependencies added (feature branch only):** `three@0.185.1` (MIT) · `gsap@3.15.0` (standard
no-charge license) · `@types/three`. Neither enters any synchronous bundle.

## 3. Scene flow & camera choreography

One continuous camera walk — a dolly from z=62 to z≈2, easing over the whole journey and
accelerating through the opening. No cuts. The visitor's scroll adds *strides* to the same walk.

| Beat | Progress | Environment | DOM layer | Emotion |
|---|---|---|---|---|
| 0 · The Void | 0–0.14 | darkness `#02040a`; 2,600-particle field breathes in; vignette closes | skip control fades in; hint "scroll to walk · esc to skip" | curiosity → silence |
| 1 · First Light | 0.12–0.30 | a distant core ignites; teal/ocean nebula wakes behind it | — | anticipation |
| 2 · Architecture | 0.28–0.52 | the colonnade assembles — 28 instanced light strips converging on the light; ocean guide-rails (the landing's grid, met as architecture) | — | discovery |
| 3 · The Name | 0.51–0.67 | environment holds; light shimmer reads as power, not blinking | **GABRIEL CAPITAL LABS** — letterspacing compresses from 1.4em to 0.62em: carved, not typed | authority |
| 4 · CreditVector | 0.66–0.85 | corridor waits | the real 3D shield + wordmark materialize · "CREDIT INTELLIGENCE OPERATING SYSTEM" · "Initializing…" pulses three times | power → confidence |
| 5 · The Opening | 0.85–1.0 | camera accelerates; particles streak past; the light floods | identity yields; overlay dissolves onto the Hero | awe → "I need this" |

**Camera language:** one instrument only — the walk. Parallax (±1.3 units, heavily smoothed) is
the head turning; the dolly is the feet. Nothing else moves the camera, which is what makes the
final acceleration land.

## 4. Interaction choreography

| Input | Response |
|---|---|
| Wheel / touch drag / ↓ / Space | forward strides on the walk (clamped per event; **can never rewind**) |
| No input at all | the walk completes alone in ~10s (7–8s mobile) — auto-advance floor; never stalls, never traps |
| Pointer move | the room answers the hand: smoothed camera parallax on particles, light, architecture |
| Device tilt | same channel — **only where no permission wall exists** (never a prompt inside the Threshold) |
| `Escape` / Skip button | the single exit path; darkness cleared, session remembered, focus handed to the Hero h1 |
| Sound toggle | the only way audio can exist (§6) |
| Tab | skip control holds first focus inside a labelled `role="dialog"` |

## 5. Motion · environmental · lighting language

- **Motion:** the Phase 1 grammar extends unbroken — the house vector-ease drives the GSAP beats;
  Settle and Shine reappear as the wordmark's materialization; Drift becomes the particle field.
  Everything is transform/opacity/scale; the walk itself is the only translation.
- **Environment:** three materials tell the whole story — darkness (ink), light (additive teal
  core + ocean nebula), architecture (emissive strips). No textures downloaded; the two glow
  textures are generated on a 128px canvas at runtime.
- **Lighting:** the palette rule survives WebGL intact — **navy/blue/teal only**; the single
  white element is the light core itself. Light always answers "where do I look": the corridor
  converges on it, the name appears above it, the wordmark materializes in front of it, and the
  opening is a flood of it.

## 6. Sound language

Designed, present, **and off by default** — the constitution's "silence is the design" was never
rescinded, and the mandate's own facility is "almost silent." The toggle synthesizes a facility
hum in WebAudio on the user's explicit click: three detuned sines (54 / 54.35 / 108.2 Hz) through
a 220 Hz lowpass, master gain 0.035, swelling gently with the walk, closed and disposed on exit.
No audio files. No autoplay path exists in the code — construction is provably confined to the
click handler (guarded, §9).

## 7. The adversarial pass — the finding that mattered

**The Hero flashed before the darkness.** The gate mounted after hydration + idle, so a
first-time visitor glimpsed the landing for ~0.5s before the overlay covered it — "the Hero
should feel earned, not loaded" was violated at the first frame, and any import failure would
have stranded a black screen forever.

**Fix, two mechanisms:** (1) a ~230-byte inline script placed **before the hero markup** makes
the entry decision synchronously (reduced-motion, session memory, WebGL probe) and paints the
darkness at first paint via `html[data-cxenter]::after` — measured mean luminance of first paint:
**0.0/255**. (2) That darkness carries a **pure-CSS 12-second safety fade** (the repository's
`reveal-safety` pattern, promoted), and the gate lifts it on every early-return and on chunk-load
failure — so *no* failure mode can strand the visitor in the dark. The landing beneath was
painted all along; the darkness is paint, not absence.

## 8. Performance architecture — the Tier-3 case

| Constraint | Delivered |
|---|---|
| Synchronous cost | first-load JS **96.2 → 96.8 kB** (+0.6 kB: gate + entry script). three/gsap are `import()`-only, fetched **after** the load event + idle |
| Lazy cost | ~170 kB gz, first visit only, per session, post-LCP — and only for motion-OK, WebGL-capable, JS-on humans |
| Draw calls | **3** on desktop: one `Points` cloud (2,600), one `InstancedMesh` colonnade (28), one additive sprite pair. Mobile: 1,400 / 16, DPR 1 |
| GPU hygiene | DPR clamped 1.5 · antialias off · no shadows · no postprocessing · zero per-frame allocation |
| Lifecycle | rAF pauses when hidden; on exit every geometry/material/texture is disposed and the GL context force-released — **zero residual cost** on the landing |
| Rendering mode | the landing stays **`○ /` static**; the overlay never blocks hydration |

## 9. Accessibility strategy + verification matrix

Reduced motion **never mounts the Threshold and never downloads a WebGL byte** — the same
narrative (the landing, with its Phase 1 reduced-motion stills) with the motion removed. The
overlay is a labelled dialog naming its escape hatch; skip takes first focus; Escape exits from
any frame; completion focuses the Hero's `h1`; canvas and vignette are `aria-hidden`; the sound
control is a real `aria-pressed` toggle.

**Behavioral evidence (Playwright, production build):**

| Check | Result |
|---|---|
| First paint is darkness (no hero glimpse) | **PASS** — mean luminance 0.0/255 |
| The walk completes into the landing; session memory written | **PASS** |
| Darkness attribute cleared after entry | **PASS** |
| Return visit: no overlay, no darkness, hero immediate | **PASS** |
| Escape skips mid-walk; darkness cleared | **PASS** |
| Reduced motion: no overlay, no darkness, hero visible instantly | **PASS** |
| Mobile completes into the landing | **PASS** |
| Raw HTML carries the full narrative (SEO) | **PASS** — copy + compliance lines present |

**Source guard:** `scripts/cxos-threshold.test.ts` — **32/32**, non-vacuity proven by three
mutations (reduced-motion gate stripped → fail; autoplay AudioContext introduced → fail; GL
context leak → fail), each restored byte-identical. Full suite: **78/78** guards, `tsc` clean,
build clean.

## 10. Asset list

Zero downloaded assets. The particle and glow textures are runtime-generated canvases; the only
raster is the **real 3D shield** (`public/logo-mark.png`, already shipped — the hard rule holds);
the hum is synthesized. Higgsfield was evaluated and **not used in the prototype** — nothing in
these beats needed a generated asset, and the product-UI prohibition stands. It remains the tool
for Arena/Academy environment concepts in later phases.

## 11. Roadmap — the philosophy repeats

| Phase | Room | Entry concept (per mandate) |
|---|---|---|
| **2 · this** | The public Threshold | ✅ working prototype |
| 2.1 | Threshold polish round | Founder feedback on the live prototype; timing/composition tuning; optional Higgsfield mood studies |
| 3 | Scenes 2–10 (scroll rooms) | ScrollTrigger enters here — page-level scroll choreography with the corridor's visual language |
| 4 | Mission Control entry | "Security clearance → systems online → displays wake → Kai appears" — same gate/overlay architecture, post-auth |
| 5 | Arena entry | the vault: doors, XP assembling from evidence, operator recognized — prestige, no casino |
| 6 | Academy | warm room; knowledge as light — needs the product definition (D-5) first |

## 12. Deliverables map (mandate items 1–25)

1–2 Architecture & scene flow: §2–3 · 3 Camera: §3 · 4 Interaction: §4 · 5 Motion: §5 ·
6 Environment: §5 · 7 Lighting: §5 · 8 Sound: §6 · 9 Performance: §8 · 10 Accessibility: §9 ·
11 Roadmap: §11 · 12 Scene diagrams: §2–3 (+ storyboard frames) · 13 Assets: §10 ·
14 Folder structure: §2 · 15 Component hierarchy: §2 · 16 Timeline: §3 beats table ·
17–18 Implementation & working prototype: commit `aedf148`, verified · 19–21 Desktop/tablet/
mobile: responsive one-codepath (mobile budgets §8; tablet = desktop path at touch input) ·
22 Handoff PDF: delivered with this report · 23 Storyboard: the captured beat frames ARE the
storyboard — real frames, not comps · 24 Before/after: §9 + gallery (before = instant landing;
after = entered landing) · 25 This report.

---

*Feature branch only. No merge, no deploy, no production contact, no schema, no compliance-copy
change. The landing beneath the Threshold is byte-for-byte the Phase 1 landing — every visitor
who should not get the walk gets exactly the page they got yesterday, instantly.*
