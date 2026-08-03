# Phase 1 Execution Sequence — Adversarial Review + Disclosure Resolutions

Single bounded Opus review, scope = the implementation SEQUENCE only (architecture locked, not re-litigated). Baseline `docs/fulfillment-engine-v1` @ `63246ec`, read-only.

## Verdict: READY-WITH-DISCLOSURES
The sequence is fundamentally sound. Verified holds: **no money-moving code is scheduled before the CROA/legal gate (P2)**; **nothing live before the 16-question vendor gate**; **no premature migration** (the Gate D preflight rejects any 7th directory via exact-chain + count===6, so early tables would fail — which is exactly why P1b gates them; MailManifestFlags is schema-declared with no FK to the self-heal MailManifest, so the self-heal allowlist stays green); the Download path is dependency-clean (Case/DisputePackage/DisputePackageLetter/Claim and the Journey read-model pull no wallet field; `Claim`'s WALLET enum value ≠ a Wallet-table dependency). No architecture reopening; no scope violation. Rollout is fail-closed and staged only over already-gate-cleared features. No surviving blocker.

## Findings (8; all documentary/procedural, none breaches a hard invariant)
| # | Finding | Sev | Cite |
|---|---|---|---|
| 1 | P1b == Identity Constitution Slice 7 (same files) with no sole owner named → collision risk | HIGH | IDENTITY-…-PLAN §Slice 7 vs EXECUTION-PLAN P-1 |
| 2 | The live vendor-leak fix (pure code) was demoted from ungated Track 0 into Gate-D-gated P4 | MED-HIGH | route.ts:13; EXEC-SEQUENCING Track 0 vs EXECUTION-PLAN P-7 |
| 3 | Vendor-gate count: adapter plan still says "11" with a defer-past-go-live option; master says 16 hard | MED | LETTERSTREAM-ADAPTER-PLAN §4.3/§5 vs EXECUTION-PLAN P-6 |
| 4 | Master critical-path prose drops P4 (dependency table has P5←P4) → path one node longer | MED | EXECUTION-PLAN §3 |
| 5 | P1a prescribes `resolve --applied 0_init` where the runbook says migration state is UNKNOWN until preflight | MED | MIGRATION-PLAN §0 vs gate-d runbook §3/§7 |
| 6 | P1b is heavier than "admit a 7th dir" — the preflight pins 34 tables/304 cols/21 FKs/62 idx/11 enums; every wave bumps them | MED | gate-d-preflight.test.ts:366-398 |
| 7 | Flag-name drift (WALLET_ENABLED vs WALLET_RUNTIME_ENABLED; FULFILLMENT_ENGINE vs _POLICY_ENGINE) — fail-closed, latent | LOW-MED | FEATURE-FLAG-STRATEGY §5 |
| 8 | In-flight Send-hold rollback isn't clean (flag-off blocks new authorize, doesn't mass-release; post-acceptance irreversible) — disclosed, architecture-accepted | LOW | ROLLBACK-STRATEGY §5; RISK-REGISTER R-26 |

## Program Director resolutions (these supersede conflicting earlier text)
- **R-D1 (Finding 1) — FOUNDER GATE + ruling.** The Identity Constitution program is the SOLE OWNER of P1b / Gate-D Slice 7 (it is that program's infrastructure); Fulfillment CONSUMES it and does not re-implement it. Before P1b begins, the owner pre-agrees the migration-directory numbering across both programs (which program claims directory #7, #8, …) so both bump one shared manifest. This cross-program coordination is a Founder/owner decision gate.
- **R-D2 (Finding 2) — ADOPTED.** Split P4. The Vendor Opacity DTO + static guard + the live-leak fix (`app/api/mail/[mailId]/route.ts:13`) are PURE CODE needing no migration and ship in the **P0 / Track-0 ungated pass** — the leak is live in production today and must not wait behind Gate D. Only the `MailManifestFlags` additive migration remains at P4 behind P1b. (Master phase table amended accordingly.)
- **R-D3 (Finding 3) — RULING.** The vendor-confirmation set is **16** (11 named + 5 adjacent), all hard preconditions of the `MAIL_LIVE` flip; the "defer 5 past go-live" option is withdrawn. LETTERSTREAM-ADAPTER-PLAN §4.3/§5 is corrected to 16 (documentary follow-up; the master governs).
- **R-D4 (Finding 4) — CORRECTED.** The engineering critical path including P4 is: **P0 → P1a → P1b → P4 → P5 → P6a → P7(∥P2) → P6b → P3-live → P9b → P10b.** Earliest wallet-free milestone including P4: **P0 → P1a → P1b → P4 → P5 → P6a → P9a → P10a.** (P4's DTO half moves to P0 per R-D2, but P4's MailManifestFlags migration remains a spine node the Fulfillment Engine's `attention` mechanism consumes.)
- **R-D5 (Finding 5) — CORRECTED.** P1a defers to the Gate-D runbook's per-migration state taxonomy (read-only preflight → per-migration state determination → resolve only SCHEMA_ONLY migrations one at a time, re-running preflight after each; a `0_init = ALL_ABSENT` reading ABORTS as wrong-target evidence). The plan does not prescribe a flat `resolve 0_init`.
- **R-D6 (Finding 6) — RULING.** P1b is a PER-WAVE manifest-derivation mechanism, not a one-time unlock: every subsequent migration wave (P4, P5, P7, and the Identity program's own tables) re-derives the pinned totals through it. Owner = the Identity Constitution program (R-D1); Fulfillment's waves reconcile through it.
- **R-D7 (Finding 7) — PINNED.** Canonical flag literals: `WALLET_ENABLED` (Send/money), `FULFILLMENT_ENGINE_ENABLED` (P5), `FULFILLMENT_PACKAGE_UI_ENABLED` (P6a Download UI), `MAIL_LIVE` (live provider). All default OFF via the exact `=== "true"` idiom. Domain-doc aliases are superseded by these.
- **R-D8 (Finding 8) — DISCLOSED, architecture-accepted.** In-flight Send-hold rollback is forward-recovery (Recovery Engine `adjust`), never undo; post-acceptance is irreversible by design. The owner-gated rule "flip WALLET_ENABLED to production only after the Download-only path has ≥1 clean release cycle" is a manual runbook check (acceptable — money-flag flips are owner-gated, never CI-automated).

## Net
Sequence READY-WITH-DISCLOSURES; R-D2 and R-D5 are the two substantive pre-phase corrections (both improve safety), R-D1 is the one genuine cross-program Founder coordination gate, the rest are documentary. Nothing money-moving before P2; nothing live before the 16-question vendor gate. No implementation follows without Founder approval.
