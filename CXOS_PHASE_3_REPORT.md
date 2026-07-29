# CXOS Phase 3 — The Living Landing Journey · Vertical Slice Report

**2026-07-29 · branch `feat/cxos-phase3` · Status: BUILT, ADVERSARIALLY VALIDATED, DELIVERED FOR FOUNDER REVIEW**
**No merge. No production deployment. Feature branch only.**

> The landing page is no longer a stack of sections — it is one descent. The Threshold opens
> into the Hero; the Hero gives way to the **Problem Chamber** (three bureaus, three versions
> of the story, nothing connected); scrolling on, **Intelligence Awakens** (the same facts
> align into one classified evidence column); and the first registered **cinematic route
> transition** resolves the environment into the calm commercial surface of `/pricing`.
> Native scroll stays authoritative everywhere. Design truth: `CXOS_PHASE_3_JOURNEY.md`.

---

## 1. Exact repository state

| Item | Value |
|---|---|
| Branch | `feat/cxos-phase3` (successor of `feat/cxos-threshold`, per mandate) |
| Base | CXOS Phases 1–2 + Founder Review System (`68cb304`) **merged with production truth `f449c35`** |
| Merge commits | `7b1d2fd` (merge of origin/main) · `0e3957e` (merge fix: billing/agency pages keep the terms-acceptance superset — the blunt `--theirs` resolution broke `terms-acceptance.test.ts` 8/78; caught and corrected, 78/78 again) |
| Implementation | `00ffc2c` (slice) · `691ea7a` (Stage 5 fix) |
| Production HEAD (verified) | `f449c35` — the owner merged PRs #8 and #9; both release units run in production |
| Live preview (protected by Vercel Authentication) | `https://gabriel-capital-labs-git-feat-cxo-06bc43-rey-gabriel-s-projects.vercel.app` — the stable branch alias; every push to `feat/cxos-phase3` rebuilds it with review instruments auto-enabled |
| Review doors | `/review` (hub) · `/review/landing` (journey stage) · `/?director` (live console) |
| Repository status | clean; all work committed and pushed |

## 2. What was built (Stage 4 — the smallest complete vertical slice)

**Threshold → Hero → Problem Chamber → Intelligence Awakens → cinematic transition → /pricing → back.**

### The chapters (Level 2 motion — scroll-directed, 0.8–2.5 s per transformation)

- **CH 1 · The Problem Chamber** (`#problem`) — three bureau fragment cards (one account, three
  tellings: $8,214 · $7,940 · "Closed — not reported"), scattered and slightly drifting APART
  on scroll; an unattached "31 days — response window" chip; the page's darkest lighting.
  Uncertainty is felt, never argued. All fragments are `aria-hidden` illustrative visuals with
  the repository's honest "Illustrative example." caption; the copy holds the CROA bar (facts
  about fragmentation, zero outcome promises).
- **CH 2 · Intelligence Awakens** (`#awakens`) — the same three tellings align into ONE evidence
  column: rows settle to zero rotation/offset by p=0.6, classification chips light in sequence
  ("Cross-bureau mismatch" · "Potential inaccuracy" · "Unverifiable" — terms from existing
  copy), the evidence spine draws (the Draw primitive), the deadline docks as "Response window ·
  tracked". Kai is present as the executive intelligence wordmark only — no mascot, no avatar.
  Body copy is VERBATIM from the landing's existing step 2.

**Engine:** `JourneyRuntime` stamps `html[data-cxjourney="A|B|C"]` and writes each chapter's
scroll progress into its `--cxp` custom property — rAF-throttled passive listeners, IO-gated,
one `scrollY` read per frame, transform/opacity-only CSS (the repository's own unused
`Parallax.tsx` "foundation for the future cinematic homepage" discipline, generalized). ALL
choreography is CSS on `--cxp`, scoped under the tier stamp: **the no-JS / reduced-motion /
tier-D document matches none of it, so the rest state IS the server-rendered page.** CH 1 rests
in its scattered composition; CH 2 rests RESOLVED — the narrative survives without motion.

### The capability policy (`lib/cxos/capability.ts`)

Tier A desktop full choreography + depth planes · B mobile single-plane · C (saveData /
deviceMemory < 4) settles only + 280 ms crossfades · D (reduced motion / footer toggle) nothing.
Decision order is a safety order — reduced motion first, absolutely; every detection failure
downgrades. A user-facing **"Cinematic effects: on/off"** control lives in the site footer
(navigation law 5), persisted in `localStorage`.

### The cinematic route-transition system (Level 3 — 0.4–1.5 s)

`lib/cxos/transitions/registry.ts` + `components/cxos/transitions/TransitionShell.tsx` (root
layout, persists across navigations, renders null when idle):

