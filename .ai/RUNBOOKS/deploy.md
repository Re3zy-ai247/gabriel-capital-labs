# Runbook: Deploy

**Prod:** https://www.creditvector.app · Vercel project `gabriel-capital-labs` (team `rey-gabriel-s-projects`) · CLI via `npx vercel` only, auth'd `re3zy-ai247`.

## Ship code
1. Validate first (`TESTING.md`): typecheck + relevant guards (+ `next build` for structural changes).
2. **Confirm with the owner before pushing** — push to `main` = production deploy (~2 min auto).
3. After deploy: prod probes (public 200, protected 401/403).

## Env-var-only change (no code)
```bash
npx vercel env add <NAME> production
npx vercel ls gabriel-capital-labs --prod     # get latest prod deployment URL
npx vercel redeploy <that-url>                # required for env vars to take effect
```

## Preview before prod (big/visual changes)
Branch → `git push -u origin <branch>` → Vercel auto-builds a Preview. URL via `npx vercel ls gabriel-capital-labs` (Environment=Preview). **Preview URLs 401 to anonymous** (Deployment Protection — that's auth, not failure); view logged into the Vercel account. Ship = merge to `main` (fast-forward) → push.

## Gotchas
- Build command lives in `vercel.json`, NOT package.json (it includes the tolerated `prisma db push`).
- Schema changes do NOT deploy via push — see `schema-change.md`.
