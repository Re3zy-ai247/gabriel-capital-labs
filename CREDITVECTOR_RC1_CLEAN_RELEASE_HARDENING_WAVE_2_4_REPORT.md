# CreditVector — RC1 Clean Release Hardening, Wave 2.4

**Date:** 2026-07-28 · **Base:** `origin/main` = `dfe7a3a` — **re-fetched and verified UNCHANGED**
**Status:** Draft — not ratified

> **Both release units were rebuilt from `origin/main`, adversarially attacked, corrected, and
> re-proven from scratch.** PR-1-v2 `ec7b467` · PR-2-v2 `f24778a`.
>
> **RC1 remains 🔴 NO-GO.** No blocker status changed. The disabled-subscriber item is **PARTIAL**,
> not closed — the remedy works, but a suspended user who has signed out cannot reach it.
>
> **No push · no GitHub PR · no merge · no deploy · no production SQL · no live Stripe mutation ·
> no production database contact · no migration apply · no Gate D baseline · no schema change.**

---

## 1. Context

CreditVector is a live Next.js 14 consumer-credit **education** SaaS with live Stripe billing.
Wave 2.3 produced four clean release branches; adversarial review of two of them surfaced two
release-level weaknesses. **Wave 2.4 closed both, then attacked the result and closed eight more
findings.**

**Merging to `main` auto-deploys production.** Merge and deploy are one event.

---

## 2. Current base — and whether it moved

`origin/main` = `dfe7a3ab06e966d87d4ed53fb518f10333bbb61e`, fetched at the start of the wave and
**re-fetched and re-verified after all corrective commits**. It did not move. Every branch below has
that exact commit as its merge-base, so nothing was built against a base that shifted underneath it.

---

## 3. Agents and ownership

| Agent | Owned | Outcome |
|---|---|---|
| 1 — disabled-subscriber cancellation | `lib/session.ts` helper, new `app/api/billing/` route, one page, new `scripts/*.test.ts` | Shape B implemented, 118 assertions |
| 2 — webhook reorder + rollback | `scripts/runtime/`, rollback runbook, `verify-production.sh`, `ci.yml` | Reorder guard 44/44, rollback drilled on real Postgres |
| 3 — clean reconstruction | both `release/*-v2` branches | Rebuilt from `origin/main`, content-neutral |
| 4 — adversarial | read-only + own scratch | **8 findings confirmed**, 25 mutations run |
| Coordinator (me) | base verification, adjudication, corrective commits, re-proof, reports | Closed all 8 |

**A second orchestration attempt failed at the harness level** and is reported rather than hidden:
every sub-agent tool call was rejected by the permission layer with its input stripped, including
`StructuredOutput`. The agents executed nothing, both worktrees were untouched, and the agent
**refused to fabricate results to satisfy the schema** — the correct behaviour. I performed the
corrective pass directly instead.

---

## 4. Disabled-subscriber design selected

**Shape B — direct server-side Stripe cancellation.** Not the hosted Billing Portal.

Owner policy item 7 forbids handing a disabled user an unrestricted portal. Whether the portal is
cancellation-only is **not provable from this repository**: there is exactly one
`billingPortal.sessions.create` call, it passes **no `configuration` parameter**, and no
`billingPortal.configurations` object exists anywhere in the tree. What a portal session permits —
update card, change plan, resume, buy — is Stripe Dashboard state that cannot be reviewed or
regression-tested here. Asserting a restriction we cannot demonstrate was rejected.

Shape B reuses the exact primitive `app/api/admin/billing/cancel/route.ts` already relies on:
`subscriptions.update(id, { cancel_at_period_end: true })`, subject pinned to the caller's own row.
**Consequence stated plainly and shown in the UI:** billing stops at the end of the already-paid
period, not instantly; one paid period may still elapse and no refund is issued. Immediate
cancellation stays an **admin** action.

**That premise is now locked by a guard.** `scripts/disabled-cancellation-scope.test.ts` re-derives
it every CI run — portal route is still the only `billingPortal` caller, no configurations object
exists, the create call still carries no `configuration`. If anyone adds one, the guard fails and
forces the portal-vs-server-side decision to be re-made deliberately rather than drifting.

---

## 5. Cancellation-only implementation

Three pieces, all in PR-1-v2:

1. **`lib/session.ts` → `sessionAccountState()`** — one new helper that does strictly *less* than the
   existing resolvers: resolves only by immutable session user id, reads **no cookies** (neither the
   agency workspace nor admin impersonation), grants nothing, reports state.
   **`currentAccount()` and `currentUser()` are byte-for-byte untouched.**
2. **`app/api/billing/self-cancel/route.ts`** — `POST` takes **no body and no query**, so the
   subscription id can only come from the caller's own row and cross-account cancellation has no
   parameter to travel through. Stripe is then asked to confirm the subscription belongs to this
   user's customer before any mutation. An **enabled** account is refused 403 and sent to the
   ordinary billing page — which is what makes the normal path provably unaffected. Fails closed for
   a disabled non-payer, idempotent on repeat, audited via `logAudit`, rate-limited by resolved user
   id, and Stripe error text is never echoed (it embeds live ids such as `No such subscription: sub_…`).
   It never writes to the `User` row: `disabled`, `plan` and `role` cannot be touched.
3. **`app/billing/cancel/page.tsx`** — standalone, no `AppShell`, no server gate, no layout above it,
   links nowhere into the app. A remedy nobody can navigate to is theoretical.

