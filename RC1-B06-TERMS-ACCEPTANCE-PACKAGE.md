# RC1 · B-06 — Durable terms acceptance on the paid upgrade path

**Owner decision package.** Status of the code: written, guard-verified, **NOT applied to any
database and NOT deployed.** Nothing in this change can reach production without the explicit
release step below.

---

## 1. The defect (VERIFIED, repository evidence)

`CONSENT_COLLECTION` in `app/api/stripe/checkout/route.ts` is spread into exactly two
`stripe.checkout.sessions.create` calls (letter pack, new subscription). The in-place plan
upgrade calls `stripe.subscriptions.update` and never opens Checkout, so Stripe renders no
Terms-of-Service checkbox and records no `consent.terms_of_service` — **even with
`STRIPE_TOS_CONSENT=1`.** Stripe exposes no consent mechanism on `subscriptions.update`, so
this cannot be closed inside Stripe. A customer could be moved to a higher-priced plan, and
charged a proration, having agreed to nothing at the point of that charge.

Registration (`app/api/register/route.ts`) collects nothing either — see §9, out of scope here.

## 2. Authority to author the migration (answered from the text, not preference)

`.ai/RUNBOOKS/schema-change.md` §"Adding a table or column (migration-first)" steps 1–4:
add the model → generate and **review** the SQL → validate only on a proven-disposable target →
"Ship: the migration is applied as a deliberate release step (owner-gated for production), with
preflight, forward-validation, and a rollback/compensating plan." It further states: "For later
additive work, **append a reviewed migration after the committed chain.**" CLAUDE.md gotcha #1
says the same: every new table "ships as a reviewed Prisma migration with preflight,
forward-validation, and a rollback plan, applied as a deliberate release step (never in the
build)."

**Conclusion: authoring is authorized by the ratified policy. No per-migration ADR is required.
What is owner-gated is APPLYING.** A separate ADR is required only to add a table to the legacy
self-heal allowlist — the opposite of what is done here. Accordingly this change is
**not** BLOCKED — MIGRATION RATIFICATION; the migration is authored, unapplied, and awaiting the
owner's release step.

## 3. Reuse check (done before inventing anything)

`OutcomeConsent` (`lib/outcomeConsent.ts`) is a **runtime self-heal legacy table**: unversioned,
a single `contribute` boolean, `ON CONFLICT DO UPDATE` (overwrites history), and read
**fail-open**. It is a preference toggle for corpus contribution, not an acceptance record, and
extending it would (a) add new runtime DDL, which `scripts/schema-safety.test.ts` rejects under
MIGRATION-FIRST, and (b) make a legal acceptance overwritable and unversioned. **Not reusable.**
No other versioned-acceptance model exists (`grep` for terms/tos/consent models in
`prisma/schema.prisma`: zero).

## 4. Proposed schema delta

New model `TermsAcceptance`; on `User`, a back-relation only (**no new User column**).

| column | type | note |
|---|---|---|
| `id` | TEXT PK | cuid |
| `userId` | TEXT | FK → `User.id`, `ON DELETE CASCADE` |
| `version` | TEXT | terms revision agreed to (the `updated` date on `/legal/terms`) |
| `context` | TEXT | where given, e.g. `stripe_subscription_upgrade` |
| `acceptedAt` | TIMESTAMP(3) | default now |

`UNIQUE(userId, version)` · `INDEX(userId, acceptedAt)`.

Why an event row and not a `termsAcceptedAt` column on `User`: a column cannot say **which**
terms were agreed to, so re-publishing the terms would silently inherit an old acceptance.
`onDelete: Cascade` is deliberate — the row is evidence *about* a person keyed to their id;
account erasure must not leave an orphaned identifier behind. (Flag if you want RESTRICT +
explicit shredding instead; that is a retention-policy call, §10 note.)

## 5. The migration

`prisma/migrations/20260728000000_terms_acceptance/migration.sql` — appended after
`20260721160000_operator_reputation`. **Additive only: 1 CREATE TABLE, 2 CREATE INDEX, 1 FK.
Zero DROP, zero ALTER of an existing table, zero data statements.**

