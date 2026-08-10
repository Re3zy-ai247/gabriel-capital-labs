-- CREDITVECTOR P0 PHASE 1 — ADDITIVE CREDIT TRUTH FOUNDATION
-- DISPOSABLE DATABASE ONLY during Phase 1. Owner-gated production application is
-- explicitly outside this authorization.
--
-- Additive-only: new enums, new tables, indexes, constraints and triggers. This
-- migration does not alter, rewrite, backfill, rename or delete any existing row.
-- Existing Report/Tradeline data remains LEGACY_UNVERIFIED unless a separately
-- authorized reanalysis creates new immutable v2 records.

-- CreateEnum
CREATE TYPE "TruthAuthorityStatus" AS ENUM ('LEGACY_UNVERIFIED', 'SHADOW_V2', 'AUTHORITATIVE_V2');

-- CreateEnum
CREATE TYPE "ReportVersionOrigin" AS ENUM ('LEGACY_IMPORT', 'NEW_UPLOAD', 'AUTHORIZED_REANALYSIS', 'SYNTHETIC_TEST');

-- CreateEnum: upload time is never substituted for the source report date.
CREATE TYPE "ReportDateProvenance" AS ENUM ('SOURCE_REPORTED', 'EXPLICIT_NOT_PROVIDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ExtractionEngine" AS ENUM ('AI_V2', 'REGEX_V2', 'HYBRID_V2');

-- CreateEnum
CREATE TYPE "ExtractionRunStatus" AS ENUM ('SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ObservationPresence" AS ENUM ('PRESENT', 'ABSENT_CONFIRMED', 'UNKNOWN');

-- CreateEnum: exact parser-v2 SectionCompletenessState mirror.
CREATE TYPE "SectionExtractionStatus" AS ENUM ('COMPLETE', 'PARTIAL', 'FAILED', 'NOT_PROVIDED', 'UNKNOWN');

-- CreateEnum: exact parser-v2 CREDIT_TRUTH_SECTIONS mirror.
CREATE TYPE "CreditReportSection" AS ENUM ('ACCOUNT_INDEX', 'ACCOUNT_SUMMARY', 'ACCOUNT_DETAIL', 'PAYMENT_HISTORY', 'COLLECTIONS', 'REMARKS');

-- CreateEnum
CREATE TYPE "BureauCoverageStatus" AS ENUM ('COVERED', 'OUTSIDE_COVERAGE');

-- CreateEnum
CREATE TYPE "ReportAccountMembershipOrigin" AS ENUM ('SOURCE_LISTED', 'COMPARISON_CARRY_FORWARD');

-- CreateEnum
CREATE TYPE "ObservationAssessmentSignal" AS ENUM ('ADVERSE', 'AFFIRMATIVE_NON_ADVERSE', 'NEUTRAL', 'CONTEXT_ONLY', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "EncryptionAlgorithm" AS ENUM ('AES_256_GCM');

-- CreateEnum
CREATE TYPE "ObservationValueType" AS ENUM ('TEXT', 'MONEY_CENTS', 'DATE', 'BOOLEAN', 'INTEGER', 'ENUM_CODE', 'JSON');

-- CreateEnum
CREATE TYPE "HistoricalEvidenceType" AS ENUM ('COLLECTION', 'CHARGE_OFF', 'DELINQUENCY', 'SEVERE_DELINQUENCY', 'LOSS', 'TRANSFER_OR_SALE', 'CONSUMER_DISPUTE_REMARK', 'OTHER_ADVERSE', 'OTHER_NON_ADVERSE');

-- CreateEnum
CREATE TYPE "AccountCondition" AS ENUM ('CLEAN', 'DEROGATORY', 'MIXED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "DisputeGrounds" AS ENUM ('STRONG', 'MODERATE', 'LIMITED', 'NONE_DETECTED', 'CONSUMER_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "ReportedAdversity" AS ENUM ('ADVERSE', 'POTENTIALLY_ADVERSE', 'NEUTRAL', 'FAVORABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AssessmentEvidenceCompleteness" AS ENUM ('COMPLETE', 'INCOMPLETE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CreditScoreSourceType" AS ENUM ('REPORT_DERIVED', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "CreditScoreEvidenceRole" AS ENUM ('PRIMARY_REPORT_EVIDENCE', 'SECONDARY_MANUAL_CONTEXT');

-- CreateEnum
CREATE TYPE "CreditScorePresence" AS ENUM ('SCORE_REPORTED', 'SCORE_NOT_PROVIDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CreditScoreEvidenceCompleteness" AS ENUM ('COMPLETE', 'PARTIAL', 'NOT_PROVIDED', 'UNKNOWN', 'MANUAL_UNVERIFIED');

-- CreateEnum
CREATE TYPE "ScoreModelMetadataCompleteness" AS ENUM ('COMPLETE', 'PARTIAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReportComparisonPurpose" AS ENUM ('EXTRACTION_RECONCILIATION', 'TEMPORAL_REPORT_CHANGE');

-- CreateEnum
CREATE TYPE "ComparisonChronologyBasis" AS ENUM ('SAME_SERIES_VERSION_ORDER', 'NOT_ESTABLISHED');

-- CreateEnum
CREATE TYPE "ReportComparisonState" AS ENUM ('PENDING_EVIDENCE', 'COMPARABLE', 'PARTIALLY_COMPARABLE', 'NOT_COMPARABLE');

-- CreateEnum
CREATE TYPE "ComparisonEvidenceCompleteness" AS ENUM ('COMPLETE', 'PARTIAL', 'INCOMPLETE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ComparisonSourcePolicy" AS ENUM ('REPORT_DERIVED_ONLY');

-- CreateEnum
CREATE TYPE "ReportDifferenceScope" AS ENUM ('ACCOUNT_PRESENCE', 'FIELD_VALUE', 'CREDIT_SCORE', 'BUREAU_COVERAGE', 'IDENTITY_FACT');

-- CreateEnum
CREATE TYPE "ReportDifferenceChangeKind" AS ENUM ('NEW_ITEM', 'NO_LONGER_REPORTED', 'STATUS_CHANGED', 'BALANCE_CHANGED', 'PAYMENT_HISTORY_CHANGED', 'REMARK_CHANGED', 'DISPUTE_NOTATION_CHANGED', 'BUREAU_COVERAGE_CHANGED', 'IDENTITY_INFORMATION_CHANGED', 'SCORE_CHANGED', 'OTHER_FIELD_CHANGED', 'UNCHANGED', 'UNABLE_TO_DETERMINE');

-- CreateEnum
CREATE TYPE "DifferenceComparability" AS ENUM ('COMPARABLE', 'PARTIAL', 'NOT_COMPARABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReportDifferenceState" AS ENUM ('CHANGED', 'UNCHANGED', 'NOT_COMPARABLE', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "DeletionInferenceState" AS ENUM ('NOT_APPLICABLE', 'ABSENT_CONFIRMED_ON_CURRENT_REPORT', 'PRESENT_ON_CURRENT_REPORT', 'UNKNOWN_INCOMPLETE');

-- CreateEnum
CREATE TYPE "DisputeOutcomeState" AS ENUM ('PENDING_EVIDENCE', 'CORRECTED', 'DELETED', 'UNCHANGED', 'CHANGED_DIFFERENTLY', 'NO_LONGER_REPORTED', 'NEW_CONFLICT', 'UNABLE_TO_DETERMINE');

-- CreateEnum
CREATE TYPE "OutcomeCausalityState" AS ENUM ('NO_CAUSAL_CLAIM', 'TEMPORAL_ASSOCIATION_ONLY', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "OutcomeDecisionSource" AS ENUM ('SYSTEM_DERIVED', 'HUMAN_CONFIRMED');

-- CreateEnum
CREATE TYPE "ConsumerAssertionDisposition" AS ENUM ('CONFIRMED_ACCURATE', 'CONFIRMED_INACCURATE', 'NOT_MINE', 'OUTDATED_UPDATE_REQUESTED', 'REVIEW_NEEDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "IdentityBaselineStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "IdentityFactType" AS ENUM ('NAME', 'ADDRESS', 'EMPLOYMENT', 'IDENTIFIER', 'OTHER');

-- CreateEnum
CREATE TYPE "IdentityFactClassification" AS ENUM ('CORRECT_CURRENT', 'CORRECT_FORMER', 'INCORRECT', 'NEVER_MINE', 'OUTDATED_UPDATE_REQUESTED', 'REVIEW_NEEDED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('CREDIT_REPORTING_AGENCY', 'FURNISHER', 'COLLECTOR', 'REGULATOR', 'CONSUMER', 'OTHER');

-- CreateEnum
CREATE TYPE "RecipientAddressStatus" AS ENUM ('UNVERIFIED', 'VALIDATED', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "DisputeCaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CorrespondenceStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'VOID');

-- CreateEnum
CREATE TYPE "PacketStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED', 'VOID');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('REPORT_SOURCE', 'CANONICAL_PACKET_PDF', 'ENCLOSURE', 'RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "PacketEnclosureKind" AS ENUM ('IDENTITY_PROOF', 'ADDRESS_PROOF', 'REPORT_EXCERPT', 'SUPPORTING_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceEventType" AS ENUM ('REPORT_VERSION_CREATED', 'EXTRACTION_COMPLETED', 'OBSERVATION_RECORDED', 'ASSESSMENT_CREATED', 'ASSERTION_RECORDED', 'IDENTITY_BASELINE_CREATED', 'CASE_STATUS_CHANGED', 'CORRESPONDENCE_CREATED', 'CORRESPONDENCE_VERSION_CREATED', 'PACKET_CREATED', 'PACKET_APPROVED', 'ARTIFACT_CREATED', 'ARTIFACT_TOMBSTONED', 'MAIL_STATUS_RECORDED', 'CREDIT_SCORE_OBSERVED', 'REPORT_COMPARISON_CREATED', 'REPORT_DIFFERENCE_CREATED', 'DISPUTE_OUTCOME_RECORDED');

-- CreateEnum
CREATE TYPE "EvidenceSubjectType" AS ENUM ('REPORT_VERSION', 'EXTRACTION_RUN', 'ACCOUNT', 'ACCOUNT_PRESENCE_OBSERVATION', 'FIELD_OBSERVATION', 'HISTORICAL_EVIDENCE', 'DERIVED_ACCOUNT_ASSESSMENT', 'CONSUMER_ASSERTION', 'IDENTITY_BASELINE', 'DISPUTE_CASE', 'CORRESPONDENCE', 'CORRESPONDENCE_VERSION', 'PACKET', 'ARTIFACT', 'CREDIT_SCORE_OBSERVATION', 'REPORT_COMPARISON', 'REPORT_DIFFERENCE', 'DISPUTE_OUTCOME');

-- CreateTable
CREATE TABLE "CreditTruthScope" (
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTruthScope_pkey" PRIMARY KEY ("tenantId","consumerId")
);

-- CreateTable
CREATE TABLE "ReportVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "sourceReportId" TEXT,
    "reportSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "origin" "ReportVersionOrigin" NOT NULL DEFAULT 'LEGACY_IMPORT',
    "authorityStatus" "TruthAuthorityStatus" NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
    "schemaVersion" TEXT NOT NULL,
    "inputSha256" VARCHAR(64) NOT NULL,
    "reportDateProvenance" "ReportDateProvenance" NOT NULL DEFAULT 'UNKNOWN',
    "reportDate" DATE,
    "reportDateSourceLocator" TEXT,
    "reportDateRuleKey" TEXT,
    "reportDateRuleVersion" TEXT,
    "reanalysisAuthorizationRef" TEXT,
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReportVersion_version_ck" CHECK ("version" > 0),
    CONSTRAINT "ReportVersion_input_sha256_ck" CHECK ("inputSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ReportVersion_legacy_authority_ck" CHECK ("origin" <> 'LEGACY_IMPORT' OR "authorityStatus" = 'LEGACY_UNVERIFIED'),
    CONSTRAINT "ReportVersion_authoritative_origin_ck" CHECK ("authorityStatus" <> 'AUTHORITATIVE_V2' OR "origin" IN ('NEW_UPLOAD', 'AUTHORIZED_REANALYSIS')),
    CONSTRAINT "ReportVersion_reanalysis_auth_ck" CHECK ("origin" <> 'AUTHORIZED_REANALYSIS' OR "reanalysisAuthorizationRef" IS NOT NULL),
    CONSTRAINT "ReportVersion_report_date_ck" CHECK (
      (
        "reportDateProvenance" = 'SOURCE_REPORTED'
        AND "reportDate" IS NOT NULL
        AND "reportDateSourceLocator" IS NOT NULL
        AND "reportDateRuleKey" IS NOT NULL
        AND "reportDateRuleVersion" IS NOT NULL
      )
      OR
      (
        "reportDateProvenance" = 'EXPLICIT_NOT_PROVIDED'
        AND "reportDate" IS NULL
        AND "reportDateSourceLocator" IS NOT NULL
        AND "reportDateRuleKey" IS NOT NULL
        AND "reportDateRuleVersion" IS NOT NULL
      )
      OR
      (
        "reportDateProvenance" = 'UNKNOWN'
        AND "reportDate" IS NULL
        AND (
          ("reportDateSourceLocator" IS NULL AND "reportDateRuleKey" IS NULL AND "reportDateRuleVersion" IS NULL)
          OR
          ("reportDateSourceLocator" IS NOT NULL AND "reportDateRuleKey" IS NOT NULL AND "reportDateRuleVersion" IS NOT NULL)
        )
      )
    )
);

-- CreateTable
CREATE TABLE "ExtractionRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "engine" "ExtractionEngine" NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "status" "ExtractionRunStatus" NOT NULL,
    "errorCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExtractionRun_attempt_ck" CHECK ("attempt" > 0),
    CONSTRAINT "ExtractionRun_time_ck" CHECK ("completedAt" >= "startedAt")
);

-- CreateTable
CREATE TABLE "ExtractionBureauCoverage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "coverageStatus" "BureauCoverageStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionBureauCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "legacyTradelineId" TEXT,
    "authorityStatus" "TruthAuthorityStatus" NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Account_legacy_authority_ck" CHECK ("legacyTradelineId" IS NULL OR "authorityStatus" = 'LEGACY_UNVERIFIED')
);

-- CreateTable
CREATE TABLE "ReportVersionAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceAccountOrdinal" INTEGER,
    "membershipOrigin" "ReportAccountMembershipOrigin" NOT NULL,
    "authorityStatus" "TruthAuthorityStatus" NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportVersionAccount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReportVersionAccount_membership_ck" CHECK (
      ("membershipOrigin" = 'SOURCE_LISTED' AND "sourceAccountOrdinal" IS NOT NULL AND "sourceAccountOrdinal" >= 0)
      OR
      ("membershipOrigin" = 'COMPARISON_CARRY_FORWARD' AND "sourceAccountOrdinal" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "AccountPresenceObservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "bureauCoverageId" TEXT NOT NULL,
    "coverageStatus" "BureauCoverageStatus" NOT NULL,
    "presence" "ObservationPresence" NOT NULL,
    "observationSeriesKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "integritySha256" VARCHAR(64) NOT NULL,
    "sourceLocatorToken" TEXT,
    "parserConfidence" DECIMAL(5,4),
    "errorCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "accountIndexReportSection" "CreditReportSection" NOT NULL DEFAULT 'ACCOUNT_INDEX',
    "accountIndexStatus" "SectionExtractionStatus",
    "accountIndexCompletenessId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountPresenceObservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountPresenceObservation_revision_ck" CHECK ("revision" > 0),
    CONSTRAINT "AccountPresenceObservation_integrity_sha256_ck" CHECK ("integritySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "AccountPresenceObservation_confidence_ck" CHECK ("parserConfidence" IS NULL OR ("parserConfidence" >= 0 AND "parserConfidence" <= 1)),
    CONSTRAINT "AccountPresenceObservation_locator_ck" CHECK ("presence" = 'UNKNOWN' OR "sourceLocatorToken" IS NOT NULL),
    CONSTRAINT "AccountPresenceObservation_coverage_ck" CHECK ("coverageStatus" = 'COVERED' OR ("presence" = 'UNKNOWN' AND "sourceLocatorToken" IS NULL)),
    CONSTRAINT "AccountPresenceObservation_index_pair_ck" CHECK (("accountIndexStatus" IS NULL) = ("accountIndexCompletenessId" IS NULL)),
    CONSTRAINT "AccountPresenceObservation_index_section_ck" CHECK ("accountIndexReportSection" = 'ACCOUNT_INDEX'),
    CONSTRAINT "AccountPresenceObservation_absence_ck" CHECK ("presence" <> 'ABSENT_CONFIRMED' OR ("accountIndexStatus" = 'COMPLETE' AND "accountIndexCompletenessId" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "FieldObservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "bureauCoverageId" TEXT NOT NULL,
    "coverageStatus" "BureauCoverageStatus" NOT NULL,
    "observationSeriesKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "integritySha256" VARCHAR(64) NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "reportSection" "CreditReportSection" NOT NULL,
    "sectionStatus" "SectionExtractionStatus" NOT NULL,
    "sectionCompletenessId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "occurrence" INTEGER NOT NULL DEFAULT 0,
    "presence" "ObservationPresence" NOT NULL,
    "valueType" "ObservationValueType" NOT NULL,
    "valueCiphertext" BYTEA,
    "valueIv" BYTEA,
    "valueAuthTag" BYTEA,
    "valueKeyVersion" TEXT,
    "valueAlgorithm" "EncryptionAlgorithm",
    "valueEnvelopeVersion" TEXT,
    "valueAadVersion" TEXT,
    "normalizedCiphertext" BYTEA,
    "normalizedIv" BYTEA,
    "normalizedAuthTag" BYTEA,
    "normalizedKeyVersion" TEXT,
    "normalizedAlgorithm" "EncryptionAlgorithm",
    "normalizedEnvelopeVersion" TEXT,
    "normalizedAadVersion" TEXT,
    "assessmentSignal" "ObservationAssessmentSignal" NOT NULL DEFAULT 'UNCLASSIFIED',
    "sourceLocatorToken" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "sectionOrdinal" INTEGER,
    "recordOrdinal" INTEGER,
    "fieldOrdinal" INTEGER,
    "normalizationRuleKey" TEXT NOT NULL,
    "normalizationRuleVersion" TEXT NOT NULL,
    "parserConfidence" DECIMAL(5,4),
    "errorCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldObservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FieldObservation_occurrence_ck" CHECK ("occurrence" >= 0),
    CONSTRAINT "FieldObservation_revision_ck" CHECK ("revision" > 0),
    CONSTRAINT "FieldObservation_integrity_sha256_ck" CHECK ("integritySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "FieldObservation_confidence_ck" CHECK ("parserConfidence" IS NULL OR ("parserConfidence" >= 0 AND "parserConfidence" <= 1)),
    CONSTRAINT "FieldObservation_page_ck" CHECK ("pageNumber" IS NULL OR "pageNumber" > 0),
    CONSTRAINT "FieldObservation_coordinate_ck" CHECK (("sectionOrdinal" IS NULL OR "sectionOrdinal" >= 0) AND ("recordOrdinal" IS NULL OR "recordOrdinal" >= 0) AND ("fieldOrdinal" IS NULL OR "fieldOrdinal" >= 0)),
    CONSTRAINT "FieldObservation_coverage_ck" CHECK ("coverageStatus" = 'COVERED'),
    CONSTRAINT "FieldObservation_confirmed_absence_section_ck" CHECK ("presence" <> 'ABSENT_CONFIRMED' OR "sectionStatus" = 'COMPLETE'),
    CONSTRAINT "FieldObservation_primary_section_ck" CHECK (
      ("fieldKey" = 'summaryStatus' AND "reportSection" = 'ACCOUNT_SUMMARY')
      OR ("fieldKey" = 'detailedStatus' AND "reportSection" = 'ACCOUNT_DETAIL')
      OR ("fieldKey" IN ('balanceCents', 'reportedDate') AND "reportSection" = 'ACCOUNT_SUMMARY')
      OR ("fieldKey" IN ('dofd', 'relevantDates', 'chargeOffMarker', 'lossReported', 'productType') AND "reportSection" = 'ACCOUNT_DETAIL')
      OR ("fieldKey" = 'paymentHistory' AND "reportSection" = 'PAYMENT_HISTORY')
      OR ("fieldKey" = 'collectionFacts' AND "reportSection" = 'COLLECTIONS')
      OR ("fieldKey" IN ('transferOrSale', 'consumerDisputeRemarks', 'remarks') AND "reportSection" = 'REMARKS')
      OR "fieldKey" NOT IN ('summaryStatus', 'detailedStatus', 'balanceCents', 'reportedDate', 'dofd', 'relevantDates', 'paymentHistory', 'collectionFacts', 'chargeOffMarker', 'lossReported', 'transferOrSale', 'consumerDisputeRemarks', 'productType', 'remarks')
    ),
    CONSTRAINT "FieldObservation_signal_ck" CHECK (
      ("assessmentSignal" NOT IN ('ADVERSE', 'AFFIRMATIVE_NON_ADVERSE') OR "presence" = 'PRESENT')
      AND ("assessmentSignal" <> 'AFFIRMATIVE_NON_ADVERSE' OR "fieldKey" IN ('summaryStatus', 'detailedStatus'))
    ),
    CONSTRAINT "FieldObservation_value_envelope_ck" CHECK (
      ("presence" = 'PRESENT' AND "valueCiphertext" IS NOT NULL AND "valueIv" IS NOT NULL AND "valueAuthTag" IS NOT NULL AND "valueKeyVersion" IS NOT NULL AND "valueAlgorithm" IS NOT NULL AND "valueEnvelopeVersion" IS NOT NULL AND "valueAadVersion" IS NOT NULL)
      OR
      ("presence" <> 'PRESENT' AND "valueCiphertext" IS NULL AND "valueIv" IS NULL AND "valueAuthTag" IS NULL AND "valueKeyVersion" IS NULL AND "valueAlgorithm" IS NULL AND "valueEnvelopeVersion" IS NULL AND "valueAadVersion" IS NULL)
    ),
    CONSTRAINT "FieldObservation_normalized_envelope_ck" CHECK (
      ("normalizedCiphertext" IS NULL AND "normalizedIv" IS NULL AND "normalizedAuthTag" IS NULL AND "normalizedKeyVersion" IS NULL AND "normalizedAlgorithm" IS NULL AND "normalizedEnvelopeVersion" IS NULL AND "normalizedAadVersion" IS NULL)
      OR
      ("presence" = 'PRESENT' AND "normalizedCiphertext" IS NOT NULL AND "normalizedIv" IS NOT NULL AND "normalizedAuthTag" IS NOT NULL AND "normalizedKeyVersion" IS NOT NULL AND "normalizedAlgorithm" IS NOT NULL AND "normalizedEnvelopeVersion" IS NOT NULL AND "normalizedAadVersion" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "SectionCompleteness" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "bureauCoverageId" TEXT NOT NULL,
    "coverageStatus" "BureauCoverageStatus" NOT NULL,
    "reportSection" "CreditReportSection" NOT NULL,
    "status" "SectionExtractionStatus" NOT NULL,
    "requiredFieldKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "observedFieldKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "errorCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "normalizationRuleKey" TEXT NOT NULL,
    "normalizationRuleVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionCompleteness_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SectionCompleteness_complete_fields_ck" CHECK ("status" <> 'COMPLETE' OR "requiredFieldKeys" <@ "observedFieldKeys"),
    CONSTRAINT "SectionCompleteness_nonpresent_fields_ck" CHECK ("status" NOT IN ('FAILED', 'NOT_PROVIDED', 'UNKNOWN') OR cardinality("observedFieldKeys") = 0),
    CONSTRAINT "SectionCompleteness_coverage_ck" CHECK ("coverageStatus" = 'COVERED' OR ("status" IN ('UNKNOWN', 'NOT_PROVIDED') AND cardinality("observedFieldKeys") = 0))
);

-- CreateTable
CREATE TABLE "HistoricalEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "bureauCoverageId" TEXT NOT NULL,
    "coverageStatus" "BureauCoverageStatus" NOT NULL,
    "reportSection" "CreditReportSection" NOT NULL,
    "sectionStatus" "SectionExtractionStatus" NOT NULL,
    "sectionCompletenessId" TEXT NOT NULL,
    "evidenceType" "HistoricalEvidenceType" NOT NULL,
    "occurrence" INTEGER NOT NULL DEFAULT 0,
    "presence" "ObservationPresence" NOT NULL,
    "detailCiphertext" BYTEA,
    "detailIv" BYTEA,
    "detailAuthTag" BYTEA,
    "detailKeyVersion" TEXT,
    "detailAlgorithm" "EncryptionAlgorithm",
    "detailEnvelopeVersion" TEXT,
    "detailAadVersion" TEXT,
    "sourceLocatorToken" TEXT NOT NULL,
    "normalizationRuleKey" TEXT NOT NULL,
    "normalizationRuleVersion" TEXT NOT NULL,
    "parserConfidence" DECIMAL(5,4),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HistoricalEvidence_occurrence_ck" CHECK ("occurrence" >= 0),
    CONSTRAINT "HistoricalEvidence_confidence_ck" CHECK ("parserConfidence" IS NULL OR ("parserConfidence" >= 0 AND "parserConfidence" <= 1)),
    CONSTRAINT "HistoricalEvidence_coverage_ck" CHECK ("coverageStatus" = 'COVERED'),
    CONSTRAINT "HistoricalEvidence_confirmed_absence_section_ck" CHECK ("presence" <> 'ABSENT_CONFIRMED' OR "sectionStatus" = 'COMPLETE'),
    CONSTRAINT "HistoricalEvidence_detail_envelope_ck" CHECK (
      ("presence" = 'PRESENT' AND "detailCiphertext" IS NOT NULL AND "detailIv" IS NOT NULL AND "detailAuthTag" IS NOT NULL AND "detailKeyVersion" IS NOT NULL AND "detailAlgorithm" IS NOT NULL AND "detailEnvelopeVersion" IS NOT NULL AND "detailAadVersion" IS NOT NULL)
      OR
      ("presence" <> 'PRESENT' AND "detailCiphertext" IS NULL AND "detailIv" IS NULL AND "detailAuthTag" IS NULL AND "detailKeyVersion" IS NULL AND "detailAlgorithm" IS NULL AND "detailEnvelopeVersion" IS NULL AND "detailAadVersion" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "DerivedAccountAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "assessmentVersion" INTEGER NOT NULL,
    "classifierVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "inputSetSha256" VARCHAR(64) NOT NULL,
    "evidenceCompleteness" "AssessmentEvidenceCompleteness" NOT NULL,
    "accountCondition" "AccountCondition" NOT NULL,
    "disputeGrounds" "DisputeGrounds" NOT NULL,
    "reportedAdversity" "ReportedAdversity" NOT NULL,
    "rationaleCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DerivedAccountAssessment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DerivedAccountAssessment_version_ck" CHECK ("assessmentVersion" > 0),
    CONSTRAINT "DerivedAccountAssessment_input_sha256_ck" CHECK ("inputSetSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "DerivedAccountAssessment_clean_ck" CHECK (
      "accountCondition" <> 'CLEAN'
      OR (
        "evidenceCompleteness" = 'COMPLETE'
        AND "reportedAdversity" = 'FAVORABLE'
        AND "disputeGrounds" = 'NONE_DETECTED'
      )
    )
);

-- CreateTable
CREATE TABLE "ConsumerAssertion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "observationSeriesKey" TEXT NOT NULL,
    "observationRevision" INTEGER NOT NULL,
    "observationIntegritySha256" VARCHAR(64) NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "assertionSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "disposition" "ConsumerAssertionDisposition" NOT NULL,
    "statementCiphertext" BYTEA,
    "statementIv" BYTEA,
    "statementAuthTag" BYTEA,
    "statementKeyVersion" TEXT,
    "statementAlgorithm" "EncryptionAlgorithm",
    "statementEnvelopeVersion" TEXT,
    "statementAadVersion" TEXT,
    "confirmedByActorId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "supersedesAssertionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerAssertion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConsumerAssertion_version_ck" CHECK ("version" > 0),
    CONSTRAINT "ConsumerAssertion_observation_revision_ck" CHECK ("observationRevision" > 0),
    CONSTRAINT "ConsumerAssertion_observation_sha256_ck" CHECK ("observationIntegritySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ConsumerAssertion_expiry_ck" CHECK ("expiresAt" IS NULL OR "expiresAt" > "confirmedAt"),
    CONSTRAINT "ConsumerAssertion_statement_envelope_ck" CHECK (
      ("statementCiphertext" IS NULL AND "statementIv" IS NULL AND "statementAuthTag" IS NULL AND "statementKeyVersion" IS NULL AND "statementAlgorithm" IS NULL AND "statementEnvelopeVersion" IS NULL AND "statementAadVersion" IS NULL)
      OR
      ("statementCiphertext" IS NOT NULL AND "statementIv" IS NOT NULL AND "statementAuthTag" IS NOT NULL AND "statementKeyVersion" IS NOT NULL AND "statementAlgorithm" IS NOT NULL AND "statementEnvelopeVersion" IS NOT NULL AND "statementAadVersion" IS NOT NULL)
    )
);

-- CreateTable: immutable encrypted score evidence. occurrence is the score slot
-- inside one exact report/run/bureau and revision appends corrections only within
-- that source context. A later report or run starts a new series at revision 1.
-- Report-derived rows pin one exact extraction/bureau coverage record; manual
-- rows are secondary only.
CREATE TABLE "CreditScoreObservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT,
    "extractionRunId" TEXT,
    "bureau" "Bureau" NOT NULL,
    "coverageStatus" "BureauCoverageStatus",
    "bureauCoverageId" TEXT,
    "sourceType" "CreditScoreSourceType" NOT NULL,
    "evidenceRole" "CreditScoreEvidenceRole" NOT NULL,
    "presence" "CreditScorePresence" NOT NULL,
    "evidenceCompleteness" "CreditScoreEvidenceCompleteness" NOT NULL,
    "observationSeriesKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "occurrence" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "integritySha256" VARCHAR(64) NOT NULL,
    "scoreCiphertext" BYTEA,
    "scoreIv" BYTEA,
    "scoreAuthTag" BYTEA,
    "scoreKeyVersion" TEXT,
    "scoreAlgorithm" "EncryptionAlgorithm",
    "scoreEnvelopeVersion" TEXT,
    "scoreAadVersion" TEXT,
    "scoreModelKey" TEXT,
    "scoreModelVersion" TEXT,
    "scoreScaleMin" INTEGER,
    "scoreScaleMax" INTEGER,
    "modelMetadataCompleteness" "ScoreModelMetadataCompleteness" NOT NULL,
    "sourceMethodKey" TEXT NOT NULL,
    "sourceMethodVersion" TEXT NOT NULL,
    "sourceLocatorToken" TEXT,
    "pageNumber" INTEGER,
    "sectionOrdinal" INTEGER,
    "normalizationRuleKey" TEXT,
    "normalizationRuleVersion" TEXT,
    "parserConfidence" DECIMAL(5,4),
    "errorCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "enteredByActorId" TEXT,
    "enteredAt" TIMESTAMP(3),
    "supersedesObservationId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditScoreObservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditScoreObservation_revision_ck" CHECK ("revision" > 0),
    CONSTRAINT "CreditScoreObservation_occurrence_ck" CHECK ("occurrence" >= 0),
    CONSTRAINT "CreditScoreObservation_integrity_sha256_ck" CHECK ("integritySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "CreditScoreObservation_confidence_ck" CHECK ("parserConfidence" IS NULL OR ("parserConfidence" >= 0 AND "parserConfidence" <= 1)),
    CONSTRAINT "CreditScoreObservation_scale_ck" CHECK (
      (("scoreScaleMin" IS NULL) = ("scoreScaleMax" IS NULL))
      AND ("scoreScaleMin" IS NULL OR "scoreScaleMin" < "scoreScaleMax")
      AND ("scoreModelVersion" IS NULL OR "scoreModelKey" IS NOT NULL)
    ),
    CONSTRAINT "CreditScoreObservation_model_metadata_ck" CHECK (
      (
        "presence" = 'SCORE_REPORTED'
        AND (
          ("modelMetadataCompleteness" = 'COMPLETE' AND num_nonnulls("scoreModelKey", "scoreModelVersion", "scoreScaleMin", "scoreScaleMax") = 4)
          OR ("modelMetadataCompleteness" = 'PARTIAL' AND num_nonnulls("scoreModelKey", "scoreModelVersion", "scoreScaleMin", "scoreScaleMax") BETWEEN 1 AND 3)
          OR ("modelMetadataCompleteness" = 'UNKNOWN' AND num_nonnulls("scoreModelKey", "scoreModelVersion", "scoreScaleMin", "scoreScaleMax") = 0)
        )
      )
      OR
      (
        "presence" <> 'SCORE_REPORTED'
        AND "modelMetadataCompleteness" = 'UNKNOWN'
        AND num_nonnulls("scoreModelKey", "scoreModelVersion", "scoreScaleMin", "scoreScaleMax") = 0
      )
    ),
    CONSTRAINT "CreditScoreObservation_coordinates_ck" CHECK (
      ("pageNumber" IS NULL OR "pageNumber" > 0)
      AND ("sectionOrdinal" IS NULL OR "sectionOrdinal" >= 0)
    ),
    CONSTRAINT "CreditScoreObservation_source_ck" CHECK (
      (
        "sourceType" = 'REPORT_DERIVED'
        AND "evidenceRole" = 'PRIMARY_REPORT_EVIDENCE'
        AND "reportVersionId" IS NOT NULL
        AND "extractionRunId" IS NOT NULL
        AND "coverageStatus" IS NOT NULL
        AND "bureauCoverageId" IS NOT NULL
        AND "normalizationRuleKey" IS NOT NULL
        AND "normalizationRuleVersion" IS NOT NULL
        AND "enteredByActorId" IS NULL
        AND "enteredAt" IS NULL
      )
      OR
      (
        "sourceType" = 'MANUAL_ENTRY'
        AND "evidenceRole" = 'SECONDARY_MANUAL_CONTEXT'
        AND "reportVersionId" IS NULL
        AND "extractionRunId" IS NULL
        AND "coverageStatus" IS NULL
        AND "bureauCoverageId" IS NULL
        AND "evidenceCompleteness" = 'MANUAL_UNVERIFIED'
        AND "presence" = 'SCORE_REPORTED'
        AND "enteredByActorId" IS NOT NULL
        AND "enteredAt" IS NOT NULL
        AND "sourceLocatorToken" IS NULL
        AND "pageNumber" IS NULL
        AND "sectionOrdinal" IS NULL
        AND "normalizationRuleKey" IS NULL
        AND "normalizationRuleVersion" IS NULL
        AND "parserConfidence" IS NULL
      )
    ),
    CONSTRAINT "CreditScoreObservation_coverage_ck" CHECK (
      "sourceType" = 'MANUAL_ENTRY'
      OR "coverageStatus" = 'COVERED'
      OR (
        "coverageStatus" = 'OUTSIDE_COVERAGE'
        AND "presence" = 'UNKNOWN'
        AND "evidenceCompleteness" = 'UNKNOWN'
        AND "sourceLocatorToken" IS NULL
      )
    ),
    CONSTRAINT "CreditScoreObservation_locator_ck" CHECK (
      "sourceType" = 'MANUAL_ENTRY'
      OR "coverageStatus" = 'OUTSIDE_COVERAGE'
      OR "presence" = 'UNKNOWN'
      OR "sourceLocatorToken" IS NOT NULL
    ),
    CONSTRAINT "CreditScoreObservation_presence_ck" CHECK (
      (
        "presence" = 'SCORE_REPORTED'
        AND "evidenceCompleteness" IN ('COMPLETE', 'PARTIAL', 'MANUAL_UNVERIFIED')
        AND "scoreCiphertext" IS NOT NULL
        AND "scoreIv" IS NOT NULL
        AND "scoreAuthTag" IS NOT NULL
        AND "scoreKeyVersion" IS NOT NULL
        AND "scoreAlgorithm" IS NOT NULL
        AND "scoreEnvelopeVersion" IS NOT NULL
        AND "scoreAadVersion" IS NOT NULL
      )
      OR
      (
        "presence" = 'SCORE_NOT_PROVIDED'
        AND "evidenceCompleteness" = 'NOT_PROVIDED'
        AND "scoreCiphertext" IS NULL
        AND "scoreIv" IS NULL
        AND "scoreAuthTag" IS NULL
        AND "scoreKeyVersion" IS NULL
        AND "scoreAlgorithm" IS NULL
        AND "scoreEnvelopeVersion" IS NULL
        AND "scoreAadVersion" IS NULL
        AND "scoreModelKey" IS NULL
        AND "scoreModelVersion" IS NULL
        AND "scoreScaleMin" IS NULL
        AND "scoreScaleMax" IS NULL
      )
      OR
      (
        "presence" = 'UNKNOWN'
        AND "evidenceCompleteness" IN ('PARTIAL', 'UNKNOWN')
        AND "scoreCiphertext" IS NULL
        AND "scoreIv" IS NULL
        AND "scoreAuthTag" IS NULL
        AND "scoreKeyVersion" IS NULL
        AND "scoreAlgorithm" IS NULL
        AND "scoreEnvelopeVersion" IS NULL
        AND "scoreAadVersion" IS NULL
        AND "scoreModelKey" IS NULL
        AND "scoreModelVersion" IS NULL
        AND "scoreScaleMin" IS NULL
        AND "scoreScaleMax" IS NULL
      )
    )
);

-- CreateTable
CREATE TABLE "ReportComparison" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "priorReportVersionId" TEXT NOT NULL,
    "priorExtractionRunId" TEXT NOT NULL,
    "currentReportVersionId" TEXT NOT NULL,
    "currentExtractionRunId" TEXT NOT NULL,
    "comparisonSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "state" "ReportComparisonState" NOT NULL,
    "evidenceCompleteness" "ComparisonEvidenceCompleteness" NOT NULL,
    "sourcePolicy" "ComparisonSourcePolicy" NOT NULL DEFAULT 'REPORT_DERIVED_ONLY',
    "purpose" "ReportComparisonPurpose" NOT NULL,
    "chronologyBasis" "ComparisonChronologyBasis" NOT NULL,
    "chronologyRuleKey" TEXT NOT NULL,
    "chronologyRuleVersion" TEXT NOT NULL,
    "comparisonModelKey" TEXT NOT NULL,
    "comparisonModelVersion" TEXT NOT NULL,
    "sourceSetSha256" VARCHAR(64) NOT NULL,
    "integritySha256" VARCHAR(64) NOT NULL,
    "differenceCount" INTEGER NOT NULL,
    "reasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "supersedesComparisonId" TEXT,
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportComparison_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReportComparison_version_ck" CHECK ("version" > 0),
    CONSTRAINT "ReportComparison_difference_count_ck" CHECK ("differenceCount" >= 0),
    CONSTRAINT "ReportComparison_purpose_shape_ck" CHECK (
      ("purpose" = 'TEMPORAL_REPORT_CHANGE' AND "priorReportVersionId" <> "currentReportVersionId")
      OR
      ("purpose" = 'EXTRACTION_RECONCILIATION' AND "priorReportVersionId" = "currentReportVersionId" AND "priorExtractionRunId" <> "currentExtractionRunId")
    ),
    CONSTRAINT "ReportComparison_source_sha256_ck" CHECK ("sourceSetSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ReportComparison_integrity_sha256_ck" CHECK ("integritySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ReportComparison_state_ck" CHECK (
      ("state" = 'COMPARABLE' AND "evidenceCompleteness" = 'COMPLETE')
      OR ("state" = 'PARTIALLY_COMPARABLE' AND "evidenceCompleteness" IN ('PARTIAL', 'INCOMPLETE'))
      OR ("state" = 'NOT_COMPARABLE' AND "evidenceCompleteness" IN ('INCOMPLETE', 'UNKNOWN'))
      OR ("state" = 'PENDING_EVIDENCE' AND "evidenceCompleteness" IN ('INCOMPLETE', 'UNKNOWN'))
    )
);

-- CreateTable
CREATE TABLE "ReportDifference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "priorReportVersionId" TEXT NOT NULL,
    "priorExtractionRunId" TEXT NOT NULL,
    "currentReportVersionId" TEXT NOT NULL,
    "currentExtractionRunId" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "scopeType" "ReportDifferenceScope" NOT NULL,
    "bureau" "Bureau",
    "accountId" TEXT,
    "fieldKey" TEXT,
    "scoreOccurrence" INTEGER,
    "priorScoreSourceMethodKey" TEXT,
    "priorScoreSourceMethodVersion" TEXT,
    "currentScoreSourceMethodKey" TEXT,
    "currentScoreSourceMethodVersion" TEXT,
    "priorPresenceObservationId" TEXT,
    "currentPresenceObservationId" TEXT,
    "priorFieldObservationId" TEXT,
    "currentFieldObservationId" TEXT,
    "priorScoreObservationId" TEXT,
    "currentScoreObservationId" TEXT,
    "priorCoverageObservationId" TEXT,
    "currentCoverageObservationId" TEXT,
    "identityFactSeriesKey" TEXT,
    "priorIdentityBaselineId" TEXT,
    "priorIdentityFactId" TEXT,
    "currentIdentityBaselineId" TEXT,
    "currentIdentityFactId" TEXT,
    "priorCompleteness" "ComparisonEvidenceCompleteness" NOT NULL,
    "currentCompleteness" "ComparisonEvidenceCompleteness" NOT NULL,
    "comparability" "DifferenceComparability" NOT NULL,
    "differenceState" "ReportDifferenceState" NOT NULL,
    "changeKind" "ReportDifferenceChangeKind" NOT NULL,
    "deletionState" "DeletionInferenceState" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "differenceSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "comparisonRuleKey" TEXT NOT NULL,
    "comparisonRuleVersion" TEXT NOT NULL,
    "sourceSetSha256" VARCHAR(64) NOT NULL,
    "integritySha256" VARCHAR(64) NOT NULL,
    "reasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "supersedesDifferenceId" TEXT,
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDifference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReportDifference_version_ck" CHECK ("version" > 0),
    CONSTRAINT "ReportDifference_score_occurrence_ck" CHECK ("scoreOccurrence" IS NULL OR "scoreOccurrence" >= 0),
    CONSTRAINT "ReportDifference_score_method_shape_ck" CHECK (
      (
        "scopeType" = 'CREDIT_SCORE'
        AND "scoreOccurrence" IS NOT NULL
        AND "priorScoreSourceMethodKey" IS NOT NULL
        AND "priorScoreSourceMethodVersion" IS NOT NULL
        AND "currentScoreSourceMethodKey" IS NOT NULL
        AND "currentScoreSourceMethodVersion" IS NOT NULL
        AND "priorScoreObservationId" IS NOT NULL
        AND "currentScoreObservationId" IS NOT NULL
      )
      OR
      (
        "scopeType" <> 'CREDIT_SCORE'
        AND "priorScoreSourceMethodKey" IS NULL
        AND "priorScoreSourceMethodVersion" IS NULL
        AND "currentScoreSourceMethodKey" IS NULL
        AND "currentScoreSourceMethodVersion" IS NULL
      )
    ),
    CONSTRAINT "ReportDifference_source_sha256_ck" CHECK ("sourceSetSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ReportDifference_integrity_sha256_ck" CHECK ("integritySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ReportDifference_scope_shape_ck" CHECK (
      (
        "scopeType" = 'ACCOUNT_PRESENCE'
        AND "bureau" IS NOT NULL
        AND "accountId" IS NOT NULL
        AND "fieldKey" IS NULL
        AND "scoreOccurrence" IS NULL
        AND "priorFieldObservationId" IS NULL
        AND "currentFieldObservationId" IS NULL
        AND "priorScoreObservationId" IS NULL
        AND "currentScoreObservationId" IS NULL
        AND "priorCoverageObservationId" IS NULL
        AND "currentCoverageObservationId" IS NULL
        AND "identityFactSeriesKey" IS NULL
        AND "priorIdentityBaselineId" IS NULL
        AND "priorIdentityFactId" IS NULL
        AND "currentIdentityBaselineId" IS NULL
        AND "currentIdentityFactId" IS NULL
      )
      OR
      (
        "scopeType" = 'FIELD_VALUE'
        AND "bureau" IS NOT NULL
        AND "accountId" IS NOT NULL
        AND "fieldKey" IS NOT NULL
        AND "scoreOccurrence" IS NULL
        AND "priorPresenceObservationId" IS NULL
        AND "currentPresenceObservationId" IS NULL
        AND "priorScoreObservationId" IS NULL
        AND "currentScoreObservationId" IS NULL
        AND "priorCoverageObservationId" IS NULL
        AND "currentCoverageObservationId" IS NULL
        AND "identityFactSeriesKey" IS NULL
        AND "priorIdentityBaselineId" IS NULL
        AND "priorIdentityFactId" IS NULL
        AND "currentIdentityBaselineId" IS NULL
        AND "currentIdentityFactId" IS NULL
      )
      OR
      (
        "scopeType" = 'CREDIT_SCORE'
        AND "bureau" IS NOT NULL
        AND "accountId" IS NULL
        AND "fieldKey" IS NULL
        AND "scoreOccurrence" IS NOT NULL
        AND "priorPresenceObservationId" IS NULL
        AND "currentPresenceObservationId" IS NULL
        AND "priorFieldObservationId" IS NULL
        AND "currentFieldObservationId" IS NULL
        AND "priorCoverageObservationId" IS NULL
        AND "currentCoverageObservationId" IS NULL
        AND "identityFactSeriesKey" IS NULL
        AND "priorIdentityBaselineId" IS NULL
        AND "priorIdentityFactId" IS NULL
        AND "currentIdentityBaselineId" IS NULL
        AND "currentIdentityFactId" IS NULL
      )
      OR
      (
        "scopeType" = 'BUREAU_COVERAGE'
        AND "bureau" IS NOT NULL
        AND "accountId" IS NULL
        AND "fieldKey" IS NULL
        AND "scoreOccurrence" IS NULL
        AND "priorPresenceObservationId" IS NULL
        AND "currentPresenceObservationId" IS NULL
        AND "priorFieldObservationId" IS NULL
        AND "currentFieldObservationId" IS NULL
        AND "priorScoreObservationId" IS NULL
        AND "currentScoreObservationId" IS NULL
        AND "identityFactSeriesKey" IS NULL
        AND "priorIdentityBaselineId" IS NULL
        AND "priorIdentityFactId" IS NULL
        AND "currentIdentityBaselineId" IS NULL
        AND "currentIdentityFactId" IS NULL
      )
      OR
      (
        "scopeType" = 'IDENTITY_FACT'
        AND "accountId" IS NULL
        AND "fieldKey" IS NULL
        AND "scoreOccurrence" IS NULL
        AND "priorPresenceObservationId" IS NULL
        AND "currentPresenceObservationId" IS NULL
        AND "priorFieldObservationId" IS NULL
        AND "currentFieldObservationId" IS NULL
        AND "priorScoreObservationId" IS NULL
        AND "currentScoreObservationId" IS NULL
        AND "priorCoverageObservationId" IS NULL
        AND "currentCoverageObservationId" IS NULL
        AND "identityFactSeriesKey" IS NOT NULL
      )
    ),
    CONSTRAINT "ReportDifference_identity_tuple_ck" CHECK (
      (("priorIdentityBaselineId" IS NULL)::INTEGER + ("priorIdentityFactId" IS NULL)::INTEGER) IN (0, 2)
      AND (("currentIdentityBaselineId" IS NULL)::INTEGER + ("currentIdentityFactId" IS NULL)::INTEGER) IN (0, 2)
    ),
    CONSTRAINT "ReportDifference_source_pair_ck" CHECK (
      "comparability" NOT IN ('COMPARABLE', 'PARTIAL')
      OR ("scopeType" = 'ACCOUNT_PRESENCE' AND "priorPresenceObservationId" IS NOT NULL AND "currentPresenceObservationId" IS NOT NULL)
      OR ("scopeType" = 'FIELD_VALUE' AND "priorFieldObservationId" IS NOT NULL AND "currentFieldObservationId" IS NOT NULL)
      OR ("scopeType" = 'CREDIT_SCORE' AND "priorScoreObservationId" IS NOT NULL AND "currentScoreObservationId" IS NOT NULL)
      OR ("scopeType" = 'BUREAU_COVERAGE' AND "priorCoverageObservationId" IS NOT NULL AND "currentCoverageObservationId" IS NOT NULL)
      OR ("scopeType" = 'IDENTITY_FACT' AND "priorIdentityBaselineId" IS NOT NULL AND "priorIdentityFactId" IS NOT NULL AND "currentIdentityBaselineId" IS NOT NULL AND "currentIdentityFactId" IS NOT NULL)
    ),
    CONSTRAINT "ReportDifference_state_ck" CHECK (
      ("differenceState" IN ('CHANGED', 'UNCHANGED') AND "comparability" = 'COMPARABLE')
      OR ("differenceState" = 'NOT_COMPARABLE' AND "comparability" IN ('NOT_COMPARABLE', 'UNKNOWN'))
      OR ("differenceState" = 'REVIEW_REQUIRED' AND "comparability" IN ('PARTIAL', 'UNKNOWN'))
    ),
    CONSTRAINT "ReportDifference_change_kind_ck" CHECK (
      ("changeKind" = 'UNCHANGED' AND "differenceState" = 'UNCHANGED')
      OR ("changeKind" = 'UNABLE_TO_DETERMINE' AND "differenceState" IN ('NOT_COMPARABLE', 'REVIEW_REQUIRED'))
      OR ("changeKind" = 'NEW_ITEM' AND "scopeType" = 'ACCOUNT_PRESENCE' AND "differenceState" = 'CHANGED' AND "deletionState" = 'PRESENT_ON_CURRENT_REPORT')
      OR ("changeKind" = 'NO_LONGER_REPORTED' AND "scopeType" = 'ACCOUNT_PRESENCE' AND "differenceState" = 'CHANGED' AND "deletionState" = 'ABSENT_CONFIRMED_ON_CURRENT_REPORT')
      OR ("changeKind" = 'STATUS_CHANGED' AND "scopeType" = 'FIELD_VALUE' AND "fieldKey" IN ('summaryStatus', 'detailedStatus') AND "differenceState" = 'CHANGED')
      OR ("changeKind" = 'BALANCE_CHANGED' AND "scopeType" = 'FIELD_VALUE' AND "fieldKey" = 'balanceCents' AND "differenceState" = 'CHANGED')
      OR ("changeKind" = 'PAYMENT_HISTORY_CHANGED' AND "scopeType" = 'FIELD_VALUE' AND "fieldKey" = 'paymentHistory' AND "differenceState" = 'CHANGED')
      OR ("changeKind" = 'REMARK_CHANGED' AND "scopeType" = 'FIELD_VALUE' AND "fieldKey" IN ('remarks', 'transferOrSale') AND "differenceState" = 'CHANGED')
      OR ("changeKind" = 'DISPUTE_NOTATION_CHANGED' AND "scopeType" = 'FIELD_VALUE' AND "fieldKey" = 'consumerDisputeRemarks' AND "differenceState" = 'CHANGED')
      OR ("changeKind" = 'BUREAU_COVERAGE_CHANGED' AND "scopeType" = 'BUREAU_COVERAGE' AND "differenceState" = 'CHANGED')
      OR ("changeKind" = 'IDENTITY_INFORMATION_CHANGED' AND "scopeType" = 'IDENTITY_FACT' AND "differenceState" = 'CHANGED')
      OR ("changeKind" = 'SCORE_CHANGED' AND "scopeType" = 'CREDIT_SCORE' AND "differenceState" = 'CHANGED')
      OR ("changeKind" = 'OTHER_FIELD_CHANGED' AND "scopeType" = 'FIELD_VALUE' AND "differenceState" = 'CHANGED')
    ),
    CONSTRAINT "ReportDifference_deletion_ck" CHECK (
      ("deletionState" = 'NOT_APPLICABLE' AND ("scopeType" <> 'ACCOUNT_PRESENCE' OR "differenceState" = 'UNCHANGED'))
      OR ("deletionState" = 'ABSENT_CONFIRMED_ON_CURRENT_REPORT' AND "scopeType" = 'ACCOUNT_PRESENCE' AND "differenceState" = 'CHANGED' AND "currentCompleteness" = 'COMPLETE')
      OR ("deletionState" = 'PRESENT_ON_CURRENT_REPORT' AND "scopeType" = 'ACCOUNT_PRESENCE' AND "currentCompleteness" = 'COMPLETE')
      OR ("deletionState" = 'UNKNOWN_INCOMPLETE' AND "scopeType" = 'ACCOUNT_PRESENCE' AND ("currentCompleteness" <> 'COMPLETE' OR "comparability" <> 'COMPARABLE'))
    )
);

-- CreateTable
CREATE TABLE "DisputeOutcome" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "priorReportVersionId" TEXT NOT NULL,
    "priorExtractionRunId" TEXT NOT NULL,
    "currentReportVersionId" TEXT NOT NULL,
    "currentExtractionRunId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "differenceId" TEXT NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "accountId" TEXT NOT NULL,
    "targetFieldKey" TEXT NOT NULL,
    "targetConsumerAssertionId" TEXT NOT NULL,
    "targetCorrespondenceId" TEXT NOT NULL,
    "targetCorrespondenceItemId" TEXT NOT NULL,
    "targetCorrespondenceVersionId" TEXT NOT NULL,
    "targetVersionMembershipId" TEXT NOT NULL,
    "priorCompleteness" "ComparisonEvidenceCompleteness" NOT NULL,
    "currentCompleteness" "ComparisonEvidenceCompleteness" NOT NULL,
    "outcomeState" "DisputeOutcomeState" NOT NULL,
    "causalityState" "OutcomeCausalityState" NOT NULL DEFAULT 'NO_CAUSAL_CLAIM',
    "decisionSource" "OutcomeDecisionSource",
    "outcomeSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "decisionModelKey" TEXT NOT NULL,
    "decisionModelVersion" TEXT NOT NULL,
    "sourceSetSha256" VARCHAR(64) NOT NULL,
    "integritySha256" VARCHAR(64) NOT NULL,
    "reasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "decidedByActorId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "supersedesOutcomeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeOutcome_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DisputeOutcome_version_ck" CHECK ("version" > 0),
    CONSTRAINT "DisputeOutcome_source_sha256_ck" CHECK ("sourceSetSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "DisputeOutcome_integrity_sha256_ck" CHECK ("integritySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "DisputeOutcome_decision_ck" CHECK (
      ("outcomeState" = 'PENDING_EVIDENCE' AND "decisionSource" IS NULL AND "decidedByActorId" IS NULL AND "decidedAt" IS NULL)
      OR
      ("outcomeState" <> 'PENDING_EVIDENCE' AND "decisionSource" = 'SYSTEM_DERIVED' AND "decidedByActorId" IS NULL AND "decidedAt" IS NOT NULL)
      OR
      ("outcomeState" <> 'PENDING_EVIDENCE' AND "decisionSource" = 'HUMAN_CONFIRMED' AND "decidedByActorId" IS NOT NULL AND "decidedAt" IS NOT NULL)
    ),
    CONSTRAINT "DisputeOutcome_completeness_ck" CHECK (
      "outcomeState" IN ('PENDING_EVIDENCE', 'UNABLE_TO_DETERMINE')
      OR "currentCompleteness" = 'COMPLETE'
    )
);

-- CreateTable
CREATE TABLE "IdentityBaseline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "baselineSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "IdentityBaselineStatus" NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "inputSetSha256" VARCHAR(64) NOT NULL,
    "confirmedByActorId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityBaseline_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IdentityBaseline_version_ck" CHECK ("version" > 0),
    CONSTRAINT "IdentityBaseline_input_sha256_ck" CHECK ("inputSetSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "IdentityBaseline_confirmation_ck" CHECK (
      ("status" = 'CONFIRMED' AND "confirmedByActorId" IS NOT NULL AND "confirmedAt" IS NOT NULL)
      OR
      ("status" <> 'CONFIRMED')
    )
);

-- CreateTable
CREATE TABLE "IdentityFact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "factSeriesKey" TEXT NOT NULL,
    "factOrdinal" INTEGER NOT NULL,
    "bureau" "Bureau",
    "factType" "IdentityFactType" NOT NULL,
    "classification" "IdentityFactClassification" NOT NULL,
    "presence" "ObservationPresence" NOT NULL,
    "valueCiphertext" BYTEA,
    "valueIv" BYTEA,
    "valueAuthTag" BYTEA,
    "valueKeyVersion" TEXT,
    "valueAlgorithm" "EncryptionAlgorithm",
    "valueEnvelopeVersion" TEXT,
    "valueAadVersion" TEXT,
    "sourceLocatorToken" TEXT NOT NULL,
    "normalizationRuleKey" TEXT NOT NULL,
    "normalizationRuleVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityFact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IdentityFact_ordinal_ck" CHECK ("factOrdinal" >= 0),
    CONSTRAINT "IdentityFact_value_envelope_ck" CHECK (
      ("presence" = 'PRESENT' AND "valueCiphertext" IS NOT NULL AND "valueIv" IS NOT NULL AND "valueAuthTag" IS NOT NULL AND "valueKeyVersion" IS NOT NULL AND "valueAlgorithm" IS NOT NULL AND "valueEnvelopeVersion" IS NOT NULL AND "valueAadVersion" IS NOT NULL)
      OR
      ("presence" <> 'PRESENT' AND "valueCiphertext" IS NULL AND "valueIv" IS NULL AND "valueAuthTag" IS NULL AND "valueKeyVersion" IS NULL AND "valueAlgorithm" IS NULL AND "valueEnvelopeVersion" IS NULL AND "valueAadVersion" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL,
    "bureau" "Bureau",
    "displayNameCiphertext" BYTEA,
    "displayNameIv" BYTEA,
    "displayNameAuthTag" BYTEA,
    "displayNameKeyVersion" TEXT,
    "displayNameAlgorithm" "EncryptionAlgorithm",
    "displayNameEnvelopeVersion" TEXT,
    "displayNameAadVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Recipient_bureau_authority_ck" CHECK (
      ("recipientType" = 'CREDIT_REPORTING_AGENCY' AND "bureau" IS NOT NULL)
      OR
      ("recipientType" <> 'CREDIT_REPORTING_AGENCY' AND "bureau" IS NULL)
    ),
    CONSTRAINT "Recipient_display_name_envelope_ck" CHECK (
      ("displayNameCiphertext" IS NULL AND "displayNameIv" IS NULL AND "displayNameAuthTag" IS NULL AND "displayNameKeyVersion" IS NULL AND "displayNameAlgorithm" IS NULL AND "displayNameEnvelopeVersion" IS NULL AND "displayNameAadVersion" IS NULL)
      OR
      ("displayNameCiphertext" IS NOT NULL AND "displayNameIv" IS NOT NULL AND "displayNameAuthTag" IS NOT NULL AND "displayNameKeyVersion" IS NOT NULL AND "displayNameAlgorithm" IS NOT NULL AND "displayNameEnvelopeVersion" IS NOT NULL AND "displayNameAadVersion" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "RecipientAddressVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "addressSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RecipientAddressStatus" NOT NULL,
    "addressCiphertext" BYTEA NOT NULL,
    "addressIv" BYTEA NOT NULL,
    "addressAuthTag" BYTEA NOT NULL,
    "addressKeyVersion" TEXT NOT NULL,
    "addressAlgorithm" "EncryptionAlgorithm" NOT NULL,
    "addressEnvelopeVersion" TEXT NOT NULL,
    "addressAadVersion" TEXT NOT NULL,
    "validationRuleKey" TEXT NOT NULL,
    "validationRuleVersion" TEXT NOT NULL,
    "validationResultCode" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipientAddressVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecipientAddressVersion_version_ck" CHECK ("version" > 0),
    CONSTRAINT "RecipientAddressVersion_envelope_ck" CHECK (octet_length("addressCiphertext") > 0 AND octet_length("addressIv") > 0 AND octet_length("addressAuthTag") > 0 AND length("addressEnvelopeVersion") > 0 AND length("addressAadVersion") > 0)
);

-- CreateTable
CREATE TABLE "DisputeCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseKey" TEXT NOT NULL,
    "status" "DisputeCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "policyVersion" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DisputeCase_close_ck" CHECK (("status" = 'CLOSED' AND "closedAt" IS NOT NULL) OR ("status" <> 'CLOSED' AND "closedAt" IS NULL))
);

-- CreateTable
CREATE TABLE "Correspondence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientAddressVersionId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "strategyKey" TEXT NOT NULL,
    "claimClass" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "status" "CorrespondenceStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotencyKey" TEXT NOT NULL,
    "parentCorrespondenceId" TEXT,
    "parentRound" INTEGER,
    "parentLineageRef" TEXT NOT NULL,
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correspondence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Correspondence_round_ck" CHECK ("round" > 0),
    CONSTRAINT "Correspondence_parent_round_ck" CHECK (
      ("round" = 1 AND "parentCorrespondenceId" IS NULL AND "parentRound" IS NULL AND "parentLineageRef" = 'ROOT')
      OR
      ("round" > 1 AND "parentCorrespondenceId" IS NOT NULL AND "parentRound" = "round" - 1 AND "parentLineageRef" = "parentCorrespondenceId" AND "parentCorrespondenceId" <> "id")
    )
);

-- CreateTable
CREATE TABLE "CorrespondenceItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "observationSeriesKey" TEXT NOT NULL,
    "observationRevision" INTEGER NOT NULL,
    "observationIntegritySha256" VARCHAR(64) NOT NULL,
    "historicalEvidenceId" TEXT,
    "assessmentId" TEXT NOT NULL,
    "consumerAssertionId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "claimType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrespondenceItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CorrespondenceItem_ordinal_ck" CHECK ("ordinal" >= 0),
    CONSTRAINT "CorrespondenceItem_observation_revision_ck" CHECK ("observationRevision" > 0),
    CONSTRAINT "CorrespondenceItem_observation_sha256_ck" CHECK ("observationIntegritySha256" ~ '^[0-9a-f]{64}$')
);

-- CreateTable
CREATE TABLE "CorrespondenceVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CorrespondenceStatus" NOT NULL,
    "strategyKey" TEXT NOT NULL,
    "claimClass" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "parentLineageRef" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientAddressVersionId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "bodyCiphertext" BYTEA NOT NULL,
    "bodyIv" BYTEA NOT NULL,
    "bodyAuthTag" BYTEA NOT NULL,
    "bodyKeyVersion" TEXT NOT NULL,
    "bodyAlgorithm" "EncryptionAlgorithm" NOT NULL,
    "bodyEnvelopeVersion" TEXT NOT NULL,
    "bodyAadVersion" TEXT NOT NULL,
    "bodySha256" VARCHAR(64) NOT NULL,
    "itemSetSha256" VARCHAR(64) NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "supersedesVersionId" TEXT,
    "approvedByActorId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrespondenceVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CorrespondenceVersion_version_ck" CHECK ("version" > 0),
    CONSTRAINT "CorrespondenceVersion_round_ck" CHECK ("round" > 0),
    CONSTRAINT "CorrespondenceVersion_body_sha256_ck" CHECK ("bodySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "CorrespondenceVersion_item_sha256_ck" CHECK ("itemSetSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "CorrespondenceVersion_item_count_ck" CHECK ("itemCount" >= 0),
    CONSTRAINT "CorrespondenceVersion_body_envelope_ck" CHECK (octet_length("bodyCiphertext") > 0 AND octet_length("bodyIv") > 0 AND octet_length("bodyAuthTag") > 0 AND length("bodyEnvelopeVersion") > 0 AND length("bodyAadVersion") > 0),
    CONSTRAINT "CorrespondenceVersion_approval_ck" CHECK ("status" <> 'APPROVED' OR ("approvedByActorId" IS NOT NULL AND "approvedAt" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "CorrespondenceVersionItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "correspondenceVersionId" TEXT NOT NULL,
    "correspondenceItemId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrespondenceVersionItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CorrespondenceVersionItem_ordinal_ck" CHECK ("ordinal" >= 0)
);

-- CreateTable
CREATE TABLE "Packet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientAddressVersionId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "packetSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "claimClass" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "enclosureManifestSha256" VARCHAR(64) NOT NULL,
    "correspondenceVersionCount" INTEGER NOT NULL DEFAULT 0,
    "enclosureCount" INTEGER NOT NULL DEFAULT 0,
    "status" "PacketStatus" NOT NULL,
    "approvedByActorId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Packet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Packet_version_ck" CHECK ("version" > 0),
    CONSTRAINT "Packet_round_ck" CHECK ("round" > 0),
    CONSTRAINT "Packet_manifest_sha256_ck" CHECK ("enclosureManifestSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "Packet_child_counts_ck" CHECK ("correspondenceVersionCount" >= 0 AND "enclosureCount" >= 0),
    CONSTRAINT "Packet_approval_ck" CHECK ("status" <> 'APPROVED' OR ("approvedByActorId" IS NOT NULL AND "approvedAt" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "PacketCorrespondenceVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientAddressVersionId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "claimClass" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "correspondenceVersionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PacketCorrespondenceVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PacketCorrespondenceVersion_ordinal_ck" CHECK ("ordinal" >= 0),
    CONSTRAINT "PacketCorrespondenceVersion_round_ck" CHECK ("round" > 0)
);

-- CreateTable
CREATE TABLE "PacketEnclosure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientAddressVersionId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "claimClass" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "artifactKind" "ArtifactKind" NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "kind" "PacketEnclosureKind" NOT NULL,
    "labelCode" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PacketEnclosure_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PacketEnclosure_ordinal_ck" CHECK ("ordinal" >= 0),
    CONSTRAINT "PacketEnclosure_round_ck" CHECK ("round" > 0),
    CONSTRAINT "PacketEnclosure_artifact_kind_ck" CHECK (
      "artifactKind" NOT IN ('REPORT_SOURCE', 'CANONICAL_PACKET_PDF')
      AND ("kind" <> 'REPORT_EXCERPT' OR "artifactKind" = 'ENCLOSURE')
      AND ("kind" NOT IN ('IDENTITY_PROOF', 'ADDRESS_PROOF') OR "artifactKind" = 'ENCLOSURE')
    )
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "artifactSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "reportVersionId" TEXT,
    "caseId" TEXT,
    "packetId" TEXT,
    "primaryCorrespondenceId" TEXT,
    "primaryCorrespondenceVersionId" TEXT,
    "recipientId" TEXT,
    "recipientAddressVersionId" TEXT,
    "identityBaselineId" TEXT,
    "storageProviderKey" TEXT NOT NULL,
    "storageLocatorCiphertext" BYTEA NOT NULL,
    "storageLocatorIv" BYTEA NOT NULL,
    "storageLocatorAuthTag" BYTEA NOT NULL,
    "storageLocatorKeyVersion" TEXT NOT NULL,
    "storageLocatorAlgorithm" "EncryptionAlgorithm" NOT NULL,
    "storageLocatorEnvelopeVersion" TEXT NOT NULL,
    "storageLocatorAadVersion" TEXT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteLength" BIGINT NOT NULL,
    "pageCount" INTEGER,
    "rendererVersion" TEXT,
    "templateVersion" TEXT,
    "policyVersion" TEXT,
    "round" INTEGER,
    "claimClass" TEXT,
    "enclosureManifestSha256" VARCHAR(64),
    "correspondenceVersionCount" INTEGER NOT NULL DEFAULT 0,
    "createdByActorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Artifact_version_ck" CHECK ("version" > 0),
    CONSTRAINT "Artifact_sha256_ck" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "Artifact_manifest_sha256_ck" CHECK ("enclosureManifestSha256" IS NULL OR "enclosureManifestSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "Artifact_correspondence_count_ck" CHECK ("correspondenceVersionCount" >= 0),
    CONSTRAINT "Artifact_size_ck" CHECK ("byteLength" > 0),
    CONSTRAINT "Artifact_page_count_ck" CHECK ("pageCount" IS NULL OR "pageCount" > 0),
    CONSTRAINT "Artifact_round_ck" CHECK ("round" IS NULL OR "round" > 0),
    CONSTRAINT "Artifact_locator_envelope_ck" CHECK (octet_length("storageLocatorCiphertext") > 0 AND octet_length("storageLocatorIv") > 0 AND octet_length("storageLocatorAuthTag") > 0 AND length("storageLocatorEnvelopeVersion") > 0 AND length("storageLocatorAadVersion") > 0),
    CONSTRAINT "Artifact_report_source_ck" CHECK ("kind" <> 'REPORT_SOURCE' OR "reportVersionId" IS NOT NULL),
    CONSTRAINT "Artifact_packet_pin_fields_ck" CHECK (
      "packetId" IS NULL
      OR ("reportVersionId" IS NOT NULL AND "caseId" IS NOT NULL AND "recipientId" IS NOT NULL AND "recipientAddressVersionId" IS NOT NULL AND "identityBaselineId" IS NOT NULL AND "policyVersion" IS NOT NULL AND "round" IS NOT NULL AND "claimClass" IS NOT NULL)
    ),
    CONSTRAINT "Artifact_primary_pin_fields_ck" CHECK (
      ("primaryCorrespondenceId" IS NULL AND "primaryCorrespondenceVersionId" IS NULL)
      OR ("primaryCorrespondenceId" IS NOT NULL AND "primaryCorrespondenceVersionId" IS NOT NULL AND "packetId" IS NOT NULL AND "reportVersionId" IS NOT NULL AND "caseId" IS NOT NULL AND "recipientId" IS NOT NULL AND "recipientAddressVersionId" IS NOT NULL AND "identityBaselineId" IS NOT NULL AND "policyVersion" IS NOT NULL AND "round" IS NOT NULL AND "claimClass" IS NOT NULL)
    ),
    CONSTRAINT "Artifact_canonical_packet_ck" CHECK (
      "kind" <> 'CANONICAL_PACKET_PDF'
      OR (
        "packetId" IS NOT NULL
        AND "reportVersionId" IS NOT NULL
        AND "caseId" IS NOT NULL
        AND "primaryCorrespondenceId" IS NOT NULL
        AND "primaryCorrespondenceVersionId" IS NOT NULL
        AND "recipientId" IS NOT NULL
        AND "recipientAddressVersionId" IS NOT NULL
        AND "identityBaselineId" IS NOT NULL
        AND "rendererVersion" IS NOT NULL
        AND "templateVersion" IS NOT NULL
        AND "policyVersion" IS NOT NULL
        AND "round" IS NOT NULL
        AND "claimClass" IS NOT NULL
        AND "enclosureManifestSha256" IS NOT NULL
        AND "correspondenceVersionCount" > 0
        AND "mimeType" = 'application/pdf'
        AND "pageCount" IS NOT NULL
      )
    )
);

-- CreateTable
CREATE TABLE "ArtifactCorrespondenceVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientAddressVersionId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "claimClass" TEXT NOT NULL,
    "packetId" TEXT,
    "artifactId" TEXT NOT NULL,
    "correspondenceId" TEXT NOT NULL,
    "correspondenceVersionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtifactCorrespondenceVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArtifactCorrespondenceVersion_ordinal_ck" CHECK ("ordinal" >= 0),
    CONSTRAINT "ArtifactCorrespondenceVersion_round_ck" CHECK ("round" > 0)
);

-- CreateTable
CREATE TABLE "ArtifactTombstone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "storageDeletionRef" TEXT,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtifactTombstone_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArtifactTombstone_event_type_ck" CHECK ("eventType" IN ('TOMBSTONE_REQUESTED', 'OBJECT_DELETED', 'CRYPTO_SHREDDED', 'FAILED'))
);

-- CreateTable
CREATE TABLE "EvidenceEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "caseId" TEXT,
    "eventKey" TEXT NOT NULL,
    "eventType" "EvidenceEventType" NOT NULL,
    "eventVersion" INTEGER NOT NULL,
    "subjectType" "EvidenceSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "relatedRefType" "EvidenceSubjectType",
    "relatedRefId" TEXT,
    "actorId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EvidenceEvent_version_ck" CHECK ("eventVersion" > 0)
);

-- Indexes and idempotency/version constraints
-- These two additive indexes let the new provenance FKs prove that a referenced
-- legacy row belongs to the same managed consumer; existing rows are untouched.
CREATE UNIQUE INDEX "Report_userId_id_p0_key" ON "Report"("userId", "id");
CREATE UNIQUE INDEX "Tradeline_userId_id_p0_key" ON "Tradeline"("userId", "id");

CREATE INDEX "CreditTruthScope_consumerId_tenantId_idx" ON "CreditTruthScope"("consumerId", "tenantId");

CREATE INDEX "ReportVersion_tenantId_consumerId_sourceReportId_idx" ON "ReportVersion"("tenantId", "consumerId", "sourceReportId");
CREATE INDEX "ReportVersion_tenantId_consumerId_authorityStatus_createdAt_idx" ON "ReportVersion"("tenantId", "consumerId", "authorityStatus", "createdAt");
CREATE UNIQUE INDEX "ReportVersion_tenantId_consumerId_id_key" ON "ReportVersion"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "ReportVersion_tenantId_consumerId_reportSeriesKey_version_key" ON "ReportVersion"("tenantId", "consumerId", "reportSeriesKey", "version");

CREATE INDEX "ExtractionRun_tenantId_consumerId_reportVersionId_createdAt_idx" ON "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "createdAt");
CREATE UNIQUE INDEX "ExtractionRun_tenantId_consumerId_id_key" ON "ExtractionRun"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "ExtractionRun_tenantId_consumerId_reportVersionId_id_key" ON "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id");
CREATE UNIQUE INDEX "ExtractionRun_tenantId_consumerId_reportVersionId_runKey_at_key" ON "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "runKey", "attempt");

CREATE INDEX "ExtractionBureauCoverage_tenantId_consumerId_reportVersionI_idx" ON "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "coverageStatus");
CREATE UNIQUE INDEX "ExtractionBureauCoverage_tenantId_consumerId_id_key" ON "ExtractionBureauCoverage"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "ExtractionBureauCoverage_tenantId_consumerId_reportVersionI_key" ON "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau");
CREATE UNIQUE INDEX "extraction_bureau_coverage_pin_key" ON "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "id");
CREATE UNIQUE INDEX "extraction_bureau_coverage_difference_pin_key" ON "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "id");

CREATE INDEX "Account_tenantId_consumerId_legacyTradelineId_idx" ON "Account"("tenantId", "consumerId", "legacyTradelineId");
CREATE UNIQUE INDEX "Account_tenantId_consumerId_id_key" ON "Account"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "Account_tenantId_consumerId_stableKey_key" ON "Account"("tenantId", "consumerId", "stableKey");

CREATE INDEX "ReportVersionAccount_tenantId_consumerId_accountId_reportVe_idx" ON "ReportVersionAccount"("tenantId", "consumerId", "accountId", "reportVersionId");
CREATE UNIQUE INDEX "ReportVersionAccount_tenantId_consumerId_id_key" ON "ReportVersionAccount"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "ReportVersionAccount_tenantId_consumerId_reportVersionId_ac_key" ON "ReportVersionAccount"("tenantId", "consumerId", "reportVersionId", "accountId");
CREATE UNIQUE INDEX "ReportVersionAccount_tenantId_consumerId_reportVersionId_so_key" ON "ReportVersionAccount"("tenantId", "consumerId", "reportVersionId", "sourceAccountOrdinal");

CREATE INDEX "AccountPresenceObservation_tenantId_consumerId_reportVersio_idx" ON "AccountPresenceObservation"("tenantId", "consumerId", "reportVersionId", "accountId", "bureau", "presence");
CREATE UNIQUE INDEX "AccountPresenceObservation_tenantId_consumerId_id_key" ON "AccountPresenceObservation"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "AccountPresenceObservation_tenantId_consumerId_observationS_key" ON "AccountPresenceObservation"("tenantId", "consumerId", "observationSeriesKey", "revision");
CREATE UNIQUE INDEX "AccountPresenceObservation_tenantId_consumerId_extractionRu_key" ON "AccountPresenceObservation"("tenantId", "consumerId", "extractionRunId", "accountId", "bureau");
CREATE UNIQUE INDEX "account_presence_difference_pin_key" ON "AccountPresenceObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "id");

CREATE INDEX "FieldObservation_tenantId_consumerId_reportVersionId_accoun_idx" ON "FieldObservation"("tenantId", "consumerId", "reportVersionId", "accountId", "bureau", "reportSection");
CREATE INDEX "FieldObservation_tenantId_consumerId_extractionRunId_presen_idx" ON "FieldObservation"("tenantId", "consumerId", "extractionRunId", "presence");
CREATE UNIQUE INDEX "FieldObservation_tenantId_consumerId_id_key" ON "FieldObservation"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "FieldObservation_tenantId_consumerId_reportVersionId_accoun_key" ON "FieldObservation"("tenantId", "consumerId", "reportVersionId", "accountId", "id");
CREATE UNIQUE INDEX "field_observation_assertion_pin_key" ON "FieldObservation"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "fieldKey", "observationSeriesKey", "revision", "integritySha256", "id");
CREATE UNIQUE INDEX "FieldObservation_tenantId_consumerId_observationSeriesKey_r_key" ON "FieldObservation"("tenantId", "consumerId", "observationSeriesKey", "revision");
CREATE UNIQUE INDEX "FieldObservation_tenantId_consumerId_extractionRunId_accoun_key" ON "FieldObservation"("tenantId", "consumerId", "extractionRunId", "accountId", "bureau", "reportSection", "fieldKey", "occurrence");
CREATE UNIQUE INDEX "field_observation_difference_pin_key" ON "FieldObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "fieldKey", "id");

CREATE INDEX "SectionCompleteness_tenantId_consumerId_reportVersionId_acc_idx" ON "SectionCompleteness"("tenantId", "consumerId", "reportVersionId", "accountId", "bureau", "status");
CREATE UNIQUE INDEX "SectionCompleteness_tenantId_consumerId_id_key" ON "SectionCompleteness"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "SectionCompleteness_tenantId_consumerId_extractionRunId_acc_key" ON "SectionCompleteness"("tenantId", "consumerId", "extractionRunId", "accountId", "bureau", "reportSection");
CREATE UNIQUE INDEX "section_completeness_presence_pin_key" ON "SectionCompleteness"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "reportSection", "status", "id");

CREATE INDEX "HistoricalEvidence_tenantId_consumerId_reportVersionId_acco_idx" ON "HistoricalEvidence"("tenantId", "consumerId", "reportVersionId", "accountId", "bureau", "evidenceType");
CREATE UNIQUE INDEX "HistoricalEvidence_tenantId_consumerId_id_key" ON "HistoricalEvidence"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "HistoricalEvidence_tenantId_consumerId_reportVersionId_acco_key" ON "HistoricalEvidence"("tenantId", "consumerId", "reportVersionId", "accountId", "id");
CREATE UNIQUE INDEX "historical_evidence_chain_key" ON "HistoricalEvidence"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "id");
CREATE UNIQUE INDEX "HistoricalEvidence_tenantId_consumerId_extractionRunId_acco_key" ON "HistoricalEvidence"("tenantId", "consumerId", "extractionRunId", "accountId", "bureau", "reportSection", "evidenceType", "occurrence");

CREATE INDEX "DerivedAccountAssessment_tenantId_consumerId_reportVersionI_idx" ON "DerivedAccountAssessment"("tenantId", "consumerId", "reportVersionId", "accountCondition", "reportedAdversity");
CREATE UNIQUE INDEX "DerivedAccountAssessment_tenantId_consumerId_id_key" ON "DerivedAccountAssessment"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "daa_scope_report_account_id_key" ON "DerivedAccountAssessment"("tenantId", "consumerId", "reportVersionId", "accountId", "id");
CREATE UNIQUE INDEX "daa_assertion_chain_key" ON "DerivedAccountAssessment"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "id");
CREATE UNIQUE INDEX "daa_scope_account_version_key" ON "DerivedAccountAssessment"("tenantId", "consumerId", "reportVersionId", "accountId", "assessmentVersion");

CREATE INDEX "ConsumerAssertion_tenantId_consumerId_observationId_confirm_idx" ON "ConsumerAssertion"("tenantId", "consumerId", "observationId", "confirmedAt");
CREATE INDEX "ConsumerAssertion_tenantId_consumerId_assessmentId_idx" ON "ConsumerAssertion"("tenantId", "consumerId", "assessmentId");
CREATE UNIQUE INDEX "ConsumerAssertion_tenantId_consumerId_id_key" ON "ConsumerAssertion"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "ConsumerAssertion_tenantId_consumerId_reportVersionId_accou_key" ON "ConsumerAssertion"("tenantId", "consumerId", "reportVersionId", "accountId", "id");
CREATE UNIQUE INDEX "consumer_assertion_chain_key" ON "ConsumerAssertion"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "fieldKey", "observationSeriesKey", "observationRevision", "observationIntegritySha256", "observationId", "assessmentId", "id");
CREATE UNIQUE INDEX "consumer_assertion_supersession_key" ON "ConsumerAssertion"("tenantId", "consumerId", "assertionSeriesKey", "id");
CREATE UNIQUE INDEX "ConsumerAssertion_tenantId_consumerId_assertionSeriesKey_ve_key" ON "ConsumerAssertion"("tenantId", "consumerId", "assertionSeriesKey", "version");
CREATE UNIQUE INDEX "consumer_assertion_difference_pin_key" ON "ConsumerAssertion"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "fieldKey", "id");

CREATE INDEX "CreditScoreObservation_tenantId_consumerId_reportVersionId__idx" ON "CreditScoreObservation"("tenantId", "consumerId", "reportVersionId", "bureau", "sourceType", "presence");
CREATE UNIQUE INDEX "CreditScoreObservation_tenantId_consumerId_id_key" ON "CreditScoreObservation"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "credit_score_supersession_key" ON "CreditScoreObservation"("tenantId", "consumerId", "observationSeriesKey", "id");
CREATE UNIQUE INDEX "CreditScoreObservation_tenantId_consumerId_observationSerie_key" ON "CreditScoreObservation"("tenantId", "consumerId", "observationSeriesKey", "revision");
CREATE UNIQUE INDEX "CreditScoreObservation_tenantId_consumerId_idempotencyKey_key" ON "CreditScoreObservation"("tenantId", "consumerId", "idempotencyKey");
CREATE UNIQUE INDEX "credit_score_difference_pin_key" ON "CreditScoreObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "sourceMethodKey", "sourceMethodVersion", "occurrence", "id");
CREATE UNIQUE INDEX "credit_score_run_bureau_occurrence_revision_key" ON "CreditScoreObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "sourceType", "sourceMethodKey", "sourceMethodVersion", "occurrence", "revision");

CREATE INDEX "ReportComparison_tenantId_consumerId_currentReportVersionId_idx" ON "ReportComparison"("tenantId", "consumerId", "currentReportVersionId", "state", "createdAt");
CREATE UNIQUE INDEX "ReportComparison_tenantId_consumerId_id_key" ON "ReportComparison"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "report_comparison_supersession_key" ON "ReportComparison"("tenantId", "consumerId", "comparisonSeriesKey", "id");
CREATE UNIQUE INDEX "ReportComparison_tenantId_consumerId_comparisonSeriesKey_ve_key" ON "ReportComparison"("tenantId", "consumerId", "comparisonSeriesKey", "version");
CREATE UNIQUE INDEX "ReportComparison_tenantId_consumerId_idempotencyKey_key" ON "ReportComparison"("tenantId", "consumerId", "idempotencyKey");
CREATE UNIQUE INDEX "report_comparison_difference_pin_key" ON "ReportComparison"("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId", "currentReportVersionId", "currentExtractionRunId", "id");

CREATE INDEX "ReportDifference_tenantId_consumerId_comparisonId_scopeType_idx" ON "ReportDifference"("tenantId", "consumerId", "comparisonId", "scopeType", "bureau", "priorScoreSourceMethodKey", "priorScoreSourceMethodVersion", "currentScoreSourceMethodKey", "currentScoreSourceMethodVersion", "scoreOccurrence", "differenceState");
CREATE UNIQUE INDEX "ReportDifference_tenantId_consumerId_id_key" ON "ReportDifference"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "ReportDifference_tenantId_consumerId_comparisonId_id_key" ON "ReportDifference"("tenantId", "consumerId", "comparisonId", "id");
CREATE UNIQUE INDEX "report_difference_outcome_pin_key" ON "ReportDifference"("tenantId", "consumerId", "priorReportVersionId", "currentReportVersionId", "comparisonId", "id");
CREATE UNIQUE INDEX "report_difference_supersession_key" ON "ReportDifference"("tenantId", "consumerId", "differenceSeriesKey", "id");
CREATE UNIQUE INDEX "ReportDifference_tenantId_consumerId_differenceSeriesKey_ve_key" ON "ReportDifference"("tenantId", "consumerId", "differenceSeriesKey", "version");
CREATE UNIQUE INDEX "report_difference_comparison_series_key" ON "ReportDifference"("tenantId", "consumerId", "comparisonId", "differenceSeriesKey");
CREATE UNIQUE INDEX "ReportDifference_tenantId_consumerId_idempotencyKey_key" ON "ReportDifference"("tenantId", "consumerId", "idempotencyKey");

CREATE INDEX "DisputeOutcome_tenantId_consumerId_caseId_outcomeState_crea_idx" ON "DisputeOutcome"("tenantId", "consumerId", "caseId", "outcomeState", "createdAt");
CREATE INDEX "DisputeOutcome_tenantId_consumerId_comparisonId_differenceI_idx" ON "DisputeOutcome"("tenantId", "consumerId", "comparisonId", "differenceId");
CREATE UNIQUE INDEX "DisputeOutcome_tenantId_consumerId_id_key" ON "DisputeOutcome"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "dispute_outcome_supersession_key" ON "DisputeOutcome"("tenantId", "consumerId", "outcomeSeriesKey", "id");
CREATE UNIQUE INDEX "DisputeOutcome_tenantId_consumerId_outcomeSeriesKey_version_key" ON "DisputeOutcome"("tenantId", "consumerId", "outcomeSeriesKey", "version");
CREATE UNIQUE INDEX "DisputeOutcome_tenantId_consumerId_idempotencyKey_key" ON "DisputeOutcome"("tenantId", "consumerId", "idempotencyKey");

CREATE INDEX "IdentityBaseline_tenantId_consumerId_reportVersionId_status_idx" ON "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "status");
CREATE UNIQUE INDEX "IdentityBaseline_tenantId_consumerId_id_key" ON "IdentityBaseline"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "IdentityBaseline_tenantId_consumerId_reportVersionId_id_key" ON "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "id");
CREATE UNIQUE INDEX "IdentityBaseline_tenantId_consumerId_baselineSeriesKey_vers_key" ON "IdentityBaseline"("tenantId", "consumerId", "baselineSeriesKey", "version");

CREATE INDEX "IdentityFact_tenantId_consumerId_identityBaselineId_factTyp_idx" ON "IdentityFact"("tenantId", "consumerId", "identityBaselineId", "factType", "classification");
CREATE UNIQUE INDEX "IdentityFact_tenantId_consumerId_id_key" ON "IdentityFact"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "IdentityFact_tenantId_consumerId_identityBaselineId_factOrd_key" ON "IdentityFact"("tenantId", "consumerId", "identityBaselineId", "factOrdinal");
CREATE UNIQUE INDEX "IdentityFact_tenantId_consumerId_identityBaselineId_factSer_key" ON "IdentityFact"("tenantId", "consumerId", "identityBaselineId", "factSeriesKey");
CREATE UNIQUE INDEX "identity_fact_difference_pin_key" ON "IdentityFact"("tenantId", "consumerId", "reportVersionId", "identityBaselineId", "factSeriesKey", "id");

CREATE INDEX "Recipient_tenantId_consumerId_recipientType_idx" ON "Recipient"("tenantId", "consumerId", "recipientType");
CREATE UNIQUE INDEX "Recipient_tenantId_consumerId_id_key" ON "Recipient"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "Recipient_tenantId_consumerId_stableKey_key" ON "Recipient"("tenantId", "consumerId", "stableKey");

CREATE INDEX "RecipientAddressVersion_tenantId_consumerId_recipientId_sta_idx" ON "RecipientAddressVersion"("tenantId", "consumerId", "recipientId", "status", "effectiveAt");
CREATE UNIQUE INDEX "RecipientAddressVersion_tenantId_consumerId_id_key" ON "RecipientAddressVersion"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "RecipientAddressVersion_tenantId_consumerId_recipientId_id_key" ON "RecipientAddressVersion"("tenantId", "consumerId", "recipientId", "id");
CREATE UNIQUE INDEX "RecipientAddressVersion_tenantId_consumerId_recipientId_add_key" ON "RecipientAddressVersion"("tenantId", "consumerId", "recipientId", "addressSeriesKey", "version");

CREATE INDEX "DisputeCase_tenantId_consumerId_status_createdAt_idx" ON "DisputeCase"("tenantId", "consumerId", "status", "createdAt");
CREATE UNIQUE INDEX "DisputeCase_tenantId_consumerId_id_key" ON "DisputeCase"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "DisputeCase_tenantId_consumerId_reportVersionId_id_key" ON "DisputeCase"("tenantId", "consumerId", "reportVersionId", "id");
CREATE UNIQUE INDEX "DisputeCase_tenantId_consumerId_caseKey_key" ON "DisputeCase"("tenantId", "consumerId", "caseKey");

CREATE INDEX "Correspondence_tenantId_consumerId_caseId_recipientId_round_idx" ON "Correspondence"("tenantId", "consumerId", "caseId", "recipientId", "round");
CREATE UNIQUE INDEX "Correspondence_tenantId_consumerId_id_key" ON "Correspondence"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "Correspondence_tenantId_consumerId_reportVersionId_caseId_i_key" ON "Correspondence"("tenantId", "consumerId", "reportVersionId", "caseId", "id");
CREATE UNIQUE INDEX "correspondence_version_pin_key" ON "Correspondence"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "strategyKey", "claimClass", "policyVersion", "round", "parentLineageRef", "id");
CREATE UNIQUE INDEX "correspondence_parent_pin_key" ON "Correspondence"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "identityBaselineId", "policyVersion", "claimClass", "round", "id");
CREATE UNIQUE INDEX "Correspondence_tenantId_consumerId_idempotencyKey_key" ON "Correspondence"("tenantId", "consumerId", "idempotencyKey");

CREATE INDEX "CorrespondenceItem_tenantId_consumerId_observationId_idx" ON "CorrespondenceItem"("tenantId", "consumerId", "observationId");
CREATE INDEX "CorrespondenceItem_tenantId_consumerId_consumerAssertionId_idx" ON "CorrespondenceItem"("tenantId", "consumerId", "consumerAssertionId");
CREATE UNIQUE INDEX "CorrespondenceItem_tenantId_consumerId_id_key" ON "CorrespondenceItem"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "CorrespondenceItem_tenantId_consumerId_reportVersionId_case_key" ON "CorrespondenceItem"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "id");
CREATE UNIQUE INDEX "correspondence_item_outcome_pin_key" ON "CorrespondenceItem"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "accountId", "bureau", "fieldKey", "consumerAssertionId", "id");
CREATE UNIQUE INDEX "CorrespondenceItem_tenantId_consumerId_correspondenceId_ite_key" ON "CorrespondenceItem"("tenantId", "consumerId", "correspondenceId", "itemKey");
CREATE UNIQUE INDEX "CorrespondenceItem_tenantId_consumerId_correspondenceId_ord_key" ON "CorrespondenceItem"("tenantId", "consumerId", "correspondenceId", "ordinal");

CREATE INDEX "CorrespondenceVersion_tenantId_consumerId_caseId_status_cre_idx" ON "CorrespondenceVersion"("tenantId", "consumerId", "caseId", "status", "createdAt");
CREATE UNIQUE INDEX "CorrespondenceVersion_tenantId_consumerId_id_key" ON "CorrespondenceVersion"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "CorrespondenceVersion_tenantId_consumerId_reportVersionId_c_key" ON "CorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "id");
CREATE UNIQUE INDEX "correspondence_version_packet_pin_key" ON "CorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id");
CREATE UNIQUE INDEX "CorrespondenceVersion_tenantId_consumerId_correspondenceId__key" ON "CorrespondenceVersion"("tenantId", "consumerId", "correspondenceId", "version");

CREATE UNIQUE INDEX "CorrespondenceVersionItem_tenantId_consumerId_id_key" ON "CorrespondenceVersionItem"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "cvi_version_item_key" ON "CorrespondenceVersionItem"("tenantId", "consumerId", "correspondenceVersionId", "correspondenceItemId");
CREATE UNIQUE INDEX "cvi_version_ordinal_key" ON "CorrespondenceVersionItem"("tenantId", "consumerId", "correspondenceVersionId", "ordinal");
CREATE UNIQUE INDEX "cvi_outcome_pin_key" ON "CorrespondenceVersionItem"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "correspondenceVersionId", "correspondenceItemId", "id");

CREATE INDEX "Packet_tenantId_consumerId_caseId_recipientId_round_idx" ON "Packet"("tenantId", "consumerId", "caseId", "recipientId", "round");
CREATE UNIQUE INDEX "Packet_tenantId_consumerId_id_key" ON "Packet"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "Packet_tenantId_consumerId_reportVersionId_caseId_id_key" ON "Packet"("tenantId", "consumerId", "reportVersionId", "caseId", "id");
CREATE UNIQUE INDEX "packet_artifact_pin_key" ON "Packet"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id");
CREATE UNIQUE INDEX "Packet_tenantId_consumerId_packetSeriesKey_version_key" ON "Packet"("tenantId", "consumerId", "packetSeriesKey", "version");

CREATE UNIQUE INDEX "PacketCorrespondenceVersion_tenantId_consumerId_id_key" ON "PacketCorrespondenceVersion"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "PacketCorrespondenceVersion_tenantId_consumerId_packetId_co_key" ON "PacketCorrespondenceVersion"("tenantId", "consumerId", "packetId", "correspondenceVersionId");
CREATE UNIQUE INDEX "pcv_artifact_membership_key" ON "PacketCorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "packetId", "correspondenceId", "correspondenceVersionId");
CREATE UNIQUE INDEX "PacketCorrespondenceVersion_tenantId_consumerId_packetId_or_key" ON "PacketCorrespondenceVersion"("tenantId", "consumerId", "packetId", "ordinal");

CREATE UNIQUE INDEX "PacketEnclosure_tenantId_consumerId_id_key" ON "PacketEnclosure"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "PacketEnclosure_tenantId_consumerId_packetId_artifactId_key" ON "PacketEnclosure"("tenantId", "consumerId", "packetId", "artifactId");
CREATE UNIQUE INDEX "PacketEnclosure_tenantId_consumerId_packetId_ordinal_key" ON "PacketEnclosure"("tenantId", "consumerId", "packetId", "ordinal");

CREATE INDEX "Artifact_tenantId_consumerId_kind_createdAt_idx" ON "Artifact"("tenantId", "consumerId", "kind", "createdAt");
CREATE INDEX "Artifact_tenantId_consumerId_sha256_idx" ON "Artifact"("tenantId", "consumerId", "sha256");
CREATE INDEX "Artifact_tenantId_consumerId_packetId_idx" ON "Artifact"("tenantId", "consumerId", "packetId");
CREATE UNIQUE INDEX "Artifact_tenantId_consumerId_id_key" ON "Artifact"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "Artifact_tenantId_consumerId_reportVersionId_caseId_id_key" ON "Artifact"("tenantId", "consumerId", "reportVersionId", "caseId", "id");
CREATE UNIQUE INDEX "artifact_enclosure_pin_key" ON "Artifact"("tenantId", "consumerId", "reportVersionId", "caseId", "kind", "id");
CREATE UNIQUE INDEX "artifact_packet_enclosure_pin_key" ON "Artifact"("tenantId", "consumerId", "reportVersionId", "caseId", "packetId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "kind", "id");
CREATE UNIQUE INDEX "artifact_correspondence_pin_key" ON "Artifact"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id");
CREATE UNIQUE INDEX "Artifact_tenantId_consumerId_artifactSeriesKey_version_key" ON "Artifact"("tenantId", "consumerId", "artifactSeriesKey", "version");

CREATE UNIQUE INDEX "ArtifactCorrespondenceVersion_tenantId_consumerId_id_key" ON "ArtifactCorrespondenceVersion"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "acv_artifact_version_key" ON "ArtifactCorrespondenceVersion"("tenantId", "consumerId", "artifactId", "correspondenceVersionId");
CREATE UNIQUE INDEX "acv_artifact_ordinal_key" ON "ArtifactCorrespondenceVersion"("tenantId", "consumerId", "artifactId", "ordinal");

CREATE INDEX "ArtifactTombstone_tenantId_consumerId_artifactId_createdAt_idx" ON "ArtifactTombstone"("tenantId", "consumerId", "artifactId", "createdAt");
CREATE UNIQUE INDEX "ArtifactTombstone_tenantId_consumerId_id_key" ON "ArtifactTombstone"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "ArtifactTombstone_tenantId_consumerId_eventKey_key" ON "ArtifactTombstone"("tenantId", "consumerId", "eventKey");

CREATE INDEX "EvidenceEvent_tenantId_consumerId_occurredAt_id_idx" ON "EvidenceEvent"("tenantId", "consumerId", "occurredAt", "id");
CREATE INDEX "EvidenceEvent_tenantId_consumerId_caseId_occurredAt_id_idx" ON "EvidenceEvent"("tenantId", "consumerId", "caseId", "occurredAt", "id");
CREATE INDEX "EvidenceEvent_tenantId_consumerId_subjectType_subjectId_idx" ON "EvidenceEvent"("tenantId", "consumerId", "subjectType", "subjectId");
CREATE INDEX "EvidenceEvent_tenantId_consumerId_correlationId_idx" ON "EvidenceEvent"("tenantId", "consumerId", "correlationId");
CREATE UNIQUE INDEX "EvidenceEvent_tenantId_consumerId_id_key" ON "EvidenceEvent"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "EvidenceEvent_tenantId_consumerId_eventKey_key" ON "EvidenceEvent"("tenantId", "consumerId", "eventKey");

-- Same-scope and parent-version foreign keys. RESTRICT prevents consumer/case
-- deletion from silently erasing source truth, approvals or evidence history.
ALTER TABLE "CreditTruthScope" ADD CONSTRAINT "CreditTruthScope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CreditTruthScope" ADD CONSTRAINT "CreditTruthScope_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ReportVersion" ADD CONSTRAINT "ReportVersion_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportVersion" ADD CONSTRAINT "ReportVersion_consumerId_sourceReportId_fkey" FOREIGN KEY ("consumerId", "sourceReportId") REFERENCES "Report"("userId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_tenantId_consumerId_reportVersionId_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ExtractionBureauCoverage" ADD CONSTRAINT "extraction_bureau_coverage_report_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ExtractionBureauCoverage" ADD CONSTRAINT "extraction_bureau_coverage_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Account" ADD CONSTRAINT "Account_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Account" ADD CONSTRAINT "Account_consumerId_legacyTradelineId_fkey" FOREIGN KEY ("consumerId", "legacyTradelineId") REFERENCES "Tradeline"("userId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ReportVersionAccount" ADD CONSTRAINT "ReportVersionAccount_tenantId_consumerId_reportVersionId_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportVersionAccount" ADD CONSTRAINT "ReportVersionAccount_tenantId_consumerId_accountId_fkey" FOREIGN KEY ("tenantId", "consumerId", "accountId") REFERENCES "Account"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "AccountPresenceObservation" ADD CONSTRAINT "account_presence_account_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId") REFERENCES "ReportVersionAccount"("tenantId", "consumerId", "reportVersionId", "accountId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AccountPresenceObservation" ADD CONSTRAINT "account_presence_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AccountPresenceObservation" ADD CONSTRAINT "account_presence_coverage_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "bureauCoverageId") REFERENCES "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AccountPresenceObservation" ADD CONSTRAINT "account_presence_index_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "accountIndexReportSection", "accountIndexStatus", "accountIndexCompletenessId") REFERENCES "SectionCompleteness"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "reportSection", "status", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "FieldObservation" ADD CONSTRAINT "FieldObservation_tenantId_consumerId_reportVersionId_accou_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId") REFERENCES "ReportVersionAccount"("tenantId", "consumerId", "reportVersionId", "accountId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "FieldObservation" ADD CONSTRAINT "FieldObservation_tenantId_consumerId_reportVersionId_extra_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "FieldObservation" ADD CONSTRAINT "field_observation_coverage_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "bureauCoverageId") REFERENCES "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "FieldObservation" ADD CONSTRAINT "field_observation_section_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "reportSection", "sectionStatus", "sectionCompletenessId") REFERENCES "SectionCompleteness"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "reportSection", "status", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "SectionCompleteness" ADD CONSTRAINT "section_completeness_account_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId") REFERENCES "ReportVersionAccount"("tenantId", "consumerId", "reportVersionId", "accountId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SectionCompleteness" ADD CONSTRAINT "section_completeness_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SectionCompleteness" ADD CONSTRAINT "section_completeness_coverage_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "bureauCoverageId") REFERENCES "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "HistoricalEvidence" ADD CONSTRAINT "HistoricalEvidence_tenantId_consumerId_reportVersionId_acc_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId") REFERENCES "ReportVersionAccount"("tenantId", "consumerId", "reportVersionId", "accountId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "HistoricalEvidence" ADD CONSTRAINT "HistoricalEvidence_tenantId_consumerId_reportVersionId_ext_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "HistoricalEvidence" ADD CONSTRAINT "historical_evidence_coverage_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "bureauCoverageId") REFERENCES "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "HistoricalEvidence" ADD CONSTRAINT "historical_evidence_section_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "reportSection", "sectionStatus", "sectionCompletenessId") REFERENCES "SectionCompleteness"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "reportSection", "status", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DerivedAccountAssessment" ADD CONSTRAINT "daa_report_account_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId") REFERENCES "ReportVersionAccount"("tenantId", "consumerId", "reportVersionId", "accountId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DerivedAccountAssessment" ADD CONSTRAINT "daa_extraction_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ConsumerAssertion" ADD CONSTRAINT "consumer_assertion_observation_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "fieldKey", "observationSeriesKey", "observationRevision", "observationIntegritySha256", "observationId") REFERENCES "FieldObservation"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "fieldKey", "observationSeriesKey", "revision", "integritySha256", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAssertion" ADD CONSTRAINT "consumer_assertion_assessment_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "assessmentId") REFERENCES "DerivedAccountAssessment"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAssertion" ADD CONSTRAINT "consumer_assertion_supersession_fkey" FOREIGN KEY ("tenantId", "consumerId", "assertionSeriesKey", "supersedesAssertionId") REFERENCES "ConsumerAssertion"("tenantId", "consumerId", "assertionSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "CreditScoreObservation" ADD CONSTRAINT "CreditScoreObservation_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CreditScoreObservation" ADD CONSTRAINT "credit_score_report_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CreditScoreObservation" ADD CONSTRAINT "credit_score_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CreditScoreObservation" ADD CONSTRAINT "credit_score_coverage_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "bureauCoverageId") REFERENCES "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CreditScoreObservation" ADD CONSTRAINT "credit_score_supersession_fkey" FOREIGN KEY ("tenantId", "consumerId", "observationSeriesKey", "supersedesObservationId") REFERENCES "CreditScoreObservation"("tenantId", "consumerId", "observationSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ReportComparison" ADD CONSTRAINT "ReportComparison_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportComparison" ADD CONSTRAINT "report_comparison_prior_report_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportComparison" ADD CONSTRAINT "report_comparison_prior_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportComparison" ADD CONSTRAINT "report_comparison_current_report_fkey" FOREIGN KEY ("tenantId", "consumerId", "currentReportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportComparison" ADD CONSTRAINT "report_comparison_current_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "currentReportVersionId", "currentExtractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportComparison" ADD CONSTRAINT "report_comparison_supersession_fkey" FOREIGN KEY ("tenantId", "consumerId", "comparisonSeriesKey", "supersedesComparisonId") REFERENCES "ReportComparison"("tenantId", "consumerId", "comparisonSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ReportDifference" ADD CONSTRAINT "ReportDifference_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_comparison_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId", "currentReportVersionId", "currentExtractionRunId", "comparisonId") REFERENCES "ReportComparison"("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId", "currentReportVersionId", "currentExtractionRunId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_prior_presence_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId", "bureau", "accountId", "priorPresenceObservationId") REFERENCES "AccountPresenceObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_current_presence_fkey" FOREIGN KEY ("tenantId", "consumerId", "currentReportVersionId", "currentExtractionRunId", "bureau", "accountId", "currentPresenceObservationId") REFERENCES "AccountPresenceObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_prior_field_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId", "bureau", "accountId", "fieldKey", "priorFieldObservationId") REFERENCES "FieldObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "fieldKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_current_field_fkey" FOREIGN KEY ("tenantId", "consumerId", "currentReportVersionId", "currentExtractionRunId", "bureau", "accountId", "fieldKey", "currentFieldObservationId") REFERENCES "FieldObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "fieldKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_prior_score_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId", "bureau", "priorScoreSourceMethodKey", "priorScoreSourceMethodVersion", "scoreOccurrence", "priorScoreObservationId") REFERENCES "CreditScoreObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "sourceMethodKey", "sourceMethodVersion", "occurrence", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_current_score_fkey" FOREIGN KEY ("tenantId", "consumerId", "currentReportVersionId", "currentExtractionRunId", "bureau", "currentScoreSourceMethodKey", "currentScoreSourceMethodVersion", "scoreOccurrence", "currentScoreObservationId") REFERENCES "CreditScoreObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "sourceMethodKey", "sourceMethodVersion", "occurrence", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_prior_coverage_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId", "bureau", "priorCoverageObservationId") REFERENCES "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_current_coverage_fkey" FOREIGN KEY ("tenantId", "consumerId", "currentReportVersionId", "currentExtractionRunId", "bureau", "currentCoverageObservationId") REFERENCES "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_prior_identity_fact_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "priorIdentityBaselineId", "identityFactSeriesKey", "priorIdentityFactId") REFERENCES "IdentityFact"("tenantId", "consumerId", "reportVersionId", "identityBaselineId", "factSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_current_identity_fact_fkey" FOREIGN KEY ("tenantId", "consumerId", "currentReportVersionId", "currentIdentityBaselineId", "identityFactSeriesKey", "currentIdentityFactId") REFERENCES "IdentityFact"("tenantId", "consumerId", "reportVersionId", "identityBaselineId", "factSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportDifference" ADD CONSTRAINT "report_difference_supersession_fkey" FOREIGN KEY ("tenantId", "consumerId", "differenceSeriesKey", "supersedesDifferenceId") REFERENCES "ReportDifference"("tenantId", "consumerId", "differenceSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DisputeOutcome" ADD CONSTRAINT "DisputeOutcome_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DisputeOutcome" ADD CONSTRAINT "DisputeOutcome_tenantId_consumerId_priorReportVersionId_ca_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "caseId") REFERENCES "DisputeCase"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DisputeOutcome" ADD CONSTRAINT "dispute_outcome_comparison_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId", "currentReportVersionId", "currentExtractionRunId", "comparisonId") REFERENCES "ReportComparison"("tenantId", "consumerId", "priorReportVersionId", "priorExtractionRunId", "currentReportVersionId", "currentExtractionRunId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DisputeOutcome" ADD CONSTRAINT "dispute_outcome_difference_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "currentReportVersionId", "comparisonId", "differenceId") REFERENCES "ReportDifference"("tenantId", "consumerId", "priorReportVersionId", "currentReportVersionId", "comparisonId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DisputeOutcome" ADD CONSTRAINT "dispute_outcome_target_item_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "caseId", "targetCorrespondenceId", "accountId", "bureau", "targetFieldKey", "targetConsumerAssertionId", "targetCorrespondenceItemId") REFERENCES "CorrespondenceItem"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "accountId", "bureau", "fieldKey", "consumerAssertionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DisputeOutcome" ADD CONSTRAINT "dispute_outcome_target_membership_fkey" FOREIGN KEY ("tenantId", "consumerId", "priorReportVersionId", "caseId", "targetCorrespondenceId", "targetCorrespondenceVersionId", "targetCorrespondenceItemId", "targetVersionMembershipId") REFERENCES "CorrespondenceVersionItem"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "correspondenceVersionId", "correspondenceItemId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DisputeOutcome" ADD CONSTRAINT "dispute_outcome_supersession_fkey" FOREIGN KEY ("tenantId", "consumerId", "outcomeSeriesKey", "supersedesOutcomeId") REFERENCES "DisputeOutcome"("tenantId", "consumerId", "outcomeSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "IdentityBaseline" ADD CONSTRAINT "IdentityBaseline_tenantId_consumerId_reportVersionId_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityFact" ADD CONSTRAINT "IdentityFact_tenantId_consumerId_reportVersionId_identityB_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "identityBaselineId") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "RecipientAddressVersion" ADD CONSTRAINT "RecipientAddressVersion_tenantId_consumerId_recipientId_fkey" FOREIGN KEY ("tenantId", "consumerId", "recipientId") REFERENCES "Recipient"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_tenantId_consumerId_reportVersionId_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_tenantId_consumerId_reportVersionId_caseId_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId") REFERENCES "DisputeCase"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_tenantId_consumerId_recipientId_fkey" FOREIGN KEY ("tenantId", "consumerId", "recipientId") REFERENCES "Recipient"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_tenantId_consumerId_recipientId_recipientAd_fkey" FOREIGN KEY ("tenantId", "consumerId", "recipientId", "recipientAddressVersionId") REFERENCES "RecipientAddressVersion"("tenantId", "consumerId", "recipientId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_tenantId_consumerId_reportVersionId_identit_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "identityBaselineId") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_tenantId_consumerId_reportVersionId_caseId__fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "identityBaselineId", "policyVersion", "claimClass", "parentRound", "parentCorrespondenceId") REFERENCES "Correspondence"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "identityBaselineId", "policyVersion", "claimClass", "round", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "CorrespondenceItem" ADD CONSTRAINT "CorrespondenceItem_tenantId_consumerId_reportVersionId_cas_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId") REFERENCES "Correspondence"("tenantId", "consumerId", "reportVersionId", "caseId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CorrespondenceItem" ADD CONSTRAINT "correspondence_item_observation_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "fieldKey", "observationSeriesKey", "observationRevision", "observationIntegritySha256", "observationId") REFERENCES "FieldObservation"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "fieldKey", "observationSeriesKey", "revision", "integritySha256", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CorrespondenceItem" ADD CONSTRAINT "correspondence_item_history_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "historicalEvidenceId") REFERENCES "HistoricalEvidence"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CorrespondenceItem" ADD CONSTRAINT "correspondence_item_assessment_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "assessmentId") REFERENCES "DerivedAccountAssessment"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CorrespondenceItem" ADD CONSTRAINT "correspondence_item_assertion_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "fieldKey", "observationSeriesKey", "observationRevision", "observationIntegritySha256", "observationId", "assessmentId", "consumerAssertionId") REFERENCES "ConsumerAssertion"("tenantId", "consumerId", "reportVersionId", "accountId", "extractionRunId", "bureau", "fieldKey", "observationSeriesKey", "observationRevision", "observationIntegritySha256", "observationId", "assessmentId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "CorrespondenceVersion" ADD CONSTRAINT "correspondence_version_correspondence_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "strategyKey", "claimClass", "policyVersion", "round", "parentLineageRef", "correspondenceId") REFERENCES "Correspondence"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "strategyKey", "claimClass", "policyVersion", "round", "parentLineageRef", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CorrespondenceVersion" ADD CONSTRAINT "CorrespondenceVersion_tenantId_consumerId_recipientId_reci_fkey" FOREIGN KEY ("tenantId", "consumerId", "recipientId", "recipientAddressVersionId") REFERENCES "RecipientAddressVersion"("tenantId", "consumerId", "recipientId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CorrespondenceVersion" ADD CONSTRAINT "correspondence_version_identity_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "identityBaselineId") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CorrespondenceVersion" ADD CONSTRAINT "CorrespondenceVersion_tenantId_consumerId_reportVersionId__fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "supersedesVersionId") REFERENCES "CorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "CorrespondenceVersionItem" ADD CONSTRAINT "cvi_version_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "correspondenceVersionId") REFERENCES "CorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CorrespondenceVersionItem" ADD CONSTRAINT "cvi_item_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "correspondenceItemId") REFERENCES "CorrespondenceItem"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Packet" ADD CONSTRAINT "Packet_tenantId_consumerId_reportVersionId_caseId_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId") REFERENCES "DisputeCase"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Packet" ADD CONSTRAINT "Packet_tenantId_consumerId_recipientId_fkey" FOREIGN KEY ("tenantId", "consumerId", "recipientId") REFERENCES "Recipient"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Packet" ADD CONSTRAINT "Packet_tenantId_consumerId_recipientId_recipientAddressVer_fkey" FOREIGN KEY ("tenantId", "consumerId", "recipientId", "recipientAddressVersionId") REFERENCES "RecipientAddressVersion"("tenantId", "consumerId", "recipientId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Packet" ADD CONSTRAINT "Packet_tenantId_consumerId_reportVersionId_identityBaselin_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "identityBaselineId") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "PacketCorrespondenceVersion" ADD CONSTRAINT "pcv_packet_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "packetId") REFERENCES "Packet"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PacketCorrespondenceVersion" ADD CONSTRAINT "pcv_correspondence_version_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "correspondenceVersionId") REFERENCES "CorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "PacketEnclosure" ADD CONSTRAINT "packet_enclosure_packet_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "packetId") REFERENCES "Packet"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PacketEnclosure" ADD CONSTRAINT "packet_enclosure_artifact_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "packetId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "artifactKind", "artifactId") REFERENCES "Artifact"("tenantId", "consumerId", "reportVersionId", "caseId", "packetId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "kind", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_tenantId_consumerId_reportVersionId_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_tenantId_consumerId_reportVersionId_caseId_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId") REFERENCES "DisputeCase"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_tenantId_consumerId_reportVersionId_caseId_recipi_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "packetId") REFERENCES "Packet"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_tenantId_consumerId_reportVersionId_caseId_primar_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "primaryCorrespondenceId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "primaryCorrespondenceVersionId") REFERENCES "CorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Artifact" ADD CONSTRAINT "artifact_primary_packet_membership_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "packetId", "primaryCorrespondenceId", "primaryCorrespondenceVersionId") REFERENCES "PacketCorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "packetId", "correspondenceId", "correspondenceVersionId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_tenantId_consumerId_recipientId_fkey" FOREIGN KEY ("tenantId", "consumerId", "recipientId") REFERENCES "Recipient"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_tenantId_consumerId_recipientId_recipientAddressV_fkey" FOREIGN KEY ("tenantId", "consumerId", "recipientId", "recipientAddressVersionId") REFERENCES "RecipientAddressVersion"("tenantId", "consumerId", "recipientId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_tenantId_consumerId_reportVersionId_identityBasel_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "identityBaselineId") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ArtifactCorrespondenceVersion" ADD CONSTRAINT "acv_artifact_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "artifactId") REFERENCES "Artifact"("tenantId", "consumerId", "reportVersionId", "caseId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ArtifactCorrespondenceVersion" ADD CONSTRAINT "acv_correspondence_version_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "correspondenceVersionId") REFERENCES "CorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "correspondenceId", "recipientId", "recipientAddressVersionId", "identityBaselineId", "policyVersion", "round", "claimClass", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ArtifactCorrespondenceVersion" ADD CONSTRAINT "acv_packet_membership_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "packetId", "correspondenceId", "correspondenceVersionId") REFERENCES "PacketCorrespondenceVersion"("tenantId", "consumerId", "reportVersionId", "caseId", "packetId", "correspondenceId", "correspondenceVersionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ArtifactTombstone" ADD CONSTRAINT "ArtifactTombstone_tenantId_consumerId_artifactId_fkey" FOREIGN KEY ("tenantId", "consumerId", "artifactId") REFERENCES "Artifact"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "EvidenceEvent" ADD CONSTRAINT "EvidenceEvent_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "EvidenceEvent" ADD CONSTRAINT "EvidenceEvent_tenantId_consumerId_caseId_fkey" FOREIGN KEY ("tenantId", "consumerId", "caseId") REFERENCES "DisputeCase"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Scope creation is fail-closed: either a direct consumer scope (same id on both
-- sides), or the current repository agency relationship must authorize the pair.
CREATE FUNCTION p0_validate_credit_truth_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."tenantId" = NEW."consumerId" THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "User" AS tenant_user
    JOIN "User" AS consumer_user
      ON consumer_user."id" = NEW."consumerId"
    WHERE tenant_user."id" = NEW."tenantId"
      AND tenant_user."isAgency" = TRUE
      AND consumer_user."managedByAgencyId" = NEW."tenantId"
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'credit truth scope is not an authorized tenant-consumer pair';
END;
$$;

