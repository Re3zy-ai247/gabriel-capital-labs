# OPERATIONS — deployment protocol & incident triage

> Owner-facing operations manual. Engineering how-to lives in `.ai/RUNBOOKS/deploy.md`;
> this file is the protocol + incident playbook. Last verified: 2026-07-12; Backup & DR,
> Cron liveness and the verification checklist revised 2026-07-28 (documentation only —
> **no production state was observed or re-verified**; every unproven fact is marked
> VERIFICATION REQUIRED with the command that answers it).
>
> **Executable procedures live in `.ai/RUNBOOKS/` — this file points at them, never duplicates them:**
> restore/DR → [`restore-drill.md`](.ai/RUNBOOKS/restore-drill.md) (B-09, **OPEN** — no drill has been
> run, RPO/RTO unmeasured) · alerting + cron liveness →
> [`alert-activation.md`](.ai/RUNBOOKS/alert-activation.md) (B-10, **PARTIAL** — delivery unproven) ·
> deploys → [`deploy.md`](.ai/RUNBOOKS/deploy.md) · schema →
> [`schema-change.md`](.ai/RUNBOOKS/schema-change.md).

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

**Restore-validation drill — the full executable procedure lives in
[`.ai/RUNBOOKS/restore-drill.md`](.ai/RUNBOOKS/restore-drill.md)** (single source of truth; do not
re-describe the steps here). That runbook covers: provider identification (§1) · pre-drill safety
rules incl. *never drill against production* (§2) · the provider-neutral drill (§3) · post-restore
integrity verification, including decrypting one `Report.rawText` with the prod key — the only step
that proves **data and key were recovered together** (§4) · the migration-history baseline/repair,
which is itself unproven (§5) · the RPO/RTO measurement worksheet (§6) · failed-drill handling (§7) ·
evidence capture (§8).

**RPO / RTO: BLANK — not yet measured. Do not guess them.** They get filled in only from a completed
§6 worksheet, quoted as *measured on <date>*. **B-09 stays OPEN until then.**

**Why the migration repair is part of the restore (not an afterthought):** schema is
**MIGRATION-FIRST** (owner-ratified 2026-07-20, `CLAUDE.md` gotcha 1) — runtime self-heal is
legacy-only, so **a restored database does not heal itself forward**. No deploy applies migrations
(`vercel.json` build command is `prisma generate && next build`), and production has **no
`_prisma_migrations` history** (`.ai/CURRENT-STATE.md`: the `resolve --applied 0_init` baseline was
preview-only), so `migrate deploy` alone is expected to **fail on `0_init`** against a prod-derived
copy. Baseline first, then deploy — procedure and evidence requirements in the runbook §5, Gate D
rules in `.ai/RUNBOOKS/gate-d-production-migration.md`.

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

**What only production access proves — check weekly. Procedure:
[`.ai/RUNBOOKS/alert-activation.md`](.ai/RUNBOOKS/alert-activation.md) §4** (single source of truth
for the three checks and their escalation thresholds: Vercel → Settings → Cron Jobs last-run/status;
runtime logs filtered by path; data-side corroboration, which can confirm but never clear).

**Standing caveat:** while `ALERT_WEBHOOK_URL` is unset, a cron that runs and *fails* also reaches no
human — it lands in Vercel logs only. Cron liveness and alert delivery are two separate unproven
things.

## Alerting (B-10 — PARTIAL)

`lib/observability.ts` `reportError` always structured-logs and **additionally** POSTs to
`ALERT_WEBHOOK_URL` when set. It is wired into 11 call sites across the Stripe webhook, Stripe
checkout, `lib/billing.ts`, and both crons. **`ALERT_WEBHOOK_URL` is unset, so delivery is dormant
and every one of those failures pages nobody.**

Activation, the end-to-end **delivery drill** that proves an alert actually arrived (config presence
is not proof), and failure triage:
**[`.ai/RUNBOOKS/alert-activation.md`](.ai/RUNBOOKS/alert-activation.md)**. **B-10 stays PARTIAL
until a message has been observed in a human-watched destination** and recorded in that runbook's
§3.3. Note that `scripts/prod-health.sh` check 3 sends **no** `stripe-signature` header, so it
short-circuits before `reportError` and does **not** generate an alert — its passing is not evidence
of alerting.

