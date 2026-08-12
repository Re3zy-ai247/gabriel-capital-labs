\set ON_ERROR_STOP on

-- PostgreSQL role attributes, memberships, settings, ACLs, grants, revokes,
-- and the exact allowlist audit below are one authorization decision.  A late
-- audit rejection must not leave any earlier normalization or grant durable.
BEGIN;

-- Owner-run LOCAL privilege contract for the dormant P0 trusted writer.
--
-- This script intentionally normalizes an existing dedicated writer role
-- before granting the exact current Phase 2A runtime matrix. It is a
-- point-in-time local/deployment verification contract, not proof of the
-- privileges installed in any deployed environment. Deployment automation
-- must run this contract and preserve its successful audit as separate
-- DEPLOYED ROLE ATTESTATION evidence before activation.
--
-- Required psql variables:
--   p0_writer_role
--   p0_writer_database
--   p0_role_contract_sentinel=P0_TRUSTED_WRITER_ROLE_CONTRACT

SELECT set_config(
  'creditvector.p0_writer_role_contract_sentinel',
  :'p0_role_contract_sentinel',
  false
);
SELECT set_config('creditvector.p0_writer_role_name', :'p0_writer_role', false);
SELECT set_config('creditvector.p0_writer_database_name', :'p0_writer_database', false);

DO $p0_contract$
DECLARE
  writer_role text := current_setting('creditvector.p0_writer_role_name', true);
  writer_database text := current_setting('creditvector.p0_writer_database_name', true);
BEGIN
  IF current_setting('creditvector.p0_writer_role_contract_sentinel', true)
      <> 'P0_TRUSTED_WRITER_ROLE_CONTRACT' THEN
    RAISE EXCEPTION 'P0 trusted-writer role-contract sentinel missing';
  END IF;
  IF writer_role !~ '^p0_writer_[a-z0-9_]{1,48}$'
     OR writer_database !~ '^[a-z][a-z0-9_]{1,62}$' THEN
    RAISE EXCEPTION 'unsafe P0 writer role or database identifier';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = writer_role) THEN
    RAISE EXCEPTION 'P0 writer role does not exist';
  END IF;
  IF writer_role = current_user OR writer_role = session_user THEN
    RAISE EXCEPTION 'role contract must be applied by a distinct owner role';
  END IF;
  IF current_database() <> writer_database THEN
    RAISE EXCEPTION 'role contract connected to unexpected database';
  END IF;
END;
$p0_contract$;

-- Administrative capabilities and SET ROLE paths are not runtime needs.
SELECT format(
  'ALTER ROLE %I NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
  :'p0_writer_role'
) \gexec
SELECT format(
  'REVOKE %I FROM %I',
  granted_role.rolname,
  :'p0_writer_role'
)
FROM pg_auth_members membership
JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
JOIN pg_roles member_role ON member_role.oid = membership.member
WHERE member_role.rolname = :'p0_writer_role'
\gexec

-- The inverse edge is equally authoritative: no login/service role may assume
-- the dedicated writer and issue raw SQL outside the authenticated chain.
SELECT format(
  'REVOKE %I FROM %I',
  :'p0_writer_role',
  member_role.rolname
)
FROM pg_auth_members membership
JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
JOIN pg_roles member_role ON member_role.oid = membership.member
WHERE granted_role.rolname = :'p0_writer_role'
\gexec

-- Login defaults are authority-bearing configuration. Remove every global or
-- database-specific setting owned by the dedicated writer. Database-wide
-- defaults are shared policy and are audited fail-closed below rather than
-- rewritten by this role-scoped contract.
SELECT format('ALTER ROLE %I RESET ALL', :'p0_writer_role')
WHERE EXISTS (
  SELECT 1 FROM pg_db_role_setting settings
  WHERE settings.setrole = (
    SELECT oid FROM pg_roles WHERE rolname = :'p0_writer_role'
  )
    AND settings.setdatabase = 0
)
\gexec

SELECT format(
  'ALTER ROLE %I IN DATABASE %I RESET ALL',
  :'p0_writer_role',
  database.datname
)
FROM pg_db_role_setting settings
JOIN pg_database database ON database.oid = settings.setdatabase
WHERE settings.setrole = (
  SELECT oid FROM pg_roles WHERE rolname = :'p0_writer_role'
)
\gexec

