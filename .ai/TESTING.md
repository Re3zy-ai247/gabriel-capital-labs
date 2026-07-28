# Testing & Validation (canonical)

No local `DATABASE_URL`/`ANTHROPIC_API_KEY` exist — validation is static + prod probes. No unit-test framework; guards are standalone `tsx` scripts.

## Commands (VERIFIED — package.json)
```bash
npm run typecheck        # tsc --noEmit — REQUIRED for any code change
npm run lint             # next lint
npx next build           # REQUIRED for risky/structural changes
npx --no-install tsx scripts/<name>.test.ts   # lockfile-local guard scripts (below)
```

## Guard scripts (`scripts/`) — run the ones touching your area
| Guard | Covers | Last known |
|---|---|---|
| `gate-d-preflight.test.ts` | SQL-derived six-migration manifest, exhaustive catalog-state taxonomy, exact direct-target grammar, non-partitioned/non-inherited/no-RLS-policy-rule-user-trigger migration-table proof, Prisma 5.22 history-object provenance, rolled-back-history fail-closed behavior, fingerprint/privilege behavior, byte-identical retry | 105/105 |
| `release-verify.test.ts` | explicit-target/no-network-default plus exact/final-response-only/non-unique/malformed `x-cv-release` field rejection without network access | 11/11 |
| `classify.test.ts` | creditor kind/type classification | 29/29 |
| `kai-sanitize.test.ts` | Kai prompt-injection sanitizer | 8/8 |
| `brief-ingest.test.ts` | RSS parser, enrichment, PDF fallback | 26/26 |
| `brief-comment.test.ts` | comment screening/moderation | 18/18 |
| `brief-react.test.ts` | likes/bookmarks idempotency | 9/9 |
| `brief-digest.test.ts` | weekly digest | green |
| `youtube.test.ts` | embed host-allowlist/spoof defense | 25/25 |
| `obsolescence.test.ts` | §605 7yr/10yr windows | green |
| `formatDate.test.ts` | date formatting | green |
| `kai-manifest.test.ts` | Kai asset manifest laws | 44/44 |
| `tradeline-insights.test.ts` | §605 fall-off display math + duplicate grouping + conflict-field flags | 12/12 |
| `forecast.test.ts` | Engine 3 Tier A own-data latency + §611 window forecast | 12/12 |
| `explain.test.ts` | Kai Explainability Layer — structured "why" from real data, uncertainty never hidden | 14/14 |
| `stripe-lifecycle.test.ts` | RC1 money-path guard — pins the SOURCE TEXT of the webhook claim contract, current-state retrieval, and fail-closed price mapping. It matches shape; it does not execute a handler. The runtime proof is in the table below | 84/84 |

### `scripts/runtime/` — the only RUNTIME guards

Run with `npx tsx scripts/runtime/run-all.ts` (CI step "Runtime guards"). Everything else in the
table above matches SOURCE TEXT; these execute the real route handlers against mocked Stripe and a
fake Prisma layer that parses the SQL the code actually issues. **`scripts/*.test.ts` is a
non-recursive glob and does not reach them** — that is why they have their own CI step.

| Guard | Covers |
|---|---|
| `stripe-webhook-claim.runtime.test.ts` | claimed / in_flight / completed / stale re-claim / handler failure then retry, through the real `POST` | 36/36 |
| `unknown-price-failclosed.runtime.test.ts` | an unrecognised price writes no `plan` key at all | 29/29 |

`scripts/runtime/README.md` states what these guards do NOT prove — no Postgres, no real
concurrency, no Stripe, no browser. Read it before quoting a pass as evidence.

## Isolated database integration

No local database integration is implicit in this workspace. Gate D's DB-only disposable
Prisma-engine proof, required prerequisites, and explicit non-equivalence to Production
backup/restore or target-preflight evidence are in `RUNBOOKS/gate-d-production-migration.md`.
Do not use a shared Preview/Production credential or the application Docker path as a test harness.

## Prod probes (auth gates, run after deploy)
`curl` https://www.creditvector.app — expect: public pages **200**; protected APIs (`/api/letters` etc.) **401/403**; admin routes + `/api/admin/migrate` **403**; unsigned Stripe webhook **400**. Never expect a 200-with-effect from an unauthenticated call.

## Stripe verification
Stripe dashboard → webhook destination → Event deliveries → want `200`.

## What "validated" means (Article X)
- Docs-only change: n/a (state so).
- Code change: typecheck + relevant guards, `next build` if structural, prod probes after deploy.
- Never report a pass for a command that didn't run.
