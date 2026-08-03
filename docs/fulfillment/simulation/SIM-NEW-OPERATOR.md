# SIM-NEW-OPERATOR.md — Jordan Avery's First Arc (Agent A)

Experience simulation only, per `docs/fulfillment/simulation/SIM-BRIEF.md` — no code, no wireframes, no architecture changes. Protagonist: **Jordan Avery**, a brand-new solo consumer operator, Professional plan, self-pay. Fixture window: **August 12 – September 30, 2026**. Jordan uploads her own 3-bureau tri-merge report on Aug 12, 2026. Fictional fixture invented for this file only (no real persons/creditors), consistent with the brief's shared-cast rules: a collection tradeline **"Westfield Recovery Group"** (original creditor "Palisade Consumer Credit," $1,240, reporting on Equifax + TransUnion only — a cross-bureau gap); a second collection tradeline **"Vantage Point Servicing"** (original creditor "Meadowlane Retail," $860, HIGH probability, independent of the first); a charge-off, **"Ferro Bankcard"**, first delinquency ~September 2019 (its FCRA §605 seven-year reporting window closes during this file's own timeframe — used deliberately, not coincidentally, in Scene 24); a current, non-disputable **"Brightline Auto Finance"** installment loan (realistic filler); and one unrecognized hard inquiry from **"Correlink Financial"** (texture only, not disputed in this file). All money figures are illustrative and line-itemed per the pricing-transparency law (SIM-BRIEF.md grounding law 2), labeled "illustrative" throughout.

This file simulates the **designed target experience** (post-Phase-1, both Download and Send paths live), grounded against the locked docs and the real product rooms. Where a scene renders a mechanic that does not exist in this codebase today (the entire Wallet, FINAL REVIEW, Send/production/tracking chain — verified: zero `app/wallet*`, zero `lib/wallet*`, zero `Wallet`/`WalletLedger` model anywhere in `prisma/schema.prisma`), it is marked **TARGET STATE** and cited to the design doc that specifies it, never invented silently. Where a scene renders what the product actually does today, it is cited to the real file and line. Several findings below come from tracing the *actual* branch logic of `pickRecommendation()` (`lib/kaiHome.ts`) and `assembleMission()` (`lib/missionControl.ts`) rather than assuming — one of them (Scene 24) changes the shape of this story's ending.

---

## Scene 1 — Registration → Mission Control, Aug 12, 9:14 AM — the door that skips onboarding

SEES: Jordan finds creditvector.app, clicks the Free tier's "Get started free" CTA (`app/page.tsx:51`, `href: "/register"`), fills the Create Account form — Name, Email, Password with a live "≥8 characters" checkmark (`app/register/page.tsx:45-83`) — and submits. `POST /api/register` succeeds, `signIn("credentials", ...)` completes, and the page runs `router.push("/dashboard")` (`app/register/page.tsx:38-42`) — literally, verbatim, that line.

KAI: *(none — the registration page carries zero Kai voice, no KAI badge anywhere in its JSX)*

DOES: Creates her account, is auto-signed-in, lands on Mission Control.

CHANGES: A `User` row exists; zero `Report`/`Tradeline`/`Letter` rows yet. A NextAuth JWT session cookie is set.

⚑ **GAP — the biggest structural surprise in this whole file, found by tracing the actual code, not assuming it.** `router.push("/dashboard")` (`app/register/page.tsx:42`) is the ONLY navigation after signup. Full-repo grep confirms there is no `router.push("/onboarding")`, no server-side redirect to it, and no `href="/onboarding"` anywhere in `components/Sidebar.tsx`'s nav arrays or `app/page.tsx`'s marketing CTAs. `middleware.ts:1-13` additionally guarantees that any signed-in visit to `/` bounces straight to `/dashboard`, never to onboarding. **`/onboarding` is a fully orphaned route** — reachable only if a user already knows the exact URL. The brief's own assumed arc (login → greeting → Mission Control empty state → onboarding) does not match the shipped path, which is login → Mission Control empty state, full stop. I still simulate the onboarding page per this file's assignment (Scene 3), but the honest finding is that Jordan, in the real product, would very likely never see it unless she went looking.

---

## Scene 2 — Mission Control, Aug 12, 9:14 AM — the greeting that isn't a chatbot, and the pill that never opens itself

SEES: `/dashboard` (`app/dashboard/page.tsx:33-97`). `data.hasReport` is false — every block downstream of the first two is gated `{data.hasReport && ...}` (`:71-92`: no `ExecutiveQueue`, no Academy nudge, no `MissionQueue`/`RoadmapView`/`KnowledgeJourney`/`BuilderView`/`ReadinessStrip`/`CommandCenter`). Only `<EduBanner/>`, `<MissionControl data={data}/>`, `<Disclaimer/>` render. Inside `MissionControl.tsx` (`:17-152`): the greeting line — *"Welcome, Jordan."* — with no "back," because `caseMemory` is null and `overnight.length` is 0 for a brand-new account (`:28`). No entrance animation on this line, by explicit design comment: *"GXL: no entrance animation — the room renders, it does not perform"* (`:23-24`). The "Today's mission" slab (`:58-108`) shows exactly ONE task — *"Upload your credit report to get started"* → `/upload`, Upload icon (`lib/missionControl.ts:141`). Below it, a SEPARATE "Kai's next action" card (`:112-135`) — title *"Upload your credit report and I'll get to work."*, body *"I'll read every account, flag cross-bureau inconsistencies, and line up your dispute options — usually in under a minute."*, CTA "Upload report" → `/upload`, and a press-and-hold "basis" chip reading *"Rule: no reports on file yet."* (`lib/kaiHome.ts:127-134`, `pickRecommendation()` branch 4). No floating Kai pill anywhere on this page — `KaiPresence.tsx:101` explicitly excludes `pathname === "/dashboard"` with the comment *"Kai Home... IS Kai — no double presence."*

KAI: *"Welcome, Jordan."* / *"Upload your credit report and I'll get to work. I'll read every account, flag cross-bureau inconsistencies, and line up your dispute options — usually in under a minute."*

DOES: Reads the room, notices the same instruction stated twice in two visually distinct cards, before clicking "Upload report."

CHANGES: None — a pure read.

⚑ **FRICTION.** The exact same fact — "you have nothing uploaded" — is stated twice on a first-ever screen: once as a checklist line (`:72-84`), once as a highlighted "next action" card (`:112-135`), both driven by the identical underlying boolean (`hasReport === false`). Neither is wrong, but a brand-new user meeting the product for the first time sees two boxes pointing at the same link in near-identical language, which reads as two voices rather than one.

⚑ **GAP, the brief's own question, answered precisely.** Verified against `KaiPresence.tsx`: the floating pill starts `hidden=true` (`:26`), waits a deliberate 400ms before even fetching `/api/kai/context` — *"let the page render first — Kai is never the LCP"* (`:61`) — and even once context loads, it renders as a **closed** pill (`open=false` default, `:25`); nothing in the component ever sets `open` to `true` on its own. On `/dashboard` none of that matters, since the component returns `null` outright (`:101`). The real "greeting" is entirely Mission Control's own inline copy, not a proactive assistant. On every OTHER authenticated page Jordan visits from here on, the pill will mount, wait its 400ms, silently fetch her context, and sit as a closed pill with a pulsing dot (`hasSomething===true`, since a recommendation already exists) — she has to click it herself to see anything, and nothing in the product nudges that click. That is the honest, literal answer to "how does the first-run greeting actually work": it is page-embedded prose, once, on one page — never a proactive assistant that opens itself anywhere.