-- PostgreSQL 16 parameter ACLs can delegate otherwise-superuser-only SET
-- authority. The runtime writer needs no parameter privilege; normalize every
-- direct parameter ACL for this dedicated role.
SELECT format(
  'REVOKE ALL PRIVILEGES ON PARAMETER %I FROM %I',
  parameter.parname,
  :'p0_writer_role'
)
FROM pg_parameter_acl parameter
\gexec

-- A direct ACL reset is incomplete if ALTER DEFAULT PRIVILEGES can mint the
-- same authority on the next object. Remove only defaults whose grantee is the
-- dedicated writer, preserving every other role's policy. Global defaults use
-- no IN SCHEMA clause; per-schema defaults are normalized at their exact owner
-- and schema.
SELECT DISTINCT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I%s REVOKE ALL PRIVILEGES ON TABLES FROM %I',
  owner_role.rolname,
  CASE WHEN defaults.defaclnamespace = 0 THEN ''
    ELSE format(' IN SCHEMA %I', namespace.nspname) END,
  :'p0_writer_role'
)
FROM pg_default_acl defaults
JOIN pg_roles owner_role ON owner_role.oid = defaults.defaclrole
LEFT JOIN pg_namespace namespace ON namespace.oid = defaults.defaclnamespace
CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
WHERE defaults.defaclobjtype = 'r'
  AND privilege.grantee = (SELECT oid FROM pg_roles WHERE rolname = :'p0_writer_role')
\gexec

SELECT DISTINCT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I%s REVOKE ALL PRIVILEGES ON SEQUENCES FROM %I',
  owner_role.rolname,
  CASE WHEN defaults.defaclnamespace = 0 THEN ''
    ELSE format(' IN SCHEMA %I', namespace.nspname) END,
  :'p0_writer_role'
)
FROM pg_default_acl defaults
JOIN pg_roles owner_role ON owner_role.oid = defaults.defaclrole
LEFT JOIN pg_namespace namespace ON namespace.oid = defaults.defaclnamespace
CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
WHERE defaults.defaclobjtype = 'S'
  AND privilege.grantee = (SELECT oid FROM pg_roles WHERE rolname = :'p0_writer_role')
\gexec

SELECT DISTINCT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I%s REVOKE ALL PRIVILEGES ON ROUTINES FROM %I',
  owner_role.rolname,
  CASE WHEN defaults.defaclnamespace = 0 THEN ''
    ELSE format(' IN SCHEMA %I', namespace.nspname) END,
  :'p0_writer_role'
)
FROM pg_default_acl defaults
JOIN pg_roles owner_role ON owner_role.oid = defaults.defaclrole
LEFT JOIN pg_namespace namespace ON namespace.oid = defaults.defaclnamespace
CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
WHERE defaults.defaclobjtype = 'f'
  AND privilege.grantee = (SELECT oid FROM pg_roles WHERE rolname = :'p0_writer_role')
  -- Removing the last ACL from another owner's function default can restore
  -- PostgreSQL's hard-wired PUBLIC EXECUTE. This dedicated-role contract may
  -- normalize only its own owner policy; a foreign-owner default remains for
  -- the exact audit below to reject without changing shared authorization.
  AND defaults.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = :'p0_writer_role')
\gexec

SELECT DISTINCT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I%s REVOKE ALL PRIVILEGES ON TYPES FROM %I',
  owner_role.rolname,
  CASE WHEN defaults.defaclnamespace = 0 THEN ''
    ELSE format(' IN SCHEMA %I', namespace.nspname) END,
  :'p0_writer_role'
)
FROM pg_default_acl defaults
JOIN pg_roles owner_role ON owner_role.oid = defaults.defaclrole
LEFT JOIN pg_namespace namespace ON namespace.oid = defaults.defaclnamespace
CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
WHERE defaults.defaclobjtype = 'T'
  AND privilege.grantee = (SELECT oid FROM pg_roles WHERE rolname = :'p0_writer_role')
\gexec

