# RC1 Release Sequence — Wave 2.1

**Status: PROPOSAL. Nothing here has been merged, pushed, deployed, or applied.**
**Every merge listed below is a production deployment. Every one requires owner approval.**

**Repository basis:** branch `claude/creditvector-founder-library-jwnbhc`, HEAD `c7d1506`, plus the
uncommitted Wave 2.1 working tree (Agent 1's FK correction, Agent 2's acceptance UI, Agent 3's
runtime guards). Base for every proposed PR: `origin/main` @ `dfe7a3a`.

**Verification labels used throughout.** *SOURCE* = read from the repository. *EXECUTED* = a command
was run in this session and its result is quoted. *INFERRED* = reasoned from repository evidence but
not executed. *VERIFICATION REQUIRED — PRODUCTION* = only a live system can answer it.

---

## 1. The branch is not a release unit

`git log --oneline main..HEAD` returns **22 commits** (EXECUTED). Eleven are RC1 Waves 0–2. **Eight
belong to a different workstream** — the Founder Library / Knowledge Architecture docs (`2e9812e`,
`331d64d`, `bda4d22`, `87f6708`, `e25f94b`, `e5b4ef7`, `c392aa3`, `e6d9b21`) plus `c9c884e`. They are
READ-ONLY to this wave and are **excluded from every PR below**. That workstream sequences itself.

Consequence: **merging this branch is not an option in any form.** It would deploy another team's
docs and, far worse, ship the terms enforcement code before the migration exists (§6).

---

## 2. Unit assignment — every Wave 0/1/2 change placed in exactly one unit

Five commits are *mixed* — they contain files from two units. Commits are **not split**; a mixed
commit rides with its dominant unit and the passenger files are named.

| Unit | Definition | Commits | Files |
|---|---|---|---|
| **A** | Documentation + read-only verification tooling | `27bc430`, `7099bde`(H-dominant), `c7d1506` | `CREDITVECTOR_RC1_*.md`, `.ai/RUNBOOKS/*`, `OPERATIONS.md` |
| | *(passengers in code commits)* | in `26d2b1c` → `RC1-B06-TERMS-ACCEPTANCE-PACKAGE.md`; in `86ba824` → `RC1-B05-COUNSEL-REVIEW.md`; in `59fad4f` → `RC1-DISABLED-ACCOUNT-POLICY.md` + `scripts/verify-production.sh` | |
| | *(uncommitted)* | Agent 2's `RC1-PAID-PATH-CONSENT-INVENTORY.md`; Agent 3's `scripts/runtime/**`; this file; `.ai/RUNBOOKS/migration-apply-terms-acceptance.md` | |
| **B** | Wave 1 production-path fixes, **no** migration dependency | `a2fa6ea`, `6bc4cf4`, `bd8f108`, `826413b`(+H) | `lib/entitlements.ts`, `lib/admin.ts`, `lib/analyze.ts`, `app/api/letters/**`, `app/api/stripe/checkout|portal/route.ts` (identity hunks), `app/api/billing/status/route.ts`, `app/api/demo/seed/route.ts`, `app/global-error.tsx` |
| **C** | Webhook lifecycle correction | `c3c4954`, `59fad4f`(+A) | `app/api/stripe/webhook/route.ts`, `lib/billing.ts`, `lib/stripe.ts`, `scripts/stripe-lifecycle.test.ts` |
| **D** | Migration-dependent terms **model** | part of `26d2b1c` + corrective `C2` | `prisma/schema.prisma`, `prisma/migrations/20260728000000_terms_acceptance/migration.sql` |
| **E** | Terms **UI** | **uncommitted** (Agent 2) → corrective `C3` | `components/TermsAccept.tsx`, `app/pricing/PricingTiers.tsx`, `app/agency/page.tsx`, `app/billing/page.tsx`, `scripts/terms-acceptance.test.ts` §6 |
| **F** | Terms **API enforcement** | part of `26d2b1c` | `lib/terms.ts`, `app/api/stripe/checkout/route.ts` (B-06 hunk), `scripts/terms-acceptance.test.ts` §1–5, `scripts/checkout-consent.test.ts` |
| **G** | Compliance changes | `013ea53`, `86ba824`(+A) | `lib/compliance.ts`, `scripts/compliance-bar.test.ts` |
| **H** | Operational runbooks | `7099bde`, part of `826413b` | `.ai/RUNBOOKS/restore-drill.md`, `.ai/RUNBOOKS/alert-activation.md`, `OPERATIONS.md`, `.env.example`, `scripts/prod-health.sh` |

Nothing is unassigned. `scripts/gate-d-preflight-core.ts` is touched by no commit in the range — that
absence is the defect in §4.1.

