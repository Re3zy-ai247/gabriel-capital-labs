# CXOS — Storyboards & Motion Board

**CreditVector Experience OS · v1 · 2026-07-29**
**Status: DRAFT — contingent on screenplay approval. Planning only; no implementation.**

> The program sequence is screenplay → approval → storyboard. These boards are supplied now so the
> Founder reviews one complete package; they are **drafts that inherit any screenplay amendment**
> and are void where the screenplay changes. Frames are specified as precise compositional
> documents (grid, planes, type scale, lighting values) rather than rendered comps — renderable
> 1:1 by any implementer of the grammar, with zero ambiguity about hierarchy.
>
> Vocabulary: grammar terms from `CXOS_FOUNDATION.md` §5 (Settle · Reveal · Draw · Drift · Shine ·
> Focus · vector ease). Grid: 12-col `container-x` desktop · single-column mobile. Planes:
> Atmosphere / Content / Instrument.

---

## 1. Desktop storyboard

Frames are keyed to screenplay scenes. "A/C/I" = plane assignment.

### Frame 1a–1c — Public Arrival
- **1a (t=0, LCP):** complete page, no choreography yet. Grid: headline block cols 1–6, shield
  cols 8–12 vertically centered. Type: eyebrow (11px caps, brand-300) → `h-display` 6xl,
  `leading-[1.05]`, `text-balance` → lede (slate-300, max-w-xl) → CTA pair (primary + ghost).
  A: grid texture + both auroras at opacity 0. C: all text. I: shield raster via `next/image`,
  priority.
- **1b (t≈1.2s):** auroras at 0.5 (brand upper-left 460px, ocean right 420px, blur 72px);
  headline/CTA settled (staggered Settle, 80ms).
- **1c (t≈2.0s, final):** shield settled with one Shine sweep completed; page is at rest;
  Drift continues at 18s period. **This frame = the reduced-motion still and the return-visit
  state.**

### Frame 2a–2b — Credit Problem
- **2a:** rack Focus midpoint — headline plane at opacity 0.4/blur 4px upper third; three report
  fragments (I-plane cards, `ink-800` surface, `ink-700` border) entering cols 2–11 as a
  horizontal triptych, equal widths, 24px gutters. Each card: bureau name (11px caps slate-500),
  account row, one highlighted field.
- **2b:** Draw complete — a 1.5px brand-400 path connecting the three disagreeing fields,
  drawn left→right; the disputed values at 105% scale. Caption row beneath in operator voice.

### Frame 3a–3b — Evidence
- **3a:** insert — one product frame (real tradeline comparison capture) spans cols 2–11,
  border `ink-700`, elevation 1. Desktop-only: frame is sticky for ≤ 2 viewports.
- **3b:** four annotation labels settled at frame edges (12px, slate-300, connector Draws to
  fields). Labels use real product vocabulary only (BureauIQ, per-bureau columns, `tnum` data).
  **No success green anywhere in this frame.**

### Frame 4 — Kai
- Single centered column, cols 4–9. A Kai briefing card (I-plane): Kai wordmark row, then 4
  lines of a real FCRA explanation revealed 120ms apart, statute citation in brand-300.
  A: one small brand glow (240px, opacity 0.25) directly behind the card — the only
  behind-instrument light in the film. Massive whitespace above/below (≥ 160px).
  **No mascot. No chat affordance.**

### Frame 5a–5c — Mission Control (marketing)
- **5a:** wide — full dashboard frame cols 1–12 at 90% width, centered, aurora dimmed to 0.15.
- **5b:** insert — dispute timeline panel enlarged cols 3–10; Draw traces evidence → letter →
  response along the timeline spine.
- **5c:** insert — letter citation panel; two FCRA citations underlined via Draw.
- Module tiles labelled exactly per `lib/brand.ts` (BureauIQ · Dispute Engine · Response
  Intelligence · FCRA Engine).

### Frame 6 — Agency
- Two-column: copy cols 1–5, roster frame cols 6–12. Roster: 5 workspace rows + capacity meter
  rendered at its true static proportion (no fill animation). Aurora ocean-weighted.

### Frame 7 — Consumer
- Mirrored composition (copy right, artifact left): single letter frame with two citation
  underlines (Draw), education banner beneath. Aurora brand-weighted.

