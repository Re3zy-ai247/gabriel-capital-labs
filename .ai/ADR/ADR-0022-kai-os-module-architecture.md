# ADR-0022: Kai OS Module Architecture — the module contract, capability engine, feature flags

Status: **PROPOSED** (awaits founder approval; no code until approved). Governs the OS
substrate that every future module and tier is built on.
Date: 2026-07-15
Decision owners: Founder directive (AI Credit Intelligence OS pivot)

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

### 1. The Module Contract (`lib/os/module.ts` — PROPOSED)
Every Kai module implements one interface. First-class, loosely coupled, extractable.
```ts
export interface KaiModule<Out> {
  id: string;                         // "credit" | "funding" | "business" | ...
  kaiTierRequired: KaiTier;           // Lite | Professional | Pro | Agency | Enterprise
  capability: CapabilityKey;          // the flag/entitlement key this module gates on
  compliance: ComplianceBoundary;     // regimes it touches (Article 22) — declared, not implied
  // Pure over the already-loaded shared snapshot/records — NO new DB reads.
  assemble(ctx: OsContext): Out;      // deterministic module output
  // What Kai's router can reach without spending a token (Article 19).
  routes(out: Out): RoutableAnswer[];
}
```
- `OsContext` carries the single-loaded snapshot + shared memory (Knowledge Graph, Outcome
  Ledger, case records) — modules never re-query. The dispute engine becomes `credit` module.
- `assemble` is pure (unit-testable, no DB), matching today's `assembleExecution`/`buildBuilder`.

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
