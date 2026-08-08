# CreditVector P0 Correctness — Root Cause & Implementation Plan

**Program:** Credit Intelligence & Correspondence Integrity Gate<br>
**Date:** 2026-08-08<br>
**Repository baseline:** `origin/main` at `3a9943040da5648f1ae68fa9b8e0f06a276f75b1`<br>
**P0 branch/worktree:** `codex/p0-launch-correctness` at `/private/tmp/creditvector-p0-launch-correctness`<br>
**Phase:** Analysis-only checkpoint<br>
**Launch verdict:** **NO-GO**<br>
**Production access:** **NOT REQUIRED**<br>
**Production mutation:** None

> This is an internal engineering and compliance review, not legal advice. Any Critical finding and the final recipient-specific correspondence rules require outside-counsel review before public launch.

## Executive decision

The current P0 gate does not pass. The earliest confirmed loss of report truth is the structured extraction contract, not PDF text extraction. The report text is available to the parser, but the parser schema has one account-level status, balance, delinquency date, and reported date, then copies those values to every reported bureau. It cannot represent bureau-specific summary/detail differences, payment-history grids, collection-section evidence, historical derogatory markers, or field provenance.

Downstream code then compounds that loss:

1. `AccountType` is used as if it were account condition.
2. `isFactualNegative` ignores bureau observations and historical evidence.
3. Strategy Desk treats every non-government score band as a queue candidate.
4. letter generation requires neither a source-bound disputed field nor consumer confirmation.
5. packet grouping is tradeline-first and may group different bureau recipients together.
6. recipient edits, enclosures, correspondence content, and responses are mutable.
7. browser printing is treated as the PDF artifact.
8. Mail Center evidence is derived from current mutable rows rather than an append-only record.

The parser/classification truth projection could initially shadow-write a typed JSON v2, but the complete P0 program requires durable correspondence versions, consumer assertions, recipient revisions, canonical artifacts, and an evidence ledger. Those require an owner-approved additive migration. Repository migration governance therefore triggers the P0 stop condition: analysis, specifications, and synthetic contracts may proceed; production-sensitive implementation must wait.

## 1. Resume and isolation status

| Check | Result | Evidence / decision |
|---|---|---|
| Current repository | Verified | `/Users/re3zy/Documents/gabriel-capital-labs-to-upload` |
| Original working branch | Preserved | `launch/extraction-wave-2`; no edits made there |
| Production baseline | Verified | `origin/main` at `3a9943040da5` |
| P0 isolation | Verified | Separate worktree and branch `codex/p0-launch-correctness` |
| Gate D | Closed | Not reopened |
| M2 | **Blocked** | M2 execution plan says failed adversarial review; no execution authorized |
| M2 worktree | Preserved | Detached at `4d842e7`; its untracked local probes were not touched |
| Credentials | Not requested | No production credential shell opened |
| Production writes | None | No migration, merge, deploy, backfill, or remote mutation |
| Schema change likely | **Yes** | Required for full case/version/artifact/evidence integrity |
| Production access required now | **No** | Repository + local evidence were sufficient for this checkpoint |

### Stop decision

The P0 program must stop after this checkpoint because:

- M2 remains separately blocked and must not be disturbed.
- the full P0 durable model requires an additive schema migration.
- migration application and any reanalysis/backfill are production mutations requiring owner authorization.
- Critical and High correctness findings remain unresolved in current code.

## 2. Privacy boundary and evidence handling

The Founder-provided source report, generated consumer letter PDF, and screenshots were treated as local, read-only evidence.

- No source report, consumer letter, screenshot, source text, address, account number, DOB, SSN, or consumer identity was copied into the repository.
- No source-report content was placed in fixture values, logs, Markdown, or HTML.
- The evidence matrix below contains only creditor labels and structural observations necessary to explain the defect.
- Regression data in `scripts/fixtures/p0-credit-truth.synthetic.json` is explicitly synthetic and contains no account-number field.
- Before any commit, staged paths must be enumerated and checked against the sensitive-evidence denylist.

## 3. Source-of-truth evidence matrix

Notation: **S** = summary field; **D** = detailed account field; **H** = payment-history grid; **C** = collection section. Dollar amounts, dates, account numbers, addresses, and consumer identity are intentionally omitted.

| Account | Bureau-specific source observations | Historical derogatory evidence | Current CreditVector projection | Source truth preserved? | Verdict | Suspected loss point |
|---|---|---|---|---|---|---|
| Extra | EQ absent; EX S=Closed and D=over 120 days past due; TU absent | EX H includes escalating late-payment markers through 120 days | EX-only, Closed, `Clean`, “no derogatory history” | No | **FAIL** | Extraction has no payment-history/detailed-status representation; no DOFD survives; clean predicate sees neither derogatory type nor DOFD |
| Upgrade | All three S=Closed; all three D=Collection Account; C evidence across reporting bureaus | Late and charge-off markers; transfer/sale, loss, and prior-dispute annotations | INSTALLMENT; Collection detail displayed; still `Clean` | No | **FAIL** | Historical/account evidence dropped; entity/product classification later substituted for condition |
| Discover | EQ S/D=Collection; EX S=Closed and D=over 120 days past due; TU S=Closed and D=Collection | Charge-off, loss, severe delinquency, and prior-dispute evidence | REVOLVING; present on all three; `Clean` | No | **FAIL** | Per-bureau summary/detail and history cannot survive extraction; classification ignores surviving bureau evidence |
| OneMain | EQ S/D=Collection; EX S=Closed and D=over 120 days past due; TU S=Closed and D=Collection | Major delinquency, charge-off, and loss evidence | INSTALLMENT; one Collection value copied to all bureaus; `Clean` | No | **FAIL** | Direct proof of cross-bureau value smearing plus false Clean projection |
| Seed / Cross River | EQ absent; EX/TU S=Closed and D=Collection; C evidence for reporting bureaus | Late/charge-off grid plus transfer/loss evidence | EX/TU Collection with one date copied; `Clean` | No | **FAIL** | History, collection-section facts, and bureau-specific dates lost |
| Navient | Two paid/closed, Pays-as-Agreed controls; bureau coverage differs by row; bureau dates differ | None detected | Two STUDENT_LOAN rows; both `Clean`; one global date copied within each row | Condition only | **PASS condition / FAIL fidelity** | Clean is reasonable; bureau-specific dates are not preserved |
| Fingerhut / WebBank | All reporting bureaus paid/closed and Pays as Agreed; one bureau date differs | None detected | REVOLVING; `Clean`; one bureau date copied to another | Condition only | **PASS condition / FAIL fidelity** | Correct control classification, incorrect per-bureau field projection |
| Austin Capital | All reporting bureaus paid/closed and Pays as Agreed; bureau dates differ | None detected | INSTALLMENT; `Clean`; one date copied across bureaus | Condition only | **PASS condition / FAIL fidelity** | Correct control classification, incorrect per-bureau field projection |
| MDG US | EX only; explicit source product type Revolving; Pays as Agreed | None detected | EX only; `Clean`; product type INSTALLMENT | Partly | **PASS condition / FAIL type** | Hardcoded creditor-name classification overrides explicit source product type |

