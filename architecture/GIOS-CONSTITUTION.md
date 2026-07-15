# GIOS Constitution — the engineering constitution of the operating system

Status: **CANONICAL.** The apex of GIOS engineering principle. Terse by design: each axiom
points to the document that *enforces* it — this file is the index of law, not a second copy
of it (per "never a second source of truth", repo `CLAUDE.md`). **Any agent — human or AI —
must read and satisfy this constitution before writing kernel code.**

> GIOS is a **deterministic operating system for intelligence**. Applications *inherit*
> intelligence; they do not re-implement it. CreditVector is Application #1 — the proof, not
> the destination. The kernel is **product-agnostic**: it must onboard a completely different
> application (GTG Quant, Gabriel AI OS, an Investigation Engine) **without a kernel change.**

## The three-runtime model (ADR-0023, ratified 2026-07-15)
1. **Intelligence** — Observe · Remember · Reason · Plan · Predict · Simulate. Deterministic,
   replayable, pure.
2. **Governance** — Policy · Approval · Risk · Security · Permission · Capability · Audit ·
   Decision. Deterministic. **Nothing executes.**
3. **Execution** — email, browser, filesystem, trading, DB, physical mail, MCP, external APIs.
   The only layer with side effects. Every execution requires **permission · audit · receipt ·
   idempotency · rollback-where-possible · replaceable provider.**

**Intelligence never executes directly. Everything passes through Governance.** (Enforced by the
PEP, `lib/os/kernel/pep.ts`, and the effect-boundary rule, ADR-0027.)

## The axioms
1. **Evidence earns architecture.** No abstraction ships without the evidence that demanded it.
   *(Enforced by [CAPABILITY-PROMOTION.md](CAPABILITY-PROMOTION.md).)*
2. **No speculative abstractions.** If a capability can be removed without affecting correctness,
   it is premature. *(ADR-0027 §3; the effect-port deferral is the reference case.)*
3. **Wrap, never rewrite.** Working modules are untouched IP; kernel capabilities delegate to
   them. *(ADR-0022; every Sprint-2 migration.)*
4. **Every migration is additive, reversible, byte-identical, deterministic.** Build the kernel
   path, prove it equals production, keep both paths alive, flip only behind a flag.
   *(Enforced by the guard suites + [ENGINEERING-REVIEW-PIPELINE.md](ENGINEERING-REVIEW-PIPELINE.md).)*
5. **The kernel stays deterministic.** No `Date.now()`, no randomness, no I/O in the core; time
   and version come only from the Clock/Version Authority. *(ADR-0024; `lib/os/kernel/clock.ts`.)*
6. **Execution is permissioned. Default deny.** A call is denied unless available + entitled +
   every required permission held + purpose permissible + every PDP allows. *(ADR-0026; `pep.ts`.)*
7. **Effects remain application-local until earned.** A side effect enters the kernel only when
   its provider-port has ≥2 real in-repo consumers **and** the durable infrastructure that makes
   its guarantees true exists. *(ADR-0027; [CAPABILITY-PROMOTION.md](CAPABILITY-PROMOTION.md).)*
8. **Reasoning is separate from execution.** A capability that *decides* (Layer 1/2) and one that
   *acts* (Layer 3) are different capabilities with different promotion bars. *(ADR-0027 —
   `notify.plan` decision shipped; the send did not.)*
9. **Providers are replaceable.** Every effect names an injected provider port; the kernel never
   binds a concrete vendor. *(`lib/mail/MailProvider.ts` is the in-repo reference.)*
10. **Prefer composition over inheritance; manifests over prompts; receipts over claims.** Small
    deterministic primitives beat one large prompt. *(ADR-0024/0025.)*
11. **Architecture is reviewed before implementation.** Any change to kernel behavior runs the
    full review pipeline *before* code. *(Mandatory — [ENGINEERING-REVIEW-PIPELINE.md](ENGINEERING-REVIEW-PIPELINE.md).)*
12. **Applications consume the kernel; the kernel does not consume applications.** No kernel file
    imports an application module. The dependency arrow points one way, always.
13. **Tenant isolation is the #1 invariant.** Every context is bound to `actor.tenantId`; a
    cross-tenant read is denied and audited. *(ADR-0025; `kernel.ts` `memoryRead`.)*
14. **Don't break userspace.** Once frozen (Sprint 3), the ABI is a contract; capabilities evolve
    by version (`@major`), never by silent break. *(ADR-0024/0026.)*
15. **No architectural shortcuts. Optimize for the next decade, not the next sprint.**

## What this constitution governs vs. what enforces it
| Concern | Enforcing document |
|---|---|
| Kernel mechanism + ports + namespace | ADR-0024 (Kai Kernel), `lib/os/kernel/` |
| The kernel↔plugin covenant (mechanism vs policy) | ADR-0025 (Kai Kernel Covenant) |
| The rules of the plugin ecosystem (signing, versioning, trust) | ADR-0026 (Plugin Constitution) |
| Decision-vs-effect + effect-port deferral | ADR-0027 |
| When a capability may enter the kernel | [CAPABILITY-PROMOTION.md](CAPABILITY-PROMOTION.md) |
| The mandatory build lifecycle | [ENGINEERING-REVIEW-PIPELINE.md](ENGINEERING-REVIEW-PIPELINE.md) |
| The live inventory of every subsystem | [GIOS-KERNEL-CAPABILITY-MAP.md](GIOS-KERNEL-CAPABILITY-MAP.md) |
| Repo truth-labels, reuse-first, small reversible changes | `.ai/CONSTITUTION.md` |

## The prime directive for any future contributor (human or AI)
Before writing kernel code: (1) read this constitution and the four documents it indexes;
(2) confirm your change is **evidence-earned, additive, deterministic, and reviewed**; (3) if it
touches kernel behavior, run the pipeline and get an ADR **first**. **When in doubt, protect the
architecture — leave the capability in the application.** The burden of proof is on the abstraction.
