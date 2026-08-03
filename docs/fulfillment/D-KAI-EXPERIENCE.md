# D-KAI-EXPERIENCE.md — Kai as the Operational Guide of the Case Journey

Agent D (Kai Experience) — architecture only, per `docs/fulfillment/PROGRAM-BRIEF.md`. No product code, no schema, no dependency, no vendor change. Every claim below is either a **VERIFIED** citation to existing code or a **PROPOSED** / **FOUNDER-GATE** extension — labeled inline. Baseline: Program Brief §0–§2 (repository truth digest) is treated as ground truth and not re-derived.

## 0. The four laws (binding on every section below)

| # | Law | Source |
|---|---|---|
| L1 | Kai owns explanation, education, recommendation, narration, guided workflow. Kai **never** owns truth, money, fulfillment execution, or policy. | Program Brief §1.7 |
| L2 | Kai **never** exposes vendor implementation. The operator-facing name is always **"CreditVector Fulfillment"**; internal provider ids (`letterstream`, `lob`, `postgrid`, `click2mail`, `postalmethods`) never reach Kai's copy. | Program Brief §1.1; `lib/mail/MailProvider.ts:1-9` ("Business logic, Kai, and the UI depend ONLY on these types — never on a provider's concrete package or status vocabulary") |
| L3 | Every KaiEvent, every mail-lifecycle transition, every audit entry is **emitted by SYSTEM code** (a route or a service class) — never by `lib/kai.ts` or `components/kai/*`. Kai reads the stream; it does not write it. | `lib/kaiEvents.ts:1-3` ("Producers are one-line, fail-open calls inside existing flows; consumers... render from it"); verified below §1.0 |
| L4 | Every Kai claim carries a `basis` — the receipt for which deterministic rule fired. Kai never asserts a fact it can't cite. | `lib/kaiHome.ts:28` (`KaiRecommendation.basis`); `lib/decisionRegistry.ts:14` (`DecisionRecord.basis: string[]`) — the same idiom persisted |

**Verification of L3** — every existing call site of `recordKaiEvent(...)` lives in route/service code, never in `lib/kai.ts` or `components/kai/*`:

```
app/api/letters/generate/route.ts:73        recordKaiEvent(user.id, "letter.generated", …)
app/api/letters/[id]/route.ts:81,94         recordKaiEvent(user.id, "letter.mailed" | "dispute.resolved", …)
app/api/letters/[id]/response/route.ts:80   recordKaiEvent(user.id, "response.received", …)
app/api/reports/analyze/route.ts:39         recordKaiEvent(user.id, "report.analyzed", …)
app/api/reports/upload/route.ts:127,132     recordKaiEvent(user.id, "report.uploaded" | "report.analyzed", …)
lib/campaignInput.ts:23                     recordKaiEvent(e.userId, e.type, …)   — CampaignService sink
lib/mail/MailService.ts:30                  recordKaiEvent(e.userId, e.type, …)   — MailService default sink
```

`lib/mail/MailService.ts:1-13` states the money/execution half of L1 as code law today: *"Kai never sends mail. Kai recommends; a USER approves; only then can the service execute."* Its `initiate()` (`MailService.ts:104-123`) tags the GENERATED→IN_REVIEW transition `actor: "kai", event: "kai.recommended"` — **this is a provenance label the system applies to its own audit entry**, not Kai writing to the trail. `lib/mail/MailAudit.ts:16`'s `AuditActor = "system" | "user" | "provider" | "kai"` union exists precisely so the audit record can say "this step happened because Kai recommended it" without Kai ever calling `appendAudit`. The proposed `package.*` events (§1) follow the identical pattern.

---

## 1. Narration Model

### 1.1 Canonical stage → event map

