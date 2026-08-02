# CXOS Living Environment Engine — RC2 Continuation Plan

Status: BOUNDED PLAN — issued after the five-agent post-recovery review of the recovered RC1 candidate.
Base: `feat/cxos-living-environment-engine-rc1` final handoff `9129fefdd2263091f8f029bf60da3fa8986bf7fe`.
Branch: `feat/cxos-living-environment-engine-rc2` (isolated descendant; RC1 branch and recovered worktree untouched).
Production baseline: `origin/main` = `f449c35d0eca9463c15e86f8cbd4cd7f4e948d03` (unchanged, untouchable).

This plan authorizes bounded cinematic refinement, runtime lifecycle correction, accessibility correction, and evidence-harness breadth. It does not authorize merge, production deployment, alias change, schema/auth/billing/dependency change, or any work outside the CXOS review surface.

---

## 1. Review verdict being answered

Five parallel reviews (A: lineage · B: cinematic · C: runtime · D: accessibility/responsive · E: adversarial) reached one converging diagnosis:

1. **The RC1 Living mode is net-subtractive on motion.** One unconditional kill rule (`agency-command.module.css:7578–7601`) deletes 13 RC5 motion channels (393 running-animation observations in the pinned RC5 ledger, including the only motions carrying operational state semantics) and replaces them with 66 observations of sub-perceptual motion. Chamber-settled running animations: RC5 `3/8/3/3/3/3/3` → RC1 `0/1/0/0/1/0/1`.
2. **Chamber identity collapsed from vocabulary to vector.** The entire per-chamber motion authority is a ±8px/1.000–1.018 tuple on one `aria-hidden` plane; two chambers are byte-identical, two differ by 0.006 scale, and Tier B resets all seven to identical. Seven of eight authored chamber-profile families (`emotion/camera/lighting/depth/focus/idle/kai`) have zero DOM or CSS consumers.
3. **The facility is alive only while unattended.** 92 of 152 measured states run at animation budget 0; any focus inside the chamber body classifies as `reading` and hard-settles the room; scrolling never re-arms the idle timer. The environment dims to 30–46% opacity exactly when the operator looks at it.
4. **The runtime is sound but has 8 real lifecycle risks** (hidden-tab focus jump; capability identity churn evidenced at 275.5ms; transitions surviving document-hidden; regex-based budget classification; missing effect dep; per-keystroke re-render; scroll-owner release race; BFCache district assertion against room-owned history).
5. **Evidence breadth has honest gaps**, two previously undisclosed: axe evaluated the content of only 2 of 7 chambers, and the ≤860px facility map (the primary small-screen navigation) was never opened in any measured state.
6. **Report integrity**: the RC1 Final Report describes six chamber motions and a "breathing" environment that the shipped CSS deletes. The Cinematic Bible is honest about the deletions; the Final Report and Adversarial Review are not. RC2 must correct the record.

What is verified good and must be preserved: the staged 1500ms arrival with skip path, the 620ms directional passage, the threshold "ACQUIRED" beat, the 460ms departure overlay, the sticky facility rail, one-chamber-at-a-time with real history, seven compositionally distinct chamber backgrounds, complete Tier C/D and reduced-motion static equivalence, review-route protection, and production identity hard-off.

## 2. Adjudicated principles

1. **Three-class motion model** (Cinematic Bible amendment, enforced by guard + harness):
   - `continuous` — counted against the published budget (Tier A ≤2, Tier B ≤1, settled/idle 0).
   - `transient` — play-once acquisition/recognition/evidence/response beats: `iteration-count: 1`, duration ≤1500ms, ≤2 concurrent, only during arrival/acquisition/discovery/response windows. The existing threshold beat and entry acquire belong to this class.
   - `scroll` — ViewTimeline-driven, native-scroll-coupled, excluded from the continuous count (existing harness behavior, now formalized).
   - Every environment motion surface carries `data-cxos-motion-channel`; classification becomes structural, replacing the keyframe-name regex.
