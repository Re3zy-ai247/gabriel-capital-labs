## R4.3 · Founder Experience Closure — Final Report (2026-08-08)

**Verdict: READY WITH DISCLOSURES.** All four Founder Experience blockers are closed. The full
unfiltered schema-v1 confirmation is `passed` and `attestable`: 30/30 scenarios passed, zero
failures, zero unexpected telemetry, and 45 screenshots. Both pre-implementation read-only audits
were incorporated; the fresh post-implementation adversary returned PASS with no confidence-8+
actionable blocker.

**Durable path:** branch `codex/gcl-r4-3-founder-closure-2026-08-08` · base
`3600ae2c9cd92d193c2228773420c7ec31e24be2` · implementation commit
`655a4eec8cb6076c95803f20d60cd8c433dfdc3b` · protected preview
<https://gcl-institutional-site-evo51qmqh-rey-gabriel-s-projects.vercel.app> · Vercel preview
Ready, unauthenticated 302 → SSO, authenticated 200, `x-robots-tag: noindex`. Main was not merged.
Production was not deployed. CreditVector, GIOS, HELIOS, DNS, and canonical Gateway G assets were
not changed.

### R4.3.1 Founder findings

| Finding | Final disposition |
|---|---|
| GIOS shifted relative to the other Ecosystem domains | **PASS** — removed the authored GIOS-only `offset`; all four title origins now have 0px final spread in every tested full/reduced state. |
| Engagement/contact vertically compressed | **PASS** — Engagement now owns marker, six consistent rows, and subordinate status with height-aware rhythm; Footer is separated after the Outro. |
| Gateway G too close to `06 — ENGAGEMENT` | **PASS** — no G remains in Engagement; its closing role moved to a distinct central field. |
| Approved closing sentence behaved as ordinary copy | **PASS** — exact two-line sentence now resolves as the dominant verbal beat of a full Institutional Outro and holds before Footer release. |

### R4.3.2 Ecosystem alignment

Root cause: `WING_VARIANTS` gave only GIOS the `offset` variant, and desktop CSS added
`margin-left: clamp(2rem, 6vw, 5rem)` to its header. At 1440px that was an 80px static shift;
animation endpoints already resolved to `x: 0`. R4.3 removes the one-off variant/rule, establishes a
fixed `3rem` numeral column, and shares title/description origins and measures. Directional entrance
sequencing remains.

| Viewport | Full title x | Reduced title x | Max four-title spread |
|---:|---:|---:|---:|
| 1920×1080 | 372px | 372px | 0px |
| 1512×982 | 164.469px | 164.469px | 0px |
| 1440×900 | 125.594px | 125.594px | 0px |
| 1280×720 | 119.188px | 119.188px | 0px |
| 1024×768 / 1024×568 | 108.953px | 108.953px | 0px |
| 430×932 / 390×844 / 320×568 | 88px | 88px | 0px |

The binding maximum is 2 CSS pixels; every one of the 18 matrix cases measures exactly 0px.

### R4.3.3 Engagement before and after

Before, Engagement stacked marker, G, headline, six rows, status, width-derived `12vw` padding,
Footer border, Footer, and Replay. There was no explicit marker-to-G gap, yet compact 1024×568
received 122.9px top and bottom padding. After, Engagement is an editorial chapter with the
semantic `06 — ENGAGEMENT` heading, unchanged six categories/descriptions, subordinate status,
height-aware `svh` spacing, and preserved `#contact` ownership.

Measured marker→rows / status / bottom gaps are 81 / 45 / 126px at 1440×900; 72 / 32 / 96px at
1024×568; and 56 / 32 / 80px at 320×568. Horizontal overflow is 0px throughout. Six row heights
are consistent within the expected 1px boundary at representative desktop sizes. The final DOM
order is Engagement → Institutional Outro → Footer.

### R4.3.4 Gateway G relocation and Institutional Outro

`InstitutionalOutroScene` is a new semantic full visual chapter after Engagement. The section
remains in normal flow and pins only its inner desktop field. Its near-black field, restrained gold
signal, composition, mark wrapper, untouched image, and exact two-span h2 are separate layers. The
Footer remains an ordinary subordinate sibling after the scene.

