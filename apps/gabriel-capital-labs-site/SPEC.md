# Gabriel Capital Labs — Cinematic Institutional Website · Implementation Spec v1

Coordinator-authored spec. Repository truth verified 2026-08-05. This app is FULLY ISOLATED
from the CreditVector production app at the repo root: own package.json, own node_modules,
own build. Root tsconfig excludes `apps/`. Never import from the root app; never modify root files.

## Architecture decision (locked)
- Location: `apps/gabriel-capital-labs-site/` — self-contained Next.js 14.2.18 App Router app,
  **static export** (`output: "export"` in next.config). No server runtime, no API routes, no DB.
- Deployed later as a SEPARATE Vercel project (Root Directory = `apps/gabriel-capital-labs-site`).
  The root CreditVector Vercel project ignores this directory entirely.
- Dependencies (keep minimal): next@14.2.18, react@18, react-dom@18, gsap (ScrollTrigger),
  typescript + types. Dev-only: sharp (asset pipeline script). **No three.js / WebGL** — the
  canonical mark is a photographic render; light and depth are done with layered imagery,
  CSS, and GSAP. No Tailwind — hand-rolled CSS with custom properties (tokens) for an
  editorial, non-template feel. CSS Modules or plain global CSS with BEM-ish section scoping.
- Fonts: Inter via `next/font/google` (weights 200/300/400/500; Inter is SIL OFL licensed —
  approved optical equivalent of "Inter Display"). Wordmark styling: uppercase, letter-spacing ≈ .28em, weight 300.

## Canonical brand (LOCKED — violations fail review)
Source assets in `./brand/` (already staged):
- `brand/canonical/GatewayG_Canonical_Material_Transparent.png` — the mark alone, transparent. THE hero object.
- `brand/canonical/GatewayG_Canonical_Mark_Dark_1254.png` — mark in dark environment.
- `brand/web/*` — heroes (2560/1920/mobile 1080x1920), header/footer lockups, OG 1200x630, X card,
  favicon set (favicon.ico, apple-touch-icon, android-chrome 192/512), tokens json/css.
