# CXOS Phase 5.1 — THE PASSAGE · Mission Control → Arena

**Gabriel Capital Labs · CreditVector™ Experience OS**
Date 2026-07-30 · Branch `feat/cxos-phase3` · Implementation commits `dac6102` + `a69a985` (parent `90ae210`, Phase 5) · Production truth `f449c35` on `main` — **untouched**.
Feature branch only: no merge, no production deploy, no flag activation (`ARENA_ENABLED` remains unset everywhere), no migration, no schema/env/Stripe/billing/pricing/legal/auth/Identity/Reputation/policy mutation.

## 1. Executive summary

Phase 5 proved the Arena's truth; the Founder's verdict was that it still *felt* like an overlay on a page. Phase 5.1 builds the missing journey: a dedicated review route, `/review/mission-control-to-arena`, where the Founder starts inside a blue, rectilinear, analytical **Mission Control**, answers a gold anomaly embedded in its far wall, travels an ~11.8-second cinematic passage in which the room's own geometry converges, bends, and warms into radial gold, crosses a threshold that match-cuts onto the chamber's establishing view, is greeted personally from fixture truth, walks a **spatial Arena floor** through five native-scroll stations, and returns by an intentional reverse journey. The Mission Control environment is *replaced*, not dimmed: at arrival the origin is display-removed behind an opaque veil in the same frame as an instant scroll, and the battery asserts no Mission Control text survives on the floor and CLS ≈ 0.

Everything is synthetic-fixture review data, labeled unconditionally (a minimized SYNTHETIC tab persists through every travel beat, including the threshold's silence). No WebGL, no new dependency, no session storage, no history mutation, no scroll lock. The live `/arena` and `/dashboard` gates are byte-level intact; the shipped Arena entry gained ceremonial copy (technical truth moved to director instruments), the Arena door was restaged as an embedded threshold, and both shipped director strips got the mobile collision fix the mandate demanded.

Validation: new guard `scripts/cxos-passage.test.ts` **69/69** with **21 mutations all RED** (byte-identical restores); repository suite **85/85**; journey battery **44/44** on a review-enabled production build; Phase 5 product battery re-run **30/30**; production-flagged build proves the route inert with **zero fixture bytes** and `/arena` still 307-dormant; landing 99.0 → 99.1 kB (≤ 102 budget). Four independent adversarial reviewers attacked the finished diff; every confirmed finding is fixed and now carries its own guard check and mutation (§15).

## 2. Truth audit — what existed and what it dictated

| Fact | Source | Consequence |
|---|---|---|
| `CRITICAL_NEVER` denylists `/review`, `/dashboard`, `/arena`-adjacent auth routes before any registry lookup; registry entries are capped at 0.4–1.5 s by a guard-pinned law | `lib/cxos/transitions/registry.ts` · `scripts/cxos-journey.test.ts` | The journey cannot be a TransitionShell route transition and no denylist weakening is permitted (mandate stop condition) — so it is a **one-route state machine**: no pushState, no hash mutation, browser back leaves the route truthfully |
| three.js + gsap exist but are deliberately confined to the Threshold's lazy chunk with its own guard; a second WebGL chunk costs ~170 kB gz and a complete DOM fallback anyway | `components/cxos/thresholdScene.ts` · `scripts/cxos-threshold.test.ts` | **CSS-3D chosen from evidence**: perspective + layered planes + one keyframed timeline. One implementation IS the experience, the no-WebGL projection, the no-JS document and the reduced-motion settled page — nothing can drift apart |
| The grammar guard auto-enumerates every `.cx-*` class for reduced-motion coverage and bans layout properties in `cx-*` keyframes | `scripts/cxos-grammar.test.ts` | Every new `cx-p-*` class ships with a standalone reduce-block rule; all keyframes are transform/opacity only (121 grammar checks green) |
| The shipped first-entry ceiling is a ratified numeric law: 7–12 s first, ≤ 1.5 s returning | `scripts/cxos-arena.test.ts` | The passage does not silently outgrow it: forced travel ends at **11.8 s**; the ceremony's tail (Kai's line, the walk hint) lands on the settled floor where nothing is forced |
| Zero safe-area CSS existed repo-wide while the layout declares `viewportFit: "cover"`; both shipped director strips were absolutely positioned at the same bottom offset with no wrap | repo-wide grep · `MissionEntry.tsx` · `ArenaEntry.tsx` | The reported mobile control collision is systemic; Phase 5.1 fixes the two shipped strips and builds the new tray safe-area-aware by construction |
| The review fixtures staged an engine-impossible standing: `levelForXp(640) = 5`, `rankForLevel(3) = "contender"` — "operator · L3 · 640 XP" cannot exist; nor can "novice · L0" | `lib/reputation/scoring.ts` (xpForLevel = 25·n·(n−1)) | Fixtures corrected everywhere to curve-consistent values: **operator · Level 6 · 820 XP** and **recruit · Level 1 · 0 XP** |

