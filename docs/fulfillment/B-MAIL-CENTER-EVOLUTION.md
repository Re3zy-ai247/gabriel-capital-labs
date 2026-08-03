# B-MAIL-CENTER-EVOLUTION.md — Mail Center → Case Journey Workspace

Agent B (Mail Center Evolution) — architecture only, per `docs/fulfillment/PROGRAM-BRIEF.md`. No product code, no schema, no dependency, no vendor change. Every claim below is either **VERIFIED** (direct citation to this worktree, path + line) or **PROPOSED** / **FOUNDER-GATE** (labeled inline). Program Brief §0–§2 (repository truth digest) is treated as ground truth and not re-derived — one discrepancy found during verification is flagged, not silently resolved (§1.4).

**Baseline:** CXOS RC2 checkpoint `feat/cxos-living-environment-engine-rc2@0e0f9be` (product behavior `f7ee9c5`); released code otherwise byte-identical to `origin/main@f449c35`. Cross-referenced against `docs/fulfillment/D-KAI-EXPERIENCE.md` (Agent D, already written at verification time) for interface consistency — adopted where it resolves a question this document would otherwise have to guess at; attributed inline as "per D-KAI-EXPERIENCE.md".

**Route naming — answers Agent D's open dependency (D §4.1, D Interface Expectations for Agent B) up front:**

| Room | Route | Status |
|---|---|---|
| Mail Center / Case Journey workspace | `/mail` (`app/mail/page.tsx` evolves in place) | Kai-owned per Room Constitution §1.8 — add to `KaiPresence.tsx`'s exclusion list alongside `/dashboard`, `/journey` |
| Package Review chain | **PROPOSED** rename `app/mail/send/[letterId]` → `app/mail/send/[packageId]` (§3.6) | Kai-owned (Kai Summary / Recommended Disputes / Educational Explanation panels live here per D §2.1–2.3) — add this route pattern too |

---

## 1. Diagnosis

### 1.1 What `/mail` is today

`app/mail/page.tsx` is a **read-only projection**, by its own header comment (`app/mail/page.tsx:14-17`): *"the source of truth for 'did my dispute go out, and what happens next?' Server-rendered, deterministic, zero AI, zero network."* Concretely:

- A `StatCard` metrics grid is the **first** thing rendered (`app/mail/page.tsx:64-77`) — six stats, then a second row of per-round counts, before a single dispute is shown.
- Below that, `rows.map(...)` (`:92-163`) renders one `<details>` per dispute, DB-order (`orderBy: { createdAt: "desc" }`, `:24`) — no sort by urgency, no cross-row ranking.
- Each row's disclosed body has: a Kai-intel bullet list (`:121-130`, from `row.kaiIntel`) and a 12-stage timeline (`:133-154`, see §1.4 below) — but the **only interactive elements on the entire page** are the `<details>` toggle and two outbound `<Link>`s (`:157-158`, "Open in Dispute Letters →" / "See the full case timeline →"). **Zero on-page actions** — matches Program Brief §2.1 exactly.
- Empty state (`:82-90`): icon + one Kai-voiced line + a single CTA to `/letters`.

`lib/mailCenter.ts` is the pure engine behind this: `buildMailCenter()` (`:247-318`) computes a 6-state health enum (`MailHealth`, `:31-33`: `WAITING_NORMALLY | NEEDS_ATTENTION | RESPONSE_RECEIVED | READY_FOR_ROUND_2 | ESCALATION_AVAILABLE | COMPLETED`) and, per row, a **single deterministic recommendation string** (`recommendationFor()`, `:151-179`) — this already exists, it is just never promoted above row level.

### 1.2 The Room Constitution gap

Program Brief §1.8 (Room Constitution proposal): every primary room presents *current work, current state, recommended action, Kai guidance, evidence, timeline*, with metrics as context only. Mapped against what exists:

| Room Constitution element | Today (`/mail`) | Verified gap |
|---|---|---|
| Current work | No queue, no prioritization — a flat DB-ordered list | No answer to "what needs me right now" across rows |
| Current state | 6-state health pill per row (`mailCenter.ts:31-52`) | Present, but not used to sort/group the page |
| **Recommended action** | `recommendationFor()` output exists per row (`mailCenter.ts:151-179`) but is buried as the *last* Kai-intel bullet (`mailCenter.ts:272`) inside a collapsed `<details>` | No single, page-level "do this first" — the room does not answer its own mandated question |
| Kai guidance | `kaiIntel: string[]` per row (`mailCenter.ts:266-272`) | Present, correctly scoped, just not promoted |
| **Evidence** | None. No delivery evidence, no return receipt, no re-preview of the letter from this page | Genuinely absent — `ProofArtifact` / `TrackingInfo` (`lib/mail/MailProvider.ts:71-91`) have **zero UI consumers anywhere in the app** today (verified: no `retrieveProof`/`retrieveTracking` call site outside `lib/mail/MailService.ts` itself) |
| Timeline | Per-row 12-stage timeline exists (§1.4) | Present and mostly sound — extend, don't rebuild |
| Metrics | **First** visual element on the page (`:64-77`) | Inverted priority vs. §1.8's "context only" |

**Verdict:** the room has almost all the raw material (`recommendationFor`, `kaiIntel`, the health enum, the timeline) already computed — the gap is **presentation ordering and promotion**, not missing intelligence. This bounds the evolution to a layout/composition change over existing pure functions, not a new engine.

### 1.3 Zero-actions-on-page, precisely

Confirmed by full read of `app/mail/page.tsx`: the only `<button>`-like affordances anywhere on the page are inside the two outbound links. There is no Approve, no Send, no Download, no "log a response" control on `/mail` itself — every action happens on a different page (`/letters`, `/mail/send/[letterId]`, `/journey`). This is the second concrete gap the evolution closes (§2.3).

