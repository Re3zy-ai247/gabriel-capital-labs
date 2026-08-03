# Implementation Sequence — CreditVector Fulfillment Engine v1.0

Agent E (Architecture Merge) · Status: **PROPOSED** · Bounded toward a September 1, 2026 target: every phase below ships **flags OFF**, product behavior byte-identical to today until an owner-gated flip. Nothing in this document authorizes writing code — it is the sequencing plan the Founder reviews before Phase 1 begins. Full technical detail lives in the appendices; this document sequences, it does not re-specify.

---

## 0. Reading order for implementers

`CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` (the unified architecture + resolved docket) → this document (the sequence) → the specific appendix for the phase at hand. Do not implement from an appendix alone — the merge doc's corrections (settlement moment, claim-table unification, `policyVersion`, `UNKNOWN_PROVIDER_STATUS`, `package.authorized` rename) supersede an appendix's original phrasing where the two differ (Risk Register items #8/#9 name exactly this failure mode).

---

## 1. Phase 0 — Founder Ratification (Day 0, no code)

**Entry criteria:** this merge doc set (`CREDITVECTOR-FULFILLMENT-ENGINE-V1.md`, `ADR-PROPOSALS.md`, `OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md`, this document) exists and has been reviewed by the Program Director.

**Work:** Founder reviews and rules on: (a) the 17-item resolved docket, (b) ADR-0041–0045 (accept/reject/amend each independently — they have different blast radii per `ADR-PROPOSALS.md`'s closing note), (c) the Operational Room Constitution proposal (ratify / hold / reject), (d) the FOUNDER-GATE decisions that block a specific later phase from starting (named per-phase below).

**Exit criteria:** each ADR has a recorded status (Accepted/Rejected/Amended) in `.ai/DECISIONS.md`; FOUNDER-GATE decisions needed for Phase 1 (none — Phase 1 has no founder-gated forks) are cleared.

**No guard/test contract** — this phase produces no code.

---

## 2. Phase 1 — Foundational Migrations + Must-Fix Wiring (Week 1)

**Entry criteria:** Phase 0 complete; ADR-0041 (domain), ADR-0042 (policy engine), ADR-0043 (provider/vendor opacity), ADR-0045 (claim ledger) accepted or amended-and-accepted.

### 2.1 Must-fix wiring items (the four the docket names explicitly)

| # | Item | Fix | Docket ref |
|---|---|---|---|
| 1 | `certified: false` hardcode (`app/api/mail/prepare/route.ts:46`) | Route consults the Policy Engine's `delivery.certified` constant instead of a literal — even a minimal Policy Engine stub returning the constant closes this immediately, ahead of the full engine | #1 |
| 2 | Fail-open unknown provider status (`LetterStreamProvider.ts:45`) | `mapLetterStreamStatus()`'s `?? "PROVIDER_ACCEPTED"` fallback becomes `?? "UNKNOWN_PROVIDER_STATUS"` | #5 |
| 3 | `MailPricing.computePrice()` lump-sum collapse | Stop collapsing `CostEstimate.breakdown` into one `"Postage & printing"` line, OR have the Wallet Authorization screen read `CostEstimate.breakdown` directly — pick one, do not leave both half-done | #8 |
| 4 | Vendor-name leak paths (`MailReceipt.provider`, `dispatch()`'s audit template) | Response-boundary DTO strips/replaces `provider`; audit `detail` uses neutral phrasing; add the static regex guard | #15 |

**CCO Gate 1 (before this phase's copy ships, even flag-off):** any new operator-facing string introduced by items 3–4 (e.g., a neutral audit-detail phrase, a certified-mail line label) passes compliance review before merge — Program Brief §4.

### 2.2 Migration order (additive, Gate-D-style runbook per table)

Precedent: `.ai/RUNBOOKS/gate-d-production-migration.md` — read-only preflight, direct-connection discipline, all flags confirmed OFF through the gate. Propose one runbook per table below, run in this dependency order:

| Order | Table/enum | Depends on | New FK direction |
|---|---|---|---|
| 1 | `Case` (+ `CaseState` enum) | `User`, `Tradeline` (existing) | `Case.userId → User`, `Case.tradelineId → Tradeline` (SetNull) |
| 2 | `DisputePackage` (+ `PackageState` enum) | `Case` (step 1), `User` | `DisputePackage.caseId → Case` (Restrict), `DisputePackage.userId → User` |
| 3 | `DisputePackageLetter` | `DisputePackage` (step 2), `Letter` (existing) | `packageId → DisputePackage` (Cascade), `letterId → Letter` (Restrict — **this is the DELETE-behavior change, docket #4**) |
| 4 | `Claim` (+ `ClaimDomain` enum) | none | none (standalone) |
| 5 | `WalletLedger` | `User` (existing) | `userId → User` (Restrict) |

Each migration: preflight script verifying the exact chain against production before `prisma migrate deploy`; zero `DROP`/`TRUNCATE`/`ALTER` on any pre-existing table; all new tables absent from `LEGACY_SELF_HEAL_ALLOWLIST` (never added to it — `scripts/schema-safety.test.ts` must keep passing unmodified).

### 2.3 Guard/test contract, Phase 1

| Guard | Type | Asserts |
|---|---|---|
| `scripts/schema-safety.test.ts` (existing, unmodified) | static | still passes — no new self-heal DDL introduced by any of the 5 new tables |
| `case-package-migration-guard.test.ts` (PROPOSED) | static | additive-only, correct FK directions/cascade rules per §2.2's table, `DisputePackage.campaignId` remains a plain unenforced string (not a real FK — confirms docket #2 is implemented as ruled, not "fixed" into a real FK by accident) |
| `claim-migration-guard.test.ts` (PROPOSED, ADR-0045) | static | additive-only, `domain` column present, unique key present |
| Vendor-opacity static guard (PROPOSED, ADR-0043) | static | regex `/letterstream\|postgrid\|click2mail\|postalmethods\|\blob\b/i` matches nothing outside `lib/mail/providers/*` |
| `npm run typecheck` | static | unchanged — required for any code change per `CLAUDE.md` |

**Exit criteria:** all 5 migrations applied (production, flags-irrelevant since nothing reads the new tables yet); the 4 must-fix items merged; all Phase 1 guards green; `npm run typecheck` and `npx next build` clean.

---

## 3. Phase 2 — Policy Engine + Provider Abstraction Wiring (Week 2)

**Entry criteria:** Phase 1 complete. ADR-0042/0041 accepted.

**Work:** build `lib/fulfillment/PolicyEngine.ts` (full spec `A-POLICY-ENGINE.md`, corrected per merge §4.1 — `policyVersion` field, `UNKNOWN_PROVIDER_STATUS` handling); wire `POST /api/mail/prepare` and `POST /api/mail/[mailId]/confirm` to consult it behind a new flag, `FULFILLMENT_POLICY_ENGINE_ENABLED` (default OFF — when off, routes behave exactly as today, i.e., still exhibit the must-fix bugs from Phase 1 unless Phase 1's direct literal-value fixes already landed independently of the flag; **recommendation: land the Phase 1 must-fixes as unconditional corrections, not behind this flag, since they are bug fixes, not new behavior** — the flag gates the engine's *presence*, not the certified/vendor-opacity corrections, which should never be optional). Provider adapter conformance test battery built (`A-PROVIDER-ABSTRACTION.md` §8).

### 3.1 Guard/test contract, Phase 2

| Guard | Asserts |
|---|---|
| `scripts/fulfillmentPolicy.test.ts` (PROPOSED, A §7) | certified always `true`; unrecognized status never produces a `chosen` provider; every decision has non-empty `basis` and `policyVersion`; no client-suppliable field passes through unchanged; retry schedule monotonically bounded; duplicate-prevention claim key always `${mailId}:${toStage}` |
| Provider conformance battery (PROPOSED, extends `scripts/mail.test.ts`) | interface completeness, dry-run/live symmetry, status-mapping totality (no fallback to a forward-progress status), rate-card containment, error-code fidelity, no vendor leakage |
| `npm run typecheck`, `npx next build` | unchanged |

**Exit criteria:** Policy Engine unit-tested with zero DB/network; both consuming routes wired behind `FULFILLMENT_POLICY_ENGINE_ENABLED` (still OFF); Phase 1's 4 must-fix items are live unconditionally (not flag-gated); guards green.

---

## 4. Phase 3 — Wallet (Week 2–3, parallel-safe with Phase 4)

**Entry criteria:** Phase 1 complete (needs `Claim` + `WalletLedger` tables). ADR-0044/0043 accepted. **FOUNDER-GATE blocking this phase's UI work (not its ledger build):** top-up preset-vs-dynamic-amount decision (§4.2 of `C-WALLET-INTEGRATION.md`) — the ledger/authorize/consume/void machinery can be built and guard-tested without this decision; the Stripe checkout branch cannot ship without it.

**Work:** `WalletLedger` fold/authorize/consume/void functions; `Claim`-table-backed idempotency for all four transitions; `walletHasSufficientBalance()` read exposed to the Policy Engine; Stripe top-up branch (pending the FOUNDER-GATE decision above); 402 insufficient-funds contract; `WALLET_ENABLED` flag (default OFF).

**CCO Gate 2 (before this phase's UI copy ships):** `WalletAuthorizationView` line items, 402 top-up messaging, any wallet-balance copy — Program Brief §4.

### 4.1 Guard/test contract, Phase 3

| Guard | Asserts |
|---|---|
| `wallet-migration-guard.test.ts` (PROPOSED, C §2.6) | additive-only, no `ALTER` on any pre-existing table, `@@unique` present, fold-order index present, both FKs `RESTRICT` |
| `wallet-runtime.test.ts` (PROPOSED, C §8.3) | double-authorize (same row, `created:false` on retry), double-consume (same mechanism), void-after-consume (refused, no void row written), unknown-amount (refused, no ledger row written), webhook replay (credits exactly once) |
| `claim-runtime.test.ts` (PROPOSED, ADR-0045) | wallet-domain claims correctly scoped by `domain=WALLET` in the reclaim sweep; never collides with mail-transition claims |
| Cross-instrument isolation guard (PROPOSED, mirrors `scripts/reputation-runtime.test.ts:45`) | zero imports between any wallet module and `lib/reputation/**`, either direction |

**Exit criteria:** `WalletLedger` guards green; `WALLET_ENABLED` off; balance always non-negative under the guard's race-simulation cases; zero cross-instrument imports.

---

## 5. Phase 4 — Mail Center / Case Journey UX (Week 3, parallel-safe with Phase 3)

**Entry criteria:** Phase 1 complete (needs `DisputePackage` read shape). Does not strictly need Phase 2/3 to be *functionally* complete to build UI against mocked/typed contracts, but needs them complete before the flag that exposes this UI to real operators can flip (§7).

**Work:** per `B-MAIL-CENTER-EVOLUTION.md` §7's file-by-file map — work-queue reorder + "Do this first" band (`lib/mailCenter.ts` evolution), evidence drawer (first UI consumer of `TrackingInfo`/`ProofArtifact`), metrics demotion, Package Review route rename (`[letterId]` → `[packageId]`) and 12-step chain, **Approval-card split** (docket #7 — the Kai-labeled explanation section and the non-Kai operator-chrome Approve section become two structurally separate components, not a CSS-only relabel), two-option law (Download/Send co-equal at the terminal fork), `KaiPresence` exclusion-list update. New flag: `FULFILLMENT_PACKAGE_UI_ENABLED` (default OFF).

**CCO Gate 3 (before this phase's copy ships):** every row in `B-MAIL-CENTER-EVOLUTION.md` §8's copy-discipline table — Program Brief §4.

### 5.1 Guard/test contract, Phase 4

| Guard | Asserts |
|---|---|
| `approval-card-split.test.ts` (PROPOSED — no automated test named by any sibling artifact; net-new here) | the Approve control's DOM subtree never shares a container with a KAI-badge-marked element; a static/structural assertion, not a visual snapshot |
| `npm run typecheck`, `npx next build` | unchanged |
| Manual QA pass (per `CLAUDE.md`'s five-review gate) | Design review confirms the six-presentation layout (`OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §2) is actually met, not just coded |

**Exit criteria:** evolved `/mail` + Package Review chain pass typecheck/build/guard; `FULFILLMENT_PACKAGE_UI_ENABLED` off; Design + Compliance reviews recorded.

---

## 6. Phase 5 — Event Bus + Kai Narration Wiring (Week 4)

**Entry criteria:** Phases 1–4 complete. ADR-0046 accepted.

**Work:** extend `KaiEventType` union (additive); register the 4 new Event Bus contracts (`PACKAGE_APPROVED@1`, `PACKAGE_FULFILLMENT_SUBMITTED@1`, `PACKAGE_DELIVERED@1`, `RETURN_RECEIPT_ARCHIVED@1`) plus the 4 (reserved 5th) Wallet contracts (`WALLET_FUNDED@1`, `WALLET_AUTHORIZED@1`, `WALLET_CONSUMED@1`, `WALLET_VOIDED@1`) into the existing closed registry; reactivate the 3 zero-caller contracts (`DISPUTE_CREATED@1`, `LETTER_GENERATED@1`, `LETTER_SENT@1`) with real publishers; wire `package.authorized`/`package.mailed`/etc. emission into the route/service layer per L3 (system-emitted only). **`waiting.started`/`waiting.ready_for_review` get no Bus contract at all** (docket #14 — derive-on-read, confirmed).

### 6.1 Guard/test contract, Phase 5

| Guard | Asserts |
|---|---|
| `scripts/eventbus-validate.test.ts` (existing, extended) | new contracts pass the existing PII structural guard (`amount`/`balance`/`reason` substring denylist) — verifies the `centsDelta`/`totalCents`/`basis` naming convention was actually followed, not just designed |
| `scripts/kai-manifest.test.ts` (existing, extended) | new `KaiEventType` values are all producer-emitted from route/service code, never from `lib/kai.ts`/`components/kai/*` (L3) |
| `scripts/eventbus-migration-guard.test.ts` (existing, re-run) | additive-only contract registration, no existing contract edited (ADR-0036 rule 1) |

**Exit criteria:** all 7 new/reactivated contracts registered and guard-green with `EVENT_BUS_ENABLED` still OFF (registration ≠ activation); no persisted event exists for `waiting.*`.

---

## 7. Phase 6 — Pre-Launch Verification + Freeze (Week 4, before September 1)

**Entry criteria:** Phases 1–5 complete.

**Work:** full guard suite run (`scripts/release-verify.sh` + `scripts/schema-safety.test.ts` + every guard named above) + `npm run typecheck` + `npx next build`, all green, on the integration branch; confirm every new flag (`FULFILLMENT_POLICY_ENGINE_ENABLED`, `FULFILLMENT_PACKAGE_UI_ENABLED`, `WALLET_ENABLED`) is OFF in every environment; confirm `EVENT_BUS_ENABLED` and `MAIL_LIVE` remain in their pre-existing OFF state (this program changes neither).

**Exit criteria:** the branch is mergeable to `main` with **zero observable behavior change** to any operator — this is the September 1 target: the architecture ships, inert, on schedule; activation is explicitly a separate, later, owner-gated event (Phase 7), never coupled to the launch date.

---

## 8. Flag Activation Order (Phase 7 — post-launch, owner-gated, indefinite)

All flags below default OFF, exact-string `=== "true"` (fail-closed), independently reversible. **No flag flips as part of this program.** Recommended sequential order once the Founder chooses to begin activation (each step is its own decision, not a bundle):

| Order | Flag | Unlocks | Prerequisite FOUNDER-GATE decisions | Risk if flipped alone |
|---|---|---|---|---|
| 1 | `FULFILLMENT_POLICY_ENGINE_ENABLED` | Policy Engine consulted by prepare/confirm routes | None beyond Phase 2 sign-off — no money movement, no new UI | Lowest risk; behavior change is internal (correct certified/routing decisions), not visible until Phase 4's flag also flips |
| 2 | `EVENT_BUS_ENABLED` (existing flag, new contracts) | Fulfillment/Wallet facts become observable on the Bus | None new — existing flag, existing risk profile | Low; observability only |
| 3 | `WALLET_ENABLED` | Real fund/authorize/consume/void against `WalletLedger` | Top-up preset-vs-dynamic decision; hold-TTL value; CCO sign-off on Wallet copy (Gate 2) | Money movement begins — highest-scrutiny flip before Package UI exposes it |
| 4 | `FULFILLMENT_PACKAGE_UI_ENABLED` | Evolved `/mail` + Package Review chain visible to real operators | Must follow #3 — the Wallet Authorization screen has nothing to authorize against otherwise; Design + Compliance sign-off (Gate 3) | Operator-facing; this is the flip that actually changes what a customer sees |
| 5 | `MAIL_LIVE` | Real LetterStream network calls, real postage spend | Its own runbook (already required by ADR-0011); CASS/USPS live validation (if pursued, its own FOUNDER-GATE, can also ship deferred/never); CSO + CCO review | Highest risk — real vendor spend, real mail sent; last step, never bundled with any other flip |

---

## 9. v1 Scope vs. Deferred

| Bucket | Items |
|---|---|
| **v1 ships (flag-gated OFF, this program)** | `Case`/`DisputePackage`/`DisputePackageLetter` domain · unified `FulfillmentStage` machine + `UNKNOWN_PROVIDER_STATUS` · Fulfillment Policy Engine (certified constant, routing, wallet-authorization requirement + `policyVersion`, retry schedule, duplicate prevention) · Provider Adapter formalization + Vendor Opacity guard + honest `validateAddress` (`undefined`, never fabricated `true`) · unified `Claim` table · `WalletLedger` with `fund`/`authorize`/`consume`/`void` (not `refund`/`adjust` activation) · Kai `package.*`/`fulfillment.status` narration + 7 new/reactivated Event Bus contracts · evolved Mail Center + 12-step Package Review chain + Approval-card split · Operational Room Constitution (as a **ratified-or-not proposal**, never self-ratified by shipping) |
| **Reserved integration points only — v1 does NOT build consumption** | Marketplace consuming Wallet cents · Growth Network funding (undefined by any existing ADR — Brief §1.6 names it, nothing else does) · Payouts/cash-out (REFUSED v1, same posture as `cash_affiliate_payout`) |
| **FOUNDER-GATE, named, own runbook, explicitly deferred** | Real generated-PDF artifact (new dependency — stays browser-print-to-PDF) · CASS/USPS live address validation · **LetterStream live wiring** (`MAIL_LIVE` flip — final gated step, own runbook, per ADR-0011) · Refund-to-card (`stripe.refunds.create()`) · Wallet top-up preset-vs-dynamic-amount · Hold-TTL numeric value · `Campaign` → Prisma-model migration · Kai Summary server-side persistence (extending ADR-0006) · Email/push notification effect layer (ADR-0027 D-07/D-08 preconditions) · full CXOS Living Environment chamber adoption for Mail Center · evidence-artifact storage decision (pointer-only vs. download-and-encrypt) · provider webhook secret/signature activation · cross-filing the Operational Room Constitution into `architecture/constitution/` once that branch merges |

---

## 10. Compliance (CCO) Gate Summary

| Gate | Phase | Reviews |
|---|---|---|
| CCO Gate 1 | Phase 1 entry | Vendor-opacity copy, audit-string neutral phrasing |
| CCO Gate 2 | Phase 3 entry | Wallet Authorization screen line items, 402 top-up messaging |
| CCO Gate 3 | Phase 4 entry | All Mail Center / Package Review operator-facing copy (`B-MAIL-CENTER-EVOLUTION.md` §8) |
| CCO Gate 4 | Phase 7, before each flag flip | Re-review at actual activation time — copy approved at build time is re-confirmed against what real operators will see |
| CCO Gate 5 | Before `MAIL_LIVE` flip specifically | Full CSO + CCO review per the existing ADR-0011 requirement — unchanged, restated for completeness |

No phase after Phase 0 ships user-facing or money-touching copy without its gate recorded, per Program Brief §4 and `CLAUDE.md`'s standing five-review ship gate.
