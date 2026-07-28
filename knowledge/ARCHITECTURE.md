# Gabriel Capital Labs
# Knowledge Architecture 1.0

**Version:** 1.0
**Status:** Draft — reviewed, not ratified
**Date:** 2026-07-28
**Scope:** The governing standard for how Gabriel Capital Labs organizes institutional knowledge, in this repository and in every future repository the company creates.
**Review:** Adversarially reviewed before first commit — 59 findings, 24 confirmed, 35 refuted. Record and disposition in §15.

---

## 0. What this document is

This is not a folder convention. It is the company's **institutional knowledge architecture** — the rules determining where knowledge lives, who owns it, what is canonical, what is derived, what may be changed, and what may never be.

It is designed to hold for **10–20 years**, across products that do not yet exist and people who have not yet been hired.

**It governs future repositories as much as this one** — but not identically, and the difference is load-bearing. See §0.1.

### 0.1 Inheritance is scoped by repository class

There are two classes of repository, and only one of them materializes the full domain tree.

| Class | Inherits | Materializes |
|---|---|---|
| **The knowledge repository** (one, company-wide) | §4, §5, §7, §8, §9 in full | Every domain in §4 |
| **An application repository** (many: CreditVector, GIOS, GTG Quant, …) | §5 (truth hierarchy), §8 (archive), §9 (README standard), and **only the Engineering row of §4** | Its own engineering record, in place. **It does not create `corporate/`, `founder-library/`, `research/`, or `products/` locally.** It registers itself as one directory under `engineering/repositories/`. |

Stated plainly because it is the thing most likely to be misread by someone applying this standard to a new repository in five years: **an application repository that materializes the company's domain tree inside itself has violated §3 principle 1, not complied with §4.** Four of the five domains exist exactly once, company-wide. Engineering is the only per-repository domain, by §2.5.

---

## 1. The finding that shaped the design

The brief asked for an architecture in which *products live under the company, not the other way around.*

**That inversion cannot be completed inside this repository, and attempting it would make the problem worse.**

This repository — despite being named `gabriel-capital-labs` — **is the CreditVector production application.** It contains `app/`, `lib/`, `prisma/`, and a `vercel.json` that deploys to creditvector.app on every push to `main`. It is a product, wearing the company's name.

Placing company-wide knowledge — GIOS strategy, GTG Quant, board records, corporate finance — inside it would:

1. **Complete the inversion rather than correct it.** The CreditVector repo would become the de facto company root, which is the exact condition the brief asks to fix.
2. **Couple institutional memory to a product's deploy lifecycle.** Company records would live behind a Vercel build that fires on every push.
3. **Force unrelated products to depend on a credit product's repository** for their own documentation.
4. **Give the company's permanent record the retention characteristics of an application repo** — which is rewritten, refactored, and occasionally abandoned.

**The architecture therefore specifies a dedicated company knowledge repository, and materializes it here in an extraction-ready form.**

The tree under `/knowledge/` is **self-contained**: it references no application code, is referenced by no application code, and has no build coupling. It is designed to be lifted out with history intact by a single command (§10.3) the moment the owner creates the destination repository.

Until that happens it is safe where it is, and it is correct where it is going.

---

## 2. Challenges to the brief, and what changed

The brief asked to be challenged. Five changes were made, each for a stated reason.

### 2.1 "Publication Truth" is not a knowledge domain — it is a pipeline stage

The brief lists Publication as a domain alongside Engineering, Founder, Research, Corporate. But a published document is a **projection of a domain**, not a domain of its own. Treating it as one guarantees the duplication the brief forbids: a Founder Library volume would exist as knowledge in Founder and again as a publication in Publication.

**Change:** Publications are **outputs**, not knowledge. They live in `releases/`, carry no independent authority, and are produced by the pipeline in §7.

### 2.2 "Historical Truth" is not a domain — it is a lifecycle state

Any artifact from any domain can become historical. If Archive is a domain, a retired ADR exists in both Engineering and Historical, and the two will diverge.

**Change:** Archive is an **append-only lifecycle state** (§8) that any domain's artifacts enter. A document is in exactly one domain and in exactly one of two states: active or archived.

### 2.3 "Business Truth" and "Corporate Truth" are the same domain

The brief lists both, then assigns strategy, roadmaps, finance, and operations to Corporate — leaving Business with no distinct content. Two domains with an undrawable boundary produce filing disputes forever.

**Change:** Merged into **Corporate**. Market-facing analysis is not a domain either — it is Research (evidence) feeding the Founder Library (argument).

### 2.4 A "Products" domain is required, and the brief omits it

The brief has Engineering and Founder Library, but a product generates knowledge that is neither: support playbooks, user documentation, operational runbooks, product decisions that are not architectural.

**Change:** **Products** is a first-class domain, partitioned per product, so the next product slots in without touching anything.

### 2.5 Engineering truth must be referenced, never copied

The brief asks the architecture to support multiple repositories. The instinct is to gather engineering documentation centrally. That would create a second copy of every ADR, guaranteed to drift from the repository it describes.

**Change:** `engineering/repositories/<repo>/` holds a **pointer and an index** — never a copy. Canonical engineering truth stays inside the repository it governs, where the code, the tests, and the review gates that enforce it also live.

### 2.6 One further change: HTML must stop being committed

Not raised in the brief, but the largest storage finding in the current corpus (§6).

