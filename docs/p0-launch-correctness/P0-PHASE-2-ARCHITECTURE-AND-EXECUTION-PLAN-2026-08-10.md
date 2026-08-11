# CREDITVECTOR — P0 PHASE 2 ARCHITECTURE + EXECUTION PLAN

**Date:** August 10, 2026<br>
**Status:** DESIGN COMPLETE — IMPLEMENTATION NOT AUTHORIZED<br>
**P0 branch:** `codex/p0-launch-correctness`<br>
**Frozen baseline:** `4bbdf5c561f94a132962d27971551096b53528d9`<br>
**Phase 1 / 1.1:** COMPLETE; 515/515 PASS; open findings C0/H0/M0/L0<br>
**Trusted-writer semantic attestation:** **BOUNDED — mandatory pre-activation dependency**
**Production / M2 / commit / push / merge / deploy / activation:** **UNTOUCHED / NONE**

This document is a repository-backed design, not implementation authority. It connects the accepted Phase 1 truth foundation to a future consumer workflow while keeping every new path dormant by default. It does not authorize Phase 2A, a schema migration, a backfill, production access, or activation.

## 1. Executive architecture

Phase 2 should extend the existing Phase 1.1 truth graph, not create another report, score, letter, or outcome authority. The architecture separates four planes:

1. **Truth plane:** immutable `ReportVersion`, extraction coverage, bureau-specific observations, historical evidence, assessments, assertions, comparisons, correspondence versions, packets, artifacts, and authoritative typed domain records.
2. **Orchestration/audit plane:** durable idempotent operations that reserve work, record safe states, call adapters, read back persisted results, and never become business evidence themselves. `EvidenceEvent` is a same-transaction, rebuildable refs-only audit/index/notification projection—not a second domain-state authority.
3. **Experience plane:** the existing Upload, Identity, Strategy Desk, Letters, Mail Center, Score Tracker, Mission Control, and Kai shells repointed to evidence-backed read models as their waves activate.
4. **Adapter plane:** parser, encrypted storage, deterministic renderer, fulfillment, OCR/response interpretation, notifications, and Kai. Adapters receive narrow capabilities, not database or tenant authority.

```text
Authenticated actor + server-resolved tenant/consumer scope
                         |
                         v
Upload -> source Artifact -> ReportVersion -> ExtractionRun
                         |          |
                         |          +-> exact bureau coverage / facts / scores
                         v
Assessment -> Round 0 review -> ConsumerAssertion / Identity review
                         |
                         v
Action decision -> recipient-first CorrespondenceVersion -> Packet
                         |
                         v
deterministic render -> readback-verified canonical Artifact
                         |
                         v
Mailing / FulfillmentAttempt / evidence events -> Response artifact
                         |
                         v
ReportVersion N+1 -> evidence-backed comparison -> progress projection -> Kai
```

The governing rule is: **no transition accepts the prior call's success as truth**. It consumes an exact, tenant-bound, version-bound, readback-verified input. Unknown, incomplete, ambiguous, stale, or mismatched evidence stops the transition.

Architecture decisions fixed by this plan:

- Phase 1 entities remain the canonical credit-truth and correspondence backbone.
- New schema is additive and limited to operational gaps; legacy tables are never promoted by inference.
- Round numbers record chronology only; policy eligibility comes from an exact policy version and status.
- Preview, download, print, and fulfillment consume the same canonical bytes.
- `NO_LONGER_REPORTED` requires complete coverage plus an exact account-match decision; absence alone is never deletion.
- Kai is an evidence explanation/orchestration layer, never a truth, testimony, policy, or legal authority.
- The concrete authenticated repository writer remains a separately proven pre-activation dependency.

## 2. Repository delta assessment

The accepted tree already contains most domain foundations under `lib/creditTruth` and `prisma/schema.prisma`. Phase 2's main gap is operational wiring: authenticated orchestration, consumer review state, canonical delivery evidence, response association, and evidence-backed projections.

| Area | Repository truth | Delta conclusion |
|---|---|---|
| Report truth | `CreditTruthScope`, immutable `ReportVersion`, append-only `ExtractionRun`, coverage, observations, history, scores | Reuse; add an idempotent ingestion reservation and exact input-artifact binding |
| Parser | parser-v2 is `SHADOW_ONLY`; AI/regex v2 preserve bureau structure | Reuse behind a dormant orchestrator; never feed it flattened legacy bureau data |
| Assessment | deterministic bureau-specific assessment and clean-control protections exist | Reuse; expose only through attested repository reads |
| Round 0 | `IdentityBaseline` / `IdentityFact` exist; current UI uses transient AI discrepancies | Reuse schema core, replace inference authority, add append-only per-fact consumer review evidence |
| Consumer testimony | `ConsumerAssertion` pins exact report/run/bureau/field/observation/assessment | Reuse for account facts; add a specialized identity-fact confirmation path rather than weakening it |
| Correspondence | recipient, immutable CRA bureau, versions, items, packets, artifact membership exist | Reuse; add supplemental exact evidence roles and operational builders |
| Rendering | current print/download regenerates browser output | Replace authority with deterministic, content-addressed server rendering |
| Mail | provider-neutral interface exists; legacy store is user-scoped, mutable, self-healing | Harden interface; replace durable authority with tenant-bound mailing/event models |
| Responses | legacy route mutates a `Letter` with AI output | Replace authority with immutable response artifacts, exact association, quarantine, and provisional interpretation |
| Diff/progress | `ReportComparison`, `ReportDifference`, `DisputeOutcome`, and noncausal progress contracts exist | Reuse; add exact account-match decisions and repository orchestration/read models |
| Kai/tasks/notifications | useful presentation and event patterns exist | Harden as derived projections; never make them truth writers |

The legacy and P0 models will coexist during shadow operation. The transition is **not** dual authority: legacy remains consumer-visible until a later, explicit activation gate; P0 remains shadow/internal by wave. Mismatches become reconciliation evidence, never automatic backfill or repair.

Repository evidence anchoring those decisions:

- `prisma/schema.prisma:1209-2469` contains the accepted tenant scope, report truth, identity, assertion, correspondence, packet, artifact, comparison, and evidence graph.
- `app/api/reports/upload/route.ts:107-124` still creates and synchronously analyzes a legacy report; `app/api/reports/[id]/route.ts:7-18` directly deletes it, while `ReportVersion.sourceReport` uses restrictive deletion. Shadow activation must therefore include an explicit source-link/erasure design.
- `lib/parse.ts:165` demonstrates the legacy shared-value bureau fan-out; `lib/creditTruth/parserAiV2.ts:31` and `parserRegexV2.ts:384` require genuine bureau-scoped input.
- `app/api/identity/discrepancies/route.ts:125-140` currently invites AI-driven old-address/employment findings; it cannot be Round 0 authority.
- `app/api/letters/generate/route.ts` and browser print/download paths are mutable/regenerated; Phase 1 correspondence and `artifactStorage.ts` provide the replacement authority.
- `lib/mail/MailStore.ts:64-200` is a mutable user-scoped self-heal store; `MailProvider.ts` is reusable only after it accepts exact artifact/address capabilities.
- `app/api/letters/[id]/response/route.ts:62-92` mutates legacy outcome fields from AI output; `progressIntelligence.ts:1722-3050` already supplies the safe diff/noncausal foundation.
- `strategyPolicy.ts:504-522,1367-1693` supplies recipient/counsel checks, but no current policy is approved and its counsel-release mapping needs an explicit Phase 2 contract.

## 3. Existing surfaces: REUSE/HARDEN/REPLACE/DEFER

### What already exists

