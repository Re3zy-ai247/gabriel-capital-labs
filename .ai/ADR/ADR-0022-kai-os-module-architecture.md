# ADR-0022: Kai OS Module Architecture — the module contract, capability engine, feature flags

Status: **Accepted** (founder-approved 2026-07-15). Governs the OS substrate every future
module and tier is built on. Companion: **ADR-0023 (Kai Intelligence Layer)** defines what
sits ABOVE the Capability Engine (the reasoning/orchestration brain). This ADR = "what CAN
Kai do"; ADR-0023 = "what SHOULD Kai do."
Date: 2026-07-15
Decision owners: Founder directive (AI Operating System — dispute engine is Module #1)

## Context
CreditVector is now the **AI Credit Intelligence Operating System**; Kai IS the product
(`CREDITVECTOR-OS.md` Part II). The existing engines (`lib/intelligence`, `execution`,
`knowledge`, `mission*`, `builder`, `campaign`, `outcomeLedger`) are already pure,
single-load, reuse-first units — the substrate of an OS. This ADR formalizes them into a
**Module Contract**, defines the **Capability Engine** + **Feature-Flag** substrate that
makes pricing ↔ entitlements ↔ module access structurally consistent, and sets the path to
a multi-agent Kai that presents one unified assistant. It is the keystone: no new module or
tier is buildable well until this lands.

## Decision

### 1. The Module Contract (`lib/os/module.ts` — the plug) — "wrap, don't rewrite"
Every Kai module implements ONE interface — plug-and-play, no special cases. Existing
engines are **wrapped**, not rewritten (they are valuable IP); the dispute engine becomes
the `credit` module unchanged behind the wrapper.
```ts
export interface KaiModule {
  id: string;                                   // "credit" | "funding" | ...
  name: string;                                 // "Kai Credit"
  capabilities(): CapabilityKey[];              // what this module can do (feeds the Capability Engine)
  requiredPlan(cap: CapabilityKey): PlanKey;    // entitlement gate, per capability
  requiredReasoning(cap: CapabilityKey): ReasoningTier; // deterministic | retrieval | generative
  permissions(): Permission[];                  // least-privilege reads/actions
  compliance(): ComplianceBoundary;             // regimes it touches (Article 22) — declared, not implied
  // Pure over the already-loaded shared snapshot/records — NO new DB reads.
  execute(ctx: OsContext, cap: CapabilityKey): ModuleResult;
  confidence(r: ModuleResult): Confidence;      // grounds-confidence, never an outcome (KAI-OS §5)
  explain(r: ModuleResult): Receipt;            // cited reasoning (Article 4)
  auditTrail(r: ModuleResult): AuditEntry;      // immutable "what + why" record
}
```
- `OsContext` carries the single-loaded snapshot + shared memory (Knowledge Graph, Outcome
  Ledger, case records) — modules never re-query. `execute` is pure (unit-testable, no DB),
  matching today's `assembleExecution`/`buildBuilder`.
- The **Intelligence Layer (ADR-0023)** orchestrates modules THROUGH this contract; the
  Capability Engine (below) answers whether a given capability is available/entitled.

### 2. The Capability Engine (`lib/os/capability.ts` — PROPOSED) — the keystone
One deterministic resolver, the single source of truth for access:
```ts
type CapabilityState = "available" | "coming_soon" | "not_entitled" | "unavailable";
function resolve(user: User, key: CapabilityKey): CapabilityState;
```
- Derives from the plan→capability map (below) + feature flags + module availability.
- **Everything reads this:** module gates, UI, the pricing page's "Coming soon" states, and
  Kai's tier. This is what makes `CREDITVECTOR-OS` §7 / Article 20 true *by construction* —
  a page can't advertise what the resolver won't grant.

### 3. Feature-Flag substrate (`lib/os/flags.ts` — PROPOSED)
- Deterministic flags derived from plan/capability + a static registry (no ad-hoc
  `plan === "premium"` scattered in features). Same signal drives "coming soon."
- `hasFeature(user, key)`; flags degrade gracefully off; every new capability ships flagged.

### 4. Entitlement / plan-capability map (extends `lib/entitlements.ts`)
- A single table mapping the 7 plans → `{ kaiTier, capabilities[] , clientLimit, teamSeats }`.
- Replaces scattered `isPremium`/`plan ===` checks with `resolve()`. Managed-client
  inheritance + tier upgrades resolve here. Stripe price IDs map to plans in `lib/billing`.

### 5. AI Routing & multi-agent orchestration (extends ADR-0006)
- The 8-layer router gains a **module registry**: each module's `routes()` are deterministic
  layers the router reaches before generation. Long-term, specialized module-agents are
  orchestrated behind one Kai surface — the user always sees a single Credit Intelligence
  Officer; provenance travels with every answer.

### 6. Module map (existing → OS modules)
`credit` (dispute engine + intelligence/execution/mission) · `builder` · `knowledge`
(memory) · future: `funding`, `business`, `collections`, `identity`, `mortgage`, `auto`,
`wealth`, `legal`, `compliance`. Each future module = its own ADR + compliance-boundary map
+ the 7-gate DoD (Article 23).

## Consequences
- **First build after approval:** the Capability Engine + Feature-Flag substrate + the
  plan-capability map (`lib/os/`), retrofitting the pricing page and existing entitlement
  checks to read `resolve()`. Fully tested (guards), behind flags, docs updated. This
  removes today's risk of page/entitlement drift and unblocks every future tier/module.
- Existing engines are **wrapped, not rewritten** — the Module Contract is additive.
- No user-facing behavior change in the first substrate sprint (pure refactor to the single
  source of truth) — safest possible foundation. Preview-first; MAIL_LIVE OFF.

## Alternatives considered
- *Keep ad-hoc entitlement checks per feature* — rejected: guarantees eventual page↔config
  drift (a UDAAP risk) and doesn't scale to 10 modules.
- *One monolithic "Kai service"* — rejected: violates loose coupling / extractability
  (Article 15); a module must be able to become its own product.
