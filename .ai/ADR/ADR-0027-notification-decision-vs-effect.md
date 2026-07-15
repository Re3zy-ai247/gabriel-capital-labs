# ADR-0027: Notification — separate the Decision (Layer 2) from the Effect (Layer 3)

Status: **ACCEPTED (founder-approved 2026-07-15).** Governs GIOS Migration #10.
Date: 2026-07-15
Decision owners: Founder directive + Chief Architect
Supersedes the naive "wrap the sender behind a kernel effect-port" proposal for #10.
Evidence: adversarial architecture review — recon + 6 independent refute-by-default lenses +
synthesis (8 agents, 0 errors). Ratifies the three-runtime model (ADR-0023) at the first
capability whose output is a *side effect*, not a value.

> The five migrations before #10 (`credit.letter.draft`, `response.analyze`,
> `obsolescence.window`, `tradeline.insight`, `campaign.compose`) were all **pure — their
> output is a value you can re-run and diff.** Notification is the first capability whose
> output is an **effect** (an email/push send): non-deterministic, non-reproducible,
> irreversible. "Wrap → prove byte-identical" cannot apply to a send. This ADR records how
> we migrated it *without* violating that rule — and what we deliberately did **not** build.

## 1. Context
CreditVector sends user/admin notifications from **11 in-repo call sites** — 7 email
(`lib/email.sendEmail`/`sendAdminEmail`: password reset, moderation/community/comment alerts,
brief-ingest nudges, weekly digest) and 4 push (`lib/push.sendPushToAdmins`; note
`sendPushToUser` has **zero** user-facing callers today — 100% admin fan-out). These senders
are already **fail-safe** (no-op when unconfigured) and **flag-dormant** (`MAIL_LIVE`,
`RESEND_API_KEY`, VAPID). Physical certified mail (`lib/mail/*`, `lib/mailExecution.ts`,
`LetterStreamProvider`) is a **separate, stronger** pipeline (8-method `MailProvider`,
`PAID`/`APPROVED` user-approval gate, `letterContentHash` proof-of-intent, `MAIL_LIVE`
recording dry-run) with **zero cross-imports** to the notification path.

## 2. Decision
**Migration #10 ships the DECISION only, as a platform-generic Layer-2 capability, and
DESIGNS — but does not build — the Layer-3 effect.**

- **`notify.plan.compose`** (module `notify`, GIOS-**platform**, not CreditVector): a pure,
  deterministic function `NotifyPlanInput → NotificationPlan` that derives
  - a **token-free, tenant-scoped idempotency key** `sha256(channel|tenantId|purpose|recipientRef|event)`
    — never `Date.now()`, a UUID, or a reset token; a retry of one logical event coalesces,
    two distinct events never collide, cross-tenant keys never collide;
  - the **transactional vs commercial** purpose class (the app declares it; the platform
    enforces the consequences — mechanism-not-policy);
  - the **CAN-SPAM header policy** (commercial email MUST carry `List-Unsubscribe(+Post)` and
    a postal footer; a transactional email MUST NOT carry them — a user can never opt out of
    security mail);
  - **hash-only** content + recipient digests (SHA-256) so the future receipt holds **no PII**.
  It returns a **value** and performs **no effect**. Registered, resolved, PEP-gated
  (purpose `notification`/`transactional`/`commercial`; permission `notify:plan`), audited.
- **The effect stays app-local**, behind the existing dormant senders. **All 11 call sites
  are unchanged. No route flipped. `MAIL_LIVE` stays OFF.**

## 3. Why the effect-port is NOT built (evidence, per "evidence earns architecture")
1. **No real second consumer.** The unified `NotificationProvider` port would have exactly one
   prospective consumer — GTG Quant — which is a **separate application built on GIOS, not an
   in-repo consumer of this kernel.** By the charter's own definition that is a *speculative
   service*. The DECISION clears "needs-it-twice" outright (11 sites); the EFFECT-PORT does not.
