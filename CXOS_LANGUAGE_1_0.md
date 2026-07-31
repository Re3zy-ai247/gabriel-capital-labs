# CreditVector CXOS Language 1.0

**Working specification · Gabriel Capital Labs · CreditVector™ Experience OS**

**Version:** 1.0
**Date:** 2026-07-31
**Status:** Working specification for design, implementation planning, review, and QA

> This document is not a constitution, architecture approval, merge approval, or production authorization. It organizes the current CXOS foundation, the Founder-approved Phase 5.2 and Phase 5.3 experience direction, and the Founder-directed Phase 6.1 Living Agency Command refinement into one usable review standard. Canonical repository governance and separate release approvals still control.

## 1. Truth labels and boundary

Every law in this document carries one of four meanings:

- **FOUNDATION** — established by `CXOS_FOUNDATION.md`.
- **APPROVED DIRECTION** — reviewed and approved through the Phase 5.2 and Phase 5.3 Founder experience review.
- **PROPOSED EXTENSION** — a design direction suitable for a synthetic Founder prototype, but not yet production-approved.
- **RELEASE GATE** — evidence required before a reviewed delta may proceed to a separately authorized integration or deployment step.

Source set:

- `CXOS_FOUNDATION.md`
- `CXOS_PHASE_5_2_REPORT.md`
- `CXOS_PHASE_5_3_REPORT.md`
- Phase 6 Agency Command design-plan audit
- Founder Phase 6.1 Living Agency Command refinement directive (2026-07-31)

This specification does not authorize:

- a wholesale merge of a historical feature branch;
- production deployment, promotion, or alias changes;
- database, Prisma, migration, backend, auth, billing, or environment changes;
- dependency additions;
- claims that synthetic fixtures, proposed rooms, or review controls are live product capabilities.

**Branch-lineage disclosure:** current Phase 6 Founder-preview work is being prepared on `feat/cxos-phase3`. A Preview from that branch contains the branch’s full historical state, not an isolated production-integration patch. Neither this specification nor a Preview approval authorizes merging that branch wholesale.

## 2. The facility model

### 2.1 One facility, distinct rooms

**FOUNDATION · APPROVED DIRECTION**

CXOS is one spatial facility. A visitor should recognize the same institution across every room without mistaking the rooms for identical skins.

The facility shares:

- the ink ground;
- navy, ocean, brand teal, status amber/red, and verified-success green;
- Plus Jakarta Sans in production;
- tabular numerals for operational values;
- one light source per room;
- three visual planes at most: atmosphere, semantic content, and instrument;
- restrained rule lines, measured depth, and visible focus;
- honest data states and the same information in motion, static, and reduced-motion projections.

Rooms differ by purpose:

- **Mission Control** observes and decides.
- **The Passage** transfers authority between environments.
- **The Arena** recognizes evidenced standing.
- **Agency Command** coordinates a portfolio of client work.
- **Founder Review instrumentation** inspects the experience without becoming part of the product room.

### 2.2 One protagonist per viewport

**FOUNDATION**

Every viewport has one focal object. Supporting instruments may flank it, but may not compete with it.

- In Mission Control, the command threshold is the protagonist.
- In the Passage, the destination aperture is the protagonist.
- At Arena arrival, the room’s recognition register is the protagonist.
- In Agency Command, Kai’s Executive Morning Brief and its single ranked action are the protagonist.

If two headlines, controls, charts, or illuminated surfaces demand equal attention, the composition has failed.

### 2.3 Architecture before containers

**APPROVED DIRECTION**

Rooms are built from axes, banks, rails, ledgers, thresholds, planes, and stations. They are not assembled from an equal grid of rounded cards.

Cards are permitted only when the card itself is the interaction. Data that belongs to one room should usually share one architectural surface with dividers and hierarchy rather than repeat the same elevated container.

### 2.4 Spatial vocabulary and composition

**FOUNDATION · APPROVED DIRECTION**

- **Room** — a complete operating environment with one purpose, one protagonist, and one settled truth.
- **Chamber** — the bounded architectural volume that gives a room its authority and light logic.
- **Floor** — the native-scroll document plane through which the operator inspects stations.
- **Threshold** — an explicit boundary where authority, state, or environment changes.
- **Station** — one semantic stop on a floor, responsible for one class of evidence or operation.
- **Console** — a contained interactive instrument with a truthful control, state, and destination; never a decorative card.
- **Horizon** — the stable depth or capacity reference that orients the room without becoming a fake live chart.
- **Axis** — the directional line that connects the protagonist, supporting instruments, and any threshold.

