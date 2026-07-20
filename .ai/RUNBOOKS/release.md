# Runbook: Release train

The process every production release follows. It is deliberately small — a checklist
and the checks that already exist — not a platform.

**The one rule that makes it a train and not a queue:** a release is a *decision*,
and the decision is the owner's. Automation gathers evidence; a human merges and
deploys.

---

## Before you start: repository state

More than one agent session can hold this checkout. Before any release work:

```bash
git rev-parse --abbrev-ref HEAD          # expect: main
git status -sb                            # expect: clean tree
git log --oneline origin/main..HEAD       # expect: empty, or only YOUR commits
```

If there are unpushed commits you did not create, **stop**. Reconcile with whoever
made them before releasing — do not push another session's unvalidated work under
your release identifier, and never `reset`, `rebase` or `squash` to tidy it away.

---

## The checks

Run in this order. Each is cheap; the order puts the fastest failure first.

| # | Check | Command | Blocking |
|---|---|---|---|
| 1 | Typecheck | `npm run typecheck` | yes |
| 2 | Lint | `npm run lint` | advisory (known pre-existing failures) |
| 3 | Guard suite | `for f in scripts/*.test.ts; do npx tsx "$f"; done` | yes |
| 4 | Schema safety | `npx tsx scripts/schema-safety.test.ts` | yes |
| 5 | Billing contract | `npx tsx scripts/checkout-guard.test.ts` | yes |
| 6 | Session security | `npx tsx scripts/session-security.test.ts` | yes |
| 7 | Capacity contract | `npx tsx scripts/agency-capacity.test.ts` | yes |
| 8 | Production build | `npm run build` | yes |
| 9 | Preview deploy | push branch → Vercel preview | yes |
| 10 | Preview smoke | `CV_BASE_URL=<preview> bash scripts/prod-health.sh` | yes |
| 11 | **Owner approval** | — | **yes, human** |
| 12 | Deploy | merge to `main` → Vercel production | — |
| 13 | Post-deploy smoke | `bash scripts/prod-health.sh` | yes |
| 14 | Release header | confirm `x-cv-release` matches the merged SHA | yes |
| 15 | Observation window | watch for 30 min before considering it settled | — |

Steps 1–3 and 8 also run automatically in CI on every push (`.github/workflows/ci.yml`).

### Billing releases

Anything touching `app/api/stripe/**`, `lib/stripe.ts` or `lib/billing.ts` additionally
requires **Stripe test-mode evidence** before approval: perform the affected flow end
to end against test keys and record what Stripe actually did (subscription count,
proration line, webhook delivery `200`). Structural guards prove the code shape; only
a real test-mode run proves the money behaviour.

### Schema releases

If a change adds a column or table, read `.ai/RUNBOOKS/schema-change.md` first. The
ordering is not optional: **the database change lands first, the code that depends on
it second.** A column present in `schema.prisma` but absent from the database fails
*every* query against that model — a full outage, not a degraded feature.

---

## Release record

Copy this into the PR description or the release notes. It is the evidence archive;
it is what makes a rollback decision possible later.

```
Release:            <YYYY-MM-DD.n>
Commit:             <sha>
Included changes:   <one line per commit>
Known risks:        <or "none identified">
Migrations:         <none | the exact DDL, and confirmation it ran first>
Env changes:        <none | var names only — never values>
Tests executed:     typecheck / guards N/N / build / preview smoke
Preview URL:        <url>
Approver:           <name>
Deployment result:  <success | rolled back>
Post-release:       <smoke result, x-cv-release observed>
Rollback status:    <not needed | performed, reason>
```

---

## Rollback

Vercel keeps every previous deployment. Rolling back is promoting the last known-good
one — no rebuild, no revert commit required to stop the bleeding.

1. `npx vercel ls gabriel-capital-labs --prod` — find the last good deployment.
2. Promote it from the Vercel dashboard (or `npx vercel promote <url>`).
3. Confirm with `bash scripts/prod-health.sh` and check `x-cv-release` moved back.
4. *Then* write the revert commit, so the repository matches production.

**A rollback does not undo a database change.** If the release included DDL, decide
explicitly whether the old code tolerates the new schema — additive columns usually
yes, dropped or renamed ones no. This is why the schema runbook forbids destructive
DDL in a release.

---

## What is automated, and what is not

| Automated | Human |
|---|---|
| Typecheck, lint, guards, build on every push (CI) | Merging |
| Daily production probe (`daily-health.yml`) | Deploying |
| Weekly deep verification (`weekly-verify.yml`) | Approving a billing change |
| Issue creation on failure, deduplicated | Any schema decision |
| Evidence gathering | Rollback decision |

No workflow in this repository merges, deploys, or mutates production. That is a
deliberate boundary, not a missing feature.