Narrative: Engagement recedes naturally → near-black field → gold architectural signal → canonical
G → “Enter the future” / “we are engineering.” → resolved hold → minimal Footer.

- Full desktop: one timeline-hosted `gcl-institutional-outro` ScrollTrigger, `+=100%` inner pin,
  restrained opacity/scale/depth, ~24% final hold.
- Third Motion Class: same story with one `+=60%` inner pin; opacity/luminance only; all sampled
  signal, wrapper, line, and image transforms are `none`.
- Mobile: full-height chapter in normal flow and no new Outro pin.
- Stable pin topology: 5 desktop full / 5 desktop reduced / 2 mobile full / 0 mobile reduced;
  zero nested spacers and exactly one Outro trigger.

At full-motion progress 0.22, signal opacity is 0.875 while mark/message are 0; at 0.46, mark is
0.999 while both lines remain 0; at 0.88 and 0.97, mark/message stay fully resolved at identical
resting transforms. Reduced motion preserves the same order and hold without spatial movement.

### R4.3.5 Gateway G integrity

The locked 480/768/1080 WebP and 480 PNG hashes are unchanged. The Outro reuses the 480×520 WebP
and PNG fallback. Across entry, reveal, hold, Replay, reduced motion, compact desktop, and mobile,
the image itself is opacity 1, `transform: none`, `filter: none`, normal blend, unmasked, unclipped,
and within 0.02% of 480:520. Motion is wrapper-only. Engagement contains zero Gateway G marks.

### R4.3.6 Replay and inert regression

Arrival source/lifecycle was not changed. The new Outro simply becomes a ninth top-level
prologue-owned inert target.

- Engagement → Escape, Outro → keyboard SKIP, and the real Footer button → natural completion all
  acquire scrollY 0, nine owned/inert targets, hidden Replay, and hidden overflow.
- Every release leaves zero owned markers, zero unintended inert, no prologue/replaying classes,
  visible overflow, focus on Replay, and the “Introduction complete” live announcement.
- Pin count remains five, one Outro pin, zero nested pins, and exactly one active Replay bridge
  listener after each cycle.
- A real independently inert Footer fixture remains inert and unowned through acquisition/release.
- Reduced-motion Outro Replay passes; mobile Replay bypass has no lock/inert and preserves two pins.
- Direct `/#contact` bypasses Arrival and lands at 84.171875px under full and reduced policies.

No stale overlay, stale lock, duplicate listener/timeline/ScrollTrigger, focus loss, or interaction
defect was found.

### R4.3.7 Responsive, accessibility, performance, and evidence

The matrix covers 1920×1080, 1512×982, 1440×900, 1280×720, 1024×768, extra 1024×568
compact-height stress, 390×844, 430×932, and 320×568 under full and reduced motion. All 18 cases
pass Engagement rhythm, Footer separation, exact two message lines, mark containment, pin topology,
navigation, and zero overflow. Independent visual inspection found no collision, clipping,
distortion, Footer leakage, or desktop motion leakage into mobile.

Diff-scoped axe at `#contact`, `#institutional-outro`, and `footer` reports zero violations in both
policies. Heading order remains one h1 followed by semantic chapter h2s; the Outro accessible name
is exact. This changed-region result is not mislabeled as a whole-document pass at arbitrary
mid-animation scroll positions; frozen R4.2 retains the composed whole-document result.

Typecheck, lint, production build, harness syntax, and `git diff --check` pass. Browser telemetry,
page errors, console errors, hydration warnings, NaN styles, and horizontal overflow are zero.
Local static timing is 4.3ms response start, 126.8ms DOMContentLoaded, 209.5ms load, 11 resources,
and 1,007ms wall time including composed-state wait. The protected Vercel build compiled,
typechecked, generated four static pages, and reached Ready.

Authoritative evidence:
[`../assets/r4-3/r4-3-confirmation-results.json`](../assets/r4-3/r4-3-confirmation-results.json).
Frames: [1440 Engagement](../assets/r4-3/matrix-full-1440x900-engagement.png) ·
[1440 Outro](../assets/r4-3/matrix-full-1440x900-outro-hold.png) ·
[1024×568 stress](../assets/r4-3/matrix-full-1024x568-outro-hold.png) ·
[320×568 Engagement](../assets/r4-3/matrix-full-320x568-engagement.png) ·
[320×568 Outro](../assets/r4-3/matrix-full-320x568-outro-hold.png) ·
[reduced hold](../assets/r4-3/narrative-reduce-0-88.png) ·
[three Replay origins](../assets/r4-3/replay-three-cycles-complete.png).

