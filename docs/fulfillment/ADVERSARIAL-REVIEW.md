# CreditVector Fulfillment Engine v1.0 — Adversarial Review (Opus gate)

Single bounded adversarial pass · scope: docs/fulfillment/ @ f211f33 · read-only · all CONFIRMED findings verified against product source, not re-derived from the artifacts.

## GATE VERDICT: NOT READY for Founder delivery as implementable

Not because the architecture is wrong in aim — the domain model, provider abstraction, Kai boundary laws, and Room Constitution are genuinely strong and unusually well-grounded in real source. It is NOT READY because Phase 1 as sequenced is prohibited by ratified repository canon, because the wallet — the only genuinely new money-moving subsystem — contains three independently exploitable defects and a false safety claim, and because the single largest legal question the wallet raises (CROA §404 advance-fee) is not analyzed anywhere in 3,324 lines.

## 1. Ranked findings (14)

| # | Finding | Sev | Status |
|---|---|---|---|
| F1 | Phase 1's five migrations are blocked by ratified canon (ID-B02) and an unexecuted Gate D | CRITICAL | CONFIRMED |
| F2 | CROA §404 advance-fee: prepaid wallet is the most adverse shape available; zero analysis in package | CRITICAL | CONFIRMED (absence) |
| F3 | Wallet double-spend — the "atomic insert guard" takes no lock; "negative balances structurally impossible" is false | CRITICAL | CONFIRMED |
| F4 | Free-fulfillment exploit — consume-after-void unguarded; re-authorize structurally impossible | CRITICAL | CONFIRMED |
| F5 | Partial package failure has no settlement path — N-letter package + one-consume-per-package = money hole | HIGH | CONFIRMED |
| F6 | Top-up credits metadata.amountCents with allow_promotion_codes: true; chargebacks unrepresentable | HIGH | CONFIRMED |
| F7 | No payer/principal model — agency workspace and admin impersonation both spend the consumer's wallet as actor:"user" | HIGH | CONFIRMED |
| F8 | §611 clock has three conflicting anchors; shipped operator copy is legally wrong | HIGH | CONFIRMED |
| F9 | UNKNOWN_PROVIDER_STATUS quarantine and both retry paths are structurally impossible | HIGH | CONFIRMED |
| F10 | Delivery evidence: mandatory stage, deferred design, terminates the journey on failure | HIGH | CONFIRMED |
| F11 | Policy Engine cannot compute amountCents without breaking its own law 5; PolicyInput lacks the fields | MED-HIGH | CONFIRMED |
| F12 | Webhook ingestion is one paragraph — and it is what captures money and mints legal evidence | MED | CONFIRMED (thin) |
| F13 | Package Review chain is 12 steps in the merge, 9 in the binding Founder decision, with a dangling cross-ref | MED | CONFIRMED |
| F14 | Cascade policy internally contradictory; adds two new destructive User cascades against ratified prohibition | MED | CONFIRMED |

