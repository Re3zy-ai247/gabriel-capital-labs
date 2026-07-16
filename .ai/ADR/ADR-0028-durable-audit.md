# ADR-0028: Durable Audit (#11) — KernelPorts durability, claim/settle idempotency, hash-only

Status: **ACCEPTED (founder-approved 2026-07-15).** Governs GIOS Migration #11.
Date: 2026-07-15
Decision owners: Founder directive + Chief Architect
Evidence: pre-implementation adversarial review (2 recon + 6 refute-by-default lenses + synthesis,
9 agents, 0 errors) — unanimous **proceed-with-required-changes**. Fixes kernel defect **D-07**.
Depends-on / enables: this is the durable substrate the notification **effect** (ADR-0027) needs.

> The naive framing — "swap the in-memory ports for durable adapters" — is **fatal**. All four
> kernel ports are **synchronous, fire-and-forget `void`**; durability on Prisma Accelerate is
> **intrinsically async**; on Vercel the invocation **freezes after `return`**, so an un-awaited
> async write is **discarded before it lands**. A naive swap makes audit *best-effort-and-lossy*,
> passing warm/local tests while dropping records under the exact cold-start/at-least-once
> conditions #11 exists to survive. This ADR records the reshape that avoids that.

## 1. Decision — KernelPorts-only durability; OsContext stays synchronous
1. **Audit / Event durability via an awaited `flush()`.** The durable adapter's `append()` stays
   **sync** (enqueues to an in-process buffer). The Kernel exposes a **new `async flush()`** that
   the host route **awaits after `dispatch` returns**, before the HTTP response. The in-mem
   adapter's `flush()` is a no-op. **`OsContext.audit/emit` stay synchronous** — no module-ABI
   change before the Sprint-3 freeze. Batch **only within a dispatch**, never across (a
   cross-dispatch queue is lost on freeze).
2. **IdempotencyStore port: `{seen,mark}` → `{claim,settle,lookup}` (3-state).** `claim(key)` is an
   **atomic** `INSERT PENDING … ON CONFLICT DO NOTHING RETURNING` returning `won|pending|committed|failed`.
   `settle(key, committed|failed, hashOnlyReceipt)`. `lookup(key)` returns the stored receipt.
3. **Dispatch = claim-before-effect.** For a keyed dispatch: `claim` **before** `execute`; execute
   only when `won` (the winner sends); `committed` → return the **original** stored receipt (never
   a synthetic `ok:true`); `pending` → return an **INDETERMINATE** result (don't re-execute, don't
   fabricate success); `failed` → reclaimable. `settle(committed)` on `ok`, `settle(failed)` on a
   definitive failure, **leave PENDING on ambiguous timeout** (a reconciler resolves it). **Keyless
   dispatch is unchanged (byte-identical).** This is the **D-07 fix** and lands as a **separable,
   revert-testable change** from the adapter infra.
4. **ClockSource stays synchronous**, backed by **per-request pre-allocated version blocks** (one
   async reservation at `buildContext`, handed out sync) or a **lock-free Postgres SEQUENCE** (not a
   single-row `UPDATE`, which row-locks all tenants). `now()` stays local wall-clock. **Version is
   monotonic-with-gaps, not a contiguous count** — no validator may assume contiguity.
5. **Structural hash-only audit.** The durable AuditSink writes **content-hash + recipient-hash +
   key + purpose + channel + reason-code** only — **never** raw body/subject/recipient. Constrain
   `reason` to codes/scrubbed text (stop piping module-controlled `receipt.summary` verbatim).
   Reconcile immutability with erasure via **crypto-shredding** (per-tenant key; destroy on erasure
   so the hash chain survives over ciphertext — note `docCrypto` is single-key today, the hierarchy
   is net-new). **Tenant-scope reads in SQL** (`WHERE tenantId=$1`); no global `entries()`.