2. **Motion returns to the protagonist.** Chamber signatures select the *subject* that carries the chamber's recognition beat (the six existing RC5 keyframes), not merely a vector on wallpaper.
3. **The flow-lane loops stay retired.** Five concurrent loops cannot fit the frozen budget. Their meaning returns as: the client floor-sweep recognition at entry (transient), static amber blocked-row emphasis, and one continuous state-bearing pulse on the blocked lane only.
4. **No new sticky surfaces.** Kai presence is expressed through the already-projected `data-cxos-kai-presence` channel and the restored response reveal, not through a sticky banner.
5. **Compliance disclosures are untouchable text.** Preamble compression reorganizes rhythm; no disclosure content is removed or hidden.
6. **No remnant packaging.** RC5 baseline chamber visuals are re-captured fresh with the pinned harness, or disclosed as ledger-only with remnant paths + hashes cited.
7. **Determinism, reduced-motion completeness, Tier C/D static equivalence, presentation-only ownership, zero new dependencies** — unchanged, revalidated.

## 3. Work packages (one bounded commit each unless noted)

### WP1 — `fix(cxos): harden runtime lifecycle safeguards`
Files: `components/cxos/runtime/useCxosRoomRuntime.ts`, `lib/cxos/runtime.ts`, `app/review/agency-command/agency-command.module.css` (hidden-state gate only), guard updates.
- F1 (HIGH): guard the district-commit focus rAF path against `document.hidden`; defer via the existing visibility-pending ref so return-to-tab does not jump scroll/steal focus.
- F2: capability equality guard — `setCapabilities(prev => same(prev, next) ? prev : next)` over the 7 scalar fields; removes the evidenced 275.5ms media-query commit storm.
- F3: extend the `[data-hidden="true"]` gate with `transition: none !important` over the same surface list as the Tier C/D stop.
- F5: add the observer key to the attention effect dependency array.
- F6: hold the activity stamp in a ref and re-arm the idle timeout imperatively; stop re-rendering the stage per keystroke.
- F7: race the module-global scroll-owner release rAF with `setTimeout(release, 0)` (idempotent).
- F8: on `pageshow.persisted`, reset presentation state only (phase/idle/attention/passage/focus/timers); do not assert `initialDistrict` against room-owned history — route district restoration through the existing route-reset callback.

### WP2 — `feat(cxos): restore state-bearing chamber motion`
Files: `agency-command.module.css`, `app/review/agency-command/stage.tsx` (channel attributes), `environment.ts`, living-environment guard.
- Narrow the kill list at `css:7578–7601`: remove `.teamOrbit li > span`, `.archiveEvidenceList li > span`, `.capacityHorizon b`, `.clientFlowMoment::after`, `.healthBank::after`, `.kaiDesk::before`, `.districtTruth::after`, `.preparedArtifact`, `.inspectionBody` from the unconditional kill. Keep `.ambientSweep`, `.roomBreath`, `.districtRail i`, `.facilityPulse i`, `.flowTrack b` retired on their RC5 channels.
- The six chamber recognitions (`agencyClientFloorSweep` 960ms, `agencyTeamRecognition` 860ms, `agencyObservatoryScan` 1400ms, `agencyEvidenceRecognition` 900ms, `agencyKaiRecognition` 1200ms, `agencyCapacityScan` 1100ms) fire once per chamber acquisition as `transient` class, gated by the existing quiet/idle/attention override and tier stops.
- `.preparedArtifact` response reveal (`agencyArtifactReveal`) restored as `transient` on Kai response — the arc's "intelligent response" beat.
- `.inspectionBody` acquire and `.districtTruth::after` provenance trace restored as `transient` on discovery.
- Continuous slot 1 (facility): `agencyLivingHeartbeat` becomes a traveling sweep — translate −8vw → 108vw consuming the dead `--cxos-dur-drift: 18000ms`, opacity 0.18→0.30→0.18, infinite while engaged. A light crossing the facility again.
- Continuous slot 2 (per-chamber): a chamber-tinted environment breath (opacity/luminance oscillation consuming the dead `--cxos-light-rest`/`--cxos-light-active` tokens, per-signature amplitude/period). Client Operations override: when a blocked packet exists, slot 2 is a subtle pulse on the blocked lane instead — continuous motion carrying real operational state.
- Every restored/retained motion surface gains `data-cxos-motion-channel="<class>:<name>"`.
- Budget invariants after this WP: Tier A ≤2 continuous, ≤2 transient concurrent, Tier B ≤1 continuous, settled/idle 0 continuous. Guard asserts the class model.

