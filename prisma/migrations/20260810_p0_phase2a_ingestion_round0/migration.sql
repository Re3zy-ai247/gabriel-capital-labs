-- CreditVector P0 Phase 2A: ingestion, exact extraction input, Round 0,
-- consumer-selection receipts, and refs-only sensitive-access audit.
--
-- ADDITIVE ONLY. This migration contains no production backfill, legacy-to-P0
-- inference, destructive rewrite, runtime self-heal DDL, or feature activation.
-- Existing Phase 1 rows remain valid: new ExtractionRun/IdentityFact pins are
-- nullable for old-runtime compatibility, while the Phase 2A writer requires and
-- attests them for every new Phase 2A operation.

-- CreateEnum
CREATE TYPE "ReportIngestionState" AS ENUM ('RECEIVED', 'SOURCE_STORED_AND_VERIFIED', 'VERSION_COMMITTED', 'EXTRACTING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'ASSESSED', 'ROUND0_READY', 'OUTCOME_UNKNOWN', 'QUARANTINED');

CREATE TYPE "ExtractionInputRepresentation" AS ENUM ('ORIGINAL_REPORT_BYTES', 'DERIVED_NORMALIZED_TEXT');

CREATE TYPE "ReportSourceDisposition" AS ENUM ('RETAINED', 'TOMBSTONE_REQUESTED', 'OBJECT_DELETED', 'CRYPTO_SHREDDED', 'DISPOSITION_FAILED');

CREATE TYPE "P0AuthorizationKind" AS ENUM ('DIRECT_CONSUMER', 'AGENCY_MANAGED_CLIENT', 'ADMIN_IMPERSONATION', 'SYSTEM_WORKER');

CREATE TYPE "ReportDateEvidencePresence" AS ENUM ('PRESENT', 'EXPLICIT_NOT_PROVIDED', 'UNKNOWN');

CREATE TYPE "ReportDatePrecision" AS ENUM ('DAY', 'MONTH', 'YEAR', 'UNKNOWN');

CREATE TYPE "CreditScoreModelPresence" AS ENUM ('PRESENT', 'NOT_PROVIDED', 'UNKNOWN');

CREATE TYPE "IdentityReviewCategory" AS ENUM ('LEGAL_NAME', 'ALIAS', 'CURRENT_ADDRESS', 'FORMER_ADDRESS', 'SAFE_IDENTIFIER', 'PHONE', 'EMPLOYMENT', 'MIXED_FILE_INDICATOR', 'UNRECOGNIZED_ACCOUNT');

CREATE TYPE "IdentityCategoryCompletionDisposition" AS ENUM ('NOT_APPLICABLE');

CREATE TYPE "IdentityCorrespondenceAssertionStatus" AS ENUM ('ATTESTED', 'REVOKED');

CREATE TYPE "IdentityCorrespondencePurpose" AS ENUM ('CORRESPONDENCE_SENDER_IDENTITY', 'CORRESPONDENCE_IDENTITY_CORRECTION');

CREATE TYPE "ConsumerAccountReviewState" AS ENUM ('RECOGNIZED', 'UNRECOGNIZED', 'UNKNOWN', 'DEFERRED', 'REVOKED');

CREATE TYPE "CaseActionDecisionState" AS ENUM ('PROPOSED', 'CONSUMER_SELECTED', 'DECLINED', 'WAITING', 'BLOCKED');

CREATE TYPE "CaseActionCode" AS ENUM ('REVIEW_ACCOUNT_FACT', 'REVIEW_IDENTITY_FACT', 'REQUEST_ACCOUNT_CORRECTION', 'REQUEST_IDENTITY_CORRECTION', 'TAKE_NO_ACTION', 'DEFER_REVIEW');

CREATE TYPE "CaseActionSourceType" AS ENUM ('FIELD_OBSERVATION', 'DERIVED_ACCOUNT_ASSESSMENT', 'CONSUMER_ASSERTION', 'CONSUMER_ACCOUNT_REVIEW', 'IDENTITY_FACT', 'IDENTITY_CORRESPONDENCE_ASSERTION', 'IDENTITY_CATEGORY_COMPLETION');

CREATE TYPE "P0SensitiveAccessKind" AS ENUM ('DECRYPT', 'PREVIEW', 'DOWNLOAD', 'EXPORT', 'AGENCY', 'ADMIN', 'WORKER');

CREATE TYPE "P0SensitiveAccessPurposeCode" AS ENUM ('REPORT_INGESTION', 'ROUND0_REVIEW', 'CONSUMER_CONFIRMATION', 'INTEGRITY_VERIFICATION', 'CONSUMER_EXPORT', 'AGENCY_MANAGED_CLIENT_SERVICE', 'ADMIN_SUPPORT', 'WORKER_EXTRACTION');

CREATE TYPE "P0SensitiveAccessDecision" AS ENUM ('ALLOW', 'DENY');

CREATE TYPE "P0SensitiveAccessReasonCode" AS ENUM ('AUTHORIZED', 'SCOPE_DENIED', 'PURPOSE_DENIED', 'RESOURCE_NOT_FOUND', 'GATE_DISABLED', 'INTEGRITY_FAILURE', 'OTHER_SAFE_DENIAL');

CREATE TYPE "P0SensitiveResourceType" AS ENUM ('REPORT_INGESTION', 'REPORT_SOURCE', 'NORMALIZED_REPORT_TEXT', 'REPORT_VERSION', 'IDENTITY_FACT_VALUE', 'CONSUMER_ASSERTION_STATEMENT', 'ARTIFACT');

-- Old-runtime-compatible exact-input and identity-integrity columns.
ALTER TABLE "ExtractionRun" ADD COLUMN "inputArtifactId" TEXT;
ALTER TABLE "ExtractionRun" ADD COLUMN "inputSha256" VARCHAR(64);
ALTER TABLE "ExtractionRun" ADD COLUMN "inputRepresentation" "ExtractionInputRepresentation";
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_input_tuple_ck" CHECK (
  ("inputArtifactId" IS NULL AND "inputSha256" IS NULL AND "inputRepresentation" IS NULL)
  OR
  ("inputArtifactId" IS NOT NULL AND "inputSha256" IS NOT NULL AND "inputRepresentation" IS NOT NULL)
);
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_input_sha256_ck" CHECK (
  "inputSha256" IS NULL OR "inputSha256" ~ '^[0-9a-f]{64}$'
);

ALTER TABLE "IdentityFact" ADD COLUMN "reviewCategory" "IdentityReviewCategory";
ALTER TABLE "IdentityFact" ADD COLUMN "integritySha256" VARCHAR(64);
ALTER TABLE "IdentityFact" ADD COLUMN "extractionRunId" TEXT;
ALTER TABLE "IdentityFact" ADD COLUMN "baselineInputSetSha256" VARCHAR(64);
ALTER TABLE "IdentityFact" ADD CONSTRAINT "IdentityFact_integrity_sha256_ck" CHECK (
  "integritySha256" IS NULL OR "integritySha256" ~ '^[0-9a-f]{64}$'
);
ALTER TABLE "IdentityFact" ADD CONSTRAINT "IdentityFact_source_seal_tuple_ck" CHECK (
  (
    "reviewCategory" IS NULL
    AND "integritySha256" IS NULL
    AND "extractionRunId" IS NULL
    AND "baselineInputSetSha256" IS NULL
  )
  OR
  (
    "reviewCategory" IS NOT NULL
    AND "integritySha256" IS NOT NULL
    AND "integritySha256" ~ '^[0-9a-f]{64}$'
    AND "extractionRunId" IS NOT NULL
    AND length("extractionRunId") BETWEEN 1 AND 191
    AND "baselineInputSetSha256" IS NOT NULL
    AND "baselineInputSetSha256" ~ '^[0-9a-f]{64}$'
  )
);

ALTER TABLE "IdentityBaseline" ADD COLUMN "extractionRunId" TEXT;
ALTER TABLE "IdentityBaseline" ADD COLUMN "reportIngestionId" TEXT;
ALTER TABLE "IdentityBaseline" ADD COLUMN "sourceIdentityBaselineId" TEXT;
ALTER TABLE "IdentityBaseline" ADD COLUMN "supersedesIdentityBaselineId" TEXT;
ALTER TABLE "IdentityBaseline" ADD COLUMN "semanticSha256" VARCHAR(64);
ALTER TABLE "IdentityBaseline" ADD COLUMN "expectedIdentityFactCount" INTEGER;
ALTER TABLE "IdentityBaseline" ADD COLUMN "expectedCategoryCompletionCount" INTEGER;
ALTER TABLE "IdentityBaseline" ADD COLUMN "expectedAccountReviewReceiptCount" INTEGER;
ALTER TABLE "IdentityBaseline" ADD CONSTRAINT "IdentityBaseline_source_ingestion_tuple_ck" CHECK (
  (
    "extractionRunId" IS NULL
    AND "reportIngestionId" IS NULL
  )
  OR (
    "extractionRunId" IS NOT NULL
    AND "reportIngestionId" IS NOT NULL
    AND length("reportIngestionId") BETWEEN 1 AND 191
  )
);
ALTER TABLE "IdentityBaseline" ADD CONSTRAINT "IdentityBaseline_confirmation_seal_ck" CHECK (
  (
    "sourceIdentityBaselineId" IS NULL
    AND "supersedesIdentityBaselineId" IS NULL
    AND "semanticSha256" IS NULL
    AND "expectedIdentityFactCount" IS NULL
    AND "expectedCategoryCompletionCount" IS NULL
    AND "expectedAccountReviewReceiptCount" IS NULL
  )
  OR
  (
    "sourceIdentityBaselineId" IS NOT NULL
    AND "extractionRunId" IS NOT NULL
    AND length("sourceIdentityBaselineId") BETWEEN 1 AND 191
    AND "supersedesIdentityBaselineId" IS NOT NULL
    AND length("supersedesIdentityBaselineId") BETWEEN 1 AND 191
    AND "semanticSha256" IS NOT NULL
    AND "semanticSha256" ~ '^[0-9a-f]{64}$'
    AND "expectedIdentityFactCount" BETWEEN 0 AND 1024
    AND "expectedCategoryCompletionCount" BETWEEN 0 AND 9
    AND "expectedAccountReviewReceiptCount" BETWEEN 0 AND 1024
    AND "status" = 'CONFIRMED'
  )
);

ALTER TABLE "CreditScoreObservation" ADD COLUMN "scoreModelPresence" "CreditScoreModelPresence";
ALTER TABLE "CreditScoreObservation" ADD COLUMN "scoreModelEvidenceValue" TEXT;
ALTER TABLE "CreditScoreObservation" ADD COLUMN "scoreModelSourceLocatorToken" TEXT;
ALTER TABLE "CreditScoreObservation" ADD CONSTRAINT "CreditScoreObservation_model_evidence_ck" CHECK (
  (
    "scoreModelPresence" IS NULL
    AND "scoreModelEvidenceValue" IS NULL
    AND "scoreModelSourceLocatorToken" IS NULL
  )
  OR
  (
    "sourceType" = 'REPORT_DERIVED'
    AND "reportVersionId" IS NOT NULL
    AND "extractionRunId" IS NOT NULL
    AND (
      (
        "scoreModelPresence" = 'PRESENT'
        AND "scoreModelEvidenceValue" IS NOT NULL
        AND length("scoreModelEvidenceValue") BETWEEN 1 AND 200
        AND "scoreModelEvidenceValue" ~ '[^[:space:]]'
        AND "scoreModelEvidenceValue" !~ '[[:cntrl:]]'
        AND "scoreModelSourceLocatorToken" IS NOT NULL
        AND length("scoreModelSourceLocatorToken") BETWEEN 1 AND 191
        AND "scoreModelKey" IS NULL
        AND "scoreModelVersion" IS NULL
      )
      OR
      (
        "scoreModelPresence" = 'NOT_PROVIDED'
        AND "scoreModelEvidenceValue" IS NULL
        AND "scoreModelKey" IS NULL
        AND "scoreModelVersion" IS NULL
        AND "scoreModelSourceLocatorToken" IS NOT NULL
        AND length("scoreModelSourceLocatorToken") BETWEEN 1 AND 191
      )
      OR
      (
        "scoreModelPresence" = 'UNKNOWN'
        AND "scoreModelEvidenceValue" IS NULL
        AND "scoreModelKey" IS NULL
        AND "scoreModelVersion" IS NULL
        AND "scoreModelSourceLocatorToken" IS NULL
      )
    )
  )
);

ALTER TABLE "ConsumerAssertion" ADD COLUMN "integritySha256" VARCHAR(64);
ALTER TABLE "ConsumerAssertion" ADD CONSTRAINT "ConsumerAssertion_integrity_sha256_ck" CHECK (
  "integritySha256" IS NULL OR "integritySha256" ~ '^[0-9a-f]{64}$'
);

-- Sole durable ingestion queue. The encrypted locator is a recovery capability;
-- it never becomes report truth. Exact truth is established by the linked,
-- immutable rows after authoritative readback and semantic verification.
CREATE TABLE "ReportIngestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "authorizationKind" "P0AuthorizationKind" NOT NULL,
    "authorizationVersion" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "reportSeriesKey" TEXT NOT NULL,
    "reservedVersion" INTEGER NOT NULL,
    "sourceSha256" VARCHAR(64) NOT NULL,
    "sourceByteLength" BIGINT NOT NULL,
    "sourceDeclaredMimeType" TEXT NOT NULL,
    "sourceDetectedMimeType" TEXT NOT NULL,
    "sourceStorageProviderKey" TEXT,
    "sourceLocatorCiphertext" BYTEA,
    "sourceLocatorIv" BYTEA,
    "sourceLocatorAuthTag" BYTEA,
    "sourceLocatorKeyVersion" TEXT,
    "sourceLocatorAlgorithm" "EncryptionAlgorithm",
    "sourceLocatorEnvelopeVersion" TEXT,
    "sourceLocatorAadVersion" TEXT,
    "sourceReadbackSha256" VARCHAR(64),
    "sourceReadbackByteLength" BIGINT,
    "sourceVerifiedAt" TIMESTAMP(3),
    "sourceDisposition" "ReportSourceDisposition" NOT NULL DEFAULT 'RETAINED',
    "sourceDispositionReasonCode" TEXT,
    "sourceDispositionAt" TIMESTAMP(3),
    "state" "ReportIngestionState" NOT NULL DEFAULT 'RECEIVED',
    "safeFailureCode" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "leaseToken" TEXT,
    "leaseOwnerId" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "reportVersionId" TEXT,
    "sourceArtifactId" TEXT,
    "extractionRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportIngestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReportIngestion_reserved_version_ck" CHECK ("reservedVersion" > 0),
    CONSTRAINT "ReportIngestion_source_sha256_ck" CHECK ("sourceSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ReportIngestion_source_size_ck" CHECK ("sourceByteLength" > 0),
    CONSTRAINT "ReportIngestion_revision_ck" CHECK ("revision" > 0),
    CONSTRAINT "ReportIngestion_attempt_ck" CHECK ("attemptCount" >= 0 AND "maxAttempts" BETWEEN 1 AND 3 AND "attemptCount" <= "maxAttempts"),
    CONSTRAINT "ReportIngestion_machine_keys_ck" CHECK (
      length("actorId") BETWEEN 1 AND 191
      AND length("authorizationVersion") BETWEEN 1 AND 128
      AND length("idempotencyKey") BETWEEN 1 AND 191
      AND length("operationKey") BETWEEN 1 AND 191
      AND length("reportSeriesKey") BETWEEN 1 AND 191
      AND length("sourceDeclaredMimeType") BETWEEN 1 AND 255
      AND length("sourceDetectedMimeType") BETWEEN 1 AND 255
    ),
    CONSTRAINT "ReportIngestion_failure_code_ck" CHECK (
      "safeFailureCode" IS NULL OR "safeFailureCode" ~ '^[A-Z][A-Z0-9_]{0,127}$'
    ),
    CONSTRAINT "ReportIngestion_locator_envelope_ck" CHECK (
      (
        "sourceStorageProviderKey" IS NULL
        AND "sourceLocatorCiphertext" IS NULL
        AND "sourceLocatorIv" IS NULL
        AND "sourceLocatorAuthTag" IS NULL
        AND "sourceLocatorKeyVersion" IS NULL
        AND "sourceLocatorAlgorithm" IS NULL
        AND "sourceLocatorEnvelopeVersion" IS NULL
        AND "sourceLocatorAadVersion" IS NULL
      )
      OR
      (
        "sourceStorageProviderKey" IS NOT NULL
        AND "sourceLocatorCiphertext" IS NOT NULL
        AND octet_length("sourceLocatorCiphertext") > 0
        AND "sourceLocatorIv" IS NOT NULL
        AND octet_length("sourceLocatorIv") > 0
        AND "sourceLocatorAuthTag" IS NOT NULL
        AND octet_length("sourceLocatorAuthTag") > 0
        AND "sourceLocatorKeyVersion" IS NOT NULL
        AND "sourceLocatorAlgorithm" IS NOT NULL
        AND "sourceLocatorEnvelopeVersion" IS NOT NULL
        AND "sourceLocatorAadVersion" IS NOT NULL
      )
    ),
    CONSTRAINT "ReportIngestion_readback_ck" CHECK (
      (
        "sourceReadbackSha256" IS NULL
        AND "sourceReadbackByteLength" IS NULL
        AND "sourceVerifiedAt" IS NULL
      )
      OR
      (
        "sourceReadbackSha256" = "sourceSha256"
        AND "sourceReadbackSha256" ~ '^[0-9a-f]{64}$'
        AND "sourceReadbackByteLength" = "sourceByteLength"
        AND "sourceReadbackByteLength" > 0
        AND "sourceVerifiedAt" IS NOT NULL
      )
    ),
    CONSTRAINT "ReportIngestion_disposition_ck" CHECK (
      (
        "sourceDisposition" = 'RETAINED'
        AND "sourceDispositionReasonCode" IS NULL
        AND "sourceDispositionAt" IS NULL
      )
      OR
      (
        "sourceDisposition" <> 'RETAINED'
        AND "sourceDispositionReasonCode" ~ '^[A-Z][A-Z0-9_]{0,127}$'
        AND "sourceDispositionAt" IS NOT NULL
      )
    ),
    CONSTRAINT "ReportIngestion_lease_ck" CHECK (
      ("leaseToken" IS NULL AND "leaseOwnerId" IS NULL AND "leaseExpiresAt" IS NULL)
      OR
      (
        "leaseToken" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
        AND "leaseOwnerId" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
        AND "leaseExpiresAt" IS NOT NULL
      )
    ),
    CONSTRAINT "ReportIngestion_disposition_state_ck" CHECK (
      "sourceDisposition" = 'RETAINED' OR "state" = 'QUARANTINED'
    ),
    CONSTRAINT "ReportIngestion_link_tuple_ck" CHECK (
      (("reportVersionId" IS NULL)::INTEGER + ("sourceArtifactId" IS NULL)::INTEGER) IN (0, 2)
      AND ("extractionRunId" IS NULL OR "reportVersionId" IS NOT NULL)
    ),
    CONSTRAINT "ReportIngestion_failure_state_ck" CHECK (
      "state" NOT IN ('FAILED', 'OUTCOME_UNKNOWN', 'QUARANTINED') OR "safeFailureCode" IS NOT NULL
    ),
    CONSTRAINT "ReportIngestion_source_state_ck" CHECK (
      "state" NOT IN ('SOURCE_STORED_AND_VERIFIED', 'VERSION_COMMITTED', 'EXTRACTING', 'SUCCEEDED', 'PARTIAL', 'ASSESSED', 'ROUND0_READY')
      OR (
        "sourceStorageProviderKey" IS NOT NULL
        AND "sourceReadbackSha256" = "sourceSha256"
        AND "sourceReadbackByteLength" = "sourceByteLength"
        AND "sourceVerifiedAt" IS NOT NULL
      )
    ),
    CONSTRAINT "ReportIngestion_version_state_ck" CHECK (
      "state" NOT IN ('VERSION_COMMITTED', 'EXTRACTING', 'SUCCEEDED', 'PARTIAL', 'ASSESSED', 'ROUND0_READY')
      OR ("reportVersionId" IS NOT NULL AND "sourceArtifactId" IS NOT NULL)
    ),
    CONSTRAINT "ReportIngestion_run_state_ck" CHECK (
      "state" NOT IN ('SUCCEEDED', 'PARTIAL', 'ASSESSED', 'ROUND0_READY')
      OR "extractionRunId" IS NOT NULL
    )
);

-- One immutable lexical report-date observation per exact run/bureau. A partial
-- date is never normalized into an invented day, and UNKNOWN never aliases an
-- explicit source statement that no report date was provided.
CREATE TABLE "BureauReportDateEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "coverageStatus" "BureauCoverageStatus" NOT NULL,
    "bureauCoverageId" TEXT NOT NULL,
    "presence" "ReportDateEvidencePresence" NOT NULL,
    "sourceValue" VARCHAR(10),
    "precision" "ReportDatePrecision" NOT NULL,
    "provenance" "ReportDateProvenance" NOT NULL,
    "sourceLocatorToken" TEXT,
    "integritySha256" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BureauReportDateEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BureauReportDateEvidence_integrity_ck" CHECK (
      "integritySha256" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "BureauReportDateEvidence_shape_ck" CHECK (
      CASE "presence"
        WHEN 'PRESENT' THEN
          "provenance" = 'SOURCE_REPORTED'
          AND "sourceValue" IS NOT NULL
          AND "sourceLocatorToken" IS NOT NULL
          AND length("sourceLocatorToken") BETWEEN 1 AND 191
          AND CASE "precision"
            WHEN 'YEAR' THEN "sourceValue" ~ '^[1-9][0-9]{3}$'
            WHEN 'MONTH' THEN
              "sourceValue" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'
            WHEN 'DAY' THEN
              CASE
                WHEN "sourceValue" ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$'
                THEN to_char(to_date("sourceValue", 'FXYYYY-MM-DD'), 'YYYY-MM-DD') = "sourceValue"
                ELSE FALSE
              END
            ELSE FALSE
          END
        WHEN 'EXPLICIT_NOT_PROVIDED' THEN
          "sourceValue" IS NULL
          AND "precision" = 'UNKNOWN'
          AND "provenance" = 'EXPLICIT_NOT_PROVIDED'
          AND "sourceLocatorToken" IS NOT NULL
          AND length("sourceLocatorToken") BETWEEN 1 AND 191
        WHEN 'UNKNOWN' THEN
          "sourceValue" IS NULL
          AND "precision" = 'UNKNOWN'
          AND "provenance" = 'UNKNOWN'
          AND "sourceLocatorToken" IS NULL
      END
    )
);

