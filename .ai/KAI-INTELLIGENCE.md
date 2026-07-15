# Kai Intelligence Engine — Architecture (Phase 3 design)

Status: **PROPOSED** (design only — no runtime code; implementation awaits founder approval). Governing decision record: ADR-0006 (Proposed). Kai's current production state is unchanged: community answerer, tool-less and data-less by design (ADR-0005).

**Thesis: Kai is not a chatbot. Kai is CreditVector's Credit Intelligence Officer** — a layered retrieval-first engine where AI reasoning is the *last* resort, not the first. Objective: minimize token spend while maximizing perceived intelligence. Most questions in this domain have already been answered — by our knowledge base, our community, the Brief, or the user's own data. The platform should find that answer before paying a model to re-derive it.

## 1. The AI-Last pipeline (order is mandatory)

Every Kai request flows through a deterministic router (`lib/kai/router.ts` — PROPOSED) that walks the layers in order and **short-circuits at the first confident answer**. Layers 1–7 are DB/lexical lookups costing ~zero; only layer 8 spends tokens (and credits).

| # | Layer | Backing store | Status | Notes |
|---|---|---|---|---|
| 1 | Local UI / user-data lookup | User's own reports, tradelines, letters, scores via existing routes | infra LIVE | "What's my highest-priority dispute?" is a DB query, not an AI question |
| 2 | Cached answer lookup | NEW `KaiAnswer` self-heal table (ADR-0001 pattern) | PROPOSED | Curated + promoted Q&A; normalized-question match (v1 lexical; embeddings = v2, NEEDS CONFIRMATION on vector strategy through Accelerate) |
| 3 | Knowledge Graph search | NEW `KnowledgePack` table — the runtime counterpart of `knowledge/GRAPH.md`: human-approved articles on statutes-as-implemented, product how-tos, credit concepts | PROPOSED | Content derives from `lib/statutes.ts`/`lib/strategies.ts`/docs — never AI-invented law |
| 4 | Community search | Existing `CommunityThread`/`CommunityReply` (moderated, non-removed only) | infra LIVE | Results labeled "community discussion — unverified" |
| 5 | Brief search | Existing published `BriefArticle` rows | infra LIVE | Already compliance-scrubbed + human-published |
| 6 | Prompt Library lookup | `PROMPT-REGISTRY.md`-mapped deterministic templates (e.g. grounded letter templates — `renderTemplateLetter` already exists) | infra LIVE | Templated tasks never need generation |
| 7 | Documentation search | Help/FAQ/user-guide content (seed from `USER_GUIDE.md` + `/help`) | PROPOSED | |
| 8 | **AI reasoning** | Anthropic via provider boundary | LIVE (today's Kai) | Only when layers 1–7 miss the confidence threshold, or the user explicitly requests fresh analysis. Consumes credits (`CREDIT-ECONOMY.md`) |

**Router contract:** each layer returns `{answer?, confidence: 0..1, provenance[]}`. First result ≥ threshold (initial: 0.8, tunable) wins. A layer-8 answer that itself scores low → honest fallback: "I don't have a confident answer — here are related resources / ask the community," never a hallucinated one (Constitution Art. II).

## 2. Security envelope (non-negotiable — extends ADR-0005)

Retrieval-augmented Kai creates a NEW injection surface: retrieved content becomes prompt input. Controls, all inherited from proven patterns:
- Layer-8 prompts fence ALL retrieved content in BEGIN/END UNTRUSTED markers + `sanitizeForPrompt()` (the existing `lib/kai.ts` pattern), including cache/KG/community/Brief snippets.
- Kai reads only **read-only, pre-scrubbed, human-approved** stores. No write access, no secrets, no other users' PII, no live repo/doc access. User-data layer (1) returns only the requesting user's own rows through existing authz.
- Every store feeding Kai passes the admin-approval-before-publish gate (the Brief model) before it becomes retrievable.
- Superseding ADR-0005's tool-less constraint happens via ADR-0006 + `/compliance-review` + security review — never casually (guard: `scripts/kai-sanitize.test.ts` extended to fence retrieval blocks).

## 3. Confidence scoring
- **Deterministic sources score deterministically:** exact cache hit = 1.0; KG match = lexical-overlap score; community = capped at 0.7 and always labeled unverified; user-data queries = 1.0 (it's their data).
- **AI answers:** model emits a structured self-confidence + the answer passes `applyCompliance`; both are stored with the answer. Low confidence → fallback message + optional route-to-community.
- **Every answer shows provenance** (source + verification status). Perceived intelligence comes from *receipts*, not fluency.

## 4. Attorney verification pipeline
`KaiAnswer.verificationStatus ∈ {unverified, staff_approved, attorney_verified}` (+ `verifiedBy`, `verifiedAt`, evidence link).
- New/promoted answers start `unverified` (served with disclaimer).
- Admin review → `staff_approved`.
- High-traffic answers queue for counsel review; `attorney_verified` is set ONLY with a documented sign-off (Art. II/IV — the label is forbidden without proof; today zero answers can carry it). UI badge only at this tier. This creates the compounding asset: a growing library of attorney-verified consumer-credit answers no competitor has.

## 5. Community learning loop
High-quality moderated community answers → **candidate** cached answers → admin approve/edit (reuse the Brief draft→publish gate) → enter layer 2 as `unverified` (author-credited, compliance-scrubbed via `screenCommentBody`-style screen). Never auto-promoted. Each promotion permanently deflects future identical questions from layer 8 — the system gets cheaper and smarter with use.

## 6. Cost tracking & token budgeting (implements BI-COST-01)
- **Metering wrapper** `lib/ai/meter.ts` (PROPOSED): every Anthropic call flows through it; writes `AiUsage` self-heal rows (surface, model, input/output/cache-read/cache-write tokens, computed cost from a versioned price table, userId/accountId). Feeds `/admin/automation` + the credit ledger.
- **Prompt caching:** Kai's stable system prompt gets `cache_control` (reads ≈0.1× input price). ⚠️ Opus-tier minimum cacheable prefix is **4096 tokens** — below that it silently doesn't cache; verify with `usage.cache_read_input_tokens`, and pad/structure the stable prefix accordingly or accept no-cache.
- **Per-surface `max_tokens` caps** (answers don't need 8k tokens) + existing per-user rate limits (`RateHit`).
- **Org-level circuit breaker:** monthly AI-spend ceiling env var; on trip, layer 8 degrades to retrieval-only + honest banner (fails safe like the rate limiter). Alerts admin via existing email/push plumbing.
- **Batch lane:** non-interactive AI work (Brief ingest summaries) can move to the Batches API at 50% price (PROPOSED, low priority).

## 7. Multi-model routing (future-proof, provider-independent)
Provider boundary `lib/ai/provider.ts` (PROPOSED): a thin adapter interface (`complete(taskClass, prompt, opts)`) with Anthropic as the sole v1 implementation. Task classes route to tiers:

| Task class | Tier (v1 model) | Rationale |
|---|---|---|
| Routing/classification/cache-match assist | fast (Haiku-class) | cheap, latency-sensitive |
| Report parsing | standard (Sonnet-class — parse already ran on a faster model historically; current `LLM_PARSE_MODEL` state NEEDS CONFIRMATION) | volume |
| Kai answers, strategist, letter refine, response analysis | deep (Opus 4.8 — current `LLM_MODEL`) | quality + compliance stakes |

GPT/Gemini/local models = future adapters behind the same interface; adding one is config + adapter, no product-logic rewrite (Constitution: provider independence). Credits are denominated in **answers, not tokens** (`CREDIT-ECONOMY.md`), so internal model changes never reprice the user.

## 8. Data model additions (all self-heal, ADR-0001)
`KaiAnswer` (question-normalized, answer, provenance, confidence, verificationStatus, hitCount) · `KnowledgePack` (slug, title, body, sources, status draft/published) · `AiUsage` (metering) · `CreditLedger` + `CreditPolicy` (see `CREDIT-ECONOMY.md`). Prisma models added to `schema.prisma` + gate functions; no migrations.

## 9. What this is NOT
Not a rewrite of `lib/kai.ts` (it becomes layer 8's engine) · not live-repo-reading Kai · not autonomous publishing · not a legal-advice engine. Every existing compliance/security control survives intact.
