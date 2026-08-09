#!/usr/bin/env bash
set -Eeuo pipefail

# CreditVector P0 Phase 1 migration verifier.
# DISPOSABLE DATABASE ONLY. This script generates its own loopback-only target,
# clears ordinary database environment variables, and never accepts a target URL.

umask 077

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly MIGRATION_NAME="20260808_p0_credit_truth_foundation"
readonly MIGRATION_SQL="${REPO_ROOT}/prisma/migrations/${MIGRATION_NAME}/migration.sql"
readonly SCHEMA_FILE="${REPO_ROOT}/prisma/schema.prisma"
readonly ROLLBACK_SQL="${REPO_ROOT}/scripts/sql/p0-phase1-disposable-rollback.sql"
readonly PRISMA_BIN="${REPO_ROOT}/node_modules/.bin/prisma"
readonly EXPECTED_SCHEMA_SHA256="ea1665d6708e8b170e486b69ae8bd734f62ca548fa20ab3f7685aa3ddb1c531a"
readonly EXPECTED_MIGRATION_SHA256="95e18c20735e152baad6e8a995a951dab792e999469b7cf77dbc973148ad426a"
readonly POSTGRES_IMAGE_TAG="postgres:16-alpine"
readonly POSTGRES_IMAGE_ID="sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777"
readonly POSTGRES_IMAGE_DIGEST="postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777"
readonly DB_ROLE="p0_disposable_verifier"
readonly EXPECTED_ENUM_COUNT=49
readonly EXPECTED_TABLE_COUNT=32
readonly EXPECTED_UNIQUE_INDEX_COUNT=122
readonly EXPECTED_SECONDARY_INDEX_COUNT=38
readonly EXPECTED_FK_COUNT=106
readonly EXPECTED_CHECK_COUNT=127
readonly EXPECTED_TRIGGER_COUNT=72
readonly EXPECTED_FUNCTION_COUNT=29
readonly EXPECTED_POSITIVE_SUITE_COUNT=3
readonly EXPECTED_NEGATIVE_CASE_COUNT=47

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

