# CREDITVECTOR P0 — Trusted-Writer Closure Founder Checkpoint

**Date:** August 11, 2026

**Accepted base:** `10d438df539056e043a6adbe046820cdb3947cb8`

**Branch:** `codex/p0-launch-correctness`

**Checkpoint state:** **EXACT-FINAL SOURCE FROZEN — LOCAL CHECKPOINT AUTHORIZED**

**Trusted-writer status:** **CLOSED LOCALLY / PRE-ACTIVATION PROVEN**

## Executive result

The Founder-authorized narrow privileged-validator design is implemented and
has passed its static and disposable PostgreSQL proof. The boundary contains
exactly 24 `SECURITY DEFINER` trigger validators and four owner-only
`SECURITY INVOKER` helpers. They are owned by a dedicated NOLOGIN role, use one
fixed search path, contain no dynamic SQL or data mutation, expose no direct
application/PUBLIC execution, and receive only the table reads and row-lock
privileges required by the accepted P0 validators. The application writer
still has no broad `UPDATE` authority.

Two pristine PostgreSQL 16.14 passes completed the legitimate real-adapter
path, the original `20/20` attack matrix, the privileged-boundary `15/15`
attack extension, atomic late-audit rollback, rollback, concurrency, exact
`40P01`, reconstruction, and teardown. Exact-current behavioral regression
passed `604/604`, compatibility passed `7/7`, and the exact-final
trusted-writer component/static matrix passed `670/670`.

The exact-final implementation uses a dedicated role-bound Prisma client,
validates both `current_user` and `session_user` inside every authority
transaction, and truthfully attests a versioned value-protection keyring—not
deployed managed-KMS custody. The exact-final source independently earned
`C0 / H0 / M0 / L0`. This closes the trusted-writer semantic gate locally;
it does not authorize deployment, activation, production access, or any of the
separate pre-activation dependencies listed below.

## 1. Status

**CLOSED LOCALLY / PRE-ACTIVATION PROVEN.**

| Gate | Current evidence |
|---|---|
| Authorized privileged-validator boundary | IMPLEMENTED |
| Boundary static audit | `332/332 PASS` |
| Two exact-final pristine PostgreSQL 16.14 passes | `2/2 PASS` |
| Original real-adapter attacks | `20/20 PASS` in each pristine pass |
| Privileged-boundary attacks | `15/15 PASS` in each pristine pass |
| Exact-current behavioral regression | `604/604 PASS` |
| Exact-current compatibility | `7/7 PASS` |
| Trusted-writer component/static matrix | `670/670 PASS` |
| Fresh exact-final adversarial verdict | **`C0 / H0 / M0 / L0`** |
| Local checkpoint | **AUTHORIZED; containing commit SHA is reported in the final git receipt** |
| Production activation | **NOT AUTHORIZED** |

## 2. Accepted base

| Fact | Exact value |
|---|---|
| Accepted Phase 2A commit | `10d438df539056e043a6adbe046820cdb3947cb8` |
| Parent | `4bbdf5c561f94a132962d27971551096b53528d9` |
| Historical Phase 1/1.1 | `515/515 PASS` |
| Historical Phase 2A | `218/218 PASS` |
| Historical accepted aggregate | `733/733 PASS` |

The historical `733/733` result remains frozen accepted evidence. It is not
relabeled as an exact-current trusted-writer result.

## 3. Exact privileged-function inventory

### Boundary-wide properties

- Schema: `public` for all 28 routines.
- Final owner: `p0_validator_owner` for all 28 routines.
- Owner attributes: `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`,
  `NOINHERIT`, `NOREPLICATION`, `NOBYPASSRLS`, no memberships, no members.
- Security class: exactly 24 `SECURITY DEFINER` trigger entry points and four
  `SECURITY INVOKER` helpers.
- Search path: exactly `pg_catalog, public, pg_temp` on every routine.
- Mutation capability: none. The frozen bodies contain no dynamic `EXECUTE`,
  `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE`; they only read, row-lock,
  validate, return, or raise.
- Execution: `PUBLIC` and the application writer have no direct `EXECUTE`;
  only `p0_validator_owner` has explicit `EXECUTE`.
- Intended path: application mutation → registered exact trigger → exact
  validator → bounded integrity reads/locks.

`FU` means `FOR UPDATE`; `KS` means `FOR KEY SHARE`. “Via helper” identifies
an owner-only invoker helper called from the definer validator.

### 24 `SECURITY DEFINER` trigger validators

