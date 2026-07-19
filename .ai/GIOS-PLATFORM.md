# GIOS — The Platform Constitution (FROZEN v1.0)

> **The one document a new engineer reads to understand the platform in ten minutes.** It **consolidates** the
> decisions in [`ADR-0033`](ADR/ADR-0033-platform-constitution-gios-kai-creditvector.md) (hierarchy),
> [`ADR-0032`](ADR/ADR-0032-platform-layering-kai-kernel.md) (CreditVector layering),
> [`ADR-0031`](ADR/ADR-0031-agency-command-packaging-revenue.md) (packaging) into one frozen spec; it does not
> restate or replace them. **Frozen by [`ADR-0034`](ADR/ADR-0034-gios-platform-freeze.md).** Owns **platform
> STRUCTURE**. Subordinate to `CREDITVECTOR-OS.md` (company principles) and `KAI-OS.md` (Kai behavior); it never
> re-states their content. **Amend only via a superseding ADR + founder approval** (L0–L3 also need CCO for
> compliance). Honesty label: this is the **target** architecture the codebase converges toward — Kai runs
> *inside* CreditVector today (`lib/intelligence/`, `lib/os/kernel/`), no live GIOS coupling (ADR-0033 §1).

## 0. In one minute
**GIOS** is the intelligence runtime. **Kai** is the one intelligence across all products and belongs to GIOS.
**Verticals** (CreditVector is the first) are *plugins* that implement the Platform Contracts and consume the
runtime. **AIOS** is the company governance layer at the **top of the chain** (WHO/WHETHER) — it governs the runtime, it does not execute in it. **Canonical chain: AIOS → GIOS → Kai → CreditVector → Agency Command → Mission Control → modules.** **Every product inherits the same kernel; none re-implements
intelligence, events, entitlements, identity, scheduling, audit, telemetry, or the compliance interface.**

## 1. Immutable layer model (L0–L7)
Dependencies point **down only**. A layer may use the layers below it and siblings *through contracts/events*;
never a layer above.

| L | Layer | Owns | May depend on | NEVER |
|---|---|---|---|---|
| **L0** | **Foundation** | persistence, encryption, rate-limit, tokens, secrets boundary, audit sink | — | intelligence, domain, applications |
| **L1** | **Kernel = GIOS** | identity, capability registry, entitlement resolver, event bus, scheduler, telemetry | L0 | verticals, domain law, UI |
| **L2** | **Intelligence Runtime = Kai** | reasoning, graph, planner, proactive, confidence, memory, the executive read | L0–L1 | data/storage, UI, billing, domain law, orchestration state |
| **L3** | **Shared Services** | compliance-scrub interface, mail/notify transport, analytics read-models, knowledge graph | L0–L2 | any one vertical's domain |
| **L4** | **Vertical Runtime** (per product) | the domain kernel: capability manifest, domain-graph adapter, **compliance boundary**, entitlement config | L0–L3 | another vertical, another vertical's data |
| **L5** | **Applications / Orchestration** | orchestration layers + modules (Agency Command, Consumer OS; within them Mission Control + modules) | L0–L4 (own vertical) | data ownership, cross-app imports, computing intelligence |
| **L6** | **Interfaces** | API + UI surfaces | L0–L5 (own vertical) | computing intelligence; owning truth |
| **L7** | **Integrations / Marketplace** | external partners, data feeds, 3rd-party plugins, the future marketplace | via L1 contracts only | reaching past the kernel into L0–L4 |

L0–L3 are the **shared kernel** (one per platform). L4–L7 are **per-vertical** (many). That split is the whole
game (§9).

## 2. Canonical dependency graph (a DAG; arrows = "depends on", down-only)
```
L7 Integrations/Marketplace ─► L1 (contracts only)
L6 Interfaces (API/UI) ─► L5 ─► L4 ─► L3 ─► L2(Kai) ─► L1(GIOS) ─► L0(Foundation)
                                   │                 ▲
   cross-vertical / cross-app  ────┘  (ONLY via L1 event bus — never a direct import)
```
- **Kai (L2) reads L0–L1 truth and every vertical's L4 domain adapter; it owns none of them.**
- **Applications (L5) never import each other**; they emit/subscribe on the **L1 event bus**.
- **Verticals (L4) never import each other**; cross-vertical awareness is Kai's job (L2), fed by events (L1).

