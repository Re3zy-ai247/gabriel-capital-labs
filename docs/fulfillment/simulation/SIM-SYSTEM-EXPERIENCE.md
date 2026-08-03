# SIM-SYSTEM-EXPERIENCE.md — Agent E, System Experience Simulation

Phase -0 Founder Operator Journey Simulation · Simulation only — no code, no wireframes, no architecture changes. Governed entirely by `docs/fulfillment/simulation/SIM-BRIEF.md` (grounding law, Kai voice law, shared cast, scene format). This document is the **connective-tissue** evaluation: it does not re-simulate any single persona's onboarding (Agent A), a working Tuesday's task list (Agent B), one case's node-by-node life (Agent C), or an owner's oversight (Agent D) — it walks the **ring itself**, scores every room the ring visits against the Room Constitution, and inspects every seam between rooms.

**Walker:** Marcus Webb, staff operator at Meridian Credit Advisors, using the shared cast fixture. **Session:** Tuesday, September 1, 2026, late morning, inside Elena Ruiz's case (already 6 days into Round 1's mailed-and-waiting window). **Method:** every scene cites the doc/§ or file:line grounding its mechanics; where the locked docs are silent on something a scene needs, the scene renders a best-guess of the *designed target experience* and is marked `⚑ GAP:` inline, per the Brief's grounding law. Money is illustrative and line-itemed per the pricing-transparency law; the wallet in this document is **Meridian's agency wallet** — Marcus never spends his own money, and every wallet-facing line uses **on-behalf-of voice** (`KAI-FULFILLMENT-UX.md` §2.2) because he is acting inside Elena's workspace.

**One identity fact this simulation renders honestly, once, up front:** `WALLET-COMMITMENT-MODEL.md` §9.2 names a real, unresolved gap — *"'agency staff' as a role distinct from 'agency owner' is not a modeled identity concept anywhere in the current schema... there is no multi-seat/staff-user model live today... this table's 'agency staff' row is necessarily identical to its 'agency owner' row."* There is no Marcus Webb login. This simulation renders Marcus using Meridian's one shared agency credential (Danielle's), because that is the only account the design actually supports today — not invented, not smoothed over. `⚑ GAP` noted here once; every scene below that would otherwise ask "which of them is signed in" inherits this note rather than repeating it.

---

## PART 1 — The Room Ring as ONE Session

### 1.0 The ring as specified vs. the ring as it actually exists

The Brief's ring: *Mission Control → Client (Elena's workspace) → Dispute Package → Mail Center → Timeline → Wallet → [Marketplace] → Agency → back to Mission Control.* Two topology facts, discovered by trying to actually walk it, are load-bearing for everything below and are stated once here rather than re-discovered in every scene:

1. **There is no direct door from Mission Control to "Client."** Opening a managed client's workspace has exactly one mechanism in the shipped product: `POST /api/agency/select` from the roster on `/agency` (`app/agency/page.tsx:207-221`, `openClient()`), which sets the `WORKSPACE_COOKIE` and redirects to `/dashboard`. The ring's own imagined edge Mission Control→Client is therefore, in the real link graph, **Mission Control→Agency→Client** — Agency is a mandatory gateway the ring visits twice in one real session (once as a pass-through to reach Elena, once later as its own destination). This is reported as a topology finding, not smoothed into the narrative.
2. **"Client (Elena's workspace)" is not a room.** It is every other room (Mission Control, Tradelines, Letters, Mail Center, Journey) rendered a second time with `user.id` resolved to Elena instead of to Meridian, via `currentUser()`'s workspace-cookie resolution (`lib/session.ts`, cited verbatim in `B-MAIL-CENTER-EVOLUTION.md` §5). The only visible signal that a re-scope happened is `AgencyBar` — a single gold strip (`components/AgencyBar.tsx:34-44`). This is the single most consequential fact this simulation surfaces about identity in the ring, and it recurs at every transition below.
3. **"Wallet" is not a room either.** No doc in the source set assigns the Fulfillment Wallet a dedicated page/route. `WALLET-COMMITMENT-MODEL.md` and `KAI-FULFILLMENT-UX.md` design the wallet's balance/posture to surface *inline* — a Wallet Authorization screen embedded in the Dispute Package chain (chain step 8), a deficit pill in `KaiPresence` or a Mail Center row (`KAI-FULFILLMENT-UX.md` §3.4), never a destination of its own. The ring's own listing of "Wallet" as a stop is itself evidence the simulation is designed to test whether operators *expect* a destination that was never designed to be one — rendered honestly at Scene 15.

---

### Scene 1 — Mission Control (agency altitude, no workspace open)

```
[Scene 1 — Mission Control · Journey pre-node (account home) · Tue Sep 1, 2026, 10:58am]
SEES: /dashboard loads inside AppShell (components/AppShell.tsx:10-32 — Sidebar, header, ImpersonationBanner,
AnnouncementBanner, AgencyBar, main, KaiPresence, MobileNav). AgencyBar renders nothing (AgencyBar.tsx:22,
"if (!client) return null" — no client workspace is open). Sidebar shows "Mission Control" active
(Sidebar.tsx:16, NAV[0]). The room renders MissionControl (app/dashboard/page.tsx:70, unconditional) — "Welcome
back, Danielle." (MissionControl.tsx:28, firstName resolves to the one shared agency login's own name, not
Marcus's) — then "Today's mission: Everything's on track. No action needed today." (MissionControl.tsx:66-70,
the onTrack branch, since tasks.length === 0). data.hasReport is false for the AGENCY'S OWN account (Meridian,
as a business, has never uploaded its own credit report), so every other section on the page is entirely
ABSENT, not empty — ExecutiveQueue, MissionQueue, RoadmapView, KnowledgeJourney, BuilderView, ReadinessStrip,
CommandCenter all sit behind `{data.hasReport && ...}` (app/dashboard/page.tsx:73-92) and never render. The
GXL ambient field (components/gxl/GxlField.tsx) mounts against fieldState computed from execution.buckets
(app/dashboard/page.tsx:57-62) — for zero rows, total/awaiting/active are all 0, so the lattice is nearly
still.
KAI: "Welcome back, Danielle."
DOES: Marcus recognizes the greeting is addressed to an individual's own dispute case, and that Meridian's
14-client desk lives nowhere on this screen. He does not linger.
CHANGES: nothing — a read-only landing, no state written.
⚑ FRICTION (high): the room the ring places FIRST, and that the Sidebar labels the account's literal home
(Sidebar.tsx:16), has no agency-altitude view at all. Every one of the six Room-Constitution presentations
that would answer "what should I do across 14 clients today" is either absent or answering the wrong
question — the aggregate answer exists, but it lives at /agency (Scene 16), not here.
⚑ GAP: the identity fact from §1.0/header applies at first contact here — "Danielle" is who the room greets,
regardless of which of Meridian's two humans is actually at the keyboard.
```

**Room Constitution scorecard — Mission Control, agency altitude, no workspace open**

| Presentation | Present? | Honest? | Load-bearing? |
|---|---|---|---|
| Current work | Absent (`hasReport` gate) | N/A | No |
| Current state | Present only as "Watch kept — on track" | Technically true (zero rows *are* on track), misleading in context (there is no watch to keep) | No |
| Recommended action | Absent | N/A | No |
| Kai guidance | One static greeting line only | Yes | No |
| Evidence | Absent | N/A | No |
| Timeline | Absent | N/A | No |

**"What should I do next?"** — Not answered. Not even acknowledged that the question has a different shape at agency altitude. **Operational workspace or dashboard/webpage?** Webpage. *Layout:* identical to a brand-new individual consumer's empty state — no adaptation for "I manage 14 people." *State carriage:* none to carry; the room holds no notion that an agency roster exists. *Action proximity:* zero actions rendered — the nearest real action (triage the roster) is a full room away.

---

### ⇢ Transition 1 — Mission Control → Agency (pass-through) → Client (Elena's workspace)

```
[Transition 1 — Mission Control → Agency (pass-through) → Client · Tue Sep 1, 10:59am]
SEES: Marcus clicks Sidebar "Agency" (Sidebar.tsx:32). /agency loads client-side (app/agency/page.tsx),
fetches /api/agency/context, /api/agency/clients, /api/agency/kpi. The Kai Agency Briefing aggregate renders
("I checked every follow-up clock. 3 of 14 clients need attention: 2 past the 30-day response window, 1
awaiting a first letter." — app/agency/page.tsx:356-361) — the FIRST real answer to "what should I do today"
this session has produced. Marcus scans the roster (kaiSort=true, priority ladder: needsAttention → no
letters yet → everyone else, app/agency/page.tsx:247-250), finds Elena's row (not flagged — she is inside her
window), and clicks "Open workspace" (openClient(), :207-221).
DOES: POST /api/agency/select sets the workspace cookie; router.push("/dashboard") + router.refresh().
CHANGES: server-side identity resolution flips — every subsequent server component's currentUser() now
resolves to Elena's User row, not Meridian's, until Marcus explicitly exits (lib/session.ts, cited
B-MAIL-CENTER-EVOLUTION.md §5).
⚑ SEAM (the load-bearing one): what carries across this transition is exactly one HTTP round-trip and a
cookie — no client name, no case summary, no "here's what you'll find" travels with it. The operator's
mental context (Elena, Northline Round 1, waiting since Aug 26) is NOT carried by the product at all; it is
carried entirely in Marcus's own head, reconstructed from the roster row he just glanced at. This is the
first place the illusion of "one OS" is tested and only partially holds: the mechanism (an identity swap
inside one shell, no full-page reload of a different app) is genuinely OS-like; the PRESENTATION (a full
route change to the exact same /dashboard URL, no visual transition, no acknowledgment that a different
case is about to load) is web-page-like. Nothing marks the moment of departure or arrival.
```

---

### Scene 2 — Client / Elena's workspace (Mission Control, re-scoped)

