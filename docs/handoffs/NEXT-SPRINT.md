# Next Sprint Recommendation — CreditVector Fulfillment Engine v1.0

## The recommendation

**The next sprint is not Wallet implementation.** Implementation is blocked on two hard preconditions that no amount of additional architecture work resolves: the CROA §404 counsel question and Gate D Phase −1 (see `docs/handoffs/EXECUTIVE-SUMMARY.md`). Starting Phase 1 migrations or Phase 3 wallet code before either clears would put working code behind decisions that could still reshape or invalidate it — specifically, a counsel answer requiring a charge-at-completion restructure (Stripe manual-capture) would obsolete the prepaid Wallet mechanics this entire refinement cycle just spent two rounds hardening.

Instead, the next sprint is four small, bounded, non-implementation items — none of them touches product code, and all four can run in parallel:

## (a) Route the CROA §404 counsel question

**What:** Send the fully-formulated six-part outside-counsel question in `docs/fulfillment/ADVERSARIAL-REVIEW.md` §3.4 to outside consumer-finance counsel. The question is already written, cites the exact facts (prepaid stored-value wallet, top-up-in-advance, capture-at-provider-acceptance, the $0.99 + 15% fee structure including the markup on the certified surcharge itself, no wallet expiry), and names the compliant alternative (Stripe manual-capture: authorize at Approval, capture at Delivered / Return-Receipt-Archived) so counsel can rule on either path.

- **Entry criteria:** none — the question is finished and ready to send today.
- **Exit criteria:** a written counsel opinion on (1) whether CreditVector is a "credit repair organization" under §1679a(3) notwithstanding its educational-tool positioning, (2) whether the prepaid wallet violates §1679b(b)'s advance-fee prohibition, (3) whether Stripe manual-capture at Delivered/Receipt-Archived is compliant, (4) the §1679c/d/e/f disclosure and cancellation obligations, (5) state CSO statute exposure, (6) confirmation of the correct §611 clock framing.
- **What stays gated:** every Wallet implementation phase (Phase 3 onward, `IMPLEMENTATION-SEQUENCE.md`), and by extension any UI that shows a wallet balance or authorization screen to a real operator.

## (b) Execute Gate D Phase −1

**What:** Run Gate D's mandated baseline resolve and land the versioned manifest extension per the Identity Constitution's Slice 7/ID-B02 remediation, exactly as `docs/fulfillment/ADVERSARIAL-REVIEW.md` F1 specifies. This is infrastructure work already named and already blocking — it does not wait on the CROA answer, and nothing about this fulfillment program invented it; it is a pre-existing ratified-canon precondition this program simply surfaced as newly relevant (five new migrations are queued behind it: `Case`, `DisputePackage`, `DisputePackageLetter`, `Claim`, `WalletLedger`).

- **Entry criteria:** the existing Gate D runbook (`.ai/RUNBOOKS/gate-d-production-migration.md`, referenced by `IMPLEMENTATION-SEQUENCE.md` §2.2) plus confirmation that production still has no `_prisma_migrations` history.
- **Exit criteria:** Gate D executed; production `_prisma_migrations` history exists; the schema-safety preflight accepts a seventh migration directory; Phase 0/1 entry criteria in `IMPLEMENTATION-SEQUENCE.md` can be restated as actually clear.
- **What stays gated:** all five Phase 1 migrations remain unqueued until this completes — none of them should be attempted first.

## (c) A tiny documentation-correction pass

**What:** Two small, distinct groups of pending corrections, neither of which reopens the model or requires a new Founder decision:

**The 3 LOW-severity doc-fidelity items** — named explicitly as sub-must-fix-list items in `docs/fulfillment/ADVERSARIAL-REVIEW.md`'s closing "Below the cut" paragraph, never yet applied:
1. `IMPLEMENTATION-SEQUENCE.md` §1(b) asks the Founder to rule on "ADR-0041–0045," omitting ADR-0046/0047 from that Phase-0 review list, even though Phase 5 requires ADR-0046 accepted and 0047 is a constitutional amendment.
2. `C-WALLET-INTEGRATION.md` §7 (FI-2) claims "every transition wrapped in a claim key," but §3.6 omits `fund` from that coverage.
3. `ADR-PROPOSALS.md`'s header rationale contradicts its own (correct) closing numbering note.

