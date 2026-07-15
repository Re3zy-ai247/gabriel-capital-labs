# ADR-0025: The Kai Kernel Covenant

Status: **Accepted — part of the Constitution** (founder-directed). Not a technical spec —
the permanent philosophy that governs Kai OS forever. The *how* lives in ADR-0022/0023/0024;
this is the *law* they must never violate.
Date: 2026-07-15
Decision owners: Founder

> A covenant is a promise the system makes to everyone who will ever build on it. These are
> not guidelines. They are the invariants. If a change requires breaking one, the change is
> wrong — not the covenant. Amend only by explicit founder decision recorded here.

## The Covenant

1. **The Kernel owns mechanisms, never business logic.** It knows Identity, Dispatch,
   Registry, Namespace Resolution, the Policy Enforcement Point, the Memory Interface, the
   Event Bus, Audit, Capability Resolution, and the Clock/Version authority — and *nothing*
   about credit, mortgage, funding, wealth, tax, legal, or health. Domain knowledge lives
   only in plugins.
2. **Every capability is external.** The Kernel exposes no domain capability of its own.
3. **Every module is optional, and every module is replaceable.** Any plugin — including
   Credit — can be removed, rewritten, or swapped without changing the Kernel.
4. **Every capability is registered.** Nothing enters the OS except through the Plugin
   Registry. There is no other door.
5. **Every policy is pluggable.** Compliance rules, entitlements, and the capability catalog
   are decision-providers the Kernel *consults*, never logic it *contains*.
6. **Every request is deterministic first.** Deterministic engines answer before any model
   runs. AI is always the last layer, never the first. Reasoning is earned, not assumed.
7. **Every action is auditable.** Every Kernel-mediated action writes an immutable,
   time-stamped, provenance-carrying record that no plugin can alter.
8. **Every decision is explainable.** No recommendation without its receipt — the evidence,
   the rule, the confidence, the uncertainty. No black boxes reach the user.
9. **Every plugin can disappear without changing the Kernel.** Coupling to the Kernel is
   allowed; coupling *through* the Kernel between plugins is a governed, versioned contract —
   never a shared internal.
10. **Nothing is only "current."** State is a succession of immutable values in time; history
    is never overwritten (the Clock/Version authority + append-only substrate).
11. **The user is sovereign.** The user owns their data; Kai recommends, the user approves,
    the system executes; consent is explicit and revocable; no invisible autonomous action.
12. **Compliance is a Kernel invariant, not a feature.** Nothing reaches a user without
    passing the Policy Enforcement Point. Compliance beats growth, always.
13. **The Kernel remains stable while the ecosystem evolves.** We optimize for a platform
    that still makes sense in twenty years: elegant over clever, simple over complex,
    mechanisms over policies, kernel over modules, platform over application, longevity over
    speed.

## Standing
This Covenant is incorporated into `CREDITVECTOR-OS.md` (the Constitution) as the governing
law of Part II. Where any ADR, module, or line of code conflicts with the Covenant, the
Covenant wins and the code is corrected. It binds every engineer, AI agent, and Claude
session, forever, until a founder amendment is recorded here.
