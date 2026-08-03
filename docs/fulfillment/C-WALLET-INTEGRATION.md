# C-WALLET-INTEGRATION.md — CreditVector Wallet: Fulfillment Integration Architecture

**Status:** PROPOSED. Architecture only — no product code, schema, dependency, env, flag, or vendor
change. Written by Agent C (Wallet Integration) against `docs/fulfillment/PROGRAM-BRIEF.md`
(binding contract; §2 repository truth wins over any claim below). Nothing here is implemented,
migrated, or activated. Every concept is PROPOSED; every founder/legal/schema decision is flagged
**FOUNDER-GATE**.

**Scope discipline (Brief §1.6):** the Wallet's responsibilities are *authorization, fulfillment
funding, marketplace, growth network, payouts, append-only ledger integration* — and this document
covers **integration points only**. It does not build a wallet. It cites the exact existing
precedents (`XpAward`, `StripeWebhookEvent`, `planForPrice`, `EventEnvelope`) the eventual
implementation must reuse, and the exact interfaces it expects from Agent A (Policy Engine /
domain model) and Agent B (UX moments).

---

## 0. Method

Every claim below is cited to a repository path (and line numbers where load-bearing). Where this
document's own reasoning fills a gap the Brief leaves open (e.g., exact ledger field shapes), that
reasoning is shown, not asserted — so Agent E can accept, reject, or amend it against Agent A's and
Agent B's artifacts without re-deriving the tradeoff.

**Reconciled against actual sibling artifacts, not just the Brief's digest.** `A-DOMAIN-MODEL.md`,
`A-STATE-MACHINE.md`, `A-POLICY-ENGINE.md`, and `D-KAI-EXPERIENCE.md` already existed in this
worktree at write time. Every place this document's reasoning was checked against them — confirmed,
extended, or found in tension — is called out inline and collected in §9, in the same
report-don't-silently-resolve discipline those documents use on each other (e.g.
`A-DOMAIN-MODEL.md` §2.3, §7; `A-POLICY-ENGINE.md` §6).

---

## 1. Instrument Definition

### 1.1 What the CreditVector Wallet is

| Property | Value |
|---|---|
| Name | **CreditVector Wallet** ("the Wallet") |
| Denomination | USD, integer **cents** (matches every existing money field in this repo: `LETTER_PACK_PRICE_CENTS`, `PREMIUM_PRICE_CENTS`, `CostEstimate.providerCostCents` — `lib/stripe.ts:27-34`, `lib/mail/MailProvider.ts:40-44`) |
| Nature | **Prepaid fulfillment funds** — a stored-value balance a user tops up in advance, spent only on CreditVector Fulfillment (certified mail dispatch of a Dispute Package) |
| Transferability | **Non-transferable v1** — no user-to-user send, no funding another account, no gifting |
| Cash-out | **None v1.** The only path money leaves the Wallet is (a) fulfillment consumption (spent, gone) or (b) a FOUNDER-GATE refund (§3.5). No withdrawal to a card/bank account exists or is designed here |
| Scope of spend v1 | Fulfillment authorization only (§3). Marketplace/Growth Network/Payouts are reserved integration points, not live consumers (§6) |

### 1.2 Position under the five-instruments-never-converted law

ADR-0038 §2 (PGE-3, PGE-4) — cited verbatim, binding:

> **PGE-3:** *Vector XP is not a credit, coin, token, currency, or balance of monetary value; never
> legal tender, an investment, or a speculative instrument... XP is never
> spent/transferred/purchased/sold/redeemed-for-cash/reduced-in-normal-use/client-awarded/browser-derived.*
>
> **PGE-4:** *Reputation (Vector XP) · Business Health · Affiliate commissions · Promotional
> credits · Cash are five distinct instruments with distinct ownership; they are never combined,
> converted, or cross-credited.*

The Wallet is **not a sixth instrument**. It is the productized, stored-value form of the existing
**Cash** instrument in that five-way partition — funded exclusively by real Stripe payment (§4),
denominated in real USD cents, and spent only on a real fulfillment cost. It inherits PGE-4's
separation absolutely:

- The Wallet ledger (§2) never reads, writes, derives from, or is derived by the `XpAward` ledger,
  any future Business-Health metric, any future affiliate-commission ledger, or any future
  promotional-credit ledger.
- No code path converts Wallet cents into XP, or XP into Wallet cents, in either direction.
- This is enforced the same way ADR-0038 §4 requires for affiliate/promo separation: *"a
  guard-pinned cross-instrument no-read invariant in any future... ledger, not... assertion."* The
  Wallet's runtime guard (§8) must assert zero imports of `lib/reputation/**` from any wallet
  module, and vice versa — mirroring the isolation `scripts/reputation-runtime.test.ts:45` already
  asserts for Reputation ("no billing/marketplace/kai/network/UI imports").

### 1.3 Relationship to `User.letterCredits`

| | `User.letterCredits` | CreditVector Wallet |
|---|---|---|
| Unit | **Count** of dispute letters (integer, not cents) | **Cents** (USD stored value) |
| Schema | `prisma/schema.prisma:65` — `letterCredits Int @default(0)` on `User` directly (a stored balance column) | New `WalletLedger` table (§2) — balance **derived**, never a `User` column |
| Grants | One SKU only: `letters_5` ($19 / 5 letters — `lib/stripe.ts:34-35,77-82,111`) | Any top-up amount (§4) |
| Spend gate | `canGenerateLetter()` / `spendLetterCredits()` — `lib/entitlements.ts:157-179,237-246` — gates **letter generation** (Kai Analysis → Dispute Package, Brief §1.2) | Gates **fulfillment** (Wallet Authorization → CreditVector Fulfillment, Brief §1.2, §1.10 stage 3) |
| Refundable | No refund path exists | FOUNDER-GATE refund exists (§3.5) |
| Fractional spend | No (whole letters only) | Yes (exact cents per rate decision) |

**Coexistence, not replacement.** v1 ships both, gating two different steps of the same Case
Journey (Brief §1.2: `Case → Kai Analysis → Dispute Package → Approval → Wallet Authorization →
CreditVector Fulfillment → Timeline → ...`). `letterCredits` answers "can this operator generate
another letter this month"; the Wallet answers "can this operator afford to mail the letter they
already generated." **Nothing converts silently between them**: no code path may debit
`letterCredits` to fund the Wallet, credit the Wallet from unused `letterCredits`, or vice versa.

**Eventual migration story — FOUNDER-GATE, out of scope for v1.** A future unification (e.g., a
combo pack granting both, or retiring `letterCredits` into a wallet-priced generation fee) is a
product decision requiring its own ADR, its own migration, and its own founder sign-off. This
document takes no position on it beyond naming that the two ledgers must stay legible and
separately auditable until such an ADR exists.

---

## 2. Ledger Architecture (Design, Not Implementation)

### 2.1 Precedent

The append-only `XpAward` ledger (`prisma/schema.prisma:749-786`, Sprint 10) is the load-bearing
precedent this section verbatim-sketches from. Its shape is proven in production discipline (two
dedicated guards: `scripts/reputation-migration-guard.test.ts`, `scripts/reputation-runtime.test.ts`)
and its comments (`prisma/schema.prisma:750-765`) already state the rules a financial ledger needs:
idempotency on a **stable business subject** (never a per-emission event id), compensating rows
instead of edits, `Restrict` FKs, fold-derived standing.

### 2.2 Proposed migration sketch — `WalletLedger`