### Evidence conclusion

The correct fix is not “make everything disputable.” The control accounts show that Clean must remain possible. The required rule is narrower:

> An account may be Clean only when all covered, successfully parsed relevant sections provide affirmative non-adverse evidence and no authoritative adverse observation exists. Missing, incomplete, conflicting, or unattributed evidence produces `NEEDS_REVIEW`, not Clean.

## 4. Earliest truth-loss analysis

### 4.1 PDF extraction is not the loss point

The source report was extracted locally in full enough to remain below the upload and model cutoffs. The structural loss starts when report text is converted into the parser’s account schema.

### 4.2 First confirmed loss: extraction contract

| File | Current behavior | Consequence |
|---|---|---|
| `lib/aiParse.ts:18-36` | One account-level `status`, `balanceCents`, `dofd`, `dateReported`, plus a bureau list | Cannot express distinct bureau values, summary vs detail, payment grids, collection sections, or history |
| `lib/aiParse.ts:166-183` | Copies one value set into every bureau listed; empty list falls back to every covered bureau | Cross-bureau fact smearing and possible fabricated presence |
| `lib/parse.ts:145-175` | Regex fallback also derives one status/balance/DOFD and copies it to all covered bureaus | Same defect when AI extraction is unavailable |
| `lib/bureauData.ts:6-15` | Stores current status/balance/date/DOFD/remarks only | Historical evidence and field-level provenance are unrepresentable |
| `lib/analyze.ts:85-98` | Scores from global type, balance, DOFD, and narrow bureau JSON | Derivation starts from incomplete evidence |

### 4.3 Second loss: product type is treated as condition

`lib/classify.ts` answers “what kind of account/entity is this?” It does not answer “is this account adverse?” Original-creditor overrides are reasonable for product type, but downstream code treats the result as condition. The MDG control additionally proves that explicit report product type must outrank a creditor-name rule.

### 4.4 Third loss: false Clean projection

`lib/intelligence/snapshot.ts:15-39` defines a factual negative as:

- product type `COLLECTION`, `CHARGE_OFF`, or `PUBLIC_RECORD`; or
- any non-null global DOFD.

It does not inspect bureau status, detailed status, payment history, charge-off markers, collection-section evidence, loss reporting, or parser completeness. `app/tradelines/page.tsx` and `app/strategist/page.tsx` then render the result as “Clean,” “no derogatory history,” and “nothing to dispute.” Existing Mission Control tests explicitly pin the incomplete predicate.

### 4.5 Fourth loss: score is presented as dispute intelligence

`lib/scoring.ts` gives every non-government account type a baseline score. `app/strategist/page.tsx:25` and `app/api/strategist/plan/route.ts:44` admit every row except `NOT_RECOMMENDED` into the queue, while only the page presentation attempts to hide actions for rows it calls Clean. The AI plan endpoint still describes the full non-government queue as disputable and defaults a missing angle to “standard reinvestigation.”

### 4.6 Fifth loss: outbound claims have no confirmation boundary

The letter builder submits a tradeline, strategy, bureau targets, and optional address. It never submits exact disputed fields or consumer assertions. `lib/letter.ts` then:

- creates a generic status concern when the field is absent;
- uses all-bureau values for a target letter;
- falls back to global balance/DOFD;
- always emits a payment-history concern;
- states that the consumer cannot reconcile fields without asking the consumer.

The phrase scrubber in `lib/compliance.ts` cannot enforce source provenance, consumer confirmation, bureau scope, legal trigger, or recipient compatibility.

### Root-cause statement

**Primary root cause:** the parser and normalized truth contract flatten bureau- and history-specific report facts into one mutable account projection.<br>
**Compounding root cause:** condition, grounds, and score impact are not separate domains.<br>
**Correspondence root cause:** generation starts from a tradeline and strategy rather than immutable source observations plus consumer-confirmed assertions.<br>
**Fulfillment root cause:** recipient, packet, letter, PDF, enclosure, response, and evidence states are current projections rather than versioned records.

## 5. Current source-file map and ownership

| Subsystem | Principal files | Analysis owner | Future single-writer boundary |
|---|---|---|---|
| Source extraction / normalization | `lib/aiParse.ts`, `lib/parse.ts`, `lib/analyze.ts`, `lib/bureauData.ts`, `lib/classify.ts` | Agent A | Parser/domain engineer only |
| Classification / Strategy Desk | `lib/intelligence/snapshot.ts`, `lib/scoring.ts`, `lib/recommend.ts`, `app/tradelines/page.tsx`, `app/strategist/*`, strategist API | Coordinator | Classification/Strategy writer only |
| Identity Round 0 | identity discrepancy/letter APIs, `app/identity/page.tsx`, new baseline domain | Coordinator | Identity writer only |
| Strategy / factual claim builder | `lib/strategies.ts`, `lib/letter.ts`, letter generation/round2 APIs | Agent D | Correspondence writer only |
| Case / packet model | `lib/mailCenter.ts`, campaign seams, new case/packet models | Agent D | Case architecture writer only |
| Recipient / address | `lib/furnisher.ts`, tradeline API, mail prepare/resolver paths | Agent D | Recipient-data writer only |
| PDF / canonical artifact | print route, download route, new artifact renderer/storage | Agent G | Document writer only |
| Mail Center / evidence | `lib/mailCenter.ts`, MailManifest/MailStore, mail pages, new ledger | Agent G | Lifecycle/ledger writer only |
| Theme / responsive / accessibility | `app/globals.css`, shell/sidebar/header/Kai, affected pages | Agent G | UX writer only |
| Adversarial verification | tests and read-only review | Agent J | Separate test files only when assigned |

