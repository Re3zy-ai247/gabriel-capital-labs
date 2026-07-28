# CreditVector — RC1 Release Integration, Wave 2.1

**Date:** 2026-07-28 · **Branch:** `claude/creditvector-founder-library-jwnbhc`
**Commit range:** `c7d1506` → HEAD (5 commits) · **Status:** Draft — not ratified

> **Verdict: 🔴 NO-GO for Version 1.0. The branch is still not a release unit — but it is now
> reviewable, release-sequenced, and for the first time actually verified.**
>
> **The environment blocker that qualified every prior result is gone.** `npm ci`, `prisma generate`,
> `tsc --noEmit`, `next build` and **79/79 guards** all pass. Waves 1–2 could run none of them.

---

## 1. Context for a reader with no repository access

**CreditVector** is a live Next.js 14 consumer-credit **education** SaaS (creditvector.app) with live
Stripe billing, built by Gabriel Capital Labs. It is deliberately *not* a credit-repair service.

**RC1** is the Version 1.0 release program. An audit of 26 subsystems produced NO-GO with 12
launch-blocking defects. **Wave 1** closed 7. **Wave 2** added durable terms acceptance, hardened the
compliance bar, and wrote recovery runbooks — but shipped a server contract with **no UI**, so every
in-place upgrade would have been refused with HTTP 428 once deployed.

**Wave 2.1** is release integration: validate the Wave 2 delta, build the missing UI, verify at
runtime, and produce an exact release sequence. **Not another audit.**

Repository truth is authoritative. Code cannot prove production configuration, completed drills,
measured RPO/RTO, live alert delivery, live Stripe catalog contents, or legal approval.

---

## 2. Starting and ending state

| | |
|---|---|
| Branch | `claude/creditvector-founder-library-jwnbhc` (unchanged) |
| Starting commit | `c7d1506` (Wave 2 end) |
| Ending commit | this commit (the 5th below). A document cannot cite its own hash, so the range is stated as `c7d1506..HEAD` |
| Working tree | clean |
| Merged / deployed / migration applied | **None. No push to `main`, no deploy, no production migration.** |

---

## 3. Agents and file ownership

One coordinator + four bounded agents, strictly disjoint.

| Agent | Owned |
|---|---|
| 1 — Wave 2 code & migration review | `prisma/schema.prisma`, the migration SQL, `lib/terms.ts`, `lib/billing.ts`, `app/api/stripe/{checkout,webhook}/route.ts` |
| 2 — Terms UX & paid paths | `components/TermsAccept.tsx` (new), `app/pricing/PricingTiers.tsx`, `app/billing/page.tsx`, `app/agency/page.tsx`, `app/letters/page.tsx`, `scripts/terms-acceptance.test.ts`, paid-path inventory |
| 3 — Toolchain & runtime | `scripts/runtime/**` (new). **Read-only on product code** |
| 4 — Release sequencing | `RC1-RELEASE-SEQUENCE.md`, `.ai/RUNBOOKS/migration-apply-terms-acceptance.md`. Read-only on code |
| Coordinator | dependency graph, `scripts/gate-d-preflight*`, commits, RC1 update, reports |

**Ownership violations: none.** No agent touched `knowledge/`, `architecture/GIOS-*`, or Founder
Library governance.

---

## 4. Delta reviewed

`git diff 27bc430..c7d1506` — 21 files, +3549/−183. Reviewed: the `TermsAcceptance` model and its
migration, the 428 gate ordering in the checkout route, the three-state webhook claim in
`lib/billing.ts`, the compliance carve-outs, and `scripts/verify-production.sh` safety. **No re-audit
of the 26 domains.**

---

## 5. Defects confirmed and corrected