**⚠ The reachability ceiling — NOT closed, and the reason this item stays PARTIAL.** `lib/auth.ts`
refuses sign-in for a disabled account (`if (user.disabled) return null;`, before the password
compare) and sessions are stateless JWTs. The remedy therefore works **only while an already-issued
token is still valid**. A suspended user who has signed out cannot reach it. Closing that means
reopening a scoped sign-in surface in one of the repository's highest-risk files — it was
deliberately **not** smuggled into the release and remains an open owner decision.

---

## 6. Security and authorization proof

The adversary attacked the shipped path and **could not lever it into any other billing capability**
— 34/34 of its own independent assertions held, driving the real handlers over its own fakes:

- Attacker-supplied identity inert through every channel tried: bodies `{userId}`, `{id}`,
  `{subscriptionId}`, `{customer}`, `{account:{id}}`, `{immediate:true,subscriptionId}`, query
  `?userId=&subscriptionId=`, headers `x-user-id` / `x-forwarded-user`. **Zero** Stripe calls named a
  foreign subscription or customer; `subscriptions.cancel` was never reached, so an injected
  `immediate:true` cannot force an instant cancel.
- Disabled paying user → portal **401** with no session minted · billing status **404** · checkout
  `premium`/`agency`/`agency_pro` **404 with zero Stripe calls** · one-time letter-pack purchase
  **404**. Disabled non-payer → **404**, no Stripe call at all.
- Stale/mutable email could not redirect the subject: a session carrying the victim's id and a
  squatter's current address resolved to the **victim**, and every recorded lookup was keyed by id.
- Four consecutive POSTs, including one after flipping Stripe-side status to `canceled`, produced
  **exactly one** `subscriptions.update`.
- Enabled-account regression: portal still 200 against their own customer, checkout still creates a
  session, `agency_pro` still refused 400 rather than silently downgraded.

---

## 7. Reordered-event runtime scenario

`scripts/runtime/stripe-webhook-reorder.runtime.test.ts` — **44/44**, executing the real webhook
handler and real `lib/billing.ts` with the event payload and Stripe's *current* state set
independently.

The required sequence: local subscription **active** (written by the real handler, not seeded) →
`customer.subscription.deleted` with Stripe currently canceled → plan revoked to `free` → a
**delayed stale** `customer.subscription.updated` under a different event id whose snapshot still
says `active` → the guard first asserts the payload really does say active, so the scenario cannot
be vacuous → `retrieve` count is 1 and ordered **before** the write → Stripe's current state is
still canceled → plan stays `free`, and the plans-written projection is exactly `["free"]` → the
stale event demonstrably could not restore the plan → re-posting the same event id returns
`duplicate: true` with zero further retrieves or writes.

Plus the mirror case (a stale `deleted` after reactivation must not revoke a paying customer), a
three-delivery reordered burst, and a control proving the handler **can** still write a plan.

---

## 8. Negative-control proof

Every guard added or extended this wave was proven to fail on the mutation it exists to catch. Each
mutation was reverted and the file verified byte-identical afterwards.

| # | Branch | Mutation | Before | After |
|---|---|---|---|---|
| 1 | PR-2 | **text-preserving invoice defeat** — drop the legacy early return, compute the modern id and `void` it | invoice 52/0 | **42/10, exit 1** (source guard stays 84/0) |
| 2 | PR-2 | break only the expanded-object form of the modern shape | 52/0 | **47/5** (source guard stays green) |
| 3 | PR-2 | act on the event snapshot instead of re-retrieving | reorder 44/0 | **27/17, exit 1** |
| 4 | PR-2 | remove the `completed` idempotency short-circuit | reorder 44/0 | **39/5, exit 1** |
| 5 | PR-1 | append `export async function DELETE()` calling `subscriptions.resume` | scope 66/0 · runtime 72/0 | **64/2 · 70/2** |
| 6 | PR-1 | call `subscriptions.resume` inside the existing `POST` (writing around the surface pin) | 66/0 | **65/1** |
| 7 | PR-1 | `quotes.create` via a cast — **on no denylist anywhere** | 66/0 | **65/1** |
| 8 | PR-1 | leak the caller's own Stripe ids from the `GET` body | runtime 72/0 | **69/3** |
| 9 | PR-1 | revert the failure copy to the categorical claim | scope 66/0 | **64/2** |

**My own first version of the allowlist was wrong and the mutation testing caught it.** Anchoring to
`/stripe\./` is evaded in one line by `(stripe as unknown as X).subscriptions.resume(id)`, which
contains no literal `stripe.subscriptions` — mutation 6 initially passed the allowlist and was caught
only by the denylist. The check now matches on Stripe's **resource names** rather than on a receiver
called `stripe`, which is what makes mutation 7 — a method nobody enumerated — fail.

Earlier in the wave the adversary ran **25 mutations across both branches; 22 went red.** The three
survivors are findings 1, 2 and 3 in §11 and are all now closed.

---

## 9. PR-2 rollback procedure

`.ai/RUNBOOKS/stripe-webhook-rollback.md`. It opens by stating that rollback is **operationally
asymmetric and NOT a simple code revert**: rolling forward is a deploy; rolling back is a deploy
**plus a data step that must happen first**.

PR-2 writes `pending:<eventType>` into the existing `StripeWebhookEvent.type` column. Pre-PR-2 code
treats **any** existing row as already-processed, so reverting while pending rows remain silently
drops those events.

