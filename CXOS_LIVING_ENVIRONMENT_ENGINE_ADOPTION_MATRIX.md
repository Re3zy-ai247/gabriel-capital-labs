# CXOS Living Environment Engine — Adoption Matrix

- **Status:** GOVERNANCE REFERENCE · NO BROAD ADOPTION AUTHORIZED · RC1 base + RC2 capability-consumption update (§4.3)
- **Date:** 2026-08-01 (RC1 base) · updated 2026-08-02 (RC2)
- **Architectural identity:** CXOS Core Runtime 1.1 Living Environment profile — not a separate engine
- **Current adopter:** Agency Headquarters only, as the isolated implemented reference candidate
- **Release authority:** No merge, production integration, promotion, alias, or additional-room authorization

## 1. Purpose and authority

This matrix records the adoption boundary already established by `CXOS_LIVING_ENVIRONMENT_ENGINE_RC1_PLAN.md`, `CXOS_FOUNDATION.md` §17, `CXOS_LANGUAGE_1_0.md` §§2.8–2.10, and ADR-0040. It does not select a next adopter, assign new product ownership, or authorize work.

The delivery title retains “Living Environment Engine” as the assignment name. The architecture remains one CXOS Core Runtime. Living Environment is an optional 1.1 presentation profile on that engine.

“Implemented reference” means the Agency profile exists in the isolated RC1 candidate. It does not mean validated, Founder-accepted, merged, production-live, generally reusable without further work, or approved for any other room.

Truth labels follow `.ai/CONSTITUTION.md`: **VERIFIED** means the boundary is present in the assignment, controlling plan, or isolated source; **PROPOSED** means a future scoped adoption package; **NEEDS CONFIRMATION** means a named owner or Founder decision is still required. No candidate fact is labeled as production truth.

## 2. Classification legend

### 2.1 Exact assignment classifications

The **Current classification** column uses only the assignment's seven exact values. None is a release authorization.

| Exact classification | Meaning in this matrix |
|---|---|
| **ready for engine adoption** | The surface may enter a separately scoped adoption review without first resolving a known product/owner/data blocker; implementation still requires the complete gate and Founder authorization |
| **requires product decision** | Product meaning, positioning, or economics must be decided before architecture or presentation work begins |
| **requires architecture work** | Product fit may exist, but the surface's data, authorization, effect, lifecycle, or integration seam must be mapped and approved first |
| **blocked by missing canonical owner** | No authorized owner presently exists for a presentation-critical truth such as presence or a not-yet-defined room |
| **blocked by live-data integration** | Canonical live transaction/data/entitlement truth and its failure/permission states must exist before presentation can project it |
| **protected-review-only** | Code may exist only behind the isolated protected review boundary; no production integration or precedent follows |
| **not appropriate** | Applying the Living profile would duplicate another system's purpose or create a forbidden architecture; no adoption proposal is open |

### 2.2 Adoption horizons

| Horizon | Meaning |
|---|---|
| **NOW — isolated candidate** | Agency Headquarters is the sole implemented reference under protected review |
| **NEXT — review-eligible, not selected** | A separate proposal could be opened only after Founder selection; no next adopter or implementation is authorized by this label |
| **LATER — prerequisite first** | Product, architecture, canonical-owner, or live-data work must be resolved before an adoption proposal |
| **DO NOT APPLY** | Living Environment is the wrong boundary for the named system; only a new Founder decision may reopen the question |

The “accountable functions” below identify the functions that would have to participate in a future scoped review. They do not reassign canonical ownership.

## 3. Non-adoption law

No surface inherits Living Environment merely because:

- it is a CXOS room;
- Agency Headquarters implements the reference profile;
- it could reuse the camera, lighting, or motion tokens;
- a visual prototype appears compatible;
- its current animation could be consolidated; or
- Agency candidate evidence later passes.

Every future adopter requires a separately bounded proposal, a named truth and surface owner, a complete static baseline, contract/profile validation, proportional engineering/design/compliance/QA review, regression evidence, and explicit Founder authorization. No historical review branch is merged wholesale.

## 4. Surface adoption matrix

### 4.1 Classification, horizon, and owner gate

**VERIFIED** classifications reflect the assignment taxonomy and the controlling RC1 plan. **PROPOSED** future gates remain unopened until the named owner and Founder act.

