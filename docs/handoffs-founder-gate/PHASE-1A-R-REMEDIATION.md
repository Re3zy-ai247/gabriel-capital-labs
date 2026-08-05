# CreditVector — Phase 1A-R — Founder Experience Remediation

**Date:** 2026-08-04 · **Branch:** `feat/experience-runtime-phase-1a` — **[ahead 6] of origin, NOT pushed**
**Production:** untouched (`origin/main` @ `f449c35`) · **Architecture:** unchanged — every fix is state wiring, copy, or an exclusion filter
**Stop conditions honored:** no merge · no deploy · no push-main · no production migration · no feature flags · no Wallet · no Phase 1B · no LetterStream · no Arena expansion

## 1. Verdict

**All six release blockers are CLOSED, adversarially challenged, guard-pinned, and live-verified.**

**The Founder Experience Gate moves: NOT READY → READY-WITH-DISCLOSURES.**

The disclosures are not engineering gaps — they are (a) the standing CCO copy docket, which was always a separate gate, now carrying this slice's new strings; and (b) three accepted-with-note residuals recorded by the bounded Opus review (§6). The remediation Opus's own launch-risk line: *"Nothing in these three commits increases risk versus the gate baseline… the money path is clean… compliance surface improves materially."* Unqualified READY is yours to declare after the CCO pass — per the standing engineering order, not per anything left unfixed here.

## 2. The Six Blockers — closed, with evidence

| # | Blocker (gate 1.0) | Fix | Evidence |
|---|---|---|---|
| **RB-1** | The OS re-ordered work it already did (§605 pick blind to existing letters) | `disputedIds` hoisted above the §605 branch and applied there (`lib/kaiHome.ts:91,102`); **and** — caught by Opus as a relocation — the campaign planner's `alreadyInFlight` now counts a generated-but-unmailed letter as in flight (`lib/campaignInput.ts:91`) | Live: demo's Navient (3 generated letters) is gone from the kaiHome pick on /dashboard, /letters, /journey **and** absent from the recommended campaign; a genuinely un-lettered §605 item still fires (starvation guard pinned by test) |
| **RB-2** | Never-late accounts counted as "active negatives", staged for §611 | `isFactualNegative` (derogatory type OR a real first-delinquency date on file) is now the single fact-test at the source (`lib/intelligence/snapshot.ts` — `negatives` AND `disputable`), the Deferred Queue, and both per-item surfaces, which render an honest **Clean / "nothing to dispute"** state; clean rows keep bureau detail behind a relabeled toggle | Live: 3 clean rows render Clean pills; deferred staging excludes them; the negatives and disputable counters agree on the same account. Chase judgment (late history, now current → still counted, because a real DOFD is on file) documented for CCO |
| **RB-3** | Mail Center band blind to its own ready-to-prepare packages | `pickMailBand` gains a READY_TO_PREPARE rung — still zero independent ranking (reads the count `groupIntoPackages` already computes), above the passive deadlines/quiet states, below kaiHome's own picks (`lib/mailCenter.ts:517`) | Live: gate-d's band reads "1 package ready to prepare", never "all caught up"; rung order pinned both directions by tests |
| **RB-4** | Download chain shipped placeholder letters silently; profile completion didn't reach artifacts | Render-time sender resolution (stored letter frozen as the record; the rendered artifact substitutes the CURRENT profile — `lib/letter.ts`); placeholder warnings at every chain surface; `needsDetails` computed server-side on the SAME rendered body so the card says **"Needs your details before mailing"** instead of "Ready to mail"; **and** — Opus records-integrity catch — a MAILED letter's print view renders **verbatim**, never substituted, no banner | Live: placeholder letter rendered real profile after Settings completion while `GET /api/letters` preview stayed byte-identical; mailed letter prints verbatim placeholders with no banner (before/after captured) |
| **RB-5** | Mailed-date picker frozen to a wrong UTC day; true local date rejected; stored value displayed a day off | The date is the operator's LOCAL calendar date end-to-end: local pre-fill/min/max (`app/letters/page.tsx`); server bounds shift the raw instant ±14h **before** flooring to a UTC day (the naive floor-then-pad fails both directions — derived and documented in-code); accepted dates store at **UTC noon** so every local formatter renders the entered date (`lib/mailCenter.ts:571-594`) | Deterministic evening-scenario tests (fixed `now`); Opus ruling: correct construction, ≤1-day over-acceptance on a self-attested date "strictly better than rejecting the operator's true date"; no downstream consumer treats mailedAt as a midnight day-key |
| **RB-6** | Fixing a letter cost a letter; planner re-offered approved work | Idempotent regenerate: an unmailed same-item+strategy letter is UPDATED in place — no new row, no ledger event, nothing charged (quota = MAX(rows, ledger); the update path writes neither); mailed letters still fall through to create; planner excludes items in APPROVED-or-further campaigns; the button says "Regenerate (updates your draft)"; **and** — Opus dead-end catch — the existing cancel action is now reachable from the campaign card, so an abandoned approval can't shadow-block items forever | Live: same-id regenerate with quota flat 2→2; approved items absent from the next offer; approved→canceled click-tested end-to-end. **No refund logic built — the burn now never happens** (subscription logic untouched, `billing-integrity.test.ts` 31/31 pins `spendLetterCredits` literally intact) |

