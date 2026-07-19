# ADR-0032: Platform layering — Kai is the intelligence kernel; Agency Command is one orchestration layer

Status: **PROPOSED (2026-07-18 — architecture only; not implemented, not merged).**
Date: 2026-07-18
Decision owners: Founder directive (hierarchy inversion) · Chief Architect (reconciliation)
Scope: **Documentation only.** No code, UI, DB, billing, or protected-flag change. This ADR is thin by
design: it records ONE structural law — the canonical layering — and **defers**, never duplicates, to the
docs that already own each concept.

---

## 1. Context — this already exists (reconcile, do not build)

The founder's hierarchy (Kai → Agency Command → Mission Control → modules) is **already the platform's
canonical intent**, expressed in fragments:

| Where | What it already says |
|---|---|
| `KAI-OS.md` | Kai is "one coherent intelligence across **every surface**," ranked in the authority hierarchy **above product ADRs**. |
| `CVIOS.md` | Kai is a platform-level **Master Agent**, a separate box from Consumer OS / Agency OS. |
| `VISION.md` | "Kai grows to **master agent across the whole platform**." |
| `lib/intelligence/`, `lib/os/kernel/` | the actual deterministic intelligence runtime (GIOS Plugin #1 shape). |

The **only** misaligned fragment was `AGENCY-COMMAND.md`, which listed "Kai Executive Brief" as a *module
inside* Agency Command — framing Kai as a component **of** the agency layer rather than the kernel **above**
it. This ADR corrects that one framing and makes the layering canonical.

## 2. Decision — the canonical layering

```
        ┌──────────────────────────────────────────────────────────┐
        │  KAI — INTELLIGENCE KERNEL  (platform-wide)               │  governed by KAI-OS.md
        │  reads every subsystem's deterministic truth → executive │  (identity/authority: not restated here)
        │  reads, risk, priorities, routing, recommendations.      │
        │  NOT owned by any application layer.                     │
        └───────────────┬──────────────────────────────────────────┘
                        │ orchestrates (one of several surfaces; Consumer OS is another)
        ┌───────────────▼──────────────────────────────────────────┐
        │  AGENCY COMMAND™ — AGENCY ORCHESTRATION LAYER            │
        │  owns ORCHESTRATION: queues · routing · assignment ·     │
        │  priority · deadlines. Owns NO data/CRM/storage/billing. │
        └───────────────┬──────────────────────────────────────────┘
                        │ contains
        ┌───────────────▼──────────────────────────────────────────┐
        │  MISSION CONTROL — one operational MODULE (state roll-up)│  NOT the homepage, NOT the OS
        └───────────────┬──────────────────────────────────────────┘
                        │ alongside
   Client Pipeline · Campaign Q · Response Q · Mail Q · Task Q · Priority Q ·
   Deadlines · Automation · Business Intelligence
        ┌──────────────────────────────────────────────────────────┐
        │  RECORD (clients·letters·campaigns·responses·team·fields) │
        │  FOUNDATION (entitlements·encryption·rate-limit·compliance│
        │  scrub·events·tokens)  — the shared spine (Constitution VII)│
        └──────────────────────────────────────────────────────────┘
```

**Binding laws:**
1. **Kai is the kernel, not a module.** Kai belongs to the platform (KAI-OS.md). Agency Command is one of
   Kai's surfaces; the Executive Morning Brief is Kai's read *rendered in* Agency Command, not a thing Agency
   Command owns. Kai reads across the whole platform — Consumer OS and Agency Command alike.
2. **Agency Command owns orchestration, not data.** Data/CRM/storage/billing live in Record + Foundation.
   Agency Command coordinates work (queues/routing/assignment/priority); it stores nothing of its own.
3. **Mission Control is one module.** A state roll-up subsystem inside Agency Command — never the OS, never the
   first screen. The first screen is the Executive Morning Brief (Kai's output).
4. **Everything plugs in; nothing bypasses.** Modules interact through the **event stream + queues**, mediated
   by Agency Command; Kai reads them all. No module reads another module's surface; no agency feature ships as
   a standalone dashboard.
5. **Numbers are deterministic; the LLM only writes prose.** Every executive figure (health, risk, priorities,
   capacity, growth) is deterministic + auditable. Kai's LLM writes the narrative wrapper only (ADR-0006
   gated, untrusted-fenced).

## 3. Naming consolidation (canonical)
Three names have meant one thing. Ratify:
- **"Agency Command™"** — the canonical product/brand name of the agency orchestration layer.
- **"Agency OS"** — retained ONLY as the internal architecture term (the CVIOS subsystem). Synonym, not a
  second product.
- **"Agency Command Center"** — **DEPRECATED**; folds into Agency Command. `CX-REVIEW.md §4` and `ROADMAP-V2`
  CX-5a link to Agency Command; the concept has one home (`AGENCY-COMMAND.md`).

## 4. Kai as Chief of Staff (role elevation, not a new Kai)
Kai's KAI-OS-defined intelligence, applied at the **business-operations** level: read every subsystem, detect
operational risk, produce the executive brief, coordinate priorities, route work, surface bottlenecks,
recommend actions, monitor agency health. This is an elevation of the same intelligence (KAI-OS owns the
behavioral contract) from per-consumer-case guidance to per-business operations — **not a chatbot, not a
second Kai.** The agency-operations manifestation is specified in `AGENCY-COMMAND.md §Executive Morning Brief`
and `§Agency Health Score`.

## 5. Future-product extensibility (no rewrites)
The pattern generalizes: **Kai kernel → orchestration layer → modules**. Agency Command is the *first*
business orchestration layer. Future products plug into the same spine with no rewrite:
- **Funding Hub / Business Credit OS** — new orchestration layers (or modules) under the same kernel; consume
  `lib/intelligence` + Foundation, never re-derive intelligence.
- **Marketplace / White Label / Enterprise** — distribution/packaging concerns layered on the spine
  (entitlements + branding + API), not new intelligence.
This is the **GIOS alignment**: Kai is the intelligence runtime (kernel); CreditVector's verticals are
applications on top — CreditVector is Plugin #1. Same shape end to end.

## 6. Governance
This ADR is the **layering constitution** for platform products. It is subordinate to `CREDITVECTOR-OS.md`
(company) and `KAI-OS.md` (Kai's behavior); it governs the *structure* only. `ADR-0031` (Agency packaging) and
`AGENCY-COMMAND.md` (agency structure) are subordinate detail. Future agency/product ADRs must conform to the
layering here. Amend only with founder approval + a superseding ADR.

## 7. Protected state
No merge/deploy/push; no billing or entitlement change; no protected flag; no production data. Documentation
only; each implementation slice remains founder-gated (first slice unchanged: ADR-0031 §4 capacity resolver).
