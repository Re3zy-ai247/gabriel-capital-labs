# Engineering — Domain

## Purpose

Technical truth: how software is built and governed.

**This directory holds pointers and indexes, never copies.** Canonical engineering truth lives inside the repository it governs, alongside the code, the tests, and the review gates that enforce it. Centralising copies would guarantee drift from the repository they describe.

## Canonical files

**Nothing in this directory is canonical engineering truth.** Each subdirectory of `repositories/` contains a README stating where that repository's truth actually lives and how to reach it.

## Generated artifacts

None.

## Ownership

**Domain:** Engineering. **Owner:** Engineering, per repository. Engineering governs engineering absolutely (Architecture §5, rank 2) — no document in this knowledge tree outranks a repository's engineering record on an engineering question.

## Rules

1. **Reference, never copy.** A duplicated ADR is a defect.
2. One directory per repository. Adding a repository costs a pointer, not a migration.
3. Each repository README states: where truth lives, what governs changes to it, and what the review gate is.
4. A Corporate or Founder Library decision with engineering consequences is a decision **to be taken through** engineering governance, not one already taken there.

## Version policy

Versioning is the repository's own. This directory tracks nothing independently.

## Do not

- **Do not** copy ADRs, constitutions, or architecture documents into this tree.
- **Do not** treat anything here as authoritative over a repository's own record.
- **Do not** assume one repository. The architecture is multi-repository by design.

---

*Governed by [Knowledge Architecture 1.0](../ARCHITECTURE.md). Changes to the architecture are Corporate decisions.*
