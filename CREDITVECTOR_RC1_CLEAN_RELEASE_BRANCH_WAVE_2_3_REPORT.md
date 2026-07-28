# CreditVector — RC1 Clean Release Branch Program, Wave 2.3

**Date:** 2026-07-28 · **Source branch:** `claude/creditvector-founder-library-jwnbhc` @ `5a4b006`
**Verified base:** `origin/main` = `dfe7a3a` — **fetched and confirmed UNCHANGED since Wave 2.2**
**Status:** Draft — not ratified

> **Four clean release branches now exist, each built from `origin/main` and proven under isolated
> CI-equivalent conditions.** The mixed source branch is no longer the delivery vehicle.
>
> **RC1 remains 🔴 NO-GO.** No blocker status changed.
>
> **No merge, no deploy, no production migration, no Gate D baseline, no live Stripe mutation, no
> production database contact, no GitHub PR created, no push of any release branch.**

---

## 1. Context for a reader with no repository access

**CreditVector** is a live Next.js 14 consumer-credit **education** SaaS (creditvector.app) with live
Stripe billing. **RC1** is its Version 1.0 release program. Waves 1–2.2 fixed 9 launch blockers and
proved that the working branch **could not be shipped as-is**: it carries two unrelated workstreams,
and several proposed PRs were unbuildable as specified.

**Wave 2.3 built the actual release units.** Each is a fresh branch from `origin/main`, assembled by
cherry-pick, and proven with **its own `npm ci` and its own `prisma generate`** — never shared state.

**Merging to `main` auto-deploys production.** Merge and deploy are one event.

---

## 2. Owner decisions applied

| | Decision | How it was executed |
|---|---|---|
| **O1** | PR-1 = `a2fa6ea`, `6bc4cf4`, `bd8f108`; exclude `c3c4954`, `013ea53` | Executed exactly; compliance and webhook files proven **byte-identical to `origin/main`** |
| **O2** | PR-4a / PR-4b split approved | **Not built** — manifests only |
| **O3** | `app/global-error.tsx` must not sit in a docs-only PR | Extracted into its own branch, **PR-0c** |
| **O4** | Source hashes must not pose as extracted hashes | Every source hash labelled **PROVENANCE**; extracted hashes listed separately |
| **O5** | Disabled paying subscribers must not stay stranded | **Not implemented.** Preserved as an RC1 item and stated plainly below |
| **O6** | Isolated deps + per-branch Prisma generation mandatory | Enforced: `rm -rf node_modules .next` → `npm ci` → `prisma generate` per branch |

---

## 3. Agents and ownership

| Agent | Owned |
|---|---|
| 1 — Base verification & manifests | Read-only; produced the extraction recipes |
| 2 — PR-1 | `release/pr1-critical-fixes` only |
| 3 — PR-2 | `release/pr2-stripe-lifecycle` only |
| 4 — PR-0b / PR-0c | those two branches only |
| 5 — Adversarial | Read-only on others' branches; own `a5-*` controls |
| Coordinator | Base verification, infrastructure, control branch, ancestry proof, RC1, reports |

---

## 4. Two-workstream exclusion — proof

The source branch carries **8 Founder Library / Knowledge Architecture commits** beneath the RC1 work.
**Every clean branch was built from `origin/main`, never from the source branch.**

**Coordinator-verified, all four branches:**

| Branch | Base is `origin/main` | FL commits in ancestry | Forbidden paths in diff |
|---|---|---|---|
| `release/pr1-critical-fixes` | ✅ | **0** | **0** |
| `release/pr2-stripe-lifecycle` | ✅ | **0** | **0** |
| `release/pr0b-ops-runbooks` | ✅ | **0** | **0** |
| `release/pr0c-global-error-boundary` | ✅ | **0** | **0** |

**A false positive in my own scan, corrected by the control:** `architecture/GIOS-*` **already exists
on `origin/main`**. Its presence in a tree is therefore *not* an extraction defect — only its presence
in a **diff** would be, and that count is 0 everywhere. Three agents independently flagged the same
thing.

**Control branch** (`release/control-origin-main`, bare `origin/main`, isolated install):
`npm ci` PASS · `prisma generate` PASS · `tsc` PASS · **70/70 guards** · `next build` PASS.
`prisma validate` FAILs on missing `DATABASE_URL` — **a harness artifact reproducing on the control**,
so it is never a branch regression.