| # | Exact signature | Tables read | Tables locked | Registered trigger caller(s) | Why privileged execution is necessary |
|---:|---|---|---|---|---|
| 1 | `public.p0_validate_artifact_seal()` | `Artifact`, `ArtifactCorrespondenceVersion` | `Artifact` FU | `Artifact.Artifact_seal_count_trg` | Locks the immutable parent while proving sealed membership count. |
| 2 | `public.p0_validate_report_account_subject()` | `ReportVersion`, `ReportVersionAccount`, `ReportComparison` | `ReportVersion` FU | `ReportVersionAccount.ReportVersionAccount_validate_subject_trg` | Locks the immutable version while proving exact report/account scope. |
| 3 | `public.p0_reject_post_assessment_account_input()` | `DerivedAccountAssessment`, plus helper reads | `ExtractionRun` FU and `ReportVersionAccount` FU via helpers | `AccountPresenceObservation.AccountPresenceObservation_sealed_input_trg`; `FieldObservation.FieldObservation_sealed_input_trg`; `HistoricalEvidence.HistoricalEvidence_sealed_input_trg`; `SectionCompleteness.SectionCompleteness_sealed_input_trg` | Preserves assessment-input immutability without giving the writer update authority. |
| 4 | `public.p0_reject_post_assessment_coverage()` | `DerivedAccountAssessment`, plus helper reads | `ExtractionRun` FU via helper | `ExtractionBureauCoverage.ExtractionBureauCoverage_sealed_input_trg` | Serializes coverage sealing against the exact extraction run. |
| 5 | `public.p0_validate_credit_score_insert()` | `CreditScoreObservation`, plus helper reads | `ExtractionRun` FU via helper | `CreditScoreObservation.CreditScoreObservation_validate_insert_trg` | Serializes score evidence against extraction/comparison seals. |
| 6 | `public.p0_reject_post_comparison_identity_input()` | `ReportVersion`, `ReportComparison` | `ReportVersion` FU | `IdentityBaseline.IdentityBaseline_comparison_input_seal_trg`; `IdentityFact.IdentityFact_comparison_input_seal_trg` | Locks the immutable version while rejecting post-comparison identity input. |
| 7 | `public.p0_2a_validate_extraction_input()` | `Artifact` | `Artifact` KS | `ExtractionRun.ExtractionRun_input_artifact_trg` | Pins the exact normalized Artifact during extraction-input validation. |
| 8 | `public.p0_2a_validate_score_model_evidence()` | `ExtractionRun` | `ExtractionRun` KS | `CreditScoreObservation.CreditScoreObservation_model_evidence_trg` | Pins the exact run while validating score-model provenance. |
| 9 | `public.p0_2a_validate_bureau_report_date()` | `ExtractionRun` | `ExtractionRun` KS | `BureauReportDateEvidence.BureauReportDateEvidence_validate_trg` | Pins the exact run while validating bureau date provenance. |
| 10 | `public.p0_2a_validate_round0_source_completeness()` | `ReportVersion`, `ExtractionRun` | `ReportVersion` FU; `ExtractionRun` KS | `Round0SourceCompletenessEvidence.Round0SourceCompletenessEvidence_validate_trg` | Serializes the immutable version/source seal and pins its run. |
| 11 | `public.p0_2a_validate_identity_baseline_source_seal()` | `ExtractionRun`, `ReportIngestion`, `Artifact` | all three KS | `IdentityBaseline.IdentityBaseline_source_seal_trg` | Pins exact run, ingestion, and source artifact as one baseline source set. |
| 12 | `public.p0_2a_validate_round0_source_seal_deferred()` | `ExtractionRun`, `IdentityBaseline`, `IdentityBaselineAccountReviewMembership`, `ConsumerAccountReviewReceipt`, `ExtractionBureauCoverage`, `IdentityCategoryCompletion`, `IdentityFact`, `Round0SourceCompletenessEvidence`, `AccountPresenceObservation`, `ReportVersionAccount` | `ExtractionRun` KS; `IdentityBaseline` FU; joined membership/receipt rows FU | `AccountPresenceObservation.AccountPresenceObservation_round0_membership_deferred_trg`; `IdentityBaseline.IdentityBaseline_round0_manifest_deferred_trg`; `IdentityFact.IdentityFact_round0_source_membership_deferred_trg`; `ReportVersionAccount.ReportVersionAccount_round0_source_membership_deferred_trg`; `Round0SourceCompletenessEvidence.Round0SourceCompletenessEvidence_manifest_deferred_trg`; `Round0SourceCompletenessEvidence.Round0SourceCompletenessEvidence_membership_deferred_trg` | Preserves both insertion orders while serializing the complete Round 0 source seal. |
| 13 | `public.p0_2a_validate_report_ingestion_mutation()` | `ReportVersion`, `Artifact`, `ExtractionRun` | all three KS | `ReportIngestion.ReportIngestion_state_cas_trg` | Pins exact immutable report/source/run links during the only mutable P0 projection CAS. |
| 14 | `public.p0_2a_validate_identity_fact_insert()` | `ReportVersion`, `IdentityBaseline`, `ExtractionBureauCoverage`, `IdentityCategoryCompletion`, `IdentityFact`, `Round0SourceCompletenessEvidence` | `ReportVersion` FU; `IdentityBaseline` FU | `IdentityFact.IdentityFact_round0_category_trg` | Serializes fact insertion against version and baseline completion. |
| 15 | `public.p0_2a_validate_identity_category_completion()` | `ReportVersion`, `IdentityBaseline`, `ExtractionRun`, `IdentityFact`, `ReportVersionAccount`, `ExtractionBureauCoverage`, `Round0SourceCompletenessEvidence` | `ReportVersion` FU; `IdentityBaseline` FU; `ExtractionRun` KS | `IdentityCategoryCompletion.IdentityCategoryCompletion_no_fact_trg` | Serializes category completion against its exact fact/source population. |
| 16 | `public.p0_2a_reject_account_presence_after_source_completeness()` | `ReportVersion`, `ReportVersionAccount`, `AccountPresenceObservation`, `Round0SourceCompletenessEvidence` | `ReportVersion` FU | `AccountPresenceObservation.AccountPresenceObservation_round0_source_membership_trg` | Stops late source-membership drift after completeness is sealed. |
| 17 | `public.p0_2a_reject_account_after_identity_completion()` | `ReportVersion`, `IdentityCategoryCompletion`, `Round0SourceCompletenessEvidence` | `ReportVersion` FU | `ReportVersionAccount.ReportVersionAccount_round0_category_trg` | Stops late account membership after identity completion. |
| 18 | `public.p0_2a_validate_identity_correspondence_assertion()` | `IdentityBaseline`, `IdentityBaselineAccountReviewMembership`, `ConsumerAccountReviewReceipt`, `IdentityFact`, `IdentityCorrespondenceAssertion` | baseline and assertion FU; membership/receipt and facts KS | `IdentityCorrespondenceAssertion.IdentityCorrespondenceAssertion_validate_trg` | Serializes correspondence authority against exact baseline, fact, and review authority. |
| 19 | `public.p0_2a_validate_consumer_account_review()` | `IdentityBaseline`, `ExtractionRun`, `ReportVersionAccount`, `AccountPresenceObservation`, `Round0SourceCompletenessEvidence`, `IdentityCategoryCompletion`, `ConsumerAccountReviewReceipt` | baseline and receipt FU; run/account/presence/completeness KS | `ConsumerAccountReviewReceipt.ConsumerAccountReviewReceipt_validate_trg` | Prevents review authority from racing source membership or baseline state. |
| 20 | `public.p0_2a_validate_identity_baseline_account_review_membership()` | `IdentityBaseline`, `ConsumerAccountReviewReceipt` | baseline KS; receipt FU | `IdentityBaselineAccountReviewMembership.IdentityBaselineAccountReviewMembership_validate_trg` | Pins baseline and serializes the exact review receipt membership. |
| 21 | `public.p0_2a_validate_confirmed_baseline_child_deferred()` | `IdentityBaseline`, `IdentityBaselineAccountReviewMembership`, `IdentityCategoryCompletion`, `IdentityFact` | `IdentityBaseline` KS | `IdentityBaselineAccountReviewMembership.IdentityBaselineAccountReview_confirmed_parent_deferred_trg`; `IdentityCategoryCompletion.IdentityCategoryCompletion_confirmed_parent_deferred_trg`; `IdentityFact.IdentityFact_confirmed_parent_deferred_trg` | Ensures a confirmed baseline cannot commit with incomplete children. |
| 22 | `public.p0_2a_validate_case_action_decision()` | `CaseActionDecision` | `CaseActionDecision` FU | `CaseActionDecision.CaseActionDecision_validate_trg` | Serializes decision row/source-count sealing. |
| 23 | `public.p0_2a_validate_case_action_source_ref()` | `CaseActionDecision`, `FieldObservation`, `DerivedAccountAssessment`, `ConsumerAssertion`, `ConsumerAccountReviewReceipt`, `IdentityFact`, `IdentityBaseline`, `IdentityCorrespondenceAssertion`, `IdentityCategoryCompletion`, `IdentityBaselineAccountReviewMembership` | source-dependent KS/FU locks, including decision KS, assertion/receipt/correspondence FU, evidence KS, and baseline FU/KS | `CaseActionSourceRef.CaseActionSourceRef_validate_trg` | Pins each exact source authority row while rejecting cross-scope or non-authoritative refs. |
| 24 | `public.p0_2a_validate_case_action_source_membership()` | `CaseActionDecision`, `CaseActionSourceRef`, `ConsumerAssertion`, `IdentityCorrespondenceAssertion` | `CaseActionDecision` FU | `CaseActionDecision.CaseActionDecision_source_membership_trg`; `CaseActionSourceRef.CaseActionSourceRef_source_membership_trg` | Serializes exact source membership/count closure for action authority. |

