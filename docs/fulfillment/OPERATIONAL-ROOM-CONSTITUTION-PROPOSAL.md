# Operational Room Constitution — Proposed Amendment

Status: **PROPOSED.** Ratification is **FOUNDER-GATE** — this document formalizes Program Brief §1.8 into an amendable form; it is never self-ratifying and creates no binding obligation until the Founder adopts it through the amendment path in §6. Pointer ADR: `ADR-0047` (`ADR-PROPOSALS.md`).

---

## 1. Context

Program Brief §1.8, verbatim: *"every primary CreditVector room is an operational workspace presenting current work, current state, recommended action, Kai guidance, evidence, timeline. Metrics provide context; they never replace work. The Mail Center answers 'What should I do next?'"* The Brief itself labels this a **constitutional PROPOSAL — package as a proposed amendment/ADR, never as ratified.**

This is not a hypothetical standard. `B-MAIL-CENTER-EVOLUTION.md` §1.2 audited the existing `/mail` room against these six elements and found the room already computes five of the six (a health-priority projection, a per-row recommendation, Kai-intel bullets, a 12-stage timeline, and a metrics grid) — the gap is **presentation ordering and promotion**, not missing intelligence, plus one genuinely absent element (evidence — `TrackingInfo`/`ProofArtifact` have zero UI consumers anywhere in the app today, verified). This proposal exists because the Mail Center evolution (`B-MAIL-CENTER-EVOLUTION.md`) is about to become the **first concrete instance** of this pattern, and a pattern applied once without being named risks becoming an unwritten habit instead of a governed standard the next room is held to.

---

## 2. The Six Mandatory Presentations

Every primary operational room must answer all six, in this priority order (highest-priority-first, not necessarily top-to-bottom on the page):

| # | Presentation | Definition | Proof it is achievable today (Mail Center precedent) |
|---|---|---|---|
| 1 | **Current work** | What is in flight, right now, that the operator owns | `buildMailCenter()`'s per-row projection (`lib/mailCenter.ts:247-318`) |
| 2 | **Current state** | A small, fixed vocabulary describing where each item stands | The 6-state health pill (`MailHealth`, `mailCenter.ts:31-52`) |
| 3 | **Recommended action** | ONE answer to "what should I do next," fixed-priority, never manufactured urgency | `recommendationFor()` (`mailCenter.ts:151-179`) + the Executive-Queue "Do this first" idiom (`components/mission/ExecutiveQueue.tsx:38-39`) + `pickRecommendation()`'s anti-overwhelm law (`lib/kaiHome.ts:60-67,150`, "quiet is allowed") |
| 4 | **Kai guidance** | Kai's narration of the above — explanation, never a second decision | `kaiIntel: string[]` per row (`mailCenter.ts:266-272`) |
| 5 | **Evidence** | The receipts backing the state — the letter itself, delivery proof, return receipt, audit trail | Genuinely absent today (`ProofArtifact`/`TrackingInfo`, `lib/mail/MailProvider.ts:71-91`, zero UI consumers, verified) — the Mail Center evolution's evidence drawer is this presentation's first build, not a retrofit |
| 6 | **Timeline** | An honest, never-fabricated sequence of what happened and what's next | The 12-stage per-row timeline (`buildTimeline()`, `mailCenter.ts:190-230`, verified) |