### 1.4 Verification discrepancy, flagged (not silently corrected)

Program Brief §2.1 describes the row timeline as a **"9-stage timeline (last 6 stages placeholder)."** Direct read of `lib/mailCenter.ts:197-230`'s `buildTimeline()` counts:

- 6 non-placeholder stages declared in the literal array (`:198-219`): `generated`, `mailed`, `window`, `response`, `recommendation`, `resolved`;
- plus 6 placeholder stages pushed by the trailing loop (`:224-230`): `payment`, `provider_print`, `carrier`, `delivery`, `tracking`, `certified`.

That is **12 total, 6 placeholder** — not 9 total / 6 placeholder. Flagging for Agent E to reconcile against the Brief; this document uses the verified 6+6=12 count in §2.5 and §7, since it is read directly from source rather than re-derived.

---

## 2. The evolved Mail Center (Case Journey workspace)

Section-by-section evolution of `app/mail/page.tsx`. Nothing here changes `lib/mailCenter.ts`'s "zero AI, zero network" contract (`mailCenter.ts:1-8`) — every addition is a new pure function or a re-composition of existing outputs.

### 2.1 Layout evolution, by region

| Region | Today | Lines | Evolved | Change type |
|---|---|---|---|---|
| Header + intro | Title "/ Mail Center", one paragraph | `:52-61` | Same header; copy updated to Case Journey vocabulary (§8) | Copy only |
| Metrics grid | `StatCard` × 6 + round counts, **first** on page | `:64-77` | Same `StatCard` component, **repositioned** below the recommendation band, as a compact context strip | Reposition, no data change |
| — | *(nothing today)* | — | **NEW**: "Do this first" recommendation band, top of page | New composition over existing data (§2.3) |
| Dispute list | Flat `rows.map`, DB order, disclosure-only | `:80-164` | Prioritized work queue: sorted by a health-priority ladder; per-row primary CTA becomes a real on-page action button; nested evidence sub-disclosure added | Evolve |
| Empty state | Icon + line + 1 CTA | `:82-90` | Same idiom, Case Journey copy | Copy only |
| Per-row timeline | 12-stage `<ol>`, `StageIcon` | `:133-154`, `:171-178` | Same rendering component and `StageState` vocabulary (`done/current/pending/placeholder`), stage **array** extended to the canonical §1.10 list (§2.5) | Evolve data, reuse component |

### 2.2 Work queue: evolving the 6-state health pill + rows

The pill itself (`HEALTH_LABEL`/`HEALTH_TONE`, `mailCenter.ts:35-52`) is unchanged — six states stay six states, unchanged copy, unchanged tone tokens. What changes is **queue order**:

- Replace `orderBy: { createdAt: "desc" }` (`app/mail/page.tsx:24`, a Prisma-level sort) with a **priority ladder** applied after `buildMailCenter()` runs, mirroring the *fixed-priority, single-pick* law already used by `pickRecommendation()` (`lib/kaiHome.ts:60-67`: *"ONE recommendation at a time (KAI-PRODUCT-DESIGN §7 anti-overwhelm law), picked by fixed priority"*) — applied here as a **sort**, not a single pick, since a queue (unlike a recommendation) legitimately shows more than one row.
- Proposed ladder (mirrors `recommendationFor()`'s own internal priority, `mailCenter.ts:151-179`, and `pickRecommendation()`'s rule order, `kaiHome.ts:68-149`): `ESCALATION_AVAILABLE` → `NEEDS_ATTENTION` → `RESPONSE_RECEIVED` (verified sub-case) → `READY_FOR_ROUND_2` → `WAITING_NORMALLY` → `COMPLETED`.
- Optional grouping into labeled bands, following the **rendering** idiom already visible in `components/mission/ExecutiveQueue.tsx:25` (`buckets.filter((b) => b.items.length > 0)`, each with a `label`/`blurb`) — Mail Center would compute its **own** 2–3 bands (e.g. "Needs you," "Waiting," "Done") over its own rows; it does **not** import the dashboard's bucket-computation internals (`lib/execution/ExecutionQueue.ts`), only echoes the same "small number of labeled, non-empty groups" pattern.
- **Invariant preserved:** this is purely a new sort/group key computed from data `buildMailCenter()` already returns (`row.health`) — no new query, no new per-row computation.

### 2.3 "Do this first" — the recommended-action band

Cites both required precedents:

1. **Executive-Queue idiom** — `components/mission/ExecutiveQueue.tsx:38-39`: `<HeadTile ... label="Do this first" title={today ? today.title : "You're all caught up"} sub={today ? today.requiredAction : "No action waiting on you."} href={today?.href} />`. This is the exact "one answer, one headline, one link" shape to replicate.
2. **`pickRecommendation()` anti-overwhelm law** — `lib/kaiHome.ts:60-67`: one recommendation, fixed priority, every branch states its `basis`; final branch (`:150`) *"quiet is allowed (no manufactured urgency)"*.

**Evolution, precisely scoped:** add one new pure function to `lib/mailCenter.ts`, e.g. `pickQueueRecommendation(rows: MailCenterRow[]): { title: string; sub: string; href: string; basis: string } | null`. It performs **only a cross-row ranking** over `MailCenterRow[]` that `buildMailCenter()` already produces — it does **not** recompute `recommendationFor()`'s per-row text (reused verbatim as `sub`). When no row needs action, render the exact `ExecutiveQueue` empty copy ("You're all caught up") for visual/voice consistency across rooms.

**Visual system note (invariant):** the band is built with Mail Center's **own** existing `card`/`pill`/`btn-*` Tailwind classes (already used throughout `app/mail/page.tsx`), not by importing `components/mission/mc.module.css` (the `gxl` module) — that module is Mission-Control-scoped (`app/dashboard/page.tsx:24,66`: `gxl.room`, `gxl.folio`, etc.). Reusing the GXL CSS module in a second room would be new cross-room CSS coupling this document does not propose.

