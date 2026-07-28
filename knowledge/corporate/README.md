# Corporate — Domain

## Purpose

The company as an institution. Everything recording **what Gabriel Capital Labs decided, committed to, or is bound by** — as distinct from what it reasons (Founder Library), what it has learned from outside (Research), how it builds (Engineering), or how its products work (Products).

This is the domain a successor reads to understand what the company actually is, and what it has already settled.

## Canonical files

Every `.md` file in this tree. Subdirectories:

- `constitution/` — the company's founding governance
- `decisions/` — founder ratifications and Corporate decisions, numbered and dated
- `board/` — board materials and minutes
- `strategy/` — corporate strategy and long-range direction
- `operations/` — how the company runs
- `people/` — hiring, roles, succession
- `finance/` — corporate financial records
- `policies/` — binding company policy
- `letters/` — annual letters

**⚠ These subdirectories are declared destinations, not yet populated.** Corporate-domain material currently lives in `.ai/` (`VISION.md`, `MOAT.md`, `ROADMAP.md`, `business-intelligence/METRICS.md`, `platform/`) and **`.ai/` remains canonical for it** until the partition in Architecture §10.4 runs. Do not begin copying that material here — move it or leave it, never both. Two declared homes is the failure this architecture exists to prevent.

## Received and executed originals

This domain holds the one class of artifact that is **canonical in a format other than Markdown**: signed board consents, executed contracts, counsel memos, audited financials, regulator correspondence. They are authored outside the company or bear a signature, have no Markdown source, and are never regenerated.

Each is committed in its native format with a companion Markdown **index card** — counterparty, date, effective term, one-paragraph summary, SHA-256 digest — so the corpus stays greppable and the original stays verifiable. Architecture §6.3.1.

## Generated artifacts

None. Nothing in this domain is generated. (Received originals are not generated artifacts — see above.)

## Ownership

**Domain:** Corporate. **Owner:** Founder, and the Board once one exists.
**Classification:** Mixed, and this is the domain where it matters most. `board/`, `finance/`, `people/`, and counsel correspondence are **Restricted**. `letters/` and ratified `policies/` may be Public. Every document declares its class; absent a declaration, treat it as Internal (Architecture §5.1).

## Rules

1. A decision recorded here is a **decision**, not a technical fact and not a legal conclusion (Architecture §5, rank 3).
2. Every decision carries: date, authority, scope, and what it supersedes.
3. A Corporate decision that has engineering consequences is a decision **to be taken through** engineering governance — never one already taken there.
4. Decisions are amended in numbered revisions, never silently replaced.
5. Superseded decisions are retained and marked. They are archived only once they are no longer consulted; a decision still cited as the reason for something is active, whatever its status. Never deleted — the sole exception being a Compelled Removal (Architecture §8.1).
6. **Identifiable personal data does not belong in this tree.** `people/` holds roles, structure, and succession — not personnel files. Anything that would make a lawful erasure request bite belongs in a system with its own retention schedule (Architecture §5.1 rule 5).

## Version policy

Decisions are immutable once ratified. A changed position is a **new** decision that supersedes the old one by number. Presentation changes advance no version.

## Do not

- **Do not** delete or edit a ratified decision. Supersede it.
- **Do not** record engineering decisions here — those belong in the repository's engineering record.
- **Do not** treat a Draft as a commitment.
- **Do not** state legal conclusions. Counsel governs; this domain records commercial and governance intent.

---

*Governed by [Knowledge Architecture 1.0](../ARCHITECTURE.md). Changes to the architecture are Corporate decisions.*
