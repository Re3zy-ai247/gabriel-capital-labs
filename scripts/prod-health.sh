#!/usr/bin/env bash
# Production health check. Run locally:  bash scripts/prod-health.sh
# Run in CI:                              .github/workflows/daily-health.yml
#
# Read-only and unauthenticated by design. It asserts what an anonymous client on
# the public internet can observe, which is exactly the surface an outage shows up
# on first. It holds NO secrets, so it can never leak one.
#
# Deliberately NOT checked here, because doing so honestly requires credentials
# this job must not hold: database connectivity, AI-provider configuration, and
# whether a cron actually EXECUTED. Asserting those from an unauthenticated probe
# would mean inventing a health endpoint that reports internal state to the world —
# a worse trade than leaving them to the authenticated admin diagnostics page.
# Cron *execution* liveness is therefore a documented human step:
# OPERATIONS.md → "Cron liveness (VERIFICATION REQUIRED)". Check 6 below proves only
# what an anonymous caller can prove — that the cron routes still exist, are gated,
# and have a CRON_SECRET configured at all.
set -uo pipefail

BASE="${CV_BASE_URL:-https://www.creditvector.app}"
FAILURES=0
REPORT=""

record() { # status, name, detail
  local icon="✓"; [ "$1" != "ok" ] && { icon="✗"; FAILURES=$((FAILURES+1)); }
  REPORT="${REPORT}${icon} $2 — $3"$'\n'
  echo "${icon} $2 — $3"
}

code_of() { curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$@"; }

echo "── CreditVector production health · $(date -u '+%Y-%m-%dT%H:%M:%SZ') · ${BASE}"

# 1. Public surface responds.
for path in "/" "/pricing" "/login"; do
  c=$(code_of "${BASE}${path}")
  [ "$c" = "200" ] && record ok "public ${path}" "HTTP ${c}" || record fail "public ${path}" "expected 200, got ${c}"
done

# 2. Authenticated API must FAIL CLOSED to an anonymous caller. A 200 here would
#    mean an auth gate had come off — the single most serious thing this can catch.
#    404 is a FAILURE, not a pass: these routes are supposed to exist, so a 404 means
#    the route was deleted or misrouted by a deploy — the regression this probe exists
#    to catch. Scoring it green is how a missing route looks identical to a locked one.
for path in "/api/agency/clients" "/api/community/threads"; do
  c=$(code_of "${BASE}${path}")
  case "$c" in
    401|403) record ok "auth gate ${path}" "fails closed (HTTP ${c})" ;;
    200) record fail "auth gate ${path}" "SERVED 200 TO AN ANONYMOUS CALLER" ;;
    404) record fail "auth gate ${path}" "ROUTE GONE (HTTP 404) — deleted or misrouted by a deploy" ;;
    *)   record fail "auth gate ${path}" "unexpected HTTP ${c}" ;;
  esac
done

# 3. Stripe webhook is reachable AND still rejects an unsigned payload. This proves
#    the endpoint is up without weakening it: we send a body with no signature and
#    require a 4xx. A 200 would mean signature verification had stopped running.
c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 \
      -X POST "${BASE}/api/stripe/webhook" \
      -H "Content-Type: application/json" -d '{"health":"probe"}')
case "$c" in
  400|401|403) record ok "stripe webhook" "up and rejecting unsigned (HTTP ${c})" ;;
  200) record fail "stripe webhook" "ACCEPTED AN UNSIGNED PAYLOAD (HTTP 200)" ;;
  *)   record fail "stripe webhook" "unexpected HTTP ${c}" ;;
esac

# 4. Release header present — proves the deployment is the one we think it is and
#    gives incident triage its build SHA.
rel=$(curl -sI --max-time 20 "${BASE}/" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-cv-release"{print $2}')
[ -n "$rel" ] && record ok "release header" "x-cv-release ${rel}" || record fail "release header" "missing x-cv-release"

# 5. Crawler policy intact — a regression here silently exposes authenticated
#    routes to indexing.
robots=$(curl -s --max-time 20 "${BASE}/robots.txt")
if echo "$robots" | grep -q "Disallow: /dashboard"; then
  record ok "robots.txt" "authenticated routes disallowed"
else
  record fail "robots.txt" "Disallow rules missing — authed routes may be indexable"
fi

# 6. Cron routes are present and CONFIGURED. This does NOT prove a schedule fired —
#    only production access can (OPERATIONS.md → "Cron liveness"). It does prove, with
#    no credentials, the two silent-death modes the schedule cannot report on itself:
#    the route vanished (404), or CRON_SECRET is unset so the route refuses every
#    invocation (503) and brief ingest/digest are dead while nothing complains.
#    An unauthenticated GET is side-effect-free: both handlers check the secret first.
for path in "/api/cron/brief-ingest" "/api/cron/brief-digest"; do
  c=$(code_of "${BASE}${path}")
  case "$c" in
    401) record ok "cron config ${path}" "CRON_SECRET set, route gated (HTTP 401)" ;;
    503) record fail "cron config ${path}" "CRON_SECRET UNSET — this cron can never run (HTTP 503)" ;;
    404) record fail "cron config ${path}" "ROUTE GONE (HTTP 404) — deleted or misrouted by a deploy" ;;
    200) record fail "cron config ${path}" "RAN FOR AN ANONYMOUS CALLER (HTTP 200)" ;;
    *)   record fail "cron config ${path}" "unexpected HTTP ${c}" ;;
  esac
done

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "RESULT: healthy"
else
  echo "RESULT: ${FAILURES} check(s) failed"
fi

# Emit a machine-readable summary for the workflow to attach to an issue.
{
  echo "checked_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "base=${BASE}"
  echo "failures=${FAILURES}"
} > health-summary.txt
printf '%s' "$REPORT" > health-report.txt

exit "$([ "$FAILURES" -eq 0 ] && echo 0 || echo 1)"
