# LETTERSTREAM-ADAPTER-PLAN.md — LetterStream (Provider Adapter #1) Execution Plan

Agent B · **Execution planning only** — no implementation, no coding, no wiring, no merge. Date 2026-08-03. Continuation of `EXECUTION-PLANNING-BRIEF.md` (binding; this is Agent B's assignment + R4 + R6). Reuses, does not redesign: `A-PROVIDER-ABSTRACTION.md` (the adapter contract + gap analysis), `FULFILLMENT-COMMITMENT-BOUNDARY.md` §2 (the 11 vendor questions, verbatim), `RECOVERY-ENGINE.md` (the 18-scenario matrix this plan's error mapping wires into), `A-STATE-MACHINE.md` §4 (the `FulfillmentStage` taxonomy), `A-POLICY-ENGINE.md` (provider routing/retry consumption), `ADR-PROPOSALS.md` ADR-0043 (Provider Adapter Contract + Vendor Opacity, already ratified-pending-founder). Labels used rigorously: **PROPOSED** (new planning artifact, no founder ruling needed to write it down) / **FOUNDER-GATE** (a human decision point) / **VENDOR-CONFIRMATION-REQUIRED** (a cell whose true value the repository cannot supply) / **LEGAL-GATE** (touches wallet money, blocked behind P2 — named, not designed here).

## 0. Scope, method, and the one hard constraint

**Verified directly (this pass, read-only):** `lib/mail/MailProvider.ts`, `lib/mail/providers/LetterStreamProvider.ts`, `lib/mail/providers/StubProviders.ts`, `lib/mail/MailStatus.ts`, `lib/mail/MailService.ts`, plus `lib/mail/providers/index.ts`, `MailAudit.ts`, `MailManifest.ts`, `MailJob.ts`, `MailTracking.ts`, `MailReceipt.ts`, `MailStore.ts`, `app/api/mail/[mailId]/route.ts`, `lib/eventBus/{envelope,store,validate}.ts`, `app/api/stripe/webhook/route.ts`. No file was edited; this document is the only artifact this pass produces.

**The hard constraint, stated once, governing every table below:** the repository contains **no LetterStream API documentation, no credentials, no SDK** — only `LetterStreamProvider.ts`'s dry-run implementation and a hardcoded rate card (`RATE`, `LetterStreamProvider.ts:50-57`). Every raw status string in `LS_STATUS` (`LetterStreamProvider.ts:30-42`) was **invented to exercise the pipeline in tests**, not transcribed from vendor documentation — it must not be read as a vendor fact anywhere in this plan. Every cell below that depends on a fact only LetterStream can supply is marked **VENDOR-CONFIRMATION-REQUIRED** and mapped to one of the 11 questions in `FULFILLMENT-COMMITMENT-BOUNDARY.md` §2.1 (restated §5). Where a genuine gap exists that the 11 do not cover, it is marked **ADJACENT-GAP** — flagged, not silently folded into the 11 and not silently answered.

---

## 1. Adapter boundary

### 1.1 What the Platform owns vs. what the adapter translates

Per `MailProvider.ts:1-5`'s own law ("Business logic, Kai, and the UI depend ONLY on these types — never on a provider's concrete package or status vocabulary... no caller changes"), formalized per interface member:

