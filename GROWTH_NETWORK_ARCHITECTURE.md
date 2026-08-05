# CreditVector Growth Network — Architecture

Status: **PROPOSED FOR FOUNDER REVIEW · DORMANT · NO MONEY MOVEMENT**  
Version: **1.0**  
Date: **2026-07-31**  
Architecture owner: **Gabriel Capital Labs / CreditVector**  
Decision record: [`.ai/ADR/ADR-0039-growth-network-foundation.md`](.ai/ADR/ADR-0039-growth-network-foundation.md)  
Companion documents: [`GROWTH_NETWORK_FOUNDATION.md`](GROWTH_NETWORK_FOUNDATION.md) · [`GROWTH_NETWORK_PRODUCT_SPEC.md`](GROWTH_NETWORK_PRODUCT_SPEC.md) · [`GROWTH_NETWORK_ROADMAP.md`](GROWTH_NETWORK_ROADMAP.md)

> **Production truth:** this document defines the Growth Network boundary and a dormant implementation seam. It does not authorize schema changes, production event registration, public routes, payout calculations, payment-provider work, tax filing, billing changes, or feature activation.

> **Growth Center Foundation Preview addendum (2026-07-31):** statements in this Phase 0 architecture that say “zero consumers/routes” continue to describe the dormant economic/program seam. ADR-0041 separately authorizes one internal, production-hard-off, synthetic L6 review projection at `/review/growth-center`. Growth owns only its fixed preview vocabulary and copy; CXOS Core Runtime owns only presentation lifecycle mechanics; neither owns participant facts. The seven review districts do not supersede the production hierarchy below or create bounded contexts.

## 1. Architectural decision

The CreditVector Growth Network (CGn) is the economic and operational coordination layer for two first-class paths:

1. **Agency Builder:** a future path for building a healthy organization and potentially qualifying for Agency Growth Distribution under approved policy based on verified operations, retention, contribution quality, onboarding, mentorship, and ecosystem health—not recruitment volume.
2. **Professional Operator:** a future independent path through verified education, mentorship, marketplace creation, consulting, Kai assets, responsibly governed affiliate growth, and future programs without owning an agency.

CGn is **not** a monolith. It is a portfolio of bounded contexts connected by the existing CreditVector Event Fabric and governed by the frozen GIOS ownership laws. Growth Center is the experience; “Growth Dashboard” is its default Overview view, not another destination or source of truth.

## 2. Permanent invariants

| Invariant | Architectural consequence |
|---|---|
| No reward for recruiting | No downline, genealogy, rank-by-recruits, pay-to-qualify, or recruitment-volume input exists in distribution policy. |
| Contribution over popularity | Likes, follows, page views, raw post volume, and self-asserted expertise are never qualifying economic evidence. |
| Retention over acquisition | Retention may qualify only when cohort-defined, independently verified, and protected against suppressing legitimate exits. |
| Education over marketing | Verified learning outcomes and useful education may qualify; impressions and promotional volume do not. |
| Mentorship over referrals | Mentorship uses accepted engagements and verified outcomes; a referral alone is never enough. |
| Evidence over claims | Every decision cites immutable evidence references, policy version, qualification cycle, and reason codes. |
| Ecosystem strengthening | A metric that can be increased while harming operators, customers, or the platform is refused or paired with a quality constraint. |
| Instrument separation | Reputation, business health, attribution, entitlements, promotional value, accrued obligations, and cash settlement remain different facts and stores. |
| One owner per fact | Experiences and projections may read facts but never become alternate ledgers. |
| Kai prepares, humans decide | Kai can explain, summarize, forecast, and draft; it cannot own or mutate organizations, identity, tasks, calendar, billing, customers, or money. |
| Fail closed | Missing flags, evidence, authorization, policy, consent, tax status, or risk disposition yields unavailable/held—not an optimistic default. |

## 3. Placement in the frozen platform

```text
L0-L3 GIOS/Kai kernel laws (FROZEN)
        │ identity · policy enforcement · event transport · audit
        ▼
L4 CreditVector domain truth
        ├─ Identity / Organizations / Membership        existing canonical owner
        ├─ Operator Reputation                          existing canonical owner
        ├─ Performance Intelligence                     separate health/KPI owner
        ├─ Entitlements / Reward Claims                 prerequisite context
        ├─ Growth Policy & Qualification                CGn
        ├─ Revenue Attribution                          CGn
        ├─ Growth Distribution + Economic Ledger        CGn
        ├─ Marketplace / Learning / Mentorship          independent commerce domains
        ├─ Economic Integrity + Tax Readiness           independent control domains
        └─ canonical work/messaging/meeting owners      unchanged or future ADR
        │
L5 orchestration
        └─ Growth Network orchestration; no data ownership
        │
L6 experiences
        └─ Growth Center (Overview/Dashboard) · Campaigns · Challenges · Team Spaces
        │
L7 providers
        └─ future settlement/tax/commerce integrations; explicitly absent
```

CGn must not import from, write to, or extend Mission Control, Agency Command, Arena, Community, or CXOS rooms. Future integrations consume contracts through their owners after separate approval.

## 4. Bounded-context map

### 4.1 New CGn contexts