The Program Brief §1.10 timeline (12 stages) maps to two proposed `KaiEvent` families: named **`package.*`** events for the six operator-meaningful moments, and a generic **`fulfillment.status`** carrier for the three internal sub-stages between Submitted and Delivered — exactly mirroring the existing `mail.status` idiom, which carries the full `MailStatus` enum but is rendered selectively (`app/journey/page.tsx:46-59`, `mailStatusLine()` returns `null` for every stage the product doesn't yet reach truthfully — *"provider stages (printed/delivered/…) aren't reached until live mailing"*).

| # | §1.10 stage | Proposed KaiEvent | Emitter (SYSTEM) | Event Bus counterpart |
|---|---|---|---|---|
| 1 | *(pre-stage: case/package opened)* | — | package-compose route | `DISPUTE_CREATED@1` (existing, 0 callers) |
| 2 | **Prepared** | `package.prepared` | Policy Engine / package-compose route (Agent A) | `LETTER_GENERATED@1` (existing, 0 callers) |
| 3 | **Approved** | `package.approved` | approval route (records a **user**-only action) | `PACKAGE_APPROVED@1` (PROPOSED) |
| 4 | **Wallet Authorized** | `package.funded` | Wallet authorize boundary (Agent C) | Agent C's to define — see §5 |
| 5 | **Submitted** | `package.submitted` | Policy Engine → Provider Adapter dispatch (Agent A) | `PACKAGE_FULFILLMENT_SUBMITTED@1` (PROPOSED) |
| 6 | **Accepted** | `fulfillment.status` (`status: "PROVIDER_ACCEPTED"`) | provider webhook ingestion → Policy Engine | — (carried in payload, not a distinct contract, per `mail.status` precedent) |
| 7 | **Printing** | `fulfillment.status` (`status: "PRINTED"`) | same | — |
| 8 | **Mailed** | `package.mailed` | Provider webhook → Policy Engine | `LETTER_SENT@1` (existing, 0 callers; `channel: "mail"` already anticipates this) |
| 9 | **USPS Accepted** | `fulfillment.status` (`status: "CARRIER_ACCEPTED"`) | same | — |
| 10 | **Delivered** | `package.delivered` | Provider webhook (tracking ingestion, Agent A) | `PACKAGE_DELIVERED@1` (PROPOSED) |
| 11 | **Return Receipt Archived** | `package.receipt_archived` | Provider webhook (evidence retrieval, Agent A) | `RETURN_RECEIPT_ARCHIVED@1` (PROPOSED) |
| 12 | **Waiting Period** | `waiting.started` | Policy Engine (derives §611 clock start from `package.mailed`) | `WAITING_PERIOD_STARTED@1` (PROPOSED) |
| 13 | **Ready for Next Review** | `waiting.ready_for_review` | Policy Engine (round2 gate / lapsed-window derivation) | `READY_FOR_NEXT_REVIEW@1` (PROPOSED) |

Illustrative `status` values in row 6/7/9 reuse the **existing** `MailStatus` vocabulary verbatim (`lib/mail/MailStatus.ts:9-25`: `PROVIDER_ACCEPTED`, `PRINTED`, `CARRIER_ACCEPTED`). Agent A's unified state machine is authoritative for the final mapping — this table defers to it and does not invent new state names.

### 1.2 Proposed `KaiEventType` extension

Additive to the existing union (`lib/kaiEvents.ts:6-23`); PROPOSED, not implemented:

```ts
// PROPOSED — Fulfillment Engine v1 additions, additive only, no existing value removed
| "package.prepared"          // stage 2 — Prepared
| "package.approved"          // stage 3 — Approved (actor: user, always)
| "package.funded"            // stage 4 — Wallet Authorized (Agent C boundary; refs-only, no amount)
| "package.submitted"         // stage 5 — Submitted to CreditVector Fulfillment
| "fulfillment.status"        // stages 6/7/9 — carries the granular provider sub-state (mirrors "mail.status")
| "package.mailed"            // stage 8 — Mailed
| "package.delivered"         // stage 10 — Delivered
| "package.receipt_archived"  // stage 11 — Return Receipt Archived
| "waiting.started"           // stage 12 — Waiting Period begins (§611 clock)
| "waiting.ready_for_review"  // stage 13 — Ready for Next Review
```

Envelope convention (mirrors `lib/campaignInput.ts:23-26`): `refType: "package"`, `refId: packageId`, event-specific detail inside `payload`. `package.funded`'s payload carries `{ packageId, authorizationRef }` only — **never an amount** (money stays in Agent C's WalletLedger; L1).

### 1.3 Event Bus contract proposals (refs-only)

The three existing zero-caller contracts are the **adoption seam** (Program Brief §2.3): they already model the shape a Dispute Package needs and simply haven't been wired to a publisher.