### 2.4 Evidence access — the per-package drawer

**Genuinely new UI surface.** The data types already exist and are unused:

- `TrackingInfo` / `ProviderStatus` (`lib/mail/MailProvider.ts:71-83`) — provider tracking milestones.
- `ProofArtifact` (`lib/mail/MailProvider.ts:87-91`) — `kind: "proof_of_mailing" | "return_receipt" | "delivery_scan" | "tracking_page"`.
- `MailService.syncTracking()` and the implicit `retrieveProof()` provider call (`lib/mail/MailService.ts:193-220`) exist on the service **but no route calls them today** (verified: no call site outside `MailService.ts` itself).

**Proposed drawer contents**, nested inside each row's existing `<details>` (a second-level disclosure, not a new page):

| Evidence item | Source (once wired) | Today |
|---|---|---|
| The letter | Link to `/letters/print/[id]` (existing route, reused verbatim) | Already linkable — not surfaced from `/mail` |
| Delivery evidence / tracking | `MailProvider.retrieveTracking()` → `TrackingInfo.milestones` | **First UI consumer** — currently zero |
| Return receipt | `MailProvider.retrieveProof()` → `ProofArtifact[kind="return_receipt"]` | **First UI consumer** — currently zero |

**No-fabricated-telemetry invariant:** every drawer field renders the existing `RESERVED` placeholder text (`mailCenter.ts:84`, `"Available after live mail integration."`) until a real `ProofArtifact`/`TrackingInfo` exists — this is the **same** discipline `buildTimeline()`'s placeholder loop already applies (`mailCenter.ts:224-230`), extended to a new surface rather than invented fresh. This independently satisfies (and predates) the CXOS Bible's §9.1 "fabricated truth" prohibition (`CXOS_LIVING_ENVIRONMENT_ENGINE_CINEMATIC_BIBLE.md:417-424`) — cited for cross-reference only; Mail Center's own `RESERVED` constant is the binding precedent, not the Bible.

### 2.5 Timeline integration — evolving `buildTimeline()` onto the canonical stages

Per §1.4's verified count, today's per-row timeline has 12 stages (6 real + 6 placeholder). Program Brief §1.10 defines a **different** canonical 12-stage list: `Prepared → Approved → Wallet Authorized → Submitted → Accepted → Printing → Mailed → USPS Accepted → Delivered → Return Receipt Archived → Waiting Period → Ready for Next Review`.

**Evolution:** `buildTimeline()`'s stage array is re-populated to emit the canonical list, reusing the **identical** `TimelineStage` shape (`mailCenter.ts:59-65`: `{ key, label, state, at, description }`) and the **identical** four-value `StageState` vocabulary (`done | current | pending | placeholder`, `:54-57`) the page already renders via `StageIcon` (`app/mail/page.tsx:171-178`) — zero component change, only the data the function returns changes.

**Scope boundary (important):** Agent B does **not** own the mapping from Agent A's unified state machine (16 manifest states + `LetterStatus`) onto these 12 canonical stages — that is explicitly Agent A's `A-STATE-MACHINE.md`. Agent B's UI is a **consumer**: ready to render whatever ordered `TimelineStage[]` the evolved `buildTimeline()` emits, ranked and labeled by Agent A's mapping. Per D-KAI-EXPERIENCE.md §1.1/§1.4, Kai's narration for each stage rides in the **existing** `description` field (same slot `{ key: "recommendation", label: "Kai's recommendation", ... }` already occupies today, `mailCenter.ts:215-216`) — an additional labeled row, never a rewrite of a factual stage.

### 2.6 Metrics — demoted to a context strip

`StatCard` grid (`app/mail/page.tsx:64-77`) moves from first-on-page to a compact strip below the "Do this first" band. No data changes: `stats.delivered` stays `null` → `"—"` (`:70`, `hint="after provider mailing"`) until truthfully live — the honesty of a `null`/`"—"` metric is itself an existing invariant, preserved as-is.

### 2.7 Empty / zero states

Existing idiom (`app/mail/page.tsx:82-90`): icon + one Kai-voiced sentence + one primary CTA. Evolution is copy-only (§8) — same structure, same single-CTA discipline, no new empty-state pattern invented.

---

## 3. Package Review flow (§1.9 chain)

Chain: **Client → Kai Summary → Recommended Disputes → Educational Explanation → Letter Preview → PDF Preview → Approve → Download → Send with CreditVector Fulfillment.**

### 3.1 Chain-to-file mapping

