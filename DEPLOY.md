# Deploying Gabriel Capital Labs (web + desktop + mobile)

> ⚠️ **HISTORICAL (first-time setup guide).** The app is already deployed to production. Current deploy procedure: [.ai/RUNBOOKS/deploy.md](.ai/RUNBOOKS/deploy.md) · services/env vars: [.ai/INTEGRATIONS.md](.ai/INTEGRATIONS.md).

You deploy ONCE as a website. Desktop and mobile are then installed from that URL
(it's a PWA) — no separate app builds or app-store submissions required.

## What you need (3 secrets)
1. A **PostgreSQL** database URL — free options: Neon (neon.tech), Supabase, or Vercel Postgres.
2. A **NEXTAUTH_SECRET** — run `openssl rand -base64 32` (or any 32+ char random string).
3. An **ANTHROPIC_API_KEY** — from console.anthropic.com (optional; without it the app still
   generates letters using the built-in grounded templates).

---

## Option A — Vercel (recommended, ~10 min)
1. Create a free GitHub repo and push this folder:
   ```bash
   git init && git add . && git commit -m "Gabriel Capital Labs"
   git branch -M main
   git remote add origin https://github.com/<you>/gabriel-capital-labs.git
   git push -u origin main
   ```
2. Go to vercel.com → **Add New → Project** → import the repo.
3. Add a database: Vercel dashboard → **Storage → Create → Postgres** (or paste a Neon URL).
4. In the project's **Settings → Environment Variables**, add:
   `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your vercel URL), `ANTHROPIC_API_KEY`.
5. Follow the authoritative Gate-D release procedure linked below. Build and
   startup never create, reconcile, or migrate database objects.

Demo data is local-development-only and must not be seeded as a production deploy
step.

## Canonical RC1 migration history — held post-DB5 state

**HELD LANDING CONDITION:** this documentation/guard slice may land only after
Control Tower retains successful DB-5 evidence for the exact candidate commit and
tree. This held patch does not itself assert that DB-5 occurred on its own
authority, and grants no
production, database, migration, merge, or deployment authority. Everything this
file records about DB-5 below is a restatement of Control Tower's retained evidence
and acceptance; this file is not the source of that fact and cannot be cited as
evidence for it.

**CONDITION SATISFIED — 2026-08-29.** Control Tower retains that evidence and has
accepted DB-5. The condition above remains the standing rule; this note records that
it has been met. Authority comes from Control Tower's acceptance, never from this
file. The evidence binds the **pre-DB5 candidate** `5b2faff7…` / tree `c6ffccc0…`,
which is the tree the migration actually ran from; `prisma/migrations/` is
byte-identical between that tree and this one, so the applied SQL is the same.

Upon authorized landing after that evidence, these migrations are canonical
applied history, in this exact order; they are not pending candidates:

1. `20260728000000_terms_acceptance`
   — `d67e5b4b4761d6328fb0786ea976a1f889a49e308bbd5b354a768e7324e3e922`
2. `20260823120000_consumer_assertion`
   — `d5a7ea7ac31a12119ad413e8fc1290c923b1f9b9a3fd4fa4e046f44904d15ad0`

Do not replay either migration. Do not attempt a staged `--to` deployment. Build,
install, release, and application-start paths remain database-mutation-free.

### How DB-5 was accepted — including what its raw output says

DB-5 applied both migrations in the order above and its client reported "All
migrations have been successfully applied."

**Its own retained artifacts nonetheless record a failure, and that is not hidden
here.** In `repo-archive/2026-08-29-db5-migration/`:

- `gate-db5-20260829T163154Z.manifest.txt` records `state=DB5_APPLIED_BUT_VERIFICATION_FAILED`
- `gate-db5-verify-20260829T163154Z.txt` records `D5V_VERDICT=FAIL — 1 discrepancy/discrepancies`

The single discrepancy is `HISTORY APPLIED_STEPS_COUNT 0 for 0_init`. Control Tower
adjudicated it a **false red**: `0_init` carries zero applied steps because it was
baselined with `migrate resolve --applied`, which this repository's own Gate-D law
makes mandatory, and that value was already recorded as `0` in the accepted DB-4
report `gate-db4-20260829T005325Z.report.json` — before the migration ran. The
retired instrument's assertion, not the database, was wrong.

**DB-5 is therefore accepted as successfully executed, with its post-deploy
verification adjudicated rather than clean.** The raw output must not be altered or
deleted, and the retired instrument must not be re-run.

### Governed prerequisites that were satisfied for this release

The completed DB-5 act ran behind a governed credential / TLS / fingerprint / backup
gate. What follows is a record of what happened for this release, not a rule for
what must happen next, and each item is scoped as its own evidence scopes it:

- A dedicated CreditVector DB-gate credential was **rotated and put in place under
  Founder / Control Tower custody**, and is attested to be the credential used for
  the accepted production fingerprint, DB-4, the fresh pre-DB5 backup, and DB-5.
  Both the rotation and the continuity of that secret across those gates are
  **Founder / Control Tower attested**. What the retained evidence independently
  shows is *role* continuity: all of those gates matched the same fingerprint
  `e2e86da3…`, whose inputs include the connecting role `prisma_migration`. `repo-archive` holds no independent
  provider-side artifact proving it, and no such proof should be claimed.
- A **fresh hardened backup was completed and accepted immediately before DB-5**
  as the immediately preceding gate act — 2026-08-29T13:15:39Z, about three hours
  before the 16:30:59Z mutation — under mode-400 custody with its hash recorded in
  its own manifest.
- **TLS, scoped as the evidence scopes it.** The two read connections used
  `sslmode=verify-full`. The **mutation** used `sslmode=require&sslaccept=strict`,
  because Prisma 5.22's schema engine has no verify-full vocabulary. In production's
  configuration only the **chain** half was measured directly; the hostname half
  rests on engine-binary evidence, not a live probe. What is authenticated is the
  **client-to-endpoint hop** — the endpoint-to-postgres hop is not observable and is
  **not claimed**. See `prisma_tls`, `prisma_tls_scope`, `prisma_tls_anchor` and
  `prisma_tls_hop` in the DB-5 manifest for the exact wording.
- **The fingerprint gate is `CONSISTENCY_EVIDENCE_ONLY`.** It detects change in
  cluster identity, role, database/schema and ordered search_path. **It is not peer
  authentication.** It matched exactly before the mutation.

**These were prerequisites of the completed act. They are not a standing rule that
every future deploy requires a credential rotation.** What any future production
database act requires is defined by the authoritative Gate-D runbook — never
inferred from the past-tense prose above.

The sole authoritative executable Production procedure is
[Gate-D production migration](.ai/RUNBOOKS/gate-d-production-migration.md), and it
remains controlling. Nothing in this guide relaxes, overrides, waives, or
substitutes for it. This guide intentionally reproduces no executable Production
command. Gate-D is the sole location for retained evidence of the one controlled
lexical DB-5 invocation, and for all future Production migration/history
verification. Never add migration execution to a Vercel build/install command,
Docker `CMD`/`ENTRYPOINT`, Compose override, package lifecycle script, or
application startup path.

For an independently authorized promotion, confirm from outside with
`scripts/release-verify.sh <BASE_URL>` — it fails unless `/api/health/ready`
reports `"schema":"ok"`. The Gate-D runbook above owns the full ordered
Production procedure.

---

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

---

## Option B — Self-host with Docker/Compose

The bundled, loopback-bound Postgres service and its volume are for a disposable
local environment only. Before using Compose, set these to newly generated,
non-production local values in the shell or an uncommitted `.env` file:

- `LOCAL_POSTGRES_PASSWORD` — URL-safe local-only password
- `LOCAL_NEXTAUTH_SECRET` — local-only auth secret
- `LOCAL_DOCUMENT_ENCRYPTION_KEY` — exactly 64 hexadecimal characters

Provision the local schema explicitly, then start the application; the image
itself never mutates schema:

```bash
docker compose build
docker compose run --rm web npx --no-install prisma migrate deploy
docker compose up
# open http://localhost:3000
```

Compose waits for PostgreSQL's `pg_isready` result before starting the web
service. It marks the web container healthy only when `/api/health/ready` returns
success, which also requires the RC1 tables and local encryption key. This exposes
readiness to an orchestrator; it does **not** make an external load balancer or
reverse proxy honor readiness. Any external router must be configured separately
to withhold traffic from an unhealthy container.

For a shared or production self-hosted database, do not use the disposable-local
shortcut. Follow the same separately authorized migration runbook used for Vercel.

---

## Install as a DESKTOP app
Open your deployed URL in Chrome or Edge → click the **install icon** in the address bar
(or ⋮ menu → "Install Gabriel Capital Labs"). Launches in its own window.

## Install as a MOBILE app
- iPhone: open the URL in Safari → Share → **Add to Home Screen**.
- Android: open in Chrome → **Install app** prompt (or ⋮ → Install).

That home-screen icon launches the full-screen app with offline shell.
