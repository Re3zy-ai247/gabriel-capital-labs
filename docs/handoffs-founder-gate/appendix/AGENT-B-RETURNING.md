# Appendix B — Agent B: Returning Operator (Sonnet 5)

Account: `gate-b-returning@creditvector.test` (name "Marcus Webb", premium). Two-phase walk: build a working day (upload, 2 letters, deliberate mid-flight interruption, mark-mailed), then sign out and return.

> **Coordinator note:** B's #1 defect (sign-out not gating `/dashboard`) was mechanism-checked after the walk: it is the documented dev-only demo fallback (`lib/session.ts:67-72`, `currentUserOrDemo()` — "Disabled automatically in production", gated on `NODE_ENV`). It is reclassified **ENV-ARTIFACT** in the consolidated report; production and Vercel previews run production mode and fail closed. B's #2 defect (mailing-date UTC bug) was mechanism-confirmed as a real product defect (`lib/mailCenter.ts:521-534`).

---

## ROOM LOG

**Login (first visit).** "Welcome back — Sign in to pick up where you left off." Confirms continuity framing exists before you're even in. Clean, answers "why am I here."

**Mission Control (first login, empty account).** Verbatim: *"Welcome back, Marcus. Yesterday you completed — Quiet — nothing logged yesterday. Today so far — Quiet — nothing logged yet today. Today's priorities — Upload your credit report and I'll get to work. Rule: no reports on file yet."* Answers all four room questions cleanly for a zero-state. One tonal seam: "Rule: no reports on file yet." reads like raw business-rule output, not something Kai would say.

**Upload Report.** Pasted the Jordan Avery sample, checked TransUnion only, clicked Analyze. Resolved in ~15s: *"I finished reviewing your report. 6 accounts across TransUnion. No cross-bureau conflicts or age-limit flags stand out... 0 accounts with strong dispute grounds · 2 with moderate grounds. Scored by fixed rules against the data read from your report — each account's row shows exactly why it was flagged."* Good basis statement up front.

**Tradelines.** Rich per-account breakdown: confidence tier, "Why I flagged this," "Which laws apply" (with real § citations), "What stays uncertain," full strategy rationale (why this strategy/recipient/now, alternatives considered, expected timeline), and actual quoted statute text for FCRA §611 and FDCPA §809(b). This is the deepest "basis" transparency I saw anywhere. Defect found here: Midland, Capital One, and Portfolio Recovery all show **"First delinquency: Invalid Date"** and Kai's own text claims *"No date of first delinquency is on file"* — false; the uploaded report explicitly listed DOFD (11/2024, 11/2024, 03/2024) for all three. A parsing bug that also degrades the §605 legal analysis.

**Dispute Letters.** Selected Midland + Portfolio Recovery, both defaulted to "Debt Validation (Collections) ★ recommended" — matching Kai's own tradeline read. Both letters generated instantly: full FDCPA §809(b) demand letters with quoted statute text, itemized factual concerns, "[YOUR FULL NAME]" placeholders (correctly, since Settings has no name/address on file). "Ready to mail — the response clock starts once it arrives."

**Mail Center.** *"Every dispute you've mailed, its §611 reinvestigation window, and exactly what I recommend next."* Both letters showed as "Ready to prepare — Generated, not mailed yet — nothing's mailed and no §611 clock has started." I opened the **Portfolio Recovery Associates** letter's Preview/print view, read the full letter and the "How to mail this" guidance panel — **and deliberately stopped there**: did not print, did not download the package, did not click "Mail it" or mark it mailed. That preview page (`/letters/print/…`) is the exact point of interruption.

**Mark mailed (Midland).** Clicked "Mark mailed myself." A date field appeared: **"Date you mailed this," pre-filled `2026-08-04`.** True local time at that moment was Mon Aug 3, 10:46 PM EDT (confirmed via `new Date()` in-browser). Entering the *correct* date, `2026-08-03`, was **rejected**: *"The mailing date can't be before this letter was generated."* Re-entering the pre-filled `2026-08-04` (a date that had not yet arrived) was accepted, and the app declared *"Mailed today — I'm watching for their response. ~30d left."* The §611 clock is now anchored to a date that hadn't happened yet.