```sql
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TermsAcceptance_userId_version_key" ON "TermsAcceptance"("userId", "version");
CREATE INDEX "TermsAcceptance_userId_acceptedAt_idx" ON "TermsAcceptance"("userId", "acceptedAt");
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Preflight** — `to_regclass('"TermsAcceptance"')` IS NULL; `to_regclass('"User"')` IS NOT NULL;
chain applied through `20260721160000`; no build step runs migrations (pinned by
`scripts/schema-safety.test.ts`, 17/17 green).
**Forward validation** (read-only, after apply) — the five columns exist; `COUNT(*) = 0`; both
indexes present; FK present and VALID.
**Data risk at apply: none.** No existing row is read, written, locked for write, or deleted;
old application code is unaffected by the table's presence.

## 6. Files changed

| file | change |
|---|---|
| `prisma/schema.prisma` | + `TermsAcceptance` model; + `termsAcceptances` back-relation on `User` |
| `prisma/migrations/20260728000000_terms_acceptance/migration.sql` | NEW, unapplied |
| `lib/terms.ts` | NEW — `CURRENT_TERMS_VERSION`, `TERMS_URL`, `isCurrentTermsVersion`, `hasAcceptedTermsVersion`, `recordTermsAcceptance` |
| `app/api/stripe/checkout/route.ts` | + gate in the upgrade branch, before `stripe.subscriptions.update`; removed the stale "KNOWN GAP — B-06" comment |
| `scripts/terms-acceptance.test.ts` | NEW guard, 36 assertions |

Not changed: `app/api/register/route.ts`, the two Checkout-Session paths, the webhook, the build
command, `vercel.json`.

## 7. API behaviour

Upgrade branch only (account already holds exactly **one** active subscription and requests a
higher tier). Evaluated **after** the existing 400/409 refusals and **before** any Stripe call:

1. `hasAcceptedTermsVersion(user.id)` → row exists ⇒ proceed unchanged.
2. No row and `body.acceptTerms !== CURRENT_TERMS_VERSION` ⇒ **HTTP 428**
   `{ error, termsRequired: true, termsVersion, termsUrl }`. **No Stripe call, no charge.**
3. No row and the assertion matches ⇒ row written server-side **first**, then the Stripe update.

The client **asserts**; it does not supply the record. The version written is the server
constant, never the client's string; the subject is the id-resolved account from
`currentAccount()` (never email, never the impersonation/agency cookie) — so it is tenant-safe.
`UNIQUE(userId, version)` + upsert-with-empty-update makes it idempotent and preserves the
**first** acceptance timestamp on retry.

## 8. UX behaviour, and the one thing that breaks

The 428 is machine-readable so the upgrade UI can render a required checkbox linking to
`termsUrl` and re-post with `acceptTerms: termsVersion`.

> ⚠️ **BLOCKING SEQUENCING FACT.** No caller sends `acceptTerms` today. The callers that can
> reach this branch are `app/pricing/PricingTiers.tsx`, `app/agency/page.tsx` and
> `app/billing/page.tsx` — **none of them are owned by this change.** If the gate deploys before
> those are updated, **every in-place plan upgrade returns 428 until they ship.** New
> subscriptions, letter packs, renewals and the portal are unaffected. This is a deliberate
> fail-closed default: blocking an upgrade is recoverable, charging without consent is not.

## 9. Existing subscribers — OPTIONS, NOT A RECOMMENDATION

The migration contains **no backfill**, and none was written. Existing paid subscribers never
agreed to these terms; creating a row for them would manufacture a consent that did not happen.
**This decision is the owner's, and options B and C carry legal consequences this change does
not evaluate — BLOCKED — COUNSEL if either is contemplated.**

- **A · No backfill (what the code as written does).** Existing subscribers keep their current
  plan untouched; the next time one *upgrades*, they are asked once. No record is ever created
  without a person's act. Cost: an extra click on a rare path, and the estate has no acceptance
  on file for anyone until they next upgrade.
- **B · Prospective re-consent campaign.** Email/in-app prompt asking existing subscribers to
  accept the current terms; each acceptance writes a real row with `context = "re_consent"`.
  Cost: a campaign to build (files not in this change) and an unknown response rate. Requires
  counsel sign-off on the wording.
- **C · Record the historical fact separately, never as acceptance.** If counsel concludes an
  earlier Checkout session already captured consent for a given customer, that evidence lives in
  Stripe and should be cited from Stripe — **not** copied into this table under a version those
  customers never saw. Requires counsel confirmation per cohort.

Whatever is chosen, **no option may write a `TermsAcceptance` row for a person who did not
perform an act of acceptance.** The guard fails the build if a backfill statement appears in the
migration.

## 10. Failure behaviour and rollback

- Database unreachable during the check or the write ⇒ the error propagates to the route's
  existing `catch` ⇒ **500, no Stripe call, no plan change.** `lib/terms.ts` contains no
  `catch` on purpose: a swallowed error would decide a legal question by accident.
- Table missing (code deployed before the migration is applied) ⇒ same 500, upgrades blocked, no
  wrong charge. **This is why the release order in §11 is migration-first.**
- Stripe update fails after the row is written ⇒ the row stands. The person did accept the
  terms; that the charge later failed does not un-accept them.
- **Rollback:** `DROP TABLE "TermsAcceptance";` is safe **only while the table is empty and the
  application code is not yet deployed.** Once it holds rows it holds consent evidence — do not
  drop it; roll back the *application* deploy and leave the table in place.

## 11. Release order (owner-executed; nothing here has been run)

1. Apply the migration via the owner-gated path (`prisma migrate deploy`, per
   `RUNBOOKS/gate-d-production-migration.md` for production history). **Never in the build.**
2. Run the §5 forward validation, read-only.
3. Ship the upgrade-UI change that sends `acceptTerms` (separate change, files not owned here).
4. Deploy this application code.

## 12. Tests

- `scripts/terms-acceptance.test.ts` — **36/36 pass.** Proven non-vacuous by nine mutations, each
  caught by the intended assertion: gate deleted; gate moved after the Stripe call; client's
  version recorded instead of the server's; env kill-switch added (two namings + an arbitrary
  name); library swallowing errors; migration backfill added; version constant drifted from
  `/legal/terms`; model column with no migration column; `@@unique` removed.
- `scripts/schema-safety.test.ts` — 17/17 pass (no new runtime self-heal DDL).
- `scripts/checkout-consent.test.ts` — 11/11 pass, **not weakened, not edited.**
- **NOT RUN — ENVIRONMENT:** `npm run typecheck` and `npx next build` (no `node_modules`; the
  new `prisma.termsAcceptance` accessor requires a generated client). Both must run before
  deploy.
- **VERIFICATION REQUIRED — PRODUCTION:** after step 4, a direct unauthenticated/authenticated
  `curl` of `/api/stripe/checkout` on the upgrade path must return 428 without `acceptTerms`.

Housekeeping for whoever owns those files (not changed here): `scripts/checkout-consent.test.ts`
still asserts "no parallel consent table/column was invented" over the route + webhook, and it
still passes — but its *meaning* has narrowed, because the upgrade path now deliberately keeps a
local record (Stripe records nothing there). It should be re-scoped to the two Checkout-Session
paths. `.github/workflows/ci.yml` runs `schema-safety.test.ts` but not the consent guards;
`terms-acceptance.test.ts` should be added there.

---

## THE DECISION REQUESTED

> **Do you approve applying migration `20260728000000_terms_acceptance` and shipping the enforced
> upgrade-path gate, in the order at §11 — YES / NO?**
>
> If **YES**, name the existing-subscriber option from §9 (**A**, **B**, or **C**). Option A is
> what the code already does and requires nothing further; **B and C require counsel before any
> row is written.**

Nothing is applied, deployed, or backfilled until that answer is given.
