# Founder Library — Revision Log

The Founder Library is versioned documentation. Volumes evolve through revisions, never replacement. This log records status, founder ratifications, revisions made and pending, observations carried forward, and open items.

Governing rules are in **[Volume 0 — Why This Library Exists](VOLUME-00-WHY-THIS-LIBRARY-EXISTS.md)**. In summary:

- A published volume is never overwritten to fix a downstream inconsistency. The inconsistency is logged here and resolved in a numbered revision.
- Major version = the position changed. Minor version = corrected, clarified, or reconciled. **Presentation-only work advances no version.**
- Nothing is deleted. Superseded text is retained and readable.
- Founder ratifications are decisions, recorded separately from editorial items.

---

## Volume status

| # | Volume | Version | Status | Last change |
|---|---|---|---|---|
| 0 | [Why This Library Exists](VOLUME-00-WHY-THIS-LIBRARY-EXISTS.md) | 1.0 | Draft | 2026-07-27 — created |
| 1 | [Executive Summary](VOLUME-01-EXECUTIVE-SUMMARY.md) — CreditVector | 1.0 | Draft | 2026-07-27 — created; text unchanged since |
| 2 | [Gabriel Capital Labs](VOLUME-02-GABRIEL-CAPITAL-LABS.md) | 1.0 | Draft | 2026-07-27 — created; prose tightened pre-publication |
| 3 | [The Financial Trust Problem](VOLUME-03-THE-FINANCIAL-TRUST-PROBLEM.md) | 1.0 | Draft | 2026-07-27 — created |
| 4 | [The CreditVector Solution](VOLUME-04-THE-CREDITVECTOR-SOLUTION.md) | 1.0 | Draft | 2026-07-27 — created |
| 5–12 | See Volume 0 §Current Library Index | — | Planned | — |

---

## Founder ratifications

Decisions formally adopted by the founder. These state the company's position. Per Volume 0 §Document Authority and Scope, a founder ratification recorded here governs **Founder Library and brand-positioning purposes only** — it does not alter engineering governance or production truth.

### FR-001 — Canonical positioning

**Ratified:** 2026-07-27 · **Authority:** Founder · **Scope:** Founder Library and future brand positioning

| Layer | Canonical description |
|---|---|
| **Company** — Gabriel Capital Labs | *Gabriel Capital Labs builds intelligent operating systems for domains where being wrong is expensive.* |
| **Foundational OS** — GIOS | *GIOS is the constitutional operating system for trustworthy intelligence.* |
| **Flagship product** — CreditVector | *CreditVector is the Financial Trust Operating System.* |

**Supporting marketing descriptor**, permitted selectively in explanatory or marketing contexts: *An intelligent financial trust platform.*

**Constraints adopted with this ratification:**

1. **"AI-powered" is not part of CreditVector's permanent canonical identity.** It may not be used as the governing product position.
2. **The phrase "AI-Powered Financial Reputation Platform" is retired as the governing product position** for Founder Library and future brand-positioning purposes.
3. **The historical record is preserved.** Prior positioning language is not deleted or silently rewritten. It is recorded below and remains readable in its original locations.

**Resolves:** the open positioning item raised 2026-07-27 during Volume 1 authoring and restated in Volume 2. That item is now closed.

#### Superseded positioning — retained for the record

The following were the prior descriptions, recorded here so the change is legible rather than invisible:

- *"AI-Powered Financial Reputation Platform"* — positioning ruled by founder under **ADR-0009**; appears in the engineering-side product record.
- *"AI-powered credit intelligence platform" / "the Bloomberg Terminal for consumer credit"* — brand-voice register.
- *"A constitutional operating platform for financial trust"* — Volume 1 §1, Draft v1.0.

These are superseded **for Founder Library positioning purposes**, not deleted.

#### ⚠️ Engineering-governance boundary — read before citing this ratification

**ADR-0009 has NOT been formally superseded in engineering governance.** No ADR process has been run, and no engineering record has been modified. What is true today:

- FR-001 governs the Founder Library and future brand-positioning work.
- ADR-0009 and the engineering product record remain **unchanged and authoritative for engineering purposes** until a repository ADR process formally supersedes them.
- Reconciling the two is **pending** and must go through repository governance when engineering work resumes. It is tracked as open item **OQ-001** below.

