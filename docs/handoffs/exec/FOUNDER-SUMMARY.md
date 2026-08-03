# CreditVector Fulfillment Platform — Phase 1 Execution Plan — Founder Summary

**2026-08-03 · branch `docs/fulfillment-engine-v1` · HEAD `fcfc5b6` · base `origin/main f449c35` (untouched)**

**Status: READY-WITH-DISCLOSURES** (`docs/fulfillment/execution/SEQUENCE-REVIEW.md`) · Planning only — nothing implemented, nothing merged, nothing deployed.

## What this is, in one paragraph

Five parallel domain plans (sequencing, LetterStream adapter, Mail Center evolution, Wallet + Vector Credits runtime, Case Journey Runtime) were synthesized into one unified Phase 1 Execution Plan, then put through one bounded, independent (Opus) adversarial review scoped strictly to the **sequence** — the already-locked architecture was not reopened. The review returned **READY-WITH-DISCLOSURES**: the sequence is sound, no money-moving code is scheduled before the legal gate, nothing is scheduled live before the vendor gate, and no premature migration exists in the plan. Eight documentary/procedural findings were raised and all eight were resolved by the Program Director (`SEQUENCE-REVIEW.md` R-D1..R-D8); none breaches a hard invariant.

## The phased roadmap at a glance

| Phase | Goal | Money? | Key gate |
|---|---|---|---|
| P0 | Doc corrections + the live vendor-leak fix (pure code, ungated — R-D2) | no | none |
| P1a → P1b | Execute Gate D's 6-migration baseline, then land the versioned manifest-extension mechanism | no | Gate D runbook + Founder sign-off; P1b owned by the Identity Constitution program (R-D1) |
| P2 | CROA §404 counsel + Founder legal decision (parallel track from Day 0) | — | outside counsel |
| P3 → P3-live | LetterStream conformance (16 vendor questions + dry-run suite), then the `MAIL_LIVE` flip | no → **yes** | 16 vendor Qs + conformance green + Founder sign-off |
| P4 | Provider abstraction interface + `MailManifestFlags` migration (the DTO/leak-fix itself already shipped at P0 per R-D2) | no | P1b |
| P5 / P5-accel | Fulfillment Engine schema (Case/DisputePackage/Policy/Recovery) / schema-free `/mail` evolution over today's data | no | P1b (+P4 for P5) |
| P6a | Mail Center — **Download** workspace (wallet-free) | no | P5 |
| P6b | Mail Center — **Send** path | **yes** | P2, P7 |
| P7 | Wallet Runtime + Purchased Vector Credits | **yes** | P2 (legal) + P1b |
| P8a / P8b | Kai wallet-independent panels / Kai Recovery + money-narration | no / yes | P5 / P7 |
| P9a/b → P10a/b | Internal testing → beta rollout, Download and Send scopes separately | no / yes | scope-matched upstream |

Full table with flags/migrations/money-touching per phase: `EXECUTION-ROADMAP.md`.

## The 2 substantive resolutions (safety improvements, not mere documentation fixes)

- **R-D2 — ship the live vendor-leak fix ungated, now.** `app/api/mail/[mailId]/route.ts:13` serializes the raw `provider` field (e.g. `"letterstream"`) to any authenticated owner **today, live, in production**. The DTO + static guard + this fix are pure code, need no migration, and move into the **P0 / Track-0 ungated pass** — they must not wait behind Gate D. Only the `MailManifestFlags` additive migration remains at P4, still gated on P1b.
- **R-D5 — defer to the Gate-D runbook, not a flat command.** The base plan's P1a described running `migrate resolve --applied 0_init` directly. The runbook's own per-migration state taxonomy (read-only preflight → per-migration state determination → resolve only `SCHEMA_ONLY` migrations one at a time, re-preflighting after each) governs instead; a `0_init = ALL_ABSENT` reading **aborts** as wrong-target evidence rather than proceeding.

## The 1 cross-program Founder gate

- **R-D1 — name Identity as sole owner of P1b / Gate-D Slice 7.** P1b (the ID-B02 versioned manifest-extension mechanism that lets a 7th+ migration directory pass preflight) is the **same infrastructure** the Identity Constitution program needs for its own Implementation Slice 7. This document rules: the **Identity Constitution program is the sole owner**; Fulfillment consumes it, never re-implements it. Before P1b begins, the owner must pre-agree migration-directory numbering across both programs so they bump one shared manifest, not two competing ones. This is a Founder/owner coordination decision, not an engineering one.

## The hard gates (nothing proceeds past a closed gate)

1. **CROA §404 counsel** — blocks all money code (P2). Keeping the prepaid wallet does not moot the question.
2. **Gate D — P1a + P1b, both** — blocks all fulfillment schema.
3. **16 LetterStream vendor questions** (11 named + 5 adjacent — R-D3 makes all 16 hard, withdraws the "defer 5" option) — blocks the `MAIL_LIVE` flip.
4. **Earned VC instrument classification** — a separate, later-clearing counsel + CCO gate; does not map cleanly onto ADR-0038's five instruments (sixth instrument vs. productized promotional credit — open, not decided by this plan).
5. **§611-clock-without-receipt** — a separate, smaller open CCO question.

## Recommended next step

Not wallet implementation — it stays blocked on gates 1 and 2 above. The concrete next actions, in the order this plan supports them: (a) execute the R-D2 vendor-leak fix and the P0 documentation corrections (P-8) now — both are ungated pure-code/doc changes; (b) route the CROA §404 counsel question and, in parallel, execute Gate D P1a, then P1b under Identity-program ownership (R-D1); (c) once P1b clears, proceed on the wallet-free spine (P4 → P5 → P6a) toward the Download-only milestone, fully decoupled from counsel's timeline. Full detail: `CONTINUE-IN-CHATGPT.md`.
