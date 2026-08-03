# SIM-ACTIVE-OPERATOR.md — Marcus Webb's Tuesday (Agent B)

Experience simulation only, per `docs/fulfillment/simulation/SIM-BRIEF.md` — no code, no wireframes. Protagonist: **Marcus Webb**, staff operator at **Meridian Credit Advisors** (fictional agency, Agency plan, $399/mo, owner **Danielle Cruz**). 14 active client workspaces. Fixture date: **Tuesday, September 15, 2026**. Shared-cast client: **Elena Ruiz** (Northline Recovery Group collection, $1,842, not-mine/unverifiable; Meridian Bank Card charge-off, $3,205, re-aging indicators; one unrecognized hard inquiry). Two other roster clients appear as light texture, invented for this file only, no real persons: **Priya Shah** (the mid-morning phone call) and **Dwayne Ferris** (the rejected-address package). All money figures are illustrative and line-itemed per the pricing-transparency law (SIM-BRIEF.md grounding law 2).

This file simulates the **designed target experience** (post-Phase-1, both Download and Send live), grounded against the locked docs and the real product rooms. Every scene cites its source. Where the design is silent, I render a best-guess and mark it `GAP:` rather than invent silently.

---

## Scene 1 — Home, 7:52 AM, before login

SEES: Marcus, on his own laptop at Meridian's small office, opens creditvector.app in a browser tab already pinned from yesterday. Nothing on screen yet — this is the moment before Kai exists for him today.

KAI: *(nothing yet — no session)*