### F1 — CRITICAL — Phase 1 is prohibited by ratified canon, and Gate D has never run
IMPLEMENTATION-SEQUENCE.md §2.2 proposes five new migration directories (#7–#11) with exit criteria "all 5 migrations applied (production…)". .ai/IDENTITY-CONSTITUTION-IMPLEMENTATION-PLAN.md:41 records finding ID-B02 (BLOCKER): gate-d-preflight accepts exactly six directories and its test rejects a seventh — no seventh migration can pass Gate D today; governance prerequisite to every new migration. .ai/CURRENT-STATE.md:20 records Gate D itself as unexecuted ("5 operator tables NOT in prod yet") and :15 records production has no _prisma_migrations history at all (baseline resolve was preview-only), so migrate deploy alone fails on 0_init. The package's only contact with this is a stylistic "Precedent" citation. Phase 0's claim "Phase 1 has no founder-gated forks" is false three times over. Fix: a Phase −1 (execute Gate D with the mandated baseline resolve; land the versioned manifest extension per Identity Constitution Slice 7/ID-B02); restate Phase 0/1 entry criteria.

### F2 — CRITICAL — CROA §404 advance-fee (full analysis in §3)

### F3 — CRITICAL — The wallet's overdraft guard does not lock
C-WALLET-INTEGRATION.md §3.8's INSERT…SELECT balance guard acquires no lock under READ COMMITTED; two concurrent authorizes for different packages (different subjectId, so ON CONFLICT never fires) both observe the pre-spend balance → balance 100¢, two 60¢ holds → −20¢. The claim "Negative balances are structurally impossible" (also in ADR-0044) is false. The cited spendLetterCredits precedent is safe only because it is an UPDATE that row-locks the User row; an append-only INSERT has no row to lock. Compounding: foldWalletBalance floors at zero, erasing overdraft evidence — the fold is a lower bound, not a provable books state. Fix: real serialization (advisory lock on userId, or SELECT…FOR UPDATE on a per-user wallet anchor row, or SERIALIZABLE+retry) + remove the floor from the accounting fold (display-only).

### F4 — CRITICAL — Free fulfillment via consume-after-void
@@unique([userId,subjectId,entryKind]) permits exactly one authorize per (user, package) ever; §8.3 makes a second authorize return the original row; the state machine allows PAYMENT_VOID → WALLET_AUTHORIZED re-authorization. Path: authorize (−X) → void (+X) → re-authorize (no-op returning the reversed entry, ok:true) → hold-exists invariant passes on a net-zero hold → SUBMITTED → ACCEPTED → consume writes amountCents: 0 (pure marker). Net ledger effect zero; certified mailing delivered free. Only void-after-consume is guarded; consume-after-void appears nowhere. Root cause was flagged by Agent C (§9.1 item 10: does a retry reuse the DisputePackage.id?) and never docketed. Fix: consume-must-refuse-after-void guard + redesign the unique key so re-authorization after void is possible + resolve the retry subject-id lifecycle explicitly.

### F5 — HIGH — Partial package failure has no settlement path
A package aggregates N letters/manifests; DisputePackage.stage rolls up at the least-progressed manifest; consume fires at package-grain ACCEPTED; the unique key permits exactly one consume and one void per package. For a 3-letter package with 2 accepted + 1 rejected: rollup never reaches ACCEPTED → consume never fires → the hold-TTL sweep voids the entire hold → CreditVector paid the provider for two certified pieces and returned 100% of the authorization. No partial-consume/partial-void/per-letter settlement primitive exists, and the unique key makes one structurally unavailable. Same grain mismatch: "2 of 3 mailed" has no truthful operator surface (package reads REJECTED while two letters are in the mail stream). Fix: decide settlement grain (per-letter vs per-package) + add partial-settlement entry kinds, or accept all-or-nothing in writing.

### F6 — HIGH — Top-up credits metadata, not captured amount; chargebacks unrepresentable
§4.1 copies allow_promotion_codes: true; §4.3 credits Number(cs.metadata.amountCents). The letters_5 precedent is immune (grants a fixed count regardless of price paid); a cents-denominated instrument is not: any promotion code mints the discount as spendable balance. Correct source: cs.amount_total. Nothing handles charge.refunded / charge.dispute.created on an already-consumed top-up: no clawback entry kind (refund is a positive credit), no negative-balance path, and F3's floor prevents representing the deficit. Fix: credit amount_total; design the clawback path.

### F7 — HIGH — No payer/principal model for money movement
lib/session.ts returns the managed client under WORKSPACE_COOKIE and the impersonation target under IMPERSONATE_COOKIE; approve gates on m.userId !== user.id; MailService.approve stamps actor:"user" unconditionally. WalletLedger.userId → User is one balance per User with no delegation/spend-authority/payer concept — while lib/entitlements.ts:190 already encodes the opposite model ("A managed client inherits its agency's entitlement (the agency is the payer)"). Net: agency pays for generation, the consumer's own wallet pays for fulfillment, an agency staffer or impersonating admin can spend the consumer's stored value, and the immutable audit trail records it as the consumer's own act. Fix: explicit payer/spend-authority model covering agency workspace + admin impersonation; delegated approval distinguished in the audit trail; Founder authorization decision.

### F8 — HIGH — The statutory clock has three anchors; the operator copy is legally wrong
Anchors in the package: RETURN_RECEIPT_ARCHIVED (A §5.4 / unified §3.2 row 11), "waiting.started fires when package.mailed lands" (D §6.1), "Your package was mailed — the §611 clock started" (D §4.5), and shipped code anchors at Letter.mailedAt (lib/mailCenter.ts:131-146) while its own copy correctly says "within ~30 days of receiving this". FCRA §611(a)(1)(A) runs from CRA receipt. D's proposed copy is wrong by the full transit time on a compliance-sensitive surface. Fix: single clock anchor across all artifacts; correct the copy; put the framing question to counsel (§3.4 Q6).

### F9 — HIGH — Quarantine and both retry paths are structurally impossible
(i) The UNKNOWN_PROVIDER_STATUS quarantine cannot exist in the shipped machine: MailStatus.ts's FORWARD table is strictly forward-only (canTransition refuses backward moves; even QUEUED→ACCEPTED is illegal), pipelineIndex() returns −1 off-pipeline breaking syncTracking, and the disposition claims "code-only, no migration" without touching the transition table. No ops queue/alert/admin surface; the only modeled exit is a happy-path edge. (ii) Retry-after-return is blocked at the database level: DisputePackageLetter has @@unique([letterId]) AND @@unique([mailId]); RETURNED_TO_SENDER → PREPARED requires a second join row for the same letterId — rejected. (iii) Retry-after-rejection silently no-ops: claim key ${mailId}:${toStage} has no attempt dimension; attempt 2's mail_abc:SUBMITTED returns completed and is deduped out of existence. Fix: add quarantine + retry paths to the transition table (with pipelineIndex handling) or replace quarantine with an off-machine flag; drop @@unique([letterId]); add an attempt/generation dimension to the claim grammar.

### F10 — HIGH — Delivery evidence: mandatory, undesigned, terminal on failure
Founder §1.3 makes ERR + delivery evidence + immutable timeline unconditional; stage 10 RETURN_RECEIPT_ARCHIVED is the sole entry to WAITING_PERIOD; yet evidence-artifact storage is explicitly deferred (IMPLEMENTATION-SEQUENCE §9) while the machine ships as v1-complete, and A-PROVIDER-ABSTRACTION §4 concedes pointer-only cannot satisfy "immutable by CreditVector's own hand". Uncovered failure modes with no state/owner/wallet consequence/truthful surface: Delivered-but-receipt-never-arrives (stuck at DELIVERED forever; clock never starts); USPS tracking stalls (no stall/timeout state); returned-to-sender AFTER Delivered (absent from both diagrams though MailStatus.ts:57 already permits DELIVERED→RETURNED — the "zero information loss" mapping drops a transition the shipped machine supports); address failure after consume (remedy is refund, excluded from v1). Also: a return receipt bears the recipient's signature+address — the lib/docCrypto.ts AES-256-GCM pattern is the mandatory floor for new PII, not one of two co-equal options; access control on GET /api/packages/:id/evidence is never specified. Fix: promote evidence storage to a Phase-1 decision bound to docCrypto; add the missing states.

### F11 — MED-HIGH — The Policy Engine cannot compute the number it owns
PolicyDecision.walletAuthorization.amountCents comes from MailPricing.computePrice, which requires a CostEstimate produced only by MailProvider.estimateCost (a provider call) — but law 5 forbids the engine calling a provider, and PolicyInput carries no spec/pages/estimate/coupon. ADR-0042's guard contract asserts properties of a value the engine cannot produce. Fix: add server-computed estimate: CostEstimate to PolicyInput; the calling route invokes estimateCost, preserving law 5. (Refuted along the way: pages is NOT client-suppliable — prepare derives it server-side; law 2 holds.)

### F12 — MED — Webhook ingestion is a paragraph, and it moves money and mints evidence
ACCEPTED is the consume trigger (spoof/replay converts a voidable hold into permanent capture for an unprinted job); DELIVERED mints the consumer's legal evidence. Missing: replay window/timestamp tolerance (a bare sha256 dedupes identical replays, not forged bodies with new sequence numbers), out-of-order handling (the Stripe route re-retrieves state for exactly this reason), per-provider secret rotation, bounds on which transitions a webhook may drive. Posture unresolved: stages 5–10 name "provider webhook" as Owner while the LetterStream integration is entirely pull-model (retrieveStatus/retrieveTracking; syncTracking polls) and §3.5 concedes no push route exists; nothing establishes LetterStream offers webhooks and there is no polling fallback in the design — if it does not, stages 5–10 have no driver. Fix: full ingestion design (auth, replay, ordering, transition bounds, poll-vs-push posture with fallback).

### F13 — MED — 12-step chain vs the binding 9-step Founder decision
Founder §1.9 lists nine steps. Unified §1 row 9 says "Package Review chain (12 steps, §3 below)" — §3 is the 12-stage timeline, a different object; §8 and IMPLEMENTATION-SEQUENCE §5/§9 repeat "12-step chain"; the owning appendix (B §3.1/§7) correctly maps nine. The merge silently substituted the timeline's stage count for a binding decision; an implementer following the stated reading order builds the wrong chain. Fix: restore 9-step; repoint the cross-reference to B §3.1.

### F14 — MED — Cascade policy self-contradictory; repeats a flagged constitutional defect
Case.userId→User Cascade and DisputePackage.userId→User Cascade vs DisputePackage.caseId→Case Restrict, DisputePackageLetter.letterId→Letter Restrict, WalletLedger.userId→User Restrict: the cascade can never fire (Restrict-blocked), and the recorded intent (case/package history disposable, letter evidence) is backwards vs the tombstone design. Worse: ID-H06 (HIGH, ratified Identity Constitution) is mid-remediation on exactly this destructive User-cascade pattern, and .ai/CURRENT-STATE.md:7 records a containment slice premised on a global User hard-delete prohibition. The package proposes two more instances. Fix: reconcile; remove the two new User cascades.

Below the cut: IMPLEMENTATION-SEQUENCE §1(b) asks the Founder to rule on "ADR-0041–0045" — 0046/0047 are never put to the Founder yet Phase 5 requires "ADR-0046 accepted" and 0047 is a constitutional amendment. · C §7 FI-2 claims "every transition wrapped in a claim key" but §3.6 omits fund. · ADR-PROPOSALS.md:3's header rationale contradicts the (correct) closing numbering note.

## 2. Per-disposition soundness verdicts

| Disposition | Verdict | Key point |
|---|---|---|
| certified:false hardcode → sequence must-fix | Sound, with gap | Flipping it is a LIVE pricing change (+$4.95+15%) on a route whose UI says "no card charged"; CCO Gate 1 is scoped to vendor-opacity copy only |
| Fail-open unknown status → quarantine | UNSOUND as specified | Direction right; mechanism impossible under MailStatus.ts:47-74 (F9-i) |
| MailPricing lump-sum → line items | Sound requirement, under-specified | Also reveals: the 15% markup applies to providerCost INCLUDING the $4.95 certified surcharge — CreditVector marks up statutory postage; CCO must see this explicitly; material to F2 |
| KAI-badge/Approve split | Sound | Verified verbatim; guard shape right; best-executed item after the Room Constitution |
| Vendor Opacity law + guard | Sound law, weak guard | Both real leaks are runtime values/interpolations; a static source regex gives false assurance — the DTO is the load-bearing control |
| Campaign string-ref v1 | Sound | Orphan-risk detection unowned (Risk #5) |
| Restrict-FK letter deletion | Sound, incomplete | The adjacent @@unique([letterId]) breaks retry (F9-ii) and contradicts the Cascade one field away (F14) |
| Consume-at-Accepted | Sound moment, unsound representation | The amountCents:0 marker + one-consume-per-subject produce F4 and F5 |
| Unified claim ledger | Sound consolidation, two gaps | Per-domain TTL asserted not specified (no TTL column); no attempt dimension (F9-iii) |
| package.authorized rename | Sound | — |
| Derive-on-read waiting | Correct outcome, incomplete basis | D DID propose persisted contracts (§1.3) and anchors at package.mailed (§6.1) — the anchor conflict stayed live (F8) |
| Event Bus PII denylist routing | Sound | Extend the documentation: the denylist also blocks name/address/city/zip/postal/street — future fulfillment contracts carrying recipientName hard-fail |
| ADR renumbering 0041–0047 | Sound outcome | Header rationale contradicts the correct closing note; 0046/0047 missing from Phase 0's Founder list |
| Constitution cross-filing | Sound — best-handled item in the package | The standard the rest should have met |

## 3. CROA §404 advance-fee analysis

Facts: consumer pays Stripe in advance to load a stored-value balance with no service identified at payment time; balance debited at Approval; capture at provider Accepted (before printing/mailing/delivery); price = provider cost + $0.99 platform fee + 15% markup computed on a provider cost that includes the $4.95 certified surcharge; the service is Kai-recommended dispute selection + drafted letters + certified mailing on the consumer's behalf; no wallet expiry, no fund segregation; a $99/mo subscription is separately charged in advance.

Frame: 15 U.S.C. §1679a(3) defines a credit repair organization to include selling "advice or assistance" with regard to improving a consumer's credit record — with NO software/DIY/educational exclusion (§1679a(3)(B)'s exclusions are nonprofits, certain creditors, depository institutions). §1679b(b): no CRO may charge or receive money for a service "before such service is fully performed" — a strict timing rule with no disclosure cure. §§1679c/d/e add mandatory disclosure, written-contract, and 3-day cancellation duties; §1679f(c) renders non-compliant contracts void and unenforceable; §1679g/h/i provide damages (no less than amounts paid), fees, FTC/state-AG enforcement, and a private right of action. State CSO statutes add registration, bonds, stricter advance-fee rules, and in some states trust/escrow duties for prepaid consumer funds.

Assessment: the prepaid wallet is the most CROA-adverse charging architecture available for this service — money is received at top-up (possibly weeks before any package exists) and irrevocably captured before printing. The educational-tool positioning is well-targeted at outcome-guarantee/UDAP exposure but is not a statutory exclusion; the service as designed (CreditVector selects targets, drafts, and mails for a marked-up fee) reads closer to §1679a(3)(A)(ii) advice-or-assistance than to a neutral printing utility. The "postage reimbursement" argument is weakened by the platform fee and by marking up the certified surcharge itself; even the narrowest "fully performed = mailed" reading fails because capture precedes mailing. A compliant architecture exists under that narrow reading — Stripe manual-capture authorization at Approval, capture at MAILED or DELIVERED — and the wallet cannot do this, because prepayment is its defining premise. The pre-existing subscription already charges in advance (exposure not created by this program, but materially worsened by binding a specific advance payment to a specific named unperformed service). Holding non-expiring prepaid funds independently raises state unclaimed-property/escheatment and possibly money-transmission questions (currently filed under Payouts as if custody attached to withdrawal).

Counsel question (verbatim, decision requested before any Phase 3 authorization — not at CCO Gate 2, which reviews copy, while the instrument is what needs counsel):

> For outside consumer-finance counsel — CreditVector Fulfillment Wallet, CROA §404 (15 U.S.C. §1679b(b)) advance-fee analysis.
> CreditVector is a consumer-credit SaaS positioned and disclaimed as an educational tool. It analyzes a consumer's uploaded credit report, algorithmically recommends which tradelines to dispute and with what strategy, drafts the dispute letters, and — under the proposed Fulfillment Engine — will mail them certified with return receipt on the consumer's behalf. The proposed funding mechanism is a prepaid stored-value wallet: the consumer pays via Stripe in advance to load a USD balance; at package approval the balance is debited as a hold; at the mail provider's acceptance of the job (before printing, before mailing, before delivery) the debit becomes permanent. The per-package price is provider cost + a $0.99 platform fee + a 15% markup, where the markup is computed on a provider cost that includes the $4.95 certified-mail surcharge. There is no wallet expiry and no segregation of consumer funds. CreditVector separately charges a monthly subscription in advance.
> 1. On these facts, is CreditVector a "credit repair organization" under 15 U.S.C. §1679a(3) — specifically §1679a(3)(A)(ii), "providing advice or assistance… with regard to" improving a consumer's credit record — notwithstanding its educational-tool positioning and disclaimers? Does any exclusion in §1679a(3)(B) apply?
> 2. If so, does charging or receiving the wallet top-up in advance, and/or capturing funds at provider acceptance, violate §1679b(b)'s prohibition on charging or receiving money "before such service is fully performed"? For this service, at what moment is the service "fully performed" — provider acceptance, mailing, USPS delivery, return-receipt archival, or resolution of the dispute?
> 3. Does it change the analysis if the wallet charge were restructured as (a) a Stripe manual-capture authorization placed at package approval and captured only at confirmed delivery / return-receipt archival, or (b) a strict, itemized, zero-margin pass-through of documented postage and printing cost with the platform fee and markup billed separately under the subscription? Would either be compliant?
> 4. If CROA applies, what are our obligations under §§1679c (pre-contract disclosure), 1679d (written contract), and 1679e (three-day cancellation) for the fulfillment service specifically — and does §1679f(c) put our existing subscription agreement at risk of being void and unenforceable?
> 5. Which state Credit Services Organization statutes reach this offering (registration, surety bond, stricter advance-fee prohibition, trust-account or escrow requirements for prepaid consumer funds), and does holding non-expiring prepaid consumer balances create unclaimed-property/escheatment or money-transmitter obligations independent of any cash-out feature?
> 6. Our current in-product statement is "Your package was mailed — the §611 clock started." FCRA §611(a)(1)(A) runs from the CRA's receipt. Confirm the correct consumer-facing framing.
> Decision requested: whether the prepaid-wallet architecture may proceed at all, or must be replaced by a charge-at-completion mechanism, before any implementation work begins.

## 4. Completeness against Founder decisions §1.1–§1.10

| § | Decision | Status |
|---|---|---|
| 1.1 | LetterStream = adapter #1, operators never touch it | Honored (guard mechanism weak; DTO sound) |
| 1.2 | Dispute Package primary; Case Journey | Partial (join-table uniques F9-ii; wallet grain F5) |
| 1.3 | Always certified + tracking + ERR + evidence + immutable timeline | Partial (evidence stage mandatory but deferred/terminal — F10) |
| 1.4 | Two options always | Partial (download-AND-self-mail while fulfillment runs: two clocks, one letter, no reconciliation — unanswered) |
| 1.5 | Deterministic Policy Engine; Kai never decides | Compromised (F11 — engine can't compute its own number) |
| 1.6 | Wallet architecture only | Honored in scope; compromised in design (F3/F4/F5/F6/F7) |
| 1.7 | Kai boundaries | Honored (strongest work; only defect is the §611 copy F8) |
| 1.8 | Room Constitution as proposal | Honored (surface two named product gaps: anti-overwhelm at 30 NEEDS_ATTENTION rows; no cross-client agency aggregate) |
| 1.9 | 9-step Package Review chain | Compromised (F13 — replaced by 12 in merge+sequence) |
| 1.10 | 12-stage canonical timeline | Partial (F9-i quarantine, F10 stages 10–12, F8 anchor) |

## 5. Must-fix list

Blocking before the package is implementable: F1 (Phase −1: Gate D + manifest extension; restate entry criteria), F2 (CROA section + counsel routed before Phase 3), F3 (real lock; unfloor the accounting fold; retract the false claim), F4 (retry subject-id lifecycle; consume-refuses-after-void; key redesign), F5 (settlement grain decision + partial entry kinds or written acceptance), F6 (amount_total; clawback path), F7 (payer/spend-authority model), F9 (transition-table reality; drop @@unique([letterId]); attempt dimension), F10 (evidence storage to Phase 1, docCrypto floor, missing states).
Document corrections (no new decision): F8 single anchor + copy fix; F11 CostEstimate into PolicyInput; F13 restore 9-step; F14 cascade reconciliation; ADR-0046/0047 into Phase 0's Founder list; vendor-opacity guard made runtime-effective.
Re-review required after fixes: F1–F7, F9–F10 individually. F2's answer may invalidate Phase 3 entirely.

Closing note: the domain model, Kai boundary laws, provider abstraction, and Room Constitution proposal are of a genuinely high standard — path-cited, adversarially self-checked, honest about the unverifiable. The failures concentrate in the wallet's concrete money mechanics and in flagged-but-undocketed conflicts (F4, F5, F8, F9 share one pattern: an agent raised the question, the merge did not docket it, and the ruling shipped on top of it).
