# ADR-0023: Kai Intelligence Layer — the reasoning brain above the Capability Engine

Status: **PROPOSED** (awaits founder approval; no code until approved). Companion to
**ADR-0022 (Kai OS Module Architecture)**.
Date: 2026-07-15
Decision owners: Founder directive (AI Operating System — Kai Intelligence Layer)

## Context
ADR-0022 gives Kai its **body**: modules (the plug), the Capability Engine ("what CAN
Kai do"), feature flags, entitlements. This ADR gives Kai its **brain**: the Intelligence
Layer that decides **"what SHOULD Kai do"** — it observes, understands, plans, reasons,
recommends, and acts only when appropriate. The two are deliberately separate
responsibilities. **Deterministic until reasoning is necessary; AI is always the final
layer** — reasoning is expensive and can't be cited, so we exhaust deterministic paths
first.

## Decision

### 1. Responsibilities (the Intelligence Layer owns)
Intent detection · opportunity detection · cross-module collaboration · confidence scoring
· human escalation · long-term learning · multi-agent orchestration · audit logging ·
memory utilization · recommendation prioritization · autonomous planning ·
**compliance-aware reasoning**. It orchestrates modules through the ADR-0022 contract; it
computes no module intelligence itself.

### 2. The routing order (mandatory; AI is the last resort)
Every request flows through this pipeline and **short-circuits at the first confident,
compliant, cited answer**:
```
Request → Policy → Capability Engine → Feature Flags → Compliance → Knowledge Graph
        → Memory → Deterministic Engines (module.execute) → Specialized Officer
        → Reasoning Model → Audit Trail → Response
```
- **Policy/Capability/Flags/Compliance gate first** — if the user can't do it, isn't
  entitled, or compliance forbids it, we never reason about it (cheap + safe).
- **Knowledge Graph + Memory** supply grounded context (the shared memory, ADR-0016 area).
- **Deterministic engines answer before any model runs** (the existing Execution/Mission/
  Builder/Intelligence engines via `module.execute`). This is where ~90% of answers resolve.
- **Specialized Officer → Reasoning Model** only when deterministic layers miss the
  confidence threshold (the ADR-0006 8-layer pipeline, generalized across modules).
- **Audit Trail** records what fired, why, with what confidence and provenance — always.

### 3. The Opportunity Engine (proactive, deterministic)
A component that continuously scans the loaded snapshot/records for value **without a user
prompt** — utilization, collections, inquiries, business ownership, mortgage/funding
readiness, debt-payoff, etc. It is **deterministic** (rules over real data, no model spend)
and generalizes what Mission Control / the Execution Engine already do for the credit
module, across all modules. Kai surfaces an opportunity **only if all four hold**:
1. the user **has the capability** (Capability Engine),
2. **compliance allows it** (the module's boundary + CCO rules),
3. **confidence exceeds threshold** (grounds-confidence, never outcome), and
4. the recommendation is **explainable** (carries its receipt).
This is how Kai evolves from a chatbot into a proactive executive assistant — still never
promising outcomes, still user-approves-then-we-execute (KAI-OS §8).

### 4. Agent architecture — Kai operates like a company
The user interacts with **ONE Kai**. Behind the scenes, **Kai (CEO)** orchestrates
specialized officers, each wrapping a module:
```
Kai (CEO / orchestrator, the single unified assistant)
├── Credit Intelligence Officer      (credit module — LIVE, wraps the dispute engine)
├── Funding Intelligence Officer     (future)
├── Compliance Officer               (cross-cutting; enforces boundaries)
├── Business Intelligence Officer    (future)
├── Identity Officer                 (future)
├── Mortgage Officer                 (future)
├── Wealth Officer                   (future)
├── Research Officer                 (future)
├── Automation Officer               (future)
└── Document Intelligence Officer    (future)
```
Each officer owns its **prompts · tools · memory scope · permissions · confidence model ·
compliance boundary** (ADR-0022 contract). The user never addresses an officer directly;
Kai routes, collaborates across officers, and returns one voice with provenance. The
**Compliance Officer** is special: it can veto any recommendation before it reaches the user.

### 5. Compliance-aware reasoning, escalation, learning
- **Compliance-aware:** every officer declares its regime boundary (Article 22 — Legal/UPL,
  Wealth/SEC, Mortgage-Auto/RESPA-TILA, Identity/GLBA); the Compliance Officer + the scrubber
  are in the loop before any user-facing output.
- **Human escalation:** when confidence is low, evidence conflicts, or a compliance boundary
  is near, Kai escalates to the user (never guesses) and, where required, to human review.
- **Learning:** improves via the Verified Outcome Ledger + Decision Registry (own-history +
  consented k-anon aggregates, ADR-0010/0014) — never self-modifying, never cross-user leak.
- **Audit logging:** every material decision writes an immutable, explainable record.

## Consequences & build order (each step = the 7-gate DoD, Constitution Article 23)
1. **Capability Engine** + **Feature-Flag substrate** + plan-capability map (ADR-0022;
   approved) — the foundation; pure refactor to the single source of truth, no UX change.
2. **Opportunity Engine** — deterministic cross-module scanner (generalizes Execution/Mission).
3. **Agent Orchestration** — the CEO→officers router (wraps the ADR-0006 pipeline).
4. **Retrofit the Kai Credit Module** onto the contract — wrap the existing dispute/
   intelligence/execution engines; **keep all functionality intact** while migrating behind
   interfaces (no behavior change, guard-verified).
Existing engines are wrapped, not rewritten. Preview-first; MAIL_LIVE OFF. Optimize for
elegance, composability, governance, explainability, compliance, extensibility — a platform
that still makes sense in ten years.

## Alternatives considered
- *Fold reasoning into the Capability Engine* — rejected: conflates "can" with "should";
  the two must evolve independently.
- *One monolithic prompt/agent* — rejected: no per-officer compliance boundaries, no
  extractability, no auditable routing (Article 15 / 19 / 22).
