# ADR-0006: Kai Intelligence Engine — AI-last retrieval architecture + credit economy

Status: **Proposed** (design approved for documentation 2026-07-12; runtime implementation awaits founder approval)
Date: 2026-07-12
Decision owners: Founder (Phase 3 mandate) + CAIO/CTO lenses

## Context
Kai today is a single-shot AI answerer (ADR-0005: deliberately tool-less/data-less). Phase 3 elevates Kai to the platform's intelligence layer. Naive scaling (every question → Opus call) is economically and legally fragile: token cost scales linearly with usage, and generated answers can't accumulate verification. Most questions are repeats answerable from existing, already-compliance-scrubbed content.

## Decision
Adopt an **AI-last, retrieval-first architecture**: a deterministic 8-layer router (own data → cached answers → knowledge pack → community → Brief → prompt templates → docs → AI reasoning) that short-circuits at the first confident answer; AI reasoning is metered by a **credit economy** (credits denominated in answers, retrieval always free/unlimited on paid plans; Premium finite monthly credits, Agency pooled credits + admin controls, add-on packs via the existing Stripe one-time-purchase pattern). Full specs: `.ai/KAI-INTELLIGENCE.md`, `.ai/CREDIT-ECONOMY.md`.

## Alternatives considered
- **Chatbot-first (AI on every question):** rejected — linear cost, no compounding knowledge asset, weaker compliance posture (every answer freshly generated).
- **Unlimited AI on Premium:** rejected — unbounded COGS tail; credits cap P99 while typical users never notice.
- **Token-denominated credits:** rejected — exposes users to internal model changes; answers-denominated insulates pricing.
- **Embeddings-first retrieval (v1):** deferred — vector storage through Accelerate NEEDS CONFIRMATION; lexical matching ships value now.

## Consequences
Blended cost per question drops with usage (deflection target ≥70%); answers accumulate verification status (unverified → staff → attorney-verified) becoming a defensible asset; adds new stores (KaiAnswer, KnowledgePack, AiUsage, CreditLedger, CreditPolicy — all self-heal per ADR-0001) and a metering wrapper that ALL AI calls must route through.

## Security implications
Partially supersedes ADR-0005 **only** as specified: Kai gains read-only access to pre-scrubbed, human-approved stores; all retrieved content is fenced UNTRUSTED in layer-8 prompts; no writes, no secrets, no cross-user PII, no live repo access. CSO review required at implementation; `kai-sanitize` guard extended.

## Compliance implications
Attorney-verified label only with documented counsel sign-off (none exists — Art. II). Credits marketed as software features, never credit-repair-service units; pricing changes are 🟡 + `/compliance-review`. Community-promoted answers pass the human approval gate before becoming retrievable.

## Migration or rollback plan
Additive and staged (rollout sequence in `CREDIT-ECONOMY.md`); each stage independently revertible — router falls back to today's direct-AI Kai; credits ship soft (generous) before enforcement. Kill switch: org-level spend circuit breaker + retrieval-only degradation.

## Evidence
Reuses verified patterns: self-heal tables (ADR-0001), Kai fencing (ADR-0005), Brief approval gate (ADR-0003), `letters_5` Stripe idempotent grants (`lib/billing.ts`), `RateHit` fail-open limiter. Pricing anchors from Anthropic list prices 2026-07-12 (Opus 4.8 $5/$25 per MTok; cache reads ≈0.1×; Opus-tier 4096-token min cacheable prefix) — labeled ESTIMATE in the design docs.
