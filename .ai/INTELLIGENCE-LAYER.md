# Intelligence Layer — Sprint VI blueprint

Status: **PROPOSED** (design only; 2026-07-13). Nothing here is built except the one slice explicitly marked ✅ BUILT at the bottom. Every engine below still passes the Constitution, the five-review gate, counsel where required, and the data-moat privacy gate (MOAT.md §Rules rule 2) before it ships. This doc is the canonical design for the four compounding engines; it does **not** override the CROA bar, ADR-0005/0006 security envelopes, ADR-0009 (architecture frozen), or the Rule of Two. Governing decision: [ADR-0010](ADR/ADR-0010-intelligence-layer.md).

## The one law (founder directive)
Every piece of intelligence must become **more valuable as more reports are uploaded, more disputes complete, more bureau responses arrive, more users succeed.** If knowledge does not compound, we do not build it. Compounding is structural (data + verified corpus), never memorized users.

## The compounding substrate already exists — this sprint mostly *connects* it
The corpus already designed or built most of the raw material. Sprint VI's job is to wire it into customer value, not invent engines (ADR-0009: no new OS abstractions; each engine justified as a CreditVector CX win).

| Substrate | Status today | Feeds engine |
|---|---|---|
| Per-letter outcome record: `strategy × targetBureau × round × responseOutcome × (responseAt − mailedAt)` + joinable tradeline classification | **BUILT** (schema `Letter`) | 1, 3 |
| `BI-FUNNEL-01` dispute funnel (generated→mailed→responded→resolved, outcome split, favorable rate) | **LIVE** `/admin/product` | 1 |
| `KaiEvent` append-only event stream + fail-open producers | **BUILT** (ADR-0007 E1, `lib/kaiEvents.ts`) | 1, 4 |
| Deterministic statute/scoring/obsolescence/recommend engines | **BUILT** (`lib/statutes|scoring|obsolescence|recommend.ts`) | 2, 3 |
| `KaiAnswer` verified-answer corpus + verification ladder + community promotion loop | **DESIGNED, PROPOSED** (ADR-0006, awaiting founder approval) | 2 |
| `KaiRecommendation` ledger ("advice memory") | **DESIGNED** (ADR-0007) | 2, 3 |
| `AiUsage` metering (BI-COST-01) | **BUILT** (`lib/aiMeter.ts`) | cost governor for all |
| `.ai/` institutional-memory OS (constitution, ADRs, registries) | **LIVE** (Moat #7) | 4 (company memory only) |
| Consent-capture surface for aggregate data reuse | **DOES NOT EXIST** — hard blocker for any cross-user engine | gates 1, 2 |
| Usage/feature events (`BI-FEAT-01`, `BI-USER-02`) — privacy-clean, no PII | **NOT INSTRUMENTED** (backlog) | 4 |

## Engine 1 — Knowledge Engine (anonymous outcome patterns)
**Compounds because:** every completed dispute adds one row to the anonymized strategy→outcome funnel; recommendations for the next user get sharper. This is Moat #4 ("dispute outcome data"), today PARTIAL/"scale pending".

- **What it learns (aggregate only, k-anonymous):** which arguments produce favorable bureau responses more often; median response latency by bureau; which furnisher/creditor kinds verify vs delete more often; common cross-bureau contradiction patterns; common documentation gaps. All **strategy→outcome**, never user→outcome.
- **Harvest, don't rebuild:** extends `BI-FUNNEL-01` and the `Letter` outcome record. The aggregation is a **computed-on-read** derived view (`lib/outcomeStats.ts`, self-heal materialized snapshot only if load demands it), never hand-stored numbers (BI charter: the BI dir is not a data store).
- **Hard gates before ANY user-facing surface:** (a) **consent surface must exist** — MOAT rule 2: consent + anonymization + Art. V come before compounding; (b) **k-anonymity threshold** — no cell shown below a minimum sample size (design: n≥30), and thin data discloses itself ("not enough data yet") rather than presents best-case (BI Art. II); (c) **CSO + CCO pass** — privacy-clean aggregation + typical-results framing; (d) **new metrics registered in METRICS.md** with IDs, real-or-not-instrumented.
- **Never:** raw per-user data crosses to another user; the dataset is externally monetized or exposed as a data-broker API (VISION §never-become); best-case framing.

## Engine 2 — Recommendation Engine (evidence, not templates)
**Compounds because:** recommendations cite the growing outcome dataset (Engine 1) + the growing verified-answer corpus (KaiAnswer). More data → stronger, better-grounded recommendations.
- **What changes:** today `recommendStrategy()` picks from deterministic rules. Engine 2 keeps that as the floor and *annotates* it with evidence when the sample is large enough: "Consumers with reports like yours **more often began with** validation — bureaus responded in a median of N days" (observation, cites the aggregate). Every recommendation still shows **why + evidence + statute + expected timeline** (provenance contract, ADR-0006).
- **Harvest, don't rebuild:** plugs into the ADR-0006 8-layer router as a retrieval source; recommendations land in the `KaiRecommendation` ledger.
- **Hard gates:** depends on Engine 1's dataset + gates; KaiAnswer corpus is **PROPOSED (ADR-0006 founder approval pending)**; **CCO review of every evidence-framed sentence** (the CROA line between "consumers like you typically began with X" [observation, OK] and "X will remove your item" [outcome promise, 🔴 forbidden]); no attorney_verified label without documented counsel sign-off.

## Engine 3 — Outcome Intelligence (predictive, from statute + own history)
**Compounds because:** the more of the *user's own* disputes resolve, the more precisely the forecast is tuned to *their* bureaus' actual behavior; and once Engine 1 is live+consented, cohort medians sharpen the single-user forecast.
- **What it produces per mailed dispute:** expected window (the §611 30-day statutory clock + realistic mail/response lag), the enumerated **possible next bureau responses** (verified / deleted / updated / no-response) each with its statutory meaning, and the **recommended contingency** (MOV demand → §623 furnisher dispute → CFPB path). Predictive of *timeline and options*, **never of the result** (CROA).
- **Two tiers, sequenced by gate:**
  - **Tier A — own-data only (NO gate):** statute + the user's own prior response latencies ("your bureaus have answered in ~N days before" — factual, own data). Needs no consent, no cross-user data, no new AI. **This is the safe first build.**
  - **Tier B — cohort-tuned (gated):** blends in Engine 1 cohort medians once consent surface + k-anonymity + CCO exist.
- **Never:** a confidence % of deletion; any invented probability without provenance (Event Bus contract: consumers render, never invent).

## Engine 4 — Institutional Memory (product learning, structured only)
**Compounds because:** every session's friction data makes the next cohort's experience better — where users struggle, where they abandon, which explanations reduce confusion, which wording improves completion.
- **What it remembers:** privacy-clean **feature/usage events** (`BI-FEAT-01`/`BI-USER-02`) — module usage, funnel drop-off points, completion by wording variant. Structured rows + the event stream + the `KaiRecommendation` ledger — **NO freeform AI memory stores** (GABRIEL-INTELLIGENCE §1 Memory Orchestration).
- **Harvest, don't rebuild:** implements the standing BI backlog items (BI-FEAT-01 first). Consumed by the **Autonomous Improvement Engine** (`.ai/improvement/ENGINE.md`), not shipped as a user surface.
- **Distinction:** company/product memory (the `.ai/` OS) is LIVE and separate; this engine is *runtime product-learning* memory in the DB.
- **Hard gates:** BI-FEAT-01 is bound to "privacy-reviewed, no PII" + CSO/CCO pass; events are anonymous aggregates, never per-user behavioral profiles reused against the user.

## CreditVector vs future GIOS — the extraction wall (Rule of Two)
Per ADR-0009 + GABRIEL-INTELLIGENCE prime law: **Year-1 = ZERO extraction.** All four engines are built **inside CreditVector** as customer-experience wins, cleanly enough to extract later (service boundaries, `*Shared` splits, provider adapters). Nothing becomes a shared/platform component until a **committed product #2** needs it (G-PLAT-2, not occurred).

| Stays in CreditVector now | Tagged `extraction-candidate` for GIOS later |
|---|---|
| `lib/outcomeStats.ts` (Engine 1 aggregation) | GIOS **Cross-Product Intelligence** (anonymized aggregate patterns, DPO-gated) |
| `lib/forecast.ts` (Engine 3 single-user) | GIOS **Memory Orchestration** (structured-data-first) |
| Evidence annotation on `recommendStrategy` | GIOS **Retrieval Kernel** recommendation source |
| Feature-event capture (Engine 4) | GIOS **Event Bus** derived-events rules engine |

**THE IRON WALL (inherited):** user data never crosses products; only verified knowledge (domain-tagged), anonymized aggregate patterns (DPO-gated), the character, and the governance may ever cross. Building these now creates the clean seams — it does not extract them.

## Sequenced rollout (each step independently revertible, five-review-gated)
0. **This sprint (BUILT):** Engine 3 **Tier A** single-user forecast — own-data + statute, gate-free, CROA-safe. Seeds the outcome-record habit Engine 1 later aggregates.
1. **Consent surface** + `BI-FEAT-01` privacy-clean event capture (CSO/CCO pass) — unblocks Engines 1 & 4.
2. **Engine 1** aggregation as `/admin` insight first (internal, validates k-anonymity + framing) before any user surface.
3. **Engine 4** feeds the Improvement Engine.
4. **Engine 2** evidence annotation (needs Engine 1 live + KaiAnswer approved) — CCO on every sentence.
5. **Engine 3 Tier B** cohort tuning.

**KPIs (register in METRICS.md, real-or-not-instrumented):** BI-OUT-01 forecast-accuracy backtest (own-history), BI-OUT-02 cohort sample sizes per strategy/bureau cell, BI-FEAT-01 usage events. **Blocking dependencies:** consent surface (all cross-user), ADR-0006 founder approval (Engine 2 corpus), CSO/CCO pass (Engines 1/2/4).

## What this is NOT
Not a data broker; not per-user behavioral profiling reused against users; not outcome/score prediction; not GIOS infrastructure built ahead of a product #2; not freeform AI memory; not a bypass of consent, k-anonymity, or the CROA bar. Every insight is explainable and carries provenance, or it does not ship.
