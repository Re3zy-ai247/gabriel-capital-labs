\set ON_ERROR_STOP on

-- CREDITVECTOR P0 PHASE 1
-- DISPOSABLE DATABASE ONLY
--
-- This is not a production down migration. It is a verification-only rollback
-- used by scripts/p0-phase1-migration-verify.sh against a sentinel-named local
-- database owned by the disposable verification role. It removes exactly the
-- objects introduced by 20260808_p0_credit_truth_foundation, with no CASCADE.

SELECT set_config(
  'creditvector.p0_disposable_sentinel',
  :'p0_disposable_sentinel',
  false
);

DO $$
BEGIN
  IF current_database() !~ '^p0_disposable_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'DISPOSABLE DATABASE ONLY: unsafe database name';
  END IF;

  IF current_user <> 'p0_disposable_verifier' THEN
    RAISE EXCEPTION 'DISPOSABLE DATABASE ONLY: unsafe database role';
  END IF;

  IF current_setting('creditvector.p0_disposable_sentinel', true)
      <> 'DISPOSABLE_DATABASE_ONLY' THEN
    RAISE EXCEPTION 'DISPOSABLE DATABASE ONLY: sentinel missing';
  END IF;
END;
$$;

BEGIN;

-- Leaf/event objects first.
DROP TABLE IF EXISTS "EvidenceEvent";
DROP TABLE IF EXISTS "ArtifactTombstone";
DROP TABLE IF EXISTS "PacketEnclosure";
DROP TABLE IF EXISTS "ArtifactCorrespondenceVersion";

-- Immutable artifact and correspondence graph.
-- Artifact has an exact membership FK into PacketCorrespondenceVersion, so the
-- artifact parent must be removed before that packet-membership target.
DROP TABLE IF EXISTS "Artifact";
DROP TABLE IF EXISTS "PacketCorrespondenceVersion";
DROP TABLE IF EXISTS "Packet";

-- Post-report comparison and outcome graph.
DROP TABLE IF EXISTS "DisputeOutcome";
DROP TABLE IF EXISTS "ReportDifference";
DROP TABLE IF EXISTS "ReportComparison";
DROP TABLE IF EXISTS "CreditScoreObservation";

DROP TABLE IF EXISTS "CorrespondenceVersionItem";
DROP TABLE IF EXISTS "CorrespondenceVersion";
DROP TABLE IF EXISTS "CorrespondenceItem";
DROP TABLE IF EXISTS "Correspondence";
DROP TABLE IF EXISTS "DisputeCase";

-- Versioned identity and recipient graph.
DROP TABLE IF EXISTS "RecipientAddressVersion";
DROP TABLE IF EXISTS "Recipient";
DROP TABLE IF EXISTS "IdentityFact";
DROP TABLE IF EXISTS "IdentityBaseline";

-- Truth, assertion, and assessment graph.
DROP TABLE IF EXISTS "ConsumerAssertion";
DROP TABLE IF EXISTS "DerivedAccountAssessment";
DROP TABLE IF EXISTS "HistoricalEvidence";
DROP TABLE IF EXISTS "FieldObservation";
DROP TABLE IF EXISTS "AccountPresenceObservation";
DROP TABLE IF EXISTS "SectionCompleteness";
DROP TABLE IF EXISTS "ReportVersionAccount";
DROP TABLE IF EXISTS "Account";
DROP TABLE IF EXISTS "ExtractionBureauCoverage";
DROP TABLE IF EXISTS "ExtractionRun";
DROP TABLE IF EXISTS "ReportVersion";
DROP TABLE IF EXISTS "CreditTruthScope";

-- The forward migration adds only these two indexes to baseline tables.
DROP INDEX IF EXISTS "Tradeline_userId_id_p0_key";
DROP INDEX IF EXISTS "Report_userId_id_p0_key";

