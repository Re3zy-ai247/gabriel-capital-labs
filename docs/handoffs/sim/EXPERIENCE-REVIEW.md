# Experience Review — Phase -0 Adversarial Verdict of Record

**Date:** 2026-08-03 · **Branch:** `docs/fulfillment-engine-v1` · **HEAD (base):** `871d420`
**Source:** `docs/fulfillment/simulation/SIM-REVIEW.md` (the Opus adversarial experience review), faithful condensation. Read for this review: all five sims in full (2,192 lines) + the merged Founder Walkthrough + KAI-FULFILLMENT-UX + Room Constitution + EXECUTION-PLAN + FEATURE-FLAG-STRATEGY. 13 load-bearing sim claims verified against source; 3 came back PARTIAL; 1 finding no sim made.

## Gate verdict: READY-WITH-DISCLOSURES

Phase 1 begins at P0 → P1a/P1b → P5 → P6a. Nothing blocks the start. Findings 3 and 5 (below) are live production defects independent of Phase 1; finding 2 clears inside P6a before P9a/P10a.

## The frame that reorders everything

The five sims, per their brief, depict the **last** flag state — Send live (P10b, behind external CROA counsel). The **first** shipped state is Download-only (`FULFILLMENT_PACKAGE_UI_ENABLED=true, WALLET_ENABLED=false`; Send visibly present, disabled). The corpus's five most-praised moments (Wallet, FINAL REVIEW, hold/settle, tracking, receipts) are absent from what actually ships first — the launch experience got roughly one simulated hour of coverage. Two interim questions remain unsimulated: how a long-disabled "Send" reads, and whether the chain renders as 9-with-2-dead or 7. A bounded 6-scene interim simulation before P9a is recommended, not required.

## Ranked findings (14, launch-experience severity)

| # | Severity | Finding | Resolution / lands in |
|---|---|---|---|
| 1 | CRITICAL — gate integrity | The evidence base is the last flag state, not the first; the Download-only launch is approved on ~one simulated hour. | Interim copy/presentation decisions — B-MAIL-CENTER-EVOLUTION §3.4 / MAIL-CENTER-EVOLUTION-PLAN §1.3 |
| 2 | CRITICAL — launch-blocking, clears at P6a | The Download path (the only live fulfillment at launch) is clock-wrong (6 copy sites say "from receipt," all math anchors `mailedAt`), evidence-free vs. Send, and consent-light (one unconfirmed click starts a statutory clock vs. four checkboxes for a $9 hold). | KAI-FULFILLMENT-UX §3.5 + B-MAIL-CENTER-EVOLUTION §3.4; the §611 CCO gate is a Download-path question at launch |
| 3 | CRITICAL — live today, every new user; found by the review, no sim made it | The first recommendation is UNRANKED — `kaiHome`'s branch 5 is `tradelines.find(!resolved && !disputed)` over a `findMany` with no `orderBy`; score/probability exist one room away and are ignored. | D-KAI-EXPERIENCE §2.2 |
| 4 | HIGH — live | Kai context cache bleeds across client workspaces — `sessionStorage` key `kai-presence-ctx-v1` (no user/workspace scope, 5-min TTL, never cleared on switch); the `/dashboard` exclusion guard sits after the fetch. | B-MAIL-CENTER-EVOLUTION §5 (scope or clear on switch) |
| 5 | HIGH | Recommendation starvation — narrower than SIM-A claimed (branches 4/5 are mutually exclusive with branch 2; only branch 3/§605 is starved) but sharper: §605 is the only branch that becomes true by time alone. | Aging/escalation qualifier — D-KAI-EXPERIENCE §1/§2.2 |
| 6 | HIGH | FINAL REVIEW habituation-resistance asserted on N=1 while the same sim shows the same operator skipping the education step unread; ✓1/✓4 have no server binding. | Bind ✓1 to a real preview-open event; recipient name inline — KAI-FULFILLMENT-UX §1.2/§1.3 |
| 7 | HIGH — moot pre-WALLET, critical once it flips | No balance at the point of spend — `availableCents` exists only as an error payload; a healthy wallet's only state is silence. | WALLET-COMMITMENT-MODEL §8.5 UI addendum + Room Constitution candidate-room table |
| 8 | HIGH — disclosure, no experience fix | The FINAL REVIEW audit record cannot name a human — `actorUserId` resolves to the agency's one User. | Label the field "account," never "operator," until Operator Identity activates — KAI-FULFILLMENT-UX §1.6 |
| 9 | MED-HIGH | Deficit no-shame framing degrades into a wall — one calm owner read; N per-client refusals for the operator with no roll-up/impact list. | Make deficit ambient at roster altitude — KAI-FULFILLMENT-UX §3.4/§4.1 |
| 10 | MED-HIGH | Per-letter narration vs. package mental model — "Delivered" ×3 over 4 days while the rollup reads not-delivered. | Render the fraction ("2 of 3 delivered") — KAI-FULFILLMENT-UX §4.1 + B-MAIL-CENTER-EVOLUTION §2.2 |
| 11 | MED | Waiting period can't distinguish confidently-quiet from unwatched; "Kai is watching the clock" already exists on Mission Control but never reaches the Mail Center row or Timeline. | Distribute the line — D-KAI-EXPERIENCE §4.1 |
| 12 | MED | One four-beat template × ~50 classes (money leads, defect trails; repetition trains skipping); the most common money failure — positive-but-insufficient balance at Approve — has no class at all. | Add the 20th class; information-order rule (defect → money → correction) + repetition budget — KAI-FULFILLMENT-UX §2.1.2/§2.2 |
| 13 | MED | Two rooms say "Do this first" from two independently specified ladders (kaiHome's 5 branches vs. the Mail Center's 6-state health ladder); non-disagreement asserted, unenforced. | Scope-label or make one defer — MAIL-CENTER-EVOLUTION-PLAN §3.1 |
| 14 | MED-LOW | No de-escalation register for a hostile human anywhere in the 16-state catalog; one shipped range-law breach (`round2/route.ts:40`, the only emoji in the swept surface — celebration energy in an error response). | KAI-FULFILLMENT-UX §2.4 |

