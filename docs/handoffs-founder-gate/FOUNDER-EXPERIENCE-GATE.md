# CreditVector — Founder Experience Gate — Release Gate 1.0

**Date:** 2026-08-03 · **Branch:** `feat/experience-runtime-phase-1a` (Phase 1A @ `7df3d7b`, pushed; + local docs commit `3529271`, unpushed)
**Production:** untouched (`origin/main` @ `f449c35`) · **Stop conditions honored:** no merge · no deploy · no production migration · no Phase 1B · no Wallet · no LetterStream
**Program Director:** Claude Fable 5 · **Experience walks:** 5× Claude Sonnet 5 · **Independent acceptance:** Claude Opus 5 (blind, bounded)

---

## 1. Executive Review

**Release verdict: NOT READY — with a short, precisely-mapped path to READY.**

Five Sonnet operators walked the implemented product as five different people (first-timer, returner, agency owner, mail-ops, Kai auditor) and independently returned the same shape of answer: **QUALIFIED YES ×5**. The independent Opus acceptance gate, run blind to their findings on both a cold account and a worked file, returned **NOT READY** — and its reasoning subsumes every qualification the five walks raised:

> "An operating system is not a system that talks like one — it is a system whose picture of your file is the same in every room and is never wrong about what you already did. This one has the voice and roughly two-thirds of the fact base."

The split is unusually clean:

- **What Phase 1A set out to fix, it fixed.** Every §611 date claim found by a dedicated hunt is receipt-anchored (zero violations). The quiet state never lies — interrupted work is honestly promoted and counted. "Continue where you left off" deep-links to the exact interrupted step. Onboarding checkmarks mean *done*, not *visited*. The approve control sits structurally outside Kai's panel. The evidence asymmetry is disclosed at every fork with the "(soon)" line. Workspace switching leaks nothing. No emoji or exclamation mark exists anywhere in Kai's voice.
- **What breaks is one layer: cross-room / cross-action state coherence.** The engine that says "do this next" doesn't know about letters that already exist. The Mail Center's headline band doesn't know about the ready-to-mail packages in its own room. The date picker can't accept the true mailing date. The download chain will walk you calmly into mailing a letter addressed from `[YOUR FULL NAME]`. Fixing a letter costs a letter. None of this is a redesign — all of it is state wiring and copy, and the three heaviest items now have confirmed file:line mechanisms.

Every one of the six release blockers below is a bounded fix. Nothing found touches the locked architecture.

## 2. The Six Release Blockers

The union of the Opus gate's four blockers and the two blocker-class defects the walks confirmed with mechanism. These are the gate; close them and re-run a bounded verification pass.

