# ADR-0015: Credit Intelligence Platform (CVI) — engines to a platform

Status: Accepted (orchestration only; deterministic; MAIL_LIVE stays off)
Date: 2026-07-14
Decision owners: Founder directive (Sprint XV)

## Context
Sprint XIV closed the verified-outcome flywheel; CreditVector is now an
intelligence platform, not a bag of features. The next evolution: extract every
intelligence capability behind ONE internal platform API so future products
(Funding Hub, Credit Builder, Business Credit, Monitoring, Mobile, a public AI
API) never compute their own intelligence — they ask the platform once. No new
scoring, no rewrites, no duplicated logic.

## Decision
`lib/intelligence/` — the canonical intelligence layer, orchestration only:
- **`snapshot.ts`** — `loadSnapshot(userId)` reads the user's case ONCE and derives
  base facts, reusing the existing engines (Outcome Ledger, the §611 clock, Kai
  events, scoring/account data). Every module is PURE over this snapshot, so no
  calculation is ever duplicated.
- **`modules.ts`** — the nine modules as pure functions: Credit Profile, Credit
  Health, Risk Analysis, Opportunity Engine, Timeline Intelligence, a parameterized
  **Readiness engine** (mortgage/auto/personal/credit-card/rental/employment +
  business), Builder Intelligence, Business Readiness.
- **`types.ts`** — the shared envelope every module returns (summary · metrics ·
  reasons · recommendedActions · confidence · history · nextSteps).
- **`api.ts`** — `assembleIntelligence(snapshot)` (pure, guard-tested) +
  `creditIntelligence(userId)` (loads once). `app/api/intelligence/route.ts`
  exposes it, userId-scoped.
- Mission Control CONSUMES the platform: the dashboard renders a platform-computed
  `ReadinessStrip` — it computes nothing itself, the pattern every future module
  follows.

## Consequences
- **Honesty over fabrication:** the parsed report carries no credit limits, so
  utilization + detailed payment history are disclosed "Not tracked"; absent data
  → `confidence: "insufficient"`; business readiness is an honest scaffold (no
  external connections, nothing inferred). No fabricated numbers, no approval odds.
- **CROA/FTC:** readiness = whether the file is in shape for a goal, explicitly
  NOT a lending decision or approval prediction; a determinism + forbidden-phrase
  guard (`scripts/intelligence-platform.test.ts`) enforces it.
- **Compounds:** every module gets thinner over time; the platform gets thicker.
  Own verified-outcome history (ADR-0014) flows through as the `history` line.
- **Known follow-up (token-disciplined):** the dashboard currently loads Mission
  Control AND the platform snapshot (overlapping reads); unify Mission Control onto
  the platform snapshot next so it too gets thinner. Preview only; MAIL_LIVE off.
