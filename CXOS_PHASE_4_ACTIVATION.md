# CXOS Phase 4 — Preview Authentication Activation Runbook

**2026-07-29 · branch `feat/cxos-phase3` · Status: EVERYTHING AUTOMATED IS DONE — the remaining steps are yours by design**
**No merge. No production deployment. No production database contact. Production env vars: change nothing.**

> The safe sign-in flow is fully built, gated, and proven. The gates now refuse to open for
> anyone but you: isolating the Preview database and scoping the secrets happen in YOUR Vercel
> and database consoles, which no session can (or should) reach. This runbook is the exact,
> phone-friendly path — with a live proof instrument at every step so nothing is taken on faith.

---

## 1. Verified truth (re-checked this session)

- `origin/main` = `f449c35` (unmoved). Branch `feat/cxos-phase3`; the Vercel Preview
  deployment is CURRENT (deployment `dpl_Dg89ZRJu…` = commit `a03304e`, READY, stable alias
  `gabriel-capital-labs-git-feat-cxo-06bc43-rey-gabriel-s-projects.vercel.app`); this runbook's
  push adds the proof endpoint (`GET /api/cxos/founder-bootstrap`).
- **Database provider:** Prisma Postgres / Prisma Data Platform (documented endpoints
  `accelerate.prisma-data.net` + direct `db.prisma.io:5432` — VERIFIED from the repository's
  own incident records). It supports **multiple databases per project** — an isolated Preview
  database is a first-class object, created in the console in under a minute.