6. **Kernel stays pure.** Durable adapters live in the **host** (`lib/os/host/durable.ts`, imports
   prisma) and implement the kernel port interfaces — the kernel imports no app infra. Tables
   **self-heal** at runtime (`CREATE TABLE IF NOT EXISTS`, ADR-0001) since `db push` no-ops through
   Accelerate.
7. **Feature-flagged + reversible.** `KERNEL_DURABLE` (default **OFF**) selects durable vs in-mem
   adapters in `appKernel`; in-mem is the fallback; **byte-identical at the module boundary**.
   `MAIL_LIVE` stays OFF regardless.

## 2. Reuse, don't rewrite (evidence)
WRAP the `kaiEvents` self-heal pattern for a **separate** `KernelEvent` table (not the live
`KaiEvent` hot table). REUSE `MailAudit.assertAppendOnly`/`validateAuditTrail` semantics — but
**not** MailStore's single-JSONB-row storage (O(n)/append on a global stream); append = one row per
entry keyed by Version, tamper-evidence via a per-row **hash chain**. EXTEND `billing.ts`'s
`INSERT … ON CONFLICT DO NOTHING` idempotency from 2-state to 3-state. COPY the `aiMeter` single-
write + `Date.now` bracket as the cost/instrumentation template. BUILD NEW only the version
SEQUENCE (the one port with no substrate).

## 3. Does it fix D-07? Yes — but only with §1.3 (not the store alone)
A durable store behind the unchanged `seen/mark` still double-sends (TOCTOU: two cold invocations
both read absent, both send). The fix requires **atomic claim-before-effect + settle-on-success +
replay-returns-original + provider-side idempotency** (Resend `Idempotency-Key` =
`NotificationPlan.idempotencyKey`). The true ceiling is **at-least-once + idempotent replay**, not
exactly-once (an external send can't join a Postgres txn). **Shipping the durable store WITHOUT the
claim restructuring is strictly worse than today** — the double-send persists but is falsely
claimed fixed.

## 4. Failure & recovery
Failure modes: freeze-loss (fixed by awaited flush), concurrent double-send (fixed by atomic claim),
settle-write-lost (irreducible → reconciler + provider idempotency), non-monotonic versions (fixed
by a durable sequence), PENDING-leak (fixed by a lease + reaper), key-granularity silent-drop
(callers must use per-event keys). Recovery: a **Cron lease-based reconciler** resolves terminal
PENDINGs and re-drives **only** via provider-side idempotency. Audit backing an effect is
**fail-closed** (a failed durable audit fails the dispatch); the timeline EventLog stays fail-open.

## 5. Promotion criteria (all required before `KERNEL_DURABLE` is enabled in prod)
Durable 3-state store proven under **injected** cold-start/redelivery/crash tests (production can't
prove it — the kernel is off every user path) · freeze-loss test that fails without the awaited
flush · version monotonicity across simulated concurrent instances · structural hash-only enforced
· PII/retention ADR through the **CCO gate** · SQL tenant-scoped reads · `latencyMs` instrumented
(D-02) with a met p95 budget · the D-07 dispatch fix landed + revert-testable · in-mem fallback
byte-identical · **no MemoryStore change (that is #12)**.

## 6. Consequences & scope
- **Positive:** durable append-only audit + a correct 3-state idempotency ledger + a real version
  authority; the D-07 fix; the substrate the effect boundary needs — all **flag-off, dormant, zero
  behavior change** (the kernel has no production caller today).
- **Deferred (YAGNI):** no `OsContext` async ABI change · no cross-dispatch batch queue · no
  MemoryStore change (#12) · no speculative indexes (cap at correlationId + tenantId+version) · no
  exactly-once claim · the **D-08** payload-blind PEP fix (co-required before any effect ships, own
  change) · provider-side idempotency wiring (ships with the effect, ADR-0027).
- **Rejected:** naive adapter-swap (silently lossy) · durable store behind unchanged `seen/mark`
  (D-07 survives) · async OsContext before the freeze (unjustified ABI churn).
