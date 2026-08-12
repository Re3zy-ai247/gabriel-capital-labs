\set ON_ERROR_STOP on

-- Owner-run LOCAL contract for the narrow P0 privileged-validator boundary.
--
-- Required psql variable:
--   p0_writer_role  exact dedicated application writer role
--
-- The dedicated p0_validator_owner role must already exist. This contract
-- refuses to create, repair, or broaden that role: its NOLOGIN/non-admin/no-
-- membership properties are an external deployment invariant. Function bodies
-- are never replaced here. The SHA-256 values below are verified against the
-- migration source by scripts/p0-trusted-writer-validator-boundary.test.ts;
-- PostgreSQL's built-in md5(text) provides the matching runtime drift check
-- without adding an extension or granting a digest routine.

BEGIN;

SELECT set_config(
  'creditvector.p0_validator_writer_role',
  :'p0_writer_role',
  true
);

CREATE TEMP TABLE p0_validator_expected (
  identity TEXT PRIMARY KEY,
  function_name TEXT NOT NULL,
  security_definer BOOLEAN NOT NULL,
  source_sha256 VARCHAR(64) NOT NULL,
  source_md5 VARCHAR(32) NOT NULL
) ON COMMIT DROP;

INSERT INTO p0_validator_expected (
  identity,
  function_name,
  security_definer,
  source_sha256,
  source_md5
) VALUES
  ('public.p0_validate_artifact_seal()', 'p0_validate_artifact_seal', TRUE, '1d608a8f885dc0b0c1966284a5592f997074bf81f6ff5fae095083315ace7759', 'fa8c4f0e073fa7c73dda0eefdb8c9f15'),
  ('public.p0_validate_report_account_subject()', 'p0_validate_report_account_subject', TRUE, '17a0c43aca18f98ed07a8df12185beb0350539a01fa65b97a6561f204619605a', '3272aa41c1ccf86bf27a68bebd7652c6'),
  ('public.p0_reject_post_assessment_account_input()', 'p0_reject_post_assessment_account_input', TRUE, '3b9a5e5c2b0d8daed5850306de0e2a8d383847db98907cf9b13d39331f750923', '0f8ff1df84097380f8ff50805d1ecc7c'),
  ('public.p0_reject_post_assessment_coverage()', 'p0_reject_post_assessment_coverage', TRUE, '661786850fcaeeff24d5865595d5d56b5a73d6f1c5c997965283bed700eb260f', 'd10eab8b80c9321948eca30d50ba006f'),
  ('public.p0_validate_credit_score_insert()', 'p0_validate_credit_score_insert', TRUE, '5e814b4b1e315b89dcee488503e3670d33e47dfd2ce08a9f16cadf9a07fad3ba', '8363362f2b59b02bdaa00897b4662f7b'),
  ('public.p0_reject_post_comparison_identity_input()', 'p0_reject_post_comparison_identity_input', TRUE, '6980f52fef7531727c3e4315b99204b388f8b45415af8d0a90d4536d4d2ec861', '6f5836763a143233fb8fb26dca5ec99c'),
  ('public.p0_2a_validate_extraction_input()', 'p0_2a_validate_extraction_input', TRUE, '310db03be26e73f6e9cdd3e38b6f18095efbc2404804371160f85d5efa98b8ea', '1500cffdacec5a17726972e05b664de2'),
  ('public.p0_2a_validate_score_model_evidence()', 'p0_2a_validate_score_model_evidence', TRUE, '45267e4a7b04080a4af65f07eb1a6b92bcc625d3ac3316e828957fe242dd801f', '4e79b6a5c95c8a8a03a8609c907fac70'),
  ('public.p0_2a_validate_bureau_report_date()', 'p0_2a_validate_bureau_report_date', TRUE, 'f7288d1057824cf3cf71cc489b29a1d1a6a666462feb1efd704864e7c6c229c9', '2bfc28a28ef049b29c302a5a5baaad25'),
  ('public.p0_2a_validate_round0_source_completeness()', 'p0_2a_validate_round0_source_completeness', TRUE, 'f32135f3eda156e4e1b24defab93ff11784e2cf5a00ef8e359179fd3889333a5', '42829ccd72f62a60a4d02cae4955e0d7'),
  ('public.p0_2a_validate_identity_baseline_source_seal()', 'p0_2a_validate_identity_baseline_source_seal', TRUE, '3fd2e45195a3e21da7e6bf69eb10595e76526ecabe5f72c8c07bf5ad1f8442f5', '3cb811abffc6ae076353ac9b2763bcda'),
  ('public.p0_2a_validate_round0_source_seal_deferred()', 'p0_2a_validate_round0_source_seal_deferred', TRUE, 'be3ab78770b6e552689265a4c47d00ec79994de863cdee2b47c3d9d30956573a', '8050edf0b086ce3f1126dbbac80de078'),
  ('public.p0_2a_validate_report_ingestion_mutation()', 'p0_2a_validate_report_ingestion_mutation', TRUE, '3f226333428af5761f279ffa0a57c56e5cefc18c90a619b565b92b2aee270105', '041c08029059e7fe9ad6cd8ac43c4d04'),
  ('public.p0_2a_validate_identity_fact_insert()', 'p0_2a_validate_identity_fact_insert', TRUE, 'a0e1045e7dd2addbce6396bc45151cfbf1a18ccd7712f661fdf81ced2c538268', '91e3536bad70922c5ac63e4bc0fe4bf2'),
  ('public.p0_2a_validate_identity_category_completion()', 'p0_2a_validate_identity_category_completion', TRUE, '8e846b9ef7af667d3f94e3a5b8bb514ef4905c1ddc8e30ced7167efca711e043', '8ddedbfcbfa14071316db5801e1bd260'),
  ('public.p0_2a_reject_account_presence_after_source_completeness()', 'p0_2a_reject_account_presence_after_source_completeness', TRUE, 'cb02f7e087241c27d3ece5f110709ba535a24c5e3c6e998ddb2e49fe957332b1', '4e3bbc8db4e8a3e0cb6fead0f8480b76'),
  ('public.p0_2a_reject_account_after_identity_completion()', 'p0_2a_reject_account_after_identity_completion', TRUE, 'adf17da0fefc0c85423647e336f33190ca7db3dd0f5c5360d9ad8df18f235895', 'ab793bf7739fa51c76652a797bccc066'),
  ('public.p0_2a_validate_identity_correspondence_assertion()', 'p0_2a_validate_identity_correspondence_assertion', TRUE, '655e06940782b9834fa647bcbbfdbd6be55262e686054aac51001cfd9b05d425', 'c23aabdcfa28c7a7ff8d52ce53a015bf'),
  ('public.p0_2a_validate_consumer_account_review()', 'p0_2a_validate_consumer_account_review', TRUE, 'ebb9cb1589d6d9e86057e2174cfe55147fc7082d8189dca8d8181311cbf29382', 'bf9434b77a8483c01053a04018551d3c'),
  ('public.p0_2a_validate_identity_baseline_account_review_membership()', 'p0_2a_validate_identity_baseline_account_review_membership', TRUE, '9634f4ddece91e54e534fc898fe537d4bfcba5a64e76e77f730a4944de4c6fb6', '52fcba5f875dfeb5aed7ca6979e62af8'),
  ('public.p0_2a_validate_confirmed_baseline_child_deferred()', 'p0_2a_validate_confirmed_baseline_child_deferred', TRUE, '7bf3ddc8ef72c03a0f1b10cb9d0307a4c7e933fe959e1004d4e780a2724f567d', 'e524c7a141f6633b8c3e01f43b57c3af'),
  ('public.p0_2a_validate_case_action_decision()', 'p0_2a_validate_case_action_decision', TRUE, 'ef3d13ac3d1b87a5cccfc6df2d27789ddd39b6c974e7dc0f9ce3e06e5f22eceb', '1e1b3e2cad54ac967e9b1e91a8331e43'),
  ('public.p0_2a_validate_case_action_source_ref()', 'p0_2a_validate_case_action_source_ref', TRUE, '4ae00541347da78825e33ec30d4589608b866c7fc0e77e8291919f4f08bafd1f', 'a7b32cad789cefc60327a51d4aeb32bd'),
  ('public.p0_2a_validate_case_action_source_membership()', 'p0_2a_validate_case_action_source_membership', TRUE, 'ceef5ade280fdc45eaa36e74002e66e3b94408a44a8c992090e2a438eaf8314b', '156050df79c550736e542534cfc4fb24'),
  ('public.p0_lock_extraction_run(text,text,text,text)', 'p0_lock_extraction_run', FALSE, '04988bd7d94cbd3a0cf100467354fbfc675ef4509ce1dc11f463a85e82139368', '8b17320a45ec13e9a6d33e7e6b03c5fd'),
  ('public.p0_lock_assessment_input(text,text,text,text,text)', 'p0_lock_assessment_input', FALSE, '5a1845a681a657babcae257c5a4042392c5611c3a2d93474adc738cd3af3c066', 'e006657e682fd1981819d0ba3d1e1bdb'),
  ('public.p0_reject_if_run_is_compared(text,text,text,text)', 'p0_reject_if_run_is_compared', FALSE, '6925e3418574288ceefc7a17bb3d95b443f8a135e61ec1a3277788de10e9c485', 'd27725971d3b2a10df628ef735e2e16d'),
  ('public.p0_2a_identity_fact_matches_category(public."IdentityFactType",public."IdentityReviewCategory",public."IdentityReviewCategory")', 'p0_2a_identity_fact_matches_category', FALSE, '9c35391788b30fe188cc1308273b7db026d310548841855f9716ed24e3c9dbcb', '263fb29ce01165457863ad66fa2559c5');