| Context | Sole ownership | Explicit non-ownership | Initial status |
|---|---|---|---|
| **Growth Policy & Qualification** | Versioned qualification rules, observation-cycle calendar, evidence requirements, decision classes, policy simulation, sealed qualification decisions | Money amounts, distribution cases, reputation awards, identity, health facts, provider execution | **Contract vocabulary only in foundation; service proposed** |
| **Revenue Attribution** | Referral/affiliate touchpoints, attribution episodes, relationship disclosures, consent, expiry, conflict/self-referral classification | Commission amount, customer identity truth, billing, payout | Proposed |
| **Growth Distribution & Economic Ledger** | Monthly distribution cases that reference sealed qualification decisions, holds, approvals, statements, and a future immutable accrual/adjustment/reversal/settlement-reference journal module | Qualification truth/snapshots, payment execution, tax filing, Stripe subscriptions, bank balances, reputation/XP, source-domain facts | Proposed; ledger schema later |
| **Economic Integrity** | Risk signals, review cases, evidence links, maker-checker decisions, sanctions, case disposition, appeal handoff | Identity state, payout execution, hidden autonomous punishment | Proposed |
| **Tax Readiness** | Payee tax profile status, tax-year policy version, validated form/document references, backup-withholding instruction state, reporting classification decision | Tax advice, tax filing, funds, use of TIN data for growth/fraud scoring | Proposed; counsel/accountant gate |
| **Growth Analytics** | Rebuildable, provenance-tagged projections and cohort reports | Qualification truth, ledger truth, reputation truth, source records | Proposed |

### 4.2 Existing or separately governed dependencies

| Context | Canonical owner | CGn usage |
|---|---|---|
| Authentication | `lib/auth.ts`, `lib/session.ts` | Supplies authenticated account only. |
| Operator Identity / Organization / Membership | `lib/identity/**` | Resolves operators, organization membership, lifecycle, and authorization attributes. `managedByAgencyId` is not membership. |
| Operator Reputation | `lib/reputation/**` | Supplies verified contribution/reputation evidence. CGn never creates a second reputation ledger or changes XP. |
| Performance Intelligence | `PERFORMANCE-INTELLIGENCE.md`; future service | Supplies sealed retention, health, onboarding, and improvement evidence. Business health is not reputation. |
| Entitlements / Reward Claims | ADR-0038 reserved context | Gates access and one-time non-cash claims; no XP subtraction or cash conversion. |
| Event Fabric | `lib/eventBus/**` | Transports refs-only facts. It owns transport, not event meaning. |
| Billing | `lib/stripe.ts`, `lib/billing.ts` | Remains the sole subscription truth. CGn foundation has a guard-pinned no-import boundary. |
| Marketplace | Future commerce owner | Owns listings, orders, refunds, seller obligations, and marketplace compliance. CGn consumes sealed revenue/evidence facts. |
| Learning / Education | Future learning owner | Owns courses, enrollment, completion, assessment, certification evidence, and education orders. |
| Mentorship / Professional Services | Future service owner | Owns engagements, acceptance, delivery evidence, completion, disputes, and service orders. |
| Kai | `lib/kai.ts`, `lib/intelligence/**` | Explains and prepares from authorized projections. Never records qualification, risk, ledger, task, or payment truth. |

### 4.3 Experiences, not truth owners

| Surface | Role |
|---|---|
| **Growth Center** | One entry point for paths, opportunities, policies, education, and next actions. Its default **Overview (“Growth Dashboard”)** is an own-data projection of qualification, holds, streams, statements, and improvement opportunities—not a separate product surface. |
| **Organization Growth** | Organization-scoped projection of health and contribution; never a public rank. |
| **Contribution Engine** | Product name for policy-driven evidence evaluation across source contexts; implementation belongs to Growth Policy and canonical evidence owners. |
| **Attribution Program Configuration** (requested “Campaign Center”) | Configures approved attribution programs and disclosure policy only. It owns no sends, tasks, queues, or outbound orchestration and must not reuse `lib/campaign/**`, which means credit-dispute campaigns. |
| **Growth Reputation View** | Private, consent-aware projection over canonical Reputation + Performance Intelligence evidence. No second score or ledger. |
| **Growth Challenges / Rewards** | Improvement-oriented experiences consuming Reputation and Entitlement facts. No cash, recruiting, streak, popularity, or pay-to-win mechanics. |
| **Kai Growth Strategist** | A Kai role/surface that recommends and prepares; no autonomous writes or economic decisions. |

## 5. Growth Reputation architecture

“Growth Reputation” is new as a **purpose-bound view**, not a new reputation system. The canonical Reputation Service already owns trust and Vector XP. Creating another ledger would violate the one-owner law and permit double scoring.

### 5.1 Ownership and model

- Canonical awards, reversals, milestones, and policy remain in `lib/reputation/**`.
- Performance Intelligence owns organization health, retention, KPI, and improvement facts.
- Education, Mentorship, Marketplace, and the eventual canonical work contexts own their outcome evidence.
- A future **Growth Reputation Projection** is owned as a module within the canonical Operator Reputation boundary (`lib/reputation/**`) and may join authorized references for a stated purpose and audience. CGn's Growth Center consumes it; CGn does not own or store a second reputation projection.
- The projection is disposable and rebuildable; source facts and policy version are mandatory.
- No universal “worth” number, public 1–5 rating, popularity rank, or cash conversion is allowed.

### 5.2 Dimensions

Dimensions are shown separately, never collapsed into an unexplained composite:

| Dimension | Candidate evidence | Refused shortcut |
|---|---|---|
| Mentoring | Accepted engagement, independent attendance/delivery evidence, mentee acknowledgment, source-confirmed service outcome | Number of claimed mentees; percentage of mentee future revenue |
| Onboarding | Completed onboarding outcome, retained activation, quality/complaint checks | Invitations sent |
| Operator success | Role-appropriate, source-confirmed operational milestones and quality improvement within a fair cohort | Revenue, client count, hours online, customer payment duration, credit scores/deletions, dispute volume, headcount, raw activity, testimonials/self-claims |
| Education | Assessment/course completion, learner usefulness, correction history | Views, followers, promotional reach |
| Retention | Sealed cohort-normalized quality diagnostic with legitimate cancellations/departures excluded from positive incentive treatment | Real-time "retain one more" target, preventing exit, paid duration, or hidden churn |
| Contribution | Canonical reputation awards tied to verified evidence | Likes, logins, raw posting |
| Ecosystem health | Substantiated complaint/remediation and invalidation/reversal quality; source-accepted cross-organization contribution; safe retention/successful exits; evidence diversity | Network/headcount growth, paid retention, prevented cancellation, engagement/popularity, hidden churn, participant purchases |

