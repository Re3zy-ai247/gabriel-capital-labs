# CXOS Living Environment Engine RC1 — implementation plan

Status: **IMPLEMENTED · VALIDATION IN PROGRESS**
Date: 2026-08-01
Decision owner: Founder
Candidate branch: `feat/cxos-living-environment-engine-rc1`
Exact baseline: `29260fddfc59d71e3d963d2ec791657ea57084af`
Production source at reconstruction: `f449c35d0eca9463c15e86f8cbd4cd7f4e948d03`

## 1. Goal and success condition

Extend the accepted CXOS Core Runtime into a reusable, presentation-only Living
Environment Engine and apply it to all seven Agency Headquarters chambers. The
reference experience must feel like one directed operating facility, not one long
document, while retaining every semantic fact, disclosure, heading, native control,
history destination, static fallback, and production boundary from the approved RC5
baseline.

Success is a protected, exact-commit-bound Founder Preview whose desktop, mobile,
reduced-motion, constrained-device, keyboard, history, lifecycle, and synthetic-truth
behavior is demonstrably complete. This plan does not authorize integration or
production release.

## 2. Founder premises already decided

The assignment is the decision record for these premises:

- Keep the approved seven-chamber operating model.
- Build shared presentation infrastructure, not chamber-local lifecycle systems.
- Agency Headquarters is the mandatory reference consumer.
- Preserve semantic content unless a correction is required.
- Add no dependency, runtime AI, live service, data source, schema, auth, billing,
  Stripe, environment, production alias, or production surface.
- Use native navigation and scrolling; no wheel/touch capture or scroll hijack.
- Motion must communicate state and must fail down to premium static equivalence.
- Commit and push only the isolated review branch, deploy only a protected Preview,
  and stop for Founder review.

No product premise remains open before implementation. Evidence may still force a
HOLD.

## 3. Verified starting point

RC5 already provides:

- a pure policy layer in `lib/cxos/runtime.ts`;
- one browser adapter in `components/cxos/runtime/useCxosRoomRuntime.ts`;
- deterministic Tier A–D projection, reduced-motion fail-down, arrival, departure,
  visibility pause, replay/reset, BFCache handling, latest-intent chamber passage,
  bounded navigation fallback, and focus settlement;
- one active enhanced chamber at a time, with all seven semantic sections preserved
  for SSR, no-JavaScript, invalid-contract, constrained, and static projections;
- route-owned hash/history behavior, native `<details>` inspection, fixed local Kai
  intent resolution, synthetic fixtures, and no-action receipts.

The missing reusable seam is camera composition, chamber lighting/depth profiles,
motion signatures, attention state, deterministic idle settlement, explicit Kai
visual phases, and a closed shared token profile. Current Agency CSS hardcodes most of
that behavior and uses one generic passage language.

### 3.1 Delta matrix

| Assignment capability | RC5 state | RC1 action |
|---|---|---|
| arrival / departure | EXISTS | retain; project the new environment state through them |
| chamber navigation / history / focus | EXISTS | retain byte-for-behavior; add profile projection only |
| Tier A–D / reduced / hidden / BFCache | EXISTS | retain; add idle and explicit attention/Kai resets |
| one primary desktop/mobile chamber | EXISTS | retain; no gesture or wheel capture |
| room camera and reframing | PARTIAL | add closed presets and room-owned CSS rendering |
| chamber lighting and depth | PARTIAL | normalize existing geometry under seven distinct profiles |
| chamber motion signatures | PARTIAL | remove duplicate perpetual motion; enforce measured channel counts |
| inspection attention | MISSING | add an explicit room-owned presentation signal |
| deterministic idle settlement | MISSING | add one bounded, resettable, cleanup-safe timer |
| Kai staged/resolved visual states | MISSING | add explicit room-owned visual phases; no fake preparing delay |
| scroll choreography | PARTIAL | retain native chamber/inspection scroll and permit only bounded decorative CSS timelines |
| reproducible browser/handoff evidence | MISSING | add deterministic, dependency-free release tooling |

The shared checkout and the parallel Growth branch are not sources. Package and lock
files at this baseline are byte-identical to production source; no motion or 3D package
is added.

## 4. Architecture decision

Extend Core Runtime 1.0 in place. Do not create a provider, scene graph, generic room
renderer, canvas, WebGL layer, global event bus, or second lifecycle engine.