-- Value-free exact completeness catalog for Round 0. Every exact Phase 2A run
-- persists one immutable row for each of 3 bureaus x 9 review categories.
-- UNRECOGNIZED_ACCOUNT is the account-index membership slot; no row is a
-- consumer disposition or policy/legal conclusion.
CREATE TABLE "Round0SourceCompletenessEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "identityBaselineId" TEXT,
    "baselineInputSetSha256" VARCHAR(64),
    "bureau" "Bureau" NOT NULL,
    "coverageStatus" "BureauCoverageStatus" NOT NULL,
    "bureauCoverageId" TEXT NOT NULL,
    "category" "IdentityReviewCategory" NOT NULL,
    "status" "SectionExtractionStatus" NOT NULL,
    "sourceMemberCount" INTEGER NOT NULL,
    "sourceMembershipSha256" VARCHAR(64) NOT NULL,
    "sourceLocatorToken" TEXT,
    "integritySha256" VARCHAR(64) NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round0SourceCompletenessEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Round0SourceCompletenessEvidence_shape_ck" CHECK (
      "sourceMemberCount" BETWEEN 0 AND 1024
      AND (
        (
          "identityBaselineId" IS NULL
          AND "baselineInputSetSha256" IS NULL
        )
        OR (
          "identityBaselineId" IS NOT NULL
          AND length("identityBaselineId") BETWEEN 1 AND 191
          AND "baselineInputSetSha256" IS NOT NULL
          AND "baselineInputSetSha256" ~ '^[0-9a-f]{64}$'
        )
      )
      AND "sourceMembershipSha256" ~ '^[0-9a-f]{64}$'
      AND "integritySha256" ~ '^[0-9a-f]{64}$'
      AND length("ruleKey") BETWEEN 1 AND 191
      AND length("ruleVersion") BETWEEN 1 AND 128
      AND (
        "sourceLocatorToken" IS NULL
        OR length("sourceLocatorToken") BETWEEN 1 AND 191
      )
      AND (
        (
          "coverageStatus" = 'COVERED'
          AND (
            "status" NOT IN ('COMPLETE', 'PARTIAL')
            OR "sourceLocatorToken" IS NOT NULL
          )
        )
        OR (
          "coverageStatus" = 'OUTSIDE_COVERAGE'
          AND "status" IN ('NOT_PROVIDED', 'UNKNOWN')
          AND "sourceMemberCount" = 0
          AND "sourceLocatorToken" IS NULL
        )
      )
    )
);

CREATE TABLE "IdentityCategoryCompletion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "identityBaselineVersion" INTEGER NOT NULL,
    "baselineInputSetSha256" VARCHAR(64) NOT NULL,
    "category" "IdentityReviewCategory" NOT NULL,
    "disposition" "IdentityCategoryCompletionDisposition" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "sourceCompletenessSha256" VARCHAR(64) NOT NULL,
    "sourceCompletenessAttestationKey" TEXT NOT NULL,
    "sourceCompletenessRuleVersion" TEXT NOT NULL,
    "sourceCompletenessEvidenceCount" INTEGER NOT NULL DEFAULT 3,
    "equifaxSourceCompletenessEvidenceId" TEXT NOT NULL,
    "experianSourceCompletenessEvidenceId" TEXT NOT NULL,
    "transunionSourceCompletenessEvidenceId" TEXT NOT NULL,
    "completedByActorId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityCategoryCompletion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IdentityCategoryCompletion_version_ck" CHECK ("identityBaselineVersion" > 0),
    CONSTRAINT "IdentityCategoryCompletion_sha256_ck" CHECK (
      "baselineInputSetSha256" ~ '^[0-9a-f]{64}$'
      AND "sourceCompletenessSha256" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "IdentityCategoryCompletion_attestation_ck" CHECK (
      "sourceCompletenessEvidenceCount" = 3
      AND
      length("sourceCompletenessAttestationKey") BETWEEN 1 AND 191
      AND length("sourceCompletenessRuleVersion") BETWEEN 1 AND 128
      AND length("completedByActorId") BETWEEN 1 AND 191
      AND "equifaxSourceCompletenessEvidenceId" <> "experianSourceCompletenessEvidenceId"
      AND "equifaxSourceCompletenessEvidenceId" <> "transunionSourceCompletenessEvidenceId"
      AND "experianSourceCompletenessEvidenceId" <> "transunionSourceCompletenessEvidenceId"
    )
);

CREATE TABLE "IdentityCorrespondenceAssertion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "identityBaselineVersion" INTEGER NOT NULL,
    "baselineInputSetSha256" VARCHAR(64) NOT NULL,
    "identityFactSeriesKey" TEXT NOT NULL,
    "identityFactId" TEXT NOT NULL,
    "identityFactClassification" "IdentityFactClassification" NOT NULL,
    "identityFactIntegritySha256" VARCHAR(64) NOT NULL,
    "factBureau" "Bureau",
    "factSourceLocatorToken" TEXT NOT NULL,
    "correspondencePurposeCode" "IdentityCorrespondencePurpose" NOT NULL,
    "sourceSeriesKey" VARCHAR(64) NOT NULL,
    "assertionSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "IdentityCorrespondenceAssertionStatus" NOT NULL,
    "sourceSetSha256" VARCHAR(64) NOT NULL,
    "attestedByActorId" TEXT NOT NULL,
    "attestedAt" TIMESTAMP(3) NOT NULL,
    "supersedesAssertionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityCorrespondenceAssertion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IdentityCorrespondenceAssertion_version_ck" CHECK ("version" > 0 AND "identityBaselineVersion" > 0),
    CONSTRAINT "IdentityCorrespondenceAssertion_sha256_ck" CHECK (
      "baselineInputSetSha256" ~ '^[0-9a-f]{64}$'
      AND "identityFactIntegritySha256" ~ '^[0-9a-f]{64}$'
      AND "sourceSetSha256" ~ '^[0-9a-f]{64}$'
      AND "sourceSeriesKey" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "IdentityCorrespondenceAssertion_purpose_ck" CHECK (
      length("factSourceLocatorToken") BETWEEN 1 AND 191
      AND length("attestedByActorId") BETWEEN 1 AND 191
    ),
    CONSTRAINT "IdentityCorrespondenceAssertion_supersession_ck" CHECK (
      ("version" = 1 AND "supersedesAssertionId" IS NULL AND "status" = 'ATTESTED')
      OR
      ("version" > 1 AND "supersedesAssertionId" IS NOT NULL)
    ),
    CONSTRAINT "IdentityCorrespondenceAssertion_revoke_ck" CHECK (
      "status" <> 'REVOKED' OR "supersedesAssertionId" IS NOT NULL
    )
);

-- Consumer-only, bounded recognition state for one exact source-listed account.
-- The closed shape intentionally has no fraud, accuracy, dispute, deletion,
-- policy, requested-action, or legal-conclusion field.
CREATE TABLE "ConsumerAccountReviewReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "identityBaselineId" TEXT NOT NULL,
    "identityBaselineVersion" INTEGER NOT NULL,
    "baselineInputSetSha256" VARCHAR(64) NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "accountId" TEXT NOT NULL,
    "reportVersionAccountId" TEXT NOT NULL,
    "accountPresenceObservationId" TEXT NOT NULL,
    "accountPresenceObservationRevision" INTEGER NOT NULL,
    "accountPresenceIntegritySha256" VARCHAR(64) NOT NULL,
    "accountPresenceSourceLocatorToken" TEXT NOT NULL,
    "accountIndexCompletenessEvidenceId" TEXT NOT NULL,
    "accountIndexSourceMembershipSha256" VARCHAR(64) NOT NULL,
    "accountIndexCompletenessIntegritySha256" VARCHAR(64) NOT NULL,
    "sourceSeriesKey" VARCHAR(64) NOT NULL,
    "reviewSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reviewState" "ConsumerAccountReviewState" NOT NULL,
    "sourceSetSha256" VARCHAR(64) NOT NULL,
    "authorizationKind" "P0AuthorizationKind" NOT NULL,
    "authorizationVersion" TEXT NOT NULL,
    "reviewedByActorId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "supersedesReviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerAccountReviewReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConsumerAccountReviewReceipt_version_ck" CHECK (
      "version" > 0
      AND "identityBaselineVersion" > 0
      AND "accountPresenceObservationRevision" > 0
    ),
    CONSTRAINT "ConsumerAccountReviewReceipt_sha256_ck" CHECK (
      "baselineInputSetSha256" ~ '^[0-9a-f]{64}$'
      AND "accountPresenceIntegritySha256" ~ '^[0-9a-f]{64}$'
      AND "accountIndexSourceMembershipSha256" ~ '^[0-9a-f]{64}$'
      AND "accountIndexCompletenessIntegritySha256" ~ '^[0-9a-f]{64}$'
      AND "sourceSetSha256" ~ '^[0-9a-f]{64}$'
      AND "sourceSeriesKey" ~ '^[0-9a-f]{64}$'
      AND length("accountPresenceSourceLocatorToken") BETWEEN 1 AND 191
    ),
    CONSTRAINT "ConsumerAccountReviewReceipt_actor_ck" CHECK (
      "authorizationKind" = 'DIRECT_CONSUMER'
      AND "tenantId" = "consumerId"
      AND length("authorizationVersion") BETWEEN 1 AND 191
      AND length("reviewedByActorId") BETWEEN 1 AND 191
      AND length("reviewSeriesKey") BETWEEN 1 AND 191
    ),
    CONSTRAINT "ConsumerAccountReviewReceipt_supersession_ck" CHECK (
      (
        "version" = 1
        AND "supersedesReviewId" IS NULL
        AND "reviewState" <> 'REVOKED'
      )
      OR
      ("version" > 1 AND "supersedesReviewId" IS NOT NULL)
    ),
    CONSTRAINT "ConsumerAccountReviewReceipt_revoke_ck" CHECK (
      "reviewState" <> 'REVOKED' OR "supersedesReviewId" IS NOT NULL
    )
);

-- Exact refs-only membership of a current consumer account-review receipt in
-- one immutable CONFIRMED baseline. Legal/policy/fraud conclusions are absent.
CREATE TABLE "IdentityBaselineAccountReviewMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "confirmedIdentityBaselineId" TEXT NOT NULL,
    "confirmedIdentityBaselineVersion" INTEGER NOT NULL,
    "confirmedBaselineInputSetSha256" VARCHAR(64) NOT NULL,
    "consumerAccountReviewReceiptId" TEXT NOT NULL,
    "reviewSeriesKey" TEXT NOT NULL,
    "reviewVersion" INTEGER NOT NULL,
    "reviewState" "ConsumerAccountReviewState" NOT NULL,
    "receiptSourceSetSha256" VARCHAR(64) NOT NULL,
    "bureau" "Bureau" NOT NULL,
    "accountId" TEXT NOT NULL,
    "reportVersionAccountId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityBaselineAccountReviewMembership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IdentityBaselineAccountReviewMembership_shape_ck" CHECK (
      "confirmedIdentityBaselineVersion" > 0
      AND "reviewVersion" > 0
      AND "ordinal" >= 0
      AND "reviewState" <> 'REVOKED'
      AND "confirmedBaselineInputSetSha256" ~ '^[0-9a-f]{64}$'
      AND "receiptSourceSetSha256" ~ '^[0-9a-f]{64}$'
      AND length("reviewSeriesKey") BETWEEN 1 AND 191
      AND length("accountId") BETWEEN 1 AND 191
      AND length("reportVersionAccountId") BETWEEN 1 AND 191
    )
);

CREATE TABLE "CaseActionDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "decisionSeriesKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" "CaseActionDecisionState" NOT NULL,
    "actionCode" "CaseActionCode" NOT NULL,
    "chronologyRound" INTEGER NOT NULL,
    "expectedSourceCount" INTEGER NOT NULL,
    "sourceSetSha256" VARCHAR(64) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "recordedByActorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "supersedesDecisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseActionDecision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CaseActionDecision_version_ck" CHECK ("version" > 0),
    CONSTRAINT "CaseActionDecision_round_ck" CHECK ("chronologyRound" > 0),
    CONSTRAINT "CaseActionDecision_source_set_ck" CHECK (
      "expectedSourceCount" BETWEEN 1 AND 256
      AND "sourceSetSha256" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "CaseActionDecision_keys_ck" CHECK (
      length("decisionSeriesKey") BETWEEN 1 AND 191
      AND length("idempotencyKey") BETWEEN 1 AND 191
      AND length("recordedByActorId") BETWEEN 1 AND 191
    ),
    CONSTRAINT "CaseActionDecision_supersession_ck" CHECK (
      ("version" = 1 AND "supersedesDecisionId" IS NULL AND "state" = 'PROPOSED')
      OR
      ("version" > 1 AND "supersedesDecisionId" IS NOT NULL)
    )
);

CREATE TABLE "CaseActionSourceRef" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "sourceType" "CaseActionSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "bureau" "Bureau",
    "integritySha256" VARCHAR(64) NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseActionSourceRef_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CaseActionSourceRef_version_ck" CHECK ("sourceVersion" > 0),
    CONSTRAINT "CaseActionSourceRef_sha256_ck" CHECK ("integritySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "CaseActionSourceRef_ordinal_ck" CHECK ("ordinal" >= 0),
    CONSTRAINT "CaseActionSourceRef_source_id_ck" CHECK (
      length("sourceId") BETWEEN 1 AND 191
      AND "sourceId" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$'
    )
);

CREATE TABLE "P0SensitiveAccessEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "authorizationKind" "P0AuthorizationKind" NOT NULL,
    "authorizationVersion" TEXT NOT NULL,
    "accessKind" "P0SensitiveAccessKind" NOT NULL,
    "purposeCode" "P0SensitiveAccessPurposeCode" NOT NULL,
    "decision" "P0SensitiveAccessDecision" NOT NULL,
    "decisionCode" "P0SensitiveAccessReasonCode" NOT NULL,
    "resourceType" "P0SensitiveResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceVersion" INTEGER NOT NULL,
    "correlationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "P0SensitiveAccessEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "P0SensitiveAccessEvent_resource_version_ck" CHECK ("resourceVersion" > 0),
    CONSTRAINT "P0SensitiveAccessEvent_refs_only_ck" CHECK (
      "eventKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
      AND "actorId" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
      AND "authorizationVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
      AND "resourceId" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
      AND "correlationId" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
      AND "eventKey" !~ '[0-9]{9}'
      AND "actorId" !~ '[0-9]{9}'
      AND "authorizationVersion" !~ '[0-9]{9}'
      AND "resourceId" !~ '[0-9]{9}'
      AND "correlationId" !~ '[0-9]{9}'
    ),
    CONSTRAINT "P0SensitiveAccessEvent_decision_ck" CHECK (
      ("decision" = 'ALLOW' AND "decisionCode" = 'AUTHORIZED')
      OR
      ("decision" = 'DENY' AND "decisionCode" <> 'AUTHORIZED')
    )
);

-- Exact pinning keys added to existing immutable tables.
CREATE UNIQUE INDEX "artifact_extraction_input_pin_key" ON "Artifact"("tenantId", "consumerId", "id", "sha256");
CREATE UNIQUE INDEX "identity_baseline_attestation_pin_key" ON "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "id", "version", "inputSetSha256");
CREATE UNIQUE INDEX "identity_fact_assertion_pin_key" ON "IdentityFact"("tenantId", "consumerId", "reportVersionId", "identityBaselineId", "factSeriesKey", "id", "classification", "integritySha256");
CREATE UNIQUE INDEX "identity_baseline_source_seal_pin_key" ON "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "id", "version", "inputSetSha256");
CREATE UNIQUE INDEX "identity_baseline_round0_source_pin_key" ON "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "id", "inputSetSha256");
CREATE UNIQUE INDEX "identity_baseline_single_successor_key" ON "IdentityBaseline"("tenantId", "consumerId", "supersedesIdentityBaselineId");
CREATE UNIQUE INDEX "identity_fact_source_seal_pin_key" ON "IdentityFact"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId", "baselineInputSetSha256", "factSeriesKey", "id", "classification", "integritySha256");
CREATE UNIQUE INDEX "report_version_account_review_pin_key" ON "ReportVersionAccount"("tenantId", "consumerId", "reportVersionId", "id", "accountId");
CREATE UNIQUE INDEX "account_presence_review_pin_key" ON "AccountPresenceObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "id", "revision", "integritySha256");

-- ReportIngestion indexes.
CREATE UNIQUE INDEX "report_ingestion_scope_id_key" ON "ReportIngestion"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "report_ingestion_idempotency_key" ON "ReportIngestion"("tenantId", "consumerId", "idempotencyKey");
CREATE UNIQUE INDEX "report_ingestion_operation_key" ON "ReportIngestion"("tenantId", "consumerId", "operationKey");
CREATE UNIQUE INDEX "report_ingestion_reservation_key" ON "ReportIngestion"("tenantId", "consumerId", "reportSeriesKey", "reservedVersion");
CREATE UNIQUE INDEX "report_ingestion_identity_baseline_pin_key" ON "ReportIngestion"("tenantId", "consumerId", "reportVersionId", "id");
CREATE INDEX "report_ingestion_claim_idx" ON "ReportIngestion"("state", "nextAttemptAt", "leaseExpiresAt", "createdAt");
CREATE INDEX "report_ingestion_scope_state_idx" ON "ReportIngestion"("tenantId", "consumerId", "state", "createdAt");
CREATE INDEX "report_ingestion_disposition_idx" ON "ReportIngestion"("tenantId", "consumerId", "sourceDisposition", "createdAt");

-- Lossless bureau-date indexes.
CREATE UNIQUE INDEX "bureau_report_date_scope_id_key" ON "BureauReportDateEvidence"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "bureau_report_date_run_bureau_key" ON "BureauReportDateEvidence"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau");
CREATE INDEX "bureau_report_date_report_idx" ON "BureauReportDateEvidence"("tenantId", "consumerId", "reportVersionId", "bureau", "presence");

CREATE UNIQUE INDEX "round0_source_completeness_scope_id_key" ON "Round0SourceCompletenessEvidence"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "round0_source_completeness_receipt_pin_key" ON "Round0SourceCompletenessEvidence"("tenantId", "consumerId", "id", "sourceMembershipSha256", "integritySha256");
CREATE UNIQUE INDEX "round0_source_completeness_run_bureau_category_key" ON "Round0SourceCompletenessEvidence"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "category");
CREATE INDEX "round0_source_completeness_category_idx" ON "Round0SourceCompletenessEvidence"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "category", "status");

-- Round 0 and action indexes.
CREATE UNIQUE INDEX "identity_category_completion_scope_id_key" ON "IdentityCategoryCompletion"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "identity_category_completion_category_key" ON "IdentityCategoryCompletion"("tenantId", "consumerId", "identityBaselineId", "category");
CREATE INDEX "identity_category_completion_report_idx" ON "IdentityCategoryCompletion"("tenantId", "consumerId", "reportVersionId", "category");

CREATE UNIQUE INDEX "identity_correspondence_scope_id_key" ON "IdentityCorrespondenceAssertion"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "identity_correspondence_supersession_key" ON "IdentityCorrespondenceAssertion"("tenantId", "consumerId", "assertionSeriesKey", "id");
CREATE UNIQUE INDEX "identity_correspondence_series_version_key" ON "IdentityCorrespondenceAssertion"("tenantId", "consumerId", "assertionSeriesKey", "version");
CREATE UNIQUE INDEX "identity_correspondence_source_series_version_key" ON "IdentityCorrespondenceAssertion"("tenantId", "consumerId", "sourceSeriesKey", "version");
CREATE UNIQUE INDEX "identity_correspondence_single_successor_key" ON "IdentityCorrespondenceAssertion"("tenantId", "consumerId", "supersedesAssertionId");
CREATE INDEX "identity_correspondence_fact_idx" ON "IdentityCorrespondenceAssertion"("tenantId", "consumerId", "identityBaselineId", "identityFactId", "attestedAt");

CREATE UNIQUE INDEX "consumer_account_review_scope_id_key" ON "ConsumerAccountReviewReceipt"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "consumer_account_review_supersession_key" ON "ConsumerAccountReviewReceipt"("tenantId", "consumerId", "reviewSeriesKey", "id");
CREATE UNIQUE INDEX "consumer_account_review_series_version_key" ON "ConsumerAccountReviewReceipt"("tenantId", "consumerId", "reviewSeriesKey", "version");
CREATE UNIQUE INDEX "consumer_account_review_source_series_version_key" ON "ConsumerAccountReviewReceipt"("tenantId", "consumerId", "sourceSeriesKey", "version");
CREATE UNIQUE INDEX "consumer_account_review_single_successor_key" ON "ConsumerAccountReviewReceipt"("tenantId", "consumerId", "supersedesReviewId");
CREATE UNIQUE INDEX "consumer_account_review_confirmation_pin_key" ON "ConsumerAccountReviewReceipt"("tenantId", "consumerId", "id", "reviewSeriesKey", "version", "reviewState", "sourceSetSha256", "bureau", "accountId", "reportVersionAccountId");
CREATE INDEX "consumer_account_review_source_idx" ON "ConsumerAccountReviewReceipt"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "reviewedAt");

CREATE UNIQUE INDEX "identity_baseline_account_review_scope_id_key" ON "IdentityBaselineAccountReviewMembership"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "identity_baseline_account_review_member_key" ON "IdentityBaselineAccountReviewMembership"("tenantId", "consumerId", "confirmedIdentityBaselineId", "consumerAccountReviewReceiptId");
CREATE UNIQUE INDEX "identity_baseline_account_review_ordinal_key" ON "IdentityBaselineAccountReviewMembership"("tenantId", "consumerId", "confirmedIdentityBaselineId", "ordinal");
CREATE INDEX "identity_baseline_account_review_baseline_idx" ON "IdentityBaselineAccountReviewMembership"("tenantId", "consumerId", "reportVersionId", "confirmedIdentityBaselineId");

CREATE UNIQUE INDEX "case_action_decision_scope_id_key" ON "CaseActionDecision"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "case_action_decision_membership_pin_key" ON "CaseActionDecision"("tenantId", "consumerId", "reportVersionId", "caseId", "id");
CREATE UNIQUE INDEX "case_action_decision_supersession_key" ON "CaseActionDecision"("tenantId", "consumerId", "decisionSeriesKey", "id");
CREATE UNIQUE INDEX "case_action_decision_series_version_key" ON "CaseActionDecision"("tenantId", "consumerId", "decisionSeriesKey", "version");
CREATE UNIQUE INDEX "case_action_decision_idempotency_key" ON "CaseActionDecision"("tenantId", "consumerId", "idempotencyKey");
CREATE UNIQUE INDEX "case_action_decision_single_successor_key" ON "CaseActionDecision"("tenantId", "consumerId", "supersedesDecisionId");
CREATE INDEX "case_action_decision_case_state_idx" ON "CaseActionDecision"("tenantId", "consumerId", "caseId", "state", "recordedAt");

CREATE UNIQUE INDEX "case_action_source_scope_id_key" ON "CaseActionSourceRef"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "case_action_source_membership_key" ON "CaseActionSourceRef"("tenantId", "consumerId", "decisionId", "sourceType", "sourceId");
CREATE UNIQUE INDEX "case_action_source_ordinal_key" ON "CaseActionSourceRef"("tenantId", "consumerId", "decisionId", "ordinal");
CREATE INDEX "case_action_source_lookup_idx" ON "CaseActionSourceRef"("tenantId", "consumerId", "sourceType", "sourceId");

CREATE UNIQUE INDEX "p0_sensitive_access_scope_id_key" ON "P0SensitiveAccessEvent"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "p0_sensitive_access_event_key" ON "P0SensitiveAccessEvent"("tenantId", "consumerId", "eventKey");
CREATE INDEX "p0_sensitive_access_resource_idx" ON "P0SensitiveAccessEvent"("tenantId", "consumerId", "resourceType", "resourceId", "resourceVersion");
CREATE INDEX "p0_sensitive_access_actor_idx" ON "P0SensitiveAccessEvent"("tenantId", "consumerId", "actorId", "occurredAt", "id");
CREATE INDEX "p0_sensitive_access_correlation_idx" ON "P0SensitiveAccessEvent"("tenantId", "consumerId", "correlationId");

