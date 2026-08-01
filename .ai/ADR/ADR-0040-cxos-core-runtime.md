# ADR-0040: CXOS Core Runtime 1.1 as shared presentation infrastructure

Status: **Accepted — Core Runtime 1.0 Founder-authorized 2026-07-31; 1.1 Living Environment extension Founder-authorized 2026-08-01 for an isolated candidate and protected Preview only**
Date: 2026-07-31 · amended 2026-08-01
Decision owner: Founder

## Context

Founder review approved the Phase 6.2 Agency Headquarters architecture and identified the remaining arrival, departure, heartbeat, district activation, scroll progression, atmosphere, lighting, Kai-presence, motion, and accessibility work as platform-wide CXOS capabilities. Continuing to implement those mechanisms independently inside each room would create competing lifecycle systems, inconsistent accessibility behavior, duplicated browser work, and room-specific drift.

The approved Phase 6.2 implementation already supplies one real reference consumer: a complete semantic room with a deterministic arrival, native-scroll district activation, purpose-bound heartbeat, environmental layers, contextual route-local Kai projection, reduced-motion equivalence, and a bounded Mission Control return. The safest generalization point is therefore the smallest shared mechanism extracted from that reviewed room, not a speculative global scene framework and not a redesign of other rooms.

## Decision

Retain **CXOS Core Runtime 1.0** as one engine with two headless, client-safe layers, and advance that same engine and ownership boundary to **CXOS Core Runtime 1.1** through the Living Environment contract below. This amendment creates no sibling engine, global visual provider, rendered scene framework, or second lifecycle.

1. `lib/cxos/runtime.ts` owns pure contracts and deterministic policy for runtime validation, capability projection, arrival/departure phase, environmental heartbeat state, spatial/district state, lighting, atmosphere, Kai-presence state, shared motion, and shared accessibility fail-down behavior.
2. `components/cxos/runtime/useCxosRoomRuntime.ts` adapts those contracts to browser lifecycle: capability hydration, visibility pause, Escape settlement, focus handoff, replay, one passive `IntersectionObserver`, native-scroll district movement, route-instance reset, and a bounded fail-open departure fallback.

Agency Headquarters becomes the **first reference consumer**. It retains ownership of its semantic structure, room-specific CSS and visual output, fixtures, data-truth boundaries, arrival copy, heartbeat instruments, Kai command resolver, review controls, and production hard-off. The extraction changes only shared lifecycle wiring and equivalent arrival-duration plumbing; the runtime receives no canonical metric values and renders no room UI.

The runtime law is:

> Truth and motion fail closed to the complete static document. Navigation fails open to the real local destination. The runtime may project state; it may never own facts or effects.

The runtime contract requires one to three named continuous motion channels for a motion-capable room; Tier C, Tier D, reduced-motion, and invalid projections activate none of them. Invalid room ids, district registries, arrival sequences or timing, motion budgets, departure routes, or fallback bounds resolve to Tier D static state with no active heartbeat, atmosphere, scroll choreography, or claimed Kai availability.

No existing Mission Control, Passage, Arena, landing-journey, Consumer Workspace, Marketplace, Community, Growth Network, or live Kai implementation is migrated in this phase. Each future consumer requires separate scope, review, and evidence.

### Core Runtime 1.1 Living Environment extension

Living Environment is an optional presentation profile on the existing Core Runtime. A room may declare bounded camera/framing, depth, lighting, purpose-bound heartbeat/idle, focus/concentration, Kai presentation phase, transition, capability, and static-equivalence presets. The terms are semantic presentation vocabulary: they do not introduce a literal 3D camera, a globally rendered environment, or a claim of live data, autonomous behavior, model activity, consciousness, or system work.

The room owns the profile's semantic targets, allowed presets, transition meaning, complete static result, canonical facts, DOM, copy, CSS, destinations, fixtures, instruments, actions, and every Kai intent or effect. Core Runtime validates the declaration and projects deterministic lifecycle, capability, visibility, motion-budget, focus, Kai-presence, and static-equivalence state/tokens only. Room CSS consumes those tokens and renders the treatment.

Fail-down is deterministic:

- an invalid profile, target, preset, transition, channel budget, or capability resolves to the room's complete declared static projection;
- Tier C, Tier D, reduced-motion, constrained, and skipped projections require zero continuous motion and preserve identical facts, actions, disclosures, focus behavior, and destinations;
- hidden documents pause nonessential motion and may settle through the declared lifecycle, never through an improvised or upgraded projection;
- user input, visible focus, Escape, native scroll, and native local navigation outrank ambient presentation; and
- no profile may fabricate activity, computation, urgency, customer state, model work, changing metrics, Kai availability, or completion.

Agency Headquarters is the sole Living Environment reference consumer in this release lineage. This amendment does not migrate or prescribe the profile for any other room.

## Alternatives considered