### Frame 8 — Arena (marketing)
- Vertical monument composition: progression rail centered cols 6–7 as a 2px vertical line with
  level marks; copy flanks at cols 2–5. A: single vertical brand gradient (120px wide, opacity
  0.2) directly behind the rail; both auroras stilled. ≥ 200px whitespace top and bottom.
  Numbers `tnum`, arrive static.

### Frame 9 — Education
- Centered column (sibling of Frame 4): three concept cards in a row cols 3–10 (rights /
  process / timelines), icon + two lines each. No product frame.

### Frame 10 — Pricing
- Symmetric authority composition: interval toggle centered; tier table centered cols 2–11.
  Recommended tier: static 1px brand border. "Coming soon" columns visibly muted with honest
  labels. Flattest lighting in the film (aurora 0.1).

### Frame 11 — Login
- Shipped `AuthLayout` split: brand panel left (aurora 0.25, shield small, three assurance
  rows), form panel right on flat ink. Nothing animates during input.

### Frame 12a–12d — The Threshold (≤ 2.5s)
- **12a (0ms):** auth panel dims to 0.4/blur 4px (Focus out).
- **12b (400ms):** dark stage; shield small and centered, settled.
- **12c (400–2000ms):** Mission Control panels Settle *outward from the shield* in reading
  order, 60ms stagger — nav, then case header, then module panels.
- **12d (≤2500ms):** full Mission Control; aurora crossfaded to 0.15; focus on the h1.
  **Any input at any frame cuts directly to 12d.**

### Frame 13 — Mission Control (authenticated)
- Consumer arrival: case status header full-width; next-action card upper-left (the protagonist);
  Kai briefing card right rail, dismissible. Agency arrival: practice roster as protagonist,
  capacity and staff seats in header. Operator type density; panels settle once, then static.

### Frame 14 — Arena Entry
- The member's own rail: vertical composition from Frame 8, personalized. Entry Draw of the rail
  (1.2s, once per session), XP provenance rows beneath (event → evidence → points, `tnum`).
  Policy version line in the footer of the surface, visible without scroll.

### Frame 15 — Reduced-motion stills
- One still per frame above: the resolved end-state, aurora as static two-stop gradient, Draw
  paths pre-drawn, thresholds cut. **Each still is reviewed as a standalone composition** —
  this row of the board is the approval gate for every other row.

---

## 2. Mobile storyboard (390×844 reference; designed first, not adapted down)

Global mobile rules: single column; no sticky stages; no parallax; intro choreography ≤ 6s
ceiling (actual: same 2.0s arrival); tap targets ≥ 44px; primary CTA within thumb reach;
`dvh` viewport units; auroras at 65% desktop size and 0.4 amplitude to protect contrast.

| Scene | Mobile composition |
|---|---|
| 1 | Stack: eyebrow → 4xl headline → lede → full-width primary CTA → ghost CTA → shield (60vw, centered, below the fold line but visible on first swipe). Same 2.0s Settle sequence |
| 2 | Fragments stack vertically; Draw runs top→bottom connecting the three disagreeing fields; each card full-width |
| 3 | Product frame full-width, **not sticky**; annotations become numbered captions *below* the frame (connector Draws replaced by number badges on the frame) |
| 4 | Card full-width; glow scaled to 160px; line-by-line Reveal preserved |
| 5 | Frame full-width; the two inserts become sequential full-width crops (timeline, then citations) with their Draws intact |
| 6–7 | Copy above artifact, artifact full-width; Agency/Consumer presented sequentially (no tabs on mobile) |
| 8 | Rail stays vertical and centered — the monument composition survives mobile perfectly; flanking copy moves above/below |
| 9 | Concept cards stack |
| 10 | Tier table becomes per-tier cards with a horizontal scroll comparison row (`overflow-x`, scroll-snap); toggle sticky at top of the section only |
| 11 | Brand panel compresses to a header band (shield + one assurance line); form is the page |
| 12 | Threshold shortened to ≤ 1.8s: Focus-out → shield beat → panels settle top-to-bottom. Same skip/remember/reduced rules |
| 13 | Next-action card first, always; Kai briefing as a dismissible sheet from the bottom, never a blocking modal |
| 14 | Rail full-height left-aligned with provenance rows to its right at compressed density |
| 15 | Stills of every mobile frame, same gate |

---

## 3. High-fidelity composition specs (shared)

- **Surfaces:** page `ink-950` · card `ink-800` · border `ink-700` · elevated instrument border
  `ink-600`.
