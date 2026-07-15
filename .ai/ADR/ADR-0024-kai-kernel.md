# ADR-0024: The Kai Kernel — the immutable microkernel of Kai OS

Status: **PROPOSED — for founder review before implementation** (challenge invited).
Refines ADR-0022/0023 (does not replace them).
Date: 2026-07-15
Decision owners: Founder directive ("What is the Kai Kernel?")

## Context
The founder asked the right question: *is the Capability Engine the core?* **No.** Think
higher — what is the **kernel**: the small, immutable center that stays stable for a decade
while everything around it (modules, policies, UI, even the capability catalog) is
replaceable? This ADR designs that microkernel — and challenges the assumption that the
kernel should *own* ten subsystems.

## The one principle that shapes everything: **mechanism, not policy**
A microkernel earns its longevity by owning **mechanism** and delegating **policy**. If the
kernel owns the compliance *rules*, the knowledge-graph *schema*, or the capability
*catalog*, then every regulation change, every new node type, every new module edits the
kernel — and the kernel is no longer stable. So the kernel owns the **enforcement points,
the dispatch, the registry, and the contracts**; the *rules and content that flow through
them are plugins.* This is the key refinement to the proposed 10-item list: several of those
items are **policy the kernel enforces, not logic the kernel contains.**

## Decision — the Kai Kernel primitives (8, all mechanism)
1. **Identity & Actor** — resolves the security principal for every call (user, agent,
   officer, system), scoping and tenant-isolating everything downstream.
2. **Plugin Registry** — the only way anything enters the OS. Modules, officers, capability
   providers, policy/compliance decision-providers, and graph-contributors **register**
   here (their namespace, handlers, entitlements, compliance boundary, node/edge types).
3. **Capability Resolution + the Namespace** — the kernel owns the `resolve()` *mechanism*
   and the *namespace grammar*; the capability *catalog* is supplied by registered
   providers. `Kai.resolve(actor, "credit.dispute.create")` → `available | coming_soon |
   not_entitled | not_permitted | unavailable`.
4. **Policy Enforcement Point (PEP)** — **every** capability invocation traps through this
   gate (like a syscall). The PEP consults registered **Policy + Compliance Decision
   Providers** (PDPs) — the *rules* live in those plugins (they change constantly: new
   regs), the *gate* lives in the kernel (never changes). Compliance is thus unavoidable
   and pluggable. This is where the per-module regime boundaries (Article 22) are enforced.
5. **Dispatch** — routes an *authorized* capability call to its registered handler. The
   kernel decides *where to deliver*; the **Intelligence Layer (ADR-0023) decides *what to
   invoke*** and is a kernel **client**, not part of the kernel.
6. **Memory Interface** — a stable read/write/subscribe interface to the shared graph
   (below). The kernel owns the *interface*; the graph's *content/schema* is contributed by
   plugins. Every graph access passes the PEP (purpose/consent enforced).
7. **Event Bus** — publish/subscribe. `report.uploaded` → the Opportunity Engine reacts;
   modules never call each other directly. Decouples everything.
8. **Audit** — every kernel-mediated action writes an immutable, provenance-carrying record
   (who, what capability, what evidence, what confidence, what decision).

### Explicitly OUTSIDE the kernel (all replaceable)
Every module/plugin **including Credit**; the **Intelligence Layer** (a client); the
**Capability catalog / entitlement policy / plan map** (registered providers — so pricing
changes never touch the kernel); **compliance rules** (PDP plugins); the **Knowledge-Graph
schema/content** (contributed types); UI, pricing, everything. → *The Capability Engine
becomes a kernel-registered resolver service, not "the core."*

## The universal capability namespace
Grammar: **`<domain>.<entity>.<action>`**, lowercase, dot-delimited, versionable.
```
credit.dispute.create        funding.sba.qualify        mortgage.preapproval.check
credit.response.analyze      business.tradeline.recommend    identity.freeze.initiate
```
- A module registers its **domain prefix** (`credit.*`) once; the kernel routes resolution
  and dispatch to that provider. Reserved actions carry consistent semantics
  (`.create/.analyze/.recommend/.explain/.qualify/.check`). Actions may version
  (`credit.dispute.create@2`) so contracts evolve without breaking callers.
