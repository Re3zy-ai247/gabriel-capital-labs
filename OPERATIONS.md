# OPERATIONS — deployment protocol & incident triage

> Owner-facing operations manual. Engineering how-to lives in `.ai/RUNBOOKS/deploy.md`;
> this file is the protocol + incident playbook. Last verified: 2026-07-12.

## Deployment protocol

1. **Validate before every push** (a push IS a production deploy):
   `npm run typecheck` · `npx next build` · guard scripts (`npx tsx scripts/<g>.test.ts`, map in `.ai/TESTING.md`).
2. Push to `main` → Vercel auto-builds and promotes (~2 min).
3. **Post-deploy verification (every deploy):**
   - `curl -sI https://www.creditvector.app/ | grep x-cv-release` → must equal the first 12 chars of the pushed commit SHA.
   - Probes: `/` 200 · `/login` 200 · `/api/letters` 401 · `/api/admin/overview` 403 (never a 200-with-effect unauthenticated).
4. **Rollback:** `npx vercel rollback` (or Vercel dashboard → Deployments → previous Ready deployment → Promote). Rollback is itself a deployment boundary — expect one round of stale-tab warnings.

## Release telemetry (`x-cv-release`)

Every response carries `x-cv-release: <first 12 of commit SHA>` (set at build in `next.config.js`).
**Incident triage rule:** on any user-reported 500, get the failing response's `x-cv-release`
(browser devtools → Network → response headers, or a HAR):
- **Stale SHA** → deployment skew (old tab / old service-worker cache). Fix: hard refresh. Not an outage.
- **Current SHA** → real application failure. Pull the stack: Vercel MCP `get_runtime_errors`
  (project `prj_1SouMFFSQ5icOY9APDtiMqnSUCCJ`, team `rey-gabriel-s-projects`) or dashboard → Logs.
- Server-side, every Vercel log line already carries `deploymentId` — filter errors by deployment to
  distinguish "old deployment erroring" from "current deployment erroring".

## Deployment-skew posture (verified 2026-07-12)

- **This codebase has ZERO Server Actions** (`grep -r '"use server"'` is empty). All mutations are
  client `fetch` → versionless JSON API routes, so a tab from an older deploy keeps working against
  new code. The `Failed to find Server Action` 500 (error group dating to 2026-06-16, ~1 hit/24h,
  one user) comes only from tabs loaded on historic builds; current builds mint no action IDs.
  **Keep it that way:** if a Server Action is ever introduced, it re-opens this failure class —
  prefer API routes; if unavoidable, enable Skew Protection first.
- **PWA service worker** (`next-pwa`): `skipWaiting: true` + `register: true` means a new SW takes
  control promptly; precached assets are content-hashed. Residual risk: a tab open across a deploy
  may 404 an old prefetched chunk — Next.js falls back to a full navigation, self-healing.
- **Vercel Skew Protection: NOT ENABLED — Hobby plan (feature is Pro/Enterprise).** Verified by API
  on 2026-07-12 (`invalid_billing_plan (⚠️ STALE 2026-07-20: team is now on **Pro** — Skew Protection is available; enable it via Settings → Advanced or PATCH /v9/projects/<id> {"skewProtectionMaxAge": 43200})`). When/if the account upgrades to Pro:
  1. Project Settings → Advanced → Skew Protection (or `PATCH /v9/projects/<id>` with
     `{"skewProtectionMaxAge": 43200}`).
  2. Compatibility (pre-checked): middleware matcher is `["/"]` only and reads only the NextAuth JWT
     cookie; Skew Protection routes by deployment before middleware runs, so auth redirects are
     unaffected. NextAuth cookies are deployment-independent. No code change needed.
  3. Verify: `curl -sI` two consecutive deploys and confirm old tabs keep resolving their own
     deployment for the window.

## CDN cache contract (verified 2026-07-12)

| Surface | cache-control | behavior on deploy |
|---|---|---|
| `/` + static pages | `public, max-age=0, must-revalidate` (edge HIT) | etag changes → edge revalidates immediately; no stale HTML |
| `/_next/static/*` hashed assets | `public, max-age=31536000, immutable` | new hash = new URL; old assets stay for old tabs |
| Dynamic app routes (`/dashboard` …) | `private, no-cache, no-store` | never cached |

