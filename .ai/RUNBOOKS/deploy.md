# Runbook: Deploy

**Prod:** https://www.creditvector.app · Vercel project `gabriel-capital-labs` (team `rey-gabriel-s-projects`) · CLI via `npx vercel` only, auth'd `re3zy-ai247`.

## Ship code
1. Validate first (`TESTING.md`): typecheck + relevant guards (+ `next build` for structural changes).
2. **Confirm with the owner before pushing** — push to `main` = production deploy (~2 min auto).
3. After deploy: prod probes (public 200, protected 401/403).

## Schema: apply the release migrations BEFORE promoting (RC1, required)

`vercel.json`'s build command is `prisma generate && next build` — it does **not**
apply migrations. Two tables in this release are created only by a reviewed
migration and have **no runtime self-heal fallback** (migration-first law,
`CLAUDE.md` gotcha 1). If the code is promoted first, `POST /api/register` throws
with no try/catch: **no consumer can create an account**, and letter generation,
`/tradelines` and the assertion routes fail too.

The two, in dependency order:

1. `20260728000000_terms_acceptance` — creates `TermsAcceptance`
2. `20260823120000_consumer_assertion` — creates `ConsumerAssertion`

Apply them in that order, **against the DIRECT Postgres connection string — never
the Prisma Accelerate proxy URL**. Accelerate is a query proxy and cannot run
migrations (same reason the repo's self-heal tables exist at all; see
`OPERATIONS.md` "Accelerate" and `lib/rateLimit.ts`'s self-heal comment).

```bash
# 1. Use the DIRECT url for this step only. Do NOT use the prisma:// Accelerate URL.
export DATABASE_URL="postgres://…direct-host…/db?sslmode=require"

# 2. Apply, in dependency order. `migrate deploy` applies pending migrations in
#    filename order and is idempotent — re-running it is safe.
npx prisma migrate deploy

# 3. Verify BOTH tables exist before promoting anything.
npx prisma db execute --stdin <<'SQL'
SELECT to_regclass('"TermsAcceptance"') AS terms,
       to_regclass('"ConsumerAssertion"') AS assertion;
SQL
# Both columns must be non-NULL. A NULL means that migration did not apply.
```

4. Only now promote the deployment.
5. Confirm from outside: `scripts/release-verify.sh <BASE_URL> <SHA>` must print
   `OK schema` and `OK encryption`. `/api/health/ready` returns **503** with
   `"schema":"incomplete"` and a `missingTables` list while either table is
   absent, so a mis-ordered deploy is a refused promotion rather than a silent
   outage.

**Rollback note:** these two migrations are additive (new tables only). Rolling
the *code* back does not require rolling the schema back.

## Env-var-only change (no code)
```bash
npx vercel env add <NAME> production
npx vercel ls gabriel-capital-labs --prod     # get latest prod deployment URL
npx vercel redeploy <that-url>                # required for env vars to take effect
```

## Preview before prod (big/visual changes)
Branch → `git push -u origin <branch>` → Vercel auto-builds a Preview. URL via `npx vercel ls gabriel-capital-labs` (Environment=Preview). **Preview URLs 401 to anonymous** (Deployment Protection — that's auth, not failure); view logged into the Vercel account. Ship = merge to `main` (fast-forward) → push.

## Gotchas
- Build command lives in `vercel.json`, NOT package.json (`prisma generate && next build`; no database mutation).
- Schema changes do NOT deploy via push — see `schema-change.md`, and apply the release migrations first (section above).

## Operations
Deployment protocol, incident triage (x-cv-release skew rule), CDN cache contract, and the skew-protection posture live in the root [OPERATIONS.md](../../OPERATIONS.md) — read it before changing deploy behavior.