```text
room-owned semantic state                 pure shared policy
-------------------------                 ------------------
active chamber id ----------------------> validate profile registry
inspection attention -------------------> project capability tier
Kai visual phase ------------------------> project camera/light/depth
room-owned destinations ----------------> lifecycle + idle policy
                                           |
                                           v
                                  one browser adapter
                                  -------------------
                                  discrete activity events
                                  one bounded idle timer
                                  visibility/BFCache cleanup
                                  no continuous JS loop
                                           |
                                           v
                                  data attributes + CSS vars
                                           |
                                           v
room-owned semantic DOM <----------- Agency room-owned CSS/geometry
facts/copy/actions unchanged          decorative layers are aria-hidden
```

### 4.1 Pure contract

Add a closed, optional `livingEnvironment` definition to the existing room contract:

```ts
interface CxosLivingEnvironmentDefinition<DistrictId extends string> {
  profileId: string;
  idleAfterMs: { A: number; B: number };
  chambers: readonly CxosChamberPresentation<DistrictId>[];
}

interface CxosChamberPresentation<DistrictId extends string> {
  id: DistrictId;
  emotion: CxosEmotionalMode;
  camera: CxosCameraPreset;
  lighting: CxosLightingPreset;
  depth: CxosDepthPreset;
  motion: CxosMotionSignature;
  focus: CxosFocusPreset;
  idle: CxosIdlePreset;
  kai: CxosKaiResponsePreset;
}
```

All preset types are closed enums. Chamber ids and order must exactly match the room
district registry. Timing is integer-bounded. Duplicate or missing profiles, unknown
tokens, invalid timing, or a mismatched chamber registry fail the whole enhanced
projection to Tier D; the complete semantic document remains available.

The pure resolver accepts explicit, room-owned presentation signals:

- attention: `ambient | reading | inspecting`;
- Kai: `quiet | staged | preparing | resolved`;
- lifecycle: existing arrival, operating, passage, hidden, and departure state;
- idle: adapter-owned `engaged | settling | settled` presentation state.

Kai state is never inferred from command language inside the engine. Agency supplies a
visual phase derived from its existing deterministic route state. The `preparing` phase
exists for truthful future async computation but Agency does not invent a delay to use
it.

### 4.2 Browser adapter

The existing adapter remains the only lifecycle owner. It adds:

- root-scoped discrete pointer, keyboard, focus, and inspection activity handling;
- one resettable timeout, with integer duration from the validated token profile;
- immediate settled/static behavior for Tier C, Tier D, reduced motion, hidden
  documents, invalid contracts, and passage;
- immediate quiet/settled projection while inspecting or while Kai has focused presence,
  with the idle timer cleared and re-armed only after the room returns to ambient;
- deterministic reset on replay, route reset, pagehide, BFCache restoration,
  projection change, and active-chamber change;
- current presentation attributes for room CSS.

There is no interval, global pointer tracking, uncontrolled requestAnimationFrame,
continuous measurement loop, persistence, network, randomness, or wall-clock value
exposed as business truth.

### 4.3 CSS rendering boundary

The engine projects only state attributes and bounded CSS custom properties. Agency
continues to own visual geometry. Continuous capable-tier motion stays inside the
existing one-to-three channel budget and uses transform/opacity. Any bounded filter or
clip-path use must be measured and must have an equivalent final frame.

Optional scroll choreography is CSS-only on `aria-hidden` environmental layers behind
`@supports (animation-timeline: scroll())`. Native scroll remains authoritative; the
fallback is the complete static composition. No semantic value, control, disclosure,
or focus target participates in the scroll timeline.

## 5. Cinematic experience bible

### 5.1 Platform directing philosophy

Motion communicates acquisition, flow, diagnostic attention, provenance, constrained
capacity, or presentation readiness. It is finite where possible. Ambient activity
settles to zero sustained work after the bounded idle window. The camera is simulated
with framing, transform, depth separation, clipping, light fields, and hierarchy; it is
never a literal camera and never compromises text.

Three planes are the maximum: foreground threshold, middle-ground instruments, and
background environment. Camera displacement is bounded and never becomes zoom-through,
cursor-following, or meaning-bearing motion. Source light always has an architectural
reason. Truth disclosures remain outside blur, dimming, and decorative animation.

### 5.2 Shared motion and environmental tokens

