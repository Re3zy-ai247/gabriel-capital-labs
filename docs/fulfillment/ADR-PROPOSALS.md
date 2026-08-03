# ADR Proposals — CreditVector Fulfillment Engine v1.0

Agent E (Architecture Merge) · All entries **Status: PROPOSED**, awaiting founder review · Format follows `.ai/ADR/ADR-0000-template.md` verbatim · Numbering verified against `.ai/ADR/` directory listing (latest present file: `ADR-0038-professional-growth-economy.md`).

**Numbering note:** `ADR-0029` and `ADR-0030` are not present in `.ai/ADR/` but are not free — `ADR-0034-gios-platform-freeze.md:37` confirms `ADR-0030` is allocated on an unmerged branch (`credit-identity`). Reusing 0029/0030 here would risk a numbering collision when that branch merges. **This document numbers sequentially from the latest present file: ADR-0041 through ADR-0047.** If a founder ratifies any of these, add one line to `.ai/DECISIONS.md` per the existing index convention before merging the ADR file itself.

---

# ADR-0041: Fulfillment Platform — Case + Dispute Package Domain

Status: Proposed
Date: 2026-08-03
Decision owners: Founder + Chief Architect (Agent A design, Agent E merge)

## Context
Founder decision (Program Brief §1.2): the primary object is the **Dispute Package**, not `Letter`; the primary workflow is the **Case Journey**, not "Mail." No `Case`/`DisputePackage`/`Round` model exists today — the closest prior art is `Campaign` (`lib/campaign/CampaignModel.ts`, self-heal, not a Prisma model), which already solves composition/approval/audit but has no fulfillment-facing identity and cannot carry a real FK from a migration-backed model (`scripts/schema-safety.test.ts`'s frozen 32-table `LEGACY_SELF_HEAL_ALLOWLIST` forbids adding `DisputePackage` to it).

## Decision
Add two new, thin, migration-backed Prisma models:
- **`Case`** — durable identity for one `(User, Tradeline)` dispute's whole history (or `(User, null)` for identity-only disputes). States `OPEN|WAITING|NEEDS_ATTENTION|CLOSED|ARCHIVED`, a cached rollup never a second source of truth. Tombstone erasure (`redactedAt`, mirrors `EventEnvelope.redactedAt`).
- **`DisputePackage`** + **`DisputePackageLetter`** (join) — N letters (N recipients) per package; `stage` is a rollup at the least-progressed constituent manifest; `campaignId` is a **plain unenforced `String`** (not a real FK — `Campaign` is self-heal); `kaiSummaryRef` stays null until the existing ADR-0006 gate clears; `DisputePackageLetter.letterId` is `onDelete: Restrict` (a packaged letter is evidence, mirrors `XpAward`'s FK reasoning).

Full schema sketches: `A-DOMAIN-MODEL.md` §1.6, §2.6.

## Alternatives considered
- **Derived-only Case/Package (no new table):** rejected — no stable anchor for a `DisputePackage` FK, no surviving shell after erasure, just pushes the migration decision one level down.
- **Promote `Campaign` to a Prisma model now** (giving `DisputePackage.campaignId` a real FK): rejected for v1 — a bigger, riskier migration touching a table every mail-queue request reads/writes today; named as a separate future FOUNDER-GATE, not forced into this program.
- **One `Case` per User** (whole client relationship): rejected — the waiting-period clock runs per letter/tradeline, not per user; would force artificial cross-tradeline coherence.

## Consequences
`Letter`/`User` gain only additive back-relations. `DELETE /api/letters/[id]` (`app/api/letters/[id]/route.ts:45-53`) starts refusing for packaged letters (deliberate, documented — the unpackaged path is unchanged). `Campaign`'s self-heal/`DisputePackage`'s migration-backed FK gap is accepted as an application-level integrity concern (Policy Engine enforces), not a schema-level one, until/unless a future ADR migrates `Campaign`.

## Security implications
No new PII fields — every renderable fact is owned locally (identity, lifecycle, timestamps) or joined live (§5, single-owner discipline). Row-level tenant isolation follows the existing `agencyId` denormalized-backstop pattern (`NetworkMessage.audienceAgencyId`, `EventEnvelope.agencyId`).

## Compliance implications
Tombstone erasure precedent preserved. **FOUNDER-GATE, unresolved:** erasure of a `Case`/`DisputePackage` with a live `MailManifest` mid-transit — the audit trail's evidentiary value vs. the erasure right (named, not designed, in `A-DOMAIN-MODEL.md` §6).

## Migration or rollback plan
Additive only, 0 DROP, new migration (never self-heal). Both new tables ship flags-OFF-equivalent (no route reads them until Phase 1/2 wiring, `IMPLEMENTATION-SEQUENCE.md`). Rollback = drop the two new tables; zero existing table altered.

## Evidence
`prisma/schema.prisma:55-271` (existing `User`/`Tradeline`/`Letter`), `lib/campaign/CampaignStore.ts:73-90` (Campaign self-heal, verified), `scripts/schema-safety.test.ts:106-120` (allowlist, verified 32 tables), `prisma/schema.prisma:766-786` (`XpAward` FK precedent).

---

# ADR-0042: Fulfillment Policy Engine

Status: Proposed
Date: 2026-08-03
Decision owners: Founder + Chief Architect (Agent A design, Agent E merge)

## Context
Founder decision (Program Brief §1.5): a deterministic subsystem must own delivery policy, certified-mail enforcement, provider eligibility/routing, wallet-authorization requirements, retries, idempotency, and duplicate prevention — **Kai never decides these.** Today these decisions are scattered or absent: `certified: false` is hardcoded (`app/api/mail/prepare/route.ts:46`, verified, contradicting Founder §1.3); an unrecognized provider status silently maps to `PROVIDER_ACCEPTED` (`LetterStreamProvider.ts:45`, verified, fail-open); no `policyVersion` exists to freeze a rate decision for the Wallet ledger.

## Decision
Add `lib/fulfillment/PolicyEngine.ts` (illustrative path, not created) — a pure, server-only module following the repository's three existing deterministic-decision precedents (`CampaignPolicy.ts`, `pickRecommendation`'s `basis` law, `planForPrice()`'s fail-closed law). Typed `PolicyInput`/`PolicyDecision` (full shape: `A-POLICY-ENGINE.md` §2-3; corrected per merge: `PolicyDecision.policyVersion: number`, non-optional, added top-level). Six laws: fail-closed on unknowns; no policy decision from Kai/client input; every decision carries `basis`; certified mail is a constant (`true`, unconditional); the engine never touches a provider or the network; Kai narrates output, never becomes an input.

**Merge correction:** an unrecognized provider status (§6 of this engine's fail-closed law) resolves to a new `UNKNOWN_PROVIDER_STATUS` `FulfillmentStage`-adjacent quarantine value — never silent forward-progress to `PROVIDER_ACCEPTED`.

## Alternatives considered
- **Inline policy checks per route** (status quo): rejected — exactly how `certified: false` went unnoticed; no single place enforces Founder §1.3.
- **Kai decides eligibility/routing:** explicitly rejected by Founder §1.5 ("Kai never decides these").
- **Silent fallback for unrecognized statuses** (status quo): rejected — violates the fail-closed law this engine exists to enforce.

## Consequences
`POST /api/mail/prepare`, `POST /api/mail/[mailId]/confirm` (and future dispatch/webhook routes) must be rewired to consult the engine instead of hardcoding values — named as must-fix wiring items (`IMPLEMENTATION-SEQUENCE.md` Phase 1). The Wallet (ADR-0044) consumes `walletAuthorization.amountCents`/`policyVersion` directly; no invented `FulfillmentRateDecision` type.

## Security implications
Server-side only (same `"use client"`/prisma-import split as every other CreditVector module). No client-suppliable field ever appears unchanged in a `PolicyDecision` (law 2, statically enforceable).

## Compliance implications
Fixes a live Founder-decision violation (`certified: false`). Certified-mail-inclusive pricing (`walletAuthorization.amountCents`) must be transparent before authorization (Brief §4) — depends on the `MailPricing.ts` line-item fix (`IMPLEMENTATION-SEQUENCE.md` Phase 1 #3), named here, not designed.

## Migration or rollback plan
No schema change. Code-only module, unit-testable with zero DB/network. Guard: `scripts/fulfillmentPolicy.test.ts` (PROPOSED) asserting certified is always `true`; no unrecognized status ever produces a `chosen` provider; every decision has a non-empty `basis`; no pass-through client field; retry schedule is monotonically bounded; duplicate-prevention claim key is always `${mailId}:${toStage}`, never a bare event id.

## Evidence
`lib/campaign/CampaignPolicy.ts:11-58`, `lib/kaiHome.ts` (`pickRecommendation`, `basis`), `lib/stripe.ts:201-217` (`planForPrice`, fail-closed), `app/api/mail/prepare/route.ts:46` (verified `certified: false`), `lib/mail/providers/LetterStreamProvider.ts:45` (verified fail-open fallback).

---

# ADR-0043: Provider Adapter Contract + Vendor Opacity

Status: Proposed
Date: 2026-08-03
Decision owners: Founder + Chief Architect (Agent A design, Agent E merge)

## Context
Founder decision (Program Brief §1.1): operators never interact with LetterStream; it is Provider Adapter #1 under the CreditVector Fulfillment Platform, with four more IDs (`lob`, `postgrid`, `click2mail`, `postalmethods`) already registered as typed stubs. The `MailProvider` interface (`lib/mail/MailProvider.ts:102-114`) already exists and is provider-neutral by construction — this ADR formalizes it, does not redesign it. Two concrete gaps found: (1) `validateAddress()` fabricates `deliverable: true` from a ZIP regex (`LetterStreamProvider.ts:76`, verified) with no real CASS/USPS check; (2) vendor identity has **zero compiled guard** — `MailReceipt.provider` reaches the `GET /api/mail/[mailId]` JSON response unrendered but fetchable, and `MailService.dispatch()`'s audit template embeds `` `Accepted by ${provider.name}` `` (`MailService.ts:186`, verified, currently unreachable only because `dispatch()` has zero callers).

## Decision
1. **Formalize** the existing `MailProvider` contract, webhook signature verification (reusing the Stripe precedent, `app/api/stripe/webhook/route.ts:69-78`), and idempotent webhook ingestion (reusing the Event Bus's `deriveEventId`/`ON CONFLICT DO NOTHING` pattern) as the platform's adapter layer — no interface change.
2. **Honest `validateAddress`:** `deliverable` returns `undefined` ("not determined") until a real CASS/USPS check exists — never inferred from structural validity.
3. **Vendor Opacity law (new):** a provider-neutral response DTO strips/replaces `MailReceipt.provider` before any operator-facing API response; audit `detail` strings for provider transitions use platform-neutral phrasing, never `provider.name`; a static guard (regex `/letterstream|postgrid|click2mail|postalmethods|\blob\b/i`) asserts no vendor name reaches any operator-facing module.
4. **Fail-closed status mapping:** an unrecognized raw provider status produces `UNKNOWN_PROVIDER_STATUS`, never a silent `PROVIDER_ACCEPTED` fallback (co-ratified with ADR-0042).

## Alternatives considered
- **Leave vendor-opacity as discipline-only (copy review):** rejected — the two leak paths are real and only latent by accident (an unrendered field, a never-fired audit template); a compiled guard costs little and closes both permanently.
- **Infer `deliverable` from ZIP regex (status quo):** rejected — reports certainty the platform does not have; a real CASS/USPS integration is a named FOUNDER-GATE, not assumed.

## Consequences
Any future adapter (Lob/PostGrid/Click2Mail/PostalMethods) owns its own private status-mapping table inside its own file — never a shared cross-provider `if` chain (existing law, unchanged). The adapter conformance test battery (`A-PROVIDER-ABSTRACTION.md` §8) becomes a required gate before any `MailProviderId` may be selected via `MAIL_PROVIDER`.

## Security implications
Webhook ingestion verifies signature against a provider-specific secret (new env var, FOUNDER-GATE) before touching the database, mirroring the Stripe webhook's raw-body-first discipline. PII discipline on ingested payloads follows the Event Bus's existing structural guard (`lib/eventBus/validate.ts`).

## Compliance implications
Vendor Opacity directly enforces Founder §1.1. Honest `deliverable` labeling prevents a false "this address is USPS-deliverable" claim reaching the operator.

## Migration or rollback plan
No schema change for the status-mapping fix (additive string through the existing `MailManifest.status` TEXT column). The evidence-artifact storage question (pointer-only vs. download-and-encrypt) is **FOUNDER-GATE**, named not designed (`A-PROVIDER-ABSTRACTION.md` §4). Rollback = revert the DTO/guard code; no data migration involved.

## Evidence
`lib/mail/MailProvider.ts:102-124`, `lib/mail/providers/LetterStreamProvider.ts:45,63-80` (verified), `lib/mail/MailReceipt.ts:11` (verified), `lib/mail/MailService.ts:186` (verified), `app/api/stripe/webhook/route.ts:69-78`, `lib/eventBus/envelope.ts:145-148`.

---

# ADR-0044: CreditVector Wallet + WalletLedger

Status: Proposed
Date: 2026-08-03
Decision owners: Founder + Chief Architect (Agent C design, Agent E merge) · CCO co-review required before activation

## Context
Founder decision (Program Brief §1.6): the Wallet is architecture-only in this phase — authorization, fulfillment funding, marketplace, growth network, payouts, append-only ledger integration are named, not built. ADR-0038 §2 (PGE-3/PGE-4, verified verbatim) requires five instruments (Reputation/Business-Health/Affiliate/Promo/Cash) stay forever separate, never converted. `User.letterCredits` is today's only balance field (a letter-generation gate, count-denominated); it must coexist with, not be replaced by, a cents-denominated fulfillment-funding instrument.

## Decision
Add **`WalletLedger`** — append-only, migration-backed, mirroring `XpAward` field-for-field: `entryKind` (`fund|authorize|consume|void|refund|adjust`), signed `amountCents`, subject-keyed idempotency (`@@unique([userId, subjectId, entryKind])`), `Restrict` FKs, `policyVersion` (freezes the Policy Engine's rate at write time), balance derived by fold (`foldWalletBalance`, floors at zero — never a stored column). Four money-moving transitions mapped to the canonical timeline: **authorize** at `Approved → Wallet Authorized`; **consume** (capture, zero-value state marker) at provider `Accepted` — the merge's resolved settlement moment, correcting `A-STATE-MACHINE.md`'s earlier `PAID`-sub-step phrasing (`CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §3.3); **void** pre-consume failure/cancel/expiry (TTL value FOUNDER-GATE); **refund** post-consume, FOUNDER-GATE, in-wallet credit only (cash-back-to-card is a separate, further-gated decision, not designed here). Every transition is claim-before-effect against the unified `Claim` table (ADR-0045).

## Alternatives considered
- **Consume at Submitted** (the HTTP call was made): rejected — a provider can reject synchronously; consuming here would require an immediate compensating void in the common rejection case.
- **A second negative row at consume:** rejected — double-counts against the fold; consume is a zero-value state-transition marker instead (precedented by `MILESTONE_REACHED@1` carrying no numeric value).
- **Fold `letterCredits` and Wallet into one instrument now:** rejected for v1 — they gate two different Case Journey steps (generation vs. fulfillment); unification is a separate future ADR with its own migration and sign-off.

## Consequences
Stripe top-up reuses the existing one-time-payment (`mode:"payment"`) shape verbatim; preset-vs-dynamic top-up amount is a named, undecided FOUNDER-GATE fork. A 402 insufficient-funds contract mirrors the existing letter-generation 402 shape, routing to a top-up flow instead of a plan-upgrade flow. Four (reserved: five) new closed-set `EventType` literals are added additively to `lib/eventBus/envelope.ts`'s union — every payload field name is already designed around the existing `PII_DENYLIST` substring guard (`centsDelta`/`totalCents`/`basis`, never `amount*`/`balance*`/`reason*`).

## Security implications
Zero cross-imports with `lib/reputation/**` in either direction (guard-pinned, mirroring the isolation `scripts/reputation-runtime.test.ts` already asserts). Negative balances are structurally impossible: an atomic INSERT-time guard (recomputes available balance from the ledger itself, in the same statement as the insert) plus fold-floor defense-in-depth.

## Compliance implications
Refund-to-card, payouts, and Marketplace consumption are each named as **distinct** FOUNDER-GATE items with different blast radii and different required reviewers (some CCO, some counsel, some pure product) — the merge explicitly does not collapse them into one approval. Pricing transparency before authorization depends on the `MailPricing.ts` fix (ADR-0042/Phase 1), not designed here.

## Migration or rollback plan
`WalletLedger` ships as one reviewed additive migration (never self-heal; never added to the frozen allowlist). Guards: `wallet-migration-guard.test.ts` (static — additive-only, `RESTRICT` FKs, unique constraint, fold-order index) + `wallet-runtime.test.ts` (executing — double-authorize, double-consume, void-after-consume, unknown-amount, webhook-replay, all named cases). `WALLET_ENABLED` flag, exact-string `=== "true"`, default OFF; every door fails closed `{ok:false, code:"disabled"}` when off.

## Evidence
`prisma/schema.prisma:749-786` (`XpAward`), `lib/billing.ts:139-269` (`claimStripeEvent`/`creditLetters`), `lib/reputation/fold.ts:43-67` (`foldStanding`), `.ai/ADR/ADR-0038-professional-growth-economy.md:26-27` (PGE-3/4, verified verbatim), `.ai/ADR/ADR-0028-durable-audit.md` (claim shape, verified), `lib/eventBus/validate.ts:22-27` (PII denylist, verified).

---

# ADR-0045: Unified Claim Ledger Pattern

Status: Proposed
Date: 2026-08-03
Decision owners: Chief Architect (Agent E, resolving a merge conflict between Agent A and Agent C — see docket #12, `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §5.3)

## Context
`A-STATE-MACHINE.md` §8 and `C-WALLET-INTEGRATION.md` §3.6 each independently proposed a new claim-before-effect table for the identical ADR-0028 shape (`claimed|completed|in_flight`, atomic `INSERT ... ON CONFLICT DO NOTHING`) — one for mail-transition idempotency (`${mailId}:${toStage}`), one for wallet-transition idempotency (`wallet:<subjectId>:<transition>`) — without either document referencing the other. Shipping both as written would put two structurally-identical tables into the same migration wave.

## Decision
One shared, generically-keyed **`Claim`** table, `domain`-tagged (`ClaimDomain: MAIL_TRANSITION | WALLET`), explicitly set by the calling code at insert time (never inferred by parsing the key string). Each domain keeps its own pre-existing key convention verbatim — no forced renaming. Schema: `CREDITVECTOR-FULFILLMENT-ENGINE-V1.md` §5.3.

## Alternatives considered
- **Two separate domain tables** (as independently proposed): considered seriously — different business-level reclaim TTLs (mail: near-serverless-invocation-scale; wallet: a business-level hold window) and independent shippability are real arguments. Rejected because: (a) ADR-0028 §1.2 already specifies this exact shape as a **generic** kernel port (`IdempotencyStore`, dormant behind `KERNEL_DURABLE`) — two bespoke tables would duplicate a primitive the architecture already declared should be one, and would require a double migration later when consolidating into that port; a single table today is the correct concrete stand-in, collapsing into the port later with zero reshape. (b) The differing-TTL concern is satisfied by branching the reclaim sweep on the `domain` column — the same discipline as one typed function over one input. (c) Independent shippability is preserved at the consumer level (each domain's activation stays separately flag-gated) even though the table ships once.
- **Extend `StripeWebhookEvent`'s existing 3-state claim ledger:** rejected — its key shape is Stripe-event-specific (`lib/billing.ts:139`); overloading it for mail/wallet transitions would couple an unrelated table's schema to two new domains.

## Consequences
One migration, one guard suite (`claim-migration-guard.test.ts` + `claim-runtime.test.ts`) covers both the mail-transition dedup fix (ADR-0042/Policy Engine) and the Wallet's four money-moving transitions (ADR-0044). A future CCO review of financial claims filters to `domain = WALLET` rows without needing a second table.

## Security implications
`resultRef` is an opaque pointer to the settled receipt row, never raw payload — consistent with the Event Bus's refs-only discipline.

## Compliance implications
None beyond what ADR-0042/ADR-0044 already state; this ADR is a structural consolidation, not a new business rule.

## Migration or rollback plan
Additive-only, new table, never self-heal (frozen allowlist forbids it regardless). Rollback = drop the table; both consuming features (mail-transition dedup, Wallet transitions) would need their own fallback claim logic if this were reverted post-activation — named here as a real rollback cost, not hidden.

## Evidence
`.ai/ADR/ADR-0028-durable-audit.md` (verified `claim`/`settle`/`lookup` shape, KernelPorts IdempotencyStore), `lib/billing.ts:150-233` (`StripeWebhookEvent` 3-state precedent), `A-STATE-MACHINE.md` §8, `C-WALLET-INTEGRATION.md` §3.6, §9.1 item 7.

---

# ADR-0046: Kai Fulfillment Narration + Notification Posture

Status: Proposed
Date: 2026-08-03
Decision owners: Founder + Chief Architect (Agent D design, Agent E merge)

## Context
Founder decision (Program Brief §1.7): Kai owns explanation/education/recommendation/narration/guided workflow; never truth, money, execution, policy, or vendor identity. Verified: every existing `recordKaiEvent()` call site lives in route/service code, never in `lib/kai.ts`/`components/kai/*` (L3). Email/push notification effects are blocked platform-wide on ADR-0027's D-07 (mark-on-failure + synthetic replay) and D-08 (payload-blind PEP), both verified verbatim.

## Decision
Extend `KaiEventType` additively with `package.prepared`, `package.approved`, **`package.authorized`** (renamed from D's original `package.funded` — docket #13, disambiguating from `WalletLedger.entryKind:"fund"`), `package.submitted`, `fulfillment.status` (generic carrier for Accepted/Printing/USPS-Accepted sub-stages), `package.mailed`, `package.delivered`, `package.receipt_archived`. Every event is SYSTEM-emitted (route/service code), never Kai-emitted. `waiting.started`/`waiting.ready_for_review` are **narration-only, derive-on-read, never a persisted Bus event** (docket #14 — E-decided; no stronger invariant found in Agent A's artifacts requiring persistence). Guided Package Review (Kai Summary → Recommended Disputes → Educational Explanation) reuses `pickRecommendation`/`KaiWhy`/`RecommendationIntelPanel` idioms verbatim — no new AI-calling path. v1 notifications ship **in-app only**; email/push remain FOUNDER-GATE on ADR-0027's five preconditions.

## Alternatives considered
- **Keep D's original `package.funded` name:** rejected — collides with the Wallet's own `entryKind:"fund"` (an unrelated, account-level top-up concept); renamed to `package.authorized` to align with the §1.10 stage name and remove the ambiguity.
- **Persist `waiting.started`/`waiting.ready_for_review` as Bus events:** rejected — both `A-STATE-MACHINE.md` §5.4 and `A-DOMAIN-MODEL.md` §3.3 independently treat the waiting clock as computed-only with no stored state; persisting an event here would create exactly the kind of second, potentially-stale source of truth the zero-fabrication law forbids.
- **Ship email/push now given the operator-facing value:** rejected — ADR-0027's D-07/D-08 are unresolved kernel defects; shipping a fulfillment-delivery email today risks silently converting a transient send failure into a reported success.

## Consequences
`KaiPresence`'s page-exclusion list gains the evolved `/mail` route and the renamed Package Review route (`B-MAIL-CENTER-EVOLUTION.md`'s route table). The Approve control is confirmed to sit entirely outside all three Kai panels (co-ratified with the Mail Center evolution, docket #7). A vendor-name regex guard (ADR-0043) closes L2's previously-uncompiled enforcement gap.

## Security implications
`package.authorized`'s payload carries `{packageId, authorizationRef}` only — never an amount; money stays exclusively in `WalletLedger` (ADR-0044). No Kai-authored text is ever appended to the audit trail (L3, enforced by construction — Kai has no write path).

## Compliance implications
Kai Summary AI-composed prose (if built) is not persisted server-side absent the existing ADR-0006 gate (docket #3 — no new gate invented). Every stage's Kai copy passes `applyCompliance()`'s prohibited-phrase table unmodified; no vendor name ever appears in Kai's copy (L2).

## Migration or rollback plan
`KaiEventType` union extension is additive TypeScript, no schema change (`KaiEvent` is already a flexible self-heal/append-only table). New Event Bus contracts (`PACKAGE_APPROVED@1`, `PACKAGE_FULFILLMENT_SUBMITTED@1`, `PACKAGE_DELIVERED@1`, `RETURN_RECEIPT_ARCHIVED@1`) are additive to the closed contract registry per ADR-0036's versioning discipline — no existing contract edited.

## Evidence
`lib/kaiEvents.ts:1-23`, `lib/mail/MailService.ts:1-13,125-132`, `.ai/ADR/ADR-0027-notification-decision-vs-effect.md:67,74` (verified D-07/D-08), `lib/forecast.ts:10`, `lib/kaiHome.ts:13,150` (verified `REINVESTIGATION_DAYS`, "quiet is allowed").

---

# ADR-0047: Operational Room Constitution

Status: Proposed (pointer ADR — full text in `OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md`)
Date: 2026-08-03
Decision owners: Founder (ratification required — this is a constitutional amendment, not an engineering ADR alone)

## Context
Founder decision (Program Brief §1.8) proposes that every primary CreditVector room present current work, current state, recommended action, Kai guidance, evidence, and timeline, with metrics as context only — explicitly framed as a **constitutional proposal**, never ratified by this program. `.ai/CONSTITUTION.md` Article IX ("Document consequential decisions... become ADRs in `.ai/ADR/`") is this repository's verified, present mechanism for exactly this kind of amendment.

## Decision
This ADR is a **pointer**: the substantive proposal — the six mandatory presentations, the metrics-context-only law, room applicability/adoption order, the relationship to the CXOS grammar, and the amendment path itself — is written in full as `docs/fulfillment/OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md`, not restated here. This ADR exists only to give the proposal an ADR number and an index line, per Article IX's own convention.

## Alternatives considered
Not applicable to a pointer ADR — alternatives are discussed in the full proposal document.

## Consequences
If ratified, the Mail Center evolution (`B-MAIL-CENTER-EVOLUTION.md`) becomes the **first proof** of this constitution, not a one-off UX choice. Every future primary room's evolution is measured against the same six presentations.

## Security implications
None beyond what the referenced proposal states.

## Compliance implications
Metrics-context-only directly supports the CROA "no fabricated urgency/progress" posture already enforced elsewhere (`lib/compliance.ts`, the Room Constitution's own §9 forbidden-patterns list per the Brief's baseline).

## Migration or rollback plan
Not applicable — a documentation/constitutional amendment, no code or schema change. Ratification is founder-gated and separate from this program's architecture-only scope.

## Evidence
`PROGRAM-BRIEF.md` §1.8, `.ai/CONSTITUTION.md` (Article IX, verified verbatim), `docs/fulfillment/OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md`.

## Numbering note

These proposals are numbered ADR-0041 through ADR-0047. ADR-0040 is already allocated on the accepted CXOS RC2 branch (`ADR-0040-cxos-core-runtime.md`, merging for September), and ADR-0039 is treated as unavailable for cross-branch safety (the same allocated-elsewhere pattern verified for ADR-0030). Numbering therefore continues from the union of all known branches, not this worktree alone.