| # | Step | Evolves from | What's new |
|---|---|---|---|
| 1 | **Client** | `lib/session.ts` `currentUser()` (`:39-63`) + `components/AgencyBar.tsx` (already global via `AppShell.tsx:25`) | **Nothing.** Client context is already resolved before the wizard loads (§5). No dedicated screen. |
| 2 | **Kai Summary** | *(new panel)* | Per D-KAI-EXPERIENCE.md §2.1: **PROPOSED** `components/kai/KaiSummary.tsx` + `lib/kaiPackage.ts`, server-rendered, zero client JS — same discipline as `KaiWhy`. Agent B adopts these names rather than proposing competing ones. |
| 3 | **Recommended Disputes** | `app/letters/page.tsx`'s tradeline/strategy/bureau selection UI (`:217-330`: item select, strategy select with "★ recommended" marker, bureau toggles) | Per D §2.2: **PROPOSED** `pickPackageCandidate()` in `lib/kaiPackage.ts` (one primary pick + `basis`); alternatives render through the **existing, unmodified** `RecommendationIntelPanel`. See §3.5 boundary note. |
| 4 | **Educational Explanation** | Existing strategy blurb/riskNote copy (`app/letters/page.tsx:244-249`) + statute logic already in `lib/mailCenter.ts` `windowText()`/`recommendationFor()` (§611/§623/FDCPA §1692g, `:97-100,131-146`) | Per D §2.3: reuses the **existing** `KaiWhy` component verbatim — becomes its own dedicated chain step rather than inline copy. |
| 5 | **Letter Preview** | The existing side-link "Open the exact letter (PDF preview) →" (`app/mail/send/[letterId]/page.tsx:186-188`) | Promoted from a side link to an embedded chain step. |
| 6 | **PDF Preview** | `app/letters/print/[id]/page.tsx` + `PrintActions.tsx` (unchanged, same route) | **FOUNDER-GATE, restated:** this is browser print-to-PDF (`PrintActions.tsx:8`, `window.print()`) — no PDF library exists in the dependency tree, no download endpoint exists (verified: no `pdf-lib`/`jspdf`/`puppeteer` import in `lib/mail/*` or `app/letters/*`). A real generated-PDF artifact is a new-dependency decision, not assumed here. |
| 7 | **Approve** | Existing `Approval()` component (`app/mail/send/[letterId]/page.tsx:165-205`) → `POST /api/mail/:id/approve` | **Structural change required** — see §3.2. |
| 8–9 | **Download / Send with CreditVector Fulfillment** | Existing `Payment()` component (`:207-246`) → `POST /api/mail/:id/confirm`; existing download-fallback links (`:112,201`) | Promoted from a de-emphasized fallback to a **co-equal, always-rendered fork** — see §3.4. Wallet Authorization (new, Agent C) inserts between Approve and this fork. |

### 3.2 The Approve step must split — a concrete, code-grounded finding

D-KAI-EXPERIENCE.md §2.4 states a binding law: *"the Approve control must never render inside a Kai-labeled panel... it belongs to the operator's own page chrome."* Checked against the actual JSX:

- `Approval()` (`app/mail/send/[letterId]/page.tsx:165-205`) **today** opens with a KAI badge + heading in the same `<div className="card p-5">` (`:168-171`: `<span>KAI</span><h2>Review your dispute before it's mailed</h2>`), and the `Approve & continue` button (`:198-200`) sits **inside that same card**.
- `Payment()` (`:207-246`) has **no** KAI badge — already compliant with D's law as written.
- `Receipt()` (`:248-283`) has **no** KAI badge — already compliant.

**Evolution required:** split today's single `Approval()` card into (a) a Kai-labeled explanation section (recipient/round/address/price context — Agent D's Kai Summary territory) and (b) a separate, non-Kai-labeled operator-chrome section holding only the Approve button and the Download/Send fork. This is the one place the existing wizard structurally conflicts with Agent D's proposed law; flagging precisely rather than silently reshuffling.

### 3.3 Resumability

Existing precedent, generalizes cleanly: `load()`'s status→step mapping (`app/mail/send/[letterId]/page.tsx:66-68`) — `QUEUED→step 3`, `APPROVED|PAID→step 2`, else `step 1` — is the **server-status-derived resumability pattern**. The 9-step chain extends this identically: on load, resolve the Package's canonical stage (Agent A's domain) to the corresponding chain-step index and render there. No new resumability mechanism; same `useEffect(() => { load(); }, [...])` shape.

### 3.4 The two-option law (§1.4)

Program Brief §1.4: *"Operators always have two options: Download Package or Send with CreditVector Fulfillment."* Today this exists only as a **secondary, de-emphasized** link in three places:

- Error-state fallback (`app/mail/send/[letterId]/page.tsx:112`, "Download & mail it yourself →");
- Inside `Approval()` as a ghost-style secondary link (`:201`, "Or download & mail it yourself");
- In `app/letters/page.tsx`, the fulfillment path itself is the de-emphasized one — `"Mail via CreditVector (soon)"` renders as a `text-slate-400` ghost button (`:386-388,615-617`) while `"Mark mailed myself"` is the primary button. This is an **inverted visual priority**, deliberate today because `MAIL_LIVE` is off — not a bug, but a fact to plan around.

**Evolution:** at the terminal fork (chain steps 8–9), render **Download Package** and **Send with CreditVector Fulfillment** as co-equal primary actions, side by side — not sequential gates. **Interpretation note:** the Brief's §1.9 numbering lists Download (8) before Send (9); this document treats that as chain *position*, not a forced order — both options are simultaneously available at that point, consistent with §1.4's "always both" law. Self-mail remains first-class: the existing "Mark mailed myself" path in `app/letters/page.tsx` (`:381-383,611-613`) is unaffected by this evolution and stays the immediate, zero-friction option it is today.

### 3.5 Boundary note — overlap with `app/letters/page.tsx` (open question for Agent E)

Chain steps 2–4 (Kai Summary, Recommended Disputes, Educational Explanation) conceptually **overlap** with functionality that lives today in `app/letters/page.tsx`: the tradeline/strategy selector, the "★ recommended" marker, the risk-note/blurb copy, and the "Kai's insight" panel (`:316-325`). `app/letters/page.tsx` is **not** named in Agent B's assignment (Program Brief §3) and is therefore not evolved by this document. Two resolutions are possible and neither is decided here:

1. Package Review becomes the **single** entry point for the whole case-to-send journey, absorbing `app/letters/page.tsx`'s selection UI into chain steps 3–4; or
2. `app/letters/page.tsx` stays the generation entry point, and Package Review's steps 2–4 render a **read-only summary** of choices already made there.

Flagged for Agent E — this is a scope seam found during verification, not decided unilaterally here since it touches a file outside this document's assignment.

### 3.6 Boundary note — Dispute Package vs. the existing Campaign entity

**Verified, not in the Brief's §2 digest:** `app/api/mail/[mailId]/confirm/route.ts:30-49` enforces a "CAMPAIGN GATE (Sprint XII, ADR-0012)" — *"every mailed dispute must belong to a campaign... a coherent single-item campaign is created + approved for exactly this dispute (a lone send is never blocked)"* — backed by `lib/campaignInput.ts`'s `campaignService()`/`buildComposerItems()`. **Every letter mailed today already wraps in a Campaign,** even a lone one. This was flagged here as an open question for Agent A.

**Resolved since, cross-checked against `A-DOMAIN-MODEL.md` §2.2–2.3 (already written):** `DisputePackage` does **not** replace `Campaign` — it is "the fulfillment-facing identity materialized when a Campaign is approved" (`A-DOMAIN-MODEL.md:123`), holding `campaignId` + fulfillment-only facts. Package cardinality is confirmed **1:N letters** (`A-DOMAIN-MODEL.md:112`: *"a package's N letters routinely target N different recipients... a `DisputePackage` therefore owns a join to N `(Letter, MailManifest)` pairs"*) — this **confirms** the route-rename direction proposed at the top of this document (`[letterId]` → `[packageId]`) and confirms chain step 3 ("Recommended Disputes," §3.1) genuinely needs to render a multi-item checklist, not a singleton.

**New item surfaced by Agent A, not by this document — noted for completeness:** `A-DOMAIN-MODEL.md:125` flags that `Campaign` is self-heal (not a Prisma model) while `DisputePackage` is proposed migration-backed, so `DisputePackage.campaignId` cannot be a real FK — reported to Agent E as unresolved, **PROPOSED** either way. This does not change anything in this document's UI-layer proposal (Agent B's work queue and Package Review chain read `DisputePackage`, not `Campaign`, either way).