| # | Blocker | Evidence | Mechanism (confirmed) |
|---|---|---|---|
| **RB-1** | **The OS orders work it already did.** Demo file: three §605 Navient letters exist, generated and unmailed — Mission Control, the Kai dock (on the Letters page itself), and Timeline all still headline "Navient … §605 … Review this item & dispute." Under a footer that says "no fabricated priorities," this is a fabricated priority. | Opus (4 rooms); reproduces anywhere the §605 branch fires on a lettered item | `lib/kaiHome.ts:90` — the §605/obsolete branch (deliberately computed first for the Phase 1A starvation guard) filters only `!t.resolved`; it never checks the `disputedIds` set the general ladder already builds at `lib/kaiHome.ts:206`. One-condition fix. |
| **RB-2** | **Never-late accounts are counted as "active negatives" and staged for §611 dispute.** "6 active negatives" on a file with two `Pays as agreed / Never late` accounts; Deferred queue stages Nelnet and Toyota for "Bureau reinvestigation (§611)"; clean tradelines get a nonzero "dispute strength 18/100" with no "nothing to dispute here" state. Proposing disputes of accurate accounts is the one thing this product must never quietly do — this is compliance surface, not just UX. | Opus (both accounts); Agent A independently | Counting/staging logic treats every unresolved tradeline as a dispute candidate; no clean-account carve-out state exists. |
| **RB-3** | **The Mail Center's own "Do this first" band is blind to its own room.** "You're all caught up — no action waiting on you here" directly above two READY-TO-PREPARE packages; after mailing one, the band narrates the passive waiting window and stays silent on the still-actionable package — while Mission Control's queue, reading the same data at the same instant, points at it correctly. | A, B, D, Opus — four independent reproductions across two states | `lib/mailCenter.ts:462` `pickMailBand` — by design it never computes a second ranking (one-ladder law); its fallback chain is kaiHome-primary → starvation-secondary → deadlines queue, and no rung represents READY_TO_PREPARE packages. The state F1 created is real in the section list but invisible to the band. |
| **RB-4** | **The download chain ships placeholder letters without a word.** Card → Evidence → "Ready to download?" → "Mark reviewed — ready to mail" → "Download & print" never mentions the artifact still reads `[YOUR FULL NAME] / [YOUR ADDRESS] / [CITY, STATE ZIP]` (and `[Furnisher mailing address]`). The only warning lives on `/letters`, which Mail Center never surfaces; completing the profile does NOT retro-fill already-generated letters; the letter card simultaneously says "Ready to mail." An operator who trusts the room mails an unreturnable letter. | D (DOM + API-confirmed), Opus, A | Letter body/preview frozen at generation; no placeholder check anywhere on the download path. |
| **RB-5** | **The mailing date — the anchor of the §611 estimate — cannot be entered truthfully in a US evening.** The picker renders `min = max = value =` server-UTC "today" (tomorrow, local); the true local date is rejected ("The mailing date can't be before this letter was generated"); the stored `mailedAt` (UTC midnight) then displays back as the *prior* local day — two timezone faults visually canceling tonight, in one timezone. | B (live rejection), D (DOM `min=max` + stored-vs-displayed) | `lib/mailCenter.ts:521-534` `validateMailedAtInput` — floor/ceiling both computed in UTC days against a local calendar-date input. |
| **RB-6** | **Fixing a letter costs a letter; the planner re-sells what you just approved.** Following the app's own banner (add the missing recipient address → Generate) creates a duplicate and burns a second credit; deleting the duplicate refunds nothing; on the free tier of 3, Day 1 ends 3/3 spent on 2 disputes. The direct trigger: the campaign planner re-recommends the just-approved campaign (same two creditors, live buttons) while silently renumbering. | A (Billing-confirmed: "Letters This Month 3 / 3 · 0 remaining") | Generate is a naive insert (no draft identity/idempotency across a correction); planner's recommendation set doesn't exclude just-approved campaigns. |

## 3. Experience Review — the emotional register

Nine dimensions, five independent walkers (1–5). The two weak axes are exactly where the blockers live.

| Dimension | A | B | C | D | E | Read |
|---|---|---|---|---|---|---|
| Confidence | 4 | 4 | 4 | 3 | 4 | Statute-grounded reasoning carries it |
| Momentum | 4 | 4 | 5 | 3 | 3 | Wizards + deep-linked resume keep motion |
| **Trust** | 3 | 2 | 4 | 2 | 3 | **Weakest — every low score traces to a state contradiction** |
| Professionalism | 4 | 4 | 4 | 5 | 3 | Letters + paper-styled print view are the peak |
| Executive quality | 4 | 3 | 3 | 3 | 3 | The idiom is executive; Mission Control's volume isn't |
| Calmness | 3 | 4 | 5 | 5 | 3 | "Quiet is allowed" is real and felt |
| Progress | 4 | 4 | 4 | 5 | 4 | Steppers, roadmap %, honest counters |
| **Completion** | 2 | 3 | 3 | 3 | 3 | **Weak — quota burn, owner's invisible day, perpetual readiness meters** |
| Mastery | 3 | 3 | 4 | 4 | 3 | Teaches the law genuinely; template reads cap it |

## 4. Room-by-Room Findings

**Login / Register / Onboarding — PASS.** Signup lands new accounts on onboarding (the front-door wiring works); five steps, one CTA each; checkmarks are truth ("step 1 lit only after the profile actually had data"). Gaps: the wizard never links Mission Control; registration name isn't carried into Settings; **discrepancy to reproduce** — E found /onboarding checkmarks truthful while Opus found a five-step "Getting Started" checklist with zero completion state after four steps were done (different account; possibly a different surface or a refresh fault).

**Mission Control — the room that costs the most.** The session header is the single best moment of the product ("Welcome back, Marcus" → yesterday/today/priorities/continue-where-you-left-off — B: "the hardest part of the brief, and it worked"). Below the fold it becomes the product's biggest liability: 7.6 screens; the same action restated in up to four idioms ("one-list" falsified by the list beneath it); 12 KAI badges per load, several on cards the page itself labels "no AI"; three different progress percentages, two both named "journey"; stale queue cards contradicting fresh ones; internal IDs ("Cited from: Mission m_address · address_consistency"); raw rule strings ("Rule: no reports on file yet."). Agency owners get an altitude-aware composition (code-confirmed) whose *visible output* never says agency, roster, or role — indistinguishable from a consumer at 0 clients (C's blocker-leaning finding), and the owner's own day stays "Quiet" directly above priorities generated by that owner's client work (the disclosed F4 gap — C: "it stings more here than in the abstract").

