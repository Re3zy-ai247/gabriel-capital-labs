# CreditVector Fulfillment Platform — Phase 1 Execution Plan — Execution Roadmap

**2026-08-03 · branch `docs/fulfillment-engine-v1` · HEAD `fcfc5b6` · base `origin/main f449c35` (untouched)**

Base source: `docs/fulfillment/execution/EXECUTION-PLAN.md` §3 (the unified phase table, adjudicated rulings P-1..P-8) and §5 (gate list), corrected per `docs/fulfillment/execution/SEQUENCE-REVIEW.md`'s **R-D2** (P4 split — the DTO/leak-fix moves to P0) and **R-D4** (critical path corrected to include P4). Flag literals per `SEQUENCE-REVIEW.md` **R-D7** (canonical names, pinned). Migration order per `docs/fulfillment/execution/MIGRATION-PLAN.md`.

## Contents
1. [The unified phase table](#the-unified-phase-table)
2. [What changed from the base plan — R-D2 and R-D4](#what-changed)
3. [The corrected critical path](#the-corrected-critical-path)
4. [The earliest wallet-free milestone](#the-earliest-wallet-free-milestone)
5. [Standing constraints (every phase inherits these)](#standing-constraints)

## 1. The unified phase table <a id="the-unified-phase-table"></a>

| Phase | Goal | Money-touching? | Gate dependency | Flag (canonical, R-D7) | Migration |
|---|---|---|---|---|---|
| **P0** | Doc corrections (P-8: F11/F13/F14, ADR-0044 vocabulary, 3 LOW re-gate items) **+ the live vendor-leak fix** (DTO + static guard for `app/api/mail/[mailId]/route.ts:13`, pure code — moved here by **R-D2**) | no | none | — | none |
| **P1a** | Execute the 6 already-committed migrations against production; resolve the missing `_prisma_migrations` baseline first, per the Gate-D runbook's own per-migration state taxonomy (corrected by **R-D5** — not a flat `resolve 0_init`) | no | Gate D runbook + Founder sign-off | — | applies existing 6 |
| **P1b** | Versioned manifest-extension mechanism (ID-B02) so a 7th+ migration directory can pass preflight. **Sole-owned by the Identity Constitution program** (R-D1); Fulfillment consumes, does not re-implement. **Per-wave, not one-time** — every later migration wave re-derives the pinned totals through it (R-D6) | no | P1a | — | tooling, no feature schema |
| **P2** | CROA §404 counsel + Founder legal decision (parallel track, Day 0) | — (decision gate) | external counsel | — | none |
| **P3** | LetterStream conformance — answer the **16** vendor questions (11 named + 5 adjacent; R-D3 withdraws the "defer 5" option) + dry-run conformance suite | no | vendor docs | `MAIL_LIVE` stays OFF | none |
| **P4** | Provider abstraction interface + `MailManifestFlags` migration. (The Vendor Opacity DTO/guard/leak-fix itself already shipped at P0 per R-D2 — only the migration remains here.) | no | P1b | — | `MailManifestFlags` (own directory, additive) |
| **P5** | Fulfillment Engine — Case/DisputePackage/DisputePackageLetter/Claim/state machine/Policy Engine/Recovery skeleton (non-money) | no | P1b, P4 | `FULFILLMENT_ENGINE_ENABLED` | Tier-1 batch (additive) |
| **P5-accel** | Schema-free `/mail` evolution over today's `Letter[]` (queue/band/drawer/metrics/timeline) — needs no `DisputePackage` | no | P1b only | `FULFILLMENT_PACKAGE_UI_ENABLED` | none |
| **P6a** | Mail Center **Download** workspace + Package Review chain steps 1–7 → package-level Download | no | P5 (+P4 evidence contract) | `FULFILLMENT_PACKAGE_UI_ENABLED` | none |
| **P6b** | Mail Center **Send** path (Wallet Authorization, FINAL REVIEW, Submit) | **yes** | P2, P7 | + `WALLET_ENABLED` | none |
| **P7** | Wallet Runtime + Vector Credits (Purchased VC) | **yes** | **P2 (legal)** + P1b | `WALLET_ENABLED` (per-ledger flags for future VC tiers) | `Wallet` anchor + `WalletLedger` (own directory, additive) |
| **P8a** | Kai Summary / Recommended Disputes / Educational Explanation panels (wallet-independent, zero-AI, zero-network) | no | P5 | `KAI_PACKAGE_ENABLED` | none |
| **P8b** | Kai Recovery + money-narration catalog (19-class `kaiCopyClass`) | **yes** | P7 | + `WALLET_ENABLED` (no separate flag) | none |
| **P3-live** | LetterStream live wiring — the `MAIL_LIVE` flip | **yes** | 16 vendor Qs + conformance green + Vendor Opacity guard green + `MailManifestFlags` shipped + Founder sign-off | `MAIL_LIVE` | none |
| **P9a / P9b** | Internal Founder testing — Download path / Send path | no / yes | P6a / P6b + P3-live | — | none |
| **P10a / P10b** | Beta rollout, cohort-scoped — Download / Send | no / yes | P9a / P9b | staged flag % | none |

Sources: `EXECUTION-PLAN.md` §3–§5; flag literals per `FEATURE-FLAG-STRATEGY.md` §1 and `SEQUENCE-REVIEW.md` R-D7 (pinning `WALLET_ENABLED`, `FULFILLMENT_ENGINE_ENABLED`, `FULFILLMENT_PACKAGE_UI_ENABLED`, `MAIL_LIVE` as the canonical literals — domain-doc aliases such as `WALLET_RUNTIME_ENABLED` or `FULFILLMENT_POLICY_ENGINE_ENABLED` are superseded).

## 2. What changed from the base plan — R-D2 and R-D4 <a id="what-changed"></a>

The Program Director's original `EXECUTION-PLAN.md` §3 table listed all of P4 — "Provider abstraction — interface + Vendor Opacity DTO/guard (fixes the live leak)" — as one phase gated on P1b, and its own critical-path prose sentence omitted P4 entirely even though the same table's dependency column requires P5 to wait on P4. The Opus sequence review caught both issues and the Program Director's resolutions correct them:

- **R-D2 (the P4 split):** the live leak (`app/api/mail/[mailId]/route.ts:13` serializes the raw `provider` field to any authenticated owner, today, in production) is a pure-code fix needing no migration. It does not need to wait behind Gate D. It ships in the **P0 / Track-0 ungated pass**. Only the `MailManifestFlags` additive migration — which the fail-closed `attention` mechanism genuinely needs a compliant place to live — remains at P4, still behind P1b. The dormant audit-template string (`MailService.ts:186`, resolves to `"Accepted by LetterStream"`) must be neutralized in the **same change** that first gives `dispatch()` a caller, since the audit trail is append-only and this is a one-shot, no-do-over fix (`RISK-REGISTER.md` R-05).
- **R-D4 (the critical-path correction):** both the engineering critical path and the earliest wallet-free milestone are restated to include P4 explicitly (§3 below). `DEPENDENCY-GRAPH.md` §5 flagged the identical omission independently, before the Opus review ran, and self-corrected its own graph the same way — the two corrections agree.

## 3. The corrected critical path <a id="the-corrected-critical-path"></a>

**Engineering critical path (Send):**

```
P0 → P1a → P1b → P4 → P5 → P6a → P7(∥P2) → P6b → P3-live → P9b → P10b
```

Bottleneck is **P2's wall-clock** (outside counsel) — outside engineering control (`EXECUTION-PLAN.md` §3; `SEQUENCE-REVIEW.md` R-D4).

## 4. The earliest wallet-free milestone <a id="the-earliest-wallet-free-milestone"></a>

```
P0 → P1a → P1b → P4 → P5 → P6a → P9a → P10a
```

Download Package live, zero wallet, zero live provider, decoupled from CROA and vendor Q&A (`SEQUENCE-REVIEW.md` R-D4). **Even earlier operator-visible value:** `P5-accel` ships the evolved `/mail` room over existing data with one flag the moment `P1b` clears — no P4, no P5 schema needed at all (`MAIL-CENTER-EVOLUTION-PLAN.md` §1.4; `DEPENDENCY-GRAPH.md` §3).

## 5. Standing constraints (every phase inherits these) <a id="standing-constraints"></a>

Per `EXECUTION-PLAN.md` §6, unchanged by the review:

- **Additive-migration-first** — 0 `DROP`, no new self-heal table. No build step mutates the database.
- **Flags fail-closed** — exact-string `=== "true"` idiom, default OFF, no truthy coercion, for every flag in the ladder (`FEATURE-FLAG-STRATEGY.md` §4).
- **Provider Acceptance is irreversible** — a settled hold stays settled; post-acceptance remediation is accounting `adjust` only; never pretend a mailing didn't happen.
- **Vendor Opacity from day one** — operator-facing surfaces never carry a provider identifier, not a late-cycle polish item.
- **Case Journey Runtime is the primary workflow** — Mail Center, Wallet, Kai, Timeline, and Mission Control are participants/views of the Journey, not separate sources of "what's next."
- **No third architecture cycle** — this plan schedules nothing money-moving before its legal gate (P2) and nothing live before its vendor gate (the 16-question set).
