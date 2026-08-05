# ADR-0041: Growth Center Foundation Preview

Status: **ACCEPTED — GROWTH EXPERIENCE PHASE 1A APPROVED WITH CONDITIONS on 2026-07-31; protected Founder Preview only**
Date: 2026-07-31
Decision owner: Founder
Derives from: [`ADR-0039`](ADR-0039-growth-network-foundation.md) · [`ADR-0040`](ADR-0040-cxos-core-runtime.md) · [`GROWTH_NETWORK_CONSTITUTION.md`](../../GROWTH_NETWORK_CONSTITUTION.md) · [`DECISION_MATRIX.md`](../../DECISION_MATRIX.md)

## Context

The Founder Economic Decision Gate is complete locally but unratified. Live economics therefore remains NO-GO: no participant program, qualification, obligation, payout, billing, provider, tax, settlement, schema, or runtime-economic authorization exists.

The Founder separately authorized a non-monetary Growth Experience Foundation so operators can review an immersive, contribution-led product direction. The requested room uses the existing CXOS experience vocabulary—districts, arrival, return, heartbeat, Kai presence, ambient motion, Director controls, accessibility, and reduced-motion equivalence—without redesigning or modifying an existing CXOS room.

The canonical `GROWTH_NETWORK_ROADMAP.md` already names its blocked economic prerequisites “Phase 1A.” To prevent a decision-gate collision, this implementation is named **Growth Center Foundation Preview**. It is not completion of canonical Phase 1A, Gate B, participant enrollment, or economic activation.

## Decision

1. Add one isolated Founder-review route at `/review/growth-center` with seven review districts: Growth Center, Professional Development, Mentorship, Education Center, Marketplace Preview, Community Contribution, and Agency Builder.
2. Make Growth Center the experience protagonist. The remaining districts are subordinate capability, ecosystem, and optional-organization paths—not seven equal dashboard cards.
3. Present only fixed, synthetic, qualitative fixtures. The experience has no participant, organization, Community, Marketplace, reputation, analytics, customer, or economic data connection.
4. Add a pure `lib/growthNetwork/experience.ts` projection contract and deterministic Growth Advisor resolver. It may use no time, randomness, storage, network, model, identity, or persistence source.
5. Kai retains its canonical Credit Intelligence Officer identity. “Growth Advisor” is a route-local review mode only. It provides fixed recommendations from named synthetic fixture sources and can take no action.
6. Adopt CXOS Core Runtime 1.0 as headless presentation infrastructure under ADR-0040. The room owns its copy, fixtures, semantic document, and CSS. Core Runtime owns only reviewed lifecycle/accessibility mechanics and receives no Growth truth.
7. Gate the stage behind both the existing production-hard-off Founder review policy and exact-string `GROWTH_CENTER_PREVIEW_ENABLED=true`. The Growth Network economic master flag remains off and independent. A preview flag is an activation control, not program or economic authorization.
8. Keep the route unregistered: no product navigation, review-hub entry, sitemap entry, room registry, Mission Control integration, Agency Command integration, Arena integration, Community integration, or production discovery surface.
9. Make first-visit and return-visit behavior explicit deterministic Director fixtures. The room may not infer a prior visit or store state.
10. Every future capability is visibly unavailable. No enrollment, matching, booking, credential, listing, post, purchase, sale, qualification, distribution, or payout action exists.
11. The seven review districts are synthetic presentation zones only. They do not supersede the production Growth Center hierarchy in `GROWTH_NETWORK_PRODUCT_SPEC.md` §5.1 or create new bounded contexts.

## Alternatives considered

### Reuse a live dashboard or application shell

Rejected. Existing shells transitively connect identity, agency, Community, Kai, navigation, or production application state. This preview must remain independently reviewable and effect-free.

### Reimplement CXOS lifecycle mechanics in the Growth bounded context

Rejected. ADR-0040 establishes the separately adoptable headless seam. Reimplementing capability detection, arrival, visibility pause, focus, district activation, and departure would create a competing presentation lifecycle. Importing Core Runtime does not transfer Growth data ownership to CXOS.