| Token family | Tier A | Tier B | Tier C | Tier D |
|---|---:|---:|---:|---:|
| arrival | 1500 ms | 700 ms | 0 | 0 |
| chamber passage | 620 ms | 460 ms | 0 | 0 |
| camera settle | 520 ms | 340 ms | 0 | 0 |
| focus acquire | 260 ms | 180 ms | 0 | 0 |
| finite heartbeat | 2400 ms | 3200 ms | none | none |
| idle threshold | 6000 ms | 4500 ms | immediate | immediate |
| idle settle | 400 ms | 300 ms | 0 | 0 |
| near/mid/far offsets | 8 / 4 / 2 px max | 4 / 2 / 0 px max | 0 | 0 |
| camera scale | 1.000–1.018 | 1.000–1.008 | 1.000 | 1.000 |
| environmental blur | 0–6 px decorative only | 0–3 px | 0 | 0 |
| light intensity | 0.30–0.82 decorative | 0.24–0.62 | static | static |
| running environmental animations | ≤2, active chamber only | ≤1, active chamber only | 0 | 0 |
| sustained animations after idle | 0 | 0 | 0 | 0 |

Approved curves are closed tokens: `establish`, `acquire`, `passage`, `settle`, and
`linear-signal`. No chamber declares a raw easing or duration.

The route adds no dependency. Target incremental budgets are ≤15 KiB gzip of client
JavaScript and ≤24 KiB raw route CSS relative to RC5; measured deltas replace estimates
in the validation report. Any larger increase requires simplification before Preview.

### 5.3 Seven-chamber shot bible

| Chamber | Establishing / operator POV | Camera / depth | Light | Meaningful movement | Attention, idle, departure |
|---|---|---|---|---|---|
| Central Command | Wide command-deck reveal; operator centered at a slightly elevated command rail | 30–34 mm feel, high-neutral height, long horizon, priority instrument in middle ground | cool overhead aperture with a restrained cyan focus field | grid calibration and one converging priority signal | focus narrows on the priority brief; heartbeat finishes then settles; deck recedes symmetrically |
| Client Operations Floor | Lateral runway view from working height | 40 mm feel, long horizontal lanes, foreground queue threshold | directional rail light with amber interruption at a disclosed block | packets advance only at fixed fixture positions; waiting holds; blocked lane interrupts rhythm | inspection slows the floor; idle freezes packets in honest positions; departure clears laterally |
| Team Operations Room | Deliberate relational tableau; solo operator occupies one intentional position | 50 mm feel, eye-level, radial middle ground, absent connections remain absent | soft perimeter presence light with an unlit coverage horizon | finite coverage sweep and role-position acquisition, never fake people | inspection expands coverage geometry; solo idle remains quiet rather than empty; departure contracts to the occupied role |
| Business Health Observatory | Diagnostic observatory facing an instrument horizon | 55–65 mm feel, eye-level, concentric depth | controlled amber WATCH source with unlit missing-input instruments | one finite diagnostic sweep and slow qualitative breathing while engaged | focus isolates disclosed drivers; idle holds the reading; departure closes the aperture without implying a score |
| Activity and Evidence Archive | Secure archive aisle with layered evidence trays | 45–55 mm feel, slightly low, deep z-order without 3D rendering | narrow provenance light from inspected source categories | trays align, provenance traces once, inspected receipts illuminate | inspection brings one layer forward; missing records stay visibly absent; departure reseals layers |
| Kai Executive Suite | Calm executive close environment; operator and intelligence share a restrained focal field | 70–85 mm feel, eye-level, shallow apparent depth on decorative layers only | warm-neutral focused pool; surrounding activity dims but disclosures do not | staged state converges, resolved state releases one measured response wave | background quiets during focus; idle becomes still; departure widens and restores facility context; no consciousness implication |
| Growth / Capacity Threshold | Wide horizon chamber looking toward occupied and dormant reserve | 28–35 mm feel, low-neutral height, long future horizon | cool horizon with occupied cells lit and reserve dormant | occupied cells establish once; constraint architecture forms at the disclosed limit | inspection expands the horizon without offering purchase; idle holds reserve dark; departure returns toward Mission Control |

### 5.4 Transition grammar

Passage follows five finite beats: release source, cross threshold, identify destination,
acquire destination, settle focus. Forward and backward travel have directional geometry
but equal authority and duration. Direct selection uses the same grammar; latest intent
wins. Static and constrained tiers replace immediately, focus after layout, and announce
only the acquired chamber. No auto-advance exists.

