# TESTING-STRATEGY.md — Aggregate Test & Validation Strategy

Consolidation only. Pulls every domain doc's test/validation section into one strategy, organized by phase and by category (static / executing / conformance / manual sign-off). Sources: `EXEC-SEQUENCING.md` §1.1/§6/§6.1, `LETTERSTREAM-ADAPTER-PLAN.md` §4, `WALLET-VC-RUNTIME-PLAN.md` §5.3, `CASE-JOURNEY-RUNTIME-PLAN.md` §5.2, `MAIL-CENTER-EVOLUTION-PLAN.md` §5.

---

## 1. Per-phase validation gates

| Phase | Exit criteria (what must be true to leave this phase) | Source |
|---|---|---|
| P0 | Each ADR (0041–0047) + the doc corrections (F11/F13/F14, ADR-0044 vocabulary, the 3 LOW re-gate fidelity items) has a recorded status | `EXEC-SEQUENCING.md` §1.1; `EXECUTION-PLAN.md` P-8 |
| P1a | All six `ALL_PRESENT_AND_MATCHING`; `NO_PENDING_MIGRATIONS`; 5 platform flags still OFF; `x-cv-release` unchanged | `EXEC-SEQUENCING.md` §1.1 |
| P1b | Extended `gate-d-preflight.test.ts` proves byte-identical six-file coverage **plus** the new directory; `--manifest` machine-derived totals match; runbook §15 approval ledger completed | `EXEC-SEQUENCING.md` §1.1/§6 |
| P2 | Counsel's written answer received; Founder selects A/B/C | `EXEC-SEQUENCING.md` §1.1 |
| P3 | All 16 vendor cells (11 + 5 adjacent) filled or confirmed worst-case; conformance battery green in dry-run | `LETTERSTREAM-ADAPTER-PLAN.md` §5, §4.1 |
| P4 | `validateAddress` returns `undefined` not fabricated `true`; DTO strips `MailReceipt.provider`; regex guard green; `UNKNOWN_PROVIDER_STATUS` defined; `MailManifestFlags` migration applied | `EXEC-SEQUENCING.md` §1.1; `MIGRATION-PLAN.md` §5 |
| P5 | Tier-1 migrations applied; prepare/confirm consult the Policy Engine behind flag; guards green | `EXEC-SEQUENCING.md` §1.1 |
| P5-accel | `/mail` row-level evolution ships; priority-ladder sort matches `mailHealth()`'s branches | `MAIL-CENTER-EVOLUTION-PLAN.md` §1.4, §5 |
| P6a | Evolved work-queue/evidence-drawer/9-step chain through step 8 live; Approval-card split done; CCO Gate 3 recorded | `EXEC-SEQUENCING.md` §1.1 |
| P6b | Wallet Authorization line-items; 402→top-up; FINAL REVIEW token wired; CCO Gate 2 recorded | `EXEC-SEQUENCING.md` §1.1 |
| P7 | `wallet-runtime.test.ts` proves must-fix A1–A5/B6–B9 **in code**; `WALLET_ENABLED` stays OFF | `EXEC-SEQUENCING.md` §1.1/§6 |
| P8a | Kai Summary/Recommended/Educational panels render, zero-AI/zero-network, wallet-independent | `MAIL-CENTER-EVOLUTION-PLAN.md` §1.6 |
| P8b | 7 contracts registered, guard-green, `EVENT_BUS_ENABLED` still OFF; `waiting.*` stays derive-on-read | `EXEC-SEQUENCING.md` §1.1 |
| P3-live | Full 6-point go-live checklist (§4 below) | `LETTERSTREAM-ADAPTER-PLAN.md` §4.3 |
| P9a/P9b | Full guard suite + `release-verify.sh` green; CCO Gate 4; cohort-scoped rollout | `EXEC-SEQUENCING.md` §1.1 |
| P10a/P10b | Beta cohort live; `MAIL_LIVE` stays its own separate runbook item | `EXEC-SEQUENCING.md` §1.1 |