| Surface | Decision | Planned treatment |
|---|---|---|
| `CreditTruthScope` and composite tenant/consumer keys | **REUSE** | Mandatory scope at every repository boundary; authorize before decrypt/read |
| `ReportVersion`, extraction, coverage, observation, history, assessment, score models | **REUSE** | Canonical truth spine; append only |
| parser-v2 adapters and contracts | **REUSE** | Orchestrate from genuinely bureau-scoped input; remain shadow initially |
| `ConsumerAssertion` | **REUSE** | Exact account-field confirmation; never genericize into nullable polymorphism |
| `IdentityBaseline` / `IdentityFact` | **HARDEN** | Add explicit review decisions; do not overwrite reported identity facts |
| Upload UI and streamed progress envelope | **HARDEN** | Preserve UX; place a durable, idempotent orchestrator behind it |
| Score Tracker chart/manual form | **HARDEN** | Report-derived scores primary; manual entries secondary and labeled |
| Strategy Desk / Mission Control UI concepts | **HARDEN** | Consume one evidence projection; remove legacy probability/AI authority |
| campaign chronology/approval concepts | **HARDEN** | Map to `DisputeCase` and immutable correspondence lineage; no default bureau |
| recipient, address, `Correspondence`, version, item, `Packet` | **REUSE** | Recipient-first assembly and immutable versions |
| `artifactStorage` contract | **REUSE** | Add source/guide/delivery purposes as needed; concrete adapter remains activation-gated |
| browser print / regenerated package download | **REPLACE** | Serve exact stored canonical bytes |
| legacy `Letter` generation and mutable response outcome | **REPLACE** | P0 correspondence and response evidence become the only future authority |
| legacy `MailManifest` / self-healing `MailStore` | **REPLACE** | Migration-owned tenant-bound mailing and append-only events |
| `MailProvider` abstraction | **HARDEN** | Accept an authorized canonical-artifact grant and pinned address, never arbitrary bytes/URL |
| vendor-specific live fulfillment | **DEFER** | Core defines adapter contract only; no LetterStream or other vendor activation |
| `EvidenceEvent` | **REUSE** | PII-safe, rebuildable refs-only audit/index/notification projection; never domain-state or ingestion-work authority |
| legacy `ScoreEntry`, `VerifiedOutcome`, `Tradeline` | **DEFER migration** | Remain legacy; never infer P0 truth from lossy rows; deprecation is a later decision |
| Kai context and notification fabric | **HARDEN** | Evidence envelopes and non-authoritative reminders only |

Duplicate authorities to retire eventually—but not migrate automatically—are `Report/Tradeline` versus P0 truth, `ScoreEntry` versus `CreditScoreObservation`, transient identity AI versus `IdentityBaseline`, mutable `Letter` versus the correspondence graph, derived mail packages versus `Packet`, browser output versus `Artifact`, and `VerifiedOutcome` versus source-pinned differences/outcomes.

## 4. Domain/data model additions

The plan assumes **small additive migrations by wave**, because production-grade ingestion, mailing, responses, and identity review have durable states not represented by the Phase 1 truth graph. Names below are design names; implementation must validate them against Prisma/PostgreSQL conventions before any migration is written.

| Wave | Minimum addition | Authority and purpose |
|---|---|---|
| 2A | `ReportIngestion` | The sole durable ingestion work queue: exact scope/actor, idempotency key, reserved series/version, source digests, state, safe errors, revision, bounded attempt, lease/expiry, and next-attempt time. Workers claim it with CAS or `FOR UPDATE SKIP LOCKED`; notifications may project after commit but cannot schedule authoritative work. Never business evidence. |
| 2A | extraction input binding | Bind each `ExtractionRun` to the exact source/input artifact and digest consumed; distinguish original bytes from derived text. |
| 2A | identity review completion | Preserve `IdentityFact.classification` as the one canonical per-fact consumer disposition inside an immutable baseline version. Add only category-level completion evidence for an empty/`NOT_APPLICABLE` category; it cannot carry an alternate fact classification. |
| 2A | `IdentityCorrespondenceAssertion` | Specialized claim receipt with no competing disposition. It pins the selected classified `IdentityFact`, baseline, bureau/source/integrity, actor, and exact correspondence purpose. It must not weaken account `ConsumerAssertion`. |
| 2A | `CaseActionDecision` | Append-only proposed/selected/declined/wait/review action with a closed action code, exact source/assertion set, chronology round, actor and supersession. It records consumer selection only; it cannot evaluate or confer policy eligibility. |
| 2A | `P0SensitiveAccessEvent` | Migration-owned, refs-only record for decrypt/download/export/agency/admin/worker access decisions: real actor, effective tenant/consumer, purpose, result, exact resource type/id/version. Never business evidence or free text. |
| 2B | `CorrespondenceItemEvidence` | Closed-role membership for exact creditor/furnisher, masked account reference, disputed field, historical support, and requested-action support, all from the same scope/report/run/account/bureau. No copied plaintext. |
| 2B | `PolicyEvaluationReceipt` + action/identity item binding | Evaluate exact policy/counsel disposition/runtime eligibility/restrictions in 2B. Every account or identity item has a composite FK to one exact `CONSUMER_SELECTED` action decision and its eligible policy receipt. Identity items also pin `IdentityCorrespondenceAssertion`; never fake an `Account` or make account-item FKs nullable. |
| 2B | `PacketSenderIdentityFact` | Immutable packet membership for selected legal-name and return-address facts: exact baseline ID/version, fact ID, role, classification/integrity, ordinal, and sender-manifest digest. That digest is pinned through Packet, Artifact, Mailing, approval, and fulfillment. |
| 2B | artifact kinds | Add only `PACKET_GUIDE_PDF` and later proof/receipt kinds actually required by a wave. |
| 2C | `Mailing` | Immutable identity: scope/case/packet/canonical artifact/version/digest, exact `senderManifestSha256`, recipient/address, channel, and idempotency. |
| 2C | `MailingEvent` | Sole semantic authority for mail transitions: append-only prior event, from/to state, source/actor, occurrence/record time, exact artifact approval/proof, integrity, safe failure code. Current state is event-derived or CAS-cached and rebuildable. |
| 2C | `FulfillmentAttempt` | Adapter-neutral, bounded attempt, exact mailing/artifact/address, idempotency/correlation, encrypted external refs, request/response digests, callback verification, unknown outcome. |
| 2C | `MailingArtifact` | Typed exact associations to fulfillment receipt, certified-mail evidence, tracking, delivery, and return receipt. |
| 2D | `ResponseRecord` | Immutable `RESPONSE` artifact tied to exact mailing, recipient, packet, and correspondence version set; association state only. |
| 2D | `ResponseAssociation` / `ResponseFinding` | Exact item/account/bureau/report/round links and provisional model/rule interpretations with uncertainty and human review. Never a legal conclusion. |
| 2D | `AccountMatchDecision` | Exact prior/current report/run/bureau membership, rule/version/source-set, `MATCHED | NO_MATCH | AMBIGUOUS`, optional consumer review, immutable digest. |
| 2E | none initially | Build read projections over existing scores/comparisons/differences/outcomes; add indexes/materialized projections only after measurements and a separate review. |

Every authoritative addition repeats `tenantId` and `consumerId`, joins through composite keys, uses closed enums/checks, and is append-only unless it is explicitly an orchestration projection with CAS. No source plaintext, full account number, email, address, response text, or report content belongs in an index, event payload, analytics property, or log.

`IdentityFact.classification` is the single identity-disposition authority: `CORRECT_CURRENT/CORRECT_FORMER` project as confirmed, `INCORRECT/NEVER_MINE/OUTDATED_UPDATE_REQUESTED` as disputed, and `REVIEW_NEEDED` as unknown/reported pending review. `NOT_APPLICABLE` exists only as category-completion evidence when there is no reported fact to classify. The identity correspondence assertion attests use of that exact disposition; it cannot disagree with or replace it.

`MailingEvent` is the sole mail-state authority. `EvidenceEvent` is emitted in the same transaction as a refs-only audit/index/outbox projection and is fully rebuildable; it cannot independently advance a mailing. Likewise, `P0SensitiveAccessEvent` records access decisions but never establishes source truth or lifecycle state.

## 5. State machines

### Ingestion

```text
RECEIVED
  -> SOURCE_STORED_AND_VERIFIED
  -> VERSION_COMMITTED
  -> EXTRACTING
  -> SUCCEEDED | PARTIAL | FAILED
  -> ASSESSED
  -> ROUND0_READY

Any ambiguous write/readback -> OUTCOME_UNKNOWN / QUARANTINED
```

Object-storage success does not mean the `ReportVersion` exists; DB success does not mean source bytes are correct. Reserve the idempotency key, write, read back, verify exact bytes/digest/scope, then commit the next state. Retries reuse the same operation identity. Orphan objects are tombstoned by a separately evidenced cleanup flow; they are never silently adopted.

### Round 0 and consumer confirmation

```text
IdentityFact in DRAFT baseline: REPORTED/REVIEW_NEEDED
classified fact:               CONFIRMED | DISPUTED | UNKNOWN
empty category completion:     NOT_APPLICABLE (no fact row to contradict)
baseline:                      DRAFT -> CONFIRMED -> SUPERSEDED
claim receipt:                 REVIEWED -> APPENDED -> SUPERSEDED/REVOKED
```

