# ADR-0033: Platform Constitution — GIOS → Kai → CreditVector

Status: **PROPOSED (2026-07-19 — architecture only; not implemented, not merged, not pushed).**
Decision owners: Founder directive (Sprint XVII) · Chief Architect (reconciliation).
Relationship: **PARENT** of [`ADR-0032`](ADR-0032-platform-layering-kai-kernel.md) (CreditVector-internal
layering) and [`ADR-0031`](ADR-0031-agency-command-packaging-revenue.md) (Agency packaging). **Supersedes the
DIRECTIONAL framing** of `GIOS-COMPATIBILITY.md` (its engineering non-goals remain in force — see §1).

---

## 1. Context — the inflection, the contradiction, and the honest reality
**Founder direction:** the canonical hierarchy is **GIOS → Kai → CreditVector**. Kai belongs to **GIOS**, not to
CreditVector, Agency Command, or Mission Control. CreditVector is the **first vertical application** on GIOS.

**Phase-0 finding (STOP-and-reconcile) — this reverses a prior boundary.** `GIOS-COMPATIBILITY.md` (2026-07-12)
states GIOS is *"unrelated runtime… separate products in separate repositories… conventions only, not a runtime
integration,"* non-goal *"no coupling to the GIOS repository."* The new direction makes GIOS the **parent
platform**. This ADR **supersedes that DIRECTION** (GIOS is now the target parent), while the **engineering
non-goals stay in force** until a real integration is separately approved: no shared secrets/DB, no importing
GIOS code without license/fit review, separate repos today.

**Honesty labels (no false completion):**
- The hierarchy here is the **TARGET / north-star** — VERIFIED as founder-directed, PROPOSED as architecture.
- **Current runtime reality (VERIFIED):** Kai runs **inside** CreditVector (`lib/intelligence/`,
  `lib/os/kernel/`) as GIOS-Plugin-#1 *groundwork*; there is **no live CreditVector↔GIOS coupling**. The code is
  *structured* to converge (bounded kernel, capability registry, foundation boundary), so the future is a
  **migration, not a rewrite**. This ADR makes the hierarchy canonical, **not live.**

## 2. Decision — three permanent concepts, one responsibility each (no overlap)

| Concept | One line | Owns | Never owns |
|---|---|---|---|
| **GIOS** — Gabriel Intelligence Operating System | the intelligence **runtime / substrate** every vertical runs on | the runtime, the Vertical Contract (§4), Kai | any one product's domain |
| **Kai** — Platform Intelligence Runtime (Chief of Staff · Executive Intelligence Kernel) | the **one coherent intelligence** that reads every subsystem and produces the executive read, across **all** verticals | reasoning · graph · planner · proactive · confidence · the executive read | data · storage · UI · billing · domain law |
| **CreditVector** — first vertical / flagship (CVIOS) | "The Operating System for Credit Businesses" + the Consumer Credit Intelligence OS | the credit **domain**: its orchestration layers, modules, compliance, foundation | the runtime · Kai's behavior contract |

**Governance layer at the top of the chain: Gabriel Capital Labs AIOS** — the **company** operating system
(charter, decision rights 🟢🟡🔴, `/gcl` fleet). **AIOS decides WHO/WHETHER · GIOS is HOW products run · CVIOS
is WHAT the product does.** Two axes, never competitors. `AIOS ≠ Agency OS` (§6).

## 3. Canonical platform diagram (the one true picture)
```
        Gabriel Capital Labs AIOS   (company OS — WHO / WHETHER · /gcl)   ── top of chain (governs ↓)
                    ┊ governs the runtime below; a different axis (it governs, it doesn't execute)
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  GIOS — Gabriel Intelligence Operating System   (intelligence runtime)    │
   │      ↓ hosts                                                              │
   │  Kai — Platform Intelligence Runtime · Chief of Staff · Exec Kernel       │  ← belongs to GIOS
   │      ↓ orchestrates every vertical (reads all · owns no domain)           │
   │  ┌─────────────────────────────────────────────────────────────────────┐ │
   │  │  CreditVector  (first vertical / flagship — CVIOS)                   │ │
   │  │    Consumer OS · Agency Command™ · Funding Hub · Business Credit OS  │ │
   │  │    · Marketplace · White Label · Enterprise                         │ │
   │  │       ↓  (within Agency Command — ADR-0032)                         │ │
   │  │    Mission Control (one module) · operational modules               │ │
   │  │       ↓                                                             │ │
   │  │    Shared Foundation (entitlements · encryption · rate-limit ·      │ │
   │  │    compliance scrub · events · tokens)                              │ │
   │  └─────────────────────────────────────────────────────────────────────┘ │
   │  [ future verticals plug in HERE, at CreditVector's level — §4/§5 ]       │
   └──────────────────────────────────────────────────────────────────────────┘
```

