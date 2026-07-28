# `scripts/runtime/` — mocked runtime guards

Every other guard in `scripts/` is **source-level**: it reads the shape of the code
with a regex and never executes it. That is deliberate and valuable — but a
source-level guard cannot tell you that a route *returned* 428, that a write
*happened before* a charge, or that a unique constraint *held*.

The guards in this directory **execute the product code**. They load the real
`app/api/stripe/webhook/route.ts` and the real `lib/billing.ts` /
`lib/stripe.ts`, replace only the I/O boundaries (Prisma, Stripe, NextAuth) with
in-process fakes, call the real
`POST` handlers with real `Request` objects, and assert on what actually
happened: status codes, response bodies, the **order** of side effects, and the
rows that exist afterwards.

## Run them

```bash
npx --no-install tsx scripts/runtime/run-all.ts            # all guards, one summary
npx --no-install tsx scripts/runtime/stripe-webhook-claim.runtime.test.ts
npx --no-install tsx scripts/runtime/stripe-webhook-reorder.runtime.test.ts
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
| `stripe-webhook-claim.runtime.test.ts` | The full claim lifecycle end to end through `POST`: fresh event → **claimed** → handled → **settled**; redelivery of a settled event → 200 `duplicate`, handler not re-run; a live pending claim → **409** (never a 200 that would end Stripe's retries); an abandoned pending claim ages out and **is** re-processed, while a one-minute-old claim is not; a handler failure **releases** the claim and the retry then succeeds; `releaseStripeEvent` deletes a pending row but never a settled one; an unhandled event type is acknowledged and never enters the ledger. |
| `stripe-webhook-reorder.runtime.test.ts` | **Out-of-order delivery.** Stripe guarantees no ordering, so a `customer.subscription.deleted` can be followed by a DELAYED, STALE `customer.subscription.updated` whose payload still says `active`. The guard drives that exact pair through the real `POST` with the event payload and Stripe's CURRENT state set independently, and proves the plan stays **revoked**: the handler re-retrieves, the write carries `plan: "free"`, and no update in the scenario writes an agency plan. The mirror case (a stale `deleted` after a real reactivation) must not revoke a paying customer. A duplicate of the stale event stays idempotent. A **control** case — Stripe currently `active` — really does restore the plan, so none of the above passes merely because the handler can never write a plan. |
| `unknown-price-failclosed.runtime.test.ts` | An unrecognized Stripe price on an **active** subscription writes **no `plan` key at all** (asserted against the `data` object handed to `user.update`, not against final state), grants no agency access, leaves the stored plan untouched, and is reported with the price id. A recognized price still provisions (control). An **inactive** subscription still writes `plan: "free"` whatever the price says, because revocation is always safe. A subscription whose customer maps to no account writes nothing and is reported. |

## How the mocking works

`tsx` runs these scripts as CommonJS, so every `import` in the modules under test
becomes a `require()` that passes through `Module._load`. `_harness.ts` patches
that one function: a request whose **resolved absolute path** (or bare specifier)
has been registered returns the fake instead. Resolving first is what makes
`./prisma` from `lib/billing.ts` and `@/lib/prisma` from a route module hit the
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
- **No browser.** No React component is rendered. Nothing here says anything
  about what a customer sees.
- **Nothing about the terms/consent gate.** `terms-acceptance.runtime.test.ts`
  is deliberately NOT in this branch — it exercises `lib/terms.ts`, which does not
  exist here. It ships with the terms work, not with this one.

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
confirming the guard fails. The counts below were recorded when the terms guard
was still part of the suite, so they include its assertions; the break/no-break
direction is what they attest, not the absolute numbers:

| Break | Result |
| --- | --- |
| Answer 200 instead of 409 for `in_flight` | 34 passed, **2 failed** |
| Delete the staleness window from the claim SQL | 30 passed, **6 failed** |
| Stop releasing the claim when a handler fails | 31 passed, **5 failed** |
| Stop settling the claim after a successful handler | 29 passed, **7 failed** |
| `data.plan = active ? (tier ?? "premium") : "free"` | 25 passed, **4 failed** |
| `planForPrice` returns `"premium"` instead of `null` | 19 passed, **10 failed** |

Recorded for `stripe-webhook-reorder.runtime.test.ts` (44 assertions), each mutation applied to a
working copy of `app/api/stripe/webhook/route.ts` and reverted immediately afterwards:

| Break | Result |
| --- | --- |
| Act on `event.data.object` instead of re-retrieving current state | 27 passed, **17 failed** (exit 1) |
| Drop the `claim === "completed"` duplicate short-circuit | 39 passed, **5 failed** (exit 1) |
| _(unmodified)_ | **44 passed, 0 failed** (exit 0) |

Each guard also carries **control** assertions (a recognized price really did
provision; a pending row really is deletable; the handler really did run) so that a "nothing happened" pass cannot
be mistaken for a proof.

## Adding a guard

1. Name it `<topic>.runtime.test.ts` in this directory **and add that filename to `REQUIRED` in
   `run-all.ts`** — discovery alone cannot tell a deleted guard from one that never existed.
2. Register every mock with `mockModule()` / `mockPackage()` **first**, then
   `loadModule()` the code under test.
3. Assert on behaviour — status, ordering via `CallLog.before()`, the `data`
   objects in `FakePrisma.userUpdates`, the rows that exist — not on source text.
4. Include at least one control assertion that fails if the scenario never ran.
5. Break the behaviour in a scratch copy, confirm the guard fails, and record the
   before/after counts in the table above.
