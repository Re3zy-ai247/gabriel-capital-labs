# OPERATIONS — deployment protocol & incident triage

> Owner-facing operations manual. Engineering how-to lives in `.ai/RUNBOOKS/deploy.md`;
> this file is the protocol + incident playbook. Last verified: 2026-07-12; Backup & DR,
> Cron liveness and the verification checklist revised 2026-07-28 (documentation only —
> **no production state was observed or re-verified**; every unproven fact is marked
> VERIFICATION REQUIRED with the command that answers it).

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

**Backup-scope checklist (do these independently of the drill — none require the provider name):**

- [ ] **Escrow `DOCUMENT_ENCRYPTION_KEY` outside Vercel.** VERIFICATION REQUIRED. Copy the live value
      into the owner's password manager (1Password/Bitwarden item "CreditVector — prod key material"),
      never into the repo, a ticket, or a chat. Without it every `Document`/`Attachment` blob and every
      encrypted `Report.rawText` in a restored database is unreadable ciphertext — the restore succeeds
      and the data is still lost. Read it with `npx vercel env pull` into a scratch file, copy, delete
      the file.
- [ ] **Escrow `NEXTAUTH_SECRET` the same way.** VERIFICATION REQUIRED. Losing it does not destroy data
      but invalidates every issued JWT — every user is signed out at once, which during an incident is
      a second incident. Restoring the same value keeps sessions valid across a rebuild.
- [ ] **Export the full env inventory** (names only is not enough — values are the recovery input):
      `npx vercel env pull .env.prod.backup --environment=production`, store it in the same password
      manager entry, then `rm .env.prod.backup`. Re-do this after any env change.
- [ ] **Record where the escrow lives** in the owner's own notes, so a recovery does not depend on one
      person remembering. Nothing in this repository can verify any of the four items above.

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
5. **Post-restore migration repair — VERIFICATION REQUIRED, and it is part of the drill, not an
   afterthought.** See "Schema model after a restore" below for why. On the restored copy:
   `npx prisma migrate status` → record the exact output. If it reports no `_prisma_migrations`
   table or an unapplied `0_init`, the repair is
   `npx prisma migrate resolve --applied 0_init` followed by `npx prisma migrate deploy`, per
   `.ai/RUNBOOKS/gate-d-production-migration.md` §6.3 (probe) + §6.4 (baseline reconcile).
   **This repair path has never been executed against a real restore** — proving it works, and
   timing it, is a deliverable of the drill. Run it against the throwaway copy only.
6. Record: snapshot timestamp, restore wall-clock **including step 5** (**= measured RTO**), and the
   snapshot age (**= measured RPO**). Tear down the throwaway DB.

**Targets (to establish after the drill — do not guess):** RPO ≤ provider's PITR granularity
(commonly ≤5 min for Neon/Supabase); RTO = the measured restore time in step 6. **Fill these in
with measured numbers; leave blank until proven.**

**Schema model after a restore (corrected 2026-07-28 — supersedes the old "self-heal handles it"
note):** schema is **MIGRATION-FIRST** (owner-ratified 2026-07-20, `CLAUDE.md` gotcha 1). Runtime
self-heal DDL is **LEGACY** and permitted only for the enumerated legacy tables in
`scripts/schema-safety.test.ts`'s `LEGACY_SELF_HEAL_ALLOWLIST`; no new feature schema is created at
runtime, so **a restored database does NOT self-heal itself back to the current schema** and a
restore that skips step 5 is under-verified. Six migration directories exist under
`prisma/migrations/` (`0_init` plus five dated). Two facts make the repair non-optional:

- **No deploy applies migrations.** `vercel.json`'s build command is `prisma generate && next build`
  — a push ships code only. Schema changes are a deliberate, separate release step
  (`.ai/RUNBOOKS/schema-change.md`).
- **Production has no `_prisma_migrations` history** (`.ai/CURRENT-STATE.md`: the
  `resolve --applied 0_init` baseline was applied to *preview* only), so `migrate deploy` alone
  **fails on `0_init`** against a copy taken from prod. Baseline first, then deploy.

Do not declare a restore complete until `npx prisma migrate status` on the restored copy reports no
pending migrations **and** the step 3–4 reads succeed.

## Cron liveness (VERIFICATION REQUIRED)

`vercel.json` schedules two jobs: `/api/cron/brief-ingest` daily at **13:00 UTC** and
`/api/cron/brief-digest` weekly **Mondays 14:00 UTC**. Both routes report only when they
**execute and fail** — `reportError` on a throw or an unreachable feed. **A cron that never fires
emits nothing at all.** Expired/absent `CRON_SECRET`, a dropped Vercel schedule, and a plan-limit
change are all silent by construction, so cron liveness is a thing you go and check, not a thing
that tells you.

**What the automated probe already proves** (`scripts/prod-health.sh` check 6, unauthenticated,
runs daily in `.github/workflows/daily-health.yml`): the cron routes still exist (404 = removed by a
deploy → FAIL), `CRON_SECRET` is set so the routes *can* run (503 = unset → FAIL), and they refuse
an unauthenticated caller (200 = FAIL). It does **not** prove a schedule fired.

**What only production access proves — check weekly:**

