import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(root, "prisma/migrations/20260811_p0_trusted_writer_gate/migration.sql"),
  "utf8",
);
const roleContract = readFileSync(
  resolve(root, "scripts/sql/p0-trusted-writer-db-role-contract.sql"),
  "utf8",
);
const disposableVerifier = readFileSync(
  resolve(root, "scripts/p0-trusted-writer-disposable-verify.sh"),
  "utf8",
);
const insertGrantBlock = roleContract.slice(
  roleContract.indexOf("'GRANT SELECT, INSERT ON TABLE public.%s TO %I'"),
  roleContract.indexOf("]) AS allowed_tables(table_name)"),
);
const readOnlyGrantBlock = roleContract.slice(
  roleContract.indexOf("-- These are read-only references."),
  roleContract.indexOf("]) AS reference_tables(table_name)"),
);

let passed = 0;
const check = (condition: unknown, message: string) => {
  assert(condition, message);
  passed += 1;
};

check(schema.includes("p0AuthorizationRevision Int            @default(1)"), "schema authorization epoch");
check(schema.includes("model P0SourceObject"), "schema source object");
check(schema.includes("operationId                String"), "assertion operation identity");
check(schema.includes('@@unique([tenantId, consumerId, operationId], map: "consumer_assertion_operation_key")'), "assertion operation uniqueness");
check(migration.includes('CREATE FUNCTION p0_trusted_writer_bump_authorization_revision()'), "authorization trigger function");
check(migration.includes('NEW."disabled" IS DISTINCT FROM OLD."disabled"'), "disabled revocation bump");
check(migration.includes('NEW."managedByAgencyId" IS DISTINCT FROM OLD."managedByAgencyId"'), "managed grant bump");
check(migration.includes("P0 authorization revision is database controlled"), "caller revision rejected");
check(migration.includes('CREATE TABLE "P0SourceObject"'), "source table migration");
check(migration.includes('octet_length("ciphertext") = "byteLength"'), "ciphertext length binding");
check(migration.includes('"byteLength" <= 15728640'), "source byte ceiling");
check(migration.includes('octet_length("iv") = 12'), "content IV length");
check(migration.includes('octet_length("authTag") = 16'), "content tag length");
check(migration.includes('octet_length("locatorIv") = 12'), "locator IV length");
check(migration.includes('octet_length("locatorAuthTag") = 16'), "locator tag length");
check(migration.includes('"sha256" ~ \'^[0-9a-f]{64}$\''), "server digest shape");
check(migration.includes('CREATE TRIGGER "P0SourceObject_write_fence_trg"'), "source write fence");
check(migration.includes('linked_ingestion."sourceDisposition" <> \'RETAINED\''), "retention write fence");
check(migration.includes('CREATE TRIGGER "ReportIngestion_p0_source_authority_trg"'), "ingestion source authority trigger");
check(migration.includes("NEW.\"sourceStorageProviderKey\" <> 'P0_PRISMA_ENCRYPTED_SOURCE'"), "synthetic provider cannot become source authority");
check(migration.includes('source_object."locatorCiphertext" = NEW."sourceLocatorCiphertext"'), "exact persisted locator binding");
check(migration.includes('source_object."artifactId" = NEW."sourceArtifactId"'), "version artifact binds exact source object");
check(migration.includes('CREATE TRIGGER "P0SourceObject_no_update_truncate_trg"'), "source immutable update/truncate");
check(migration.includes('DROP CONSTRAINT "P0SensitiveAccessEvent_refs_only_ck"'), "refs-only audit constraint is deliberately replaced");
check(migration.includes('"eventKey" ~ \'^p0evt_[0-9a-f]{64}$\''), "only exact typed event digests may contain long digit runs");
check(migration.includes('"authorizationVersion" ~ \'^p0-authz-(worker|direct|managed):[0-9a-f]{64}$\''), "only exact typed authorization versions may contain long digit runs");
check(migration.includes('"resourceId" ~ \'^p0(ing|src|obj|rv|evt|corr|op)_[0-9a-f]{16,64}$\''), "only exact typed resource refs may contain long digit runs");
check(migration.includes('"correlationId" ~ \'^p0corr_[0-9a-f]{64}$\''), "only exact typed correlation digests may contain long digit runs");
check(migration.includes('AND "actorId" !~ \'[0-9]{9}\''), "actor ref long-digit rejection remains strict");
check(!migration.includes("CASCADE"), "no cascade mutation");
check(!migration.includes("DROP TABLE"), "additive migration only");

