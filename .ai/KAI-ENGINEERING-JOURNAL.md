# Kai Engineering Journal

> Institutional memory. For every major implementation decision: **why**, **alternatives**,
> **tradeoffs**, **performance**, **security**, **future migration path**. So future
> contributors understand not just *what* was built but *why*. Newest entries on top.

---

## 2026-07-15 — Sprint 1: the hardened Kai Kernel (`lib/os/kernel/`)
Governed by ADR-0024/0025/0026. Pure, mechanism-only, 33 guards green (`scripts/kernel.test.ts`).

### J1 — The kernel is a pure library + injected ports, not a daemon
- **Why:** we run on Vercel serverless — stateless, per-request, no resident process (Red Team R1/E2). A "kernel daemon" doesn't exist here.
- **Alternatives:** a long-lived service (rejected: not our runtime, adds ops + a scaling unit) · framework-in-process (chosen).
- **Tradeoffs:** no in-memory cross-request state → durable concerns become ports (Audit/Event/Memory/Clock are `interface`s the host injects). More indirection, but testable and runtime-agnostic.
- **Perf:** zero per-call infra in the pure core; the host controls where ports hit the DB (single-load, J4).
- **Security:** the kernel has no ambient authority; all effects go through injected, auditable ports.
- **Migration:** Sprint 2 supplies durable adapters (Postgres append-only audit/event log, the Kai Memory Graph over `lib/knowledge`) implementing the same port shapes (`lib/os/kernel/adapters.ts` is the reference).

### J2 — Hexagonal (ports & adapters); mechanism vs policy
- **Why:** the Covenant — kernel owns mechanism, plugins own policy. Ports isolate infra; PDPs make compliance/entitlement *pluggable* so regulations change without touching the kernel.
- **Alternatives:** kernel owns compliance rules / graph schema (rejected: every reg change edits the kernel → not decade-stable).
- **Security/Migration:** rules evolve as plugins; the kernel's ABI stays stable ("don't break userspace," Covenant #14).

### J3 — Clock / Version Authority (primitive #9); no `Date.now()` in the kernel
- **Why:** a single monotonic source of version + logical time = causality, audit integrity, reproducibility, and our determinism rule (no plugin mints time).
- **Alternatives:** in-process counter (rejected: concurrent serverless invocations collide, Red Team E2) · per-record `Date.now()` (rejected: non-deterministic, unorderable).
- **Perf/Migration:** in-memory reference now; **prod adapter = a DB sequence + wall clock** (a monotonic source across concurrent invocations). Records are bitemporal (valid-time + tx-time + version).

### J4 — Single-load `OsContext`; the PEP runs over preloaded state
- **Why:** Red Team R3 — a PEP that hits the DB per node/call is a latency + Accelerate-cost bomb. The context (actor + entitlements + flags) is built **once per request**; `resolve()`/`authorize()` are pure in-memory computations.
- **Tradeoffs:** the host must preload the `EntitlementSnapshot`; mid-flow entitlement changes aren't seen until the next request (acceptable, and safer).

### J5 — Tenant isolation is the #1 tested invariant
- **Why:** the kernel is the single trust root (R6); one missed scope = cross-tenant leak.
- **How:** every `OsContext` is bound to `actor.tenantId`; `memoryRead` returns `null` + audits a denial on any cross-tenant access; property-tested (Alice can't read Bob's node).
- **Security/Migration:** the durable Memory adapter must enforce the same at the query layer (tenant-scoped reads), not rely on post-filtering.

### J6 — Default-deny PEP; permissible-purpose enforced
- **Why:** zero-trust + capability-based security (ADR-0026). A call is denied unless available + entitled + all required permissions held + the declared purpose is permissible + every PDP allows (a single "deny" vetoes — the Compliance Officer can always stop a call).
- **Migration:** the FCRA/GLBA purpose model is counsel-designed (R5); the graph stays FCRA-scoped until then. The mechanism (purpose token checked against a capability's permissible purposes) is in place now.

### J7 — Idempotent dispatch (no double execution)
- **Why:** at-least-once world (E2) — retries/redelivery must not double-charge or double-send. Same discipline we already use for Stripe/mail webhooks.
- **How:** `dispatch(..., idempotencyKey)` short-circuits a repeat without re-executing; events dedupe by id. In-memory store now; **prod adapter = a durable idempotency store**. Tested: a repeated op runs the module exactly once.

### J8 — Append-only audit
- **Why:** Covenant #7 — every kernel-mediated action is immutable and provenance-carrying; audit integrity must be beyond a plugin's reach.
- **How:** the `AuditSink` port exposes `append` only (no update/delete); entries are clock-stamped and monotonic. Tested.

### J9 — Capability namespace `domain.entity.action[@major]`
- **Why:** a stable, versionable, routable syscall table (ADR-0024). Domain-owned by exactly one module (fail-closed on collision → no squatting).
- **Migration:** third-party namespaces will be publisher-scoped (`com.acme.*`, ADR-0026 §2); the grammar already supports it.

### ABI status
**NOT frozen.** Per the ratified plan, the Module Contract + ports are frozen only after CreditVector is migrated as Plugin #1 (Sprint 3) and has exercised them. Until then, the contract may change freely.