### D-1 · `TermsAcceptance` erased consent by FK cascade — **FIXED** (`717697f`)
The Wave 2 migration shipped `ON DELETE CASCADE`, justified by a comment reasoning that erased
accounts should take their evidence with them. **That is a retention determination, and repository law
reserves it elsewhere:** `.ai/IDENTITY-CONSTITUTION.md` §12.3 — erasure "is never a foreign-key cascade
and never an incidental consequence of deleting another principal"; §16 item 6 — "erasure and retention
are policy-driven commands, not cascades"; §18 names FK cascade as the forbidden mechanism; §12.4
reserves durations to a counsel-ratified schedule that does not yet exist.

`RESTRICT` is the **decision-deferring** choice — it fixes no retention period, it only refuses to let a
foreign key execute an erasure nobody authorised. In-repo precedent agrees (`XpAward`,
`ReputationMilestone`, `Organization.owner`).

**Verified at runtime against a real Postgres 16.13:** with Cascade, deleting a User succeeded and left
**zero** acceptance rows — the evidence was destroyed by the constraint. After the fix the delete is
refused and the row survives; `confdeltype` reads `'r'`. Schema and migration kept in lockstep
(`migrate diff --exit-code` = 0). Changes no current behaviour — no application path hard-deletes a
User today — so this removed a latent erasure while the migration is still unapplied and the fix is free.

### D-2 · Gate D preflight guard **crashed** in CI — **FIXED** (`a2b0a04`)
Wave 2 added a migration directory without registering it in `GATE_D_MIGRATION_CHAIN`.
`loadGateDManifest` diffs the on-disk set against that manifest and **throws** on mismatch — so the
guard did not fail, it **crashed before printing anything**, on a job CI actually runs. The Wave 2
branch would have gone red on a stack trace with no usable message.

Three corrections: register the migration; raise the coverage tripwires to the **computed** totals
(7 migrations · 35 tables · 309 columns · 35 PKs · 64 indexes · 22 FKs — deltas of exactly +1/+5/+1/+2/+1,
precisely what the migration adds and nothing else, which is itself evidence it does only what it
claims); and fix test 18, which pinned the reputation migration by name because it *happened* to be the
chain's tail. It no longer is, so removing it produced a mid-chain **gap** — a different state with a
different decision — and the test failed for the right reason. It now derives the tail. **105/105.**

### D-3 · Over-claiming comment on the acceptance gate — **FIXED** (`717697f`)
The gate's comment said "Stripe is never touched" at the 428. Not accurate: the customer
lookup/creation and read-only price and subscription lookups run before it. **None bills anyone**, so
the substantive property holds — but the sentence would have let a future reviewer over-claim.

### D-4 · Missing acceptance UI — **BUILT** (`2911d44`)
See §6.

---

## 6. Terms UX implementation

`components/TermsAccept.tsx`, shared by the three callers that can actually reach the upgrade branch —
classified **by the request each one sends**, not assumed: `app/pricing/PricingTiers.tsx`,
`app/agency/page.tsx`, `app/billing/page.tsx`. (`app/letters/page.tsx` is the letter pack — a different
mechanism, correctly left alone.)

- checkbox is component-local state seeded **false on every mount** — no prop, no persistence, no
  `defaultChecked`, so it **cannot** be pre-checked; confirm refused until acceptance is explicit
- links the **currently published** `/legal/terms` and states no terms of its own — **no new legal or
  marketing wording anywhere**
- **the version stays server-owned end to end.** No client file contains or can construct a version: the
  component reads `termsVersion` off the server's own 428 body, echoes exactly that string back, and the
  route re-validates it against its published constant. A forged version is refused.
- accessible: real `<label>` association, keyboard operable, visible focus, `aria-describedby` on the
  error, blocked state **announced**, not colour-only
- other form input survives a recoverable error; the 428 renders human-readable recovery guidance
- **the UI is not the enforcement layer** — the API still fails closed if bypassed

---

## 7. Paid-path inventory — three paths, three different consent stories

