# Founder Library — Domain

## Purpose

The company's published intellectual corpus: the Books and Volumes stating what Gabriel Capital Labs believes, why, and what it refuses.

It is governed by its own constitution — **Volume 0** — which defines document statuses, versioning, conflict resolution, and the permanent rules binding every volume. Volume 0 governs this domain; this README does not restate it.

## Canonical files

- `books/book-01-foundation/` — Volumes 0–5 (the Foundation Edition)
- `books/book-02-market-and-model/` — Volume 6 onward
- `REVISION-LOG.md` — volume status, founder ratifications, pending revisions, open items, editorial debt

There is deliberately no separate status index. `REVISION-LOG.md` is the single source of truth for volume status; a second index would be a second source of truth, which Volume 0 forbids.

**Markdown is canonical. It is the only edited artifact in this domain.**

## Generated artifacts

**None in this directory, by design.** HTML, PDF, and EPUB editions are projections built by `shared/publishing/build_edition.py` and written to `releases/founder-library/<date>/`.

The 2026-07-27 HTML editions of Volumes 0 and 3–6 are preserved at `releases/founder-library/2026-07-27/`.

## Ownership

**Domain:** Founder Library. **Owner:** Founder, as Editor-in-Chief.

## Rules

1. **Volume 0 governs this domain.** Its permanent rules bind every volume.
2. Volumes evolve through versioned amendment, never silent replacement.
3. Terms are defined once and cited thereafter.
4. Nothing is deleted; superseded text is retained and readable.
5. Every volume states version, status, date, purpose, and intended audience.
6. Editorial debt is recorded in `REVISION-LOG.md`, not fixed by quietly editing an earlier volume.

## Version policy

Major = the position changed. Minor = corrected, clarified, or reconciled. **Presentation work advances no version** — a new HTML edition is not a revision.

## Do not

- **Do not** edit a projection. A defect in the HTML is a defect in the Markdown or the builder.
- **Do not** commit generated HTML into this directory. It goes to `releases/`.
- **Do not** rewrite a published volume to resolve a downstream inconsistency. Log it.
- **Do not** create a second definition of a term another volume defines.
- **Do not** treat any volume as a company commitment while its status is Draft.

---

*Governed by [Knowledge Architecture 1.0](../ARCHITECTURE.md). Changes to the architecture are Corporate decisions.*
