# Kai Platform — Founder Journal

> The executive story of Kai. Not an engineering log — the decisions, risks, tradeoffs, and
> lessons, sprint by sprint. Newest on top.

---

## Sprint 2 — CreditVector becomes Plugin #1 (in progress)

**What was accomplished.** We began turning our own product into the first plugin on the Kai
Kernel — the proof that the platform can host an ecosystem. Two capabilities are now wrapped
and routed through the kernel: dispute-letter drafting and response intelligence. The letter
capability is **byte-identical** to today's production output — the kernel changes *how* the
work is invoked, not *what* the user gets.

**The most important lesson.** Implementation, not theory, is now our teacher. Migrating
response intelligence immediately revealed that the plugin contract needed to be **async**
(it calls the AI provider). This is exactly why we deliberately did *not* freeze the contract
yet — the reference implementation is refining it for us. One small, evidence-driven
correction; no grand redesign. This is the discipline working as intended.

**Decisions & tradeoffs.** We're migrating **additively**: build the kernel path, prove it
equals production, *then* flip the live route behind a feature flag with the old path as a
fallback. It costs some temporary duplication, but it buys **zero regression risk** — nothing
in production changes until a capability is proven identical. We also kept our own engines
**untouched** (wrap, never rewrite) — the dispute IP is preserved and validated, not risked.

**Risks that appeared.** Two honest ones: (1) durable audit + a cross-invocation version
source aren't built yet (we're on in-memory references) — planned as subsystems #11/#12; (2)
we have **no performance or coverage instrumentation** — so the dashboard withholds those
numbers rather than invent them. Both are tracked, not hidden.

**Future concern.** As Kai grows modules beyond credit, the "permissible-purpose" enforcement
becomes a genuine legal model, not a code detail. We've scoped the memory graph to FCRA/credit
until counsel designs that model — which removes our single biggest future legal exposure at
no cost today.

**Recommended next actions.** Continue the migration in the planned order (Investigation →
Document → Workflow → Notification), then build the durable Audit + Kai Memory Graph adapters,
then validate and **freeze the ABI** (Sprint 3). Build the perf harness before the first live
route flips, so we measure old-vs-kernel rather than guess.

---

## Sprint 1 — The Kai Kernel

**What was accomplished.** We built the permanent foundation of the platform: a small,
mechanism-only kernel that every future Gabriel product will run on. It knows identity,
capabilities, policy, memory, time, events, and audit — and nothing about any business domain.

**Why it matters.** This is the moment CreditVector stopped being the product and became the
*first application* of something larger. The kernel is designed to be stable for a decade
while the ecosystem around it changes freely.

**Decisions & tradeoffs.** We chose a *library + injected adapters* over a running service —
the honest fit for our serverless runtime. We hardened the design against two adversarial
red-team reviews (including one assuming untrusted third-party developers years out), which
turned several future rewrites into cheap up-front seams (out-of-process plugin boundary,
idempotent distributed invariants, "never break a plugin").

**Lesson.** The best architecture review is the one that tries hardest to destroy the design.
It survived — and the survival, plus the first real migration, is why we've now stopped
designing and started building.

**Recommended next action.** Prove the kernel by migrating CreditVector onto it (Sprint 2).