-- Trigger functions are unreferenced after their owning tables are gone.
DROP FUNCTION IF EXISTS p0_forbid_immutable_mutation();
DROP FUNCTION IF EXISTS p0_validate_artifact_seal();
DROP FUNCTION IF EXISTS p0_validate_packet_seal();
DROP FUNCTION IF EXISTS p0_validate_correspondence_version_seal();
DROP FUNCTION IF EXISTS p0_validate_artifact_correspondence_context();
DROP FUNCTION IF EXISTS p0_validate_canonical_artifact_context();
DROP FUNCTION IF EXISTS p0_validate_packet_correspondence_approval();
DROP FUNCTION IF EXISTS p0_validate_approved_mailing_context();
DROP FUNCTION IF EXISTS p0_validate_correspondence_version_supersession();
DROP FUNCTION IF EXISTS p0_validate_correspondence_item_recipient_bureau();
DROP FUNCTION IF EXISTS p0_validate_correspondence_recipient_update();
DROP FUNCTION IF EXISTS p0_validate_dispute_outcome_insert();
DROP FUNCTION IF EXISTS p0_reject_post_comparison_identity_input();
DROP FUNCTION IF EXISTS p0_validate_report_comparison_seal();
DROP FUNCTION IF EXISTS p0_validate_report_difference_insert();
DROP FUNCTION IF EXISTS p0_map_score_completeness("CreditScoreEvidenceCompleteness");
DROP FUNCTION IF EXISTS p0_map_section_completeness("SectionExtractionStatus");
DROP FUNCTION IF EXISTS p0_validate_report_comparison_insert();
DROP FUNCTION IF EXISTS p0_validate_credit_score_insert();
DROP FUNCTION IF EXISTS p0_validate_consumer_assertion_supersession();
DROP FUNCTION IF EXISTS p0_validate_assessment_insert();
DROP FUNCTION IF EXISTS p0_reject_post_assessment_coverage();
DROP FUNCTION IF EXISTS p0_reject_post_assessment_account_input();
DROP FUNCTION IF EXISTS p0_reject_if_run_is_compared(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS p0_lock_assessment_input(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS p0_lock_extraction_run(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS p0_validate_extraction_bureau_coverage();
DROP FUNCTION IF EXISTS p0_validate_v2_account_membership();
DROP FUNCTION IF EXISTS p0_validate_report_account_subject();
DROP FUNCTION IF EXISTS p0_validate_v2_truth_insert();
DROP FUNCTION IF EXISTS p0_validate_credit_truth_scope();

-- P0-only enums, reverse creation order. Bureau remains a baseline enum.
DROP TYPE IF EXISTS "EvidenceSubjectType";
DROP TYPE IF EXISTS "EvidenceEventType";
DROP TYPE IF EXISTS "PacketEnclosureKind";
DROP TYPE IF EXISTS "ArtifactKind";
DROP TYPE IF EXISTS "PacketStatus";
DROP TYPE IF EXISTS "CorrespondenceStatus";
DROP TYPE IF EXISTS "DisputeCaseStatus";
DROP TYPE IF EXISTS "RecipientAddressStatus";
DROP TYPE IF EXISTS "RecipientType";
DROP TYPE IF EXISTS "IdentityFactClassification";
DROP TYPE IF EXISTS "IdentityFactType";
DROP TYPE IF EXISTS "IdentityBaselineStatus";
DROP TYPE IF EXISTS "ConsumerAssertionDisposition";
DROP TYPE IF EXISTS "OutcomeDecisionSource";
DROP TYPE IF EXISTS "OutcomeCausalityState";
DROP TYPE IF EXISTS "DisputeOutcomeState";
DROP TYPE IF EXISTS "DeletionInferenceState";
DROP TYPE IF EXISTS "ReportDifferenceState";
DROP TYPE IF EXISTS "DifferenceComparability";
DROP TYPE IF EXISTS "ReportDifferenceChangeKind";
DROP TYPE IF EXISTS "ReportDifferenceScope";
DROP TYPE IF EXISTS "ComparisonSourcePolicy";
DROP TYPE IF EXISTS "ComparisonEvidenceCompleteness";
DROP TYPE IF EXISTS "ReportComparisonState";
DROP TYPE IF EXISTS "ComparisonChronologyBasis";
DROP TYPE IF EXISTS "ReportComparisonPurpose";
DROP TYPE IF EXISTS "ScoreModelMetadataCompleteness";
DROP TYPE IF EXISTS "CreditScoreEvidenceCompleteness";
DROP TYPE IF EXISTS "CreditScorePresence";
DROP TYPE IF EXISTS "CreditScoreEvidenceRole";
DROP TYPE IF EXISTS "CreditScoreSourceType";
DROP TYPE IF EXISTS "AssessmentEvidenceCompleteness";
DROP TYPE IF EXISTS "ReportedAdversity";
DROP TYPE IF EXISTS "DisputeGrounds";
DROP TYPE IF EXISTS "AccountCondition";
DROP TYPE IF EXISTS "HistoricalEvidenceType";
DROP TYPE IF EXISTS "ObservationValueType";
DROP TYPE IF EXISTS "EncryptionAlgorithm";
DROP TYPE IF EXISTS "ObservationAssessmentSignal";
DROP TYPE IF EXISTS "ReportAccountMembershipOrigin";
DROP TYPE IF EXISTS "BureauCoverageStatus";
DROP TYPE IF EXISTS "CreditReportSection";
DROP TYPE IF EXISTS "SectionExtractionStatus";
DROP TYPE IF EXISTS "ObservationPresence";
DROP TYPE IF EXISTS "ExtractionRunStatus";
DROP TYPE IF EXISTS "ExtractionEngine";
DROP TYPE IF EXISTS "ReportDateProvenance";
DROP TYPE IF EXISTS "ReportVersionOrigin";
DROP TYPE IF EXISTS "TruthAuthorityStatus";

COMMIT;