`NOT_APPLICABLE` is allowed only for an explicit category slot, not to erase a reported fact. Accurate former addresses and legitimate employment can be `CONFIRMED`; unfamiliar data stays `UNKNOWN` until the consumer decides.

### Action, correspondence, packet, and artifact

```text
Action: PROPOSED -> CONSUMER_SELECTED | DECLINED | WAITING | BLOCKED
Correspondence: DRAFT -> READY_FOR_REVIEW -> APPROVED | VOID
Packet: DRAFT -> APPROVED -> SUPERSEDED | VOID
Artifact: BUILDING -> STORED -> READBACK_VERIFIED -> RELEASABLE
```

Edits append a correspondence version and canonical artifact. An approval never mutates previously approved bytes. Policy eligibility is evaluated at each build against an exact immutable policy version.

### Mailing and response

```text
Packet/content approval -> canonical artifact build/readback
-> consumer approves exact artifact ID/version/digest + packet/recipient/sender tuple
-> READY_TO_MAIL

SELF_MAIL:   READY_TO_MAIL -> CONSUMER_ATTESTED_SENT -> TRACKING? -> DELIVERED?
FULFILLMENT: READY_TO_MAIL -> SUBMISSION_PENDING -> ACCEPTED_BY_FULFILLMENT
             -> MAILED/SENT -> TRACKING -> DELIVERED

Either channel: DELIVERED/recorded response -> RESPONSE_RECEIVED
                -> RESOLVED | FOLLOW_UP
```

Self-mail marks fulfillment-only states `NOT_APPLICABLE`; the consumer provides bounded evidence for `CONSUMER_ATTESTED_SENT` and later events. Provider acceptance is not mailing, carrier acceptance, tracking, or delivery. Immediately before a fulfillment dispatch, the server reattests the exact artifact, packet manifest, selected sender identity facts, recipient address, consumer approval, and actor. An API response is not proof of final state. Ambiguous provider outcomes stay `OUTCOME_UNKNOWN` until retrieved and reconciled.

```text
Response: RECEIVED -> ARTIFACT_VERIFIED
                   -> EXACTLY_ASSOCIATED | NEEDS_REVIEW
                   -> PROVISIONALLY_INTERPRETED
                   -> CONSUMER_REVIEWED
```

Machine interpretation cannot directly create a `DisputeOutcome`, a factual assertion, or a next-round legal entitlement.

## 6. Trust boundaries

Every request resolves one server-owned principal:

```text
actorId + tenantId + consumerId + authorizationKind + authorizationVersion
```

- `actorId` is the real authenticated account.
- A direct consumer has `tenantId == consumerId`.
- An agency has a distinct tenant and selected consumer; the managed-client grant is revalidated on every request and job.
- Request IDs, cookies, model output, provider refs, tracking numbers, and signed URLs are selectors, never authority.
- Authorize before lookup/decrypt. Repository APIs accept the full scope and exact purpose; no bare-ID read or mutation is permitted.
- Encryption AAD binds scope, entity ID/version, artifact purpose, and schema/key version.
- Parser, renderer, Kai, and fulfillment adapters have no general database credential and cannot select a tenant.
- External callbacks are signature- and timestamp-verified before parsing, replay-protected, then joined by internal correlation to an exact attempt and mailing.
- Every cross-boundary success uses write -> authoritative readback -> exact semantic verification.
- Decrypt, preview, download, export, privileged/agency access, and worker use append a refs-only access decision with real actor, effective scope, purpose, exact resource version, and allow/deny result.

The current session layer must be adapted before activation so it does not collapse actor, agency tenant, and effective consumer into one implicit identity.

## 7. Round 0 architecture

Round 0 is a structured review of source-reported identity/file-integrity facts, not an AI-generated dispute list.

| Category | Source representation | Consumer state | Safety rule |
|---|---|---|---|
| Legal name / aliases | bureau-specific `IdentityFact` and locator | reported/confirmed/disputed/unknown | alias is not inaccurate merely because it differs from current name |
| Current/former address | exact reported fact with bureau | confirmed current/confirmed former/disputed/unknown | never auto-dispute an accurate former address |
| Safe identity fields | encrypted fact; masked display | confirmed/disputed/unknown | never display or log full sensitive identifier |
| Phone | add explicit fact type only if actually reported | confirmed/disputed/unknown/N/A slot | absence is not an inaccurate phone |
| Employment | exact bureau/source fact | confirmed legitimate/disputed/unknown | never auto-dispute legitimate or old employment |
| Mixed-file indicator | typed signal plus exact support | review/confirmed concern/unknown | a machine flag is not consumer testimony |
| Unrecognized account | account observation plus consumer decision | not mine/review needed/confirmed accurate | unfamiliar does not automatically mean fraudulent |

Flow:

1. Build a draft baseline only from exact report evidence and explicit missing/unknown states.
2. Display bureau, field, source context, uncertainty, and safe masked value.
3. Append a new baseline version containing the one canonical `IdentityFact.classification` for each reviewed fact; category-completion evidence is separate and may express `NOT_APPLICABLE` only when no fact exists.
4. Require the consumer to review every required category before confirming a baseline.
5. Freeze a confirmed baseline version and its input-set digest; later reports create/supersede versions.
6. Build identity correspondence only from exact identity assertions, recipient/bureau authority, and approved policy—not directly from machine findings.

## 8. Consumer confirmation architecture

The confirmation boundary is explicit and two-tiered:

- **Account facts:** reuse `ConsumerAssertion`, which pins exact report, extraction, account, bureau, field, observation series/revision/digest, and assessment.
- **Identity facts:** `IdentityFact.classification` inside an immutable baseline version is the sole disposition. A separate immutable correspondence claim receipt may pin that exact classified fact/bureau/source/integrity for a specified purpose, but carries no alternate disposition. Do not weaken account assertions or fabricate an account row.

```text
System observation (may be uncertain)
        -> consumer sees source context and safe value
        -> consumer chooses a bounded disposition
        -> server re-reads exact immutable source set
        -> append account assertion or identity claim receipt + readback + attestation
        -> downstream builders receive only assertion IDs + exact bindings
```

Required UX/runtime properties:

- neutral language; no leading default or inferred testimony;
- a clear distinction between system observation and consumer statement;
- consumer can decline, defer, revoke, or supersede;
- new report, observation revision, evidence digest, bureau, or field mismatch requires reconfirmation;
- encrypted optional explanation is not used as an indexed key or fed to another recipient without explicit authority;
- the builder fails closed on stale, missing, revoked, cross-tenant, cross-bureau, or cross-field assertions;
- client state never supplies the authoritative assertion/evidence graph.

## 9. Correspondence compatibility model

Recipient-first consolidation uses the following equality key:

```text
tenant + consumer + case + recipient + recipientType
+ recipientAddressVersion + CRA bureau authority
+ chronology round + exact policyVersion/status
+ normalized restrictionCompatibilityKey/restrictionManifestSha256
+ claimClass + compatible enclosure policy
+ confirmed identityBaseline + senderManifestSha256
```

Every item then proves its exact assertion, disputed field, observation, assessment, evidence roles, creditor/furnisher, masked account reference, requested action, and bureau. It also has a composite binding to one exact `CONSUMER_SELECTED` `CaseActionDecision` and its eligible 2B `PolicyEvaluationReceipt`; the requested action is a closed code, not free-form `claimType` authority. Restricted items consolidate only when their normalized restriction compatibility key/digest is identical; incompatible jurisdiction, timing, disclosure, separation, or enclosure requirements force separate packets or denial.

| Recipient class | Consolidation rule |
|---|---|
| CRA | One packet per exact CRA/bureau/round/policy/claim/enclosure key; every item bureau equals immutable recipient bureau |
| Furnisher | Same exact furnisher recipient and address; item bureau provenance remains intact; never combine another furnisher |
| Collector | Same exact collector and compatible claim class; never combine furnisher/CRA/goodwill/C&D/regulator content |
| Goodwill | Separate claim class and template/policy; never mixed with factual disputes |
| Cease/desist | Separate restricted policy and consumer confirmation; never inferred from round number |
| Regulator | Separate recipient/policy/evidence package; no automatic submission or threat language |

