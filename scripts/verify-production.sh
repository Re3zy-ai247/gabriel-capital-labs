#!/usr/bin/env bash
# CreditVector RC1 production verification harness.
#
# USAGE
#   bash scripts/verify-production.sh              # repository checks only (offline, default)
#   bash scripts/verify-production.sh --probe      # + read-only unauthenticated probes of BASE
#   CV_BASE_URL=https://... bash scripts/verify-production.sh --probe
#   CV_VERIFY_OUT=/some/dir bash scripts/verify-production.sh   # also write report files there
#
# WHAT THIS IS
#   CREDITVECTOR_RC1_CRITERIA.md §6 lists questions that "cannot be answered from the
#   repository". This turns the answerable part of that list into a repeatable, safe
#   check, and — for the part that genuinely needs production credentials — prints the
#   exact owner command instead of guessing. It is a harness, NOT a second Go/No-Go
#   checklist: CREDITVECTOR_RC1_CRITERIA.md remains the canonical gate.
#
# THE FOUR STATUSES (nothing else is ever printed)
#   PASS                            proven here, now, from the repository or a live probe
#   FAIL                            proven WRONG — this exits non-zero
#   VERIFICATION REQUIRED — PROD    needs a credential this repo does not and must not hold
#   NOT RUN — ENVIRONMENT           a prerequisite (node_modules, curl, network) is absent
#   An unknown is never scored PASS. That is the fail-closed rule this file exists to hold.
#
# HARD INVARIANTS
#   1. NO SECRET VALUE IS EVER PRINTED. Every secret check is presence/absence only.
#      A check that echoes a secret is a security defect, not a verbose check.
#   2. READ-ONLY ALWAYS. There is no mutating mode and no flag that adds one. Remediations
#      that mutate production (the encryption backfill, Stripe catalog provisioning,
#      setting an env var) are PRINTED for the owner to run deliberately and are never
#      executed here — a verification tool that repairs what it measures cannot be trusted
#      to measure it. The default run does not leave the repository at all; --probe adds
#      unauthenticated GET/POST probes that every handler rejects before any side effect,
#      which is the same discipline scripts/prod-health.sh already uses.
#   3. REPOSITORY vs PRODUCTION is stated per section and never blurred.
set -uo pipefail

BASE="${CV_BASE_URL:-https://www.creditvector.app}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROBE=0

for arg in "$@"; do
  case "$arg" in
    --probe) PROBE=1 ;;
    -h|--help) sed -n '2,30p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; echo "usage: bash scripts/verify-production.sh [--probe]" >&2; exit 64 ;;
  esac
done

PASSES=0; FAILURES=0; VERIFYS=0; SKIPS=0
REPORT=""

record() { # status(pass|fail|verify|env), name, detail
  local line
  case "$1" in
    pass)   PASSES=$((PASSES+1));   line="✓ PASS                         $2 — $3" ;;
    fail)   FAILURES=$((FAILURES+1)); line="✗ FAIL                         $2 — $3" ;;
    verify) VERIFYS=$((VERIFYS+1)); line="? VERIFICATION REQUIRED — PROD $2 — $3" ;;
    env)    SKIPS=$((SKIPS+1));     line="· NOT RUN — ENVIRONMENT        $2 — $3" ;;
    *)      FAILURES=$((FAILURES+1)); line="✗ FAIL                         $2 — bad status '$1'" ;;
  esac
  REPORT="${REPORT}${line}"$'\n'
  echo "$line"
}
note() { echo "      ↳ $1"; REPORT="${REPORT}      ↳ $1"$'\n'; }