### 5.3 Visibility and privacy

- Default: operator sees their own evidence, policy, and improvement guidance.
- Organization owners/admins see aggregate organization outcomes by default, not named personal reputation. Any named operational view needs separate role, purpose, consent, and policy authorization.
- Peer comparison is excluded from v1 and all shadow pilots. Any later cohort comparison requires a separate fairness/privacy/CCO decision and cannot expose named peers.
- Public reputation, named ranking, earnings, and customer outcomes stay off until specific counsel, privacy, safety, appeal, and founder approval.
- Sensitive evidence is resolved from its owner at read time; Event Fabric and projections store references and bounded classifications, not narrative PII.

### 5.4 Anti-abuse

- Independent source events; no client-supplied award amounts or verification flags.
- Stable subject IDs and idempotency keys prevent duplicate credit.
- Reversals are compensating facts; history is never rewritten.
- Related-party, self-funded, self-referral, and reciprocal-collusion evidence is held or excluded.
- Caps and diversity constraints prevent a single easy dimension from dominating.
- Appeals are reviewed by a different actor than the original adverse decision.

## 6. Monthly Growth Distribution

### 6.1 Cycle model

The founder-ratified **Agency Growth Distribution** day is the **15th of every month**. It does not set the cadence for other revenue streams unless the Founder explicitly extends the rule. Foundation code accepts an explicit `AgencyDistributionMonth` (`YYYY-MM`) and returns that same month's date-only 15th. It never accepts an observation-cycle ID, infers the next month, reads ambient time, or chooses a timezone.

| Period | Proposed operating purpose | Status |
|---|---|---|
| Previous calendar month | Qualification observation window | **Proposed** |
| 1st–10th | Source sealing, reconciliation, late-event cutoff, operator preview | **Proposed** |
| 11th–14th | Fraud, compliance, tax-readiness, finance approval, maker-checker lock | **Proposed** |
| 15th | Scheduled Agency Growth Distribution date | **Founder-ratified** |
| After lock | Late evidence rolls into the next cycle or explicit adjustment; no silent rewrite | **Proposed** |

Weekend/holiday settlement behavior is **NEEDS CONFIRMATION** because no payment rail exists. “15th” means the program schedule date, not a personal payment promise or a claim that a bank will settle that day.

### 6.2 Qualification ladder

```text
authenticated account
  → active Operator Identity
  → eligible Organization Membership when organization-scoped
  → sealed qualification cycle
  → complete, source-owned evidence set
  → policy-versioned qualification decision
  → economic-integrity disposition
  → compliance and tax-readiness clearance
  → independent finance approval
  → accrued obligation in Economic Ledger
  → settlement intent (future)
  → provider receipt (future; only proof of payment)
```

Missing any required predecessor yields `HELD` or `INELIGIBLE`, never “paid,” “earned,” or “approved by default.”

### 6.3 Eligibility inputs

Agency Growth Distribution may evaluate, subject to Phase 0.5 Founder/counsel ratification:

- under the current proposed compliance mechanism, operator-related evidence only when each actor was independently verified and active during the evidence window; operator count or addition cannot unlock eligibility or affect allocation;
- cohort-defined retention and sustained health, with legitimate exits excluded from punitive incentives;
- verified onboarding outcomes;
- accepted mentorship and education outcomes;
- canonical contribution evidence;
- complaint, dispute, reversal, abuse, and ecosystem-health constraints;
- policy-required identity, membership, tax-readiness, and review state.

It must never evaluate:

- recruits, downline depth, invitations, recruitment volume, paid seats, or raw headcount growth;
- self-referrals, same-payer/same-beneficiary arrangements, circular transactions, or forced purchases;
- popularity, impressions, followers, likes, logins, streaks, or unverified testimonials;
- Vector XP as cash or a direct conversion rate;
- protected-class data or unreviewed proxies.

### 6.4 Orthogonal state models

No single composite status crosses the qualification, case, accounting, and settlement owners.

| Owner/model | States or facts | Meaning |
|---|---|---|
| Growth Policy / `QualificationDecision` | `DRAFT`, `QUALIFIED`, `INELIGIBLE`, `SUPERSEDED` | Non-monetary decision over sealed evidence; disclosed decision classes and appeal reference |
| Growth Distribution / `DistributionCase` | `OPEN`, `HELD`, `READY_FOR_ACCRUAL`, `CANCELLED`, `CLOSED` | Operational case referencing—but never restating—the Qualification decision; holds do not mutate qualification truth |
| Growth Distribution ledger | immutable `ACCRUAL`, `HOLD`, `RELEASE`, `ADJUSTMENT`, `REVERSAL` entries | Accounting facts; projected balance is not a state field |
| Future settlement reference | `PREPARED`, `SCHEDULED`, `SETTLED`, `FAILED`, `RETURNED` | Provider lifecycle only; only a reconciled receipt supports `SETTLED`/“paid” |

The dormant foundation implements none of these runtime state machines. It exposes only path/stream/schedule/refusal vocabulary and cannot create a qualification, case, journal entry, or settlement reference.

## 7. Economic Ledger design