### Four owner-only `SECURITY INVOKER` helpers

| # | Exact signature | Tables read | Tables locked | Exact callers | Why it is inside the sealed boundary |
|---:|---|---|---|---|---|
| 25 | `public.p0_lock_extraction_run(text,text,text,text)` | `ExtractionRun` | `ExtractionRun` FU | `p0_lock_assessment_input`; `p0_reject_post_assessment_coverage`; `p0_validate_credit_score_insert` | Central exact-run lock. It remains invoker, but ownership, body, search path, and EXECUTE are sealed so it is usable only inside an authorized definer chain. |
| 26 | `public.p0_lock_assessment_input(text,text,text,text,text)` | `ExtractionRun`, `ReportVersionAccount` | both FU | `p0_reject_post_assessment_account_input`; `p0_validate_assessment_insert` | Central lock order for run then report-account; no independent elevation. |
| 27 | `public.p0_reject_if_run_is_compared(text,text,text,text)` | `ReportComparison` | none; caller already holds exact run lock | `p0_reject_post_assessment_account_input`; `p0_reject_post_assessment_coverage`; `p0_validate_credit_score_insert` | Shared comparison-seal check; direct application invocation is forbidden. |
| 28 | `public.p0_2a_identity_fact_matches_category(public."IdentityFactType",public."IdentityReviewCategory",public."IdentityReviewCategory")` | none | none | `p0_2a_validate_identity_fact_insert`; `p0_2a_validate_identity_category_completion` | Pure category predicate whose identity/body must not be substituted. |

No convenience routine was promoted. The broader trusted-chain audit separately
pins 30 authority tables, 87 non-internal triggers, and all 37 distinct trigger
functions, so a differently named or non-`p0` trigger cannot hide outside the
28-routine privileged allowlist.

## 4. Owner and NOLOGIN proof

The install contract refuses to create, repair, or broaden the owner. It
requires the pre-existing exact role `p0_validator_owner` and fails unless:

- `rolcanlogin=false`;
- superuser, database creation, role creation, inheritance, replication, and
  RLS bypass are all false;
- it has no role memberships and no members;
- it owns no database, user schema, table, sequence, or unrelated type/routine;
- the application writer is neither the owner nor a member and cannot
  `SET ROLE` to it;
- the installer is distinct from both the writer and validator owner.

Runtime attack evidence confirmed writer `SET ROLE p0_validator_owner` returns
SQLSTATE `42501`, the owner remains NOLOGIN, and the writer has zero role
memberships or per-role settings.

## 5. Fixed search-path proof

Every one of the 28 routines has exactly one configuration entry:

`search_path=pg_catalog, public, pg_temp`

The contract checks the exact `proconfig`, not mere containment. The static
audit rejects dynamic SQL and caller-controlled object dispatch. Runtime probes
proved that a hostile caller search path, temporary-schema shadow table, and a
same-name public function cannot change resolution. Search-path drift is
detected by the signed catalog attestation and rolled back.

## 6. Execution-grant proof

- `REVOKE ALL PRIVILEGES ... FROM PUBLIC, <application-writer>` is applied to
  every exact routine.
- Only `p0_validator_owner` receives explicit `EXECUTE` on those routines.
- No direct execute is required for PostgreSQL trigger invocation.
- Runtime direct calls as the application writer: `28/28` denied with
  SQLSTATE `42501`.
- Runtime direct calls as a PUBLIC-only probe role: `28/28` denied with
  SQLSTATE `42501`.
- Registered triggers nevertheless completed the legitimate report/version,
  graph, reconstruction, and replay path.

## 7. Exact validator-owner privilege matrix

### Allowed final privileges

| Surface | Exact final authority |
|---|---|
| Role attributes | NOLOGIN, non-admin, NOINHERIT, no memberships |
| Schema | `USAGE` on `public` only; final `CREATE` revoked |
| Tables | `SELECT` on exactly 22 tables listed below |
| Row-lock enabler | column `UPDATE("id")` on exactly 16 tables listed below |
| Routines | owns and may execute exactly the 28 frozen validator/helper routines |