### Keep every mechanism inside each room

Rejected. It repeats capability detection, lifecycle cleanup, focus behavior, visibility policy, observers, and departure fallbacks, making the Founder-approved platform law unenforceable.

### Create one global visual provider that renders arrivals and atmosphere

Rejected. A rendered provider would centralize room-specific composition and encourage identical rooms. Core Runtime stays headless; rooms retain their own architecture and visual language.

### Migrate every existing CXOS room immediately

Rejected. It would violate the current scope freeze, enlarge regression risk, and generalize without a controlled reference consumer. Agency Headquarters proves the seam first.

### Add a motion or scene dependency

Rejected. CSS, React state, `IntersectionObserver`, focus APIs, and a bounded timer cover the approved mechanics. A dependency would add bundle, security, and maintenance cost without new capability.

### Create a separate Living Environment engine

Rejected. A sibling engine would duplicate lifecycle, capability, visibility, accessibility, and navigation policy and would split the ownership boundary already established by Core Runtime 1.0. Living Environment is a 1.1 contract extension on the same headless engine.

## Consequences

- Core Runtime remains one deterministic presentation engine and advances to version 1.1 without adding a second lifecycle or renderer.
- Future major rooms may inherit one deterministic lifecycle contract instead of reimplementing core behavior, but only through separately authorized adoption.
- Room-specific visuals, facts, copy, and data ownership remain outside the runtime.
- Reduced motion, constrained capability, hidden-document pause, native-scroll authority, focus handoff, and fail-open navigation become shared policy.
- The isolated Agency Headquarters candidate may delegate the new presentation profile only through the existing Core Runtime seam; its approved architecture and ownership boundaries remain intact.
- Existing rooms remain on their current implementations until separately authorized. Temporary coexistence is explicit and must not be mistaken for permission to refactor them in this stream.
- Core Runtime is presentation infrastructure, not GIOS/Kai Kernel, an application service, an event system, a router, a data layer, or an execution broker.

## Security implications

- The pure policy imports no React, DOM, server, auth, database, billing, model, or environment surface.
- The client adapter performs no fetch, API call, storage read/write, cookie access, telemetry, model call, customer mutation, or cross-window transport.
- Departure destinations must be validated local absolute paths. Modified clicks and static tiers remain native; an eligible cinematic departure commits at most once and has a bounded local-navigation fallback.
- Missing or invalid browser/runtime capability never upgrades motion.
- Kai presence is presentation state only; it conveys availability/context and owns no intent, memory, customer fact, or effect.
- Living Environment profiles contain presentation declarations only. They cannot initiate work, simulate computation, manufacture live state, or expand Kai authority.

## Compliance implications

The runtime introduces no consumer-credit recommendation, score, deletion, outcome, pricing, billing, or customer-facing production claim. It cannot fabricate live activity because it never receives or mutates canonical values. Synthetic review disclosures and Agency Kai no-action receipts remain owned by the reference room and unchanged. Future user-facing consumers still require the ordinary CCO gate; this ADR is not legal approval or production authorization.

## Migration or rollback plan

This phase is schema-free and isolated from production. Before integration, rollback is a no-action release decision: do not merge or promote the candidate, and supersede it with a later candidate from the same production baseline if needed. There is no database, migration, environment, feature-flag, auth, billing, API, production-deployment, or data rollback.

Future room adoption is incremental: define the room contract, retain its semantic document and CSS, migrate only the shared lifecycle seam, run the room’s existing guard plus the Core Runtime guard, compare static and cinematic behavior, and stop for separate approval. No wholesale room rewrite is permitted.

## Evidence

- Founder directive approving Phase 6.2 Agency Headquarters and authorizing CXOS Core Runtime (2026-07-31).
- Founder directive authorizing the Core Runtime 1.1 Living Environment extension for an isolated Agency Headquarters candidate and protected Preview (2026-08-01).
- Reviewed Phase 6.2 room baseline commit, before Core Runtime extraction: `a40a41c5a76028ad5cae2ff655c5bf168fb86a4a`.
- Approved Agency Headquarters RC5 baseline for the isolated 1.1 candidate: `29260fddfc59d71e3d963d2ec791657ea57084af`.
- Pure Core Runtime guard: `scripts/cxos-core-runtime.test.ts`.
- Agency integration guard: `scripts/cxos-agency-command.test.ts`.
- Required release evidence: typecheck, touched-file lint, diff check, scoped CXOS guard suite, optimized review build, production-identity hard-off build, browser matrix, accessibility, performance, and network/write observation before any integration request.

This amended decision authorizes one bounded 1.1 candidate commit, one isolated review-branch push, and one protected Preview from the exact isolated commit. It authorizes no merge, production deployment or promotion, production alias change, database action, migration, schema change, auth change, billing change, force-push, other-room migration, or unrelated-room implementation. Preview approval is not production integration approval.