### 7.1 Ledger principles

- Append-only journal; balances are projections.
- Amounts use bounded signed 64-bit/BigInt minor units plus ISO 4217 currency and an accountant-approved currency-scale table; never floating point. Parse/serialize/database boundaries reject overflow, unsupported currency/scale, and mixed-currency arithmetic.
- Every entry has `ledgerEntryId`, participant/payee reference, organization reference when relevant, instrument, entry type, amount, currency, cycle, policy version, decision class, evidence refs, effective time, recorded time, actor/authority, idempotency key, causation/correlation, and reversal reference.
- Unique natural keys make retries no-ops and mismatched reuse a conflict.
- Corrections use adjustments or reversals; no mutation of posted facts.
- Separation-of-duties: the policy evaluator cannot be the final finance approver; the finance approver cannot alter source evidence.
- Statements are projections over journal entries and display gross, adjustments, reversals, holds, and net separately.
- A deterministic SHA-256 digest over a canonical serialization detects replay/conflict and supports reconstruction; it does **not** prove authenticity or resist an authorized database attacker. Any future tamper-evident signature requires canonicalization, isolated signing key + key version, rotation/revocation, and an external checkpoint/audit design.

### 7.2 Entry types

| Entry | Purpose | Foundation availability |
|---|---|---|
| `ACCRUAL` | Recognizes an approved obligation | Deferred until amount policy + schema approval |
| `HOLD` / `RELEASE` | Records economic availability controls | Deferred |
| `ADJUSTMENT` | Corrects a policy/accounting difference with explicit reason | Deferred |
| `REVERSAL` | Compensates a prior entry without deleting history | Deferred |
| `SETTLEMENT_INTENT` | Records future provider instruction | Provider phase only |
| `SETTLEMENT_RECEIPT` / `SETTLEMENT_FAILURE` | Reconciles provider result | Provider phase only |

### 7.3 Instrument partitions

Separate ledger accounts and type systems are required for:

- Agency Growth Distribution;
- Marketplace seller proceeds;
- course and education proceeds;
- mentorship and consulting proceeds;
- Kai asset proceeds;
- affiliate commission;
- future sponsorship, partnership, and enterprise program proceeds.

They may share the journal mechanism after review but never share policy semantics. Vector XP, business health, entitlements, promotional credits, and subscription billing are prohibited instruments in the economic ledger.

### 7.4 Canonical revenue-stream registry

These eleven identifiers are architecture vocabulary, not live products or shared accounting policy. Funding, cadence, take rate, amount, tax class, and legal payer remain unratified except the Agency Growth Distribution day.

| Identifier | Source truth owner | Future economic policy/journal owner | Proposed funding/cadence | Maturity |
|---|---|---|---|---|
| `AGENCY_GROWTH_DISTRIBUTION` | Growth Policy qualification refs + source domains | Growth Distribution | Founder-approved bounded pool or other approved structure; monthly schedule on the 15th | Foundation identifier only |
| `MARKETPLACE_SALE` | Marketplace settled/refund/order facts | Marketplace proceeds policy + Growth journal adapter | Buyer transaction less approved fees/reserves; per settlement batch | Absent |
| `COURSE_SALE` | Learning/Marketplace order facts | Course proceeds policy + Growth journal adapter | Buyer transaction less approved fees/reserves; per settlement batch | Absent |
| `EDUCATION_SERVICE` | Learning/service engagement owner | Service proceeds policy + Growth journal adapter | Accepted direct service/contract | Absent |
| `MENTORSHIP` | Mentorship engagement owner | Mentorship proceeds policy + Growth journal adapter | Accepted direct service/contract | Absent |
| `CONSULTING` | Professional-services engagement owner | Consulting proceeds policy + Growth journal adapter | Accepted direct service/contract | Absent |
| `KAI_ASSET` | Marketplace asset/license order owner | Kai-asset proceeds policy + Growth journal adapter | Approved license/order less fees/reserves | Absent |
| `AFFILIATE_GROWTH` | Revenue Attribution + independent source conversion/refund facts | Affiliate commission policy + Growth journal adapter | One-level only is a compliance proposal; matured commission batch | Absent |
| `SPONSORSHIP` | Future contract/delivery owner | Contract-specific proceeds adapter | Signed contract and accepted delivery | Future |
| `PARTNERSHIP` | Future contract/delivery owner | Contract-specific proceeds adapter | Signed contract and accepted delivery | Future |
| `ENTERPRISE_PROGRAM` | Future enterprise contract/delivery owner | Contract-specific proceeds adapter | Signed contract and accepted delivery | Future |

The source owner establishes what happened; the economic policy determines whether an obligation exists; the Growth Distribution journal module records only approved obligations. A future adapter never copies or becomes the source order, engagement, or contract.

## 8. Revenue attribution

Attribution proves a relationship; it does not create eligibility or money.

### 8.1 Episode model

Each episode requires:

- opaque attribution ID and versioned attribution policy;
- referrer/operator and referred-party references resolved through Identity;
- campaign/asset reference and disclosure version;
- server-recorded touchpoint class and timestamp;
- consent and applicable notice evidence;
- expiry window and channel;
- conflict classifications (self, related party, same payer, shared device/address/payment instrument where lawfully available);
- independent activation/retention evidence before qualification;
- immutable disposition and appeal reference.

### 8.2 Refusals

- No browser-supplied “converted” flag.
- No last-click assumption without an approved policy.
- No lifetime attribution by default.
- No rewards for an invitation, signup, or recruit alone.
- No attribution graph that becomes an upline/downline genealogy.
- No cross-use of tax TIN data, credit-report data, or unrelated PII for attribution.

## 9. Team Operations architecture