Compatibility is a whitelist, not “same user plus same round.” Any unknown recipient class, address status, counsel status, bureau, assertion, source context, or enclosure compatibility yields `NOT_READY`.

A follow-up or Round 2 item additionally pins its parent correspondence/version, exact delivery/response evidence or elapsed-window rule, current assertion set, a fresh policy evaluation, and explicit follow-up selection. Chronology alone cannot create eligibility.

## 10. Canonical artifact architecture

The canonical correspondence artifact is one immutable PDF whose exact bytes are used everywhere. Sender identity is not a current-profile lookup: packet membership selects the exact confirmed legal-name and return-address `IdentityFact` IDs/roles from the pinned baseline, seals their classification/integrity/order into `senderManifestSha256`, and carries that digest through artifact, approval, mailing, and fulfillment.

```text
approved CorrespondenceVersion set + Packet manifest
 + pinned recipient/address/baseline/policy/restrictions/template/fonts/assets
 + exact sender fact membership + senderManifestSha256
 -> deterministic no-network renderer
 -> bytes + sha256 + byte/page counts
 -> encrypted object write
 -> independent readback and exact verification
 -> immutable Artifact + membership
 -> short-lived purpose-specific access grant
```

Preview, download, print, and future fulfillment read the same artifact ID/version/digest. They do not regenerate content. The renderer has no network access, no tenant selector, and no current-profile lookup after the manifest is frozen.

The mailed artifact must not contain a browser URL, browser timestamp, browser title, CreditVector educational footer, UI instructions, or dynamic profile substitutions. Mailing instructions are rendered as a separate `PACKET_GUIDE_PDF` titled prominently **DO NOT MAIL THIS PAGE** and are excluded from the fulfillment payload.

Any body, membership, order, sender fact/role, recipient, address, baseline, policy/restriction, template, asset, font, renderer, byte, digest, or readback mismatch produces a typed integrity failure. It can never be interpreted as “artifact absent” or a successful preview.

## 11. Mail Center / Evidence Ledger

The Mail Center becomes a projection of immutable packet, artifact, mailing, and evidence records. It is not a mutable package generator.

`MailingEvent` is the sole semantic state history. The latest state is derived from its validated chain (or a CAS cache that can be rebuilt). `EvidenceEvent` is a same-transaction, refs-only audit/index/outbox projection and cannot independently advance the lifecycle. Every preview/download/export/decrypt and agency/admin/worker access also appends a scoped `P0SensitiveAccessEvent` without consumer values.

### Self-mail

- The consumer explicitly approves the exact artifact ID/version/digest, packet manifest, sender identity selection, recipient/address, and chooses `SELF_MAIL`.
- `CONSUMER_ATTESTED_SENT` requires a bounded consumer attestation tied to that exact tuple and time; it is not inferred from approval, download, or print.
- Certified-mail number, receipt, tracking, delivery, and return-receipt evidence are appended as encrypted artifacts and typed events.
- Missing evidence remains missing/unknown. The UI says what is recorded, not what probably occurred.

### Future CreditVector Fulfillment

- The service creates a `FulfillmentAttempt` only from an authorized `Mailing`, final consumer approval of the exact tuple, and a purpose-bound canonical-artifact capability. It reattests that tuple immediately before dispatch.
- The adapter receives exact bytes, pinned address, mailing correlation, and idempotency; never a public URL or caller-selected storage/provider locator.
- Create response and later retrieval/callback are verified against exact attempt/mailing/artifact/address and stored as append-only evidence.
- Provider accepted, mailed, carrier tracked, and delivered are separate states.
- An unknown outcome blocks a second send until exact retrieval/reconciliation proves whether the original attempt exists.

The core domain remains vendor-neutral. LetterStream or any future vendor implements the same adapter contract; no provider-specific statuses, IDs, webhooks, or limits leak into `Mailing` state semantics.

Once `CONSUMER_ATTESTED_SENT` or provider `SUBMISSION_PENDING` occurs, the packet, correspondence versions, sender identity selection, recipient address version, canonical artifact, and member ordering are immutable. A correction creates a new version/mailing and links the prior record; it never edits sent evidence.

## 12. Response Intelligence

Incoming responses enter through an immutable evidence pipeline:

1. authorize actor and exact tenant/consumer before upload;
2. store encrypted response bytes and verify readback;
3. associate to exact mailing, recipient, packet, correspondence-version set, report version, round, and delivery evidence;
4. link each relevant response finding to an exact correspondence item/account/bureau;
5. quarantine unmatched or ambiguous evidence;
6. record machine interpretation as provisional, versioned, uncertainty-preserving evidence;
7. require human/consumer review where a finding would drive testimony, outcome, or a new action.

Association precedence is internal barcode/correlation token, verified provider reference tied to a mailing, then consumer-assisted selection. Recipient name, tracking number, filename, OCR text, or model guess alone cannot authorize an association. One response may relate to multiple items only through explicit membership rows; one item may receive multiple responses without overwriting history.

Kai may explain: “The response says the bureau verified the account, but the extracted explanation has low confidence.” Kai may not declare legal compliance, a statutory violation, deletion, or a next-round entitlement. A `DisputeOutcome` is derived only from exact response evidence plus a later report comparison or bounded human confirmation, with `NO_CAUSAL_CLAIM` unless a future separately approved causal method exists.

## 13. ReportVersion diff semantics

The existing `ReportComparison` / `ReportDifference` model remains authoritative. Add an immutable `AccountMatchDecision` before any account-level N→N+1 comparison so account identity is never guessed from a low-entropy name, balance, or account fragment.

| API/product outcome | Required evidence |
|---|---|
| `CONFIRMED_CHANGE` | exact matched subject, comparable source versions/runs, both exact observations, complete enough evidence, changed value/meaning |
| `NO_LONGER_REPORTED` | prior source-listed account, exact `MATCHED` identity context, later bureau covered, later account index complete, current `ABSENT_CONFIRMED` |
| `UNCHANGED` | comparable exact prior/current facts with equivalent normalized meaning |
| `NEW` | current source-listed subject plus complete prior coverage and an exact `NO_MATCH`; ambiguity is not new |
| `UNCERTAIN` | parser uncertainty, partial coverage, ambiguous account match, stale/missing source, contradictory evidence, or incomplete response |
| `NOT_COMPARABLE` | chronology not established, bureau outside coverage, incompatible score models, missing required versions, or unsupported field mapping |

Required comparison categories include score, account presence, status, balance, payment history, remarks, dispute notation, bureau coverage, identity facts, new adverse evidence, corrections, and unchanged disputed fields. Comparison outputs preserve both sources and never overwrite either report.

Deletion law:

```text
absence without complete coverage           -> UNCERTAIN
parser failed/partial or item not extracted -> UNCERTAIN
account identity ambiguous                  -> NOT_COMPARABLE
complete later account index + exact absent -> NO_LONGER_REPORTED
```

No comparison may encode “letter caused score change” or “deletion caused increase.” Chronology and correlation are allowed; causality is not.

## 14. Progress Intelligence

The existing progress contract becomes the shared read-model source for Score Tracker, Strategy Desk, Mission Control, notifications, and Kai.

### Evidence hierarchy

1. Report-derived score with exact bureau/model/report/date provenance.
2. Manual score as explicitly secondary, unverified context.
3. No score row or `SCORE_NOT_PROVIDED` when the source has none—never an invented number.

Views should expose:

- overall and bureau-specific score trajectories, separated by compatible score model/scale;
- accounts changed, corrected, unchanged, new, or no longer reported;
- unresolved assertions/disputes and evidence gaps;
- balance/status/remarks/dispute-notation movement;
- correspondence, delivery, and response status;
- parser/model uncertainty and not-comparable intervals.

Allowed narrative: “Your Experian score increased 18 points between these two comparable report observations.” Allowed narrative: “The account is no longer reported on the later Experian report.” Prohibited narrative: “Deleting that account caused the score to increase.”

No new authoritative progress table is planned initially. Cache/materialized projections, if later justified by measurements, must be disposable and reproducible from exact source IDs/digests.

## 15. Kai boundary

Kai receives a tenant-scoped, server-built evidence envelope containing only:

- exact internal evidence references and bounded display facts;
- provenance, completeness, uncertainty, and comparison state;
- current assertion/review state;
- exact policy status and allowed next-step verbs;
- no storage credential, raw report, hidden cross-tenant context, or mutation capability.

