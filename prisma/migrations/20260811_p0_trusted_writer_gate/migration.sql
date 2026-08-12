-- P0 trusted-writer implementation gate. Additive only.

ALTER TABLE "User"
  ADD COLUMN "p0AuthorizationRevision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "User"
  ADD CONSTRAINT "User_p0_authorization_revision_ck"
  CHECK ("p0AuthorizationRevision" > 0);

-- Phase 1 created the immutable assertion table, but Phase 2A's accepted
-- runtime record also binds a stable operation identity. No production writer
-- exists before this gate, so this additive column does not backfill testimony.
ALTER TABLE "ConsumerAssertion"
  ADD COLUMN "operationId" TEXT NOT NULL;

ALTER TABLE "ConsumerAssertion"
  ADD CONSTRAINT "ConsumerAssertion_operation_id_ck"
  CHECK ("operationId" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$');

CREATE UNIQUE INDEX "consumer_assertion_operation_key"
  ON "ConsumerAssertion"("tenantId", "consumerId", "operationId");

CREATE FUNCTION p0_trusted_writer_bump_authorization_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."p0AuthorizationRevision" := 1;
    RETURN NEW;
  END IF;

  IF NEW."p0AuthorizationRevision" IS DISTINCT FROM OLD."p0AuthorizationRevision" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'P0 authorization revision is database controlled';
  END IF;

  IF NEW."disabled" IS DISTINCT FROM OLD."disabled"
     OR NEW."role" IS DISTINCT FROM OLD."role"
     OR NEW."isAgency" IS DISTINCT FROM OLD."isAgency"
     OR NEW."managedByAgencyId" IS DISTINCT FROM OLD."managedByAgencyId" THEN
    IF OLD."p0AuthorizationRevision" >= 2147483647 THEN
      RAISE EXCEPTION USING
        ERRCODE = '22003',
        MESSAGE = 'P0 authorization revision exhausted';
    END IF;
    NEW."p0AuthorizationRevision" := OLD."p0AuthorizationRevision" + 1;
  ELSE
    NEW."p0AuthorizationRevision" := OLD."p0AuthorizationRevision";
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "User_p0_authorization_revision_trg"
BEFORE INSERT OR UPDATE ON "User"
FOR EACH ROW EXECUTE FUNCTION p0_trusted_writer_bump_authorization_revision();

CREATE TABLE "P0SourceObject" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "consumerId" TEXT NOT NULL,
  "ingestionId" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "artifactVersion" INTEGER NOT NULL,
  "providerOperationId" TEXT NOT NULL,
  "providerObjectVersion" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "byteLength" BIGINT NOT NULL,
  "ciphertext" BYTEA NOT NULL,
  "iv" BYTEA NOT NULL,
  "authTag" BYTEA NOT NULL,
  "keyVersion" TEXT NOT NULL,
  "algorithm" "EncryptionAlgorithm" NOT NULL,
  "envelopeVersion" TEXT NOT NULL,
  "aadVersion" TEXT NOT NULL,
  "aadSha256" VARCHAR(64) NOT NULL,
  "locatorCiphertext" BYTEA NOT NULL,
  "locatorIv" BYTEA NOT NULL,
  "locatorAuthTag" BYTEA NOT NULL,
  "locatorKeyVersion" TEXT NOT NULL,
  "locatorAlgorithm" "EncryptionAlgorithm" NOT NULL,
  "locatorEnvelopeVersion" TEXT NOT NULL,
  "locatorAadVersion" TEXT NOT NULL,
  "locatorAadSha256" VARCHAR(64) NOT NULL,
  "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "P0SourceObject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "P0SourceObject_artifact_version_ck"
    CHECK ("artifactVersion" > 0),
  CONSTRAINT "P0SourceObject_digest_ck"
    CHECK (
      "sha256" ~ '^[0-9a-f]{64}$'
      AND "aadSha256" ~ '^[0-9a-f]{64}$'
      AND "locatorAadSha256" ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT "P0SourceObject_byte_length_ck"
    CHECK (
      "byteLength" > 0
      AND "byteLength" <= 15728640
      AND octet_length("ciphertext") = "byteLength"
    ),
  CONSTRAINT "P0SourceObject_content_envelope_ck"
    CHECK (
      octet_length("ciphertext") > 0
      AND octet_length("iv") = 12
      AND octet_length("authTag") = 16
      AND "algorithm" = 'AES_256_GCM'
      AND "keyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
      AND "envelopeVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
      AND "aadVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
    ),
  CONSTRAINT "P0SourceObject_locator_envelope_ck"
    CHECK (
      octet_length("locatorCiphertext") > 0
      AND octet_length("locatorIv") = 12
      AND octet_length("locatorAuthTag") = 16
      AND "locatorAlgorithm" = 'AES_256_GCM'
      AND "locatorKeyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
      AND "locatorEnvelopeVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
      AND "locatorAadVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
    ),
  CONSTRAINT "P0SourceObject_identity_ck"
    CHECK (
      "id" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
      AND "artifactId" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
      AND "providerOperationId" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
      AND "providerObjectVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$'
    ),
  CONSTRAINT "P0SourceObject_kind_mime_ck"
    CHECK (
      ("kind" = 'ORIGINAL_PDF' AND "mimeType" = 'application/pdf')
      OR (
        "kind" IN ('ORIGINAL_TEXT', 'NORMALIZED_TEXT')
        AND "mimeType" = 'text/plain'
      )
    )
);

CREATE UNIQUE INDEX "p0_source_object_scope_id_key"
  ON "P0SourceObject"("tenantId", "consumerId", "id");
CREATE UNIQUE INDEX "p0_source_object_artifact_version_key"
  ON "P0SourceObject"("tenantId", "consumerId", "artifactId", "artifactVersion");
CREATE UNIQUE INDEX "p0_source_object_provider_operation_key"
  ON "P0SourceObject"("tenantId", "consumerId", "providerOperationId");
CREATE UNIQUE INDEX "p0_source_object_provider_object_version_key"
  ON "P0SourceObject"("tenantId", "consumerId", "providerObjectVersion");
CREATE INDEX "p0_source_object_ingestion_idx"
  ON "P0SourceObject"("tenantId", "consumerId", "ingestionId");

ALTER TABLE "P0SourceObject"
  ADD CONSTRAINT "P0SourceObject_tenantId_consumerId_fkey"
  FOREIGN KEY ("tenantId", "consumerId")
  REFERENCES "CreditTruthScope"("tenantId", "consumerId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "P0SourceObject"
  ADD CONSTRAINT "p0_source_object_ingestion_fkey"
  FOREIGN KEY ("tenantId", "consumerId", "ingestionId")
  REFERENCES "ReportIngestion"("tenantId", "consumerId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION p0_trusted_writer_validate_source_object_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_ingestion "ReportIngestion"%ROWTYPE;
BEGIN
  SELECT * INTO linked_ingestion
  FROM "ReportIngestion"
  WHERE "tenantId" = NEW."tenantId"
    AND "consumerId" = NEW."consumerId"
    AND "id" = NEW."ingestionId"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'P0 source object requires an exact scoped ingestion';
  END IF;

  IF linked_ingestion."sourceDisposition" <> 'RETAINED'
     OR (
       NEW."kind" IN ('ORIGINAL_PDF', 'ORIGINAL_TEXT')
       AND (
         linked_ingestion."state" <> 'RECEIVED'
         OR linked_ingestion."sourceSha256" <> NEW."sha256"
         OR linked_ingestion."sourceByteLength" <> NEW."byteLength"
         OR linked_ingestion."sourceDetectedMimeType" <> NEW."mimeType"
       )
     )
     OR (
       NEW."kind" = 'NORMALIZED_TEXT'
       AND linked_ingestion."state" NOT IN ('VERSION_COMMITTED', 'EXTRACTING')
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'P0 source object write fence rejected stale or substituted source';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "P0SourceObject_write_fence_trg"
BEFORE INSERT ON "P0SourceObject"
FOR EACH ROW EXECUTE FUNCTION p0_trusted_writer_validate_source_object_insert();

-- The accepted Phase 2A state trigger proves the locator/readback tuple is
-- internally complete. This gate additionally requires that every state which
-- treats that tuple as verified is backed by one exact concrete source row.
-- A caller cannot select a legacy/synthetic provider key or an unrelated
-- encrypted object and then CAS the ingestion into source-authoritative state.
CREATE FUNCTION p0_trusted_writer_validate_ingestion_source_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  exact_source_count INTEGER;
BEGIN
  IF NEW."state" IN (
    'SOURCE_STORED_AND_VERIFIED',
    'VERSION_COMMITTED',
    'EXTRACTING',
    'SUCCEEDED',
    'PARTIAL',
    'ASSESSED',
    'ROUND0_READY'
  ) THEN
    IF NEW."sourceStorageProviderKey" <> 'P0_PRISMA_ENCRYPTED_SOURCE' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'P0 source authority requires the concrete encrypted source provider';
    END IF;

    SELECT count(*) INTO exact_source_count
    FROM "P0SourceObject" source_object
    WHERE source_object."tenantId" = NEW."tenantId"
      AND source_object."consumerId" = NEW."consumerId"
      AND source_object."ingestionId" = NEW."id"
      AND source_object."kind" = CASE
        WHEN NEW."sourceDetectedMimeType" = 'application/pdf' THEN 'ORIGINAL_PDF'
        ELSE 'ORIGINAL_TEXT'
      END
      AND source_object."mimeType" = NEW."sourceDetectedMimeType"
      AND source_object."sha256" = NEW."sourceSha256"
      AND source_object."byteLength" = NEW."sourceByteLength"
      AND source_object."locatorCiphertext" = NEW."sourceLocatorCiphertext"
      AND source_object."locatorIv" = NEW."sourceLocatorIv"
      AND source_object."locatorAuthTag" = NEW."sourceLocatorAuthTag"
      AND source_object."locatorKeyVersion" = NEW."sourceLocatorKeyVersion"
      AND source_object."locatorAlgorithm" = NEW."sourceLocatorAlgorithm"
      AND source_object."locatorEnvelopeVersion" = NEW."sourceLocatorEnvelopeVersion"
      AND source_object."locatorAadVersion" = NEW."sourceLocatorAadVersion"
      AND (
        NEW."state" = 'SOURCE_STORED_AND_VERIFIED'
        OR source_object."artifactId" = NEW."sourceArtifactId"
      );

    IF exact_source_count <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'P0 ingestion source authority lacks one exact encrypted source object';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ReportIngestion_p0_source_authority_trg"
BEFORE INSERT OR UPDATE ON "ReportIngestion"
FOR EACH ROW EXECUTE FUNCTION p0_trusted_writer_validate_ingestion_source_authority();

-- Encrypted object bytes are immutable. DELETE remains intentionally separate
-- for a future explicitly authorized crypto-shred/erasure transaction.
CREATE TRIGGER "P0SourceObject_no_update_truncate_trg"
BEFORE UPDATE OR TRUNCATE ON "P0SourceObject"
FOR EACH STATEMENT EXECUTE FUNCTION p0_forbid_immutable_mutation();

-- Phase 2A rejected long digit runs in refs-only audit fields as a PII guard.
-- The concrete trusted writer derives several of those refs from SHA-256 and a
-- valid digest can naturally contain nine consecutive digits. Permit only the
-- exact server-owned typed forms; every untyped value retains the original
-- long-digit rejection.
ALTER TABLE "P0SensitiveAccessEvent"
  DROP CONSTRAINT "P0SensitiveAccessEvent_refs_only_ck";

ALTER TABLE "P0SensitiveAccessEvent"
  ADD CONSTRAINT "P0SensitiveAccessEvent_refs_only_ck" CHECK (
    "eventKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
    AND "actorId" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
    AND "authorizationVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
    AND "resourceId" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
    AND "correlationId" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'
    AND (
      "eventKey" !~ '[0-9]{9}'
      OR "eventKey" ~ '^p0evt_[0-9a-f]{64}$'
    )
    AND "actorId" !~ '[0-9]{9}'
    AND (
      "authorizationVersion" !~ '[0-9]{9}'
      OR "authorizationVersion" ~ '^p0-authz-(worker|direct|managed):[0-9a-f]{64}$'
    )
    AND (
      "resourceId" !~ '[0-9]{9}'
      OR "resourceId" ~ '^p0(ing|src|obj|rv|evt|corr|op)_[0-9a-f]{16,64}$'
    )
    AND (
      "correlationId" !~ '[0-9]{9}'
      OR "correlationId" ~ '^p0corr_[0-9a-f]{64}$'
    )
  );