Composition laws:

1. Prefer meaningful asymmetry to equal-card grids.
2. Embed content in the environment through shared planes, ledgers, banks, stations, and consoles.
3. Preserve meaningful negative space around the protagonist; empty space must clarify authority, travel, or hierarchy.
4. Make the operational center of gravity visible at every viewport.
5. A chamber, floor, horizon, and axis may simplify responsively, but their semantic relationship must remain legible.

### 2.5 Information architecture

**FOUNDATION · APPROVED DIRECTION**

Every operating room distinguishes:

1. **Primary operational truth** — the dominant verified fact or condition that answers what is happening now.
2. **Secondary instrumentation** — supporting measures that explain the primary truth without competing with it.
3. **Evidence** — the source, receipt, ledger entry, or deterministic input that supports a claim.
4. **Status** — the current state expressed in text and structure, never color alone.
5. **Action** — one explicit, permission-valid control with a truthful destination and outcome.
6. **Observation** — a bounded interpretation of existing evidence, kept visually distinct from canonical fact.
7. **Explanation** — why the state exists, using disclosed drivers rather than invented causality.
8. **Escalation** — an issue requiring additional authority or attention, with its reason, owner or destination, and safe next step.

Primary truth and action define the center of gravity. Evidence and status substantiate it. Secondary instrumentation, observation, explanation, and escalation remain subordinate and may never manufacture urgency.

### 2.6 Observable operational heartbeat

**APPROVED DIRECTION · PROPOSED PHASE 6.1 APPLICATION**

> Every operating room must possess an observable operational heartbeat. Motion, rhythm, and ambient state must express that room’s actual purpose without changing canonical facts or fabricating live activity.

An operational heartbeat is purpose-bound information behavior, not decorative motion and not fake telemetry. It may express fixed states such as entering, advancing, waiting, blocking, resolving, capacity consumption, evidence coverage, or decision pressure only when the room can name the deterministic fact or specimen behind the expression.

- Agency Command applies this law through deterministic client-flow positions, capacity horizons, workload pressure, response-aging markers, evidence coverage, disclosed bottlenecks, and explicitly non-persistent Kai delegation.
- Mission Control will later apply the law to system readiness, evidence availability, and decision pressure under a separately reviewed assignment. Phase 6.1 does not modify Mission Control.
- Every future operating room must name its own purpose-bound heartbeat, its canonical facts, its maximum continuous-motion channels, and its complete static equivalent before implementation.
- A heartbeat never changes a metric, rank, label, record, deadline, assignment, or outcome merely to appear alive.

## 3. Room matrix

| Surface | Status | Operational purpose | Spatial grammar | Light and color | Primary information | Forbidden reading |
|---|---|---|---|---|---|---|
| Public Arrival | FOUNDATION | Introduce the product and establish trust | Full-bleed composition; one headline or product frame | Aurora at its brightest approved amplitude; ink ground | Product promise, evidence, next action | Generic SaaS hero or decorative feature grid |
| Mission Control | APPROVED DIRECTION | Observe the current case and transfer command | Rectilinear command chamber; asymmetric instrument banks; central axis and threshold | Analytical blue/teal; light from above | Execution, systems, Kai brief, clearance, one next action | Dashboard-card mosaic |
| The Passage | APPROVED DIRECTION | Move from Mission Control to the Arena | Converging hallway; distant aperture; rectilinear-to-radial conversion | Cool origin; late ceremonial warmth; no early destination grant | Power-down, clearance, anticipation, conversion, threshold | Black interruption, reticle-only tunnel, or loading screen |
| The Arena | APPROVED DIRECTION | Recognize evidenced standing and let the operator walk the record | Inhabited ceremonial chamber; arrival monument; station-by-station floor | Warm metal-like neutrals and restrained amber; light from below | Standing, evidence, milestones, planned threshold, Kai observation | Casino, game lobby, title screen followed by cards |
| Agency Command | PROPOSED EXTENSION | Coordinate work across a client portfolio | Wide command wall; health and capacity banks; central Kai brief and delegation console; purpose-bound heartbeat field; ranked work ledger; portfolio ledger | Mission Control’s analytical family, widened in scale; no Arena gold language | Agency health drivers, client flow, workload, evidence coverage, portfolio priorities, capacity, and Kai delegation | Generic executive dashboard, chart wall, fake live feed, or AI-copilot chat |
| Founder Review Control | APPROVED REVIEW PATTERN | Inspect projections, fixture states, timing, and safety behavior | One collapsed Director pill opening a contained bottom sheet | Neutral technical instrument outside room hierarchy | Projection, reason, tier, fixture, replay/jump controls | Product navigation, hidden override, or fake modal |

