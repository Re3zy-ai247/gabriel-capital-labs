# Gabriel Capital Labs — Cinematic Institutional Website v1
**Build + adversarial-review handoff report** · 2026-08-05 · Branch `claude/gcl-cinematic-institutional-site-6qx964`
**Revision R3 (2026-08-06): The Third Motion Class — reduced-motion cinema, READY WITH DISCLOSURES — see §R3 at the top.** R2 and v1 follow as historical record. The original v1 report follows unchanged as historical record.

---

## R3 · The Third Motion Class — Reduced-Motion Cinema (Founder round 3, 2026-08-06)

**Founder verdict on R2:** desktop still NOT Founder-ready — no cinematic feeling, Replay Arrival
does not function, Mission centre line reads as a divider, desktop pacing uneven. Mobile excellent.
**R3 outcome: READY WITH DISCLOSURES** (final adversarial gate, independently reproduced).

### R3.1 Root cause — the desktop cinema was never reachable on the reviewing machine

R2 built a genuine cinematic desktop architecture and verified it against a local static export.
It works. The Founder has never been able to see it.

Every desktop scene R2 authored is gated behind
`(min-width: 1024px) and (prefers-reduced-motion: no-preference)`.
The reviewing Mac has **macOS Reduce Motion switched on system-wide**, so on that machine the query
is `false` and *none* of the cinematic layer executes. Measured live on the deployed R2 preview
(commit `e732ebe`) at 1440×900:

| Condition | desktop motion query | ScrollTrigger pins | document height |
|---|---|---|---|
| `reduce` — **what the Founder sees** | `false` | **0** | 9,999px (11.11 viewports) |
| `no-preference` | `true` | **4** | 13,132px (14.59 viewports) |

Eleven viewports of uninterrupted linear scrolling with zero pinned scenes is precisely
"scroll → content → scroll → content". The desktop code was never the problem; its reachability was.

This also explains the desktop/mobile split cleanly. Mobile was reviewed on a phone without Reduce
Motion, so mobile ran its full motion path and felt smooth and premium. The Founder was not
comparing two designs — they were comparing motion-on against motion-off.

R2's response to this (§R2.7) was a note asking the Founder to change an OS accessibility setting.
That was the wrong remedy. An institutional site must be cinematic *for reduced-motion visitors
too* — they are real visitors, and one of them is the Founder.

### R3.2 Every remaining Founder defect traces to that one cause

Measured on the deployed R2 preview under `reduce` at 1024–1920:

| Founder defect | Status under `reduce` at R2 | Evidence |
|---|---|---|
| Institution gold line crowds copy | Already fixed, both paths | Min clearance 58px @1440, 72px @1920; zero overlap |
| Engagement rows / footer alignment | Already fixed, both paths | One shared label x at every width; row spread 1px; `.footer__inner` edges equal `.engagement__categories` exactly at all 5 widths |
| Mission centre line reads as a divider | **Was still live** | `.mission__connector` computed `display:block` under reduce — 2px × 1170px at dead centre, 80.2% of the section height. Hidden only inside the no-preference CSS block |
| Desktop spacing: empty vs compressed | **Was still live** | Cinematic chapters collapsed to ~half their scroll budget (arrival 0.67 vs 1.56 viewports, mission 1.56 vs 2.67); list chapters unchanged — that uneven collapse is the pacing complaint |
| Replay Arrival does not function | **Was still live** | The reduce branch ran `timeline.progress(1)` — a jump to the *finished* state, i.e. the state already on screen. A visible no-op |

### R3.3 The fix — a third motion class

Under `(min-width: 1024px) and (prefers-reduced-motion: reduce)` the site now runs **the same scene
architecture** as the full path — same chapters, same 4 pins, same sequencing, staging, depth
ordering and hand-off — expressed only through vestibular-safe channels:

- **Allowed:** opacity, colour/luminance, rule opacity/weight, scroll-position hold (pinning) —
  all scroll-driven, therefore user-controlled.
- **Forbidden:** translate, scale, rotate, skew, parallax, drift, clip-path wipes, autoplaying
  movement.

This is a considered accessibility position (WCAG technique C39 recommends replacing motion with
cross-fades; pinning *holds content still* while the user scrolls), not a loophole. The policy
lives in one file — `lib/motion.ts` (`reveal()` strips spatial keys; `pinEnd()` scales pin budgets
to ~0.6×) — so the two paths cannot drift apart structurally. Six of seven chapters animate a
second channel beyond opacity (gold rule fills, pillar/heading luminance, hairline colour,
border-weight crossfades), verified by a 20px-step sweep of the whole document.

Replay Arrival now actually replays in both policies: session reset, initial opacities restored,
awaited scroll-to-top, staged ladder replay, focus restored to the control, `role=status`
announcements, repeatable indefinitely.

### R3.4 Four adversarial waves — verdict trail

Per the engineering constitution (Sonnet implements, Opus reviews adversarially, verification
reproduces reviewer checks), R3 took four waves to converge:

| Wave | Outcome |
|---|---|
| 1 · Implementation | Third motion class built; first verification reported all-green — **falsified by review** |
| 2 · Review round 1 | 3 reviewers: NOT_READY, 24 findings (3 blockers: Principles a11y-tree removal, `/#contact` blank page, Principles overlap pile-up) |
| 3 · Remediation + review round 2 | Craft improved; **2 new blockers introduced and caught** (ENTER cue invisible, Gateway G dimmed by a stage `brightness` filter — reverted entirely), plus a mobile inline-style leak. NOT_READY |
| 4 · Surgical wave + final gates | ScrollTrigger crash root-caused in GSAP internals (sync-refresh triggers desyncing the `_triggers` walk-back on hash loads) — fixed via timeline hosting, 72/72 deep-link runs clean, then 60 more at 6× CPU throttle. Gate 1: NOT_READY (Mission connector regression + numeral leak). Exact patches applied. **Gate 2: READY_WITH_DISCLOSURES, shippable** |

Key verified numbers from the final gate (all independently re-measured against a `git archive`
baseline, never trusting fixer reports):

- Zero console errors across 36+ deep links (6 hashes × widths × both policies); landing accuracy
  0.00–0.42px from the 84px nav offset (was 540–3891px short).
- Gateway G: `filter`/`backdrop-filter`/`mix-blend-mode` = none across the mark's entire ancestor
  chain at 84 sampled states in 6 configurations; nav-mark luminance matches baseline to 0.6%.
- Mission: connector segments draw 0→1 through the pin on the full path and survive mid-pin
  resize; dominance invariant holds at 41/41 samples under reduce (no two pillars ever both
  >0.45 opacity); numerals correct at 39/39 crossing samples — **including a baseline bug on the
  no-preference crossing (39/39 "00" leaks at baseline) now clean**.
- Mobile 320/390/768: pin counts 0 (reduce) / 2 (no-preference) — identical to baseline; fresh-load
  screenshots pixel-identical (residual 25px noise proven to be nondeterministic rasterisation by
  diffing the baseline against itself); zero inline-style leaks across 39-point crossing maps in
  both policies; focus listeners constant across 3 breakpoint round-trips.
- Full-motion parity vs the Founder-approved baseline: pixel-identical at rest except the four
  named divergences below.
- `tsc` / `lint` / `build` clean.

### R3.5 Founder-confirm items (the four full-motion divergences)

The full-motion desktop path differs from the R2-approved baseline in exactly four ways, each a
deliberate fix, each awaiting Founder confirmation:

1. **ENTER cue timing** — the cue no longer pops back to full opacity if the visitor scrolls
   mid-intro; a visitor who nudges and returns to top still gets it.
2. **Mission dwell** — a held, fully-resolved frame before pin release (fixes the dead-scroll gap
   into Ecosystem); beats land ~29% earlier within the same pin budget. If the pacing feels wrong,
   the alternative is extending the pin rather than redistributing it.
3. **Engagement headline measure** — the closing headline now shares the categories/footer measure
   (one alignment anchor); at ≥1600px it rewraps from three lines to two.
4. **Arrival glow curve** — the glow now recedes 1.0→0.25 across the whole camera move; the
   baseline collapsed it to 0.017 within 60px of scroll. Surfaced by the final gate as previously
   unnamed; unambiguously the intended behaviour.

### R3.6 Disclosed residuals (non-blocking)

- **Pre-existing, both builds identical:** full-motion Ecosystem wing dim (0.5) puts wing text at
  2.8–3.2:1 contrast. The reduce path's 0.82 floor proves recession reads fine at 6.0–7.0:1 —
  recommended as the next craft item on the primary path.
- Reduced-motion visitors on *phones* still get the flat path (0 pins) — deliberately out of scope
  to protect the approved mobile experience; recommended as its own reviewed change.
- PageDown paging skips principles mid-pin — **pre-existing on the full path too** (measured at
  baseline); scroll, arrows and trackpad behave correctly.
- Two inert GSAP transform stubs (`translate: none` etc.) remain inline on connector segments
  below 1024px after a desktop→mobile crossing — visually and functionally nil (element is
  `display:none` there).
- All browser evidence is Chromium; Safari/Firefox spot-check on the preview recommended.

### R3.7 Files changed

`lib/gsap.ts` (third query, `scrollTimeline()` helper, central `landOnHash()`) · `lib/motion.ts`
(new — the channel policy) · `app/globals.css` (staging/motion split; connector suppressed at
≥1024px in *both* policies; Engagement anchor) · all seven scene components (shared scene-builders
with `{ reduced }` channel policy; Replay state machine; cleanup correctness on breakpoint
crossings).

### R3.8 Founder review checklist (desktop, no settings changes needed)

1. Open the preview in a NEW tab at desktop size. The arrival should play (~5s staged ladder) —
   **on your machine as-is**, with Reduce Motion still on.
