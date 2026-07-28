# CreditVector — Release Criteria (RC1)

**The executive Go/No-Go checklist for CreditVector Version 1.0.**

**Version:** 1.2 · **Status:** Draft — not ratified · **Date:** 2026-07-28 (Waves 1–2 applied)
**Method:** repository audit of 26 launch-critical subsystems; every finding independently
re-verified against source before entry. **No code was written. No feature was implemented.**

---

## 0. What this document is, and what it is not

Three RC1 documents now exist. They do different jobs and **none repeats another** (`CLAUDE.md`:
never a second source of truth).

| Document | Job | Owns |
|---|---|---|
| [`CREDITVECTOR_RC1.md`](CREDITVECTOR_RC1.md) | **Assessment** — how ready are we, and why | Category scores, the 57/100 rationale, weighting method |
| [`CREDITVECTOR_RC1_EXECUTION.md`](CREDITVECTOR_RC1_EXECUTION.md) | **Plan** — what we do, in what order | P0/P1/P2/P3 sequencing, owners, effort, critical path |
| **This document** | **Criteria** — may we ship, yes or no | Binary gates, acceptance criteria, validation steps, rollback, blocker status |

An assessment produces a number. A plan produces a sequence. **Neither answers "may we ship."**
That is this document, and it answers only in binary.

**Scope (inherited, not re-litigated):** RC1 = **self-mail consumer product**. Physical-mail-as-a-
service (`MAIL_LIVE`/LetterStream/CSO), SOC 2, public API, and GIOS route flips are **out of scope**
per `CREDITVECTOR_RC1_EXECUTION.md`. Dormant infrastructure neither helps nor blocks.

### ⚠ One scope contradiction the owner must resolve

`lib/platform/health.ts:56` records **Production (1.0) = "NOT YET"** with the gating detail
`"MAIL_LIVE, MFA, remaining tier checkouts, GLBA program"`. `CREDITVECTOR_RC1_EXECUTION.md` defers
`MAIL_LIVE` to **P3, explicitly out of RC1**. **Code and plan disagree about whether physical mail
gates 1.0.** This document follows the plan (self-mail scope) and flags the divergence as
**RC1-SCOPE-1**. One of the two must be amended; a Go/No-Go cannot rest on a contradiction.

---

## 1. Evidence standard

This document adopts the repository's own honesty law (`lib/platform/health.ts:1-7`): every value is
either **MEASURED** (read from source or executed) or an **ASSESSMENT** (judgment, dated). Nothing is
presented as measured when it is not.

| Label | Meaning |
|---|---|
| **SHIPPED — VERIFIED** | Code read end to end **and** a guard script covers it |
| **SHIPPED — UNVERIFIED** | Code read end to end; no automated coverage of the behavior |
| **PARTIAL** | Core path exists; a material gap is proven in source |
| **DORMANT (FLAG)** | Code deployed, flag fail-closed OFF, no user-visible surface |
| **ABSENT** | Searched for; does not exist |
| **VERIFICATION REQUIRED** | **Cannot be determined from the repository.** Needs a live check |

**No item below is marked complete on the basis of a file existing.** Where the audit could not
reach ground truth — production environment variables, whether a backfill ran, whether a cron fired —
it says **VERIFICATION REQUIRED** and names the exact check. There are **14** such items (§6).

**Local validation constraint:** there is no `DATABASE_URL` or `ANTHROPIC_API_KEY` in the audit
environment, so **no live request was executed against production**. All findings are source-level or
guard-level. `npm run typecheck` could not be run to completion — `node_modules/@types` is absent in
the audit container, an environmental limitation, not a finding.

---

## 2. VERDICT

> # 🔴 NO-GO for Version 1.0 — but materially advanced
>
> **Execution Wave 1 (2026-07-28) closed 7 of the 12 launch blockers** and landed partial fixes on 2
> more. **3 remain open** and **none of the three is an engineering task** — they are counsel, an
> owner-run restore drill, and a schema change requiring owner ratification. **14 items still require
> live verification.**
>
> | | Wave 0 (audit) | After Wave 1 |
> |---|---|---|
> | Blockers closed | 0 | **7** (B-01, B-02, B-03, B-04, B-07, B-08, B-11) |
> | Partially closed | 0 | **2** (B-05 compliance, B-10 monitoring) |
> | Open | 12 | **3** (B-06 schema · B-09 owner drill · B-12 counsel) |
> | Conditional | 2 | 2 (C-01, C-02 — both VERIFICATION REQUIRED) |
> | Guard checks added | 0 | **243** across 5 new guard scripts |
>
> **Every revenue-integrity blocker is closed.** The free-letter bypass, wrong-plan checkout, stale-email
> billing authorization, and webhook ordering are fixed and guarded. What remains is legal sign-off, a
> restore drill only the owner can unblock, and one consent column.

**The product is strong.** The dispute engine, letter generation, §605 obsolescence math, client-
capacity enforcement, encryption at rest, and prompt-injection fencing are genuinely well-built and
guard-covered. The 70-script guard suite is real and CI-enforced. **What is not ready is the
commercial and operational envelope around the product** — the same conclusion
`CREDITVECTOR_RC1.md` reached on 2026-07-15, now with specific, located defects instead of scores.

### Since the 2026-07-15 assessment — real progress, honestly scored

| Prior P0 | Then | Now | Verdict |
|---|---|---|---|
| CI gate | ABSENT | `.github/workflows/ci.yml` + 3 more; typecheck + Gate D + all 70 guards on every push | ✅ **CLOSED** |
| Structured logging | ABSENT | `lib/log.ts` (JSON lines), `lib/observability.ts` | ✅ **CLOSED** (wiring thin — §4.9) |
| Error boundary / health | ABSENT | `app/error.tsx`, `/api/health`, `/api/health/ready` | ✅ **CLOSED** (`global-error.tsx` still absent) |
| Security headers | ABSENT | `next.config.js:22-37` — six headers, HSTS 2yr | ✅ **CLOSED** (no CSP — accepted) |
| Preview/prod DB isolation | SHARED | Separate DB; prod vars scoped Production-only | ✅ **CLOSED** |
| Migration discipline | `db push` in build | Removed from both build commands; 6 migrations; `schema-safety.test.ts` | ✅ **CLOSED** |
| **Alerting** | NONE | Hook built, **`ALERT_WEBHOOK_URL` unset → dormant** | ❌ **STILL OPEN** |
| **Backup / restore drill** | NONE | Procedure written; **provider unconfirmed, drill never run** | ❌ **STILL OPEN** |
| **Counsel sign-off** | OPEN | OPEN | ❌ **STILL OPEN** |

**Four of six engineering P0s from the last assessment are genuinely closed.** That is real work.
The two that remain are the two that were never engineering-blocked — they were waiting on the owner.

---

## 3. Launch-blocking defects — the Go/No-Go gate

**All twelve must close. No exceptions, no partial credit.**

### Wave 2 status (2026-07-28) — read this column first

| # | Status | Where |
|---|---|---|
| B-05 compliance score bar | ⚠️ **PARTIAL** | `86ba824` — rules generalized; negation + attribution carve-outs. Over-blocking of consumer-warning copy measured **3/8 → 1/8** on an independent corpus. Promises with no score/deletion noun still pass. **COUNSEL REQUIRED** for the standard |
| B-06 terms acceptance | ⚠️ **PARTIAL** | `26d2b1c` — durable versioned `TermsAcceptance` + enforced 428 gate on the in-place upgrade path. **Migration authored, NOT applied.** New-subscription and letter-pack paths still depend on `STRIPE_TOS_CONSENT` — **VERIFICATION REQUIRED — PRODUCTION**. **OWNER DECISION REQUIRED** to apply |
| B-09 backup/recovery | ❌ **OPEN** | `7099bde` — provider-neutral drill runbook with gated exit criteria and a blank RPO/RTO worksheet. **No drill has run.** Blocked on owner confirming the DB provider |
| B-10 alerting/monitoring | ⚠️ **PARTIAL** | `7099bde` — activation + delivery-drill runbook. **`ALERT_WEBHOOK_URL` still unset.** Config presence is not delivery proof |
| B-12 counsel sign-off | ❌ **BLOCKED — COUNSEL** | External. Unchanged, still the critical path |
| B-04g webhook claim window | ✅ **CLOSED** | `59fad4f` — three-state claim; in-flight answers 409 so Stripe retries. A 200 there was the Wave 1 bug in a new place |

