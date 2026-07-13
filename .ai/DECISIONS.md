# Decisions index (ADRs)

One line per ADR; full records in `ADR/`. New decisions: copy `ADR/ADR-0000-template.md`, next number, add a line here. Record real reasoning only — never invent retroactive rationale.

| ADR | Title | Status |
|---|---|---|
| [0001](ADR/ADR-0001-self-healing-tables.md) | Self-healing tables instead of Prisma migrations (Accelerate silently drops `db push`) | Accepted |
| [0002](ADR/ADR-0002-field-encryption-at-rest.md) | AES-256-GCM field-level encryption at rest with dual-read | Accepted |
| [0003](ADR/ADR-0003-brief-ingestion-official-rss.md) | Brief automation = official-source RSS + Anthropic, draft-only (not Perplexity/Abacus) | Accepted |
| [0004](ADR/ADR-0004-deterministic-letter-llm-refine.md) | Deterministic grounded letter first; LLM only refines | Accepted |
| [0005](ADR/ADR-0005-kai-guardrails.md) | Kai guardrails — scope lockdown + untrusted-input fencing | Accepted |
| [0006](ADR/ADR-0006-kai-ai-last-architecture.md) | Kai Intelligence Engine — AI-last retrieval architecture + credit economy | **Proposed** (awaits founder approval; partially supersedes 0005 when accepted) |
| [0007](ADR/ADR-0007-kai-experience-layer.md) | Kai Experience Layer — passive intelligence, event engine, proactive surfacing | **Proposed** (E1–E4 independent of 0006; E5 depends on it) |
| [0008](ADR/ADR-0008-creative-os.md) | Creative OS — canonical Kai character system + scored render gate (`.ai/creative/`) | Accepted · **amendment 2026-07-12: Kai identity FROZEN at v1 (CV-KAI-MASTER-001) by explicit founder directive — no redesigns, no reinterpretations** |
| [0009](ADR/ADR-0009-product-first-os-later.md) | Product first, OS later — GIOS extracted FROM CreditVector; architecture frozen; CX-only focus; resolves G-PLAT-1 | **Accepted (founder directive)** |
| [0010](ADR/ADR-0010-intelligence-layer.md) | Intelligence Layer — 4 compounding engines built in CV, harvested later; Engine 3 Tier A ships gate-free, cross-user engines gated on consent+CSO/CCO+ADR-0006 | **Proposed** (Engine 3 Tier A built 2026-07-13; rest awaits gates) |

Candidate future ADRs (write only when the decision is actually made/verified): multi-tenant agency isolation model · payment/plan entitlement architecture · compliance-scrubber design · community moderation model.
