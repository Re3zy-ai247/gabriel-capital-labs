# CreditVector Fulfillment Platform — Phase 1 Execution Plan — Risk and Gates

**2026-08-03 · branch `docs/fulfillment-engine-v1` · HEAD `fcfc5b6` · base `origin/main f449c35` (untouched)**

Base source: `docs/fulfillment/execution/RISK-REGISTER.md` (33 rows, severity-ranked) and `docs/fulfillment/execution/SEQUENCE-REVIEW.md` (8 findings, 8 resolutions R-D1..R-D8).

## Contents
1. [Risk register — top 12 by severity](#risk-register)
2. [The 8 sequence-review findings and resolutions](#sequence-review-findings)
3. [Founder decision gates](#founder-decision-gates)

## 1. Risk register — top 12 by severity <a id="risk-register"></a>

`RISK-REGISTER.md` grades **A — BLOCKING** (6 rows), **B — HIGH** (10 rows), **C — MEDIUM** (12 rows), **D — LOW/DEFERRED** (3 rows), **E — INFORMATIONAL** (1 row), plus 1 resolved-kept-for-record row (33 total). This section lists all 6 **A** rows plus the 6 **B** rows most directly load-bearing on the near-term phases (P0/P4/P6) and on the sequence-review's own findings — selection stated explicitly since the source register does not itself rank within a grade.

| ID | Grade | Risk | Phase | Mitigation / gate |
|---|---|---|---|---|
| R-01 | A | Gate D P1a/P1b non-atomicity + ID-B02: prod has no `_prisma_migrations` history; the preflight tooling hard-codes "exactly six directories" and rejects a 7th | P1a/P1b | `EXECUTION-PLAN.md` P-1 ruling adopts the split; `gate-d-preflight.test.ts` extended to prove byte-identical six-file coverage plus the new directory before any 7th migration is accepted |
| R-02 | A | Strict-gate deferral of all wallet code behind P2: every P7 stage, schema included, waits on CROA §404 counsel + Founder legal — the wall-clock is outside engineering control | P7 (transitively P6b/P8b/P9b/P10b/P3-live-settlement) | No P7 work proceeds past schema-sketch-on-paper before counsel answers; engineering keeps building the wallet-free Download path in parallel |
| R-03 | A | ADR-0044 vocabulary drift + F14 cascade-not-yet-applied in the base architecture docs — risks an implementer building against stale text | P0 | P-8 ruling: a small, unconditional documentation pass fixes both before any code is written against them |
| R-11 | A | The CROA §404 and §611 counsel gates (carried) — the top-level legal gate blocking all wallet money code, plus a separate open CCO question on §611-without-receipt | P2 | No plan schedules money code before these clear; a compliant alternative (Stripe manual-capture at delivery) is on file if §404 rules unfavorably |
| R-14 | A | Treating P2 as "just" a parallel track undersells that its answer may invalidate P7 entirely | P2/P7 | No P7 work proceeds past schema-sketch-on-paper before counsel answers (same mitigation as R-02) |
| R-17 | A | Shipping the Wallet/WalletLedger migration before `COMMITMENT-REGATE.md`'s must-fix items are proven **in code** (not just documented) would silently reintroduce a closed defect (F4) | P7 | `wallet-runtime.test.ts` executes every must-fix scenario as a negative-controlled case before `WALLET_ENABLED` is even proposed for flip |
| R-04 | B | The live Vendor-Opacity leak — `app/api/mail/[mailId]/route.ts:13` serializes the entire, unfiltered `MailManifest` (including `provider:"letterstream"`) to any authenticated owner, today, live, in production | P0 (moved forward from P4 by R-D2) | DTO boundary strips/replaces `provider` before any HTTP response; static + executing vendor-name regex guard |
| R-05 | B | The append-only audit-template ordering risk — `MailService.ts:186`'s `` `Accepted by ${provider.name}` `` template is dormant today but becomes permanent, unfixable, the instant `dispatch()` gets its first caller | P4 | Template changed to platform-neutral phrasing in the **same change** that gives `dispatch()` its first caller — never after |
| R-06 | B | The 16-question vendor set, including 5 adjacent gaps not among the named 11 (rate-card currency, CASS-endpoint existence, PDF delivery mechanism, metadata passthrough, health-check reality) | P3/P3-live | All 16 folded into the vendor Q&A packet, flagged, not silently merged into the 11 or ignored |
| R-12 | B | Rushing the ID-B02 manifest-extension under schedule pressure weakens the "exact six-file baseline equality" proof that makes Gate D auditable today | P1a/P1b | Extended preflight test proves coverage **plus** the new directory, not instead of it |
| R-13 | B | `certified: false`/`true` hardcode (`app/api/mail/prepare/route.ts:46`) ships un-fixed into a UI that now prominently displays price — tri-confirmed by three separate agents independently | P0/P6b | Block P6b's FINAL REVIEW price re-display on this fix landing first; CCO Gate 1 recorded before merge |
| R-27 | B | Agency-wide deficit blast radius — one chargeback can freeze an entire agency's wallet authorizations, because deficit-blocking is per-`Wallet` and one `Wallet` can be an agency | P7 | Carried forward verbatim, not scope-narrowed this cycle (Founder ruling: no redesign); test documents, does not fix, the residual |

Full 33-row register: `docs/fulfillment/execution/RISK-REGISTER.md` §1–§2.

## 2. The 8 sequence-review findings and resolutions <a id="sequence-review-findings"></a>

Per `SEQUENCE-REVIEW.md` — "8 findings; all documentary/procedural, none breaches a hard invariant." Each finding's Program Director resolution **supersedes conflicting earlier text** in the base execution docs.

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | P1b == Identity Constitution Slice 7 (same underlying files) with no sole owner named → collision risk | HIGH | **R-D1 — FOUNDER GATE + ruling.** The Identity Constitution program is the sole owner of P1b / Gate-D Slice 7; Fulfillment consumes it, never re-implements it. Before P1b begins, the owner pre-agrees migration-directory numbering across both programs. |
| 2 | The live vendor-leak fix (pure code) was demoted from an ungated Track-0 pass into Gate-D-gated P4 | MED-HIGH | **R-D2 — ADOPTED.** Split P4: the Vendor Opacity DTO + static guard + the live-leak fix ship in the **P0 / Track-0 ungated pass** — the leak is live in production today and must not wait behind Gate D. Only the `MailManifestFlags` migration remains at P4, behind P1b. |
| 3 | Vendor-gate count: the adapter plan still says "11" with a defer-past-go-live option; the master plan says 16 hard | MED | **R-D3 — RULING.** The vendor-confirmation set is **16** (11 named + 5 adjacent), all hard preconditions of the `MAIL_LIVE` flip; the "defer 5 past go-live" option is withdrawn. The adapter plan is corrected to 16 as a documentary follow-up; the master plan governs. |
| 4 | Master critical-path prose drops P4 even though the dependency table has P5←P4 → the path is one node longer than stated | MED | **R-D4 — CORRECTED.** Engineering critical path including P4: `P0 → P1a → P1b → P4 → P5 → P6a → P7(∥P2) → P6b → P3-live → P9b → P10b`. Earliest wallet-free milestone including P4: `P0 → P1a → P1b → P4 → P5 → P6a → P9a → P10a`. |
| 5 | P1a prescribes a flat `resolve --applied 0_init` where the runbook says migration state is UNKNOWN until preflight | MED | **R-D5 — CORRECTED.** P1a defers to the Gate-D runbook's per-migration state taxonomy (read-only preflight → per-migration state determination → resolve only `SCHEMA_ONLY` migrations one at a time, re-preflighting after each; a `0_init = ALL_ABSENT` reading ABORTS as wrong-target evidence). Not a flat `resolve 0_init`. |
| 6 | P1b is heavier than "admit a 7th directory" — the preflight pins 34 tables/304 columns/21 FKs/62 indexes/11 enums; every wave bumps them | MED | **R-D6 — RULING.** P1b is a **per-wave** manifest-derivation mechanism, not a one-time unlock: every subsequent migration wave (P4, P5, P7, and Identity's own tables) re-derives the pinned totals through it. Owner = the Identity Constitution program (R-D1). |
| 7 | Flag-name drift (`WALLET_ENABLED` vs. `WALLET_RUNTIME_ENABLED`; `FULFILLMENT_ENGINE` vs. `_POLICY_ENGINE`) — fail-closed, but latent | LOW-MED | **R-D7 — PINNED.** Canonical flag literals: `WALLET_ENABLED` (Send/money), `FULFILLMENT_ENGINE_ENABLED` (P5), `FULFILLMENT_PACKAGE_UI_ENABLED` (P6a Download UI), `MAIL_LIVE` (live provider). All default OFF via the exact `=== "true"` idiom. Domain-doc aliases are superseded. |
| 8 | In-flight Send-hold rollback isn't clean (flag-off blocks new authorize, doesn't mass-release; post-acceptance is irreversible) — disclosed, architecture-accepted | LOW | **R-D8 — DISCLOSED, architecture-accepted.** In-flight rollback is forward-recovery (Recovery Engine `adjust`), never undo; post-acceptance is irreversible by design. The rule "flip `WALLET_ENABLED` to production only after Download-only has ≥1 clean release cycle" is a manual runbook check, not CI-automated. |

**Net verdict** (`SEQUENCE-REVIEW.md` §Net): "Sequence READY-WITH-DISCLOSURES; R-D2 and R-D5 are the two substantive pre-phase corrections (both improve safety), R-D1 is the one genuine cross-program Founder coordination gate, the rest are documentary. Nothing money-moving before P2; nothing live before the 16-question vendor gate. No implementation follows without Founder approval."

## 3. Founder decision gates <a id="founder-decision-gates"></a>

Per `EXECUTION-PLAN.md` §5, unchanged in substance by the review — nothing proceeds past a closed gate:

1. **CROA §404 counsel** — blocks all money code (P2 gates P6b/P7/P8b/P3-live-settlement).
2. **Gate D Phase −1** (P1a **and** P1b) — blocks all fulfillment schema; P1b's ownership is itself now a Founder-gated cross-program decision (R-D1).
3. **16 LetterStream vendor questions** — block live wiring (R-D3 makes all 16 hard, no deferral).
4. **Earned VC instrument classification** (sixth ADR-0038 instrument vs. productized promotional credit) — a CCO/Founder decision, gates the Earned VC ledger specifically.
5. **§611-clock-without-receipt** — a separate, smaller open CCO question.
6. **Founder sign-offs** — the `MAIL_LIVE` flip, each production migration apply, and each money-flag flip, each individually. Keeping the prepaid wallet does not moot gate 1.
