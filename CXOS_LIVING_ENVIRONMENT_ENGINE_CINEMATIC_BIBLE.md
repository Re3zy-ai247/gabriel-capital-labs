# CXOS Living Environment Engine — Cinematic Bible

- **Status:** REFERENCE SPECIFICATION · ISOLATED CANDIDATE ONLY · RC1 base (§§1–10) + RC2 Amendments (§11)
- **Date:** 2026-08-01 (RC1 base) · amended 2026-08-02 (RC2)
- **Architectural identity:** CXOS Core Runtime 1.1 Living Environment profile — not a separate engine
- **Reference consumer:** Agency Headquarters — implemented only in the isolated RC1/RC2 candidate lineage
- **Release authority:** No merge, production integration, promotion, alias, or broad-adoption authorization

## 1. Authority and use

This bible translates the already-approved RC1 plan into a compact directing reference for the Agency Headquarters implementation and its review evidence. It introduces no new product, architecture, adoption, or release decision.

**RC2 note:** §§1–10 below are the RC1 record and are preserved as written wherever they remain accurate. Where RC2 changed a rule or made a stated fact false, the affected row or paragraph carries an inline `→ RC2: see §11.x` pointer; §11 is the authoritative current statement for every topic it covers. Nothing in §11 is a release, merge, or adoption decision either.

Its governing sources are:

1. `CXOS_LIVING_ENVIRONMENT_ENGINE_RC1_PLAN.md`, especially §§4–5, 8–12;
2. `CXOS_LIVING_ENVIRONMENT_ENGINE_RC2_PLAN.md` (governs §11 only);
3. `CXOS_FOUNDATION.md` §17, including the Core Runtime 1.1 Living Environment contract;
4. `CXOS_LANGUAGE_1_0.md` §§2.8–2.10 and §§9–18; and
5. `.ai/ADR/ADR-0040-cxos-core-runtime.md`.

The delivery title retains “Living Environment Engine” because that is the assignment name. Architecturally there is one engine: the existing headless CXOS Core Runtime. Living Environment is an optional 1.1 presentation profile projected through the existing pure policy layer and sole browser adapter. Room-owned CSS renders the result.

“Implemented reference” means the Agency profile exists in the isolated RC1 candidate. It does not mean the candidate has passed its evidence gates, received Founder acceptance, merged, or reached production.

Truth labels in this document follow `.ai/CONSTITUTION.md`: **VERIFIED** means directly present in the isolated candidate or its controlling specification, not production-live; **PROPOSED** means a directing or adoption constraint awaiting its stated gate; **NEEDS CONFIRMATION** means only measured evidence or an owner decision can close the claim. No isolated-candidate fact is labeled as a production fact.

## 2. Directing philosophy

### 2.1 The environment serves truth

A Living Environment makes an already-disclosed condition, transition, hierarchy, or focus state easier to understand. It never invents activity so that the interface appears busy.

Motion may communicate:

- acquisition;
- flow;
- diagnostic attention;
- provenance;
- constrained capacity; or
- presentation readiness.

Motion may not communicate a fact, operation, result, urgency, person, entitlement, or capability that the room does not actually own and disclose.

### 2.2 One facility, seven distinct shots

Agency Headquarters remains one operating facility with seven semantic chambers. Distinction comes from composition, light source, movement axis, depth relationship, and finite motion signature—not seven independent lifecycle systems and not seven times more animation.

Each chamber keeps:

- one operational purpose;
- one protagonist;
- one truthful action;
- one always-visible truth boundary;
- no more than three visual planes; and
- the same complete facts, controls, disclosures, headings, and destinations in enhanced and static projections.

### 2.3 The camera is compositional language

“Camera” means bounded CSS framing, transform, clipping, depth separation, light fields, and hierarchy. There is no literal camera, 3D scene, Canvas, WebGL layer, cursor-following view, zoom-through, or captured scroll.

The three permitted planes are:

1. foreground threshold;
2. middle-ground semantic content and instruments; and
3. background environment.

Text, controls, focus targets, and truth disclosures remain outside decorative blur, dimming, clipping, and motion.

### 2.4 Finite first, still by default

Presentation establishes, communicates, and settles. Capable tiers may use bounded environmental activity while the operator is engaged, but sustained environmental work reaches zero after the declared idle window. Inspection and focused Kai presence quiet the environment immediately.

### 2.5 Native behavior has priority

User input, visible focus, Escape, native scrolling, native local navigation, browser Back/Forward, and real destinations outrank ambient presentation. Enhancement may acknowledge a transition; it may not trap, replace, or silently reinterpret an interaction.

## 3. Ownership and truth boundary

| Core Runtime 1.1 projects | Agency Headquarters continues to own |
|---|---|
| validated presentation profile and capability tier | canonical synthetic fixtures and source disclosures |
| arrival, operating, passage, hidden, and departure lifecycle | semantic DOM, chamber ids, headings, order, and destinations |
| attention, idle, lighting, depth, camera, focus, and Kai-presence tokens | CSS geometry, light fields, instruments, and visible composition |
| deterministic static-equivalence state | copy, truth boundaries, controls, permissions, and no-action receipts |
| one bounded idle timer and cleanup policy | Kai intent classification and fixed route-local command state |

The runtime performs no fetch, API call, storage or cookie access, persistence, telemetry, database operation, model call, customer mutation, notification, calendar/task action, billing operation, or entitlement decision. A visual state is never evidence that any such operation occurred.

## 4. Closed token system

### 4.1 Closed timing limits

**VERIFIED — controlling RC1 contract.** These are the closed tier limits in the approved plan and runtime definition. A chamber profile cannot supply a raw duration or easing.

| Token family | Tier A | Tier B | Tier C | Tier D | Executable source |
|---|---:|---:|---:|---:|---|
| Arrival lifecycle | 1500 ms | 700 ms | 0 | 0 | `app/review/agency-command/stage.tsx` (`AGENCY_CORE_RUNTIME.arrivalDurationMs`) |
| Chamber passage | 620 ms | 460 ms | 0 | 0 | `lib/cxos/runtime.ts` (`DEFAULT_CXOS_DISTRICT_TRANSITION_MS`) and `stage.tsx` |
| Camera-settle ceiling | 520 ms | 340 ms | 0 | 0 | `CXOS_LIVING_ENVIRONMENT_ENGINE_RC1_PLAN.md` §5.2; not a chamber-supplied value |
| Focus-acquire ceiling | 260 ms | 180 ms | 0 | 0 | plan §5.2; current inspection acquire is 260 ms and its disclosure chevron is 180 ms in the route CSS |
| Finite heartbeat → RC2: see §11.1, §11.4 | 2400 ms | 3200 ms | none | none | `agencyLivingHeartbeat` on the Tier A ambient channel; `agencyLivingAcquireB` combines Tier B acquire and restrained opacity respiration on its sole profile channel |
| Idle threshold → RC2: see §11.4 | 6000 ms | 4500 ms | immediate | immediate | `app/review/agency-command/environment.ts` (`idleAfterMs`) |
| Idle settle | 400 ms | 300 ms | 0 | 0 | `components/cxos/runtime/useCxosRoomRuntime.ts` (`settleAfterMs`) |

Tier A uses a 520 ms one-shot profile acquire plus a 2400 ms finite ambient heartbeat. Tier B has one 3200 ms profile animation: its transform is fully settled at `10.625%` (`340 ms`), then a restrained opacity respiration completes the finite heartbeat without adding a second channel. With no new operator activity, the idle policy stops environmental work after 6000 ms on Tier A or 4500 ms on Tier B; discrete activity may re-arm that one timeout, but both heartbeat forms have one iteration and never loop. Quiet/static states stop them immediately.

**→ RC2 superseded this paragraph and the two flagged rows above; see §11.1 and §11.4.** In outline: `--cxos-dur-heartbeat` now drives only Tier B's `agencyLivingAcquireB` (root default 1200 ms, Tier B 1400 ms — both lowered from 2400/3200 ms because the beat is structurally a `transient` one-shot bound by the ≤1500 ms transient ceiling, not a continuous cadence, despite its name). Tier A's ambient channel (`.ambientSweep`) no longer consumes `--cxos-dur-heartbeat` at all — it consumes `--cxos-dur-drift` instead (see the `--cxos-dur-drift` row directly below, and §11.1). Idle threshold is now per-chamber, not one room-level pair.

For completeness, the final Living CSS declaration block contains these exact values. “Declared only” means the variable currently has no Living selector consumer and therefore must not be described as active behavior.