## Operational verification checklist — facts this repository cannot prove

Every row below is **VERIFICATION REQUIRED**: it describes production state that no file in this
repo can assert. Nothing here is a claim about the live environment — it is the exact command to
find out. Record the answer and the date beside each row as it is verified; do not mark a row done
from memory.

| # | Question | Exact check | What a bad answer means |
|---|---|---|---|
| V-01 | Is `SETUP_SECRET` set in production? | `npx vercel env ls production \| grep SETUP_SECRET` → expect **zero rows**. Also GET `/api/admin/diagnostics` (ADMIN session) → `envPresent.SETUP_SECRET === false` | If set: a static shared secret in a **query string** unlocks raw DDL (`/api/admin/migrate`) and LIVE Stripe catalog mutation (`/api/admin/billing/provision`), with no rate limit and no audit log. Unset it immediately, then rotate anything it touched |
| V-02 | Is the at-rest encryption backfill complete? | Signed in as ADMIN, in the browser console: `fetch('/api/admin/encrypt-reports',{method:'POST'}).then(r=>r.json()).then(console.log)` then the same for `/api/admin/encrypt-letters`. Both are idempotent — expect `{ok:true, encrypted:0, skipped:N}` | Any non-zero `encrypted` means raw credit-report / letter PII was still sitting in plaintext until that call. The call fixed it; investigate why the backfill had been missed |
| V-03 | Which provider actually hosts the Postgres behind Accelerate? | `.ai/RUNBOOKS/restore-drill.md` §1 — the four places to look, and the block of facts to record | Until answered, **backup guarantees, RPO and RTO are unknown** and the restore drill cannot start. This is the single blocking input for Backup & DR |
| V-04 | Is `ALERT_WEBHOOK_URL` set, and has a real alert ever landed? | `npx vercel env ls production \| grep ALERT_WEBHOOK_URL` → expect one row (presence only, never the value). **Then run the delivery drill:** `.ai/RUNBOOKS/alert-activation.md` §3 — a message observed in the destination channel is the only thing that answers this row | Env-set is not delivery-proven. While unset, `reportError` is dormant: every cron failure, Stripe webhook failure and handler throw is logged and **pages nobody** |
| V-05 | Are the canonical legal footer and `RESEND_FROM` delivery-verified? | Confirm the deployed release contains `lib/companyIdentity.server.ts`; GET `/api/admin/diagnostics` → `envPresent.RESEND_FROM`; then send the admin Brief test and inspect the received LLC postal block + unsubscribe headers | Source presence is not delivery proof. Without a verified `RESEND_FROM`, email cannot leave the building; without a received legal-footer test, CAN-SPAM delivery behavior remains unverified |
| V-06 | Did the crons actually run? | `.ai/RUNBOOKS/alert-activation.md` §4 — Vercel → Settings → Cron Jobs (last run + status), plus log and data-side corroboration | A dropped schedule is invisible: the Brief stops ingesting and the digest stops sending with no error anywhere |
| V-07 | Are the dormant feature flags still off? | `npx vercel env ls production \| grep -E 'OPERATOR_\|ARENA_\|MAIL_LIVE\|KERNEL_DURABLE'` → expect **zero rows** (absent = fail-closed OFF) | Any row means a surface intended to be dormant is live in production without having gone through the five-review gate |
| V-08 | Is `main` branch-protected? | `gh api repos/Re3zy-ai247/gabriel-capital-labs/branches/main/protection` → expect a protection object, **not** `404 Branch not protected` | A push to `main` **is** a production deploy. Unprotected means one mistaken push ships to live billing with no review and no required check |
| V-09 | Is the team on Vercel Pro, and is Skew Protection enabled? | `npx vercel teams ls`; then GET `/v9/projects/prj_1SouMFFSQ5icOY9APDtiMqnSUCCJ` and read `skewProtectionMaxAge` (expect `43200`) | On Hobby the feature is unavailable. On Pro but unset, tabs open across a deploy keep the stale-asset failure mode described in "Deployment-skew posture" |
| V-10 | Is the key material escrowed outside Vercel? | The four boxes in the Backup-scope checklist above | A database restore without `DOCUMENT_ENCRYPTION_KEY` returns unreadable ciphertext — the backup exists and the data is still gone |