- **`CRITICAL_NEVER` is consulted before the registry** — login, register, billing, dashboard,
  api, legal, support, settings, admin, onboarding, upload, letters, mail, identity, review,
  checkout can never be staged, by construction.
- Only a **plain left-click** on a same-origin, non-download, non-`_blank` link is considered;
  nothing is `preventDefault`ed before a registry match. Middle-click, ctrl-click, new-tab,
  copy-link, back/forward (`popstate` untouched) all behave natively.
- **Navigation is never hostage:** `router.push` fires at cover-in end (≤ 450 ms after click);
  an **unconditional 1800 ms `location.assign` clock** guarantees arrival; Escape skips; the
  overlay is pure CSS in the sync bundle (no lazy chunk can strand a navigation); after the
  first full play per session, repeats run the short 280 ms projection (Director runs never
  consume the counter).
- One transition registered: **`/` → `/pricing` — "The commercial surface"**: ink veil rises,
  two hairline teal rails meet center (420 ms), the destination paints beneath, rails part onto
  the calm pricing surface (520 ms), and the pricing `h1` receives focus. Prices are fully
  legible the instant the veil parts — nothing about checkout is touched.

## 3. Founder Review System integration

- Room registry: **`landing-journey` (PROTOTYPE)** — the hub now shows two PROTOTYPE rooms.
- **`/review/landing`** — the room stage: full-journey door, per-chapter doors, the transition
  door, and all projections (tier A/B/C/D previews, no-JS, timeout simulation).