have() { command -v "$1" >/dev/null 2>&1; }
src() { cat "$ROOT/$1" 2>/dev/null; }
code_of() { curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$@" 2>/dev/null; }

echo "── CreditVector production verification · $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "   repository: ${ROOT}"
echo "   probe target: $([ "$PROBE" = 1 ] && echo "${BASE}" || echo "(disabled — pass --probe to enable read-only probes)")"
echo

# ═════════════════════════════════════════════════════════════════════════════
# SECTION 1 — REPOSITORY VALIDATION (runs here, now, with no credentials)
# ═════════════════════════════════════════════════════════════════════════════
echo "SECTION 1 — REPOSITORY VALIDATION"

# 1.1 Alerting wiring. The repo can prove the DELIVERY PATH exists and that the var
#     is presence-reported; it cannot prove the var is set in production (that is 1.11).
OBS="$(src lib/observability.ts)"
if [ -z "$OBS" ]; then
  record fail "alerting: delivery path" "lib/observability.ts not found"
else
  # Statement-level, not a mention: a comment referencing the var must not satisfy this.
  if grep -qE 'process\.env\.ALERT_WEBHOOK_URL' <<<"$OBS"; then
    record pass "alerting: delivery path exists" "lib/observability.ts forwards to ALERT_WEBHOOK_URL"
  else
    record fail "alerting: delivery path exists" "lib/observability.ts no longer references ALERT_WEBHOOK_URL"
  fi
  # The alert payload must never carry the destination or any key.
  if grep -qE 'body:.*ALERT_WEBHOOK_URL|JSON\.stringify\([^)]*ALERT_WEBHOOK_URL' <<<"$OBS"; then
    record fail "alerting: no secret in payload" "the webhook URL is being placed INTO the payload"
  else
    record pass "alerting: no secret in payload" "the destination URL is used as a target, never as data"
  fi
fi
if grep -q '"ALERT_WEBHOOK_URL"' <<<"$(src app/api/admin/diagnostics/route.ts)"; then
  record pass "alerting: presence is observable" "/api/admin/diagnostics reports ALERT_WEBHOOK_URL presence"
else
  record fail "alerting: presence is observable" "ALERT_WEBHOOK_URL missing from the diagnostics presence list"
fi

# 1.2 The presence oracle must return BOOLEANS, never values. This is the one endpoint
#     the owner uses to answer every "is X configured?" question, so if it ever returned
#     values it would turn the whole verification workflow into a credential leak.
DIAG="$(src app/api/admin/diagnostics/route.ts)"
if grep -q 'envPresent\[k\] = Boolean(process.env\[k\])' <<<"$DIAG"; then
  record pass "diagnostics returns presence only" "envPresent is Boolean(process.env[k]) — values never leave the server"
else
  record fail "diagnostics returns presence only" "the env readout no longer coerces to Boolean — it may be returning VALUES"
fi
if grep -qE 'process\.env\[k\](\s*)(,|\})' <<<"$DIAG"; then
  record fail "diagnostics leaks no raw value" "a raw process.env[k] is being returned"
else
  record pass "diagnostics leaks no raw value" "no raw env value is placed in the response"
fi
if grep -qE 'await requireAdmin\(\)' <<<"$DIAG"; then
  record pass "diagnostics is admin-gated" "requireAdmin() precedes the readout"
else
  record fail "diagnostics is admin-gated" "the presence oracle is not behind requireAdmin()"
fi

# 1.3 SETUP_SECRET — WHICH routes it gates, and HOW it may be presented.
#     A secret accepted in the query string is written to every access log, proxy log and
#     browser history it passes through; that is RC1 finding C-01. Enumerate rather than
#     assume, so a route added later shows up here instead of silently widening the surface.
SETUP_ROUTES="$(cd "$ROOT" && grep -rl 'SETUP_SECRET' --include=route.ts app 2>/dev/null | sort)"
if [ -z "$SETUP_ROUTES" ]; then
  record pass "SETUP_SECRET gates no route" "no route reads SETUP_SECRET (the god-mode path is gone from code)"
else
  record pass "SETUP_SECRET gated routes enumerated" "$(wc -l <<<"$SETUP_ROUTES" | tr -d ' ') route(s) accept it"
  while IFS= read -r r; do
    if grep -qE 'searchParams\.get\("secret"\)' "$ROOT/$r"; then
      note "${r} — accepts ?secret= IN THE QUERY STRING (C-01: lands in logs/history)"
    else
      note "${r} — header/body only"
    fi
  done <<<"$SETUP_ROUTES"
  QS_COUNT="$(cd "$ROOT" && grep -rlE 'searchParams\.get\("secret"\)' --include=route.ts app 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$QS_COUNT" != "0" ]; then
    record verify "SETUP_SECRET query-string exposure" "${QS_COUNT} route(s) accept it in the URL — harmless ONLY if the var is unset in prod (see 1.11 / probe 3.1)"
  else
    record pass "SETUP_SECRET is never read from the URL" "header/body only on every gated route"
  fi