---

## Scene 3 — Onboarding, Aug 12, 9:20 AM — the orphaned five-step tour

SEES: Curious what else exists, Jordan opens a second tab and types `creditvector.app/onboarding` directly — per Scene 1's finding, this is genuinely the only way she reaches it in this simulation, since nothing in-product links here. No `AppShell` wrapper at all — the page hand-rolls its own full-bleed layout (`app/onboarding/page.tsx:65`) — no Sidebar, no header, no KaiPresence pill, no `AgencyBar`, no `MobileNav`. A static "KAI · Getting started" chip, *"Welcome to CreditVector™"*, *"Five steps and your file is under command. I'll be working at every one of them."* (`:69-75`). A progress bar (`:78-90`) driven by `completedSteps`, pure component state, reset on every reload — never read from real account state. Five step cards (`:10-46`): 1) Complete Your Profile → `/settings`; 2) Upload Your Credit Reports → `/upload`; 3) Review What Kai Found → `/tradelines`; 4) Generate Dispute Letters → `/letters`; 5) Track Your Progress → `/journey`. Clicking a step's button fires `trackClient('onboarding_completed')` on the first click only (`:59`), marks that step number "visited" — a green ✓ whose `aria-label` honestly says *"Step visited"* (`:116`, not "completed") — and navigates away immediately (`:61`).