## 6. Canonical credit-truth model

### 6.1 Durable entities

| Entity | Purpose | Immutability / boundary |
|---|---|---|
| `ReportVersion` | One uploaded source report and its covered bureaus/sections | Immutable; encrypted source reference, content digest, report date, tenant, consumer scope |
| `ExtractionRun` | Parser/model/rules version, completion map, errors, confidence, and input digest | Append-only; a retry creates a new run |
| `Account` | Stable account identity inside the consumer case | Contains no bureau-specific mutable truth; links report observations across versions |
| `FieldObservation` | Bureau + report version + section + account + field + raw/normalized value + source locator | Immutable and field-scoped; encrypted when value-bearing |
| `HistoricalEvidence` | Bureau-scoped payment history, charge-off, loss, collection, transfer, dispute annotation, and relevant dates | Immutable; never discarded because a current status becomes closed or paid |
| `DerivedAccountAssessment` | Versioned condition, grounds, reported-adversity label, reasons, completeness, classifier/policy versions, input digest | Derived and replaceable only by a new version; never source truth |
| `ConsumerAssertion` | Consumer-confirmed account, bureau, exact field, observed value/version, claimed correction, basis, confirmation time | Immutable after use; changes create a new assertion/version |

An additive `BureauData v2` JSON projection may be used for a shadow-read rollout, but it may not become another mutable source of truth. The normalized observation and history records above are the authoritative model; JSON is a cached projection with an input digest and version.

### 6.2 Observation shape

Every source-derived fact must retain:

```text
tenant/case -> reportVersion -> extractionRun -> account
            -> bureau -> report section -> field -> observed value
            -> source locator -> normalization rule/version
```

Presence is tri-state: `PRESENT`, `ABSENT_CONFIRMED`, or `UNKNOWN`. Parser silence is `UNKNOWN`, never absence. Summary status, detailed status, payment history, collections, remarks, balance, dates, and product type are distinct fields. A value observed at one bureau can never populate another bureau's field.

### 6.3 Truth invariants

1. No derived assessment may introduce a fact not reachable through its input observations.
2. An observation is addressable by report version, bureau, section, field, and source locator.
3. Historical adverse evidence is monotonic within a report version: a current closed/zero balance does not erase it.
4. Explicit source product type outranks creditor-name heuristics; heuristics are tagged inference, not observation.
5. `UNKNOWN` completeness or presence cannot be coerced to `ABSENT_CONFIRMED` or affirmative good standing.
6. Conflicting summary/detail values remain separate and produce a reasoned assessment; they are not overwritten.
7. A new parse or consumer report creates a new version and never silently changes the old one.
8. Legacy flattened rows are labeled `LEGACY_UNVERIFIED`; they cannot be promoted to authoritative v2 evidence without reanalysis.

## 7. Classification and Strategy Desk specification

### 7.1 Separate domains

| Domain | Values | Meaning and safe use |
|---|---|---|
| `AccountCondition` | `CLEAN`, `DEROGATORY`, `MIXED`, `NEEDS_REVIEW` | Evidence condition only. `CLEAN` requires complete affirmative non-adverse evidence and no adverse observation. `MIXED` preserves conflicting or bureau-varying evidence. |
| `DisputeGrounds` | `STRONG`, `MODERATE`, `LIMITED`, `NONE_DETECTED`, `CONSUMER_REVIEW_REQUIRED` | Quality of a potential, field-specific basis; never an assertion that information is inaccurate and never an outcome prediction. |
| `ReportedAdversity` | `ADVERSE`, `POTENTIALLY_ADVERSE`, `NEUTRAL`, `FAVORABLE`, `UNKNOWN` | Describes what the report appears to show, not a promised score effect. This is the safer internal replacement for the requested `ReportImpact` labels. |

`High / Medium / Low` remains presentation-only prioritization and must be computed only after condition, field grounds, confirmation, eligibility, and readiness. It must not stand in for truth or predict deletion/score improvement.

### 7.2 Deterministic rules

| Evidence state | Condition | Grounds default | UI action |
|---|---|---|---|
| Complete, affirmative good standing; no adverse history or conflict | `CLEAN` | `NONE_DETECTED` | “Looks correct” and “Explain why no dispute basis is detected” |
| Any authoritative current or historical adverse evidence, no material conflict | `DEROGATORY` | `CONSUMER_REVIEW_REQUIRED` until exact field review | “Review for inaccuracies” |
| Bureau or section conflict, or adverse and favorable evidence coexist | `MIXED` | `CONSUMER_REVIEW_REQUIRED` | Show each source field separately; ask the consumer |
| Required section missing, parse failed, presence unknown, or provenance incomplete | `NEEDS_REVIEW` | `CONSUMER_REVIEW_REQUIRED` | “I'm not sure — help me review”; no Clean claim |

Negative/adverse reporting is not itself a dispute. The product must ask whether a specific observed field is accurate, record the consumer response, and generate no dispute assertion until confirmation exists.

### 7.3 Strategy Desk correction

- Build the queue from eligible, consumer-reviewed `ConsumerAssertion` records, not every non-government tradeline.
- Show source bureau, section, exact field, current observed value, history, completeness, and reason for the classification.
- Keep bureau observations visually and structurally isolated.
- Replace “nothing to dispute” with “no issue detected from the evidence parsed” when completeness is affirmative; otherwise show review-needed language.
- Replace dispute-strength outcome framing with grounds quality and explain its evidence inputs.
- The AI plan may organize confirmed items; it may not invent a fallback angle or turn an unconfirmed observation into a claim.

## 8. Round 0 — Consumer Identity Baseline

### 8.1 Domain and persistence

Create an immutable, versioned `IdentityBaseline` scoped to tenant, managed consumer, and report version. Each `IdentityFact` records:

- category: legal name, alias/name variant, current/former address, DOB, SSN last four, phone, employment, mixed-file indicator, or account ownership;
- bureau and report-version provenance;
- encrypted observed value and normalized comparison value;
- consumer classification: `CORRECT_CURRENT`, `CORRECT_FORMER`, `INCORRECT`, `NEVER_MINE`, `OUTDATED_UPDATE_REQUESTED`, or `REVIEW_NEEDED`;
- consumer-confirmed replacement/correction when applicable;
- confirmation actor, timestamp, baseline version, and superseded fact reference.