---

## 5. Clean-branch matrix

| Unit | Branch | Base | Head | Picks | Files | Typecheck | Build | Guards | Runtime | Forbidden | Review | Merge |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **PR-1** | `release/pr1-critical-fixes` | `dfe7a3a` | `103f84e` | 3 | 14 | **PASS** | **PASS** | **73/73** | n/a | **PASS** | **SAFE TO REVIEW** | **NOT SAFE TO MERGE** — owner items |
| **PR-2** | `release/pr2-stripe-lifecycle` | `dfe7a3a` | `475e180` | 3 | 14 | **PASS** | **PASS** | **71/71** | **2/2 PASS** | **PASS** | **SAFE TO REVIEW** | **CONDITIONAL — OWNER** |
| **PR-0b** | `release/pr0b-ops-runbooks` | `dfe7a3a` | `57359d7` | 3 | 6 | **PASS** | **PASS** | **70/70** | n/a | **PASS** | **SAFE TO REVIEW** | **SAFE TO MERGE** |
| **PR-0c** | `release/pr0c-global-error-boundary` | `dfe7a3a` | `6309e39` | 1 | 1 | **PASS** | **PASS** | **70/70** | n/a | **PASS** | **SAFE TO REVIEW** | **SAFE TO MERGE** |

**Guard arithmetic is itself a cross-check:** base 70 · PR-1 +3 = 73 · PR-2 +1 = 71 · PR-0b 70 ·
PR-0c 70. Any deviation would mean a leaked or dropped file.

**Cross-branch file overlap: ZERO** — the four diffs are fully disjoint (coordinator-verified).

---

## 6. Branch results

### PR-1 — critical product and authorization fixes
**Provenance:** `a2fa6ea`, `6bc4cf4`, `bd8f108` · **Extracted:** 3 commits ending `103f84e`
**Files (14):** `lib/entitlements.ts` · `lib/admin.ts` · `lib/analyze.ts` · letters `generate`/`round2` ·
`api/billing/status` · `api/stripe/{checkout,portal}` · `api/demo/seed` · `app/{agency,billing}/page.tsx` ·
3 new guards.

Free-letter deletion bypass closed (usage derives from the append-only ledger) · Round 2 entitlement
enforced · balances cannot go negative · unknown plan fails closed · billing identity resolves by
**immutable user id** · demo credentials not exposed · re-analysis preserves letter↔tradeline links ·
disabled admins refused.

**Isolation proven by coordinator:** `lib/compliance.ts` and `app/api/stripe/webhook/route.ts` are
**byte-identical to `origin/main`** — PR-1 contains no PR-2 or PR-3 behaviour. No `TermsAcceptance`
reference; no `components/TermsAccept.tsx`.

**⚠ Disabled paying subscriber — NOT resolved.** `6bc4cf4` routes the Stripe portal through
`currentAccount()`, which fails closed on `disabled`, so a suspended **paying** customer gets 401 and
cannot self-cancel. That is the intended security behaviour, and it **narrowly worsens** the known
condition by closing an incidental self-cancel path. Per **O5** the remedy stays an RC1 item.

### PR-2 — Stripe lifecycle and webhook correction
**Provenance:** `c3c4954`, `59fad4f`, plus path-extracted runtime guards from `4871d4e` and the CI step
from `beeafd1` · **Extracted:** 3 commits ending `475e180`

Three-state claim (`claimed` / `in_flight` / `completed`) · abandoned claims age out so Stripe's retry
can run · re-retrieval so a delayed event cannot revoke a paying customer · unknown price writes **no
`plan` key**.

**These are the repository's first RUNTIME guards** — they execute the real handler. Wired into CI as
their own step because `scripts/*.test.ts` is a **non-recursive** glob that never reached them.
**MIGRATION-FIRST compliant:** the claim reuses the existing `type` column; `prisma/` diff is **empty**;
`schema-safety` 17/17 unmodified.

**⚠ Asymmetric rollback — undisclosed by the builder, found by adversarial review.** Reverting PR-2
leaves `pending:%` rows in `StripeWebhookEvent`; the restored code treats any row as "already
processed", so those webhooks would be **silently dropped**. Remediation is a production
`DELETE ... WHERE type LIKE 'pending:%'` — **a production action, not performed.**