---

## 4. Approval + wallet moments in the UX

### 4.1 Approval capture (existing precedent, reused as-is)

`POST /api/mail/[mailId]/approve/route.ts` — *"The customer's explicit approval. Kai never approves — this is the only path to APPROVED"* (`:7-8`) — calls `MailService.approve()` (`lib/mail/MailService.ts:125-132`, tags the audit entry `actor: "user", event: "user.approved"`). This is the exact, already-auditable approval mechanism Agent A's Package-level approve endpoint is expected to mirror 1:1 (see §7's endpoint table). No UI change needed to the *mechanism* — only the card-split in §3.2.

### 4.2 Wallet authorization surfacing — and a pricing-transparency gap found in verification

Program Brief §4 (compliance constitution): *"Certified-mail pricing must be transparent before wallet authorization."* Today's `Payment()` step already shows a transparent, itemized price breakdown **before** the confirm action (`app/mail/send/[letterId]/page.tsx:212-227`, `p.lines.map(...)`) — this is the correct precedent to evolve, just relabeled from "Confirm" to the Wallet Authorization moment once Agent C's wallet exists.

**Gap found:** the certified-mail line is currently a **hardcoded placeholder**, not real data — `:219-221`: `<span>Certified mail</span><span className="italic">Available after live mail integration</span>`. Tracing why: `app/api/mail/prepare/route.ts:46` sets `certified: false` in the `MailPieceSpec` by default (Program Brief §1.3 requires Dispute Packages to *always* use certified mail — so this default itself is expected to flip under Agent A's Policy Engine). Even once `certified: true`, the surcharge would **not** automatically render as its own transparent line: `LetterStreamProvider.estimateCost()` already itemizes it correctly at the provider level (`lib/mail/providers/LetterStreamProvider.ts:104-106`: `{ label: "Certified + return receipt", cents: RATE.certified }`, i.e. `+495¢`), but `MailPricing.computePrice()` **collapses** the entire provider estimate into one lump `"Postage & printing"` line (`lib/mail/MailPricing.ts:98`) and never re-exposes the provider's own itemized `CostEstimate.breakdown`. **This means today's `PriceBreakdown.lines` — the exact array the wallet-authorization screen would render — cannot surface "certified mail: $4.95" as its own line without a change in `lib/mail/MailPricing.ts` or the UI reading `CostEstimate.breakdown` directly.** That change is Agent A's / the Policy Engine's, not Agent B's — flagged as an interface expectation (§ Interface Expectations, Agent A), not designed here.

**Cross-confirmed since by both Agent A and Agent C (already written):** `A-POLICY-ENGINE.md:115,125,137,141` independently found the identical `certified: false` hardcode and states the Policy Engine's law 4: *"Certified mail is not a policy computation — it is a constant... there is no input combination that produces `false`"* — reported to Agent E/Founder, not fixed in-doc, same posture taken here. `C-WALLET-INTEGRATION.md §4.6` (`:505-511`) independently assigns this exact UX moment to Agent B: *"The full `PriceBreakdown`... or the Policy Engine's equivalent — must render before the Approve → Wallet Authorized transition fires, never as a surprise after."* This document accepts that assignment; the specific mechanism (fix `MailPricing.ts`'s line-collapsing vs. have the UI read `CostEstimate.breakdown` directly) remains the one open item neither A nor C's document resolves either — restated in Interface Expectations below.

### 4.3 Post-submit stages — the operator's view stays a truthful timeline

Every stage the operator sees after Send renders through the **same** truthful mechanisms already in production:

- `lib/mailCenter.ts`'s `StageState` vocabulary (`done|current|pending|placeholder`) and `RESERVED` constant (§2.4, §2.5);
- `app/journey/page.tsx`'s `mailStatusLine()` (`:46-59`) — *"provider stages (printed/delivered/…) aren't reached until live mailing"* (`:57`), returning `null` (nothing rendered) for any status the product can't yet back with truth.

Kai's **narration copy** for each of the 12 canonical stages is already proposed in D-KAI-EXPERIENCE.md §4.5 (e.g. *"Delivered. I'll let you know if anything else needs your attention."*) — Agent B's evolved timeline consumes those lines through the existing `TimelineStage.description` field (`mailCenter.ts:64`) unchanged in shape; this document does not re-propose competing copy for the same moments (§8 covers *operator/page-chrome* copy specifically, a different registry from Kai's first-person narration).

---

## 5. Agency vs. consumer

**No new room, scoped data — verified mechanism, not proposed:**

- `lib/session.ts` `currentUser()` (`:39-63`): for an `isAgency` account with `WORKSPACE_COOKIE` (`"gcl_client"`, `:8`) set to a client validated against `managedByAgencyId`, **every** server component and API route — including the evolved `/mail` — resolves `user.id` to that client's id automatically. Zero Mail-Center-specific code required.
- `components/AgencyBar.tsx`, rendered globally in `AppShell.tsx:25`, shows *"Working in [client]'s workspace"* + "Exit to agency" (`AgencyBar.tsx:35-44`), fetching context from `GET /api/agency/context` (`app/api/agency/context/route.ts`).
- `app/mail/page.tsx` already calls `currentUserOrDemo()` (`:19`) exactly like every other `AppShell` page — it inherits agency scoping **today**, before any of this evolution ships. The evolved work queue, recommendation band, and evidence drawer all read from the same resolved `user`, so they scope identically with no new code.
- For a plain consumer (`isAgency = false`), `currentUser()` returns the account itself and `AgencyBar` renders `null` (`AgencyBar.tsx:22`) — same room, no banner, no behavior branch needed in `app/mail/page.tsx`.

**Naming caution (two different "agency" mechanisms — do not conflate):** `app/api/mail/prepare/route.ts:49` computes a *separate* `isAgency` flag (`Boolean(user.isAgency) || plan === "agency" || plan === "agency_pro"`) that feeds `MailPricing`'s **agency markup discount** (`lib/mail/MailPricing.ts:32-33`, `agencyMarkupRate`). This is a billing-tier concept, unrelated to the `WORKSPACE_COOKIE` workspace-scoping mechanism above. Both are legitimately called "agency" in the codebase; the evolved Mail Center touches only the session-scoping one.

**Explicit boundary:** a cross-client "book of business" view (e.g. "23 packages need attention across 14 clients") is **out of scope** for this document — the `AgencyBar` precedent is one-client-workspace-at-a-time by design. If an agency wants an aggregate queue across all managed clients, that is a different feature (likely surfacing on the existing `/agency` dashboard, not `/mail`), not something this evolution introduces.

---

## 6. CXOS adoption note (FOUNDER-GATE — one paragraph, no design)

The evolved Mail Center follows the **operational grammar** (current work → state → one recommendation → Kai guidance → evidence → timeline, Program Brief §1.8) inside today's product idiom — `AppShell` (`components/AppShell.tsx`: Sidebar, header, `ImpersonationBanner`, `AnnouncementBanner`, `AgencyBar`, `main`, `KaiPresence`, `MobileNav`) plus the Executive-Queue "one recommendation" pattern already live on `/dashboard` — starting now, with no CXOS dependency. Full **CXOS Living Environment chamber adoption** is a separate, Founder-gated decision (Program Brief §0; Bible §12: *"not... permission to adopt Living Environment on another surface"*), and its reference implementation today is an **isolated, unmerged** Agency Headquarters RC1/RC2 candidate only (`CXOS_LIVING_ENVIRONMENT_ENGINE_CINEMATIC_BIBLE.md:5-7`) — it does not exist on any consumer-facing room. Adopting it for Mail Center would mean building the room as its own semantic chamber: a declared motion signature and entry vector (Bible §11.4's per-chamber registry), the five-beat passage lifecycle to/from neighboring chambers (§5.4), the three-class continuous/transient/scroll motion budget (§11.1) and its quiet-state law (§11.2, all continuous motion stops the instant the room is read, settled, or Kai-focused), per-chamber idle timing (§11.5), Kai-presence dimming/scoping rules specific to a chamber (§11.6) — and clearing all **17** enumerated prohibitions in §9 (verified by direct count: 5 fabricated-truth + 4 spectacle-without-meaning + 4 input/accessibility + 4 performance/architecture, `CXOS_LIVING_ENVIRONMENT_ENGINE_CINEMATIC_BIBLE.md:417-444`). None of that is designed or assumed here; it is a distinct, additive, Founder-gated program independent of the Room-Constitution evolution this document specifies for September 1.