Kai can explain, summarize, compare, teach, surface uncertainty, suggest the next review screen, and guide the consumer through an explicit confirmation. Kai cannot invent a fact, submit an assertion, approve a baseline, choose a dispute action, select a recipient, approve a packet, send mail, create an outcome, convert correlation to causation, override counsel, or invoke an unapproved policy.

All Kai outputs are non-authoritative presentation. Any proposed action is revalidated server-side against the current source set, assertion state, policy version/status, tenant scope, and feature gates. Free-form Kai logs/events are never P0 evidence.

## 16. Tenant isolation/privacy threat model

| Attack | Required defense | Fail-closed result |
|---|---|---|
| Cross-user / cross-organization report access | server-resolved principal; composite tenant+consumer query; revalidate managed-client grant | 404/denial before decrypt |
| Artifact ID guessing | no public locator; short-lived purpose-bound capability; scope + version + digest readback | denial; no existence leak |
| Report-version substitution | exact report/run/artifact/source digest chain and repository attestation | integrity failure/quarantine |
| Cross-bureau substitution | bureau repeated in coverage, observation, assertion, recipient, item, response, comparison pins | `NOT_READY` / invalid association |
| ConsumerAssertion replay | exact report/run/bureau/field/revision/digest; supersession/revocation/current checks | reconfirmation required |
| Stale report use | current-case source-set and explicit comparison chronology | stale evidence denial |
| Correspondence/recipient substitution | immutable recipient/bureau/address/version and packet compatibility key | build/release denied |
| Response misassociation | exact mailing/packet/version/item association; quarantine ambiguity | `NEEDS_REVIEW` |
| Fulfillment callback spoof/replay | signature, timestamp, replay key, internal correlation, exact attempt readback | reject before state change |
| Tracking-number substitution | encrypted provider ref/tracking as evidence only, never authority | no transition |
| IDOR in jobs/queues | job contains opaque operation ID; worker re-resolves scope and capability | job denied/quarantined |
| Cached artifact leakage | tenant/purpose keyed cache or no shared cache; private/no-store response | purge and incident path |
| Signed URL leakage | prefer streamed capability; otherwise short expiry, single purpose, no analytics/referrer | revoke/expire; never reuse |
| Report data in logs/analytics | allowlisted codes/counts/opaque refs; payload and error sanitizers; PII scans | event dropped/redacted |
| Parser/model prompt leakage | minimized, scoped inputs; no cross-user retrieval; provider retention controls | run fails without truth write |
| Direct trusted-writer bypass | module/repository ownership, code scan, deployment attestation, write-readback verification | activation readiness false |
| Resource exhaustion/polyglot source | magic+MIME agreement, encrypted/polyglot rejection, byte/page/decompression/time/memory limits, quotas, bounded concurrency and backpressure | reject before authoritative parsing/write |
| Sensitive-access invisibility | migration-owned refs-only access audit for every decrypt/download/export/privileged/worker decision | access denied or audit-write failure; no data release |

Privacy design also requires retention, erasure/crypto-shred, legal-hold, backup, and export policies before activation. `ArtifactTombstone` preserves evidence of erasure without retaining public object access. Production telemetry must never contain decrypted observations, consumer testimony, addresses, response text, raw provider errors, or source report snippets.

## 17. Phase 2A–2E execution waves

Each wave is a separate build-only checkpoint and Founder gate. Exact test counts are reported after implementation; this plan does not invent them. A downstream flag cannot operate unless all upstream readiness predicates pass.

### 2A — ingestion + Round 0 + confirmation runtime

- **Objective:** implement the authenticated repository boundary, idempotent/recoverable source ingestion, parser-v2 shadow persistence, canonical Round 0 classification, identity claim receipts, account `ConsumerAssertion`, consumer action decisions, and sensitive-access audit foundation. Policy evaluation begins only in 2B.
- **Repository surfaces:** existing Upload/API envelope, parser-v2 files, `consumerAssertion.ts`, Phase 1 truth models, new orchestration/repository services, Identity UI shell.
- **Schema/migration:** additive leased `ReportIngestion` as the sole durable DB queue (CAS or `FOR UPDATE SKIP LOCKED`; no scheduling outbox), exact extraction input-artifact binding, identity category-completion evidence, `IdentityCorrespondenceAssertion`, `CaseActionDecision`, `P0SensitiveAccessEvent`, and explicit identity fact types where required. Notification projections may follow committed transitions but cannot schedule work.
- **Flags:** master, shadow ingestion, Round 0 review, assertion runtime; absent/default false; server-cohort only.
- **Tests:** parser constitutional set; source write/readback; lease expiry/crash-before-enqueue/redelivery/idempotency; partial/unknown; score/no-score; actor/tenant/consumer/bureau substitution; canonical Round 0 mapping; assertion staleness/replay; 40P01/unknown outcome; delete/retention/erasure; access-audit enforcement; file/resource limits; PII/log scans.
- **Adversarial tests:** flattened input, cross-bureau fan-out, forged/stale adapter attestation, duplicate version reservation, stale worker lease, source/object substitution, legacy delete versus restrictive link, hidden P0 retention, former-address/employment auto-dispute, competing identity disposition, AI testimony, direct writer/audit bypass.
- **Dependencies:** frozen Phase 1.1; explicit runtime principal; encryption/AAD; retention/erasure policy; trusted-writer adapter implementation and local attestation for build completion. Production activation remains separately blocked.
- **Acceptance:** local/synthetic and any later separately approved shadow cohort can produce readback-verified `SHADOW_V2` truth; legacy upload response is unchanged; consumer deletion remains predictable through a scoped idempotent erasure/crypto-shred/tombstone operation; no hidden source artifact survives contrary to policy; one identity classification authority and exact assertion/action chains pass; all negative paths fail closed.
- **Founder gate:** accept a local 2A checkpoint. Production migration, shadow enablement, and consumer cohort are three later, separate decisions.
- **Rollback/disable:** flags off; retain immutable rows; no down migration or deletion; legacy remains authoritative.

### 2B — action selection + recipient-first correspondence + canonical artifact

- **Objective:** turn current assertions and approved policy decisions into recipient-first versions/packets and one deterministic canonical artifact plus separate packet guide.
- **Repository surfaces:** `strategyPolicy.ts`, correspondence/packet/artifact models, `artifactStorage.ts`, deterministic renderer, Letters/Strategy UI shells.
- **Schema/migration:** `PolicyEvaluationReceipt`, supplemental `CorrespondenceItemEvidence`, typed identity correspondence membership, `PacketSenderIdentityFact`, composite item-to-selected-action/eligible-policy-receipt binding, restriction compatibility digest, closed requested-action codes, minimal artifact-kind additions.
- **Flags:** correspondence preview and canonical artifact preview; no mail/fulfillment capability.
- **Tests:** full compatibility tuple including restriction/sender manifests, exact creditor/masked-ref evidence, assertion/provenance/action/policy pins, follow-up prerequisites, CRA bureau routing, incompatible class/restriction rejection, counsel mapping, deterministic bytes, preview/download/print equality, tamper/readback/grant failures.
- **Adversarial tests:** recipient retarget, mixed CRA/furnisher/collector packet, incompatible restricted items, wrong legal-name/former return-address substitution, unselected/free-form action, chronology-only Round 2, fake account for identity item, stripped/stale evidence, remote asset drift, legacy letter/mail route invocation.
- **Dependencies:** accepted 2A exact source/confirmation; approved policy versions/templates; renderer and storage security review.
- **Acceptance:** every factual clause traces to exact assertion and evidence; one recipient-compatible packet; exact bytes are stored/readback-verified; no send/provider call exists.
- **Founder gate:** approve templates/policies and a preview-only checkpoint/cohort separately.
- **Rollback/disable:** disable preview/build flags; immutable drafts/artifacts retained but inaccessible; no destructive rollback.

### 2C — Mail Center / Evidence Ledger + fulfillment boundary