## 4. Mission Control laws

**APPROVED DIRECTION**

1. Mission Control is a room, not a dashboard.
2. The room uses an asymmetric command-axis composition with instrument banks flanking one threshold.
3. The Arena call is part of the architecture and is the lone protagonist when available.
4. Outside the gate, the call is absent. There is no teaser, upsell, locked-door promise, or implied purchase path.
5. Synthetic facts remain visibly labeled and may not resemble live customer data.
6. Technical clearance detail belongs in Founder review instrumentation, not in ceremonial copy.
7. The room visibly acknowledges departure: instruments recede and the command axis contracts before the origin disappears.
8. Proceed controls are at least 44 px and remain truthful in static projection.
9. Operational rooms may use a brief nonblocking Settle + Focus threshold. They may not add another long cinematic entrance that competes with the approved Passage.

## 5. Passage laws

**APPROVED DIRECTION**

### 5.1 Origin and power-down

- The origin remains legible while it powers down.
- Departure may dim, quiet, and contract the room; it may not replace it with an unexplained black screen.
- Cancellation before commitment returns to the visible origin.
- Skip behavior must name the truth: early input cancels; later input settles forward.

### 5.2 Hallway and anticipation

- The Passage is filled architectural depth, not a thin reticle or crosshair.
- Cool rectilinear planes converge toward a distant aperture.
- Destination warmth appears late. The destination is anticipated before it is granted.
- No explanatory HUD, marketing slogan, or data panel competes with the corridor.

### 5.3 Conversion and threshold

- Blue rectilinear geometry converts into the Arena’s radial ceremonial language.
- The last Passage frame and the first settled Arena frame must share geometry, scale, light direction, and focal position.
- Threshold copy is minimal. The monument, aperture, or title holds the frame.
- The semantic destination already exists beneath the cinematic layer.

### 5.4 Settlement and return

- Forward settlement reveals the correct environment in one deterministic state change.
- Focus moves to the visible destination heading before the overlay unmounts.
- Static forward movement scrolls to the real document destination; it may not focus off-screen content.
- Return restores Mission Control focus, scroll position, inert state, timers, and the settled origin.
- Native scroll remains authoritative on room floors. No scroll lock, momentum hijack, or desktop section snapping.

## 6. Arena laws

**APPROVED DIRECTION**

1. The Arena is one inhabited ceremonial room.
2. Station A is a full-viewport arrival ceremony with reserved final geometry.
3. Recognition states clearance, standing, evidence, lifetime record, and Kai truth in normal document flow.
4. Data-read failure announces fail-safe or unavailable truth; it may not announce successful standing.
5. Evidence is an engraved ledger, not a stack of decorative cards.
6. Milestones read as earned seals, not pills, loot, or badges of scarcity.
7. Stations II–V each hold one semantic purpose.
8. Native scroll is the operator’s movement mechanism.
9. Viewport-bound atmosphere may unify the room, but never reduce text readability.
10. Competition remains visibly planned until real policy and data exist. No countdown, scarcity, jackpot, or simulated contest.
11. The recognition plinth reserves its final space before reveal; arrival may not shift the mobile viewport.
12. Reduced motion receives the complete settled ceremony, not a shortened or lesser document.

## 7. Agency Command laws

**PROPOSED EXTENSION**

Use **Agency Command** as the concise in-room label for the current Founder candidate. **Agency Command Center** remains acceptable as the formal Phase 6 program and artifact title. Neither term is globally deprecated without separate naming ratification.

### 7.1 Command hierarchy

The first screen follows this order:

1. room identity, agency scope, and synthetic disclosure;
2. Kai Executive Morning Brief with one ranked action and one receipt;
3. Agency Health as a qualitative band with disclosed drivers;
4. ranked cross-client work queue;
5. client portfolio ledger;
6. capacity and team/load truth.

Desktop may place health and capacity in narrow banks around the Kai brief, but the command wall remains one continuous composition.

### 7.2 Agency Health