- **The deployed app reads exactly ONE database variable: `DATABASE_URL`** (audited:
  `schema.prisma` has no `directUrl`; zero references to `PRISMA_DATABASE_URL`,
  `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, or `DIRECT_URL` anywhere
  in runtime code — only operator-run tooling reads `GATE_D_DATABASE_URL`, and the opt-in
  `EVENTBUS_INTEGRATION` script reads `DATABASE_URL` when YOU run it). So one Preview-scoped
  `DATABASE_URL` row is genuinely sufficient — but the matrix below covers every variable so
  nothing is assumed.
- Correction for the record: the Phase 4 report said "84 source guard files"; the true count
  is **83** (+5 runtime).

## 2. The environment-variable scoping matrix

| Variable | Production | Preview | Development (local) | Required? | Must differ from Production? |
|---|---|---|---|---|---|
| `DATABASE_URL` | existing value — **DO NOT TOUCH** | **NEW isolated Prisma Postgres URL** | local throwaway | YES — the only DB var the app reads | **YES — this is the isolation** |
| `PRISMA_DATABASE_URL` · `POSTGRES_URL` · `POSTGRES_PRISMA_URL` · `POSTGRES_URL_NON_POOLING` · `DIRECT_URL` | not read by this codebase | not read | not read | NO | n/a — inert if present; leave untouched |
| `NEXTAUTH_SECRET` | existing — DO NOT TOUCH | **ADD a fresh value, Preview scope** (login 500s without it) | any local value | YES | YES (recommended — preview sessions then validate nowhere else) |
| `NEXTAUTH_URL` | existing (`https://www.creditvector.app`) — DO NOT TOUCH | **must be ABSENT** (NextAuth v4 then derives each deployment's URL from `VERCEL_URL`) | `http://localhost:3000` | Prod: yes · Preview: must NOT exist | must be absent in Preview |
| `VERCEL_URL` | system-set | system-set | — | automatic | automatic |
| `CXOS_PREVIEW_DB_ISOLATED` | **must NOT exist** | `1` — set ONLY after §4's proofs | optional | Preview only | must not exist in Production |
| `CXOS_FOUNDER_BOOTSTRAP_SECRET` | **must NOT exist** | fresh random, Preview only | optional | Preview only | must not exist in Production |
| `CXOS_FOUNDER_REVIEW_PASSWORD` | **must NOT exist** | your chosen review password, Preview only | optional | Preview only | must not exist in Production |

Defense in depth: even if the three CXOS variables leaked into Production scope, the route
404s there — first line, mutation-proven, and verified against a live production-env server
presenting every secret.

## 3. Create the isolated Preview database (phone-friendly)

In **console.prisma.io** (works in a mobile browser):
1. Open your workspace → the project that owns the production database.
2. **New database** (Create database) → name it `creditvector-preview` → pick the same region.
3. Open the new database → **Connect** → copy its connection string (one tap). This string is
   the ONLY thing you carry to Vercel; never paste it anywhere else.

In **Vercel** (mobile web: vercel.com → project `gabriel-capital-labs` → Settings →
Environment Variables):
4. Find `DATABASE_URL` → if its single row has **Preview** ticked, EDIT and un-tick Preview
   (leave Production exactly as it is). Then **Add** → key `DATABASE_URL`, value = the new
   string from step 3, environment = **Preview only** → Save.
5. **Add** `NEXTAUTH_SECRET` → a fresh random value → Preview only. (Generate on your phone:
   any password manager's generator is fine; length ≥ 32.)
6. If `NEXTAUTH_URL` has Preview ticked → edit and un-tick Preview.
7. **Add** (all Preview-only): `CXOS_FOUNDER_BOOTSTRAP_SECRET` (fresh random) and
   `CXOS_FOUNDER_REVIEW_PASSWORD` (the password YOU will type at the review login).
   **Do NOT add `CXOS_PREVIEW_DB_ISOLATED` yet** — that is the attestation, and it comes
   after the proofs in §4.
8. Deployments → the latest `feat/cxos-phase3` deployment → ⋯ → **Redeploy** (so the new
   Preview scope applies).

## 4. THE HARD SAFETY GATE — prove isolation before attesting

Already proven by automation (live servers + mutations, recorded in the Phase 4 report and
this session): production bootstrap 404 with all secrets presented · un-attested preview 409 ·
GET fingerprint 404 in production · database never read without attestation · no credential
ever echoed · no static password exists · this session changed NOTHING in your Vercel or any
real database.

**Yours to verify (each is one glance):**
1. **Two different rows in Vercel:** `DATABASE_URL` now shows a Production row (old value,
   untouched) and a Preview row (new value). Tap reveal on each — visibly different strings.
   That kills "a second variable pointing at the same database".
2. **What the deployment ACTUALLY resolves:** open, in your phone browser (you'll pass the
   Vercel SSO wall first — that protection stays ON):
   `https://gabriel-capital-labs-git-feat-cxo-06bc43-rey-gabriel-s-projects.vercel.app/api/cxos/founder-bootstrap`
   You'll see JSON: `vercelEnv:"preview"`, the redacted database identity (host + name +
   fingerprint — no credentials), and the gate booleans. Confirm the host/fingerprint match
   the NEW database (compare host with the Prisma console's connect view), and that
   `nextauthSecretConfigured:true`, `nextauthUrlSet:false`.
3. **Production unchanged:** the same URL on `https://www.creditvector.app/api/cxos/founder-bootstrap`
   → 404 page. (Also: you changed no Production-scoped row in step §3.)

If — and only if — 1–3 hold: Vercel → add `CXOS_PREVIEW_DB_ISOLATED=1` (Preview only) →
Redeploy once more. Re-open the GET: `isolationAttested:true`,
`reviewAccounts: consumer/agency "absent"` (it now reads the EMPTY isolated database).

## 5. Initialize the schema (the one step that needs a terminal)

The new database is empty. From any computer with the repo (this is NOT a migration and NOT
production — it materializes the schema into a disposable review fixture):

```bash
read -s PREVIEW_DB   # paste the NEW preview connection string; nothing echoes
DATABASE_URL="$PREVIEW_DB" npx prisma db push
unset PREVIEW_DB
```

Never run this with any other URL. Production schema changes remain MIGRATION-FIRST and are
untouched by this runbook.

## 6. Create the review accounts (secret stays in your shell)

The protected preview refuses curl without Vercel SSO, so first: Vercel → Settings →
Deployment Protection → **Protection Bypass for Automation** → Add secret → copy it.
(Protection itself stays ON — this is Vercel's supported automation path.)

```bash
read -s BOOT; read -s BYPASS   # bootstrap secret, then bypass token; nothing echoes
curl -X POST \
  -H "x-cxos-bootstrap: $BOOT" \
  -H "x-vercel-protection-bypass: $BYPASS" \
  https://gabriel-capital-labs-git-feat-cxo-06bc43-rey-gabriel-s-projects.vercel.app/api/cxos/founder-bootstrap
unset BOOT BYPASS
```

Expect `{"ok":true,"accounts":[{...created:true},{...created:true}]}`. Run it twice —
the second run returns `created:false` for both (idempotency, live). The response carries no
credential material (guard-pinned). Re-open the GET: `reviewAccounts` now `active`/`active`.

## 7. Sign in and experience it (all on your phone or desktop)

| Step | Where | Expect |
|---|---|---|
| Sign in (consumer) | `<preview>/login` — identifier `cxreview-consumer`, your review password | **the first authenticated entry**: identity → clearance → systems → evidence → Kai's brief → the room |
| Returning entry | leave `/dashboard`, come back | the ~1 s short variant |
| Consumer projection | the room | OPERATOR command header, your empty case ("first mission staged") |
| Agency projection | sign out → sign in `cxreview-agency` | AGENCY OPERATOR header, agency clearance beat |
| Logout | Sidebar → Log out | immediate → `/login` |
| Signed-out deep link | open `/dashboard` signed out | truthful "Please sign in.", no overlay |
| Revoke test | §6 curl with `?revoke=1` appended | both logins refused afterwards; GET shows `revoked` |
| Re-enable | §6 curl again (no `?revoke`) | accounts re-enabled, `active` |

Clickable protected paths (Vercel SSO first):
**Login** `/login` · **Mission Control** `/dashboard` · **Review hub** `/review` ·
**Mission Control stage** `/review/mission-control` (consumer/agency selectors are on the
stage) · **Proof endpoint** `/api/cxos/founder-bootstrap` — all on
`https://gabriel-capital-labs-git-feat-cxo-06bc43-rey-gabriel-s-projects.vercel.app`.

Recordings of the complete authenticated walkthrough (desktop + mobile + tablet +
reduced-motion + returning + agency), captured against the real auth stack with the real login
form, were delivered with the Phase 4 report. Your §7 walk is the live confirmation of the
same flow. (This session cannot reach the protected preview — its egress proxy blocks
vercel.app and the SSO wall is yours alone — which is exactly as it should be.)

## 8. Owner checklist — what changed, and how to undo it

**Changed in Vercel (all Preview scope; Production rows untouched):**
`DATABASE_URL` (new Preview row) · `NEXTAUTH_SECRET` (new Preview row) · `NEXTAUTH_URL`
(Preview un-ticked) · `CXOS_PREVIEW_DB_ISOLATED=1` · `CXOS_FOUNDER_BOOTSTRAP_SECRET` ·
`CXOS_FOUNDER_REVIEW_PASSWORD` · one Protection Bypass automation secret.
**Created outside Vercel:** one disposable Prisma Postgres database (`creditvector-preview`)
holding only synthetic review rows.

**Revocation ladder (any step alone is effective):**
1. Accounts: §6 curl with `?revoke=1` → both disabled (sign-in refused + live sessions evicted).
2. Route: delete `CXOS_FOUNDER_BOOTSTRAP_SECRET` → the bootstrap ceases to exist (404).
3. Attestation: delete `CXOS_PREVIEW_DB_ISOLATED` → hard 409, and the GET stops reading the DB.
4. Everything: delete the `creditvector-preview` database in the Prisma console — every
   synthetic row and the whole fixture disappear. Delete the automation bypass secret.

**Credential hygiene, verified:** no secret value appears in the repository, this report, the
chat, the screenshots, or the recordings (guard + mutation `M3`/`M9` + response checks). The
only literal passwords ever used were container-local throwaways for a database that no longer
exists outside this session.

---

*No merge. No production deployment. No production database was contacted at any point.
Stop point: you sign in, walk the entry, and review both projections — then Phase 4 closes on
your decision block (Phase 4 report §11).*