### PR-0b — operational runbooks and read-only tooling
**Provenance:** `826413b` (partial), `7099bde` (whole), `beeafd1` (partial) · **Head:** `57359d7`
**Files (6):** `OPERATIONS.md` · `.ai/RUNBOOKS/{restore-drill,alert-activation}.md` · `.ai/INDEX.md` ·
`.env.example` · `scripts/prod-health.sh`

**Zero files under `app/`, `lib/`, `components/`, `prisma/`** — the compiled bundle is identical to
base. Runbooks claim nothing they cannot prove: the drill is recorded **NOT RUN** with RPO/RTO blank
by design; alert **configuration presence is explicitly distinguished from delivery proof**.

**The `826413b` split was deterministic, not a judgement call:** every pre-image blob matches
`origin/main` exactly, so path extraction reproduces the post-image byte-for-byte.

### PR-0c — global error boundary
**Provenance:** `826413b` (1 of 4 files) · **Head:** `6309e39` · **Files: 1** — `app/global-error.tsx`

**Zero imports.** Renders its own `<html>`/`<body>` with inline styles, deliberately avoiding prisma,
`next/headers`, brand modules and Tailwind — because it runs precisely when the shell has already
failed. Emitted artifact confirmed in the branch's own build.

---

## 7. Corrections made during the wave

1. **`scripts/verify-production.sh` belongs to PR-2, not PR-0b.** Agent 4 disagreed with the task
   prompt and was right — it is a Stripe/production verification harness, not ops documentation.
2. **My `forbidden.sh` had a false positive** on `architecture/GIOS-*`; the control proved those files
   already live on `origin/main`. Only diff-relative checks are meaningful.
3. **`scripts/runtime/_fakes.ts` is a git-binary blob** (one NUL byte). It must be moved with
   `git checkout <sha> -- <path>`; a text patch or copy-paste would silently corrupt it.
4. **`717697f` is not schema-only** — it also edits the checkout route, which complicates the O2
   PR-4a/PR-4b split. Flagged for the future manifest, not resolved here.

---

## 8. Runtime vs source-level evidence

**RUNTIME (PR-2 only):** `scripts/runtime/run-all.ts` exit 0 — `stripe-webhook-claim` 36/36,
`unknown-price-failclosed` 29/29, executing the real route handler.

**SOURCE-LEVEL:** every `scripts/*.test.ts`, including `stripe-lifecycle.test.ts` (84/84), which pins
the **source text** of the three-state contract — labelled as such in `.ai/TESTING.md` and **not** to be
quoted as runtime proof.

**Negative controls (adversarial agent, on-branch):** disabling the in-flight rejection → 31/5, exit 1.
Removing the subscription re-retrieval → 25/11 and 28/1 across both runtime guards, plus 82/2 at source
level, exit 1. **Known gap, self-declared:** the guards prove the re-retrieval *executes*, not that a
reordered `deleted`-then-stale-`active` pair leaves the plan revoked. Adding that scenario is the
cheapest remaining improvement.

---

## 9. Copy-and-paste-ready PR packages

> All four: **base `main`** · **merging auto-deploys production (~2 min)** · owner confirmation required
> per `CLAUDE.md` · nothing pushed, no GitHub PR created.

### PR-1
**Title:** `fix(billing,security): close the free-letter bypass, resolve billing identity by user id, and restore admin revocation`

