# ADR-0039: CreditVector Growth Network dormant foundation

Status: **PROPOSED — DORMANT FOUNDATION IMPLEMENTED FOR REVIEW (founder directive 2026-07-31); all economic policy values and activation unratified**
Date: 2026-07-31
Decision owners: Founder (mission, principles, two paths, monthly day 15, explicit exclusions) · Chief Architect (frozen-platform reconciliation)
Derives from: [`GIOS-PLATFORM.md`](../GIOS-PLATFORM.md) · [`ADR-0034`](ADR-0034-gios-platform-freeze.md) · [`ADR-0037`](ADR-0037-operator-growth-constitution.md) · [`ADR-0038`](ADR-0038-professional-growth-economy.md) · [`ARCHITECTURE-FREEZE-1.0.md`](../ARCHITECTURE-FREEZE-1.0.md)
Detailed authority: [`GROWTH_NETWORK_FOUNDATION.md`](../../GROWTH_NETWORK_FOUNDATION.md) · [`GROWTH_NETWORK_ARCHITECTURE.md`](../../GROWTH_NETWORK_ARCHITECTURE.md) · [`GROWTH_NETWORK_PRODUCT_SPEC.md`](../../GROWTH_NETWORK_PRODUCT_SPEC.md) · [`GROWTH_NETWORK_ROADMAP.md`](../../GROWTH_NETWORK_ROADMAP.md)  
Phase 0.5 advisory package (**UNRATIFIED**): [`FOUNDER_ECONOMIC_DECISION_PACKAGE.md`](../../FOUNDER_ECONOMIC_DECISION_PACKAGE.md) · [`GROWTH_NETWORK_CONSTITUTION.md`](../../GROWTH_NETWORK_CONSTITUTION.md) · [`BUSINESS_MODEL_OPTIONS.md`](../../BUSINESS_MODEL_OPTIONS.md) · [`DECISION_MATRIX.md`](../../DECISION_MATRIX.md)

> Phase 0.5 package status (2026-07-31): decision architecture is prepared for Founder ratification. It recommends an unpaid Agency stewardship qualification shadow and B2B operator professional-development mentoring followed by instructor-led B2B operator education/training/speaking as direct-value research candidates. `DECISION_MATRIX.md` is the sole ratification record. It changes none of this ADR’s dormant boundaries and authorizes no design execution, schema, runtime, participant program, obligation, billing, provider, tax, or money movement.

## Context

The Founder directed a new CreditVector Growth Network (CGn): the platform’s economic layer for Agency Builders and Professional Operators. It must reward successful organizations, education, mentorship, verified contribution, retention quality, and ecosystem health—not recruiting or popularity. Agency Growth Distribution is scheduled for the 15th; no other revenue-stream cadence is ratified.

The frozen platform already assigns canonical owners for Identity/Organizations/Membership, Reputation, Performance Intelligence, Entitlements/Reward Claims, Event Fabric, Billing, Analytics, Kai, and future Marketplace commerce. A safe CGn foundation must extend those seams without becoming a second source of truth or touching live money.

## Decision

1. Establish CGn as CreditVector L4 domain contexts with L5 orchestration and future L6 experiences. GIOS/Kai L0–L3 remain unchanged.
2. Accept two composable paths: `AGENCY_BUILDER` and `PROFESSIONAL_OPERATOR`.
3. Ratify the Founder’s seven principles and Agency Growth Distribution day 15. Foundation date vocabulary accepts an explicit distribution month and never infers it from an observation cycle. All qualification windows, factors, formulas, amounts, rates, caps, reserves, tax rules, provider mechanics, and activation remain unratified.
4. Reconcile “Growth Reputation” as a private, purpose-bound, rebuildable projection over canonical Reputation and Performance Intelligence/source evidence. It creates no second ledger, scalar score, XP, public rating, leaderboard, or cash conversion.
5. Record the current proposed compliance reconciliation: verified active status is only an admissibility condition on an operator’s own evidence during the relevant window. Operator count/addition, recruitment, invitations, signups, participant purchases/subscriptions, paid retention, downstream depth, and credit outcomes may not unlock eligibility or affect allocation. Founder/counsel must ratify this mechanism or an equally non-recruiting alternative at Phase 0.5.
6. Reserve bounded contexts for Growth Policy/Qualification, Revenue Attribution, Growth Distribution with an append-only Economic Ledger module, Economic Integrity/Appeals, Payee Compliance/Tax Readiness, and source-specific revenue adapters. Growth projections/experiences own no truth. Team Operations is an experience concept only: existing owners remain intact and unresolved non-agency work ownership requires an ADR before schema.
7. The first implementation slice is schema-free and contract-only: `lib/growthNetwork/{foundation,flags,index}.ts` plus a DB-less guard. It has no runtime consumers and no production effects.
8. `GROWTH_NETWORK_ENABLED` is fail-closed and exact-string. Payout execution is hard-coded false with no environment override.
9. The foundation registers no Event Fabric contract or recorder. An authoritative source must exist before an event. Event Fabric remains transport, not a monetary queue.
10. No code/schema/event/API/UI/job/provider/tax/billing/payout or protected-surface change is authorized beyond the contract-only slice.
11. The user-requested “Chief Executive Intelligence Officer” phrase is a CGn functional framing only. `KAI-OS.md` remains the global Kai title/identity authority until a separately approved amendment.