---

## 7. File-by-file evolution map

| Existing file | Change class | What changes | Invariants preserved |
|---|---|---|---|
| `app/mail/page.tsx` | **Evolve** | Add "Do this first" band (§2.3); reorder rows into a health-priority work queue (§2.2); promote per-row CTA to on-page action buttons; add nested evidence disclosure (§2.4); reposition `StatCard` grid to a context strip (§2.6); empty state copy only (§2.7) | Server-rendered, deterministic, zero AI, zero network (`:14-17`); zero fabricated telemetry; unchanged `AppShell` wrapper |
| `lib/mailCenter.ts` | **Evolve** | `buildTimeline()`'s stage array extended to the canonical §1.10 list (§2.5); new pure function `pickQueueRecommendation()` for the cross-row "do this first" pick (§2.3); inputs generalize from raw `Letter[]` to Agent A's Dispute Package read shape | "Zero AI, zero network" contract (`:1-8`); `RESERVED`/placeholder discipline (`:84,224-230`); `HEALTH_LABEL`/`HEALTH_TONE` 6-state vocabulary unchanged (`:35-52`); `TimelineStage`/`StageState` shape unchanged (`:54-65`) |
| `app/mail/send/[letterId]/page.tsx` | **Evolve, PROPOSED path rename** → `app/mail/send/[packageId]/page.tsx` | 3-step wizard (`Steps()`, `:142-163`) expands to the 9-step §1.9 chain; `Approval()` splits into a Kai-labeled section + non-Kai operator-chrome section (§3.2); Download/Send promoted to a co-equal fork (§3.4); resumability generalizes from letter status to Package canonical stage (§3.3) | Server-status-derived resumability pattern; "Kai never approves" law (`MailService.ts:125-132`); Download-Package link never removed; two-option law (§1.4) |
| `app/letters/print/[id]/page.tsx` + `PrintActions.tsx` | **Evolve** (reused per-letter as Letter Preview / PDF Preview steps 5–6) | No file change for the single-letter case; a **NEW** package-level print aggregator is implied for a multi-letter Package ("Download Package" = every letter + enclosures in one browser-print session) — not designed here, named as a likely new sibling route pending Agent A's Package cardinality answer (§3.6) | Browser-print truth (`window.print()`, no PDF library) stays disclosed, never silently upgraded (`PrintActions.tsx:8`); unbranded mailed-artifact footer (`page.tsx:119-124`) |
| `components/AppShell.tsx` | **No change** | — | Sidebar / `ImpersonationBanner` / `AnnouncementBanner` / `AgencyBar` / `main` / `KaiPresence` / `MobileNav` order unchanged (`:10-32`) |
| `components/mission/ExecutiveQueue.tsx` | **Reference pattern only — not imported** | Mail Center implements its own "Do this first" band using its own `card`/`pill` idiom (§2.3) | `mc.module.css` (`gxl`) stays Mission-Control-scoped; no new cross-room CSS coupling |
| `lib/kaiHome.ts` | **Reference pattern only — not imported** | Mail Center's queue-level recommendation follows the same fixed-priority + `basis` law, scoped to its own rows | Anti-overwhelm law (one recommendation, never manufactured urgency, `:60-67,150`) |
| `app/journey/page.tsx` | **Evolve** | `mailStatusLine()` switch (`:46-59`) extended to cover the canonical §1.10 stages beyond today's `IN_REVIEW`/`APPROVED`/`PAID`/`QUEUED` | "One timeline, never two" (`:12-15`); honest-`null`-until-live rule (`:57-58`) |
| `components/AgencyBar.tsx`, `lib/session.ts` | **No change** | — | Existing client-workspace precedent scopes the evolved room for free (§5) |
| `lib/compliance.ts`, `components/Disclaimer.tsx` | **No change** | All new Mail Center / Package Review copy is hand-written to the same CROA bar, then compliance-reviewed (§8) — not literally passed through `applyCompliance()`, which runs on generated letter bodies, not UI chrome | CROA bar; `DISCLAIMER`/`EduBanner` precedent |
| `components/kai/KaiPresence.tsx` | **Evolve (small)** | Exclusion list (`:101`) gains `/mail` and the Package Review route — see the route-naming table at the top of this document | Never-auto-open, session-dismiss, one-recommendation-one-deadline (`:32-63,103`) |
| `lib/mail/MailService.ts`, `MailStatus.ts`, `MailManifest.ts`, `MailAudit.ts`, `MailPricing.ts`, `providers/*` | **Not touched by Agent B** | Agent B's UI is a consumer of Agent A's evolved Package/state-machine layer over this spine | `not_wired`/`MAIL_LIVE` fail-closed; append-only audit; write-once identity |