CREATE TRIGGER "CreditTruthScope_authorized_pair_trg"
BEFORE INSERT OR UPDATE ON "CreditTruthScope"
FOR EACH ROW EXECUTE FUNCTION p0_validate_credit_truth_scope();

-- Legacy flattened data can be referenced for provenance but cannot become v2
-- observed truth. A new-upload, synthetic, or separately authorized reanalysis
-- ReportVersion with SHADOW_V2/AUTHORITATIVE_V2 authority is required.
CREATE FUNCTION p0_validate_v2_truth_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ReportVersion" rv
    WHERE rv."tenantId" = NEW."tenantId"
      AND rv."consumerId" = NEW."consumerId"
      AND rv."id" = NEW."reportVersionId"
      AND rv."origin" <> 'LEGACY_IMPORT'
      AND rv."authorityStatus" IN ('SHADOW_V2', 'AUTHORITATIVE_V2')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'v2 truth requires a non-legacy report version and explicit v2 authority';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ExtractionRun_v2_authority_trg"
BEFORE INSERT ON "ExtractionRun"
FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_truth_insert();

CREATE TRIGGER "ExtractionBureauCoverage_v2_authority_trg"
BEFORE INSERT ON "ExtractionBureauCoverage"
FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_truth_insert();

CREATE TRIGGER "AccountPresenceObservation_v2_authority_trg"
BEFORE INSERT ON "AccountPresenceObservation"
FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_truth_insert();