## 3. Ownership registry — exactly one owner per thing
Separate the **engine** (intelligence, L2) from the **orchestration** (queue/surface, L5) from the **data**
(record, L0). Nothing owns two.

| Thing | Single owner | Layer |
|---|---|---|
| Identity, capabilities, entitlements, events, scheduling, telemetry | **GIOS kernel** | L1 |
| Executive reasoning, prioritization, risk, briefings, recommendations, memory, cross-product awareness | **Kai** | L2 |
| Compliance scrub interface · mail/notify transport · analytics read-models · knowledge graph | **Shared Services** | L3 |
| Credit domain, its compliance boundary (CROA/FCRA), its capability manifest | **CreditVector (vertical)** | L4 |
| Consumer OS · **Agency Command™** (orchestration) · Funding Hub · Business Credit OS · Marketplace · White Label · Enterprise | **CreditVector apps** | L5 |
| **Mission Control** (state roll-up) | inside Agency Command | L5 |
| **Campaigns** orchestration · **Mail Queue** · **Task Queue** · **Priority Queue** · Response **Queue** | Agency Command modules | L5 |
| **Response Intelligence** *engine* (`responseIntel`) | **Kai** | L2 |
| **Automation** (acts) — signals come from Kai/proactive (L2), the *action* is orchestration | Agency Command | L5 |
| Analytics *engine* (read-models) vs Analytics *surface* | Shared Svc (L3) / App (L5) | split |
| Letters/campaigns/responses/clients **records** | Foundation record | L0 |

Rule of reading: *"Response Intelligence"* = a Kai engine (L2) whose output is surfaced by the Response Queue
(L5) over letter records (L0). Three layers, three owners, zero overlap.

## 4. Dependency Laws
1. Foundation never imports the Kernel or above. 2. Kernel never imports verticals or domain law. 3.
Intelligence never imports UI; UI never computes intelligence. 4. Applications never import each other —
cross-app only via the event bus. 5. Verticals never import each other — cross-vertical only via Kai + events.
6. Server owns truth; the client renders. 7. Lower never imports higher (the DAG). 8. Domain law lives in the
vertical (L4) — never in the Kernel or Kai. 9. No layer bypasses the layer below it to reach two down (no
reaching around L1 to L0 for capabilities/entitlements). 10. A vertical reads only its own data; another
vertical's state is reachable only as an L1 event.

## 5. Architecture Laws (immutable — the constitution's teeth)
*Laws 1–10 consolidate rules that already live in `CREDITVECTOR-OS.md` + `CVIOS.md §Composition` — cited, not
duplicated. Laws 11–26 are platform-level and new.*
1. **One canonical source per subject.** 2. **Reuse before build.** 3. **Server owns truth; fail closed.** 4.
**No parallel infrastructure** (Constitution Art. VII). 5. **Honest metrics** — "not instrumented" over
estimates. 6. **Secrets never enter a prompt.** 7. **Additive schema** (self-heal, ADR-0001) — no destructive
migration. 8. **Compliance supremacy** — statute/CROA outranks any generated phrasing; the CCO gate is
non-optional. 9. **Kai capability expansion is ADR- + review-gated** (ADR-0005/0006). 10. **Sold entitlements
never shrink retroactively** (grandfather; ADR-0031). 11. **Exactly one Intelligence** — no vertical mints a
second reasoning/graph/confidence engine. 12. **Exactly one Event bus.** 13. **Exactly one Entitlement
authority** (L1). 14. **Exactly one Scheduler.** 15. **Exactly one Capability registry.** 16. **Exactly one
Audit sink.** 17. **Exactly one Identity.** 18. **Every product inherits the kernel** (L0–L3) unchanged. 19.
**Plugin isolation** — a vertical cannot read another vertical's data. 20. **Numbers are deterministic; the LLM
writes only prose.** 21. **Domain law is the vertical's, never the kernel's.** 22. **Every vertical implements
all ten Platform Contracts** (§6) or it does not ship. 23. **Provider independence** — external AI/services
behind `lib/` boundaries. 24. **Orchestration ≠ data ≠ intelligence** — never fused in one module. 25. **New
capability is registered, never hardcoded past the registry.** 26. **Every future ADR derives from this
document** and cites it.

