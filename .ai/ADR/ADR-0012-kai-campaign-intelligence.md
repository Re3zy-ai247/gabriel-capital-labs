# ADR-0012: Kai Campaign Intelligence — focused dispute sequencing

Status: Accepted (deterministic; MAIL_LIVE stays off)
Date: 2026-07-14
Decision owners: Founder directive (Sprint XII)

## Context
A paying customer may try to dispute every negative account at once to maximize
perceived plan value. A large, repetitive, or unfocused submission can be harder
to investigate on the merits and raises avoidable frivolous-or-irrelevant risk
under FCRA §611(a)(3). But there is **no universal number** that makes a dispute
frivolous, and the product must never secretly stop a consumer from exercising
their rights or make unsupported legal claims ("five is safe", "more than five is
frivolous", "the bureau will reject this"). The directive: transform bulk
selection into an understandable, evidence-based **campaign** — guide, warn, and
sequence, never guarantee outcomes or silently block.

Reality audit (verified): letters are generated one tradeline at a time (bureau
strategies fan out per selected CRA); there is **no cross-tradeline bulk action**
and **no grouping object**. The true bypass surface is the mail confirm route,
which queues each manifest independently with nothing tying it to a coherent plan.
The scoring/recommendation/explainability/obsolescence/statute/forecast engines
already exist — the gap is a campaign boundary + a queue gate.

## Decision
A new deterministic module `lib/campaign/` (mirrors `lib/mail/` discipline: pure,
testable, provider-free) plus a queue gate:

- **`CampaignModel`** — the campaign record + a 10-state status machine
  (DRAFT/RECOMMENDED/NEEDS_REVIEW→APPROVED→ACTIVE→WAITING/RESPONSE_RECEIVED→
  COMPLETED, +CANCELED/SUPERSEDED), items (included/deferred/excluded each with a
  reason), categorized warnings (**law / policy / recommendation** — Phase 11),
  and an **immutable snapshot** frozen at approval (the gate matches against it).
- **`CampaignComposer`** — deterministic, **no AI, no hidden reasoning**. Ranks by
  evidence-of-GROUNDS (never outcome), leads with the strongest item's strategy
  **family** (bureau §611 / obsolescence §605 / furnisher §623 / collector
  §1692g), includes compatible items up to the policy's recommended max, and
  defers the rest with reasons + next-unlock conditions. Excludes NOT_RECOMMENDED/
  government; defers items with an **active investigation** (no duplicate
  reinvestigation) or already in flight. `reviewSelection()` produces the Strategy
  Review for a custom/expanded selection (conflicts, families, weak items,
  recommended split, projected sequence). An **expanded override is always
  available** (never a silent block), capped only at the technical ceiling.
- **`CampaignPolicy`** — **operational, not legal**. Conservative configurable
  defaults (recommendedMax 5, warn 6, hard ceiling 12, per-recipient 8), env-
  overridable (`CAMPAIGN_POLICY`) with the version stamped into every snapshot
  (audit history). No copy anywhere claims a count is frivolous/illegal.
- **`CampaignStore`** — self-heal Postgres table (ADR-0001) + in-memory; snapshot
  **write-once**, audit **append-only** (both store-enforced), every query
  **userId-scoped** (tenant / agency-managed-client isolation).
- **`CampaignService`** — the single orchestration surface: compose, create,
  approve (freeze snapshot), cancel, and **the mail gate** `attachLetterForQueue`.
- **Mail gate** (Phase 7): the confirm route requires every queued letter to
  belong to an approved campaign covering it; if none exists it lazily creates +
  approves a **coherent single-item campaign** so a lone send is never blocked.
  Fail-closed on association error (nothing queued). MAIL_LIVE unchanged (off).
- **Surfaces**: `/campaigns` (Kai's recommended campaign + deferred/excluded
  reasons + Strategy Review + expanded override with recorded acknowledgment);
  Sidebar + letters entry point; campaign milestones emitted as fail-open
  KaiEvents (`campaign.approved/active`) → Timeline + Case Memory; Decision
  Registry records the acted-on campaign at queue time.

## Consequences
- Every mailed dispute now belongs to a documented campaign; the queue can no
  longer be an unstructured bulk dump — while the consumer is never blocked from
  sending what they choose (expanded override, single-item auto-campaign).
- Guardrails are **honest and categorized**: law vs CreditVector policy vs Kai's
  recommendation are visibly separated; the frivolous-or-irrelevant statute is
  cited factually, never as a headcount rule.
- Deterministic + inspectable end to end (guard `scripts/campaign.test.ts`); no
  new AI cost, no cross-user data, no provider traffic.
- **Gate on the human bits**: consumer-facing compliance language is CCO-reviewed
  (compliance-review gate). Policy values are admin-configurable; a full admin
  policy-editor UI is backlog (env override + versioned snapshot suffice today).
- Rule of Two: built entirely in CreditVector, clean seams only (extraction-prep,
  nothing extracted).