Team Operations is a future organization-scoped **experience**, not a new truth context, Discord, Slack, Agency Command, Mission Control, Community, or a consumer-management substitute. It may compose authorized records from canonical owners only. The foundation neither chooses a new work/messaging owner nor modifies an existing one.

### 9.1 Deterministic ownership

| Record/capability | Canonical or required owner | Notes |
|---|---|---|
| Organization/member/role | Identity | Team Operations references it; no fallback to `managedByAgencyId`. |
| Agency campaign/task/priority | Agency Command | Existing owner remains untouched; the Team Operations experience may later link, never duplicate or mutate through a parallel store. |
| Channel/message/announcement | Operator Network or a separately approved future Rooms context | No third messaging stack. Audience still derives from active Membership and explicit access. |
| Non-agency work coordination | **Unresolved—requires ownership ADR before schema** | Kai cannot own it; do not create a generic `Task`, `Channel`, or `Campaign` model in CGn. |
| Meeting schedule | GIOS scheduler / separately approved Meetings context | A prepared brief may reference an event; it cannot become calendar truth. |
| Presence preference/session signal | Existing/future Network presence owner after privacy approval | Currently off/refused; if approved, opt-in, ephemeral, coarse, minimum retention, and never a performance metric. |
| Shared document | Canonical encrypted attachment/document owner | Team Operations stores no duplicate bytes or public object URLs. |
| Training assignment/outcome | Learning | Experience may coordinate and link; Learning owns content/completion truth. |
| Mentorship engagement/outcome | Mentorship | Experience may coordinate and link; Mentorship owns engagement truth. |

### 9.2 Access and privacy

- Every future request resolves account → active Operator Identity → active Organization Membership → role/capability through the PEP.
- Organization isolation is mandatory at query and command boundaries; client-supplied organization IDs are never trusted alone.
- Removing/suspending membership immediately removes workspace access; historical authorship may remain as an opaque reference under retention policy.
- Presence, read receipts, and typing state are off by default pending privacy review; none may affect reputation, distribution, or worker evaluation.
- Customer/credit-report data is not allowed in general channels or Kai prompts. Structured customer work stays in its canonical encrypted domain.
- Any announcements, tasks, and shared work presented by the experience retain their canonical owner, immutable audit references, and bounded retention.
- No Team Operations persistence, route, or event is permitted until the overlap/ownership ADR chooses the one owner for each unresolved record.

## 10. Kai Growth Strategist

Within CGn, Kai may:

- explain a qualification decision using cited reason/evidence references;
- summarize organization health and contribution gaps;
- prepare an onboarding, mentoring, education, campaign, or meeting plan;
- simulate policy outcomes on non-production or approved own-data inputs;
- identify missing evidence, expiring qualifications, unresolved holds, and next human actions;
- coordinate a draft across source contexts through approved read tools.

Kai may not:

- create or change identity, organization, membership, customer, billing, ledger, tax, risk, task, or calendar truth;
- approve qualification, release a hold, calculate an unratified amount, initiate a payout, file a form, send a campaign, or publish an earnings claim;
- infer sensitive facts, invent evidence, conceal uncertainty, or use free-text output as an authorization fact.

The user-requested phrase “Chief Executive Intelligence Officer” is treated as a **CGn functional description, not a global title change**. `KAI-OS.md` remains the canonical identity/title authority until a founder-approved amendment explicitly changes it.

## 11. Event ownership and contracts

### 11.1 Laws

- The emitting bounded context owns the fact and payload meaning.
- Event Fabric owns validation, envelope, durable event persistence/replay queries, and current best-effort delivery only. Fresh fanout is at-most-once and has no durable failed-handler redrive.
- Contracts are immutable and versioned; breaking changes add a version.
- Payloads are references, bounded enums, counts, booleans, digests, and timestamps—never tax forms, emails, addresses, payment details, credit data, document bodies, task text, or Kai prose.
- Consumers resolve details from the owner under current authorization.
- A projection can be deleted and rebuilt without losing truth.
- The foundation registers **zero** new production events.
- The current Event Envelope's legacy `agencyId` follows the live consumer-management axis and is **not** generic `Organization.id`. Organization-scoped CGn publish/replay/read is blocked until an additive, reviewed Organization scope/authz/index contract exists; CGn must never reinterpret `agencyId`.

### 11.2 Proposed event catalog

Names below are reserved proposals, not implemented contracts.

| Proposed event type | Version | Owning emitter | Minimum refs-only meaning | Likely consumers |
|---|---:|---|---|---|
| `QUALIFICATION_CYCLE_SEALED` | 1 | Growth Policy | cycleId, window refs, policyVersion, digest | Distribution, Analytics |
| `GROWTH_QUALIFICATION_DECIDED` | 1 | Growth Policy | decisionId, participantRef, cycleId, disposition, decisionClasses, policyVersion | Distribution, Kai projection |
| `ATTRIBUTION_EPISODE_CLASSIFIED` | 1 | Revenue Attribution | attributionId, class, disposition, policyVersion | Distribution, Integrity |
| `DISTRIBUTION_CASE_HELD` | 1 | Growth Distribution | caseId, holdClass, cycleId | Integrity, statements |
| `DISTRIBUTION_CASE_APPROVED` | 1 | Growth Distribution | caseId, approvalRef, cycleId, policyVersion | Economic Ledger |
| `LEDGER_ENTRY_POSTED` | 1 | Growth Distribution ledger module | entryId, instrument, entryType, cycleId, reversalRef | Statements, Tax Readiness |
| `INTEGRITY_CASE_DISPOSITIONED` | 1 | Economic Integrity | caseId, disposition, signalClasses, reviewerAuthority | Distribution, Appeals |
| `TAX_READINESS_CHANGED` | 1 | Tax Readiness | payeeRef, taxYear, readinessState, policyVersion | Distribution |
| `MARKETPLACE_ORDER_SEALED` | 1 | Marketplace | orderId, sellerRef, orderState | Ledger, Analytics |
| `LEARNING_OUTCOME_VERIFIED` | 1 | Learning | outcomeId, operatorRef, courseRef, resultClass | Reputation, Distribution |
| `MENTORSHIP_OUTCOME_VERIFIED` | 1 | Mentorship | engagementId, mentorRef, outcomeClass | Reputation, Distribution |