| CSS declaration | Exact value | RC1 execution status |
|---|---:|---|
| `--cxos-dur-response` | 150 ms | declared only |
| `--cxos-dur-settle` | 400 ms A / 300 ms B | current-profile opacity transition and adapter idle settlement match by tier |
| `--cxos-dur-reveal` | 520 ms A / 340 ms B | Tier A Living depth-plane acquire; Tier B's 340 ms transform-settle point is encoded at `10.625%` of its 3200 ms profile heartbeat |
| `--cxos-dur-heartbeat` | 2400 ms A / 3200 ms B | Tier A ambient heartbeat; Tier B combined profile acquire/opacity respiration |
| `--cxos-dur-draw` | 1800 ms | legacy flow rules only; those lanes are disabled by Living mode |
| `--cxos-dur-drift` → RC2: see §11.1 | 18,000 ms | **RC1:** retained solely for legacy `agencySweep` / room-breath consumers; both are hard-disabled in Living, and no Living animation consumes this duration. **RC2 makes this statement false:** `agencyLivingHeartbeat` (Tier A's `.ambientSweep` continuous facility-sweep) now consumes `--cxos-dur-drift` directly as its full 18,000 ms travel duration |
| `--cxos-depth-near` / `--cxos-depth-middle` | 8 px / 4 px | declared reference only; executable entry/scroll offsets are listed in §4.3 (RC2 current values: §11.4) |
| `--cxos-light-rest` / `--cxos-light-active` / `--cxos-light-focus` → RC2: see §11.1, §11.4 | 0.08 / 0.14 / 0.20 | **RC1:** declared reference only; applied profile/state light values are described in §4.4. **RC2 makes this partly false:** `--cxos-light-rest`/`--cxos-light-active` are now consumed, indirectly, via `--cxos-breath-lo`/`--cxos-breath-hi` (`calc(0.82 ∓ token)`), which drive the per-chamber `agencyLivingBreath` continuous channel's opacity envelope, and directly by Growth Threshold's static occupied/reserve capacity-cell opacity step. `--cxos-light-focus` remains declared-only; it still has zero consumers |

### 4.2 Real easing definitions

**VERIFIED — candidate CSS.** The five approved semantic curve names remain closed governance vocabulary; they are not an exported TypeScript enum and chambers cannot choose arbitrary curves. RC1 realizes them with the following concrete CSS only:

| Semantic use | Real CSS easing | Where it is used |
|---|---|---|
| Living profile `acquire`, finite heartbeat, `passage`, and opacity `settle` | `cubic-bezier(0.16, 1, 0.3, 1)` (`--cxos-ease-vector`) | `agencyLivingAcquire`, `agencyLivingAcquireB`, `agencyLivingHeartbeat`; final Living alias for `--agency-chamber-ease`; current-profile opacity settle |
| Existing bounded arrival beats (`establish`) | `cubic-bezier(0.2, 0.74, 0.2, 1)` | existing Agency arrival identity/system/Kai beat selectors; no new Living loop |
| `linear-signal` | CSS `linear` | invisible arrival clock and the optional view-timeline depth interpolation |
| Legacy environmental sweep (non-Living behavior) | CSS `ease-in-out` | `agencySweep` remains in inherited Agency CSS but is hard-disabled by Living mode and is not a Living channel |

`establish`, `acquire`, `passage`, `settle`, and `linear-signal` describe permitted intent; the table above records the actual realization. It would be false to claim that the five names are currently five independently exported easing variables.

### 4.3 Drift, scroll, and chamber-acquire values (RC1 record — superseded by §11.4)

**→ RC2 changed nearly every value in this section's table and its closing paragraph.** This table is preserved as the RC1 shot-geometry record; treat every entry/scroll/scale number below as historical, not current. §11.4 is the authoritative current per-chamber value registry, read directly from `agency-command.module.css` and `environment.ts` at RC2 HEAD.

**VERIFIED — candidate CSS, RC1 revision.** These values were finite and presentation-only:

| Mechanism | Exact value and direction | Eligibility and hard stop |
|---|---|---|
| Tier A ambient heartbeat | `agencyLivingHeartbeat` keeps the field at `translateX(52vw)` while opacity moves `0.18 → 0.28 → 0.18` over 2400 ms, one iteration | Tier A budget `2` only; removed on attention, non-quiet Kai, idle settling/settled, hidden/passage/static projection, Tier C/D, and reduced motion |
| Tier B profile heartbeat | `agencyLivingAcquireB` settles transform and initial opacity by `10.625%` (`340 ms`), eases opacity to `0.82` at `52%`, then returns it to `1` at 3200 ms | Tier B budget `1`; no ambient channel and no profile offset/scale travel |
| Central depth acquire | Tier A `translateY(8px) scale(1.000) → none` over 520 ms | signature `center-out`; no scroll timeline |
| Client depth acquire / scroll | Tier A acquire from `translateX(-8px) scale(1.000)` over 520 ms; where CSS view timelines are supported, the same channel is replaced by `translateX(-8px → 8px)` across `cover 8% → cover 92%` | signature `lane-travel`; native scroll remains authoritative |
| Team depth acquire | Tier A `scale(1.012) → none` over 520 ms | signature `relational-acquire`; no scroll timeline |
| Business Health depth acquire | Tier A `translateY(-4px) scale(1.000) → none` over 520 ms | signature `diagnostic-draw`; no scroll timeline |
| Evidence Archive depth acquire / scroll | Tier A acquire from `translateY(8px) scale(1.000)` over 520 ms; optional view timeline replaces it with `translateY(8px → -8px)` across `cover 8% → cover 92%` | signature `tray-align`; vertical archive depth |
| Kai depth acquire | Tier A `scale(1.018) → none` over 520 ms | signature `inward-converge`; decorative depth plane only; no scroll timeline |
| Growth depth acquire / scroll | Tier A acquire from `translateX(8px) scale(1.000)` over 520 ms; `--cxos-scroll-x: -8px` yields optional `translateX(8px → -8px)` across `cover 8% → cover 92%` | signature `horizon-expand`; horizontal and intentionally distinct from Archive |

The `16px` end-to-end view-timeline traversals above are expressed as endpoints no farther than `8px` from rest: Client and Growth move horizontally; Archive moves vertically. They do not capture wheel, touch, or scrollbar input. Tier B resets chamber entry translation/scale to rest and receives only its combined profile acquire/opacity heartbeat, with transform settled by 340 ms. Tier C/D, reduced, invalid, hidden, passage, inspection, reading, non-quiet Kai, and settled idle receive none.

The exact acquire poses stay inside the approved Tier A `1.000–1.018` scale envelope. Tier B resets every entry offset and scale to rest (`1.000`), which is stricter than its `1.000–1.008` ceiling.

**→ RC2 makes the paragraph above false.** Tier B no longer resets chamber entry translation/scale to rest: it now carries each chamber's own Tier A entry signature at half amplitude (a per-signature override, not a blanket reset), and the Tier A entry amplitudes it halves were themselves raised from RC1's ±4–8 px family to RC2's ±16–24 px family. The practical consequence is that the RC1-era Tier B ceilings stated here and in §4.4/§7.2 (`≤4 px` translation, `≤1.008` scale) no longer hold: RC2's shipped, guard-verified Tier B values reach `±12 px` translation on four chambers and `1.009` scale on Kai Suite (0.001 over the old ceiling). This document's ceiling numbers are corrected in §4.4 and §7.2 below (each flagged inline); the full per-chamber Tier B table is in §11.4. Whether `4 px`/`1.008` was ever meant to bind as a hard governance ceiling, or was only ever a description of what RC1 happened to ship, is not resolved by this amendment and is flagged for adversarial review.

### 4.4 Spatial, blur, light, and animation limits

| Token family | Tier A | Tier B | Tier C | Tier D |
|---|---:|---:|---:|---:|
| Near / mid / far camera-offset maximum → RC2: see §11.4 | 8 / 4 / 2 px (**RC2 Tier A entry amplitude is now ±16–24 px** — this row's Tier A number is also superseded) | 4 / 2 / 0 px (**RC2 makes this false: now up to 12 px** — half of RC2's raised Tier A amplitude, see §4.3/§11.4) | 0 | 0 |
| Approved camera scale | 1.000–1.018 | 1.000–1.008 (**RC2 makes this false by 0.001: Kai Suite's Tier B convergence is 1.009**, see §11.4) | 1.000 | 1.000 |
| Environmental blur | 0–6 px, decorative only | 0–3 px | 0 | 0 |
| Decorative light-intensity envelope | 0.30–0.82 | 0.24–0.62 | static | static |
| Running environmental animations (continuous class only) → RC2: see §11.1 | at most 2, active room/chamber only | at most 1, active room/chamber only | 0 | 0 |
| Sustained animations after idle | 0 | 0 | 0 | 0 |

**→ RC2 adds two rows this table never had, because RC1 had no transient/scroll accounting.** RC2 formalizes a three-class motion model (§11.1): the continuous ceilings above are unchanged in shape (Tier A ≤2, Tier B ≤1, quiet/settled/Tier C/D = 0), but transient beats (play-once, ≤1500 ms, ≤3 concurrent grouped by channel token) and scroll (ViewTimeline-driven) are now separately classified and excluded from the continuous count rather than being unaccounted-for or miscounted against it.

The Living decorative planes apply no CSS blur in RC1; mobile and Tier B explicitly remove filters from those planes. The pre-existing facility-directory `backdrop-filter: blur(14px)` is static navigation chrome, not a moving environmental plane, and is removed at Tier B/mobile. The CSS declares reference light values `--cxos-light-rest: 0.08`, `--cxos-light-active: 0.14`, and `--cxos-light-focus: 0.2`, but current selectors use profile-specific gradient alpha and state overrides rather than consuming those declarations. Therefore they are not claimed as measured applied intensity. Kai-focused presence sets the existing overhead light to `opacity: 0.72`; attention and idle reduce environmental-plane opacity to `0.30` and `0.46` respectively. All light remains decorative and cannot encode status alone.

Continuous capable-tier motion stays within the route's three declared transform/opacity channels and the projected Tier A/Tier B running budgets above. Any bounded filter or clip-path use is subordinate, measured, and equivalent in its final static frame.

### 4.5 Closed chamber-profile vocabulary

**VERIFIED — `lib/cxos/runtime.ts`.** A valid profile uses exactly one value from each closed family; unknown values fail the whole Living profile to static. Agency's exact seven mappings live in `app/review/agency-command/environment.ts`. The adapter projects the selected motion value as the root `data-cxos-signature` attribute; seven signature selectors in the route CSS directly own the corresponding entry and scroll variables. This makes the closed signature—not a duplicated profile-id switch—the executable motion-variable authority.

| Family | Closed values |
|---|---|
| Emotion | `command-authority`, `operational-flow`, `human-coordination`, `diagnostic-awareness`, `evidentiary-trust`, `calm-intelligence`, `strategic-expansion` |
| Camera | `command-wide`, `operational-oblique`, `relational-eye-level`, `diagnostic-elevated`, `archive-perspective`, `executive-portrait`, `capacity-horizon` |
| Lighting | `command-aperture`, `directional-rail`, `relational-pool`, `analytical-overhead`, `provenance-slot`, `executive-key`, `horizon-wedge` |
| Depth | `long`, `diagonal`, `medium`, `compressed`, `longitudinal`, `shallow`, `maximum` |
| Motion | `center-out`, `lane-travel`, `relational-acquire`, `diagnostic-draw`, `tray-align`, `inward-converge`, `horizon-expand` |
| Focus | `priority-instrument`, `operating-floor`, `operator-core`, `missing-inputs`, `evidence-ledger`, `executive-response`, `capacity-boundary` |
| Idle | `command-hold`, `parked`, `solo-steady`, `diagnostic-hold`, `archive-aligned`, `executive-still`, `reserve-dark` |
| Kai context | `executive-context`, `operational-context`, `human-context`, `diagnostic-context`, `evidence-context`, `focused-channel`, `strategy-context` |

### 4.6 Explicit presentation signals

| Signal | Closed states | Owner and meaning |
|---|---|---|
| Attention | `ambient`, `reading`, `inspecting` | Agency supplies current semantic attention; Core Runtime projects presentation only |
| Kai presentation | `quiet`, `staged`, `preparing`, `resolved` | Agency derives an explicit visual phase from existing deterministic route state |
| Idle | `engaged`, `settling`, `settled` | The sole browser adapter owns the bounded presentation timer |
| Lifecycle | arrival, operating, passage, hidden, departure | Existing Core Runtime lifecycle remains authoritative |

The engine never infers attention or Kai intent from command text. `preparing` is reserved for a truthful future in-progress operation; the Agency specimen does not invent a delay to use it.

### 4.7 Source-code map and target implementation budgets

| Concern | Candidate source of truth |
|---|---|
| Closed profile types, validation, tier budget, hard-quiet/static policy | `lib/cxos/runtime.ts` |
| One adapter, attention detection, idle timer, lifecycle cleanup, projected data attributes | `components/cxos/runtime/useCxosRoomRuntime.ts` |
| Agency's seven immutable profile mappings and idle thresholds | `app/review/agency-command/environment.ts` |
| Agency lifecycle durations, channel ownership, explicit Kai-state derivation | `app/review/agency-command/stage.tsx` |
| Shot geometry, signature-root entry/scroll variables, passage atmospheres, easing/duration declarations, keyframes, view-timeline replacement, and hard-off selectors | `app/review/agency-command/agency-command.module.css` |
| Contract ceilings and review boundary | `CXOS_LIVING_ENVIRONMENT_ENGINE_RC1_PLAN.md` §§4–5 |

The RC1 plan sets targets of no more than 15 KiB gzip incremental client JavaScript and 24 KiB raw incremental route CSS relative to RC5. These are targets, not measured claims. Candidate evidence must replace estimates with actual deltas, and any larger increase requires simplification before Preview.

## 5. Lifecycle grammar

### 5.1 Arrival

Arrival establishes facility identity, scope, source readiness, and the initial settled truth. It never gates access to the semantic document. Skip and Escape settle to the same truthful final frame, with focus preserved.

### 5.2 Operating and attention

The active room—and in chamber mode, the active chamber—may express only its declared bounded channels. Reading reduces distraction. Opening an inspection or giving Kai focused presence clears the idle timer and immediately quiets or settles ambient motion so evidence remains primary.

**→ RC2 narrows what counts as "reading"; see §11.5.** This paragraph is still true as written but was, in RC1, over-broad in practice: any focus inside the chamber body classified as reading and hard-settled the room, including facility-rail navigation. RC2 scopes reading to an actually open inspection plane or a genuine text-entry control only.

### 5.3 Idle settlement

Discrete pointer, keyboard, focus, and inspection activity at the room root may re-arm one validated timeout. There is no interval, global pointer tracker, uncontrolled animation frame loop, randomness, or continuously measured activity.

**→ RC2 adds scroll/wheel to this list; see §11.5.** Passive `scroll`/`wheel` listeners now also re-arm the same one validated timeout, trailing-throttled to at most once per ~900 ms so a fast scroll does not run a clear/set pair every frame — reading a chamber by scrolling now keeps it engaged instead of settling under the operator.

At the idle threshold:

1. state moves from `engaged` to `settling`;
2. the declared settle token completes; and
3. state becomes `settled`, with zero sustained environmental animation.

Replay, route reset, active-chamber change, projection change, pagehide, visibility change, and BFCache restoration deterministically clear or restore the presentation state. A stale timeout may never settle a new chamber.

### 5.4 Chamber passage

One existing passage lifecycle serves all seven shots. The source and destination profiles may direct axis and light; they do not create another overlay or state machine.

Every passage has five finite beats:

1. release source;
2. cross threshold;
3. identify destination;
4. acquire destination; and
5. settle focus.

Forward and backward travel have directional geometry but equal authority and duration. Direct selection uses the same grammar. Latest intent wins. There is no auto-advance.

Static and constrained projections replace the chamber immediately, move focus after layout, and announce only the acquired chamber.

### 5.5 Hidden, reduced, constrained, and invalid states

- Hidden documents pause nonessential motion and clear presentation timers.
- Tier C, Tier D, reduced-motion, constrained, skipped, and invalid projections run zero continuous environmental motion.
- Invalid profile ids, tokens, timing, chamber ids, order, or targets fail the entire enhanced profile to the complete declared static projection.
- Native navigation fails open to the room's real local destination.

### 5.6 Departure

Departure acknowledges the origin, preserves orientation, and hands off to the real destination. It commits at most once and retains the existing bounded local-navigation fallback. Modified clicks, new-tab behavior, downloads, and static projections remain native.

## 6. Seven-chamber shot profiles

**VERIFIED — candidate direction and source.** Every table below names the same eight directing dimensions so that “distinct” is reviewable rather than impressionistic. The profile-token row is executable in `environment.ts`; the adapter projects its motion token as `data-cxos-signature`, and the route CSS assigns that signature's exact entry/scroll variables. A motion-signature token does not dispatch JavaScript or grant another animation. Tier A may run the finite ambient heartbeat plus the current depth plane; Tier B uses only the depth plane for its combined acquire/opacity heartbeat. “Kai” always means presentation of explicit route-owned state. It never means inferred intent, computation, memory, or action.

### 6.1 Central Command

| Direction | Profile |
|---|---|
| Emotional intention | `command-authority`: authority, orientation, confidence, and facility scale without urgency theater |
| Operator POV | Wide `command-wide` establishing view from the command rail, high-neutral and centered on the acknowledged operator |
| Foreground / midground / background | Foreground: the threshold/rail; midground: priority instrument and semantic command banks; background: long centered horizon and command aperture. No more than these three planes |
| Active composition | Symmetric command deck with the priority brief held inside the middle-ground focus field; surrounding operational instruments establish scope without becoming a dashboard mosaic |
| Light direction / source | `command-aperture`: cool analytical light descends from the centered overhead aperture; restrained cyan emphasis terminates at the priority instrument |
| Movement direction | `center-out`: the decorative depth plane acquires from `+8px` vertical offset at `1.000` scale to rest; the priority treatment converges on the disclosed brief, never on a changing queue. **→ RC2 makes the offset false: see §11.4** (entry-y zeroed; a new `--cxos-entry-scale-x: 0.92` converging-aperture term replaces it as central-command's identity vector) |
| Transition rhythm | Common five-beat 620/460 ms passage; centered target atmosphere, 520 ms Tier A vector acquire or 340 ms Tier B transform settle within its finite profile heartbeat, then focus settlement. The outgoing stage uses the common direction-aware lateral recede; Tier C/D replace immediately |
| Focus / idle / Kai states | `priority-instrument` focus; reading/inspection quiets the field; `command-hold` settles to zero sustained motion; Kai uses `executive-context`, and any explicit non-`quiet` Kai phase hard-quiets ambient motion rather than adding a second signal |
| Truth guard | Priority movement may emphasize only the already-disclosed fixed brief; it cannot imply live work or a changing queue |

### 6.2 Client Operations Floor

| Direction | Profile |
|---|---|
| Emotional intention | `operational-flow`: flow, throughput, pressure, and coordination, bounded by the disclosed synthetic fixtures |
| Operator POV | `operational-oblique` runway view at working height, looking along rather than down on the floor |
| Foreground / midground / background | Foreground: queue threshold; midground: fixed packet lanes and blocked/waiting fixtures; background: diagonal floor depth and rail horizon |
| Active composition | Oblique left-to-right operating lanes keep fixed positions legible; the amber block is an interruption inside the disclosed lane, not a global alert |
| Light direction / source | `directional-rail`: cool rail light travels along the lane axis; amber originates only at the disclosed blocked fixture |
| Movement direction | `lane-travel`: one profile acquire begins `8px` left of rest; optional Tier A view interpolation replaces that channel with `-8px → +8px` horizontal travel. Fixture-state motion remains deterministic and cannot advance work. **→ RC2 makes both figures false: see §11.4** (entry now `-24px`; scroll pair now `±36px`). RC2 also gives the blocked fixture lane its own `continuous:blocked-pulse` channel — substituting for chamber breath at Tier A only, when a blocked packet is present (§11.4) — while keeping packet movement itself deterministic and incapable of advancing work |
| Transition rhythm | Common five-beat 620/460 ms passage with an oblique rail target; 520 ms Tier A acquire or 340 ms Tier B transform settle and the lateral common recede reinforce runway direction. Inspection cancels the active lane channel immediately |
| Focus / idle / Kai states | `operating-floor` focus; reading/inspection quiets the floor; `parked` holds packets at honest positions with zero sustained motion; Kai uses `operational-context` and any explicit staged/resolved phase hard-quiets ambient motion |
| Truth guard | Packet movement never claims a task advanced, a person acted, or a live queue changed |

### 6.3 Team Operations Room

| Direction | Profile |
|---|---|
| Emotional intention | `human-coordination`: responsibility and intentional solitude, never fake attendance or ambient “people” |
| Operator POV | `relational-eye-level` tableau at eye level with the solo operator occupying the deliberate center |
| Foreground / midground / background | Foreground: occupied operator threshold; midground: radial coverage geometry and owned role position; background: unlit coverage horizon with absent links remaining absent |
| Active composition | A centered relational field gives the one represented operator visual weight; future positions remain architecture, not silhouettes, dots, or presence claims |
| Light direction / source | `relational-pool`: soft perimeter light pools inward around the occupied role; unowned coverage remains dark |
| Movement direction | `relational-acquire`: the decorative radial plane scales from `1.012` to rest; any finite coverage recognition resolves toward the occupied core rather than populating empty positions. **→ RC2 makes the scale figure false: see §11.4** (team-operations moved off uniform scale entirely, onto `scale: 1` plus a new `--cxos-entry-scale-x: 0.94` horizon widen — distinct from Kai's unchanged uniform 1.018 convergence). The coverage-recognition beat itself (`agencyTeamRecognition`, restored as `transient:team-recognition`) is unchanged in meaning: RC5's original keyframe/duration/stagger, resolving toward the occupied core only |
| Transition rhythm | Common five-beat 620/460 ms passage with a concentric target atmosphere; 520 ms Tier A scale acquire or 340 ms Tier B transform settle, then stable eye-level frame. Common forward/back recede preserves navigation direction |
| Focus / idle / Kai states | `operator-core` focus; inspection may expose disclosed coverage while hard-quieting the environment; `solo-steady` holds the intentional solo state; Kai uses `human-context`, and any non-`quiet` phase quiets rather than simulates another presence |
| Truth guard | No dot, pulse, silhouette, or motion may imply an unrepresented teammate or live presence |

### 6.4 Business Health Observatory

| Direction | Profile |
|---|---|
| Emotional intention | `diagnostic-awareness`: monitoring, uncertainty, and strategic attention without numerical certainty |
| Operator POV | `diagnostic-elevated` observatory view facing the right-biased instrument horizon from a slightly elevated analytical position |
| Foreground / midground / background | Foreground: disclosed qualitative state; midground: diagnostic instruments and missing-input bank; background: compressed concentric rings around the upper-right analytical locus |
| Active composition | The observatory bank is biased toward the diagnostic locus, leaving missing inputs visibly unlit and the qualitative `WATCH` state adjacent to its source boundary |
| Light direction / source | `analytical-overhead`: cool light descends from above; controlled amber originates only at the `WATCH` instrument/ring locus |
| Movement direction | `diagnostic-draw`: the decorative plane acquires from `-4px` vertical offset at `1.000` scale; finite concentric attention draws around the disclosed locus and settles, without a score needle or progress arc. **→ RC2 makes the offset false: see §11.4** (now `-16px` — business-health stays the *smallest* Tier A translate of the four travel chambers even after RC2 raised every amplitude, so the diagnostic nudge remains its identity). Business Health also newly joins the scroll-linked list in RC2 (a `y: 24px` pair) — it was scroll-still in RC1 |
| Transition rhythm | Common five-beat 620/460 ms passage with an amber analytical target; 520 ms Tier A vector acquire closes the small elevated offset, while Tier B settles transform in 340 ms, then focus lands on the disclosed driver. Tier C/D cut directly to the same reading |
| Focus / idle / Kai states | `missing-inputs` focus keeps absent sources primary; reading/inspection stops ambient work; `diagnostic-hold` freezes the qualitative reading; Kai uses `diagnostic-context` and non-`quiet` presentation hard-quiets the observatory |
| Truth guard | Qualitative state remains qualitative; missing inputs stay visibly missing and no numeric score is invented |

### 6.5 Activity and Evidence Archive

| Direction | Profile |
|---|---|
| Emotional intention | `evidentiary-trust`: provenance, preservation, and traceability without implying a production audit trail |
| Operator POV | `archive-perspective` aisle view from a slightly low position, looking through ordered longitudinal shelves |
| Foreground / midground / background | Foreground: archive threshold/nearest tray; midground: semantic evidence ledger and inspected receipt; background: longitudinal shelf grid and visibly absent record positions |
| Active composition | A centered ledger sits inside layered, ordered shelf geometry; stacked depth shadows suggest filing order while all source labels remain semantic and readable |
| Light direction / source | `provenance-slot`: narrow slot light originates at the inspected source category and crosses only its aligned evidence layer |
| Movement direction | `tray-align`: acquire begins `8px` below rest; optional Tier A view interpolation replaces it with `+8px → -8px` vertical shelf travel, so archive depth reveals along the aisle rather than toward the operator. **→ RC2 makes both figures false: see §11.4** (entry now `-24px`, a sign flip from RC1's `+8px` that also ends the RC1-era byte-identity with Central Command's entry tuple; scroll pair now `±36px`) |
| Transition rhythm | Common five-beat 620/460 ms passage with a longitudinal shelf target; 520 ms Tier A vector acquire or its optional bounded vertical scroll replacement, while Tier B settles transform in 340 ms, then stable ledger focus. Departure uses the common directional recede while layers visually reseal |
| Focus / idle / Kai states | `evidence-ledger` focus; inspection brings the real disclosed layer forward and hard-quiets decoration; `archive-aligned` preserves stable order; Kai uses `evidence-context`, with all non-`quiet` phases quieting rather than generating provenance |
| Truth guard | Missing records remain visibly absent; decorative provenance never creates a source or receipt |

### 6.6 Kai Executive Suite

| Direction | Profile |
|---|---|
| Emotional intention | `calm-intelligence`: presence, intimacy, and precision without personhood, omniscience, or autonomy |
| Operator POV | `executive-portrait` eye-level close environment; operator and the one contextual Kai channel share a restrained central field |
| Foreground / midground / background | Foreground: operator command boundary and no-action disclosure; midground: executive response/workbench; background: shallow decorative key field and narrow horizon |
| Active composition | A centered executive desk contains the fixed local command and deterministic response; surrounding room geometry is quieter, but disclosures and controls never dim |
| Light direction / source | `executive-key`: focused top-center key light falls into the executive desk; surrounding light narrows when explicit Kai state is present |
| Movement direction | `inward-converge`: decorative depth begins at the Tier A ceiling of `1.018` and settles inward to rest. Explicit `staged`/`resolved` state changes styling, but the runtime immediately removes ambient/profile animation instead of simulating thinking |
| Transition rhythm | Common five-beat 620/460 ms passage with a centered portrait target; 520 ms Tier A vector scale-down acquire creates a restrained widening-to-context settle, while Tier B settles transform in 340 ms. C/D and reduced motion render the final portrait immediately |
| Focus / idle / Kai states | `executive-response` focus and `focused-channel` Kai context; command text yields explicit `staged`, an existing deterministic local response yields `resolved`, and this specimen never emits fake `preparing`; inspection/focus and `executive-still` both enforce zero sustained environmental motion |
| Truth guard | No motion implies consciousness, observation, memory, open-ended model work, a fake preparing delay, or an executed action |

### 6.7 Growth / Capacity Threshold

| Direction | Profile |
|---|---|
| Emotional intention | `strategic-expansion`: scale, possibility, and constraint without scarcity, upsell pressure, or entitlement |
| Operator POV | `capacity-horizon` wide view from a low-neutral position looking across occupied capacity toward dormant reserve |
| Foreground / midground / background | Foreground: disclosed capacity boundary; midground: occupied cells and constraint architecture; background: maximum-depth future horizon with reserve kept dark |
| Active composition | A broad centered horizon separates evidenced occupied cells from dormant reserve; the boundary, not a purchase action, is the protagonist |
| Light direction / source | `horizon-wedge`: cool light rises from the low future horizon; only occupied cells receive restrained illumination and reserve remains unlit |
| Movement direction | `horizon-expand`: acquire begins `8px` right of rest at `1.000` scale; `--cxos-scroll-x: -8px` makes the optional Tier A view interpolation travel `+8px → -8px` horizontally, deliberately distinct from Archive's vertical aisle. **→ RC2 makes both figures false: see §11.4** (entry now `+24px`; scroll pair now `±36px`) |
| Transition rhythm | Common five-beat 620/460 ms passage with the lowest target horizon; 520 ms Tier A vector acquire or its optional bounded horizontal scroll replacement, while Tier B settles transform in 340 ms, then capacity-boundary focus. The real room departure remains the existing Mission Control handoff |
| Focus / idle / Kai states | `capacity-boundary` focus; inspection may expand disclosed context but hard-quiets motion; `reserve-dark` leaves future capacity still; Kai uses `strategy-context`, and any explicit non-`quiet` phase removes ambient motion rather than making an offer |
| Truth guard | No scarcity, countdown, upgrade availability, billing entitlement, automatic expansion, or purchase implication |

## 7. Mobile, reduced-motion, and static direction

### 7.1 Mobile

- Present one chamber at a time.
- Preserve compact previous/current/next controls and a native expandable facility map.
- Keep every target at least 44 px and all navigation keyboard-, touch-, and screen-reader-complete.
- Recompose to one visual plane where necessary; halve capable parallax and shorten finite signatures.
- Capture no horizontal gesture, wheel, or touch travel.
- Keep browser Back/Forward as the chamber-history mechanism.
- Prevent horizontal overflow at 320 px and in landscape.

### 7.2 Tier B

Tier B keeps the composition and one bounded environmental channel while reducing camera travel, blur, parallax, and depth. Translation stays at or below 4 px, camera scale at or below 1.008, and passage remains the approved 460 ms. It is a deliberate projection, not a degraded Tier A.

**→ RC2 makes the translation/scale ceiling in the paragraph above false; see §4.3, §4.4, and §11.4.** RC2's per-signature Tier B halves reach `±12 px` translation (client-operations, evidence-archive, growth-threshold) and `1.009` scale (Kai Suite) — both over the RC1 numbers stated here. Passage duration (460 ms) is unchanged and still correct.

### 7.3 Reduced motion and Tier D

Reduced motion and Tier D use composition, light, border weight, scale hierarchy, spacing, and static depth. They do not use passage overlays, parallax, animated light, draw sequences, or running environmental animation.

All seven chambers remain distinct, complete, directly reachable, and truth-equivalent. Static does not mean empty, disabled-looking, or stripped of hierarchy.

### 7.4 Tier C, constrained capability, and no JavaScript

Tier C and constrained capability settle immediately with zero continuous motion. If enhancement is unavailable or invalid, the complete semantic document and explicit navigation remain available. No-JavaScript preserves headings, facts, controls, disclosures, reading order, and real destinations.

## 8. Kai presentation truth

Kai is CreditVector's one Credit Intelligence Officer. The Living Environment profile presents explicit state; it does not create Kai intelligence.

| Phase | Permitted presentation meaning | Forbidden reading |
|---|---|---|
| `quiet` | Contextual availability without attention capture | watching the operator, background work, or live presence |
| `staged` | The operator staged an existing fixed local command | intent inferred by the runtime or an action already underway |
| `preparing` | A truthful future operation is actually in progress | synthetic delay, fake thinking, or model activity in this specimen |
| `resolved` | The existing deterministic local response is visible | an external effect completed, a customer record changed, or Kai acted |

The existing no-action receipt remains visible. Kai presentation owns no model call, memory, customer fact, inference, recommendation, consent, authorization, persistence, or effect. Hidden, passage, static, invalid, and inspection states pause or quiet presentation according to the deterministic contract.

Kai may feel calm and attentive. It may not feel conscious, omniscient, autonomous, theatrical, or eager for engagement.

## 9. Forbidden patterns

### 9.1 Fabricated truth

- random particles or event-like signals;
- counters, fake telemetry, changing synthetic metrics, or fake progress;
- fake people, presence, queue movement, system breathing, or background work;
- manufactured urgency, pressure, scarcity, or entitlement;
- fake Kai thinking, memory, observation, preparation, or completion.

### 9.2 Spectacle without meaning

- casino pulse, celebratory churn, excessive glow, cyberpunk HUD treatment, or decorative reticles;
- autoplay media, sound, vibration, video, or runtime-generated assets;
- infinite engagement loops or motion whose only purpose is to keep the surface active;
- seven unrelated transition systems or chamber-local lifecycle engines.

### 9.3 Input and accessibility violations

- scroll capture, scroll hijack, wheel navigation, swipe chamber travel, or cursor tracking;
- focus hidden by dimming, clipping, blur, overlay, or inactive geometry;
- color-only meaning, sub-44 px controls, inaccessible inactive chambers, or motion-required facts;
- delaying or replacing a real destination for cinematic effect.

### 9.4 Performance and architecture violations

- layout animation, uncontrolled `requestAnimationFrame`, intervals, continuous DOM measurement, or global pointer tracking;
- Canvas, WebGL, a 3D or motion dependency, generic scene renderer, global visual provider, or second observer/lifecycle system;
- external runtime assets, scripts, network requests, telemetry, persistence, or storage writes;
- more than two Tier A or one Tier B running environmental animations, any running environmental animation after idle, or any Tier C/D/reduced animation.

## 10. Review checks

Before the cinematic profile can be presented as candidate-complete, evidence must show:

- [ ] one existing Core Runtime and one browser adapter remain the only lifecycle owners;
- [ ] every profile id, chamber id/order, token, and timing value validates or fails wholly to static;
- [ ] all seven shots preserve their semantic protagonist, facts, disclosures, controls, and destinations;
- [ ] Tier A/B active and idle animation counts meet the closed budgets;
- [ ] Tier C, Tier D, reduced, invalid, hidden, inspection, and settled-idle states show zero prohibited work;
- [ ] keyboard, touch, focus, Escape, Back/Forward, resize, visibility, and BFCache behavior remain deterministic;
- [ ] mobile, 200% reflow, landscape, 320 px, coarse pointer, reduced motion, constrained, and JavaScript-disabled projections remain complete;
- [ ] Kai has no fake `preparing` delay and every staged/resolved result retains its fixed-local/no-action truth;
- [ ] no candidate-owned network, storage, cookie, cache, service-worker, database, model, billing, or production effect exists; and
- [ ] the exact isolated commit, evidence, protected Preview identity, and production 404 hard-off are separately verified.

## 11. RC2 Amendments

### 11.0 Scope and authority

RC2 (branch `feat/cxos-living-environment-engine-rc2`, base `9129fef` — the accepted RC1 handoff) is bounded cinematic refinement, runtime lifecycle hardening, accessibility hardening, and evidence-harness breadth, governed by `CXOS_LIVING_ENVIRONMENT_ENGINE_RC2_PLAN.md`. It authorizes none of merge, production deployment, alias change, schema/auth/billing/dependency change, or work outside the CXOS review surface — the same terminal boundary as the rest of this document (§12) applies to everything in this section.

This section is the authoritative current statement for every topic it covers. §§1–10 remain the RC1 record elsewhere; this section does not re-litigate RC1 rules it did not change.

### 11.1 Three-class motion model

RC1's token system (§4.4) accounted only for a single "running environmental animations" ceiling. RC2 formalizes three distinct classes, each separately budgeted, and makes classification structural rather than name-based:

| Class | Definition | Ceiling |
|---|---|---|
| `continuous` | Counted against the published continuous budget | Tier A ≤2, Tier B ≤1, every quiet/settled/static/Tier C-D state = 0 (unchanged in shape from §4.4) |
| `transient` | Play-once acquisition/recognition/response/discovery beat | Each running instance: `iteration-count: 1`, duration ≤1500 ms. Counted by distinct running channel token, grouping staggered instances of one recognition beat (e.g. the team/evidence stagger delays) as one logical beat: ≤3 concurrent |
| `scroll` | ViewTimeline-driven, native-scroll-coupled | Excluded from the continuous count; tracked separately |

Classification is structural: every motion-bearing surface carries `data-cxos-motion-channel="<class>:<name>"` (space-separated when a single owner can run more than one, e.g. `.districtEnvironment [data-plane="depth"]` carries `continuous:chamber-breath transient:chamber-acquire scroll:depth-parallax`). The evidence harness resolves a single applicable token per *running* animation from that animation's own computed timeline type and iteration count when its owner declares more than one token — never from the keyframe name. A legacy keyframe-name regex is retained only as a narrow backstop for the `unclassified-environment-animation` fail path (any running animation on a decorative/environment surface with no resolvable token), never to decide a class.

This supersedes §4.4's "Running environmental animations" row, which described only the continuous ceiling.

### 11.2 Quiet-state law

**The law:** all `continuous` channels stop the instant the room is settled, reading, non-quiet Kai, hidden, in passage, or static/reduced/Tier C-D. No continuous channel may be observed running in any of these states.

**CSS mechanism — mutual exclusion, not precedence.** Every RC2 continuous opt-in (`.ambientSweep`'s facility-sweep, the per-chamber `.districtEnvironment` breath, the client-operations blocked-lane pulse) restates the same thirteen-way quiet-state negation directly on its own selector, at the same specificity as the unconditional Living-mode kill list it sits below:

```
:not(:is(
  [data-cxos-idle="settling"], [data-cxos-idle="settled"],
  [data-cxos-attention="reading"], [data-cxos-attention="inspecting"],
  [data-cxos-kai="staged"], [data-cxos-kai="preparing"], [data-cxos-kai="resolved"],
  [data-cxos-environment-motion="quiet"], [data-cxos-environment-motion="static"],
  [data-tier="C"], [data-tier="D"], [data-cxos-tier="C"], [data-cxos-tier="D"]
))
```

"Hidden" and "passage" are not separate checks in this list: `resolveCxosLivingEnvironmentProjection` (`lib/cxos/runtime.ts`) already folds `documentHidden` and `passage` into `motion: "quiet"` (projected as `data-cxos-environment-motion="quiet"`), so the same negation covers them. The negation makes the opt-in and the kill list structurally mutually exclusive — at most one can ever match a given element — instead of relying on the relative precedence of two separately-declared `!important` rules, which is what RC1 did and which, for the scroll opt-in specifically, was a genuine specificity **tie** (both resolved to `0,5,0`, broken only by source order).

**Runtime safety net.** `useCxosRoomRuntime.ts` adds a `useLayoutEffect` that, the instant `livingEnvironment.motion` stops being `"active"`, walks `root.getAnimations({ subtree: true })`, resolves each running animation's owning `[data-cxos-motion-channel]` ancestor, and calls the Web Animations API's `animation.cancel()` on any animation whose channel string contains a `continuous:` token. This runs before the next paint (`useLayoutEffect`, not `useEffect`). It is belt-and-suspenders on top of the CSS gate, not a second policy or a replacement — it reads the identical `data-cxos-motion-channel` token grammar the CSS and the harness already treat as the single source of truth, and it is room-agnostic (no Agency-specific class names).

**Why the net exists — disclosed, not resolved.** A real long multi-step harness session (concurrent per-chamber Axe audits plus `animations:"disabled"` screenshot capture, under heavier main-thread load than any single constructed repro) showed one specific continuous animation — `.ambientSweep`'s facility-sweep, an 18-second linear-infinite loop — occasionally still reported as running well after `continuousAnimationBudget` read `0` in the DOM. The CSS negation is specificity-correct, and every constructed single-mechanism repro (atomic attribute flips against the real built stylesheet, repeated engage/settle cycling, a full seven-chamber navigation loop with real per-chamber Axe audits, scroll-linked measurement, arrival replay, and combinations of all of the above) canceled it correctly every time. The exact browser-level mechanism that let this one long-running animation's cancellation go unpicked-up under real conditions was **not pinned down** and is disclosed here as an open, mitigated question pending adversarial review — not a solved one. This is distinct from, and should not be confused with, the `scroll:depth-parallax` specificity-tie bug described above, which *was* fully diagnosed and fixed structurally in the same investigation.

### 11.3 Subject-based chamber recognition

RC1 collapsed chamber identity to a vector on one decorative plane. RC2 restores the six RC5 chamber-acquisition recognitions plus the Kai response reveal and the inspection discovery beats — all `transient`, all firing on the subject the recognition is actually about, not on wallpaper:

| Beat | Chamber · DOM subject | Keyframe | Duration | Fires on | Channel token |
|---|---|---|---|---|---|
| Client floor sweep | Client Operations · `.clientFlowMoment::after` | `agencyClientFloorSweep` | 960 ms | chamber acquisition | `transient:client-recognition` |
| Team recognition (+ stagger) | Team Operations · `.teamOrbit li > span` | `agencyTeamRecognition` | 860 ms (+90 ms / +180 ms staggers) | chamber acquisition | `transient:team-recognition` |
| Observatory scan | Business Health · `.healthBank::after` | `agencyObservatoryScan` | 1400 ms | chamber acquisition | `transient:observatory-recognition` |
| Evidence recognition (+ stagger) | Evidence Archive · `.archiveEvidenceList li > span` | `agencyEvidenceRecognition` | 900 ms (+80/160/240 ms staggers) | chamber acquisition | `transient:evidence-recognition` |
| Kai recognition | Kai Suite · `.kaiDesk::before` | `agencyKaiRecognition` | 1200 ms | chamber acquisition | `transient:kai-recognition` |
| Capacity scan | Growth Threshold · `.capacityHorizon b` | `agencyCapacityScan` | 1100 ms | chamber acquisition | `transient:capacity-recognition` |
| Kai response reveal | Kai Suite · `.kaiResponse[data-prepared="true"]` | `agencyArtifactReveal` | 420 ms | new turn mount (not budget-gated) | `transient:kai-response` |
| Inspection acquire | any chamber · `.inspectionBody` | `agencyInspectionAcquire` | 260 ms | inspection open, even in a settled/reading room | `transient:inspection-acquire` |
| Provenance trace | any chamber · `.districtTruth::after` | `agencyDistrictTruthDraw` | 260 ms | inspection open | `transient:provenance-trace` |

The `.kaiResponse` element (not the similarly named `.preparedArtifact`, which is orphaned CSS with no JSX consumer) is the live "intelligent response" beat: each submitted command mounts a new `.kaiResponse` article keyed by a fresh turn id, so the reveal fires once on mount and is not re-armed by chamber navigation.

The six recognitions and the response reveal fire exactly once per chamber acquisition because non-current `.district` sections carry the native `[hidden]` attribute (`display: none !important`); gaining `[data-current="true"]` and losing `[hidden]` together is a remount-equivalent event for CSS animation (nothing to run while `display: none`, a fresh start the instant `display` resumes) — the same mechanism the acquire keyframes and the existing threshold beat already relied on, so gating on `[data-current="true"]` alone is sufficient.

The two discovery beats opt in directly off `[data-cxos-attention="inspecting"]` rather than the continuous-budget gate, because inspecting already forces that budget to `0`; they exclude only the frozen static projection (Tier C/D, or reduced motion without the explicit cinematic override).

### 11.4 Per-chamber value registry

Current values, read directly from `agency-command.module.css`'s seven signature blocks and `environment.ts` at RC2 HEAD (`6c69ef6`). This table is the single source of truth for shot geometry; §4.3 and §6.1–6.7 above are the superseded RC1 record.

**Motion geometry**

| Chamber | Signature | Tier A entry (x, y) | Tier A entry-scale / entry-scale-x | Tier B entry (half-amplitude) | Scroll pair (Tier A, travel chambers only) |
|---|---|---:|---:|---|---|
| Central Command | `center-out` | 0, 0 | 1 / 0.92 | x0 y0, scale 1, scale-x 0.96 | — scroll-still by design |
| Client Operations | `lane-travel` | −24px, 0 | 1 / — | x −12px y0, scale 1 | x 36px, y 0 |
| Team Operations | `relational-acquire` | 0, 0 | 1 / 0.94 | x0 y0, scale 1, scale-x 0.97 | — scroll-still by design |
| Business Health | `diagnostic-draw` | 0, −16px | 1 / — | x0 y −8px, scale 1 | x 0, y 24px |
| Evidence Archive | `tray-align` | 0, −24px | 1 / — | x0 y −12px, scale 1 | x 0, y −36px |
| Kai Suite | `inward-converge` | 0, 0 | 1.018 / — | x0 y0, scale 1.009 | — scroll-still by design (decorative plane only) |
| Growth Threshold | `horizon-expand` | 24px, 0 | 1 / — | x 12px y0, scale 1 | x −36px, y 0 |

Central Command, Team Operations, and Kai Suite are scroll-still **by design**, not by omission — their identity is carried entirely by the entry vector/scale-x on the `aria-hidden` depth plane; the four scroll-linked chambers (Client Operations, Evidence Archive, Growth Threshold, Business Health) are the complete `@supports (animation-timeline: view())` opt-in list, gated the same as every other continuous surface (budget-2/Tier-A only) and verified against `resolveCxosLivingEnvironmentProjection`'s tier→budget mapping.

**Presentation identity**

| Chamber | Chamber edge (`--agency-chamber-edge`) | Breath period | idleAfterMs A / B | Settle opacity | Passage signal | Passage origin |
|---|---|---:|---:|---:|---|---|
| Central Command | `rgba(134,215,255,0.42)` | 5000 ms | 7000 / 5000 | 0.50 | `rgba(134,215,255,0.65)` | center |
| Client Operations | `rgba(134,215,255,0.38)` | 4600 ms† | 8000 / 6000 | 0.54 | `rgba(134,215,255,0.62)` | right |
| Team Operations | `rgba(134,215,255,0.30)` | 5800 ms | 6000 / 4500 | 0.46 | `rgba(134,215,255,0.55)` | center |
| Business Health | `rgba(244,199,109,0.30)` | 6400 ms | 6000 / 4500 | 0.48 | `rgba(244,199,109,0.76)` — fixed reference point, unchanged | top |
| Evidence Archive | `rgba(134,215,255,0.36)` | 6800 ms | 5000 / 4000 | 0.44 | `rgba(134,215,255,0.60)` | top |
| Kai Suite | `rgba(134,215,255,0.34)` | 7200 ms | 5000 / 4000 | 0.42 | `rgba(134,215,255,0.58)` | center |
| Growth Threshold | `rgba(244,199,109,0.36)` | 5600 ms | 8000 / 6000 | 0.52 | `rgba(244,199,109,0.60)` — second amber | left |

† Client Operations' Tier A slot 2 is the one declared exception: instead of chamber breath, the blocked fixture lane's `.flowTrack b` pulses (`continuous:blocked-pulse`, 2400 ms) whenever a blocked packet exists — continuous motion carrying real operational state, not decoration. It still receives chamber breath at Tier B, which has no second continuous slot to spare for the substitution.

The room-level `idleAfterMs` default (`AGENCY_LIVING_ENVIRONMENT.idleAfterMs`, 6000 ms A / 4500 ms B) is unchanged from RC1 and now serves only as the fallback for a chamber that omits its own value; all seven currently declare their own.

Each destination's `--cxos-passage-signal` is a stronger reading of that same chamber's own `--agency-chamber-edge` — identical RGB, alpha remapped from the edge's ~0.30–0.42 band up to a ~0.55–0.65 passage band. Business Health's pre-existing 0.76 amber is the fixed reference point this remapping is anchored to; Growth Threshold is the second amber, mapped by the same rule. `--cxos-passage-origin` sets the "FROM — TO" axis line's `transform-origin` from that destination's own entry-vector sign (§11.7).

### 11.5 Attention and idle policy

- **Reading** is scoped to an actually open inspection plane (`details[data-cxos-inspection][open]`) or focus inside a genuine text-entry control (`input` excluding button/submit types, `textarea`, `[contenteditable]`) — nothing else. Facility-rail links, buttons, and summary disclosures are `ambient`: focusing or activating them still registers activity (below), but does not itself settle the room. Clicking the map is not reading.
- **Activity** that re-arms the one idle timeout: pointer, keyboard, focus, toggle, and input events (unchanged from RC1), plus passive `scroll`/`wheel` listeners at both the room root and the window, trailing-throttled to at most once per ~900 ms.
- **Idle timing is per-chamber**: each of the seven chambers declares its own `idleAfterMs` (§11.4), resolved against the *active* chamber, falling back to the room-level default only if a chamber omits it. Kai Suite and Evidence Archive settle fastest (5000/4000 ms); Client Operations and Growth Threshold hold longest (8000/6000 ms).
- **Settling preserves pose.** At `settled` idle, RC1 flattened every chamber's overhead-light `transform` to `none`, erasing the seven per-chamber poses at rest. RC2's `.overheadLight` rule at settled/settling drops only `opacity`, never `transform`, so each chamber's translate/scale-x identity keeps reading even at rest. `.districtEnvironment` itself eases through a distinct `0.72` intermediate while `settling`, before landing on its own per-signature `--cxos-settle-opacity` (0.42–0.54, §11.4) once fully `settled`.
- **Reading dim** moved from `0.30` to `0.42` opacity on `.districtEnvironment` (quiet, not dead).

### 11.6 Kai presence scoping

- Any non-`quiet` Kai phase (`staged`/`preparing`/`resolved`) dims every **other** chamber's `.overheadLight` to `opacity: 0.72` without touching its `transform` — each chamber's own per-district pose keeps applying underneath, so there is no cross-chamber bleed.
- Kai Suite's own chamber is scoped separately: its rest pose is already `scaleX(0.72)`, so `staged`/`preparing` narrows it further to `scaleX(0.58)` — a visible convergence in Kai's own chamber, not merely a dim. `resolved` intentionally falls back to the chamber's native rest pose (the light opens back up once the response has landed).
- `staged → preparing → resolved` is a visible escalation using only the `border-color`/`background-color` pair already transitioned on `.kaiContext` — `preparing` is now visually distinct from `staged` (deeper border, denser background), with no new animation channel introduced.
- `data-cxos-kai-presence` (`acquiring`/`available`/`paused`/`suspended`/`static`/`unavailable`) is a separate lifecycle axis from the per-turn `data-cxos-kai` state above. RC1 left it fully unconsumed. RC2 gives it its first real CSS consumer: `suspended` — which fires only while `phase: "departing"` (Tier A/B, valid contract) — resets `.kaiContext` to a neutral border/no-background baseline, matching the existing departure copy ("Kai instruments are receding"). The other five presence states remain covered by the existing `data-tier`/`data-hidden` gates and have no dedicated consumer of their own yet.
- **Carried-context label.** The held Kai-context line (Kai Suite is the sole `kaiContextHoldDistricts` member) prefixes a "CARRIED CONTEXT · [chamber]" eyebrow whenever `kaiContextDistrict !== activeDistrict`. RC2 fixed a one-frame paint defect in this mechanism: `kaiContextDistrict` used to sync via a `useEffect` (which runs after commit/paint), leaving exactly one already-painted frame on **every** chamber change — not only entry to a held chamber — where the stale district made `carriedContext` read `true` and the label flash on: a real, measured, then-reverted layout shift. The fix adjusts `kaiContextDistrict` *during rendering* (a ref-tracked conditional `setState` call mid-render — React's documented "storing information from previous renders" pattern) instead of in an effect, so the corrected value commits on the first painted frame. `kaiContextHoldDistricts`' actual behavior — Kai Suite legitimately keeps showing the prior chamber's line — is unchanged and was empirically reverified: a live trace across all seven chambers showed the label appearing exactly once (on entry to Kai Suite) with zero non-input layout-shift entries above `0.001` anywhere in the loop.

### 11.7 Passage law

- Every destination chamber (all seven, not only Business Health as in RC1) now declares its own `--cxos-passage-signal` and `--cxos-passage-origin` (values in §11.4).
- `--cxos-passage-origin` is derived mechanically from that destination's own entry-vector sign: negative entry-x → origin `right` (the chamber travels left, so the axis line grows from the right); positive entry-x → origin `left`; negative entry-y → origin `top`; the scale-x/uniform-converge chambers (Central Command, Team Operations, Kai Suite) → origin `center`.
- **Swap timing is not a mid-passage timeout.** `stage.tsx`'s `completeDistrictTransition` fires only from the passage element's own `onAnimationEnd` (guarded by `event.currentTarget === event.target`), landing exactly at the `agencyFacilityPassage` keyframe's 100% mark (620 ms Tier A / 460 ms Tier B) — matching `districtTransitionFallbackRef`'s safety timer, armed for the same full duration. The opaque hold therefore brackets the *true* 100% swap point rather than an early window: opacity fades in `0–68%` (the same window the source chamber's own recede animation spends dimming to `0.16` opacity) and holds fully opaque `68–100%` — a 32% span, under the ~40% ceiling, with no fade-out leg (opacity only ever animates toward `1`, so the veil cannot go transparent before the destination is already the rendered chamber). RC1's window was a `16–78%` hold with an earlier effective swap point, which could let the fade-out reveal the still-current source chamber immediately before the swap.

### 11.8 Arrival compression

The masthead (eyebrow + room title only — never the SYNTHETIC FOUNDER REVIEW disclosure, a sibling element that is never targeted) compresses **opacity-only** (to `0.4`) while `data-chamber-phase="passage"`, returning to full opacity once the phase returns to `settled`.

This was not always opacity-only. It previously also animated `max-height` (`20rem → 4.5rem`) and `align-items` (`center → flex-start`). `max-height` is a real layout property, and the settled-state rule already transitions it, so every chamber passage collapsed and re-expanded the masthead's box — a genuine layout shift, twice per navigation, accumulating into nonzero phase and cumulative CLS that the acceptance budget (near-zero per phase, ~0 cumulative) does not allow. This was corrected in commit `e815c284`. Dropping `max-height` (and its now-unneeded `align-items` partner, which only steered which edge a `max-height` clip exposed) leaves only `opacity` animating — compositor-only, zero layout impact. The settled-state's own merged control row (`align-items: center`, `max-height: 20rem`, `overflow: hidden`) is untouched static rest-state layout, not part of this per-transition rule.

This is not a new rule — it is RC2 bringing the implementation back into compliance with an existing one: §9.4 already forbids "layout animation." The `max-height` version was, in retrospect, exactly that forbidden pattern.

### 11.9 One-noun law

Rendered copy only: `districtHeader`'s "DISTRICT {i} / 07" → "CHAMBER {i} / 07" (both the visible label and its `aria-hidden` decorative counterpart), the facility rail's "7 DISTRICTS" → "7 CHAMBERS", and the arrival rail's "Seven districts available" → "Seven chambers available". Code identifiers, CSS class names, `data-*` attributes, and ids are unchanged — still `district`, `data-agency-district`, `AgencyDistrictId`, `.districtEnvironment`, and so on. This is a rendered-copy unification only, not a rename of the implementation vocabulary; it brings what an operator or screen-reader user actually hears/reads into line with the "chamber" vocabulary this bible has used throughout §§2 and 6 since RC1.

### 11.10 RC1 statements corrected by RC2 (index)

Every row below is corrected inline at its cited location; this table exists as a scan-friendly index, not a duplicate ruling.

| # | RC1 location | RC1 statement | RC2 reality |
|---|---|---|---|
| 1 | §4.1, Finite heartbeat row | 2400 ms (A) / 3200 ms (B) | Root default 1200 ms, Tier B 1400 ms — `agencyLivingAcquireB` is structurally `transient` (≤1500 ms), not continuous, despite its name |
| 2 | §4.1, `--cxos-dur-drift` row | "no Living animation consumes this duration" | `agencyLivingHeartbeat` (Tier A `.ambientSweep`) consumes it directly, 18,000 ms |
| 3 | §4.1, `--cxos-light-rest`/`--cxos-light-active` row | "declared reference only" | Consumed via `--cxos-breath-lo`/`--cxos-breath-hi` (chamber breath) and Growth's static capacity-cell opacity step |
| 4 | §4.1, Idle threshold row | one room-level pair (6000/4500 ms) | Per-chamber (§11.4); room pair is now only the fallback |
| 5 | §4.3 table (entry vectors, Tier A heartbeat description, scroll pairs) | RC1 shot geometry | Superseded wholesale — §11.4 |
| 6 | §4.3 closing paragraph | "Tier B resets every entry offset and scale to rest" | Tier B carries per-signature halves, not a reset |
| 7 | §4.4 / §7.2, Tier B translation ceiling | ≤4 px | Up to ±12 px (half of RC2's raised Tier A amplitude) |
| 8 | §4.4 / §7.2, Tier B scale ceiling | ≤1.008 | 1.009 on Kai Suite |
| 9 | §6.1 Central Command, Movement direction | `+8px` vertical entry | `0`, plus new `--cxos-entry-scale-x: 0.92` |
| 10 | §6.2 Client Operations, Movement direction | `8px` entry / `±8px` scroll | `−24px` entry / `±36px` scroll |
| 11 | §6.3 Team Operations, Movement direction | uniform scale `1.012` | `scale: 1` + `--cxos-entry-scale-x: 0.94` |
| 12 | §6.4 Business Health, Movement direction | `−4px` entry; scroll-still | `−16px` entry; now scroll-linked (`y: 24px`) |
| 13 | §6.5 Evidence Archive, Movement direction | `+8px` entry / `±8px` scroll | `−24px` entry (sign flip) / `±36px` scroll |
| 14 | §6.7 Growth Threshold, Movement direction | `8px` entry / `±8px` scroll | `+24px` entry / `±36px` scroll |

Not corrected because still accurate: Kai Suite's Tier A entry-scale ceiling (`1.018`, §6.6); the 520 ms/340 ms acquire durations; the 620 ms/460 ms passage timing; the closed profile-token vocabulary (§4.5); the ownership/truth boundary (§3); the forbidden-patterns list (§9).

## 12. Terminal boundary

This bible governs the presentation language of the isolated Agency Headquarters RC1/RC2 candidate lineage. It is not an implementation-validation report, Founder acceptance, merge approval, production authorization, award claim, accessibility certification, or permission to adopt Living Environment on another surface.