- Use `HEALTHY`, `WATCH`, or `AT RISK` until a deterministic numeric formula is separately ratified.
- Always disclose the drivers: response-window attention, oldest queue age, capacity, and source coverage.
- Missing inputs are excluded and disclosed, never guessed.
- A numeric `0–100` specimen requires a permanent `SYNTHETIC SCORE SPECIMEN` label and does not establish production policy.
- Green is reserved for verified positive state, not general decoration.

### 7.3 Kai Executive Morning Brief

- Two short sentences maximum.
- One ranked next action.
- One visible receipt naming the deterministic synthetic inputs.
- No chatbot frame, avatar, mascot, or multiple competing recommendations in the brief.
- The brief must answer: what changed, what needs attention, and what should happen next.
- A separate bounded Kai operating console may demonstrate deterministic route-instance workflows after the brief. It is an executive instrument, not a chat surface.
- Notes, reminders, schedule outlines, summaries, task preparation, bottleneck interpretation, follow-up planning, organization, meeting preparation, explanation, and suggested actions remain visibly synthetic, non-persistent, and operator-reviewed.
- A fixture-only note field must warn against real customer information and may not have a form, name, network destination, storage destination, or production action.
- Every prepared output ends with a truthful no-action receipt naming what was not saved, sent, scheduled, assigned, or changed.

### 7.4 Portfolio and client work

- The priority queue is a ranked ledger, preferably an ordered list.
- Each row exposes rank, client, queue type, reason, age or deadline, assignment truth, and one action.
- Row inspection expands inline; review controls must not navigate into a real client workspace.
- The portfolio ledger uses truthful current concepts: client identity label, work state, item count, letter count, latest round, elapsed days, due date, and attention state.
- Proposed pipeline, revenue, assignment, or automation data must carry a specimen label until implemented.

### 7.5 Team and load

- The default Solo Agency projection shows Team Load as unavailable and states that no assignment data is being simulated.
- Team values appear only after an explicit `Team Specimen` Founder projection.
- The Team Specimen carries a second permanent disclosure and has no “Manage team” or other fake destination.
- A synthetic team projection is design evidence, not proof that Team foundation or staff seats are live.

### 7.6 Minimum arrival threshold

- Tier A: one nonblocking sequence lasting at most 1.5 seconds: review identity → fixture systems → capacity horizon → ledger activation → Kai focus → settled heartbeat.
- Tier B: one single-plane sequence lasting at most 700 ms.
- Returning to Mission Control: a 360–480 ms acknowledgment and departure handoff, followed by ordinary review-route navigation.
- Tier C/D and reduced/static: zero motion; the final room is immediately present.
- Semantic content paints before the settle and remains interactive.
- Any key, tap, click, scroll, or Escape completes the settle in under 100 ms.
- The route writes no first-entry marker. Founder review may replay from the Director.

### 7.7 Living Agency Command instruments

- Client flow is a rail of fixed work positions, not a live feed.
- Capacity is a horizon with explicit occupied and reserve positions, not an animated counter.
- Workload is a pressure field derived from disclosed fixture composition, not a worker score or performance ranking.
- Response aging is an illustrative ruler and remains explicitly not a legal deadline.
- Evidence coverage preserves each source state; it may not collapse unlike states into a misleading percentage.
- Bottlenecks name the waiting decision or missing evidence and the safe review step.
- Throughput may be shown only when a time-bounded source model exists. Phase 6.1 states `Not instrumented` rather than inferring a rate from queue rank.
- Motion may replay the fixed semantics of entering, advancing, waiting, blocked, and resolving while every displayed value remains unchanged.

## 8. Visual language

### 8.1 Hierarchy roles

**FOUNDATION · APPROVED DIRECTION**

- **Typography and scale:** room identity is the largest voice; primary operational truth follows; action, status, evidence, observation, explanation, and metadata descend in that order. Size may not make secondary instrumentation compete with the protagonist.
- **Restrained cyan operational language:** use the approved brand blue/teal token family for intelligence, active systems, focus, and action. “Cyan” names the operational role; it does not authorize a new raw color.
- **Ceremonial gold recognition language:** use restrained existing amber and metal-like neutral tokens only for evidenced recognition in the Arena. “Gold” names the ceremonial role; it does not authorize a new palette or decorate Agency Command.
- **Status and warning:** verified-success green is reserved for verified positive state; amber and red communicate honest attention or risk with adjacent text.
- **Opacity:** lower opacity denotes atmosphere or subordinate instrumentation, never missing, disabled, or uncertain truth by itself.
- **Line systems:** rules, rails, rings, and traces express ownership, sequence, connection, or boundary; decorative line noise is forbidden.
- **Geometric framing:** rectilinear operational frames and radial recognition frames must follow room purpose and transition coherently at thresholds.
- **Atmospheric depth:** background depth or weather remains behind semantic content, bounded in amplitude, and nonessential to comprehension.