Post-deploy cache check: `curl -sI https://www.creditvector.app/` → `x-cv-release` must be the new
SHA even when `x-vercel-cache: HIT` (HIT of the NEW deployment's cache is correct behavior).

## Failure / retry UX contract (audited 2026-07-12)

All mutation surfaces are client `fetch` with calm, retryable error states (house voice:
"The connection dropped mid-request. Try again — nothing was lost."). Audit of all 26 `busy`-flag
sites (2026-07-12): 18 were already throw-safe; 8 could strand a spinner on a thrown fetch
(login, register, settings save, reset-password, upload re-analyze, agency open-client, admin
announcements/impersonate) — all 8 fixed the same day with `.catch(() => null)` transport guards.
Rule for new mutations: every `setBusy(true)` must have a throw path that resets it (`finally`,
or a `.catch(() => null)` + early return). Metering/events (`lib/aiMeter.ts`, `lib/kaiEvents.ts`)
and push (`lib/push.ts`) are fail-open — an observability failure never breaks the user action.

## Backup & Disaster Recovery (RC1 P0-3)

> **Status: BLOCKED on one external input — the underlying database provider.** `DATABASE_URL` is a
> Prisma **Accelerate** proxy (`prisma+postgres://`), which hides the origin Postgres provider. The
> backup/restore guarantees, RPO, and RTO are **properties of that origin provider**, and a restore
> **cannot be proven** without (a) the owner confirming the provider and (b) read access to run a
> restore drill. **No values below are assumed or fabricated** — the unknowns are marked so.

**What must be protected:** the single Postgres database is the entire system of record — users,
subscriptions/Stripe linkage, letters, reports (encrypted `rawText`), documents/attachments
(AES-256-GCM), campaigns, mail manifests, audit logs, Brief content. There is **no other durable
store**. Encryption keys (`DOCUMENT_ENCRYPTION_KEY`, `NEXTAUTH_SECRET`) live only in Vercel env — a
DB restore is useless without them, so **the env-var set is part of the backup scope** (export the
Vercel env inventory; store the key material in a password manager, never in the repo).

**Owner action to unblock (≤15 min):** confirm the origin provider in the **Prisma Data Platform /
Accelerate** dashboard (or Vercel → Storage/Integrations). Typical origins: Neon, Supabase, Vercel
Postgres, RDS — each has native automated backups + PITR; record the retention window it gives you.

**Restore-validation drill (ready to run the moment the provider is known — this IS the proof):**
1. In the provider console, create a **fresh throwaway database** from the latest automated
   backup / a PITR snapshot (do NOT touch prod).
2. Point a **local** `.env` `DATABASE_URL` at the restored copy (bypass Accelerate — use the direct
   connection string).
3. `npx prisma db pull` (schema present?) → run a read: `npx tsx -e "import {prisma} from './lib/prisma'; prisma.user.count().then(c=>{console.log('users',c);process.exit()})"`.
4. Confirm row counts are sane vs prod and an encrypted `Report.rawText` decrypts with the prod
   `DOCUMENT_ENCRYPTION_KEY` (proves the key + data restore together).
5. Record: snapshot timestamp, restore wall-clock (**= measured RTO**), and the snapshot age
   (**= measured RPO**). Tear down the throwaway DB.

**Targets (to establish after the drill — do not guess):** RPO ≤ provider's PITR granularity
(commonly ≤5 min for Neon/Supabase); RTO = the measured restore time in step 5. **Fill these in
with measured numbers; leave blank until proven.**

**AI spend ceilings (RC1).** `AI_DAILY_BUDGET_USD_GLOBAL` (default **50.00**) is a platform-wide
per-UTC-day ceiling across all consumers; `AI_DAILY_BUDGET_USD_PER_USER` (default 1.00) is the
per-consumer one. Both fail CLOSED and neither has an "unlimited" setting. **Incident symptom:**
consumers report that AI analysis is "paused until midnight UTC" while the app is otherwise healthy
and `/api/health/ready` is green — that is the global ceiling, not an outage. At $1.00/consumer,
~50 consumers at full allowance reach $50. Confirm with the AiUsage day-sum, then either wait for
00:00 UTC or raise `AI_DAILY_BUDGET_USD_GLOBAL` and redeploy (env changes need a redeploy to bind).
Setting the global value is a Founder decision and should be made before promotion, not during an
incident. `HEALTH_READY_DB_TTL_MS` (default 5000, capped 60000, `0` disables) bounds how stale
`/api/health/ready` may be — raise it only if that probe's query load is itself the problem.

**Schema-drift caveat (ADR-0001, AMENDED — read the second paragraph):** the LEGACY tables are
applied by runtime self-heal DDL, not migrations — a restored DB self-heals those on first request,
so they need no separate step; verify the self-heal `ensureXTable` gates ran before declaring the
restore complete.

**That is no longer sufficient on its own (RC1).** Since the migration-first law (`CLAUDE.md`
gotcha 1), every new table ships as a reviewed migration and has **no** self-heal gate. A restore
that follows only the legacy paragraph can therefore finish while registration and letter
generation remain down. `TermsAcceptance` and `ConsumerAssertion` are the first two tables in that
class.

This operations manual intentionally contains no direct Production migration command. The held
post-DB5 canonicalization must not land until Control Tower retains successful DB5 output and exact
resulting history evidence; this source tree does not claim those events occurred. Historical
custody must include credential rotation before DB4, accepted DB4 exact-absence evidence, a fresh
hardened backup immediately before DB5, separate Founder authority, and one lexical Terms-then-
Consumer execution with no staged `--to`, split run, ambient credential, retry, or replay. Use
[`.ai/RUNBOOKS/gate-d-production-migration.md`](.ai/RUNBOOKS/gate-d-production-migration.md) as the
sole authority for that retained evidence and post-canonical verification.

For a disaster restore, do not treat `migrate deploy` as a generic catch-up shortcut. Bind the
restore target to the exact release and canonical migration history, obtain incident-owner approval,
and follow the release-matched Gate-D/recovery procedure. After this held patch is eligible to land,
require all eight migrations and both new tables to match, `preDb5AbsenceGate=NOT_REQUIRED`, empty
candidate/proposal lists, and `NO_PENDING_MIGRATIONS` before declaring schema recovery complete.
Any other result blocks recovery and does not authorize replay of the historical DB5 command.

`GET /api/health/ready` remains an application postcondition: it returns **503** with
`"schema":"incomplete"` and a `missingTables` list while either table is absent, and
`scripts/release-verify.sh` fails on it. A green readiness probe complements, but never replaces,
canonical migration-history verification.
