#!/usr/bin/env bash
# RC1 P0-5 release verification — repeatable prod smoke test (the OPERATIONS.md post-deploy probes,
# executable). Verifies: public routes 200, auth gates 401/403 (never 200-with-effect), liveness,
# database readiness, security headers, and x-cv-release consistency. Read-only. Usage:
#   scripts/release-verify.sh BASE_URL [EXPECTED_SHA]   (explicit target required)
set -uo pipefail
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] || [ -z "${1:-}" ]; then
  echo "Usage: scripts/release-verify.sh BASE_URL [EXPECTED_SHA]" >&2
  exit 64
fi
BASE="$1"
EXPECT_SHA="${2:-}"
fail=0

check() { # path expected_code
  local code; code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$1")
  if [ "$code" = "$2" ]; then printf "  OK   %-26s %s\n" "$1" "$code"
  else printf "  FAIL %-26s got %s want %s\n" "$1" "$code" "$2"; fail=1; fi
}

echo "▶ Routes ($BASE)"
check /               200
check /login          200
check /pricing        200
check /api/health     200
check /api/health/ready 200
check /api/letters    401   # authed API, unauth → 401 (never 200-with-effect)
check /api/admin/overview     403
check /api/admin/diagnostics  403

echo "▶ Security headers (/)"
H=$(curl -sI "$BASE/")

final_header_lines=""
release_values=()
release_continuation=0
release_malformed=0
while IFS= read -r header_line || [ -n "$header_line" ]; do
  header_line=${header_line%$'\r'}
  if [[ "$header_line" =~ ^HTTP/[0-9.]+[[:space:]] ]]; then
    # curl can expose interim/proxy responses before the final response. Only
    # the final response is release evidence, so reset every response block.
    final_header_lines=""
    release_values=()
    release_continuation=0
    release_malformed=0
    continue
  fi
  final_header_lines+="$header_line"$'\n'
  if [[ "$header_line" =~ ^[[:space:]] ]]; then
    [ "$release_continuation" -eq 1 ] && release_malformed=1
    continue
  fi
  release_continuation=0
  if [[ "$header_line" != *:* ]]; then
    continue
  fi
  header_name=${header_line%%:*}
  header_value=${header_line#*:}
  if [[ "$header_name" =~ ^[Xx]-[Cc][Vv]-[Rr][Ee][Ll][Ee][Aa][Ss][Ee]$ ]]; then
    release_continuation=1
    header_value=$(printf '%s' "$header_value" | sed -E 's/^[[:blank:]]+//; s/[[:blank:]]+$//')
    release_values[${#release_values[@]}]=$header_value
  fi
done <<<"$H"

for h in x-content-type-options x-frame-options referrer-policy strict-transport-security permissions-policy x-cv-release; do
  if grep -qi "^$h:" <<<"$final_header_lines"; then printf "  OK   %s\n" "$h"; else printf "  FAIL missing %s\n" "$h"; fail=1; fi
done

REL=""
if [ "$release_malformed" -ne 0 ] || [ "${#release_values[@]}" -ne 1 ] || ! [[ "${release_values[0]:-}" =~ ^[0-9a-f]{12}$ ]]; then
  echo "▶ Release: malformed or non-unique x-cv-release header"
  fail=1
else
  REL=${release_values[0]}
  echo "▶ Release: x-cv-release=$REL"
fi
if [ -n "$EXPECT_SHA" ]; then
  if ! [[ "$EXPECT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "  FAIL expected SHA must be a full lowercase 40-character Git SHA"; fail=1
  elif [ "$REL" = "${EXPECT_SHA:0:12}" ]; then
    echo "  OK   exactly matches expected ${EXPECT_SHA:0:12}"
  else
    echo "  FAIL x-cv-release=${REL:-<invalid>} != exact expected ${EXPECT_SHA:0:12} (deploy skew or malformed header)"; fail=1
  fi
fi

echo "▶ Liveness: $(curl -s "$BASE/api/health")"
READY_BODY=$(curl -s "$BASE/api/health/ready")
echo "▶ Readiness: $READY_BODY"

# S11 · X-1/X-6. The status code above already fails a degraded deployment, but a
# refused promotion must SAY which dependency is missing — otherwise an operator
# reads "503" and redeploys the same broken thing. These three name the two
# failures that take a core consumer flow to zero:
#   schema      — a deployment whose required database state is absent
#                 (registration throws with no try/catch: nobody can sign up).
#                 This verifier detects the failure only; it never authorizes or
#                 executes a database change.
#   encryption  — DOCUMENT_ENCRYPTION_KEY absent (100% of report intake fails)
# Both are dependencies of the RELEASE, not of the process, so they belong here
# and not in the liveness probe.
# S11 · CE2-3. The spend ceilings have working defaults, so nothing fails without
# them — which is how a $50/day platform-wide AI pause becomes a launch-day
# surprise. Print what is in force so a promotion leaves a record of it. Values
# only bind if they are exported here; blank means "the default applies".
echo "▶ AI spend ceilings (defaults apply when unset)"
echo "  AI_DAILY_BUDGET_USD_GLOBAL   = ${AI_DAILY_BUDGET_USD_GLOBAL:-<unset — default 50.00/day platform-wide>}"
echo "  AI_DAILY_BUDGET_USD_PER_USER = ${AI_DAILY_BUDGET_USD_PER_USER:-<unset — default 1.00/day per consumer>}"
echo "  HEALTH_READY_DB_TTL_MS       = ${HEALTH_READY_DB_TTL_MS:-<unset — default 5000 ms>}"
if [ -z "${AI_DAILY_BUDGET_USD_GLOBAL:-}" ]; then
  echo "  NOTE  the platform ceiling is a Founder decision; at the \$1.00 per-consumer default,"
  echo "        ~50 consumers at full allowance pause AI product-wide until 00:00 UTC."
fi

echo "▶ Readiness dependencies"
case "$READY_BODY" in
  *'"schema":"ok"'*)     echo "  OK   schema      required migrations are applied" ;;
  *)                     echo "  FAIL schema      required tables missing";
                         echo "       NON-AUTHORIZING: this verifier grants no database or migration authority.";
                         echo "       Do not run a migration from this verifier; follow .ai/RUNBOOKS/gate-d-production-migration.md under separate Founder authority.";
                         fail=1 ;;
esac
case "$READY_BODY" in
  *'"encryption":"ok"'*) echo "  OK   encryption   DOCUMENT_ENCRYPTION_KEY usable" ;;
  *)                     echo "  FAIL encryption   DOCUMENT_ENCRYPTION_KEY absent or not 32 bytes — report intake would fail for every consumer"; fail=1 ;;
esac
case "$READY_BODY" in
  *'"status":"ready"'*)  echo "  OK   status      ready" ;;
  *)                     echo "  FAIL status      readiness did not report ready"; fail=1 ;;
esac
[ "$fail" = 0 ] && echo "✅ release-verify PASS" || echo "❌ release-verify FAIL"
exit $fail