fi

# 1.4 Encryption backfill: the tooling and the ciphertext marker must exist. Whether any
#     row still holds plaintext is a DATABASE question (2.x), never a repository one.
CRYPTO="$(src lib/docCrypto.ts)"
if grep -q 'const TEXT_PREFIX = "cv1:"' <<<"$CRYPTO"; then
  record pass "ciphertext marker defined" 'lib/docCrypto.ts pins the "cv1:" prefix that identifies encrypted rows'
else
  record fail "ciphertext marker defined" 'the "cv1:" prefix constant is gone — completeness can no longer be measured'
fi
for r in app/api/admin/encrypt-reports/route.ts app/api/admin/encrypt-letters/route.ts; do
  B="$(src "$r")"
  if [ -z "$B" ]; then record fail "backfill route ${r##app/api/admin/}" "missing"
  elif grep -q 'isEncryptedText(' <<<"$B" && grep -qE 'await requireAdmin\(\)' <<<"$B"; then
    record pass "backfill route ${r##app/api/admin/}" "admin-gated and idempotent (skips rows already cv1:)"
  else
    record fail "backfill route ${r##app/api/admin/}" "not admin-gated, or no longer skips already-encrypted rows"
  fi
done

# 1.5 Stripe catalog ↔ planForPrice mapping consistency (REPOSITORY half of the catalog
#     question). A catalog price whose lookup key no rule recognizes resolves to null, and
#     planForPrice fails CLOSED — so the customer pays and the plan is silently NOT granted.
STRIPE_SRC="$(src lib/stripe.ts)"
# Two catalog entries reference their lookup key through a constant (the original
# monthly keys, kept so existing Stripe prices are reused). Inline those first, or the
# entries parse as empty and the whole mapping check silently skips the live prices.
LOOKUP_SED="$(grep -oE 'export const [A-Z_]+_LOOKUP_KEY = "[^"]+"' <<<"$STRIPE_SRC" \
              | sed -E 's|export const ([A-Z_]+) = "([^"]+)"|s/\\b\1\\b/"\2"/g|')"
PRICES_BLOCK="$(sed -n '/^export const PRICES/,/^};/p' "$ROOT/lib/stripe.ts" 2>/dev/null \
                | sed -f <(printf '%s\n' "$LOOKUP_SED"))"
PLAN_FN="$(sed -n '/^export function planForPrice/,/^}/p' "$ROOT/lib/stripe.ts" 2>/dev/null)"
if [ -z "$PRICES_BLOCK" ] || [ -z "$PLAN_FN" ]; then
  record fail "stripe catalog located" "PRICES or planForPrice could not be extracted from lib/stripe.ts"