Ordered: **stop/drain** (disable the endpoint, record start, wait ≥ 15 min = `STALE_CLAIM_MINUTES`;
Stripe buffers and retries for 3 days, so draining is a pause not a loss) → **identify** pending rows
via **aggregates only** (the table holds only id/type/createdAt, but ids correlate to customers;
`SELECT *`, exporting ids into tickets, and pasting them into an AI prompt are all forbidden) →
**decide** what is genuinely abandoned → **delete** → **verify** before/after counts → **deploy** the
revert and confirm the `x-cv-release` SHA → **replay** via Stripe's own retry schedule → **verify no
active event was lost** → **monitor** for 24h and re-check daily for three days.

```sql
DELETE FROM "StripeWebhookEvent"
 WHERE "type" LIKE 'pending:%'
   AND "createdAt" < CURRENT_TIMESTAMP - INTERVAL '30 minutes';
```

**Age filter justified, not guessed:** 30 minutes is 2× the `STALE_CLAIM_MINUTES = 15` window the
code itself uses. A row older than 15 minutes is already re-claimable by the running code, so
deleting it removes nothing the system considers owned; the doubling is margin because the code
evaluates 15 minutes inside one atomic statement while the DELETE runs from a separate session
minutes after the count. Narrower can delete a claim a live invocation still holds; wider is slower,
not safer. The unscoped post-drain sweep is gated on the endpoint being disabled.

**Not executed.** Placeholders `<PROD_DB>`, `<ROLLBACK_SHA>`, `<ENDPOINT_ID>`, `<START_UTC>` only.

---

## 10. Disposable-database rollback test

Rehearsed on a **throwaway local PostgreSQL 16 cluster** (`initdb` into the scratchpad,
`listen_addresses=''` so it never bound a TCP port; cluster stopped and data directory deleted
afterwards). **No production connection string was used and no production database was contacted.**

Schema verified first: `StripeWebhookEvent` is **not** in `prisma/schema.prisma` — it is a
self-heal-owned legacy table, so the authoritative DDL is `ensureDedupTable()` in `lib/billing.ts`,
which confirms double-quoted PascalCase identifiers and that `createdAt` exists.

12 realistic rows seeded. **Failure mode reproduced first:** with a pending row left in place, the
pre-PR-2 statement `INSERT … ON CONFLICT ("id") DO NOTHING` returned **INSERT 0 0** — exactly the
signal old code reads as "already processed", so letter-pack credits are never granted. **Fix
demonstrated:** after cleanup the identical statement returned **INSERT 0 1**.

Counts total/pending/settled: **12/5/7 → 9/2/7** (filtered delete, `DELETE 3`) → **7/0/7** (post-drain
sweep). **Settled never moved: 7 → 7 → 7.** Both letter-pack key shapes survived.

The adversary independently reproduced this on its own cluster and additionally proved a **20-way
concurrent race** on one fresh event id: **1 winner, 19 losers, 0 errors** — which closes the
`ON CONFLICT` atomicity gap that was previously "unproven by anything in this repository." It could
not make the cleanup delete a row it should not.

---

## 11. Findings raised and closed this wave

| # | Sev | Branch | Finding | Status |
|---|---|---|---|---|
| 1 | **HIGH** | PR-2 | Dual-shape invoice resolver guarded **only by source text**; defeated while behaviour stayed broken. **Zero executed coverage** of either invoice branch. Under a basil-pinned endpoint, `past_due` is never written and **dunning silently stops** | ✅ **CLOSED** — `invoice-shape.runtime.test.ts`, 52 executed assertions, mutation now 42/10 |
| 2 | MED | PR-1 | Exported surface unpinned — an added `DELETE` calling `subscriptions.resume` left all 75 guards green | ✅ **CLOSED** — pinned at runtime and source |
| 3 | MED | PR-1 | `GET` body leak invariant documented but unenforced | ✅ **CLOSED** — asserted at runtime, plus key allowlist |
| 4 | MED | both | Neither PR description said **merging equals production deployment** | ✅ **CLOSED** — in both bodies below |
| 5 | MED | PR-1 | No rollback statement despite a **one-way data change** (`spendLetterCredits` decrements `User.letterCredits`; a code revert does not restore them) | ✅ **CLOSED** — in the PR body below |
| 6 | MED | both | `RC1-DISABLED-ACCOUNT-POLICY.md` asserted "nothing has been implemented" while the companion unit implements it — and unlike check 1.6 this does **not** self-resolve on merge | ✅ **CLOSED** — corrected in place |
| 7 | LOW | PR-2 | `.ai/TESTING.md` and `ci.yml` called `scripts/runtime/` "the only RUNTIME guards" — already false on `origin/main` | ✅ **CLOSED** — reworded |
| 8 | LOW | PR-1 | Failure copy promised "Nothing was charged and nothing was changed" even when the mutation had applied | ✅ **CLOSED** — branches on whether Stripe was reached |

**Coordinator adjudication on finding 6.** The document **stays in PR-2**. Moving it would make PR-2
reference a file it does not ship — the unpublished-document dependency owner item 10 forbids. It is
corrected in place instead: §5 now records what was decided and why the portal half was unreachable,
while §1's verified behaviour and §3's options analysis are untouched, so this is the record of a
decision rather than a rewrite of the evidence it was made from. Both the reachability ceiling and
**B-12 BLOCKED — COUNSEL** are recorded as explicitly *not* closed.

---

## 12. PR-0a dependency removal

