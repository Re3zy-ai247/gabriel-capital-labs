# CreditVector — RC1 Execution Wave 2 Report

**Date:** 2026-07-28 · **Branch:** `claude/creditvector-founder-library-jwnbhc`
**Commit range:** `27bc430` → `59fad4f` (5 commits) · **Status:** Draft — not ratified

> **Verdict: 🔴 NO-GO for Version 1.0. Do NOT merge this branch to `main` as a unit.**
> A push to `main` auto-deploys production and would take the paid upgrade path down.
> See §12 for the required release order.

---

## 1. Context for a reader with no repository access

**CreditVector** is a live Next.js 14 consumer-credit **education** SaaS (creditvector.app) with live
Stripe billing, built by Gabriel Capital Labs. It is deliberately *not* a credit-repair service: it
operates under a CROA bar forbidding promised outcomes, guaranteed deletions, or score improvements.

**RC1** is the Version 1.0 release program, governed by three documents — an assessment
(`CREDITVECTOR_RC1.md`), a plan (`CREDITVECTOR_RC1_EXECUTION.md`), and the canonical binary Go/No-Go
checklist (`CREDITVECTOR_RC1_CRITERIA.md`). An audit of 26 subsystems produced NO-GO with 12
launch-blocking defects. **Wave 1** closed 7. **Wave 2** is this report.

Two repository rules shape everything below:
- **MIGRATION-FIRST** (owner-ratified 2026-07-20): new schema ships as a reviewed migration applied as
  a deliberate owner release step, never in the build.
- **Repository truth is authoritative.** Code cannot prove production configuration, completed drills,
  measured RPO/RTO, live alert delivery, live Stripe catalog contents, or legal approval. Those are
  never inferred here.

---

## 2. Mission and constraints

Close remaining blockers where repository policy authorizes; reduce the rest to exact owner, counsel,
and production packages. No architecture redesign, no feature expansion, no push to `main`, no
production deployment, no live Stripe or database mutation. Another workstream's artifacts
(`knowledge/`, `architecture/GIOS-*`, Founder Library) are read-only dependencies — **none was touched.**

---

## 3. Starting state

| | |
|---|---|
| Branch | `claude/creditvector-founder-library-jwnbhc` |
| Starting commit | `27bc430` (Wave 1 end) |
| Working tree | clean |
| Ending commit | `59fad4f` |
| Migrations before / after | 6 → 7 directories (the 7th **authored, not applied**) |

---

## 4. Agents and ownership boundaries

One coordinator + four implementation agents (parallel, strictly disjoint) + one adversarial verifier
(started only after implementation finished).

| Agent | Owned files |
|---|---|
| 1 — Terms Acceptance | `prisma/schema.prisma`, `prisma/migrations/**` (new dir), `lib/terms.ts`, `app/api/stripe/checkout/route.ts`, `scripts/terms-acceptance.test.ts`, `RC1-B06-*.md` |
| 2 — Compliance | `lib/compliance.ts`, `scripts/compliance-bar.test.ts`, `RC1-B05-*.md` |
| 3 — Recovery & Monitoring | `OPERATIONS.md`, `.ai/RUNBOOKS/restore-drill.md`, `.ai/RUNBOOKS/alert-activation.md` (docs only — owned no script) |
| 4 — Harness & Webhook | `scripts/verify-production.sh`, `app/api/stripe/webhook/route.ts`, `lib/billing.ts`, `scripts/stripe-lifecycle.test.ts`, `RC1-DISABLED-ACCOUNT-POLICY.md` |
| 5 — Adversarial verifier | read-only; mutation-tested every guard |

**Ownership violations: none.** No agent wrote outside its set; no migration applied; no competing RC1
checklist created; no secret value in any artifact.

---

## 5. Files changed

**Modified (9):** `OPERATIONS.md` · `app/api/stripe/checkout/route.ts` · `app/api/stripe/webhook/route.ts` ·
`lib/billing.ts` · `lib/compliance.ts` · `prisma/schema.prisma` · `scripts/checkout-consent.test.ts` ·
`scripts/compliance-bar.test.ts` · `scripts/stripe-lifecycle.test.ts`

