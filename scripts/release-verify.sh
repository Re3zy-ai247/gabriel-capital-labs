#!/usr/bin/env bash
# RC1 P0-5 release verification — repeatable prod smoke test (the OPERATIONS.md post-deploy probes,
# executable). Verifies: public routes 200, auth gates 401/403 (never 200-with-effect), health live,
# security headers present, and x-cv-release consistency. Read-only. Usage:
#   scripts/release-verify.sh [BASE_URL] [EXPECTED_SHA]   (defaults: prod, no SHA check)
set -uo pipefail
BASE="${1:-https://www.creditvector.app}"
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
check /api/letters    401   # authed API, unauth → 401 (never 200-with-effect)
check /api/admin/overview     403
check /api/admin/diagnostics  403

echo "▶ Security headers (/)"
H=$(curl -sI "$BASE/")
for h in x-content-type-options x-frame-options referrer-policy strict-transport-security permissions-policy x-cv-release; do
  if grep -qi "^$h:" <<<"$H"; then printf "  OK   %s\n" "$h"; else printf "  FAIL missing %s\n" "$h"; fail=1; fi
done

REL=$(grep -i '^x-cv-release:' <<<"$H" | tr -d '\r' | awk '{print $2}')
echo "▶ Release: x-cv-release=$REL"
if [ -n "$EXPECT_SHA" ]; then
  if [ "$REL" = "${EXPECT_SHA:0:12}" ]; then echo "  OK   exactly matches expected ${EXPECT_SHA:0:12}"
  else echo "  FAIL x-cv-release=$REL != exact expected ${EXPECT_SHA:0:12} (deploy skew or malformed header)"; fail=1; fi
fi

echo "▶ Health: $(curl -s "$BASE/api/health")"
[ "$fail" = 0 ] && echo "✅ release-verify PASS" || echo "❌ release-verify FAIL"
exit $fail