```
[Scene 2 — Client (Elena Ruiz's workspace) · Journey node: Case / pre-Kai-Analysis · Tue Sep 1, 11:00am]
SEES: The identical /dashboard route, now resolving to Elena's rows. AgencyBar renders: "Working in Elena
Ruiz's workspace" + "Exit to agency" (AgencyBar.tsx:34-44) — the ONE visual signal a re-scope occurred.
data.hasReport is true (Elena uploaded Aug 18). MissionControl renders "Welcome back, Elena." (still — the
greeting is written in the CLIENT's first person, spoken to whoever is looking at the screen, which is
Marcus, not Elena; Elena never logs in — B-MAIL-CENTER-EVOLUTION.md §5, "clients don't log in," confirmed
verbatim in app/agency/page.tsx:597, "Clients don't log in — you manage everything in their workspace.")
"Today's mission" now lists real tasks; ExecutiveQueue (components/mission/ExecutiveQueue.tsx) renders "Do
this first" / "Highest-impact unlock" / "If you do nothing" tiles (HeadTile, :38-44) sourced from
assembleExecution() over Elena's real rows. The GXL provenance-pull affordance ([data-gxl-claim] spans,
GxlPull.tsx) is live on every evidence field — press-and-hold draws a thread to a stamped exhibit.
KAI: "Welcome back, Elena." — followed, inside the Executive Queue's "Do this first" tile: "Meridian Bank
Card — $3,205 charge-off, re-aging indicators. Recommended: dispute directly with the furnisher under §623."
DOES: Marcus reads the Executive Queue, confirms this matches what he remembers from the roster flag, and
opens the recommended item.
CHANGES: nothing written yet — read-only, but now correctly scoped.
⚑ DELIGHT: the room itself did not change one line of code between Scenes 1 and 2 — the SAME component tree,
the SAME "six presentations" machinery, simply had real data this time. That is a genuinely strong piece of
architecture: one room, one Constitution, honored identically regardless of whose case is loaded.
⚑ FRICTION: the greeting's grammatical person is a real, if small, honesty question the docs do not appear
to have settled — "Welcome back, Elena" is technically correct (it is Elena's account) but is heard, in
practice, only by Marcus, an agency staffer who has never met "Elena" logging in. Nothing in Kai's copy
here marks that an agency operator, not the named person, is the audience — unlike KAI-FULFILLMENT-UX.md's
carefully engineered on-behalf-of voice for MONEY facts (§2.2), the everyday greeting/narration register has
no on-behalf-of variant at all. Worth a light note in Part 3; not severity-ranked as high as the money-voice
gap, since no money or legal fact is misstated here — only address, not content.
```

**Room Constitution scorecard — Mission Control, Elena's workspace**