### WP3 — `feat(cxos): deepen chamber signature identity`
Files: `environment.ts`, `agency-command.module.css`, guards.
- Entry tuples: Evidence Archive `y +8 → −8` (descend into the aisle; kills the byte-identity with Central Command). Team Operations moves off uniform scale to a horizon `scaleX` axis (0.64→0.72 via a new `--cxos-entry-scale-x` stop in the existing acquire keyframe, default 1 for all others). Central Command `y → 0` + aperture `scaleX 0.86→0.92` (the only converging entry). Kai keeps uniform 1.018 convergence.
- Amplitudes: plane entry vectors raised from ±4–8px to ±20–28px (Business Health stays smallest at −16px — the diagnostic nudge is its identity). All on the `aria-hidden` plane: zero layout, zero CLS.
- Scroll pairs: raised ±8 → ±36px; Business Health gains a `y` pair. Central Command, Team Operations, Kai Suite remain scroll-still — documented as identity (travel chambers vs still chambers), not omission.
- Tier B: per-signature entry values at half amplitude replace the blanket zero reset; the opacity acquire curve remains.
- All 7 chambers receive a distinct `--agency-chamber-edge` (5/7 currently inherit the default; the unused identity lever E and B both flagged).

### WP4 — `feat(cxos): phase-lock attention, idle, and Kai presence`
Files: `useCxosRoomRuntime.ts`, `environment.ts`, `agency-command.module.css`, `stage.tsx` (copy), guards.
- Attention: `reading` only when an inspection plane is open or focus is in a text-entry control. Rail/button/link focus = ambient + activity. (Clicking the map is not reading.)
- Activity: add passive throttled `scroll`/`wheel` to the re-arm set — scrolling is operating.
- Per-chamber `idleAfterMs` in chamber data (Kai Suite and Evidence Archive settle fast ~5000; Client Operations and Growth hold ~8000; others 6000–7000).
- Settle: remove the `transform: none` flattening that erases the seven per-chamber overhead-light poses at settled idle; per-signature settle opacity (0.40–0.58) replaces the single 0.46. Idle `settling` gets a distinct 300–400ms deceleration treatment.
- Reading dim: 0.30 → 0.42 (quiet, not dead).
- Kai: consume `data-cxos-kai-presence` in CSS; scope the staged/preparing overhead-light rule with `:not([data-cxos-profile="kai-suite"])` preserving each chamber's translate; Kai Suite narrowing to `scaleX(0.58)`; `preparing` visually distinct from `staged`; carried-context prefix label on the held Kai context line.

### WP5 — `feat(cxos): destination-aware passage and arrival`
Files: `agency-command.module.css`, `stage.tsx` (copy/markup order only), guards.
- Passage: destination chamber's edge/signal tint drives `--cxos-passage-signal` (all 7, not just Business Health); the axis line's scale origin follows the destination entry-vector sign; opaque hold shortened 16–78% → 10–42% of the 620ms (reveal, not conceal).
- Arrival compression: masthead band collapses to a single line during `data-chamber-phase="passage"` (height/opacity on existing elements); fixture-state band and DIRECTOR pill merge into one row. Disclosure text untouched.
- Noun unification: rendered copy only — `DISTRICT {i} / 07` → `CHAMBER {i} / 07`, rail header `7 DISTRICTS` → `7 CHAMBERS`; one noun for one place. Code identifiers, DOM attributes, and ids unchanged.

### WP6 — `fix(cxos): accessibility hardening`
Files: `agency-command.module.css`, `stage.tsx`.
- Restore `scroll-margin-top` under the ≤860px sticky bar (the `(0,2,0)` specificity defeat) and add it to focusable descendants (WCAG 2.4.11 exposure D-F6).
- Mirror `inert` on the settled arrival gate (currently CSS-only de-focusing, asymmetric with its sibling).
- Evidence Archive: per-card `border-inline-start` state weights — absence gets a shape, not just a hue (also closes a color-only exposure).
- Business Health: uninstrumented drivers render as dashed rows (the declared `missing-inputs` focus becomes visible).
- Growth: reserve-vs-occupied cell alpha step consuming `--cxos-light-rest`/`--cxos-light-active` — the boundary becomes a light step, not a caption.
- Client Operations: blocked-row amber emphasis; re-enable the amber signal `em`.