Later correspondence must pin `identityBaselineVersionId`; it must not re-read a mutable profile and silently change a previously approved letter.

### 8.2 UX flow

1. Present one field at a time, grouped by bureau and source section.
2. Ask the consumer to classify it; do not preselect “incorrect.”
3. Explain that former addresses and employment can be legitimate report data and should be disputed only when the consumer identifies a specific inaccuracy or update need.
4. Elevate `NEVER_MINE`, conflicting core identifiers, and consumer-identified unknown accounts to mixed-file/identity review without declaring identity theft.
5. Require a review screen showing exact claims and recipients before correspondence generation.
6. Persist a new baseline version on edits; retain every version used by correspondence.

### 8.3 Privacy and safety

Encrypt sensitive values and confirmation payloads; display masked values by default; authorize tenant and managed-client scope before decrypting; exclude values from logs, analytics, URLs, support telemetry, and ledger event bodies. Never hash low-entropy identifiers such as SSN last four as a substitute for encryption. Define retention, access audit, export, erasure, and tombstone behavior before migration approval.

## 9. Correspondence strategy specification

Every permitted claim follows:

```text
claim -> reportVersion -> bureau -> account -> section -> field -> observation
      -> consumerAssertion -> correspondenceVersion
```

No provenance means no factual claim. No consumer-confirmed disputed field means no dispute assertion.

| Strategy | Recipient and applicability | Required evidence / confirmation | Permitted request and authority | Prohibited / round and grouping controls |
|---|---|---|---|---|
| FCRA §611 Bureau Reinvestigation | CRA reporting the exact field | Bureau-scoped observation, consumer assertion, recipient address version | Concise identification of the field and request for reasonable reinvestigation/correction or deletion if unverifiable; FCRA §611 | No other-bureau values, generic “everything is inaccurate,” or outcome promise; CRA-compatible items may consolidate by recipient/round |
| §609/§611 File Disclosure & Dispute | CRA where the consumer needs file/source disclosure and separately has a confirmed §611 dispute | Exact disclosure sought; separate confirmed disputed field for any accuracy claim | Request relevant file/source disclosure and, where supported, §611 reinvestigation | No “§609 deletion loophole,” unsupported certification demand, or conflation of disclosure with automatic deletion |
| Debt Validation | Verified collector/debt buyer recipient | Collection role, address, account link; initial-notice and written-dispute timing if invoking statutory cease duty; consumer election | Request validation and supporting account/authority information; FDCPA §809/15 U.S.C. §1692g where its trigger is established | No unconditional “must cease” statement when timing is unknown; never send to CRA; no bureau-clock claim |
| FCRA + Metro 2 Inconsistency | CRA or furnisher path separately selected | Exact, verified field inconsistency and confirmation; applicable recipient basis | Request investigation/correction; Metro 2 may explain data-format context | Metro 2 is not an independent consumer cause of action or deletion guarantee; no cross-recipient packet |
| FCRA §605 Obsolete Item | CRA reporting an item whose reporting-period inputs are complete | Relevant adverse-event dates, item type, policy/rule version, exact consumer confirmation | Ask CRA to review/remove information that is demonstrably obsolete under the applicable rule | No age conclusion from missing DOFD/date; unknown inputs block this strategy |
| FCRA §623 Direct Furnisher Dispute | Verified furnisher and direct-dispute address, with counsel-approved legal rule | Furnisher-specific observation, exact field/basis, address, confirmation, applicability rule | Direct factual dispute and request to investigate/correct using counsel-approved authority | Do not cite §611 to a furnisher; do not present §1681s-2(b) as triggered by a direct consumer letter absent CRA notice; no collector-only demands |
| FDCPA + FCRA Collection Agency | Recipient is verified as both collector and furnisher; both paths independently qualify | Collector-role and furnisher-role facts, timing if §1692g duty claimed, bureau field, confirmation | Keep validation request and furnishing-accuracy request as distinct sections | Do not use when either role is unverified; no incompatible CRA content |
| Round 2 Demand | Same recipient and unresolved Round 1 case | Immutable parent version, delivery evidence, response or elapsed eligible window, response findings, unresolved confirmed fields, new evidence, explicit approval | Targeted follow-up on unresolved facts and documented chronology | No automatic strategy switch, repetitive generic letter, regulator threat, or new assertion without confirmation |
| Goodwill Adjustment | Appropriate creditor/furnisher contact; accurate adverse information acknowledged | Consumer acknowledges accuracy; actual adverse field; consumer-provided context; explicit election | Courtesy request for discretionary adjustment | Not a dispute; no accusation, statutory duty, or promise; standalone strategy |
| Pay-for-Delete | Verified collector with authority; policy permits; explicit consumer authorization | Ownership/authority, amount/settlement terms, risk disclosure, address | Conditional negotiation proposal | No representation that deletion is required or assured; no bundling with factual dispute; standalone |
| Cease & Desist | Verified collector; explicit consumer instruction after consequences disclosed | Collector role/address and durable consumer authorization | Narrow communication request consistent with approved policy | No automatic selection; no CRA/furnisher packet; do not obscure that stopping communication does not resolve the underlying account |
| CFPB / State AG escalation | Separate regulator workflow after supported prior history | Prior correspondence versions, mailing/delivery/response chronology, unresolved issue, evidence, consumer intent and approval | Prepare a factual complaint draft and evidence index | No Round 1 auto-threat, fabricated nonresponse, or automatic submission; regulator packets remain separate |

All statute text and strategy rules must be versioned and approved by compliance/counsel. Model memory is never the legal source. A §611 reinvestigation is triggered when the consumer disputes completeness or accuracy and the CRA receives notice; the statute supplies timing and reinvestigation duties ([15 U.S.C. §1681i](https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A1681i%28c%29+edition%3Aprelim%29)). The §1692g cease-collection-until-verification rule is tied to a written dispute within the statutory validation period, so timing cannot be assumed ([15 U.S.C. §1692g](https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A1692g%28b%29+edition%3Aprelim%29)).

## 10. Case, recipient, and packet model

### 10.1 Required entities