**Fully removed.** All references to the unpublished `CREDITVECTOR_RC1_CRITERIA.md` are gone from
`scripts/verify-production.sh` (three, plus three bare finding labels a reader without the document
cannot resolve, rewritten into the concrete consequence they stood for), and — one the first sweep
missed and I caught — from `RC1-DISABLED-ACCOUNT-POLICY.md`'s closing *Related* line.

Grepping every file in the PR-2-v2 diff for `CREDITVECTOR_RC1_CRITERIA` or `RC1-RELEASE-SEQUENCE`
now returns **nothing**. The PR-0b pointer to `.ai/RUNBOOKS/alert-activation.md` was also softened to
the same meaning without the external file. `ci.yml`'s reference to `CREDITVECTOR_RC1_EXECUTION.md`
is **not** a dependency — that file exists on `origin/main`.

**No referenced document was created.** PR-2 can merge alone.

---

## 13. PR-1-v2 — clean branch

**Branch** `release/pr1-critical-fixes-v2` · **base** `dfe7a3a` · **head** `ec7b467` · **6 commits** ·
**19 files**

**Extracted commits** (newly minted objects): `b924b5a` · `653c357` · `d5f7b37` · `dbbc472` ·
`4058cae` · `ec7b467`

**Source provenance** (pre-existing, never interchangeable with the above): mixed-branch
`a2fa6ea` · `6bc4cf4` · `bd8f108` → Wave 2.3 extracts `b1f214e` · `f1bf7fa` · `103f84e`; Agent 1
`4f9bebe` · `e16c41d`. `cherry-pick -x` stacked both trailers, so the chain is machine-readable in
the commit bodies.

**Files:** `lib/entitlements.ts` · `lib/session.ts` · `lib/admin.ts` · `lib/analyze.ts` ·
`app/api/billing/self-cancel/route.ts` *(new)* · `app/billing/cancel/page.tsx` *(new)* ·
`app/api/billing/status` · `app/api/stripe/{checkout,portal}` · `app/api/demo/seed` ·
`app/api/letters/generate` · `app/api/letters/[id]/round2` · `app/{agency,billing}/page.tsx` ·
5 guards *(new)*.

**User-visible:** a suspended paying subscriber can reach `/billing/cancel` and stop being billed ·
free-letter meter no longer resets when letters are deleted · Round 2 consumes entitlement · a
subscriber who changed their email can reach billing again · disabled admins lose admin surfaces.

**Internal:** usage derives from the append-only `ProductEvent` ledger · balances cannot go negative ·
unknown plan fails closed · billing identity resolves by **immutable user id** · re-analysis
preserves letter↔tradeline links · demo credentials not exposed in production.

**Runtime evidence:** `disabled-cancellation-runtime.test.ts` **72/72**, executing the real
`self-cancel` and `portal` handlers over the real `lib/session.ts`.
**Source-level evidence:** `disabled-cancellation-scope.test.ts` **66/66**, `billing-identity` 39,
`billing-integrity` 31, `critical-paths` 33 — labelled as source-level and **not** to be quoted as
runtime proof.
**Negative controls:** rows 5–9 of §8.

**Migration dependency:** **NONE.** `prisma/schema.prisma` byte-identical to `origin/main`; 0
`prisma/` paths in the diff.

---

## 14. PR-2-v2 — clean branch

**Branch** `release/pr2-stripe-lifecycle-v2` · **base** `dfe7a3a` · **head** `f24778a` ·
**8 commits** · **17 files**

**Extracted commits:** `4ea4c16` · `e698814` · `0896d07` · `fe4c524` · `62dfd52` · `cfa2986` ·
`17f9e62` · `f24778a`

**Source provenance:** mixed-branch `c3c4954` · `59fad4f` → Wave 2.3 extracts `e6e481b` · `4eda8d4` ·
`475e180`; Agent 2 `81dac13` · `2e014c6` · `07099ca`. `475e180` carries **no** cherry-pick trailer
because it was authored by **path extraction**, not cherry-pick — upstream `4871d4e`/`beeafd1` could
not be taken whole without dragging in terms-release content. Its provenance is in its own commit body.

**Files:** `app/api/stripe/webhook/route.ts` · `lib/billing.ts` · `lib/stripe.ts` ·
`scripts/runtime/` (7 files, 4 guards) · `scripts/stripe-lifecycle.test.ts` ·
`scripts/verify-production.sh` · `.ai/RUNBOOKS/stripe-webhook-rollback.md` · `.ai/TESTING.md` ·
`.github/workflows/ci.yml` · `RC1-DISABLED-ACCOUNT-POLICY.md`.

**User-visible:** a paying customer is not silently downgraded by a late webhook · a cancelled
customer cannot have their plan restored by a stale one · dunning actually fires under either Stripe
API version.

**Internal:** three-state claim (`claimed` / `in_flight` / `completed`) with 409 on in-flight so
Stripe retries · abandoned claims age out · subscription events re-retrieve current state · unknown
price writes **no `plan` key at all**.

**Runtime evidence:** `run-all.ts` **4/4** — `invoice-shape` 52, `stripe-webhook-reorder` 44,
`stripe-webhook-claim` 36, `unknown-price-failclosed` 29 — all executing real handlers.
**Source-level evidence:** `stripe-lifecycle.test.ts` **84/84**, explicitly labelled source-text in
`.ai/TESTING.md`.
**Negative controls:** rows 1–4 of §8.

**Migration dependency:** **NONE.** The claim reuses the existing `type` column; `prisma/` diff
empty; `schema-safety` 17/17 unmodified. Notable because `StripeWebhookEvent` is a self-heal-owned
legacy table — this money-path work correctly introduces no schema of its own.

