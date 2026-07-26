# Platform Ownership Map — one owner per capability

**Constitutional record. Authority:** subordinate to [`GIOS-PLATFORM.md §3`](GIOS-PLATFORM.md) (the frozen ownership registry, ADR-0034) and grounded in [`CVIOS.md §Bounded-context reconciliation`](CVIOS.md) (code truth). Created 2026-07-21 at the Sprint 9 merge-authorization gate. **Rule: exactly one ACTIVE owner per capability.** A dormant successor may exist for a capability undergoing migration, but there is never more than one *active* owner. This document is updated when ownership moves, never forked.

**Ratified Identity clarification (2026-07-26):** [Identity Constitution v1.0](IDENTITY-CONSTITUTION.md) supersedes the former direct-successor language. `managedByAgencyId` is owned by Consumer-management and remains authoritative only for the existing managed-consumer capability. `OrganizationMembership` is a distinct Membership-domain fact. No conversion, backfill, projection, or fallback authorization connects them; future reconciliation is read-only classification plus explicit enrollment.

## Ownership registry

| Capability | Sole owner (code) | Status | Notes |
|---|---|---|---|
| **Authentication** (credentials, session, JWT) | `lib/auth.ts`, `lib/session.ts` | SHIPPED | External to Identity. Principal = `currentAccount().id`. Identity consumes it, never authenticates. |
| **Operator Identity — lifecycle** | `lib/identity/**` (`OperatorIdentity`, state machine) | **BUILT (Sprint 9, dormant)** | The account's platform-identity projection. Auth `User` stays the source of truth for credentials. |
| **Organizations + Membership (durable)** | `lib/identity/**` (`Organization`, `OrganizationMembership`, `OrgRole`) | **BUILT (Sprint 9, dormant) — canonical** | Migration-first. Generic `Organization` (kind ∈ AGENCY/ENTERPRISE/EDUCATOR/VENDOR/INTERNAL). Sole owner of durable org+membership + role taxonomy. Supersedes the dead team store only; it is distinct from Consumer-management. |
| **Consumer-management relationship (LIVE)** | `User.isAgency`/`managedByAgencyId`, `app/api/agency` | SHIPPED (active) | Sole owner of agency mode, managed-consumer authorization/entitlement compatibility, workspace selection, and service termination. It never establishes OperatorIdentity, Organization, Membership, or Platform Authority. |
| ↳ *dead: OS team store* | `lib/os/platform/teams.ts`, `lib/platform/teamStore.ts` (`TeamMember`/`TeamInvitation`/`ClientAssignment`) | **SUPERSEDED — zero consumers** | Self-healed, unwired, absent from the canonical registry. Superseded by identity membership. **Follow-up: remove** (does not block merge; not an active owner). |
| **Authorization / RBAC enforcement** | `lib/os/kernel/pep.ts` (default-deny PEP), `lib/entitlements.ts` (plan capabilities) | SHIPPED | Identity's `rbac.ts` is a permission-set **MAP** the PEP *consumes* — an additive source, never a parallel enforcement engine. |
| **Reputation / trust (Vector XP)** | **`lib/reputation/**`** — durable ledger + progression **and the canonical scoring policy `lib/reputation/scoring.ts`** (weights, classes, evidence caps, refusals, level/rank curve) | **BUILT (Sprint 10, dormant) — canonical** | Owns XP storage/progression/milestone truth + the scoring POLICY + emits the progression facts. **Sprint-10 ownership move:** policy moved out of `lib/arena/policy.ts`/`project.ts` (they are now byte-equivalent **compatibility re-exports** of `lib/reputation/scoring.ts`) — Reputation has zero Arena dependency; **Arena consumes Reputation**, never the reverse. Human doc: `ARENA-CONTRIBUTION-POLICY.md`. The v1 arena reconcile-on-read fold (`lib/arena/project.ts` `deriveAwards`/`projectStanding`) remains the ACTIVE own-XP read path until Arena re-points to reputation projections (documented successor). Identity owns none of it. |
| **Performance Intelligence** (SOP/KPI/Health) | `PERFORMANCE-INTELLIGENCE.md` (ADR-0037), seed in `lib/missionControl.ts`/`lib/analytics` | PARTIAL/PROPOSED | Business health ≠ reputation. Separate from Identity. |
| **Entitlement Service + Reward Claim** | ADR-0038 §5 (PROPOSED); seed `lib/entitlements.ts` | ABSENT | Resolves through the PEP as an additive source; not a parallel authz. |
| **Arena** (progression presentation) | `lib/arena/*`, `app/arena` | PARTIAL (dormant) | Experience, not truth. Reads reputation; owns presentation only. |
| **Marketplace** (commerce) | — | ABSENT (PROPOSED) | Will *consume* verified identity + membership; owns commerce, never identity. |
| **Operator Network** | `lib/network/*`, `app/network` (dormant) + `/community` (LIVE forum) | PARTIAL | Two surfaces; do not conflate. Consumes identity; owns messaging. |
| **Kai** (intelligence) | `lib/kai.ts`, `lib/intelligence/*` | SHIPPED | Owns reasoning; tool-less (ADR-0005). Reads identity context; owns none of it. |
| **Knowledge Graph** | `lib/intelligence/graph.ts` | SHIPPED (index) | Kai-feed PROPOSED. |
| **Event Fabric** (transport) | `lib/eventBus/*`, `EventEnvelope` | PARTIAL (dormant) | **Transports only.** Owns the durable event spine + delivery, never the *meaning* of any event. Each context owns its own event contracts + payload semantics. |
| **Identity event stream** (facts) | `lib/identity/events.ts` (6 refs-only Security/Audit contracts) | BUILT (dormant) | Identity EMITS lifecycle facts onto the Event Fabric; owns the facts, not any downstream behavior. No fanout. |
| **Audit** | `AdminAuditLog` (admin actions); identity lifecycle → `EventEnvelope` (identity-owned); kernel `KernelAudit` (dormant) | SHIPPED | Domain-scoped: each context owns its own audit records; no single monolithic audit owner, no overlap. |
| **Billing** | `lib/stripe.ts`, `lib/billing.ts` | SHIPPED (LIVE) | Owns commerce/subscription truth. Identity never touches billing. |
| **Analytics** (telemetry) | `lib/analytics/aggregate.ts`, `lib/events.ts` (`ProductEvent`) | SHIPPED | Separate fail-open stream from the Event Fabric. |
| **Profiles (public)** | *reserved* — `lib/identity/profileMedia.ts` scope only | NOT BUILT (counsel-gated) | Identity will own the profile *projection*; rendering + media are hard-off until counsel + controls clear. |
| **Certifications** | ABSENT (issuance record → future Identity; scoring → Reputation) | ABSENT | Not built. |