- **Text ramp:** headline white · lede `slate-300` · secondary `slate-400` · captions/labels
  `slate-500` 11px caps tracked.
- **Accents:** interactive/brand `brand-400/500` · depth fields `ocean-500` · **success green only
  on evidenced positive states** (appears in exactly two boards: a resolved dispute inside
  Frame 5b's timeline, and nowhere in marketing atmosphere).
- **Radii/elevation:** cards `rounded-2xl`-class per shipped `.card`; elevation via border +
  subtle shadow, never heavy drop shadows.
- **Iconography:** lucide-react line icons only (shipped); no filled/emoji/3D icons. The 3D
  shield is the sole dimensional object in the system.
- **Imagery:** real product captures and the real shield raster only. Any Higgsfield-generated
  atmosphere study is a design-exploration artifact and never ships as product imagery.

---

## 4. Scene-transition map

| From → To | Transition | Duration | Continuity carrier |
|---|---|---|---|
| 1 → 2 | scroll; rack Focus headline→evidence | scroll-scrubbed | grid texture |
| 2 → 3 | Draw path continues downward into the product frame | scroll-scrubbed | the brand-400 evidence line |
| 3 → 4 | Focus out of frame; whitespace expands | scroll | aurora dim level |
| 4 → 5 | push-in on briefing card, crossfade to wide | 320ms | the briefing card (revealed as a Mission Control panel) |
| 5 → 6 → 7 | crossfade on shared stage | 240ms | the product frame chrome |
| 7 → 8 | citation underline Draws down into the Arena rail | scroll | one continuous line |
| 8 → 9 → 10 | plain scroll, no device | — | typography rhythm |
| 10 → 11 | route change: crossfade-with-settle (View Transitions; instant fallback) | 280ms | aurora |
| 11 → 12 → 13 | the Threshold (screenplay Scene 12) | ≤ 2.5s / 300ms / 0ms | aurora + shield |
| 13 → 14 | route crossfade; Arena's vertical gradient rises | 280ms | ink ground |

**Rule: every transition names its continuity carrier — the one element the eye keeps.** A
transition with no carrier is a cut, and cuts belong to the user.

---

## 5. Motion board

The complete motion vocabulary of the film. Anything not on this board does not move.

| # | Name | Primitive(s) | Duration / ease | Where | Reduced-motion |
|---|---|---|---|---|---|
| M1 | Arrival breath | Drift (aurora 0→0.5) | 1200ms · vector ease | Scene 1 | static gradient |
| M2 | Headline settle | Settle ×3 staggered 80ms | 400ms each | Scenes 1, 11 | visible immediately |
| M3 | Shield settle + sheen | Settle → Shine | 400ms + 600ms | Scene 1 | static shield |
| M4 | Evidence trace | Draw (scroll-scrubbed) | scroll-linked | Scenes 2, 3, 5, 7 | pre-drawn |
| M5 | Fragment raise | elevation + 1.02 scale | 150ms | Scene 2 hover/tap | state change only |
| M6 | Briefing compose | Reveal ×n staggered 120ms | 600ms each | Scene 4, 13 | all visible |
| M7 | Panel assembly | Settle ×n staggered 60ms | 400ms each | Scenes 5, 12, 13 | assembled |
| M8 | Rack focus | Focus (blur 4px, opacity 0.4) | 350ms | Scenes 2, 4, 12 | instant swap |
| M9 | Route crossfade | crossfade + Settle | 240–320ms | all route changes | instant |
| M10 | Threshold | M8 → M3 → M7 composed | ≤ 2500ms total | Scene 12 | cut |
| M11 | Arena rail | Draw (time-based, once) | 1200ms | Scenes 8, 14 | drawn |
| M12 | Instrument hover | Shine + border brighten | 150ms | all interactive cards | border only |

**Global constraints:** transform/opacity only · no layout animation · no infinite animation
except Drift · every sequence carries a CSS-only safety net landing its final frame · nothing
exceeds the timing summary ceilings in `CXOS_SCREENPLAY.md`.

---

## 6. What these boards are not

No code, no CSS, no components, no Figma files, no rendered comps, and no implementation prompts
were produced. The boards become buildable specifications only after the Founder approves D-1
(grammar) and D-2 (screenplay) in `CXOS_FOUNDATION.md` §16 — and Phase 3 of the roadmap begins
only behind the repository's five-review gate.