## 3. Execution & delegation (per the approved model)

Fable coordinated only. Three serial Sonnet packets with disjoint file ownership under `.ai/SOP/MULTI-AGENT-EXECUTION.md` task-packet discipline (S1: RB-1+2 · S2: RB-3+5 · S3: RB-4+6), each leaving an unstaged diff for coordinator review; Fable committed per reviewed slice and stitched exactly two S2-owned lines S3 correctly refused to touch. Opus ran ONE bounded review (diffs + state consistency + launch risk + regressions; explicitly triggered by the money-adjacent generate-route change per SOP §4) — its three SHOULD-FIX findings went back to S3 as a bounded fix pass and were closed and click-tested. No agent pushed, merged, deployed, migrated, or touched a flag; the only DB writes were live app actions on the sanctioned test account.

## 4. Commits (all local; branch [ahead 6] including the two prior docs commits)

| Commit | Content |
|---|---|
| `7750cba` | RB-1 + RB-2 (7 files, 254+/38−) |
| `ec8ad41` | RB-3 + RB-5 (4 files, 159+/17−) |
| `fd15988` | RB-4 + RB-6 + coordinator stitches (14 files, 674+/38−) |
| `18f0ea2` | Opus fix pass: planner in-flight truth · mailed-letter record integrity · campaign cancel release (5 files, 143+/13−) |

(Also on the branch, from the gate session: `3529271` multi-agent SOP · `50e97bc` gate 1.0 report.)

## 5. Validation record

| Check | Result |
|---|---|
| `npm run typecheck` | Clean — after every slice and the fix pass |
| `npx next build` | Clean (slices 1–3; fix pass is non-structural — typecheck + guards + live) |
| **Full guard suite** | **79 of 79 scripts pass** — run after slice 3 AND re-run after the fix pass |
| New guard checks added | RB-1 (lettered-exclusion + starvation-alive), RB-2 (13 checks: predicate table, staging, counter consistency, disputable), RB-3 (rung order both directions), RB-5 (deterministic evening scenario, fixed `now`), RB-4 (placeholder detection, mailed-verbatim), RB-6 (regenerate plan, mailed-falls-through, planner keys, in-flight disjunct) |
| `scripts/schema-safety.test.ts` | 17/17 — **zero schema changes** in the entire remediation |
| `billing-integrity.test.ts` | 31/31 — `spendLetterCredits` call and single-source decrement literally intact |
| Live verification | Every blocker verified on the running app against the isolated preview DB (demo, gate-b, gate-d, gate-e accounts); FIX-B/FIX-C re-verified by the coordinator after a clean `.next` rebuild |