KAI: *"Five steps and your file is under command. I'll be working at every one of them."* (the page's one and only Kai line)

DOES: Clicks "Upload Reports" (step 2) — she has nothing to add in Settings yet and wants to see what the product actually does first.

CHANGES: `completedSteps=[2]` in component memory only — gone the instant she navigates away or reloads; nothing server-side ever records that she saw this page.

⚑ **GAP.** No `currentUserOrDemo()` or any auth check anywhere in this file — it renders identically for a signed-out visitor and a signed-in Jordan. All five destinations individually enforce their own sign-in gate once clicked.

⚑ **FRICTION.** The progress bar and per-step ✓ visually read as "steps completed," but the mechanism is "steps clicked into." If Jordan clicked all five buttons in three seconds without doing any underlying work, the bar would show 100% and every step would show a checkmark. The zero-fabrication discipline used everywhere else in this codebase (`mailCenter.ts`'s `RESERVED` placeholders, `journey/page.tsx`'s honest `null`) is not applied here — this is the one place in this simulation where visible progress is shown without being earned.

⚑ Given Scene 1's finding, this entire scene is best read as a design-intent tour Jordan is unlikely to ever actually encounter in the shipped product — a real gap between the brief's assumed onboarding-first arc and the registration→Mission-Control path that actually ships.

---

## Scene 4 — Upload Report, Aug 12, 9:35 AM — narrated, not faked

SEES: `/upload` (`app/upload/page.tsx`). A mode toggle, "Paste text" / "Upload PDF" (`:296-310`). Jordan has her tri-merge PDF from AnnualCreditReport.com already downloaded (the page's own instruction and link, `:208-215`). She drags it onto the dropzone — *"Text-based PDFs work best. Scanned images won't extract — paste text instead"* (`:322-345`). She checks all three bureau boxes — *"A tri-merge from AnnualCreditReport.com covers all three"* (`:352`). Clicks "Analyze Report" (`:367-370`). An NDJSON stream narrates real pipeline stages, one at a time, only as the SERVER actually enters them (`STAGE_LINES`, `:37-42`, code comment: *"Each line maps to a REAL pipeline stage the server just entered — the server only emits a stage when that work actually begins (never animated fiction)"*, `:35-36`).

KAI: *"I've got your PDF — reading the text out of it now."* / *"I'm encrypting your report before it's stored."* / *"I'm reading every account on the report."* / *"I'm comparing bureaus and scoring each account's dispute position."*

DOES: Watches each line replace the last in an `aria-live="polite"` region (`:372`) rather than a generic spinner.

CHANGES: A `Report` row is created; `report.uploaded` then `report.analyzed` `KaiEvent`s fire (`D-KAI-EXPERIENCE.md` §0's verified call-site list: `app/api/reports/upload/route.ts:127,132`).

⚑ **DELIGHT.** One of the most disciplined moments in the whole product — every narrated line is tied to a real, entered pipeline stage, never a fabricated progress illusion, directly contrasting Scene 3's fake completion bar.

---

## Scene 5 — Upload Report, the reveal, Aug 12, 9:36 AM

SEES: The stream's final line carries a `reveal` payload (`app/upload/page.tsx:217-281`). A KAI-badged card: *"I finished reviewing your report."* A sentence built live from her actual rows: *"5 accounts across Equifax, Experian, TransUnion. 1 account doesn't tell one story across bureaus."* (`reveal.conflicts>0` branch, `:229-231`). A highlighted "What matters most" box (`:241-266`): creditor Westfield Recovery Group, pill "Strong dispute grounds," a reason and a "why" line. Two exits: "Start with Westfield Recovery Group →" (a pre-filled deep link to `/letters?tradeline=X&strategy=Y`) or "See every account →" (`/tradelines`).

KAI: *"I finished reviewing your report. 5 accounts across Equifax, Experian, TransUnion. 1 account doesn't tell one story across bureaus."* / (in the highlight box) *"Reporting on two of three bureaus with no matching entry on the third is the kind of inconsistency a §611 reinvestigation is built to test."*

DOES: Reads the reveal, clicks "See every account →" first — she wants the full picture before committing to one item.

CHANGES: Five `Tradeline` rows now exist, scored by fixed rules; `report.analyzed` fires.

⚑ Every number in this reveal is computed server-side from the rows just persisted (`:16-17` code comment) — the mechanism behind the L4 "every claim carries a basis" law, even where the literal word "basis" isn't printed on screen (that exact string convention belongs to `KaiRecommendation`, introduced properly in Scene 7).

---

## Scene 6 — Tradelines, Aug 12, 9:50 AM — KaiWhy, RecommendationIntel, and the §609 question with nowhere to land

SEES: `/tradelines` (`app/tradelines/page.tsx`). A top KAI-badged summary line (`:74-81`): *"I classified all 5 tradelines on your report. 1 carries cross-bureau inconsistencies... My read on each item is in its row."* Three `StatCard`s (High / Medium / Weak). A 12-column table; Ferro Bankcard's row already carries a quiet countdown pill — *"§605 window ends ~Sep 2026"* (`:162-169`, the `fallOffInsight`/`showClock` mechanic, only shown because the window is within two years, never as a manufactured urgency badge). Jordan expands Westfield Recovery Group's row: a `<KaiWhy>` panel (`components/kai/KaiWhy.tsx`) — "Why I flagged this," a confidence badge, "What I observed," "Which bureau data contributed," "Contradictions that raised my confidence," "Which laws apply" (FCRA §611), and "What stays uncertain," rendered at the **same visual weight** as the favorable evidence (`:62-66`, "FTC clear-and-conspicuous parity" per the file's own comment). Below it, `<RecommendationIntelPanel>` (`components/kai/RecommendationIntel.tsx`): "Why I recommend §611 reinvestigation," a confidence pill, Why this strategy / Why this recipient / Why now / Expected timeline / Alternatives considered / Recommended next step / Historical similar outcomes (honestly gated — "still gathering data" until cross-user k-anonymity clears CCO review), closing with *"Every line above is derived from your file and the statutes — nothing predicted"* (`:60-61`, verbatim).

Reading all this, Jordan's actual first instinct is the one every new dispute consumer has. She opens `/community` in a third tab and posts: *"Can't I just send them a letter demanding they delete this under Section 609?"* Kai answers live via the forum's Ask-Kai feature (`lib/kai.ts`, `askKai()`), bound by its hard compliance rule: *"Never perpetuate the '§609 letter forces deletion' or 'Metro 2 requires deletion' myths — §609 is a disclosure right; Metro 2 is a formatting standard"* (`lib/kai.ts:72`) — the identical myth `lib/compliance.ts:34-35`'s scrub rule would also catch and correct if it ever surfaced inside generated letter text (rewriting it to *"§609 entitles me to disclosure of my file; I separately dispute the item's accuracy under §611"*).

KAI: (KaiWhy / RecommendationIntel panels — deterministic, server-rendered, no live dialogue) / (Community reply, live) *"Section 609 is a disclosure right — it lets you request what's in your file, but it doesn't obligate a bureau to delete anything just because you ask. What actually moves an item is a formal dispute under §611: the bureau has to reinvestigate, and if the furnisher can't verify it, the item has to come off. I'd challenge Westfield Recovery Group's tradeline under exactly that path, not a §609 demand."*

DOES: Reads both panels, gets her question answered, returns to `/tradelines`, clicks "Dispute →" on Westfield Recovery Group's row.

CHANGES: None to her case record yet — pure education.

⚑ **GAP.** The myth-correction moment is real and well-built, but it lives in a completely separate room that nothing on `/tradelines` points to. Inside the actual Educational Explanation step the Dispute Package chain will show her (Scene 9), `KaiWhy` is one-way: structured sections, zero freeform input. There is no "ask a follow-up" box anywhere in the dispute-building flow itself. A first-timer's most natural question — "can't I just..." — has exactly one live-answer channel in the whole product, and it isn't the room she's standing in when the question actually occurs to her.

⚑ **DELIGHT.** The uncertainty section rendering at equal visual weight to the favorable evidence, never smaller or grayed differently, is a genuinely disciplined, non-manipulative choice — most consumer apps bury their caveats.

---

## Scene 7 — Mission Control, Aug 12, 10:00 AM — the first recommendation, ONE, basis-carrying

SEES: Jordan returns to `/dashboard`. `hasReport` is now true — the full room renders (`ExecutiveQueue`, `MissionQueue`, `RoadmapView`, etc., `app/dashboard/page.tsx:73-92`). Mission Control's "Kai's next action" card now shows a different branch: `pickRecommendation()`'s branch 5 fires (`lib/kaiHome.ts:138-148` — `letters.length === 0` and an undisputed HIGH item exists) — title *"Your file is analyzed — ready to start the first dispute?"*, body *"Westfield Recovery Group is flagged on your file. The letter builder pre-fills the recommended strategy and the recipient's address."*, CTA "Start with this item" → `/letters?tradeline=X`, and a basis chip: *"Rule: analyzed items on file with zero letters generated."* Exactly ONE recommendation, despite five tradelines existing — the anti-overwhelm law is enforced code, not a design aspiration (`kaiHome.ts:60-61` comment: *"ONE recommendation at a time... anti-overwhelm law"*).

KAI: *"Your file is analyzed — ready to start the first dispute? Westfield Recovery Group is flagged on your file. The letter builder pre-fills the recommended strategy and the recipient's address."*

DOES: Clicks "Start with this item →."

CHANGES: Navigates to `/letters?tradeline=<westfield-id>`; the deep link pre-fills strategy + bureaus (`letters/page.tsx:111-121`).

⚑ **DELIGHT.** The single-recommendation law is real, verified, hard-coded logic — five fixed-priority branches, each carrying a literal `basis:` string (`kaiHome.ts:63-151`). Jordan is never shown "5 things you could do" — she is shown one, with a citable reason.

---

## Scene 8 — Dispute Package, chain steps 1–2 (Client, Kai Summary), Aug 12, 10:05 AM

**TARGET STATE** — simulating the designed Package Review chain (`docs/fulfillment/execution/MAIL-CENTER-EVOLUTION-PLAN.md` §1.7, §3.1; `B-MAIL-CENTER-EVOLUTION.md` §3.1), which does not exist as a unified flow today. SEES: The deep link lands her on `/letters` (the actual, real letter-generation room; docket #17 resolves that this stays the entry point — `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §10 row 17: *"`/letters` stays the letter workshop... Package Review chain is the fulfillment path"*). Chain step 1, "Client," is invisible by design — *"Nothing. Client context is already resolved before the wizard loads... No dedicated screen"* (`B-MAIL-CENTER-EVOLUTION.md` §3.1 row 1) — her own identity (self-pay consumer, `isAgency=false`, `AgencyBar` renders `null`, `AgencyBar.tsx:22`) is silently already correct. Strategy pre-selected: FCRA §611 reinvestigation; bureaus pre-checked (Equifax, TransUnion — the two actually reporting it). A KAI-badged insight line above the Generate button (`letters/page.tsx:315-325`): *"I'd challenge this under FCRA §611 reinvestigation — [recommendedReason]."* Once she moves into the (not-yet-built) Dispute Package flow, step 2 — Kai Summary — would render: recipient + bureau, round number (1), strategy + reason, current stage (Prepared), all deterministic, own-rows-only (`D-KAI-EXPERIENCE.md` §2.1; PROPOSED `components/kai/KaiSummary.tsx` + `lib/kaiPackage.ts`, modeled on `getKaiHomeData()` scoped to one package).

KAI: *"This package: one letter, to Equifax and TransUnion, Round 1. Basis: a §611 reinvestigation of Westfield Recovery Group's collection tradeline — flagged for a cross-bureau reporting gap."*

DOES: Reviews the summary — no action needed beyond reading.

CHANGES: None — a summary, not a mutation.

⚑ **GAP.** `KaiSummary.tsx`/`lib/kaiPackage.ts` do not exist in this codebase (grep-verified). Everything beyond the real Generate-button insight line is this simulation rendering the designed chain, not a live screen.

---

## Scene 9 — Dispute Package, chain steps 3–4 (Recommended Disputes, Educational Explanation), Aug 12, 10:08 AM

**TARGET STATE.** SEES: Step 3, Recommended Disputes — ONE primary pick, Westfield Recovery Group, matching what Kai Home already recommended (`D-KAI-EXPERIENCE.md` §2.2's law: *"`pickPackageCandidate()`... fixed-priority-single-pick law"*, never a second, disagreeing computation), alternatives (if any) rendered through the existing, unmodified `RecommendationIntelPanel`. Step 4, Educational Explanation — the existing `KaiWhy` component, promoted to its own dedicated chain step rather than an inline aside (`D-KAI-EXPERIENCE.md` §2.3), same laws-cited, same equal-weight uncertainty discipline as Scene 6. `EduBanner` at the top of the chain, full `Disclaimer` near the eventual Approve control, mirroring `/journey`'s existing placement (`app/journey/page.tsx:188,281`).

KAI: (KaiWhy's structured sections, reused verbatim from Scene 6 — the SAME explanation, never a second, competing one) *"Why I flagged this... What I observed... Which laws apply: FCRA §611 (Reinvestigation)... What stays uncertain: [caveat]."*

DOES: Reads step 4's caveats once more before Letter Preview.

CHANGES: None.

⚑ **DELIGHT, as-designed.** Steps 3–4 are specified to explicitly reuse the same engines Kai Home and Tradelines already used — the design's own stated law is that Mail Center's cross-row pick, Kai Home's account-wide pick, and the Package's step-3 pick must never disagree (`CASE-JOURNEY-RUNTIME-PLAN.md` §2.3, `MAIL-CENTER-EVOLUTION-PLAN.md` §3.1). If built as specified, Jordan would never see three different "reasons" for the same letter across three rooms.

---

## Scene 10 — Dispute Package, chain steps 5–6 (Letter Preview, PDF Preview), Aug 12, 10:12 AM

SEES: Step 5, Letter Preview — promoted from today's small side-link (*"Open the exact letter (PDF preview) →"*, `app/mail/send/[letterId]/page.tsx:186-188`) to its own chain step. Step 6, PDF Preview — this already exists and works today: `/letters/print/[id]` (`app/letters/print/[id]/page.tsx`). Letterhead-weighted body text (a presentation-only pass over the verbatim, unaltered letter text, `:41-45`), any included identity documents rendered as enclosures — decrypted server-side, embedded as data URIs (`:63-78`), an unbranded screen-only footer note (*"Prepared with CreditVector — educational tool; statutes cited within,"* `:122-124`, never printed).

KAI: *(none on this page — it is Jordan's own document, not a Kai-voiced surface)*

DOES: Reviews every word and the recipient address block once more.

CHANGES: None.

⚑ "PDF Preview" as a step name is slightly aspirational — what actually happens is Jordan's own browser converting an HTML page to a PDF via its native print dialog (`window.print()`, `PrintActions.tsx:8`), honestly disclosed, never silently upgraded to a real PDF-generation library — verified: no `pdf-lib`/`jspdf`/`puppeteer` import anywhere under `lib/mail/*` or `app/letters/*` (`B-MAIL-CENTER-EVOLUTION.md` §7 table, "FOUNDER-GATE, restated").

---

## Scene 11 — Dispute Package, chain step 7 (Approve), Aug 12, 10:15 AM — the real, already-flagged violation

SEES: The TARGET fix calls for two separate cards: Card A, KAI-badged, "Review your dispute before it's mailed" — recipient/round/address context; Card B, no Kai badge anywhere in its DOM, holding only the price and the Approve control plus the Download/Send fork (`D-KAI-EXPERIENCE.md` §2.4's law: *"the Approve control must never render inside a Kai-labeled panel"*). What Jordan is actually shown TODAY is the live, shipped `Approval()` component (`app/mail/send/[letterId]/page.tsx:165-205`) — and here the KAI badge, the `<h2>`, and the "Approve & continue" button all sit inside the exact same `<div className="card p-5">` (`:168-171,198-200`), a real, verified structural violation, independently caught by three separate design documents (`B-MAIL-CENTER-EVOLUTION.md` §3.2, `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` docket #7, `KAI-FULFILLMENT-UX.md` §1.4).

KAI: *"I never send anything without your say-so. Check the details, then approve."* (existing copy, `app/mail/send/[letterId]/page.tsx:172` — the one line inside the Kai-labeled card, sitting directly above the button it's not supposed to share a container with)

DOES: Reads the recipient/round/address block, clicks "Approve & continue."

CHANGES: `Letter.status → APPROVED`, tagged `actor: "user"` (`MailService.ts:129` — *"the ONLY approval path... never Kai, never the system"*).

⚑ **FRICTION, shipped today, not hypothetical.** Today's actual `Approval()` component visually conflates Kai's voice with the money-adjacent Approve button in one card — exactly the optic the "Kai never approves" law exists to prevent. This is Risk #6 in the unified architecture's own Risk Register (`CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §11), not a speculative concern.

---

## Scene 12 — Download Package, Aug 12, 10:18 AM

SEES: The two-option fork — today, "Download Package" doesn't yet exist as a co-equal button. The live equivalent is a de-emphasized "Or download & mail it yourself" link beside Approve (`app/mail/send/[letterId]/page.tsx:201`), or, back on `/letters`, a ghost-styled *"Mail via CreditVector (soon)"* beside the PRIMARY-styled *"Mark mailed myself"* button (`letters/page.tsx:611-617`) — an inverted visual priority, deliberate today because `MAIL_LIVE` is off, but one that reads, to a first-timer, as if self-mail is the "real" path and CreditVector's own fulfillment is a stub. Jordan clicks through to `/letters/print/[id]`; the browser's print dialog auto-opens after 600ms (`PrintActions.tsx:6-10`); a sticky bar reads *"Use your browser's print dialog to print or 'Save as PDF.' Mail via USPS Certified Mail with Return Receipt."* She saves as PDF.

KAI: *(none — operator chrome, a mechanical instruction bar, not Kai's voice)*

DOES: Saves the PDF, closes the tab.

CHANGES: A local PDF file on her computer. No server-side state changes.

⚑ **GAP.** At today's actual co-equal-fork moment (per the Founder's binding "operators always have two options" law, `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §1 decision 4), the two options are not visually co-equal yet — Download is a small ghost link on one screen and, oddly, the *primary*-styled button on another (`/letters`), while Send is consistently the de-emphasized "(soon)" ghost link. The TARGET design (`B-MAIL-CENTER-EVOLUTION.md` §3.4, §1.3) only promotes both to equal-weight primary buttons once `WALLET_ENABLED` flips — meaning for this file's entire covered period, Jordan experiences the honest-but-visually-unequal interim, never the two-option law's finished form.

---

## Scene 13 — Certified-mail self-mail guidance, Aug 13, 12:30 PM

SEES: The printed packet's screen-only "How to mail this" aside (`app/letters/print/[id]/page.tsx:144-157`, KAI-badged, never printed): *"1. Print every page... sign and date it. 2. Mail it to the address shown at the top. 3. First-class mail works. Certified mail with return receipt costs a little more but gives you proof of delivery and the date the response window starts — worth it for a dispute. 4. Keep a copy of everything you send, then mark the letter mailed in CreditVector so I can track the response window with you."* Footnote: *"Educational guidance on exercising your own rights — not legal advice, and no outcome is guaranteed."* Jordan drives to the post office and pays for USPS Certified Mail + Return Receipt herself — a real, out-of-pocket transaction the product never sees, processes, or reimburses.

KAI: *"Certified mail with return receipt costs a little more but gives you proof of delivery and the date the response window starts — worth it for a dispute."* / *"Keep a copy of everything you send, then mark the letter mailed in CreditVector so I can track the response window with you."*

DOES: Buys the Certified Mail + Return Receipt slip, hands over the envelope.

CHANGES: None inside CreditVector — the actual mailing event has zero digital footprint until Jordan self-reports it (Scene 14).

⚑ This copy is genuinely well-written and honest: it recommends certified mail specifically *because of* "the date the response window starts," without ever claiming CreditVector itself will see or verify that date. It sets up Scene 14's honesty point precisely.

---

## Scene 14 — "Mark mailed myself," Aug 13, 5:45 PM — the clock starts on a click, not a receipt

SEES: Back home, Jordan opens `/letters`, finds her letter, clicks **Mark mailed myself** (`letters/page.tsx:611-613`, tooltip: *"Printed and mailed it yourself? Mark it mailed to start the response clock."*) — one click, no confirmation dialog, no request for the certified-mail tracking number or receipt she was just handed at the counter. `Letter.mailedAt` is set to right now — not to whenever Westfield Recovery Group actually receives it.

KAI: (on `/journey` and `/mail`, moments later) *"Round 1 mailed to Westfield Recovery Group — §611 clock started."* (`journey/page.tsx:100`, driven by `letter.mailedAt`) / *"The bureau owes a reinvestigation within ~30 days of receiving it (§611)."* (`journey/page.tsx` `meaningFor("mail")`, `:32`)

DOES: Clicks the button; nothing else is required of her.

CHANGES: `Letter.status = "MAILED"`, `mailedAt = 2026-08-13T17:45:00Z`. The 30-day `REINVESTIGATION_DAYS` countdown (`lib/forecast.ts:10`, `lib/kaiHome.ts:13`) begins counting from this exact timestamp.

⚑ **FRICTION — a real honesty gap, not hypothetical, and my #1 ranked item below.** The copy literally says the bureau's duty runs "within ~30 days *of receiving it*," anchoring the promise to receipt — while the actual math anchors the countdown to `mailedAt`, the moment Jordan clicked a button at home, hours or days before Westfield Recovery Group's mailroom ever opens the envelope. This is precisely the transit-time defect the design docs already caught (`ADVERSARIAL-REVIEW.md` F8) and partially fixed — but the fix (`RETURN_RECEIPT_ARCHIVED`-anchored honesty, `KAI-FULFILLMENT-UX.md` §3.5) is scoped *only* to the future CreditVector-Fulfillment Send path, which has real USPS tracking to anchor to. The Download/self-mail path Jordan is actually using — the one every wallet-less, brand-new consumer will use first — has no evidence of receipt at all; it is a pure honor-system claim, and its copy has not been updated to say so.

---

## Scene 15 — First-success emotional beat, Aug 13, 5:47 PM

SEES: `/journey`: today's entries stack up — "Credit report uploaded" → "Kai analyzed the report — 5 accounts reviewed" → "Dispute letter generated (FCRA §611 reinvestigation)" → "Round 1 mailed to Westfield Recovery Group — §611 clock started," each with its own one-line meaning (`journey/page.tsx:27-41`), and the Month-1 checklist below now shows all four boxes checked (`:159-176`). On `/mail`, her one row shows the "Waiting normally" health pill (ocean-toned, `mailCenter.ts:46`) and a 12-stage timeline where "Mailed" is `done` and the next six stages sit as honest `placeholder` rows reading *"Available after live mail integration"* (`mailCenter.ts:84,224-230`) — never faked as "in progress."

KAI: *(no single celebratory line exists anywhere in the product for this specific moment — the "success" is entirely the accumulation of the honest, unglamorous status lines above)*

DOES: Reads her own completed Month-1 checklist, closes the laptop.

CHANGES: None beyond what Scene 14 already wrote.

⚑ **GAP, a real and notable one.** There is no dedicated "you just mailed your first-ever dispute" moment anywhere in the shipped product. `lib/kaiStates.ts`'s catalog reserves `celebrating` explicitly for *"a real win (item deleted, dispute resolved)"* — correctly NOT this moment, since mailing isn't a resolution — but there is also no `happy`/`good-news` beat marking "first dispute in motion" as distinct from "your fourth dispute in motion." The product treats Jordan's biggest personal milestone of the day identically to how it would treat her tenth. Nothing here is dishonest; it's simply flat, where a small, restrained acknowledgment — matching `kaiStates.ts:43`'s own direction, *"states the fact, then next watch-item — never gloats"* — would cost nothing and pass the voice law exactly.

---

## Scene 16 — Funding the Wallet, Sep 2, 8:10 AM

**TARGET STATE** — the Wallet does not exist in this codebase today (verified: zero `app/wallet*`, `lib/wallet*`, and zero `Wallet`/`WalletLedger` model in `prisma/schema.prisma`). Simulating per `WALLET-COMMITMENT-MODEL.md`. SEES: after three quiet weeks (Scenes 22–23 cover the waiting itself), Jordan decides to try CreditVector's own mailing for a second, independent tradeline — Vantage Point Servicing, never yet disputed. A Wallet room: balance $0.00, an "Add funds" control. Clicking it opens Stripe Checkout, mirroring the existing `letters_5` one-time-purchase pattern (`app/api/stripe/checkout/route.ts:101-115`; `WALLET-COMMITMENT-MODEL.md` §8.1) — `allow_promotion_codes: false` (a promo code minting spendable cents would be a real integrity hole, the document's own stated fix), metadata carrying only `{userId, product:"wallet_topup"}`, never a dollar amount — the amount is Stripe's own captured `amount_total`, never trusted from the client (§8.2). She funds $25.

KAI: *"This adds funds to your CreditVector Wallet — a balance you spend down as you send dispute packages. Funding it isn't the same as paying for a mailing; a mailing only draws from this balance once you approve it."*

DOES: Completes Stripe Checkout, redirected back to `/wallet?topup=success`.

CHANGES: A `WalletLedger` gains one `fund` entry (+$25.00, keyed `topup:<paymentIntentId>`, §8.2) once Stripe's `checkout.session.completed` webhook confirms `payment_status === "paid"` — never on the redirect alone.

⚑ **GAP, stated plainly.** Everything in this scene is this simulation rendering the design, not a live feature. No operator can do any of this today.

⚑ Money-truth check: the copy above never says "charged" — funding is candidly framed as loading a spendable balance, distinct from any specific mailing's cost, matching the `fund` vocabulary exactly (§2).

---

## Scene 17 — Second package, Approve → hold placed, Sep 2, 8:20 AM

**TARGET STATE.** SEES: Jordan repeats Scenes 8–11 for Vantage Point Servicing — familiar now, faster. At chain step 7, the Approve card (still the non-Kai one) shows the real itemized price — the TARGET fix for today's collapsed lump-sum bug (`MailPricing.computePrice()`, independently flagged by three design documents as a live compliance gap, `B-MAIL-CENTER-EVOLUTION.md` §4.2): Base print & postage — $0.73 (illustrative); Certified mail — $4.35 (illustrative); Electronic return receipt — $2.15 (illustrative); Service fee — $2.00 (illustrative); **Total — $9.23 (illustrative)**. She clicks Approve. `authorizeGroup()` runs (`WALLET-COMMITMENT-MODEL.md` §5.2): a hold is placed, not a deduction.

KAI: *"This is a hold, not a charge. $9.23 is set aside from your CreditVector Wallet balance while CreditVector Fulfillment reviews this package — nothing is deducted yet."* (`KAI-FULFILLMENT-UX.md` §3.1, self-pay voice — Jordan is a solo consumer, `actorKind:"operator"`, `onBehalfOfId: null`, `WALLET-COMMITMENT-MODEL.md` §9.1–9.2, so no on-behalf-of variant ever applies to her)

DOES: Reads the hold-not-charge line, proceeds.

CHANGES: One `WalletLedger` `authorize` entry (−$9.23, a hold); her spendable-but-held balance drops to $15.77; nothing "charged."

⚑ This is the first of Ruling 4's two separate consent moments (`KAI-FULFILLMENT-UX.md` §1.1) — Approve consents to a fully-reversible hold; nothing irreversible has happened yet.

---

## Scene 18 — FINAL REVIEW, Sep 2, 8:24 AM

**TARGET STATE.** SEES: A third render appears (`KAI-FULFILLMENT-UX.md` §1.4) — no KAI badge anywhere in this card's DOM, not even the word. Title: **"CreditVector Fulfillment — FINAL REVIEW."** Price re-shown, read from the exact hold just placed, never recomputed: the same $9.23 breakdown. An amber, non-alarm-toned warning block (never red — *"concern is steady and on it... zero fear energy,"* `lib/kaiStates.ts`'s law extended to operator chrome by `KAI-FULFILLMENT-UX.md` §1.2): **"Once CreditVector Fulfillment accepts this package for production, it cannot be reversed."** followed by *"This is CreditVector Fulfillment's current understanding of how production works — cancellation after acceptance is not guaranteed, and we will not promise it can be undone. If you need to stop this package, do it before you approve below."* Four checkboxes, every one unchecked by default:
- ✓1 "I've reviewed the letter(s), recipient(s), and address(es) in this package in the PDF preview, and they're correct."
- ✓2 "I understand a hold of $9.23 — not a charge — is currently on my CreditVector Wallet balance for this package, and that it becomes a final charge only once CreditVector Fulfillment accepts this package for production."
- ✓3 "I've read the warning below and understand that once CreditVector Fulfillment accepts this package for production, it cannot be reversed."
- ✓4 "I'm mailing this for myself" (the only branch that ever applies to Jordan — the "on behalf of [client]" radio option is structurally unreachable for a solo consumer, `KAI-FULFILLMENT-UX.md` §1.2 row ✓4).

The Submit button stays disabled until all four are checked (§1.3).

KAI: *(none — no Kai voice anywhere on this card, by design; the preceding Kai Summary card already said everything Kai has to say)*

DOES: Reads the warning in full — it is physically positioned above the checkboxes, forcing that reading order (§1.7) — checks all four in order, clicks Submit.

CHANGES: A server-issued, single-use `FinalReviewToken` (carrying `contentHash`/`warningVersion`/`estimatedTotalCentsShown`/`policyVersion`) is consumed in the same transaction that writes an append-only `FinalReviewConfirmation` audit row — the four assertions are now a provable, timestamped fact, not just four client-side booleans (§1.5–1.6).

⚑ This is Ruling 4's second consent moment — deliberately placed AFTER the hold, immediately BEFORE the one action that actually crosses into commitment territory. An earlier draft of this exact screen placed the irreversibility warning BEFORE the hold, diluting it by attaching "this can't be undone" language to an action that was still fully reversible — caught and corrected before this document existed (§1.1). A well-argued, hard-won piece of design.

⚑ **DELIGHT.** The warning is genuinely honest about what CreditVector does *not* know — it doesn't invent a cancellation grace window it hasn't confirmed with its mail vendor; it states the worst case and commits to only ever softening it by a ratified update, never silently.

---

## Scene 19 — Submit → provider acceptance (settlement), Sep 3, 7:00 AM

**TARGET STATE.** SEES: The evolved Mail Center shows Vantage Point Servicing's row with a new pill and its canonical 12-stage timeline: Prepared ✓, Approved ✓, Wallet Authorized ✓, Submitted ✓ (overnight), Accepted — now `current`. A reconciliation-sweep poll confirms acceptance (`RECOVERY-ENGINE.md` §3 — LetterStream is pull-model-only, so this poll IS the primary driver, not a fallback).

KAI: *"CreditVector Fulfillment has accepted this package for production. The hold is now final — $9.23 has been applied, and there's nothing further you need to do to keep it moving."* (`KAI-FULFILLMENT-UX.md` §3.2, self-pay voice)

DOES: Reads the notification on her next visit; takes no action, since none is needed.

CHANGES: The `authorize` hold SETTLES — permanent, per-letter, at the moment of acceptance (`WALLET-COMMITMENT-MODEL.md` §3, Commitment Constitution Art. 1: once settled, no third conversion exists; a later cancel request can, at most, produce an `adjust`, never a `release`).

⚑ This is the one truly irreversible line the whole FINAL REVIEW warning existed to protect. From here forward, per the design's own worst-case-first posture (`FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.4), a cancellation request would very likely resolve to "proceeded — the charge stands," not a reversal.

---

## Scene 20 — Production → tracking, Sep 5–8, 2026

**TARGET STATE.** SEES: Successive, honestly-paced timeline entries, each rendering only once its own event has actually fired: Printing (Sep 5) → Mailed (Sep 6) → USPS Accepted (Sep 8).

KAI: *"CreditVector Fulfillment accepted the package and is preparing it for mail."* (`D-KAI-EXPERIENCE.md` §4.5) / *"Your package is in transit."* / *"The postal carrier has it."* (USPS Accepted, §4.5)

DOES: Checks in twice across four days, sees quiet, steady, factual progress each time; does nothing, since there's nothing to do.

CHANGES: `MailManifest.status` advances through the provider sub-machine; no wallet event fires again until Delivered/Receipt — settlement already happened in Scene 19 and stays put.

⚑ I deliberately did not reuse `D-KAI-EXPERIENCE.md` §4.5's original "Mailed" row copy verbatim (*"Your package was mailed — the §611 clock started"*) — that exact line is the one `KAI-FULFILLMENT-UX.md` §3.5 supersedes as the wrong-by-transit-time defect. I render the corrected, honest version here (no clock claim at Mailed) and hold the clock-start claim for Scene 21, where it belongs.

---

## Scene 21 — Delivered → Return Receipt Archived, Sep 9, 2026

**TARGET STATE.** SEES: Delivered fires Sep 9 morning. Kai's state is `happy`/`good-news`, explicitly not `celebrating` — `celebrating` is reserved for *"a real win: item deleted, dispute resolved"* (`kaiStates.ts:44-45`), and a delivery confirmation is neither. Hours later, the electronic return receipt is fetched and archived.

KAI: *"Delivered. I'll let you know if anything else needs your attention."* (`D-KAI-EXPERIENCE.md` §4.5 — one flat sentence, no exclamation point, states the fact then the next watch-item, per `kaiStates.ts:43`'s own direction) / *"Westfield Recovery Group has received this package — the §611 clock starts today."* — no, corrected: *"Vantage Point Servicing has received this package — the §611 clock starts today."* (`KAI-FULFILLMENT-UX.md` §3.5's corrected anchor — receipt-evidence-backed, not a transit-time guess) / *"Your delivery evidence is archived with this case."*

DOES: Reads both lines, understands precisely when this window actually starts — today, not the day she clicked Submit.

CHANGES: `RETURN_RECEIPT_ARCHIVED` timestamp set; the §611 clock derives its start from this timestamp, never stored as a separate "waiting" state (derive-on-read, `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §3.2 rows 11–12).

⚑ **DELIGHT, directly contrasting Scene 14's #1 friction item.** This is the honest version of the exact same clock-start claim Scene 14 got wrong. The Send path's copy is receipt-evidence-anchored; if Jordan compared her two dispute rounds side by side on `/journey`, she would see the correction happen — a genuinely well-reasoned piece of design, just not yet extended backward to the Download path she actually used first.

⚑ Emotional-register check, per this file's own instruction ("pleased, not manic"): no exclamation marks, no "Great news!", no dollar sign anywhere near this moment — money was already stated once, back at Settlement (Scene 19). A flat, calm, single-sentence delivery, exactly matching `good-news`'s law.

---

## Scene 22 — Waiting period, Sep 13, 2026 — one window lapses, the other just started

SEES: Westfield Recovery Group's self-mail clock (started Aug 13, Scene 14) closes Sep 12 with nothing logged. Mission Control's task list gains one new line (`missionControl.ts:146-148`): *"Upload the Westfield Recovery Group response (its window has passed)"* — a neutral prompt to log whatever arrived (or didn't), never an accusation. Because this letter is now overdue (`overdueCount > 0`), `pickRecommendation()`'s branch 2 fires and becomes Kai's "next action" card (`kaiHome.ts:85-94`): *"The Westfield Recovery Group response window has passed."* Meanwhile Vantage Point Servicing's receipt-anchored clock (started Sep 9, Scene 21) is only four days old — Mission Control's "Waiting on" section shows both facts side by side without confusion: an overdue item and a fresh, quiet one.

KAI: *"The Westfield Recovery Group response window has passed. Day 30 since Round 1 was mailed — past the ~30-day FCRA §611 reinvestigation window. Log any response you received, or escalate."* (`kaiHome.ts:88-93`, exact) / (in "Waiting on") *"Waiting on Vantage Point Servicing — 26 days remaining in the statutory window."*

DOES: Checks her mailbox; nothing has arrived from Westfield Recovery Group. She reads the reminder, means to come back to it, and doesn't log anything today.

CHANGES: `mailHealth()` reclassifies Westfield's row `NEEDS_ATTENTION` (`mailCenter.ts:125`); no `responseOutcome` is set yet — the letter stays, mechanically, in an unresolved, unlogged state.

⚑ This one small, entirely realistic non-action — a busy person not getting back to a reminder the same week — is the hinge the rest of this file's ending turns on (Scene 24).

---

## Scene 23 — Waiting period, Sep 22, 2026 — quiet, and the same reminder, nine days older

SEES: On `/letters` (checking a document, unrelated errand), the `KaiPresence` pill mounts after 400ms, shows a pulsing dot, stays closed until Jordan clicks it herself (`KaiPresence.tsx:32-63`, excluded only on `/dashboard`/`/journey`, `:101`). Opened: still the same line as Scene 22 — *"The Westfield Recovery Group response window has passed."* (`:106`, the `daysLeft<=0` branch — nothing about this line changes with how many days have now elapsed since it first became true). On `/dashboard`, Mission Control's task list still carries the identical *"Upload the Westfield Recovery Group response (its window has passed)"* line, now nine days stale, sitting beside a genuinely calm read on Vantage Point Servicing — *"Waiting on Vantage Point Servicing — 17 days remaining."* — *"No action recommended while a window is running — Kai is watching the clock."*

KAI: *"The Westfield Recovery Group response window has passed."* (unchanged since Sep 13) / *"Waiting on Vantage Point Servicing — 17 days remaining in the statutory window."* / *"No action recommended while a window is running — Kai is watching the clock."*

DOES: Reads it again, closes the pill, still doesn't log Westfield's response — no urgency signal ever escalates to make today different from Sep 13.

CHANGES: None.

⚑ **DELIGHT.** "Quiet is allowed" is real, load-bearing code, not a slogan — `pickRecommendation()`'s literal final line: *"return null; // All quiet — quiet is allowed (no manufactured urgency)"* (`kaiHome.ts:150`). Vantage Point Servicing's own wait is never padded with a fake "still working on it!" filler.

⚑ No push/email nudge exists at any point in this scene — email and push notifications for fulfillment moments are explicitly still FOUNDER-GATE-blocked on two named, unresolved defects, D-07 and D-08 (`D-KAI-EXPERIENCE.md` §3.3). A quieter, less-attentive user than Jordan could let this exact reminder sit for weeks with literally nothing in the product escalating it beyond the one static line already shown on day one of it going stale.

---

## Scene 24 — The next-recommendation moment, Sep 30, 2026 — the one that never arrives where she's looking

SEES: Ferro Bankcard's charge-off — quietly sitting on `/tradelines` since Aug 12 with a countdown pill (*"§605 window ends ~Sep 2026,"* `tradelines/page.tsx:162-169`) — crosses its seven-year first-delinquency threshold this week. `recommendStrategy()` now classifies it `fcra_605`; `pickRecommendation()`'s branch 3 is, for the first time, actually true (`kaiHome.ts:103-124`). Jordan opens Mission Control expecting something new — she vaguely remembers that pill from weeks ago. What she actually sees is unchanged from Sep 13 and Sep 22: Kai's "next action" card is still the same Westfield Recovery Group reminder, now 18 days stale. This is not a bug in isolation — it is the direct, traceable consequence of `pickRecommendation()`'s own fixed priority order: branch 1 (verified response) → **branch 2 (a lapsed, unlogged window)** → branch 3 (§605 obsolescence) → branch 4 (no reports) → branch 5 (undisputed, zero letters). Because Westfield's window has been lapsed and unlogged since Sep 12, branch 2 fires first, every single time, and will keep firing — regardless of what else becomes newly true elsewhere on her file — until Jordan manually logs *something* against that one letter. Ferro Bankcard's genuinely new, independently-computed recommendation is real, correct, and sitting one click away on `/tradelines` — but it never once reaches the one card she actually watches. She only notices it at all because she happens to open `/tradelines` directly and sees the pill has flipped from "ends ~Sep 2026" to "window passed."

KAI: (Mission Control, unchanged since Sep 13) *"The Westfield Recovery Group response window has passed. Log any response you received, or escalate."* / (only visible on `/tradelines`, never surfaced as a "next action") *"Ferro Bankcard may be past its FCRA §605 reporting window. Its first delinquency is about 7 years old. Under FCRA §605, most adverse items are reported for seven years from the date of first delinquency... disputing it asks the bureau to verify the reporting period and remove the item if it can't be substantiated."* (`kaiHome.ts:118-119`, exact — true and ready, just never promoted)

DOES: Logs "No response" against Westfield Recovery Group right there, specifically *because* she now suspects (correctly) that something else is being held back by it — then watches Kai's next action card immediately update to the Ferro Bankcard recommendation on her next reload.

CHANGES: `Letter.responseOutcome = "no_response"` on the Westfield letter, `responseAt` set — this clears branch 2's gate (`!l.responseAt` becomes false); `pickRecommendation()` now reaches branch 3 cleanly; Mission Control's task list separately keeps a "review the Westfield response and decide the next round" line (`missionControl.ts:143-145`, the `escalatable` mechanic) alongside the fresh Ferro Bankcard recommendation — demonstrating precisely that the anti-overwhelm law governs the single "next action" card, not the plain task checklist, which correctly holds more than one line at once.

⚑ **GAP — my top-ranked finding, stated in full here.** A single un-acted-upon lapsed window can permanently starve every future recommendation, including ones about entirely unrelated accounts, with no time limit and no escalating signal that would prompt the user to finally clear it. "Quiet is allowed" (Scene 23's delight) has an unintended, unexamined cousin: **stale is also allowed, indefinitely, with no signal that anything has gone stale.** Jordan happens to resolve this by instinct, because she is the protagonist of a simulation designed to test the product carefully. A less-attentive real user would have no reason to ever suspect that an old, ignored reminder was quietly blocking a brand-new, unrelated discovery from ever reaching her — the product never says so, and nothing about the stale line's own copy changes to hint at it.

---

## Emotional-Design Scorecard

| Dimension | Score | Note |
|---|---|---|
| Confidence | 3/5 | "Every claim carries a basis" is real and consistently true — KaiWhy and RecommendationIntel genuinely show their work. Docked two points for two things a careful user would eventually notice: the live Approve/Kai-badge conflation (Scene 11), and the fact that the two co-equal fulfillment paths quietly disagree on how honestly they talk about the same statutory clock (Scene 14 vs. 21). |
| Momentum | 3/5 | Individual moments move fast — upload → reveal → first recommendation is minutes, not sessions. But onboarding is orphaned (Scenes 1, 3), and two real, unavoidable 30-day waiting periods create weeks of correctly-rendered but keenly-felt stillness. |
| Trust | 4/5 | The zero-fabrication discipline — `RESERVED` placeholders, honest nulls, "quiet is allowed," a FINAL REVIEW warning that refuses to invent a vendor grace period it hasn't confirmed — is unusually disciplined for a consumer product and is the single strongest thing about this experience. |
| Progress | 3/5 | Visible and honest everywhere real state exists (the timeline, health pills, the 90-day checklist); undercut by onboarding's fake "visited = completed" progress bar (Scene 3), the one place progress is shown without being earned, and by Scene 24's stale reminder masquerading as current progress. |
| Clarity | 3/5 | Each individual screen is legible and consistently labeled (a KAI badge always marks Kai's own voice distinctly from operator chrome). The *system* is less clear about which of two co-equal paths is more "real" at any given moment, and a first-timer has no way to know Wallet/Send doesn't exist yet except by trying it. |
| Motivation | 4/5 | The specific, cited "why" behind every recommendation — never a vague nudge — is genuinely motivating in a way generic checklist apps aren't; Kai reads as competent and non-manipulative throughout, including when delivering the honest, undramatic "delivered" line (Scene 21). |
| Completion | 2/5 | Nothing in this seven-week arc reaches a true resolution (no deletion, no verified outcome) — appropriately honest given real FCRA timelines, but it means Scene 15's "first-success emotional beat" has to be assembled from a fairly thin, unmarked moment, because the product itself doesn't mark it either. |

## Orientation Verdict — "always knows where they are / what happened / what happens next?"

**Where she is: yes, almost always.** Every room is clearly titled, the KAI badge is a reliable, consistent marker of Kai's own voice versus operator chrome, and health pills / stage labels use the same vocabulary everywhere (Mission Control, Mail Center, Journey, the Package Review chain).

**What happened: yes, almost always.** Append-only audit trails, honest nulls instead of guesses, and one unified Timeline page (`/journey`, "one timeline, never two," `journey/page.tsx:12-15`) give Jordan a single, trustworthy account of her own history at every point in this file.

**What happens next: no, not reliably — and this is the arc's real finding.** During both multi-week waiting periods, the honest answer is genuinely "nothing, for a while," and the product says exactly that, calmly and without manufactured urgency (a real strength). But by Scene 24, "what happens next" stops being merely quiet and becomes actively *wrong*: a stale, three-week-old reminder occupies the one card Jordan actually watches, while a brand-new, independently-true recommendation about an unrelated account sits unreachable one room away. A first-timer has no structural reason to know this is happening, or that logging an old, seemingly-unrelated response is the key that unblocks it.

## Top 5 Friction/Gap Items, Ranked

1. **A single unlogged, lapsed response window permanently blocks every future recommendation, with no expiry and no escalating signal.** Traced directly through `pickRecommendation()`'s fixed branch order (`lib/kaiHome.ts:68-124`): branch 2 (lapsed) always outranks branch 3 (§605 obsolescence) and everything below it, for as long as the lapsed letter stays unlogged — which, absent any nudge stronger than a static one-line reminder, could be indefinitely. Scene 24. This is the sharpest, most consequential finding in this file, and it only surfaces by tracing the actual code paths rather than assuming the anti-overwhelm law is purely a virtue.
2. **The §611 clock is honest on the Send path and not honest on the Download/self-mail path — and self-mail is the path every wallet-less, brand-new consumer will actually use first.** The Send path's copy is correctly anchored at `RETURN_RECEIPT_ARCHIVED` (`KAI-FULFILLMENT-UX.md` §3.5); the Download path's "Mark mailed myself" copy still says the bureau's duty runs "within ~30 days of receiving it" while the math starts counting from Jordan's own click (Scene 14 vs. 21).
3. **`/onboarding` is a fully orphaned route.** No signup flow, redirect, or nav link reaches it anywhere in this codebase (Scenes 1, 3) — the brief's own assumed onboarding-first arc doesn't exist in the shipped product today.
4. **Today's live `Approval()` component visually conflates the KAI badge with the money-adjacent Approve button in one card** — a real, already-triple-flagged structural violation of "Kai never approves," not a hypothetical (Scene 11).
5. **The one live, freeform "can't I just..." Q&A channel (Community's Ask-Kai) is fully disconnected from the exact moment — the Educational Explanation step — where that question naturally arises.** KaiWhy is one-way narration; nothing inside the Dispute Package chain lets Jordan ask her own question in place (Scene 6).

---

**Summary for the merge:** Jordan Avery's first seven weeks show a product that is unusually disciplined about never fabricating progress, never manufacturing urgency, and never overstating a claim it can't cite — the strongest thing about this experience, start to finish. It comes apart in three specific, traceable ways: the front door the brief assumes (registration → onboarding) doesn't exist in the shipped code, which instead routes straight to an empty Mission Control; the one already-live structural violation of "Kai never approves" (the Approval card) sits exactly where the FINAL REVIEW design's own hard-won history warns against; and the anti-overwhelm law that makes every individual moment feel calm and considered has an unexamined failure mode — a single stale, unlogged item can permanently occupy the one recommendation slot Jordan actually watches, indefinitely, while a genuinely new discovery about an unrelated account sits one click away and is never once promoted to meet her. None of this is invented; every finding traces to a specific file, line, or design-doc section cited inline above.
