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
5. Click **Deploy**. The build runs `prisma db push` automatically to create tables.
6. Seed demo data once (locally, pointing at the prod DB):
   ```bash
   DATABASE_URL="<prod-url>" npm run db:seed
   ```

## Before any promotion: apply pending migrations (required)

The build command (`prisma generate && next build`, in `vercel.json`) does **not**
apply migrations, and two tables this release depends on —
`20260728000000_terms_acceptance` then `20260823120000_consumer_assertion` — have no runtime
self-heal fallback. Promote the code first and `POST /api/register` throws with no
try/catch: nobody can create an account.

Run, **against the DIRECT Postgres URL, never the Prisma Accelerate `prisma://`
proxy URL** (Accelerate is a query proxy and cannot run migrations):

```bash
DATABASE_URL="<direct-postgres-url>" npx prisma migrate deploy
```

Verify both tables are present, then promote, then confirm from outside with
`scripts/release-verify.sh <BASE_URL>` — it fails unless `/api/health/ready`
reports `"schema":"ok"`. Full ordered procedure:
[.ai/RUNBOOKS/deploy.md](.ai/RUNBOOKS/deploy.md).

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

## Option B — Self-host with Docker (one command)
```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up --build
# open http://localhost:3000
```

---

## Install as a DESKTOP app
Open your deployed URL in Chrome or Edge → click the **install icon** in the address bar
(or ⋮ menu → "Install Gabriel Capital Labs"). Launches in its own window.

## Install as a MOBILE app
- iPhone: open the URL in Safari → Share → **Add to Home Screen**.
- Android: open in Chrome → **Install app** prompt (or ⋮ → Install).

That home-screen icon launches the full-screen app with offline shell.