---

## 3. Core principles

1. **One canonical copy.** Every fact has exactly one home. Everything else references it.
2. **Markdown is truth; everything else is a projection.** §5.
3. **Domains are mutually exclusive.** If a document could live in two domains, the domain boundary is wrong — fix the boundary, not the document.
4. **Reference across domains; never copy across them.**
5. **Derived artifacts are not committed by default.** They are built. §7.
6. **Archive is append-only.** Nothing in it is ever modified or deleted. §8.
7. **Every directory explains itself.** §9.
8. **The architecture assumes multiple repositories and multiple products from day one.**
9. **Human-readable and machine-readable are the same requirement.** Deterministic paths, stable names, predictable front matter — a person and an automated agent navigate identically.
10. **Nothing is deleted.** Superseded or archived, never removed. The single exception is **Compelled Removal** (§8.1) — and a Compelled Removal is itself recorded, so even the removal is part of the record.
11. **Classification is a property of every artifact, not of the tree it sits in.** §5.1.

---

## 4. Knowledge domains

**Five domains. Mutually exclusive, jointly exhaustive.** Plus three cross-cutting mechanisms that are explicitly *not* domains.

| Domain | Holds | Owner | Canonical location |
|---|---|---|---|
| **Corporate** | The company as an institution: constitution, founder decisions, board, strategy, operations, people, finance, policies, annual letters | Founder / Board | `knowledge/corporate/` |
| **Founder Library** | The published intellectual corpus — Books and Volumes | Founder (Editor-in-Chief) | `knowledge/founder-library/` |
| **Research** | Evidence: dossiers, primary sources, benchmarks, external literature, notes | Research owner | `knowledge/research/` |
| **Engineering** | Technical truth, per repository: constitutions, ADRs, architecture, runbooks, current state | Engineering | **In each repository** — indexed at `knowledge/engineering/repositories/<repo>/` |
| **Products** | Product knowledge that is neither company reasoning nor engineering: user documentation, support and billing playbooks, product decisions that are not architectural | Product owner | `knowledge/products/<product>/` |

**"Runbooks" belongs to Engineering only.** An operational procedure that a repository's gates, tests, or deploy path enforce is Engineering, wherever it is executed from. Products holds *playbooks* — support and billing procedures with no repository enforcement. The word appears once, on purpose: §3 principle 3 requires it.

**Cross-cutting mechanisms — not domains:**

| Mechanism | What it is | Location |
|---|---|---|
| **Shared** | Company-owned assets used by every domain: brand, legal, standards, templates, design system, publishing toolchain, media | `knowledge/shared/` |
| **Archive** | An append-only lifecycle state any domain's artifacts enter | `knowledge/archive/<year>/` |
| **Releases** | Projections (HTML, PDF, EPUB) built from canonical Markdown | `knowledge/releases/` |

### The domain test

When filing a document, ask in order:

1. Does it describe **what the company decided**? → Corporate
2. Is it a **published Volume** of the corpus? → Founder Library
3. Is it **evidence** — something observed or measured rather than decided? → Research (internal or external; a post-mortem and a competitor dossier are both evidence)
4. Does it govern **how software is built**? → Engineering (in the repository)
5. Does it describe **how a product is used or operated**? → Products
6. Is it a **rendered output**? → Releases (and it is not knowledge)
7. Is it **retired**? → Archive (retaining its original domain path)

If two answers apply, the document is doing two jobs and should be split.

---

## 5. Canonical truth hierarchy

The Founder Library already establishes an authority model in **Volume 0 §6**. This architecture **extends it rather than replacing it** — per the library's own Rule 10, a concept has one home.

**Authority, highest first:**

| Rank | Source | Governs | Note |
|---|---|---|---|
| 0 | **Law, regulation, and counsel's determination** | Any question of what is legally permitted | Outranks every company document. A policy that conflicts with statute is void, not weighed. Volume 0 already states the library's half of this: on a regulated matter a volume "describes the company's understanding, not a legal conclusion, and counsel governs." |
| 1 | **Production truth** | Any question of fact about a deployed product | What the system actually does. Cannot be overridden by any document. |
| 2 | **Engineering record** | How software is built and governed | ADRs, constitutions, in-repo. Governs engineering absolutely. |
| 3 | **Corporate record** | Company decisions, ratifications, policy | A founder ratification is a decision, not a technical fact. |
| 4 | **Founder Library** | Reasoning and position | Establishes no technical fact, product capability, or legal authority. |
| 5 | **Research** | Evidence | Carries the authority of its cited sources, not its own. |
| 6 | **Projections** | Nothing | HTML/PDF/EPUB have **no independent authority**. Markdown governs. |

**What this table does and does not order.** It orders *documents against each other* when they conflict. It never orders a document against **evidence about the world**. A Corporate ratification or a Founder Library position that is contradicted by what actually happens is wrong and gets revised — Volume 0 states this directly and it is not weakened here. Rank 1 makes the point for product facts; the same holds for every other claim about the world. Research sits at rank 5 as a *document class* whose authority is borrowed from its sources; that placement says nothing about the standing of the evidence it cites.

