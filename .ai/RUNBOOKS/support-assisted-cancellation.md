# Runbook — support-assisted cancellation for a suspended subscriber

**Status: OPERATIONAL FALLBACK. This is a process, not a closed technical capability.**
It exists because a gap in the product cannot be closed in the Version 1.0 release wave, and it
stops being needed only when that gap is closed in code.

**Two fields below are OWNER ACTION REQUIRED and are deliberately left blank. Do not fill them with
a guess — an unpublished channel leaves the customer exactly where the gap puts them.**

---

## 1. The gap this covers — stated exactly

A paying subscriber whose account is **disabled** can cancel their own subscription at
`/billing/cancel`, which calls `POST /api/billing/self-cancel`. That path resolves identity from the
session's **immutable user id**.

**It requires a still-valid session.** `lib/auth.ts` refuses sign-in for a disabled account —
`if (user.disabled) return null;`, before the password is even compared — and sessions are stateless
JWTs. So:

| Situation | Can they self-cancel? |
|---|---|
| Disabled, still holding a valid session token | **Yes** — via `/billing/cancel` |
| Disabled, signed out or token expired | **No** — they cannot sign in, so they cannot reach any authenticated surface |

**The second row is the gap.** Such a customer continues to be billed by Stripe on schedule and has
no in-product way to stop it. Their remaining routes are this support process, or a card dispute /
chargeback with their issuer.

**RC1 records the disabled-subscriber item as PARTIAL, not closed, for exactly this reason.**
Closing it in code means reopening a scoped sign-in surface for disabled accounts — a change to
`lib/auth.ts` and `lib/session.ts`, two of the highest-risk files in the repository — which was
deliberately **not** done in this release wave.

---

## 2. What support must offer

An **identity-verified cancellation on request**, performed by an admin.

The mechanism already exists and needs no new code: `POST /api/admin/billing/cancel`
(`{ subscriptionId, immediate? }`), admin-gated and audit-logged, defaulting to cancel-at-period-end
— the same default the self-service path uses.

**Requirements on the process:**

1. **Identity must be verified before cancelling.** A cancellation request is a request to stop
   someone's money; acting on an unverified one is its own harm. Verify against attributes already
   on the account — do not invent a new verification scheme in this runbook.
2. **No support employee may ever ask for a password, a session token, an API key, or any other
   secret.** There is no support workflow that needs one. A request for one is a phishing pattern
   regardless of who sends it, and staff should be told to refuse and escalate.
3. **Every cancellation must be auditable.** Use the admin route so `logAudit` records actor, action
   and target. A cancellation performed directly in the Stripe Dashboard leaves no record on our
   side and must not be the normal path.
4. **Say what was done, in the customer's terms.** Cancel-at-period-end means billing stops at the
   end of the period they have already paid for; it does not refund that period, and it does not
   restore account access. Do not imply otherwise.
5. **Suspension and billing are separate decisions.** Cancelling the subscription does not re-enable
   the account, and must not be used as a way to do so.

---

## 3. OWNER ACTION REQUIRED — two blanks

| Field | Value | Status |
|---|---|---|
| Published support channel for cancellation requests | *(not set)* | **OWNER ACTION REQUIRED** |
| Published response SLA | *(not set)* | **OWNER ACTION REQUIRED** |

**Both must be published where a suspended customer can actually see them** — a channel a
signed-out, suspended user cannot find is not a fallback. The product surfaces available to such a
user are limited by the same gap this document describes, so the practical answer is likely to be
outside the authenticated app.

**Until both are set, this fallback is a plan, not a control.** Do not describe the
disabled-subscriber item as mitigated on that basis.

---

## 4. Monitoring, so a request cannot be silently dropped

Cancellation is only as reliable as the queue behind it. A missed request is a continuing charge the
customer cannot stop — which is materially worse than a slow reply, because the customer has no
alternative. Whatever channel the owner publishes needs a way to see that a request was received and
resolved.

**Reconciliation is separate and still required:** the existing population of disabled accounts that
still hold a live subscription has to be enumerated and resolved deliberately, one by one. That
procedure is in `scripts/verify-production.sh` and is a **production** task, not a code change.

---

## 5. What would retire this document

A scoped, single-purpose re-authentication path that lets a disabled account prove who it is and
reach the cancellation route **and nothing else** — no general session, no application access. That
is a deliberate security change with its own review, not an incidental one, and it is an open owner
decision rather than scheduled work.

Until then this runbook is load-bearing.

---

*Related: `RC1-DISABLED-ACCOUNT-POLICY.md` (why the policy is what it is, and the options that were
weighed) · `app/api/admin/billing/cancel/route.ts` (the mechanism) · `scripts/verify-production.sh`
(the production reconciliation procedure).*

*Legal note: whether a support-channel-only path is sufficient, and what a defensible cancellation
channel looks like for a suspended consumer-finance customer, is **BLOCKED — COUNSEL (B-12)** and is
not resolved by this document. Nothing here is legal advice.*