### 7.1 Routes/APIs this UI expects to consume (named, not designed — Agent A's state machine implies these)

| Endpoint | Evolves from | Purpose |
|---|---|---|
| `GET /api/packages` (or server-component-inline Prisma read, as today) | `app/mail/page.tsx`'s inline `prisma.letter.findMany` (`:22-26`) | Work-queue list |
| `POST /api/packages/:packageId/prepare` | `POST /api/mail/prepare` (`app/api/mail/prepare/route.ts`) | Kai Summary + recommended-disputes assembly |
| `GET /api/packages/:packageId` | `GET /api/mail/[mailId]` (`app/api/mail/[mailId]/route.ts`) | Package status / receipt read |
| `POST /api/packages/:packageId/approve` | `POST /api/mail/[mailId]/approve` (`app/api/mail/[mailId]/approve/route.ts`) | Operator approval (§4.1) — same "user-only" invariant |
| `POST /api/packages/:packageId/wallet-authorize` | **New** (Agent C boundary) | Wallet Authorization chain step (§3.1 step 8–9 gate) |
| `POST /api/packages/:packageId/send` | `POST /api/mail/[mailId]/confirm` (`app/api/mail/[mailId]/confirm/route.ts`) | "Send with CreditVector Fulfillment" — same campaign-gate pattern (§3.6), same `recordDecision` audit call (`confirm/route.ts:62-70`) |
| `GET /api/packages/:packageId/evidence` | **New** — exposes `MailService`'s already-existing but never-routed `retrieveTracking`/`retrieveProof` calls | Evidence drawer (§2.4) |
| `POST /api/packages/:packageId/cancel` | **New** — exposes `MailService.cancel()` (`MailService.ts:222-239`), which has no route today | Cancel-before-mailed action |
| `POST /api/packages/:packageId/download` | `GET /letters/print/[id]` (existing, reused) | Download Package (§3.4) — multi-letter aggregation is new (§7 table above) |

---

## 8. Copy discipline

All new operator-facing (page-chrome, not Kai-voice) copy must clear the same bar `applyCompliance()`'s `PROHIBITED` table (`lib/compliance.ts:3-36`) and `DISCLAIMER` (`:58-59`) already enforce for letters — process language, no outcome promises, certified-mail language factual. Every row below is **PROPOSED, requires CCO compliance-review before ship** per Program Brief §4.

