# Testing & Validation (canonical)

No local `DATABASE_URL`/`ANTHROPIC_API_KEY` exist — validation is static + prod probes. No unit-test framework; guards are standalone `tsx` scripts.

## Commands (VERIFIED — package.json)
```bash
npm run typecheck        # tsc --noEmit — REQUIRED for any code change
npm run lint             # next lint
npx next build           # REQUIRED for risky/structural changes
npx tsx scripts/<name>.test.ts   # guard scripts (below)
```

## Guard scripts (`scripts/`) — run the ones touching your area
| Guard | Covers | Last known |
|---|---|---|
| `classify.test.ts` | creditor kind/type classification | 29/29 |
| `kai-sanitize.test.ts` | Kai prompt-injection sanitizer | 8/8 |
| `brief-ingest.test.ts` | RSS parser, enrichment, PDF fallback | 26/26 |
| `brief-comment.test.ts` | comment screening/moderation | 18/18 |
| `brief-react.test.ts` | likes/bookmarks idempotency | 9/9 |
| `brief-digest.test.ts` | weekly digest | green |
| `youtube.test.ts` | embed host-allowlist/spoof defense | 25/25 |
| `obsolescence.test.ts` | §605 7yr/10yr windows | green |
| `formatDate.test.ts` | date formatting | green |

## Prod probes (auth gates, run after deploy)
`curl` https://www.creditvector.app — expect: public pages **200**; protected APIs (`/api/letters` etc.) **401/403**; admin routes + `/api/admin/migrate` **403**; unsigned Stripe webhook **400**. Never expect a 200-with-effect from an unauthenticated call.

## Stripe verification
Stripe dashboard → webhook destination → Event deliveries → want `200`.

## What "validated" means (Article X)
- Docs-only change: n/a (state so).
- Code change: typecheck + relevant guards, `next build` if structural, prod probes after deploy.
- Never report a pass for a command that didn't run.