if [[ $# -ne 0 ]]; then
  fail "no arguments are accepted; the verifier generates its own disposable target"
fi

say "DISPOSABLE DATABASE ONLY"
say "preflight: frozen inputs and local-only policy"

# These checks intentionally precede every Docker command and every database
# mutation. A missing or drifted target fails before a container can start.
for required_file in "${SCHEMA_FILE}" "${MIGRATION_SQL}" "${ROLLBACK_SQL}" "${PRISMA_BIN}"; do
  [[ -f "${required_file}" || -x "${required_file}" ]] || fail "required verifier input is missing"
done

[[ "$(sha256_file "${SCHEMA_FILE}")" == "${EXPECTED_SCHEMA_SHA256}" ]] \
  || fail "schema freeze digest mismatch"
[[ "$(sha256_file "${MIGRATION_SQL}")" == "${EXPECTED_MIGRATION_SHA256}" ]] \
  || fail "migration freeze digest mismatch"

cd "${REPO_ROOT}"

# Never inherit an ordinary application or production database target.
unset DATABASE_URL DIRECT_URL SHADOW_DATABASE_URL PRISMA_DATABASE_URL
unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

command -v docker >/dev/null 2>&1 || fail "Docker is required for the disposable verifier"
command -v openssl >/dev/null 2>&1 || fail "openssl is required for a transient local password"

tmp_root="$(mktemp -d /private/tmp/creditvector-p0-disposable.XXXXXX)"
[[ "${tmp_root}" == /private/tmp/creditvector-p0-disposable.* ]] \
  || fail "unsafe temporary directory"

run_token="$(date -u +%Y%m%d%H%M%S)-$$-${RANDOM}"
container_name="creditvector-p0-disposable-${run_token}"
primary_db="p0_disposable_primary_$$_${RANDOM}"
rebuild_db="p0_disposable_rebuild_$$_${RANDOM}"
db_password="p0d$(openssl rand -hex 24)"
container_started=0
teardown_confirmed=0

[[ "${container_name}" =~ ^creditvector-p0-disposable-[0-9]{14}-[0-9]+-[0-9]+$ ]] \
  || fail "unsafe disposable container name"
[[ "${primary_db}" =~ ^p0_disposable_[a-z0-9_]+$ ]] \
  || fail "unsafe primary database name"
[[ "${rebuild_db}" =~ ^p0_disposable_[a-z0-9_]+$ ]] \
  || fail "unsafe rebuild database name"

cleanup() {
  local original_status=$?
  set +e

  if [[ "${container_started}" -eq 1 ]] \
      && [[ "${container_name}" =~ ^creditvector-p0-disposable-[0-9]{14}-[0-9]+-[0-9]+$ ]]; then
    docker stop --time 10 "${container_name}" >/dev/null 2>&1
    for _remove_attempt in $(seq 1 20); do
      if ! docker inspect "${container_name}" >/dev/null 2>&1; then
        teardown_confirmed=1
        break
      fi
      sleep 0.25
    done
    if [[ "${teardown_confirmed}" -eq 1 ]]; then
      say "teardown: disposable container removed=true"
    else
      say "teardown: disposable container removed=false" >&2
      original_status=1
    fi
  fi

  if [[ -n "${tmp_root:-}" && "${tmp_root}" == /private/tmp/creditvector-p0-disposable.* ]]; then
    find "${tmp_root}" -depth -delete >/dev/null 2>&1
  fi

  db_password=""
  exit "${original_status}"
}

trap cleanup EXIT
trap 'exit 130' INT TERM HUP

redact_log() {
  local log_file="$1"
  sed -E \
    -e "s/${db_password}/<redacted>/g" \
    -e 's#postgres(ql)?://[^[:space:]]+#<redacted-disposable-url>#g' \
    "${log_file}"
}

run_prisma_deploy() {
  local label="$1"
  local disposable_url="$2"
  local schema_path="$3"
  local log_file="${tmp_root}/${label}.log"

  if ! env -i \
      PATH="${PATH}" \
      HOME="${HOME}" \
      TMPDIR="/private/tmp" \
      NODE_ENV="test" \
      PRISMA_HIDE_UPDATE_MESSAGE="1" \
      DATABASE_URL="${disposable_url}" \
      "${PRISMA_BIN}" migrate deploy --schema "${schema_path}" >"${log_file}" 2>&1; then
    redact_log "${log_file}" >&2
    fail "Prisma migrate deploy failed for ${label}"
  fi

  redact_log "${log_file}"
  LAST_PRISMA_LOG="${log_file}"
}

run_prisma_diff() {
  local disposable_url="$1"
  local log_file="${tmp_root}/schema-parity.log"

  if ! env -i \
      PATH="${PATH}" \
      HOME="${HOME}" \
      TMPDIR="/private/tmp" \
      NODE_ENV="test" \
      PRISMA_HIDE_UPDATE_MESSAGE="1" \
      DATABASE_URL="${disposable_url}" \
      "${PRISMA_BIN}" migrate diff \
        --from-schema-datasource "${SCHEMA_FILE}" \
        --to-schema-datamodel "${SCHEMA_FILE}" \
        --exit-code >"${log_file}" 2>&1; then
    redact_log "${log_file}" >&2
    fail "Prisma schema parity is not empty"
  fi

  redact_log "${log_file}"
}

psql_query() {
  local database_name="$1"
  local sql="$2"
  docker exec "${container_name}" \
    psql -X --set=ON_ERROR_STOP=1 --tuples-only --no-align --quiet \
      --username "${DB_ROLE}" --dbname "${database_name}" --command "${sql}"
}

psql_file() {
  local database_name="$1"
  local sql_file="$2"
  shift 2
  docker exec -i "${container_name}" \
    psql -X --set=ON_ERROR_STOP=1 "$@" \
      --username "${DB_ROLE}" --dbname "${database_name}" <"${sql_file}"
}

build_manifest() {
  sed -nE 's/^CREATE TABLE "([^"]+)".*/\1/p' "${MIGRATION_SQL}" | LC_ALL=C sort -u >"${tmp_root}/expected.tables"
  sed -nE 's/^CREATE (UNIQUE )?INDEX "([^"]+)".*/\2/p' "${MIGRATION_SQL}" | LC_ALL=C sort -u >"${tmp_root}/expected.indexes"
  sed -nE 's/.*CONSTRAINT "([^"]+)".*/\1/p' "${MIGRATION_SQL}" | LC_ALL=C sort -u >"${tmp_root}/expected.constraints"
  sed -nE 's/^CREATE (CONSTRAINT )?TRIGGER "([^"]+)".*/\2/p' "${MIGRATION_SQL}" | LC_ALL=C sort -u >"${tmp_root}/expected.triggers"
  sed -nE 's/^CREATE TYPE "([^"]+)".*/\1/p' "${MIGRATION_SQL}" | LC_ALL=C sort -u >"${tmp_root}/expected.types"
  sed -nE 's/^CREATE FUNCTION ([A-Za-z0-9_]+).*/\1/p' "${MIGRATION_SQL}" | LC_ALL=C sort -u >"${tmp_root}/expected.functions"
}

verify_static_counts() {
  local enum_count table_count unique_index_count secondary_index_count
  local fk_count check_count trigger_count function_count

  enum_count="$(grep -c '^CREATE TYPE ' "${MIGRATION_SQL}")"
  table_count="$(grep -c '^CREATE TABLE ' "${MIGRATION_SQL}")"
  unique_index_count="$(grep -c '^CREATE UNIQUE INDEX ' "${MIGRATION_SQL}")"
  secondary_index_count="$(grep -c '^CREATE INDEX ' "${MIGRATION_SQL}")"
  fk_count="$(grep -c '^ALTER TABLE .* FOREIGN KEY ' "${MIGRATION_SQL}")"
  check_count="$(grep -cE '^[[:space:]]*CONSTRAINT .* CHECK ' "${MIGRATION_SQL}")"
  trigger_count="$(grep -cE '^CREATE (CONSTRAINT )?TRIGGER ' "${MIGRATION_SQL}")"
  function_count="$(grep -c '^CREATE FUNCTION ' "${MIGRATION_SQL}")"

  [[ "${enum_count}" == "${EXPECTED_ENUM_COUNT}" ]] || fail "unexpected P0 enum count"
  [[ "${table_count}" == "${EXPECTED_TABLE_COUNT}" ]] || fail "unexpected P0 table count"
  [[ "${unique_index_count}" == "${EXPECTED_UNIQUE_INDEX_COUNT}" ]] || fail "unexpected P0 unique-index count"
  [[ "${secondary_index_count}" == "${EXPECTED_SECONDARY_INDEX_COUNT}" ]] || fail "unexpected P0 secondary-index count"
  [[ "${fk_count}" == "${EXPECTED_FK_COUNT}" ]] || fail "unexpected P0 foreign-key count"
  [[ "${check_count}" == "${EXPECTED_CHECK_COUNT}" ]] || fail "unexpected P0 check count"
  [[ "${trigger_count}" == "${EXPECTED_TRIGGER_COUNT}" ]] || fail "unexpected P0 trigger count"
  [[ "${function_count}" == "${EXPECTED_FUNCTION_COUNT}" ]] || fail "unexpected P0 function count"
}

verify_rollback_manifest() {
  sed -nE 's/^DROP TABLE IF EXISTS "([^"]+)";.*/\1/p' "${ROLLBACK_SQL}" \
    | LC_ALL=C sort -u >"${tmp_root}/rollback.tables"
  sed -nE 's/^DROP TYPE IF EXISTS "([^"]+)";.*/\1/p' "${ROLLBACK_SQL}" \
    | LC_ALL=C sort -u >"${tmp_root}/rollback.types"
  sed -nE 's/^DROP FUNCTION IF EXISTS ([A-Za-z0-9_]+)\(.*/\1/p' "${ROLLBACK_SQL}" \
    | LC_ALL=C sort -u >"${tmp_root}/rollback.functions"

  cmp -s "${tmp_root}/expected.tables" "${tmp_root}/rollback.tables" \
    || fail "rollback table target list does not exactly match the frozen migration"
  cmp -s "${tmp_root}/expected.types" "${tmp_root}/rollback.types" \
    || fail "rollback enum target list does not exactly match the frozen migration"
  cmp -s "${tmp_root}/expected.functions" "${tmp_root}/rollback.functions" \
    || fail "rollback function target list does not exactly match the frozen migration"

  if grep -Eq '^[[:space:]]*(DROP|ALTER).*\bCASCADE\b|^[[:space:]]*DROP[[:space:]]+(DATABASE|SCHEMA)|^[[:space:]]*DROP TABLE IF EXISTS "(User|Report|Tradeline)"|^[[:space:]]*(DROP|ALTER).*_prisma_migrations' "${ROLLBACK_SQL}"; then
    fail "rollback contains a forbidden target or destructive modifier"
  fi

  local enclosure_line acv_line artifact_line pcv_line packet_line
  enclosure_line="$(grep -n '^DROP TABLE IF EXISTS "PacketEnclosure"' "${ROLLBACK_SQL}" | cut -d: -f1)"
  acv_line="$(grep -n '^DROP TABLE IF EXISTS "ArtifactCorrespondenceVersion"' "${ROLLBACK_SQL}" | cut -d: -f1)"
  artifact_line="$(grep -n '^DROP TABLE IF EXISTS "Artifact"' "${ROLLBACK_SQL}" | cut -d: -f1)"
  pcv_line="$(grep -n '^DROP TABLE IF EXISTS "PacketCorrespondenceVersion"' "${ROLLBACK_SQL}" | cut -d: -f1)"
  packet_line="$(grep -n '^DROP TABLE IF EXISTS "Packet"' "${ROLLBACK_SQL}" | cut -d: -f1)"
  (( enclosure_line < artifact_line && acv_line < artifact_line \
      && artifact_line < pcv_line && pcv_line < packet_line )) \
    || fail "rollback artifact/packet leaf order is unsafe"
}

assert_expected_subset() {
  local label="$1"
  local expected_file="$2"
  local actual_file="$3"
  local missing_file="${tmp_root}/missing.${label}"

  LC_ALL=C sort -u "${actual_file}" -o "${actual_file}"
  comm -23 "${expected_file}" "${actual_file}" >"${missing_file}"
  if [[ -s "${missing_file}" ]]; then
    say "missing ${label}:"
    sed 's/^/  /' "${missing_file}"
    fail "catalog parity failed for ${label}"
  fi
}

verify_catalog() {
  local database_name="$1"
  local prefix="$2"

  psql_query "${database_name}" \
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" \
    >"${tmp_root}/${prefix}.tables"
  psql_query "${database_name}" \
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;" \
    >"${tmp_root}/${prefix}.indexes"
  psql_query "${database_name}" \
    "SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' ORDER BY c.conname;" \
    >"${tmp_root}/${prefix}.constraints"
  psql_query "${database_name}" \
    "SELECT t.tgname FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY t.tgname;" \
    >"${tmp_root}/${prefix}.triggers"
  psql_query "${database_name}" \
    "SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e' ORDER BY t.typname;" \
    >"${tmp_root}/${prefix}.types"
  psql_query "${database_name}" \
    "SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' ORDER BY p.proname;" \
    >"${tmp_root}/${prefix}.functions"

  for kind in tables indexes constraints triggers types functions; do
    assert_expected_subset "${kind}" "${tmp_root}/expected.${kind}" "${tmp_root}/${prefix}.${kind}"
  done

  local unsafe_fk_count
  unsafe_fk_count="$(psql_query "${database_name}" \
    "SELECT COUNT(*) FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND c.contype = 'f' AND r.relname IN ($(sed "s/'/''/g; s/^/'/; s/$/'/" "${tmp_root}/expected.tables" | paste -sd, -)) AND (c.confdeltype <> 'r' OR c.confupdtype <> 'r');")"
  [[ "${unsafe_fk_count}" == "0" ]] || fail "a P0 foreign key is not RESTRICT/RESTRICT"

  say "catalog ${prefix}: enums=${EXPECTED_ENUM_COUNT} tables=${EXPECTED_TABLE_COUNT} unique_indexes=${EXPECTED_UNIQUE_INDEX_COUNT} secondary_indexes=${EXPECTED_SECONDARY_INDEX_COUNT} foreign_keys=${EXPECTED_FK_COUNT} checks=${EXPECTED_CHECK_COUNT} triggers=${EXPECTED_TRIGGER_COUNT} functions=${EXPECTED_FUNCTION_COUNT}"
}

baseline_snapshot() {
  local database_name="$1"
  psql_query "${database_name}" \
    "SELECT string_agg(v, E'\\n' ORDER BY v) FROM (
       SELECT 'U|' || id || '|' || email || '|' || \"isAgency\"::text || '|' || COALESCE(\"managedByAgencyId\", '') AS v
       FROM \"User\" WHERE id LIKE 'p0-synthetic-%'
       UNION ALL
       SELECT 'R|' || id || '|' || \"userId\" || '|' || \"fileName\" || '|' || COALESCE(\"rawText\", '<null>') AS v
       FROM \"Report\" WHERE id LIKE 'p0-synthetic-%'
       UNION ALL
       SELECT 'T|' || id || '|' || \"userId\" || '|' || \"reportId\" || '|' || \"creditorName\" || '|' || balance::text AS v
       FROM \"Tradeline\" WHERE id LIKE 'p0-synthetic-%'
     ) baseline_rows;"
}

snapshot_sha256() {
  printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
}

build_manifest
verify_static_counts
verify_rollback_manifest

local_image_id="$(docker image inspect "${POSTGRES_IMAGE_TAG}" --format '{{.Id}}')"
local_image_digest="$(docker image inspect "${POSTGRES_IMAGE_TAG}" --format '{{index .RepoDigests 0}}')"
[[ "${local_image_id}" == "${POSTGRES_IMAGE_ID}" ]] || fail "local PostgreSQL image ID drifted"
[[ "${local_image_digest}" == "${POSTGRES_IMAGE_DIGEST}" ]] || fail "local PostgreSQL image digest drifted"

say "container: starting generated loopback-only disposable target"
docker run --detach --rm --pull=never \
  --name "${container_name}" \
  --label "creditvector.p0.disposable=true" \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_USER="${DB_ROLE}" \
  --env POSTGRES_PASSWORD="${db_password}" \
  --env POSTGRES_DB="${primary_db}" \
  --health-cmd="pg_isready -U ${DB_ROLE} -d ${primary_db}" \
  --health-interval=1s \
  --health-timeout=3s \
  --health-retries=45 \
  "${local_image_id}" >"${tmp_root}/container.id"
container_started=1

for _attempt in $(seq 1 45); do
  health_status="$(docker inspect "${container_name}" --format '{{.State.Health.Status}}' 2>/dev/null || true)"
  [[ "${health_status}" == "healthy" ]] && break
  [[ "${health_status}" == "unhealthy" ]] && fail "disposable PostgreSQL became unhealthy"
  sleep 1
done
[[ "${health_status}" == "healthy" ]] || fail "disposable PostgreSQL readiness timed out"

port_binding="$(docker port "${container_name}" 5432/tcp)"
[[ "${port_binding}" =~ ^127\.0\.0\.1:[0-9]+$ ]] || fail "database is not loopback-only"
host_port="${port_binding##*:}"
[[ "${host_port}" =~ ^[0-9]+$ ]] || fail "Docker did not assign a random loopback port"

primary_url="postgresql://${DB_ROLE}:${db_password}@127.0.0.1:${host_port}/${primary_db}?schema=public"
rebuild_url="postgresql://${DB_ROLE}:${db_password}@127.0.0.1:${host_port}/${rebuild_db}?schema=public"

# Apply every pre-P0 repository migration first so synthetic baseline rows exist
# before the additive migration is introduced.
baseline_prisma="${tmp_root}/baseline-prisma"
mkdir -p "${baseline_prisma}/migrations"
cp "${SCHEMA_FILE}" "${baseline_prisma}/schema.prisma"
cp "${REPO_ROOT}/prisma/migrations/migration_lock.toml" "${baseline_prisma}/migrations/migration_lock.toml"
for migration_dir in "${REPO_ROOT}"/prisma/migrations/*; do
  [[ -d "${migration_dir}" ]] || continue
  [[ "$(basename "${migration_dir}")" == "${MIGRATION_NAME}" ]] && continue
  cp -R "${migration_dir}" "${baseline_prisma}/migrations/"
done

say "forward: applying baseline migrations with Prisma"
run_prisma_deploy "baseline-deploy" "${primary_url}" "${baseline_prisma}/schema.prisma"

baseline_seed_sql="${tmp_root}/baseline-seed.sql"
cat >"${baseline_seed_sql}" <<'SQL'
\set ON_ERROR_STOP on
INSERT INTO "User" ("id", "email", "role", "isAgency")
VALUES ('p0-synthetic-direct', 'direct@synthetic.invalid', 'USER', false);
INSERT INTO "User" ("id", "email", "role", "isAgency")
VALUES ('p0-synthetic-agency', 'agency@synthetic.invalid', 'USER', true);
INSERT INTO "User" ("id", "email", "role", "isAgency", "managedByAgencyId")
VALUES ('p0-synthetic-managed', 'managed@synthetic.invalid', 'USER', false, 'p0-synthetic-agency');
INSERT INTO "User" ("id", "email", "role", "isAgency")
VALUES ('p0-synthetic-foreign', 'foreign@synthetic.invalid', 'USER', false);

INSERT INTO "Report" ("id", "userId", "fileName", "bureaus", "rawText")
VALUES (
  'p0-synthetic-report',
  'p0-synthetic-direct',
  'synthetic-baseline.txt',
  ARRAY['EQUIFAX'::"Bureau"],
  NULL
);

INSERT INTO "Tradeline" (
  "id", "userId", "reportId", "creditorName", "accountType", "balance"
) VALUES (
  'p0-synthetic-tradeline',
  'p0-synthetic-direct',
  'p0-synthetic-report',
  'Synthetic Baseline Furnisher',
  'REVOLVING',
  0
);
SQL
psql_file "${primary_db}" "${baseline_seed_sql}" >/dev/null
baseline_before="$(baseline_snapshot "${primary_db}")"
baseline_before_sha="$(snapshot_sha256 "${baseline_before}")"

say "forward: applying full repository migrations including ${MIGRATION_NAME}"
run_prisma_deploy "p0-forward-deploy" "${primary_url}" "${SCHEMA_FILE}"
verify_catalog "${primary_db}" "primary"
run_prisma_diff "${primary_url}"

say "idempotence: applying full repository migrations a second time"
run_prisma_deploy "p0-second-deploy" "${primary_url}" "${SCHEMA_FILE}"
grep -q "No pending migrations to apply" "${LAST_PRISMA_LOG}" \
  || fail "second Prisma deploy was not an explicit no-op"

baseline_after_forward="$(baseline_snapshot "${primary_db}")"
[[ "${baseline_after_forward}" == "${baseline_before}" ]] \
  || fail "baseline rows changed during the P0 forward migration"

fixture_sql="${tmp_root}/p0-constraints.sql"
cat >"${fixture_sql}" <<'SQL'
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.expect_sqlstate(
  test_label text,
  statement_text text,
  expected_state text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE statement_text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN
      RAISE NOTICE 'P0_ASSERT_PASS % [%]', test_label, expected_state;
      RETURN;
    END IF;
    RAISE EXCEPTION 'P0_ASSERT_FAIL % expected %, got %: %',
      test_label, expected_state, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'P0_ASSERT_FAIL % expected %, statement succeeded',
    test_label, expected_state;
END;
$$;

BEGIN;

INSERT INTO "CreditTruthScope" ("tenantId", "consumerId") VALUES
  ('p0-synthetic-direct', 'p0-synthetic-direct'),
  ('p0-synthetic-agency', 'p0-synthetic-managed');

SELECT pg_temp.expect_sqlstate(
  'unauthorized tenant-consumer scope',
  $q$INSERT INTO "CreditTruthScope" ("tenantId", "consumerId")
     VALUES ('p0-synthetic-agency', 'p0-synthetic-foreign')$q$,
  '23514'
);

INSERT INTO "ReportVersion" (
  "id", "tenantId", "consumerId", "sourceReportId", "reportSeriesKey",
  "version", "origin", "authorityStatus", "schemaVersion", "inputSha256",
  "reportDateProvenance", "reportDate", "reportDateSourceLocator",
  "reportDateRuleKey", "reportDateRuleVersion", "createdByActorId"
) VALUES
  (
    'rv-legacy', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'p0-synthetic-report', 'legacy-series', 1, 'LEGACY_IMPORT',
    'LEGACY_UNVERIFIED', 'legacy-v1', repeat('1', 64), 'UNKNOWN', NULL,
    NULL, NULL, NULL, 'synthetic-actor'
  ),
  (
    'rv-v2', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'p0-synthetic-report', 'v2-series', 1, 'SYNTHETIC_TEST',
    'SHADOW_V2', 'truth-v2', repeat('2', 64), 'SOURCE_REPORTED',
    DATE '2026-01-15', 'synthetic-report-date-prior',
    'synthetic-date-rule', 'v1', 'synthetic-actor'
  );

SELECT pg_temp.expect_sqlstate(
  'legacy origin cannot be promoted',
  $q$INSERT INTO "ReportVersion" (
       "id", "tenantId", "consumerId", "reportSeriesKey", "version",
       "origin", "authorityStatus", "schemaVersion", "inputSha256",
       "createdByActorId"
     ) VALUES (
       'rv-bad-legacy', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'bad-legacy-series', 1, 'LEGACY_IMPORT', 'SHADOW_V2',
       'truth-v2', repeat('3', 64), 'synthetic-actor'
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'cross-consumer source report rejected',
  $q$INSERT INTO "ReportVersion" (
       "id", "tenantId", "consumerId", "sourceReportId", "reportSeriesKey",
       "version", "origin", "authorityStatus", "schemaVersion",
       "inputSha256", "createdByActorId"
     ) VALUES (
       'rv-cross-scope', 'p0-synthetic-agency', 'p0-synthetic-managed',
       'p0-synthetic-report', 'cross-series', 1, 'SYNTHETIC_TEST',
       'SHADOW_V2', 'truth-v2', repeat('4', 64), 'synthetic-actor'
     )$q$,
  '23503'
);

INSERT INTO "Account" (
  "id", "tenantId", "consumerId", "stableKey", "legacyTradelineId",
  "authorityStatus"
) VALUES
  (
    'acct-legacy', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'legacy-account', 'p0-synthetic-tradeline', 'LEGACY_UNVERIFIED'
  ),
  (
    'acct-clean', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'clean-account', NULL, 'SHADOW_V2'
  ),
  (
    'acct-neutral', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'neutral-account', NULL, 'SHADOW_V2'
  ),
  (
    'acct-partial', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'partial-probe-account', NULL, 'SHADOW_V2'
  ),
  (
    'acct-race-assessment-first', 'p0-synthetic-direct',
    'p0-synthetic-direct', 'race-assessment-first-account', NULL,
    'SHADOW_V2'
  ),
  (
    'acct-race-evidence-first', 'p0-synthetic-direct',
    'p0-synthetic-direct', 'race-evidence-first-account', NULL,
    'SHADOW_V2'
  );

INSERT INTO "ReportVersionAccount" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
) VALUES
  (
    'rva-clean', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'acct-clean', 0, 'SOURCE_LISTED', 'SHADOW_V2'
  ),
  (
    'rva-neutral', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'acct-neutral', 1, 'SOURCE_LISTED', 'SHADOW_V2'
  ),
  (
    'rva-partial', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'acct-partial', 2, 'SOURCE_LISTED', 'SHADOW_V2'
  ),
  (
    'rva-race-assessment-first', 'p0-synthetic-direct',
    'p0-synthetic-direct', 'rv-v2', 'acct-race-assessment-first', 3,
    'SOURCE_LISTED', 'SHADOW_V2'
  ),
  (
    'rva-race-evidence-first', 'p0-synthetic-direct',
    'p0-synthetic-direct', 'rv-v2', 'acct-race-evidence-first', 4,
    'SOURCE_LISTED', 'SHADOW_V2'
  );

SELECT pg_temp.expect_sqlstate(
  'legacy report cannot enter v2 report-account subject graph',
  $q$INSERT INTO "ReportVersionAccount" (
       "id", "tenantId", "consumerId", "reportVersionId", "accountId",
       "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
     ) VALUES (
       'rva-legacy-rejected', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-legacy', 'acct-legacy', 0, 'SOURCE_LISTED', 'LEGACY_UNVERIFIED'
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'legacy report rejects v2 extraction',
  $q$INSERT INTO "ExtractionRun" (
       "id", "tenantId", "consumerId", "reportVersionId", "runKey",
       "attempt", "engine", "engineVersion", "schemaVersion",
       "normalizationVersion", "status", "startedAt", "completedAt"
     ) VALUES (
       'run-legacy', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-legacy', 'legacy-run', 1, 'AI_V2', 'v2', 'v2', 'v2',
       'SUCCEEDED', now(), now()
     )$q$,
  '23514'
);

INSERT INTO "ExtractionRun" (
  "id", "tenantId", "consumerId", "reportVersionId", "runKey",
  "attempt", "engine", "engineVersion", "schemaVersion",
  "normalizationVersion", "status", "startedAt", "completedAt"
) VALUES
  (
    'run-clean', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'clean-run', 1, 'HYBRID_V2', 'v2', 'v2', 'v2',
    'SUCCEEDED', now(), now()
  ),
  (
    'run-neutral', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'neutral-run', 1, 'HYBRID_V2', 'v2', 'v2', 'v2',
    'SUCCEEDED', now(), now()
  );

INSERT INTO "ExtractionBureauCoverage" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus"
) VALUES
  ('cov-clean-eq', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-clean', 'EQUIFAX', 'COVERED'),
  ('cov-clean-ex', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-clean', 'EXPERIAN', 'COVERED'),
  ('cov-clean-tu', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-clean', 'TRANSUNION', 'OUTSIDE_COVERAGE'),
  ('cov-neutral-eq', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-neutral', 'EQUIFAX', 'COVERED'),
  ('cov-neutral-ex', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-neutral', 'EXPERIAN', 'OUTSIDE_COVERAGE'),
  ('cov-neutral-tu', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-neutral', 'TRANSUNION', 'OUTSIDE_COVERAGE');

DO $$
DECLARE
  bureau_value "Bureau";
  section_value "CreditReportSection";
  coverage_id text;
  account_id text;
  run_id text;
BEGIN
  FOREACH bureau_value IN ARRAY ARRAY['EQUIFAX'::"Bureau", 'EXPERIAN'::"Bureau"] LOOP
    coverage_id := CASE bureau_value
      WHEN 'EQUIFAX' THEN 'cov-clean-eq'
      ELSE 'cov-clean-ex'
    END;
    FOREACH section_value IN ARRAY ARRAY[
      'ACCOUNT_INDEX'::"CreditReportSection",
      'ACCOUNT_SUMMARY'::"CreditReportSection",
      'ACCOUNT_DETAIL'::"CreditReportSection",
      'PAYMENT_HISTORY'::"CreditReportSection",
      'COLLECTIONS'::"CreditReportSection",
      'REMARKS'::"CreditReportSection"
    ] LOOP
      INSERT INTO "SectionCompleteness" (
        "id", "tenantId", "consumerId", "reportVersionId", "accountId",
        "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
        "reportSection", "status", "requiredFieldKeys", "observedFieldKeys",
        "normalizationRuleKey", "normalizationRuleVersion"
      ) VALUES (
        format('sc-clean-%s-%s', lower(bureau_value::text), lower(section_value::text)),
        'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-clean',
        'run-clean', bureau_value, coverage_id, 'COVERED',
        section_value, 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[],
        'synthetic-rule', 'v1'
      );
    END LOOP;
  END LOOP;

  FOREACH section_value IN ARRAY ARRAY[
    'ACCOUNT_INDEX'::"CreditReportSection",
    'ACCOUNT_SUMMARY'::"CreditReportSection",
    'ACCOUNT_DETAIL'::"CreditReportSection",
    'PAYMENT_HISTORY'::"CreditReportSection",
    'COLLECTIONS'::"CreditReportSection",
    'REMARKS'::"CreditReportSection"
  ] LOOP
    INSERT INTO "SectionCompleteness" (
      "id", "tenantId", "consumerId", "reportVersionId", "accountId",
      "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
      "reportSection", "status", "requiredFieldKeys", "observedFieldKeys",
      "normalizationRuleKey", "normalizationRuleVersion"
    ) VALUES (
      format('sc-neutral-equifax-%s', lower(section_value::text)),
      'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-neutral',
      'run-neutral', 'EQUIFAX', 'cov-neutral-eq', 'COVERED',
      section_value, 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[],
      'synthetic-rule', 'v1'
    );
  END LOOP;
END;
$$;

INSERT INTO "AccountPresenceObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
  "presence", "observationSeriesKey", "revision", "integritySha256",
  "sourceLocatorToken", "accountIndexStatus", "accountIndexCompletenessId"
) VALUES
  (
    'apo-clean-eq', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
    'acct-clean', 'run-clean', 'EQUIFAX', 'cov-clean-eq', 'COVERED',
    'PRESENT', 'apo-clean-eq-series', 1, repeat('a', 64), 'loc-clean-eq',
    'COMPLETE', 'sc-clean-equifax-account_index'
  ),
  (
    'apo-clean-ex', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
    'acct-clean', 'run-clean', 'EXPERIAN', 'cov-clean-ex', 'COVERED',
    'PRESENT', 'apo-clean-ex-series', 1, repeat('b', 64), 'loc-clean-ex',
    'COMPLETE', 'sc-clean-experian-account_index'
  ),
  (
    'apo-clean-tu', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
    'acct-clean', 'run-clean', 'TRANSUNION', 'cov-clean-tu', 'OUTSIDE_COVERAGE',
    'UNKNOWN', 'apo-clean-tu-series', 1, repeat('c', 64), NULL, NULL, NULL
  ),
  (
    'apo-neutral-eq', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
    'acct-neutral', 'run-neutral', 'EQUIFAX', 'cov-neutral-eq', 'COVERED',
    'PRESENT', 'apo-neutral-eq-series', 1, repeat('d', 64), 'loc-neutral-eq',
    'COMPLETE', 'sc-neutral-equifax-account_index'
  );

SELECT pg_temp.expect_sqlstate(
  'ABSENT account requires complete account-index pin',
  $q$INSERT INTO "AccountPresenceObservation" (
       "id", "tenantId", "consumerId", "reportVersionId", "accountId",
       "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
       "presence", "observationSeriesKey", "revision", "integritySha256",
       "sourceLocatorToken"
     ) VALUES (
       'apo-bad-absence', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'acct-neutral', 'run-neutral', 'EQUIFAX',
       'cov-neutral-eq', 'COVERED', 'ABSENT_CONFIRMED',
       'apo-bad-series', 1, repeat('e', 64), 'loc-bad'
     )$q$,
  '23514'
);

DO $$
DECLARE
  bureau_value "Bureau";
  field_value text;
  section_value "CreditReportSection";
  coverage_id text;
  section_id text;
  signal_value "ObservationAssessmentSignal";
  presence_value "ObservationPresence";
BEGIN
  FOREACH bureau_value IN ARRAY ARRAY['EQUIFAX'::"Bureau", 'EXPERIAN'::"Bureau"] LOOP
    coverage_id := CASE bureau_value
      WHEN 'EQUIFAX' THEN 'cov-clean-eq'
      ELSE 'cov-clean-ex'
    END;
    FOREACH field_value IN ARRAY ARRAY[
      'summaryStatus', 'detailedStatus', 'balanceCents', 'dofd',
      'relevantDates', 'paymentHistory', 'collectionFacts',
      'chargeOffMarker', 'lossReported', 'remarks'
    ] LOOP
      section_value := CASE
        WHEN field_value IN ('summaryStatus', 'balanceCents') THEN 'ACCOUNT_SUMMARY'::"CreditReportSection"
        WHEN field_value IN ('detailedStatus', 'dofd', 'relevantDates', 'chargeOffMarker', 'lossReported') THEN 'ACCOUNT_DETAIL'::"CreditReportSection"
        WHEN field_value = 'paymentHistory' THEN 'PAYMENT_HISTORY'::"CreditReportSection"
        WHEN field_value = 'collectionFacts' THEN 'COLLECTIONS'::"CreditReportSection"
        ELSE 'REMARKS'::"CreditReportSection"
      END;
      section_id := format('sc-clean-%s-%s', lower(bureau_value::text), lower(section_value::text));
      presence_value := CASE
        WHEN field_value IN ('summaryStatus', 'detailedStatus') THEN 'PRESENT'::"ObservationPresence"
        ELSE 'ABSENT_CONFIRMED'::"ObservationPresence"
      END;
      signal_value := CASE
        WHEN field_value IN ('summaryStatus', 'detailedStatus') THEN 'AFFIRMATIVE_NON_ADVERSE'::"ObservationAssessmentSignal"
        ELSE 'UNCLASSIFIED'::"ObservationAssessmentSignal"
      END;

      INSERT INTO "FieldObservation" (
        "id", "tenantId", "consumerId", "reportVersionId", "accountId",
        "extractionRunId", "bureauCoverageId", "coverageStatus",
        "observationSeriesKey", "revision", "integritySha256", "bureau",
        "reportSection", "sectionStatus", "sectionCompletenessId",
        "fieldKey", "presence", "valueType", "valueCiphertext", "valueIv",
        "valueAuthTag", "valueKeyVersion", "valueAlgorithm",
        "valueEnvelopeVersion", "valueAadVersion", "assessmentSignal",
        "sourceLocatorToken", "normalizationRuleKey",
        "normalizationRuleVersion"
      ) VALUES (
        format('fo-clean-%s-%s', lower(bureau_value::text), field_value),
        'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-clean',
        'run-clean', coverage_id, 'COVERED',
        format('fo-clean-%s-%s-series', lower(bureau_value::text), field_value),
        1, repeat('a', 64), bureau_value, section_value, 'COMPLETE',
        section_id, field_value, presence_value, 'ENUM_CODE',
        CASE WHEN presence_value = 'PRESENT' THEN decode('01', 'hex') END,
        CASE WHEN presence_value = 'PRESENT' THEN decode('02', 'hex') END,
        CASE WHEN presence_value = 'PRESENT' THEN decode('03', 'hex') END,
        CASE WHEN presence_value = 'PRESENT' THEN 'synthetic-key-v1' END,
        CASE WHEN presence_value = 'PRESENT' THEN 'AES_256_GCM'::"EncryptionAlgorithm" END,
        CASE WHEN presence_value = 'PRESENT' THEN 'env-v1' END,
        CASE WHEN presence_value = 'PRESENT' THEN 'aad-v1' END,
        signal_value, format('loc-clean-%s-%s', lower(bureau_value::text), field_value),
        'synthetic-rule', 'v1'
      );
    END LOOP;
  END LOOP;

  FOREACH field_value IN ARRAY ARRAY[
    'summaryStatus', 'detailedStatus', 'balanceCents', 'dofd',
    'relevantDates', 'paymentHistory', 'collectionFacts',
    'chargeOffMarker', 'lossReported', 'remarks'
  ] LOOP
    section_value := CASE
      WHEN field_value IN ('summaryStatus', 'balanceCents') THEN 'ACCOUNT_SUMMARY'::"CreditReportSection"
      WHEN field_value IN ('detailedStatus', 'dofd', 'relevantDates', 'chargeOffMarker', 'lossReported') THEN 'ACCOUNT_DETAIL'::"CreditReportSection"
      WHEN field_value = 'paymentHistory' THEN 'PAYMENT_HISTORY'::"CreditReportSection"
      WHEN field_value = 'collectionFacts' THEN 'COLLECTIONS'::"CreditReportSection"
      ELSE 'REMARKS'::"CreditReportSection"
    END;
    presence_value := CASE
      WHEN field_value IN ('summaryStatus', 'detailedStatus') THEN 'PRESENT'::"ObservationPresence"
      ELSE 'ABSENT_CONFIRMED'::"ObservationPresence"
    END;

    INSERT INTO "FieldObservation" (
      "id", "tenantId", "consumerId", "reportVersionId", "accountId",
      "extractionRunId", "bureauCoverageId", "coverageStatus",
      "observationSeriesKey", "revision", "integritySha256", "bureau",
      "reportSection", "sectionStatus", "sectionCompletenessId",
      "fieldKey", "presence", "valueType", "valueCiphertext", "valueIv",
      "valueAuthTag", "valueKeyVersion", "valueAlgorithm",
      "valueEnvelopeVersion", "valueAadVersion", "assessmentSignal",
      "sourceLocatorToken", "normalizationRuleKey",
      "normalizationRuleVersion"
    ) VALUES (
      format('fo-neutral-equifax-%s', field_value),
      'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-neutral',
      'run-neutral', 'cov-neutral-eq', 'COVERED',
      format('fo-neutral-equifax-%s-series', field_value), 1,
      repeat('b', 64), 'EQUIFAX', section_value, 'COMPLETE',
      format('sc-neutral-equifax-%s', lower(section_value::text)),
      field_value, presence_value, 'ENUM_CODE',
      CASE WHEN presence_value = 'PRESENT' THEN decode('11', 'hex') END,
      CASE WHEN presence_value = 'PRESENT' THEN decode('12', 'hex') END,
      CASE WHEN presence_value = 'PRESENT' THEN decode('13', 'hex') END,
      CASE WHEN presence_value = 'PRESENT' THEN 'synthetic-key-v1' END,
      CASE WHEN presence_value = 'PRESENT' THEN 'AES_256_GCM'::"EncryptionAlgorithm" END,
      CASE WHEN presence_value = 'PRESENT' THEN 'env-v1' END,
      CASE WHEN presence_value = 'PRESENT' THEN 'aad-v1' END,
      'NEUTRAL', format('loc-neutral-%s', field_value),
      'synthetic-rule', 'v1'
    );
  END LOOP;
END;
$$;

-- Two otherwise CLEAN-complete accounts are reserved for the two-session
-- assessment-versus-adverse-evidence race in both commit orderings.
DO $$
DECLARE
  target_account text;
  target_prefix text;
BEGIN
  FOR target_account, target_prefix IN
    VALUES
      ('acct-race-assessment-first', 'race-assessment-first'),
      ('acct-race-evidence-first', 'race-evidence-first')
  LOOP
    INSERT INTO "SectionCompleteness"
    SELECT (jsonb_populate_record(
      NULL::"SectionCompleteness",
      to_jsonb(sc) || jsonb_build_object(
        'id', replace(sc."id", 'sc-clean', 'sc-' || target_prefix),
        'accountId', target_account,
        'createdAt', now()
      )
    )).*
    FROM "SectionCompleteness" sc
    WHERE sc."accountId" = 'acct-clean';

    INSERT INTO "AccountPresenceObservation"
    SELECT (jsonb_populate_record(
      NULL::"AccountPresenceObservation",
      to_jsonb(apo) || jsonb_build_object(
        'id', replace(apo."id", 'apo-clean', 'apo-' || target_prefix),
        'accountId', target_account,
        'observationSeriesKey', replace(
          apo."observationSeriesKey", 'apo-clean', 'apo-' || target_prefix
        ),
        'accountIndexCompletenessId', CASE
          WHEN apo."accountIndexCompletenessId" IS NULL THEN NULL
          ELSE replace(
            apo."accountIndexCompletenessId",
            'sc-clean',
            'sc-' || target_prefix
          )
        END,
        'observedAt', now()
      )
    )).*
    FROM "AccountPresenceObservation" apo
    WHERE apo."accountId" = 'acct-clean';

    INSERT INTO "FieldObservation"
    SELECT (jsonb_populate_record(
      NULL::"FieldObservation",
      to_jsonb(fo) || jsonb_build_object(
        'id', replace(fo."id", 'fo-clean', 'fo-' || target_prefix),
        'accountId', target_account,
        'observationSeriesKey', replace(
          fo."observationSeriesKey", 'fo-clean', 'fo-' || target_prefix
        ),
        'sectionCompletenessId', replace(
          fo."sectionCompletenessId", 'sc-clean', 'sc-' || target_prefix
        ),
        'sourceLocatorToken', replace(
          fo."sourceLocatorToken", 'loc-clean', 'loc-' || target_prefix
        ),
        'observedAt', now()
      )
    )).*
    FROM "FieldObservation" fo
    WHERE fo."accountId" = 'acct-clean';
  END LOOP;
END;
$$;

-- Explicit exploit regressions for the refrozen section pin.
SELECT pg_temp.expect_sqlstate(
  'primary field cannot pin wrong section',
  $q$INSERT INTO "FieldObservation" (
       "id", "tenantId", "consumerId", "reportVersionId", "accountId",
       "extractionRunId", "bureauCoverageId", "coverageStatus",
       "observationSeriesKey", "revision", "integritySha256", "bureau",
       "reportSection", "sectionStatus", "sectionCompletenessId", "fieldKey",
       "presence", "valueType", "sourceLocatorToken",
       "normalizationRuleKey", "normalizationRuleVersion"
     ) VALUES (
       'fo-wrong-primary-section', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'rv-v2', 'acct-neutral', 'run-neutral',
       'cov-neutral-eq', 'COVERED', 'wrong-section-series', 1,
       repeat('c', 64), 'EQUIFAX', 'REMARKS', 'COMPLETE',
       'sc-neutral-equifax-remarks', 'summaryStatus', 'ABSENT_CONFIRMED',
       'ENUM_CODE', 'loc-wrong', 'synthetic-rule', 'v1'
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'field cannot pin another section row',
  $q$INSERT INTO "FieldObservation" (
       "id", "tenantId", "consumerId", "reportVersionId", "accountId",
       "extractionRunId", "bureauCoverageId", "coverageStatus",
       "observationSeriesKey", "revision", "integritySha256", "bureau",
       "reportSection", "sectionStatus", "sectionCompletenessId", "fieldKey",
       "presence", "valueType", "sourceLocatorToken",
       "normalizationRuleKey", "normalizationRuleVersion"
     ) VALUES (
       'fo-wrong-section-pin', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'rv-v2', 'acct-neutral', 'run-neutral',
       'cov-neutral-eq', 'COVERED', 'wrong-pin-series', 1,
       repeat('d', 64), 'EQUIFAX', 'ACCOUNT_SUMMARY', 'COMPLETE',
       'sc-neutral-equifax-remarks', 'pinProbe', 'ABSENT_CONFIRMED',
       'MONEY_CENTS', 'loc-wrong-pin', 'synthetic-rule', 'v1'
     )$q$,
  '23503'
);

INSERT INTO "SectionCompleteness" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
  "reportSection", "status", "normalizationRuleKey",
  "normalizationRuleVersion"
) VALUES (
  'sc-neutral-equifax-partial-probe', 'p0-synthetic-direct',
  'p0-synthetic-direct', 'rv-v2', 'acct-partial', 'run-neutral',
  'EQUIFAX', 'cov-neutral-eq', 'COVERED', 'REMARKS', 'PARTIAL',
  'synthetic-rule', 'v1'
);

SELECT pg_temp.expect_sqlstate(
  'ABSENT_CONFIRMED cannot pin PARTIAL section',
  $q$INSERT INTO "HistoricalEvidence" (
       "id", "tenantId", "consumerId", "reportVersionId", "accountId",
       "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
       "reportSection", "sectionStatus", "sectionCompletenessId",
       "evidenceType", "presence", "sourceLocatorToken",
       "normalizationRuleKey", "normalizationRuleVersion"
     ) VALUES (
       'he-partial-absence', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'acct-partial', 'run-neutral', 'EQUIFAX',
       'cov-neutral-eq', 'COVERED', 'REMARKS', 'PARTIAL',
       'sc-neutral-equifax-partial-probe', 'OTHER_ADVERSE',
       'ABSENT_CONFIRMED', 'loc-partial', 'synthetic-rule', 'v1'
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'PRESENT envelope requires algorithm metadata',
  $q$INSERT INTO "FieldObservation" (
       "id", "tenantId", "consumerId", "reportVersionId", "accountId",
       "extractionRunId", "bureauCoverageId", "coverageStatus",
       "observationSeriesKey", "revision", "integritySha256", "bureau",
       "reportSection", "sectionStatus", "sectionCompletenessId", "fieldKey",
       "presence", "valueType", "valueCiphertext", "valueIv", "valueAuthTag",
       "valueKeyVersion", "sourceLocatorToken", "normalizationRuleKey",
       "normalizationRuleVersion"
     ) VALUES (
       'fo-bad-envelope', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'acct-neutral', 'run-neutral', 'cov-neutral-eq', 'COVERED',
       'bad-envelope-series', 1, repeat('e', 64), 'EQUIFAX', 'REMARKS',
       'COMPLETE', 'sc-neutral-equifax-remarks', 'envelopeProbe',
       'PRESENT', 'TEXT', decode('01','hex'), decode('02','hex'),
       decode('03','hex'), 'key-v1', 'loc-envelope',
       'synthetic-rule', 'v1'
     )$q$,
  '23514'
);

INSERT INTO "DerivedAccountAssessment" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "assessmentVersion", "classifierVersion",
  "policyVersion", "inputSetSha256", "evidenceCompleteness",
  "accountCondition", "disputeGrounds", "reportedAdversity"
) VALUES
  (
    'assessment-clean', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'acct-clean', 'run-clean', 1, 'classifier-v1', 'policy-v1',
    repeat('6', 64), 'COMPLETE', 'CLEAN', 'NONE_DETECTED', 'FAVORABLE'
  ),
  (
    'assessment-neutral', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'acct-neutral', 'run-neutral', 1, 'classifier-v1', 'policy-v1',
    repeat('7', 64), 'COMPLETE', 'NEEDS_REVIEW',
    'CONSUMER_REVIEW_REQUIRED', 'UNKNOWN'
  );

SELECT pg_temp.expect_sqlstate(
  'CLEAN requires affirmative non-adverse evidence',
  $q$INSERT INTO "DerivedAccountAssessment" (
       "id", "tenantId", "consumerId", "reportVersionId", "accountId",
       "extractionRunId", "assessmentVersion", "classifierVersion",
       "policyVersion", "inputSetSha256", "evidenceCompleteness",
       "accountCondition", "disputeGrounds", "reportedAdversity"
     ) VALUES (
       'assessment-bad-clean', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'rv-v2', 'acct-neutral', 'run-neutral', 2,
       'classifier-v1', 'policy-v1', repeat('8', 64), 'COMPLETE',
       'CLEAN', 'NONE_DETECTED', 'FAVORABLE'
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'assessment inputs are sealed',
  $q$INSERT INTO "FieldObservation" (
       "id", "tenantId", "consumerId", "reportVersionId", "accountId",
       "extractionRunId", "bureauCoverageId", "coverageStatus",
       "observationSeriesKey", "revision", "integritySha256", "bureau",
       "reportSection", "sectionStatus", "sectionCompletenessId", "fieldKey",
       "presence", "valueType", "sourceLocatorToken",
       "normalizationRuleKey", "normalizationRuleVersion"
     ) VALUES (
       'fo-post-assessment', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'acct-clean', 'run-clean', 'cov-clean-eq', 'COVERED',
       'post-assessment-series', 1, repeat('f', 64), 'EQUIFAX',
       'REMARKS', 'COMPLETE', 'sc-clean-equifax-remarks', 'postProbe',
       'ABSENT_CONFIRMED', 'TEXT', 'loc-post', 'synthetic-rule', 'v1'
     )$q$,
  '55000'
);

INSERT INTO "ConsumerAssertion" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureau", "fieldKey", "observationId",
  "observationSeriesKey", "observationRevision",
  "observationIntegritySha256", "assessmentId", "assertionSeriesKey",
  "version", "disposition", "confirmedByActorId", "confirmedAt"
) VALUES
  (
    'assert-clean', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'acct-clean', 'run-clean', 'EQUIFAX', 'summaryStatus',
    'fo-clean-equifax-summaryStatus',
    'fo-clean-equifax-summaryStatus-series', 1, repeat('a', 64),
    'assessment-clean', 'assert-series-clean', 1, 'CONFIRMED_ACCURATE',
    'synthetic-actor', now()
  ),
  (
    'assert-neutral', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'acct-neutral', 'run-neutral', 'EQUIFAX', 'summaryStatus',
    'fo-neutral-equifax-summaryStatus',
    'fo-neutral-equifax-summaryStatus-series', 1, repeat('b', 64),
    'assessment-neutral', 'assert-series-neutral', 1,
    'CONFIRMED_INACCURATE', 'synthetic-actor', now()
  );

SELECT pg_temp.expect_sqlstate(
  'assertion cannot cross extraction runs',
  $q$INSERT INTO "ConsumerAssertion" (
       "id", "tenantId", "consumerId", "reportVersionId", "accountId",
       "extractionRunId", "bureau", "fieldKey", "observationId",
       "observationSeriesKey", "observationRevision",
       "observationIntegritySha256", "assessmentId", "assertionSeriesKey",
       "version", "disposition", "confirmedByActorId", "confirmedAt"
     ) VALUES (
       'assert-cross-run', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'acct-clean', 'run-clean', 'EQUIFAX', 'summaryStatus',
       'fo-clean-equifax-summaryStatus',
       'fo-clean-equifax-summaryStatus-series', 1, repeat('a',64),
       'assessment-neutral', 'assert-series-cross', 1,
       'CONFIRMED_INACCURATE', 'synthetic-actor', now()
     )$q$,
  '23503'
);

INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "baselineSeriesKey",
  "version", "status", "policyVersion", "inputSetSha256",
  "confirmedByActorId", "confirmedAt", "createdByActorId"
) VALUES
  (
    'baseline-1', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'baseline-series-1', 1, 'CONFIRMED', 'policy-v1',
    repeat('9',64), 'synthetic-actor', now(), 'synthetic-actor'
  ),
  (
    'baseline-2', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'baseline-series-2', 1, 'CONFIRMED', 'policy-v1',
    repeat('0',64), 'synthetic-actor', now(), 'synthetic-actor'
  ),
  (
    'baseline-draft', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'baseline-series-draft', 1, 'DRAFT', 'policy-v1',
    repeat('8',64), NULL, NULL, 'synthetic-actor'
  ),
  (
    'baseline-2-current', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'baseline-series-2', 2, 'CONFIRMED', 'policy-v1',
    repeat('7',64), 'synthetic-actor', now(), 'synthetic-actor'
  );

INSERT INTO "Recipient" (
  "id", "tenantId", "consumerId", "stableKey", "recipientType"
) VALUES
  ('recipient-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'recipient-one', 'CREDIT_REPORTING_AGENCY'),
  ('recipient-2', 'p0-synthetic-direct', 'p0-synthetic-direct', 'recipient-two', 'FURNISHER');

INSERT INTO "RecipientAddressVersion" (
  "id", "tenantId", "consumerId", "recipientId", "addressSeriesKey",
  "version", "status", "addressCiphertext", "addressIv", "addressAuthTag",
  "addressKeyVersion", "addressAlgorithm", "addressEnvelopeVersion",
  "addressAadVersion", "validationRuleKey", "validationRuleVersion",
  "effectiveAt", "createdByActorId"
) VALUES
  (
    'address-1', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'recipient-1', 'address-series-1', 1, 'VALIDATED',
    decode('01','hex'), decode('02','hex'), decode('03','hex'), 'key-v1',
    'AES_256_GCM', 'env-v1', 'aad-v1', 'synthetic-validation', 'v1',
    now(), 'synthetic-actor'
  ),
  (
    'address-2', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'recipient-2', 'address-series-2', 1, 'VALIDATED',
    decode('11','hex'), decode('12','hex'), decode('13','hex'), 'key-v1',
    'AES_256_GCM', 'env-v1', 'aad-v1', 'synthetic-validation', 'v1',
    now(), 'synthetic-actor'
  ),
  (
    'address-unverified', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'recipient-1', 'address-series-unverified', 1, 'UNVERIFIED',
    decode('21','hex'), decode('22','hex'), decode('23','hex'), 'key-v1',
    'AES_256_GCM', 'env-v1', 'aad-v1', 'synthetic-validation', 'v1',
    now(), 'synthetic-actor'
  ),
  (
    'address-2-current', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'recipient-2', 'address-series-2', 2, 'VALIDATED',
    decode('31','hex'), decode('32','hex'), decode('33','hex'), 'key-v1',
    'AES_256_GCM', 'env-v1', 'aad-v1', 'synthetic-validation', 'v1',
    now(), 'synthetic-actor'
  );

INSERT INTO "DisputeCase" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseKey",
  "status", "policyVersion", "createdByActorId", "updatedAt"
) VALUES (
  'case-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-key-1', 'DRAFT', 'policy-v1', 'synthetic-actor', now()
);

INSERT INTO "Correspondence" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "recipientId", "recipientAddressVersionId", "identityBaselineId",
  "strategyKey", "claimClass", "policyVersion", "round", "status",
  "idempotencyKey", "parentLineageRef", "createdByActorId", "updatedAt"
) VALUES (
  'corr-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-1', 'recipient-1', 'address-1', 'baseline-1',
  'synthetic-strategy', 'FACTUAL_ACCURACY', 'policy-v1', 1, 'DRAFT',
  'corr-idempotency-1', 'ROOT', 'synthetic-actor', now()
);

SELECT pg_temp.expect_sqlstate(
  'round one correspondence requires ROOT lineage',
  $q$INSERT INTO "Correspondence" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "strategyKey", "claimClass", "policyVersion", "round", "status",
       "idempotencyKey", "parentLineageRef", "createdByActorId", "updatedAt"
     ) VALUES (
       'corr-bad-root', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'recipient-1', 'address-1', 'baseline-1',
       'synthetic-strategy', 'FACTUAL_ACCURACY', 'policy-v1', 1, 'DRAFT',
       'corr-idempotency-bad-root', 'NOT_ROOT', 'synthetic-actor', now()
     )$q$,
  '23514'
);

INSERT INTO "Correspondence" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "recipientId", "recipientAddressVersionId", "identityBaselineId",
  "strategyKey", "claimClass", "policyVersion", "round", "status",
  "idempotencyKey", "parentCorrespondenceId", "parentRound",
  "parentLineageRef", "createdByActorId", "updatedAt"
) VALUES (
  'corr-2', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-1', 'recipient-1', 'address-1', 'baseline-1',
  'synthetic-strategy', 'FACTUAL_ACCURACY', 'policy-v1', 2, 'DRAFT',
  'corr-idempotency-2', 'corr-1', 1, 'corr-1', 'synthetic-actor', now()
);

SELECT pg_temp.expect_sqlstate(
  'child correspondence cannot change recipient',
  $q$INSERT INTO "Correspondence" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "strategyKey", "claimClass", "policyVersion", "round", "status",
       "idempotencyKey", "parentCorrespondenceId", "parentRound",
       "parentLineageRef", "createdByActorId", "updatedAt"
     ) VALUES (
       'corr-bad-recipient', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'recipient-2', 'address-2', 'baseline-1',
       'synthetic-strategy', 'FACTUAL_ACCURACY', 'policy-v1', 2, 'DRAFT',
       'corr-idempotency-bad-recipient', 'corr-1', 1, 'corr-1',
       'synthetic-actor', now()
     )$q$,
  '23503'
);

INSERT INTO "CorrespondenceItem" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "correspondenceId", "accountId", "extractionRunId", "bureau",
  "fieldKey", "observationId", "observationSeriesKey",
  "observationRevision", "observationIntegritySha256", "assessmentId",
  "consumerAssertionId", "itemKey", "ordinal", "claimType"
) VALUES (
  'item-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-1', 'corr-1', 'acct-clean', 'run-clean', 'EQUIFAX',
  'summaryStatus', 'fo-clean-equifax-summaryStatus',
  'fo-clean-equifax-summaryStatus-series', 1, repeat('a',64),
  'assessment-clean', 'assert-clean', 'item-key-1', 0, 'FACTUAL_ACCURACY'
);

INSERT INTO "CorrespondenceItem" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "correspondenceId", "accountId", "extractionRunId", "bureau",
  "fieldKey", "observationId", "observationSeriesKey",
  "observationRevision", "observationIntegritySha256", "assessmentId",
  "consumerAssertionId", "itemKey", "ordinal", "claimType"
) VALUES (
  'item-2', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-1', 'corr-1', 'acct-clean', 'run-clean', 'EQUIFAX',
  'summaryStatus', 'fo-clean-equifax-summaryStatus',
  'fo-clean-equifax-summaryStatus-series', 1, repeat('a',64),
  'assessment-clean', 'assert-clean', 'item-key-2', 1, 'FACTUAL_ACCURACY'
);

SELECT pg_temp.expect_sqlstate(
  'correspondence item rejects mismatched assertion chain',
  $q$INSERT INTO "CorrespondenceItem" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "correspondenceId", "accountId", "extractionRunId", "bureau",
       "fieldKey", "observationId", "observationSeriesKey",
       "observationRevision", "observationIntegritySha256", "assessmentId",
       "consumerAssertionId", "itemKey", "ordinal", "claimType"
     ) VALUES (
       'item-bad-chain', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'corr-1', 'acct-clean', 'run-clean', 'EQUIFAX',
       'summaryStatus', 'fo-clean-equifax-summaryStatus',
       'fo-clean-equifax-summaryStatus-series', 1, repeat('a',64),
       'assessment-clean', 'assert-neutral', 'item-key-bad', 2,
       'FACTUAL_ACCURACY'
     )$q$,
  '23503'
);

INSERT INTO "CorrespondenceVersion" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "correspondenceId", "version", "status", "strategyKey", "claimClass",
  "policyVersion", "round", "parentLineageRef", "templateVersion",
  "recipientId", "recipientAddressVersionId", "identityBaselineId",
  "bodyCiphertext", "bodyIv", "bodyAuthTag", "bodyKeyVersion",
  "bodyAlgorithm", "bodyEnvelopeVersion", "bodyAadVersion", "bodySha256",
  "itemSetSha256", "itemCount", "supersedesVersionId",
  "approvedByActorId", "approvedAt", "createdByActorId"
) VALUES
  (
    'cv-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
    'case-1', 'corr-1', 1, 'APPROVED', 'synthetic-strategy',
    'FACTUAL_ACCURACY', 'policy-v1', 1, 'ROOT', 'template-v1',
    'recipient-1', 'address-1', 'baseline-1', decode('01','hex'),
    decode('02','hex'), decode('03','hex'), 'key-v1', 'AES_256_GCM',
    'env-v1', 'aad-v1', repeat('a',64), repeat('b',64), 1, NULL,
    'synthetic-approver', now(), 'synthetic-actor'
  ),
  (
    'cv-2', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
    'case-1', 'corr-1', 2, 'APPROVED', 'synthetic-strategy',
    'FACTUAL_ACCURACY', 'policy-v1', 1, 'ROOT', 'template-v1',
    'recipient-1', 'address-1', 'baseline-1', decode('11','hex'),
    decode('12','hex'), decode('13','hex'), 'key-v1', 'AES_256_GCM',
    'env-v1', 'aad-v1', repeat('c',64), repeat('d',64), 0, 'cv-1',
    'synthetic-approver', now(), 'synthetic-actor'
  ),
  (
    'cv-3', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
    'case-1', 'corr-1', 3, 'APPROVED', 'synthetic-strategy',
    'FACTUAL_ACCURACY', 'policy-v1', 1, 'ROOT', 'template-v1',
    'recipient-1', 'address-1', 'baseline-1', decode('14','hex'),
    decode('15','hex'), decode('16','hex'), 'key-v1', 'AES_256_GCM',
    'env-v1', 'aad-v1', repeat('1',64), repeat('2',64), 0, 'cv-2',
    'synthetic-approver', now(), 'synthetic-actor'
  ),
  (
    'cv-child', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
    'case-1', 'corr-2', 1, 'DRAFT', 'synthetic-strategy',
    'FACTUAL_ACCURACY', 'policy-v1', 2, 'corr-1', 'template-v1',
    'recipient-1', 'address-1', 'baseline-1', decode('21','hex'),
    decode('22','hex'), decode('23','hex'), 'key-v1', 'AES_256_GCM',
    'env-v1', 'aad-v1', repeat('e',64), repeat('f',64), 0, NULL,
    NULL, NULL, 'synthetic-actor'
  );

SELECT pg_temp.expect_sqlstate(
  'correspondence version cannot change recipient',
  $q$INSERT INTO "CorrespondenceVersion" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "correspondenceId", "version", "status", "strategyKey", "claimClass",
       "policyVersion", "round", "parentLineageRef", "templateVersion",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "bodyCiphertext", "bodyIv", "bodyAuthTag", "bodyKeyVersion",
       "bodyAlgorithm", "bodyEnvelopeVersion", "bodyAadVersion", "bodySha256",
       "itemSetSha256", "createdByActorId"
     ) VALUES (
       'cv-bad-recipient', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'corr-1', 5, 'DRAFT', 'synthetic-strategy',
       'FACTUAL_ACCURACY', 'policy-v1', 1, 'ROOT', 'template-v1',
       'recipient-2', 'address-2', 'baseline-1', decode('31','hex'),
       decode('32','hex'), decode('33','hex'), 'key-v1', 'AES_256_GCM',
       'env-v1', 'aad-v1', repeat('1',64), repeat('2',64), 'synthetic-actor'
     )$q$,
  '23503'
);

SELECT pg_temp.expect_sqlstate(
  'correspondence supersession stays within correspondence',
  $q$INSERT INTO "CorrespondenceVersion" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "correspondenceId", "version", "status", "strategyKey", "claimClass",
       "policyVersion", "round", "parentLineageRef", "templateVersion",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "bodyCiphertext", "bodyIv", "bodyAuthTag", "bodyKeyVersion",
       "bodyAlgorithm", "bodyEnvelopeVersion", "bodyAadVersion", "bodySha256",
       "itemSetSha256", "supersedesVersionId", "createdByActorId"
     ) VALUES (
       'cv-bad-supersession', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'corr-1', 5, 'DRAFT', 'synthetic-strategy',
       'FACTUAL_ACCURACY', 'policy-v1', 1, 'ROOT', 'template-v1',
       'recipient-1', 'address-1', 'baseline-1', decode('41','hex'),
       decode('42','hex'), decode('43','hex'), 'key-v1', 'AES_256_GCM',
       'env-v1', 'aad-v1', repeat('3',64), repeat('4',64), 'cv-child',
       'synthetic-actor'
     )$q$,
  '23514'
);

INSERT INTO "CorrespondenceVersionItem" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "correspondenceId", "correspondenceVersionId", "correspondenceItemId",
  "ordinal"
) VALUES (
  'cvi-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-1', 'corr-1', 'cv-1', 'item-1', 0
);

INSERT INTO "Packet" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "recipientId", "recipientAddressVersionId", "identityBaselineId",
  "packetSeriesKey", "version", "round", "claimClass", "policyVersion",
  "enclosureManifestSha256", "correspondenceVersionCount",
  "enclosureCount", "status", "approvedByActorId", "approvedAt",
  "createdByActorId"
) VALUES (
  'packet-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-1', 'recipient-1', 'address-1', 'baseline-1', 'packet-series-1',
  1, 1, 'FACTUAL_ACCURACY', 'policy-v1', repeat('5',64), 1, 1,
  'APPROVED', 'synthetic-approver', now(), 'synthetic-actor'
);

SELECT pg_temp.expect_sqlstate(
  'approved packet rejects unvalidated recipient address',
  $q$INSERT INTO "Packet" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "packetSeriesKey", "version", "round", "claimClass", "policyVersion",
       "enclosureManifestSha256", "correspondenceVersionCount",
       "enclosureCount", "status", "approvedByActorId", "approvedAt",
       "createdByActorId"
     ) VALUES (
       'packet-bad-address', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'recipient-1', 'address-unverified', 'baseline-1',
       'packet-series-bad-address', 1, 1, 'FACTUAL_ACCURACY', 'policy-v1',
       repeat('1',64), 0, 0, 'APPROVED', 'synthetic-approver', now(),
       'synthetic-actor'
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'approved packet rejects unconfirmed identity baseline',
  $q$INSERT INTO "Packet" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "packetSeriesKey", "version", "round", "claimClass", "policyVersion",
       "enclosureManifestSha256", "correspondenceVersionCount",
       "enclosureCount", "status", "approvedByActorId", "approvedAt",
       "createdByActorId"
     ) VALUES (
       'packet-bad-baseline', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'recipient-1', 'address-1', 'baseline-draft',
       'packet-series-bad-baseline', 1, 1, 'FACTUAL_ACCURACY', 'policy-v1',
       repeat('2',64), 0, 0, 'APPROVED', 'synthetic-approver', now(),
       'synthetic-actor'
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'approved packet rejects superseded validated address version',
  $q$INSERT INTO "Packet" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "packetSeriesKey", "version", "round", "claimClass", "policyVersion",
       "enclosureManifestSha256", "correspondenceVersionCount",
       "enclosureCount", "status", "approvedByActorId", "approvedAt",
       "createdByActorId"
     ) VALUES (
       'packet-stale-address', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'recipient-2', 'address-2', 'baseline-1',
       'packet-series-stale-address', 1, 1, 'FACTUAL_ACCURACY', 'policy-v1',
       repeat('3',64), 0, 0, 'APPROVED', 'synthetic-approver', now(),
       'synthetic-actor'
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'approved packet rejects superseded confirmed identity baseline',
  $q$INSERT INTO "Packet" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "packetSeriesKey", "version", "round", "claimClass", "policyVersion",
       "enclosureManifestSha256", "correspondenceVersionCount",
       "enclosureCount", "status", "approvedByActorId", "approvedAt",
       "createdByActorId"
     ) VALUES (
       'packet-stale-baseline', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'recipient-1', 'address-1', 'baseline-2',
       'packet-series-stale-baseline', 1, 1, 'FACTUAL_ACCURACY', 'policy-v1',
       repeat('4',64), 0, 0, 'APPROVED', 'synthetic-approver', now(),
       'synthetic-actor'
     )$q$,
  '23514'
);

INSERT INTO "PacketCorrespondenceVersion" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "recipientId", "recipientAddressVersionId", "identityBaselineId",
  "policyVersion", "round", "claimClass", "packetId", "correspondenceId",
  "correspondenceVersionId", "ordinal"
) VALUES (
  'pcv-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-1', 'recipient-1', 'address-1', 'baseline-1', 'policy-v1', 1,
  'FACTUAL_ACCURACY', 'packet-1', 'corr-1', 'cv-1', 0
);

SELECT pg_temp.expect_sqlstate(
  'packet membership rejects policy mismatch',
  $q$INSERT INTO "PacketCorrespondenceVersion" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "policyVersion", "round", "claimClass", "packetId",
       "correspondenceId", "correspondenceVersionId", "ordinal"
     ) VALUES (
       'pcv-bad-policy', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'recipient-1', 'address-1', 'baseline-1',
       'wrong-policy', 1, 'FACTUAL_ACCURACY', 'packet-1', 'corr-1',
       'cv-2', 1
     )$q$,
  '23503'
);

SELECT pg_temp.expect_sqlstate(
  'packet membership rejects baseline mismatch',
  $q$INSERT INTO "PacketCorrespondenceVersion" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "policyVersion", "round", "claimClass", "packetId",
       "correspondenceId", "correspondenceVersionId", "ordinal"
     ) VALUES (
       'pcv-bad-baseline', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'recipient-1', 'address-1', 'baseline-2',
       'policy-v1', 1, 'FACTUAL_ACCURACY', 'packet-1', 'corr-1',
       'cv-2', 1
     )$q$,
  '23503'
);

SELECT pg_temp.expect_sqlstate(
  'packet membership rejects round and claim mismatch',
  $q$INSERT INTO "PacketCorrespondenceVersion" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "policyVersion", "round", "claimClass", "packetId",
       "correspondenceId", "correspondenceVersionId", "ordinal"
     ) VALUES (
       'pcv-bad-round-claim', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'rv-v2', 'case-1', 'recipient-1',
       'address-1', 'baseline-1', 'policy-v1', 2, 'OTHER_CLAIM',
       'packet-1', 'corr-1', 'cv-2', 1
     )$q$,
  '23503'
);

INSERT INTO "Artifact" (
  "id", "tenantId", "consumerId", "artifactSeriesKey", "version", "kind",
  "reportVersionId", "caseId", "packetId", "primaryCorrespondenceId",
  "primaryCorrespondenceVersionId", "recipientId",
  "recipientAddressVersionId", "identityBaselineId", "storageProviderKey",
  "storageLocatorCiphertext", "storageLocatorIv", "storageLocatorAuthTag",
  "storageLocatorKeyVersion", "storageLocatorAlgorithm",
  "storageLocatorEnvelopeVersion", "storageLocatorAadVersion", "sha256",
  "mimeType", "byteLength", "pageCount", "rendererVersion",
  "templateVersion", "policyVersion", "round", "claimClass",
  "enclosureManifestSha256", "correspondenceVersionCount",
  "createdByActorId"
) VALUES (
  'artifact-canonical', 'p0-synthetic-direct', 'p0-synthetic-direct',
  'artifact-series-canonical', 1, 'CANONICAL_PACKET_PDF', 'rv-v2',
  'case-1', 'packet-1', 'corr-1', 'cv-1', 'recipient-1', 'address-1',
  'baseline-1', 'synthetic-provider', decode('01','hex'),
  decode('02','hex'), decode('03','hex'), 'key-v1', 'AES_256_GCM',
  'env-v1', 'aad-v1', repeat('6',64), 'application/pdf', 128, 1,
  'renderer-v1', 'template-v1', 'policy-v1', 1, 'FACTUAL_ACCURACY',
  repeat('5',64), 1, 'synthetic-actor'
);

INSERT INTO "ArtifactCorrespondenceVersion" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "recipientId", "recipientAddressVersionId", "identityBaselineId",
  "policyVersion", "round", "claimClass", "packetId", "artifactId",
  "correspondenceId", "correspondenceVersionId", "ordinal"
) VALUES (
  'acv-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-1', 'recipient-1', 'address-1', 'baseline-1', 'policy-v1', 1,
  'FACTUAL_ACCURACY', 'packet-1', 'artifact-canonical', 'corr-1', 'cv-1', 0
);

SELECT pg_temp.expect_sqlstate(
  'canonical artifact membership requires exact approved packet member',
  $q$INSERT INTO "ArtifactCorrespondenceVersion" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "policyVersion", "round", "claimClass", "packetId", "artifactId",
       "correspondenceId", "correspondenceVersionId", "ordinal"
     ) VALUES (
       'acv-bad-membership', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'rv-v2', 'case-1', 'recipient-1', 'address-1', 'baseline-1',
       'policy-v1', 1, 'FACTUAL_ACCURACY', 'packet-1',
       'artifact-canonical', 'corr-1', 'cv-2', 1
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'canonical artifact CV must belong to packet',
  $q$INSERT INTO "Artifact" (
       "id", "tenantId", "consumerId", "artifactSeriesKey", "version",
       "kind", "reportVersionId", "caseId", "packetId",
       "primaryCorrespondenceId", "primaryCorrespondenceVersionId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "storageProviderKey", "storageLocatorCiphertext", "storageLocatorIv",
       "storageLocatorAuthTag", "storageLocatorKeyVersion",
       "storageLocatorAlgorithm", "storageLocatorEnvelopeVersion",
       "storageLocatorAadVersion", "sha256", "mimeType", "byteLength",
       "pageCount", "rendererVersion", "templateVersion", "policyVersion",
       "round", "claimClass", "enclosureManifestSha256",
       "correspondenceVersionCount", "createdByActorId"
     ) VALUES (
       'artifact-bad-membership', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'artifact-series-bad', 1,
       'CANONICAL_PACKET_PDF', 'rv-v2', 'case-1', 'packet-1', 'corr-1',
       'cv-2', 'recipient-1', 'address-1', 'baseline-1',
       'synthetic-provider', decode('11','hex'), decode('12','hex'),
       decode('13','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
       repeat('7',64), 'application/pdf', 128, 1, 'renderer-v1',
       'template-v1', 'policy-v1', 1, 'FACTUAL_ACCURACY', repeat('5',64),
       1, 'synthetic-actor'
     )$q$,
  '23503'
);

INSERT INTO "Artifact" (
  "id", "tenantId", "consumerId", "artifactSeriesKey", "version", "kind",
  "reportVersionId", "caseId", "packetId", "recipientId",
  "recipientAddressVersionId", "identityBaselineId", "policyVersion",
  "round", "claimClass", "storageProviderKey",
  "storageLocatorCiphertext", "storageLocatorIv", "storageLocatorAuthTag",
  "storageLocatorKeyVersion", "storageLocatorAlgorithm",
  "storageLocatorEnvelopeVersion", "storageLocatorAadVersion", "sha256",
  "mimeType", "byteLength", "createdByActorId"
) VALUES (
  'artifact-enclosure', 'p0-synthetic-direct', 'p0-synthetic-direct',
  'artifact-series-enclosure', 1, 'ENCLOSURE', 'rv-v2', 'case-1',
  'packet-1', 'recipient-1', 'address-1', 'baseline-1', 'policy-v1', 1,
  'FACTUAL_ACCURACY', 'synthetic-provider', decode('21','hex'), decode('22','hex'),
  decode('23','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
  repeat('8',64), 'application/octet-stream', 64, 'synthetic-actor'
);

INSERT INTO "PacketEnclosure" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "recipientId", "recipientAddressVersionId", "identityBaselineId",
  "policyVersion", "round", "claimClass", "packetId", "artifactId",
  "artifactKind", "ordinal", "kind", "labelCode", "required"
) VALUES (
  'enclosure-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-1', 'recipient-1', 'address-1', 'baseline-1', 'policy-v1', 1,
  'FACTUAL_ACCURACY', 'packet-1', 'artifact-enclosure', 'ENCLOSURE', 0,
  'SUPPORTING_DOCUMENT', 'SYNTHETIC_SUPPORT', false
);

INSERT INTO "Artifact" (
  "id", "tenantId", "consumerId", "artifactSeriesKey", "version", "kind",
  "reportVersionId", "caseId", "packetId", "recipientId",
  "recipientAddressVersionId", "identityBaselineId", "policyVersion",
  "round", "claimClass", "storageProviderKey",
  "storageLocatorCiphertext", "storageLocatorIv", "storageLocatorAuthTag",
  "storageLocatorKeyVersion", "storageLocatorAlgorithm",
  "storageLocatorEnvelopeVersion", "storageLocatorAadVersion", "sha256",
  "mimeType", "byteLength", "createdByActorId"
) VALUES (
  'artifact-enclosure-2', 'p0-synthetic-direct', 'p0-synthetic-direct',
  'artifact-series-enclosure-2', 1, 'ENCLOSURE', 'rv-v2', 'case-1',
  'packet-1', 'recipient-1', 'address-1', 'baseline-1', 'policy-v1', 1,
  'FACTUAL_ACCURACY', 'synthetic-provider', decode('24','hex'),
  decode('25','hex'), decode('26','hex'), 'key-v1', 'AES_256_GCM',
  'env-v1', 'aad-v1', repeat('0',64), 'application/octet-stream', 64,
  'synthetic-actor'
);

SELECT pg_temp.expect_sqlstate(
  'packet enclosure rejects cross-recipient packet and artifact pins',
  $q$INSERT INTO "PacketEnclosure" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "policyVersion", "round", "claimClass", "packetId", "artifactId",
       "artifactKind", "ordinal", "kind", "labelCode", "required"
     ) VALUES (
       'enclosure-bad-recipient', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'rv-v2', 'case-1', 'recipient-2', 'address-2',
       'baseline-1', 'policy-v1', 1, 'FACTUAL_ACCURACY', 'packet-1',
       'artifact-enclosure-2', 'ENCLOSURE', 1, 'SUPPORTING_DOCUMENT',
       'BAD_RECIPIENT', false
     )$q$,
  '23503'
);

SELECT pg_temp.expect_sqlstate(
  'packet enclosure rejects canonical packet artifact',
  $q$INSERT INTO "PacketEnclosure" (
       "id", "tenantId", "consumerId", "reportVersionId", "caseId",
       "recipientId", "recipientAddressVersionId", "identityBaselineId",
       "policyVersion", "round", "claimClass", "packetId", "artifactId",
       "artifactKind", "ordinal", "kind", "labelCode", "required"
     ) VALUES (
       'enclosure-bad-kind', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'rv-v2', 'case-1', 'recipient-1', 'address-1',
       'baseline-1', 'policy-v1', 1, 'FACTUAL_ACCURACY', 'packet-1',
       'artifact-canonical', 'CANONICAL_PACKET_PDF', 1,
       'SUPPORTING_DOCUMENT', 'BAD_KIND', false
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'artifact locator envelope requires nonempty metadata',
  $q$INSERT INTO "Artifact" (
       "id", "tenantId", "consumerId", "artifactSeriesKey", "version",
       "kind", "storageProviderKey", "storageLocatorCiphertext",
       "storageLocatorIv", "storageLocatorAuthTag",
       "storageLocatorKeyVersion", "storageLocatorAlgorithm",
       "storageLocatorEnvelopeVersion", "storageLocatorAadVersion",
       "sha256", "mimeType", "byteLength", "createdByActorId"
     ) VALUES (
       'artifact-bad-envelope', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'artifact-series-bad-envelope', 1, 'OTHER',
       'synthetic-provider', decode('31','hex'), decode('32','hex'),
       decode('33','hex'), 'key-v1', 'AES_256_GCM', '', 'aad-v1',
       repeat('9',64), 'application/octet-stream', 1, 'synthetic-actor'
     )$q$,
  '23514'
);

INSERT INTO "EvidenceEvent" (
  "id", "tenantId", "consumerId", "caseId", "eventKey", "eventType",
  "eventVersion", "subjectType", "subjectId", "actorId", "correlationId",
  "occurredAt"
) VALUES (
  'event-1', 'p0-synthetic-direct', 'p0-synthetic-direct', 'case-1',
  'event-key-1', 'PACKET_CREATED', 1, 'PACKET', 'packet-1',
  'synthetic-actor', 'correlation-1', now()
);

-- Fully persisted, synthetic temporal-progress chain. This graph uses dedicated
-- runs so the completed comparison cannot seal or perturb the race fixtures.
INSERT INTO "ReportVersion" (
  "id", "tenantId", "consumerId", "reportSeriesKey", "version", "origin",
  "authorityStatus", "schemaVersion", "inputSha256",
  "reportDateProvenance", "reportDate", "reportDateSourceLocator",
  "reportDateRuleKey", "reportDateRuleVersion", "createdByActorId"
) VALUES (
  'rv-progress-current', 'p0-synthetic-direct', 'p0-synthetic-direct',
  'v2-series', 2, 'SYNTHETIC_TEST', 'SHADOW_V2', 'truth-v2', repeat('3',64),
  'SOURCE_REPORTED', DATE '2026-02-15', 'synthetic-report-date-current',
  'synthetic-date-rule', 'v1', 'synthetic-actor'
);

INSERT INTO "Account" (
  "id", "tenantId", "consumerId", "stableKey", "authorityStatus"
) VALUES
  (
    'acct-progress-field', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'progress-field-account', 'SHADOW_V2'
  ),
  (
    'acct-progress-account', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'progress-presence-account', 'SHADOW_V2'
  );

INSERT INTO "ReportVersionAccount" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
) VALUES
  (
    'rva-progress-prior-field', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'acct-progress-field', 5, 'SOURCE_LISTED', 'SHADOW_V2'
  ),
  (
    'rva-progress-prior-account', 'p0-synthetic-direct',
    'p0-synthetic-direct', 'rv-v2', 'acct-progress-account', 6,
    'SOURCE_LISTED', 'SHADOW_V2'
  );

INSERT INTO "ReportVersionAccount" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
) VALUES
  (
    'rva-progress-current-field', 'p0-synthetic-direct',
    'p0-synthetic-direct', 'rv-progress-current', 'acct-progress-field', 0,
    'SOURCE_LISTED', 'SHADOW_V2'
  ),
  (
    'rva-progress-current-account', 'p0-synthetic-direct',
    'p0-synthetic-direct', 'rv-progress-current', 'acct-progress-account',
    NULL, 'COMPARISON_CARRY_FORWARD', 'SHADOW_V2'
  );

INSERT INTO "ExtractionRun" (
  "id", "tenantId", "consumerId", "reportVersionId", "runKey",
  "attempt", "engine", "engineVersion", "schemaVersion",
  "normalizationVersion", "status", "startedAt", "completedAt"
) VALUES
  (
    'run-progress-prior', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-v2', 'progress-prior-run', 1, 'HYBRID_V2', 'v2', 'v2', 'v2',
    'SUCCEEDED', TIMESTAMP '2026-01-15 12:00:00',
    TIMESTAMP '2026-01-15 12:01:00'
  ),
  (
    'run-progress-current', 'p0-synthetic-direct', 'p0-synthetic-direct',
    'rv-progress-current', 'progress-current-run', 1, 'HYBRID_V2', 'v2',
    'v2', 'v2', 'SUCCEEDED', TIMESTAMP '2026-02-15 12:00:00',
    TIMESTAMP '2026-02-15 12:01:00'
  );

INSERT INTO "ExtractionBureauCoverage" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus"
) VALUES
  ('cov-progress-prior-eq', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-progress-prior', 'EQUIFAX', 'COVERED'),
  ('cov-progress-prior-ex', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-progress-prior', 'EXPERIAN', 'OUTSIDE_COVERAGE'),
  ('cov-progress-prior-tu', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-progress-prior', 'TRANSUNION', 'OUTSIDE_COVERAGE'),
  ('cov-progress-current-eq', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'run-progress-current', 'EQUIFAX', 'COVERED'),
  ('cov-progress-current-ex', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'run-progress-current', 'EXPERIAN', 'OUTSIDE_COVERAGE'),
  ('cov-progress-current-tu', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'run-progress-current', 'TRANSUNION', 'OUTSIDE_COVERAGE');

INSERT INTO "SectionCompleteness" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
  "reportSection", "status", "requiredFieldKeys", "observedFieldKeys",
  "normalizationRuleKey", "normalizationRuleVersion"
) VALUES
  ('sc-progress-prior-field-index', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-field', 'run-progress-prior', 'EQUIFAX', 'cov-progress-prior-eq', 'COVERED', 'ACCOUNT_INDEX', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], 'synthetic-rule', 'v1'),
  ('sc-progress-prior-field-summary', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-field', 'run-progress-prior', 'EQUIFAX', 'cov-progress-prior-eq', 'COVERED', 'ACCOUNT_SUMMARY', 'COMPLETE', ARRAY['summaryStatus']::text[], ARRAY['summaryStatus']::text[], 'synthetic-rule', 'v1'),
  ('sc-progress-prior-account-index', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-account', 'run-progress-prior', 'EQUIFAX', 'cov-progress-prior-eq', 'COVERED', 'ACCOUNT_INDEX', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], 'synthetic-rule', 'v1'),
  ('sc-progress-prior-account-summary', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-account', 'run-progress-prior', 'EQUIFAX', 'cov-progress-prior-eq', 'COVERED', 'ACCOUNT_SUMMARY', 'COMPLETE', ARRAY['summaryStatus']::text[], ARRAY['summaryStatus']::text[], 'synthetic-rule', 'v1'),
  ('sc-progress-current-field-index', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'acct-progress-field', 'run-progress-current', 'EQUIFAX', 'cov-progress-current-eq', 'COVERED', 'ACCOUNT_INDEX', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], 'synthetic-rule', 'v1'),
  ('sc-progress-current-field-summary', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'acct-progress-field', 'run-progress-current', 'EQUIFAX', 'cov-progress-current-eq', 'COVERED', 'ACCOUNT_SUMMARY', 'COMPLETE', ARRAY['summaryStatus']::text[], ARRAY['summaryStatus']::text[], 'synthetic-rule', 'v1'),
  ('sc-progress-current-account-index', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'acct-progress-account', 'run-progress-current', 'EQUIFAX', 'cov-progress-current-eq', 'COVERED', 'ACCOUNT_INDEX', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], 'synthetic-rule', 'v1');

INSERT INTO "AccountPresenceObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
  "presence", "observationSeriesKey", "revision", "integritySha256",
  "sourceLocatorToken", "accountIndexStatus", "accountIndexCompletenessId"
) VALUES
  ('apo-progress-prior-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-field', 'run-progress-prior', 'EQUIFAX', 'cov-progress-prior-eq', 'COVERED', 'PRESENT', 'apo-progress-prior-field-series', 1, repeat('1',64), 'loc-progress-prior-field', 'COMPLETE', 'sc-progress-prior-field-index'),
  ('apo-progress-current-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'acct-progress-field', 'run-progress-current', 'EQUIFAX', 'cov-progress-current-eq', 'COVERED', 'PRESENT', 'apo-progress-current-field-series', 1, repeat('2',64), 'loc-progress-current-field', 'COMPLETE', 'sc-progress-current-field-index'),
  ('apo-progress-prior-account', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-account', 'run-progress-prior', 'EQUIFAX', 'cov-progress-prior-eq', 'COVERED', 'PRESENT', 'apo-progress-prior-account-series', 1, repeat('3',64), 'loc-progress-prior-account', 'COMPLETE', 'sc-progress-prior-account-index'),
  ('apo-progress-current-account', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'acct-progress-account', 'run-progress-current', 'EQUIFAX', 'cov-progress-current-eq', 'COVERED', 'ABSENT_CONFIRMED', 'apo-progress-current-account-series', 1, repeat('4',64), 'loc-progress-current-account-absence', 'COMPLETE', 'sc-progress-current-account-index');

INSERT INTO "FieldObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureauCoverageId", "coverageStatus",
  "observationSeriesKey", "revision", "integritySha256", "bureau",
  "reportSection", "sectionStatus", "sectionCompletenessId", "fieldKey",
  "presence", "valueType", "valueCiphertext", "valueIv", "valueAuthTag",
  "valueKeyVersion", "valueAlgorithm", "valueEnvelopeVersion",
  "valueAadVersion", "sourceLocatorToken", "normalizationRuleKey",
  "normalizationRuleVersion"
) VALUES
  ('fo-progress-prior-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-field', 'run-progress-prior', 'cov-progress-prior-eq', 'COVERED', 'fo-progress-prior-field-series', 1, repeat('5',64), 'EQUIFAX', 'ACCOUNT_SUMMARY', 'COMPLETE', 'sc-progress-prior-field-summary', 'summaryStatus', 'PRESENT', 'ENUM_CODE', decode('41','hex'), decode('42','hex'), decode('43','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1', 'loc-progress-prior-field', 'synthetic-rule', 'v1'),
  ('fo-progress-current-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'acct-progress-field', 'run-progress-current', 'cov-progress-current-eq', 'COVERED', 'fo-progress-current-field-series', 1, repeat('6',64), 'EQUIFAX', 'ACCOUNT_SUMMARY', 'COMPLETE', 'sc-progress-current-field-summary', 'summaryStatus', 'ABSENT_CONFIRMED', 'ENUM_CODE', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'loc-progress-current-field-absence', 'synthetic-rule', 'v1'),
  ('fo-progress-prior-account', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-account', 'run-progress-prior', 'cov-progress-prior-eq', 'COVERED', 'fo-progress-prior-account-series', 1, repeat('7',64), 'EQUIFAX', 'ACCOUNT_SUMMARY', 'COMPLETE', 'sc-progress-prior-account-summary', 'summaryStatus', 'PRESENT', 'ENUM_CODE', decode('51','hex'), decode('52','hex'), decode('53','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1', 'loc-progress-prior-account', 'synthetic-rule', 'v1');

INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType",
  "evidenceRole", "presence", "evidenceCompleteness",
  "observationSeriesKey", "revision", "occurrence", "idempotencyKey",
  "integritySha256", "scoreCiphertext", "scoreIv", "scoreAuthTag",
  "scoreKeyVersion", "scoreAlgorithm", "scoreEnvelopeVersion",
  "scoreAadVersion", "scoreModelKey", "scoreModelVersion",
  "scoreScaleMin", "scoreScaleMax", "modelMetadataCompleteness",
  "sourceMethodKey", "sourceMethodVersion", "sourceLocatorToken",
  "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
) VALUES
  ('score-progress-prior', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-progress-prior', 'EQUIFAX', 'COVERED', 'cov-progress-prior-eq', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE', 'SCORE_REPORTED', 'COMPLETE', 'score-progress-prior-series', 1, 0, 'score-progress-prior-key', repeat('8',64), decode('61','hex'), decode('62','hex'), decode('63','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1', 'synthetic-score-model', 'v1', 300, 850, 'COMPLETE', 'synthetic-score-extractor', 'v1', 'loc-score-progress-prior', 'synthetic-score-rule', 'v1', TIMESTAMP '2026-01-15 12:00:00'),
  ('score-progress-current', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-progress-current', 'run-progress-current', 'EQUIFAX', 'COVERED', 'cov-progress-current-eq', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE', 'SCORE_REPORTED', 'COMPLETE', 'score-progress-current-series', 1, 0, 'score-progress-current-key', repeat('9',64), decode('71','hex'), decode('72','hex'), decode('73','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1', 'synthetic-score-model', 'v1', 300, 850, 'COMPLETE', 'synthetic-score-extractor', 'v1', 'loc-score-progress-current', 'synthetic-score-rule', 'v1', TIMESTAMP '2026-02-15 12:00:00');

INSERT INTO "DerivedAccountAssessment" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "assessmentVersion", "classifierVersion",
  "policyVersion", "inputSetSha256", "evidenceCompleteness",
  "accountCondition", "disputeGrounds", "reportedAdversity"
) VALUES
  ('assessment-progress-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-field', 'run-progress-prior', 1, 'classifier-progress-v1', 'policy-v1', repeat('a',64), 'COMPLETE', 'NEEDS_REVIEW', 'CONSUMER_REVIEW_REQUIRED', 'UNKNOWN'),
  ('assessment-progress-account', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-account', 'run-progress-prior', 1, 'classifier-progress-v1', 'policy-v1', repeat('b',64), 'COMPLETE', 'NEEDS_REVIEW', 'CONSUMER_REVIEW_REQUIRED', 'UNKNOWN');

INSERT INTO "ConsumerAssertion" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureau", "fieldKey", "observationId",
  "observationSeriesKey", "observationRevision",
  "observationIntegritySha256", "assessmentId", "assertionSeriesKey",
  "version", "disposition", "confirmedByActorId", "confirmedAt"
) VALUES
  ('assert-progress-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-field', 'run-progress-prior', 'EQUIFAX', 'summaryStatus', 'fo-progress-prior-field', 'fo-progress-prior-field-series', 1, repeat('5',64), 'assessment-progress-field', 'assert-progress-field-series', 1, 'CONFIRMED_INACCURATE', 'synthetic-reviewer', TIMESTAMP '2026-01-16 12:00:00'),
  ('assert-progress-account', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'acct-progress-account', 'run-progress-prior', 'EQUIFAX', 'summaryStatus', 'fo-progress-prior-account', 'fo-progress-prior-account-series', 1, repeat('7',64), 'assessment-progress-account', 'assert-progress-account-series', 1, 'CONFIRMED_INACCURATE', 'synthetic-reviewer', TIMESTAMP '2026-01-16 12:00:00');

INSERT INTO "DisputeCase" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseKey",
  "status", "policyVersion", "createdByActorId", "updatedAt"
) VALUES (
  'case-progress', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-progress-key', 'ACTIVE', 'policy-v1', 'synthetic-actor',
  TIMESTAMP '2026-01-16 12:00:00'
);

INSERT INTO "Correspondence" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "recipientId", "recipientAddressVersionId", "identityBaselineId",
  "strategyKey", "claimClass", "policyVersion", "round", "status",
  "idempotencyKey", "parentLineageRef", "createdByActorId", "updatedAt"
) VALUES (
  'corr-progress', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-progress', 'recipient-1', 'address-1', 'baseline-1',
  'synthetic-progress-strategy', 'FACTUAL_ACCURACY', 'policy-v1', 1,
  'APPROVED', 'corr-progress-key', 'ROOT', 'synthetic-actor',
  TIMESTAMP '2026-01-16 12:00:00'
);

INSERT INTO "CorrespondenceItem" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "correspondenceId", "accountId", "extractionRunId", "bureau",
  "fieldKey", "observationId", "observationSeriesKey",
  "observationRevision", "observationIntegritySha256", "assessmentId",
  "consumerAssertionId", "itemKey", "ordinal", "claimType"
) VALUES
  ('item-progress-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'case-progress', 'corr-progress', 'acct-progress-field', 'run-progress-prior', 'EQUIFAX', 'summaryStatus', 'fo-progress-prior-field', 'fo-progress-prior-field-series', 1, repeat('5',64), 'assessment-progress-field', 'assert-progress-field', 'item-progress-field-key', 0, 'FACTUAL_ACCURACY'),
  ('item-progress-account', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'case-progress', 'corr-progress', 'acct-progress-account', 'run-progress-prior', 'EQUIFAX', 'summaryStatus', 'fo-progress-prior-account', 'fo-progress-prior-account-series', 1, repeat('7',64), 'assessment-progress-account', 'assert-progress-account', 'item-progress-account-key', 1, 'FACTUAL_ACCURACY');

INSERT INTO "CorrespondenceVersion" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "correspondenceId", "version", "status", "strategyKey", "claimClass",
  "policyVersion", "round", "parentLineageRef", "templateVersion",
  "recipientId", "recipientAddressVersionId", "identityBaselineId",
  "bodyCiphertext", "bodyIv", "bodyAuthTag", "bodyKeyVersion",
  "bodyAlgorithm", "bodyEnvelopeVersion", "bodyAadVersion", "bodySha256",
  "itemSetSha256", "itemCount", "approvedByActorId", "approvedAt",
  "createdByActorId"
) VALUES (
  'cv-progress', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
  'case-progress', 'corr-progress', 1, 'APPROVED',
  'synthetic-progress-strategy', 'FACTUAL_ACCURACY', 'policy-v1', 1,
  'ROOT', 'template-v1', 'recipient-1', 'address-1', 'baseline-1',
  decode('81','hex'), decode('82','hex'), decode('83','hex'), 'key-v1',
  'AES_256_GCM', 'env-v1', 'aad-v1', repeat('c',64), repeat('d',64), 2,
  'synthetic-approver', TIMESTAMP '2026-01-16 12:00:00',
  'synthetic-actor'
);

INSERT INTO "CorrespondenceVersionItem" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "correspondenceId", "correspondenceVersionId", "correspondenceItemId",
  "ordinal"
) VALUES
  ('cvi-progress-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'case-progress', 'corr-progress', 'cv-progress', 'item-progress-field', 0),
  ('cvi-progress-account', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'case-progress', 'corr-progress', 'cv-progress', 'item-progress-account', 1);

INSERT INTO "ReportComparison" (
  "id", "tenantId", "consumerId", "priorReportVersionId",
  "priorExtractionRunId", "currentReportVersionId",
  "currentExtractionRunId", "comparisonSeriesKey", "version",
  "idempotencyKey", "state", "evidenceCompleteness", "sourcePolicy",
  "purpose", "chronologyBasis", "chronologyRuleKey",
  "chronologyRuleVersion", "comparisonModelKey", "comparisonModelVersion",
  "sourceSetSha256", "integritySha256", "differenceCount",
  "createdByActorId"
) VALUES (
  'comparison-progress', 'p0-synthetic-direct', 'p0-synthetic-direct',
  'rv-v2', 'run-progress-prior', 'rv-progress-current',
  'run-progress-current', 'comparison-progress-series', 1,
  'comparison-progress-key', 'COMPARABLE', 'COMPLETE',
  'REPORT_DERIVED_ONLY', 'TEMPORAL_REPORT_CHANGE',
  'SAME_SERIES_VERSION_ORDER', 'synthetic-chronology-rule', 'v1',
  'synthetic-comparison-model', 'v1', repeat('e',64), repeat('f',64), 3,
  'synthetic-actor'
);

INSERT INTO "ReportDifference" (
  "id", "tenantId", "consumerId", "priorReportVersionId",
  "priorExtractionRunId", "currentReportVersionId",
  "currentExtractionRunId", "comparisonId", "scopeType", "bureau",
  "accountId", "fieldKey", "scoreOccurrence",
  "priorScoreSourceMethodKey", "priorScoreSourceMethodVersion",
  "currentScoreSourceMethodKey", "currentScoreSourceMethodVersion",
  "priorPresenceObservationId", "currentPresenceObservationId",
  "priorFieldObservationId", "currentFieldObservationId",
  "priorScoreObservationId", "currentScoreObservationId",
  "priorCompleteness", "currentCompleteness", "comparability",
  "differenceState", "changeKind", "deletionState",
  "differenceSeriesKey", "version", "idempotencyKey",
  "comparisonRuleKey", "comparisonRuleVersion", "sourceSetSha256",
  "integritySha256", "createdByActorId"
) VALUES
  ('difference-progress-account', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-progress-prior', 'rv-progress-current', 'run-progress-current', 'comparison-progress', 'ACCOUNT_PRESENCE', 'EQUIFAX', 'acct-progress-account', NULL, NULL, NULL, NULL, NULL, NULL, 'apo-progress-prior-account', 'apo-progress-current-account', NULL, NULL, NULL, NULL, 'COMPLETE', 'COMPLETE', 'COMPARABLE', 'CHANGED', 'NO_LONGER_REPORTED', 'ABSENT_CONFIRMED_ON_CURRENT_REPORT', 'difference-progress-account-series', 1, 'difference-progress-account-key', 'synthetic-difference-rule', 'v1', repeat('1',64), repeat('2',64), 'synthetic-actor'),
  ('difference-progress-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-progress-prior', 'rv-progress-current', 'run-progress-current', 'comparison-progress', 'FIELD_VALUE', 'EQUIFAX', 'acct-progress-field', 'summaryStatus', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'fo-progress-prior-field', 'fo-progress-current-field', NULL, NULL, 'COMPLETE', 'COMPLETE', 'COMPARABLE', 'CHANGED', 'STATUS_CHANGED', 'NOT_APPLICABLE', 'difference-progress-field-series', 1, 'difference-progress-field-key', 'synthetic-difference-rule', 'v1', repeat('3',64), repeat('4',64), 'synthetic-actor'),
  ('difference-progress-score', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-progress-prior', 'rv-progress-current', 'run-progress-current', 'comparison-progress', 'CREDIT_SCORE', 'EQUIFAX', NULL, NULL, 0, 'synthetic-score-extractor', 'v1', 'synthetic-score-extractor', 'v1', NULL, NULL, NULL, NULL, 'score-progress-prior', 'score-progress-current', 'COMPLETE', 'COMPLETE', 'COMPARABLE', 'CHANGED', 'SCORE_CHANGED', 'NOT_APPLICABLE', 'difference-progress-score-series', 1, 'difference-progress-score-key', 'synthetic-difference-rule', 'v1', repeat('5',64), repeat('6',64), 'synthetic-actor');

INSERT INTO "DisputeOutcome" (
  "id", "tenantId", "consumerId", "priorReportVersionId",
  "priorExtractionRunId", "currentReportVersionId",
  "currentExtractionRunId", "caseId", "comparisonId", "differenceId",
  "bureau", "accountId", "targetFieldKey", "targetConsumerAssertionId",
  "targetCorrespondenceId", "targetCorrespondenceItemId",
  "targetCorrespondenceVersionId", "targetVersionMembershipId",
  "priorCompleteness", "currentCompleteness", "outcomeState",
  "causalityState", "decisionSource", "outcomeSeriesKey", "version",
  "idempotencyKey", "decisionModelKey", "decisionModelVersion",
  "sourceSetSha256", "integritySha256", "decidedByActorId", "decidedAt"
) VALUES
  ('outcome-progress-account', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-progress-prior', 'rv-progress-current', 'run-progress-current', 'case-progress', 'comparison-progress', 'difference-progress-account', 'EQUIFAX', 'acct-progress-account', 'summaryStatus', 'assert-progress-account', 'corr-progress', 'item-progress-account', 'cv-progress', 'cvi-progress-account', 'COMPLETE', 'COMPLETE', 'NO_LONGER_REPORTED', 'TEMPORAL_ASSOCIATION_ONLY', 'SYSTEM_DERIVED', 'outcome-progress-account-series', 1, 'outcome-progress-account-key', 'synthetic-outcome-model', 'v1', repeat('7',64), repeat('8',64), NULL, TIMESTAMP '2026-02-16 12:00:00'),
  ('outcome-progress-field', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-progress-prior', 'rv-progress-current', 'run-progress-current', 'case-progress', 'comparison-progress', 'difference-progress-field', 'EQUIFAX', 'acct-progress-field', 'summaryStatus', 'assert-progress-field', 'corr-progress', 'item-progress-field', 'cv-progress', 'cvi-progress-field', 'COMPLETE', 'COMPLETE', 'CORRECTED', 'NO_CAUSAL_CLAIM', 'HUMAN_CONFIRMED', 'outcome-progress-field-series', 1, 'outcome-progress-field-key', 'synthetic-outcome-model', 'v1', repeat('9',64), repeat('a',64), 'synthetic-reviewer', TIMESTAMP '2026-02-16 12:00:00');

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "CreditScoreObservation" WHERE "id" IN ('score-progress-prior', 'score-progress-current')) <> 2
    OR (SELECT COUNT(*) FROM "ReportComparison" WHERE "id" = 'comparison-progress' AND "state" = 'COMPARABLE' AND "differenceCount" = 3) <> 1
    OR (SELECT COUNT(*) FROM "ReportDifference" WHERE "comparisonId" = 'comparison-progress') <> 3
    OR (SELECT COUNT(*) FROM "DisputeOutcome" WHERE "comparisonId" = 'comparison-progress') <> 2
  THEN
    RAISE EXCEPTION 'P0_PROGRESS_CHAIN_FAIL exact persisted row counts';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "ReportDifference" rd
    JOIN "CreditScoreObservation" prior_score
      ON prior_score."id" = rd."priorScoreObservationId"
    JOIN "CreditScoreObservation" current_score
      ON current_score."id" = rd."currentScoreObservationId"
    WHERE rd."id" = 'difference-progress-score'
      AND rd."changeKind" = 'SCORE_CHANGED'
      AND rd."comparability" = 'COMPARABLE'
      AND rd."scoreOccurrence" = 0
      AND prior_score."sourceMethodKey" = current_score."sourceMethodKey"
      AND prior_score."sourceMethodVersion" = current_score."sourceMethodVersion"
      AND prior_score."occurrence" = current_score."occurrence"
  ) THEN
    RAISE EXCEPTION 'P0_PROGRESS_CHAIN_FAIL exact score pins';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "ReportDifference" rd
    JOIN "AccountPresenceObservation" prior_presence
      ON prior_presence."id" = rd."priorPresenceObservationId"
    JOIN "AccountPresenceObservation" current_presence
      ON current_presence."id" = rd."currentPresenceObservationId"
    WHERE rd."id" = 'difference-progress-account'
      AND prior_presence."presence" = 'PRESENT'
      AND current_presence."presence" = 'ABSENT_CONFIRMED'
      AND rd."changeKind" = 'NO_LONGER_REPORTED'
      AND rd."deletionState" = 'ABSENT_CONFIRMED_ON_CURRENT_REPORT'
  ) THEN
    RAISE EXCEPTION 'P0_PROGRESS_CHAIN_FAIL exact account-presence pins';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "ReportDifference" rd
    JOIN "FieldObservation" prior_field
      ON prior_field."id" = rd."priorFieldObservationId"
    JOIN "FieldObservation" current_field
      ON current_field."id" = rd."currentFieldObservationId"
    WHERE rd."id" = 'difference-progress-field'
      AND prior_field."presence" = 'PRESENT'
      AND current_field."presence" = 'ABSENT_CONFIRMED'
      AND rd."changeKind" = 'STATUS_CHANGED'
      AND rd."deletionState" = 'NOT_APPLICABLE'
  ) THEN
    RAISE EXCEPTION 'P0_PROGRESS_CHAIN_FAIL exact field-presence pins';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "DisputeOutcome" outcome
    JOIN "CorrespondenceVersionItem" membership
      ON membership."id" = outcome."targetVersionMembershipId"
    JOIN "CorrespondenceVersion" version
      ON version."id" = membership."correspondenceVersionId"
    WHERE outcome."id" = 'outcome-progress-account'
      AND outcome."decisionSource" = 'SYSTEM_DERIVED'
      AND outcome."outcomeState" = 'NO_LONGER_REPORTED'
      AND version."status" = 'APPROVED'
      AND membership."correspondenceItemId" = outcome."targetCorrespondenceItemId"
  ) OR NOT EXISTS (
    SELECT 1
    FROM "DisputeOutcome" outcome
    JOIN "CorrespondenceVersionItem" membership
      ON membership."id" = outcome."targetVersionMembershipId"
    JOIN "CorrespondenceVersion" version
      ON version."id" = membership."correspondenceVersionId"
    WHERE outcome."id" = 'outcome-progress-field'
      AND outcome."decisionSource" = 'HUMAN_CONFIRMED'
      AND outcome."outcomeState" = 'CORRECTED'
      AND outcome."decidedByActorId" = 'synthetic-reviewer'
      AND version."status" = 'APPROVED'
      AND membership."correspondenceItemId" = outcome."targetCorrespondenceItemId"
  ) THEN
    RAISE EXCEPTION 'P0_PROGRESS_CHAIN_FAIL exact approved outcome pins';
  END IF;

  RAISE NOTICE 'P0_PROGRESS_CHAIN_ASSERT_PASS exact rows and pins';
END;
$$;

SELECT pg_temp.expect_sqlstate(
  'manual credit score cannot masquerade as primary report evidence',
  $q$INSERT INTO "CreditScoreObservation" (
       "id", "tenantId", "consumerId", "bureau", "sourceType",
       "evidenceRole", "presence", "evidenceCompleteness",
       "observationSeriesKey", "revision", "idempotencyKey",
       "integritySha256", "scoreCiphertext", "scoreIv", "scoreAuthTag",
       "scoreKeyVersion", "scoreAlgorithm", "scoreEnvelopeVersion",
       "scoreAadVersion", "modelMetadataCompleteness", "sourceMethodKey",
       "sourceMethodVersion", "enteredByActorId", "enteredAt", "observedAt"
     ) VALUES (
       'score-bad-role', 'p0-synthetic-direct', 'p0-synthetic-direct',
       'EQUIFAX', 'MANUAL_ENTRY', 'PRIMARY_REPORT_EVIDENCE',
       'SCORE_REPORTED', 'MANUAL_UNVERIFIED', 'score-bad-role-series', 1,
       'score-bad-role-key', repeat('1',64), decode('01','hex'),
       decode('02','hex'), decode('03','hex'), 'key-v1', 'AES_256_GCM',
       'env-v1', 'aad-v1', 'UNKNOWN', 'manual-entry', 'v1',
       'synthetic-actor', now(), now()
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'comparison rejects duplicate exact extraction run pair',
  $q$INSERT INTO "ReportComparison" (
       "id", "tenantId", "consumerId", "priorReportVersionId",
       "priorExtractionRunId", "currentReportVersionId",
       "currentExtractionRunId", "comparisonSeriesKey", "version",
       "idempotencyKey", "state", "evidenceCompleteness", "sourcePolicy",
       "purpose", "chronologyBasis", "chronologyRuleKey",
       "chronologyRuleVersion", "comparisonModelKey",
       "comparisonModelVersion", "sourceSetSha256", "integritySha256",
       "differenceCount", "createdByActorId"
     ) VALUES (
       'comparison-duplicate-run', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'rv-v2', 'run-clean', 'rv-v2', 'run-clean',
       'comparison-duplicate-run-series', 1, 'comparison-duplicate-run-key',
       'PENDING_EVIDENCE', 'UNKNOWN', 'REPORT_DERIVED_ONLY',
       'EXTRACTION_RECONCILIATION', 'NOT_ESTABLISHED', 'chronology-v1',
       'v1', 'comparison-v1', 'v1', repeat('2',64), repeat('3',64), 0,
       'synthetic-actor'
     )$q$,
  '23503'
);

SELECT pg_temp.expect_sqlstate(
  'difference rejects nonexistent exact comparison chain',
  $q$INSERT INTO "ReportDifference" (
       "id", "tenantId", "consumerId", "priorReportVersionId",
       "priorExtractionRunId", "currentReportVersionId",
       "currentExtractionRunId", "comparisonId", "scopeType", "bureau",
       "priorCoverageObservationId", "currentCoverageObservationId",
       "priorCompleteness", "currentCompleteness", "comparability",
       "differenceState", "changeKind", "deletionState",
       "differenceSeriesKey", "version", "idempotencyKey",
       "comparisonRuleKey", "comparisonRuleVersion", "sourceSetSha256",
       "integritySha256", "createdByActorId"
     ) VALUES (
       'difference-missing-comparison', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'rv-v2', 'run-clean', 'rv-v2', 'run-neutral',
       'comparison-does-not-exist', 'BUREAU_COVERAGE', 'EQUIFAX',
       'cov-clean-eq', 'cov-neutral-eq', 'COMPLETE', 'COMPLETE',
       'COMPARABLE', 'UNCHANGED', 'UNCHANGED', 'NOT_APPLICABLE',
       'difference-missing-comparison-series', 1,
       'difference-missing-comparison-key', 'comparison-rule-v1', 'v1',
       repeat('4',64), repeat('5',64), 'synthetic-actor'
     )$q$,
  '23503'
);

SELECT pg_temp.expect_sqlstate(
  'outcome rejects nonexistent temporal comparison chain',
  $q$INSERT INTO "DisputeOutcome" (
       "id", "tenantId", "consumerId", "priorReportVersionId",
       "priorExtractionRunId", "currentReportVersionId",
       "currentExtractionRunId", "caseId", "comparisonId", "differenceId",
       "bureau", "accountId", "targetFieldKey",
       "targetConsumerAssertionId", "targetCorrespondenceId",
       "targetCorrespondenceItemId", "targetCorrespondenceVersionId",
       "targetVersionMembershipId", "priorCompleteness",
       "currentCompleteness", "outcomeState", "causalityState",
       "outcomeSeriesKey", "version", "idempotencyKey", "decisionModelKey",
       "decisionModelVersion", "sourceSetSha256", "integritySha256"
     ) VALUES (
       'outcome-missing-comparison', 'p0-synthetic-direct',
       'p0-synthetic-direct', 'rv-v2', 'run-clean', 'rv-v2', 'run-neutral',
       'case-1', 'comparison-does-not-exist', 'difference-does-not-exist',
       'EQUIFAX', 'acct-clean', 'summaryStatus', 'assert-clean', 'corr-1',
       'item-1', 'cv-1', 'cvi-1', 'COMPLETE', 'COMPLETE',
       'PENDING_EVIDENCE', 'NO_CAUSAL_CLAIM', 'outcome-missing-series', 1,
       'outcome-missing-key', 'outcome-model-v1', 'v1', repeat('6',64),
       repeat('7',64)
     )$q$,
  '23514'
);

SELECT pg_temp.expect_sqlstate(
  'append-only update rejected',
  $q$UPDATE "FieldObservation" SET "sourceLocatorToken" = 'mutated'
     WHERE "id" = 'fo-clean-equifax-summaryStatus'$q$,
  '55000'
);

SELECT pg_temp.expect_sqlstate(
  'append-only delete rejected',
  $q$DELETE FROM "FieldObservation"
     WHERE "id" = 'fo-clean-equifax-summaryStatus'$q$,
  '55000'
);

SELECT pg_temp.expect_sqlstate(
  'append-only truncate rejected',
  $q$TRUNCATE TABLE "EvidenceEvent"$q$,
  '55000'
);

COMMIT;

-- Deferred aggregate seals are exercised in isolated subtransactions so every
-- rejected probe rolls back without weakening the positive graph above.
DO $$
BEGIN
  BEGIN
    INSERT INTO "CorrespondenceVersionItem" (
      "id", "tenantId", "consumerId", "reportVersionId", "caseId",
      "correspondenceId", "correspondenceVersionId", "correspondenceItemId",
      "ordinal"
    ) VALUES (
      'cvi-post-seal', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
      'case-1', 'corr-1', 'cv-1', 'item-2', 1
    );
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'P0_ASSERT_FAIL approved correspondence accepted a post-seal child';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'P0_ASSERT_PASS approved correspondence rejects post-seal child [23514]';
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO "PacketCorrespondenceVersion" (
      "id", "tenantId", "consumerId", "reportVersionId", "caseId",
      "recipientId", "recipientAddressVersionId", "identityBaselineId",
      "policyVersion", "round", "claimClass", "packetId",
      "correspondenceId", "correspondenceVersionId", "ordinal"
    ) VALUES (
      'pcv-post-seal', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
      'case-1', 'recipient-1', 'address-1', 'baseline-1', 'policy-v1', 1,
      'FACTUAL_ACCURACY', 'packet-1', 'corr-1', 'cv-2', 1
    );
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'P0_ASSERT_FAIL approved packet accepted a post-seal child';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'P0_ASSERT_PASS approved packet rejects post-seal child [23514]';
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO "CorrespondenceVersion" (
      "id", "tenantId", "consumerId", "reportVersionId", "caseId",
      "correspondenceId", "version", "status", "strategyKey", "claimClass",
      "policyVersion", "round", "parentLineageRef", "templateVersion",
      "recipientId", "recipientAddressVersionId", "identityBaselineId",
      "bodyCiphertext", "bodyIv", "bodyAuthTag", "bodyKeyVersion",
      "bodyAlgorithm", "bodyEnvelopeVersion", "bodyAadVersion", "bodySha256",
      "itemSetSha256", "itemCount", "supersedesVersionId",
      "approvedByActorId", "approvedAt", "createdByActorId"
    ) VALUES (
      'cv-count-mismatch', 'p0-synthetic-direct', 'p0-synthetic-direct',
      'rv-v2', 'case-1', 'corr-1', 4, 'APPROVED', 'synthetic-strategy',
      'FACTUAL_ACCURACY', 'policy-v1', 1, 'ROOT', 'template-v1',
      'recipient-1', 'address-1', 'baseline-1', decode('51','hex'),
      decode('52','hex'), decode('53','hex'), 'key-v1', 'AES_256_GCM',
      'env-v1', 'aad-v1', repeat('5',64), repeat('6',64), 1, 'cv-3',
      'synthetic-approver', now(), 'synthetic-actor'
    );
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'P0_ASSERT_FAIL approved correspondence count mismatch succeeded';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'P0_ASSERT_PASS approved correspondence count mismatch rejected [23514]';
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO "Packet" (
      "id", "tenantId", "consumerId", "reportVersionId", "caseId",
      "recipientId", "recipientAddressVersionId", "identityBaselineId",
      "packetSeriesKey", "version", "round", "claimClass", "policyVersion",
      "enclosureManifestSha256", "correspondenceVersionCount",
      "enclosureCount", "status", "approvedByActorId", "approvedAt",
      "createdByActorId"
    ) VALUES (
      'packet-count-mismatch', 'p0-synthetic-direct', 'p0-synthetic-direct',
      'rv-v2', 'case-1', 'recipient-1', 'address-1', 'baseline-1',
      'packet-series-1', 2, 1, 'FACTUAL_ACCURACY', 'policy-v1',
      repeat('7',64), 2, 0, 'APPROVED', 'synthetic-approver', now(),
      'synthetic-actor'
    );
    INSERT INTO "PacketCorrespondenceVersion" (
      "id", "tenantId", "consumerId", "reportVersionId", "caseId",
      "recipientId", "recipientAddressVersionId", "identityBaselineId",
      "policyVersion", "round", "claimClass", "packetId",
      "correspondenceId", "correspondenceVersionId", "ordinal"
    ) VALUES (
      'pcv-count-mismatch', 'p0-synthetic-direct', 'p0-synthetic-direct',
      'rv-v2', 'case-1', 'recipient-1', 'address-1', 'baseline-1',
      'policy-v1', 1, 'FACTUAL_ACCURACY', 'packet-count-mismatch',
      'corr-1', 'cv-1', 0
    );
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'P0_ASSERT_FAIL approved packet count mismatch succeeded';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'P0_ASSERT_PASS approved packet count mismatch rejected [23514]';
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO "Artifact" (
      "id", "tenantId", "consumerId", "artifactSeriesKey", "version", "kind",
      "reportVersionId", "caseId", "packetId", "primaryCorrespondenceId",
      "primaryCorrespondenceVersionId", "recipientId",
      "recipientAddressVersionId", "identityBaselineId", "storageProviderKey",
      "storageLocatorCiphertext", "storageLocatorIv", "storageLocatorAuthTag",
      "storageLocatorKeyVersion", "storageLocatorAlgorithm",
      "storageLocatorEnvelopeVersion", "storageLocatorAadVersion", "sha256",
      "mimeType", "byteLength", "pageCount", "rendererVersion",
      "templateVersion", "policyVersion", "round", "claimClass",
      "enclosureManifestSha256", "correspondenceVersionCount",
      "createdByActorId"
    ) VALUES (
      'artifact-count-mismatch', 'p0-synthetic-direct', 'p0-synthetic-direct',
      'artifact-series-count-mismatch', 1, 'CANONICAL_PACKET_PDF', 'rv-v2',
      'case-1', 'packet-1', 'corr-1', 'cv-1', 'recipient-1', 'address-1',
      'baseline-1', 'synthetic-provider', decode('61','hex'),
      decode('62','hex'), decode('63','hex'), 'key-v1', 'AES_256_GCM',
      'env-v1', 'aad-v1', repeat('8',64), 'application/pdf', 128, 1,
      'renderer-v1', 'template-v1', 'policy-v1', 1, 'FACTUAL_ACCURACY',
      repeat('5',64), 2, 'synthetic-actor'
    );
    INSERT INTO "ArtifactCorrespondenceVersion" (
      "id", "tenantId", "consumerId", "reportVersionId", "caseId",
      "recipientId", "recipientAddressVersionId", "identityBaselineId",
      "policyVersion", "round", "claimClass", "packetId", "artifactId",
      "correspondenceId", "correspondenceVersionId", "ordinal"
    ) VALUES (
      'acv-count-mismatch', 'p0-synthetic-direct', 'p0-synthetic-direct',
      'rv-v2', 'case-1', 'recipient-1', 'address-1', 'baseline-1',
      'policy-v1', 1, 'FACTUAL_ACCURACY', 'packet-1',
      'artifact-count-mismatch', 'corr-1', 'cv-1', 0
    );
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'P0_ASSERT_FAIL canonical artifact count mismatch succeeded';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'P0_ASSERT_PASS canonical artifact count mismatch rejected [23514]';
  END;
END;
$$;

-- Deferred all-bureau guard is forced before leaving a protected subtransaction.
DO $$
BEGIN
  BEGIN
    INSERT INTO "ExtractionRun" (
      "id", "tenantId", "consumerId", "reportVersionId", "runKey",
      "attempt", "engine", "engineVersion", "schemaVersion",
      "normalizationVersion", "status", "startedAt", "completedAt"
    ) VALUES (
      'run-missing-bureau', 'p0-synthetic-direct', 'p0-synthetic-direct',
      'rv-v2', 'missing-bureau-run', 1, 'AI_V2', 'v2', 'v2', 'v2',
      'SUCCEEDED', now(), now()
    );
    INSERT INTO "ExtractionBureauCoverage" (
      "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
      "bureau", "coverageStatus"
    ) VALUES
      ('cov-missing-eq', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-missing-bureau', 'EQUIFAX', 'COVERED'),
      ('cov-missing-ex', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2', 'run-missing-bureau', 'EXPERIAN', 'OUTSIDE_COVERAGE');
    SET CONSTRAINTS "ExtractionRun_complete_bureau_coverage_trg" IMMEDIATE;
    RAISE EXCEPTION 'P0_ASSERT_FAIL missing all-bureau coverage succeeded';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'P0_ASSERT_PASS missing all-bureau coverage [23514]';
  END;
END;
$$;

SELECT 'P0_POSITIVE_SUITE_PASS truth_and_correspondence';
SELECT 'P0_POSITIVE_SUITE_PASS packet_and_artifact';
SELECT 'P0_POSITIVE_SUITE_PASS persisted_progress_chain';
SQL

say "constraints: running synthetic positive and negative suites"
if ! psql_file "${primary_db}" "${fixture_sql}" >"${tmp_root}/constraints.log" 2>&1; then
  redact_log "${tmp_root}/constraints.log" >&2
  fail "disposable constraint suite failed"
fi
redact_log "${tmp_root}/constraints.log"

grep -q 'P0_PROGRESS_CHAIN_ASSERT_PASS exact rows and pins' \
  "${tmp_root}/constraints.log" \
  || fail "persisted progress-chain in-transaction assertions were not observed"
progress_chain_state="$(psql_query "${primary_db}" \
  "SELECT
     (SELECT COUNT(*) FROM \"CreditScoreObservation\"
      WHERE \"id\" IN ('score-progress-prior', 'score-progress-current'))::text || '|' ||
     (SELECT COUNT(*) FROM \"ReportComparison\"
      WHERE \"id\" = 'comparison-progress')::text || '|' ||
     (SELECT COUNT(*) FROM \"ReportDifference\"
      WHERE \"comparisonId\" = 'comparison-progress')::text || '|' ||
     (SELECT COUNT(*) FROM \"DisputeOutcome\"
      WHERE \"comparisonId\" = 'comparison-progress')::text || '|' ||
     (SELECT COUNT(*) FROM \"CorrespondenceVersionItem\"
      WHERE \"correspondenceVersionId\" = 'cv-progress')::text;")"
[[ "${progress_chain_state}" == "2|1|3|2|2" ]] \
  || fail "persisted progress-chain row counts changed after commit"
say "progress_chain: scores=2 comparisons=1 differences=3 outcomes=2 approved_memberships=2"

run_race_assessment_transaction() {
  local account_id="$1"
  local assessment_id="$2"
  local hold_seconds="$3"
  local race_log="$4"

  docker exec "${container_name}" \
    psql -X --set=ON_ERROR_STOP=1 --set=VERBOSITY=verbose --quiet \
      --username "${DB_ROLE}" --dbname "${primary_db}" \
      --command "BEGIN;
        INSERT INTO \"DerivedAccountAssessment\" (
          \"id\", \"tenantId\", \"consumerId\", \"reportVersionId\",
          \"accountId\", \"extractionRunId\", \"assessmentVersion\",
          \"classifierVersion\", \"policyVersion\", \"inputSetSha256\",
          \"evidenceCompleteness\", \"accountCondition\", \"disputeGrounds\",
          \"reportedAdversity\"
        ) VALUES (
          '${assessment_id}', 'p0-synthetic-direct', 'p0-synthetic-direct',
          'rv-v2', '${account_id}', 'run-clean', 1, 'classifier-race-v1',
          'policy-v1', repeat('c',64), 'COMPLETE', 'CLEAN',
          'NONE_DETECTED', 'FAVORABLE'
        );
        SELECT pg_sleep(${hold_seconds});
        COMMIT;" >"${race_log}" 2>&1
}

run_race_adverse_transaction() {
  local account_id="$1"
  local evidence_id="$2"
  local section_id="$3"
  local hold_seconds="$4"
  local race_log="$5"

  docker exec "${container_name}" \
    psql -X --set=ON_ERROR_STOP=1 --set=VERBOSITY=verbose --quiet \
      --username "${DB_ROLE}" --dbname "${primary_db}" \
      --command "BEGIN;
        INSERT INTO \"HistoricalEvidence\" (
          \"id\", \"tenantId\", \"consumerId\", \"reportVersionId\",
          \"accountId\", \"extractionRunId\", \"bureau\",
          \"bureauCoverageId\", \"coverageStatus\", \"reportSection\",
          \"sectionStatus\", \"sectionCompletenessId\", \"evidenceType\",
          \"presence\", \"detailCiphertext\", \"detailIv\",
          \"detailAuthTag\", \"detailKeyVersion\", \"detailAlgorithm\",
          \"detailEnvelopeVersion\", \"detailAadVersion\",
          \"sourceLocatorToken\", \"normalizationRuleKey\",
          \"normalizationRuleVersion\"
        ) VALUES (
          '${evidence_id}', 'p0-synthetic-direct', 'p0-synthetic-direct',
          'rv-v2', '${account_id}', 'run-clean', 'EQUIFAX', 'cov-clean-eq',
          'COVERED', 'ACCOUNT_DETAIL', 'COMPLETE', '${section_id}',
          'CHARGE_OFF', 'PRESENT', decode('71','hex'), decode('72','hex'),
          decode('73','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
          'loc-race-adverse', 'synthetic-rule', 'v1'
        );
        SELECT pg_sleep(${hold_seconds});
        COMMIT;" >"${race_log}" 2>&1
}

say "constraints: assessment-first race against adverse evidence"
set +e
run_race_assessment_transaction \
  "acct-race-assessment-first" "assessment-race-assessment-first" 1.0 \
  "${tmp_root}/race-assessment-first-assessment.log" &
assessment_first_pid=$!
sleep 0.2
run_race_adverse_transaction \
  "acct-race-assessment-first" "he-race-assessment-first" \
  "sc-race-assessment-first-equifax-account_detail" 0 \
  "${tmp_root}/race-assessment-first-evidence.log"
assessment_first_evidence_status=$?
wait "${assessment_first_pid}"
assessment_first_assessment_status=$?
set -e

assessment_first_state="$(psql_query "${primary_db}" \
  "SELECT
     (SELECT COUNT(*) FROM \"DerivedAccountAssessment\"
      WHERE \"accountId\" = 'acct-race-assessment-first'
        AND \"accountCondition\" = 'CLEAN')::text || '|' ||
     (SELECT COUNT(*) FROM \"HistoricalEvidence\"
      WHERE \"accountId\" = 'acct-race-assessment-first'
        AND \"presence\" = 'PRESENT'
        AND \"evidenceType\" <> 'OTHER_NON_ADVERSE')::text;")"
if [[ "${assessment_first_assessment_status}" -ne 0 ]] \
    || [[ "${assessment_first_evidence_status}" -eq 0 ]] \
    || ! grep -q 'ERROR:  55000:' "${tmp_root}/race-assessment-first-evidence.log" \
    || [[ "${assessment_first_state}" != "1|0" ]]; then
  redact_log "${tmp_root}/race-assessment-first-assessment.log" >&2
  redact_log "${tmp_root}/race-assessment-first-evidence.log" >&2
  fail "assessment-first race did not preserve exactly CLEAN=1 adverse=0"
fi

say "constraints: adverse-evidence-first race against CLEAN assessment"
set +e
run_race_adverse_transaction \
  "acct-race-evidence-first" "he-race-evidence-first" \
  "sc-race-evidence-first-equifax-account_detail" 1.0 \
  "${tmp_root}/race-evidence-first-evidence.log" &
evidence_first_pid=$!
sleep 0.2
run_race_assessment_transaction \
  "acct-race-evidence-first" "assessment-race-evidence-first" 0 \
  "${tmp_root}/race-evidence-first-assessment.log"
evidence_first_assessment_status=$?
wait "${evidence_first_pid}"
evidence_first_evidence_status=$?
set -e

evidence_first_state="$(psql_query "${primary_db}" \
  "SELECT
     (SELECT COUNT(*) FROM \"DerivedAccountAssessment\"
      WHERE \"accountId\" = 'acct-race-evidence-first'
        AND \"accountCondition\" = 'CLEAN')::text || '|' ||
     (SELECT COUNT(*) FROM \"HistoricalEvidence\"
      WHERE \"accountId\" = 'acct-race-evidence-first'
        AND \"presence\" = 'PRESENT'
        AND \"evidenceType\" <> 'OTHER_NON_ADVERSE')::text;")"
if [[ "${evidence_first_evidence_status}" -ne 0 ]] \
    || [[ "${evidence_first_assessment_status}" -eq 0 ]] \
    || ! grep -q 'ERROR:  23514:' "${tmp_root}/race-evidence-first-assessment.log" \
    || [[ "${evidence_first_state}" != "0|1" ]]; then
  redact_log "${tmp_root}/race-evidence-first-evidence.log" >&2
  redact_log "${tmp_root}/race-evidence-first-assessment.log" >&2
  fail "evidence-first race did not preserve exactly CLEAN=0 adverse=1"
fi

stale_clean_adverse_count="$(psql_query "${primary_db}" \
  "SELECT COUNT(*)
   FROM \"DerivedAccountAssessment\" daa
   JOIN \"HistoricalEvidence\" he
     ON he.\"tenantId\" = daa.\"tenantId\"
    AND he.\"consumerId\" = daa.\"consumerId\"
    AND he.\"reportVersionId\" = daa.\"reportVersionId\"
    AND he.\"accountId\" = daa.\"accountId\"
   WHERE daa.\"accountCondition\" = 'CLEAN'
     AND he.\"presence\" = 'PRESENT'
     AND he.\"evidenceType\" <> 'OTHER_NON_ADVERSE';")"
[[ "${stale_clean_adverse_count}" == "0" ]] \
  || fail "a stale CLEAN assessment coexists with adverse evidence"
printf '%s\n' \
  'P0_ASSERT_PASS assessment-first race rejected adverse evidence [55000]' \
  'P0_ASSERT_PASS evidence-first race rejected CLEAN assessment [23514]' \
  >>"${tmp_root}/constraints.log"
say "assessment_evidence_race: assessment_first=1|0 evidence_first=0|1 stale_pairs=0"

run_concurrent_packet_probe() {
  local probe_id="$1"
  local version_id="$2"
  local ordinal="$3"
  local probe_log="${tmp_root}/${probe_id}.log"

  docker exec "${container_name}" \
    psql -X --set=ON_ERROR_STOP=1 --quiet \
      --username "${DB_ROLE}" --dbname "${primary_db}" \
      --command "BEGIN;
        INSERT INTO \"PacketCorrespondenceVersion\" (
          \"id\", \"tenantId\", \"consumerId\", \"reportVersionId\", \"caseId\",
          \"recipientId\", \"recipientAddressVersionId\", \"identityBaselineId\",
          \"policyVersion\", \"round\", \"claimClass\", \"packetId\",
          \"correspondenceId\", \"correspondenceVersionId\", \"ordinal\"
        ) VALUES (
          '${probe_id}', 'p0-synthetic-direct', 'p0-synthetic-direct', 'rv-v2',
          'case-1', 'recipient-1', 'address-1', 'baseline-1', 'policy-v1', 1,
          'FACTUAL_ACCURACY', 'packet-1', 'corr-1', '${version_id}', ${ordinal}
        );
        SELECT pg_sleep(0.5);
        COMMIT;" >"${probe_log}" 2>&1
}

say "constraints: running two concurrent writers against the sealed packet"
set +e
run_concurrent_packet_probe "pcv-concurrent-a" "cv-2" 1 &
concurrent_a_pid=$!
run_concurrent_packet_probe "pcv-concurrent-b" "cv-3" 2 &
concurrent_b_pid=$!
wait "${concurrent_a_pid}"
concurrent_a_status=$?
wait "${concurrent_b_pid}"
concurrent_b_status=$?
set -e

concurrency_seal_rejections="$(grep -l 'APPROVED packet membership and enclosure counts are sealed' \
  "${tmp_root}/pcv-concurrent-a.log" "${tmp_root}/pcv-concurrent-b.log" | wc -l | tr -d ' ')"
concurrency_deadlock_rejections="$(grep -l 'deadlock detected' \
  "${tmp_root}/pcv-concurrent-a.log" "${tmp_root}/pcv-concurrent-b.log" | wc -l | tr -d ' ')"

if [[ "${concurrent_a_status}" -eq 0 || "${concurrent_b_status}" -eq 0 ]] \
    || [[ "${concurrency_seal_rejections}" != "1" ]] \
    || [[ "${concurrency_deadlock_rejections}" != "1" ]]; then
  redact_log "${tmp_root}/pcv-concurrent-a.log" >&2
  redact_log "${tmp_root}/pcv-concurrent-b.log" >&2
  fail "concurrent sealed-packet writers were not both rejected"
fi

[[ "$(psql_query "${primary_db}" "SELECT COUNT(*) FROM \"PacketCorrespondenceVersion\" WHERE \"packetId\" = 'packet-1';")" == "1" ]] \
  || fail "concurrent probes changed sealed packet membership"
say "concurrency: seal_rejections=${concurrency_seal_rejections} deadlock_rejections=${concurrency_deadlock_rejections} committed_children=0"
printf '%s\n' \
  'P0_ASSERT_PASS concurrent sealed packet writer A rejected [23514]' \
  'P0_ASSERT_PASS concurrent sealed packet writer B rejected [23514]' \
  >>"${tmp_root}/constraints.log"

negative_pass_count="$(grep -c 'P0_ASSERT_PASS' "${tmp_root}/constraints.log" || true)"
positive_pass_count="$(grep -c 'P0_POSITIVE_SUITE_PASS' "${tmp_root}/constraints.log" || true)"
[[ "${positive_pass_count}" == "${EXPECTED_POSITIVE_SUITE_COUNT}" ]] \
  || fail "unexpected positive-suite count"
[[ "${negative_pass_count}" == "${EXPECTED_NEGATIVE_CASE_COUNT}" ]] \
  || fail "unexpected negative-case count"

# Rollback guard failures must occur before the first DROP and leave every P0
# object present.
say "rollback safety: missing/wrong sentinel and unsafe target fail closed"
if psql_file "${primary_db}" "${ROLLBACK_SQL}" >"${tmp_root}/rollback-missing-sentinel.log" 2>&1; then
  fail "rollback unexpectedly accepted a missing sentinel"
fi
[[ "$(psql_query "${primary_db}" "SELECT to_regclass('public.\"ReportVersion\"') IS NOT NULL;")" == "t" ]] \
  || fail "missing-sentinel probe mutated the database"

if psql_file "${primary_db}" "${ROLLBACK_SQL}" \
    --set=p0_disposable_sentinel=WRONG_SENTINEL >"${tmp_root}/rollback-wrong-sentinel.log" 2>&1; then
  fail "rollback unexpectedly accepted a wrong sentinel"
fi
[[ "$(psql_query "${primary_db}" "SELECT to_regclass('public.\"ReportVersion\"') IS NOT NULL;")" == "t" ]] \
  || fail "wrong-sentinel probe mutated the database"

postgres_table_count_before="$(psql_query postgres "SELECT COUNT(*) FROM pg_catalog.pg_class;")"
if psql_file postgres "${ROLLBACK_SQL}" \
    --set=p0_disposable_sentinel=DISPOSABLE_DATABASE_ONLY >"${tmp_root}/rollback-unsafe-target.log" 2>&1; then
  fail "rollback unexpectedly accepted a non-sentinel database name"
fi
postgres_table_count_after="$(psql_query postgres "SELECT COUNT(*) FROM pg_catalog.pg_class;")"
[[ "${postgres_table_count_after}" == "${postgres_table_count_before}" ]] \
  || fail "unsafe-target probe mutated the postgres control database"

say "rollback: removing only final P0 objects from the primary disposable database"
psql_file "${primary_db}" "${ROLLBACK_SQL}" \
  --set=p0_disposable_sentinel=DISPOSABLE_DATABASE_ONLY \
  >"${tmp_root}/rollback.log" 2>&1

for table_name in $(cat "${tmp_root}/expected.tables"); do
  [[ "$(psql_query "${primary_db}" "SELECT to_regclass('public.\"${table_name}\"') IS NULL;")" == "t" ]] \
    || fail "rollback left P0 table ${table_name}"
done

for type_name in $(cat "${tmp_root}/expected.types"); do
  [[ "$(psql_query "${primary_db}" "SELECT to_regtype('public.\"${type_name}\"') IS NULL;")" == "t" ]] \
    || fail "rollback left P0 enum ${type_name}"
done

[[ "$(psql_query "${primary_db}" "SELECT to_regclass('public.\"User\"') IS NOT NULL AND to_regclass('public.\"Report\"') IS NOT NULL AND to_regclass('public.\"Tradeline\"') IS NOT NULL;")" == "t" ]] \
  || fail "rollback removed a baseline table"
baseline_after_rollback="$(baseline_snapshot "${primary_db}")"
[[ "${baseline_after_rollback}" == "${baseline_before}" ]] \
  || fail "rollback changed baseline rows"

say "rebuild: creating a fresh sentinel database and replaying every migration"
psql_query postgres "CREATE DATABASE \"${rebuild_db}\";" >/dev/null
run_prisma_deploy "rebuild-full-deploy" "${rebuild_url}" "${SCHEMA_FILE}"
verify_catalog "${rebuild_db}" "rebuild"
run_prisma_diff "${rebuild_url}"

run_prisma_deploy "rebuild-second-deploy" "${rebuild_url}" "${SCHEMA_FILE}"
grep -q "No pending migrations to apply" "${LAST_PRISMA_LOG}" \
  || fail "fresh rebuild second deploy was not a no-op"

applied_migration_count="$(psql_query "${rebuild_db}" "SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
p0_migration_count="$(psql_query "${rebuild_db}" "SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE migration_name = '${MIGRATION_NAME}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
[[ "${p0_migration_count}" == "1" ]] || fail "P0 migration was not applied exactly once"

say "PASS: DISPOSABLE DATABASE ONLY"
say "result: positive_suites=${positive_pass_count} negative_cases=${negative_pass_count}"
say "result: schema_sha256=${EXPECTED_SCHEMA_SHA256}"
say "result: migration_sha256=${EXPECTED_MIGRATION_SHA256}"
say "result: image_digest=${POSTGRES_IMAGE_DIGEST}"
say "result: synthetic_baseline_sha256=${baseline_before_sha}"
say "result: applied_migrations=${applied_migration_count} p0_apply_count=${p0_migration_count}"
say "result: assessment_first_clean_adverse=${assessment_first_state} evidence_first_clean_adverse=${evidence_first_state} stale_clean_adverse_pairs=${stale_clean_adverse_count}"
say "result: concurrency_seal_rejections=${concurrency_seal_rejections} concurrency_deadlock_rejections=${concurrency_deadlock_rejections}"
say "result: schema_parity=empty idempotence=pass rollback=pass rebuild=pass"