**The pending base-package document corrections** — recorded but not yet applied, per `docs/fulfillment/COMMITMENT-RESOLUTION.md` §4:
- **F11** — amend `A-POLICY-ENGINE.md` §2: add `PolicyInput.estimate: CostEstimate`, supplied by the calling route (which invokes `estimateCost`), preserving the engine's own no-network law.
- **F13** — restore the binding 9-step Package Review chain wherever the merge drifted to 12 (`CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §1 row 9, and `IMPLEMENTATION-SEQUENCE.md` §5/§9); repoint the cross-reference to `B-MAIL-CENTER-EVOLUTION.md` §3.1, which already has it correct.
- **F14** — reconcile `A-DOMAIN-MODEL.md` §1.6/§2.6: remove the two new destructive `User` cascades (`Case.userId`, `DisputePackage.userId`), align to `Restrict` everywhere on the new domain per the ratified Identity Constitution's ID-H06 remediation, and add `@@unique([letterId, attempt])` in place of `@@unique([letterId])`.
- **ADR-0044 supersession** — apply `WALLET-COMMITMENT-MODEL.md` §13's supersession map into the ADR-0044 file itself (its `Decision`/`Security implications` clauses are selectively superseded but the ADR text still reads as originally written).
- Plus, in the same pass: add ADR-0046/0047 to the Phase-0 Founder review list (overlaps item 1 above — fix once), restate the vendor-opacity control as the runtime DTO rather than a static source regex, and map `D-KAI-EXPERIENCE.md`'s superseded sections per `KAI-FULFILLMENT-UX.md` §5's map.

- **Entry criteria:** none — every correction is fully specified in an existing document; this is transcription and reconciliation, not design.
- **Exit criteria:** all seven items applied as direct edits to the named base-package documents (`A-POLICY-ENGINE.md`, `A-DOMAIN-MODEL.md`, `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md`, `IMPLEMENTATION-SEQUENCE.md`, `ADR-PROPOSALS.md`, `ADR-0044`, `D-KAI-EXPERIENCE.md`); no other content in those documents changes.
- **What stays gated:** nothing new — this pass changes no decision, per `COMMITMENT-RESOLUTION.md` §4's own framing ("recorded, not yet applied... they change no decision made here").

## (d) Design-only LetterStream conformance tests

**What:** Build out the adapter conformance test *design* (not the tests themselves as running code, and never live wiring) specified in `docs/fulfillment/A-PROVIDER-ABSTRACTION.md` §8 and extended by `docs/fulfillment/FULFILLMENT-COMMITMENT-BOUNDARY.md` §2.2: interface completeness, dry-run/live symmetry, status-mapping totality (no fallback to a forward-progress status), rate-card containment, error-code fidelity, no vendor-name leakage — plus the rule that **no `MailProviderId` may be selected via `MAIL_PROVIDER` for a live job until its own 11-question vendor-confirmation answer set exists** (§2.2, generalized beyond LetterStream to Lob/PostGrid/Click2Mail/any future adapter).

- **Entry criteria:** `A-PROVIDER-ABSTRACTION.md` §8's conformance contract (already written) and `FULFILLMENT-COMMITMENT-BOUNDARY.md` §2.1's 11-question list (already written).
- **Exit criteria:** a written test-plan document naming every conformance case and every one of the 11 questions as a named gate on that adapter's live-selection eligibility — no code written, no vendor contacted as part of this item (vendor contact is a separate, Founder/ops-owned action, not an engineering task).
- **What stays gated:** `MAIL_LIVE` stays OFF; no adapter (LetterStream or otherwise) is wired live regardless of how this design work concludes — that is Order 5 in `IMPLEMENTATION-SEQUENCE.md` §8's flag activation order, its own separately-gated runbook, never bundled with any other flip.

## Summary table

| Item | Blocks | Blocked by | This sprint's deliverable |
|---|---|---|---|
| (a) CROA counsel question | All Wallet implementation (Phase 3+) | Nothing — ready today | A sent question; a received opinion |
| (b) Gate D Phase −1 | All 5 new migrations (Phase 1) | Nothing — ready today | An executed gate; a restored migration path |
| (c) Doc-correction pass | Nothing new — corrects existing pending items | Nothing | 7 small edits across 6 documents |
| (d) LetterStream conformance test design | `MAIL_LIVE` activation (Order 5, far downstream) | Nothing — design only | A written test-plan document, no code |

None of these four items requires implementation, a new Founder decision beyond what's already been ruled, or touches product code, schema, or flags. All four can proceed in parallel starting immediately.
