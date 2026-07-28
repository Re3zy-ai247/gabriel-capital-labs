# Publishing — Toolchain

## Purpose

The company's single publishing toolchain. It projects canonical Markdown into HTML editions, and is shared by every domain — it belongs to Gabriel Capital Labs, not to any product or domain.

## Canonical files

- `build_edition.py` — renders a volume's canonical Markdown into a self-contained HTML edition

## Generated artifacts

None here. The builder **writes** artifacts; it does not contain them. Working output goes to `build/` (gitignored); release snapshots go to `knowledge/releases/`.

## Ownership

**Owner:** Gabriel Capital Labs. Shared infrastructure.

## Rules

1. **The builder never modifies canonical Markdown.** It reads and emits. A builder that edits its source is a defect.
2. **One builder, all domains.** Domain-specific rendering is a parameter, not a fork.
3. Every artifact it produces carries provenance: source path, source version, build date.
4. Text parity between artifact and source is verified at release, not assumed.
5. Presentation changes advance no document version.

## Known issue — carried forward from the migration

`build_edition.py` reads a previously-built HTML file to reuse its `<head>`, stylesheet, and inline scripts. **That path was relative to the old `founder-library/` directory and is now stale**, because the HTML editions moved to `releases/founder-library/2026-07-27/` under Architecture §6.3.

This was **recorded rather than silently patched**: the builder's template source is a design question (should the shared stylesheet live in `shared/design-system/` rather than be scraped from a prior artifact?), and answering it properly is worth more than a path fix. Tracked as new editorial debt.

**Until it is resolved**, pass an explicit head-template path when invoking the builder.

## Version policy

Versioned with the repository. A builder change that alters output is a **presentation** change and advances no document version — but it does require a new release snapshot rather than regenerating an existing one.

## Do not

- **Do not** let the builder write into a canonical directory.
- **Do not** regenerate a release snapshot in place. Cut a new one.
- **Do not** fork this builder per product.
- **Do not** scrape a release artifact as a template source once the known issue above is resolved.

---

*Governed by [Knowledge Architecture 1.0](../../ARCHITECTURE.md).*