---

## 15. Ancestry and forbidden-path proof

| Property | PR-1-v2 | PR-2-v2 |
|---|---|---|
| `merge-base(origin/main, HEAD)` | `dfe7a3a` — i.e. `origin/main` itself | `dfe7a3a` |
| `is-ancestor origin/main HEAD` | TRUE | TRUE |
| Commits above base | 6 (= intended picks) | 8 (= intended picks) |
| Founder Library commits in ancestry | **0** | **0** |
| Forbidden paths in **diff** | **0** | **0** |
| `prisma/` paths in diff | **0** | **0** |
| Symlinks added | **0** | **0** |
| Working tree | clean | clean |

`architecture/GIOS-*` present in the *tree* is a **known false positive** — those files already exist
on `origin/main`. Only diff presence is meaningful, and it is 0 on both.

**File overlap between the two diffs: 0** (`comm -12` over both sorted diff file lists).
**Isolation, measured by byte:** PR-1-v2 leaves `app/api/stripe/webhook/route.ts`, `lib/billing.ts`,
`.ai/TESTING.md` and `ci.yml` **byte-identical to `origin/main`**; PR-2-v2 leaves `lib/session.ts`,
`lib/entitlements.ts`, `app/api/stripe/portal/route.ts` and all of `app/api/billing/`
**byte-identical**. Both diffs measured 0 bytes on those paths.

---

## 16. Isolated dependency and Prisma generation proof

Each branch was proven in its **own** worktree after `rm -rf node_modules .next`, with its **own**
`npm ci` and its **own** `npx prisma generate`. `node_modules` verified a **real directory, not a
symlink**, with **distinct inodes** (`2442918` vs `2515406`). No worktree reused another's
dependencies, generated Prisma client, or build output — owner decision **O6**.

**`prisma validate` — resolved, not excused.** It PASSES on both branches when given
`DATABASE_URL='postgresql://throwaway:throwaway@127.0.0.1:5432/throwaway_validate?schema=public'` — a
loopback placeholder that is never dialled (validate is a static schema check) and does not resemble
any production value. Without it, both fail identically, **as does the bare `origin/main` control**,
and `prisma/schema.prisma` is byte-identical to `origin/main` on both — so the bare failure is
provably a property of the missing env var, not of either branch.

---

## 17. Typecheck / build / guard results

| | PR-1-v2 | PR-2-v2 | **Merged tree** |
|---|---|---|---|
| `npm ci` | PASS | PASS | PASS |
| `prisma generate` | PASS | PASS | PASS |
| `prisma validate` | PASS | PASS | PASS |
| `tsc --noEmit` | **PASS** | **PASS** | **PASS** |
| `scripts/*.test.ts` | **75 / 0** | **71 / 0** | **76 / 0** |
| `scripts/runtime/run-all.ts` | n/a by design | **4 / 0** | **4 / 0** |
| `next build` | **PASS** | **PASS** | **PASS** |
| working tree | clean | clean | clean |

**Guard arithmetic reconciles:** `origin/main` carries 70 top-level guards. PR-1-v2 = 70 + 5 = **75**.
PR-2-v2 = 70 + 1 = **71** (its other four live under `scripts/runtime/`). Merged = 70 + 5 + 1 = **76**.

**Merged-tree validation** — neither branch alone is the release. The two merge with **no conflict**;
the merged tree passes everything above, `/api/billing/self-cancel` and `/billing/cancel` are both
emitted, the policy-document contradiction is **gone**, and `verify-production.sh` flips from
**21 pass / 1 fail** to **22 pass / 0 fail** — the check-1.6 coupling resolves exactly as predicted.

---

## 18. Runtime versus source-level evidence

**RUNTIME** (executes real handlers): PR-2's four `scripts/runtime/` guards (161 assertions) and
PR-1's `disabled-cancellation-runtime.test.ts` (72). PR-1's runtime guard is **self-contained** —
its own fakes, directly under `scripts/`, so the existing non-recursive CI glob runs it with no CI
change and **no dependency on PR-2's harness**. That is what keeps the two units disjoint.

**SOURCE-LEVEL**: everything else, including `stripe-lifecycle.test.ts` (84) and
`disabled-cancellation-scope.test.ts` (66). Both are labelled as such and **must not be quoted as
runtime proof**. The adversary confirmed no source guard is mislabelled anywhere.

**The lesson this wave paid for:** a source-text assertion cannot survive an adversary who preserves
the text. That is precisely how finding 1 defeated the invoice guard, and it is why the fix is an
executed assertion on the resulting write rather than a better regex.

---

## 19. Rollback constraints

- **PR-2 rollback is asymmetric.** Reverting leaves `pending:%` rows the restored code reads as
  already-processed. Requires the §9 data step **first**, and its safety depends on an operator
  actually disabling the endpoint and waiting 15 minutes — **procedural, not enforced by code**.
- **PR-1 makes a one-way data change.** `spendLetterCredits()` decrements `User.letterCredits`. A
  code revert does **not** restore credits already spent, and the meter silently returns to the
  delete-to-reset behaviour the PR exists to fix.
- **Merging is deploying.** Rollback in both cases is a production deploy, not a git operation.

---

## 20. Residual risks

