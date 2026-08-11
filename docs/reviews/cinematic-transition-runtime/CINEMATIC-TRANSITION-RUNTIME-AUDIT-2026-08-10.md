# Cinematic Transition Runtime — Repository Audit

**Date:** 2026-08-10 · **Author:** Fable 5 (Principal Spatial Experience Architect, Design Authority)
**Method:** 15-agent repository audit (8 Sonnet readers → synthesis → 6 Opus adversarial verifications), coordinated by Fable. Every load-bearing claim below survived independent adversarial re-derivation or carries its correction.
**External reference:** Anthropic `skills/frontend-design/SKILL.md` (loaded from the official repository). The X.com reference was inaccessible (HTTP 402) and nothing depends on it.

---

## 1. Repository / lineage

One monorepo: `Re3zy-ai247/gabriel-capital-labs`, `origin/main` = `a72a47c` (clean, verified).

| Surface | Where | Status |
|---|---|---|
| **CreditVector product** (the "rooms": dashboard, agency, arena, mail, journey, gxl, community, academy, brief, builder…) | root `app/` | LIVE at creditvector.app. **This is the target experience surface.** |
| **CXOS cinematic prototypes** (Agency HQ chambers, THE PASSAGE, Threshold review) | `app/review/*`, `lib/cxos/*`, `components/cxos/*` | On `main`, hard-off in production (`reviewBuildAllowed()` → 404). RC2 frozen at `f7ee9c5` pending Founder review; the main-branch copy carries newer Phase 1A-CX/1A-CX2 work. |
| **GCL institutional site** | `apps/gabriel-capital-labs-site` | **LIVE IN PRODUCTION** at gabrielcapitallabs.com since R4.4→R4.6.1 (merged; partly Codex-closed). Single scroll-cinematic page — no rooms; out of scope for room travel, in scope as pattern source. Must not be destabilized. |
| **HELIOS world** | `~/Documents/GIOS-Ops-Center` (not a git repo) | Separate vanilla-JS generated runtime at helios-world.vercel.app. Code cannot be reused in Next.js; its W4.1 traversal grammar is the in-house reference. Separation preserved. |

The memory-index claim "R4 paused, not shippable" is superseded: R4 completed, merged, and is live.

---

## 2. Current experience diagnosis — why it feels like CLICK → PAGE → CONTENT

Verified root causes, ranked (Opus-verified; corrections applied):

1. **No persistent shell exists below the root layout.** [CONFIRMED] `app/layout.tsx` renders only `<Providers>` + `<TransitionShell/>`. Exactly 3 layouts exist in `app/`; the other two (`admin`, `review`) are chrome-less gates. **44 page.tsx files each instantiate `<AppShell>` themselves** (Sidebar, MobileNav, KaiPresence, header), so every room-to-room click tears down and rebuilds the entire chrome. No `template.tsx`, no route groups, no rescue anywhere. The codebase confesses this in `components/kai/KaiPresence.tsx:26-34` ("…mounted by AppShell, which every page.tsx calls directly (not the persistent root layout), so it remounts on each navigation"). A second disjoint chrome family (SiteNav + SiteFooter, 5 pages) repeats the pattern.
2. **The one production transition engine is fenced out of every product room.** [CONFIRMED] `TransitionShell` is mounted globally and works (fail-open, capture-phase, 1800 ms hard fallback), but `lib/cxos/transitions/registry.ts` holds exactly one entry (`/` → `/pricing`) and `CRITICAL_NEVER` (checked first, unconditionally, destination-only) denylists dashboard/billing/mail/letters/settings/etc. **Correction from verification:** the denylist is not separable from adoption — registering a denylisted room is dead code by construction, and `scripts/cxos-journey.test.ts:86-91` guard-pins the denylist tokens. Extending transitions to product rooms is a **governed policy change**, not a registry append.
3. **The MOVE→TRAVEL→ARRIVE grammar exists but has never shipped.** [PARTIALLY TRUE — corrected] One genuine machine exists: **THE PASSAGE** (`lib/cxos/passageTimeline.ts`: origin→call→clearance→passage→conversion→threshold→greeting→floor→returning; 933-line driver; watchdog 14 s < CSS safety 18 s ordering law), confined to `/review/mission-control-to-arena`. The Agency HQ `chamberTransition` is **intra-room only** (binary settled|passage across 7 districts in one document) — and its room-to-room exit is literally `window.location.assign()` (`useCxosRoomRuntime.ts:1283`): the exact CLICK→PAGE pattern under complaint, inside the flagship cinematic prototype.
4. **Most rooms give zero navigation feedback.** [CORRECTED COUNTS] 22 pages are `force-dynamic`; only 4 `loading.tsx` exist (dashboard, journey, tradelines, community — all inside the force-dynamic set), so **18 force-dynamic rooms have no Suspense boundary**: the old room stays frozen-but-interactive during the server fetch, then hard-swaps. No global progress affordance, no scroll-restoration management, no View Transitions API anywhere. The 4 existing skeletons each mount **a third fresh AppShell** per navigation.
5. **Arrival ceremonies replay on every re-entry — by pinned design.** [CORRECTED] `MissionEntry` (7.3 s first / 1.1 s returning) and `ArenaEntry` (8.6 s first / 1.1 s returning) veil on every within-session re-entry because their host pages remount. Verification showed this replay is **documented, test-pinned design intent**, not a bug — but it stacks a repeating tax on top of the remount and is a Founder design decision to revisit once a persistent shell exists.
6. **Motion capability policy is fragmented in the product.** CXOS has a disciplined tier ladder (`detectTier()` A/B/C/D, reduced-motion always wins) and even two parallel resolvers; the main product has **no central motion policy module** — each component reads `matchMedia` itself, governed only by a design doc.