---

## 2. Static guards (cheap, run pre-merge, catch literal/structural violations)

| Guard | Asserts | Phase |
|---|---|---|
| `scripts/gate-d-preflight.test.ts` (extended) | Byte-identical six-file baseline coverage plus the new versioned directory | P1a/P1b |
| `scripts/schema-safety.test.ts` | `newlySelfHealed.length === 0` stays green unmodified — no new table added to `LEGACY_SELF_HEAL_ALLOWLIST` | Every migration, P4/P5/P7 |
| `scripts/vendorOpacity.test.ts` (static half) | Grep sweep for `/letterstream\|postgrid\|click2mail\|postalmethods\|\blob\b/i` outside the adapter-file allowlist | P4 |
| `approval-card-split.test.ts` | Approve control's DOM subtree never shares a container with a KAI-badge element | P6a |
| `wallet-migration-guard.test.ts` (static half) | Each new wallet table's migration touches no pre-existing table | P7 |
| Cross-ledger-conversion-refused, static half | Zero cross-imports between `lib/vc/purchased/**`, `lib/vc/earned/**`, `lib/vc/bonus/**`, `lib/vc/pendingPayout/**`, in any direction (mirrors the existing wallet-vs-`lib/reputation/**` guard) | P7 (and any future VC ledger) |
| Naming-collision guard | Static grep over operator-facing/Kai/marketing copy asserting no string implies VC-earning changes XP or that XP converts to VC | P7+ (VC surfaces) |
| `journey-no-fabrication.test.ts` | No Journey stage renders `done`/`current` without its owning row/event/flag present | P5/P6a |
| `scripts/kai-manifest.test.ts` (extended) | Zero Bus-contract registration for `waiting.started`/`waiting.ready_for_review` (no second driftable clock source) | P8a/P8b |

## 3. Executing guards (run against fixtures/DB, catch dynamic/runtime violations)

| Guard | Asserts | Phase |
|---|---|---|
| `scripts/mail.test.ts` (existing 38 assertions, extended) | Interface completeness, dry-run/live symmetry, status-mapping totality, rate-card containment, error-code fidelity | P3/P4 |
| `scripts/vendorOpacity.test.ts` (executing half) | DTO boundary functions, called with fixtures covering all five `MailProviderId` values, produce zero regex matches in JSON-serialized output | P4 |
| `scripts/fulfillmentPolicy.test.ts` | `UNKNOWN_PROVIDER_STATUS` totality asserted against the same transition table the conformance battery uses | P4/P5 |
| `wallet-runtime.test.ts` | Every must-fix A1–A5/B6–B9 scenario, plus the 7 cases in §6 below, as negative-controlled cases | P7 |
| `journey-read-model.test.ts` | Pure function; fixture rows + events produce the correct 9-node array across an empty/mid-flight/completed/pre-`DisputePackage` Case | P5/P6a |
| `journey-idempotent-events.test.ts` | Replay-dedupe on the three adopted Event Bus contracts (`DISPUTE_CREATED@1`/`LETTER_GENERATED@1`/`LETTER_SENT@1`) | P8a/P8b |
| `journey-rollup-fidelity.test.ts` | Journey-rendered stage === `DisputePackage.stage`/`Case.state` for a randomized fixture sample | P5/P6a |
| `journey-recommendation-loop.test.ts` | `pickRecommendation()`/`assembleExecution()` outputs are cited verbatim inside node 9, never recomputed | P8a |
| `journey-wallet-interim.test.ts` | With the wallet flag OFF: Wallet Authorization + Send-path Fulfillment always render `placeholder`; Download completes a full 9-node Journey standalone | P6a (pre-P7) |
| Manual QA: priority-ladder order | Ladder order matches `mailHealth()`'s branches | P5-accel |
| Manual QA: Package Review step 3 | Renders the same primary pick `app/letters/page.tsx` already made, never a second computation | P6a |
| `npx next build` + manual print-preview diff | Multi-letter print aggregator does not regress the existing single-letter `/letters/print/[id]` output | P6a |
| `release-verify.sh` | Full guard suite green before any internal/beta cohort flip | P9a/P9b |

