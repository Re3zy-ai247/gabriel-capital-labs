# CONTINUE IN CHATGPT — CreditVector Fulfillment Platform Phase 1 Execution Plan

Paste this whole file (or the Founder chat report) into ChatGPT to resume. This is a **continuation** — do not start from scratch, do not redesign the architecture, do not re-run the sequence review. Repository truth is authoritative; production truth overrides repository assumptions.

## Verified state

- **Project:** CreditVector Fulfillment Platform (Gabriel Capital Labs) — **Phase 1 Execution Planning**, not implementation.
- **Branch:** `docs/fulfillment-engine-v1` · **HEAD:** `fcfc5b6` · **Base:** `origin/main` `f449c35` (untouched).
- **Verdict:** READY-WITH-DISCLOSURES (`docs/fulfillment/execution/SEQUENCE-REVIEW.md`) — a single bounded Opus review, scope limited to the sequence only, architecture not re-litigated. 8 findings, all documentary/procedural; 8 Program Director resolutions (R-D1..R-D8) supersede conflicting earlier text; no surviving blocker.

## The locked architecture (do not reopen)

The CreditVector Fulfillment Platform architecture is **ACCEPTED and LOCKED** (`docs/fulfillment/execution/EXECUTION-PLANNING-BRIEF.md`): Case Journey Runtime as the primary workflow; Dispute Package as the primary object; provider-neutral adapters (LetterStream = Provider Adapter #1); Kai Runtime as narrator-never-decider; the Operational Room Constitution; the Fulfillment Policy Engine and Recovery Engine; Provider Acceptance as the irreversible boundary; the re-gated Wallet commitment model (anchor lock, per-letter/attempt grain, unified attempt+1, canonical claim-key registry, `MailManifestFlags` additive migration, FINAL REVIEW pre-Submit token). This package plans execution of that architecture; it does not alter it.

## The phased plan, summarized

The **two-option law forks the critical path** (`EXECUTION-PLAN.md` §1): Download Package (self-mail) needs no wallet and no live provider; Send with CreditVector Fulfillment needs both, gated behind CROA counsel (P2) and the 16-question vendor set. Corrected critical path (Send, per `SEQUENCE-REVIEW.md` R-D4): `P0 → P1a → P1b → P4 → P5 → P6a → P7(∥P2) → P6b → P3-live → P9b → P10b`. Corrected earliest wallet-free milestone: `P0 → P1a → P1b → P4 → P5 → P6a → P9a → P10a` — Download Package live, zero wallet, zero live provider. Even earlier value: `P5-accel` ships the evolved `/mail` room the moment P1b clears, no new schema at all. Full phase table: `EXECUTION-ROADMAP.md` in this package.

## The hard gates (do not bypass)

1. **CROA §404 advance-fee counsel question** — blocks all wallet money code (P2). Keeping the prepaid wallet does not moot the question; a compliant alternative (Stripe manual-capture at delivery) is on file.
2. **Gate D Phase −1 — P1a and P1b, both.** Production has no `_prisma_migrations` history; the preflight tooling rejects a 7th migration directory. P1b (the ID-B02 versioned manifest-extension mechanism) is **sole-owned by the Identity Constitution program** (`SEQUENCE-REVIEW.md` R-D1) — Fulfillment consumes it, does not re-implement it; the two programs must pre-agree migration-directory numbering before P1b begins.
3. **16 LetterStream vendor questions** (11 named + 5 adjacent — `SEQUENCE-REVIEW.md` R-D3 makes all 16 hard preconditions, withdrawing any "defer 5" option) — block the `MAIL_LIVE` flip.
4. **Earned VC instrument classification** — a separate counsel + CCO gate; unresolved whether Earned VC is a sixth ADR-0038 instrument or a productized promotional credit.
5. **§611-clock-without-receipt** — a separate, smaller open CCO question.

## Exact continuation point

1. **Execute now, ungated (pure code/doc, no migration):** the P0 documentation corrections (P-8: F11 `PolicyInput.estimate`, F13 restore 9-step chain references, F14 cascade→Restrict, ADR-0044 vocabulary supersession, 3 LOW re-gate fidelity items) **and** the R-D2 live vendor-leak fix (`app/api/mail/[mailId]/route.ts:13` — Vendor Opacity DTO + static guard, moved out of Gate-D-gated P4 into this ungated pass because it is pure code and the leak is live in production today).
2. **Route the CROA §404 counsel question** to outside counsel (P2) — this runs in parallel with everything else and does not block engineering on the Download path.
3. **Run Gate D — P1a then P1b — under Identity-program ownership.** P1a executes the six already-committed migrations against production, resolving the missing `_prisma_migrations` baseline per the runbook's own per-migration state taxonomy (`SEQUENCE-REVIEW.md` R-D5 — not a flat `resolve 0_init`). P1b lands the ID-B02 manifest-extension mechanism; per R-D1 this is the Identity Constitution program's infrastructure to build, with Fulfillment as a consumer, and per R-D6 it is a per-wave mechanism every later migration wave (P4, P5, P7) re-derives through.
4. **Then proceed on the wallet-free spine:** P4 (provider abstraction interface + the `MailManifestFlags` migration) → P5 (Fulfillment Engine schema — Case/DisputePackage/Policy/Recovery) → P6a (Mail Center Download workspace) — none of this needs P2 or a vendor answer to ship.

## Do NOT

- Merge this branch to `main` · deploy · implement any wallet/LetterStream code · run any migration · change schema/auth/billing/dependencies.
- Reopen or re-litigate the locked architecture, or re-run the sequence review, without Founder authorization.
- Schedule any money-moving code before P2 clears, or any live-provider wiring before the 16-question vendor set is answered and the conformance suite is green.
- Treat `EXEC-SEQUENCING.md`'s or `LETTERSTREAM-ADAPTER-PLAN.md`'s original text as authoritative wherever `SEQUENCE-REVIEW.md`'s R-D1..R-D8 corrects it — the resolutions supersede conflicting earlier text.
- Assume P1b is a one-time unlock — it is per-wave (R-D6); every migration wave re-derives through it.

## Where the detail lives (in this package)

`EXECUTIVE-SUMMARY` (the arc + verdict + the one insight) · `FOUNDER-SUMMARY` (one-page view) · `EXECUTION-ROADMAP` (the full P0–P10b phase table) · `DEPENDENCY-AND-MIGRATION` (dependency graph + migration order + Gate D mechanics) · `RISK-AND-GATES` (risk register + the 8 sequence-review findings/resolutions) · `MANIFEST` + `SHA256SUMS.txt` (package integrity). Underlying committed source, for anything this package abbreviates: `docs/fulfillment/execution/EXECUTION-PLAN.md`, `SEQUENCE-REVIEW.md`, `DEPENDENCY-GRAPH.md`, `MIGRATION-PLAN.md`, `FEATURE-FLAG-STRATEGY.md`, `TESTING-STRATEGY.md`, `ROLLBACK-STRATEGY.md`, `RISK-REGISTER.md`, and the five domain plans (`EXEC-SEQUENCING.md`, `LETTERSTREAM-ADAPTER-PLAN.md`, `MAIL-CENTER-EVOLUTION-PLAN.md`, `WALLET-VC-RUNTIME-PLAN.md`, `CASE-JOURNEY-RUNTIME-PLAN.md`).