## Alternatives considered

### A. One Growth Network monolith

Rejected. It would combine identity, reputation, attribution, qualification, commerce, accounting, risk, tax, collaboration, and AI into a high-coupling source of truth.

### B. Extend Billing/Stripe as the Growth ledger

Rejected. Subscription billing is live customer-charge truth. Growth obligations, reversals, tax readiness, and future provider settlement have different actors, controls, and legal/accounting semantics. The foundation has a no-import boundary.

### C. Create a new Growth Reputation score/ledger

Rejected. `lib/reputation/**` is the canonical trust owner and Performance Intelligence owns health/retention/improvement. A new score would violate one-owner law, invite double awards, and create opaque cash coupling.

### D. Reuse Arena, Community, Mission Control, Agency Command, or CXOS rooms

Rejected for this stream. These are presentation/operating surfaces with separate owners and explicit exclusions. CGn defines future read models/interfaces without modifying them.

### E. Register speculative Growth events now

Rejected. Current Event Fabric contracts are sticky; there is no authoritative Growth store/producer, and the envelope’s legacy `agencyId` cannot safely stand in for generic Organization scope.

### F. Implement a configurable payout flag/provider stub

Rejected. A configurable effect seam creates accidental activation risk without legal, tax, accounting, schema, or provider decisions. Execution remains unconditionally false.

## Consequences

### Positive

- CGn can evolve across multiple revenue streams without rewriting the frozen platform.
- Recruiting, popularity, XP/cash conversion, and AI authority are refused structurally.
- The code seam is inert, reversible, and testable.
- Economic qualification, obligation, settlement, and reporting remain honest, explainable states.
- Agency Builder and Professional Operator are equal product paths rather than a hierarchy.

### Cost / limitation

- No visible product or economic behavior ships from this slice.
- Organization-scoped Event Fabric authorization, Identity activation, source evidence owners, Entitlements, compliance/tax/accounting decisions, and shadow operations must precede live value.
- Some product names remain provisional because no public surface exists.

## Security implications

- Foundation introduces no persistence, route, background task, network call, secret, provider, or PII.
- Exact-string master flag and permanently false payout sentinel fail closed.
- Public barrel is pure/client-safe and does not export the environment-reading flag.
- Guard rejects billing/Stripe, Prisma/schema/DDL, Event Fabric write path, Reputation repository, protected-surface, provider, network, and monetary-policy dependencies.
- Future phases require Organization-aware tenant isolation, PEP, refs-only events, encryption, maker-checker, step-up auth, immutable audit, reconciliation, and incident/rollback exercises.

## Compliance implications

- Dormant foundation is `GO-WITH-CHANGES`; live economics is `NO-GO` pending specialist review.
- No recruitment/headcount/purchase/subscription/paid-retention/downstream/credit-outcome compensation.
- No required payment to earn and no earnings/lifestyle/credit-outcome claims.
- Affiliate disclosure requires training, monitoring, and remediation; one-level attribution is a compliance proposal pending Founder/counsel decision.
- Tax thresholds/forms depend on tax year, payer/payee/rail/stream/jurisdiction; no values are hardcoded.
- W-9/TIN data is future Tax-context data and may not feed Sybil/fraud/reputation/analytics/Kai.
- Worker classification, CROA/TSR/CFPA, FTC/state compensation/business-opportunity, privacy/Safeguards, money transmission/custody, tax, and accounting require documented approval before activation.

## Migration or rollback plan

No migration exists. Phase 0 rollback is deletion of the new contract package, guard, eight foundation report artifacts, and routing records. Phase 0.5 advisory rollback is deletion of its nine local decision artifacts and their routing links. No persisted state, production flag, consumer, event, or external system must be reversed.

Any future schema follows migration-first with reviewed preflight, forward validation, rollback plan, deliberate release application, and schema readiness verification. Runtime schema creation and build-time database mutation are prohibited.

## Evidence

- Frozen ownership and layer laws: `GIOS-PLATFORM.md`, `PLATFORM-OWNERSHIP-MAP.md`, ADR-0034.
- Reputation/economy law: ADR-0037, ADR-0038, `VECTOR-XP.md`, `CREDITVECTOR-ECONOMY.md`, `PERFORMANCE-INTELLIGENCE.md`.
- Identity and event law: `IDENTITY-CONSTITUTION.md`, ADR-0035, ADR-0036, current `lib/identity/**`, `lib/eventBus/**`, `lib/reputation/**`.
- Federal primary sources are linked in the Growth Network foundation/architecture compliance sections.
- Validation evidence is recorded in `GROWTH_NETWORK_FOUNDATION.md` after execution.

## Explicitly unratified and owner-gated

Qualification/verification windows · eligible evidence values · allocation pool/formula/weights/caps/reserves/minimums/rounding/currency · weekend/holiday settlement · payor/payee model · tax/forms/withholding · worker classification · jurisdictions · participant terms · Marketplace/Learning/Mentorship contracts · fraud thresholds/sanctions · Team Operations records · public reputation/earnings surfaces · event/schema implementation · provider selection · payout execution · production activation.