**Binding qualifiers on all six** (carried from the Brief's own baseline, Program Brief §2.6 and §9's forbidden-patterns list — not new law, restated here so the amendment is self-contained):
- No fabricated telemetry, progress, or urgency. A stage not yet truthfully reached renders `placeholder`/`null`, never a fabricated "in progress."
- Recommended action is **singular** — never a list dressed as a recommendation. Alternatives, if shown, render through a clearly-labeled secondary surface (e.g., `RecommendationIntelPanel`'s alternatives section), never competing with the one recommendation for primacy.
- Every Kai claim carries a `basis` (the deterministic rule that fired) — Kai never asserts a fact without a receipt.

---

## 3. Metrics-Context-Only Law

Verbatim, Program Brief §1.8: *"Metrics provide context; they never replace work."*

**Concrete violation this corrects:** today's `/mail` renders its `StatCard` metrics grid **first** on the page (`app/mail/page.tsx:64-77`, verified), before a single dispute is shown — the room's own numbers precede its own work. `B-MAIL-CENTER-EVOLUTION.md` §2.6 names the fix: the metrics grid **repositions** below the "Do this first" recommendation band, becoming a compact context strip — no data changes, only position.

**Rule, generalized beyond Mail Center:** on any room this constitution governs, a metric may inform (e.g., "3 packages waiting") but may never be the first thing the operator sees, may never imply urgency it cannot back with a specific item, and may never substitute for naming which specific item needs attention. A metrics-first layout is itself evidence a room has not yet adopted this constitution, independent of whether its underlying data is honest.

---

## 4. Applicability — Which Rooms, Adoption Order

**Scope of the word "primary room":** an operational workspace where an operator does recurring work on live cases/disputes/packages — not a settings page, a one-time onboarding flow, or a static informational page. The Brief names one instance under this program: the Mail Center / Case Journey workspace (`/mail`). This proposal does not unilaterally declare every other page in scope today; it defines the standard and names the rooms that are the most likely next candidates, each its own future decision.

| Room | Route | Status under this proposal |
|---|---|---|
| Mail Center / Case Journey | `/mail` | **First proof**, built under this program (`B-MAIL-CENTER-EVOLUTION.md`) — the reference implementation once this amendment is adopted |
| Mission Control | `/dashboard` | Already substantially conforms in spirit — `ExecutionEngine`'s Executive Queue (ADR-0020) independently arrived at the same "one recommendation, fixed priority, cited" pattern this constitution now names formally. **Not re-audited by this program** — a future pass should confirm it meets all six presentations explicitly, not just the recommendation one. |
| Case timeline | `/journey` | Timeline (#6) and evidence (#5, partial) already present; current-work/current-state/recommended-action have not been audited against this standard — future work, not this program's |
| Any future room | — | Adoption is **per-room, FOUNDER-GATE**, never automatic. A new room does not inherit this constitution by default merely by existing inside `AppShell` — it must be deliberately evaluated against the six presentations before being called compliant. |

**Adoption order, this program:** Mail Center only. No other room's compliance is asserted, claimed, or implied by this document.

---

## 5. Relationship to the CXOS Grammar

Program Brief §0 (baseline) states the boundary precisely: *"CXOS Living Environment adoption on product surfaces is a separately gated decision (Bible §12 terminal boundary). The evolution plan adopts the operational grammar in today's product idiom (AppShell) and treats full CXOS adoption as a flagged future gate."*

This constitution is the **product-idiom-now** half of that boundary — the six presentations are achievable and are being built inside today's `AppShell` (Sidebar/header/banners/main/`KaiPresence`), with zero dependency on the CXOS Living Environment runtime. `B-MAIL-CENTER-EVOLUTION.md` §6 (already-written sibling artifact) states the other half precisely, and is quoted rather than re-derived here since this document has not independently read the CXOS Bible itself (that document lives outside this repository's checked-out tree; only quotations of it appear in the sibling artifacts):

> *"Full CXOS Living Environment chamber adoption is a separate, Founder-gated decision... its reference implementation today is an isolated, unmerged Agency Headquarters RC1/RC2 candidate only — it does not exist on any consumer-facing room. Adopting it for Mail Center would mean building the room as its own semantic chamber: a declared motion signature and entry vector, the five-beat passage lifecycle, the three-class continuous/transient/scroll motion budget and its quiet-state law, per-chamber idle timing, Kai-presence dimming/scoping rules — and clearing all 17 enumerated prohibitions."* (`B-MAIL-CENTER-EVOLUTION.md` §6)

**This constitution takes no position on whether CXOS chamber adoption should ever happen for Mail Center or any other CreditVector room.** It only asserts: the six mandatory presentations are a **product/UX discipline**, independent of runtime — a room can satisfy this constitution fully on plain `AppShell` (as Mail Center is doing) or, later, as a CXOS chamber (a strictly additive, separately-gated visual/motion layer on top). Adopting this constitution creates no obligation toward, and no prejudice against, a future CXOS decision.

---

## 6. Amendment Path

### 6.1 What exists in this worktree, verified

`.ai/CONSTITUTION.md` — the **CreditVector Engineering Constitution** (Articles I–XI, adopted 2026-07-12) — is present on this branch and is the verified, currently-operative amendment mechanism for this repository. Its **Article IX** states: *"Significant architectural decisions become ADRs in `.ai/ADR/` (template: `ADR-0000-template.md`; index: `DECISIONS.md`). Record real reasoning only — never retroactively invent rationale."*

This is a **different document, and a different Article IX**, from the one referenced in this program's task framing (a separate "Product Constitution" said to live at `architecture/constitution/`, with its own Article IX describing a multi-stage engineering order). **Verified: `architecture/constitution/` does not exist in this worktree** — only `architecture/{BOOTSTRAP,CAPABILITY-PROMOTION,ENGINEERING-REVIEW-PIPELINE,FOUNDER-CONTEXT,GIOS-CONSTITUTION,GIOS-KERNEL-CAPABILITY-MAP}.md` are present. That Product Constitution reportedly lives on a separate, unmerged branch (`docs/constitution-freeze-v1`) not checked out here — this document does not fabricate its contents or article numbering, since it cannot be read from this worktree.

### 6.2 Recommended path, given what is actually available

1. **Now (available on this branch):** ratify this proposal through `.ai/CONSTITUTION.md` Article IX's existing mechanism — `ADR-0047` (`ADR-PROPOSALS.md`) is the pointer entry; if the Founder adopts it, add one line to `.ai/DECISIONS.md` per that index's own convention, and this document's status changes from PROPOSED to Accepted in place.
2. **When `docs/constitution-freeze-v1` merges (NEEDS CONFIRMATION — not verified from this worktree):** cross-file this constitution into the Product Constitution's own document at `architecture/constitution/` as its own new Article (name/number to be assigned by whoever owns that document's numbering at merge time — this document does not presume a number for it). This is the two-home outcome the task framing anticipated; both should point at each other rather than one silently superseding the other.
3. **Never:** treat this document, or the Mail Center evolution that instantiates it, as ratifying itself by shipping. Program Brief §1.8 is explicit that this is a proposal; nothing in `B-MAIL-CENTER-EVOLUTION.md` or this merge changes that status.

### 6.3 What ratification would actually bind

If adopted, this constitution binds **future room design reviews** (an addition to the existing five-review ship gate in `CLAUDE.md` — Design review would check the six presentations the same way Compliance review checks the CROA bar) — it does not retroactively obligate any already-shipped room to be redesigned, and it does not, by itself, authorize any CXOS runtime adoption (§5).