else
  record pass "stripe catalog located" "$(grep -c 'lookup:' <<<"$PRICES_BLOCK") catalog price(s), planForPrice found"
  # Resolve *_CENTS constants to numbers so both sides compare as values.
  CENTS_SED="$(grep -oE 'export const [A-Z_]+_CENTS = [0-9]+' <<<"$STRIPE_SRC" | awk '{print "s/\\b" $3 "\\b/" $5 "/g"}')"
  AMT_RULES="$(sed -n '/const amt =/,$p' <<<"$PLAN_FN" | sed -f <(printf '%s\n' "$CENTS_SED"))"
  # lookup-key prefix rules, in source order (first match wins, exactly as the code runs).
  PREFIX_RULES="$(grep -oE 'lk\.startsWith\("[^"]+"\)\) return "[a-z_]+"' <<<"$PLAN_FN" \
                  | sed -E 's/lk\.startsWith\("([^"]+)"\)\) return "([a-z_]+)"/\1 \2/')"
  MAP_BAD=0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    grep -q 'lookup:' <<<"$line" || continue
    LK="$(grep -oE 'lookup: "[^"]+"' <<<"$line" | sed -E 's/lookup: "(.*)"/\1/')"
    PROD="$(grep -oE 'product: "[^"]+"' <<<"$line" | sed -E 's/product: "(.*)"/\1/')"
    ONE_TIME=0; grep -q 'interval: null' <<<"$line" && ONE_TIME=1
    AMT="$(grep -oE 'amountCents: [A-Za-z0-9_]+' <<<"$line" | awk '{print $2}' | sed -f <(printf '%s\n' "$CENTS_SED"))"
    if [ "$ONE_TIME" = 1 ]; then
      # A one-time pack must NOT resolve to a subscription tier: that would provision a
      # paid plan off a $19 purchase on any price whose lookup key was lost.
      if grep -q "=== ${AMT}\b" <<<"$AMT_RULES"; then
        record fail "one-time price ${LK} does not map to a plan" "amount ${AMT} is matched by planForPrice — a letter pack would grant a subscription tier"
        MAP_BAD=1
      fi
      continue
    fi
    RESOLVED=""
    while read -r pfx plan; do
      [ -z "$pfx" ] && continue
      case "$LK" in "$pfx"*) [ -z "$RESOLVED" ] && RESOLVED="$plan" ;; esac
    done <<<"$PREFIX_RULES"
    if [ -z "$RESOLVED" ]; then
      record fail "catalog price ${LK} is recognized" "no planForPrice lookup-key rule matches — a live purchase on it grants NOTHING"
      MAP_BAD=1
    elif [ "$RESOLVED" != "$PROD" ]; then
      record fail "catalog price ${LK} maps to its own tier" "catalog says '${PROD}', planForPrice resolves '${RESOLVED}'"
      MAP_BAD=1
    elif ! grep -q "=== ${AMT}\b" <<<"$AMT_RULES"; then
      # Amount fallback matters for a price created by hand in the Dashboard with no
      # lookup key: without it that subscription resolves to null and grants nothing.
      record fail "catalog amount ${AMT} has a fallback rule" "${LK} would not resolve if its lookup_key were absent"
      MAP_BAD=1
    fi
  done <<<"$PRICES_BLOCK"
  [ "$MAP_BAD" = 0 ] && record pass "catalog ↔ planForPrice mapping is consistent" "every subscription price resolves to its own tier by key AND by amount"
  if grep -q 'return null;' <<<"$PLAN_FN"; then
    record pass "unknown price fails closed" "planForPrice returns null rather than guessing a paid tier"
  else
    record fail "unknown price fails closed" "planForPrice has no null return — an unknown price may provision a tier"
  fi
fi

# 1.6 Disabled-account billing behaviour (REPOSITORY half — the policy question is
#     RC1-DISABLED-ACCOUNT-POLICY.md, which is an OWNER DECISION, not a check).
PORTAL="$(src app/api/stripe/portal/route.ts)"
if grep -qE '^\s*const [A-Za-z]+ = await currentAccount\(\);' <<<"$PORTAL"; then
  record pass "billing portal resolves by id and fails closed" "portal uses currentAccount() (id-resolved, re-checks disabled)"
  record verify "disabled-but-paying subscriber can still cancel" "currentAccount() returns null for a disabled account → portal 401. Consequence is documented in RC1-DISABLED-ACCOUNT-POLICY.md; the policy is an OWNER DECISION"
else
  record fail "billing portal resolves by id" "portal no longer uses currentAccount() — it may be resolving by session email"
fi
if [ -n "$(src app/api/admin/billing/cancel/route.ts)" ]; then
  record pass "an administrative cancellation path exists" "POST /api/admin/billing/cancel (admin-gated, audit-logged)"
else
  record fail "an administrative cancellation path exists" "no admin cancellation route — a disabled subscriber could not be stopped at all"
fi
# A decision memo existing is not a verified control, and counting it as a PASS
# inflates the pass total with the wave's own output. This is an owner decision until
# one of the documented options is ratified AND implemented.
if [ -f "$ROOT/RC1-DISABLED-ACCOUNT-POLICY.md" ]; then
  record verify "disabled-account policy is ratified" "options are documented in RC1-DISABLED-ACCOUNT-POLICY.md; none is ratified or implemented — OWNER DECISION REQUIRED"
else
  record fail "disabled-account policy is ratified" "RC1-DISABLED-ACCOUNT-POLICY.md missing — the options were never written down"
fi

# 1.7 Webhook durability: an event claim must be settled, not merely taken. An unsettled
#     claim held by an instance that was killed would dedupe Stripe's retry away forever.
WH="$(src app/api/stripe/webhook/route.ts)"
BILL="$(src lib/billing.ts)"
if grep -qE '^\s*await completeStripeEvent\(event\.id, event\.type\);' <<<"$WH" \
   && grep -q 'ON CONFLICT ("id") DO UPDATE' <<<"$BILL"; then
  record pass "webhook claims are settled, and abandoned claims expire" "claim→handle→settle, with a stale-claim window (see scripts/stripe-lifecycle.test.ts)"
else
  record fail "webhook claims are settled" "the claim is never settled or can never be re-taken — a killed instance loses the event permanently"
fi

# 1.8 Toolchain prerequisites for the validations the Go/No-Go gate requires.
if [ -d "$ROOT/node_modules" ]; then
  record pass "node_modules present" "typecheck / build / lint / guards can run"
else
  record env "node_modules present" "absent — 'npm run typecheck', 'npx next build' and 'npm run lint' CANNOT run here; guards still run via 'npx --no-install tsx'"
fi
for s in typecheck lint build; do
  if grep -q "\"$s\":" "$ROOT/package.json"; then
    record pass "npm script '$s' defined" "package.json declares it"
  else
    record fail "npm script '$s' defined" "missing from package.json"
  fi
done
if have npx; then
  record pass "npx available" "guard scripts are invocable"
else
  record env "npx available" "absent — no guard script can run in this environment"
fi
GUARDS="$(cd "$ROOT" && ls scripts/*.test.ts 2>/dev/null | wc -l | tr -d ' ')"
record pass "guard suite present" "${GUARDS} guard script(s) in scripts/ (run map: .ai/TESTING.md)"
have curl || record env "curl available" "absent — no production probe can run"

# ═════════════════════════════════════════════════════════════════════════════
# SECTION 2 — PRODUCTION VALIDATION (needs credentials this repo must not hold)
# Each line prints the exact owner command. Nothing here is assumed, inferred or
# scored: an unanswered question stays VERIFICATION REQUIRED until a human answers it.
# ═════════════════════════════════════════════════════════════════════════════
echo
echo "SECTION 2 — PRODUCTION VALIDATION (owner/credentialed)"

record verify "ALERT_WEBHOOK_URL is set in production" "presence only — never print the value"
note "npx vercel env ls production | grep -c ALERT_WEBHOOK_URL   # expect exactly 1"
note "or: sign in as ADMIN → GET /api/admin/diagnostics → envPresent.ALERT_WEBHOOK_URL === true"
note "SET is not DELIVERED: the drill in .ai/RUNBOOKS/alert-activation.md is what answers V-05"

record verify "SETUP_SECRET is UNSET in production" "presence only. It is a god-mode setup credential; RC1 C-01 wants it absent once setup is done"
note "npx vercel env ls production | grep -c SETUP_SECRET        # expect exactly 0"
note "or: GET /api/admin/diagnostics → envPresent.SETUP_SECRET === false"
note "unauthenticated presence probe (no value revealed): pass --probe to this script"

record verify "encryption backfill is complete (zero plaintext rows)" "row-level DB fact — not observable from the repository"
note "the measurement is the backfill itself, and it MUTATES: this harness will not run it"
note "owner runs, signed in as ADMIN: POST /api/admin/encrypt-reports and POST /api/admin/encrypt-letters"
note "complete when both return encrypted:0 (idempotent — every remaining row is already cv1:)"
note "answers V-02 / gate 'C-02 zero rows hold plaintext PII'"

record verify "live Stripe catalog matches the repository catalog" "the repo defines what SHOULD exist; only Stripe knows what DOES"
if [ -n "${PRICES_BLOCK:-}" ]; then
  note "expected lookup keys: $(grep -oE 'lookup: "[^"]+"' <<<"$PRICES_BLOCK" | sed -E 's/lookup: "(.*)"/\1/' | tr '\n' ' ')"
fi
note "Stripe Dashboard (LIVE) → Products → Prices: every key above must exist exactly once and be ACTIVE"

record verify "no OUT-OF-BAND live price is purchasable" "a price created by hand, imported, or left from an older packaging"
note "Stripe Dashboard (LIVE) → Products → Prices → include archived=false; list every ACTIVE price"
note "for each price NOT in the expected keys above, check its unit_amount against planForPrice (lib/stripe.ts)"
note "an active price matching NO rule = a customer can pay and receive NOTHING (planForPrice fails closed)"
note "legacy Agency Pro at \$799/mo and \$7,990/yr are DELIBERATELY still mapped — they are not out-of-band"

record verify "disabled accounts hold no live subscription" "identity state lives in our DB; billing state lives in Stripe — neither side sees both"
note "admin UI → Users → filter disabled; for each, check subscriptionStatus"
note "cross-check in Stripe Dashboard (LIVE) → Customers → the matching stripeCustomerId"
note "any disabled account with an ACTIVE subscription is billing a customer who cannot self-cancel"
note "→ decision required: RC1-DISABLED-ACCOUNT-POLICY.md"

record verify "the deployed release is the reviewed commit" "the repo cannot prove what is deployed"
note "curl -sI ${BASE}/ | grep -i x-cv-release   # compare with the reviewed SHA"

# ═════════════════════════════════════════════════════════════════════════════
# SECTION 3 — READ-ONLY PRODUCTION PROBES (--probe only)
# Unauthenticated, side-effect-free. Every handler below rejects before it acts, so
# these observe configuration without exercising it. No credential is sent or read.
# ═════════════════════════════════════════════════════════════════════════════
if [ "$PROBE" = 1 ]; then
  echo
  echo "SECTION 3 — READ-ONLY PRODUCTION PROBES (${BASE})"
  if ! have curl; then
    record env "probes" "curl is unavailable"
  else
    # 3.1 SETUP_SECRET presence, WITHOUT sending or learning any secret. /api/admin/bootstrap
    #     answers 503 when the var is unset and 403 when it is set but the (empty) secret we
    #     send does not match. Both branches return before any seeding happens.
    c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -X POST "${BASE}/api/admin/bootstrap" \
          -H "Content-Type: application/json" -d '{}')
    case "$c" in
      503) record pass "SETUP_SECRET unset in production" "bootstrap answers 503 'not configured' — C-01 god-mode path is closed" ;;
      403) record fail "SETUP_SECRET unset in production" "bootstrap answers 403 — the secret IS configured; any route accepting ?secret= is a live log-exposure risk" ;;
      404) record fail "bootstrap route reachable" "HTTP 404 — route deleted or misrouted by a deploy" ;;
      200) record fail "bootstrap refuses an empty secret" "HTTP 200 — the setup endpoint RAN for an anonymous caller" ;;
      000) record env "SETUP_SECRET presence probe" "no response (network blocked or DNS unavailable)" ;;
      *)   record fail "SETUP_SECRET presence probe" "unexpected HTTP ${c}" ;;
    esac

    # 3.2 Every privileged route must fail closed to an anonymous caller. 404 is a FAILURE:
    #     a deleted route must not be indistinguishable from a locked one.
    for spec in "/api/admin/diagnostics:GET" "/api/admin/migrate:POST" "/api/admin/billing/provision:POST" "/api/agency/enable:POST" "/api/stripe/portal:POST"; do
      path="${spec%%:*}"; verb="${spec##*:}"
      if [ "$verb" = "POST" ]; then
        c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -X POST "${BASE}${path}" -H "Content-Type: application/json" -d '{}')
      else
        c=$(code_of "${BASE}${path}")
      fi
      case "$c" in
        401|403) record pass "gate ${verb} ${path}" "fails closed (HTTP ${c})" ;;
        503)     record pass "gate ${verb} ${path}" "unconfigured, refuses (HTTP 503)" ;;
        200)     record fail "gate ${verb} ${path}" "SERVED 200 TO AN ANONYMOUS CALLER" ;;
        404)     record fail "gate ${verb} ${path}" "ROUTE GONE (HTTP 404) — deleted or misrouted by a deploy" ;;
        000)     record env "gate ${verb} ${path}" "no response (network blocked or DNS unavailable)" ;;
        *)       record fail "gate ${verb} ${path}" "unexpected HTTP ${c}" ;;
      esac
    done

    # 3.3 The Stripe webhook must still reject an unsigned payload — the durability work in
    #     lib/billing.ts is only meaningful behind an intact signature check.
    c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 -X POST "${BASE}/api/stripe/webhook" \
          -H "Content-Type: application/json" -d '{"verify":"probe"}')
    case "$c" in
      400|401|403) record pass "stripe webhook rejects unsigned" "HTTP ${c}" ;;
      503)         record fail "stripe webhook configured" "HTTP 503 — STRIPE_WEBHOOK_SECRET missing; EVERY entitlement event is being dropped" ;;
      200)         record fail "stripe webhook rejects unsigned" "ACCEPTED AN UNSIGNED PAYLOAD (HTTP 200)" ;;
      000)         record env "stripe webhook probe" "no response (network blocked or DNS unavailable)" ;;
      *)           record fail "stripe webhook probe" "unexpected HTTP ${c}" ;;
    esac
  fi
