#!/usr/bin/env bash
set -Eeuo pipefail

# CreditVector P0 Phase 2A migration verifier.
# DISPOSABLE DATABASE ONLY. This script accepts no target, generates a fresh
# loopback-only PostgreSQL target, uses a locally present pinned image, clears
# inherited database variables, and performs no network or production access.

umask 077

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly MIGRATION_NAME="20260810_p0_phase2a_ingestion_round0"
readonly MIGRATION_SQL="${REPO_ROOT}/prisma/migrations/${MIGRATION_NAME}/migration.sql"
readonly SCHEMA_FILE="${REPO_ROOT}/prisma/schema.prisma"
readonly ROLLBACK_SQL="${REPO_ROOT}/scripts/sql/p0-phase2a-disposable-rollback.sql"
readonly STATIC_GUARD="${REPO_ROOT}/scripts/p0-phase2a-migration-guard.test.ts"
readonly PRISMA_BIN="${REPO_ROOT}/node_modules/.bin/prisma"
readonly EXPECTED_SCHEMA_SHA256="e5cd3765f0d60ff0757c41ee5fdd1ee4be758cbb729bc28633aa77f8fc89765a"
readonly EXPECTED_MIGRATION_SHA256="d9e9615318db3df0a484ead860523890041598115eade298e611b14af845fa55"
readonly POSTGRES_IMAGE_TAG="postgres:16-alpine"
readonly POSTGRES_IMAGE_ID="sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777"
readonly DB_ROLE="p0_2a_disposable_verifier"

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
sha256_file() { shasum -a 256 "$1" | awk '{print $1}'; }

