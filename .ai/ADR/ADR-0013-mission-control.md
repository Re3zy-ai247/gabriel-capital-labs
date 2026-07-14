# ADR-0013: Mission Control — the deterministic operating dashboard

Status: Accepted (orchestration only; no new engine; MAIL_LIVE stays off)
Date: 2026-07-14
Decision owners: Founder directive (Sprint XIII)

## Context
The engines exist — Campaign (ADR-0012), Mail (ADR-0011), Intelligence
(ADR-0010), Timeline, Case Memory, Kai Home. What was missing is the layer that
tells the customer **what to do every day**. The directive: build "Mission
Control" as the first screen after login, answering four questions — what should
I do today, what am I waiting on, what's happening automatically, what happens
next — entirely from deterministic data. No AI, no fabricated timelines, no
estimated deletions, no fake probabilities. Orchestrate the existing engines;
do not add or duplicate one.

## Decision
A thin orchestration layer, not a new engine:
- **`lib/missionControl.ts`** — `assembleMission(inputs)` is a **pure** function
  (guard-tested, no DB) that composes already-loaded rows into the dashboard view
  model: Today's Mission (the checklist), Waiting On, Happening Automatically,
  Kai's Next Action (single, deterministic, with its receipt), Campaign Capacity,
  Deferred Queue (why deferred / what unlocks / est. review date / dependency),
  the 8-section Command Center, and a 5-signal Health Dashboard (Campaign / Mail /
  Response / Timeline + Case roll-up). `getMissionControl` is the thin loader that
  feeds it real rows. It REUSES `getKaiHomeData`, `caseMemorySince`, the Campaign
  service/composer/policy, and the §611 clock — it re-implements none of them.
- **`components/mission/MissionControl.tsx` + `CommandCenter.tsx`** — presentational
  server components over that view model. Nothing static; everything deep-links.
- **`/dashboard`** (the post-login landing) now renders Mission Control. The old
  Kai Home cards are subsumed (greeting + Case Memory reused; the deadline radar,
  quick wins, and stat cards fold into the Mission Card + Command Center). Sidebar
  label "Kai Home" → "Mission Control".

## Consequences
- One screen answers "what happened / what matters / what to do / what's next"
  without the customer reading a dispute letter — the directive's success metric.
- Campaign Capacity Intelligence surfaces here as **operational guidance** (never a
  legal claim): recommended size + reasons + auto-staged remainder, with "you can
  always send more."
- The Deferred Queue replaces mental spreadsheets — items stage automatically with
  their unlock condition and (for active-investigation deferrals) an est. review
  date derived from the real §611 window; no fabricated dates.
- Pure/loader seam keeps the whole composition unit-testable (`scripts/
  missionControl.test.ts`, 28 assertions) despite being DB-fed in production.
- Zero new engine, zero AI, zero provider traffic. Builds on the Campaign engine,
  so it ships stacked on the Sprint XII branch.
