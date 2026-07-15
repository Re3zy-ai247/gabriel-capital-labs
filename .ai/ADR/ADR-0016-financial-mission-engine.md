# ADR-0016: Financial Mission Engine — dashboard to a financial OS

Status: Accepted (orchestration only; deterministic; MAIL_LIVE stays off)
Date: 2026-07-14
Decision owners: Founder directive (Sprint XVI)

## Context
Sprint XV gave CreditVector one canonical Intelligence API (CVI). The next
evolution is not another intelligence engine — it's an ORCHESTRATION engine that
turns Mission Control from a dashboard into a Financial Operating System: the
customer should never ask "what should I do next?" — it answers automatically.

## Decision
`lib/missionEngine/` — pure orchestration over what CVI + Mission Control already
computed; no new scoring, no AI, no fabricated dates.
- **`engine.ts`** — `assembleMissions(intel, mc)` is PURE. It maps CVI's
  `opportunities` (round2 / overdue / obsolete / validation / campaign / address /
  builder) into ranked **Missions**, adds a CFPB-escalation mission when a window
  is overdue and an honest **locked** Business-Credit mission, and turns Mission
  Control's structured §611 windows into **waiting** missions (with real progress).
  It computes deterministic priority/band/state, a **timeline** (only from existing
  windows, +15d method-of-verification offset — no invented dates), factual
  **rewards** (completed investigations, favorable-change rate, score delta — never
  points/badges/streaks), a **completed** projection over the real event history,
  and a mission-completion **progress** summary.
- **`types.ts`** — Mission (+ 9 states: locked/available/waiting/blocked/in_progress/
  needs_review/completed/deferred/expired), timeline, rewards, progress, the
  `FinancialMission` response.
- **`api.ts`** — `financialMission(userId, user)`; `/api/mission` (userId-scoped).
  On the dashboard we call `assembleMissions` directly with the already-loaded
  `intel` + Mission Control `data` — **zero extra queries**.
- Mission Control CONSUMES it: `MissionQueue` renders the Priority Queue, Mission
  Timeline, Mission Progress, factual Rewards, and Completed history.

## Consequences
- One prioritized queue answers what needs attention / what's waiting / what's
  automatic / what unlocks next / how close you are — no new intelligence, no
  duplicated calculation (every field derives from CVI or Mission Control).
- **No gamification:** rewards are factual progress; a determinism + CROA/FTC +
  gamification guard (`scripts/missionEngine.test.ts`) enforces it.
- **Future-ready:** Credit Builder, Funding Hub, Business Credit, Monitoring,
  Mobile, and the public API all plug into `financialMission`.
- Known follow-up (token-disciplined): fold Mission Control's own Today's-Mission
  task list into the engine queue so the two don't overlap. Preview only; no merge;
  MAIL_LIVE off.
