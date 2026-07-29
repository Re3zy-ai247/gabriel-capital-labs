# CXOS — The Screenplay

**CreditVector Experience OS · Scene Script v1 · 2026-07-29**
**Status: DRAFT — awaiting Founder approval. Planning only; nothing here is implemented.**

> This is the screenplay, not the storyboard: what happens, what it means, and what the visitor
> feels — scene by scene. Camera and motion terms are defined in the Experience Grammar
> (`CXOS_FOUNDATION.md` §5). Every duration respects the 8–12s intro budget; every scroll scene is
> user-paced. **All narration below is written to the compliance bar: education, evidence and
> rights — never outcome promises.** Narration text is the Founder's to edit.

**Cast of non-negotiables present in every scene:** silence (no audio) · skippability · reduced-
motion parity (Scene 15) · real product truth only · one protagonist per viewport.

---

## Scene 1 — Public Arrival

- **Emotion:** stillness → recognition. *"This is a serious place."*
- **Goal:** establish darkness, light and identity in the first breath; deliver LCP before any
  cinema.
- **Camera:** establishing wide. The page paints complete (headline, shield, CTA) — then the
  cinematic layer breathes over it.
- **Motion:** the aurora *arrives* — opacity 0 → 0.5 over 1.2s (Drift begins). Headline and CTA
  Settle (400ms, staggered 80ms). The shield — the real 3D raster — Settles last, with a single
  Shine pass across its surface.
- **Lighting:** ink-950 ground; one brand aurora upper-left, one ocean aurora right (the shipped
  composition, canonized).
- **Narration (on screen):** eyebrow — *"The Credit Intelligence Operating System."* Headline —
  *"Understand your credit. Dispute what's inaccurate — yourself."*
- **Interaction:** everything is live immediately; scrolling at any moment ends the choreography
  and hands over the page. Skip affordance is present but this scene needs none — it *is* the page.
- **Duration:** 2.0s of choreography over already-painted content.
- **Exit:** first scroll → Scene 2. (The full 8–12s "awakening" sequence exists only on first
  visit; returning sessions get the settled final frame instantly.)

## Scene 2 — The Credit Problem

- **Emotion:** recognition of unfairness — *"they know this happens to people like me"* — without
  fear-mongering.
- **Goal:** name the problem honestly: errors exist across three bureaus, and most people never
  see them side by side.
- **Camera:** rack focus from headline plane to an evidence plane: three report fragments
  (Equifax / Experian / TransUnion), same account, different data.
- **Motion:** the three fragments Reveal in sequence; a Draw traces the discrepancy between them
  — one date that disagrees, one balance that doesn't match. Scroll-scrubbed.
- **Lighting:** aurora dims to 0.3; the discrepancy trace is the brightest object (brand-400).
- **Narration:** *"Your credit report isn't one document. It's three — and they don't always
  agree. Federal law gives you the right to dispute what's inaccurate."*
- **Interaction:** hovering/tapping a fragment raises it (Instrument elevation) and enlarges the
  disputed field.
- **Duration:** user-paced; composition resolves within one viewport of scroll.
- **Exit:** the traced discrepancy line *continues downward* into Scene 3 — evidence literally
  leads to the product.

## Scene 3 — Evidence

- **Emotion:** relief through competence — *"someone has organized this."*
- **Goal:** show BureauIQ doing what the copy just described: real cross-bureau anatomy, labelled.
- **Camera:** insert — a real product frame (tradeline comparison) fills the stage; sticky for one
  viewport on desktop while labels annotate; never sticky on mobile.
- **Motion:** annotation labels Settle one at a time as scroll progresses; Draw connects each
  label to its field. `tnum` numerals throughout.
- **Lighting:** neutral; the product frame carries its own in-app lighting. Success green appears
  **nowhere** here — nothing has been resolved yet, and the grammar forbids unearned green.
- **Narration:** *"BureauIQ reads all three reports and shows you every account, every
  discrepancy, every date — side by side. Evidence first. Always."*
