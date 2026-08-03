# WALLET-VC-RUNTIME-PLAN.md — Wallet Runtime + Vector Credits Execution Plan (Agent D)

**Status:** PROPOSED. Planning only — no code, schema, migration, flag, dependency, or vendor
change. Written by Agent D (Wallet Runtime + Vector Credits Planning) against
`docs/fulfillment/execution/EXECUTION-PLANNING-BRIEF.md` (binding; Program Director, `02716a0`).
This document edits nothing else and commits nothing.

**Every line below is LEGAL-GATE, FOUNDER-GATE, or counsel+CCO-GATE until stated otherwise.**
No migration executes, no flag flips, no code is written from this plan before its named gate
clears. This document sequences and specifies; it does not schedule.

## 0. Method, sources, what this document adds

**Reused verbatim (not re-derived, not redesigned):** the six-entry-kind wallet vocabulary,
the `Wallet` anchor-lock, `WalletLedger`'s schema, the per-letter/attempt grain, the two-pass
authorize classifier, the payer-principal model, the ten inherited financial invariants, and the
activation posture — all from `docs/fulfillment/WALLET-COMMITMENT-MODEL.md` (the re-gated
revision, superseding `C-WALLET-INTEGRATION.md` per its own §13 map) and adopted by
`docs/fulfillment/COMMITMENT-RESOLUTION.md` (Program Director merge) and
`docs/fulfillment/COMMITMENT-REGATE.md` (the re-gate verdict: RESOLVED-WITH-RESIDUALS
throughout, F4 mechanism now closed). `ADR-0044` (Wallet), `ADR-0045` (unified `Claim`), and
`ADR-0038` (PGE-1…6, ratified principles) are cited, not restated.

**Net new in this document:** the Founder's Vector Credits (VC) decision
(`EXECUTION-PLANNING-BRIEF.md` "New Founder decisions to fold in") has no prior architecture —
this document is its first design pass, at the same planning altitude as `C-WALLET-INTEGRATION.md`
was for the original Wallet: shapes, not implementations. Every VC design choice below either
cites a repository precedent it mirrors or argues the deviation in place, per this program's
house discipline.