**Relationship to Volume 0 §6.** Volume 0 §6 maps authority *inside* the Founder Library and between the library and engineering. This table maps authority *across domains*, which Volume 0 does not attempt — it has no Corporate domain, no Research domain, and no projection class. The two are read together: the whole Founder Library occupies one row here, and its internal ordering is whatever Volume 0 §6 states at the time of reading. **This document deliberately does not restate Volume 0's intra-library layers**, because a second copy of them would be exactly the second source of truth §3 principle 1 and the library's Rule 10 forbid.

### 5.1 Classification

Authority answers *which document wins*. Classification answers *who may read it* — an orthogonal dimension, and one the truth hierarchy cannot supply.

One tree is designed to hold the Founder Library (written for investors, advisors, and attorneys) alongside `corporate/board/`, `corporate/finance/`, and `corporate/people/`. Those are not the same readership, and §10.3 turns the tree into a single repository with a single permission boundary.

| Class | Meaning | Examples |
|---|---|---|
| **Public** | Publishable without further review | Released Founder Library volumes, marketing standards |
| **Internal** | Anyone at the company | Architecture, product knowledge, most Research |
| **Restricted** | Named roles only | Board materials, finance, people, counsel correspondence |

**Rules:**

1. **Every canonical document declares a class.** Absent a declaration, treat it as Internal — never as Public.
2. **A directory's class is the highest class of anything in it.** Classification does not dilute by aggregation.
3. **Restricted material does not travel into a Public projection.** The release pipeline (§7) may only project Public and Internal sources.
4. **The partition decision is due at extraction, not after** (§10.3). Splitting a repository after a decade of history is the expensive version of this decision; declaring the boundary before the first Restricted document lands is the cheap one.
5. **Identifiable personal data does not belong in this tree at all.** It belongs in a system with its own retention schedule and access controls. This removes most of the exposure rather than managing it — see §8.1.

**The format hierarchy, stated as the brief requires:**

```
Markdown   →  CANONICAL SOURCE      (edited, reviewed, versioned, committed)
    ↓
HTML       →  PUBLICATION PROJECTION (generated; committed only at a release)
    ↓
PDF/EPUB   →  RELEASE ARTIFACT       (generated at a version boundary; never edited)
```

**Three rules follow, and they are absolute:**

- **Never edit a projection.** A defect in HTML is a defect in the Markdown or the builder.
- **Never maintain two canonical copies of anything.** If a fact appears twice, one occurrence is a reference or one is wrong.
- **A projection may never be the only surviving copy.** If Markdown is lost and only a PDF remains, the knowledge has been downgraded to an artifact.

---

## 6. Storage architecture

### 6.1 What was measured

| Location | Size | Nature |
|---|---:|---|
| `.ai/` (engineering truth) | 1.5 MB | Canonical Markdown |
| `founder-library/` | 804 KB | **364 KB canonical Markdown + 424 KB generated HTML + 12 KB builder** |
| `architecture/` | 60 KB | Canonical Markdown |
| `docs/` | 24 KB | Canonical Markdown |
| Root loose `.md` | ~60 KB | Mixed, legacy |
| `.git` (whole repo) | 3.5 MB | Full history |

### 6.2 The finding

**54% of the Founder Library directory is generated HTML committed alongside the Markdown it was generated from.**

This is not merely redundant. It is the compounding kind of waste:

- Every regeneration writes a **new git blob**. The HTML for one volume is ~90 KB; a volume revised ten times over a decade leaves ~900 KB of dead projections in history, permanently.
- Text is highly compressible and diffs well. Generated HTML diffs badly — a builder change alters every line of every file at once.
- The projections are **designed to be reconstructible** from canonical Markdown. Storing a reconstructible artifact in permanent history is paying rent on something free.

**⚠ Reconstructibility is a design intent, not a present fact.** Adversarial review established that the current builder cannot regenerate an edition unaided: it requires a `<head>`/stylesheet template that exists in no tracked source file, and it reads a committed release artifact to recover the inline JavaScript. Both survive **only inside a projection** — which breaches §5's absolute rule that *a projection may never be the only surviving copy*, and does so in the architecture's own toolchain. The per-volume build parameters are likewise recorded nowhere.

This does not overturn §6.3: the other two reasons above are independent and sufficient, and the release snapshot that currently holds those assets is protected by the immutability rule rather than threatened by it. But **§6.3's default must not be enforced against a domain until reconstructibility is real for that domain** — see §6.3's precondition. Tracked as the highest-priority toolchain debt (§13.8).

### 6.3 The policy

| Class | Committed? | Rule |
|---|---|---|
| Canonical Markdown | **Yes** | The knowledge. Always tracked. |
| Generated HTML | **No, by default** | Built on demand. Committed **only** into `releases/` when a version is cut. |
| PDF / EPUB | **No** | Generated at release. Attached to a tag, or committed once into `releases/` and never regenerated in place. |
| Build caches, temp files | **Never** | `.gitignore`. |
| Media (images, video) | **By reference** | Registered in `shared/media/REGISTRY.md` with provenance and size. Binaries only where genuinely required. |
| **Received or executed originals** | **Yes** | A fourth format class — see below. Committed in native format, never regenerated. |

**Precondition on the "no generated HTML" default.** It applies to a domain only once that domain's projections are genuinely reconstructible: every build input tracked as canonical source, build parameters recorded in a manifest, and one existing edition rebuilt and diffed against its committed artifact. Until then the domain's last good release snapshot stays committed, because §5's rule against a projection being the only surviving copy outranks the storage saving. The Founder Library is in exactly this state today (§6.2).