| Contract | Status | Scope | `defaultSource` | Payload (refs-only) | Role |
|---|---|---|---|---|---|
| `DISPUTE_CREATED@1` | existing, 0 callers | self | `disputes` | `{disputeId, tradelineId, bureau}` (`lib/eventBus/contracts.ts:36-38`) | Fires at Package open (pre-Prepared) |
| `LETTER_GENERATED@1` | existing, 0 callers | self | `letters` | `{letterId, tradelineId?, bureau?, status}` (`contracts.ts:40-42`) | Fires at **Prepared** |
| `LETTER_SENT@1` | existing, 0 callers | self | `mail` | `{letterId, channel: "mail"\|"print"}` (`contracts.ts:44-46`) | Fires at **Mailed** |
| `PACKAGE_APPROVED@1` | PROPOSED | self | `fulfillment` | `{packageId}` | Fires at **Approved** — net-new; no existing contract carries a distinct approval fact separate from a status string |
| `PACKAGE_FULFILLMENT_SUBMITTED@1` | PROPOSED | self | `fulfillment` | `{packageId, providerId}` — `providerId` is internal-enum-only, **never surfaced in Kai copy** (L2) | Fires at **Submitted** |
| `PACKAGE_DELIVERED@1` | PROPOSED | self | `fulfillment` | `{packageId}` | Fires at **Delivered** — today this stage is a `RESERVED` placeholder (`lib/mailCenter.ts:224-230`, `"Available after live mail integration."`); this is its first real content |
| `RETURN_RECEIPT_ARCHIVED@1` | PROPOSED | self | `fulfillment` | `{packageId, artifactRef}` — `artifactRef` is opaque, mirrors `ProofArtifact` (`lib/mail/MailProvider.ts:87-91`); never a raw URL in the event itself |
| `WAITING_PERIOD_STARTED@1` / `READY_FOR_NEXT_REVIEW@1` | PROPOSED | self | `fulfillment` | `{packageId, clockDays}` | **Open design question flagged for Agent A/E**: these may not need to be persisted Bus events at all — `deadlinesFrom()` (`lib/kaiHome.ts:42-58`) already computes "waiting" purely on read from `mailedAt`, never storing a state. Recommend: derive-on-read for narration (no event), but Agent A may still want an audit-trail row when the round2 gate physically opens (parity with `kai.recommended` tagging). Not resolved here — named as an interface decision, not designed past the boundary. |

`package.funded`'s Event Bus counterpart is **Agent C's to define** (Wallet owns authorize→consume→settle/void); this document only reserves Kai's read-side narration slot and restates the boundary: Kai narrates that funding happened, never how much or why it was authorized (§5).

### 1.4 Timeline narration — truthful states only

`/journey` (`app/journey/page.tsx`) and the Mail Center row timeline (`lib/mailCenter.ts:191-232`, `buildTimeline()`) are the two existing consumers a package timeline extends, not replaces.

- **No fake progress precedent, already in the codebase**: `lib/mailCenter.ts:224-230` renders unreached stages as `state: "placeholder"`, `description: "Available after live mail integration."` — never a fabricated "in progress." `app/journey/page.tsx:56-58`'s `mailStatusLine()` returns `default: null` for any status the product can't yet back with truth. **The `package.*`/`fulfillment.status` extension inherits this exactly**: a stage renders `placeholder` until its event has actually fired, never `current`/`preparing` on a guess.
- Kai's own narration line already occupies its **own labeled stage**, never overwriting a factual one: `lib/mailCenter.ts:215-216`, `{ key: "recommendation", label: "Kai's recommendation", state: "current", description: ctx.recommendation }`. The proposed package timeline preserves this separation — Kai's voice is an additional row, never a rewrite of "Mailed" into "Kai thinks it mailed."
- Copy for each new stage must stay recipient-correct per existing precedent (`lib/mailCenter.ts:97-100` `WINDOW_LABEL`, bureau=§611 / furnisher=§623 / collector=FDCPA §1692g) — package narration inherits the same per-recipient-kind branching, not a generic "the bureau" default.

### 1.5 Waiting-period framing — the §611 clock, no manufactured urgency

Reuses `lib/forecast.ts` unmodified:

- `REINVESTIGATION_DAYS = 30` (`forecast.ts:10`, also `lib/kaiHome.ts:13`) is the single constant every waiting-period line derives from — never a per-package guess.
- `forecastFor()` (`forecast.ts:70-98`) supplies `windowText`, `ownHistoryText` (own-bureau median response time, **minimum sample 3** — `ownResponseLatencyDays()`, `forecast.ts:30-47`, *"we never present one data point as a pattern"*), and `contingency` — all three reusable verbatim for `waiting.started` narration.
- **"Quiet is allowed"** is an explicit law already in code: `pickRecommendation()`'s final branch, `lib/kaiHome.ts:150`, `return null; // All quiet — quiet is allowed (no manufactured urgency).` A package sitting inside its statutory window with nothing new to report renders **nothing** from Kai — not a manufactured "still working on it" message. This is the direct precedent for "no fake `preparing`" applied to the Waiting Period stage specifically.

---

## 2. Guided Package Review (the §1.9 chain's Kai moments)

Chain per Program Brief §1.9: *Client → **Kai Summary** → **Recommended Disputes** → **Educational Explanation** → Letter Preview → PDF Preview → **Approve** → Download → Send with CreditVector Fulfillment.* Bold = Kai's four touchpoints below.

### 2.1 Kai Summary

