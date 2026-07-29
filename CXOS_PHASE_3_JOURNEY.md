# CXOS Phase 3 — The Living Landing Journey & the Cinematic Transition System
## Stage 1–3: Audit · Experience Architecture · Motion Specification

**2026-07-29 · branch `feat/cxos-phase3` · base: CXOS Phase 2 + Founder Review System (`68cb304`) reconciled with production truth `f449c35` (merge `7b1d2fd`, fix `0e3957e`)**
**Planning + design document. The vertical-slice implementation report is `CXOS_PHASE_3_REPORT.md`.**
**No merge. No production deployment. Feature branch only.**

---

## STAGE 1 — REPOSITORY AUDIT

### 1.1 Production truth (VERIFIED)

- `origin/main` = **`f449c35`** — the owner merged draft PRs #8 (PR-1-v2) and #9 (PR-2-v2); production runs both release units.
- `feat/cxos-phase3` = CXOS Phases 1–2 + Founder Review System **merged with `f449c35`**. Nine conflicts, all RC1 territory, resolved to main's ratified versions — except `app/billing/page.tsx` + `app/agency/page.tsx`, where the branch's versions are a strict superset (main's v2 content **plus** the RC1 B-06 terms-acceptance wiring); taking main's there broke `terms-acceptance.test.ts` 8/78, caught and fixed in `0e3957e`.
- After reconciliation: **`tsc` clean · all 81 source guards green · all 5 runtime guards green.**

### 1.2 Landing-page structure (the raw material)

`app/page.tsx` — fully static, one server component, middleware handles signed-in redirect. Sections in DOM order:

| # | Section | Anchor | Content |
|---|---|---|---|
| 0 | Hero (CXOS Scene 1 `cx-arrival`) | — | h1 "Stop guessing…", Kai introduction, DashboardPreview |
| 1 | Trust / compliance band | — | TrustBar + educational-tool disclaimer |
| 2 | How it works | `#how` | 4 STEPS cards |
| 3 | Platform (four engines) | `#platform` | 4 FeatureSplits + roadmap strip |
| 4 | Agency | `#agencies` | roster visual + Kai-for-your-team |
| 5 | Operator Network | `#community` | community visual + compliance note |
| 6 | Pricing | `#pricing` | 3 tiers + letter-pack note |
| 7 | FAQ | `#faq` | 6 compliance-reviewed Q&As |
| 8 | Final CTA | — | "Your credit report. Your rights. Your move." |

All copy is compliance-authoritative and reused verbatim; the illustrative-visual convention (`aria-hidden` + "Illustrative example" caption) is established by `KaiChatVisual` / `AgencyRosterVisual` / `CommunityVisual`.

### 1.3 Animation inventory

- **Token layer** (`app/globals.css` §CXOS): `--ease-vector`, `--dur-settle/reveal/focus/crossfade/draw`, `--aurora-marketing/app`. Primitives: Settle (`animate-rise` + `.cx-d1..d4`), Reveal (`.reveal`+safety), Draw (`animate-draw`), Drift (`.aurora`), Shine (`.shine`, `.cx-sheen-overlay`), Focus (`.cx-focus-out`). Reduced-motion block neutralizes every one; `cxos-grammar.test.ts` enumerates every `.cx-*` class and fails if one is missing from the block.
- **Threshold** (Phase 2): pre-paint darkness script, fail-closed gate, lazy three+gsap chunk. Untouched by Phase 3 except the seam contract (§3.0).
- **`components/landing/motion/Parallax.tsx`** — an UNUSED primitive, comment: *"Foundation for the future cinematic homepage."* rAF-throttled passive scroll + IO gate + reduced-motion hard return + transform-only. **Phase 3 adopts this exact pattern as the journey runtime's engine — reuse-first, repository precedent.**
- Other rAF users: community ambient visuals, gxl — out of scope, untouched.
- **No scroll library, no framer-motion, no R3F installed.** three `0.185.1` (MIT) and gsap `3.15.0` (standard no-charge license) exist for the Threshold chunk only.

### 1.4 Constraints found

- `/journey` is an existing PRODUCT route (the consumer timeline, ADR-0007). The landing journey's review stage is therefore **`/review/landing`**, room key `landing-journey`.
- `middleware.ts` matcher is `["/"]` — signed-in visitors never see the landing journey; no interference.
- CI runs `scripts/*.test.ts` (non-recursive) + `scripts/runtime/run-all.ts` — a new guard file is picked up automatically.
- Landing first-load JS: **97.7 kB** review-enabled / 96.8 kB production (Phase 2 baseline).

---

## STAGE 2 — EXPERIENCE ARCHITECTURE

### 2.1 The narrative journey (chapter map)

Phase 3 does not replace the landing page — it **stages** it. The existing sections become chapters of one continuous descent; two NEW chapters are inserted between the trust band and `#how` to give the story its missing emotional beats:

```
CH 0  THE THRESHOLD        (existing, untouched)    darkness → the name → the opening
CH 0b THE ARRIVAL          (existing hero, Scene 1)  anticipation → orientation
─────────────────────────────────────────────────────────────────────────────
CH 1  THE PROBLEM CHAMBER  (NEW, #problem)           uncertainty — three bureaus,
                                                     three versions of the story
CH 2  INTELLIGENCE AWAKENS (NEW, #awakens)           discovery — scattered facts
                                                     align into classified evidence
─────────────────────────────────────────────────────────────────────────────
CH 3  THE EVIDENCE ENGINE  (existing #how+#platform) control      [future phase]
CH 4  THE TWO PATHS        (existing #agencies)      possibility  [future phase]
CH 5  OPERATOR NETWORK     (existing #community)     relationship [future phase]
CH 6  THE ARENA SIGNAL     (not present; Arena not live — honest) [future phase]
CH 7  THE CONVERSION GATE  (existing #pricing→/pricing) action    [slice: transition]
```

**The vertical slice implements:** Threshold → Hero → CH 1 → CH 2 → one real cinematic route transition (`/` → `/pricing`) → destination → back navigation. Chapters 3–7's cinematic upgrades are future phases; their content ships today exactly as it already exists.

### 2.2 The three levels of motion (mapped to repository truth)

| Level | Scope | Duration | Mechanism |
|---|---|---|---|
| 1 — World transitions | Threshold (exists); future first-entries | 6–10 s, skippable, once/session | WebGL overlay, lazy chunk |
| 2 — Chapter transitions | landing chapters, scroll-driven | 0.8–2.5 s per transformation | CSS transforms driven by a scroll-progress custom property; **native scroll authoritative** |
| 3 — Route transitions | registered marketing routes | 0.4–1.5 s, hard fail-open | CSS overlay ("cover" pattern); navigation is never delayed more than the cover-in (≤ 450 ms) |

### 2.3 Capability-tier policy (`lib/cxos/capability.ts`)

| Tier | Trigger | Journey behavior | Route transitions |
|---|---|---|---|
| **A** | default desktop | full choreography + depth planes | full (≈1.0 s) |
| **B** | mobile viewport | same choreography, single plane (no parallax depth) | shortened (≈0.8 s) |
| **C** | `saveData` · `deviceMemory < 4` | no scroll-driven transforms; settles only | minimal crossfade (0.28 s) |
| **D** | `prefers-reduced-motion` · user toggle off | none — everything at rest state | instant navigation |

Decision order: reduced-motion → user toggle (`localStorage cx-cinematic="off"`) → saveData → deviceMemory → viewport. Fail direction is always downward; detection failure of any signal ⇒ the more conservative tier. The tier is stamped as `html[data-cxjourney="A|B|C"]` (D stamps nothing — the document stays untouched).

### 2.4 State machine & lifecycle

**Journey runtime** (`components/cxos/journey/JourneyRuntime.tsx`, mounted once on the landing page):

```
mount → detectTier
  D → return (no listeners, no attribute, zero cost)
  A/B/C → stamp html[data-cxjourney] → register [data-chapter] sections
        → IO: data-state ahead|active|passed (cheap class states)
        → A/B only: passive scroll + rAF → write --cxp ∈ [0,1] per active section
unmount → remove attribute, disconnect all
```

`--cxp` is the chapter's scroll progress (0 = entering viewport, 1 = leaving). All choreography is pure CSS `calc()` on `--cxp` — transform/opacity only, compositor-only, zero layout writes from CSS, one `scrollY` read per frame from JS (the `Parallax.tsx` discipline).

**Route transition shell** (`components/cxos/transitions/TransitionShell.tsx`, mounted in the root layout — persists across App Router navigations, renders `null` when idle):

```
idle → (document click, capture: plain left-click on same-origin <a>,
        no modifiers, target≠_blank, download absent)
     → registry.find(from, to) → null? do nothing (link works natively)
     → tier D or replayed this session at C? → do nothing / minimal
     → COVER-IN (≤450 ms) → router.push(to) AT cover-in end
     → pathname changed → OPEN-OUT (≤550 ms) → focus destination h1 → idle
FAIL-OPEN: hard timeout (1800 ms from click) → location.assign(to)
           chunk/router failure → location.assign(to)
           Escape during overlay → skip to OPEN-OUT immediately
```

### 2.5 Navigation laws → mechanisms

| Law | Mechanism |
|---|---|
| Links remain real links | interception is event-delegation over real `<a href>`; modified clicks, middle clicks, new-tab, copy-link all untouched |
| Never delay indefinitely | navigation fires at cover-in end (≤450 ms); 1800 ms hard `location.assign` failsafe |
| Back/forward never replay | only `click` is intercepted — `popstate` is never touched |
| Returning users shorter | `sessionStorage cx-nav-n`: first play full, after that tier-C duration |
| User disable | `cx-cinematic=off` (footer control, localStorage) ⇒ tier D |
| Reduced motion | tier D — checked before everything else |
| Never obscure errors | transitions run only on REGISTERED marketing routes; a `CRITICAL_NEVER` denylist (`/login`, `/register`, `/billing`, `/dashboard`, `/api`, `/legal`, `/support`, `/admin`, `/settings`, checkout/Stripe flows) is consulted **before** the registry and cannot be overridden by an entry |
| No route inaccessible on failure | overlay is pure CSS in the sync bundle (no lazy chunk to fail); JS-off ⇒ plain links; the shell never `preventDefault`s before a registry match |
| No autoplay audio | transitions are silent by design; no audio code exists in them |
| Review never consumes session | shell + runtime write nothing in review mode |

### 2.6 Failure model

- **JS fails / disabled** → server-rendered page, all chapter content visible at rest state (visible-by-default CSS; choreography only under `html[data-cxjourney]`).
- **Transition overlay stuck** → 1800 ms `location.assign`; overlay carries its own CSS end-state (`cx-enter-safety` pattern is precedent).
- **rAF starvation / hidden tab** → IO gate stops writes off-screen; `visibilitychange` pauses the loop.
- **Chapter CSS fails to load** → content is semantic HTML; nothing depends on the choreography.

### 2.7 Folder structure

```
lib/cxos/capability.ts               tier detection (pure, testable)
lib/cxos/transitions/registry.ts     CRITICAL_NEVER + transition definitions + find()
components/cxos/journey/JourneyRuntime.tsx   scroll runtime + director strip
components/cxos/journey/ProblemChamber.tsx   CH 1 (server component)
components/cxos/journey/IntelligenceAwakens.tsx  CH 2 (server component)
components/cxos/transitions/TransitionShell.tsx  route-transition overlay
app/review/landing/page.tsx          review stage: chapters, projections, simulations
scripts/cxos-journey.test.ts         guard (see §2.9)
```

### 2.8 Performance budgets (set before implementation)

| Budget | Target | Baseline |
|---|---|---|
| Landing first-load JS | ≤ 102 kB review-enabled | 97.7 kB |
| New sync client JS (runtime+shell+capability+registry) | ≤ ~4 kB of that delta | — |
| LCP | unchanged (hero untouched; nothing new above the fold) | — |
| CLS from journey | 0 (transform/opacity only) | 0 |
| Scroll frame cost | 1 `scrollY` read + N `--cxp` writes, no layout | — |
| Cover-in before navigation | ≤ 450 ms | — |
| Total transition (A) | ≤ 1.5 s perceived | — |
| Fail-open ceiling | 1800 ms | — |
| New WebGL contexts | **0** (Threshold remains the only one) | 1 max |
| New lazy chunks | 0 (slice is CSS+DOM; heavy tiers earn chunks in later phases) | — |

### 2.9 Testing strategy

- `scripts/cxos-journey.test.ts` (source guard, non-vacuity by mutation): no `preventDefault` on wheel/touch/scroll; passive listeners; visible-by-default CSS scoping; plain-left-click-only interception; `CRITICAL_NEVER` consulted before registry and covers billing/auth/admin; hard-timeout `location.assign` present; `popstate` untouched; reduced-motion ⇒ tier D before all other signals; durations within Level 3 bounds; no session writes in review mode.
- `cxos-grammar.test.ts` enumeration automatically forces reduced-motion coverage of every new `.cx-*` class.
- `cxos-review.test.ts` updated for the new room truth (two PROTOTYPE rooms).
- Playwright behavioral pass (Stage 5): the full adversarial list.

### 2.10 Rollback strategy

The slice is additive: two new sections, one runtime, one shell, one stage. Rollback = revert the Phase 3 implementation commits; no schema, no data, no route removed, no dependency added. The Threshold and Phase 1 grammar are untouched files except `app/page.tsx` (two inserted sections + runtime mount) and `globals.css` (appended layer) — both plain `git revert`-able.

### 2.11 Asset plan (Higgsfield evaluation)

Evaluated and **deferred**: the slice's chapters are procedural (CSS/DOM) and hold the visual bar without generated media. Generated environmental plates only become candidates in later phases (Arena/Academy concept rooms) and only through the mandated checklist (purpose doc, license, fallback, size budget, mobile + reduced-data delivery, measurement). No heavy asset ships in Phase 3. **Zero new dependencies. Zero new asset bytes.**

---

## STAGE 3 — MOTION SPECIFICATION

Shared: easing `var(--ease-vector)` everywhere; sound NONE (chapters and transitions are silent; the only sound in CXOS remains the Threshold's opt-in toggle); exit condition for every chapter is simply scrolling on (nothing pins, nothing traps); failure timeout N/A for scroll choreography (content visible by default), 1800 ms for route transitions.

### CH 0 → CH 0b seam (existing, must not regress)
Threshold dissolve hands focus to `#main h1`; hero plays Scene 1. Phase 3 adds nothing above the hero. **Verification: first-paint darkness screenshot + pixel-compare of the hero.**

### CHAPTER 1 — THE PROBLEM CHAMBER (`#problem`)

| Spec | Value |
|---|---|
| Purpose | uncertainty made visible: three bureaus, three versions of the same account |
| Initial state (p=0) | three bureau fragment cards scattered: rotated −6°/+4°/−2°, offset ±24–40 px, dimmed (opacity .75), edges cold |
| Final state (p=1) | fragments have drifted **apart** slightly (tension is not resolved here — resolution belongs to CH 2), copy block fully settled |
| Camera | none — depth is layered translate: back plane ×0.3, mid ×0.6, content ×1 (tier A only) |
| Lighting | ink-950 base; a single dim aurora (app amplitude 0.15) — the darkest chamber on the page |
| Typography | eyebrow "The problem" · h2 "Three bureaus. Three versions of your story." (new, compliance-held: factual, no promise) · body reuses the hero's factual framing |
| Fragments (aria-hidden, "Illustrative example") | same account, three tellings: Equifax "Auto loan · Balance $8,214 · Reported May 12" / Experian "Auto loan · Balance $7,940 · Reported Apr 28" / TransUnion "Auto loan · Closed · Not reported"; a quiet "31 days" deadline chip, unattached |
| Scroll mapping | drift/rotation interpolate linearly on `--cxp`; text uses `.reveal` settles (existing primitive) |
| Duration | ≈1 viewport of scroll ≈ 1–2 s at normal speed (Level 2 window) |
| Reduced motion / tier C/D | fragments at legible rest composition (slight static tilt), full opacity; text visible |
| Mobile (B) | single plane, same choreography, tighter offsets (±12 px) |
| Fallback | no-JS = rest composition; nothing hidden |
| Budget | 0 layout writes; 3 composited layers |

### CHAPTER 2 — INTELLIGENCE AWAKENS (`#awakens`)

| Spec | Value |
|---|---|
| Purpose | discovery: the same facts, aligned, classified, structured — order emerging from evidence |
| Initial state (p=0) | the three tellings tilted/offset (echoing CH 1), classification chips unlit, connective path undrawn, deadline unstructured |
| Final state (p≈0.6+) | rows aligned to a single evidence column (rotate→0, offset→0), chips lit — "Potential inaccuracy" · "Unverifiable" · "Cross-bureau mismatch" (terms from existing copy), SVG evidence path drawn (Draw primitive, `stroke-dashoffset` on `--cxp`), deadline chip docked "Response window · tracked" |
| Kai's presence | the existing executive-intelligence framing only — a KAI wordmark chip on the column header; **no mascot, no avatar, no humanoid** |
| Typography | eyebrow "Intelligence awakens" · h2 "Kai reads all three — and the noise becomes evidence." · body VERBATIM from STEPS[1]: "Potential inaccuracies, inconsistencies, and unverifiable items are flagged and explained across Equifax, Experian, and TransUnion." |
| Scroll mapping | alignment completes by p=0.6 (the payoff lands mid-viewport, not at exit); chips settle at p .35/.45/.55; path draws p .3→.7 |
| Motion meaning | computation + evidence assembly + state change — every movement is one of the six grammar primitives |
| Reduced motion / C/D | fully aligned, chips lit, path drawn — the RESOLVED state is the rest state (the narrative's meaning survives without motion) |
| Mobile (B) | same, single plane |
| Budget | 1 SVG path; chips are opacity/transform only |

### ROUTE TRANSITION — "The commercial surface" (`/` → `/pricing`)

| Spec | Value |
|---|---|
| Concept | the cinematic environment **resolves into a calm, exact commercial surface** — the one place the mandate demands calm over spectacle |
| Cover-in (≤420 ms) | ink veil rises to 1; two hairline teal rails sweep from the left/right edges and meet center — "resolving" |
| Navigation | `router.push` fires at cover-in end (≤450 ms after click) |
| Open-out (≤520 ms) | rails part horizontally; veil dissolves onto the pricing page, which is fully painted beneath; destination h1 receives focus |
| Tier durations | A 420+520 ms · B 340+420 ms · C/repeat crossfade 280 ms · D none |
| Skip / failure | Escape ⇒ immediate open-out; 1800 ms ⇒ `location.assign`; JS-off ⇒ plain link |
| Never obscures | pricing prices render beneath the veil and are fully legible the moment it parts; the overlay never delays checkout (checkout routes are in `CRITICAL_NEVER`) |

### Director instrumentation (journey)

`?director` on `/` adds the journey strip: current chapter + live `--cxp` + tier + force-tier cycle (A/B/C/D preview) + chapter-boundary outlines. `/review/landing` is the room stage: chapter doors, projection notes (reduced-motion, mobile, tablet, low-power via forced tiers), transition replay, and timeout simulation (`?cxsim=timeout`, review builds only). Production hard-off inherits `reviewBuildAllowed()` untouched.

---

*Stage 4 (implementation), Stage 5 (adversarial validation), and Stage 6 (delivery) are recorded in `CXOS_PHASE_3_REPORT.md`.*
