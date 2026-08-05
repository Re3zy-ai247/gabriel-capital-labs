# Appendix C — Agent C: Agency Owner (Sonnet 5)

Account: `gate-c-agency@creditvector.test` — Dana Whitfield, owner of "Whitfield Credit Group" (agency plan, 15-seat cap). Walk: owner Mission Control → Agency room → create two client workspaces → work a client case end-to-end → exit → owner visibility checks → billing/settings.

---

## 1. ROOM LOG

**Login → Mission Control (0 clients).** Signed in clean, no friction. Landing copy: *"Welcome back, Dana."* / *"Yesterday you completed — Quiet — nothing logged yesterday."* / *"Today so far — Quiet — nothing logged yet today."* / *"Today's priorities — Nothing needs your attention right now."* / *"Quiet is allowed — nothing needed you today."* **CRITICAL TEST RESULT: this is the identical idiom a brand-new consumer with zero reports would see.** Nothing on this screen — no agency name, no roster count, no "0 clients" — signals Dana is anything but a solo consumer. "Why am I here?" unanswered for an owner. The only trace of agency capability is an "Agency" link tucked under a lower-priority "ACCOUNT" sidebar group, easy to miss on first landing.

**Agency room (/agency), empty.** A completely different, much stronger register. Header *"Whitfield Credit Group"* with live tiles (Active Clients, Letters Generated, Clients Added YTD, Accounts Deleted) and *"Clients 0 / 15"* front and center. KAI: *"Your roster is ready. Add your first client on the right — a full legal name is enough to start. The moment they're in, I set up their workspace and start tracking their follow-up clock so no dispute round slips."* Plus an upfront model-clarifier: *"Clients don't log in — you manage everything in their workspace."* "What should I do next?" answered instantly and correctly.

**Creating Elena Ramos + Terrence Cole.** Form asks only Full legal name (required) + address (optional) — no email field exists (clients never authenticate, by design). Each submission triggered an immediate KAI re-briefing: *"I checked every follow-up clock. 1 of 1 client needs attention: 1 awaiting a first letter. A client's ~30-day clock starts when the bureau receives their first letter."* This reads as commissioning a case, not saving a form row — the confirmation is a legal-operational fact, not a toast notification.

**Entering Elena's workspace — ON-BEHALF-OF TEST.** Passed cleanly and consistently everywhere I checked (Mission Control, Upload, Letters, Mail Center, Timeline all verified). Persistent bar under the header: *"Working in Elena Ramos's workspace [Exit to agency]"*, plus KAI itself re-greets: *"Welcome back, Dana — you're in Elena Ramos's workspace."* Zero moments of ambiguity about whose data was on screen.

**Upload + analysis (Elena).** Pasted the sample TransUnion report, analyzed in ~3s (deterministic parser). KAI: *"I finished reviewing your report. 6 accounts across TransUnion... What matters most — MIDLAND CREDIT MANAGEMENT — Worth disputing — Third-party debt-buyer collection... Start with Debt Validation (FDCPA §809) — demand the chain of assignment... Debt buyers frequently can't produce it."* Correct, specific, actionable — "What just happened?" and "What should I do next?" both answered in one card.

**Letter generation (Elena).** One click from the analysis card pre-filled the letter builder (item = Midland, strategy = "Debt Validation (Collections) ★ recommended"). Filled a recipient address, generated instantly: a full, statute-cited FDCPA §809(b) validation letter, correctly addressed **from Elena Ramos** at her address — not from Dana or the agency. Afterward: *"Ready to mail — the response clock starts once it arrives."* The work reads unambiguously as the client's own legal correspondence, exactly as it must for a real dispute letter.

**Exit to agency.** Landed back on /agency instantly. Stats updated correctly: *"Letters Generated 1 · 1 WTD"*; Elena's row now *"Tampa, FL · 6 items · 1 letter"*; Terrence's row untouched at *"0 items · 0 letters."* No cross-contamination.