### R4.3.8 Gate trail and disclosures

| Gate | Verdict |
|---|---|
| Composition auditor | **DONE WITH CONCERNS → RESOLVED** — exact static root cause and rhythm risk are closed in measurements/screenshots. |
| Motion/accessibility auditor | **PASS AFTER IMPLEMENTATION** — prescribed lifecycle, motion classes, mobile protection, and topology all pass. |
| Fresh adversary | **PASS** — no confidence-8+ actionable blocker after independent source/evidence/visual review. |
| Compliance | **GO** — no category claim changed; exact approved institutional copy moved; no pricing, credit outcome, consumer-report, dispute, billing, or subscription claim; no Critical/High issue or counsel escalation. Internal review is not legal advice. |
| Security | **PASS WITH INHERITED DEBT** — no confidence-8+ finding and no new external/data/auth surface. Next 14.2.18 advisory debt is inherited and reachable only if the prohibited Next request runtime is exposed; deployment is static-export-only. |

This AI-assisted review is not a substitute for a professional security audit or penetration test.

Disclosures:

1. Automated browser evidence is Chromium-only; Safari/WebKit, notched compact landscape, and
   physical-device safe-area behavior remain manual Founder checks.
2. The 1024×568 stress case is automated and independently visually inspected, not physical-device
   coverage.
3. The harness hashes nine source files, four locked assets, and the clean implementation commit,
   but not served export bytes or each PNG before setting `attestable`. The committed evidence tree
   and final ZIP SHA-256 bind the delivered bundle. The fresh adversary rated this lower-confidence
   and non-blocking.
4. Changed-region axe results must not be restated as whole-document results at arbitrary active
   animation states.
5. Inherited Next/transitive debt remains. No forced upgrade or `npm audit fix --force` occurred.
6. Prior R4/R3 behavior and disclosures remain historical below; Arrival/Replay were not reopened.
7. The prior GitHub HTTP 403 was not retried. Branch and commits remain local pending authorization.

### R4.3.9 Founder checklist

1. Protected desktop preview: confirm all four Ecosystem titles settle on one axis.
2. Engagement: marker → six rows → subordinate status, with no G in the label cluster.
3. Outro: darkness → signal → canonical G → exact two-line message → hold → separate Footer.
4. Repeat at 1280×720 and 1024×568; inspect negative space and Footer separation.
5. Review 430×932, 390×844, and 320×568 for overflow, clipping, crowding, or desktop pin leakage.
6. Enable Reduce Motion and confirm the same story with no spatial movement.
7. Replay from Engagement/Escape, Outro/keyboard SKIP, and Footer/natural completion; confirm focus,
   announcement, and interaction restoration.
8. Open `/#contact` directly and confirm the 84px Engagement landing.
9. Manually spot-check Safari/WebKit and a notched compact device.
10. Authorize merge and production separately if approved. Neither occurred here.

---

## R4 · Gateway G Institutional Prologue — Completion Report (2026-08-08)

**Verdict: READY WITH DISCLOSURES.** All six binding R4.2 rulings pass. The independent
Replay/accessibility and visual/reliability adversaries found no unresolved Replay, inert-state,
Gateway G, mobile, accessibility, hydration, or interaction defect. The final schema-v2
confirmation is unfiltered, `passed`, and `attestable`: 26/26 mandatory scenarios passed with
zero failures and zero unexpected browser telemetry.

**Durable path:** branch `codex/gcl-r4-completion-2026-08-08` · implementation/evidence commit
`43adaff3802c7deab8baa63d951cb0f1ef991c6f` · protected preview
<https://gcl-institutional-site-lnldsz5x0-rey-gabriel-s-projects.vercel.app> · Vercel target
`preview`, Ready, unauthenticated 302 → SSO, authenticated 200, `x-robots-tag: noindex`.
Main was not merged. Production was not deployed. CreditVector, DNS, Gateway G design, and the
canonical brand assets were not changed.