Exact 22-table `SELECT` set:

`AccountPresenceObservation`, `Artifact`, `ArtifactCorrespondenceVersion`,
`CaseActionDecision`, `CaseActionSourceRef`,
`ConsumerAccountReviewReceipt`, `ConsumerAssertion`,
`CreditScoreObservation`, `DerivedAccountAssessment`,
`ExtractionBureauCoverage`, `ExtractionRun`, `FieldObservation`,
`IdentityBaseline`, `IdentityBaselineAccountReviewMembership`,
`IdentityCategoryCompletion`, `IdentityCorrespondenceAssertion`,
`IdentityFact`, `ReportComparison`, `ReportIngestion`, `ReportVersion`,
`ReportVersionAccount`, `Round0SourceCompletenessEvidence`.

Exact 16-table `UPDATE("id")` set, used only to satisfy PostgreSQL row-lock
privilege checks:

`AccountPresenceObservation`, `Artifact`, `CaseActionDecision`,
`ConsumerAccountReviewReceipt`, `ConsumerAssertion`,
`DerivedAccountAssessment`, `ExtractionRun`, `FieldObservation`,
`IdentityBaseline`, `IdentityCategoryCompletion`,
`IdentityCorrespondenceAssertion`, `IdentityFact`, `ReportIngestion`,
`ReportVersion`, `ReportVersionAccount`,
`Round0SourceCompletenessEvidence`.

### Explicitly absent

- no `INSERT`, table-level/broad `UPDATE`, other-column `UPDATE`, `DELETE`,
  `TRUNCATE`, `REFERENCES`, or `TRIGGER`;
- no sequence privilege;
- no schema mutation in final state;
- no unrelated routine execution or object ownership;
- no superuser, `CREATEDB`, `CREATEROLE`, replication, `BYPASSRLS`, or role
  delegation;
- no Phase 2B authority.

The application writer keeps its independent exact least-privilege allowlist.
It receives neither the validator-owner role nor broad immutable-evidence
`UPDATE`. Its attempt to update `ReportVersion.authorityStatus` returned
SQLSTATE `42501` and left the durable value unchanged.

**Local role contract:** proven in disposable PostgreSQL.

**Deployed role attestation:** still a future infrastructure gate; local proof
does not attest a deployed role.

## 8. Exact function-body hashes

All rows below have owner `p0_validator_owner`, fixed search path
`pg_catalog, public, pg_temp`, owner-only `EXECUTE`, and no mutation body.

| Exact signature | Security | SHA-256 of `prosrc` source body |
|---|---|---|
| `public.p0_validate_artifact_seal()` | DEFINER | `1d608a8f885dc0b0c1966284a5592f997074bf81f6ff5fae095083315ace7759` |
| `public.p0_validate_report_account_subject()` | DEFINER | `17a0c43aca18f98ed07a8df12185beb0350539a01fa65b97a6561f204619605a` |
| `public.p0_reject_post_assessment_account_input()` | DEFINER | `3b9a5e5c2b0d8daed5850306de0e2a8d383847db98907cf9b13d39331f750923` |
| `public.p0_reject_post_assessment_coverage()` | DEFINER | `661786850fcaeeff24d5865595d5d56b5a73d6f1c5c997965283bed700eb260f` |
| `public.p0_validate_credit_score_insert()` | DEFINER | `5e814b4b1e315b89dcee488503e3670d33e47dfd2ce08a9f16cadf9a07fad3ba` |
| `public.p0_reject_post_comparison_identity_input()` | DEFINER | `6980f52fef7531727c3e4315b99204b388f8b45415af8d0a90d4536d4d2ec861` |
| `public.p0_2a_validate_extraction_input()` | DEFINER | `310db03be26e73f6e9cdd3e38b6f18095efbc2404804371160f85d5efa98b8ea` |
| `public.p0_2a_validate_score_model_evidence()` | DEFINER | `45267e4a7b04080a4af65f07eb1a6b92bcc625d3ac3316e828957fe242dd801f` |
| `public.p0_2a_validate_bureau_report_date()` | DEFINER | `f7288d1057824cf3cf71cc489b29a1d1a6a666462feb1efd704864e7c6c229c9` |
| `public.p0_2a_validate_round0_source_completeness()` | DEFINER | `f32135f3eda156e4e1b24defab93ff11784e2cf5a00ef8e359179fd3889333a5` |
| `public.p0_2a_validate_identity_baseline_source_seal()` | DEFINER | `3fd2e45195a3e21da7e6bf69eb10595e76526ecabe5f72c8c07bf5ad1f8442f5` |
| `public.p0_2a_validate_round0_source_seal_deferred()` | DEFINER | `be3ab78770b6e552689265a4c47d00ec79994de863cdee2b47c3d9d30956573a` |
| `public.p0_2a_validate_report_ingestion_mutation()` | DEFINER | `3f226333428af5761f279ffa0a57c56e5cefc18c90a619b565b92b2aee270105` |
| `public.p0_2a_validate_identity_fact_insert()` | DEFINER | `a0e1045e7dd2addbce6396bc45151cfbf1a18ccd7712f661fdf81ced2c538268` |
| `public.p0_2a_validate_identity_category_completion()` | DEFINER | `8e846b9ef7af667d3f94e3a5b8bb514ef4905c1ddc8e30ced7167efca711e043` |
| `public.p0_2a_reject_account_presence_after_source_completeness()` | DEFINER | `cb02f7e087241c27d3ece5f110709ba535a24c5e3c6e998ddb2e49fe957332b1` |
| `public.p0_2a_reject_account_after_identity_completion()` | DEFINER | `adf17da0fefc0c85423647e336f33190ca7db3dd0f5c5360d9ad8df18f235895` |
| `public.p0_2a_validate_identity_correspondence_assertion()` | DEFINER | `655e06940782b9834fa647bcbbfdbd6be55262e686054aac51001cfd9b05d425` |
| `public.p0_2a_validate_consumer_account_review()` | DEFINER | `ebb9cb1589d6d9e86057e2174cfe55147fc7082d8189dca8d8181311cbf29382` |
| `public.p0_2a_validate_identity_baseline_account_review_membership()` | DEFINER | `9634f4ddece91e54e534fc898fe537d4bfcba5a64e76e77f730a4944de4c6fb6` |
| `public.p0_2a_validate_confirmed_baseline_child_deferred()` | DEFINER | `7bf3ddc8ef72c03a0f1b10cb9d0307a4c7e933fe959e1004d4e780a2724f567d` |
| `public.p0_2a_validate_case_action_decision()` | DEFINER | `ef3d13ac3d1b87a5cccfc6df2d27789ddd39b6c974e7dc0f9ce3e06e5f22eceb` |
| `public.p0_2a_validate_case_action_source_ref()` | DEFINER | `4ae00541347da78825e33ec30d4589608b866c7fc0e77e8291919f4f08bafd1f` |
| `public.p0_2a_validate_case_action_source_membership()` | DEFINER | `ceef5ade280fdc45eaa36e74002e66e3b94408a44a8c992090e2a438eaf8314b` |
| `public.p0_lock_extraction_run(text,text,text,text)` | INVOKER helper | `04988bd7d94cbd3a0cf100467354fbfc675ef4509ce1dc11f463a85e82139368` |
| `public.p0_lock_assessment_input(text,text,text,text,text)` | INVOKER helper | `5a1845a681a657babcae257c5a4042392c5611c3a2d93474adc738cd3af3c066` |
| `public.p0_reject_if_run_is_compared(text,text,text,text)` | INVOKER helper | `6925e3418574288ceefc7a17bb3d95b443f8a135e61ec1a3277788de10e9c485` |
| `public.p0_2a_identity_fact_matches_category(public."IdentityFactType",public."IdentityReviewCategory",public."IdentityReviewCategory")` | INVOKER helper | `9c35391788b30fe188cc1308273b7db026d310548841855f9716ed24e3c9dbcb` |

