# Fulfillment Platform — Commitment Resolution (Program Director merge)

Merges the three refinement artifacts (WALLET-COMMITMENT-MODEL.md · FULFILLMENT-COMMITMENT-BOUNDARY.md + RECOVERY-ENGINE.md · KAI-FULFILLMENT-UX.md) produced under COMMITMENT-REFINEMENT-BRIEF.md, and answers the Founder's critical question. Architecture only. The CROA counsel gate (ADVERSARIAL-REVIEW §3.4) and Gate D Phase −1 remain hard preconditions; nothing here implements.

## 1. THE CRITICAL QUESTION, ANSWERED

**"Would this commitment boundary eliminate or materially reduce the wallet failures identified during the Opus review?"**

**Yes — materially, and for the mechanical findings, structurally.** But the honest engineering answer has a précis the Founder should read first: the *boundary concept* (authorize-hold → settle-at-acceptance) was already present in the reviewed architecture; what the review broke was the **mechanics underneath it**. This refinement therefore did not relocate the boundary — it rebuilt the machinery so the boundary actually holds: a real serialization lock instead of a lockless read, a per-letter/attempt key instead of a one-shot per-package key, captured-amount funding instead of metadata trust, a payer-principal model instead of `actor:"user"`, and a Recovery Engine that makes every failure deterministic. The verdict table:

| Gate finding | Verdict after refinement | Mechanism (where) |
|---|---|---|
| F1 Gate D / migration canon | **STANDS** (out of wallet scope) | Phase −1 requirement unchanged; all refinement schema is additive and queues behind it |
| F2 CROA §404 advance-fee | **STANDS as counsel gate; posture strengthened** | Settlement strictly at provider acceptance is more defensible than any earlier capture, but top-up funds are still received in advance — counsel question unchanged, precondition to any wallet phase |
| F3 Overdraft (lockless guard) | **RESOLVED-WITH-RESIDUALS** (re-gate cycle 2 confirmed) | `Wallet` anchor row + `SELECT…FOR UPDATE` around every money op; fold-check inside the lock; accounting fold un-floored (WALLET-COMMITMENT-MODEL §14). Residuals: `cureDeficit` folds read outside the lock (narration-only); no lock-timeout → contention surfaces as an untyped 500; adjust+AdminAuditLog cross-table lock ordering unspecified |
| F4 Free fulfillment (consume-after-void) | **RESOLVED — permanently eliminated (re-gate cycle 2, traced proof)** | Unified attempt+1 across BOTH docs: retry after any release always mints a new attempt (new manifest); W1 §5.2 two-pass classifier refuses `attempt_already_resolved` and prices only new holds; a released attempt is terminal (Constitution invariant 8). No interleaving yields a settled letter with zero net debit. Enforcement is implementation-discipline-dependent on the stated guard contracts |
| F5 Partial-package money hole | **RESOLVED-WITH-RESIDUAL** | Per-letter settlement grain: N holds created atomically, settled/released individually — 2-of-3 acceptance settles 2 and releases 1. Residual: `AuthorizationGroupView.groupStatus` undefined for a multi-attempt letter under a carried-forward group id |
| F6 Metadata top-up / chargebacks | **RESOLVED-WITH-RESIDUAL** | Credit `amount_total` only (paid+USD asserted, PaymentIntent-keyed); promo codes off; per-refund clawback + won-dispute `adjust`. Residual (disclosed, per "scope OR disclose"): agency-wide deficit blast radius — one dispute can freeze an agency's whole book until an owner `adjust` |
| F7 No payer model | **RESOLVED-WITH-RESIDUALS** | Payer-principal wallets (consumer/agency), spend-authority table, nullable `actorId`+`actorKind`+`onBehalfOfId` (N6 fixed), admin impersonation money-BLOCKED. Residuals: agency-staff sub-identity granularity (dormant Operator Identity); approve-route dual-identity (payer vs subject) tension |
| F8 §611 clock anchors | **CORRECTED, counsel-pending** | Single anchor (`RETURN_RECEIPT_ARCHIVED`) across state machine and all Kai copy; the "mailed = clock started" line rewritten (KAI-FULFILLMENT-UX §3). Whether `DELIVERED` alone may start the clock without a receipt → named counsel/CCO question (Recovery/Boundary docs), not architected by fiat |
| F9-i Quarantine impossibility | **RESOLVED (mechanism) / CONTINGENT (storage)** | Off-machine `attention` flag retires the illegal in-machine quarantine; the shipped FORWARD table is never bent. Contingent on the additive `MailManifestFlags` migration (B8/N5 fix — no runtime DDL; verified not to trip the self-heal allowlist) |
| F9-ii Retry blocked at DB | **RESOLVED (contingent on the named additive migration)** | `@@unique([letterId])` → `@@unique([letterId, attempt])` on DisputePackageLetter |
| F9-iii Retry deduped by claims | **RESOLVED (canonical claim-key registry)** | The two domains use DISTINCT attempt-scoped grammars, cited verbatim by W1 and W2 (REFINEMENT-2-DIRECTIVE Ruling 2): wallet `wallet:<subjectId>:<attempt>:<entryKind>`, mail-transition `mail:<subjectId>:<attempt>:<toStage>` — the writer/reader mismatch that would silently disable the outer dedup is closed |
| F10 Evidence-failure states | **REDUCED** | RECEIPT_OVERDUE / TRACKING_STALLED / DELIVERED→RETURNED (honoring the shipped edge at MailStatus.ts:56) / address-failure-after-settle all deterministic with wallet consequences; evidence storage remains a Phase-1 FOUNDER-GATE bound to the docCrypto floor |
| F11 PolicyInput lacks CostEstimate | **RULED HERE** | Amendment recorded: `PolicyInput.estimate: CostEstimate` supplied by the calling route (which invokes `estimateCost`); the engine still never touches the network — A-POLICY-ENGINE §2 amendment noted in §4 below |
| F12 Stages 5–10 driver gap | **REDUCED** | Reconciliation sweep specified as the GUARANTEED driver (poll-model reality); webhook existence = vendor question Q6. Mitigation until answered, resolution after |
| F13 9-step vs 12-step chain | **RESOLVED** | FINAL REVIEW architected as the evolved step 7 of the NINE-step chain (W3), not a new step; the merge-layer's 12-step references remain a pending document correction in the base package (§4) |
| F14 Cascade contradiction | **RULED HERE** | Ruling: `Restrict` everywhere on the new domain (Case, DisputePackage, DisputePackageLetter, Wallet, WalletLedger); user erasure flows through the tombstone pattern, never cascades — aligned with the Identity Constitution's ID-H06 remediation. A-DOMAIN-MODEL §1.6/§2.6 amendment recorded in §4 |