- **Interaction:** the frame is a still of truth (a real capture, not a live demo) — labelled as
  such.
- **Duration:** user-paced, ~1.5 viewports.
- **Exit:** rack focus from evidence to a calm insert of text — Kai is introduced by voice before
  appearance.

## Scene 4 — Kai

- **Emotion:** trust in judgment — *"an analyst, not a gimmick."*
- **Goal:** introduce Kai as the governed intelligence layer: assists, explains, educates; never
  fabricates, never replaces judgment.
- **Camera:** the quietest scene in the film. Center-composed single column, generous whitespace.
- **Motion:** a Kai briefing composes itself line by line (Reveal, 120ms stagger) — a real
  explanation of a real FCRA concept, citing the actual statute the product cites.
- **Lighting:** a single, small brand glow behind the briefing card — the only scene where the
  light source sits *behind an instrument*, marking intelligence.
- **Narration:** *"Kai is CreditVector's intelligence layer. Kai explains what it finds, cites
  the law it relies on, and drafts letters you review — Kai never invents, and never decides for
  you."* (Note: "AI-powered" appears nowhere — per constitution.)
- **Interaction:** none beyond scroll. Kai is observed here, not operated. **The Shiba mascot does
  not appear** — this is a product scene.
- **Duration:** user-paced; short.
- **Exit:** the briefing card scales 1.00→1.04 (push-in) and crossfades into the wide of Scene 5 —
  Kai's briefing was one panel *of Mission Control*.

## Scene 5 — Mission Control (marketing view)

- **Emotion:** ambition — *"this is the cockpit of my financial life."*
- **Goal:** show the operating system claim being true: modules, evidence timeline, letters in
  flight — the real dashboard, gently lit.