**Body:**
```
Three extraction-proven critical fixes, cherry-picked onto main. PROVENANCE: a2fa6ea, 6bc4cf4, bd8f108
(source-branch hashes; this branch's commits are new objects).

- Free-letter paywall: usage now derives from the append-only ProductEvent ledger, so deleting letters
  no longer resets the meter. Round 2 consumes entitlement; credits cannot go negative.
- Billing identity: three routes resolved the account by mutable session email. A subscriber who
  changed their email could not reach the Stripe portal to cancel, and a re-registered address could
  resolve a stale JWT to a stranger's billing. Now uses currentAccount() (immutable user id).
- Security: requireAdmin() honours `disabled`; /api/demo/seed 404s in production and returns no
  password; report re-analysis re-links dispute letters instead of orphaning them.

NO schema or migration dependency. lib/compliance.ts and the Stripe webhook route are byte-identical
to main — this PR contains no compliance or webhook-lifecycle behaviour.

Verified on this branch with its own npm ci and prisma generate: tsc PASS, next build PASS, 73/73 guards.

KNOWN CONSEQUENCE (owner-acknowledged, RC1 item): a disabled-but-paying subscriber now gets 401 from
the billing portal and cannot self-cancel. Intended fail-closed security behaviour; the narrowly scoped
cancellation-only path remains RC1 work and is not implemented here.

VERIFICATION REQUIRED — PRODUCTION: re-analysis now runs in one 15s interactive transaction; large
reports must be measured against that ceiling.

Merging to main auto-deploys production.
```

### PR-2
**Title:** `fix(stripe): make subscription webhooks idempotent, ordering-safe and claim-window-free, with the first runtime guards in CI`

**Body:**
```
PROVENANCE: c3c4954, 59fad4f, plus path-extracted runtime guards (4871d4e) and the runtime CI step
(beeafd1). This branch's commits are new objects.

Three-state claim (claimed / in_flight / completed): a duplicate is refused forever, while an abandoned
claim ages out so Stripe's retry can actually run. Subscription events re-retrieve current state, so a
delayed event cannot restore a revoked plan or revoke a paying customer. An unrecognised price now
fails CLOSED — no plan key is written at all.

MIGRATION-FIRST COMPLIANT: the claim reuses the EXISTING `type` column as pending:<eventType>. No new
column, no new table, no migration. prisma/ diff is empty; schema-safety passes 17/17 unmodified.

FIRST RUNTIME GUARDS: scripts/runtime/ executes the real route handler. Wired into CI as its own step
because scripts/*.test.ts is a non-recursive glob that never reached it. Proven non-decorative by two
mutations, each turning the suite red. scripts/stripe-lifecycle.test.ts is SOURCE-LEVEL and must not be
quoted as runtime proof.

Verified on this branch with its own npm ci and prisma generate: tsc PASS, next build PASS, 71/71
source guards, 2/2 runtime guards.

⚠ ASYMMETRIC ROLLBACK: reverting this PR leaves pending:<eventType> rows in StripeWebhookEvent, and the
restored code treats any row as "already processed" — those webhooks would be silently dropped.
Remediation is a production DELETE of rows WHERE type LIKE 'pending:%'. Blast radius is limited to
events in flight within the 15-minute window at revert time.

MERGE ORDER: merge PR-0b at or before this PR — verify-production.sh references
.ai/RUNBOOKS/alert-activation.md, which lands there.

Merging to main auto-deploys production and changes LIVE Stripe webhook handling.
```

### PR-0b
**Title:** `docs(ops): executable restore-drill and alert-activation runbooks, a hardened health probe, and .env.example drift fix`

**Body:**
```
PROVENANCE: 826413b (partial — ops files only), 7099bde (whole), beeafd1 (partial — the INDEX row).

Documentation and ops tooling only. No file under app/, lib/, components/, prisma/ or middleware is
touched, so the compiled bundle is identical to base.

The runbooks claim nothing they cannot prove: the restore drill is recorded as NOT RUN with RPO/RTO
blank by design; alert configuration presence is explicitly distinguished from delivery proof; the
drill is provider-neutral because the origin database provider behind Prisma Accelerate is unconfirmed.
scripts/prod-health.sh no longer scores a deleted route (404) as healthy.

Verified on this branch with its own npm ci: tsc PASS, next build PASS, 70/70 guards (identical to base).

This does NOT close RC1 B-09 or B-10 — no drill has run and no alert delivery has been proven.

Merging to main auto-deploys production; the bundle is byte-unchanged.
```

### PR-0c
**Title:** `fix(reliability): add the root error boundary app/global-error.tsx`

**Body:**
```
PROVENANCE: 826413b (1 of its 4 files). Split out per owner decision O3 so runtime code does not ride
in a documentation-only PR.

A throw inside the root layout is uncatchable by app/error.tsx. This adds the Next.js root boundary.
It has ZERO imports and renders its own html/body with inline styles — deliberately avoiding prisma,
next/headers, brand modules and Tailwind, because it runs precisely when the shell has already failed.
It surfaces the Next.js digest so an incident can be correlated, and nothing else.

One added file. Strictly additive: there is no path by which it fires on a healthy render.

Verified on this branch with its own npm ci: tsc PASS, next build PASS (emitted chunk confirmed),
70/70 guards.

Merging to main auto-deploys production.
```