**Wave 2 corrected three of its own findings before commit.** (1) The compliance
attribution carve-out required a relative pronoun, so participial forms missed and
member scam-warnings were being rejected — over-blocking had got *worse* than Wave 1.
(2) `claimStripeEvent` returned a boolean, conflating "completed" with "may have died",
so a retry inside the window still lost the event. (3) A guard assertion counted a
decision memo's existence as a PASS, and another left `NEGATION_WINDOW` free to widen
to 100000 with every assertion green — that exact mutation now fails.

---

### Wave 1 status (2026-07-28)

| # | Status | Where |
|---|---|---|
| B-01 free-letter bypass | ✅ **CLOSED** | `a2fa6ea` — usage reads the append-only ledger, `MAX(rows, ledger)` |
| B-02 wrong-plan checkout | ✅ **CLOSED** | `6bc4cf4` — unknown plan → 400; `6bc4cf4`/`c3c4954` — `planForPrice` fails closed |
| B-03 stale-email billing authz | ✅ **CLOSED** | `6bc4cf4` — all three routes use `currentAccount()`; guard blocks reintroduction |
| B-04 webhook idempotency/ordering | ✅ **CLOSED** | `c3c4954` — ledger claim + re-retrieve. **Residual:** a timeout/OOM between claim and return leaves the claim held and drops that event |
| B-05 compliance score bar | ⚠️ **PARTIAL** | `013ea53` — gap closed, but literal-phrase regexes; ~half of a 20-phrase adversarial set still slips through. **Counsel question** |
| B-06 no ToS acceptance | ❌ **OPEN** | Needs a `termsAcceptedAt` column — **no schema this wave**. Marker comment at the upgrade call site |
| B-07 demo-seed credentials | ✅ **CLOSED** | `bd8f108` — 404 in production, password removed from the body |
| B-08 letter orphaning | ✅ **CLOSED** | `bd8f108` — natural-key re-link inside one transaction. **Trade-off:** all-or-nothing on very large reports |
| B-09 backup/recovery | ❌ **OPEN** | `826413b` corrected the runbook's superseded schema premise and added the post-restore repair step. **The drill itself is owner-blocked and has not run. RPO/RTO remain blank** |
| B-10 alerting/monitoring | ⚠️ **PARTIAL** | `826413b` — 404 now fails the probe, `global-error.tsx` added, cron-liveness check documented. **`ALERT_WEBHOOK_URL` is still unset — alerting remains dormant** |
| B-11 admin revocation | ✅ **CLOSED** | `bd8f108` — `requireAdmin()` fails closed on `disabled`, resolves by id |
| B-12 counsel sign-off | ❌ **OPEN** | External. Unchanged — and still the critical path |

**One fix failed verification and was corrected before commit.** Wave 1's `invoice.payment_failed`
gate initially read only the legacy `invoice.subscription` field. Stripe moved that field in API
version `2025-03-31.basil`, and which shape arrives depends on the version pinned on the **webhook
endpoint**, not the SDK's outbound pin — so under a modern endpoint the gate would have fired on
every invoice and **`past_due` would never have been written at all**, silently disabling dunning.
The resolver now reads both shapes, with a guard assertion that fails if either is removed.

---

| # | Defect | Subsystem | Evidence | Risk |
|---|---|---|---|---|
| **B-01** | **Free-letter paywall is trivially bypassable.** Usage is a live `COUNT` of `Letter` rows; users may delete their own letters. Generate 3 → read → delete → repeat forever. The 402 never fires. | Billing | `lib/entitlements.ts:134`, `app/api/letters/[id]/route.ts:52` | **Critical** |
| **B-02** | **Checkout sells the wrong plan.** Any unrecognized `body.plan` is coerced to `premium` instead of 400. A client posting `agency_pro` (marketed $699) is charged $99. `planForPrice` likewise fails **open** to `premium` for unrecognized prices. | Stripe | `app/api/stripe/checkout/route.ts:92`, `lib/stripe.ts:203` | **Critical** |
| **B-03** | **Billing routes authorize by stale session email**, contradicting the repo's own stated invariant (`CLAUDE.md`: "Sessions resolve by user id, not email"). Email is user-mutable. Consequence 1: a subscriber who changes their email **cannot open the Stripe portal to cancel**. Consequence 2: if the released address is re-registered, a stale JWT (30-day default) mints a portal session against **a stranger's** `stripeCustomerId`. `currentAccount()` already does this correctly everywhere else. | Authorization | `app/api/billing/status/route.ts:15`, `app/api/stripe/portal/route.ts:21`, `app/api/stripe/checkout/route.ts:63` vs `lib/session.ts:21`, `app/api/profile/route.ts:16-18,57` | **Critical** |
| **B-04** | **No idempotency or ordering guard on subscription webhooks.** Stripe guarantees at-least-once, **not in-order**. A reordered `subscription.updated` after `deleted` **restores a revoked plan**; the reverse **revokes a paying customer**. The `StripeWebhookEvent` ledger exists but is wired only into `creditLetters`. Separately, `invoice.payment_failed` stamps `past_due` unconditionally — a failed **$19 letter-pack** invoice flips a healthy subscriber. | Subscription lifecycle | `app/api/stripe/webhook/route.ts:60-64,75-88`, `lib/billing.ts:98-111` | **Critical** |
| **B-05** | **The compliance scrubber disclaims the score bar but cannot enforce it.** `lib/compliance.ts:59` ships a disclaimer stating *"No deletion, correction, or **score improvement** is guaranteed"* — yet the PROHIBITED rule set (`:5-35`) contains **no** `score` / `points` / `increase` / `improve` pattern at all. The file names the prohibition in prose and omits it from the control. `CLAUDE.md` calls score-improvement promises a CROA non-negotiable; `lib/community.ts:137` *tells users* the rule exists; `screenCommunityText` can never detect a violation. The admin compliance view renders this inventory as if complete. **The one occurrence of "score improvement" in the file is the disclaimer, not a rule.** | Letter generation / Compliance | `lib/compliance.ts:5-35,59`, `lib/community.ts:137-143`, `app/api/admin/compliance/route.ts` | **Critical** |
| **B-06** | **No terms acceptance anywhere.** No `termsAcceptedAt` / `tosVersion` field exists in the schema. Registration collects nothing. `CONSENT_COLLECTION` is spread into exactly two Checkout Sessions — **the in-place upgrade path (`subscriptions.update`) never renders a checkbox**, so the highest-value transaction in the product takes money with zero recorded acceptance even with `STRIPE_TOS_CONSENT` on. | Billing / Legal | `app/api/stripe/checkout/route.ts:45-47,82,159-164,193`, `scripts/checkout-consent.test.ts:63` | **Critical** |
| **B-07** | **Unauthenticated endpoint publishes working production credentials.** `/api/demo/seed` exports both GET and POST with **no `NODE_ENV` guard**; the response body returns `demo@gabrielcapitallabs.com` / `demo1234`, and `?force=1` performs a destructive re-seed. Its only containment is a rate limiter that **fails open**. | Security | `app/api/demo/seed/route.ts:15,28-29,47-52`, `lib/demoSeed.ts:7-8`, `lib/rateLimit.ts:72-75` | **Critical** |
| **B-08** | **Re-analysis destroys the user's legal work product.** `analyzeReportText` runs `tradeline.deleteMany({reportId})` then recreates rows with new ids. `Letter.tradelineId` is `onDelete: SetNull` and nothing re-links. Every previously generated dispute letter is permanently orphaned: resolution marking silently no-ops, the furnisher mailing address is lost (`TradelineContact` cascade-deletes), Round 2 propagates null. **On the success path.** | Credit report workflow | `lib/analyze.ts:68`, `prisma/schema.prisma:248`, `lib/furnisher.ts:36`, `app/api/mail/prepare/route.ts:37-38` | **Critical** |
| **B-09** | **Backup and recovery do not exist.** The origin database provider behind Prisma Accelerate is **unconfirmed**; no restore drill has run; **RPO and RTO are blank by design** pending measurement. There is no second durable store. `scripts/prod-health.sh:9-13` deliberately excludes database connectivity, so **the first signal of a corrupted or emptied database would be a customer report.** The drill procedure is written and ready — it has simply never been executed. | Backup & recovery | `OPERATIONS.md:70-107`, `scripts/prod-health.sh:9-13` | **Critical** |
| **B-10** | **Alerting is dormant; nothing watches the crons.** `reportError` forwards only when `ALERT_WEBHOOK_URL` is set — it is not. It has **6 call sites, none in `lib/`**. Nothing verifies a cron actually ran (a silently dropped schedule is invisible). `prod-health.sh:41` **accepts 404 as healthy**, so a route deleted by a bad deploy scores green. Failure terminates in a GitHub issue on a 24h cadence — no page, no on-call. | Monitoring | `lib/observability.ts:12-13`, `scripts/prod-health.sh:41`, `.github/workflows/daily-health.yml:50-60`, `vercel.json:6-8` | **Critical** |
| **B-11** | **Admin privilege has no revocation path.** `requireAdmin()` never checks `user.disabled`, so a suspended ADMIN retains full access to `/admin` and 36 admin APIs until the JWT expires — up to **30 days** (no `maxAge` configured). `isAdmin()` also resolves privilege by **email**, the same stale-identifier defect as B-03. | Authorization | `lib/admin.ts:5-11,16-22`, `lib/auth.ts:19` | **Critical** |
| **B-12** | **Outside-counsel sign-off is still open** — CROA/FCRA positioning, news/defamation posture, ToS/Privacy/refund. Carried unchanged from `CREDITVECTOR_RC1_EXECUTION.md` P0-1. **This is the long pole and it is not an engineering task.** | Legal | `.ai/CURRENT-STATE.md:145-150` | **Critical** |