2. Scroll: arrival should hold and recede; Institution statement resolves line-by-line beside its
   gold rule; Mission holds while three pillars hand off with gold segments drawing *between* them
   (no centre divider anywhere); Ecosystem wings resolve room-by-room; Principles present one at a
   time, legible at any scroll speed; Engagement resolves on one shared measure with the footer.
3. Click **Replay Arrival** (hero chip or footer) from anywhere, several times in a row.
4. Deep-link test: open `…/#contact` directly — it should land exactly on Engagement, no blank
   page, no console errors.
5. Mobile: unchanged — please confirm nothing feels different there.
6. The four §R3.5 items are yours to confirm or reverse.

---

## R2 · Desktop Cinematic Remediation (Founder round 2, 2026-08-06)

**Founder verdict on v1:** mobile approved; desktop NOT founder-ready — read as a polished static
landing page, Replay broken, layout defects (institution line crowding copy, arbitrary center
mission line, misaligned engagement rows, unbalanced desktop scale).

### R2.1 Root cause of the desktop motion failure (verified, not assumed)
1. **The `html.js` gate never executed before paint.** It shipped as `next/script strategy="beforeInteractive"`,
   which in App Router **static export** emits no executable inline script — it rides the `self.__next_s`
   queue and runs only at hydration (network-delayed by seconds, on real connections). Until then every
   `.js`-gated hidden state was inactive → the page painted fully visible → every GSAP `.to()` reveal
   tweened to values already applied → **zero visible motion**, exactly "a static landing page."
   *(Local Chromium testing masked this: on localhost hydration lands in ~50ms.)*
2. **The seen-path suppressed all arrival motion for the whole tab session** — the Vercel SSO bounce
   guarantees a revisit, so the Founder essentially always landed on the static composition.
3. **Reduced-motion ambiguity:** if the reviewing desktop has OS "Reduce Motion" enabled, the site
   intentionally renders fully static and Replay (old behavior) silently no-opped — indistinguishable
   from "broken." *(Diagnostic below at R2.7.)*
4. **Even when firing, v1 desktop motion was too subtle** — small opacity fades; the round-1 review
   itself had scored continuity "asserted, not delivered."

### R2.2 Root cause of the Replay failure
- Hero chip: the chip sat at document y≈1729 (absolute, below the fold); a real mouse click triggered
  the browser's **native focus-scroll after the scroll-await had already resolved**, so the intro
  played ~1,300px above the viewport ("does nothing"). Programmatic clicks (round-1 tests) don't
  focus-scroll — which is why it passed earlier verification.
- Old handler raced `scrollIntoView(smooth)` against `tl.restart()`, and under reduced motion
  returned silently.
- If hydration was late/never (root cause 1), no handler was attached at all.

### R2.3 What changed (motion architecture)
- **js-gate:** a real inline `<script>` is now the **first child of `<body>`** — executes before any
  content paints, in every browser, no framework loader. (Verified in `out/index.html`.)
- **Replay as a deterministic state machine:** button disables (`aria-busy`), scroll-to-top is awaited
  (rAF-polled + double-rAF re-assert against native focus-scroll, chip now `position:fixed`, blur()
  before start), state resets, timeline `pause(0).invalidate()` + explicit re-application of initial
  states, `play(0)`, re-enable on complete. Works from any scroll position, any state, 3+ consecutive
  times, keyboard included; under reduced motion it scrolls to the composed arrival (never a silent no-op).