### 6.3.1 Received or executed originals

Some of the company's most important records are **not projections of anything.** A signed board consent, an executed contract, a counsel memo, an audited financial statement, a regulator's letter: authored outside the company or bearing a signature, native to their format, with no Markdown source and none reconstructible. The signature or the letterhead *is* the load-bearing part.

Adversarial review found that §3 principle 2 ("Markdown is truth") could be read as excluding them. It does not. **The Markdown-is-truth rule governs knowledge the company authors.** A received or executed original is a fourth class alongside Canonical / Projection / Release:

1. It is **canonical in its native format**, and outranks any Markdown transcription of it.
2. It is **never regenerated** and never edited. What arrived is what is kept.
3. It carries a **companion Markdown index card** — counterparty, date, effective term, one-paragraph summary, SHA-256 digest of the original — so the corpus stays greppable and the original stays verifiable.
4. §5 rank 6 ("Projections — no independent authority") applies to **generated** projections only. It has never applied to these.
5. Most of this class is **Restricted** under §5.1. Classification is declared on the index card.

**The releases rule:** a release directory is written **once** and thereafter treated as archive. A new build produces a **new** release directory. Projections are never regenerated in place, which is what keeps history from accumulating dead blobs.

### 6.4 Estimate and 20-year projection

**Today.** The knowledge repository itself holds ≈ **400 KB** of canonical Markdown (the migrated Founder Library plus the READMEs), and one committed release snapshot at **425 KB** — measured, 424,978 bytes across five HTML files, i.e. ~85 KB per volume. Engineering truth (`.ai/`, `architecture/`, ≈ 1.6 MB) is **not** part of this total: §4 locates it in each application repository, and it stays there. Company-wide canonical Markdown across all repositories ≈ **2.0 MB**.

**Projection to 2046**, assuming the corpus grows 10× — 7 volumes → ~70 documents of comparable weight, plus corporate, research, and product knowledge:

| Component | 2046 estimate | Basis |
|---|---:|---|
| Canonical Markdown, knowledge repo | ~4 MB | 400 KB × 10 |
| Git history | ~8–12 MB | Measured pack ratio on this repo is ~0.5× working tree for text; 3× is used here as a deliberately pessimistic bound |
| Release artifacts | **~120 MB** | ~85 KB/document × 70 documents = ~6 MB per full snapshot, × ~20 versions |
| **Total** | **~130–150 MB** | |

**This corrects an arithmetic error found in adversarial review.** The earlier figure (70–90 MB) held the release line at today's 425 KB per snapshot while applying a 10× multiplier to the corpus in the line above it — releases were undercounted ~12×. Founder Library Permanent Rule 2 applies to this document's own numbers: a number without a source is a defect.

**The conclusion survives the correction.** ~150 MB is still a small repository by any standard, and still far below the **500 MB–1 GB** the naive policy would produce, because release snapshots are cut at version boundaries rather than written on every build. The corrected figure changes no decision in this architecture — but §8 rule 5 cites it, so it needs to be right.

**Two caveats on the release line.** It assumes one full snapshot per version; if PDF and EPUB are also committed rather than attached to a tag, multiply it. And it is the line that grows — so it is the line to watch, not the Markdown.

**The genuine storage risks are not text.** They are: media binaries, committed PDFs, regenerated HTML, and vendored dependencies. The policy above addresses all four.

---

## 7. Publishing pipeline

```
  knowledge/<domain>/**.md            CANONICAL — the only edited artifact
            │
            │  shared/publishing/build_edition.py
            ▼
  build/ (gitignored)                 WORKING PROJECTION — transient, never committed
            │
            │  release cut: version assigned, snapshot written once
            ▼
  knowledge/releases/<domain>/<version>/    RELEASE ARTIFACT — immutable
            │
            └─→ PDF / EPUB generated from the same source, same version
```

**Rules:**

1. **The builder never modifies canonical Markdown.** It reads and emits. A builder that edits its source is a defect.
2. **Text parity is verified, and the verification is recorded.** A release states that the projection's text matches its source *and* commits the evidence — a `MANIFEST` of SHA-256 digests for each source and each artifact. A parity claim with no digest is unfalsifiable, which is the same as unverified. Note that parity is a comparison between two committed files: it can be re-checked in 2046 with no builder at all.
3. **A projection carries its provenance** — source path, source version, build date, **and the builder version that produced it** — so an artifact found alone can be traced back and a rebuild can be attempted with the right tool.
4. **Presentation changes advance no document version.** Established in Founder Library Volume 0 §Versioning; adopted architecture-wide.
5. **One builder, all domains.** The toolchain lives in `shared/publishing/` because it belongs to the company, not to any domain.
6. **The builder is standard-library only, and makes no network calls.** No third-party runtime dependencies, no CDN fonts, no remote assets — at build time or in the emitted artifact. The current builder satisfies this by luck; the rule is what makes it survive a future contributor. A toolchain that needs a package index to run is a toolchain that stops running.
7. **Every build input is a tracked canonical file.** The builder may not read a release artifact, a working directory, or anything outside `shared/publishing/` and the canonical source. Its parameters live in a tracked manifest, not in a shell command someone typed once. (Not yet satisfied — §6.2, §13.8.)

---

## 8. Archive policy

**The archive is append-only. Nothing inside it is ever modified, and nothing is ever deleted.**

### What enters