## 3. Adversarial design review before implementation

Three independent judges attacked the architecture before a line was written; all five of their blockers were adopted:
1. **Travel must own the timeline** — text beats over a dimmed room are the banned failure. The camera starts by 0.8 s and never stops until the threshold; the clearance lines are stencils IN the world, read as they pass the lens, not HUD captions.
2. **The two make-or-break cuts engineered explicitly** — departure: the overlay opens as an MC-continuous set (same ground, echoed geometry) fully covering the document by the end of the call beat; arrival: the threshold's final frame and Station A share the same establishing composition (`cx-p-est`), so the dissolve is a match cut, not a jump cut.
3. **Safety timing law made numeric** — the 12 s house safety fade would have self-destructed mid-greeting on a 14 s journey. Final ordering, guard-pinned by extracted numbers: journey end 11.8 s < JS watchdog 14 s < pure-CSS safety fade 18 s. If every script dies, the veil removes itself over the origin — where no scroll ever happened, the truthful state.
4. **CLS-0 proved, not asserted** — the environment swap happens in one commit behind the fully opaque veil (display swap + `scrollTo({behavior:"instant"})` — the base stylesheet's `scroll-behavior: smooth` is explicitly overridden, and the guard bans the two-argument scroll form). Battery-measured CLS ≈ 0.
5. **Two rooms, not one dark page with two accent colors** — the Arena ground is materially different (warm umber rising from the floor line, light entering from BELOW; Mission Control's light enters from above), the origin ends on a full-viewport terminal wall and the floor begins with a full-viewport establishing chamber.

Honesty blockers adopted from the same panel: the clearance triple branches on the record (`Evidence in order.` / `No evidence on record.`); rank vocabulary removed from fixed ceremony copy; standing is spoken exactly once (the greeting); the SYNTHETIC tab lives outside every beat conditional; no standing literal may exist outside the fixtures module (guard-banned); the greeting uses the house "evidenced awards" vocabulary and plaque labels reuse the shipped fixture strings verbatim.

## 4. The journey — storyboard and exact timings

Tier A (desktop), one continuous CSS timeline (11.8 s; every layer windows into the same variable-duration animation, which is what makes the director scrub possible):

| Beat | Window | What happens |
|---|---|---|
| B1 THE CALL | 0 – 0.8 s | Mission Control stays calm; the veil rises as an MC-continuous set (same ground, echoed panels); the gold aperture's seam wakes. No new text |
| B2 CLEARANCE | 0.8 – 3.2 s | The dolly is already moving. Three stencils pass the lens at depth: "Clearance confirmed." · "Record located." · "Evidence in order." (empty record: "No evidence on record."). Technical truth (handle · cohort · policy v) lives ONLY in the director tray |
| B3 THE PASSAGE | 3.2 – 5.6 s | Full advance: rectilinear wall planes pull past the camera (rotateY + translateZ), the instrument floor-grid slides beneath, four blue rails converge on the vanishing point |
| B4 DIMENSIONAL CONVERSION | 5.6 – 8.0 s | The rails' conic geometry dissolves as concentric gold arcs scale up from the same center; the cool haze warms (ink-blue → umber); rectilinear becomes radial |
| B5 THRESHOLD | 8.0 – 10.2 s | The chamber's establishing composition opens full-frame — floor ring, engraving, perimeter light from below, THE ARENA carved in the frame. **No text but the SYNTHETIC tab.** Silence and scale |
| B5b GREETING | 10.2 – 11.8 s | "Welcome to the Arena, Jordan." then the one standing line: "Standing recognized — operator · Level 6 · 820 lifetime XP · 5 evidenced awards." |
| ARRIVAL | 11.8 s | The veil dissolves onto Station A in match-cut alignment; focus lands on the Arena heading; Kai's tail ("The floor is ready." · "Scroll to walk the floor") is anchored on the settled floor |

Tier B (mobile ≤ 768 px): the same film condensed to 8.2 s on a single plane — the 3D rail stack and floor grid never mount. Returning (director instrument): 1.4 s (≤ the house 1.5 s returning law). The return journey: 1.8 s — gold contracts to a horizontal line, cools through the blue register, Mission Control reassembles with its prior state (battery-verified: the call is intact). Tier C (save-data / low memory) and tier D (reduced motion / effects-off): **no cinema exists** — the call is a plain in-page link and the settled two-room document is simply there.

## 5. Interaction law

- **Two-phase escape (new, guard-pinned):** during CALL and CLEARANCE the camera has not left the room — Escape, click, wheel, touch, Space and PageDown all **CANCEL**: the overlay dissolves, no scroll, focus returns to the activation control, and the skip button reads "Cancel — Esc". From THE PASSAGE onward the truthful nearest destination is ahead — the same inputs settle **forward** to the floor ("Skip — Esc").
- **Scroll is never hijacked:** no `preventDefault`, no scroll lock, no `overflow` writes, no history mutation (all guard-banned). During travel, scroll input is treated as skip intent through passive listeners — motion input always visibly answers.
- **Focus containment:** the overlay is `role="dialog" aria-modal="true"`; both environment wrappers carry `inert` while it plays; every settle lifts `inert` before focusing (an inert subtree refuses focus — caught by the battery, fixed, re-proven); focus lands on the destination heading BEFORE the overlay unmounts.
- **Watchdogs:** double activation is structurally ignored; a 14 s JS watchdog forces the truthful forward settle; the 18 s pure-CSS fade is the last line and resolves to the origin.
- **Assistive narration:** the world is `aria-hidden`; a polite live region announces the beats concisely (departure · clearance facts · the passage · the Arena · the greeting · "Arena arrival complete.") instead of narrating every visual.

## 6. The Arena call

Embedded in Mission Control's terminal wall as a sealed aperture: a recess with a dormant gold ring, a seam of light rising from its floor line, "ARENA CLEARANCE AVAILABLE", the fixture's real standing line, and a true `<button>` — "Proceed to the floor". It renders **only** when the fixture state grants access (mirroring the real `arenaAccessible()` law); in flag-off and outside-cohort states the wall holds **nothing** in its place — no teaser, no upsell, no implied purchase path — and the tray's state notes explain the real server behavior. On the live product, the Mission Control door (`ArenaDoor`) was restaged to match this language: a threshold band with a gold floor-seam and "PROCEED TO THE FLOOR →", still a plain link, still rendered only behind the guard-pinned server gate.

## 7. The Arena floor — five stations, native scroll

All semantic content is plain DOM, fully readable with zero motion; the depth scaffold (120svh stations, sticky 100svh stages, per-station `--cxs` driven by a passive, hidden-tab-aware rAF that only writes CSS vars) exists **only** under the runtime stamp `html[data-cxpassage]`.

| Station | Surface | Honesty law |
|---|---|---|
| A · Arrival | The establishing chamber: radial floor engraving, perimeter light from below, THE ARENA engraved, Kai's arrival tail | The same composition the threshold's final frame renders — the match cut |
| B · Standing core | A raised dais: conic ring at the real level percentage, lifetime XP, rank · level | Maps 1:1 to fixture standing (curve-consistent); empty record → the dais holds at zero with the truthful line |
| C · Evidence vault | The record's awards as engraved plaques — label · `documented evidence` · +XP | Labels reuse the shipped fixture vocabulary; no awards → absence + "Only evidenced activity builds this record." |
| D · Milestone gallery | Earned seals as illuminated positions | Zero badges → nothing earned is shown; no unearned milestone is ever represented |
| E · Competition threshold | A sealed architectural arch, `PLANNED` | Sourced from `REFUSED_V1`; the component has no open branch (mutation-proven) |
| — · Kai observation point | A restrained band reading the record deterministically | No AI call, no chat window, no mascot, no forecast |

The floor ends with the intentional return control. A `data-error` fixture renders the EMPTY standing with a truthful note — never a stale number (mutation-proven at the fixtures layer).

## 8. Director tray — mobile-safe by construction

One collapsed DIRECTOR pill (bottom-left, `bottom: max(0.75rem, env(safe-area-inset-bottom))`) expands into a bottom sheet: `max-height: 60svh`, its own scroll with `overscroll-behavior: contain`, 44 px touch targets, wrap-safe rows. Instruments: journey runs (first ~11.8 s / returning ~1.4 s / resume), nine beat jumps, a timeline scrubber (drives the whole world through `--cxp-seek` with the run held paused), four floor-station jumps, the five fixture states with real-behavior notes, and the readout row — tier · phase · environment · lighting state · "render: demand (CSS)" (there is no continuous render loop to meter: state transitions are CSS, and the station rAF runs only while scrolling). The technical clearance truth the ceremony no longer speaks lives here. The sheet consumes Escape in the capture phase before the journey's handler ever sees it. The two **shipped** director strips (MissionEntry, ArenaEntry) received the same medicine: wrap, max-width, and safe-area bottom offsets — the reported collision class is closed on all three surfaces.

## 9. Semantic ledger

`lib/cxos/passageLedger.ts` — 16 rows, each declaring representation · authoritative source · status · absence behavior · reduced-motion treatment · **fallback treatment** (the field this phase adds). Elements: MC instrument wall · MC command axis · MC zone panels · Arena call aperture · clearance stencils · passage rails · conversion arcs · threshold gate · chamber floor ring · standing core dais · evidence vault plaques · milestone gallery seals · sealed competition threshold · Kai observation point · return line · SYNTHETIC tab. Statuses are PROTOTYPE/SPECIMEN/PLANNED — nothing claims LIVE. No dust or particle system ships (not meaningful → not shipped → no row). Guard-enforced: a shipped element without a row fails CI, and the Phase 5 chamber ledger (`arenaLedger.ts`) is untouched.

## 10. Data-source and authorization map

The route is fixtures-only end to end: no prisma, no fetch, no session, no reputation import beyond the read-only policy re-export, no storage read or write of any kind (there is deliberately **no session marker on this route** — every run is a founder-review run, so no real visitor's first entry can ever be consumed; the live `cx-mc`/`cx-arena` markers are never touched). Production hard-off: `reviewBuildAllowed()` is checked first-line and the production-flagged build renders only "Founder Review is not enabled in this build." with zero fixture bytes. The live surfaces are unchanged in behavior: `/arena` keeps its server gate ahead of all markup (25/25 arena guard), `/dashboard` keeps its exact pinned gate lines, and with the flag unset `/arena` 307-redirects — proven on the production-flagged build.

## 11. Performance budget — measured

- **Landing:** 99.0 kB → 99.1 kB first-load (+0.1 kB; ≤ 102 budget; no new JS on the landing graph). Baseline measured by building the untouched parent commit.
- **The journey route:** 9.74 kB route JS / 104 kB first-load, entirely inside its own route chunk; Mission Control's real route carries none of it (the door is a server-conditional link).
- **Zero new dependencies · zero WebGL · zero images/fonts** — the world is CSS gradients and transforms; animated properties are transform/opacity only (grammar-guard-enforced), ≤ 12 composited layers at peak.
- **Demand rendering by construction:** no rAF loop exists outside active scrolling; the battery asserts `document.getAnimations()` running-count is **0** on the settled floor.
- **CLS ≈ 0 measured** across departure + arrival (layout-shift observer in the battery, threshold 0.02).
- Timings: first 11.8 s (B ≈ 8.2 s) · returning 1.4 s · return 1.8 s · watchdog 14 s · CSS safety 18 s — all extracted and range-pinned by the guard, and the CSS literal is cross-checked against the timeline constant.

## 12. Accessibility projection

Reduced motion and effects-off are absolute tier-D: the runtime never stamps, no overlay code path exists, the call and return are plain in-page links, and a belt-and-braces reduce block statically covers every `cx-p-*` class. No-JS receives the complete sequential two-room document (battery-verified text-complete). No autoplay audio exists; no flashing; contrast follows the shipped token grammar; state is never signaled by color alone (every state has copy). Focus order, containment, Escape semantics and the live region are described in §5 and battery-proven (checks 5, 7, 13, 20, 25).

## 13. Failure scenarios — exercised

| Failure | Resolution (proven) |
|---|---|
| Every script dies mid-journey | 18 s pure-CSS fade reveals the origin — the truthful unscrolled state; never a black screen |
| Timers die but JS lives | 14 s watchdog forces the forward settle |
| Double activation | State machine ignores re-entry (battery: one veil, one settle) |
| Escape / click / wheel at every beat | Cancel before departure; forward after; return settles home (battery 20–23) |
| Fixture switched mid-journey | Tray state changes reset to the settled origin first — no mixed-record ceremony |
| Storage denied / private mode | Nothing to deny — the route touches no storage |
| Hidden tab during floor scroll | rAF measure early-returns on `document.hidden` |
| Route left mid-passage (back) | No history entries were added; back leaves the route truthfully (battery 41) |
| Data error fixture | The EMPTY standing renders with the truthful failure note — never a cached figure |
| Production build reached | The page renders the not-enabled line only — zero journey bytes execute |

## 14. Validation evidence

**Guard — `scripts/cxos-passage.test.ts`: 69/69**, house style (source-level, presence-first ordering, numeric extraction, comment-stripped copy bans). **Mutations — 21/21 RED, every restore byte-identical (`cmp`):** production hard-off removed · unauthorized Arena call (gate flattened) · reputation write imported · fabricated standing fallback on data-error · synthetic banner removed · SYNTHETIC tab hidden behind a beat conditional · reduced-motion bypass · watchdog re-armed below the journey end (the numeric pin catches value sabotage, not just deletion) · live competition introduced · ledger row omitted · Mission Control left exposed during arrival · a failed record read told it was located (live entry) · the same on the journey's data-error state · resume leaving a hold with no settle · the veil's safety fade running through a paused inspection · `overflow-hidden` on the floor root (kills sticky) · the environment scroll moved back to a post-paint effect · scroll skipping while the tray is open · Space skipping while focus is on a control · the natural end stomping the greeting announcement · the director access-gate bypass restored.

One mutation (the access-gate bypass) initially survived — a genuine guard hole. It is recorded rather than quietly patched: the missing check was added, the mutation re-run, and it is now RED.

**Battery — 44/44** (review-enabled production build, Chromium): environments distinct and mutually exclusive · full journey with per-beat assertions and ≤ 12 s settle · match-cut arrival with focus + CLS ≈ 0 · station walk on real fixture figures · settled floor animation-count 0 · return journey · cancel/skip/wheel two-phase semantics · double activation · tray (open/Escape-priority/jumps/pause) · all five fixture states truthful · reduced-motion · effects-off · no-JS · mobile 390 (condensed journey, tray geometry, 44 px targets, no overlaps) · 320 px no overflow · hub lists the fifth PROTOTYPE room · browser-back truthful.

**Repository health:** suite **85/85** guard files (one initial red was this phase's own comment naming a reputation path inside `app/` — reworded, suite green; recorded honestly) · typecheck 0 · review-enabled and plain builds green · **production-flagged build:** journey route inert, `/review` hub inert, `/arena` → 307 dormant · Phase 5 product battery re-run **30/30** after the ceremonial-copy and door changes.

**Adversarial code review:** four independent reviewers (React/runtime correctness · safety/honesty · accessibility/interaction · CSS/performance) attacked the diff after implementation; confirmed findings and their resolutions: _see §15._

## 15. Adversarial review results

Four independent reviewers attacked the finished diff — React/runtime correctness, safety/honesty, accessibility/interaction, and CSS/performance. Nineteen findings were raised; the ones that survived tracing against real code are listed with their fixes. Everything here is fixed, guard-checked and mutation-covered in `a69a985`.

| # | Lens | Confirmed finding | Fix |
|---|---|---|---|
| 1 | Safety | **The live `/arena` ceremony asserted "Record located." for a record that was not located.** `readOwnProgress` fails closed to the EMPTY standing on any error with no degraded signal, so during a database blip a real operator would be told their record was located and then shown recruit · 0 XP as fact. The new ceremonial copy converted a safe degradation into a false affirmative | The live entry now states only what the server actually proved — "Clearance confirmed." The located-record claim is gone from the product surface |
| 2 | Safety | The journey's `data-error` fixture spoke the same untrue line in three channels (stencil, greeting, origin call) | Each channel branches on the state: "Record unavailable." · "Record unavailable — the fail-safe empty standing is shown." · "record unavailable — fail-safe standing shown" |
| 3 | Safety | Director instruments (`▶ first`, beat jumps, scrubber) played the full ceremony under `flag-off` / `outside-cohort` fixtures whose origin wall correctly shows no call | All three entry points honour `fx.access`; no instrument can conjure a ceremony a gate refuses |
| 4 | React | **`resume` left the machine cinematic with no timers, no settle and no watchdog** — a resumed hold played to its final frame and froze there, both environments inert behind the veil, indefinitely | A real `resumeRun`: keeps the seek (the world continues from the held frame), re-arms the remaining beats, the settle at `end − seek`, and the watchdog |
| 5 | React | **The tray's `▶ first` hit `beginJourney`'s re-entrancy guard *before* `clearTimers`,** so the replaced run's timers stayed armed — a dead journey later teleported the page to the floor and stole focus | Explicit `restart` semantics: the director's replace path clears the old run's timers first; a fresh run also remounts the overlay so its animation clock starts at zero |
| 6 | React/CSS | Every held beat and scrub disarmed the JS watchdog, leaving the 18 s CSS fade as the only exit — and that fade blanked a paused inspection over an inert document | Every hold re-arms the watchdog, and the veil's **own** safety animation now pauses with the world |
| 7 | React | The environment scroll ran in a post-paint `useEffect`; the tray's fixture swap (no veil) showed one painted frame of Mission Control at a stale offset — contradicting the CLS-0 law | Moved to `useLayoutEffect`: the scroll commits before paint on every path |
| 8 | CSS | **`overflow-hidden` on the floor root made it the sticky container, silently killing the entire depth scaffold** in every browser | `overflow-clip` — contains paint without becoming a scroller |
| 9 | CSS | Shared percentage windows gave the journey's densest line ~0.4 s on the condensed mobile run | Tier B has its own earlier, longer windows for the stencils and both greeting lines |
| 10 | CSS | `svh` had no `vh` fallback: a pre-`svh` engine dropped the declaration entirely, leaving an unbounded tray sheet | `vh` fallback before every `svh` (guard-checked) |
| 11 | A11y | Wheel/touch skip listeners ignored the open tray: one scroll of the sheet also settled the run being inspected | Both listeners check `trayOpenRef` |
| 12 | A11y | Space on the DIRECTOR pill both settled the journey and opened the tray; PageDown skipped from any focus | Escape stays unconditional; Space/PageDown are skip intent only when focus is not on a control |
| 13 | A11y | The greeting announcement — the only assistive channel for the standing, since the visuals are `aria-hidden` — was overwritten 1.6 s later by "Arena arrival complete." | The natural end no longer re-announces; skips and watchdogs still do |
| 14 | A11y | An identical announce string is a bailed-out state update, so repeated instrument presses said nothing | A zero-width toggle guarantees every announcement lands |
| 15 | A11y | `aria-modal` was claimed while the footer's "All rooms" link stayed tabbable and operable under the opaque veil | The footer is inerted with both environments |
| 16 | A11y | Escape-closing the tray dropped focus to body, from which the next Escape silently settled the journey | Closing always returns focus to the pill |
| 17 | A11y | Cancel focused `[data-cxp-proceed]`, which does not exist under access-refused fixtures | Falls back to the origin heading — focus never lands on body |
| 18 | A11y | Every tray instrument yanked focus out of the open sheet; station jumps scrolled behind the sheet | Instruments keep focus in the tray (`takeFocus={false}`); station jumps close the sheet first |
| 19 | A11y | A mid-journey OS reduced-motion flip hid the veil (including Skip) while `inert` held — an invisible modal over a dead page | A media-query listener settles by the same two-phase law the moment the preference changes |

Also fixed from the same pass: the fixed DIRECTOR pill no longer obscures the footer at 320 px (reserved clearance), and active tray controls carry a mark, a ring and heavier weight rather than colour alone.

Reported and **rejected** after tracing (recorded so they are not re-litigated): stale `fx.record` in timer closures (fixture changes clear every timer first, and the records are module constants); watchdog/settle double-fire (every settle clears timers synchronously before its rAF); the journey route leaking into a production bundle (the RSC payload never references it); `aria-modal` breaking the sr-only `h1` focus target (Tailwind's clip pattern stays focusable); 3D flattening (every animated plane is a direct child of the perspective element); animated `drop-shadow` (never animated); per-frame gradient repaint (transform/opacity only).

## 16. Rollback

Single-commit surface: revert `dac6102` (plus the docs commit) or reset the branch to `90ae210`. Everything is additive — no migration, no dependency, no env var, no flag, no schema. The product-surface edits (entry copy, door, tray retrofits, stage fixtures) are contained in the same commit and revert with it. Production never contained any of this.

## 17. Known limitations (honest)

1. **The desktop "3D" is layered-plane CSS, not a free camera** — depth is real (perspective + translateZ parallax) but the camera path is fixed. A WebGL passage remains possible later behind the same laws; the ledger and guard were built to carry it.
2. **Tier B's journey is a condensed single-plane film** — a deliberate budget choice for phone GPUs; the mobile recording shows exactly what ships.
3. **A paused hold waits indefinitely by design** — the world, its safety fade and its beat timers all suspend together, and every hold re-arms the 14 s watchdog so the machine always has a JS exit. This is a director instrument: a normal visitor never reaches a paused state.
4. **The greeting's second line enters at ~11.2 s** — visually late in the window by design (it is the emotional peak); the battery reads it through the live text, and the recording shows the pacing for the Founder's judgment.
5. **Station depth choreography is subtle at tier A** (±40 px translate + opacity) — restraint over spectacle was chosen deliberately after the "no nausea, no casino" laws; the director scrub exposes each station for review.

## 18. Deliverables index

Truth audit §2 · environmental transition architecture §3–§4 · emotional-language spec §4/§6/§7 (blue analytical ↔ gold ceremonial grammars) · passage storyboard with exact beats §4 · implemented slice (commits `dac6102` + `a69a985`, 18 files) · dedicated end-to-end review route `/review/mission-control-to-arena` · mobile-safe director tray §8 · semantic ledger §9 (16 rows + fallback field) · performance report §11 · accessibility report §12 · failure-scenario report §13 · adversarial validation §14–§15 · desktop walkthrough recording `passage-desktop.webm` · mobile recording `passage-mobile.webm` · reduced-motion recording `passage-reduced-motion.webm` · real-frame storyboard + before/after gallery (embedded in the HTML projection) · this report + standalone HTML + mobile PDF · preview URL below · commit SHAs and file inventory (this section + §16) · Founder decision block §19.

**Preview:** `https://gabriel-capital-labs-git-feat-cxo-06bc43-rey-gabriel-s-projects.vercel.app/review/mission-control-to-arena` (protected preview; rebuilt on this push). The live `/arena` stays dormant by design — `ARENA_ENABLED` remains unset, and enabling it is the owner's decision alone.

## 19. Founder decision block

- [ ] Approve Mission Control origin
- [ ] Approve Arena call
- [ ] Approve clearance ceremony
- [ ] Approve passage architecture
- [ ] Approve dimensional conversion
- [ ] Approve Arena threshold
- [ ] Approve personalized greeting
- [ ] Approve Arena spatial environment
- [ ] Approve 4D scroll interaction
- [ ] Approve return journey
- [ ] Approve semantic ledger
- [ ] Approve authoritative data boundaries
- [ ] Approve mobile experience
- [ ] Approve performance
- [ ] Approve accessibility
- [ ] Approve Phase 5.1 vertical slice
- [ ] Request changes
- [ ] Reject

Silence is not treated as approval. Work stops here pending these decisions.