### WP7 — `test(cxos): extend evidence harness breadth`
Files: `scripts/cxos-living-environment/browser.mjs`, `scripts/cxos-living-environment.test.ts`.
- Axe: add `wcag22a`/`wcag22aa` tags; persist pass rule ids (not a count); loop axe over all 7 chambers on desktop-large + mobile.
- Obstruction: post-CLS scroll-restored center-point probe for off-viewport targets; per-target skip reasons; gate predicate requires `obstructionMeasured > 0`; per-case counts attached as gate evidence.
- `directory:open` step on coarse/narrow specs (mobile facility map measured open: target size, obstruction, settled screenshot).
- BFCache: `departure: true` on the mobile spec (second traversal, second viewport).
- Scroll proof: measure all three ViewTimeline profiles; gate requires all three.
- Long tasks: post-processing LoAF↔LongTask join; `long-task-api-unattributable` taxonomy term.
- Landscape: `measuredCycles: 3`, report median + max blocking for `arrival:skip`.
- Motion classification: structural via `data-cxos-motion-channel` (continuous/transient/scroll ceilings per class), replacing the keyframe-name regex.
- Coverage-gate messages reworded to claim exactly what is measured.

### WP8 — `docs(cxos): amend Cinematic Bible, adoption matrix, and errata` (after validation)
- Bible: three-class motion model; subject-based signatures; amplitude bands; travel/still chamber identity; attention/idle policy; Kai presence channel; passage tinting.
- RC2 Final Report carries an explicit ERRATA table for the eight RC1 report rows that described deleted motion as shipped.
- Adoption matrix updated. `.ai/CURRENT-STATE.md` updated.

## 4. Validation minimum (Phase 4)

Per the continuation contract: `git diff --check`; `tsc --noEmit`; touched-file ESLint; all four CXOS guards; schema safety; network authorization; event-bus isolation; session security; optimized review build; production-identity hard-off build; full browser evidence matrix (desktop/desktop-large/tablet/mobile/mobile-360/mobile-narrow/landscape/reflow-200/reduced/constrained) with the WP7 breadth; JS-disabled completeness; 200% reflow; keyboard/focus; route history; BFCache (desktop + mobile); visibility pause; idle settlement; obstruction/overflow; touch targets; console/network ledger; exact allowlist; secret/private-path scan; RC5 baseline chamber re-capture for the before/after; Founder ZIP + SHA-256. Compare against retained RC1 evidence; report regressions honestly.

## 5. Out of scope (unchanged prohibitions)

Merge to main; production deployment/promotion/alias; schema/migration; auth; billing/Stripe; env/project settings; new dependencies; live customer data; unrelated streams (Growth/GIOS/HELIOS/Community/Arena); second animation engine; scroll hijacking; video backgrounds; removal or dilution of compliance disclosures.

## 6. Caveat register disposition (RC1 §Remaining caveats)

| # | RC1 caveat | RC2 disposition |
|---|---|---|
| 1 | 511 incomplete contrast nodes | SPLIT — closed for breadth (WCAG 2.2 tags, pass ids, per-chamber axe); gradient/pseudo raster resolution REMAINS DISCLOSED with the independent 5.6:1 worst-case static floor recorded |
| 2 | 5 unsampled obstruction cases | CLOSE (WP7) |
| 3 | 51.9ms landscape frame | CLOSE (n≥3 cycles, median+max; double-counted with #4; WP1 removes the candidate handlers from the frame) |
| 4 | 10 unattributed long tasks | CLOSE (LoAF join: 8/10 pre-interaction hydration, 1 = #3's frame, 1 = React scheduler; 0 candidate-owned) |
| 5 | Inherited NextAuth noise | REMAINS DISCLOSED (auth untouchable) |
| 6 | BFCache breadth | PARTIAL — mobile traversal added; cross-browser DEFERRED to physical-device gate |
| 7 | Scroll proof breadth | CLOSE (all three ViewTimeline profiles) |
| 8 | No physical-device/AT/RUM | DEFERRED to physical-device gate; over-claiming coverage wording corrected |
| 9 | 4 inherited lint findings | REMAINS DISCLOSED (out of allowlist scope) |
| NEW-A | Axe covered 2/7 chambers | CLOSE (per-chamber axe loop) |
| NEW-B | ≤860px facility map never measured open | CLOSE (`directory:open` step) |