**Mission Control, owner altitude, after client work.** Big finding: still *"Welcome back, Dana."* — no agency framing — but now *"Today's priorities"* correctly lists: *"Send the first letter for Terrence Cole — No letters mailed to this client yet."* / *"Send the first letter for Elena Ramos — No letters mailed to this client yet."* *"Done today: 0 · Still open: 2."* Sitting directly above this, unchanged: *"Today so far — Quiet — nothing logged yet today."* Dana just spent real working time in Elena's workspace (upload, analysis, a generated letter) and her own session ledger says nothing happened. Per the brief's known-gap framing: **it stings more here than in the abstract**, because the priorities card two inches below proves the system has all the data — it just doesn't credit the owner's session with her own labor.

**Terrence's workspace (isolation check).** Deliberately opened to check for leakage. Fully, correctly empty: *"Nothing for me to classify yet."* No trace of Elena, Midland, or the letter. Isolation is airtight.

**Mail Center — outside vs. inside client workspace.** Outside (owner altitude): *"Generated 0 / Mailed 0... Nothing mailed yet."* — scoped to Dana's own account, blind to the fact Elena has a letter waiting. Inside Elena's workspace: correctly shows *"Generated 1 · Midland Credit Management · Round 1 · Ready to prepare."* Banner and nav both correctly reflect "Working in Elena Ramos's workspace." Altitude switch is coherent here.

**Timeline/Journey — outside vs. inside.** Outside: Dana's own empty consumer journey (*"Current step: Upload your credit report"* — odd, since Dana is an operator, not a disputant, but harmless). Inside Elena's workspace: accurate, *"38% of the 90-day journey complete,"* 3 logged events (upload → analysis → letter generated), banner present. Coherent.

**Billing.** *"PLAN TYPE — Agency — ... up to 15 active client workspaces... $399.00/mo."* Capacity is stated plainly here too. But the empty payment-history state reads: *"No billing history yet. Upgrade to Professional to get started."* — telling the top-tier customer to upgrade to a *lower* tier. Unparameterized template bug.

**Brief (news room), reached via left nav while logged in.** Fully drops the authenticated app chrome (sidebar, KAI, "+ New Dispute") and renders the logged-out public marketing header/footer (*"Sign in / Get started"*), even though the session is still live (confirmed by returning to /dashboard afterward). Momentarily reads as an accidental logout.

**Settings.** Plain personal profile form (Full Legal Name / Address / City / State / ZIP / "Save Profile") described as *"This name and mailing address appear on your dispute letters"* — consumer-voiced, no agency-identity fields (letterhead, business info) distinct from Dana's own personal mailing address.

## 2. EMOTIONAL REGISTER

| Trait | Score | Evidence |
|---|---|---|
| Confidence | 4/5 | Agency room + letter flow are assured; the blank Mission Control opener seeds doubt about whether the room "gets" her. |
| Momentum | 5/5 | Add client → open workspace → upload → analyze → generate letter never stalled or asked an unnecessary question. |
| Trust | 4/5 | Statute citations, FCRA-clock precision, verified client isolation build real trust; docked for the "Rule: ..." leak and billing copy bug. |
| Professionalism | 4/5 | The letter itself and the roster cards are agency-grade; docked by the same two tells above. |
| Executive quality | 3/5 | /agency is genuinely executive; Mission Control, Settings, Billing, Journey are unmodified consumer/stock templates. |
| Calmness | 5/5 | *"Quiet is allowed — nothing needed you today"* is an unusually well-judged, non-alarming line. |
| Progress | 4/5 | Journey %, YTD stats, "Done today / Still open" counters all read as forward motion. |
| Completion | 3/5 | The case loop completes cleanly; Dana's own day never "completes" in her own ledger. |
| Mastery | 4/5 | KAI's dispute-strategy reasoning (chain-of-assignment, FDCPA §809 timing) feels like expert augmentation, not a form-filler. |

## 3. TOP 5 EXPERIENCE DEFECTS

