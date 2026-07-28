# `scripts/runtime/` — mocked runtime guards

Every other guard in `scripts/` is **source-level**: it reads the shape of the code
with a regex and never executes it. That is deliberate and valuable — but a
source-level guard cannot tell you that a route *returned* 428, that a write
*happened before* a charge, or that a unique constraint *held*.

The guards in this directory **execute the product code**. They load the real
`app/api/stripe/checkout/route.ts`, the real `app/api/stripe/webhook/route.ts`,
the real `lib/terms.ts`, `lib/billing.ts` and `lib/stripe.ts`, replace only the
I/O boundaries (Prisma, Stripe, NextAuth) with in-process fakes, call the real
`POST` handlers with real `Request` objects, and assert on what actually
happened: status codes, response bodies, the **order** of side effects, and the
rows that exist afterwards.

## Run them

```bash
npx --no-install tsx scripts/runtime/run-all.ts            # all guards, one summary
npx --no-install tsx scripts/runtime/terms-acceptance.runtime.test.ts
npx --no-install tsx scripts/runtime/stripe-webhook-claim.runtime.test.ts
npx --no-install tsx scripts/runtime/unknown-price-failclosed.runtime.test.ts
```

They follow the house guard style — a `check()` helper, an `N passed, M failed`
line, and a non-zero exit on any failure — so they run like every other guard.
They need **no `DATABASE_URL`, no `ANTHROPIC_API_KEY`, no Stripe key, and no
network**. They only need `node_modules` installed.

Filenames end in `.runtime.test.ts` and live in a subdirectory, so the existing
`scripts/*.test.ts` glob does not pick them up; they are an addition to the guard
suite, not a change to it.

## What each guard covers