### Gate the preview with `GROWTH_NETWORK_ENABLED`

Rejected. That flag represents the dormant Growth Network foundation and could imply program activation. The experience preview uses a subordinate review-only flag while the economic master and payout sentinel remain unchanged.

### Add a public `/growth-center` route

Rejected for this phase. The requested deliverable is a Founder-review Preview, not a participant launch. The `/review` namespace already supplies no-index review policy and a production-hard-off convention.

## Consequences

- The Founder can review a production-shaped Growth experience without activating a program or connecting live systems.
- The first frame makes business-building through useful contribution legible while explicitly refusing recruiting incentives.
- Fixed first/return fixtures demonstrate experience pacing without fake memory.
- No existing room or protected surface changes.
- The preview cannot validate demand, economics, attribution, eligibility, participant data, or operational workflows.
- Any participant-facing launch requires a new decision, ratified policy, ordinary five-review gate, and separate authorization.

## Security and privacy implications

- Growth-owned preview code performs no API route, server action, fetch, model call, database access, auth/session read, cookie, storage, form submission, analytics, telemetry, or external link. The root application still inherits its standard `SessionProvider`, theme bootstrap, and `TransitionShell`; local browser evidence may therefore observe the standard `/api/auth/session` read or theme storage behavior. Neither is a Growth input or mutation.
- No PII, organization membership, customer record, Community record, evidence record, eligibility state, or economic record.
- Production and unknown build identities fail closed even if the subordinate preview flag is set.
- Static/reduced/constrained projections reveal the complete semantic document and never upgrade motion.
- Native local return navigation fails open; all Growth facts and effects remain absent.

## Compliance implications

- Persistent copy states that the experience is synthetic and no live program exists.
- Recruiting is expressly not rewarded. No amount, balance, rate, earnings projection, referral count, rank, leaderboard, qualification, or income promise appears.
- Mentorship and education are framed only as future B2B operator professional development, never consumer-specific credit improvement, dispute execution, legal advice, representation, advance-fee guidance, or promised outcomes.
- Marketplace, Community, and Agency Builder are future concepts with no commerce, social integration, participant status, or Growth Distribution.
- This ADR is not legal approval for a participant program or public marketing claim.

## Rollback

Remove the new review route, pure experience projection, preview guard, dedicated test, and Growth Center Foundation Preview reports. No data, schema, environment, billing, provider, production route, or external system must be reversed.

## Required evidence before Founder handoff

- Existing Growth, CXOS Core Runtime, schema-safety, compliance, and protected-room regression guards.
- Dedicated source guard proving exact districts, deterministic projection, review gating, absent effect/data imports, and no economic objects.
- Typecheck, touched-file lint, optimized preview build, production-identity hard-off build, and rendered browser checks at desktop, tablet, mobile, and 320px.
- Keyboard, focus, reflow, reduced-motion, performance, network/write observation, arrival, heartbeat, Kai, district navigation, and return evidence.
- Final diff proof that protected surfaces, schema, billing, authentication, organizations, identity, Marketplace backend, and production configuration were not modified by this stream.

This decision authorizes no merge, commit, push, production deployment, public launch, schema, API, participant program, model runtime, payment, billing, provider, tax, settlement, qualification, reputation, or economic implementation.

## Founder disposition — 2026-07-31

The Founder subsequently approved the experience direction with conditions and authorized a separate non-monetary contract gate. The exact continuing taxonomy is:

- `CGN ECONOMIC PHASE 1A — BLOCKED`
- `GROWTH EXPERIENCE PHASE 1A — APPROVED FOUNDER PREVIEW`
- `GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK`

ADR-0042 owns the Phase 1B decision. This disposition does not retroactively expand ADR-0041 into participant data, enrollment, schema, APIs, runtime AI, Marketplace transactions, billing, payouts, public access, production integration, or any economic implementation.