The readiness receipt binds the exact privileged-validator catalog manifest.
The exact-final pristine passes produced:

`65ee818e8b987424fd03bf582cd03dbcec36795bd7fd2af6d533ef959f0c7253`

That manifest covers the 28 privileged routines, all 37 trigger-function
definitions, and all 87 exact trigger edges. It must be re-earned if any bound
source changes.

## 9. Static privileged-surface audit

`332/332 PASS`

The deterministic audit proves:

- exactly 24 definers and four invoker helpers;
- exact source SHA-256 and runtime MD5 receipts;
- exact owner, security class, fixed search path, and ACL for every routine;
- no unexpected overload or extra privileged routine;
- no dynamic SQL, mutation statement, caller-controlled identifier dispatch,
  or Phase 2B routine;
- exact 22-table read and 16-column-lock privilege unions;
- no owner object, schema, table, column, sequence, routine, membership, or
  default-ACL drift across non-system schemas;
- exact 30-table/87-trigger/37-function authority surface, including
  differently named trigger functions;
- the application writer still lacks broad immutable-evidence update authority.

Migration/role/static guard: `153/153 PASS`. Writer-surface audit:
`58/58 PASS`. The role contract is atomic: a deliberately seeded late-audit
failure produced a byte-identical before/after authorization-state fingerprint
on both the primary and pristine-rebuild databases before normal application.

## 10. Positive real-adapter result

The real disposable path used the concrete principal adapter, worker adapter,
Prisma repositories, transaction/readback logic, immutable source storage,
value protection, parser identity, provenance, readiness, route composition,
and PostgreSQL trigger/role boundaries.

| Positive path | Observed durable result |
|---|---|
| Dormant/default-off route | production factory hard-null without exact server gates; legacy behavior unchanged |
| Authenticated direct principal | server session derived; exact tenant/consumer scope accepted |
| Managed scope | accepted only inside callback-scoped disposable route with live grant |
| Worker continuation | separately branded/scoped worker accepted; stale worker rejected |
| Source ingestion | server digest, encrypted immutable source object, readback, and audit persisted |
| ReportVersion/source Artifact | exact version, source identity, byte length, and digest committed/read back |
| Parser execution | deployment-owned ID/version/source hash/signature accepted |
| PRESENT/source-reported graph | exact account membership and graph persisted; `ABSENT_CONFIRMED` remained non-authoritative |
| Historical evidence | durable coarse kinds plus protected exact `PAYMENT_DELINQUENCY`, `FIRST_DELINQUENCY_DATE`, and `CHARGE_OFF` detail recovered |
| Credit score | durable model/provenance metadata and protected score `704` recovered |
| Transactional readback | persisted identity/scope/provenance/digests matched before authority returned |
| Replay/idempotency | exact reservation/source replay returned explicit idempotent result without duplicate rows |
| Reconstruction | exact durable graph/source state reconstructed successfully |
| Readiness | signed dormant receipt bound source/config/schema/verifier/adapter/safety/privileged manifest identities |

A post-write graph-attestation mismatch was induced inside the real repository
transaction; all newly attempted graph rows rolled back and the pre-existing
account count remained unchanged. A protected source authorization was revoked
between authorization and read; same-transaction live revalidation denied the
read.

## 11. Original 20-attack matrix

All 20 attacks executed against the concrete real-adapter path in each pristine
pass. Component tests were not substituted.