### Conditional blockers — resolve by verification, not by code

| # | Defect | Condition | Evidence |
|---|---|---|---|
| **C-01** | `/api/admin/migrate` and `/api/admin/billing/provision` accept a **static shared secret in a URL query string** (`?secret=`, non-constant-time `===`, no rate limit, **no audit log**). The first executes raw DDL against production; the second **mutates the LIVE Stripe catalog and tax codes**. Query-string secrets land in Vercel access logs, CDN logs, and `Referer` headers. | **Inert if `SETUP_SECRET` is unset in prod** — `.ai/CURRENT-STATE.md:159` implies it was deleted, but the repository cannot confirm the live environment. **If set: promote to blocking immediately.** Also in direct tension with `CLAUDE.md`'s MIGRATION-FIRST rule. | `app/api/admin/migrate/route.ts:11-18`, `app/api/admin/billing/provision/route.ts:12-18,31-38` |
| **C-02** | **Encryption backfills may never have run.** `decryptText` returns any non-`cv1:` value **verbatim**, silently — no counter, no log, no metric, no guard. The system can hold plaintext credit-report PII indefinitely and every surface looks identical. | Confirm `/api/admin/encrypt-letters` and `/api/admin/encrypt-reports` have run. `.ai/CURRENT-STATE.md:151-153` records this as **NEEDS CONFIRMATION**. | `lib/docCrypto.ts:83`, `app/api/admin/encrypt-reports/route.ts:18` |

---

## 4. Subsystem records

Each record: **status · completion · remaining · acceptance · validation · failure scenarios ·
rollback · risk · blocker**.

### 4.1 Authentication — SHIPPED (UNVERIFIED) · High · Blocker: **No**

**Status.** NextAuth v4, single Credentials provider, stateless JWT (`lib/auth.ts:19`). Two rate-limit
buckets (10/15min per identifier, 30/15min per IP) fire **before** the user lookup and before
`bcrypt.compare`. IP is taken from platform-set `x-real-ip` first, so a spoofed `x-forwarded-for`
cannot mint a fresh bucket. The JWT stores **only** `uid` — role is never cached, so every privilege
decision re-reads the DB. `currentUserOrDemo()` returns null when `NODE_ENV === "production"`. Reset
tokens are single-use, sha256-at-rest, 1-hour TTL. `scripts/session-security.test.ts` passes 11/11.

**Remaining.** (a) Registration accepts `z.string().min(8)` and nothing else, while `lib/password.ts:5-13`
defines the real policy — min 10, complexity, plus a blocklist containing `password` and `12345678`.
**Public signup accepts the exact strings the repo blocklists elsewhere.** (b) No session revocation on
password reset — `scripts/session-security.test.ts:63-64` *asserts the gap persists*. (c) No `maxAge`
→ NextAuth's 30-day default. (d) The rate limiter **fails open on any DB error**, so every auth
throttle vanishes during a Prisma incident. (e) No MFA, no account lockout.

**Acceptance.** Registration rejects `password` and any string failing `validatePassword` · a password
reset invalidates pre-existing JWTs · `session.maxAge` is explicitly configured and documented · the
11th sign-in attempt in 15 min is refused before `bcrypt.compare`.

**Validation.** `npx tsx scripts/session-security.test.ts` → 11 passed · `bash scripts/release-verify.sh
https://www.creditvector.app` → `/api/letters` 401, `/api/admin/overview` 403 · register with
`"password"` → expect 400 (**currently 200**) · `npx vercel env ls production | grep NEXTAUTH_SECRET`
→ exactly one row.

**Failures.** A phished user resets their password; the attacker's JWT survives up to 30 days with
read access to encrypted reports, letters and uploaded ID documents. Only an ADMIN `disabled=true`
evicts them — and per **B-11** that does not reach the admin surface. · During a DB incident the
brute-force throttle disappears entirely.

**Rollback.** Auth changes are additive and independently revertable. Password-policy tightening is
forward-only (existing hashes unaffected). Adding `sessionsValidFrom` invalidates all live sessions
once — schedule off-peak and communicate.

### 4.2 Authorization — PARTIAL · **Critical** · Blocker: **YES** (B-03, B-11, C-01)

**Status.** The dominant pattern is correct: `currentAccount()` resolves strictly by session **id** and
re-checks `disabled` fail-closed (`lib/session.ts:21,30`). Per-resource `userId` scoping, agency-
workspace isolation and impersonation are implemented and read correctly. 36 of 38 admin routes call
`requireAdmin()`; the two that do not are justified.

**Remaining.** Three billing routes authorize by email (**B-03**) · `requireAdmin()` ignores `disabled`
and `isAdmin()` matches by email (**B-11**) · a **fourth** auth path exists that the route taxonomy does
not model: static shared secret, one accepted in a query string (**C-01**) · **no guard sweeps
`app/api/**/route.ts` for a missing auth check** — all 70 guards name specific files, and only two walk
the filesystem at all, both for unrelated patterns.

**Acceptance.** Zero routes resolve identity from `session.user.email` · `requireAdmin()` returns false
for `disabled` ADMINs · no route accepts a secret via query string · a new guard fails CI when any
route under `app/api/` lacks an auth call.

**Validation.** `grep -rn "session?.user?.email" app/api --include=route.ts` → **expect zero** ·
`grep -rn "searchParams.get(\"secret\")" app/api` → expect zero · disable a test ADMIN, replay their
cookie against `/api/admin/overview` → expect 403.

**Failures.** Subscriber changes email → portal 400 → cannot cancel → chargeback and a
negative-option complaint. · Released email re-registered → stale JWT opens a stranger's billing
portal. · A suspended admin retains production access for up to 30 days.

**Rollback.** All fixes are ~4 lines per route substituting an existing helper. Revert is a git revert;
no data migration, no schema change.

### 4.3 Organizations — DORMANT (FLAG) · Medium · Blocker: **No**

**Status.** Two things carry the name. The **live** model has no organization entity: an "agency" is a
`User` row with `isAgency=true`, members point back via the `managedByAgencyId` self-FK
(`prisma/schema.prisma:89-97`). The **durable** `Organization` / `OrganizationMembership` /
`OperatorIdentity` layer is behind `OPERATOR_IDENTITY_ENABLED` (default OFF), has **zero HTTP surface**,
zero importers in `app/` or `components/`, and — per `.ai/CURRENT-STATE.md:20` — **its tables are not in
production at all** (Gate D unexecuted). Four independent fail-closed layers.

**Remaining.** `app/pricing/PricingTiers.tsx:166` advertises **"Team members: Unlimited"** for Scale and
Enterprise while **no multi-seat mechanism exists in production**. Exposure is bounded because Scale is
"Coming soon" and Enterprise is contact-sales. · `STAFF_USER_LIMIT` is declaration-only. ·
`lib/entitlements.ts:42-56` is an alternate flag-gated resolver that **diverges on grandfathering**.