DOES: Types his (Meridian's shared agency) credentials, or the tab auto-resumes a live session.

CHANGES: Session begins.

⚑ **GAP (foreground, load-bearing for the whole day):** There is no operator login distinct from the agency's own login. `WALLET-COMMITMENT-MODEL.md` §9.2 states this in exact terms: *"'agency staff' as a role distinct from 'agency owner' is not a modeled identity concept anywhere in the current schema — `lib/session.ts`/`lib/entitlements.ts` resolve an agency to exactly one `User` row (`isAgency: true`); there is no multi-seat/staff-user model live today... this table's 'agency staff' row is necessarily identical to its 'agency owner' row (one login, one actor identity)."* `lib/agencyCapacity.ts`'s `STAFF_USER_LIMIT.agency = 1` confirms the product has *declared* one staff seat for the Agency tier — but the same file's own comment calls this **"DECLARATION-ONLY: enforcement depends on the dormant Team Foundation (multi-seat) and is NOT implemented here."** So "Marcus" — for everything CreditVector's session/audit layer can see today — either IS Danielle's login, or is a second person who was handed the same password. Every subsequent scene in this file narrates Marcus as the brief's fixture cast requires; every wallet-ledger entry his actions produce will carry `actorKind: "agency"` and `actorId` = Meridian's one `User.id` (`WALLET-COMMITMENT-MODEL.md` §9.2 spend-authority table) — there is no way for the system to later prove it was Marcus and not Danielle who clicked Approve. This is the seed of the day's single biggest gap (Scene 10).

---

## Scene 2 — Mission Control, 7:53 AM — the login destination problem

SEES: The product's own doc comment says the destination: `app/dashboard/page.tsx:28` — *"Mission Control (Sprint XIII) — the first screen after login and Kai's operating dashboard."* Marcus does not go there. He types `/agency` directly.

KAI: *(none — this is Marcus's own habit, not a Kai moment)*

DOES: Navigates straight to the Agency roster (`app/agency/page.tsx`), skipping Mission Control entirely.

CHANGES: Nothing state-side; this is a learned workaround.

⚑ **GAP.** `getMissionControl(user.id, user)` (`app/dashboard/page.tsx:41`) and every engine `assembleIntelligence`/`assembleMissions`/`buildRoadmap`/`buildBuilder` that feeds it key off `user.id` — and outside a selected client workspace, `user` resolves to Meridian's own agency account, which has no credit report, no tradelines, no letters of its own. `ExecutiveQueue` itself only renders `{data.hasReport && <ExecutiveQueue .../>}` (`app/dashboard/page.tsx:73`) — for the agency account itself, `hasReport` is false, so Mission Control would show Marcus the brand-new-user empty state ("upload your credit report") — nonsensical for a staff operator whose whole job is other people's cases. Marcus has learned, the way real users learn real workarounds, to never open the front door the product built for him. This is not dramatized as confusion in this file (an experienced operator wouldn't relearn it daily) — it's flagged because it means the product's own "first screen after login" doesn't serve the agency-staff persona at all.

---

## Scene 3 — Agency roster, 7:54 AM — Mission Control triage at operator altitude

SEES: `app/agency/page.tsx`'s loaded view: agency name "Meridian Credit Advisors," the Kai Agency Briefing card (`:350-379`), four KPI cards (`:381-393`: Active Clients, Letters Generated, Clients Added YTD, Accounts Deleted), and the roster below (`:474-550`). Capacity banner (`:446-473`): *"Approaching capacity — 14 of 15 client workspaces in use"* (`WORKSPACE_BASE_V3.agency = 15`, `lib/agencyCapacity.ts:27`) with a de-emphasized link to Agency Pro, "coming soon." Marcus toggles "Kai's priority" sort (`:411-432`, already the default).

KAI: *"I checked every follow-up clock. 4 of 14 clients need attention: 3 past the 30-day response window, 1 awaiting a first letter."* (`app/agency/page.tsx:356-361`, live-computed, not canned) *"Bureaus generally owe a reinvestigation response within about 30 days under FCRA §611 — flagged clients are ready for their next round."* (`:372-373`)

DOES: Scans the sorted roster — 4 rose-flagged rows floated to the top by `rank(c)` (`app/agency/page.tsx:247-249`: `needsAttention` first, then no-letter-yet, then everyone else; ties broken by `daysSince` descending, oldest-overdue-first). Elena Ruiz is one of the 4. Marcus decides to open her first — not because the roster told him to, but because he remembers her Round 1 bureau response logged "verified" last week, which he judges the highest-value thing to act on today.

CHANGES: Nothing yet — this is pure triage, no state changed.

⚑ **GAP — this is the scene the Brief asked me to test hardest.** The anti-overwhelm law (`lib/kaiHome.ts:60-67`: *"ONE recommendation at a time... picked by fixed priority"*) is real and load-bearing **inside one workspace** (Scene 5 shows it working exactly as designed for Elena). It does **not** survive the jump to 14 clients. The roster gives Marcus a **sort**, not a **recommendation**: `rank()` is a binary bucket (needsAttention / no-letter / other) plus a same-bucket tiebreak on `daysSince` — there is no `basis`-carrying "open Elena first, because—" the way `ExecutiveQueue`'s `HeadTile` gives one on `/dashboard` (`components/mission/ExecutiveQueue.tsx:38-39`, "Do this first" / `today.requiredAction`). `CASE-JOURNEY-RUNTIME-PLAN.md` §1.4 states this precisely: *"Mission Control is not a tenth node — it has no single stage of its own. Its Executive Queue... is the union, across every Case a user has open, of each Journey's Next-Recommendation output."* — **a union across ONE user's cases**, and an agency's 14 managed clients are 14 separate `User` rows, never unioned anywhere. The same document's own execution-sequencing table names the fix and explicitly defers it: *"Mission Control convergence... Not in the Program Brief's P1–P10. Named extension point only — FOUNDER-GATE future decision, explicitly out of this program's v1 scope."* `B-MAIL-CENTER-EVOLUTION.md` §5 independently confirms the same boundary from the Mail Center side: *"a cross-client 'book of business' view... is out of scope for this document — the `AgencyBar` precedent is one-client-workspace-at-a-time by design."* So: at 14 clients, "what should I do first" is answered by Marcus's own memory and judgment, not by Kai. The system knows Elena needs *a* look; it does not know her verified-response reopening is a higher-leverage move today than, say, chasing Dwayne Ferris's rejected package (Scene 16) or Priya Shah's no-letter-yet flag. Today Marcus happens to guess right because he remembers the case. That won't scale past 14, and it's already asking him to hold context the product could carry for him.

---

## Scene 4 — Entering Elena's workspace, 7:58 AM — the switch

SEES: Marcus clicks "Open workspace" on Elena's row (`app/agency/page.tsx:532-534`). A brief `busy` spinner, then `router.push("/dashboard")` (`:219`). The AppShell reloads with a new top band: `components/AgencyBar.tsx:34-44` — a gold-bordered bar, *"Working in **Elena Ruiz**'s workspace"* with an "Exit to agency" control.

KAI: *(none rendered yet — the page is still loading)*

DOES: Waits out the reload; reads the gold bar to confirm the switch landed correctly.

CHANGES: `POST /api/agency/select` writes the `WORKSPACE_COOKIE` (`"gcl_client"`, `B-MAIL-CENTER-EVOLUTION.md §5`); every subsequent server component and route now resolves `currentUser()` to Elena, not Meridian.

⚑ **DELIGHT.** This is the one identity-orientation problem the product solves well. The gold bar is unambiguous, present on every page (`components/AppShell.tsx:25`, rendered globally, not opt-in per room), and the exit path is one click. Whatever confusion exists about *what Kai knows* across a switch (Scene 13 finds real gaps here), Marcus is never confused about *whose file he is looking at*.

---

## Scene 5 — Elena's Mission Control, 7:59 AM — the per-workspace "Do this first" working exactly as designed

SEES: Now that `hasReport` is true for Elena, the full stack renders: `MissionControl`, then `ExecutiveQueue` (`app/dashboard/page.tsx:70-73`). The "Do this first" tile (`components/mission/ExecutiveQueue.tsx:38-39`) is populated. `Case Memory` (`lib/kaiSeen.ts`) also fires for the first time today, scoped correctly now that `user.id` = Elena's id: a "while you were away" summary since Marcus's last visit to *her* workspace specifically.

KAI: *"A response came back "verified" — that isn't the end of the road. Northline Recovery Group verified the item without saying how. Under FCRA §611(a)(7) you can request their method of verification and escalate to Round 2."* (`lib/kaiHome.ts:74-81`, exact rule #1 branch — `pickRecommendation()`'s highest-priority case) Basis line, shown on expand: *"Rule: "verified" response with no follow-up round on file (letter to Northline Recovery Group)."*

DOES: Opens the card. Confirms this is exactly what he remembered from the roster. Clicks through.

CHANGES: Nothing written yet — a read.

⚑ **DELIGHT.** This is the anti-overwhelm law working exactly as documented: one recommendation, a real statute citation, a stated rule, no manufactured urgency. Compare Scene 3 — the same law, one level up, has no equivalent mechanism. The gap is not that Kai is wrong here; it's that this correctness stops at the workspace boundary.

⚑ **Kai-voice calibration note:** for a professional who has read this exact §611(a)(7) explanation a hundred times across other clients, the copy is still first-time-user-complete (it re-explains the statute inline). Marcus doesn't mind here — it's short, and it's the actual next action — but this is the first of several places (Scenes 6–7) where the same completeness becomes a real cost.

---

## Scene 6 — Package Review, steps 2–3, 8:03 AM — Kai Summary + Recommended Disputes

SEES: The evolved Package Review chain (`docs/fulfillment/execution/MAIL-CENTER-EVOLUTION-PLAN.md` §1.7, §3.1; `B-MAIL-CENTER-EVOLUTION.md` §3.1) — Client (nothing to render, already resolved by the AgencyBar context) → Kai Summary (`components/kai/KaiSummary.tsx`, PROPOSED) → Recommended Disputes. The `RecommendationIntelPanel` (`components/kai/RecommendationIntel.tsx`) shows: *"Why I recommend Method-of-verification demand"* with a "Strong grounds" confidence pill, "Why this strategy," "Why this recipient," "Why now," "Expected timeline," and an "Alternatives considered" list (a Round-2 escalation vs. a fresh FDCPA §1692g validation angle on Northline directly).

KAI: *"Northline verified without disclosing method — under §611(a)(7) I can demand it. Alternative considered: dispute this collection under FDCPA §1692g as a fresh validation request — not recommended right now, since Northline hasn't attempted to collect further since your last letter."* (`components/kai/RecommendationIntel.tsx:34-48` shape)

DOES: Marcus skims — he already agrees with the primary pick from Scene 5 — and clicks past without reading the alternatives panel in full.

CHANGES: Selection carries forward to the letter draft.

⚑ **FRICTION.** There is no "I've got this, skip ahead" for an operator on his 200th package. The 9-step chain (`docs/fulfillment/B-MAIL-CENTER-EVOLUTION.md` §3.1 table) renders identically for Marcus and for a first-time consumer like Jordan (Agent A's protagonist) — no compressed/expert path, no "always trust my picks" setting. Nothing in `KAI-FULFILLMENT-UX.md`, `D-KAI-EXPERIENCE.md`, or the Mail Center evolution plans proposes one. This is the first concrete instance of the Brief's ask ("Kai should be QUIETER for a pro than for a novice") going unmet by the current design — not because Kai says anything wrong, but because the chain has no notion of operator seniority at all.

---

## Scene 7 — Package Review, step 4, 8:05 AM — Educational Explanation

SEES: The existing `KaiWhy` component, reused verbatim (`B-MAIL-CENTER-EVOLUTION.md §3.1` row 4; `components/kai/KaiWhy.tsx`) — "What I observed," "Which bureau data contributed," "Which laws apply" (§611(a)(7) cited with its full description), "What stays uncertain" rendered at the **same visual weight** as the favorable evidence (`KaiWhy.tsx:62-71`, the FTC clear-and-conspicuous discipline noted in its own comment).

KAI: *(full explainer card — the "why this law applies" content Marcus could recite from memory)*

DOES: Clicks through without reading a line of it.

CHANGES: None — a required, un-skippable read-through step.

⚑ **FRICTION, the sharpest instance of the "Kai over-talk for a pro" ask.** This is the single step in the chain that is *purely* educational (no new decision is made here — Marcus decided the strategy in Scene 6). For a novice this is exactly the right amount of teaching. For an operator managing 14 caseloads it is a fixed tax on every package, every round, forever. The uncertainty section's mandated equal-weight rendering (a correct, load-bearing compliance law — never to be quieted) is not the problem; the problem is that the *entire step* has no "seen this, understood, don't show me the full card again" memory for a repeat operator. Nothing in the source set proposes one — this is a genuine, unaddressed product gap, not a misreading of an existing mechanism.

---

## Scene 8 — Package Review, steps 5–6, 8:06 AM — Letter Preview / PDF Preview

SEES: The existing side-link promoted to its own step (`app/mail/send/[letterId]/page.tsx:186-188`, "Open the exact letter (PDF preview) →"), still browser-print-based (`app/letters/print/[id]/page.tsx` + `PrintActions.tsx`, unchanged — `B-MAIL-CENTER-EVOLUTION.md` §3.1 row 6 flags this is `window.print()`, no PDF library, `FOUNDER-GATE` if that ever changes).

KAI: *(none — this is a document, not Kai's voice)*

DOES: Opens the preview in a new tab, scans the recipient block and the §611(a)(7) demand paragraph for typos, closes the tab.

CHANGES: None.

⚑ No new finding — this step is fast and honest about what it is (a real, unbranded, printable letter, not a fabricated "generated PDF").

---

## Scene 9 — Approve, 8:08 AM — the three-render split

SEES: The corrected structure (`KAI-FULFILLMENT-UX.md` §1.4, closing the violation `B-MAIL-CENTER-EVOLUTION.md` §3.2 found in today's shipped code): render 1, a Kai-labeled explanation card (recipient/round/address/mail-class, the `KAI` badge, unchanged `<dl>` shape); render 2, a **separate, non-Kai** card holding only the price breakdown and the **Approve** button. Price: base print & postage $2.84 (2 letters — the §611(a)(7) demand plus a companion validation letter to Northline directly), additional pages/enclosures $0.90, certified mail + electronic return receipt (×2) $9.90, CreditVector service fee $4.00 — **Total: $17.64 (illustrative)**.

KAI: *(render 1 only)* *"Round 2 to Northline Recovery Group and a method-of-verification demand — first-class, certified, both pieces."*

DOES: Reviews the line-items in render 2 (no `KAI` badge here — `KAI-FULFILLMENT-UX.md` §1.4 point 2), clicks **Approve**.

CHANGES: `authorizeGroup()` runs (`WALLET-COMMITMENT-MODEL.md` §5.2) — inside one locked transaction, the anchor lock on Meridian's `Wallet` row, the deficit guard, then the funds check.

⚑ **DELIGHT.** The split is real and exactly as specified — Marcus never sees a KAI badge anywhere near the button that moves money. This is the one place the architecture explicitly repaired a violation `B-MAIL-CENTER-EVOLUTION.md §3.2` found in the shipped code (*"Approve() today opens with a KAI badge... and the Approve & continue button sits inside that same card"*) — the fix held.

---

## Scene 10 — The wallet-low moment, 8:09 AM — insufficient funds at authorization

SEES: `authorizeGroup()`'s funds check (`WALLET-COMMITMENT-MODEL.md` §5.2, `:656-658`): `availableCents < requiredCents` → refuses. Meridian's agency wallet currently holds **$9.20** available; Elena's package needs **$17.64**; shortfall **$8.44**. The exact 402 contract (`WALLET-COMMITMENT-MODEL.md` §8.5): `{ error, topUp: true, wallet: { availableCents: 920, requiredCents: 1764, shortfallCents: 844 } }`.

KAI: *(best-guess rendering — see GAP below)* "This package needs $17.64 authorized and your agency's CreditVector Wallet currently has $9.20 available — $8.44 short. Nothing about this package was lost or charged; add funds to your agency's wallet to continue."

DOES: Reads the refusal. Does not panic — the copy is calm, factual, names the exact shortfall, states the package is safe.

CHANGES: **No** `WalletLedger` row is written (the refusal happens before any insert, `§5.2:656-658`). Elena's `DisputePackage` stays at `APPROVED`, pre-`WALLET_AUTHORIZED` — nothing to resume differently later (confirmed in Scene 19).

⚑ **GAP, twofold — the largest one in this file.**

**(1) No Kai copy actually exists for this exact moment.** `KAI-FULFILLMENT-UX.md`'s 19-class failure-translation catalog (§2.1.2) has a dedicated class for an *ongoing deficit posture* (`WALLET_DEFICIT`, §2.3.12 — a wallet already negative from a past clawback) but **no class for the far more common case simulated here**: a positive-but-insufficient balance at the exact moment of one specific Approve. `WALLET-COMMITMENT-MODEL.md` §5.2/§8.5 fully specifies the 402 shape (`availableCents`/`requiredCents`/`shortfallCents`) — the data exists — but no one has written Kai's line for it, and no `kaiCopyClass` handle names it. The line above is my best-guess rendering, built from the same substitution rule §2.2 requires (on-behalf-of voice, since Meridian's is the wallet) and the same factual/no-shame register §3.4 mandates for the sibling deficit case — not a quotation of anything that exists on disk.

**(2) "Marcus can't, Danielle must" has no product mechanism at all — because Scene 1's gap means the product cannot tell them apart.** `resolveWalletTarget()` (`WALLET-COMMITMENT-MODEL.md` §9.1) resolves the acting account to Meridian's one `Wallet` regardless of which human is at the keyboard. There is no spend-authority ceiling per operator, no "request a top-up, notify the owner" flow, no distinct read/act permission for staff vs. owner on the wallet screen. If Marcus is holding Meridian's own login (which, per Scene 1, is the only login that exists), **nothing in the code stops him from clicking "Add funds" and completing the Stripe top-up himself** (`WALLET-COMMITMENT-MODEL.md` §8.1 — a `wallet_topup` checkout keyed to whichever account is signed in). The "Marcus can't" half of this scenario is not a permission the system enforces; it is Meridian's own internal office policy (staff don't hold the card on file) — a human rule the product has no way to encode, support, or even display. So the "handoff" this scene needs to dramatize is not a designed workflow; it's Marcus closing the tab and doing the actual handoff **outside CreditVector entirely.**

---

## Scene 11 — The handoff, 8:10 AM — outside the product

SEES: Nothing on screen changes. Marcus opens Meridian's team Slack (or texts) on his phone.

KAI: *(none — Kai has no part in this)*

DOES: Types: *"Elena's Round 2 is ready to send, wallet's $8.44 short — can you top up when you get a sec?"* Sends it. Goes back to CreditVector and moves to other work rather than wait.

CHANGES: Nothing in CreditVector. Elena's package sits at `APPROVED`, invisible as a *blocked* item anywhere Marcus can see later except his own memory.

⚑ **GAP, continued.** There is no in-app trace of this moment at all — no notification queued to Danielle, no "awaiting funding" badge on Elena's roster row (her `needsAttention` flag, computed from FCRA response-window data, `app/api/agency/clients`, is entirely unaware that a package is sitting wallet-blocked), no shared "pending on owner" list either of them could check later. If Marcus forgets to follow up, or Danielle doesn't see the Slack message for two hours, the only record that this ever happened is the message itself, on a system CreditVector doesn't own. This is a real, honest, and immediately actionable finding: `WALLET-COMMITMENT-MODEL.md`'s `WalletDeficitResponse`/`InsufficientFundsResponse` contracts (§8.5) are read-shapes for a screen — nothing in any of the fulfillment docs designs the *notification* half of "who gets told, and how."

---

## Scene 12 — Interruption, 8:22 AM — Priya Shah calls

SEES: Marcus's phone rings mid-scroll through the Mail Center backlog (a different task he'd picked up while waiting on Danielle). Priya Shah, a client, wants to know if her first letter has gone out yet.

KAI: *(none — a phone call, not the product)*

DOES: Says "let me pull that up," opens a browser tab back to `/agency`.

CHANGES: None yet.

⚑ No finding yet — the interruption itself is just realistic office life. The next two scenes test what the brief actually asked: does the OS preserve his place?

---

## Scene 13 — Workspace switch under pressure, 8:23 AM — resumability and a stale-cache risk

SEES: Marcus clicks "Exit to agency" (`components/AgencyBar.tsx:24-32` — posts `clientId: null`, `router.push("/agency")`), then opens Priya's row. AppShell reloads scoped to Priya.

KAI: *(silent on Priya's Mission Control, or possibly stale — see GAP)*

DOES: Waits through the switch, scans Priya's Mail Center row for her first letter's status.

CHANGES: `WORKSPACE_COOKIE` flips to Priya's client id.

⚑ **GAP, code-grounded, moderate confidence.** `components/kai/KaiPresence.tsx` caches its context in `sessionStorage` under a single, **workspace-unscoped** key: `const CACHE_KEY = "kai-presence-ctx-v1"` (`:18`), TTL 5 minutes (`:20`). Nothing in the component reads or clears this key on an `AgencyBar` switch — the cache is keyed only to the browser session, never to which client workspace is currently active. `KaiPresence` is excluded on `/dashboard` and `/journey` (`:101`, "Kai Home and the Kai-narrated timeline ARE Kai — no double presence") but renders normally on `/agency`, `/mail`, and `/letters`. If Marcus had opened the floating Kai pill anywhere in Elena's workspace within the last 5 minutes (plausible — Scene 9's Approve attempt was 14 minutes ago, so this specific instance would have expired, but a faster interruption easily would not have), and then opens the pill again inside Priya's workspace before the TTL clears, he would see **Elena's** cached recommendation/deadline line rendered as if it were Priya's. This is not dramatized as happening today (the timing in this file doesn't quite trigger it), but it is a real latent risk the code creates and nothing in the fulfillment docs names or guards against — worth flagging precisely because a faster-paced Tuesday than this one absolutely would trigger it.

**Resumability, the part that works:** Elena's package (Scene 10) needed no special handling — because `authorizeGroup` refused before writing anything, her `DisputePackage` never left `APPROVED`. Per the existing, generalized resumability rule (`B-MAIL-CENTER-EVOLUTION.md` §3.3, `KAI-FULFILLMENT-UX.md` §1.8): a package with no hold and no `FinalReviewConfirmation` simply re-renders at the Approve step whenever Marcus returns to it. He will not lose his place — but nothing marks *why* he left it there, either (see Scene 19).

---

## Scene 14 — Handling Priya, 8:25 AM — the one thing that stays legible

SEES: The gold `AgencyBar` reading *"Working in **Priya Shah**'s workspace"* — impossible to confuse with Elena's.

KAI: *(Priya's own Mail Center row shows her own health pill and recommendation, scoped correctly)*

DOES: Confirms her letter status, tells her on the phone, hangs up.

CHANGES: None — a read-only interaction.

⚑ **DELIGHT, restated.** Whatever the KaiPresence cache risk (Scene 13) or the roster's blind spots (Scene 15) turn out to be, the one thing Marcus is never confused about mid-interruption is *whose file is open*. The `AgencyBar` is the single most reliable orientation aid in the whole day.

---

## Scene 15 — Back to the roster, 8:27 AM — re-orientation cost, paid twice

SEES: Marcus exits to `/agency` again. The roster looks the same as Scene 3 — Elena's row shows only her FCRA-window `needsAttention` computation (unchanged, since that's not what's actually blocking her), not any fulfillment-specific state.

KAI: *(the same live Agency Briefing count as Scene 3 — recomputed, not remembered)*

DOES: Has to remember, himself, that Elena is the one waiting on Danielle, and that he was mid-backlog on the Mail Center sweep before Priya called.

CHANGES: None.

⚑ **GAP.** This is where Scene 3's finding compounds with Scene 10's. The `/agency` roster's `needsAttention` field is computed entirely from Letter/response-window data (`app/api/agency/clients`, same shape the Mail Center's `MailHealth` enum is built from, `lib/mailCenter.ts:118-127`) — it has **no visibility into `DisputePackage`/wallet/fulfillment state at all**. A client blocked purely on a wallet-authorization shortfall, a provider rejection awaiting correction (Scene 17), or a package sitting in `RETRY_IN_PROGRESS` produces **zero signal** at the roster altitude — Marcus can only discover any of it by opening that one workspace's Mail Center directly. Combined with Scene 3's missing cross-client recommendation, this means the roster answers "who hasn't heard from a bureau in 30+ days" reasonably well, and cannot answer "what's actually stuck in my fulfillment pipeline right now, across all 14 clients" at all. Today, Marcus's own working memory is covering for this. That doesn't scale, and it's exactly the kind of state a computer should hold instead of a person.

---

## Scene 16 — Mail Center queue pass, 8:30 AM — the evolved room, working as designed

SEES: Marcus opens Dwayne Ferris's workspace for his routine sweep — the evolved `/mail` (`docs/fulfillment/execution/MAIL-CENTER-EVOLUTION-PLAN.md` §1.8's "Download-complete" milestone; `B-MAIL-CENTER-EVOLUTION.md` §2): a "Do this first" band at the top (new `pickQueueRecommendation()`, the `ExecutiveQueue` `HeadTile` idiom reused, `B-MAIL-CENTER-EVOLUTION.md` §2.3), the `StatCard` metrics grid demoted below it (§2.6), and the work queue sorted by the health-priority ladder (§2.2: `ESCALATION_AVAILABLE → NEEDS_ATTENTION → RESPONSE_RECEIVED → READY_FOR_ROUND_2 → WAITING_NORMALLY → COMPLETED`) instead of today's shipped `orderBy: createdAt desc` (`app/mail/page.tsx:24`). One row floats to the top with a gold `NEEDS_ATTENTION` pill.

KAI: *"Do this first: Dwayne Ferris's letter to Meridian Bank Card couldn't be delivered as addressed."*

DOES: Opens the row's nested evidence drawer (`B-MAIL-CENTER-EVOLUTION.md` §2.4) — every field renders the honest `RESERVED` placeholder (*"Available after live mail integration."*, `lib/mailCenter.ts:84`) except the one that matters right now, which is real: the rejection reason.

CHANGES: None yet — a read.

⚑ **DELIGHT.** The queue reordering and "Do this first" band are exactly the fix `B-MAIL-CENTER-EVOLUTION.md §1.2`'s own gap analysis called for — Marcus does not have to scroll a DB-ordered list to find the one thing that needs him. The evidence drawer's honest placeholders (never a fabricated tracking scan) held up under direct inspection.

---

## Scene 17 — Kai's rejection translation, 8:32 AM — scenario 2, branch b

SEES: The disclosed reason, translated per `RECOVERY-ENGINE.md` §4 scenario 2 / `KAI-FULFILLMENT-UX.md` §2.3.2 (`CORRECTION_NEEDED_ADDRESS`, Kai state `concerned` — never alarm).

KAI: *"This package needs a working address for Meridian Bank Card before it can go out. The hold on your agency's balance wasn't affected — fix the address here and it's ready to go."* (on-behalf-of variant, exact quote, `KAI-FULFILLMENT-UX.md §2.3.2`)

DOES: Reads it — no panic, no dead end. Clicks through to correct the address (a transposed ZIP digit from the original upload).

CHANGES: The corrected address is saved to the letter record.

⚑ **DELIGHT.** Never the word "Failed." The package is explicitly preserved ("saved exactly as you built it" is the sibling self-pay line, §2.3.2). A correction path is named in the same breath as the problem. This is the failure-translation catalog working precisely as `RECOVERY-ENGINE.md` §7's Recovery Constitution requires: *"Every failure resolves to a deterministic state, with a preserved audit trail, a recoverable workflow, and a Kai explanation."*

⚑ Minor note, not ranked: the copy says "the hold wasn't affected," which is true in net effect (the released hold returns to available balance) but is a slightly soft way to describe what actually happened mechanically (a `release`, not a no-op) — `RECOVERY-ENGINE.md` §4 row 2 states the wallet effect for this exact branch as **"hold released,"** not "unaffected." Not a compliance problem (nothing is overstated in the operator's favor), just a small precision gap in the source copy itself.

---

## Scene 18 — Correction and retry, 8:34 AM — a new, independent hold

SEES: Marcus resubmits. Per `RECOVERY-ENGINE.md` §4 scenario 7 / `WALLET-COMMITMENT-MODEL.md` §6.3: a new attempt (`attempt+1`), a fresh `DisputePackageLetter`, and — critically — a **new, independent authorize hold**, never a reuse of the released one.

KAI: *"I've resubmitted this package with what was corrected — a new hold is set aside on your agency's balance for this attempt. I'll update you the moment CreditVector Fulfillment responds."* (on-behalf-of, exact quote, `KAI-FULFILLMENT-UX.md §2.3.6`, `RETRY_IN_PROGRESS`)

DOES: Confirms the new hold amount ($8.70, illustrative — this package's own line-items) and moves on to the next queue row.

CHANGES: New `WalletLedger` `authorize` row, `attempt` 2; old `attempt` 1 stays on record as evidence, untouched.

⚑ No new finding — this is the Recovery Engine's own designed behavior (`RECOVERY-ENGINE.md §7` law 4: exactly five wallet-effect kinds, no ad hoc sixth) working exactly as specified, and it's legible: Marcus can see both attempts stacked, never wonders which one is "real."

---

## Scene 19 — Danielle funds it, 9:40 AM — back to Elena

SEES: A Slack reply: "done, added $50." Marcus returns to Elena's workspace. Because her package never left `APPROVED` (Scene 10), he lands back exactly where he was — the Approve screen, re-rendered.

KAI: *(render 1, unchanged from Scene 9)*

DOES: Clicks **Approve** again. This time `authorizeGroup()`'s funds check passes.

CHANGES: A real `WalletLedger` `authorize` row is written. The authorize copy fires (`KAI-FULFILLMENT-UX.md §3.1`, on-behalf-of, exact quote): *"This is a hold, not a charge. **$17.64** is set aside from your agency's CreditVector Wallet balance to cover this package while CreditVector Fulfillment reviews it — nothing is deducted yet, and nothing is charged to you directly."*

⚑ **DELIGHT, with an asterisk.** The resumability held perfectly — no re-entry of anything, no "start over." The asterisk: nothing about this screen, or anywhere else, tells Marcus *this was the package that was blocked ninety minutes ago.* There's no note, no small "resumed" marker, no link back to the earlier refusal. He knows only because he remembers. A returning operator with a busier morning than this one would have no way to reconstruct that history from the product itself.

---

## Scene 20 — FINAL REVIEW, 9:41 AM — the ritual, respected

SEES: The third, separate render (`KAI-FULFILLMENT-UX.md` §1.4 point 3) — no `KAI` badge anywhere in its DOM. Title: **"CreditVector Fulfillment — FINAL REVIEW"** (§1.2, Founder's exact copy). Price re-shown from the frozen `FinalReviewToken` values, not recomputed (§1.5). The WARNING block, verbatim:

> **Once CreditVector Fulfillment accepts this package for production, it cannot be reversed.**
> This is CreditVector Fulfillment's current understanding of how production works — cancellation after acceptance is not guaranteed, and we will not promise it can be undone. If you need to stop this package, do it before you approve below.

Four checkboxes, none pre-checked (§1.3 — not even on a resumed session):

- ✓1 "I've reviewed the letter(s), recipient(s), and address(es) in this package in the PDF preview, and they're correct."
- ✓2 "I understand a hold of **$17.64** — not a charge — is currently on my CreditVector Wallet balance for this package, and that it becomes a final charge only once CreditVector Fulfillment accepts this package for production."
- ✓3 "I've read the warning below and understand that once CreditVector Fulfillment accepts this package for production, it cannot be reversed."
- ✓4 **"I'm mailing this on behalf of Elena Ruiz, and I'm authorized to act for her case."** (the on-behalf-of branch, §1.2 row 4)

KAI: *(none — no Kai voice anywhere on this card, by design)*

DOES: Reads the warning fully (it's physically positioned above the checkboxes, forcing that reading order, §1.2), checks all four in order, clicks **Submit** (disabled until all four are true, §1.3).

CHANGES: A server-side validation of the `FinalReviewToken` (§1.5 — `contentHash`/`warningVersion`/`estimatedTotalCentsShown`/`policyVersion`, single-use, expiring) precedes anything else; a `FinalReviewConfirmation` audit row is written in the same transaction the token is consumed (§1.6).

⚑ **Not friction — the brief's own framing, confirmed.** For a professional doing this for the fortieth time this month, this is exactly what the brief predicted it should be: "a routine-but-respected ritual," not a nag. Marcus doesn't resent the four boxes — they're specific, each means something distinct (content, money, irreversibility, authority), and the WARNING is stated once, plainly, in amber, never red, never manufactured alarm (`lib/kaiStates.ts`'s "steady and on it... zero fear energy" law, extended here to non-Kai chrome per `KAI-FULFILLMENT-UX.md` §1.2's own citation of it). ✓4 in particular is doing real, non-decorative work today — it is the one place in the whole flow where Marcus, on Meridian's shared login (Scene 1's gap), is asked to *affirmatively state* he's acting for Elena and is authorized to. That's meaningful even though nothing upstream can independently verify it.

⚑ Very minor documentation-completeness note, not ranked: the ✓2 assertion text in `KAI-FULFILLMENT-UX.md` §1.2's table is written in self-pay language only ("on **my** CreditVector Wallet balance") with no explicit on-behalf-of branch shown alongside ✓4's — I've rendered it in on-behalf-of voice above because §2.2's general substitution rule requires it for any line stating a concrete wallet fact, and the register-incompleteness finding `COMMITMENT-REGATE.md` raised is exactly about this kind of gap. The correction is straightforward; it just isn't spelled out verbatim in the source the way ✓4's branch is.

---

## Scene 21 — Submit → acceptance → settlement, 9:42 AM

SEES: Submission succeeds. Some time later (the Recovery Engine's reconciliation sweep, `RECOVERY-ENGINE.md` §3, or — undesignedly fast in this dramatization — near-immediately) the package reaches `ACCEPTED`.

KAI: *"CreditVector Fulfillment has accepted this package for production. Your agency's hold is now final — **$17.64** has been applied to their CreditVector Wallet balance, and there's nothing further you need to do to keep it moving."* (on-behalf-of, exact quote, `KAI-FULFILLMENT-UX.md §3.2`)

DOES: Reads the confirmation, moves to the next roster item.

CHANGES: `settle` ledger entry, permanent (`WALLET-COMMITMENT-MODEL.md` §7.6, §12: settlement at acceptance is final — Ruling 3's law that Kai never again says "released" or "nothing was charged" for this package, in any voice).

⚑ No new finding — the settlement fact is stated plainly and once, and it is genuinely permanent per the architecture. Nothing here oversells or softens what just happened.

---

## Scene 22 — Afternoon, 1:15 PM — a quiet, good-news moment (compressed)

SEES: A different client's package (not dramatized in full) shows `RETURN_RECEIPT_ARCHIVED` in the Mail Center timeline — the evidence drawer's `ProofArtifact[kind="return_receipt"]` now real instead of `RESERVED`.

KAI: *"[Recipient] has received this package — the §611 clock starts today."* (`KAI-FULFILLMENT-UX.md §3.5`, the corrected receipt-anchored clock — never "mailed = clock started")

DOES: Notes it, moves on. No action required.

CHANGES: The derived waiting-period clock now runs for that letter.

⚑ **DELIGHT.** Kai state here is `good-news` — "quiet satisfaction... states the fact, then next watch-item... never gloats" (`lib/kaiStates.ts:43`). No celebration-about-money, no fanfare for routine good news. Exactly the emotional range the voice law allows.

---

## Scene 23 — Second roster pass, 4:50 PM — the queue, thinning

SEES: `/agency` again. Of the 4 originally flagged clients (Scene 3), Elena's is now settled (though her row itself won't change — `needsAttention` is about *future* follow-up windows, not this package). Dwayne Ferris's retry (Scene 18) is still `SUBMITTED`, not yet `ACCEPTED` — no row anywhere reflects that it's "in a good, resolved-for-now state," because the roster doesn't track fulfillment at all (Scene 15's gap, still true).

KAI: *"2 of 14 clients need attention: 2 past the 30-day response window."*

DOES: Opens the remaining two, works them down — not dramatized scene-by-scene, consistent with the brief's request to compress repetitive stretches.

CHANGES: Both cleared by end of day.

⚑ No new finding beyond the ones already ranked — this scene exists to establish that the day *can* actually be worked down to zero on the one dimension the roster measures.

---

## Scene 24 — End of day, 5:40 PM — what tells Marcus he's done?

SEES: `/agency`'s Kai Agency Briefing, needsWork = 0: *"I checked every follow-up clock today. All 14 clients are inside their response windows. Nothing due yet — I'll keep watching."* (`app/agency/page.tsx:362-369`, the genuine quiet-is-allowed branch, live-computed, not a canned "you're done" message)

KAI: *(the line above — factual, not celebratory; no `celebrating` state reached, correctly — clearing a queue is not a milestone win per `lib/kaiStates.ts`'s own law)*

DOES: Reads it, closes the laptop.

CHANGES: None — a read confirming a real, current, negative-space fact (no client is overdue).

⚑ **Honest verdict, not a top-5 item but the necessary closer: "quiet is allowed" partially survives to day scale, and Marcus should not fully trust it yet.** The sentence above is true and earned — nobody's FCRA window is unattended. But it is silent, in the dangerous sense, about the dimension Scenes 10, 15, and 23 already established the roster cannot see at all: whether any package is sitting `WALLET_AUTHORIZED`-but-unsubmitted, `RETRY_IN_PROGRESS`, `REFUND_UNDER_REVIEW`, or wallet-blocked, anywhere across his 14 workspaces. Today, Marcus happens to know Dwayne's retry is still in flight, because he watched it happen a few hours ago. On a busier Tuesday, "Nothing due yet" would read as an all-clear while a fulfillment-pipeline item quietly waited on him somewhere the roster doesn't look. The product does let him stop — but the stop signal it gives him is real for one axis and silent (not false, just uninformed) about the other. That gap between "the one thing Kai checked is clear" and "the day is actually done" is the honest note to end on.

---

## Emotional-Design Scorecard

| Dimension | Score | Note |
|---|---|---|
| Confidence | 4/5 | Every per-package mechanic (hold/settle/release, FINAL REVIEW, the rejection translation) is precise and never overstates itself — Marcus trusts the words on screen completely. Docked one point because the roster's blind spot (Scene 15) means his confidence at the *agency* altitude is partly self-supplied, not system-supported. |
| Momentum | 3/5 | Strong inside a single workspace; broken hard at every switch and by the wallet-low block, with no in-app path to route around either (Scenes 10–11, 15). |
| Trust | 5/5 | Nothing lies to him, ever — not the deficit copy, not the rejection translation, not the settlement finality. The on-behalf-of voice is correctly agency-scoped throughout. This is the strongest dimension of the whole day. |
| Progress | 3/5 | Real, visible per-package progress (health pills, the 12-stage timeline, the retry's new-attempt marker). No roster-level "how much of today is actually behind me" signal exists at all. |
| Clarity | 3/5 | Total clarity inside a workspace (AgencyBar, resumability, honest placeholders); real ambiguity at the operator/agency altitude, where "what's next" has no single answer. |
| Motivation | 4/5 | Kai's calm, basis-carrying, never-manufactured-urgency voice keeps a 14-client day from ever feeling like an alarm panel — genuinely well-calibrated in tone, even where it over-explains (Scenes 6–7). |
| Completion | 2/5 | The day *can* go quiet, and did — but that quiet covers only the FCRA-window dimension. Fulfillment-pipeline state (holds, retries, reviews) has no equivalent "all clear," so "done" is Marcus's own inference, not a fact the product hands him (Scene 24). |

## Orientation Verdict — "always knows where they are / what happened / what happens next?"

**Yes, at the single-workspace altitude.** The `AgencyBar` never leaves Marcus unsure whose file is open; the resumability rule never loses his place inside a package; the timeline and evidence drawer never fabricate progress; Kai's failure translations always name what happened and what to do next, never a bare "Failed."

**No, at the operator/agency altitude — the one the brief asked me to test hardest.** There is no single "do this first" across 14 clients (Scene 3), no cross-client "while you were away" (implicit throughout — Case Memory is per-workspace by construction, `lib/kaiSeen.ts`), no visibility into fulfillment-pipeline blockers from the roster (Scene 15), and no persistent memory of *why* a package is sitting where it is once Marcus looks away and comes back (Scene 19). Each of these is independently documented as out-of-scope or unresolved in the locked planning docs, not a misreading on my part — this file is reporting a real, converging seam, not inventing one.

## Top 5 Friction/Gap Items, Ranked

1. **No cross-client "do this first."** `CASE-JOURNEY-RUNTIME-PLAN.md` §1.4 and §4.1 item 6, `B-MAIL-CENTER-EVOLUTION.md` §5: Mission Control's anti-overwhelm law is a union across *one user's* cases; an agency's 14 managed clients are 14 separate `User` rows, never unioned. Explicitly named as future/out-of-scope, not built. This is the core question the brief asked me to test, and the honest answer is: it doesn't survive past one workspace today.
2. **The wallet-low handoff has no product mechanism, because staff identity itself doesn't exist yet.** `WALLET-COMMITMENT-MODEL.md` §9.2, `lib/agencyCapacity.ts`'s `STAFF_USER_LIMIT` comment: "agency staff" is undeclared-and-unenforced. "Marcus can't fund it, Danielle must" is Meridian's own office policy, invisible to and unsupported by CreditVector — no request-funds flow, no owner notification, no shared pending-item visibility. The handoff happens on Slack, not in the product.
3. **The agency roster is blind to fulfillment state.** `needsAttention` is computed purely from FCRA response-window data; a client blocked on a wallet shortfall, a provider rejection, or an in-flight retry produces zero roster signal. Combined with #1, this means the only "what needs me" surface an agency operator has cannot see the fulfillment pipeline at all.
4. **No Kai copy exists for the ordinary insufficient-funds moment.** The 19-class failure-translation catalog (`KAI-FULFILLMENT-UX.md` §2.1.2) covers an ongoing deficit posture but not the simpler, more common case of one specific Approve exceeding the current balance — the 402 shape is fully specified (`WALLET-COMMITMENT-MODEL.md` §8.5), the words are not.
5. **No memory of a resumed package's own history, and a workspace-unscoped Kai-presence cache.** Elena's Scene-19 resume is mechanically correct but narratively silent about the block that preceded it; separately, `KaiPresence.tsx`'s 5-minute sessionStorage cache carries no workspace/client key at all, a latent cross-client staleness risk a busier day than this one would trigger.

---

**Summary for the merge:** Marcus Webb's Tuesday shows a product that is scrupulously honest and calm at the altitude it was actually designed for — one operator, one workspace, one case — and comes apart exactly at the seam every locked planning document already flags but defers: the jump from one client to fourteen. Every individual mechanic that fires (the anti-overwhelm recommendation, the three-render Approve/FINAL REVIEW split, the rejection-to-retry translation, the on-behalf-of money voice, the settlement finality) works precisely as designed and never once overstates itself. What's missing is anything that operates *above* a single case: a ranked cross-client recommendation, a roster that can see fulfillment state and not just FCRA windows, and a designed answer — any answer — to who gets to spend an agency's money when the person doing the work isn't the person who owns the account.