| # | Setup and attack | Expected result | Observed and durable database result | Result |
|---:|---|---|---|---|
| 1 | Authenticated route; caller supplies `authorityStatus=PRESENT`. | Ignore caller authority; server derives `SHADOW_V2`. | Route accepted; durable ReportVersion authority was `SHADOW_V2`; no caller-created run. | PASS |
| 2 | Same route; caller supplies forged all-`f` digest. | Recompute from exact bytes. | Ingestion and source-object digests both equaled the server SHA-256, not the caller value. | PASS |
| 3 | Valid session selects another consumer's report. | Deny with no cross-tenant row. | Route failed; ingestion and ReportVersion counts were unchanged. | PASS |
| 4 | Valid tenant/worker substitutes wrong ReportVersion in real extraction-input repository. | Deny before Artifact creation. | Repository returned `DENIED`; Artifact count unchanged. | PASS |
| 5 | Valid report commit substitutes a branded normalized source for original source. | Deny source identity substitution. | Repository returned `DENIED`; singular existing ReportVersion unchanged. | PASS |
| 6 | Signed parser attempts membership from `ABSENT_CONFIRMED`. | Fail closed with no authority. | Graph rejected; ExtractionRun and ReportVersionAccount counts unchanged. | PASS |
| 7 | Persist parser-uncertain `UNKNOWN`, then request confirmed review authority. | No review source/receipt. | Review source returned null; `ConsumerAccountReviewReceipt` count unchanged. | PASS |
| 8 | Retry same idempotency/operation with changed source digest. | Explicit conflict, no semantic drift. | `IDEMPOTENCY_CONFLICT`; ReportIngestion count unchanged. | PASS |
| 9 | Replay exact original reservation. | Explicit idempotent replay, one durable row. | `IDEMPOTENT_REPLAY`; ReportIngestion count unchanged. | PASS |
| 10 | Two valid worker tokens concurrently claim revision 1. | Exactly one winner. | One claim succeeded; durable attempt count `1`, revision `2`, one lease. | PASS |
| 11 | Insert valid scope then throw before commit. | Full rollback. | Synthetic interruption observed; durable `CreditTruthScope` count `0`. | PASS |
| 12 | Call concrete repository directly with genuine permit but cross-tenant context/resource. | Repository-level denial. | `DENIED`; ReportIngestion count unchanged. | PASS |
| 13 | Writer raw-inserts extra `SOURCE_LISTED` membership after a sealed UNKNOWN set. | Role/trigger denial and rollback. | Database denied; ReportVersionAccount count unchanged. | PASS |
| 14 | Submit expired, otherwise valid parser execution receipt. | Receipt null; no graph. | `UNVERIFIED_TRUSTED_PARSER_EXECUTION`; ExtractionRun count unchanged. | PASS |
| 15 | Signed parser candidate substitutes normalized-source hash. | Reject hash mismatch. | Receipt verifier returned null; graph rejected; run count unchanged. | PASS |
| 16 | Reserve version 1 after a newer accepted version 2 exists. | Stale-version conflict. | `STALE_REPORT_VERSION`; no version-1 row inserted; count unchanged. | PASS |
| 17 | Authoritative report-date evidence carries null provenance. | Fail closed. | Envelope unverified; graph rejected; ExtractionRun count unchanged. | PASS |
| 18 | Direct graph repository call uses a reconstructed/spread writer-authority object. | Process-local brand denial. | Repository returned `DENIED`; ExtractionRun count unchanged. | PASS |
| 19 | Writer raw-updates sealed FieldObservation integrity digest. | Database denial; digest unchanged. | Update denied; durable digest remained byte-for-byte identical. | PASS |
| 20 | In production mode, reach deterministic crypto/disposable installer/factory. | All dev/test/admin seams unavailable. | Crypto and installer threw; production factory remained null; ingestion/version counts unchanged. | PASS |

## 12. `SECURITY DEFINER`-specific attack results

| # | Attack | Observed durable result | Result |
|---:|---|---|---|
| 1 | Directly call all 28 routines as writer and PUBLIC probe. | writer `28/28` and PUBLIC `28/28` returned `42501`; registered route/graph triggers remained usable. | PASS |
| 2 | Writer `SET ROLE` owner and `SET session_replication_role=replica`. | Both `42501`; fresh session remained `origin`; zero membership/GUC authority. | PASS |
| 3 | Poison search path; create temporary shadow table and same-name public function. | Direct call/temp/function substitution all `42501`; manifest unchanged. | PASS |
| 4 | Pass SQL-shaped text as helper identifier arguments. | Direct helper call `42501`; report-version count unchanged. | PASS |
| 5 | Replace a definer body in rollback-only admin transaction. | Hash drift detected; rollback restored exact body/manifest. | PASS |
| 6 | Change function owner in rollback-only transaction. | Owner drift detected; rollback restored `p0_validator_owner`. | PASS |
| 7 | Alter fixed search path. | Exact `proconfig` drift detected and rolled back. | PASS |
| 8 | Grant writer direct validator `EXECUTE`. | ACL/effective-authority drift detected and rolled back. | PASS |
| 9 | Attach differently named definer trigger to ReportVersion. | Exact trigger graph rejected it; trigger/routine absent after rollback. | PASS |
| 10 | Replace accepted invoker append-only trigger body. | 37-function source manifest detected drift; rollback restored it. | PASS |
| 11 | Disable a registered validator trigger. | Trigger-manifest mismatch detected; rollback re-enabled it. | PASS |
| 12 | Grant owner non-lock `UPDATE(authorityStatus)`. | Exact 22/16 privilege matrix detected drift; rollback restored matrix. | PASS |
| 13 | Writer updates unrelated Correspondence and Phase 2B ReportDifference. | Both `42501`; durable row counts unchanged. | PASS |
| 14 | Writer performs broad ReportVersion authority update. | `42501`; authority value unchanged. | PASS |
| 15 | Forge readiness expected privileged-manifest hash. | Forged receipt rejected; exact manifest accepted after restoration. | PASS |

## 13. Two pristine PostgreSQL 16.14 results

Pinned local image:

`sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`

Exact-final verifier input manifest:

`013a0bee03203a74e7d9df4c796eb5cc3f29113383017c455e10fe46172feab5`