**Remaining risks after refinement (the honest register for the re-gate):** the two counsel gates (CROA instrument; §611-without-receipt), the vendor-confirmation set (11 questions — cancellation window, webhooks, duplicate-submission semantics), the agency-staff identity residual (F7), the implementation-discipline dependency of every "ELIMINATED" verdict (locks and guards eliminate defects only if built as specified — the guard contracts in each doc are the enforcement), Gate D sequencing (F1), and the anchor-lock's serialization cost at scale (one row per payer: acceptable for launch scale; measured before Marketplace fan-out — disclosure, not defect).

## 2. Fulfillment Commitment Constitution (PROPOSED)

1. **No irreversible financial settlement occurs before provider acceptance.** Authorization is a hold; settlement converts a hold; nothing else converts anything.
2. **Authorization ≠ settlement** (Wallet Constitution Amendment, WALLET-COMMITMENT-MODEL §13, incorporated by reference): settlement only at the commitment boundary; nothing silently consumed; deficits representable and curable; every entry carries basis + attempt.
3. **The operational irreversibility boundary is a vendor fact, not an assumption.** Until vendor confirmation, worst case (irreversible at acceptance) governs all operator-facing language; softening requires ratification (`warningVersion` audit law, KAI-FULFILLMENT-UX §1).
4. **Recovery Constitution** (RECOVERY-ENGINE, incorporated by reference): every fulfillment failure produces a deterministic state, a preserved audit trail, a recoverable operator workflow, and a Kai explanation. A hold never becomes a settlement by timeout.
5. **Kai translates; Kai never decides.** No raw vendor errors, no vendor names, never "Failed"; the Recovery Engine's verdicts are the only failure vocabulary Kai may speak.
Ratification path: with ADR-0041–0047 per the ADR-PROPOSALS process; cross-filing per OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL §6.1's precedent.

## 3. Join reconciliation (Program Director rulings)

| Join | Ruling |
|---|---|
| W3's proposed `RecoveryVerdictType` grammar vs W2's matrix `kaiCopyClass` handles | **W2's matrix keys are canonical, and this is NOT rename-only — withdrawn.** The re-gate found W2 names ~19 handles, W3 (written blind) wrote 10; ≥6 have no copy, and W3's `CANCELLATION_CONFIRMED` line ("your hold was released in full — nothing was charged") is FALSE against W2's post-acceptance `CANCEL_CONFIRMED_RARE` where the wallet stays settled. Refinement-2 Agent C writes the ~6 missing classes and the settled-stays-settled cancel copy per Ruling 3 |
| Approval audit persistence (W3 join 2) | The FINAL REVIEW assertion record extends the existing `MailAudit` embedded trail (append-only, store-enforced) with the four assertion fields + `warningVersion` — no new table; A-DOMAIN-MODEL owns the field list at implementation time |
| Release-confirmed signal for "balance restored" copy (W3 join 3) | W1's `WALLET_RELEASED@1` contract is the signal; Kai copy renders only after the ledger release commits (read-after-commit, same pattern as settlement narration) |
| Per-letter subject + attempt ownership | Aligned as specified: `subjectId = mail_<letterId>`, `attempt` single-owned by `DisputePackageLetter.attempt` (W1 §15 ↔ W2 handles — no conflict) |
| Wallet-effect vocabulary | The Recovery matrix's four-value vocabulary (released / settled / none / clawback) maps 1:1 onto W1's entry kinds; FOUNDER-GATE rows stay FOUNDER-GATE |

## 4. Pending document corrections in the base package (recorded, not yet applied)

To be applied in one correction pass after the re-gate (they change no decision made here): A-POLICY-ENGINE §2 `PolicyInput.estimate` amendment (F11) · A-DOMAIN-MODEL §1.6/§2.6 cascade→Restrict + `@@unique([letterId, attempt])` (F14, F9-ii) · base-package "12-step" references → 9-step (F13) · ADR-0044 superseded clauses per W1's supersession map · ADR-0046/0047 added to the Phase-0 Founder review list · vendor-opacity control restated as the runtime DTO · D-KAI-EXPERIENCE superseded §§ per W3's map.

## 5. Re-gate scope (the ONE bounded Opus pass)

Question: do the previously identified wallet defects (F3–F7, F9) remain in the revised commitment model? Attack the eliminations (lock semantics, key shapes, guard completeness, group atomicity under partial failure, clawback abuse, agency-wallet cross-client leakage, anchor-row contention, attempt-race windows) and verify the REDUCED/STANDS register is complete and honest. If eliminations hold: READY-WITH-DISCLOSURES against the disclosure register above. If any defect survives: name the surviving path precisely.