**Added (9):** `lib/terms.ts` · `prisma/migrations/20260728000000_terms_acceptance/migration.sql` ·
`scripts/terms-acceptance.test.ts` · `scripts/verify-production.sh` ·
`.ai/RUNBOOKS/restore-drill.md` · `.ai/RUNBOOKS/alert-activation.md` ·
`RC1-B06-TERMS-ACCEPTANCE-PACKAGE.md` · `RC1-B05-COUNSEL-REVIEW.md` · `RC1-DISABLED-ACCOUNT-POLICY.md`

---

## 6. Commits

| Hash | Commit |
|---|---|
| `26d2b1c` | `feat(billing): durable versioned terms acceptance on the paid upgrade path (migration NOT applied)` |
| `86ba824` | `fix(compliance): generalize the score bar and stop rejecting scam warnings` |
| `7099bde` | `docs(ops): executable restore-drill and alert-activation runbooks` |
| `59fad4f` | `fix(stripe): close the webhook claim window; add the production verification harness` |
| *(pending)* | `docs(rc1): record Execution Wave 2` — criteria v1.2 + this report + HTML |

---

## 7. What each change actually did

### B-06 — Terms acceptance · **PARTIAL**
The in-place upgrade (`stripe.subscriptions.update`) never touches Stripe Checkout, so
`consent_collection` never renders and **Stripe records nothing** — the highest-value transaction in
the product took money with zero recorded acceptance.

Added a `TermsAcceptance` model with `@@unique([userId, version])`, a reviewed migration, `lib/terms.ts`,
and an enforced gate that records acceptance durably **before** the Stripe call and refuses with **428**
otherwise. The recorded version is a **server constant, never the request body**, cross-checked against
the published revision date of `app/legal/terms`. No environment flag can disable the gate.

**The migration writes no rows.** Existing subscribers never consented, and inventing retroactive
consent is the one thing this must not do. Backfill options are presented unpicked.

**Why PARTIAL:** the gate covers **one of three** paid paths. New subscriptions and the letter pack
still record acceptance only via `consent_collection`, inert unless `STRIPE_TOS_CONSENT=1` **and** a
Terms URL is set in the live Stripe Dashboard — neither verified anywhere.

