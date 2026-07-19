# ADR-0034: Freeze GIOS Platform Architecture v1.0

Status: **PROPOSED (2026-07-19 — architecture only; not implemented, not merged, not pushed).**
Decision owners: Founder directive (freeze sprint) · Chief Architect.
Relationship: **ratifies** [`GIOS-PLATFORM.md`](../GIOS-PLATFORM.md) as the frozen platform constitution.
**Consolidates, does not rewrite,** ADR-0031 / ADR-0032 / ADR-0033 (they remain valid; GIOS-PLATFORM.md is
their readable, frozen synthesis).

---

## 1. Decision
Ratify `GIOS-PLATFORM.md` (FROZEN v1.0) as the canonical platform constitution: the immutable **layer model
(L0–L7)**, the **dependency graph**, the **ownership registry** (one owner per thing), the **dependency laws**,
the **26 architecture laws**, the **ten Platform Contracts**, the **plugin model**, and **Kai's permanent
charter**. L0–L3 (Kernel + Kai + Shared Services) and the architecture laws are **HARD-frozen** — amendable only
by a superseding ADR + founder approval (+ CCO for the L3 compliance interface). L4–L7 evolve per vertical
within the contracts. **Every future ADR must derive from and cite `GIOS-PLATFORM.md`.**

No duplicate architecture was created: this sprint added the layer model + laws + ownership registry + full
contracts (which did not exist as one canonical artifact) and **consolidated** the existing ADRs; it rewrote
none of them.

## 2. Reconciliation ledger (task 9 — contradictions / ambiguity / debt / naming drift)

| # | Finding | Type | Minimum reconciliation | Status |
|---|---|---|---|---|
| 1 | `GIOS-COMPATIBILITY.md` said GIOS is "unrelated runtime / no coupling" vs ADR-0033's parent-platform hierarchy | contradiction | supersession banner (direction → ADR-0033; **engineering non-goals remain in force**) | **DONE** (Sprint XVII) |
| 2 | `CVIOS.md` draws Kai as a CVIOS-level Master Agent; frozen model puts Kai at GIOS (L2) above all verticals | contradiction | banner on `CVIOS.md` → hierarchy is ADR-0033 / GIOS-PLATFORM; Kai is GIOS-level | **DONE this ADR** |
| 3 | "Agency Command Center" (`CX-REVIEW.md §4`, `ROADMAP-V2` CX-5a, `INDEX.md`) vs canonical "Agency Command™" | naming drift | copy sweep → "Agency Command" | **DONE** (milestone audit) |
| 4 | `AIOS` vs `Agency OS` collision risk | naming drift | keep visibly distinct — AIOS = company OS, Agency OS = internal synonym for Agency Command (ADR-0032/0033) | **RESOLVED in docs** |
| 5 | `PRICING-V2-ROADMAP.md` still shows Agency Pro **$799** (code is $699) | stale doc | fix at the packaging implementation slice (ADR-0031) | **RECOMMENDED** (defer to impl) |
| 6 | Entitlement values live in **two** places — `lib/entitlements.ts` (live) + `config/capabilityMatrix.ts` (dormant, lockstep) | ambiguity / debt | ADR-0031 §4 capacity resolver consolidates to one server-authoritative resolver | **PLANNED** (first impl slice) |
| 7 | Kai runs **inside** CreditVector (`lib/intelligence`, `lib/os/kernel`), not in a GIOS runtime | target-vs-reality | labeled honestly (ADR-0033 §1, GIOS-PLATFORM header); convergence is structural → migration not rewrite | **ACCEPTED (disclosed)** |
| 8 | Multi-seat = stateless JWT today; Staff Load / Team Performance need a session registry (CSAP-1) | future debt | sequence the data-model decision before the Team phase (ADR-0031 §Build) | **FLAGGED** |
| 9 | Branch `docs/agency-command-architecture` now holds platform-level ADRs (0031–0034) | naming drift | rename on merge (e.g. `docs/platform-constitution`) | **RECOMMENDED** |
| 10 | AIOS framed "orthogonal" vs the founder's canonical chain `AIOS → GIOS → Kai → …` | naming/framing | reword to "governance layer at the top of the chain" (still a distinct axis) in `GIOS-PLATFORM.md` + `ADR-0033` | **DONE** (milestone audit) |
| 11 | `[[ADR-0030]]` wiki-links (ADR-0031, AGENCY-COMMAND) dangle — ADR-0030 is on the unmerged credit-identity branch, not `main` | broken link | replace with plain-text ("consumer allowance, out of scope here") | **DONE** (milestone audit) |

**Reconciliation executed:** freeze sprint did #2 (the frozen contradiction). The milestone-prep audit added
#3, #10, #11 (naming/framing/broken-link — wording-only). Still intentionally deferred: #5 (stale `$799` in
current-state/economics docs — accurate for the *unimplemented* code, owned by ADR-0031's delta), #6
(entitlement dual-source — the first implementation slice consolidates it), #9 (branch rename on merge).

## 3. Protected state
Architecture only — no code/UI/DB/billing/protected-flag/merge/push; no runtime coupling created. Subordinate
to `CREDITVECTOR-OS.md` + `KAI-OS.md`. First implementation slice unchanged (ADR-0031 §4 capacity resolver).