| Surface | Current classification | Horizon | Why this is the boundary | Owner gate before any implementation | Explicitly not authorized now |
|---|---|---|---|---|---|
| **Agency Headquarters** | **protected-review-only** | **NOW — isolated candidate** | Mandatory RC1 consumer; seven approved semantic chambers exercise the profile without granting new facts or effects | Agency surface owner + Core Runtime owner; CEO, engineering, design, CCO, and QA/accessibility gates; Founder release judgment after exact-SHA evidence | Merge, production deployment/alias, public access, or automatic precedent for another room |
| **Mission Control** | **ready for engine adoption** | **NEXT — review-eligible, not selected** | Compatible facility semantics and a complete existing room make it eligible for a separately scoped review; its architecture and regression contract remain independently owned | Mission Control surface/truth owner + Runtime owner; full five-review gate; Founder must select and authorize the scoped candidate | Migration, redesign, stacked arrival/passage, or a claim that Mission Control already consumes Living Environment |
| **The Passage** | **not appropriate** | **DO NOT APPLY** | The Passage already is the deliberate cross-room transfer system; wrapping it in a room Living profile would duplicate its purpose | No standing adoption gate. Only a new Founder decision after Passage design/architecture owners prove a non-duplicative need could reopen it | Living profile wiring, second passage/overlay, or changed transfer timing under this matrix |
| **Growth Center / Growth Network** | **requires product decision** | **LATER — prerequisite first** | Parallel Growth work, economics, and live Growth truth are outside RC1; capacity presentation cannot decide monetization | Growth product/truth owners; billing/entitlement owners where implicated; Runtime/design, engineering, CCO, QA, and Founder gates | Migration, monetization cue, reserve/upgrade claim, purchase CTA, or Agency capacity imagery treated as Growth truth |
| **Arena** | **requires product decision** | **LATER — prerequisite first** | High-energy recognition must be bounded to evidenced standing and must not create fake competition or gambling language | Arena product/evidence owner; CCO and design decision first; Runtime/engineering/QA and Founder gates afterward | Adoption, scoring/reward changes, competition effects, casino pulse, or copied Agency motion |
| **Community** | **blocked by missing canonical owner** | **LATER — prerequisite first** | No authorized canonical owner currently supplies privacy-safe live presence/activity truth | Community product/data owner and authorized presence owner; privacy/security and CCO; Runtime/design/engineering/QA; Founder | Presence dots, activity pulses, fake people, inferred availability, new telemetry, or adoption work |
| **Marketplace** | **blocked by live-data integration** | **LATER — prerequisite first** | Canonical commerce, availability, transaction, billing, and entitlement states must precede their presentation | Marketplace product + transaction/billing/entitlement owners; Stripe/security and CCO gates; Runtime/design/engineering/QA; Founder | Checkout/entitlement implications, inventory/scarcity motion, or presentation-owned transaction state |
| **Consumer Workspace** | **requires architecture work** | **LATER — prerequisite first** | User-scoped live data, authorization, tasks, effects, privacy, and Kai/credit-content boundaries require a separate integration map | Consumer product/data + auth/action owners; security/privacy and CCO; Runtime/design/engineering/QA; Founder | Migration, customer-data projection, new task/effect behavior, credit recommendation, or presentation authority |
| **Landing journey** | **ready for engine adoption** | **NEXT — review-eligible, not selected** | It may be evaluated only as a separate public-performance experiment; authenticated-room evidence and assumptions do not transfer | Marketing/Growth owner; SEO/Core Web Vitals, accessibility, design, engineering, CCO, QA, and Founder gates | Public rollout, autoplay/cinematic layer, SEO-affecting change, or reuse of Agency geometry without an experiment |
| **Generic “Kai environments”** | **not appropriate** | **DO NOT APPLY** | Living Environment may present explicit Kai phases inside an owned room; it may not become a second Kai behavior, computation, or intelligence system | No generic adoption gate. A qualifying room must use its own surface owner plus KAI-OS/intelligence owner, CCO/security, the five reviews, and Founder authorization | Generic Kai room/profile, inferred thinking or presence, fake `preparing`, model calls, memory, recommendations, or actions owned by presentation |
| **Future rooms** | **blocked by missing canonical owner** | **LATER — prerequisite first** | An undefined room has no approved purpose, protagonist, truth source, or accountable owners to validate | Proposed room/product/truth owners must first be named; then Runtime/design, engineering, CCO, QA/accessibility/performance, and Founder gates | Roadmap placement, default inheritance, generic renderer, or pre-approval of an undefined surface |

The **NEXT** horizon identifies review eligibility only. It does not choose Mission Control, the landing journey, or any other surface as the next adopter.

### 4.2 Reuse, required extension, and forbidden duplication