**Verified read-only at write time (not re-derived from any doc's citation of them):**
`lib/reputation/fold.ts`, `events.ts`, `reconcile.ts`, `service.ts`, `repository.ts`,
`scoring.ts`, `flags.ts`; `lib/billing.ts`; `lib/entitlements.ts`; `.ai/ADR/ADR-0038-*`;
`prisma/schema.prisma:65` (`User.letterCredits`), `:766-786` (`XpAward`/`ReputationMilestone`);
`scripts/schema-safety.test.ts:106-120` (frozen `LEGACY_SELF_HEAL_ALLOWLIST`); `.ai/RUNBOOKS/
gate-d-production-migration.md` + `scripts/gate-d-preflight*.ts`. Confirmed: no `Wallet`,
`WalletLedger`, or Vector-Credits schema exists anywhere in `prisma/schema.prisma` today —
`letterCredits` (`:65`) remains the only stored balance field in production. Confirmed:
`docs/fulfillment/execution/` holds only `EXECUTION-PLANNING-BRIEF.md` at write time — Agent A's
`EXEC-SEQUENCING.md` does not yet exist in this worktree. Every "Agent A phase" reference below
therefore cites the Brief's own **P1–P10 skeleton** (§"Refined phase skeleton") as the binding
interim numbering; re-check against Agent A's artifact once it lands, per this program's
cross-document discipline (do not silently re-number).

**Not this document's job:** re-arguing the CROA §404 question (counsel's), re-litigating F3–F9
(closed, `COMMITMENT-REGATE.md`), designing the Policy Engine/state machine/Recovery Engine
(Agent A/E's), designing Kai copy or the FINAL REVIEW token (Agent E's KAI-FULFILLMENT-UX
territory), or minting new ADR numbers (the Program Director's synthesis step, per
`EXECUTION-PLANNING-BRIEF.md`'s closing paragraph). Where this document's VC design implies a
future ADR, that is named, not numbered.

---

## 1. Wallet Runtime execution plan — the five-stage build sequence

### 1.0 Stage → entry-kind mapping (stated once, cited throughout)

The re-gated model's vocabulary is six closed entry kinds (`fund | authorize | settle | release |
clawback | adjust` — WALLET-COMMITMENT-MODEL.md §2, S8). The Brief's five-stage frame
(`authorization → reservation(hold) → settlement(at provider acceptance) → accounting(adjust) →
ledger(fold-derived)`) is the **lifecycle view** over those six kinds; the mapping is stated here
once so every citation below is unambiguous:

| Brief stage | Entry kind(s) | Why grouped this way |
|---|---|---|
| **Authorization** | *(none — pre-ledger)* | The Policy Engine's rate decision (`PolicyDecision.walletAuthorization`). Not a `WalletLedger` write; the input the next stage consumes. |
| **Reservation (hold)** | `authorize`, `release` | A hold's full lifecycle: opened, then either resolved forward (next stage) or undone. `release` is the hold's own reversal, never a correction to something already permanent. |
| **Settlement (at provider acceptance)** | `settle` | The one irreversible conversion — a hold becomes permanent. Never Submitted, never top-up, never by timeout (Constitution invariant 2, §12). |
| **Accounting (adjust)** | `clawback`, `adjust` | Both correct the books **after** money has already moved (settled or funded) — `clawback` is the automatic/webhook-driven correction (chargeback, refund, won-dispute), `adjust` is the human-triggered one. Neither undoes a still-open hold (that's `release`'s job). |
| **Ledger (fold-derived)** | `fund` | How money enters the ledger at all, plus the derivation layer itself — `foldWalletBalance()` (§4.1), no stored column, ever. |

### 1.1 Stage A — Ledger (foundation)

| | |
|---|---|
| **Writes** | `fund` |
| **Schema** | `Wallet` (anchor, §3.1), `WalletLedger` (§3.2), `Claim` (§3.3, adopted from ADR-0045) |
| **Function** | `foldWalletBalance()` (§4.1, no zero-floor — the direct fix for F3's second half), `fundWallet()` (§5.1) |
| **Fires at** | Stripe `checkout.session.completed` with `payment_status==="paid"` + `currency==="usd"` asserted (§8.2, N7 fix), or an admin grant |
| **Cite** | WALLET-COMMITMENT-MODEL.md §3, §4.1, §5.1, §8.1–8.2; ADR-0044 |
| **Agent A phase** | Home **P7**; schema depends on **P1** (Gate D Phase −1) |
| **Gate** | **LEGAL-GATE** (P2 — CROA §404: funds received in advance at top-up; settlement-at-acceptance strengthens the posture but does not moot the question, per S7's carried-verbatim note) |
| **Planned vs blocked** | PLANNED: full schema + pure fold function (WALLET-COMMITMENT-MODEL.md §3–4, unchanged, adopted verbatim). BLOCKED: the migration itself, the webhook branch, any row ever written. |

### 1.2 Stage B — Authorization (Policy Engine handoff)

| | |
|---|---|
| **Writes** | *(none — advisory read + input contract)* |
| **Interface** | `walletHasSufficientBalance(userId, amountCents): Promise<boolean>` (cheap, lock-free, advisory-only — never the authoritative gate); consumes `PolicyDecision.walletAuthorization{amountCents, policyVersion, basis}` verbatim, no invented `FulfillmentRateDecision` type |
| **Cite** | C-WALLET-INTEGRATION.md §3.2, §9.1 items 2–3; WALLET-COMMITMENT-MODEL.md §5.2 header; ADR-0042 |
| **Agent A phase** | Produced by **P5** (Fulfillment Engine / Policy Engine); consumed by **P7** — a cross-phase interface, not a P7-internal step |
| **Gate** | **LEGAL-GATE** for the Wallet's consumption of it (feeds directly into `authorize`). The Policy Engine's own rate computation is Agent A's pure-function territory and is arguably non-money per R3 — not this document's call to unblock; named, not ruled on |
| **Planned vs blocked** | PLANNED: the interface contract (three fields, cited above), the read-only advisory shape. BLOCKED: any actual call from a route into this interface. |

### 1.3 Stage C — Reservation / Hold (`authorize` + `release`)

| | |
|---|---|
| **Writes** | `authorize` (§5.2, `authorizeGroup` — THE canonical operation, `holds.length===1` is the single-letter special case), `release` (§5.4, `releaseHold`) |
| **Mechanism** | `SELECT … FOR UPDATE` on the `Wallet` anchor row (§4) — the entire structural fix for F3; the two-pass classifier (§5.2) — the fix for F4's restoration (Ruling 1); attempt+1 on every retry, never same-attempt reuse (Constitution invariant 8) |
| **Cite** | WALLET-COMMITMENT-MODEL.md §5.2, §5.4, §6 (group lifecycle), §7.2–7.3 (F3/F4 proofs, line-by-line) |
| **Agent A phase** | Home **P7**; depends on **P1** (Wallet/WalletLedger/Claim schema) + **P5** (`DisputePackage`/`Case` schema and the `WALLET_AUTHORIZED`/`PAYMENT_VOID` state-machine slots, `A-STATE-MACHINE.md` §7/§10) |
| **Gate** | **LEGAL-GATE** |
| **Planned vs blocked** | PLANNED: the full anchor-lock proof, the two-pass classifier, the group all-or-nothing insert, the sequence guards (`attempt_out_of_sequence`, `prior_attempt_still_active`, `attempt_already_resolved`). BLOCKED: every line of it executing. |

### 1.4 Stage D — Settlement (`settle`, at provider acceptance)

| | |
|---|---|
| **Writes** | `settle` (§5.3, `settleHold`) — zero-value state-transition marker, precedented by `MILESTONE_REACHED@1` carrying no numeric value |
| **Fires at** | Provider `Accepted` (`providerJobId` assigned) — the reasoned, not assumed, settlement moment (§3.3's argument, C-WALLET-INTEGRATION.md, against consuming at Submitted) |
| **Cite** | WALLET-COMMITMENT-MODEL.md §5.3, §7.6 (settle-after-release / release-after-settle, both directions guarded) |
| **Agent A phase** | Home **P7**; depends on **P3/P4** (LetterStream conformance + Provider abstraction — the `PROVIDER_ACCEPTED` signal must exist and be wired before this stage has anything to fire on) |
| **Gate** | **LEGAL-GATE** |
| **Planned vs blocked** | PLANNED: the settle guard (`no_active_hold`, `already_released` refusal), the copy-forward of `policyVersion`/`onBehalfOfId`. BLOCKED: any wiring to a live provider callback. |

### 1.5 Stage E — Accounting (`clawback` + `adjust`)

| | |
|---|---|
| **Writes** | `clawback` (§5.5 — subject-level `operational_makegood` / account-level `chargeback`, `refund_reversal`), `adjust` (§5.6 — admin-vocabulary, hard `missing_audit_log` refusal) |
| **Fires at** | Stripe `refund.created` / `charge.dispute.created` / `charge.dispute.closed`(won) webhooks (§8.3, N4 fix — keyed on the refund/dispute's own id, never cumulative `amount_refunded` or the bare event id), or an operator/CCO post-settlement make-good |
| **Cite** | WALLET-COMMITMENT-MODEL.md §5.5–5.6, §8.3, §5.7 (`cureDeficit`, a combinator not a seventh kind) |
| **Agent A phase** | Home **P7**; depends on **P2** + the already-live Stripe webhook route (`app/api/stripe/webhook/route.ts`, extended with three new branches) |
| **Gate** | **LEGAL-GATE**. Disclosed residual carried forward, not solved: the agency-wide deficit blast radius (N4) — one chargeback can freeze an entire agency's authorizations because deficit-blocking is per-`Wallet` and one Wallet can be an agency (§8.3–8.4) |
| **Planned vs blocked** | PLANNED: all three webhook branches' logic, the won-dispute compensating `adjust`, the `AdminAuditLog` pairing. BLOCKED: registering any of these branches in the live webhook handler. |

### 1.6 Master table

| Stage | Entry kind(s) | Home phase | Cross-phase deps | Gate | Status |
|---|---|---|---|---|---|
| Ledger | `fund` | P7 | P1 | LEGAL-GATE | Fully specified, zero lines executable |
| Authorization | *(interface)* | P7 (consumer) | P5 (producer) | LEGAL-GATE | Interface contract fixed, zero calls wired |
| Reservation/Hold | `authorize`, `release` | P7 | P1, P5 | LEGAL-GATE | Fully specified + proved (§7.2–7.3), zero lines executable |
| Settlement | `settle` | P7 | P3, P4 | LEGAL-GATE | Fully specified, zero provider wiring |
| Accounting | `clawback`, `adjust` | P7 | P2 (webhook route already live, unextended) | LEGAL-GATE | Fully specified, zero webhook branches registered |

### 1.7 Planned vs blocked — explicit statement

**PLANNED (this document + WALLET-COMMITMENT-MODEL.md, complete at the architecture layer):** all
five stages' schema, transaction pseudocode, concurrency proofs, guard tables, Event Bus
contracts, and activation posture. Nothing here is a gap needing further design before the legal
gate — the engineering is done; only the money-movement code's *execution* is gated.

**BLOCKED (no exception, regardless of engineering readiness):** the `wallet`/`Claim` Prisma
migrations; any `WalletLedger` row ever written in any environment; any Stripe webhook branch for
`wallet_topup`/`refund.created`/`charge.dispute.*`; any route consuming `walletHasSufficientBalance`
or `authorizeGroup`; `WALLET_ENABLED` (or any flag in §5.1) ever set to `"true"` anywhere but a
local/test harness. All of it queues behind **Gate D Phase −1 (P1)** *and* **Founder legal +
CROA §404 counsel review (P2)** — both required, order between them immaterial, per
`EXECUTION-PLANNING-BRIEF.md` §"Authoritative gates" items 1–2. Two pre-existing FOUNDER-GATE forks
carry forward unresolved and additionally block full activation even once P1+P2 clear: the top-up
preset-vs-dynamic amount (§4.2/§16), and the reconciliation-sweep hold-TTL numeric value (§3.4/§16)
— neither is this document's to rule on.

---

## 2. Vector Credits (VC) — the Founder decision

**ONE `Wallet` anchor. FOUR separate append-only ledgers: Purchased VC · Earned VC · Bonus VC ·
Pending Payout VC.** Per `EXECUTION-PLANNING-BRIEF.md`'s Founder decision: each ledger
independent, append-only, fold-derived, `Restrict` FKs (`XpAward` precedent, `prisma/schema.prisma
:766-786`) — never combined, never converted, the five-instruments-never-converted law (ADR-0038
PGE-3/4) governing throughout.

### 2.1 Object model — one anchor, four ledgers

```
                         ┌─────────────────────────────┐
                         │   Wallet (unchanged, §3.1)   │   ← ONE row per payer principal,
                         │   principalType / principalId │      holds NO balance, exists
                         │   lockVersion (shared, §2.5)  │      only to be locked (§2.5)
                         └──────────────┬────────────────┘
              ┌───────────────┬─────────┴─────────┬───────────────────┐
              ▼               ▼                   ▼                   ▼
     PurchasedVcLedger  EarnedVcLedger      BonusVcLedger    PendingPayoutVcLedger
     (= WalletLedger,   (NET NEW,           (NET NEW,        (NET NEW,
      unchanged, §3.2)   XpAward-shaped)     XpAward-shaped)  XpAward-shaped)
```

**Naming call, made explicitly (not silently):** "Purchased VC" is the **product-facing label**
for the already-fully-specified `WalletLedger` (§3.2 of WALLET-COMMITMENT-MODEL.md) — **not** a
schema rename. `WalletLedger` keeps its name; renaming an already-proved, already-re-gated table
for cosmetic reasons is pure churn with no engineering benefit, and would force re-deriving F3/F4's
proofs against a renamed identifier for zero gain. Three tables are genuinely net new: `EarnedVcLedger`,
`BonusVcLedger`, `PendingPayoutVcLedger`.

### 2.2 Why four physically separate tables, not one `ledgerType`-discriminated table (argued)

`ADR-0045` unified `Claim` into one `domain`-tagged table for mail-transition and wallet-transition
idempotency — a real, considered precedent for "one generic table, many domains." This document
does **not** copy that pattern here, and argues why: `Claim` has no "never sum across domains" law
— it is a pure dedup mechanism with no balance semantics, so a shared table carries zero risk of
silently combining two things that must never combine. The four VC ledgers are the opposite case:
PGE-4 is a **hard, ratified law** ("never combined, converted, or cross-credited") enforced today
by a **guard-pinned cross-instrument no-read invariant, not by assertion**
(C-WALLET-INTEGRATION.md §1.2, ADR-0038 §4). A single table with a `ledgerType` column makes that
invariant one missed `WHERE` clause away from a silent violation — exactly the failure mode PGE-4
exists to foreclose. Four physically separate tables make the invariant a **compile-time/
static-guard** property instead: a source-grep guard (§5.3) can assert zero cross-imports between
`lib/vc/purchased/**`, `lib/vc/earned/**`, `lib/vc/bonus/**`, `lib/vc/pendingPayout/**`, mirroring
the wallet-vs-`lib/reputation/**` guard already named in C-WALLET-INTEGRATION.md §1.2. This is the
correct extension of an existing law, not a new one.

### 2.3 Per-ledger specification

| | **Purchased VC** | **Earned VC** | **Bonus VC** | **Pending Payout VC** |
|---|---|---|---|---|
| **Table** | `WalletLedger` (unchanged) | `EarnedVcLedger` (net new) | `BonusVcLedger` (net new) | `PendingPayoutVcLedger` (net new) |
| **Maps onto ADR-0038 §4 instrument** | Cash (confirmed, C-WALLET §1.2) | **Unresolved — see §2.4** | Promotional credits (clean mapping) | Affiliate commissions (clean mapping) |
| **Source of a credit row** | Stripe top-up webhook (`payment_status==="paid"`) or admin grant | Undesigned upstream trigger (some future activity/contribution/milestone event) — **named, not designed** | Admin-granted promo/goodwill comp — **named, not designed** | Undesigned upstream accrual (affiliate conversion, referral) — **named, not designed; no affiliate program exists (ADR-0038 §4: "No affiliate concept is built now")** |
| **Entry kinds (v1)** | All six: `fund, authorize, settle, release, clawback, adjust` | `fund, adjust, clawback` — **no** `authorize/settle/release`: those are fulfillment-hold concepts (a provider's async accept/reject); no fulfillment-analogous spend path is designed for Earned VC today | `fund, adjust, clawback` (identical reasoning to Earned VC) | `fund` only, in practice unreachable (source undesigned) — `adjust`/`clawback` reserved for future correction once an accrual mechanism exists |
| **Idempotency key** | `@@unique([walletId, subjectId, entryKind, attempt])` — the `attempt` dimension exists **specifically** because fulfillment retries need a new generation per retry (F4's fix) | `@@unique([walletId, subjectId, entryKind])` — **no `attempt` column.** An earned-VC award has no retry concept; this mirrors `XpAward`'s own key shape directly (`prisma/schema.prisma:784`), not `WalletLedger`'s extended one | Same as Earned VC — no `attempt` | Same as Earned VC — no `attempt` |
| **`subjectId` convention** | `mail_<letterId>` (subject-level) / `topup:<paymentIntentId>` (fund) / `chargeback:<id>` (account-level) | A stable, version-free business-entity id for whatever evidence triggers the award (mirrors `XpAward.subjectId`'s "never the bare per-emission event id" law) — the concrete entity is undesigned because the upstream trigger is undesigned | The promo-grant's own stable id | The accrual event's own stable id |
| **Actor model** | Nullable `actorId` + closed `actorKind` (`operator\|agency\|system`) + `onBehalfOfId` (B6, §3.2) | Identical shape, reused verbatim — system-driven credits (an automated milestone trigger) hit the same non-existent-FK problem `WalletLedger` already solved | Identical shape | Identical shape |
| **FK discipline** | `Restrict`, never `Cascade` (append-only financial ledger; erasure via tombstone, never cascade — COMMITMENT-RESOLUTION.md F14 ruling, extended here to all three new tables) | Same | Same | Same |
| **`policyVersion`** | Freezes the Policy Engine's rate decision (non-null for `authorize`, meaningless elsewhere) | Nullable — meaningful only once a reward policy exists to freeze; null until then (same nullable-until-meaningful pattern as `WalletLedger.policyVersion` on `fund`/`adjust` rows) | Nullable, same reasoning | Nullable, same reasoning |
| **Fold function** | `foldWalletBalance()` (§4.1, no floor) | `foldEarnedVcBalance()` — **identical algorithm**, fed only `EarnedVcLedger` rows | `foldBonusVcBalance()` — identical algorithm | `foldPendingPayoutVcBalance()` — identical algorithm |
| **Gate** | **LEGAL-GATE** (P2 — CROA §404) | **counsel + CCO-GATE** (ADR-0038 §4 reward/incentive governance) — a **different** legal question than P2, not the same gate reused | **counsel + CCO-GATE** (ADR-0038 §4 promotional-credit governance: "requires legal + accounting review, liability treatment, expiration, non-transferability, no cash redemption") | **counsel + CCO-GATE**, plus a **third, engineering precondition**: Stripe Connect does not exist in this codebase (C-WALLET-INTEGRATION.md §6, verified) — cash-out is structurally impossible until it is built, independent of any legal clearance |

**The shared fold algorithm, stated once:** all four `foldXBalance()` functions are the **same
pure function** (`[createdAt asc, id asc]` sort, sum signed `amountCents`, no floor — §4.1's
shape) invoked four separate times against four disjoint row-sets. The function itself has no
memory and no cross-table read, so sharing the algorithm violates nothing — only sharing a
*table* or *summing across calls* would.

### 2.4 The five-instruments-never-converted law, applied (ADR-0038 PGE-3/PGE-4)

Cited verbatim (already quoted in `C-WALLET-INTEGRATION.md` §1.2, restated here for this
document's own application):

> **PGE-3:** *Vector XP is not a credit, coin, token, currency, or balance of monetary value...
> XP is never spent/transferred/purchased/sold/redeemed-for-cash...*
> **PGE-4:** *Reputation (Vector XP) · Business Health · Affiliate commissions · Promotional
> credits · Cash are five distinct instruments with distinct ownership; they are never combined,
> converted, or cross-credited.*

| Ledger | Instrument-law application |
|---|---|
| **Purchased VC** | Unchanged from the existing Wallet: the productized **Cash** instrument. Zero reads/writes against `lib/reputation/**`, either direction (guard-pinned, C-WALLET §1.2, extended to VC below). |
| **Bonus VC** | Clean mapping onto ADR-0038 §4's reserved **Promotional credits**: "closed-loop... no cash redemption... a separate ledger + terminology." Bonus VC is that ledger's eventual productized form. |
| **Pending Payout VC** | Clean mapping onto ADR-0038 §4's reserved **Affiliate commissions**: "cash compensation, entirely separate... Architecturally reserved; NOT implemented, NOT owned here." Pending Payout VC is that reservation's shape, unbuilt. |
| **Earned VC** | **Open question, flagged, not silently resolved.** ADR-0038 names exactly five instruments; Earned VC as the Brief describes it ("reward/incentive... territory") does not map cleanly onto any one. It is **not** Reputation/Vector XP itself — PGE-3 forbids XP from ever being "spent/transferred/redeemed-for-cash," so if Earned VC is spendable (implied by living inside a spendable Wallet), it **cannot be** XP under a new name; that would be a disguised XP-to-cash conversion path PGE-3 exists to forbid outright. Two honest readings remain open: (a) Earned VC is a **sixth instrument**, requiring its own ADR-0038 amendment (a PGE-4 revision naming six instruments, not five) before any implementation; or (b) Earned VC is the productized form of the **same** reserved "Promotional credits" instrument Bonus VC maps onto, distinguished only by *how* it is granted (activity-triggered vs. admin-granted), not by *what* it is. **This document does not decide between (a) and (b).** It is a FOUNDER + CCO + counsel precondition to any Earned VC implementation — named here as a precondition, not resolved. |
| **Naming-collision risk (new, not in ADR-0038)** | "Vector **Credits**" and "Vector **XP**" are lexically adjacent and semantically unrelated. Kai copy, marketing copy, and UI labels must never imply VC-earning increases XP, that XP converts to VC, or vice versa. This is the identical guard-pinned discipline PGE-4 demands, extended from a **code-import** guard to a **compliance-copy** guard (§5.3, §6). |

### 2.5 The anchor-lock across all four ledgers (one wallet, one lock)

**One `Wallet` row per principal serializes all four ledgers' money-moving operations.** Every
operation against any of the four tables opens the identical `SELECT id FROM "Wallet" WHERE id =
$1 FOR UPDATE` (§4) before touching its own ledger:

```typescript
// PROPOSED — extends WALLET-COMMITMENT-MODEL.md §4's transaction shape across FOUR ledger
// tables sharing ONE Wallet anchor. The lock is generic; which table is touched inside it is
// an explicit caller parameter — NEVER inferred, and never more than one ledger per call (PGE-4).
async function withWalletLock<T>(walletId: string, ledger: VcLedger, op: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE', walletId);
    // ── the lock is now held, across ALL FOUR ledgers, for the remainder of this transaction ──
    const result = await op(tx); // touches EXACTLY ONE of {WalletLedger, EarnedVcLedger,
                                  // BonusVcLedger, PendingPayoutVcLedger} — never two
    await tx.wallet.update({ where: { id: walletId }, data: { lockVersion: { increment: 1 } } });
    return result;
  });
}
```

**Why one lock, not four:** (a) matches the existing no-deadlock-by-construction proof
(§4.2 point 6 — "no cross-wallet transfer... so no transaction ever needs two wallet locks at
once"); four independent anchor rows would reintroduce exactly the lock-ordering-cycle risk that
proof forecloses, the moment any future code path touched two ledgers in one transaction. (b)
Matches the Founder's own framing — "ONE Wallet" — where the four ledgers are different labeled
activity against one principal, not four principals.

**The load-bearing rule this section exists to state (deficit isolation):** sharing a lock is
**purely a concurrency-serialization** device — it is not a balance-computation device, and must
never become one. Each ledger's deficit posture (`foldXBalance().availableCents < 0`) is computed
**independently**, reading only its own table. **A Purchased VC clawback driving that ledger
negative must never block Earned VC, Bonus VC, or Pending Payout VC crediting or spend, and vice
versa in every direction** — anything else would be an implicit cross-ledger coupling through
shared deficit-gating, which is itself a PGE-4 violation in substance even though no code would
literally "convert" cents between ledgers. This is this document's own argued extension of
Constitution invariant 4 (§12, "deficits are representable and curable") to the four-ledger case,
flagged because the existing single-ledger design never had to consider it.

**Contention, disclosed (extends the existing disclosure, not a new defect):**
`COMMITMENT-RESOLUTION.md` §1 already discloses "the anchor-lock's serialization cost at scale
(one row per payer: acceptable for launch scale; measured before Marketplace fan-out)." Four
ledgers sharing one anchor now serialize roughly four ledgers' worth of operations per principal
through that same single row — the identical disclosure, with a larger multiplier, not a new risk
class. Named again here so a reader of this document alone does not under-weight it.

### 2.6 Relationship to `User.letterCredits` (coexistence, unchanged; migration story, FOUNDER-GATE)

`User.letterCredits` (`prisma/schema.prisma:65`) remains a **third**, wholly distinct thing from
every VC ledger: a **count** of letters (not cents, not VC), gating **letter generation**
(`canGenerateLetter()`/`spendLetterCredits()`, `lib/entitlements.ts:157-179,237-246`), gating a
different Case Journey step entirely than any VC ledger gates (fulfillment). C-WALLET-INTEGRATION.md
§1.3's coexistence table is extended, not replaced:

| | `User.letterCredits` | Purchased VC | Earned / Bonus / Pending Payout VC |
|---|---|---|---|
| Unit | Count of letters | Cents (USD) | Undecided — cents-of-VC pending a denomination ruling (§16) |
| Gates | Letter generation | Fulfillment (mail dispatch) | Undesigned spend destination (§3) |
| Grants | One SKU (`letters_5`) | Any top-up amount | Undesigned trigger |

**Nothing converts silently between any of these four things, ever** — no code path may debit
`letterCredits` to fund any VC ledger, credit any VC ledger from unused `letterCredits`, or the
reverse, in any direction, for any of the four ledgers. **Eventual migration/unification story —
FOUNDER-GATE, out of scope for v1**, unchanged from C-WALLET §1.3: a future combo-pack or
generation-fee unification is its own ADR, its own migration, its own founder sign-off. This
document takes no position beyond naming that `letterCredits` and all four VC ledgers must stay
legible and separately auditable until such an ADR exists.

---

## 3. Integration points (named only — no design past the boundary)

Each integration point below touches a **different** (or explicitly undecided) subset of the four
ledgers. None may be collapsed into a shared spend/fund pathway that blurs ledger boundaries —
that would itself be a PGE-4 violation regardless of how the code is written.

### 3.1 Marketplace

ADR-0038 §5: *"Marketplace — owns inventory/listings/products/services/availability/orders/
marketplace-compliance; consumes entitlements; never mutates XP."* Extended here: Marketplace
**never mutates any VC ledger** either — it may only **debit** via that ledger's own scoped
operation, never write to it directly. **Which ledger(s) Marketplace consumes is undecided**:
Purchased VC is the natural fit for a cash-equivalent purchase rail (C-WALLET §6's original
reservation, unchanged); Earned VC and Bonus VC are the **plausible** (not decided) reward-
redemption instruments, since Marketplace — not Fulfillment — is the natural home for spending a
reward rather than a top-up. Pending Payout VC is **not** a marketplace-spend instrument under any
reading (it is accrual-then-cashout, not spend-in-app). Marketplace itself remains
dormant/counsel-gated (FI-9) independent of which VC ledger it eventually touches. **FOUNDER-GATE.**

### 3.2 Growth Network

No existing architecture document defines "Growth Network" — it appears only in the Brief as a
Founder-named future responsibility (C-WALLET-INTEGRATION.md §6, confirmed, unchanged: *"funding-
source rules are undetermined"*). Extended here: whichever direction Growth Network eventually
takes, it touches **Bonus VC** (if the mechanism is a promotional grant) or **Pending Payout VC**
(if the mechanism is accrual/affiliate-shaped, e.g. a referral reward) — **never Purchased VC**
(exclusively Stripe-funded) and never a fifth ledger invented without its own ADR. This document's
posture toward Growth Network stays negative until a Founder decision defines it: no silent
auto-transfer, no implicit grant, no assumed relationship to any of the four ledgers. **FOUNDER-GATE
plus its own ADR.**

### 3.3 Payout (Pending Payout VC → cash)

**REFUSED for v1, full stop** — same posture as `cash_affiliate_payout` in the refusal register
(`lib/reputation/scoring.ts:92-95`, `REFUSED_V1`, verified) and C-WALLET-INTEGRATION.md §6's
unchanged ruling. Stripe Connect does not exist in this codebase today (verified, C-WALLET §6) —
this is an **engineering blocker independent of any legal clearance**: even a fully counsel- and
CCO-cleared Pending Payout VC cannot cash out until Connect is built. If ever built: it is a
**separate instrument and ledger** (never folded into `PendingPayoutVcLedger`'s own settlement —
the eventual cash-out is a Connect transfer, a structurally different operation than any of this
document's six entry kinds), requires **both** counsel (money-transmission / escheatment exposure
of holding customer stored value) **and** CCO sign-off **before any design work begins** — named,
not designed, per C-WALLET §6 verbatim.

### 3.4 Integration-point boundary table

| Integration | Ledger(s) touched | Direction | Gate | Status |
|---|---|---|---|---|
| Marketplace | Purchased VC (decided-plausible) · Earned/Bonus VC (undecided-plausible) | Consumes (debit only, never mutates) | counsel-gated (Marketplace itself dormant, FI-9) | Named only |
| Growth Network | Bonus VC or Pending Payout VC (undecided which) | Funding-source rules undetermined, either direction | FOUNDER-GATE + own ADR | Named only |
| Payout | Pending Payout VC exclusively | Pending Payout VC → cash (Stripe Connect, absent) | counsel + CCO-GATE + Stripe Connect must be built first | REFUSED_V1, named only |

---

## 4. The ten inherited financial invariants — restated as the runtime's constitution

Restated from `C-WALLET-INTEGRATION.md` §7 (FI-1…FI-10, itself formalized from
`PROGRAM-BRIEF.md` §2.4), with a compliance mapping extended across all four VC ledgers — the
net-new content this document contributes to the table.

| # | Invariant | Purchased VC (unchanged) | Earned / Bonus / Pending Payout VC (this document's extension) |
|---|---|---|---|
| **FI-1** | Single authoritative balance representation | `WalletLedger` adds no stored column; balance = `foldWalletBalance()` output only | Each of the three new ledgers likewise adds no stored column; four independent fold outputs plus `letterCredits` coexist as **five** non-competing balance concepts, none "the" balance |
| **FI-2** | Claim-before-effect idempotency | `wallet:<subjectId>:<attempt>:<entryKind>` against the shared `Claim` table, `domain: WALLET` | **Open naming call, not resolved here:** extend `ClaimDomain` additively with `EARNED_VC \| BONUS_VC \| PENDING_PAYOUT_VC` (keeping `WALLET` meaning Purchased VC, unrenamed) — purely additive to the enum, migration-first; Agent E rules on the exact literal, not this document |
| **FI-3** | Fail-closed unknown-amount law | `invalid_amount` refuses before the lock (§5.1) | Identical law applies to every `fund` on the three new ledgers — an unrecognized/non-positive amount credits nothing, on any ledger |
| **FI-4** | `XpAward` precedent: append-only, subject-keyed idempotency, compensating rows, `Restrict` FKs, fold-derived, idempotent reconciliation | `WalletLedger`'s entire shape | The literal shape of all three new tables (§2.3) — this is the invariant's most direct extension |
| **FI-5** | Plan/capacity versioning + grandfather clause; dormant tables behind flags OFF | `policyVersion` freezes the rate decision forever | `policyVersion` nullable on all three, meaningful only once a reward/promo/accrual policy exists (§2.3) — named, not designed |
| **FI-6** | MIGRATION-FIRST, additive-only, frozen self-heal allowlist | `WalletLedger` never self-heals, never added to the allowlist (`scripts/schema-safety.test.ts:106-120`, verified) | All three new tables ship as reviewed migrations, same discipline, same frozen allowlist — never added to it |
| **FI-7** | Flags fail-closed OFF, exact string match | `WALLET_ENABLED === "true"` | `EARNED_VC_ENABLED`, `BONUS_VC_ENABLED`, `PENDING_PAYOUT_VC_ENABLED` — each independently OFF (§5.1) |
| **FI-8** | Five instruments never converted (PGE-3/4) | The Wallet is the productized Cash instrument, zero cross-reads with `lib/reputation/**` | §2.4's full application — the open Earned-VC instrument question, the clean Bonus/Pending-Payout mappings, the naming-collision guard |
| **FI-9** | Cash affiliate payout REFUSED v1; marketplace/funding modules dormant/counsel-gated | Payouts inherit this refusal verbatim (§6 of the original Wallet doc) | Directly governs Pending Payout VC (§3.3) and the Marketplace/Growth-Network integration points (§3.1–3.2) |
| **FI-10** | No Stripe Connect/transfer/payout code exists | v1 refund is in-wallet only, never a Connect transfer | Directly blocks Pending Payout VC's eventual cash-out — the same absence, now blocking a second, distinct feature |

---

## 5. Activation posture

### 5.1 Flag ladder

| Flag | Governs | Default | Gate that must clear first |
|---|---|---|---|
| `WALLET_ENABLED` | Purchased VC / the core wallet mechanics (unchanged, §8.1 of the original doc) | OFF | P1 (Gate D) + P2 (CROA §404 legal) |
| `EARNED_VC_ENABLED` | Earned VC ledger | OFF | P1 + counsel+CCO reward/incentive gate (§2.3 — a **different**, later-clearing gate than P2) + the §2.4 instrument-mapping question resolved |
| `BONUS_VC_ENABLED` | Bonus VC ledger | OFF | P1 + counsel+CCO promotional-credit gate (§2.3) |
| `PENDING_PAYOUT_VC_ENABLED` | Pending Payout VC ledger | OFF | P1 + counsel+CCO affiliate/money-transmission gate (§2.3) + Stripe Connect built (does not exist today) |
| `VECTOR_CREDITS_ENABLED` *(proposed, additive to the Brief's named ladder)* | Whether "Vector Credits" surfaces as a UI/product concept at all — a visibility gate over the four sub-flags, not itself a money-movement gate | OFF | Product/Founder call, independent of the per-ledger legal gates |

All flags: exact-string `=== "true"`, never truthy coercion — mirrors `lib/reputation/flags.ts:7-9`
/ `operatorReputationEnabled()` verbatim. Every door checks its flag first and fails closed
`{ok:false, code:"disabled"}` before any lock is taken, identical structure across all five flags.

### 5.2 Gate-D-gated additive migrations

All new schema queues behind **Gate D Phase −1 (P1)** — the universal unblock (R2). Proposed
migration order, and why the four ledger tables are **not** bundled into one migration wave:

| Order | Migration | Depends on | Rationale for this position |
|---|---|---|---|
| 1 | `Claim` (ADR-0045, extended with the three new `ClaimDomain` values, §4 FI-2) | Gate D preflight only | Every money-moving operation on every ledger is claim-before-effect against it; nothing else can activate without it existing first |
| 2 | `Wallet` anchor (§3.1, unchanged) | (1) | The one row every one of the four ledgers locks; must exist before any ledger table has a valid FK target |
| 3 | `WalletLedger` (= Purchased VC, unchanged) | (2) | Already fully re-gated and proved; ships alone so its **own** Gate-D-clear + CROA-clear activation is never held hostage to the three ledgers below, which clear on a **later, separate** timeline |
| 4a/4b/4c | `EarnedVcLedger`, `BonusVcLedger`, `PendingPayoutVcLedger` | (2) | Proposed as **three separate migrations**, not one bundled wave — each has an independently later, independently distinct counsel+CCO gate (§2.3, §5.1); bundling them would force all three to wait on whichever clears last, and would force Purchased VC's already-further-along legal track to wait on all three unnecessarily if sequenced after it. Splitting honors FI-9's "different reviewers, different blast radii, never one approval" principle (C-WALLET §9.3) at the migration-planning layer, not just the review layer |

Every migration: additive only, zero `DROP`/`TRUNCATE`/`DELETE FROM`/`RENAME`, never added to the
frozen `LEGACY_SELF_HEAL_ALLOWLIST` (`scripts/schema-safety.test.ts:106-120`). Preflight follows
the live `.ai/RUNBOOKS/gate-d-production-migration.md` template (`scripts/gate-d-preflight*.ts`) —
propose a `Gate-<N>`-style runbook per migration wave above, same direct-connection discipline,
same "flags stay OFF through the gate" rule, each new flag (§5.1) added to the must-stay-OFF list
for every wave that has not yet cleared its own legal gate.

### 5.3 Runtime guard suite

Direct precedent, the two-file split already proven for Reputation and named for the original
Wallet (C-WALLET-INTEGRATION.md §8.3): `<domain>-migration-guard.test.ts` (static) +
`<domain>-runtime.test.ts` (executing). Six named cases, the first five inherited directly from
the already-specified Purchased VC guard table (WALLET-COMMITMENT-MODEL.md §5 master guard table,
§7 proofs) and extended to all four ledgers; the sixth is net new to this document's four-ledger
design:

| Case | Assertion | Extension across ledgers |
|---|---|---|
| **Double-authorize** | A second `authorize` for the same `(subject, attempt)` returns the original row, never a second hold | Purchased VC only — `authorize` doesn't exist on the other three ledgers (§2.3) |
| **Double-settle** | A second `settle` for the same tuple is an idempotent replay, not an error (§7.4's engineered distinction) | Purchased VC only, same reason |
| **Settle-after-release / release-after-settle** | Both directions refused symmetrically (§7.6) | Purchased VC only |
| **Unknown-amount** | Non-positive/non-integer/implausible amount credits nothing, on any `fund` | **All four ledgers** — the identical fail-closed law applies to every ledger's `fund` |
| **Webhook-replay** | A redelivered Stripe event credits exactly once | Purchased VC today (Stripe-sourced); any future Earned/Bonus/Pending-Payout trigger that is itself webhook-sourced inherits the identical guard once designed |
| **Cross-ledger-conversion-refused** *(new)* | (a) **Static:** zero cross-imports between `lib/vc/purchased/**`, `lib/vc/earned/**`, `lib/vc/bonus/**`, `lib/vc/pendingPayout/**`, in any direction — mirrors the existing wallet-vs-`lib/reputation/**` guard (C-WALLET §1.2), extended pairwise across all four. (b) **Runtime:** a call attempting to pass one ledger's `entryId`/`subjectId` as another ledger's `reversesId` is refused — `reversesId` is scoped per-table, never a cross-ledger foreign reference. (c) **Deficit isolation:** a runtime test asserting a Purchased VC deficit does **not** block an Earned VC `fund` call, and vice versa in all twelve directional pairs (§2.5's load-bearing rule) | **All four ledgers, pairwise** |
| **Naming-collision guard** *(new, compliance-copy, not code-import)* | A static grep over operator-facing/Kai/marketing copy strings asserting no string implies VC-earning changes XP or that XP converts to VC — mirrors ADR-0043's vendor-name regex guard, applied to the VC/XP lexical collision (§2.4) | All four ledgers vs. `lib/reputation/**`'s copy surface |

### 5.4 Explicit ordering — never before

**Per ledger, the same non-reorderable sequence, every time:**

```
Gate D Phase −1 (P1, schema preflight)
        AND
{ Purchased VC: CROA §404 counsel + Founder legal review (P2)
  Earned/Bonus/Pending-Payout VC: their OWN, separate, LATER-clearing
  counsel + CCO reward/incentive/affiliate gate (§2.3) — NOT the same
  gate as P2, and not assumed to clear on the same timeline }
        ▼
   Migration executes (§5.2's ordered waves — schema only, zero rows, all flags still OFF)
        ▼
   Flag flip (§5.1 — per-ledger, only after that ledger's own gate above has cleared)
```

No step ever reorders. A migration existing is not evidence a legal gate cleared (the table can
exist, empty, unflagged, for an arbitrary period — this is a valid, expected intermediate state,
not a shortcut). A flag is never flipped speculatively "to unblock testing" in any environment this
plan authorizes.

---

## 6. Per-domain risks + tests (feeds the coordinator)

| ID | Risk | Severity | Mitigation / test |
|---|---|---|---|
| R-D1 | Agency-wide deficit blast radius, inherited unsolved from N4, now potentially quadrupled in surface area if any future ledger also anchors to an agency's shared Wallet | HIGH (disclosed, not eliminated) | Carry forward COMMITMENT-REGATE.md's disclosure verbatim; do not scope-narrow this cycle (Founder ruling: no redesign). Test: `wallet-runtime.test.ts` asserts a chargeback on one client's Purchased VC still freezes the agency's Purchased VC authorizations agency-wide (documents the known residual, does not fix it) |
| R-D2 | Deficit-isolation failure across the four ledgers (a bug making one ledger's deficit block another's operations) — a **new** risk class this document introduces by sharing one anchor | HIGH if it occurs (would be a live PGE-4 violation in substance) | §5.3's cross-ledger-conversion-refused runtime case, all twelve directional pairs |
| R-D3 | Earned VC's undecided instrument-mapping (§2.4) ships before the sixth-instrument-vs-promotional-credits question is resolved | HIGH (compliance) | Hard gate: `EARNED_VC_ENABLED` stays OFF until a named Founder+CCO+counsel ruling exists on the record, not merely until "counsel is generally comfortable with VC" |
| R-D4 | VC/XP naming collision in Kai copy, marketing copy, or UI labels implies a conversion that does not and must not exist | MEDIUM (compliance, high-visibility if it ships) | §5.3's naming-collision static guard; route every VC-facing string through the same `applyCompliance()` prohibited-phrase discipline `lib/compliance.ts` already applies elsewhere (CLAUDE.md compliance non-negotiables) |
| R-D5 | Migration-bundling risk: shipping all four ledger tables in one wave couples Purchased VC's (further along) legal clearance to three ledgers on a slower, undefined timeline | MEDIUM (schedule, not safety) | §5.2's four-separate-migrations plan; `wallet-migration-guard.test.ts` extended to assert each new table's migration touches no pre-existing table |
| R-D6 | `ClaimDomain` enum-extension naming collision — `WALLET` implicitly meaning Purchased VC is not self-documenting to a future reader | LOW | Name the ambiguity for Agent E now (§4 FI-2), rather than let a future migration guess; resolve before the `Claim` migration (order-1, §5.2) ships |
| R-D7 | Contention at the shared anchor row grows with four ledgers' combined throughput instead of one | LOW at launch scale (disclosed) | §2.5's extended disclosure; measure before Marketplace fan-out, per the existing COMMITMENT-RESOLUTION.md §1 caveat, now explicitly re-scoped to cover four ledgers' combined load |
| R-D8 | Pending Payout VC ships a `fund` path with no real accrual trigger wired, creating an unreachable-but-present code surface that could be mistaken for "payouts are live" | LOW (perception/audit) | Keep `PENDING_PAYOUT_VC_ENABLED` OFF and the ledger's `fund` origin enum empty/unpopulated until an actual accrual mechanism is designed under its own ADR — an empty enum is a compiled proof of "nothing can credit this yet," not just a flag |

---

## Summary

The Wallet Runtime's five stages — authorization (Policy Engine handoff), reservation/hold
(`authorize`/`release`), settlement (`settle`, at provider acceptance only), accounting
(`clawback`/`adjust`), and the ledger layer itself (`fund` + `foldWalletBalance()`) — are fully
specified by the already re-gated `WALLET-COMMITMENT-MODEL.md` and are mapped here onto the
Brief's P1–P10 phase skeleton (home phase P7, cross-phase dependencies on P1/P2/P3/P4/P5); this
document adds no new wallet mechanics, only the execution sequencing and phase mapping. **All
money code across every one of these five stages is planned, proved, and sequenced — and none of
it is scheduled to execute.** Every stage is blocked behind Gate D Phase −1 (P1) and the Founder
legal + CROA §404 counsel review (P2), in either order, both required, with zero exception; no
migration runs, no flag flips, and no line of this plan's code exists anywhere outside this
document until both clear.

The Founder's Vector Credits decision is designed here for the first time as one `Wallet` anchor
serializing four physically separate, append-only, fold-derived, `Restrict`-FK ledgers:

| Ledger | Instrument (ADR-0038 §4) | Spend/use in v1 | Gate |
|---|---|---|---|
| **Purchased VC** | Cash (= the existing Wallet, unrenamed) | Funds CreditVector Fulfillment | LEGAL-GATE (CROA §404) |
| **Earned VC** | Unresolved — sixth instrument vs. productized Promotional credits (§2.4, not decided here) | Undesigned | counsel + CCO-GATE |
| **Bonus VC** | Promotional credits (clean mapping) | Undesigned | counsel + CCO-GATE |
| **Pending Payout VC** | Affiliate commissions (clean mapping) | None — accrual-then-cashout, Stripe Connect absent | counsel + CCO-GATE + Stripe Connect must be built |

Purchased VC is the only ledger that reuses the existing Wallet mechanics verbatim; the other
three are net-new tables mirroring `XpAward`'s simpler (no-`attempt`) idempotency shape rather
than `WalletLedger`'s retry-extended one, since none of them has a fulfillment-retry concept. The
four ledgers share one lock for concurrency serialization only — their fold/deficit computations
stay strictly independent, and a static+runtime guard suite (extending the existing double-
authorize/double-settle/settle-after-release/unknown-amount/webhook-replay cases with a new
cross-ledger-conversion-refused case) is the enforcement mechanism for that separation, not
assertion alone. Integration points — Marketplace (consumes VC, ledger undecided), Growth Network
(funding-source rules undetermined), and Payout (Pending Payout VC → cash, REFUSED_V1, Stripe
Connect absent) — are named as boundaries only, each a separate instrument honoring PGE-3/4, with
no design past that boundary in this document.
