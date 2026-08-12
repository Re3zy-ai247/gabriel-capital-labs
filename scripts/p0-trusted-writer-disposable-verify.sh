#!/usr/bin/env bash
set -Eeuo pipefail

# CreditVector P0 trusted-writer real-adapter verifier.
#
# This program accepts no target and no credentials. It creates two pristine,
# loopback-only PostgreSQL 16.14 containers from one already-present pinned
# image, generates an isolated Prisma client, exercises the restricted writer
# role and exact real-adapter test, rebuilds from migrations, and tears every
# disposable artifact down. It never pulls an image or consults inherited
# database connection variables.

umask 077

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly SCHEMA_FILE="${REPO_ROOT}/prisma/schema.prisma"
readonly ROLE_CONTRACT="${REPO_ROOT}/scripts/sql/p0-trusted-writer-db-role-contract.sql"
readonly VALIDATOR_BOUNDARY="${REPO_ROOT}/scripts/sql/p0-trusted-writer-validator-boundary.sql"
readonly REAL_ADAPTER_TEST="${REPO_ROOT}/scripts/p0-trusted-writer-real-adapter.test.ts"
readonly POSTGRES_IMAGE_TAG="postgres:16-alpine"
readonly POSTGRES_IMAGE_ID="sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777"
readonly POSTGRES_VERSION_PREFIX="postgres (PostgreSQL) 16.14"
readonly ADMIN_ROLE="p0_tw_disposable_admin"
readonly VALIDATOR_OWNER="p0_validator_owner"
readonly ROLE_CONTRACT_SENTINEL="P0_TRUSTED_WRITER_ROLE_CONTRACT"

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