- **Camera:** establishing wide of the full product frame, then two inserts (dispute timeline;
  a letter's citation panel).
- **Motion:** the frame Settles; module tiles Reveal in reading order; one Draw traces a dispute's
  path from evidence → letter → response.
- **Lighting:** aurora at 0.15 (the inside-the-product amplitude); the interface's own hierarchy
  does the lighting.
- **Narration:** *"Mission Control. Every report, every dispute, every deadline — one governed
  workspace."* Module names appear exactly as `lib/brand.ts` states them.
- **Interaction:** none — observation. (Real interactivity is Scene 13's job, after login.)
- **Duration:** user-paced, ~2 viewports.
- **Exit:** split — the frame divides toward two doors: Consumer and Agency.

## Scene 6 — Agency

- **Emotion:** professional respect — *"built for my practice."*
- **Goal:** the operator story: client workspaces, capacity, staff seats — honest tiers with the
  shipped honest caps.
- **Camera:** push-in on a multi-workspace roster frame.
- **Motion:** workspace rows Reveal; the capacity meter Settles at its true proportion — never
  animating toward "full" (no fake scarcity).
- **Lighting:** slightly cooler (ocean-weighted aurora) — the professional temperature.
- **Narration:** *"Agencies run every client in their own workspace — the same evidence engine,
  at practice scale."*
- **Interaction:** tab affordance to peek Consumer ↔ Agency framing (also serving Scene 7).
- **Duration:** user-paced; one viewport.
- **Exit:** crossfade to Scene 7 (same stage, different door).

## Scene 7 — Consumer

- **Emotion:** personal hope, grounded — *"I can actually do this myself."*
- **Goal:** the self-advocate story: one person, their three reports, their first letter — and the
  education that makes them capable.
- **Camera:** insert of a single letter with its FCRA citations highlighted.
- **Motion:** Draw underlines the citations; the education banner Reveals beneath — the product's
  actual education-first framing, on screen.
- **Lighting:** slightly warmer brand amplitude — the human temperature.
- **Narration:** *"You review everything. You send everything. You learn your rights as you go —
  because this is your credit, and your case."*
- **Interaction:** none new.
- **Duration:** one viewport.
- **Exit:** the citation underline Draws downward into Scene 8's threshold.

## Scene 8 — Arena

- **Emotion:** earned prestige — *"progress that means something."*
- **Goal:** present Arena exactly as the code already enforces it: XP only from evidenced
  activity, permanent, server-authoritative — a hall of operators, not a casino.
- **Camera:** establishing wide with more negative space than any scene before — prestige is
  spatial.
- **Motion:** a progression rail Draws slowly (1.8s); level marks Settle. Nothing pulses, nothing
  counts up excitedly; numbers arrive already true, in `tnum`.
- **Lighting:** the aurora stills almost completely; light narrows to a single vertical brand
  gradient behind the rail — the institutional column.
- **Narration:** *"The Arena. Progress here is earned one way: real, evidenced activity. Nothing
  is awarded for showing up."* (Direct descendant of the shipped empty-state copy.)
- **Interaction:** none — the marketing Arena is observed. Entry is Scene 14.
- **Duration:** short; restraint *is* the message.
- **Exit:** cut (user scroll) to Scene 9.

## Scene 9 — Education

- **Emotion:** generosity — *"they teach me even before I pay."*
- **Goal:** state the education-first identity; preview the future Education destination honestly
  (it does not exist yet as a route — nothing is faked as live).
- **Camera:** calm centered column, sibling composition to Scene 4 (Kai and education are the
  same voice).
- **Motion:** three concept cards Reveal (rights, process, timelines). No product frame — there
  is no product surface to show truthfully yet.
- **Lighting:** neutral, bright-end of the marketing range.
- **Narration:** *"CreditVector teaches the law it uses. Every letter cites it. Every explanation
  links to it."*
- **Interaction:** links to existing educational content only.
- **Duration:** one viewport.
- **Exit:** scroll into pricing — generosity earns the right to ask.

## Scene 10 — Pricing

- **Emotion:** clarity and self-respect — *"I understand exactly what I'd pay for."*
- **Goal:** the engineering table: real tiers, real caps, honest "Coming soon" states (shipped
  behavior: unpurchasable tiers cannot be charged).
- **Camera:** symmetric, centered — the authority composition (§5.2).
- **Motion:** minimal. Rows Reveal once; the recommended tier carries a static brand border, not
  a pulse. Numbers in `tnum`.
- **Lighting:** flattest scene in the film — pricing under honest light.
- **Narration:** the table itself; plus the shipped guarantee *"you can't be charged for a plan
  that isn't available yet."*
- **Interaction:** interval toggle (monthly/annual), plan CTAs. Fully functional, zero drama.
- **Duration:** as long as the visitor needs.
- **Exit:** primary CTA → Scene 11.

## Scene 11 — Login / Join

- **Emotion:** crossing a threshold with confidence.
- **Goal:** the shipped split-screen `AuthLayout`, elevated: brand panel carries the aurora and
  three truthful assurances; the form is instrument-grade.
- **Camera:** static two-panel composition; no motion during credential entry (respect for a
  security moment).
- **Motion:** panel content Settles once on load; nothing moves while typing.
- **Lighting:** aurora at 0.25 on the brand panel only; form panel is calm ink.
- **Narration:** the three assurance points (real, shipped copy — encryption, review-first
  letters, education).
- **Interaction:** the form. Every a11y rule of §12 applies; errors follow §5.15.
- **Duration:** n/a — functional.
- **Exit:** successful auth → Scene 12.

## Scene 12 — Authenticated Transition (the Threshold)

- **Emotion:** *arrival.* The single most designed 2.5 seconds in the product.
- **Goal:** compress marketing atmosphere into operator atmosphere; make login feel like entering
  the thing the site showed.
- **Camera:** rack focus: the auth panel dims and blurs; a dark stage holds the shield small and
  centered; Mission Control's frame resolves *around* it — the interface assembles from the
  identity outward.
- **Motion:** ≤ 2.5s WAAPI timeline: shield Settle (400ms) → interface panels Settle outward in
  reading order (staggered 60ms) → aurora crossfades from marketing amplitude to 0.15 → done.
  Skippable by any input at any frame; plays **once per user** — subsequent logins get a 300ms
  crossfade.
- **Lighting:** the one continuous light: the aurora *never cuts* across the boundary — it dims.
- **Narration:** none. Silence and light.
- **Interaction:** any input skips to the final frame instantly.
- **Duration:** ≤ 2.5s (first login) · 300ms (thereafter) · 0ms (reduced motion).
- **Exit:** Mission Control, fully interactive, focus on the page heading.

## Scene 13 — Mission Control (authenticated arrival)

- **Emotion:** quiet command — NASA console, Bloomberg density, Apple calm.
- **Goal:** the operator's first 10 seconds: state of the case, next action, Kai's briefing —
  without a tour, without confetti.
- **Camera:** the working interface. Density per §5.1 (operator voice, `tnum`).
- **Motion:** panels Settle once (60ms stagger) and never move again; data updates state-change
  only. Kai's briefing card Reveals last, dismissible.
- **Lighting:** aurora at ≤ 0.15, doubled drift period — atmosphere at the edge of perception.
- **Narration:** Kai's actual contextual briefing (real data, real next step). Empty states per
  §5.13 — briefings, not apologies.
- **Interaction:** everything. This is the product; the experience layer must never add friction
  to it. **Consumer and Agency arrivals differ**: consumer opens on *my case*; agency opens on
  *the practice roster* — same grammar, different first protagonist.
- **Duration:** persistent surface.
- **Exit:** n/a.

## Scene 14 — Arena Entry (authenticated)

- **Emotion:** belonging to an institution — *"my record, on the wall."*
- **Goal:** the member's own progression, rendered with prestige: level, XP provenance, policy
  version — the shipped mechanics, ceremonially framed.
- **Camera:** vertical composition; the member's rail is the protagonist.
- **Motion:** one Draw of the member's own progression rail on entry (1.2s, once per session);
  XP numbers arrive as truth, never count up. No badges rain, no sparkles.
- **Lighting:** the institutional column from Scene 8, personalized: the member's rail carries
  the single vertical gradient.
- **Narration:** the shipped policy line, elevated in type: *"XP is derived from your own
  verified evidence."* Policy version visibly stated — governance as design.
- **Interaction:** progression detail, evidence provenance per XP event.
- **Duration:** persistent surface; entry choreography ≤ 1.2s, once per session.
- **Exit:** n/a.

## Scene 15 — Reduced Motion (the parallel film)

- **Emotion:** identical to every scene above. That is the point.
- **Goal:** full narrative parity with zero motion: every scene delivers its final frame as a
  designed static composition.
- **Camera:** every scene's *resolved* composition, art-directed as stills — not frozen
  mid-animation.
- **Motion:** none. Aurora renders as a static two-stop gradient. Draw renders already-drawn.
  Transitions are instant. The Scene 12 threshold is a cut to Mission Control.
- **Lighting:** identical values, static.
- **Narration:** identical text — it was always real DOM content.
- **Interaction:** identical — interactivity never depended on motion.
- **Duration:** 0s of choreography anywhere.
- **Exit:** n/a. This scene is a build target and a review checklist item for every other scene:
  **no scene is approved until its reduced-motion still stands on its own.**

---

## Timing summary

| Beat | First visit | Return visit | Reduced motion |
|---|---|---|---|
| Public arrival choreography | 2.0s over painted content | 0s (settled frame) | 0s |
| Full "awakening" sequence (Scenes 1→5 scroll) | user-paced | user-paced | user-paced, static |
| Login → Mission Control threshold | ≤ 2.5s | 300ms | 0s |
| Arena entry | ≤ 1.2s | once per session | 0s |
| **Hard ceiling, any automatic sequence** | **12s** (skippable throughout) | — | — |

**Nothing plays without consent, nothing repeats without request, and nothing exists only in
motion.**
