# CXOS — CreditVector Experience OS · Founding Design Constitution

**Program:** Experience Architecture · **Phase:** Founding record + Core Runtime amendment · **Date:** 2026-07-29 · amended 2026-08-01
**Status: FOUNDING RECORD · PHASE 6.2 EXPERIENCE APPROVED · CORE RUNTIME 1.1 LIVING ENVIRONMENT EXTENSION AUTHORIZED FOR ISOLATED REVIEW**

> **Amendment note (2026-07-31).** The Phase 1 planning language below is retained as the historical founding record. Subsequent Founder reviews approved the CXOS experience direction through Agency Headquarters Phase 6.2. Section 17 now records the Founder-authorized reusable Core Runtime decision. The current gate authorizes only an isolated candidate commit, isolated review-branch push, and protected Preview from the exact production baseline; it does not authorize merge, production integration or promotion, dependency changes, database, auth, billing, or unrelated-room changes.

> **Amendment note (2026-08-01).** Core Runtime 1.1 extends that same headless engine with the Living Environment presentation contract recorded in §17.7. The extension is Founder-authorized only for an isolated Agency Headquarters candidate and protected Preview. It does not create a sibling engine, migrate another room, or authorize merge or production use.

> This document is the constitution: assessment, references, skills, tools, and the Experience
> Grammar, plus the technology recommendation, budgets, plans, risks and roadmap.
> The screenplay lives in `CXOS_SCREENPLAY.md`; the boards in `CXOS_STORYBOARD.md`.
>
> One sentence governs everything below: **the visitor is entering a professional operating
> system, and every scene must earn trust before it earns admiration.**

---

## 1. Repository-grounded assessment

Everything in this program began from what was verifiably shipped at the historical 2026-07-29 `origin/main` baseline (`dfe7a3a`). CXOS
is an evolution of an existing, coherent system — not a blank page.

**Already in production, and load-bearing for CXOS:**

| Asset | Where | CXOS significance |
|---|---|---|
| Brand source of truth | `lib/brand.ts` | Product = CreditVector™, parent = Gabriel Capital Labs, tagline "The Credit Intelligence Operating System", and a **module vocabulary** (BureauIQ · Dispute Engine · Response Intelligence · FCRA Engine, all `live`) — the OS framing already exists in code |
| Design tokens | `tailwind.config.ts` + `app/globals.css` | Navy/blue/teal system: `ink-*` surfaces, `brand-*` blue→teal primary, `ocean-*` depth, `success-*` **reserved for positive outcomes only**, `brand-ink` for AA contrast. CSS-var-backed, theme-aware |
| Typography | `app/layout.tsx` | **Plus Jakarta Sans** as `--font-sans`, spanning display headlines and dense data UI |
| Motion utilities | `app/globals.css` | `.reveal` (with a **CSS-only safety net** that force-reveals at 2.5s if the observer never fires), `.aurora` (18s drift, blurred), `.shine`, `.animate-rise/-fadein/-float/-draw` — **all already gated behind `prefers-reduced-motion`**. The house ease is `cubic-bezier(0.16, 1, 0.3, 1)` |
| Logo hard rule | `components/BrandLogo.tsx`, `.ai/DESIGN-SYSTEM.md` | The **real 3D shield raster** `public/logo-mark.png`. The owner rejected vector recreations. CXOS treats the shield as a *photographed object with mass*, never a redrawn glyph |
| Marketing shell | `components/marketing/` | `SiteNav`, `SiteFooter`, `Showcase` (zig-zag + FAQ + trust bar), `DashboardPreview`, split-screen `AuthLayout`, `LegalShell` |
| Landing | `app/page.tsx` | Static-rendered hero (aurora + grid texture + `animate-rise`), deliberately kept static — `middleware.ts` exists *specifically* so the auth check doesn't force it dynamic. **CXOS must preserve this property** |
| Arena | `app/arena/page.tsx`, `lib/arena/*` | Already live and already honest: own-data progression, XP **only from evidenced activity** ("Nothing is awarded for signing in, posting, or opening pages"), versioned policy, server-authoritative. The Arena constitution asked for below is largely *already enforced in code* |
| Kai identity | `lib/kai.ts`, `.ai/` records | "Credit Intelligence Officer" — calm, evidence-driven, never a chatbot. Shiba mascot is marketing-only |
| Compliance bar | `lib/compliance.ts`, `.ai/COMPLIANCE.md` | CROA constraints scrub letters; **the same bar binds cinematic copy** — no promised outcomes, deletions, or score improvements may appear in any narration |
| PWA + theme | `next-pwa`, `theme-color #060a14` | The app already meets users at OS level; the deepest ink is already the brand's "darkness" |

**Gaps CXOS must fill (verified absences):**

- **No Education destination.** No `app/learn|edu|academy` route exists; education lives inside Kai
  explanations and banners. The Education scene designs a destination that does not yet exist.