Per Volume 0, a founder decision recorded in this library is a decision *to be taken through* engineering governance — not one already taken there.

### FR-002 — Volume 1 preserved at Draft v1.0

**Ratified:** 2026-07-27 · **Authority:** Founder

Volume 1 remains **Draft v1.0**. It is not to be rewritten now. A controlled **v1.1** revision may later reference Volume 2's canonical definitions; the items for that revision are logged under *Pending revisions* below. Presentation work on Volume 1 (HTML editions, typesetting) continues to advance no version, per Volume 0 §Versioning.

### FR-003 — Volume 2 length is earned

**Ratified:** 2026-07-27 · **Authority:** Founder

Volume 2 remains **Draft v1.0** at its present length (~7,100 words). It is **not** to be cut to satisfy the earlier 4,000–6,000-word target stated in its assignment. The founder's reasoning: Volume 2 is a foundational company document, and its length is earned by that role.

This closes the open question of whether to trim Volume 2. The three trim passes already performed (~700 words, no arguments removed) stand as the final text.

---

## Pending revisions

### Volume 1 → v1.1 (editorial, non-blocking, authorized but not scheduled)

Logged 2026-07-27 while authoring Volume 2; extended 2026-07-27 following FR-001. None of these requires a rewrite, and FR-002 confirms none is to be made now.

1. **Cite the canonical definition of financial trust.** Volume 1 uses "financial trust" in its ordinary sense throughout. Volume 2 §10 establishes the canonical definition. A future revision should cite it.
2. **Attribute the founding conviction to Volume 2.** Volume 1 §3 states the company-level conviction inside a product document. Volume 2 is now its home; a future revision should cite rather than assert it.
3. **Reconcile the product position with FR-001.** Volume 1 §1 and §11 describe CreditVector as *"a constitutional operating platform for financial trust."* FR-001 ratifies *"CreditVector is the Financial Trust Operating System."* These are compatible in substance but differ in wording. A v1.1 revision should adopt the ratified line and preserve the original in a revision note.

---

## Open items

### OQ-001 — ADR-0009 reconciliation in engineering governance

**Status:** Open · **Raised:** 2026-07-27 · **Owner:** Founder / engineering governance

FR-001 changed canonical positioning for Founder Library purposes. The engineering-side record (ADR-0009 and the product documentation that cites it) still carries the prior positioning and has not been touched.

**Required before this closes:** a repository ADR that formally supersedes ADR-0009's positioning language, taken through the normal engineering governance process when engineering work resumes.

**Until then:** do not state anywhere that ADR-0009 has been superseded in engineering governance. It has not.

### OQ-002 — Volume 3 quantitative citation gap

**Status:** Open · **Raised:** 2026-07-27 · **Owner:** Founder / whoever drafts Volume 3 v1.1

Volume 3 diagnoses the financial trust problem without citing a single statistic. This is deliberate and disclosed in the volume's own evidence standard: substantial quantitative literature exists on consumer-report accuracy, dispute outcomes, and credit access, but it was not consulted, and reproducing remembered figures as verified facts would violate Volume 0's permanent rule 2.

The affected passages name themselves — §8 (Economic Consequences) states outright that a quantified estimate would strengthen it.

**To close:** a v1.1 revision informed by primary sources, with citations. Until then Volume 3 is a structural argument, not an empirical one, and should be represented as such to investors, regulators, and partners.

---

## Canonical frameworks

Models introduced in one volume and used throughout the library. Per Volume 0 §Permanent Rules (rule 10), these are defined once and cited thereafter.

### The Financial Trust Stack