CREATE TRIGGER "FieldObservation_v2_authority_trg"
BEFORE INSERT ON "FieldObservation"
FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_truth_insert();

CREATE TRIGGER "SectionCompleteness_v2_authority_trg"
BEFORE INSERT ON "SectionCompleteness"
FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_truth_insert();

CREATE TRIGGER "HistoricalEvidence_v2_authority_trg"
BEFORE INSERT ON "HistoricalEvidence"
FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_truth_insert();

CREATE TRIGGER "DerivedAccountAssessment_v2_authority_trg"
BEFORE INSERT ON "DerivedAccountAssessment"
FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_truth_insert();

-- A report-account row is either source-listed or an explicit comparison-only
-- carry-forward subject. Report rows share the comparison serialization lock so a
-- completed comparison cannot gain new account-universe members after sealing.
CREATE FUNCTION p0_validate_report_account_subject()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_report RECORD;
BEGIN
  SELECT rv.* INTO current_report
  FROM "ReportVersion" rv
  WHERE rv."tenantId" = NEW."tenantId"
    AND rv."consumerId" = NEW."consumerId"
    AND rv."id" = NEW."reportVersionId"
  FOR UPDATE;

  IF NOT FOUND
    OR current_report."origin" = 'LEGACY_IMPORT'
    OR current_report."authorityStatus" NOT IN ('SHADOW_V2', 'AUTHORITATIVE_V2')
    OR NEW."authorityStatus" NOT IN ('SHADOW_V2', 'AUTHORITATIVE_V2')
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'report account subjects require an explicitly v2-authorized report and membership';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ReportComparison" rc
    WHERE rc."tenantId" = NEW."tenantId"
      AND rc."consumerId" = NEW."consumerId"
      AND rc."state" <> 'PENDING_EVIDENCE'
      AND NEW."reportVersionId" IN (rc."priorReportVersionId", rc."currentReportVersionId")
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'comparison report-account universe is sealed; append a successor report/comparison';
  END IF;

  IF NEW."membershipOrigin" = 'COMPARISON_CARRY_FORWARD' AND NOT EXISTS (
    SELECT 1
    FROM "ReportVersionAccount" prior_rva
    JOIN "ReportVersion" prior_rv
      ON prior_rv."tenantId" = prior_rva."tenantId"
     AND prior_rv."consumerId" = prior_rva."consumerId"
     AND prior_rv."id" = prior_rva."reportVersionId"
    WHERE prior_rva."tenantId" = NEW."tenantId"
      AND prior_rva."consumerId" = NEW."consumerId"
      AND prior_rva."accountId" = NEW."accountId"
      AND prior_rva."membershipOrigin" = 'SOURCE_LISTED'
      AND prior_rva."authorityStatus" IN ('SHADOW_V2', 'AUTHORITATIVE_V2')
      AND prior_rv."reportSeriesKey" = current_report."reportSeriesKey"
      AND prior_rv."version" < current_report."version"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'comparison carry-forward requires an earlier same-series source-listed account';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ReportVersionAccount_validate_subject_trg"
BEFORE INSERT ON "ReportVersionAccount"
FOR EACH ROW EXECUTE FUNCTION p0_validate_report_account_subject();

-- Account-bound v2 truth also requires a v2-authorized membership in the exact
-- report version; a legacy Tradeline link never upgrades itself by reference.
CREATE FUNCTION p0_validate_v2_account_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  membership_origin "ReportAccountMembershipOrigin";
BEGIN
  SELECT rva."membershipOrigin"
  INTO membership_origin
    FROM "ReportVersionAccount" rva
    WHERE rva."tenantId" = NEW."tenantId"
      AND rva."consumerId" = NEW."consumerId"
      AND rva."reportVersionId" = NEW."reportVersionId"
      AND rva."accountId" = NEW."accountId"
      AND rva."authorityStatus" IN ('SHADOW_V2', 'AUTHORITATIVE_V2');

  IF membership_origin IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'account-bound v2 truth requires an explicitly v2-authorized report membership';
  END IF;

  -- Carry-forward rows are evaluation subjects for stable accounts absent from
  -- the current source. They may hold only the ACCOUNT_INDEX proof needed to
  -- express ABSENT_CONFIRMED/UNKNOWN; they cannot become source membership by
  -- acquiring current-report fields/history or a CLEAN assessment.
  IF membership_origin = 'COMPARISON_CARRY_FORWARD' THEN
    IF TG_TABLE_NAME = 'AccountPresenceObservation'
      AND (to_jsonb(NEW) ->> 'presence') NOT IN ('ABSENT_CONFIRMED', 'UNKNOWN')
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'comparison carry-forward account presence may be only ABSENT_CONFIRMED or UNKNOWN';
    ELSIF TG_TABLE_NAME IN ('FieldObservation', 'HistoricalEvidence') THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'comparison carry-forward subjects cannot acquire current-report field or historical evidence';
    ELSIF TG_TABLE_NAME = 'SectionCompleteness'
      AND (to_jsonb(NEW) ->> 'reportSection') <> 'ACCOUNT_INDEX'
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'comparison carry-forward subjects may carry only ACCOUNT_INDEX completeness';
    ELSIF TG_TABLE_NAME = 'DerivedAccountAssessment'
      AND (to_jsonb(NEW) ->> 'accountCondition') = 'CLEAN'
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'comparison carry-forward subjects cannot receive a CLEAN assessment';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "AccountPresenceObservation_v2_membership_trg" BEFORE INSERT ON "AccountPresenceObservation" FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_account_membership();
CREATE TRIGGER "FieldObservation_v2_membership_trg" BEFORE INSERT ON "FieldObservation" FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_account_membership();
CREATE TRIGGER "SectionCompleteness_v2_membership_trg" BEFORE INSERT ON "SectionCompleteness" FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_account_membership();
CREATE TRIGGER "HistoricalEvidence_v2_membership_trg" BEFORE INSERT ON "HistoricalEvidence" FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_account_membership();
CREATE TRIGGER "DerivedAccountAssessment_v2_membership_trg" BEFORE INSERT ON "DerivedAccountAssessment" FOR EACH ROW EXECUTE FUNCTION p0_validate_v2_account_membership();

-- Parser-v2 always carries an explicit disposition for each supported bureau.
-- This deferred trigger permits run + coverage rows in either insert order while
-- rejecting silent/missing coverage at transaction commit.
CREATE FUNCTION p0_validate_extraction_bureau_coverage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  supported_count INTEGER;
  total_count INTEGER;
  covered_count INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE ebc."bureau" IN ('EQUIFAX', 'EXPERIAN', 'TRANSUNION')),
    COUNT(*),
    COUNT(*) FILTER (WHERE ebc."coverageStatus" = 'COVERED')
  INTO supported_count, total_count, covered_count
  FROM "ExtractionBureauCoverage" ebc
  WHERE ebc."tenantId" = NEW."tenantId"
    AND ebc."consumerId" = NEW."consumerId"
    AND ebc."reportVersionId" = NEW."reportVersionId"
    AND ebc."extractionRunId" = NEW."id";

  IF supported_count <> 3 OR total_count <> 3 OR covered_count < 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'parser-v2 extraction requires EQUIFAX, EXPERIAN and TRANSUNION coverage rows and at least one covered bureau';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "ExtractionRun_complete_bureau_coverage_trg"
