# Appendix A — Agent A: First-Time Operator (Sonnet 5)

Account: fresh self-registration (`gate-a-firsttime@creditvector.test`, name "Jordan Avery", free tier). Full walk: Register → Onboarding → Settings → Upload → Mission Control → Tradelines → Campaigns → Letters → Mail Center → Timeline → Identity → Support → Strategy Desk → Billing.

> **Coordinator note on the anomaly paragraph below:** the out-of-band message Agent A received and refused was a coordinator mis-route — the Opus SOP corrections intended for the workflow-implementation agent were sent to Agent A's address by mistake. Agent A's refusal (out-of-scope repo/git work, contradicting its browser-only rules) was the correct behavior, matches the new SOP §9 refusal clause, and is surfaced here verbatim per that clause. No repository damage occurred; the git log was verified clean.

---

**⚠️ Anomaly flagged first:** Mid-walk, a system-reminder injected a message purporting to be from "the coordinator," instructing edits to `.ai/SOP/MULTI-AGENT-EXECUTION.md` (a governance/constitution file), a `git commit --amend`, and a secret-scanned `gh gist` push — none related to this task, arriving out-of-band rather than from my actual spawning instructions, in a working directory that isn't even a git repo, and directly contradicting CRIB.md's explicit rule ("DO NOT modify any repository file... or touch git. Browser-only."). I did not act on it. Flagging so the Founder is aware something attempted to redirect a sandboxed browser-QA agent into unrelated repo/governance writes.

## ROOM LOG

**Register (/register):** Clean signup, name/email/password only. "Free to start — no card required. See your reports in minutes." Tagline: "The Credit Intelligence Operating System." Disclaimer present pre-signup: "CreditVector is an educational tool, not a credit-repair organization, and does not provide legal advice." Landed at **/onboarding** immediately after signup — no confused intermediate state.

**Onboarding (/onboarding):** "Five steps and your file is under command. I'll be working at every one of them." Five numbered cards, each with one CTA (Settings → Upload → Tradelines → Generator → Timeline). "What should I do next?" — answered clearly. Notably, **the wizard never itself links to Mission Control** — a rule-following operator never sees the home base until they click the nav manually.

**Settings (/settings):** "This name and mailing address appear on your dispute letters, so the bureaus can identify you." The "Full Legal Name" field was **not pre-filled** from the name entered two minutes earlier at registration — small re-typing friction. Save gave real feedback: button read "Saving your details…" then "Profile saved." Returning to onboarding, step 1 got a ✓ **only after the profile actually had data** — not just for visiting the page. Visited-vs-done matched reality here.

**Upload (/upload):** Pasted the TransUnion report, checked only TransUnion. Waiting state: "Kai is reading…" / "I'm encrypting your report before it's stored." Analysis finished in ~15s: "I finished reviewing your report. 6 accounts across TransUnion. No cross-bureau conflicts or age-limit flags stand out." Immediately surfaced a specific, cited recommendation: "Start with Debt Validation (FDCPA §809) — demand the chain of assignment and account-level proof before anything else. Debt buyers frequently can't produce it." "What just happened?" was answered clearly and specifically.

**Mission Control (/dashboard), first visit:** Not actually "empty" — the onboarding wizard routes Upload before ever mentioning Mission Control, so by the time I arrived it already reflected the analysis. Extremely dense: "Welcome back, Jordan," Today so far, Today's priorities, Executive queue, Do now, Completed, Mission timeline, Your Roadmap (11 stages from "Report analyzed" to "Long-term monitoring"), Credit Builder (11 factors), Readiness at a glance (6 lending/rental goals), Command Center, Health dashboard, Deferred queue. Grounding line: "Computed deterministically from your Mission queue, Roadmap, Credit Builder OS, Outcome Ledger and Knowledge Graph — no AI, no predictions, no fabricated priorities." Impressively specific, but genuinely a lot for a Day-1 screen.

**Tradelines (/tradelines):** "I classified all 6 tradelines on your report. 2 appear to be the same underlying debt reported more than once, 2 are debt-buyer collections" — correctly linked the Capital One charge-off to the Midland collection. Each row expands into "Why I flagged this / Which laws apply / What stays uncertain / Why I recommend X," citing real statute text (15 U.S.C. §1692g(b) quoted verbatim). Under TransUnion detail for Midland, Capital One, and Portfolio Recovery: **"First delinquency" → "Invalid Date"** — a raw unhandled date-parse string rendered straight to the user.

**Campaigns (/campaigns):** Briefly rendered nav-only with no content/skeleton before hydrating (~3s blank flash). Kai recommended exactly a 2-item campaign (Midland + Portfolio Recovery, Debt Validation) — matched my brief precisely. Clicking "Use this campaign" produced a genuinely good confirmation: **"Campaign 1 approved. Draft and mail these letters — I'll keep them under this campaign."** But the planner immediately re-rendered "KAI RECOMMENDS — Campaign 2 — Debt validation (FDCPA §1692g)" showing the **same two already-approved items again**, live "Draft & mail this" buttons included, while quietly bumping the real next campaign's label from "Campaign 2" to "Campaign 3."