| Entity | Required fields / rule |
|---|---|
| `DisputeCase` | tenant, managed consumer, source report version, identity baseline version, state, policy version |
| `Recipient` | canonical party identity and recipient type: CRA, furnisher, collector, goodwill, cease-and-desist, regulator |
| `RecipientAddressVersion` | normalized address, source, verification status/method, edited-by/at, effective window; immutable once referenced |
| `Correspondence` | logical recipient communication inside a case, strategy family, round, state |
| `CorrespondenceItem` | exact account, bureau, field observation, consumer assertion, requested action, evidence refs |
| `CorrespondenceVersion` | append-only rendered content/specification, parent version, policy/template versions, approval state |
| `Packet` | one recipient/address/version-compatible mailing unit with one or more correspondence items |
| `PacketEnclosure` | recipient-specific artifact reference, disclosure class, order, and manifest digest |

### 10.2 Packetization key

Default grouping is:

```text
tenant + case + canonical recipient + recipient type + recipient address version
+ compatible strategy/policy version + round + claim class + enclosure-manifest compatibility
= one packet
```

The result is recipient-first, not tradeline-first. Three confirmed Equifax §611 items in the same round become one Equifax packet with three clearly separated account sections. An Equifax dispute and a collector validation request always remain two packets. “Same underlying debt” is a relationship hint, never proof of improper duplicate reporting.

### 10.3 Address readiness

Resolve the address required by the selected strategy, pin its immutable version, and record its source/verification. A report address, authoritative CRA dispute address, consumer-reviewed override, or verified party record may be a candidate according to policy. Any missing or incomplete required component, failed validation, recipient/type mismatch, or unreviewed override produces `RECIPIENT_ADDRESS_REVIEW_REQUIRED` and `NOT_READY_TO_MAIL`. The UI and fulfillment service must read the same pinned address version.

## 11. Canonical artifact, fulfillment, and evidence ledger

### 11.1 One artifact contract

Preview, download, print, and future CreditVector fulfillment must return the same immutable PDF bytes and hash. Replace browser print with a deterministic server-side renderer using a pinned renderer version, embedded versioned fonts, explicit page sizing/margins, controlled line breaking, and deterministic pagination.

Each canonical `Artifact` stores or references encrypted immutable bytes plus:

- SHA-256 digest, MIME type, byte length, and page count;
- renderer, template, correspondence, policy, address, and identity-baseline versions;
- packet/enclosure manifest digest;
- creation actor/time and tenant/case authorization scope.

Part A contains intentional consumer correspondence. Part B contains only pinned, recipient-specific consumer-selected enclosures. A separate Part C is the CreditVector mailing guide, visibly marked `DO NOT MAIL THIS PAGE`; it is never silently included in the provider payload. Current-profile changes and globally enabled documents cannot alter an approved artifact.

The current generated evidence PDF fails this contract: it is a three-page browser print containing Chrome/Skia headers and footers, the app title, timestamp, print URL, browser page counters, unstable flow, and a mostly blank trailing page. That artifact is unsuitable for mailing.

### 11.2 Approval and fulfillment state machine

```text
DRAFT -> REVIEW_REQUIRED -> APPROVED_VERSION -> PACKET_READY
      -> DISPATCHED -> DELIVERED -> RESPONSE_RECEIVED -> RESOLVED / FOLLOW_UP_ELIGIBLE
```

- Editing/regeneration creates `CorrespondenceVersion v2`; v1 remains retrievable.
- Approval pins the correspondence version, recipient address version, artifact hash, and enclosure manifest.
- Fulfillment accepts only the approved canonical artifact reference; it may not accept arbitrary caller PDF bytes or re-resolve current mutable data.
- Concurrency uses transactional state transitions/idempotency keys so two approvals or dispatches cannot fork the record.
- Deletion is a governed retention/tombstone operation, never silent destruction of correspondence history.

### 11.3 Append-only evidence ledger

Ledger events contain identifiers and integrity metadata, not PII-bearing prose. Project the lifecycle from append-only events recording case/report/baseline/recipient/round/item/assertion/evidence references, strategy/statute policy versions, correspondence version, PDF/enclosure hashes, approval, provider, tracking, mailing/delivery dates, due-window rule/version, response artifact/result, report changes, and next action. Response ingestion appends a response artifact/event; it never overwrites the outgoing letter.

