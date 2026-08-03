# Testing & Validation (canonical)

No local `DATABASE_URL`/`ANTHROPIC_API_KEY` exist — validation is static + prod probes. No unit-test framework; guards are standalone `tsx` scripts.

## Commands (VERIFIED — package.json)
```bash
npm run typecheck        # tsc --noEmit — REQUIRED for any code change
npm run lint             # next lint
npx next build           # REQUIRED for risky/structural changes
npx --no-install tsx scripts/<name>.test.ts   # lockfile-local guard scripts (below)
```

## CXOS Living Environment Engine isolated review

Run the presentation-policy guards with the repository-local toolchain:

```bash
npx --no-install tsx scripts/cxos-core-runtime.test.ts
npx --no-install tsx scripts/cxos-living-environment.test.ts
npx --no-install tsx scripts/cxos-agency-command.test.ts
npx --no-install tsx scripts/cxos-isolated-review.test.ts
node scripts/cxos-living-environment/handoff.mjs self-test
```

Last exact-source RC1 result (`188aa78`, 2026-08-01): Core **76/76**, Living
Environment **35/35**, Agency **185/185**, isolated review **25/25**, and handoff
self-test **7/7 negative controls**. The optimized review build and a separate Vercel
production-identity build passed. Under forced production identity plus contradictory
public review flags, `GET /review`, `/review/agency-command`, and
`/review/mission-control` each returned **404**.

Last exact-source RC2 result (`6c69ef6`, 2026-08-02): Core **76/76**, Living
Environment **93/93** (was 35/35 at RC1 — WP1–WP7 plus three WP-FIX commits), Agency
**185/185**, isolated review **25/25**. Browser acceptance: 10 cases executed, 19/19
coverage gates, strict status **"hold"** on exactly 1 disclosed residual (landscape
`phase-cls`, 0.01037 vs 0.01 budget) — 9/10 cases clean.

**WP-FIX2 result (`f7ee9c5`, 2026-08-03 — adversarial-gate remediation, three commits on
top of `6c69ef6`):** Core **76/76**, Living Environment **96/96** (+3 static pins: F1/F9
negation-count, quiet-kill-list `:is()` extension, F5 computed-style-gate), Agency
**185/185**, isolated review **25/25**. Browser acceptance
(`CXOS_LIVING_ENVIRONMENT_ENGINE_RC2_EVIDENCE/candidate/final/candidate-final-browser-evidence.json`,
sha256 `6c62da31d6df4f2f1be3198d88d1297e65715c0f32371fe06c1efdc79628d6c6`, `sourceRevision`
verified = HEAD): 10 cases executed, **20/20** coverage gates (adds
`coverage:channel-token-observed`, F6b), strict status **"accepted", zero findings**. The
landscape `phase-cls` residual above is superseded: RC2 WP-FIX2's new per-source
layout-shift instrumentation pinned it to `KaiContextSpine`'s chamber-conditional
`kaiContext` paragraph (`stage.tsx` ~1748) — an empirically reproducing narrow-viewport
(≤740px) pattern, absent ≥1024px, disclosed rather than fixed (not an obvious ≤5-line
change). Fresh production-identity build (`BUILD_ID BG6m8Y25klVI66_-u9-NY`, unchanged by
WP-FIX2) again returned 404/404/404 for the same three routes. Full detail:
`CXOS_LIVING_ENVIRONMENT_ENGINE_RC2_VALIDATION_REPORT.md` §5.1.

The dependency-free browser harness is
`scripts/cxos-living-environment/browser.mjs`. It requires explicit absolute paths for
Playwright 1.62.0, Chrome 151.0.7922.72, and Axe 4.12.1, verifies pinned tool hashes
before capture, and requires `CXOS_SOURCE_REVISION` to be an exact 40-character SHA in
strict mode. Its declared matrix covers 1728×1000, 1440×900, tablet, 390/360/320 px
mobile, compact landscape, reduced motion, constrained capability, 200% reflow, and a
separate JavaScript-disabled snapshot. A baseline missing-feature ledger is
observational and must never be reported as a passing candidate run.

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

### `scripts/runtime/` — the money-path RUNTIME guards

Run with `npx tsx scripts/runtime/run-all.ts` (CI step "Runtime guards"). Most guards in the table
above match SOURCE TEXT; these execute the real route handlers against mocked Stripe and a fake
Prisma layer that parses the SQL the code actually issues. **`scripts/*.test.ts` is a non-recursive
glob and does not reach them** — that is why they have their own CI step.

They are not the repository's only executing guards: `scripts/identity-runtime.test.ts` and
`scripts/reputation-runtime.test.ts` also run real `lib/` code, and other units may add executing
guards directly under `scripts/`, where the non-recursive glob already covers them. What is unique
to this directory is the *route-handler* harness in `_harness.ts` and the SQL-parsing fake in
`_fakes.ts` — and the separate CI step they require.

| Guard | Covers |
|---|---|
| `invoice-shape.runtime.test.ts` | both Stripe invoice payload shapes (legacy `invoice.subscription`, basil `invoice.parent.subscription_details.subscription`), each as a string and as an expanded object, across `payment_failed` and `payment_succeeded`, asserted on the write that reaches the DB | 52/52 |
| `stripe-webhook-claim.runtime.test.ts` | claimed / in_flight / completed / stale re-claim / handler failure then retry, through the real `POST` | 36/36 |
| `stripe-webhook-reorder.runtime.test.ts` | out-of-order delivery — a stale `updated` after a `deleted` cannot restore a revoked plan (and the mirror case cannot revoke a paying one) | 44/44 |
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