### 8.2 Typography

**FOUNDATION**

- Production uses Plus Jakarta Sans.
- Display voice is reserved for room identity and major scene titles.
- Operator voice is dense, calm, and readable.
- Money, dates, scores, XP, counts, durations, and capacity use tabular numerals.
- Monospace is limited to instruments, receipts, and technical review detail.
- Essential body copy may not be reduced into decorative microtype.

### 8.3 Color

**FOUNDATION**

- Ink is ground and calm.
- Ocean is depth and process.
- Brand blue/teal is intelligence and action.
- Success green means verified positive state only.
- Amber and red communicate honest warning, never drama.
- Arena warmth uses restrained existing amber and metal-like neutrals; it does not establish a new brand hue.
- Page implementations use canonical tokens rather than inventing per-room palettes.

### 8.4 Composition, depth, and lighting

**FOUNDATION · APPROVED DIRECTION**

- Maximum three planes: atmosphere, semantic content, instrument.
- Text does not float.
- Only interactive instruments may elevate, and elevation is restrained.
- Every room has one directional light logic.
- Mission Control and Agency Command receive analytical light from above.
- Arena light rises from below.
- Atmosphere is weather, not decoration. It stays behind text and remains `pointer-events: none`.
- Persistent atmosphere must not cause text contrast to fluctuate below the required threshold.

### 8.5 Data presentation

- Prefer ledgers, ordered queues, definition lists, and architectural banks.
- Use charts only when a chart answers a specific operational question better than text.
- Do not use decorative donuts, animated counters, or unlabelled sparklines.
- Status is expressed with text and structure, not color alone.
- Long names wrap. Deadlines, warnings, and primary actions do not truncate.

## 9. Motion language

**FOUNDATION · APPROVED DIRECTION**

Motion semantics:

1. **State motion** represents a truthful power, focus, availability, or room-state change.
2. **Ambient motion** represents bounded system presence; it never implies changing data, team presence, or live activity.
3. **Transition motion** represents spatial travel between an identified origin and destination.
4. **Recognition motion** reveals existing evidence or status; it never changes the canonical fact being recognized.
5. Decorative spectacle, false live-data behavior, and animation that changes canonical facts are forbidden.

All motion is composed from:

| Primitive | Meaning | Default duration |
|---|---|---:|
| Settle | An object takes its place | 400 ms |
| Reveal | Content earns visibility | 600 ms |
| Draw | Evidence or a connection is traced | 1.8 s |
| Drift | Atmosphere breathes | 18 s or slower |
| Shine | An interactive machined surface responds | Hover/focus only |
| Focus | Attention transfers between planes | 350 ms |

Motion laws:

1. Use the house vector ease.
2. Content motion is transform/opacity only.
3. Layout is never animated.
4. Ambient channels are bounded; Phase 5.3 establishes no more than three transform/opacity channels per environment. Phase 6.1 uses one room breath, one operational sweep, and one client-flow state channel.
5. Ambient motion pauses while the document is hidden.
6. No object moves toward the cursor.
7. No zoom-through, dolly zoom, autoplay audio, Canvas loop, WebGL, or runtime JavaScript animation loop.
8. Every sequence has a deterministic final-frame safety path.
9. User input outranks choreography.
10. Reduced motion removes motion, not meaning.
11. Purpose-bound heartbeat motion must carry a permanent synthetic or source disclosure whenever it could otherwise resemble live activity.

## 10. Transition language

**FOUNDATION · APPROVED DIRECTION**

The complete transition language is:

1. **Acknowledgment** — confirm the explicit initiating action without implying a write or outcome that did not occur.
2. **Departure** — recede the origin while preserving orientation.
3. **Travel** — establish legible depth and movement through one facility.
4. **Anticipation** — withhold destination authority until the appropriate beat.
5. **Conversion** — transform the origin geometry into the destination grammar.
6. **Threshold** — make the boundary and destination undeniable.
7. **Arrival** — settle into the same geometry and semantic destination already present beneath the cinematic layer.
8. **Operation** — return control to the complete native document without residual lock, timer, or cinematic state.
9. **Return** — restore the origin’s focus, scroll, inert state, timers, and settled truth deterministically.