**Upload Report — PASS with one fault line.** Live narration during analysis, specific completion summary, one recommended next item. The fault: the deterministic fallback parser drops DOFD dates → "First delinquency: Invalid Date" rendered raw in three rows (A, B, E) → Kai then asserts "No date of first delinquency is on file" — a confidently wrong legal-adjacent claim about data the operator can see in their own report; the same parser typed an explicit `CHARGE-OFF` account as "Revolving / Low" (Opus). *Environment note:* production runs the AI parser first — but this fallback ships in production and runs on any AI failure; its fidelity and its "Invalid Date" rendering are real product surface.

**Tradelines — the strongest analytical room.** Progressive disclosure done right (one-line rows, statute-cited depth behind "Kai's read ▾"); real § text quoted; the Capital One → Midland resale caught as "same debt ×2" unprompted. Caps: byte-identical reads across structurally different accounts ("Original-creditor account — accuracy of status/dates is disputable…" on a charge-off, a current card, and a never-late auto loan), and the same debt-buyer paragraph appearing 7+ times across 5 rooms.

**Dispute Package (Letters / Campaigns).** The letter itself is the product's crown jewel — §809(b)/§611 statute text quoted correctly, itemized factual concerns, "Nothing in this letter acknowledges the debt or waives any defense," honest placeholder banners on the builder page. Around it: RB-6 (credit burn + planner re-offer), the broken cross-screen promise ("the letter builder pre-fills … the recipient's address" — it doesn't), a quota-blind builder (0 remaining, no copy, four rooms still pushing you in), and government/statutory items that Tradelines says are "excluded from the dispute queue" still listed in the builder's dropdown.

**Mail Center — decisively a workspace, not a statistics page.** Package cards keyed by item+strategy+round; states migrate sections in real time; metrics literally demoted to an `aria-label="Context strip"` footer; the Kai-advises/you-approve separation structurally enforced; the six locked fulfillment steps ("Available after live mail integration") embedded honestly in the per-package stepper; §611 receipt-anchoring **flawless across every surface a dedicated hunt could find**. Its two failures are RB-3 (the band) and RB-4 (the placeholder-blind download chain), plus shallow `href="/letters"` action links where deep links belong.

**Timeline — the best-judged room.** "Nothing new to recommend right now — quiet is allowed." Distinct, non-boilerplate narration per event; Month 1/2/3 checklists that match reality; consistent with Mission Control's history. Faults: phantom "Dispute letter generated" events survive letter deletion (A), and three identical unlabeled rows where the adjacent block names the three bureaus.

**Agency — the loop is real.** Roster room with live capacity ("Clients 2 / 15"), commissioning-not-CRUD client creation ("I checked every follow-up clock…"), airtight on-behalf-of banners on every room tested, zero cross-client leakage, letters correctly voiced as the client's own. Faults: the front door doesn't know she's an owner (RB-adjacent, see Mission Control), Billing tells the $399 Agency tier to "Upgrade to Professional to get started" (a tier-blind template also shown to Professional accounts as an upsell of the plan they're on), Settings has no agency-identity fields.

**Settings / Support / Identity / placeholders.** Support is a real ticket form ("No open tickets. If something's off, I'm here."). Identity has sensible privacy defaults (SSN card off by default) and degraded honestly without an AI key. Placeholder surfaces are honest about being placeholders — except Brief ("I read the CFPB and FTC wires every morning" over "No articles here yet") and Operator Network (six workspaces, all "0 briefs"), which claim habits they don't yet have; Brief also ejects an authenticated operator into logged-out marketing chrome.

## 5. Kai Review

Scorecard from the dedicated audit (E), corroborated by all walks: **Over-talking FAIL · Repetition FAIL · Interruption PASS · Teaching MIXED · Register MIXED · Silence PASS.**

