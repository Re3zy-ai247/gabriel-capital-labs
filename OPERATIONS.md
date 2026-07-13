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
  on 2026-07-12 (`invalid_billing_plan`). When/if the account upgrades to Pro:
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
