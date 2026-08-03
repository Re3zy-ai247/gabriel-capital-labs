# SIM-AGENCY-OWNER.md — Danielle Cruz, Owner Week-Slice (Sep 15–19, 2026)

Simulation Agent D, per `docs/fulfillment/simulation/SIM-BRIEF.md` (binding). Experience simulation only — no code, no wireframes, no architecture changes; the Fulfillment Platform architecture and Phase 1 Execution Plan are LOCKED. This document simulates the **designed target experience** — post-Phase-1, Wallet Runtime active (`WALLET_ENABLED`), both Download and Send paths live — per the Brief's grounding law point 1. Where the design is silent on something a scene needs, the scene renders a best-guess and marks it `GAP:` rather than inventing silently. All dollar figures are **illustrative** and line-itemed where the source docs require it.

**Protagonist:** Danielle Cruz, owner, Meridian Credit Advisors — Agency plan ($399/mo), the agency's payer principal (`WALLET-COMMITMENT-MODEL.md` §9). **Shared cast:** Marcus Webb, staff operator, runs 14 client workspaces; Elena Ruiz, one of Meridian's 14 managed clients (per `SIM-BRIEF.md`'s fixture — collection tradeline, charge-off, unrecognized inquiry). **Week:** Monday Sep 15 – Friday Sep 19, 2026, inside the fixture's Aug 12–Oct 5, 2026 window.

**Grounding set actually read for this document:** `app/agency/page.tsx`, `lib/agencyCapacity.ts`, `lib/platform/modules.ts`, `components/mission/ExecutiveQueue.tsx`, `app/dashboard/page.tsx`, `lib/missionControl.ts`, `components/AppShell.tsx`, `components/Sidebar.tsx`, `components/AgencyBar.tsx`, `lib/session.ts`, `lib/kaiStates.ts`, `lib/kaiHome.ts`, `app/letters/page.tsx`, `app/billing/page.tsx`, `lib/portalClient.ts`, `docs/fulfillment/WALLET-COMMITMENT-MODEL.md` (§§3–4, 7.5–9), `docs/fulfillment/execution/WALLET-VC-RUNTIME-PLAN.md`, `docs/fulfillment/KAI-FULFILLMENT-UX.md`, `docs/fulfillment/execution/EXECUTION-PLAN.md`, `docs/fulfillment/execution/RISK-REGISTER.md`, `docs/fulfillment/RECOVERY-ENGINE.md` (§4 row 16), `docs/fulfillment/execution/CASE-JOURNEY-RUNTIME-PLAN.md`, `.ai/ROADMAP.md` / `.ai/ROADMAP-V2.md`.

---

## Monday, September 15 — agency-altitude review

```
[Scene 1 — Agency room (Danielle's Mission-Control-equivalent) · Monday roster review · Mon Sep 15, 8:12am]
SEES: /agency — header "Meridian Credit Advisors" (app/agency/page.tsx:256); the Kai Agency Briefing card computed live from the loaded roster (:349–378); the capacity banner "Approaching capacity — 14 of 15 client workspaces in use" (:446–472, cap sourced from WORKSPACE_BASE_V3.agency = 15, lib/agencyCapacity.ts:27,33 — not a hardcoded number, per the code's own comment at :461–465); the KPI strip — Active Clients, Letters Generated, Clients Added (YTD), Accounts Deleted, each with WTD/MTD/YTD sub-labels (:382–393); the roster, "Kai's priority" sort on by default (:247–250, :411–432), overdue clients pinned to the top with rose-bordered cards (:494–529).
KAI: "I checked every follow-up clock. 3 of 14 clients need attention: 2 past the 30-day response window, 1 awaiting a first letter." (exact template, app/agency/page.tsx:356–361) — followed by the plain-English §611 explainer (:371–377).
DOES: Danielle reads the one sentence, scans the two overdue rows, doesn't act yet — a pure orientation pass before her day starts.
CHANGES: nothing — a read.
⚑ DELIGHT: the capacity banner's number is arithmetic off the exact cap the server enforces, never a marketing figure invented on the client (:461–465's own comment: "never advertise capacity the server would not honor"). ⚑ DELIGHT: one sentence, not three competing alerts — real agency-altitude anti-overwhelm, matching the Room Constitution.
⚑ FRICTION: the briefing is a headline, not a work queue — there is no drill-down from "3 of 14 need attention" other than opening each workspace one at a time. Contrast with the richer, evidence-and-citation-bearing Executive Queue a single consumer gets on their own Mission Control (components/mission/ExecutiveQueue.tsx) — that machinery has no agency-altitude equivalent (elaborated next scene).
```

```
[Scene 2 — Dashboard (Mission Control) · the "two homes" moment · Mon Sep 15, 8:15am]
SEES: The persistent left rail lists "Mission Control" (href /dashboard) above "Agency" for every account, agency owner or not (components/Sidebar.tsx:16–17,32). Danielle clicks it from habit. Her own login has no tradelines of its own — she isn't a self-directed consumer — so `hasReport` is false (lib/missionControl.ts:110; app/dashboard/page.tsx:73–92 all gate on it) and she lands on the same empty, "upload your first report" shell a brand-new solo consumer sees.
KAI: (rightly quiet on substance — there is no real fact to narrate for an account with no case; I do not invent a generic owner-facing greeting no doc specifies.)
DOES: Danielle looks at it for a second, recognizes it isn't about her business at all, clicks back to Agency.
CHANGES: none.
⚑ GAP: `CASE_JOURNEY_RUNTIME_PLAN.md`'s own closing law states Mission Control's scope precisely — "the union, across every Case a USER has open" — and each managed client's Case keys off that CLIENT's own `userId`, never the agency owner's (WALLET-COMMITMENT-MODEL.md §3.1: "Case.userId / DisputePackage.userId — no OperatorIdentity/Organization reference exists in the live schema"). There is no aggregated agency-altitude Mission Control anywhere — /agency's one sentence (Scene 1) is the entire substitute — yet the global nav still offers a room that is structurally irrelevant to an owner the moment she isn't inside a client workspace. Whether Mission Control should hide, redirect, or relabel itself for an agency owner at agency-altitude is undesigned.
```

```
[Scene 3 — Agency → client workspace · entering oversight · Mon Sep 15, 8:20am]
SEES: Danielle clicks "Open workspace" on one of the two overdue clients (app/agency/page.tsx:532–534 → /api/agency/select → router.push("/dashboard"), :207–221). The gold AgencyBar now appears on every page: "Working in [Client]'s workspace" with an "Exit to agency" control (components/AgencyBar.tsx:34–44). Mission Control, this time, is populated — this client's real case.
KAI: this client's own case-scoped recommendation takes over agency-altitude entirely — e.g., "[Client]'s round 2 window closed 4 days ago — the letters are ready to send." (illustrative, shape per lib/kaiHome.ts's recommendation contract).
DOES: Danielle reviews the case exactly as if she herself were the day-to-day operator — because, mechanically, whatever she does here now IS attributed to the operator of record.
CHANGES: WORKSPACE_COOKIE set (lib/session.ts:8), scoping every subsequent read/write to this client (lib/session.ts:120–130 currentWorkspace()).
⚑ DELIGHT: the gold bar is unambiguous and persistent — she can never lose track of whose file she is in.
⚑ SEEDS THE GAP (next two scenes): nothing on this screen, or anywhere else in the product, tells her whether SHE is the one looking at this case right now, or whether Marcus looked at it yesterday and did the actual work she's reviewing.
```

```
[Scene 4 — same client workspace · looking for "what did Marcus do here" · Mon Sep 15, 8:34am]
SEES: Danielle looks for anything resembling an activity feed or audit trail on this client's case — the Mail Center row, the Timeline. Nothing renders one: a direct search of app/ and components/ for an activity-log or audit-trail surface returns nothing except a single unrelated string (the FINAL REVIEW content-hash "proof of intent" copy inside app/mail/send/[letterId]/page.tsx, which documents one package's own content, not a feed of who-did-what). WALLET-COMMITMENT-MODEL.md §9.3 already specifies the SCHEMA pieces that would make this possible — WalletLedger.actorId / .actorKind / .onBehalfOfId as "real, Restrict-FK-when-present columns on the permanent financial ledger itself — not just an event-payload convention" — but no document proposes a screen that reads them back to an owner.
KAI: (rightly quiet — there is no computed fact to report about "who did this," and Kai never narrates around an absent feature.)
DOES: Danielle reconstructs "who did what" from memory and a Slack thread instead of the product.
CHANGES: none.
⚑ GAP (major): operator oversight has no room anywhere in the ring today. Best-guess honest rendering, if it existed: a tab on this same case workspace, or a future `/agency/activity` room, reading WalletLedger's actor fields plus a case-level event log filtered to `actorKind:"agency"`. It does not exist in any cited document. Elaborated further next scene — the gap runs deeper than a missing screen.
```

```
[Scene 5 — same client workspace · the sharper edge: FINAL REVIEW's own audit record · Mon Sep 15, 8:41am]
SEES: Danielle opens a package Marcus told her he "submitted yesterday" for a different client. She finds the one artifact in the entire architecture purpose-built to answer exactly her question: `FinalReviewConfirmation` (KAI-FULFILLMENT-UX.md §1.6) — `actorUserId` ("the REAL operator identity... never the client's id"), `onBehalfOf`, `confirmedAt`, the four persisted assertion booleans, `warningVersion`, `estimatedTotalCentsShown`. A structured, system-written compliance record, not AI prose (§1.6: "Kai never writes it, Kai may narrate that it happened").
KAI: (rightly quiet — a compliance record is read directly, never narrated by Kai.)
DOES: Danielle reads `actorUserId` on the row, expecting it to say "Marcus."
CHANGES: none.
⚑ GAP (the sharpest form of Scene 4's finding): `onBehalfOf` (which CLIENT this was for) is real, correct, and exactly what WALLET-COMMITMENT-MODEL.md §9's payer model promises. But `actorUserId` resolves to Meridian's ONE shared account id — Danielle's own login — regardless of whether she or Marcus physically clicked Submit. §9.2 names this precisely: "'agency staff' as a role distinct from 'agency owner' is not a modeled identity concept anywhere in the current schema... there is no multi-seat/staff-user model live today... this table's 'agency staff' row is necessarily identical to its 'agency owner' row (one login, one actor identity)." The single record the architecture built specifically to prove who-confirmed-what cannot answer that question for a two-person agency, because the identity it would need to record doesn't exist yet to be captured — this is a data-model absence, not merely a missing screen.
```

---

## Tuesday, September 16 — the agency wallet as payer

```
[Scene 6 — Wallet room · funding it · Tue Sep 16, 9:02am]
SEES: The wallet room, target state (WALLET_ENABLED true in this simulation, per grounding law — the flag itself is FOUNDER+LEGAL-gated OFF in the real, current build, EXECUTION-PLAN.md P7/R-02). Available balance $128.40 (illustrative, carried from the prior week). An "Add funds" action — best-guess UI: preset tiles ($25/$50/$100/$250) plus a custom-amount field. Danielle picks $500.00.
KAI: (rightly quiet through the Stripe redirect itself — checkout chrome, not a Kai moment, mirroring the existing non-Kai subscribe() handoff at app/agency/page.tsx:123–161.)
DOES: completes Stripe Checkout for `wallet_topup` (WALLET-COMMITMENT-MODEL.md §8.1 — `allow_promotion_codes: false`; amount is never client-supplied metadata).
CHANGES: `checkout.session.completed` fires; the webhook asserts `payment_status === "paid"` and `currency === "usd"` before crediting anything (§8.2, the B7/N7 fixes) → `fundWallet` inserts a `fund` row keyed `topup:<paymentIntentId>` → available becomes $628.40.
⚑ GAP: whether top-up amounts are preset, custom, or both is an explicit, still-open FOUNDER-GATE fork — "the preset-vs-dynamic top-up amount" (WALLET-COMMITMENT-MODEL.md §4.2/§16; restated unresolved in WALLET-VC-RUNTIME-PLAN.md §1.7's "two pre-existing FOUNDER-GATE forks carry forward unresolved"). This scene's UI is my best guess, not a ratified design.
⚑ DELIGHT: the integrity underneath is real, not decorative — a non-USD or unpaid session is refused outright rather than mis-credited (§8.2 guards 1–2), and a redelivered webhook can't double-fund (the `(walletId, subjectId, entryKind, attempt)` unique key, §3.2).
```

```
[Scene 7 — Wallet room · "funds available before fulfillment" · Tue Sep 16, 9:03am]
SEES: Kai confirms the top-up. Self-pay voice — Danielle IS the wallet's own principal; the on-behalf-of voice (KAI-FULFILLMENT-UX.md §2.2) is reserved for a managed CLIENT viewing their own case, never for the owner viewing her own agency's wallet.
KAI: adapted from §3.1's exact skeleton — "Your CreditVector Wallet balance is $628.40. A hold is set aside per package only once you approve it, and it becomes a final charge only once CreditVector Fulfillment accepts that package for production. Nothing is deducted before that."
DOES: Danielle moves on, trusting the number without needing to double-check it elsewhere.
CHANGES: none beyond the read.
⚑ DELIGHT: "funds available before fulfillment" isn't a marketing line here — it's structurally true. `fundWallet` has no fold-check invariant (crediting can never overdraw, §5.1); `authorizeGroup` checks funds and deficit posture before any hold is placed (§5.2, §7.5). The copy matches the mechanism exactly.
```

```
[Scene 8 — Wallet room · watching spend across clients · Tue Sep 16, 4:30pm]
SEES: A per-client spend view (my own best-guess construction, built only from fields the architecture already commits to persisting — no invented schema): today's WalletLedger rows grouped by `onBehalfOfId` → client name. Elena Ruiz — $47.32, round 2 package, settled 2:03pm. Robert Tran — $22.15, settled. Priya Nandan — $58.90, still an open hold, pending provider acceptance. James Okafor — $19.75, settled. Each row citable to its `basis` and its frozen `policyVersion` (§3.2 — "COPIED, never re-read").
KAI: "Today's holds and settlements: $148.12 across 4 clients. Priya Nandan's $58.90 is still an open hold, not yet a final charge." (adapted from §3.1/§3.2's hold/settle copy; the per-client name is the `onBehalfOfId` field's own documented purpose — "the managed client this action was performed FOR," §3.2.)
DOES: Danielle reads it like a ledger, not a bill — she can tell at a glance which lines are still reversible and which are permanent.
CHANGES: none — a read. Running available balance: $628.40 − $148.12 = $480.28.
⚑ DELIGHT: the hold/settle distinction is financially real here, not cosmetic — Priya's open hold could still be released in full if something goes wrong (§5.4), while Elena's and Robert's charges are already final.
⚑ GAP (named plainly): this screen's layout is mine, not a ratified design — no document specifies a per-client attribution view; I built the smallest honest one the schema already supports, per grounding law.
```

```
[Scene 9 — Wallet room · the balance view · Tue Sep 16, 6:00pm]
SEES: `WalletPostureView` (WALLET-COMMITMENT-MODEL.md §8.5) rendered plainly: `availableCents` → $480.28, `deficitCents` → $0, `enteredDeficitAt` → null, `curedAt` → null, `postureAsOf` → now.
KAI: (quiet — a routine, non-deficit balance is not a Kai moment; §4.1's table marks authorized/settled narration "confirmatory only.")
DOES: Danielle notes $480.28 heading into the rest of the week.
CHANGES: none.
⚑ (Neutral) — a clean, correctly-scoped, non-editorialized number; nothing to flag either way.
```

---

## Wednesday, September 17 — the deficit scene

```
[Scene 10 — (system-side) · the chargeback lands · Wed Sep 17, 6:04am]
SEES: Nothing on Danielle's screen yet. Stripe delivers `charge.dispute.created` against Meridian's Aug 25 top-up ($500.00, unrelated to anything funded or spent this week). WALLET-COMMITMENT-MODEL.md §8.3's dispute branch keys the clawback on the dispute's OWN id (`chargeback:<dispute.id>`, never the bare webhook event id) and locates the matching `fund` row via the `@@index([stripeRef])` (§3.2). `clawback()` runs inside the same anchor lock as every other operation (§4) with no floor — it may drive the fold negative (§4.1).
KAI: none yet — this is the webhook's own moment, not a narrated one. RECOVERY-ENGINE.md §4 row 16(d): "a Stripe-side chargeback/dispute on the original top-up funding... automatic clawback on the verified Stripe webhook signal — the one automatic branch in this family."
DOES: (system only.)
CHANGES: available = $480.28 − $500.00 = **−$19.72**. Posture flips to deficit — a derived condition (`foldWalletBalance().availableCents < 0`), never a stored column (§8.4).
⚑ (No operator-facing flag yet — Danielle experiences this starting next scene.)
```

```
[Scene 11 — Wallet / Kai presence · the deficit surfaces, factual · Wed Sep 17, 9:10am]
SEES: Danielle opens Kai's presence to a single, unmissable slot: `WALLET_DEFICIT` — account-wide, outranking every package-level item by design (KAI-FULFILLMENT-UX.md §4.2's priority ladder: it "outranks everything package-scoped"; §4.1: "Yes — account-wide... Not package-scoped; surfaces once at the account level, not per row").
KAI: adapted from §2.3.12/§3.4, self-pay voice (she is the principal): "Your wallet balance is showing a deficit — a payment made earlier on this account was reversed after those funds had already been used. New packages can't be authorized until this is resolved; adding funds brings the balance back to zero." Kai state `concerned` — steady, amber accent, "zero fear energy" (lib/kaiStates.ts; the same visual register KAI-FULFILLMENT-UX.md §1.2 specifies for its own WARNING block). Never the word "Failed." Never a collections tone.
DOES: Danielle reads it twice, checks $19.72 against the $500.00 dispute, and correctly realizes those are not the same number — a modest net shortfall, not a $500 hole.
CHANGES: nothing yet — still reading.
⚑ DELIGHT: this is the best-executed moment in the whole week. "Factual, no shame framing" is a real, written law here (§3.4: "never 'you owe us,' never a collections register"), and the copy plainly honors it — it states a fact and a cure, nothing more.
⚑ FRICTION: the notice itself never says whose top-up was disputed or when — she has to reconstruct that from memory, since `WALLET_DEFICIT` is deliberately account-scoped rather than an incident report (§4.1's table).
```

```
[Scene 12 — client workspace (Wanda Kessler) · the blast radius, felt · Wed Sep 17, 10:15am]
SEES: Marcus — sharing Meridian's one login, per the fixture — tries to Approve a brand-new round-1 package for Wanda Kessler ($31.20 illustrative), a client with zero connection to the disputed charge. `authorizeGroup`'s FIRST guard, before any amount is even compared, is `availableCents < 0` → refuses `wallet_in_deficit`, unconditionally (WALLET-COMMITMENT-MODEL.md §7.5: "even a one-cent authorize is refused while in deficit... independent of the requested amount"). Meanwhile, Priya Nandan's Tuesday-still-open $58.90 hold settles normally this same morning — settling/releasing EXISTING holds stays permitted in deficit (§8.4: "a deficit must not strand in-flight fulfillment").
KAI: on Wanda's blocked screen, adapted from §2.3.12's agency-directed phrasing: "New fulfillment holds for your agency are paused right now — your CreditVector Wallet needs a balance correction before we can continue. This doesn't affect your case history or dispute letters."
DOES: Danielle now understands the real shape of the risk she accepted on the Agency plan: one reversed charge, on one client's funding history, three weeks old, just froze new work for all 14 clients — 13 of whom have nothing to do with the dispute.
CHANGES: no new holds can be placed anywhere in the agency; the existing pipeline (settles/releases already in flight) keeps moving.
⚑ FRICTION (the disclosed risk, lived): exactly `RISK-REGISTER.md` R-27 / WALLET-COMMITMENT-MODEL.md §8.3–§8.4's N4 disclosure — "one bad dispute freezing an agency's whole book," carried forward "not scope-narrowed this cycle (Founder ruling: no redesign)." Living it: there is no single screen enumerating WHICH of her 14 clients are actually blocked right now — `WALLET_DEFICIT` is account-level, not an impact list (§4.1) — she only learns it client-by-client, the way she just did with Wanda.
```

```
[Scene 13 — Wallet room · curing it · Wed Sep 17, 10:22am]
SEES: The same "Add funds" surface as Tuesday. Danielle adds $100.00.
KAI: the `fund` call always succeeds — no fold-check invariant applies to funding (§5.1) — and once the fold crosses back to non-negative, the cured transition fires (§8.4: "'Cured' names the event... detected by cureDeficit's pre/post comparison, §5.7"): "Your wallet balance is back to normal — $80.28 available. New fulfillment holds can resume." Kai state moves toward `good-news` — "states the fact, then next watch-item," never a celebration (lib/kaiStates.ts).
DOES: Danielle tells Marcus to retry Wanda's package.
CHANGES: posture deficit → normal (§8.4: "'Cured' is the TRANSITION label, not a third resting state"); Wanda's Approve, retried, now succeeds.
⚑ DELIGHT: the cure is exactly as simple as the deficit copy promised — one top-up, no support ticket, no manual unlock from CreditVector required.
⚑ FRICTION (residual, not closed by the cure): the $500 dispute itself is still just an open dispute on Meridian's books — nothing here settles whether that money is gone for good. Carried into Thursday.
```

```
[Scene 14 — Agency room · operations resume, confirmed · Wed Sep 17, 10:30am]
SEES: Wanda's package clears Approve, proceeds toward the FINAL REVIEW gate (KAI-FULFILLMENT-UX.md §1.1's corrected chain — Approve, then the hold, then FINAL REVIEW immediately before Submit). Danielle checks the roster — nothing on the client side (case history, letters, dispute content) was ever touched; the deficit copy explicitly said so ("This doesn't affect your case history or dispute letters," §2.3.12) and it held.
KAI: (quiet — routine resumption, nothing new to narrate.)
DOES: Danielle moves on with her day.
CHANGES: business as usual.
⚑ DELIGHT: the strict separation between "your fulfillment MONEY is paused" and "your CLIENTS' CASES are untouched" held throughout the entire episode — the deficit read as "needs a top-up," never as "something broke."
```

---

## Thursday, September 18 — accounting visibility, and the future rooms

```
[Scene 15 — Wallet room · trying to prove it for her books · Thu Sep 18, 11:00am]
SEES: Danielle looks for a wallet statement, a CSV export, or a settled-vs-held summary she could hand to her bookkeeper — something to reconcile Wednesday's episode. A direct check of WALLET-COMMITMENT-MODEL.md, WALLET-VC-RUNTIME-PLAN.md, and KAI-FULFILLMENT-UX.md turns up no export/report/statement/CSV surface anywhere — none of those words describe a designed feature in any of the three documents. By contrast, her $399/mo Agency SUBSCRIPTION — a wholly separate thing from the wallet (WALLET-VC-RUNTIME-PLAN.md §2.6's coexistence table) — already has real, live, Stripe-hosted invoice history, reachable today through the billing portal (app/billing/page.tsx; lib/portalClient.ts:17 → POST /api/stripe/portal).
KAI: (rightly quiet — nothing is built to narrate, and Kai neither apologizes for nor invents a missing feature.)
DOES: Danielle opens the billing portal instead and downloads her subscription invoices — that part works — and gives up on getting an equivalent wallet statement.
CHANGES: none for the wallet; a real download for the subscription side.
⚑ GAP (major, load-bearing for "accounting visibility"): the ledger is genuinely provable at the DATA layer — Restrict FKs, fold-derived, every entry keyed and basis-tagged (§3.2) — but nothing turns that provability into something an owner can hand to an accountant. A real completeness gap, not a polish item.
```

```
[Scene 16 — Wallet room · what she CAN actually prove, named honestly · Thu Sep 18, 11:15am]
SEES: Danielle settles for what does exist: the per-client spend view from Scene 8 (her own best-guess construction, not a designed report), the `FinalReviewConfirmation` record per package (KAI-FULFILLMENT-UX.md §1.6 — price shown, warning version, timestamp, the four assertions), and the balance view from Scene 9. Together these prove settled-vs-held for any ONE package she opens — not as an aggregate.
KAI: (quiet — assembling her own books from these pieces is Danielle's own bookkeeping work, not a fact Kai computed.)
DOES: she manually tallies four packages' numbers into her own spreadsheet.
CHANGES: none in-product; a workaround outside it.
⚑ GAP (continuation of Scene 15): "provable, per package, one at a time" is not the same claim as "exportable for the books." Naming both halves honestly rather than treating the ledger's mere existence as if it had already solved the export problem.
```

```
[Scene 17 — Sidebar / "More" drawer · Growth Network, looked for and not found · Thu Sep 18, 2:00pm]
SEES: Danielle checks the sidebar and the "More" drawer (components/Sidebar.tsx) for anything resembling Growth Network. It isn't there — and unlike Marketplace, it has no row at all in the platform-module registry (lib/platform/modules.ts's `PLATFORM_MODULES` — the file's own header names this table "the single index... a module that skips the spine is a bolt-on; don't"). WALLET-VC-RUNTIME-PLAN.md §3.2 confirms directly: "No existing architecture document defines 'Growth Network' — it appears only in the Brief as a Founder-named future responsibility... funding-source rules are undetermined."
KAI: (quiet — nothing to narrate about a concept with no capability key, no flag, no shell.)
DOES: Danielle doesn't find it, shrugs, keeps working — nothing anywhere promised or teased it.
CHANGES: none.
⚑ DELIGHT (a quiet one): the honesty here is by omission, and it works — no fabricated "coming soon" card exists for a concept the architecture itself says isn't real yet. The module registry's own discipline holds even for something that isn't in the registry at all.
⚑ GAP (named, not fabricated): whenever Growth Network is eventually surfaced to owners, it has no precedent to inherit yet — not even Marketplace's dormant treatment (next scene), which it hasn't earned.
```

```
[Scene 18 — Modules room · Marketplace, honestly locked · Thu Sep 18, 2:05pm]
SEES: Today's actual mechanism (`moduleShellEnabled()`, lib/platform/modules.ts:44–46) 404s this dormant shell for any non-admin viewer regardless of curiosity — so this scene simulates the eventual owner-facing TARGET per grounding law, not what Danielle would see if she clicked through today. Best-guess honest target: a visible-but-locked card following the shipped "(soon)" ghost-link precedent already used elsewhere in the product (app/letters/page.tsx:386–388,615–617 — de-emphasized `btn-ghost text-slate-400`, an honest tooltip, no fake countdown) rather than an invisible 404: "Kai Marketplace — not yet available." Tooltip: "Entitlement-gated inventory for your clients is planned; nothing here is live yet, and nothing you click today starts a waitlist." Status `dormant`, gate "kernel ABI freeze + partner PDP" (lib/platform/modules.ts:32 — an internal 10% completion estimate, never shown to Danielle).
KAI: (quiet — a locked room is operator-chrome, not a Kai narration moment, extending FINAL REVIEW's own "never inside a Kai-labeled panel" discipline sensibly to other locked surfaces.)
DOES: Danielle clicks it once, reads "not yet," doesn't click again.
CHANGES: none.
⚑ DELIGHT: it doesn't feel broken — no dead link, no console error, no fabricated waitlist count, consistent with the registry's own rule ("no regulated functionality ships here — shells carry no advice, no claims").
⚑ GAP (small, named): today's actual mechanism is admin+flag-gated invisibility (an engineering/QA posture), not a user-facing "coming soon" posture. This scene assumes the Founder eventually chooses the visible-locked pattern already precedented elsewhere; that choice isn't ratified for Marketplace specifically.
```

---

## Friday, September 19 — team operations and close

```
[Scene 19 — Settings · wanting to add a second staff seat · Fri Sep 19, 9:30am]
SEES: Prompted directly by this week (she'd like an actual answer to "who did what"), Danielle looks in Settings for team/seat management. `STAFF_USER_LIMIT` (lib/agencyCapacity.ts:35–42) already declares Agency tier's seat cap as **1** beyond herself (Agency Pro: 3, Scale: 5) — except the comment on that exact constant says the quiet part: **"DECLARATION-ONLY: enforcement depends on the dormant Team Foundation (multi-seat) and is NOT implemented here."** config/capabilityMatrix.ts:143 imports the identical number into the capability matrix, equally unenforced. No seat-invite flow, no Marcus-specific login, exists anywhere in the product.
KAI: (quiet — account administration, not a case fact.)
DOES: Danielle can't do it. She keeps sharing her own password with Marcus, exactly as before this week.
CHANGES: none.
⚑ GAP (major — closes the loop opened in Scenes 4/5): the number "1 staff seat" already exists in code, and the pricing story implicitly promises it (Agency Pro's "3," Scale's "5" imply Agency's "1" is a real, provisionable thing) — but the feature behind that number (invite a person, give them their own login, see their own attributed actions) does not exist. Same root cause as the audit-trail gap, reached from the provisioning side instead of the visibility side: there is no Marcus in the system, so there is nothing to invite, nothing to attribute, and nothing to audit — for the identical underlying reason.
```

```
[Scene 20 — Agency room · Friday close · Fri Sep 19, 4:45pm]
SEES: The KPI strip once more (app/agency/page.tsx:382–393) — Active Clients 14, Letters Generated (WTD/MTD/all-time), Clients Added (YTD), Accounts Deleted 0/0/0. The roster, sorted by Kai's priority, shows every client back inside their response window — the two that were overdue Monday got their round-2 packages out this week. Wallet: normal posture, $53.88 available (illustrative — one more package settled Thursday), no deficit.
KAI: exact template, the `needsWork === 0` branch — "I checked every follow-up clock today. All 14 clients are inside their response windows. Nothing due yet — I'll keep watching." (app/agency/page.tsx:363–369)
DOES: Danielle reads it, confirms the wallet number is still positive, closes the laptop.
CHANGES: none — a calm end, not a new action.
⚑ DELIGHT: the Room Constitution's "metrics are context, never the work" law (SIM-BRIEF grounding law §3) working exactly as intended — no fireworks, no gamified streak, no "great week!" banner. For an owner, "nothing due yet" IS the win condition, and the product says exactly that and nothing more.
⚑ FRICTION (a closing echo): Wednesday's episode — a stranger's dispute on a three-week-old charge freezing her whole book for roughly an hour — leaves no visible trace anywhere on this Friday screen. That is correct behavior (the deficit is genuinely resolved, and dwelling on it would violate the no-shame/no-alarm law), but it also means the one thing an owner's "week in review" might most want to answer — did anything threaten continuity this week, and is it truly closed — is not a computed fact anywhere, Kai or otherwise. She knows it's fine only because she personally remembers curing it.
```

---

## Emotional-design scorecard (scored for the OWNER)

| Dimension | Score | One sentence |
|---|---|---|
| Confidence | 3/5 | Real trust in every number she can see (roster, capacity, wallet balance); real doubt about whether the system can honestly represent her own two-person team at all. |
| Momentum | 4/5 | One same-day speed bump (the deficit window) in an otherwise unbroken week — the cure was a single top-up, never a support ticket. |
| Trust | 3/5 | Every word Kai says is true and calmly delivered, including the deficit; the silence about what Kai can't yet see (staff attribution) is the harder trust problem, because it surfaces only when she goes looking for it. |
| Progress | 4/5 | The KPI strip and the wallet's running total both tell a clean, legible, honest story of a week that moved forward. |
| Clarity | 3/5 | Crystal clear on money mechanics (hold vs. settle, deficit vs. cure); foggy on the two-person org chart actually running the business. |
| Motivation | 4/5 | A product that neither panics with her (the deficit) nor performs enthusiasm at her (Friday close) is one she can keep using five days a week without fatigue. |
| Completion | 2/5 | Funding, spending, curing a deficit, reading a roster — all complete. Seeing her own staff's work, exporting her books, provisioning a second seat, finding Growth Network — none of it is completable today. |

## Orientation verdict — "always knows where they are / what happened / what happens next?"

**Yes, at the money-mechanics and roster-health layer.** Danielle always knows her balance (fold-derived, never stale), her capacity (14/15, arithmetic off the real cap), her roster's health (one sorted list, one sentence), and the single next action Kai recommends. The FINAL REVIEW chain, the hold/settle/release vocabulary, and the deficit-and-cure cycle are all legible, truthfully narrated, and never alarmist.

**No — or at best partially — at the organizational layer.** She knows WHAT happened (a package moved, a dispute landed, a deficit cleared) but not WHO at her own agency made it happen, and, in the moment, not the full list of WHAT ELSE is blocked by a shared condition (the deficit's blast radius has no impact-enumeration view). Two of the week's five biggest findings (staff identity, seat provisioning) are the same missing foundation seen from opposite ends.

**Verdict:** OS-grade for a single owner and her wallet; page-grade — arguably blanker than a page, since there is nothing to click at all — for anything that requires representing more than one human working the business. The illusion of "one Credit Operating System" holds completely up to the edge of Meridian's org chart, and stops exactly there.

## Top 5 friction/gap items, ranked

1. **No distinct staff/operator identity exists at all.** Marcus and Danielle share one login; "agency staff" is not a modeled identity anywhere in the schema (WALLET-COMMITMENT-MODEL.md §9.2, named gap). This is the root cause of items 2 and 5 below, not a separate defect.
2. **No operator-oversight/audit-trail UI anywhere**, independent of item 1 — nothing in the product renders `AdminAuditLog` or any case/agency activity feed; even the one purpose-built compliance record (`FinalReviewConfirmation`, KAI-FULFILLMENT-UX.md §1.6) cannot name which human at the agency acted (Scenes 4–5).
3. **The agency-wide deficit blast radius**, disclosed-not-eliminated (WALLET-COMMITMENT-MODEL.md §8.3–§8.4's N4; RISK-REGISTER.md R-27), compounded by the absence of any "who's blocked right now" impact view — she learns it client-by-client (Scene 12).
4. **No accounting export/reporting for wallet activity** — no CSV, no statement, no settled-vs-held aggregate — sharply contrasted by the subscription side's real, live, Stripe-hosted invoice history (Scenes 15–16).
5. **Team/seat management is declaration-only.** `STAFF_USER_LIMIT` exists in code and is implied by the pricing ladder, but there is no invite flow, no enforcement, and — per item 1 — no actual second identity to provision in the first place (Scene 19).

**Also noted, not top-5:** Mission Control has no agency-altitude equivalent and still appears in nav for an owner it doesn't serve (Scene 2); Growth Network has zero registry presence, rawer even than Marketplace's dormant shell (Scene 17); the wallet top-up's preset-vs-custom-amount question is an explicit, unresolved FOUNDER-GATE fork (Scene 6); Friday's close computes no "was continuity threatened this week" fact even though Wednesday's episode was the week's single biggest event (Scene 20).