```prisma
// ── CreditVector Wallet — append-only ledger (PROPOSED) ──────────────────────
// Migration-first (NOT self-heal — scripts/schema-safety.test.ts's
// LEGACY_SELF_HEAL_ALLOWLIST is FROZEN; this table must never be added to it).
// Mirrors XpAward (prisma/schema.prisma:766-786) field-for-field where the
// precedent applies; deviations are called out below.
model WalletLedger {
  id            String   @id @default(cuid())

  // Restrict, NOT Cascade — identical rationale to XpAward (prisma/schema.prisma:768-773):
  // this is an APPEND-ONLY financial audit ledger. A cascade on user deletion would let a
  // plain account delete silently destroy funding/spend history. Erasure must retain
  // pseudonymous, PII-free rows and shred only the identity join as an explicit step —
  // never a silent FK cascade.
  //
  // ⚠️ OPEN INTERFACE QUESTION → Agent A (see §9.1): keyed to User.id today — the only
  // identity primitive live in production (lib/session.ts currentAccount()). If Agent A's
  // Dispute Package / Case model keys fulfillment to OperatorIdentity/Organization once
  // Operator Identity activates (OPERATOR_IDENTITY_ENABLED), this FK target must move in
  // lockstep with that model — never a dual-write, never silent drift between two id spaces.
  user          User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  userId        String

  // "fund"|"authorize"|"consume"|"void"|"refund"|"adjust" — see §3.1 table for the
  // sign/effect/trigger of each. Compensating kinds (void/refund/adjust) always carry
  // `reversesId`.
  entryKind     String

  // Signed cents. Negative = debit (a hold or a spend); positive = credit (funding or a
  // compensating reversal); zero is valid ONLY for "consume" (§3.3 — a state-transition
  // marker, not a value fact; precedented by MILESTONE_REACHED@1 carrying no numeric value
  // at all, lib/eventBus/contracts.ts:279-282).
  amountCents   Int

  // The STABLE business subject this entry is about. NEVER the per-emission webhook/event
  // id (same law as XpAward.subjectId, prisma/schema.prisma:753-754). Domain depends on
  // entryKind:
  //   fund                → the funding transaction's own stable id, e.g. "topup:<eventId>:<cents>"
  //   authorize/consume/void/refund → the Dispute Package FULFILLMENT id (Agent A's identity
  //                          model — A-DOMAIN-MODEL.md — this is the alignment point in §9.1)
  //   adjust              → an admin correction id, paired with an AdminAuditLog row (§2.5)
  subjectId     String

  // The Policy Engine / pricing-policy version in effect when this entry was written.
  // Rows are NEVER re-weighted retroactively (mirrors XpAward.policyVersion never re-minting
  // past awards, lib/reputation/repository.ts's find-or-create semantics).
  policyVersion Int

  // Provenance — refs only, never raw payment data. Mirrors XpAward.sourceEventId
  // (prisma/schema.prisma:781) and the refs-only discipline of lib/eventBus/validate.ts.
  reversesId    String?  // compensating record → the original entry's id (void/refund/adjust)
  stripeRef     String?  // PaymentIntent/Charge/Refund id when Stripe actually moved money (fund/refund)
  sourceEventId String?  // provenance only (webhook/dispatch id) — NEVER part of the unique key

  createdAt     DateTime @default(now())

  // Idempotency triple — mirrors XpAward's @@unique([subjectId, operatorId, awardKind])
  // (prisma/schema.prisma:784). Including userId alongside subjectId is the same
  // defense-in-depth XpAward already applies: a subjectId construction bug must never
  // silently cross an account boundary. ONE entry per (user, subject, kind), ever — a
  // retried authorize/consume/void/refund call is a no-op returning the ORIGINAL row.
  @@unique([userId, subjectId, entryKind])
  @@index([userId, createdAt, id])   // the fold's canonical replay order
  @@index([subjectId])
}
```

**Entry-kind summary:**

| entryKind | amountCents sign | Balance effect | Triggered by | Gate |
|---|---|---|---|---|
| `fund` | + | credit | Stripe top-up webhook (§4) | live, flagged |
| `authorize` | − | debit (a hold) | Policy Engine rate decision at Approve→Wallet Authorized (§3.2) | live, flagged |
| `consume` | **0** | none — converts the hold from voidable to permanent (§3.3) | Provider Accepted (job id assigned) | live, flagged |
| `void` | + | credit (restores the hold) | Pre-consume failure/cancel (§3.4) | live, flagged |
| `refund` | + | credit (restores consumed funds, **in-wallet only** — §3.5) | Rare post-consume reversal | **FOUNDER-GATE** |
| `adjust` | ± | correction | Admin-only, paired with `AdminAuditLog` (§2.5) | **FOUNDER-GATE** (admin tooling) |

### 2.3 Balance is derived by fold, never stored

Direct precedent: `foldStanding()`, `lib/reputation/fold.ts:43-67` — sums signed values in
canonical `[createdAt asc, id asc]` order, floors at zero, and is the **sole** source of standing
(no stored balance column, no projection table to drift). Proposed pure-function analog:

```typescript
// PROPOSED — mirrors foldStanding (lib/reputation/fold.ts:43-67) exactly, including the
// floor-at-zero defense-in-depth (line 56: "a reversal can zero standing, never indebt it").
export function foldWalletBalance(rows: readonly WalletLedgerRow[]): WalletBalance {
  const ordered = [...rows].sort(canonicalOrder); // [createdAt asc, id asc]
  let cents = 0;
  for (const r of ordered) {
    const c = Number.isFinite(r.amountCents) ? Math.trunc(r.amountCents) : 0;
    cents += c;
  }
  if (cents < 0) cents = 0; // floor — a bug elsewhere must never surface as a negative balance
  return { availableCents: cents };
}
```

"Outstanding holds" (open authorizations not yet consumed or voided) is a **derived view over the
same ledger**, not a second source of truth — filter `entryKind:"authorize"` rows whose `subjectId`
has no sibling `consume`/`void` row yet. This is the identical technique
`reconcileOperatorFacts` (`lib/reputation/reconcile.ts:37-80`) uses to recompute projections by
re-scanning the ledger rather than trusting a cached flag.

### 2.4 Reconciliation publisher

Direct precedent: `lib/reputation/reconcile.ts:1-16` — *"fact emission at write time is best-effort
(a crash... loses a FACT, never TRUTH — standing always re-folds from the ledger). This makes
recovery EXECUTABLE WITHOUT a new outbox table or queue: it REUSES the Event Fabric's durable
mechanism — deterministic event ids + idempotent `appendEvent`."*

Proposed `reconcileWalletFacts(principal, userId)` mirrors `reconcileOperatorFacts` line for line:
fold the ledger, re-derive **exactly** the facts the live path would have emitted (same deterministic
builders, same dedupe keys as §5), so re-emitting an already-published fact is a pure no-op
(`replayed:true`) and a missing fact is recovered. Admin-gated. Read-only on the ledger (no entry is
ever created, updated, or deleted by the reconciler).

### 2.5 Admin corrections tie into the existing audit trail

`AdminAuditLog` (`prisma/schema.prisma:112-124`) already exists for *"privileged admin actions
(discount codes created, plans comped, roles changed...)."* Any `adjust` entry is a privileged
financial action of the same class — propose that writing a `WalletLedger` row with
`entryKind:"adjust"` is **required** to be paired with (or itself trigger) an `AdminAuditLog` row
(`action:"wallet.adjust"`, `targetType:"user"`), so a manual balance correction is never invisible
to the existing admin-action trail. FOUNDER-GATE (admin tooling, not built here).

### 2.6 Migration-first, additive, zero self-heal

`scripts/schema-safety.test.ts:97-120` — the frozen `LEGACY_SELF_HEAL_ALLOWLIST` (31 tables) is
closed; *"adding a table to that list requires a new owner-approved ADR"* and *"no NEW table may
self-heal."* `WalletLedger` ships as a reviewed Prisma migration (`prisma/migrations/<ts>_wallet/`),
never as `CREATE TABLE IF NOT EXISTS`. Zero `DROP`/`TRUNCATE`/`DELETE FROM`/`RENAME` statements —
same bar `scripts/reputation-migration-guard.test.ts:20-26` already enforces for
`operator_reputation`. A `wallet-migration-guard.test.ts` (named, not written — §8) should assert
the identical five things that guard asserts for `XpAward`/`ReputationMilestone`: additive-only,
no `ALTER` on any pre-existing table, the idempotency `@@unique` present, the fold-order index
present, and both FKs `ON DELETE RESTRICT` (never `CASCADE`).