- Within a page, use only the named motion primitives.
- Ordinary product, auth, billing, legal, support, settings, admin, and error navigation is immediate or a short nonblocking settle.
- A long-form Passage is a named, separately commissioned transition object, not a general route effect.
- A transition never hides an error, blocks a payment action, delays an urgent control, or mutates data.
- The origin and destination each have one settled truth.
- Route and room transitions preserve focus, scroll, inert state, and input priority.
- The semantic document exists without the cinematic layer.
- No-JS, reduced-motion, constrained, and static projections must remain complete and navigable.

## 11. Data-truth language

**FOUNDATION · APPROVED DIRECTION**

1. Repository facts are authoritative; status claims must be evidence-backed.
2. Synthetic review surfaces carry the visible label `SYNTHETIC REVIEW · NO LIVE DATA`.
3. Assistive technology receives the complete disclosure: no real account, database, customer record, reputation read, or reputation write.
4. Fixtures are deterministic, internally possible, compliance-safe, and unrelated to real people.
5. No review control writes storage, cookies, APIs, telemetry, reputation, or database state unless separately disclosed and authorized.
6. Kai may interpret deterministic truth; it may not invent counts, deadlines, health, outcomes, or confidence.
7. Every claim can name its source or receipt.
8. Fake live metrics, popularity ratings, decorative rankings, and invented operational outcomes are forbidden.
9. Empty means no evidence, not failure.
10. Unavailable means the source or capability is absent; it may not silently become zero.
11. Error copy states what failed, what remains known, and the safe next action.
12. Permission-denied states expose no tenant identity, counts, or existence oracle.
13. Capacity gates only the action that exceeds capacity; existing work remains accessible.
14. Proposed capabilities such as numeric Agency Health, Team Load, pipeline stages, revenue, and automation carry explicit specimen treatment until implemented.
15. Outcome language remains educational and evidence-bound. No guaranteed deletion, score, or credit-repair outcome.

## 12. Interaction-state language

**PROPOSED EXTENSION · RELEASE GATE**

Interaction laws:

1. Actions are explicit about their destination and supported effect; decorative action labels and dead controls are forbidden.
2. Controls expose truthful availability, pressed, loading, disabled, unavailable, error, and success states.
3. A non-modal surface may not make a false modal claim.
4. No interaction performs a hidden state mutation, storage write, network write, or data mutation.
5. Keyboard operation is complete and follows the same semantic order as touch and pointer operation.
6. Focus continuity is preserved through open, close, departure, arrival, projection change, and return.
7. **Deterministic return** is required: the established focus target, native scroll position, inert state, and settled room state are restored.
8. Native scroll remains authoritative; scroll hijacking and section snapping are forbidden.
9. No user trap is permitted. Cancel, skip, Escape, and safe return remain available wherever choreography could otherwise delay control.

Every new room must specify at least:

| State | What the visitor sees |
|---|---|
| Populated | Full hierarchy, deterministic values, and one primary action |
| Empty | A briefing: what belongs here, what evidence creates it, and one next action |
| Loading | A skeleton matching final geometry plus truthful status; no fake progress |
| Unavailable | The absent source or capability named explicitly; no guessed replacement |
| Error | What failed, what remains safe or known, and one recovery action |
| Permission denied | Minimal tenant-safe refusal with no protected metadata |
| Capacity reached | Existing work preserved; only the exceeding action unavailable |

Partial-source failure should preserve valid surfaces and locate the error at the failed source. A global blank wall is a last resort.

## 13. Accessibility laws

**FOUNDATION · APPROVED DIRECTION · RELEASE GATE**

- WCAG 2.2 AA is the target across every scene.
- A visible skip-navigation link moves directly to the main landmark.
- One `<main>` and one `<h1>` identify the room.
- Headings, sections, lists, tables, and definition lists reflect the visual hierarchy.
- The cinematic world is decorative and `aria-hidden`; the semantic document remains in DOM order.
- Live-region restraint is mandatory: one polite live-status region announces projection, journey, and fixture changes without duplication.
- Errors use alert semantics only when immediate announcement is appropriate.
- Focus is visible and never lost to `body`.
- Destination focus moves before an overlay unmounts.
- Director close returns focus to the Director pill.
- A non-modal review instrument may not claim `aria-modal`.
- Controls are at least 44 px on touch/coarse contexts.
- Hover is enhancement; keyboard and touch receive complete behavior.
- State and pressed status are never communicated by color alone.
- Text and essential controls maintain readable WCAG contrast across every atmospheric and interaction state.
- Reduced motion has information parity.
- The complete static alternative preserves every fact, action, disclosure, and destination.
- Focus order follows visual order at every viewport.
- Manual screen-reader, switch-control, and voice-control review remains prudent before production integration; automated Axe results are necessary but not certification.