**Acceptance.** No pricing surface advertises a seat capability with no enforcement path, or it is
labeled "Coming soon" · flags remain OFF and `scripts/identity-migration-guard.test.ts` stays green.

**Validation.** `npx vercel env ls production | grep OPERATOR_IDENTITY` → expect absent or `false` ·
`npx tsx scripts/identity-migration-guard.test.ts`.

**Rollback.** Nothing to roll back — the layer is dormant. Do not enable during RC1.

### 4.4 Client capacity enforcement — SHIPPED (UNVERIFIED) · High · Blocker: **YES** (misrepresentation)

**Status — this is the strongest enforcement code in the audit.** Creation is gated inside one
transaction that takes a `SELECT ... FOR UPDATE` row lock on the agency's own `User` row, then counts,
then inserts (`app/api/agency/clients/route.ts:126-146`). The comment documents the exact race it
closes (two concurrent creations at 14/15). Existing clients above a cap are never locked or deleted;
grandfathering is preserved by effective date. `managedByAgencyId` has **exactly one** assignment in
non-test code. `scripts/agency-capacity.test.ts` passes 40/40.

**Remaining — the enforcement is right; the copy is wrong.** `app/billing/page.tsx:169` renders
**"up to 40 active client workspaces"** while the enforced Agency Pro cap is **30**
(`lib/agencyCapacity.ts:27`). The same defect appears on the LIVE $399/mo agency dashboard
(`app/agency/page.tsx:462-466`). **This is the identical regression the repo already ratified once** —
`scripts/agency-capacity.test.ts:96-97`: *"The pricing page advertised 40/100 while the resolver
enforced 30/50 — a buyer would have been sold capacity the server would not honor."* The guard was
then pinned to `PricingTiers.tsx` **only**, so the same defect walked into two unguarded surfaces.
Separately, **disabling a client does not free a seat** — the count has no `disabled: false` filter.

**Acceptance.** Every capacity string on every surface equals `resolveAgencyCapacity` output · the
guard reads `app/billing/page.tsx` and `app/agency/page.tsx`, not just the pricing page · seat
accounting and the disable lever agree.

**Validation.** `npx tsx scripts/agency-capacity.test.ts` → 40 passed · `grep -rn "up to.*workspace\|
'40'\|'100'" app/billing/page.tsx app/agency/page.tsx app/pricing/` → every number traced to the
resolver · create clients to the cap → expect 409 with the honest limit.

**Failures.** An Agency Pro buyer at $399/mo is told 40 workspaces and refused at 31 — sold capacity
the server will not honor, on a live paid tier.

**Rollback.** Copy-only change; revert is a git revert. **Do not "fix" by raising the cap** — that
changes sold entitlements and requires an ADR.

### 4.5 Billing · Stripe · Subscription lifecycle — PARTIAL · **Critical** · Blocker: **YES**

**Status.** Stripe is LIVE (`sk_live`). Webhook signature verification is correct and fail-closed —
missing signature 400, `constructEvent` failure 400 with `reportError`, handler error 500 so Stripe
retries. Letter-pack credits **are** genuinely idempotent via the `StripeWebhookEvent` ledger inside a
transaction. Entitlements are centralized and the JWT caches only `uid`, so a revoked plan takes
effect on the next request. Checkout/portal/cancel exist. `scripts/checkout-guard.test.ts` and
`checkout-consent.test.ts` are CI-enforced.

**Remaining — eight distinct money defects.** B-01 meter bypass · B-02 wrong-plan coercion and
fail-open tier derivation · B-03 email authorization · B-04 no idempotency/ordering + blind
`past_due` · B-06 no ToS anywhere · Round 2 letters **never decrement credits**
(`app/api/letters/[id]/round2/route.ts:111-124`) · credits can be driven **negative** and the negative
balance silently eats a future purchase (`app/api/letters/generate/route.ts:173-176`, no `where` guard,
no clamp) · `getOrCreateStripeCustomer` wraps `customers.retrieve` in a **bare catch** whose comment
assumes wrong-mode/deleted, so a transient 429/500 creates a **second Stripe customer** and re-opens
the known double-billing defect (`lib/billing.ts:14-21`) · **two sources of truth** for "is this
paying?" — `lib/billing.ts:42` hardcodes the active-state array instead of importing
`ACTIVE_SUBSCRIPTION_STATES`, and the hardcoded copy is the one that writes money · no `apiVersion`
pin on the Stripe client (`lib/stripe.ts:12`) · only 3 of 7 tiers have live checkout · no dunning.

**Acceptance.** Letter usage is an **immutable ledger**, not a row count · unknown plan → 400, never a
silent tier · every webhook handler is idempotent and ordering-safe (event-id ledger + `updated_at`
comparison) · `past_due` is written only for subscription invoices · credits never go negative · one
imported constant defines active states · ToS acceptance recorded at registration **and** on every
paid transition including in-place upgrade · Stripe `apiVersion` pinned · every tier shown as
purchasable completes checkout.

**Validation.** Stripe CLI replay of a captured `customer.subscription.updated` **twice** → entitlement
identical, one ledger row · replay `deleted` then `updated` out of order → plan stays revoked ·
`POST /api/stripe/checkout {"plan":"agency_pro"}` → expect **400** (currently charges $99) · generate 3
free letters, delete all 3, generate again → expect **402** (currently succeeds) · trigger
`invoice.payment_failed` on a letter-pack invoice → subscriber status unchanged · `grep -n
"apiVersion" lib/stripe.ts` → expect a pin.

**Failures.** Unlimited free letters at full Anthropic cost. · A $699-tier buyer charged $99 and
provisioned Professional. · A reordered webhook restores a cancelled subscriber's paid access, or
revokes a paying one. · A transient Stripe error double-bills $498/mo. · A cancelling customer cannot
reach the portal (B-03) → chargeback.

**Rollback.** Webhook idempotency is additive (~6 lines) and safe to revert. The usage-ledger change
is a **schema addition** — migration-first per `CLAUDE.md`, with preflight, forward-validation and a
documented rollback; ship it as a deliberate release step, never in the build. Plan-coercion and
constant-unification are pure logic reverts. **Reverting the ToS field after collection begins loses
consent evidence — treat as forward-only.**

### 4.6 Credit report workflow — PARTIAL · High · Blocker: **YES** (B-08)

**Status.** The path is wired end to end: `POST /api/reports/upload` authenticates, rate-limits 20/hr,
caps PDFs at 15 MB, extracts text, **encrypts with AES-256-GCM before persistence**, then parse →
analyze → tradelines → scoring. An independent sweep of every `prisma.report.*` call site confirmed
**every** read of `rawText` goes through `decryptText` — **no plaintext leak path exists**.

**Remaining.** **B-08 re-analysis orphans all prior letters and destroys furnisher contacts.** ·
`Report`, `Tradeline` and `Letter` carry **no `@@index` at all**, while ~30 sibling models do — Prisma
does not auto-create FK indexes on Postgres, so the hottest queries in the product are unindexed. ·
`app/journey/page.tsx:75` and `lib/kaiHome.ts:186` call `findMany` with **no `select`**, pulling ~670 KB
of ciphertext per row across Accelerate on a page render. · **Zero entitlement checks** anywhere in
`app/api/reports/` — both routes call paid Anthropic inference with no plan gate. · The only
server-side upload check is `size > 15MB`; there is **no content-type check and no magic-byte sniff**
(the MIME check lives only in the client) although `.ai/SECURITY.md:13` documents sniffing. ·
`/api/reports/analyze` has no `maxDuration` and serially re-analyzes **all** the user's reports. ·
The `encrypt-reports` backfill loads **every** consumer's ciphertext into one function with no
pagination or resume (**C-02**).

**Acceptance.** Re-analysis preserves letter↔tradeline linkage (or refuses and explains) · indexes
exist on `Report.userId`, `Tradeline.reportId/userId`, `Letter.userId/tradelineId` · every `findMany`
on `Report` uses an explicit `select` · uploads are magic-byte sniffed server-side · report AI routes
carry an entitlement check.

**Validation.** Upload → generate a letter → re-analyze → confirm the letter still resolves its
tradeline (**currently fails**) · `npx prisma db pull` and confirm the four indexes · upload a `.exe`
renamed `.pdf` → expect 4xx · `grep -rn "entitlement" app/api/reports/` → expect non-zero.

