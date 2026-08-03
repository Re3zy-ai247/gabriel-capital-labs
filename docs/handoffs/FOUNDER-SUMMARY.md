# CreditVector Fulfillment Engine v1.0 — Founder Summary

**Date:** 2026-08-03 · **Branch:** `docs/fulfillment-engine-v1` · **HEAD:** `7828855` · **Base:** `origin/main` `f449c35` (untouched)

## Acceptance status: READY-WITH-DISCLOSURES (architecture only)

The wallet commitment model passed its final adversarial re-gate. All 10 must-fixes from the prior gate are resolved and the free-fulfillment defect (F4) is **permanently eliminated** with a traced proof. No blocker survives. Nothing is implemented — this is a design package; product code, schema, dependencies, and production are untouched, `MAIL_LIVE` is off, and `dispatch()` still has zero callers.

## What this is
A delta-evolution of the existing `lib/mail/*` subsystem — which already ships a 16-state manifest machine, all five provider IDs (LetterStream coded as a dry-run adapter), composed pricing, and an append-only audit trail, deliberately stopped at `QUEUED`. The architecture turns it into the **Dispute Package → Case Journey** fulfillment platform with a prepaid **Wallet** (authorization ≠ settlement), a deterministic **Policy Engine** and **Recovery Engine**, provider-neutral adapters, and a Kai-guided operator experience.

## The Founder rulings now in force
- **Keep the prepaid wallet.** Money is committed before fulfillment.
- **Provider acceptance is the irreversible boundary.** After acceptance, history is immutable, the settled hold stays settled, and any remediation is an accounting `adjust` — the system never pretends a mailing didn't happen.
- **Prominent irreversible warning before submission** (the FINAL REVIEW gate, now a server-issued single-use token bound to the price and warning version).

## How F4 was killed
Last cycle the defect lived in the seam between two documents — one minted a new attempt on retry, the other reused the same attempt, so re-authorization no-opped and letters mailed for free. This cycle pre-decided one rule for both: **a released attempt is terminal; every retry is a new attempt with a real debit; settlement requires an authorization at that same attempt.** No interleaving now produces a settled letter with zero net charge.

## Hard preconditions before ANY wallet code (do not skip)
1. **CROA §404 advance-fee counsel question.** Keeping the wallet does **not** moot it — funds are still received in advance. A formulated counsel question and a compliant alternative (Stripe manual-capture, capture-at-delivery) are in the Architecture Decisions doc. This must clear before implementation.
2. **Gate D Phase −1.** Production has no migration history and the preflight rejects a seventh migration; Gate D must execute before any new schema.
3. **§611-clock-without-receipt** CCO question · **11-question LetterStream vendor-confirmation set**.

## Residual disclosures (non-blocking)
Three LOW doc-fidelity items (an `adjust` enum under-propagated to one interface quote; an `adjust`/`reversesId` contract gap; a token-reasoning note); the agency-wide deficit blast radius (disclosed by design — one dispute can freeze an agency's book until an owner `adjust`); and the implementation-discipline dependency of every fix (locks and guards eliminate defects only if built as specified).

## Recommended next step
**Not** wallet implementation (blocked on the two counsel/migration gates). Instead: route the CROA counsel question, execute Gate D Phase −1, apply the small pending document corrections, and design-only the LetterStream adapter conformance tests. Detail in NEXT-SPRINT.

## Superseded
This document supersedes the earlier architecture-gate `docs/fulfillment/FOUNDER-SUMMARY.md` (which carried the pre-refinement NOT-READY verdict).
