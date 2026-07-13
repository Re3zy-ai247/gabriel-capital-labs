# Kai Credit Economy & Monetization (Phase 3 design)

Status: **PROPOSED** — pricing/plan changes are 🟡 (founder approves) and require `/compliance-review` before shipping. All cost figures are **ESTIMATES from Anthropic list prices as of 2026-07-12** (Opus 4.8 $5/$25 per MTok; cache reads ≈0.1× input; Batches −50%). Re-verify before launch; BI-COST-01 metering must ship FIRST so this economy runs on measured, not estimated, costs.

## Design principles
1. **Retrieval is free; reasoning costs credits.** Layers 1–7 of the AI-last pipeline (`KAI-INTELLIGENCE.md`) are unlimited on every paid plan — the product always feels alive. Credits meter ONLY layer-8 AI reasoning.
2. **Credits are denominated in answers, not tokens.** Users buy outcomes; internal model/routing changes never reprice them.
3. **Generous enough to never think about, finite enough to protect margin.** Typical users should never hit the ceiling; the ceiling exists for the P99 and for abuse.
4. **No dark patterns.** Visible balance, soft warning at 80%, graceful degradation to retrieval-only at 0 (never a hard paywall mid-task), purchased credits never expire.

## Unit economics (ESTIMATE — replace with AiUsage measurements)
Standard Kai answer on Opus 4.8 (≈3.5k in / ≈1k out): ≈ **$0.03–0.05**; with the system prompt cached, ≈ **$0.03**. Deep analysis (strategist plan, response analysis; larger context): ≈ **$0.10–0.25**. With a ≥70% deflection rate to layers 1–7 (the pipeline's KPI), blended cost per *question asked* ≈ **$0.01**. Letter generation is deliberately OUTSIDE this system — it keeps its existing quota/`letterCredits` economy (one currency per job; do not merge them in v1).

## Credit schedule (PROPOSED)
| Action (layer 8 only) | Credits |
|---|---|
| Quick answer (fast-model tier) | 1 |
| Standard Kai answer / follow-up | 2 |
| Deep analysis (strategist plan, bureau-response analysis, report re-analysis on demand) | 5 |
| Layers 1–7 (cached, KG, community, Brief, templates, docs, own-data) | **0 — always** |

## Plan matrix (PROPOSED — CRO/founder decision)
| Plan | Monthly AI credits | Retrieval layers | Extras |
|---|---|---|---|
| Free | 0 (unchanged: no AI) | Read access: Brief, community, published cached answers | upgrade prompt on Ask |
| Premium $99 | **300** (≈150 standard answers — worst-case COGS ≈$6 ≈ 6% of ARPU; typical usage far below) | Unlimited | balance in Settings |
| Agency $399 | **1,000 pooled** across workspace | Unlimited | usage analytics per client · admin controls (per-client caps, disable-AI per client) |
| Agency Pro $799 | **3,000 pooled** | Unlimited | same + priority for future org policies |

Monthly credits reset (no rollover, v1 — simpler ledger); **purchased pack credits never expire** and draw down after monthly credits.

## Add-on packs (PROPOSED)
Reuse the proven `letters_5` Stripe pattern exactly: one-time `mode: payment` products, idempotent webhook grants deduped on `event.id`. Initial SKU: `kai_credits_100` at **$9** (COGS ≈$2 worst case → healthy margin while feeling cheap). Larger SKUs later are catalog entries, not code.

## Architecture (supports future org policies without redesign)
- **`CreditLedger`** (self-heal): append-only entries `{accountId, userId?, delta, reason: monthly_grant|purchase|spend|admin_adjust, refType/refId}` — balance is a sum; auditable; idempotent grants.
- **`CreditPolicy`** (self-heal): per-account rules — per-client caps (agency), disable-AI flags, future org-wide policies (department pools, approval thresholds). The spend path checks policy → ledger → executes; adding policy types never touches the core.
- **Spend flow:** router reaches layer 8 → policy check → provisional ledger debit → metered call (`lib/ai/meter.ts`) → on failure, automatic credit-back. Fails safe: if the ledger itself errors, behave like the rate limiter (fail open, log loudly) — never brick the product on billing plumbing.
- **Entitlements integration:** monthly grant amounts live in `lib/entitlements.ts` beside the existing plan logic (one source of truth for what a plan includes).

## Margin guardrails
1. BI-COST-01 metering live BEFORE credits launch (measure, then price).
2. Monthly review: measured cost/credit vs price; deflection rate ≥70% target (if it drops, fix retrieval before raising prices).
3. Org-level spend circuit breaker (`KAI-INTELLIGENCE.md` §6) caps absolute downside.
4. Rate limits (`RateHit`) remain the abuse backstop underneath credits.

## Compliance notes (CCO/CLO)
- Credits are **software-feature units**, marketed as such — never "credit-repair services" units. (Internal compliance assumption; the standing subscription-vs-CROA counsel question in `COMPLIANCE.md` covers this framing — include it in that review.)
- Plan-copy changes (pricing page, entitlement descriptions) each pass `/compliance-review`.
- No outcome-linked pricing ever (e.g. "pay per deletion" is 🔴 forbidden).

## Rollout sequence (when approved)
1. `lib/ai/meter.ts` + `AiUsage` (BI-COST-01) — ship alone first, measure 2+ weeks.
2. Cached-answer + KnowledgePack stores + router with layers 1,2,5 (highest deflection per effort).
3. Credit ledger + entitlements grants + Settings balance UI (soft-launch, generous).
4. Stripe pack SKU + agency pooling/analytics + admin controls.
5. Community-promotion loop + attorney-verification queue.
Each step: five-review gate, guard scripts, `CURRENT-STATE.md` update.