| Surface | Reuse if its gate later opens | Surface-owned extension required | Forbidden duplication |
|---|---|---|---|
| **Agency Headquarters** | Existing Core Runtime 1.1 policy, sole adapter, closed seven-profile contract, and Agency CSS | No scope extension in RC1; only evidence, handoff, and a separately authorized future integration reconstruction | Another provider/adapter, generic scene renderer, second passage, or Agency profile copied to another room |
| **Mission Control** | Pure validation, tier projection, lifecycle/focus/history cleanup, and closed presentation vocabulary | Its own protagonist, truth/source map, static document, profile, CSS composition, and unchanged regression guard | Reimplementing arrival/departure/passage or stacking Living observers on the existing room |
| **The Passage** | None from the Living room profile; it remains the existing shared transfer language | Only its already-owned origin/destination, focus, fallback, and reduced-motion contract | A Living arrival/idle/chamber lifecycle around the Passage or a second transfer overlay |
| **Growth Center / Network** | Shared validator/policy only after the product decision | Canonical Growth state, economic meaning, entitlement boundaries, static states, and Growth-specific composition | Agency capacity threshold treated as monetization truth; duplicated billing/entitlement logic |
| **Arena** | Shared lifecycle/accessibility primitives only after the product/CCO decision | Arena-owned evidence/standing states, ceremonial composition, static equivalence, and Arena regression proof | Agency camera/motion clone, fake competition, casino language, or a second recognition policy |
| **Community** | Static fail-down, attention/idle policy, and validation only after a canonical presence owner exists | Privacy-safe presence/activity contract, moderation/empty/unavailable states, and Community-specific composition | Presentation-owned presence, fake people/dots, inferred activity, or a parallel telemetry owner |
| **Marketplace** | Lifecycle and static projection only after live commerce truth is established | Transaction/availability/entitlement/error/permission states owned by commerce systems | Presentation deciding checkout, entitlement, scarcity, inventory, price, or completion |
| **Consumer Workspace** | Pure projection and adapter seam only after architecture review | User-scoped data/auth/task/effect ownership, consent/privacy, static equivalence, and consumer-specific Kai/credit review | A second data/action runtime, client-side authority, copied Agency fixtures, or presentation-owned recommendations |
| **Landing journey** | Closed motion vocabulary, reduced/static fail-down, and no-JS discipline | Public narrative/profile, SEO/static rendering, motion consent, conversion truth, performance budget, and rollback experiment | Authenticated-room arrival assumptions, Agency geometry, scroll capture, or a second global motion provider |
| **Generic “Kai environments”** | Only explicit `quiet/staged/preparing/resolved` presentation signals inside another otherwise-approved room | Room-owned mapping to the one Kai intelligence contract; no standalone Living/Kai extension | Second Kai system, inferred intent, fake computation, memory/effect ownership, or a generic Kai scene |
| **Future rooms** | Existing Runtime and ordinary adoption checklist after purpose/owners exist | Room-owned semantic registry, truth boundaries, closed profile, static projection, CSS, guards, and rollback | Default inheritance, generic room renderer, Agency clone, or prebuilt profile before ownership |

### 4.3 RC2 capability consumption (Agency Headquarters)

Agency Headquarters is still the only implemented reference (§6); nothing in this subsection changes that boundary, opens a new adoption gate, or reclassifies any row in §4.1. It records which previously-declared-only Core Runtime tokens and channels now have a working, guard-verified consumption pattern inside Agency's isolated RC2 candidate. This is precedent for **how** a token can be consumed, not evidence that the token is proven safe or appropriate for another room's product meaning — §5 still requires every future surface to prove its own regression, compliance, and accessibility case from a static baseline.

| Token / channel | RC1 status | RC2 status (Agency Headquarters) |
|---|---|---|
| `--cxos-light-rest` / `--cxos-light-active` | Declared reference only; zero consumers | Consumed twice: (a) `--cxos-breath-lo`/`--cxos-breath-hi` derive the per-chamber continuous breath channel's opacity envelope; (b) Growth Threshold's occupied/reserve capacity cells use a static (non-animated) opacity pair built from the same two tokens, so the 12/15 capacity boundary reads as a light step instead of only a caption |
| `--cxos-dur-drift` | Declared only; RC1 stated no Living animation consumed this duration | Consumed by `agencyLivingHeartbeat`, Tier A's continuous facility-sweep (18,000 ms, full-width travel) |
| `data-cxos-kai-presence` | Projected by the runtime with no CSS/JSX consumer | First real consumer: `suspended` (departure phase only, Tier A/B, valid contract) resets `.kaiContext` to its neutral border/background baseline |
| Per-chamber `idleAfterMs` | Registry field did not exist; one room-level pair applied uniformly to all districts | All seven chambers declare their own `idleAfterMs` (validated against the same bounds as the room default); the runtime resolves the active chamber's own value each time the idle timer arms |
| `--cxos-settle-opacity` | Did not exist; one flat `0.46` idle-settled opacity applied to every chamber | New per-signature custom property (`0.42`–`0.54`), declared in each of the seven signature blocks, read by the settled-idle rule with a `0.46` fallback |
| `--cxos-entry-scale-x` | Did not exist | New custom property consumed by both acquire keyframes as a `scaleX()` term (default `1`); non-default on two chambers (Central Command `0.92`, Team Operations `0.94`) plus their Tier B halves (`0.96`, `0.97`) |
| `--cxos-breath-*` (`--cxos-breath-period`, `--cxos-breath-lo`, `--cxos-breath-hi`) | Did not exist | `--cxos-breath-period` declared per-signature (4600–7200 ms), consumed as `agencyLivingBreath`'s animation duration; `--cxos-breath-lo`/`-hi` are room-level `calc()` derivations of `--cxos-light-rest`/`-active` (row 1), consumed as that same keyframe's opacity envelope |
| Passage signal/origin per chamber | Only Business Health carried a distinct passage tint; the other six shared one default | All seven destinations declare their own `--cxos-passage-signal` (a stronger reading of that chamber's own `--agency-chamber-edge`) and `--cxos-passage-origin` (derived from that chamber's own entry-vector sign) |

