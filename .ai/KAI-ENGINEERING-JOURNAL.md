# Kai Engineering Journal

> Institutional memory. For every major implementation decision: **why**, **alternatives**,
> **tradeoffs**, **performance**, **security**, **future migration path**. So future
> contributors understand not just *what* was built but *why*. Newest entries on top.

---

## 2026-07-15 — Sprint 2 (Increment 1): CreditVector becomes Plugin #1
Migration items #1–#5 (Identity · Capability Resolution · Registry · Dispute/Letter engine).
`lib/os/host/` + `lib/os/modules/credit/`; 9 guards green (`scripts/credit-plugin.test.ts`),
including **byte-identical** equivalence. **No live route rewired yet — additive + proven first.**

### M1 — Wrap, never rewrite (proven byte-identical)
- **Why:** the dispute engine is valuable IP and is battle-tested in prod; the Covenant + the ratified plan say wrap it.
- **How:** `creditModule().execute()` for `credit.letter.draft` **delegates** to the unchanged `buildContext` + `renderTemplateLetter` (`lib/letter`). A guard asserts the kernel-routed output **=== the direct engine output, byte for byte.**
- **Migration:** subsequent capabilities (dispute/response/investigation/…) wrap their existing engines the same way; each proven equivalent before any route flips.

### M2 — Additive migration; routes flip only after per-capability equivalence
- **Why:** "zero regression" — the safest path is to build the kernel path, **prove it equals prod**, then switch the route (behind a flag, with the old path as fallback). Increment 1 does NOT touch live routes; it establishes the path + the proof.
- **Tradeoff:** temporary duplication (both paths exist) until a capability's route flips. Worth it for zero-risk migration.

### M3 — Actor tenant mapping
- `actorFromSession(user, dataOwnerId?)`: `tenantId` = the data-owning scope — a consumer's own id, or an agency-worked client's id (the same id existing queries scope by). Trust = first_party. **Open item:** the agency "acting as client" path passes `dataOwnerId` explicitly; wire that when the agency flows migrate.

### M4 — The plan→capability map is the Capability Engine, grown incrementally
- `entitlementSnapshot()` is the ADR-0022 Capability Engine realized — built once per request (single-load). Increment 1 declares one capability; it grows as subsystems migrate. The **free-letter monthly limit** stays a downstream policy for now and will migrate to a **PEP policy provider** (nice example of policy-as-plugin) in a later increment.

### M5 — Idempotency is for outward/mutating capabilities, not pure drafts
- `credit.letter.draft` is pure/repeatable → dispatched **without** an idempotency key (a replay stub would be wrong for a pure read). Idempotency keys attach to mutating capabilities (`…send`, `…mail`, `…charge`). The kernel mechanism is tested in `kernel.test.ts`.

### M6 — In-memory adapters now; durable Audit/Memory are subsystems #11/#12
- Per R8 (don't build persistence infra early), Increment 1 uses the reference in-memory Audit/Event/Memory adapters. The **durable Postgres append-only audit + monotonic version (DB sequence) + the Kai Memory Graph** land when migration reaches #11/#12 — same port shapes, no kernel change.

### M7 — Increment 2 (Response Intelligence): the first implementation-driven ABI refinement
- **What implementation exposed:** `credit.response.analyze` wraps `lib/round2.analyzeResponse`, which is **async** (it awaits the AI provider). The Module Contract's `execute` was synchronous — it couldn't host a retrieval/generative capability.
- **Was it an architecture flaw?** No — it's the **expected ABI evolution** the reference implementation exists to surface (which is exactly why we don't freeze the ABI until Sprint 3). The kernel, plugin model, and Covenant are unchanged.
- **Minimum correction:** `execute(): ModuleResult | Promise<ModuleResult>`; `dispatch` is now `async` and awaits it. Deterministic capabilities stay sync; generative ones are async — one uniform path.
- **Migration:** `credit.response.analyze` is gated to premium (AI tools are a paid feature) via the entitlement snapshot — a real use of Capability Resolution. Equivalence proven by delegation (both paths agree; no live AI key needed, no fabrication).

### M8 — Increment 3: Marketplace metadata + durable-audit design + Investigation/§605 (#7)
- **Platform infra (reduces Plugin #2 effort):** `CapabilitySpec` is now self-describing — description, version, owner, plugin, premium, experimental, securityClass, input/output schema, compliance. `Kernel.manifest()` returns the catalog (the Marketplace seed + "capability usage" observability). This is reusable *platform* infrastructure, not credit-specific — any future plugin's capabilities are discoverable/priced/versioned the same way.
- **Durable-audit design (per the directive — design now, Postgres at #11):** `AuditEntry` gained `pluginId`, `correlationId`, and an optional `latencyMs` (**undefined until the perf harness exists — never fabricated**, D-02). Dispatch stamps every record with a correlation id + plugin id. The append-only mechanism is unchanged; only the shape is richer.
- **Migration #7 — Investigation/§605:** `credit.obsolescence.window` wraps `lib/obsolescence.obsolescenceWindowYears` (deterministic) — **byte-identical**, available to all (deterministic → free). Exercised the new self-describing spec end-to-end.

### Architecture-flaw watch
Increment 1: none. Increment 2: one ABI refinement (async `execute`). Increment 3: the Marketplace metadata + audit-shape are **additive** enrichments (the ABI is unfrozen) — no redesign, no rewrite, existing engines untouched. Post-migration red team: capabilities are now reusable platform infra (✓ the founder's test — another plugin can consume the manifest/kernel unchanged). The architecture is not wrong; we continue.

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