| Path | Mechanism | Consent today | Durable local record | Bypass risk |
|---|---|---|---|---|
| **In-place upgrade** | `subscriptions.update` | **Hard 428 gate** | ✅ `TermsAcceptance` | None once migration applied |
| **New subscription** | Checkout Session | Stripe `consent_collection` | ❌ analytics pointer only | **Inert unless `STRIPE_TOS_CONSENT=1` AND a Dashboard Terms URL** |
| **Letter pack ($19)** | Checkout Session | Stripe `consent_collection` | ❌ none | Same conditional |
| **Stripe Billing Portal** | Portal plan change | — | ❌ none | **Structurally bypasses the gate** — Dashboard setting, not code |

**Technical recommendation (not a legal determination):** `consent_collection` alone is not a technical
control — it is inert by default and **fails silently**: with the flag off, checkout succeeds, the
customer pays, `cs.consent` is null, and nothing refuses, warns, or records the absence.

**COUNSEL REQUIRED:** `@@unique([userId, version])` makes acceptance **per revision, not per
transaction**. Under a shared-record shape, someone who accepted while buying a letter pack would not
be asked again at a later upgrade. Whether that is acceptable is a legal question.

---

## 8. Migration review

| Question | Answer |
|---|---|
| Additive? | **PASS** — 1 CREATE TABLE, 2 CREATE INDEX, 1 ADD CONSTRAINT. Zero DROP, zero ALTER of any existing table, **zero INSERT/UPDATE/COPY, no backfill, no DEFAULT that could manufacture an acceptance** |
| Rollback-safe? | **CONDITIONAL.** Rolling back the *app* while leaving the table strands nobody. Dropping the *table* strands people two ways: live app code hard-fails every upgrade; and if rows exist, DROP destroys consent evidence **that cannot be reconstructed**, because nothing may fabricate it retroactively. `DROP TABLE` is valid **only** while the table is empty and the app is not yet live |
| Fails before Stripe mutation? | **PASS** — gate precedes `subscriptions.update`; no charge, no subscription created |
| Concurrent duplicates? | **PASS** — UNIQUE is in the **database**, not only Prisma. Prisma compiles the upsert to read-then-write, so the race window is real; the constraint closes it. Loser gets a 500 with **no Stripe mutation** — fail-closed |
| Acceptance ≠ payment? | **PASS** — the three states are cleanly separable and nothing conflates them |
| `pending:` prefix collision? | **PASS** — none of the six handled Stripe event types contains a colon |
| 409 causes retry? | **PASS** — Stripe retries on any non-2xx; 409 is returned before any handling |

**VERIFICATION REQUIRED — PRODUCTION:** the successful `migrate deploy` ran against an **empty local**
database. Production has **no `_prisma_migrations` history**, so `migrate deploy` there would attempt
`0_init` against a populated database. **A Gate D baseline is a prerequisite.**

---

## 9. Toolchain results

| Check | Result |
|---|---|
| `npm ci` | **PASS** — 735 packages |
| `npx prisma generate` · `npx prisma validate` | **PASS** |
| `npx tsc --noEmit` | **PASS** — exit 0 |
| `npx next build` | **PASS** — exit 0 |
| Guard suite — **79 scripts** | **PASS — 79/79, 0 failing** |
| `scripts/gate-d-preflight.test.ts` | **PASS** — 105/105 (was crashing) |
| `scripts/terms-acceptance.test.ts` | **PASS** — 74 assertions |
| `npm run lint` | **FAIL — 3 errors, PRE-EXISTING.** Both files untouched by Waves 2/2.1; CI sets `continue-on-error: true`, "not a launch gate" |
| `migrate diff --from-migrations` (chain-vs-schema) | **NOT RUN — ENVIRONMENT** — needs a shadow database |
| Migration apply to production | **NOT RUN — OWNER AUTHORIZATION REQUIRED** |

---

## 10. Runtime versus source-level verification

The distinction that mattered for three waves, now resolved for the critical paths.