[[ $# -eq 0 ]] || fail "no arguments are accepted; the verifier creates its own target"

for forbidden_docker_override in \
  DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS_VERIFY DOCKER_CERT_PATH DOCKER_CONFIG; do
  if declare -p "${forbidden_docker_override}" >/dev/null 2>&1; then
    fail "${forbidden_docker_override} override is forbidden"
  fi
done

say "DISPOSABLE DATABASE ONLY"
say "preflight: frozen inputs, static guard, and local-only policy"

for required in "${MIGRATION_SQL}" "${SCHEMA_FILE}" "${ROLLBACK_SQL}" "${STATIC_GUARD}" "${PRISMA_BIN}"; do
  [[ -f "${required}" || -x "${required}" ]] || fail "required verifier input is missing"
done

[[ "$(sha256_file "${SCHEMA_FILE}")" == "${EXPECTED_SCHEMA_SHA256}" ]] || fail "schema freeze digest mismatch"
[[ "$(sha256_file "${MIGRATION_SQL}")" == "${EXPECTED_MIGRATION_SHA256}" ]] || fail "migration freeze digest mismatch"

cd "${REPO_ROOT}"
unset DATABASE_URL DIRECT_URL SHADOW_DATABASE_URL PRISMA_DATABASE_URL
unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

env -i PATH="${PATH}" HOME="${HOME}" NODE_ENV=test \
  node --no-warnings --experimental-strip-types "${STATIC_GUARD}"

command -v docker >/dev/null 2>&1 || fail "Docker is required"
command -v openssl >/dev/null 2>&1 || fail "openssl is required"

docker_context_name="$(docker context show 2>/dev/null)" || fail "cannot resolve Docker context"
[[ "${docker_context_name}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || fail "unsafe Docker context name"
docker_endpoint="$(docker context inspect --format '{{ (index .Endpoints "docker").Host }}' "${docker_context_name}" 2>/dev/null)" || fail "cannot resolve Docker endpoint"
[[ "${docker_endpoint}" =~ ^unix:///[^[:space:]]+$ ]] || fail "Docker endpoint must be a local unix socket"
[[ "${docker_endpoint}" != *'/../'* && "${docker_endpoint}" != *'/./'* ]] || fail "Docker unix socket path is not canonical"
readonly docker_context_name docker_endpoint

local_docker() { docker --host "${docker_endpoint}" "$@"; }

local_docker info >/dev/null 2>&1 || fail "local Docker daemon is unavailable"

local_image_id="$(local_docker image inspect --format '{{.Id}}' "${POSTGRES_IMAGE_TAG}" 2>/dev/null || true)"
[[ "${local_image_id}" == "${POSTGRES_IMAGE_ID}" ]] || fail "pinned PostgreSQL image is not present locally; verifier will not pull"

tmp_root="$(mktemp -d /private/tmp/creditvector-p0-2a-disposable.XXXXXX)"
[[ "${tmp_root}" == /private/tmp/creditvector-p0-2a-disposable.* ]] || fail "unsafe temporary directory"

run_token="$(date -u +%Y%m%d%H%M%S)-$$-${RANDOM}"
container_name="creditvector-p0-2a-disposable-${run_token}"
primary_db="p0_2a_disposable_primary_$$_${RANDOM}"
rebuild_db="p0_2a_disposable_rebuild_$$_${RANDOM}"
db_password="p02a$(openssl rand -hex 24)"
container_started=0
teardown_confirmed=0

[[ "${container_name}" =~ ^creditvector-p0-2a-disposable-[0-9]{14}-[0-9]+-[0-9]+$ ]] || fail "unsafe container name"
[[ "${primary_db}" =~ ^p0_2a_disposable_[a-z0-9_]+$ ]] || fail "unsafe primary database name"
[[ "${rebuild_db}" =~ ^p0_2a_disposable_[a-z0-9_]+$ ]] || fail "unsafe rebuild database name"

cleanup() {
  local original_status=$?
  set +e
  if [[ "${container_started}" -eq 1 ]] && [[ "${container_name}" =~ ^creditvector-p0-2a-disposable- ]]; then
    local_docker stop --time 10 "${container_name}" >/dev/null 2>&1
    for _attempt in $(seq 1 20); do
      if ! local_docker inspect "${container_name}" >/dev/null 2>&1; then
        teardown_confirmed=1
        break
      fi
      sleep 0.25
    done
    [[ "${teardown_confirmed}" -eq 1 ]] || original_status=1
    say "teardown: disposable container removed=$([[ "${teardown_confirmed}" -eq 1 ]] && printf true || printf false)"
  fi
  [[ -z "${tmp_root:-}" || "${tmp_root}" != /private/tmp/creditvector-p0-2a-disposable.* ]] || find "${tmp_root}" -depth -delete >/dev/null 2>&1
  db_password=""
  exit "${original_status}"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

redact_log() {
  sed -E -e "s/${db_password}/<redacted>/g" -e 's#postgres(ql)?://[^[:space:]]+#<redacted-disposable-url>#g' "$1"
}

run_prisma_deploy() {
  local label="$1" url="$2" schema_path="$3"
  local log_file="${tmp_root}/${label}.log"
  if ! env -i PATH="${PATH}" HOME="${HOME}" TMPDIR=/private/tmp NODE_ENV=test PRISMA_HIDE_UPDATE_MESSAGE=1 DATABASE_URL="${url}" \
      "${PRISMA_BIN}" migrate deploy --schema "${schema_path}" >"${log_file}" 2>&1; then
    redact_log "${log_file}" >&2
    fail "Prisma migrate deploy failed for ${label}"
  fi
  redact_log "${log_file}"
  LAST_PRISMA_LOG="${log_file}"
}

run_prisma_diff() {
  local url="$1" log_file="${tmp_root}/schema-parity.log"
  if ! env -i PATH="${PATH}" HOME="${HOME}" TMPDIR=/private/tmp NODE_ENV=test PRISMA_HIDE_UPDATE_MESSAGE=1 DATABASE_URL="${url}" \
      "${PRISMA_BIN}" migrate diff --from-schema-datasource "${SCHEMA_FILE}" --to-schema-datamodel "${SCHEMA_FILE}" --exit-code >"${log_file}" 2>&1; then
    redact_log "${log_file}" >&2
    fail "schema parity is not empty"
  fi
  redact_log "${log_file}"
}

psql_query() {
  local database="$1" sql="$2"
  local_docker exec "${container_name}" psql -X --set=ON_ERROR_STOP=1 --tuples-only --no-align --quiet \
    --username "${DB_ROLE}" --dbname "${database}" --command "${sql}"
}

psql_file() {
  local database="$1" file="$2"
  local_docker exec -i "${container_name}" psql -X --set=ON_ERROR_STOP=1 --username "${DB_ROLE}" --dbname "${database}" <"${file}"
}

say "container: starting pinned PostgreSQL on a random loopback port"
local_docker run --detach --rm --name "${container_name}" \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_USER="${DB_ROLE}" \
  --env POSTGRES_PASSWORD="${db_password}" \
  --env POSTGRES_DB="${primary_db}" \
  "${POSTGRES_IMAGE_ID}" >/dev/null
container_started=1

postgres_ready=0
for _ready_attempt in $(seq 1 240); do
  if local_docker exec "${container_name}" pg_isready --username "${DB_ROLE}" --dbname "${primary_db}" >/dev/null 2>&1; then
    postgres_ready=1
    break
  fi
  sleep 0.25
done
if [[ "${postgres_ready}" -ne 1 ]]; then
  local_docker logs --tail 80 "${container_name}" >&2 || true
  fail "disposable PostgreSQL did not become ready"
fi
postgres_version="$(local_docker exec "${container_name}" postgres --version)"
case "${postgres_version}" in
  "postgres (PostgreSQL) 16."*) ;;
  *) fail "disposable PostgreSQL major version is not 16" ;;
esac
say "postgres: ${postgres_version}"

port_binding="$(local_docker port "${container_name}" 5432/tcp | head -n1)"
host_port="${port_binding##*:}"
[[ "${host_port}" =~ ^[0-9]+$ ]] || fail "Docker did not assign a loopback port"
primary_url="postgresql://${DB_ROLE}:${db_password}@127.0.0.1:${host_port}/${primary_db}?schema=public"
rebuild_url="postgresql://${DB_ROLE}:${db_password}@127.0.0.1:${host_port}/${rebuild_db}?schema=public"

# Apply repository migrations before Phase 2A, seed legacy rows, then apply the
# exact additive migration. Temporary copies never alter repository files.
baseline_prisma="${tmp_root}/baseline-prisma"
mkdir -p "${baseline_prisma}/migrations"
cp "${SCHEMA_FILE}" "${baseline_prisma}/schema.prisma"
cp "${REPO_ROOT}/prisma/migrations/migration_lock.toml" "${baseline_prisma}/migrations/migration_lock.toml"
for migration_dir in "${REPO_ROOT}"/prisma/migrations/*; do
  [[ -d "${migration_dir}" ]] || continue
  [[ "$(basename "${migration_dir}")" == "${MIGRATION_NAME}" ]] && continue
  cp -R "${migration_dir}" "${baseline_prisma}/migrations/"
done

say "forward: applying baseline migrations"
run_prisma_deploy baseline-deploy "${primary_url}" "${baseline_prisma}/schema.prisma"

baseline_seed="${tmp_root}/baseline-seed.sql"
printf '%s\n' \
  'INSERT INTO "User" ("id", "email", "role", "isAgency") VALUES ('\''p0-2a-direct'\'', '\''direct-2a@synthetic.invalid'\'', '\''USER'\'', false);' \
  'INSERT INTO "User" ("id", "email", "role", "isAgency") VALUES ('\''p0-2a-foreign'\'', '\''foreign-2a@synthetic.invalid'\'', '\''USER'\'', false);' \
  >"${baseline_seed}"
psql_file "${primary_db}" "${baseline_seed}" >/dev/null

say "forward: applying ${MIGRATION_NAME}"
run_prisma_deploy phase2a-forward "${primary_url}" "${SCHEMA_FILE}"
run_prisma_diff "${primary_url}"

say "idempotence: second deploy must be an explicit no-op"
run_prisma_deploy phase2a-second "${primary_url}" "${SCHEMA_FILE}"
grep -q "No pending migrations to apply" "${LAST_PRISMA_LOG}" || fail "second deploy was not an explicit no-op"

fixture_sql="${tmp_root}/phase2a-behavior.sql"
cat >"${fixture_sql}" <<'SQL'
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION pg_temp.expect_sqlstate(label text, statement_text text, expected text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement_text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected THEN
      RAISE NOTICE 'P0_2A_ASSERT_PASS % [%]', label, expected;
      RETURN;
    END IF;
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL % expected %, got %: %', label, expected, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'P0_2A_ASSERT_FAIL % expected %, statement succeeded', label, expected;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_deferred_sqlstate(
  label text,
  statement_text text,
  constraint_name text,
  expected text
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement_text;
    EXECUTE format('SET CONSTRAINTS %I IMMEDIATE', constraint_name);
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected THEN
      RAISE NOTICE 'P0_2A_ASSERT_PASS % [%]', label, expected;
      RETURN;
    END IF;
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL % expected %, got %: %', label, expected, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'P0_2A_ASSERT_FAIL % expected %, deferred statement succeeded', label, expected;
END;
$$;

INSERT INTO "CreditTruthScope" ("tenantId", "consumerId") VALUES ('p0-2a-direct', 'p0-2a-direct');

INSERT INTO "ReportIngestion" (
  "id", "tenantId", "consumerId", "actorId", "authorizationKind",
  "authorizationVersion", "idempotencyKey", "operationKey", "reportSeriesKey",
  "reservedVersion", "sourceSha256", "sourceByteLength",
  "sourceDeclaredMimeType", "sourceDetectedMimeType", "updatedAt"
) VALUES (
  'ing-1', 'p0-2a-direct', 'p0-2a-direct', 'actor-1', 'DIRECT_CONSUMER',
  'auth-v1', 'idem-1', 'op-1', 'series-1', 1, repeat('a',64), 128,
  'application/pdf', 'application/pdf', now()
);

-- Pre-store audit resolves the exact scoped ingestion revision; no placeholder
-- Artifact or ReportVersion is created before source readback is attested.
INSERT INTO "P0SensitiveAccessEvent" (
  "id", "tenantId", "consumerId", "eventKey", "actorId", "authorizationKind",
  "authorizationVersion", "accessKind", "purposeCode", "decision",
  "decisionCode", "resourceType", "resourceId", "resourceVersion",
  "correlationId", "occurredAt"
) VALUES (
  'access-ingestion-2a', 'p0-2a-direct', 'p0-2a-direct', 'access-event-ingestion-1',
  'worker-1', 'SYSTEM_WORKER', 'auth-worker-v1', 'WORKER', 'REPORT_INGESTION',
  'ALLOW', 'AUTHORIZED', 'REPORT_INGESTION', 'ing-1', 1,
  'corr-access-ingestion-1', now()
);

SELECT pg_temp.expect_sqlstate('pre-store ingestion audit purpose substitution', $q$
  INSERT INTO "P0SensitiveAccessEvent" (
    "id", "tenantId", "consumerId", "eventKey", "actorId", "authorizationKind",
    "authorizationVersion", "accessKind", "purposeCode", "decision",
    "decisionCode", "resourceType", "resourceId", "resourceVersion",
    "correlationId", "occurredAt"
  ) VALUES (
    'access-ingestion-bad-purpose', 'p0-2a-direct', 'p0-2a-direct',
    'access-event-ingestion-bad-purpose', 'worker-1', 'SYSTEM_WORKER',
    'auth-worker-v1', 'WORKER', 'INTEGRITY_VERIFICATION', 'ALLOW', 'AUTHORIZED',
    'REPORT_INGESTION', 'ing-1', 1, 'corr-access-ingestion-bad-purpose', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('pre-store ingestion audit revision substitution', $q$
  INSERT INTO "P0SensitiveAccessEvent" (
    "id", "tenantId", "consumerId", "eventKey", "actorId", "authorizationKind",
    "authorizationVersion", "accessKind", "purposeCode", "decision",
    "decisionCode", "resourceType", "resourceId", "resourceVersion",
    "correlationId", "occurredAt"
  ) VALUES (
    'access-ingestion-bad-revision', 'p0-2a-direct', 'p0-2a-direct',
    'access-event-ingestion-bad-revision', 'worker-1', 'SYSTEM_WORKER',
    'auth-worker-v1', 'WORKER', 'REPORT_INGESTION', 'ALLOW', 'AUTHORIZED',
    'REPORT_INGESTION', 'ing-1', 2, 'corr-access-ingestion-bad-revision', now()
  )
$q$, '23503');

SELECT pg_temp.expect_sqlstate('duplicate ingestion idempotency', $q$
  INSERT INTO "ReportIngestion" (
    "id", "tenantId", "consumerId", "actorId", "authorizationKind",
    "authorizationVersion", "idempotencyKey", "operationKey", "reportSeriesKey",
    "reservedVersion", "sourceSha256", "sourceByteLength",
    "sourceDeclaredMimeType", "sourceDetectedMimeType", "updatedAt"
  ) VALUES (
    'ing-duplicate', 'p0-2a-direct', 'p0-2a-direct', 'actor-1', 'DIRECT_CONSUMER',
    'auth-v1', 'idem-1', 'op-other', 'series-other', 1, repeat('b',64), 64,
    'application/pdf', 'application/pdf', now()
  )
$q$, '23505');

SELECT pg_temp.expect_sqlstate('duplicate ingestion operation', $q$
  INSERT INTO "ReportIngestion" (
    "id", "tenantId", "consumerId", "actorId", "authorizationKind",
    "authorizationVersion", "idempotencyKey", "operationKey", "reportSeriesKey",
    "reservedVersion", "sourceSha256", "sourceByteLength",
    "sourceDeclaredMimeType", "sourceDetectedMimeType", "updatedAt"
  ) VALUES (
    'ing-operation-duplicate', 'p0-2a-direct', 'p0-2a-direct', 'actor-1', 'DIRECT_CONSUMER',
    'auth-v1', 'idem-operation-other', 'op-1', 'series-operation-other', 1,
    repeat('b',64), 64, 'application/pdf', 'application/pdf', now()
  )
$q$, '23505');

SELECT pg_temp.expect_sqlstate('duplicate report version reservation', $q$
  INSERT INTO "ReportIngestion" (
    "id", "tenantId", "consumerId", "actorId", "authorizationKind",
    "authorizationVersion", "idempotencyKey", "operationKey", "reportSeriesKey",
    "reservedVersion", "sourceSha256", "sourceByteLength",
    "sourceDeclaredMimeType", "sourceDetectedMimeType", "updatedAt"
  ) VALUES (
    'ing-reservation-duplicate', 'p0-2a-direct', 'p0-2a-direct', 'actor-1', 'DIRECT_CONSUMER',
    'auth-v1', 'idem-reservation-other', 'op-reservation-other', 'series-1', 1,
    repeat('b',64), 64, 'application/pdf', 'application/pdf', now()
  )
$q$, '23505');

-- Isolated positive proof for the runtime transition shape: a current live
-- holder advances state and clears its lease tuple in one exact CAS. The main
-- fixture keeps a live lease for its longer state-graph exercise.
INSERT INTO "ReportIngestion" (
  "id", "tenantId", "consumerId", "actorId", "authorizationKind",
  "authorizationVersion", "idempotencyKey", "operationKey", "reportSeriesKey",
  "reservedVersion", "sourceSha256", "sourceByteLength",
  "sourceDeclaredMimeType", "sourceDetectedMimeType", "updatedAt"
) VALUES (
  'ing-live-release', 'p0-2a-direct', 'p0-2a-direct', 'worker-1', 'SYSTEM_WORKER',
  'auth-worker-v1', 'idem-live-release', 'op-live-release', 'series-live-release', 1,
  repeat('9',64), 48, 'application/pdf', 'application/pdf', now()
);
UPDATE "ReportIngestion" SET
  "attemptCount" = 1,
  "leaseToken" = 'lease-live-release',
  "leaseOwnerId" = 'worker-1',
  "leaseExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + interval '4 minutes',
  "revision" = 2,
  "updatedAt" = now()
WHERE "id" = 'ing-live-release' AND "revision" = 1;

SELECT pg_temp.expect_sqlstate('live same-state lease release', $q$
  UPDATE "ReportIngestion" SET
    "leaseToken" = NULL,
    "leaseOwnerId" = NULL,
    "leaseExpiresAt" = NULL,
    "revision" = 3,
    "updatedAt" = now()
  WHERE "id" = 'ing-live-release'
    AND "revision" = 2
    AND "leaseToken" = 'lease-live-release'
    AND "leaseOwnerId" = 'worker-1'
$q$, '55000');

UPDATE "ReportIngestion" SET
  "state" = 'FAILED',
  "safeFailureCode" = 'SAFE_LIVE_COMPLETION',
  "leaseToken" = NULL,
  "leaseOwnerId" = NULL,
  "leaseExpiresAt" = NULL,
  "revision" = 3,
  "updatedAt" = now()
WHERE "id" = 'ing-live-release'
  AND "revision" = 2
  AND "leaseToken" = 'lease-live-release'
  AND "leaseOwnerId" = 'worker-1'
  AND "leaseExpiresAt" = (
    SELECT expected."leaseExpiresAt"
    FROM "ReportIngestion" expected
    WHERE expected."id" = 'ing-live-release'
      AND expected."revision" = 2
      AND expected."leaseToken" = 'lease-live-release'
      AND expected."leaseOwnerId" = 'worker-1'
  );
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ReportIngestion"
    WHERE "id" = 'ing-live-release'
      AND "revision" = 3
      AND "state" = 'FAILED'
      AND "leaseToken" IS NULL
      AND "leaseOwnerId" IS NULL
      AND "leaseExpiresAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL exact live lease completion did not clear tuple';
  END IF;
END;
$$;
SELECT 'P0_2A_ASSERT_PASS exact live lease completion clears tuple';

-- OUTCOME_UNKNOWN reconciliation is intentionally lease-free, but only the
-- narrow trusted-writer snapshot shape may cross the SQL boundary.
INSERT INTO "ReportIngestion" (
  "id", "tenantId", "consumerId", "actorId", "authorizationKind",
  "authorizationVersion", "idempotencyKey", "operationKey", "reportSeriesKey",
  "reservedVersion", "sourceSha256", "sourceByteLength",
  "sourceDeclaredMimeType", "sourceDetectedMimeType", "updatedAt"
) VALUES (
  'ing-reconciliation', 'p0-2a-direct', 'p0-2a-direct', 'worker-1', 'SYSTEM_WORKER',
  'auth-worker-v1', 'idem-reconciliation', 'op-reconciliation',
  'series-reconciliation', 1, repeat('7',64), 24,
  'application/pdf', 'application/pdf', now()
);
UPDATE "ReportIngestion" SET
  "attemptCount" = 1,
  "leaseToken" = 'lease-reconciliation',
  "leaseOwnerId" = 'worker-1',
  "leaseExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + interval '4 minutes',
  "revision" = 2,
  "updatedAt" = now()
WHERE "id" = 'ing-reconciliation' AND "revision" = 1;
UPDATE "ReportIngestion" SET
  "state" = 'OUTCOME_UNKNOWN',
  "safeFailureCode" = 'WRITE_OUTCOME_UNKNOWN',
  "leaseToken" = NULL,
  "leaseOwnerId" = NULL,
  "leaseExpiresAt" = NULL,
  "revision" = 3,
  "updatedAt" = now()
WHERE "id" = 'ing-reconciliation'
  AND "revision" = 2
  AND "leaseToken" = 'lease-reconciliation'
  AND "leaseOwnerId" = 'worker-1';
SELECT pg_temp.expect_sqlstate('stale reconciliation snapshot', $q$
  UPDATE "ReportIngestion" SET
    "state" = 'QUARANTINED',
    "safeFailureCode" = 'RECONCILIATION_QUARANTINE',
    "revision" = 4,
    "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC') - interval '31 seconds'
  WHERE "id" = 'ing-reconciliation' AND "revision" = 3
$q$, '55000');
UPDATE "ReportIngestion" SET
  "state" = 'QUARANTINED',
  "safeFailureCode" = 'RECONCILIATION_QUARANTINE',
  "revision" = 4,
  "updatedAt" = now()
WHERE "id" = 'ing-reconciliation'
  AND "revision" = 3
  AND "leaseToken" IS NULL
  AND "leaseOwnerId" IS NULL
  AND "leaseExpiresAt" IS NULL;
SELECT 'P0_2A_ASSERT_PASS exact trusted-writer reconciliation without lease';

SELECT pg_temp.expect_sqlstate('pre-extraction failed ingestion is not assessable', $q$
  UPDATE "ReportIngestion" SET
    "attemptCount" = 2,
    "leaseToken" = 'lease-pre-extraction-failed',
    "leaseOwnerId" = 'worker-1',
    "leaseExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + interval '4 minutes',
    "revision" = 4,
    "updatedAt" = now()
  WHERE "id" = 'ing-live-release' AND "revision" = 3
$q$, '23514');

SELECT pg_temp.expect_sqlstate('unbounded ingestion lease', $q$
  UPDATE "ReportIngestion" SET
    "attemptCount" = 1,
    "leaseToken" = 'lease-too-long',
    "leaseOwnerId" = 'worker-1',
    "leaseExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + interval '6 minutes',
    "revision" = 2,
    "updatedAt" = now()
  WHERE "id" = 'ing-1' AND "revision" = 1
$q$, '23514');

UPDATE "ReportIngestion" SET
  "attemptCount" = 1,
  "leaseToken" = 'lease-ing-1',
  "leaseOwnerId" = 'worker-1',
  "leaseExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + interval '4 minutes',
  "revision" = 2,
  "updatedAt" = now()
WHERE "id" = 'ing-1' AND "revision" = 1;

SELECT pg_temp.expect_sqlstate('live ingestion lease takeover', $q$
  UPDATE "ReportIngestion" SET
    "leaseToken" = 'lease-forged',
    "leaseOwnerId" = 'worker-forged',
    "leaseExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + interval '4 minutes',
    "revision" = 3,
    "updatedAt" = now()
  WHERE "id" = 'ing-1' AND "revision" = 2
$q$, '55000');

SELECT pg_temp.expect_sqlstate('stale worker completion token', $q$
  UPDATE "ReportIngestion" SET
    "state" = 'FAILED',
    "safeFailureCode" = 'SAFE_STALE_WORKER',
    "leaseToken" = 'lease-stale-worker',
    "revision" = 3,
    "updatedAt" = now()
  WHERE "id" = 'ing-1' AND "revision" = 2
$q$, '55000');

UPDATE "ReportIngestion" SET
  "sourceStorageProviderKey" = 'synthetic-store',
  "sourceLocatorCiphertext" = decode('01','hex'),
  "sourceLocatorIv" = decode('02','hex'),
  "sourceLocatorAuthTag" = decode('03','hex'),
  "sourceLocatorKeyVersion" = 'key-v1',
  "sourceLocatorAlgorithm" = 'AES_256_GCM',
  "sourceLocatorEnvelopeVersion" = 'env-v1',
  "sourceLocatorAadVersion" = 'aad-v1',
  "sourceReadbackSha256" = repeat('a',64),
  "sourceReadbackByteLength" = 128,
  "sourceVerifiedAt" = now(),
  "state" = 'SOURCE_STORED_AND_VERIFIED',
  "revision" = 3,
  "updatedAt" = now()
WHERE "id" = 'ing-1' AND "revision" = 2;

SELECT pg_temp.expect_sqlstate('stale ingestion revision', $q$
  UPDATE "ReportIngestion" SET "revision" = 3, "updatedAt" = now() WHERE "id" = 'ing-1'
$q$, '40001');
SELECT pg_temp.expect_sqlstate('source object substitution', $q$
  UPDATE "ReportIngestion" SET "sourceStorageProviderKey" = 'other-store', "revision" = 4, "updatedAt" = now() WHERE "id" = 'ing-1'
$q$, '55000');
SELECT pg_temp.expect_sqlstate('ingestion deletion forbidden', $q$
  DELETE FROM "ReportIngestion" WHERE "id" = 'ing-1'
$q$, '55000');

INSERT INTO "ReportIngestion" (
  "id", "tenantId", "consumerId", "actorId", "authorizationKind",
  "authorizationVersion", "idempotencyKey", "operationKey", "reportSeriesKey",
  "reservedVersion", "sourceSha256", "sourceByteLength",
  "sourceDeclaredMimeType", "sourceDetectedMimeType", "updatedAt"
) VALUES (
  'ing-disposed', 'p0-2a-direct', 'p0-2a-direct', 'actor-1', 'DIRECT_CONSUMER',
  'auth-v1', 'idem-disposed', 'op-disposed', 'series-disposed', 1,
  repeat('e',64), 32, 'application/pdf', 'application/pdf', now()
);
UPDATE "ReportIngestion" SET
  "sourceDisposition" = 'TOMBSTONE_REQUESTED',
  "sourceDispositionReasonCode" = 'CONSUMER_ERASURE_REQUESTED',
  "sourceDispositionAt" = now(),
  "state" = 'QUARANTINED',
  "safeFailureCode" = 'SOURCE_DISPOSITION_QUARANTINE',
  "revision" = 2,
  "updatedAt" = now()
WHERE "id" = 'ing-disposed' AND "revision" = 1;
SELECT pg_temp.expect_sqlstate('disposed source cannot acquire processing lease', $q$
  UPDATE "ReportIngestion" SET
    "attemptCount" = 1,
    "leaseToken" = 'lease-disposed',
    "leaseOwnerId" = 'worker-1',
    "leaseExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + interval '1 minute',
    "revision" = 3,
    "updatedAt" = now()
  WHERE "id" = 'ing-disposed' AND "revision" = 2
$q$, '23514');

INSERT INTO "ReportVersion" (
  "id", "tenantId", "consumerId", "reportSeriesKey", "version", "origin",
  "authorityStatus", "schemaVersion", "inputSha256", "createdByActorId"
) VALUES (
  'rv-2a', 'p0-2a-direct', 'p0-2a-direct', 'series-1', 1, 'SYNTHETIC_TEST',
  'SHADOW_V2', 'truth-v2', repeat('a',64), 'actor-1'
);

INSERT INTO "Artifact" (
  "id", "tenantId", "consumerId", "artifactSeriesKey", "version", "kind",
  "reportVersionId", "storageProviderKey", "storageLocatorCiphertext",
  "storageLocatorIv", "storageLocatorAuthTag", "storageLocatorKeyVersion",
  "storageLocatorAlgorithm", "storageLocatorEnvelopeVersion",
  "storageLocatorAadVersion", "sha256", "mimeType", "byteLength",
  "createdByActorId"
) VALUES (
  'source-artifact-2a', 'p0-2a-direct', 'p0-2a-direct', 'source-artifact-series',
  1, 'REPORT_SOURCE', 'rv-2a', 'synthetic-store', decode('11','hex'),
  decode('12','hex'), decode('13','hex'), 'key-v1', 'AES_256_GCM', 'env-v1',
  'aad-v1', repeat('a',64), 'application/pdf', 128, 'actor-1'
);

UPDATE "ReportIngestion" SET
  "reportVersionId" = 'rv-2a', "sourceArtifactId" = 'source-artifact-2a',
  "state" = 'VERSION_COMMITTED', "revision" = 4, "updatedAt" = now()
WHERE "id" = 'ing-1' AND "revision" = 3;

BEGIN;
INSERT INTO "ExtractionRun" (
  "id", "tenantId", "consumerId", "reportVersionId", "runKey", "attempt",
  "engine", "engineVersion", "schemaVersion", "normalizationVersion", "status",
  "startedAt", "completedAt", "inputArtifactId", "inputSha256",
  "inputRepresentation"
) VALUES (
  'run-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-key-2a', 1,
  'HYBRID_V2', 'v2', 'v2', 'v2', 'SUCCEEDED', now(), now(),
  'source-artifact-2a', repeat('a',64), 'ORIGINAL_REPORT_BYTES'
);
INSERT INTO "ExtractionBureauCoverage" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus"
) VALUES
  ('cov-2a-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a', 'EQUIFAX', 'COVERED'),
  ('cov-2a-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a', 'EXPERIAN', 'OUTSIDE_COVERAGE'),
  ('cov-2a-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a', 'TRANSUNION', 'OUTSIDE_COVERAGE');
COMMIT;

-- Legacy-runtime compatibility: the additive input columns remain nullable,
-- while new Phase 2A writers are separately required to exact-pin them.
BEGIN;
INSERT INTO "ExtractionRun" (
  "id", "tenantId", "consumerId", "reportVersionId", "runKey", "attempt",
  "engine", "engineVersion", "schemaVersion", "normalizationVersion", "status",
  "startedAt", "completedAt"
) VALUES (
  'run-legacy-compatible', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-key-legacy-compatible', 1, 'REGEX_V2', 'legacy', 'legacy', 'legacy',
  'FAILED', now(), now()
);
INSERT INTO "ExtractionBureauCoverage" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus"
) VALUES
  ('cov-legacy-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-legacy-compatible', 'EQUIFAX', 'COVERED'),
  ('cov-legacy-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-legacy-compatible', 'EXPERIAN', 'OUTSIDE_COVERAGE'),
  ('cov-legacy-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-legacy-compatible', 'TRANSUNION', 'OUTSIDE_COVERAGE');
COMMIT;

SELECT pg_temp.expect_sqlstate('wrong normalized input representation', $q$
  INSERT INTO "ExtractionRun" (
    "id", "tenantId", "consumerId", "reportVersionId", "runKey", "attempt",
    "engine", "engineVersion", "schemaVersion", "normalizationVersion", "status",
    "startedAt", "completedAt", "inputArtifactId", "inputSha256", "inputRepresentation"
  ) VALUES (
    'run-bad-input', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'bad-run', 1,
    'HYBRID_V2', 'v2', 'v2', 'v2', 'FAILED', now(), now(),
    'source-artifact-2a', repeat('a',64), 'DERIVED_NORMALIZED_TEXT'
  )
$q$, '23514');

UPDATE "ReportIngestion" SET "state" = 'EXTRACTING', "revision" = 5, "updatedAt" = now() WHERE "id" = 'ing-1' AND "revision" = 4;

SELECT pg_temp.expect_sqlstate('failed extraction requires an exact run', $q$
  UPDATE "ReportIngestion" SET
    "state" = 'FAILED',
    "safeFailureCode" = 'PARSER_TIMEOUT',
    "revision" = 6,
    "updatedAt" = now()
  WHERE "id" = 'ing-1'
    AND "revision" = 5
    AND "leaseToken" = 'lease-ing-1'
    AND "leaseOwnerId" = 'worker-1'
$q$, '23514');

SELECT pg_temp.expect_sqlstate('extraction result cannot release lease before assessment', $q$
  UPDATE "ReportIngestion" SET
    "state" = 'FAILED',
    "safeFailureCode" = 'SAFE_FAILED_EXTRACTION',
    "extractionRunId" = 'run-2a',
    "leaseToken" = NULL,
    "leaseOwnerId" = NULL,
    "leaseExpiresAt" = NULL,
    "revision" = 6,
    "updatedAt" = now()
  WHERE "id" = 'ing-1'
    AND "revision" = 5
    AND "leaseToken" = 'lease-ing-1'
    AND "leaseOwnerId" = 'worker-1'
$q$, '55000');

-- Superseded pre-closure fixture retained as non-executable review history.
-- The integrated H1/H2/H3 fixture below is the only executed closure proof.
\if false

-- Exact successful extraction used by H1/H2/H3 source seals. The earlier
-- failed run remains isolated for ingestion-state and stale-metadata probes.
INSERT INTO "ExtractionRun" (
  "id", "tenantId", "consumerId", "reportVersionId", "runKey", "attempt",
  "engine", "engineVersion", "schemaVersion", "normalizationVersion", "status",
  "startedAt", "completedAt", "inputArtifactId", "inputSha256",
  "inputRepresentation"
) VALUES
  ('run-round0', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-key-round0', 1,
   'HYBRID_V2', 'v2', 'v2', 'v2', 'SUCCEEDED', now(), now(),
   'source-artifact-2a', repeat('a',64), 'ORIGINAL_REPORT_BYTES'),
  ('run-date-partial', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-key-date-partial', 1,
   'REGEX_V2', 'v2', 'v2', 'v2', 'PARTIAL', now(), now(),
   'source-artifact-2a', repeat('a',64), 'ORIGINAL_REPORT_BYTES'),
  ('run-account-empty', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-key-account-empty', 1,
   'HYBRID_V2', 'v2', 'v2', 'v2', 'SUCCEEDED', now(), now(),
   'source-artifact-2a', repeat('a',64), 'ORIGINAL_REPORT_BYTES');

INSERT INTO "ExtractionBureauCoverage" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus"
) VALUES
  ('cov-round0-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'EQUIFAX', 'COVERED'),
  ('cov-round0-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'EXPERIAN', 'COVERED'),
  ('cov-round0-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'TRANSUNION', 'COVERED'),
  ('cov-date-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-date-partial', 'EQUIFAX', 'COVERED'),
  ('cov-date-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-date-partial', 'EXPERIAN', 'COVERED'),
  ('cov-date-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-date-partial', 'TRANSUNION', 'COVERED'),
  ('cov-empty-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-account-empty', 'EQUIFAX', 'COVERED'),
  ('cov-empty-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-account-empty', 'EXPERIAN', 'COVERED'),
  ('cov-empty-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-account-empty', 'TRANSUNION', 'COVERED');

SELECT pg_temp.expect_sqlstate('wrong-bureau report-date metadata substitution', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-wrong-bureau', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-date-partial', 'EQUIFAX', 'COVERED', 'cov-date-ex', 'PRESENT',
    '2026-08', 'MONTH', 'SOURCE_REPORTED', 'date-loc-wrong', repeat('1',64)
  )
$q$, '23503');

SELECT pg_temp.expect_sqlstate('stale failed-extraction report-date metadata', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-stale-run', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
    'EQUIFAX', 'COVERED', 'cov-2a-eq', 'PRESENT', '2026-08-10', 'DAY',
    'SOURCE_REPORTED', 'date-loc-stale', repeat('2',64)
  )
$q$, '23514');

BEGIN;
INSERT INTO "BureauReportDateEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
  "precision", "provenance", "sourceLocatorToken", "integritySha256"
) VALUES (
  'date-failed-unknown', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
  'EXPERIAN', 'OUTSIDE_COVERAGE', 'cov-2a-ex', 'UNKNOWN', NULL, 'UNKNOWN',
  'UNKNOWN', NULL, repeat('2',64)
);
SELECT 'P0_2A_ASSERT_PASS failed parser preserves unknown report date';

INSERT INTO "BureauReportDateEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
  "precision", "provenance", "sourceLocatorToken", "integritySha256"
) VALUES
  ('date-round0-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0',
   'EQUIFAX', 'COVERED', 'cov-round0-eq', 'PRESENT', '2026-08-10', 'DAY',
   'SOURCE_REPORTED', 'date-loc-eq', repeat('3',64)),
  ('date-round0-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0',
   'EXPERIAN', 'COVERED', 'cov-round0-ex', 'EXPLICIT_NOT_PROVIDED', NULL,
   'UNKNOWN', 'EXPLICIT_NOT_PROVIDED', 'date-loc-ex-absent', repeat('4',64)),
  ('date-round0-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0',
   'TRANSUNION', 'COVERED', 'cov-round0-tu', 'UNKNOWN', NULL, 'UNKNOWN',
   'UNKNOWN', NULL, repeat('5',64)),
  ('date-partial-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-date-partial',
   'EQUIFAX', 'COVERED', 'cov-date-eq', 'PRESENT', '2026-08', 'MONTH',
   'SOURCE_REPORTED', 'date-loc-month', repeat('6',64)),
  ('date-partial-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-date-partial',
   'EXPERIAN', 'COVERED', 'cov-date-ex', 'PRESENT', '2026', 'YEAR',
   'SOURCE_REPORTED', 'date-loc-year', repeat('7',64)),
  ('date-partial-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-date-partial',
   'TRANSUNION', 'COVERED', 'cov-date-tu', 'UNKNOWN', NULL, 'UNKNOWN',
   'UNKNOWN', NULL, repeat('8',64));

SELECT pg_temp.expect_sqlstate('date precision fabrication rejected', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-fabricated-day', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-date-partial', 'TRANSUNION', 'COVERED', 'cov-date-tu', 'PRESENT',
    '2026-08', 'DAY', 'SOURCE_REPORTED', 'date-loc-fabricated', repeat('9',64)
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('present report date requires lexical value', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-null-value', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-date-partial', 'TRANSUNION', 'COVERED', 'cov-date-tu', 'PRESENT',
    NULL, 'DAY', 'SOURCE_REPORTED', 'date-loc-null-value', repeat('0',64)
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('explicit absent report date requires locator', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-null-absence-locator', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-date-partial', 'EQUIFAX', 'COVERED', 'cov-date-eq',
    'EXPLICIT_NOT_PROVIDED', NULL, 'UNKNOWN', 'EXPLICIT_NOT_PROVIDED', NULL,
    repeat('1',64)
  )
$q$, '23514');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "BureauReportDateEvidence"
    WHERE "id" = 'date-round0-eq' AND "presence" = 'PRESENT'
      AND "sourceValue" = '2026-08-10' AND "precision" = 'DAY'
      AND "provenance" = 'SOURCE_REPORTED' AND "sourceLocatorToken" = 'date-loc-eq'
  ) OR NOT EXISTS (
    SELECT 1 FROM "BureauReportDateEvidence"
    WHERE "id" = 'date-round0-ex' AND "presence" = 'EXPLICIT_NOT_PROVIDED'
      AND "sourceValue" IS NULL AND "precision" = 'UNKNOWN'
      AND "provenance" = 'EXPLICIT_NOT_PROVIDED'
  ) OR NOT EXISTS (
    SELECT 1 FROM "BureauReportDateEvidence"
    WHERE "id" = 'date-round0-tu' AND "presence" = 'UNKNOWN'
      AND "sourceValue" IS NULL AND "sourceLocatorToken" IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM "BureauReportDateEvidence"
    WHERE "id" = 'date-failed-unknown' AND "presence" = 'UNKNOWN'
      AND "extractionRunId" = 'run-2a' AND "bureau" = 'EXPERIAN'
      AND "sourceValue" IS NULL AND "sourceLocatorToken" IS NULL
  ) THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL lossless bureau report-date readback';
  END IF;
  RAISE NOTICE 'P0_2A_ASSERT_PASS lossless bureau report-date readback';
END;
$$;

INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
  "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
  "occurrence", "idempotencyKey", "integritySha256", "scoreCiphertext",
  "scoreIv", "scoreAuthTag", "scoreKeyVersion", "scoreAlgorithm",
  "scoreEnvelopeVersion", "scoreAadVersion", "scoreModelKey",
  "scoreModelVersion", "scoreModelPresence", "scoreModelEvidenceValue",
  "scoreModelSourceLocatorToken",
  "scoreScaleMin", "scoreScaleMax", "modelMetadataCompleteness",
  "sourceMethodKey", "sourceMethodVersion", "sourceLocatorToken",
  "normalizationRuleKey", "normalizationRuleVersion", "parserConfidence", "observedAt"
) VALUES
  ('score-model-present', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0',
   'EQUIFAX', 'COVERED', 'cov-round0-eq', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE',
   'SCORE_REPORTED', 'COMPLETE', 'score-model-present-series', 1, 0,
   'score-model-present-idem', repeat('a',64), decode('91','hex'), decode('92','hex'),
   decode('93','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
   'FICO_SCORE_8', '8', 'PRESENT', 'FICO_SCORE_8', 'score-model-locator-distinct', 300, 850,
   'COMPLETE', 'parser-v2', 'v2', 'score-value-locator', 'score-normalize', 'v1',
   0.9700, now()),
  ('score-model-absent', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0',
   'EXPERIAN', 'COVERED', 'cov-round0-ex', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE',
   'SCORE_REPORTED', 'PARTIAL', 'score-model-absent-series', 1, 0,
   'score-model-absent-idem', repeat('b',64), decode('a1','hex'), decode('a2','hex'),
   decode('a3','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
   NULL, NULL, 'NOT_PROVIDED', NULL, NULL, 300, 850, 'PARTIAL', 'parser-v2', 'v2',
   'score-absent-value-locator', 'score-normalize', 'v1', 0.9600, now()),
  ('score-model-unknown', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0',
   'TRANSUNION', 'COVERED', 'cov-round0-tu', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE',
   'SCORE_REPORTED', 'PARTIAL', 'score-model-unknown-series', 1, 0,
   'score-model-unknown-idem', repeat('c',64), decode('b1','hex'), decode('b2','hex'),
   decode('b3','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
   NULL, NULL, 'UNKNOWN', NULL, NULL, 300, 850, 'PARTIAL', 'parser-v2', 'v2',
   'score-unknown-value-locator', 'score-normalize', 'v1', 0.9500, now());

-- Score absence and score-model absence remain independent explicit facts.
INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
  "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
  "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
  "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion",
  "parserConfidence", "observedAt"
) VALUES (
  'score-and-model-not-provided', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-round0', 'EQUIFAX', 'COVERED', 'cov-round0-eq', 'REPORT_DERIVED',
  'PRIMARY_REPORT_EVIDENCE', 'SCORE_NOT_PROVIDED', 'NOT_PROVIDED',
  'score-and-model-not-provided-series', 1, 3, 'score-and-model-not-provided-idem',
  repeat('e',64), 'NOT_PROVIDED', 'UNKNOWN', 'parser-v2', 'v2',
  'score-not-provided-locator', 'score-normalize', 'v1', 0.9400, now()
);

-- Score presence and score-model presence are independent. A numeric score may
-- remain UNKNOWN while exact model/type evidence is PRESENT or UNKNOWN, and a
-- failed run may preserve its explicit UNKNOWN/UNKNOWN sentinel losslessly.
INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
  "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
  "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
  "scoreModelEvidenceValue", "scoreModelSourceLocatorToken",
  "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion",
  "parserConfidence", "observedAt"
) VALUES
  (
    'score-unknown-model-present', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-round0', 'EQUIFAX', 'COVERED', 'cov-round0-eq', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'PARTIAL',
    'score-unknown-model-present-series', 1, 6,
    'score-unknown-model-present-idem', repeat('6',64), 'PRESENT',
    'VANTAGE_SCORE_4', 'score-unknown-model-present-locator', 'UNKNOWN',
    'parser-v2', 'v2', NULL, 'score-normalize', 'v1', 0.7100, now()
  ),
  (
    'score-unknown-model-unknown', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-round0', 'EXPERIAN', 'COVERED', 'cov-round0-ex', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN',
    'score-unknown-model-unknown-series', 1, 6,
    'score-unknown-model-unknown-idem', repeat('7',64), 'UNKNOWN', NULL, NULL,
    'UNKNOWN', 'parser-v2', 'v2', NULL, 'score-normalize', 'v1', 0.0000, now()
  ),
  (
    'score-failed-unknown-model-unknown', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-2a', 'EQUIFAX', 'COVERED', 'cov-2a-eq', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN',
    'score-failed-unknown-model-unknown-series', 1, 0,
    'score-failed-unknown-model-unknown-idem', repeat('8',64), 'UNKNOWN', NULL, NULL,
    'UNKNOWN', 'parser-v2', 'v2', NULL, 'score-normalize', 'v1', 0.0000, now()
  );

SELECT pg_temp.expect_sqlstate('exact-input score cannot omit model presence', $q$
  INSERT INTO "CreditScoreObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
    "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
    "occurrence", "idempotencyKey", "integritySha256", "scoreCiphertext",
    "scoreIv", "scoreAuthTag", "scoreKeyVersion", "scoreAlgorithm",
    "scoreEnvelopeVersion", "scoreAadVersion", "modelMetadataCompleteness",
    "sourceMethodKey", "sourceMethodVersion", "sourceLocatorToken",
    "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
  ) VALUES (
    'score-model-presence-omitted', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-round0', 'EQUIFAX', 'COVERED', 'cov-round0-eq', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'SCORE_REPORTED', 'PARTIAL',
    'score-model-presence-omitted-series', 1, 2, 'score-model-presence-omitted-idem',
    repeat('f',64), decode('d1','hex'), decode('d2','hex'), decode('d3','hex'),
    'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1', 'UNKNOWN', 'parser-v2', 'v2',
    'score-model-omitted-locator', 'score-normalize', 'v1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('present score model requires exact model key', $q$
  INSERT INTO "CreditScoreObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
    "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
    "occurrence", "idempotencyKey", "integritySha256", "scoreCiphertext",
    "scoreIv", "scoreAuthTag", "scoreKeyVersion", "scoreAlgorithm",
    "scoreEnvelopeVersion", "scoreAadVersion", "scoreModelPresence",
    "scoreModelSourceLocatorToken", "modelMetadataCompleteness",
    "sourceMethodKey", "sourceMethodVersion", "sourceLocatorToken",
    "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
  ) VALUES (
    'score-model-null-key', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-round0', 'EQUIFAX', 'COVERED', 'cov-round0-eq', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'SCORE_REPORTED', 'PARTIAL',
    'score-model-null-key-series', 1, 4, 'score-model-null-key-idem',
    repeat('1',64), decode('e1','hex'), decode('e2','hex'), decode('e3','hex'),
    'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1', 'PRESENT',
    'score-model-null-key-locator', 'UNKNOWN', 'parser-v2', 'v2',
    'score-null-key-value-locator', 'score-normalize', 'v1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('present score model requires distinct locator field', $q$
  INSERT INTO "CreditScoreObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
    "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
    "occurrence", "idempotencyKey", "integritySha256", "scoreCiphertext",
    "scoreIv", "scoreAuthTag", "scoreKeyVersion", "scoreAlgorithm",
    "scoreEnvelopeVersion", "scoreAadVersion", "scoreModelKey",
    "scoreModelPresence", "scoreModelEvidenceValue", "scoreModelSourceLocatorToken",
    "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
    "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion",
    "observedAt"
  ) VALUES (
    'score-model-null-locator', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-round0', 'EQUIFAX', 'COVERED', 'cov-round0-eq', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'SCORE_REPORTED', 'PARTIAL',
    'score-model-null-locator-series', 1, 5, 'score-model-null-locator-idem',
    repeat('2',64), decode('f1','hex'), decode('f2','hex'), decode('f3','hex'),
    'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1', 'FICO_SCORE_8', 'PRESENT',
    'FICO_SCORE_8', NULL, 'PARTIAL', 'parser-v2', 'v2', 'score-null-model-locator-value',
    'score-normalize', 'v1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('score-model fabrication from not-provided', $q$
  INSERT INTO "CreditScoreObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
    "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
    "occurrence", "idempotencyKey", "integritySha256", "scoreCiphertext",
    "scoreIv", "scoreAuthTag", "scoreKeyVersion", "scoreAlgorithm",
    "scoreEnvelopeVersion", "scoreAadVersion", "scoreModelKey",
    "scoreModelPresence", "scoreModelEvidenceValue", "scoreModelSourceLocatorToken", "scoreScaleMin",
    "scoreScaleMax", "modelMetadataCompleteness", "sourceMethodKey",
    "sourceMethodVersion", "sourceLocatorToken", "observedAt"
  ) VALUES (
    'score-model-fabricated', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0',
    'EQUIFAX', 'COVERED', 'cov-round0-eq', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE',
    'SCORE_REPORTED', 'PARTIAL', 'score-model-fabricated-series', 1, 1,
    'score-model-fabricated-idem', repeat('d',64), decode('c1','hex'), decode('c2','hex'),
    decode('c3','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
    'INVENTED_MODEL', 'NOT_PROVIDED', NULL, NULL, 300, 850, 'UNKNOWN', 'parser-v2', 'v2',
    'score-fabricated-locator', now()
  )
$q$, '23514');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-model-present' AND "scoreModelPresence" = 'PRESENT'
      AND "scoreModelKey" = 'FICO_SCORE_8'
      AND "sourceLocatorToken" = 'score-value-locator'
      AND "scoreModelSourceLocatorToken" = 'score-model-locator-distinct'
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-model-absent' AND "presence" = 'SCORE_REPORTED'
      AND "scoreModelPresence" = 'NOT_PROVIDED' AND "scoreModelKey" IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-model-unknown' AND "presence" = 'SCORE_REPORTED'
      AND "scoreModelPresence" = 'UNKNOWN' AND "scoreModelKey" IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-and-model-not-provided'
      AND "presence" = 'SCORE_NOT_PROVIDED'
      AND "scoreModelPresence" = 'NOT_PROVIDED'
      AND "scoreModelKey" IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-unknown-model-present'
      AND "presence" = 'UNKNOWN'
      AND "scoreModelPresence" = 'PRESENT'
      AND "scoreModelKey" IS NULL
      AND "scoreModelEvidenceValue" = 'VANTAGE_SCORE_4'
      AND "scoreModelSourceLocatorToken" = 'score-unknown-model-present-locator'
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-unknown-model-unknown'
      AND "presence" = 'UNKNOWN'
      AND "scoreModelPresence" = 'UNKNOWN'
      AND "scoreModelEvidenceValue" IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-failed-unknown-model-unknown'
      AND "extractionRunId" = 'run-2a'
      AND "presence" = 'UNKNOWN'
      AND "scoreModelPresence" = 'UNKNOWN'
  ) THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL independent score-model readback';
  END IF;
  RAISE NOTICE 'P0_2A_ASSERT_PASS independent score-model readback';
END;
$$;

INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "baselineSeriesKey",
  "version", "status", "policyVersion", "inputSetSha256",
  "confirmedByActorId", "confirmedAt", "createdByActorId"
) VALUES (
  'baseline-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-series-2a',
  1, 'CONFIRMED', 'policy-v1', repeat('9',64), 'actor-1', now(), 'actor-1'
);

-- A partial extraction may preserve exact metadata, but it cannot attest that
-- an account-review category is not applicable across the entire source set.
INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "baselineSeriesKey",
  "version", "status", "policyVersion", "inputSetSha256",
  "confirmedByActorId", "confirmedAt", "createdByActorId"
) VALUES (
  'baseline-partial-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-date-partial', 'baseline-partial-series-2a', 1, 'CONFIRMED', 'policy-v1',
  repeat('c',64), 'actor-1', now(), 'actor-1'
);

INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "baselineSeriesKey",
  "version", "status", "policyVersion", "inputSetSha256",
  "confirmedByActorId", "confirmedAt", "createdByActorId"
) VALUES (
  'baseline-account-empty', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-account-empty', 'baseline-account-empty-series', 1, 'CONFIRMED', 'policy-v1',
  repeat('b',64), 'actor-1', now(), 'actor-1'
);

-- Consumer account-review receipts pin the exact DRAFT source baseline. A
-- later CONFIRMED successor consumes the sealed receipt set; the receipt never
-- pins that successor and therefore cannot create a confirmation cycle.
INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "baselineSeriesKey",
  "version", "status", "policyVersion", "inputSetSha256", "createdByActorId"
) VALUES (
  'baseline-account-review-draft', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-round0', 'baseline-account-review-series', 1, 'DRAFT', 'policy-v1',
  repeat('d',64), 'actor-1'
);

-- Old-runtime baseline rows remain valid when the additive run pin is absent.
INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "baselineSeriesKey",
  "version", "status", "policyVersion", "inputSetSha256", "createdByActorId"
) VALUES (
  'baseline-legacy-compatible', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'baseline-legacy-compatible-series', 1, 'DRAFT', 'legacy-policy', repeat('e',64),
  'legacy-actor'
);

SELECT pg_temp.expect_sqlstate('identity baseline source-artifact seal substitution', $q$
  INSERT INTO "IdentityBaseline" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "baselineSeriesKey", "version", "status", "policyVersion", "inputSetSha256",
    "createdByActorId"
  ) VALUES (
    'baseline-unsealed-input', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-legacy-compatible', 'baseline-unsealed-input-series', 1, 'DRAFT',
    'policy-v1', repeat('f',64), 'actor-1'
  )
$q$, '23514');

INSERT INTO "IdentityFact" (
  "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
  "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal", "bureau", "factType", "classification",
  "reviewCategory", "integritySha256", "presence", "valueCiphertext", "valueIv",
  "valueAuthTag", "valueKeyVersion", "valueAlgorithm", "valueEnvelopeVersion",
  "valueAadVersion", "sourceLocatorToken", "normalizationRuleKey",
  "normalizationRuleVersion"
) VALUES (
  'identity-fact-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'baseline-2a', 'run-round0', repeat('9',64),
  'identity-fact-series', 0, 'EQUIFAX', 'NAME', 'CORRECT_CURRENT', 'LEGAL_NAME',
  repeat('8',64), 'PRESENT', decode('21','hex'), decode('22','hex'),
  decode('23','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
  'source-name-1', 'identity-normalize', 'v1'
);

SELECT pg_temp.expect_sqlstate('identity fact extraction source-set substitution', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
    "bureau", "factType", "classification", "reviewCategory", "integritySha256",
    "presence", "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion"
  ) VALUES (
    'identity-source-substitution', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'baseline-2a', 'run-date-partial', repeat('f',64), 'identity-source-substitution-series',
    98, 'EQUIFAX', 'NAME', 'REVIEW_NEEDED', 'LEGAL_NAME', repeat('f',64),
    'PRESENT', 'identity-source-substitution-locator', 'identity-normalize', 'v1'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('unrecognized account cannot become IdentityFact', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
    "bureau", "factType", "classification", "reviewCategory", "integritySha256",
    "presence", "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion"
  ) VALUES (
    'identity-unrecognized-account-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'baseline-2a', 'run-round0', repeat('9',64), 'identity-unrecognized-account-series',
    97, 'EQUIFAX', 'OTHER', 'REVIEW_NEEDED', 'UNRECOGNIZED_ACCOUNT', repeat('e',64),
    'PRESENT', 'identity-unrecognized-account-locator', 'identity-normalize', 'v1'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('phone category rejects OTHER fact type', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal", "bureau", "factType", "classification",
    "reviewCategory", "integritySha256", "presence", "sourceLocatorToken",
    "normalizationRuleKey", "normalizationRuleVersion"
  ) VALUES (
    'identity-phone-wrong-type', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'baseline-2a', 'run-round0', repeat('9',64),
    'identity-phone-wrong-series', 99, 'EQUIFAX', 'OTHER', 'CORRECT_CURRENT',
    'PHONE', repeat('4',64), 'PRESENT', 'source-phone-wrong', 'identity-normalize', 'v1'
  )
$q$, '23514');

INSERT INTO "IdentityFact" (
  "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
  "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal", "bureau", "factType", "classification",
  "reviewCategory", "integritySha256", "presence", "valueCiphertext", "valueIv",
  "valueAuthTag", "valueKeyVersion", "valueAlgorithm", "valueEnvelopeVersion",
  "valueAadVersion", "sourceLocatorToken",
  "normalizationRuleKey", "normalizationRuleVersion"
) VALUES
  (
    'identity-phone-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'baseline-2a', 'run-round0', repeat('9',64),
    'identity-phone-series', 1, 'EQUIFAX', 'IDENTIFIER', 'CORRECT_CURRENT',
    'PHONE', repeat('4',64), 'PRESENT', decode('31','hex'), decode('32','hex'),
    decode('33','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
    'source-phone-1', 'identity-normalize', 'v1'
  ),
  (
    'identity-former-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'baseline-2a', 'run-round0', repeat('9',64),
    'identity-former-series', 2, 'EQUIFAX', 'ADDRESS', 'CORRECT_FORMER',
    'FORMER_ADDRESS', repeat('3',64), 'PRESENT', decode('41','hex'), decode('42','hex'),
    decode('43','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
    'source-former-1', 'identity-normalize', 'v1'
  ),
  (
    'identity-employment-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'baseline-2a', 'run-round0', repeat('9',64),
    'identity-employment-series', 3, 'EQUIFAX', 'EMPLOYMENT', 'CORRECT_CURRENT',
    'EMPLOYMENT', repeat('2',64), 'PRESENT', decode('51','hex'), decode('52','hex'),
    decode('53','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
    'source-employment-1', 'identity-normalize', 'v1'
  ),
  (
    'identity-correction-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'baseline-2a', 'run-round0', repeat('9',64),
    'identity-correction-series', 4, 'EQUIFAX', 'NAME', 'INCORRECT',
    'ALIAS', repeat('1',64), 'PRESENT', decode('61','hex'), decode('62','hex'),
    decode('63','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
    'source-correction-1', 'identity-normalize', 'v1'
  ),
  (
    'identity-review-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'baseline-2a', 'run-round0', repeat('9',64),
    'identity-review-series', 6, 'EQUIFAX', 'ADDRESS', 'REVIEW_NEEDED',
    'CURRENT_ADDRESS', repeat('0',64), 'PRESENT', decode('81','hex'), decode('82','hex'),
    decode('83','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
    'source-review-1', 'identity-normalize', 'v1'
  );

-- A parser-uncertainty row is durable evidence, but it was never a
-- source-reported present identity fact and cannot back testimony.
INSERT INTO "IdentityFact" (
  "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
  "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal", "bureau", "factType", "classification",
  "reviewCategory", "integritySha256", "presence", "sourceLocatorToken",
  "normalizationRuleKey", "normalizationRuleVersion"
) VALUES (
  'identity-uncertain-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'baseline-2a', 'run-round0', repeat('9',64),
  'identity-uncertain-series', 7, 'EQUIFAX', 'NAME', 'INCORRECT',
  'ALIAS', repeat('d',64), 'UNKNOWN', 'source-uncertain-1',
  'identity-normalize', 'v1'
);

-- An old-runtime fact remains valid when both new nullable fields are absent.
INSERT INTO "IdentityFact" (
  "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
  "factSeriesKey", "factOrdinal", "bureau", "factType", "classification",
  "presence", "valueCiphertext", "valueIv", "valueAuthTag", "valueKeyVersion",
  "valueAlgorithm", "valueEnvelopeVersion", "valueAadVersion",
  "sourceLocatorToken", "normalizationRuleKey",
  "normalizationRuleVersion"
) VALUES (
  'identity-legacy-compatible', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'baseline-2a',
  'identity-legacy-series', 5, 'EQUIFAX', 'ADDRESS', 'REVIEW_NEEDED',
  'PRESENT', decode('71','hex'), decode('72','hex'), decode('73','hex'), 'key-v1',
  'AES_256_GCM', 'env-v1', 'aad-v1', 'source-legacy-1', 'legacy-normalize', 'v1'
);

SELECT pg_temp.expect_sqlstate('Round 0 completeness rejects wrong durable member count', $q$
  INSERT INTO "Round0SourceCompletenessEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "category", "status",
    "sourceMemberCount", "sourceMembershipSha256", "sourceLocatorToken",
    "integritySha256", "ruleKey", "ruleVersion"
  ) VALUES (
    'round0-completeness-wrong-count', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'run-round0', 'EQUIFAX', 'COVERED', 'cov-round0-eq',
    'MIXED_FILE_INDICATOR', 'COMPLETE', 1, repeat('1',64),
    'round0-completeness-wrong-count-locator', repeat('2',64),
    'round0-source-completeness', 'v1'
  )
$q$, '23514');

WITH bureau_catalog("bureau", "bureauCoverageId") AS (
  VALUES
    ('EQUIFAX'::"Bureau", 'cov-round0-eq'),
    ('EXPERIAN'::"Bureau", 'cov-round0-ex'),
    ('TRANSUNION'::"Bureau", 'cov-round0-tu')
), category_catalog("category") AS (
  VALUES
    ('LEGAL_NAME'::"IdentityReviewCategory"),
    ('ALIAS'::"IdentityReviewCategory"),
    ('CURRENT_ADDRESS'::"IdentityReviewCategory"),
    ('FORMER_ADDRESS'::"IdentityReviewCategory"),
    ('SAFE_IDENTIFIER'::"IdentityReviewCategory"),
    ('PHONE'::"IdentityReviewCategory"),
    ('EMPLOYMENT'::"IdentityReviewCategory"),
    ('MIXED_FILE_INDICATOR'::"IdentityReviewCategory")
)
INSERT INTO "Round0SourceCompletenessEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "category", "status",
  "sourceMemberCount", "sourceMembershipSha256", "sourceLocatorToken",
  "integritySha256", "ruleKey", "ruleVersion"
)
SELECT
  'round0-completeness-' || lower(bureau_catalog."bureau"::TEXT) || '-'
    || lower(category_catalog."category"::TEXT),
  'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0',
  bureau_catalog."bureau", 'COVERED', bureau_catalog."bureauCoverageId",
  category_catalog."category", 'COMPLETE', members."memberCount",
  md5('membership:' || bureau_catalog."bureau"::TEXT || ':'
    || category_catalog."category"::TEXT || ':' || members."memberCount"::TEXT)
    || md5('membership-2:' || bureau_catalog."bureau"::TEXT || ':'
    || category_catalog."category"::TEXT || ':' || members."memberCount"::TEXT),
  'round0-completeness-locator-' || lower(bureau_catalog."bureau"::TEXT)
    || '-' || lower(category_catalog."category"::TEXT),
  md5('integrity:' || bureau_catalog."bureau"::TEXT || ':'
    || category_catalog."category"::TEXT || ':' || members."memberCount"::TEXT)
    || md5('integrity-2:' || bureau_catalog."bureau"::TEXT || ':'
    || category_catalog."category"::TEXT || ':' || members."memberCount"::TEXT),
  'round0-source-completeness', 'v1'
FROM bureau_catalog
CROSS JOIN category_catalog
CROSS JOIN LATERAL (
  SELECT count(*)::INTEGER AS "memberCount"
  FROM "IdentityFact" fact
  WHERE fact."tenantId" = 'p0-2a-direct'
    AND fact."consumerId" = 'p0-2a-direct'
    AND fact."reportVersionId" = 'rv-2a'
    AND fact."extractionRunId" = 'run-round0'
    AND fact."bureau" = bureau_catalog."bureau"
    AND fact."reviewCategory" = category_catalog."category"
    AND fact."integritySha256" IS NOT NULL
    AND fact."baselineInputSetSha256" IS NOT NULL
) members;

DO $$
BEGIN
  IF (
    SELECT count(*) FROM "Round0SourceCompletenessEvidence"
    WHERE "tenantId" = 'p0-2a-direct'
      AND "consumerId" = 'p0-2a-direct'
      AND "reportVersionId" = 'rv-2a'
      AND "extractionRunId" = 'run-round0'
      AND "category" <> 'UNRECOGNIZED_ACCOUNT'
  ) <> 24 THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL exact identity completeness catalog';
  END IF;
  RAISE NOTICE 'P0_2A_ASSERT_PASS exact identity completeness catalog';
END;
$$;

SELECT pg_temp.expect_sqlstate('sealed identity category rejects later source member', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
    "bureau", "factType", "classification", "reviewCategory", "integritySha256",
    "presence", "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion"
  ) VALUES (
    'identity-after-completeness-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'baseline-2a', 'run-round0', repeat('9',64),
    'identity-after-completeness-bad-series', 96, 'EQUIFAX', 'OTHER',
    'REVIEW_NEEDED', 'MIXED_FILE_INDICATOR', repeat('6',64), 'PRESENT',
    'identity-after-completeness-locator', 'identity-normalize', 'v1'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('not applicable contradicts any-bureau fact', $q$
  INSERT INTO "IdentityCategoryCompletion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
    "identityBaselineVersion", "baselineInputSetSha256", "category",
    "sourceCompletenessSha256", "sourceCompletenessAttestationKey",
    "sourceCompletenessRuleVersion", "sourceCompletenessEvidenceCount",
    "equifaxSourceCompletenessEvidenceId", "experianSourceCompletenessEvidenceId",
    "transunionSourceCompletenessEvidenceId", "completedByActorId", "completedAt"
  ) VALUES (
    'completion-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-2a',
    1, repeat('9',64), 'LEGAL_NAME', repeat('7',64), 'complete-source', 'v1',
    3, 'round0-completeness-equifax-legal_name',
    'round0-completeness-experian-legal_name',
    'round0-completeness-transunion-legal_name',
    'actor-1', now()
  )
$q$, '23514');

INSERT INTO "IdentityCategoryCompletion" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
  "identityBaselineVersion", "baselineInputSetSha256", "category",
  "sourceCompletenessSha256", "sourceCompletenessAttestationKey",
  "sourceCompletenessRuleVersion", "sourceCompletenessEvidenceCount",
  "equifaxSourceCompletenessEvidenceId", "experianSourceCompletenessEvidenceId",
  "transunionSourceCompletenessEvidenceId", "completedByActorId", "completedAt"
) VALUES (
  'completion-mixed-file', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-2a',
  1, repeat('9',64), 'MIXED_FILE_INDICATOR', repeat('7',64), 'complete-source', 'v1',
  3, 'round0-completeness-equifax-mixed_file_indicator',
  'round0-completeness-experian-mixed_file_indicator',
  'round0-completeness-transunion-mixed_file_indicator',
  'actor-1', now()
);

-- Exact account-index completeness evidence is independent of extraction
-- success. The empty successful run has three COMPLETE, zero-member rows; the
-- partial run has three PARTIAL rows and therefore cannot establish N/A.
BEGIN;
INSERT INTO "Round0SourceCompletenessEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "category", "status",
  "sourceMemberCount", "sourceMembershipSha256", "sourceLocatorToken",
  "integritySha256", "ruleKey", "ruleVersion"
) VALUES
  ('account-empty-completeness-equifax', 'p0-2a-direct', 'p0-2a-direct',
   'rv-2a', 'run-account-empty', 'EQUIFAX', 'COVERED', 'cov-empty-eq',
   'UNRECOGNIZED_ACCOUNT', 'COMPLETE', 0, repeat('a',64),
   'account-empty-locator-equifax', repeat('1',64), 'account-index-completeness', 'v1'),
  ('account-empty-completeness-experian', 'p0-2a-direct', 'p0-2a-direct',
   'rv-2a', 'run-account-empty', 'EXPERIAN', 'COVERED', 'cov-empty-ex',
   'UNRECOGNIZED_ACCOUNT', 'COMPLETE', 0, repeat('a',64),
   'account-empty-locator-experian', repeat('2',64), 'account-index-completeness', 'v1'),
  ('account-empty-completeness-transunion', 'p0-2a-direct', 'p0-2a-direct',
   'rv-2a', 'run-account-empty', 'TRANSUNION', 'COVERED', 'cov-empty-tu',
   'UNRECOGNIZED_ACCOUNT', 'COMPLETE', 0, repeat('a',64),
   'account-empty-locator-transunion', repeat('3',64), 'account-index-completeness', 'v1');

-- With exact COMPLETE, zero-member evidence for all three catalog bureaus and
-- no SOURCE_LISTED account, UNRECOGNIZED_ACCOUNT may be only category-level N/A.
INSERT INTO "IdentityCategoryCompletion" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
  "identityBaselineVersion", "baselineInputSetSha256", "category",
  "sourceCompletenessSha256", "sourceCompletenessAttestationKey",
  "sourceCompletenessRuleVersion", "sourceCompletenessEvidenceCount",
  "equifaxSourceCompletenessEvidenceId", "experianSourceCompletenessEvidenceId",
  "transunionSourceCompletenessEvidenceId", "completedByActorId", "completedAt"
) VALUES (
  'completion-unrecognized-none', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-account-empty', 'baseline-account-empty', 1, repeat('b',64), 'UNRECOGNIZED_ACCOUNT',
  repeat('a',64), 'complete-account-membership', 'v1', 3,
  'account-empty-completeness-equifax', 'account-empty-completeness-experian',
  'account-empty-completeness-transunion', 'actor-1', now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "IdentityCategoryCompletion"
    WHERE "id" = 'completion-unrecognized-none'
      AND "disposition" = 'NOT_APPLICABLE'
      AND "extractionRunId" = 'run-account-empty'
      AND "baselineInputSetSha256" = repeat('b',64)
      AND "sourceCompletenessEvidenceCount" = 3
  ) THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL exact no-account category completion';
  END IF;
END;
$$;
ROLLBACK;
SELECT 'P0_2A_ASSERT_PASS exact no-account category completion';

BEGIN;
INSERT INTO "Round0SourceCompletenessEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "category", "status",
  "sourceMemberCount", "sourceMembershipSha256", "sourceLocatorToken",
  "integritySha256", "ruleKey", "ruleVersion"
) VALUES
  ('account-partial-completeness-equifax', 'p0-2a-direct', 'p0-2a-direct',
   'rv-2a', 'run-date-partial', 'EQUIFAX', 'COVERED', 'cov-date-eq',
   'UNRECOGNIZED_ACCOUNT', 'PARTIAL', 0, repeat('b',64),
   'account-partial-locator-equifax', repeat('4',64), 'account-index-completeness', 'v1'),
  ('account-partial-completeness-experian', 'p0-2a-direct', 'p0-2a-direct',
   'rv-2a', 'run-date-partial', 'EXPERIAN', 'COVERED', 'cov-date-ex',
   'UNRECOGNIZED_ACCOUNT', 'PARTIAL', 0, repeat('b',64),
   'account-partial-locator-experian', repeat('5',64), 'account-index-completeness', 'v1'),
  ('account-partial-completeness-transunion', 'p0-2a-direct', 'p0-2a-direct',
   'rv-2a', 'run-date-partial', 'TRANSUNION', 'COVERED', 'cov-date-tu',
   'UNRECOGNIZED_ACCOUNT', 'PARTIAL', 0, repeat('b',64),
   'account-partial-locator-transunion', repeat('6',64), 'account-index-completeness', 'v1');

SELECT pg_temp.expect_sqlstate('partial extraction cannot establish no-account category', $q$
  INSERT INTO "IdentityCategoryCompletion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
    "identityBaselineVersion", "baselineInputSetSha256", "category",
    "sourceCompletenessSha256", "sourceCompletenessAttestationKey",
    "sourceCompletenessRuleVersion", "sourceCompletenessEvidenceCount",
    "equifaxSourceCompletenessEvidenceId", "experianSourceCompletenessEvidenceId",
    "transunionSourceCompletenessEvidenceId", "completedByActorId", "completedAt"
  ) VALUES (
    'completion-unrecognized-partial', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-date-partial', 'baseline-partial-2a', 1, repeat('c',64),
    'UNRECOGNIZED_ACCOUNT', repeat('b',64), 'partial-account-membership', 'v1', 3,
    'account-partial-completeness-equifax', 'account-partial-completeness-experian',
    'account-partial-completeness-transunion',
    'actor-1', now()
  )
$q$, '23514');
ROLLBACK;

INSERT INTO "IdentityCorrespondenceAssertion" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
  "identityBaselineVersion", "baselineInputSetSha256", "identityFactSeriesKey",
  "identityFactId", "identityFactClassification", "identityFactIntegritySha256",
  "factBureau", "factSourceLocatorToken", "correspondencePurposeCode",
  "assertionSeriesKey", "version", "status", "sourceSetSha256",
  "attestedByActorId", "attestedAt"
) VALUES (
  'identity-assertion-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-2a',
  1, repeat('9',64), 'identity-fact-series', 'identity-fact-2a',
  'CORRECT_CURRENT', repeat('8',64), 'EQUIFAX', 'source-name-1',
  'CORRESPONDENCE_SENDER_IDENTITY', 'identity-assertion-series', 1, 'ATTESTED',
  repeat('6',64), 'actor-1', now()
);

INSERT INTO "IdentityCorrespondenceAssertion" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
  "identityBaselineVersion", "baselineInputSetSha256", "identityFactSeriesKey",
  "identityFactId", "identityFactClassification", "identityFactIntegritySha256",
  "factBureau", "factSourceLocatorToken", "correspondencePurposeCode",
  "assertionSeriesKey", "version", "status", "sourceSetSha256",
  "attestedByActorId", "attestedAt"
) VALUES (
  'identity-correction-assertion-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-2a',
  1, repeat('9',64), 'identity-correction-series', 'identity-correction-2a',
  'INCORRECT', repeat('1',64), 'EQUIFAX', 'source-correction-1',
  'CORRESPONDENCE_IDENTITY_CORRECTION', 'identity-correction-assertion-series',
  1, 'ATTESTED', repeat('1',64), 'actor-1', now()
);

SELECT pg_temp.expect_sqlstate('correct current fact cannot become correction testimony', $q$
  INSERT INTO "IdentityCorrespondenceAssertion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
    "identityBaselineVersion", "baselineInputSetSha256", "identityFactSeriesKey",
    "identityFactId", "identityFactClassification", "identityFactIntegritySha256",
    "factBureau", "factSourceLocatorToken", "correspondencePurposeCode",
    "assertionSeriesKey", "version", "status", "sourceSetSha256",
    "attestedByActorId", "attestedAt"
  ) VALUES (
    'identity-current-correction-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-2a',
    1, repeat('9',64), 'identity-fact-series', 'identity-fact-2a',
    'CORRECT_CURRENT', repeat('8',64), 'EQUIFAX', 'source-name-1',
    'CORRESPONDENCE_IDENTITY_CORRECTION', 'identity-current-correction-bad-series',
    1, 'ATTESTED', repeat('6',64), 'actor-1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('accurate former address cannot become correction testimony', $q$
  INSERT INTO "IdentityCorrespondenceAssertion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
    "identityBaselineVersion", "baselineInputSetSha256", "identityFactSeriesKey",
    "identityFactId", "identityFactClassification", "identityFactIntegritySha256",
    "factBureau", "factSourceLocatorToken", "correspondencePurposeCode",
    "assertionSeriesKey", "version", "status", "sourceSetSha256",
    "attestedByActorId", "attestedAt"
  ) VALUES (
    'identity-former-correction-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-2a',
    1, repeat('9',64), 'identity-former-series', 'identity-former-2a',
    'CORRECT_FORMER', repeat('3',64), 'EQUIFAX', 'source-former-1',
    'CORRESPONDENCE_IDENTITY_CORRECTION', 'identity-former-correction-bad-series',
    1, 'ATTESTED', repeat('3',64), 'actor-1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('legitimate employment cannot become correction testimony', $q$
  INSERT INTO "IdentityCorrespondenceAssertion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
    "identityBaselineVersion", "baselineInputSetSha256", "identityFactSeriesKey",
    "identityFactId", "identityFactClassification", "identityFactIntegritySha256",
    "factBureau", "factSourceLocatorToken", "correspondencePurposeCode",
    "assertionSeriesKey", "version", "status", "sourceSetSha256",
    "attestedByActorId", "attestedAt"
  ) VALUES (
    'identity-employment-correction-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-2a',
    1, repeat('9',64), 'identity-employment-series', 'identity-employment-2a',
    'CORRECT_CURRENT', repeat('2',64), 'EQUIFAX', 'source-employment-1',
    'CORRESPONDENCE_IDENTITY_CORRECTION', 'identity-employment-correction-bad-series',
    1, 'ATTESTED', repeat('2',64), 'actor-1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('review-needed fact cannot become sender testimony', $q$
  INSERT INTO "IdentityCorrespondenceAssertion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
    "identityBaselineVersion", "baselineInputSetSha256", "identityFactSeriesKey",
    "identityFactId", "identityFactClassification", "identityFactIntegritySha256",
    "factBureau", "factSourceLocatorToken", "correspondencePurposeCode",
    "assertionSeriesKey", "version", "status", "sourceSetSha256",
    "attestedByActorId", "attestedAt"
  ) VALUES (
    'identity-review-sender-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-2a',
    1, repeat('9',64), 'identity-review-series', 'identity-review-2a',
    'REVIEW_NEEDED', repeat('0',64), 'EQUIFAX', 'source-review-1',
    'CORRESPONDENCE_SENDER_IDENTITY', 'identity-review-sender-bad-series',
    1, 'ATTESTED', repeat('0',64), 'actor-1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('parser uncertainty cannot become identity testimony', $q$
  INSERT INTO "IdentityCorrespondenceAssertion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
    "identityBaselineVersion", "baselineInputSetSha256", "identityFactSeriesKey",
    "identityFactId", "identityFactClassification", "identityFactIntegritySha256",
    "factBureau", "factSourceLocatorToken", "correspondencePurposeCode",
    "assertionSeriesKey", "version", "status", "sourceSetSha256",
    "attestedByActorId", "attestedAt"
  ) VALUES (
    'identity-uncertain-correction-bad', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'run-round0', 'baseline-2a', 1, repeat('9',64), 'identity-uncertain-series',
    'identity-uncertain-2a', 'INCORRECT', repeat('d',64), 'EQUIFAX',
    'source-uncertain-1', 'CORRESPONDENCE_IDENTITY_CORRECTION',
    'identity-uncertain-correction-bad-series', 1, 'ATTESTED', repeat('d',64),
    'actor-1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('identity assertion bureau substitution', $q$
  INSERT INTO "IdentityCorrespondenceAssertion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
    "identityBaselineVersion", "baselineInputSetSha256", "identityFactSeriesKey",
    "identityFactId", "identityFactClassification", "identityFactIntegritySha256",
    "factBureau", "factSourceLocatorToken", "correspondencePurposeCode",
    "assertionSeriesKey", "version", "status", "sourceSetSha256",
    "attestedByActorId", "attestedAt"
  ) VALUES (
    'identity-assertion-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-round0', 'baseline-2a',
    1, repeat('9',64), 'identity-fact-series', 'identity-fact-2a',
    'CORRECT_CURRENT', repeat('8',64), 'EXPERIAN', 'source-name-1',
    'CORRESPONDENCE_SENDER_IDENTITY', 'identity-assertion-bad-series', 1,
    'ATTESTED', repeat('6',64), 'actor-1', now()
  )
$q$, '23514');

-- H3: normalized consumer-only account recognition review. The account is a
-- source-listed v2 membership with one exact PRESENT observation on one bureau.
INSERT INTO "Account" (
  "id", "tenantId", "consumerId", "stableKey", "authorityStatus"
) VALUES (
  'account-review-1', 'p0-2a-direct', 'p0-2a-direct',
  'opaque-account-review-key-1', 'SHADOW_V2'
);

INSERT INTO "ReportVersionAccount" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
) VALUES (
  'report-account-review-1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'account-review-1', 0, 'SOURCE_LISTED', 'SHADOW_V2'
);

INSERT INTO "AccountPresenceObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
  "presence", "observationSeriesKey", "revision", "integritySha256",
  "sourceLocatorToken", "parserConfidence"
) VALUES (
  'account-presence-review-1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'account-review-1', 'run-round0', 'EQUIFAX', 'cov-round0-eq', 'COVERED',
  'PRESENT', 'account-presence-review-series-1', 1, repeat('5',64),
  'account-review-source-locator', 0.9800
);

SELECT pg_temp.expect_sqlstate('account-index completeness rejects omitted locator', $q$
  INSERT INTO "Round0SourceCompletenessEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "category", "status",
    "sourceMemberCount", "sourceMembershipSha256", "sourceLocatorToken",
    "integritySha256", "ruleKey", "ruleVersion"
  ) VALUES (
    'account-index-completeness-null-locator', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'run-round0', 'EQUIFAX', 'COVERED', 'cov-round0-eq',
    'UNRECOGNIZED_ACCOUNT', 'PARTIAL', 1, repeat('e',64), NULL,
    repeat('f',64), 'account-index-completeness', 'v1'
  )
$q$, '23514');

INSERT INTO "Round0SourceCompletenessEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "category", "status",
  "sourceMemberCount", "sourceMembershipSha256", "sourceLocatorToken",
  "integritySha256", "ruleKey", "ruleVersion"
) VALUES
  ('account-index-completeness-equifax', 'p0-2a-direct', 'p0-2a-direct',
   'rv-2a', 'run-round0', 'EQUIFAX', 'COVERED', 'cov-round0-eq',
   'UNRECOGNIZED_ACCOUNT', 'PARTIAL', 1, repeat('e',64),
   'account-index-completeness-locator-equifax', repeat('f',64),
   'account-index-completeness', 'v1'),
  ('account-index-completeness-experian', 'p0-2a-direct', 'p0-2a-direct',
   'rv-2a', 'run-round0', 'EXPERIAN', 'COVERED', 'cov-round0-ex',
   'UNRECOGNIZED_ACCOUNT', 'COMPLETE', 0, repeat('1',64),
   'account-index-completeness-locator-experian', repeat('2',64),
   'account-index-completeness', 'v1'),
  ('account-index-completeness-transunion', 'p0-2a-direct', 'p0-2a-direct',
   'rv-2a', 'run-round0', 'TRANSUNION', 'COVERED', 'cov-round0-tu',
   'UNRECOGNIZED_ACCOUNT', 'COMPLETE', 0, repeat('3',64),
   'account-index-completeness-locator-transunion', repeat('4',64),
   'account-index-completeness', 'v1');

SELECT pg_temp.expect_sqlstate('sealed account-index rejects later presence member', $q$
  INSERT INTO "AccountPresenceObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "accountId",
    "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
    "presence", "observationSeriesKey", "revision", "integritySha256",
    "sourceLocatorToken"
  ) VALUES (
    'account-presence-after-seal-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'account-review-1', 'run-round0', 'EQUIFAX', 'cov-round0-eq', 'COVERED',
    'PRESENT', 'account-presence-after-seal-series', 1, repeat('9',64),
    'account-presence-after-seal-locator'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('sealed account-index rejects later source-listed report account', $q$
  INSERT INTO "ReportVersionAccount" (
    "id", "tenantId", "consumerId", "reportVersionId", "accountId",
    "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
  ) VALUES (
    'report-account-after-seal-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'account-review-1', 99, 'SOURCE_LISTED', 'SHADOW_V2'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('source-listed account forbids not-applicable account category', $q$
  INSERT INTO "IdentityCategoryCompletion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId", "identityBaselineId",
    "identityBaselineVersion", "baselineInputSetSha256", "category",
    "sourceCompletenessSha256", "sourceCompletenessAttestationKey",
    "sourceCompletenessRuleVersion", "sourceCompletenessEvidenceCount",
    "equifaxSourceCompletenessEvidenceId", "experianSourceCompletenessEvidenceId",
    "transunionSourceCompletenessEvidenceId", "completedByActorId", "completedAt"
  ) VALUES (
    'completion-unrecognized-with-account', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'run-round0', 'baseline-2a', 1, repeat('9',64),
    'UNRECOGNIZED_ACCOUNT', repeat('a',64), 'complete-account-membership',
    'v1', 3, 'account-index-completeness-equifax',
    'account-index-completeness-experian', 'account-index-completeness-transunion',
    'actor-1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('account review cannot pin confirmed successor baseline', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) VALUES (
    'account-review-confirmed-baseline-bad', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'run-round0', 'baseline-2a', 1, repeat('9',64), 'EQUIFAX',
    'account-review-1', 'report-account-review-1', 'account-presence-review-1',
    1, repeat('5',64), 'account-review-source-locator',
    'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
    'account-review-series-1',
    1, 'UNRECOGNIZED', repeat('4',64), 'DIRECT_CONSUMER', 'auth-v1',
    'actor-1', now()
  )
$q$, '23514');

INSERT INTO "ConsumerAccountReviewReceipt" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256",
  "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
  "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
) VALUES (
  'account-review-receipt-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-round0', 'baseline-account-review-draft', 1, repeat('d',64), 'EQUIFAX',
  'account-review-1', 'report-account-review-1', 'account-presence-review-1',
  1, repeat('5',64), 'account-review-source-locator',
  'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
  'account-review-series-1',
  1, 'UNRECOGNIZED', repeat('4',64), 'DIRECT_CONSUMER', 'auth-v1',
  'actor-1', now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ConsumerAccountReviewReceipt"
    WHERE "id" = 'account-review-receipt-v1'
      AND "reviewState" = 'UNRECOGNIZED'
      AND "identityBaselineId" = 'baseline-account-review-draft'
      AND "extractionRunId" = 'run-round0'
      AND "baselineInputSetSha256" = repeat('d',64)
      AND "bureau" = 'EQUIFAX'
      AND "reportVersionAccountId" = 'report-account-review-1'
      AND "accountPresenceObservationId" = 'account-presence-review-1'
      AND "accountPresenceObservationRevision" = 1
      AND "accountPresenceIntegritySha256" = repeat('5',64)
      AND "accountPresenceSourceLocatorToken" = 'account-review-source-locator'
      AND "accountIndexCompletenessEvidenceId" = 'account-index-completeness-equifax'
      AND "accountIndexSourceMembershipSha256" = repeat('e',64)
      AND "accountIndexCompletenessIntegritySha256" = repeat('f',64)
      AND "authorizationKind" = 'DIRECT_CONSUMER'
  ) THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL exact unrecognized-account receipt readback';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ConsumerAccountReviewReceipt'
      AND lower(column_name) ~ '(fraud|identity.?theft|inaccura|unauthor|delet|violation|eligib|policy|legal|dispute|requested.?action|action.?code|action.?state)'
  ) THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL account review leaked inferred legal or action authority';
  END IF;

  IF EXISTS (SELECT 1 FROM "ConsumerAssertion")
     OR EXISTS (SELECT 1 FROM "CaseActionDecision") THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL unrecognized state inferred testimony or action eligibility';
  END IF;
END;
$$;
SELECT 'P0_2A_ASSERT_PASS exact bounded unrecognized-account receipt';

-- Independent current-head receipt used to prove the narrow Case Action
-- source bridge without relying on the supersession/revocation series below.
INSERT INTO "ConsumerAccountReviewReceipt" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
  "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
) VALUES (
  'account-review-action-source-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-round0', 'baseline-account-review-draft', 1, repeat('d',64), 'EQUIFAX',
  'account-review-1', 'report-account-review-1', 'account-presence-review-1',
  1, repeat('5',64), 'account-review-source-locator',
  'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
  'account-review-action-source-series', 1, 'UNRECOGNIZED', repeat('7',64),
  'DIRECT_CONSUMER', 'auth-v1', 'actor-1', now()
);

SELECT pg_temp.expect_sqlstate('non-consumer authority cannot establish account review', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) VALUES (
    'account-review-agency-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-round0', 'baseline-account-review-draft', 1, repeat('d',64), 'EQUIFAX',
    'account-review-1', 'report-account-review-1', 'account-presence-review-1',
    1, repeat('5',64), 'account-review-source-locator',
    'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
    'account-review-agency-series',
    1, 'UNRECOGNIZED', repeat('4',64), 'AGENCY_MANAGED_CLIENT', 'auth-agency-v1',
    'agency-actor-1', now()
  )
$q$, '42501');

SELECT pg_temp.expect_sqlstate('cross-tenant account review substitution', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) VALUES (
    'account-review-cross-tenant-bad', 'p0-2a-direct', 'p0-2a-foreign', 'rv-2a',
    'run-round0', 'baseline-account-review-draft', 1, repeat('d',64), 'EQUIFAX',
    'account-review-1', 'report-account-review-1', 'account-presence-review-1',
    1, repeat('5',64), 'account-review-source-locator',
    'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
    'account-review-cross-tenant-series',
    1, 'UNRECOGNIZED', repeat('4',64), 'DIRECT_CONSUMER', 'auth-v1',
    'actor-1', now()
  )
$q$, '42501');

SELECT pg_temp.expect_sqlstate('cross-bureau account review substitution', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) VALUES (
    'account-review-cross-bureau-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-round0', 'baseline-account-review-draft', 1, repeat('d',64), 'EXPERIAN',
    'account-review-1', 'report-account-review-1', 'account-presence-review-1',
    1, repeat('5',64), 'account-review-source-locator',
    'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
    'account-review-cross-bureau-series',
    1, 'UNRECOGNIZED', repeat('4',64), 'DIRECT_CONSUMER', 'auth-v1',
    'actor-1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('account review requires present source locator', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256",
  "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) VALUES (
    'account-review-null-locator-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-round0', 'baseline-account-review-draft', 1, repeat('d',64), 'EQUIFAX',
    'account-review-1', 'report-account-review-1', 'account-presence-review-1',
    1, repeat('5',64), NULL,
    'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
    'account-review-null-locator-series', 1,
    'UNRECOGNIZED', repeat('4',64), 'DIRECT_CONSUMER', 'auth-v1',
    'actor-1', now()
  )
$q$, '23514');

INSERT INTO "ConsumerAccountReviewReceipt" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256",
  "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
  "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt",
  "supersedesReviewId"
) VALUES (
  'account-review-receipt-v2', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-round0', 'baseline-account-review-draft', 1, repeat('d',64), 'EQUIFAX',
  'account-review-1', 'report-account-review-1', 'account-presence-review-1',
  1, repeat('5',64), 'account-review-source-locator',
  'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
  'account-review-series-1',
  2, 'RECOGNIZED', repeat('4',64), 'DIRECT_CONSUMER', 'auth-v2',
  'actor-1', now(), 'account-review-receipt-v1'
);

SELECT pg_temp.expect_sqlstate('account review supersession source substitution', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt",
    "supersedesReviewId"
  ) VALUES (
    'account-review-source-substitution-bad', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'run-round0', 'baseline-account-review-draft', 1, repeat('d',64),
    'EQUIFAX', 'account-review-1', 'report-account-review-1',
    'account-presence-review-1', 1, repeat('5',64), 'account-review-source-locator',
    'account-index-completeness-equifax', repeat('0',64), repeat('f',64),
    'account-review-series-1', 3, 'UNKNOWN', repeat('4',64), 'DIRECT_CONSUMER',
    'auth-v3', 'actor-1', now(), 'account-review-receipt-v2'
  )
$q$, '23514');

INSERT INTO "ConsumerAccountReviewReceipt" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256",
  "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
  "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt",
  "supersedesReviewId"
) VALUES (
  'account-review-receipt-v3', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-round0', 'baseline-account-review-draft', 1, repeat('d',64), 'EQUIFAX',
  'account-review-1', 'report-account-review-1', 'account-presence-review-1',
  1, repeat('5',64), 'account-review-source-locator',
  'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
  'account-review-series-1',
  3, 'REVOKED', repeat('4',64), 'DIRECT_CONSUMER', 'auth-v3',
  'actor-1', now(), 'account-review-receipt-v2'
);

SELECT pg_temp.expect_sqlstate('revoked account review is terminal', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256",
  "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt",
    "supersedesReviewId"
  ) VALUES (
    'account-review-after-revoke-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-round0', 'baseline-account-review-draft', 1, repeat('d',64), 'EQUIFAX',
    'account-review-1', 'report-account-review-1', 'account-presence-review-1',
    1, repeat('5',64), 'account-review-source-locator',
    'account-index-completeness-equifax', repeat('e',64), repeat('f',64),
    'account-review-series-1',
    4, 'DEFERRED', repeat('4',64), 'DIRECT_CONSUMER', 'auth-v4',
    'actor-1', now(), 'account-review-receipt-v3'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('account review mutation forbidden', $q$
  UPDATE "ConsumerAccountReviewReceipt"
  SET "reviewState" = 'UNKNOWN'
  WHERE "id" = 'account-review-receipt-v1'
$q$, '55000');

INSERT INTO "DisputeCase" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseKey", "status",
  "policyVersion", "createdByActorId", "updatedAt"
) VALUES (
  'case-2a', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-key-2a', 'DRAFT',
  'policy-v1', 'actor-1', now()
);

-- The bounded receipt may support only review/defer/no-action chronology. It
-- is an exact refs-only source, never fraud, correction, or policy authority.
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) VALUES (
  'account-review-decision-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-2a', 'account-review-decision-series', 1, 'PROPOSED',
  'REVIEW_ACCOUNT_FACT', 1, 1,
  encode(sha256(convert_to('[[' || '"CONSUMER_ACCOUNT_REVIEW","account-review-action-source-v1",1,"EQUIFAX","' || repeat('7',64) || '"' || ']]', 'UTF8')), 'hex'),
  'account-review-decision-idem-1', 'actor-1', now()
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'account-review-decision-source-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-2a', 'account-review-decision-v1', 'CONSUMER_ACCOUNT_REVIEW',
  'account-review-action-source-v1', 1, 'EQUIFAX', repeat('7',64), 0
);
COMMIT;
SELECT 'P0_2A_ASSERT_PASS bounded account-review action source';

BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) VALUES (
  'account-review-correction-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-2a', 'account-review-correction-bad-series', 1, 'PROPOSED',
  'REQUEST_ACCOUNT_CORRECTION', 1, 1,
  encode(sha256(convert_to('[[' || '"CONSUMER_ACCOUNT_REVIEW","account-review-action-source-v1",1,"EQUIFAX","' || repeat('7',64) || '"' || ']]', 'UTF8')), 'hex'),
  'account-review-correction-bad-idem', 'actor-1', now()
);
SELECT pg_temp.expect_sqlstate('unrecognized account cannot confer correction authority', $q$
  INSERT INTO "CaseActionSourceRef" (
    "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
    "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
  ) VALUES (
    'account-review-correction-bad-source', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'case-2a', 'account-review-correction-bad',
    'CONSUMER_ACCOUNT_REVIEW', 'account-review-action-source-v1', 1,
    'EQUIFAX', repeat('7',64), 0
  )
$q$, '23514');
ROLLBACK;

BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) VALUES (
  'account-review-stale-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-2a', 'account-review-stale-bad-series', 1, 'PROPOSED',
  'REVIEW_ACCOUNT_FACT', 1, 1,
  encode(sha256(convert_to('[[' || '"CONSUMER_ACCOUNT_REVIEW","account-review-receipt-v1",1,"EQUIFAX","' || repeat('4',64) || '"' || ']]', 'UTF8')), 'hex'),
  'account-review-stale-bad-idem', 'actor-1', now()
);
SELECT pg_temp.expect_sqlstate('case action rejects stale account review receipt', $q$
  INSERT INTO "CaseActionSourceRef" (
    "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
    "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
  ) VALUES (
    'account-review-stale-bad-source', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'case-2a', 'account-review-stale-bad', 'CONSUMER_ACCOUNT_REVIEW',
    'account-review-receipt-v1', 1, 'EQUIFAX', repeat('4',64), 0
  )
$q$, '23514');
ROLLBACK;

BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) VALUES (
  'decision-2a-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'decision-series-2a', 1, 'PROPOSED', 'REVIEW_IDENTITY_FACT', 1,
  1,
  encode(sha256(convert_to('[["IDENTITY_FACT","identity-fact-2a",1,"EQUIFAX","' || repeat('8',64) || '"]]', 'UTF8')), 'hex'),
  'decision-idem-1', 'actor-1', now()
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'decision-source-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'decision-2a-v1', 'IDENTITY_FACT', 'identity-fact-2a', 1, 'EQUIFAX',
  repeat('8',64), 0
);
COMMIT;

SELECT pg_temp.expect_sqlstate('post-commit case action source append', $q$
  INSERT INTO "CaseActionSourceRef" (
    "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
    "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
  ) VALUES (
    'decision-source-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
    'decision-2a-v1', 'IDENTITY_FACT', 'identity-fact-2a', 1, 'EXPERIAN',
    repeat('8',64), 1
  )
$q$, '55000');

\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) VALUES (
  'decision-count-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'decision-count-bad-series', 1, 'PROPOSED', 'REVIEW_IDENTITY_FACT', 1, 2,
  encode(sha256(convert_to('[["IDENTITY_FACT","identity-fact-2a",1,"EQUIFAX","' || repeat('8',64) || '"]]', 'UTF8')), 'hex'),
  'decision-count-bad-idem', 'actor-1', now()
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'decision-count-bad-source', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'decision-count-bad', 'IDENTITY_FACT', 'identity-fact-2a', 1, 'EQUIFAX',
  repeat('8',64), 0
);
COMMIT;
\set bad_count_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('bad source count wrong failure', 'SELECT 1', '23514')
WHERE :'bad_count_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS source count seal rejected [23514]'
WHERE :'bad_count_sqlstate' = '23514';

\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) VALUES (
  'decision-digest-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'decision-digest-bad-series', 1, 'PROPOSED', 'REVIEW_IDENTITY_FACT', 1, 1,
  repeat('f',64), 'decision-digest-bad-idem', 'actor-1', now()
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'decision-digest-bad-source', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'decision-digest-bad', 'IDENTITY_FACT', 'identity-fact-2a', 1, 'EQUIFAX',
  repeat('8',64), 0
);
COMMIT;
\set bad_digest_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('bad source digest wrong failure', 'SELECT 1', '23514')
WHERE :'bad_digest_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS canonical source digest rejected [23514]'
WHERE :'bad_digest_sqlstate' = '23514';

BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt", "supersedesDecisionId"
) VALUES (
  'decision-2a-v2', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'decision-series-2a', 2, 'CONSUMER_SELECTED', 'REVIEW_IDENTITY_FACT', 1,
  1,
  encode(sha256(convert_to('[["IDENTITY_FACT","identity-fact-2a",1,"EQUIFAX","' || repeat('8',64) || '"]]', 'UTF8')), 'hex'),
  'decision-idem-2', 'actor-1', now(), 'decision-2a-v1'
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'decision-source-v2', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'decision-2a-v2', 'IDENTITY_FACT', 'identity-fact-2a', 1, 'EQUIFAX',
  repeat('8',64), 0
);
COMMIT;

SELECT pg_temp.expect_sqlstate('case chronology cannot rewrite action code', $q$
  INSERT INTO "CaseActionDecision" (
    "id", "tenantId", "consumerId", "reportVersionId", "caseId",
    "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
    "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
    "recordedByActorId", "recordedAt", "supersedesDecisionId"
  ) VALUES (
    'decision-2a-v3-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
    'decision-series-2a', 3, 'DECLINED', 'TAKE_NO_ACTION', 1,
    1,
    encode(sha256(convert_to('[["IDENTITY_FACT","identity-fact-2a",1,"EQUIFAX","' || repeat('8',64) || '"]]', 'UTF8')), 'hex'),
    'decision-idem-3', 'actor-1', now(), 'decision-2a-v2'
  )
$q$, '23514');

-- A consumer-selected identity correction is accepted only when the exact
-- normalized source set contains a current correction assertion.
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) VALUES (
  'identity-correction-decision-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'identity-correction-decision-series', 1, 'PROPOSED',
  'REQUEST_IDENTITY_CORRECTION', 1, 1,
  encode(sha256(convert_to('[["IDENTITY_CORRESPONDENCE_ASSERTION","identity-correction-assertion-2a",1,"EQUIFAX","' || repeat('1',64) || '"]]', 'UTF8')), 'hex'),
  'identity-correction-decision-idem-1', 'actor-1', now()
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'identity-correction-source-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'identity-correction-decision-v1', 'IDENTITY_CORRESPONDENCE_ASSERTION',
  'identity-correction-assertion-2a', 1, 'EQUIFAX', repeat('1',64), 0
);
COMMIT;

BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt", "supersedesDecisionId"
) VALUES (
  'identity-correction-decision-v2', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'identity-correction-decision-series', 2, 'CONSUMER_SELECTED',
  'REQUEST_IDENTITY_CORRECTION', 1, 1,
  encode(sha256(convert_to('[["IDENTITY_CORRESPONDENCE_ASSERTION","identity-correction-assertion-2a",1,"EQUIFAX","' || repeat('1',64) || '"]]', 'UTF8')), 'hex'),
  'identity-correction-decision-idem-2', 'actor-1', now(),
  'identity-correction-decision-v1'
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'identity-correction-source-v2', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'identity-correction-decision-v2', 'IDENTITY_CORRESPONDENCE_ASSERTION',
  'identity-correction-assertion-2a', 1, 'EQUIFAX', repeat('1',64), 0
);
COMMIT;

-- A raw-machine-only proposal is allowed, but the same sealed source set
-- cannot advance to a consumer-selected correction.
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) VALUES (
  'raw-correction-decision-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'raw-correction-decision-series', 1, 'PROPOSED', 'REQUEST_IDENTITY_CORRECTION',
  1, 1,
  encode(sha256(convert_to('[["IDENTITY_FACT","identity-correction-2a",1,"EQUIFAX","' || repeat('1',64) || '"]]', 'UTF8')), 'hex'),
  'raw-correction-decision-idem-1', 'actor-1', now()
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'raw-correction-source-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'raw-correction-decision-v1', 'IDENTITY_FACT', 'identity-correction-2a', 1,
  'EQUIFAX', repeat('1',64), 0
);
COMMIT;

\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt", "supersedesDecisionId"
) VALUES (
  'raw-correction-decision-v2', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'raw-correction-decision-series', 2, 'CONSUMER_SELECTED',
  'REQUEST_IDENTITY_CORRECTION', 1, 1,
  encode(sha256(convert_to('[["IDENTITY_FACT","identity-correction-2a",1,"EQUIFAX","' || repeat('1',64) || '"]]', 'UTF8')), 'hex'),
  'raw-correction-decision-idem-2', 'actor-1', now(), 'raw-correction-decision-v1'
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'raw-correction-source-v2', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-2a',
  'raw-correction-decision-v2', 'IDENTITY_FACT', 'identity-correction-2a', 1,
  'EQUIFAX', repeat('1',64), 0
);
COMMIT;
\set raw_selected_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate(
  'raw selected correction wrong failure',
  'SELECT 1',
  '23514'
) WHERE :'raw_selected_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS raw selected correction rejected [23514]'
WHERE :'raw_selected_sqlstate' = '23514';

\endif

-- H1 closure: lossless bureau-specific report-date evidence and an independent
-- lexical score-model/type tuple. All rows below use exact bound inputs; the
-- separately created legacy run remains a negative control.
BEGIN;
INSERT INTO "ExtractionRun" (
  "id", "tenantId", "consumerId", "reportVersionId", "runKey", "attempt",
  "engine", "engineVersion", "schemaVersion", "normalizationVersion", "status",
  "startedAt", "completedAt", "inputArtifactId", "inputSha256",
  "inputRepresentation"
) VALUES
  ('run-h1-partial', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
   'run-key-h1-partial', 1, 'HYBRID_V2', 'v2', 'v2', 'v2', 'PARTIAL',
   now(), now(), 'source-artifact-2a', repeat('a',64), 'ORIGINAL_REPORT_BYTES'),
  ('run-h1-failed', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
   'run-key-h1-failed', 1, 'HYBRID_V2', 'v2', 'v2', 'v2', 'FAILED',
   now(), now(), 'source-artifact-2a', repeat('a',64), 'ORIGINAL_REPORT_BYTES'),
  ('run-old-exact-compatible', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
   'run-key-old-exact-compatible', 1, 'REGEX_V2', 'v1', 'v1', 'v1', 'SUCCEEDED',
   now(), now(), 'source-artifact-2a', repeat('a',64), 'ORIGINAL_REPORT_BYTES');

INSERT INTO "ExtractionBureauCoverage" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus"
) VALUES
  ('cov-h1-partial-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial', 'EQUIFAX', 'COVERED'),
  ('cov-h1-partial-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial', 'EXPERIAN', 'COVERED'),
  ('cov-h1-partial-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial', 'TRANSUNION', 'COVERED'),
  ('cov-h1-failed-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-failed', 'EQUIFAX', 'COVERED'),
  ('cov-h1-failed-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-failed', 'EXPERIAN', 'OUTSIDE_COVERAGE'),
  ('cov-h1-failed-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-failed', 'TRANSUNION', 'OUTSIDE_COVERAGE'),
  ('cov-old-exact-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-old-exact-compatible', 'EQUIFAX', 'COVERED'),
  ('cov-old-exact-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-old-exact-compatible', 'EXPERIAN', 'OUTSIDE_COVERAGE'),
  ('cov-old-exact-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-old-exact-compatible', 'TRANSUNION', 'OUTSIDE_COVERAGE');
COMMIT;

-- H1 is a deferred exact manifest: coverage, bureau dates, and score/model
-- evidence must become visible atomically. Neither a date-first nor a
-- score-first autocommit can be mistaken for a complete parser result.
BEGIN;
INSERT INTO "BureauReportDateEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
  "precision", "provenance", "sourceLocatorToken", "integritySha256"
) VALUES
  ('date-2a-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
   'EQUIFAX', 'COVERED', 'cov-2a-eq', 'PRESENT', '2026-08-10', 'DAY',
   'SOURCE_REPORTED', 'date-source-eq', repeat('1',64)),
  ('date-h1-month', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial',
   'EQUIFAX', 'COVERED', 'cov-h1-partial-eq', 'PRESENT', '2026-08', 'MONTH',
   'SOURCE_REPORTED', 'date-source-month', repeat('4',64)),
  ('date-h1-year', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial',
   'EXPERIAN', 'COVERED', 'cov-h1-partial-ex', 'PRESENT', '2026', 'YEAR',
   'SOURCE_REPORTED', 'date-source-year', repeat('5',64)),
  ('date-h1-not-provided', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial',
   'TRANSUNION', 'COVERED', 'cov-h1-partial-tu', 'EXPLICIT_NOT_PROVIDED', NULL,
   'UNKNOWN', 'EXPLICIT_NOT_PROVIDED', 'date-source-not-provided', repeat('6',64)),
  ('date-h1-failed-unknown', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-failed',
   'EQUIFAX', 'COVERED', 'cov-h1-failed-eq', 'UNKNOWN', NULL, 'UNKNOWN',
   'UNKNOWN', NULL, repeat('7',64));

SELECT pg_temp.expect_sqlstate('wrong-bureau report-date metadata substitution', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-wrong-bureau', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-old-exact-compatible', 'EQUIFAX', 'COVERED', 'cov-old-exact-ex',
    'PRESENT', '2026-08', 'MONTH',
    'SOURCE_REPORTED', 'date-wrong-bureau-locator', repeat('8',64)
  )
$q$, '23503');

SELECT pg_temp.expect_sqlstate('date precision fabrication rejected', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-fabricated-day', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial',
    'TRANSUNION', 'COVERED', 'cov-h1-partial-tu', 'PRESENT', '2026-08', 'DAY',
    'SOURCE_REPORTED', 'date-fabricated-locator', repeat('9',64)
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('present report date requires lexical value', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-present-without-value', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-h1-partial', 'EQUIFAX', 'COVERED', 'cov-h1-partial-eq', 'PRESENT', NULL,
    'MONTH', 'SOURCE_REPORTED', 'date-present-without-value-locator', repeat('9',64)
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('explicit absent report date requires locator', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-absent-without-locator', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-h1-partial', 'TRANSUNION', 'COVERED', 'cov-h1-partial-tu',
    'EXPLICIT_NOT_PROVIDED', NULL, 'UNKNOWN', 'EXPLICIT_NOT_PROVIDED', NULL,
    repeat('a',64)
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('legacy-run report-date metadata rejected', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-legacy-run', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-legacy-compatible', 'EQUIFAX', 'COVERED', 'cov-legacy-eq',
    'UNKNOWN', NULL, 'UNKNOWN', 'UNKNOWN', NULL, repeat('a',64)
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('failed explicit-absence report date rejected', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-failed-absent', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-failed',
    'EXPERIAN', 'OUTSIDE_COVERAGE', 'cov-h1-failed-ex', 'EXPLICIT_NOT_PROVIDED',
    NULL, 'UNKNOWN', 'EXPLICIT_NOT_PROVIDED', 'date-failed-absence', repeat('b',64)
  )
$q$, '23514');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "BureauReportDateEvidence"
    WHERE "id" = 'date-2a-eq' AND "sourceValue" = '2026-08-10'
      AND "precision" = 'DAY' AND "sourceLocatorToken" = 'date-source-eq'
  ) OR NOT EXISTS (
    SELECT 1 FROM "BureauReportDateEvidence"
    WHERE "id" = 'date-h1-month' AND "sourceValue" = '2026-08'
      AND "precision" = 'MONTH'
  ) OR NOT EXISTS (
    SELECT 1 FROM "BureauReportDateEvidence"
    WHERE "id" = 'date-h1-year' AND "sourceValue" = '2026'
      AND "precision" = 'YEAR'
  ) OR NOT EXISTS (
    SELECT 1 FROM "BureauReportDateEvidence"
    WHERE "id" = 'date-h1-not-provided'
      AND "presence" = 'EXPLICIT_NOT_PROVIDED'
      AND "sourceValue" IS NULL AND "precision" = 'UNKNOWN'
      AND "provenance" = 'EXPLICIT_NOT_PROVIDED'
      AND "sourceLocatorToken" = 'date-source-not-provided'
  ) OR NOT EXISTS (
    SELECT 1 FROM "BureauReportDateEvidence"
    WHERE "id" = 'date-h1-failed-unknown' AND "presence" = 'UNKNOWN'
      AND "sourceValue" IS NULL AND "sourceLocatorToken" IS NULL
  ) THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL lossless bureau report-date readback';
  END IF;
  RAISE NOTICE 'P0_2A_ASSERT_PASS lossless bureau report-date readback';
END;
$$;

-- A pre-2A exact-input writer may still append a score row with the new tuple
-- entirely NULL when no Phase 2A manifest adopts that run.
INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
  "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
  "occurrence", "idempotencyKey", "integritySha256", "modelMetadataCompleteness",
  "sourceMethodKey", "sourceMethodVersion", "sourceLocatorToken",
  "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
) VALUES (
  'score-old-exact-null-model', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-old-exact-compatible', 'EQUIFAX', 'COVERED', 'cov-old-exact-eq',
  'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN',
  'score-old-exact-null-model-series', 1, 0, 'score-old-exact-null-model-idem',
  repeat('c',64), 'UNKNOWN', 'parser-v1', 'v1', NULL, 'score-normalize', 'v1', now()
);

INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
  "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
  "occurrence", "idempotencyKey", "integritySha256", "scoreCiphertext",
  "scoreIv", "scoreAuthTag", "scoreKeyVersion", "scoreAlgorithm",
  "scoreEnvelopeVersion", "scoreAadVersion", "scoreModelPresence",
  "scoreModelEvidenceValue", "scoreModelSourceLocatorToken",
  "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion",
  "parserConfidence", "observedAt"
) VALUES (
  'score-model-lexical', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
  'EQUIFAX', 'COVERED', 'cov-2a-eq', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE',
  'SCORE_REPORTED', 'PARTIAL', 'score-model-lexical-series', 1, 0,
  'score-model-lexical-idem', repeat('d',64), decode('d1','hex'), decode('d2','hex'),
  decode('d3','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1', 'PRESENT',
  'FICO® Score 8', 'score-model-lexical-locator', 'UNKNOWN', 'HYBRID_V2', 'v2',
  'score-value-locator', 'score-normalize', 'v1', 0.9900, now()
);

INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
  "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
  "occurrence", "idempotencyKey", "integritySha256", "scoreCiphertext",
  "scoreIv", "scoreAuthTag", "scoreKeyVersion", "scoreAlgorithm",
  "scoreEnvelopeVersion", "scoreAadVersion", "scoreModelPresence",
  "scoreModelEvidenceValue", "scoreModelSourceLocatorToken",
  "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion",
  "parserConfidence", "observedAt"
) VALUES
  ('score-model-not-provided', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial',
   'EQUIFAX', 'COVERED', 'cov-h1-partial-eq', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE',
   'SCORE_NOT_PROVIDED', 'NOT_PROVIDED', 'score-model-not-provided-series', 1, 0,
   'score-model-not-provided-idem', repeat('e',64), NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, 'NOT_PROVIDED', NULL,
   'score-model-not-provided-locator', 'UNKNOWN', 'HYBRID_V2', 'v2',
   'score-explicit-not-provided-locator', 'score-normalize', 'v1', 0.9000, now()),
  ('score-unknown-model-present', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial',
   'EXPERIAN', 'COVERED', 'cov-h1-partial-ex', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE',
   'UNKNOWN', 'UNKNOWN', 'score-unknown-model-present-series', 1, 0,
   'score-unknown-model-present-idem', repeat('f',64), NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, 'PRESENT',
   'VantageScore® 4.0', 'score-unknown-model-present-locator', 'UNKNOWN',
   'HYBRID_V2', 'v2', NULL, 'score-normalize', 'v1', 0.5000, now()),
  ('score-unknown-model-unknown', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-partial',
   'TRANSUNION', 'COVERED', 'cov-h1-partial-tu', 'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE',
   'UNKNOWN', 'UNKNOWN', 'score-unknown-model-unknown-series', 1, 0,
   'score-unknown-model-unknown-idem', repeat('0',64), NULL, NULL, NULL, NULL, NULL,
   NULL, NULL, 'UNKNOWN', NULL, NULL,
   'UNKNOWN', 'HYBRID_V2', 'v2', NULL, 'score-normalize', 'v1', 0.0000, now()),
  ('score-certain-model-not-provided', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
   'run-2a', 'EQUIFAX', 'COVERED', 'cov-2a-eq', 'REPORT_DERIVED',
   'PRIMARY_REPORT_EVIDENCE', 'SCORE_REPORTED', 'PARTIAL',
   'score-certain-model-not-provided-series', 1, 1,
   'score-certain-model-not-provided-idem', repeat('2',64), decode('21','hex'),
   decode('22','hex'), decode('23','hex'), 'key-v1', 'AES_256_GCM', 'env-v1',
   'aad-v1', 'NOT_PROVIDED', NULL, 'score-certain-model-not-provided-locator',
   'UNKNOWN', 'HYBRID_V2', 'v2', 'score-certain-not-provided-value-locator',
   'score-normalize', 'v1', 0.9800, now()),
  ('score-certain-model-unknown', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
   'run-2a', 'EQUIFAX', 'COVERED', 'cov-2a-eq', 'REPORT_DERIVED',
   'PRIMARY_REPORT_EVIDENCE', 'SCORE_REPORTED', 'PARTIAL',
   'score-certain-model-unknown-series', 1, 2,
   'score-certain-model-unknown-idem', repeat('3',64), decode('31','hex'),
   decode('32','hex'), decode('33','hex'), 'key-v1', 'AES_256_GCM', 'env-v1',
   'aad-v1', 'UNKNOWN', NULL, NULL, 'UNKNOWN', 'HYBRID_V2', 'v2',
   'score-certain-unknown-value-locator', 'score-normalize', 'v1', 0.9700, now()),
  ('score-failed-unknown-model-unknown', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
   'run-h1-failed', 'EQUIFAX', 'COVERED', 'cov-h1-failed-eq', 'REPORT_DERIVED',
   'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN',
   'score-failed-unknown-model-unknown-series', 1, 0,
   'score-failed-unknown-model-unknown-idem', repeat('1',64), NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, 'UNKNOWN', NULL, NULL,
   'UNKNOWN', 'HYBRID_V2', 'v2', NULL, 'score-normalize', 'v1', 0.0000, now());

SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
SELECT 'P0_2A_ASSERT_PASS atomic H1 covered-bureau date and score manifest';

-- Exact manifest negatives are exercised at transaction end so each probe has
-- one isolated defect and cannot pass on date-first/score-first ordering.
\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "ExtractionRun" (
  "id", "tenantId", "consumerId", "reportVersionId", "runKey", "attempt",
  "engine", "engineVersion", "schemaVersion", "normalizationVersion", "status",
  "startedAt", "completedAt", "inputArtifactId", "inputSha256", "inputRepresentation"
) VALUES (
  'run-h1-missing-date', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-key-h1-missing-date', 1, 'HYBRID_V2', 'v2', 'v2', 'v2', 'SUCCEEDED',
  now(), now(), 'source-artifact-2a', repeat('a',64), 'ORIGINAL_REPORT_BYTES'
);
INSERT INTO "ExtractionBureauCoverage" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus"
) VALUES
  ('cov-h1-missing-date-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-date', 'EQUIFAX', 'COVERED'),
  ('cov-h1-missing-date-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-date', 'EXPERIAN', 'COVERED'),
  ('cov-h1-missing-date-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-date', 'TRANSUNION', 'OUTSIDE_COVERAGE');
INSERT INTO "BureauReportDateEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
  "precision", "provenance", "sourceLocatorToken", "integritySha256"
) VALUES (
  'date-h1-missing-date-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-h1-missing-date', 'EQUIFAX', 'COVERED', 'cov-h1-missing-date-eq',
  'UNKNOWN', NULL, 'UNKNOWN', 'UNKNOWN', NULL, repeat('4',64)
);
INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
  "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
  "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
  "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
) VALUES
  ('score-h1-missing-date-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-date',
   'EQUIFAX', 'COVERED', 'cov-h1-missing-date-eq', 'REPORT_DERIVED',
   'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN', 'score-h1-missing-date-eq-series',
   1, 0, 'score-h1-missing-date-eq-idem', repeat('5',64), 'UNKNOWN', 'UNKNOWN',
   'HYBRID_V2', 'v2', NULL, 'score-normalize', 'v1', now()),
  ('score-h1-missing-date-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-date',
   'EXPERIAN', 'COVERED', 'cov-h1-missing-date-ex', 'REPORT_DERIVED',
   'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN', 'score-h1-missing-date-ex-series',
   1, 0, 'score-h1-missing-date-ex-idem', repeat('6',64), 'UNKNOWN', 'UNKNOWN',
   'HYBRID_V2', 'v2', NULL, 'score-normalize', 'v1', now());
SET CONSTRAINTS ALL IMMEDIATE;
\set h1_missing_date_sqlstate :SQLSTATE
ROLLBACK;
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('covered bureau missing date wrong failure', 'SELECT 1', '23514')
WHERE :'h1_missing_date_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS bureau A date / bureau B omitted date rejected [23514]'
WHERE :'h1_missing_date_sqlstate' = '23514';

\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "ExtractionRun" (
  "id", "tenantId", "consumerId", "reportVersionId", "runKey", "attempt",
  "engine", "engineVersion", "schemaVersion", "normalizationVersion", "status",
  "startedAt", "completedAt", "inputArtifactId", "inputSha256", "inputRepresentation"
) VALUES (
  'run-h1-missing-score', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-key-h1-missing-score', 1, 'HYBRID_V2', 'v2', 'v2', 'v2', 'SUCCEEDED',
  now(), now(), 'source-artifact-2a', repeat('a',64), 'ORIGINAL_REPORT_BYTES'
);
INSERT INTO "ExtractionBureauCoverage" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus"
) VALUES
  ('cov-h1-missing-score-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-score', 'EQUIFAX', 'COVERED'),
  ('cov-h1-missing-score-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-score', 'EXPERIAN', 'COVERED'),
  ('cov-h1-missing-score-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-score', 'TRANSUNION', 'OUTSIDE_COVERAGE');
INSERT INTO "BureauReportDateEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
  "precision", "provenance", "sourceLocatorToken", "integritySha256"
) VALUES
  ('date-h1-missing-score-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-score',
   'EQUIFAX', 'COVERED', 'cov-h1-missing-score-eq', 'UNKNOWN', NULL, 'UNKNOWN',
   'UNKNOWN', NULL, repeat('7',64)),
  ('date-h1-missing-score-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-score',
   'EXPERIAN', 'COVERED', 'cov-h1-missing-score-ex', 'UNKNOWN', NULL, 'UNKNOWN',
   'UNKNOWN', NULL, repeat('8',64));
INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
  "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
  "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
  "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
) VALUES (
  'score-h1-missing-score-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-missing-score',
  'EQUIFAX', 'COVERED', 'cov-h1-missing-score-eq', 'REPORT_DERIVED',
  'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN', 'score-h1-missing-score-eq-series',
  1, 0, 'score-h1-missing-score-eq-idem', repeat('9',64), 'UNKNOWN', 'UNKNOWN',
  'HYBRID_V2', 'v2', NULL, 'score-normalize', 'v1', now()
);
SET CONSTRAINTS ALL IMMEDIATE;
\set h1_missing_score_sqlstate :SQLSTATE
ROLLBACK;
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('covered bureau missing score wrong failure', 'SELECT 1', '23514')
WHERE :'h1_missing_score_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS covered bureau omitted score sentinel rejected [23514]'
WHERE :'h1_missing_score_sqlstate' = '23514';

\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "ExtractionRun" (
  "id", "tenantId", "consumerId", "reportVersionId", "runKey", "attempt",
  "engine", "engineVersion", "schemaVersion", "normalizationVersion", "status",
  "startedAt", "completedAt", "inputArtifactId", "inputSha256", "inputRepresentation"
) VALUES (
  'run-h1-bad-sentinel-occurrence', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-key-h1-bad-sentinel-occurrence', 1, 'HYBRID_V2', 'v2', 'v2', 'v2',
  'SUCCEEDED', now(), now(), 'source-artifact-2a', repeat('a',64),
  'ORIGINAL_REPORT_BYTES'
);
INSERT INTO "ExtractionBureauCoverage" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus"
) VALUES
  ('cov-h1-bad-occ-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-bad-sentinel-occurrence', 'EQUIFAX', 'COVERED'),
  ('cov-h1-bad-occ-ex', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-bad-sentinel-occurrence', 'EXPERIAN', 'OUTSIDE_COVERAGE'),
  ('cov-h1-bad-occ-tu', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-bad-sentinel-occurrence', 'TRANSUNION', 'OUTSIDE_COVERAGE');
INSERT INTO "BureauReportDateEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
  "precision", "provenance", "sourceLocatorToken", "integritySha256"
) VALUES (
  'date-h1-bad-occ-eq', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-h1-bad-sentinel-occurrence', 'EQUIFAX', 'COVERED', 'cov-h1-bad-occ-eq',
  'UNKNOWN', NULL, 'UNKNOWN', 'UNKNOWN', NULL, repeat('a',64)
);
INSERT INTO "CreditScoreObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
  "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
  "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
  "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
) VALUES (
  'score-h1-bad-sentinel-occurrence', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-h1-bad-sentinel-occurrence', 'EQUIFAX', 'COVERED', 'cov-h1-bad-occ-eq',
  'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN',
  'score-h1-bad-sentinel-occurrence-series', 1, 1,
  'score-h1-bad-sentinel-occurrence-idem', repeat('b',64), 'UNKNOWN', 'UNKNOWN',
  'HYBRID_V2', 'v2', NULL, 'score-normalize', 'v1', now()
);
SET CONSTRAINTS ALL IMMEDIATE;
\set h1_bad_occurrence_sqlstate :SQLSTATE
ROLLBACK;
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('score sentinel nonzero occurrence wrong failure', 'SELECT 1', '23514')
WHERE :'h1_bad_occurrence_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS score sentinel occurrence must be zero [23514]'
WHERE :'h1_bad_occurrence_sqlstate' = '23514';

SELECT pg_temp.expect_sqlstate('outside-coverage report-date metadata rejected', $q$
  INSERT INTO "BureauReportDateEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "presence", "sourceValue",
    "precision", "provenance", "sourceLocatorToken", "integritySha256"
  ) VALUES (
    'date-outside-coverage', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
    'EXPERIAN', 'OUTSIDE_COVERAGE', 'cov-2a-ex', 'UNKNOWN', NULL, 'UNKNOWN',
    'UNKNOWN', NULL, repeat('c',64)
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('outside-coverage score metadata rejected', $q$
  INSERT INTO "CreditScoreObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
    "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
    "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
    "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
    "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
  ) VALUES (
    'score-outside-coverage', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
    'EXPERIAN', 'OUTSIDE_COVERAGE', 'cov-2a-ex', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN', 'score-outside-coverage-series',
    1, 0, 'score-outside-coverage-idem', repeat('d',64), 'UNKNOWN', 'UNKNOWN',
    'HYBRID_V2', 'v2', NULL, 'score-normalize', 'v1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('score extraction engine provenance substitution rejected', $q$
  INSERT INTO "CreditScoreObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
    "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
    "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
    "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
    "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
  ) VALUES (
    'score-provenance-substitution', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-2a', 'EQUIFAX', 'COVERED', 'cov-2a-eq', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN',
    'score-provenance-substitution-series', 1, 0,
    'score-provenance-substitution-idem', repeat('e',64), 'UNKNOWN', 'UNKNOWN',
    'REGEX_V2', 'v2', NULL, 'score-normalize', 'v1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_deferred_sqlstate(
  'exact-input score cannot omit model presence',
  $q$
    INSERT INTO "CreditScoreObservation" (
      "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
      "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
      "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
      "occurrence", "idempotencyKey", "integritySha256", "modelMetadataCompleteness",
      "sourceMethodKey", "sourceMethodVersion", "sourceLocatorToken",
      "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
    ) VALUES (
      'score-model-omitted', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
      'EQUIFAX', 'COVERED', 'cov-2a-eq', 'REPORT_DERIVED',
      'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN', 'score-model-omitted-series',
      1, 4, 'score-model-omitted-idem', repeat('2',64), 'UNKNOWN', 'parser-v2',
      'v2', NULL, 'score-normalize', 'v1', now()
    )
  $q$,
  'CreditScoreObservation_h1_run_metadata_deferred_trg',
  '23514'
);

SELECT pg_temp.expect_sqlstate('score-model lexical control character rejected', $q$
  INSERT INTO "CreditScoreObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
    "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
    "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
    "scoreModelEvidenceValue", "scoreModelSourceLocatorToken",
    "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
    "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion",
    "observedAt"
  ) VALUES (
    'score-model-control', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
    'EQUIFAX', 'COVERED', 'cov-2a-eq', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'UNKNOWN', 'UNKNOWN', 'score-model-control-series',
    1, 5, 'score-model-control-idem', repeat('3',64), 'PRESENT',
    E'FICO\nScore 8', 'score-model-control-locator', 'UNKNOWN', 'HYBRID_V2', 'v2',
    NULL, 'score-normalize', 'v1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('failed explicit-absence score model rejected', $q$
  INSERT INTO "CreditScoreObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
    "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
    "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
    "scoreModelSourceLocatorToken", "modelMetadataCompleteness",
    "sourceMethodKey", "sourceMethodVersion", "sourceLocatorToken",
    "normalizationRuleKey", "normalizationRuleVersion", "observedAt"
  ) VALUES (
    'score-failed-explicit-absence', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-h1-failed', 'EQUIFAX', 'COVERED', 'cov-h1-failed-eq', 'REPORT_DERIVED',
    'PRIMARY_REPORT_EVIDENCE', 'SCORE_NOT_PROVIDED', 'NOT_PROVIDED',
    'score-failed-explicit-absence-series', 1, 1,
    'score-failed-explicit-absence-idem', repeat('4',64), 'NOT_PROVIDED',
    'score-failed-model-absence-locator', 'UNKNOWN', 'HYBRID_V2', 'v2',
    'score-failed-absence-locator', 'score-normalize', 'v1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('score-model fabrication from not-provided rejected', $q$
  INSERT INTO "CreditScoreObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "bureau", "coverageStatus", "bureauCoverageId", "sourceType", "evidenceRole",
    "presence", "evidenceCompleteness", "observationSeriesKey", "revision",
    "occurrence", "idempotencyKey", "integritySha256", "scoreModelPresence",
    "scoreModelEvidenceValue", "scoreModelSourceLocatorToken",
    "modelMetadataCompleteness", "sourceMethodKey", "sourceMethodVersion",
    "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion",
    "observedAt"
  ) VALUES (
    'score-model-fabricated-not-provided', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'run-h1-partial', 'EQUIFAX', 'COVERED', 'cov-h1-partial-eq',
    'REPORT_DERIVED', 'PRIMARY_REPORT_EVIDENCE', 'SCORE_NOT_PROVIDED',
    'NOT_PROVIDED', 'score-model-fabricated-not-provided-series', 1, 0,
    'score-model-fabricated-not-provided-idem', repeat('5',64), 'NOT_PROVIDED',
    'Invented model', 'score-model-fabricated-not-provided-locator', 'UNKNOWN',
    'HYBRID_V2', 'v2', 'score-model-fabricated-score-locator',
    'score-normalize', 'v1', now()
  )
$q$, '23514');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-model-lexical'
      AND "scoreModelPresence" = 'PRESENT'
      AND "scoreModelEvidenceValue" = 'FICO® Score 8'
      AND "scoreModelSourceLocatorToken" = 'score-model-lexical-locator'
      AND "sourceMethodKey" = 'HYBRID_V2' AND "sourceMethodVersion" = 'v2'
      AND "scoreModelKey" IS NULL AND "scoreModelVersion" IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-model-not-provided'
      AND "presence" = 'SCORE_NOT_PROVIDED'
      AND "sourceLocatorToken" = 'score-explicit-not-provided-locator'
      AND "scoreModelPresence" = 'NOT_PROVIDED'
      AND "scoreModelEvidenceValue" IS NULL
      AND "scoreModelSourceLocatorToken" = 'score-model-not-provided-locator'
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-unknown-model-present' AND "presence" = 'UNKNOWN'
      AND "scoreModelPresence" = 'PRESENT'
      AND "scoreModelEvidenceValue" = 'VantageScore® 4.0'
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-unknown-model-unknown' AND "presence" = 'UNKNOWN'
      AND "scoreModelPresence" = 'UNKNOWN'
      AND "scoreModelSourceLocatorToken" IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-certain-model-not-provided'
      AND "presence" = 'SCORE_REPORTED'
      AND "scoreModelPresence" = 'NOT_PROVIDED'
      AND "scoreModelEvidenceValue" IS NULL
      AND "scoreModelSourceLocatorToken" = 'score-certain-model-not-provided-locator'
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-certain-model-unknown'
      AND "presence" = 'SCORE_REPORTED'
      AND "scoreModelPresence" = 'UNKNOWN'
      AND "scoreModelEvidenceValue" IS NULL
      AND "scoreModelSourceLocatorToken" IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM "CreditScoreObservation"
    WHERE "id" = 'score-old-exact-null-model'
      AND "scoreModelPresence" IS NULL
      AND "scoreModelEvidenceValue" IS NULL
  ) THEN
    RAISE EXCEPTION 'P0_2A_ASSERT_FAIL independent score-model readback';
  END IF;
  RAISE NOTICE 'P0_2A_ASSERT_PASS independent score-model readback';
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.account_review_source_sha(
  account_id TEXT,
  account_index_completeness_id TEXT,
  account_index_integrity_sha TEXT,
  account_index_membership_sha TEXT,
  account_presence_integrity_sha TEXT,
  account_presence_id TEXT,
  account_presence_revision INTEGER,
  account_presence_locator TEXT,
  baseline_input_sha TEXT,
  bureau_key TEXT,
  consumer_id TEXT,
  extraction_run_id TEXT,
  identity_baseline_id TEXT,
  identity_baseline_version INTEGER,
  report_version_account_id TEXT,
  report_version_id TEXT,
  tenant_id TEXT
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $fn$
  SELECT encode(
    sha256(convert_to(
      '{"accountId":' || to_json(account_id)::TEXT
      || ',"accountIndexCompletenessEvidenceId":' || to_json(account_index_completeness_id)::TEXT
      || ',"accountIndexCompletenessIntegritySha256":' || to_json(account_index_integrity_sha)::TEXT
      || ',"accountIndexSourceMembershipSha256":' || to_json(account_index_membership_sha)::TEXT
      || ',"accountPresenceIntegritySha256":' || to_json(account_presence_integrity_sha)::TEXT
      || ',"accountPresenceObservationId":' || to_json(account_presence_id)::TEXT
      || ',"accountPresenceObservationRevision":' || to_json(account_presence_revision)::TEXT
      || ',"accountPresenceSourceLocatorToken":' || to_json(account_presence_locator)::TEXT
      || ',"baselineInputSetSha256":' || to_json(baseline_input_sha)::TEXT
      || ',"bureau":' || to_json(bureau_key)::TEXT
      || ',"consumerId":' || to_json(consumer_id)::TEXT
      || ',"extractionRunId":' || to_json(extraction_run_id)::TEXT
      || ',"identityBaselineId":' || to_json(identity_baseline_id)::TEXT
      || ',"identityBaselineVersion":' || to_json(identity_baseline_version)::TEXT
      || ',"reportVersionAccountId":' || to_json(report_version_account_id)::TEXT
      || ',"reportVersionId":' || to_json(report_version_id)::TEXT
      || ',"tenantId":' || to_json(tenant_id)::TEXT
      || '}',
      'UTF8'
    )),
    'hex'
  );
$fn$;

-- FAILED extraction may preserve only an exact unbound 3x9 non-affirmative
-- completeness manifest. It never fabricates a DRAFT identity baseline.
BEGIN;
WITH catalog(category) AS (
  VALUES
    ('LEGAL_NAME'::"IdentityReviewCategory"),
    ('ALIAS'::"IdentityReviewCategory"),
    ('CURRENT_ADDRESS'::"IdentityReviewCategory"),
    ('FORMER_ADDRESS'::"IdentityReviewCategory"),
    ('SAFE_IDENTIFIER'::"IdentityReviewCategory"),
    ('PHONE'::"IdentityReviewCategory"),
    ('EMPLOYMENT'::"IdentityReviewCategory"),
    ('MIXED_FILE_INDICATOR'::"IdentityReviewCategory"),
    ('UNRECOGNIZED_ACCOUNT'::"IdentityReviewCategory")
), bureaus(bureau, coverage_status, coverage_id) AS (
  VALUES
    ('EQUIFAX'::"Bureau", 'COVERED'::"BureauCoverageStatus", 'cov-h1-failed-eq'),
    ('EXPERIAN'::"Bureau", 'OUTSIDE_COVERAGE'::"BureauCoverageStatus", 'cov-h1-failed-ex'),
    ('TRANSUNION'::"Bureau", 'OUTSIDE_COVERAGE'::"BureauCoverageStatus", 'cov-h1-failed-tu')
)
INSERT INTO "Round0SourceCompletenessEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "baselineInputSetSha256", "bureau", "coverageStatus",
  "bureauCoverageId", "category", "status", "sourceMemberCount",
  "sourceMembershipSha256", "sourceLocatorToken", "integritySha256",
  "ruleKey", "ruleVersion"
)
SELECT
  'failed-completeness-' || lower(bureau::TEXT) || '-' || lower(category::TEXT),
  'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-h1-failed', NULL, NULL,
  bureau, coverage_status, coverage_id, category, 'UNKNOWN', 0,
  encode(sha256(convert_to('failed-membership:' || bureau::TEXT || ':' || category::TEXT, 'UTF8')), 'hex'),
  NULL,
  encode(sha256(convert_to('failed-integrity:' || bureau::TEXT || ':' || category::TEXT, 'UTF8')), 'hex'),
  'round0-source-completeness', 'v1'
FROM catalog CROSS JOIN bureaus;
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
SELECT 'P0_2A_ASSERT_PASS failed extraction exact unbound uncertainty manifest';

-- H2 ordering and UNKNOWN-membership probe. Completeness is inserted before its
-- exact DRAFT baseline, and the deferred manifest closes successfully only
-- after the UNKNOWN account-presence member is appended in the same transaction.
BEGIN;
WITH catalog(category) AS (
  VALUES
    ('LEGAL_NAME'::"IdentityReviewCategory"),
    ('ALIAS'::"IdentityReviewCategory"),
    ('CURRENT_ADDRESS'::"IdentityReviewCategory"),
    ('FORMER_ADDRESS'::"IdentityReviewCategory"),
    ('SAFE_IDENTIFIER'::"IdentityReviewCategory"),
    ('PHONE'::"IdentityReviewCategory"),
    ('EMPLOYMENT'::"IdentityReviewCategory"),
    ('MIXED_FILE_INDICATOR'::"IdentityReviewCategory"),
    ('UNRECOGNIZED_ACCOUNT'::"IdentityReviewCategory")
), bureaus(bureau, coverage_status, coverage_id) AS (
  VALUES
    ('EQUIFAX'::"Bureau", 'COVERED'::"BureauCoverageStatus", 'cov-2a-eq'),
    ('EXPERIAN'::"Bureau", 'OUTSIDE_COVERAGE'::"BureauCoverageStatus", 'cov-2a-ex'),
    ('TRANSUNION'::"Bureau", 'OUTSIDE_COVERAGE'::"BureauCoverageStatus", 'cov-2a-tu')
)
INSERT INTO "Round0SourceCompletenessEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "baselineInputSetSha256", "bureau", "coverageStatus",
  "bureauCoverageId", "category", "status", "sourceMemberCount",
  "sourceMembershipSha256", "sourceLocatorToken", "integritySha256",
  "ruleKey", "ruleVersion"
)
SELECT
  'probe-completeness-' || lower(bureau::TEXT) || '-' || lower(category::TEXT),
  'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
  'baseline-unknown-probe', repeat('7',64), bureau, coverage_status, coverage_id,
  category,
  CASE WHEN coverage_status = 'COVERED' THEN 'COMPLETE'::"SectionExtractionStatus"
       ELSE 'NOT_PROVIDED'::"SectionExtractionStatus" END,
  CASE WHEN bureau = 'EQUIFAX' AND category = 'UNRECOGNIZED_ACCOUNT' THEN 1 ELSE 0 END,
  encode(sha256(convert_to('probe-membership:' || bureau::TEXT || ':' || category::TEXT, 'UTF8')), 'hex'),
  CASE WHEN coverage_status = 'COVERED' THEN 'probe-source:' || lower(category::TEXT) ELSE NULL END,
  encode(sha256(convert_to('probe-integrity:' || bureau::TEXT || ':' || category::TEXT, 'UTF8')), 'hex'),
  'round0-source-completeness', 'v1'
FROM catalog CROSS JOIN bureaus;

INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "reportIngestionId", "baselineSeriesKey", "version", "status",
  "policyVersion", "inputSetSha256", "createdByActorId"
) VALUES (
  'baseline-unknown-probe', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
  'ing-1', 'baseline-unknown-probe-series', 1, 'DRAFT',
  'p0-round0-source-review-v1', repeat('7',64), 'actor-1'
);

INSERT INTO "Account" (
  "id", "tenantId", "consumerId", "stableKey", "authorityStatus"
) VALUES (
  'account-unknown-probe', 'p0-2a-direct', 'p0-2a-direct',
  'account-unknown-probe-stable', 'SHADOW_V2'
);
INSERT INTO "ReportVersionAccount" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
) VALUES (
  'report-account-unknown-probe', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'account-unknown-probe', 0, 'SOURCE_LISTED', 'SHADOW_V2'
);
INSERT INTO "AccountPresenceObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
  "presence", "observationSeriesKey", "revision", "integritySha256",
  "sourceLocatorToken", "parserConfidence"
) VALUES (
  'presence-unknown-probe', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'account-unknown-probe', 'run-2a', 'EQUIFAX', 'cov-2a-eq', 'COVERED',
  'UNKNOWN', 'presence-unknown-probe-series', 1, repeat('8',64),
  'presence-unknown-probe-locator', 0.4000
);

SET CONSTRAINTS ALL IMMEDIATE;
SELECT 'P0_2A_ASSERT_PASS completeness before baseline insertion order';
SELECT 'P0_2A_ASSERT_PASS UNKNOWN account presence retained in DRAFT source membership';

SELECT pg_temp.expect_sqlstate('same-xact post-SET source IdentityFact append rejected', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
    "bureau", "factType", "classification", "reviewCategory", "integritySha256",
    "presence", "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion"
  ) VALUES (
    'identity-post-set-source-extra', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'baseline-unknown-probe', 'run-2a', repeat('7',64),
    'identity-post-set-source-extra-series', 1, 'EQUIFAX', 'NAME',
    'REVIEW_NEEDED', 'ALIAS', repeat('1',64), 'UNKNOWN',
    'identity-post-set-source-extra-locator', 'identity-normalize', 'v1'
  )
$q$, '23514');

INSERT INTO "Account" (
  "id", "tenantId", "consumerId", "stableKey", "authorityStatus"
) VALUES
  ('account-post-set-pair', 'p0-2a-direct', 'p0-2a-direct',
   'account-post-set-pair-stable', 'SHADOW_V2'),
  ('account-post-set-rva-only', 'p0-2a-direct', 'p0-2a-direct',
   'account-post-set-rva-only-stable', 'SHADOW_V2');

SELECT pg_temp.expect_sqlstate('same-xact post-SET counted account membership append rejected', $q$
  WITH appended_account AS (
    INSERT INTO "ReportVersionAccount" (
      "id", "tenantId", "consumerId", "reportVersionId", "accountId",
      "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
    ) VALUES (
      'report-account-post-set-pair', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
      'account-post-set-pair', 1, 'SOURCE_LISTED', 'SHADOW_V2'
    )
    RETURNING "tenantId", "consumerId", "reportVersionId", "accountId"
  )
  INSERT INTO "AccountPresenceObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "accountId",
    "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
    "presence", "observationSeriesKey", "revision", "integritySha256",
    "sourceLocatorToken", "parserConfidence"
  ) SELECT
    'presence-post-set-pair', "tenantId", "consumerId", "reportVersionId",
    "accountId", 'run-2a', 'EQUIFAX', 'cov-2a-eq', 'COVERED', 'PRESENT',
    'presence-post-set-pair-series', 1, repeat('2',64),
    'presence-post-set-pair-locator', 0.9900
  FROM appended_account
$q$, '23514');

SELECT pg_temp.expect_sqlstate('same-xact post-SET source-listed report account append rejected', $q$
  INSERT INTO "ReportVersionAccount" (
    "id", "tenantId", "consumerId", "reportVersionId", "accountId",
    "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
  ) VALUES (
    'report-account-post-set-rva-only', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'account-post-set-rva-only', 2, 'SOURCE_LISTED', 'SHADOW_V2'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('UNKNOWN account presence cannot establish consumer account review', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) SELECT
    'review-unknown-probe', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
    'baseline-unknown-probe', 1, repeat('7',64), 'EQUIFAX',
    'account-unknown-probe', 'report-account-unknown-probe',
    'presence-unknown-probe', 1, repeat('8',64), 'presence-unknown-probe-locator',
    'probe-completeness-equifax-unrecognized_account',
    encode(sha256(convert_to('probe-membership:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
    encode(sha256(convert_to('probe-integrity:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
    digest,
    'round0_account_review_' || left(digest, 40),
    1, 'UNRECOGNIZED', digest, 'DIRECT_CONSUMER', 'auth-v1', 'actor-1', now()
  FROM (
    SELECT pg_temp.account_review_source_sha(
      'account-unknown-probe',
      'probe-completeness-equifax-unrecognized_account',
      encode(sha256(convert_to('probe-integrity:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
      encode(sha256(convert_to('probe-membership:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
      repeat('8',64), 'presence-unknown-probe', 1,
      'presence-unknown-probe-locator', repeat('7',64), 'EQUIFAX',
      'p0-2a-direct', 'run-2a', 'baseline-unknown-probe', 1,
      'report-account-unknown-probe', 'rv-2a', 'p0-2a-direct'
    ) AS digest
  ) exact_source
$q$, '23514');
ROLLBACK;

-- H2 canonical source snapshot in baseline -> facts/accounts -> completeness
-- order. The same deferred validators admit both insertion orders but never an
-- incomplete commit.
BEGIN;
INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "reportIngestionId", "baselineSeriesKey", "version", "status",
  "policyVersion", "inputSetSha256", "createdByActorId"
) VALUES (
  'baseline-round0-draft', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
  'ing-1', 'baseline-round0-series', 1, 'DRAFT',
  'p0-round0-source-review-v1', repeat('9',64), 'actor-1'
);

INSERT INTO "IdentityFact" (
  "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
  "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
  "bureau", "factType", "classification", "reviewCategory", "integritySha256",
  "presence", "valueCiphertext", "valueIv", "valueAuthTag", "valueKeyVersion",
  "valueAlgorithm", "valueEnvelopeVersion", "valueAadVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion"
) VALUES (
  'identity-fact-draft-legal', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'baseline-round0-draft', 'run-2a', repeat('9',64), 'identity-legal-series', 0,
  'EQUIFAX', 'NAME', 'REVIEW_NEEDED', 'LEGAL_NAME', repeat('a',64), 'PRESENT',
  decode('a1','hex'), decode('a2','hex'), decode('a3','hex'), 'key-v1',
  'AES_256_GCM', 'env-v1', 'aad-v1', 'identity-legal-source',
  'identity-normalize', 'v1'
);

INSERT INTO "Account" (
  "id", "tenantId", "consumerId", "stableKey", "authorityStatus"
) VALUES (
  'account-round0-present', 'p0-2a-direct', 'p0-2a-direct',
  'account-round0-present-stable', 'SHADOW_V2'
);
INSERT INTO "ReportVersionAccount" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "sourceAccountOrdinal", "membershipOrigin", "authorityStatus"
) VALUES (
  'report-account-round0-present', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'account-round0-present', 0, 'SOURCE_LISTED', 'SHADOW_V2'
);
INSERT INTO "AccountPresenceObservation" (
  "id", "tenantId", "consumerId", "reportVersionId", "accountId",
  "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
  "presence", "observationSeriesKey", "revision", "integritySha256",
  "sourceLocatorToken", "parserConfidence"
) VALUES (
  'presence-round0-present', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'account-round0-present', 'run-2a', 'EQUIFAX', 'cov-2a-eq', 'COVERED',
  'PRESENT', 'presence-round0-present-series', 1, repeat('b',64),
  'presence-round0-present-locator', 0.9900
);

WITH catalog(category) AS (
  VALUES
    ('LEGAL_NAME'::"IdentityReviewCategory"),
    ('ALIAS'::"IdentityReviewCategory"),
    ('CURRENT_ADDRESS'::"IdentityReviewCategory"),
    ('FORMER_ADDRESS'::"IdentityReviewCategory"),
    ('SAFE_IDENTIFIER'::"IdentityReviewCategory"),
    ('PHONE'::"IdentityReviewCategory"),
    ('EMPLOYMENT'::"IdentityReviewCategory"),
    ('MIXED_FILE_INDICATOR'::"IdentityReviewCategory"),
    ('UNRECOGNIZED_ACCOUNT'::"IdentityReviewCategory")
), bureaus(bureau, coverage_status, coverage_id) AS (
  VALUES
    ('EQUIFAX'::"Bureau", 'COVERED'::"BureauCoverageStatus", 'cov-2a-eq'),
    ('EXPERIAN'::"Bureau", 'OUTSIDE_COVERAGE'::"BureauCoverageStatus", 'cov-2a-ex'),
    ('TRANSUNION'::"Bureau", 'OUTSIDE_COVERAGE'::"BureauCoverageStatus", 'cov-2a-tu')
)
INSERT INTO "Round0SourceCompletenessEvidence" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "baselineInputSetSha256", "bureau", "coverageStatus",
  "bureauCoverageId", "category", "status", "sourceMemberCount",
  "sourceMembershipSha256", "sourceLocatorToken", "integritySha256",
  "ruleKey", "ruleVersion"
)
SELECT
  'round0-completeness-' || lower(bureau::TEXT) || '-' || lower(category::TEXT),
  'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
  'baseline-round0-draft', repeat('9',64), bureau, coverage_status, coverage_id,
  category,
  CASE WHEN coverage_status = 'COVERED' THEN 'COMPLETE'::"SectionExtractionStatus"
       ELSE 'NOT_PROVIDED'::"SectionExtractionStatus" END,
  CASE
    WHEN bureau = 'EQUIFAX' AND category IN ('LEGAL_NAME', 'UNRECOGNIZED_ACCOUNT') THEN 1
    ELSE 0
  END,
  encode(sha256(convert_to('round0-membership:' || bureau::TEXT || ':' || category::TEXT, 'UTF8')), 'hex'),
  CASE WHEN coverage_status = 'COVERED' THEN 'round0-source:' || lower(category::TEXT) ELSE NULL END,
  encode(sha256(convert_to('round0-integrity:' || bureau::TEXT || ':' || category::TEXT, 'UTF8')), 'hex'),
  'round0-source-completeness', 'v1'
FROM catalog CROSS JOIN bureaus;

SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
SELECT 'P0_2A_ASSERT_PASS baseline then facts then completeness insertion order';
SELECT 'P0_2A_ASSERT_PASS exact identity completeness catalog';

DO $$
DECLARE
  observed_state TEXT;
  observed_run_id TEXT;
BEGIN
  SELECT "state"::TEXT, "extractionRunId"
    INTO observed_state, observed_run_id
  FROM "ReportIngestion"
  WHERE "id" = 'ing-1';

  IF observed_state <> 'EXTRACTING' OR observed_run_id IS NOT NULL THEN
    RAISE EXCEPTION 'DRAFT fixture did not preserve runtime EXTRACTING chronology';
  END IF;
END;
$$;
SELECT 'P0_2A_ASSERT_PASS DRAFT persists while ingestion EXTRACTING with unpinned result';

CREATE OR REPLACE FUNCTION pg_temp.insert_round0_confirmation_probe(
  probe_id TEXT,
  probe_run_id TEXT,
  probe_source_baseline_id TEXT,
  probe_series_key TEXT,
  probe_input_set_sha256 TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "IdentityBaseline" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "reportIngestionId", "sourceIdentityBaselineId",
    "supersedesIdentityBaselineId", "semanticSha256",
    "expectedIdentityFactCount", "expectedCategoryCompletionCount",
    "expectedAccountReviewReceiptCount", "baselineSeriesKey", "version",
    "status", "policyVersion", "inputSetSha256", "confirmedByActorId",
    "confirmedAt", "createdByActorId"
  ) VALUES (
    probe_id, 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', probe_run_id, 'ing-1', probe_source_baseline_id,
    probe_source_baseline_id, repeat('0',64), 1, 7, 1,
    probe_series_key, 2, 'CONFIRMED',
    'p0-round0-source-review-v1', probe_input_set_sha256,
    'actor-1', now(), 'actor-1'
  );
END;
$$;

SELECT pg_temp.expect_sqlstate('premature confirmation while ingestion EXTRACTING rejected', $q$
  SELECT pg_temp.insert_round0_confirmation_probe(
    'baseline-confirmation-at-extracting', 'run-2a',
    'baseline-round0-draft', 'baseline-round0-series', repeat('9',64)
  )
$q$, '23514');

BEGIN;
INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "reportIngestionId", "baselineSeriesKey", "version", "status",
  "policyVersion", "inputSetSha256", "createdByActorId"
) VALUES (
  'baseline-partial-readiness-draft', 'p0-2a-direct', 'p0-2a-direct',
  'rv-2a', 'run-h1-partial', 'ing-1', 'baseline-partial-readiness-series', 1,
  'DRAFT', 'p0-round0-source-review-v1', repeat('5',64), 'actor-1'
);
UPDATE "ReportIngestion" SET
  "state" = 'PARTIAL',
  "safeFailureCode" = NULL,
  "extractionRunId" = 'run-h1-partial',
  "revision" = 6,
  "updatedAt" = now()
WHERE "id" = 'ing-1'
  AND "revision" = 5
  AND "leaseToken" = 'lease-ing-1'
  AND "leaseOwnerId" = 'worker-1';
SELECT pg_temp.expect_sqlstate('premature confirmation while ingestion PARTIAL rejected', $q$
  SELECT pg_temp.insert_round0_confirmation_probe(
    'baseline-confirmation-at-partial', 'run-h1-partial',
    'baseline-partial-readiness-draft', 'baseline-partial-readiness-series',
    repeat('5',64)
  )
$q$, '23514');
ROLLBACK;

-- The repository pins the verified extraction receipt only after the DRAFT
-- source batch has committed. The exact live lease remains held through
-- assessment and is released only at ROUND0_READY.
UPDATE "ReportIngestion" SET
  "state" = 'SUCCEEDED',
  "safeFailureCode" = NULL,
  "extractionRunId" = 'run-2a',
  "revision" = 6,
  "updatedAt" = now()
WHERE "id" = 'ing-1'
  AND "revision" = 5
  AND "leaseToken" = 'lease-ing-1'
  AND "leaseOwnerId" = 'worker-1';

SELECT 'P0_2A_ASSERT_PASS extraction result pins exact run after DRAFT persistence';
SELECT 'P0_2A_ASSERT_PASS extraction result retains live lease for assessment';
SELECT pg_temp.expect_sqlstate('premature confirmation while ingestion SUCCEEDED rejected', $q$
  SELECT pg_temp.insert_round0_confirmation_probe(
    'baseline-confirmation-at-succeeded', 'run-2a',
    'baseline-round0-draft', 'baseline-round0-series', repeat('9',64)
  )
$q$, '23514');

UPDATE "ReportIngestion" SET
  "state" = 'ASSESSED',
  "safeFailureCode" = NULL,
  "revision" = 7,
  "updatedAt" = now()
WHERE "id" = 'ing-1'
  AND "revision" = 6
  AND "leaseToken" = 'lease-ing-1'
  AND "leaseOwnerId" = 'worker-1';
SELECT pg_temp.expect_sqlstate('premature confirmation while ingestion ASSESSED rejected', $q$
  SELECT pg_temp.insert_round0_confirmation_probe(
    'baseline-confirmation-at-assessed', 'run-2a',
    'baseline-round0-draft', 'baseline-round0-series', repeat('9',64)
  )
$q$, '23514');
UPDATE "ReportIngestion" SET
  "state" = 'ROUND0_READY',
  "leaseToken" = NULL,
  "leaseOwnerId" = NULL,
  "leaseExpiresAt" = NULL,
  "revision" = 8,
  "updatedAt" = now()
WHERE "id" = 'ing-1'
  AND "revision" = 7
  AND "leaseToken" = 'lease-ing-1'
  AND "leaseOwnerId" = 'worker-1';

SELECT pg_temp.expect_sqlstate('late DRAFT after terminal ingestion rejected', $q$
  INSERT INTO "IdentityBaseline" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "reportIngestionId", "baselineSeriesKey", "version", "status",
    "policyVersion", "inputSetSha256", "createdByActorId"
  ) VALUES (
    'baseline-late-draft', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-2a', 'ing-1', 'baseline-late-draft-series', 1, 'DRAFT',
    'p0-round0-source-review-v1', repeat('4',64), 'actor-1'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('sealed identity category rejects later source member', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
    "bureau", "factType", "classification", "reviewCategory", "integritySha256",
    "presence", "sourceLocatorToken", "normalizationRuleKey",
    "normalizationRuleVersion"
  ) VALUES (
    'identity-fact-after-seal', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'baseline-round0-draft', 'run-2a', repeat('9',64), 'identity-alias-after-seal',
    1, 'EQUIFAX', 'NAME', 'REVIEW_NEEDED', 'ALIAS', repeat('c',64), 'UNKNOWN',
    'identity-alias-after-seal-source', 'identity-normalize', 'v1'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('sealed account-index rejects later presence member', $q$
  INSERT INTO "AccountPresenceObservation" (
    "id", "tenantId", "consumerId", "reportVersionId", "accountId",
    "extractionRunId", "bureau", "bureauCoverageId", "coverageStatus",
    "presence", "observationSeriesKey", "revision", "integritySha256",
    "sourceLocatorToken"
  ) VALUES (
    'presence-after-seal', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'account-round0-present', 'run-2a', 'EQUIFAX', 'cov-2a-eq', 'COVERED',
    'PRESENT', 'presence-after-seal-series', 1, repeat('d',64),
    'presence-after-seal-locator'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('IdentityFact all-null Phase2 tuple rejected', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "factSeriesKey", "factOrdinal", "bureau", "factType", "classification",
    "presence", "sourceLocatorToken", "normalizationRuleKey",
    "normalizationRuleVersion"
  ) VALUES (
    'identity-fact-unsealed-p0', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'baseline-round0-draft', 'identity-unsealed-series', 1, 'EQUIFAX', 'NAME',
    'REVIEW_NEEDED', 'UNKNOWN', 'identity-unsealed-source', 'identity-normalize', 'v1'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('ABSENT_CONFIRMED Phase2 IdentityFact rejected', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
    "bureau", "factType", "classification", "reviewCategory", "integritySha256",
    "presence", "sourceLocatorToken", "normalizationRuleKey",
    "normalizationRuleVersion"
  ) VALUES (
    'identity-fact-absent-confirmed', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'baseline-round0-draft', 'run-2a', repeat('9',64),
    'identity-absent-confirmed-series', 1, 'EQUIFAX', 'NAME', 'REVIEW_NEEDED',
    'ALIAS', repeat('d',64), 'ABSENT_CONFIRMED', 'identity-absent-source',
    'identity-normalize', 'v1'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('Round 0 report ingestion substitution rejected', $q$
  INSERT INTO "IdentityBaseline" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "reportIngestionId", "baselineSeriesKey", "version", "status",
    "policyVersion", "inputSetSha256", "createdByActorId"
  ) VALUES (
    'baseline-ingestion-substitution', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-2a', 'ing-live-release', 'baseline-ingestion-substitution-series', 1,
    'DRAFT', 'p0-round0-source-review-v1', repeat('e',64), 'actor-1'
  )
$q$, '23514');

-- H3 begins only after the exact DRAFT source snapshot is committed. The
-- receipt records bounded consumer recognition state and no fraud, accuracy,
-- dispute, deletion, policy, or legal conclusion.
INSERT INTO "ConsumerAccountReviewReceipt" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
  "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
  "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
) SELECT
  'account-review-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
  'baseline-round0-draft', 1, repeat('9',64), 'EQUIFAX',
  'account-round0-present', 'report-account-round0-present',
  'presence-round0-present', 1, repeat('b',64), 'presence-round0-present-locator',
  'round0-completeness-equifax-unrecognized_account',
  encode(sha256(convert_to('round0-membership:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
  encode(sha256(convert_to('round0-integrity:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
  digest, 'round0_account_review_' || left(digest, 40), 1, 'UNRECOGNIZED', digest,
  'DIRECT_CONSUMER', 'auth-v1', 'actor-1', clock_timestamp() - interval '1 second'
FROM (
  SELECT pg_temp.account_review_source_sha(
    'account-round0-present',
    'round0-completeness-equifax-unrecognized_account',
    encode(sha256(convert_to('round0-integrity:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
    encode(sha256(convert_to('round0-membership:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
    repeat('b',64), 'presence-round0-present', 1,
    'presence-round0-present-locator', repeat('9',64), 'EQUIFAX',
    'p0-2a-direct', 'run-2a', 'baseline-round0-draft', 1,
    'report-account-round0-present', 'rv-2a', 'p0-2a-direct'
  ) AS digest
) exact_source;

SELECT pg_temp.expect_sqlstate('parallel v1 account-review source head rejected', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) SELECT
    'account-review-parallel-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
    'baseline-round0-draft', 1, repeat('9',64), 'EQUIFAX',
    'account-round0-present', 'report-account-round0-present',
    'presence-round0-present', 1, repeat('b',64), 'presence-round0-present-locator',
    'round0-completeness-equifax-unrecognized_account',
    encode(sha256(convert_to('round0-membership:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
    encode(sha256(convert_to('round0-integrity:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
    digest, 'round0_account_review_' || left(digest, 40), 1, 'RECOGNIZED', digest,
    'DIRECT_CONSUMER', 'auth-v1', 'actor-1', now()
  FROM (
    SELECT pg_temp.account_review_source_sha(
      'account-round0-present',
      'round0-completeness-equifax-unrecognized_account',
      encode(sha256(convert_to('round0-integrity:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
      encode(sha256(convert_to('round0-membership:EQUIFAX:UNRECOGNIZED_ACCOUNT', 'UTF8')), 'hex'),
      repeat('b',64), 'presence-round0-present', 1,
      'presence-round0-present-locator', repeat('9',64), 'EQUIFAX',
      'p0-2a-direct', 'run-2a', 'baseline-round0-draft', 1,
      'report-account-round0-present', 'rv-2a', 'p0-2a-direct'
    ) AS digest
  ) exact_source
$q$, '23505');

SELECT pg_temp.expect_sqlstate('non-consumer authority cannot establish account review', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) SELECT
    'account-review-non-consumer', "tenantId", "consumerId", "reportVersionId",
    "extractionRunId", "identityBaselineId", "identityBaselineVersion",
    "baselineInputSetSha256", "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey", "reviewSeriesKey",
    1, "reviewState", "sourceSetSha256", 'AGENCY_MANAGED_CLIENT',
    "authorizationVersion", "reviewedByActorId", now()
  FROM "ConsumerAccountReviewReceipt" WHERE "id" = 'account-review-v1'
$q$, '42501');

SELECT pg_temp.expect_sqlstate('cross-tenant account review substitution', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) SELECT
    'account-review-cross-tenant', "tenantId", 'p0-2a-foreign', "reportVersionId",
    "extractionRunId", "identityBaselineId", "identityBaselineVersion",
    "baselineInputSetSha256", "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey", "reviewSeriesKey",
    1, "reviewState", "sourceSetSha256", 'DIRECT_CONSUMER',
    "authorizationVersion", "reviewedByActorId", now()
  FROM "ConsumerAccountReviewReceipt" WHERE "id" = 'account-review-v1'
$q$, '42501');

SELECT pg_temp.expect_sqlstate('cross-bureau account review substitution', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) SELECT
    'account-review-cross-bureau', "tenantId", "consumerId", "reportVersionId",
    "extractionRunId", "identityBaselineId", "identityBaselineVersion",
    "baselineInputSetSha256", 'EXPERIAN', "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey", "reviewSeriesKey",
    1, "reviewState", "sourceSetSha256", "authorizationKind",
    "authorizationVersion", "reviewedByActorId", now()
  FROM "ConsumerAccountReviewReceipt" WHERE "id" = 'account-review-v1'
$q$, '23514');

SELECT pg_temp.expect_sqlstate('account review requires present source locator', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) SELECT
    'account-review-empty-locator', "tenantId", "consumerId", "reportVersionId",
    "extractionRunId", "identityBaselineId", "identityBaselineVersion",
    "baselineInputSetSha256", "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", '', "accountIndexCompletenessEvidenceId",
    "accountIndexSourceMembershipSha256", "accountIndexCompletenessIntegritySha256",
    "sourceSeriesKey", "reviewSeriesKey", 1, "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", now()
  FROM "ConsumerAccountReviewReceipt" WHERE "id" = 'account-review-v1'
$q$, '23514');

SELECT pg_temp.expect_sqlstate('account-index completeness rejects omitted locator', $q$
  INSERT INTO "Round0SourceCompletenessEvidence" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "baselineInputSetSha256", "bureau", "coverageStatus",
    "bureauCoverageId", "category", "status", "sourceMemberCount",
    "sourceMembershipSha256", "sourceLocatorToken", "integritySha256",
    "ruleKey", "ruleVersion"
  ) VALUES (
    'round0-completeness-missing-locator', 'p0-2a-direct', 'p0-2a-direct',
    'rv-2a', 'run-2a', 'baseline-round0-draft', repeat('9',64), 'EQUIFAX',
    'COVERED', 'cov-2a-eq', 'ALIAS', 'COMPLETE', 0, repeat('1',64), NULL,
    repeat('2',64), 'round0-source-completeness', 'v1'
  )
$q$, '23514');

-- Confirmation v2 normalizes the exact consumer receipt head and copies each
-- DRAFT fact without changing source identity. Seven empty identity categories
-- receive N/A completions; the non-empty account index receives the receipt.
BEGIN;
INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "reportIngestionId", "sourceIdentityBaselineId",
  "supersedesIdentityBaselineId", "semanticSha256",
  "expectedIdentityFactCount", "expectedCategoryCompletionCount",
  "expectedAccountReviewReceiptCount", "baselineSeriesKey", "version",
  "status", "policyVersion", "inputSetSha256", "confirmedByActorId",
  "confirmedAt", "createdByActorId"
) VALUES (
  'baseline-round0-confirmed-v2', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-2a', 'ing-1', 'baseline-round0-draft', 'baseline-round0-draft',
  repeat('c',64), 1, 7, 1, 'baseline-round0-series', 2, 'CONFIRMED',
  'p0-round0-source-review-v1', repeat('9',64), 'actor-1', clock_timestamp(),
  'actor-1'
);

INSERT INTO "IdentityFact" (
  "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
  "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
  "bureau", "factType", "classification", "reviewCategory", "integritySha256",
  "presence", "valueCiphertext", "valueIv", "valueAuthTag", "valueKeyVersion",
  "valueAlgorithm", "valueEnvelopeVersion", "valueAadVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion"
) VALUES (
  'identity-fact-confirmed-v2-legal', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'baseline-round0-confirmed-v2', 'run-2a', repeat('9',64),
  'identity-legal-series', 0, 'EQUIFAX', 'NAME', 'CORRECT_CURRENT', 'LEGAL_NAME',
  repeat('a',64), 'PRESENT', decode('a1','hex'), decode('a2','hex'),
  decode('a3','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
  'identity-legal-source', 'identity-normalize', 'v1'
);

WITH categories(category) AS (
  VALUES
    ('ALIAS'::"IdentityReviewCategory"),
    ('CURRENT_ADDRESS'::"IdentityReviewCategory"),
    ('FORMER_ADDRESS'::"IdentityReviewCategory"),
    ('SAFE_IDENTIFIER'::"IdentityReviewCategory"),
    ('PHONE'::"IdentityReviewCategory"),
    ('EMPLOYMENT'::"IdentityReviewCategory"),
    ('MIXED_FILE_INDICATOR'::"IdentityReviewCategory")
)
INSERT INTO "IdentityCategoryCompletion" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "category", "disposition", "sourceCompletenessSha256",
  "sourceCompletenessAttestationKey", "sourceCompletenessRuleVersion",
  "sourceCompletenessEvidenceCount", "equifaxSourceCompletenessEvidenceId",
  "experianSourceCompletenessEvidenceId",
  "transunionSourceCompletenessEvidenceId", "completedByActorId", "completedAt"
)
SELECT
  'completion-v2-' || lower(category::TEXT), 'p0-2a-direct', 'p0-2a-direct',
  'rv-2a', 'run-2a', 'baseline-round0-confirmed-v2', 2, repeat('9',64),
  category, 'NOT_APPLICABLE',
  encode(sha256(convert_to('completion-v2:' || category::TEXT, 'UTF8')), 'hex'),
  'round0-category-completion-' || lower(category::TEXT), 'v1', 3,
  'round0-completeness-equifax-' || lower(category::TEXT),
  'round0-completeness-experian-' || lower(category::TEXT),
  'round0-completeness-transunion-' || lower(category::TEXT),
  'actor-1', clock_timestamp()
FROM categories;

INSERT INTO "IdentityBaselineAccountReviewMembership" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "confirmedIdentityBaselineId", "confirmedIdentityBaselineVersion",
  "confirmedBaselineInputSetSha256", "consumerAccountReviewReceiptId",
  "reviewSeriesKey", "reviewVersion", "reviewState", "receiptSourceSetSha256",
  "bureau", "accountId", "reportVersionAccountId", "ordinal"
) SELECT
  'baseline-review-membership-v2', receipt."tenantId", receipt."consumerId",
  receipt."reportVersionId", receipt."extractionRunId",
  'baseline-round0-confirmed-v2', 2, repeat('9',64), receipt."id",
  receipt."reviewSeriesKey", receipt."version", receipt."reviewState",
  receipt."sourceSetSha256", receipt."bureau", receipt."accountId",
  receipt."reportVersionAccountId", 0
FROM "ConsumerAccountReviewReceipt" receipt
WHERE receipt."id" = 'account-review-v1';

SET CONSTRAINTS ALL IMMEDIATE;

SELECT pg_temp.expect_sqlstate('same-xact post-SET confirmed IdentityFact append rejected', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
    "bureau", "factType", "classification", "reviewCategory", "integritySha256",
    "presence", "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion"
  ) VALUES (
    'identity-fact-confirmed-same-xact-extra', 'p0-2a-direct',
    'p0-2a-direct', 'rv-2a', 'baseline-round0-confirmed-v2', 'run-2a',
    repeat('9',64), 'identity-confirmed-same-xact-extra-series', 1,
    'EQUIFAX', 'NAME', 'CORRECT_CURRENT', 'LEGAL_NAME', repeat('3',64), 'UNKNOWN',
    'identity-confirmed-same-xact-extra-source', 'identity-normalize', 'v1'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('same-xact post-SET category completion append rejected', $q$
  INSERT INTO "IdentityCategoryCompletion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "category", "sourceCompletenessSha256", "sourceCompletenessAttestationKey",
    "sourceCompletenessRuleVersion", "sourceCompletenessEvidenceCount",
    "equifaxSourceCompletenessEvidenceId", "experianSourceCompletenessEvidenceId",
    "transunionSourceCompletenessEvidenceId", "completedByActorId", "completedAt"
  ) VALUES (
    'completion-v2-same-xact-extra', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-2a', 'baseline-round0-confirmed-v2', 2, repeat('9',64),
    'UNRECOGNIZED_ACCOUNT', repeat('4',64),
    'round0-category-completion-same-xact-extra', 'v1', 3,
    'round0-completeness-equifax-unrecognized_account',
    'round0-completeness-experian-unrecognized_account',
    'round0-completeness-transunion-unrecognized_account', 'actor-1', now()
  )
$q$, '23514');

\set ON_ERROR_STOP off
SAVEPOINT same_xact_membership_append;
INSERT INTO "ConsumerAccountReviewReceipt" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
  "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
  "authorizationKind", "authorizationVersion", "reviewedByActorId",
  "reviewedAt", "supersedesReviewId"
) SELECT
  'account-review-same-xact-v2', "tenantId", "consumerId", "reportVersionId",
  "extractionRunId", "identityBaselineId", "identityBaselineVersion",
  "baselineInputSetSha256", "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256", "sourceSeriesKey", "reviewSeriesKey",
  2, 'UNKNOWN', "sourceSetSha256", 'DIRECT_CONSUMER', 'auth-same-xact-v2',
  'actor-1', "reviewedAt", 'account-review-v1'
FROM "ConsumerAccountReviewReceipt" WHERE "id" = 'account-review-v1';

INSERT INTO "IdentityBaselineAccountReviewMembership" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "confirmedIdentityBaselineId", "confirmedIdentityBaselineVersion",
  "confirmedBaselineInputSetSha256", "consumerAccountReviewReceiptId",
  "reviewSeriesKey", "reviewVersion", "reviewState", "receiptSourceSetSha256",
  "bureau", "accountId", "reportVersionAccountId", "ordinal"
) SELECT
  'baseline-review-membership-same-xact-extra', receipt."tenantId",
  receipt."consumerId", receipt."reportVersionId", receipt."extractionRunId",
  'baseline-round0-confirmed-v2', 2, repeat('9',64), receipt."id",
  receipt."reviewSeriesKey", receipt."version", receipt."reviewState",
  receipt."sourceSetSha256", receipt."bureau", receipt."accountId",
  receipt."reportVersionAccountId", 1
FROM "ConsumerAccountReviewReceipt" receipt
WHERE receipt."id" = 'account-review-same-xact-v2';
\set same_xact_membership_sqlstate :SQLSTATE
ROLLBACK TO SAVEPOINT same_xact_membership_append;
RELEASE SAVEPOINT same_xact_membership_append;
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('same-xact account-review membership append wrong failure', 'SELECT 1', '23514')
WHERE :'same_xact_membership_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS same-xact post-SET account-review membership append rejected [23514]'
WHERE :'same_xact_membership_sqlstate' = '23514';

COMMIT;
SELECT 'P0_2A_ASSERT_PASS DRAFT to CONFIRMED exact source and review membership';

SELECT pg_temp.expect_sqlstate('account review cannot pin confirmed successor baseline', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId", "reviewedAt"
  ) SELECT
    'account-review-confirmed-baseline', receipt."tenantId", receipt."consumerId",
    receipt."reportVersionId", receipt."extractionRunId",
    'baseline-round0-confirmed-v2', 2, receipt."baselineInputSetSha256",
    receipt."bureau", receipt."accountId", receipt."reportVersionAccountId",
    receipt."accountPresenceObservationId", receipt."accountPresenceObservationRevision",
    receipt."accountPresenceIntegritySha256", receipt."accountPresenceSourceLocatorToken",
    receipt."accountIndexCompletenessEvidenceId",
    receipt."accountIndexSourceMembershipSha256",
    receipt."accountIndexCompletenessIntegritySha256", exact.digest,
    'round0_account_review_' || left(exact.digest, 40), 1, 'UNRECOGNIZED',
    exact.digest, 'DIRECT_CONSUMER', 'auth-v1', 'actor-1', now()
  FROM "ConsumerAccountReviewReceipt" receipt
  CROSS JOIN LATERAL (
    SELECT pg_temp.account_review_source_sha(
      receipt."accountId", receipt."accountIndexCompletenessEvidenceId",
      receipt."accountIndexCompletenessIntegritySha256",
      receipt."accountIndexSourceMembershipSha256",
      receipt."accountPresenceIntegritySha256",
      receipt."accountPresenceObservationId",
      receipt."accountPresenceObservationRevision",
      receipt."accountPresenceSourceLocatorToken", receipt."baselineInputSetSha256",
      receipt."bureau"::TEXT, receipt."consumerId", receipt."extractionRunId",
      'baseline-round0-confirmed-v2', 2, receipt."reportVersionAccountId",
      receipt."reportVersionId", receipt."tenantId"
    ) AS digest
  ) exact
  WHERE receipt."id" = 'account-review-v1'
$q$, '23514');

SELECT pg_temp.expect_sqlstate('post-commit confirmed IdentityFact append rejected', $q$
  INSERT INTO "IdentityFact" (
    "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
    "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
    "bureau", "factType", "classification", "reviewCategory", "integritySha256",
    "presence", "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion"
  ) VALUES (
    'identity-fact-confirmed-extra', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'baseline-round0-confirmed-v2', 'run-2a', repeat('9',64),
    'identity-confirmed-extra-series', 1, 'EQUIFAX', 'NAME', 'CORRECT_CURRENT', 'ALIAS',
    repeat('d',64), 'UNKNOWN', 'identity-extra-source', 'identity-normalize', 'v1'
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('post-commit category completion append rejected', $q$
  INSERT INTO "IdentityCategoryCompletion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "category", "sourceCompletenessSha256", "sourceCompletenessAttestationKey",
    "sourceCompletenessRuleVersion", "sourceCompletenessEvidenceCount",
    "equifaxSourceCompletenessEvidenceId", "experianSourceCompletenessEvidenceId",
    "transunionSourceCompletenessEvidenceId", "completedByActorId", "completedAt"
  ) VALUES (
    'completion-v2-extra', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
    'baseline-round0-confirmed-v2', 2, repeat('9',64), 'UNRECOGNIZED_ACCOUNT',
    repeat('e',64), 'round0-category-completion-extra', 'v1', 3,
    'round0-completeness-equifax-unrecognized_account',
    'round0-completeness-experian-unrecognized_account',
    'round0-completeness-transunion-unrecognized_account', 'actor-1', now()
  )
$q$, '23514');

SELECT pg_temp.expect_sqlstate('post-commit account-review membership append rejected', $q$
  INSERT INTO "IdentityBaselineAccountReviewMembership" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "confirmedIdentityBaselineId", "confirmedIdentityBaselineVersion",
    "confirmedBaselineInputSetSha256", "consumerAccountReviewReceiptId",
    "reviewSeriesKey", "reviewVersion", "reviewState", "receiptSourceSetSha256",
    "bureau", "accountId", "reportVersionAccountId", "ordinal"
  ) SELECT
    'baseline-review-membership-v2-extra', receipt."tenantId", receipt."consumerId",
    receipt."reportVersionId", receipt."extractionRunId",
    'baseline-round0-confirmed-v2', 2, repeat('9',64), receipt."id",
    receipt."reviewSeriesKey", receipt."version", receipt."reviewState",
    receipt."sourceSetSha256", receipt."bureau", receipt."accountId",
    receipt."reportVersionAccountId", 1
  FROM "ConsumerAccountReviewReceipt" receipt WHERE receipt."id" = 'account-review-v1'
$q$, '23514');

INSERT INTO "IdentityCorrespondenceAssertion" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "identityFactSeriesKey", "identityFactId", "identityFactClassification",
  "identityFactIntegritySha256", "factBureau", "factSourceLocatorToken",
  "correspondencePurposeCode", "sourceSeriesKey", "assertionSeriesKey",
  "version", "status", "sourceSetSha256", "attestedByActorId", "attestedAt"
) VALUES (
  'identity-assertion-v2', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'run-2a',
  'baseline-round0-confirmed-v2', 2, repeat('9',64), 'identity-legal-series',
  'identity-fact-confirmed-v2-legal', 'CORRECT_CURRENT', repeat('a',64),
  'EQUIFAX', 'identity-legal-source', 'CORRESPONDENCE_SENDER_IDENTITY',
  repeat('5',64), 'identity_assertion_' || left(repeat('5',64), 40), 1,
  'ATTESTED', repeat('5',64), 'actor-1', now()
);

SELECT pg_temp.expect_sqlstate('parallel v1 identity assertion head rejected', $q$
  INSERT INTO "IdentityCorrespondenceAssertion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "identityFactSeriesKey", "identityFactId", "identityFactClassification",
    "identityFactIntegritySha256", "factBureau", "factSourceLocatorToken",
    "correspondencePurposeCode", "sourceSeriesKey", "assertionSeriesKey",
    "version", "status", "sourceSetSha256", "attestedByActorId", "attestedAt"
  ) VALUES (
    'identity-assertion-parallel-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-2a', 'baseline-round0-confirmed-v2', 2, repeat('9',64),
    'identity-legal-series', 'identity-fact-confirmed-v2-legal',
    'CORRECT_CURRENT', repeat('a',64), 'EQUIFAX', 'identity-legal-source',
    'CORRESPONDENCE_SENDER_IDENTITY', repeat('5',64),
    'identity_assertion_' || left(repeat('5',64), 40), 1, 'ATTESTED',
    repeat('5',64), 'actor-1', now()
  )
$q$, '23505');

-- A successor changes only the bounded consumer review state. The exact source
-- tuple and its canonical series remain immutable across supersession.
INSERT INTO "ConsumerAccountReviewReceipt" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
  "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
  "authorizationKind", "authorizationVersion", "reviewedByActorId",
  "reviewedAt", "supersedesReviewId"
) SELECT
  'account-review-123456789-v2', "tenantId", "consumerId", "reportVersionId",
  "extractionRunId", "identityBaselineId", "identityBaselineVersion",
  "baselineInputSetSha256", "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256", "sourceSeriesKey", "reviewSeriesKey",
  2, 'RECOGNIZED', "sourceSetSha256", 'DIRECT_CONSUMER', 'auth-v2', 'actor-1',
  clock_timestamp(), 'account-review-v1'
FROM "ConsumerAccountReviewReceipt" WHERE "id" = 'account-review-v1';

SELECT pg_temp.expect_sqlstate('stale identity assertion after account review supersession rejected', $q$
  INSERT INTO "IdentityCorrespondenceAssertion" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "identityFactSeriesKey", "identityFactId", "identityFactClassification",
    "identityFactIntegritySha256", "factBureau", "factSourceLocatorToken",
    "correspondencePurposeCode", "sourceSeriesKey", "assertionSeriesKey",
    "version", "status", "sourceSetSha256", "attestedByActorId", "attestedAt"
  ) VALUES (
    'identity-assertion-stale-review', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'run-2a', 'baseline-round0-confirmed-v2', 2, repeat('9',64),
    'identity-legal-series', 'identity-fact-confirmed-v2-legal',
    'CORRECT_CURRENT', repeat('a',64), 'EQUIFAX', 'identity-legal-source',
    'CORRESPONDENCE_SENDER_IDENTITY', repeat('6',64),
    'identity_assertion_' || left(repeat('6',64), 40), 1, 'ATTESTED',
    repeat('6',64), 'actor-1', now()
  )
$q$, '23514');

-- Reconfirmation v3 keeps the original DRAFT as source truth, appends from the
-- current confirmed predecessor, and selects the new current receipt head.
BEGIN;
INSERT INTO "IdentityBaseline" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "reportIngestionId", "sourceIdentityBaselineId",
  "supersedesIdentityBaselineId", "semanticSha256",
  "expectedIdentityFactCount", "expectedCategoryCompletionCount",
  "expectedAccountReviewReceiptCount", "baselineSeriesKey", "version",
  "status", "policyVersion", "inputSetSha256", "confirmedByActorId",
  "confirmedAt", "createdByActorId"
) VALUES (
  'baseline-round0-confirmed-v3', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'run-2a', 'ing-1', 'baseline-round0-draft', 'baseline-round0-confirmed-v2',
  repeat('d',64), 1, 7, 1, 'baseline-round0-series', 3, 'CONFIRMED',
  'p0-round0-source-review-v1', repeat('9',64), 'actor-1', clock_timestamp(),
  'actor-1'
);

INSERT INTO "IdentityFact" (
  "id", "tenantId", "consumerId", "reportVersionId", "identityBaselineId",
  "extractionRunId", "baselineInputSetSha256", "factSeriesKey", "factOrdinal",
  "bureau", "factType", "classification", "reviewCategory", "integritySha256",
  "presence", "valueCiphertext", "valueIv", "valueAuthTag", "valueKeyVersion",
  "valueAlgorithm", "valueEnvelopeVersion", "valueAadVersion",
  "sourceLocatorToken", "normalizationRuleKey", "normalizationRuleVersion"
) VALUES (
  'identity-fact-confirmed-v3-legal', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'baseline-round0-confirmed-v3', 'run-2a', repeat('9',64),
  'identity-legal-series', 0, 'EQUIFAX', 'NAME', 'CORRECT_CURRENT', 'LEGAL_NAME',
  repeat('a',64), 'PRESENT', decode('a1','hex'), decode('a2','hex'),
  decode('a3','hex'), 'key-v1', 'AES_256_GCM', 'env-v1', 'aad-v1',
  'identity-legal-source', 'identity-normalize', 'v1'
);

WITH categories(category) AS (
  VALUES
    ('ALIAS'::"IdentityReviewCategory"), ('CURRENT_ADDRESS'::"IdentityReviewCategory"),
    ('FORMER_ADDRESS'::"IdentityReviewCategory"), ('SAFE_IDENTIFIER'::"IdentityReviewCategory"),
    ('PHONE'::"IdentityReviewCategory"), ('EMPLOYMENT'::"IdentityReviewCategory"),
    ('MIXED_FILE_INDICATOR'::"IdentityReviewCategory")
)
INSERT INTO "IdentityCategoryCompletion" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "category", "disposition", "sourceCompletenessSha256",
  "sourceCompletenessAttestationKey", "sourceCompletenessRuleVersion",
  "sourceCompletenessEvidenceCount", "equifaxSourceCompletenessEvidenceId",
  "experianSourceCompletenessEvidenceId", "transunionSourceCompletenessEvidenceId",
  "completedByActorId", "completedAt"
)
SELECT
  'completion-v3-' || lower(category::TEXT), 'p0-2a-direct', 'p0-2a-direct',
  'rv-2a', 'run-2a', 'baseline-round0-confirmed-v3', 3, repeat('9',64),
  category, 'NOT_APPLICABLE',
  encode(sha256(convert_to('completion-v3:' || category::TEXT, 'UTF8')), 'hex'),
  'round0-category-reconfirmation-' || lower(category::TEXT), 'v1', 3,
  'round0-completeness-equifax-' || lower(category::TEXT),
  'round0-completeness-experian-' || lower(category::TEXT),
  'round0-completeness-transunion-' || lower(category::TEXT), 'actor-1',
  clock_timestamp()
FROM categories;

INSERT INTO "IdentityBaselineAccountReviewMembership" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "confirmedIdentityBaselineId", "confirmedIdentityBaselineVersion",
  "confirmedBaselineInputSetSha256", "consumerAccountReviewReceiptId",
  "reviewSeriesKey", "reviewVersion", "reviewState", "receiptSourceSetSha256",
  "bureau", "accountId", "reportVersionAccountId", "ordinal"
) SELECT
  'baseline-review-membership-v3', receipt."tenantId", receipt."consumerId",
  receipt."reportVersionId", receipt."extractionRunId",
  'baseline-round0-confirmed-v3', 3, repeat('9',64), receipt."id",
  receipt."reviewSeriesKey", receipt."version", receipt."reviewState",
  receipt."sourceSetSha256", receipt."bureau", receipt."accountId",
  receipt."reportVersionAccountId", 0
FROM "ConsumerAccountReviewReceipt" receipt
WHERE receipt."id" = 'account-review-123456789-v2';

SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
SELECT 'P0_2A_ASSERT_PASS reconfirmation keeps original DRAFT and advances current head';

SELECT pg_temp.expect_sqlstate('new confirmed baseline cannot masquerade as legacy', $q$
  INSERT INTO "IdentityBaseline" (
    "id", "tenantId", "consumerId", "reportVersionId", "baselineSeriesKey",
    "version", "status", "policyVersion", "inputSetSha256",
    "confirmedByActorId", "confirmedAt", "createdByActorId"
  ) VALUES (
    'baseline-new-legacy-confirmed', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
    'baseline-new-legacy-confirmed-series', 1, 'CONFIRMED', 'legacy-policy',
    repeat('e',64), 'actor-1', now(), 'actor-1'
  )
$q$, '23514');

INSERT INTO "DisputeCase" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseKey", "status",
  "policyVersion", "createdByActorId", "updatedAt"
) VALUES (
  'case-h123', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a', 'case-key-h123',
  'DRAFT', 'policy-v1', 'actor-1', now()
);

-- The current account-review receipt can support only bounded review/defer/no
-- action. It never supplies correction, fraud, or policy eligibility.
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) SELECT
  'account-review-action-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-h123', 'account-review-action-series', 1, 'PROPOSED',
  'REVIEW_ACCOUNT_FACT', 1, 1,
  encode(sha256(convert_to(
    '[["CONSUMER_ACCOUNT_REVIEW","account-review-123456789-v2",2,"EQUIFAX","'
      || receipt."sourceSetSha256" || '"]]','UTF8')), 'hex'),
  'account-review-action-idem-v1', 'actor-1', now()
FROM "ConsumerAccountReviewReceipt" receipt WHERE receipt."id" = 'account-review-123456789-v2';
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) SELECT
  'account-review-action-source-v1', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-h123', 'account-review-action-v1', 'CONSUMER_ACCOUNT_REVIEW', receipt."id",
  receipt."version", receipt."bureau", receipt."sourceSetSha256", 0
FROM "ConsumerAccountReviewReceipt" receipt WHERE receipt."id" = 'account-review-123456789-v2';
COMMIT;
SELECT 'P0_2A_ASSERT_PASS bounded current account-review action source';
SELECT 'P0_2A_ASSERT_PASS opaque digit-run account-review source id accepted';

\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) SELECT
  'account-review-correction-bad', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-h123', 'account-review-correction-bad-series', 1, 'PROPOSED',
  'REQUEST_ACCOUNT_CORRECTION', 1, 1,
  encode(sha256(convert_to(
    '[["CONSUMER_ACCOUNT_REVIEW","account-review-123456789-v2",2,"EQUIFAX","'
      || receipt."sourceSetSha256" || '"]]','UTF8')), 'hex'),
  'account-review-correction-bad-idem', 'actor-1', now()
FROM "ConsumerAccountReviewReceipt" receipt WHERE receipt."id" = 'account-review-123456789-v2';
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) SELECT
  'account-review-correction-bad-source', 'p0-2a-direct', 'p0-2a-direct',
  'rv-2a', 'case-h123', 'account-review-correction-bad',
  'CONSUMER_ACCOUNT_REVIEW', receipt."id", receipt."version", receipt."bureau",
  receipt."sourceSetSha256", 0
FROM "ConsumerAccountReviewReceipt" receipt WHERE receipt."id" = 'account-review-123456789-v2';
\set account_review_correction_sqlstate :SQLSTATE
ROLLBACK;
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('account review correction wrong failure', 'SELECT 1', '23514')
WHERE :'account_review_correction_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS unrecognized account cannot confer correction authority [23514]'
WHERE :'account_review_correction_sqlstate' = '23514';

-- Both receipt supersession and baseline reconfirmation make the prior identity
-- claim/completion historical. They remain immutable but are not current action
-- authority.
\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) VALUES (
  'stale-identity-assertion-action', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-h123', 'stale-identity-assertion-action-series', 1, 'PROPOSED',
  'REVIEW_IDENTITY_FACT', 1, 1,
  encode(sha256(convert_to(
    '[["IDENTITY_CORRESPONDENCE_ASSERTION","identity-assertion-v2",1,"EQUIFAX","'
      || repeat('5',64) || '"]]','UTF8')), 'hex'),
  'stale-identity-assertion-action-idem', 'actor-1', now()
);
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) VALUES (
  'stale-identity-assertion-source', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-h123', 'stale-identity-assertion-action',
  'IDENTITY_CORRESPONDENCE_ASSERTION', 'identity-assertion-v2', 1,
  'EQUIFAX', repeat('5',64), 0
);
\set stale_assertion_action_sqlstate :SQLSTATE
ROLLBACK;
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('stale identity assertion action wrong failure', 'SELECT 1', '23514')
WHERE :'stale_assertion_action_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS v2 identity assertion rejected after v3 reconfirmation [23514]'
WHERE :'stale_assertion_action_sqlstate' = '23514';

\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) SELECT
  'stale-category-completion-action', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-h123', 'stale-category-completion-action-series', 1, 'PROPOSED',
  'REVIEW_IDENTITY_FACT', 1, 1,
  encode(sha256(convert_to(
    '[["IDENTITY_CATEGORY_COMPLETION","completion-v2-alias",2,null,"'
      || completion."sourceCompletenessSha256" || '"]]','UTF8')), 'hex'),
  'stale-category-completion-action-idem', 'actor-1', now()
FROM "IdentityCategoryCompletion" completion WHERE completion."id" = 'completion-v2-alias';
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) SELECT
  'stale-category-completion-source', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-h123', 'stale-category-completion-action', 'IDENTITY_CATEGORY_COMPLETION',
  completion."id", completion."identityBaselineVersion", NULL,
  completion."sourceCompletenessSha256", 0
FROM "IdentityCategoryCompletion" completion WHERE completion."id" = 'completion-v2-alias';
\set stale_completion_action_sqlstate :SQLSTATE
ROLLBACK;
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('stale identity completion action wrong failure', 'SELECT 1', '23514')
WHERE :'stale_completion_action_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS v2 category completion rejected after v3 reconfirmation [23514]'
WHERE :'stale_completion_action_sqlstate' = '23514';

\set ON_ERROR_STOP off
BEGIN;
INSERT INTO "CaseActionDecision" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId",
  "decisionSeriesKey", "version", "state", "actionCode", "chronologyRound",
  "expectedSourceCount", "sourceSetSha256", "idempotencyKey",
  "recordedByActorId", "recordedAt"
) SELECT
  'stale-account-review-action', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-h123', 'stale-account-review-action-series', 1, 'PROPOSED',
  'REVIEW_ACCOUNT_FACT', 1, 1,
  encode(sha256(convert_to(
    '[["CONSUMER_ACCOUNT_REVIEW","account-review-v1",1,"EQUIFAX","'
      || receipt."sourceSetSha256" || '"]]','UTF8')), 'hex'),
  'stale-account-review-action-idem', 'actor-1', now()
FROM "ConsumerAccountReviewReceipt" receipt WHERE receipt."id" = 'account-review-v1';
INSERT INTO "CaseActionSourceRef" (
  "id", "tenantId", "consumerId", "reportVersionId", "caseId", "decisionId",
  "sourceType", "sourceId", "sourceVersion", "bureau", "integritySha256", "ordinal"
) SELECT
  'stale-account-review-source', 'p0-2a-direct', 'p0-2a-direct', 'rv-2a',
  'case-h123', 'stale-account-review-action', 'CONSUMER_ACCOUNT_REVIEW',
  receipt."id", receipt."version", receipt."bureau", receipt."sourceSetSha256", 0
FROM "ConsumerAccountReviewReceipt" receipt WHERE receipt."id" = 'account-review-v1';
\set stale_account_review_sqlstate :SQLSTATE
ROLLBACK;
\set ON_ERROR_STOP on
SELECT pg_temp.expect_sqlstate('stale account review action wrong failure', 'SELECT 1', '23514')
WHERE :'stale_account_review_sqlstate' <> '23514';
SELECT 'P0_2A_ASSERT_PASS case action rejects stale account review receipt [23514]'
WHERE :'stale_account_review_sqlstate' = '23514';

SELECT pg_temp.expect_sqlstate('account review mutation forbidden', $q$
  UPDATE "ConsumerAccountReviewReceipt" SET "reviewState" = 'UNKNOWN'
  WHERE "id" = 'account-review-123456789-v2'
$q$, '55000');

INSERT INTO "ConsumerAccountReviewReceipt" (
  "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
  "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
  "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
  "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
  "authorizationKind", "authorizationVersion", "reviewedByActorId",
  "reviewedAt", "supersedesReviewId"
) SELECT
  'account-review-v3-revoked', "tenantId", "consumerId", "reportVersionId",
  "extractionRunId", "identityBaselineId", "identityBaselineVersion",
  "baselineInputSetSha256", "bureau", "accountId", "reportVersionAccountId",
  "accountPresenceObservationId", "accountPresenceObservationRevision",
  "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
  "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
  "accountIndexCompletenessIntegritySha256", "sourceSeriesKey", "reviewSeriesKey",
  3, 'REVOKED', "sourceSetSha256", 'DIRECT_CONSUMER', 'auth-v3', 'actor-1',
  clock_timestamp(), 'account-review-123456789-v2'
FROM "ConsumerAccountReviewReceipt" WHERE "id" = 'account-review-123456789-v2';

SELECT pg_temp.expect_sqlstate('revoked account review is terminal', $q$
  INSERT INTO "ConsumerAccountReviewReceipt" (
    "id", "tenantId", "consumerId", "reportVersionId", "extractionRunId",
    "identityBaselineId", "identityBaselineVersion", "baselineInputSetSha256",
    "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey",
    "reviewSeriesKey", "version", "reviewState", "sourceSetSha256",
    "authorizationKind", "authorizationVersion", "reviewedByActorId",
    "reviewedAt", "supersedesReviewId"
  ) SELECT
    'account-review-v4-after-revoke', "tenantId", "consumerId", "reportVersionId",
    "extractionRunId", "identityBaselineId", "identityBaselineVersion",
    "baselineInputSetSha256", "bureau", "accountId", "reportVersionAccountId",
    "accountPresenceObservationId", "accountPresenceObservationRevision",
    "accountPresenceIntegritySha256", "accountPresenceSourceLocatorToken",
    "accountIndexCompletenessEvidenceId", "accountIndexSourceMembershipSha256",
    "accountIndexCompletenessIntegritySha256", "sourceSeriesKey", "reviewSeriesKey",
    4, 'DEFERRED', "sourceSetSha256", 'DIRECT_CONSUMER', 'auth-v4', 'actor-1',
    clock_timestamp(), 'account-review-v3-revoked'
  FROM "ConsumerAccountReviewReceipt" WHERE "id" = 'account-review-v3-revoked'
$q$, '23514');

INSERT INTO "P0SensitiveAccessEvent" (
  "id", "tenantId", "consumerId", "eventKey", "actorId", "authorizationKind",
  "authorizationVersion", "accessKind", "purposeCode", "decision",
  "decisionCode", "resourceType", "resourceId", "resourceVersion",
  "correlationId", "occurredAt"
) VALUES (
  'access-2a', 'p0-2a-direct', 'p0-2a-direct', 'access-event-1', 'actor-1',
  'DIRECT_CONSUMER', 'auth-v1', 'DECRYPT', 'ROUND0_REVIEW', 'ALLOW', 'AUTHORIZED',
  'REPORT_SOURCE', 'source-artifact-2a', 1, 'corr-access-1', now()
);

SELECT pg_temp.expect_sqlstate('allowed access resource version substitution', $q$
  INSERT INTO "P0SensitiveAccessEvent" (
    "id", "tenantId", "consumerId", "eventKey", "actorId", "authorizationKind",
    "authorizationVersion", "accessKind", "purposeCode", "decision",
    "decisionCode", "resourceType", "resourceId", "resourceVersion",
    "correlationId", "occurredAt"
  ) VALUES (
    'access-bad-version', 'p0-2a-direct', 'p0-2a-direct', 'access-event-bad-version',
    'actor-1', 'DIRECT_CONSUMER', 'auth-v1', 'DOWNLOAD', 'CONSUMER_EXPORT',
    'ALLOW', 'AUTHORIZED', 'REPORT_SOURCE', 'source-artifact-2a', 2,
    'corr-access-bad-version', now()
  )
$q$, '23503');

SELECT pg_temp.expect_sqlstate('PII-like access audit resource identifier', $q$
  INSERT INTO "P0SensitiveAccessEvent" (
    "id", "tenantId", "consumerId", "eventKey", "actorId", "authorizationKind",
    "authorizationVersion", "accessKind", "purposeCode", "decision",
    "decisionCode", "resourceType", "resourceId", "resourceVersion",
    "correlationId", "occurredAt"
  ) VALUES (
    'access-pii-ref', 'p0-2a-direct', 'p0-2a-direct', 'access-event-pii-ref',
    'actor-1', 'DIRECT_CONSUMER', 'auth-v1', 'DOWNLOAD', 'CONSUMER_EXPORT',
    'DENY', 'SCOPE_DENIED', 'ARTIFACT', 'person@example.com', 1,
    'corr-access-pii-ref', now()
  )
$q$, '23514');
SELECT pg_temp.expect_sqlstate('access audit update forbidden', $q$
  UPDATE "P0SensitiveAccessEvent" SET "decision" = 'DENY' WHERE "id" = 'access-2a'
$q$, '55000');

SELECT 'P0_2A_BEHAVIOR_PASS';
SQL

say "constraints: exact source, ingestion CAS, Round 0, action, and access audit"
behavior_output="$(psql_file "${primary_db}" "${fixture_sql}" 2>&1)" || { printf '%s\n' "${behavior_output}" >&2; fail "Phase 2A behavior suite failed"; }
printf '%s\n' "${behavior_output}"
grep -q "P0_2A_BEHAVIOR_PASS" <<<"${behavior_output}" || fail "behavior completion marker missing"

# Exact PostgreSQL 40P01 exercise on two queue rows; one transaction must be the
# deadlock victim and the other must commit. Retry policy remains in repository code.
psql_query "${primary_db}" "INSERT INTO \"ReportIngestion\" (\"id\",\"tenantId\",\"consumerId\",\"actorId\",\"authorizationKind\",\"authorizationVersion\",\"idempotencyKey\",\"operationKey\",\"reportSeriesKey\",\"reservedVersion\",\"sourceSha256\",\"sourceByteLength\",\"sourceDeclaredMimeType\",\"sourceDetectedMimeType\",\"updatedAt\") VALUES ('dead-a','p0-2a-direct','p0-2a-direct','actor-1','SYSTEM_WORKER','auth-v1','dead-idem-a','dead-op-a','dead-series-a',1,repeat('c',64),32,'application/pdf','application/pdf',now()), ('dead-b','p0-2a-direct','p0-2a-direct','actor-1','SYSTEM_WORKER','auth-v1','dead-idem-b','dead-op-b','dead-series-b',1,repeat('d',64),32,'application/pdf','application/pdf',now());" >/dev/null

deadlock_one="${tmp_root}/deadlock-one.log"
deadlock_two="${tmp_root}/deadlock-two.log"
set +e
local_docker exec "${container_name}" psql -X --set=ON_ERROR_STOP=1 --set=VERBOSITY=verbose --username "${DB_ROLE}" --dbname "${primary_db}" --command "BEGIN; UPDATE \"ReportIngestion\" SET \"revision\"=\"revision\"+1,\"updatedAt\"=now() WHERE \"id\"='dead-a'; SELECT pg_sleep(0.5); UPDATE \"ReportIngestion\" SET \"revision\"=\"revision\"+1,\"updatedAt\"=now() WHERE \"id\"='dead-b'; COMMIT;" >"${deadlock_one}" 2>&1 &
pid_one=$!
local_docker exec "${container_name}" psql -X --set=ON_ERROR_STOP=1 --set=VERBOSITY=verbose --username "${DB_ROLE}" --dbname "${primary_db}" --command "BEGIN; UPDATE \"ReportIngestion\" SET \"revision\"=\"revision\"+1,\"updatedAt\"=now() WHERE \"id\"='dead-b'; SELECT pg_sleep(0.5); UPDATE \"ReportIngestion\" SET \"revision\"=\"revision\"+1,\"updatedAt\"=now() WHERE \"id\"='dead-a'; COMMIT;" >"${deadlock_two}" 2>&1 &
pid_two=$!
wait "${pid_one}"; status_one=$?
wait "${pid_two}"; status_two=$?
set -e
deadlock_count="$(grep -l '40P01' "${deadlock_one}" "${deadlock_two}" | wc -l | tr -d ' ')"
[[ "${deadlock_count}" == "1" ]] || fail "exactly one 40P01 deadlock victim was required"
[[ ("${status_one}" -eq 0 && "${status_two}" -ne 0) || ("${status_one}" -ne 0 && "${status_two}" -eq 0) ]] || fail "deadlock concurrency must have one commit and one rejection"
say "concurrency: exact 40P01 victim=1 committed=1"

say "rollback: Phase 2A objects only, guarded disposable target"
local_docker exec -i "${container_name}" psql -X --set=ON_ERROR_STOP=1 \
  --set=p0_2a_disposable_sentinel=DISPOSABLE_DATABASE_ONLY \
  --username "${DB_ROLE}" --dbname "${primary_db}" <"${ROLLBACK_SQL}" >/dev/null

[[ "$(psql_query "${primary_db}" "SELECT to_regclass('\"ReportIngestion\"') IS NULL;")" == "t" ]] || fail "Phase 2A table survived rollback"
[[ "$(psql_query "${primary_db}" "SELECT to_regclass('\"ReportVersion\"') IS NOT NULL;")" == "t" ]] || fail "Phase 1 table was lost during rollback"
[[ "$(psql_query "${primary_db}" "SELECT count(*) FROM \"ReportVersion\" WHERE \"id\"='rv-2a';")" == "1" ]] || fail "Phase 1 truth row changed during rollback"

say "rebuild: fresh database deploy and schema parity"
psql_query "${primary_db}" "CREATE DATABASE \"${rebuild_db}\";" >/dev/null
run_prisma_deploy rebuild-deploy "${rebuild_url}" "${SCHEMA_FILE}"
run_prisma_diff "${rebuild_url}"

say "P0 Phase 2A migration verification PASS"
say "production connection/mutation: NONE"