**Mission Control (session close).** This is the key test from the brief, and it passed: *"Today so far — Mailed Round 1 to MIDLAND CREDIT MANAGEMENT — the §611 clock starts once the bureau receives it / Generated a dispute letter / Generated a dispute letter / Analyzed a report — 6 accounts reviewed."* Then: *"Continue where you left off — A dispute letter to PORTFOLIO RECOVERY ASSOCIATES is generated and ready to mail."* It did **not** say "quiet — nothing needed." Interrupted work was honestly counted. Footer: "Done today: 4 · Still open: 2" — accurate.

**Sign out → unauthenticated `/dashboard`.** After clicking Log out, a fresh navigation to `/dashboard` rendered a **fully populated dashboard for a different account, "Welcome back, Demo,"** with its own 12-account case file, letters to Equifax/Experian/TransUnion, 22 linked records — while `fetch('/api/auth/session')` returned `{}` and `/api/onboarding/status` returned 401. Confirmed reproducible via network log (fresh 200, 79KB HTML) — not a cache artifact. I did not inspect source code; this is a purely observed browser/network finding. See defect #1. *(Coordinator: reclassified ENV-ARTIFACT — see note at top.)*

**Login (return) → Mission Control.** Re-authenticated properly (`/api/auth/session` confirmed `{"user":{"name":"Marcus Webb",...}}`). Dashboard rendered byte-for-byte the same honest state as before logout: "Welcome back, Marcus," same "Today so far," same "Continue where you left off" pointing at Portfolio Recovery.

**Resume click-through.** The "Continue where you left off" link deep-links to `/mail/send/{letterId}` — the *exact* letter I'd interrupted. Landed on **"Current step: Review & approve"** of a 3-step wizard (Review & approve → Confirm → Queued), correctly surfaced the same blocker as Kai's Executive Queue ("Add your mailing address in Settings first — a mailed dispute needs a return address"), with a "Download & mail it yourself" bypass. It resumed in the right place, with consistent reasoning.

**Mail Center (return).** Its own "Do this first" widget now said: *"30 days left on the MIDLAND CREDIT MANAGEMENT window — Round 1 — no action needed yet. Kai is watching the clock."* No mention of the address gap or the still-unmailed Portfolio Recovery letter as anything requiring first action. Contradicts Mission Control's Executive Queue "Do this first: Complete your mailing address" evaluated on the same underlying state — see defect #3.

**Journey/Timeline.** Fully consistent with Mission Control's history: same 5 events, same dates. *"Kai's recommendation: Nothing new to recommend right now — quiet is allowed."* Good restrained tone.

