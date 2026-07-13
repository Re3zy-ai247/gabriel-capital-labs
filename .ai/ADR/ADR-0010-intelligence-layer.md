# ADR-0010: Intelligence Layer — four compounding engines, built in CreditVector, harvested later

Status: **Proposed** (awaits founder approval; each engine additionally passes the five-review gate + CSO/CCO where noted before its own build)
Date: 2026-07-13
Decision owners: Founder (Rey Gabriel) · CTO/CPO (Kai advisory) · CCO + CSO gates named per engine

## Context
Sprint VI mandates intelligence that **compounds** — more valuable as reports, disputes, responses, and successes accumulate. Investigation found the substrate already exists or is designed (per-letter outcome record BUILT; `BI-FUNNEL-01` LIVE; `KaiEvent` BUILT; deterministic statute engines BUILT; `KaiAnswer`/`KaiRecommendation` DESIGNED under ADR-0006/0007; `AiUsage` metering BUILT). The gap is not engines to invent but wiring, plus two missing preconditions: a **consent-capture surface** and **privacy-clean event instrumentation**. Full design: [INTELLIGENCE-LAYER.md](../INTELLIGENCE-LAYER.md).

## Decision
Adopt four engines — (1) Knowledge (anonymous strategy→outcome patterns, extends Moat #4), (2) Recommendation (evidence-annotated, extends `recommendStrategy` + ADR-0006 router), (3) Outcome Intelligence (predictive of timeline/options from statute + own history), (4) Institutional Memory (structured product-learning events, feeds the Improvement Engine). All built **inside CreditVector** as customer-experience wins, cleanly enough to extract later, tagged `extraction-candidate: yes`. **Ship now, gate-free:** Engine 3 **Tier A** (single-user own-data forecast). Everything cross-user waits on its gates.

## Alternatives considered
- **Build a cross-user ML/embeddings recommender now** — rejected: no consent surface, thin dataset (Moat #4 "scale pending"), CROA/BI-Art.II risk of best-case framing on small n.
- **Frame the engines as GIOS platform infrastructure** — rejected by ADR-0009 (architecture frozen; no new OS abstractions; Rule of Two: zero Year-1 extraction).
- **Freeform AI "memory" of user struggles** — rejected: GABRIEL-INTELLIGENCE Memory Orchestration bans freeform AI memory; memory must be structured rows + event stream + recommendation ledger.
- **Wait for ADR-0006 approval before any intelligence** — rejected in part: Engine 3 Tier A needs no new AI, no cross-user data, no credit economy, so it ships now; the AI-dependent engines still wait.

## Consequences
Compounding becomes structural: each resolved dispute enriches the outcome dataset; each own-history resolution sharpens the user's forecast. New metrics (BI-OUT-01/02, BI-FEAT-01) enter METRICS.md real-or-not-instrumented. Clean seams are created for future GIOS extraction without extracting. Sequenced, each step independently revertible.

## Security implications
The IRON WALL holds: user data never crosses products; Kai's read-only/untrusted-fence envelope (ADR-0005/0006) is untouched — Engine 2 is a retrieval *source*, not a new tool. No new PII stores. Engine 3 Tier A reads only the requesting user's own rows through existing authz.

## Compliance implications
Data-moat privacy gate (MOAT rule 2): consent + anonymization + Art. V precede any cross-user compounding. k-anonymity threshold (design n≥30) on every shown aggregate cell; thin data discloses itself. **CROA:** predictive of timeline/options only — never a probability of deletion or score change; evidence sentences ("consumers like you more often began with X") are observations requiring CCO sign-off, distinct from outcome promises (🔴 forbidden). No external monetization of the dataset, ever.

## Migration or rollback plan
Additive and staged (INTELLIGENCE-LAYER §Sequenced rollout). Engine 3 Tier A is a pure additive read surface — remove the component to revert. Each later engine is a separate gated change; the router falls back to today's deterministic `recommendStrategy` if Engine 2 is disabled.

## Evidence
`Letter` outcome fields (schema); `BI-FUNNEL-01`/`BI-ACT-01` LIVE (METRICS.md); `lib/kaiEvents.ts`, `lib/aiMeter.ts` BUILT; ADR-0006/0007 DESIGNED; ADR-0009 architecture-frozen; MOAT.md Moats #1/#4/#7/#10/#12 + §Rules; GABRIEL-INTELLIGENCE prime law (Rule of Two) + THE IRON WALL.