| Surface | Existing precedent (tone to match) | Proposed copy | Why it clears the bar |
|---|---|---|---|
| "Do this first" band, quiet state | `ExecutiveQueue.tsx:39`, "You're all caught up" | "You're all caught up." | No urgency manufactured when there is none |
| "Do this first" band, action state | `recommendationFor()` outputs (`mailCenter.ts:151-179`) reused verbatim | *(reused, not re-authored)* | Already CROA-clean; re-authoring risks drift from the compliance-reviewed original |
| Wallet authorization, certified-mail line | `app/mail/send/[letterId]/page.tsx:230-235`, "Live mailing isn't switched on yet... no card is charged" | "Certified mail with return receipt: $4.95 — itemized above. You'll see the final total before anything is authorized." | Factual, itemized, no discount-to-outcome framing; states the mechanism, not a benefit claim |
| Send CTA | Today: generic "Confirm & queue this dispute" (`:240`) | "Send with CreditVector Fulfillment" (Program Brief §1.1, §1.4 — the operator-facing name, never a vendor id) | Matches the Founder-mandated name; never exposes `letterstream`/`lob`/etc. (D-KAI-EXPERIENCE.md L2) |
| Download CTA | Today: de-emphasized ghost link "Or download & mail it yourself" (`:201`) | "Download Package" (co-equal weight per §3.4) | Neutral, no steering language toward either option |
| Empty work queue | `app/mail/page.tsx:84-88`, "Nothing mailed yet..." | "Nothing in flight yet. Generate a dispute letter and mail it — it lands here with its statutory clock and what I'd do next." | Process language; "statutory clock" not "guaranteed timeline" |
| Evidence drawer, unwired state | `mailCenter.ts:84`, `RESERVED` = "Available after live mail integration." | *(reused verbatim)* | Already the exact honest-placeholder precedent; no new phrasing needed |

**Note on scope:** Kai's own first-person narration copy (per §1.10 stage, per emotional state) is Agent D's territory and already drafted in D-KAI-EXPERIENCE.md §4.5 — the table above covers only operator/system-chrome copy (buttons, headers, consent lines), a different voice register, to avoid two agents authoring competing lines for the same moment.

---

## Interface Expectations (for Agent E merge)

*(A-DOMAIN-MODEL.md, A-STATE-MACHINE.md, A-POLICY-ENGINE.md, A-PROVIDER-ABSTRACTION.md, and C-WALLET-INTEGRATION.md were all already written by the time this document was finalized — cross-checked where directly relevant; items below are marked **resolved** or **still open** accordingly, not left stale.)*

**Agent A (domain / state machine / policy engine):**
1. ~~Resolve Dispute Package vs. Campaign~~ — **resolved**, `A-DOMAIN-MODEL.md §2.2–2.3`: `DisputePackage` wraps `Campaign` via `campaignId`, materialized at Campaign-approval time; cardinality confirmed **1:N letters per package** (§3.6, updated above). **Still open, Agent A's own flag, not this document's:** `Campaign`'s self-heal-table-vs-`DisputePackage`'s migration-backed-Prisma-model FK conflict (`A-DOMAIN-MODEL.md:125`) — no UI impact either way.
2. Confirm the canonical-stage mapping (16 manifest states + `LetterStatus` → the 12 §1.10 stages) so `lib/mailCenter.ts`'s evolved `buildTimeline()` has real data to render (§2.5) — Agent B's UI is stage-agnostic and will render whatever ordered list this mapping emits.
3. Confirm exact endpoint names/shapes for approve / wallet-authorize / send / cancel / evidence / list (§7.1) — Agent B's table is a consumption expectation, not a design.
4. **Still open:** `certified: true` is now confirmed as the Policy Engine's unconditional law (`A-POLICY-ENGINE.md:115`, cross-confirming the same `app/api/mail/prepare/route.ts:46` bug found independently in this document, §4.2) — but *how* `PriceBreakdown.lines` (or its replacement) surfaces that cost as its own transparent line item is not resolved by any of A/B/C's documents yet (§4.2).
5. ~~Confirm Package cardinality~~ — **resolved**, see item 1.

**Agent C (wallet):**
1. The Wallet Authorization chain step's UI contract (§3.1 steps 8–9) — what data/props the screen needs (balance, funding CTA, authorize/consume/settle/void semantics) to slot between Approve and the Download/Send fork.
2. **Partially resolved:** `C-WALLET-INTEGRATION.md §4.6` (`:505-511`) already assigns "render the full `PriceBreakdown` — or the Policy Engine's equivalent — before Approve → Wallet Authorized" to Agent B, and this document accepts that assignment (§4.2 updated above). **Still open:** which concrete shape that is — today's `PriceBreakdown`/`PriceLine` (`lib/mail/MailPricing.ts:51-63`, currently collapsing the certified line) or a new Policy-Engine-native shape.
3. `package.funded`'s payload contract (per D-KAI-EXPERIENCE.md §1.2/§1.3) is Agent C's to define; Agent B's UI only needs to know the event has fired, never an amount.

**Agent D (Kai experience) — mostly pre-resolved by D-KAI-EXPERIENCE.md, residual items only:**
1. Confirmed and adopted: `components/kai/KaiSummary.tsx` + `lib/kaiPackage.ts` (`pickPackageCandidate()`), reuse of `RecommendationIntelPanel` and `KaiWhy` verbatim (§3.1 steps 2–4).
2. Residual: the exact server-component prop contract for `<KaiSummary packageId=... />` (data-fetching ownership) is not yet specified in either document.
3. Agent B has answered Agent D's open route-naming dependency (top of this document; D §4.1) — `/mail` and the renamed Package Review route both join `KaiPresence`'s exclusion list.
4. Flagging back to Agent D/A jointly: §3.2's finding that today's `Approval()` component structurally violates D §2.4's "Approve never inside a Kai panel" law — the split is a real, non-trivial UI change, not a relabel.

**For Agent E specifically:** §1.4's verified stage-count discrepancy (Brief says 9-stage/6-placeholder; source is 12-stage/6-placeholder) and §3.5's `app/letters/page.tsx` overlap (out of Agent B's assigned scope) both need a decision this document deliberately does not make.