SELECT DISTINCT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL PRIVILEGES ON SCHEMAS FROM %I',
  owner_role.rolname,
  :'p0_writer_role'
)
FROM pg_default_acl defaults
JOIN pg_roles owner_role ON owner_role.oid = defaults.defaclrole
CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
WHERE defaults.defaclobjtype = 'n'
  AND privilege.grantee = (SELECT oid FROM pg_roles WHERE rolname = :'p0_writer_role')
\gexec

-- Defaults owned by the dedicated writer affect no existing object or other
-- owner's policy. Normalize its future PUBLIC surface as a defense in depth,
-- even though the role has no database/schema CREATE authority.
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC',
  :'p0_writer_role'
) \gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC',
  :'p0_writer_role'
) \gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL PRIVILEGES ON ROUTINES FROM PUBLIC',
  :'p0_writer_role'
) \gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL PRIVILEGES ON TYPES FROM PUBLIC',
  :'p0_writer_role'
) \gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL PRIVILEGES ON SCHEMAS FROM PUBLIC',
  :'p0_writer_role'
) \gexec

-- Ownership grants implicit authority which ACL revocation cannot remove.
-- Reassignment is deliberately not guessed here; an unexpected owner blocks
-- the contract and requires an explicit infrastructure decision.
DO $p0_ownership$
DECLARE
  writer_role text := current_setting('creditvector.p0_writer_role_name');
  writer_oid oid := (SELECT oid FROM pg_roles WHERE rolname = writer_role);
BEGIN
  IF EXISTS (SELECT 1 FROM pg_database WHERE datdba = writer_oid)
     OR EXISTS (
       SELECT 1
       FROM pg_namespace
       WHERE nspowner = writer_oid
         AND nspname NOT LIKE 'pg\_%' ESCAPE '\'
         AND nspname <> 'information_schema'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       WHERE relation.relowner = writer_oid
         AND namespace.nspname = 'public'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_proc routine
       JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
       WHERE routine.proowner = writer_oid
         AND namespace.nspname = 'public'
     )
     OR EXISTS (
       SELECT 1
       FROM pg_shdepend dependency
       WHERE dependency.refclassid = 'pg_authid'::regclass
         AND dependency.refobjid = writer_oid
         AND dependency.deptype = 'o'
         AND dependency.classid <> 'pg_default_acl'::regclass
         AND (
           dependency.dbid = 0
           OR dependency.dbid = (
             SELECT oid FROM pg_database WHERE datname = current_database()
           )
         )
     ) THEN
    RAISE EXCEPTION 'P0 writer owns a database or application object';
  END IF;
END;
$p0_ownership$;

-- Normalize database and every non-system schema. PostgreSQL PUBLIC defaults
-- can otherwise preserve TEMP/CREATE authority after a role-specific REVOKE.
SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I', :'p0_writer_database', :'p0_writer_role') \gexec
SELECT format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC', :'p0_writer_database') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'p0_writer_database', :'p0_writer_role') \gexec
SELECT format('REVOKE ALL PRIVILEGES ON SCHEMA %I FROM %I', namespace.nspname, :'p0_writer_role')
FROM pg_namespace namespace
WHERE namespace.nspname <> 'information_schema'
  AND namespace.nspname !~ '^pg_'
ORDER BY namespace.nspname
\gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'p0_writer_role') \gexec

-- Normalize all current objects in every non-system schema, including stale
-- column ACLs. Effective privilege outside public is rejected by the audit.
-- PUBLIC is normalized because PostgreSQL has no per-role DENY: a PUBLIC ACL
-- on the exact public authority schema would otherwise remain effective.
SELECT format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM %I', namespace.nspname, :'p0_writer_role')
FROM pg_namespace namespace
WHERE namespace.nspname <> 'information_schema'
  AND namespace.nspname !~ '^pg_'
ORDER BY namespace.nspname
\gexec
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
SELECT format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM %I', namespace.nspname, :'p0_writer_role')
FROM pg_namespace namespace
WHERE namespace.nspname <> 'information_schema'
  AND namespace.nspname !~ '^pg_'