Consistent with §5's closing line — "passing Agency RC1 evidence does not satisfy another surface's gate" — the same holds here: a token having a second, more developed consumption pattern inside Agency does not pre-approve its use elsewhere. Full mechanism detail for all eight rows is in `CXOS_LIVING_ENVIRONMENT_ENGINE_CINEMATIC_BIBLE.md` §11 (RC2 Amendments).

## 5. Common future-adoption gate

A future surface may not begin implementation until its scoped review package contains all of the following.

### 5.1 Product and truth

- one operational purpose and one protagonist;
- canonical facts, status, action, destination, and effect owners;
- explicit unavailable, empty, error, and static states;
- a statement of what “living” means for that surface without fabricated activity; and
- proof that the profile solves a real comprehension or continuity problem rather than an engagement goal.

### 5.2 Architecture

- reuse of the existing Core Runtime and sole browser adapter;
- no provider, second lifecycle, generic renderer, scene graph, event bus, or dependency;
- a closed room-owned profile whose ids and order match the semantic registry;
- explicit attention and Kai signals supplied by owning product state, never inferred by presentation;
- complete static fail-down and native-navigation behavior; and
- an allowlist and rollback plan that protect unrelated surfaces.

### 5.3 Design, motion, and accessibility

- one-to-three bounded transform/opacity channels for a capable projection;
- zero continuous motion for Tier C, Tier D, reduced, invalid, hidden, inspection, and settled idle states;
- mobile, coarse-pointer, 200% reflow, landscape, 320 px, keyboard, screen-reader, and no-JavaScript designs;
- visible focus, at least 44 px controls, native scrolling, and real Back/Forward destinations; and
- a room-specific shot profile that preserves the facility language without copying Agency geometry.

### 5.4 Truth, compliance, and Kai

- no fabricated telemetry, people, activity, computation, urgency, scarcity, entitlement, result, or completion;
- no canonical value or status changed merely to create atmosphere;
- any Kai phase mapped to explicit truthful state with no inferred intent, fake delay, model implication, memory, or effect;
- CCO review for every user-facing, credit-content, commerce, Agency, Community, Marketplace, or Kai-sensitive adoption; and
- counsel escalation where the owning domain's existing governance requires it.

### 5.5 Evidence and authority

- current pure, integration, isolation, regression, schema-safety, and compliance guards;
- optimized and adversarial-identity builds;
- browser, accessibility, performance, network/write, history/focus, reduced/static, and mobile evidence;
- exact commit, baseline, branch, Preview protection, production hard-off, and sanitized handoff identity; and
- explicit Founder authorization for the scoped candidate, followed by a separate integration/production decision if requested.

Passing Agency RC1 evidence does not satisfy another surface's gate. Evidence transfers only for unchanged shared-runtime behavior; room truth, composition, regression, compliance, accessibility, and performance must be proved again.

## 6. Agency integration boundary

Agency Headquarters is the only implemented reference in this lineage. Even if the isolated candidate later receives favorable Founder review:

1. no other surface becomes approved;
2. no production change occurs automatically;
3. the historical RC5/RC1 lineage is not merged wholesale;
4. any approved integration is reconstructed as bounded blobs on a freshly reverified production baseline;
5. production identity, schema, auth, billing, Stripe, environment, APIs, Growth work, and unrelated rooms remain untouched unless separately authorized; and
6. rollback before integration remains no action: leave the candidate unmerged and retire its Preview.

## 7. Decision queue

No next adopter is selected by this matrix. **NOW** remains Agency's protected candidate only; **NEXT** means review-eligible but unselected; **LATER** means the row's product, architecture, canonical-owner, or live-data prerequisite comes first; and **DO NOT APPLY** remains closed. A later Founder directive may open one separately scoped adoption review, but none is opened here.

## 8. Terminal boundary

This matrix is a governance aid for the isolated RC1 handoff. It is not a roadmap, migration plan, product commitment, implementation authorization, Founder acceptance, merge approval, production authorization, or permission for broad CXOS adoption.
