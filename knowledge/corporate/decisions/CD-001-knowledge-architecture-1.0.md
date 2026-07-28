# CD-001 — Knowledge Architecture 1.0

**Status:** Proposed — **not ratified**
**Date:** 2026-07-28
**Authority:** Pending founder ratification
**Scope:** Company-wide knowledge organisation, in this repository and every future repository
**Review:** Adversarially reviewed before first commit — 59 findings raised, 24 confirmed, 35 refuted. Disposition in ARCHITECTURE.md §15.

---

## Decision proposed

Adopt **[Knowledge Architecture 1.0](../../ARCHITECTURE.md)** as the governing standard for Gabriel Capital Labs' institutional knowledge.

## What it establishes

1. **Five knowledge domains** — Corporate, Founder Library, Research, Engineering, Products — mutually exclusive and jointly exhaustive, with an ordered domain test for filing.
2. **Three cross-cutting mechanisms that are not domains** — Shared, Archive (a lifecycle state), Releases (projections).
3. **A truth hierarchy** covering the domains Volume 0 §6 does not reach: law and counsel > production truth > engineering record > corporate record > Founder Library > research > projections. It orders documents against each other, never a document against evidence, and does not restate Volume 0's intra-library ordering.
4. **Markdown is canonical; generated HTML and PDF are projections with no independent authority.** A fourth class — **received or executed originals** (signed contracts, counsel memos, audited financials) — is canonical in its native format and outranks any transcription.
5. **Generated artifacts are not committed by default** — only release snapshots, written once and never regenerated in place. Conditioned on that domain's projections being genuinely reconstructible first.
6. **An append-only archive**, year-partitioned, preserving original paths, with a single narrow exception: **Compelled Removal** on written authorisation and counsel's determination, always tombstoned.
7. **A mandatory README standard**, seven sections, including an explicit "Do not".
8. **A classification dimension** — Public / Internal / Restricted — orthogonal to authority, with the repository-partition decision due at extraction rather than after.
9. **Inheritance scoped by repository class**: the knowledge repository materializes every domain; an application repository inherits the truth hierarchy, the archive policy, the README standard, and the Engineering domain only.

## What it does NOT decide

- It does **not** move engineering truth. `.ai/` and `architecture/` stay where they are; a migration runbook exists but was not executed. `.ai/` is additionally a **partition**, not a move — it holds Corporate and Shared material as well as engineering truth.
- It does **not** create the dedicated company knowledge repository. It makes the tree extraction-ready and supplies the procedure.
- It does **not** ratify anything in the Founder Library, or change any volume's status.
- It does **not** establish any technical fact or legal position.
- It does **not** resolve the publishing toolchain's dependence on a committed release artifact for its own template and scripts (§13.8). That debt is recorded, not fixed.

## Reasoning

Recorded in full in ARCHITECTURE.md §1 (why the tree cannot complete the company-over-product inversion while inside a product repository), §2 (six challenges to the original brief and what changed), §6 (the storage finding: 54% of the Founder Library directory was generated HTML committed alongside its own source), and §15 (the adversarial review record, including what was challenged and deliberately left unchanged).

## Consequences if ratified

- New repositories inherit per §0.1, scoped by repository class.
- Changes to the architecture become Corporate decisions superseding this one.

## Consequences if not ratified

The tree remains as built and usable, but carries no governing authority — and per Founder Library Volume 0's status definitions, a Draft may not be cited as a company commitment.

## Open

1. **Extraction to a dedicated repository is the highest-priority follow-up.** Until it happens, the CreditVector application repository remains the de facto company root — the exact inversion this architecture was written to correct. Use the corrected procedure in §10.3; the obvious `git subtree split` command silently discards the corpus's authoring history, which adversarial review reproduced.
2. **Publishing toolchain self-sufficiency** (§13.8). Until it lands, §5's rule that a projection may never be the only surviving copy is being violated by the company's own builder, and the 2026-07-27 release snapshot must not be removed.
3. **The repository-partition decision** (§5.1 rule 4). Whether Restricted corporate material shares one permission boundary with an investor-facing corpus is due **at** extraction, not after.
4. **Off-repository durability** (§13.9) and **a stable document identifier** (§13.10). Both are cheap now and expensive later.

---

*Recorded under [Knowledge Architecture 1.0](../../ARCHITECTURE.md). This decision is Proposed and has not been ratified.*
