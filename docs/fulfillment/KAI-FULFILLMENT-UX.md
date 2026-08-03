# KAI-FULFILLMENT-UX.md — FINAL REVIEW, Kai Failure Translation, Truthful Money Narration

Agent W3 (Commitment Refinement) — architecture only, per `docs/fulfillment/COMMITMENT-REFINEMENT-BRIEF.md`. No product code, no schema, no dependency, no vendor change, no commit. This document is a **refinement** of `D-KAI-EXPERIENCE.md` under the Brief's rule: *"The prior package remains authoritative except where a refinement doc explicitly supersedes a section (every supersession must be labeled `SUPERSEDES: <doc §>`)."* §5 below is the full supersession map.

**Refinement Cycle 2 (this revision):** written by Agent C per `docs/fulfillment/REFINEMENT-2-DIRECTIVE.md`, applying **Ruling 4** (FINAL REVIEW placement + a server-issued confirmation token), **Ruling 3** (the post-acceptance cancellation copy truth fix), and `docs/fulfillment/COMMITMENT-REGATE.md`'s must-fix C(10) items assigned to this file: the missing `kaiCopyClass` copy classes, the on-behalf-of voice gap, and the `RecoveryVerdict.basis` closed union. Every Cycle-1 passage this revision corrects is labeled `SUPERSEDES: KAI-FULFILLMENT-UX.md §<n> (Refinement Cycle 1)` at the point of correction — the same convention this document already used for its own warning-softening rule (§1.2). §3.5 (the §611 clock anchor) is **unchanged** and remains counsel-pending per F2/Q6 — nothing below touches it.