[[ $# -eq 0 ]] || fail "no arguments are accepted; this verifier creates its own targets"

for forbidden_override in \
  DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS_VERIFY DOCKER_CERT_PATH DOCKER_CONFIG; do
  if declare -p "${forbidden_override}" >/dev/null 2>&1; then
    fail "${forbidden_override} override is forbidden"
  fi
done

unset DATABASE_URL DIRECT_URL SHADOW_DATABASE_URL PRISMA_DATABASE_URL
unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE
unset P0_TW_DISPOSABLE_WRITER_URL P0_TW_DISPOSABLE_ADMIN_URL
unset P0_TW_DISPOSABLE_WRITER_ROLE
unset P0_TW_DISPOSABLE_VALIDATOR_OWNER

for required_file in \
  "${SCHEMA_FILE}" \
  "${ROLE_CONTRACT}" \
  "${VALIDATOR_BOUNDARY}" \
  "${REAL_ADAPTER_TEST}"; do
  [[ -f "${required_file}" ]] || fail "required verifier input is missing: ${required_file}"
done
command -v docker >/dev/null 2>&1 || fail "Docker is required"
command -v openssl >/dev/null 2>&1 || fail "openssl is required"
command -v git >/dev/null 2>&1 || fail "git is required"
command -v node >/dev/null 2>&1 || fail "Node.js is required"
command -v shasum >/dev/null 2>&1 || fail "shasum is required"
command -v cmp >/dev/null 2>&1 || fail "cmp is required"

git_common_dir="$(git -C "${REPO_ROOT}" rev-parse --path-format=absolute --git-common-dir)"
[[ "${git_common_dir}" == */.git ]] || fail "cannot resolve the primary repository dependency root"
readonly PRIMARY_REPO_ROOT="${git_common_dir%/.git}"
readonly DEPENDENCY_NODE_MODULES="${PRIMARY_REPO_ROOT}/node_modules"
[[ -d "${DEPENDENCY_NODE_MODULES}" ]] || fail "configured primary dependency runtime is unavailable"
[[ -x "${DEPENDENCY_NODE_MODULES}/.bin/prisma" ]] || fail "Prisma CLI is unavailable"
[[ -d "${DEPENDENCY_NODE_MODULES}/tsx" ]] || fail "tsx runtime is unavailable"
[[ -d "${DEPENDENCY_NODE_MODULES}/@prisma" ]] || fail "Prisma runtime is unavailable"
[[ ! -e "${REPO_ROOT}/node_modules" && ! -L "${REPO_ROOT}/node_modules" ]] || \
  fail "P0 worktree node_modules must be absent before isolated generation"
cd "${REPO_ROOT}"

docker_context_name="$(docker context show 2>/dev/null)" || fail "cannot resolve Docker context"
[[ "${docker_context_name}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || \
  fail "unsafe Docker context name"
docker_endpoint="$(docker context inspect --format '{{ (index .Endpoints "docker").Host }}' "${docker_context_name}" 2>/dev/null)" || \
  fail "cannot resolve Docker endpoint"
[[ "${docker_endpoint}" =~ ^unix:///[^[:space:]]+$ ]] || \
  fail "Docker endpoint must be a local unix socket"
[[ "${docker_endpoint}" != *'/../'* && "${docker_endpoint}" != *'/./'* ]] || \
  fail "Docker socket path is not canonical"
readonly docker_context_name docker_endpoint

local_docker() { docker --host "${docker_endpoint}" "$@"; }

local_docker info >/dev/null 2>&1 || fail "local Docker daemon is unavailable"
local_image_id="$(local_docker image inspect --format '{{.Id}}' "${POSTGRES_IMAGE_TAG}" 2>/dev/null || true)"
[[ "${local_image_id}" == "${POSTGRES_IMAGE_ID}" ]] || \
  fail "the pinned local PostgreSQL image is absent or has the wrong identity; no pull is permitted"

tmp_root="$(mktemp -d /private/tmp/creditvector-p0-tw-disposable.XXXXXX)"
[[ "${tmp_root}" == /private/tmp/creditvector-p0-tw-disposable.* ]] || \
  fail "unsafe disposable temporary directory"
readonly tmp_root

write_exact_input_manifest() {
  manifest_file="$1"
  : >"${manifest_file}"
  {
    find "${REPO_ROOT}/lib/creditTruth" -maxdepth 1 -type f -name '*.ts'
    find "${REPO_ROOT}/lib" -maxdepth 1 -type f -name '*.ts'
    find "${REPO_ROOT}/prisma/migrations" -mindepth 2 -maxdepth 2 -type f -name 'migration.sql'
    find "${REPO_ROOT}/scripts" -maxdepth 1 -type f -name 'p0-trusted-writer-*'
    printf '%s\n' \
      "${REPO_ROOT}/app/api/reports/upload/route.ts" \
      "${REPO_ROOT}/package.json" \
      "${REPO_ROOT}/package-lock.json" \
      "${REPO_ROOT}/tsconfig.json" \
      "${REPO_ROOT}/prisma/migrations/migration_lock.toml" \
      "${SCHEMA_FILE}" \
      "${ROLE_CONTRACT}" \
      "${VALIDATOR_BOUNDARY}"
  } | LC_ALL=C sort -u | while IFS= read -r source_file; do
    [[ -f "${source_file}" ]] || fail "manifest input disappeared: ${source_file}"
    source_relative="${source_file#"${REPO_ROOT}/"}"
    source_digest_line="$(shasum -a 256 "${source_file}")"
    source_digest="${source_digest_line%% *}"
    [[ "${source_digest}" =~ ^[a-f0-9]{64}$ ]] || fail "cannot hash manifest input"
    printf '%s  %s\n' "${source_digest}" "${source_relative}" >>"${manifest_file}"
  done
}

readonly frozen_input_manifest="${tmp_root}/exact-input-manifest.sha256"
readonly current_input_manifest="${tmp_root}/current-input-manifest.sha256"
write_exact_input_manifest "${frozen_input_manifest}"
frozen_manifest_digest_line="$(shasum -a 256 "${frozen_input_manifest}")"
readonly frozen_manifest_digest="${frozen_manifest_digest_line%% *}"
[[ "${frozen_manifest_digest}" =~ ^[a-f0-9]{64}$ ]] || fail "cannot hash exact input manifest"

assert_exact_inputs_unchanged() {
  checkpoint="$1"
  write_exact_input_manifest "${current_input_manifest}"
  cmp -s "${frozen_input_manifest}" "${current_input_manifest}" || {
    diff -u "${frozen_input_manifest}" "${current_input_manifest}" >&2 || true
    fail "exact verifier inputs changed during ${checkpoint}"
  }
}

active_container=""
active_node_modules=""
repo_node_modules_linked=0

unlink_isolated_node_modules() {
  if [[ "${repo_node_modules_linked}" -eq 1 ]]; then
    [[ -L "${REPO_ROOT}/node_modules" ]] || fail "isolated node_modules link was substituted"
    resolved_link="$(readlink "${REPO_ROOT}/node_modules")"
    [[ "${resolved_link}" == "${active_node_modules}" ]] || fail "isolated node_modules link target changed"
    unlink "${REPO_ROOT}/node_modules"
    repo_node_modules_linked=0
    active_node_modules=""
  fi
}

stop_active_container() {
  if [[ -n "${active_container}" ]]; then
    [[ "${active_container}" =~ ^creditvector-p0-tw-disposable-[12]-[0-9]+-[0-9]+$ ]] || \
      fail "unsafe disposable container identity"
    local_docker stop --time 10 "${active_container}" >/dev/null 2>&1 || true
    removed=0
    for _attempt in $(seq 1 40); do
      if ! local_docker inspect "${active_container}" >/dev/null 2>&1; then
        removed=1
        break
      fi
      sleep 0.25
    done
    [[ "${removed}" -eq 1 ]] || fail "disposable container teardown was not confirmed"
    active_container=""
  fi
}

cleanup() {
  original_status=$?
  set +e
  if [[ "${repo_node_modules_linked}" -eq 1 ]] && [[ -L "${REPO_ROOT}/node_modules" ]]; then
    resolved_link="$(readlink "${REPO_ROOT}/node_modules" 2>/dev/null || true)"
    if [[ -n "${active_node_modules}" && "${resolved_link}" == "${active_node_modules}" ]]; then
      unlink "${REPO_ROOT}/node_modules"
    else
      original_status=1
    fi
  fi
  repo_node_modules_linked=0
  active_node_modules=""
  if [[ -n "${active_container}" ]] && \
     [[ "${active_container}" =~ ^creditvector-p0-tw-disposable-[12]-[0-9]+-[0-9]+$ ]]; then
    local_docker stop --time 10 "${active_container}" >/dev/null 2>&1
    if local_docker inspect "${active_container}" >/dev/null 2>&1; then
      original_status=1
    fi
  fi
  active_container=""
  if [[ "${tmp_root}" == /private/tmp/creditvector-p0-tw-disposable.* ]]; then
    find "${tmp_root}" -depth -delete >/dev/null 2>&1
  else
    original_status=1
  fi
  exit "${original_status}"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

redact_log() {
  log_file="$1"
  writer_password="$2"
  admin_password="$3"
  sed -E \
    -e "s/${writer_password}/<redacted-writer-password>/g" \
    -e "s/${admin_password}/<redacted-admin-password>/g" \
    -e 's#postgres(ql)?://[^[:space:]]+#<redacted-disposable-url>#g' \
    "${log_file}"
}

create_isolated_node_modules() {
  pass_dir="$1"
  active_node_modules="${pass_dir}/node_modules"
  mkdir -p "${active_node_modules}" "${active_node_modules}/.prisma"

  for dependency in "${DEPENDENCY_NODE_MODULES}"/* "${DEPENDENCY_NODE_MODULES}"/.[!.]*; do
    [[ -e "${dependency}" || -L "${dependency}" ]] || continue
    dependency_name="${dependency##*/}"
    case "${dependency_name}" in
      @prisma|.prisma) continue ;;
    esac
    ln -s "${dependency}" "${active_node_modules}/${dependency_name}"
  done
  cp -R "${DEPENDENCY_NODE_MODULES}/@prisma" "${active_node_modules}/@prisma"

  ln -s "${active_node_modules}" "${REPO_ROOT}/node_modules"
  repo_node_modules_linked=1
  [[ -x "${REPO_ROOT}/node_modules/.bin/prisma" ]] || fail "isolated Prisma CLI link failed"
  [[ -d "${REPO_ROOT}/node_modules/tsx" ]] || fail "isolated tsx link failed"
}

run_prisma() {
  label="$1"
  database_url="$2"
  admin_password="$3"
  writer_password="$4"
  shift 4
  log_file="${current_pass_dir}/${label}.log"
  if ! env -i \
      PATH="${PATH}" HOME="${HOME}" TMPDIR=/private/tmp NODE_ENV=test \
      PRISMA_HIDE_UPDATE_MESSAGE=1 DATABASE_URL="${database_url}" \
      "${REPO_ROOT}/node_modules/.bin/prisma" "$@" >"${log_file}" 2>&1; then
    redact_log "${log_file}" "${writer_password}" "${admin_password}" >&2
    fail "Prisma ${label} failed"
  fi
  LAST_PRISMA_LOG="${log_file}"
}

deploy_and_prove_schema() {
  label_prefix="$1"
  database_url="$2"
  admin_password="$3"
  writer_password="$4"
  run_prisma "${label_prefix}-forward" "${database_url}" "${admin_password}" "${writer_password}" \
    migrate deploy --schema "${SCHEMA_FILE}"
  run_prisma "${label_prefix}-no-op" "${database_url}" "${admin_password}" "${writer_password}" \
    migrate deploy --schema "${SCHEMA_FILE}"
  grep -q "No pending migrations to apply" "${LAST_PRISMA_LOG}" || \
    fail "${label_prefix} second migration deploy was not an explicit no-op"
  run_prisma "${label_prefix}-parity" "${database_url}" "${admin_password}" "${writer_password}" \
    migrate diff --from-schema-datasource "${SCHEMA_FILE}" \
      --to-schema-datamodel "${SCHEMA_FILE}" --exit-code
}

psql_admin_command() {
  database="$1"
  sql="$2"
  local_docker exec "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --username "${ADMIN_ROLE}" --dbname "${database}" --command "${sql}"
}

psql_admin_query() {
  database="$1"
  sql="$2"
  local_docker exec "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --tuples-only --no-align --quiet --username "${ADMIN_ROLE}" \
    --dbname "${database}" --command "${sql}"
}

psql_writer_query() {
  database="$1"
  writer_role="$2"
  sql="$3"
  local_docker exec "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --tuples-only --no-align --quiet --username "${writer_role}" \
    --dbname "${database}" --command "${sql}"
}

apply_role_contract() {
  database="$1"
  writer_role="$2"
  local_docker exec -i "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --username "${ADMIN_ROLE}" --dbname "${database}" \
    --set="p0_writer_role=${writer_role}" \
    --set="p0_writer_database=${database}" \
    --set="p0_role_contract_sentinel=${ROLE_CONTRACT_SENTINEL}" \
    <"${ROLE_CONTRACT}" >/dev/null
}

apply_validator_boundary() {
  database="$1"
  writer_role="$2"
  local_docker exec -i "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --username "${ADMIN_ROLE}" --dbname "${database}" \
    --set="p0_writer_role=${writer_role}" \
    --set="p0_validator_owner=${VALIDATOR_OWNER}" \
    <"${VALIDATOR_BOUNDARY}" >/dev/null
}

expect_validator_boundary_failure() {
  database="$1"
  writer_role="$2"
  label="$3"
  log_file="${current_pass_dir}/validator-boundary-${label}-expected-failure.log"
  set +e
  local_docker exec -i "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --username "${ADMIN_ROLE}" --dbname "${database}" \
    --set="p0_writer_role=${writer_role}" \
    --set="p0_validator_owner=${VALIDATOR_OWNER}" \
    <"${VALIDATOR_BOUNDARY}" >"${log_file}" 2>&1
  validator_boundary_status=$?
  set -e
  [[ "${validator_boundary_status}" -ne 0 ]] || \
    fail "validator boundary did not fail closed for ${label}"
  grep -Eqi 'unexpected|drift|privilege|authority|validator' "${log_file}" || \
    fail "validator boundary ${label} failure was not an integrity rejection"
}

prove_validator_boundary_atomicity() {
  database="$1"
  writer_role="$2"
  label="$3"
  psql_admin_command "${database}" \
    "CREATE FUNCTION public.p0_unexpected_validator_probe() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS 'BEGIN NULL; END'; REVOKE ALL PRIVILEGES ON FUNCTION public.p0_unexpected_validator_probe() FROM PUBLIC;" \
    >/dev/null
  expect_validator_boundary_failure "${database}" "${writer_role}" \
    "${label}-unexpected-definer"
  rollback_state="$(psql_admin_query "${database}" \
    "SELECT concat_ws('|', owner.rolname, routine.prosecdef::text, COALESCE(array_to_string(routine.proconfig, ','), 'NULL')) FROM pg_proc routine JOIN pg_roles owner ON owner.oid=routine.proowner WHERE routine.oid='public.p0_2a_validate_report_ingestion_mutation()'::regprocedure;")"
  [[ "${rollback_state}" == "${ADMIN_ROLE}|false|NULL" ]] || \
    fail "failed validator installation did not roll back catalog changes"
  psql_admin_command "${database}" \
    "DROP FUNCTION public.p0_unexpected_validator_probe();" >/dev/null
}

assert_validator_owner_role() {
  database="$1"
  writer_role="$2"
  owner_flags="$(psql_admin_query "${database}" \
    "SELECT concat_ws('|', rolsuper::text, rolcreatedb::text, rolcreaterole::text, rolinherit::text, rolbypassrls::text, rolreplication::text, rolcanlogin::text) FROM pg_roles WHERE rolname='${VALIDATOR_OWNER}';")"
  [[ "${owner_flags}" == "false|false|false|false|false|false|false" ]] || \
    fail "validator owner role attributes differ from the exact NOLOGIN contract"
  owner_memberships="$(psql_admin_query "${database}" \
    "SELECT count(*) FROM pg_auth_members WHERE roleid=(SELECT oid FROM pg_roles WHERE rolname='${VALIDATOR_OWNER}') OR member=(SELECT oid FROM pg_roles WHERE rolname='${VALIDATOR_OWNER}');")"
  [[ "${owner_memberships}" == "0" ]] || fail "validator owner participates in a role membership"
  writer_can_assume="$(psql_admin_query "${database}" \
    "SELECT pg_has_role('${writer_role}','${VALIDATOR_OWNER}','MEMBER')::text;")"
  [[ "${writer_can_assume}" == "false" ]] || fail "writer can assume validator owner"
}

expect_role_contract_failure() {
  database="$1"
  writer_role="$2"
  label="$3"
  log_file="${current_pass_dir}/role-contract-${label}-expected-failure.log"
  set +e
  local_docker exec -i "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --username "${ADMIN_ROLE}" --dbname "${database}" \
    --set="p0_writer_role=${writer_role}" \
    --set="p0_writer_database=${database}" \
    --set="p0_role_contract_sentinel=${ROLE_CONTRACT_SENTINEL}" \
    <"${ROLE_CONTRACT}" >"${log_file}" 2>&1
  role_contract_status=$?
  set -e
  [[ "${role_contract_status}" -ne 0 ]] || fail "role contract did not fail closed for ${label}"
  grep -Eqi 'unexpected|must not own|owns|privilege|authority|unsafe|default ACL' "${log_file}" || \
    fail "role contract ${label} failure was not an authority rejection"
}

role_contract_semantic_fingerprint() {
  database="$1"
  writer_role="$2"
  authorization_snapshot="$(psql_admin_query "${database}" "
    WITH authorization_state(entry) AS (
      SELECT format(
        'role|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',
        role.rolname, role.rolsuper, role.rolinherit, role.rolcreaterole,
        role.rolcreatedb, role.rolcanlogin, role.rolreplication,
        role.rolconnlimit, role.rolpassword, role.rolvaliduntil,
        role.rolbypassrls, role.oid
      )
      FROM pg_authid role
      WHERE role.rolname = '${writer_role}'
      UNION ALL
      SELECT format(
        'membership|%s|%s|%s|%s|%s|%s', membership.roleid,
        membership.member, membership.grantor, membership.admin_option,
        membership.inherit_option, membership.set_option
      )
      FROM pg_auth_members membership
      WHERE membership.roleid = (SELECT oid FROM pg_roles WHERE rolname = '${writer_role}')
         OR membership.member = (SELECT oid FROM pg_roles WHERE rolname = '${writer_role}')
      UNION ALL
      SELECT format(
        'setting|%s|%s|%s', settings.setdatabase, settings.setrole,
        settings.setconfig
      )
      FROM pg_db_role_setting settings
      WHERE settings.setrole IN (0, (SELECT oid FROM pg_roles WHERE rolname = '${writer_role}'))
        AND settings.setdatabase IN (
          0,
          (SELECT oid FROM pg_database WHERE datname = '${database}')
        )
      UNION ALL
      SELECT format('parameter|%s|%s', parameter.parname, parameter.paracl)
      FROM pg_parameter_acl parameter
      UNION ALL
      SELECT format(
        'default|%s|%s|%s|%s', defaults.defaclrole,
        defaults.defaclnamespace, defaults.defaclobjtype, defaults.defaclacl
      )
      FROM pg_default_acl defaults
      UNION ALL
      SELECT format('database|%s|%s|%s', database.oid, database.datdba, database.datacl)
      FROM pg_database database
      WHERE database.datname = '${database}'
      UNION ALL
      SELECT format(
        'schema|%s|%s|%s|%s', namespace.oid, namespace.nspname,
        namespace.nspowner, namespace.nspacl
      )
      FROM pg_namespace namespace
      WHERE namespace.nspname <> 'information_schema'
        AND namespace.nspname !~ '^pg_'
      UNION ALL
      SELECT format(
        'relation|%s|%s|%s|%s|%s', relation.oid, namespace.nspname,
        relation.relname, relation.relowner, relation.relacl
      )
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname <> 'information_schema'
        AND namespace.nspname !~ '^pg_'
      UNION ALL
      SELECT format(
        'column|%s|%s|%s|%s', attribute.attrelid, attribute.attnum,
        attribute.attname, attribute.attacl
      )
      FROM pg_attribute attribute
      JOIN pg_class relation ON relation.oid = attribute.attrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname <> 'information_schema'
        AND namespace.nspname !~ '^pg_'
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      UNION ALL
      SELECT format(
        'routine|%s|%s|%s|%s|%s|%s|%s', routine.oid,
        namespace.nspname, routine.proname, routine.proowner,
        routine.prosecdef, routine.proconfig, routine.proacl
      )
      FROM pg_proc routine
      JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
      WHERE namespace.nspname <> 'information_schema'
        AND namespace.nspname !~ '^pg_'
    )
    SELECT encode(
      convert_to(COALESCE(string_agg(entry, E'\\n' ORDER BY entry), 'EMPTY'), 'UTF8'),
      'base64'
    )
    FROM authorization_state;")"
  authorization_fingerprint_line="$(printf '%s' "${authorization_snapshot}" | shasum -a 256)"
  printf '%s\n' "${authorization_fingerprint_line%% *}"
}

prove_role_contract_atomicity() {
  database="$1"
  writer_role="$2"
  seed_label="$3"
  stale_schema="p0_tw_stale_${seed_label}"

  # This foreign-owner PUBLIC default is intentionally outside the role-scoped
  # normalizer.  The final exact audit rejects it only after the contract has
  # attempted role, membership, GUC, ACL, database, schema, object, and grant
  # mutations.  The surrounding transaction must roll every one of them back.
  psql_admin_command "${database}" \
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" GRANT SELECT ON TABLES TO PUBLIC;" \
    >/dev/null
  before_fingerprint="$(role_contract_semantic_fingerprint "${database}" "${writer_role}")"
  [[ "${before_fingerprint}" =~ ^[a-f0-9]{64}$ ]] || \
    fail "role-contract pre-failure authorization fingerprint is malformed"

  expect_role_contract_failure "${database}" "${writer_role}" \
    "${seed_label}-late-audit-atomicity"

  after_fingerprint="$(role_contract_semantic_fingerprint "${database}" "${writer_role}")"
  [[ "${after_fingerprint}" == "${before_fingerprint}" ]] || \
    fail "failed role contract left partial authorization changes"

  psql_admin_command "${database}" \
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" REVOKE SELECT ON TABLES FROM PUBLIC;" \
    >/dev/null
}

expect_writer_denied() {
  database="$1"
  writer_role="$2"
  label="$3"
  sql="$4"
  log_file="${current_pass_dir}/writer-${label}-expected-denial.log"
  set +e
  local_docker exec "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --username "${writer_role}" --dbname "${database}" --command "${sql}" \
    >"${log_file}" 2>&1
  writer_status=$?
  set -e
  [[ "${writer_status}" -ne 0 ]] || fail "writer unexpectedly performed ${label}"
  grep -Eqi 'permission denied|must be superuser|not permitted|insufficient privilege|must have' "${log_file}" || \
    fail "writer ${label} denial did not report an authorization failure"
}

seed_stale_writer_authority() {
  database="$1"
  writer_role="$2"
  seed_label="$3"
  stale_schema="p0_tw_stale_${seed_label}"
  stale_parent="p0_tw_parent_${seed_label}"
  stale_child="p0_tw_child_${seed_label}"
  [[ "${stale_schema}" =~ ^p0_tw_stale_[a-z0-9_]{1,48}$ ]] || fail "unsafe stale schema"
  [[ "${stale_parent}" =~ ^p0_tw_parent_[a-z0-9_]{1,48}$ ]] || fail "unsafe stale role"
  [[ "${stale_child}" =~ ^p0_tw_child_[a-z0-9_]{1,48}$ ]] || fail "unsafe stale child role"
  psql_admin_command "${database}" \
    "ALTER ROLE \"${writer_role}\" WITH SUPERUSER CREATEDB CREATEROLE BYPASSRLS REPLICATION; CREATE ROLE \"${stale_parent}\" NOLOGIN; CREATE ROLE \"${stale_child}\" NOLOGIN; GRANT \"${stale_parent}\" TO \"${writer_role}\" WITH ADMIN OPTION; GRANT \"${writer_role}\" TO \"${stale_child}\" WITH ADMIN OPTION; ALTER ROLE \"${writer_role}\" SET session_replication_role TO replica; GRANT SET ON PARAMETER session_replication_role TO \"${writer_role}\"; GRANT CREATE,TEMPORARY ON DATABASE \"${database}\" TO \"${writer_role}\"; GRANT ALL PRIVILEGES ON SCHEMA public TO \"${writer_role}\"; GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"${writer_role}\"; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"${writer_role}\"; GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO \"${writer_role}\"; CREATE SCHEMA \"${stale_schema}\"; CREATE TABLE \"${stale_schema}\".stale_table (id integer PRIMARY KEY, value text); CREATE SEQUENCE \"${stale_schema}\".stale_sequence; CREATE FUNCTION \"${stale_schema}\".stale_function() RETURNS integer LANGUAGE SQL AS 'SELECT 1'; REVOKE ALL PRIVILEGES ON FUNCTION \"${stale_schema}\".stale_function() FROM PUBLIC; GRANT ALL PRIVILEGES ON SCHEMA \"${stale_schema}\" TO \"${writer_role}\"; GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA \"${stale_schema}\" TO \"${writer_role}\"; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA \"${stale_schema}\" TO \"${writer_role}\"; GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA \"${stale_schema}\" TO \"${writer_role}\"; GRANT ALL PRIVILEGES ON SCHEMA \"${stale_schema}\" TO \"${stale_parent}\"; GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA \"${stale_schema}\" TO \"${stale_parent}\";" \
    >/dev/null
}

assert_exact_writer_role() {
  database="$1"
  writer_role="$2"
  seed_label="$3"
  stale_schema="p0_tw_stale_${seed_label}"
  role_flags="$(psql_admin_query "${database}" \
    "SELECT concat_ws('|', rolsuper::text, rolcreatedb::text, rolcreaterole::text, rolinherit::text, rolbypassrls::text, rolreplication::text, rolcanlogin::text) FROM pg_roles WHERE rolname='${writer_role}';")"
  [[ "${role_flags}" == "false|false|false|false|false|false|true" ]] || fail "writer retained administrative role attributes"
  membership_count="$(psql_admin_query "${database}" \
    "SELECT count(*) FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='${writer_role}') OR roleid=(SELECT oid FROM pg_roles WHERE rolname='${writer_role}');")"
  [[ "${membership_count}" == "0" ]] || fail "writer retained inbound or outbound role membership"
  role_setting_count="$(psql_admin_query "${database}" \
    "SELECT count(*) FROM pg_db_role_setting WHERE setrole=(SELECT oid FROM pg_roles WHERE rolname='${writer_role}');")"
  [[ "${role_setting_count}" == "0" ]] || fail "writer retained login settings"
  parameter_matrix="$(psql_admin_query "${database}" \
    "SELECT concat_ws('|', has_parameter_privilege('${writer_role}','session_replication_role','SET')::text, has_parameter_privilege('${writer_role}','session_replication_role','ALTER SYSTEM')::text);")"
  [[ "${parameter_matrix}" == "false|false" ]] || fail "writer retained parameter authority"
  replication_role="$(psql_writer_query "${database}" "${writer_role}" 'SHOW session_replication_role;')"
  [[ "${replication_role}" == "origin" ]] || fail "writer session can bypass origin triggers"
  database_schema_matrix="$(psql_admin_query "${database}" \
    "SELECT concat_ws('|', has_database_privilege('${writer_role}',current_database(),'CONNECT')::text, has_database_privilege('${writer_role}',current_database(),'CREATE')::text, has_database_privilege('${writer_role}',current_database(),'TEMPORARY')::text, has_schema_privilege('${writer_role}','public','USAGE')::text, has_schema_privilege('${writer_role}','public','CREATE')::text, has_schema_privilege('${writer_role}','${stale_schema}','USAGE')::text, has_schema_privilege('${writer_role}','${stale_schema}','CREATE')::text);")"
  [[ "${database_schema_matrix}" == "true|false|false|true|false|false|false" ]] || fail "writer database/schema privileges differ from exact allowlist"
  table_matrix="$(psql_admin_query "${database}" \
    "SELECT concat_ws('|', has_table_privilege('${writer_role}','public.\"CreditTruthScope\"','SELECT')::text, has_table_privilege('${writer_role}','public.\"CreditTruthScope\"','INSERT')::text, has_table_privilege('${writer_role}','public.\"CreditTruthScope\"','UPDATE')::text, has_table_privilege('${writer_role}','public.\"CreditTruthScope\"','DELETE')::text, has_table_privilege('${writer_role}','public.\"CreditTruthScope\"','TRUNCATE')::text, has_table_privilege('${writer_role}','public.\"CreditTruthScope\"','REFERENCES')::text, has_table_privilege('${writer_role}','public.\"CreditTruthScope\"','TRIGGER')::text, has_table_privilege('${writer_role}','public.\"P0SensitiveAccessEvent\"','SELECT')::text, has_table_privilege('${writer_role}','public.\"P0SensitiveAccessEvent\"','INSERT')::text, has_table_privilege('${writer_role}','public.\"P0SourceObject\"','SELECT')::text, has_table_privilege('${writer_role}','public.\"P0SourceObject\"','INSERT')::text, has_table_privilege('${writer_role}','public.\"DerivedAccountAssessment\"','SELECT')::text, has_table_privilege('${writer_role}','public.\"DerivedAccountAssessment\"','INSERT')::text, has_table_privilege('${writer_role}','public.\"ArtifactTombstone\"','INSERT')::text, has_table_privilege('${writer_role}','${stale_schema}.stale_table','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')::text);")"
  [[ "${table_matrix}" == "true|true|false|false|false|false|false|true|true|true|true|true|false|false|false" ]] || fail "writer table privileges differ from exact allowlist"
  column_sequence_routine_matrix="$(psql_admin_query "${database}" \
    "SELECT concat_ws('|', has_column_privilege('${writer_role}','public.\"CreditTruthScope\"','createdAt','UPDATE')::text, has_sequence_privilege('${writer_role}','${stale_schema}.stale_sequence','USAGE')::text, has_sequence_privilege('${writer_role}','${stale_schema}.stale_sequence','SELECT')::text, has_sequence_privilege('${writer_role}','${stale_schema}.stale_sequence','UPDATE')::text, has_function_privilege('${writer_role}','${stale_schema}.stale_function()','EXECUTE')::text);")"
  [[ "${column_sequence_routine_matrix}" == "false|false|false|false|false" ]] || fail "writer retained column/sequence/routine authority"
}

probe_public_authority_fail_closed() {
  database="$1"
  writer_role="$2"
  seed_label="$3"
  stale_schema="p0_tw_stale_${seed_label}"
  psql_admin_command "${database}" \
    "GRANT USAGE ON SCHEMA \"${stale_schema}\" TO PUBLIC; GRANT SELECT ON \"${stale_schema}\".stale_table TO PUBLIC; GRANT USAGE ON SEQUENCE \"${stale_schema}\".stale_sequence TO PUBLIC; GRANT EXECUTE ON FUNCTION \"${stale_schema}\".stale_function() TO PUBLIC; GRANT UPDATE (\"createdAt\") ON public.\"CreditTruthScope\" TO PUBLIC;" \
    >/dev/null
  expect_role_contract_failure "${database}" "${writer_role}" "${seed_label}-public-authority"
  psql_admin_command "${database}" \
    "REVOKE ALL PRIVILEGES ON SCHEMA \"${stale_schema}\" FROM PUBLIC; REVOKE ALL PRIVILEGES ON \"${stale_schema}\".stale_table FROM PUBLIC; REVOKE ALL PRIVILEGES ON SEQUENCE \"${stale_schema}\".stale_sequence FROM PUBLIC; REVOKE ALL PRIVILEGES ON FUNCTION \"${stale_schema}\".stale_function() FROM PUBLIC; REVOKE UPDATE (\"createdAt\") ON public.\"CreditTruthScope\" FROM PUBLIC;" \
    >/dev/null
  apply_role_contract "${database}" "${writer_role}"
}

probe_owned_object_fail_closed() {
  database="$1"
  writer_role="$2"
  seed_label="$3"
  owned_schema="p0_tw_owned_${seed_label}"
  psql_admin_command "${database}" \
    "CREATE SCHEMA \"${owned_schema}\"; GRANT CREATE ON SCHEMA \"${owned_schema}\" TO \"${writer_role}\"; CREATE TABLE \"${owned_schema}\".owned_table (id integer PRIMARY KEY); ALTER TABLE \"${owned_schema}\".owned_table OWNER TO \"${writer_role}\";" \
    >/dev/null
  expect_role_contract_failure "${database}" "${writer_role}" "${seed_label}-object-ownership"
  psql_admin_command "${database}" \
    "ALTER TABLE \"${owned_schema}\".owned_table OWNER TO \"${ADMIN_ROLE}\"; REVOKE ALL PRIVILEGES ON SCHEMA \"${owned_schema}\" FROM \"${writer_role}\"; DROP SCHEMA \"${owned_schema}\" CASCADE;" \
    >/dev/null
  apply_role_contract "${database}" "${writer_role}"
}

probe_default_acl_contract() {
  database="$1"
  writer_role="$2"
  seed_label="$3"
  stale_schema="p0_tw_stale_${seed_label}"
  future_table="future_table_${seed_label}"
  future_sequence="future_sequence_${seed_label}"
  future_function="future_function_${seed_label}"

  # A foreign owner's future grant to the writer is shared authorization. The
  # dedicated-role contract must preserve it and stop, never delete the last ACL
  # entry and silently restore PostgreSQL's built-in PUBLIC routine EXECUTE.
  psql_admin_command "${database}" \
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" GRANT UPDATE ON TABLES TO \"${writer_role}\"; ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" GRANT USAGE,UPDATE ON SEQUENCES TO \"${writer_role}\"; ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC; ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" GRANT EXECUTE ON FUNCTIONS TO \"${writer_role}\";" \
    >/dev/null
  expect_role_contract_failure "${database}" "${writer_role}" "${seed_label}-foreign-writer-default-acl"
  psql_admin_command "${database}" \
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" REVOKE UPDATE ON TABLES FROM \"${writer_role}\"; ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" REVOKE USAGE,UPDATE ON SEQUENCES FROM \"${writer_role}\"; ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" REVOKE EXECUTE ON FUNCTIONS FROM \"${writer_role}\"; ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;" \
    >/dev/null
  apply_role_contract "${database}" "${writer_role}"

  # Defaults owned by the dedicated writer affect no other owner's policy and
  # are normalized even though the role itself has no CREATE authority.
  psql_admin_command "${database}" \
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"${writer_role}\" GRANT SELECT ON TABLES TO PUBLIC; ALTER DEFAULT PRIVILEGES FOR ROLE \"${writer_role}\" GRANT USAGE ON SEQUENCES TO PUBLIC; ALTER DEFAULT PRIVILEGES FOR ROLE \"${writer_role}\" GRANT EXECUTE ON FUNCTIONS TO PUBLIC;" \
    >/dev/null
  apply_role_contract "${database}" "${writer_role}"
  writer_public_default_count="$(psql_admin_query "${database}" \
    "SELECT count(*) FROM pg_default_acl defaults CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege WHERE defaults.defaclrole=(SELECT oid FROM pg_roles WHERE rolname='${writer_role}') AND privilege.grantee=0;")"
  [[ "${writer_public_default_count}" == "0" ]] || fail "writer-owned PUBLIC default authority survived normalization"

  # After the foreign owner explicitly removes its direct grants, new objects
  # must not confer authority. Its pre-existing PUBLIC routine denial remains.
  psql_admin_command "${database}" \
    "CREATE TABLE \"${stale_schema}\".\"${future_table}\" (id integer); CREATE SEQUENCE \"${stale_schema}\".\"${future_sequence}\"; CREATE FUNCTION \"${stale_schema}\".\"${future_function}\"() RETURNS integer LANGUAGE SQL AS 'SELECT 1';" \
    >/dev/null
  future_matrix="$(psql_admin_query "${database}" \
    "SELECT concat_ws('|', has_table_privilege('${writer_role}','${stale_schema}.${future_table}','UPDATE')::text, has_sequence_privilege('${writer_role}','${stale_schema}.${future_sequence}','USAGE')::text, has_sequence_privilege('${writer_role}','${stale_schema}.${future_sequence}','UPDATE')::text, has_function_privilege('${writer_role}','${stale_schema}.${future_function}()','EXECUTE')::text);")"
  [[ "${future_matrix}" == "false|false|false|false" ]] || \
    fail "writer inherited stale default privileges on future objects (${future_matrix})"
  psql_admin_command "${database}" \
    "DROP TABLE \"${stale_schema}\".\"${future_table}\"; DROP SEQUENCE \"${stale_schema}\".\"${future_sequence}\"; DROP FUNCTION \"${stale_schema}\".\"${future_function}\"();" \
    >/dev/null

  # Foreign-owner PUBLIC defaults likewise cannot be rewritten by this
  # dedicated-role contract and must stop the gate until the owner removes them.
  psql_admin_command "${database}" \
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" GRANT SELECT ON TABLES TO PUBLIC; ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" GRANT USAGE ON SEQUENCES TO PUBLIC;" \
    >/dev/null
  expect_role_contract_failure "${database}" "${writer_role}" "${seed_label}-public-default-acl"
  psql_admin_command "${database}" \
    "ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" REVOKE SELECT ON TABLES FROM PUBLIC; ALTER DEFAULT PRIVILEGES FOR ROLE \"${ADMIN_ROLE}\" IN SCHEMA \"${stale_schema}\" REVOKE USAGE ON SEQUENCES FROM PUBLIC;" \
    >/dev/null
  apply_role_contract "${database}" "${writer_role}"
}

probe_database_role_setting_fail_closed() {
  database="$1"
  writer_role="$2"
  seed_label="$3"
  psql_admin_command "${database}" \
    "ALTER DATABASE \"${database}\" SET session_replication_role TO replica;" \
    >/dev/null
  expect_role_contract_failure "${database}" "${writer_role}" \
    "${seed_label}-database-replication-default"
  psql_admin_command "${database}" \
    "ALTER DATABASE \"${database}\" RESET session_replication_role;" \
    >/dev/null
  apply_role_contract "${database}" "${writer_role}"

  psql_admin_command "${database}" \
    'ALTER ROLE ALL SET session_replication_role TO replica;' \
    >/dev/null
  expect_role_contract_failure "${database}" "${writer_role}" \
    "${seed_label}-global-replication-default"
  psql_admin_command "${database}" \
    'ALTER ROLE ALL RESET session_replication_role;' \
    >/dev/null
  apply_role_contract "${database}" "${writer_role}"
}

prove_normalized_writer_role() {
  database="$1"
  writer_role="$2"
  seed_label="$3"
  stale_schema="p0_tw_stale_${seed_label}"
  seed_stale_writer_authority "${database}" "${writer_role}" "${seed_label}"
  prove_role_contract_atomicity "${database}" "${writer_role}" "${seed_label}"
  apply_role_contract "${database}" "${writer_role}"
  assert_exact_writer_role "${database}" "${writer_role}" "${seed_label}"
  apply_role_contract "${database}" "${writer_role}"
  assert_exact_writer_role "${database}" "${writer_role}" "${seed_label}"
  probe_public_authority_fail_closed "${database}" "${writer_role}" "${seed_label}"
  assert_exact_writer_role "${database}" "${writer_role}" "${seed_label}"
  probe_owned_object_fail_closed "${database}" "${writer_role}" "${seed_label}"
  assert_exact_writer_role "${database}" "${writer_role}" "${seed_label}"
  probe_default_acl_contract "${database}" "${writer_role}" "${seed_label}"
  assert_exact_writer_role "${database}" "${writer_role}" "${seed_label}"
  probe_database_role_setting_fail_closed "${database}" "${writer_role}" "${seed_label}"
  assert_exact_writer_role "${database}" "${writer_role}" "${seed_label}"
  expect_writer_denied "${database}" "${writer_role}" "${seed_label}-replication-role" \
    'SET session_replication_role=replica;'
  expect_writer_denied "${database}" "${writer_role}" "${seed_label}-update" \
    'UPDATE "CreditTruthScope" SET "createdAt"="createdAt" WHERE false;'
  expect_writer_denied "${database}" "${writer_role}" "${seed_label}-delete" \
    'DELETE FROM "CreditTruthScope" WHERE false;'
  expect_writer_denied "${database}" "${writer_role}" "${seed_label}-truncate" \
    'TRUNCATE TABLE "CreditTruthScope";'
  expect_writer_denied "${database}" "${writer_role}" "${seed_label}-schema-create" \
    'CREATE TABLE public.p0_tw_forbidden_table (id integer);'
  expect_writer_denied "${database}" "${writer_role}" "${seed_label}-sequence" \
    "SELECT nextval('${stale_schema}.stale_sequence');"
  expect_writer_denied "${database}" "${writer_role}" "${seed_label}-routine" \
    "SELECT ${stale_schema}.stale_function();"
  expect_writer_denied "${database}" "${writer_role}" "${seed_label}-create-role" \
    "CREATE ROLE p0_tw_forbidden_role_${seed_label};"
  expect_writer_denied "${database}" "${writer_role}" "${seed_label}-create-database" \
    "CREATE DATABASE p0_tw_forbidden_database_${seed_label};"
}

run_transaction_probes() {
  database="$1"
  writer_role="$2"
  pass_number="$3"
  prefix="tw-shell-${pass_number}-$$-${RANDOM}"
  rollback_user="${prefix}-rollback"
  interrupted_user="${prefix}-interrupted"
  concurrent_user="${prefix}-concurrent"

  psql_admin_command "${database}" \
    "INSERT INTO \"User\" (\"id\",\"email\",\"role\",\"isAgency\") VALUES ('${rollback_user}','${rollback_user}@synthetic.invalid','USER',false),('${interrupted_user}','${interrupted_user}@synthetic.invalid','USER',false),('${concurrent_user}','${concurrent_user}@synthetic.invalid','USER',false);" \
    >/dev/null

  rollback_count="$(psql_writer_query "${database}" "${writer_role}" \
    "BEGIN; INSERT INTO \"CreditTruthScope\" (\"tenantId\",\"consumerId\",\"createdAt\") VALUES ('${rollback_user}','${rollback_user}',now()); ROLLBACK; SELECT count(*) FROM \"CreditTruthScope\" WHERE \"tenantId\"='${rollback_user}' AND \"consumerId\"='${rollback_user}';")"
  [[ "${rollback_count}" == "0" ]] || fail "writer rollback left durable scope state"

  interruption_log="${current_pass_dir}/transaction-interruption.log"
  set +e
  local_docker exec "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --username "${writer_role}" --dbname "${database}" \
    --command "BEGIN; INSERT INTO \"CreditTruthScope\" (\"tenantId\",\"consumerId\",\"createdAt\") VALUES ('${interrupted_user}','${interrupted_user}',now()); SET LOCAL statement_timeout='100ms'; SELECT pg_sleep(1); COMMIT;" \
    >"${interruption_log}" 2>&1
  interrupted_status=$?
  set -e
  [[ "${interrupted_status}" -ne 0 ]] || fail "transaction interruption probe unexpectedly committed"
  grep -q "canceling statement due to statement timeout" "${interruption_log}" || \
    fail "transaction interruption did not produce the bounded PostgreSQL timeout"
  interrupted_count="$(psql_writer_query "${database}" "${writer_role}" \
    "SELECT count(*) FROM \"CreditTruthScope\" WHERE \"tenantId\"='${interrupted_user}' AND \"consumerId\"='${interrupted_user}';")"
  [[ "${interrupted_count}" == "0" ]] || fail "interrupted transaction left partial scope state"

  concurrency_one="${current_pass_dir}/concurrency-one.log"
  concurrency_two="${current_pass_dir}/concurrency-two.log"
  set +e
  local_docker exec "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --username "${writer_role}" --dbname "${database}" \
    --command "INSERT INTO \"CreditTruthScope\" (\"tenantId\",\"consumerId\",\"createdAt\") VALUES ('${concurrent_user}','${concurrent_user}',now()) ON CONFLICT (\"tenantId\",\"consumerId\") DO NOTHING;" \
    >"${concurrency_one}" 2>&1 &
  concurrency_pid_one=$!
  local_docker exec "${active_container}" psql -X --set=ON_ERROR_STOP=1 \
    --username "${writer_role}" --dbname "${database}" \
    --command "INSERT INTO \"CreditTruthScope\" (\"tenantId\",\"consumerId\",\"createdAt\") VALUES ('${concurrent_user}','${concurrent_user}',now()) ON CONFLICT (\"tenantId\",\"consumerId\") DO NOTHING;" \
    >"${concurrency_two}" 2>&1 &
  concurrency_pid_two=$!
  wait "${concurrency_pid_one}"
  concurrency_status_one=$?
  wait "${concurrency_pid_two}"
  concurrency_status_two=$?
  set -e
  [[ "${concurrency_status_one}" -eq 0 && "${concurrency_status_two}" -eq 0 ]] || \
    fail "concurrent least-privilege scope bootstrap failed"
  concurrent_count="$(psql_writer_query "${database}" "${writer_role}" \
    "SELECT count(*) FROM \"CreditTruthScope\" WHERE \"tenantId\"='${concurrent_user}' AND \"consumerId\"='${concurrent_user}';")"
  [[ "${concurrent_count}" == "1" ]] || fail "concurrent scope bootstrap did not converge to one row"
}

run_real_adapter_test() {
  writer_url="$1"
  admin_url="$2"
  writer_role="$3"
  writer_password="$4"
  admin_password="$5"
  log_file="${current_pass_dir}/real-adapter.log"
  if ! env -i \
      PATH="${PATH}" HOME="${HOME}" TMPDIR=/private/tmp NODE_ENV=test \
      DATABASE_URL="${writer_url}" \
      P0_TW_DISPOSABLE_WRITER_URL="${writer_url}" \
      P0_TW_DISPOSABLE_ADMIN_URL="${admin_url}" \
      P0_TW_DISPOSABLE_WRITER_ROLE="${writer_role}" \
      P0_TW_DISPOSABLE_VALIDATOR_OWNER="${VALIDATOR_OWNER}" \
      node --import tsx "${REAL_ADAPTER_TEST}" >"${log_file}" 2>&1; then
    redact_log "${log_file}" "${writer_password}" "${admin_password}" >&2
    fail "real-adapter positive/attack/concurrency matrix failed"
  fi
  redact_log "${log_file}" "${writer_password}" "${admin_password}"
}

run_pristine_pass() {
  pass_number="$1"
  current_pass_dir="${tmp_root}/pass-${pass_number}"
  mkdir -p "${current_pass_dir}"
  create_isolated_node_modules "${current_pass_dir}"

  run_token="${pass_number}-$$-${RANDOM}"
  active_container="creditvector-p0-tw-disposable-${run_token}"
  primary_database="p0_tw_primary_${pass_number}_$$_${RANDOM}"
  rebuild_database="p0_tw_rebuild_${pass_number}_$$_${RANDOM}"
  writer_role="p0_writer_${pass_number}_$$_${RANDOM}"
  primary_role_seed="primary_${pass_number}_$$_${RANDOM}"
  rebuild_role_seed="rebuild_${pass_number}_$$_${RANDOM}"
  admin_password="p0twa$(openssl rand -hex 24)"
  writer_password="p0tww$(openssl rand -hex 24)"

  [[ "${active_container}" =~ ^creditvector-p0-tw-disposable-[12]-[0-9]+-[0-9]+$ ]] || fail "unsafe container name"
  [[ "${primary_database}" =~ ^p0_tw_primary_[12]_[0-9]+_[0-9]+$ ]] || fail "unsafe primary database name"
  [[ "${rebuild_database}" =~ ^p0_tw_rebuild_[12]_[0-9]+_[0-9]+$ ]] || fail "unsafe rebuild database name"
  [[ "${writer_role}" =~ ^p0_writer_[a-z0-9_]{1,48}$ ]] || fail "unsafe writer role name"

  say "pass ${pass_number}: starting pristine pinned PostgreSQL 16.14"
  local_docker run --detach --rm --pull=never \
    --name "${active_container}" \
    --label creditvector.p0.disposable=true \
    --publish 127.0.0.1::5432 \
    --env POSTGRES_USER="${ADMIN_ROLE}" \
    --env POSTGRES_PASSWORD="${admin_password}" \
    --env POSTGRES_DB="${primary_database}" \
    "${POSTGRES_IMAGE_ID}" >/dev/null

  postgres_ready=0
  for _ready_attempt in $(seq 1 240); do
    if local_docker exec "${active_container}" pg_isready \
      --username "${ADMIN_ROLE}" --dbname "${primary_database}" >/dev/null 2>&1; then
      postgres_ready=1
      break
    fi
    sleep 0.25
  done
  [[ "${postgres_ready}" -eq 1 ]] || fail "disposable PostgreSQL did not become ready"
  postgres_version="$(local_docker exec "${active_container}" postgres --version)"
  [[ "${postgres_version}" == "${POSTGRES_VERSION_PREFIX}"* ]] || \
    fail "disposable PostgreSQL is not the exact required 16.14 release"

  port_binding="$(local_docker port "${active_container}" 5432/tcp | head -n1)"
  host_port="${port_binding##*:}"
  [[ "${host_port}" =~ ^[0-9]+$ ]] || fail "Docker did not assign a loopback port"
  admin_url="postgresql://${ADMIN_ROLE}:${admin_password}@127.0.0.1:${host_port}/${primary_database}?schema=public"
  writer_url="postgresql://${writer_role}:${writer_password}@127.0.0.1:${host_port}/${primary_database}?schema=public"

  say "pass ${pass_number}: forward migration, explicit no-op, and schema parity"
  deploy_and_prove_schema "primary" "${admin_url}" "${admin_password}" "${writer_password}"

  psql_admin_command "${primary_database}" \
    "CREATE ROLE \"${writer_role}\" LOGIN PASSWORD '${writer_password}'; CREATE ROLE \"${VALIDATOR_OWNER}\" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD NULL;" >/dev/null
  say "pass ${pass_number}: stale-authority normalization and exact writer-role allowlist"
  prove_normalized_writer_role "${primary_database}" "${writer_role}" \
    "${primary_role_seed}"

  say "pass ${pass_number}: privileged-validator rollback, exact apply, and no-op reapply"
  prove_validator_boundary_atomicity "${primary_database}" "${writer_role}" \
    "primary_${pass_number}"
  apply_validator_boundary "${primary_database}" "${writer_role}"
  assert_validator_owner_role "${primary_database}" "${writer_role}"
  apply_validator_boundary "${primary_database}" "${writer_role}"
  assert_validator_owner_role "${primary_database}" "${writer_role}"
  assert_exact_writer_role "${primary_database}" "${writer_role}" \
    "${primary_role_seed}"

  say "pass ${pass_number}: isolated Prisma generation"
  run_prisma "generate" "${writer_url}" "${admin_password}" "${writer_password}" \
    generate --schema "${SCHEMA_FILE}"
  [[ -f "${active_node_modules}/.prisma/client/index.js" ]] || \
    fail "isolated Prisma client was not generated in the disposable link farm"

  say "pass ${pass_number}: real adapter positive, 20-attack, retry, and concurrency matrix"
  run_real_adapter_test "${writer_url}" "${admin_url}" "${writer_role}" \
    "${writer_password}" "${admin_password}"

  say "pass ${pass_number}: rollback, interruption, and concurrent scope probes"
  run_transaction_probes "${primary_database}" "${writer_role}" "${pass_number}"

  say "pass ${pass_number}: pristine migration reconstruction"
  psql_admin_command "${primary_database}" "CREATE DATABASE \"${rebuild_database}\";" >/dev/null
  rebuild_admin_url="postgresql://${ADMIN_ROLE}:${admin_password}@127.0.0.1:${host_port}/${rebuild_database}?schema=public"
  deploy_and_prove_schema "rebuild" "${rebuild_admin_url}" "${admin_password}" "${writer_password}"
  prove_normalized_writer_role "${rebuild_database}" "${writer_role}" \
    "${rebuild_role_seed}"
  apply_validator_boundary "${rebuild_database}" "${writer_role}"
  assert_validator_owner_role "${rebuild_database}" "${writer_role}"
  apply_validator_boundary "${rebuild_database}" "${writer_role}"
  assert_validator_owner_role "${rebuild_database}" "${writer_role}"
  assert_exact_writer_role "${rebuild_database}" "${writer_role}" \
    "${rebuild_role_seed}"
  rebuild_count="$(psql_writer_query "${rebuild_database}" "${writer_role}" 'SELECT count(*) FROM "CreditTruthScope";')"
  [[ "${rebuild_count}" == "0" ]] || fail "pristine rebuild unexpectedly contains P0 scope data"

  psql_admin_command "${primary_database}" \
    "REASSIGN OWNED BY \"${VALIDATOR_OWNER}\" TO \"${ADMIN_ROLE}\"; DROP OWNED BY \"${VALIDATOR_OWNER}\";" >/dev/null
  psql_admin_command "${rebuild_database}" \
    "REASSIGN OWNED BY \"${VALIDATOR_OWNER}\" TO \"${ADMIN_ROLE}\"; DROP OWNED BY \"${VALIDATOR_OWNER}\";" >/dev/null
  psql_admin_command "${primary_database}" \
    "DROP DATABASE \"${rebuild_database}\";" >/dev/null
  psql_admin_command "${primary_database}" \
    "DROP ROLE \"${VALIDATOR_OWNER}\";" >/dev/null
  validator_owner_remaining="$(psql_admin_query "${primary_database}" \
    "SELECT count(*) FROM pg_roles WHERE rolname='${VALIDATOR_OWNER}';")"
  [[ "${validator_owner_remaining}" == "0" ]] || fail "validator owner role survived teardown"

  unlink_isolated_node_modules
  stop_active_container
  admin_password=""
  writer_password=""
  say "pass ${pass_number}: PASS with teardown confirmed"
}

say "DISPOSABLE DATABASE ONLY — no pull, no inherited target, no production connectivity"
say "exact verifier input manifest SHA-256: ${frozen_manifest_digest}"
run_pristine_pass 1
assert_exact_inputs_unchanged "between pristine passes"
run_pristine_pass 2
assert_exact_inputs_unchanged "after pristine pass 2"

[[ ! -e "${REPO_ROOT}/node_modules" && ! -L "${REPO_ROOT}/node_modules" ]] || \
  fail "isolated node_modules leaked into the P0 worktree"
say "exact verifier inputs remained byte-identical across both pristine passes"
sed 's/^/  /' "${frozen_input_manifest}"
say "2/2 PASS p0-trusted-writer-disposable-verify (PostgreSQL 16.14, teardown confirmed)"