**RUNTIME-VERIFIED (real execution):** FK cascade behaviour, migration apply and rollback, acceptance
concurrency (real Postgres 16.13) · acceptance written **before** any Stripe mutation, asserted on
**ordering index** · 428 with **no** money-moving call · idempotent repeat under a real unique
constraint · Stripe failure after acceptance leaving the record intact and never reporting an upgrade ·
the full webhook claim cycle (claimed / in_flight / completed / stale re-claim / failure-then-retry) ·
unknown price failing closed, asserted by **absence of a `plan` key** in the update payload — which a
final-state read could not distinguish from "wrote the same value".

**SOURCE-LEVEL ONLY:** gate positional ordering in the route text, UI wiring assertions, the compliance
rule inventory, and every `scripts/*.test.ts` regex guard. These are labelled as such and are **not**
claimed as runtime proof.

---

## 11. Negative-control evidence

| Guard | Proof |
|---|---|
| `terms-acceptance.test.ts` (74) | **15/15 mutations detected** |
| `gate-d-preflight.test.ts` (105) | Restored from crash; coverage totals computed, not guessed |
| `scripts/runtime/*` (113 assertions) | Each runtime test re-run against deliberately broken behaviour and shown failing |
| `stripe-lifecycle` (84) · `compliance-bar` (263) | Wave 2 controls, unbroken |

---

## 12. Proposed PR separation — **the branch is not a release unit**

**Chosen strategy: dependency-ordered separate PRs, each cherry-picking whole reviewed commits.**
Rejected: merging the branch (deploys schema-dependent code before the migration) and history rewrite
(destroys reviewed evidence for no gain).

| PR | Unit | Contents | Migration dep | Merging auto-deploys? | Blocked by |
|---|---|---|---|---|---|
| **PR-0** | A + H | Docs, runbooks, read-only tooling | none | Yes, harmlessly | — |
| **PR-1** | B | Wave 1 production-path fixes | none | **Yes** | — |
| **PR-2** | C | Webhook lifecycle correction | none | **Yes** | PR-1 |
| **PR-3** | G | Compliance bar | none | **Yes** | **COUNSEL (B-05)** |
| **PR-4** | D+E+F | **Terms model + UI + enforcement — indivisible** | **YES** | **Yes — hazardous** | **Migration applied first** |
| **PR-5** | A | Wave 2/2.1 record | none | Yes, harmlessly | all above |

**PR-4 is indivisible** because `scripts/terms-acceptance.test.ts` asserts across the model, the UI and
the route — splitting it makes CI red on every fragment.

```
PR-0 ──► PR-1 ──► PR-2 ──────────────────────────► PR-5
PR-3 ── COUNSEL gate ──────────────────────────────┤
[owner: Gate D baseline] ─► [apply migration] ─► [forward-validate] ─► PR-4 ┘
        ^^^ not a PR — a production operation ^^^
```

---

## 13. Migration and deployment sequence (owner-controlled)

1. **Gate D baseline** — production has no `_prisma_migrations` history; `migrate deploy` is expected to
   fail on `0_init`. **OWNER DECISION REQUIRED.**
2. **Snapshot/backup** — required. **This report does not claim a backup exists; none has been verified.**
3. **Apply** `20260728000000_terms_acceptance`.
4. **Forward-validate** — five columns, `COUNT(*) = 0`, both indexes, FK `confdeltype = 'r'`.
5. **`prisma generate` + build.**
6. **Ship UI** (PR-4 contains both UI and enforcement — they deploy together).
7. **Smoke test** — upgrade without acceptance returns 428 and creates no Stripe change; with acceptance
   succeeds and writes exactly one row.
8. **Monitor** — 428 rate, 500 rate on the upgrade path, webhook 409 rate.

**Rollback constraints — stated honestly.** Rolling back the app while leaving the table is safe.
Dropping the table is safe **only** while it is empty and the app is not live. **Once rows exist, the
migration is effectively forward-only**, because consent evidence cannot be reconstructed and nothing
may fabricate it.

---

## 14. Updated Go/No-Go

### 🔴 NO-GO