Targeted regression only, per your instruction — no new experience walk was performed. Consistency across Mission Control / Mail Center / Kai / Planner / Letter Builder was the explicit subject of Opus attack #7 (finding: coherent; one wording note, accepted).

## 6. Opus bounded review (full text: appendix/OPUS-REMEDIATION-REVIEW.md)

**Verdict: REMAINING CONCERNS → all three SHOULD-FIX closed in `18f0ea2`; zero BLOCKING; launch-risk line: NO increased risk vs. the gate baseline.**

- **Money-adjacent ruling — PASS**: the bureau-widening bypass "does not exist" (`allowedNew = Math.max(0, lettersRemaining)` caps creates independently of updates); strategy/tradeline switching cannot mint free letters; the ledger is never under-metered.
- **RB-5 tolerance ruling — ACCEPT**: ±14h shift-then-floor is "the correct construction"; UI still blocks evening-tomorrow entry; ≤1-day over-acceptance on a self-attested date is the right trade.
- Closed in the fix pass: RB-1's campaign-planner relocation · mailed-letter print-view rewriting · the approved-campaign shadow-block dead-end.
- **Accepted-with-note (disclosed, not fixed):** (D) RB-5 is forward-only — rows mailed before this fix keep UTC-midnight storage and still display a day early in US timezones; a one-time normalization (midnight→noon) is a data decision for you, relevant to production rows on merge. (E) The noon anchor makes day-counts read up to one day conservative — never closer to closing than reality. (F) A §611 window at exactly 1 day left sits in the deadlines rung below READY_TO_PREPARE; Mission Control's closing-window set still surfaces it. (G) Band/card wording coexistence ("ready to prepare" vs "needs your details") judged coherent, tightened only if a future walk flags it.

## 7. Remaining risks & open items

1. **CCO docket (blocking ship, per the standing engineering order — not this slice):** the gate's 4 original items + RB-2's framing (incl. the Chase judgment: late-history-now-current counts as a negative) + new strings: Clean / "nothing to dispute" / "Account in good standing — no derogatory history on file." / "Bureau detail" / band rung copy / placeholder warnings / "Needs your details before mailing" / "Regenerate (updates your draft)" / campaign-cancel copy.
2. **RB-5 back-rows** (Opus note D): decide whether to normalize pre-fix `mailedAt` values on merge.
3. Strategy Desk H/M/L stat tiles still count clean accounts under "Low" (a 5th-tile layout change was out of bounds); the per-row Clean state already corrects the operator-facing claim.
4. The gate's non-blocker polish list (Mission Control consolidation first) remains open and unchanged.
5. Dev-note: the local dev server's `.next` cache corrupted once under heavy HMR churn mid-session (missing vendor chunk); a clean rebuild resolved it; no source defect involved.

## 8. Recommended next steps

1. **CCO `/compliance-review` pass** over the docket above.
2. Optional short verification walk (one Sonnet regression persona) if you want experiential re-confirmation before merge — engineering evidence above is complete without it.
3. **Merge decision** (yours; branch is 6 ahead, unpushed — say the word and it pushes for preview or PR).
4. **Deploy decision** (separate, per the standing runbook; note item 2 above for production rows).
5. Phase 1B remains gated and untouched.

## 9. The gate question, answered

*"Would a first-time operator describe CreditVector as The Credit Operating System?"* — The gate's answer was "not yet — the system is sometimes wrong about what has already happened in it." Every one of those wrongs is now closed: it knows what it drafted, what's clean, what's ready, what date you mailed, what you already approved, and what it may never charge you twice for. On the evidence in this report: **READY-WITH-DISCLOSURES**, and the disclosures are yours to clear, not code to write.