| Gate | Pristine pass 1 | Pristine pass 2 |
|---|---:|---:|
| PostgreSQL version | 16.14 PASS | 16.14 PASS |
| Forward migration | PASS | PASS |
| Explicit no-op reapply | PASS | PASS |
| Prisma/schema parity | PASS | PASS |
| Role normalization/exact writer allowlist | PASS | PASS |
| Privileged-validator apply/no-op/static/runtime audit | PASS | PASS |
| Isolated Prisma generation | PASS | PASS |
| Atomic late-audit rollback fingerprint, primary + rebuild | PASS | PASS |
| Real-adapter harness | `47/47 PASS` | `47/47 PASS` |
| Original attacks | `20/20 PASS` | `20/20 PASS` |
| Privileged attacks | `15/15 PASS` | `15/15 PASS` |
| Positive/rollback/source-read/replay/admin-negative checks | PASS | PASS |
| Concurrency and worker race | PASS | PASS |
| Exact `40P01` classification | PASS | PASS |
| Reconstruction/readback | PASS | PASS |
| Pristine migration reconstruction | PASS | PASS |
| Teardown | PASS | PASS |

Result: `2/2 PASS p0-trusted-writer-disposable-verify (PostgreSQL 16.14,
teardown confirmed)`. The 47 checks are 47 distinct harness checks repeated in
two independent runs, not 94 distinct claims. Inputs were byte-identical
between the two passes.

## 14. Concurrency and exact `40P01`

- concurrent legitimate claims produced one exact winner;
- exact replay remained idempotent;
- stale worker and competing ReportVersion attempts failed closed;
- induced transaction interruption and post-write attestation mismatch rolled
  back all attempted authority;
- ReportVersion and extraction-input real repository paths both classified an
  induced PostgreSQL `40P01` as:

  `DEADLOCK_DETECTED / POSTGRES_40P01_DEADLOCK_DETECTED /
  databaseCode=40P01 / retryable=false`;
- no automatic retry was added;
- durable readback remained consistent after successful commits.

These results were earned after the dedicated-writer binding and atomic role
contract repairs on the exact-final input manifest above.

## 15. Exact-current regression

| Binding | Exact-current result |
|---|---:|
| Phase 1/1.1 behavioral | `464/464 PASS` |
| Phase 2A behavioral | `140/140 PASS` |
| **Exact-current behavioral total** | **`604/604 PASS`** |
| Exact-current compatibility | `7/7 PASS` |

Two frozen historical source-identity guards remained exact-source sentinels:

- Phase 1 frozen schema guard: `50/51`, with only its frozen accepted schema
  SHA mismatching the authorized additive trusted-writer schema;
- Phase 2A frozen integrated-schema guard: `72/73`, with only its frozen
  accepted integrated schema SHA mismatching.

Those are identity-only refusals to relabel new source as the old checkpoint,
not semantic test failures. They were not weakened or rewritten. Historical
`733/733`, exact-current behavioral `604/604`, and trusted-writer results remain
separate.

## 16. Trusted-writer test totals

| Suite | Exact-final result |
|---|---:|
| migration/role/static guard | `153/153 PASS` |
| privileged-validator boundary | `332/332 PASS` |
| writer-surface audit | `58/58 PASS` |
| concrete Prisma repositories | `20/20 PASS` |
| source storage/value protection | `14/14 PASS` |
| principal/worker/readiness | `29/29 PASS` |
| upload-hook composition | `17/17 PASS` |
| concrete Phase 2A adapters | `7/7 PASS` |
| parser implementation authority | `7/7 PASS` |
| affected Phase 2A source/parser | `33/33 PASS` |
| **Component/static total** | **`670/670 PASS`** |
| TypeScript | PASS |
| Prisma validation | PASS |
| verifier Bash syntax | PASS |
| Git diff/whitespace | PASS |

These totals bind the same exact-final source used by the two pristine dynamic
passes.

## 17. Fresh adversarial state

**Critical 0 / High 0 / Medium 0 / Low 0.**

The fresh reviewer independently recomputed the exact-final input manifest,
reattacked the role-bound Prisma client, atomic role contract, readiness/keyring
claims, privileged-validator inventory, trigger closure, dormant route, source
and version binding, concurrency, and activation gates, and found no unresolved
source defect.

Final exact-source verdict: **C0 / H0 / M0 / L0**.

## 18. Exact files changed

The exact-final worktree has 49 intended paths: 47 source/schema/migration/
test/verifier paths plus this Markdown/HTML pair. The final scope audit found
no unrelated or forbidden path.

### Runtime and schema (30)

- `app/api/reports/upload/route.ts`
- `lib/creditTruth/accountReview.ts`
- `lib/creditTruth/caseActionDecision.ts`
- `lib/creditTruth/consumerConfirmationRuntime.ts`
- `lib/creditTruth/phase2Flags.ts`
- `lib/creditTruth/phase2Readiness.ts`
- `lib/creditTruth/principalPrismaAdapter.ts`
- `lib/creditTruth/prismaCaseActionRepository.ts`
- `lib/creditTruth/prismaConsumerConfirmationRepository.ts`
- `lib/creditTruth/prismaExtractionInputRepository.ts`
- `lib/creditTruth/prismaReportIngestionRepository.ts`
- `lib/creditTruth/prismaReportVersionRepository.ts`
- `lib/creditTruth/prismaRound0Repository.ts`
- `lib/creditTruth/prismaSensitiveAccessRepository.ts`
- `lib/creditTruth/prismaShadowTruthGraphRepository.ts`
- `lib/creditTruth/prismaSourceArtifactProvider.ts`
- `lib/creditTruth/reportIngestion.ts`
- `lib/creditTruth/repository.ts`
- `lib/creditTruth/repositoryAttestation.ts`
- `lib/creditTruth/round0Runtime.ts`
- `lib/creditTruth/sensitiveAccessAudit.ts`
- `lib/creditTruth/shadowExtractionService.ts`
- `lib/creditTruth/sourceArtifact.ts`
- `lib/creditTruth/trustedWriterParserExecution.ts`
- `lib/creditTruth/trustedWriterPrismaClient.ts`
- `lib/creditTruth/trustedWriterReadiness.ts`
- `lib/creditTruth/trustedWriterShadowValueProtector.ts`
- `lib/creditTruth/trustedWriterUploadHook.ts`
- `lib/creditTruth/trustedWriterValueProtection.ts`
- `prisma/schema.prisma`

### Migration, contracts, harnesses, and tests (17)