- **JOURNEY director strip** (`?director` on the landing): live chapter + `--cxp` readout,
  active tier, tier-projection cycling (reduced-motion / low-power previews — a reduced-motion
  visitor's tier D is locked and cannot be overridden), chapter-boundary outlines.
- **`?cxsim=timeout`** (review builds only): suppresses the navigation so the Founder can watch
  the 1800 ms fail-open clock win by itself. Behaviorally proven inert on production builds.

## 4. Stage 5 — adversarial validation

**Playwright battery: 41/41** against the review-enabled production build —
scroll-authority (wheel moves the window; `--cxp` advances; no handler seizes anything) ·
in-page anchors and critical routes untouched · veil covers → arrival < 1.6 s → veil gone →
h1 focused → prices legible · back/forward with no replay · returning-user 140 ms projection ·
ctrl-click untouched · rapid double-click = one clean arrival · Escape skip · timeout
simulation (veil held, clock forced arrival) · reduced motion (no stamp, resolved rest states,
instant navigation, no veil ever) · footer toggle (persists; tier D on reload) · no-JS (full
content visible; pricing reachable as a plain link) · 320 px (tier B, no horizontal overflow) ·
director instruments · Threshold seam intact (pre-paint darkness, Escape → hero, session
marker).

**Production hard-off build: 6/6** — `?director` shows nothing, `cxsim` inert, `/review` and
`/review/landing` render "not enabled"; the journey and the pricing transition remain public
features (they are product surface, not instruments).

**Guard: `scripts/cxos-journey.test.ts` — 35 checks**, non-vacuity proven by four mutations
(denylist removal · reduced-motion-first removal · fail-open-clock removal · wheel-handler
introduction), each driven RED and restored byte-identically. The first denylist mutation was
MISSED — the check used `indexOf` ordering, vacuous when the line is absent (−1 < anything);
the guard was rewritten to require presence and re-proven. Recorded honestly, same as the
Phase 2 precedent. **Full suite: 82 source guard files + 5 runtime guards green; `tsc` clean.**

**Two real defects were caught by this battery before delivery** (both fixed in `691ea7a`):
1. `JourneyRuntime` initialized its tier state at `"A"`, so on matching desktops the detection
   `setState` was a no-op and the stamp never applied — the journey silently didn't run on the
   most common device class. Tier state now starts `null`.
2. The timeout simulation originally froze only the CSS, not the navigation — it could not
   demonstrate the fail-open clock. It now suppresses `router.push` so the clock provably wins.

**Known pre-existing behavior (proven, not caused by Phase 3):** browser-back into a *hash*
history entry (the nav's plain `#how`-style anchors) updates the URL but does not re-render
under the App Router; a second back restores fully. Reproduced identically on a clean build of
production `f449c35`. Phase 3 never touches those clicks (the same-pathname return precedes any
`preventDefault`) and never listens to `popstate`.

## 5. Performance

| Budget | Target | Measured |
|---|---|---|
| Landing first-load JS | ≤ 102 kB | **99 kB** review-enabled · 98.9 kB production (baseline 97.7) |
| Landing rendering | static | **`○ /` static, unchanged** |
| New dependencies | 0 | **0** (three/gsap remain Threshold-chunk-only) |
| New WebGL contexts | 0 | **0** |
| New lazy chunks | 0 | **0** — chapters + shell are CSS/DOM in the sync bundle (~1.3 kB net) |
| CLS from journey | 0 | transform/opacity only; content visible by default |
| Scroll frame cost | no layout thrash | 1 `scrollY`-equivalent read/frame, IO-gated, rAF-throttled |
| Cover-in before navigation | ≤ 450 ms | 420 ms (A) · 340 ms (B) · 140 ms (repeat/C) |
| Fail-open ceiling | 1800 ms | proven live by the timeout simulation |
| LCP | unchanged | hero untouched; runtime mounts post-hydration below the fold |

Frame metrics in this container run on SwiftShader — a floor, not a ceiling. The Director
strip's live readout on the preview is the real measurement instrument.

## 6. Accessibility

Reduced motion = tier D **absolutely** (first signal read; Director cycle cannot override it) ·
all chapter copy server-rendered semantic HTML, headings in document order · chapter visuals
`aria-hidden` + honest captions · veil `aria-hidden`, Escape-skippable, destination h1 focused
(`preventScroll`) · no wheel/touch handlers, no focus traps, no pinned scenes · find-in-page,
anchors, keyboard navigation all untouched · footer toggle is a real `aria-pressed` button ·
no flashes (the veil is a single opacity ramp in the house ease) · no sound anywhere in Phase 3.

## 7. Asset manifest & licensing

**Zero new asset bytes; zero new dependencies.** Chapters and transitions are procedural
CSS/DOM. Higgsfield was evaluated per the mandate and **deferred**: nothing in this slice needs
generated media to hold the bar; environmental plates become candidates only in later phases
through the mandated checklist (purpose, license, fallback, size, mobile, reduced-data,
measurement). Existing: three@0.185.1 (MIT) · gsap@3.15.0 (standard no-charge license) — both
lazy Threshold-chunk-only, unchanged.

## 8. Failure scenarios (each exercised)

| Failure | Outcome |
|---|---|
| JS disabled / hydration fails | full server page at rest state; pricing reachable as a plain link (proven) |
| Transition never arrives | 1800 ms `location.assign` (proven via simulation) |
| Escape mid-transition | immediate open-out + arrival (proven) |
| Storage unavailable | treated as first play / preference off; wrapped in try/catch |
| Hidden tab | progress writes pause (`document.hidden`) |
| Rapid repeated clicks | one journey at a time; single clean arrival (proven) |
| Capability detection throws | conservative tier C (guard-pinned) |
| Reduced-motion visitor | never enters any of it (proven) |

## 9. Rollback

The slice is additive: revert `691ea7a` + `00ffc2c` and the landing is exactly the Phase 2
page. No schema, no data, no dependency, no route removed. The merge commits (`7b1d2fd`,
`0e3957e`) are reconciliation with production truth and survive any Phase 3 rollback.

## 10. Known limitations

- Chapters 3–7 (Evidence Engine, Two Paths, Operator Network, Arena Signal, Conversion Gate as
  full chambers) are **future phases** — today those sections ship exactly as they already
  exist. The Arena is honestly absent (nothing is faked).
- One route transition is registered; the taxonomy (corridor, aperture, clearance) exists in
  the registry design but only "resolve" ships. Each future entry is one registry row + reuse.
- The hash-back App Router quirk predates Phase 3 (proven); if the Founder wants it fixed, the
  nav's plain anchors can become router-aware links in a future change — product decision, not
  taken unilaterally.
- Container frame metrics are software-GL floors; real-hardware numbers come from the preview.

## 11. Founder decision block

```
[ ] Approve architecture        (tiers, registry, shell, runtime, guards)
[ ] Approve narrative           (Problem Chamber → Intelligence Awakens beats)
[ ] Approve visual direction    (fragments, evidence column, veil-and-rails)
[ ] Approve motion language     (--cxp choreography, the six primitives held)
[ ] Approve interaction language(native scroll, real links, Escape, fail-open)
[ ] Approve performance         (99 kB static landing, 0 new deps/chunks)
[ ] Approve accessibility       (tier D absolute, rest states, focus handoff)
[ ] Approve vertical slice      (expand to Chapters 3–7 + more transitions)
[ ] Reject
[ ] Request changes             (scrub to any beat and reference chapter + p=)
```

---

*Feature branch only. No merge, no production deployment, no schema, no migrations, no Stripe
mutation, no pricing change, no legal-copy change, no production contact. Review instruments
are provably absent from production builds.*