---

## 3. Are the five Wave 2 commits cherry-pickable?

**Textually: yes, all five, in any order.** Their changed-file sets are pairwise disjoint (EXECUTED —
`git show --stat` on each):

| | `26d2b1c` | `86ba824` | `7099bde` | `59fad4f` | `c7d1506` |
|---|---|---|---|---|---|
| overlaps any other Wave 2 commit | no | no | no | no | no |

`git show <c> \| grep -i "termsAcceptance\|CURRENT_TERMS_VERSION\|lib/terms"` returns **zero hits for
`86ba824`, `7099bde` and `59fad4f`** (EXECUTED). The supposedly safe units really are free of the
terms model in code; the only hits outside `26d2b1c` are prose in `c7d1506`'s report.

**Semantically: no.** Four hidden couplings, each verified.

### 3.1 The migration directory *crashes* the Gate D preflight guard — CI blocker (EXECUTED)

`scripts/gate-d-preflight-core.ts:5-11` hard-codes a **six**-entry `GATE_D_MIGRATION_CHAIN`.
`loadGateDManifest()` compares it to the on-disk directory set and throws:

```
UnsupportedMigrationSqlError: Unsupported migration SQL
    at loadGateDManifest (scripts/gate-d-preflight-core.ts:763:11)
  statement: 'migration directory set: expected=0_init,…,20260721160000_operator_reputation
                                       actual=0_init,…,20260721160000_operator_reputation,20260728000000_terms_acceptance'
```

`.github/workflows/ci.yml` runs `npx --no-install tsx scripts/gate-d-preflight.test.ts` under
`set -euo pipefail` in the **`gate-d-preflight` job, on every push and every PR** (SOURCE). So **any
branch carrying the migration directory has a red CI**, independent of the database. This also means
the Gate D tooling can no longer emit a manifest — and §7 of the apply runbook depends on it.

Corrective commit **C1** is mandatory and must be in the *same* PR as the migration directory: adding
the name on a branch *without* the directory throws the mirror-image error. The new DDL uses only
forms with precedent in the existing chain — `TIMESTAMP(3) … DEFAULT CURRENT_TIMESTAMP` (29
occurrences in `0_init`), `ON DELETE RESTRICT ON UPDATE CASCADE` FKs (`20260721120000`,
`20260721160000`), plain and unique btree indexes (EXECUTED greps) — so the one-line chain extension
is *expected* to be sufficient, but that is **INFERRED**; re-run the guard to confirm.

### 3.2 `scripts/terms-acceptance.test.ts` couples D + E + F into one indivisible PR (SOURCE)

The guard reads, in one process: `prisma/schema.prisma`, the migration `.sql`, `lib/terms.ts`,
`app/api/stripe/checkout/route.ts`, `app/legal/terms/page.tsx`, `components/TermsAccept.tsx`, and all
four checkout callers. Line 61 is decisive:

```ts
return existsSync(p) && /CREATE TABLE\s+"TermsAcceptance"/.test(readFileSync(p, "utf8"));
```

CI's `verify` job runs `for f in scripts/*.test.ts; do … npx tsx "$f"; done` under `set -e` (SOURCE).

**Direct answer to the question asked:** yes — `scripts/terms-acceptance.test.ts` **fails CI if
merged without the migration file**. And §3.1 shows it fails CI *with* it. **Today the branch cannot
pass CI in either configuration.** Only C1 resolves that.

Since §6 of the same guard asserts the component and the three wired callers exist, and §3–4 assert
the route and library, **D, E and F cannot be separated without a red CI in every arrangement.** The
guard is the coupling agent.

### 3.3 The route hard-depends on the table at runtime (SOURCE)

`app/api/stripe/checkout/route.ts:234` calls `hasAcceptedTermsVersion(user.id)` unconditionally on
the in-place-upgrade branch. `lib/terms.ts` documents rule 4 — *"It FAILS CLOSED. Nothing here
catches."* — and contains no `catch` (a guard check asserts that). With the table absent the Prisma
query raises and the route's catch returns **500 on every in-place upgrade**. Deploying F before D is
applied takes down the upgrade revenue path.

### 3.4 Two required changes exist in **no commit** (EXECUTED — `git status`)

Agent 1's FK `Cascade → Restrict` fix and Agent 2's entire acceptance UI are **uncommitted working
tree**. A cherry-pick of `26d2b1c` alone ships the FK that the Identity Constitution forbids and a
428 with no way for a customer to satisfy it. C2 and C3 are not optional polish.

---

## 4. Strategy — chosen, and why the alternatives lose