-- Composite scope and exact semantic foreign keys.
ALTER TABLE "ReportIngestion" ADD CONSTRAINT "ReportIngestion_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportIngestion" ADD CONSTRAINT "report_ingestion_report_version_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportIngestion" ADD CONSTRAINT "report_ingestion_source_artifact_fkey" FOREIGN KEY ("tenantId", "consumerId", "sourceArtifactId", "sourceSha256") REFERENCES "Artifact"("tenantId", "consumerId", "id", "sha256") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ReportIngestion" ADD CONSTRAINT "report_ingestion_extraction_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ExtractionRun" ADD CONSTRAINT "extraction_run_input_artifact_fkey" FOREIGN KEY ("tenantId", "consumerId", "inputArtifactId", "inputSha256") REFERENCES "Artifact"("tenantId", "consumerId", "id", "sha256") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "BureauReportDateEvidence" ADD CONSTRAINT "BureauReportDateEvidence_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BureauReportDateEvidence" ADD CONSTRAINT "bureau_report_date_report_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BureauReportDateEvidence" ADD CONSTRAINT "bureau_report_date_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BureauReportDateEvidence" ADD CONSTRAINT "bureau_report_date_coverage_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "bureauCoverageId") REFERENCES "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Round0SourceCompletenessEvidence" ADD CONSTRAINT "Round0SourceCompletenessEvidence_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Round0SourceCompletenessEvidence" ADD CONSTRAINT "round0_source_completeness_report_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Round0SourceCompletenessEvidence" ADD CONSTRAINT "round0_source_completeness_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Round0SourceCompletenessEvidence" ADD CONSTRAINT "round0_source_completeness_coverage_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "bureauCoverageId") REFERENCES "ExtractionBureauCoverage"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "coverageStatus", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Round0SourceCompletenessEvidence" ADD CONSTRAINT "round0_source_completeness_baseline_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId", "baselineInputSetSha256") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "id", "inputSetSha256") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "IdentityBaseline" ADD CONSTRAINT "identity_baseline_extraction_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityBaseline" ADD CONSTRAINT "identity_baseline_report_ingestion_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "reportIngestionId") REFERENCES "ReportIngestion"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityBaseline" ADD CONSTRAINT "identity_baseline_confirmation_source_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "sourceIdentityBaselineId", "inputSetSha256") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "id", "inputSetSha256") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityBaseline" ADD CONSTRAINT "identity_baseline_confirmation_predecessor_fkey" FOREIGN KEY ("tenantId", "consumerId", "supersedesIdentityBaselineId") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityFact" ADD CONSTRAINT "identity_fact_extraction_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "IdentityCategoryCompletion" ADD CONSTRAINT "identity_category_completion_baseline_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "id", "version", "inputSetSha256") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityCategoryCompletion" ADD CONSTRAINT "identity_category_completion_equifax_source_fkey" FOREIGN KEY ("tenantId", "consumerId", "equifaxSourceCompletenessEvidenceId") REFERENCES "Round0SourceCompletenessEvidence"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityCategoryCompletion" ADD CONSTRAINT "identity_category_completion_experian_source_fkey" FOREIGN KEY ("tenantId", "consumerId", "experianSourceCompletenessEvidenceId") REFERENCES "Round0SourceCompletenessEvidence"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityCategoryCompletion" ADD CONSTRAINT "identity_category_completion_transunion_source_fkey" FOREIGN KEY ("tenantId", "consumerId", "transunionSourceCompletenessEvidenceId") REFERENCES "Round0SourceCompletenessEvidence"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "IdentityCorrespondenceAssertion" ADD CONSTRAINT "identity_correspondence_assertion_baseline_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "id", "version", "inputSetSha256") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityCorrespondenceAssertion" ADD CONSTRAINT "identity_correspondence_assertion_fact_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId", "baselineInputSetSha256", "identityFactSeriesKey", "identityFactId", "identityFactClassification", "identityFactIntegritySha256") REFERENCES "IdentityFact"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId", "baselineInputSetSha256", "factSeriesKey", "id", "classification", "integritySha256") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityCorrespondenceAssertion" ADD CONSTRAINT "identity_correspondence_assertion_supersession_fkey" FOREIGN KEY ("tenantId", "consumerId", "assertionSeriesKey", "supersedesAssertionId") REFERENCES "IdentityCorrespondenceAssertion"("tenantId", "consumerId", "assertionSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ConsumerAccountReviewReceipt" ADD CONSTRAINT "ConsumerAccountReviewReceipt_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAccountReviewReceipt" ADD CONSTRAINT "consumer_account_review_report_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAccountReviewReceipt" ADD CONSTRAINT "consumer_account_review_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAccountReviewReceipt" ADD CONSTRAINT "consumer_account_review_baseline_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "id", "version", "inputSetSha256") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAccountReviewReceipt" ADD CONSTRAINT "consumer_account_review_account_fkey" FOREIGN KEY ("tenantId", "consumerId", "accountId") REFERENCES "Account"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAccountReviewReceipt" ADD CONSTRAINT "consumer_account_review_report_account_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "reportVersionAccountId", "accountId") REFERENCES "ReportVersionAccount"("tenantId", "consumerId", "reportVersionId", "id", "accountId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAccountReviewReceipt" ADD CONSTRAINT "consumer_account_review_presence_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "accountPresenceObservationId", "accountPresenceObservationRevision", "accountPresenceIntegritySha256") REFERENCES "AccountPresenceObservation"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "bureau", "accountId", "id", "revision", "integritySha256") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAccountReviewReceipt" ADD CONSTRAINT "consumer_account_review_completeness_fkey" FOREIGN KEY ("tenantId", "consumerId", "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256", "accountIndexCompletenessIntegritySha256") REFERENCES "Round0SourceCompletenessEvidence"("tenantId", "consumerId", "id", "sourceMembershipSha256", "integritySha256") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ConsumerAccountReviewReceipt" ADD CONSTRAINT "consumer_account_review_supersession_fkey" FOREIGN KEY ("tenantId", "consumerId", "reviewSeriesKey", "supersedesReviewId") REFERENCES "ConsumerAccountReviewReceipt"("tenantId", "consumerId", "reviewSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "IdentityBaselineAccountReviewMembership" ADD CONSTRAINT "identity_baseline_account_review_scope_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityBaselineAccountReviewMembership" ADD CONSTRAINT "identity_baseline_account_review_report_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId") REFERENCES "ReportVersion"("tenantId", "consumerId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityBaselineAccountReviewMembership" ADD CONSTRAINT "identity_baseline_account_review_run_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId") REFERENCES "ExtractionRun"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "IdentityBaselineAccountReviewMembership" ADD CONSTRAINT "identity_baseline_account_review_baseline_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "extractionRunId", "confirmedIdentityBaselineId", "confirmedIdentityBaselineVersion", "confirmedBaselineInputSetSha256") REFERENCES "IdentityBaseline"("tenantId", "consumerId", "reportVersionId", "extractionRunId", "id", "version", "inputSetSha256") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "IdentityBaselineAccountReviewMembership" ADD CONSTRAINT "identity_baseline_account_review_receipt_fkey" FOREIGN KEY ("tenantId", "consumerId", "consumerAccountReviewReceiptId", "reviewSeriesKey", "reviewVersion", "reviewState", "receiptSourceSetSha256", "bureau", "accountId", "reportVersionAccountId") REFERENCES "ConsumerAccountReviewReceipt"("tenantId", "consumerId", "id", "reviewSeriesKey", "version", "reviewState", "sourceSetSha256", "bureau", "accountId", "reportVersionAccountId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "CaseActionDecision" ADD CONSTRAINT "CaseActionDecision_case_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId") REFERENCES "DisputeCase"("tenantId", "consumerId", "reportVersionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CaseActionDecision" ADD CONSTRAINT "case_action_decision_supersession_fkey" FOREIGN KEY ("tenantId", "consumerId", "decisionSeriesKey", "supersedesDecisionId") REFERENCES "CaseActionDecision"("tenantId", "consumerId", "decisionSeriesKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "CaseActionSourceRef" ADD CONSTRAINT "case_action_source_decision_fkey" FOREIGN KEY ("tenantId", "consumerId", "reportVersionId", "caseId", "decisionId") REFERENCES "CaseActionDecision"("tenantId", "consumerId", "reportVersionId", "caseId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "P0SensitiveAccessEvent" ADD CONSTRAINT "P0SensitiveAccessEvent_tenantId_consumerId_fkey" FOREIGN KEY ("tenantId", "consumerId") REFERENCES "CreditTruthScope"("tenantId", "consumerId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Validate an optional old-runtime-compatible extraction input whenever present.
CREATE FUNCTION p0_2a_validate_extraction_input()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  input_artifact "Artifact"%ROWTYPE;
BEGIN
  IF NEW."inputArtifactId" IS NULL
     AND NEW."inputSha256" IS NULL
     AND NEW."inputRepresentation" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."inputArtifactId" IS NULL
     OR NEW."inputSha256" IS NULL
     OR NEW."inputRepresentation" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'extraction input binding must be all-or-none';
  END IF;

  SELECT * INTO input_artifact
  FROM "Artifact"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "id" = NEW."inputArtifactId"
    AND "sha256" = NEW."inputSha256"
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact extraction input artifact';
  END IF;

  IF input_artifact."reportVersionId" IS DISTINCT FROM NEW."reportVersionId" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'extraction input artifact report mismatch';
  END IF;

  IF NEW."inputRepresentation" = 'ORIGINAL_REPORT_BYTES'
     AND input_artifact."kind" <> 'REPORT_SOURCE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'original extraction input must be a report source artifact';
  END IF;

  IF NEW."inputRepresentation" = 'DERIVED_NORMALIZED_TEXT'
     AND (input_artifact."kind" <> 'OTHER' OR input_artifact."mimeType" <> 'text/plain') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'normalized extraction input must be an exact text artifact';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ExtractionRun_input_artifact_trg"
BEFORE INSERT ON "ExtractionRun"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_extraction_input();

-- Exact-input parser-v2 runs must always attest score-model presence separately
-- from score presence. Nullable columns preserve old rows/manual runtime, but a
-- trusted Phase 2A writer cannot omit the new metadata contract.
CREATE FUNCTION p0_2a_validate_score_model_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  exact_input BOOLEAN := FALSE;
  run_status "ExtractionRunStatus";
  run_engine TEXT;
  run_engine_version TEXT;
  new_model_tuple_supplied BOOLEAN;
BEGIN
  IF NEW."sourceType" <> 'REPORT_DERIVED' OR NEW."extractionRunId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    (
      run."inputArtifactId" IS NOT NULL
      AND run."inputSha256" IS NOT NULL
      AND run."inputRepresentation" IS NOT NULL
    ),
    run."status",
    run."engine"::TEXT,
    run."engineVersion"
    INTO exact_input, run_status, run_engine, run_engine_version
  FROM "ExtractionRun" run
  WHERE run."tenantId" = NEW."tenantId"
    AND run."consumerId" = NEW."consumerId"
    AND run."reportVersionId" = NEW."reportVersionId"
    AND run."id" = NEW."extractionRunId"
  FOR KEY SHARE;

  new_model_tuple_supplied := NEW."scoreModelPresence" IS NOT NULL
    OR NEW."scoreModelEvidenceValue" IS NOT NULL
    OR NEW."scoreModelSourceLocatorToken" IS NOT NULL;

  IF NOT exact_input AND new_model_tuple_supplied THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'new score-model evidence requires an exact bound extraction input';
  END IF;

  IF exact_input
     AND new_model_tuple_supplied
     AND NEW."scoreModelVersion" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'exact score-model evidence cannot invent a legacy model version';
  END IF;

  IF exact_input
     AND new_model_tuple_supplied
     AND NEW."coverageStatus" <> 'COVERED' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Phase 2A score-model evidence cannot attach to an outside-coverage bureau';
  END IF;

  IF exact_input
     AND new_model_tuple_supplied
     AND (
       NEW."sourceMethodKey" IS DISTINCT FROM run_engine
       OR NEW."sourceMethodVersion" IS DISTINCT FROM run_engine_version
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Phase 2A score-model evidence must preserve exact extraction engine provenance';
  END IF;

  IF exact_input
     AND new_model_tuple_supplied
     AND run_status = 'FAILED'
     AND (
       NEW."presence" <> 'UNKNOWN'
       OR NEW."scoreModelPresence" IS DISTINCT FROM 'UNKNOWN'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'failed extraction may persist only unknown score and score-model evidence';
  END IF;

  IF exact_input AND new_model_tuple_supplied AND (
    NEW."scoreModelPresence" IS NULL
    OR (
      NEW."scoreModelPresence" = 'PRESENT'
      AND (
        NEW."scoreModelEvidenceValue" IS NULL
        OR NEW."scoreModelSourceLocatorToken" IS NULL
      )
    )
    OR (
      NEW."scoreModelPresence" = 'NOT_PROVIDED'
      AND (
        NEW."scoreModelEvidenceValue" IS NOT NULL
        OR NEW."scoreModelSourceLocatorToken" IS NULL
      )
    )
    OR (
      NEW."scoreModelPresence" = 'UNKNOWN'
      AND (
        NEW."scoreModelEvidenceValue" IS NOT NULL
        OR NEW."scoreModelSourceLocatorToken" IS NOT NULL
      )
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'exact-input report score requires explicit independent score-model evidence';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CreditScoreObservation_model_evidence_trg"
BEFORE INSERT ON "CreditScoreObservation"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_score_model_evidence();

CREATE FUNCTION p0_2a_validate_bureau_report_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_run "ExtractionRun"%ROWTYPE;
BEGIN
  SELECT * INTO linked_run
  FROM "ExtractionRun"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "id" = NEW."extractionRunId"
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact extraction for bureau report date';
  END IF;

  IF linked_run."inputArtifactId" IS NULL
     OR linked_run."inputSha256" IS NULL
     OR linked_run."inputRepresentation" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'bureau report-date evidence requires exact bound extraction input';
  END IF;

  IF linked_run."status" = 'FAILED' AND NEW."presence" <> 'UNKNOWN' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'failed extraction may persist only unknown bureau report-date evidence';
  END IF;

  IF NEW."coverageStatus" <> 'COVERED' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Phase 2A bureau report-date evidence cannot attach to an outside-coverage bureau';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "BureauReportDateEvidence_validate_trg"
BEFORE INSERT ON "BureauReportDateEvidence"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_bureau_report_date();

CREATE FUNCTION p0_2a_validate_h1_run_metadata_deferred()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  phase2_manifest_exists BOOLEAN;
  coverage_count INTEGER;
  equifax_coverage_count INTEGER;
  experian_coverage_count INTEGER;
  transunion_coverage_count INTEGER;
BEGIN
  IF NEW."extractionRunId" IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    EXISTS (
      SELECT 1
      FROM "BureauReportDateEvidence" report_date
      WHERE report_date."tenantId" = NEW."tenantId"
        AND report_date."consumerId" = NEW."consumerId"
        AND report_date."reportVersionId" = NEW."reportVersionId"
        AND report_date."extractionRunId" = NEW."extractionRunId"
    )
    OR EXISTS (
      SELECT 1
      FROM "Round0SourceCompletenessEvidence" completeness
      WHERE completeness."tenantId" = NEW."tenantId"
        AND completeness."consumerId" = NEW."consumerId"
        AND completeness."reportVersionId" = NEW."reportVersionId"
        AND completeness."extractionRunId" = NEW."extractionRunId"
    )
    OR EXISTS (
      SELECT 1
      FROM "IdentityBaseline" baseline
      WHERE baseline."tenantId" = NEW."tenantId"
        AND baseline."consumerId" = NEW."consumerId"
        AND baseline."reportVersionId" = NEW."reportVersionId"
        AND baseline."extractionRunId" = NEW."extractionRunId"
    )
    OR EXISTS (
      SELECT 1
      FROM "CreditScoreObservation" score
      WHERE score."tenantId" = NEW."tenantId"
        AND score."consumerId" = NEW."consumerId"
        AND score."reportVersionId" = NEW."reportVersionId"
        AND score."extractionRunId" = NEW."extractionRunId"
        AND score."sourceType" = 'REPORT_DERIVED'
        AND score."scoreModelPresence" IS NOT NULL
    )
    INTO phase2_manifest_exists;

  IF NOT phase2_manifest_exists THEN
    RETURN NULL;
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE coverage."bureau" = 'EQUIFAX'),
    count(*) FILTER (WHERE coverage."bureau" = 'EXPERIAN'),
    count(*) FILTER (WHERE coverage."bureau" = 'TRANSUNION')
    INTO coverage_count, equifax_coverage_count,
      experian_coverage_count, transunion_coverage_count
  FROM "ExtractionBureauCoverage" coverage
  WHERE coverage."tenantId" = NEW."tenantId"
    AND coverage."consumerId" = NEW."consumerId"
    AND coverage."reportVersionId" = NEW."reportVersionId"
    AND coverage."extractionRunId" = NEW."extractionRunId";

  IF coverage_count <> 3
     OR equifax_coverage_count <> 1
     OR experian_coverage_count <> 1
     OR transunion_coverage_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Phase 2A H1 metadata requires the exact three-bureau coverage manifest';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "BureauReportDateEvidence" report_date
    JOIN "ExtractionBureauCoverage" coverage
      ON coverage."tenantId" = report_date."tenantId"
     AND coverage."consumerId" = report_date."consumerId"
     AND coverage."reportVersionId" = report_date."reportVersionId"
     AND coverage."extractionRunId" = report_date."extractionRunId"
     AND coverage."bureau" = report_date."bureau"
     AND coverage."id" = report_date."bureauCoverageId"
    WHERE report_date."tenantId" = NEW."tenantId"
      AND report_date."consumerId" = NEW."consumerId"
      AND report_date."reportVersionId" = NEW."reportVersionId"
      AND report_date."extractionRunId" = NEW."extractionRunId"
      AND coverage."coverageStatus" <> 'COVERED'
  ) OR EXISTS (
    SELECT 1
    FROM "ExtractionBureauCoverage" coverage
    WHERE coverage."tenantId" = NEW."tenantId"
      AND coverage."consumerId" = NEW."consumerId"
      AND coverage."reportVersionId" = NEW."reportVersionId"
      AND coverage."extractionRunId" = NEW."extractionRunId"
      AND coverage."coverageStatus" = 'COVERED'
      AND (
        SELECT count(*)
        FROM "BureauReportDateEvidence" report_date
        WHERE report_date."tenantId" = coverage."tenantId"
          AND report_date."consumerId" = coverage."consumerId"
          AND report_date."reportVersionId" = coverage."reportVersionId"
          AND report_date."extractionRunId" = coverage."extractionRunId"
          AND report_date."bureau" = coverage."bureau"
          AND report_date."bureauCoverageId" = coverage."id"
      ) <> 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Phase 2A H1 metadata requires exactly one date evidence row for each covered bureau and none outside coverage';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "CreditScoreObservation" score
    WHERE score."tenantId" = NEW."tenantId"
      AND score."consumerId" = NEW."consumerId"
      AND score."reportVersionId" = NEW."reportVersionId"
      AND score."extractionRunId" = NEW."extractionRunId"
      AND score."sourceType" = 'REPORT_DERIVED'
      AND score."coverageStatus" <> 'COVERED'
  ) OR EXISTS (
    SELECT 1
    FROM "ExtractionBureauCoverage" coverage
    WHERE coverage."tenantId" = NEW."tenantId"
      AND coverage."consumerId" = NEW."consumerId"
      AND coverage."reportVersionId" = NEW."reportVersionId"
      AND coverage."extractionRunId" = NEW."extractionRunId"
      AND coverage."coverageStatus" = 'COVERED'
      AND NOT EXISTS (
        SELECT 1
        FROM "CreditScoreObservation" score
        WHERE score."tenantId" = coverage."tenantId"
          AND score."consumerId" = coverage."consumerId"
          AND score."reportVersionId" = coverage."reportVersionId"
          AND score."extractionRunId" = coverage."extractionRunId"
          AND score."bureau" = coverage."bureau"
          AND score."bureauCoverageId" = coverage."id"
          AND score."sourceType" = 'REPORT_DERIVED'
        GROUP BY score."tenantId", score."consumerId", score."reportVersionId",
          score."extractionRunId", score."bureau", score."bureauCoverageId"
        HAVING (
          count(*) FILTER (WHERE score."presence" = 'SCORE_REPORTED') >= 1
          AND count(*) FILTER (WHERE score."presence" <> 'SCORE_REPORTED') = 0
        ) OR (
          count(*) = 1
          AND count(*) FILTER (
            WHERE score."presence" IN ('SCORE_NOT_PROVIDED', 'UNKNOWN')
              AND score."occurrence" = 0
          ) = 1
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Phase 2A H1 metadata requires an explicit score set or one uncertainty/absence sentinel for each covered bureau and none outside coverage';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "CreditScoreObservation" score
    WHERE score."tenantId" = NEW."tenantId"
      AND score."consumerId" = NEW."consumerId"
      AND score."reportVersionId" = NEW."reportVersionId"
      AND score."extractionRunId" = NEW."extractionRunId"
      AND score."sourceType" = 'REPORT_DERIVED'
      AND score."scoreModelPresence" IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Phase 2A metadata run cannot omit independent score-model evidence';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "BureauReportDateEvidence_h1_run_metadata_deferred_trg"
AFTER INSERT ON "BureauReportDateEvidence"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_h1_run_metadata_deferred();

CREATE CONSTRAINT TRIGGER "IdentityBaseline_h1_run_metadata_deferred_trg"
AFTER INSERT ON "IdentityBaseline"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_h1_run_metadata_deferred();

CREATE CONSTRAINT TRIGGER "Round0SourceCompletenessEvidence_h1_run_metadata_deferred_trg"
AFTER INSERT ON "Round0SourceCompletenessEvidence"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_h1_run_metadata_deferred();

CREATE CONSTRAINT TRIGGER "CreditScoreObservation_h1_run_metadata_deferred_trg"
AFTER INSERT ON "CreditScoreObservation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_h1_run_metadata_deferred();

CREATE FUNCTION p0_2a_validate_round0_source_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_run "ExtractionRun"%ROWTYPE;
BEGIN
  PERFORM 1
  FROM "ReportVersion"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "id" = NEW."reportVersionId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact report version for Round 0 source completeness';
  END IF;

  SELECT * INTO linked_run
  FROM "ExtractionRun"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "id" = NEW."extractionRunId"
  FOR KEY SHARE;

  IF NOT FOUND
     OR linked_run."inputArtifactId" IS NULL
     OR linked_run."inputSha256" IS NULL
     OR linked_run."inputRepresentation" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Round 0 completeness requires exact extraction input';
  END IF;

  IF linked_run."status" = 'FAILED' THEN
    IF NEW."identityBaselineId" IS NOT NULL
       OR NEW."baselineInputSetSha256" IS NOT NULL
       OR NEW."status" IN ('COMPLETE', 'PARTIAL')
       OR NEW."sourceMemberCount" <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'failed extraction completeness must remain unbound, non-affirmative, and empty';
    END IF;
  ELSIF NEW."identityBaselineId" IS NULL
     OR NEW."baselineInputSetSha256" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'succeeded or partial extraction completeness requires the exact draft source baseline seal';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Round0SourceCompletenessEvidence_validate_trg"
BEFORE INSERT ON "Round0SourceCompletenessEvidence"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_round0_source_completeness();

CREATE FUNCTION p0_2a_validate_identity_baseline_source_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_run "ExtractionRun"%ROWTYPE;
  linked_ingestion "ReportIngestion"%ROWTYPE;
  original_source_artifact "Artifact"%ROWTYPE;
BEGIN
  IF NEW."status" = 'CONFIRMED' AND (
    NEW."extractionRunId" IS NULL
    OR NEW."sourceIdentityBaselineId" IS NULL
    OR NEW."supersedesIdentityBaselineId" IS NULL
    OR NEW."semanticSha256" IS NULL
    OR NEW."expectedIdentityFactCount" IS NULL
    OR NEW."expectedCategoryCompletionCount" IS NULL
    OR NEW."expectedAccountReviewReceiptCount" IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'new confirmed identity baseline requires the full Phase 2A confirmation seal';
  END IF;

  IF NEW."extractionRunId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."reportIngestionId" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity source-set seal requires exact report ingestion authority';
  END IF;

  SELECT * INTO linked_run
  FROM "ExtractionRun"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "id" = NEW."extractionRunId"
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact extraction for identity source-set seal';
  END IF;

  IF linked_run."inputArtifactId" IS NULL
     OR linked_run."inputSha256" IS NULL
     OR linked_run."inputRepresentation" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity source-set seal requires exact extraction input';
  END IF;

  SELECT * INTO linked_ingestion
  FROM "ReportIngestion" ingestion
  WHERE ingestion."tenantId" = NEW."tenantId"
    AND ingestion."consumerId" = NEW."consumerId"
    AND ingestion."reportVersionId" = NEW."reportVersionId"
    AND ingestion."id" = NEW."reportIngestionId"
  FOR KEY SHARE;

  IF NOT FOUND
     OR linked_ingestion."sourceDisposition" <> 'RETAINED'
     OR linked_ingestion."sourceArtifactId" IS NULL
     OR linked_ingestion."sourceReadbackSha256" IS DISTINCT FROM linked_ingestion."sourceSha256"
     OR linked_ingestion."sourceReadbackByteLength" IS DISTINCT FROM linked_ingestion."sourceByteLength"
     OR linked_ingestion."sourceVerifiedAt" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity source-set seal requires verified retained original report ingestion truth';
  END IF;

  IF NOT (
    (
      NEW."status" = 'DRAFT'
      AND linked_ingestion."state" = 'EXTRACTING'
      AND linked_ingestion."extractionRunId" IS NULL
    )
    OR (
      NEW."status" = 'CONFIRMED'
      AND linked_ingestion."state" = 'ROUND0_READY'
      AND linked_ingestion."extractionRunId" IS NOT DISTINCT FROM NEW."extractionRunId"
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity source-set seal ingestion chronology does not match draft persistence or confirmed readiness';
  END IF;

  SELECT * INTO original_source_artifact
  FROM "Artifact" artifact
  WHERE artifact."tenantId" = linked_ingestion."tenantId"
    AND artifact."consumerId" = linked_ingestion."consumerId"
    AND artifact."reportVersionId" = linked_ingestion."reportVersionId"
    AND artifact."id" = linked_ingestion."sourceArtifactId"
    AND artifact."sha256" = linked_ingestion."sourceSha256"
  FOR KEY SHARE;

  IF NOT FOUND
     OR original_source_artifact."kind" <> 'REPORT_SOURCE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity source-set seal requires exact original report source artifact';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "IdentityBaseline_source_seal_trg"
BEFORE INSERT ON "IdentityBaseline"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_identity_baseline_source_seal();

-- Exact membership and the 3-bureau x 9-category manifest are transaction-end
-- constraints. This permits either baseline -> members -> completeness or
-- completeness -> baseline -> members inside one atomic write without allowing
-- a partially sealed source set to commit.
CREATE FUNCTION p0_2a_validate_round0_source_seal_deferred()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actual_member_count INTEGER;
  coverage_count INTEGER;
  equifax_coverage_count INTEGER;
  experian_coverage_count INTEGER;
  transunion_coverage_count INTEGER;
  evidence_count INTEGER;
  equifax_evidence_count INTEGER;
  experian_evidence_count INTEGER;
  transunion_evidence_count INTEGER;
  category_count INTEGER;
  source_baseline_id TEXT;
  source_baseline_digest VARCHAR(64);
  source_baseline "IdentityBaseline"%ROWTYPE;
  predecessor_baseline "IdentityBaseline"%ROWTYPE;
  source_fact_count INTEGER;
  confirmed_fact_count INTEGER;
  category_completion_count INTEGER;
  account_review_membership_count INTEGER;
  source_category_fact_count INTEGER;
  confirmed_category_fact_count INTEGER;
  category_slot_completion_count INTEGER;
  source_account_member_count INTEGER;
  account_slot_completion_count INTEGER;
  minimum_membership_ordinal INTEGER;
  maximum_membership_ordinal INTEGER;
  category_key "IdentityReviewCategory";
  membership_row "IdentityBaselineAccountReviewMembership"%ROWTYPE;
  receipt_row "ConsumerAccountReviewReceipt"%ROWTYPE;
  source_run_status "ExtractionRunStatus";
BEGIN
  IF TG_ARGV[0] = 'MEMBERSHIP' THEN
    IF NEW."identityBaselineId" IS NULL THEN
      IF NEW."baselineInputSetSha256" IS NOT NULL
         OR NEW."sourceMemberCount" <> 0 THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unbound failed completeness cannot claim source membership';
      END IF;
      RETURN NULL;
    END IF;

    IF NEW."category" = 'UNRECOGNIZED_ACCOUNT' THEN
      SELECT count(*) INTO actual_member_count
      FROM "AccountPresenceObservation" presence
      JOIN "ReportVersionAccount" report_account
        ON report_account."tenantId" = presence."tenantId"
       AND report_account."consumerId" = presence."consumerId"
       AND report_account."reportVersionId" = presence."reportVersionId"
       AND report_account."accountId" = presence."accountId"
      WHERE presence."tenantId" = NEW."tenantId"
        AND presence."consumerId" = NEW."consumerId"
        AND presence."reportVersionId" = NEW."reportVersionId"
        AND presence."extractionRunId" = NEW."extractionRunId"
        AND presence."bureau" = NEW."bureau"
        AND presence."presence" IN ('PRESENT', 'UNKNOWN')
        AND report_account."membershipOrigin" = 'SOURCE_LISTED'
        AND report_account."authorityStatus" <> 'LEGACY_UNVERIFIED';
    ELSE
      SELECT count(*) INTO actual_member_count
      FROM "IdentityFact" fact
      WHERE fact."tenantId" = NEW."tenantId"
        AND fact."consumerId" = NEW."consumerId"
        AND fact."reportVersionId" = NEW."reportVersionId"
        AND fact."extractionRunId" = NEW."extractionRunId"
        AND fact."identityBaselineId" = NEW."identityBaselineId"
        AND fact."baselineInputSetSha256" = NEW."baselineInputSetSha256"
        AND fact."bureau" = NEW."bureau"
        AND fact."reviewCategory" = NEW."category"
        AND fact."integritySha256" IS NOT NULL
        AND fact."baselineInputSetSha256" IS NOT NULL;
    END IF;

    IF NEW."sourceMemberCount" <> actual_member_count THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Round 0 completeness member count does not match exact durable source membership';
    END IF;

    RETURN NULL;
  END IF;

  IF TG_ARGV[0] = 'MANIFEST' THEN
    IF TG_TABLE_NAME = 'IdentityBaseline' AND NEW."extractionRunId" IS NULL THEN
      IF NEW."sourceIdentityBaselineId" IS NOT NULL
         OR NEW."supersedesIdentityBaselineId" IS NOT NULL
         OR NEW."semanticSha256" IS NOT NULL
         OR NEW."expectedIdentityFactCount" IS NOT NULL
         OR NEW."expectedCategoryCompletionCount" IS NOT NULL
         OR NEW."expectedAccountReviewReceiptCount" IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity baseline seal requires exact extraction authority';
      END IF;
      RETURN NULL;
    END IF;

    IF TG_TABLE_NAME = 'Round0SourceCompletenessEvidence' THEN
      IF NEW."identityBaselineId" IS NULL THEN
      SELECT run."status" INTO source_run_status
      FROM "ExtractionRun" run
      WHERE run."tenantId" = NEW."tenantId"
        AND run."consumerId" = NEW."consumerId"
        AND run."reportVersionId" = NEW."reportVersionId"
        AND run."id" = NEW."extractionRunId"
      FOR KEY SHARE;

      IF source_run_status IS DISTINCT FROM 'FAILED'
         OR NEW."baselineInputSetSha256" IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'only a failed extraction may persist unbound Round 0 completeness';
      END IF;

      SELECT
        count(*),
        count(*) FILTER (WHERE coverage."bureau" = 'EQUIFAX'),
        count(*) FILTER (WHERE coverage."bureau" = 'EXPERIAN'),
        count(*) FILTER (WHERE coverage."bureau" = 'TRANSUNION')
        INTO coverage_count, equifax_coverage_count,
          experian_coverage_count, transunion_coverage_count
      FROM "ExtractionBureauCoverage" coverage
      WHERE coverage."tenantId" = NEW."tenantId"
        AND coverage."consumerId" = NEW."consumerId"
        AND coverage."reportVersionId" = NEW."reportVersionId"
        AND coverage."extractionRunId" = NEW."extractionRunId";

      SELECT
        count(*),
        count(*) FILTER (WHERE evidence."bureau" = 'EQUIFAX'),
        count(*) FILTER (WHERE evidence."bureau" = 'EXPERIAN'),
        count(*) FILTER (WHERE evidence."bureau" = 'TRANSUNION'),
        count(DISTINCT evidence."category")
        INTO evidence_count, equifax_evidence_count,
          experian_evidence_count, transunion_evidence_count, category_count
      FROM "Round0SourceCompletenessEvidence" evidence
      WHERE evidence."tenantId" = NEW."tenantId"
        AND evidence."consumerId" = NEW."consumerId"
        AND evidence."reportVersionId" = NEW."reportVersionId"
        AND evidence."extractionRunId" = NEW."extractionRunId"
        AND evidence."identityBaselineId" IS NULL
        AND evidence."baselineInputSetSha256" IS NULL;

      IF coverage_count <> 3
         OR equifax_coverage_count <> 1
         OR experian_coverage_count <> 1
         OR transunion_coverage_count <> 1
         OR evidence_count <> 27
         OR equifax_evidence_count <> 9
         OR experian_evidence_count <> 9
         OR transunion_evidence_count <> 9
         OR category_count <> 9
         OR EXISTS (
           SELECT 1
           FROM "Round0SourceCompletenessEvidence" evidence
           WHERE evidence."tenantId" = NEW."tenantId"
             AND evidence."consumerId" = NEW."consumerId"
             AND evidence."reportVersionId" = NEW."reportVersionId"
             AND evidence."extractionRunId" = NEW."extractionRunId"
             AND (
               evidence."identityBaselineId" IS NOT NULL
               OR evidence."baselineInputSetSha256" IS NOT NULL
               OR evidence."status" IN ('COMPLETE', 'PARTIAL')
               OR evidence."sourceMemberCount" <> 0
             )
         ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'failed Round 0 completeness requires an exact unbound 3-bureau by 9-category non-affirmative manifest';
      END IF;

        RETURN NULL;
      END IF;
    END IF;

    IF TG_TABLE_NAME = 'Round0SourceCompletenessEvidence' THEN
      source_baseline_id := NEW."identityBaselineId";
      source_baseline_digest := NEW."baselineInputSetSha256";
    ELSIF NEW."status" = 'DRAFT' THEN
      source_baseline_id := NEW."id";
      source_baseline_digest := NEW."inputSetSha256";
    ELSIF NEW."status" = 'CONFIRMED' THEN
      source_baseline_id := NEW."sourceIdentityBaselineId";
      source_baseline_digest := NEW."inputSetSha256";
    ELSE
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'exact-input identity baseline must be draft source truth or a confirmed successor';
    END IF;

    SELECT * INTO source_baseline
    FROM "IdentityBaseline" baseline
    WHERE baseline."tenantId" = NEW."tenantId"
      AND baseline."consumerId" = NEW."consumerId"
      AND baseline."reportVersionId" = NEW."reportVersionId"
      AND baseline."extractionRunId" = NEW."extractionRunId"
      AND baseline."id" = source_baseline_id
      AND baseline."inputSetSha256" = source_baseline_digest
    FOR UPDATE;

    IF NOT FOUND OR source_baseline."status" <> 'DRAFT' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Round 0 completeness requires the exact draft source baseline';
    END IF;

    SELECT run."status" INTO source_run_status
    FROM "ExtractionRun" run
    WHERE run."tenantId" = NEW."tenantId"
      AND run."consumerId" = NEW."consumerId"
      AND run."reportVersionId" = NEW."reportVersionId"
      AND run."id" = NEW."extractionRunId"
    FOR KEY SHARE;

    IF source_run_status NOT IN ('SUCCEEDED', 'PARTIAL') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Round 0 source baseline requires a succeeded or partial extraction';
    END IF;

    SELECT
      count(*),
      count(*) FILTER (WHERE coverage."bureau" = 'EQUIFAX'),
      count(*) FILTER (WHERE coverage."bureau" = 'EXPERIAN'),
      count(*) FILTER (WHERE coverage."bureau" = 'TRANSUNION')
      INTO coverage_count, equifax_coverage_count,
        experian_coverage_count, transunion_coverage_count
    FROM "ExtractionBureauCoverage" coverage
    WHERE coverage."tenantId" = NEW."tenantId"
      AND coverage."consumerId" = NEW."consumerId"
      AND coverage."reportVersionId" = NEW."reportVersionId"
      AND coverage."extractionRunId" = NEW."extractionRunId";

    SELECT
      count(*),
      count(*) FILTER (WHERE evidence."bureau" = 'EQUIFAX'),
      count(*) FILTER (WHERE evidence."bureau" = 'EXPERIAN'),
      count(*) FILTER (WHERE evidence."bureau" = 'TRANSUNION'),
      count(DISTINCT evidence."category")
      INTO evidence_count, equifax_evidence_count,
        experian_evidence_count, transunion_evidence_count, category_count
    FROM "Round0SourceCompletenessEvidence" evidence
    WHERE evidence."tenantId" = NEW."tenantId"
      AND evidence."consumerId" = NEW."consumerId"
      AND evidence."reportVersionId" = NEW."reportVersionId"
      AND evidence."extractionRunId" = NEW."extractionRunId"
      AND evidence."identityBaselineId" = source_baseline_id
      AND evidence."baselineInputSetSha256" = source_baseline_digest;

    IF coverage_count <> 3
       OR equifax_coverage_count <> 1
       OR experian_coverage_count <> 1
       OR transunion_coverage_count <> 1
       OR evidence_count <> 27
       OR equifax_evidence_count <> 9
       OR experian_evidence_count <> 9
       OR transunion_evidence_count <> 9
       OR category_count <> 9 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Round 0 source seal requires the exact 3-bureau by 9-category completeness manifest';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "Round0SourceCompletenessEvidence" evidence
      WHERE evidence."tenantId" = NEW."tenantId"
        AND evidence."consumerId" = NEW."consumerId"
        AND evidence."reportVersionId" = NEW."reportVersionId"
        AND evidence."extractionRunId" = NEW."extractionRunId"
        AND (
          evidence."identityBaselineId" <> source_baseline_id
          OR evidence."baselineInputSetSha256" <> source_baseline_digest
        )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Round 0 run cannot split completeness across source baselines';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "IdentityFact" source_fact
      WHERE source_fact."tenantId" = NEW."tenantId"
        AND source_fact."consumerId" = NEW."consumerId"
        AND source_fact."reportVersionId" = NEW."reportVersionId"
        AND source_fact."extractionRunId" = NEW."extractionRunId"
        AND source_fact."identityBaselineId" = source_baseline_id
        AND source_fact."baselineInputSetSha256" = source_baseline_digest
        AND source_fact."reviewCategory" IS NOT NULL
        AND source_fact."classification" <> 'REVIEW_NEEDED'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'draft source baseline facts cannot contain consumer testimony';
    END IF;

    IF TG_TABLE_NAME = 'IdentityBaseline' THEN
      IF NEW."status" = 'CONFIRMED' THEN
      IF source_run_status <> 'SUCCEEDED' THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed Round 0 baseline requires a succeeded exact extraction';
      END IF;

      IF source_baseline."reportIngestionId" IS NULL
         OR source_baseline."reportIngestionId" <> NEW."reportIngestionId" THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity baseline must retain the original draft report ingestion authority';
      END IF;

      SELECT * INTO predecessor_baseline
      FROM "IdentityBaseline" predecessor
      WHERE predecessor."tenantId" = NEW."tenantId"
        AND predecessor."consumerId" = NEW."consumerId"
        AND predecessor."id" = NEW."supersedesIdentityBaselineId"
      FOR UPDATE;

      IF NOT FOUND
         OR predecessor_baseline."reportVersionId" <> NEW."reportVersionId"
         OR predecessor_baseline."extractionRunId" IS DISTINCT FROM NEW."extractionRunId"
         OR predecessor_baseline."baselineSeriesKey" <> NEW."baselineSeriesKey"
         OR predecessor_baseline."inputSetSha256" <> NEW."inputSetSha256"
         OR predecessor_baseline."reportIngestionId" IS DISTINCT FROM NEW."reportIngestionId"
         OR predecessor_baseline."version" <> NEW."version" - 1
         OR NOT (
           (
             predecessor_baseline."id" = source_baseline."id"
             AND predecessor_baseline."status" = 'DRAFT'
           )
           OR
           (
             predecessor_baseline."status" = 'CONFIRMED'
             AND predecessor_baseline."sourceIdentityBaselineId" = source_baseline."id"
           )
         ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity baseline must append from the exact current predecessor over the original draft source';
      END IF;

      SELECT count(*) INTO source_fact_count
      FROM "IdentityFact" source_fact
      WHERE source_fact."tenantId" = NEW."tenantId"
        AND source_fact."consumerId" = NEW."consumerId"
        AND source_fact."reportVersionId" = NEW."reportVersionId"
        AND source_fact."extractionRunId" = NEW."extractionRunId"
        AND source_fact."identityBaselineId" = source_baseline."id"
        AND source_fact."baselineInputSetSha256" = NEW."inputSetSha256";

      SELECT count(*) INTO confirmed_fact_count
      FROM "IdentityFact" confirmed_fact
      WHERE confirmed_fact."tenantId" = NEW."tenantId"
        AND confirmed_fact."consumerId" = NEW."consumerId"
        AND confirmed_fact."reportVersionId" = NEW."reportVersionId"
        AND confirmed_fact."extractionRunId" = NEW."extractionRunId"
        AND confirmed_fact."identityBaselineId" = NEW."id"
        AND confirmed_fact."baselineInputSetSha256" = NEW."inputSetSha256";

      IF source_fact_count <> NEW."expectedIdentityFactCount"
         OR confirmed_fact_count <> NEW."expectedIdentityFactCount" THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity baseline fact count does not match its exact source membership';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "IdentityFact" confirmed_fact
        LEFT JOIN "IdentityFact" source_fact
          ON source_fact."tenantId" = confirmed_fact."tenantId"
         AND source_fact."consumerId" = confirmed_fact."consumerId"
         AND source_fact."reportVersionId" = confirmed_fact."reportVersionId"
         AND source_fact."extractionRunId" = confirmed_fact."extractionRunId"
         AND source_fact."identityBaselineId" = source_baseline."id"
         AND source_fact."baselineInputSetSha256" = confirmed_fact."baselineInputSetSha256"
         AND source_fact."factSeriesKey" = confirmed_fact."factSeriesKey"
        WHERE confirmed_fact."tenantId" = NEW."tenantId"
          AND confirmed_fact."consumerId" = NEW."consumerId"
          AND confirmed_fact."reportVersionId" = NEW."reportVersionId"
          AND confirmed_fact."extractionRunId" = NEW."extractionRunId"
          AND confirmed_fact."identityBaselineId" = NEW."id"
          AND confirmed_fact."baselineInputSetSha256" = NEW."inputSetSha256"
          AND (
            source_fact."id" IS NULL
            OR source_fact."classification" <> 'REVIEW_NEEDED'
            OR ROW(
              confirmed_fact."factOrdinal", confirmed_fact."bureau",
              confirmed_fact."factType", confirmed_fact."reviewCategory",
              confirmed_fact."presence", confirmed_fact."valueCiphertext",
              confirmed_fact."valueIv", confirmed_fact."valueAuthTag",
              confirmed_fact."valueKeyVersion", confirmed_fact."valueAlgorithm",
              confirmed_fact."valueEnvelopeVersion", confirmed_fact."valueAadVersion",
              confirmed_fact."sourceLocatorToken", confirmed_fact."normalizationRuleKey",
              confirmed_fact."normalizationRuleVersion", confirmed_fact."integritySha256"
            ) IS DISTINCT FROM ROW(
              source_fact."factOrdinal", source_fact."bureau",
              source_fact."factType", source_fact."reviewCategory",
              source_fact."presence", source_fact."valueCiphertext",
              source_fact."valueIv", source_fact."valueAuthTag",
              source_fact."valueKeyVersion", source_fact."valueAlgorithm",
              source_fact."valueEnvelopeVersion", source_fact."valueAadVersion",
              source_fact."sourceLocatorToken", source_fact."normalizationRuleKey",
              source_fact."normalizationRuleVersion", source_fact."integritySha256"
            )
          )
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity fact does not exactly copy its unique draft source fact';
      END IF;

      FOREACH category_key IN ARRAY ARRAY[
        'LEGAL_NAME'::"IdentityReviewCategory",
        'ALIAS'::"IdentityReviewCategory",
        'CURRENT_ADDRESS'::"IdentityReviewCategory",
        'FORMER_ADDRESS'::"IdentityReviewCategory",
        'SAFE_IDENTIFIER'::"IdentityReviewCategory",
        'PHONE'::"IdentityReviewCategory",
        'EMPLOYMENT'::"IdentityReviewCategory",
        'MIXED_FILE_INDICATOR'::"IdentityReviewCategory"
      ] LOOP
        SELECT count(*) INTO source_category_fact_count
        FROM "IdentityFact" fact
        WHERE fact."tenantId" = NEW."tenantId"
          AND fact."consumerId" = NEW."consumerId"
          AND fact."reportVersionId" = NEW."reportVersionId"
          AND fact."extractionRunId" = NEW."extractionRunId"
          AND fact."identityBaselineId" = source_baseline."id"
          AND fact."baselineInputSetSha256" = NEW."inputSetSha256"
          AND fact."reviewCategory" = category_key;

        SELECT count(*) INTO confirmed_category_fact_count
        FROM "IdentityFact" fact
        WHERE fact."tenantId" = NEW."tenantId"
          AND fact."consumerId" = NEW."consumerId"
          AND fact."reportVersionId" = NEW."reportVersionId"
          AND fact."extractionRunId" = NEW."extractionRunId"
          AND fact."identityBaselineId" = NEW."id"
          AND fact."baselineInputSetSha256" = NEW."inputSetSha256"
          AND fact."reviewCategory" = category_key;

        SELECT count(*) INTO category_slot_completion_count
        FROM "IdentityCategoryCompletion" completion
        WHERE completion."tenantId" = NEW."tenantId"
          AND completion."consumerId" = NEW."consumerId"
          AND completion."reportVersionId" = NEW."reportVersionId"
          AND completion."extractionRunId" = NEW."extractionRunId"
          AND completion."identityBaselineId" = NEW."id"
          AND completion."identityBaselineVersion" = NEW."version"
          AND completion."baselineInputSetSha256" = NEW."inputSetSha256"
          AND completion."category" = category_key;

        IF (
          source_category_fact_count > 0
          AND (
            confirmed_category_fact_count <> source_category_fact_count
            OR category_slot_completion_count <> 0
          )
        ) OR (
          source_category_fact_count = 0
          AND (
            confirmed_category_fact_count <> 0
            OR category_slot_completion_count <> 1
          )
        ) THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity baseline must exactly resolve every identity category source slot';
        END IF;
      END LOOP;

      SELECT count(*) INTO category_completion_count
      FROM "IdentityCategoryCompletion" completion
      WHERE completion."tenantId" = NEW."tenantId"
        AND completion."consumerId" = NEW."consumerId"
        AND completion."reportVersionId" = NEW."reportVersionId"
        AND completion."extractionRunId" = NEW."extractionRunId"
        AND completion."identityBaselineId" = NEW."id"
        AND completion."identityBaselineVersion" = NEW."version"
        AND completion."baselineInputSetSha256" = NEW."inputSetSha256";

      IF category_completion_count <> NEW."expectedCategoryCompletionCount" THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity baseline category-completion count mismatch';
      END IF;

      SELECT count(*) INTO account_review_membership_count
      FROM "IdentityBaselineAccountReviewMembership" membership
      WHERE membership."tenantId" = NEW."tenantId"
        AND membership."consumerId" = NEW."consumerId"
        AND membership."reportVersionId" = NEW."reportVersionId"
        AND membership."extractionRunId" = NEW."extractionRunId"
        AND membership."confirmedIdentityBaselineId" = NEW."id"
        AND membership."confirmedIdentityBaselineVersion" = NEW."version"
        AND membership."confirmedBaselineInputSetSha256" = NEW."inputSetSha256";

      IF account_review_membership_count <> NEW."expectedAccountReviewReceiptCount" THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity baseline account-review receipt count mismatch';
      END IF;

      SELECT coalesce(sum(evidence."sourceMemberCount"), 0)::INTEGER
        INTO source_account_member_count
      FROM "Round0SourceCompletenessEvidence" evidence
      WHERE evidence."tenantId" = NEW."tenantId"
        AND evidence."consumerId" = NEW."consumerId"
        AND evidence."reportVersionId" = NEW."reportVersionId"
        AND evidence."extractionRunId" = NEW."extractionRunId"
        AND evidence."identityBaselineId" = source_baseline."id"
        AND evidence."baselineInputSetSha256" = NEW."inputSetSha256"
        AND evidence."category" = 'UNRECOGNIZED_ACCOUNT';

      SELECT count(*) INTO account_slot_completion_count
      FROM "IdentityCategoryCompletion" completion
      WHERE completion."tenantId" = NEW."tenantId"
        AND completion."consumerId" = NEW."consumerId"
        AND completion."reportVersionId" = NEW."reportVersionId"
        AND completion."extractionRunId" = NEW."extractionRunId"
        AND completion."identityBaselineId" = NEW."id"
        AND completion."identityBaselineVersion" = NEW."version"
        AND completion."baselineInputSetSha256" = NEW."inputSetSha256"
        AND completion."category" = 'UNRECOGNIZED_ACCOUNT';

      IF (
        source_account_member_count > 0
        AND (
          account_review_membership_count <> source_account_member_count
          OR account_slot_completion_count <> 0
        )
      ) OR (
        source_account_member_count = 0
        AND (
          account_review_membership_count <> 0
          OR account_slot_completion_count <> 1
        )
      ) OR NEW."expectedAccountReviewReceiptCount" <> source_account_member_count THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity baseline must exactly resolve the account-index source slot';
      END IF;

      SELECT min(membership."ordinal"), max(membership."ordinal")
        INTO minimum_membership_ordinal, maximum_membership_ordinal
      FROM "IdentityBaselineAccountReviewMembership" membership
      WHERE membership."tenantId" = NEW."tenantId"
        AND membership."consumerId" = NEW."consumerId"
        AND membership."confirmedIdentityBaselineId" = NEW."id";

      IF account_review_membership_count > 0
         AND (
           minimum_membership_ordinal <> 0
           OR maximum_membership_ordinal <> account_review_membership_count - 1
         ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed account-review membership ordinals must be contiguous from zero';
      END IF;

      FOR membership_row IN
        SELECT membership.*
        FROM "IdentityBaselineAccountReviewMembership" membership
        WHERE membership."tenantId" = NEW."tenantId"
          AND membership."consumerId" = NEW."consumerId"
          AND membership."confirmedIdentityBaselineId" = NEW."id"
        ORDER BY membership."ordinal"
      LOOP
        SELECT * INTO receipt_row
        FROM "ConsumerAccountReviewReceipt" receipt
        WHERE receipt."tenantId" = membership_row."tenantId"
          AND receipt."consumerId" = membership_row."consumerId"
          AND receipt."id" = membership_row."consumerAccountReviewReceiptId"
          AND receipt."reviewSeriesKey" = membership_row."reviewSeriesKey"
          AND receipt."version" = membership_row."reviewVersion"
          AND receipt."reviewState" = membership_row."reviewState"
          AND receipt."sourceSetSha256" = membership_row."receiptSourceSetSha256"
          AND receipt."bureau" = membership_row."bureau"
          AND receipt."accountId" = membership_row."accountId"
          AND receipt."reportVersionAccountId" = membership_row."reportVersionAccountId"
        FOR UPDATE;

        IF NOT FOUND
           OR receipt_row."identityBaselineId" <> source_baseline."id"
           OR receipt_row."baselineInputSetSha256" <> NEW."inputSetSha256"
           OR receipt_row."extractionRunId" <> NEW."extractionRunId"
           OR receipt_row."reviewState" = 'REVOKED'
           OR EXISTS (
             SELECT 1
             FROM "ConsumerAccountReviewReceipt" successor
             WHERE successor."tenantId" = receipt_row."tenantId"
               AND successor."consumerId" = receipt_row."consumerId"
               AND successor."reviewSeriesKey" = receipt_row."reviewSeriesKey"
               AND successor."supersedesReviewId" = receipt_row."id"
           ) THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed identity baseline requires exact current-head account-review receipts';
        END IF;
      END LOOP;
      END IF;
    END IF;

    RETURN NULL;
  END IF;

  IF TG_ARGV[0] = 'REVERSE' THEN
    IF TG_TABLE_NAME = 'IdentityFact' THEN
      IF NEW."reviewCategory" IS NOT NULL AND EXISTS (
        SELECT 1
        FROM "Round0SourceCompletenessEvidence" completeness
        WHERE completeness."tenantId" = NEW."tenantId"
          AND completeness."consumerId" = NEW."consumerId"
          AND completeness."reportVersionId" = NEW."reportVersionId"
          AND completeness."extractionRunId" = NEW."extractionRunId"
          AND completeness."identityBaselineId" = NEW."identityBaselineId"
          AND completeness."baselineInputSetSha256" = NEW."baselineInputSetSha256"
          AND completeness."bureau" = NEW."bureau"
          AND completeness."category" = NEW."reviewCategory"
          AND completeness."sourceMemberCount" < (
            SELECT count(*)
            FROM "IdentityFact" fact
            WHERE fact."tenantId" = completeness."tenantId"
              AND fact."consumerId" = completeness."consumerId"
              AND fact."reportVersionId" = completeness."reportVersionId"
              AND fact."extractionRunId" = completeness."extractionRunId"
              AND fact."identityBaselineId" = completeness."identityBaselineId"
              AND fact."baselineInputSetSha256" = completeness."baselineInputSetSha256"
              AND fact."bureau" = completeness."bureau"
              AND fact."reviewCategory" = completeness."category"
              AND fact."integritySha256" IS NOT NULL
          )
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity source membership exceeds the sealed exact run bureau and category count';
      END IF;
    ELSIF TG_TABLE_NAME = 'AccountPresenceObservation' THEN
      IF EXISTS (
        SELECT 1
        FROM "Round0SourceCompletenessEvidence" completeness
        WHERE completeness."tenantId" = NEW."tenantId"
          AND completeness."consumerId" = NEW."consumerId"
          AND completeness."reportVersionId" = NEW."reportVersionId"
          AND completeness."extractionRunId" = NEW."extractionRunId"
          AND completeness."bureau" = NEW."bureau"
          AND completeness."category" = 'UNRECOGNIZED_ACCOUNT'
          AND completeness."identityBaselineId" IS NOT NULL
          AND completeness."sourceMemberCount" < (
            SELECT count(*)
            FROM "AccountPresenceObservation" presence
            JOIN "ReportVersionAccount" report_account
              ON report_account."tenantId" = presence."tenantId"
             AND report_account."consumerId" = presence."consumerId"
             AND report_account."reportVersionId" = presence."reportVersionId"
             AND report_account."accountId" = presence."accountId"
            WHERE presence."tenantId" = completeness."tenantId"
              AND presence."consumerId" = completeness."consumerId"
              AND presence."reportVersionId" = completeness."reportVersionId"
              AND presence."extractionRunId" = completeness."extractionRunId"
              AND presence."bureau" = completeness."bureau"
              AND presence."presence" IN ('PRESENT', 'UNKNOWN')
              AND report_account."membershipOrigin" = 'SOURCE_LISTED'
              AND report_account."authorityStatus" <> 'LEGACY_UNVERIFIED'
          )
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account-index source membership exceeds the sealed exact run and bureau count';
      END IF;
    ELSIF TG_TABLE_NAME = 'ReportVersionAccount' THEN
      IF NEW."membershipOrigin" = 'SOURCE_LISTED' AND (
        EXISTS (
          SELECT 1
          FROM "Round0SourceCompletenessEvidence" completeness
          WHERE completeness."tenantId" = NEW."tenantId"
            AND completeness."consumerId" = NEW."consumerId"
            AND completeness."reportVersionId" = NEW."reportVersionId"
            AND completeness."category" = 'UNRECOGNIZED_ACCOUNT'
            AND completeness."identityBaselineId" IS NOT NULL
            AND completeness."sourceMemberCount" < (
              SELECT count(*)
              FROM "AccountPresenceObservation" presence
              JOIN "ReportVersionAccount" report_account
                ON report_account."tenantId" = presence."tenantId"
               AND report_account."consumerId" = presence."consumerId"
               AND report_account."reportVersionId" = presence."reportVersionId"
               AND report_account."accountId" = presence."accountId"
              WHERE presence."tenantId" = completeness."tenantId"
                AND presence."consumerId" = completeness."consumerId"
                AND presence."reportVersionId" = completeness."reportVersionId"
                AND presence."extractionRunId" = completeness."extractionRunId"
                AND presence."bureau" = completeness."bureau"
                AND presence."presence" IN ('PRESENT', 'UNKNOWN')
                AND report_account."membershipOrigin" = 'SOURCE_LISTED'
                AND report_account."authorityStatus" <> 'LEGACY_UNVERIFIED'
            )
        )
        OR (
          NEW."authorityStatus" = 'LEGACY_UNVERIFIED'
          OR EXISTS (
            SELECT 1
            FROM "Round0SourceCompletenessEvidence" sealed_run
            WHERE sealed_run."tenantId" = NEW."tenantId"
              AND sealed_run."consumerId" = NEW."consumerId"
              AND sealed_run."reportVersionId" = NEW."reportVersionId"
              AND sealed_run."category" = 'UNRECOGNIZED_ACCOUNT'
              AND sealed_run."identityBaselineId" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM "AccountPresenceObservation" presence
                JOIN "Round0SourceCompletenessEvidence" member_completeness
                  ON member_completeness."tenantId" = presence."tenantId"
                 AND member_completeness."consumerId" = presence."consumerId"
                 AND member_completeness."reportVersionId" = presence."reportVersionId"
                 AND member_completeness."extractionRunId" = presence."extractionRunId"
                 AND member_completeness."bureau" = presence."bureau"
                 AND member_completeness."category" = 'UNRECOGNIZED_ACCOUNT'
                 AND member_completeness."identityBaselineId" IS NOT NULL
                WHERE presence."tenantId" = NEW."tenantId"
                  AND presence."consumerId" = NEW."consumerId"
                  AND presence."reportVersionId" = NEW."reportVersionId"
                  AND presence."extractionRunId" = sealed_run."extractionRunId"
                  AND presence."accountId" = NEW."accountId"
                  AND presence."presence" IN ('PRESENT', 'UNKNOWN')
              )
          )
        )
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'source-listed account exceeds or is absent from the sealed account-index source membership';
      END IF;
    END IF;

    RETURN NULL;
  END IF;

  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unknown Round 0 deferred source-seal validation mode';
END;
$$;

CREATE CONSTRAINT TRIGGER "Round0SourceCompletenessEvidence_membership_deferred_trg"
AFTER INSERT ON "Round0SourceCompletenessEvidence"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_round0_source_seal_deferred('MEMBERSHIP');

CREATE CONSTRAINT TRIGGER "Round0SourceCompletenessEvidence_manifest_deferred_trg"
AFTER INSERT ON "Round0SourceCompletenessEvidence"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_round0_source_seal_deferred('MANIFEST');

CREATE CONSTRAINT TRIGGER "IdentityBaseline_round0_manifest_deferred_trg"
AFTER INSERT ON "IdentityBaseline"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_round0_source_seal_deferred('MANIFEST');

CREATE CONSTRAINT TRIGGER "IdentityFact_round0_source_membership_deferred_trg"
AFTER INSERT ON "IdentityFact"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_round0_source_seal_deferred('REVERSE');

CREATE CONSTRAINT TRIGGER "AccountPresenceObservation_round0_membership_deferred_trg"
AFTER INSERT ON "AccountPresenceObservation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_round0_source_seal_deferred('REVERSE');

CREATE CONSTRAINT TRIGGER "ReportVersionAccount_round0_source_membership_deferred_trg"
AFTER INSERT ON "ReportVersionAccount"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_round0_source_seal_deferred('REVERSE');

-- ReportIngestion is the only mutable Phase 2A operational projection. Every
-- mutation is a revisioned CAS step; source identity and authorization identity
-- are immutable, source/artifact links are one-way, and semantic states cannot be
-- skipped merely because an adapter call returned success.
CREATE FUNCTION p0_2a_validate_report_ingestion_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_report "ReportVersion"%ROWTYPE;
  linked_artifact "Artifact"%ROWTYPE;
  linked_run "ExtractionRun"%ROWTYPE;
  db_now TIMESTAMP(3) := date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC');
  old_lease_live BOOLEAN;
  lease_tuple_changed BOOLEAN;
  erasure_quarantine BOOLEAN;
  expired_recovery BOOLEAN;
  state_transition_allowed BOOLEAN;
  live_lease_completion BOOLEAN;
  trusted_writer_reconciliation BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."state" <> 'RECEIVED'
       OR NEW."revision" <> 1
       OR NEW."attemptCount" <> 0
       OR NEW."leaseToken" IS NOT NULL
       OR NEW."leaseOwnerId" IS NOT NULL
       OR NEW."leaseExpiresAt" IS NOT NULL
       OR NEW."reportVersionId" IS NOT NULL
       OR NEW."sourceArtifactId" IS NOT NULL
       OR NEW."extractionRunId" IS NOT NULL
       OR NEW."sourceDisposition" <> 'RETAINED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'ingestion reservation must begin at received revision one';
    END IF;
  ELSE
    old_lease_live := OLD."leaseToken" IS NOT NULL
      AND OLD."leaseOwnerId" IS NOT NULL
      AND OLD."leaseExpiresAt" > db_now;
    lease_tuple_changed := ROW(
      NEW."leaseToken", NEW."leaseOwnerId", NEW."leaseExpiresAt"
    ) IS DISTINCT FROM ROW(
      OLD."leaseToken", OLD."leaseOwnerId", OLD."leaseExpiresAt"
    );
    erasure_quarantine := NEW."state" = 'QUARANTINED'
      AND NEW."sourceDisposition" <> 'RETAINED'
      AND (
        OLD."sourceDisposition" = 'RETAINED'
        OR NEW."sourceDisposition" <> OLD."sourceDisposition"
      );
    expired_recovery := NOT old_lease_live
      AND OLD."leaseToken" IS NOT NULL
      AND NEW."leaseToken" IS NULL
      AND NEW."leaseOwnerId" IS NULL
      AND NEW."leaseExpiresAt" IS NULL
      AND (
        NEW."state" = OLD."state"
        OR (
          NEW."state" = 'FAILED'
          AND OLD."attemptCount" >= OLD."maxAttempts"
          AND NEW."safeFailureCode" = 'INGESTION_ATTEMPTS_EXHAUSTED'
        )
        OR (
          OLD."state" IN ('SUCCEEDED', 'PARTIAL', 'ASSESSED', 'OUTCOME_UNKNOWN')
          AND NEW."state" = 'QUARANTINED'
          AND OLD."attemptCount" >= OLD."maxAttempts"
          AND NEW."safeFailureCode" = 'INGESTION_ATTEMPTS_EXHAUSTED'
        )
      );
    state_transition_allowed := NEW."state" <> OLD."state" AND (
      (OLD."state" = 'RECEIVED' AND NEW."state" IN ('SOURCE_STORED_AND_VERIFIED', 'FAILED', 'OUTCOME_UNKNOWN', 'QUARANTINED'))
      OR (OLD."state" = 'SOURCE_STORED_AND_VERIFIED' AND NEW."state" IN ('VERSION_COMMITTED', 'FAILED', 'OUTCOME_UNKNOWN', 'QUARANTINED'))
      OR (OLD."state" = 'VERSION_COMMITTED' AND NEW."state" IN ('EXTRACTING', 'FAILED', 'OUTCOME_UNKNOWN', 'QUARANTINED'))
      OR (OLD."state" = 'EXTRACTING' AND NEW."state" IN ('SUCCEEDED', 'PARTIAL', 'FAILED', 'OUTCOME_UNKNOWN', 'QUARANTINED'))
      OR (OLD."state" IN ('SUCCEEDED', 'PARTIAL') AND NEW."state" IN ('ASSESSED', 'OUTCOME_UNKNOWN', 'QUARANTINED'))
      OR (OLD."state" = 'FAILED' AND OLD."extractionRunId" IS NOT NULL AND NEW."state" = 'ASSESSED')
      OR (OLD."state" = 'ASSESSED' AND NEW."state" IN ('ROUND0_READY', 'OUTCOME_UNKNOWN', 'QUARANTINED'))
      OR (OLD."state" = 'OUTCOME_UNKNOWN' AND NEW."state" IN ('SOURCE_STORED_AND_VERIFIED', 'VERSION_COMMITTED', 'EXTRACTING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'ASSESSED', 'ROUND0_READY', 'QUARANTINED'))
      OR (NEW."state" = 'QUARANTINED' AND NEW."sourceDisposition" <> 'RETAINED')
    );
    -- A trusted repository writer CASes the exact scope/id/revision plus the
    -- old holder, token, and expiry. The trigger permits only that live holder's
    -- atomic state transition + release shape; it never permits replacement or
    -- a same-state release. Production trusted-writer attestation remains a
    -- separate mandatory pre-activation dependency.
    live_lease_completion := old_lease_live
      AND state_transition_allowed
      AND NEW."attemptCount" = OLD."attemptCount"
      AND OLD."sourceDisposition" = 'RETAINED'
      AND NEW."sourceDisposition" = 'RETAINED'
      AND NEW."leaseToken" IS NULL
      AND NEW."leaseOwnerId" IS NULL
      AND NEW."leaseExpiresAt" IS NULL;

    -- OUTCOME_UNKNOWN has no live worker lease by design. A separately
    -- authenticated repository verifier must attest the authoritative
    -- snapshot before its exact CAS reaches this trigger. Keep the SQL
    -- exemption structural and narrow; it is not proof that the production
    -- trusted-writer dependency has been closed.
    trusted_writer_reconciliation := OLD."state" = 'OUTCOME_UNKNOWN'
      AND state_transition_allowed
      AND NEW."state" <> 'OUTCOME_UNKNOWN'
      AND NEW."attemptCount" = OLD."attemptCount"
      AND OLD."sourceDisposition" = 'RETAINED'
      AND NEW."sourceDisposition" = OLD."sourceDisposition"
      AND OLD."leaseToken" IS NULL
      AND OLD."leaseOwnerId" IS NULL
      AND OLD."leaseExpiresAt" IS NULL
      AND NEW."leaseToken" IS NULL
      AND NEW."leaseOwnerId" IS NULL
      AND NEW."leaseExpiresAt" IS NULL
      AND NEW."updatedAt" >= db_now - INTERVAL '30 seconds'
      AND NEW."updatedAt" <= db_now + INTERVAL '1 second';

    IF ROW(
      NEW."id", NEW."tenantId", NEW."consumerId", NEW."actorId",
      NEW."authorizationKind", NEW."authorizationVersion",
      NEW."idempotencyKey", NEW."operationKey", NEW."reportSeriesKey",
      NEW."reservedVersion", NEW."sourceSha256", NEW."sourceByteLength",
      NEW."sourceDeclaredMimeType", NEW."sourceDetectedMimeType", NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."id", OLD."tenantId", OLD."consumerId", OLD."actorId",
      OLD."authorizationKind", OLD."authorizationVersion",
      OLD."idempotencyKey", OLD."operationKey", OLD."reportSeriesKey",
      OLD."reservedVersion", OLD."sourceSha256", OLD."sourceByteLength",
      OLD."sourceDeclaredMimeType", OLD."sourceDetectedMimeType", OLD."createdAt"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'ingestion operation identity is immutable';
    END IF;

    IF NEW."revision" <> OLD."revision" + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'ingestion revision must advance by one';
    END IF;

    IF NEW."maxAttempts" <> OLD."maxAttempts"
       OR NEW."attemptCount" < OLD."attemptCount"
       OR NEW."attemptCount" > OLD."attemptCount" + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid bounded ingestion attempt transition';
    END IF;

    IF OLD."state" = 'EXTRACTING'
       AND NEW."state" IN ('SUCCEEDED', 'PARTIAL', 'FAILED')
       AND NEW."extractionRunId" IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'extraction result requires an exact extraction run';
    END IF;

    -- A successful terminal parser write is still inside the same bounded
    -- ingestion attempt. Retaining the exact live lease makes ASSESSED and
    -- ROUND0_READY reachable even when this is the last allowed attempt.
    IF OLD."state" = 'EXTRACTING'
       AND NEW."state" IN ('SUCCEEDED', 'PARTIAL', 'FAILED')
       AND lease_tuple_changed THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'extraction result must retain its exact live lease through assessment';
    END IF;

    IF old_lease_live AND lease_tuple_changed AND NOT live_lease_completion THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'live ingestion lease holder token and expiry are immutable';
    END IF;

    IF NEW."attemptCount" = OLD."attemptCount" + 1 THEN
      IF NEW."state" <> OLD."state"
         OR OLD."sourceDisposition" <> 'RETAINED'
         OR NEW."sourceDisposition" <> 'RETAINED'
         OR old_lease_live
         OR (OLD."nextAttemptAt" IS NOT NULL AND OLD."nextAttemptAt" > db_now)
         OR NEW."leaseToken" IS NULL
         OR NEW."leaseOwnerId" IS NULL
         OR NEW."leaseExpiresAt" < db_now + INTERVAL '1 second'
         OR NEW."leaseExpiresAt" > db_now + INTERVAL '5 minutes'
         OR NEW."leaseToken" IS NOT DISTINCT FROM OLD."leaseToken"
         OR OLD."state" IN ('ROUND0_READY', 'QUARANTINED')
         OR (OLD."state" = 'FAILED' AND OLD."extractionRunId" IS NULL) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'ingestion lease acquisition is not claimable or bounded';
      END IF;
    ELSIF lease_tuple_changed AND NOT expired_recovery AND NOT live_lease_completion THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'ingestion lease mutation requires bounded acquisition or expired recovery';
    END IF;

    IF NEW."state" <> OLD."state"
       AND NOT erasure_quarantine
       AND NOT expired_recovery
       AND NOT live_lease_completion
       AND NOT trusted_writer_reconciliation
       AND (
         NOT old_lease_live
         OR NEW."leaseToken" IS DISTINCT FROM OLD."leaseToken"
         OR NEW."leaseOwnerId" IS DISTINCT FROM OLD."leaseOwnerId"
         OR NEW."leaseExpiresAt" IS DISTINCT FROM OLD."leaseExpiresAt"
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'worker state transition requires the exact live ingestion lease';
    END IF;

    IF OLD."sourceDisposition" <> 'RETAINED'
       AND NEW."state" IS DISTINCT FROM OLD."state" THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'disposed ingestion cannot resume processing';
    END IF;

    IF OLD."sourceStorageProviderKey" IS NOT NULL AND ROW(
      NEW."sourceStorageProviderKey", NEW."sourceLocatorCiphertext",
      NEW."sourceLocatorIv", NEW."sourceLocatorAuthTag",
      NEW."sourceLocatorKeyVersion", NEW."sourceLocatorAlgorithm",
      NEW."sourceLocatorEnvelopeVersion", NEW."sourceLocatorAadVersion"
    ) IS DISTINCT FROM ROW(
      OLD."sourceStorageProviderKey", OLD."sourceLocatorCiphertext",
      OLD."sourceLocatorIv", OLD."sourceLocatorAuthTag",
      OLD."sourceLocatorKeyVersion", OLD."sourceLocatorAlgorithm",
      OLD."sourceLocatorEnvelopeVersion", OLD."sourceLocatorAadVersion"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'verified source locator metadata is immutable';
    END IF;

    IF OLD."sourceReadbackSha256" IS NOT NULL AND ROW(
      NEW."sourceReadbackSha256", NEW."sourceReadbackByteLength", NEW."sourceVerifiedAt"
    ) IS DISTINCT FROM ROW(
      OLD."sourceReadbackSha256", OLD."sourceReadbackByteLength", OLD."sourceVerifiedAt"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'source readback attestation is immutable';
    END IF;

    IF OLD."reportVersionId" IS NOT NULL
       AND NEW."reportVersionId" IS DISTINCT FROM OLD."reportVersionId" THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'ingestion report version link is immutable';
    END IF;

    IF OLD."sourceArtifactId" IS NOT NULL
       AND NEW."sourceArtifactId" IS DISTINCT FROM OLD."sourceArtifactId" THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'ingestion source artifact link is immutable';
    END IF;

    IF OLD."extractionRunId" IS NOT NULL
       AND NEW."extractionRunId" IS DISTINCT FROM OLD."extractionRunId" THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'ingestion extraction run link is immutable';
    END IF;

    IF NEW."state" <> OLD."state" AND NOT state_transition_allowed THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid ingestion state transition';
    END IF;

    IF NEW."sourceDisposition" <> OLD."sourceDisposition" AND NOT (
      (OLD."sourceDisposition" = 'RETAINED' AND NEW."sourceDisposition" IN ('TOMBSTONE_REQUESTED', 'DISPOSITION_FAILED'))
      OR (OLD."sourceDisposition" = 'TOMBSTONE_REQUESTED' AND NEW."sourceDisposition" IN ('OBJECT_DELETED', 'CRYPTO_SHREDDED', 'DISPOSITION_FAILED'))
      OR (OLD."sourceDisposition" = 'OBJECT_DELETED' AND NEW."sourceDisposition" IN ('CRYPTO_SHREDDED', 'DISPOSITION_FAILED'))
      OR (OLD."sourceDisposition" = 'DISPOSITION_FAILED' AND NEW."sourceDisposition" = 'TOMBSTONE_REQUESTED')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid source disposition transition';
    END IF;
  END IF;

  IF NEW."reportVersionId" IS NOT NULL THEN
    SELECT * INTO linked_report
    FROM "ReportVersion"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "id" = NEW."reportVersionId"
    FOR KEY SHARE;

    IF NOT FOUND
       OR linked_report."reportSeriesKey" <> NEW."reportSeriesKey"
       OR linked_report."version" <> NEW."reservedVersion"
       OR linked_report."inputSha256" <> NEW."sourceSha256" THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'report version does not attest the exact ingestion reservation';
    END IF;

    SELECT * INTO linked_artifact
    FROM "Artifact"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "id" = NEW."sourceArtifactId"
      AND "sha256" = NEW."sourceSha256"
    FOR KEY SHARE;

    IF NOT FOUND
       OR linked_artifact."kind" <> 'REPORT_SOURCE'
       OR linked_artifact."reportVersionId" IS DISTINCT FROM NEW."reportVersionId"
       OR linked_artifact."byteLength" <> NEW."sourceByteLength" THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'source artifact does not attest the exact ingestion object';
    END IF;
  END IF;

  IF NEW."extractionRunId" IS NOT NULL THEN
    SELECT * INTO linked_run
    FROM "ExtractionRun"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "reportVersionId" = NEW."reportVersionId"
      AND "id" = NEW."extractionRunId"
    FOR KEY SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact ingestion extraction run';
    END IF;

    IF (NEW."state" = 'SUCCEEDED' AND linked_run."status" <> 'SUCCEEDED')
       OR (NEW."state" = 'PARTIAL' AND linked_run."status" <> 'PARTIAL')
       OR (NEW."state" = 'FAILED' AND linked_run."status" <> 'FAILED') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'ingestion state does not match exact extraction result';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ReportIngestion_state_cas_trg"
BEFORE INSERT OR UPDATE ON "ReportIngestion"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_report_ingestion_mutation();

-- Fail-closed category matching. New Phase 2A facts carry an exact category;
-- legacy uncategorized facts conservatively block every category they might be.
CREATE FUNCTION p0_2a_identity_fact_matches_category(
  fact_type "IdentityFactType",
  fact_category "IdentityReviewCategory",
  completion_category "IdentityReviewCategory"
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF fact_category IS NOT NULL THEN
    RETURN fact_category = completion_category;
  END IF;

  RETURN CASE completion_category
    WHEN 'LEGAL_NAME' THEN fact_type = 'NAME'
    WHEN 'ALIAS' THEN fact_type = 'NAME'
    WHEN 'CURRENT_ADDRESS' THEN fact_type = 'ADDRESS'
    WHEN 'FORMER_ADDRESS' THEN fact_type = 'ADDRESS'
    WHEN 'SAFE_IDENTIFIER' THEN fact_type IN ('IDENTIFIER', 'OTHER')
    WHEN 'PHONE' THEN fact_type = 'IDENTIFIER'
    WHEN 'EMPLOYMENT' THEN fact_type = 'EMPLOYMENT'
    WHEN 'MIXED_FILE_INDICATOR' THEN fact_type = 'OTHER'
    WHEN 'UNRECOGNIZED_ACCOUNT' THEN FALSE
  END;
END;
$$;

CREATE FUNCTION p0_2a_validate_identity_fact_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  baseline_run_id TEXT;
  baseline_source_set VARCHAR(64);
  baseline_status "IdentityBaselineStatus";
  baseline_xmin xid;
BEGIN
  PERFORM 1
  FROM "ReportVersion"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "id" = NEW."reportVersionId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact report version for identity source membership';
  END IF;

  SELECT "extractionRunId", "inputSetSha256", "status", xmin
    INTO baseline_run_id, baseline_source_set, baseline_status, baseline_xmin
  FROM "IdentityBaseline"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "id" = NEW."identityBaselineId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact identity baseline';
  END IF;

  IF (
    (NEW."reviewCategory" IS NULL)::INTEGER
    + (NEW."integritySha256" IS NULL)::INTEGER
    + (NEW."extractionRunId" IS NULL)::INTEGER
    + (NEW."baselineInputSetSha256" IS NULL)::INTEGER
  ) NOT IN (0, 4) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'phase 2a identity source seal must be supplied all-or-none';
  END IF;

  IF baseline_run_id IS NOT NULL AND NEW."reviewCategory" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'exact-input identity baseline cannot contain an unsealed identity fact';
  END IF;

  IF baseline_status = 'CONFIRMED'
     AND baseline_xmin <> mod(
       pg_current_xact_id()::TEXT::NUMERIC,
       4294967296::NUMERIC
     )::TEXT::xid THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed baseline facts must be appended atomically with their parent seal';
  END IF;

  IF NEW."reviewCategory" IS NOT NULL AND (
    NEW."extractionRunId" IS DISTINCT FROM baseline_run_id
    OR NEW."baselineInputSetSha256" IS DISTINCT FROM baseline_source_set
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity fact extraction or baseline source-set seal mismatch';
  END IF;

  IF NEW."reviewCategory" IS NOT NULL AND NEW."bureau" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'phase 2a identity fact requires exact bureau authority';
  END IF;

  IF NEW."reviewCategory" IS NOT NULL
     AND NEW."presence" NOT IN ('PRESENT', 'UNKNOWN') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'phase 2a identity fact may preserve only present or unknown source evidence';
  END IF;

  IF NEW."reviewCategory" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "ExtractionBureauCoverage" coverage
    WHERE coverage."tenantId" = NEW."tenantId"
      AND coverage."consumerId" = NEW."consumerId"
      AND coverage."reportVersionId" = NEW."reportVersionId"
      AND coverage."extractionRunId" = NEW."extractionRunId"
      AND coverage."bureau" = NEW."bureau"
      AND coverage."coverageStatus" = 'COVERED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity fact requires covered exact extraction bureau';
  END IF;

  IF NEW."reviewCategory" IS NOT NULL AND NOT (
    (NEW."reviewCategory" IN ('LEGAL_NAME', 'ALIAS') AND NEW."factType" = 'NAME')
    OR (NEW."reviewCategory" IN ('CURRENT_ADDRESS', 'FORMER_ADDRESS') AND NEW."factType" = 'ADDRESS')
    OR (NEW."reviewCategory" = 'SAFE_IDENTIFIER' AND NEW."factType" IN ('IDENTIFIER', 'OTHER'))
    OR (NEW."reviewCategory" = 'PHONE' AND NEW."factType" = 'IDENTIFIER')
    OR (NEW."reviewCategory" = 'EMPLOYMENT' AND NEW."factType" = 'EMPLOYMENT')
    OR (NEW."reviewCategory" = 'MIXED_FILE_INDICATOR' AND NEW."factType" = 'OTHER')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity fact type does not match its exact review category';
  END IF;

  IF NEW."reviewCategory" IS NOT NULL AND EXISTS (
    SELECT 1
    FROM "Round0SourceCompletenessEvidence" completeness
    WHERE completeness."tenantId" = NEW."tenantId"
      AND completeness."consumerId" = NEW."consumerId"
      AND completeness."reportVersionId" = NEW."reportVersionId"
      AND completeness."extractionRunId" = NEW."extractionRunId"
      AND completeness."identityBaselineId" = NEW."identityBaselineId"
      AND completeness."baselineInputSetSha256" = NEW."baselineInputSetSha256"
      AND completeness."bureau" = NEW."bureau"
      AND completeness."category" = NEW."reviewCategory"
      AND (
        completeness.xmin <> mod(
          pg_current_xact_id()::TEXT::NUMERIC,
          4294967296::NUMERIC
        )::TEXT::xid
        OR completeness."sourceMemberCount" < 1 + (
          SELECT count(*)
          FROM "IdentityFact" fact
          WHERE fact."tenantId" = completeness."tenantId"
            AND fact."consumerId" = completeness."consumerId"
            AND fact."reportVersionId" = completeness."reportVersionId"
            AND fact."extractionRunId" = completeness."extractionRunId"
            AND fact."identityBaselineId" = completeness."identityBaselineId"
            AND fact."baselineInputSetSha256" = completeness."baselineInputSetSha256"
            AND fact."bureau" = completeness."bureau"
            AND fact."reviewCategory" = completeness."category"
            AND fact."integritySha256" IS NOT NULL
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity source membership is sealed for this exact run bureau and category';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "IdentityCategoryCompletion" c
    WHERE c."tenantId" = NEW."tenantId"
      AND c."consumerId" = NEW."consumerId"
      AND c."reportVersionId" = NEW."reportVersionId"
      AND c."identityBaselineId" = NEW."identityBaselineId"
      AND p0_2a_identity_fact_matches_category(NEW."factType", NEW."reviewCategory", c."category")
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity fact contradicts not-applicable category completion';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "IdentityFact_round0_category_trg"
BEFORE INSERT ON "IdentityFact"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_identity_fact_insert();

CREATE FUNCTION p0_2a_validate_identity_category_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_run "ExtractionRun"%ROWTYPE;
  coverage_count INTEGER;
  source_evidence_count INTEGER;
  covered_source_count INTEGER;
  invalid_source_count INTEGER;
  target_baseline_status "IdentityBaselineStatus";
  source_identity_baseline_id TEXT;
  target_baseline_xmin xid;
BEGIN
  PERFORM 1
  FROM "ReportVersion"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "id" = NEW."reportVersionId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact report version for category completion';
  END IF;

  SELECT baseline."status", baseline."sourceIdentityBaselineId", baseline.xmin
    INTO target_baseline_status, source_identity_baseline_id, target_baseline_xmin
  FROM "IdentityBaseline" baseline
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "extractionRunId" = NEW."extractionRunId"
    AND "id" = NEW."identityBaselineId"
    AND "version" = NEW."identityBaselineVersion"
    AND "inputSetSha256" = NEW."baselineInputSetSha256"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact identity baseline attestation';
  END IF;

  IF target_baseline_status <> 'CONFIRMED'
     OR source_identity_baseline_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'category completion requires an exact confirmed baseline successor';
  END IF;

  IF target_baseline_xmin <> mod(
    pg_current_xact_id()::TEXT::NUMERIC,
    4294967296::NUMERIC
  )::TEXT::xid THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'category completion must be appended atomically with its confirmed baseline';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "IdentityFact" f
    WHERE f."tenantId" = NEW."tenantId"
      AND f."consumerId" = NEW."consumerId"
      AND f."reportVersionId" = NEW."reportVersionId"
      AND f."identityBaselineId" = NEW."identityBaselineId"
      AND p0_2a_identity_fact_matches_category(f."factType", f."reviewCategory", NEW."category")
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'not-applicable completion contradicts an existing identity fact';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE evidence."coverageStatus" = 'COVERED'),
    count(*) FILTER (
      WHERE NOT (
        (
          evidence."coverageStatus" = 'COVERED'
          AND evidence."status" = 'COMPLETE'
          AND evidence."sourceMemberCount" = 0
          AND evidence."sourceLocatorToken" IS NOT NULL
        )
        OR
        (
          evidence."coverageStatus" = 'OUTSIDE_COVERAGE'
          AND evidence."status" IN ('NOT_PROVIDED', 'UNKNOWN')
          AND evidence."sourceMemberCount" = 0
          AND evidence."sourceLocatorToken" IS NULL
        )
      )
    )
    INTO source_evidence_count, covered_source_count, invalid_source_count
  FROM "Round0SourceCompletenessEvidence" evidence
  WHERE evidence."tenantId" = NEW."tenantId"
    AND evidence."consumerId" = NEW."consumerId"
    AND evidence."reportVersionId" = NEW."reportVersionId"
    AND evidence."extractionRunId" = NEW."extractionRunId"
    AND evidence."identityBaselineId" = source_identity_baseline_id
    AND evidence."baselineInputSetSha256" = NEW."baselineInputSetSha256"
    AND evidence."category" = NEW."category"
    AND (
      (evidence."bureau" = 'EQUIFAX' AND evidence."id" = NEW."equifaxSourceCompletenessEvidenceId")
      OR (evidence."bureau" = 'EXPERIAN' AND evidence."id" = NEW."experianSourceCompletenessEvidenceId")
      OR (evidence."bureau" = 'TRANSUNION' AND evidence."id" = NEW."transunionSourceCompletenessEvidenceId")
    );

  IF NEW."sourceCompletenessEvidenceCount" <> 3
     OR source_evidence_count <> 3
     OR covered_source_count < 1
     OR invalid_source_count <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'not-applicable completion requires exact complete all-bureau category source evidence';
  END IF;

  IF NEW."category" = 'UNRECOGNIZED_ACCOUNT' THEN
    SELECT * INTO linked_run
    FROM "ExtractionRun"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "reportVersionId" = NEW."reportVersionId"
      AND "id" = NEW."extractionRunId"
    FOR KEY SHARE;

    IF NOT FOUND
       OR linked_run."status" <> 'SUCCEEDED'
       OR linked_run."inputArtifactId" IS NULL
       OR linked_run."inputSha256" IS NULL
       OR linked_run."inputRepresentation" IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unrecognized-account not-applicable requires exact succeeded extraction source seal';
    END IF;

    SELECT count(*) INTO coverage_count
    FROM "ExtractionBureauCoverage" coverage
    WHERE coverage."tenantId" = NEW."tenantId"
      AND coverage."consumerId" = NEW."consumerId"
      AND coverage."reportVersionId" = NEW."reportVersionId"
      AND coverage."extractionRunId" = NEW."extractionRunId";

    IF coverage_count <> 3 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unrecognized-account not-applicable requires complete bureau coverage manifest';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "ReportVersionAccount" rva
      WHERE rva."tenantId" = NEW."tenantId"
        AND rva."consumerId" = NEW."consumerId"
        AND rva."reportVersionId" = NEW."reportVersionId"
        AND rva."membershipOrigin" = 'SOURCE_LISTED'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unrecognized-account category is not applicable when a source-listed account exists';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "IdentityCategoryCompletion_no_fact_trg"
BEFORE INSERT ON "IdentityCategoryCompletion"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_identity_category_completion();

CREATE FUNCTION p0_2a_reject_account_presence_after_source_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1
  FROM "ReportVersion"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "id" = NEW."reportVersionId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact report version for account source membership';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Round0SourceCompletenessEvidence" completeness
    WHERE completeness."tenantId" = NEW."tenantId"
      AND completeness."consumerId" = NEW."consumerId"
      AND completeness."reportVersionId" = NEW."reportVersionId"
      AND completeness."extractionRunId" = NEW."extractionRunId"
      AND completeness."bureau" = NEW."bureau"
      AND completeness."category" = 'UNRECOGNIZED_ACCOUNT'
      AND completeness."identityBaselineId" IS NOT NULL
      AND (
        completeness.xmin <> mod(
          pg_current_xact_id()::TEXT::NUMERIC,
          4294967296::NUMERIC
        )::TEXT::xid
        OR (
          NEW."presence" IN ('PRESENT', 'UNKNOWN')
          AND EXISTS (
            SELECT 1
            FROM "ReportVersionAccount" new_report_account
            WHERE new_report_account."tenantId" = NEW."tenantId"
              AND new_report_account."consumerId" = NEW."consumerId"
              AND new_report_account."reportVersionId" = NEW."reportVersionId"
              AND new_report_account."accountId" = NEW."accountId"
              AND new_report_account."membershipOrigin" = 'SOURCE_LISTED'
              AND new_report_account."authorityStatus" <> 'LEGACY_UNVERIFIED'
          )
          AND completeness."sourceMemberCount" < 1 + (
            SELECT count(*)
            FROM "AccountPresenceObservation" presence
            JOIN "ReportVersionAccount" report_account
              ON report_account."tenantId" = presence."tenantId"
             AND report_account."consumerId" = presence."consumerId"
             AND report_account."reportVersionId" = presence."reportVersionId"
             AND report_account."accountId" = presence."accountId"
            WHERE presence."tenantId" = completeness."tenantId"
              AND presence."consumerId" = completeness."consumerId"
              AND presence."reportVersionId" = completeness."reportVersionId"
              AND presence."extractionRunId" = completeness."extractionRunId"
              AND presence."bureau" = completeness."bureau"
              AND presence."presence" IN ('PRESENT', 'UNKNOWN')
              AND report_account."membershipOrigin" = 'SOURCE_LISTED'
              AND report_account."authorityStatus" <> 'LEGACY_UNVERIFIED'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account-index source membership is sealed for this exact run and bureau';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "AccountPresenceObservation_round0_source_membership_trg"
BEFORE INSERT ON "AccountPresenceObservation"
FOR EACH ROW EXECUTE FUNCTION p0_2a_reject_account_presence_after_source_completeness();

CREATE FUNCTION p0_2a_reject_account_after_identity_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1
  FROM "ReportVersion"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "id" = NEW."reportVersionId"
  FOR UPDATE;

  IF NEW."membershipOrigin" = 'SOURCE_LISTED' AND EXISTS (
    SELECT 1
    FROM "IdentityCategoryCompletion" c
    WHERE c."tenantId" = NEW."tenantId"
      AND c."consumerId" = NEW."consumerId"
      AND c."reportVersionId" = NEW."reportVersionId"
      AND c."category" = 'UNRECOGNIZED_ACCOUNT'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'reported account contradicts not-applicable account category completion';
  END IF;

  IF NEW."membershipOrigin" = 'SOURCE_LISTED' AND EXISTS (
    SELECT 1
    FROM "Round0SourceCompletenessEvidence" completeness
    WHERE completeness."tenantId" = NEW."tenantId"
      AND completeness."consumerId" = NEW."consumerId"
      AND completeness."reportVersionId" = NEW."reportVersionId"
      AND completeness."category" = 'UNRECOGNIZED_ACCOUNT'
      AND completeness."identityBaselineId" IS NOT NULL
      AND completeness.xmin <> mod(
        pg_current_xact_id()::TEXT::NUMERIC,
        4294967296::NUMERIC
      )::TEXT::xid
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'source-listed account cannot extend a sealed account-index source set';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ReportVersionAccount_round0_category_trg"
BEFORE INSERT ON "ReportVersionAccount"
FOR EACH ROW EXECUTE FUNCTION p0_2a_reject_account_after_identity_completion();

CREATE FUNCTION p0_2a_validate_identity_correspondence_assertion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  baseline_status "IdentityBaselineStatus";
  fact_row "IdentityFact"%ROWTYPE;
  previous_row "IdentityCorrespondenceAssertion"%ROWTYPE;
BEGIN
  SELECT "status" INTO baseline_status
  FROM "IdentityBaseline"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "extractionRunId" = NEW."extractionRunId"
    AND "id" = NEW."identityBaselineId"
    AND "version" = NEW."identityBaselineVersion"
    AND "inputSetSha256" = NEW."baselineInputSetSha256"
  FOR UPDATE;

  IF NOT FOUND OR baseline_status <> 'CONFIRMED' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity correspondence assertion requires an exact confirmed baseline';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "IdentityBaseline" successor
    WHERE successor."tenantId" = NEW."tenantId"
      AND successor."consumerId" = NEW."consumerId"
      AND successor."supersedesIdentityBaselineId" = NEW."identityBaselineId"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity correspondence assertion requires the current confirmed baseline head';
  END IF;

  PERFORM 1
  FROM "IdentityBaselineAccountReviewMembership" membership
  JOIN "ConsumerAccountReviewReceipt" receipt
    ON receipt."tenantId" = membership."tenantId"
   AND receipt."consumerId" = membership."consumerId"
   AND receipt."id" = membership."consumerAccountReviewReceiptId"
  WHERE membership."tenantId" = NEW."tenantId"
    AND membership."consumerId" = NEW."consumerId"
    AND membership."confirmedIdentityBaselineId" = NEW."identityBaselineId"
  FOR KEY SHARE OF receipt;

  IF EXISTS (
    SELECT 1
    FROM "IdentityBaselineAccountReviewMembership" membership
    JOIN "ConsumerAccountReviewReceipt" receipt
      ON receipt."tenantId" = membership."tenantId"
     AND receipt."consumerId" = membership."consumerId"
     AND receipt."id" = membership."consumerAccountReviewReceiptId"
    WHERE membership."tenantId" = NEW."tenantId"
      AND membership."consumerId" = NEW."consumerId"
      AND membership."confirmedIdentityBaselineId" = NEW."identityBaselineId"
      AND (
        receipt."reviewState" = 'REVOKED'
        OR EXISTS (
          SELECT 1
          FROM "ConsumerAccountReviewReceipt" successor
          WHERE successor."tenantId" = receipt."tenantId"
            AND successor."consumerId" = receipt."consumerId"
            AND successor."reviewSeriesKey" = receipt."reviewSeriesKey"
            AND successor."supersedesReviewId" = receipt."id"
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity correspondence assertion requires current confirmed account-review membership';
  END IF;

  SELECT * INTO fact_row
  FROM "IdentityFact"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "extractionRunId" = NEW."extractionRunId"
    AND "identityBaselineId" = NEW."identityBaselineId"
    AND "baselineInputSetSha256" = NEW."baselineInputSetSha256"
    AND "factSeriesKey" = NEW."identityFactSeriesKey"
    AND "id" = NEW."identityFactId"
    AND "classification" = NEW."identityFactClassification"
    AND "integritySha256" = NEW."identityFactIntegritySha256"
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact identity fact attestation';
  END IF;

  IF fact_row."bureau" IS DISTINCT FROM NEW."factBureau"
     OR fact_row."sourceLocatorToken" <> NEW."factSourceLocatorToken" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity correspondence assertion source context mismatch';
  END IF;

  IF fact_row."presence" <> 'PRESENT' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity correspondence assertion requires a source-reported present fact';
  END IF;

  IF NEW."correspondencePurposeCode" = 'CORRESPONDENCE_SENDER_IDENTITY'
     AND (
       NEW."identityFactClassification" <> 'CORRECT_CURRENT'
       OR fact_row."reviewCategory" IS NULL
       OR fact_row."reviewCategory" NOT IN ('LEGAL_NAME', 'CURRENT_ADDRESS')
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'sender identity purpose requires a confirmed current legal-name or return-address fact';
  END IF;

  IF NEW."correspondencePurposeCode" = 'CORRESPONDENCE_IDENTITY_CORRECTION'
     AND NEW."identityFactClassification" NOT IN ('INCORRECT', 'NEVER_MINE', 'OUTDATED_UPDATE_REQUESTED') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity correction purpose requires a consumer correction classification';
  END IF;

  -- sourceSetSha256 is the branded repository digest of the exact confirmed
  -- fact source. Reusing it as the unique source-series authority prevents
  -- parallel caller-chosen v1 heads without introducing a second SQL-only JSON
  -- canonicalizer. Production semantic verification remains separately bounded.
  IF NEW."sourceSeriesKey" <> NEW."sourceSetSha256"
     OR NEW."assertionSeriesKey" <> 'identity_assertion_' || left(NEW."sourceSetSha256", 40) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'identity correspondence assertion series must derive from its exact claim source tuple';
  END IF;

  IF NEW."supersedesAssertionId" IS NULL THEN
    IF NEW."version" <> 1 OR NEW."status" <> 'ATTESTED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'initial identity correspondence assertion must be attested version one';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO previous_row
  FROM "IdentityCorrespondenceAssertion"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "assertionSeriesKey" = NEW."assertionSeriesKey"
    AND "id" = NEW."supersedesAssertionId"
  FOR UPDATE;

  IF NOT FOUND
     OR NEW."version" <> previous_row."version" + 1
     OR previous_row."status" = 'REVOKED'
     OR NEW."reportVersionId" <> previous_row."reportVersionId"
     OR NEW."extractionRunId" <> previous_row."extractionRunId"
     OR NEW."identityBaselineId" <> previous_row."identityBaselineId"
     OR NEW."identityBaselineVersion" <> previous_row."identityBaselineVersion"
     OR NEW."baselineInputSetSha256" <> previous_row."baselineInputSetSha256"
     OR NEW."identityFactSeriesKey" <> previous_row."identityFactSeriesKey"
     OR NEW."identityFactId" <> previous_row."identityFactId"
     OR NEW."identityFactClassification" <> previous_row."identityFactClassification"
     OR NEW."identityFactIntegritySha256" <> previous_row."identityFactIntegritySha256"
     OR NEW."factBureau" IS DISTINCT FROM previous_row."factBureau"
     OR NEW."factSourceLocatorToken" <> previous_row."factSourceLocatorToken"
     OR NEW."correspondencePurposeCode" <> previous_row."correspondencePurposeCode"
     OR NEW."sourceSeriesKey" <> previous_row."sourceSeriesKey"
     OR NEW."sourceSetSha256" <> previous_row."sourceSetSha256" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid identity correspondence assertion supersession';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "IdentityCorrespondenceAssertion_validate_trg"
BEFORE INSERT ON "IdentityCorrespondenceAssertion"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_identity_correspondence_assertion();

CREATE FUNCTION p0_2a_validate_consumer_account_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  baseline_status "IdentityBaselineStatus";
  linked_run "ExtractionRun"%ROWTYPE;
  report_account "ReportVersionAccount"%ROWTYPE;
  presence_row "AccountPresenceObservation"%ROWTYPE;
  completeness_row "Round0SourceCompletenessEvidence"%ROWTYPE;
  previous_row "ConsumerAccountReviewReceipt"%ROWTYPE;
  canonical_source_json TEXT;
  expected_source_series_key VARCHAR(64);
BEGIN
  IF NEW."authorizationKind" <> 'DIRECT_CONSUMER'
     OR NEW."tenantId" <> NEW."consumerId" THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'account recognition review requires direct consumer authority';
  END IF;

  canonical_source_json :=
    '{"accountId":' || to_json(NEW."accountId")::TEXT
    || ',"accountIndexCompletenessEvidenceId":' || to_json(NEW."accountIndexCompletenessEvidenceId")::TEXT
    || ',"accountIndexCompletenessIntegritySha256":' || to_json(NEW."accountIndexCompletenessIntegritySha256")::TEXT
    || ',"accountIndexSourceMembershipSha256":' || to_json(NEW."accountIndexSourceMembershipSha256")::TEXT
    || ',"accountPresenceIntegritySha256":' || to_json(NEW."accountPresenceIntegritySha256")::TEXT
    || ',"accountPresenceObservationId":' || to_json(NEW."accountPresenceObservationId")::TEXT
    || ',"accountPresenceObservationRevision":' || to_json(NEW."accountPresenceObservationRevision")::TEXT
    || ',"accountPresenceSourceLocatorToken":' || to_json(NEW."accountPresenceSourceLocatorToken")::TEXT
    || ',"baselineInputSetSha256":' || to_json(NEW."baselineInputSetSha256")::TEXT
    || ',"bureau":' || to_json(NEW."bureau"::TEXT)::TEXT
    || ',"consumerId":' || to_json(NEW."consumerId")::TEXT
    || ',"extractionRunId":' || to_json(NEW."extractionRunId")::TEXT
    || ',"identityBaselineId":' || to_json(NEW."identityBaselineId")::TEXT
    || ',"identityBaselineVersion":' || to_json(NEW."identityBaselineVersion")::TEXT
    || ',"reportVersionAccountId":' || to_json(NEW."reportVersionAccountId")::TEXT
    || ',"reportVersionId":' || to_json(NEW."reportVersionId")::TEXT
    || ',"tenantId":' || to_json(NEW."tenantId")::TEXT
    || '}';
  expected_source_series_key := encode(
    sha256(convert_to(canonical_source_json, 'UTF8')),
    'hex'
  );

  IF NEW."sourceSetSha256" <> expected_source_series_key
     OR NEW."sourceSeriesKey" <> expected_source_series_key
     OR NEW."reviewSeriesKey" <> 'round0_account_review_' || left(expected_source_series_key, 40) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account review series and source digest must derive from the exact evidence tuple';
  END IF;

  SELECT "status" INTO baseline_status
  FROM "IdentityBaseline"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "extractionRunId" = NEW."extractionRunId"
    AND "id" = NEW."identityBaselineId"
    AND "version" = NEW."identityBaselineVersion"
    AND "inputSetSha256" = NEW."baselineInputSetSha256"
  FOR UPDATE;

  IF NOT FOUND OR baseline_status <> 'DRAFT' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account recognition review requires exact draft source-set baseline';
  END IF;

  SELECT * INTO linked_run
  FROM "ExtractionRun"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "id" = NEW."extractionRunId"
  FOR KEY SHARE;

  IF NOT FOUND
     OR linked_run."status" NOT IN ('SUCCEEDED', 'PARTIAL')
     OR linked_run."inputArtifactId" IS NULL
     OR linked_run."inputSha256" IS NULL
     OR linked_run."inputRepresentation" IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account recognition review requires exact completed extraction source';
  END IF;

  SELECT * INTO report_account
  FROM "ReportVersionAccount"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "id" = NEW."reportVersionAccountId"
    AND "accountId" = NEW."accountId"
  FOR KEY SHARE;

  IF NOT FOUND
     OR report_account."membershipOrigin" <> 'SOURCE_LISTED'
     OR report_account."sourceAccountOrdinal" IS NULL
     OR report_account."authorityStatus" = 'LEGACY_UNVERIFIED' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account recognition review requires exact source-listed v2 account membership';
  END IF;

  SELECT * INTO presence_row
  FROM "AccountPresenceObservation"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reportVersionId" = NEW."reportVersionId"
    AND "extractionRunId" = NEW."extractionRunId"
    AND "bureau" = NEW."bureau"
    AND "accountId" = NEW."accountId"
    AND "id" = NEW."accountPresenceObservationId"
    AND "revision" = NEW."accountPresenceObservationRevision"
    AND "integritySha256" = NEW."accountPresenceIntegritySha256"
  FOR KEY SHARE;

  IF NOT FOUND
     OR presence_row."presence" <> 'PRESENT'
     OR presence_row."coverageStatus" <> 'COVERED'
     OR presence_row."sourceLocatorToken" IS NULL
     OR NEW."accountPresenceSourceLocatorToken" IS NULL
     OR length(NEW."accountPresenceSourceLocatorToken") NOT BETWEEN 1 AND 191
     OR presence_row."sourceLocatorToken" IS DISTINCT FROM NEW."accountPresenceSourceLocatorToken" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account recognition review source observation mismatch';
  END IF;

  SELECT * INTO completeness_row
  FROM "Round0SourceCompletenessEvidence"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "id" = NEW."accountIndexCompletenessEvidenceId"
    AND "sourceMembershipSha256" = NEW."accountIndexSourceMembershipSha256"
    AND "integritySha256" = NEW."accountIndexCompletenessIntegritySha256"
  FOR KEY SHARE;

  IF NOT FOUND
     OR completeness_row."reportVersionId" <> NEW."reportVersionId"
     OR completeness_row."extractionRunId" <> NEW."extractionRunId"
     OR completeness_row."identityBaselineId" <> NEW."identityBaselineId"
     OR completeness_row."baselineInputSetSha256" <> NEW."baselineInputSetSha256"
     OR completeness_row."bureau" <> NEW."bureau"
     OR completeness_row."coverageStatus" <> 'COVERED'
     OR completeness_row."category" <> 'UNRECOGNIZED_ACCOUNT'
     OR completeness_row."status" NOT IN ('COMPLETE', 'PARTIAL')
     OR completeness_row."sourceMemberCount" < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account recognition review requires exact sealed account-index membership evidence';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "IdentityCategoryCompletion" completion
    WHERE completion."tenantId" = NEW."tenantId"
      AND completion."consumerId" = NEW."consumerId"
      AND completion."reportVersionId" = NEW."reportVersionId"
      AND completion."extractionRunId" = NEW."extractionRunId"
      AND completion."identityBaselineId" = NEW."identityBaselineId"
      AND completion."category" = 'UNRECOGNIZED_ACCOUNT'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account review contradicts not-applicable account category completion';
  END IF;

  IF NEW."supersedesReviewId" IS NULL THEN
    IF NEW."version" <> 1 OR NEW."reviewState" = 'REVOKED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'initial account review must be non-revoked version one';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO previous_row
  FROM "ConsumerAccountReviewReceipt"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "reviewSeriesKey" = NEW."reviewSeriesKey"
    AND "id" = NEW."supersedesReviewId"
  FOR UPDATE;

  IF NOT FOUND
     OR previous_row."reviewState" = 'REVOKED'
     OR NEW."version" <> previous_row."version" + 1
     OR NEW."reportVersionId" <> previous_row."reportVersionId"
     OR NEW."extractionRunId" <> previous_row."extractionRunId"
     OR NEW."identityBaselineId" <> previous_row."identityBaselineId"
     OR NEW."identityBaselineVersion" <> previous_row."identityBaselineVersion"
     OR NEW."baselineInputSetSha256" <> previous_row."baselineInputSetSha256"
     OR NEW."bureau" <> previous_row."bureau"
     OR NEW."accountId" <> previous_row."accountId"
     OR NEW."reportVersionAccountId" <> previous_row."reportVersionAccountId"
     OR NEW."accountPresenceObservationId" <> previous_row."accountPresenceObservationId"
     OR NEW."accountPresenceObservationRevision" <> previous_row."accountPresenceObservationRevision"
     OR NEW."accountPresenceIntegritySha256" <> previous_row."accountPresenceIntegritySha256"
     OR NEW."accountPresenceSourceLocatorToken" IS DISTINCT FROM previous_row."accountPresenceSourceLocatorToken"
     OR NEW."accountIndexCompletenessEvidenceId" <> previous_row."accountIndexCompletenessEvidenceId"
     OR NEW."accountIndexSourceMembershipSha256" <> previous_row."accountIndexSourceMembershipSha256"
     OR NEW."accountIndexCompletenessIntegritySha256" <> previous_row."accountIndexCompletenessIntegritySha256"
     OR NEW."sourceSeriesKey" <> previous_row."sourceSeriesKey"
     OR NEW."sourceSetSha256" <> previous_row."sourceSetSha256" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account review supersession changed exact source membership';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ConsumerAccountReviewReceipt_validate_trg"
BEFORE INSERT ON "ConsumerAccountReviewReceipt"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_consumer_account_review();

CREATE FUNCTION p0_2a_validate_identity_baseline_account_review_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  confirmed_baseline_status "IdentityBaselineStatus";
  confirmed_baseline_source_id TEXT;
  confirmed_baseline_semantic_sha256 TEXT;
  confirmed_baseline_expected_review_count INTEGER;
  confirmed_baseline_confirmed_at TIMESTAMP(3);
  receipt_row "ConsumerAccountReviewReceipt"%ROWTYPE;
  confirmed_baseline_xmin xid;
BEGIN
  SELECT baseline."status",
         baseline."sourceIdentityBaselineId",
         baseline."semanticSha256",
         baseline."expectedAccountReviewReceiptCount",
         baseline."confirmedAt",
         baseline.xmin
    INTO confirmed_baseline_status,
         confirmed_baseline_source_id,
         confirmed_baseline_semantic_sha256,
         confirmed_baseline_expected_review_count,
         confirmed_baseline_confirmed_at,
         confirmed_baseline_xmin
  FROM "IdentityBaseline" baseline
  WHERE baseline."tenantId" = NEW."tenantId"
    AND baseline."consumerId" = NEW."consumerId"
    AND baseline."reportVersionId" = NEW."reportVersionId"
    AND baseline."extractionRunId" = NEW."extractionRunId"
    AND baseline."id" = NEW."confirmedIdentityBaselineId"
    AND baseline."version" = NEW."confirmedIdentityBaselineVersion"
    AND baseline."inputSetSha256" = NEW."confirmedBaselineInputSetSha256"
  FOR KEY SHARE;

  IF NOT FOUND
     OR confirmed_baseline_status <> 'CONFIRMED'
     OR confirmed_baseline_source_id IS NULL
     OR confirmed_baseline_semantic_sha256 IS NULL
     OR confirmed_baseline_expected_review_count IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account-review membership requires an exact sealed confirmed baseline';
  END IF;

  IF confirmed_baseline_xmin <> mod(
    pg_current_xact_id()::TEXT::NUMERIC,
    4294967296::NUMERIC
  )::TEXT::xid THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account-review membership must be appended atomically with its confirmed baseline';
  END IF;

  SELECT * INTO receipt_row
  FROM "ConsumerAccountReviewReceipt" receipt
  WHERE receipt."tenantId" = NEW."tenantId"
    AND receipt."consumerId" = NEW."consumerId"
    AND receipt."id" = NEW."consumerAccountReviewReceiptId"
    AND receipt."reviewSeriesKey" = NEW."reviewSeriesKey"
    AND receipt."version" = NEW."reviewVersion"
    AND receipt."reviewState" = NEW."reviewState"
    AND receipt."sourceSetSha256" = NEW."receiptSourceSetSha256"
    AND receipt."bureau" = NEW."bureau"
    AND receipt."accountId" = NEW."accountId"
    AND receipt."reportVersionAccountId" = NEW."reportVersionAccountId"
  FOR UPDATE;

  IF NOT FOUND
     OR receipt_row."reportVersionId" <> NEW."reportVersionId"
     OR receipt_row."extractionRunId" <> NEW."extractionRunId"
     OR receipt_row."identityBaselineId" <> confirmed_baseline_source_id
     OR receipt_row."baselineInputSetSha256" <> NEW."confirmedBaselineInputSetSha256"
     OR receipt_row."reviewState" = 'REVOKED'
     OR receipt_row."reviewedAt" > confirmed_baseline_confirmed_at
     OR EXISTS (
       SELECT 1
       FROM "ConsumerAccountReviewReceipt" successor
       WHERE successor."tenantId" = receipt_row."tenantId"
         AND successor."consumerId" = receipt_row."consumerId"
         AND successor."reviewSeriesKey" = receipt_row."reviewSeriesKey"
         AND successor."supersedesReviewId" = receipt_row."id"
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account-review membership requires the exact current receipt head at confirmation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "IdentityBaselineAccountReviewMembership_validate_trg"
BEFORE INSERT ON "IdentityBaselineAccountReviewMembership"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_identity_baseline_account_review_membership();

CREATE FUNCTION p0_2a_validate_confirmed_baseline_child_deferred()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_baseline_id TEXT;
  target_baseline_status "IdentityBaselineStatus";
  target_baseline_xmin xid;
  expected_child_count INTEGER;
  actual_child_count INTEGER;
  current_xid xid := mod(
    pg_current_xact_id()::TEXT::NUMERIC,
    4294967296::NUMERIC
  )::TEXT::xid;
BEGIN
  IF TG_TABLE_NAME = 'IdentityBaselineAccountReviewMembership' THEN
    target_baseline_id := NEW."confirmedIdentityBaselineId";
  ELSE
    target_baseline_id := NEW."identityBaselineId";
  END IF;

  SELECT
    baseline."status",
    baseline.xmin,
    CASE TG_TABLE_NAME
      WHEN 'IdentityFact' THEN baseline."expectedIdentityFactCount"
      WHEN 'IdentityCategoryCompletion' THEN baseline."expectedCategoryCompletionCount"
      WHEN 'IdentityBaselineAccountReviewMembership' THEN baseline."expectedAccountReviewReceiptCount"
    END
    INTO target_baseline_status, target_baseline_xmin, expected_child_count
  FROM "IdentityBaseline" baseline
  WHERE baseline."tenantId" = NEW."tenantId"
    AND baseline."consumerId" = NEW."consumerId"
    AND baseline."id" = target_baseline_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact identity baseline child parent';
  END IF;

  IF target_baseline_status = 'CONFIRMED'
     AND target_baseline_xmin <> current_xid THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed baseline children cannot be appended after the parent seal commits';
  END IF;

  IF target_baseline_status = 'CONFIRMED' THEN
    IF TG_TABLE_NAME = 'IdentityFact' THEN
      SELECT count(*) INTO actual_child_count
      FROM "IdentityFact" fact
      WHERE fact."tenantId" = NEW."tenantId"
        AND fact."consumerId" = NEW."consumerId"
        AND fact."identityBaselineId" = target_baseline_id;
    ELSIF TG_TABLE_NAME = 'IdentityCategoryCompletion' THEN
      SELECT count(*) INTO actual_child_count
      FROM "IdentityCategoryCompletion" completion
      WHERE completion."tenantId" = NEW."tenantId"
        AND completion."consumerId" = NEW."consumerId"
        AND completion."identityBaselineId" = target_baseline_id;
    ELSIF TG_TABLE_NAME = 'IdentityBaselineAccountReviewMembership' THEN
      SELECT count(*) INTO actual_child_count
      FROM "IdentityBaselineAccountReviewMembership" membership
      WHERE membership."tenantId" = NEW."tenantId"
        AND membership."consumerId" = NEW."consumerId"
        AND membership."confirmedIdentityBaselineId" = target_baseline_id;
    ELSE
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unknown confirmed baseline child validation table';
    END IF;

    IF expected_child_count IS NULL
       OR actual_child_count > expected_child_count THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'confirmed baseline child count exceeds its immutable parent seal';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "IdentityFact_confirmed_parent_deferred_trg"
AFTER INSERT ON "IdentityFact"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_confirmed_baseline_child_deferred();

CREATE CONSTRAINT TRIGGER "IdentityCategoryCompletion_confirmed_parent_deferred_trg"
AFTER INSERT ON "IdentityCategoryCompletion"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_confirmed_baseline_child_deferred();

CREATE CONSTRAINT TRIGGER "IdentityBaselineAccountReview_confirmed_parent_deferred_trg"
AFTER INSERT ON "IdentityBaselineAccountReviewMembership"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_confirmed_baseline_child_deferred();

CREATE FUNCTION p0_2a_validate_case_action_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  previous_row "CaseActionDecision"%ROWTYPE;
BEGIN
  IF NEW."supersedesDecisionId" IS NULL THEN
    IF NEW."version" <> 1 OR NEW."state" <> 'PROPOSED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'initial case action decision must be proposed version one';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO previous_row
  FROM "CaseActionDecision"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "decisionSeriesKey" = NEW."decisionSeriesKey"
    AND "id" = NEW."supersedesDecisionId"
  FOR UPDATE;

  IF NOT FOUND
     OR NEW."version" <> previous_row."version" + 1
     OR NEW."reportVersionId" <> previous_row."reportVersionId"
     OR NEW."caseId" <> previous_row."caseId"
     OR NEW."actionCode" <> previous_row."actionCode"
     OR NEW."chronologyRound" <> previous_row."chronologyRound"
     OR NEW."expectedSourceCount" <> previous_row."expectedSourceCount"
     OR NEW."sourceSetSha256" <> previous_row."sourceSetSha256" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action decision supersession changed exact authority inputs';
  END IF;

  IF NOT (
    (previous_row."state" = 'PROPOSED' AND NEW."state" IN ('CONSUMER_SELECTED', 'DECLINED', 'WAITING', 'BLOCKED'))
    OR (previous_row."state" = 'WAITING' AND NEW."state" IN ('CONSUMER_SELECTED', 'DECLINED', 'BLOCKED'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'invalid case action decision state transition';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CaseActionDecision_validate_trg"
BEFORE INSERT ON "CaseActionDecision"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_case_action_decision();

CREATE FUNCTION p0_2a_validate_case_action_source_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_xmin xid;
  parent_action_code "CaseActionCode";
  observed_version INTEGER;
  observed_bureau "Bureau";
  observed_digest TEXT;
  observed_status TEXT;
  observed_series_key TEXT;
  observed_identity_baseline_id TEXT;
  observed_expires_at TIMESTAMP(3);
BEGIN
  SELECT decision.xmin, decision."actionCode" INTO parent_xmin, parent_action_code
  FROM "CaseActionDecision" decision
  WHERE decision."tenantId" = NEW."tenantId"
    AND decision."consumerId" = NEW."consumerId"
    AND decision."reportVersionId" = NEW."reportVersionId"
    AND decision."caseId" = NEW."caseId"
    AND decision."id" = NEW."decisionId"
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown exact case action decision membership';
  END IF;

  IF parent_xmin <> mod(
    pg_current_xact_id()::TEXT::NUMERIC,
    4294967296::NUMERIC
  )::TEXT::xid THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'case action source set is already sealed';
  END IF;

  IF NEW."sourceType" = 'FIELD_OBSERVATION' THEN
    SELECT "revision", "bureau", "integritySha256"
      INTO observed_version, observed_bureau, observed_digest
    FROM "FieldObservation"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "reportVersionId" = NEW."reportVersionId"
      AND "id" = NEW."sourceId"
    FOR KEY SHARE;

  ELSIF NEW."sourceType" = 'DERIVED_ACCOUNT_ASSESSMENT' THEN
    SELECT "assessmentVersion", NULL::"Bureau", "inputSetSha256"
      INTO observed_version, observed_bureau, observed_digest
    FROM "DerivedAccountAssessment"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "reportVersionId" = NEW."reportVersionId"
      AND "id" = NEW."sourceId"
    FOR KEY SHARE;

  ELSIF NEW."sourceType" = 'CONSUMER_ASSERTION' THEN
    SELECT "version", "bureau", "integritySha256", "disposition"::TEXT, "assertionSeriesKey", "expiresAt"
      INTO observed_version, observed_bureau, observed_digest, observed_status, observed_series_key, observed_expires_at
    FROM "ConsumerAssertion"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "reportVersionId" = NEW."reportVersionId"
      AND "id" = NEW."sourceId"
    FOR UPDATE;

    IF FOUND AND (
      observed_status = 'REVOKED'
      OR (observed_expires_at IS NOT NULL AND observed_expires_at <= (clock_timestamp() AT TIME ZONE 'UTC'))
      OR EXISTS (
        SELECT 1 FROM "ConsumerAssertion" successor
        WHERE successor."tenantId" = NEW."tenantId"
          AND successor."consumerId" = NEW."consumerId"
          AND successor."assertionSeriesKey" = observed_series_key
          AND successor."supersedesAssertionId" = NEW."sourceId"
      )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action cannot bind a stale or revoked consumer assertion';
    END IF;

  ELSIF NEW."sourceType" = 'CONSUMER_ACCOUNT_REVIEW' THEN
    IF parent_action_code NOT IN ('REVIEW_ACCOUNT_FACT', 'DEFER_REVIEW', 'TAKE_NO_ACTION') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'account recognition review cannot confer correction, policy, or legal action authority';
    END IF;

    SELECT "version", "bureau", "sourceSetSha256", "reviewState"::TEXT, "reviewSeriesKey"
      INTO observed_version, observed_bureau, observed_digest, observed_status, observed_series_key
    FROM "ConsumerAccountReviewReceipt"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "reportVersionId" = NEW."reportVersionId"
      AND "id" = NEW."sourceId"
    FOR UPDATE;

    IF FOUND AND (
      observed_status = 'REVOKED'
      OR EXISTS (
        SELECT 1 FROM "ConsumerAccountReviewReceipt" successor
        WHERE successor."tenantId" = NEW."tenantId"
          AND successor."consumerId" = NEW."consumerId"
          AND successor."reviewSeriesKey" = observed_series_key
          AND successor."supersedesReviewId" = NEW."sourceId"
      )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action cannot bind a stale or revoked account recognition review';
    END IF;

  ELSIF NEW."sourceType" = 'IDENTITY_FACT' THEN
    SELECT baseline."version", fact."bureau", fact."integritySha256", baseline."id"
      INTO observed_version, observed_bureau, observed_digest, observed_identity_baseline_id
    FROM "IdentityFact" fact
    JOIN "IdentityBaseline" baseline
      ON baseline."tenantId" = fact."tenantId"
     AND baseline."consumerId" = fact."consumerId"
     AND baseline."reportVersionId" = fact."reportVersionId"
     AND baseline."id" = fact."identityBaselineId"
    WHERE fact."tenantId" = NEW."tenantId"
      AND fact."consumerId" = NEW."consumerId"
      AND fact."reportVersionId" = NEW."reportVersionId"
      AND fact."id" = NEW."sourceId"
    FOR KEY SHARE OF fact, baseline;

    IF FOUND AND EXISTS (
      SELECT 1
      FROM "IdentityBaseline" successor
      WHERE successor."tenantId" = NEW."tenantId"
        AND successor."consumerId" = NEW."consumerId"
        AND successor."supersedesIdentityBaselineId" = observed_identity_baseline_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action cannot bind an identity fact from a stale confirmed baseline';
    END IF;

  ELSIF NEW."sourceType" = 'IDENTITY_CORRESPONDENCE_ASSERTION' THEN
    SELECT "version", "factBureau", "sourceSetSha256", "status"::TEXT, "assertionSeriesKey", "identityBaselineId"
      INTO observed_version, observed_bureau, observed_digest, observed_status, observed_series_key, observed_identity_baseline_id
    FROM "IdentityCorrespondenceAssertion"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "reportVersionId" = NEW."reportVersionId"
      AND "id" = NEW."sourceId"
    FOR UPDATE;

    IF FOUND AND (
      observed_status <> 'ATTESTED'
      OR EXISTS (
        SELECT 1 FROM "IdentityCorrespondenceAssertion" successor
        WHERE successor."tenantId" = NEW."tenantId"
          AND successor."consumerId" = NEW."consumerId"
          AND successor."assertionSeriesKey" = observed_series_key
          AND successor."supersedesAssertionId" = NEW."sourceId"
      )
      OR EXISTS (
        SELECT 1 FROM "IdentityBaseline" successor_baseline
        WHERE successor_baseline."tenantId" = NEW."tenantId"
          AND successor_baseline."consumerId" = NEW."consumerId"
          AND successor_baseline."supersedesIdentityBaselineId" = observed_identity_baseline_id
      )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action cannot bind a stale or revoked identity assertion';
    END IF;

  ELSIF NEW."sourceType" = 'IDENTITY_CATEGORY_COMPLETION' THEN
    SELECT "identityBaselineVersion", NULL::"Bureau", "sourceCompletenessSha256", "identityBaselineId"
      INTO observed_version, observed_bureau, observed_digest, observed_identity_baseline_id
    FROM "IdentityCategoryCompletion"
    WHERE "tenantId" = NEW."tenantId"
      AND "consumerId" = NEW."consumerId"
      AND "reportVersionId" = NEW."reportVersionId"
      AND "id" = NEW."sourceId"
    FOR KEY SHARE;

    IF FOUND AND EXISTS (
      SELECT 1
      FROM "IdentityBaseline" successor
      WHERE successor."tenantId" = NEW."tenantId"
        AND successor."consumerId" = NEW."consumerId"
        AND successor."supersedesIdentityBaselineId" = observed_identity_baseline_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action cannot bind an identity category completion from a stale confirmed baseline';
    END IF;
  END IF;

  IF NEW."sourceType" IN (
    'IDENTITY_FACT',
    'IDENTITY_CORRESPONDENCE_ASSERTION',
    'IDENTITY_CATEGORY_COMPLETION'
  ) AND observed_identity_baseline_id IS NOT NULL THEN
    PERFORM 1
    FROM "IdentityBaseline" baseline
    WHERE baseline."tenantId" = NEW."tenantId"
      AND baseline."consumerId" = NEW."consumerId"
      AND baseline."id" = observed_identity_baseline_id
      AND baseline."status" = 'CONFIRMED'
    FOR UPDATE;

    IF NOT FOUND
       OR EXISTS (
         SELECT 1
         FROM "IdentityBaseline" successor
         WHERE successor."tenantId" = NEW."tenantId"
           AND successor."consumerId" = NEW."consumerId"
           AND successor."supersedesIdentityBaselineId" = observed_identity_baseline_id
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action cannot bind identity evidence from a stale confirmed baseline';
    END IF;

    PERFORM 1
    FROM "IdentityBaselineAccountReviewMembership" membership
    JOIN "ConsumerAccountReviewReceipt" receipt
      ON receipt."tenantId" = membership."tenantId"
     AND receipt."consumerId" = membership."consumerId"
     AND receipt."id" = membership."consumerAccountReviewReceiptId"
    WHERE membership."tenantId" = NEW."tenantId"
      AND membership."consumerId" = NEW."consumerId"
      AND membership."confirmedIdentityBaselineId" = observed_identity_baseline_id
    FOR KEY SHARE OF receipt;

    IF EXISTS (
      SELECT 1
      FROM "IdentityBaselineAccountReviewMembership" membership
      JOIN "ConsumerAccountReviewReceipt" receipt
        ON receipt."tenantId" = membership."tenantId"
       AND receipt."consumerId" = membership."consumerId"
       AND receipt."id" = membership."consumerAccountReviewReceiptId"
      WHERE membership."tenantId" = NEW."tenantId"
        AND membership."consumerId" = NEW."consumerId"
        AND membership."confirmedIdentityBaselineId" = observed_identity_baseline_id
        AND (
          receipt."reviewState" = 'REVOKED'
          OR EXISTS (
            SELECT 1
            FROM "ConsumerAccountReviewReceipt" successor
            WHERE successor."tenantId" = receipt."tenantId"
              AND successor."consumerId" = receipt."consumerId"
              AND successor."reviewSeriesKey" = receipt."reviewSeriesKey"
              AND successor."supersedesReviewId" = receipt."id"
          )
        )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action cannot bind identity evidence whose account-review membership is stale';
    END IF;
  END IF;

  IF observed_version IS NULL
     OR observed_version IS DISTINCT FROM NEW."sourceVersion"
     OR observed_bureau IS DISTINCT FROM NEW."bureau"
     OR observed_digest IS DISTINCT FROM NEW."integritySha256" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action source reference does not match exact scoped evidence';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "CaseActionSourceRef_validate_trg"
BEFORE INSERT ON "CaseActionSourceRef"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_case_action_source_ref();

CREATE FUNCTION p0_2a_validate_case_action_source_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  decision_row "CaseActionDecision"%ROWTYPE;
  target_decision_id TEXT;
  actual_source_count INTEGER;
  canonical_source_json TEXT;
  actual_source_sha256 TEXT;
BEGIN
  IF TG_TABLE_NAME = 'CaseActionDecision' THEN
    target_decision_id := NEW."id";
  ELSIF TG_TABLE_NAME = 'CaseActionSourceRef' THEN
    target_decision_id := NEW."decisionId";
  ELSE
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unknown case action source-seal validation table';
  END IF;

  SELECT * INTO decision_row
  FROM "CaseActionDecision"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "id" = target_decision_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'unknown case action decision source seal';
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    '[' || COALESCE(
      string_agg(
        '["' || membership."sourceType"::TEXT
          || '","' || membership."sourceId"
          || '",' || membership."sourceVersion"::TEXT
          || ',' || CASE
            WHEN membership."bureau" IS NULL THEN 'null'
            ELSE '"' || membership."bureau"::TEXT || '"'
          END
          || ',"' || membership."integritySha256" || '"]',
        ',' ORDER BY
          convert_to(membership."sourceType"::TEXT, 'UTF8'),
          convert_to(membership."sourceId", 'UTF8'),
          membership."sourceVersion",
          convert_to(COALESCE(membership."bureau"::TEXT, ''), 'UTF8')
      ),
      ''
    ) || ']'
  INTO actual_source_count, canonical_source_json
  FROM "CaseActionSourceRef" membership
  WHERE membership."tenantId" = decision_row."tenantId"
    AND membership."consumerId" = decision_row."consumerId"
    AND membership."decisionId" = decision_row."id";

  actual_source_sha256 := encode(
    sha256(convert_to(canonical_source_json, 'UTF8')),
    'hex'
  );

  IF actual_source_count <> decision_row."expectedSourceCount"
     OR actual_source_sha256 <> decision_row."sourceSetSha256" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action source count or canonical digest does not match the durable seal';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        membership."ordinal",
        row_number() OVER (
          ORDER BY
            convert_to(membership."sourceType"::TEXT, 'UTF8'),
            convert_to(membership."sourceId", 'UTF8'),
            membership."sourceVersion",
            convert_to(COALESCE(membership."bureau"::TEXT, ''), 'UTF8')
        ) - 1 AS canonical_ordinal
      FROM "CaseActionSourceRef" membership
      WHERE membership."tenantId" = decision_row."tenantId"
        AND membership."consumerId" = decision_row."consumerId"
        AND membership."decisionId" = decision_row."id"
    ) ordered_membership
    WHERE ordered_membership."ordinal" <> ordered_membership.canonical_ordinal
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action source ordinals are not canonical and contiguous';
  END IF;

  IF decision_row."supersedesDecisionId" IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM (
        SELECT "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
        FROM "CaseActionSourceRef"
        WHERE "tenantId" = decision_row."tenantId"
          AND "consumerId" = decision_row."consumerId"
          AND "decisionId" = decision_row."id"
        EXCEPT
        SELECT "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
        FROM "CaseActionSourceRef"
        WHERE "tenantId" = decision_row."tenantId"
          AND "consumerId" = decision_row."consumerId"
          AND "decisionId" = decision_row."supersedesDecisionId"
      ) new_difference
    )
    OR EXISTS (
      SELECT 1 FROM (
        SELECT "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
        FROM "CaseActionSourceRef"
        WHERE "tenantId" = decision_row."tenantId"
          AND "consumerId" = decision_row."consumerId"
          AND "decisionId" = decision_row."supersedesDecisionId"
        EXCEPT
        SELECT "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
        FROM "CaseActionSourceRef"
        WHERE "tenantId" = decision_row."tenantId"
          AND "consumerId" = decision_row."consumerId"
          AND "decisionId" = decision_row."id"
      ) prior_difference
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'case action supersession changed exact normalized source membership';
  END IF;

  IF decision_row."state" = 'CONSUMER_SELECTED'
     AND decision_row."actionCode" = 'REQUEST_ACCOUNT_CORRECTION'
     AND NOT EXISTS (
       SELECT 1
       FROM "CaseActionSourceRef" membership
       JOIN "ConsumerAssertion" assertion
         ON assertion."tenantId" = membership."tenantId"
        AND assertion."consumerId" = membership."consumerId"
        AND assertion."reportVersionId" = membership."reportVersionId"
        AND assertion."id" = membership."sourceId"
       WHERE membership."tenantId" = decision_row."tenantId"
         AND membership."consumerId" = decision_row."consumerId"
         AND membership."decisionId" = decision_row."id"
         AND membership."sourceType" = 'CONSUMER_ASSERTION'
         AND assertion."disposition" IN ('CONFIRMED_INACCURATE', 'NOT_MINE', 'OUTDATED_UPDATE_REQUESTED')
         AND (assertion."expiresAt" IS NULL OR assertion."expiresAt" > (clock_timestamp() AT TIME ZONE 'UTC'))
         AND NOT EXISTS (
           SELECT 1
           FROM "ConsumerAssertion" successor
           WHERE successor."tenantId" = assertion."tenantId"
             AND successor."consumerId" = assertion."consumerId"
             AND successor."assertionSeriesKey" = assertion."assertionSeriesKey"
             AND successor."supersedesAssertionId" = assertion."id"
         )
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'selected account correction requires a current consumer correction assertion';
  END IF;

  IF decision_row."state" = 'CONSUMER_SELECTED'
     AND decision_row."actionCode" = 'REQUEST_IDENTITY_CORRECTION'
     AND NOT EXISTS (
       SELECT 1
       FROM "CaseActionSourceRef" membership
       JOIN "IdentityCorrespondenceAssertion" assertion
         ON assertion."tenantId" = membership."tenantId"
        AND assertion."consumerId" = membership."consumerId"
        AND assertion."reportVersionId" = membership."reportVersionId"
        AND assertion."id" = membership."sourceId"
       WHERE membership."tenantId" = decision_row."tenantId"
         AND membership."consumerId" = decision_row."consumerId"
         AND membership."decisionId" = decision_row."id"
         AND membership."sourceType" = 'IDENTITY_CORRESPONDENCE_ASSERTION'
         AND assertion."status" = 'ATTESTED'
         AND assertion."correspondencePurposeCode" = 'CORRESPONDENCE_IDENTITY_CORRECTION'
         AND NOT EXISTS (
           SELECT 1
           FROM "IdentityCorrespondenceAssertion" successor
           WHERE successor."tenantId" = assertion."tenantId"
             AND successor."consumerId" = assertion."consumerId"
             AND successor."assertionSeriesKey" = assertion."assertionSeriesKey"
             AND successor."supersedesAssertionId" = assertion."id"
         )
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'selected identity correction requires a current identity correction assertion';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "CaseActionDecision_source_membership_trg"
AFTER INSERT ON "CaseActionDecision"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_case_action_source_membership();

CREATE CONSTRAINT TRIGGER "CaseActionSourceRef_source_membership_trg"
AFTER INSERT ON "CaseActionSourceRef"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_case_action_source_membership();

-- ALLOW records must resolve the exact scoped resource/version. DENY records
-- preserve the attempted opaque ref even when the resource is absent, while a
-- RESOURCE_NOT_FOUND reason is rejected if the exact resource does exist.
CREATE FUNCTION p0_2a_validate_sensitive_access_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  resource_found BOOLEAN := FALSE;
BEGIN
  IF NEW."accessKind" = 'AGENCY' AND (
    NEW."authorizationKind" <> 'AGENCY_MANAGED_CLIENT'
    OR NEW."purposeCode" <> 'AGENCY_MANAGED_CLIENT_SERVICE'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'agency access kind requires exact managed-client authority and purpose';
  END IF;

  IF NEW."accessKind" = 'ADMIN' AND (
    NEW."authorizationKind" <> 'ADMIN_IMPERSONATION'
    OR NEW."purposeCode" <> 'ADMIN_SUPPORT'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'admin access kind requires exact impersonation authority and purpose';
  END IF;

  IF NEW."accessKind" = 'WORKER' AND (
    NEW."authorizationKind" <> 'SYSTEM_WORKER'
    OR NEW."purposeCode" NOT IN ('REPORT_INGESTION', 'INTEGRITY_VERIFICATION', 'WORKER_EXTRACTION')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'worker access kind requires exact worker authority and bounded purpose';
  END IF;

  IF NEW."resourceType" = 'REPORT_INGESTION' AND (
    NEW."accessKind" <> 'WORKER'
    OR NEW."authorizationKind" <> 'SYSTEM_WORKER'
    OR NEW."purposeCode" <> 'REPORT_INGESTION'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'report ingestion resource access requires the exact pre-store worker purpose';
  END IF;

  IF NEW."resourceType" = 'REPORT_INGESTION' THEN
    SELECT EXISTS (
      SELECT 1
      FROM "ReportIngestion" ingestion
      WHERE ingestion."tenantId" = NEW."tenantId"
        AND ingestion."consumerId" = NEW."consumerId"
        AND ingestion."id" = NEW."resourceId"
        AND ingestion."revision" = NEW."resourceVersion"
    ) INTO resource_found;
  ELSIF NEW."resourceType" IN ('REPORT_SOURCE', 'NORMALIZED_REPORT_TEXT', 'ARTIFACT') THEN
    SELECT EXISTS (
      SELECT 1
      FROM "Artifact" artifact
      WHERE artifact."tenantId" = NEW."tenantId"
        AND artifact."consumerId" = NEW."consumerId"
        AND artifact."id" = NEW."resourceId"
        AND artifact."version" = NEW."resourceVersion"
        AND (
          NEW."resourceType" = 'ARTIFACT'
          OR (NEW."resourceType" = 'REPORT_SOURCE' AND artifact."kind" = 'REPORT_SOURCE')
          OR (
            NEW."resourceType" = 'NORMALIZED_REPORT_TEXT'
            AND EXISTS (
              SELECT 1
              FROM "ExtractionRun" run
              WHERE run."tenantId" = artifact."tenantId"
                AND run."consumerId" = artifact."consumerId"
                AND run."inputArtifactId" = artifact."id"
                AND run."inputSha256" = artifact."sha256"
                AND run."inputRepresentation" = 'DERIVED_NORMALIZED_TEXT'
            )
          )
        )
    ) INTO resource_found;
  ELSIF NEW."resourceType" = 'REPORT_VERSION' THEN
    SELECT EXISTS (
      SELECT 1
      FROM "ReportVersion"
      WHERE "tenantId" = NEW."tenantId"
        AND "consumerId" = NEW."consumerId"
        AND "id" = NEW."resourceId"
        AND "version" = NEW."resourceVersion"
    ) INTO resource_found;
  ELSIF NEW."resourceType" = 'IDENTITY_FACT_VALUE' THEN
    SELECT EXISTS (
      SELECT 1
      FROM "IdentityFact" fact
      JOIN "IdentityBaseline" baseline
        ON baseline."tenantId" = fact."tenantId"
       AND baseline."consumerId" = fact."consumerId"
       AND baseline."reportVersionId" = fact."reportVersionId"
       AND baseline."id" = fact."identityBaselineId"
      WHERE fact."tenantId" = NEW."tenantId"
        AND fact."consumerId" = NEW."consumerId"
        AND fact."id" = NEW."resourceId"
        AND baseline."version" = NEW."resourceVersion"
    ) INTO resource_found;
  ELSIF NEW."resourceType" = 'CONSUMER_ASSERTION_STATEMENT' THEN
    SELECT EXISTS (
      SELECT 1
      FROM "ConsumerAssertion"
      WHERE "tenantId" = NEW."tenantId"
        AND "consumerId" = NEW."consumerId"
        AND "id" = NEW."resourceId"
        AND "version" = NEW."resourceVersion"
    ) INTO resource_found;
  END IF;

  IF NEW."decision" = 'ALLOW' AND NOT resource_found THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'allowed sensitive access requires an exact scoped resource version';
  END IF;

  IF NEW."decisionCode" = 'RESOURCE_NOT_FOUND' AND resource_found THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'resource-not-found denial contradicts exact scoped resource truth';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "P0SensitiveAccessEvent_validate_trg"
BEFORE INSERT ON "P0SensitiveAccessEvent"
FOR EACH ROW EXECUTE FUNCTION p0_2a_validate_sensitive_access_event();

-- Immutable evidence/receipt ledgers reuse the Phase 1 append-only guard. The
-- operational queue alone permits revisioned updates and still forbids deletion.
CREATE TRIGGER "ReportIngestion_no_delete_trg" BEFORE DELETE OR TRUNCATE ON "ReportIngestion" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "BureauReportDateEvidence_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "BureauReportDateEvidence" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "Round0SourceCompletenessEvidence_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "Round0SourceCompletenessEvidence" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "IdentityCategoryCompletion_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "IdentityCategoryCompletion" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "IdentityCorrespondenceAssertion_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "IdentityCorrespondenceAssertion" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "ConsumerAccountReviewReceipt_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "ConsumerAccountReviewReceipt" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "IdentityBaselineAccountReviewMembership_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "IdentityBaselineAccountReviewMembership" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "CaseActionDecision_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "CaseActionDecision" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "CaseActionSourceRef_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "CaseActionSourceRef" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
CREATE TRIGGER "P0SensitiveAccessEvent_append_only_trg" BEFORE UPDATE OR DELETE OR TRUNCATE ON "P0SensitiveAccessEvent" FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();