else
  echo
  echo "SECTION 3 — skipped (read-only probes are opt-in: re-run with --probe)"
fi

# ═════════════════════════════════════════════════════════════════════════════
echo
echo "── RESULT: ${PASSES} pass · ${FAILURES} fail · ${VERIFYS} verification required (production) · ${SKIPS} not run (environment)"
if [ "$FAILURES" -gt 0 ]; then
  echo "   ${FAILURES} check(s) FAILED — treat as blocking."
fi
if [ "$VERIFYS" -gt 0 ] || [ "$SKIPS" -gt 0 ]; then
  echo "   $((VERIFYS + SKIPS)) item(s) are UNANSWERED. Unanswered is not passed."
  echo "   A clean run of this harness is NOT a Go. The gate is CREDITVECTOR_RC1_CRITERIA.md."
fi

if [ -n "${CV_VERIFY_OUT:-}" ] && [ -d "${CV_VERIFY_OUT}" ]; then
  {
    echo "checked_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "base=${BASE}"
    echo "probe=${PROBE}"
    echo "pass=${PASSES}"
    echo "fail=${FAILURES}"
    echo "verification_required=${VERIFYS}"
    echo "not_run=${SKIPS}"
  } > "${CV_VERIFY_OUT}/verify-production-summary.txt"
  printf '%s' "$REPORT" > "${CV_VERIFY_OUT}/verify-production-report.txt"
  echo "   wrote ${CV_VERIFY_OUT}/verify-production-{summary,report}.txt"
fi

exit "$([ "$FAILURES" -eq 0 ] && echo 0 || echo 1)"