---

## 3. Authorization Lifecycle Mapped to Fulfillment

Canonical timeline (Brief §1.10): `Prepared → Approved → Wallet Authorized → Submitted → Accepted →
Printing → Mailed → USPS Accepted → Delivered → Return Receipt Archived → Waiting Period → Ready
for Next Review.`

### 3.1 The four money-moving transitions

```
  Approved ──authorize──▶ Wallet Authorized ──(Submitted)──▶ Accepted ──consume──▶ Printing → ... → Delivered
      │                         │                                                      │
      │                    failure/cancel                                        rare post-hoc failure
      │                         ▼                                                      ▼
      └───────────────────── void (restores hold) ───────────────────────────── refund (FOUNDER-GATE)
```

### 3.2 Authorize — at Approve → Wallet Authorized

Fires exactly on the Brief §1.10 stage-2→stage-3 transition. `A-STATE-MACHINE.md` §7 (ownership
table) independently arrives at the identical boundary: `WALLET_AUTHORIZED`'s entry invariant is
*"policy engine has computed the certified-mail-inclusive price"* and its exit invariant is
*"wallet confirms a hold exists (Agent C)."* This confirms §3.2's placement without this document
needing to assume it.

The Wallet is a **pure consumer** of a rate decision — it never computes a rate itself (Brief §1.5:
the Fulfillment Policy Engine owns *"wallet-authorization requirements... Kai never decides
these"* — and neither does the Wallet). `A-POLICY-ENGINE.md` §3 already ships the actual shape (not
hypothesized here):

```typescript
// ACTUAL shape, A-POLICY-ENGINE.md §3 (PolicyDecision, excerpted) — the Wallet consumes
// this sub-object, not an invented FulfillmentRateDecision:
walletAuthorization: {
  required: true;      // always required to leave WALLET_AUTHORIZED
  amountCents: number;  // from lib/mail/MailPricing.ts computePrice() — the engine calls
                         // this, never invents a number (A-POLICY-ENGINE.md §3 comment)
  basis: string;
}
```

`authorizeWalletHold(userId, subjectId, decision.walletAuthorization)` writes **one** row:
`entryKind:"authorize"`, `amountCents: -decision.walletAuthorization.amountCents`,
`subjectId`. Gated atomically (§3.6) so a race can never authorize more than the available
balance. Returns enough for `A-STATE-MACHINE.md` §7's exit invariant to be checked mechanically
(`{ ok: true, entryId }`, not just a boolean) — `entryId` doubles as the `authorizationRef`
`D-KAI-EXPERIENCE.md` line 72 expects in its `package.funded` payload (§9.3).

