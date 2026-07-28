# RC1 — Disabled accounts and live billing

**Status: OWNER DECISION REQUIRED. Nothing in this document has been implemented.**
It maps the behaviour that exists today and lays out bounded options. It does not choose one,
and it does not state a legal conclusion — where a legal question is load-bearing it is marked
**BLOCKED — COUNSEL** and routed to B-12.

Scope: what happens to a paying subscriber whose account is disabled. Raised by RC1 Wave 1,
which changed `app/api/stripe/portal/route.ts` to resolve identity through `currentAccount()`.

---

## 1. Current behaviour — VERIFIED from the code

Every statement here is read from the repository at the current HEAD.

| # | Fact | Source |
|---|---|---|
| 1 | `disabled` is a `Boolean @default(false)` on `User`; an admin sets it. | `prisma/schema.prisma` (`model User`), `app/api/admin/users/[id]/route.ts:46-51` |
| 2 | A disabled user **cannot sign in**. The credentials provider returns null before the password is even compared. | `lib/auth.ts:52` |
| 3 | A disabled user **holding an already-issued JWT is evicted from every authenticated surface**, because `currentAccount()` re-reads the row and returns null when `disabled`. Sessions are stateless JWTs, so this re-check is what makes suspension immediate rather than "whenever the token expires". | `lib/session.ts` (`currentAccount`) |
| 4 | `requireAdmin()` applies the same rule for admins. | `lib/admin.ts:29` |
| 5 | **The Stripe Billing Portal is behind that same gate.** `POST /api/stripe/portal` calls `currentAccount()` and returns **401 "Please sign in first."** when it is null. | `app/api/stripe/portal/route.ts` |
| 6 | Disabling an account performs **no billing action at all**. The PATCH writes `disabled` (and audit-logs it) and never touches Stripe. | `app/api/admin/users/[id]/route.ts` |
| 7 | Stripe therefore **keeps charging** a disabled subscriber on schedule. Our webhook keeps syncing `subscriptionStatus`/`plan` onto a row nobody can log into. | `app/api/stripe/webhook/route.ts`, `lib/billing.ts` |
| 8 | An **administrative cancellation path already exists**: `POST /api/admin/billing/cancel { subscriptionId, immediate? }`, admin-gated and audit-logged. Default is cancel-at-period-end. | `app/api/admin/billing/cancel/route.ts` |
| 9 | There is **no automated link** between disabling and cancelling. Nothing enumerates disabled accounts that still hold an active subscription. | absence — grep for `disabled` under `app/api/admin/billing` returns nothing |

### The exact situation this creates

```
admin disables account
        │
        ├─ user cannot log in            (lib/auth.ts)
        ├─ user cannot reach the portal  (currentAccount() → null → 401)
        ├─ Stripe keeps charging         (nothing cancels)
        └─ only an admin can stop it     (POST /api/admin/billing/cancel)
```

The customer's **only** remaining routes to stop the charge are: contact support and wait for a
human, or dispute/chargeback with their card issuer.

### Two clarifications that keep this from being over- or under-stated