2. **Its headline guarantee is unbacked today.** Kernel idempotency is an in-process `Set`
   (`inMemoryIdempotency`); on Vercel every invocation is a cold process, so it dedupes
   **nothing** across the at-least-once redelivery boundary it claims to guard. Minting the
   first effect-port on infra that does not exist would ship a promise the kernel cannot keep —
   strictly worse than today's honest fail-safe fire-and-forget.
3. **A single port is a false abstraction.** Email (one address string, known at plan-time) and
   push (a `userId` → N DB-read endpoints, fanned out, with mid-flight dead-sub `DELETE`) share
   no honest provider contract. Everything they *do* share (fail-safe, dormant, audited,
   permissioned) is a **kernel-mechanism** property that already lives in `dispatch`/`pep.ts`.
   The eventual shape is **per-channel** ports (`EmailProvider`, `PushProvider`), never one.

## 4. Two latent kernel defects — MUST fix before any effect crosses `dispatch`
Harmless today (dispatch only hosts pure capabilities), fatal the moment an effect rides it:
- **D-07 — mark-on-failure + synthetic replay.** `dispatch` marks the idempotency key
  unconditionally after `execute`, even on `ok:false` (`kernel.ts:96`), and replay returns a
  synthetic `ok:true` (`kernel.ts:89–92`). For a side effect this converts a transient send
  failure into **permanent silent non-delivery reported as success** (auth-critical for
  password reset). Effect semantics require a durable **three-state** ledger
  (`PENDING`→`COMMITTED` on ack→`FAILED` on definitive failure; leave `PENDING` on ambiguous
  timeout), mark-on-success-only, and replay-returns-**original**-receipt.
- **D-08 — payload-blind PEP.** `authorize()` never sees `input` (`pep.ts:10`), so the
  **recipient (`to`) is authorized by nobody.** Before an effect ships, the mechanism must add
  a recipient-ownership guard (resolve the address from tenant-owned data; DENY any `to`/userId
  outside `actor.tenantId`) and tenant-scope the idempotency namespace.

## 5. Preconditions for promoting the effect to the kernel (all required)
1. A **durable Postgres `IdempotencyStore`** (three-state), crash/timeout/redelivery-tested —
   the same class of infra as **#11 Durable Audit**, so the effect-port cannot precede #11.
2. **Retries + crash recovery + replay tests** proven under injected cold-start/redelivery.
3. **Hash-only audit receipts** (content-hash + recipient-hash + key + purpose + channel;
   never raw body/subject/recipient — `AuditSink` is append-only, so PII would be un-deletable).
4. A **real in-repo second consumer** that forces the port shape (per-channel).
5. A **NotificationCompliancePDP** registered and mandatory for any credit-content send, and a
   **CCO approval gate** before any user-facing credit communication path is enabled.
6. Only then: build per-channel ports, keep `MAIL_LIVE` OFF until 1–5 pass, flip routes behind
   a flag with the old path as fallback.

## 6. Consequences
- **Positive:** #10 adds real platform value (every GIOS app inherits deterministic keying +
  purpose classification + CAN-SPAM policy + hash-only digests) with **zero new kernel surface**
  and **zero behavior change** before the Sprint-3 ABI freeze. The three-runtime boundary
  (Intelligence/Governance decide; Execution alone has effects) is held by construction.
- **Negative / deferred:** no notification is yet *sent* through GIOS — by design. The
  exactly-once *claim* is de-scoped from #10 (there is no retry path today, so it would be
  vacuous). Tracked as debt **D-07/D-08** (kernel defects) and **D-03/#11** (durable store).
- **Rejected alternatives:** (a) wrap the sender behind a single kernel effect-port now —
  rejected (speculative, unbacked guarantee, false abstraction); (b) fold physical mail into
  #10 — rejected (separate, stronger pipeline; would rewrite working code); (c) keep the
  decision app-local too — rejected (the DECISION clears the twice-bar with real evidence and
  benefits every future application).