### R4.1 What was built and why

The institutional opening remains one continuous Arrival scene: darkness → signal → canonical G
revealed by light → hold → wordmark/thesis → the institution awakens. It is authored at 15.1s,
skippable, replayable, keyboard-operable, session-aware, and bypassed on mobile and hash routes.
Reduced motion preserves the six-beat narrative while stripping the spatial channel, per the
Founder-approved Third Motion Class.

The blocking defect was deeper than “Replay needs `overflow:hidden`.” Replay had split ownership:
scroll, root classes, inert state, timeline state, focus, and breakpoint policy could change on
different callbacks. An awaited smooth-scroll preflight captured desktop policy too early; a
1024px crossing could remount the controller, null old GSAP refs, leave inline residue on the new
mark, and erase the live announcement/focus target. A CSS watchdog could also reveal scrolling
without completing the corresponding JavaScript state.

R4.2 makes that lifecycle atomic:

- the DOM controller is preserved across width-policy changes;
- a component-lifetime replay guard survives effect rebuilds and rejects duplicate requests;
- desktop policy is rechecked after every awaited Replay preflight;
- first visit and Replay acquire the same root class, owned inert markers, hidden nav/Replay,
  watchdog epoch, timeline, live status, Skip, and Escape semantics;
- timer and CSS `animationend` are signals into one epoch-checked release primitive—CSS never
  unlocks independently;
- release removes only prologue-owned inert markers and converges natural completion, Skip,
  Escape, width crossing, watchdog, route, and failed acquisition on the same composed state;
- incoming mobile policy clears every inline property from mark wrapper, atmosphere, signal, and
  Skip after its own scene construction, without replacing the canonical mark DOM.

| Phase | Authored window | Treatment |
|---|---:|---|
| P1 · Darkness | 0.0–2.6s | Obsidian, pre-paint containment, Escape armed from t=0 |
| P2 · Gold signal | 2.6–5.2s | 1px signal; SKIP appears around 3s below signal luminance |
| P3 · The G | 5.2–8.4s | Canonical native asset emerges by light; no filters or redraw |
| P4 · Hold | 8.4–10.7s | Deliberate stillness |
| P5 · The words | →13.5s | GABRIEL / CAPITAL LABS, then the Founder thesis |
| P6 · Awakening | →15.1s | Atomic release, nav/replay return, R3 site continues |

### R4.2 Six binding rulings — final disposition

| Ruling | Result | Executable proof |
|---|---|---|
| **R-1 · True Replay** | **PASS** | Replay locks like first visit, owns eight inert markers, hides nav/Replay, keeps SKIP/Escape, announces start/complete, restores focus, survives three cycles, rejects a duplicate request during the 1.5s preflight, and recovers from width/policy changes without listener/timeline/ScrollTrigger accumulation. |
| **R-2 · Single source + 22s release** | **PASS** | `html.gcl-prologue` at mount is the strict source of truth. Timer and CSS signal share one epoch-checked atomic release. Slow hydration releases at 23,535.5ms and mounts composed; pre-hydration mobile crossing, route/hash bypass, storage denial, and absent class cannot acquire inert. |
| **R-3 · Zero crossing residue** | **PASS** | Crossings at 1.5s, 3s, and 6s leave no inline mark/atmosphere/signal/Skip transform or opacity residue, no page errors, no extra pins, and no atmosphere animation on mobile/reduce. Current and exact R3 control both preserve the 120×130 canonical mark. |
| **R-4 · Phone tagline** | **PASS** | 320/360/375/390/393/412/430px each render exactly two balanced lines, ratio 1.223, no clipping or horizontal overflow, and no desktop/tablet width constraint. |
| **R-5 · SKIP hierarchy/focus** | **PASS WITH EXPLICIT EXCEPTION** | Resting composite RGB(166,57,23) is 3.103:1 against RGB(6,6,8), meeting the binding 3:1 UI-control floor while remaining below the signal luminance; hover/focus restores full gold. SKIP/Enter and skip-to-content land on `arrival-heading` with zero inert residue. This is not an unqualified WCAG 1.4.3 small-text claim; see §R4.5. |
| **R-6 · Timing disclosure** | **PASS WITH DISCLOSURE** | Authored beat table is 15,100ms. Current CPU-6× full motion unlocks at 14,550.7ms and completes at 16,130.7ms; reduce unlocks at 14,403.4ms and completes at 15,941.8ms. The earlier combined CPU-6× + Slow 3G run reached 26,635ms. Authored choreography and throttled wall time are reported separately. |