- Documents retired, with no successor — an abandoned direction, a document whose subject no longer exists
- Milestone snapshots (freezes, structural changes)
- Ratifications and decisions that are no longer consulted

**What does *not* enter, and why:**

- **Superseded documents that are still consulted.** Volume 0 defines Superseded and Archived as distinct statuses: a Superseded document "remains readable, remains part of the record," because it is the primary evidence of what the company believed before it changed its mind. Rule 4 below is the operative gate — if it is still consulted, it is active. Volume 0 governs this vocabulary; this section does not redefine it.
- **Release artifacts.** A release is archival in *status* from the moment it is written (§6.3) but it **never relocates**. It stays at `releases/<domain>/<version>/` forever. Moving it would break every citation pointing at it, to achieve nothing.

### How

```
knowledge/archive/<year>/<domain>/<original-path>
```

The original path — meaning **the path the document occupied in the active tree at the moment it was archived** — is preserved inside the archive, so a document's provenance is legible from its location alone. A 2026 Founder Library volume archived in 2031 lands at `archive/2031/founder-library/books/book-01-foundation/VOLUME-...md`.

**Collision.** Two documents can archive to the same path in the same year — most likely a `README.md`, which §9 makes the most common filename in the tree. When the destination is occupied, append a disambiguating segment: `<original-path>` becomes `<dirname>/<YYYY-MM-DD>-<slug>/<filename>`. Writing a new, differently-named entry is an **append** and is fully permitted; rule 1 constrains what may be done to entries already written, not whether a new one may be created. Never resolve a collision by overwriting.

### Rules

1. **Append-only.** Write once. Never edit, never delete, never reorganize.
2. **Every archived document carries a header note**: date archived, reason, superseding document if any, who authorized it, and its **path history** — where it lived before, so a reference written against an older path can still be resolved.
3. **Archiving is an event and is logged** in the domain's revision log.
4. **Archive is never the working copy.** If a document is still consulted, it is not archived — it is active.
5. **Retention is permanent.** The company does not prune its own history. Storage is not the constraint (§6.4); institutional memory is the asset. The one exception is §8.1, and it is not discretionary.

### 8.1 Compelled Removal — the only exception

A permanence rule with no lawful exit is not a strong rule. It is a rule that will be broken quietly the first time it is tested, which discredits everything around it. So the exception is named, narrow, and audited.

**Compelled Removal** applies in exactly four cases, and no others:

1. A **legally mandated erasure** the company is obliged to honor (e.g. a valid statutory erasure right, where no legal-obligation or legal-claims exemption applies).
2. A **court order** or binding regulatory directive.
3. A **secret committed in error** — a credential, key, or token — where revocation alone is insufficient and the value must leave the history.
4. **Material published in error** that the company is legally required to retract.

**How it is executed:**

- **Only on written authorization** from the founder, on counsel's determination that the obligation is real. It is a rank-0 matter under §5 — law, not policy.
- **A tombstone is written and is permanent**: what was removed, from where, on what date, under what legal basis, and on whose authority. The tombstone never says what the content was where saying so would defeat the removal. **The removal itself becomes part of the record** — which is how a permanence rule survives having an exception.
- **Nothing else moves.** A Compelled Removal is the narrowest excision that satisfies the obligation.

**The structural mitigation matters more than the procedure.** Per §5.1 rule 5, identifiable personal data does not belong in this tree. Most of what would ever trigger case 1 should never have been here. The exception exists so that lawful compliance is not a governance violation — not so the tree can hold material it should not.

---

## 9. README standard

**Every directory at depth ≤ 3 carries a `README.md`.** Deeper directories carry one when their contents are not self-evident.

Required sections, in this order:

```markdown
# <Directory Name>

## Purpose
One paragraph. What knowledge lives here and why it exists as a separate place.

## Canonical files
What in this directory is the source of truth. Exhaustive.

## Generated artifacts
What here is derived, what produced it, and where the canonical source is.
State "None" explicitly if there are none.

## Ownership
Which domain this belongs to, who owns it, and its **classification** (§5.1:
Public / Internal / Restricted). Absent a declaration, treat it as Internal.

## Rules
Local rules beyond the architecture. Numbered.

## Version policy
How things here are versioned, and what does NOT advance a version.

## Do not
Explicit prohibitions. The most important section — it is what a future
maintainer reads before doing something irreversible.
```

**Why "Do not" is mandatory:** every other section describes intent, which a reader can infer. Prohibitions cannot be inferred, and they are what prevent the irreversible mistake.

---

## 10. Migration

### 10.1 What moved

**Only the Founder Library.** It was verified safe first: `founder-library/` is referenced by **zero** files in `app/`, `lib/`, `components/`, `scripts/`, or any config — a repository-wide search across TS, TSX, JS, and JSON returned no hits. The Vercel build command (`prisma generate && next build`) does not touch it.

Moved with `git mv` rather than copied — so the files carry one identity, not two.

**Stated precisely, because the imprecise version caused a defect.** `git mv` stores no rename record. It preserves history as a **query-time heuristic**: `git log --follow` resolves across the rename *inside this repository*. That heuristic does not survive a repository boundary, which is why §10.3 had to be rewritten. What is preserved in this repository: full history, resolvable with `--follow`. What is not automatic: history at extraction — see §10.3.

### 10.2 What deliberately did NOT move

**Engineering truth stays exactly where it is.** `.ai/` and `architecture/` are:

- Hard-coded in `CLAUDE.md` as the mandatory session startup sequence
- **Referenced by executable guard scripts** (`scripts/quality-ledger.test.ts`, `scripts/eng-ops.test.ts`) that would fail on a path change
- Governed by the engineering review gate, which this architecture does not outrank (§5, rank 2)

Moving them is a **repository-structure change requiring owner approval and a green guard suite**. It is specified in §10.4 as a runbook and is not executed here.

**Also unmoved:** `app/`, `lib/`, `components/`, `prisma/`, `scripts/`, `public/`, `config/`, and root legacy Markdown. None is knowledge in this architecture's sense; the legacy root Markdown is a separate cleanup with its own risk profile.

### 10.3 Extraction to a dedicated repository

**⚠ The obvious command is wrong. Adversarial review reproduced the failure; this section records the corrected procedure.**

`git subtree split --prefix=knowledge` selects commits by whether they touched that path. **Every commit that authored Volumes 0–6 touched `founder-library/`, not `knowledge/`** — so the split silently yields a branch containing only the migration commit. Verified independently by four reviewers in scratch repositories reproducing this exact migration shape: source history 4–5 commits, extracted branch **1**. No error, no warning, plausible-looking output. The founder ratifications would exist in the new repository as file content with no commit-level attestation of when or by whom they were recorded.

**The corrected procedure.** Use a rename-aware history rewrite, against a **fresh mirror clone**, never the working repository:

```bash
git clone --mirror /path/to/this/repo /tmp/knowledge-extract && cd /tmp/knowledge-extract

git filter-repo \
  --path knowledge/ \
  --path founder-library/ \
  --path-rename founder-library/:knowledge/founder-library/
```

**The extraction is not complete until this gate passes.** It is a required step, not a recommendation:

```bash
# 1. Commit count must not regress against the corpus's real history.
git rev-list --count HEAD                       # in the extract
git -C /path/to/this/repo rev-list --count HEAD -- knowledge founder-library

# 2. A volume's creating commit must be reachable in the new repository.
git log --follow --oneline -- knowledge/founder-library/books/book-01-foundation/VOLUME-00-WHY-THIS-LIBRARY-EXISTS.md

# 3. The founder-ratification commit must be present by content, not just by file.
git log --oneline --all | grep -i ratification
```

If count (1) regresses, or (2) stops at the migration commit, **stop.** The extract is wrong and rerunning the filter is free; discovering it after the source is gone is not.

**Ordering, and why it matters.** Nothing in this architecture authorizes pruning the source repository — §3 principle 10 forbids it. The history therefore remains recoverable here indefinitely, and a bad extract is a redo rather than a loss. That is the only reason this defect is HIGH and not fatal. **Do not remove `knowledge/` from this repository until the gate above has passed against the new one.**

Beyond that, nothing changes. No application code references `knowledge/`, so its eventual removal from this repository is the removal of a directory with no dependents.

### 10.4 Deferred migrations (runbooks, not actions)

| Migration | Blocker | Required first |
|---|---|---|
| `.ai/` → **partitioned**, not moved wholesale | Guard scripts + `CLAUDE.md` reference the paths; and `.ai/` is not purely engineering | Owner approval; **a per-file domain audit first** (below); update script paths; full guard suite green; engineering review gate |
| `architecture/` → `knowledge/engineering/` | Guard scripts + `CLAUDE.md` reference the paths | Owner approval; update script paths; full guard suite green; engineering review gate |
| Root legacy `.md` → `archive/` or `products/creditvector/` | Some are user-facing and externally linked | Audit each file's readership before moving |
| `docs/` → `corporate/` | Low risk; small | Can proceed on owner instruction |

**Why `.ai/` is a partition, not a move.** Adversarial review found that `.ai/` is not solely engineering truth under this document's own §4 definitions. It also holds Shared-mechanism material (`marketing/BRAND-VOICE.md`, `creative/BRAND-UNIVERSE.md`, `DESIGN-SYSTEM.md`, `ASSET-REGISTRY.md`) and Corporate material (`VISION.md`, `MOAT.md`, `ROADMAP.md`, `business-intelligence/METRICS.md`, `platform/`). Mapping the directory wholesale to `knowledge/engineering/` would file company strategy and brand standards as engineering truth, and — because `knowledge/corporate/` and `knowledge/shared/` already declare homes for exactly that material — would create two declared homes for three domains. That is the §3 principle 1 failure this architecture exists to prevent.

**Until the partition runs, `.ai/` remains canonical for everything inside it.** The declared-but-empty `corporate/` and `shared/` subdirectories are reserved destinations, not competing sources. `knowledge/engineering/repositories/creditvector/README.md` states where truth actually lives. **Do not begin populating `knowledge/corporate/` or `knowledge/shared/` with material that duplicates `.ai/`** — move it or leave it, never both.

---

## 11. Scalability analysis

### Adding a product

Create `knowledge/products/<product>/` and `knowledge/engineering/repositories/<repo>/`. **Nothing else changes.** No existing file is edited, no path is renamed, no other product is touched. This is the test the architecture was designed against.

### Adding a repository

Add one directory under `engineering/repositories/`. Because engineering truth is referenced rather than copied, adding a repository costs a pointer, not a migration.

### Adding a knowledge domain

