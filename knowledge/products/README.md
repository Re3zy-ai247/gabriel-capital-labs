# Products — Domain

## Purpose

Product knowledge that is neither company reasoning nor engineering: user documentation, support playbooks, operational runbooks, and product decisions that are not architectural.

One directory per product. **A new product slots in by creating a directory — nothing existing is edited.** That property is the test this domain was designed against.

## Canonical files

`<product>/` — everything under each product directory.

Current products: `creditvector/`, `gios/`, `gtg-quant/`.

## Generated artifacts

None.

## Ownership

**Domain:** Products. **Owner:** the product owner for each product.

## Rules

1. One directory per product. Never nest one product inside another.
2. Product **positioning and reasoning** belong to the Founder Library; product **operation and use** belong here.
3. Product **architecture** belongs to the repository's engineering record, not here.
4. A product's directory may exist before the product does — an empty directory with a README stating the product is not yet described is better than an undocumented gap.

## Version policy

Per product. Operational documents are versioned by the product's release cycle.

## Do not

- **Do not** duplicate Founder Library positioning here.
- **Do not** place engineering architecture here.
- **Do not** describe a product capability as existing when it does not. The library's implementation labels — [Live] / [Partial] / [Planned] — apply.

---

*Governed by [Knowledge Architecture 1.0](../ARCHITECTURE.md). Changes to the architecture are Corporate decisions.*