## Overlap resolutions (disclosed — none is an ACTIVE dual-owner)
1. **Durable membership:** `lib/identity` is the sole canonical owner. The dead `lib/os/platform/teams.ts`/`teamStore.ts` has zero consumers and is absent from the registry — superseded; **removal is a tracked follow-up**, not a merge blocker (nothing active owns membership twice).
2. **Managed Consumer versus Membership:** Consumer-management is the sole owner of the LIVE `User.isAgency`/`managedByAgencyId` relationship. Membership is the sole owner of `OrganizationMembership`. Neither succeeds, projects, or authorizes the other. A future reconciliation classifier may compare evidence but may not mutate either domain; explicit enrollment and admission create any OperatorIdentity/Membership facts.
3. **Route namespace `identity` (disclosed collision, Architecture Freeze 1.0):** the LIVE credit-report *identity/discrepancy* feature owns `app/identity/page.tsx` + `app/api/identity/{discrepancies,letter}` (imports `lib/compliance`/`lib/bureaus`/`lib/docCrypto`) — a **different bounded context** from Operator Identity (`lib/identity/**`, which has ZERO HTTP surface). No code overlap; a naming collision only. Operator Identity must claim a **distinct route namespace** (e.g. `/operator`) at activation — never `/identity`.
4. **Event-contract registry (clarification):** contracts physically colocate in `lib/eventBus/contracts.ts`, but each is *authored and owned by its emitting context* (identity, reputation, notify…). The Event Fabric owns the **registry mechanism + transport**, never the **meaning** of any payload. Colocation is a convention, not centralized domain ownership.
5. **Kernel PEP (documented transition):** the `lib/os/kernel/pep.ts` default-deny gate is a **reserved seam**, not yet the live enforcement path — live authorization is currently `lib/session`/`lib/entitlements`/`requireAdmin`. The org RBAC map (`lib/identity/rbac.ts`) enforces nothing on its own until the PEP is wired incrementally. This is a build obligation, not a dual-owner.

## Invariants (permanent)
- Authentication is external to every domain; principal = `currentAccount().id`.
- The Event Fabric transports; domains own meaning. Identity emits facts only.
- Reputation owns trust; Arena owns presentation; Marketplace owns commerce; Kai owns intelligence; Billing owns money. Identity owns none of these — they *consume* identity.
- Authorization enforces through the PEP; role/permission maps are additive sources, never parallel engines.
- No capability has two ACTIVE owners. A migration may introduce a dormant successor; the predecessor stays the sole active owner until the gated cut-over.