## 14. Responsive and capability laws

**FOUNDATION · APPROVED DIRECTION**

| Projection | Typical context | Experience |
|---|---|---|
| Tier A | Desktop/tablet with capable conditions | Full approved cinematic depth |
| Tier B | Mobile or coarse pointer | Single-plane cinema, shorter pacing, no pinned stages |
| Tier C | Data Saver, low memory, failed detection, or conservative capability | Complete bounded/static experience |
| Tier D | Explicit static or reduced-motion final frame | Complete document with no cinematic motion |

Rules:

- Mobile is designed intentionally, not produced by stacking desktop cards.
- Mobile reorders content by urgency: identity, Kai brief, disclosed heartbeat and Kai delegation, priority, health/capacity, full ledger, secondary context.
- Preserve the approved typographic voice and hierarchy at every tier; adapt scale without reducing essential content to microtype.
- No pinned stage or parallax on mobile.
- Use stable viewport units and safe-area-aware fixed review controls.
- No horizontal overflow at portrait or coarse-pointer landscape widths.
- Long content wraps without hiding deadlines or actions.
- Reserved geometry prevents arrival and state-change CLS.
- A genuine reduced-motion preference is honored automatically.
- A Founder may explicitly preview Cinematic after a truthful warning, but the override exists only for that review route instance.
- Data Saver, low-memory safety, and failed capability detection are never overridden.

## 15. Founder review-control laws

**APPROVED REVIEW PATTERN**

1. Review controls exist only in review builds and are hard-off in production.
2. The collapsed Director pill is safe-area-aware and available on every reviewed viewport.
3. The Director sheet has bounded height, its own scroll, and overscroll containment.
4. Escape closes the Director before any room or journey Escape behavior.
5. Closing returns focus to the pill.
6. Projection controls expose `aria-pressed` and a non-color active marker.
7. Projection choice and fixture state are separate fieldsets.
8. Auto explains the detected tier and reason.
9. Cinematic override of reduced motion requires explicit confirmation and states that the system setting will not change.
10. Static means the complete document at rest.
11. Projection changes clear timers and settle focus, scroll, inert state, pause state, and environment to one truth.
12. Projection controls may lock during an active journey, with a visible reason.
13. Fixture controls change only local synthetic state.
14. Review instruments must not send data, mutate live systems, or expose credentials.

## 16. Performance laws

**FOUNDATION · APPROVED DIRECTION · RELEASE GATE**

- Marketing LCP target: 1.8 s; hard budget: 2.5 s at mobile P75.
- INP budget: below 200 ms.
- Skip/settle input response: below 100 ms.
- General CLS budget: below 0.1; CXOS arrival, projection, and room-swap target: 0.
- Cinematic assets above the fold: at most 300 kB.
- Cinematic JavaScript remains progressive and post-content.
- Motion is CSS/compositor-first and uses transform/opacity rather than layout animation.
- No new runtime dependency is justified for effects already covered by CSS or platform APIs.
- No autoplay video, audio, WebGL, Three.js, GSAP, Rive, or Lottie is part of the core language unless separately approved.
- No video dependency, Canvas animation loop, continuous expensive JavaScript loop, or runtime asset spectacle.
- No sustained application-attributable long task is acceptable in a settled ambient state; repeated tasks above 50 ms during a transition are a release blocker.
- Long tasks are measured and reported honestly. A clean functional result does not erase a performance caveat.
- QA uses an optimized build and includes a mid-tier mobile/coarse context.
- Ambient effects are compositor-friendly, bounded, and absent in static/reduced projections.
- The page remains readable and usable if every enhancement fails.

## 17. Anti-patterns

Reject:

1. equal grids of rounded information cards;
2. a title screen followed by unrelated widgets;
3. generic “clean modern dashboard” styling;
4. purple/indigo gradient SaaS language;
5. glow on every border and control;
6. icons in decorative colored circles;
7. centered-everything composition;
8. decorative blobs used to fill empty space;
9. faux terminal microtype for essential content;
10. chart walls, decorative donuts, and animated counters;
11. Kai rendered as a chat widget or mascot inside operational rooms;
12. synthetic metrics presented without a permanent disclosure;
13. team, revenue, pipeline, automation, or outcome data implied to be live;
14. Arena gamification, scarcity, countdown, casino, or jackpot language;
15. Mission Control or Agency Command reduced to a dashboard mosaic;
16. black-screen interruption used as a substitute for a Passage;
17. scroll-jacking, section snapping, cursor-following motion, or zoom-through;
18. hover-only actions or color-only status;
19. placeholder-only form labels;
20. false modal semantics;
21. hidden review overrides, stored motion consent, or nonessential write requests;
22. claiming zero errors, zero long tasks, certification, or production readiness without current evidence.

## 18. Release gates

**RELEASE GATE**

### 18.1 Scope and truth

- Exact reviewed commit range and file allowlist recorded.
- Every proposed/specimen capability visibly labeled.
- No secrets, local paths, usernames, tokens, environment values, or private evidence directories in public artifacts.
- No unrelated agent infrastructure or untracked material included.
- Preview approval stated as experience approval, not production integration approval.

### 18.2 Static validation

- Typecheck passes.
- Touched-file lint passes.
- `git diff --check` passes.
- CXOS grammar and room-specific guards pass.
- Optimized production-mode review build passes without database mutation.
- Package manifests and lockfiles remain unchanged unless separately authorized.

### 18.3 Experience matrix

- Desktop Tier A.
- Tablet Tier A.
- Portrait mobile Tier B.
- Coarse-pointer landscape Tier B.
- Reduced Motion / Static.
- Data Saver/low-memory/failed-detection fail-closed behavior.
- Populated, empty, loading, unavailable, error, permission, and capacity states.
- Natural forward, early cancel, later skip, return, replay, projection changes, and preference flips.

### 18.4 Accessibility

- Axe automated scan reports no blocking violations in the agreed matrix.
- Keyboard traversal, focus transfer, Escape ordering, and focus return verified.
- Proceed, Director, and primary touch controls meet the 44 px target.
- No overflow, off-screen focused destination, false modal, or hidden essential content.
- Manual assistive-technology review is either complete or carried as a visible caveat.

### 18.5 Performance and stability

- CLS measured, with a zero target for room swaps and mobile arrival.
- Long-task observations reported with context; no obsolete evidence reused.
- Console, page, and failed-request observations recorded.
- Ambient effects do not reduce text readability.
- Hidden documents pause ambient work.
- No performance claim exceeds the available instrumentation.

### 18.6 Production isolation

- Production baseline and Preview deployment identity remain distinct.
- Production alias, deployment, database, schema, environment, and billing remain untouched unless separately authorized.
- A historical feature branch is never merged wholesale merely because its Preview was approved.
- Approved deltas are extracted or reconstructed against a clean production baseline under a separate integration review.
- Rollback is defined before any future production action.
- Merge and production deployment require a separate explicit Founder authorization.

## 19. Review checklist for a new room

Before a room can be called CXOS:

- [ ] The room has one operational purpose and one protagonist.
- [ ] The room names an observable, purpose-bound operational heartbeat and its complete static equivalent.
- [ ] Its spatial grammar differs by purpose without breaking facility continuity.
- [ ] Its light source and palette roles are explicit.
- [ ] It uses architecture before containers.
- [ ] Data sources, empty states, unavailable states, and errors are truthful.
- [ ] Synthetic fixtures cannot be confused with live capability.
- [ ] Motion uses only approved primitives and has a static final frame.
- [ ] Focus, scroll, inert state, and Escape behavior are specified.
- [ ] Desktop, tablet, mobile, coarse, and reduced projections are intentional.
- [ ] Controls are keyboard-, touch-, and screen-reader-complete.
- [ ] Performance budgets and evidence are current.
- [ ] Review controls are isolated and non-mutating.
- [ ] The exact patch can be integrated without a wholesale historical merge.
- [ ] Founder experience approval and production authorization remain separate decisions.

## 20. Change control

Language 1.0 is a working specification. A future revision should:

1. identify the law being amended;
2. name the source of the change;
3. distinguish approved direction from proposal;
4. preserve backward truth for already reviewed rooms;
5. update the room matrix, anti-patterns, and release gates when the change affects them;
6. receive the appropriate design, engineering, compliance, accessibility, performance, and Founder review before production use.

**Current terminal status:** LANGUAGE 1.0 WORKING SPECIFICATION — NOT PRODUCTION APPROVAL