## 4. Adapter conformance suite (LetterStream) — dry-run gate, no vendor answer needed to build or run

**Base battery** (`LETTERSTREAM-ADAPTER-PLAN.md` §4.1, additive to `scripts/mail.test.ts`): interface completeness · dry-run/live symmetry · status-mapping totality (no fallback to a forward-progress status for an unrecognized value) · rate-card containment (no test outside the adapter's own file asserts a specific dollar amount) · error-code fidelity (only the six defined `MailProviderErrorCode` values, never a bare `Error`) · no vendor leakage.

**Negative / idempotency cases** (`LETTERSTREAM-ADAPTER-PLAN.md` §4.4):

| Case | Pass criterion |
|---|---|
| Duplicate submission | Exactly one manifest/wallet effect; the second call returns `completed`, never re-runs `applyTransition` |
| Webhook replay | Redelivery acknowledged 200; zero duplicate transition |
| Out-of-order delivery | Manifest lands at the correct furthest status; no orphaned intermediate audit entries; no backward jump |
| Unknown/unmapped raw status | `status` untouched; `attention` raised with `reasonCode:"unknown_provider_status"`; never silently advances |
| Ambiguous timeout | Hold neither released nor settled; no automatic retry absent vendor confirmation (Q10) |
| Double-click / duplicate HTTP submission | Exactly one authorize/settle sequence regardless of click count |
| Race: webhook and sweep both report the same transition | First claim wins; the second observes `in_flight`→`completed` and no-ops |
| Cancel attempted post-acceptance | No fulfillment-layer code path reaches `cancelMailJob` for a manifest at/after `ACCEPTED`; `cancelRequest` is raised instead, `status` never mutated |

**Sandbox gate** (§4.2): if a LetterStream test/sandbox environment exists, the identical battery re-runs against it before any production credential is used; if none exists, pre-live validation is limited to (a) the dry-run suite and (b) a single, Founder-supervised, manually-verified live piece (FOUNDER-GATE, not decided in the source plan).

## 5. Wallet runtime guard suite (Purchased VC + the four-ledger extension)

Two-file split, precedent from Reputation: `<domain>-migration-guard.test.ts` (static) + `<domain>-runtime.test.ts` (executing). (`WALLET-VC-RUNTIME-PLAN.md` §5.3.)

| Case | Assertion | Scope |
|---|---|---|
| Double-authorize | A second `authorize` for the same `(subject, attempt)` returns the original row, never a second hold | Purchased VC only |
| Double-settle | A second `settle` for the same tuple is an idempotent replay, not an error | Purchased VC only |
| Settle-after-release / release-after-settle | Both directions refused symmetrically | Purchased VC only |
| Unknown-amount | Non-positive/non-integer/implausible amount credits nothing, on any `fund` | All four ledgers |
| Webhook-replay | A redelivered Stripe event credits exactly once | Purchased VC today; inherited by any future ledger with a webhook-sourced trigger |
| Cross-ledger-conversion-refused | (a) static zero-cross-import; (b) runtime refusal of a cross-ledger `reversesId`; (c) a Purchased VC deficit does not block an Earned VC `fund` call, and vice versa, all twelve directional pairs | All four ledgers, pairwise |
| Naming-collision guard | Static grep asserting no copy string implies VC-earning changes XP or XP converts to VC | All four ledgers vs. `lib/reputation/**`'s copy surface |

## 6. Manual sign-off (never CI-automated)

| Gate | Phase | Reviews |
|---|---|---|
| CCO Gate 1 | P0 exit | vendor-opacity copy, neutral audit phrasing, certified-pricing display |
| CCO Gate 2 | P7 entry/exit | Wallet Authorization line-items, 402 top-up messaging, FINAL REVIEW warning copy |
| CCO Gate 3 | P6a entry | all Mail Center/Package Review copy incl. the disabled-Send affordance |
| CCO Gate 4 | P9/P10, before each flag flip | re-review at actual activation time |
| CCO Gate 5 | before `MAIL_LIVE` | full CSO+CCO review, ADR-0011 |
| CROA §404 counsel gate | P2 | full legal analysis |
| LetterStream go-live checklist (6-point, all required) | P3-live | (1) all 16 vendor questions answered; (2) conformance suite green incl. every negative/idempotency case; (3) Vendor Opacity guard green (static+executing); (4) `MailManifestFlags` migration shipped; (5) honest `deliverable` fix shipped; (6) explicit Founder sign-off — human, never CI-automated |
| Founder sign-offs | P1a/P1b apply, each production migration, each money-flag flip, `MAIL_LIVE` flip | Per `EXECUTION-PLAN.md` §5 item 6 |

(`EXEC-SEQUENCING.md` §6.1; `LETTERSTREAM-ADAPTER-PLAN.md` §4.3.)

---

## 7. Existing guard suite — must stay green, untouched

This program's migrations and flags are additive-only; none may regress a pre-existing guard. Named explicitly:
- `scripts/schema-safety.test.ts` — the frozen 32-table legacy allowlist and its `newlySelfHealed.length === 0` assertion (§2 above).
- Money-path runtime guards that predate this program (e.g., the existing Stripe webhook/entitlements guards) — unmodified except for the three new branches named in `WALLET-VC-RUNTIME-PLAN.md` §1.5 (`clawback`/`adjust`), which are additive, not replacing.
- Any guard suite for a system outside this program's domain (the source docs do not name a specific "cxos" guard file; this is a general regression-safety instruction, not a citation) — the additive-only discipline (`EXECUTION-PLAN.md` §6) applies transitively: no new migration or flag introduced by this plan may cause an unrelated, pre-existing guard script to fail.

---

## 8. What cannot be tested pre-vendor / pre-legal

**Cannot be tested pre-vendor (live provider behavior):**
- Whether a LetterStream sandbox exists at all is itself unconfirmed (`LETTERSTREAM-ADAPTER-PLAN.md` §4.2) — the dry-run suite can prove the code path never fabricates a status, but cannot prove the vendor's actual API shape, actual status vocabulary (Q8), actual cancel/refund behavior (Q1–Q5), or actual webhook existence (Q6) until answered.
- Rate-card accuracy (A1) and CASS-endpoint existence (A2) are unconfirmable against a hardcoded table — no test can assert the price or address-validation result is *correct*, only that it is *consistently applied*.
- The `attention` flag's actual persistence cannot be proven until `MailManifestFlags` ships (P4) — pre-P4, the suite proves only that the code path never falls through to a fabricated `PROVIDER_ACCEPTED`.

**Cannot be tested pre-legal (real money movement):**
- No `WalletLedger` row may ever be written in any non-test environment before P1+P2 clear (`WALLET-VC-RUNTIME-PLAN.md` §1.7) — so no test can validate real settlement against a real Stripe charge pre-gate. What **can** be validated pre-gate, in a local/test harness only: every guard-suite case in §5 above, proving the mechanism is correct before the money is real.
- The Earned/Bonus/Pending-Payout VC ledgers have no schema, so no test of any kind exists for them yet (rows 11–13 of `MIGRATION-PLAN.md` are DEFERRED, not scheduled).
- Post-acceptance settlement irreversibility cannot be exercised against a real mailed piece pre-`MAIL_LIVE` — only the guard-level refusal logic (settle-after-release, release-after-settle) can be proven in a test harness.
