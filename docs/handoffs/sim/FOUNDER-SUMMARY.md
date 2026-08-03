# CreditVector Phase -0 — Operator Journey Simulation — Founder Summary

**Date:** 2026-08-03 · **Branch:** `docs/fulfillment-engine-v1` · **HEAD (base):** `871d420` · Docs-only — no product code, schema, or dependencies touched.

## Gate verdict: READY-WITH-DISCLOSURES

Phase 1 may start at **P0 → P1a/P1b → P5 → P6a**. Nothing blocks the start. Two of the three live defects below (findings 3 and 5 in the full review) are shipped-today production defects, independent of Phase 1's own schedule — fix them regardless of sequencing. The third (the Download-path clock) is genuinely launch-blocking but clears inside P6a, before P9a/P10a.

## THE ANSWER

**Not yet one Credit Operating System — and the reason is one absence, not five.** The rooms are OS-grade, and so are the mechanisms between them. What's missing: **the operator's own session is not a first-class object anywhere** — every room knows the case; no room knows the person doing the work, or the work itself as a unit. Five independent simulations, five altitudes, found five faces of the same absence:

| Altitude (sim) | Protagonist | Face of the absence found |
|---|---|---|
| New operator (SIM-A) | Jordan Avery | Her first-ever mailing renders identically to her tenth — no first-mailing moment exists anywhere |
| Active operator (SIM-B) | Marcus Webb | No cross-client "do this first" — 14 workspaces, no unified recommendation, no roster fulfillment-awareness |
| Client journey (SIM-C) | Elena Ruiz | Every fact is operator-mediated — the client herself has no login, no status view, no evidence export |
| Agency owner (SIM-D) | Danielle Cruz | Who-did-what is unattributable — agency-staff identity does not exist anywhere in the schema |
| System ring (SIM-E) | Marcus Webb (ring walk) | The ring closes carrying no memory — no session/day/week completion moment anywhere |

The tell: the product never once addresses the human using it.

## The minimum set (5 refinements — all reuse/placement, none reopens architecture)

1. **Altitude-aware Mission Control** — the Executive-Queue idiom over the roster's priority ladder when `isAgency` + no open workspace is true; closes the completion-(a) gap.
2. **A balance at the point of spend** — before, or instead of, a dedicated Wallet room.
3. **An on-behalf-of variant for the everyday register** — money already has one; the greeting/narration voice doesn't.
4. **A starvation guard + an `orderBy` at branch 5** — two lines, flag-independent.
5. **The Download-path honesty triple** — the one launch-blocking item; clears at P6a.

## The 3 live defects found

- **Unranked first recommendation (live today, every new user).** `kaiHome`'s branch 5 is `tradelines.find(!resolved && !disputed)` over a `findMany` with **no `orderBy`** — score/probability exist one room away and are ignored. "One recommendation" is real; "the right one" is not enforced where it matters most.
- **Kai context cache bleeds across client workspaces (live).** `sessionStorage` key `kai-presence-ctx-v1` carries no user/workspace scope, 5-minute TTL, never cleared on switch; the `/dashboard` exclusion guard sits *after* the fetch, so every ordinary agency workspace switch populates the unscoped cache.
- **Download §611 mis-anchor — the launch-blocking one.** The Download path is the *only* live fulfillment path at launch (Send stays behind CROA counsel). Six copy sites say the response window runs "from receipt"; every math site subtracts from the operator's own "mark mailed" click (the print page even instructs logging the mailing date as the anchor). The receipt-anchored fix that already exists in the design is scoped only to the future Send path.

## Completion-(a)/(b) ruling

Two different things wore one "Completion: 2/5" score across all five sims. Adjudicated apart:
- **(a) Session/day/week closure** — no day-done for an operator, no week-done for an owner, no ring-closure for anyone — is real, cheap, and **should be fixed**.
- **(b) Case/arc non-termination** — the Journey's own node loops by design; there is no "this client is done" state — is the **correct, honest** modeling of real FCRA timelines. Manufacturing celebration here would break the zero-fabrication discipline that is the product's actual differentiator. **Refused.**

## What was refused

Per the review's adjudication: manufactured case/arc completion; wiring the orphaned `/onboarding` route as-is (it currently renders "visited" as "completed" — the product's only fabricated-progress surface); any staff-identity "experience fix" that fakes attribution the schema cannot actually provide.

## The 6 disclosures the Founder accepts by approving

1. The evidence base is the sims' last flag state (Send live), not the first (Download-only launch); the Download-only launch is approved on roughly one simulated hour of coverage. A bounded 6-scene interim simulation is recommended, not required, before P9a.
2. The §611 CCO gate is a **Download-path** question at launch and must clear before P9a/P10a — the one disclosure that is really a condition.
3. The unranked-recommendation and cache-bleed defects are shipped today, independent of any flag.
4. Staff identity has no experience-level remedy — the FINAL REVIEW audit record can name an account, never a human, until Operator Identity activates.
5. FINAL REVIEW's habituation-resistance is an untested assumption (asserted on N=1, while the same sim shows the same operator skipping the education step unread).
6. The merge's first version was not a faithful index of the five sims; it is corrected (⟲ marks) in `WALKTHROUGH.md`. The sims remain the primary evidence.

## Recommended next step

**Approve Phase 1 start** — P0 including the two live-defect fixes (branch-5 `orderBy`/starvation guard in `kaiHome.ts`; scoping the Kai-presence cache per workspace) plus the small documentation corrections this phase surfaced — then P1a/P1b, then P5 → P6a on the Download track, with the §611 CCO gate re-scoped to the Download path (not the Send path the original gate assumed).

## Where the detail lives (in this package)
`WALKTHROUGH` (the corrected four-act narrative) · `JOURNEY-MAP` (the canonical node-by-node map) · `EXPERIENCE-REVIEW` (the full adversarial review) · `RECOMMENDATIONS` (all 12, adjudicated) · `CONTINUE-IN-CHATGPT` (the resume bridge) · `MANIFEST` · `SHA256SUMS.txt`.
