# Fulfillment Engine v1.0 — Founder Summary

**Verdict (single Opus adversarial gate): NOT READY as implementable — READY as a decision package.** The architecture's aim, domain model, provider abstraction, Kai boundary laws, and Room Constitution were rated genuinely strong; the failures concentrate in the wallet's concrete money mechanics, one sequencing blocker, and one unanalyzed legal question. Nothing was implemented — this program was architecture-only, and per your execution model no work follows the gate without your approval.

## What exists now (branch `docs/fulfillment-engine-v1`)

12 committed artifacts under `docs/fulfillment/`: PROGRAM-BRIEF (scout-verified repository truth + your ten decisions), four domain designs (A: domain model, state machine, Policy Engine, provider abstraction), B: Mail Center → Case Journey evolution plan, C: wallet integration (943 lines), D: Kai experience model, four merge deliverables (unified architecture, Room Constitution proposal, ADR-0041–0047 proposals, implementation sequence), and the full ADVERSARIAL-REVIEW.

Load-bearing discovery: **the fulfillment engine already half-exists** — `lib/mail/*` ships a 16-state manifest machine, your exact five provider IDs (LetterStream coded, dry-run-only, fail-closed), composed pricing, an append-only audit trail, and a 3-step send wizard deliberately stopped at QUEUED (`dispatch()` has zero callers). This is a wiring-and-evolution program, not a build.

## The three decisions only you can make

1. **CROA §404 advance-fee (CRITICAL).** The prepaid wallet is the most legally adverse charging shape available for this service: money received at top-up, captured before printing, with a $0.99 fee + 15% markup applied even to the certified surcharge. The educational-tool positioning is not a statutory exclusion. A fully-formulated outside-counsel question is in the review (§3.4), including a named compliant alternative: **Stripe manual-capture — authorize at Approval, capture at Delivered/Receipt-Archived** — which may obsolete the prepaid wallet entirely. Decision requested before any Phase 3 authorization.
2. **Gate D first (CRITICAL).** The sequence's Phase 1 migrations are blocked by ratified canon: Gate D has never executed, production has no migration history (baseline resolve was preview-only), and the preflight rejects any seventh migration directory (ID-B02). A Phase −1 (execute Gate D + land the versioned manifest extension) must precede everything.
3. **Wallet mechanics rework (CRITICAL×2 + HIGH×3).** Independent of CROA: the overdraft guard doesn't lock (concurrent authorizes overdraw), consume-after-void yields free fulfillment, partial package failure has no settlement path, top-ups credit promo-discounted metadata instead of captured amounts, and there is no payer model (an agency or impersonating admin spends the consumer's wallet recorded as the consumer's own act). If counsel approves any prepaid shape, these get a bounded redesign + re-review.

## Also fix (document corrections, no new decisions)

Single §611 clock anchor (the proposed "clock started at mailing" copy is legally wrong — FCRA runs from CRA receipt); restore the binding 9-step Package Review chain (merge drifted to 12); Policy Engine input gap (CostEstimate); cascade-policy reconciliation (removes two new destructive User cascades the Identity Constitution is mid-remediation on); quarantine/retry paths made real against the shipped transition table; evidence storage promoted to a Phase-1 decision bound to the docCrypto encryption floor; ADR-0046/0047 added to your review list.

## Your options

- **A (recommended):** Route the counsel question now; in parallel authorize one bounded documentation-correction cycle (the review's items 10–15 + the wallet redesign contingent on counsel) and a Gate-D-first resequence; re-gate; then implement.
- **B:** Accept the package as a decision record, run counsel, and defer all corrections until its answer reshapes the wallet.
- **C:** Direct a charge-at-completion restructure immediately (drop the prepaid premise), which collapses most wallet findings, then correct and re-gate.

Production untouched (`origin/main` f449c35). RC2 remains accepted and frozen at its checkpoint; its Founder package and the ChatGPT bridge remain queued per your sequencing.