ORDER BY namespace.nspname
\gexec
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
SELECT format('REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA %I FROM %I', namespace.nspname, :'p0_writer_role')
FROM pg_namespace namespace
WHERE namespace.nspname <> 'information_schema'
  AND namespace.nspname !~ '^pg_'
ORDER BY namespace.nspname
\gexec
REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;

SELECT format(
  'REVOKE ALL PRIVILEGES (%s) ON TABLE %I.%I FROM %I',
  string_agg(format('%I', attribute.attname), ', ' ORDER BY attribute.attnum),
  namespace.nspname,
  relation.relname,
  :'p0_writer_role'
)
FROM pg_class relation
JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
WHERE namespace.nspname <> 'information_schema'
  AND namespace.nspname !~ '^pg_'
  AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND attribute.attnum > 0
  AND NOT attribute.attisdropped
GROUP BY namespace.nspname, relation.relname
\gexec

-- Exact Phase 2A grants. IDs are application-generated, so the writer needs
-- no sequence privilege. No routine EXECUTE grant is part of this matrix;
-- already-installed triggers continue to enforce their constraints.
SELECT format(
  'GRANT SELECT (%s) ON TABLE public."User" TO %I',
  '"id", "disabled", "role", "isAgency", "managedByAgencyId", "p0AuthorizationRevision"',
  :'p0_writer_role'
) \gexec
SELECT format(
  'GRANT SELECT (%s) ON TABLE public."Report" TO %I',
  '"id", "userId"',
  :'p0_writer_role'
) \gexec

SELECT format(
  'GRANT SELECT, INSERT ON TABLE public.%s TO %I',
  table_name,
  :'p0_writer_role'
)
FROM unnest(ARRAY[
  '"CreditTruthScope"',
  '"ReportIngestion"',
  '"P0SourceObject"',
  '"ReportVersion"',
  '"Artifact"',
  '"ExtractionRun"',
  '"ExtractionBureauCoverage"',
  '"Round0SourceCompletenessEvidence"',
  '"Account"',
  '"ReportVersionAccount"',
  '"AccountPresenceObservation"',
  '"SectionCompleteness"',
  '"FieldObservation"',
  '"HistoricalEvidence"',
  '"CreditScoreObservation"',
  '"BureauReportDateEvidence"',
  '"IdentityBaseline"',
  '"IdentityFact"',
  '"ConsumerAssertion"',
  '"IdentityCategoryCompletion"',
  '"IdentityCorrespondenceAssertion"',
  '"ConsumerAccountReviewReceipt"',
  '"IdentityBaselineAccountReviewMembership"',
  '"CaseActionDecision"',
  '"CaseActionSourceRef"',
  '"P0SensitiveAccessEvent"'
]) AS allowed_tables(table_name)
\gexec

-- These are read-only references. Derived assessment is produced by the
-- accepted Phase 1 path, not by any of the nine concrete trusted writers.
-- Phase 2A cannot create a case or any Phase 2B correspondence/packet/
-- fulfillment object through this role.
SELECT format(
  'GRANT SELECT ON TABLE public.%s TO %I',
  table_name,
  :'p0_writer_role'
)
FROM unnest(ARRAY['"DerivedAccountAssessment"', '"DisputeCase"']) AS reference_tables(table_name)
\gexec

SELECT format(
  'GRANT UPDATE (
    "sourceStorageProviderKey",
    "sourceLocatorCiphertext",
    "sourceLocatorIv",
    "sourceLocatorAuthTag",
    "sourceLocatorKeyVersion",
    "sourceLocatorAlgorithm",
    "sourceLocatorEnvelopeVersion",
    "sourceLocatorAadVersion",
    "sourceReadbackSha256",
    "sourceReadbackByteLength",
    "sourceVerifiedAt",
    "sourceDisposition",
    "sourceDispositionReasonCode",
    "sourceDispositionAt",
    "state",
    "safeFailureCode",
    "revision",
    "attemptCount",
    "leaseToken",
    "leaseOwnerId",
    "leaseExpiresAt",
    "nextAttemptAt",
    "reportVersionId",
    "sourceArtifactId",
    "extractionRunId",
    "updatedAt"
  ) ON TABLE public."ReportIngestion" TO %I',
  :'p0_writer_role'
) \gexec