Deliberately hard. **Five is the intended ceiling for a long time** — the cost of a new domain is that every future filing decision acquires another branch. A new domain requires a documented argument that existing domains cannot hold the knowledge, recorded as a Corporate decision.

### Scaling the corpus

Path depth is bounded at 4–5 levels. Volume counts grow inside `books/`, which partitions naturally. Research grows inside `dossiers/`, which partitions by subject. Neither requires reorganization to scale by an order of magnitude.

### Scaling the organization

Ownership is declared per domain in each README, so a new hire's onboarding path is: read `knowledge/README.md`, read the README of the domain they own, read the Founder Library Book I. That is a bounded, deterministic onboarding — which is the actual test of a knowledge architecture.

### Automation and AI readability

Deterministic paths, stable naming (`VOLUME-NN-SLUG.md`), and mandatory READMEs mean an automated agent can locate canonical truth without heuristics. **The architecture is machine-navigable because it is human-navigable** — the same property serves both, which is why they are not separate requirements.

**The gap, stated plainly:** documents are identified by path, and §8 moves paths. A front-matter schema with a stable identifier (§13.3, §13.10) is what closes it, and it is deferred. Until then, cross-domain references are path references and will break on archival — mitigated, not solved, by §8 rule 2's path-history field.

---

## 12. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **The tree is never extracted, and the CreditVector repo becomes the company root by default** | **High** | §10.3 gives the corrected procedure. The longer extraction is deferred, the more the inversion re-establishes itself. This is the single most important follow-up. |
| **Extraction runs and silently drops the corpus's authoring history** | **High — found and corrected** | The originally-specified `git subtree split` does exactly this; reproduced by four independent reviewers. §10.3 now specifies a rename-aware filter **and a mandatory verification gate**. The residual risk is an operator running the old command from memory — which is why the failure is documented in §10.3 rather than quietly replaced. |
| **Founder Library projections are not actually reconstructible; the builder's own template and scripts survive only inside a release artifact** | **High** | Breaches §5's rule that a projection may never be the only surviving copy. §6.3's precondition keeps the last release committed until it is fixed; §13.8 is the fix. |
| **The tree holds board, finance, and people material in the same permission boundary as a corpus written for investors** | **High** | §5.1 introduces classification, and §10.3 makes the partition decision due *at* extraction — the last cheap moment to make it. |
| **A lawful deletion obligation arrives and the standard forbids compliance** | Medium | §8.1 Compelled Removal, with permanent tombstone. §5.1 rule 5 removes most of the exposure by keeping personal data out of the tree entirely. |
| **The publishing toolchain stops running and editions can no longer be produced** | Low | §7 rules 6–7: stdlib-only, no network, all inputs tracked. Canonical Markdown is readable with no toolchain at all, so toolchain rot costs typography, not knowledge. |
| **The whole institutional record is a single git repository** | Medium | Not addressed by this architecture, and named here so it is not mistaken for addressed. An off-repository durability policy — mirrors, offline copies, retention location — is required before extraction (§13.9). |
| Engineering truth stays split across two locations indefinitely | Medium | §10.4 runbook exists. Until executed, `engineering/repositories/creditvector/README.md` states plainly where truth actually lives. |
| Domain boundaries get litigated in practice | Medium | §4's ordered domain test resolves most cases mechanically. Disputes are Corporate decisions, recorded. |
| Projections get committed anyway, out of convenience | Medium | `.gitignore` covers `build/`. The releases rule (§6.3) is the enforcement point. |
| READMEs go stale and become misleading | Medium | Staler than no README is worse than none. Reviewed at each release. |
| Archive is treated as a wastebasket | Low | §8 rule 4: if it is still consulted, it is not archived. |
| Migration breaks the production build | **Low — verified** | Only the Founder Library moved; it has zero references in application code or build config. Verified before the move, not after. |

---

## 13. Recommended improvements beyond the brief

1. **Extract to a dedicated repository (highest priority).** Everything in this architecture is correct and incomplete until this happens. §10.3.
2. **Stop committing HTML** — policy set here, and **conditioned on item 8**. The single largest storage decision in the design. It does not take effect for a domain until that domain's projections are genuinely reconstructible (§6.3's precondition), which for the Founder Library they are not yet.
3. **A front-matter schema** for canonical documents (version, status, date, owner, domain, supersedes) so the corpus becomes queryable rather than merely readable. Deferred: it should be designed once, against real documents, rather than guessed at now.
4. **A link checker in CI** for the knowledge tree. The Founder Library's own audits found nine mis-citations in a single volume — cross-reference integrity is the corpus's demonstrated weak point, and it is mechanically checkable.
5. **A `CITATION.md` convention** so external readers can cite a Volume stably across revisions.
6. **Separate the media budget explicitly.** Text will never threaten this repository; media will. A registry with size limits, before the first large binary arrives, is cheaper than a cleanup after.
7. **An annual archive ceremony** — one scheduled pass per year that moves retired material into `archive/<year>/`. Archives that depend on someone remembering do not happen.
8. **Make the publishing toolchain self-sufficient (highest toolchain priority).** Extract the `<head>`/stylesheet into a tracked `shared/publishing/head.html`, extract the inline JavaScript into a tracked `shared/publishing/edition.js`, record per-volume build parameters in `shared/publishing/editions.json`, and prove it by rebuilding one existing edition and diffing its text against the committed artifact. Until this lands, §6.3's default cannot be enforced against the Founder Library and §5's "never the only surviving copy" rule is being violated by the company's own toolchain. §6.2.
9. **An off-repository durability policy.** Everything here assumes one git repository survives. That assumption is unstated and unexamined — §12 now names it. Mirrors, an offline copy cadence, and a stated retention location are cheap; reconstructing an institutional record is not.
10. **A stable document identifier, decided before extraction.** Paths are currently the only identifier, and §8 moves paths. Cross-domain references therefore break exactly when a document is archived — the moment its history matters most. §13.3's front-matter schema is deferred on the reasonable ground that it should be designed against real documents; **the identifier is the part that cannot be retrofitted cheaply** and should be settled first. Interim mitigation: §8 rule 2's path-history field.
11. **A minimum release cadence.** Nothing currently requires a canonical document ever to receive a projection — Volumes 1 and 2 have none today. This is not a knowledge risk (Markdown is the durable readable form; §5 rank 6 is deliberate), but a stated cadence turns an accident into a decision.