| Presentation | Present? | Honest? | Load-bearing? |
|---|---|---|---|
| Current work | Present (Today's mission list) | Yes | Yes |
| Current state | Present ("on track" vs. task list) | Yes | Yes |
| Recommended action | Present, singular ("Do this first" tile, `pickRecommendation()`'s anti-overwhelm law, `lib/kaiHome.ts:60-67`) | Yes, cites a `basis` | Yes |
| Kai guidance | Present, woven through the queue | Yes | Yes |
| Evidence | Present via GXL provenance-pull | Yes, real record fields on `data-gxl-*` attributes | Yes |
| Timeline | Absent from THIS room specifically (Timeline is `/journey`'s job) — but the Executive Queue's `it.timeline`/`it.evidence` fields carry a compressed version | Partial | Partial |

**"What should I do next?"** — Yes, cleanly, once real data exists. **Operational workspace or dashboard/webpage?** Operational workspace. *Layout:* verdict-column typography (`gxl.verdict`), not card-grid decoration; three quiet answers, not three shouting widgets. *State carriage:* every tile is a citation of a deterministic engine, never invented. *Action proximity:* the recommended action's link sits one click from its own explanation — genuinely close.

---

### ⇢ Transition 2 — Client (Mission Control) → Dispute Package

```
[Transition 2 — Mission Control (Elena) → Dispute Package chain · 11:01am]
SEES: Marcus clicks the Executive Queue's "Do this first" link. Per the target design (B-MAIL-CENTER-
EVOLUTION.md §3.1 row 1: "Client... Nothing. Client context is already resolved before the wizard loads. No
dedicated screen."), there is no intervening "confirm which client" screen — the workspace cookie already
resolved Elena, so the Package Review chain opens directly scoped to her.
DOES: navigates to the (target, renamed) app/mail/send/[packageId]/page.tsx — today's equivalent is
app/mail/send/[letterId]/page.tsx (B-MAIL-CENTER-EVOLUTION.md §7 file-evolution table).
CHANGES: a new (target) DisputePackage composition begins for the Meridian Bank Card item.
⚑ SEAM: this is the ring's cleanest transition. Nothing needs to carry because nothing needs to be re-asked
— client identity persists through the cookie, and the chain's own first step is deliberately a no-op
screen. This is the one seam in the whole ring where "one OS, not web pages" fully holds: no re-orientation
tax at all.
```

---

### Scene 3 — Dispute Package: Kai Summary + Recommended Disputes

```
[Scene 3 — Dispute Package · Journey node: Kai Analysis → Dispute Package · chain steps 1–3 · 11:02am]
SEES: (target) components/kai/KaiSummary.tsx (PROPOSED, D-KAI-EXPERIENCE.md §2.1) renders a package-scoped
digest: recipient (Meridian Bank Card's furnisher address, parsed from Elena's report), round number (1),
strategy + reason, current stage (Prepared). Below it, chain step 3 — Recommended Disputes — via the
existing, unmodified RecommendationIntelPanel (components/kai/RecommendationIntel.tsx:23-65): "Why I
recommend Direct Furnisher Dispute" / "Why this recipient" / "Why now" / "Expected timeline" / "Alternatives
considered" / "Historical similar outcomes" (honestly gated: "still gathering data" if k-anonymity isn't
met, lib/recommendationIntel.ts:122-136) / the closing line "Every line above is derived from your file and
the statutes — nothing predicted." (RecommendationIntel.tsx:60-61).
KAI: "I'd challenge this under a direct furnisher dispute — the account shows re-aging indicators, and under
§623 the furnisher has its own duty to investigate directly, separate from the bureau's §611 clock."
DOES: Marcus reads the panel, confirms the recommendation matches his own read of the file, continues.
CHANGES: nothing written — still composing.
⚑ DELIGHT: the "nothing predicted" closing line is a small thing that does a lot of trust work — every
recommendation panel in this product ends by naming its own epistemic limits, out loud, every time.
```

---

### Scene 4 — Dispute Package: Educational Explanation + Letter/PDF Preview

```
[Scene 4 — Dispute Package · chain steps 4–6 · 11:04am]
SEES: (target) chain step 4, the existing KaiWhy component reused verbatim (components/kai/KaiWhy.tsx) —
"What I observed" / "Which bureau data contributed" (n/a here, furnisher-direct) / "Contradictions that
raised my confidence" (re-aging indicator across two report pulls) / "Which laws apply" (§623, §1681s-2) /
"What stays uncertain" — rendered at the SAME visual weight as the favorable evidence (KaiWhy.tsx design
note; FTC clear-and-conspicuous parity, cited D-KAI-EXPERIENCE.md §2.3). Chain step 5 (Letter Preview):
today's side-link "Open the exact letter (PDF preview) →" (app/mail/send/[letterId]/page.tsx:186-188) is
promoted to an embedded step. Chain step 6 (PDF Preview): app/letters/print/[id]/page.tsx + PrintActions.tsx
— browser print-to-PDF (window.print(), PrintActions.tsx:8), disclosed, not silently upgraded to a real PDF
artifact (⚑ GAP, restated below).
KAI: (quiet through the preview steps — Kai already spoke in Scenes 3; the preview is the operator's own
verification moment, not a new claim.)
DOES: Marcus opens the PDF preview, reads the actual letter that will mail, closes it.
CHANGES: nothing written.
⚑ GAP (restated, not new): "PDF Preview" in the chain's own name promises a generated PDF artifact; the
mechanism underneath it is still browser print-to-PDF — no PDF library exists in the dependency tree
(B-MAIL-CENTER-EVOLUTION.md §3.1 row 6, verified: no pdf-lib/jspdf/puppeteer import anywhere in lib/mail/*
or app/letters/*). This is disclosed in the architecture, not hidden from the operator (the artifact IS what
prints), but the chain step's NAME oversells what's underneath it by one notch.
```

---

### Scene 5 — Dispute Package: Approve (the card split)

```
[Scene 5 — Dispute Package · chain step 7 · FulfillmentStage: pre-APPROVED · 11:06am]
SEES: the Approve render — a non-Kai card (KAI-FULFILLMENT-UX.md §1.4 render 2): itemized price breakdown
(reused from Payment()'s p.lines.map(...), app/mail/send/[letterId]/page.tsx:213-218), a single "Approve"
control, no KAI badge anywhere in its DOM. Above it, a SEPARATE Kai-labeled explanation card (render 1, still
carries the KAI badge) holds recipient/round/address/mail-class context — the SAME <dl> block that exists
today (:174-184), just structurally split out of the money card it currently shares (today's live violation:
Approval(), :165-205, opens with the KAI badge AND holds the Approve button in the same <div className="card
p-5">, verified verbatim by B-MAIL-CENTER-EVOLUTION.md §3.2).
  Price shown, illustrative:
    Base print & postage ............ $0.68
    Additional page (1) .............. $0.15
    Certified mail + return receipt .. $4.95
    CreditVector service fee ......... $2.00
    ─────────────────────────────────────────
    Total (illustrative) ............. $7.78
KAI: (silent inside this card, by design — Kai's explanation already happened in the card above it; D-KAI-
EXPERIENCE.md §2.4, "the Approve control must never render inside a Kai-labeled panel.")
DOES: Marcus reviews the line items, clicks Approve.
CHANGES: authorizeGroup() is called (target; WALLET-COMMITMENT-MODEL.md §5.2) — this is the FIRST consent
moment (KAI-FULFILLMENT-UX.md §1.1), not yet the point of no return.
⚑ DELIGHT: the certified-mail line renders as its OWN line, not collapsed — today's shipped code actually
COLLAPSES this into "Postage & printing" and shows "Certified mail: Available after live mail integration"
as a separate italic placeholder (app/mail/send/[letterId]/page.tsx:219-221) — a real, tri-confirmed
compliance gap (docket #8, CREDITVECTOR-FULFILLMENT-ENGINE-V1.md §9) this simulation renders as FIXED per
the Policy Engine's mandate that certified is a constant, never a computation. Marked here as the target
state, not today's state — the gap is real and is inherited into Part 3's inventory.
```

---

### Scene 6 — Dispute Package: Wallet Authorization

```
[Scene 6 — Dispute Package · chain step 8 · FulfillmentStage: WALLET_AUTHORIZED · 11:06am]
SEES: (target, entirely new UI surface — B-MAIL-CENTER-EVOLUTION.md §7 names it "genuinely new"; no
existing render to evolve from) a hold-confirmation screen: "This is a hold, not a charge. $7.78 is set
aside from your agency's CreditVector Wallet balance to cover this package while CreditVector Fulfillment
reviews it — nothing is deducted yet, and nothing is charged to you directly." (on-behalf-of voice, exact
copy KAI-FULFILLMENT-UX.md §3.1). No KAI badge (this is a money-fact re-statement, still non-Kai chrome by
the same law).
KAI: (silent — this screen's copy is operator-chrome per §1.4, not a new Kai claim.)
DOES: the hold is placed. Marcus does not yet see a running wallet balance anywhere on this screen — only
the amount just set aside.
CHANGES: authorizeGroup() succeeds; a WalletLedger authorize row exists (subjectId = mail_<letterId>,
attempt 1, actorId = Marcus's/Danielle's shared id, actorKind: "agency", onBehalfOfId = Elena's id —
WALLET-COMMITMENT-MODEL.md §5.2, §9.1).
⚑ GAP: nothing on this screen answers "how much is left in the agency wallet after this hold" — the exact
concrete screen contract for a running-balance display is not specified in any locked doc; §5.2's
`{ok:false, code:"insufficient_funds", availableCents, requiredCents, shortfallCents}` shape exists ONLY as
an error-path payload, never as an always-visible number. This simulation renders the honest absence rather
than inventing a balance widget no document designs.
```

**Room Constitution scorecard — Dispute Package chain (composite, steps 1–8, target state)**

| Presentation | Present? | Honest? | Load-bearing? |
|---|---|---|---|
| Current work | Present (the package itself, its stage) | Yes | Yes |
| Current state | Present (chain-step progress, `FulfillmentStage`) | Yes | Yes |
| Recommended action | Present (Recommended Disputes panel, single pick + `basis`) | Yes | Yes |
| Kai guidance | Present in 3 of 4 explanatory panels; deliberately absent in the 3 money-adjacent renders | Yes — the absence is the honest part | Yes |
| Evidence | Present (letter/PDF preview, content-hash proof-of-intent) | Yes | Yes |
| Timeline | Absent inside the chain itself (only resumability state, not a rendered history) | N/A | No — reasonable, since `/journey` owns this |

**"What should I do next?"** — Yes, at every step; the chain is linear and each screen names its one action. **Operational workspace or dashboard/webpage?** Operational workspace, with one caveat. *Layout:* the three-render split (Kai card / Approve card / FINAL REVIEW card, once built) is a genuine architectural discipline most SaaS wizards don't bother with. *State carriage:* resumability is server-status-derived (`load()`'s status→step map, generalizing cleanly, `KAI-FULFILLMENT-UX.md` §1.8) — real state, not a client-side wizard illusion. *Action proximity:* very close — but the wallet balance gap above is exactly the kind of missing action-proximity a genuine OS financial surface would not tolerate (an OS always shows you your balance near a spend decision; this chain shows you the hold amount, never the balance it's drawn against).

---

### Scene 7 — Dispute Package: FINAL REVIEW + Submit

```
[Scene 7 — Dispute Package · chain step 8→9 · FulfillmentStage: WALLET_AUTHORIZED → SUBMITTED · 11:07am]
SEES: (target) the FINAL REVIEW card (render 3, KAI-FULFILLMENT-UX.md §1.4) — title "CreditVector
Fulfillment — FINAL REVIEW," no KAI badge anywhere in its DOM. Price re-shown ($7.78, read from the FINAL
REVIEW token, never recomputed). The WARNING block: "Once CreditVector Fulfillment accepts this package for
production, it cannot be reversed. This is CreditVector Fulfillment's current understanding of how
production works — cancellation after acceptance is not guaranteed, and we will not promise it can be
undone. If you need to stop this package, do it before you approve below." (exact copy, §1.2). Four
unchecked checkboxes: ✓1 reviewed the letter/recipient/address; ✓2 understands the $7.78 hold becomes a
final charge only at acceptance; ✓3 read the warning, understands post-acceptance is irreversible; ✓4 "I'm
mailing this on behalf of Elena Ruiz, and I'm authorized to act for her case." (the on-behalf-of branch of
✓4, since this session is inside a managed-client workspace, KAI-FULFILLMENT-UX.md §1.2 table row 4). Submit
is disabled until all four are checked (§1.3).
KAI: (silent — by design, the strictest render in the whole chain.)
DOES: Marcus checks all four, clicks Submit.
CHANGES: server validates the FINAL REVIEW token (contentHash/warningVersion/estimatedTotalCentsShown/
policyVersion match, §1.5); a FinalReviewConfirmation audit row is written; createMailJob() fires;
FulfillmentStage advances to SUBMITTED.
⚑ DELIGHT: ✓4's on-behalf-of branch is the single most carefully engineered line in this entire ring — it is
the only assertion that is structurally UNREACHABLE for an impersonating admin (the screen refuses to render
at all under impersonation, §1.2 row 4) and it makes the payer/spend-authority fact affirmative and provable,
not inferred later from a cookie. This is real, load-bearing honesty infrastructure, not decoration.
⚑ GAP: none of the four checkboxes, nor the surrounding chrome, states which SPECIFIC wallet this hold came
from ("your agency's CreditVector Wallet," singular, unnamed) — for an agency with more than one funding
source in the future (a hypothetical, not designed today) this would be ambiguous; today, with exactly one
wallet per principal (WALLET-COMMITMENT-MODEL.md §3.1, @@unique([principalId])), it is not yet a real
problem, only a naming precedent worth watching.
```

---

### ⇢ Transition 3 — Dispute Package → Mail Center

```
[Transition 3 — Dispute Package (Submit) → Mail Center · 11:08am]
SEES: Submit succeeds; the terminal render shows Receipt()-equivalent content (today: app/mail/send/
[letterId]/page.tsx:248-283 — manifest id, generated timestamp, recipient, print spec, letter hash, mail
status, audit-entry count, "Provider stages: Available after live mail integration" honestly reserved until
live). Two links: "See it in the Mail Center →" and "View the case timeline →" (:277-278).
DOES: Marcus clicks through to the Mail Center.
CHANGES: none from the click itself — the package's own state already changed at Submit.
⚑ SEAM: this transition carries almost everything correctly — the SAME letter/package id resolves on the
other side, so Mail Center can render this exact row without Marcus re-identifying anything. What does NOT
carry: scroll position, and any sense that "you just came from submitting this" — Mail Center's own
work-queue sort (health-priority ladder, B-MAIL-CENTER-EVOLUTION.md §2.2) will re-rank this brand-new
SUBMITTED row among 14 clients' worth of other rows with no visual acknowledgment that it is the thing
Marcus just did. An operator inside one OS expects "the thing I just finished" to be visibly foregrounded
for at least one screen; here it is correctly filed, but not celebrated or even highlighted.
```

---

### Scene 8 — Mail Center (arrival, work queue, interruption, evidence)

```
[Scene 8 — Mail Center · Journey node: CreditVector Fulfillment (continuous view) · 11:09am]
SEES: (target, B-MAIL-CENTER-EVOLUTION.md §2) /mail loads — a "Do this first" band at the TOP (new
pickQueueRecommendation(), reusing recommendationFor()'s text verbatim as `sub`, §2.3), a health-priority
work queue below it (ESCALATION_AVAILABLE → NEEDS_ATTENTION → RESPONSE_RECEIVED → READY_FOR_ROUND_2 →
WAITING_NORMALLY → COMPLETED, §2.2) instead of today's DB-order flat list, the StatCard metrics grid demoted
to a compact context strip below the recommendation (§2.6), and — for the Meridian Bank Card row just
submitted — a canonical 12-stage timeline showing SUBMITTED as `current`, everything after it honestly
`placeholder` (RESERVED = "Available after live mail integration.", lib/mailCenter.ts:84,224-230, in target
form re-keyed to the real canonical stages). The Northline Round 1 row (2 letters, both bureau-directed,
mailed Aug 20, delivered Aug 25) shows health WAITING_NORMALLY, day 6 of the ~30-day §611 window, Kai-intel
bullets: "You mailed this 6 days ago." / the §611 window text / "No action needed yet — the §611
reinvestigation clock is running." (mailCenter.ts:161, recommendationFor()). An evidence drawer
(B-MAIL-CENTER-EVOLUTION.md §2.4, first UI consumer of TrackingInfo/ProofArtifact anywhere in the app) sits
nested inside each row's disclosure — for both rows today, every field honestly reads RESERVED, since
neither package has reached a stage with real tracking/proof data yet.
   Mid-scan, Marcus's phone rings — a different Meridian client, unrelated to Elena, asking about a letter
   status. He answers, checks that client's row from memory (no navigation happens on-screen), hangs up,
   and returns to exactly where he left off on Elena's rows — the page never lost its scroll or disclosure
   state because nothing forced a reload.
KAI: (per-row kaiIntel bullets speak; no floating KaiPresence pill duplicates them — /mail joins the
exclusion list, KaiPresence.tsx:101, per D-KAI-EXPERIENCE.md §4.1's interface expectation to Agent B.)
DOES: Marcus confirms Northline is healthy and quiet, confirms Meridian Bank Card is correctly queued, closes
the tab mentally, moves to check the case timeline.
CHANGES: nothing written — a read-only triage pass.
⚑ DELIGHT: the interruption cost nothing, because the room never round-trips to the server on disclosure
toggle (native <details>, no client JS) — this is a genuinely OS-like resilience property: a phone call
mid-task does not lose Marcus's place, unlike a SPA that re-fetches on focus-return.
⚑ FRICTION: the evidence drawer's first live content is still months away for BOTH rows on this exact
Tuesday (neither has a real ProofArtifact/TrackingInfo yet) — the drawer is real infrastructure with nothing
to show, an honest emptiness rather than a fabricated one, but it does mean the single most touted new
presentation ("Evidence") is, on this actual Tuesday, invisible in practice.
```

**Room Constitution scorecard — Mail Center (target)**

| Presentation | Present? | Honest? | Load-bearing? |
|---|---|---|---|
| Current work | Present (health-priority queue replaces DB order) | Yes | Yes |
| Current state | Present (6-state health pill, unchanged vocabulary) | Yes | Yes |
| Recommended action | Present, singular, top-of-page ("Do this first" band) | Yes, cites `basis` | Yes |
| Kai guidance | Present (per-row `kaiIntel`) | Yes | Yes |
| Evidence | Present as infrastructure; RESERVED in practice today | Yes (never fabricated) | Not yet — real but currently inert |
| Timeline | Present (12-stage per-row) | Yes | Yes |

**"What should I do next?"** — Yes, both at the room level (the band) and the row level (the recommendation). **Operational workspace or dashboard/webpage?** Operational workspace. *Layout:* recommendation-first, metrics demoted — the exact inversion the Room Constitution names as the test (`OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §3). *State carriage:* native disclosure, no client-side re-fetch, survives interruption. *Action proximity:* the queue's own CTA buttons are on-page now (target), not off to a different room, per §2.3 of the evolution doc.

---

### ⇢ Transition 4 — Mail Center → Timeline

```
[Transition 4 — Mail Center → Timeline · 11:12am]
SEES: Marcus clicks "See the full case timeline →" (today's exact link text, app/mail/page.tsx:158). /journey
loads.
DOES: navigation, no parameters carried beyond the implicit workspace-cookie identity.
CHANGES: none.
⚑ SEAM: identity still carries (Elena's rows load correctly) but NOTHING about "which letter you were just
looking at" does — /journey renders the WHOLE case history, un-scrolled to the Meridian Bank Card entry
Marcus just came from. He must re-find it by eye in a chronological list. This is a small but real
re-orientation tax: the operator just spent four scenes deep inside one package and arrives at its own
timeline with no anchor back to it.
```

---

### Scene 9 — Timeline (/journey)

```
[Scene 9 — Timeline · Journey node: Timeline (continuous, dual-natured per CASE-JOURNEY-RUNTIME-PLAN.md
§1.3(b)) · 11:13am]
SEES: /journey (app/journey/page.tsx) — one deduped feed (live KaiEvents ∪ synthesized history ∪ derived
upcoming deadlines, "one timeline — never two," :12-15). "Coming up" card at the top: "Round 1 to Equifax/
TransUnion response window closes in 24 days" (Northline). Grouped-by-day entries below: Aug 18 upload → Aug
19 analysis → Aug 20 letters generated/mailed ("§611 clock started") → Aug 25/26 (not yet reached truthfully
by any live event on THIS date — mailStatusLine()'s default: null still governs, :56-58) → today, Sep 1, no
new dated entry for the just-submitted Meridian Bank Card package yet, because mail.status events for the
new canonical stages are exactly what the target `mailStatusLine()` switch extension is designed to surface
(execution/CASE-JOURNEY-RUNTIME-PLAN.md §4.3) — as of THIS moment (11:13am, five minutes after Submit) the
event may not have propagated into this render yet, an honest small lag, not a defect. The 90-day phase
checklist below (unchanged since ADR-0007/CX-3) shows "Escalate unverified items (Round 2)" still unchecked.
KAI: (no floating presence — /journey is Kai-owned, in the exclusion list, KaiPresence.tsx:101 — its own
narration IS Kai, D-KAI-EXPERIENCE.md §4.1.) The entries themselves speak in Kai's first person via
`meaningFor()`: "The bureau owes a reinvestigation within ~30 days of receiving it (§611)."
DOES: Marcus confirms the whole case reads correctly as one continuous record, notes nothing is overdue.
CHANGES: nothing written.
⚑ FRICTION: "one timeline, never two" is a real, well-kept invariant — but it means Timeline and Mail
Center's per-row timeline are two DIFFERENT renderings of overlapping-but-not-identical data (one entry feed
across the whole case vs. one 12-stage ladder per package). Nothing labeled either one as "the same facts,
two views" — an operator moving between them (as Marcus just did) has to independently trust that they
agree, since nothing visually cross-references them (no "see this stage in the Mail Center row" link back).
```

**Room Constitution scorecard — Timeline**

| Presentation | Present? | Honest? | Load-bearing? |
|---|---|---|---|
| Current work | Partial — the whole history is "current," but no single item is called out as THE thing needing attention | Yes | Partial |
| Current state | Present via the "Coming up" card and per-entry icons | Yes | Yes |
| Recommended action | Absent as its own presentation — the room narrates what happened, not what to do next (that's Mission Control's/Mail Center's job) | N/A by design | No |
| Kai guidance | Present, deeply — every entry carries a `meaningFor()` line | Yes | Yes |
| Evidence | Absent (no drawer, no proof artifact rendering here) | N/A | No |
| Timeline | Present, the room's entire reason to exist | Yes | Yes |

**"What should I do next?"** — Not this room's job, by design (`CASE-JOURNEY-RUNTIME-PLAN.md` §1.4 correctly scopes Timeline as a "continuous view," not a recommender) — and it does not pretend otherwise. **Operational workspace or dashboard/webpage?** Leans workspace, reads slightly archival. *Layout:* a ledger, not a decision surface — appropriate to its job. *State carriage:* real, deduped, honest about lag. *Action proximity:* deliberately low — this is the one room in the ring where low action-proximity is the CORRECT design, not a gap.

---

### ⇢ Transition 5 — Timeline → Wallet

```
[Transition 5 — Timeline → "Wallet" · 11:15am]
SEES: Marcus, wanting to confirm Meridian's agency wallet can cover the next few weeks of fulfillment before
he moves on to his next client, looks for a place to check it. Sidebar's ACCOUNT_NAV (Sidebar.tsx:31-36)
lists: Agency, Settings, Billing, Support. No "Wallet." No nav item anywhere names it.
DOES: he clicks "Billing" — the closest-sounding destination.
CHANGES: none.
⚑ SEAM (the load-bearing one for this whole transition): there is no product concept the operator can click
that is named "Wallet." The transition from Timeline to "Wallet" is, in the actually-shipped nav graph, a
transition from Timeline to a GUESS.
```

---

### Scene 10 — "Wallet" (the room that does not exist)

```
[Scene 10 — attempted Wallet · 11:16am]
SEES: /billing loads (app/billing/page.tsx) — "Your Current Plan," "Agency," "$399.00/month," "Manage/
Cancel Subscription," "Payment & Invoices via Stripe portal." This is Meridian's SaaS SUBSCRIPTION — the
$399/mo Agency plan gate (lib/entitlements.ts, ADR-0038's five-instrument partition) — a completely
DIFFERENT financial instrument from the per-letter fulfillment Wallet (WALLET-COMMITMENT-MODEL.md §1,
explicit: "never a sixth instrument, never converted with XP/Business-Health/Affiliate/Promo," i.e. the
Wallet is instrument #6-that-is-not-#6 relative to this exact page's subscription plumbing). Nowhere on
this page is a fulfillment-hold balance, a per-letter spend history, or a deficit posture. Marcus finds
nothing here that answers his actual question.
   The nearest REAL signal that a wallet fact ever surfaces at all: per KAI-FULFILLMENT-UX.md §3.4, a
   deficit state would show as a short pill — "Your agency's wallet balance: deficit. New fulfillment holds
   for your case are paused until this is resolved." — but ONLY inside a Mail Center row or a KaiPresence
   pill, and ONLY when a deficit actually exists. Today, with Meridian's wallet healthy, nothing renders
   anywhere. There is no "wallet is fine" positive confirmation surface either — silence is the ONLY
   state a healthy wallet ever produces, anywhere in the product.
KAI: (nothing — no Kai voice exists on the Billing page for fulfillment funds, because fulfillment funds
have no presence on this page at all.)
DOES: Marcus, mildly confused, gives up checking and trusts that he'll be told if something's wrong (which,
per the design, is actually true — WALLET_DEFICIT is Kai's highest-priority Recovery verdict, outranking
everything package-scoped, KAI-FULFILLMENT-UX.md §4.2 — but he has no way to know that reassurance exists
without already knowing the architecture).
CHANGES: nothing.
⚑ GAP / FRICTION (the single most consequential finding of this entire ring-walk): the Wallet has real
architecture (an anchor row, an append-only ledger, a payer-principal model, a whole Recovery-verdict
vocabulary for what happens to it) and ZERO consistent operator-facing surface. It is designed to be
"ambient" — visible only when something needs attention — which is a defensible anti-overwhelm choice
(mirrors "quiet is allowed," lib/kaiHome.ts:150) for NOTIFICATIONS, but it leaves no answer at all to the
ordinary, non-urgent question "how much is in here right now," which every real financial account (a bank
app, a prepaid card, Stripe's own dashboard) answers as a standing, always-available fact, not only as an
alert. This is the exact seam the SIM-BRIEF's ring topology was built to surface by NAMING "Wallet" as a
stop — the ring expected a room; the product has a mechanism wearing a room's name in conversation only.
```

**Room Constitution scorecard — "Wallet"**

| Presentation | Present? | Honest? | Load-bearing? |
|---|---|---|---|
| Current work | Absent (no room) | N/A | No |
| Current state | Absent except during a deficit (silence otherwise) | Honest in what little it shows | No |
| Recommended action | Absent | N/A | No |
| Kai guidance | Absent except during a deficit | N/A | No |
| Evidence | Absent (no ledger history view anywhere) | N/A | No |
| Timeline | Absent | N/A | No |

**"What should I do next?"** — No answer exists because no room exists. **Operational workspace or dashboard/webpage?** Neither — it is an absence wearing a nav label (Billing) that belongs to an unrelated concept.

---

### ⇢ Transition 6 — "Wallet" → Marketplace

```
[Transition 6 — "Wallet" → Marketplace · 11:17am]
SEES: Marcus, having failed to find a wallet page, tries the one adjacent idea that might logically live
near it — a marketplace/funding/growth surface. No Sidebar item exists for it (NAV/ACCOUNT_NAV, Sidebar.tsx
:15-36, have no such entry). He tries the URL /network — this resolves to "Operator Network"
(app/network/page.tsx), a community/messaging surface (gated by operatorNetworkAccessible(), an internal
cohort check), unrelated to a fulfillment/growth marketplace.
DOES: no further navigation attempted — there is nothing else to try.
CHANGES: none.
⚑ SEAM: exactly the "web pages, not an OS" failure mode in its purest form — a dead end with no signage.
```

---

### Scene 11 — [Marketplace: honestly-future]

```
[Scene 11 — Marketplace (attempted) · 11:17am]
SEES: nothing. There is no /marketplace route in this worktree. The only trace of the concept anywhere in
the codebase is a single backend registry entry: lib/platform/modules.ts:32 — { slug: "marketplace", name:
"Kai Marketplace", capability: "platform.api.access", flagEnv: "MODULE_MARKETPLACE", status: "dormant", gate:
"kernel ABI freeze + partner PDP", completion: 10 }. This is a NAME in a module registry with no UI, no
route, and (per the Program Brief's own line, PROGRAM-BRIEF.md: "Wallet: architecture only. Responsibilities:
... marketplace, growth network, payouts... integration points only") no design beyond the name.
KAI: (nothing — there is no surface for Kai to speak from.)
DOES: Marcus finds nothing, correctly concludes the feature does not exist yet, and moves on.
CHANGES: none.
⚑ GAP (important, and distinct from every other GAP in this document): this is not a case of "the target
design exists and today's code hasn't caught up" — the ROADMAP ITSELF, per this program's own Founder brief,
intends Marketplace/Growth Network to eventually be a "clearly-labeled FUTURE room" (SIM-BRIEF's own
instruction to Agent D: "show how the OS presents not-yet-available surfaces honestly"). Today there is not
even a labeled placeholder — no "Coming soon" card, no nav entry greyed out with a tooltip, nothing. The gap
is between the STATED INTENT (an honestly-labeled future surface) and the CURRENT REALITY (total silence) —
worth distinguishing from a simple "not built yet," because a labeled-absence and an unlabeled-absence read
completely differently to an operator: one says "we know, it's coming"; the other says nothing at all,
indistinguishable from a broken link.
```

**Room Constitution scorecard — Marketplace** — not applicable; no room exists to score. This is itself the finding.

---

### ⇢ Transition 7 — Marketplace (dead end) → Agency

```
[Transition 7 — dead end → Agency · 11:18am]
SEES: Marcus, having spent three fruitless clicks (Billing → Network → nothing), returns to familiar ground
— Sidebar "Agency" (Sidebar.tsx:32).
DOES: navigation.
CHANGES: none, but Marcus is now the SECOND time this session at /agency — once as a pass-through gateway
(Transition 1), once now as an actual destination. Per §1.0's topology note, this double-visit is a structural
fact of the current shell, not an artifact of this particular walk.
⚑ SEAM: no memory of the prior visit carries — the roster re-fetches from scratch, kaiSort defaults back to
true, the search box is empty again. Nothing is wrong here (a fresh, correct roster IS what's needed), but
it does mean the room has no notion that Marcus was just here 18 minutes ago hunting for a client to open —
no "recently opened: Elena Ruiz" affordance exists anywhere in this shell.
```

---

### Scene 12 — Agency (dedicated visit)

```
[Scene 12 — Agency · Journey node: Mission Control's agency-level participant/view (per CASE-JOURNEY-RUNTIME-
PLAN.md §1.4, "Mission Control is not a tenth node") · 11:19am]
SEES: /agency (app/agency/page.tsx), Marcus now no longer inside Elena's workspace (AgencyBar gone, since
this room is reached at agency altitude, not client altitude). The Kai Agency Briefing renders again
(app/agency/page.tsx:350-379): "I checked every follow-up clock. 3 of 14 clients need attention: 2 past the
30-day response window, 1 awaiting a first letter." KPI cards: Active Clients, Letters Generated (WTD/MTD/
YTD/all-time), Clients Added, Accounts Deleted (:382-393) — genuinely aggregate, genuinely honest (a real
count, not a vanity metric with nothing behind it). The roster, sorted by Kai's priority ladder
(needsAttention → awaiting-first-letter → everyone-else, :247-250), shows Elena NOT flagged (correctly —
she's 6 days into a 30-day window). Capacity banner: "12 of 14 client workspaces in use" (resolveAgencyCapacity(),
never hardcoded, :143-147, guarded by scripts/agency-capacity.test.ts).
KAI: "I checked every follow-up clock. 3 of 14 clients need attention..."
DOES: Marcus opens the client whose window passed (not Elena — a different Meridian client), moves to
address it — this simulation does not follow that thread further; it is out of THIS ring's assigned walk.
CHANGES: nothing on this exact screen (the click begins a new sub-session, out of scope here).
⚑ DELIGHT (a real, load-bearing one): this room is, on every one of the six presentations, MORE complete and
MORE honest than Mission Control was at the same altitude in Scene 1 — it has real current work, real
current state, a real singular recommendation surfaced in prose, real Kai guidance, real evidence (the KPI
counts), and an implicit timeline (WTD/MTD/YTD). The irony worth naming plainly: the ring's own FIRST room
(Mission Control) is the WEAKEST agency-altitude room in the entire product; the room the ring visits nearly
LAST (Agency) is the strongest. An operator's actual habit — as this walk demonstrates — is to skip past
Mission Control's silence and go straight to Agency every single morning. The room order the Founder's ring
specifies and the room order an operator will actually learn to use are, today, inverted.
```

**Room Constitution scorecard — Agency**

| Presentation | Present? | Honest? | Load-bearing? |
|---|---|---|---|
| Current work | Present (roster, sorted) | Yes | Yes |
| Current state | Present (needsAttention pills, capacity banner) | Yes | Yes |
| Recommended action | Present, singular, in prose (the Kai Briefing paragraph) | Yes | Yes |
| Kai guidance | Present | Yes | Yes |
| Evidence | Present (KPI cards, real counts) | Yes | Yes |
| Timeline | Present, implicitly (WTD/MTD/YTD period breakdowns) | Yes | Partial |

**"What should I do next?"** — Yes, clearly, at both the aggregate (briefing paragraph) and per-row level. **Operational workspace or dashboard/webpage?** Operational workspace — arguably the ring's best. *Layout:* recommendation-adjacent-to-roster, not metrics-first (KPI cards sit BELOW the briefing, `app/agency/page.tsx:350` before `:382`). *State carriage:* live, re-computed each visit, correctly re-sorted. *Action proximity:* one click from flag to workspace.

---

### ⇢ Transition 8 — Agency → Mission Control (ring closes)

```
[Transition 8 — Agency → Mission Control · 11:22am]
SEES: Marcus clicks Sidebar "Mission Control" to return to the account home before ending his session.
/dashboard loads — the AGENCY's own account again (no workspace cookie set at this altitude, since he never
re-entered a client workspace after exiting Elena's).
DOES: navigation.
CHANGES: none.
```

### Scene 13 — Mission Control (return, ring closure)

```
[Scene 13 — Mission Control · ring closure · 11:23am]
SEES: the IDENTICAL screen from Scene 1 — "Welcome back, Danielle." / "Everything's on track. No action
needed today." Nothing acknowledges the 25 minutes and one full dispute-package submission that just
happened. This is not a rendering bug — it is a structural consequence of WHERE the work happened: every
KaiEvent this session produced (report analysis, letter generation, approval, wallet authorization, submit)
was written keyed to ELENA's user id, inside her scoped workspace, never to Meridian's own account id. Case
Memory's "while you were away" mechanism (lib/kaiSeen.ts, 12h AWAY_THRESHOLD_MS, cited D-KAI-EXPERIENCE.md
§4.1) has nothing of the agency's OWN to recap, and structurally never will, for as long as agencies have no
case history of their own to accrue events against.
KAI: "Welcome back, Danielle."
DOES: Marcus closes the tab, satisfied the work is done, slightly unbothered by the flat repeat because he
already knows (from having done this before) that Mission Control never reflects agency-level activity.
CHANGES: none — the ring is closed.
⚑ FRICTION (a quiet, structural one, not a bug): the ring the Founder specified is a LOOP on paper — Mission
Control → ... → back to Mission Control — but the product experience is a LINE that happens to end where it
began, wearing the same face it wore at the start, with no memory that anything occurred in between. A real
operating system's "home" screen, after a session like this, would say something. This one says nothing,
because nothing it watches ever happened where it's watching.
```

---

### 1.1 Ring summary — six presentations at a glance

| Room | Current work | Current state | Recommended action | Kai guidance | Evidence | Timeline | "What next?" | Feel |
|---|---|---|---|---|---|---|---|---|
| Mission Control (agency alt., no workspace) | ✗ | partial | ✗ | minimal | ✗ | ✗ | No | webpage |
| Mission Control (Elena scoped) | ✓ | ✓ | ✓ | ✓ | ✓ | partial | Yes | workspace |
| Dispute Package chain | ✓ | ✓ | ✓ | ✓ (absent by design at 3 money moments) | ✓ | resumability only | Yes | workspace |
| Mail Center | ✓ | ✓ | ✓ | ✓ | ✓ (real, currently inert) | ✓ | Yes | workspace |
| Timeline | partial | ✓ | n/a by design | ✓ | ✗ | ✓ | n/a by design | workspace (archival) |
| "Wallet" | ✗ | ✗ (silent unless deficit) | ✗ | ✗ | ✗ | ✗ | No | absent |
| Marketplace | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | No | absent, unlabeled |
| Agency | ✓ | ✓ | ✓ | ✓ | ✓ | partial | Yes | workspace (strongest) |

### 1.2 Part 1 top-5 friction/gap items, ranked

1. **No dedicated Wallet surface exists anywhere** (Scene 10) — the ring's own topology names a room the architecture never assigns an address; a healthy wallet is indistinguishable from a wallet no one has thought to check.
2. **Mission Control has no agency-altitude view** (Scene 1) — the room the ring and the Sidebar both call "home" answers nothing for a 14-client operator; the real answer lives at Agency, visited last.
3. **Marketplace is an unlabeled absence, not a labeled future room** (Scene 11) — the stated intent (honest "coming soon") and the shipped reality (total silence, indistinguishable from a broken link) diverge.
4. **The ring's own implied topology doesn't match the shell's real link graph** (§1.0, Transitions 1 & 7) — "Client" requires transiting Agency; Agency is visited twice; nothing marks either fact.
5. **Ring closure carries no memory** (Scene 13) — because all session activity was written to Elena's identity, not Meridian's, Mission Control cannot reflect a 25-minute, fully-completed dispute-package submission having just happened.

---

## PART 2 — The Edge-Case Chain as an Experience

Continuing the Meridian Bank Card package from Part 1 Scene 7 (submitted Sep 1, hold placed, $7.78). This storyboard compresses the following weeks (per the Brief, dates run Aug 12–Oct 5, 2026) into the ten named beats the assignment specifies, in order: **manual mailing → CreditVector Fulfillment → wallet low → wallet sufficient → provider rejection → address correction → retry → successful delivery → response received → Round 2.**

```
[Beat 1 — manual mailing (the fork glimpsed, not taken) · Dispute Package chain step 8–9 fork · Sep 1]
SEES: at the terminal fork (KAI-FULFILLMENT-UX.md §1.1's chain end), BOTH options render co-equal
(B-MAIL-CENTER-EVOLUTION.md §3.4's two-option law, target state): "Download Package" and "Send with
CreditVector Fulfillment," side by side, neither de-emphasized. Marcus glances at Download (today's honest
precedent: app/letters/page.tsx:381-383, "Mark mailed myself" — the immediate, zero-friction, always-live
path) and decides against it — Elena is a managed client whose agency pays for certified mail as a service
standard, so Send is the deliberate choice here, not Download's absence of a fallback.
KAI: (silent — this is the two-option law's own neutral moment; neither Kai nor the chrome steers.)
DOES: Marcus clicks "Send with CreditVector Fulfillment."
CHANGES: none yet — the choice itself is the event.
⚑ DELIGHT: the two-option law holding neutral here is exactly right — no dark-pattern nudging toward the
revenue-bearing path.
```

```
[Beat 2 — CreditVector Fulfillment (submit attempt #1) · FulfillmentStage: WALLET_AUTHORIZED → SUBMITTED
attempt 1 · Sep 1, 11:07am]
SEES: FINAL REVIEW clears (Scene 7, already rendered in Part 1); Submit fires; createMailJob() is called.
KAI: (silent, per the money-card law.)
DOES: the operator's part is done; the system takes over.
CHANGES: FulfillmentStage → SUBMITTED, attempt 1.
```

```
[Beat 3 — wallet low · Sep 1, 11:07am, same instant] — actually caught one step earlier than Submit, per
the architecture (authorizeGroup's fold-check runs BEFORE Submit, WALLET-COMMITMENT-MODEL.md §5.2)
SEES: (branch not taken in Part 1's clean walk — rendered here as the edge case) had Meridian's wallet been
under $7.78 at the moment of Approve, authorizeGroup() would have returned before any hold posted:
{ok:false, code:"insufficient_funds", availableCents: 312, requiredCents: 778, shortfallCents: 466} (§5.2's
exact shape). The FINAL REVIEW screen is never reached — the chain stops at Approve.
KAI: "I couldn't set aside the hold for this package — your agency's CreditVector Wallet doesn't have enough
available right now. You're $4.66 short of the $7.78 this package needs. Nothing changed with your existing
holds, and nothing about the letter is lost — add funds and this is ready to send in one step."
⚑ GAP: the exact "add funds" screen this line points to is not designed in any locked doc — WALLET-
COMMITMENT-MODEL.md specifies fundWallet() (§5.1) and reuses the existing Stripe-checkout precedent in
spirit, but no document shows the funding UI's screen contract (amount picker? preset tiers? redirect to a
Stripe Checkout session, mirroring /api/stripe/checkout's existing pattern for letter packs?). This
simulation renders the most plausible target — a "top up" button that opens a Stripe-hosted checkout, the
same idiom already shipped for the agency plan and letter packs (app/agency/page.tsx:123-161, app/letters/
page.tsx:340-355) — and marks it GAP because no fulfillment-specific doc actually commits to this shape.
DOES: Marcus (or, more realistically, Danielle, since funding the agency wallet is an owner-level financial
act) clicks "Add funds," completes a $50 top-up via Stripe checkout (best-guess, GAP-marked).
CHANGES: a `fund` WalletLedger entry posts; `availableCents` becomes 3,812.
```

```
[Beat 4 — wallet sufficient (retry from Approve) · Sep 1, 11:20am]
SEES: Marcus returns to the package, still sitting at Approve (nothing was lost — per the chain's own
resumability law, KAI-FULFILLMENT-UX.md §1.8, a pre-hold navigation-away always lands back on Approve with
nothing pre-filled or pre-checked). He clicks Approve again.
KAI: "This is a hold, not a charge. $7.78 is set aside from your agency's CreditVector Wallet balance to
cover this package while CreditVector Fulfillment reviews it — nothing is deducted yet, and nothing is
charged to you directly." (§3.1, identical copy to Scene 6 — nothing about this line changes because the
wallet was topped up; it is the SAME fact, now satisfiable.)
DOES: FINAL REVIEW, four checkboxes, Submit — identical to Beats 1–2.
CHANGES: authorize entry posts (attempt 1), FulfillmentStage → SUBMITTED.
⚑ DELIGHT: the recovery required ZERO new UI vocabulary — the operator simply re-entered the exact same
chain step they'd have used on a normal day. Failure did not invent a special "recovery mode" the operator
has to learn.
```

```
[Beat 5 — provider rejection · FulfillmentStage: SUBMITTED → REJECTED · Sep 2]
SEES: the furnisher-direct package's mailing address (parsed from Elena's report, per app/letters/page.tsx's
furnisher-address-entry UI) is malformed enough that CreditVector Fulfillment's synchronous acceptance check
refuses it (RECOVERY-ENGINE.md §4 scenario 5, "API rejection," reasonCode: provider_rejected). The hold from
Beat 4 releases automatically.
KAI: "CreditVector Fulfillment couldn't accept this package as submitted. Your agency's hold was released —
nothing was charged. I've kept the letter and flagged what needs fixing so it can be resent." (exact copy,
KAI-FULFILLMENT-UX.md §2.3.5, CORRECTION_NEEDED_GENERAL class, on-behalf-of variant.)
DOES: this surfaces where Recovery moments are designed to surface — a Mail Center row's kaiIntel bullet
shifting toward NEEDS_ATTENTION, and (per §4.1's notification-moment table) a KaiPresence pill if it's the
single highest-priority item account-wide.
CHANGES: `release` WalletLedger entry posts (basis: provider_rejected); FulfillmentStage → REJECTED (a
terminal side-state for THIS attempt, per FULFILLMENT-COMMITMENT-BOUNDARY.md §4.2 — a fresh attempt is
required, never a reuse of this manifest).
⚑ DELIGHT: the word "Failed" never appears anywhere in this beat — Founder ruling #4 (never say "Failed")
holds exactly, and the copy names the specific, correctable defect rather than a generic error.
```

```
[Beat 6 — address correction · Sep 2, same session]
SEES: Mail Center's row (or the reopened Package Review chain, either is a legal re-entry point per the
design) shows the flagged defect. Marcus opens Elena's tradeline record, corrects the furnisher's mailing
address against the original report source, and re-enters the chain.
KAI: (the Kai Summary panel, re-rendered for the new attempt, restates recipient/round/address context —
nothing about the correction requires a new kind of screen.)
DOES: Marcus fixes the address field, re-approves.
CHANGES: nothing yet financial — this is preparation for the retry.
```

```
[Beat 7 — retry · FulfillmentStage: PREPARED (attempt 2) → WALLET_AUTHORIZED → SUBMITTED · Sep 3]
SEES: a brand-new attempt (attempt 2, a fresh MailManifest id `mail_<letterId>_a2`, the original attempt-1
manifest preserved untouched as evidence, FULFILLMENT-COMMITMENT-BOUNDARY.md §4.2). A NEW, independent hold
posts — never a reuse of the released attempt-1 hold (RECOVERY-ENGINE.md §4 scenario 7 / Ruling 1's
same-shape guarantee).
KAI: "I've resubmitted this package with what was corrected — a new hold of $7.78 is set aside on your
agency's balance for this attempt. I'll update you the moment CreditVector Fulfillment responds." (exact
copy, §2.3.6, on-behalf-of.)
DOES: Marcus confirms the corrected address is reflected, submits again.
CHANGES: a second, independent authorize→settle chain begins under attempt 2.
⚑ DELIGHT: "a new hold... for this attempt" is precise, honest accounting — the operator is never told the
old hold "still counts," and never asked to reconcile two overlapping numbers in their head.
```

```
[Beat 8 — successful delivery · FulfillmentStage: ACCEPTED → PRINTING → MAILED → USPS_ACCEPTED → DELIVERED →
RETURN_RECEIPT_ARCHIVED · Sep 4 – Sep 16]
SEES: acceptance lands (Sep 4) — the wallet SETTLES here, permanently (CREDITVECTOR-FULFILLMENT-ENGINE-V1.md
§3.3): "CreditVector Fulfillment has accepted this package for production. Your agency's hold is now final —
$7.78 has been applied to their CreditVector Wallet balance, and there's nothing further you need to do to
keep it moving." (exact copy, KAI-FULFILLMENT-UX.md §3.2, on-behalf-of.) Printing (Sep 5), Mailed (Sep 8,
"The postal carrier has it" per D-KAI-EXPERIENCE.md §4.5's copy table), USPS Accepted (Sep 10), Delivered
(Sep 14) — Kai: "Delivered. I'll let you know if anything else needs your attention." Return Receipt Archived
(Sep 16) — "Your delivery evidence is archived with this case." Because this is a FURNISHER-direct dispute,
not a bureau letter, NO §611 clock starts here — the room correctly uses the furnisher's own open-ended
framing ("keep your proof of mailing and follow up if you don't hear back," lib/mailCenter.ts's windowText()
furnisher branch) rather than fabricating a fixed clock that doesn't apply to this recipient kind.
KAI: (per-stage lines above, each its own labeled timeline row, never overwriting the factual stage.)
DOES: Marcus checks in periodically via Mail Center's evidence drawer, now genuinely populated (tracking
milestones, the archived return-receipt artifact) — the FIRST moment in this entire simulation the evidence
drawer built in Scene 8 has real content to show.
CHANGES: FulfillmentStage advances honestly stage by stage; wallet stays settled throughout (no further
entries).
⚑ DELIGHT (the strongest in this document): the system correctly withholds a statutory clock it has no
right to claim (furnisher, not bureau) even in the middle of an otherwise celebratory delivery sequence —
proof the CROA discipline holds under a genuinely positive narrative pull, not only in the compliance-review
gate's abstract.
```

```
[Beat 9 — response received · Oct 1]
SEES: the existing, live response-logging flow (app/letters/page.tsx's LetterRow, "Log response" →
`/api/letters/[id]/response`) — Marcus pastes the furnisher's reply. The Kai Response Card renders: "They
changed the item — check what, exactly." / "What the response says" (AI-composed summary of the pasted
text) / "Weaknesses a follow-up can target" / one next action button: "Draft Round 2 targeting these
weaknesses →" (app/letters/page.tsx:641-703, exact live behavior — this is the one beat in the whole
Recovery chain that is NOT a "target design," it is TODAY's shipped code, unchanged by this program).
KAI: "They changed the item — check what, exactly." / "Compare the updated fields against your records — a
partial correction can still leave inaccurate data worth a targeted follow-up."
DOES: Marcus reviews the analysis, decides Round 2 is warranted.
CHANGES: Letter.responseOutcome = "updated"; responseAnalysis persisted.
```

```
[Beat 10 — Round 2 · Oct 2]
SEES: Marcus clicks "Draft Round 2 targeting these weaknesses →" (`/round2` route, live today). A new
Letter (round 2, parentLetterId set) generates, re-entering the Dispute Package chain at Prepared — closing
the Next-Recommendation loop exactly as D-KAI-EXPERIENCE.md §6 describes it: "Return Receipt Archived →
Waiting Period → Ready for Next Review → (back to) Case → Kai Analysis."
KAI: (the round2 gate's own precedent line, if attempted too early: "Log the bureau's response first, then
generate Round 2" — not triggered here, since a response IS logged.) Kai's next recommendation: "Draft Round
2 targeting these weaknesses."
DOES: the cycle restarts — this package re-enters PART 1's exact chain, one round later.
CHANGES: a new attempt, a new round, the same case.
⚑ DELIGHT: the loop genuinely closes onto the SAME machinery this whole document already walked — Round 2
is not a special mode, it is "go through the chain again," which is the correct, minimal-surface-area design.
```

**Verdict — dignity and clarity, or disconnected screens?** Mostly dignity. Every failure in this chain (wallet-low, provider rejection) preserves the package, names a specific cause, states the wallet's exact position in plain language, and hands back a single next action — never the word "Failed," never a raw error, never a dead end. The recovery mechanics are genuinely one continuous experience: the SAME chain, the SAME rooms, re-entered rather than replaced. The one place dignity is not fully engineered yet is the funding moment itself (Beat 3) — the single UI screen an operator needs most in a genuine crisis (their agency's spend is blocked) is the one screen no locked document actually designs, so this simulation had to guess its shape rather than cite it. That gap sits exactly at the hinge between "recoverable" and "dignified": the architecture guarantees the OPERATOR is told the truth and nothing is lost, but does not yet guarantee the operator has a designed, one-click path back to solvency.

---

## PART 3 — The OS-Verdict Inputs

### 3.1 Preliminary verdict

**The Credit Operating System vs. a collection of credit repair pages — honest preliminary answer:** CreditVector is a **federation of well-governed pages that share one shell and one voice, not yet one operating system.** The individual rooms are, room-for-room, unusually disciplined — the Room Constitution's presentations are real and mostly load-bearing where they've been built (Mail Center, Agency, the Dispute Package chain), Kai's emotional-range and CROA laws hold under real narrative pressure (Part 2, Beat 8), and the shell (AppShell/Sidebar/AgencyBar/KaiPresence) is genuinely one piece of code every room inherits. What is missing is not discipline inside any one room — it is a connective layer ABOVE the rooms: no persistent sense of place across a session, no always-available answer to "where is my money," no acknowledgment when a session's work is done, and a ring topology (Wallet, Marketplace, the Mission Control→Client edge) that the Founder's own specification assumes exists as destinations but that the shipped shell does not yet provide as such.

### 3.2 Seam inventory — every place the illusion breaks, ranked by severity

| # | Sev | Seam | Where it lives |
|---|---|---|---|
| 1 | Critical | No Wallet surface exists anywhere; a healthy balance and an unchecked balance are indistinguishable | Scene 10; nav graph (`Sidebar.tsx`) |
| 2 | Critical | Mission Control has no agency-altitude view; the room named "home" answers nothing for a multi-client operator, while the real answer lives one room later (Agency) | Scenes 1, 13; §1.2 item 2 |
| 3 | High | Marketplace/Growth Network is an unlabeled absence, not the "honestly-future" labeled room the roadmap's own intent describes | Scene 11 |
| 4 | High | The ring's topology (Mission Control→Client direct; Wallet, Marketplace as destinations) diverges from the shell's real link graph, with nothing marking either divergence | §1.0; Transitions 1, 6, 7 |
| 5 | Medium-High | No screen designs the "add funds" moment — the single highest-stakes recovery action in the whole edge-case chain is architecturally guessed, not specified | Part 2, Beat 3 |
| 6 | Medium | Session activity inside a scoped client workspace never registers against the agency's own Case Memory — the ring cannot close with any acknowledgment that work occurred | Scene 13 |
| 7 | Medium | Transitions carry identity (via the workspace cookie) but nothing else — no visual signal of departure/arrival, no carried scroll position, no "you just came from X" foregrounding on arrival | Transitions 1, 3, 4 |
| 8 | Medium | Two unrelated financial concepts (SaaS subscription Billing vs. per-letter Fulfillment Wallet) share adjacent nav real estate and overlapping vocabulary ("plan," "balance," "charge") with zero visual distinction | Scene 10 |
| 9 | Low-Medium | Timeline and Mail Center's per-row timeline are two independently-rendered views of overlapping facts with no cross-reference between them | Scene 9 |
| 10 | Low-Medium | "PDF Preview" (chain step 6) names an artifact the mechanism doesn't yet produce (browser print-to-PDF only) | Scene 4 |
| 11 | Low | The everyday greeting register ("Welcome back, Elena") has no on-behalf-of variant the way money narration does, even though the audience is provably an agency operator, not the client | Scene 2 |
| 12 | Low | Agency, visited twice in one real session (gateway + destination), carries no memory between visits (no "recently opened" list) | Transition 7 |
| 13 | Low | `calm`/`curious`/`attentive`/`focused`/`pleased` (the Brief's own Kai voice-law adjectives) are not literal members of `KaiStateId` (`lib/kaiStates.ts`) — a naming-registry mismatch between the emotional-range LAW and the emotional-range TYPE, already self-flagged once in `KAI-FULFILLMENT-UX.md` §2.4 | cross-cutting |

### 3.3 What already genuinely feels OS-like — named

- **The shell itself.** `AppShell`/`Sidebar`/`AgencyBar`/`KaiPresence`/`MobileNav` (`components/AppShell.tsx:10-32`) is one real piece of code every room inherits without exception — no room re-implements navigation, and the one identity banner (`AgencyBar`) that DOES need to appear conditionally does so from one shared component, not a per-room reimplementation.
- **The workspace-identity mechanism.** Re-scoping an entire session's server-side identity through one cookie (`WORKSPACE_COOKIE`) rather than a separate login is a genuinely OS-grade primitive — closer to switching user context in a real operating system than to anything a stitched-together set of web pages would attempt. Its PRESENTATION is thin (Scene 2, Transition 1), but the MECHANISM is real.
- **Kai's continuity of voice and law.** The emotional-range law, the CROA scrubber, the never-fabricate discipline, and the vendor-opacity law hold identically whether the room is Mission Control, Mail Center, or a Recovery-verdict copy line deep in an edge case (Part 2, Beat 8) — this is not decoration, it is a single enforced register followed everywhere it was checked in this walk.
- **The one-noun-adjacent discipline already present outside CXOS.** Independent of CXOS's own one-noun law (§11.9, "chamber," never a second noun for the same concept), this codebase already practices the identical discipline elsewhere: one `FulfillmentStage` vocabulary, one `StageState` vocabulary, one `MailHealth` vocabulary, reused verbatim across Mail Center, Timeline, and (in target form) the Journey read-model — never a second name for the same fact.
- **Zero-fabrication as a load-bearing habit, not a slogan.** `RESERVED`/`placeholder` states (`lib/mailCenter.ts:84,224-230`), `mailStatusLine()`'s `null` default (`app/journey/page.tsx:56-58`), and "quiet is allowed" (`lib/kaiHome.ts:150`) all independently enforce the same law — this walk found it honored in every room it touched, including under real narrative pressure (Part 2, Beat 8's correct withholding of a clock that doesn't apply).
- **The GXL provenance-pull on Mission Control** (`components/gxl/GxlPull.tsx`, `GxlField.tsx`) — a genuinely bespoke, non-decorative, state-driven ambient/evidence layer that behaves like a living instrument panel, not a web page. Its severity-ranked problem is distribution, not quality: it exists on exactly one room in the whole ring.

### 3.4 Top-8 improvement recommendations at EXPERIENCE altitude

Each: seam → recommendation (bounded refinement, not a redesign) → locked doc it lands in.

1. **Seam #1 (no Wallet surface).** Give the agency/consumer wallet ONE consistently-reachable, always-visible surface — e.g., a small balance readout permanently available from `AppShell`'s header (next to `+ New Dispute`) or a `/billing` sub-tab literally named "Fulfillment Wallet," distinct from the subscription plan panel. This does not require a new room-full of architecture — it is a presentation-layer placement decision over data `WalletPostureView`/`WalletBalanceView` already expose. **Lands in:** `C-WALLET-INTEGRATION.md` / `WALLET-COMMITMENT-MODEL.md` (as a UI-surface addendum) and `OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §4 (candidate room list).
2. **Seam #2 (Mission Control has no agency altitude).** Extend Mission Control's existing `hasReport`-gated pattern with an agency-scoped branch — when the signed-in principal `isAgency` and no client workspace is open, render the SAME Executive-Queue idiom over the roster's own priority ladder (already computed at `/agency`) instead of a bare "on track" line. This reuses `pickRecommendation()`'s fixed-priority law and Agency's own `needsWork`/`briefingParts` computation — no new engine. **Lands in:** `OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §4 (Mission Control is explicitly named there as "not yet re-audited" — this is that audit's first finding) and `CASE-JOURNEY-RUNTIME-PLAN.md` §1.6 (Mission Control convergence, already named as a future extension point).
3. **Seam #3 (Marketplace unlabeled).** Ship the one honestly-labeled placeholder the roadmap already intends — a single greyed Sidebar entry or a "Coming soon" card reachable from Agency, naming what it will be and citing no promise of a date. Bounded, additive, zero new capability. **Lands in:** `docs/fulfillment/PROGRAM-BRIEF.md`'s wallet-integration-points note (extend to name the placeholder) and Agent D's `SIM-AGENCY-OWNER.md` (already assigned to design this exact honest-future-room presentation).
4. **Seam #4 (ring topology mismatch).** Add a lightweight, explicit "recently opened client" affordance to `AgencyBar` or the Sidebar (a small dropdown of the last 2–3 opened workspaces), so the Mission-Control→Client edge the ring assumes becomes a real one-click path instead of a forced detour through the full roster every time. **Lands in:** `B-MAIL-CENTER-EVOLUTION.md` §5 (agency-scoping section, already the file that owns `AgencyBar`'s behavior).
5. **Seam #5 (no funding-moment screen).** Specify the "add funds" screen's contract explicitly — reuse the existing Stripe-checkout redirect idiom already shipped for the agency plan and letter packs, with a wallet-specific amount picker, so `WALLET_DEFICIT`/`insufficient_funds` Kai copy always has one, named, designed destination to point to instead of an implied one. **Lands in:** `WALLET-COMMITMENT-MODEL.md` §5.1 (`fundWallet`, already specified server-side — this is the missing client-side companion) as a bounded UI addendum.
6. **Seam #6 (no session-closure memory).** When a session performs real work inside a client workspace, write a lightweight, own-account-scoped `KaiEvent` at the agency's own id too (e.g., `agency.session_summary`) so Case Memory has something honest to recap on return to agency-altitude Mission Control — a receipt of "you did X for client Y," not a duplicate of the client's own event. **Lands in:** `D-KAI-EXPERIENCE.md` §1 (Narration Model — an additive event, not a new subsystem).
7. **Seam #7 (silent transitions).** Give the transition between rooms one small, consistent acknowledgment — not a CXOS-grade passage animation (that adoption stays Founder-gated, per `OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §5), but something as modest as the destination room's header briefly stating what carried ("Elena Ruiz's workspace" already does this via `AgencyBar` — extend the same idiom to name which case/package a same-workspace room-to-room jump is still about). **Lands in:** `OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` (a new, narrow qualifier under the existing binding-qualifiers list) — explicitly NOT a CXOS chamber-adoption ask.
8. **Seam #8 (Billing/Wallet naming collision).** Rename nothing in code, but visually and lexically separate the two instruments the moment either is user-facing — e.g., "Subscription" (today's Billing content) vs. "Fulfillment Wallet" (recommendation #1's new surface) as two clearly distinct labels, never both called "your balance" in adjacent UI. **Lands in:** `KAI-FULFILLMENT-UX.md` §2.2's substitution-table discipline, extended with one more row: self-pay/on-behalf-of voice already exists; add a subscription-vs-wallet disambiguation rule alongside it.

---

## Closing — Full-Ring Scorecard

### Emotional-design scorecard (Marcus, across the full Tuesday ring)

| Axis | Score (1–5) | Why |
|---|---|---|
| Confidence | 4 | Every claim Kai makes cites a `basis`; the FINAL REVIEW token/audit machinery means Marcus never has to trust an unverifiable assertion. Docked one point for the wallet-balance blind spot (Scene 10). |
| Momentum | 3 | Inside any one room the momentum is real (native disclosure survives interruption, resumability never loses a step) — but momentum resets hard at Scene 10's dead end and Scene 13's flat return; the ring itself does not accumulate a sense of "I got a lot done today." |
| Trust | 5 | Nothing in this entire walk fabricated a fact, faked progress, or said "Failed." Certified pricing, on-behalf-of voice, and the settled-stays-settled honesty (Part 2, Beat 8) are the strongest thing this product has. |
| Progress | 3 | Per-room progress (chain steps, `FulfillmentStage`) is vivid and real; ring-level progress (the sense of "I moved through my whole practice today") is invisible — nothing outside a single room ever shows accumulated Tuesday work. |
| Clarity | 4 | Every room answered its own six presentations clearly where it had them; clarity drops only at the two absent rooms (Wallet, Marketplace), where the ABSENCE itself is unclear (is it broken, or not built?). |
| Motivation | 3 | Agency's KPI cards and the Executive Queue's "Highest-impact unlock" tile genuinely motivate inside those rooms; nothing carries that motivation across the ring (no end-of-session "here's what you accomplished"). |
| Completion | 2 | The ring is specified as a loop and experienced as a line — closure (Scene 13) is indistinguishable from the opening screen (Scene 1). Nothing marks the session as complete. |

### Orientation verdict

- **Always knows where they are?** Mostly yes — `Sidebar`'s active-state highlighting and `AgencyBar`'s banner are reliable, consistent signals present in every room. The one place this fails is agency-altitude Mission Control, whose silence gives no positive signal of "you are at your account's own home," only an absence.
- **Always knows what happened?** Inside a room, yes (audit trails, timeline stages, Kai's per-event narration are real and honest). Across the ring, no — nothing outside `/journey` and Mail Center's own rows accumulates a cross-room record of "what Marcus did this session," and `/journey`/Mail Center's own timeline disagree only in that neither cross-references the other.
- **Always knows what happens next?** Yes, inside every room that has a Room-Constitution "recommended action" built (Mission Control-scoped, Mail Center, Agency, the Dispute Package chain). No, at the ring level — nothing tells Marcus, once he's back at Mission Control, whether there's anything left to do today across his 14 clients; he must go check Agency again to find out, the same room that already told him at the start of the session.

### Top-5 seams, ranked (final)

1. No Wallet surface exists anywhere (Scene 10) — Critical.
2. Mission Control has no agency-altitude view (Scenes 1, 13) — Critical.
3. Marketplace is an unlabeled absence, not an honestly-future room (Scene 11) — High.
4. The ring's specified topology and the shell's real link graph diverge, unmarked (§1.0) — High.
5. No screen exists for the single highest-stakes recovery action — funding a depleted wallet (Part 2, Beat 3) — Medium-High.

---

**Final summary for the merge:** Walking the full room ring as one Tuesday session with Marcus finds a product where every individual room that has been built to the Room Constitution (Mail Center, Agency, the Dispute Package chain) is genuinely disciplined, honest, and hard to distinguish from a real operational workspace — but the connective tissue between those rooms is thinner than the rooms themselves: two of the ring's eight named stops (Wallet, Marketplace) do not exist as destinations at all, the room meant to be the operator's "home" is agency-altitude blind, and nothing in the shell ever tells the operator a session's work is done. **Preliminary verdict: CreditVector today is a federation of well-governed, individually OS-quality rooms, not yet one Credit Operating System — the discipline is real inside every room this walk entered, but it has not yet been extended to the seams between them.** The #1 seam: there is no Wallet — the mechanism is real, thoroughly designed, and completely without a home an operator can visit to simply see where they stand.
