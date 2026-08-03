# File Index — CreditVector Fulfillment Engine v1.0

Every file under `docs/fulfillment/` and `docs/handoffs/`, grouped by the cycle that produced it, with a one-line description and current line count (`wc -l`). Four documents were revised across two cycles (noted in their own row) — each appears once, under the cycle it originated in, not twice.

## Architecture cycle (commits `0d66e80`, `f211f33`, `e223e51`)

| File | Lines | Description |
|---|---:|---|
| `PROGRAM-BRIEF.md` | 81 | Founder's 10 authoritative decisions + scout-verified repository-truth digest; the binding contract every later document builds against |
| `A-DOMAIN-MODEL.md` | 270 | Agent A — the `Case` + `DisputePackage` domain model over existing `Tradeline`/`Letter`/`MailManifest` truth |
| `A-STATE-MACHINE.md` | 218 | Agent A — the unified fulfillment state machine mapping the existing 16-state manifest + 6-state `Letter.status` onto the canonical 12-stage operator timeline |
| `A-POLICY-ENGINE.md` | 150 | Agent A — the deterministic Fulfillment Policy Engine spec (typed inputs/decisions, 6 laws) |
| `A-PROVIDER-ABSTRACTION.md` | 192 | Agent A — the provider adapter contract formalization + the new Vendor Opacity law |
| `B-MAIL-CENTER-EVOLUTION.md` | 310 | Agent B — `/mail` and the send wizard evolved into the Case Journey operational workspace |
| `C-WALLET-INTEGRATION.md` | 943 | Agent C — the original Wallet integration architecture; **selectively superseded** by `WALLET-COMMITMENT-MODEL.md` §13's supersession map |
| `D-KAI-EXPERIENCE.md` | 275 | Agent D — Kai as operational guide across the Case Journey; **selectively superseded** by `KAI-FULFILLMENT-UX.md` §5's map |
| `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` | 356 | Agent E — the unified architecture merge: 17-item resolved conflict docket, risk register, appendix cross-reference |
| `OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` | 88 | Agent E — the six-mandatory-presentations Room Constitution, proposed amendment (pointer ADR-0047) |
| `ADR-PROPOSALS.md` | 252 | Agent E — ADR-0041 through ADR-0047, full text, `Status: Proposed` |
| `IMPLEMENTATION-SEQUENCE.md` | 189 | Agent E — the phased, flag-gated, September-1-aligned rollout sequence (Phase 0–7) |
| `ADVERSARIAL-REVIEW.md` | 131 | Opus gate — 14 ranked findings, CROA §404 analysis + counsel question, must-fix list. **Verdict: NOT READY as implementable** |
| `FOUNDER-SUMMARY.md` | 27 | One-page Founder brief distilling the gate verdict into 3 decisions + 3 options |
| `FOUNDER-SUMMARY.html` | 90 | Self-contained HTML twin of the above (the visual precedent this handoff's own HTML twins follow) |

## Refinement cycle 1 (commits `f8cfb92`, `c61f2c8`, `7578705`)

| File | Lines | Description |
|---|---:|---|
| `COMMITMENT-REFINEMENT-BRIEF.md` | 39 | Founder ruling (keep the prepaid Wallet) + the S1–S8 mechanics spine + W1–W3 assignments |
| `WALLET-COMMITMENT-MODEL.md` *(revised again in refinement-2)* | 1,799 | W1 — full wallet mechanics: anchor-lock schema, per-letter/attempt-keyed ledger, transaction pseudocode, the Wallet Constitution Amendment. Current content reflects both refinement cycles (see `docs/handoffs/CHANGELOG.md` for the split) |
| `FULFILLMENT-COMMITMENT-BOUNDARY.md` *(revised again in refinement-2)* | 377 | W2 — the two-layer commitment boundary, the 11-question vendor-confirmation list, the state-machine delta over `A-STATE-MACHINE.md` |
| `RECOVERY-ENGINE.md` *(revised again in refinement-2)* | 184 | W2 — the new Fulfillment Recovery Engine subsystem: the 17(+1)-scenario deterministic matrix, the reconciliation sweep spec, the Recovery Constitution |
| `KAI-FULFILLMENT-UX.md` *(revised again in refinement-2)* | 553 | W3 — the FINAL REVIEW interaction, the Kai failure-translation catalog, truthful money narration |
| `COMMITMENT-RESOLUTION.md` *(reconciled again in refinement-2, final register)* | 57 | Program Director merge — answers the Founder's critical question; the authoritative, continuously-reconciled verdict register. **Current verdict: READY-WITH-DISCLOSURES** |
| `COMMITMENT-REGATE.md` | 46 | Cycle-1 re-gate — 14 findings (6 re-tested + 8 new), 10 bounded must-fixes. **Verdict: NOT READY** (foundations sound, one cross-document contradiction) |

## Refinement cycle 2 (commits `e70ad8f`, `44a6789`, `326a1d7`)

| File | Lines | Description |
|---|---:|---|
| `REFINEMENT-2-DIRECTIVE.md` | 39 | The Founder's authoritative decision on the re-gate + the 4 pre-decided cross-document rulings (unified attempt+1, canonical claim-key registry, N2 irreversibility, FINAL REVIEW ordering) + agent assignments |

*(The four W1/W2/W3 documents and `COMMITMENT-RESOLUTION.md` this cycle revised are listed once each, above, under refinement cycle 1 where they originated — see the parenthetical notes on those rows.)*

## Handoff cycle (this package, `docs/handoffs/`)

| File | Lines | Description |
|---|---:|---|
| `EXECUTIVE-SUMMARY.md` / `.html` | 71 | The full arc in Founder-readable form; the READY-WITH-DISCLOSURES verdict; what exists; the top decisions; the three headline disclosures |
| `AGENT-REPORTS.md` / `.html` | 68 | Per-agent/per-gate summary of the entire program, scouts through the final re-gate |
| `ARCHITECTURE-DECISIONS.md` / `.html` | 37 | The 13 durable design decisions + the ADR-0041–0047 map, in table form |
| `ROADMAP.md` / `.html` | 41 | The Founder's Execution-Era priority order, this package's readiness against it, preserved-subsystems list |
| `NEXT-SPRINT.md` / `.html` | 62 | The single recommended next sprint — 4 bounded, non-implementation items, entry/exit criteria each |
| `CHANGELOG.md` / `.html` | 63 | Commit-by-commit history of `docs/fulfillment-engine-v1`, `f449c35..326a1d7` |
| `FILE-INDEX.md` / `.html` | 67 | This index |

## Totals

| Group | Files | Lines |
|---|---:|---:|
| Architecture cycle | 15 | 3,572 |
| Refinement cycle 1 (current content) | 7 | 3,055 |
| Refinement cycle 2 | 1 | 39 |
| **`docs/fulfillment/` total** | **23** *(22 `.md` + 1 `.html`, counted once each; `FOUNDER-SUMMARY` counts as 2 files)* | **6,666** |
| `docs/handoffs/` (7 `.md` files) | 7 | 409 |

Counts are `wc -l` against the current worktree at commit `326a1d7` (`docs/fulfillment/`) and at handoff-package build time (`docs/handoffs/`).