- The verdict in one line: *"Kai sounds like a genuine Chief Intelligence Officer in the rooms where the stakes are highest — Tradelines' legal reasoning, the generated letter, Timeline's restraint — but reverts to a badge-stamped template engine the moment you land on its own home screen."*
- Zero emoji, zero exclamation marks, anywhere, across nine rooms — the Phase 1A register law held.
- Kai never interrupts (dismissible, non-modal, never gates work) and its silences are deliberate ("quiet is allowed").
- The three moves that most advance the "nearly invisible" bar: (1) strip Mission Control — badge only what is actually Kai, one statement per fact, no internal IDs; (2) differentiate per-item reads by the account's actual facts or relabel them as category guidance; (3) give failure states Kai's voice and a fallback ("Plan generation failed. Please try again." is the one place the persona vanishes).

## 6. Mission Control Review — see §4; the two-sentence version

The session runtime at the top is the most operating-system moment in the product, and it survived a deliberate interruption/return test with a perfect deep-linked resume. Everything below it needs an editor: one fact, one statement, one owner — today the room restates, contradicts itself, badges the inert, and leaks its internals, which is why every walker's "web page tell" list starts here.

## 7. Mail Center Review — see §4; the two-sentence version

Structurally the room the Founder asked for: a work-first operational workspace whose §611 language never lies and whose approval chain keeps the human holding the pen. Its own headline band (RB-3) and the placeholder-blind download chain (RB-4) are what stand between "impressive" and "trustworthy."

## 8. Timeline Review — see §4; the one-sentence version

The room most at peace with itself — honest, restrained, narratively coherent — needing only event deduplication and per-event specificity.

## 9. Recommended Polish (after the six blockers)

Ranked by experience impact per unit of work:

1. **Mission Control consolidation** — one restatement per fact; KAI badge only on Kai; delete "Rule: …" and "Cited from: …" internals from operator view (keep them behind the Exhibit drawer, which is excellent); one progress number, or three clearly-differently-named ones.
2. **Fallback-parser fidelity + honesty** — parse `MM/YYYY` DOFD; never render `Invalid Date`; when a field genuinely fails to parse, Kai says "I couldn't read the first-delinquency date," never "none is on file"; classify explicit `CHARGE-OFF` text as a charge-off.
3. **Agency altitude visibility** — the owner's Mission Control names the agency and roster state in its header line; the owner's day ledger credits work done inside client workspaces (or explicitly says "logged under Elena's file — see her workspace").
4. **Cross-room promise audit** — kill or fulfill: "pre-fills the recipient's address," "Case health: no action needed" beside "DO NOW 3," Roadmap "campaign underway" vs Command Center "0 campaigns," quota-blind builder vs Billing's 0-remaining.
5. **Deep links everywhere an action names a specific object** ("Mail it →" to the letter, not `/letters`).
6. **Tier-aware billing/upsell copy** (Agency told to upgrade to Professional; Professional upsold Professional).
7. **Keep authenticated chrome in Brief; label it "arrives with launch" until the cron runs.**
8. **Paywalls gate the button, not the click** (Strategy Desk).
9. **Reproduce and fix the Getting-Started discrepancy** (truthful on one account, memoryless on another).
10. **Campaigns hydration flash; double-period typo; band eyebrow consistency; unlabeled context-strip pill.**

## 10. What Held — the Phase 1A engineering fixes, validated experientially

| Phase 1A claim | Gate result |
|---|---|
| §611 receipt-anchored everywhere (F2/F6) | **HELD — zero violations found by a dedicated hunt** |
| Honest quiet state; interrupted work counted (F3) | **HELD — tested by deliberate interruption; passed exactly** |
| READY_TO_PREPARE reachable pre-mail (F1) | **HELD in the package sections** — but invisible to the band (RB-3) |
| Onboarding truth: visited ≠ done (F10) | **HELD** (with the Opus Getting-Started discrepancy to reproduce) |
| Emoji/range-law fix | **HELD — zero emoji/exclamations in nine rooms** |
| Approve outside Kai's panel | **HELD — structurally separate cards** |
| Evidence asymmetry + "(soon)" disclosure | **HELD — present at every fork, verbatim** |
| Send path present, honestly gated | **HELD — 3-step wizard, real prerequisites, always an escape hatch** |
| Cache scoping across workspace switches (F8) | **HELD — zero leakage, airtight on-behalf-of** |
| Neutral greeting (F7) | **HELD — "Welcome back," no time-of-day guess** |

## 11. Multi-Agent Execution Workflow (second directive) — DONE