**CHOSEN: dependency-ordered separate PRs, each built by cherry-picking whole reviewed commits onto a
short-lived branch off `origin/main`, plus exactly three corrective commits.**

Cherry-pick is the *mechanism*; separate PRs are the *shape*. No commit is split, reworded, squashed
or rebased — every reviewed commit lands on `main` byte-identical in content. The only new history is
C1/C2/C3, each of which is independently required (§3.1, §3.4).

| Alternative | Why rejected |
|---|---|
| Merge the branch as-is | Ships 8 commits from another workstream, and ships F before D is applied (§3.3). |
| One staged `release/rc1` branch merged once | A single merge = a single deploy. The migration ordering constraint (apply → validate → deploy) *cannot* be expressed inside one deploy. A rollback would revert unrelated Wave 1 fixes. |
| Cherry-pick into one big PR | Same defect as above, plus one CI signal for seven unrelated risk surfaces. |
| Rewrite history into clean per-unit commits | Discards reviewed commits — explicitly dispreferred, and buys nothing the PR boundary does not already buy. |

The cost of the choice: **six production deploys instead of one.** That is deliberate. On a live
Stripe product a smaller blast radius per deploy beats fewer deploy events.

---

## 5. Deployment mechanics that constrain every row below

- **Merging to `main` auto-deploys production** (~2 min, Vercel git integration) — CLAUDE.md. There
  is no merge-without-deploy. **Merge order *is* deploy order.**
- **`vercel.json` `buildCommand` is `prisma generate && next build`** (SOURCE). No `db push`, no
  `migrate deploy`. **No PR below mutates the database by being merged.** `scripts/schema-safety.test.ts`
  pins this.