-- Exact non-internal trigger graph on the 26 P0 tables mutable by the nine
-- concrete adapters plus their four authenticated/read authority roots. This
-- is intentionally broader than the 37 edges to the privileged validators: an
-- extra trigger is an authority path even when its function has a different
-- name, owner, or schema.
CREATE TEMP TABLE p0_validator_authority_table_expected (
  table_name TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO p0_validator_authority_table_expected (table_name) VALUES
  ('Account'),
  ('AccountPresenceObservation'),
  ('Artifact'),
  ('BureauReportDateEvidence'),
  ('CaseActionDecision'),
  ('CaseActionSourceRef'),
  ('ConsumerAccountReviewReceipt'),
  ('ConsumerAssertion'),
  ('CreditScoreObservation'),
  ('CreditTruthScope'),
  ('DerivedAccountAssessment'),
  ('DisputeCase'),
  ('ExtractionBureauCoverage'),
  ('ExtractionRun'),
  ('FieldObservation'),
  ('HistoricalEvidence'),
  ('IdentityBaseline'),
  ('IdentityBaselineAccountReviewMembership'),
  ('IdentityCategoryCompletion'),
  ('IdentityCorrespondenceAssertion'),
  ('IdentityFact'),
  ('P0SensitiveAccessEvent'),
  ('P0SourceObject'),
  ('Report'),
  ('ReportIngestion'),
  ('ReportVersion'),
  ('ReportVersionAccount'),
  ('Round0SourceCompletenessEvidence'),
  ('SectionCompleteness'),
  ('User');

CREATE TEMP TABLE p0_validator_trigger_expected (
  table_name TEXT NOT NULL REFERENCES p0_validator_authority_table_expected,
  trigger_name TEXT NOT NULL,
  routine_identity TEXT NOT NULL,
  trigger_type INTEGER NOT NULL,
  is_constraint BOOLEAN NOT NULL,
  is_deferrable BOOLEAN NOT NULL,
  initially_deferred BOOLEAN NOT NULL,
  enabled_mode CHAR(1) NOT NULL,
  argument_hex TEXT NOT NULL,
  PRIMARY KEY (table_name, trigger_name)
) ON COMMIT DROP;

INSERT INTO p0_validator_trigger_expected (
  table_name,
  trigger_name,
  routine_identity,
  trigger_type,
  is_constraint,
  is_deferrable,
  initially_deferred,
  enabled_mode,
  argument_hex
) VALUES
  ('Account', 'Account_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('AccountPresenceObservation', 'AccountPresenceObservation_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('AccountPresenceObservation', 'AccountPresenceObservation_round0_membership_deferred_trg', 'public.p0_2a_validate_round0_source_seal_deferred()', 5, TRUE, TRUE, TRUE, 'O', '5245564552534500'),
  ('AccountPresenceObservation', 'AccountPresenceObservation_round0_source_membership_trg', 'public.p0_2a_reject_account_presence_after_source_completeness()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('AccountPresenceObservation', 'AccountPresenceObservation_sealed_input_trg', 'public.p0_reject_post_assessment_account_input()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('AccountPresenceObservation', 'AccountPresenceObservation_v2_authority_trg', 'public.p0_validate_v2_truth_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('AccountPresenceObservation', 'AccountPresenceObservation_v2_membership_trg', 'public.p0_validate_v2_account_membership()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('Artifact', 'Artifact_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('Artifact', 'Artifact_canonical_context_trg', 'public.p0_validate_canonical_artifact_context()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('Artifact', 'Artifact_seal_count_trg', 'public.p0_validate_artifact_seal()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('BureauReportDateEvidence', 'BureauReportDateEvidence_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('BureauReportDateEvidence', 'BureauReportDateEvidence_h1_run_metadata_deferred_trg', 'public.p0_2a_validate_h1_run_metadata_deferred()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('BureauReportDateEvidence', 'BureauReportDateEvidence_validate_trg', 'public.p0_2a_validate_bureau_report_date()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('CaseActionDecision', 'CaseActionDecision_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('CaseActionDecision', 'CaseActionDecision_source_membership_trg', 'public.p0_2a_validate_case_action_source_membership()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('CaseActionDecision', 'CaseActionDecision_validate_trg', 'public.p0_2a_validate_case_action_decision()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('CaseActionSourceRef', 'CaseActionSourceRef_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('CaseActionSourceRef', 'CaseActionSourceRef_source_membership_trg', 'public.p0_2a_validate_case_action_source_membership()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('CaseActionSourceRef', 'CaseActionSourceRef_validate_trg', 'public.p0_2a_validate_case_action_source_ref()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('ConsumerAccountReviewReceipt', 'ConsumerAccountReviewReceipt_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('ConsumerAccountReviewReceipt', 'ConsumerAccountReviewReceipt_validate_trg', 'public.p0_2a_validate_consumer_account_review()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('ConsumerAssertion', 'ConsumerAssertion_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('ConsumerAssertion', 'ConsumerAssertion_supersession_order_trg', 'public.p0_validate_consumer_assertion_supersession()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('CreditScoreObservation', 'CreditScoreObservation_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('CreditScoreObservation', 'CreditScoreObservation_h1_run_metadata_deferred_trg', 'public.p0_2a_validate_h1_run_metadata_deferred()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('CreditScoreObservation', 'CreditScoreObservation_model_evidence_trg', 'public.p0_2a_validate_score_model_evidence()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('CreditScoreObservation', 'CreditScoreObservation_validate_insert_trg', 'public.p0_validate_credit_score_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('CreditTruthScope', 'CreditTruthScope_authorized_pair_trg', 'public.p0_validate_credit_truth_scope()', 23, FALSE, FALSE, FALSE, 'O', ''),
  ('DerivedAccountAssessment', 'DerivedAccountAssessment_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('DerivedAccountAssessment', 'DerivedAccountAssessment_clean_truth_trg', 'public.p0_validate_assessment_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('DerivedAccountAssessment', 'DerivedAccountAssessment_v2_authority_trg', 'public.p0_validate_v2_truth_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('DerivedAccountAssessment', 'DerivedAccountAssessment_v2_membership_trg', 'public.p0_validate_v2_account_membership()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('ExtractionBureauCoverage', 'ExtractionBureauCoverage_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('ExtractionBureauCoverage', 'ExtractionBureauCoverage_sealed_input_trg', 'public.p0_reject_post_assessment_coverage()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('ExtractionBureauCoverage', 'ExtractionBureauCoverage_v2_authority_trg', 'public.p0_validate_v2_truth_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('ExtractionRun', 'ExtractionRun_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('ExtractionRun', 'ExtractionRun_complete_bureau_coverage_trg', 'public.p0_validate_extraction_bureau_coverage()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('ExtractionRun', 'ExtractionRun_input_artifact_trg', 'public.p0_2a_validate_extraction_input()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('ExtractionRun', 'ExtractionRun_v2_authority_trg', 'public.p0_validate_v2_truth_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('FieldObservation', 'FieldObservation_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('FieldObservation', 'FieldObservation_sealed_input_trg', 'public.p0_reject_post_assessment_account_input()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('FieldObservation', 'FieldObservation_v2_authority_trg', 'public.p0_validate_v2_truth_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('FieldObservation', 'FieldObservation_v2_membership_trg', 'public.p0_validate_v2_account_membership()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('HistoricalEvidence', 'HistoricalEvidence_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('HistoricalEvidence', 'HistoricalEvidence_sealed_input_trg', 'public.p0_reject_post_assessment_account_input()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('HistoricalEvidence', 'HistoricalEvidence_v2_authority_trg', 'public.p0_validate_v2_truth_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('HistoricalEvidence', 'HistoricalEvidence_v2_membership_trg', 'public.p0_validate_v2_account_membership()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityBaseline', 'IdentityBaseline_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityBaseline', 'IdentityBaseline_comparison_input_seal_trg', 'public.p0_reject_post_comparison_identity_input()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityBaseline', 'IdentityBaseline_h1_run_metadata_deferred_trg', 'public.p0_2a_validate_h1_run_metadata_deferred()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('IdentityBaseline', 'IdentityBaseline_round0_manifest_deferred_trg', 'public.p0_2a_validate_round0_source_seal_deferred()', 5, TRUE, TRUE, TRUE, 'O', '4d414e494645535400'),
  ('IdentityBaseline', 'IdentityBaseline_source_seal_trg', 'public.p0_2a_validate_identity_baseline_source_seal()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityBaselineAccountReviewMembership', 'IdentityBaselineAccountReview_confirmed_parent_deferred_trg', 'public.p0_2a_validate_confirmed_baseline_child_deferred()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('IdentityBaselineAccountReviewMembership', 'IdentityBaselineAccountReviewMembership_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityBaselineAccountReviewMembership', 'IdentityBaselineAccountReviewMembership_validate_trg', 'public.p0_2a_validate_identity_baseline_account_review_membership()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityCategoryCompletion', 'IdentityCategoryCompletion_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityCategoryCompletion', 'IdentityCategoryCompletion_confirmed_parent_deferred_trg', 'public.p0_2a_validate_confirmed_baseline_child_deferred()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('IdentityCategoryCompletion', 'IdentityCategoryCompletion_no_fact_trg', 'public.p0_2a_validate_identity_category_completion()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityCorrespondenceAssertion', 'IdentityCorrespondenceAssertion_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityCorrespondenceAssertion', 'IdentityCorrespondenceAssertion_validate_trg', 'public.p0_2a_validate_identity_correspondence_assertion()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityFact', 'IdentityFact_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityFact', 'IdentityFact_comparison_input_seal_trg', 'public.p0_reject_post_comparison_identity_input()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityFact', 'IdentityFact_confirmed_parent_deferred_trg', 'public.p0_2a_validate_confirmed_baseline_child_deferred()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('IdentityFact', 'IdentityFact_round0_category_trg', 'public.p0_2a_validate_identity_fact_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('IdentityFact', 'IdentityFact_round0_source_membership_deferred_trg', 'public.p0_2a_validate_round0_source_seal_deferred()', 5, TRUE, TRUE, TRUE, 'O', '5245564552534500'),
  ('P0SensitiveAccessEvent', 'P0SensitiveAccessEvent_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('P0SensitiveAccessEvent', 'P0SensitiveAccessEvent_validate_trg', 'public.p0_2a_validate_sensitive_access_event()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('P0SourceObject', 'P0SourceObject_no_update_truncate_trg', 'public.p0_forbid_immutable_mutation()', 50, FALSE, FALSE, FALSE, 'O', ''),
  ('P0SourceObject', 'P0SourceObject_write_fence_trg', 'public.p0_trusted_writer_validate_source_object_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('ReportIngestion', 'ReportIngestion_no_delete_trg', 'public.p0_forbid_immutable_mutation()', 42, FALSE, FALSE, FALSE, 'O', ''),
  ('ReportIngestion', 'ReportIngestion_p0_source_authority_trg', 'public.p0_trusted_writer_validate_ingestion_source_authority()', 23, FALSE, FALSE, FALSE, 'O', ''),
  ('ReportIngestion', 'ReportIngestion_state_cas_trg', 'public.p0_2a_validate_report_ingestion_mutation()', 23, FALSE, FALSE, FALSE, 'O', ''),
  ('ReportVersion', 'ReportVersion_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('ReportVersionAccount', 'ReportVersionAccount_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('ReportVersionAccount', 'ReportVersionAccount_round0_category_trg', 'public.p0_2a_reject_account_after_identity_completion()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('ReportVersionAccount', 'ReportVersionAccount_round0_source_membership_deferred_trg', 'public.p0_2a_validate_round0_source_seal_deferred()', 5, TRUE, TRUE, TRUE, 'O', '5245564552534500'),
  ('ReportVersionAccount', 'ReportVersionAccount_validate_subject_trg', 'public.p0_validate_report_account_subject()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('Round0SourceCompletenessEvidence', 'Round0SourceCompletenessEvidence_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('Round0SourceCompletenessEvidence', 'Round0SourceCompletenessEvidence_h1_run_metadata_deferred_trg', 'public.p0_2a_validate_h1_run_metadata_deferred()', 5, TRUE, TRUE, TRUE, 'O', ''),
  ('Round0SourceCompletenessEvidence', 'Round0SourceCompletenessEvidence_manifest_deferred_trg', 'public.p0_2a_validate_round0_source_seal_deferred()', 5, TRUE, TRUE, TRUE, 'O', '4d414e494645535400'),
  ('Round0SourceCompletenessEvidence', 'Round0SourceCompletenessEvidence_membership_deferred_trg', 'public.p0_2a_validate_round0_source_seal_deferred()', 5, TRUE, TRUE, TRUE, 'O', '4d454d4245525348495000'),
  ('Round0SourceCompletenessEvidence', 'Round0SourceCompletenessEvidence_validate_trg', 'public.p0_2a_validate_round0_source_completeness()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('SectionCompleteness', 'SectionCompleteness_append_only_trg', 'public.p0_forbid_immutable_mutation()', 58, FALSE, FALSE, FALSE, 'O', ''),
  ('SectionCompleteness', 'SectionCompleteness_sealed_input_trg', 'public.p0_reject_post_assessment_account_input()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('SectionCompleteness', 'SectionCompleteness_v2_authority_trg', 'public.p0_validate_v2_truth_insert()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('SectionCompleteness', 'SectionCompleteness_v2_membership_trg', 'public.p0_validate_v2_account_membership()', 7, FALSE, FALSE, FALSE, 'O', ''),
  ('User', 'User_p0_authorization_revision_trg', 'public.p0_trusted_writer_bump_authorization_revision()', 23, FALSE, FALSE, FALSE, 'O', '');

DO $p0_validator_preflight$
DECLARE
  writer_name TEXT := current_setting('creditvector.p0_validator_writer_role', true);
  writer_oid OID;
  owner_oid OID;
  installer_oid OID := (SELECT oid FROM pg_roles WHERE rolname = current_user);
  expected RECORD;
  function_oid OID;
  function_source TEXT;
  function_language TEXT;
  function_owner OID;
  function_definer BOOLEAN;
  function_config TEXT[];
  saw_installer_state BOOLEAN := FALSE;
  saw_final_state BOOLEAN := FALSE;
BEGIN
  IF writer_name IS NULL OR writer_name !~ '^p0_writer_[a-z0-9_]{1,48}$' THEN
    RAISE EXCEPTION 'unsafe or missing P0 writer role';
  END IF;

  SELECT oid INTO writer_oid FROM pg_roles WHERE rolname = writer_name;
  SELECT oid INTO owner_oid FROM pg_roles WHERE rolname = 'p0_validator_owner';
  IF writer_oid IS NULL OR owner_oid IS NULL THEN
    RAISE EXCEPTION 'P0 writer and dedicated validator owner must already exist';
  END IF;
  IF writer_oid = owner_oid
     OR current_user IN (writer_name, 'p0_validator_owner')
     OR session_user IN (writer_name, 'p0_validator_owner') THEN
    RAISE EXCEPTION 'validator boundary must be installed by a distinct owner role';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE oid = owner_oid
      AND NOT rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreatedb
      AND NOT rolcreaterole
      AND NOT rolinherit
      AND NOT rolreplication
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'p0_validator_owner must be exact NOLOGIN non-admin NOINHERIT';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE member = owner_oid OR roleid = owner_oid
  ) THEN
    RAISE EXCEPTION 'p0_validator_owner must have no role memberships or members';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_database WHERE datdba = owner_oid)
     OR EXISTS (
       SELECT 1 FROM pg_namespace
       WHERE nspowner = owner_oid
         AND nspname <> 'information_schema'
         AND nspname !~ '^pg_'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       WHERE relation.relowner = owner_oid
         AND namespace.nspname <> 'information_schema'
         AND namespace.nspname !~ '^pg_'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_type type_row
       JOIN pg_namespace namespace ON namespace.oid = type_row.typnamespace
       WHERE type_row.typowner = owner_oid
         AND namespace.nspname <> 'information_schema'
         AND namespace.nspname !~ '^pg_'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_proc routine
       JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
       WHERE routine.proowner = owner_oid
         AND namespace.nspname <> 'information_schema'
         AND namespace.nspname !~ '^pg_'
         AND NOT EXISTS (
           SELECT 1
           FROM p0_validator_expected allowlist
           WHERE to_regprocedure(allowlist.identity) = routine.oid
         )
     ) THEN
    RAISE EXCEPTION 'p0_validator_owner owns an unrelated database object';
  END IF;

  IF (SELECT count(*) FROM p0_validator_expected) <> 28
     OR (SELECT count(*) FROM p0_validator_expected WHERE security_definer) <> 24
     OR (SELECT count(*) FROM p0_validator_expected WHERE NOT security_definer) <> 4 THEN
    RAISE EXCEPTION 'validator function inventory is not exactly 24 entry validators plus 4 helpers';
  END IF;

  FOR expected IN SELECT * FROM p0_validator_expected ORDER BY identity LOOP
    function_oid := to_regprocedure(expected.identity);
    IF function_oid IS NULL THEN
      RAISE EXCEPTION 'required validator function is absent: %', expected.identity;
    END IF;
    SELECT routine.prosrc, language.lanname, routine.proowner,
           routine.prosecdef, routine.proconfig
      INTO function_source, function_language, function_owner,
           function_definer, function_config
    FROM pg_proc routine
    JOIN pg_language language ON language.oid = routine.prolang
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE routine.oid = function_oid
      AND namespace.nspname = 'public'
      AND routine.prokind = 'f';
    IF NOT FOUND
       OR function_language <> 'plpgsql'
       OR md5(function_source) <> expected.source_md5
       OR function_source ~ '(?im)^\s*(EXECUTE\s|INSERT\s+INTO\s|UPDATE\s+[^;]+\s+SET\s|DELETE\s+FROM\s|TRUNCATE\s)' THEN
      RAISE EXCEPTION 'validator body or language drifted before installation: %', expected.identity;
    END IF;

    IF function_owner = installer_oid THEN
      saw_installer_state := TRUE;
      IF function_definer OR function_config IS NOT NULL THEN
        RAISE EXCEPTION 'validator security/config drifted before first installation: %', expected.identity;
      END IF;
    ELSIF function_owner = owner_oid THEN
      saw_final_state := TRUE;
      IF function_definer IS DISTINCT FROM expected.security_definer
         OR function_config IS DISTINCT FROM
           ARRAY['search_path=pg_catalog, public, pg_temp']::TEXT[] THEN
        RAISE EXCEPTION 'validator security/config drifted after installation: %', expected.identity;
      END IF;
    ELSE
      RAISE EXCEPTION 'validator has an unexpected owner before installation: %', expected.identity;
    END IF;
  END LOOP;

  IF saw_installer_state AND saw_final_state THEN
    RAISE EXCEPTION 'validator inventory mixes first-install and final ownership states';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname = 'public'
      AND routine.proname IN (SELECT function_name FROM p0_validator_expected)
      AND NOT EXISTS (
        SELECT 1 FROM p0_validator_expected allowlist
        WHERE to_regprocedure(allowlist.identity) = routine.oid
      )
  ) THEN
    RAISE EXCEPTION 'unexpected overload exists for a privileged validator name';
  END IF;
END;
$p0_validator_preflight$;

-- Normalize only the dedicated validator owner. No shared role, schema, table,
-- routine, or PUBLIC policy is rewritten by this narrow contract.
REVOKE ALL PRIVILEGES ON SCHEMA public FROM p0_validator_owner;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM p0_validator_owner;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM p0_validator_owner;
REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public FROM p0_validator_owner;
GRANT USAGE ON SCHEMA public TO p0_validator_owner;
-- PostgreSQL requires the new owner to hold schema CREATE during an ownership
-- transfer. This transaction-scoped grant is revoked before the post-audit;
-- the NOLOGIN/no-members role cannot use it as an independent authority path.
GRANT CREATE ON SCHEMA public TO p0_validator_owner;

-- Exact read surface used by the 24 entry validators and four helper bodies.
GRANT SELECT ON TABLE public."AccountPresenceObservation" TO p0_validator_owner;
GRANT SELECT ON TABLE public."Artifact" TO p0_validator_owner;
GRANT SELECT ON TABLE public."ArtifactCorrespondenceVersion" TO p0_validator_owner;
GRANT SELECT ON TABLE public."CaseActionDecision" TO p0_validator_owner;
GRANT SELECT ON TABLE public."CaseActionSourceRef" TO p0_validator_owner;
GRANT SELECT ON TABLE public."ConsumerAccountReviewReceipt" TO p0_validator_owner;
GRANT SELECT ON TABLE public."ConsumerAssertion" TO p0_validator_owner;
GRANT SELECT ON TABLE public."CreditScoreObservation" TO p0_validator_owner;
GRANT SELECT ON TABLE public."DerivedAccountAssessment" TO p0_validator_owner;
GRANT SELECT ON TABLE public."ExtractionBureauCoverage" TO p0_validator_owner;
GRANT SELECT ON TABLE public."ExtractionRun" TO p0_validator_owner;
GRANT SELECT ON TABLE public."FieldObservation" TO p0_validator_owner;
GRANT SELECT ON TABLE public."IdentityBaseline" TO p0_validator_owner;
GRANT SELECT ON TABLE public."IdentityBaselineAccountReviewMembership" TO p0_validator_owner;
GRANT SELECT ON TABLE public."IdentityCategoryCompletion" TO p0_validator_owner;
GRANT SELECT ON TABLE public."IdentityCorrespondenceAssertion" TO p0_validator_owner;
GRANT SELECT ON TABLE public."IdentityFact" TO p0_validator_owner;
GRANT SELECT ON TABLE public."ReportComparison" TO p0_validator_owner;
GRANT SELECT ON TABLE public."ReportIngestion" TO p0_validator_owner;
GRANT SELECT ON TABLE public."ReportVersion" TO p0_validator_owner;
GRANT SELECT ON TABLE public."ReportVersionAccount" TO p0_validator_owner;
GRANT SELECT ON TABLE public."Round0SourceCompletenessEvidence" TO p0_validator_owner;

-- PostgreSQL row-locking clauses require update-class authority. Grant only the
-- non-semantic id column on the sixteen relations actually locked. The role is
-- NOLOGIN and the validator bodies contain no DML.
GRANT UPDATE ("id") ON TABLE public."AccountPresenceObservation" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."Artifact" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."CaseActionDecision" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."ConsumerAccountReviewReceipt" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."ConsumerAssertion" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."DerivedAccountAssessment" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."ExtractionRun" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."FieldObservation" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."IdentityBaseline" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."IdentityCategoryCompletion" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."IdentityCorrespondenceAssertion" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."IdentityFact" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."ReportIngestion" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."ReportVersion" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."ReportVersionAccount" TO p0_validator_owner;
GRANT UPDATE ("id") ON TABLE public."Round0SourceCompletenessEvidence" TO p0_validator_owner;

-- The 24 trigger entry points cross the privilege boundary. PostgreSQL trigger
-- execution does not require the mutating application role to hold EXECUTE.
ALTER FUNCTION public.p0_validate_artifact_seal() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_validate_artifact_seal() SECURITY DEFINER;
ALTER FUNCTION public.p0_validate_artifact_seal() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_validate_artifact_seal() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_validate_artifact_seal() TO p0_validator_owner;

ALTER FUNCTION public.p0_validate_report_account_subject() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_validate_report_account_subject() SECURITY DEFINER;
ALTER FUNCTION public.p0_validate_report_account_subject() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_validate_report_account_subject() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_validate_report_account_subject() TO p0_validator_owner;

ALTER FUNCTION public.p0_reject_post_assessment_account_input() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_reject_post_assessment_account_input() SECURITY DEFINER;
ALTER FUNCTION public.p0_reject_post_assessment_account_input() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_reject_post_assessment_account_input() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_reject_post_assessment_account_input() TO p0_validator_owner;

ALTER FUNCTION public.p0_reject_post_assessment_coverage() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_reject_post_assessment_coverage() SECURITY DEFINER;
ALTER FUNCTION public.p0_reject_post_assessment_coverage() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_reject_post_assessment_coverage() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_reject_post_assessment_coverage() TO p0_validator_owner;

ALTER FUNCTION public.p0_validate_credit_score_insert() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_validate_credit_score_insert() SECURITY DEFINER;
ALTER FUNCTION public.p0_validate_credit_score_insert() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_validate_credit_score_insert() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_validate_credit_score_insert() TO p0_validator_owner;

ALTER FUNCTION public.p0_reject_post_comparison_identity_input() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_reject_post_comparison_identity_input() SECURITY DEFINER;
ALTER FUNCTION public.p0_reject_post_comparison_identity_input() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_reject_post_comparison_identity_input() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_reject_post_comparison_identity_input() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_extraction_input() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_extraction_input() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_extraction_input() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_extraction_input() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_extraction_input() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_score_model_evidence() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_score_model_evidence() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_score_model_evidence() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_score_model_evidence() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_score_model_evidence() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_bureau_report_date() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_bureau_report_date() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_bureau_report_date() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_bureau_report_date() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_bureau_report_date() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_round0_source_completeness() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_round0_source_completeness() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_round0_source_completeness() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_round0_source_completeness() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_round0_source_completeness() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_identity_baseline_source_seal() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_identity_baseline_source_seal() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_identity_baseline_source_seal() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_identity_baseline_source_seal() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_identity_baseline_source_seal() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_round0_source_seal_deferred() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_round0_source_seal_deferred() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_round0_source_seal_deferred() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_round0_source_seal_deferred() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_round0_source_seal_deferred() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_report_ingestion_mutation() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_report_ingestion_mutation() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_report_ingestion_mutation() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_report_ingestion_mutation() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_report_ingestion_mutation() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_identity_fact_insert() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_identity_fact_insert() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_identity_fact_insert() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_identity_fact_insert() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_identity_fact_insert() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_identity_category_completion() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_identity_category_completion() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_identity_category_completion() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_identity_category_completion() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_identity_category_completion() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_reject_account_presence_after_source_completeness() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_reject_account_presence_after_source_completeness() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_reject_account_presence_after_source_completeness() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_reject_account_presence_after_source_completeness() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_reject_account_presence_after_source_completeness() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_reject_account_after_identity_completion() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_reject_account_after_identity_completion() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_reject_account_after_identity_completion() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_reject_account_after_identity_completion() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_reject_account_after_identity_completion() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_identity_correspondence_assertion() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_identity_correspondence_assertion() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_identity_correspondence_assertion() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_identity_correspondence_assertion() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_identity_correspondence_assertion() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_consumer_account_review() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_consumer_account_review() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_consumer_account_review() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_consumer_account_review() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_consumer_account_review() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_identity_baseline_account_review_membership() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_identity_baseline_account_review_membership() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_identity_baseline_account_review_membership() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_identity_baseline_account_review_membership() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_identity_baseline_account_review_membership() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_confirmed_baseline_child_deferred() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_confirmed_baseline_child_deferred() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_confirmed_baseline_child_deferred() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_confirmed_baseline_child_deferred() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_confirmed_baseline_child_deferred() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_case_action_decision() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_case_action_decision() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_case_action_decision() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_case_action_decision() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_case_action_decision() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_case_action_source_ref() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_case_action_source_ref() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_case_action_source_ref() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_case_action_source_ref() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_case_action_source_ref() TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_validate_case_action_source_membership() OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_validate_case_action_source_membership() SECURITY DEFINER;
ALTER FUNCTION public.p0_2a_validate_case_action_source_membership() SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_validate_case_action_source_membership() FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_validate_case_action_source_membership() TO p0_validator_owner;

-- These four exact dependencies remain invoker functions. They execute with the
-- dedicated owner's current_user only when reached from one of the entry
-- validators; direct PUBLIC and application-writer execution remains revoked.
ALTER FUNCTION public.p0_lock_extraction_run(text, text, text, text) OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_lock_extraction_run(text, text, text, text) SECURITY INVOKER;
ALTER FUNCTION public.p0_lock_extraction_run(text, text, text, text) SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_lock_extraction_run(text, text, text, text) FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_lock_extraction_run(text, text, text, text) TO p0_validator_owner;

ALTER FUNCTION public.p0_lock_assessment_input(text, text, text, text, text) OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_lock_assessment_input(text, text, text, text, text) SECURITY INVOKER;
ALTER FUNCTION public.p0_lock_assessment_input(text, text, text, text, text) SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_lock_assessment_input(text, text, text, text, text) FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_lock_assessment_input(text, text, text, text, text) TO p0_validator_owner;

ALTER FUNCTION public.p0_reject_if_run_is_compared(text, text, text, text) OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_reject_if_run_is_compared(text, text, text, text) SECURITY INVOKER;
ALTER FUNCTION public.p0_reject_if_run_is_compared(text, text, text, text) SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_reject_if_run_is_compared(text, text, text, text) FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_reject_if_run_is_compared(text, text, text, text) TO p0_validator_owner;

ALTER FUNCTION public.p0_2a_identity_fact_matches_category(public."IdentityFactType", public."IdentityReviewCategory", public."IdentityReviewCategory") OWNER TO p0_validator_owner;
ALTER FUNCTION public.p0_2a_identity_fact_matches_category(public."IdentityFactType", public."IdentityReviewCategory", public."IdentityReviewCategory") SECURITY INVOKER;
ALTER FUNCTION public.p0_2a_identity_fact_matches_category(public."IdentityFactType", public."IdentityReviewCategory", public."IdentityReviewCategory") SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL PRIVILEGES ON FUNCTION public.p0_2a_identity_fact_matches_category(public."IdentityFactType", public."IdentityReviewCategory", public."IdentityReviewCategory") FROM PUBLIC, :"p0_writer_role";
GRANT EXECUTE ON FUNCTION public.p0_2a_identity_fact_matches_category(public."IdentityFactType", public."IdentityReviewCategory", public."IdentityReviewCategory") TO p0_validator_owner;

REVOKE CREATE ON SCHEMA public FROM p0_validator_owner;

DO $p0_validator_post_audit$
DECLARE
  writer_name TEXT := current_setting('creditvector.p0_validator_writer_role', true);
  writer_oid OID := (SELECT oid FROM pg_roles WHERE rolname = writer_name);
  owner_oid OID := (SELECT oid FROM pg_roles WHERE rolname = 'p0_validator_owner');
  expected RECORD;
  function_oid OID;
  function_source TEXT;
  function_owner OID;
  function_definer BOOLEAN;
  function_config TEXT[];
  relation_row RECORD;
  column_row RECORD;
  sequence_row RECORD;
  namespace_row RECORD;
  readable_tables TEXT[] := ARRAY[
    'AccountPresenceObservation', 'Artifact', 'ArtifactCorrespondenceVersion',
    'CaseActionDecision', 'CaseActionSourceRef', 'ConsumerAccountReviewReceipt',
    'ConsumerAssertion', 'CreditScoreObservation', 'DerivedAccountAssessment',
    'ExtractionBureauCoverage', 'ExtractionRun', 'FieldObservation',
    'IdentityBaseline', 'IdentityBaselineAccountReviewMembership',
    'IdentityCategoryCompletion', 'IdentityCorrespondenceAssertion',
    'IdentityFact', 'ReportComparison', 'ReportIngestion', 'ReportVersion',
    'ReportVersionAccount', 'Round0SourceCompletenessEvidence'
  ];
  lock_tables TEXT[] := ARRAY[
    'AccountPresenceObservation', 'Artifact', 'CaseActionDecision',
    'ConsumerAccountReviewReceipt', 'ConsumerAssertion',
    'DerivedAccountAssessment', 'ExtractionRun', 'FieldObservation',
    'IdentityBaseline', 'IdentityCategoryCompletion',
    'IdentityCorrespondenceAssertion', 'IdentityFact', 'ReportIngestion',
    'ReportVersion', 'ReportVersionAccount', 'Round0SourceCompletenessEvidence'
  ];
  should_allow BOOLEAN;
BEGIN
  IF writer_oid IS NULL OR owner_oid IS NULL THEN
    RAISE EXCEPTION 'validator post-audit roles disappeared';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE member = owner_oid OR roleid = owner_oid
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE oid = owner_oid
      AND NOT rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreatedb
      AND NOT rolcreaterole
      AND NOT rolinherit
      AND NOT rolreplication
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'validator owner role attributes or memberships drifted';
  END IF;

  IF (SELECT count(*) FROM p0_validator_authority_table_expected) <> 30
     OR (SELECT count(*) FROM p0_validator_trigger_expected) <> 87
     OR (SELECT count(DISTINCT routine_identity) FROM p0_validator_trigger_expected) <> 37 THEN
    RAISE EXCEPTION 'trusted-writer authority table or trigger inventory count drifted';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM p0_validator_authority_table_expected expected_table
    WHERE to_regclass(format('public.%I', expected_table.table_name)) IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM p0_validator_trigger_expected expected_trigger
    WHERE to_regprocedure(expected_trigger.routine_identity) IS NULL
  ) THEN
    RAISE EXCEPTION 'trusted-writer authority trigger dependency is absent';
  END IF;

  -- Compare the entire non-internal trigger graph in both directions. Matching
  -- only the privileged function OIDs is insufficient: a differently named
  -- SECURITY DEFINER function attached to an authority table must also fail.
  IF EXISTS (
    SELECT 1
    FROM p0_validator_trigger_expected expected_trigger
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      JOIN pg_class relation ON relation.oid = trigger_row.tgrelid
      JOIN pg_namespace table_namespace ON table_namespace.oid = relation.relnamespace
      WHERE table_namespace.nspname = 'public'
        AND relation.relname = expected_trigger.table_name
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgname = expected_trigger.trigger_name
        AND trigger_row.tgfoid = to_regprocedure(expected_trigger.routine_identity)
        AND trigger_row.tgtype::INTEGER = expected_trigger.trigger_type
        AND (trigger_row.tgconstraint <> 0) = expected_trigger.is_constraint
        AND trigger_row.tgdeferrable = expected_trigger.is_deferrable
        AND trigger_row.tginitdeferred = expected_trigger.initially_deferred
        AND trigger_row.tgenabled::TEXT = expected_trigger.enabled_mode::TEXT
        AND trigger_row.tgqual IS NULL
        AND trigger_row.tgattr::TEXT = ''
        AND trigger_row.tgoldtable IS NULL
        AND trigger_row.tgnewtable IS NULL
        AND trigger_row.tgparentid = 0
        AND encode(trigger_row.tgargs, 'hex') = expected_trigger.argument_hex
    )
  ) OR EXISTS (
    SELECT 1
    FROM pg_trigger trigger_row
    JOIN pg_class relation ON relation.oid = trigger_row.tgrelid
    JOIN pg_namespace table_namespace ON table_namespace.oid = relation.relnamespace
    JOIN p0_validator_authority_table_expected authority_table
      ON authority_table.table_name = relation.relname
    WHERE table_namespace.nspname = 'public'
      AND NOT trigger_row.tgisinternal
      AND NOT EXISTS (
        SELECT 1
        FROM p0_validator_trigger_expected expected_trigger
        WHERE expected_trigger.table_name = relation.relname
          AND expected_trigger.trigger_name = trigger_row.tgname
          AND to_regprocedure(expected_trigger.routine_identity) = trigger_row.tgfoid
          AND expected_trigger.trigger_type = trigger_row.tgtype::INTEGER
          AND expected_trigger.is_constraint = (trigger_row.tgconstraint <> 0)
          AND expected_trigger.is_deferrable = trigger_row.tgdeferrable
          AND expected_trigger.initially_deferred = trigger_row.tginitdeferred
          AND expected_trigger.enabled_mode::TEXT = trigger_row.tgenabled::TEXT
          AND trigger_row.tgqual IS NULL
          AND trigger_row.tgattr::TEXT = ''
          AND trigger_row.tgoldtable IS NULL
          AND trigger_row.tgnewtable IS NULL
          AND trigger_row.tgparentid = 0
          AND expected_trigger.argument_hex = encode(trigger_row.tgargs, 'hex')
      )
  ) THEN
    RAISE EXCEPTION 'unexpected or drifted non-internal trigger on trusted-writer authority table';
  END IF;

  FOR expected IN SELECT * FROM p0_validator_expected ORDER BY identity LOOP
    function_oid := to_regprocedure(expected.identity);
    SELECT routine.prosrc, routine.proowner, routine.prosecdef, routine.proconfig
      INTO function_source, function_owner, function_definer, function_config
    FROM pg_proc routine
    WHERE routine.oid = function_oid;
    IF NOT FOUND
       OR function_owner <> owner_oid
       OR function_definer IS DISTINCT FROM expected.security_definer
       OR function_config IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::TEXT[]
       OR md5(function_source) <> expected.source_md5
       OR NOT has_function_privilege(owner_oid, function_oid, 'EXECUTE')
       OR has_function_privilege(writer_oid, function_oid, 'EXECUTE')
       OR (
         SELECT count(*)
         FROM aclexplode(COALESCE(
           (SELECT proacl FROM pg_proc WHERE oid = function_oid),
           acldefault('f', function_owner)
         )) acl
         WHERE acl.grantee = owner_oid
           AND acl.privilege_type = 'EXECUTE'
       ) <> 1
       OR EXISTS (
         SELECT 1
         FROM aclexplode(COALESCE(
           (SELECT proacl FROM pg_proc WHERE oid = function_oid),
           acldefault('f', function_owner)
         )) acl
         WHERE acl.grantee <> owner_oid
           AND acl.privilege_type = 'EXECUTE'
       )
       OR function_source ~ '(?im)^\s*(EXECUTE\s|INSERT\s+INTO\s|UPDATE\s+[^;]+\s+SET\s|DELETE\s+FROM\s|TRUNCATE\s)' THEN
      RAISE EXCEPTION 'validator catalog, ACL, config, or body audit failed: %', expected.identity;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
      AND routine.proname LIKE 'p0\_%' ESCAPE '\'
      AND routine.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM p0_validator_expected allowlist
        WHERE allowlist.security_definer
          AND to_regprocedure(allowlist.identity) = routine.oid
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE routine.proowner = owner_oid
      AND namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
      AND NOT EXISTS (
        SELECT 1 FROM p0_validator_expected allowlist
        WHERE to_regprocedure(allowlist.identity) = routine.oid
      )
  ) THEN
    RAISE EXCEPTION 'unexpected privileged P0 validator surface exists';
  END IF;

  IF has_schema_privilege(writer_oid, 'public', 'CREATE')
     OR has_database_privilege(owner_oid, current_database(), 'CREATE')
     OR has_database_privilege(owner_oid, current_database(), 'TEMPORARY') THEN
    RAISE EXCEPTION 'validator owner or writer schema/database authority is not minimal';
  END IF;

  FOR namespace_row IN
    SELECT namespace.oid, namespace.nspname
    FROM pg_namespace namespace
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
    ORDER BY namespace.nspname
  LOOP
    should_allow := namespace_row.nspname = 'public';
    IF has_schema_privilege(owner_oid, namespace_row.oid, 'USAGE')
         IS DISTINCT FROM should_allow
       OR has_schema_privilege(owner_oid, namespace_row.oid, 'USAGE WITH GRANT OPTION')
       OR has_schema_privilege(owner_oid, namespace_row.oid, 'CREATE') THEN
      RAISE EXCEPTION 'validator owner schema privilege drift on %', namespace_row.nspname;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
      AND has_function_privilege(owner_oid, routine.oid, 'EXECUTE')
      AND NOT EXISTS (
        SELECT 1 FROM p0_validator_expected allowlist
        WHERE to_regprocedure(allowlist.identity) = routine.oid
      )
  ) THEN
    RAISE EXCEPTION 'validator owner can execute an unrelated non-system routine';
  END IF;

  FOR relation_row IN
    SELECT relation.oid, relation.relname, namespace.nspname
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
    ORDER BY namespace.nspname, relation.relname
  LOOP
    should_allow := relation_row.nspname = 'public'
      AND relation_row.relname = ANY(readable_tables);
    IF has_table_privilege(owner_oid, relation_row.oid, 'SELECT') IS DISTINCT FROM should_allow
       OR has_table_privilege(owner_oid, relation_row.oid, 'SELECT WITH GRANT OPTION')
       OR has_table_privilege(owner_oid, relation_row.oid, 'INSERT')
       OR has_table_privilege(owner_oid, relation_row.oid, 'UPDATE')
       OR has_table_privilege(owner_oid, relation_row.oid, 'DELETE')
       OR has_table_privilege(owner_oid, relation_row.oid, 'TRUNCATE')
       OR has_table_privilege(owner_oid, relation_row.oid, 'REFERENCES')
       OR has_table_privilege(owner_oid, relation_row.oid, 'TRIGGER') THEN
      RAISE EXCEPTION 'validator owner table privilege drift on %.%',
        relation_row.nspname, relation_row.relname;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT expected_table
    FROM unnest(readable_tables) expected_table
    WHERE to_regclass(format('public.%I', expected_table)) IS NULL
  ) THEN
    RAISE EXCEPTION 'required validator read relation is absent';
  END IF;

  FOR column_row IN
    SELECT namespace.nspname, relation.relname, attribute.attname,
           relation.oid, attribute.attnum
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
    ORDER BY namespace.nspname, relation.relname, attribute.attnum
  LOOP
    should_allow := column_row.nspname = 'public'
      AND column_row.relname = ANY(lock_tables)
      AND column_row.attname = 'id';
    IF has_column_privilege(
         owner_oid,
         column_row.oid,
         column_row.attnum,
         'UPDATE'
       ) IS DISTINCT FROM should_allow
       OR has_column_privilege(
         owner_oid,
         column_row.oid,
         column_row.attnum,
         'UPDATE WITH GRANT OPTION'
       )
       OR has_column_privilege(owner_oid, column_row.oid, column_row.attnum, 'INSERT')
       OR has_column_privilege(owner_oid, column_row.oid, column_row.attnum, 'REFERENCES')
       OR has_column_privilege(owner_oid, column_row.oid, column_row.attnum, 'SELECT')
         IS DISTINCT FROM (
           column_row.nspname = 'public'
           AND column_row.relname = ANY(readable_tables)
         )
       OR has_column_privilege(
         owner_oid,
         column_row.oid,
         column_row.attnum,
         'SELECT WITH GRANT OPTION'
       ) THEN
      RAISE EXCEPTION 'validator owner column privilege drift on %.%.%',
        column_row.nspname, column_row.relname, column_row.attname;
    END IF;
  END LOOP;

  FOR sequence_row IN
    SELECT relation.oid, relation.relname, namespace.nspname
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
      AND relation.relkind = 'S'
  LOOP
    IF has_sequence_privilege(owner_oid, sequence_row.oid, 'SELECT')
       OR has_sequence_privilege(owner_oid, sequence_row.oid, 'USAGE')
       OR has_sequence_privilege(owner_oid, sequence_row.oid, 'UPDATE') THEN
      RAISE EXCEPTION 'validator owner unexpectedly reaches sequence %.%',
        sequence_row.nspname, sequence_row.relname;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl defaults
    CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
    WHERE privilege.grantee = owner_oid
  ) THEN
    RAISE EXCEPTION 'validator owner appears in a default ACL';
  END IF;
END;
$p0_validator_post_audit$;

COMMIT;