| Aspect | Design | Precedent |
|---|---|---|
| Contents | Recipient + bureau, round number, strategy + reason, prior outcome on this chain (via `parentLetterId` walk), current §1.10 stage — all deterministic, own-rows only | Modeled on `getKaiHomeData()` (`lib/kaiHome.ts:182-198`), scoped to one package instead of the whole account |
| Fields | `Letter.round` (`prisma/schema.prisma:255`), `Letter.responseOutcome`/`.parentLetterId` (`schema.prisma:263,267`), `recommendStrategy()` reason (`lib/recommend.ts:23-89`) | — |
| Proposed module | `lib/kaiPackage.ts` (PROPOSED) — a package-scoped sibling to `kaiHome.ts`, same "own rows + KaiEvent stream, zero AI, zero network" projection style as `lib/mailCenter.ts:1-8` | — |
| Proposed component | `components/kai/KaiSummary.tsx` (PROPOSED) — server-rendered, zero client JS, same discipline as `KaiWhy.tsx:5` | — |
| AI-composed prose | **Optional, additive only** — never replaces the deterministic digest above it. If present, it runs through `applyCompliance()` (`lib/compliance.ts:43-53`) before render. If it ever needs AI, reuse `askKai`'s exact shape (`{text, usedAI}`, `lib/kai.ts:78-81,93-148` — offline fallback, metered, compliance-scrubbed) rather than a new AI-calling path | — |
| **Storage — FOUNDER-GATE** | AI-composed prose is **NOT persisted server-side** without the ADR-0006 founder gate (Program Brief §2.5: *"persisting Kai AI output server-side is founder-gated"*). Existing precedent: the KAI 90-day strategist plan persists **client-side only** — `app/strategist/AiPlan.tsx:8` (*"It persists on the user's own device (localStorage...)"*), `:46,82` (`window.localStorage.getItem/setItem`). Kai Summary's AI-composed layer, if built, follows the identical localStorage-only pattern until a founder-approved ADR says otherwise. | ADR-0006; `app/strategist/AiPlan.tsx:8,46,82` |

### 2.2 Recommended Disputes

- **Idiom**: `pickRecommendation()` (`lib/kaiHome.ts:63-151`) — fixed-priority branches, **ONE** recommendation, every branch states its `basis`. Proposed package-scoped sibling `pickPackageCandidate()` (PROPOSED, `lib/kaiPackage.ts`) applies the same fixed-priority-single-pick law restricted to tradelines not yet resolved and not already in flight — mirrors `alreadyInFlight` computation already built for campaigns (`lib/campaignInput.ts:78-80,102`).
- **Inputs**: `Tradeline.score`/`.probability` (`prisma/schema.prisma:231-232`, already consumed by `recommendStrategy()`, `lib/recommend.ts:23`) plus `Tradeline.disputeAngles` (`schema.prisma:234`) — populated by `lib/scoring.ts:104` today but consumed **only** by the strategist-plan prompt (`app/api/strategist/plan/route.ts:54`, `` `Angle: ${t.disputeAngles[0] || "standard reinvestigation"}` ``). Proposal: reuse `disputeAngles[0]` the same way, as the human-readable phrase inside Kai's `basis` line — an additive reuse of an existing-but-underused field, not a new scoring input.
- **ONE primary + alternatives**: the primary recommendation pre-selects the item entering the Review chain. Alternatives render through the **existing, unmodified** `RecommendationIntelPanel` (`components/kai/RecommendationIntel.tsx:23-65`) — its `alternatives`/`whyNotAlternatives` fields (`:39-48`) and closing line *"nothing predicted"* (`:60-61`, verbatim: *"Every line above is derived from your file and the statutes — nothing predicted."*) are reused as-is, never restated as a new promise.

### 2.3 Educational Explanation

- **Component**: `KaiWhy` (`components/kai/KaiWhy.tsx`) renders `Explanation` (`lib/explain.ts:21-28`) for the tradeline behind the package — **reuse, not a new build**. `explainTradeline()` (`explain.ts:6`, *"never fabricates: if a fact isn't in the data, it isn't asserted"*) already produces `observed`/`laws`/`contradictions`/`uncertainty` sections; uncertainty renders at the same visual weight as favorable evidence (`KaiWhy.tsx:62-66`, FTC clear-and-conspicuous parity).
- **§609/Metro-2 myth corrections preserved**: `lib/compliance.ts:34-35` scrubs *"§609 ... requires/compels/mandates deletion"* and *"Metro 2 ... requires deletion"* on any generated text; `lib/kai.ts:72` states the same rule as a hard compliance law for live Kai answers (*"Never perpetuate the '§609 letter forces deletion' or 'Metro 2 requires deletion' myths — §609 is a disclosure right; Metro 2 is a formatting standard."*). Both paths already exist; the Package Review's Educational Explanation inherits them by using the same `applyCompliance()` pass on any composed text, and the same statute data (`lib/statutes.ts` via `KaiWhy`'s `laws` section) for the deterministic path.
- **DISCLAIMER placement**: `EduBanner` (`components/Disclaimer.tsx:13-19`) at the top of the Review chain page, full `Disclaimer` (`Disclaimer.tsx:4-11`, wrapping `DISCLAIMER` from `lib/compliance.ts:58-59`) near the Approve control at the bottom — mirrors `/journey`'s existing placement exactly (`app/journey/page.tsx:188` top, `:281` bottom).