---

## 10. Prepared manifests — NOT authorized, NOT built

| Unit | Intended contents | Gate | Stop condition |
|---|---|---|---|
| **PR-0a** | `c9c884e` — RC1 criteria doc (PR-2 references it) | Owner disclosure decision | Not built this wave |
| **PR-3** | `013ea53` + `86ba824` (**must combine** — `86ba824` conflicts without `013ea53`) | **BLOCKED — COUNSEL** | Do not build for merge until counsel clears B-05 |
| **PR-4a** | Terms schema + additive migration + FK `RESTRICT` + Gate D registration | **BLOCKED — OWNER + PRODUCTION** | ⚠ `717697f` is **not schema-only** — it also edits the checkout route, so a strictly schema-only 4a cannot take it whole |
| **PR-4b** | `lib/terms.ts`, `components/TermsAccept.tsx`, route enforcement, caller wiring, guards | Depends on **applied and forward-validated** 4a | Must not merge before the migration is live |
| **PR-5** | RC1 records (`27bc430`, `c7d1506`, `d6303fc`, `5a4b006`) | After real release states exist | Wave 2.2 proved these are false in every intermediate state |

---

## 11. Go/No-Go — 🔴 NO-GO, unchanged

**CLOSED (9):** B-01…B-04, B-04g, B-07, B-08, B-11, Gate D guard.
**B-05** BLOCKED — COUNSEL · **B-06** BLOCKED — OWNER + PRODUCTION · **B-09** OPEN (no drill) ·
**B-10** PARTIAL (`ALERT_WEBHOOK_URL` unset) · **B-12** BLOCKED — COUNSEL ·
**C-01/C-02** VERIFICATION REQUIRED — PRODUCTION.

**SAFE TO REVIEW:** all four. **SAFE TO MERGE (owner push; merge = deploy):** PR-0b, PR-0c.
**CONDITIONAL:** PR-2 (add the rollback caveat; merge PR-0b first). **NOT SAFE TO MERGE:** PR-1 until
the O5 consequence is accepted. **BLOCKED:** PR-3, PR-4a/4b, PR-5.

**Recommended merge order:** PR-0c → PR-0b → PR-2 → PR-1.

---

## 12. Actions required

**OWNER:** accept the PR-1 disabled-subscriber consequence (or open the O5 remedy first) · add the
asymmetric-rollback caveat to PR-2 · merge PR-0b at or before PR-2 · decide whether to land PR-0a or
soften PR-2's reference to it · authorize each push (merge = deploy) · decide whether to push these
branches to the remote (**not authorized in this session**).

**COUNSEL:** B-12 CROA/FCRA positioning · B-05 compliance bar (gates PR-3) · consent-evidence retention
· acceptance scope. **None of the four branches requires a counsel gate** — `lib/compliance.ts` is
byte-identical to `origin/main` on all four.

**PRODUCTION:** restore drill (B-09) · prove alert delivery (B-10) · `SETUP_SECRET` (C-01) · encryption
backfill (C-02) · measure the re-analysis 15s transaction · confirm the live `StripeWebhookEvent` table
has the `createdAt` column the stale-claim window queries · whether Vercel previews are
access-protected (`DATABASE_URL` is shared across Production and Preview).

---

## 13. Recommendation

**EXACT NEXT ACTION: review and merge PR-0c and PR-0b.** They are the lowest-risk units in the entire
programme — one self-contained added file, and documentation with a byte-unchanged bundle — and PR-0b
unblocks PR-2's documentation reference. Then take PR-2 with the rollback caveat added, then PR-1 once
the O5 consequence is accepted.

**Nothing was pushed. No GitHub PR was created. Pushing the release branches to the remote requires
explicit owner authorization that was not given in this session.**

---

*Repository truth is authoritative. **No merge, deployment, Gate D baseline, production migration, live
Stripe mutation, or production database contact occurred in this wave.***