**Introduced:** Volume 3 §4 · **Status:** Analysis (Gabriel Capital Labs' own framework, not an external standard)

Six dependent layers, each produced by the one beneath it:

```
Opportunity → Reputation → Execution → Education → Identity → Evidence
   (top)                                                      (foundation)
```

Two rules govern it: **defects propagate upward**, and **layers cannot be repaired from above**.

Later volumes should cite this model rather than restate it, and should locate any claimed capability or diagnosed failure at a specific layer. It is labelled Analysis, not Established — a reader may reject it. If it is later found not to hold, it is revised in Volume 3, not quietly dropped elsewhere.

---

## Observations carried forward

Durable notes that should shape future volumes. Recorded when identified; not all require action.

**From Volume 1 (2026-07-27):**

- **Volume 1 borrowed terms it did not define** — "constitutional," "governed," "financial trust," "GIOS." Volume 2 became the definitional layer in response, and Volume 0 now governs the practice. Future volumes cite existing definitions rather than re-explaining them; a volume introducing a new load-bearing term defines it formally or defers to the volume that does.
- **The refusal list is a durable device.** Volume 1's "What CreditVector Will Never Become" — closing with "these are permanent constraints, not current policy" — is the strongest passage in the volume. Volume 2 carried the pattern to company level; Volume 0 §Permanent Rules now makes it binding (rule 9).

**From Volume 2 (2026-07-27):**

- **State the cost of a strategic choice, don't manage it quietly.** Volume 2 §"Why CreditVector Was Chosen First" states the reputational cost of operating in the credit category outright. Future volumes hold this standard: a strategy document that omits the known downside of its own strategy is less credible, not more.
- **No pre-announcement.** The library describes what exists and has been validated. Volume 2's Future Portfolio is explicitly selection principles, not plans. Now binding as Volume 0 §Permanent Rules rule 12. Volumes 7, 9, and 11 will be under the most pressure to violate it.
- **Volume 2 absorbed the standalone "Vision & Mission" scope.** Mission and decade vision are sections within it. No separate volume will be created. Recorded in Volume 0 §Current Library Index.

**From Volume 3 (2026-07-27):**

- **Per-volume evidence standards work and should continue.** Volume 3 introduced a three-tier labelling scheme — **[Established]** (public law or documented structure), **[Observed]** (widely accepted but not independently examined here), **[Analysis]** (the company's own reasoning) — applied inline throughout. It made the boundary between fact and argument visible to the reader and forced discipline on the author. Volumes 6–8, which will make market and competitive claims, should adopt the same scheme or a successor to it.
- **The quantitative gap is stated, not hidden.** Volume 3 contains no statistics because the underlying sources were not consulted. This is recorded in the volume itself and tracked as OQ-002 rather than papered over with remembered figures. Future volumes face the same constraint and should handle it the same way.
- **A diagnosis is written without the treatment in view.** Volume 3 makes no reference to CreditVector, deliberately, and states the test it should be held to: the analysis must remain accurate whether or not the company exists. Volume 4 is where the proposal appears, and it must be traceable back to failures Volume 3 diagnosed.
- **The honest counterargument belongs in the document.** Volume 3 §7 states the strongest objection to its own argument (that the trust stack may not belong to any single party) without resolving it. Continuing this practice is what distinguishes analysis from advocacy.

**From Volume 4 (2026-07-27):**

- **A second label set was required: implementation status.** Volume 3's epistemic labels answer "how do we know this?" They do not answer "does this exist?" Volume 4 added **[Live] / [Partial] / [Planned]** because a proposal describing a platform can mislead most damagingly by implying capabilities exist. The stated policy is to **label down, not up** when uncertain. Every future volume describing product capability must carry this second set.
- **Repository code is not a capability.** Substantial subsystems are deployed dormant behind fail-closed flags, or complete in source but unmerged, or pending an un-executed gated production migration. None is reachable by users. Volume 4 labels all of it **[Planned]** and says so explicitly. This distinction is easy to lose and expensive to lose.
- **The proposal admits it does not solve the binding constraint.** Volume 3 §10 identified institutional accountability as what technology cannot produce. Volume 4 states plainly that CreditVector does not solve it, operating only on the consumer's side of the relationship. Its weakest mapping entries (4.6 incentives, 4.7–4.8 institutional behaviour) sit exactly where the diagnosis predicted — offered as evidence the proposal was derived from the diagnosis rather than fitted to it afterward.
- **Volume 4 stands or falls with Volume 3, by design.** It states that if the diagnosis is rejected, the proposal should be rejected too. Later volumes should preserve this dependency rather than letting the proposal float free of its reasoning.

**From Volume 0 (2026-07-27):**

- **The library's rules were previously implicit.** Statuses, versioning, conflict resolution, and the engineering/production authority boundary existed as practice before Volume 0 wrote them down. Volume 0 is therefore partly a record of what was already being done, and future governance changes amend Volume 0 rather than accumulating as habit.
- **Presentation vs. revision is now an explicit distinction.** HTML editions and typesetting advance no version. This lets presentation improve continuously without disturbing the versioned record — relevant because Volumes 1 and 2 have both been reissued in new HTML editions with no text change.

### OQ-003 — Volume 4 implementation statuses are unverified against production

**Status:** Open · **Raised:** 2026-07-27 · **Owner:** Founder / engineering

Volume 4 labels every described capability **[Live]**, **[Partial]**, or **[Planned]**. Those labels were assigned from the engineering record as documented on 2026-07-27. **No production system, database, or deployment was queried.** Per Volume 0 §6 the Founder Library cannot establish production truth, and this volume explicitly defers to it.

The stated policy is to label down, not up: a **[Planned]** capability may be closer to reality than its label suggests; none marked **[Live]** should be less real than its label suggests.

**To close:** verify each **[Live]** and **[Partial]** claim against the deployed product, and issue Volume 4 v1.1 with corrections. Until then, Volume 4's capability statuses are the company's documented belief, not a verified inventory — and should be represented that way to investors and partners.

---

## Pre-publication verification

Recorded because Volume 0 §Preserving Negative Results requires that checks and their outcomes be part of the record, not only their conclusions.

### Volume 4 — adversarial audit, 2026-07-27

Before publication, Volume 4 was audited across five dimensions by independent reviewers — traceability to Volume 3, epistemic labelling, implied implementation, the compliance bar and tone, and cross-volume consistency. **Every finding was then given to a separate reviewer instructed to refute it**, defaulting to refuted unless the finding clearly held against the text.

**Result: 23 findings raised · 21 refuted · 2 confirmed.** Both confirmed findings were fixed before publication; neither required a structural change.

1. **Traceability, MEDIUM — a citation that did not support its claim.** Volume 4 §2 (*Truth before action*) attributed to Volume 3 §6.8 a "finite number of chances to be taken seriously" mechanism. Volume 3 §6.8 diagnoses timing mismatch and channel compression, and its compression finding points the other way: if a furnisher cannot distinguish a well-documented dispute from a form-letter one, there is no accruing seriousness to spend. This violated Volume 4's own guarantee that nothing appears in it that Volume 3 did not diagnose. **Fixed** — restated to the mechanism Volume 3 actually diagnoses (finite rounds against time-bound decisions) and labelled [Analysis].
2. **Epistemics, MEDIUM — analysis labelled as established fact.** Volume 4 §4.2 labelled "Fragmentation is a structural property, not a defect anyone introduced" as **[Established]**. Volume 3's §6 preamble labels that identical proposition **[Analysis]**. **Fixed** — split, so the documented structure (furnishing is voluntary; no law compels a creditor to report) keeps [Established] and the exculpatory inference carries [Analysis].

**The 21 refuted findings are as informative as the 2 confirmed.** Several were serious-sounding — that ~28 capabilities asserted production availability as fact, that §5 and §9 were unlabelled and present-tense, that the Closing claimed superiority over competitors. Each collapsed on inspection, usually because the reviewer missed a disclosure the document already makes, or misread the governing rule. This is the pattern the refute-first design exists to produce: a finding that cannot survive a hostile reading should not change a document.

**Limitation of this audit.** It verified Volume 4 against Volumes 0–3 and against the documented engineering record. It did **not** verify implementation statuses against production — see OQ-003.

---

## Presentation editions (no version change)

Per Volume 0 §Versioning, these advance no document version.

| Volume | Edition | Date | Note |
|---|---|---|---|
| 1 | HTML, self-contained | 2026-07-27 | Rebuilt on the shared library template; body text verified verbatim against the canonical Markdown |
| 2 | HTML, self-contained | 2026-07-27 | Shared library template |
| 0 | HTML, self-contained | 2026-07-27 | Shared template, plus in-document download and print controls |
| 3 | HTML, self-contained | 2026-07-27 | Shared template; adds a CSS-built trust-stack figure and inline evidence labels. `<head>`, stylesheet, and scripts reused verbatim from the Volume 0 edition |
| 4 | HTML, self-contained | 2026-07-27 | Shared template; adds implementation-status label styling. Generated from the canonical Markdown by `_build_edition.py`, so text parity is structural rather than manual |