Rules: never redraw/stretch/compress/skew/recolor the mark; it moves only as ONE rigid object
(scale/translate/opacity/masking allowed; no rotation in 3D, no morph, no fragmentation);
no decorative gold line inside the gateway; gold (#D4A146) is illumination + accent only.

Palette tokens: deep-obsidian #060608 · obsidian #0B0D10 · charcoal #0F1012 · stone-silver #B7B7B7 ·
steel #A7A9AC · platinum #E6E6E6 · gateway-gold #D4A146.

## Asset pipeline (write `scripts/optimize-images.mjs`, run once, commit outputs)
Using sharp, generate into `public/img/`:
- From `GatewayG_Canonical_Material_Transparent.png`: WebP + PNG fallback at widths 480, 768, 1080 (transparent kept).
- From heroes: WebP variants at 960, 1440, 2560 (desktop) and 720, 1080 (mobile portrait); quality ~72.
- Copy favicons/OG/X-card/footer-lockup as-is into `public/` (og at /og.jpg 1200x630).
Use `<picture>`/srcset + explicit width/height everywhere (zero CLS). Preload only the LCP image.

## Page structure — ONE continuous page (`app/page.tsx`), chapters as full-bleed scenes
Semantic: `<header>` (minimal fixed nav, appears after arrival), `<main id="content">` with one
`<section>` per chapter (aria-labelledby real headings h1→h2 hierarchy), `<footer>`.
"Skip to content" link first in DOM. Anchor nav: #institution #mission #ecosystem #lab #principles #contact.

All copy lives in `content/site.ts` (typed config) — presentation separated from content.
Approved public contact destinations are explicit typed `mailto:` values in `content/site.ts`:
general institutional, partnerships, media, careers, legal, security, and support. The static export
does not depend on a contact environment variable and must not invent or fall back to an address.

### Chapter 1 — ARRIVAL (100svh, sticky scene)
Sequence (first visit only, ~5.5s, GSAP timeline, then releases into scroll):
1. Pure #060608 darkness (0.4s).
2. A soft golden glow blooms low-center (radial gradient layer, the "gateway floor light"), 0.8s.
3. The transparent-material Gateway G fades/resolves upward out of darkness as ONE rigid object
   (opacity 0→1 + subtle scale 1.04→1.0 + slight y drift; NO rotation/morph), 1.6s.
4. Wordmark types nothing — it APPEARS as tracking settles: "GABRIEL" (platinum, wide tracking)
   then "— CAPITAL LABS —" (gold rules + gold-tracked text), 1.2s.
5. Tagline lines fade in sequentially: "Building Intelligent Infrastructure." / "Engineering the
   Future of Intelligence." (steel), 1s. 6. A minimal scroll cue (thin vertical line + "ENTER") fades in.
Controls: "Skip" button (visible from t=0, top-right, focusable, min 44px target) jumps timeline to end.
"Replay" control lives in the footer + a small control near the hero once complete.
Persistence: sessionStorage flag `gcl-arrival-seen` → on repeat visits render the completed
composition immediately (no replay); in-page anchor nav never replays it.
Reduced motion (`prefers-reduced-motion`): no timeline at all — the full composed scene renders
statically with everything visible. All arrival info exists as real DOM text (SEO + a11y).
First scroll: the hero scene is pinned briefly (ScrollTrigger pin, SHORT — max ~60vh of scroll)
while the mark scales down slightly and the scene dims/parallaxes out — a camera pull-back —
then normal document flow. Never trap scroll; native scrolling only (no Lenis, no scroll-jacking).

### Chapter 2 — THE INSTITUTION
Full-bleed editorial scene, obsidian → charcoal gradient shift. A monumental oversized numeral/rule
system ("01 — The Institution" chapter markers used consistently across chapters, hairline rules,
Swiss grid). Large display statement (staggered line reveal on scroll):
"Gabriel Capital Labs is the parent institution behind intelligent infrastructure —
operating systems for credit, intelligence execution, and spatial computing."
Supporting editorial paragraph (2–3 sentences from content config re: long-term thinking, research,
disciplined engineering, enduring value). Use asymmetric grid, huge whitespace, hairline vertical
rules that extend/draw as you scroll (motion = structure). NO cards.

### Chapter 3 — MISSION ARCHITECTURE
Three pillars: INTELLIGENCE / INFRASTRUCTURE / IMPACT (copy verbatim from build brief, in content config).
Presentation: NOT three side-by-side cards. Build a vertical sequential architecture: each pillar is a
full-width band; a single continuous thin gold line (SVG path, drawn by scroll progress) descends the
chapter connecting pillar to pillar — intelligence flows into infrastructure flows into impact. Pillar
titles huge (display size), definitions editorial. On desktop the three bands offset alternately
(left/right asymmetry); on mobile they stack with the connecting line down the left margin.

### Chapter 4 — ECOSYSTEM ARCHITECTURE
One parent institution, four domains. Presentation: a vertical sequence of full-width "wings" —
each domain its own architectural room with its own restrained identity, entered by scroll:
- CreditVector — The Credit Operating System — status: **Active platform** (live at www.creditvector.app;
  the ONLY external product link, plain text link).
- GIOS — The Operating System for Intelligence Execution — status: **Platform foundation — in development**.
- HELIOS — Spatial Operating Environment — status: **Research program**.
- Kai — Chief Intelligence presence across products — status: **Active within CreditVector; expanding across the ecosystem**.
Do NOT imply public availability beyond this. No screenshots, no fake UI, no invented metrics.
Wings separated by clip-path/inset reveals; each wing: chapter-consistent numeral, name in wide-tracked
display type, one-line designation, status line (small caps, steel), 1–2 sentence description.

### Chapter 5 — THE LAB
Research/engineering environment feel: a two-column editorial index (like a research institute's
programme list): the seven research/build domains from the brief rendered as a numbered index
(01 Intelligent operating systems … 07 Human-centered intelligence augmentation), each row a hairline-ruled
line that reveals sequentially. Background: very subtle blueprint-grid (CSS, near-invisible, ≤3% opacity).
No fake data, no fake terminals, no decorative code.

### Chapter 6 — PRINCIPLES
The five: Intelligence—We seek truth. / Infrastructure—We build enduring systems. / Innovation—We create
the future. / Integrity—We do what is right. / Impact—We compound value.
Presentation: controlled editorial sequence — a sticky scene where principles succeed one another as
large centered statements (scroll-driven crossfade, one visible at a time), with a 1/5…5/5 progress
hairline. Reduced motion / no-JS: all five render as a static editorial list. Keep the pinned distance
moderate (~2.5 viewport heights total) so users are never trapped.

### Chapter 7 — ENGAGEMENT + FOOTER
Restrained invitation: "Enter the future we are engineering." as the closing display statement over a
final, dimmer recurrence of the gateway glow (light motif returns; the mark itself may recur small and
exact — use the 512 transparent asset). Engagement categories are a simple editorial list (General
institutional inquiry · Partnerships / strategic relationships · Media / press · Careers · Legal ·
Security reports · Support), each pointing to its approved explicit `mailto:` destination. Footer: footer lockup asset
(small), "Gabriel Capital Labs, LLC" legal line, © year, Replay-arrival control, quiet link to
www.creditvector.app. No invented address/phone/socials.

## Motion constitution
GSAP + ScrollTrigger only. Native scroll. Every animation communicates structure/discovery.
Durations 0.6–1.2s, ease "power2.out"/"power3.inOut". Parallax subtle (≤8%). All ScrollTriggers
use `once` where appropriate; no infinite loops except the (paused-when-offscreen, opacity-pulse-only)
scroll cue. Everything gated behind `prefers-reduced-motion` via `gsap.matchMedia()` — reduced motion
= full static composition, zero pins. All pinned distances short. will-change used sparingly; only
transform/opacity animated (compositor-only).

## SEO / metadata (app/layout.tsx + companions)
- title: "Gabriel Capital Labs — Building Intelligent Infrastructure."
- description from tagline+thesis. metadataBase + canonical: https://www.gabrielcapitallabs.com
- OpenGraph (og.jpg 1200x630), twitter card (summary_large_image, X card asset), full favicon set,
  theme-color #060608. robots.txt + sitemap.xml as static files in public/ (static export), single URL.
- JSON-LD Organization: name "Gabriel Capital Labs", legalName "Gabriel Capital Labs, LLC",
  url, logo (absolute URL to 512 icon), slogan (tagline). NOTHING else (no address/founders/socials).
- `<html lang="en">`, landmarks, single h1 (visually the wordmark block in Chapter 1).

## Accessibility (mandatory)
Skip-to-content; visible :focus-visible outlines (gold 2px offset); all controls keyboard-operable,
≥44px touch targets; contrast: body text #B7B7B7+ on #060608 (≥7:1), steel only for large text;
aria-labels on icon-only controls; no info conveyed by motion alone; reduced-motion complete;
decorative images alt="" — the hero mark gets a real alt ("The Gateway G — the monolithic mark of
Gabriel Capital Labs, golden light rising from its open gateway floor").

## Performance budget
LCP < 2.5s mobile (arrival glow + wordmark are text/gradient — cheap; preload the hero mark WebP),
zero CLS (explicit dimensions), Lighthouse mobile ≥85 perf / ≥95 a11y / ≥95 BP / ≥95 SEO.
gsap imported normally (small); no other client JS. Images lazy except hero. Font display: swap
with size-adjust fallback.

## Definition of done for the implementation agent
`npm install` + `npm run build` (static export) succeed inside this directory; `npm run typecheck` clean;
`npx next lint` clean (add minimal eslint config extending next/core-web-vitals);
root `npm run typecheck` still clean; export output in `out/` serves correctly via `npx serve out`.
Report back: file inventory, deviations from spec (with reasons), anything unverifiable.