- **Objective:** implement self-mail evidence and a vendor-neutral fulfillment contract without enabling a live vendor.
- **Repository surfaces:** Mail Center shell, `MailProvider` concepts, `EvidenceEvent`, artifact grants, new mailing/attempt services.
- **Schema/migration:** `Mailing`, `MailingEvent`, `FulfillmentAttempt`, `MailingArtifact`, proof artifact kinds and event subjects/types.
- **Flags:** mail ledger; fulfillment adapter contract test flag; live fulfillment remains separately absent/off.
- **Tests:** separate self-mail/fulfillment transitions, exact final artifact/sender/recipient approval, dispatch-time reattestation, event-derived projection, sent immutability, idempotent create/retrieve, pending/unknown outcomes, callback signature/replay, tracking/delivery substitution, multi-tenant IDOR and access audit.
- **Adversarial tests:** provider response spoof, arbitrary PDF/URL, approval-before-final-artifact, duplicate send after timeout, cross-mailing callback, signed URL leakage, mutable sent content, `EvidenceEvent` used to bypass `MailingEvent`, provider status overclaim.
- **Dependencies:** exact 2B canonical artifact; retention policy; fulfillment security/compliance review; vendor due diligence only before a future adapter activation.
- **Acceptance:** Mail Center truth is a projection of immutable evidence; no state is inferred; test adapter proves the boundary; production provider is not wired.
- **Founder gate:** accept evidence-ledger checkpoint; any live vendor selection/configuration/activation is a distinct later authorization.
- **Rollback/disable:** stop new transitions/attempts; preserve evidence; reconcile unknown attempts before any retry; no content rollback.

### 2D — response ingestion + report-version diff

- **Objective:** ingest immutable responses, associate or quarantine them, produce provisional findings, and compare exact ReportVersion N/N+1 evidence.
- **Repository surfaces:** response upload shell, artifact storage, existing comparisons/differences/outcomes, progress contract.
- **Schema/migration:** `ResponseRecord`, `ResponseAssociation`, `ResponseFinding`, `AccountMatchDecision`, response/evidence enums.
- **Flags:** response intake, internal response interpretation, report diff; interpretation does not imply action.
- **Tests:** exact and ambiguous association, OCR/parser uncertainty, account matching, complete/incomplete coverage, all diff states, unchanged disputed fields, false-deletion controls, response substitution, cross-tenant/bureau/item/round replay.
- **Adversarial tests:** filename/tracking/model-based authority, response-to-wrong-packet, ambiguous account forced matched, partial report marked deleted/new, AI legal conclusion, response-driven automatic Round 2.
- **Dependencies:** 2C mailing identity/evidence; later immutable report version; matching policy; human review workflow.
- **Acceptance:** ambiguity quarantines; absence never deletion; response model output remains provisional; comparisons and outcomes have exact sources and no unsupported causality.
- **Founder gate:** approve matching/diff thresholds and a read-only comparison cohort.
- **Rollback/disable:** stop new response interpretations/comparisons; retain immutable evidence; projections disappear; no source mutation.

### 2E — score/outcome Progress Intelligence + Kai explanation layer

- **Objective:** repoint Score Tracker, Strategy Desk, Mission Control, reminders, and Kai to one evidence-backed, noncausal projection.
- **Repository surfaces:** `progressIntelligence.ts`, score UI, Strategy/Mission/Kai/notification shells, new read APIs.
- **Schema/migration:** none initially; indexes or materialized views only after measured need and separate review.
- **Flags:** progress read, each UI consumer, and Kai evidence explanations independently gated.
- **Tests:** score source/model provenance, no-score, manual-secondary, all account/outcome states, unresolved issues, causality-language denial, stale projection, policy/counsel boundary, cross-tenant context.
- **Adversarial tests:** score-model mixing, manual-as-primary, correlation-to-causation prompt, hidden uncertainty, Kai assertion/action/send bypass, notification PII leakage.
- **Dependencies:** accepted 2D comparisons/outcomes; evidence-envelope contract; copy/compliance review.
- **Acceptance:** all surfaces tell the same source-linked story; Kai only explains/links to review; no source or action mutation from a read projection.
- **Founder gate:** authorize each consumer-facing surface/cohort separately after shadow parity and compliance review.
- **Rollback/disable:** disable affected read/Kai flag and return to existing UI; immutable evidence remains untouched.

### Worktree and ownership plan

```text
Wave contract + schema/migration lane (one writer; serial)
              |
              +-> repository/domain service lane
              +-> adapter/pure-contract lane
              +-> UI/read-model lane (after API contract freezes)
              +-> independent test/red-team lane (read-only until fixtures assigned)
              |
              v
integrated exact-source reattack -> Founder checkpoint -> STOP
```

No two lanes edit a shared contract file. Schema/migration ownership remains singular. Any new schema need outside the wave manifest pauses downstream work for Founder review rather than being absorbed.

## 18. Migration strategy

- One additive, reviewable migration per wave; do not bundle 2A–2D into one irreversible migration.
- No rename/drop/destructive rewrite, `db push`, runtime self-heal DDL, production backfill, or legacy-to-P0 fact inference.
- New required fields enter with fail-closed safe defaults or are populated only on new rows; an old row is not upgraded to evidence by deployment. New P0 uploads bind directly to source artifacts rather than depending on the deletable legacy `Report` FK; `sourceReportId` remains optional legacy provenance.
- Composite scope/FK constraints, exact membership constraints, idempotency uniqueness, append-only triggers, CAS for mutable orchestration projections, and closed enum/check semantics are mandatory.
- Each migration has exact static guard, disposable PostgreSQL apply/no-op/redeploy/rollback/rebuild verification, old-runtime compatibility where applicable, sole-DB-queue lease/idempotency and concurrency/40P01 cases, Prisma parity, and teardown evidence.
- If a controlled backfill is later needed, it receives a separate plan and Founder authorization. It may create `LEGACY_UNVERIFIED` references only; it cannot manufacture bureau facts, coverage, scores, dates, assertions, account matches, deletion, or authority.
- Production migration remains unauthorized by this plan.

Expected migration shape: 2A substantive additive migration including source-link/erasure and refs-only access audit; 2B small evidence/action-membership migration; 2C operational mail/evidence migration; 2D response/matching migration; 2E no schema unless measurement proves a justified index/projection.

## 19. Feature-flag strategy

All flags are exact server-side booleans, absent by default, and subordinate to a root kill switch plus a server-resolved tenant/consumer cohort. No client/query/body value may enable a feature.

| Flag | Allows | Does not allow |
|---|---|---|
| `P0_PHASE2_ENABLED` | evaluation of downstream gates | any behavior by itself |
| `P0_INGESTION_SHADOW_ENABLED` | new-upload shadow v2 orchestration | consumer authority/backfill |
| `P0_ROUND0_REVIEW_ENABLED` | bounded review UI/API | correspondence |
| `P0_ASSERTION_RUNTIME_ENABLED` | exact consumer confirmation | automatic action |
| `P0_CORRESPONDENCE_PREVIEW_ENABLED` | draft/version/packet preview | approval/send |
| `P0_CANONICAL_ARTIFACT_ENABLED` | deterministic build and exact read | mail/provider |
| `P0_MAIL_LEDGER_ENABLED` | evidence lifecycle and self-mail recording | live fulfillment |
| `P0_FULFILLMENT_ENABLED` | future adapter path after separate approval | provider selection by caller |
| `P0_RESPONSE_INTELLIGENCE_ENABLED` | response intake/association/provisional findings | legal conclusion/auto escalation |
| `P0_PROGRESS_INTELLIGENCE_ENABLED` | evidence-backed read projection | truth writes |
| `P0_KAI_EVIDENCE_EXPLANATIONS_ENABLED` | bounded explanation | assertion/action/mail authority |

Dependency evaluation is explicit: a later flag fails closed if any required earlier flag, migration checksum, adapter attestation, cohort, policy version, or readiness receipt is missing/stale. Disabling a flag stops new work and hides its projection; it never deletes immutable evidence.

## 20. Testing strategy

Each wave preserves the frozen 515/515 Phase 1/1.1 matrix and adds exact targeted counts. The suite pyramid is:

1. pure contract/validator tests;
2. repository/component tests with hostile shapes;
3. disposable PostgreSQL constraints, concurrency, rollback, and idempotency;
4. route/runtime authorization and negative-response tests;
5. deterministic artifact byte tests;
6. adapter contract tests with no live provider;
7. end-to-end synthetic three-bureau workflow;
8. load/query-plan, cursor-pagination, bounded-concurrency, and backpressure tests;
9. independent exact-source adversarial review.

```text
Synthetic report N
  -> parser-v2 (bureau divergence, history, clean control, uncertainty, scores)
  -> DB readback/attestation
  -> Round 0 + account/identity assertions
  -> action + recipient-compatible packet
  -> canonical bytes (preview == download == print)
  -> self-mail/test-fulfillment evidence
  -> response exact/ambiguous paths
Synthetic report N+1
  -> exact match + coverage-aware diff
  -> progress/Kai noncausal explanation
```