Existing Identity (`MEMBERSHIP_*`) and Reputation (`OPERATOR_XP_CHANGED`, `REPUTATION_AWARD_REVERSED`, `OPERATOR_RANK_CHANGED`, `MILESTONE_REACHED`) facts are reused through their owners; CGn does not re-emit them.

## 12. Database ownership recommendations

No schema is added in the foundation. Every future table follows migration-first, reviewed preflight, forward validation, rollback, and deliberate release application.

### 12.1 Recommended schemas/tables by owner

| Context | Recommended records | Critical constraints |
|---|---|---|
| Growth Policy & Qualification | `GrowthPolicyVersion`, `QualificationCycle`, `QualificationDecision`, `QualificationEvidenceRef` | Immutable published policy; unique participant+cycle+policy decision; evidence digest |
| Revenue Attribution | `AttributionEpisode`, `AttributionTouchpoint`, `AttributionDisposition`, `AttributionConsentRef` | Idempotent touchpoint; expiry; no genealogy; related-party classification |
| Growth Distribution | `DistributionCase`, `DistributionQualificationRef`, `DistributionHold`, `DistributionApproval`, `DistributionStatement` | References canonical Qualification decision; unique participant+cycle+instrument; maker-checker; explicit case transitions |
| Growth Distribution ledger module | `EconomicAccount`, `EconomicJournalEntry`, `EconomicJournalLine`, `SettlementReference` | Balanced entry invariant; integer minor units; unique idempotency key; reversal FK |
| Economic Integrity | `IntegrityCase`, `IntegritySignal`, `IntegrityDecision`, `IntegrityAppealRef` | Signal ≠ guilt; reviewer authority; immutable disposition history |
| Tax Readiness | `PayeeTaxProfile`, `TaxDocumentRef`, `TaxClassificationDecision`, `TaxYearPolicy` | encrypted/restricted; tax-year version; no raw TIN in event/projection/log |
| Team Operations experience | **No tables recommended yet** | Resolve Agency Command / Operator Network / Rooms / Meetings / scheduler / document-owner overlaps by ADR before schema; do not create generic task/channel/campaign tables in CGn |
| Growth Analytics | materialized projections only | Rebuild cursor, source watermark, policy version, k-anon where cross-user |

### 12.2 Data classes

| Class | Examples | Handling |
|---|---|---|
| Public policy | principles, published rule explanation | Versioned; integrity protected |
| Internal operational | cycle, task state, organization metrics | Tenant-scoped, least privilege, audit |
| Sensitive economic | amounts, holds, statements, tax readiness | Field encryption where applicable, restricted role, immutable audit |
| Restricted tax identity | W-9/TIN/document | Separate vault/reference, encryption, no logs/events/analytics, purpose limitation |
| Restricted integrity/investigation | device, network, address, payment/funding, linkage, and reviewer-case evidence | Raw identifiers stay with lawful source owners; CGn receives bounded signal classes/opaque refs only; no Kai, general analytics, public projection, or tax-data reuse |
| Regulated credit/customer | reports, disputes, customer documents | Never copied into CGn; resolve only in owning domain under permissible purpose |

## 13. Security architecture

### 13.1 Threats and controls

| Threat | Required controls |
|---|---|
| Cross-tenant access | Server-resolved organization scope, PEP default deny, membership lifecycle checks, negative authorization tests |
| Horizontal IDOR | Opaque IDs are insufficient; authorize every referenced record against owner and purpose |
| Duplicate/replayed events | Stable natural idempotency keys, payload conflict detection, immutable event versions |
| Ledger tampering | Append-only balanced journal, maker-checker, canonical decision/evidence digests for replay/conflict detection, reconciliation; a plain hash is not a signature |
| Insider fraud | Separation of duties, step-up auth, reason codes, immutable audit, scoped admin tools, dual approval |
| PII leakage | Refs-only events, encrypted fields, log denylist, short-lived signed access, no narrative data in projections |
| Kai prompt injection | Structured tool outputs, untrusted-content fencing, no secrets, read-only tools, deterministic policy authority |
| Feature accidentally live | Exact-string master flag, zero consumers/routes/jobs, no schema, guard rejecting provider/billing/Prisma/network imports |
| Dependency confusion | Context-level public barrels and import-boundary guards |
| Denial/cost abuse | Rate limits, bounded queries, quotas, backpressure, replay checkpoints |

### 13.2 Activation controls

- `GROWTH_NETWORK_ENABLED` is off unless exactly `"true"`.
- A future subordinate capability must require both the master flag and its own exact-string flag.
- Feature flags are not authorization; PEP, Identity, Membership, and entitlement checks remain mandatory.
- Production activation requires schema readiness verification, not runtime creation.
- Kill switches must stop new effects while preserving read-only reconciliation and audit access.

### 13.3 Capability and object scope

Every future endpoint, tool, and command enforces both a capability and ownership/purpose scope; a role name or opaque ID alone is insufficient.