1. **BLOCKER-leaning MAJOR — Mission Control gives zero agency signal at login.** Room: Mission Control (pre- and post-client). Verbatim: *"Welcome back, Dana."* / *"Nothing needs your attention right now."* Expected: some executive marker — agency name, client count, roster nudge — on the very first screen a $399/mo owner sees. Instead it's indistinguishable from a consumer with no reports. This is the room where the "operating system knows who's flying it" promise is tested hardest, and it fails first.

2. **MAJOR — Owner's own working session is invisible to itself.** Room: Mission Control, owner altitude, post-work. *"Today so far — Quiet — nothing logged yet today"* sits directly above a correctly-populated *"Today's priorities"* list driven by the very client work Dana just did. The system demonstrably has the data; it simply doesn't attribute the owner's labor to her own day.

3. **MAJOR — KAI's voice leaks raw internal-logic strings.** Rooms: Elena's and Terrence's Mission Control. Verbatim, twice: *"Rule: no reports on file yet."* Reads like an exposed conditional-engine label, not natural narration — breaks the illusion that KAI is one fluent intelligence rather than a rules engine with debug logging left on.

4. **MAJOR — Billing copy contradicts the customer's own plan.** Room: Billing. Verbatim: *"No billing history yet. Upgrade to Professional to get started"* — shown to an Agency-tier ($399/mo, top-tier) customer, telling her to upgrade to a lower tier.

5. **POLISH — "Brief" ejects the operator from the OS shell.** Room: Brief, reached from the primary left nav while authenticated. Full sidebar/KAI/app-chrome disappears, replaced by the public marketing header with *"Sign in / Get started"* — while the session is still live.

## 4. TOP 3 DELIGHTS

1. **The Agency room itself.** *"Whitfield Credit Group"* + live roster tiles + *"Clients 2 / 15"* + KAI's *"Agency Briefing — I checked every follow-up clock. 2 of 2 clients need attention: 2 awaiting a first letter"* — grounded in the actual FCRA ~30-day clock, not generic CRM language. The single best piece of evidence the product understands the agency-owner's job.

2. **Airtight, consistently-signaled on-behalf-of context.** The *"Working in [Client]'s workspace / Exit to agency"* banner plus KAI's re-greeting appeared correctly on every room tested, and Terrence's workspace showed zero trace of Elena's data after a full upload→analyze→letter cycle in hers. For a liability-sensitive product, this is exactly right and never wavered.

3. **The generated letter itself.** A fully-formed, FDCPA §809(b)-cited debt-validation letter, correctly voiced as Elena's own correspondence, preceded by KAI's plain-English strategy reasoning and followed by a precise "generated ≠ mailed, the clock starts on receipt" distinction.

## 5. WEB-PAGE-VS-OS VERDICT

Feels like ONE operating environment: the core loop — Agency roster → open a client's workspace → upload → analyze → generate a letter → exit → roster reflects it — is genuinely stateful and narratively coherent throughout, carried by the persistent workspace banner and KAI's consistent voice.

Feels like a conventional web page/dashboard at specific, namable spots: the Mission Control landing screen (generic SaaS "welcome back" card, indistinguishable by role); Settings' plain address-form; Billing's tier-blind empty-state copy; the Brief room's hard cut to the logged-out marketing template; and the "Rule: no reports on file yet." string, which briefly shows the rules-engine machinery behind the KAI curtain.

## 6. FINAL ANSWER

**QUALIFIED YES.** Once Dana finds and enters the Agency → client-workspace loop, CreditVector earns the "Credit Operating System" claim convincingly — roster awareness, on-behalf-of clarity, and legally-literate letter generation all land. But the illusion breaks in two concrete, first-impression-relevant places: (1) Mission Control, the actual front door, gives no sign on login that this is agency software at all; and (2) the owner's own "yesterday/today" ledger stays permanently quiet even directly beneath a correctly-populated client action queue. A paying agency owner would run client cases here and likely trust the letters — but would open a support ticket, or raise it in a sales demo, asking why the home screen doesn't know she runs an agency.
