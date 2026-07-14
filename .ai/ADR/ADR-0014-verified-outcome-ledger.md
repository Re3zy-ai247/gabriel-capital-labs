# ADR-0014: Verified Outcome Ledger — closing the compounding loop

Status: Accepted (deterministic; own-data gate-free, cross-user consent+k-anon+CCO-gated)
Date: 2026-07-14
Decision owners: Founder directive (Sprint XIV — Credit OS evolution)

## Context
The engines existed but the compounding loop was open: Kai recommends (Decision
Registry records it), campaigns strategize, Mail queues, responses get logged —
but a verified outcome never flowed back to sharpen the next recommendation, and
nothing linked recommendation → outcome into one auditable, learnable record.
The directive's moat is "millions of verified dispute outcomes." Closing the loop
is pure orchestration of existing engines, not a new one.

## Decision
`lib/outcomeLedger.ts` — a `VerifiedOutcome` self-heal table (ADR-0001), keyed by
`letterId` so an outcome is recorded once (upsert; never double-counted). Each row
links the dispute (strategy·recipient·bureau·round·accountType) AND the
recommendation that produced it (`decisionId`, resolved from the Decision
Registry) to the outcome + latency, with provenance (`verifiedAt`, `source`).
- **Write:** `recordVerifiedOutcome` fires at response-log (`/api/letters/[id]/
  response`), fail-open. A one-time idempotent backfill seeds historical
  responded letters (`ON CONFLICT DO NOTHING`).
- **Own-data feedback (gate-free):** `ownOutcomeTrack(userId)` + `ownHistorySummary`
  surface the user's OWN verified track record in Mission Control's Command Center
  ("Your history") — their own data, no consent/k-anon needed, framed as history
  not prediction (CROA; ≥3-response threshold, mirroring `lib/forecast`).
- **Cross-user (unchanged gates):** `ledgerCorpus` yields ONLY consenting users'
  rows (`consentingUserIds`), identifier-stripped — `userId` → a salted, non-
  reversible HMAC key used solely for downstream distinct-contributor k-anonymity
  (`outcomeStats`, K_ANON_MIN=20). Consumer display stays CCO-gated (ADR-0010).
- The append-only CHANGE history remains in the KaiEvent stream + `Letter.responseAt`;
  this table is the current verified state per dispute (the aggregation source).

## Consequences
- The loop compounds: every logged response sharpens the user's own confidence
  immediately, and the shared corpus once the CCO gate opens — Campaign
  strategizes better, Kai explains with evidence, Forecast/Timeline predict better.
- Decision Registry (proves the recommendation) + Verified Outcome Ledger (proves
  the outcome) now form the end-to-end verified pair — the substrate for a future
  Credit Intelligence API / Verified Outcome Ledger product.
- Reuse over new engine: outcome vocabulary, consent surface, k-anon, and
  aggregation shape all reuse Engine 1; no duplication.
- Pure helpers (`computeOwnTrack`/`ownTrackLine`/`ownHistorySummary`/
  `toOutcomeRecord`) are guard-tested (`scripts/outcomeLedger.test.ts`); DB writes
  fail-open. MAIL_LIVE stays off. Stacked on the Sprint XII/XIII branch.