### 2.4 Approval moment — Kai steps back

Law, verbatim from existing code (`lib/mail/MailService.ts:125-132`): *"The ONLY approval path. A user — never Kai, never the system — approves."* `approve()` tags the transition `actor: "user"` unconditionally. Interface implication for Agent B: **the Approve control must never render inside a Kai-labeled panel** (`KaiSummary`, `RecommendationIntelPanel`, `KaiWhy`) — it belongs to the operator's own page chrome, positioned *after* all three Kai panels per the §1.9 chain order (`Kai Summary → Recommended Disputes → Educational Explanation → Letter Preview → PDF Preview → Approve`). Kai may explain up to that line; it may never sit on the button.

---

## 3. Notification Model

### 3.1 What the operator hears about, and when

| Moment | §1.10 stage | Hear about it? | v1 mechanism (in-app) | Future effect (FOUNDER-GATE) |
|---|---|---|---|---|
| Package approved | Approved | Confirmatory only — it's the operator's own action | Inline UI confirmation | — |
| Wallet authorized | Wallet Authorized | Yes | Inline UI + Case Memory entry | — |
| Submitted to Fulfillment | Submitted | Soft | Timeline entry (`/journey`, Mail Center) | — |
| Mailed | Mailed | Yes | KaiPresence deadline tracking begins (§611 clock) + timeline | email |
| Delivered | Delivered | Yes — real milestone | Case Memory "while you were away" (new `LABEL` entry, `lib/kaiSeen.ts:30-42`) + KaiPresence | email/push |
| Receipt archived | Return Receipt Archived | Soft | Timeline entry | — |
| Waiting window elapsed | Waiting Period boundary | Yes — actionable | KaiPresence deadline (existing pattern: `components/kai/KaiPresence.tsx:104-106`, *"The ... response window has passed."*) + `pickRecommendation()`'s lapsed branch (`lib/kaiHome.ts:85-94`) | push |
| Response logged / Ready for Next Review | Ready for Next Review | Yes | Kai Home recommendation (verified/lapsed branches) + Case Memory | email/push |

### 3.2 `notify.plan` alignment (decision-only)

`buildNotificationPlan()` (`lib/os/modules/notify/index.ts:66-97`) is the existing Layer-2 decision capability any future fulfillment notification would call: input `{channel, purpose, commercial, tenantId, recipientRef, event, content}` → output `{idempotencyKey, compliancePurposeClass, requiredHeaders, requiresPostalFooter, headerViolations, compliant}`. For fulfillment moments:

- `purpose`: e.g. `"package_delivered"`, `"waiting_elapsed"` — logical strings the app declares (`index.ts:29`).
- `commercial: false` always — every fulfillment notification is transactional/status, never marketing.
- `event`: stable id following the existing convention (`index.ts:33`, `"reset:<userId>:<tokenId>"`, `"digest:<userId>:2026-W29"`) → propose `"package:<packageId>:delivered"`.
- The function **returns a value and performs no effect** (`index.ts:135-136`) — it decides the idempotency key + CAN-SPAM header policy + hash-only digests; it does not send anything.

### 3.3 Effect layer remains designed-not-built (ADR-0027)

v1 fulfillment notifications ship **in-app only**: `KaiPresence` single-recommendation pill (`components/kai/KaiPresence.tsx`) + Case Memory "while you were away" (`lib/kaiSeen.ts`). Email/push are **FOUNDER-GATE** future effects, blocked on:

- **D-07** (ADR-0027 §4): `dispatch` marks the idempotency key even on failure and replay returns a synthetic `ok:true` — for an effect this would convert a transient send failure into *"permanent silent non-delivery reported as success."* A fulfillment-delivery email must not ship until this is a durable three-state ledger (`PENDING`→`COMMITTED`→`FAILED`).
- **D-08** (ADR-0027 §4): `authorize()` never sees the recipient — *"the recipient (`to`) is authorized by nobody"* today. A fulfillment notification carries the operator's own address; this still needs the recipient-ownership guard before it can ship.
- All **5 preconditions** in ADR-0027 §5 apply, especially precondition 5 (*"a NotificationCompliancePDP registered and mandatory... and a CCO approval gate before any user-facing credit communication path is enabled"*) — doubly binding here since fulfillment notifications **are** credit-communication content.