| `MailProvider` member | CreditVector Fulfillment Platform owns (never delegated) | LetterStream adapter translates |
|---|---|---|
| `validateAddress` | `AddressValidationResult` shape (`MailProvider.ts:23-28`); the honest `deliverable` semantics (`undefined` until a real check exists — ADR-0043 pt.2, FOUNDER-GATE, separate from vendor Q&A) | LetterStream's own CASS/USPS call, if any (§5.2 adjacent gap) |
| `estimateCost` | `CostEstimate` shape (`MailProvider.ts:40-44`); **all** platform fee/markup/discount/coupon composition (`MailService.estimate()`, `MailService.ts:83-91` — "Certified/class/pages are already in the provider's cost; pricing only layers platform fee, markup, discounts, coupon on top") | LetterStream's own rate card → `providerCostCents` (today: `RATE`, `LetterStreamProvider.ts:50-57`, hardcoded, currency/accuracy unconfirmed — §5.2) |
| `createMailJob` | `CreateJobInput`/`CreateJobResult` shape (`MailProvider.ts:46-66`); the `PAID`-gated dispatch orchestration (`MailService.dispatch()`, `MailService.ts:157-189`); the `MAIL_TRANSITION` idempotency claim (`FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.3, not this adapter's job to implement) | LetterStream's own submit call → `providerJobId` |
| `cancelMailJob` | the state-machine cancelability check **before** calling the provider (`MailService.cancel()`, `MailService.ts:222-239`); the guarded-forbidden `ACCEPTED→CANCELED` rule (§2.5 below) — a call-site discipline, not an adapter-internal one | LetterStream's own cancel call → `{canceled, detail}` |
| `retrieveStatus` / `retrieveTracking` | the `MailStatus`/`FulfillmentStage` taxonomy (`MailStatus.ts`, `A-STATE-MACHINE.md` §4); `syncTracking()`'s forward-walk-one-legal-step-at-a-time discipline (`MailService.ts:193-220`) | LetterStream's own status/tracking vocabulary → `ProviderStatus`/`TrackingInfo` (§2.3, §2.5) |
| `retrieveProof` | the evidentiary-artifact storage decision (pointer-vs-download, FOUNDER-GATE, `A-PROVIDER-ABSTRACTION.md` §4) | LetterStream's own proof-artifact format → `ProofArtifact` (`MailProvider.ts:87-91`) |
| `healthCheck` | the Policy Engine's provider-eligibility routing consumption (`A-POLICY-ENGINE.md` §3.1) | LetterStream's own health signal, if any (§5.2 adjacent gap — is `healthy` backed by a real endpoint or inferred from recent call success?) → `HealthStatus` (`MailProvider.ts:93-97`) |
| *(webhook ingestion — not on the interface today)* | claim-before-effect (`MAIL_TRANSITION` domain); the structural PII guard on any ingested payload; the Vendor Opacity DTO boundary (§3) | LetterStream's own webhook payload shape + signature scheme, contained entirely inside the adapter's own file per `MailProvider.ts:4-5`'s "nothing provider-specific escapes" law (§2.2) |

**Every error the adapter raises** is one of the six `MailProviderErrorCode` values (`MailProvider.ts:118-124`: `not_implemented | not_wired | network | rejected | not_found | auth`) — never a bare `Error`, never a raw vendor string reaching a caller (§2.4).

### 1.2 Sandbox → live discipline — preserved exactly, touched by nothing in this plan

Per the brief's **R4**: *"Provider stays dry-run until vendor answers. `MAIL_LIVE` off and the `not_wired` throw remain until the 11 vendor questions are answered AND the adapter conformance suite passes. No live LetterStream call is scheduled before that."* This document does not flip `MAIL_LIVE`, does not remove a single `not_wired` throw, and does not touch `LetterStreamProvider.ts`. The two existing, orthogonal, fail-closed flags (`A-PROVIDER-ABSTRACTION.md` §7) are unchanged:

| Flag | Read | Default | Effect |
|---|---|---|---|
| `MAIL_LIVE` | per-call (`isLive()`, `LetterStreamProvider.ts:24-26`) | unset → dry-run | live mode throws `not_wired` before any network call, on every method |
| `MAIL_PROVIDER` | `getMailProvider()` (`providers/index.ts:29-36`) | unset → `letterstream` (`DEFAULT_PROVIDER`, `providers/index.ts:20`) | unknown value falls back to default, never crashes |

### 1.3 Where this sits in the phase sequence

Per the brief's refined phase skeleton: **P3 = LetterStream conformance (vendor Q&A + adapter conformance suite, dry-run)**, **P4 = Provider abstraction (interface + Vendor Opacity, no live wiring)**. This plan's four deliverables (§2–§5) are the content of P3/P4. Two sequencing facts, stated precisely rather than assumed:

- **Not schema-blocked, in the main:** the conformance suite (§4), the inventory templates (§2), and the Vendor Opacity DTO/guard (§3) are code-and-documentation-only — they do not require Gate D Phase −1 and can proceed in parallel with it (R3: "non-money fulfillment... provider abstraction (interface only)... can build behind Gate D").
- **Partially schema-blocked — one dependency, named:** the fail-closed `attention` flag this plan's error mapping (§2.4) and provider-state mapping (§2.5) both rely on for an unmapped/unknown vendor status has **"no compliant place to live"** until the `MailManifestFlags` table ships (`FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.1, a FOUNDER-GATE migration queued behind Gate D per R2). Until that migration lands, the conformance suite (§4.1) can assert the *code path* never falls through to a fabricated `PROVIDER_ACCEPTED`, but cannot assert the flag is actually *persisted* — this plan states that honestly rather than assuming the storage already exists.
- **No phase number is assigned to live wiring itself.** The brief's P1–P10 skeleton names P3 (conformance, dry-run) and P4 (interface, no live wiring) but no later phase is explicitly the "flip `MAIL_LIVE`" phase — R4 gates it, but no phase owns it yet. Flagged for Agent A's `EXEC-SEQUENCING.md` (not yet written at this document's time of authoring — the `execution/` directory contains only the brief) to assign explicitly; not decided here.

---

## 2. Inventory templates

Every vendor-specific cell below is **VENDOR-CONFIRMATION-REQUIRED**, cross-referenced to one of the 11 questions restated in §5.1, or marked **ADJACENT-GAP** (§5.2) where none of the 11 covers it.

### 2.1 Endpoint inventory

| # | CreditVector operation | `MailProvider` method | Existing type (verified) | LetterStream endpoint | Request mapping | Response mapping | Vendor confirmation |
|---|---|---|---|---|---|---|---|
| 1 | Submit a dispute letter for mailing | `createMailJob` | `CreateJobInput`/`CreateJobResult` (`MailProvider.ts:46-66`) | VENDOR-CONFIRMATION-REQUIRED — no path/method/auth scheme documented in-repo | `mailId`→idempotency key; `pdf`→bytes or hosted URL (ADJACENT-GAP, §5.2); `to`/`from`→address; `spec`→piece spec | `providerJobId`, initial `status`, optional `trackingNumber` | Q10 (dedup), Q11 (batching), ADJACENT-GAP (PDF form) |
| 2 | Query current status | `retrieveStatus` | `ProviderStatus` (`MailProvider.ts:71-76`) | VENDOR-CONFIRMATION-REQUIRED | `providerJobId` | `status`/`raw`/`detail`/`at` | Q8 (vocabulary), Q5 (latency) |
| 3 | Query tracking history | `retrieveTracking` | `TrackingInfo` (`MailProvider.ts:78-83`) | VENDOR-CONFIRMATION-REQUIRED | `providerJobId` | `milestones[]` (ordered) | Q8 |
| 4 | Cancel a submitted job | `cancelMailJob` | `{canceled, detail}` (`MailProvider.ts:109`) | VENDOR-CONFIRMATION-REQUIRED | `providerJobId` | `canceled` boolean + `detail` | Q1, Q2, Q3, Q4, Q5 (five of the eleven land here — the single most vendor-fact-dependent row) |
| 5 | Validate a mailing address | `validateAddress` | `AddressValidationResult` (`MailProvider.ts:23-28`) | VENDOR-CONFIRMATION-REQUIRED — CASS endpoint existence unconfirmed | `MailAddress` | `valid`/`deliverable`/`normalized`/`issues` | Not among the 11 — ADR-0043 pt.2 FOUNDER-GATE, plus ADJACENT-GAP §5.2 |
| 6 | Estimate cost | `estimateCost` | `CostEstimate` (`MailProvider.ts:40-44`) | Hardcoded in-repo (`RATE`, `LetterStreamProvider.ts:50-57`) — **not vendor-API-confirmed**, only ever a static table | `MailPieceSpec` | `providerCostCents`/`breakdown` | Not among the 11 — ADJACENT-GAP §5.2 (is the rate card current?) |
| 7 | Retrieve evidence artifact | `retrieveProof` | `ProofArtifact[]` (`MailProvider.ts:87-91`) | VENDOR-CONFIRMATION-REQUIRED | `providerJobId` | `kind`/`url`/`retrievedAt` | Q9 |
| 8 | Provider health | `healthCheck` | `HealthStatus` (`MailProvider.ts:93-97`) | VENDOR-CONFIRMATION-REQUIRED — is this backed by a real endpoint? | none | `healthy`/`detail`/`checkedAt` | Not among the 11 — ADJACENT-GAP §5.2; feeds `A-POLICY-ENGINE.md` §3.1 routing |

### 2.2 Callback / webhook inventory

**Existence itself is Q6 — the whole push row below is contingent on its answer.** Both channels are planned; the poll channel is mandatory regardless of Q6's outcome (`RECOVERY-ENGINE.md` §3: "the reconciliation sweep is not a fallback for stages 5–10 — until vendor confirmation says otherwise, it is the only guaranteed driver").

| Channel | Route / mechanism (PROPOSED, not created) | Reuses precedent (verified) | Vendor confirmation |
|---|---|---|---|
| **Push (webhook)** | `app/api/mail/webhooks/letterstream/route.ts` (illustrative path) — raw body read → signature verify → 400 on failure, before touching the DB → deterministic event id → `MAIL_TRANSITION` claim → translate payload → `applyTransition` | Signature verification: Stripe's raw-body-first pattern (`app/api/stripe/webhook/route.ts:69-79` — verified: `sig = req.headers.get("stripe-signature")`, missing → 400; `stripe.webhooks.constructEvent(body, sig, webhookSecret)` in a try/catch, invalid → 400, both before any DB write). Deterministic id: `deriveEventId(tenantId, type, source, dedupeKey)` (`lib/eventBus/envelope.ts:145-148`, verified). Idempotent insert: `appendEvent`'s `ON CONFLICT`/P2002-catch-and-return-original pattern (`lib/eventBus/store.ts:87-107`, verified — "a retried publish collides on the PK and returns the ORIGINAL row"). PII guard on the ingested payload: `assertNoPII` + `PII_DENYLIST` (`lib/eventBus/validate.ts:22-27,51-67`, verified) | **Q6** (existence — if the answer is no, this row is never built), **Q7** (redelivery/signing/replay-tolerance) |
| **Poll (guaranteed fallback)** | No new route — reuses `MailService.syncTracking()` (`MailService.ts:193-220`, verified, already implemented for dry-run), driven by the Recovery Engine's reconciliation sweep (`RECOVERY-ENGINE.md` §3, banded Hot/Warm/Cold cadence) | `retrieveStatus`/`retrieveTracking` — no new code needed to exercise this path today | None required to build; **Q5**'s latency answer tunes cadence values (FOUNDER-GATE business tuning, not this document) |

A provider-specific webhook secret is a new env var — **FOUNDER-GATE**, not `STRIPE_WEBHOOK_SECRET` (per `A-PROVIDER-ABSTRACTION.md` §5.1's own note).

### 2.3 Tracking inventory — the milestone stream, USPS events specifically

`retrieveTracking()` returns an ordered `ProviderStatus[]` (`TrackingInfo.milestones`, `MailProvider.ts:82`); `normalizeTracking()` (`MailTracking.ts:25-54`, verified) de-duplicates by canonical status (keeping the earliest timestamp per status), sorts by pipeline position then time, and picks the furthest-advanced non-`CLOSED` terminal status as current. `MailService.syncTracking()` (`MailService.ts:193-220`, verified) then **walks the manifest forward one legal step at a time up to the reported status** — it never jumps, and a `RETURNED` target short-circuits directly (lines 201-205) rather than being walked.

| # | Carrier-movement event | → `MailStatus` | Mechanic | Vendor confirmation |
|---|---|---|---|---|
| 1 | Mailer drop-off vs. USPS's own first tracking scan | `CARRIER_ACCEPTED` today (conflated, `LetterStreamProvider.ts:34`, `mailed: "CARRIER_ACCEPTED"`) | `A-STATE-MACHINE.md` §5.2: if LetterStream's raw vocabulary cannot distinguish the two, the manifest "simply skips straight through both in one webhook... zero information loss," per `syncTracking()`'s own forward-walk design | VENDOR-CONFIRMATION-REQUIRED — does LetterStream's tracking vocabulary distinguish mailer drop-off from USPS's own "Acceptance"/origin-facility scan at all? (Q8-adjacent) |
| 2 | In-transit movement | `IN_TRANSIT` | sub-state within `USPS_ACCEPTED`→`DELIVERED`, collapsed for operator display, full detail kept in the audit trail (`A-STATE-MACHINE.md` §9) | Q8 |
| 3 | Delivered | `DELIVERED` | terminal-for-display; `RETURN_RECEIPT_ARCHIVED` follows once `retrieveProof()`'s artifact is fetched | Q8, Q9 |
| 4 | Returned (pre- or post-delivery) | `RETURNED` | `MailStatus.ts:56` already permits `DELIVERED → RETURNED` (verified: `DELIVERED: ["RESPONSE_RECEIVED", "CLOSED", "RETURNED"]`) — the adapter must surface this distinctly from a pre-acceptance rejection | Q8 |
| 5 | Multiple milestones reported out of order in one poll/webhook | resolved by `normalizeTracking`'s pipeline-position sort (`MailTracking.ts:36-40`), never by arrival order | already-shipped, verified | none — this is provider-neutral mechanics, not a vendor fact |

### 2.4 Error mapping — vendor error → Recovery Engine scenario → Kai copy class

Governing law, restated verbatim from `RECOVERY-ENGINE.md` §7 law 7: *"Every failure that reaches an operator is paired with a Kai explanation class — never a raw vendor error, never the word 'Failed' bare."* Every `MailProviderErrorCode` (`MailProvider.ts:118-124`) wired to the existing, Founder-reviewed vocabulary — **no new scenario or copy class is invented here**:

| `MailProviderErrorCode` | When the adapter throws it | Recovery Engine scenario (verdict class) | `kaiCopyClass` | Note |
|---|---|---|---|---|
| `rejected` | synchronous vendor refusal at `createMailJob` | Scenario 5 (API rejection) — or Scenario 2b if the rejection is address-specific | `CORRECTION_NEEDED_GENERAL` (5) / `CORRECTION_NEEDED_ADDRESS` (2) | Discriminating between the two requires a **structured** reason on the vendor's rejection response — VENDOR-CONFIRMATION-REQUIRED whether LetterStream's rejection payload carries one (Q8-adjacent; not literally named among the 11) |
| `network` | transport failure reaching LetterStream | Scenario 3 (Provider outage) | `TEMPORARY_DELAY` (retrying) → `SUBMISSION_NOT_COMPLETED_YET` (schedule exhausted) | Retry schedule itself is Policy Engine's (`A-POLICY-ENGINE.md` §3.2), not this adapter's |
| *(no error — ambiguous timeout, no throw and no result)* | request exceeds timeout with neither a `MailProviderError` nor a `providerJobId` | Scenario 4 (Provider timeout) | `PROCESSING_LONGER_THAN_USUAL` | Hold stays neither released nor settled; **never** an automatic retry absent Q10's confirmation |
| `not_found` | operation attempted against an unknown/stale `providerJobId` | **No named row in the 17/18-scenario matrix covers this explicitly** | — | **ADJACENT-GAP**, flagged for the Recovery Engine's own owner/Founder, not resolved here — structurally should not occur if the manifest is always the source of truth for `providerJobId`, but the adapter can still receive it |
| `auth` | credentials missing/invalid | Pre-flight: should be caught by Policy Engine's `providerHealth`-driven eligibility filter (`A-POLICY-ENGINE.md` §3.1) **if** `healthCheck()` reflects auth validity (ADJACENT-GAP §5.2, unconfirmed); mid-flight: nearest existing row is Scenario 3, but retrying on a schedule against a bad credential is pointless — an immediate ops escalation rather than the exhaustion path may be warranted | `TEMPORARY_DELAY` is a poor fit | Flagged as a Recovery Engine refinement question, not decided here |
| `not_implemented` | only ever fires from a stub (`Lob`/`PostGrid`/`Click2Mail`/`PostalMethods`, `StubProviders.ts:16-18`) | N/A for a conformance-passed LetterStream adapter | n/a | The conformance suite's interface-completeness check (§4.1) exists precisely to guarantee this code never fires for LetterStream once wired |
| `not_wired` | the deliberate current fail-closed guard (`isLive() === true` and the call is not yet built) | N/A — must never reach a live customer post-go-live-gate | n/a — internal alarm to ops only | Its occurrence in a `MAIL_LIVE=true` environment is itself a release-readiness defect, not a customer-facing event |

### 2.5 Provider-state mapping — the full status vocabulary, `PROVIDER_ACCEPTED` irreversible boundary honored

The **authoritative** current mapping (dry-run, unconfirmed vendor vocabulary — `LS_STATUS`, `LetterStreamProvider.ts:30-42`, verified):

| # | LetterStream raw (dry-run, **invented for testing, not vendor docs**) | → `MailStatus` | → `FulfillmentStage` (`A-STATE-MACHINE.md` §4) | Real vendor string |
|---|---|---|---|---|
| 1 | `received` / `queued` | `PROVIDER_ACCEPTED` | `ACCEPTED` — **the per-letter wallet settlement hook, permanent** (`FULFILLMENT-COMMITMENT-BOUNDARY.md` §1.1/§3; LEGAL-GATE/Agent-D territory, cited not designed) | VENDOR-CONFIRMATION-REQUIRED |
| 2 | `printed` | `PRINTED` | `PRINTING` | VENDOR-CONFIRMATION-REQUIRED |
| 3 | `mailed` | `CARRIER_ACCEPTED` | `MAILED` (collapses `USPS_ACCEPTED`, §2.3 row 1) | VENDOR-CONFIRMATION-REQUIRED |
| 4 | `in-transit` / `in_transit` | `IN_TRANSIT` | sub-state, `USPS_ACCEPTED`→`DELIVERED` | VENDOR-CONFIRMATION-REQUIRED |
| 5 | `delivered` | `DELIVERED` | `DELIVERED` | VENDOR-CONFIRMATION-REQUIRED |
| 6 | `returned` | `RETURNED` | `RETURNED_TO_SENDER` | VENDOR-CONFIRMATION-REQUIRED |
| 7 | `canceled`/`cancelled` | `CANCELED` | `CANCELED` — **legal only pre-`ACCEPTED`** (`CANCELABLE`, `MailStatus.ts:43`, verified) | VENDOR-CONFIRMATION-REQUIRED |
| 8 | `error` | `FAILED` | `REJECTED` (pre-`ACCEPTED`) / `PROVIDER_ERROR` (post) | VENDOR-CONFIRMATION-REQUIRED |
| 9 | *(any unrecognized string — Q8 names candidate examples: "held for review," "refused by recipient," "address corrected")* | **must raise `attention` (`reasonCode:"unknown_provider_status"`), `status` untouched — never fall through to `PROVIDER_ACCEPTED`** (`FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.1, superseding the shipped fallback at `LetterStreamProvider.ts:45`, `?? "PROVIDER_ACCEPTED"`, verified) | off-machine `attention` flag, any stage `ACCEPTED`…`DELIVERED` | **Q8** — full vocabulary unknown; contingent on `MailManifestFlags` shipping (§1.3) |

**The irreversible boundary, restated for this plan's own conformance obligations (§4.4):** once a manifest reaches `PROVIDER_ACCEPTED`, (a) wallet settlement is permanent — no reversal path (LEGAL-GATE, Agent D's runtime, cited not designed here); (b) `ACCEPTED → CANCELED` is shipped-legal in `CANCELABLE` (`MailStatus.ts:43`) but **guarded-forbidden** at the Commitment layer — no fulfillment-layer code path may invoke `MailService.cancel()` once a manifest is at/after `ACCEPTED` (`FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.4, Ruling 3). This is fundamentally a **call-site** guard, not an adapter-internal one — `LetterStreamProvider.cancelMailJob` itself has no way to know the manifest's stage. The adapter conformance suite should still carry a coverage case proving no fulfillment-layer path reaches it post-acceptance (§4.4), since a regression here would silently violate Ruling 3 at the exact seam this adapter sits behind.

### 2.6 Metadata mapping

`CreateJobInput.metadata?: Record<string, string>` (`MailProvider.ts:52`, "opaque provider metadata, ids for reconciliation") exists on the interface but **is not populated by the only caller today** — verified directly: `MailService.dispatch()`'s call to `createMailJob` (`MailService.ts:170-176`) passes `mailId, pdf, to, from, spec` only; no `metadata` key. This is therefore a genuine planning decision (whether/what to populate), not a formalization of existing behavior.

| CreditVector concept | `CreateJobInput` field | PII discipline | Vendor confirmation |
|---|---|---|---|
| `DisputePackageLetter.mailId` (`mail_<letterId>` / `mail_<letterId>_a<n>`, `FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.2) | `mailId` (already populated) | internal id, not PII | Q10 (does the vendor dedupe on this?), Q11 (batching) |
| The generated print-ready PDF | `pdf: {kind:"bytes"\|"url"}` (`MailProvider.ts:57-59`) | the PDF's **content** necessarily carries the recipient's mailing address/dispute details — inherent to postal mail, not a leak; the boundary is that the payload contains only what the user already approved, never any other tradeline/account data | ADJACENT-GAP §5.2 — bytes, hosted URL, or both accepted? |
| Recipient / sender address | `to`/`from: MailAddress` (already populated) | inherent/required for mailing | none |
| Piece spec (pages/color/duplex/class/certified) | `spec: MailPieceSpec` (already populated) | no PII | none |
| **PROPOSED, not yet built:** internal reconciliation ids only (`mailId`, `letterId`, `packageId`, `attempt`) — never free text, never a name/SSN/balance | `metadata` (currently unused, see above) | **PROPOSED:** restrict values to a closed set of internal ids, mirroring the Event Bus's refs-only discipline (`lib/eventBus/envelope.ts:70`, "REFS-ONLY (no value-bearing PII)") and its `PII_DENYLIST` substring guard (`lib/eventBus/validate.ts:22-27`, verified: `email/ssn/phone/address/dob/name/balance/...`) as the pattern to reuse, not a new invention | ADJACENT-GAP §5.2 — does LetterStream even support an opaque metadata passthrough, and does it echo it back on status/webhook responses? |

---

## 3. Vendor Opacity plan (R6, build-time invariant)

Per the brief's **R6**: *"Vendor Opacity is a build-time invariant, not a late polish: operator-facing surfaces never carry provider identifiers from day one of the adapter work."* Per Founder decision §1.1 (`A-PROVIDER-ABSTRACTION.md` §0, verbatim): *"Operators never interact with LetterStream."* In this program's own usage (consistent across `A-STATE-MACHINE.md` §7's "operator action," `A-PROVIDER-ABSTRACTION.md` §9's audited pages), **"operator-facing"** means any surface reachable by the authenticated account holder whose dispute this is — the customer, not an internal admin tool.

### 3.1 The DTO boundary

**PROPOSED:** a single narrow module (illustrative path: `lib/mail/MailOperatorView.ts`) sitting between `MailManifest`/`MailReceipt` and **any** HTTP response or rendered prop — the only thing any route/page may return. It does not change `MailReceipt.ts`'s internal shape (still useful for internal/audit purposes); it adds a boundary layer strip/replace step before serialization:

- Strip or replace `MailManifest.provider` (the raw `MailProviderId`, e.g. `"letterstream"`) — an **identity field**, present on every manifest by construction (`MailIdentity.provider`, `MailManifest.ts:16`).
- Strip or replace `MailReceipt.provider` (`MailReceipt.ts:11`, typed `"provider id, shown for transparency"`; populated from the raw `m.provider` at `MailReceipt.ts:28`, verified).
- Replace any `auditTrail[].detail` string that embeds `provider.name` with platform-neutral phrasing (see §3.3 point 3 — this one is time-sensitive).

### 3.2 The static + executing guard

Two layers, mirroring the "static + executing" idiom `RECOVERY-ENGINE.md` §8 and `A-POLICY-ENGINE.md` §7 both already use:

- **Static (cheap, catches literal leakage):** a guard script (illustrative path: `scripts/vendorOpacity.test.ts`) grepping the vendor-name regex ADR-0043 pt.3 already proposes — `/letterstream|postgrid|click2mail|postalmethods|\blob\b/i` — against every file **outside** an explicit allowlist (the adapter files themselves: `LetterStreamProvider.ts`, `StubProviders.ts`, `providers/index.ts`, where the names must legitimately appear).
- **Executing (catches dynamic interpolation a static grep misses):** the same guard script calls the DTO boundary functions (§3.1) with fixtures covering all five `MailProviderId` values and asserts the regex has zero matches anywhere in the JSON-serialized output — this is the only way to catch a template-string leak like `MailService.ts:186`'s (§3.3 point 3), which a static grep on non-adapter files would never see (the string is assembled at runtime, not literally present outside the adapter file).

### 3.3 Where it applies — today's concrete audit (this pass, verified independently where noted)

1. **`app/api/mail/[mailId]/route.ts:13`** — `return NextResponse.json({ manifest: m })` — serializes the **entire, unfiltered `MailManifest`**, verified directly this pass. This is a live, present leak, broader than the receipt-only finding `A-PROVIDER-ABSTRACTION.md` §9 previously audited: any authenticated owner inspecting the raw HTTP response sees `provider:"letterstream"` today, live, in production. Must route through the §3.1 DTO boundary.
2. **`MailReceipt.ts:11,28`** — `provider: string` typed and populated from raw `m.provider` (verified). `buildReceipt()` itself can stay as-is for internal use; nothing may return its output directly to an HTTP response without passing through §3.1 first.
3. **`MailService.ts:186`** — `` detail: `Accepted by ${this.provider.name}` `` (verified, resolves to `"Accepted by LetterStream"`). Currently dormant — `MailService.dispatch()` has zero callers anywhere in `app/`, `lib/`, or `worker/` (`A-STATE-MACHINE.md` §1, grep-verified there) — but this string, once written, lands in the **append-only** `auditTrail` (`assertAppendOnly`, `MailAudit.ts:54-65`) and can never be edited out afterward. **This is a one-shot fix with no do-over:** the template must change to platform-neutral phrasing (e.g. `"Accepted for fulfillment"`) in the **same change** that gives `dispatch()` its first caller, never after.
4. **`app/mail/page.tsx:107`** (per `A-PROVIDER-ABSTRACTION.md` §9's own audit, not independently re-verified this pass) — reported clean today (renders `"CreditVector Mail · {label}"`). Named here as a precedent to preserve, not a gap.
5. **Any future webhook ingestion route or operator notification surface** (§2.2, and Kai's copy classes per `RECOVERY-ENGINE.md` §9) — must be built with the §3.1 boundary from inception, per R6's "day one" framing, never retrofitted.

---

## 4. Adapter conformance test strategy

### 4.1 Conformance suite (dry-run gate — no vendor answer needed to build or run this)

Base battery, restated verbatim from `A-PROVIDER-ABSTRACTION.md` §8 (additive to `scripts/mail.test.ts`'s existing 38 assertions, cited by ADR-0011):

| Check | Asserts |
|---|---|
| Interface completeness | every `MailProvider` method is implemented (not inherited from `StubProvider`) |
| Dry-run/live symmetry | `isLive()===false` → deterministic, network-free; `isLive()===true` → a real call or `not_wired`, never a silent no-op |
| Status mapping totality | every raw status the adapter's own fixtures enumerate maps to a known `MailStatus`; **no fallback to a forward-progress status for an unrecognized value** (closes §2.5's fallback gap — contingent on `MailManifestFlags`, §1.3) |
| Rate card containment | no test outside the adapter's own file asserts a specific dollar amount; pricing tests exercise `MailPricing` against a provider-agnostic `CostEstimate` fixture only |
| Error code fidelity | every thrown `MailProviderError` uses one of the six defined codes, never a bare `Error` |
| No vendor leakage | reuses §3.2's guard — the adapter's return values never place a provider string/name into a field reaching an operator-facing route without translation |

**No `MailProviderId` may be selected via `MAIL_PROVIDER` for a live job until its own 11-question answer set exists** (`FULFILLMENT-COMMITMENT-BOUNDARY.md` §2.2, additive to this battery).

### 4.2 Sandbox gate

**Open branch — whether a LetterStream test/sandbox environment exists at all is itself unconfirmed** (adjacent to Q4/Q5, which ask about real-time-API-vs-support-contact and sync-vs-async, implying *some* API surface, but not confirming a distinct non-production tier):

- **If a vendor sandbox exists:** the identical §4.1 battery re-runs against it once credentials exist, before any production credential is ever used.
- **If no vendor sandbox exists:** the only pre-live validation is (a) this plan's dry-run conformance suite and (b) a single, Founder-supervised, manually-verified live piece — named as a fallback path, not decided here (a FOUNDER-GATE choice, not an architecture one).

### 4.3 Go-live gate — FOUNDER-GATE, restated as a definitive checklist

`MAIL_LIVE` flips **only** when **all** of the following hold; this is a human sign-off, never CI-automated:

1. All 11 vendor questions (§5.1) answered — per R4, the literal precondition.
2. The 4.1 conformance suite green, including every §4.4 negative/idempotency case below.
3. The §3.2 Vendor Opacity guard green (static + executing).
4. `MailManifestFlags` migration shipped (§1.3) — the honest fail-closed `attention` mechanism this plan's error/status mapping depends on has no compliant storage otherwise.
5. ADR-0043 pt.2's honest `deliverable` fix shipped (so any live CASS result is truthfully labeled, never inferred from a ZIP regex).
6. Explicit Founder sign-off.

### 4.4 Negative / idempotency cases

| Case | Exercises | Reuses (verified precedent) | Pass criterion |
|---|---|---|---|
| **Duplicate submission** | `MAIL_TRANSITION` claim (`FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.3) | ADR-0028's `claimed\|completed\|in_flight` shape (`RECOVERY-ENGINE.md` scenario 6) | exactly one manifest/wallet effect; the second call returns `completed`, never re-runs `applyTransition` |
| **Webhook replay** | deterministic-id dedup (§2.2) | `deriveEventId` (`envelope.ts:145-148`) + `appendEvent`'s `ON CONFLICT`/P2002 replay (`store.ts:87-107`, `100-104`), both verified | redelivery acknowledged 200; zero duplicate transition |
| **Out-of-order delivery** (e.g. a "delivered" event arrives before "printed") | `syncTracking()`'s forward-walk loop (`MailService.ts:206-218`, verified) | already-shipped "walk one legal step at a time" logic | manifest lands at the correct furthest status; no orphaned intermediate audit entries; no backward jump |
| **Unknown/unmapped raw status** | the `attention` flag, **not** the retired fail-open default | `FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.1 (supersedes `LetterStreamProvider.ts:45`'s `?? "PROVIDER_ACCEPTED"`) | `status` untouched; `attention` raised with `reasonCode:"unknown_provider_status"`; never silently advances |
| **Ambiguous timeout** | Scenario 4 | claim stays `pending`/claimed | hold neither released nor settled; no automatic retry absent Q10 |
| **Double-click / duplicate HTTP submission** | submission-token layer (`RECOVERY-ENGINE.md` §5) | Scenarios 6, 13 | exactly one authorize/settle sequence regardless of click count |
| **Race: webhook and sweep both report the same transition** | `MAIL_TRANSITION` claim as sole arbiter | Scenario 14 | first claim wins; the second observes `in_flight`→`completed` and no-ops |
| **Cancel attempted post-acceptance** | the guarded-forbidden `ACCEPTED→CANCELED` edge (§2.5) | `FULFILLMENT-COMMITMENT-BOUNDARY.md` §4.4, Ruling 3 | no fulfillment-layer code path reaches `cancelMailJob` for a manifest at/after `ACCEPTED`; `cancelRequest` is raised instead, `status` never mutated |

---

## 5. The 11 vendor-confirmation questions — blocking checklist

### 5.1 The 11, mapped to the plan cell each one fills

Verbatim source: `FULFILLMENT-COMMITMENT-BOUNDARY.md` §2.1. Applies identically, independently, to any future adapter (`§2.2` of that document) — no answer transfers across providers.

| # | Question (paraphrased; source has the verbatim text) | Plan cell(s) it fills | Blocks |
|---|---|---|---|
| 1 | Exact point a submitted job becomes unstoppable | §2.5 (irreversible-boundary tuning), §2.1 row 4 | Go-live gate |
| 2 | Does `cancelMailJob` have a real endpoint; refusal shape? | §2.1 row 4, §2.4 (`rejected` code real behavior) | Go-live gate |
| 3 | Cost consequence of a vendor-side stop | §2.4 (cross-ref `RECOVERY-ENGINE.md` scenario 9) | Go-live gate |
| 4 | Real-time API vs. manual support contact for cancellation | §2.1 row 4, §4.2 (sandbox shape) | Go-live gate |
| 5 | Sync response vs. async callback + latency | §2.1 rows 2/4, §2.2 (poll cadence tuning) | Go-live gate |
| 6 | Push/webhook existence at all | §2.2 (the entire push row is contingent) | Go-live gate; determines whether polling is *the* driver, not *a* fallback |
| 7 | Webhook redelivery/signing/replay-tolerance | §2.2 (signature scheme), §4.4 (webhook replay case) | Go-live gate |
| 8 | Full raw status vocabulary, including undocumented statuses | §2.3, §2.5 (the entire vendor column of both tables) | Go-live gate — the single largest completeness question |
| 9 | Return-receipt artifact format/delivery/retention | §2.1 row 7, cross-ref `A-PROVIDER-ABSTRACTION.md` §4 FOUNDER-GATE | Go-live gate |
| 10 | Idempotent retry dedup behavior on a repeated idempotency key | §2.1 row 1, §2.6, §4.4 (duplicate submission real-vendor behavior; currently assumed worst-case — "creates a second piece") | Go-live gate; also gates whether Policy Engine may ever auto-retry `createMailJob` |
| 11 | Batch/grouping concept, or strictly independent jobs | §2.1 row 1 (unit-of-work assumption) | Go-live gate (lower severity) |

### 5.2 Adjacent gaps found this pass — not among the 11, flagged rather than answered or ignored

| # | Gap | Where it surfaced |
|---|---|---|
| A1 | Is the hardcoded rate card (`RATE`, `LetterStreamProvider.ts:50-57`) still current/accurate? | §2.1 row 6 |
| A2 | Does a real CASS/USPS-grade address-validation endpoint exist at LetterStream at all (vs. requiring a separate vendor, e.g. USPS Web Tools)? | §2.1 row 5, cross-ref ADR-0043 pt.2 |
| A3 | PDF delivery mechanism for `createMailJob` — raw bytes, hosted URL, or both? | §2.1 row 1, §2.6 |
| A4 | Does LetterStream support an opaque metadata passthrough, and does it echo it back on status/webhook responses? | §2.6 |
| A5 | Is `healthCheck()`'s live signal backed by a real vendor endpoint, or only inferable from recent call success? | §2.1 row 8, §2.4 (`auth` pre-flight discriminator) |

These five are genuinely blocking for live wiring (you cannot implement `createMailJob`'s live path without A3, for instance) even though they are not among the named 11 — flagged for the Founder/Agent E to fold into the vendor Q&A packet, or to explicitly accept as deferred past initial go-live. Not silently merged into the 11 (which would misstate a Founder-reviewed document), not silently ignored.

---

## 6. Adapter-specific risks

| # | Risk | Grounding |
|---|---|---|
| 1 | Rate card staleness — hardcoded, vendor-unconfirmed (A1) — could under/overcharge relative to LetterStream's actual current cost once live | §2.1 row 6 |
| 2 | Silent second mailing on a retried submission if Q10 resolves unfavorably and any future code path retries optimistically | §2.6, §4.4 |
| 3 | Poll-only blind spot if Q6 = no webhooks and sweep cadence (FOUNDER-GATE business tuning, `RECOVERY-ENGINE.md` §3) is tuned too loose | §2.2 |
| 4 | The `MailService.ts:186` audit-string leak becomes **permanent** the instant `dispatch()` gets its first caller — append-only, no do-over | §3.3 point 3 |
| 5 | The raw-manifest route leak (`app/api/mail/[mailId]/route.ts:13`) is **live today**, not hypothetical — low severity, but a direct, present instance of the exact thing Founder §1.1 forbids | §3.3 point 1 |

---

## 7. Closing disposition

This plan formalizes execution structure on top of already-ratified architecture (`A-PROVIDER-ABSTRACTION.md`, ADR-0043, `FULFILLMENT-COMMITMENT-BOUNDARY.md` §2, `RECOVERY-ENGINE.md`) — it invents no LetterStream endpoint, payload, webhook shape, or status string, and every vendor-specific fact is either cited to an existing document or marked `VENDOR-CONFIRMATION-REQUIRED`/`ADJACENT-GAP`. No code was changed; this file is the only artifact produced. The go-live gate (§4.3) is unmet until all six of its conditions hold, the last of which is an explicit Founder sign-off — never an automated flip.