- **PR branches get Vercel preview deployments, and `DATABASE_URL` is one shared value across
  Production and Preview** (CLAUDE.md gotcha #1). A preview of PR-5 therefore runs terms code against
  the **live** database and the **live** Stripe keys. Whether preview deployments are
  password-protected is **VERIFICATION REQUIRED — PRODUCTION** and must be answered before PR-5 is
  opened, not after.
- **CI lint is `continue-on-error: true`** (SOURCE) — the three pre-existing lint errors block
  nothing. Do not treat a green CI as a clean lint.
- `scripts/runtime/**` is **not** matched by CI's non-recursive `scripts/*.test.ts` glob — those
  guards are additive and inert until something invokes them.

---

## 6. The proposed PRs, in merge order

### PR-0 · Unit A + H — documentation, runbooks, read-only tooling
- **Purpose:** put the apply runbook and the release sequence on `main` *before* the owner needs
  them, and land verification tooling that cannot affect runtime.
- **⚠ CORRECTED 2026-07-28 (Wave 2.2, proven by execution — the list below was wrong).**
  The original list `[7099bde, 27bc430]` **does not apply.** Cherry-picking `7099bde` onto
  `origin/main` **CONFLICTS** on `OPERATIONS.md` (that file's prior state comes from `826413b`), and
  `27bc430` **CONFLICTS** modify/delete on `CREDITVECTOR_RC1_CRITERIA.md` (created by `c9c884e`).
  Both were executed and both returned exit 2.
- **Commits/files (corrected):** `c9c884e` → `826413b` → `7099bde` → `27bc430`, in that order; plus
  new commits for `RC1-PAID-PATH-CONSENT-INVENTORY.md`, `RC1-RELEASE-SEQUENCE.md`,
  `.ai/RUNBOOKS/migration-apply-terms-acceptance.md`.
  **Exclude `c7d1506`** (it describes code not yet on `main`).
  **`scripts/runtime/**` moves to PR-2**, the first unit whose behaviour those guards actually assert.
- **⚠ PR-0 is not documentation-only as cut:** `826413b` carries `app/global-error.tsx`, real runtime
  code. Either accept it as a passenger or split the commit — **OWNER DECISION REQUIRED**.
- **Depends on:** nothing. **Migration dependency:** none.
- **Merging auto-deploys:** **YES** — but no file is imported by the app or by CI's guard glob, so the
  deployed bundle is byte-equivalent in behaviour.
- **Deployment risk:** LOW.
- **Required checks:** CI both jobs green. (`gate-d-preflight` is green here — no migration directory.)
- **Rollback:** `git revert`; documentation only, no state.
- **Owner approval:** required (any push to `main` deploys).

### PR-1 · Unit B — Wave 1 production-path fixes
- **Purpose:** paywall bypass, billing identity by user id, admin revocation / demo-seed / letter
  orphaning, error boundary and probe hardening.
- **Commits:** `a2fa6ea`, `6bc4cf4`, `bd8f108`, `826413b` (the last also carries unit-H docs).
- **Depends on:** PR-0 only by convention. **Migration dependency: NONE** — no new table, column,
  index or enum.
- **Merging auto-deploys:** **YES.**
- **Deployment risk:** **MEDIUM–HIGH.** `6bc4cf4` changes *how the billing identity is resolved* on
  `/api/stripe/checkout` and `/api/stripe/portal`; `a2fa6ea` changes entitlement metering. Both are
  money paths on a live product.
- **Required checks:** CI both jobs; `npx tsx scripts/billing-integrity.test.ts`,
  `scripts/billing-identity.test.ts`, `scripts/critical-paths.test.ts`; post-deploy `curl` on the
  auth gates expecting 401/403.
- **Rollback:** clean `git revert` — no schema, no external state. The one caveat: `6bc4cf4` *fixed* a
  case where an email-changed subscriber could not reach the portal to cancel; reverting re-opens it.
- **Owner approval:** REQUIRED.

### PR-2 · Unit C — webhook lifecycle correction
- **Purpose:** idempotent, ordering-safe subscription webhooks; close the dedup claim window.
- **Commits:** `c3c4954`, `59fad4f` (also carries `RC1-DISABLED-ACCOUNT-POLICY.md` and
  `scripts/verify-production.sh` — both read-only passengers).
- **Depends on:** textually independent of PR-1 (disjoint files, EXECUTED). Sequence it *after* PR-1
  so only one billing change is in flight at a time.
- **Migration dependency: NONE.** The dedup table is `StripeWebhookEvent`, an enumerated **legacy**
  self-heal table (`scripts/schema-safety.test.ts` `LEGACY_SELF_HEAL_ALLOWLIST`) — permitted, not a
  new-schema dependency.
- **Merging auto-deploys:** **YES.**
- **Deployment risk:** **HIGH.** This is the live money-state writer. A defect here mis-sets plan
  state for real subscribers.
- **Required checks:** CI both jobs; `npx tsx scripts/stripe-lifecycle.test.ts`; `npx --no-install tsx
  scripts/runtime/stripe-webhook-claim.runtime.test.ts` (**mocked-runtime**, not production);
  post-deploy Stripe webhook delivery success rate.
- **Rollback:** `git revert` restores the prior handler. **Rows already written to
  `StripeWebhookEvent` persist** — the reverted code must tolerate them. Reverting does not un-write
  entitlements.
- **Owner approval:** REQUIRED.

### PR-3 · Unit G — compliance bar
- **Purpose:** generalize the score-outcome bar; stop rejecting scam warnings.
- **Commits:** `013ea53`, `86ba824` (also carries `RC1-B05-COUNSEL-REVIEW.md`).
- **Depends on:** nothing — `lib/compliance.ts` is disjoint from every other unit (EXECUTED).
- **Migration dependency:** none. **Merging auto-deploys:** **YES.**
- **Deployment risk:** MEDIUM. It changes what copy the scrubber permits. Each carve-out is a
  deliberate hole in the CROA bar.
- **Required checks:** CI both jobs; `npx tsx scripts/compliance-bar.test.ts`.
- **Rollback:** clean revert; no state.
- **Approval: COUNSEL REQUIRED before merge**, not merely owner. The eight questions in
  `RC1-B05-COUNSEL-REVIEW.md` are the gate. This PR may sit open indefinitely without blocking
  PR-0/1/2/4.

### PR-4 · Units D + E + F — the terms release (**indivisible**)
- **Purpose:** durable, versioned terms acceptance on the in-place upgrade path, with a UI that lets
  a customer satisfy the gate.
- **Commits:** `26d2b1c` + three corrective commits:
  - **C1** — extend `GATE_D_MIGRATION_CHAIN` in `scripts/gate-d-preflight-core.ts` and regenerate the
    Gate D manifest table in `.ai/RUNBOOKS/gate-d-production-migration.md` §2 for **seven**
    migrations. *Without C1 this PR's CI is red before any review starts* (§3.1).
  - **C2** — Agent 1's FK `ON DELETE CASCADE → RESTRICT` in **both** `schema.prisma` and
    `migration.sql`, plus the route comment correction.
  - **C3** — Agent 2's `components/TermsAccept.tsx`, the three wired callers, and
    `scripts/terms-acceptance.test.ts` §6.
- **Why indivisible:** §3.2. Any split is a red CI.
- **⚠ CORRECTED 2026-07-28 (Wave 2.2, proven by execution).** PR-4 additionally hard-depends on
  **two PR-1 commits**, which this document previously omitted:
  - `a2fa6ea` — `2911d44`'s import hunks in `app/agency/page.tsx` and `app/billing/page.tsx` carry
    `a2fa6ea`'s added import line as trailing *context*. Without it the pick CONFLICTS (executed).
  - `6bc4cf4` — semantic and textually invisible: the terms package picks CLEAN onto `a2fa6ea` alone
    and passes `prisma validate`, `tsc --noEmit` and `next build`, but that state **reintroduces the
    email-keyed billing identity `6bc4cf4` fixed**. A cherry-pick list is not a dependency proof.
  **PR-1 must merge before PR-4.** Omitting `6bc4cf4` produces a green tree carrying a fixed defect.
- **⚠ The FK corrective (C2) is now guard-pinned.** Wave 2.2 built PR-4 with it omitted: the tree
  cherry-picked clean, typechecked, and passed the terms, schema-safety, gate-d-preflight **and**
  terms-runtime guards at exit 0 while shipping `ON DELETE CASCADE`. `scripts/terms-acceptance.test.ts`
  now pins the FK in both model and migration; that exact state fails 4 assertions.
- **Depends on:** PR-0 (the runbook), **PR-1** (`a2fa6ea` + `6bc4cf4`, above), and **on a completed
  production operation that is not a PR** —
  the Gate D baseline plus the migration apply.
- **Migration dependency: HARD AND BLOCKING.** Merging before the table exists = **HTTP 500 on every
  in-place upgrade** (§3.3). Merging before C3 = **HTTP 428 with no way to satisfy it**.
- **Merging auto-deploys:** **YES — and this is why merge is the LAST step of the release, executed
  only after apply + forward validation.**
- **Deployment risk:** **HIGHEST in this release.** It is the only unit whose failure mode is a dead
  revenue path rather than a degraded feature.
- **Required checks:** CI both jobs (green only after C1); `npx tsx scripts/terms-acceptance.test.ts`
  (74+ assertions); `scripts/checkout-consent.test.ts`; `scripts/schema-safety.test.ts`;
  `npx --no-install tsx scripts/runtime/terms-acceptance.runtime.test.ts` (**mocked runtime**);
  `npx prisma migrate diff` exit 0 between `schema.prisma` and the migration; **and the forward
  validation in `.ai/RUNBOOKS/migration-apply-terms-acceptance.md` §7 must already have passed.**
- **Rollback:** revert the PR → the gate disappears, upgrades return to pre-B-06 behaviour, and any
  rows already written **persist and are not orphaned** (nothing else references them). **Do not roll
  back the table.** Dropping it once it holds rows destroys consent evidence that nothing may
  recreate — no backfill exists and none is permitted.
- **Owner approval: TWO SEPARATE APPROVALS** — (a) authorize the Gate D baseline + the migration
  apply; (b) authorize the merge, after forward validation passes.

### PR-5 · Unit A — the Wave 2 / 2.1 record
- **Purpose:** land `c7d1506` (criteria v1.2 + the Wave 2 report) and a Wave 2.1 addendum.
- **Depends on:** PR-1 … PR-4. **Must be last** — it asserts a repository state that only becomes
  true once the others merge. Merging it earlier makes `main` carry a document that is false.
- **Migration dependency:** none. **Auto-deploys:** YES, docs only. **Risk:** LOW.
- **Rollback:** revert. **Owner approval:** required.

### Ordering summary

```
PR-0 (docs+runbook)  ──►  PR-1 (Wave 1 fixes)  ──►  PR-2 (webhooks)  ──►  PR-5 (record)
                                                                            ▲
PR-3 (compliance) ── COUNSEL gate ──────────────────────────────────────────┤
                                                                            │
[owner: Gate D baseline] ─► [apply migration] ─► [forward-validate] ─► PR-4 ┘
        ^^^^ not a PR — a production operation, see the apply runbook ^^^^
```

---

## 7. Adversarial verification of this sequence (Part D)

Each attempt below is an attempt to **break the plan above**. "Succeeded" means the plan is defective.

| # | Attack | Result | Evidence |
|---|---|---|---|
| 1 | **Merge a "safe" PR and thereby deploy schema-dependent code.** | **FAILED (plan holds).** PR-0/1/2/3/5 contain zero references to `TermsAcceptance` in code — EXECUTED grep over the whole tree returns hits only in `prisma/**`, `lib/terms.ts`, `app/api/stripe/checkout/route.ts`, and the three guards, all of which are in PR-4. | §3, EXECUTED |
| 2 | **Ship the UI referencing an API contract that is not live.** | **PARTIALLY SUCCEEDED — mitigated by construction.** The UI's `readTermsChallenge()` only activates on a 428 the server sends. But E and F are in the **same PR** (§3.2), so the contract and its consumer deploy in one atomic step. The residual is field-name drift: renaming `termsRequired` / `termsVersion` / `termsUrl` / `acceptTerms` in a *later* PR silently disables the recovery UI without failing any guard. **Recorded as a residual risk, not fixed here.** | Agent 2's handoff; SOURCE |
| 3 | **Make API enforcement precede the migration.** | **SUCCEEDED against the naive plan — this is why PR-4 exists as a merge-gated unit.** Merge = deploy, so nothing in the repository can prevent it; only the owner gate can. `hasAcceptedTermsVersion()` is uncatchable by design → 500 on every upgrade. The plan's countermeasure is procedural, not technical, and that must be stated plainly rather than dressed up as a safeguard. | §3.3, SOURCE |
| 4 | **Get the migration to fabricate consent.** | **FAILED.** `migration.sql` contains 1 `CREATE TABLE`, 2 `CREATE INDEX`, 1 `ADD CONSTRAINT` and **zero** `INSERT`/`UPDATE`/`COPY` (EXECUTED read). The only column default is `acceptedAt DEFAULT CURRENT_TIMESTAMP`, which cannot manufacture a row. `scripts/terms-acceptance.test.ts:92` asserts the absence. `lib/terms.ts` rule 5 forbids backfill. No path in the plan writes a row for an existing subscriber. | SOURCE |
| 5 | **Make rollback strand accepted users.** | **FAILED for application rollback; SUCCEEDS for table rollback — so the plan forbids table rollback.** Reverting PR-4 leaves rows intact and un-referenced; the gate simply stops running. Dropping the table while PR-4 is deployed = 500s; dropping it after rows exist = irrecoverable loss of consent evidence. The apply runbook states this as a stop condition. | §6 PR-4, `migration.sql` header |
| 6 | **Make rollback corrupt subscriptions.** | **FAILED.** The B-06 hunk writes no entitlement — the route's own comment states entitlements are written only by the webhook. A Stripe subscription changed *before* a revert keeps its Stripe-side state and is reconciled by `customer.subscription.updated`. Reverting PR-2 is the riskier one: rows in `StripeWebhookEvent` outlive the revert; the older handler must tolerate them. **Flagged, not disproven** — this was not exercised against a real database. | SOURCE + PR-2 rollback note |
| 7 | **Find a step that disables paid upgrades.** | **SUCCEEDED — two of them, both already in the plan.** (a) Merging PR-4 before apply → 500 on every in-place upgrade. (b) Merging PR-4 without C3 → 428 with no UI to satisfy it. Both are the reason PR-4 is last and indivisible. Verified *not* affected: new subscriptions (Checkout Session path, never reaches the gate) and the `letters_5` pack (`mode: "payment"`, returns before the subscription branch) — EXECUTED read of the route + Agent 2's classification. | §3.3, §3.2 |
| 8 | **Open PR-4 and let its Vercel preview do damage.** | **SUCCEEDED as an unmitigated hazard.** Preview shares `DATABASE_URL` with production and uses live Stripe keys. The build cannot mutate schema (`buildCommand` has no `db push`), but a real session on a preview URL could attempt a real upgrade against real Stripe. **Whether preview deployments are access-protected is unverified.** Answer it before opening PR-4. | CLAUDE.md gotcha #1, `vercel.json` (SOURCE) |
| 9 | **Get a red CI merged anyway.** | **SUCCEEDED against the current repository.** `gate-d-preflight` fails today on any branch carrying the migration (EXECUTED), and branch protection requiring the CI check is recorded in the RC1 criteria as an **owner-side setting not yet confirmed applied** — so nothing mechanically stops a merge. C1 fixes the red; branch protection remains **VERIFICATION REQUIRED — PRODUCTION**. | §3.1, `ci.yml` header comment |
| 10 | **Find a place where this plan implies a written document is operational proof.** | **SUCCEEDED once, now corrected.** The Wave 2 report demoted a criterion because a *decision memo existed*. This document therefore states explicitly: **PR-0 landing the apply runbook proves nothing about production.** Restore capability (B-09), alert delivery (B-10), and the migration itself are unproven until each is *executed and its output recorded*. No row in §6 may be marked done on the strength of a merged Markdown file. | this section |
| 11 | **Split PR-4 to reduce blast radius.** | **FAILED — every split is a red CI.** Verified by reading the guard's cross-file assertions (§3.2). The only way to split would be to weaken the guard, which trades a real safety property for a scheduling convenience. Rejected. | §3.2 |
| 12 | **Reorder PR-3 (compliance) ahead of PR-1.** | **FAILED to break anything.** `lib/compliance.ts` is file-disjoint from all other units and imports nothing from them. PR-3 is genuinely order-free — it is gated by counsel, not by engineering. | EXECUTED `git show --stat` |

**Net:** attempts 3, 7, 8, 9 and 10 found real hazards. 3 and 7 are contained only by owner procedure
— the repository cannot enforce them. 8 and 9 are open and require production answers before PR-4 is
opened. 10 is a documentation discipline, now written down.

---

## 8. Part C — challenging *"No remaining blocker is engineering work"*

That sentence appears in `CREDITVECTOR_RC1_EXECUTION_WAVE_2_REPORT.md` §11. **It was false when
written and is more clearly false now.** Classification of every remaining RC1 item into exactly one
category:

### ENGINEERING (work only a developer can do)

| # | Item | Evidence | State |
|---|---|---|---|
| E1 | **`scripts/gate-d-preflight-core.ts` chain does not include the new migration — the Gate D guard *crashes*, and CI's `gate-d-preflight` job is red on any branch carrying it.** | EXECUTED, §3.1 | **OPEN — blocks PR-4** |
| E2 | Regenerate `.ai/RUNBOOKS/gate-d-production-migration.md` §2 manifest for seven migrations (the runbook's own review gate says stop if the table differs from the tool). | SOURCE | OPEN, rides with E1 |
| E3 | **The acceptance UI.** The Wave 2 report itself listed the 428-with-no-UI failure as a release hazard. Building it *is* engineering. | Agent 2 delivered it this session; uncommitted | **DONE this session, NOT COMMITTED** |
| E4 | **FK `Cascade → Restrict`** in schema + migration. | Agent 1, uncommitted | **DONE this session, NOT COMMITTED** |
| E5 | Local consent trace for the **new-subscription** and **letter-pack** paths (webhook `checkout.session.completed`, both branches; widen `TermsContext`). Today a $19 pack buyer leaves *no* local trace. | Agent 2 Part C; SOURCE | OPEN — engineering, **gated by an owner/counsel decision on whether it is required** |
| E6 | Acceptance at **registration**, if the owner answers yes to decision 13.5 — signup UI + a second `TermsContext`. | Wave 2 report §13.5 | OPEN, conditional |
| E7 | **Disabled-account cancellation path** (§9). Any of options A/C/D in `RC1-DISABLED-ACCOUNT-POLICY.md` is code. | SOURCE | OPEN, conditional on owner ratification |
| E8 | Three pre-existing **lint errors**; CI hides them behind `continue-on-error: true`. | Agent 3 EXECUTED; `ci.yml` SOURCE | OPEN, low |
| E9 | Wire `scripts/runtime/run-all.ts` into the validation sequence + `.ai/TESTING.md`. It is inert under the current `scripts/*.test.ts` glob. | Agent 3; SOURCE | OPEN, low |
| E10 | Stale comment in `lib/billing.ts` (~120-129) citing the retracted "only build-time `db push` fails through Accelerate" premise as a rationale for self-heal. | Agents 1 and 3 both flagged | OPEN, low — but it is precedent-shaped |

**E1 alone falsifies the claim: no RC1 item can ship at all until a developer edits a source file.**

### OWNER DECISION
O1 apply the migration — yes/no (13.1) · O2 approve the Gate D baseline (13.2) · O3 ratify a
disabled-account billing policy (four options) · O4 backfill option A/B/C for existing subscribers ·
O5 require acceptance at registration? · O6 approve each of the six merges in §6 · O7 whether E5 is
in scope for v1.0.

### COUNSEL
C-1 **B-12** — CROA/FCRA positioning, ToS/Privacy/refund (critical path) · C-2 **B-05** — the eight
compliance-bar questions, gating PR-3 · C-3 are backfill options B/C lawful · C-4 acceptance scope
(registration vs point-of-charge) · C-5 `TermsAcceptance` retention schedule (§12.4 of the Identity
Constitution reserves durations to counsel; `Restrict` deliberately fixes none) · C-6 whether a
"click to cancel"-style requirement applies (gates O3).

### PRODUCTION OPERATIONS
P1 Gate D baseline (`migrate resolve --applied` ×6, then `migrate status`) · P2 apply
`20260728000000_terms_acceptance` · P3 forward-validate · P4 backup/snapshot before P2 — **no backup
has been verified to exist** · P5 run the restore drill and record measured RPO/RTO (B-09) · P6 the
six production deploys in §6.

### EXTERNAL CONFIGURATION
X1 `STRIPE_TOS_CONSENT=1` **and** a Terms URL in the live Stripe Dashboard · X2 `ALERT_WEBHOOK_URL` ·
X3 `SETUP_SECRET` (C-01) · X4 confirm the DB provider behind Prisma Accelerate (~15 min; unblocks
B-09) · X5 GitHub branch protection requiring the CI check on `main` · X6 Stripe Billing Portal
configuration if option A of the disabled-account policy is chosen · X7 Vercel preview-deployment
access protection (§7 attempt 8).

### VERIFICATION
V1 did the encryption backfills complete (C-02) · V2 any out-of-band Stripe prices · V3 does a
150-tradeline re-analysis fit the 15s ceiling · V4 post-deploy: upgrade without `acceptTerms` returns
428 and creates no Stripe change · V5 `prisma migrate diff --from-migrations` against a real shadow
database — **NOT RUN — ENVIRONMENT** (no shadow DB; Agent 3) · V6 confirm the Gate D guard passes
after E1.

**Corrected statement:** *"Ten engineering items remain, two of them blocking (E1, and E3/E4 being
uncommitted). The critical path is still decisions and production access — but it is no longer true
that engineering is finished."*

---

## 9. Part E — disabled-account cancellation (**OWNER DECISION REQUIRED — do not implement**)

### Does a ratified policy conflict?
**No.** `RC1-DISABLED-ACCOUNT-POLICY.md` line 3 reads *"Status: OWNER DECISION REQUIRED. Nothing in
this document has been implemented."* (SOURCE). It is a proposal presenting four options. Nothing is
ratified, so nothing conflicts. Owner direction #4 — *a disabled paying customer must retain a secure
cancellation path* — is **compatible with, and narrower than, that document's Option A.**

### The current behaviour (SOURCE, verified this session)
`app/api/stripe/portal/route.ts` calls `currentAccount()`; `lib/session.ts:30` returns `null` when
`account.disabled` — fail-closed by design and correct for app access. The portal route then returns
**401**. `POST /api/admin/billing/cancel` exists but is admin-gated. **Net: a disabled subscriber
cannot self-cancel while Stripe keeps charging.**

### Smallest implementation satisfying the owner's direction

A **cancellation-only** portal path. Not a new page, not a new session model, not a new table.

1. **One new route** — a cancellation-only sibling of the portal (e.g. `POST
   /api/stripe/portal/cancel`). It resolves the account by **immutable user id** from the JWT, via a
   dedicated helper that permits `disabled === true` **and nothing else**. `currentAccount()` and
   `currentUser()` stay unchanged — the fail-closed default must not be loosened for any other
   surface.
2. **Fail closed with no Stripe customer.** If `stripeCustomerId` is null → refuse (400/404). Never
   create a customer on this path. Never call `getOrCreateStripeCustomer`.
3. **Cancellation only, enforced by Stripe.** Open the Billing Portal with a **portal configuration
   whose only enabled feature is subscription cancellation** (invoice history optional, owner's
   call). Payment-method update, plan switching and upgrades are disabled *in Stripe*, so the
   restriction does not depend on our UI. This is external configuration — X6.
4. **No app access.** The route returns a Stripe URL and nothing else. It renders no dashboard, reads
   no credit data, grants no entitlement, and must not be reachable from any authenticated nav.
5. **No purchases.** `/api/stripe/checkout` keeps using `currentAccount()` and therefore keeps
   refusing disabled accounts. Do not touch it.
6. **Auditable.** One audit-log entry per invocation — actor = the user id, action = portal opened
   for cancellation, timestamp. Reuse the existing admin audit-log mechanism; **no new table**, so no
   migration, so this does not enter the MIGRATION-FIRST path.
7. **Rate-limited and single-purpose.** No impersonation cookie, no agency workspace resolution —
   mirror the comment already in `portal/route.ts` about `currentAccount()` deliberately not
   following those.

**Blast radius:** one new route file, one small session helper, one Stripe Dashboard portal
configuration, one guard script. No schema change. No change to any existing gate.

**Why not the alternatives:** Option B (admin cancellation + SLA) is zero code but leaves the
customer without a self-service path, which owner direction #4 appears to reject. Option C
(auto-cancel on disable) changes the meaning of the admin disable action and forces a
period-end-vs-immediate refund decision. Option D (split flag) is a data-model change and therefore a
migration.

**Unresolved and NOT decided here:** whether a self-service path is *legally required* (C-6);
period-end vs immediate; refund posture; whether invoice history may remain visible. **COUNSEL
REQUIRED / OWNER DECISION REQUIRED.**

---

## 10. What this document is not

It is a plan. **Nothing in it has been executed.** No PR has been opened, no branch created, no
commit cherry-picked, no migration applied, no deploy triggered, and no production system contacted.
The forward validation, the restore capability, the alert delivery and the migration apply are all
**unproven until each is run and its actual output recorded.** A merged Markdown file is not
operational proof.