## The six questions (moments named)

- **CONFUSED:** Mission Control at agency altitude (zero `isAgency` awareness in the room or its engine — the home tells an owner to upload her own report; Marcus types `/agency` and never opens the front door) · Billing-vs-Wallet vocabulary collision · the duplicated empty-state instruction · the alternatives panel structurally unable to show the bureau-vs-furnisher judgment.
- **FRICTION:** no expert path through the 9-step chain (the education step is a fixed per-package tax, no "seen this" memory) · the wallet-low handoff leaves the product entirely (Slack is the system of record) · `/agency` as a mandatory gateway with no recently-opened memory · resumability works but is narratively silent.
- **KAI OVER-TALK:** the education step; per-letter repetition; the money amount stated three times per package; boilerplate beat 4 trains operators to skip the specific cause.
- **KAI UNDER-TALK:** day-28 silence; the first-ever mailing marked like the tenth; a healthy wallet's silence; the missing insufficient-funds line; the ring closing saying nothing; and systemically — the whole fulfillment voice is Send-only, so at launch Kai's fulfillment register is largely inert.
- **COGNITIVE LOAD:** Marcus's Tuesday — highest-leverage client, funding-blocked packages, resumed-package context, pipeline-stuck detection: all held in his own head (the roster is a sort, not a basis-carrying recommendation; roster fulfillment-blindness is a post-P5 obligation, not a today-fix — `DisputePackage`/`Wallet` have zero schema hits today).
- **DASHBOARD ROOMS:** only Mission-Control-at-agency-altitude fails as a room outright (0 of 6 Room Constitution presentations load-bearing); Wallet and Marketplace are absences wearing room names; the strongest room (Agency) is visited last, the weakest first.
- **PAGE TRANSITIONS:** 3 of 8 are genuinely OS-grade (the identity-swap no-op, the cookie mechanism, Mail Center's interruption resilience); the illusion breaks at exactly four named places (the unmarked `/dashboard` identity swap; arriving at the Timeline with no anchor to the package you just left; Timeline→Wallet dead-end with no signage; the ring closing on the face it opened with).

## Kai verdict

One character, verified across ~150 lines by five independent authors — no tonal outlier, no urgency, no vendor leak, no outcome promise; the character holds under narrative pull (it even withholds a §611 clock mid-celebration for a furnisher). But it has exactly one move: a four-beat template with a repetition problem, a money-first information order, a missing 20th class, no de-escalation register, and one shipped celebration-emoji breach. All fixes are copy-level.

## Sim-integrity audit

The five sims: HIGH integrity overall (no fabricated mechanism; guesses labeled; risks not dramatized). Three mechanism defects found (SIM-A overstated the deadlock's scope 3×; SIM-A invented a "HIGH item" filter that concealed finding 3; "roster blind" implied ignored data that doesn't exist yet), one convenient conclusion (FINAL REVIEW exempted from habituation on N=1), one unflagged quote of the celebration-emoji violation. The merge's **first version** carried four further defects — a §611 inversion presenting SIM-A's #2 finding as a virtue, a fabricated Case-Memory opening scene, a GAP (no real Kai greeting) presented as a delight, a suppressed waiting-period disagreement. All four are corrected in `WALKTHROUGH.md` (⟲ marks) after this review.

## Convergence adjudication

Completion-2 was REAL but CONFLATED — fixed as session/day closure (a); REFUSED as case/arc closure (b), which is honest FCRA modeling. Structural absences re-ranked: balance-at-point-of-spend is the higher-value half of the Wallet-room gap; staff identity is an audit-integrity DISCLOSURE, not an experience fix; the client view's actionable half is that roughly half the on-behalf-of corpus is unreachable dead copy. The recommendation deadlock: real, narrowed, sharpened. Onboarding: MIS-PRESCRIBED — wiring it as-is would ship the product's only fabricated-progress surface; fix the semantics first, or delete it. OS-vs-pages: affirmed but too blunt — three transitions are already OS-grade; the break is at four specifically named places.

## THE ANSWER

**Not yet — and the reason is one absence, not five.** The rooms are OS-grade and so are the mechanisms between them. What's missing: **the operator's own session is not a first-class object anywhere** — every room knows the case; no room knows the person doing the work or the work itself as a unit. Five sims found five faces of one absence (first-mailing unmarked; no cross-client do-this-first; every fact operator-mediated; who-did-what unattributable; the ring closing carrying no memory). The tell: the product never once addresses the human using it.

**Minimum set that makes the answer yes** (all reuse/placement; none reopens architecture):
1. An altitude-aware Mission Control (Executive-Queue idiom over the roster's priority ladder when `isAgency` + no workspace; closes seams 1/3/4 and completion-(a)). → Room Constitution §4 + CASE-JOURNEY-RUNTIME-PLAN §1.6.
2. A balance at the point of spend (before, or instead of, a Wallet room). → WALLET-COMMITMENT-MODEL §8.5 addendum.
3. An on-behalf-of variant for the everyday register (money already has one). → KAI-FULFILLMENT-UX §2.2.
4. A starvation guard + an `orderBy` at branch 5. → D-KAI-EXPERIENCE §2.2.
5. The Download-path honesty triple (the one launch-blocking item; clears at P6a). → KAI-FULFILLMENT-UX §3.5 + B-MAIL-CENTER-EVOLUTION §3.4.

## Disclosures the Founder accepts by approving

1. The evidence base is the last flag state; the Download-only launch is approved on ~one simulated hour (a bounded 6-scene interim sim is recommended before P9a).
2. The §611 CCO gate is a Download-path question at launch and must clear before P9a/P10a — the one disclosure that is really a condition.
3. Findings 3 and 5 are shipped today, flag-independent.
4. Staff identity has no experience-level remedy — the FINAL REVIEW record names an account, not a human, and must say so.
5. FINAL REVIEW habituation is an untested assumption.
6. The merge's first version was not a faithful index of the sims; corrected with ⟲ marks — the sims are the evidence.
