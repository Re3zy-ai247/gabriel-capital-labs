# Constitution Freeze — Review Docket · v1 *(2026-07-17)*

*The four independent reviews the freeze required, their findings, what was fixed, and the open
decisions that block ratification. Referenced by [PRODUCT-CONSTITUTION-v1.md](PRODUCT-CONSTITUTION-v1.md)
Article IX.*

---

## Verdicts
| Review | Verdict |
|---|---|
| Chief Product Officer | FREEZE_WITH_FIXES |
| Chief Experience Officer | FREEZE_WITH_FIXES |
| Principal Software Architect | **NOT_READY** |
| Adversarial Constitutional | FREEZE_WITH_FIXES |

The reviews attacked the set for contradictions, identity dilution, scaling failures, and compliance
overclaims. They found real defects; the architect blocked the freeze on a code-vs-constitution
contradiction. Below: what was fixed in this pass, and the three forks only the founder can resolve.

## Fixed in this pass *(founder-independent consistency fixes)*
- **Governance precedence (blocker, 2 reviewers).** Constitution VI.2 ("repository wins") and VIII
  ("frozen, ADR-only") contradicted. Scoped repository-first to *non-constitutional detail*; the Five
  Laws and identity invariants are supreme, and a HEAD that violates a Law is a code defect, never a
  correction to the constitution.
- **Law I honesty (high).** "There is no autonomous worker" was factually false (Brief crons exist).
  Reworded: a scheduled *system* process may refresh the file; **Kai never narrates a system process
  as its own effort.** Possession principle preserved, architecture honest. Also fixed Article III's
  "continuously observes."
- **"Employee" → "officer" (high).** The Manifesto twice called Kai "an employee of the system,"
  contradicting the apex "officer" and reading as Kai subordinate to the OS. Corrected.
- **Expansion overclaim (high, 2 reviewers).** "The pattern generalizes exactly" was false — Wealth/
  Trading/Estate may have no useful non-advice core. Reworded to "generalizes for evidence-organizing
  domains"; those three tagged **candidate-conditional, may never be admitted.**
- **Voice fall-off-date (high).** §6 permitted an "obsolescence fall-off *date*," contradicting §4's
  ban on "will fall off" — an outcome dressed as a fact. Replaced with the statutory *maximum
  reporting period* and process framing; never a date an item *will* be gone.
- **CROA overclaim (high).** "Satisfies the credit-education posture" understates that strategy
  selection + letter drafting for a fee is credit-services conduct under CROA. Softened + flagged for
  counsel classification (now an open decision).
- **Kai≠OS structural test (medium).** Was a copy rule only. Added an architectural test: the OS owns
  surfaces/records/engines that render even with Kai's reasoning stripped; Kai owns the reasoning/
  voice on top. "What disappears when Kai is removed is Kai."
- **"Structurally incapable" → "architected to fail closed" (medium).** The guard is a scanner over
  nondeterministic text, not literal impossibility. Downgraded in Manifesto + Trust Model.
- **Law IV vs V tiebreak (medium).** Added: Law IV bans *manufactured* urgency, not honest conveyance
  of a real severe imminent consequence; Kai may raise *salience* (calm emphasis), never alarm.
  Defined the calm high-consequence treatment in Design Laws.
- **Empty-state bound (medium).** Readiness/education in empty states must be evidence-backed and
  decision-relevant; "nothing needs you yet" is said plainly, never filled with busywork.
- **Reuse-first teeth (medium).** Now requires a merge-blocking **reuse ledger** adjudicated by the
  Principal Architect — parity with the Domain Admission Rule.
- **Chief-of-Staff vs CIO anchor (medium); canonical forbidden-identity list + "copilot"/"bot"
  (low); hierarchy string byte-identical everywhere (medium); muted-rose token bounded (low);
  §10 emotional model reconciled to the real `kaiStates.ts` state IDs (high).**
- **Non-Kai Zones added (blocker gap).** New Constitution Article VIII: commerce (Kai never sells;
  distinct non-Kai zone), community/UGC, and the credit-score display ruling (Verified Fact,
  provenance shown, deltas never styled as success).

## ⚠️ Open decisions — these block ratification *(only the founder can resolve)*

**1. Kai's visual form — ✅ RESOLVED & FROZEN (founder resolution, 2026-07-17).** Neither pure option —
a **two-world model**: *in the product*, Kai is the KAI monogram + executive intelligence only (no
character, face, or emotional animation); the **rendered Shiba Inu is a marketing/education asset
only** and never appears on a product surface. Kai is not the artwork — identity is reasoning,
evidence, and judgment, unchanged if the character is redesigned. Added: the **Foundational Law**
(marketing builds familiarity; the product earns trust; never confuse the two), the **Character Law**,
the **Design Law** (the product never depends on a mascot to establish trust), and an **engineering
invariant** (a rendered character in any product/executive surface fails design review). Frozen across
Constitution Art. III, Identity §3/§10/§19/§20, Brand §7, Design §5/§9/§10/§11, Voice §9, UX §6/§7,
Manifesto §2. *Downstream code note (not this session): `lib/kaiStates.ts` is a marketing character-
asset system; the product presence must resolve "Kai" to the monogram, never render `/kai/states/*`.*

**2. CROA posture classification.** *(counsel)*
Name what the product actually is — which shipped behaviors are education vs. Credit-Services-
Organization conduct (strategy selection, statute-cited letters for a fee) — and set the compliant
posture (written contract, CROA disclosures, 3-day cancellation, no advance fee). Do not label the
whole product "credit-education." Flagged in Brand §4.

**3. Commerce / third-party offers boundary.** *(founder + counsel)*
The constitution establishes that Kai never sells and commerce is a distinct non-Kai zone (Article
VIII). Still to decide: are third-party lender/offer/marketplace surfaces (the category's dominant
monetization) permitted under constraints (no "you qualify," disclosed affiliate, non-Kai voice) or
prohibited? And are in-product referrals permitted? Set by ADR.

---

## Second review — identity contradictions only *(2026-07-17, post-resolution)*

After the two-world visual identity was frozen and all documents updated, a focused two-lens
adversarial review hunted **only** for identity contradictions:
- **Two-world visual identity lens → CONSISTENT (zero findings).** Every document agrees: in-product
  monogram + executive intelligence, marketing-only Shiba, Kai-is-not-the-artwork, and the four Laws
  are stated without contradiction.
- **Role & Kai≠OS lens → 2 findings, both fixed:** the forbidden-identity list was enumerated at three
  different lengths (Constitution 6-item, Brand a 4-item variant, Identity 8-item canonical). All three
  now reference the single canonical list in KAI-IDENTITY-SPECIFICATION §3 (`chatbot, assistant, AI
  companion, mascot, help bot, wizard, copilot, bot, + any model/vendor name`). Re-verified consistent.

**Result: the document set now agrees on Kai's role, visual identity, and the marketing/product
separation.**

---

*Constitution status: **Kai's visual identity FROZEN and cross-verified consistent** (decision 1
resolved; identity-contradiction review passed). Decisions 2 (CROA posture) and 3 (commerce/offers)
remain open and gate only their own sections. On their resolution the full set ratifies as FROZEN v1.
No production code was written or refactored in this session.*