| Actor | Minimum object scope | Allowed capability class | Explicit denials |
|---|---|---|---|
| Participant/operator | own participation, decisions, statements, evidence refs, appeals | read own; submit bounded correction/appeal evidence | other participant/org data, raw integrity/tax data, approvals, ledger mutation |
| Organization owner/admin | active Membership + same Organization + approved operational purpose | read permitted organization projections; manage future program settings through owner context | member tax/individual integrity detail, cross-org data, source-evidence edits, self-approval |
| Finance reviewer | assigned distribution case/journal scope; no source-evidence ownership conflict | approve/reject accrual preparation, read statements/reconciliation | edit qualification/source facts, release integrity/tax hold alone, provider execution without later dual control |
| Integrity reviewer | assigned case + documented purpose; conflict check | read bounded source refs, request evidence, disposition/hold within CGn | global Identity suspension, tax TIN, ledger posting, own appeal review |
| Appeal reviewer | assigned appeal and prior-decision separation | read relevant decision/case refs; uphold/remand/overturn within policy | hidden unrelated signals, original-decision conflict, ledger/provider mutation |
| Tax administrator | explicit payee/tax-year scope + privileged MFA/JIT | manage tax-readiness/document workflow | reputation/fraud scoring, Kai access, general organization/operator browsing |
| Platform administrator | narrowly delegated object/capability + step-up + recorded basis | break-glass/support action defined by policy | ambient all-data access, self-approval, secret export |
| Kai | current user's authorized read projection only | explain, summarize, prepare draft | mutation, approval, raw tax/integrity/customer data, cross-tenant or hidden-policy access |

Negative IDOR tests cover every actor/object combination, including existence-hiding for forbidden records and revocation after membership/lifecycle change.

## 14. Anti-fraud architecture

### 14.1 Signal classes

Signals may include, where lawfully collected and purpose-limited:

- self-referral, same payer/beneficiary, related-party, shared funding source;
- duplicate account/device/session patterns, credential sharing, synthetic identity indicators;
- impossible timing, burst creation, reciprocal/circular transactions, collusive review rings;
- inactive/empty organization, sham membership, short-lived activation, forced retention;
- repeated refund/chargeback/reversal, complaint, takedown, or policy-violation patterns;
- contribution duplication, plagiarism, low-effort flooding, fabricated course/mentorship completion;
- manual override concentration or reviewer conflict.

### 14.2 Decision model

```text
signal (not guilt)
  → deterministic rules and explainable features
  → risk case with source refs
  → hold when economic exposure exists
  → independent human review
  → clear / continue hold / reverse / suspend eligibility / refer identity-security issue
  → notice and appeal where appropriate
```

No adverse action is based solely on an opaque AI score. Kai may summarize a case but cannot create signals, set dispositions, or release funds. Thresholds are confidential, versioned policy; outcome reason categories remain explainable.

### 14.3 Sybil and collusion controls

- One authenticated account does not automatically equal an Operator; use explicit Identity enrollment.
- Membership does not prove activity; use independently sealed source outcomes.
- New identities/organizations use seasoning and graduated limits, not permanent exclusion.
- Referral and contribution credit requires diverse evidence; circular edges are held.
- Organization-wide and network-wide anomaly analysis must use data minimization and documented lawful purpose.
- W-9/TIN data is purpose-restricted and must **not** become a Sybil or growth-scoring input.

## 15. Compliance and tax architecture

This is engineering risk analysis, not legal or tax advice.

### 15.1 Compensation-plan controls