`.ai/SOP/MULTI-AGENT-EXECUTION.md` + self-contained HTML twin + one INDEX routing line, commit `3529271` (local, unpushed). Sonnet implemented; Opus challenged once (ACCEPT-WITH-CORRECTIONS — 4 BLOCKER / 4 MAJOR / 2 MINOR / 1 ruling); every correction applied verbatim and parity-verified. The corrected SOP now binds **all** agents (Fable included) to the hard prohibitions, adds push/PR/DB-mutation to the prohibited list, floors every packet with a NEVER-ALLOWLIST (secrets, migrations, governance docs, the SOP itself), makes Opus review additive to — never a substitute for — the CCO/ADR/Gate D-F gates, restricts external publishing to Fable-after-secret-scan, and gives sub-agents a HALT-and-refuse path that Fable must surface verbatim. Full arc, including the two disclosed integrity events (a coordinator mis-route that a sub-agent correctly refused; an implementer judgment call correctly flagged instead of silently obeyed): Appendix G.

## 12. Methodology & Environment (what this gate did and didn't test)

- App run locally from the Phase 1A worktree against the **isolated preview database** (Vercel env-scoping proof; 6-user DB). Production untouched throughout.
- **No live AI key locally** (Vercel redacts sensitive values on pull): the deterministic experience runtime — everything Phase 1A shipped — was fully exercised; free-form AI surfaces (ask-Kai, strategist plan, identity check, AI parse) ran in fallback/degraded mode and were graded only on degradation quality, tagged ENV-LIMITED. Production AI behavior was not tested.
- **ENV-ARTIFACT, not a defect:** signed-out `/dashboard` rendering demo data is the documented dev-only fallback (`lib/session.ts:67-72`, disabled in production builds — which Vercel previews and prod both are).
- Five personas on five isolated accounts + one blind Opus pass on a cold account and a worked file; all walks headless-browser, UI-only, no source reading by experience agents; every blocker mechanism-verified against source afterward by the coordinator.
- Prior CCO items from the Phase 1A package (the "(soon)" line, residual "clock started" narrations in `lib/kaiSeen.ts` / journey, the "Queued for CreditVector to mail" accomplishment, the raw "N/100" score copy) remain open for the compliance-review gate; nothing in this gate closes or supersedes them, and RB-2 adds one more compliance-adjacent item to that docket.

## 13. Release Recommendation

1. **Do not merge Phase 1A to `main` yet.** (It isn't merged; keep it that way.)
2. Commission a bounded **Phase 1A-R remediation slice**: RB-1 through RB-6 only, under the new SOP's task-packet discipline. RB-1, RB-3 and RB-5 have confirmed file:line mechanisms and are small; RB-4 is a placeholder-check + one banner; RB-6 is draft-idempotency + planner exclusion; RB-2 needs a "clean account" state and a counting fix, and its copy should ride through the CCO gate.
3. Re-run a **short verification gate** (one Sonnet regression walk on the six fixes + one bounded Opus re-check; hours, not days).
4. Then the CCO pass (existing 4 items + RB-2's framing), then the merge decision, then the deploy decision — as separate approvals, per the standing gates.
5. Mission-Control consolidation (Polish #1) is the highest-value non-blocker and can ride the same slice if you want the front door to match the rest before launch; it is not required to clear the gate.

## 14. Founder Summary

You asked one question: **"Would a first-time operator describe CreditVector as The Credit Operating System?"**

**Not yet — and the reason is narrow.** Five simulated operators and one adversarial reviewer all landed on the same sentence: the product *talks* like an operating system everywhere, and in the rooms where law meets paper — Tradelines' reasoning, the letters themselves, the Mail Center's package chain, the Timeline's restraint — it *is* one. The illusion breaks at exactly one layer: the system is sometimes wrong about what has already happened in it. It re-orders work it already did, calls clean accounts negatives, says "all caught up" over unmailed mail, marks placeholder letters "ready," refuses the true mailing date, and charges a letter to fix a letter. Every one of those is state wiring, not architecture; three of the six now carry confirmed one-condition mechanisms. Close the six, re-walk once, and the answer to your question flips — because the hard parts (the voice, the honesty gates, the legal spine, the session runtime that remembers you) already survived five people trying to break them.

**The final gate answer: NOT READY — six blockers from YES.**

---

*Appendices A–G carry the full verbatim agent reports (first-time, returning, agency, Mail Center, Kai audit, Opus acceptance gate, workflow arc).*
