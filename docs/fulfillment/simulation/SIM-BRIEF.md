# Phase -0 — Founder Operator Journey Simulation Brief (Program Director)

Experience simulation ONLY — no code, no wireframes, no architecture changes. The Fulfillment Platform architecture and Phase 1 Execution Plan are LOCKED; this simulation validates the OPERATOR EXPERIENCE they describe, as the final Founder approval gate before implementation. Think Pixar storyboards meet production software. The question every artifact serves: does CreditVector feel like **"The Credit Operating System"** — or a collection of credit repair pages?

## Grounding law (non-negotiable)
1. Simulate the **designed target experience** (post-Phase-1, both Download and Send paths live) as specified in the locked docs. Cite the doc/§ that grounds each scene's mechanics. Where the design is SILENT on something the scene needs, do NOT invent silently — render your best-guess experience AND mark it `GAP:` (that discovery is the simulation's job).
2. Source set: `docs/fulfillment/` (CREDITVECTOR-FULFILLMENT-ENGINE-V1, B-MAIL-CENTER-EVOLUTION, KAI-FULFILLMENT-UX [FINAL REVIEW gate, failure-translation catalog, money narration incl. on-behalf-of voice], D-KAI-EXPERIENCE, RECOVERY-ENGINE [17-scenario matrix], WALLET-COMMITMENT-MODEL §9 [payer model], FULFILLMENT-COMMITMENT-BOUNDARY) + `docs/fulfillment/execution/` (CASE-JOURNEY-RUNTIME-PLAN [9-node spine, Download/Send sub-journeys], MAIL-CENTER-EVOLUTION-PLAN, EXECUTION-PLAN) + the REAL product rooms read-only (app/dashboard [Mission Control + ExecutiveQueue "Do this first"], app/agency, app/mail + send wizard, app/journey, app/letters, app/onboarding, components/kai/* [KaiPresence, KaiWhy, RecommendationIntel], lib/kaiHome.ts [anti-overwhelm], lib/kaiStates.ts [16-state catalog + emotional-range law], lib/compliance.ts, components/AppShell.tsx).
3. The Room Constitution governs every room: current work · current state · recommended action · Kai guidance · evidence · timeline; metrics are context, never the work. Every room must answer **"What should I do next?"**

## Kai voice law (every line of dialogue must pass ALL of these)
- First person, calm, specific, basis-carrying ("…because the §611 window on this letter closed Tuesday"). One recommendation at a time (anti-overwhelm; "quiet is allowed" — no manufactured urgency).
- Emotional range: calm · curious · attentive · focused · pleased · concerned. NEVER mania, alarm, sarcasm, celebration-about-money. Delivery = pleased; failure = concerned + a preserved path forward; never the word "Failed".
- CROA bar (the compliance scrubber governs): no outcome promises, no "will be deleted" (say "should be deleted if it cannot be verified"), no score promises, no §609/Metro-2 myths, educational framing.
- Vendor Opacity: never LetterStream, USPS API names, provider jargon. It is always "CreditVector Fulfillment", "the print-and-mail provider", "USPS tracking" only as consumer-visible mail language.
- Money truth: authorization = "a hold, not a charge"; settlement at provider acceptance; "your balance was restored" only after a real release; §611 clock anchored at **receipt** (never "mailed = clock started"). On-behalf-of voice when an agency pays for a managed client ("your agency placed a hold…").
- The FINAL REVIEW warning before Send is prominent and honest: once the provider accepts the package for production it cannot be reversed.

## Shared cast + fixture scenario (ALL agents use exactly these; fictional, no real persons/creditors)
- **Jordan Avery** — new solo consumer operator (Agent A's protagonist). Plan: Professional. Uploads their own 3-bureau report Aug 12, 2026.
- **Meridian Credit Advisors** — fictional agency on the Agency plan. Owner **Danielle Cruz** (Agent D's protagonist). Staff operator **Marcus Webb** (Agent B's protagonist) runs 14 client workspaces.
- **Elena Ruiz** — Meridian's managed client (Agent C's protagonist). Report shows: a collection tradeline from "Northline Recovery Group" (original creditor "Apex Card Services", $1,842, disputed as not-mine/unverifiable), a charge-off "Meridian Bank Card" ($3,205, re-aging indicators), and a hard inquiry she doesn't recognize. (Fictional names; keep dispute language educational.)
- Money figures are ILLUSTRATIVE and always line-itemed on screen (base print + pages + certified + electronic return receipt + service fee) per the pricing-transparency law; label totals "illustrative".
- Dates: Aug 12 – Oct 5, 2026. The wallet is funded by: Jordan (self-pay) / Meridian's agency wallet (pays for Elena — on-behalf-of voice applies).

## Scene format (uniform, so the merge reads as one film)
```
[Scene N — Room · Journey node · date]
SEES: what is concretely on screen (grounded; cite doc/§ or file)
KAI: "…" (dialogue per the voice law; omit when Kai is rightly quiet)
DOES: the operator's action
CHANGES: state/timeline/wallet result the operator perceives
⚑ FRICTION / GAP / DELIGHT: inline annotation (feeds the Opus review)
```
End every simulation with: (a) an emotional-design scorecard (confidence, momentum, trust, progress, clarity, motivation, completion — each 1–5 + one sentence), (b) the "always knows where they are / what happened / what happens next?" verdict, (c) your top 5 friction/gap items ranked.

## Assignments (each writes ONLY its own file under docs/fulfillment/simulation/; no commits)
- **A — `SIM-NEW-OPERATOR.md`** (Jordan): first login → Kai greeting → Mission Control empty state → onboarding → upload report → Kai analysis + education → first recommendation → first Dispute Package (Review chain steps 1–7) → **Download path first success** (self-mail) → then funds wallet → first **Send** (hold → FINAL REVIEW → submit → acceptance → tracking → delivered → receipt archived) → first waiting period. The honest interim (Send available in the sim's target state) + first-success emotion.
- **B — `SIM-ACTIVE-OPERATOR.md`** (Marcus at Meridian): a realistic Tuesday. Mission Control triage ("Do this first"), 14 clients, interruptions (a client calls mid-flow; a delivery lands; a rejection needs address correction), priorities across Case work / Mail Center queue / responses received / round-2 readiness; workspace switching (AgencyBar context); how the OS keeps him oriented through interruptions. Include one wallet-low moment (agency wallet) and one FINAL REVIEW submission.
- **C — `SIM-CLIENT-JOURNEY.md`** (Elena, as her case flows through EVERY canonical node): Client Added → Report Uploaded → Kai Analysis → Recommendations → Dispute Package → Review → Approval → Wallet Reservation (agency pays — on-behalf-of) → Final Review → CreditVector Fulfillment → Provider Acceptance → Production → Tracking → Delivered → Return Receipt → Waiting Period → response received → Round 2 begins → completion + evidence file. Show exactly what the OPERATOR sees at each node (and where Elena herself sees anything, if the design gives clients a view — if silent, GAP it).
- **D — `SIM-AGENCY-OWNER.md`** (Danielle): agency dashboard morning review; operator oversight (Marcus's work); the agency wallet (funding, line-item spend, the deficit posture if a chargeback hits — one scene); accounting visibility (what she can prove/export); Growth Network + Marketplace as clearly-labeled FUTURE rooms (per the roadmap; do not simulate features that aren't designed — show how the OS presents not-yet-available surfaces honestly, GAP if undesigned); team operations; Mission Control at agency altitude.
- **E — `SIM-SYSTEM-EXPERIENCE.md`**: the connective tissue. Walk the full room ring (Mission Control → Client → Dispute Package → Mail Center → Timeline → Wallet → [Marketplace] → Agency → Mission Control) as ONE session; evaluate EACH room against the Room Constitution's six presentations + "what should I do next"; evaluate every TRANSITION (does moving between rooms feel like one OS — shared state, carried context, no re-orientation cost — or like web pages?); the edge-case chain as an experience (manual mailing → CV Fulfillment → wallet low → wallet sufficient → provider rejection → address correction → retry → delivery → response → Round 2); verdict inputs for "OS vs pages" with the exact seams where the illusion breaks.

After A–E land: the Program Director writes the merged FOUNDER-WALKTHROUGH + JOURNEY-MAP, then ONE bounded Opus experience review (confusion, friction, Kai over-talk, cognitive load, dashboard-feel, page-feel transitions → verdict + where-the-illusion-breaks), then ROOM-RECOMMENDATIONS + the Founder package. STOP — no implementation; this gate precedes Phase 1.