// The local role contract must normalize effective privilege, not merely direct
// table ACLs. PUBLIC and role-membership paths are part of PostgreSQL's actual
// authorization result and therefore part of this executable attestation.
check(roleContract.includes("LOCAL privilege contract"), "local contract is not deployed attestation");
check(roleContract.includes("DEPLOYED ROLE ATTESTATION"), "deployed-role boundary remains explicit");
check((roleContract.match(/^BEGIN;$/gm) ?? []).length === 1, "role normalization has one explicit transaction start");
check((roleContract.match(/^COMMIT;$/gm) ?? []).length === 1, "role normalization has one explicit transaction commit");
check(roleContract.indexOf("BEGIN;") < roleContract.indexOf("SELECT set_config("), "transaction begins before contract state is established");
check(roleContract.lastIndexOf("COMMIT;") > roleContract.lastIndexOf("$p0_verify$;"), "commit follows the final exact allowlist audit");
check(roleContract.trimEnd().endsWith("COMMIT;"), "no role-contract operation follows commit");
check(!/^ROLLBACK;$/m.test(roleContract), "role contract never converts an audit failure into a successful rollback command");
check(disposableVerifier.includes("prove_role_contract_atomicity"), "disposable verifier includes late-audit rollback proof");
check(disposableVerifier.includes("role_contract_semantic_fingerprint"), "rollback proof fingerprints authorization state");
check(disposableVerifier.includes("shasum -a 256"), "authorization rollback fingerprint uses SHA-256");
check(disposableVerifier.includes("late-audit-atomicity"), "rollback proof deliberately reaches a late audit rejection");
check(disposableVerifier.includes('[[ "${after_fingerprint}" == "${before_fingerprint}" ]]'), "failed contract must restore the exact authorization fingerprint");
check(roleContract.includes("current_database() <> writer_database"), "contract binds the exact database");
check(roleContract.includes("role contract must be applied by a distinct owner role"), "writer cannot self-attest");
check(roleContract.includes("NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS"), "all administrative role attributes denied");
check(roleContract.includes("FROM pg_auth_members membership"), "role memberships enumerated");
check(roleContract.includes("REVOKE %I FROM %I"), "role memberships revoked");
check(roleContract.includes("WHERE granted_role.rolname = :'p0_writer_role'"), "roles that can assume writer are revoked");
check(roleContract.includes("WHERE member = writer_oid OR roleid = writer_oid"), "both membership directions audited");
check(roleContract.includes("P0 writer retains an inbound or outbound role-membership path"), "membership absence audited");
check(roleContract.includes("ALTER ROLE %I RESET ALL"), "global writer login settings normalized");
check(roleContract.includes("ALTER ROLE %I IN DATABASE %I RESET ALL"), "database writer login settings normalized");
check(roleContract.includes("FROM pg_db_role_setting"), "writer and database defaults audited");
check(roleContract.includes("settings.setdatabase IN ("), "global and database-wide settings are audited");
check(roleContract.includes("unsafe trigger-bypass authority remains in global/database defaults"), "global/database trigger-bypass defaults fail closed");
check(roleContract.includes("FROM pg_parameter_acl parameter"), "parameter ACLs enumerated");
check(roleContract.includes("REVOKE ALL PRIVILEGES ON PARAMETER %I FROM %I"), "writer parameter authority normalized");
check(roleContract.includes("has_parameter_privilege(writer_role, 'session_replication_role', 'SET')"), "replication-role SET authority audited");
check(roleContract.includes("'ALTER SYSTEM'"), "parameter ALTER SYSTEM authority audited");
check(roleContract.includes("P0 writer retains unexpected parameter authority"), "all cataloged parameter authority fails closed");
check(roleContract.includes("FROM pg_default_acl defaults"), "default ACL catalog is enumerated");
check(roleContract.includes("CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege"), "default ACL entries are expanded exactly");
check(roleContract.includes("ON TABLES FROM %I"), "writer table defaults are owner-scoped and revoked");
check(roleContract.includes("ON SEQUENCES FROM %I"), "writer sequence defaults are owner-scoped and revoked");
check(roleContract.includes("ON ROUTINES FROM %I"), "writer routine defaults are owner-scoped and revoked");
check(roleContract.includes("ON TYPES FROM %I"), "writer type defaults are owner-scoped and revoked");
check(roleContract.includes("ON SCHEMAS FROM %I"), "writer schema defaults are owner-scoped and revoked");
check(roleContract.includes("defaults.defaclobjtype = 'r'"), "table default ACL rows selected exactly");
check(roleContract.includes("defaults.defaclobjtype = 'S'"), "sequence default ACL rows selected exactly");
check(roleContract.includes("defaults.defaclobjtype = 'f'"), "routine default ACL rows selected exactly");
check(roleContract.includes("Removing the last ACL from another owner's function default can restore"), "function-default ACL deletion hazard documented");
check(roleContract.includes("AND defaults.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = :'p0_writer_role')"), "foreign-owner function defaults are preserved for fail-closed audit");
check(roleContract.includes("defaults.defaclobjtype = 'T'"), "type default ACL rows selected exactly");
check(roleContract.includes("defaults.defaclobjtype = 'n'"), "schema default ACL rows selected exactly");
check(roleContract.includes("ON TABLES FROM PUBLIC"), "writer-owned PUBLIC table defaults normalized");
check(roleContract.includes("ON SEQUENCES FROM PUBLIC"), "writer-owned PUBLIC sequence defaults normalized");
check(roleContract.includes("ON ROUTINES FROM PUBLIC"), "writer-owned PUBLIC routine defaults normalized");
check(roleContract.includes("ON TYPES FROM PUBLIC"), "writer-owned PUBLIC type defaults normalized");
check(roleContract.includes("ON SCHEMAS FROM PUBLIC"), "writer-owned PUBLIC schema defaults normalized");
check(roleContract.includes("dependency.classid <> 'pg_default_acl'::regclass"), "safe writer-owned default policy is not mistaken for object ownership");
check(roleContract.includes("FROM pg_shdepend dependency"), "all shared ownership dependencies enumerated");
check(roleContract.includes("P0 writer owns a database or application object"), "implicit ownership authority rejected");
check(roleContract.includes("defaults.defaclobjtype IN ('r', 'S', 'f', 'n')"), "authority-producing default object types audited");
check(roleContract.includes("defaults.defaclnamespace = 0"), "global default ACL rows audited");
check(roleContract.includes("privilege.grantee = 0"), "remaining PUBLIC defaults audited");
check(roleContract.includes("defaults.defaclrole <> writer_oid"), "foreign-owner defaults targeting writer audited");
check(roleContract.includes("unsafe P0 writer or PUBLIC default ACL remains"), "remaining unsafe default ACL fails closed");
check(roleContract.includes("deployed contract must therefore run after the final DDL/migration set"), "built-in future-object boundary remains deployed gate");