### 5.5 Kai presence grammar

- `quiet`: contextual availability without attention capture;
- `staged`: focus field converges because the operator staged a fixed local command;
- `preparing`: only for a truthful in-progress operation; unused in this specimen;
- `resolved`: response field releases in deliberate phases, with the existing no-action
  receipt visible;
- hidden, passage, static, or invalid: presentation pauses or becomes static.

Kai may feel attentive; copy and motion may not imply consciousness, live observation,
memory, autonomous work, open-ended model access, or effects.

### 5.6 Mobile and reduced-motion projection

Mobile remains one chamber at a time with compact previous/current/next navigation and a
native expandable facility map. Camera movement becomes single-plane, parallax halves,
finite signatures shorten, controls remain at least 44 px, and no horizontal gesture is
captured. Browser Back/Forward remains the chamber-history mechanism.

Tier D and reduced motion use composition, light, border weight, scale hierarchy, and
static depth—not empty space or disabled-looking panels. All seven chambers remain
reachable, complete, and distinct with zero running environmental animation.

### 5.7 Prohibited effects

No random particles, counters, fake telemetry, fake presence, casino pulse, excessive
glow, autoplay media, sound, vibration, infinite engagement loop, layout animation,
scroll capture, wheel navigation, cursor tracking, uncontrolled RAF, continuous DOM
measurement, canvas, WebGL, 3D package, or runtime asset request.

## 6. File allowlist

Implementation may touch only:

- `lib/cxos/runtime.ts`
- `components/cxos/runtime/useCxosRoomRuntime.ts`
- `app/review/agency-command/environment.ts` (new)
- `app/review/agency-command/stage.tsx`
- `app/review/agency-command/agency-command.module.css`
- `app/review/agency-command/page.tsx`
- `app/review/layout.tsx`
- `app/review/page.tsx`
- `app/review/mission-control/page.tsx`
- `scripts/cxos-core-runtime.test.ts`
- `scripts/cxos-living-environment.test.ts` (new)
- `scripts/cxos-agency-command.test.ts`
- `scripts/cxos-isolated-review.test.ts`
- deterministic browser/handoff scripts under `scripts/cxos-living-environment/` (new)
- `CXOS_FOUNDATION.md`
- `CXOS_LANGUAGE_1_0.md`
- `.ai/ADR/ADR-0040-cxos-core-runtime.md`
- `.ai/DECISIONS.md`
- `.ai/TESTING.md`
- `.ai/CURRENT-STATE.md`
- `.gitignore` (local evidence-tool state only; no product behavior)
- this plan, the Cinematic Bible, the adoption matrix, their standalone HTML mirrors,
  and the curated RC1 handoff/evidence directory.

`fixtures.ts`, package manifests, lockfiles, Prisma schema/migrations, APIs, production
`/agency`, auth, billing, Stripe, environment files, `vercel.json`, Growth work, and all
other product surfaces outside the review-subtree hard-off are immutable in this stream.

## 7. Implementation order

1. Add the dependency-free evidence harness, pin the environment-provided Playwright and
   Axe versions/hashes, and capture the untouched RC5 baseline with that same harness.
2. Amend the existing Foundation, Language, and ADR with the reviewed engine law.
3. Add pure closed profiles, validation, tier projection, and state derivation.
4. Extend the one browser adapter with explicit signals and bounded idle settlement.
5. Add Agency directing profiles and surgical stage wiring.
6. Refactor existing Agency environmental CSS around the projected profile attributes;
   keep the one-to-three continuous channel cap and semantic content unchanged.
7. Change review hard-off from a rendered disabled page to server `notFound()` and gate
   before loading the route stage.
8. Add/extend pure, integration, isolation, browser, and handoff guards.
9. Run local static/build/browser/adversarial validation; fix evidence-backed defects.
10. Create one exact candidate commit, push the isolated branch, verify remote identity,
   await protected Preview, verify protection and no production alias, then package the
   SHA-bound sanitized handoff.

The core policy/adapter and Agency stage/CSS share primary modules, so implementation is
sequential. Validation artifact generation can run after the implementation stabilizes;
parallel worktrees would create more merge risk than speed.

## 8. Failure-mode registry