1. **Vercel dashboard → Project → Settings → Cron Jobs.** VERIFICATION REQUIRED. This is the
   authoritative surface: it lists each job's **last run time and status**. Escalate if the ingest's
   last run is > 48h old, or the digest's > 8 days.
2. **Runtime logs, filtered by path.** VERIFICATION REQUIRED.
   `npx vercel logs <latest-prod-url> | grep brief-ingest`, or Vercel MCP `get_runtime_logs`
   (project `prj_1SouMFFSQ5icOY9APDtiMqnSUCCJ`, team `rey-gabriel-s-projects`) filtered to
   `/api/cron/brief-ingest`. Expect one invocation per day near 13:00 UTC.
3. **Data-side corroboration** (weaker — use only to confirm, never to clear). VERIFICATION
   REQUIRED. `/admin/brief` shows ingested drafts; a `BriefArticle` created in the last 24h proves
   the ingest ran. **The converse is not true:** a run that finds no new feed items creates zero
   rows, so "no fresh draft" is not evidence the cron failed. Presence is evidence; absence is not.

**Standing caveat:** while `ALERT_WEBHOOK_URL` is unset (see the checklist below), a cron that runs
and *fails* also reaches no human — it lands in Vercel logs only. Cron liveness and alert delivery
are two separate unproven things.

## Operational verification checklist — facts this repository cannot prove

Every row below is **VERIFICATION REQUIRED**: it describes production state that no file in this
repo can assert. Nothing here is a claim about the live environment — it is the exact command to
find out. Record the answer and the date beside each row as it is verified; do not mark a row done
from memory.

| # | Question | Exact check | What a bad answer means |
|---|---|---|---|
| V-01 | Is `SETUP_SECRET` set in production? | `npx vercel env ls production \| grep SETUP_SECRET` → expect **zero rows**. Also GET `/api/admin/diagnostics` (ADMIN session) → `envPresent.SETUP_SECRET === false` | If set: a static shared secret in a **query string** unlocks raw DDL (`/api/admin/migrate`) and LIVE Stripe catalog mutation (`/api/admin/billing/provision`), with no rate limit and no audit log. Unset it immediately, then rotate anything it touched |
| V-02 | Is the at-rest encryption backfill complete? | Signed in as ADMIN, in the browser console: `fetch('/api/admin/encrypt-reports',{method:'POST'}).then(r=>r.json()).then(console.log)` then the same for `/api/admin/encrypt-letters`. Both are idempotent — expect `{ok:true, encrypted:0, skipped:N}` | Any non-zero `encrypted` means raw credit-report / letter PII was still sitting in plaintext until that call. The call fixed it; investigate why the backfill had been missed |
| V-03 | Which provider actually hosts the Postgres behind Accelerate? | Prisma Data Platform → the project's Accelerate connection → origin database; cross-check Vercel → Storage / Integrations | Until answered, **backup guarantees, RPO and RTO are unknown** and the restore drill above cannot start. This is the single blocking input for Backup & DR |
| V-04 | Is `ALERT_WEBHOOK_URL` set, and has a real alert ever landed? | `npx vercel env ls production \| grep ALERT_WEBHOOK_URL` → expect one row. **Then** confirm in the destination channel that at least one genuine alert has arrived | Env-set is not delivery-proven. While unset, `reportError` is dormant: every cron failure, Stripe webhook failure and handler throw is logged and **pages nobody** |
| V-05 | Are `COMPANY_POSTAL_ADDRESS` and `RESEND_FROM` set? | GET `/api/admin/diagnostics` → `envPresent.COMPANY_POSTAL_ADDRESS` and `envPresent.RESEND_FROM`; or `npx vercel env ls production` | Without the postal address the **weekly digest refuses to send** (CAN-SPAM) and reports that refusal rather than an error. Without a verified `RESEND_FROM` no admin alert email leaves the building |
| V-06 | Did the crons actually run? | See "Cron liveness" above — Vercel → Settings → Cron Jobs (last run + status) | A dropped schedule is invisible: the Brief stops ingesting and the digest stops sending with no error anywhere |
| V-07 | Are the dormant feature flags still off? | `npx vercel env ls production \| grep -E 'OPERATOR_\|ARENA_\|MAIL_LIVE\|KERNEL_DURABLE'` → expect **zero rows** (absent = fail-closed OFF) | Any row means a surface intended to be dormant is live in production without having gone through the five-review gate |
| V-08 | Is `main` branch-protected? | `gh api repos/Re3zy-ai247/gabriel-capital-labs/branches/main/protection` → expect a protection object, **not** `404 Branch not protected` | A push to `main` **is** a production deploy. Unprotected means one mistaken push ships to live billing with no review and no required check |
| V-09 | Is the team on Vercel Pro, and is Skew Protection enabled? | `npx vercel teams ls`; then GET `/v9/projects/prj_1SouMFFSQ5icOY9APDtiMqnSUCCJ` and read `skewProtectionMaxAge` (expect `43200`) | On Hobby the feature is unavailable. On Pro but unset, tabs open across a deploy keep the stale-asset failure mode described in "Deployment-skew posture" |
| V-10 | Is the key material escrowed outside Vercel? | The four boxes in the Backup-scope checklist above | A database restore without `DOCUMENT_ENCRYPTION_KEY` returns unreadable ciphertext — the backup exists and the data is still gone |