check(roleContract.includes("REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I"), "database privileges normalized");
check(roleContract.includes("REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC"), "PUBLIC database mutation paths normalized");
check(roleContract.includes("GRANT CONNECT ON DATABASE %I TO %I"), "database allowlist grants connect only");
check(roleContract.includes("REVOKE ALL PRIVILEGES ON SCHEMA %I FROM %I"), "all non-system schema privileges normalized");
check(roleContract.includes("REVOKE CREATE ON SCHEMA public FROM PUBLIC"), "PUBLIC schema creation normalized");
check(roleContract.includes("GRANT USAGE ON SCHEMA public TO %I"), "schema allowlist grants usage only");
check(roleContract.includes("privilege matrix is not exactly CONNECT"), "database exact allowlist audited");
check(roleContract.includes("FOR schema_record IN"), "every non-system schema is audited");
check(roleContract.includes("schema privilege matrix is not exact for %"), "schema exact allowlist audited");
check(roleContract.includes("schema_record.nspname = 'public'"), "only public schema usage is accepted");
check(roleContract.includes("'TEMPORARY'"), "temporary database privilege asserted absent");
check(roleContract.includes("'CONNECT WITH GRANT OPTION'"), "database grant option asserted absent");
check(roleContract.includes("'USAGE WITH GRANT OPTION'"), "schema grant option asserted absent");
check((roleContract.match(/namespace\.nspname <> 'information_schema'/g) ?? []).length >= 9, "all privilege passes exclude only system schemas");
check((roleContract.match(/namespace\.nspname !~ '\^pg_'/g) ?? []).length >= 9, "all privilege passes exclude pg system schemas");

check(roleContract.includes("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM %I"), "all non-system direct table ACLs normalized");
check(roleContract.includes("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC"), "PUBLIC table ACLs normalized");
check(roleContract.includes("REVOKE ALL PRIVILEGES (%s) ON TABLE %I.%I FROM %I"), "stale column ACLs normalized");
check(roleContract.includes("relation.relkind IN ('r', 'p', 'v', 'm', 'f')"), "all non-system table-like relation kinds audited");
check(roleContract.includes("'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'"), "complete table privilege matrix audited");
check(roleContract.includes("relation_record.nspname = 'public'"), "no table privilege is accepted outside public");
check(roleContract.includes("unexpected % table privilege on %.%"), "table allowlist mismatch fails closed");
check(roleContract.includes("'SELECT', 'INSERT', 'UPDATE', 'REFERENCES'"), "complete column privilege matrix audited");
check(roleContract.includes("column_record.nspname = 'public'"), "no column privilege is accepted outside public");
check(roleContract.includes("unexpected % column privilege on %.%.%"), "column allowlist mismatch fails closed");
check(roleContract.includes("privilege_name || ' WITH GRANT OPTION'"), "table and column grant options audited");

