# Releases — Publication Artifacts

## Purpose

Projections built from canonical Markdown: HTML, PDF, EPUB.

**Nothing here is knowledge and nothing here has authority.** These are artifacts. Markdown governs; a release is a photograph of it at a moment.

## Canonical files

**None.** Everything in this tree is generated. The canonical source for every artifact is stated in the release's own directory.

## Generated artifacts

Everything. `<domain>/<date-or-version>/` — one directory per release, written **once**.

`founder-library/2026-07-27/` — the first Founder Library release snapshot: self-contained HTML editions of Volumes 0 and 3–6, offline-capable, with in-document download and print controls.

## Ownership

**Owner:** whichever domain produced the source. The release inherits its domain's ownership.

## Rules

1. **A release directory is written once and thereafter treated as archive.** A new build produces a **new** directory.
2. **Projections are never regenerated in place.** That rule is what prevents history from accumulating dead blobs.
3. Every release records its provenance: source path, source version, build date, and builder version.
4. Text parity with the canonical source is verified at release, and the **evidence is committed** — a `MANIFEST` of SHA-256 digests for each source and each artifact. A parity claim with no digest is unfalsifiable. Parity compares two committed files, so it stays re-checkable with no builder at all.
5. Working builds go to `build/` and are gitignored. Only release snapshots are committed.
6. **Releases are archival in status but never relocate.** They stay here permanently. They do not move into `archive/<year>/` when superseded — moving them would break every citation pointing at them.

## Version policy

A release is named for its date or the version it projects. Releases are immutable.

## Do not

- **Do not** edit an artifact here. Fix the Markdown or the builder and cut a new release.
- **Do not** regenerate a release in place.
- **Do not** cite a release as a source. Cite the canonical Markdown.
- **Do not** let a projection become the only surviving copy of anything. ⚠ **This rule is currently being violated**: `founder-library/2026-07-27/` is the only surviving copy of the builder's `<head>`/stylesheet and its inline JavaScript. That snapshot must not be removed until Architecture §13.8 lands.
- **Do not** move a release into `archive/`. It is already permanent where it is.

---

*Governed by [Knowledge Architecture 1.0](../ARCHITECTURE.md). Changes to the architecture are Corporate decisions.*