The CFPB advises consumers to identify the exact error and why it is wrong, include supporting copies rather than originals, keep copies, and use the dispute address associated with the report/source; these are checklist inputs, not universal enclosure mandates ([CFPB dispute guidance](https://www.consumerfinance.gov/ask-cfpb/how-do-i-dispute-an-error-on-my-credit-report-en-314/)).

## 12. Migration, backfill, and implementation sequence

### 12.1 Migration impact

The full P0 design cannot be represented safely by the current mutable `Tradeline`, `Letter`, and `MailManifest` records. It requires an additive, owner-approved migration for normalized observation/history records, identity-baseline versions, consumer assertions, recipients/address versions, cases/items, append-only correspondence versions, packet/enclosure manifests, canonical artifact metadata/storage references, and evidence events.

Migration requirements:

- additive tables/columns first; no destructive rename/drop in the initial rollout;
- explicit tenant and managed-consumer foreign keys on every sensitive row;
- encrypted value-bearing columns and artifacts with key-rotation metadata;
- database constraints for version uniqueness, recipient compatibility, packet ownership, and append-only records;
- transactional/idempotent approval and dispatch transitions;
- indexes for authorized case projections without storing PII in searchable telemetry;
- retention, deletion/tombstone, access-audit, and orphan-artifact cleanup rules;
- a reversible read-path feature flag and rollback that does not erase v2 truth.

### 12.2 Legacy policy and backfill

Current flattened bureau JSON has already lost distinctions, so migration must not manufacture them. Label migrated rows `LEGACY_UNVERIFIED`, retain their original value/digest, and default assessments to `NEEDS_REVIEW` where completeness cannot be proved. Do not infer history, confirmed absence, consumer confirmation, recipient verification, correspondence provenance, enclosure composition, or canonical artifact identity.

Reanalysis must:

1. require authorized access to the original encrypted report;
2. create a new `ReportVersion`/`ExtractionRun`, never rewrite the legacy version;
3. compare v1/v2 projections with field-level, PII-safe counters and mismatch categories;
4. require consumer reconfirmation if the observation/version underlying an assertion changes;
5. preserve prior correspondence and its legacy status without claiming it meets the v2 artifact contract;
6. support pause/rollback before any v2 correspondence is enabled.

### 12.3 Dependency-ordered implementation

| Phase | Scope | Dependency / gate | Parallelism after gate |
|---|---|---|---|
| 0 | Owner approves migration design; counsel approves strategy trigger policy; threat model and retention decisions | **Current stop point** | None before approval |
| 1 | Add durable truth/version/recipient/case/artifact/ledger schema and authorization policies | Disposable-DB migration validation; owner authorizes application | Schema writer only |
| 2 | Parser v2 shadow-write and source-completeness map | Phase 1; no read-path switch | AI parser and regex parser may use separate files with shared contract tests |
| 3 | Assessment engine and Strategy Desk read-only v2 projection | Verified parser invariants and positive controls | Classifier and Round 0 identity slices can proceed in parallel |
| 4 | Identity baseline, exact-field review, consumer assertions, recipient/address resolution | Versioned truth and authz | Identity and recipient writers in parallel |
| 5 | Policy-driven claim builder, correspondence versions, recipient-first packetizer | Counsel policy + assertions + pinned addresses | Strategy and packet writers in assigned files |
| 6 | Canonical PDF, enclosure manifests, artifact store, fulfillment pinning, append-only ledger | Immutable correspondence/packet versions | Renderer and lifecycle writers in assigned files |
| 7 | Responsive/theme/accessibility projections | Stable domain/API contracts | UX work independently mergeable; no correctness logic changes |
| 8 | Shadow comparison, authorized reanalysis/backfill, canary cohort, rollback drill | All Critical/High tests green; compliance and red-team re-review | Controlled rollout only; M2 regression check required |

No production access, migration application, source-report reanalysis, or deployment is authorized by this checkpoint.

## 13. Regression fixtures and verification plan

### 13.1 Sanitized fixtures

`scripts/fixtures/p0-credit-truth.synthetic.json` contains synthetic structural cases for:

- conflicting bureau summary/detail observations and historical adversity;
- closed/zero balance with severe historical delinquency;
- collection plus charge-off history;
- transfer/loss history;
- four affirmative good-standing controls with varied bureau coverage;
- explicit source product type outranking a creditor-name heuristic;
- observed-but-unconfirmed facts;
- compatible CRA packet consolidation and incompatible recipient separation;
- forbidden PDF chrome, missing-address readiness, and immutable regeneration.

`scripts/p0-credit-truth-fixture.test.ts` currently verifies 23 fixture-contract assertions, including an incomplete-section negative control. It intentionally imports no production classifier, packetizer, generator, or renderer because those components cannot yet represent the contract. This is a design guard, not evidence that the product is fixed.

### 13.2 Required ten-invariant status

| Test | Current result | Evidence / required closure |
|---|---|---|
| 1. Mixed bureau values remain isolated; no false TU Collection claim | **FAIL** | Parser copies one status to all bureaus; source example is falsely Clean. Production property test must prove field A at bureau X is never used for bureau Y. |
| 2. Collection + charge-off history is not Clean | **FAIL** | Historical charge-off is unrepresented/ignored. |
| 3. Closed/zero plus 120-day history retains adversity | **FAIL** | Payment grid is lost; current UI says no derogatory history. |
| 4. Paid/closed good-standing control may be Clean | **CONDITIONAL** | Observed controls are Clean, but completeness and bureau-date isolation are not enforced; add positive-control and incomplete-parse tests. |
| 5. Three compatible Equifax items become one packet | **FAIL** | Current system emits one letter per tradeline/bureau. |
| 6. CRA dispute and collector validation remain separate | **CONDITIONAL / accidental** | Strategy-based grouping may separate this example, but recipient type/address compatibility is not a durable invariant. |
| 7. Canonical PDF contains no browser/product chrome | **FAIL** | Evidence PDF contains browser title, URL, timestamp, page counters, app footer, and unstable pagination. |
| 8. Missing recipient address blocks readiness | **FAIL** | Completeness/warnings are soft; approval/download can proceed and fulfillment may re-resolve a different address. |
| 9. Unconfirmed field cannot produce inaccuracy assertion | **FAIL** | Consumer confirmation is absent from the generation contract; generic claims are invented. |
| 10. Regeneration creates immutable v2 and retains v1 | **FAIL** | Unmailed regeneration overwrites the existing row in place. |

### 13.3 Baseline verification executed

| Check | Result | Interpretation |
|---|---|---|
| `npm run typecheck` | PASS | Baseline compiles; does not test P0 truth |
| Existing Mission Control, classification, letter, mail, Mail Center/download/execution, obsolescence, and campaign scripts | PASS | Several tests pin the obsolete flattening, grouping, overwrite, and soft-warning behavior; green is not launch approval |
| Synthetic P0 fixture contract | 23 PASS / 0 FAIL | Sanitized target behavior is internally consistent; no production enforcement yet |
| Red-team invariant audit | 8 FAIL, 1 conditional control, 1 conditional/accidental | Confirms P0 no-go |

### 13.4 Production-enforcing test suite required

- Parser golden tests for each bureau/section/field plus failures, truncation, missing sections, conflicting values, and duplicate-looking obligations.
- Property tests: a value sourced from bureau A can never appear in bureau B output without an independent bureau B observation.
- Assessment tests for adverse-history monotonicity, completeness, conflicts, unknown presence, explicit product type, and positive controls.
- Identity tests for all six classifications, version pinning, staleness/reconfirmation, masking, authorization, and no automatic dispute.
- Claim-builder tests requiring a reachable observation and matching consumer assertion for every factual inaccuracy sentence.
- Strategy eligibility tests for recipient role, address, statute trigger, confirmation, enclosures, consolidation, and round prerequisites.
- Packet tests for multi-item CRA consolidation, recipient/type/address/policy/enclosure separation, tenant isolation, and deterministic ordering.
- Disposable-database migration/rollback tests, constraints, row-level authorization, concurrent version/approval/dispatch attempts, and legacy-unverified behavior.
- Canonical binary artifact tests: preview/download/print/fulfillment byte/hash equality, actual page count, font embedding, pagination, forbidden tokens, recipient-specific enclosures, tamper rejection, and stable rerender behavior.
- Security tests for cross-tenant/managed-client IDOR, decrypt-before-authorize failures, PII-free logs/events/analytics, signed artifact access, retention/erasure/tombstones, and orphan cleanup.
- Responsive/accessibility automation plus manual keyboard, screen-reader, zoom, dark/light, tablet, and mobile QA.

## 14. Responsive UX, theme, and accessibility plan

### 14.1 Current risks

- Small secondary text in the dark theme measures roughly 3.75–3.93:1 in affected views, below the project target for normal text; nested navy surfaces obscure hierarchy.
- Several light-theme brand/status combinations measure roughly 1.26–3.68:1, and mapping multiple dark ink tokens to white collapses surface depth.
- At tablet widths the fixed sidebar consumes about 240 px while dense rows, non-wrapping headers/actions, three-column bureau evidence, and fixed Kai controls compete for the remainder.
- Many controls are around 32 px, long Strategy/Tradeline panels remain desktop tables, and the letter builder keeps a fixed left column near the tablet breakpoint.
- The generated/print preview is not a faithful preview of the mailed artifact.

### 14.2 Remediation contract

- Replace palette aliases with semantic tokens for canvas, surface levels, text primary/secondary/muted, border, action, focus, danger, warning, and success; validate each theme independently.
- Target at least 4.5:1 for normal text, visible focus, non-color status cues, and 44 px primary touch targets.
- Below the large breakpoint, render tradelines, bureau evidence, mail packets, and letter actions as stacked cards with progressive disclosure; do not compress desktop tables.
- Give 768/820 px widths an intentional tablet layout, collapsible navigation, wrapping actions, and stable Kai placement; respect safe areas and 200% zoom.
- Separate dense legal explanation from primary facts/actions and preserve a clear “why flagged / what is uncertain / what you can do” hierarchy.
- Make artifact preview a view of the immutable canonical PDF, not a screen-only HTML approximation.

Acceptance matrix: 320, 375, 768, 820, 1024, and 1440 px; dark and light themes; keyboard-only; reduced motion; 200% zoom; automated accessibility scan; manual overflow, focus, screen-reader naming, and touch-target review.

# Compliance Review — CreditVector P0 Correctness Plan

**Reviewer:** AI-assisted internal compliance gate; outside counsel remains authoritative<br>
**Scope:** Credit intelligence projections, identity review, Strategy Desk, consumer correspondence, PDFs, packets, recipient resolution, fulfillment, and Mail Center evidence<br>
**Date:** 2026-08-08

## Verdict: NO-GO

## Findings

### [CRITICAL] Source truth is flattened and can produce false bureau claims — FCRA; FTC Act §5; CFPB UDAAP

- **Risk:** One bureau's status/date can be attributed to another, historical adverse evidence can disappear, and the UI can state Clean/no derogatory history despite contrary report evidence.
- **Required change:** Preserve immutable bureau/section/field observations and history; require completeness-aware assessments; prohibit cross-bureau fallback.
- **Compliant alternative:** Until v2 is verified, show `NEEDS_REVIEW`, bureau-scoped source fields, and no auto-generated factual claim.

### [CRITICAL] Dispute assertions lack source-bound consumer confirmation — FCRA; CROA; FTC Act §5; state CSO/UDAP

- **Risk:** The system can turn an observed negative, parser default, or model inference into an allegation of inaccuracy without the consumer adopting that exact claim.
- **Required change:** Require an immutable `ConsumerAssertion` bound to report version, bureau, account, field, observed value, and stated basis before generation.
- **Compliant alternative:** Kai may explain evidence and ask the consumer to review it, but must generate no inaccuracy assertion.

### [CRITICAL] Approved content, recipient, and mailing artifact can drift — FCRA operational integrity; FTC Act §5; CFPB UDAAP

- **Risk:** Regeneration overwrites drafts, profile/enclosure changes affect output, and fulfillment may resolve an address different from the one reviewed. The evidence record cannot prove exactly what was sent where.
- **Required change:** Append-only correspondence versions; immutable address and enclosure versions; canonical PDF/enclosure hashes pinned in an approved manifest; fulfillment uses only that manifest.
- **Compliant alternative:** Block mailing and label the package `NOT_READY` until a single reviewed version, recipient address, and artifact hash are fixed.

### [CRITICAL] Current PDF is not a canonical mailing artifact — FTC Act §5; CFPB UDAAP

- **Risk:** Browser metadata, app branding/footer content, unstable pagination, and a blank page can reach the recipient and differ across preview, download, print, and fulfillment.
- **Required change:** Deterministic server-generated PDF bytes, recipient-specific enclosure manifest, separate non-mailed guide, and hash equality across all delivery paths.
- **Compliant alternative:** Disable mailing/download-as-ready and expose a clearly marked draft preview until the canonical renderer passes artifact tests.

### [HIGH] Recipient-first packetization and address gating are not enforced — FCRA; FDCPA; FTC Act §5

- **Risk:** Current tradeline-first grouping can combine bureau recipients incorrectly, duplicate correspondence, or route a strategy to an unverified/missing address.
- **Required change:** Packetize by canonical recipient/type/address version/compatible policy/round/claim/enclosures; block incomplete addresses.
- **Compliant alternative:** Generate separate review-only drafts per verified recipient until the packetizer and resolver are authoritative.

### [HIGH] Strategy eligibility and statutory triggers are not encoded — FCRA; FDCPA

- **Risk:** Collector text asserts a cease-collection duty without proof of a timely written dispute, and the direct-furnisher path can cite duties whose trigger is CRA notice. Round 2 can introduce generic escalation or regulator threats without chronology.
- **Required change:** Versioned, counsel-approved eligibility/claim rules with required evidence and trigger facts per strategy. Section 1681s-2 distinguishes furnisher duties and CRA-notice investigation duties; direct-consumer rules must be modeled separately ([15 U.S.C. §1681s-2](https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title15-section1681s-2)).
- **Compliant alternative:** Use a neutral factual information request where a trigger is unknown, or block the strategy pending review.

### [HIGH] Identity discrepancies are auto-framed as disputes — FCRA; FTC Act §5; CFPB UDAAP

- **Risk:** Accurate former addresses, name variants, and employment can be presented as incorrect or “easy” disputes, encouraging unsupported claims.
- **Required change:** Consumer-classified, versioned identity baseline with no preselected inaccuracy and mixed-file escalation only when evidence/consumer input supports it.
- **Compliant alternative:** Present each fact neutrally as current, former, unknown, or review needed and ask the consumer.

### [HIGH] Evidence lifecycle and privacy controls are insufficiently durable — FCRA data security; FTC Safeguards/Act §5; state privacy duties

- **Risk:** Mutable/deletable records, PII-bearing bodies, derived mail status, and incomplete tenant/artifact controls undermine auditability and create exposure risk.
- **Required change:** Append-only refs-only ledger, encrypted artifacts/values, authorize-before-decrypt, tenant/client isolation, signed access, retention/erasure/tombstone policy, and concurrency controls.
- **Compliant alternative:** Keep fulfillment disabled and retain only the minimum encrypted, access-controlled review data until the durable model is approved.

## Launch recommendation

Do not launch the affected Credit Intelligence, Strategy Desk dispute-generation, identity-dispute, mailing-package, or fulfillment flows as correctness-certified. Keep the P0 gate closed. Resume implementation only after the additive migration and policy design are approved, then require parser/classifier, correspondence, artifact, security, accessibility, compliance, and adversarial gates to pass. Do not market the fixture guard or baseline green tests as remediation.

## Counsel escalation

Outside counsel should approve: (1) direct-furnisher eligibility and authority, including the distinction between direct disputes and CRA-notice duties; (2) FDCPA validation/cease language and timing evidence; (3) combined/multi-item correspondence and consumer-confirmation language; (4) goodwill, pay-for-delete, cease-and-desist, and regulator escalation policy; and (5) broader CROA and state Credit Services Organization registration, contract, fee-timing, disclosure, marketing, and cancellation posture before launch.

## 16. Adversarial review and unresolved risks

Agent J independently reviewed current production seams and the sanitized contract. The contract fixture is useful but cannot prove enforcement because it imports no production code. Existing tests remain green while explicitly pinning several wrong behaviors: a Clean predicate without history/completeness, tradeline-first mail grouping, in-place draft overwrite, and soft missing-address warnings.

| Severity | Unresolved risk | Closure evidence required |
|---|---|---|
| Critical | Bureau A value leaks into bureau B claim | Production property tests plus source-to-letter trace for every emitted factual clause |
| Critical | Historical adverse evidence collapses to Clean | Parser and assessment tests using normalized history/completeness, including positive controls |
| Critical | Unconfirmed/model-generated assertion reaches a letter | Schema constraint/API authorization and negative generation tests |
| Critical | Reviewed recipient/content differs from fulfilled artifact | Immutable version/address/artifact/enclosure manifest and binary-hash dispatch test |
| High | JSON v2 becomes another mutable blob | Normalized immutable records authoritative; projection digest/version tests |
| High | `CLEAN` is inferred from parser silence | Section-completeness state and failure/unknown tests |
| High | Packet key permits cross-tenant, cross-address, or incompatible grouping | Full key, database constraints, authorization and deterministic packet tests |
| High | Strategy legal triggers remain prose-only | Executable, policy-versioned eligibility rules and counsel approval |
| High | Migration/backfill creates invented truth or destroys v1 | Disposable-DB forward/rollback and legacy-unverified/reanalysis tests |
| High | PII leaks through logs, ledger, artifacts, or IDOR | Encryption, authorize-before-decrypt, refs-only events, cross-tenant and retention tests |
| High | Responsive/theme changes hide or distort correctness states | Viewport/theme/zoom/accessibility matrix with exact domain-state assertions |

Red-team verdict: **NO-GO**. No Critical or High item is closed by this analysis-only checkpoint.

## 17. Final acceptance gate status

| # | Acceptance condition | Current status |
|---:|---|---|
| 1 | Known report-vs-CreditVector regressions fixed | **NOT MET** |
| 2 | Historical derogatory evidence survives normalization | **NOT MET** |
| 3 | Clean classification is evidence-correct | **NOT MET** |
| 4 | Bureau isolation enforced | **NOT MET** |
| 5 | Consumer-confirmed dispute basis required | **NOT MET** |
| 6 | Consolidated bureau packets work | **NOT MET** |
| 7 | Incompatible recipients remain separate | **NOT DURABLY ENFORCED** |
| 8 | Addresses auto-resolve or block mailing readiness | **NOT MET** |
| 9 | Canonical PDFs are mailing-ready | **NOT MET** |
| 10 | CreditVector-only guidance is outside consumer correspondence | **NOT MET** |
| 11 | Packet checklist/enclosures are recipient-aware | **NOT MET** |
| 12 | Correspondence versions are preserved | **NOT MET** |
| 13 | Evidence ledger is auditable | **NOT MET** |
| 14 | Mail Center is recipient/round aware | **NOT MET** |
| 15 | Mobile/iPad layout is usable without overlap | **NOT MET** |
| 16 | Dark-theme readability improves | **NOT MET** |
| 17 | Light theme passes its own usability review | **NOT MET** |
| 18 | All Critical/High red-team findings closed | **NOT MET** |
| 19 | Existing M2/production behavior unaffected | **VERIFIED FOR THIS CHECKPOINT ONLY**; must be rerun after implementation |

**Gate result: 0 launch-complete, 1 checkpoint-only preservation control, 18 unmet. P0 remains NO-GO.**

## 18. Decisions, owner checkpoint, and next actions

### Decisions made in this checkpoint

1. Preserve source truth in immutable normalized observations/history; use JSON v2 only as a versioned shadow projection.
2. Separate `AccountCondition`, `DisputeGrounds`, and `ReportedAdversity`; do not imply a score outcome.
3. Require exact-field consumer confirmation for every dispute assertion.
4. Introduce versioned Round 0 identity baseline and pin it to correspondence.
5. Group recipient-first with a complete compatibility key; never use underlying debt identity as proof of duplicate reporting.
6. Make correspondence, addresses, artifacts, enclosure manifests, and ledger events immutable/versioned.
7. Replace browser print with one deterministic canonical PDF.
8. Treat current baseline tests as regression visibility, not correctness certification.
9. Keep M2 isolated and stop before schema or production mutation.

### Founder approvals required to resume

- Approve the additive migration design and a disposable-database implementation slice; this does not authorize production application.
- Authorize outside-counsel review of the strategy matrix and consumer-confirmation language.
- Select/approve the encrypted canonical artifact storage and deterministic renderer approach.
- Approve the legacy `LEGACY_UNVERIFIED` and source-report reanalysis/backfill policy before any production reprocessing.
- Confirm rollout ownership and the requirement that all Critical/High gates pass before enabling correspondence or fulfillment.

### Immediate next checkpoint after approval

Produce the additive migration/schema, threat model, executable strategy-policy schema, and parser-v2 shadow contract in isolated files; validate on a disposable database; rerun the ten production-linked invariants; then return for Founder, compliance, and red-team review before any production access, backfill, merge, deploy, or M2 interaction.