### 3.4 No postal channel — stated as fact, not a gap to fill

`NotifyChannel = "email" | "push"` only (`lib/os/modules/notify/index.ts:22`). ADR-0027 §1 is explicit that physical certified mail is *"a separate, stronger pipeline... with zero cross-imports to the notification path."* **"The package was mailed" is a fact Kai narrates in-app/email; the physical USPS delivery mechanism itself is never modeled as a `notify.plan` channel.** Flagged so no future implementer assumes `notify.plan` could carry postal evidence — it can't, and shouldn't (that pipeline already has its own certified-mail/tracking machinery per Agent A's provider abstraction).

---

## 4. Kai Presence Across the Room

### 4.1 One presence, no double-presence

`KaiPresence.tsx:101` already excludes `/dashboard` and `/journey` — *"Kai Home and the Kai-narrated timeline ARE Kai — no double presence."* **Interface expectation for Agent B**: once the evolved Mail Center / Case Journey view becomes a third Kai-owned surface (Room Constitution §1.8 requires Kai guidance on every operational room), `KaiPresence`'s exclusion list must extend to that route, or the floating pill will talk over the room's own embedded Kai voice. Agent B should confirm the final route name so this list stays correct.

Within the room itself: the existing per-row `kaiIntel: string[]` bullets (`lib/mailCenter.ts:266-272`) and the labeled `"recommendation"` timeline stage (`mailCenter.ts:215-216`) are the pattern a package-level Kai voice extends — additive bullets and one additional labeled stage, never a second floating presence inside the room.

### 4.2 Anti-overwhelm: one recommendation + one deadline

Verified in code, not aspirational: `app/api/kai/context/route.ts:14`, `const nextDeadline = kai.deadlines[0] ?? null;` and `:16-21` return exactly one `recommendation` and one `deadline`. With multiple packages in flight, this law **does not multiply per package** — Kai surfaces the single most urgent deadline across all open packages, reusing `deadlinesFrom()`'s existing sort-by-`daysLeft`-ascending (`lib/kaiHome.ts:42-58,56`) unchanged in spirit.

### 4.3 Four-phase presence grammar (quiet / staged / preparing / resolved)

Baseline per Program Brief §2.6 (RC2 room grammar, not re-derived here); mapped onto `KaiPresence`'s actual states:

| Phase | Maps to | Fulfillment-moment meaning |
|---|---|---|
| **Quiet** | `hasSomething = false` (`KaiPresence.tsx:103`), line *"Your file is quiet. I'm watching it."* (`:110`) | No package awaiting action; inside its statutory window with nothing new (§1.5) |
| **Staged** | Pulsing dot, panel closed (`hasSomething = true`, `:164-167`) | A package has a recommendation or a deadline queued; operator hasn't opened the panel yet |
| **Preparing** | Panel open, a real in-flight stage | **Only valid when a real `fulfillment.status`/`package.*` event has actually fired.** Never a spinner not backed by an event — same discipline as the `RESERVED` placeholder text (`lib/mailCenter.ts:224-230`) and `mailStatusLine()`'s `default: null` (`app/journey/page.tsx:56-58`): the codebase's established habit is to show **nothing** rather than a fabricated in-progress state. |
| **Resolved** | Package reached Delivered / Receipt Archived / Ready for Next Review | Tone shifts to pleased/good-news (§4.4); framing shifts from "watching" to "here's what's next" (§6) |

### 4.4 Emotional-range law applied to fulfillment moments

Per `lib/kaiStates.ts:7-9` (*allowed = calm · curious · attentive · focused · pleased · concerned. Never anger, fear, mania, sarcasm*):

| Fulfillment event | Kai state | Direction (verbatim) |
|---|---|---|
| `package.delivered` | `happy` / `good-news` | *"Quiet satisfaction delivering a positive fact. States the fact, then next watch-item — never gloats."* (`kaiStates.ts:43`) |
| `fulfillment.status = FAILED/RETURNED` | `concerned` | *"Steady and on it — slowed motion, amber accent on the PANEL never on Kai... Zero fear energy."* (`kaiStates.ts:46`) |
| A negative fact needing direct delivery (e.g. non-deliverable address) | `bad-news` | *"Concerned base + direct eye contact: fact, meaning, path forward in one breath."* (`kaiStates.ts:47`) |
| `waiting.ready_for_review` (verified/lapsed) | `explaining` / `teaching` | Claim → receipt → implication (`kaiStates.ts:49`) |

### 4.5 Copy examples per §1.10 stage (CROA-clean — process language only)

| Stage | Kai copy |
|---|---|
| Prepared | "This dispute package is ready for your review." |
| Approved | "You approved this package — next is wallet authorization." |
| Wallet Authorized | "Funding is authorized. CreditVector Fulfillment will accept it next." |
| Submitted | "Your package is with CreditVector Fulfillment now." |
| Accepted / Printing | "CreditVector Fulfillment accepted the package and is preparing it for mail." |
| Mailed | "Your package was mailed — the §611 clock started." (reuses `app/journey/page.tsx:100`'s exact pattern) |
| USPS Accepted | "The postal carrier has it." |
| Delivered | "Delivered. I'll let you know if anything else needs your attention." |
| Return Receipt Archived | "Your delivery evidence is archived with this case." |
| Waiting Period | "No action needed — the statutory clock is running." (reuses `ACTION["wait_response"]`, `lib/execution/ExecutionEngine.ts:123`) |
| Ready for Next Review | "A response window closed — I have a recommended next step when you're ready." |

Every line above is process/status language, no outcome promised — passes `applyCompliance`'s prohibited-phrase table (`lib/compliance.ts:3-36`) unmodified, and never names a vendor (L2).

---

## 5. Boundary Law Table

| Kai capability | Reads | Never | Enforcing mechanism |
|---|---|---|---|
| `askKai` (community Q&A) | `STRATEGIES`/`STATUTES`/`MODULES` constants; forum post (untrusted, fenced) | Reveal vendor/model; give legal advice; guarantee outcomes; execute anything | SECURITY & SCOPE block (`lib/kai.ts:58-64`); `applyCompliance` (`kai.ts:138`); `sanitizeForPrompt` (`kai.ts:89-91`) |
| `pickRecommendation` / Kai Home | Own tradelines/letters/reports (`lib/kaiHome.ts:182-188`) | Show >1 recommendation; assert a fact with no `basis` | Fixed-priority single-pick + mandatory `basis` (`kaiHome.ts:28,63-151`); CROA guard script referenced at `kaiHome.ts:62` |
| `KaiWhy` / `Explanation` | The item's own row + deterministic engines (`lib/explain.ts`) | Fabricate a "why"; use chain-of-thought | `explainTradeline` never asserts unstated facts (`explain.ts:6`) |
| `RecommendationIntelPanel` | `recommendationIntel()` output | Show historical outcomes below k-anonymity or without CCO sign-off | `consumerDisplayApproved` gate (`lib/recommendationIntel.ts:122-136`) |
| `KaiPresence` | `/api/kai/context` (own-user Kai Home data) | Auto-open; show >1 recommendation/deadline; double-render on a Kai-owned page | Never-auto-open + 400ms delay (`KaiPresence.tsx:50-62`); page exclusion (`:101`); single rec+deadline (`context/route.ts:14-21`) |
| Kai Case Memory (`KaiSeen`) | Own KaiEvents since last visit | Show a false "away" moment on a normal refresh; invent an event | 12h `AWAY_THRESHOLD_MS` (`kaiSeen.ts:14`); structured-only, no freeform AI memory (`kaiSeen.ts:6-7`) |
| Proposed package narration (`package.*`/`fulfillment.status`/`waiting.*`) | KaiEvent stream + Agent A's state-machine enum | Emit events itself; decide policy/eligibility/retries/routing; name the vendor | Emitter is always route/service code (L3); Policy Engine owns the state machine (Agent A); `MailProvider` abstraction (`lib/mail/MailProvider.ts:1-9`) |
| Kai Summary (proposed) | Own package/case rows, deterministically | Persist AI-composed prose server-side without founder gate | ADR-0006 + localStorage precedent (`app/strategist/AiPlan.tsx:8`) |
| Approval moment | — (no role) | Approve, fund, or submit anything | `MailService.approve()` is user-only by construction (`MailService.ts:125-132`) |
| `notify.plan` usage (proposed) | Package lifecycle facts | Decide the channel effect; guarantee delivery; carry PII in the plan | Layer-2 decision only, returns a value, no side effect (`lib/os/modules/notify/index.ts:135-136`); hash-only content/recipient (`index.ts:15-16,90-91`); effect layer not built (ADR-0027) |
| Wallet-moment narration (Agent C's authorize/consume/settle) | The fact that funding happened (`package.funded` event) | Compute the amount, decide authorization, touch the ledger | WalletLedger balance-by-fold is Agent C's alone (Program Brief §3, Agent C); Kai narrates the fact, never the number |

**Gap found, flagged as a PROPOSED addition**: unlike CROA phrasing, vendor-name leakage (L2) has **no automated scrubber today** — `applyCompliance`'s `PROHIBITED` table (`lib/compliance.ts:3-36`) contains no rule for `letterstream`/`lob`/`postgrid`/`click2mail`/`postalmethods`. Enforcement of L2 is currently **discipline-only** (copy review), not a compiled guard. Recommend Agent A/E consider a defense-in-depth regex (e.g. `/letterstream|postgrid|click2mail|postalmethods|\blob\b/i`) added to the compliance scrubber or a Kai-specific pre-render check, so vendor-name leakage fails the same way a guarantee-phrase does today.

---

## 6. Next Recommendation Loop

Closing the cycle: **Return Receipt Archived → Waiting Period → Ready for Next Review → (back to) Case → Kai Analysis.**

1. **`waiting.started`** fires when `package.mailed` lands. Clock = `REINVESTIGATION_DAYS` (`lib/kaiHome.ts:13`; `lib/forecast.ts:10`). `forecastFor()` (`forecast.ts:70-98`) supplies the own-history note (min sample 3) and the two-path contingency — reused verbatim, not re-derived.
2. **`waiting.ready_for_review`** fires on one of the same two deterministic triggers `pickRecommendation()` already encodes (`lib/kaiHome.ts:68-94`):
   - branch 1 — a response logged **"verified"** with no follow-up round yet (*"the highest-uncertainty moment in the journey"*), or
   - branch 2 — the window **fully lapsed** with nothing logged.
   This is a **label Kai's narration applies to an already-true fact** — it is never a state Kai stores or owns; Agent A's state machine is the source of truth for whether the round2 gate is actually open.
3. **Round2 gate precedent** (`app/api/letters/[id]/round2/route.ts:32-43`, exact): refuses with 400 *"Log the bureau's response first, then generate Round 2"* if `parent.responseText` is unset; refuses with 400 *"This item was reported deleted — no escalation needed. 🎉"* if `parent.responseOutcome === "deleted"`. Kai's "Ready for Next Review" recommendation must **never** offer escalation before this gate opens, and must never frame a "deleted" outcome as needing escalation — the route's own 🎉 confirms that branch is a happy terminal, not a failure Kai should treat with `concerned`/`bad-news` states.
4. **`ExecutionEngine` orchestration** (`lib/execution/ExecutionEngine.ts`) is the same "what should I do today" pattern, unmodified — `assembleExecution()` is pure, cites sources, no AI (`ExecutionEngine.ts:213-239`). Its existing `ACTION` map already has the exact slot this loop needs: `round_2: "Review the response and open the next round"` (`ExecutionEngine.ts:118`). A future Package-shaped `Mission` type slots into this table the same way — this is the same engine, not a new one.
5. **Closing the loop**: after the operator acts, either a Round N+1 letter is generated via the existing `/round2` route, or `pickRecommendation()`'s branch 5 (*"analyzed items on file with zero letters generated"*, `lib/kaiHome.ts:138-148`) surfaces the next undisputed item. The Dispute Package wrapper changes the operator-facing container; it does not change `pickRecommendation()`'s decision order — that five-branch priority ladder **is** the loop, already built.

**Interface dependency on Agent A**: once the Package entity exists, `pickRecommendation()`'s DB reads (`kaiHome.ts:184-186`, currently `prisma.tradeline/letter/report.findMany`) need a Package-aware read too. The priority order and the "one recommendation + basis" law carry over unchanged — only the query surface grows.

---

## Interface Expectations (for Agent E merge)

- **Agent A** (domain/state machine/policy engine): owns the authoritative state-machine mapping for `fulfillment.status`'s granular values (§1.1 row 6/7/9 are illustrative, not final); owns whether `waiting.started`/`waiting.ready_for_review` are persisted Bus events or derive-on-read (§1.3, open question); is the only source of truth for whether the round2/next-package gate is actually open (§6.2) — Kai's narration is a downstream label, never a second copy of that decision.
- **Agent B** (Mail Center / Case Journey UX): needs to confirm the final route(s) that become Kai-owned so `KaiPresence.tsx:101`'s exclusion list extends correctly (§4.1); the per-row `kaiIntel[]`/labeled-timeline-stage pattern (`lib/mailCenter.ts:215-216,266-272`) is the slot Kai's package narration extends into — additive bullets + one additional labeled stage, not a new floating surface; the Approve control must sit outside all three Kai panels per the §1.9 chain order (§2.4).
- **Agent C** (wallet): owns `package.funded`'s Event Bus contract and the authorize→consume→settle mapping; Kai only narrates that funding happened via a refs-only `{packageId, authorizationRef}` payload (§1.2, §5) — no amount, no ledger detail ever reaches Kai's copy or its `KaiSummary`/`KaiPresence` surfaces.
