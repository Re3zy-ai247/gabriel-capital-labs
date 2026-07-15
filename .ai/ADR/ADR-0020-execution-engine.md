# ADR-0020: CreditVector Execution Engine — the Executive Queue

Status: Accepted (orchestration only; deterministic; MAIL_LIVE stays off; preview-only, unmerged)
Date: 2026-07-15
Decision owners: Founder directive (Sprint XX)

## Context
The operating system tells the user WHAT exists (Intelligence, Mission Control,
Roadmap, Builder, Knowledge Graph) and WHAT to do next per module. Sprint XX unifies
that into one executive answer: every login answers "what should I do today, what's
waiting on me, what happens if I do nothing, which action has the highest-impact
unlock, what's blocked, what depends on what?" — as ONE prioritized queue, not
scattered recommendations. No AI, no predictions, no fabricated priorities/timelines.

## Decision
`lib/execution/` — a PURE orchestration layer that consumes ONLY what the existing
engines already produced; it computes no new intelligence, runs no new query, and
duplicates no business logic. Every execution item maps 1:1 from a mission the
Mission Engine already ranked and stated; this engine enriches and files it.

- **`ExecutionEngine.ts`** — the `ExecutionItem`/`ExecutionResult` types + the PURE
  `assembleExecution(inputs)` (no DB) that composes the already-loaded
  `CreditIntelligence` / `FinancialMission` / `FinancialRoadmap` / `BuilderOS` /
  `FinancialKnowledge` / `MissionControlData` / `IntelSnapshot`. Each item carries
  title, why, required action, expected outcome, dependencies, effort, timeline,
  evidence, status, blocking reason, priority, and **citations** to
  Mission/Ledger/Campaign/Roadmap/Builder/Knowledge Graph. The `mission` citation is
  always present, so **no recommendation is ever uncited**; the rest attach only when
  they genuinely pertain (Knowledge-Graph chain matched by href — never loosely
  attached, never faked).
- **`ExecutionPriority.ts`** — the deterministic priority LADDER in the founder's
  fixed order (legal deadline → open investigation → waiting bureau/consumer/creditor
  → campaign/funding/builder/mortgage/business/timeline/outcome dependency).
  First-match classification by `mission.type`; the Mission Engine's own
  `mission.priority` is used ONLY as a tie-break within a rung. **Never re-scored.**
- **`ExecutionQueue.ts`** — the five buckets (DO_NOW / WAITING / BLOCKED / OPTIONAL /
  COMPLETED), partitioned purely by `mission.state`; stable ordering with a unique-id
  final tiebreak.
- **`ExecutionTimeline.ts`** — reuses `mission.deadline` (already §611-window-derived)
  or a state-derived label; **no fabricated dates**. Case timeline = the Mission
  Engine's, verbatim.
- **`ExecutionDependencies.ts`** — the fixed §611 lifecycle order (address → approve →
  mail → wait → review → escalate); reuses `mission.dependency` as the authoritative
  blocking reason.
- **`ExecutionRewards.ts`** — expected unlock from `mission.unlocks` / Builder
  `expectedImprovement` / Roadmap next stage; the "highest-impact unlock" (NOT a score
  prediction — CROA). Factual only.
- **`ExecutionRisk.ts`** — the factual cost of inaction per item + a case-level risk
  line counted from REAL open/overdue windows on the snapshot. **Never a prediction,
  never fear-based.**
- **`index.ts`** — `executionEngine(userId, user)` is the thin standalone loader that
  REUSES the existing loaders only (dashboard's exact single-load) and adds ZERO new
  database calls. `/api/execution` (GET, user-scoped) mirrors `/api/mission`.
- **`components/mission/ExecutiveQueue.tsx`** — presentational; renders the five
  buckets + the three head tiles (do-first / highest-impact unlock / if-you-do-nothing).
  Cards expand (native `<details>`, no client JS) into Kai's reasoning, evidence, the
  Knowledge-Graph chain, dependencies, the expected unlock, the cost of inaction, and
  every citation. Wired into `/dashboard` off the already-loaded engines (no new load).

## Reviews (five-review gate — all PASSED)
- **Architecture** — reuse-only; grep confirms zero `prisma`/`findMany`/`fetch` in
  `lib/execution`; imports are the six existing engine loaders + type-only imports.
- **Legal (CCO / compliance-review)** — GO. No AI, no free-text generation → the
  `lib/compliance.ts` scrubber is N/A (it gates AI/letter surfaces). The word "score"
  appears in NO user-facing string ("biggest score improvement" reframed to
  "highest-impact unlock"). Zero CROA red-flag terms. Two LOW hygiene notes only.
- **Privacy** — no logging, no external calls, no PII in URLs; read-only.
- **Accessibility** — native `<details>`/`<summary>` (keyboard-native), `aria-label`,
  `sr-only` priority, WebKit marker hidden.
- **Adversarial / Determinism** — no `Date.now`/`Math.random`/`new Date`; total-order
  sort with unique-id tiebreak; guard proves byte-identical output for identical input.

## Validation
`tsc --noEmit` clean · `next build` clean (`/api/execution` ƒ, `/dashboard` compiled)
· `scripts/execution.test.ts` 15/15 green (buckets, ladder order, no-uncited-item,
overdue→legal_deadline@rank 0, no-report path, reproducibility).

## Consequences
- One Executive Queue becomes the primary dashboard surface; the per-module views
  (MissionQueue/Roadmap/Builder/Knowledge/Command) remain below it as drill-downs.
  Whether to fully retire them into the queue is a follow-up product decision (logged
  in TASKS) — this sprint AUGMENTS rather than deletes (small, reversible).
- Preview-only. Not merged, not pushed to production. MAIL_LIVE stays OFF.