- **The 401 is not the whole cause.** Even before Wave 1 the customer could not have reached the
  portal, because they cannot *sign in* (fact 2). Wave 1 closed a session-lifetime hole, it did
  not create the inability to cancel. Reverting the portal to `currentUser()` or to an
  email-resolved lookup would **not** restore self-cancellation, and would re-open the two
  defects that change fixed (a stale token resolving to a stranger's Stripe customer, and an
  agency being able to open a consumer's portal). **Reverting is not on the table below.**
- **Stripe's own emails still reach the customer.** Receipts and (if enabled) the hosted
  invoice page are sent by Stripe, not by us, so a disabled subscriber still *sees* the charge
  even though they cannot act on it in-product. Whether receipt emails are actually enabled is
  **V-13 — VERIFICATION REQUIRED — PRODUCTION** (Stripe Dashboard → Customer emails).

### How often does this bite today?

**VERIFICATION REQUIRED — PRODUCTION.** The repository cannot see how many disabled accounts
hold a live subscription. `scripts/verify-production.sh` prints the procedure (admin Users list
→ `subscriptionStatus`, cross-checked against Stripe Dashboard → Customers). **If the answer is
zero, this is a policy gap to close before it is ever exercised, not an active incident.**

---

## 2. Why this is not simply an engineering choice

Disabling is used for at least three materially different reasons, and they do not deserve the
same billing treatment:

| Reason to disable | What the customer is owed |
|---|---|
| Fraud / chargeback abuse / ToS violation | Access removal is the point. Continuing to bill may still be wrong. |
| Security lock (suspected account takeover) | The **legitimate** owner is locked out of their own billing by a protective action. |
| Administrative or accidental | Nothing was intended to change about billing at all. |

Today all three produce the identical outcome: no access, no self-service cancellation, charging
continues.

**Consumer-rights hazard (do not treat as merely operational).** On a live consumer-finance
product, taking money on a recurring basis while removing the customer's ability to stop it is
the shape of practice that attracts negative-option / auto-renewal and unfair-practice scrutiny,
and it is a textbook chargeback trigger. The precise legal exposure — including whether any
"click to cancel"-style requirement applies to CreditVector and what a defensible alternative
cancellation channel looks like — is **BLOCKED — COUNSEL (B-12)**. This document does not
resolve it and must not be read as legal advice. What is *not* blocked, and is stated as
engineering fact: **the product currently has no self-service way for a paying customer in this
state to stop the charge.**

---

## 3. Options

Each is stated with what it changes, what it costs, and what it gives up. They are not mutually
exclusive — B is a floor that A, C and D can all sit on top of.

### Option A — Cancellation-only portal access

Let a disabled account authenticate *only* far enough to open a Stripe Billing Portal session
configured for cancellation (and invoice viewing), with every other surface still closed.

- **Security:** the widest of the four. It requires a deliberate exception to the fail-closed
  rule `currentAccount()` exists to enforce, plus a sign-in path for an account that
  `lib/auth.ts` currently refuses outright. A fraud-disabled account regains a credentialed
  entry point; an attacker who took over an account and *caused* the security lock gets a
  working login again. Any implementation must not hand back a general session — a scoped,
  single-purpose token, and a portal configuration that permits cancellation only, are the
  minimum bar.
- **Customer rights:** the strongest. Self-service cancellation, no human in the loop, no SLA.
- **Operations:** no queue, no new manual work.
- **Cost:** the largest engineering change here, and it touches two of the highest-risk files in
  the repo (`lib/auth.ts`, `lib/session.ts`) plus the portal route. Needs its own security review.

### Option B — Administrative cancellation, with a published SLA

Keep the gate exactly as it is. Make cancellation-on-request an operational commitment: a
documented contact channel, a stated response time, and a runbook step that the admin cancels
via the existing `POST /api/admin/billing/cancel`.

- **Security:** unchanged — nothing is reopened. The best posture of the four.
- **Customer rights:** the weakest of the four *and* the one that depends on us performing.
  Cancellation is only as reliable as the queue behind it; a missed request is a continuing
  charge the customer cannot stop. Whether a support-channel-only cancellation is sufficient is
  the **BLOCKED — COUNSEL** question in §2.
- **Operations:** ongoing manual load; needs monitoring so a request cannot be silently dropped.
- **Cost:** near zero in code (the route exists). The work is process, documentation and the
  user-facing copy that tells a disabled customer where to write.

### Option C — Automatic billing suspension on disable

Make disabling also act on the subscription — either `cancel_at_period_end: true` or an
immediate cancel — in the same admin action, audit-logged, with re-enable as a separate manual
re-subscribe.

- **Security:** unchanged; nothing is reopened.
- **Customer rights:** strong for the *outcome* (the charge stops without the customer doing
  anything) but it is unilateral: an accidental or precautionary disable now also destroys a
  paying subscription, and a security lock that was meant to be temporary ends the relationship.
  Reinstating means a new subscription — proration, a new billing anniversary, possibly a
  different price if the catalog moved.
- **Operations:** simplest steady state; nothing to remember, nothing queued.
- **Cost:** small and contained (`app/api/admin/users/[id]/route.ts` plus the Stripe call, which
  already exists in `app/api/admin/billing/cancel/route.ts`). Must be idempotent and must not
  fail the disable itself if Stripe errors — disabling is often urgent.
- **Sub-choice if C is picked:** *at period end* (customer keeps paid time they already bought)
  versus *immediate* (cancel now, refund handled separately). These have different refund and
  accounting consequences.

### Option D — Disabled-but-billing-access exception

Narrow C's blast radius by splitting the state: a `disabled` account loses product access, and a
separate flag governs whether billing self-service survives. Security locks and administrative
disables keep billing access; fraud/abuse disables do not.

- **Security:** narrower than A but the same class of exception, and it still needs a sign-in
  path for a disabled account. It also adds a state an admin can set wrongly under pressure.
- **Customer rights:** the best fit to the three reasons in §2 — the right answer per case.
- **Operations:** an extra decision at disable time, every time.
- **Cost:** the largest overall: **new schema** (a column or an enum on `User`), which under the
  ratified **MIGRATION-FIRST** policy means a reviewed migration with preflight, forward
  validation and a rollback plan (`.ai/RUNBOOKS/schema-change.md`) — plus the auth/session work
  Option A needs, plus admin UI. Not a small change.

### Cross-cutting, and independent of which option wins

Whatever is chosen, **the current population must be reconciled**: enumerate disabled accounts
holding a live subscription and resolve each one deliberately. That is a one-time production
task, not a code change, and it is listed in `scripts/verify-production.sh` §2.

---

## 4. Comparison

| | A · cancellation-only portal | B · admin cancellation + SLA | C · auto-suspend on disable | D · split flag |
|---|---|---|---|---|
| Reopens an auth surface | **yes** | no | no | **yes** |
| Customer can stop the charge unaided | yes | no | n/a (already stopped) | depends on flag |
| Depends on us performing | no | **yes** | no | no |
| Ongoing manual work | none | per request | none | per disable |
| Destroys a subscription unilaterally | no | no | **yes** | only when flagged |
| New schema / migration | no | no | no | **yes** |
| Engineering size | large | very small | small | largest |
| Files touched | `lib/auth.ts`, `lib/session.ts`, portal route | docs + copy | admin user PATCH | schema + auth + session + admin UI |

---

## 5. The decision requested

> **Which policy governs a disabled account that holds a live subscription — A, B, C, or D
> (and if C, cancel at period end or immediately)?**

Nothing will be implemented until that is answered. Two notes for the answer:

1. **B is the only option that needs no code**, so it can also serve as an interim floor while a
   larger option is built — but only if the contact channel and SLA are actually published,
   because an unpublished channel leaves the customer exactly where §1 puts them.
2. **The counsel question in §2 may constrain the answer.** If B-12 concludes that a
   self-service cancellation path is required, B alone stops being sufficient and the choice
   narrows to A, C or D.

---

*Related: `CREDITVECTOR_RC1_CRITERIA.md` (canonical Go/No-Go) · `scripts/verify-production.sh`
(the production reconciliation procedure) · `.ai/RUNBOOKS/schema-change.md` (needed only for D).*