| Guard | Proves at runtime |
| --- | --- |
| `terms-acceptance.runtime.test.ts` | The acceptance row is written **before** `stripe.subscriptions.update`, and no money-moving Stripe call precedes it. A request without acceptance returns **428** with `termsRequired`/`termsVersion`/`termsUrl` and performs **zero** Stripe mutations. A client asserting a *different* version (or a bare `true`) is still refused. Repeated acceptance is idempotent under a real `UNIQUE(userId, version)` — no duplicate row, no throw, original `acceptedAt` preserved. When Stripe fails **after** acceptance, the record survives, the caller gets a failure, no plan is written, no `subscription_started` event fires, and the retry does not double-write. |
| `stripe-webhook-claim.runtime.test.ts` | The full claim lifecycle end to end through `POST`: fresh event → **claimed** → handled → **settled**; redelivery of a settled event → 200 `duplicate`, handler not re-run; a live pending claim → **409** (never a 200 that would end Stripe's retries); an abandoned pending claim ages out and **is** re-processed, while a one-minute-old claim is not; a handler failure **releases** the claim and the retry then succeeds; `releaseStripeEvent` deletes a pending row but never a settled one; an unhandled event type is acknowledged and never enters the ledger. |
| `unknown-price-failclosed.runtime.test.ts` | An unrecognized Stripe price on an **active** subscription writes **no `plan` key at all** (asserted against the `data` object handed to `user.update`, not against final state), grants no agency access, leaves the stored plan untouched, and is reported with the price id. A recognized price still provisions (control). An **inactive** subscription still writes `plan: "free"` whatever the price says, because revocation is always safe. A subscription whose customer maps to no account writes nothing and is reported. |

## How the mocking works

`tsx` runs these scripts as CommonJS, so every `import` in the modules under test
becomes a `require()` that passes through `Module._load`. `_harness.ts` patches
that one function: a request whose **resolved absolute path** (or bare specifier)
has been registered returns the fake instead. Resolving first is what makes
`./prisma` from `lib/billing.ts` and `@/lib/prisma` from `lib/terms.ts` hit the
same override.

Mocks must be registered **before** the first `loadModule()` of code under test —
a top-level `import` of that code would be hoisted above the registrations and
load the real module. That is why the guards use `loadModule()` and never a
top-level import for the code they are testing.

`requireActual()` loads the genuine module while still applying overrides to
everything *it* imports, so a mock can replace one export (`getStripe`) and keep
the rest real (`planForPrice`, `PRICES`, …).

## What these guards do NOT prove

Read this before quoting a pass as evidence.

- **No database.** `FakePrisma` is not Postgres. It has no transactions, no
  isolation levels, no row locking, no real `CURRENT_TIMESTAMP`, and no query
  planner. `$transaction` runs the callback inline and is **not atomic**.
- **No real concurrency.** The `in_flight` state is exercised by *seeding* a
  pending row, not by two invocations racing. Real `INSERT … ON CONFLICT`
  atomicity between concurrent Vercel instances is unproven here.
- **No Stripe.** No signature is verified (`constructEvent` is faked), no price,
  subscription, customer or webhook is real, and no proration is calculated.
  Whether Stripe actually prorates an in-place upgrade the way the route intends
  is a production/Stripe-test-mode question.
- **No browser.** No React component is rendered. Whether a customer can *see*
  and tick the acceptance checkbox is covered by `scripts/terms-acceptance.test.ts`
  §6 at source level, and only truly by a manual or E2E pass.
- **No migration application.** The `TermsAcceptance` table is emulated in
  memory. That the migration applies cleanly to production — and that production
  has the `_prisma_migrations` baseline it needs — is an owner-gated release step,
  not something any test here can assert.
- **Not a legal opinion.** These guards check mechanism (a row is written before a
  charge, keyed to the account, at the server's version). Whether that mechanism
  satisfies CROA/FCRA, what the wording must say, how long the record is retained,
  and whether existing customers need anything are **counsel** questions.

The fake's SQL layer deserves a specific caveat and a specific reassurance. It
**parses the statements `lib/billing.ts` actually issues** rather than hard-coding
what they are assumed to mean: the `ON CONFLICT` arm applies only the conditions
literally present in the SQL, and any statement shape it does not recognize
**throws** instead of quietly returning "0 rows". Removing the pending-marker
guard or the staleness window from `lib/billing.ts` therefore changes what the
fake does, and the claim-state guard fails. It is still an emulation of Postgres
semantics, not Postgres.

## Non-vacuity

A runtime test that passes against broken code is worse than no test. Every
assertion in this directory was verified by breaking the behaviour it claims to
protect — in a disposable copy of the tree, never in the repository — and
confirming the guard fails:

| Break | Result |
| --- | --- |
| Record the acceptance *after* `stripe.subscriptions.update` | 38 passed, **10 failed** |
| Disable the 428 gate (`if (false && …)`) | 24 passed, **24 failed** |
| `create` instead of `upsert` in `recordTermsAcceptance` | 43 passed, **5 failed** (incl. "re-recording … does not throw") |
| `update: { acceptedAt: new Date() }` (overwrite the first agreement) | 47 passed, **1 failed** |
| Report a Stripe failure to the customer as a completed upgrade | 46 passed, **2 failed** |
| Answer 200 instead of 409 for `in_flight` | 34 passed, **2 failed** |
| Delete the staleness window from the claim SQL | 30 passed, **6 failed** |
| Stop releasing the claim when a handler fails | 31 passed, **5 failed** |
| Stop settling the claim after a successful handler | 29 passed, **7 failed** |
| `data.plan = active ? (tier ?? "premium") : "free"` | 25 passed, **4 failed** |
| `planForPrice` returns `"premium"` instead of `null` | 19 passed, **10 failed** |

Each guard also carries **control** assertions (the upgrade really did succeed; a
recognized price really did provision; a duplicate `create` really does raise
P2002; a pending row really is deletable) so that a "nothing happened" pass cannot
be mistaken for a proof.

## Adding a guard

1. Name it `<topic>.runtime.test.ts` in this directory.
2. Register every mock with `mockModule()` / `mockPackage()` **first**, then
   `loadModule()` the code under test.
3. Assert on behaviour — status, ordering via `CallLog.before()`, the `data`
   objects in `FakePrisma.userUpdates`, the rows that exist — not on source text.
4. Include at least one control assertion that fails if the scenario never ran.
5. Break the behaviour in a scratch copy, confirm the guard fails, and record the
   before/after counts in the table above.