1. **Fake-backed, not integration.** `FakePrisma` is not Postgres — no transactions, no isolation, no
   row locking, no real `CURRENT_TIMESTAMP`. Both units should be exercised in a Stripe **test-mode**
   environment before release. *(Partially mitigated: the `ON CONFLICT` claim was proven atomic under
   a 20-way race on real Postgres 16.)*
2. **The reachability ceiling** (§5) — a signed-out suspended user cannot reach the remedy.
3. **The rollback runbook** was rehearsed on 12 synthetic rows, never at production volume, never
   through Accelerate's proxy, never under live webhook traffic.
4. **Stripe replication lag** — the guards prove the handler writes *current* Stripe state; they
   cannot prove Stripe's own `retrieve` is current. That window is Stripe's to close.
5. **`.ai/INDEX.md` has no route to the new rollback runbook** — deliberately not added, because
   `.ai/INDEX.md` belongs to PR-0b and editing it would break the proven file-disjointness. Worth
   adding when the release is assembled.
6. **PR-1's guards are not registered in `.ai/TESTING.md`** — same reason. A deliberate post-merge
   follow-up, not an oversight.
7. **PR-2-v2 standalone still reports one `verify-production.sh` FAIL** (check 1.6, asserting PR-1's
   portal identity change). Deliberately left as a real failure rather than softened; not a CI step;
   resolves on merge.

---

## 21. Updated RC1 status — 🔴 NO-GO, unchanged

**CLOSED (9):** B-01…B-04, B-04g, B-07, B-08, B-11, Gate D guard.
**B-05** BLOCKED — COUNSEL · **B-06** BLOCKED — OWNER + PRODUCTION · **B-09** OPEN (no drill) ·
**B-10** PARTIAL · **B-12** BLOCKED — COUNSEL · **C-01/C-02** VERIFICATION REQUIRED — PRODUCTION.

**Disabled-subscriber item: ⚠ PARTIAL — NOT closed.** The RC1 rules permit closing it only if *no
unresolved owner decision remains*. The reachability ceiling is exactly such a decision, so it stays
open. What *is* closed: the technical policy is implemented, runtime verification passes, and access
is proven cancellation-only.

**Nothing here changes the overall verdict.** Two units improving does not make a release.

---

## 22. Safe to review · safe to merge

| Unit | Review | Merge |
|---|---|---|
| **PR-1-v2** | ✅ **SAFE TO REVIEW** | ⚠ **CONDITIONAL** — owner must accept the period-end cancellation semantics, the one-way `letterCredits` decrement, and the reachability ceiling as a known open item |
| **PR-2-v2** | ✅ **SAFE TO REVIEW** | ⚠ **CONDITIONAL** — owner must accept the asymmetric rollback and have the runbook to hand before merging |

**Recommended merge order: PR-1-v2 → PR-2-v2**, so `verify-production.sh` is never transiently red.
Both orders are textually conflict-free and the merged result is green either way.

---

## 23. PR packages — copy-and-paste ready

> Both: **base `main`** · **merging auto-deploys production (~2 min)** · owner confirmation required
> per `CLAUDE.md` · nothing pushed, no GitHub PR created.

### PR-1-v2
**Title:** `fix(billing,security): close the free-letter bypass, resolve billing identity by user id, and give suspended paying subscribers a cancellation-only path`