| Codepath | Realistic failure | Guard / handling | User-visible result |
|---|---|---|---|
| profile validation | missing or duplicate chamber profile | pure guard; whole enhanced contract fails down | complete Tier D document |
| capability hydration | media query or listener throws | existing conservative capability catch | complete Tier C static projection |
| idle timer | stale timeout settles a new chamber | sequence/chamber key and cleanup test | no stale state; otherwise guard blocks ship |
| chamber passage | animation event lost | bounded existing fallback | destination settles and receives focus |
| rapid direct navigation | earlier destination wins late | existing sequence/latest-intent logic | latest selected chamber wins |
| inspection focus | layer closes during transition | room closes inspections before travel; post-layout focus | chamber heading or requested control receives focus |
| Kai visual phase | presentation implies live processing | explicit room signal; no synthetic preparing delay | fixed local staged/resolved state plus no-action receipt |
| hidden document | animation/timer continues | visibility state, timer cleanup, CSS paused/static selectors | unchanged complete chamber on return |
| BFCache restore | stale Kai/chamber/passage returns | existing route reset plus deterministic profile reset | declared chamber/history state restored |
| CSS scroll timeline unsupported | decorative choreography absent | `@supports` and static base | complete composition, no missing meaning |
| review flag contradiction | public flag enables production | hosted server identity wins; layout `notFound()` | 404 |
| handoff curation | local path, secret, symlink, or extra member leaks | deterministic manifest and validation scan | package build fails; no ZIP delivered |

Any codepath with silent failure, no test, and no handling is a P1 and blocks Preview.

## 9. Validation contract

### 9.1 Static and identity

- TypeScript, touched-file lint, `git diff --check`.
- Exact allowlist and byte-identity checks for package/lock, schema/migrations, auth,
  billing, Stripe, APIs, environment, Vercel config, production Agency, and Growth paths.
- Core Runtime, Living Environment, Agency, isolated review, schema safety, compliance,
  and proportional authorization/runtime guards.
- Review-enabled optimized build and adversarial production-identity build from clean
  `.next` states.
- Production-identity probes must return 404 for `/review`, Agency, and Mission Control
  even when a public review flag claims Preview.

### 9.2 Browser matrix

Viewports: 1728×1000, 1440×900, 1024×768, 390×844, 360×800, 320×800,
and 740×390. Also cover 200% reflow, genuine reduced motion, coarse pointer, constrained
tier, and JavaScript disabled.

Flows: arrival, skip, Escape, replay, direct/previous/next navigation, seven chambers,
keyboard and touch activation, inspection open/close/Escape, Kai stage/resolve/clear,
idle settlement, hidden/unhidden, resize, Back/Forward, BFCache, departure, focus restore,
no obstruction, and no horizontal overflow.

Measurements: layout shift, long task, running animation counts by tier, zero idle work,
network methods/origins, storage/cookie/indexedDB/cache/service-worker writes, external
assets, console/page/request failures, Axe, target size, and screenshots after settlement.
Run a warm-up and at least three measured chamber cycles. Repeated app-attributable tasks
over 50 ms, nonzero arrival/swap CLS, sustained idle work, a candidate-owned mutation,
or a blocking Axe finding is a HOLD.

The committed harness accepts absolute environment-provided module paths; it never
installs or mutates dependencies. It fails closed unless Playwright and Axe match the
recorded version and SHA-256 contract, writes those identities into every JSON ledger,
and separates inherited framework traffic from candidate-owned effects. The untouched
RC5 route is captured first with this exact harness. Candidate evidence reports both the
delta against that baseline and the absolute acceptance threshold; improvement alone
cannot turn a failing result green.

Manual screen-reader, switch-control, voice-control, and physical low-end-device testing
remain disclosed caveats unless actually performed.

## 10. Cross-site adoption matrix

| Surface | RC1 classification | Reason / next gate |
|---|---|---|
| Agency Headquarters | protected-review-only; reference implementation | mandatory consumer; production integration requires separate reconstruction and approval |
| Mission Control | ready for a separately reviewed adoption | compatible facility semantics; existing room must retain its own regression guard |
| Growth Center | requires product decision and parallel-stream reconciliation | active Growth work overlaps; economics and live Growth truth are out of scope |
| Arena | requires product and compliance decision | high-energy signature must not create fake competition or gambling language |
| Community | blocked by missing canonical presence owner | no fake activity or people; live presence architecture is not authorized |
| Marketplace | blocked by commerce/billing ownership | presentation cannot precede entitlement and transaction truth |
| Consumer workspace | requires architecture and data-owner mapping | live data, authorization, and task surfaces need separate migration review |
| Landing journey | ready only for a separate public-performance experiment | public conversion, SEO, and motion-consent evidence required |
| Kai environments | requires Kai/product-state mapping | engine may present explicit phases but never infer intent or own computation |
| Future rooms | eligible through the room checklist | closed profile, semantic fallback, truth owner, budgets, guards, and reviews required |