AFTER INSERT ON "ExtractionRun"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_extraction_bureau_coverage();

-- Exact existing-row transaction locks close the MVCC check/insert race. Every
-- assessment and account-input path acquires the immutable ExtractionRun row first
-- and the immutable ReportVersionAccount row second. Coverage uses the run lock.
-- The locks are acquired inside the validators before any state query and are held
-- until transaction end; trigger-name ordering is therefore irrelevant.
CREATE FUNCTION p0_lock_extraction_run(
  p_tenant_id TEXT,
  p_consumer_id TEXT,
  p_report_version_id TEXT,
  p_extraction_run_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1
  FROM "ExtractionRun" er
  WHERE er."tenantId" = p_tenant_id
    AND er."consumerId" = p_consumer_id
    AND er."reportVersionId" = p_report_version_id
    AND er."id" = p_extraction_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'assessment input references an unknown exact extraction run';
  END IF;
END;
$$;

CREATE FUNCTION p0_lock_assessment_input(
  p_tenant_id TEXT,
  p_consumer_id TEXT,
  p_report_version_id TEXT,
  p_account_id TEXT,
  p_extraction_run_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM p0_lock_extraction_run(
    p_tenant_id,
    p_consumer_id,
    p_report_version_id,
    p_extraction_run_id
  );

  PERFORM 1
  FROM "ReportVersionAccount" rva
  WHERE rva."tenantId" = p_tenant_id
    AND rva."consumerId" = p_consumer_id
    AND rva."reportVersionId" = p_report_version_id
    AND rva."accountId" = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'assessment input references an unknown exact report account';
  END IF;
END;
$$;

-- Caller must already hold the exact ExtractionRun row lock. A completed
-- comparison is an immutable snapshot and seals both consumed runs; corrections
-- append a successor extraction and comparison. PENDING_EVIDENCE is build-only
-- and never dispatches an outcome.
CREATE FUNCTION p0_reject_if_run_is_compared(
  p_tenant_id TEXT,
  p_consumer_id TEXT,
  p_report_version_id TEXT,
  p_extraction_run_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ReportComparison" rc
    WHERE rc."tenantId" = p_tenant_id
      AND rc."consumerId" = p_consumer_id
      AND rc."state" <> 'PENDING_EVIDENCE'
      AND (
        (rc."priorReportVersionId" = p_report_version_id AND rc."priorExtractionRunId" = p_extraction_run_id)
        OR
        (rc."currentReportVersionId" = p_report_version_id AND rc."currentExtractionRunId" = p_extraction_run_id)
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'comparison inputs are sealed; append a successor extraction run and comparison';
  END IF;
END;
$$;

-- Once any assessment pins an input set, exact-run inputs are sealed. Historical
-- adversity is intentionally report-version/account monotonic because CLEAN scans
-- all history on that report version; newly discovered history therefore requires
-- a successor ReportVersion, not a late row that makes an earlier CLEAN stale.
CREATE FUNCTION p0_reject_post_assessment_account_input()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM p0_lock_assessment_input(
    NEW."tenantId",
    NEW."consumerId",
    NEW."reportVersionId",
    NEW."accountId",
    NEW."extractionRunId"
  );

  PERFORM p0_reject_if_run_is_compared(
    NEW."tenantId",
    NEW."consumerId",
    NEW."reportVersionId",
    NEW."extractionRunId"
  );

  IF EXISTS (
    SELECT 1
    FROM "DerivedAccountAssessment" daa
    WHERE daa."tenantId" = NEW."tenantId"
      AND daa."consumerId" = NEW."consumerId"
      AND daa."reportVersionId" = NEW."reportVersionId"
      AND daa."accountId" = NEW."accountId"
      AND (
        (TG_TABLE_NAME = 'HistoricalEvidence')
        OR daa."extractionRunId" = NEW."extractionRunId"
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = CASE
        WHEN TG_TABLE_NAME = 'HistoricalEvidence'
          THEN 'report-version historical inputs are sealed; append a successor ReportVersion before adding history'
        ELSE 'assessment inputs are sealed; append a new extraction run before adding run-scoped evidence'
      END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "AccountPresenceObservation_sealed_input_trg" BEFORE INSERT ON "AccountPresenceObservation" FOR EACH ROW EXECUTE FUNCTION p0_reject_post_assessment_account_input();
CREATE TRIGGER "FieldObservation_sealed_input_trg" BEFORE INSERT ON "FieldObservation" FOR EACH ROW EXECUTE FUNCTION p0_reject_post_assessment_account_input();
CREATE TRIGGER "SectionCompleteness_sealed_input_trg" BEFORE INSERT ON "SectionCompleteness" FOR EACH ROW EXECUTE FUNCTION p0_reject_post_assessment_account_input();
CREATE TRIGGER "HistoricalEvidence_sealed_input_trg" BEFORE INSERT ON "HistoricalEvidence" FOR EACH ROW EXECUTE FUNCTION p0_reject_post_assessment_account_input();

CREATE FUNCTION p0_reject_post_assessment_coverage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM p0_lock_extraction_run(
    NEW."tenantId",
    NEW."consumerId",
    NEW."reportVersionId",
    NEW."extractionRunId"
  );

  PERFORM p0_reject_if_run_is_compared(
    NEW."tenantId",
    NEW."consumerId",
    NEW."reportVersionId",
    NEW."extractionRunId"
  );

  IF EXISTS (
    SELECT 1
    FROM "DerivedAccountAssessment" daa
    WHERE daa."tenantId" = NEW."tenantId"
      AND daa."consumerId" = NEW."consumerId"
      AND daa."reportVersionId" = NEW."reportVersionId"
      AND daa."extractionRunId" = NEW."extractionRunId"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'assessment coverage is sealed; append a new extraction run before changing source coverage';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ExtractionBureauCoverage_sealed_input_trg" BEFORE INSERT ON "ExtractionBureauCoverage" FOR EACH ROW EXECUTE FUNCTION p0_reject_post_assessment_coverage();

-- Database backstop for the most important classification invariant. Historical
-- adversity is monotonic across the whole ReportVersion. CLEAN additionally
-- requires the parser-v2 all-bureau coverage snapshot, every required section,
-- typed account presence, every required condition field, and affirmative current
-- non-adverse evidence on each covered bureau in the exact pinned run.
CREATE FUNCTION p0_validate_assessment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM p0_lock_assessment_input(
    NEW."tenantId",
    NEW."consumerId",
    NEW."reportVersionId",
    NEW."accountId",
    NEW."extractionRunId"
  );

  IF NEW."accountCondition" = 'CLEAN' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "ExtractionRun" er
      WHERE er."tenantId" = NEW."tenantId"
        AND er."consumerId" = NEW."consumerId"
        AND er."reportVersionId" = NEW."reportVersionId"
        AND er."id" = NEW."extractionRunId"
        AND er."status" = 'SUCCEEDED'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CLEAN requires a successful exact extraction run';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "HistoricalEvidence" he
      WHERE he."tenantId" = NEW."tenantId"
        AND he."consumerId" = NEW."consumerId"
        AND he."reportVersionId" = NEW."reportVersionId"
        AND he."accountId" = NEW."accountId"
        AND he."presence" = 'PRESENT'
        AND he."evidenceType" <> 'OTHER_NON_ADVERSE'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CLEAN is forbidden when report-version historical adversity exists';
    END IF;

    IF (SELECT COUNT(*) FROM "ExtractionBureauCoverage" ebc
        WHERE ebc."tenantId" = NEW."tenantId"
          AND ebc."consumerId" = NEW."consumerId"
          AND ebc."reportVersionId" = NEW."reportVersionId"
          AND ebc."extractionRunId" = NEW."extractionRunId") <> 3
      OR NOT EXISTS (
        SELECT 1
        FROM "ExtractionBureauCoverage" ebc
        WHERE ebc."tenantId" = NEW."tenantId"
          AND ebc."consumerId" = NEW."consumerId"
          AND ebc."reportVersionId" = NEW."reportVersionId"
          AND ebc."extractionRunId" = NEW."extractionRunId"
          AND ebc."coverageStatus" = 'COVERED'
      ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CLEAN requires the explicit parser-v2 disposition for all three bureaus and at least one covered bureau';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "ExtractionBureauCoverage" ebc
      CROSS JOIN (
        VALUES
          ('ACCOUNT_INDEX'::"CreditReportSection"),
          ('ACCOUNT_SUMMARY'::"CreditReportSection"),
          ('ACCOUNT_DETAIL'::"CreditReportSection"),
          ('PAYMENT_HISTORY'::"CreditReportSection"),
          ('COLLECTIONS'::"CreditReportSection"),
          ('REMARKS'::"CreditReportSection")
      ) AS required_section("reportSection")
      WHERE ebc."tenantId" = NEW."tenantId"
        AND ebc."consumerId" = NEW."consumerId"
        AND ebc."reportVersionId" = NEW."reportVersionId"
        AND ebc."extractionRunId" = NEW."extractionRunId"
        AND ebc."coverageStatus" = 'COVERED'
        AND NOT EXISTS (
          SELECT 1
          FROM "SectionCompleteness" sc
          WHERE sc."tenantId" = NEW."tenantId"
            AND sc."consumerId" = NEW."consumerId"
            AND sc."reportVersionId" = NEW."reportVersionId"
            AND sc."accountId" = NEW."accountId"
            AND sc."extractionRunId" = NEW."extractionRunId"
            AND sc."bureau" = ebc."bureau"
            AND sc."bureauCoverageId" = ebc."id"
            AND sc."coverageStatus" = 'COVERED'
            AND sc."reportSection" = required_section."reportSection"
            AND sc."status" = 'COMPLETE'
        )
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CLEAN requires all parser-v2 condition sections COMPLETE for every covered bureau';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "ExtractionBureauCoverage" ebc
      WHERE ebc."tenantId" = NEW."tenantId"
        AND ebc."consumerId" = NEW."consumerId"
        AND ebc."reportVersionId" = NEW."reportVersionId"
        AND ebc."extractionRunId" = NEW."extractionRunId"
        AND ebc."coverageStatus" = 'COVERED'
        AND NOT EXISTS (
          SELECT 1
          FROM "AccountPresenceObservation" apo
          WHERE apo."tenantId" = NEW."tenantId"
            AND apo."consumerId" = NEW."consumerId"
            AND apo."reportVersionId" = NEW."reportVersionId"
            AND apo."accountId" = NEW."accountId"
            AND apo."extractionRunId" = NEW."extractionRunId"
            AND apo."bureau" = ebc."bureau"
            AND apo."bureauCoverageId" = ebc."id"
            AND apo."coverageStatus" = 'COVERED'
            AND apo."presence" = 'PRESENT'
        )
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CLEAN requires typed PRESENT account presence for every covered bureau';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "ExtractionBureauCoverage" ebc
      CROSS JOIN (
        VALUES
          ('summaryStatus'),
          ('detailedStatus'),
          ('balanceCents'),
          ('dofd'),
          ('relevantDates'),
          ('paymentHistory'),
          ('collectionFacts'),
          ('chargeOffMarker'),
          ('lossReported'),
          ('remarks')
      ) AS required_field("fieldKey")
      WHERE ebc."tenantId" = NEW."tenantId"
        AND ebc."consumerId" = NEW."consumerId"
        AND ebc."reportVersionId" = NEW."reportVersionId"
        AND ebc."extractionRunId" = NEW."extractionRunId"
        AND ebc."coverageStatus" = 'COVERED'
        AND NOT EXISTS (
          SELECT 1
          FROM "FieldObservation" fo
          WHERE fo."tenantId" = NEW."tenantId"
            AND fo."consumerId" = NEW."consumerId"
            AND fo."reportVersionId" = NEW."reportVersionId"
            AND fo."accountId" = NEW."accountId"
            AND fo."extractionRunId" = NEW."extractionRunId"
            AND fo."bureau" = ebc."bureau"
            AND fo."bureauCoverageId" = ebc."id"
            AND fo."coverageStatus" = 'COVERED'
            AND fo."fieldKey" = required_field."fieldKey"
            AND fo."sectionStatus" = 'COMPLETE'
            AND fo."presence" IN ('PRESENT', 'ABSENT_CONFIRMED')
        )
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CLEAN requires known observations for every parser-v2 condition field on every covered bureau';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "ExtractionBureauCoverage" ebc
      WHERE ebc."tenantId" = NEW."tenantId"
        AND ebc."consumerId" = NEW."consumerId"
        AND ebc."reportVersionId" = NEW."reportVersionId"
        AND ebc."extractionRunId" = NEW."extractionRunId"
        AND ebc."coverageStatus" = 'COVERED'
        AND NOT EXISTS (
          SELECT 1
          FROM "FieldObservation" fo
          WHERE fo."tenantId" = NEW."tenantId"
            AND fo."consumerId" = NEW."consumerId"
            AND fo."reportVersionId" = NEW."reportVersionId"
            AND fo."accountId" = NEW."accountId"
            AND fo."extractionRunId" = NEW."extractionRunId"
            AND fo."bureau" = ebc."bureau"
            AND fo."bureauCoverageId" = ebc."id"
            AND fo."coverageStatus" = 'COVERED'
            AND fo."sectionStatus" = 'COMPLETE'
            AND fo."presence" = 'PRESENT'
            AND fo."assessmentSignal" = 'AFFIRMATIVE_NON_ADVERSE'
        )
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CLEAN requires affirmative non-adverse source evidence for every covered bureau';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "FieldObservation" fo
      WHERE fo."tenantId" = NEW."tenantId"
        AND fo."consumerId" = NEW."consumerId"
        AND fo."reportVersionId" = NEW."reportVersionId"
        AND fo."accountId" = NEW."accountId"
        AND fo."extractionRunId" = NEW."extractionRunId"
        AND fo."assessmentSignal" = 'ADVERSE'
    ) OR EXISTS (
      SELECT 1
      FROM "HistoricalEvidence" he
      WHERE he."tenantId" = NEW."tenantId"
        AND he."consumerId" = NEW."consumerId"
        AND he."reportVersionId" = NEW."reportVersionId"
        AND he."accountId" = NEW."accountId"
        AND he."extractionRunId" = NEW."extractionRunId"
        AND he."presence" = 'UNKNOWN'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CLEAN is forbidden when the pinned extraction contains adverse or UNKNOWN historical evidence';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "DerivedAccountAssessment_clean_truth_trg"
BEFORE INSERT ON "DerivedAccountAssessment"
FOR EACH ROW EXECUTE FUNCTION p0_validate_assessment_insert();

CREATE FUNCTION p0_validate_consumer_assertion_supersession()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prior_version INTEGER;
BEGIN
  IF NEW."supersedesAssertionId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."supersedesAssertionId" = NEW."id" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'a consumer assertion cannot supersede itself';
  END IF;

  SELECT ca."version"
  INTO prior_version
  FROM "ConsumerAssertion" ca
  WHERE ca."tenantId" = NEW."tenantId"
    AND ca."consumerId" = NEW."consumerId"
    AND ca."assertionSeriesKey" = NEW."assertionSeriesKey"
    AND ca."id" = NEW."supersedesAssertionId";

  IF prior_version IS NULL OR prior_version >= NEW."version" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'assertion supersession must reference a lower version of the same assertion series';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ConsumerAssertion_supersession_order_trg"
BEFORE INSERT ON "ConsumerAssertion"
FOR EACH ROW EXECUTE FUNCTION p0_validate_consumer_assertion_supersession();

CREATE FUNCTION p0_validate_credit_score_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prior_score RECORD;
BEGIN
  IF NEW."sourceType" = 'REPORT_DERIVED' THEN
    PERFORM p0_lock_extraction_run(
      NEW."tenantId",
      NEW."consumerId",
      NEW."reportVersionId",
      NEW."extractionRunId"
    );

    PERFORM p0_reject_if_run_is_compared(
      NEW."tenantId",
      NEW."consumerId",
      NEW."reportVersionId",
      NEW."extractionRunId"
    );
  END IF;

  IF NEW."revision" = 1 AND NEW."supersedesObservationId" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'credit score revision 1 cannot supersede another observation';
  ELSIF NEW."revision" > 1 AND NEW."supersedesObservationId" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'credit score revisions after 1 require the exact prior series revision';
  END IF;

  IF NEW."supersedesObservationId" IS NOT NULL THEN
    IF NEW."supersedesObservationId" = NEW."id" THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'a credit score observation cannot supersede itself';
    END IF;

    SELECT cso.* INTO prior_score
    FROM "CreditScoreObservation" cso
    WHERE cso."tenantId" = NEW."tenantId"
      AND cso."consumerId" = NEW."consumerId"
      AND cso."observationSeriesKey" = NEW."observationSeriesKey"
      AND cso."id" = NEW."supersedesObservationId";

    IF NOT FOUND
      OR prior_score."revision" <> NEW."revision" - 1
      OR prior_score."sourceType" IS DISTINCT FROM NEW."sourceType"
      OR prior_score."evidenceRole" IS DISTINCT FROM NEW."evidenceRole"
      OR prior_score."bureau" IS DISTINCT FROM NEW."bureau"
      OR prior_score."reportVersionId" IS DISTINCT FROM NEW."reportVersionId"
      OR prior_score."extractionRunId" IS DISTINCT FROM NEW."extractionRunId"
      OR prior_score."occurrence" IS DISTINCT FROM NEW."occurrence"
      OR prior_score."sourceMethodKey" IS DISTINCT FROM NEW."sourceMethodKey"
      OR prior_score."sourceMethodVersion" IS DISTINCT FROM NEW."sourceMethodVersion"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'credit score supersession must be the exact prior revision of the same report/run/method/occurrence context';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CreditScoreObservation_validate_insert_trg"
BEFORE INSERT ON "CreditScoreObservation"
FOR EACH ROW EXECUTE FUNCTION p0_validate_credit_score_insert();

CREATE FUNCTION p0_validate_report_comparison_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  locked_reports INTEGER;
  locked_runs INTEGER;
  expected_reports INTEGER;
  prior_report RECORD;
  current_report RECORD;
  prior_comparison RECORD;
  prior_run_status "ExtractionRunStatus";
  current_run_status "ExtractionRunStatus";
BEGIN
  expected_reports := CASE WHEN NEW."purpose" = 'EXTRACTION_RECONCILIATION' THEN 1 ELSE 2 END;

  -- Report rows are locked first, then run rows; each set is globally ordered so
  -- A→B and B→A comparison attempts cannot deadlock.
  PERFORM 1
  FROM "ReportVersion" rv
  WHERE rv."tenantId" = NEW."tenantId"
    AND rv."consumerId" = NEW."consumerId"
    AND rv."id" IN (NEW."priorReportVersionId", NEW."currentReportVersionId")
  ORDER BY rv."id"
  FOR UPDATE;
  GET DIAGNOSTICS locked_reports = ROW_COUNT;

  IF locked_reports <> expected_reports THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'comparison references an unknown exact report version';
  END IF;

  PERFORM 1
  FROM "ExtractionRun" er
  WHERE er."tenantId" = NEW."tenantId"
    AND er."consumerId" = NEW."consumerId"
    AND (
      (er."reportVersionId" = NEW."priorReportVersionId" AND er."id" = NEW."priorExtractionRunId")
      OR
      (er."reportVersionId" = NEW."currentReportVersionId" AND er."id" = NEW."currentExtractionRunId")
    )
  ORDER BY er."reportVersionId", er."id"
  FOR UPDATE;
  GET DIAGNOSTICS locked_runs = ROW_COUNT;

  IF locked_runs <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'comparison references unknown or duplicate exact extraction runs';
  END IF;

  SELECT er."status"
  INTO prior_run_status
  FROM "ExtractionRun" er
  WHERE er."tenantId" = NEW."tenantId"
    AND er."consumerId" = NEW."consumerId"
    AND er."reportVersionId" = NEW."priorReportVersionId"
    AND er."id" = NEW."priorExtractionRunId";

  SELECT er."status"
  INTO current_run_status
  FROM "ExtractionRun" er
  WHERE er."tenantId" = NEW."tenantId"
    AND er."consumerId" = NEW."consumerId"
    AND er."reportVersionId" = NEW."currentReportVersionId"
    AND er."id" = NEW."currentExtractionRunId";

  IF NEW."state" = 'COMPARABLE'
    AND (prior_run_status <> 'SUCCEEDED' OR current_run_status <> 'SUCCEEDED')
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'COMPARABLE comparisons require two SUCCEEDED extraction runs';
  ELSIF NEW."state" = 'PARTIALLY_COMPARABLE'
    AND (prior_run_status = 'FAILED' OR current_run_status = 'FAILED')
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'PARTIALLY_COMPARABLE comparisons cannot consume a FAILED extraction run';
  END IF;

  SELECT rv.* INTO prior_report
  FROM "ReportVersion" rv
  WHERE rv."tenantId" = NEW."tenantId"
    AND rv."consumerId" = NEW."consumerId"
    AND rv."id" = NEW."priorReportVersionId";

  SELECT rv.* INTO current_report
  FROM "ReportVersion" rv
  WHERE rv."tenantId" = NEW."tenantId"
    AND rv."consumerId" = NEW."consumerId"
    AND rv."id" = NEW."currentReportVersionId";

  IF NEW."purpose" = 'TEMPORAL_REPORT_CHANGE' THEN
    IF NEW."chronologyBasis" <> 'SAME_SERIES_VERSION_ORDER'
      OR prior_report."reportSeriesKey" <> current_report."reportSeriesKey"
      OR prior_report."version" >= current_report."version"
      OR prior_report."inputSha256" = current_report."inputSha256"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'temporal comparison requires same-series increasing versions with distinct source inputs';
    END IF;
  ELSE
    IF NEW."chronologyBasis" <> 'NOT_ESTABLISHED'
      OR prior_report."inputSha256" <> current_report."inputSha256"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'extraction reconciliation requires the same source input and no temporal chronology claim';
    END IF;
  END IF;

  IF NEW."state" = 'PENDING_EVIDENCE' AND NEW."differenceCount" <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'pending comparison cannot declare completed difference children';
  ELSIF NEW."state" IN ('COMPARABLE', 'PARTIALLY_COMPARABLE') AND NEW."differenceCount" = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'comparable comparison requires at least one sealed difference';
  END IF;

  IF NEW."version" = 1 AND NEW."supersedesComparisonId" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'comparison version 1 cannot supersede another comparison';
  ELSIF NEW."version" > 1 AND NEW."supersedesComparisonId" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'comparison versions after 1 require the exact prior series version';
  END IF;

  IF NEW."supersedesComparisonId" IS NOT NULL THEN
    IF NEW."supersedesComparisonId" = NEW."id" THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'a report comparison cannot supersede itself';
    END IF;

    SELECT rc.* INTO prior_comparison
    FROM "ReportComparison" rc
    WHERE rc."tenantId" = NEW."tenantId"
      AND rc."consumerId" = NEW."consumerId"
      AND rc."comparisonSeriesKey" = NEW."comparisonSeriesKey"
      AND rc."id" = NEW."supersedesComparisonId";

    IF NOT FOUND
      OR prior_comparison."version" <> NEW."version" - 1
      OR prior_comparison."priorReportVersionId" <> NEW."priorReportVersionId"
      OR prior_comparison."priorExtractionRunId" <> NEW."priorExtractionRunId"
      OR prior_comparison."currentReportVersionId" <> NEW."currentReportVersionId"
      OR prior_comparison."currentExtractionRunId" <> NEW."currentExtractionRunId"
      OR prior_comparison."purpose" <> NEW."purpose"
      OR prior_comparison."sourcePolicy" <> NEW."sourcePolicy"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'comparison supersession must be the exact prior version of the same report/run purpose';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ReportComparison_validate_insert_trg"
BEFORE INSERT ON "ReportComparison"
FOR EACH ROW EXECUTE FUNCTION p0_validate_report_comparison_insert();

CREATE FUNCTION p0_map_section_completeness(status "SectionExtractionStatus")
RETURNS "ComparisonEvidenceCompleteness"
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN status IS NULL THEN 'UNKNOWN'::"ComparisonEvidenceCompleteness"
    WHEN status = 'COMPLETE' THEN 'COMPLETE'::"ComparisonEvidenceCompleteness"
    WHEN status = 'PARTIAL' THEN 'PARTIAL'::"ComparisonEvidenceCompleteness"
    WHEN status = 'UNKNOWN' THEN 'UNKNOWN'::"ComparisonEvidenceCompleteness"
    ELSE 'INCOMPLETE'::"ComparisonEvidenceCompleteness"
  END
$$;

CREATE FUNCTION p0_map_score_completeness(status "CreditScoreEvidenceCompleteness")
RETURNS "ComparisonEvidenceCompleteness"
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE status
    WHEN 'COMPLETE' THEN 'COMPLETE'::"ComparisonEvidenceCompleteness"
    WHEN 'PARTIAL' THEN 'PARTIAL'::"ComparisonEvidenceCompleteness"
    WHEN 'UNKNOWN' THEN 'UNKNOWN'::"ComparisonEvidenceCompleteness"
    ELSE 'INCOMPLETE'::"ComparisonEvidenceCompleteness"
  END
$$;

-- Caller-provided labels are never trusted as source truth. This validator reads
-- the exact pinned rows, derives their completeness, and proves every comparable
-- or current-report-absence claim from those immutable rows.
CREATE FUNCTION p0_validate_report_difference_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_comparison RECORD;
  prior_presence RECORD;
  current_presence RECORD;
  prior_field RECORD;
  current_field RECORD;
  prior_score RECORD;
  current_score RECORD;
  prior_score_report RECORD;
  current_score_report RECORD;
  prior_coverage RECORD;
  current_coverage RECORD;
  prior_identity RECORD;
  current_identity RECORD;
  prior_difference RECORD;
  expected_field_change "ReportDifferenceChangeKind";
  calculated_prior "ComparisonEvidenceCompleteness" := 'UNKNOWN';
  calculated_current "ComparisonEvidenceCompleteness" := 'UNKNOWN';
BEGIN
  SELECT rc.*
  INTO parent_comparison
  FROM "ReportComparison" rc
  WHERE rc."tenantId" = NEW."tenantId"
    AND rc."consumerId" = NEW."consumerId"
    AND rc."priorReportVersionId" = NEW."priorReportVersionId"
    AND rc."priorExtractionRunId" = NEW."priorExtractionRunId"
    AND rc."currentReportVersionId" = NEW."currentReportVersionId"
    AND rc."currentExtractionRunId" = NEW."currentExtractionRunId"
    AND rc."id" = NEW."comparisonId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'difference requires an exact immutable report comparison';
  ELSIF parent_comparison."state" = 'PENDING_EVIDENCE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'pending comparisons cannot contain completed difference rows';
  END IF;

  IF NEW."scopeType" = 'ACCOUNT_PRESENCE' THEN
    IF NEW."priorPresenceObservationId" IS NOT NULL THEN
      SELECT apo.* INTO prior_presence
      FROM "AccountPresenceObservation" apo
      WHERE apo."tenantId" = NEW."tenantId"
        AND apo."consumerId" = NEW."consumerId"
        AND apo."reportVersionId" = NEW."priorReportVersionId"
        AND apo."extractionRunId" = NEW."priorExtractionRunId"
        AND apo."bureau" = NEW."bureau"
        AND apo."accountId" = NEW."accountId"
        AND apo."id" = NEW."priorPresenceObservationId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact prior account-presence observation'; END IF;
      calculated_prior := p0_map_section_completeness(prior_presence."accountIndexStatus");
    END IF;

    IF NEW."currentPresenceObservationId" IS NOT NULL THEN
      SELECT apo.* INTO current_presence
      FROM "AccountPresenceObservation" apo
      WHERE apo."tenantId" = NEW."tenantId"
        AND apo."consumerId" = NEW."consumerId"
        AND apo."reportVersionId" = NEW."currentReportVersionId"
        AND apo."extractionRunId" = NEW."currentExtractionRunId"
        AND apo."bureau" = NEW."bureau"
        AND apo."accountId" = NEW."accountId"
        AND apo."id" = NEW."currentPresenceObservationId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact current account-presence observation'; END IF;
      calculated_current := p0_map_section_completeness(current_presence."accountIndexStatus");
    END IF;

    -- Exhaustive account-presence truth table. The caller cannot relabel a
    -- known pair, and incomplete/UNKNOWN evidence can never claim progress.
    IF NEW."priorPresenceObservationId" IS NOT NULL
      AND NEW."currentPresenceObservationId" IS NOT NULL
      AND calculated_prior = 'COMPLETE'
      AND calculated_current = 'COMPLETE'
      AND prior_presence."presence" IN ('PRESENT', 'ABSENT_CONFIRMED')
      AND current_presence."presence" IN ('PRESENT', 'ABSENT_CONFIRMED')
    THEN
      IF NEW."comparability" <> 'COMPARABLE' THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'complete known account-presence pairs must be persisted as COMPARABLE';
      ELSIF prior_presence."presence" = 'PRESENT' AND current_presence."presence" = 'PRESENT' THEN
        IF NEW."changeKind" <> 'UNCHANGED'
          OR NEW."differenceState" <> 'UNCHANGED'
          OR NEW."deletionState" <> 'PRESENT_ON_CURRENT_REPORT'
        THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account presence PRESENT to PRESENT must be unchanged and present on the current report';
        END IF;
      ELSIF prior_presence."presence" = 'PRESENT' AND current_presence."presence" = 'ABSENT_CONFIRMED' THEN
        IF NEW."changeKind" <> 'NO_LONGER_REPORTED'
          OR NEW."differenceState" <> 'CHANGED'
          OR NEW."deletionState" <> 'ABSENT_CONFIRMED_ON_CURRENT_REPORT'
          OR current_presence."accountIndexCompletenessId" IS NULL
        THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account presence PRESENT to ABSENT_CONFIRMED must be exact current-report absence';
        END IF;
      ELSIF prior_presence."presence" = 'ABSENT_CONFIRMED' AND current_presence."presence" = 'PRESENT' THEN
        IF NEW."changeKind" <> 'NEW_ITEM'
          OR NEW."differenceState" <> 'CHANGED'
          OR NEW."deletionState" <> 'PRESENT_ON_CURRENT_REPORT'
          OR prior_presence."accountIndexCompletenessId" IS NULL
        THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account presence ABSENT_CONFIRMED to PRESENT must be a new current-report item';
        END IF;
      ELSE
        IF NEW."changeKind" <> 'UNCHANGED'
          OR NEW."differenceState" <> 'UNCHANGED'
          OR NEW."deletionState" <> 'NOT_APPLICABLE'
          OR prior_presence."accountIndexCompletenessId" IS NULL
          OR current_presence."accountIndexCompletenessId" IS NULL
        THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account presence ABSENT_CONFIRMED to ABSENT_CONFIRMED must be an unchanged non-deletion fact';
        END IF;
      END IF;
    ELSE
      IF NEW."comparability" <> 'NOT_COMPARABLE'
        OR NEW."differenceState" <> 'NOT_COMPARABLE'
        OR NEW."changeKind" <> 'UNABLE_TO_DETERMINE'
        OR NEW."deletionState" <> 'UNKNOWN_INCOMPLETE'
      THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'incomplete or UNKNOWN account presence must remain unable-to-determine and non-comparable';
      END IF;
    END IF;

  ELSIF NEW."scopeType" = 'FIELD_VALUE' THEN
    IF NEW."priorFieldObservationId" IS NOT NULL THEN
      SELECT fo.* INTO prior_field
      FROM "FieldObservation" fo
      WHERE fo."tenantId" = NEW."tenantId"
        AND fo."consumerId" = NEW."consumerId"
        AND fo."reportVersionId" = NEW."priorReportVersionId"
        AND fo."extractionRunId" = NEW."priorExtractionRunId"
        AND fo."bureau" = NEW."bureau"
        AND fo."accountId" = NEW."accountId"
        AND fo."fieldKey" = NEW."fieldKey"
        AND fo."id" = NEW."priorFieldObservationId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact prior field observation'; END IF;
      calculated_prior := p0_map_section_completeness(prior_field."sectionStatus");
    END IF;

    IF NEW."currentFieldObservationId" IS NOT NULL THEN
      SELECT fo.* INTO current_field
      FROM "FieldObservation" fo
      WHERE fo."tenantId" = NEW."tenantId"
        AND fo."consumerId" = NEW."consumerId"
        AND fo."reportVersionId" = NEW."currentReportVersionId"
        AND fo."extractionRunId" = NEW."currentExtractionRunId"
        AND fo."bureau" = NEW."bureau"
        AND fo."accountId" = NEW."accountId"
        AND fo."fieldKey" = NEW."fieldKey"
        AND fo."id" = NEW."currentFieldObservationId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact current field observation'; END IF;
      calculated_current := p0_map_section_completeness(current_field."sectionStatus");
    END IF;

    expected_field_change := CASE
      WHEN NEW."fieldKey" IN ('summaryStatus', 'detailedStatus') THEN 'STATUS_CHANGED'::"ReportDifferenceChangeKind"
      WHEN NEW."fieldKey" = 'balanceCents' THEN 'BALANCE_CHANGED'::"ReportDifferenceChangeKind"
      WHEN NEW."fieldKey" = 'paymentHistory' THEN 'PAYMENT_HISTORY_CHANGED'::"ReportDifferenceChangeKind"
      WHEN NEW."fieldKey" IN ('remarks', 'transferOrSale') THEN 'REMARK_CHANGED'::"ReportDifferenceChangeKind"
      WHEN NEW."fieldKey" = 'consumerDisputeRemarks' THEN 'DISPUTE_NOTATION_CHANGED'::"ReportDifferenceChangeKind"
      ELSE 'OTHER_FIELD_CHANGED'::"ReportDifferenceChangeKind"
    END;

    -- Field disappearance is a changed field fact, not whole-account deletion.
    -- Complete known pairs are exhaustively labeled; the encrypted value path may
    -- choose only UNCHANGED or the one field-specific changed kind for P→P.
    IF NEW."priorFieldObservationId" IS NOT NULL
      AND NEW."currentFieldObservationId" IS NOT NULL
      AND calculated_prior = 'COMPLETE'
      AND calculated_current = 'COMPLETE'
      AND prior_field."presence" IN ('PRESENT', 'ABSENT_CONFIRMED')
      AND current_field."presence" IN ('PRESENT', 'ABSENT_CONFIRMED')
      AND prior_field."normalizationRuleKey" IS NOT DISTINCT FROM current_field."normalizationRuleKey"
      AND prior_field."normalizationRuleVersion" IS NOT DISTINCT FROM current_field."normalizationRuleVersion"
    THEN
      IF NEW."comparability" <> 'COMPARABLE' OR NEW."deletionState" <> 'NOT_APPLICABLE' THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'complete normalized field pairs must be comparable non-deletion facts';
      ELSIF prior_field."presence" = 'ABSENT_CONFIRMED' AND current_field."presence" = 'ABSENT_CONFIRMED' THEN
        IF NEW."changeKind" <> 'UNCHANGED' OR NEW."differenceState" <> 'UNCHANGED' THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'field absence on both reports must be persisted as unchanged';
        END IF;
      ELSIF prior_field."presence" IS DISTINCT FROM current_field."presence" THEN
        IF NEW."changeKind" <> expected_field_change OR NEW."differenceState" <> 'CHANGED' THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'field presence transitions must use the exact field-specific changed kind, never account-deletion vocabulary';
        END IF;
      ELSIF NEW."changeKind" NOT IN ('UNCHANGED', expected_field_change) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'present field pairs may use only unchanged or the exact field-specific changed kind';
      END IF;
    ELSE
      IF NEW."comparability" <> 'NOT_COMPARABLE'
        OR NEW."differenceState" <> 'NOT_COMPARABLE'
        OR NEW."changeKind" <> 'UNABLE_TO_DETERMINE'
        OR NEW."deletionState" <> 'NOT_APPLICABLE'
      THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'incomplete, UNKNOWN, or normalization-incompatible fields must remain unable-to-determine and non-comparable';
      END IF;
    END IF;

  ELSIF NEW."scopeType" = 'CREDIT_SCORE' THEN
    IF NEW."priorScoreObservationId" IS NOT NULL THEN
      SELECT cso.* INTO prior_score
      FROM "CreditScoreObservation" cso
      WHERE cso."tenantId" = NEW."tenantId"
        AND cso."consumerId" = NEW."consumerId"
        AND cso."reportVersionId" = NEW."priorReportVersionId"
        AND cso."extractionRunId" = NEW."priorExtractionRunId"
        AND cso."bureau" = NEW."bureau"
        AND cso."sourceMethodKey" = NEW."priorScoreSourceMethodKey"
        AND cso."sourceMethodVersion" = NEW."priorScoreSourceMethodVersion"
        AND cso."occurrence" = NEW."scoreOccurrence"
        AND cso."id" = NEW."priorScoreObservationId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact prior score observation'; END IF;
      calculated_prior := p0_map_score_completeness(prior_score."evidenceCompleteness");
    END IF;

    IF NEW."currentScoreObservationId" IS NOT NULL THEN
      SELECT cso.* INTO current_score
      FROM "CreditScoreObservation" cso
      WHERE cso."tenantId" = NEW."tenantId"
        AND cso."consumerId" = NEW."consumerId"
        AND cso."reportVersionId" = NEW."currentReportVersionId"
        AND cso."extractionRunId" = NEW."currentExtractionRunId"
        AND cso."bureau" = NEW."bureau"
        AND cso."sourceMethodKey" = NEW."currentScoreSourceMethodKey"
        AND cso."sourceMethodVersion" = NEW."currentScoreSourceMethodVersion"
        AND cso."occurrence" = NEW."scoreOccurrence"
        AND cso."id" = NEW."currentScoreObservationId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact current score observation'; END IF;
      calculated_current := p0_map_score_completeness(current_score."evidenceCompleteness");
    END IF;

    IF NEW."priorScoreObservationId" IS NOT NULL AND NEW."currentScoreObservationId" IS NOT NULL THEN
      SELECT rv.* INTO prior_score_report
      FROM "ReportVersion" rv
      WHERE rv."tenantId" = NEW."tenantId"
        AND rv."consumerId" = NEW."consumerId"
        AND rv."id" = NEW."priorReportVersionId";

      SELECT rv.* INTO current_score_report
      FROM "ReportVersion" rv
      WHERE rv."tenantId" = NEW."tenantId"
        AND rv."consumerId" = NEW."consumerId"
        AND rv."id" = NEW."currentReportVersionId";
    END IF;

    -- A comparable score target is the same bureau/occurrence captured by the
    -- same source method, from explicitly source-dated reports in nondecreasing
    -- order. Model compatibility alone is insufficient.
    IF NEW."priorScoreObservationId" IS NOT NULL
      AND NEW."currentScoreObservationId" IS NOT NULL
      AND parent_comparison."purpose" = 'TEMPORAL_REPORT_CHANGE'
      AND parent_comparison."chronologyBasis" = 'SAME_SERIES_VERSION_ORDER'
      AND calculated_prior = 'COMPLETE'
      AND calculated_current = 'COMPLETE'
      AND prior_score."sourceType" = 'REPORT_DERIVED'
      AND current_score."sourceType" = 'REPORT_DERIVED'
      AND prior_score."evidenceRole" = 'PRIMARY_REPORT_EVIDENCE'
      AND current_score."evidenceRole" = 'PRIMARY_REPORT_EVIDENCE'
      AND prior_score."coverageStatus" = 'COVERED'
      AND current_score."coverageStatus" = 'COVERED'
      AND prior_score."presence" = 'SCORE_REPORTED'
      AND current_score."presence" = 'SCORE_REPORTED'
      AND prior_score."modelMetadataCompleteness" = 'COMPLETE'
      AND current_score."modelMetadataCompleteness" = 'COMPLETE'
      AND prior_score."scoreModelKey" IS NOT DISTINCT FROM current_score."scoreModelKey"
      AND prior_score."scoreModelVersion" IS NOT DISTINCT FROM current_score."scoreModelVersion"
      AND prior_score."scoreScaleMin" IS NOT DISTINCT FROM current_score."scoreScaleMin"
      AND prior_score."scoreScaleMax" IS NOT DISTINCT FROM current_score."scoreScaleMax"
      AND prior_score."sourceMethodKey" IS NOT DISTINCT FROM current_score."sourceMethodKey"
      AND prior_score."sourceMethodVersion" IS NOT DISTINCT FROM current_score."sourceMethodVersion"
      AND prior_score."sourceMethodKey" IS NOT DISTINCT FROM NEW."priorScoreSourceMethodKey"
      AND prior_score."sourceMethodVersion" IS NOT DISTINCT FROM NEW."priorScoreSourceMethodVersion"
      AND current_score."sourceMethodKey" IS NOT DISTINCT FROM NEW."currentScoreSourceMethodKey"
      AND current_score."sourceMethodVersion" IS NOT DISTINCT FROM NEW."currentScoreSourceMethodVersion"
      AND prior_score."occurrence" IS NOT DISTINCT FROM NEW."scoreOccurrence"
      AND current_score."occurrence" IS NOT DISTINCT FROM NEW."scoreOccurrence"
      AND prior_score_report."reportDateProvenance" = 'SOURCE_REPORTED'
      AND current_score_report."reportDateProvenance" = 'SOURCE_REPORTED'
      AND prior_score_report."reportDate" IS NOT NULL
      AND current_score_report."reportDate" IS NOT NULL
      AND prior_score_report."reportDate" <= current_score_report."reportDate"
    THEN
      IF NEW."comparability" <> 'COMPARABLE'
        OR NEW."differenceState" NOT IN ('CHANGED', 'UNCHANGED')
        OR NEW."changeKind" NOT IN ('SCORE_CHANGED', 'UNCHANGED')
      THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'fully compatible source-dated score pairs must be persisted as comparable score facts';
      END IF;
    ELSE
      IF NEW."comparability" <> 'NOT_COMPARABLE'
        OR NEW."differenceState" <> 'NOT_COMPARABLE'
        OR NEW."changeKind" <> 'UNABLE_TO_DETERMINE'
        OR NEW."deletionState" <> 'NOT_APPLICABLE'
      THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'score method, occurrence, model, coverage, or source-date mismatch must remain unable-to-determine and non-comparable';
      END IF;
    END IF;

  ELSIF NEW."scopeType" = 'BUREAU_COVERAGE' THEN
    IF NEW."priorCoverageObservationId" IS NOT NULL THEN
      SELECT ebc.* INTO prior_coverage
      FROM "ExtractionBureauCoverage" ebc
      WHERE ebc."tenantId" = NEW."tenantId"
        AND ebc."consumerId" = NEW."consumerId"
        AND ebc."reportVersionId" = NEW."priorReportVersionId"
        AND ebc."extractionRunId" = NEW."priorExtractionRunId"
        AND ebc."bureau" = NEW."bureau"
        AND ebc."id" = NEW."priorCoverageObservationId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact prior bureau coverage observation'; END IF;
      calculated_prior := 'COMPLETE';
    END IF;

    IF NEW."currentCoverageObservationId" IS NOT NULL THEN
      SELECT ebc.* INTO current_coverage
      FROM "ExtractionBureauCoverage" ebc
      WHERE ebc."tenantId" = NEW."tenantId"
        AND ebc."consumerId" = NEW."consumerId"
        AND ebc."reportVersionId" = NEW."currentReportVersionId"
        AND ebc."extractionRunId" = NEW."currentExtractionRunId"
        AND ebc."bureau" = NEW."bureau"
        AND ebc."id" = NEW."currentCoverageObservationId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact current bureau coverage observation'; END IF;
      calculated_current := 'COMPLETE';
    END IF;

    IF NEW."changeKind" = 'BUREAU_COVERAGE_CHANGED'
      AND prior_coverage."coverageStatus" IS NOT DISTINCT FROM current_coverage."coverageStatus"
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'coverage-change kind requires distinct exact coverage states';
    ELSIF NEW."changeKind" = 'UNCHANGED'
      AND prior_coverage."coverageStatus" IS DISTINCT FROM current_coverage."coverageStatus"
    THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unchanged coverage requires equal exact coverage states';
    END IF;

  ELSIF NEW."scopeType" = 'IDENTITY_FACT' THEN
    IF NEW."priorIdentityFactId" IS NOT NULL THEN
      SELECT i.*, ib."status" AS baseline_status INTO prior_identity
      FROM "IdentityFact" i
      JOIN "IdentityBaseline" ib
        ON ib."tenantId" = i."tenantId"
       AND ib."consumerId" = i."consumerId"
       AND ib."reportVersionId" = i."reportVersionId"
       AND ib."id" = i."identityBaselineId"
      WHERE i."tenantId" = NEW."tenantId"
        AND i."consumerId" = NEW."consumerId"
        AND i."reportVersionId" = NEW."priorReportVersionId"
        AND i."identityBaselineId" = NEW."priorIdentityBaselineId"
        AND i."factSeriesKey" = NEW."identityFactSeriesKey"
        AND i."id" = NEW."priorIdentityFactId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact prior identity fact'; END IF;
      calculated_prior := CASE WHEN prior_identity.baseline_status = 'CONFIRMED' THEN 'COMPLETE'::"ComparisonEvidenceCompleteness" ELSE 'INCOMPLETE'::"ComparisonEvidenceCompleteness" END;
    END IF;

    IF NEW."currentIdentityFactId" IS NOT NULL THEN
      SELECT i.*, ib."status" AS baseline_status INTO current_identity
      FROM "IdentityFact" i
      JOIN "IdentityBaseline" ib
        ON ib."tenantId" = i."tenantId"
       AND ib."consumerId" = i."consumerId"
       AND ib."reportVersionId" = i."reportVersionId"
       AND ib."id" = i."identityBaselineId"
      WHERE i."tenantId" = NEW."tenantId"
        AND i."consumerId" = NEW."consumerId"
        AND i."reportVersionId" = NEW."currentReportVersionId"
        AND i."identityBaselineId" = NEW."currentIdentityBaselineId"
        AND i."factSeriesKey" = NEW."identityFactSeriesKey"
        AND i."id" = NEW."currentIdentityFactId";
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact current identity fact'; END IF;
      calculated_current := CASE WHEN current_identity.baseline_status = 'CONFIRMED' THEN 'COMPLETE'::"ComparisonEvidenceCompleteness" ELSE 'INCOMPLETE'::"ComparisonEvidenceCompleteness" END;
    END IF;

    IF NEW."comparability" = 'COMPARABLE' AND (
      prior_identity."factType" IS DISTINCT FROM current_identity."factType"
      OR prior_identity."bureau" IS DISTINCT FROM current_identity."bureau"
      OR prior_identity."bureau" IS DISTINCT FROM NEW."bureau"
      OR prior_identity."normalizationRuleKey" IS DISTINCT FROM current_identity."normalizationRuleKey"
      OR prior_identity."normalizationRuleVersion" IS DISTINCT FROM current_identity."normalizationRuleVersion"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'comparable identity facts require the same exact normalized identity subject';
    END IF;
  END IF;

  IF NEW."priorCompleteness" IS DISTINCT FROM calculated_prior
    OR NEW."currentCompleteness" IS DISTINCT FROM calculated_current
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'difference completeness must equal the exact pinned source completeness';
  END IF;

  IF NEW."comparability" = 'COMPARABLE'
    AND (calculated_prior <> 'COMPLETE' OR calculated_current <> 'COMPLETE')
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'COMPARABLE differences require two COMPLETE exact source observations';
  ELSIF NEW."comparability" = 'PARTIAL'
    AND calculated_prior = 'COMPLETE' AND calculated_current = 'COMPLETE'
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PARTIAL comparability requires at least one non-complete exact source';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ReportDifference" sibling
    WHERE sibling."tenantId" = NEW."tenantId"
      AND sibling."consumerId" = NEW."consumerId"
      AND sibling."comparisonId" = NEW."comparisonId"
      AND sibling."scopeType" = NEW."scopeType"
      AND sibling."bureau" IS NOT DISTINCT FROM NEW."bureau"
      AND sibling."accountId" IS NOT DISTINCT FROM NEW."accountId"
      AND sibling."fieldKey" IS NOT DISTINCT FROM NEW."fieldKey"
      AND sibling."priorScoreSourceMethodKey" IS NOT DISTINCT FROM NEW."priorScoreSourceMethodKey"
      AND sibling."priorScoreSourceMethodVersion" IS NOT DISTINCT FROM NEW."priorScoreSourceMethodVersion"
      AND sibling."currentScoreSourceMethodKey" IS NOT DISTINCT FROM NEW."currentScoreSourceMethodKey"
      AND sibling."currentScoreSourceMethodVersion" IS NOT DISTINCT FROM NEW."currentScoreSourceMethodVersion"
      AND sibling."scoreOccurrence" IS NOT DISTINCT FROM NEW."scoreOccurrence"
      AND sibling."identityFactSeriesKey" IS NOT DISTINCT FROM NEW."identityFactSeriesKey"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'one immutable comparison may contain only one difference for an exact logical target';
  END IF;

  IF NEW."version" = 1 AND NEW."supersedesDifferenceId" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'difference version 1 cannot supersede another difference';
  ELSIF NEW."version" > 1 AND NEW."supersedesDifferenceId" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'difference versions after 1 require the exact prior series version';
  END IF;

  IF NEW."supersedesDifferenceId" IS NOT NULL THEN
    IF NEW."supersedesDifferenceId" = NEW."id" THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'a report difference cannot supersede itself';
    END IF;

    SELECT rd.* INTO prior_difference
    FROM "ReportDifference" rd
    WHERE rd."tenantId" = NEW."tenantId"
      AND rd."consumerId" = NEW."consumerId"
      AND rd."differenceSeriesKey" = NEW."differenceSeriesKey"
      AND rd."id" = NEW."supersedesDifferenceId";

    IF NOT FOUND
      OR prior_difference."version" <> NEW."version" - 1
      OR prior_difference."priorReportVersionId" <> NEW."priorReportVersionId"
      OR prior_difference."priorExtractionRunId" <> NEW."priorExtractionRunId"
      OR prior_difference."currentReportVersionId" <> NEW."currentReportVersionId"
      OR prior_difference."currentExtractionRunId" <> NEW."currentExtractionRunId"
      OR prior_difference."scopeType" <> NEW."scopeType"
      OR prior_difference."bureau" IS DISTINCT FROM NEW."bureau"
      OR prior_difference."accountId" IS DISTINCT FROM NEW."accountId"
      OR prior_difference."fieldKey" IS DISTINCT FROM NEW."fieldKey"
      OR prior_difference."priorScoreSourceMethodKey" IS DISTINCT FROM NEW."priorScoreSourceMethodKey"
      OR prior_difference."priorScoreSourceMethodVersion" IS DISTINCT FROM NEW."priorScoreSourceMethodVersion"
      OR prior_difference."currentScoreSourceMethodKey" IS DISTINCT FROM NEW."currentScoreSourceMethodKey"
      OR prior_difference."currentScoreSourceMethodVersion" IS DISTINCT FROM NEW."currentScoreSourceMethodVersion"
      OR prior_difference."scoreOccurrence" IS DISTINCT FROM NEW."scoreOccurrence"
      OR prior_difference."identityFactSeriesKey" IS DISTINCT FROM NEW."identityFactSeriesKey"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'difference supersession must be the exact prior version of the same report/run target';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ReportDifference_validate_insert_trg"
BEFORE INSERT ON "ReportDifference"
FOR EACH ROW EXECUTE FUNCTION p0_validate_report_difference_insert();

-- A completed immutable comparison is an aggregate seal. Parent and child
-- paths lock the same parent row, so count validation remains race-safe under
-- MVCC and no late difference can grow an already committed source set.
CREATE FUNCTION p0_validate_report_comparison_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_comparison RECORD;
  actual_count INTEGER;
  parent_id TEXT;
BEGIN
  parent_id := CASE
    WHEN TG_TABLE_NAME = 'ReportComparison' THEN NEW."id"
    ELSE to_jsonb(NEW) ->> 'comparisonId'
  END;

  SELECT rc.*
  INTO parent_comparison
  FROM "ReportComparison" rc
  WHERE rc."tenantId" = NEW."tenantId"
    AND rc."consumerId" = NEW."consumerId"
    AND rc."id" = parent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'comparison seal references an unknown parent';
  END IF;

  SELECT COUNT(*) INTO actual_count
  FROM "ReportDifference" rd
  WHERE rd."tenantId" = parent_comparison."tenantId"
    AND rd."consumerId" = parent_comparison."consumerId"
    AND rd."comparisonId" = parent_comparison."id";

  IF parent_comparison."state" = 'PENDING_EVIDENCE' THEN
    IF actual_count <> 0 OR parent_comparison."differenceCount" <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'pending comparison must remain childless';
    END IF;
    RETURN NEW;
  END IF;

  IF actual_count <> parent_comparison."differenceCount" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'sealed comparison differenceCount does not match exact immutable children';
  END IF;

  IF parent_comparison."state" = 'COMPARABLE' AND EXISTS (
    SELECT 1 FROM "ReportDifference" rd
    WHERE rd."tenantId" = parent_comparison."tenantId"
      AND rd."consumerId" = parent_comparison."consumerId"
      AND rd."comparisonId" = parent_comparison."id"
      AND (
        rd."comparability" <> 'COMPARABLE'
        OR rd."priorCompleteness" <> 'COMPLETE'
        OR rd."currentCompleteness" <> 'COMPLETE'
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'COMPARABLE comparison may contain only complete comparable differences';
  ELSIF parent_comparison."state" = 'PARTIALLY_COMPARABLE' AND NOT EXISTS (
    SELECT 1 FROM "ReportDifference" rd
    WHERE rd."tenantId" = parent_comparison."tenantId"
      AND rd."consumerId" = parent_comparison."consumerId"
      AND rd."comparisonId" = parent_comparison."id"
      AND (rd."comparability" <> 'COMPARABLE' OR rd."priorCompleteness" <> 'COMPLETE' OR rd."currentCompleteness" <> 'COMPLETE')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PARTIALLY_COMPARABLE comparison requires at least one incomplete or limited child';
  ELSIF parent_comparison."state" = 'NOT_COMPARABLE' AND EXISTS (
    SELECT 1 FROM "ReportDifference" rd
    WHERE rd."tenantId" = parent_comparison."tenantId"
      AND rd."consumerId" = parent_comparison."consumerId"
      AND rd."comparisonId" = parent_comparison."id"
      AND rd."comparability" = 'COMPARABLE'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'NOT_COMPARABLE comparison cannot contain a comparable child';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "ReportComparison_seal_trg"
AFTER INSERT ON "ReportComparison"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_report_comparison_seal();

CREATE CONSTRAINT TRIGGER "ReportDifference_parent_seal_trg"
AFTER INSERT ON "ReportDifference"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_report_comparison_seal();

-- Identity facts are report inputs even though they are not extraction-run rows.
-- Locking the exact ReportVersion on both this path and comparison creation keeps
-- a completed comparison from silently becoming stale after it commits.
CREATE FUNCTION p0_reject_post_comparison_identity_input()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1
  FROM "ReportVersion" rv
  WHERE rv."tenantId" = NEW."tenantId"
    AND rv."consumerId" = NEW."consumerId"
    AND rv."id" = NEW."reportVersionId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'identity input requires an exact report version';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ReportComparison" rc
    WHERE rc."tenantId" = NEW."tenantId"
      AND rc."consumerId" = NEW."consumerId"
      AND rc."state" <> 'PENDING_EVIDENCE'
      AND NEW."reportVersionId" IN (rc."priorReportVersionId", rc."currentReportVersionId")
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'comparison identity input is sealed; append a successor report/comparison';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "IdentityBaseline_comparison_input_seal_trg"
BEFORE INSERT ON "IdentityBaseline"
FOR EACH ROW EXECUTE FUNCTION p0_reject_post_comparison_identity_input();

CREATE TRIGGER "IdentityFact_comparison_input_seal_trg"
BEFORE INSERT ON "IdentityFact"
FOR EACH ROW EXECUTE FUNCTION p0_reject_post_comparison_identity_input();

-- Outcome rows remain exact post-case evidence decisions. They must point to an
-- item actually included in an APPROVED correspondence version, never merely a
-- draft claim. Score/coverage/identity changes remain comparison facts and are
-- not promoted into dispute outcomes in Phase 1.
CREATE FUNCTION p0_validate_dispute_outcome_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_comparison RECORD;
  source_difference RECORD;
  target_item RECORD;
  prior_outcome RECORD;
  approved_membership_count INTEGER;
BEGIN
  SELECT rc.* INTO parent_comparison
  FROM "ReportComparison" rc
  WHERE rc."tenantId" = NEW."tenantId"
    AND rc."consumerId" = NEW."consumerId"
    AND rc."priorReportVersionId" = NEW."priorReportVersionId"
    AND rc."priorExtractionRunId" = NEW."priorExtractionRunId"
    AND rc."currentReportVersionId" = NEW."currentReportVersionId"
    AND rc."currentExtractionRunId" = NEW."currentExtractionRunId"
    AND rc."id" = NEW."comparisonId";

  IF NOT FOUND OR parent_comparison."purpose" <> 'TEMPORAL_REPORT_CHANGE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'dispute outcomes require an exact temporal report comparison, never extraction reconciliation';
  END IF;

  SELECT rd.* INTO source_difference
  FROM "ReportDifference" rd
  WHERE rd."tenantId" = NEW."tenantId"
    AND rd."consumerId" = NEW."consumerId"
    AND rd."priorReportVersionId" = NEW."priorReportVersionId"
    AND rd."currentReportVersionId" = NEW."currentReportVersionId"
    AND rd."comparisonId" = NEW."comparisonId"
    AND rd."id" = NEW."differenceId";

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'outcome requires an exact immutable report difference';
  ELSIF source_difference."scopeType" NOT IN ('ACCOUNT_PRESENCE', 'FIELD_VALUE') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'score, bureau-coverage, and identity differences remain non-causal comparison facts, not dispute outcomes';
  ELSIF source_difference."bureau" IS DISTINCT FROM NEW."bureau"
    OR source_difference."accountId" IS DISTINCT FROM NEW."accountId"
    OR source_difference."priorCompleteness" IS DISTINCT FROM NEW."priorCompleteness"
    OR source_difference."currentCompleteness" IS DISTINCT FROM NEW."currentCompleteness"
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'outcome scope and completeness must equal the exact pinned difference';
  END IF;

  SELECT ci.* INTO target_item
  FROM "CorrespondenceItem" ci
  WHERE ci."tenantId" = NEW."tenantId"
    AND ci."consumerId" = NEW."consumerId"
    AND ci."reportVersionId" = NEW."priorReportVersionId"
    AND ci."caseId" = NEW."caseId"
    AND ci."correspondenceId" = NEW."targetCorrespondenceId"
    AND ci."accountId" = NEW."accountId"
    AND ci."bureau" = NEW."bureau"
    AND ci."fieldKey" = NEW."targetFieldKey"
    AND ci."consumerAssertionId" = NEW."targetConsumerAssertionId"
    AND ci."id" = NEW."targetCorrespondenceItemId";

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'outcome target must be an exact correspondence item in the prior-report case';
  ELSIF source_difference."scopeType" = 'FIELD_VALUE'
    AND target_item."observationId" IS DISTINCT FROM source_difference."priorFieldObservationId"
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'field outcome target must be the exact prior observation compared by the difference';
  END IF;

  SELECT COUNT(*) INTO approved_membership_count
  FROM "CorrespondenceVersionItem" cvi
  JOIN "CorrespondenceVersion" cv
    ON cv."tenantId" = cvi."tenantId"
   AND cv."consumerId" = cvi."consumerId"
   AND cv."reportVersionId" = cvi."reportVersionId"
   AND cv."caseId" = cvi."caseId"
   AND cv."correspondenceId" = cvi."correspondenceId"
   AND cv."id" = cvi."correspondenceVersionId"
  WHERE cvi."tenantId" = NEW."tenantId"
    AND cvi."consumerId" = NEW."consumerId"
    AND cvi."reportVersionId" = NEW."priorReportVersionId"
    AND cvi."caseId" = NEW."caseId"
    AND cvi."correspondenceId" = NEW."targetCorrespondenceId"
    AND cvi."correspondenceVersionId" = NEW."targetCorrespondenceVersionId"
    AND cvi."correspondenceItemId" = NEW."targetCorrespondenceItemId"
    AND cvi."id" = NEW."targetVersionMembershipId"
    AND cv."status" = 'APPROVED';

  IF approved_membership_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'outcome target must be included in one exact APPROVED correspondence version';
  END IF;

  IF NEW."outcomeState" = 'DELETED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'DELETED requires future exact recipient-response provenance; report absence must use NO_LONGER_REPORTED';
  ELSIF NEW."outcomeState" = 'UNCHANGED'
    AND (source_difference."differenceState" <> 'UNCHANGED' OR source_difference."changeKind" <> 'UNCHANGED')
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'UNCHANGED outcome requires an exact unchanged comparable difference';
  ELSIF NEW."outcomeState" = 'NO_LONGER_REPORTED'
    AND (
      source_difference."scopeType" <> 'ACCOUNT_PRESENCE'
      OR source_difference."changeKind" <> 'NO_LONGER_REPORTED'
      OR source_difference."deletionState" <> 'ABSENT_CONFIRMED_ON_CURRENT_REPORT'
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'NO_LONGER_REPORTED requires exact confirmed current-report absence';
  ELSIF NEW."outcomeState" IN ('CORRECTED', 'CHANGED_DIFFERENTLY', 'NEW_CONFLICT')
    AND (source_difference."scopeType" <> 'FIELD_VALUE' OR source_difference."differenceState" <> 'CHANGED')
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'field-change outcome requires an exact changed field difference';
  ELSIF NEW."outcomeState" IN ('CORRECTED', 'NEW_CONFLICT')
    AND NEW."decisionSource" IS DISTINCT FROM 'HUMAN_CONFIRMED'
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORRECTED and NEW_CONFLICT require explicit human confirmation';
  ELSIF NEW."outcomeState" = 'UNABLE_TO_DETERMINE'
    AND source_difference."differenceState" NOT IN ('NOT_COMPARABLE', 'REVIEW_REQUIRED')
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'UNABLE_TO_DETERMINE requires incomplete or non-comparable evidence';
  END IF;

  -- Decision provenance is state-exact. Pure report comparisons may derive only
  -- bounded observable states; correction/conflict judgments require a named
  -- human confirmation. The table CHECK separately enforces actor/time shape.
  IF NEW."outcomeState" = 'PENDING_EVIDENCE' THEN
    IF NEW."decisionSource" IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'pending outcomes cannot claim a decision source';
    END IF;
  ELSIF NEW."outcomeState" IN ('CORRECTED', 'NEW_CONFLICT') THEN
    IF NEW."decisionSource" IS DISTINCT FROM 'HUMAN_CONFIRMED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'corrected and new-conflict outcomes require human-confirmed decision provenance';
    END IF;
  ELSIF NEW."outcomeState" IN ('UNCHANGED', 'CHANGED_DIFFERENTLY', 'NO_LONGER_REPORTED', 'UNABLE_TO_DETERMINE') THEN
    IF NEW."decisionSource" IS DISTINCT FROM 'SYSTEM_DERIVED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'observable comparison outcomes require system-derived decision provenance';
    END IF;
  END IF;

  IF NEW."version" = 1 AND NEW."supersedesOutcomeId" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'outcome version 1 cannot supersede another outcome';
  ELSIF NEW."version" > 1 AND NEW."supersedesOutcomeId" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'outcome versions after 1 require the exact prior series version';
  END IF;

  IF NEW."supersedesOutcomeId" IS NOT NULL THEN
    IF NEW."supersedesOutcomeId" = NEW."id" THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'a dispute outcome cannot supersede itself';
    END IF;

    SELECT o.* INTO prior_outcome
    FROM "DisputeOutcome" o
    WHERE o."tenantId" = NEW."tenantId"
      AND o."consumerId" = NEW."consumerId"
      AND o."outcomeSeriesKey" = NEW."outcomeSeriesKey"
      AND o."id" = NEW."supersedesOutcomeId";

    IF NOT FOUND
      OR prior_outcome."version" <> NEW."version" - 1
      OR prior_outcome."caseId" <> NEW."caseId"
      OR prior_outcome."targetCorrespondenceId" <> NEW."targetCorrespondenceId"
      OR prior_outcome."targetCorrespondenceItemId" <> NEW."targetCorrespondenceItemId"
      OR prior_outcome."bureau" <> NEW."bureau"
      OR prior_outcome."accountId" <> NEW."accountId"
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'outcome supersession must be the exact prior version for the same case and disputed target';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "DisputeOutcome_validate_insert_trg"
BEFORE INSERT ON "DisputeOutcome"
FOR EACH ROW EXECUTE FUNCTION p0_validate_dispute_outcome_insert();

-- A correspondence owns one durable recipient identity. Status and other
-- aggregate-header state may evolve, but owner/scope/recipient retargeting must
-- append a new correspondence so immutable items can never change destination.
CREATE FUNCTION p0_validate_correspondence_recipient_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."id" IS DISTINCT FROM NEW."id"
    OR OLD."tenantId" IS DISTINCT FROM NEW."tenantId"
    OR OLD."consumerId" IS DISTINCT FROM NEW."consumerId"
    OR OLD."reportVersionId" IS DISTINCT FROM NEW."reportVersionId"
    OR OLD."caseId" IS DISTINCT FROM NEW."caseId"
    OR OLD."recipientId" IS DISTINCT FROM NEW."recipientId"
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'correspondence owner, report, case and recipient identity are immutable; append a new correspondence';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Correspondence_recipient_identity_trg"
BEFORE UPDATE ON "Correspondence"
FOR EACH ROW EXECUTE FUNCTION p0_validate_correspondence_recipient_update();

-- Every immutable item resolves its exact correspondence and recipient while
-- locking both rows. CRA evidence must match the recipient's immutable bureau;
-- non-CRA correspondence retains compatible item-level bureau provenance.
CREATE FUNCTION p0_validate_correspondence_item_recipient_bureau()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  exact_recipient_type "RecipientType";
  exact_recipient_bureau "Bureau";
BEGIN
  SELECT r."recipientType", r."bureau"
  INTO exact_recipient_type, exact_recipient_bureau
  FROM "Correspondence" c
  JOIN "Recipient" r
    ON r."tenantId" = c."tenantId"
   AND r."consumerId" = c."consumerId"
   AND r."id" = c."recipientId"
  WHERE c."tenantId" = NEW."tenantId"
    AND c."consumerId" = NEW."consumerId"
    AND c."reportVersionId" = NEW."reportVersionId"
    AND c."caseId" = NEW."caseId"
    AND c."id" = NEW."correspondenceId"
  FOR UPDATE OF c, r;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'correspondence item requires the exact owned correspondence and recipient';
  END IF;

  IF exact_recipient_type = 'CREDIT_REPORTING_AGENCY'
    AND exact_recipient_bureau IS DISTINCT FROM NEW."bureau"
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'CRA correspondence item bureau must equal the immutable recipient bureau';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CorrespondenceItem_recipient_bureau_trg"
BEFORE INSERT ON "CorrespondenceItem"
FOR EACH ROW EXECUTE FUNCTION p0_validate_correspondence_item_recipient_bureau();

-- Supersession remains inside one correspondence by FK and moves strictly
-- forward in version number, which also makes supersession cycles impossible.
CREATE FUNCTION p0_validate_correspondence_version_supersession()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prior_version INTEGER;
BEGIN
  IF NEW."supersedesVersionId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."supersedesVersionId" = NEW."id" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'a correspondence version cannot supersede itself';
  END IF;

  SELECT cv."version"
  INTO prior_version
  FROM "CorrespondenceVersion" cv
  WHERE cv."tenantId" = NEW."tenantId"
    AND cv."consumerId" = NEW."consumerId"
    AND cv."reportVersionId" = NEW."reportVersionId"
    AND cv."caseId" = NEW."caseId"
    AND cv."correspondenceId" = NEW."correspondenceId"
    AND cv."id" = NEW."supersedesVersionId";

  IF prior_version IS NULL OR prior_version >= NEW."version" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'supersession must reference a lower version of the same correspondence';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CorrespondenceVersion_supersession_order_trg"
BEFORE INSERT ON "CorrespondenceVersion"
FOR EACH ROW EXECUTE FUNCTION p0_validate_correspondence_version_supersession();

-- Approval is fail-closed against the immutable recipient-address and identity
-- baseline versions. Draft rows remain buildable; approved rows cannot cite an
-- unverified/retired address or a draft/superseded identity baseline.
CREATE FUNCTION p0_validate_approved_mailing_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status"::TEXT <> 'APPROVED' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "RecipientAddressVersion" rav
    WHERE rav."tenantId" = NEW."tenantId"
      AND rav."consumerId" = NEW."consumerId"
      AND rav."recipientId" = NEW."recipientId"
      AND rav."id" = NEW."recipientAddressVersionId"
      AND rav."status" = 'VALIDATED'
      AND NOT EXISTS (
        SELECT 1
        FROM "RecipientAddressVersion" newer_rav
        WHERE newer_rav."tenantId" = rav."tenantId"
          AND newer_rav."consumerId" = rav."consumerId"
          AND newer_rav."recipientId" = rav."recipientId"
          AND newer_rav."addressSeriesKey" = rav."addressSeriesKey"
          AND newer_rav."version" > rav."version"
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'APPROVED mailing content requires a VALIDATED recipient address version';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "IdentityBaseline" ib
    WHERE ib."tenantId" = NEW."tenantId"
      AND ib."consumerId" = NEW."consumerId"
      AND ib."reportVersionId" = NEW."reportVersionId"
      AND ib."id" = NEW."identityBaselineId"
      AND ib."status" = 'CONFIRMED'
      AND NOT EXISTS (
        SELECT 1
        FROM "IdentityBaseline" newer_ib
        WHERE newer_ib."tenantId" = ib."tenantId"
          AND newer_ib."consumerId" = ib."consumerId"
          AND newer_ib."baselineSeriesKey" = ib."baselineSeriesKey"
          AND newer_ib."version" > ib."version"
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'APPROVED mailing content requires a CONFIRMED identity baseline';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CorrespondenceVersion_approved_context_trg"
BEFORE INSERT ON "CorrespondenceVersion"
FOR EACH ROW EXECUTE FUNCTION p0_validate_approved_mailing_context();

CREATE TRIGGER "Packet_approved_context_trg"
BEFORE INSERT ON "Packet"
FOR EACH ROW EXECUTE FUNCTION p0_validate_approved_mailing_context();

-- Once a packet is approved, every newly attached correspondence version must
-- itself be approved. Draft packets may be assembled before a new approved packet
-- version is appended.
CREATE FUNCTION p0_validate_packet_correspondence_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Packet" p
    WHERE p."tenantId" = NEW."tenantId"
      AND p."consumerId" = NEW."consumerId"
      AND p."reportVersionId" = NEW."reportVersionId"
      AND p."caseId" = NEW."caseId"
      AND p."id" = NEW."packetId"
      AND p."status" = 'APPROVED'
  ) AND NOT EXISTS (
    SELECT 1
    FROM "CorrespondenceVersion" cv
    WHERE cv."tenantId" = NEW."tenantId"
      AND cv."consumerId" = NEW."consumerId"
      AND cv."reportVersionId" = NEW."reportVersionId"
      AND cv."caseId" = NEW."caseId"
      AND cv."correspondenceId" = NEW."correspondenceId"
      AND cv."id" = NEW."correspondenceVersionId"
      AND cv."status" = 'APPROVED'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'an APPROVED packet may contain only APPROVED correspondence versions';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "PacketCorrespondenceVersion_approved_context_trg"
BEFORE INSERT ON "PacketCorrespondenceVersion"
FOR EACH ROW EXECUTE FUNCTION p0_validate_packet_correspondence_approval();

-- Canonical dispatch artifacts are sealed mailing output. They require approved
-- packet/correspondence lineage plus the same immutable validated address and
-- confirmed baseline pins already enforced by their parents.
CREATE FUNCTION p0_validate_canonical_artifact_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."kind" <> 'CANONICAL_PACKET_PDF' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "Packet" p
    WHERE p."tenantId" = NEW."tenantId"
      AND p."consumerId" = NEW."consumerId"
      AND p."reportVersionId" = NEW."reportVersionId"
      AND p."caseId" = NEW."caseId"
      AND p."recipientId" = NEW."recipientId"
      AND p."recipientAddressVersionId" = NEW."recipientAddressVersionId"
      AND p."identityBaselineId" = NEW."identityBaselineId"
      AND p."policyVersion" = NEW."policyVersion"
      AND p."round" = NEW."round"
      AND p."claimClass" = NEW."claimClass"
      AND p."id" = NEW."packetId"
      AND p."status" = 'APPROVED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'canonical artifacts require an APPROVED exact packet';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "CorrespondenceVersion" cv
    WHERE cv."tenantId" = NEW."tenantId"
      AND cv."consumerId" = NEW."consumerId"
      AND cv."reportVersionId" = NEW."reportVersionId"
      AND cv."caseId" = NEW."caseId"
      AND cv."correspondenceId" = NEW."primaryCorrespondenceId"
      AND cv."recipientId" = NEW."recipientId"
      AND cv."recipientAddressVersionId" = NEW."recipientAddressVersionId"
      AND cv."identityBaselineId" = NEW."identityBaselineId"
      AND cv."policyVersion" = NEW."policyVersion"
      AND cv."round" = NEW."round"
      AND cv."claimClass" = NEW."claimClass"
      AND cv."id" = NEW."primaryCorrespondenceVersionId"
      AND cv."status" = 'APPROVED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'canonical artifacts require an APPROVED exact correspondence version';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "RecipientAddressVersion" rav
    WHERE rav."tenantId" = NEW."tenantId"
      AND rav."consumerId" = NEW."consumerId"
      AND rav."recipientId" = NEW."recipientId"
      AND rav."id" = NEW."recipientAddressVersionId"
      AND rav."status" = 'VALIDATED'
      AND NOT EXISTS (
        SELECT 1 FROM "RecipientAddressVersion" newer_rav
        WHERE newer_rav."tenantId" = rav."tenantId"
          AND newer_rav."consumerId" = rav."consumerId"
          AND newer_rav."recipientId" = rav."recipientId"
          AND newer_rav."addressSeriesKey" = rav."addressSeriesKey"
          AND newer_rav."version" > rav."version"
      )
  ) OR NOT EXISTS (
    SELECT 1 FROM "IdentityBaseline" ib
    WHERE ib."tenantId" = NEW."tenantId"
      AND ib."consumerId" = NEW."consumerId"
      AND ib."reportVersionId" = NEW."reportVersionId"
      AND ib."id" = NEW."identityBaselineId"
      AND ib."status" = 'CONFIRMED'
      AND NOT EXISTS (
        SELECT 1 FROM "IdentityBaseline" newer_ib
        WHERE newer_ib."tenantId" = ib."tenantId"
          AND newer_ib."consumerId" = ib."consumerId"
          AND newer_ib."baselineSeriesKey" = ib."baselineSeriesKey"
          AND newer_ib."version" > ib."version"
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'canonical artifacts require validated mailing identity context';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Artifact_canonical_context_trg"
BEFORE INSERT ON "Artifact"
FOR EACH ROW EXECUTE FUNCTION p0_validate_canonical_artifact_context();

-- Every correspondence included in a canonical artifact must be an approved
-- member of that artifact's exact packet. Non-canonical artifacts may omit the
-- packet pin; when they provide it, the composite FK still proves membership.
CREATE FUNCTION p0_validate_artifact_correspondence_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_kind "ArtifactKind";
  parent_packet_id TEXT;
BEGIN
  SELECT a."kind", a."packetId"
  INTO parent_kind, parent_packet_id
  FROM "Artifact" a
  WHERE a."tenantId" = NEW."tenantId"
    AND a."consumerId" = NEW."consumerId"
    AND a."id" = NEW."artifactId";

  IF parent_kind = 'CANONICAL_PACKET_PDF' THEN
    IF NEW."packetId" IS NULL OR NEW."packetId" <> parent_packet_id THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'canonical artifact correspondence requires the exact parent packet pin';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM "CorrespondenceVersion" cv
      WHERE cv."tenantId" = NEW."tenantId"
        AND cv."consumerId" = NEW."consumerId"
        AND cv."reportVersionId" = NEW."reportVersionId"
        AND cv."caseId" = NEW."caseId"
        AND cv."correspondenceId" = NEW."correspondenceId"
        AND cv."id" = NEW."correspondenceVersionId"
        AND cv."status" = 'APPROVED'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'canonical artifact correspondence requires an APPROVED correspondence version';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM "PacketCorrespondenceVersion" pcv
      WHERE pcv."tenantId" = NEW."tenantId"
        AND pcv."consumerId" = NEW."consumerId"
        AND pcv."reportVersionId" = NEW."reportVersionId"
        AND pcv."caseId" = NEW."caseId"
        AND pcv."packetId" = NEW."packetId"
        AND pcv."correspondenceId" = NEW."correspondenceId"
        AND pcv."correspondenceVersionId" = NEW."correspondenceVersionId"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'canonical artifact correspondence requires exact packet membership';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ArtifactCorrespondenceVersion_canonical_context_trg"
BEFORE INSERT ON "ArtifactCorrespondenceVersion"
FOR EACH ROW EXECUTE FUNCTION p0_validate_artifact_correspondence_context();

-- Approved/canonical aggregate contents are count-sealed. Each deferred checker
-- locks the same immutable parent row before counting children. This both permits
-- parent + children in one transaction and serializes concurrent child inserts so
-- an MVCC race cannot grow a sealed aggregate without appending a new parent.
CREATE FUNCTION p0_validate_correspondence_version_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_tenant TEXT;
  parent_consumer TEXT;
  parent_id TEXT;
  parent_status "CorrespondenceStatus";
  expected_count INTEGER;
  actual_count BIGINT;
BEGIN
  parent_tenant := NEW."tenantId";
  parent_consumer := NEW."consumerId";
  IF TG_TABLE_NAME = 'CorrespondenceVersion' THEN
    parent_id := NEW."id";
  ELSE
    parent_id := NEW."correspondenceVersionId";
  END IF;

  SELECT cv."status", cv."itemCount"
  INTO parent_status, expected_count
  FROM "CorrespondenceVersion" cv
  WHERE cv."tenantId" = parent_tenant
    AND cv."consumerId" = parent_consumer
    AND cv."id" = parent_id
  FOR UPDATE;

  IF parent_status = 'APPROVED' THEN
    SELECT COUNT(*) INTO actual_count
    FROM "CorrespondenceVersionItem" cvi
    WHERE cvi."tenantId" = parent_tenant
      AND cvi."consumerId" = parent_consumer
      AND cvi."correspondenceVersionId" = parent_id;

    IF actual_count <> expected_count THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'APPROVED correspondence version item count is sealed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "CorrespondenceVersion_seal_count_trg"
AFTER INSERT ON "CorrespondenceVersion"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_correspondence_version_seal();

CREATE CONSTRAINT TRIGGER "CorrespondenceVersionItem_parent_seal_trg"
AFTER INSERT ON "CorrespondenceVersionItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_correspondence_version_seal();

CREATE FUNCTION p0_validate_packet_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_tenant TEXT;
  parent_consumer TEXT;
  parent_id TEXT;
  parent_status "PacketStatus";
  expected_versions INTEGER;
  expected_enclosures INTEGER;
  actual_versions BIGINT;
  actual_enclosures BIGINT;
BEGIN
  parent_tenant := NEW."tenantId";
  parent_consumer := NEW."consumerId";
  IF TG_TABLE_NAME = 'Packet' THEN
    parent_id := NEW."id";
  ELSE
    parent_id := NEW."packetId";
  END IF;

  SELECT p."status", p."correspondenceVersionCount", p."enclosureCount"
  INTO parent_status, expected_versions, expected_enclosures
  FROM "Packet" p
  WHERE p."tenantId" = parent_tenant
    AND p."consumerId" = parent_consumer
    AND p."id" = parent_id
  FOR UPDATE;

  IF parent_status = 'APPROVED' THEN
    SELECT COUNT(*) INTO actual_versions
    FROM "PacketCorrespondenceVersion" pcv
    WHERE pcv."tenantId" = parent_tenant
      AND pcv."consumerId" = parent_consumer
      AND pcv."packetId" = parent_id;

    SELECT COUNT(*) INTO actual_enclosures
    FROM "PacketEnclosure" pe
    WHERE pe."tenantId" = parent_tenant
      AND pe."consumerId" = parent_consumer
      AND pe."packetId" = parent_id;

    IF actual_versions <> expected_versions OR actual_enclosures <> expected_enclosures THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'APPROVED packet membership and enclosure counts are sealed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "Packet_seal_count_trg"
AFTER INSERT ON "Packet"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_packet_seal();

CREATE CONSTRAINT TRIGGER "PacketCorrespondenceVersion_parent_seal_trg"
AFTER INSERT ON "PacketCorrespondenceVersion"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_packet_seal();

CREATE CONSTRAINT TRIGGER "PacketEnclosure_parent_seal_trg"
AFTER INSERT ON "PacketEnclosure"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_packet_seal();

CREATE FUNCTION p0_validate_artifact_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_tenant TEXT;
  parent_consumer TEXT;
  parent_id TEXT;
  parent_kind "ArtifactKind";
  expected_count INTEGER;
  actual_count BIGINT;
BEGIN
  parent_tenant := NEW."tenantId";
  parent_consumer := NEW."consumerId";
  IF TG_TABLE_NAME = 'Artifact' THEN
    parent_id := NEW."id";
  ELSE
    parent_id := NEW."artifactId";
  END IF;

  SELECT a."kind", a."correspondenceVersionCount"
  INTO parent_kind, expected_count
  FROM "Artifact" a
  WHERE a."tenantId" = parent_tenant
    AND a."consumerId" = parent_consumer
    AND a."id" = parent_id
  FOR UPDATE;

  IF parent_kind = 'CANONICAL_PACKET_PDF' THEN
    SELECT COUNT(*) INTO actual_count
    FROM "ArtifactCorrespondenceVersion" acv
    WHERE acv."tenantId" = parent_tenant
      AND acv."consumerId" = parent_consumer
      AND acv."artifactId" = parent_id;

    IF actual_count <> expected_count THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'canonical artifact correspondence membership count is sealed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "Artifact_seal_count_trg"
AFTER INSERT ON "Artifact"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_artifact_seal();

CREATE CONSTRAINT TRIGGER "ArtifactCorrespondenceVersion_parent_seal_trg"
AFTER INSERT ON "ArtifactCorrespondenceVersion"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_validate_artifact_seal();

-- Append-only enforcement. Corrections/supersession/tombstoning append a new row;
-- they never rewrite or delete the source, version, membership, artifact or event.
-- The application migration role must remain the only role able to drop triggers;
-- runtime roles should not own these tables or receive TRUNCATE privileges.
CREATE FUNCTION p0_forbid_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = format('%I is append-only; append a new version/event instead', TG_TABLE_NAME);
END;
$$;

CREATE TRIGGER "ReportVersion_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ReportVersion" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "ExtractionRun_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ExtractionRun" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "ExtractionBureauCoverage_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ExtractionBureauCoverage" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "Account_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "Account" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "ReportVersionAccount_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ReportVersionAccount" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "AccountPresenceObservation_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "AccountPresenceObservation" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "FieldObservation_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "FieldObservation" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "SectionCompleteness_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "SectionCompleteness" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "HistoricalEvidence_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "HistoricalEvidence" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "DerivedAccountAssessment_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "DerivedAccountAssessment" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "ConsumerAssertion_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ConsumerAssertion" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "CreditScoreObservation_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "CreditScoreObservation" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "ReportComparison_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ReportComparison" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "ReportDifference_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ReportDifference" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "DisputeOutcome_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "DisputeOutcome" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "IdentityBaseline_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "IdentityBaseline" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "IdentityFact_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "IdentityFact" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "Recipient_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "Recipient" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "RecipientAddressVersion_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "RecipientAddressVersion" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "CorrespondenceItem_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "CorrespondenceItem" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "CorrespondenceVersion_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "CorrespondenceVersion" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "CorrespondenceVersionItem_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "CorrespondenceVersionItem" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "Packet_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "Packet" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "PacketCorrespondenceVersion_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "PacketCorrespondenceVersion" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "PacketEnclosure_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "PacketEnclosure" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "Artifact_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "Artifact" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "ArtifactCorrespondenceVersion_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ArtifactCorrespondenceVersion" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "ArtifactTombstone_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ArtifactTombstone" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "EvidenceEvent_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "EvidenceEvent" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