- **No-bypass guarantee:** the *only* way to invoke anything is `Kai.resolve` + kernel
  dispatch. Modules receive their `OsContext` from the kernel and cannot reach the DB,
  another module, or the graph except through kernel interfaces (which trap the PEP). This
  is the syscall model — it's what makes "no module bypasses the kernel" **structural**,
  not a guideline.

## The Life Graph (KaiDNA) — my recommendation, with three hard constraints
**Yes** to a single, persistent, shared graph as the memory substrate — it's the correct OS
design and we already have its deterministic seed (`lib/knowledge`). Isolated per-module
data would forfeit the compounding cross-module intelligence that is the whole point (a
collection resolved in Credit informing Funding readiness). It lives **behind the kernel
Memory Interface** (primitive 6), so every module touches it only through the kernel.
**But I am challenging three things before we commit:**

1. **Regime-tagging + permissible-purpose is non-negotiable.** One graph spanning credit
   (FCRA), funding/mortgage (GLBA/RESPA), and future wealth data is a compliance minefield:
   FCRA restricts *permissible purpose* for credit-report data — using it to drive, say, a
   wealth or marketing recommendation could violate the FCRA. So the graph is **not an
   undifferentiated blob**: every node/edge is **regime-tagged + consent-tagged**, and the
   **PEP enforces purpose-of-use at read time** (a `wealth.*` capability cannot read
   FCRA-purpose-locked nodes without a lawful basis). This is the single most important
   constraint and it belongs in the kernel, not a module.
2. **Scope it — data minimization, not surveillance. I'd challenge the "Life Graph" name.**
   "Life Graph / KaiDNA" implies modeling the user's whole life; that's scope creep, a huge
   privacy surface, and a brand/trust risk for a *credit intelligence* OS. Recommend the
   internal name **Kai Memory Graph** (or "Financial Intelligence Graph"), bounded to the
   financial/credit domains the user has consented to. Hold only what a module needs
   (Article 21). Keep "KaiDNA" as an aspirational north star, not the data model's mandate.
3. **Preserve determinism + the fact/inference split.** The current graph's power is that
   it's *deterministic* — recomputed from immutable rows, zero fabricated edges. A
   persistent graph that accretes AI-*inferred* edges risks drifting into ungrounded
   "facts." Rule: **deterministic edges (from records) and inferred edges (from reasoning)
   are stored distinctly and never blended** (KAI-OS §3); inferred content is
   provenance-tagged and never presented as fact. Persistence applies to deterministic +
   consented data first.

## Consequences & refined build order
1. **Kernel first** (`lib/os/kernel/`): Identity · Registry · Resolve+Namespace · PEP ·
   Dispatch · Memory Interface · Event Bus · Audit — thin, mechanism-only, heavily tested.
2. **Register the first providers:** the capability catalog + plan map (ADR-0022 becomes a
   *provider*), the compliance PDP, the Kai Memory Graph behind the Memory Interface.
3. **Retrofit Credit as the first plugin** — wrap the existing engines; **zero behavior
   change**, guard-verified; it now speaks only through the kernel.
4. Then the Intelligence Layer (ADR-0023) as a kernel client; then new modules.
Everything under the 7-gate DoD (Article 23). Wrap, don't rewrite. Preview-first.

## What I challenged (so the record is honest)
- **"Capability Engine is the core"** → refined to a kernel-registered *service*; the core
  is the mechanism spine.
- **"Kernel owns Compliance / Knowledge Graph"** → kernel owns the *gate* and the
  *interface*; rules and schema are plugins (mechanism-vs-policy).
- **"Life Graph / KaiDNA" as an unbounded whole-life graph** → yes to a shared graph, but
  regime/consent-tagged, scoped to financial intelligence, determinism preserved.

If you want an even smaller kernel, the only two primitives I'd consider *demoting* to
privileged plugins are the Event Bus and Audit — but I recommend keeping them in-kernel
because every module needs them and their trustworthiness must be beyond a plugin's reach.