**Answer to the primary question:** yes — the frontend can be evolved into one continuous operating environment, and most of the hard machinery already exists in-repo. The gap is structural (no persistent shell) and adoption (grammar locked behind `/review`), not invention.

---

## 3. What already works and must be preserved

- **`TransitionShell` + registry** (production, fail-open, links stay real links, 1800 ms escape hatch) — extend, never replace.
- **`detectTier()` A/B/C/D ladder** (`lib/cxos/capability.ts`) — reduced-motion always resolves first; reuse wholesale.
- **`reviewBuildAllowed()` hard-off** — the proven pattern for shipping cinematic work invisibly; all T1 work sits behind it.
- **CXOS Core Runtime** (ADR-0040): pure policy module + headless hook, sequence-based stale-cancellation, WAAPI cleanup net, safety-timeout settle — frozen at `f7ee9c5`; treat as reference, adopt incrementally per ADR-0040's own procedure.
- **THE PASSAGE timing discipline** (single-source constants mirrored to CSS, guard-tested; journey-end < JS watchdog < pure-CSS safety fade).
- **GCL site production state** (live, hash-locked assets, prologue watchdog/epoch-release machinery) — untouchable by this initiative.
- **Global `:focus-visible` law** (`app/globals.css:123-126`) — single rule covering every control.
- **`ThresholdGate` lazy-load discipline** (reduced-motion visitors download zero cinematic bytes).
- **HELIOS laws** (as concepts): history commits at settlement; second destination ignored in transit; governed Esc; separate travel/arrival clocks; RM keeps state changes instant ("full citizenship").
- **Skeleton design law** in the 4 loading.tsx files (shape-matched, never spinners).

## 4. Background readability — verdict: **PARTIAL**

The Founder's brightness complaint has a real, traceable correction lineage — inconsistently preserved:

- **CXOS Agency HQ — corrected, then regressed (currently production-inert).** RC1 (commit `dbea394`, the Codex-lineage Living Environment engine) implemented a genuine recede law: `.districtEnvironment` opacity **0.30** during reading/inspecting, **0.46** idle-settled, **0.38** tier C/D — against a 0.92 operating-state base. RC2's motion restoration (`fdfb940`, self-disclosed in its commit message) raised reading to **0.42 (+40 %)** and added a brighter **0.72** settling intermediate; per-chamber settle opacities now 0.42–0.54. The regressed values are live at current `main` HEAD (`agency-command.module.css:8270/:8294`) but have **zero production exposure** (the /review 404). The tier C/D floor (0.38) survived untouched.
- **GCL site — mostly fixed, one open AA failure in production.** Gateway-G dimming regression: caught, fully reverted, structurally locked (mark never has filter ancestors — verified at 84 states). SKIP/REPLAY chip luminance: genuinely fixed at R4.2 with inline contrast math. **Ecosystem wing: full-motion dim 0.5 composites wing text at 2.8–3.2:1 (below AA) and remains unfixed through R4.6.1 in production; only the reduced-motion path got the 0.82 floor.** Correction from verification: this IS observable on this Mac — the Playwright harness overrides forced reduced-motion per context and the repo's own R4.6.1 evidence contains full-motion captures.
- **Main product — no environment-recede system exists at all.** Mission Control's GXL materials follow a real low-luminance law (single 0.05-alpha key light; recessed-past 0.72 "AA holds"), but there is no scrim/backdrop token anywhere; nothing to regress because nothing was built.

**Treatment decision (per brief):** preserve the Codex/RC1 approach; do **not** re-darken anything now. T2 hardens the existing mechanism: re-assert RC1's reading-state values (or Founder-ratified replacements) as a pinned contract before any CXOS promotion, and adopt the state-aware contrast model (environment recedes in operating/reading states — the attention states already exist) as the dynamic-contrast option. The Ecosystem-wing 0.5 fix is a small, separate, site-side craft item — already the report's "next craft item."

## 5. Frontend-design skill mapping (principles → repository evidence)

| Skill principle | Status | Evidence |
|---|---|---|
| Distinctive direction, not templated defaults | **ALREADY** (cinematic surfaces) / **PARTIAL** (product rooms) | CXOS chamber signatures, GXL Watch Floor material laws, GCL prologue vs. utilitarian Tailwind rooms |
| Hero/orchestrated moment as thesis | **ALREADY** (entrances) / **MISSING** (navigation) | Threshold, MissionEntry/ArenaEntry, GCL prologue exist; room-to-room movement has zero orchestration — the precise gap |
| Concentrate motion in high-impact moments | **PARTIAL** | Boldness is all spent on first entry; the highest-frequency moment (travel between rooms) has none. The transition runtime is the skill-conform answer |
| Page-load choreography | **ALREADY**, miscalibrated | Ceremonies replay per re-entry (pinned design + remount); recalibrate after persistent shell |
| Hover/interaction states with hierarchy | **PARTIAL — inverted** | Global focus-visible law is exemplary; but Level-1 spatial controls (Sidebar/MobileNav, facilityDirectory) have the least treatment (no hover choreography; facilityDirectory lacks `:hover`/`:active` entirely) while lesser cards have proximity effects |
| Ambient atmosphere subordinate to content | **PARTIAL** | CXOS budget model (0/1/2 continuous channels) is exemplary discipline; readability PARTIAL (see §4); marketing auroras run infinite with 72 px blur |
| Reduced motion respected, not amputated | **ALREADY** (CXOS/GCL) / **PARTIAL** (product) | Tier ladder + three-motion-class model vs. fragmented per-component matchMedia, one smooth-scroll leak (`Composer.tsx:31`), SiteNav mobile menu with no motion at all |
| Restraint: one signature element | **GUIDING RULE for T2+** | The journey itself becomes the signature; rooms stay quiet |
| Typography/copy principles | **N/A** | Out of initiative scope; no evidence of failure |

**Smallest set of changes → largest experiential improvement:** (1) persistent shell; (2) journey runtime wired to navigation with skeletal departure/arrival; (3) travel feedback for all rooms; (4) governed registry extension; (5) Level-1 portal treatment. Everything else is polish on top.

## 6. Transition runtime architecture (T1 — implemented this session)

A **journey state machine** synthesizing the three proven in-house grammars — spec: `T1-SPEC.md` (binding):