### R4.3 Verification and measured evidence

The authoritative manifest is
[`assets/r4/r4-confirmation-results.json`](../assets/r4/r4-confirmation-results.json).
It binds the control to exact R3 commit `0c7f51501bee404539ba54b21a339141ef7d2ff6`, source digest
`83c5664e7f3a7cc4bf7bbc4591aac1023a784d910c70177e02da72642d25ae90`, 64 source/build files,
and served control index SHA-256
`5fb1bb8e8db78053a3bea69382a096f87aacbae324dadfda5a9e35c16b8e169a`.

Commands completed successfully:

```text
npm run typecheck
npm run lint
npm run build
node --check scripts/r4-confirmation.mjs
git diff --check
GCL_CONTROL_ROOT=/private/tmp/gcl-r3-control.1NPga3/apps/gabriel-capital-labs-site npm run test:r4.2
```

Results:

- schema v2, full unfiltered run, `status: passed`, `attestable: true`;
- 26/26 mandatory scenarios passed; 0 failures; 0 unexpected telemetry;
- one deliberate missing-route 404 was narrowly classified and retained as expected telemetry;
- axe-core 4.13.0: zero composed-state violations under full and reduced policies;
- Playwright Core 1.62.0 and axe are dev-only, locally resolved, and integrity-locked;
- all 18 referenced PNGs are valid, dimension-checked, and free of stale/unreferenced captures;
- all four canonical Gateway G hashes match; no mark or ancestor filter, mask, blend, or material
  mutation exists;
- local static-export smoke: 53ms TTFB, 75ms DOM-ready, 176ms total; no console errors;
- protected Vercel preview build completed as static content and serves 200 through authenticated
  protection while unauthenticated traffic is redirected to SSO.

Key frames: [P1](../assets/r4/01-initial-no-preference-p1.png) ·
[P3](../assets/r4/02-initial-no-preference-p3.png) ·
[P6](../assets/r4/03-initial-no-preference-p6.png) ·
[three Replays](../assets/r4/07-three-replays-final.png) ·
[delayed hydration](../assets/r4/11-delayed-hydration-composed.png) ·
[390px crossing](../assets/r4/14-crossing-3s-mobile.png) ·
[SKIP composite](../assets/r4/16-skip-p2-composite.png) ·
[current/R3 parity](../assets/r4/17-control-parity-current.png).

### R4.4 Independent gates

| Gate | Verdict | Reconciliation |
|---|---|---|
| Replay / accessibility adversary | **PASS** | No confidence-8+ blocker; lifecycle, owned inert, focus, route/hash, reduced policy, cleanup, listener/timeline/ScrollTrigger invariants traced to source and evidence. |
| Visual / reliability adversary | **PASS** | R-4/R-5 pixels, canonical assets, R3 geometry, full/reduce states, mobile crossings, atmosphere gate, and axe evidence independently reproduced. |
| Verification-integrity / security adversary | **PASS** | Full-run semantics, sanitized evidence, expected telemetry, control provenance, actual-footer inert preservation, and locked local dependencies independently verified. |
| Live QA | **PASS** | 0 defects; 99/100 bounded health score; Replay/Escape state, 390px two-line composition, hash landing, console, and local load smoke verified. |
| Design review | **DONE WITH CONCERNS** | Design A-, AI-slop A. Outside dissent on SKIP and reduced motion is retained as explicit binding exceptions, not hidden or mislabeled. Chromium-only and safe-area follow-ups remain. |
| Compliance review | **GO** | Institutional animation only; no price, credit-outcome, consumer-report, dispute, debt, subscription, or money-touching claim changed. The thesis is corporate positioning. No counsel escalation required. This internal review is not legal advice. |
| Security review | **PASS WITH INHERITED DEBT** | No new confidence-8+ exploitable finding. Secret-prefix/history scan is clean; fixed inline payloads contain no user data; recorded URLs are credential-free; inert ownership is narrow. npm reports inherited Next 14.2.18/nested PostCSS advisories, but the deployment serves only `output: export` static artifacts and exposes none of the affected Next request-runtime paths. Do not expose `next dev`/`next start`; schedule a compatible upgrade. |