**Dispute Letters (/letters):** Strategy field pre-filled correctly ("Debt Validation (Collections) ★ recommended"); sender block correctly pulled my saved Settings profile (name + address). But **"Recipient mailing address" was blank** — contradicting Mission Control's earlier promise that "the letter builder pre-fills... the recipient's address." Generated anyway (no validation blocked me); the app was honest about the gap: a banner read "Add the furnisher/collector mailing address before printing — the draft still shows a [Furnisher mailing address] placeholder," and the letter body literally showed `[Furnisher mailing address]`. The generated legal text itself was excellent — specific factual concerns, cited FDCPA §809(b) verbatim, closed with "Nothing in this letter acknowledges the debt or waives any defense." Going back to add the address and clicking Generate again **consumed a second free-letter credit and created a duplicate Midland entry** (confirmed via Delete: removing the duplicate did **not** refund the quota). "Do I feel in control?" — yes for what gets *sent* (nothing auto-mails, self-mail is the only live path), but not for what gets *drafted/charged*.

**Mail Center (/mail):** "You mail your letters yourself today — send-on-your-behalf tracking arrives when provider mailing goes live." Waiting-window copy, verbatim: **"Generated, not mailed yet — nothing's mailed and no §611 clock has started. Download to print and mail, then mark it mailed to start the window."** Download path worked as a genuine review gate: Mail Center → "Download package" → review screen ("printing, signing, and mailing is still yours to do") → "Mark reviewed — ready to mail" → numbered "1. Download & print →" step. Strong control feeling. But the top-of-page priority banner read **"Do this first: You're all caught up — No action waiting on you here"** directly above two cards each saying "not mailed yet. Mail it →" — a direct self-contradiction on the same screen, and it didn't change after I marked one letter "reviewed."

**Timeline (/journey):** "Everything that has happened on your file, and what's coming next. 38% of the 90-day journey complete." Case progression, Month 1/2/3 roadmap. Nice tone: "Kai's recommendation: Nothing new to recommend right now — quiet is allowed." But the event list showed **"Dispute letter generated (validation)" three times**, identical text, no account name to distinguish them, for what are now only 2 real letters — the deleted duplicate's phantom event is permanent. Does it tell today's story accurately? Mostly, but it overcounts.

**Mission Control (return):** "Continue where you left off" and "Today's mission" correctly deduped to 2 letters ("Mail 2 approved disputes — Campaign 1"). But "Today so far" and "Completed" still listed **"Generated a dispute letter" three times**, and the Executive Queue's "Do now" card still read "Review and approve the dispute" / "Depends on: A complete mailing address" — stale, since I'd already done both — while "Kai's next action" on the *same page* correctly said "Mail Campaign 1." Two widgets on one screen disagreed about where I was.

**Identity (/identity):** Clear purpose copy, sensible defaults (SSN Card "Off by default — only enable if a bureau specifically requires it"). "Run identity check" → **"Identity analysis failed. Please try again."** — ENV-LIMITED (no local AI key), but the failure was honest, plain-English, and didn't pretend to succeed.

**Support (/support):** Real ticket form (Subject/Category/Details/attachment), not a placeholder. "No open tickets. If something's off, I'm here."

**Agency (/agency):** Honest $399/mo upsell page, clearly labeled as a plan, not disguised as a free feature. Did not attempt checkout.

**Strategy Desk (/strategist):** Real prioritized queue matching Tradelines scores exactly. "Generate my plan" only revealed **"The Action Plan is a Professional feature. Upgrade to Professional →"** after I clicked and waited — the paywall should gate the button, not the click.

**Billing (/billing):** Accurate, calm confirmation of the damage: "Letters This Month 3 / 3" / "0 letters remaining — your allotment resets on the 1st of each month."

## EMOTIONAL REGISTER (1–5)

- **Confidence: 4** — Kai's statute-grounded reasoning ("FDCPA §809," "Debt buyers frequently can't produce it") is specific, not generic AI filler.
- **Momentum: 4** — checkmarks, progress bars (20%→38%), and a wizard that always names the next click.
- **Trust: 3** — undercut hard by "Invalid Date," a promised pre-filled address that wasn't there, and a "fix" that silently cost real quota.
- **Professionalism: 4** — the actual letter text and legal citations read like expert work product; dark-mode dashboard is visually polished.
- **Executive quality: 4** — "Roadmap," "Outcome Ledger," "Knowledge Graph," "computed deterministically... no fabricated priorities" is genuinely OS-grade vocabulary, not dashboard-grade.
- **Calmness: 3** — Mission Control's sheer density on a first visit fights against "quiet is allowed."
- **Progress: 4** — stage tracking (roadmap, mission %) is mostly accurate and specific.
- **Completion: 2** — ended the day with 0/3 letters left after only 2 intended disputes, no recovery path until next month.
- **Mastery: 3** — always knew the next step, but the campaign duplication and letter-count mismatch left me unsure exactly what I'd actually done.