-- Executable exact allowlist audit. Every current non-system schema, relation,
-- column, sequence, and routine is checked, rather than sampling
-- known-dangerous grants. This also detects stale PUBLIC or
-- membership-derived authority through effective privilege checks. No grant
-- option is allowed.
DO $p0_verify$
DECLARE
  writer_role text := current_setting('creditvector.p0_writer_role_name');
  writer_database text := current_setting('creditvector.p0_writer_database_name');
  writer_oid oid := (SELECT oid FROM pg_roles WHERE rolname = writer_role);
  role_record record;
  schema_record record;
  relation_record record;
  column_record record;
  sequence_record record;
  routine_record record;
  privilege_name text;
  actual boolean;
  expected boolean;
  writable_tables text[] := ARRAY[
    'CreditTruthScope', 'ReportIngestion', 'P0SourceObject', 'ReportVersion',
    'Artifact', 'ExtractionRun',
    'ExtractionBureauCoverage', 'Round0SourceCompletenessEvidence', 'Account',
    'ReportVersionAccount', 'AccountPresenceObservation',
    'SectionCompleteness', 'FieldObservation', 'HistoricalEvidence',
    'CreditScoreObservation', 'BureauReportDateEvidence', 'IdentityBaseline',
    'IdentityFact', 'ConsumerAssertion',
    'IdentityCategoryCompletion', 'IdentityCorrespondenceAssertion',
    'ConsumerAccountReviewReceipt',
    'IdentityBaselineAccountReviewMembership', 'CaseActionDecision',
    'CaseActionSourceRef', 'P0SensitiveAccessEvent'
  ];
  readable_tables text[] := ARRAY[
    'CreditTruthScope', 'ReportIngestion', 'P0SourceObject', 'ReportVersion',
    'Artifact', 'ExtractionRun',
    'ExtractionBureauCoverage', 'Round0SourceCompletenessEvidence', 'Account',
    'ReportVersionAccount', 'AccountPresenceObservation',
    'SectionCompleteness', 'FieldObservation', 'HistoricalEvidence',
    'CreditScoreObservation', 'BureauReportDateEvidence', 'IdentityBaseline',
    'IdentityFact', 'DerivedAccountAssessment', 'ConsumerAssertion',
    'IdentityCategoryCompletion', 'IdentityCorrespondenceAssertion',
    'ConsumerAccountReviewReceipt',
    'IdentityBaselineAccountReviewMembership', 'CaseActionDecision',
    'CaseActionSourceRef', 'P0SensitiveAccessEvent', 'DisputeCase'
  ];
  user_read_columns text[] := ARRAY[
    'id', 'disabled', 'role', 'isAgency', 'managedByAgencyId',
    'p0AuthorizationRevision'
  ];
  report_read_columns text[] := ARRAY['id', 'userId'];
  ingestion_update_columns text[] := ARRAY[
    'sourceStorageProviderKey', 'sourceLocatorCiphertext', 'sourceLocatorIv',
    'sourceLocatorAuthTag', 'sourceLocatorKeyVersion',
    'sourceLocatorAlgorithm', 'sourceLocatorEnvelopeVersion',
    'sourceLocatorAadVersion', 'sourceReadbackSha256',
    'sourceReadbackByteLength', 'sourceVerifiedAt', 'sourceDisposition',
    'sourceDispositionReasonCode', 'sourceDispositionAt', 'state',
    'safeFailureCode', 'revision', 'attemptCount', 'leaseToken',
    'leaseOwnerId', 'leaseExpiresAt', 'nextAttemptAt', 'reportVersionId',
    'sourceArtifactId', 'extractionRunId', 'updatedAt'
  ];