| Blocker | State | Gate |
|---|---|---|
| B-01…B-04, B-04g, B-07, B-08, B-11 | ✅ **CLOSED** (8) | — |
| Gate D CI guard | ✅ **CLOSED** this wave | — |
| **B-06** terms acceptance | ⚠️ **PARTIAL** — UI + FK fix done; **migration unapplied** | **OWNER DECISION REQUIRED** |
| **B-05** compliance bar | ⚠️ **PARTIAL** | **COUNSEL REQUIRED** |
| **B-10** alerting | ⚠️ **PARTIAL** | **PRODUCTION** |
| **B-09** backup/recovery | ❌ **OPEN** — no drill has run | **OWNER + PRODUCTION** |
| **B-12** counsel sign-off | ❌ **BLOCKED — COUNSEL** | **COUNSEL** |
| C-01 · C-02 | **VERIFICATION REQUIRED — PRODUCTION** | **PRODUCTION** |

---

## 15. Remaining engineering work — Wave 2's claim retracted

**Wave 2 said "no remaining blocker is engineering work." That was false, and this wave proves it:**
the terms UI was engineering and did not exist; the Gate D guard was crashing in CI; the FK was
erasing consent. All three are now fixed and committed.

**Still ENGINEERING:** regenerate the Gate D runbook manifest for seven migrations (rides with the
apply) · local consent trace for new-subscription and letter-pack paths (**conditional on O7/counsel**) ·
acceptance at registration (**conditional on O5**) · disabled-account cancellation path (**conditional on
O3**) · 3 pre-existing lint errors · wire `scripts/runtime/run-all.ts` into `.ai/TESTING.md` · stale
`lib/billing.ts` comment citing a retracted premise.

---

## 16. Decisions required

**OWNER:** O1 apply the migration — yes/no · O2 approve the Gate D baseline · O3 ratify a
disabled-account billing policy (a paying disabled customer currently **cannot cancel**) · O4 backfill
option for existing subscribers (**A = no backfill is what the code does**) · O5 acceptance at
registration? · O6 approve each of the six merges · O7 is a local consent trace for the other two paid
paths in scope for v1.0?

**COUNSEL:** C1 **B-12** CROA/FCRA positioning (critical path) · C2 **B-05** the eight compliance-bar
questions (gates PR-3) · C3 are backfill options B/C lawful? · C4 acceptance scope — per revision or per
transaction?

**PRODUCTION:** confirm the DB provider and **run the restore drill** (B-09) · set `ALERT_WEBHOOK_URL`
and **prove delivery** (B-10) · `SETUP_SECRET` presence (C-01) · encryption backfill completeness (C-02) ·
`STRIPE_TOS_CONSENT` + Dashboard Terms URL · whether the Billing Portal permits plan changes ·
out-of-band Stripe prices.

---

## 17. Commit list

| Hash | Commit |
|---|---|
| `717697f` | `fix(schema): TermsAcceptance must not erase consent by FK cascade` |
| `a2b0a04` | `fix(ci): repair the Gate D preflight guard broken by the Wave 2 migration` |
| `2911d44` | `feat(billing): terms-acceptance UI for the in-place upgrade path` |
| `4871d4e` | `test(runtime): mocked runtime guards, plus the release sequence and migration runbook` |
| *(this commit)* | `docs(rc1): record Wave 2.1 — criteria v1.3 plus release-integration report and HTML` |

---

## 18. Recommendations

**MERGE: NO — not as a branch.** Merge PR-0 → PR-1 → PR-2 individually once reviewed. **PR-4 must not
merge until the migration is applied and forward-validated.**

**DEPLOY: NO.** No production change is authorised by this wave.

**EXACT NEXT ACTION:** answer **O1** (apply the migration — yes/no) and **O2** (approve the Gate D
baseline). Those two unblock PR-4, which is the only unit carrying real launch value that is currently
frozen. Everything else in PR-0/1/2 is reviewable and mergeable **today**.

---

*Repository truth is authoritative. Nothing here asserts a production fact, a completed drill, a
measured RPO/RTO, a live alert delivery, or a legal conclusion. A written runbook is not operational
proof.*
