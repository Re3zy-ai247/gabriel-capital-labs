# KAI-FULFILLMENT-UX.md — FINAL REVIEW, Kai Failure Translation, Truthful Money Narration

Agent W3 (Commitment Refinement) — architecture only, per `docs/fulfillment/COMMITMENT-REFINEMENT-BRIEF.md`. No product code, no schema, no dependency, no vendor change, no commit. This document is a **refinement** of `D-KAI-EXPERIENCE.md` under the Brief's rule: *"The prior package remains authoritative except where a refinement doc explicitly supersedes a section (every supersession must be labeled `SUPERSEDES: <doc §>`)."* §6 below is the full supersession map.

**CROA posture note (Brief S7, verbatim, carried in every refinement doc's header):** *Settlement-at-acceptance strengthens the §1679b(b) posture versus capture-at-top-up but does NOT moot the counsel question — funds are still received in advance at top-up. The counsel question (ADVERSARIAL-REVIEW §3.4) remains the hard precondition before any wallet implementation phase. F1 (Gate D Phase −1) also stands.* Nothing in this document is a substitute for that counsel answer; the copy below is written to be truthful and non-adverse **regardless** of how that question resolves, but does not resolve it.

**Vocabulary lock (Brief S8):** `authorize` / `settle` / `release` / `clawback` / `adjust`; `hold`; `commitment boundary`; `recovery`. The word **`consume` is retired** — every place a prior artifact (D-KAI-EXPERIENCE.md, the unified `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md`) said `consume`/`void`/`refund`, this document says `settle`/`release`/`clawback` per S2's entry-kind definitions. No exceptions below.

**Labels:** `PROPOSED` = new design, not yet founder-approved. `FOUNDER-GATE` = requires explicit Founder ratification (a decision, an ADR, or the CCO compliance gate at Program Brief §4) before it may ship, even flag-off. `VENDOR-CONFIRMATION-REQUIRED` = the S5 LetterStream cancellation-window fact specifically — used only where that exact fact is load-bearing, not generically.

**W2 status, checked at time of writing:** `docs/fulfillment/FULFILLMENT-COMMITMENT-BOUNDARY.md` and `docs/fulfillment/RECOVERY-ENGINE.md` do **not exist on disk** (verified by directory listing immediately before drafting §2). §2.1 below names the expected Recovery Engine verdict-handle grammar as this document's own `PROPOSED` placeholder and flags the reconciliation as an open join for Agent E — it does not invent W2's design, only gives the Kai catalog something concrete to key against.

---

## 1. The FINAL REVIEW Interaction

### 1.1 Placement in the chain — after PDF Preview, before Wallet Authorization

The Founder's 9-step Package Review chain (Program Brief §1.9, restored as binding per `ADVERSARIAL-REVIEW.md` F13 over the merge's drifted 12-step count):

> Client → Kai Summary → Recommended Disputes → Educational Explanation → Letter Preview → PDF Preview → **Approve** → Download → Send with CreditVector Fulfillment.

`B-MAIL-CENTER-EVOLUTION.md` §3.1 row 8–9 already established that **Wallet Authorization inserts between Approve and the Download/Send fork** — it is not one of the Founder's nine named steps, it is the concrete mechanism the "Approve" step's consequence triggers. **FINAL REVIEW is the evolved Approve step**, not an additional tenth step: it is what `Approval()` (`app/mail/send/[letterId]/page.tsx:165-205`) becomes once split per §1.4 below. The resulting sequence:

```
6. PDF Preview
7. FINAL REVIEW  ← evolved Approve step (this section)
   — Wallet Authorization (hold placed; new, Agent C/W1's territory)
8–9. Download Package / Send with CreditVector Fulfillment (co-equal fork)
```

**Why this order, argued from the Brief's own transaction model (ruling #2), not asserted:**

> balance exists → **Approve** → **Authorization Hold** (not deduction) → CreditVector validation → Submit → Vendor accepts → Permanent Settlement → production → mail.

The Founder's own model places Approve strictly *before* the Authorization Hold. FINAL REVIEW does not just happen to sit there — it is the reason that ordering is correct: the operator must give informed, checked, audited consent to the **eventual** irreversibility (which doesn't occur until Vendor Accepts, several steps later) *before any money is touched at all*, not merely before it becomes permanent. By the time the hold is placed (step 7→Wallet Authorization), and long before settlement (Vendor Accepts), the operator has already affirmatively confirmed they understand mailing cannot be undone once accepted. Reversing the order — placing a hold first, then asking for irreversibility confirmation — would mean money moves before consent is captured, which is the exact defect pattern (money-before-confirmation) the Brief's S5 boundary exists to close. No deviation from the spine here; this is S5 and ruling #2 read together, not a new argument.

### 1.2 The screen