**Body:**
```
⚠️ MERGING THIS PR DEPLOYS IT TO PRODUCTION. Push to main triggers a Vercel production deploy
(~2 min). This PR changes the live money path — entitlement metering, billing identity resolution,
and admin authorization. Approving it is releasing it.

PROVENANCE: a2fa6ea, 6bc4cf4, bd8f108 (mixed-branch) via Wave 2.3 extracts b1f214e, f1bf7fa,
103f84e, plus 4f9bebe and e16c41d. This branch's commits are new objects; cherry-pick -x stacked
both trailers so the chain is machine-readable in the commit bodies.

WHAT IT DOES
- Free-letter paywall: usage derives from the append-only ProductEvent ledger, so deleting letters
  no longer resets the meter. Round 2 consumes entitlement; credits cannot go negative.
- Billing identity: three routes resolved the account by mutable session email. A subscriber who
  changed their email could not reach the portal to cancel, and a re-registered address could
  resolve a stale JWT to a stranger's billing. Now resolves by immutable user id.
- Security: requireAdmin() honours `disabled`; /api/demo/seed 404s in production and returns no
  password; report re-analysis re-links dispute letters instead of orphaning them.
- NEW — a cancellation-only path for a SUSPENDED paying subscriber. currentAccount() fails closed on
  `disabled`, which is correct, but it made a suspended user indistinguishable from a signed-out one
  everywhere including /api/stripe/portal — so someone we disabled while they held a live paid
  subscription kept being billed with no self-service way to stop it.

WHY NOT THE STRIPE BILLING PORTAL. The repository contains exactly one billingPortal.sessions.create
call, it passes no `configuration`, and no billingPortal.configurations object exists anywhere. What
a portal session permits (update card, change plan, resume, buy) is Stripe Dashboard state that
cannot be proven, reviewed or regression-tested from this repository, so it must not be assumed
cancellation-only for a suspended account. This uses the same server-side primitive
app/api/admin/billing/cancel/route.ts already relies on, with the subject pinned to the caller's own
row. A guard now re-derives that premise every CI run, so adding a portal configuration later forces
the decision to be re-made deliberately rather than drifting.

CANCELLATION SEMANTICS: cancel_at_period_end (matching the admin route's default). Billing stops at
the END of the already-paid period, not instantly. One paid period may still elapse and no refund is
issued. Immediate cancellation remains an ADMIN action.

SECURITY SHAPE: POST takes no body and no query, so a subscription id has no parameter to travel
through; Stripe is asked to confirm the subscription belongs to this user's customer before any
mutation; an ENABLED account is refused 403 and sent to the ordinary billing page, which is what
keeps the normal path provably unchanged; a disabled non-payer fails closed; repeat calls are
idempotent; the action is audited and rate-limited by resolved user id; Stripe error text is never
echoed because it embeds live identifiers. The route never writes to the User row — `disabled`,
`plan` and `role` cannot be touched, and no application access is restored.

⚠️ ROLLBACK IS NOT SYMMETRIC. spendLetterCredits() decrements User.letterCredits on every metered
letter. Reverting this PR does NOT restore credits already spent, and the meter silently returns to
the delete-to-reset behaviour this PR exists to fix. There is no data step that undoes it. Treat a
revert as a forward decision, not a restore.

⚠️ KNOWN OPEN ITEM, deliberately not fixed here. lib/auth.ts refuses sign-in for a disabled account
and sessions are stateless JWTs, so this path works only while an already-issued token is still
valid. A suspended user who has signed out cannot reach it. Closing that means reopening a scoped
sign-in surface in one of the repository's highest-risk files; it was not smuggled into this PR and
remains an owner decision. RC1 keeps the disabled-subscriber item PARTIAL, not closed.

NO schema or migration dependency — prisma/schema.prisma is byte-identical to main, 0 prisma/ paths
in the diff. app/api/stripe/webhook/route.ts and lib/billing.ts are byte-identical to main, so this
PR contains no webhook-lifecycle behaviour. No compliance change.

VERIFIED on this branch after rm -rf node_modules .next, its own npm ci and its own prisma generate:
tsc PASS, next build PASS (both new surfaces emitted), 75/75 guards. RUNTIME evidence:
disabled-cancellation-runtime.test.ts 72/72 executes the real self-cancel and portal handlers.
SOURCE-LEVEL: disabled-cancellation-scope.test.ts 66/66 — do not quote it as runtime proof.

NON-VACUITY: an appended DELETE calling subscriptions.resume → 64/2 and 70/2; resume inside the
existing POST → 65/1; quotes.create via a cast, on no denylist → 65/1; Stripe ids leaked from the
GET body → 69/3; the old categorical failure copy → 64/2.

VERIFICATION REQUIRED — PRODUCTION: re-analysis runs in one 15s interactive transaction; large
reports must be measured against that ceiling. The existing population of disabled accounts holding
a live subscription must still be reconciled by hand.

MERGE ORDER: merge this before PR-2-v2 so verify-production.sh check 1.6 is never transiently red.
```

### PR-2-v2
**Title:** `fix(stripe): make subscription webhooks idempotent, ordering-safe and claim-window-free, with executed coverage of both invoice payload shapes`

**Body:**
```
⚠️ MERGING THIS PR DEPLOYS IT TO PRODUCTION. Push to main triggers a Vercel production deploy
(~2 min) and changes LIVE Stripe webhook handling — the single writer of entitlements. Approving it
is releasing it.

PROVENANCE: c3c4954, 59fad4f (mixed-branch) via Wave 2.3 extracts e6e481b, 4eda8d4, 475e180, plus
81dac13, 2e014c6, 07099ca. 475e180 carries no cherry-pick trailer because it was authored by PATH
EXTRACTION rather than cherry-pick — the upstream commits could not be taken whole without dragging
in terms-release content. Its provenance is documented in its own commit body.

WHAT IT DOES
- Three-state claim (claimed / in_flight / completed): a duplicate is refused forever, while an
  abandoned claim ages out so Stripe's retry can actually run. An in-flight event gets 409, not 200,
  so Stripe keeps retrying instead of being told to stop.
- Subscription events re-retrieve current state, so a delayed event cannot restore a revoked plan or
  revoke a paying customer.
- An unrecognised price fails CLOSED — no plan key is written at all.
- Both Stripe invoice payload shapes are now EXECUTED, not asserted by text (see below).

MIGRATION-FIRST COMPLIANT: the claim reuses the EXISTING `type` column as pending:<eventType>. No new
column, no new table, no migration. prisma/ diff is empty; schema-safety passes 17/17 unmodified.
Notable because StripeWebhookEvent is a self-heal-owned legacy table absent from schema.prisma — this
money-path work correctly introduces no schema of its own.

WHY THE INVOICE GUARD CHANGED. An adversarial review defeated the source-text guard on
invoiceSubscriptionId while leaving the behaviour broken: keeping the string the regex greps for and
discarding the value it computes makes the handler completely blind to the modern
invoice.parent.subscription_details.subscription shape, and tsc, all 71 top-level guards and all 3
runtime guards stayed green. Which shape arrives depends on the API version pinned on the WEBHOOK
ENDPOINT, not on what the SDK sends — so under a 2025-03-31.basil endpoint that means
invoice.payment_failed never resolves a subscription, past_due is never written, and DUNNING SILENTLY
STOPS. Neither invoice branch had any executed coverage anywhere in the repository.
invoice-shape.runtime.test.ts now drives the real handler across both events and all four payload
forms and asserts on the write that reaches the DB.

RUNTIME GUARDS IN CI: scripts/runtime/ executes the real route handlers. It has its own CI step
because scripts/*.test.ts is a non-recursive glob that never reached it, and run-all.ts enforces an
explicit REQUIRED list so a deleted guard cannot masquerade as one that never existed.
scripts/stripe-lifecycle.test.ts is SOURCE-LEVEL and must not be quoted as runtime proof.

⚠️ ASYMMETRIC ROLLBACK — READ .ai/RUNBOOKS/stripe-webhook-rollback.md BEFORE REVERTING. Rolling
forward is a deploy; rolling back is a deploy PLUS a data step that must happen FIRST. This PR writes
pending:<eventType> rows into StripeWebhookEvent, and pre-PR code treats any existing row as already
processed — so reverting with pending rows present silently DROPS those webhooks. Reproduced on a
throwaway Postgres 16 cluster: the old claim statement returned INSERT 0 0 (credits never granted)
with a pending row present, and INSERT 0 1 after cleanup. Remediation is a production DELETE of rows
WHERE type LIKE 'pending:%' AND createdAt < now() - 30 minutes, after disabling the Stripe endpoint
and waiting 15 minutes. That safety depends on the operator actually doing so — it is procedural, not
enforced by code. NO PRODUCTION SQL HAS BEEN EXECUTED.

VERIFIED on this branch after rm -rf node_modules .next, its own npm ci and its own prisma generate:
tsc PASS, next build PASS, 71/71 source guards, 4/4 runtime guards (invoice-shape 52,
stripe-webhook-reorder 44, stripe-webhook-claim 36, unknown-price-failclosed 29).

NON-VACUITY: the text-preserving invoice defeat → 42/10 exit 1 while the source guard stays 84/84;
breaking only the expanded-object form → 47/5; acting on the event snapshot instead of re-retrieving
→ 27/17; removing the idempotency short-circuit → 39/5.

SELF-CONTAINED: no reference to any unpublished document. lib/session.ts, lib/entitlements.ts,
app/api/stripe/portal/route.ts and all of app/api/billing/ are byte-identical to main, so this PR
contains no PR-1 product behaviour.

KNOWN: run standalone, scripts/verify-production.sh reports one FAIL (check 1.6) because it asserts
the portal identity change that ships in PR-1-v2. It is annotated in place rather than softened —
turning a real security assertion into "verification required" would weaken it — and it is not a CI
step. It resolves once both land.

MERGE ORDER: merge PR-1-v2 first.
```