**Rollback.** Index creation is additive and online-safe (`CREATE INDEX CONCURRENTLY`), reversible
with `DROP INDEX`. Re-analysis linkage is a logic change; ship behind a guard test that fails on
orphaned letters. **The orphaning already done is not reversible** — old tradeline ids are gone.

### 4.7 Letter generation · Response Intelligence — PARTIAL · High · Blocker: **YES** (B-05)

**Status.** Generation is real, authorized, rate-limited 40/hr, tradeline lookups are `userId`-scoped,
recipient resolution falls back to the parsed furnisher contact, and output is compliance-scrubbed and
encrypted at rest. `scripts/letter.test.ts` covers the compliance path. §605 obsolescence math is
deterministic and guard-covered. This is mature code.

**Remaining.** **B-05 — the scrubber has no score-improvement rule at all**, the single most important
CROA prohibition the company has declared. · Round 2 never decrements credits (§4.5). ·
**ADR-0005 fencing violation:** `lib/round2.ts:51-57` injects fully consumer-supplied response text —
pasted, or extracted from a 15 MB PDF — into the user turn **without the untrusted fence**
`CLAUDE.md` gotcha #5 makes mandatory. · Response analysis is a **declared paid capability**
(`credit.response.analyze`, the very axis that *defines* premium) yet `app/api/letters/[id]/response/`
performs **no entitlement check** — a free account gets it. · AI spend is unattributed
(`meteredMessage('response-analysis', null, ...)` — `userId` hardcoded null). · `encryptText` sits
outside any try/catch, so a missing key throws an unhandled 500. · `docCryptoReady()` → 503 is
implemented in `app/api/documents/route.ts:49` but **not applied** to letter routes.

**Acceptance.** `applyCompliance("this will raise your score 100 points")` **flags** · every prompt
taking consumer text carries the ADR-0005 fence · response analysis enforces the paid capability · all
AI calls attribute `userId` · a guard asserts the score rule exists.

**Validation.** `npx tsx -e "import {applyCompliance} from './lib/compliance'; console.log(applyCompliance('guaranteed 100 point score increase').flags)"` → expect non-empty (**currently empty**) ·
`npx tsx scripts/letter.test.ts` · free account → `POST /api/letters/[id]/response` → expect 402.

**Failures.** A letter or community post promising a score increase ships unflagged, while the admin
compliance view reports the rule set as complete — **a CROA exposure the control was built to prevent,
with a false assurance on top.** · A crafted response PDF redirects the analysis model.

**Rollback.** Adding compliance patterns is additive; **it may retroactively flag existing content** —
run a report before enabling and review flagged rows with the CCO. Fencing and entitlement checks are
independently revertable.

### 4.8 Kai — PARTIAL · High · Blocker: **YES** (moderation bypass)

**Status.** Conversational Kai is wired end to end through two community routes, both gated by
`requireCommunityAccount()` (premium-only), rate-limited 20/hr, prompt-injection fenced
(`sanitizeForPrompt`, explicit UNTRUSTED markers, spoof-stripping) with `scripts/kai-sanitize.test.ts`
8/8 and `kai-manifest.test.ts` 44/44. Output passes `applyCompliance`. Cost is metered via `aiMeter`.

**Remaining.** **Moderation bypass:** `ask-kai` never checks `thread.locked`, though the sibling reply
route does — and lock is the only non-destructive moderation action available. The "Ask Kai" button
renders unconditionally on locked threads. · **Kai's own replies are never run through
`screenCommunityText`.** · `max_tokens: 2000` with adaptive thinking enabled means thinking and text
share one budget; on exhaustion the canned "Kai hit a snag" is **written to the database as a
permanent reply**. · No idempotency — 20 Kai replies can be appended to one thread. · The thread row is
created **before** the AI call, so a 60s timeout leaves an orphaned thread and a 504. · `past_due`
accounts retain access, so a delinquent account consumes uncapped Opus spend.

**Acceptance.** `ask-kai` refuses on a locked thread for non-admins · Kai output passes the same screen
as member output · `max_tokens` gives real headroom beyond the thinking budget · failure does not
persist a canned reply · one Kai answer per thread unless an admin re-summons.

**Validation.** Lock a thread → `POST .../ask-kai` as a member → expect 4xx (**currently succeeds**) ·
`grep -n "screenCommunityText" app/api/community/threads/[id]/ask-kai/route.ts` → expect a hit ·
`npx tsx scripts/kai-sanitize.test.ts`.

**Rollback.** All changes are route-local. The `max_tokens` change is a config value — revert freely.

### 4.9 Error handling · Logging · Monitoring — PARTIAL / **Critical** · Blocker: **YES** (B-10)

**Status.** `app/error.tsx` and `app/not-found.tsx` exist. `lib/log.ts` is a zero-dependency JSON-lines
logger. `lib/observability.ts` is a provider-agnostic hook that **always** structured-logs and never
throws. `/api/health` (DB-free liveness) and `/api/health/ready` (503 on DB failure) are correct.
`scripts/observability.test.ts` is real, 18 assertions, and **CI-enforced**.

**Remaining.** **B-10 in full.** Additionally: no `app/global-error.tsx`, so a throw in `RootLayout`
is uncatchable · `middleware.ts` has no try/catch and no `reportError` — a `getToken` failure yields
an unbranded edge 500 on the marketing homepage that no boundary can intercept · `syncSubscriptionToUser`
returns silently when no user matches, and the webhook answers 200, so Stripe never retries and the
event is lost with **no log line** · the webhook 503 path (missing secret) emits **nothing**, so a
rotated secret silently breaks every entitlement event indefinitely · only 3 files import `requestId`,
and the webhook — the most incident-prone route — is not one · `LOG_LEVEL` is in neither
`.env.example` nor the diagnostics `EXPECTED_ENV` list · **zero auth/security logging**: no sign-in
failure, lockout, or impersonation events, though an ADMIN can act as another user.

**Acceptance.** `ALERT_WEBHOOK_URL` set and a **drill alert has actually fired** · cron liveness
asserted (a run that does not happen alerts) · `prod-health.sh` treats 404 as failure · `global-error.tsx`
exists · every 5xx and every silent-return path calls `reportError` with a `requestId` · impersonation
is logged.

**Validation.** `npx vercel env ls production | grep ALERT_WEBHOOK_URL` → expect one row · force a
handled error and confirm the message arrives at the destination — **a drill, not a config read** ·
`npx tsx scripts/observability.test.ts` → 18 passed · confirm today's cron rows exist and that a
skipped run alerts.

**Failures.** A rotated webhook secret breaks all entitlement sync; no alert, no log; discovered by a
customer. · A bad deploy 404s a route and the health probe scores green. · Worst-case detection ≈ 24h
via a GitHub issue.

**Rollback.** Every item is additive. Setting `ALERT_WEBHOOK_URL` is env-only — revert by unsetting.

### 4.10 Security — PARTIAL · High · Blocker: **YES** (B-07, C-01, C-02)

**Status.** Real controls, several guard-pinned. AES-256-GCM in `lib/docCrypto.ts`, encrypt-on-write
across all six PII paths (documents, attachments, reports, letters, identity docs). Six security
headers with 2-year HSTS. Tenant isolation. Prompt-injection fencing. **SSN is never stored.**
Sign-in throttling before bcrypt.

**Remaining.** B-07 demo-seed credential exposure · C-01 query-string secrets · C-02 silent plaintext
fallback · **rate limiting covers 24 of 117 routes (~21%)** and **fails open** · the **identity-document
upload path — gov ID, SSN card, proof of address — has no rate limit at all**, though every sibling PII
route does · `bootstrap` uses non-constant-time `!==` with no rate limit · no MFA · no pen test ·
`Dockerfile:13` still runs `npx prisma db push --skip-generate` on container start, conflicting with
MIGRATION-FIRST (external use **UNKNOWN**) · `lib/rateLimit.ts:12-14` and `lib/passwordReset.ts:10-12`
still assert in-code that `db push` does not work through Accelerate — **`CLAUDE.md` gotcha #1 records
that premise as FALSE**, so the comments justifying the self-heal posture rest on a corrected belief.

**Acceptance.** No unauthenticated endpoint returns credentials or mutates data · every mutating, AI,
auth and PII route is rate-limited · the limiter **fails closed** on auth routes · plaintext-at-rest is
countable and reported · no query-string secrets · `Dockerfile` performs no schema mutation.