## 6. Platform Contracts (the ten every vertical MUST implement)
Extends ADR-0033 §4's six into the full mandatory set. A vertical that omits any of these is not a GIOS
plugin.

| Contract | What it guarantees | Owner layer | Repo anchor (today) |
|---|---|---|---|
| **Identity** | one user/actor identity; server-resolved by id | L1 | `lib/auth.ts`, `lib/session.ts` |
| **Events** | namespaced emit/subscribe on the one bus | L1 | `lib/events.ts`, `kaiEvents` |
| **Entitlements** | server-authoritative caps/seats/add-ons | L1 | `lib/entitlements.ts` + `capabilityMatrix` |
| **Telemetry** | PII-free product events, coverage-honest | L1/L3 | `ProductEvent`, `lib/analytics/` |
| **Capabilities** | declared to the registry; flag-gated | L1 | `lib/os/kernel`, `config/capabilityMatrix` |
| **Memory** | projection-first case/record memory (gated) | L2 | `lib/intelligence/caseMemory.ts` (ADR-0006) |
| **Reasoning** | domain facts → Kai; deterministic, validated | L2 | `lib/intelligence/reasoning.ts` |
| **Scheduling** | deadlines/cadence/cron via the kernel | L1 | `vercel.json` crons, `forecast` clocks |
| **Audit** | append-only, PII-safe action log | L0/L1 | `AdminAuditLog`, ADR-0028 durable audit |
| **Compliance** | the vertical's domain-law boundary + scrub | L3/L4 | `lib/compliance.ts`, `/compliance-review` |

## 7. GIOS Plugin Model (how a vertical plugs in without changing GIOS)
- **Registration:** a vertical ships a **manifest** → the L1 **capability registry** (the CreditVector
  Plugin-#1 pattern: capabilities registered byte-identical, `lib/os/kernel`).
- **Lifecycle:** `register → enable(flag) → upgrade → deprecate`. **Flag-gated OFF by default**; nothing live
  until the owner flips it (every CreditVector platform sprint already ships this way).
- **Permissions:** capability grant (registry) × entitlement (L1) × role/PEP (`rolePermissions`) — all
  server-authoritative, fail-closed.
- **Intelligence hooks:** the vertical provides a **domain-graph adapter** (facts in) and consumes **Kai's
  executive read** (out). It never re-derives intelligence.
- **Events:** namespaced `vertical.domain.event`; emit to / subscribe from the one bus.
- **Routing:** namespaced routes; the kernel dispatches. A plugin's routes 404 unless enabled + authorized.
- **Isolation:** a plugin's data is private; the only cross-plugin channel is an L1 event.

## 8. Kai's permanent charter (structural boundary; behavior lives in `KAI-OS.md`)
**Kai permanently OWNS:** executive reasoning · prioritization · scheduling intelligence · risk · recommendations
· briefings · cross-product awareness · monitoring · coordination · planning.
**Kai NEVER owns:** data/storage · UI · billing · domain law · orchestration state (the queues own that) · the
record. **One Kai across all verticals.** Deterministic numbers; LLM prose only. Kai is a runtime, **not a
chatbot** — conversation is one interface (L6) onto the runtime, never its identity.

## 9. The 100-products / 20-years answer
**One kernel, one intelligence, N plugins.** Identity, capabilities, entitlements, events, scheduling,
telemetry, audit, memory, reasoning, and the compliance *interface* live **once** in L0–L3 and **never change
per product**. Each new product is an **L4 vertical + L5 apps** implementing the ten contracts (§6) and bringing
**only** its own domain + compliance law. 100 products = 100 L4–L7 plugins on the **same** L0–L3 kernel with the
**same** Kai. The invariant that survives 20 years: **nothing in L0–L3 is ever forked for a product.**

## 10. Freeze & amendment
- **HARD-frozen:** L0–L3 (Kernel + Kai + Shared Services) and Laws §5 — change only via superseding ADR +
  founder (+ CCO for L3 compliance). This is what stops spaghetti.
- **Evolves freely (within the contracts):** L4–L7 per vertical.
- Every future ADR opens by citing this document and states which layer it touches.

## 11. Reconciliation ledger → see [`ADR-0034`](ADR/ADR-0034-gios-platform-freeze.md)
The point-in-time contradictions/naming-drift/debt found while freezing (task 9) and the minimum fixes live in
the freeze ADR, so this constitution stays timeless.
