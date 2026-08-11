\set ON_ERROR_STOP on

-- CREDITVECTOR P0 PHASE 2A
-- DISPOSABLE DATABASE ONLY
--
-- Verification rollback for a sentinel-named local database owned by the
-- disposable verifier role. It is not a production down migration and never
-- touches Phase 1 tables, migration history, or legacy consumer rows.

SELECT set_config(
  'creditvector.p0_2a_disposable_sentinel',
  :'p0_2a_disposable_sentinel',
  false
);

DO $$
BEGIN
  IF current_database() !~ '^p0_2a_disposable_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'DISPOSABLE DATABASE ONLY: unsafe database name';
  END IF;

  IF current_user <> 'p0_2a_disposable_verifier' THEN
    RAISE EXCEPTION 'DISPOSABLE DATABASE ONLY: unsafe database role';
  END IF;

  IF current_setting('creditvector.p0_2a_disposable_sentinel', true)
      <> 'DISPOSABLE_DATABASE_ONLY' THEN
    RAISE EXCEPTION 'DISPOSABLE DATABASE ONLY: sentinel missing';
  END IF;
END;
$$;

BEGIN;

-- Phase 2A leaf and audit tables first, then their parents.
DROP TABLE IF EXISTS "CaseActionSourceRef";
DROP TABLE IF EXISTS "CaseActionDecision";
DROP TABLE IF EXISTS "IdentityBaselineAccountReviewMembership";
DROP TABLE IF EXISTS "ConsumerAccountReviewReceipt";
DROP TABLE IF EXISTS "IdentityCorrespondenceAssertion";
DROP TABLE IF EXISTS "IdentityCategoryCompletion";
DROP TABLE IF EXISTS "Round0SourceCompletenessEvidence";
DROP TABLE IF EXISTS "BureauReportDateEvidence";
DROP TABLE IF EXISTS "P0SensitiveAccessEvent";

-- Triggers attached to frozen Phase 1 tables.
DROP TRIGGER IF EXISTS "ExtractionRun_input_artifact_trg" ON "ExtractionRun";
DROP TRIGGER IF EXISTS "CreditScoreObservation_model_evidence_trg" ON "CreditScoreObservation";
DROP TRIGGER IF EXISTS "CreditScoreObservation_h1_run_metadata_deferred_trg" ON "CreditScoreObservation";
DROP TRIGGER IF EXISTS "IdentityBaseline_h1_run_metadata_deferred_trg" ON "IdentityBaseline";
DROP TRIGGER IF EXISTS "IdentityBaseline_round0_manifest_deferred_trg" ON "IdentityBaseline";
DROP TRIGGER IF EXISTS "IdentityBaseline_source_seal_trg" ON "IdentityBaseline";
DROP TRIGGER IF EXISTS "IdentityFact_round0_category_trg" ON "IdentityFact";
DROP TRIGGER IF EXISTS "IdentityFact_round0_source_membership_deferred_trg" ON "IdentityFact";
DROP TRIGGER IF EXISTS "IdentityFact_confirmed_parent_deferred_trg" ON "IdentityFact";
DROP TRIGGER IF EXISTS "AccountPresenceObservation_round0_source_membership_trg" ON "AccountPresenceObservation";
DROP TRIGGER IF EXISTS "AccountPresenceObservation_round0_membership_deferred_trg" ON "AccountPresenceObservation";
DROP TRIGGER IF EXISTS "ReportVersionAccount_round0_category_trg" ON "ReportVersionAccount";
DROP TRIGGER IF EXISTS "ReportVersionAccount_round0_source_membership_deferred_trg" ON "ReportVersionAccount";

-- Remove foreign keys backed by additive unique indexes before dropping those
-- indexes. Repeating these guarded drops in the column section is intentional
-- and keeps each rollback stage independently auditable.
ALTER TABLE "ExtractionRun" DROP CONSTRAINT IF EXISTS "extraction_run_input_artifact_fkey";
ALTER TABLE "IdentityFact" DROP CONSTRAINT IF EXISTS "identity_fact_extraction_run_fkey";
ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "identity_baseline_confirmation_source_fkey";
ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "identity_baseline_confirmation_predecessor_fkey";
ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "identity_baseline_report_ingestion_fkey";
ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "identity_baseline_extraction_run_fkey";
ALTER TABLE "ReportIngestion" DROP CONSTRAINT IF EXISTS "report_ingestion_source_artifact_fkey";