No additional surface is modified in RC1.

## 11. NOT in scope

- Production integration, merge, promotion, alias, or public access.
- A global visual renderer, generic component library, or whole-site redesign.
- Mission Control, Growth, Arena, Marketplace, Community, consumer, or landing migration.
- Live Agency data, authorization, customer identity, persistence, API writes, telemetry,
  model calls, notifications, calendar/task actions, billing, Stripe, or entitlements.
- Semantic copy/fixture changes, except a verified correction.
- Dependency, Canvas, WebGL, video, audio, or generated runtime asset.
- Package advisory remediation; that is a separate security lane.
- Claiming award recognition, production readiness, accessibility certification, or
  physical-device coverage. RC1 may only demonstrate alignment to the stated craft bar.

## 12. Founder delivery and rollback

Delivery includes the protected URL and route, branch/SHA/base, allowlist, canonical
bible/ADR amendments, motion reference, shot notes, desktop/mobile/reduced screenshots,
browser/performance evidence, adversarial review, production-safety proof, adoption
matrix, checklist, Markdown plus standalone HTML reports, manifest, and one sanitized ZIP.

Rollback before integration is no action: leave the branch and Preview unmerged and
retire the Preview. No schema, data, environment, billing, or production rollback exists.
Future integration must reconstruct only approved blobs on a freshly reverified
production base; it must not merge the historical RC5 lineage wholesale.

## 13. Pre-build gate record

The CEO/founder, design/cinematic, engineering, and CCO reviews below constitute the
completed pre-build gate. The visual design review and QA/adversarial gates run again
against the built candidate.

### CEO/founder scope review — 2026-08-01

**Verdict: DONE WITH CONCERNS · SCOPE REDUCED TO CORE RUNTIME 1.1 + AGENCY**

- Reuse the accepted pure runtime and sole browser adapter; a sibling engine/provider
  is prohibited.
- Treat RC5 as working foundation, not a blank redesign. Implement only PARTIAL/MISSING
  capabilities in §3.1.
- Enforce the running-animation and idle budgets before adding motion. Existing duplicate
  perpetual animation is reduction work, not a pattern to extend.
- Kai atmosphere may react only to explicit deterministic presentation state; fake
  thinking, live-presence, consciousness, or action implications are blocked.
- Keep direct/previous/next/history navigation; defer wheel/swipe chamber travel.
- Strengthen hosted production hard-off to a server 404 and retain protected Preview.
- The maximum honest status before Founder judgment is `READY FOR FOUNDER REVIEW`, never
  “award-winning achieved.”

No CEO product decision remains unresolved because the assignment itself selected the
recommended option and authorization boundary.

### Design/cinematic review — 2026-08-01

**Verdict: DONE WITH CONCERNS · 6.8/10 BASELINE · BOUNDED SEVEN-SHOT DELTA APPROVED**

- Preserve the seven existing semantic protagonists and three decorative planes. Their
  shared cyan frame, universal rail, and generic passage currently flatten the camera.
- Distinction comes from seven compositions, light sources, movement axes, and finite
  signatures—not seven times more animation.
- Consolidate existing perpetual loops: at most two Tier A environmental animations,
  one Tier B animation, and zero after idle or during inspection.
- Central owns aperture geometry; Client owns lateral rails; Team owns relational
  geometry; Health owns diagnostic rings; Archive owns one-point layered depth; Kai owns
  narrow focus light; Capacity owns the long horizon.
- Keep one passage state machine but allow source/target profile to direct its axis and
  light. Do not add transition copy or another overlay.
- Tier B removes blur/parallax, keeps one plane and ≤4 px translation, and retains the
  existing 460 ms passage. Raise essential mobile navigation microtype where needed.
- Reduced motion has no passage overlay, parallax, animated light, or draw sequence; its
  final-frame chamber distinction is a release requirement.
- Optional decorative scroll response is Tier A, CSS-only, ≤8 px, and subordinate to
  native bounded inspection scroll. No custom wheel, swipe, or JS measurement.