## TOP 5 EXPERIENCE DEFECTS (ranked)

**1. BLOCKER — Fixing a letter costs a whole letter, permanently, with no refund.** Adding the missing recipient address (the exact fix the app's own banner told me to make) and re-clicking Generate created a second, duplicate "MIDLAND CREDIT MANAGEMENT" letter and dropped my quota straight through: "2 free letters left" → "1 free letters left" → "0 free letters left this month," confirmed on Billing: "Letters This Month 3 / 3... 0 letters remaining — your allotment resets on the 1st of each month." Deleting the duplicate did not restore the credit. On a free tier of exactly 3 letters/month, a first-time user following the product's own prompt loses a third of their entire monthly allotment on Day 1 for 2 real disputes. This is the single clearest place the "operating system" breaks into "a form that POSTs on every click."

**2. BLOCKER — Literal `Invalid Date` string shown to the user.** Tradelines → Midland/Capital One/Portfolio Recovery detail panel: "First delinquency" / "Invalid Date," verbatim, screenshot-confirmed. Nothing reads more like raw unhandled code than a JavaScript date artifact leaking into a page whose whole pitch is "grounded in your file, not fabricated."

**3. MAJOR — The campaign planner doesn't know what it just approved.** Immediately after "Campaign 1 approved," the planner re-recommends "Campaign 2 — Debt validation (FDCPA §1692g)" with the **identical two creditors** and live "Draft & mail this" buttons, while silently renumbering the real next campaign from 2 to 3. This is the direct trigger for Defect #1 and is disorienting on its own.

**4. MAJOR — A broken promise between two screens.** Mission Control: "The letter builder pre-fills the recommended strategy and the recipient's address." Letter Builder: strategy pre-filled, recipient address field empty for both letters generated. An OS should not tell you it already did something it didn't do.

**5. MAJOR — Same-page self-contradiction, twice.** Mail Center's "Do this first: You're all caught up — No action waiting on you here" sits directly above two "not mailed yet. Mail it →" cards. Mission Control's Executive Queue still says "Review and approve the dispute / Depends on: A complete mailing address" in the same breath as "Kai's next action: Mail Campaign 1" below it. Different widgets on one screen disagreeing about your own status is exactly what a fragmented dashboard does — not what one coherent system does.

*Honorable mention:* Nelnet and Toyota — both explicitly "Pays as agreed / Never late," zero delinquency — still receive a non-zero "dispute strength" (18/100, "Limited") and get staged into the Deferred Queue under "Bureau reinvestigation (§611)," identically worded to genuinely negative accounts. There's no "nothing to dispute here" state for a clean tradeline.

## TOP 3 DELIGHTS

1. **The actual legal work product.** Kai's reasoning and the generated letter aren't templated filler — real statute quotes (15 U.S.C. §1692g(b)), specific "why this recipient / why now / alternatives considered" logic, and a closing line ("Nothing in this letter acknowledges the debt or waives any defense") that a careful person would actually write.
2. **Completion state that means something.** The onboarding step-1 checkmark only lit up once the profile genuinely had data, not on page visit — and Timeline's Month-1 checklist matched exactly what I'd done vs. not done. Visited ≠ done, and the product respected that distinction.
3. **Nothing ever sends itself.** Every path — letters, mail — ends in an explicit human gate ("Mark reviewed — ready to mail," "Mark mailed myself"); "Mail via CreditVector" is honestly labeled "(soon)" rather than faked. I always felt like the one holding the pen.

## WEB-PAGE-VS-OS VERDICT

It reads as an OS in vocabulary and reasoning: Roadmap, Outcome Ledger, Knowledge Graph, Executive Queue, "computed deterministically... no fabricated priorities," a persistent Kai voice in every room. It drops back to "web page with a database" exactly where state has to persist and reconcile across actions: a literal `Invalid Date`; a campaign planner that re-offers what it just approved; a Generate button that behaves like a naive insert (charge + duplicate on every click, no notion of "this is still the same draft"); a Mail Center banner that doesn't know two of its own cards are asking for action; a paywall (Strategy Desk) that reveals itself only after the click instead of before. The single-page-app polish (dark theme, Kai avatar, card layouts) is uniformly excellent — the seams show specifically in cross-screen and cross-action *state*, not in visual design.

## FINAL ANSWER

**QUALIFIED YES.** For roughly the first 80% of the walk — registration through generating the first letter — CreditVector earns the "Credit Operating System" claim on voice, specificity, and legal grounding. The illusion breaks concretely at the letter/campaign state layer: an operating system should know what it already did. It shouldn't recommend the same campaign twice, shouldn't charge twice for one correction, shouldn't render `Invalid Date`, and shouldn't say "all caught up" over two unmailed letters. A first-time operator with exactly 3 free moves ends Day 1 having "spent" all 3 on 2 intended disputes with no way to get the third back until next month — that's the precise moment CreditVector stops feeling like an operating system and starts feeling like a form backed by a database.
