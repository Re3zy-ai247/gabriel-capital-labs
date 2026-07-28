# CreditVector — Engineering Record (Pointer)

## Purpose

Locates the canonical engineering truth for the CreditVector application. **This directory contains no engineering documentation** — it tells you where the real record is.

## Canonical files

**None here.** CreditVector's engineering truth lives in the CreditVector repository:

| What | Where |
|---|---|
| Entry point and session protocol | `/CLAUDE.md` |
| Governance hub and routing | `/.ai/INDEX.md` |
| Engineering constitution | `/.ai/CONSTITUTION.md` |
| Architectural decision records | `/.ai/ADR/` |
| Live state snapshot | `/.ai/CURRENT-STATE.md` |
| Platform and kernel architecture | `/architecture/` |
| Runbooks | `/.ai/RUNBOOKS/` |

Paths are relative to the repository root. At the time of writing, that repository is the same one this knowledge tree sits in — a condition Architecture §1 explains and §10.3 resolves.

## Generated artifacts

None.

## Ownership

**Domain:** Engineering. **Owner:** Engineering.

Engineering governs engineering absolutely (Architecture §5, rank 2). Nothing in the knowledge tree outranks `/.ai/` on an engineering question, and **production truth outranks both**.

## Rules

1. **Reference, never copy.** No ADR, constitution, or architecture document is duplicated here.
2. Changes to engineering truth go through the engineering review gate, not through this tree.
3. A Corporate or Founder Library decision with engineering consequences is a decision **to be taken through** engineering governance — not one already taken there.

## Version policy

The repository's own. This pointer tracks nothing.

## Do not

- **Do not** copy `.ai/` or `architecture/` content into this directory.
- **Do not** move `.ai/` or `architecture/` without owner approval and a green guard suite — `scripts/quality-ledger.test.ts` and `scripts/eng-ops.test.ts` reference those paths, and `CLAUDE.md` hard-codes them. Architecture §10.4 is the runbook.
- **Do not** treat anything here as authoritative over the repository's own record.

---

*Governed by [Knowledge Architecture 1.0](../../../ARCHITECTURE.md).*