The FTC evaluates how a structure operates in practice, including recruiting emphasis, participant experience, access to rewards, purchases, and incentives. CGn therefore prohibits downlines, recruitment rewards, pay-to-qualify, mandatory purchases, and earnings claims untethered to typical substantiated results. The final compensation formula, terms, training, monitoring, and participant communications require specialist counsel review before pilot. See [FTC MLM business guidance](https://www.ftc.gov/business-guidance/resources/business-guidance-concerning-multi-level-marketing) and [FTC endorsement guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking).

### 15.2 Earnings and endorsement controls

- Never promise income, recurring revenue, typical results, business success, credit outcomes, deletions, or score improvement.
- Any earnings representation must be substantiated, audience-appropriate, net of relevant expenses where required, and accompanied by counsel-approved disclosure.
- Affiliate/material relationships require clear and conspicuous disclosure near the endorsement; platform terms, training, monitoring, escalation, and removal controls are required.
- User-created education/marketplace content needs complaint, moderation, correction, takedown, repeat-offender, and records processes.
- Consumer credit education remains software-and-education first; CROA, FTC Act, state credit-services laws, FCRA/FDCPA boundaries, UDAAP/UDAP, testimonials, and agency practices require CCO/counsel review.

### 15.3 Tax controls

- Tax obligations depend on the actual payor-of-record, payment rail, contractual relationship, payee classification, jurisdiction, and tax year; “marketplace” does not decide the filer.
- For payments made in 2026, IRS guidance reflects a **$2,000** threshold for specified Forms 1099-MISC/NEC reporting, indexed after 2026; the system must use tax-year policy, never a permanent constant. See [IRS 2026 information-return guidance](https://www.irs.gov/irb/2026-19_IRB) and [Instructions for Forms 1099-MISC/NEC](https://www.irs.gov/instructions/i1099mec).
- Payment-card and qualifying third-party-network payments may fall under Form 1099-K rules instead of 1099-NEC/MISC; responsibility depends on statutory and contractual facts.
- Form W-9 provides a TIN to a party required to file an information return. Collection, validation, access, retention, backup withholding, and error handling require a restricted tax subsystem. See [IRS Form W-9](https://www.irs.gov/forms-pubs/about-form-w-9).
- Worker status depends on the real relationship—including behavioral control, financial control, and the parties’ relationship—not the label “operator” or “contractor.” See [IRS worker classification](https://www.irs.gov/businesses/small-businesses-self-employed/employee-common-law-employee).
- State reporting, withholding, unclaimed-property, money-transmission, marketplace-facilitator, sales-tax, labor, and business-opportunity rules require jurisdictional counsel/accountant analysis before launch.

## 16. Failure, disputes, reversals, and suspension

- **Hold before harm:** unresolved fraud, tax, compliance, identity, evidence, sanction, or dispute state prevents accrual approval or settlement.
- **No silent forfeiture:** every hold/ineligibility/reversal has a policy version, bounded reason, effective date, evidence refs, notice class, and appeal path.
- **Appeals:** operator submits specific counter-evidence; reviewer differs from original decision; outcome and SLA are auditable.
- **Suspension:** Identity owns operator/org lifecycle suspension; Economic Integrity may suspend economic eligibility only. It cannot deactivate identity.
- **Reversals:** source fact invalidation leads to compensating qualification/ledger facts; settled overpayments become recoverable-balance or future-offset candidates only after legal/accounting policy approval—never automatic bank debits.
- **Disputes:** customer/order/service disputes remain with the source commerce context; Distribution consumes the sealed disposition.

## 17. Scalability and reliability

- Partition work by cycle and participant; never rescan the entire network on a request.
- Seal source watermarks and use replayable projections.
- Batch qualification with idempotent commands and resumable checkpoints.
- Keep synchronous paths pure. Current fresh Event Fabric fanout is best-effort, in-process, and at-most-once after a successful append, with no durable failed-handler redrive; monetary truth must never depend on delivery. Any future reliable consumer workflow needs a separately approved design and idempotent replay from source/ledger truth.
- Reconcile ledger projections against journal entries and future provider receipts.
- Use bounded context APIs, not cross-table reads.
- Version policies and contracts so historical statements replay under their original rules.
- Define SLOs before pilot: cycle seal timeliness, decision explainability, hold review time, statement correctness, duplicate rate, reconciliation difference, and appeal SLA.

## 18. Architecture risks

| Risk | Severity | Mitigation / gate |
|---|---:|---|
| Compensation behaves like recruitment economics despite branding | Critical | Formula excludes recruitment; actual plan + training + incentives reviewed by specialist counsel and monitored in pilot |
| Duplicate source of reputation/health/identity | Critical | Ownership map + import/schema/event contract guards |
| Premature payment/tax/provider coupling | Critical | Foundation has no provider, billing, Prisma, route, job, or production event dependency |
| Hidden worker-control implications | High | Employment counsel review of Team Operations, incentives, tasks, presence, and relationship facts |
| Metric gaming harms customers/operators | High | quality constraints, source verification, diverse dimensions, reversals, appeals, continuous red-team |
| Cross-tenant or sensitive-data exposure | Critical | Identity/Membership/PEP, refs-only events, encryption, negative auth testing |
| Ledger/accounting error | Critical | balanced immutable journal, maker-checker, reconciliation, accountant review |
| Tax threshold/rule drift | High | tax-year policy versions and authoritative update process; no hardcoded eternal threshold |
| Earnings/endorsement deception | Critical | substantiation, disclosure, monitoring, training, takedown, CCO/marketing review |
| Kai gains de facto authority | High | read-only tools, structured outputs, human approvals, audit, guard-pinned no-write boundary |
| Privacy-invasive presence/performance surveillance | High | opt-in coarse presence, no scoring use, minimization, retention, worker/privacy review |

## 19. Foundation implementation boundary

The first code slice may contain only:

- exact-string fail-closed feature flag;
- hard-false payout-execution sentinel with no environment override;
- two path identifiers and eleven distinct future revenue-stream identifiers;
- day-15 date-only schedule constant/parser;
- explicit non-qualifying recruiting, premature-referral, duplicate, popularity, and raw-activity signal identifiers;
- public type/barrel boundary;
- guard script proving dormancy and forbidden dependencies.

It must contain no schema, Prisma, database read/write, route, component, job, cron, Event Fabric registration, consumer, network call, billing/Stripe import, amount/rate/formula, provider, tax form, payout command, or modification to excluded surfaces.

## 20. Open owner decisions

Before any second implementation slice, Phase 0.5 requires the Founder to decide or explicitly delegate:

1. first shadow wedge (recommended: one invited Agency Builder cohort with one or two lawful dimensions);
2. economic nature, funding source, maximum cycle liability, reserve/solvency, no-cross-subsidy, and GCL value capture;
3. policy-governance RACI across Founder, CCO, Finance/Controller, Engineering, Integrity, and Appeals;
4. how verified active status matters without operator count/addition becoming an eligibility or allocation factor;
5. whether one-level affiliate attribution and any paid-access-versus-earned-eligibility rule are ratified;
6. whether the proposed previous-calendar-month qualification window is ratified;
7. weekend/holiday handling for the 15th;
8. which dimensions are eligible for the first pilot and their minimum evidence—not weights or payouts yet;
9. whether Kai’s global canonical title is amended; this foundation does not change it;
10. whether Growth Reputation remains the customer-facing name for the projection;
11. legal payor/payee, jurisdictions, participant classes, and worker relationships (specialist analysis required);
12. policy for appeal SLA, reviewer authority, support/review staffing, and operating budget;
13. retention periods for economic, integrity, Team Operations, and tax evidence;
14. shadow success/kill metrics and the permanent no-promotion rule from shadow records to live obligations;
15. whether the selected wedge needs additive Organization Event Fabric scope; Path B must not inherit that dependency without evidence.

Until those decisions and the roadmap gates pass, CGn remains dormant.
