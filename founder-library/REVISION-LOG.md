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
| 3–12 | See Volume 0 §Current Library Index | — | Planned | — |

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

**From Volume 0 (2026-07-27):**

- **The library's rules were previously implicit.** Statuses, versioning, conflict resolution, and the engineering/production authority boundary existed as practice before Volume 0 wrote them down. Volume 0 is therefore partly a record of what was already being done, and future governance changes amend Volume 0 rather than accumulating as habit.
- **Presentation vs. revision is now an explicit distinction.** HTML editions and typesetting advance no version. This lets presentation improve continuously without disturbing the versioned record — relevant because Volumes 1 and 2 have both been reissued in new HTML editions with no text change.

---

## Presentation editions (no version change)

Per Volume 0 §Versioning, these advance no document version.

| Volume | Edition | Date | Note |
|---|---|---|---|
| 1 | HTML, self-contained | 2026-07-27 | Rebuilt on the shared library template; body text verified verbatim against the canonical Markdown |
| 2 | HTML, self-contained | 2026-07-27 | Shared library template |
| 0 | HTML, self-contained | 2026-07-27 | Shared template, plus in-document download and print controls |