- `prisma/migrations/20260811_p0_trusted_writer_gate/migration.sql`
- `scripts/p0-phase2a-adversarial-fixture.test.ts`
- `scripts/p0-phase2a-phase1-nonregression.test.ts`
- `scripts/p0-phase2a-source-parser.test.ts`
- `scripts/p0-trusted-writer-disposable-verify.sh`
- `scripts/p0-trusted-writer-migration-guard.test.ts`
- `scripts/p0-trusted-writer-parser-identity.test.ts`
- `scripts/p0-trusted-writer-phase2a-adapters.test.ts`
- `scripts/p0-trusted-writer-principal-readiness.test.ts`
- `scripts/p0-trusted-writer-prisma-repositories.test.ts`
- `scripts/p0-trusted-writer-real-adapter.test.ts`
- `scripts/p0-trusted-writer-source-storage.test.ts`
- `scripts/p0-trusted-writer-surface-audit.test.ts`
- `scripts/p0-trusted-writer-upload-hook.test.ts`
- `scripts/p0-trusted-writer-validator-boundary.test.ts`
- `scripts/sql/p0-trusted-writer-db-role-contract.sql`
- `scripts/sql/p0-trusted-writer-validator-boundary.sql`

### Founder checkpoint documents (2)

- `docs/p0-launch-correctness/P0-TRUSTED-WRITER-SEMANTIC-ATTESTATION-FOUNDER-CHECKPOINT-2026-08-11.md`
- `docs/p0-launch-correctness/P0-TRUSTED-WRITER-SEMANTIC-ATTESTATION-FOUNDER-CHECKPOINT-2026-08-11.html`

No generated database, dump, log, container layer, dependency tree, or
temporary verifier artifact belongs in the checkpoint.

## 19. Manifests and critical hashes

### Frozen privileged boundary

| Artifact | SHA-256 |
|---|---|
| validator-boundary SQL | `87ac3e3023f5f3f0ba9dfc66d5cb6b7f5c988bc987e3d0c70a7d9ed576ac1009` |
| validator-boundary static audit | `b8452294fc3063b05a9ec967364c1360d2a3c359e26ba02e779eb104ed631e7b` |
| privileged catalog manifest from the two completed pristine passes | `65ee818e8b987424fd03bf582cd03dbcec36795bd7fd2af6d533ef959f0c7253` |

### Exact-final trusted-writer source

| Artifact | SHA-256 |
|---|---|
| exact verifier input manifest | `013a0bee03203a74e7d9df4c796eb5cc3f29113383017c455e10fe46172feab5` |
| upload route | `1c6d3bff6616859fec43f59a43b39b5a675bdaa70506695d81f9a342161f221c` |
| Prisma schema | `d822f26a5b429f8aff3d811e08eb8fc28610b5b7bd8515d91c51a97b4f456427` |
| trusted-writer migration | `a628900e61ee6292f67c210b74dad42d2533748852f5ffc03d4f942a09dc663f` |
| DB role contract | `4f4f094cf878b429ded62e111a71f618ecda9db723bb5d7295a53e2ea8dfe04f` |
| disposable verifier | `b1ff1912794d5304e46950814e0f74c62d98f1c7a14f06a53f53018b56e1162a` |
| migration/role guard | `443bb22c31c1a7f4673eaa4bfe28d9a958f45655f76d97e4f740c14b9b1bb6b7` |
| dedicated writer Prisma client | `228596093e7afc75a99b048c376d1a6e9402b3694acf3ae70d695ef85dcf0530` |
| principal adapter | `5642aa87e40dadf3e97fea49855fefe5dadd82e92845bc90368a0f225709994e` |
| upload-hook composition | `457fdefc336a7f945b17343a945831cf3e97690e36cbaca4dac792c5156bf1c6` |
| readiness implementation | `eab470b37dbbbf11a1a30eeed140380b95841f5a1255bb16e5e268078b04ce21` |
| real-adapter harness | `aeba7791cc672fa4db6aa3b533d63362b470b9a9564d0cd4c02f0ab6f77c86f2` |
| non-document 47-path delta manifest | `54fdda5d471d4d61ba8f99324ae4eea2402c95557b565402a21daefbb724d9e2` |

Manifest record format is path-sorted
`<file-sha256><two spaces><path><LF>`, with the final line feed included in the
outer SHA-256. The containing local commit SHA is reported in the final chat
and git receipt because a document cannot stably embed the hash of the commit
that contains its own bytes.

## 20. Local checkpoint

All checkpoint gates are green and one local commit is authorized. The exact
containing commit SHA is reported in the final Founder handoff and git receipt
after this document and its HTML twin are frozen. No push, merge, deploy, or
activation is authorized.

## 21. Remaining pre-activation dependencies

Although trusted-writer closure is locally earned, these remain separate:

1. **Hard process-isolated PDF termination** — mandatory pre-activation gate.
2. **Retention/legal-hold policy** — Founder/counsel decision required.
3. **Deployed database-role attestation** — future infrastructure/deployment
   gate; local role proof is not a substitute.
4. **Deployed managed key custody** — local evidence proves the exact
   `VALUE_PROTECTION_KEYRING` AEAD/versioning contract; it does not claim a
   deployed KMS or secret-manager custody attestation.
5. **Founder production activation authorization** — separate and absent.

No counsel-sensitive policy changed.

## 22. Safety and isolation confirmation

- Production connection: **NONE**
- Production consumer data access: **NONE**
- Production mutation/migration/backfill/reanalysis: **NONE**
- Push: **NONE**
- Merge: **NONE**
- Deploy: **NONE**
- Activation/cohort enablement: **NONE**
- Phase 2B: **NOT STARTED**
- M2: **UNTOUCHED**
- Fable/cinematic: **UNTOUCHED**
- Launch Closure: **UNTOUCHED**
- Disposable verification: local synthetic data and disposable PostgreSQL only

## Final decision line

**CLOSED LOCALLY / PRE-ACTIVATION PROVEN.** This result closes only the
trusted-writer semantic-attestation gate on exact local source. It does not
claim overall production readiness and does not authorize push, merge, deploy,
activation, production connectivity, production data access, legacy migration,
backfill, or Phase 2B.