Failure-mode matrix:

| Failure | Required result | Retry/user visibility |
|---|---|---|
| Flag/cohort/readiness absent | no-op or unavailable before mutation | no retry; legacy unchanged |
| Source store/readback mismatch | typed integrity failure | no `ReportVersion`; safe retry only with same operation |
| Crash before/after worker claim or stale lease | sole `ReportIngestion` DB queue reclaims by lease/CAS with same operation/source identity | bounded redelivery; never duplicate truth |
| Parser timeout/partial section | `FAILED/PARTIAL/UNKNOWN` | bounded attempt; never absent/Clean |
| Exact 40P01 | bounded attested idempotent retry | max 3; exhaustion distinct |
| Ambiguous DB/provider outcome | `OUTCOME_UNKNOWN` | retrieve/reconcile before retry |
| Stale assertion/baseline/address | `NOT_READY` | consumer reconfirm/review |
| Counsel/policy ineligible | blocked policy code | no content generation |
| Artifact mismatch | explicit integrity failure | no preview/download/print/send |
| Callback/response ambiguity | reject or quarantine | no state/outcome/action transition |
| Incomplete later report | `UNCERTAIN/NOT_COMPARABLE` | never deletion/new claim |
| Score absent/model mismatch | absent/noncomparable with provenance | no invented score/causality |
| Invalid/polyglot/encrypted/oversized report | reject at magic/MIME, byte/page/decompression/time/memory gates | safe size/type message; no parser/truth write |
| Access-audit append failure | deny decrypt/download/export/privileged worker access | no data release |
| Kill switch | reject new work, preserve exact state | fall back only to independently valid earlier path |

Performance is a correctness boundary: all list/read models use bounded cursor pagination; history, Mail Center, response, and progress queries receive query-plan/N+1 checks; parsers/renderers/OCR/model calls have byte/page/decompression/time/memory/token quotas; workers have bounded leases, concurrency, backpressure, and per-tenant fairness. Load failure must degrade to queued/failed/unknown work—not truncated evidence or incomplete data represented as complete.

## 21. Adversarial test strategy

The independent reviewer attacks the exact integrated source after every wave. Severity follows actual consumer/truth risk; no finding is downgraded to achieve a green checkpoint.

Minimum attack families:

- **Architecture drift:** parallel `Report`, score, identity, letter, packet, mail, response, or outcome authorities; legacy rows promoted without evidence.
- **Bureau/history:** account-level flattening, Bureau A evidence reused for Bureau B, current paid/closed/$0 erasing historical derogatory evidence, clean control false positive.
- **Uncertainty/deletion:** incomplete coverage, parser failure, ambiguous match, or missing field forced to absent/new/deleted.
- **Confirmation:** competing identity disposition authorities, preselected/AI-generated testimony, assertion replay, revoked/stale assertion, wrong report/run/field/bureau/revision/evidence.
- **Recipient/packet:** CRA retarget, mutable recipient bureau, incompatible recipient classes, stale address, mixed policy/round/enclosures, missing creditor or masked-ref evidence, free-form/unselected requested action, or chronology-only follow-up.
- **Artifact:** current profile/browser regeneration, substituted membership/order/version, wrong digest, remote font/asset, partial write, stale readback, access-grant replay.
- **Mail/fulfillment:** arbitrary bytes/URL, duplicate send after timeout, spoofed callback, tracking substitution, provider status overclaim, sent-content mutation.
- **Response:** cross-mailing or cross-item association, model guess as authority, malformed nested evidence, response-driven legal conclusion or automatic escalation.
- **Tenant/privacy:** IDOR, agency grant revocation, job/callback cross-scope, cache leak, signed URL leak, PII in logs/analytics/errors/model traces.
- **Score/Kai/counsel:** manual score as primary, incompatible model comparison, correlation as causation, Kai assertion/action authority, `PENDING_COUNSEL`/draft policy bypass.
- **Concurrency:** duplicate version, assertion, packet, artifact, mailing, response, comparison, or event under races; exact 40P01 and unknown outcome.
- **Legacy interaction:** delete/erasure/reanalysis/mutable letter/mail routes corrupting, blocking consumer deletion, retaining hidden artifacts, or being mistaken for P0 authority after a flag change.
- **Resource abuse:** MIME/magic mismatch, encrypted/polyglot/decompression bomb, excessive pages/nesting/tokens, lease exhaustion, unfair tenant work, pagination truncation, N+1 and slow-query denial of service.

Required controls include at least one truly clean account, one three-bureau divergent account, current favorable state plus supported historical derogatory evidence, missing-one-bureau fields, conflicting dates/balances/statuses, partial section, no-score report, multiple score models, two legitimate versions, uncertain absence, exact identity and account assertions, and incompatible recipient classes.

## 22. Rollback/disable strategy

Phase 2 uses **forward-safe disable**, not destructive rollback:

- root and per-stage kill switches stop new operations;
- workers recheck gates and readiness at execution time, not just enqueue time;
- immutable truth/evidence remains; projections can be rebuilt or hidden;
- orchestration rows may enter `PAUSED`, `FAILED`, `QUARANTINED`, or `OUTCOME_UNKNOWN`, but never success by default;
- provider/DB unknown outcomes are retrieved/reconciled before retry;
- canonical bytes and sent mail are never mutated or deleted to “roll back” UI behavior;
- migration rollback is verified locally before release, but production down-migration is not the operational rollback plan;
- legacy continues only where it is independently safe and authoritative; flags never copy P0 evidence back into lossy legacy fields;
- a security/privacy incident additionally revokes artifact capabilities, stops adapters, preserves a PII-safe audit trail, and follows retention/incident policy.

Each wave's checkpoint must prove that disabling it leaves earlier accepted waves coherent and prevents any later-stage mutation.

## 23. Counsel dependencies

Repository truth contains seven `PENDING_COUNSEL` policy families: `validation`, `fcra_623`, `fdcpa`, `goodwill`, `pay_delete`, `cease_desist`, and `cfpb_threat`. Five additional policies are draft, not approved. **Zero policy becomes eligible merely because Phase 2 code exists or a feature flag is enabled.**

Counsel disposition and runtime eligibility are separate, closed decisions. The current `DRAFT | PENDING_COUNSEL | APPROVED | RETIRED` source type is not silently overloaded. Phase 2B must introduce an exact evaluation receipt with:

```text
counselDisposition: DRAFT | PENDING_COUNSEL | APPROVED | RESTRICTED | DISABLED | RETIRED
runtimeEligibility: INELIGIBLE | ELIGIBLE | ELIGIBLE_WITH_RESTRICTIONS
restrictionManifestVersion + exact predicates (required when restricted)
```

The architecture supports these release outcomes without redesign:

- `APPROVED`: exact immutable policy version may evaluate as eligible within its predicates.
- `RESTRICTED`: eligibility is possible only when every exact recipient, jurisdiction, timing, claim, disclosure, evidence, and action predicate passes.
- `REVISED`: not a mutable status; append a new immutable policy version and retire/disable the old version for new work.
- `DISABLED` or `RETIRED`: unconditionally ineligible for new work; historical artifacts retain their pinned version.

Counsel/compliance review must cover exact templates and assertions, recipient classes, CRA/furnisher/collector boundaries, Round 2 prerequisites, enclosures, timing, C&D consequences, pay-delete negotiation, regulator language/submission, goodwill copy, fulfillment disclosures, response interpretations, and consumer-facing/Kai claims. `cfpb_threat` cannot auto-submit or manufacture threat language. A round number never substitutes for legal eligibility.

## 24. Trusted-writer pre-activation dependency

**Classification remains BOUNDED.** Phase 1.1's pure/local attestation contract is accepted, but the authenticated production repository verifier/adapter does not exist and is not in scope for this planning session.

Before any Phase 2 production flag can be enabled, a separate authorized implementation and evidence package must prove:

1. all P0 reads/writes are inventory-controlled through the authenticated repository boundary;
2. actor, tenant, consumer, report/case, bureau, recipient, and purpose are authorized before decrypt/read/write;
3. adapter identity is bound to writer/version/code revision/migration/encryption/AAD/allowed-query set;
4. each mutation is idempotent, transactionally bounded, read back, and semantically compared to the exact in-memory source set;
5. the verifier alone mints a non-forgeable attestation after equality; durable digests remain value-free;
6. stale/forged/replayed/swapped/partial/direct-helper paths fail closed;
7. disposable PostgreSQL, 40P01, IDOR, PII telemetry, and independent bypass tests pass;
8. runtime readiness fails closed when the deployed adapter receipt is missing, stale, or mismatched.

Local green tests, schema validity, a migration, a deployment, or a Founder-approved plan do **not** close this dependency. Phase 2 implementation checkpoints may remain dormant while it is bounded; activation may not.

## 25. Founder approval gates

| Gate | Founder decision | Required evidence before decision |
|---|---|---|
| Plan acceptance | accept/revise this architecture | exact docs, independent review, no source changes |
| 2A build authorization | authorize implementation only | owned-file plan, migration design, privacy/testing plan |
| 2A checkpoint | accept/reject local build | exact tests, migration verifier, red team, zero prod |
| Production schema | separate authorize/deny | exact migration hash, rollback/compatibility, maintenance plan |
| Shadow ingestion | separate cohort authorization | trusted-writer adapter, sole-DB-queue lease recovery, resource limits, access audit, source-link deletion/erasure evidence, observability, kill switch, no consumer authority |
| Round 0/assertion cohort | separate authorize/deny | UX/compliance/privacy/tenant tests and shadow truth quality |
| 2B build/preview | separate authorize/deny | counsel-approved policies/templates and canonical artifact security |
| 2C mail evidence | separate authorize/deny | state/retention proof; no vendor implied |
| Live fulfillment | separate vendor-specific authorize/deny | contract, security, compliance, pricing, webhook/reconciliation/canary evidence |
| 2D response/diff | separate authorize/deny | association/matching thresholds, false-deletion red team |
| 2E consumer/Kai | separate surface/cohort decisions | copy/compliance review, noncausal/Kai authority tests |
| Backfill/reanalysis | separate plan and authorize/deny | source availability, non-manufacture law, rollback, consumer impact |

No earlier gate implies a later one. Every checkpoint stops for Founder review.

## 26. Explicit non-goals

This plan does not authorize or design implementation details for:

- Phase 2 code, schema edits, migrations, commits, deployment, production access, activation, backfill, or reanalysis in this session;
- M2 changes or lineage mixing;
- replacement of CreditVector's overall product architecture;
- autonomous legal advice, legal conclusions, regulatory complaints, dispute submission, consumer testimony, or counsel-policy approval;
- a vendor-specific fulfillment integration or live mail sending;
- automatic import of legacy `Tradeline`, `Letter`, `ScoreEntry`, `MailManifest`, or `VerifiedOutcome` into authoritative P0 truth;
- causal score modeling or claims about what caused a score change;
- automatic dispute of accurate former addresses, legitimate employment, or merely unfamiliar data;
- a generic workflow engine, generic task database, new AI agent framework, or unrelated UI polish;
- production closure of the trusted-writer boundary without a separately authorized adapter implementation;
- Phase 3 or broad legacy deprecation.

## 27. Risks/open questions

### Top five risks

1. **Bureau flattening at the ingestion seam:** a v2 orchestrator could feed shared legacy facts into a safe downstream model and recreate the original defect.
2. **Tenant/evidence substitution:** a bare-ID repository, queue, artifact, packet, callback, or response join could cross users, organizations, bureaus, recipients, or versions.
3. **False deletion/new conclusions:** weak account matching or incomplete report coverage could turn uncertainty into a business claim.
4. **Canonical artifact/delivery drift:** recipient, address, membership, rendered bytes, or provider outcome could change after consumer review and be misrepresented as sent/delivered truth.
5. **Authority creep:** AI/Kai, round chronology, feature flags, legacy routes, or `PENDING_COUNSEL` policy could silently become testimony, action, or legal authority.

### Decisions required during future wave planning

- Define `reportSeriesKey` and exact report version reservation rules for single- and multi-bureau source packages.
- Retain original bytes, derived normalized text, or both as separately digested artifacts. Recommendation: both, with each run pinning the exact input it consumed.
- Define the account-match evidence threshold; ambiguous matches must remain uncertain.
- Define which identity categories can be `NOT_APPLICABLE` and what exact review completeness confirms a baseline.
- Define self-mail evidence thresholds for `SENT`, certified mailing, and `DELIVERED` without overclaiming.
- Establish report/response/artifact retention, export, erasure/crypto-shred, backup, and legal-hold rules.
- Select deterministic renderer/template/font assets and accessibility rules before 2B.
- Decide whether encrypted consumer corrections are retained; they must never overwrite source-reported facts.
- Fence legacy delete/reanalysis/letter/mail paths before any authoritative activation.

These are explicit wave-entry gates, not permission for implementers to choose silently.

## 28. Recommended first implementation wave

Recommend authorizing **Phase 2A only**, in a fresh continuation after Founder accepts this plan.

### 2A implementation task sequence

1. Freeze repository/principal/attestation interfaces and feature-flag dependency rules.
2. Design and verify the additive 2A migration in disposable PostgreSQL, including `ReportIngestion` as the sole leased DB queue, access audit, source-link/erasure, and one identity-disposition authority.
3. Implement source-artifact retention/readback, bounded ingestion claims/recovery, deletion/crypto-shred/tombstone semantics, and exact extraction-input binding.
4. Wire parser-v2 shadow persistence from genuinely bureau-scoped inputs without changing legacy upload output or authority.
5. Implement the explicit actor/tenant/consumer principal and composite-scope repository methods.
6. Implement canonical `IdentityFact.classification`, category completion, identity claim receipts, and exact account `ConsumerAssertion` without competing dispositions.
7. Implement append-only consumer action decisions only; policy evaluation/receipts remain explicitly deferred to 2B.
8. Add flags/cohort/kill switch, refs-only sensitive-access audit, safe metrics, file/resource limits, reconciliation states, and bounded 40P01 behavior.
9. Run constitutional, migration, authorization, deletion/retention, privacy, performance, concurrency, and independent adversarial suites.
10. Produce a build-only Founder checkpoint and stop.

2A must explicitly exclude correspondence generation, canonical packet delivery, Mail Center mutation, fulfillment, response interpretation, consumer-visible P0 authority, backfill, and production activation.

Recommended Founder decision now: **accept or revise this plan; if accepted, separately authorize only the local build of 2A.**

## GSTACK REVIEW REPORT

### Engineering plan review

The plan reuses the Phase 1 truth graph, identifies concrete repository seams, limits schema to operational gaps, defines explicit state machines and failure behavior, sequences one-writer migrations before parallel service/UI work, and gives every wave a feature gate, test plan, adversarial plan, Founder gate, and disable strategy.

### Independent adversarial plan review

Three bounded read-only passes attacked architecture drift, duplicate authority/schema, bureau/history/deletion semantics, consumer testimony and action binding, recipient/restriction compatibility, canonical sender/artifact/mail truth, async recovery, response association, tenant/privacy/resource controls, score/Kai/counsel authority, activation gates, and Markdown/HTML parity.

- Pass 1 found C0/H5/M5/L0; the plan was revised.
- Pass 2 verified those Highs closed and found C0/H0/M4/L1; the plan was revised again.
- Final exact-pair closure: **C0/H0/M0/L0 — PASS**.

Final repaired decisions include one identity disposition authority, exact selected-action plus 2B policy receipts, consumer-deletion/erasure safety before shadow activation, separate mail channel states and final-artifact approval, `MailingEvent` as sole state authority, a refs-only access audit, `ReportIngestion` as the sole durable DB queue, pinned sender and restriction manifests, bounded resource/load behavior, and executable counsel eligibility mapping.

### Decision record

The architecture chooses additive operational models over parallel truth models; specialized identity testimony over weakening account assertions; a canonical stored artifact over regeneration; a vendor-neutral fulfillment boundary over provider coupling; explicit account-match evidence over heuristic identity; and gated evidence projections over AI authority.

Repository boundary at final review: P0 executable source/schema/migrations/index remain unchanged; only this Markdown/HTML pair is untracked. M2 is still `launch/extraction-wave-2` at `ebe780ec24d4518521689e8f2add6ed9e539fb2f`; its frozen binary diff, name-status, untracked inventory, and empty-index fingerprints match. This task made no M2 write.

NO UNRESOLVED DECISIONS