- Phases `settled → intent → departing → traveling → arriving → settled`, plus `recovering`; Founder grammar mapped 1:1 (acknowledgment and readiness are events).
- **Laws:** CXOS sequence-based stale cancellation (never block input); HELIOS route-commit-once at the departing→traveling boundary; retarget supersedes pre-commit, is ignored post-commit; governed Esc cancel pre-commit; separate named clocks per phase with deterministic destroy; fail-open readiness timeout (1000 ms, T1.2 amendment — was 1400 ms) + journey hard cap (1800 ms) that force-settles the MACHINE's own state (never touches the router or `location`) — the ADAPTER's separate, independent router-verify fallback timer is the only thing that ever performs `location.assign`, and only for a genuinely failed push (navigation can never be lost); immediate mode for tier C/D & hidden documents (deterministic INTENT → DESTINATION → ACTIVE, no veil).
- Pure TS machine (injectable clock) + React adapter (`useSyncExternalStore`, StrictMode-safe) + TravelLayer (opacity-only veil; pointer interception only during traveling; `aria-live` announcements; focus handoff on settle) + `RoomReady` beacon.
- Demo: 3 rooms over **real router navigation** at `/review/transition-runtime/*`, inheriting the production 404 hard-off.
- Deterministic guard suite (manual clock, 16 behavioral cases + purity/isolation gates), repo guard-script style.

## 7. Implementation plan — waves

**T1 — Transition Runtime Foundation** *(this session; see checkpoint doc for results)*. Rollback: delete branch.

**T2 — Persistent Shell + Departure/Arrival Grammar.** Route-group layout `(rooms)/layout.tsx` hosting a single AppShell (44 pages de-duplicated; loading.tsx de-shelled); wire the journey runtime for 2–3 flagship pairs (dashboard ↔ agency ↔ arena) with skeletal departure (environment recede via existing attention states — this is the readability hardening) and arrival sequencing (identity → operating surface → controls → ambient); Founder decision on re-entry veil policy applied here. Acceptance: chrome DOM nodes survive navigation (verifiable via element identity); no ceremony replay without design intent; reduced motion = instant deterministic; CLS ≤ 0.05; rollback = revert branch.

**T3 — Portal & Spatial Interaction Controls.** Governed `CRITICAL_NEVER`/registry extension for room pairs (Founder ruling + `cxos-journey` guard update in the same change); Level-1 treatment for Sidebar/MobileNav/room selectors (hover illumination, press, destination preview, depth — token-driven); unify the two motion-token vocabularies (`--dur-*` vs `--cxos-*`, one drifted value known); mobile drawer gets real focus trap/inert + Escape.

**T4 — Ambient Room Motion.** Adopt the CXOS budget model (0–2 continuous channels, attention/idle states) into flagship rooms; Kai presence cues; pause marketing auroras when hidden; ambient stays subordinate (budget 0 while reading).

**T5 — Mobile + Reduced Motion + Performance Hardening.** `env(safe-area-inset-bottom)` for the bottom tab bar; visualViewport handling; central motion-policy module for the product (port the GCL `lib/motion.ts` single-choke-point pattern); production LoAF/CLS instrumentation (today it exists only in the QA harness); physical-device validation pass; bundle discipline check.

Each wave: separate branch, review-gated where visual, guard scripts extended, no production activation without Founder approval.

## 8. Founder decisions queued (none block T1)

1. **T2 authorization** — the persistent-shell migration is the one structural change (44 pages, mechanical, revertible).
2. **Registry/denylist policy** — which room pairs may animate; requires amending the guard-pinned `CRITICAL_NEVER` law (T3 gate).
3. **Re-entry veil policy** — keep/shorten/first-visit-only for MissionEntry/ArenaEntry once the shell persists (current behavior is pinned design).
4. **CXOS readability values** — re-assert RC1's 0.30/0.46 recede (or ratify RC2's 0.42/0.72) before any CXOS promotion to production.
5. **Ecosystem wing 0.5** — approve the small full-motion contrast fix on the live GCL site (separate surface, separate change).

## 9. Environment facts that shaped verification

- This Mac forces `prefers-reduced-motion: reduce` in every Chromium — live browser checks here always exercise the reduced/tier-D path. Full-motion paths are verifiable via Playwright per-context emulation (proven by the repo's own R4.6.1 evidence) — motion-path claims in this program must come from that harness or tests, never from pane screenshots.
- The `~/Documents/gabriel-capital-labs-to-upload` clone holds uncommitted M2 billing work: untouched, and no T1 file overlaps any P0/M2/billing/schema surface.