check(roleContract.includes("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM %I"), "all non-system direct sequence ACLs normalized");
check(roleContract.includes("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC"), "PUBLIC sequence ACLs normalized");
check(roleContract.includes("relation.relkind = 'S'"), "all public sequences enumerated");
check(roleContract.includes("'SELECT', 'USAGE', 'UPDATE'"), "complete sequence privilege matrix audited");
check(roleContract.includes("P0 writer unexpectedly reaches sequence %.%"), "sequence authority in any non-system schema fails closed");
check(!roleContract.split("\n").some((line) => /\bGRANT\s+(?:ALL\s+(?:PRIVILEGES\s+)?ON\s+ALL\s+SEQUENCES|(?:SELECT|USAGE|UPDATE)\b.*\bSEQUENCES?\b)/i.test(line)), "no sequence grant exists");

check(roleContract.includes("REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA %I FROM %I"), "all non-system direct routine ACLs normalized");
check(roleContract.includes("REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public FROM PUBLIC"), "PUBLIC routine EXECUTE normalized");
check(roleContract.includes("FROM pg_proc routine"), "all non-system routines enumerated");
check(roleContract.includes("'EXECUTE WITH GRANT OPTION'"), "routine grant option asserted absent");
check(roleContract.includes("P0 writer unexpectedly has routine EXECUTE on %.%"), "routine authority in any non-system schema fails closed");
check(!roleContract.split("\n").some((line) => /\bGRANT\s+(?:EXECUTE|ALL\s+(?:PRIVILEGES\s+)?)\s+ON\s+(?:FUNCTION|PROCEDURE|ROUTINE|ALL\s+(?:FUNCTIONS|PROCEDURES|ROUTINES))/i.test(line)), "no routine execution grant exists");

check(roleContract.includes("writable_tables text[] := ARRAY["), "writer table allowlist is explicit");
check(roleContract.includes("readable_tables text[] := ARRAY["), "reader table allowlist is explicit");
check(roleContract.includes("ingestion_update_columns text[] := ARRAY["), "mutable columns are explicit");
check(roleContract.includes("GRANT UPDATE ("), "only column-scoped ingestion updates are granted");
check(!insertGrantBlock.includes('"ArtifactTombstone"'), "ArtifactTombstone has no concrete writer INSERT grant");
check(!insertGrantBlock.includes('"DerivedAccountAssessment"'), "DerivedAccountAssessment has no concrete writer INSERT grant");
check(!roleContract.includes("'ArtifactTombstone'"), "unread ArtifactTombstone has no runtime role authority");
check(readOnlyGrantBlock.includes('"DerivedAccountAssessment"'), "DerivedAccountAssessment remains read-only where consumed");
check(insertGrantBlock.includes('"P0SensitiveAccessEvent"'), "sensitive-access event writer retains exact INSERT");
check(insertGrantBlock.includes('"P0SourceObject"'), "immutable source writer retains exact INSERT");
check(roleContract.includes("has_table_privilege(writer_role, 'public.\"P0SensitiveAccessEvent\"', 'SELECT')"), "protected access decision row remains readable");
check(roleContract.includes("has_table_privilege(writer_role, 'public.\"P0SourceObject\"', 'SELECT')"), "protected source object remains readable");
check(roleContract.includes("P0 protected source read privileges are incomplete"), "protected-read privilege omission fails closed");
check(!/GRANT\s+(?:ALL|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/.test(roleContract), "no destructive or delegating table grant");
check(!roleContract.includes("'\"Correspondence\"'"), "no Phase 2B correspondence privilege");
check(!roleContract.includes("'\"Packet\"'"), "no Phase 2B packet privilege");
check(!roleContract.includes("PASSWORD"), "no committed credential");
check(roleContract.includes("column_record.relname = 'User'"), "User reads are column-scoped");
check(roleContract.includes("column_record.relname = 'Report'"), "legacy Report reads are column-scoped");
check(roleContract.includes("column_record.relname = 'ReportIngestion'"), "ReportIngestion updates are column-scoped");
check(roleContract.includes("column_record.attname = ANY(ingestion_update_columns)"), "every other update column is rejected");
check(roleContract.includes("has_table_privilege(writer_role, relation_record.oid, privilege_name)"), "effective table privileges audited");
check(roleContract.includes("has_column_privilege("), "effective column privileges audited");
check(roleContract.includes("has_sequence_privilege(writer_role, sequence_record.oid, privilege_name)"), "effective sequence privileges audited");
check(roleContract.includes("has_function_privilege(writer_role, routine_record.oid, 'EXECUTE')"), "effective routine privileges audited");

process.stdout.write(`${passed}/${passed} PASS p0-trusted-writer-migration-guard\n`);