This AI-assisted review is not a substitute for a professional security audit or penetration test.

### R4.5 Founder-confirm items and disclosures

1. **Founder line:** Arrival now consistently reads “Building the Infrastructure for Intelligent
   Capital.” The unchanged SEO title/meta/JSON-LD still carry historical wording; reconcile in a
   separately approved content/SEO change.
2. **Chrome withholding:** first-visit navigation stays absent until P6. SKIP appears around 3s;
   Escape works from t=0; hash routes and same-session returns bypass the long opening.
3. **Replay fidelity:** Replay intentionally locks scroll like first visit, with SKIP/Escape exit.
4. **Contrast exception:** 3.103:1 satisfies the exact R-5 3:1 UI-control ruling, not blanket WCAG
   AA for 0.7rem text. Its luminance margin below the signal is only ~0.00476; rerun evidence after
   any color/opacity change.
5. **Reduced-motion policy:** the six-beat opacity/luminance narrative is the newer R3/R4 Founder
   decision and intentionally supersedes an older static-only clause still present in `SPEC.md`.
6. **Timing:** never represent the 26.635s combined Slow 3G + CPU-6× run as authored duration.
7. **Browser residual:** automated screenshots and interaction evidence are Chromium-only.
   Safari/WebKit, compact notched landscape, and safe-area positioning remain manual checks.
8. **Inherited R3 residuals remain:** ecosystem-wing contrast, the flat phone reduced-motion path,
   and the PageDown Principles behavior were not reopened by R4.
9. **Dependency debt:** Next 14.2.18 is unchanged from R3 and safe only under the stated static-only
   deployment. The preview build also reports inherited deprecated/transitive packages; no
   `npm audit fix --force` or unrelated dependency migration was performed.

### R4.6 Files changed and durable handoff

Implementation/evidence commit `43adaff` contains exactly the bounded completion surface:

- `apps/gabriel-capital-labs-site/components/ArrivalScene.tsx`
- `apps/gabriel-capital-labs-site/app/layout.tsx`
- `apps/gabriel-capital-labs-site/app/globals.css`
- `apps/gabriel-capital-labs-site/package.json`
- `apps/gabriel-capital-labs-site/package-lock.json`
- `apps/gabriel-capital-labs-site/scripts/r4-confirmation.mjs`
- `docs/reviews/assets/r4/` (schema-v2 manifest + 18 screenshots)

The final report update adds this Markdown, the authoritative historical Markdown/HTML, and the
Founder handoff archive. `.gstack` QA/design/security records remain local and ignored. The
temporary Vercel OIDC `.env.local` created during linking was deleted after the protected preview
verification; it is not in Git or the handoff.

### R4.7 Founder review checklist

1. Open the [protected preview](https://gcl-institutional-site-lnldsz5x0-rey-gabriel-s-projects.vercel.app)
   in an authenticated desktop session. Fresh tab: darkness → signal → G → hold → words → awaken.
2. Press Escape during P1, then repeat using SKIP at P2; each must compose immediately and place
   focus on the Arrival heading.
3. Click Replay Arrival three times, including once after scrolling away; each run must return to
   top, lock the page, hide nav/Replay, keep SKIP/Escape, announce completion, and restore control.
4. During Replay, resize across 1024px in both directions; there must be no stranded lock, blank G,
   page error, duplicate pin, or lost announcement.
5. Open `/#contact` directly; it must bypass the prologue and land Contact at the 84px offset.
6. Review full and reduced motion on desktop. The narrative order must match; reduced motion must
   remove spatial movement, not the story.
7. Review 320–430px phones: tagline is exactly two balanced lines, with no horizontal overflow.
8. Manually confirm Safari/WebKit and a notched compact-height device before any production vote.
9. Confirm the Founder line/SEO wording discrepancy and the explicit R-5 contrast exception.
10. If approved, authorize merge and production in a separate action. Neither occurred here.