---

## 14. Governing status

This document is intended as the **governing standard for every future project created by Gabriel Capital Labs**, inherited per the repository-class rule in §0.1 — the full tree by the knowledge repository, §5/§8/§9 and the Engineering row of §4 by an application repository.

Changes to this architecture are **Corporate decisions**, recorded in `knowledge/corporate/decisions/`, and follow the same rule as the Founder Library: amended in versioned revisions, never silently replaced.

**Status is Draft.** It has not been ratified. Per Founder Library Volume 0's status definitions, a Draft represents the author's considered position and may not be cited as a company commitment until ratified. Until then the tree is usable and carries no governing authority — the condition `CD-001` already states.

---

## 15. Review record

This document was subjected to an adversarial review before its first commit: five independent architects reviewing from different perspectives — structural integrity, migration safety, storage and durability, governance coherence, and onboarding — with every finding then re-tested by an independent verifier instructed to refute it.

**59 findings raised. 24 survived verification. 35 were refuted.** The refutation rate is the point: a review that confirms everything it finds has verified nothing.

### What changed as a result

| Finding | Severity | Where addressed |
|---|---|---|
| The §10.3 extraction command discards the corpus's authoring history — reproduced empirically | High | §10.1, §10.3 rewritten with a verification gate |
| Projections are not reconstructible; builder inputs survive only inside a projection | High | §6.2, §6.3 precondition, §7 rules 6–7, §13.8 |
| No confidentiality or classification dimension anywhere | High | §5.1, §9, §10.3 |
| "Nothing is deleted. Ever." has no lawful-erasure exit | High → Medium | §3 principle 10, §8.1 |
| No rank for legal or regulatory authority | Medium | §5 rank 0 |
| No format class for received or executed originals (signed contracts, counsel memos) | Medium | §6.3.1 |
| `knowledge/README.md` missing — §9 violated at the root; §11's onboarding path pointed at a nonexistent file | Medium | File created |
| `.ai/` mapped wholesale to Engineering, though it holds Corporate and Shared material | Medium | §10.4 partition note |
| §6.4's 20-year projection undercounted releases ~12× | Medium | §6.4 corrected to ~130–150 MB |
| Inheritance clause not scoped by repository class | High | §0.1 |
| Domain test step 3 narrower than the Research domain it routes to | Medium | §4 |
| Archive path scheme has no collision disambiguator | Low | §8 |
| Releases had two candidate permanent homes | Low | §8 "What does not enter" |
| "Runbooks" claimed by both Engineering and Products | Low | §4 |
| No builder durability constraint; parity claims stored no evidence | Low | §7 rules 2, 6–7 |
| Institutional record depends on a single git repository | Medium | §12, §13.9 |
| Document identity deferred, though it is the part that cannot be retrofitted | Medium | §13.10 |

### What was challenged and deliberately not changed

Recorded because a rejected finding that leaves no trace gets raised again every year.

- **"§5 inverts Volume 0's rule that evidence outranks ratified positions."** Refuted — the objection quoted ranks 3 and 4 with the Note column removed; those notes are the carve-out. §5 now states the document-versus-evidence boundary explicitly anyway, since the misreading was available.
- **"§5 replaces Volume 0 §6 rather than extending it."** Refuted — Volume 0 §6 is a scope map, not an ordinal ranking (it lists production truth last while declaring it highest). Importing its intra-library layers here would create the second source of truth Rule 10 forbids. §5 now says so in terms.
- **"§2.2 and §8 redefine Superseded and Archived."** Refuted — §8 rule 4's still-consulted gate already converges on Volume 0's outcome. §8's "What enters" list was tightened regardless, so the reading is no longer available.
- **"An unratified Draft cannot claim present-tense governing authority."** Refuted — §14 concedes exactly this in its next sentence, and `CD-001` pre-states the condition. Language softened to conditional anyway; the substance stands.
- **"Requiring a committed projection for every ratified document."** Rejected as a *fix*, not merely refuted: it would make an authority-less artifact a gate on ratification, inverting §2.1 and partially undoing §6.3. Markdown is the durable readable form.
- **"§2.5 cannot hold cross-repository platform law."** Refuted — GIOS's constitution lives in the GIOS repository once it exists; today's placement is the transitional condition §1 describes, and `engineering/repositories/gios/` already reserves the pointer.

**None of this makes the document ratified.** It makes it reviewed.
