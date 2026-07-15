# ADR-0019: CreditVector Knowledge Graph — connected intelligence

Status: Accepted (orchestration only; deterministic; MAIL_LIVE stays off)
Date: 2026-07-15
Decision owners: Founder directive (Sprint XIX)

## Context
The modules became an operating system, but each still knew only itself. Sprint XIX
makes every module understand every other — a Financial Memory Graph of verified
relationships built from deterministic data. Not a database, not a graph DB, no
ML/prediction/inference. A customer must be able to click any recommendation and
trace its complete history: recommendation → campaign → letter → response →
verified outcome → readiness → roadmap.

## Decision
`lib/knowledge/` — a deterministic relationship layer over existing records:
- **`engine.ts`** — `buildGraph(rows)` is PURE. Nodes each reference a canonical,
  prefixed id (`tl:`/`cmp:`/`ltr:`/`mail:`/`resp:`/`out:`/`dec:` + the OS-layer
  nodes consumer/profile/mission/roadmap/builder/readiness). Edges
  (belongs_to/created/recommended/verified_by/resolved/improved/triggered/
  superseded/depends_on) are created ONLY when both endpoints exist — referential
  integrity, no fabricated relationships. `journeyChains()` traces each letter's
  full chain; `connectedReasons()` is Kai's cited connected reasoning (never a
  prediction); `neighbors()` for traversal.
- **`loader.ts`** — `loadGraphRows(userId)` loads ONLY link fields (ids + foreign
  keys, never bodies) in one focused, userId-scoped batch (tradelines/letters via
  prisma, campaigns via `PrismaCampaignStore`, mail via `PrismaMailStore`,
  `VerifiedOutcome`/`DecisionRegistry` via fail-open raw queries).
- **`types.ts`** / **`index.ts`** / `financialGraph(userId)` / `/api/knowledge`.
- Mission Control gains **"My Financial Journey"** (`KnowledgeJourney`): Kai's
  connected reasoning + expandable, clickable relationship chains — every node a
  real record.

## Consequences
- Nothing owns duplicated data — every node/edge references a canonical id, so the
  graph recomputes from immutable rows (append-only by construction) and stays
  consistent with the source of truth.
- **Governance intact:** the graph is strictly single-user (userId-scoped); it
  touches no cross-user aggregation, so K_ANON_MIN / consumerDisplayApproved / CCO
  gates (ADR-0010/0014) are unchanged.
- Kai now explains connected reasoning (which campaign created a dispute, which
  response verified an outcome, which readiness it advances) — all cited.
- A referential-integrity + determinism guard (`scripts/knowledge.test.ts`) proves
  no edge points at a missing node and no reason predicts. Preview only; no merge;
  MAIL_LIVE off.
