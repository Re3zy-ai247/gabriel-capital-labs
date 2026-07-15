# ADR-0017: Financial Roadmap Engine — today's mission to the full journey

Status: Accepted (orchestration only; deterministic; MAIL_LIVE stays off)
Date: 2026-07-14
Decision owners: Founder directive (Sprint XVII)

## Context
Mission Control answered "what should I do today?" (Sprint XVI). It must now also
answer "where is my credit journey heading?" — a deterministic roadmap from today
through future milestones. No new intelligence, no predictive AI, no fabricated
dates — pure orchestration of what CVI + the Mission Engine + Mission Control
already computed.

## Decision
`lib/roadmap/` — pure orchestration:
- **`engine.ts`** — `buildRoadmap(intel, mission, mc)` is PURE. It sequences the
  case into 12 journey **stages** (current state · current campaign · mail queue ·
  waiting · responses · verified outcomes · utilization · credit builder · funding
  readiness · business credit · mortgage readiness · long-term monitoring), each
  with a deterministic **status** (completed/current/active/waiting/upcoming/
  locked/unavailable), a summary, milestones, and evidence — all derived from
  CVI's profile/readiness/opportunities + the Mission Engine queue + Mission
  Control windows/scores. `progressPct` = share of assessable stages underway.
- **`types.ts`** — Stage/status/milestone types + `FinancialRoadmap`.
- **`api.ts`** — `financialRoadmap(userId, user)`; `/api/roadmap` (userId-scoped).
  On the dashboard we call `buildRoadmap` directly with the already-loaded
  intel/mission/mc — **zero extra queries**.
- Mission Control CONSUMES it: `RoadmapView` renders the journey (spine + stages).

## Consequences
- The customer sees their whole arc, not just today — with honest states:
  **utilization = "unavailable"** (no credit limits in the parsed report),
  **business credit = "locked"** future module, readiness stages explicitly **not
  a lending decision**, verified-outcomes framed as **history not prediction**.
- No new calculation: every stage reads CVI/Mission Engine/Mission Control output.
- A determinism + CROA/FTC guard (`scripts/roadmap.test.ts`) enforces no
  fabricated/guaranteed strings.
- Future-ready: Credit Builder / Funding Hub / Business Credit / Monitoring /
  Mobile / API consume `financialRoadmap`. Preview only; no merge; MAIL_LIVE off.
