# CONTINUE IN CHATGPT — CreditVector Phase -0 Operator Journey Simulation

Paste this whole file into ChatGPT to resume. This is a CONTINUATION of a Founder-reviewed simulation phase — do not start from scratch, do not re-run the simulations, do not rediscover the architecture. Repository truth is authoritative; production truth overrides repository assumptions.

## Verified state

- **Project:** CreditVector by Gabriel Capital Labs — Phase -0, Operator Journey Simulation (experience simulation only; no code, no schema, no architecture changes anywhere in this phase).
- **Branch:** `docs/fulfillment-engine-v1` · **HEAD (base):** `871d420` · docs-only; product code, schema, and production untouched.
- **Verdict:** READY-WITH-DISCLOSURES. The Opus adversarial experience review (`EXPERIENCE-REVIEW.md`) audited five independent journey simulations (2,192 lines) plus the merged Founder Walkthrough against the locked architecture and real code; 13 of the sims' load-bearing claims verified, 3 came back partial, 1 finding (the unranked recommendation) the sims themselves missed and the review caught by tracing code.
- Phase 1 may begin at **P0 → P1a/P1b → P5 → P6a**. Nothing in this review blocks the start.

## What Phase -0 established

Five simulations (new operator, active operator, client journey, agency owner, system-ring walk) storyboarded the full operator-visible journey against real code and the locked design corpus. A merge (`WALKTHROUGH.md`) combined them into one four-act narrative. An adversarial review (`EXPERIENCE-REVIEW.md`) found four defects in the merge's first version (a §611 inversion, a fabricated scene, a GAP presented as a delight, a suppressed disagreement) — all four corrected with ⟲ marks. The review's verdict: the product is **OS-grade inside every room**, and the gap is not more features but one missing piece of connective tissue — **the operator's own session is not a first-class object anywhere**. Twelve recommendations were adjudicated and mapped to existing, already-locked docs (`RECOMMENDATIONS.md`); none reopens the architecture.

## The 12 recommendations — landing map

| # | Landing doc | Phase / gate |
|---|---|---|
| 1 | Room Constitution §4 + CASE-JOURNEY-RUNTIME-PLAN §1.6 | P6a scope |
| 2 | WALLET-COMMITMENT-MODEL §8.5 UI addendum | P7 (legal-gated) |
| 3 | KAI-FULFILLMENT-UX §2.2 | P6a scope |
| 4 | D-KAI-EXPERIENCE §2.2 (two-line code fix) | **P0 (Founder approval)** |
| 5 | KAI-FULFILLMENT-UX §3.5 + B-MAIL-CENTER-EVOLUTION §3.4 | P6a, before P9a |
| 6 | B-MAIL-CENTER-EVOLUTION §5 (code fix) | **P0 (Founder approval)** |
| 7 | MAIL-CENTER-EVOLUTION-PLAN / onboarding | P6a scope |
| 8 | KAI-FULFILLMENT-UX §2.1.2/§2.2/§2.4 | P6a/P8a |
| 9 | KAI-FULFILLMENT-UX §4.1 + B-MAIL-CENTER-EVOLUTION §2.2/§2.3 | P6a scope |
| 10 | KAI-FULFILLMENT-UX §1.2/§1.3/§1.6 | P6b/P7 scope |
| 11 | New bounded 6-scene interim sim | pre-P9a (recommended, not required) |
| 12 | MAIL-CENTER-EVOLUTION-PLAN §3.1 | P6a+ (post-P5 obligation) |

## Hard gates — unchanged, carried forward

- **CROA §404 advance-fee counsel question** — prepaid wallet funds are still received in advance; keeping the wallet does not moot it.
- **Gate D, at P1a/P1b** — production has no `_prisma_migrations` history; the preflight rejects a new migration until Gate D Phase −1 runs. Must clear before any new fulfillment schema lands in P1a/P1b.
- **16-question LetterStream vendor-confirmation set** — unchanged, carried forward from the Fulfillment Engine architecture gate.
- **§611-clock CCO question — now Download-scoped.** No longer only "does the Send-path clock need a receipt anchor" (already fixed in design) — per this phase's finding 2, it is now "the Download path's clock and its evidence asymmetry vs. Send." Re-scoped, not resolved; must clear before P9a/P10a.
- **Earned-VC classification** — unresolved compliance classification question, carried unchanged from the wallet architecture gate.

## Exact continuation point

The Founder approves Phase 1 start: **P0**, including the two live-defect fixes (the branch-5 `orderBy`/starvation guard in `kaiHome.ts`; scoping the Kai-presence cache per workspace) plus the small documentation corrections this phase surfaced — then **P1a/P1b**, then **P5 → P6a** on the **Download track** (Download is the only path that ships at launch; Send stays behind CROA counsel). The §611 CCO gate travels with P6a, re-scoped to Download, and must clear before P9a/P10a.

## Do NOT

- Do not implement any wallet/Send/Mission-Control code from this phase's findings without a separate Founder-approved execution plan — this phase is simulation + adjudication only.
- Do not treat any sim scene marked `TARGET STATE` as already shipped.
- Do not wire `/onboarding` as-is (it renders "visited" as "completed" — fix the semantics first, or delete the route).
- Do not manufacture case/arc completion (Completion-(b)) — it is correct, honest FCRA modeling.
- Do not build any staff-identity "experience fix" that fakes attribution the schema cannot provide — label the field "account" until Operator Identity activates.
- Do not skip Gate D Phase −1 or the CROA §404 counsel question before any new schema or wallet code.
- Do not treat the bounded 6-scene interim simulation (recommendation 11) as required — it is recommended, not a blocker.
- Do not merge or push this package beyond `docs/handoffs/sim/`.

## Where the detail lives (in this package)

`FOUNDER-SUMMARY` (one-page verdict + the minimum set + disclosures) · `WALKTHROUGH` (the corrected four-act narrative) · `JOURNEY-MAP` (the canonical node-by-node map) · `EXPERIENCE-REVIEW` (the full adversarial review — findings table, six questions, Kai verdict, integrity audit) · `RECOMMENDATIONS` (all 12, adjudicated, plus refusals) · `MANIFEST` · `SHA256SUMS.txt`.
