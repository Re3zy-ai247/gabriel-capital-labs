# Gabriel Capital Labs — Knowledge

## Purpose

The company's institutional knowledge: what Gabriel Capital Labs has decided, believes, has learned, and has built — organized so that it survives the people who wrote it and the products that occasioned it.

This tree is **company-level, not product-level.** It is deliberately self-contained: it references no application code, is referenced by none, and has no build coupling. It currently sits inside the CreditVector application repository because that is where the company's history happens to live, and it is built to be lifted out into a dedicated repository the moment one exists ([`ARCHITECTURE.md` §10.3](ARCHITECTURE.md)).

**Start here:** [`ARCHITECTURE.md`](ARCHITECTURE.md) — the governing standard. It defines the domains, the truth hierarchy, what is canonical, what is derived, and what may never be changed.

## Canonical files

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Knowledge Architecture 1.0. The governing standard for this tree and every repository the company creates.

### The domains

| Directory | Holds |
|---|---|
| [`corporate/`](corporate/) | The company as an institution: decisions, board, strategy, operations, people, finance, policies |
| [`founder-library/`](founder-library/) | The published intellectual corpus — Books and Volumes |
| [`research/`](research/) | Evidence: dossiers, primary sources, benchmarks, notes |
| [`engineering/`](engineering/) | An **index** of each repository's engineering record. Canonical engineering truth stays in the repository it governs |
| [`products/`](products/) | Product knowledge that is neither company reasoning nor engineering |

### Cross-cutting mechanisms — not domains

| Directory | What it is |
|---|---|
| [`shared/`](shared/) | Company-owned assets used by every domain: brand, legal, standards, design system, publishing toolchain, media |
| [`releases/`](releases/) | Projections (HTML, PDF, EPUB) built from canonical Markdown. Immutable once written |
| [`archive/`](archive/) | An append-only lifecycle state that any domain's artifacts enter |

## Generated artifacts

**None at this level.** Everything here is canonical Markdown. Projections live in `releases/` and carry no authority.

## Ownership

**Owner:** Founder, Gabriel Capital Labs.
**Classification:** Internal. Individual subtrees may be Restricted — see `ARCHITECTURE.md` §5.1.

Per-domain ownership is declared in each domain's README. Changes to the architecture itself are **Corporate decisions**, recorded in [`corporate/decisions/`](corporate/decisions/).

## Rules

1. **One canonical copy.** Every fact has exactly one home. Everything else references it.
2. **Markdown is truth.** Generated artifacts are projections and carry no independent authority. Received and executed originals (signed contracts, counsel memos) are a separate class — `ARCHITECTURE.md` §6.3.1.
3. **Domains are mutually exclusive.** A document that could live in two domains means the boundary is wrong.
4. **Reference across domains; never copy across them.**
5. **Every directory explains itself.** README required at depth ≤ 3.
6. **Nothing is deleted** — superseded or archived, never removed. The single exception is Compelled Removal (§8.1), which is itself recorded.

## Version policy

`ARCHITECTURE.md` is versioned as a Corporate decision: amended in versioned revisions, never silently replaced. Each domain sets its own document versioning in its README. **Presentation work advances no version** — a new HTML edition is not a revision.

## Onboarding

Read, in order:

1. This file.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — how the tree works.
3. The README of the domain you own.
4. Founder Library **Book I** — what the company believes and why.

That is the whole path. It is meant to be bounded and finite; if it stops being either, the architecture has failed.

## Do not

- **Do not** create a second copy of anything that already has a home here. If a fact appears twice, one occurrence is a reference or one is wrong.
- **Do not** commit generated HTML, PDF, or EPUB outside `releases/`.
- **Do not** put identifiable personal data in this tree. It belongs in a system with its own retention schedule and access controls.
- **Do not** materialize this tree inside an application repository. Application repositories inherit the truth hierarchy, the archive policy, the README standard, and the Engineering domain only — `ARCHITECTURE.md` §0.1.
- **Do not** couple anything here to application code, in either direction. The tree's portability is a design property, not an accident.
- **Do not** treat `ARCHITECTURE.md` as ratified. It is Draft, and `CD-001` states what that means.

---

*Governed by [Knowledge Architecture 1.0](ARCHITECTURE.md).*