**Title (Founder's copy skeleton, exact):** `CreditVector Fulfillment — FINAL REVIEW`

Rendered as the heading of the **non-Kai operator-chrome** card (§1.4) — never inside a Kai-labeled panel, never carrying the `KAI` badge.

**The four ✓ assertions.** Each is architected to be a genuine, independently meaningful, individually-auditable fact — not four decorative rewordings of "I agree." Each maps to one thing this program already knows must be true before money or mail happens, and each is `unchecked by default` (no assertion may ever pre-populate as checked, including on a re-render, a slow network retry, or a resumed session — see §1.7):

| # | Assertion (operator-facing copy) | What it actually attests | Cites |
|---|---|---|---|
| ✓1 | "I've reviewed the letter(s), recipient(s), and address(es) in this package in the PDF preview, and they're correct." | The operator actually looked at the exact content that will mail — not a rubber stamp. Ties to the **same content-hash proof-of-intent** mechanism already shipped (`hashFromAudit()`, `app/mail/send/[letterId]/page.tsx:28-34`; `Receipt()`'s "Letter hash (proof of intent)" field, `:270`) — the audit row below persists the hash of what was actually shown, not a label. | PDF Preview step (chain step 6); existing hash precedent |
| ✓2 | "I understand this places a hold — not a charge — on my CreditVector Wallet balance for the estimated total shown, and that the hold becomes final only if CreditVector Fulfillment accepts this package." | The financial-boundary fact (S5a): authorization ≠ settlement, settlement occurs only at provider acceptance. Ties directly to §3.1's exact authorization copy. | Brief ruling #2; S5(a) |
| ✓3 | "I've read the warning below and understand that once CreditVector Fulfillment accepts this package for production, it cannot be reversed." | Acknowledgment of the operational-irreversibility fact (S5b) — references the WARNING block rather than restating it, so the two never drift out of sync. | S5(b); §1.2 WARNING block below |
| ✓4 | "I'm mailing this for myself" **or** "I'm mailing this on behalf of [client name], and I'm authorized to act for their case." (radio-style single assertion, copy branches on `onBehalfOf`) | The payer/spend-authority fact (S4): who the real operator is, and whose case this is, stated affirmatively by the person taking the action — not inferred later from a session cookie. Also the only assertion that is structurally **unreachable** in the one case S4 forbids outright: admin impersonation. If the current session is an impersonation session, FINAL REVIEW does not render at all (money actions blocked, read-only view) rather than rendering this checkbox in a state that could be checked — see §1.4. | S4 (payer/spend-authority; admin-impersonation block) |

None of the four is checked by rendering; none may be checked by a default prop, a cached value, or a "select all" control. A single native `<input type="checkbox">` per assertion (§1.6) — never a styled `<div>` masquerading as one.

**The WARNING block (Founder's copy skeleton, architected per S5 worst case):**

> **Once CreditVector Fulfillment accepts this package for production, it cannot be reversed.**
> This is CreditVector Fulfillment's current understanding of how production works — cancellation after acceptance is not guaranteed, and we will not promise it can be undone. If you need to stop this package, do it before you approve below.

Two sentences, deliberately: the bold first line is the assertion ✓3 references; the second line is the honesty qualifier the S5 worst-case posture requires. Notably, this copy makes **no reference to LetterStream, "the vendor," "the provider," or any named entity** — it speaks only in CreditVector Fulfillment's own voice, satisfying the Vendor Opacity law (§2 below) even in operator-chrome copy that isn't Kai's.

**`VENDOR-CONFIRMATION-REQUIRED` note (not shown to the operator, binding on maintainers):** This warning states the worst case per S5(b) because LetterStream's actual cancellation window (API acceptance vs. payment vs. print queue vs. printing vs. USPS handoff) is not in the repository and must not be invented. **Per S5's copy law: if the vendor later confirms an actual cancellation/grace window, this warning may only be *softened* by a ratified update — never silently edited.** Concretely: a future change to this copy requires (a) a dated vendor-confirmation record of the actual window, (b) a founder-approved doc revision that supersedes this exact paragraph with an explicit `SUPERSEDES: KAI-FULFILLMENT-UX.md §1.2` label, and (c) a version bump in the audit record's `warningVersion` field (§1.5) so historically-confirmed operators' audit rows still show the version *they* actually saw and agreed to. A maintainer who independently learns LetterStream has a grace window has **no authority to loosen this copy on their own** — the ratification is the point, not the fact-check.

Visual precedent: same amber/gold, non-alarm register already shipped in `Payment()`'s live-mailing notice (`app/mail/send/[letterId]/page.tsx:230-235`, `border-gold-500/30 bg-gold-500/10 text-gold-400`, `Lock` icon) — but rendered with more visual weight than that box (always expanded, not a footnote, positioned directly above the four checkboxes so it is physically read before they can be checked in natural reading order). Never red/error-coded: per `lib/kaiStates.ts`'s emotional-range law, concern is "steady and on it... amber accent... zero fear energy" — this applies to operator-chrome tone too, not only Kai's own voice, because a red "danger" treatment on a legitimate, expected step (every package goes through this) would itself be a form of manufactured urgency the Room Constitution's binding qualifiers prohibit (`OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §2, "no fabricated telemetry, progress, or urgency").

### 1.3 Checklist semantics

- **Not pre-checked, ever** — including on `Back`/`Forward` browser navigation within the same session, a component re-mount, or a resumed session after a dropped connection. A checkbox's checked state is **client-only, ephemeral UI state** until the moment of successful `Approve` submission; it is never restored from a cache, a draft, or a partial prior attempt (§1.7 makes this explicit against the existing resumability precedent, because resumability generalizes the *step index*, never the *assertion state*).
- **The Approve button is `disabled` until all four are checked** — mirrors the existing `disabled={busy}` pattern already on the same button (`:198`); add `disabled={busy || !allFourChecked}`. This is a plain client-side UX gate, not a security boundary — the **server-side** route enforces the same rule independently (a `POST` with fewer than four `true` assertions is refused with the same class of 400 the round2 gate already uses, `app/api/letters/[id]/round2/route.ts:32-43`, so a scripted or replayed request can't skip consent).
- **Each ✓ is a real assertion, not a confirmation of having "seen" something.** The copy is written in first person, present tense, stating what the operator now affirms — never "I acknowledge this message was displayed," which asserts nothing about the operator's own understanding.

### 1.4 The KAI-badge/Approve split — concrete rendering

`ADVERSARIAL-REVIEW.md` §2 rates this disposition **"Sound... best-executed item after the Room Constitution."** Verified against the actual JSX: today's `Approval()` (`app/mail/send/[letterId]/page.tsx:165-205`) opens with the `KAI` badge and an `<h2>` (`:168-171`) inside the *same* `<div className="card p-5">` that holds the `Approve & continue` button (`:198-200`) — one card, one Kai voice, one money-adjacent control, structurally conflated. `D-KAI-EXPERIENCE.md` §2.4's law: *"the Approve control must never render inside a Kai-labeled panel."*

**Concrete split, two cards, in this order:**

1. **Kai-labeled explanation card** (keeps the `KAI` badge) — recipient/round/address/mail-class context, i.e. today's `<dl>` block (`:174-184`) plus the letter-preview link (`:186-188`). This is Agent D's Kai Summary territory (`D-KAI-EXPERIENCE.md` §2.1) rendering a package-scoped digest; W3 does not redesign its contents, only confirms it must end *before* the next card begins, never bleed into it.
2. **FINAL REVIEW card** (no `KAI` badge anywhere in its DOM — not the word, not the pill, not an icon implying Kai's voice) — title (§1.2), the estimated-total price breakdown (existing precedent: `Payment()`'s itemized `p.lines.map(...)`, `:213-218` — reused, not re-derived, and must already be honest per `B-MAIL-CENTER-EVOLUTION.md` §4.2's certified-line fix, a Policy-Engine-owned prerequisite this document assumes but does not re-argue), the WARNING block, the four checkboxes, and the `Approve` button. This is the operator's own page chrome per D's law — Kai may have explained everything leading up to this card; it never sits inside it.

This is the concrete execution of the ruling already made in `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §8 (docket #7) and `B-MAIL-CENTER-EVOLUTION.md` §3.2 — W3 does not re-litigate the split decision, only specifies exactly what renders in the resulting non-Kai card now that it also carries the FINAL REVIEW content.

### 1.5 Audit record — persisted, not decorative

Per the Brief's Recovery Constitution direction (ruling #6: "every failure → deterministic state + preserved audit") and the general principle that a compliance-sensitive consent screen is worthless if the consent isn't provable later, each successful FINAL REVIEW confirmation persists a row. **W3 specifies the required fields as a contract; the concrete table/column design (new dedicated table vs. an extension of the existing `MailAudit` append-only shape) is Agent A/W1's domain-model call — flagged as an open join, §7.**

```
FinalReviewConfirmation (conceptual shape — persistence mechanism is W1/Agent A's to place)
{
  packageId:              string
  actorUserId:            string            // the REAL operator identity (S4) — never the client's id
                                              // when an agency operator is acting for them
  onBehalfOf:              string | null     // client id, when applicable; null for self-service — the
                                              // exact ✓4 branch, persisted, not just displayed
  confirmedAt:            ISO-8601 timestamp
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

This is deliberately **not** gated by ADR-0006 (the Kai-AI-output persistence founder-gate) — it is a structured consent/compliance record in the same class as `MailAudit`'s existing append-only entries, not AI-composed prose. It is written by SYSTEM code (the approve route), exactly like every existing `recordKaiEvent`/`appendAudit` call site (D-KAI-EXPERIENCE.md L3) — Kai never writes it, Kai may narrate that it happened.

### 1.6 Accessibility — keyboard, focus, ≥44px, aria

Per the Room Constitution's binding qualifiers (`OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §2) and the existing, already-shipped idioms in this exact file and `KaiPresence.tsx`:

- **Touch targets ≥44px** — every checkbox's clickable hit area (input + its `<label>`, not the bare input box) and the Approve button itself meet the `min-h-[44px]` convention already used sitewide in this file (`:110-113,198-201,239-242`). A checkbox's native rendered box is smaller than 44px in most browsers — the fix is a `<label>` wrapping both the input and its text with `min-h-[44px] flex items-center` so the whole row is the hit target, not just the 16px box.
- **Native semantics, not ARIA simulation** — real `<input type="checkbox">` + `<label htmlFor=...>` pairs. No `role="checkbox"` on a `<div>`; a native input gets space-to-toggle, screen-reader state announcement ("checked"/"not checked"), and form semantics for free, matching this codebase's existing preference for native elements over ARIA-simulated ones (e.g. this same file's real `<button disabled>` rather than a styled clickable span).
- **Grouping** — the four checkboxes sit inside a `<fieldset>` with a `<legend>` reading "Before you approve" (visually styled, not `sr-only` — this is the exact discipline `KaiWhy.tsx`'s uncertainty section already follows: a caveat/gate section renders at the *same* visual weight as everything around it, never quieter). The WARNING block is referenced by `aria-describedby` from the fieldset, so a screen-reader user landing on the checkboxes is told what they relate to without having to have already read every preceding paragraph.
- **Reading order = DOM order = tab order** — WARNING block, then ✓1→✓4 in the table's order, then the Approve button, with no `tabIndex` overrides. This is the same "reading order" discipline the FTC clear-and-conspicuous parity note in `KaiWhy.tsx:62-66` already applies to uncertainty sections — a consent gate must never be reachable "out of order" via tab navigation in a way that lets a keyboard user land on Approve before passing through the assertions.
- **Live error region** — reuses the exact existing pattern `role="alert" aria-live="polite"` (`:196,237`) for a submission error (e.g., the hold couldn't be placed) — never a silent failure.
- **Focus on submit-blocked** — if a keyboard user tabs to a disabled Approve button and it's disabled, that's sufficient (disabled buttons are already skipped by nothing — they remain focusable and announce "disabled" natively); no custom focus-stealing is needed or wanted, consistent with `KaiPresence.tsx`'s discipline of *only* moving focus on genuine open/close transitions (`:76-84`), never opportunistically.
- **No color-only meaning** — the WARNING block's amber tone is reinforced by the `Lock`/warning icon and by text, never by color alone (Room Constitution §2's binding qualifiers, inherited from Program Brief §2.6's "§9 forbidden patterns... no color-only meaning").

### 1.7 Resumability — server-derived step precedent, checkbox state never resumed

Existing precedent, generalizes cleanly (`B-MAIL-CENTER-EVOLUTION.md` §3.3, verified against `load()`'s status→step mapping, `app/mail/send/[letterId]/page.tsx:66-68`): `QUEUED→step 3`, `APPROVED|PAID→step 2`, else `step 1`. The 9-step chain extends this **at the step-index level only**:

- If the operator navigates away and returns **before** a successful Approve submission, the Package's canonical stage is still pre-`WALLET_AUTHORIZED` — they land back on FINAL REVIEW, and **all four checkboxes render unchecked**, full stop. This is not a bug to be smoothed over with a saved draft: a checkbox is a fresh, moment-in-time attestation (§1.3), and a "helpfully" pre-filled checkbox from a half-finished prior visit would violate the "not pre-checked" law in spirit even though it renders from real prior client state — the fix is that no such state is ever persisted client-side across a navigation in the first place (component-local `useState`, not `localStorage`, not a query param).
- If the operator **did** successfully confirm (the audit row in §1.5 exists) and then navigates away, the server-derived stage is now at or past `WALLET_AUTHORIZED` — resuming **skips FINAL REVIEW entirely** and lands on the Wallet Authorization step or wherever the canonical stage points, exactly as `APPROVED|PAID→step 2` already skips past a completed step today. FINAL REVIEW is never re-shown for an already-confirmed package; there is no "re-approve" flow. If a correction is later needed (e.g., a rejection triggers `attempt+1`), that is a **new** attempt with a **new** confirmation and a **new** audit row — not a reopened old one.

---

## 2. Kai Failure-Translation Catalog

### 2.1 Verdict-handle grammar — PROPOSED, open join for the merge

The Brief's S6 assigns the Recovery Engine (W2) ownership of "failure taxonomy (all 17 Founder scenarios)" and states it is, like the Policy Engine, "a pure decision core, zero AI, every verdict carries `basis`." **W2's `RECOVERY-ENGINE.md` does not exist on disk as of this writing** (confirmed by directory listing). The ten failure/recovery classes named in this document's own assignment are a subset of that eventual 17-scenario matrix, not a competing enumeration of it. To give the catalog below something concrete to key against, this document proposes a verdict shape mirroring the already-proven `PolicyDecision`/`KaiRecommendation` idiom (a `basis`-carrying decision record, `lib/kaiHome.ts:28`, `A-POLICY-ENGINE.md`'s `PolicyDecision`):

```ts
// PROPOSED by this document — NOT W2's design. Reconcile against RECOVERY-ENGINE.md
// when it exists; rename this column, not the Kai copy it's keyed to (§7).
interface RecoveryVerdict {
  verdictType: RecoveryVerdictType;
  packageId: string;
  letterId?: string;        // present at per-letter grain (Brief S2) — partial acceptance, per-letter release
  attempt: number;          // Brief S2's attempt dimension
  walletEffect: "released" | "settled" | "none" | "clawback";
  correctionPath:
    | "resubmit_same_attempt_plus_one"   // REJECTED → PREPARED, same mailId, attempt+1 (Brief S2)
    | "correct_address_new_manifest"     // RETURNED_TO_SENDER → PREPARED, new manifest suffix
    | "await_provider"                  // no operator action possible yet
    | "await_carrier"
    | "add_funds_or_owner_adjust"        // deficit cure (Brief S3)
    | "operator_none";                  // informational only, nothing to do
  basis: string;             // the receipt — mirrors PolicyDecision.basis / KaiRecommendation.basis
}

type RecoveryVerdictType =
  | "ADDRESS_INVALID"              // §2.2.1
  | "PACKAGE_SPEC_INVALID"          // §2.2.2
  | "PROVIDER_UNAVAILABLE"          // §2.2.3
  | "PACKAGE_REJECTED"              // §2.2.4 — corresponds to manifest FAILED, reason-coded, per A-STATE-MACHINE.md:83-85
  | "PACKAGE_PARTIALLY_ACCEPTED"    // §2.2.5
  | "CANCELLATION_CONFIRMED"        // §2.2.6a — pre-acceptance
  | "CANCELLATION_REQUESTED"        // §2.2.6b — post-acceptance, best-effort
  | "AUTHORIZATION_RELEASED"        // §2.2.7
  | "WALLET_DEFICIT"                // §2.2.8
  | "RECEIPT_OVERDUE"               // §2.2.9
  | "TRACKING_STALLED";             // §2.2.10
```

**Why not just "FAILED"** — `D-KAI-EXPERIENCE.md` §4.4's emotional-mapping table used the placeholder key `fulfillment.status = FAILED/RETURNED`. Checked against the actual state machine: the manifest-level `FAILED` status is *already* disambiguated at the `FulfillmentStage` layer into `REJECTED` / `ADDRESS_FAILURE` / `PROVIDER_ERROR` by reason code (`A-STATE-MACHINE.md:83-85,114-116`) — three different causes, three different correction paths. Collapsing them back to one Kai-facing "Failed" would undo the exact disambiguation the state machine was built to provide, on top of directly violating Founder ruling #4 ("Kai never says 'Failed'"). This catalog keys to the disambiguated verdict, never the collapsed manifest status.

### 2.2 The catalog

Every line below: first person, translates the internal signal, **preserves the package** (never implies data was lost), **names a correction path**, never the word "Failed," never a raw vendor error string, never a vendor name (`letterstream`/`lob`/`postgrid`/`click2mail`/`postalmethods` — Vendor Opacity law, §2.3). Emotional state per `lib/kaiStates.ts`'s concrete catalog (D-KAI-EXPERIENCE.md §4.4's law, extended here to these ten classes).

**2.2.1 — `ADDRESS_INVALID`** · wallet effect: **none** (usually caught pre-authorization, `A-STATE-MACHINE.md:116`) or **released** (rare post-authorization CASS re-check, FOUNDER-GATE) · Kai state: `concerned`
> "I couldn't confirm a mailable address for [Recipient]. Nothing about this package was lost — it's saved exactly as you built it. Update the address and I'll have it ready to send again in one step."
> "This package needs a working address for [Recipient] before I can send it. Your hold wasn't affected — fix the address here and it's ready to go."

**2.2.2 — `PACKAGE_SPEC_INVALID`** (invalid PDF/print requirements) · wallet effect: **none** · Kai state: `concerned`
> "This package doesn't meet CreditVector Fulfillment's print requirements yet — something in the page count or formatting needs another look. The letter itself hasn't changed; open the preview and I'll show you what to adjust."
> "One of the documents in this package isn't in a shape CreditVector Fulfillment can print reliably yet. Nothing has been sent. Re-check the preview, and resend when it looks right."

**2.2.3 — `PROVIDER_UNAVAILABLE`** (outage/timeout) · wallet effect: **none** (hold stays active, untouched) · Kai state: `waiting`/`concerned`
> "CreditVector Fulfillment hasn't confirmed this package yet. I'll keep checking and tell you the moment it does — your hold is exactly where it was, and nothing has been charged."
> "This is taking longer to confirm than usual. Your package and your hold are both untouched — I'm still watching, and I'll flag it here the moment anything changes."

**2.2.4 — `PACKAGE_REJECTED`** · wallet effect: **released** · Kai state: `bad-news`
> "CreditVector Fulfillment couldn't accept this package as submitted. Your hold was released — nothing was charged. I've kept the letter and flagged what needs fixing so you can resend."
> "This package didn't clear CreditVector Fulfillment's acceptance check. Your balance is back to where it was before you approved. Take a look at what I flagged below — this is ready to go again in one step."

**2.2.5 — `PACKAGE_PARTIALLY_ACCEPTED`** (per-letter settlement, Brief S2) · wallet effect: **mixed — settled per accepted letter, released per rejected letter** · Kai state: `concerned` (factual about the accepted portion, actionable about the rest)
> "Part of this package is moving: [N] of [N total] letters were accepted and are on their way. [M] couldn't be accepted — that portion's hold came back to your balance, and I've flagged what to fix so you can resend just that piece."
> "This package split: [Recipient A] is confirmed and in production; [Recipient B] wasn't accepted, and that hold was released. Nothing changes for Recipient A — fix Recipient B here when you're ready."

**2.2.6 — Cancellation outcomes** · Kai state: `calm` (confirmed) / `concerned` (requested, honest)
- **`CANCELLATION_CONFIRMED`** (pre-acceptance — clean) · wallet effect: **released**
  > "This package is canceled. CreditVector Fulfillment hadn't accepted it yet, so your hold was released in full — nothing was charged."
  > "Canceled, as requested. Since this hadn't been accepted yet, the entire hold came back to your balance right away."
- **`CANCELLATION_REQUESTED`** (post-acceptance — best-effort, S5) · wallet effect: **none yet, outcome-dependent**
  > "I've sent a cancellation request for this package, but CreditVector Fulfillment already accepted it — I can't promise it will stop in time. I'll tell you the moment I know either way, and nothing changes with your hold until I do."
  > "This cancellation request went out after CreditVector Fulfillment's acceptance, so it isn't guaranteed to take effect. Your hold stays as-is for now — I'll update you as soon as there's a real answer."

**2.2.7 — `AUTHORIZATION_RELEASED`** (e.g., reconciliation-sweep timeout — Brief S6, "a hold never converts to settlement by timeout") · wallet effect: **released** · Kai state: `good-news`/`calm`
> "The hold on this package was released — your balance was restored. This can happen when CreditVector Fulfillment hasn't confirmed a package within the expected window. Nothing about your letter changed, and you can resend whenever you're ready."
> "Your balance was restored. The hold tied to this package didn't turn into a confirmed mailing in time, so I let it go rather than leave it open indefinitely. The letter is exactly as you left it."

**2.2.8 — `WALLET_DEFICIT`** (Brief S3 clawback posture) · wallet effect: **clawback already applied; blocks new authorizations until cured** · Kai state: `concerned`, factual, no shame framing
> "Your wallet balance is showing a deficit — a payment made earlier on this account was reversed after those funds had already been used. New packages can't be authorized until this is resolved; adding funds brings the balance back to zero."
> "This account currently has a negative wallet balance, from a reversed charge on funds that were already spent. This doesn't affect your dispute letters or case history — it only pauses new fulfillment holds until you add funds."

**2.2.9 — `RECEIPT_OVERDUE`** · wallet effect: **none** · Kai state: `concerned` (watching, not alarmed)
> "This package was delivered, but the electronic return receipt hasn't come back yet — it's taking longer than usual. I'm still watching for it; nothing else about your case is waiting on it yet."
> "Delivery is confirmed for this package. The signed return receipt hasn't arrived yet, which does happen — I'll let you know the moment it's archived with your case."

**2.2.10 — `TRACKING_STALLED`** · wallet effect: **none** · Kai state: `concerned` (watching, not alarmed)
> "Tracking on this package hasn't updated in longer than I'd expect. That doesn't necessarily mean anything went wrong — carrier updates can lag. I'm still watching, and I'll flag it here the moment there's a change."
> "I haven't seen a tracking update for this package in a while. Your package and hold status are unaffected — I'll surface the next update as soon as it comes in."

### 2.3 Why every line clears the bar

- **`lib/compliance.ts` `PROHIBITED` table (`:3-36`)** — none of the 20 lines above contain an outcome guarantee, a legal-conclusion assertion, a "failure to investigate" claim, a re-aging claim, an unauthorized-inquiry claim, or a §609/Metro-2 deletion myth. These lines narrate fulfillment mechanics, not credit-report content, so the table's actual regexes (all scoped to dispute-letter substance) don't apply by subject matter either — restated here as a positive check, not assumed by category.
- **Never "Failed"** — zero occurrences, by design (§2.1). Every class uses a specific, honest verb (`couldn't accept`, `hasn't confirmed`, `didn't clear`, `wasn't accepted`) tied to a named cause and a named correction path.
- **Never a raw vendor error or vendor name** — every line is generated from the `RecoveryVerdict.verdictType` + `basis`, never from an adapter's raw response body or `MailProviderError.message`. This is the same DTO-boundary discipline `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §7.1's Vendor Opacity law names for API responses and audit strings, applied here to Kai's copy generation: **the input to Kai's translation is always a `RecoveryVerdict`, never a provider payload** — this is structurally stronger than the static regex guard `ADVERSARIAL-REVIEW.md` rated "weak" (*"a static source regex gives false assurance — the DTO is the load-bearing control"*), because there is no vendor string in the input at all for a regex to have missed.
- **Emotional-range law (`lib/kaiStates.ts:7-9`)** — every state used above (`concerned`, `bad-news`, `waiting`, `calm`, `good-news`) is in the allowed set; none reach for `celebrating`/`congratulations` even on good news (§2.2.7's release is `good-news`, not `celebrating` — restoring a balance is not a milestone win, matching `kaiStates.ts:43`'s "states the fact, then next watch-item — never gloats"). No line is written with fear/alarm energy; §2.2.8's deficit copy in particular is deliberately flat and factual, per this document's own assignment ("factual, no shame framing").
- **Package preservation, always stated or implied concretely** — every line either says the letter/package is unchanged, or states exactly what portion is unaffected (§2.2.5's split case). None ever imply data loss.

---

## 3. Truthful Money Narration

### 3.1 Authorization — "a hold, not a charge" (exact copy)

> "This is a hold, not a charge. **$[X.XX]** is set aside from your CreditVector Wallet balance while CreditVector Fulfillment reviews this package — nothing is deducted yet."

Fires at the `WALLET_AUTHORIZED` stage (`package.authorized` event, per the already-ratified rename at `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §5.4 docket #13 — this document restates, does not re-decide, that rename). The amount is the exact `estimatedTotalCentsShown` value the operator already saw and attested to at FINAL REVIEW (§1.5) — never a new, possibly-different number computed after the fact.

### 3.2 Settlement at acceptance (exact copy)

> "CreditVector Fulfillment has accepted this package for production. The hold is now final — **$[X.XX]** has been applied, and there's nothing further you need to do to keep it moving."

Fires at `ACCEPTED` (wallet **settle**, per the ruling at `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §3.3: settle at provider Accepted, the first externally-verifiable commitment — not at any earlier manifest-internal sub-step). This is the moment the FINAL REVIEW warning (§1.2) was about; the copy here does not repeat the warning, it simply confirms the fact has now occurred.

### 3.3 Release — "your balance was restored" (truthfulness gate)

**Binding invariant, stated plainly because it is the single most important honesty rule in this document:** the phrase **"your balance was restored" may render only after the `release` ledger entry has actually committed** — never when a release has merely been *requested*, *initiated*, or is *expected*. This is the same zero-fabrication discipline already shipped as `RESERVED`/`"Available after live mail integration"` placeholders (`lib/mailCenter.ts:84,224-230`) and `mailStatusLine()`'s `null`-default (`app/journey/page.tsx:56-58`) — a system that has told the truth by omission everywhere else must not start inventing an optimistic-but-unconfirmed financial fact here, where the cost of being wrong is a consumer believing they have money they don't yet have.

Mechanically: this copy is rendered from a SYSTEM-emitted signal (a Kai event or Recovery Engine verdict carrying `walletEffect: "released"`, fired only once the ledger fold reflects it), never from the UI's own optimistic state after firing a cancel/release request — the same L3 law (Kai reads the stream, never writes it; every fact traces to a `basis`) applied to money instead of case narration. §2.2.6 and §2.2.7's copy above already follow this — both only ever say "was restored" in verdict classes where the release is the confirmed, completed fact, never in `CANCELLATION_REQUESTED` (§2.2.6b), which deliberately withholds any restoration language because nothing has actually been restored yet.

### 3.4 Deficit posture copy

Canonical short form (for surfaces with limited space — a Mail Center row or a Kai Presence pill):

> "Wallet balance: deficit. New fulfillment holds are paused until this is resolved."

Full form: §2.2.8 above. Both forms share the same two rules: **factual** (states what happened — a reversed charge on already-spent funds — without editorializing) and **no shame framing** (never "you owe us," never a collections register; the cure is stated as a neutral next action — "adding funds brings the balance back to zero" — mirroring the Brief S3 cure path, "fund or owner `adjust`").

### 3.5 The §611 clock — corrected anchor (F8)

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

In-app only, v1 (ADR-0027 posture, restated from `D-KAI-EXPERIENCE.md` §3.3 — not re-litigated: D-07/D-08 and all 5 ADR-0027 §5 preconditions still block email/push for fulfillment content, and doubly so here since Recovery moments are still credit-communication content). Extending D §3.1's happy-path table (which did not cover failure/recovery moments — the Recovery Engine as a subsystem didn't yet exist when D was written) to the ten classes above plus the four money moments in §3:

| Moment | KaiPresence (single-slot) | Case Memory ("while you were away") | Mail Center row |
|---|---|---|---|
| `ADDRESS_INVALID` / `PACKAGE_SPEC_INVALID` | Yes — becomes the one recommendation if no higher-priority item is in flight (§4.2) | Entry logged | `kaiIntel` bullet + health pill shifts toward `NEEDS_ATTENTION` |
| `PROVIDER_UNAVAILABLE` | Only if it crosses a staleness threshold (Recovery Engine's `staleAfter`, Brief S6) — otherwise silent, matching "quiet is allowed" | Not logged while merely waiting | Timeline stage stays `current`, no fabricated new stage |
| `PACKAGE_REJECTED` | Yes — high priority | Entry logged, "while you were away" if it happened off-session | `kaiIntel` bullet; health pill → `NEEDS_ATTENTION` |
| `PACKAGE_PARTIALLY_ACCEPTED` | Yes — the released portion is the actionable half | Entry logged | Row shows the split explicitly (per-letter, not package-collapsed — Brief S2) |
| `CANCELLATION_CONFIRMED` | Confirmatory only (operator's own action) | Entry logged | Timeline reflects `CANCELED` |
| `CANCELLATION_REQUESTED` | Yes, until resolved either way | Entry logged | Row shows "cancellation requested" pending state, never a guessed outcome |
| `AUTHORIZATION_RELEASED` | Soft — informational, resolved | Entry logged (it's a real balance-affecting event even though it's good news) | `kaiIntel` note; health pill returns toward normal |
| `WALLET_DEFICIT` | Yes — **account-wide**, outranks any single package (§4.2) | Entry logged | Not package-scoped; surfaces once at the account/Mail-Center level, not per row |
| `RECEIPT_OVERDUE` / `TRACKING_STALLED` | Only past a defined watch threshold, else silent | Not logged while within normal variance | Timeline stage stays truthful (`current`, never a fabricated "delayed" badge with no threshold behind it) |
| §3.1–3.4 money moments (authorized/settled/released/deficit) | Authorized/settled: confirmatory only. Released/deficit: yes, per above | All logged (balance-affecting facts) | Reflected in the evidence/price context, not a new surface |

### 4.2 Anti-overwhelm — one recommendation, priority ladder for Recovery moments

`D-KAI-EXPERIENCE.md` §4.2 (verified: `app/api/kai/context/route.ts:14,16-21`) already establishes **one recommendation, one deadline** account-wide, never multiplied per package. This document adds the priority ordering **among Recovery verdicts specifically**, for when more than one package has a Recovery-relevant state at once — mirroring, not duplicating, `B-MAIL-CENTER-EVOLUTION.md` §2.2's health-priority ladder:

`WALLET_DEFICIT` (account-wide; blocks all new authorization, so it outranks everything package-scoped) → `PACKAGE_REJECTED` / `ADDRESS_INVALID` / `PACKAGE_SPEC_INVALID` (operator-actionable defects) → `PACKAGE_PARTIALLY_ACCEPTED` (part of it needs action) → `CANCELLATION_REQUESTED` (outcome pending, operator already acted) → `PROVIDER_UNAVAILABLE` / `RECEIPT_OVERDUE` / `TRACKING_STALLED` (watching, not yet actionable) → `AUTHORIZATION_RELEASED` / `CANCELLATION_CONFIRMED` (informational, resolved).

When multiple verdicts are simultaneously true, **only the single highest-priority one occupies the KaiPresence slot** — exactly the same fixed-priority-single-pick law `pickRecommendation()` already enforces (`lib/kaiHome.ts:60-67`), applied to Recovery verdicts as its own priority ladder rather than reusing `pickRecommendation()`'s internal branches (which don't know about Recovery verdicts at all — this is a sibling ladder, not an insertion into that function).

### 4.3 What this section does not (re)decide

The effect layer (actual email/push sends) stays designed-not-built per ADR-0027 — restated, not re-argued (`D-KAI-EXPERIENCE.md` §3.3 already did this work). `notify.plan` alignment for Recovery moments follows the identical shape D §3.2 already specified (`purpose` strings like `"package_rejected"`, `"wallet_deficit"`; `commercial: false` always) — W3 adds no new decision-only-capability design here, only names which Recovery moments would eventually map to which `purpose` strings, for whenever the FOUNDER-GATE lifts.

---

## 5. Supersession Map — `D-KAI-EXPERIENCE.md`

| D-KAI-EXPERIENCE.md § | What it said | What changes here | Why |
|---|---|---|---|
| §1.1 row 4, §1.2 (`package.funded`) | Proposed `package.funded` KaiEvent for Wallet Authorized | **Not re-decided here** — already renamed `package.authorized` at `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §5.4 (docket #13), before this program began. Restated for completeness in §3.1, not re-litigated. | Avoid two documents claiming ownership of the same rename |
| §4.4 (`fulfillment.status = FAILED/RETURNED` row) | Used the placeholder key `FAILED` in the emotional-mapping table | `SUPERSEDES: D-KAI-EXPERIENCE.md §4.4`'s `FAILED/RETURNED` row specifically — replaced by the disambiguated verdict-type keys in §2.1/§2.2 (`ADDRESS_INVALID`/`PACKAGE_REJECTED`/etc.), each with its own emotional-state mapping. The rest of §4.4's table (delivered/waiting.ready_for_review rows) is **not** superseded — carried forward as-is. | `FAILED` doesn't exist as an operator-facing (or even `FulfillmentStage`) value; the real machine already disambiguates it (§2.1) |
| §4.5 ("Wallet Authorized" row) | *"Funding is authorized. CreditVector Fulfillment will accept it next."* | `SUPERSEDES: D-KAI-EXPERIENCE.md §4.5` (Wallet Authorized row) — replaced by §3.1's exact copy, *"This is a hold, not a charge..."* | Brief S8 retires ambiguous "funding" language in favor of `hold`/`authorize` vocabulary; the old line doesn't state the hold-not-charge fact at all |
| §4.5 ("Mailed" row) | *"Your package was mailed — the §611 clock started."* | `SUPERSEDES: D-KAI-EXPERIENCE.md §4.5` (Mailed row) — replaced by §3.5's corrected line, anchored at `RETURN_RECEIPT_ARCHIVED`, not `MAILED` | `ADVERSARIAL-REVIEW.md` F8 — the single highest-priority correction this document makes |
| §0 L2 "Gap found" (vendor-name leakage, no compiled guard) | Flagged a gap, proposed a static regex | **Not superseded — reinforced.** §2.3 adds a structural safeguard (Kai's translation input is always a `RecoveryVerdict`, never a provider payload) alongside, not instead of, the eventual regex guard `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §7.1 already specifies as defense-in-depth only. | `ADVERSARIAL-REVIEW.md`'s own verdict: the regex is "weak... the DTO is the load-bearing control" — this document supplies exactly that DTO discipline for Kai's copy layer specifically |
| §2.4 ("Approval moment — Kai steps back") | Stated the law: Approve never inside a Kai panel | **Not superseded — concretized.** §1.1/§1.4 above are this law's first full UX execution (title, checkboxes, warning, split-card rendering), building on `B-MAIL-CENTER-EVOLUTION.md` §3.2's finding of the concrete violation. | D stated the law; B found the violation; this document is the UX that satisfies both |
| §3 (Notification Model) | Covered the 8 happy/neutral §1.10 stage moments | **Extended, not superseded** — §4 above adds the Recovery/failure moments D's table didn't cover (Recovery Engine didn't exist as a concept yet when D was written). D's original 8-row table stands unchanged. | New subsystem (Brief ruling #5), new moments; no conflict with the old ones |
| §1.1 rows 6/9 (`fulfillment.status` illustrative payload values) | Used `"CARRIER_ACCEPTED"` for USPS Accepted | **Not re-decided here** — already corrected to `"USPS_ACCEPTED"` at `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §3.2 (docket #16), before this program began. | Same reason as the `package.funded` row — avoid re-litigating an already-closed docket |

---

## 6. Open Joins for the Merge (Agent E)

1. **Recovery Engine verdict-handle reconciliation.** §2.1's `RecoveryVerdictType`/`RecoveryVerdict` shape is this document's own placeholder, not W2's. When `RECOVERY-ENGINE.md` lands, its actual verdict-type names must be reconciled against this table — the expectation is that only the *key* changes (a rename), not the Kai copy filed under it, since the copy was written from the underlying scenario, not from the placeholder name. If W2's 17-scenario matrix draws class boundaries differently than this document's ten (e.g., splits `PACKAGE_PARTIALLY_ACCEPTED` into finer states, or merges `RECEIPT_OVERDUE`/`TRACKING_STALLED`), the catalog entries should be re-keyed, not necessarily re-written.
2. **Audit-record persistence mechanism.** §1.5 specifies required fields, not a table. Whether `FinalReviewConfirmation` is a new dedicated append-only table or an extension of the existing `MailAudit`/manifest audit-trail shape is Agent A/W1's domain-model decision (migration-first, additive-only per repo canon) — this document takes no position beyond "it must be persisted, system-written, and carry these fields."
3. **The `release`-confirmed signal's concrete shape.** §3.3's truthfulness gate assumes a system-emitted signal exists that Kai can read *after* a `release` ledger entry commits (analogous to a `WALLET_RELEASED`-class event). Its Event Bus contract, payload shape, and PII-denylist compliance (`centsDelta`/`totalCents`/`basis`, never `amount*`/`balance*`/`reason*`, per `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §5.5) is W1/Agent C's territory — named here as a dependency, not designed.
4. **§611 anchor remains counsel-pending.** §3.5's corrected copy is this document's best engineering-honest fix, resolving the *internal* three-way conflict (F8) — it does not resolve `ADVERSARIAL-REVIEW.md` §3's Q6, which is still an open outside-counsel question per this document's own header (S7). A future counsel answer may supersede §3.5 again.
5. **Certified-mail line-item transparency** feeding the FINAL REVIEW price display (§1.4's Wallet-adjacent card) depends on the fix named at `B-MAIL-CENTER-EVOLUTION.md` §4.2 / `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §9 (docket #8) — `MailPricing.computePrice()`'s lump-sum collapse. This document assumes that fix ships before FINAL REVIEW does; it is not re-argued or re-designed here.

---

**Summary for the merge:** FINAL REVIEW is the evolved, split Approve step (chain step 7) — non-Kai operator chrome carrying the title, four persisted checkbox assertions, and an honest worst-case irreversibility warning — sitting after PDF Preview and strictly before Wallet Authorization, because the Founder's own transaction model already orders Approve before the hold and because informed consent to a later irreversible event must precede any money moving at all, not merely precede its permanence. The Kai failure-translation catalog covers ten classes in the Founder's two-example register, keyed to a proposed (not W2-authored) verdict grammar flagged for reconciliation, and is structurally vendor-opaque by construction (verdict-in, never provider-payload-in) rather than relying on the regex guard the adversarial gate rated weak. Money narration is exact-copy specified for authorization/settlement/release/deficit, and the §611 clock copy is corrected off `D-KAI-EXPERIENCE.md`'s mailed-anchor error to the state machine's own `RETURN_RECEIPT_ARCHIVED` anchor — flagged as engineering-honest, not a counsel sign-off. No spine deviation: every placement and vocabulary choice traces to Brief S1–S8 or an already-resolved docket, none invented independently. Open joins for Agent E: the verdict-handle reconciliation against W2's eventual matrix, the audit-row's concrete persistence table (Agent A/W1), the `release`-confirmed signal's Event Bus shape (W1), and the still-outstanding counsel question behind the §611 framing (F2/Q6).