- **No "Mission Control" naming.** The authenticated home is `app/dashboard` inside `AppShell`.
  Renaming/reframing is a product decision the Founder must ratify (Decision D-3, §16).
- **No page-transition system.** Motion today is *within-page* (reveal/rise); there is no
  route-to-route transition language and no View Transitions usage.
- **No motion library.** The only animation dependency is CSS. That is a strength to build on, not
  a deficiency to correct (§10).
- **Stale favicon/OG renders** — already a known follow-up in `.ai/DESIGN-SYSTEM.md`; becomes part
  of Phase 2.

**Constraint inherited from the codebase:** `"use client"` pages must not import server modules;
the landing must stay statically renderable; merge to `main` deploys production. Every cinematic
layer must therefore be an *enhancement over server-rendered semantic HTML*, never a gate in front
of it.

---

## 2. Five-reference study

**⚠ Capture disclosure — read first.** This session's environment has **no outbound web access**
(verified: apple.com, linear.app and stripe.com are all unreachable through the egress proxy).
Live capture — scroll video, full-page screenshots, section crops, timing measurement — **could not
be performed and none is claimed**. What follows extracts principles from prior knowledge of these
properties, clearly labelled as such. §2.6 specifies the capture protocol to run when a
network-capable environment (or the Founder's own browser) is available, so the study can be
completed with real artifacts before implementation begins.

### 2.1 Cinematic arrival — Apple (product pages)

**Why this reference:** Apple's product pages are the discipline standard for arrival: a single
object, darkness, light, and restraint. Nothing moves that does not carry meaning.

**Principles to extract (not copy):**
- **One protagonist per scene.** The product is the only lit object; everything else recedes.
  *CreditVector adaptation:* the 3D shield is the protagonist of arrival — photographed object,
  mass and light, never a flat mark.
- **Scroll as the projector.** The user's scroll drives the sequence; the page never plays *at*
  them. *Adaptation:* the public arrival after the (skippable) intro is scroll-scrubbed, user-paced.
- **Type as an object.** Headlines arrive with the same physical language as imagery — they settle,
  they do not bounce. *Adaptation:* `animate-rise` generalised into the "Settle" primitive (§5.8).
- **Silence.** No autoplay audio, ever. Matches CXOS non-negotiables exactly.

**Do not copy:** Apple's minimal-copy strategy. CreditVector is a regulated consumer-finance
education product; it must *explain more*, not less. Evidence density is the brand.

### 2.2 Scroll storytelling — Stripe (stripe.com)

**Why:** the canonical proof that a financial-infrastructure company can feel premium through
typography, gradient light and information design — while remaining fast and semantic.

**Principles:**
- **Light as brand.** The gradient is an identity, not a decoration, and it lives *behind* the
  content plane. *Adaptation:* the existing `.aurora` drift is CreditVector's light; CXOS names and
  disciplines it (§5.5) instead of importing a new one.
- **Diagram-first persuasion.** Stripe convinces with labelled architecture, not adjectives.
  *Adaptation:* the Evidence scene shows a real cross-bureau discrepancy anatomy, labelled, with
  real product vocabulary (BureauIQ, FCRA citations) — never a fake dashboard.
- **Dense footers, calm heroes.** Information density increases as intent increases down the page.
- **Performance as respect.** Stripe animates transforms and opacity only; layout is never
  animated. Adopted as a hard rule (§11).

**Do not copy:** Stripe's iridescent multi-hue ramp. CreditVector's palette rule is navy/blue/teal
with green reserved for success — a *narrower*, more governed light.

### 2.3 Product demonstration — Linear (linear.app)

**Why:** the best-in-class case of the *real product UI* as the cinematic subject. Linear never
shows an illustration where a screenshot of truth will do.

**Principles:**
- **The product is the film set.** Demos are real UI at real density, gently lit and cropped.
  *Adaptation:* `DashboardPreview` already exists; CXOS upgrades it to "the demonstration stage" —
  real Mission Control frames, real letter anatomy, `tnum` data typography.
- **Micro-motion signals quality.** 150–250ms easing on interactive elements communicates
  engineering care better than any headline.
- **Keyboard-visible confidence.** Showing operator affordances (shortcuts, command surfaces)
  signals "built for professionals". *Adaptation:* Mission Control demo shows Kai briefings and
  evidence timelines being *worked*, not admired.

**Do not copy:** Linear's monochrome austerity. CreditVector carries hope as a brand emotion;
the success token exists to be *earned and shown*.

### 2.4 Premium SaaS conversion — Vercel (vercel.com)

**Why:** dark-surface authority, engineering credibility, and the cleanest join-the-platform
conversion mechanics in the category.

**Principles:**
- **The CTA is calm and constant.** One primary action per viewport, always reachable, never
  pulsing. *Adaptation:* "Start free — no card required" already exists; CXOS keeps exactly one
  primary CTA visible per scene, styled `btn-primary`, with the `shine` reserved for hover.
- **Proof adjacency.** Every claim sits next to its evidence (benchmarks, logos, live demos).
  *Adaptation:* claims sit next to *governed* evidence — FCRA citations, the education framing,
  real product surfaces. No fabricated metrics, no invented logos.
- **Pricing as an engineering table.** Dense, truthful, comparable. The existing 7-tier matrix
  with honest "Coming soon" states is already this; CXOS styles it, never spins it.

**Do not copy:** Vercel's developer-insider tone. CreditVector's consumer must feel *invited*, not
tested.

### 2.5 Marketing → product transition — Superhuman (onboarding arc)

**Why:** the strongest known example of the *threshold* — the moment a visitor becomes an operator
— treated as a designed experience rather than a redirect.

**Principles:**
- **The threshold is a scene.** Login → first product frame deserves the same care as the hero.
  *Adaptation:* Scene 12 (Authenticated Transition) — a ≤ 2.5s compression from marketing
  atmosphere into Mission Control, skippable, remembered per user.
- **Continuity of light.** The brand's light source survives the login boundary, so the product
  feels like the *inside* of the thing the marketing showed. *Adaptation:* the aurora persists into
  Mission Control at reduced amplitude (§5.5).
- **First-run is briefing, not tour.** Superhuman teaches by doing. *Adaptation:* Kai delivers a
  first-session briefing — contextual, dismissible, never a modal maze.

**Do not copy:** Superhuman's concierge exclusivity. CreditVector's promise is access and
education, not scarcity.

### 2.6 Capture protocol (to complete this study when network access exists)

For each of the five references, capture from a network-capable environment: desktop 1440×900 and
mobile 390×844 full-page screenshots; a 60fps scroll recording of the full page; section crops at
each narrative beat; DevTools performance trace of initial load; a written observation log covering
typography scale ratios, spacing rhythm, motion durations/easings (read from computed styles),
camera language, and mobile degradation strategy. Store under `design/references/<name>/` (a
future, approved commit) with a one-page principle-extraction per reference. Playwright (already
installed in CI environments) automates all of it. **Principles above are then re-validated or
corrected against the captures — the study is not final until that pass happens.**

---

## 3. Selected design skills

Evaluated against installed reality: `~/.claude/skills` in this environment contains only document
tooling (docx/pdf/pptx/xlsx and internals). **Neither MengTo skills, GSAP skills, nor the Claude
design-skill packs are installed here**, and the gstack referenced by `CLAUDE.md` is absent in this
session. Nothing was adopted on reputation.

| Skill / pack | Decision | Purpose if adopted | When used | When avoided | License note |
|---|---|---|---|---|---|
| `dataviz` (present in session) | **ADOPT — Phase ≥ 2** | Chart/dashboard visual discipline for Mission Control data surfaces and marketing charts | Any chart, KPI tile, or progression visual | Marketing prose pages | Session-provided; no external license |
| `artifact-design` (present) | **ADOPT — review aid only** | Design-calibration reference when producing HTML review artifacts | Founder review packages | Production code | Session-provided |
| MengTo skills (SwiftUI/design) | **DEFER — not installed** | Motion/composition patterns | Only if installed and licensed at implementation | Phase 1 (planning needs none) | **Verify license before any install** |
| GSAP skills | **REJECT for now** | ScrollTrigger patterns | Only if Tier-3 motion (§10) is ever approved | Everywhere else — the tech recommendation makes GSAP unnecessary | GSAP licensing changed over time; verify before adoption |
| Claude design skills (web packs) | **DEFER — not installed** | Component patterns | Implementation phase, selectively | Phase 1 | Verify per-pack |

**Principle:** Phase 1 required zero external skills, so zero were adopted. Each future adoption
must name its purpose, license, and the CreditVector adaptation in the PR that introduces it.

---

## 4. Selected MCP / tool stack

| Tool | Decision | Rationale |
|---|---|---|
| **Playwright MCP / Playwright** | **ADOPT** | Chromium is preinstalled in this environment. Uses: (a) baseline capture of CreditVector's *own* current pages, (b) the §2.6 reference captures once network-capable, (c) visual regression of the grammar during implementation, (d) reduced-motion and mobile-viewport verification as CI checks. Directly improves production quality |
| **Higgsfield MCP** | **ADOPT — narrow, marketing-only** | Available in this session. Permitted: mood frames, atmosphere studies, marketing imagery for storyboard exploration. **Forbidden: any generated product UI, any fabricated dashboard or metric, anything presented as a screenshot of the product.** The mascot stays marketing-only; Higgsfield output never enters Mission Control |
| **Three.js Devtools MCP** | **REJECT** | Not present, and the technology recommendation (§10) requires no WebGL to reach any core functionality. Adding the tool would invite the technology. Revisit only if a Tier-3 "shield hero" experiment is ever separately approved |
| **Stripe MCP** | Out of scope for CXOS | Unauthorized in this session; noted only because billing surfaces appear in the pricing scene — which uses repository truth, not live Stripe |

**Never add technology because it is fashionable** — each adoption above names the production
quality it buys.

---

## 5. The CreditVector Experience Grammar

The grammar is the constitution's core: the rules that make every surface unmistakably
CreditVector. Everything extends what is shipped; nothing contradicts a token.

### 5.1 Typography
- **One family, two voices.** Plus Jakarta Sans throughout. *Display voice*: 600–800 weight,
  tight leading (`1.05` as shipped in the hero), `text-balance`, used only for scene titles.
  *Operator voice*: 400–500, comfortable leading, `tnum` tabular numerals **mandatory for every
  number that represents money, scores, XP or dates**.
- **Scale is narrative position.** The deeper into the product, the smaller and denser the type.
  Marketing peaks at `text-6xl`; Mission Control never exceeds `text-lg` for headers. Density is
  how the product says "you are now an operator."
- **No decorative type ever.** No serifs, no scripts, no stunt fonts — including in Arena.

### 5.2 Composition
- **The 12-column stage.** Marketing composes on `container-x`; scenes alternate a 1.05:1 split
  (shipped hero ratio) with full-bleed evidence panels.
- **One protagonist per viewport.** Every scroll position has exactly one focal object — a
  headline, the shield, a product frame, a piece of evidence. If two things compete, the scene is
  wrong.
- **Asymmetry for narrative, symmetry for authority.** Story sections zig-zag (shipped
  `FeatureSplit`); trust moments (pricing, security, legal) center and symmetrize.

### 5.3 Depth
- **Three planes, never more.** *Atmosphere* (aurora + grid texture, `pointer-events-none`),
  *Content* (the semantic document), *Instrument* (cards and product frames that carry elevation).
  Parallax between planes is ≤ 8px total — perceptible mass, never a ride.
- **Elevation is earned.** Only interactive instruments elevate on hover. Text never floats.

### 5.4 Scale
- **Objects have mass.** The shield renders large and *still*; scale changes are ≤ 4% and slow.
  Nothing pops. Growth communicates approach, not excitement.
- **The zoom is forbidden.** No zoom-through transitions, no dolly-zooms — vestibular safety and
  brand calm agree here.

### 5.5 Lighting
- **One light source: the Aurora.** The shipped `.aurora` (brand/ocean blurs, 18s drift) is
  canonized as the brand's light. It is *weather*, not decoration: present at low amplitude on
  every major surface, brightest at public arrival, dimmest inside Mission Control (opacity ≤ 0.15,
  drift period doubled), and **absent from print, reduced-motion renders as a static gradient**.
- **Darkness is the ground state.** `ink-950` / `#060a14` is where every journey begins. Light
  reveals; it does not flash. Success light (`success-*` green) appears **only** on genuinely
  positive, evidenced states — never in marketing atmosphere.

### 5.6 Color
- The palette rule stands unamended: **navy/blue/teal; green only for success**. CXOS adds one
  discipline: *emotional mapping*. `ink` = ground and calm · `ocean` = depth and process ·
  `brand` (blue→teal) = intelligence and action · `success` = verified positive outcome ·
  `amber/red` families (existing status colors) = honest warning, never drama.
- **No new hues.** Arena prestige is expressed through light, metal-like neutrals and typography —
  never gold-rush yellows or neon.

### 5.7 Camera language
There is no literal 3D camera. "Camera" is compositional attention, executed with transform and
opacity only:
- **Establishing wide** — full-bleed section, atmosphere visible, one protagonist.
- **Push-in** — protagonist scales 1.00→1.04 over ≥ 600ms as it becomes interactive.
- **Rack focus** — plane A blurs/dims (opacity 0.4, blur 4px) as plane B sharpens; used to move
  attention between marketing claim and product evidence.
- **Insert** — a cropped detail (a citation, one tradeline row) fills the stage.
- **Cut** — instant, reserved for user-initiated navigation. The user always outranks the camera.

### 5.8 Motion language — the six primitives
All motion is composed from six named primitives, all transform/opacity-only, all on the house
ease `cubic-bezier(0.16, 1, 0.3, 1)` ("**vector ease**"), all disabled or reduced under
`prefers-reduced-motion`:

| Primitive | Shipped basis | Duration | Meaning |
|---|---|---|---|
| **Settle** | `.animate-rise` | 400ms | An object takes its place. The default entrance |
| **Reveal** | `.reveal` (+ safety net) | 600ms | Content earns visibility as the reader arrives |
| **Draw** | `.animate-draw` | 1.8s | Evidence being traced — underlines, connections, paths |
| **Drift** | `.aurora` | 18s+ | Atmosphere breathing. Never on content |
| **Shine** | `.shine` | on hover | Machined-surface highlight. Interactive only |
| **Focus** | new | 350ms | Rack-focus between planes (§5.7) |

**The 2.5s safety net generalizes:** every choreographed sequence must have a CSS-only fallback
that lands the final frame even if all JavaScript fails. Shipped precedent: `reveal-safety`.

### 5.9 Transition language
- **Within a page:** primitives only.
- **Between pages:** a 240–320ms crossfade-with-settle (View Transitions API where supported,
  instant navigation where not). The aurora persists across the boundary — light is the thread of
  continuity.
- **Across the threshold (login → Mission Control):** the one cinematic transition in the product,
  ≤ 2.5s, skippable by any input, remembered (plays in full once; subsequent logins get the 300ms
  short form). Specified as Scene 12.

### 5.10 Scroll language
- Scroll is *the user's* instrument. Scenes scrub with scroll; nothing scroll-jacks, no section
  snapping on desktop, no hijacked momentum. Sticky stages (a pinned product frame while copy
  scrolls past) are permitted for ≤ 2 viewports at a time and never on mobile.
- Scroll progress may drive Draw primitives (evidence tracing) — the strongest storytelling tool
  in the grammar, and the cheapest.

### 5.11 Audio philosophy
**Silence is the design.** No autoplay audio anywhere, ever. No ambient soundscapes. If a future
feature genuinely requires sound (an accessibility cue), it is opt-in, off by default, and never
essential to meaning.

### 5.12 Interaction philosophy
- Every interactive element answers in ≤ 150ms with a state change.
- Hover is enhancement; every interaction is fully specified for touch and keyboard first.
- The keyboard is an operator's instrument: visible focus (`:focus-visible`) styled with brand
  tokens, logical order, skip links on every marketing page.
- Nothing moves *toward* the cursor. Instruments respond; they do not perform.

### 5.13 Empty states
An empty state is a **briefing, not an apology**: what this surface will show, what evidence
produces it, and the single next action. Kai's voice, one sentence, one button. (Shipped
precedent: Arena's "No XP yet. Only evidenced activity counts…" — that is the house tone.)

### 5.14 Loading philosophy
- **Never fake progress.** No indeterminate spinners longer than 400ms; skeletons mirror the true
  layout of what is coming.
- Real work (Kai analysis) shows *what is actually happening* in plain language, because the work
  is genuinely being done — visible truthful process is a trust asset. **No fabricated "thinking"
  theatre**, no artificial delay, ever.

### 5.15 Error philosophy
Errors state: what happened, what it means for the user, what is safe to do next — in human
sentences, without Stripe/internal identifiers (shipped precedent: the self-cancel route's
failure copy, corrected in Wave 2.4 to never claim knowledge it lacks). The same honesty bar binds
every surface: **an error message may not assert a state the system cannot observe.**

### 5.16 Reduced-motion philosophy
`prefers-reduced-motion` receives the **same narrative with the motion removed**, not a lesser
site: final-frame compositions, static aurora gradient, instant transitions, Draw rendered as
already-drawn. Information parity is a hard requirement; it is also the print philosophy and the
low-power philosophy. Reduced Motion is Scene 15 of the screenplay — a first-class experience,
designed, not derived.

### 5.17 Mobile philosophy
- Mobile is the *majority* arrival and is designed first for every scene.
- No pinned stages, no parallax, intro shortened to ≤ 6s, tap targets ≥ 44px, thumb-reach primary
  actions, `dvh` units for stable composition.
- Performance budget is set on mid-tier Android (§11), not on a MacBook.

---

## 10. Technology recommendation

**Three tiers; core functionality requires only Tier 1. Nothing requires WebGL, Three.js, video,
GSAP or Rive — this satisfies the non-negotiable by construction.**

| Tier | Technology | Used for | Requirement |
|---|---|---|---|
| **1 — Foundation** | Semantic HTML + existing CSS tokens/utilities, CSS scroll-driven animations where supported, IntersectionObserver reveals (shipped), `next/font`, `next/image` | Everything. The entire narrative is readable and navigable at this tier | **Mandatory; always works** |
| **2 — Enhancement** | Web Animations API for choreographed sequences (intro, threshold transition), View Transitions API for route crossfades, `sessionStorage` for intro memory | The cinematic layer | Progressive; feature-detected; absence is invisible |
| **3 — Experiment (NOT approved)** | WebGL shield rendering, Lottie/Rive vignettes | Nothing currently | Requires separate Founder approval + its own performance case |

**Explicitly rejected for core:** GSAP (Tier 1+2 cover every specified motion; adds bytes and a
license question), Three.js (no approved 3D), autoplay video (bytes + silence rule), Lottie for
core UI (JSON animation bytes vs CSS). **Framer Motion: not adopted**; the primitive set is six
CSS/WAAPI patterns and a dependency would outweigh them.

The intro is a **DOM timeline**: real headline, real shield image, real tokens, animated with
WAAPI — so it is skippable mid-frame, reduced-motion collapses it to its final frame, SEO sees
the real content, and zero cinematic bytes precede LCP.

---

## 11. Performance budget

| Metric | Budget | Note |
|---|---|---|
| LCP (marketing, mobile P75) | **≤ 2.5s** (target 1.8s) | LCP element is the real hero headline or shield `next/image` — never an intro asset |
| First Meaningful Paint | Before any intro frame | The intro plays *over* painted content, never instead of it |
| CLS | < 0.1 | All motion transform/opacity-only; layout is never animated |
| INP | < 200ms | Skip control must respond < 100ms |
| Intro duration | 8–12s desktop · ≤ 6s mobile · **0s** reduced-motion/returning | Skippable at any frame by any input; remembered in `sessionStorage` |
| Marketing JS (gz) | ≤ 170KB total; cinematic layer ≤ 25KB of it | Tier-2 code lazy-loaded post-LCP |
| Cinematic assets | ≤ 300KB above the fold; aurora is CSS (0 bytes) | Shield raster served AVIF/WebP via `next/image` |
| Test device | Mid-tier Android, throttled 4G | Budgets verified there, not on desktop |
| Regression gate | Playwright + Lighthouse CI on every experience PR | Failing budget blocks merge |

---

## 12. Accessibility plan

- **WCAG 2.2 AA** across every scene; AA contrast is already a stated repo requirement
  (`brand-ink` exists for it) — CXOS inherits and extends it to all new compositions.
- **Reduced motion:** §5.16 — full information parity, verified per scene in review, automated as
  a Playwright check (`prefers-reduced-motion` emulation, assert final-frame content present).
- **Intro:** skippable by click/tap/key/scroll; skip control is the *first* focusable element;
  `aria-live="polite"` announces "Introduction — press Escape to skip"; no flashing content
  (≤ 3 flashes/sec, WCAG 2.3.1); no essential information exists only in the intro.
- **Keyboard:** full traversal of every scene; visible focus; skip links; focus is *managed*
  across route transitions (moved to the destination's h1, not lost to `body`).
- **Screen readers:** the cinematic layer is `aria-hidden` decoration over a complete semantic
  document; scene narration exists as real headings/paragraphs in DOM order.
- **Vestibular safety:** no parallax beyond 8px, no zoom-through, no scroll-jacking — grammar
  rules, restated here as a11y guarantees.
- **Audio:** none, so no captions burden; if opt-in audio ever ships, captions ship with it.

---

## 13. SEO plan

- **The intro never gates content.** Every marketing page remains server-rendered semantic HTML;
  crawlers see the full narrative as headings and copy. The landing **stays static** (preserving
  the shipped middleware design).
- **Per-destination metadata:** unique title/description per scene-page; OG/Twitter images
  regenerated as part of Phase 2 (fixing the known stale-render follow-up).
- **Structured data:** `Organization` + `WebSite` on the landing; `Product`/`Offer` on pricing
  (truthful tiers only — "Coming soon" tiers carry no `Offer`); `FAQPage` on the existing FAQ.
- **Performance is ranking:** the §11 budgets are also the Core Web Vitals SEO strategy.
- **No cloaking risk:** reduced-motion, no-JS and crawler experiences are the *same document* —
  the progressive-enhancement architecture makes this true by construction.
- **Compliance meets SEO:** metadata copy is bound by the same CROA bar — no "credit repair",
  no outcome promises in titles/descriptions.

---

## 14. Production risk assessment

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Cinematic copy drifts past the CROA bar** (narration promising outcomes) | **Critical** | Every scene's narration passes `/compliance-review` before implementation; the screenplay already writes narration to the education bar |
| R2 | **Intro damages LCP/conversion** | High | Architecture makes intro post-LCP by construction; A/B the intro's presence itself; budgets gate merges |
| R3 | **Intro fatigue** for returning users | High | Play once per session/user; 300ms short form thereafter; "replay" affordance in footer |
| R4 | **Scope creep into implementation before approval** | High | This package is planning-only; the stop condition is contractual; implementation prompts only after Founder sign-off |
| R5 | **Brand fragmentation** — destinations drift into separate visual products | Medium | The grammar is canonical; per-destination atmospheres vary only §5.5 lighting amplitude and §5.1 density, nothing else |
| R6 | View Transitions API support gaps | Low | Tier-2 progressive; absence = instant navigation, which is the current behavior |
| R7 | **Reference study incomplete** (no live captures this session) | Medium | §2.6 protocol runs before implementation; principles re-validated against captures |
| R8 | Landing forced dynamic by experience code | Medium | Static rendering is a stated acceptance criterion of Phase 3; CI check asserts it |
| R9 | Mascot leaks into product surfaces | Low | Grammar rule + review checklist item; mascot assets live only under marketing paths |
| R10 | Arena reads as gamified/casino under new styling | Medium | Arena scene styled from the *existing honest mechanics* (evidence-only XP, versioned policy); no countdowns, no scarcity, no jackpot light |

---

## 15. Implementation roadmap (post-approval; each phase behind the five-review gate)

| Phase | Scope | Exit criterion |
|---|---|---|
| **0** | Baseline: Playwright capture of every current page (desktop/mobile/reduced-motion); Lighthouse baselines; §2.6 reference captures | Baseline report committed |
| **1** | **This package** — Founder review | Founder approval of grammar + screenplay |
| **2** | Grammar codification: token additions (Focus primitive, lighting amplitudes, transition durations), OG/favicon regeneration, motion utilities extended in `globals.css` | Tokens shipped; zero visual regression on existing pages |
| **3** | Public arrival: landing rebuilt per Scenes 1–10 (static, budget-gated, intro as Tier-2 layer) | Budgets green; conversion not degraded; compliance sign-off on all copy |
| **4** | The threshold: auth pages per Scene 11; Scene 12 transition; Mission Control arrival (Scene 13) | Transition ≤ 2.5s, skippable, remembered; dashboard functionality untouched |
| **5** | Arena entry (Scene 14) + agency/consumer arrival differentiation | Arena mechanics byte-unchanged; styling only |
| **6** | Education destination (net-new product surface — needs its own product definition first) | Separate product review before design implementation |

Sequencing rule: **no phase begins until the prior phase's budgets and reviews are green.**

---

## 16. Founder review package — the decisions only you can make

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D-1 | Approve the Experience Grammar (§5) as constitutional | approve / amend | Approve; it codifies what's already shipped |
| D-2 | Approve the screenplay (`CXOS_SCREENPLAY.md`) | approve / amend scenes | Approve with any narration edits — narration is yours |
| D-3 | **"Mission Control" naming** — rename the authenticated home? | keep "Dashboard" / adopt "Mission Control" | Adopt; the OS framing already exists in `lib/brand.ts` |
| D-4 | Intro existence on the public landing | ship / A-B test / skip | **A/B test** — R2 is real; let data decide |
| D-5 | Education destination | commission product definition / defer | Commission — it is the only missing destination |
| D-6 | Tier-3 experiments (WebGL shield) | reject / sandbox later | Reject for now; revisit after Phase 4 ships |
| D-7 | Storyboard fidelity | proceed from `CXOS_STORYBOARD.md` drafts / commission visual comps first | Proceed; boards are implementation-ready once D-1/D-2 approve |
| D-8 | Reference capture | run §2.6 yourself / authorize a network-capable session | Either; required before Phase 3 |

**Historical Phase 1 stop condition:** at the time of this founding record, nothing had been implemented and implementation awaited the listed decisions. That condition was later superseded by explicit Founder approvals; it is not current release evidence.

---

## 17. CXOS Core Runtime amendment

**APPROVED DIRECTION · FOUNDER-AUTHORIZED 2026-07-31 · ADR-0040**

Agency Headquarters Phase 6.2 proved the facility model and is architecturally approved. Remaining platform-wide experience mechanics must be implemented once as shared infrastructure rather than independently recreated by each room.

### 17.1 Runtime capability set

CXOS Core Runtime owns exactly these presentation capabilities:

1. Arrival Runtime
2. Departure Runtime
3. Environmental Heartbeat Runtime
4. Spatial Transition Runtime
5. District Runtime
6. Scroll Activation Runtime
7. Environmental Lighting Runtime
8. Atmospheric Runtime
9. Kai Presence Runtime
10. Shared Motion Runtime
11. Shared Accessibility Runtime

The runtime is headless. It coordinates deterministic lifecycle and projects semantic state; it does not render a generic room, choose copy, draw charts, own fixtures, calculate metrics, or perform product actions.

### 17.2 Ownership boundary

| Core Runtime owns | Each room continues to own |
|---|---|
| Capability-tier fail-down and explicit static projection | Canonical data and source receipts |
| Arrival, settled-operation, and departure phase | Semantic DOM and room composition |
| Visibility pause and bounded motion state | CSS, light geometry, and atmosphere rendering |
| Passive district activation and native-scroll focus movement | District purpose, order, headings, and instruments |
| Environmental heartbeat, lighting, atmosphere, and Kai-presence state tokens | Heartbeat facts, displayed values, Kai wording, and command behavior |
| Reduced-motion/static equivalence policy and bounded fail-open handoff mechanics | Destination and route semantics, actions, permissions, persistence, APIs, and owning services |

The runtime is not GIOS, the Kai Kernel, a router, an application service, an event fabric, a data store, an auth layer, or an execution broker. Kai Presence Runtime means only bounded presentation presence and district context. It grants no memory, inference, model access, customer knowledge, or action authority.

### 17.3 Fail-closed law

> Truth and motion fail closed to the complete static document. Navigation fails open to the real local destination. The runtime may project state; it may never own facts or effects.

- Invalid room, district, arrival, motion-budget, or departure definitions resolve to complete Tier D static state.
- Capability detection failure, Data Saver, or low-memory safety never upgrades motion.
- Reduced motion is automatic and complete. A Founder-review cinematic projection requires explicit route-instance consent and is never persisted.
- Missing `IntersectionObserver` preserves the full native document and explicit district navigation.
- Hidden documents pause nonessential motion.
- A cinematic departure may intercept only an unmodified primary click, commit at most once, and use one bounded local-navigation fallback. Static, constrained, modified, new-tab, and download interactions remain native.
- The runtime performs no fetch, API call, storage operation, cookie access, database read/write, model call, telemetry, calendar/task/customer mutation, or environment-variable/deployment-config read or write.

### 17.4 Motion and performance law

- A motion-capable room declares one to three continuous transform/opacity motion channels; Tier C, Tier D, reduced-motion, and invalid projections activate zero.
- Semantic heartbeat signals may be numerous, but they never become changing canonical values merely to create motion.
- No Canvas, WebGL, video, audio, external animation dependency, self-running JavaScript frame loop, layout animation, scroll hijack, or sustained settled-state CPU work belongs in the runtime.
- `IntersectionObserver` may update the current semantic district. It may not capture wheel/touch input or replace native scrolling.
- Lighting and atmosphere are bounded semantic tokens consumed by room CSS, not globally rendered effects.

### 17.5 Accessibility law

- The semantic document exists before and without runtime enhancement.
- Arrival skip, Escape settlement, replay, district movement, departure, and review-control close preserve explicit focus targets.
- Tier C, Tier D, reduced motion, invalid configuration, and enhancement failure preserve the complete facts, actions, disclosures, reading order, and destinations.
- The runtime supplies state; each room remains responsible for one `<main>`, one `<h1>`, ordered headings, visible focus, ≥44 px controls, readable contrast, zero horizontal overflow, and truthful live-region copy.

### 17.6 Adoption law

Agency Headquarters is the first reference consumer because it contains the complete approved lifecycle without requiring a visual redesign. Its semantic structure, room-specific CSS and visual output, fixtures, Kai resolver, instruments, and production hard-off remain room-owned.

Mission Control, the Passage, the Arena, the landing journey, Consumer Workspace, Marketplace, Community, Growth Network, and future rooms remain unchanged in this phase. A later room may adopt Core Runtime only through a separately scoped migration that preserves its architecture, reruns its existing regression guard, adds current browser evidence, and receives the required reviews. No wholesale room rewrite or historical-branch merge follows from this amendment.

### 17.7 Core Runtime 1.1 Living Environment contract

**APPROVED DIRECTION · FOUNDER-AUTHORIZED 2026-08-01 · ADR-0040 AMENDMENT**

Core Runtime 1.1 is an additive contract on the one Core Runtime defined above. A Living Environment is a room whose presentation responds to declared, deterministic room state while preserving the complete semantic experience. “Living” describes bounded, purpose-linked presentation response; it does not mean live data, autonomous behavior, simulated computation, random activity, consciousness, or effect authority.

- The room may declare compositional camera/framing, no more than three depth planes, lighting, purpose-bound heartbeat/idle, focus/concentration, Kai presentation phase, and transition profiles. These are semantic presentation inputs, not a literal 3D camera or a globally rendered scene.
- Core Runtime validates those declarations and projects capability, lifecycle, visibility, motion-budget, focus, Kai-presence, and static-equivalence state. Room CSS may consume the resulting tokens; the runtime still renders no room UI.
- The room continues to own canonical facts, copy, semantic DOM, destinations, fixtures, instruments, CSS, actions, permissions, persistence, APIs, and every Kai intent or effect. No presentation profile may change or imply any of them.
- Motion must make an existing condition, transition, or hierarchy easier to understand. It may not fabricate work, urgency, system activity, customer state, model activity, or a changing metric merely to make the room appear alive.
- Invalid profiles or targets resolve deterministically to the room's complete declared static projection. Reduced-motion and constrained tiers use that same complete projection; hidden documents pause nonessential motion. User input, visible focus, native scrolling, and native navigation always outrank ambient presentation.
- Agency Headquarters remains the sole reference consumer for this extension. Every other room remains unchanged unless separately scoped, reviewed, evidenced, and Founder-authorized.

The normative vocabulary and grammar live in `CXOS_LANGUAGE_1_0.md`; the architectural decision and release boundary live in ADR-0040. This amendment authorizes an isolated candidate, isolated review-branch push, and protected Preview only. It is not merge, production integration, promotion, or platform-wide migration approval.