### B-05 — Compliance score bar · **PARTIAL**
Wave 1's rules were literal phrases defeated by rewording. Wave 2 generalized them and added two
carve-outs so the control does not punish the education the platform exists to deliver: a **negation**
carve-out ("no one can guarantee deletion") and an **attribution** carve-out ("firms that promise
guaranteed deletions are usually scams").

**The attribution carve-out was initially wrong and made things worse.** It required a relative pronoun,
so every participial form missed — *"a company promising"*, *"an ad guaranteeing"*, *"firms advertising"*.
On `lib/community.ts` these flags are a **hard reject gate**, so members warning each other about scams
were rejected outright. Fixed to accept a bare participle or verb, and evaluated over a window extending
**past** the match, because the linking word is often the matched text itself (in *"an ad guaranteeing a
100 point increase"* everything before the offset is just *"an ad"*). The window stops at the first
sentence break; the first-person exclusion still applies, so *"we are a company that guarantees deletion"*
is still caught.

**Measured independently:** over-blocking of consumer-warning copy **3/8 → 1/8**. The remaining case puts
its negation *after* the claim, which a backward-looking window structurally cannot see.

**Honest limit:** phrase matching has a ceiling. Promises carrying no score or deletion noun
("Guaranteed results or your money back") still pass. **Regex does not establish CROA compliance.**

### B-09 — Recovery · **OPEN**
`.ai/RUNBOOKS/restore-drill.md` is provider-**neutral** by necessity: `DATABASE_URL` is a Prisma
Accelerate proxy, so the origin Postgres provider is unknown and no provider-specific command is
invented. §1 is a fact block that must be filled before the drill starts — *"I think it's Neon"* is
explicitly not a recorded answer; an unrecognised provider routes to *"do not improvise"*. The drill
hard-stops if automated backups return NO or UNKNOWN, and forbids substituting a manual `pg_dump` for a
backup never proven to exist.

Exit criteria are **gated, not narrated**: a schema diff via `prisma db pull`; a **decrypt of one
encrypted `Report.rawText` with the production key** (which is what proves data and key were restored
together); and `prisma migrate status` clean. The clock does not stop until the migration repair
completes — *a database you cannot migrate is not a recovered database.* That repair path is itself
labelled **UNPROVEN**, because production carries no `_prisma_migrations` history.

**RPO and RTO remain blank worksheet fields.** No example numbers, because an example number in a
recovery runbook becomes a quoted commitment.

### B-10 — Monitoring · **PARTIAL**
`.ai/RUNBOOKS/alert-activation.md`: choosing a destination, setting the variable **without printing its
value**, and the end-to-end drill that proves an alert actually **arrived** — configuration presence is
not delivery proof — plus cron liveness and failure handling. `ALERT_WEBHOOK_URL` is still unset.

### B-04g — Webhook claim window · **CLOSED**
Wave 1 released the ledger claim only from the handler catch, so a timeout, OOM or eviction between
claim and response left it held: Stripe's retry was deduplicated away and **the event was lost
permanently**. The claim is now written PENDING and settled only on success, and a stale pending claim
may be re-taken — one atomic `INSERT … ON CONFLICT DO UPDATE` reusing the existing `type` and
`createdAt` columns, so **no schema change and no new self-heal DDL**.

**That alone was not sufficient.** `claimStripeEvent` returned a boolean, conflating *"already
completed"* with *"claimed by an invocation that may have died"* — both answered 200, and a 200 tells
Stripe to stop retrying, so a retry inside the window still lost the event. **This was the Wave 1 bug in
a new place.** The claim is now three-state: `completed` → 200, `in_flight` → **409** so Stripe retries,
`claimed` → handle. A refused claim with no surviving row fails toward retry, never toward silence.

### Production verification harness
`scripts/verify-production.sh`: env presence (**never values**), `SETUP_SECRET`-gated route inventory,
encryption-backfill measurability, Stripe catalog consistency, disabled-account handling, toolchain
prerequisites. Read-only by default, mutation behind an explicit flag, fail-closed. Most items correctly
report **VERIFICATION REQUIRED — PRODUCTION**, and the closing line states that **a clean run is not a Go.**

---

## 8. Tests and checks executed

| Check | Result |
|---|---|
| Guard suite (76 scripts) | **29 fully green · 0 failing · 47 NOT RUN — ENVIRONMENT** |
| `scripts/terms-acceptance.test.ts` | **PASS** — 36 assertions |
| `scripts/compliance-bar.test.ts` | **PASS** — 263 assertions |
| `scripts/stripe-lifecycle.test.ts` | **PASS** — 84 assertions |
| `scripts/checkout-consent.test.ts` | **PASS** — 12 assertions (re-scoped) |
| `scripts/schema-safety.test.ts` | **PASS** — 17 assertions (no new self-heal DDL) |
| `scripts/billing-integrity` / `billing-identity` / `critical-paths` / `observability` / `agency-capacity` | **PASS** (Wave 1 guards, unbroken) |
| `bash -n` on both shell scripts | **PASS** |
| `npm run typecheck` | **NOT RUN — ENVIRONMENT** — `node_modules` absent |
| `npx next build` · `npm run lint` | **NOT RUN — ENVIRONMENT** — same |
| 47 remaining guards | **NOT RUN — ENVIRONMENT** — `Cannot find module '@prisma/client'`; identical at clean HEAD |
| Any live production probe | **NOT RUN — ENVIRONMENT** — outbound CONNECT blocked (`curl: (56) 403`) |
| Migration apply / forward-validate / rollback | **NOT RUN — OWNER AUTHORIZATION REQUIRED** |
| Restore drill · alert delivery drill | **NOT RUN** — provider identity / `ALERT_WEBHOOK_URL` absent |

**Load-bearing gap:** `prisma.termsAcceptance` is a **new client accessor** that exists only after
`prisma generate` against the updated schema. `tsx` proves syntax, not types. **`npm run typecheck`
must pass before merge.**

---

## 9. Negative controls and non-vacuity evidence

Every new or changed guard was proved to fail against deliberately broken behavior.

| Guard | Kind | Proof |
|---|---|---|
| `terms-acceptance` | source-level | **9/9 mutations caught** — gate deleted (8 FAIL), gate moved after the Stripe call (4 FAIL), client version recorded instead of server constant, env kill-switch added (3 variants), backfill added to migration, UNIQUE downgraded, version drift, error swallowed |
| `stripe-lifecycle` | source-level | **7/7 mutations caught** — `DO NOTHING` restored (4 FAIL), pending-only condition removed (2), staleness removed (1), window shrunk (2), unscoped release (1), settle-before-handler (2), **in-flight collapsed to 200 (1)** |
| `compliance-bar` | **runtime behavioral** — executes the rules | trailing-guarantee rule neutered (6 FAIL), first-person exclusion dropped (3 FAIL), **`NEGATION_WINDOW` widened to 100000 (1 FAIL — previously passed silently)** |
| `verify-production.sh` | source-level + opt-in probe | 3/3 mutations caught — route deleted, `cv1:` constant renamed, diagnostics returning values instead of booleans |

**Vacuous assertions found and removed:** a `verify-production.sh` check recorded a **PASS** for the mere
existence of a decision memo this wave authored — demoted to VERIFICATION REQUIRED, since a document is
not a control and counting one's own output inflates the total. `NEGATION_WINDOW`, the first-person
exclusion, and the forward window's sentence boundary are now pinned.

**Guard-kind distinction, carried deliberately:** every Wave 2 guard except `compliance-bar` is
**source-level**. The 428 refusal, the pending-claim expiry, and the harness probe path are
**code-reviewed only** — no runtime behavior of the terms gate or the webhook claim cycle was exercised,
because there is no database and the migration is unapplied.

---

## 10. Failed approaches and corrections

1. **Attribution carve-out required a relative pronoun.** Missed all participial forms; measured
   over-blocking got *worse* than Wave 1 — a member writing *"firms advertising guaranteed deletions are
   usually scams"* was rejected. Fixed; 3/8 → 1/8.
2. **Backward-only carve-out window.** The linking word is often the matched text itself. Widened to a
   sentence-bounded forward window, first-person exclusion retained.
3. **`claimStripeEvent` returned a boolean.** Could not distinguish completed from in-flight, so a retry
   inside the window still got 200 and the event was still lost. Made three-state; the guard now pins
   that in-flight is never answered 2xx.
4. **A guard counted a memo's existence as a PASS.** Demoted.
5. **`NEGATION_WINDOW` was unguarded** — widening it to 100000 disabled the control with every assertion
   green. Now pinned.
6. **`checkout-consent.test.ts` had silently inverted in meaning.** Its "no parallel consent mirror"
   rule now passes while the opposite is deliberately true on the upgrade path. Re-scoped to the two
   Checkout-Session paths in the same commit that introduced the change.

---

## 11. RC1 Go/No-Go status

### 🔴 NO-GO for Version 1.0

| Blocker | Wave 1 | Wave 2 | Gate |
|---|---|---|---|
| B-01 · B-02 · B-03 · B-04 · B-07 · B-08 · B-11 | **CLOSED** | unchanged | — |
| **B-04g** webhook claim window | *(introduced)* | ✅ **CLOSED** | — |
| **B-05** compliance score bar | PARTIAL | ⚠️ **PARTIAL** (measurably stronger) | **COUNSEL REQUIRED** |
| **B-06** terms acceptance | OPEN | ⚠️ **PARTIAL** | **OWNER DECISION REQUIRED** |
| **B-09** backup/recovery | OPEN | ❌ **OPEN** (drill package ready) | **OWNER + PRODUCTION** |
| **B-10** alerting | PARTIAL | ⚠️ **PARTIAL** (activation package ready) | **OWNER + PRODUCTION** |
| **B-12** counsel sign-off | OPEN | ❌ **BLOCKED — COUNSEL** | **COUNSEL** |
| C-01 `SETUP_SECRET` · C-02 backfills | conditional | **VERIFICATION REQUIRED — PRODUCTION** | **PRODUCTION** |

**Closed: 8 · Partial: 3 · Open/Blocked: 2 · Verification required: 2.**
**No remaining blocker is engineering work.** Every one needs an owner decision, counsel, or production access.

---

## 12. Residual risks introduced by Wave 2

1. **RELEASE-ORDER HAZARD (blocking).** Pushing this branch to `main` auto-deploys. Deploying the route
   **before** the migration is applied → **HTTP 500 on every in-place upgrade**. Deploying **before** the
   `acceptTerms` UI ships → **HTTP 428 on every in-place upgrade**. Either way the upgrade revenue path
   is down. **Required order: apply migration → forward-validate → ship UI → deploy route.**
2. **B-06's own release step has an unnamed dependency.** Applying via `prisma migrate deploy` is
   expected to **fail on `0_init`**, because production carries no `_prisma_migrations` history.
   Approving B-06 implies approving a **Gate D baseline operation first.**
3. **Terms gate has no kill switch** (deliberate: "direct API bypass must fail closed"). Correct, but it
   means the sequencing in item 1 is not optional.
4. **`invoice.payment_failed` is the one handler that writes state from the event snapshot** without
   re-retrieving. Now that a stale claim can be re-processed, a re-claimed old event could set
   `past_due` on a subscriber who has since paid. Self-heals on the next success event. Low.
5. **Compliance carve-outs widen what is permitted.** Each carve-out is a deliberate hole to protect
   educational speech; the first-person exclusion is the only thing preventing a first-party promise
   from using one.

---

## 13. Owner decisions required

1. **Apply migration `20260728000000_terms_acceptance` and ship the B-06 gate — YES/NO.** If YES, name
   the existing-subscriber backfill option (A: no backfill — what the code does; B: prospective
   re-consent campaign; C: cite pre-existing Stripe consent per cohort). **B and C are counsel questions.**
2. **Approve the Gate D baseline** that applying any migration now depends on (item 12.2).
3. **Confirm the DB provider** behind Prisma Accelerate (~15 min) to unblock B-09.
4. **Ratify a disabled-account billing policy** — four options in `RC1-DISABLED-ACCOUNT-POLICY.md`.
   Today a disabled but paying subscriber cannot self-cancel while Stripe keeps charging.
5. **Should registration also require acceptance?** Needs signup UI work not in scope here.
6. `TermsAcceptance` retention: `onDelete: Cascade` vs `Restrict` + explicit shredding.

---

## 14. Counsel decisions required

1. **B-12** — CROA/FCRA positioning, news/defamation posture, ToS/Privacy/refund. **Still the critical path.**
2. **B-05** — the eight questions in `RC1-B05-COUNSEL-REVIEW.md`. Is this phrase set the right bar?
   **Use the independently measured numbers in §7, not corpus-relative ones.**
3. **B-06** — is acceptance required at registration as well as at the point of upgrade? And are backfill
   options B/C lawful?

---

## 15. Production verification required

| # | Question | Command |
|---|---|---|
| 1 | Is `ALERT_WEBHOOK_URL` set — and has an alert **arrived**? | `.ai/RUNBOOKS/alert-activation.md` (drill, not a config read) |
| 2 | DB provider identity, then **run the drill**; record measured RPO/RTO | `.ai/RUNBOOKS/restore-drill.md` |
| 3 | Is `SETUP_SECRET` set? (C-01) | `scripts/verify-production.sh` |
| 4 | Did the encryption backfills complete? (C-02) | `scripts/verify-production.sh` |
| 5 | Is `STRIPE_TOS_CONSENT=1` **and** a Terms URL set in the live Stripe Dashboard? | Stripe Dashboard |
| 6 | Any out-of-band Stripe prices? | `scripts/verify-production.sh` |
| 7 | Does a 150-tradeline re-analysis fit the 15s transaction ceiling? | Wave 1 residual |
| 8 | `npm run typecheck` + `next build` | **Before merge** |
| 9 | Post-deploy: upgrade without `acceptTerms` returns 428 and creates no Stripe change | curl |

---

## 16. Recommendation

**READY FOR REVIEW — NOT READY FOR MERGE, NOT READY FOR DEPLOY.**

The branch is a coherent, guarded, honestly-labelled improvement. It is **not** mergeable as a unit,
because merging deploys, and deploying in the wrong order takes down the upgrade path (§12.1).

**Exact next step:** the owner answers decision 13.1 (apply the migration — yes/no) and 13.3 (name the
DB provider). Those two answers unblock more remaining RC1 work than all other actions combined —
13.1 gates the B-06 release sequence, and 13.3 converts B-09 from OPEN to executable the same day.

A further engineering wave is **not** the bottleneck. **The bottleneck is three decisions and one
15-minute console lookup.**

---

*Repository truth is authoritative. Nothing in this document asserts a production fact, a completed
drill, a measured RPO/RTO, a live alert delivery, or a legal conclusion. Where those appear, they are
marked VERIFICATION REQUIRED, OWNER DECISION REQUIRED, or COUNSEL REQUIRED.*