- **Desktop scene architecture** (all inside `matchMedia("(min-width:1024px) and (prefers-reduced-motion: no-preference)")`;
  mobile <1024px byte-equivalent, still 2 pins):
  - *Arrival:* pull-back extended to a 100vh camera move — the whole stage (mark+wordmark+taglines)
    recedes as ONE unit, gateway glow dims, stage darkens, ENTER cue exits early.
  - *Institution:* pinned 100svh scene (~0.9 viewport hold) — statement lines mask-reveal staggered
    (descender-safe masks), then paragraphs rise while the statement shifts left; gold rule draws in a
    **dedicated grid column** that cannot touch type.
  - *Mission:* pinned three-scene sequence (~1.5 viewports) — pillars enter/hold/recede with depth
    (scale, drift, full fade-out of retired scenes), numerals count up from content data; the gold
    connector draws **horizontal grid-measured segments** between consecutive pillars (shared optical y,
    segment opacity always ≤ its pillars', fades with them — never a center divider, never through text).
  - *Ecosystem:* each wing wipes in via clip-path from alternating sides with staggered content and a
    drawn hairline; the previous wing recedes and **restores to full opacity when scrolled back**
    (bidirectional, contrast-safe); intro heading + chapter marks now reveal.
  - *Lab:* hairlines draw (scaleX), blueprint grid parallaxes (transform-only).
  - *Principles:* one-visible pinned sequence with real vertical hand-off (incoming rises, outgoing
    sinks, overlap window shortened — no double-exposure).
  - *Engagement:* staged resolve (glow+mark → headline mask → row stagger) bookending the arrival glow.
- Pinned total: **5.4 viewports** (arrival 1.0 · institution 0.9 · mission 1.5 · principles 2.0).

### R2.4 Layout corrections (Founder defects A–D — all measured)
| Defect | Fix | Evidence |
|---|---|---|
| A · Institution line overlapped copy | Dedicated `[line] 2px [gutter] clamp(2rem,4vw,4.5rem) [content]` grid track | 0 overlaps at 1024/1280/1440/1680/1920 (min gap 41–72px) |
| B · Mission center divider | Grid-measured horizontal segments, drawn between scenes, fade with their pillars; `display:none` after sequence | 0 text crossings across 7 scroll positions × 5 widths; no full-height divider |
| C · Engagement misalignment | True 2-col grid `[label] minmax(18rem,28rem) [desc] 1fr`, baseline-aligned; footer shares the same container | Label x identical (all 6 rows), desc x identical, row-height spread 1.0px, at all 5 widths; "Investment & strategic relationships" single-line from 1024 up |
| D · Empty/compressed scale | Pinned scenes fill the former voids; dead-zone scan (200px steps, luma/style deltas): **0 spans >1 viewport with no on-screen change** at 1440 & 1920; wings vertically centered ≥1680; display type +15% ≥1680 | Forward-only scans, both widths |

### R2.5 Verification (all measured on the built static export in real Chromium)
| Check | Result |
|---|---|
| Fresh-visit intro (1440/1920/390/320) | ✅ staged opacity ladder 0→1 over ~5s |
| Hero Replay chip — **real mouse click** | ✅ scrollY stays 0 for the entire replay; intro completes on-screen |
| Footer Replay from mid-page ×3 consecutive | ✅ scroll reaches top first (≤1.2s), full 1→0→1 cycle each time |
| Double-fire + keyboard Replay | ✅ no wedge; full cycle via Tab+Enter |
| Seen-path (reload) | ✅ static composition + 8s glow-breathe (the only ambient animation) |
| Reduced motion | ✅ 0 pins, everything visible, Replay scrolls to composed arrival |
| No-JS | ✅ all chapters fully visible |
| Institution beat 2 in-viewport | ✅ 0 boundary violations at 4 widths (was: hidden at 3 of 4) |
| Mission staging | ✅ empty space above content 20% (was 58–66%); pillar center at ~31% of viewport |
| axe-core after full scroll + back | ✅ 0 violations (was 15 serious contrast) |
| Console errors, idle mutations | ✅ 0 across all widths; 0 idle mutations at 4 positions |
| Mobile regression 375/390/430 | ✅ pins = 2 (unchanged), intro plays, INDEX overlay works, 0 overflow at 320 |
| typecheck · lint · build · root typecheck | ✅ all clean |
| Gateway G aspect (arrival/nav/engagement) | ✅ 0.00–0.02% deviation; footer lockup replaced by bare mark + wordmark (was 1:1 tile) |

### R2.6 Adversarial review verdict trail
Round-2 Opus review (before fixes): **borderline** — architecture right, staging wrong; 15 defects
(3 critical: hero-chip focus-scroll replay, institution pin overflowing the fold, mission pin void).
All 15 fixed with measured acceptance gates (above). Per-chapter cinematic ratings at review time:
arrival 4/5, ecosystem/lab/engagement 3/5, institution/mission/principles 2/5 — the 2/5s were all
staging defects (D2/D3/D5), which are the ones fixed and re-measured.

### R2.7 Diagnostic note for the Founder
If desktop still appears static after this deploy, check the OS accessibility setting first:
**macOS → System Settings → Accessibility → Display → "Reduce Motion"** (Windows: Settings →
Accessibility → Visual effects → Animation effects). With Reduce Motion ON, the site intentionally
presents the complete composition without animation — that is the accessible design, not a defect.

### R2.8 Remaining risks (R2)
1. Verified in Chromium only — Safari/Firefox/WebKit unavailable in the build container. The fixes
   are standards-based (inline script, fixed positioning, blur+rAF), but a manual Safari pass on the
   preview is recommended.
2. At 1920, a receding mission pillar title can clip the right viewport edge mid-transition (low
   opacity, transitional, ~0.5s) — cosmetic.
3. Live-preview browser automation is impossible from the build environment (egress blocks
   `*.vercel.app`; Vercel SSO); all browser evidence is from the byte-identical local static export,
   tied to the deployed commit via Vercel build logs.
4. Lighthouse was not re-run this round (motion code adds ~4KB gz; image weight unchanged) — spot-check
   recommended after founder approval.

### R2.9 Founder review checklist (desktop pass)
1. Open the preview in a NEW tab (fresh session) at desktop size → the arrival should play automatically (~5s).
2. Scroll slowly: arrival should hold and pull back as one object; Institution statement should
   reveal line-by-line inside the frame; Mission should hold while three pillars hand off with the
   gold thread drawing between them; Ecosystem wings should wipe in one room at a time; Principles
   should show exactly one principle at a time; Engagement should resolve glow → headline → rows.
3. Click **Replay arrival** (top control after the intro, or in the footer): the page should return
   to the top and replay the full sequence — try it three times in a row.
4. Reload the page: composition appears complete immediately (no forced replay), with a slow glow breathing.
5. On your phone: confirm nothing changed from the version you approved.
6. If desktop still looks static: see R2.7 (OS Reduce Motion), then report back.

### R2 screenshots (`docs/reviews/assets/gcl-v1/r2-*.webp`)
| File | Shows |
|---|---|
| `r2-arrival.webp` | Arrival composed, 1440 |
| `r2-institution-pinned.webp` | Institution pinned scene mid-reveal, in-frame, 1440 |
| `r2-mission-scene.webp` | Mission scene hand-off at 1920 — the review's "most damning frame," fixed |
| `r2-ecosystem-wing.webp` | Ecosystem wing mid-wipe, 1440 |
| `r2-principles.webp` | Principles single-visible transition, 1440 |
| `r2-engagement.webp` | Engagement resolve + aligned grid, 1440 |
| `r2-footer.webp` | Footer on the master grid with mark+wordmark treatment |
| `r2-mobile-full.webp` | Mobile 390 full page (regression: unchanged) |

---

## 1 · Executive verdict

**SHIP-READY FOR FOUNDER REVIEW — preview deployment pending owner action.**

The cinematic institutional site for **www.gabrielcapitallabs.com** is fully implemented as an
isolated static-export Next.js app at `apps/gabriel-capital-labs-site/`, built end-to-end against the
locked Brand Standards Master Archive v1.0. It passed a three-stage pipeline: Sonnet implementation →
Opus adversarial brand/experience review (24 defects found, including 3 critical) → full fix wave with
17/17 programmatic verifications. Every acceptance criterion is met except one, by explicit fallback:
no Vercel credentials exist in this environment, so instead of a deployed preview this report supplies
exact one-time deployment instructions (§12, §14). **Nothing was merged, no DNS was touched, and the
CreditVector production application is provably untouched** (root typecheck clean; the site builds with
the parent repo's `node_modules` removed).

| Gate | Result |
|---|---|
| Canonical Gateway G fidelity (all instances, all modes) | ✅ verified (aspect within 0.02% of natural) |
| No distorted/fragmented mark, no interior gold line | ✅ (critical D1 found & fixed) |
| Non-template, architectural experience | ✅ Opus: "Zero template DNA" |
| Reduced-motion completeness | ✅ Opus: "properly done, not stubbed" |
| No-JS completeness | ✅ (D9 found & fixed; verified with JS disabled) |
| Lighthouse mobile | ✅ **Perf 88 · A11y 100 · BP 100 · SEO 100** (targets 85/95/95/95) |
| axe-core | ✅ 0 violations @390 & @1440 |
| Claim accuracy (no invented facts) | ✅ all statuses evidence-backed |
| Isolation from CreditVector/GIOS/production | ✅ proven by isolated build test |
| typecheck · lint · build (site + root) | ✅ all clean |

---

## 2 · Repository & branch

- **Repository:** `Re3zy-ai247/gabriel-capital-labs` (the production CreditVector monolith; no separate repo created — isolation achieved inside it, rationale in §6)
- **Branch:** `claude/gcl-cinematic-institutional-site-6qx964` (pushed; **not merged**)
- **Workspace:** `apps/gabriel-capital-labs-site/` — new, fully self-contained

## 3 · Commits

| Commit | Wave | Content |
|---|---|---|
| `3a99430` | — | Starting point (`main` at branch creation) |
| `d556607` | 0–1 | Isolated workspace, canonical brand assets, implementation spec, root tsconfig exclusion |
| `87626b6` | 1–3 | Full cinematic implementation (all 7 chapters, asset pipeline, SEO, a11y) |
| `ee4caa1` | 5 | All 24 adversarial-review defects fixed (D0–D23) |
| *(HEAD)* | 6 | This report, review assets, `.ai/CURRENT-STATE.md` note |

## 4 · What was implemented

One continuous scroll-driven page (static export, zero server runtime), seven chapters:

1. **Arrival** — darkness → gateway-floor glow → the canonical mark resolves as one rigid object →
   wordmark ("GABRIEL / — CAPITAL LABS —") → taglines → ENTER cue. ~5.5s GSAP timeline; **Skip**
   (focusable from t=0, `aria-label="Skip introduction"`) and **Replay** (hero chip + footer) controls;
   `sessionStorage` prevents replay on return visits & anchor navigation; short camera pull-back pin
   (≈0.6 viewport) on first scroll. Reduced-motion and no-JS render the completed composition statically.
2. **The Institution** — parent-institution statement as masked line-reveals, Swiss chapter-mark system
   (`01 — THE INSTITUTION`), hairline vertical rule drawn by scroll. No cards.
3. **Mission Architecture** — INTELLIGENCE / INFRASTRUCTURE / IMPACT as alternating full-width bands
   connected by a single continuous gold line (div scaleY-drawn by scroll progress, clear of all text).
4. **Ecosystem Architecture** — four "wings", each compositionally distinct (offset/wide/inset grids):
   **CreditVector** (Active platform — live, linked), **GIOS** (Platform foundation — in development),
   **HELIOS** (Research program), **Kai** (Active within CreditVector; expanding across the ecosystem).
5. **The Lab** — seven-domain numbered research index with sequential hairline reveals.
6. **Principles** — the five institutional principles as a scroll-driven single-visible sequence
   (~2.5 viewport pin) with 1/5…5/5 progress hairline; static editorial list under reduced-motion/no-JS.
7. **Engagement** — "Enter the future we are engineering." over a final recurrence of the undistorted
   mark + gateway light; six engagement categories (non-interactive until a contact email is configured
   via `NEXT_PUBLIC_GCL_CONTACT_EMAIL`; a single "Contact channels are being finalised." note — no
   invented contact data). Footer: lockup, "Gabriel Capital Labs, LLC", © 2026, Replay, CreditVector link.

Plus: mobile INDEX overlay navigation (<860px, full-bleed obsidian chapter list, focus-trapped,
Esc-closable, ≥44px targets); skip-to-content; full metadata (canonical, OG/X cards, favicon set,
JSON-LD Organization — 5 fields only); robots.txt + sitemap.xml; sharp-based image pipeline.

## 5 · File inventory

**New workspace `apps/gabriel-capital-labs-site/`** (all site code):
`package.json` · `package-lock.json` · `tsconfig.json` · `next.config.mjs` (output: export) ·
`postcss.config.js` · `.eslintrc.json` · `.gitignore` · `SPEC.md` ·
`app/layout.tsx` · `app/page.tsx` · `app/globals.css` ·
`components/{Nav,Footer,ArrivalScene,InstitutionSection,MissionSection,EcosystemSection,LabSection,PrinciplesSection,EngagementSection}.tsx` ·
`content/site.ts` (all copy + contact config) · `lib/gsap.ts` ·
`scripts/optimize-images.mjs` · `scripts/dedupe-preload.mjs` ·
`public/` (robots, sitemap, favicon set, og.jpg, x-card.jpg, `img/` responsive WebP+PNG variants) ·
`brand/` (locked canonical masters + web assets from Brand Standards Master Archive v1.0)

**Root repo changes (the complete list):**
- `tsconfig.json` — one line: `"exclude": ["node_modules", "apps"]`
- `docs/reviews/GCL-CINEMATIC-WEBSITE-v1.{md,html}` + `docs/reviews/assets/gcl-v1/` (this report)
- `.ai/CURRENT-STATE.md` — snapshot note
**Nothing else.** No CreditVector code, auth, billing, Prisma, middleware, or `vercel.json` touched.

## 6 · Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Location | Option A-equivalent: `apps/gabriel-capital-labs-site/` inside the existing repo | Repo is a single-app Next.js monolith, not a monorepo; a nested self-contained app with its own lockfile gives full isolation without a new repo's ownership/credential overhead. A separate repo (option C) was unnecessary because isolation is provable (see below). |
| Rendering | Next.js 14.2.18 **static export** (`output: "export"`) | Pure content site; zero server runtime = zero interaction with production services; deployable anywhere; fastest possible serving. |
| Deployment topology | **Separate Vercel project**, Root Directory = `apps/gabriel-capital-labs-site` | The existing `gabriel-capital-labs` Vercel project (CreditVector prod) builds from repo root and never reads `apps/`. Domain attachment is per-project → www.gabrielcapitallabs.com can never collide with www.creditvector.app. |
| Isolation proof | `npm ci && npm run build` succeeds with the parent repo's `node_modules` **removed** | Caught by review (D0: autoprefixer resolved from parent) and fixed; re-verified twice. |
| Motion | GSAP + ScrollTrigger only (already a repo-family dependency); **no three.js/WebGL** | The canonical mark is a photographic render — light/depth via layered imagery + compositor-only transforms. Avoids WebGL's battery/perf/a11y cost with zero cinematic loss. No Lenis; native scroll. |
| Styling | Hand-rolled CSS custom-property tokens; **no Tailwind** | Editorial/architectural typography control; avoids template feel; shadows the root Tailwind config via a local postcss.config.js. |
| Fonts | Inter via `next/font/google` (SIL OFL) | Brand tokens name "Inter Display or approved optical equivalent"; license-safe, self-hosted by Next at build. |
| No-JS strategy | Inline `beforeInteractive` script sets `html.js`; all hidden-initial states gated behind it | Full content renders with JS disabled (verified). |

## 7 · Gateway G asset verification

- Source of truth: `brand/canonical/` — verbatim from `00_CANONICAL_MASTER` of the build pack
  (`CANONICAL_MASTER.json` status **LOCKED**, locked 2026-08-05).
- All rendered instances use pipeline projections of the canonical transparent-material master —
  never redrawn or vector-recreated.
- Adversarial review measured every instance: arrival + nav exact (0.923 natural aspect preserved);
  **one violation found — the Engagement mark was CSS-compressed to a 0.109–0.188 aspect "golden
  needle"** (D1, CRITICAL). Fixed (mark-aspect asset + `height:auto`); re-measured at **0.00–0.02%**
  deviation from natural aspect at 1440/390.
- No interior gold line anywhere (pixel-diff of shipped assets vs canonical master: clean).
- The mark animates only as one rigid object: uniform scale, translate, opacity. No rotation, morph,
  skew, fragmentation, or clip of the mark. Screenshots: `assets/gcl-v1/arrival-desktop.webp`,
  `assets/gcl-v1/full-page-desktop.webp`.

## 8 · Mobile findings

- Widths tested: **320 / 375 / 390 / 430 / 768 / 1024 / 1440 / 1920** — no horizontal overflow at any
  (`scrollWidth === innerWidth` programmatically at all eight).
- Zero touch targets under 44px at 320 (measured).
- Review finding D7 (FAIL → fixed): below 860px there was originally **no navigation at all**; now an
  editorial INDEX overlay (full-bleed obsidian, hairline rules, focus-trapped, Esc/close, all targets
  ≥44px, verified navigating). Screenshot: `assets/gcl-v1/mobile-index-nav.webp`.
- Mobile composition: centered single-column pacing with preserved chapter system; principles pin
  distance and type scales tuned; text legibility confirmed at 320.

## 9 · Accessibility findings

- **axe-core: 0 violations** at 390 and 1440 (31 "incomplete" contrast flags all confirmed
  false-positives from gradient backgrounds; measured pairs 8.3–8.6:1).
- Keyboard: skip-to-content first; gold 2px `:focus-visible` rings on every control; **D6 (fixed):**
  8 controls were focusable while invisible during the intro — now `visibility`-gated; tab order
  re-verified clean during intro.
- Arrival: Skip focusable from t=0 (`aria-label="Skip introduction"`); no information conveyed by
  motion alone; `prefers-reduced-motion` renders the entire site static-complete (0 pin-spacers,
  all opacity 1 — programmatically verified; Opus: "best-executed part of the build").
- No-JS (D9, fixed): institution statement, all 7 lab rows, all 5 principles verified visible with
  JavaScript disabled. Screenshot: `assets/gcl-v1/no-js-fallback.webp`.
- Semantic single-h1 → h2 hierarchy, landmarks, real DOM text everywhere.

## 10 · Performance results

**Lighthouse (mobile emulation, simulated slow-4G, static export served locally):**

| Category | Score | Target |
|---|---|---|
| Performance | **88** | ≥85 ✅ |
| Accessibility | **100** | ≥95 ✅ |
| Best Practices | **100** | ≥95 ✅ |
| SEO | **100** | ≥95 ✅ |

Metrics: FCP 0.8s · **LCP 2.7s (simulated throttle)** · **CLS 0** · TBT 350ms · Speed Index 1.2s.

- Page weight: arrival mark 49.5KB (WebP, preloaded with `imagesrcset`); **all other scroll-loaded
  imagery totals 0.8KB** after D8 (was 1.37MB — footer lockup 1211KB→806B variant; unused hero
  variants deleted). Main JS chunk 173KB (Next runtime + GSAP). Total export 2.5MB (incl. metadata
  assets: favicons, OG/X cards, JSON-LD logo).
- Zero CLS: explicit dimensions on every image; font-display swap.
- No always-running animation; all reveals `once:true`; only transform/opacity/clip-path animated;
  2 pins totalling ≈3.1 viewports.
- Documented exception: LCP 2.7s is under Lighthouse's harsh simulated throttle against the 2.5s
  target; FCP (the arrival's first meaningful light) is 0.8s and real-CDN delivery (Vercel edge +
  compression) should close the gap. Follow-up option: `fetchpriority="high"` on the mark.

## 11 · Build, lint, typecheck, test results

| Check | Result |
|---|---|
| Site `npm run typecheck` | ✅ clean |
| Site `npx next lint` | ✅ no warnings or errors |
| Site `npm run build` (static export) | ✅ clean |
| **Isolated build** (parent `node_modules` removed, fresh `npm ci`) | ✅ succeeds (run twice) |
| Root `npm run typecheck` (CreditVector) | ✅ clean |
| Playwright fix-verification suite | ✅ 17/17 |
| axe-core | ✅ 0 violations |
| Lighthouse | ✅ 88/100/100/100 |

## 12 · Preview URL

**None deployed.** This environment has no Vercel credentials (CLI unauthenticated; MCP deploy path
can't carry the binary asset tree). Authorized fallback per the brief: exact instructions.

**One-time protected preview (~3 minutes, Vercel dashboard):**
1. vercel.com → team **Rey Gabriel's projects** → **Add New… → Project** → Import
   `Re3zy-ai247/gabriel-capital-labs`.
2. **Project name:** `gcl-institutional-site` (do NOT reuse the existing `gabriel-capital-labs`
   project — that is CreditVector production).
3. **Root Directory:** `apps/gabriel-capital-labs-site` · Framework: Next.js (auto) · no env vars
   needed (optionally set `NEXT_PUBLIC_GCL_CONTACT_EMAIL`).
4. Under **Git**, set the Production Branch to something unused (e.g. `production-hold`) or simply
   deploy from the branch picker: choose `claude/gcl-cinematic-institutional-site-6qx964` → Deploy.
5. Preview URLs are protected by **Vercel Authentication** (team-only) by default — leave it on.
6. You get a `*.vercel.app` preview URL; the arrival, Skip/Replay, and mobile INDEX are all testable.

## 13 · Known risks

1. **LCP 2.7s** under simulated slow-4G vs the 2.5s target (score still 88; see §10 exception).
2. **Replay/arrival verified in Chromium only** (Playwright); Safari/Firefox untested from this
   container — recommend a quick manual pass on the preview.
3. **TBT 350ms** on mobile emulation from GSAP/hydration init — acceptable, monitorable.
4. **Contact email unset** — engagement categories intentionally non-interactive until
   `NEXT_PUBLIC_GCL_CONTACT_EMAIL` is set at deploy time.
5. **Repo weight** — `brand/` adds ~7.3MB of canonical masters to git (deliberate: in-repo source of
   truth). If undesired, they can move to LFS/storage later without code changes.
6. The root Vercel project will build previews of this branch (as it does for any branch) — those
   previews are CreditVector, unaffected by `apps/`; ignore them.

## 14 · Production deployment instructions (when Founder approves)

1. Complete §12 (project exists, preview verified).
2. Merge the branch to `main` via PR — the CreditVector project's build is unaffected (verified:
   root typecheck/build ignore `apps/`).
3. In the `gcl-institutional-site` project: set Production Branch = `main` → promote/redeploy.
4. Attach domains (§15). Set `NEXT_PUBLIC_GCL_CONTACT_EMAIL` in Production env → redeploy.

## 15 · DNS / domain instructions (NO changes made — Founder-gated)

Canonical choice (recommended): **https://www.gabrielcapitallabs.com** (already baked into metadata,
sitemap, JSON-LD).
1. Vercel → `gcl-institutional-site` → Settings → Domains → add `www.gabrielcapitallabs.com` AND
   `gabrielcapitallabs.com`; mark **www as primary**; Vercel then serves apex → www 308 redirects.
2. At the registrar: `www` → CNAME → `cname.vercel-dns.com` · apex `@` → A → `76.76.21.21`
   (or switch nameservers to Vercel's for both, simplest).
3. Vercel auto-provisions HTTPS certificates after DNS verification (minutes to ~1h).
4. Verify: `curl -I https://gabrielcapitallabs.com` → 308 to `https://www.gabrielcapitallabs.com/` → 200.

## 16 · Rollback plan

- Nothing is merged and no production system was touched: **rollback = delete the branch** (or
  `git revert d556607..HEAD` if ever merged). The only shared-file change is one line in root
  `tsconfig.json` (an exclude — inert for the root app, revert restores byte-identical behavior).
- Preview project rollback: delete the `gcl-institutional-site` Vercel project. CreditVector is
  never in the blast radius.

## 17 · Recommended next Founder decision

1. Create the protected preview (§12, 3 minutes) and walk the site on your phone + desktop —
   especially the arrival, Replay, and the mobile INDEX.
2. Decide the contact destination (`NEXT_PUBLIC_GCL_CONTACT_EMAIL`) so Engagement links go live.
3. If the experience passes your review: approve merge + §14/§15 to put
   **www.gabrielcapitallabs.com** live. DNS remains untouched until you say so.

---

### Screenshot evidence (`docs/reviews/assets/gcl-v1/`)

| File | What it shows |
|---|---|
| `arrival-desktop.webp` | Completed arrival composition, canonical mark undistorted (1440) |
| `full-page-desktop.webp` | Entire page, all chapters (1440) |
| `full-page-mobile.webp` | Entire page (390) |
| `mission-connector.webp` | Continuous gold connector clear of text (post-D3) |
| `mobile-index-nav.webp` | Editorial INDEX overlay (post-D7) |
| `replay-verified.webp` | Full composition restored after Replay on the seen path (post-D5) |
| `no-js-fallback.webp` | Full content with JavaScript disabled (post-D9) |
| `principles-transition.webp` | Single-visible principles crossfade (post-D4) |

*Adversarial review: 24 defects (3 critical, 7 high, 7 medium, 7 low) — all fixed and verified.
Full defect ledger preserved in the review round; summary integrated throughout this report.*
