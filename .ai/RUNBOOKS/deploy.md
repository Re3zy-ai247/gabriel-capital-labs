# Runbook: Deploy

**Prod:** https://www.creditvector.app · Vercel project `gabriel-capital-labs` (team `rey-gabriel-s-projects`) · CLI via `npx vercel` only, auth'd `re3zy-ai247`.

## Ship code
1. Validate first (`TESTING.md`): typecheck + relevant guards (+ `next build` for structural changes).
2. **Confirm with the owner before pushing** — push to `main` = production deploy (~2 min auto).
3. After deploy: prod probes (public 200, protected 401/403).

## Schema: canonical RC1 history — held post-DB5 landing condition

`vercel.json`'s build command is `prisma generate && next build` — it does **not**
apply migrations. Two tables in this release are created only by a reviewed
migration and have **no runtime self-heal fallback** (migration-first law,
`CLAUDE.md` gotcha 1). If the code is promoted first, `POST /api/register` throws
with no try/catch: **no consumer can create an account**, and letter generation,
`/tradelines` and the assertion routes fail too.

This held canonicalization must not land merely because the files and tests are
green. It is eligible only after Control Tower retains successful DB5 output and
resulting history evidence for this exact historical execution identity, in
lexical order:

1. `20260728000000_terms_acceptance` — `d67e5b4b4761d6328fb0786ea976a1f889a49e308bbd5b354a768e7324e3e922` — creates `TermsAcceptance`
2. `20260823120000_consumer_assertion` — `d5a7ea7ac31a12119ad413e8fc1290c923b1f9b9a3fd4fa4e046f44904d15ad0` — creates `ConsumerAssertion`

This shortcut runbook does not authorize or reproduce a Production database
command. The only authoritative historical execution and current verification
procedure is
[`gate-d-production-migration.md`](gate-d-production-migration.md). Its exact
sequence is mandatory:

1. Retained pre-DB5 evidence must prove rotation of the exposed Production
   credential before DB4, accepted DB4 exact absence, the exact two checksums,
   the fresh hardened pre-DB5 backup, and separate Founder authority. This held
   patch does not assert that evidence exists.
2. The retained historical execution must be exactly one lexical deploy—Terms,
   then Consumer—with no staged `--to`, split run, ambient URL, blind retry, or
   second execution. Gate-D §9 is historical custody, not replay authority.
3. Retain the unedited successful DB5 output and resulting exact history rows.
   Without both, do not land this canonical-chain patch.
4. After eligible landing, complete Gate-D §13. It must report all eight
   migrations `ALL_PRESENT_AND_MATCHING`, `preDb5AbsenceGate=NOT_REQUIRED`, empty
   authored/candidate/proposal lists, `decision=NO_PENDING_MIGRATIONS`, no stop
   reason, and `mutationAuthorized=false`. Only then may promotion continue.

After promotion, confirm from outside: `scripts/release-verify.sh <BASE_URL> <SHA>` must print
   `OK schema` and `OK encryption`. `/api/health/ready` returns **503** with
   `"schema":"incomplete"` and a `missingTables` list while either table is
   absent, so a mis-ordered deploy is a refused promotion rather than a silent
   outage.

The canonical classifier now covers all eight migrations. A healthy target has
empty `pendingDeployList`, `proposedResolveList`, and `deployCandidateList`.
Anything else blocks promotion and does not authorize replay of historical DB5.

**Rollback note:** these two migrations are additive (new tables only). Rolling
the *code* back does not require rolling the schema back.

## Spend and probe knobs (set these deliberately before promotion)

These have working defaults, so a deploy will not fail without them — which is
exactly why they need to be named somewhere an operator looks. Two of the three
change consumer-visible behaviour the moment they bind.

| Variable | Default | What it does |
|---|---|---|
| `AI_DAILY_BUDGET_USD_GLOBAL` | **50.00** | **Platform-wide** AI spend ceiling per UTC day, across ALL consumers. **A Founder decision — set it explicitly.** |
| `AI_DAILY_BUDGET_USD_PER_USER` | 1.00 | Per-consumer AI spend ceiling per UTC day. |
| `HEALTH_READY_DB_TTL_MS` | 5000 (capped 60000; `0` disables) | How long `/api/health/ready` reuses its database round-trip. |

**The global ceiling is the one that will surprise you.** The per-consumer ceiling
is $1.00/day, so roughly **50 consumers using their full allowance exhausts the
platform ceiling** — an ordinary first-day number, not an attack. From that moment
until 00:00 UTC every consumer who presses Analyze is told, truthfully, that AI
analysis is paused; report upload still works and falls back to the deterministic
reader. Nothing is broken and nothing is lost, but nobody will have been expecting
it. Decide the number against the provider spend you are willing to see in a day
and set it, rather than discovering the default at 14:00 on launch day.

Neither value has an "unlimited" setting: a non-positive or unparseable value
falls back to the default. Raise the number instead.

`scripts/release-verify.sh` prints the configured values when they are exported in
its environment, so a promotion leaves a record of what was in force.

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
