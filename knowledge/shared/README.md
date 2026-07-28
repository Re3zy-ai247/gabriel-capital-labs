# Shared — Company Assets

## Purpose

Assets owned by **Gabriel Capital Labs**, used by every domain and every product. Nothing here belongs to a product, and nothing here may be forked into one.

This is not a knowledge domain — it is the company's common infrastructure.

## Canonical files

- `brand/` — brand definition and usage
- `legal/` — legal templates and standing positions
- `standards/` — company standards, including this architecture's dependents
- `templates/` — document templates
- `design-system/` — the design system
- `publishing/` — the publishing toolchain (`build_edition.py`)
- `media/` — media assets, with `REGISTRY.md` recording provenance and size

## Generated artifacts

None. The publishing toolchain **produces** artifacts; it is not itself one.

## Ownership

**Owner:** Gabriel Capital Labs. Not a product, not a domain.

## Rules

1. **Shared assets never belong to a product.** If an asset serves one product only, it belongs to that product.
2. **One builder, all domains.** The publishing toolchain is company infrastructure.
3. Media is registered with provenance and size. Text will never threaten this repository; media will.
4. A product may not fork a shared asset. It may request a change.

## Version policy

Standards and templates are versioned. The toolchain is versioned with the repository.

## Do not

- **Do not** copy a shared asset into a product directory.
- **Do not** add large binaries without registering them.
- **Do not** let the publishing toolchain edit canonical Markdown — a builder that modifies its source is a defect.

---

*Governed by [Knowledge Architecture 1.0](../ARCHITECTURE.md). Changes to the architecture are Corporate decisions.*