## 4. The Vertical Contract — how any product plugs into GIOS + Kai
*(the real answer to "ten products, no rewrite")* Every vertical **implements one stable contract** and
**consumes** the runtime; it **never re-implements** intelligence, entitlements, or foundation:
1. **Capability registry** — declares capabilities/tiers to the kernel (`lib/os/kernel` + `config/capabilityMatrix` pattern; CreditVector = Plugin #1, registered byte-identical).
2. **Entitlement resolver** — server-authoritative caps/seats/add-ons (ADR-0031 shape).
3. **Event stream** — emits domain events; runtime + modules subscribe.
4. **Intelligence adapters** — hands its domain graph/facts to Kai (graph/reasoning/proactive) and consumes Kai's executive read; **never mints a second intelligence.**
5. **Compliance boundary** — its own domain law (CreditVector's is CROA/FCRA; GIOS has none). Each vertical brings its own.
6. **Foundation services** — shared encryption/rate-limit/tokens/audit; **never parallel infrastructure.**

A new product = a new vertical implementing 1–6. **Kai and GIOS are unchanged.** Zero platform rewrite.

## 5. Future verticals — pattern + naming recommendation
Founder offered `CreditVector / TradingVector / HealthVector / LegalVector / BusinessVector`. **Recommendation:
standardize the CONTRACT (§4), not the brand.** A vertical is defined by implementing §4 — whatever it's called.
Keep "*Vector" as the **default brand family** (memorable, coherent) but treat product names as marketing
decisions; the platform binds on the contract, not the naming convention. Each maps cleanly and keeps its **own
domain law**: TradingVector (SEC/FINRA) · HealthVector (HIPAA) · LegalVector (UPL) · BusinessVector (commercial).
Kai spans them all as the **one** runtime.

## 6. Naming reconciliation & retirements (canonical)
- **Keep:** GIOS · Kai · CreditVector · Agency Command™ · Consumer OS · Mission Control · Executive Morning Brief · Agency Health (Score).
- **CVIOS** = internal architecture term for CreditVector's product OS (the vertical's own layering). **Not
  customer-facing** — customer-facing is "CreditVector — The Operating System for Credit Businesses."
- **AIOS** = the company OS. **`AIOS ≠ Agency OS`** — keep visibly distinct.
- **"Agency OS"** = internal synonym for Agency Command™ (ADR-0032).
- **Retire / never canonical:** "Agency Command Center" (→ Agency Command); "AI Credit Repair Software",
  "Credit Repair CRM", "Letter Generator" (positioning — never used).

## 7. Positioning
- **Platform:** GIOS is the intelligence operating system; **Kai is the platform intelligence runtime.**
- **CreditVector (flagship / first vertical):** "**The Operating System for Credit Businesses**" (B2B/agency) +
  "The Credit Intelligence Operating System" (consumer). Never "credit repair software / CRM / letter generator."

## 8. Governance — one canonical source per subject
- **ADR-0033 (this)** = the PLATFORM hierarchy constitution. Parent of ADR-0032 (CreditVector-internal) and ADR-0031 (packaging).
- Subordinate / sibling (unchanged, they own their subject): **KAI-OS.md** (Kai's behavior), **CVIOS.md**
  (CreditVector product architecture), **GIOS-COMPATIBILITY.md** (engineering conventions + non-goals — its
  *direction* superseded here, its *non-goals* stand).
- **Conflict order:** `CREDITVECTOR-OS.md` (company principles) → `KAI-OS.md` (Kai behavior) →
  compliance/statute → **ADR-0033** (platform structure) → product ADRs. Amend only with founder approval + a
  superseding ADR.

## 9. Executive answer — "what lets GCL build ten products without rewriting the platform?"
**A permanent three-layer separation with a stable Vertical Contract.** GIOS (runtime) + Kai (one intelligence
runtime for all verticals) + Verticals (apps implementing §4). Intelligence, entitlements, and foundation live
**once** in the platform; each vertical adds **only** its domain + compliance boundary. The tenth product is the
first product's shape with a different domain adapter — **no platform rewrite.**

## 10. Protected state
Architecture only — no code/UI/DB/billing/protected-flag/merge/push. **No CreditVector↔GIOS runtime coupling is
created;** the GIOS-COMPATIBILITY engineering non-goals remain binding. First implementation slice is unchanged
(ADR-0031 §4 capacity resolver). Reconciliation follow-ups (copy only, not this commit): update the `CVIOS.md`
diagram to show Kai at GIOS level; sweep "Agency Command Center" in `CX-REVIEW.md`/`ROADMAP-V2.md`.