BEGIN
  SELECT * INTO role_record FROM pg_roles WHERE rolname = writer_role;
  IF NOT FOUND
     OR role_record.rolsuper
     OR role_record.rolcreatedb
     OR role_record.rolcreaterole
     OR role_record.rolinherit
     OR role_record.rolreplication
     OR role_record.rolbypassrls THEN
    RAISE EXCEPTION 'P0 writer retains an administrative role attribute';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE member = writer_oid OR roleid = writer_oid
  ) THEN
    RAISE EXCEPTION 'P0 writer retains an inbound or outbound role-membership path';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_db_role_setting
    WHERE setrole = writer_oid
  ) THEN
    RAISE EXCEPTION 'P0 writer retains a role login setting';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_db_role_setting settings
    CROSS JOIN LATERAL unnest(settings.setconfig) configuration
    WHERE settings.setrole = 0
      AND settings.setdatabase IN (
        0,
        (SELECT oid FROM pg_database WHERE datname = writer_database)
      )
      AND configuration ~ '^session_replication_role='
      AND configuration <> 'session_replication_role=origin'
  ) THEN
    RAISE EXCEPTION 'unsafe trigger-bypass authority remains in global/database defaults';
  END IF;

  IF has_parameter_privilege(writer_role, 'session_replication_role', 'SET')
     OR has_parameter_privilege(
       writer_role,
       'session_replication_role',
       'ALTER SYSTEM'
     ) THEN
    RAISE EXCEPTION 'P0 writer retains session_replication_role parameter authority';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_parameter_acl parameter
    WHERE has_parameter_privilege(writer_role, parameter.parname, 'SET')
       OR has_parameter_privilege(
         writer_role,
         parameter.parname,
         'ALTER SYSTEM'
       )
  ) THEN
    RAISE EXCEPTION 'P0 writer retains unexpected parameter authority';
  END IF;

  -- Direct defaults for the writer were normalized above. A remaining
  -- explicit PUBLIC default belongs to another owner and cannot be changed by
  -- this dedicated-role contract without altering shared authorization
  -- policy, so it blocks attestation. Global rows and every non-system schema
  -- are included. PostgreSQL built-in defaults are not catalog rows; the
  -- deployed contract must therefore run after the final DDL/migration set.
  IF EXISTS (
    SELECT 1
    FROM pg_default_acl defaults
    LEFT JOIN pg_namespace namespace ON namespace.oid = defaults.defaclnamespace
    CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
    WHERE defaults.defaclobjtype IN ('r', 'S', 'f', 'n')
      AND (
        defaults.defaclnamespace = 0
        OR (
          namespace.nspname <> 'information_schema'
          AND namespace.nspname !~ '^pg_'
        )
      )
      AND (
        privilege.grantee = 0
        OR (
          privilege.grantee = writer_oid
          AND defaults.defaclrole <> writer_oid
        )
      )
  ) THEN
    RAISE EXCEPTION 'unsafe P0 writer or PUBLIC default ACL remains';
  END IF;

  IF NOT has_database_privilege(writer_role, writer_database, 'CONNECT')
     OR has_database_privilege(writer_role, writer_database, 'CREATE')
     OR has_database_privilege(writer_role, writer_database, 'TEMPORARY')
     OR has_database_privilege(writer_role, writer_database, 'CONNECT WITH GRANT OPTION') THEN
    RAISE EXCEPTION 'P0 writer database privilege matrix is not exactly CONNECT';
  END IF;

  FOR schema_record IN
    SELECT namespace.oid, namespace.nspname
    FROM pg_namespace namespace
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
    ORDER BY namespace.nspname
  LOOP
    IF has_schema_privilege(writer_role, schema_record.oid, 'USAGE')
         IS DISTINCT FROM (schema_record.nspname = 'public')
       OR has_schema_privilege(writer_role, schema_record.oid, 'CREATE')
       OR has_schema_privilege(
         writer_role,
         schema_record.oid,
         'USAGE WITH GRANT OPTION'
       )
       OR has_schema_privilege(
         writer_role,
         schema_record.oid,
         'CREATE WITH GRANT OPTION'
       ) THEN
      RAISE EXCEPTION 'P0 writer schema privilege matrix is not exact for %',
        schema_record.nspname;
    END IF;
  END LOOP;

  -- Protected source reads use both rows in one scoped transaction: the
  -- decision/audit evidence and the encrypted immutable source object.
  IF NOT has_table_privilege(writer_role, 'public."P0SensitiveAccessEvent"', 'SELECT')
     OR NOT has_table_privilege(writer_role, 'public."P0SourceObject"', 'SELECT') THEN
    RAISE EXCEPTION 'P0 protected source read privileges are incomplete';
  END IF;

  FOR relation_record IN
    SELECT relation.oid, namespace.nspname, relation.relname
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
    ORDER BY namespace.nspname, relation.relname
  LOOP
    FOREACH privilege_name IN ARRAY ARRAY[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ] LOOP
      actual := has_table_privilege(writer_role, relation_record.oid, privilege_name);
      expected := CASE privilege_name
        WHEN 'SELECT' THEN
          relation_record.nspname = 'public'
          AND relation_record.relname = ANY(readable_tables)
        WHEN 'INSERT' THEN
          relation_record.nspname = 'public'
          AND relation_record.relname = ANY(writable_tables)
        ELSE false
      END;
      IF actual IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'unexpected % table privilege on %.% (actual %, expected %)',
          privilege_name, relation_record.nspname, relation_record.relname,
          actual, expected;
      END IF;
      IF has_table_privilege(
        writer_role,
        relation_record.oid,
        privilege_name || ' WITH GRANT OPTION'
      ) THEN
        RAISE EXCEPTION 'P0 writer has grant option for % on %.%',
          privilege_name, relation_record.nspname, relation_record.relname;
      END IF;
    END LOOP;
  END LOOP;

  FOR column_record IN
    SELECT relation.oid, namespace.nspname, relation.relname, attribute.attname
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
    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
      actual := has_column_privilege(
        writer_role,
        column_record.oid,
        column_record.attname,
        privilege_name
      );
      expected := CASE privilege_name
        WHEN 'SELECT' THEN
          column_record.nspname = 'public'
          AND (
            column_record.relname = ANY(readable_tables)
            OR (column_record.relname = 'User' AND column_record.attname = ANY(user_read_columns))
            OR (column_record.relname = 'Report' AND column_record.attname = ANY(report_read_columns))
          )
        WHEN 'INSERT' THEN
          column_record.nspname = 'public'
          AND column_record.relname = ANY(writable_tables)
        WHEN 'UPDATE' THEN
          column_record.nspname = 'public'
          AND column_record.relname = 'ReportIngestion'
          AND column_record.attname = ANY(ingestion_update_columns)
        ELSE false
      END;
      IF actual IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'unexpected % column privilege on %.%.% (actual %, expected %)',
          privilege_name, column_record.nspname, column_record.relname,
          column_record.attname, actual, expected;
      END IF;
      IF has_column_privilege(
        writer_role,
        column_record.oid,
        column_record.attname,
        privilege_name || ' WITH GRANT OPTION'
      ) THEN
        RAISE EXCEPTION 'P0 writer has column grant option for % on %.%.%',
          privilege_name, column_record.nspname, column_record.relname,
          column_record.attname;
      END IF;
    END LOOP;
  END LOOP;

  FOR sequence_record IN
    SELECT relation.oid, namespace.nspname, relation.relname
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
      AND relation.relkind = 'S'
    ORDER BY namespace.nspname, relation.relname
  LOOP
    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'USAGE', 'UPDATE'] LOOP
      IF has_sequence_privilege(writer_role, sequence_record.oid, privilege_name)
         OR has_sequence_privilege(
           writer_role,
           sequence_record.oid,
           privilege_name || ' WITH GRANT OPTION'
         ) THEN
        RAISE EXCEPTION 'P0 writer unexpectedly reaches sequence %.% with %',
          sequence_record.nspname, sequence_record.relname, privilege_name;
      END IF;
    END LOOP;
  END LOOP;

  FOR routine_record IN
    SELECT routine.oid, namespace.nspname, routine.proname
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname <> 'information_schema'
      AND namespace.nspname !~ '^pg_'
    ORDER BY namespace.nspname, routine.proname, routine.oid
  LOOP
    IF has_function_privilege(writer_role, routine_record.oid, 'EXECUTE')
       OR has_function_privilege(
         writer_role,
         routine_record.oid,
         'EXECUTE WITH GRANT OPTION'
       ) THEN
      RAISE EXCEPTION 'P0 writer unexpectedly has routine EXECUTE on %.%',
        routine_record.nspname, routine_record.proname;
    END IF;
  END LOOP;
END;
$p0_verify$;

COMMIT;