---

## 24. Owner actions

- Accept PR-1's **period-end** cancellation semantics (one already-paid period may elapse, no refund).
- Accept the **one-way `letterCredits` decrement** — reverting PR-1 does not restore spent credits.
- Accept the **reachability ceiling**, or commission the scoped sign-in work as a separate unit.
  Option B from the policy document — a **published** contact channel and SLA — costs no code and
  covers the signed-out case today.
- Have the rollback runbook to hand **before** merging PR-2, not after.
- Merge **PR-1-v2 → PR-2-v2**. Authorize each push individually: **merge = deploy**.
- Decide whether to push these branches to the remote — **not authorized in this session**.

## 25. Counsel actions

**B-12 CROA/FCRA positioning** · **B-05 compliance bar** · consent-evidence retention · and the
specific question this wave surfaced but did **not** answer: whether a self-service cancellation path
is *required*, and what a defensible alternative channel looks like for a suspended customer.
**Neither branch requires a counsel gate to review** — `lib/compliance.ts` is byte-identical to
`origin/main` on both.

## 26. Production actions

Restore drill (B-09) · prove alert delivery (B-10) · `SETUP_SECRET` (C-01) · encryption backfill
(C-02) · measure the re-analysis 15s transaction · **reconcile the existing population of disabled
accounts holding a live subscription** · confirm which Stripe API version the live webhook endpoint
is pinned to · exercise both units in Stripe **test mode** before release.

---

## 27. Exact next action

**Review PR-1-v2, then PR-2-v2, in that order.** Both are structurally sound, mutually disjoint, and
individually proven under CI-equivalent isolation; what remains before either can merge is owner
acceptance of the named consequences in §24 — not more engineering.

---

## 28. Artifacts

| Path | Note |
|---|---|
| `CREDITVECTOR_RC1_CLEAN_RELEASE_HARDENING_WAVE_2_4_REPORT.md` | canonical |
| `CREDITVECTOR_RC1_CLEAN_RELEASE_HARDENING_WAVE_2_4_REPORT.html` | matched mobile projection |
| `CREDITVECTOR_RC1_CRITERIA.md` | v1.6 — Wave 2.4 status block |
| `release/pr1-critical-fixes-v2` @ `ec7b467` | local only |
| `release/pr2-stripe-lifecycle-v2` @ `f24778a` | local only |

**Repository truth is authoritative; production truth is not visible from here.** Every PASS above is
a repository fact measured in an isolated worktree. Nothing in this report is evidence about the
running production system.

---

## 29. Prohibitions — explicit confirmation

**No push** (`git ls-remote --heads origin` returns **0** matching `release/*`, `wip/*` and `tmp/*`) ·
**no GitHub PR created** · **no merge to `main`** · **no deploy** · **no production SQL executed** ·
**no live Stripe mutation** · **no production database contact** · **no migration applied** · **no
Gate D baseline** · **no schema change** (`prisma/schema.prisma` byte-identical to `origin/main` on
both branches) · **no secret values printed** · **no reviewed history rewritten** — the Wave 2.3
branches are untouched and both v2 branches are new · **no other-workstream content** in either diff.

The throwaway Postgres cluster used for the rollback drill never bound a TCP port and its data
directory was deleted. The merged-tree validation worktree was removed.