No design decision remains unresolved. New generated assets, custom gestures, additional
semantic rearrangement, and all cross-site visual migration are explicitly deferred.

### CCO pre-build review — 2026-08-01

**Reviewer:** CreditVector CCO · **Scope:** Living Environment Engine plan, Agency
Headquarters presentation states, Kai presence grammar, synthetic truth, and protected
review boundary.

#### Verdict: GO-WITH-CHANGES

The presentation-only architecture adds no credit-repair claim, credit outcome, price,
subscription, dispute representation, debt-collection representation, or consumer-data
operation. It is acceptable for isolated implementation only if the enumerated truth and
hard-off controls land and pass; this is not legal advice or production approval.

#### Findings

##### [HIGH] Cinematic state must not become a live-operation claim — FTC Act §5 / CFPB UDAAP

- **Risk:** Motion labelled as readiness, pressure, evidence movement, Kai preparation,
  or system breathing could make synthetic fixture activity appear live or autonomous.
- **Required change:** retain the permanent synthetic disclosure, chamber truth boundary,
  fixed-local/no-action receipts, visibly absent unavailable sources, and explicit
  room-owned state; do not invent changing values or a fake preparing delay.
- **Compliant alternative:** animate only decorative geometry tied to an already displayed
  fixed state and settle it without changing the state or implying an action occurred.

##### [HIGH] Review-only content must fail closed outside the protected review context — FTC Act §5 / UDAAP

- **Risk:** a public or production-renderable prototype could be mistaken for an available
  Agency service or live Kai capability.
- **Required change:** hosted production identity must return 404 even under contradictory
  public flags; Preview must remain authenticated, noindex/nofollow, exact-SHA bound, and
  free of a production alias.
- **Compliant alternative:** retain the synthetic surface solely in the protected Founder
  review environment until a separately scoped product, CCO, and production gate passes.

##### [MEDIUM] Pressure and capacity direction must avoid urgency or entitlement implications — FTC Act §5 / UDAAP / Stripe risk

- **Risk:** amber pressure, capacity limits, reserve, and future horizons could imply
  scarcity, upgrade availability, billing entitlement, or a required purchase.
- **Required change:** keep pressure attached to disclosed fixed operational fixtures;
  reserve remains dormant; add no checkout, plan, scarcity countdown, purchase CTA, or
  automatic-expansion implication.
- **Compliant alternative:** use architectural limits and the existing “billing systems
  are not connected” boundary without monetization language.

##### [LOW] Credit-domain compliance posture remains unchanged — FCRA / FDCPA / CROA / state CSO

- **Risk:** none introduced by the engine itself; it does not generate a dispute, promise
  deletion/score change, collect debt, market a credit-repair result, or touch payment.
- **Required change:** semantic copy and fixture truth remain unchanged; any future public
  or credit-outcome adoption receives a fresh CCO review and counsel escalation as
  applicable.
- **Compliant alternative:** continue to describe this artifact as presentation-only
  software and education infrastructure.

#### Launch recommendation

**GO-WITH-CHANGES** — implement and prove the two High controls plus the Medium boundary
before protected Preview. Any failure is a HOLD. Production launch is not authorized.

#### Counsel escalation

None for this isolated presentation prototype. Existing company-wide counsel signoffs in
`.ai/CURRENT-STATE.md` remain owner actions and are not resolved by this review.

### Engineering plan review — 2026-08-01

**Verdict: CLEAR FOR IMPLEMENTATION · THREE P1 PLAN GAPS FOLDED · ZERO OPEN DECISIONS**

The review challenged architecture, code quality, test coverage, performance, hard-off,
tool provenance, failure handling, and sequencing against the actual RC5 sources. It
found three blocking plan gaps: concentration originally paused the idle timer instead
of quieting the environment, browser tooling lacked an immutable resolution contract,
and no same-harness RC5 measurement preceded implementation. All three are corrected in
§4.2, §7, and §9.2.

```text
closed room profile ──> pure validation ──> Tier A/B/C/D projection
       |                       |                       |
       | invalid               | state signals         | static/constrained
       v                       v                       v
complete semantic       sole browser adapter     zero-motion final frame
document                - discrete activity
                        - one idle timeout
                        - visibility/BFCache
                        - passage/focus cleanup
                                  |
                                  v
                         attributes / CSS vars
                                  |
                                  v
                     room-owned decorative rendering
                     facts, copy, actions unchanged
```