**Validation.** `curl https://www.creditvector.app/api/demo/seed` → expect 404/403 (**currently returns
credentials**) · `grep -rLn enforceRateLimit app/api/documents/route.ts` → expect rate limiting present ·
admin readout of rows whose ciphertext lacks the `cv1:` prefix → expect **0** · `npm audit --production`.

**Rollback.** Deleting or env-guarding `/api/demo/seed` is a one-line revert. Rate-limit additions are
per-route. **Fail-closed limiting is a behavior change — stage it on auth routes first and watch the
401/429 ratio.**

### 4.11 Backup & recovery — ABSENT · **Critical** · Blocker: **YES** (B-09)

**Status.** `OPERATIONS.md:70-107` is an honest, well-written, ready-to-run procedure that states its
own blocked status: the origin provider behind Accelerate is unconfirmed, so RPO/RTO **cannot be
stated** and are deliberately left blank rather than guessed. The single Postgres database is the
entire system of record; encryption keys live only in Vercel env, and the doc correctly places the
env-var set in backup scope.

**Remaining.** Confirm the provider (≤15 min, owner) · **run the restore drill** · record measured RPO
and RTO · escrow `DOCUMENT_ENCRYPTION_KEY` and `NEXTAUTH_SECRET` outside Vercel. Two documentation
defects would make a drill under-verify: `OPERATIONS.md:104-107` still assumes **self-heal DDL** applies
the schema, superseded by MIGRATION-FIRST; and `.ai/CURRENT-STATE.md:15` records that production has
**no `_prisma_migrations` history**, so `migrate deploy` alone would fail on `0_init` — **the repair path
after a restore is itself unproven.** Backup appears in **none** of the six "Pending OWNER actions".

**Acceptance.** Provider named in writing · a restore to a throwaway DB **succeeded** · an encrypted
`Report.rawText` **decrypted** with the production key from the restored copy (proves data + key
together) · measured RPO/RTO written into `OPERATIONS.md` · keys escrowed · the post-restore migration
repair path is documented **and tested**.

**Validation.** Execute `OPERATIONS.md:88-99` steps 1-5 verbatim and record the numbers.
**No substitute exists. A backup that has never been restored is a hypothesis.**

**Rollback.** N/A — the drill is read-only against a throwaway copy. **Do not drill against production.**

### 4.12 Consumer dashboard · Agency dashboard — SHIPPED (UNVERIFIED) / PARTIAL · High–Critical · Blocker: **YES** (agency)

**Status.** The consumer dashboard is one 97-line server component with a route-level skeleton,
authenticating via `currentUserOrDemo()` (null in prod). Empty states exist and are coherent. The
agency workspace, roster, and client selection are real.

**Remaining — agency side.** Opening a consumer's workspace sets a 12h httpOnly cookie granting full
authority over that consumer's file and writes **no log, no event, no audit row** — verified absent ·
the workspace cookie is **never cleared on sign-out**, so signing out with a client open and back in
silently re-enters that consumer's workspace · **no consent or authority artifact** is recorded when an
agency creates a managed consumer with a real person's name and postal address · `/api/agency/enable`
grants a paid entitlement with no rate limit · `app/agency/page.tsx:389` renders a KPI labeled
**"Accounts Deleted"** between "Letters Generated" and "Clients Added" — in that context an operator
reads it as deleted **tradelines**, a credit-repair outcome claim, and it is **compliance-sensitive
copy on a live paid surface** · `try/finally` with no `catch` in two handlers → silent failure ·
`lib/billing.ts:66` is the only automatic writer of `isAgency=false` and there is **no reconciliation
sweep**. **Consumer side.** Four separate loads of the same user's tradelines per render despite a
comment claiming one; `knowledge/loader.ts:17-20` fails open to `[]`, so a DB fault renders a case
with zero campaigns and zero verified outcomes — **indistinguishable from a genuinely empty case**.

**Acceptance.** Every workspace entry writes an audit row (actor, subject, time) · the cookie clears on
sign-out · managed-client creation records a consent artifact · "Accounts Deleted" is removed or
CCO-approved · loaders distinguish "empty" from "failed".

**Validation.** Select a client → query the audit table → expect a row (**currently none**) · sign out
and back in with a client open → expect the consumer's own workspace · `grep -n "Accounts Deleted"
app/agency/page.tsx` → expect zero after fix.

**Rollback.** Audit logging is additive. Cookie clearing changes session behavior — verify agency
flows before and after. Copy removal is trivially revertable.

### 4.13 Tasks — SHIPPED (UNVERIFIED) · Medium · Blocker: **No**

**Status.** There is **no task persistence anywhere** — no Mission/Task model. Every "task" is
recomputed per request from letters, campaigns, tradelines, score entries and the outcome ledger.
`assembleMission` is a pure deterministic composition covered by `scripts/missionControl.test.ts` and
`missionEngine.test.ts`. **This is a legitimate design choice** (projection over state), not a gap.

**Remaining.** Recomputation is expensive and duplicated (§4.12) · `/api/execution` re-runs the entire
fan-out standalone while claiming "ZERO new database calls" · no entitlement gate on the three routes ·
no guard exercises blocked/locked/in-progress states, so those paths have never been executed.

**Acceptance.** Guards cover every `MissionState` · the fan-out is loaded once per render · route
comments match measured behavior.

**Validation.** `npx tsx scripts/missionEngine.test.ts` · count queries on one dashboard render.

**Rollback.** Pure-function changes, fully revertable.

### 4.14 Notifications — PARTIAL · High · Blocker: **YES** (false capability claims)

**Status.** Web push subscribe/unsubscribe exist with endpoint-safety validation. Resend is live from a
verified domain. `notify.plan` is a **decision-only** kernel capability — ADR-0027 shipped the decision
and deliberately **not** the effect, correctly gated behind the CCO.

**Remaining.** **`app/settings/page.tsx:341` promises, in Kai's voice, to every user: "Turn this on and
this device can receive my alerts when something on your account needs you."** No such alert path
exists — `notify.plan` composes and does not send. **`:352-367` promises a weekly Brief digest** and the
button reads "Subscribed — weekly digest on" once flipped, while the digest **sends nothing** until
`COMPANY_POSTAL_ADDRESS` is set (CAN-SPAM footer). **Two live, user-facing false capability claims,
shown to every user with no admin gate.** · `/api/push/subscribe` has an unhandled throw (malformed
endpoint → unbranded 500) and **no rate limit**, so one account can insert unbounded rows ·
`lib/email.ts:31` falls back to `onboarding@resend.dev`, which its own comment says **delivers only to
the Resend account owner** · the digest sends **serially**, one awaited POST per recipient with an 8s
timeout inside a 60s function — it will truncate silently at modest list size · `lib/briefDigest.ts:15-21`
runs `ALTER TABLE` from three request paths.

**Acceptance.** Every capability the settings page claims either works or is labeled "Coming soon" ·
`COMPANY_POSTAL_ADDRESS` set and a test digest **received** · push subscribe is rate-limited and handles
malformed endpoints · `RESEND_FROM` is set in production · digest sends batched with a resume path.

**Validation.** `npx vercel env ls production | grep -E "COMPANY_POSTAL_ADDRESS|RESEND_FROM"` → expect
two rows · subscribe to the digest and confirm **receipt** · `POST /api/push/subscribe` with a
malformed endpoint → expect 4xx, not 500.

**Rollback.** Copy changes are trivial. Setting env vars **activates** sending — verify the CAN-SPAM
footer renders before the first real send; that send is not reversible.

### 4.15 Community · Arena — PARTIAL / DORMANT · High / Medium · Blocker: **YES** (community)

**Status.** The forum is genuinely live and code-complete: seven routes all gated by
`requireCommunityAccount()` (premium-only), every write path CROA-screens **before** the DB write and
returns 422 on violation, with moderation queue and post-moderated comments. Guards:
`community-screen`, `brief-comment`, `brief-react`, `youtube` (host-allowlist/spoof defense, 25/25).
**Arena and Operator Reputation are DORMANT** — `ARENA_ENABLED`, `OPERATOR_NETWORK_ENABLED`,
`OPERATOR_REPUTATION_ENABLED`, `EVENT_BUS_ENABLED` all require `=== "true"` and are unset. Correctly
fail-closed.

**Remaining.** The `ask-kai` moderation bypass and unscreened Kai replies (§4.8) · **attachment
failures are swallowed** — a member who attaches bureau evidence gets `{ok:true}` and a post with no
attachment · **no account-deletion or data-erasure path exists anywhere in `app/api`**, and
`scripts/consumer-deletion-containment.test.ts` **actively prohibits** hard-deleting a User, while
`authorName` is a permanent snapshot — a CCPA/CPRA right-to-delete request currently has **no mechanism
at all** · three community tables are created by runtime self-heal DDL whose justifying comment cites
the premise `CLAUDE.md` gotcha #1 records as **FALSE**.

**Acceptance.** Locked threads reject all non-admin writes including Kai · attachment failure surfaces
to the user · a documented erasure path exists (manual with a counsel-approved SLA is acceptable for
RC1; **silence is not**) · Arena/Network flags confirmed OFF in production.

**Validation.** `npx vercel env ls production | grep -E "ARENA_ENABLED|OPERATOR_NETWORK_ENABLED|
OPERATOR_REPUTATION_ENABLED|EVENT_BUS_ENABLED"` → expect **absent or false** · post with an oversized
attachment → expect an error, not `{ok:true}`.