**Gap found, flagged for Agent A/E — no `policyVersion` on `PolicyDecision`.** `A-POLICY-ENGINE.md`
§3's `PolicyDecision` (and its `walletAuthorization` sub-object) carries no `policyVersion` field
anywhere, but `WalletLedger.policyVersion` (§2.2) needs one to freeze — mirroring
`XpAward.policyVersion` never re-minting past awards. Either `PolicyDecision` gains a top-level
`policyVersion: number` (cheapest — one field, additive to an interface with zero implementations
yet), or the Wallet stamps its **own** independent pricing-policy version (decoupled from the
Policy Engine's version) — those are two different numbers with two different meanings, and
silently picking one is exactly the kind of unflagged decision the Brief's `§3` artifact contract
forbids. Not resolved here.

**Interface the Wallet must expose TO the Policy Engine (the read direction, not just the
write direction).** `A-POLICY-ENGINE.md` §2's `PolicyInput` names a field this document had not
anticipated: `wallet.hasSufficientAuthorization: boolean | null` (*"null = wallet not yet
consulted"*), consumed by the engine **before** it decides whether to proceed at all. This must be
a **cheap, read-only fold-and-compare** (`walletHasSufficientBalance(userId, amountCents): Promise<boolean>`
— no write, no claim) — it is a fast-path policy hint, not the authoritative gate. The
authoritative gate stays the atomic insert-guard at actual authorize time (§3.8): a read this
far ahead of the write is unavoidably racy (balance can move between the Policy Engine's read and
the operator's eventual click), so `hasSufficientAuthorization: true` is advisory ("don't bother
proposing this package"), never a substitute for §3.8's atomic check.

### 3.3 Consume — settle at provider **Accepted** (argued, not assumed)

The Brief lists both **Submitted** and **Accepted** as distinct canonical stages (§1.10, stages 4
and 5). This document picks **Accepted**, not Submitted, as the truthful settle moment:

- `MailProvider.createMailJob()` (`lib/mail/MailProvider.ts:108`) is the network call; its result
  (`CreateJobResult.providerJobId`, line 62) is the first **externally verifiable commitment** —
  today's `MailStatus` enum names exactly this: `PROVIDER_ACCEPTED — "provider accepted the job
  (has a provider job id)"` (`lib/mail/MailStatus.ts:16`).
- "Submitted" (the HTTP call was *made*) is not yet truthful: a provider can reject synchronously
  (bad address, provider-side validation — `MailProviderError` code `"rejected"`,
  `lib/mail/MailProvider.ts:122,126-135`). Consuming at Submitted would debit the operator's Wallet
  for a job that never actually got printed, requiring an immediate compensating void in the common
  rejection case — visible, confusing, and avoidable.
- Consuming at Accepted means the money only becomes permanent once an external party (the
  provider) has taken custody and returned an id CreditVector can track/cancel against.

`consumeWalletHold(userId, subjectId)` writes: `entryKind:"consume"`, **`amountCents: 0`**,
`reversesId:` the authorize row's id. The debit already happened at authorize; this row converts
the hold from voidable to permanent (refund-only). A zero-value, pure state-transition entry is
directly precedented: `MILESTONE_REACHED@1`'s payload (`lib/eventBus/contracts.ts:279-282`,
builder at `lib/reputation/events.ts:127-137`) carries **no numeric value at all** — a milestone is
"earned," not "worth an amount." Consume is the Wallet's equivalent: a state that happened, not a
value that moved. (Considered and rejected: a second negative row at consume — this would
double-count against the fold and break "balance derived by fold" unless authorize were redesigned
to be non-balance-affecting instead, which would then make "insufficient funds" undetectable at the
one moment the operator-facing UI needs it — Approve→Wallet Authorized, per Brief §1.10.)

**⚠️ Tension found against `A-STATE-MACHINE.md` §5.1 — flagged, not silently resolved.** That
document proposes inserting `WALLET_AUTHORIZED` into the *old* `MailManifest` pipeline
(`lib/mail/MailStatus.ts:28-32`, where `PAID` already sits immediately before `QUEUED` —
structurally before `PROVIDER_ACCEPTED`) and states *"`PAID` becomes the true settlement/capture
step... Agent C's authorize→consume→settle/void detail lives inside this span."* Read literally,
that places manifest-internal settlement/capture **before** the provider ever sees the job — i.e.,
at what this document would call authorize-confirmation, not at `ACCEPTED`. This document keeps its
own argued position (§3.3: consume fires at `ACCEPTED`, precisely to avoid debiting for a job the
provider might still reject) because `A-STATE-MACHINE.md` §5.1 itself says the span is *"not
designed further here — only the slot is reserved"* — i.e., Agent A explicitly left this exact
question to Agent C. Reconciliation for Agent E: the manifest-internal `PAID` sub-step (still
sitting before `QUEUED` in the old pipeline) should be understood as part of the **authorize**
span (the hold is confirmed/finalized, still voidable) — not as this document's `consume` — and
`A-STATE-MACHINE.md`'s use of "settlement/capture" for that sub-step is aspirational phrasing that
this document's `consume`-at-`ACCEPTED` argument supersedes, pending Agent E's actual call. Either
way, the *operator-visible* narration point is unaffected: `D-KAI-EXPERIENCE.md` ties its
`package.funded` Kai event to the `WALLET_AUTHORIZED` stage specifically (line 41), not to any
internal `PAID` sub-step, so this tension is confined to `MailManifest`-internal sequencing and
does not leak into the Case Journey UI either way.

### 3.4 Void — pre-consume failure or cancel

Per Agent A's forthcoming failure/dead-letter states (`A-STATE-MACHINE.md`). Until that exists, the
only concrete failure vocabulary in the repository is today's `MailStatus`: `CANCELED` (cancelable
only up to `PROVIDER_ACCEPTED` — `lib/mail/MailStatus.ts:43`) and `FAILED` (`lib/mail/MailStatus.ts:24,
34-36`). Void fires whenever an authorize row exists with **no sibling consume row**: a provider
rejection (`MailProviderError`), an operator cancellation before submission, or a Policy Engine
refusal after authorization but before dispatch. `voidWalletHold(userId, subjectId)` writes:
`entryKind:"void"`, `amountCents: +|authorize amount|`, `reversesId:` the authorize row's id. **Guard:
void must refuse when a consume row already exists for that subject** — that path is refund, not
void (named case "void-after-consume," §8.3).

**Confirmed against, and extended beyond, `A-STATE-MACHINE.md` §6.** That document independently
names a `PAYMENT_VOID` failure state (*"wallet authorization released/expired/failed (Agent C)
before fulfillment consumed it"*) and its mermaid diagram (§10) shows both
`WALLET_AUTHORIZED --> PAYMENT_VOID : wallet hold released/expired` and
`PAYMENT_VOID --> WALLET_AUTHORIZED : operator re-authorizes` — confirming void is re-authorizable,
not terminal. The word **"expired"** in Agent A's phrasing names something this document had not
yet addressed: a hold the operator simply abandons (approves, authorizes, then never returns to
send). **PROPOSED, FOUNDER-GATE (the TTL value itself):** an authorize hold carries an implicit
expiry — a reconciler sweep voids any `authorize` row older than a bounded window
(the number of hours/days is a founder call, not an architecture one) with no sibling `consume`
row, using the exact same mechanism as any other void (§3.8's guard applies unchanged: it can
never fire against an already-consumed subject). This is a **longer**, business-level window than
`STALE_CLAIM_MINUTES` (`lib/billing.ts:148`, 15 minutes) — that constant bounds a serverless
invocation's lifetime; a wallet hold's TTL bounds operator behavior instead, and the two must not
be confused or share a constant.

### 3.5 Refund — FOUNDER-GATE, precise about what it means

Fires only after consume, for the rare case fulfillment fails *after* the provider took custody
(e.g., USPS returns undeliverable after certified fees were already consumed) or a
legal/compliance directive requires reversing a charge.

**Two distinct things share the word "refund" — this document is precise about which one is in
scope:**

1. **In-wallet credit reversal** (what `entryKind:"refund"` means here): a compensating positive
   ledger row that makes the cents spendable again, in-app. This is the default, simpler shape.
2. **Cash-back-to-card** (an actual `stripe.refunds.create()` against an original charge): a
   *separate*, even-more-gated decision layered on top — it requires deciding which of possibly
   several top-up charges to refund against, and inherits the "no cash-out v1" refusal (§1.1)
   unless a founder decision explicitly reopens it.

v1 designs only (1), and only as FOUNDER-GATE. (2) is named, not designed, and requires its own
founder + CCO sign-off before any architecture work begins.

### 3.6 Every transition is claim-before-effect (ADR-0028 shape)

ADR-0028 §1.3: *"Dispatch = claim-before-effect... `claim` before `execute`; execute only when
`won`... `committed` → return the original stored receipt... `pending` → an INDETERMINATE result...
`failed` → reclaimable."* This shape — not any specific store — is what each transition must follow:

| Transition | Claim key |
|---|---|
| authorize | `wallet:<subjectId>:authorize` |
| consume | `wallet:<subjectId>:consume` |
| void | `wallet:<subjectId>:void` |
| refund | `wallet:<subjectId>:refund` |

Two existing mechanisms already realize this shape; **which concrete store backs the wallet's claim
layer is an implementation-time decision, not resolved here**:

- **ADR-0028's KernelPorts `IdempotencyStore`** (`claim/settle/lookup`, ADR-0028 §1.2) — the more
  architecturally general home, but currently **dormant** (`KERNEL_DURABLE` off; promotion criteria
  in ADR-0028 §5 not yet met).
- **The `StripeWebhookEvent` 3-state claim ledger** (`lib/billing.ts:150-233` —
  `claimStripeEvent`/`completeStripeEvent`/`releaseStripeEvent`, `pending:` prefix,
  `STALE_CLAIM_MINUTES = 15`) — **live production code** solving the identical
  at-least-once/concurrent-request problem for money, today.

This document recommends the pragmatic v1 choice is a `WalletClaim` table mirroring the
`StripeWebhookEvent` mechanics verbatim (same three states: `claimed | completed | in_flight`, same
stale-window reclaim), with a migration to the KernelPorts store as a possible future consolidation
**if/when** `KERNEL_DURABLE` activates. Either satisfies §8's runtime guards; neither is chosen here
as final.

**Merge question found — Agent A proposes a second, parallel claim table.** `A-STATE-MACHINE.md`
§8 independently proposes its **own** new claim table for mail-transition idempotency, keyed
`` `${mailId}:${toStage}` `` (*"new and FOUNDER-GATE (a small additive self-heal table... not the
same table [as `StripeWebhookEvent`], since that one's key shape is Stripe-event-specific)"*) — the
identical ADR-0028 shape this document proposes for `WalletClaim`, keyed `wallet:<subjectId>:<transition>`,
independently and without either document referencing the other. Two claim tables solving the same
shape of problem, in the same migration wave, is worth a single merge decision rather than two
independent ones: **either** a shared, generically-keyed `Claim` table (`key TEXT PRIMARY KEY`,
domain-agnostic) both `A-STATE-MACHINE.md`'s mail-transition guard and this document's wallet-transition
guard use, **or** two intentionally-separate tables on the reasoning that they protect different
domains with different lifetimes and a shared table would couple two migrations that should be
able to ship independently. Not resolved here — flagged for Agent E (§9.3).

### 3.7 Insufficient-funds UX contract (402-style)

Direct precedent: `app/api/letters/generate/route.ts:138-147` —
`{ error, upgrade: true, entitlement }` at `status: 402`. Proposed mirror:

```json
HTTP 402 Payment Required
{
  "error": "Insufficient wallet balance to authorize this fulfillment.",
  "topUp": true,
  "wallet": { "availableCents": 000, "requiredCents": 000, "shortfallCents": 000 }
}
```

This is the exact shape Agent B needs for the Package Review chain's Approve step (§9.2).

### 3.8 Negative balances are impossible

Two independent layers — the same "belts and braces" idiom `creditLetters()` already uses for its
dual dedup keys (`lib/billing.ts:242-246`):

1. **Insert-time guard.** `spendLetterCredits` (`lib/entitlements.ts:157-179`) clamps via a guarded
   `updateMany({ where: { letterCredits: { gte } } })` because it has a stored column to guard.
   `WalletLedger` is append-only with no stored column, so the equivalent guard lives in the INSERT
   itself:

   ```sql
   -- PROPOSED — the atomic authorize-insert guard. Adapts spendLetterCredits' clamp-on-race
   -- shape (lib/entitlements.ts:167-178) to an append-only table: the WHERE clause recomputes
   -- available balance from the ledger itself, in the same statement as the insert.
   INSERT INTO "WalletLedger" ("id","userId","entryKind","amountCents","subjectId","policyVersion","createdAt")
   SELECT $id, $userId, 'authorize', -$amountCents, $subjectId, $policyVersion, now()
   WHERE (
     SELECT COALESCE(SUM("amountCents"), 0) FROM "WalletLedger" WHERE "userId" = $userId
   ) >= $amountCents
   ON CONFLICT ("userId","subjectId","entryKind") DO NOTHING;
   -- 0 rows affected: re-read the row by its unique tuple (same fallback appendAward uses on a
   -- unique violation, lib/reputation/repository.ts:36-51). Present → replay (idempotent no-op).
   -- Absent → insufficient funds → 402 (§3.7).
   ```

2. **Fold-floor defense-in-depth.** `foldWalletBalance` floors at zero (§2.3), mirroring
   `foldStanding`'s `if (total < 0) total = 0` (`lib/reputation/fold.ts:56`) — so even a bug
   upstream of the insert guard cannot manifest as a negative number downstream.

---

## 4. Funding Integration Points

### 4.1 Stripe top-up reuses the `letters_5` one-time-payment shape exactly

Direct precedent: `app/api/stripe/checkout/route.ts:101-115` — `mode:"payment"`, metadata-carried
intent, no new checkout pattern. Proposed parallel branch:

```typescript
// PROPOSED — parallel to the existing letters_5 branch (app/api/stripe/checkout/route.ts:101-115).
if (body.product === "wallet_topup") {
  const amountCents = /* one of a preset list, OR a validated dynamic amount — §4.2 */;
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [ /* a fixed Price per preset, OR price_data with a dynamic unit_amount */ ],
    allow_promotion_codes: true,
    success_url: `${base}/wallet?topup=success`,
    cancel_url: `${base}/wallet?topup=cancelled`,
    metadata: { userId: user.id, product: "wallet_topup", amountCents: String(amountCents) },
    ...CONSENT_COLLECTION, // reused as-is — §4.4
  });
  return NextResponse.json({ url: checkout.url });
}
```

### 4.2 Preset vs. dynamic amount — a named, undecided fork

Every existing `PRICES` entry (`lib/stripe.ts:100-112`) is a **fixed** Stripe Price resolved via
`resolvePrice()` (lines 167-183). A top-up naturally wants either:

- **Preset amounts** (e.g., $25/$50/$100 buttons) — fits the existing pattern: one static `PRICES`
  entry per preset, resolved exactly like `letters_5`.
- **Customer-chosen amount** — requires Stripe's `price_data` with a dynamic `unit_amount` inline at
  session-creation time, a *different* code path than every existing `PRICES` entry.

Both are named; neither is decided. **FOUNDER-GATE** (a product/pricing decision, not an
architecture one).

### 4.3 Webhook grant — transactionally deduped, belt-and-braces

Direct precedent: `creditLetters()` (`lib/billing.ts:247-269`) and the webhook's `letters_5` branch
(`app/api/stripe/webhook/route.ts:142-147`). The bare `event.id` is already claimed for the whole
webhook event by `claimStripeEvent` (`lib/billing.ts:174-198`); the **suffixed** key is the
independent, transaction-scoped grant key (`lib/billing.ts:242-246`: *"the suffix keeps this
transactional grant as independent belt-and-braces"*). Proposed:

```typescript
// PROPOSED — parallel to creditLetters (lib/billing.ts:247-269).
} else if (cs.mode === "payment" && cs.metadata?.product === "wallet_topup") {
  const userId = cs.metadata.userId;
  const amountCents = Number(cs.metadata.amountCents);
  if (userId && Number.isInteger(amountCents) && amountCents > 0) {
    await fundWallet(userId, amountCents, event.id); // ledger subjectId: `topup:${event.id}:${amountCents}`
  }
  // else: credit NOTHING — §4.4.
}
```

`fundWallet` writes `entryKind:"fund"`, `amountCents: +amountCents`,
`subjectId: "topup:<eventId>:<amountCents>"` — so the ledger's OWN `@@unique([userId, subjectId,
entryKind])` independently prevents a double-fund even if the webhook-level claim were somehow
bypassed. Two independent locks, same funding grant — identical redundancy to today's
`letters_5` design.

### 4.4 Fail-closed unknown-amount law

Direct precedent: `planForPrice()` (`lib/stripe.ts:201-217`) — *"FAILS CLOSED: a price we do not
recognize... returns null, never a paid tier."* The Wallet's equivalent: an unrecognized,
non-integer, non-positive, or implausibly large top-up amount **credits nothing** and calls
`reportError` (mirrors `syncSubscriptionToUser`'s reporting on an unrecognized price,
`lib/billing.ts:77-87`) — never silently rounds, floors, or guesses an amount.

### 4.5 TOS/consent — reused as-is

`STRIPE_TOS_CONSENT` / `CONSENT_COLLECTION` (`app/api/stripe/checkout/route.ts:39-62`) applies to
every Checkout Session unconditionally today; the wallet top-up session spreads the same
`...CONSENT_COLLECTION` object. No new consent mechanism.

### 4.6 Pricing transparency before authorization (Brief §4 compliance)

Brief §4: *"Certified-mail pricing must be transparent before wallet authorization."* The full
`PriceBreakdown` (`lib/mail/MailPricing.ts:53-63`) — or the Policy Engine's equivalent — must render
**before** the Approve → Wallet Authorized transition fires, never as a surprise after. This is an
Agent B UX-moment expectation (Package Review chain, Brief §1.9 — Letter Preview → PDF Preview →
Approve): named in §9.2, not designed here.

**Tri-confirmed blocker, found independently by three documents.** `A-POLICY-ENGINE.md` §6 and
`B-MAIL-CENTER-EVOLUTION.md` §4.2 both independently traced the SAME concrete bug this requirement
runs into: `MailPricing.computePrice()` collapses the provider's own itemized
`CostEstimate.breakdown` (which DOES itemize certified mail correctly —
`lib/mail/providers/LetterStreamProvider.ts:104-106`, `+495¢`) into one lump `"Postage & printing"`
line (`lib/mail/MailPricing.ts:98`). **Today's `PriceBreakdown.lines` — the exact array a Wallet
Authorization screen would render — cannot show "Certified mail: $4.95" as its own line without a
change to `lib/mail/MailPricing.ts` (stop collapsing the breakdown) or the UI reading
`CostEstimate.breakdown` directly instead.** That fix belongs to Agent A / the Policy Engine, not
here or to Agent B — named as a shared open item in §9, not fixed by any of the three documents
(architecture-only; Brief §5 hard boundary).

**Closing Agent B's open item — the Wallet Authorization screen's data contract.**
`B-MAIL-CENTER-EVOLUTION.md` §299-301 asks Agent C directly what data/props the screen needs. Proposed:

```typescript
// PROPOSED — the read model Agent B's Wallet Authorization screen consumes. Composes
// §3.7's 402 shape with the (pending-fix, §4.6) rate breakdown — one screen, one contract.
interface WalletAuthorizationView {
  availableCents: number;         // foldWalletBalance() — §2.3
  requiredCents: number;          // decision.walletAuthorization.amountCents — §3.2
  sufficient: boolean;            // availableCents >= requiredCents
  breakdown: PriceBreakdown;      // lib/mail/MailPricing.ts:53-63 — pending the §4.6 fix above
  topUpHref: string;              // routes to the funding flow (§4.1) when !sufficient
}
```

Accepted: `B-MAIL-CENTER-EVOLUTION.md` §262 names `POST /api/packages/:packageId/wallet-authorize`
as the endpoint Agent B expects to call — this document accepts that name/shape as the HTTP
surface wrapping `authorizeWalletHold` (§3.2), returning `WalletAuthorizationView` on success and
the §3.7 402 shape on insufficient funds.

---

## 5. Event Fabric Integration

### 5.1 A structural catch that shapes every payload below

`lib/eventBus/validate.ts:22-27` denylists any payload **key** containing (among others) `"amount"`
or `"balance"` — checked by substring (`k.includes(bad)`, line 33). A field literally named
`amountCents` or `balanceCents` is **rejected by the existing PII structural guard**. This is
exactly why `OPERATOR_XP_CHANGED@1` (`lib/eventBus/contracts.ts:290-296`) uses `xpDelta`/`totalXp`,
never "amount"/"balance." Every contract below follows the same discipline; DB field names (§2,
naturally `amountCents`) are **not** subject to this guard — only event *payloads* are — and that
divergence is deliberate, not an inconsistency to "fix."

### 5.2 Proposed contracts

All four: `scope: "platform"` (server-authoritative — mirrors `OPERATOR_XP_CHANGED@1`'s scope,
`lib/eventBus/contracts.ts:64-67,291`, since wallet transitions are Policy-Engine/provider-triggered,
never a client-supplied amount), `defaultSource: "wallet"`, emitted via `systemIdentity(tenantId,
...)` (`lib/eventBus/envelope.ts:127-137`) exactly as `lib/reputation/events.ts:61` does.

```typescript
// PROPOSED — mirrors lib/eventBus/contracts.ts's OPERATOR_XP_CHANGED@1 (290-296) /
// REPUTATION_AWARD_REVERSED@1 (297-303) shape. zod .strict(), refs-only.

"WALLET_FUNDED@1": {
  type: "WALLET_FUNDED", version: 1, defaultSource: "wallet", scope: "platform",
  schema: z.object({
    userId: z.string().min(1),
    entryId: z.string().min(1),
    centsDelta: z.number().int().positive(),   // funded amount — NOT "amountCents" (§5.1)
    totalCents: z.number().int().nonnegative(), // running fold balance — NOT "balanceCents"
    origin: z.enum(["stripe_checkout", "admin_grant"]),
  }).strict(),
},

"WALLET_AUTHORIZED@1": {
  type: "WALLET_AUTHORIZED", version: 1, defaultSource: "wallet", scope: "platform",
  schema: z.object({
    userId: z.string().min(1),
    entryId: z.string().min(1),
    subjectId: z.string().min(1).max(120),      // the Dispute Package fulfillment id
    centsDelta: z.number().int().negative(),    // always negative — a hold
    totalCents: z.number().int().nonnegative(),
    policyVersion: z.number().int().nonnegative(),
    providerId: z.string().min(1).max(20),      // MailProviderId — refs only
  }).strict(),
},

"WALLET_CONSUMED@1": {
  type: "WALLET_CONSUMED", version: 1, defaultSource: "wallet", scope: "platform",
  // Zero-value state marker — precedented by MILESTONE_REACHED@1 (contracts.ts:279-282),
  // which likewise carries no numeric value. See §3.3 for the reasoning.
  schema: z.object({
    userId: z.string().min(1),
    entryId: z.string().min(1),
    subjectId: z.string().min(1).max(120),
    authorizationEntryId: z.string().min(1),    // links to the authorize row (reversesId)
    centsDelta: z.literal(0),
    totalCents: z.number().int().nonnegative(),
  }).strict(),
},

"WALLET_VOIDED@1": {
  type: "WALLET_VOIDED", version: 1, defaultSource: "wallet", scope: "platform",
  schema: z.object({
    userId: z.string().min(1),
    entryId: z.string().min(1),
    subjectId: z.string().min(1).max(120),
    authorizationEntryId: z.string().min(1),
    centsDelta: z.number().int().positive(),    // restores the hold
    totalCents: z.number().int().nonnegative(),
    // "basis", NOT "reason*" — the PII guard denylists any key containing "reason"
    // (lib/eventBus/validate.ts:26); same fix OPERATOR_STATE_CHANGED@2 already applies
    // (lib/eventBus/contracts.ts:225-227).
    basis: z.enum(["provider_rejected", "operator_canceled", "policy_failed"]),
  }).strict(),
},
```

Dedupe keys mirror `lib/reputation/events.ts:95,108` (`award:${award.id}` /
`reversal:${reversal.id}`) — one fact per row, keyed on the row's own id:
`fund:<entryId>` / `authorize:<entryId>` / `consume:<entryId>` / `void:<entryId>`.
`tenantId` = the wallet owner's account id (mirrors `op.accountId`, `lib/reputation/events.ts:87,101`).

A `WALLET_REFUNDED` contract name is **reserved** (not detailed here — refund is FOUNDER-GATE, §3.5).

### 5.3 Deprecation/versioning discipline (ADR-0036)

ADR-0036 §3 rule 1: *"A contract is immutable once shipped. A breaking payload change ships as a
new `@version`; the old version stays registered."* Any future `WALLET_*@2` follows the exact
template `OPERATOR_STATE_CHANGED@1 → @2` already demonstrates (`lib/eventBus/contracts.ts:210-248`
— v1 stays registered for replay, v2 adds richer fields). No contract is ever edited in place.

---

## 6. Reserved Future Surfaces (Integration Points Only)

**Marketplace.** ADR-0038 §5: *"Marketplace — owns inventory/listings/products/services/
availability/orders/marketplace-compliance; consumes entitlements; never mutates XP."* A future
Marketplace **may** consume Wallet cents as a payment rail for purchases, the same relationship it
already has to entitlements. Marketplace itself is dormant/counsel-gated (Brief §2.4). This document
reserves only the shape of the eventual call (`debitWalletForPurchase(userId, subjectId: orderId,
amountCents)`, structurally identical to the fulfillment consume path) — behind its own flag, its
own counsel review, not designed further here.

**Growth Network.** No existing architecture document defines "Growth Network" — it appears only in
Brief §1.6 as a Founder-named future Wallet responsibility; `ADR-0037-operator-growth-constitution.md`
does not use the term. This document takes the honest position: **funding-source rules are
undetermined.** Until a founder decision defines what Growth Network is and how it would fund or
be funded, the Wallet's only posture toward it is negative: no silent auto-transfer, no implicit
grant, no assumed relationship. Any future connection is FOUNDER-GATE plus its own ADR.

**Payouts (cash-out).** REFUSED for v1, full stop — same posture as `cash_affiliate_payout` in the
refusal register (`lib/reputation/scoring.ts:92-95`, `REFUSED_V1`) and Brief §2.4 (*"cash affiliate
payout REFUSED v1... no Stripe Connect/transfer/payout code exists"*). If ever built: it is a
**separate instrument and ledger** (never `WalletLedger` itself — PGE-4's separation-of-instruments
law applies here too), requires Stripe Connect (absent from this codebase today), and requires both
counsel (money-transmission / escheatment exposure of holding customer stored value) and CCO
sign-off **before any design work begins** — named, not designed.

### 6.1 What the Wallet does NOT do, v1 — explicit

No peer-to-peer transfer · no cash-out · no Marketplace spend (until Marketplace ships its own gate)
· no Growth Network funding · no cross-instrument conversion (no XP↔Wallet, no
`letterCredits`↔Wallet auto-conversion, §1.3) · no multi-currency (USD only) · no split
authorization across multiple providers for one fulfillment · no interest or appreciation (it is
not an investment instrument — echoes PGE-3's *"never an investment"*) · no negative balance, ever
(§3.8).

---

## 7. The Wallet Constitution — 10 Inherited Financial Invariants

Restated from Brief §2.4 (prose → 10 numbered invariants; **the numbering is this document's own
act of formalization**, not a pre-existing enumeration elsewhere in the repo).

| # | Invariant (Brief §2.4) | Wallet compliance mapping |
|---|---|---|
| **FI-1** | A single, authoritative balance representation (`User.letterCredits` is "the only balance field" today) | `WalletLedger` adds **no** stored balance column anywhere — balance exists only as `foldWalletBalance()`'s output (§2.3). It never competes with `letterCredits` for "the" balance; each answers a different question (§1.3). |
| **FI-2** | Claim-before-effect idempotency for money-moving handlers (`StripeWebhookEvent` 3-state, ADR-0028) | Every transition wrapped in a claim key `wallet:<subjectId>:<transition>` (§3.6); the webhook top-up reuses the identical `<eventId>:wallet_topup_<amount>`-shaped suffix key (§4.3). |
| **FI-3** | Fail-closed unknown-price/unknown-amount law (`planForPrice()`: unknown → null, never guessed) | §4.4 (unrecognized top-up amount credits nothing) and §3.2/§3.8 (a malformed or absent Policy Engine rate decision is refused, never estimated). |
| **FI-4** | Append-only ledger, subject-keyed idempotency (never per-emission event id), compensating rows, `Restrict` FKs, fold-derived standing, idempotent Event-Fabric reconciliation (no outbox) — the `XpAward` precedent | This is `WalletLedger`'s entire shape (§2). |
| **FI-5** | Plan/capacity versioning with a grandfather clause; dormant identity tables behind flags OFF | `policyVersion` per entry freezes the rate in effect at write time forever (§2.2); `userId` FK is explicitly flagged to move in lockstep if/when Operator Identity activates (§9.1), never silently. |
| **FI-6** | MIGRATION-FIRST, additive-only, 0 DROP; the self-heal allowlist is frozen | §2.6 — `WalletLedger` ships as a migration, never self-heal DDL, never added to `LEGACY_SELF_HEAL_ALLOWLIST`. |
| **FI-7** | Flags fail-closed OFF via exact string match (`=== "true"`), never truthy coercion | §8.1 — `WALLET_ENABLED` follows `operatorReputationEnabled()`'s exact pattern verbatim. |
| **FI-8** | Five instruments never converted/combined/cross-credited (ADR-0038 PGE-3/4) | §1.2 — the Wallet **is** the productized Cash instrument; zero reads/writes against XP, Business Health, Affiliate, or Promo-credit ledgers, either direction. |
| **FI-9** | Cash affiliate payout REFUSED v1; marketplace/funding modules dormant/counsel-gated | §6 — Payouts inherits this refusal verbatim; Marketplace consumption is a named integration point only, its own counsel gate, not designed here. |
| **FI-10** | No Stripe Connect/transfer/payout code exists; direct-vs-pooled migration discipline | §3.5 — v1 refund is an in-wallet ledger credit, **not** a Connect-style transfer/payout; any real cash-back payout requires Connect to be built first (it is not), its own FOUNDER-GATE, outside this document's scope. |

---

## 8. Activation Posture

### 8.1 Flag

```typescript
// PROPOSED — mirrors lib/reputation/flags.ts:7-9 and lib/eventBus/flags.ts:8-10 verbatim.
export function walletEnabled(): boolean {
  return process.env.WALLET_ENABLED === "true";
}
```

Every Wallet door (authorize/consume/void/refund/fund/reconcile) checks this first and fails closed
`{ ok: false, code: "disabled" }` — identical structure to
`svc.recordAward`/`reverseAward`/`getStanding` in `lib/reputation/service.ts`.

### 8.2 Migration is owner-gated, Gate-D-style

`.ai/RUNBOOKS/gate-d-production-migration.md` is the live template: a **read-only preflight**
(`scripts/gate-d-preflight.ts`) verifying the exact migration chain against production before
`prisma migrate deploy` ever runs, with all platform flags confirmed OFF throughout (lines 1-25).
Propose a follow-on `Gate-<N>`-style runbook for the `wallet` migration, modeled on that document:
same direct-connection discipline, same read-only-transaction preflight, same "flags stay OFF
through the gate" rule, `WALLET_ENABLED` added to the flag list it must keep OFF.

### 8.3 Guards — static source + executing runtime (named cases)

Direct precedent, the two-file split already proven for Reputation:
`scripts/reputation-migration-guard.test.ts` (static — greps migration SQL + schema for additive-only,
FK `RESTRICT`, the unique constraint) and `scripts/reputation-runtime.test.ts` (executing — actually
calls the service with the flag unset and asserts every door returns `disabled`, plus source-level
assertions like "no update/delete path anywhere," `lib/reputation/repository.ts` via
`scripts/reputation-runtime.test.ts:31-35`). Propose the identical split:
`wallet-migration-guard.test.ts` + `wallet-runtime.test.ts`, asserting these named cases:

| Case | Assertion |
|---|---|
| **Double-authorize** | The `@@unique([userId, subjectId, "authorize"])` tuple + claim-before-effect (§3.6) together guarantee a second `authorize` call for the same subject returns the **original** row (`created:false`), never a second hold. Runtime guard: call authorize twice with the same `subjectId`; assert one row, same `entryId`, unchanged balance impact after call 2. |
| **Double-consume** | Same unique-constraint mechanism on `(userId, subjectId, "consume")`. Runtime guard: analogous to double-authorize. |
| **Void-after-consume** | A misuse case, not a race — the DB constraint alone can't express "no consume exists yet," so this is an **application-level** check before the void insert. Runtime guard: consume a subject, then attempt to void it; assert a named refusal (e.g., `"already_consumed"`); assert **no** void row was written. |
| **Unknown-amount** | Mirrors `resolveAwardXp`'s fail-closed-on-unknown-class shape (`lib/reputation/policy.ts:53-57`: `if (!cls \|\| !cls.live \|\| cls.baseXp <= 0) return null`). Runtime guard: call authorize with a malformed `walletAuthorization` decision (non-positive/NaN `amountCents`, or missing `policyVersion` per the §3.2 gap); assert refusal; assert **no** ledger row written. |
| **Webhook replay** | Mirrors the already-tested Stripe dedup mechanics (`lib/billing.ts` `claimStripeEvent` + the `<eventId>:wallet_topup_<amount>` suffix key, §4.3) — this is **not** net-new risk, it inherits `creditLetters`' proven behavior. Runtime guard: simulate the same webhook event id delivered twice; assert `fundWallet` credits exactly once. |

---

## 9. Interface Expectations — For Agent A, Agent B, and Agent E (merge)

All four sibling artifacts (`A-DOMAIN-MODEL.md`, `A-STATE-MACHINE.md`, `A-POLICY-ENGINE.md`,
`B-MAIL-CENTER-EVOLUTION.md`) and `D-KAI-EXPERIENCE.md` existed in this worktree at write time and
were read; §9.1-9.2 below are grounded against their actual content, not hypothesized. Genuine
tensions found are reported, not silently resolved — matching the discipline those documents use
on each other and on themselves.

### 9.1 From Agent A (Policy/Rate/State hooks) — resolved, gaps, and one flagged tension

1. **Resolved — the rate-decision shape.** `A-POLICY-ENGINE.md` §3's `PolicyDecision.walletAuthorization
   = { required, amountCents, basis }` is the actual shape this document consumes (§3.2) — no
   invented interface was needed. `providerId` comes from the sibling `providerRouting.chosen`
   field; `certifiedRequired` from the sibling `delivery.certified` (always `true` per that
   document's law 4). These are three fields of **one** `PolicyDecision` object, not a
   wallet-specific bundle.
2. **Gap — no `policyVersion` on `PolicyDecision`.** Flagged in §3.2: `WalletLedger.policyVersion`
   needs a version to freeze and `A-POLICY-ENGINE.md` §3 does not expose one. Needs either an
   additive field on `PolicyDecision` or the Wallet's own independent version counter — two
   different meanings, not resolved here.
3. **Gap — the Wallet must expose a read interface, not just accept writes.**
   `A-POLICY-ENGINE.md` §2's `PolicyInput.wallet.hasSufficientAuthorization: boolean | null` expects
   a cheap read-only balance check FROM the Wallet as a policy input, ahead of and separate from the
   authoritative atomic authorize-time guard (§3.2, §3.8). This document did not originally design
   for this read direction; now named as `walletHasSufficientBalance(userId, amountCents)`.
4. **Confirmed — the authorize boundary.** `A-STATE-MACHINE.md` §7's ownership table independently
   states `WALLET_AUTHORIZED`'s exit invariant as *"wallet confirms a hold exists (Agent C)"* —
   matching §3.2 without this document needing to assume it.
5. **⚠️ Flagged tension, not resolved — the settlement moment.** `A-STATE-MACHINE.md` §5.1 names the
   manifest-internal `PAID` sub-step (sitting, in the old pipeline, immediately before `QUEUED` —
   i.e., before the provider ever sees the job) as *"the true settlement/capture step"* housing
   "Agent C's authorize→consume→settle/void detail." This document's §3.3 instead argues consume
   fires at `ACCEPTED` (after the provider returns a `providerJobId`), specifically to avoid
   debiting for a job the provider might still reject. Agent A explicitly left the span *"not
   designed further here"* — so this document keeps its own argued position, but the discrepancy is
   real and Agent E must pick one reading (§3.3 has the full reconciliation). The operator-visible
   narration is unaffected either way (`D-KAI-EXPERIENCE.md` ties `package.funded` to the
   `WALLET_AUTHORIZED` *stage*, not to the internal `PAID` sub-step).
6. **Confirmed — hold release is a modeled failure state.** `A-STATE-MACHINE.md` §6/§10 names
   `PAYMENT_VOID` and shows it as re-authorizable, matching §3.4's void design; its use of
   "expired" surfaced the hold-TTL requirement this document added in §3.4.
7. **Open — two independent claim-table proposals.** `A-STATE-MACHINE.md` §8 proposes its own new
   claim table for mail-transition idempotency (keyed `` `${mailId}:${toStage}` ``), the same
   ADR-0028 shape §3.6 proposes for `WalletClaim` (keyed `wallet:<subjectId>:<transition>`),
   independently and without cross-reference. Whether these should be one generic `Claim` table or
   two domain-separated tables is a merge decision (§3.6), not decided here.
8. **Open — the `MailPricing.ts` line-collapsing bug** (§4.6) blocks the pricing-transparency
   requirement as currently implemented; `A-POLICY-ENGINE.md` §6 independently found the same root
   cause (the `certified: false` hardcode) from a different angle. Neither document fixes it
   (architecture-only).
9. **Identity model alignment** (§2.2) — `WalletLedger.userId` keys to `User.id` today, matching
   every identity reference in `A-DOMAIN-MODEL.md`'s own new models (`Case.userId`,
   `DisputePackage.userId`, both plain `User` FKs, no `OperatorIdentity` reference anywhere in that
   document either) — so this document's assumption was already the right one; no divergence found.
   Still flagged for Agent E to re-confirm if Operator Identity activates before this merges.
10. **Subject-id lifecycle** — `A-DOMAIN-MODEL.md` §2.2 confirms one `DisputePackage` aggregates
    N `(Letter, MailManifest)` pairs with package-level `stage` as a *rollup* (least-progressed
    child). This document's `subjectId` = the package's own id is therefore correct at the package
    grain — but confirm with Agent A whether a **retry after a terminal failure** (§7's `REJECTED`→
    `PREPARED` / `RETURNED_TO_SENDER`→`PREPARED` transitions in the mermaid diagram, §10) reuses the
    same `DisputePackage.id` or mints a new one; this document assumes a fresh authorize/consume/void
    cycle either way (a new manifest suffix, `mail_<letterId>_r2`, does not by itself imply a new
    package id, and the ledger's idempotency behavior differs meaningfully between the two readings).

### 9.2 From Agent B (UX moments) — one item closed, two confirmed, one still open

1. **Closed here** — `B-MAIL-CENTER-EVOLUTION.md` §299-301 asked this document directly for the
   Wallet Authorization screen's data contract. §4.6 now answers it: `WalletAuthorizationView`
   (`availableCents`, `requiredCents`, `sufficient`, `breakdown`, `topUpHref`), and this document
   accepts Agent B's proposed endpoint name, `POST /api/packages/:packageId/wallet-authorize`
   (`B-MAIL-CENTER-EVOLUTION.md` §262).
2. **Confirmed, tri-found** — the pricing-transparency requirement (§4.6, Brief §4) is blocked by
   the same `MailPricing.ts:98` line-collapsing bug `A-POLICY-ENGINE.md` and
   `B-MAIL-CENTER-EVOLUTION.md` independently found. All three documents agree on the assignment
   (Agent A/Policy Engine owns the fix); none fixes it here.
3. **Confirmed** — the 402 insufficient-funds contract (§3.7) needs a UX moment routing to a top-up
   flow, not the plan-upgrade flow the existing letter-generation 402 routes to.
4. **Still open** — preset-amount vs. custom-amount top-up entry (§4.2) is not addressed in
   `B-MAIL-CENTER-EVOLUTION.md` as read; remains FOUNDER-GATE regardless of which UI is proposed.

### 9.3 Notes for Agent E (merge)

- This document introduces **one** new table (`WalletLedger`) and **zero** changes to any existing
  table. It does not touch `User.letterCredits`, `StripeWebhookEvent`, `XpAward`, or `EventEnvelope`.
- It adds four (reserved: five) new `EventType` literals (`WALLET_FUNDED`, `WALLET_AUTHORIZED`,
  `WALLET_CONSUMED`, `WALLET_VOIDED`, reserved `WALLET_REFUNDED`) to the closed set in
  `lib/eventBus/envelope.ts:21-60` — additive to that list, no existing type touched.
  `lib/eventBus/contracts.ts` gains four (reserved: five) new entries — no existing contract edited.
  Both are exactly the kind of additive change ADR-0036 §3 rule 1 sanctions.
  Also declared here: `lib/eventBus/validate.ts`'s `PII_DENYLIST` (line 23) already blocks
  `"amount"`/`"balance"` substrings — every wallet contract in §5 was designed around this
  existing guard, not against it; no change to `validate.ts` is proposed or needed.
- **Naming collision, flagged — "funded" means two different things across documents.**
  `D-KAI-EXPERIENCE.md` names a `package.funded` `KaiEvent` (a *narration*-layer fact, powering
  `/journey`) tied to the `WALLET_AUTHORIZED` stage — i.e., Kai's "funded" corresponds to **this
  document's `entryKind:"authorize"`**, not to `entryKind:"fund"` (§2.2's top-up entry, an
  account-level event with no `DisputePackage` subject at all). `D-KAI-EXPERIENCE.md` line 72's
  `authorizationRef` in `package.funded`'s payload is this document's `WALLET_AUTHORIZED@1.entryId`
  (§3.2 notes this correspondence explicitly). Agent E should not let "funded" collapse into one
  concept across the merged documents — they are two different ledger entry kinds that happen to
  share an English word.
- Two independent claim-table proposals (`A-STATE-MACHINE.md` §8 and this document's §3.6)
  solve the same shape of problem for different domains — merge decision named in §9.1 item 7.
- Every numbered FOUNDER-GATE in this document (refund-to-card, payouts, Marketplace consumption,
  Growth Network funding, top-up preset-vs-dynamic, hold-TTL value, migration execution,
  activation) is a distinct founder decision — Agent E should not collapse them into one approval;
  they have different blast radii and different reviewers (some need CCO, some need counsel, some
  are pure product calls).

---

**Summary for the merge agent:** the CreditVector Wallet is architected as a sixth-instrument-shaped
but firmly Cash-instrument-scoped, append-only, fold-derived ledger (`WalletLedger`) reusing
`XpAward`'s exact idempotency/compensating-row/Restrict-FK shape, `StripeWebhookEvent`'s exact
claim/settle/replay shape, and `lib/eventBus`'s exact contract/PII-guard/versioning shape — with
four money-moving transitions (authorize/consume/void/refund) mapped onto the Brief's canonical
fulfillment timeline, a reasoned (not assumed) choice of "Accepted" as the truthful settlement
moment, and every activation surface (flag, migration, guards) named but left owner-gated. It was
cross-checked against Agent A's, Agent B's, and Agent D's actual (already-written) artifacts, not
just the Brief's digest: most assumptions held (the authorize boundary, the identity model, the
`PAYMENT_VOID` failure state); a few concrete gaps and one genuine tension were found and are
reported in §9, not silently resolved. Nothing here is implemented; nothing here contradicts
Brief §2's repository truth digest.
