# Deploying Gabriel Capital Labs (web + desktop + mobile)

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
