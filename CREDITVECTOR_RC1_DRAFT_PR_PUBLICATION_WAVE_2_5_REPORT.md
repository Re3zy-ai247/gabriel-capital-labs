# CreditVector — RC1 Draft PR Publication, Wave 2.5

**Date:** 2026-07-29 · **Base:** `origin/main` = `dfe7a3a` — **re-fetched and verified UNCHANGED**
**Status:** Draft — not ratified

> **Both release units are published as protected DRAFT pull requests.**
> **PR-1-v2 → [#8](https://github.com/Re3zy-ai247/gabriel-capital-labs/pull/8)** · **PR-2-v2 → [#9](https://github.com/Re3zy-ai247/gabriel-capital-labs/pull/9)**
>
> **RC1 remains 🔴 NO-GO.** Opening draft PRs closes no blocker. The disabled-subscriber item stays **PARTIAL**.
>
> **NOT AUTHORIZED TO MERGE · NOT AUTHORIZED TO DEPLOY.** No merge · no auto-merge · no approval · no production SQL · no live Stripe mutation · no production database contact · no migration · no Gate D baseline · no release tag · no secret values printed.
>
> **⚠ One required check could NOT be performed from this environment: preview authentication.** It is recorded as VERIFICATION REQUIRED, not PASS. See §18 — the owner must run it.

---

## 1. Context

Wave 2.4 rebuilt both release units from `origin/main`, attacked them adversarially, closed eight findings, and re-proved both from scratch under CI-equivalent isolation. Wave 2.5 publishes them for protected, owner-visible review. **No new engineering was performed on the release branches** — both were published at exactly the commits that were proven.

---

## 2. Owner decisions used

| | Decision | How it was applied |
|---|---|---|
| 1 | Period-end cancellation (`cancel_at_period_end: true`) | Stated in PR #8 body |
| 2 | No automatic refund | Stated in PR #8 body |
| 3 | Narrowly scoped cancellation-only path for disabled users with a valid session | Stated in PR #8 body |
| 4 | A signed-out disabled user cannot reauthenticate | Stated in PR #8 body as the reachability limit |
| 5 | That gap handled by support-assisted fallback for v1.0, not by reopening auth | New runbook (§21); referenced from PR #8 |
| 6 | Support channel and SLA remain OWNER ACTION REQUIRED | Left deliberately blank in the runbook |
| 7 | One-way `letterCredits` decrement acknowledged | Stated in PR #8 body |
| 8 | PR-2 rollback asymmetric, requires the tested runbook | Stated in PR #9 body |
| 9 | Merge order PR-1 → production verification → PR-2 | Stated in both bodies; #9 carries the explicit dependency line |
| 10 | Push the two clean branches and create DRAFT PRs | Executed |
| 11 | Merge, deploy, DB access, Stripe mutation, migrations, tagging remain unauthorized | **None performed** |

---

## 3. Vercel preview-protection facts — owner-provided

Treated as owner-provided configuration facts, not re-derived: Vercel Authentication enabled · Require Log In enabled · Standard Protection selected · previews require a logged-in Vercel team member · Preview and Production have **separately scoped** database variables · production Stripe secrets scoped to Production · merge to `main` auto-deploys Production · draft PRs may create protected previews.

**⚠ One repository record contradicts one of these, and it is recorded rather than silently overridden.**
`CLAUDE.md` line 46, a correction dated 2026-07-20, states: *"`DATABASE_URL` is one shared value across Production+Preview."* The owner now reports Preview and Production are separately scoped.

**Assessment.** Env-var scoping is Vercel dashboard state — something the repository cannot observe and the owner can. The owner's statement is the more recent direct observation, so it supersedes an eight-day-old transcription of that same dashboard state. **This is a stale documentation record, not conflicting evidence about repository behaviour**, so it does not trigger the stop condition.

**It still matters, and the worst case is now bounded.** If the values were shared, a preview would read and write production rows for any authenticated action. What it could *no longer* do is destroy schema: the `prisma db push` that once armed table drops has been removed from the build (§4). **Recommended owner action: reconcile `CLAUDE.md` line 46 against the current dashboard, and correct whichever is wrong.**

---

## 4. Preview-safety repository review — PASS

Inspected only preview-affecting configuration, per the token constitution.

| Vector | Finding | Result |
|---|---|---|
| Build command | `vercel.json` → `prisma generate && next build`. **No `prisma db push`, no `migrate deploy`, no seed.** Byte-identical on `main` and **both** release branches | **PASS** |
| `postinstall` | `prisma generate` only — no DB mutation | **PASS** |
| Seed logic | `db:seed` / `seed` exist as manual scripts; **invoked by no build step, workflow or route** | **PASS** |
| Migration execution | No migration runs anywhere in build or startup; 0 `prisma/` paths in either diff | **PASS** |
| Startup / self-heal DDL | Self-heal is `CREATE TABLE IF NOT EXISTS` on **first runtime use**, never at import time. It is additive-only — no `DROP`, no `ALTER`. There are no module-level side effects | **PASS** |
| Cron execution | Two crons in `vercel.json`, both `CRON_SECRET`-gated and returning 503 when unset. Vercel schedules crons on **Production only**, and neither release branch touches a cron route | **PASS** |
| Webhook registration | `webhookEndpoints` appears nowhere in `lib/`, `app/` or `scripts/` — nothing registers or mutates a Stripe endpoint on boot | **PASS** |
| Background jobs | None started at import time | **PASS** |
| Config drift | Neither branch touches `vercel.json`, `package.json`, any cron route, or `prisma/seed` — **0 preview-affecting config files changed** | **PASS** |
| CI workflow | PR-2's `ci.yml` diff adds **no** `prisma db push`, `migrate deploy`, seed step, or `DATABASE_URL` usage | **PASS** |

**Conclusion: opening these draft PRs cannot execute a migration, run seed logic, perform startup DDL, trigger a cron, register a webhook, or mark a deployment Production.**

One nuance worth stating plainly: **the push, not the PR, is what creates a preview deployment.** Vercel builds any pushed branch connected to the project. So the deployment-triggering action was the authorized branch push.

---

## 5. Current `origin/main`

`dfe7a3ab06e966d87d4ed53fb518f10333bbb61e`

## 6. Whether it moved

**It did not move.** Identical to the Wave 2.4 base. **No base drift invalidates either branch**, so the Wave 2.4 proof remains current and CI was not re-run locally.

---

## 7. PR-1 branch verification

| Gate | Evidence | Result |
|---|---|---|
| Branch exists | `release/pr1-critical-fixes-v2` | **PASS** |
| Head is the reviewed commit | `ec7b467d4d8216e1128645c3302dfb463e025441` — **exactly** the expected `ec7b467`, unchanged | **PASS** |
| Working tree clean | 0 uncommitted | **PASS** |
| Merge base | `dfe7a3a` — i.e. `origin/main` itself | **PASS** |
| `is-ancestor origin/main HEAD` | TRUE — strict linear descendant, no merge commit | **PASS** |

## 8. PR-2 branch verification

| Gate | Evidence | Result |
|---|---|---|
| Branch exists | `release/pr2-stripe-lifecycle-v2` | **PASS** |
| Head is the reviewed commit | `f24778ac6bf56e923675939899befc8972539118` — **exactly** the expected `f24778a`, unchanged | **PASS** |
| Working tree clean | 0 uncommitted | **PASS** |
| Merge base | `dfe7a3a` | **PASS** |
| `is-ancestor origin/main HEAD` | TRUE | **PASS** |

**Neither head changed during this wave.** The support-fallback artifact (§21) was deliberately **not** added to either release branch, precisely so both would publish at the exact commits Wave 2.4 proved. Trade-off named: the runbook therefore ships outside these two PRs and is referenced from #8 rather than included in it.

---

## 9. Workstream exclusion proof

| Property | PR-1-v2 | PR-2-v2 |
|---|---|---|
| Founder Library / Knowledge Architecture commits in ancestry | **0** | **0** |
| Mixed source branch used as PR head | **No** — never | **No** |
| Mutual file overlap between the two diffs | **0** | **0** |

The mixed branch `claude/creditvector-founder-library-jwnbhc` was **not** used as a PR source and was not pushed as part of publication.

## 10. Forbidden-path proof

| Scan (diff-relative vs `origin/main`) | PR-1-v2 | PR-2-v2 |
|---|---|---|
| `knowledge/`, `founder-library/`, `architecture/GIOS` | **0** | **0** |
| `prisma/` or `migrations` paths | **0** | **0** |

`architecture/GIOS-*` present in the *tree* remains a known false positive — those files already exist on `origin/main`. Only diff presence is meaningful.

---

## 11. Branch push results

Normal non-force push. Exactly two branches.

| Remote branch | Local head | Remote head | Exact commit accepted | Result |
|---|---|---|---|---|
| `release/pr1-critical-fixes-v2` | `ec7b467d…` | `ec7b467d…` | **YES** | **PASS** — new branch |
| `release/pr2-stripe-lifecycle-v2` | `f24778ac…` | `f24778ac…` | **YES** | **PASS** — new branch |

**Nothing else was pushed:** `wip/*` = 0 · `tmp/*` = 0 · the mixed source branch was not pushed in this operation · **no tag was created or pushed** (the 2 tags on the remote pre-date this session). No force push.

---

## 12. Draft PR creation results

Two PRs created with `draft: true`, base `main`. No PR template exists in the repository, so the bodies follow the Wave 2.4 packages.

**One publication-metadata defect found and corrected.** PR #9's stored body had the literal token `pending:<eventType>` **stripped to `pending:`** — GitHub removed the angle-bracket token even inside a code span, silently changing the meaning of the rollback description. Corrected by rewriting those two passages without angle brackets (`the value `pending:` followed by the Stripe event type`, and `rows whose `type` begins with `pending:``). This is exactly the "clearly publication metadata" class the brief permits fixing. **No other content changed, and neither branch was touched.**

**Labels: none applied.** `release` was checked and does **not** exist in this repository, and `billing`, `security`, `stripe`, `rc1` and `draft` are not GitHub defaults either (`bug` was confirmed present, so label lookup works). Per instruction, labels were **not invented** and creating repository labels was not authorized.

---

## 13. PR-1 — number and URL

**#8** — https://github.com/Re3zy-ai247/gabriel-capital-labs/pull/8
Head `release/pr1-critical-fixes-v2` @ `ec7b467` · base `main` @ `dfe7a3a` · **6 commits · 19 files · +1842 / −92**

## 14. PR-2 — number and URL

**#9** — https://github.com/Re3zy-ai247/gabriel-capital-labs/pull/9
Head `release/pr2-stripe-lifecycle-v2` @ `f24778a` · base `main` @ `dfe7a3a` · **8 commits · 17 files · +2774 / −19**
Carries the explicit line: *"Merge dependency: PR-1-v2 (#8) must merge and complete production verification before this PR may merge."*

## 15. Draft status

| PR | `draft` | `state` | `merged` | `mergeable_state` |
|---|---|---|---|---|
| #8 | **true — DRAFT** | open | **false** | `blocked` (expected for a draft) |
| #9 | **true — DRAFT** | open | **false** | `blocked` |

**Neither is ready-for-review. Auto-merge was not enabled. Neither PR was approved or reviewed.**

---

## 16. CI status per PR

Both PRs carry two workflow runs on the same SHA — one triggered by the **push**, one by the **pull_request** event.

**PR #8 — all checks complete, all green:**

| Check | Run | Conclusion |
|---|---|---|
| `verify` | 30409647493 (push) | **success** |
| `Gate D preflight` | 30409647493 (push) | **success** |
| `verify` | 30409691896 (PR) | **success** |
| `Gate D preflight` | 30409691896 (PR) | **success** |
| `Vercel Preview Comments` | — | **success** |

Combined commit status: **success**.

**PR #9 — all checks complete, all green:**

| Check | Run | Conclusion |
|---|---|---|
| `verify` | 30409648484 (push) | **success** |
| `Gate D preflight` | 30409648484 (push) | **success** |
| `Gate D preflight` | 30409722462 (PR) | **success** |
| `verify` | 30409722462 (PR) | **success** — completed 00:02:11Z |
| `Vercel Preview Comments` | — | **success** |

Combined commit status: **success**. **No check failed on either PR; 5/5 green on both.** The last `verify` on #9 was briefly `in_progress` when first observed and has since completed successfully — recorded here as the final state, not the first reading.

---

## 17. Preview URL per PR

Both deployments reported **Ready** by the Vercel GitHub app, both labelled **Preview**:

| PR | Preview URL | Vercel status |
|---|---|---|
| #8 | `https://gabriel-capital-labs-git-release-911b5d-rey-gabriel-s-projects.vercel.app` | Ready — "Deployment has completed" |
| #9 | `https://gabriel-capital-labs-git-release-a5bb5c-rey-gabriel-s-projects.vercel.app` | Ready |

---

## 18. Preview authentication / protection — VERIFICATION REQUIRED

**Result: NOT VERIFIABLE FROM THIS ENVIRONMENT. Recorded as VERIFICATION REQUIRED — not PASS, not FAIL.**

An unauthenticated request to both preview URLs returned **HTTP 403**. That looks like protection working, and it would have been easy to record as PASS. **It is not evidence.** The 403 is the session's own egress policy proxy refusing the connection, not Vercel:

- The proxy's diagnostics report `connect_rejected` — *"gateway answered 403 to CONNECT (policy denial or upstream failure)"* — naming the preview host explicitly.
- **Control:** `https://vercel.com/` and `https://nextjs.org/` — both public — are equally unreachable (HTTP 000). Outbound egress is blocked generally.
- The 403 body was 36 bytes with no Vercel SSO markers, no `_vercel_sso` cookie, and no redirect to a Vercel login.

So the check the brief asks for — *does the preview request Vercel authentication* — could not be observed either way, and the proxy README forbids retrying policy denials.

**OWNER MUST RUN THIS**, from a normal browser or terminal, signed **out** of Vercel:

```
curl -sI https://gabriel-capital-labs-git-release-911b5d-rey-gabriel-s-projects.vercel.app/
curl -sI https://gabriel-capital-labs-git-release-a5bb5c-rey-gabriel-s-projects.vercel.app/
```

- Redirect to `vercel.com/sso-api…` or an authentication challenge → **PASS**, protection confirmed.
- **HTTP 200 with the application rendering → FAIL. Do not proceed toward merge**, and treat the preview as having been publicly exposed from the moment of the push.

Owner-provided configuration (Standard Protection, Require Log In) says the answer should be PASS. **That is the expectation, not the measurement.**

## 19. Whether any production deployment occurred

**NO.** Both deployments are **Preview**, created from non-production branches. Vercel promotes only the production branch (`main`), and `main` was not modified. No deployment was marked Production.

## 20. Whether any migration or production mutation occurred

**NO.** No migration applied or baselined · no production SQL executed · no production database contacted · no live Stripe mutation · no Gate D baseline · no schema change (`prisma/schema.prisma` byte-identical to `origin/main` on both branches, 0 `prisma/` paths in either diff) · no production environment variable changed.

---

## 21. Support fallback artifact

**Created: `.ai/RUNBOOKS/support-assisted-cancellation.md`.**

It states the gap exactly — a disabled subscriber **with** a valid session can self-cancel at `/billing/cancel`; one who has signed out **cannot**, because `lib/auth.ts` refuses sign-in for a disabled account before the password is compared — and records that such a customer continues to be billed with no in-product way to stop it.

It requires support to offer an **identity-verified** cancellation via the existing audit-logged admin route, so every cancellation is auditable; forbids any support employee from ever requesting a password, token or secret; requires telling the customer plainly that period-end cancellation does not refund the current period and does not restore access; and separates suspension from billing so cancellation is never used to re-enable an account.

**Two fields are left deliberately blank as OWNER ACTION REQUIRED — the published support channel and the response SLA.** No email address and no SLA were invented. The document states that **until both are set the fallback is a plan, not a control**, and must not be cited as mitigation. It also states that it is an **operational fallback, not a closed technical capability**, and names what would retire it: a scoped, single-purpose re-authentication path — an open owner decision, not scheduled work.

Authentication architecture was **not** modified. The artifact lives outside both release branches and touches no other workstream.

---

## 22. Owner actions remaining

1. **Run the preview-protection check in §18.** Nothing else in this report substitutes for it.
2. **Reconcile `CLAUDE.md` line 46** against the current Vercel dashboard — it still records `DATABASE_URL` as one shared value across Production and Preview.
3. **Publish the support channel and SLA** in the runbook. Until then the fallback is not a control.
4. Review **#8 first**, then **#9**. Accept the named consequences: period-end cancellation with no refund, the one-way `letterCredits` decrement, PARTIAL reachability, and PR-2's asymmetric rollback.
5. Have `.ai/RUNBOOKS/stripe-webhook-rollback.md` to hand **before** merging #9.
6. Decide whether to create the five requested labels — none exist and none were invented.

## 23. Counsel actions remaining

**B-12** CROA/FCRA positioning · **B-05** compliance bar · consent-evidence retention · and the open question this programme surfaced: whether a self-service cancellation path is *required*, and whether a support-channel-only fallback is defensible for a suspended consumer-finance customer. **Neither PR requires a counsel gate to review** — `lib/compliance.ts` is byte-identical to `origin/main` on both.

## 24. Production actions remaining

Restore drill (B-09) · prove alert delivery (B-10) · `SETUP_SECRET` (C-01) · encryption backfill (C-02) · measure the 15s re-analysis transaction · **reconcile disabled accounts holding a live subscription** · confirm which Stripe API version the live webhook endpoint is pinned to · exercise both units in Stripe **test mode**. All remain **VERIFICATION REQUIRED — PRODUCTION**.

---

## 25. Exact review order

1. **#8** — `release/pr1-critical-fixes-v2` — **SAFE TO REVIEW**
2. Production verification of #8
3. **#9** — `release/pr2-stripe-lifecycle-v2` — **SAFE TO REVIEW**

Both are **NOT AUTHORIZED TO MERGE** and **NOT AUTHORIZED TO DEPLOY** in this session.

## 26. Exact next action

**Run the two `curl -sI` commands in §18 while signed out of Vercel.** Preview protection is the one publication-safety property that could not be measured here, and it gates whether these previews may stay open. Then review #8.

## 27. Artifact paths

| Path | Note |
|---|---|
| `CREDITVECTOR_RC1_DRAFT_PR_PUBLICATION_WAVE_2_5_REPORT.md` | canonical |
| `CREDITVECTOR_RC1_DRAFT_PR_PUBLICATION_WAVE_2_5_REPORT.html` | matched mobile projection |
| `.ai/RUNBOOKS/support-assisted-cancellation.md` | support fallback (new) |
| `CREDITVECTOR_RC1_CRITERIA.md` | v1.7 — Wave 2.5 status block |

## 28. Final report commit hash

Committed to `claude/creditvector-founder-library-jwnbhc` — see the commit recorded in chat. **Remote publication of the report is not required for this task**; the two release branches are the only refs published for review.

---

## 29. Prohibitions — explicit confirmation

**No merge** · **no auto-merge** (never enabled) · **no approval or review submitted** · **no production deployment authorization** · **no production SQL** · **no live Stripe mutation** · **no production database contact** · **no migration applied or baselined** · **no Gate D baseline** · **no release tag created or pushed** · **no production environment variable changed** · **no secret values printed** · **no other workstream modified** · **the mixed source branch was never used as a PR head**.

**Repository and GitHub truth are distinguished throughout.** Branch, ancestry, diff and guard facts are repository truth. PR numbers, draft state, CI conclusions and preview URLs are GitHub/Vercel truth. **Preview authentication is neither — it is unmeasured, and §18 says so.** Nothing here is evidence about the running production system.