| Codepath | Test level | Required negative control |
|---|---|---|
| profile registry and token enums | pure executable | remove/duplicate/reorder one chamber and require Tier D |
| tier projection and explicit signals | pure executable | unknown token, invalid timing, hidden/concentrated state |
| idle lifecycle | source + browser | stale timer after travel, replay, hidden, projection flip, and Kai focus |
| chamber history/focus | existing guard + browser | rapid intent, Back during passage, missing target, BFCache |
| CSS motion budget | source + browser animation ledger | Tier C/D/reduced/idle/inspection must report zero running environment motion |
| synthetic/Kai truth | source + browser | no preparing delay, network, persistence, changing fixture value, or missing receipt |
| hosted hard-off | pure policy + production build | contradictory public Preview flag under production identity must return 404 |
| evidence toolchain | self-validation | wrong Playwright/Axe path, version, or SHA must fail before capture |
| handoff package | manifest + archive validation | extra member, symlink, traversal, local path, secret pattern, or hash drift must fail |

No silent production failure remains without a planned guard and fail-down. The known RC5
cold long-task evidence remains a candidate acceptance risk, not a waived baseline defect.

#### Implementation tasks

- [ ] **T1 (P1)** — Evidence — Build the pinned, fail-closed browser harness and capture untouched RC5. *(Harness complete; final comparable RC5 capture pending.)*
- [x] **T2 (P1)** — Governance — Amend Foundation, Language, and ADR-0040 without creating a second owner.
- [x] **T3 (P1)** — Policy — Add and negatively test closed chamber profiles, tier projection, and static fail-down.
- [x] **T4 (P1)** — Lifecycle — Add explicit attention/Kai signals and cleanup-safe idle settlement to the sole adapter.
- [x] **T5 (P1)** — Agency — Wire seven profiles without changing fixtures, semantic strings, ids, order, or destinations.
- [ ] **T6 (P1)** — Motion — Consolidate perpetual loops, render seven shots, and prove active/idle/static animation budgets. *(Source complete; rebuilt browser proof pending.)*
- [x] **T7 (P1)** — Isolation — Change review hard-off to server 404 and gate before stage load.
- [ ] **T8 (P1)** — Validation — Pass guards, builds, browser matrix, adversarial review, exact binding, and protected Preview.
- [ ] **T9 (P2)** — Handoff — Generate and validate the curated Markdown/HTML/evidence/ZIP package.

`T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9` is deliberately sequential because
the policy, adapter, stage, and stylesheet share the same state contract. There is no
safe parallel worktree lane in the implementation itself.

Untouched RC5 baseline executable guards: Core Runtime **76/76**, Agency **182/182**,
isolated review **23/23**, schema safety **17/17**. No baseline test was rewritten to
obtain those results.

The independent Founder, design, runtime, and validation reviewers agree on the
extension-in-place architecture, Agency-only scope, no-dependency rule, immediate
concentration quieting, zero idle motion, and protected server hard-off. There is no
cross-review tension requiring a Founder choice.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` via `/autoplan` | Scope and strategy | 2 voices | CLEAR WITH SCOPE REDUCTION | Core Runtime 1.1 + Agency; no second engine or cross-site buildout |
| Outside Voice | independent subagents | Missed assumptions | 3 | CLEAR | Agreement on reuse seam, motion subtraction, hard-off, and evidence risks |
| Eng Review | `/plan-eng-review` via `/autoplan` | Architecture and tests | 2 voices | CLEAR | 3 plan gaps found and folded; 0 critical gaps remain in plan |
| Design Review | `/plan-design-review` via `/autoplan` | UI/UX and cinematic direction | 2 voices | CLEAR FOR BUILD | baseline 6.8/10; seven-shot bounded delta defined |
| Compliance Review | `/compliance-review` | Consumer-finance and deception risk | 1 | GO-WITH-CHANGES | synthetic/live truth and production hard-off are implementation blockers |
| DX Review | not triggered | No external developer interface | 0 | NOT REQUIRED | internal typed contract only |

**VERDICT:** CEO + ENGINEERING + DESIGN CLEARED FOR IMPLEMENTATION. CCO conditions are
mandatory candidate checks. Visual design, compliance, QA, and adversarial gates rerun
against the built artifact before Preview.

NO UNRESOLVED DECISIONS