**Settings.** "Full Legal Name"/address fields genuinely empty (distinct from the account's display name "Marcus"), which correctly explains the letter placeholders — no contradiction here, appropriately cautious design.

## EMOTIONAL REGISTER (1–5)

- **Confidence: 4** — statute citations and explicit confidence tiers build real trust in the guidance; docked for the false DOFD claim.
- **Momentum: 4** — deep links and "next action" framing keep you moving; the date-rejection error briefly stalls it.
- **Trust: 2** — the sign-out data leak and the reject-true-accept-false date bug both strike at the exact two things this product must never get wrong: who you are, and when your legal clock started.
- **Professionalism: 4** — letter copy and disclaimers are polished; undercut by raw "Rule: ..." fragments.
- **Executive quality: 3** — the Executive Queue's why/reasoning/if-you-do-nothing/cited-from structure is genuinely briefing-grade, but the page it lives on is long enough (15+ stacked sections) to read more like an ops console than a distilled brief.
- **Calmness: 4** — "quiet is allowed," "no action needed yet" — resists manufactured urgency.
- **Progress: 4** — mission %, roadmap stage, timeline all clearly show forward motion.
- **Completion: 3** — satisfying counters ("Done today: 4"), but readiness meters for Rental/Employment-screening/Business-credit on a first session make "done" feel perpetually out of reach.
- **Mastery: 3** — projects its own mastery convincingly; occasionally exposes internals ("Cited from: Mission m_validation · dispute") that make the *user* feel less masterful, not more.

## TOP 5 EXPERIENCE DEFECTS

1. **BLOCKER — Sign-out does not gate `/dashboard`.** Signed out (`/api/auth/session` → `{}`), then `/dashboard` rendered a full, populated case file for a different account ("Welcome back, Demo," 12 accounts, letters to all three bureaus). For a product whose entire pitch is a *personal* OS, showing the wrong person's real case data — or any data — to a signed-out visitor is the single worst thing that can happen at the "return" moment this whole test is built around. *(Coordinator: ENV-ARTIFACT — dev-only demo fallback, disabled in production.)*

2. **BLOCKER — Mailing-date defaults to a future UTC date and rejects the true local date.** "Date you mailed this" pre-filled `2026-08-04` while local time was still Aug 3, 10:46 PM. Entering the correct date (`2026-08-03`) was refused ("can't be before this letter was generated"); the false future date was accepted and started the §611 clock. This is a UTC/local-date mismatch touching the one number (the legal response deadline) this product cannot afford to get wrong.

3. **MAJOR — Rooms disagree about "what's first."** At identical account state, Mission Control's Executive Queue says "Do this first: Complete your mailing address" while Mail Center's own "Do this first" widget says "no action needed yet" and never mentions the address gap or the sitting unmailed letter. Two different rooms, two different verdicts on the same facts — breaks the one-operator-one-voice illusion.

4. **MAJOR — Same fact repeated 3x on one screen, in three registers.** "Complete your mailing address" and "Debt-validation opportunity" each appear three times on Mission Control (summary card, numbered Do-Now list, Priority Queue widget), worded slightly differently each time, alongside terse "Rule: ..." fragments sitting next to rich "Kai's reasoning: ..." prose. Reads as several dashboard widgets independently reporting the same thing, not one intelligence.

5. **MAJOR — Tradeline dates silently fail to parse, then the system claims data it has doesn't exist.** Uploaded report included Date of First Delinquency for 3 accounts; Tradelines shows "Invalid Date" and Kai's own uncertainty caveat asserts "No date of first delinquency is on file" — factually wrong, and it downgrades the §605 legal analysis based on data loss the user can't see happening.

## TOP 3 DELIGHTS

1. **The core promise was tested honestly and it held.** "Today so far" listed everything I actually did — it never claimed quiet when work was mid-flight — and "Continue where you left off" named the exact interrupted letter, then deep-linked to the exact correct wizard step on click, with the same blocking reason repeated consistently. This is the hardest part of the brief, and it worked.

2. **Statute-grounded "show your work."** Every recommendation carries "Which laws apply," verbatim quoted FCRA/FDCPA text, "What stays uncertain," and "Alternatives considered" — reads like a credentialed analyst's file notes, not a black-box suggestion.

3. **Restraint in quiet moments.** "Quiet is allowed." "No action needed yet — the collector must validate the debt before continuing." "You're all caught up." The product doesn't manufacture urgency to stay engaging — a genuinely executive trait.

## WEB-PAGE-VS-OS VERDICT

Within a single room, this rarely feels like a web page — the Kai voice, the statute citations, and the deep-linked resume behavior are authored, not templated. It breaks in three places: (1) the primary sidebar nav itself flickers — "Getting Started" and "Operator Network" appear/disappear between route loads as async checks resolve, and real OS chrome shouldn't reshape itself as you walk between rooms; (2) Mission Control's sheer stacked length (15+ independently-titled sections, several repeating the same fact) reads like a composite of CRUD widgets bolted onto one route rather than a distilled command deck; (3) the Dispute Letter Builder is, structurally, two `<select>` dropdowns and a generate button — functional, but a form is a form. None of this is fatal individually; together they're the seams where "operating system" reverts to "very well-written dashboard."

## FINAL ANSWER

**QUALIFIED YES.** The specific thing this test was designed to catch — a false "nothing to see here" on return, papering over interrupted work — did **not** happen; that mechanism is real and well-built. But the illusion breaks at the two moments an operator most needs to trust it completely: leaving (sign-out didn't actually lock the account view) and committing a legal date (the mail-date default is wrong and blocks the correct one). A founder would ship the "remembers me" experience as-is; a founder would not ship it without fixing the session gate on sign-out and the mail-date timezone logic first.