**CROA posture note (Brief S7, verbatim, carried in every refinement doc's header):** *Settlement-at-acceptance strengthens the §1679b(b) posture versus capture-at-top-up but does NOT moot the counsel question — funds are still received in advance at top-up. The counsel question (ADVERSARIAL-REVIEW §3.4) remains the hard precondition before any wallet implementation phase. F1 (Gate D Phase −1) also stands.* Nothing in this document is a substitute for that counsel answer; the copy below is written to be truthful and non-adverse **regardless** of how that question resolves, but does not resolve it.

**Vocabulary lock (Brief S8):** `authorize` / `settle` / `release` / `clawback` / `adjust`; `hold`; `commitment boundary`; `recovery`. The word **`consume` is retired** — every place a prior artifact (D-KAI-EXPERIENCE.md, the unified `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md`) said `consume`/`void`/`refund`, this document says `settle`/`release`/`clawback` per S2's entry-kind definitions. No exceptions below.

**Labels:** `PROPOSED` = new design, not yet founder-approved. `FOUNDER-GATE` = requires explicit Founder ratification (a decision, an ADR, or the CCO compliance gate at Program Brief §4) before it may ship, even flag-off. `VENDOR-CONFIRMATION-REQUIRED` = the S5 LetterStream cancellation-window fact specifically — used only where that exact fact is load-bearing, not generically.

**W2 status, Refinement Cycle 2 (this revision):** `docs/fulfillment/RECOVERY-ENGINE.md` and `docs/fulfillment/FULFILLMENT-COMMITMENT-BOUNDARY.md` now exist on disk (verified by directory listing before this revision). §2.1 below no longer treats the verdict-handle grammar as a placeholder — every `kaiCopyClass` handle `RECOVERY-ENGINE.md` §4 names now has copy in §2.3, keyed to its real name, reconciling Cycle 1's blind ten-class draft against `COMMITMENT-REGATE.md`'s finding: *"W2 names ~19 kaiCopyClass handles, W3 (written blind) wrote 10... ≥6 have no copy, and W3's CANCELLATION_CONFIRMED 'your hold was released in full — nothing was charged' is FLATLY FALSE if re-keyed onto W2's CANCEL_CONFIRMED_RARE where the wallet STAYS settled."*

---

## 1. The FINAL REVIEW Interaction

### 1.1 Two consent moments — Approve, then FINAL REVIEW (Ruling 4)

> **SUPERSEDES: KAI-FULFILLMENT-UX.md §1.1 (Refinement Cycle 1).** The prior text placed FINAL REVIEW *before* Wallet Authorization, arguing that consent to a later irreversible event must precede any money moving at all. **`REFINEMENT-2-DIRECTIVE.md`'s Ruling 4 corrects this: FINAL REVIEW is the PRE-SUBMIT gate — placed AFTER the authorization hold, immediately BEFORE Submit, the point of no return.** This matches the Founder's literal words ("operators must continue to receive a prominent irreversible warning **before submission**") and `WALLET-COMMITMENT-MODEL.md` §11's sequence diagram, which places "FINAL REVIEW confirmed" directly after `authorizeGroup` succeeds and directly before `createMailJob()`. Cycle 1's error was treating "consent before money moves" and "consent to irreversibility" as the same moment. Ruling 4 separates them into two. The correction below is stated in full — do not reuse Cycle 1's ordering or its argument.

`REFINEMENT-2-DIRECTIVE.md` Ruling 4, the two distinct consent moments:

- **Approve (chain step 7):** price + line-items shown; the operator consents to the **reversible** authorization hold; `authorizeGroup` (`WALLET-COMMITMENT-MODEL.md` §5.2) runs here. This document does not redesign Approve's own screen — it reuses the existing `Approval()` mechanics (§1.4 point 1 below), non-Kai price display, a single "Approve" control. Approve's job is narrower than FINAL REVIEW's: it captures informed consent to *a hold being placed*, nothing more.
- **FINAL REVIEW (immediately before Submit):** the prominent irreversible-warning gate — "once the provider accepts this package it cannot be reversed" — sits at the point of no return: **after** the hold, **before** Submit. Price is **re-shown** at FINAL REVIEW for confirmation (§1.2), reading from the same values the hold itself was placed for, not a fresh computation. The confirmation is bound to a server-issued, single-use, expiring token (§1.5) carrying `contentHash`, `warningVersion`, `estimatedTotalCentsShown`, `policyVersion` — the four ✓ booleans are validated server-side against that token, never trusted from the client alone.

The corrected chain:

```
6. PDF Preview
7. Approve            — price + line-items shown; consents to the hold; authorizeGroup() runs
   → Wallet Authorization (hold placed; WALLET-COMMITMENT-MODEL.md §5.2)
   → FINAL REVIEW      — the irreversible-confirmation gate (this section); price re-shown;
                          four ✓ assertions bound to a server-issued token (§1.5); ends in Submit
8–9. Download Package / Send with CreditVector Fulfillment (co-equal fork; triggered by Submit)
```

`B-MAIL-CENTER-EVOLUTION.md` §3.1 row 8–9's citation — "Wallet Authorization inserts between Approve and the Download/Send fork" — still holds exactly as before; this revision only refines *where inside that gap* FINAL REVIEW itself sits (after the hold, not coincident with Approve).

**Why this order, argued from the Founder's own words and W1's own diagram, not asserted independently:** *"Operators must continue to receive a prominent irreversible warning before submission"* (`REFINEMENT-2-DIRECTIVE.md`, Founder authoritative decision). *Submission* is `Submit` → `createMailJob()` — not `Approve` → `authorizeGroup()`. A hold is, by the Wallet Constitution's own first invariant (`WALLET-COMMITMENT-MODEL.md` §12: *"Authorization is not settlement... it never represents money CreditVector has earned or is entitled to keep"*), a reversible, fully-undoable action — releasing it is a normal, unremarkable, everyday outcome (`RECOVERY-ENGINE.md` §4 scenarios 8 and 12), not a point of no return. Placing the irreversible-warning gate before the hold, as Cycle 1 did, asked the operator to solemnly acknowledge irreversibility for an action that was not yet irreversible — diluting the warning and detaching it from the moment it actually protects. FINAL REVIEW belongs immediately before the one action that actually crosses into commitment territory: `Submit`, which triggers `createMailJob()`, which can result in provider acceptance, which Ruling 3 (§2.3.7 below) establishes is permanent. This is also the only placement consistent with `WALLET-COMMITMENT-MODEL.md` §15's own citation of where it expects FINAL REVIEW to sit: *"before Submit, after the hold is confirmed."* The conflict this corrects was real and named: `COMMITMENT-REGATE.md` N8a — *"W3 argues [FINAL REVIEW] must PRECEDE wallet authorization; W1 §11/§15 place it AFTER authorizeGroup — direct conflict on Founder ruling #3's moment, not docketed."* Cycle 1's ordering was never load-bearing for any other document; correcting it breaks nothing upstream.

### 1.2 The screen

**Title (Founder's copy skeleton, exact):** `CreditVector Fulfillment — FINAL REVIEW`

Rendered as the heading of the **non-Kai operator-chrome** card (§1.4) — never inside a Kai-labeled panel, never carrying the `KAI` badge.

**The four ✓ assertions.** Each is architected to be a genuine, independently meaningful, individually-auditable fact — not four decorative rewordings of "I agree." Each maps to one thing this program already knows must be true before mail becomes irreversible, and each is `unchecked by default` (no assertion may ever pre-populate as checked, including on a re-render, a slow network retry, or a resumed session — see §1.8):

| # | Assertion (operator-facing copy) | What it actually attests | Cites |
|---|---|---|---|
| ✓1 | "I've reviewed the letter(s), recipient(s), and address(es) in this package in the PDF preview, and they're correct." | The operator actually looked at the exact content that will mail — not a rubber stamp. Ties to the **same content-hash proof-of-intent** mechanism already shipped (`hashFromAudit()`, `app/mail/send/[letterId]/page.tsx:28-34`; `Receipt()`'s "Letter hash (proof of intent)" field, `:270`) — the audit row below persists the hash of what was actually shown, not a label. The SAME hash is now also carried by the FINAL REVIEW token (§1.5), so ✓1's attestation and the token's binding are provably about the identical content. | PDF Preview step (chain step 6); existing hash precedent |
| ✓2 | "I understand a hold of **$[X.XX]** — not a charge — is currently on my CreditVector Wallet balance for this package, and that it becomes a final charge only once CreditVector Fulfillment accepts this package for production." | Re-confirms the financial-boundary fact (S5a) for the hold that was **already placed at Approve** (§1.1) — a deliberate re-statement, not a new event. `SUPERSEDES: KAI-FULFILLMENT-UX.md §1.2 ✓2 (Refinement Cycle 1)`: the prior wording ("I understand this **places** a hold...") described an action about to occur, which stopped being accurate the moment FINAL REVIEW moved to sit after `authorizeGroup`. Ties to §3.1's exact authorization copy and to the token's `estimatedTotalCentsShown` (§1.5) — the number shown here is provably the same number the hold was placed for, not a fresh, possibly-drifted read. | Ruling 4; S5(a) |
| ✓3 | "I've read the warning below and understand that once CreditVector Fulfillment accepts this package for production, it cannot be reversed." | Acknowledgment of the operational-irreversibility fact (S5b) — references the WARNING block rather than restating it, so the two never drift out of sync. | S5(b); §1.2 WARNING block below |
| ✓4 | "I'm mailing this for myself" **or** "I'm mailing this on behalf of [client name], and I'm authorized to act for their case." (radio-style single assertion, copy branches on `onBehalfOf`) | The payer/spend-authority fact (S4): who the real operator is, and whose case this is, stated affirmatively by the person taking the action — not inferred later from a session cookie. Also the only assertion that is structurally **unreachable** in the one case S4 forbids outright: admin impersonation. If the current session is an impersonation session, FINAL REVIEW does not render at all (money actions blocked, read-only view) rather than rendering this checkbox in a state that could be checked — see §1.4. | S4 (payer/spend-authority; admin-impersonation block); `WALLET-COMMITMENT-MODEL.md` §9.1–§9.2 |

None of the four is checked by rendering; none may be checked by a default prop, a cached value, or a "select all" control. A single native `<input type="checkbox">` per assertion (§1.7) — never a styled `<div>` masquerading as one.

**The WARNING block (Founder's copy skeleton, architected per S5 worst case) — unchanged by this revision:**

> **Once CreditVector Fulfillment accepts this package for production, it cannot be reversed.**
> This is CreditVector Fulfillment's current understanding of how production works — cancellation after acceptance is not guaranteed, and we will not promise it can be undone. If you need to stop this package, do it before you approve below.

Two sentences, deliberately: the bold first line is the assertion ✓3 references; the second line is the honesty qualifier the S5 worst-case posture requires. This copy makes **no reference to LetterStream, "the vendor," "the provider," or any named entity** — it speaks only in CreditVector Fulfillment's own voice, satisfying the Vendor Opacity law (§2.1.3 below) even in operator-chrome copy that isn't Kai's.

**`VENDOR-CONFIRMATION-REQUIRED` note (not shown to the operator, binding on maintainers) — unchanged by this revision:** This warning states the worst case per S5(b) because LetterStream's actual cancellation window (API acceptance vs. payment vs. print queue vs. printing vs. USPS handoff) is not in the repository and must not be invented. **Per S5's copy law: if the vendor later confirms an actual cancellation/grace window, this warning may only be *softened* by a ratified update — never silently edited.** Concretely: a future change to this copy requires (a) a dated vendor-confirmation record of the actual window, (b) a founder-approved doc revision that supersedes this exact paragraph with an explicit `SUPERSEDES: KAI-FULFILLMENT-UX.md §1.2` label, and (c) a version bump in the audit record's `warningVersion` field (§1.6) — and, as of this revision, in the FINAL REVIEW token's own `warningVersion` field (§1.5) — so historically-confirmed operators' audit rows still show the version *they* actually saw and agreed to. A maintainer who independently learns LetterStream has a grace window has **no authority to loosen this copy on their own** — the ratification is the point, not the fact-check.

Visual precedent: same amber/gold, non-alarm register already shipped in `Payment()`'s live-mailing notice (`app/mail/send/[letterId]/page.tsx:230-235`, `border-gold-500/30 bg-gold-500/10 text-gold-400`, `Lock` icon) — but rendered with more visual weight than that box (always expanded, not a footnote, positioned directly above the four checkboxes so it is physically read before they can be checked in natural reading order). Never red/error-coded: per `lib/kaiStates.ts`'s emotional-range law, concern is "steady and on it... amber accent... zero fear energy" — this applies to operator-chrome tone too, not only Kai's own voice, because a red "danger" treatment on a legitimate, expected step (every package goes through this) would itself be a form of manufactured urgency the Room Constitution's binding qualifiers prohibit (`OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §2, "no fabricated telemetry, progress, or urgency").

### 1.3 Checklist semantics

- **Not pre-checked, ever** — including on `Back`/`Forward` browser navigation within the same session, a component re-mount, or a resumed session after a dropped connection. A checkbox's checked state is **client-only, ephemeral UI state** until the moment of successful Submit; it is never restored from a cache, a draft, or a partial prior attempt (§1.8 makes this explicit against the existing resumability precedent, because resumability generalizes the *step index*, never the *assertion state*).
- **The Submit button is `disabled` until all four are checked** — mirrors the existing `disabled={busy}` pattern already on the Approve-adjacent button (`app/mail/send/[letterId]/page.tsx:198`); add `disabled={busy || !allFourChecked}`. `SUPERSEDES: KAI-FULFILLMENT-UX.md §1.3 (Refinement Cycle 1)`: Cycle 1 called this control "the Approve button" — under the corrected Ruling-4 ordering, "Approve" now names the earlier, distinct hold-triggering control (§1.1), so the control the four checkboxes gate is renamed **Submit** throughout this document. This is a plain client-side UX gate, not a security boundary — the **server-side** route enforces the same rule independently, and, as of this revision, also validates the FINAL REVIEW token (§1.5): a `POST` with fewer than four `true` assertions, or with a missing/expired/already-consumed/mismatched token, is refused with the same class of 400 the round2 gate already uses (`app/api/letters/[id]/round2/route.ts:32-43`), so a scripted or replayed request can't skip consent or replay an old confirmation.
- **Each ✓ is a real assertion, not a confirmation of having "seen" something.** The copy is written in first person, present tense, stating what the operator now affirms — never "I acknowledge this message was displayed," which asserts nothing about the operator's own understanding.

### 1.4 The KAI-badge / Approve / FINAL REVIEW split — three renders, not two

`SUPERSEDES: KAI-FULFILLMENT-UX.md §1.4 (Refinement Cycle 1)`: Cycle 1 specified a two-card split (a Kai-labeled explanation card, and a single non-Kai card carrying price, warning, checkboxes, and the money-triggering button). Ruling 4 separates the money-triggering action (Approve) from the irreversible-confirmation action (Submit) into two distinct moments, so the concrete rendering is now **three renders in sequence**, not two. `ADVERSARIAL-REVIEW.md` §2's rating — *"Sound... best-executed item after the Room Constitution"* — and `D-KAI-EXPERIENCE.md` §2.4's binding law — *"the Approve control must never render inside a Kai-labeled panel"* — both continue to hold; this section only refines how many non-Kai renders now exist and what each one carries. Verified against the actual JSX: today's `Approval()` (`app/mail/send/[letterId]/page.tsx:165-205`) opens with the `KAI` badge and an `<h2>` (`:168-171`) inside the *same* `<div className="card p-5">` that holds the `Approve & continue` button (`:198-200`) — one card, one Kai voice, one money-adjacent control, structurally conflated. This is the violation both laws above already required closing.

**Concrete split, three renders, in this order:**

1. **Kai-labeled explanation card** (keeps the `KAI` badge) — recipient/round/address/mail-class context, i.e. today's `<dl>` block (`:174-184`) plus the letter-preview link (`:186-188`). This is Agent D's Kai Summary territory (`D-KAI-EXPERIENCE.md` §2.1) rendering a package-scoped digest; W3 does not redesign its contents, only confirms it must end *before* the next card begins, never bleed into it. Unchanged from Cycle 1.
2. **Approve card** (no `KAI` badge) — the estimated-total price breakdown (existing precedent: `Payment()`'s itemized `p.lines.map(...)`, `:213-218` — reused, not re-derived, and must already be honest per `B-MAIL-CENTER-EVOLUTION.md` §4.2's certified-line fix, a Policy-Engine-owned prerequisite this document assumes but does not re-argue) and a single **Approve** control. Clicking Approve calls `authorizeGroup` (`WALLET-COMMITMENT-MODEL.md` §5.2); on success, the UI transitions to render 3. This is the FIRST consent moment (§1.1) — this document does not otherwise redesign it.
3. **FINAL REVIEW card** (no `KAI` badge anywhere in its DOM — not the word, not the pill, not an icon implying Kai's voice) — renders only after render 2's `authorizeGroup` call succeeds. Title (§1.2), the price breakdown **re-shown** (the same figures the hold was placed for, now read from the FINAL REVIEW token, §1.5 — never recomputed), the WARNING block, the four checkboxes, and the **Submit** button. This is the SECOND consent moment (§1.1) — the point of no return. This is the operator's own page chrome per D's law; Kai may have explained everything leading up to it, but never sits inside it.

This is the concrete execution of the ruling already made in `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §8 (docket #7) and `B-MAIL-CENTER-EVOLUTION.md` §3.2 (Approve must never render inside a Kai panel), now correctly sequenced per Ruling 4 rather than collapsed into one screen.

### 1.5 The FINAL REVIEW confirmation token — server-issued, single-use, expiring (Ruling 4; closes N8b)

**New in this revision.** `COMMITMENT-REGATE.md` N8b: *"record is four client booleans checked only for 'four trues', no server binding/nonce/expiry → forgeable and replayable while presented as compliance evidence."* Ruling 4's own text: *"The FINAL REVIEW confirmation is bound to a server-issued, single-use, expiring token carrying `contentHash`, `warningVersion`, `estimatedTotalCentsShown`, `policyVersion`... the four booleans are validated server-side against that token, never trusted from the client alone."*

```
FinalReviewToken (conceptual shape — PROPOSED, persistence mechanism is Agent A/W1's to place, §6 open join)
{
  token:                    string       // opaque, unguessable, server-generated — the value the
                                          // client round-trips; never client-derivable, never re-minted client-side
  packageId:                string
  authorizationGroupId:     string       // binds the token to the SPECIFIC hold-group it confirms —
                                          // a token issued against a prior authorizationGroupId (e.g. before a
                                          // retry mints attempt+1, WALLET-COMMITMENT-MODEL.md §6.3) can never
                                          // validate against a different one; closes a cross-attempt replay path
  contentHash:               string      // identical derivation to §1.2 ✓1 / §1.6's FinalReviewConfirmation.contentHash
  warningVersion:            string      // the ratified WARNING copy version (§1.2) the token was issued against
  estimatedTotalCentsShown:  number      // the exact total re-shown at FINAL REVIEW — read from the just-created
                                          // authorize entries, never recomputed and never client-supplied
  policyVersion:             number      // mirrors the hold's own frozen policyVersion (WALLET-COMMITMENT-MODEL.md
                                          // §3.2) — the token cannot carry a different value than the hold it confirms
  issuedAt:                  ISO-8601
  expiresAt:                 ISO-8601    // short-lived — sized to a plausible reading+decision window, a DIFFERENT
                                          // constant from the hold's own staleAfter TTL (RECOVERY-ENGINE.md §3's own
                                          // "never confuse a serverless-invocation-scale constant with a business-
                                          // window-scale one" rule, applied here to a third, distinct timescale)
  consumedAt:                ISO-8601 | null   // single-use — set exactly once, at the first successful Submit;
                                                // a second Submit against the same token is refused, never re-processed
}
```

**Issuance.** The server mints this token at the moment it renders the FINAL REVIEW card (render 3, §1.4) — immediately after `authorizeGroup` returns `ok`. `contentHash` and `policyVersion` are read from the just-created authorize entries and the manifest's own audit trail — never re-derived from anything the client supplies. `estimatedTotalCentsShown` is the exact total the FINAL REVIEW card is about to render, the same figure the hold was placed for. This is the mechanism behind "price is re-shown at FINAL REVIEW for confirmation" (Ruling 4): the number the operator sees a second time is provably the number the token — and therefore the eventual audit row (§1.6) — actually carries, not a new read that could silently drift between Approve and Submit.

**Validation at Submit.** The Submit request carries the four ✓ booleans and the token. The server-side handler refuses closed, before touching the manifest or calling the provider, unless **all** of the following hold: (1) the token exists and is unexpired; (2) `consumedAt` is `null` (single-use); (3) the token's `packageId`/`authorizationGroupId` match the request's own; (4) all four booleans are `true`. Any failure returns a typed refusal — never a silent partial-accept, never a 200 with a caveat. On success, the token is marked consumed in the **same** transaction that writes the `FinalReviewConfirmation` audit row (§1.6) — which takes its `contentHash`/`warningVersion`/`estimatedTotalCentsShown`/`policyVersion` fields **from the token**, not from a second, independently-trusted copy in the request body. This is what closes N8b precisely: the four booleans are no longer "checked only for four trues" in isolation — they are checked against values the client never had the ability to mint, edit, or replay from a stale state.

**Relationship to the submission-token dedup layer (`RECOVERY-ENGINE.md` §5).** RECOVERY-ENGINE.md's `submissionToken` is a request-layer double-click dedup mechanism — deliberately lightweight and purpose-agnostic, existing only to catch a duplicate HTTP request before any business logic runs. The `FinalReviewToken` above is a **different, richer** artifact: it exists to bind the four assertions to the specific compliance-relevant facts the operator actually saw, and it is single-use in the stronger sense of "this exact confirmation may never be replayed," not merely "this exact click may not double-fire." The two may share one issuance/consumption event in an implementation (one opaque value doing both jobs) or remain two distinct values — that wiring choice is unconstrained here; what is binding is that **both** checks run independently, and neither substitutes for the other.

### 1.6 Audit record — persisted, not decorative

Per the Brief's Recovery Constitution direction (ruling #6: "every failure → deterministic state + preserved audit," extended by `RECOVERY-ENGINE.md` §7 law 1: "every verdict carries a `basis`... a verdict with no `basis` is not valid output") and the general principle that a compliance-sensitive consent screen is worthless if the consent isn't provable later, each successful FINAL REVIEW confirmation persists a row. **W3 specifies the required fields as a contract; the concrete table/column design (new dedicated table vs. an extension of the existing `MailAudit` append-only shape) is Agent A/W1's domain-model call — flagged as an open join, §6.**

```
FinalReviewConfirmation (conceptual shape — persistence mechanism is W1/Agent A's to place)
{
  packageId:              string
  actorUserId:            string            // the REAL operator identity (S4) — never the client's id
                                              // when an agency operator is acting for them
  onBehalfOf:              string | null     // client id, when applicable; null for self-service — the
                                              // exact ✓4 branch, persisted, not just displayed
  confirmedAt:            ISO-8601 timestamp
  finalReviewTokenId:      string            // NEW (§1.5) — the consumed token this row was written from;
                                              // contentHash/warningVersion/estimatedTotalCentsShown/policyVersion
                                              // below are copied FROM this token, never re-trusted from the request
  contentHash:             string            // the SAME hash `hashFromAudit()` already derives from the
                                              // manifest's audit trail — proof of exactly what ✓1 attested to
  assertions: {
    contentReviewed:       true              // ✓1 — the row does not exist unless all four are true;
    holdUnderstood:        true              // ✓2 —   there is no "false" state to persist, only "not yet
    irreversibilityAcked:  true              // ✓3 —   confirmed" (no row), matching the checkbox law that a
    authorityConfirmed:    true              // ✓4 —   confirmation is a moment-in-time fact, not a draft.
  }
  warningVersion:          string            // which ratified WARNING copy (§1.2) the operator actually
                                              // saw — required so a later softened warning never gets
                                              // silently attributed to an operator who saw the harsher one
  estimatedTotalCentsShown: number            // the exact total displayed at confirmation time — proof
                                              // against a later "I wasn't told the price" dispute
  policyVersion:            number            // mirrors PolicyDecision.policyVersion (docket #10) — freezes
                                              // which pricing/policy rules were in effect for this consent
}
```

This is deliberately **not** gated by ADR-0006 (the Kai-AI-output persistence founder-gate) — it is a structured consent/compliance record in the same class as `MailAudit`'s existing append-only entries, not AI-composed prose. It is written by SYSTEM code (the Submit route), exactly like every existing `recordKaiEvent`/`appendAudit` call site (D-KAI-EXPERIENCE.md L3) — Kai never writes it, Kai may narrate that it happened.

### 1.7 Accessibility — keyboard, focus, ≥44px, aria

Per the Room Constitution's binding qualifiers (`OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §2) and the existing, already-shipped idioms in this exact file and `KaiPresence.tsx`:

- **Touch targets ≥44px** — every checkbox's clickable hit area (input + its `<label>`, not the bare input box) and the Submit button itself meet the `min-h-[44px]` convention already used sitewide in this file (`:110-113,198-201,239-242`). A checkbox's native rendered box is smaller than 44px in most browsers — the fix is a `<label>` wrapping both the input and its text with `min-h-[44px] flex items-center` so the whole row is the hit target, not just the 16px box.
- **Native semantics, not ARIA simulation** — real `<input type="checkbox">` + `<label htmlFor=...>` pairs. No `role="checkbox"` on a `<div>`; a native input gets space-to-toggle, screen-reader state announcement ("checked"/"not checked"), and form semantics for free, matching this codebase's existing preference for native elements over ARIA-simulated ones (e.g. this same file's real `<button disabled>` rather than a styled clickable span).
- **Grouping** — the four checkboxes sit inside a `<fieldset>` with a `<legend>` reading "Before you submit" (visually styled, not `sr-only` — this is the exact discipline `KaiWhy.tsx`'s uncertainty section already follows: a caveat/gate section renders at the *same* visual weight as everything around it, never quieter). The WARNING block is referenced by `aria-describedby` from the fieldset, so a screen-reader user landing on the checkboxes is told what they relate to without having to have already read every preceding paragraph. `SUPERSEDES: KAI-FULFILLMENT-UX.md §1.6 (Refinement Cycle 1)`: the legend copy is renamed from "Before you approve" to "Before you submit," consistent with §1.3's control rename.
- **Reading order = DOM order = tab order** — WARNING block, then ✓1→✓4 in the table's order, then the Submit button, with no `tabIndex` overrides. This is the same "reading order" discipline the FTC clear-and-conspicuous parity note in `KaiWhy.tsx:62-66` already applies to uncertainty sections — a consent gate must never be reachable "out of order" via tab navigation in a way that lets a keyboard user land on Submit before passing through the assertions.
- **Live error region** — reuses the exact existing pattern `role="alert" aria-live="polite"` (`:196,237`) for a submission error (e.g., an expired FINAL REVIEW token, §1.5) — never a silent failure.
- **Focus on submit-blocked** — if a keyboard user tabs to a disabled Submit button and it's disabled, that's sufficient (disabled buttons are already skipped by nothing — they remain focusable and announce "disabled" natively); no custom focus-stealing is needed or wanted, consistent with `KaiPresence.tsx`'s discipline of *only* moving focus on genuine open/close transitions (`:76-84`), never opportunistically.
- **No color-only meaning** — the WARNING block's amber tone is reinforced by the `Lock`/warning icon and by text, never by color alone (Room Constitution §2's binding qualifiers, inherited from Program Brief §2.6's "§9 forbidden patterns... no color-only meaning").

### 1.8 Resumability — server-derived step precedent, checkbox state never resumed, token expiry

Existing precedent, generalizes cleanly (`B-MAIL-CENTER-EVOLUTION.md` §3.3, verified against `load()`'s status→step mapping, `app/mail/send/[letterId]/page.tsx:66-68`): `QUEUED→step 3`, `APPROVED|PAID→step 2`, else `step 1`. The 9-step chain extends this **at the step-index level only**:

- If the operator navigates away and returns **before** a successful Approve (§1.1), the Package's canonical stage is still pre-`WALLET_AUTHORIZED` — they land back on the Approve render, and no hold exists yet. Nothing FINAL-REVIEW-shaped renders until Approve succeeds again.
- If the operator successfully **Approved** (a hold exists) but navigates away **before** a successful Submit, the canonical stage is `WALLET_AUTHORIZED` with no `FinalReviewConfirmation` row — they land back on FINAL REVIEW, and **all four checkboxes render unchecked**, full stop. This is not a bug to be smoothed over with a saved draft: a checkbox is a fresh, moment-in-time attestation (§1.3), and a "helpfully" pre-filled checkbox from a half-finished prior visit would violate the "not pre-checked" law in spirit even though it renders from real prior client state — the fix is that no such state is ever persisted client-side across a navigation in the first place (component-local `useState`, not `localStorage`, not a query param). **New in this revision:** if the FINAL REVIEW token issued on the prior visit has since expired (§1.5), the server issues a **fresh** token on re-render — the price re-shown is re-read at that moment (still the hold's own frozen values, never recomputed), and the operator's four checkboxes still start unchecked regardless of the new token's issuance. An expired-token resume is never silently extended.
- If the operator **did** successfully confirm at Submit (the audit row in §1.6 exists) and then navigates away, the server-derived stage is now at or past whatever Submit itself triggers — resuming **skips both Approve and FINAL REVIEW entirely** and lands wherever the canonical stage points, exactly as `APPROVED|PAID→step 2` already skips past a completed step today. Neither Approve nor FINAL REVIEW is ever re-shown for an already-confirmed package; there is no "re-approve" or "re-submit" flow. If a correction is later needed (e.g., a rejection triggers `attempt+1`, `WALLET-COMMITMENT-MODEL.md` §6.3), that is a **new** attempt with a **new** hold, a **new** FINAL REVIEW token, and a **new** confirmation row — not a reopened old one.

---

## 2. Kai Failure-Translation Catalog

### 2.1 Verdict-handle grammar — reconciled against `RECOVERY-ENGINE.md` (Open Join #1, Cycle 1, now closed)

`SUPERSEDES: KAI-FULFILLMENT-UX.md §2.1 (Refinement Cycle 1)`: Cycle 1 proposed its own placeholder `RecoveryVerdictType`/`RecoveryVerdict` shape, since `RECOVERY-ENGINE.md` did not exist on disk at the time. It now does. This section replaces the placeholder with the real interface (§2.1.1), closes the two open-string gaps `COMMITMENT-REGATE.md` flagged — `kaiCopyClass` (§2.1.2) and `basis` (§2.1.3) — and confirms which scenarios are deliberately silent (§2.1.4).

#### 2.1.1 The real `RecoveryVerdict` interface, quoted verbatim

```ts
// RECOVERY-ENGINE.md §2, quoted verbatim — no longer this document's own placeholder.
interface RecoveryVerdict {
  scenario: string;              // one of the 17 named scenarios, or "unclassified"
  resultingState: FulfillmentStage | "ATTENTION" | "CANCEL_REQUESTED" | "RECEIPT_OVERDUE"
                | "TRACKING_STALLED" | "NO_CHANGE";
  walletEffect: "hold_released" | "settled" | "none" | "clawback" | "founder_gate_pending";
  recoveryWorkflow: string[];     // operator-step handles, machine-readable — copy is W3's job
  notificationMoment: "immediate" | "on_threshold" | "on_resolution" | "none";
  kaiCopyClass: string;           // a HANDLE only — closed by this document, §2.1.2
  basis: string;                  // which row of §4's matrix fired — closed by this document, §2.1.3
  auditRef: string;
}
```

**Why not just "FAILED"** — `D-KAI-EXPERIENCE.md` §4.4's emotional-mapping table used the placeholder key `fulfillment.status = FAILED/RETURNED`. Checked against the actual state machine: the manifest-level `FAILED` status is *already* disambiguated at the `FulfillmentStage` layer into `REJECTED` / `ADDRESS_FAILURE` / `PROVIDER_ERROR` by reason code (`A-STATE-MACHINE.md:83-85,114-116`), and `RECOVERY-ENGINE.md` §4 disambiguates further still, into the 17 named scenarios. Collapsing any of this back to one Kai-facing "Failed" would undo the exact disambiguation the state machine and Recovery Engine were built to provide, on top of directly violating Founder ruling #4 ("Kai never says 'Failed'"). This catalog keys to the disambiguated `kaiCopyClass`, never the collapsed manifest status.

#### 2.1.2 `kaiCopyClass` — this document's closed union (§2.3's 19 classes, nothing more, nothing fewer)

```ts
// This document's closed union for the handle RECOVERY-ENGINE.md §2 leaves as a bare `string`.
// Every value below has copy in §2.3. Reconciled against RECOVERY-ENGINE.md §4's own matrix —
// renames from Cycle 1's placeholder names are noted inline in §2.3 where one existed.
type KaiCopyClass =
  | "RETRY_NEEDED_TECHNICAL"            // §2.3.1 — scenario 1
  | "CORRECTION_NEEDED_ADDRESS"         // §2.3.2 — scenario 2
  | "TEMPORARY_DELAY"                   // §2.3.3 — scenario 3 (retrying)
  | "SUBMISSION_NOT_COMPLETED_YET"      // §2.3.3 — scenario 3 (schedule exhausted)
  | "PROCESSING_LONGER_THAN_USUAL"      // §2.3.4 — scenario 4
  | "CORRECTION_NEEDED_GENERAL"         // §2.3.5 — scenario 5
  | "RETRY_IN_PROGRESS"                 // §2.3.6 — scenario 7
  | "CANCELLED_CLEAN_RELEASE"           // §2.3.7 — scenario 8
  | "CANCEL_REQUEST_ACKNOWLEDGED_PENDING" // §2.3.7 — scenario 9 (initial ack)
  | "CANCEL_CONFIRMED_RARE"             // §2.3.7 — scenario 9, Branch A — Ruling 3
  | "CANCEL_NOT_POSSIBLE_PROCEEDING"    // §2.3.7 — scenario 9, Branch B
  | "PACKAGE_PARTIAL_PROGRESS"          // §2.3.8 — scenario 10
  | "FULFILLMENT_STALLED_INVESTIGATING" // §2.3.9 — scenario 11
  | "HOLD_EXPIRED_RELEASED"             // §2.3.10 — scenario 12
  | "CONCURRENT_ACTION_LOST"            // §2.3.11 — scenario 15
  | "WALLET_DEFICIT"                    // §2.3.12 — W1-sourced posture class, NOT a §4 matrix row (see note there)
  | "BALANCE_ADJUSTED_CHARGEBACK"       // §2.3.12 — scenario 16(d)
  | "REFUND_UNDER_REVIEW"               // §2.3.12 — scenario 16(a)/(b)/(c)
  | "BALANCE_CORRECTED_MANUAL";         // §2.3.12 — scenario 16(e)
```

**Deliberately silent scenarios — not an oversight.** `RECOVERY-ENGINE.md` §4 scenarios 6 (duplicate submission), 13 (double-click), and 14 (race conditions) resolve with **no user-facing event** by the matrix's own design ("None — the original transition's effect happened exactly once" / "None needed" / "None additional") — nothing in this catalog corresponds to them because nothing should render. Scenario 17 (ledger reconciliation) has no distinct consumer-visible effect of its own; any visible consequence is inherited from whichever *other* scenario actually fired as a result (most commonly scenario 12 — already covered at §2.3.10). Nineteen classes cover all seventeen scenarios' user-facing outcomes plus one W1-sourced addition (§2.3.12's `WALLET_DEFICIT`), with these four scenarios correctly contributing zero.

#### 2.1.3 `basis` — closed union + the Vendor Opacity DTO guard (COMMITMENT-REGATE must-fix C(10))

`COMMITMENT-REGATE.md`'s register-honesty verdict: *"RecoveryVerdict.basis is an open string (Vendor Opacity DTO unenforced until it is a closed union)."* Compiled directly from `RECOVERY-ENGINE.md` §4's own named reasonCodes/outcomes and `WALLET-COMMITMENT-MODEL.md` §5's `WalletLedger.basis` enums — nothing invented:

```ts
type RecoveryVerdictBasis =
  // §4 matrix reasonCodes (manifest-side)
  | "pdf_invalid"                 // scenario 1
  | "address_invalid"             // scenario 2
  | "provider_outage"             // scenario 3 — attention, still retrying
  | "network"                     // scenario 3 — retry schedule exhausted
  | "provider_timeout_ambiguous"  // scenario 4
  | "provider_rejected"           // scenario 5
  | "fulfillment_stalled"         // scenario 11
  | "ttl_expired"                 // scenario 12 — mirrors WalletLedger's own releaseHold basis value
                                  // verbatim (WALLET-COMMITMENT-MODEL.md §5.4), not the looser "expired"
                                  // prose in RECOVERY-ENGINE.md's own audit-entries column for the same row
  | "ledger_drift"                // scenario 17
  | "unknown_provider_status"     // §8's unmapped-status guard case
  // scenario 9's cancellation-request outcomes
  | "confirmed_cancelled"         // scenario 9, Branch A
  | "proceeded"                   // scenario 9, Branch B
  // WalletLedger.basis values a RecoveryVerdict may cite when it drove that entry
  | "provider_accepted"           // settle
  | "operator_canceled"           // release — scenario 8
  | "policy_failed"               // release
  | "chargeback"                  // clawback, account-level — scenario 16(d)
  | "refund_reversal"             // clawback, account-level — scenario 16(d)
  | "operational_makegood";       // clawback, subject-level — scenario 16(a)/(b)/(c)/(e)-adjacent
```

**The guard, stated plainly.** The Vendor Opacity DTO — the same boundary §2.4 already requires between a provider payload and Kai's translation input — validates `basis` against this exact closed set **before** Kai's translation function is ever invoked (a `RecoveryVerdictBasisSchema.safeParse(verdict.basis)`-shaped check, mirroring the zod `.strict()` discipline `WALLET-COMMITMENT-MODEL.md` §10 already applies to Event Bus contracts). A `basis` value outside this set is treated exactly like a parse failure at any other DTO boundary: the translation layer falls back to a generic, safe review-needed class (never interpolates the raw value, never renders it, never guesses which named class it might have meant), and the mismatch is logged out of band for engineering/ops — never surfaced to the operator. This is defense-in-depth layered **under** §2.4's existing "the input type itself is never a provider payload" guarantee: even if `RecoveryVerdict.basis` were ever mis-populated (a bug, or a future scenario added to §4's matrix without updating this union), the closed-union check is a second, independent backstop that keeps an unvetted string from ever reaching operator-facing copy — the same reasoning `ADVERSARIAL-REVIEW.md` used to rate the static vendor-name regex "weak... the DTO is the load-bearing control," applied one layer deeper.

**Binding on `RECOVERY-ENGINE.md`'s own typing, not yet this document's to edit.** `RECOVERY-ENGINE.md` §2 currently types `basis: string` (open). This document specifies the exact enum above and the guard it must satisfy; ratifying it as the literal type there (replacing the bare `string`) and wiring the same enum into the shared DTO validator is Agent B/W2's file to change — flagged as an open join, §6.

### 2.2 On-behalf-of voice — the general rule (closes the register-incompleteness finding)

**Finding, restated.** `COMMITMENT-REGATE.md`'s register-honesty verdict: *"W3's money narration is entirely self-pay voice with no on-behalf-of variant... wrong for managed clients whose agency paid, contra W1 §9."* Every line in §2.3 and §3 that states a concrete wallet fact (a hold placed, settled, released, or a balance in deficit) was written in **self-pay voice** by default in Cycle 1 — grammatically correct only when the person hearing it IS the wallet's own principal. `WALLET-COMMITMENT-MODEL.md` §9.1–§9.2 establishes that agency-managed fulfillment is always paid from the **agency's** `Wallet`, never a managed client's (no per-client wallet exists for that path, and a managed client attempting to spend directly is refused with `managed_client_cannot_spend`) — so a managed client viewing their own case, whose fulfillment their agency paid for, would hear a factually wrong claim ("your balance," "you were charged") about money that was never theirs to begin with.

**Voice selection rule.** Compare the account currently viewing/receiving the narration against the relevant `WalletLedger` row's `onBehalfOfId` (`WALLET-COMMITMENT-MODEL.md` §3.2, §9.3):

- If the viewing account **is** the wallet's own principal (a self-pay consumer, or an agency operator viewing their own agency's activity) → **self-pay voice** — "your hold," "your balance," "you."
- If the viewing account **is** the `onBehalfOfId` on that entry (a managed client viewing their own case, whose agency is the actual payer) → **on-behalf-of voice** — "your agency's hold," "your agency's balance"; never "you were charged," never any phrasing implying the client's own money moved.

This is the same identity-resolution discipline `resolveWalletTarget()` already applies at write time (`WALLET-COMMITMENT-MODEL.md` §9.1 — `currentAccount()` + an explicit `impersonationContext()` check, never `currentUser()`'s transparent-impersonation resolution) — applied here at read/narration time instead of write time.

**Substitution pattern (applies uniformly; not re-derived per line):**

| Self-pay | On-behalf-of |
|---|---|
| "your CreditVector Wallet balance" | "your agency's CreditVector Wallet balance" |
| "a hold... on your balance" | "a hold... on your agency's balance" |
| "your balance was restored" | "your agency's balance was restored" |
| "nothing was charged" | "nothing was charged to your agency" |
| "you were charged / the charge stands" | "your agency was charged / the charge to your agency stands" |

§3.1–§3.4 give both voices in full for the four canonical money-narration lines Ruling 4 and `COMMITMENT-REGATE.md` name explicitly (authorization, settlement, release, deficit). §2.3's catalog gives both voices for every class that states a concrete wallet fact; a class is marked **(self-pay only)** with a one-line reason where the underlying fact has no per-client dimension at all (e.g., an account-level chargeback), rather than a variant being force-fit where none is factually meaningful.

### 2.3 The catalog

Every line below: first person, translates the internal signal, **preserves the package** (never implies data was lost), **names a correction path**, never the word "Failed," never a raw vendor error string, never a vendor name (`letterstream`/`lob`/`postgrid`/`click2mail`/`postalmethods` — Vendor Opacity law, §2.4). Emotional state per `lib/kaiStates.ts`'s concrete catalog (`D-KAI-EXPERIENCE.md` §4.4's law, extended here to nineteen classes).

**2.3.1 — `RETRY_NEEDED_TECHNICAL`** (scenario 1, invalid PDF; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.2 "PACKAGE_SPEC_INVALID" (Refinement Cycle 1)` — renamed and rewritten to name the real wallet effect) · wallet effect: **hold released** (the hold placed at Approve, §1.1, is pre-settlement — released, never settled, when generation fails before `createMailJob`) · Kai state: `concerned`
> "This package's file didn't generate correctly before I could send it to CreditVector Fulfillment — a production issue on our side, not something wrong with your content. The hold for this attempt was released, nothing was charged, and I'll have a corrected version ready to send again in one step."
> "There was a technical problem preparing this package's file for production. Your hold for this attempt came back to your balance right away. Regenerate the file here, and it's ready to resend."
> *On-behalf-of:* "There was a technical problem preparing this package's file for production — the hold on your agency's balance for this attempt was released, nothing was charged. It's ready to resend once regenerated."

**2.3.2 — `CORRECTION_NEEDED_ADDRESS`** (scenario 2; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.1 "ADDRESS_INVALID" (Refinement Cycle 1)` — renamed, copy retained) · wallet effect: **none** (branch a — caught before a manifest/hold ever exists) or **hold released** (branch b — rare post-authorization provider-side rejection) · Kai state: `concerned`
> "I couldn't confirm a mailable address for [Recipient]. Nothing about this package was lost — it's saved exactly as you built it. Update the address and I'll have it ready to send again in one step."
> "This package needs a working address for [Recipient] before I can send it. Your hold wasn't affected — fix the address here and it's ready to go."
> *On-behalf-of:* "This package needs a working address for [Recipient] before it can go out. The hold on your agency's balance wasn't affected — fix the address here and it's ready to go."

**2.3.3 — `TEMPORARY_DELAY` / `SUBMISSION_NOT_COMPLETED_YET`** (scenario 3, provider outage; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.3 "PROVIDER_UNAVAILABLE" (Refinement Cycle 1)` — one placeholder class split into the two real, distinct signals) · wallet effect: **none** while retrying (hold intact) → **hold released** only once the bounded retry schedule fully exhausts · Kai state: `waiting` (retrying) / `concerned` (exhausted)
> `TEMPORARY_DELAY` (still retrying, automatic): "CreditVector Fulfillment hasn't confirmed this package yet — I'm retrying automatically and will keep you posted. Your hold is exactly where it was, and nothing has been charged."
> `TEMPORARY_DELAY`: "This package is still waiting on confirmation from CreditVector Fulfillment. I'm handling the retries in the background; nothing changes with your hold while I do."
> *On-behalf-of:* "CreditVector Fulfillment hasn't confirmed this package yet — I'm retrying automatically. The hold on your agency's balance is exactly where it was, and nothing has been charged."
> `SUBMISSION_NOT_COMPLETED_YET` (schedule exhausted): "I wasn't able to get this package confirmed after several tries, so I've stopped retrying automatically and flagged it for a closer look. Your hold was released rather than left open — nothing was charged, and you can try again once things look clear."
> `SUBMISSION_NOT_COMPLETED_YET`: "This package couldn't get confirmed after repeated attempts, so I released the hold rather than hold it indefinitely. Nothing about the letter changed; I'll let you know when it's safe to resend."
> *On-behalf-of:* "I wasn't able to get this package confirmed after several tries, so I released the hold on your agency's balance rather than leave it open. Nothing about the letter changed."

**2.3.4 — `PROCESSING_LONGER_THAN_USUAL`** (scenario 4, provider timeout — genuinely ambiguous; new class, no Cycle-1 equivalent) · wallet effect: **none** — the hold stays intact, deliberately **neither** released nor settled until resolved · Kai state: `waiting`/`concerned`
> "CreditVector Fulfillment is taking longer than usual to confirm this package — I genuinely don't know yet whether it went through, so I'm not guessing. Your hold stays exactly as it is until I have a real answer; I won't release it or treat it as accepted without one."
> "This one's stuck in an unclear spot with CreditVector Fulfillment — not confirmed, not rejected. Rather than guess, our team is checking directly. Your hold isn't going anywhere until there's a definite answer."
> *On-behalf-of:* "This one's stuck in an unclear spot with CreditVector Fulfillment. The hold on your agency's balance isn't going anywhere until there's a definite answer — I won't guess."

**2.3.5 — `CORRECTION_NEEDED_GENERAL`** (scenario 5, API rejection; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.4 "PACKAGE_REJECTED" (Refinement Cycle 1)` — renamed, copy retained) · wallet effect: **hold released** · Kai state: `bad-news`
> "CreditVector Fulfillment couldn't accept this package as submitted. Your hold was released — nothing was charged. I've kept the letter and flagged what needs fixing so you can resend."
> "This package didn't clear CreditVector Fulfillment's acceptance check. Your balance is back to where it was before you approved. Take a look at what I flagged below — this is ready to go again in one step."
> *On-behalf-of:* "CreditVector Fulfillment couldn't accept this package as submitted. The hold on your agency's balance was released — nothing was charged. I've kept the letter and flagged what needs fixing so it can be resent."

**2.3.6 — `RETRY_IN_PROGRESS`** (scenario 7; new class) · wallet effect: **hold released** on the old attempt, **a new, independent hold** on the new attempt (`WALLET-COMMITMENT-MODEL.md` §6.3 — never a reuse of the old, already-released hold) · Kai state: `waiting`
> "I've resubmitted this package with what you corrected — a new hold of $[X.XX] is set aside for this attempt, same as before. I'll let you know the moment CreditVector Fulfillment responds."
> "This package is back in for review under a new attempt. A fresh hold covers it, and your prior attempt stays on record for reference. I'll update you as soon as I hear back."
> *On-behalf-of:* "I've resubmitted this package with what was corrected — a new hold is set aside on your agency's balance for this attempt. I'll update you the moment CreditVector Fulfillment responds."

**2.3.7 — Cancellation family (scenarios 8 and 9) — includes Ruling 3, the single most important correction in this document**

- **`CANCELLED_CLEAN_RELEASE`** (scenario 8, pre-acceptance — clean; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.6 "CANCELLATION_CONFIRMED" (Refinement Cycle 1)` — **renamed specifically to remove the dangerous name collision `COMMITMENT-REGATE.md` flagged**: Cycle 1's `CANCELLATION_CONFIRMED` was close enough in name to W2's post-acceptance `CANCEL_CONFIRMED_RARE` that a naive rekey-by-name-similarity could have attached this class's "nothing was charged" copy to the post-acceptance case where it is false. The rename alone closes that specific failure mode; the copy itself was always accurate for the genuinely-pre-acceptance case it describes) · wallet effect: **hold released** · Kai state: `good-news`
  > "This package is canceled. CreditVector Fulfillment hadn't accepted it yet, so your hold was released in full — nothing was charged."
  > "Canceled, as requested. Since this hadn't been accepted yet, the entire hold came back to your balance right away."
  > *On-behalf-of:* "This package is canceled. CreditVector Fulfillment hadn't accepted it yet, so the hold on your agency's balance was released in full — nothing was charged to them."

- **`CANCEL_REQUEST_ACKNOWLEDGED_PENDING`** (scenario 9, initial acknowledgment; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.6 "CANCELLATION_REQUESTED" (Refinement Cycle 1)` — renamed, copy retained) · wallet effect: **none yet, outcome-dependent** · Kai state: `concerned`
  > "I've sent a cancellation request for this package, but CreditVector Fulfillment already accepted it — I can't promise it will stop in time. I'll tell you the moment I know either way, and nothing changes with your hold until I do."
  > "This cancellation request went out after CreditVector Fulfillment's acceptance, so it isn't guaranteed to take effect. Your hold stays as-is for now — I'll update you as soon as there's a real answer."
  > *On-behalf-of:* "I've sent a cancellation request for this package, but CreditVector Fulfillment already accepted it — I can't promise it will stop in time. Nothing changes with the hold on your agency's balance until I know either way."

- **`CANCEL_CONFIRMED_RARE`** (scenario 9, Branch A — **new class; the Ruling 3 fix**) · wallet effect: **`founder_gate_pending`** — the wallet **stays settled**; only a manual, FOUNDER-GATE-reviewed `adjust` could ever move money back, never automatically · Kai state: `concerned`

  **`REFINEMENT-2-DIRECTIVE.md` Ruling 3, verbatim law:** *"Once a manifest reaches `PROVIDER_ACCEPTED`: the wallet hold is SETTLED and stays settled forever... the system never pretends the mailing did not occur... Kai copy (W3) says the settled truth, never 'nothing was charged.'"* `COMMITMENT-REGATE.md`'s exact finding this closes: *"W3's CANCELLATION_CONFIRMED 'your hold was released in full — nothing was charged' is FLATLY FALSE if re-keyed onto W2's CANCEL_CONFIRMED_RARE where the wallet STAYS settled — the hardest disclosure in the program currently has copy saying the opposite."* Cycle 1 wrote no copy at all for this class (it did not exist in the ten-class draft); this is net-new, not a rewrite of a false line — but it is written under the strictest version of the rule specifically because a wrong first draft here was the exact defect found.
  > "Your cancellation request for this package has gone through. But CreditVector Fulfillment had already accepted it for production before that could take effect — the letter was mailed, and the $[X.XX] charge for it stands. There's no automatic refund for this; our team reviews cases like this individually, and I'll let you know what they find."
  > "This package is marked canceled, as you asked. That said, cancellation came in after CreditVector Fulfillment's acceptance, which is the point nothing about a mailing can be undone — the letter went out, and the charge is final. Any make-good here is a manual decision our team makes, not something I can promise or process myself."
  > *On-behalf-of:* "Your cancellation request for this package has gone through. But CreditVector Fulfillment had already accepted it for production before that could take effect — the letter was mailed, and the charge to your agency's CreditVector Wallet stands. There's no automatic refund for this; our team reviews cases like this individually with your agency, and you'll be kept updated on what they find."

  Never "your hold was released," never "nothing was charged," never any phrasing implying the mailing did not happen — in any voice, self-pay or on-behalf-of.

- **`CANCEL_NOT_POSSIBLE_PROCEEDING`** (scenario 9, Branch B — the default outcome; new class) · wallet effect: **none** — already settled at acceptance, stays settled, nothing changes · Kai state: `concerned`
  > "I wasn't able to stop this package — CreditVector Fulfillment had already accepted it for production by the time your cancellation request came in, and once that happens, it can't be pulled back. Your package is proceeding normally, and nothing changes with the $[X.XX] already applied to it."
  > "This package is continuing on its normal path. Your cancellation request arrived after CreditVector Fulfillment's acceptance, which is the point nothing can be stopped or reversed — so production and mailing continue as planned, and the charge for it stands as it already was."
  > *On-behalf-of:* "I wasn't able to stop this package — CreditVector Fulfillment had already accepted it for production by the time the cancellation request came in. The package is proceeding normally, and nothing changes with the charge already applied to your agency's balance for it."

**2.3.8 — `PACKAGE_PARTIAL_PROGRESS`** (scenario 10; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.5 "PACKAGE_PARTIALLY_ACCEPTED" (Refinement Cycle 1)` — renamed, copy retained) · wallet effect: **mixed — settled per accepted letter, hold released per rejected letter, independently and atomically per letter** · Kai state: `concerned` (factual about the accepted portion, actionable about the rest)
> "Part of this package is moving: [N] of [N total] letters were accepted and are on their way. [M] couldn't be accepted — that portion's hold came back to your balance, and I've flagged what to fix so you can resend just that piece."
> "This package split: [Recipient A] is confirmed and in production; [Recipient B] wasn't accepted, and that hold was released. Nothing changes for Recipient A — fix Recipient B here when you're ready."
> *On-behalf-of:* "Part of this package is moving: [N] of [N total] letters were accepted and are on their way. [M] couldn't be accepted — that portion's hold came back to your agency's balance, and I've flagged what to fix so it can be resent."

**2.3.9 — `FULFILLMENT_STALLED_INVESTIGATING`** (scenario 11 — "the general form of `TRACKING_STALLED`... at any stage, not only post-carrier"; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.9 "RECEIPT_OVERDUE" and §2.2.10 "TRACKING_STALLED" (Refinement Cycle 1)` — Cycle 1 treated these as two separate placeholder classes; RECOVERY-ENGINE.md §4 assigns one `kaiCopyClass` to the general stall condition, so this revision folds them under it as two named, distinguishable situations rather than inventing two competing classes for one scenario) · wallet effect: **none** — already settled at acceptance; this is a post-settlement operational watch, never a financial one · Kai state: `concerned` (watching, not alarmed)
> *Tracking-stalled situation:* "Tracking on this package hasn't updated in longer than I'd expect. That doesn't necessarily mean anything went wrong — carrier updates can lag. I'm still watching, and I'll flag it here the moment there's a change."
> *Tracking-stalled situation:* "I haven't seen a tracking update for this package in a while. Your package and hold status are unaffected — I'll surface the next update as soon as it comes in."
> *Receipt-overdue situation (the `RECEIPT_OVERDUE` resultingState, `RECOVERY-ENGINE.md` §2/§3's own "Warm" band — expected to lag delivery, calmer register than an active stall):* "This package was delivered, but the electronic return receipt hasn't come back yet — it's taking longer than usual. I'm still watching for it; nothing else about your case is waiting on it yet."
> *Receipt-overdue situation:* "Delivery is confirmed for this package. The signed return receipt hasn't arrived yet, which does happen — I'll let you know the moment it's archived with your case."

No money is stated in this class (nothing to narrate — the wallet has been settled since acceptance and nothing here changes that), so no on-behalf-of variant is needed; the copy is identical regardless of who is viewing.

**2.3.10 — `HOLD_EXPIRED_RELEASED`** (scenario 12, wallet authorization expiration; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.7 "AUTHORIZATION_RELEASED" (Refinement Cycle 1)` — renamed, copy retained) · wallet effect: **hold released** — never settlement-by-timeout (`RECOVERY-ENGINE.md` §7 law 3, Brief S6, absolute) · Kai state: `good-news`
> "The hold on this package was released — your balance was restored. This can happen when CreditVector Fulfillment hasn't confirmed a package within the expected window. Nothing about your letter changed, and you can resend whenever you're ready."
> "Your balance was restored. The hold tied to this package didn't turn into a confirmed mailing in time, so I let it go rather than leave it open indefinitely. The letter is exactly as you left it."
> *On-behalf-of:* "The hold on this package was released — your agency's balance was restored. This can happen when CreditVector Fulfillment hasn't confirmed a package within the expected window. Nothing about the letter changed, and it can be resent whenever your agency is ready."

**2.3.11 — `CONCURRENT_ACTION_LOST`** (scenario 15; new class) · wallet effect: whatever the **winning** action's normal effect is — nothing additional from the race itself; the loser's attempt never touches the ledger or the manifest · Kai state: `concerned`
> "Someone else on your team just took an action on this package a moment before you did, so your click didn't go through. Here's where things actually stand now — take a look and, if you still want to act, go ahead."
> "This package changed right as you were acting on it — [operator name] got there first. Nothing you did was applied; review the current state below before trying again."

No specific balance figure is stated in this class's own copy (it is about action-conflict, not a wallet fact), so no forced on-behalf-of duplication; where the concurrent actions were themselves wallet-affecting (e.g., two operators both racing Approve), the "current actual state" shown to the loser already reflects whichever voice (§2.2) applies to the winning action's own resulting notice.

**2.3.12 — Deficit / refund / correction family**

- **`WALLET_DEFICIT`** (ongoing wallet posture — **not** a `RECOVERY-ENGINE.md` §4 matrix row; sourced instead from `WALLET-COMMITMENT-MODEL.md` §8.4–§8.5's `WalletPostureView`/`WalletDeficitResponse` contracts, which this document cites directly rather than inventing a parallel one; `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.2.8 "WALLET_DEFICIT" (Refinement Cycle 1)` in name only — same class, same citation, copy retained) · wallet effect: **clawback already applied; blocks new authorizations (`wallet_in_deficit`, unconditional and amount-independent, `WALLET-COMMITMENT-MODEL.md` §7.5) until cured** · Kai state: `concerned`, factual, no shame framing
  > "Your wallet balance is showing a deficit — a payment made earlier on this account was reversed after those funds had already been used. New packages can't be authorized until this is resolved; adding funds brings the balance back to zero."
  > "This account currently has a negative wallet balance, from a reversed charge on funds that were already spent. This doesn't affect your dispute letters or case history — it only pauses new fulfillment holds until you add funds."
  > *On-behalf-of:* "New fulfillment holds for your case are paused right now — your agency's CreditVector Wallet needs a balance correction before we can continue. This doesn't affect your case history or dispute letters."

- **`BALANCE_ADJUSTED_CHARGEBACK`** (scenario 16(d) — the one *automatic* branch in the refund family, driven by a verified Stripe webhook signal; new class) · wallet effect: **clawback**, may drive the fold negative into deficit posture · Kai state: `concerned`
  > "A charge that funded part of your CreditVector Wallet was reversed by your bank or card issuer, so I've adjusted your wallet balance to match. This doesn't affect your case history or dispute letters — it only affects funds available for new fulfillment holds."
  > "Your CreditVector Wallet balance changed because an earlier top-up was reversed on the card side. The balance now reflects that. If this wasn't something you expected, reach out and we can look into it together."

  **(Self-pay only.)** This class is inherently account-level — tied to a wallet's own top-up funding event, never a specific client's subject — so it has no per-client dimension to voice a second variant for; a managed client's own case view never surfaces an agency's top-up chargeback, since it isn't about any of their letters at all.

- **`REFUND_UNDER_REVIEW`** (scenario 16(a)/(b)/(c) — address-failure-after-settle, returned-after-delivered, or the post-acceptance-cancellation-confirmed-stopped fact already narrated once by `CANCEL_CONFIRMED_RARE` above; new class) · wallet effect: **`founder_gate_pending`** — no automatic change; a manual, CCO/counsel-surfaced `adjust` may follow, never guaranteed · Kai state: `concerned`
  > "This package's charge is under manual review — [reason: the address stopped working after this was already charged / it came back undelivered after being marked delivered / the cancellation you requested was confirmed after acceptance, as I explained earlier]. I can't move money on my own for this; our team reviews it individually, and I'll tell you the moment there's a decision."
  > "There's an open review on this package tied to its charge. Nothing about your balance changes until our team makes a call on it — I'll let you know as soon as they do."
  > *On-behalf-of:* "This package's charge to your agency is under manual review — [reason]. I can't move money on my own for this; our team reviews it individually with your agency, and you'll be updated the moment there's a decision."

  Never a promised outcome, never a promised timeline beyond "our team reviews it" — consistent with `lib/compliance.ts`'s outcome-guarantee posture (§2.4) even though this class narrates fulfillment money, not credit-report content.

- **`BALANCE_CORRECTED_MANUAL`** (scenario 16(e) — an owner-initiated `adjust`, always paired with `AdminAuditLog`; new class) · wallet effect: an owner-authored `adjust` entry, paired with `AdminAuditLog` (`WALLET-COMMITMENT-MODEL.md` §5.6's hard `missing_audit_log` refusal if unpaired) · Kai state: `concerned`
  > "Our team made a correction to your CreditVector Wallet balance following a manual review — this is a deliberate adjustment, not an automated one, and it's fully logged on our side."
  > "Your wallet balance was adjusted by our team after a manual review of this case. I don't have more detail to add beyond what's already been shared with you directly — reach out if you have questions about it."
  > *On-behalf-of:* "Our team made a correction to your agency's CreditVector Wallet balance following a manual review — a deliberate adjustment, not an automated one. It's fully logged on our side; reach out if there are questions."

### 2.4 Why every line clears the bar

- **`lib/compliance.ts` `PROHIBITED` table (`:3-36`)** — none of the lines above contain an outcome guarantee, a legal-conclusion assertion, a "failure to investigate" claim, a re-aging claim, an unauthorized-inquiry claim, or a §609/Metro-2 deletion myth. These lines narrate fulfillment mechanics, not credit-report content, so the table's actual regexes (all scoped to dispute-letter substance) don't apply by subject matter either — restated here as a positive check, not assumed by category. `REFUND_UNDER_REVIEW` and `CANCEL_CONFIRMED_RARE` (§2.3.7, §2.3.12) are the two classes closest to sounding like an outcome promise; both are written to state a review is happening without ever promising its result, mirroring `PROHIBITED`'s own "I guarantee" → "I expect"-shaped correction in spirit even though neither regex fires here.
- **Never "Failed"** — zero occurrences, by design (§2.1.1). Every class uses a specific, honest verb (`couldn't accept`, `hasn't confirmed`, `didn't clear`, `wasn't accepted`, `was mailed`) tied to a named cause and a named correction path.
- **Never a raw vendor error or vendor name** — every line is generated from `RecoveryVerdict.kaiCopyClass` + `.basis`, never from an adapter's raw response body or `MailProviderError.message`. This is the same DTO-boundary discipline `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §7.1's Vendor Opacity law names for API responses and audit strings, applied here to Kai's copy generation: **the input to Kai's translation is always a `RecoveryVerdict`, never a provider payload**, and, as of this revision, `basis` itself is additionally closed to the enumerated set in §2.1.3 — two independent layers, not one, closing the gap `COMMITMENT-REGATE.md` named ("Vendor Opacity DTO unenforced until [`basis`] is a closed union").
- **Emotional-range law (`lib/kaiStates.ts:11-27`)** — every state used above (`concerned`, `bad-news`, `waiting`, `good-news`) is a real `KaiStateId`. `SUPERSEDES: KAI-FULFILLMENT-UX.md §2.3 (Refinement Cycle 1)`: Cycle 1's catalog and this same "clears the bar" section both used `calm` as a Kai state — `calm` is the *conceptual* emotional-range-law adjective named in `lib/kaiStates.ts`'s header comment, but it is **not** a member of the exported `KaiStateId` type (`idle`/`happy`/`concerned`/`teaching`/`celebrating`/`reviewing`/`analyzing`/`waiting`/`explaining`/`welcoming`/`good-news`/`bad-news`/`congratulations`/`thinking`/`searching`/`listening`). Every occurrence is corrected above to `good-news` (the closest real state for a plainly-stated positive resolution — "quiet satisfaction delivering a positive fact... never gloats") or `concerned`, as appropriate to each line; none reach for `celebrating`/`congratulations` even on good news (a release is `good-news`, not `celebrating` — restoring a balance is not a milestone win, matching `kaiStates.ts:43`'s "states the fact, then next watch-item"). No line is written with fear/alarm energy; `WALLET_DEFICIT`'s and `CANCEL_CONFIRMED_RARE`'s copy in particular are deliberately flat and factual, per this document's own assignment ("factual, no shame framing" / "steady, not alarmed").
- **Package preservation, always stated or implied concretely** — every line either says the letter/package is unchanged, or states exactly what portion is unaffected (§2.3.8's split case). None ever imply data loss.
- **On-behalf-of voice, applied where a wallet fact is stated (§2.2)** — every class that narrates a concrete hold/settlement/release/deficit fact carries a second, agency-attributed variant; the two classes marked self-pay-only (`FULFILLMENT_STALLED_INVESTIGATING`'s two situations, `CONCURRENT_ACTION_LOST`, `BALANCE_ADJUSTED_CHARGEBACK`) are marked so because they state no money fact with a per-client dimension, not because the check was skipped.

---

## 3. Truthful Money Narration

### 3.1 Authorization — "a hold, not a charge" (exact copy, both voices)

**Self-pay:**
> "This is a hold, not a charge. **$[X.XX]** is set aside from your CreditVector Wallet balance while CreditVector Fulfillment reviews this package — nothing is deducted yet."

**On-behalf-of** (new in this revision, `COMMITMENT-REGATE.md` register-incompleteness finding, §2.2's rule):
> "This is a hold, not a charge. **$[X.XX]** is set aside from your agency's CreditVector Wallet balance to cover this package while CreditVector Fulfillment reviews it — nothing is deducted yet, and nothing is charged to you directly."

Fires at Approve, when `authorizeGroup` succeeds (§1.1 — the FIRST consent moment, not FINAL REVIEW), and is re-stated at FINAL REVIEW via ✓2 (§1.2). The amount is the exact `estimatedTotalCentsShown` value the operator already saw at Approve and will see again at FINAL REVIEW (§1.5) — never a new, possibly-different number computed after the fact. Voice selected per §2.2's rule.

### 3.2 Settlement at acceptance (exact copy, both voices)

**Self-pay:**
> "CreditVector Fulfillment has accepted this package for production. The hold is now final — **$[X.XX]** has been applied, and there's nothing further you need to do to keep it moving."

**On-behalf-of:**
> "CreditVector Fulfillment has accepted this package for production. Your agency's hold is now final — **$[X.XX]** has been applied to their CreditVector Wallet balance, and there's nothing further you need to do to keep it moving."

Fires at `ACCEPTED` (wallet **settle**, per the ruling at `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §3.3: settle at provider Accepted, the first externally-verifiable commitment). This is the moment the FINAL REVIEW warning (§1.2) was about; the copy here does not repeat the warning, it simply confirms the fact has now occurred — and, per Ruling 3, this fact is now **permanent** (§2.3.7).

### 3.3 Release — "your balance was restored" (truthfulness gate, both voices)

**Binding invariant, unchanged and restated because it is the single most important honesty rule in this document:** the phrase **"your balance was restored" (or its on-behalf-of equivalent) may render only after the `release` ledger entry has actually committed** — never when a release has merely been *requested*, *initiated*, or is *expected*. This is the same zero-fabrication discipline already shipped as `RESERVED`/`"Available after live mail integration"` placeholders (`lib/mailCenter.ts:84,224-230`) and `mailStatusLine()`'s `null`-default (`app/journey/page.tsx:56-58`) — a system that has told the truth by omission everywhere else must not start inventing an optimistic-but-unconfirmed financial fact here, where the cost of being wrong is a consumer (or a managed client) believing money has moved that hasn't.

**Self-pay:**
> "The hold on this package was released — your balance was restored."

**On-behalf-of:**
> "The hold on this package was released — your agency's balance was restored."

Mechanically: this copy is rendered from a SYSTEM-emitted signal — `WALLET_RELEASED@1` (`WALLET-COMMITMENT-MODEL.md` §10.3, now concretely defined: `walletId`, `entryId`, `subjectId`, `attempt`, `authorizationEntryId`, `centsDelta` (positive), `totalCents`, `basis` — closing what Cycle 1 left as an undefined dependency, §6) — never from the UI's own optimistic state after firing a cancel/release request. The same L3 law (Kai reads the stream, never writes it; every fact traces to a `basis`) applied to money instead of case narration. §2.3.7's and §2.3.10's copy already follow this — both only ever say "was restored" in verdict classes where the release is the confirmed, completed fact, never in `CANCEL_REQUEST_ACKNOWLEDGED_PENDING` (§2.3.7), which deliberately withholds any restoration language because nothing has actually been restored yet, and **never** in `CANCEL_CONFIRMED_RARE` (§2.3.7) — Ruling 3's point precisely, restated here at the canonical-copy level: post-acceptance, this phrase is never available to reach for, in either voice, because the wallet stayed settled.

### 3.4 Deficit posture copy (both voices)

Canonical short form (for surfaces with limited space — a Mail Center row or a Kai Presence pill):

**Self-pay:**
> "Wallet balance: deficit. New fulfillment holds are paused until this is resolved."

**On-behalf-of:**
> "Your agency's wallet balance: deficit. New fulfillment holds for your case are paused until this is resolved."

Full form: §2.3.12 above. Both forms share the same two rules regardless of voice: **factual** (states what happened — a reversed charge on already-spent funds — without editorializing) and **no shame framing** (never "you owe us," never a collections register; the cure is stated as a neutral next action — "adding funds brings the balance back to zero" — mirroring the Brief S3 cure path, "fund or owner `adjust`").

### 3.5 The §611 clock — corrected anchor (F8) — UNCHANGED in this revision

Per `REFINEMENT-2-DIRECTIVE.md` item 6: this section remains anchored at `RETURN_RECEIPT_ARCHIVED`, counsel-pending per F2/Q6. Nothing below is edited from the prior revision.

**`SUPERSEDES: D-KAI-EXPERIENCE.md §4.5` (the "Mailed" row) and, by extension, its downstream copy at `app/journey/page.tsx:100` referenced there as the pattern being reused.**

| | Copy | Anchor | Status |
|---|---|---|---|
| **Before (wrong)** | *"Your package was mailed — the §611 clock started."* | `Letter.mailedAt` / `package.mailed` (`MAILED` stage) | `ADVERSARIAL-REVIEW.md` F8: *"FCRA §611(a)(1)(A) runs from CRA receipt... D's proposed copy is wrong by the full transit time on a compliance-sensitive surface."* |
| **After (corrected)** | **"[Recipient] has received this package — the §611 clock starts today."** | `RETURN_RECEIPT_ARCHIVED` stage (evidence-backed delivery confirmation) | Matches the unified state machine's own already-adopted transition (`CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §3.4 mermaid: `RETURN_RECEIPT_ARCHIVED --> WAITING_PERIOD : clock starts (derive-on-read, no event written)`) |

**Why this anchor, not `DELIVERED`:** the architecture already has two candidate post-mail signals — `DELIVERED` (a carrier tracking scan) and `RETURN_RECEIPT_ARCHIVED` (the signed electronic return receipt, i.e. confirmed evidence of receipt, Founder ruling #3's mandatory evidence artifact). The unified state machine's own diagram anchors the derived waiting-period clock at `RETURN_RECEIPT_ARCHIVED`, not `DELIVERED` — this document adopts that as the single anchor across Kai's narration, closing the "three conflicting anchors" F8 found (the unified diagram, D's old prose, and shipped code's `mailedAt`), rather than introducing a fourth.

**This is the best-available *engineering-honest* correction, not a legal sign-off.** `ADVERSARIAL-REVIEW.md` §3's counsel-question draft (Q6) explicitly asks outside counsel to *"confirm the correct consumer-facing framing"* for this exact statement — that question remains open per this document's own header note (S7). If counsel returns a different required framing (e.g., a stated buffer beyond receipt, or an explicit non-precise-date disclaimer), this line is superseded again, by a ratified update, under the same discipline as §1.2's warning-softening law — never silently.

Deficit/waiting companion note: this line reuses `forecastFor()`'s existing own-history/contingency text verbatim where available (`lib/forecast.ts:70-98`, per `D-KAI-EXPERIENCE.md` §1.5) — W3 does not re-derive that machinery, only replaces the anchor sentence it's paired with.

---

## 4. Notification Moments

### 4.1 Surface mapping

In-app only, v1 (ADR-0027 posture, restated from `D-KAI-EXPERIENCE.md` §3.3 — not re-litigated: D-07/D-08 and all 5 ADR-0027 §5 preconditions still block email/push for fulfillment content, and doubly so here since Recovery moments are still credit-communication content). Extending D §3.1's happy-path table (which did not cover failure/recovery moments) to the nineteen classes above plus the four money moments in §3, with `kaiCopyClass` names updated to match §2.3's reconciled catalog:

| Moment | KaiPresence (single-slot) | Case Memory ("while you were away") | Mail Center row |
|---|---|---|---|
| `CORRECTION_NEEDED_ADDRESS` / `RETRY_NEEDED_TECHNICAL` | Yes — becomes the one recommendation if no higher-priority item is in flight (§4.2) | Entry logged | `kaiIntel` bullet + health pill shifts toward `NEEDS_ATTENTION` |
| `TEMPORARY_DELAY` / `PROCESSING_LONGER_THAN_USUAL` | Only if it crosses a staleness threshold (`RECOVERY-ENGINE.md`'s `staleAfter`, Brief S6) — otherwise silent, matching "quiet is allowed" | Not logged while merely waiting | Timeline stage stays `current`, no fabricated new stage |
| `SUBMISSION_NOT_COMPLETED_YET` / `CORRECTION_NEEDED_GENERAL` | Yes — high priority | Entry logged, "while you were away" if it happened off-session | `kaiIntel` bullet; health pill → `NEEDS_ATTENTION` |
| `RETRY_IN_PROGRESS` | Soft — informational until it resolves | Entry logged | Row shows the new attempt in progress |
| `PACKAGE_PARTIAL_PROGRESS` | Yes — the released portion is the actionable half | Entry logged | Row shows the split explicitly (per-letter, not package-collapsed — Brief S2) |
| `CANCELLED_CLEAN_RELEASE` | Confirmatory only (operator's own action) | Entry logged | Timeline reflects `CANCELED` |
| `CANCEL_REQUEST_ACKNOWLEDGED_PENDING` | Yes, until resolved either way | Entry logged | Row shows "cancellation requested" pending state, never a guessed outcome |
| `CANCEL_CONFIRMED_RARE` | Yes — high priority (a financially consequential fact, never soft-pedaled) | Entry logged | Row shows canceled *and* the settled-charge fact, never one without the other |
| `CANCEL_NOT_POSSIBLE_PROCEEDING` | Yes, once | Entry logged | Row reflects normal continued processing |
| `FULFILLMENT_STALLED_INVESTIGATING` | Only past a defined watch threshold, else silent | Not logged while within normal variance | Timeline stage stays truthful (`current`, never a fabricated "delayed" badge with no threshold behind it) |
| `HOLD_EXPIRED_RELEASED` | Soft — informational, resolved | Entry logged (it's a real balance-affecting event even though it's good news) | `kaiIntel` note; health pill returns toward normal |
| `CONCURRENT_ACTION_LOST` | Immediate, to the losing operator only | Not logged on the append-only fulfillment trail (operator-activity level only, `RECOVERY-ENGINE.md` §4 scenario 15) | Not surfaced as a package-level event |
| `WALLET_DEFICIT` | Yes — **account-wide**, outranks any single package (§4.2) | Entry logged | Not package-scoped; surfaces once at the account/Mail-Center level, not per row |
| `BALANCE_ADJUSTED_CHARGEBACK` | Yes — account-wide, alongside `WALLET_DEFICIT` if it triggers one | Entry logged | Not package-scoped |
| `REFUND_UNDER_REVIEW` | Yes, until resolved | Entry logged | Row shows "under review" pending state |
| `BALANCE_CORRECTED_MANUAL` | Soft — informational | Entry logged | Reflected in balance history, not a new alarm |
| §3.1–§3.4 money moments (authorized/settled/released/deficit) | Authorized/settled: confirmatory only. Released/deficit: yes, per above | All logged (balance-affecting facts) | Reflected in the evidence/price context, not a new surface |

### 4.2 Anti-overwhelm — one recommendation, priority ladder for Recovery moments

`D-KAI-EXPERIENCE.md` §4.2 (verified: `app/api/kai/context/route.ts:14,16-21`) already establishes **one recommendation, one deadline** account-wide, never multiplied per package. This document's priority ordering **among Recovery verdicts specifically**, names updated to §2.3's reconciled catalog:

`WALLET_DEFICIT` / `BALANCE_ADJUSTED_CHARGEBACK` (account-wide; blocks all new authorization, so it outranks everything package-scoped) → `CANCEL_CONFIRMED_RARE` (a financially consequential, settled fact — never buried) → `CORRECTION_NEEDED_GENERAL` / `CORRECTION_NEEDED_ADDRESS` / `RETRY_NEEDED_TECHNICAL` / `SUBMISSION_NOT_COMPLETED_YET` (operator-actionable defects) → `PACKAGE_PARTIAL_PROGRESS` (part of it needs action) → `REFUND_UNDER_REVIEW` / `CANCEL_REQUEST_ACKNOWLEDGED_PENDING` (outcome pending, operator or team already acted) → `TEMPORARY_DELAY` / `PROCESSING_LONGER_THAN_USUAL` / `FULFILLMENT_STALLED_INVESTIGATING` (watching, not yet actionable) → `HOLD_EXPIRED_RELEASED` / `CANCELLED_CLEAN_RELEASE` / `CANCEL_NOT_POSSIBLE_PROCEEDING` / `BALANCE_CORRECTED_MANUAL` / `RETRY_IN_PROGRESS` (informational, resolved or in expected motion) → `CONCURRENT_ACTION_LOST` (immediate but operator-local, never competes with account-wide items).

When multiple verdicts are simultaneously true, **only the single highest-priority one occupies the KaiPresence slot** — exactly the same fixed-priority-single-pick law `pickRecommendation()` already enforces (`lib/kaiHome.ts:60-67`), applied to Recovery verdicts as its own priority ladder rather than reusing `pickRecommendation()`'s internal branches.

### 4.3 What this section does not (re)decide

The effect layer (actual email/push sends) stays designed-not-built per ADR-0027 — restated, not re-argued (`D-KAI-EXPERIENCE.md` §3.3 already did this work). `notify.plan` alignment for Recovery moments follows the identical shape D §3.2 already specified (`purpose` strings like `"package_rejected"`, `"wallet_deficit"`; `commercial: false` always) — W3 adds no new decision-only-capability design here, only names which Recovery moments would eventually map to which `purpose` strings, for whenever the FOUNDER-GATE lifts.

---

## 5. Supersession Map — `D-KAI-EXPERIENCE.md`

No section of `D-KAI-EXPERIENCE.md` beyond what Cycle 1 already identified is newly touched by Refinement Cycle 2 (verified: `D-KAI-EXPERIENCE.md` has no cancellation section and no FINAL-REVIEW-placement section for Ruling 3/4 to collide with, and no on-behalf-of/agency content for §2.2's addition to collide with — both are net-new territory, not supersessions). The rows below are refreshed for accuracy where this revision's expanded scope changes a stated count or detail; no new rows are added.

| D-KAI-EXPERIENCE.md § | What it said | What changes here | Why |
|---|---|---|---|
| §1.1 row 4, §1.2 (`package.funded`) | Proposed `package.funded` KaiEvent for Wallet Authorized | **Not re-decided here** — already renamed `package.authorized` at `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §5.4 (docket #13), before this program began. Restated for completeness in §3.1, not re-litigated. Unchanged from Cycle 1. | Avoid two documents claiming ownership of the same rename |
| §4.4 (`fulfillment.status = FAILED/RETURNED` row) | Used the placeholder key `FAILED` in the emotional-mapping table | `SUPERSEDES: D-KAI-EXPERIENCE.md §4.4`'s `FAILED/RETURNED` row specifically — replaced by the disambiguated `kaiCopyClass` keys in §2.1–§2.3. **Refreshed this revision:** the disambiguated set is now **nineteen** classes (§2.1.2), reconciled against `RECOVERY-ENGINE.md`'s real handles rather than Cycle 1's ten-class placeholder draft. The rest of §4.4's table (delivered/waiting.ready_for_review rows) is **not** superseded — carried forward as-is. | `FAILED` doesn't exist as an operator-facing (or even `FulfillmentStage`) value; the real machine already disambiguates it (§2.1.1), and `RECOVERY-ENGINE.md` disambiguates further, into the 17-scenario matrix |
| §4.5 ("Wallet Authorized" row) | *"Funding is authorized. CreditVector Fulfillment will accept it next."* | `SUPERSEDES: D-KAI-EXPERIENCE.md §4.5` (Wallet Authorized row) — replaced by §3.1's exact copy, *"This is a hold, not a charge..."* **Refreshed this revision:** §3.1 now also carries the on-behalf-of voice variant (§2.2). | Brief S8 retires ambiguous "funding" language in favor of `hold`/`authorize` vocabulary; the old line doesn't state the hold-not-charge fact at all, and didn't account for a non-self-pay viewer |
| §4.5 ("Mailed" row) | *"Your package was mailed — the §611 clock started."* | `SUPERSEDES: D-KAI-EXPERIENCE.md §4.5` (Mailed row) — replaced by §3.5's corrected line, anchored at `RETURN_RECEIPT_ARCHIVED`, not `MAILED`. **Unchanged this revision** — item 6 of `REFINEMENT-2-DIRECTIVE.md` leaves this flag exactly as it was. | `ADVERSARIAL-REVIEW.md` F8 — the single highest-priority correction Cycle 1 made; still counsel-pending per F2/Q6 |
| §0 L2 "Gap found" (vendor-name leakage, no compiled guard) | Flagged a gap, proposed a static regex | **Not superseded — reinforced, twice over now.** §2.4 (Cycle 1) added the structural safeguard that Kai's translation input is always a `RecoveryVerdict`, never a provider payload. **§2.1.3 (new this revision)** adds a second, independent layer underneath it: `RecoveryVerdict.basis` itself is now closed to an enumerated set, so even a mis-populated `basis` field can't smuggle a vendor string through where the input-type guarantee alone wouldn't catch it. | `ADVERSARIAL-REVIEW.md`'s own verdict: the regex is "weak... the DTO is the load-bearing control" — this document now supplies two layers of that discipline for Kai's copy layer specifically |
| §2.4 ("Approval moment — Kai steps back") | Stated the law: Approve never inside a Kai panel | **Not superseded — concretized, and now correctly sequenced.** §1.1/§1.4 are this law's UX execution; this revision corrects Cycle 1's placement error (Ruling 4) without touching the law itself — Approve (the hold-triggering control) and Submit (the FINAL REVIEW control) both remain outside any Kai-labeled panel, now across three renders instead of two. | D stated the law; B found the violation; Cycle 1 built the first UX draft; Cycle 2 corrects its sequencing without reopening the law |
| §3 (Notification Model) | Covered the 8 happy/neutral §1.10 stage moments | **Extended, not superseded** — §4 adds the Recovery/failure moments D's table didn't cover, now refreshed to the reconciled nineteen-class catalog. D's original 8-row table stands unchanged. | New subsystem (Brief ruling #5), new moments; no conflict with the old ones |
| §1.1 rows 6/9 (`fulfillment.status` illustrative payload values) | Used `"CARRIER_ACCEPTED"` for USPS Accepted | **Not re-decided here** — already corrected to `"USPS_ACCEPTED"` at `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §3.2 (docket #16), before this program began. Unchanged from Cycle 1. | Same reason as the `package.funded` row — avoid re-litigating an already-closed docket |

---

## 6. Open Joins for the Merge (Agent E)

1. **Recovery Engine verdict-handle reconciliation — RESOLVED this revision, was open in Cycle 1.** §2.1's `RecoveryVerdict` interface is now `RECOVERY-ENGINE.md` §2's real, quoted-verbatim type, and §2.3's nineteen classes are keyed to its actual §4 matrix handles (renames noted inline per class). Remaining, narrower join: if `RECOVERY-ENGINE.md` §4 is ever revised to split or merge a scenario (e.g., further dividing `PACKAGE_PARTIAL_PROGRESS`), the affected catalog entries should be re-keyed, not necessarily re-written, following the same principle Cycle 1 established.
2. **Audit-record persistence mechanism.** §1.6 specifies required fields, not a table; §1.5 (new this revision) additionally specifies the `FinalReviewToken`'s required fields, not its own table. Whether `FinalReviewConfirmation`/`FinalReviewToken` are new dedicated tables or an extension of the existing `MailAudit`/manifest audit-trail shape is Agent A/W1's domain-model decision (migration-first, additive-only per repo canon) — this document takes no position beyond "both must be persisted, system-written, and carry these fields, and the confirmation row must be written from the consumed token's fields, never from a second client-supplied copy."
3. **The `release`-confirmed signal's concrete shape — RESOLVED this revision, was open in Cycle 1.** §3.3's truthfulness gate now cites `WALLET_RELEASED@1` (`WALLET-COMMITMENT-MODEL.md` §10.3) directly: `walletId`, `entryId`, `subjectId`, `attempt`, `authorizationEntryId`, `centsDelta` (positive), `totalCents`, `basis` — a concrete, PII-denylist-compliant contract, not a named dependency on an undesigned event.
4. **§611 anchor remains counsel-pending — unchanged this revision.** §3.5's corrected copy is this document's best engineering-honest fix, resolving the *internal* three-way conflict (F8) — it does not resolve `ADVERSARIAL-REVIEW.md` §3's Q6, which is still an open outside-counsel question per this document's own header (S7). A future counsel answer may supersede §3.5 again. Per `REFINEMENT-2-DIRECTIVE.md` item 6, this flag is deliberately left as-is.
5. **Certified-mail line-item transparency** feeding the Approve/FINAL REVIEW price display (§1.4's price-breakdown reuse) depends on the fix named at `B-MAIL-CENTER-EVOLUTION.md` §4.2 / `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §9 (docket #8) — `MailPricing.computePrice()`'s lump-sum collapse. This document assumes that fix ships before Approve/FINAL REVIEW does; it is not re-argued or re-designed here. Unchanged from Cycle 1.
6. **`RecoveryVerdict.basis` closed-union ratification — new this revision.** §2.1.3 specifies the exact enum and the Vendor Opacity DTO guard it must satisfy. Changing `RECOVERY-ENGINE.md` §2's `basis: string` to the literal closed type, and wiring the same enum into the shared DTO validator, is Agent B/W2's file to change — named here as a dependency, not designed by this document.
7. **`FinalReviewToken` issuance/consumption wiring — new this revision.** §1.5 specifies the token's required fields and validation rule; whether it shares one issuance/consumption event with `RECOVERY-ENGINE.md` §5's `submissionToken` or remains a second, distinct value is unconstrained by this document — an implementation choice for whoever builds the Approve/Submit routes, not a design gap.

---

**Summary for the merge:** Two consent moments, not one (Ruling 4): **Approve** (chain step 7) shows price and line-items and triggers the reversible authorization hold (`authorizeGroup`); **FINAL REVIEW** is the pre-Submit, point-of-no-return gate — re-showing price, carrying the four persisted checkbox assertions bound to a server-issued, single-use, expiring token (`contentHash`/`warningVersion`/`estimatedTotalCentsShown`/`policyVersion`), sitting strictly **after** the hold and immediately **before** Submit. This corrects Cycle 1's placement, which put FINAL REVIEW before the hold and was in direct, undocketed conflict with `WALLET-COMMITMENT-MODEL.md`'s own sequence diagram (N8a) — the correction is stated explicitly at §1.1, not silently folded in. The Kai failure-translation catalog now covers all nineteen `kaiCopyClass` handles the reconciled `RECOVERY-ENGINE.md` matrix implies (up from Cycle 1's ten, blind-drafted before that document existed), including the single most consequential fix in this revision — `CANCEL_CONFIRMED_RARE` (Ruling 3): once CreditVector Fulfillment accepts a package, Kai never again says "your hold was released" or "nothing was charged," in any voice; the letter was mailed, the charge stands, and any remediation is a manual, FOUNDER-GATE-reviewed accounting matter, never an automatic reversal and never a promised outcome. Every money-narration line — the four canonical ones in §3 and every wallet-fact-bearing catalog class in §2.3 — now carries a self-pay voice and an on-behalf-of voice, selected by comparing the viewing account against the ledger's `onBehalfOfId` (`WALLET-COMMITMENT-MODEL.md` §9), closing the register-incompleteness finding that a managed client was, until this revision, always told a fact about money that was never theirs. `RecoveryVerdict.basis` is now a closed, enumerated union, added as a second, independent layer under the Vendor Opacity DTO guard already protecting Kai's translation input from ever seeing a provider payload — closing the last unenforced free-string gap `COMMITMENT-REGATE.md` named. The §611 clock (§3.5) is untouched, exactly as directed, and remains counsel-pending per F2/Q6. No spine deviation: every placement, rename, and vocabulary choice traces to a numbered ruling, a named finding, or an already-resolved docket — none invented independently.