**Rollback.** Community fixes are route-local. **Do not enable any dormant flag during RC1** — Gate D is
unexecuted and the backing tables are not in production.

### 4.16 Mobile · Accessibility · Performance — PARTIAL · High · Blocker: **YES** (accessibility)

**Status.** A real mobile shell exists: `Sidebar` (hidden below md) plus a fixed bottom `MobileNav`
with 4 destinations and a slide-up drawer; `<main>` clears the bar. 61 of 125 `.tsx` files use
breakpoints. PWA manifest and install/push are wired. `next/image` is used. Multiple documented
contrast/focus/target passes have happened; `scripts/operator-shell.test.ts` pins some of it.

**Remaining — accessibility is the blocker.** **79 form controls (56 inputs, 11 selects, 12 textareas)
and only 14 `htmlFor` associations repo-wide** — most inputs are programmatically unlabeled (WCAG 1.3.1 /
3.3.2 Level A). · `public/manifest.json:9` sets `"orientation": "portrait-primary"`, hard-locking the
installed PWA to portrait — **WCAG 1.3.4 Level AA failure**, and landscape is exactly the mode low-vision
users choose for larger text. · `app/globals.css:123` scopes the focus ring inside `:where()`, giving it
**zero specificity**, so utility classes override it — the visible focus indicator is not reliably
applied. · `app/admin/audit/page.tsx:40` wraps a table in `overflow-hidden`, which **clips instead of
scrolls** — unreachable content on narrow screens. · No safe-area insets, so iOS home-indicator overlaps
the tab bar and the drawer's own Log-out button. · **No automated a11y test and no performance budget
exist.** · Repo-wide, **61 of 65 `findMany` calls carry no `take:`**.

**Acceptance.** Every input has a programmatic label · orientation lock removed · focus-visible has
real specificity and is verified on a utility-styled control · no `overflow-hidden` around a wide
table · safe-area insets applied · an automated a11y check runs in CI · every list query is bounded.

**Validation.** `npx @axe-core/cli https://www.creditvector.app/login /register /upload /letters
/billing /dashboard` → expect **zero** serious/critical · Lighthouse a11y ≥ 95 on those routes · install
the PWA and rotate to landscape → expect it to rotate · tab through a form and confirm a visible ring.

**Rollback.** Label and markup fixes are additive with no behavior change. Removing the orientation lock
is one manifest key. The focus-ring specificity fix is CSS-only — **verify it does not double-ring**
controls that already style focus.

---

## 5. Cross-cutting findings

**X-1 — Guards are pinned to files, not to properties.** The capacity-copy regression
(`scripts/agency-capacity.test.ts:96-97`) was found once, ratified as a regression, then guarded
against **`PricingTiers.tsx` only** — and the identical defect immediately reappeared on two unguarded
surfaces. Similarly, **no guard sweeps `app/api/` for missing auth**, and none asserts the compliance
rule set is complete. **Guard the invariant, not the file that violated it last time.**

**X-2 — Rate limiting fails open, everywhere, by design.** `lib/rateLimit.ts:72-75` returns `{ok:true}`
on any error. A database incident therefore **simultaneously** removes brute-force protection from
sign-in, removes AI cost control, and is invisible to a DB-blind health probe. Fail-open is defensible
for a UX throttle; it is not defensible for the auth and spend throttles.

**X-3 — Stale comments assert corrected beliefs.** At least four files still state that
`prisma db push` does not work through Accelerate — the premise `CLAUDE.md` gotcha #1 records as
**FALSE** and as the cause of an armed data-loss path. The self-heal security posture is justified
in-code by a belief the constitution has retracted.

**X-4 — The UI sells capabilities that do not exist.** Push alerts, weekly digest, "Unlimited team
members", "up to 40 workspaces", "Accounts Deleted". Each is individually small; together they are a
**pattern of the interface over-promising the runtime**, which on a consumer-finance product is the
exact posture `lib/compliance.ts` exists to prevent.

**X-5 — Documentation drift.** `OPERATIONS.md` still describes the superseded self-heal schema model.
`.env.example` lists a deleted `SETUP_SECRET` and omits `COMPANY_POSTAL_ADDRESS` and `LOG_LEVEL`.
`.ai/TESTING.md` tabulates 15 guards and CI advertises 31; **there are 70**. `.ai/CURRENT-STATE.md`'s
"Pending OWNER actions" omits the backup drill — the repo's own P0.

**X-6 — What is genuinely strong, and should not be disturbed.** Client-capacity enforcement (atomic
`FOR UPDATE`), encryption at rest with no plaintext leak path, Kai prompt-injection fencing, the §605
obsolescence engine, tenant isolation, the 70-script guard suite, CI Gate D preflight, the
decision-vs-effect discipline in `notify.plan`, and the honesty law in `lib/platform/health.ts`.
**This is a well-engineered product with an unfinished commercial envelope.**

---

## 6. VERIFICATION REQUIRED — cannot be answered from the repository

**None of these may be marked complete without a live check. None is an assumption.**

| # | Question | How to verify |
|---|---|---|
| V-01 | Is `SETUP_SECRET` set in production? (governs **C-01**) | `npx vercel env ls production \| grep SETUP_SECRET`, or `/api/admin/diagnostics` |
| V-02 | Have `encrypt-letters` / `encrypt-reports` run? (**C-02**) | Admin readout of rows whose ciphertext lacks `cv1:` — expect 0 |
| V-03 | What is the origin DB provider behind Accelerate? (**B-09**) | Prisma Data Platform / Vercel Storage console (owner, ≤15 min) |
| V-04 | What are the real RPO and RTO? | Measured in the restore drill — **not estimated** |
| V-05 | Is `ALERT_WEBHOOK_URL` set, and has an alert ever fired? | Env check **plus** a live drill |
| V-06 | Are `COMPANY_POSTAL_ADDRESS` and `RESEND_FROM` set? | `npx vercel env ls production` |
| V-07 | Did today's crons actually run? | Query `BriefArticle` / digest rows for today's timestamps |
| V-08 | Are all dormant flags OFF in production? | `npx vercel env ls production \| grep -E "ARENA\|OPERATOR_\|EVENT_BUS\|MAIL_LIVE\|KERNEL_DURABLE\|CAPABILITY_PLATFORM"` |
| V-09 | Is GitHub branch protection requiring the CI check on `main`? | Repo settings — CI exists but **enforcement is owner-side** |
| V-10 | Is Vercel Pro purchased and Skew Protection enabled? | Vercel dashboard (was blocked on Hobby) |
| V-11 | Did the GitHub→Vercel auto-deploy integration get fixed? | `lib/platform/health.ts:63` records it silently failed once |
| V-12 | Is the `Dockerfile` `db push` path used anywhere externally? | Owner confirmation — recorded as **UNKNOWN** |
| V-13 | Are Stripe customer receipt emails enabled? | Stripe Dashboard → Customer emails |
| V-14 | Which of the 7 tiers are actually purchasable end to end? | Complete a live checkout per advertised tier |

---

## 7. The Go/No-Go gate

**Ship Version 1.0 when — and only when — every line is true.**