-- Exact additive indexes on Phase 1 tables.
DROP INDEX IF EXISTS "identity_fact_assertion_pin_key";
DROP INDEX IF EXISTS "identity_baseline_attestation_pin_key";
DROP INDEX IF EXISTS "identity_fact_source_seal_pin_key";
DROP INDEX IF EXISTS "identity_baseline_source_seal_pin_key";
DROP INDEX IF EXISTS "identity_baseline_round0_source_pin_key";
DROP INDEX IF EXISTS "identity_baseline_single_successor_key";
DROP INDEX IF EXISTS "account_presence_review_pin_key";
DROP INDEX IF EXISTS "report_version_account_review_pin_key";
DROP INDEX IF EXISTS "artifact_extraction_input_pin_key";

-- Old-runtime-compatible nullable columns and their checks/FK.
ALTER TABLE "ExtractionRun" DROP CONSTRAINT IF EXISTS "extraction_run_input_artifact_fkey";
ALTER TABLE "ExtractionRun" DROP CONSTRAINT IF EXISTS "ExtractionRun_input_tuple_ck";
ALTER TABLE "ExtractionRun" DROP CONSTRAINT IF EXISTS "ExtractionRun_input_sha256_ck";
ALTER TABLE "ExtractionRun" DROP COLUMN IF EXISTS "inputArtifactId";
ALTER TABLE "ExtractionRun" DROP COLUMN IF EXISTS "inputSha256";
ALTER TABLE "ExtractionRun" DROP COLUMN IF EXISTS "inputRepresentation";

ALTER TABLE "IdentityFact" DROP CONSTRAINT IF EXISTS "IdentityFact_integrity_sha256_ck";
ALTER TABLE "IdentityFact" DROP CONSTRAINT IF EXISTS "IdentityFact_source_seal_tuple_ck";
ALTER TABLE "IdentityFact" DROP CONSTRAINT IF EXISTS "identity_fact_extraction_run_fkey";
ALTER TABLE "IdentityFact" DROP COLUMN IF EXISTS "reviewCategory";
ALTER TABLE "IdentityFact" DROP COLUMN IF EXISTS "integritySha256";
ALTER TABLE "IdentityFact" DROP COLUMN IF EXISTS "extractionRunId";
ALTER TABLE "IdentityFact" DROP COLUMN IF EXISTS "baselineInputSetSha256";

ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "identity_baseline_confirmation_source_fkey";
ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "identity_baseline_confirmation_predecessor_fkey";
ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "identity_baseline_report_ingestion_fkey";
ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "identity_baseline_extraction_run_fkey";
ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "IdentityBaseline_confirmation_seal_ck";
ALTER TABLE "IdentityBaseline" DROP CONSTRAINT IF EXISTS "IdentityBaseline_source_ingestion_tuple_ck";
ALTER TABLE "IdentityBaseline" DROP COLUMN IF EXISTS "sourceIdentityBaselineId";
ALTER TABLE "IdentityBaseline" DROP COLUMN IF EXISTS "supersedesIdentityBaselineId";
ALTER TABLE "IdentityBaseline" DROP COLUMN IF EXISTS "semanticSha256";
ALTER TABLE "IdentityBaseline" DROP COLUMN IF EXISTS "expectedIdentityFactCount";
ALTER TABLE "IdentityBaseline" DROP COLUMN IF EXISTS "expectedCategoryCompletionCount";
ALTER TABLE "IdentityBaseline" DROP COLUMN IF EXISTS "expectedAccountReviewReceiptCount";
ALTER TABLE "IdentityBaseline" DROP COLUMN IF EXISTS "reportIngestionId";
ALTER TABLE "IdentityBaseline" DROP COLUMN IF EXISTS "extractionRunId";

-- IdentityBaseline no longer references the durable queue; it is now safe to
-- remove the Phase 2A-only parent without CASCADE.
DROP TABLE IF EXISTS "ReportIngestion";

ALTER TABLE "CreditScoreObservation" DROP CONSTRAINT IF EXISTS "CreditScoreObservation_model_evidence_ck";
ALTER TABLE "CreditScoreObservation" DROP COLUMN IF EXISTS "scoreModelPresence";
ALTER TABLE "CreditScoreObservation" DROP COLUMN IF EXISTS "scoreModelEvidenceValue";
ALTER TABLE "CreditScoreObservation" DROP COLUMN IF EXISTS "scoreModelSourceLocatorToken";

ALTER TABLE "ConsumerAssertion" DROP CONSTRAINT IF EXISTS "ConsumerAssertion_integrity_sha256_ck";
ALTER TABLE "ConsumerAssertion" DROP COLUMN IF EXISTS "integritySha256";

-- Functions are unreferenced after the owning triggers/tables are removed.
DROP FUNCTION IF EXISTS p0_2a_validate_sensitive_access_event();
DROP FUNCTION IF EXISTS p0_2a_validate_case_action_source_membership();
DROP FUNCTION IF EXISTS p0_2a_validate_case_action_source_ref();
DROP FUNCTION IF EXISTS p0_2a_validate_case_action_decision();
DROP FUNCTION IF EXISTS p0_2a_validate_consumer_account_review();
DROP FUNCTION IF EXISTS p0_2a_validate_identity_baseline_account_review_membership();
DROP FUNCTION IF EXISTS p0_2a_validate_confirmed_baseline_child_deferred();
DROP FUNCTION IF EXISTS p0_2a_validate_identity_correspondence_assertion();
DROP FUNCTION IF EXISTS p0_2a_reject_account_after_identity_completion();
DROP FUNCTION IF EXISTS p0_2a_reject_account_presence_after_source_completeness();
DROP FUNCTION IF EXISTS p0_2a_validate_identity_category_completion();
DROP FUNCTION IF EXISTS p0_2a_validate_identity_fact_insert();
DROP FUNCTION IF EXISTS p0_2a_identity_fact_matches_category("IdentityFactType", "IdentityReviewCategory", "IdentityReviewCategory");
DROP FUNCTION IF EXISTS p0_2a_validate_report_ingestion_mutation();
DROP FUNCTION IF EXISTS p0_2a_validate_identity_baseline_source_seal();
DROP FUNCTION IF EXISTS p0_2a_validate_round0_source_seal_deferred();
DROP FUNCTION IF EXISTS p0_2a_validate_round0_source_completeness();
DROP FUNCTION IF EXISTS p0_2a_validate_h1_run_metadata_deferred();
DROP FUNCTION IF EXISTS p0_2a_validate_bureau_report_date();
DROP FUNCTION IF EXISTS p0_2a_validate_score_model_evidence();
DROP FUNCTION IF EXISTS p0_2a_validate_extraction_input();

-- Phase 2A-only enums, reverse creation/dependency order.
DROP TYPE IF EXISTS "P0SensitiveResourceType";
DROP TYPE IF EXISTS "P0SensitiveAccessReasonCode";
DROP TYPE IF EXISTS "P0SensitiveAccessDecision";
DROP TYPE IF EXISTS "P0SensitiveAccessPurposeCode";
DROP TYPE IF EXISTS "P0SensitiveAccessKind";
DROP TYPE IF EXISTS "CaseActionSourceType";
DROP TYPE IF EXISTS "CaseActionCode";
DROP TYPE IF EXISTS "CaseActionDecisionState";
DROP TYPE IF EXISTS "IdentityCorrespondencePurpose";
DROP TYPE IF EXISTS "ConsumerAccountReviewState";
DROP TYPE IF EXISTS "IdentityCorrespondenceAssertionStatus";
DROP TYPE IF EXISTS "IdentityCategoryCompletionDisposition";
DROP TYPE IF EXISTS "IdentityReviewCategory";
DROP TYPE IF EXISTS "P0AuthorizationKind";
DROP TYPE IF EXISTS "CreditScoreModelPresence";
DROP TYPE IF EXISTS "ReportDatePrecision";
DROP TYPE IF EXISTS "ReportDateEvidencePresence";
DROP TYPE IF EXISTS "ReportSourceDisposition";
DROP TYPE IF EXISTS "ExtractionInputRepresentation";
DROP TYPE IF EXISTS "ReportIngestionState";

COMMIT;