### Gate 1 — Legal (owner + counsel; the long pole, and not engineering)
- [ ] **B-12** Counsel sign-off obtained: CROA/FCRA positioning, news/defamation, ToS/Privacy/refund
- [ ] **B-06** ToS acceptance recorded at registration **and** on every paid transition (incl. in-place upgrade)
- [ ] **B-05** Compliance scrubber enforces the score bar; CCO gate GREEN on final copy and flows
- [ ] A data-erasure path exists and is documented (manual with a counsel-approved SLA is acceptable)

### Gate 2 — Money (nothing here may ship broken; billing is live today)
- [ ] **B-01** Letter usage is an immutable ledger; delete-to-reset is closed
- [ ] **B-02** Unknown plan → 400; `planForPrice` fails **closed**
- [ ] **B-03** Zero routes resolve identity by session email
- [ ] **B-04** Webhook handlers are idempotent and ordering-safe; `past_due` scoped to subscription invoices
- [ ] Round 2 decrements credits; credits cannot go negative; one imported active-state constant; Stripe `apiVersion` pinned
- [ ] **V-14** Every tier shown as purchasable completes a live checkout

### Gate 3 — Data (the asset that cannot be recreated)
- [ ] **B-09** Provider confirmed · restore drill **succeeded** · encrypted field decrypted from the restored copy · **measured** RPO/RTO recorded · keys escrowed · post-restore migration repair path tested
- [ ] **B-08** Re-analysis preserves letter↔tradeline linkage
- [ ] **C-02 / V-02** Zero rows hold plaintext PII
- [ ] Indexes exist on `Report`, `Tradeline`, `Letter`

### Gate 4 — Security
- [ ] **B-07** `/api/demo/seed` deleted or hard-guarded in production
- [ ] **B-11** `requireAdmin()` honors `disabled`; admin privilege resolves by id
- [ ] **C-01 / V-01** No query-string secrets on any route
- [ ] Registration enforces `validatePassword`; auth rate limits **fail closed**; identity-document upload is rate-limited
- [ ] Session lifetime explicitly configured; password reset revokes existing sessions

### Gate 5 — Operations
- [ ] **B-10** Alerting live and **proven by a drill** · cron liveness monitored · `prod-health.sh` treats 404 as failure · `global-error.tsx` exists
- [ ] **V-09** Branch protection requires the CI check on `main`
- [ ] **V-10** Vercel Pro + Skew Protection enabled
- [ ] **B-14** No user-facing copy claims a capability that does not work

### Gate 6 — Accessibility
- [ ] axe: zero serious/critical on login, register, upload, letters, billing, dashboard
- [ ] Every form control programmatically labeled · orientation lock removed · focus ring reliably visible
- [ ] An automated a11y check runs in CI

### Gate 7 — Scope
- [ ] **RC1-SCOPE-1** resolved: `lib/platform/health.ts:56` and `CREDITVECTOR_RC1_EXECUTION.md` agree on whether `MAIL_LIVE` gates 1.0
- [ ] All dormant flags confirmed OFF in production (**V-08**)
- [ ] `lib/platform/health.ts` READINESS updated to reflect the ratified decision

---

## 8. Recommended sequence

The critical path is **still counsel**, exactly as `CREDITVECTOR_RC1_EXECUTION.md` concluded — and the
engineering work below fits inside that window.

| Day | Work | Owner |
|---|---|---|
| **0** | Engage counsel (B-12) · confirm DB provider (V-03) · set `ALERT_WEBHOOK_URL`, `COMPANY_POSTAL_ADDRESS`, `RESEND_FROM` · buy Vercel Pro · enable branch protection · answer V-01, V-02, V-08 | **Founder** |
| **1** | **Gate 2 money defects** — B-01, B-02, B-03, credits, constants, `apiVersion`. Highest value per hour; each is small and independently revertable | Eng |
| **1–2** | B-07 demo-seed · B-11 admin revocation · registration password policy · C-01 if V-01 says set | Eng |
| **2–3** | **B-09 restore drill** (unblocked by V-03) · B-10 alert drill + cron liveness | Eng + Founder |
| **3–4** | B-04 webhook idempotency · B-08 re-analysis linkage · indexes | Eng |
| **4–5** | B-05 compliance score rule (**CCO review of retroactive flags**) · Kai moderation · agency audit logging | Eng + CCO |
| **5–7** | Accessibility sweep · X-1 guard hardening (auth sweep, capacity copy, compliance completeness) | Eng |
| **Counsel returns** | Apply required copy/flow changes → CCO gate → re-run all gates | All |
| **Gate review** | Every box in §7 ticked, with evidence | **Founder** |

---

## 8a. Execution Wave 1 — record (2026-07-28)

Six subsystems, strictly disjoint file ownership, **zero schema changes** (MIGRATION-FIRST keeps new
schema an owner-ratified release step). Every fix independently verified by a separate agent that
re-ran the guards and attempted a bypass; guards were proved non-vacuous by running them against the
pre-fix tree.

**18 files changed · 6 commits · 5 new guard scripts · 243 new checks.**

| Guard | Checks | Non-vacuity proof (run against pre-fix tree) |
|---|---:|---|
| `scripts/billing-integrity.test.ts` | 31 | 5 passed, **26 failed** |
| `scripts/stripe-lifecycle.test.ts` | 52 | breaking either invoice shape fails it |
| `scripts/billing-identity.test.ts` | 37 | fails if email-keyed identity returns |
| `scripts/compliance-bar.test.ts` | 90 | 71 passed, **19 failed** |
| `scripts/critical-paths.test.ts` | 33 | 9 passed, **24 failed** |

All pre-existing guards covering the changed subsystems still pass: `agency-capacity` 40/40,
`checkout-guard` 21/21, `checkout-consent` 11/11, `schema-safety` 17/17, `observability` 18/18.
`letter.test.ts` cannot execute here — it needs `@prisma/client`, and it fails identically at clean
HEAD, so this is environmental and pre-existing.

### Residual risks introduced by Wave 1 — stated plainly

1. **Webhook claim-then-handle window.** A Vercel timeout, OOM or instance kill between claiming an
   event and returning leaves the claim held, so Stripe's retry is deduplicated away and that event
   is permanently dropped. Narrower than the ordering bug it replaces, but new. A claim TTL or a
   completed-marker would close it.
2. **Re-analysis is now all-or-nothing** inside a 15s interactive transaction with a sequential create
   loop up to the parser's 150-row cap. It fails closed rather than corrupting data, but a very large
   report could time out where it previously wrote partial rows. **Needs production verification.**
3. **`planForPrice` now fails closed**, which converts a silent over-grant into a silent under-grant: a
   customer on a Dashboard-created, imported, promotional or metered price now keeps their existing
   plan instead of being handed premium. Correct, but it will surface as support tickets if such
   prices exist. **Owner should confirm the live catalog has no out-of-band prices.**
4. **Compliance rules can reject member posts that previously published**, because `applyCompliance`
   flags are a hard reject gate on community writes.
5. **A disabled-but-paying subscriber now gets 401 from the billing portal** and cannot self-cancel,
   because `currentAccount()` fails closed on `disabled`. Correct for security, but it means account
   suspension must be paired with a billing decision.

---

## 9. Status of this document

**Draft — not ratified.** It records the audit's considered position and may not be cited as a company
commitment until the owner ratifies it.

**It supersedes nothing.** `CREDITVECTOR_RC1.md` remains the readiness assessment;
`CREDITVECTOR_RC1_EXECUTION.md` remains the execution plan. Where this document and the 2026-07-15
assessment disagree on a subsystem's state, **this document is more recent and evidence-located** — but
the assessment's scoring method and weighting remain canonical and are not restated here.

**Re-run trigger:** these criteria are a snapshot of the repository at `e6d9b21`. Re-audit before the
gate review, and after any change to billing, auth, or compliance.

**Method note.** 26 subsystems were audited by 12 independent domain auditors, and every finding was
re-checked by a separate verifier instructed to refute it and to open every cited `file:line`. That
pass **downgraded** several subsystems the auditors had marked shipped, corrected off-by-one citations,
and found the majority of the defects in §3 — including B-01, B-05, B-08 and B-11, which the first pass
missed entirely. Findings that did not survive verification were dropped. **No finding in this document
rests on a single unreviewed opinion, and no subsystem is marked complete because a file exists.**

---

*Prepared under [Knowledge Architecture 1.0](knowledge/ARCHITECTURE.md) §5 rank 1: production truth
cannot be overridden by any document. Where this document and the running system disagree, the system
is right and this document is wrong.*
