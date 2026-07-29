# RUNBOOK — rolling back the Stripe webhook claim change

**Status: VERIFIED against the code in this branch and REHEARSED against a throwaway local
Postgres 16. Never rehearsed against production. Nothing here may be run against production
without the owner present.**

> ## Read this first
> **This rollback is OPERATIONALLY ASYMMETRIC. It is NOT a simple code revert.**
> Rolling *forward* is a deploy. Rolling *back* is a deploy **plus a data step that must happen
> first**, because the new code leaves rows in a shape the old code misreads. Revert the code
> without the data step and you will silently drop paid events — no error, no alert, no retry.
> If you only remember one thing: **clear the pending rows BEFORE the revert deploys.**

---

## 1. What changed, and why the revert is not symmetric

The change reuses the EXISTING `"StripeWebhookEvent"."type"` column to carry a claim state.
No new column, no new table, no migration.

| | value written into `"type"` | meaning |
|---|---|---|
| new code, claim taken | `pending:<eventType>` | an invocation is handling this event RIGHT NOW |
| new code, handling finished | `<eventType>` | settled — a genuine duplicate must be refused forever |
| old code (pre-change) | `letters_5` only | the old code only ever wrote the letter-pack ledger |

**The asymmetry.** The old code's only read of this table is in `creditLetters()`:

```ts
// pre-change lib/billing.ts — the ONLY old-code reader of the ledger
const inserted = await tx.$executeRawUnsafe(
  `INSERT INTO "StripeWebhookEvent" ("id", "type") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING`,
  eventId,          // ← the BARE event id
  "letters_5"
);
if (inserted === 0) return;   // "already processed" → NO CREDITS GRANTED
```

The new code claims the **same bare event id** for every handled event, including
`checkout.session.completed`. So after a revert:

- A row left behind for a `checkout.session.completed` event makes the old `INSERT` return **0**,
  the old code concludes "already processed", and **the letter-pack credits are never granted**.
- If the new code had already COMPLETED that event, the credits were already granted and the
  refusal is correct — no harm.
- If the row was still **`pending:`** (claimed, never completed), **the credits were never granted
  and now never will be.** That is the silent drop. It is money the customer paid for and did not
  receive.

Subscription and invoice events are lower severity — the old route has no dedup gate at all, so
leftover rows do not block them — but leaving `pending:` rows behind is still wrong: they are dead
records that the old code cannot age out, and they poison a future roll-forward's first few minutes.

**Therefore: PENDING ROWS MUST BE ZERO BEFORE THE REVERT IS LIVE.** Settled rows (bare `type`) and
letter-pack rows (`type = 'letters_5'`, both the old bare-id key and the new `<eventId>:letters_5`
key) **must be left exactly where they are** — deleting those re-opens double-credit and
double-processing.

---

## 2. Placeholders used below

| placeholder | what to substitute |
|---|---|
| `<PROD_DB>` | the production connection the owner opens by hand. It is **never** written into a file, a script, an env var in this repo, or this runbook. |
| `<ROLLBACK_SHA>` | the commit to revert to — the parent of the webhook-claim change. |
| `<ENDPOINT_ID>` | the Stripe **live** webhook endpoint id (`we_...`) in Dashboard → Developers → Webhooks. |
| `<START_UTC>` | UTC timestamp when you disabled the endpoint (step 3). Needed for the replay window. |

**Everything below that reads is read-only. Only step 6 writes, and only to the rows step 5
counted.**

---

## 3. Stop or drain webhook traffic

Do this first. Every later step assumes no new claims are being created.

1. Stripe Dashboard (LIVE) → Developers → Webhooks → `<ENDPOINT_ID>` → **Disable**.
   Record `<START_UTC>`.
2. Stripe **buffers** disabled-endpoint events and retries them for 3 days once re-enabled. That
   buffer is what makes this safe: draining is a pause, not a loss.
3. **Wait ≥ 15 minutes** after disabling before running step 6. Fifteen minutes is
   `STALE_CLAIM_MINUTES` in `lib/billing.ts` — the point at which the code itself declares a claim
   abandoned. After a 15-minute quiet period, no `pending:` row can belong to a live invocation,
   because the longest `maxDuration` this app declares is 60 seconds.

**If you cannot disable the endpoint** (e.g. you do not have Dashboard access at 03:00): do not
proceed to a full revert. Run the age-filtered cleanup in step 6 on a loop and accept that recent
pending rows survive — that is a partial rollback with a known drop window, and it must be
recorded as such. **Stop condition: no revert deploys while the endpoint is live.**

---

## 4. Identify the pending rows — without printing anything sensitive

The table holds **no payloads**: three columns, `id` / `type` / `createdAt`. There is nothing to
redact, but there is also no reason to pull ids — they correlate to customers in the Stripe
Dashboard. **Query aggregates, not rows.**

```sql
-- 4a · how much is pending, and how old?
SELECT
  CASE WHEN "type" LIKE 'pending:%' THEN 'PENDING' ELSE 'settled' END AS state,
  count(*)         AS rows,
  min("createdAt") AS oldest,
  max("createdAt") AS newest
FROM "StripeWebhookEvent"
GROUP BY 1 ORDER BY 1;

-- 4b · which event types are stuck, split on the age filter used in step 6
SELECT
  "type",
  count(*) FILTER (WHERE "createdAt" <  CURRENT_TIMESTAMP - INTERVAL '30 minutes') AS abandoned_ge_30m,
  count(*) FILTER (WHERE "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '30 minutes') AS recent_lt_30m
FROM "StripeWebhookEvent"
WHERE "type" LIKE 'pending:%'
GROUP BY "type" ORDER BY "type";
```

Read 4b for `pending:checkout.session.completed` first — that is the only class the reverted code
actually reads, and therefore the only class that can silently lose money.

**Do not `SELECT *`. Do not export ids into a ticket, a chat message, or an AI prompt.**

---

## 5. Decide which rows are genuinely abandoned

### The age filter this runbook recommends

```
"createdAt" < CURRENT_TIMESTAMP - INTERVAL '30 minutes'
```

**Justification, against the window the code actually uses.** `lib/billing.ts` sets
`STALE_CLAIM_MINUTES = 15`: a `pending:` row older than 15 minutes is one the *running code itself*
will already re-claim, so deleting it removes nothing the system considers owned. 30 minutes is
2× that — the margin exists because the 15-minute boundary is evaluated inside a single atomic
`ON CONFLICT ... WHERE` statement, whereas your `DELETE` runs from a separate session minutes
later, and you do not want the two decisions to race at the boundary. Both the row's `createdAt`
and `CURRENT_TIMESTAMP` are produced by the database, so there is no app/DB clock skew to absorb;
the margin is purely operational.

Shorter than 15 minutes is **wrong** — it can delete a claim a live invocation still holds.
Much longer than 30 minutes is merely slower, not safer, and leaves the money-losing
`pending:checkout.session.completed` rows in place for longer.

### Why deleting a live claim is survivable, but still avoided

If the `DELETE` did remove a row a running invocation held, that invocation's
`completeStripeEvent()` (`UPDATE ... WHERE "id" = $1`) affects 0 rows and returns quietly. The
event stays handled, no ledger row survives, and a later Stripe retry re-handles it. Every handler
is idempotent — subscription syncs re-retrieve current state from Stripe, and the letter-pack grant
carries its own `<eventId>:letters_5` ledger key — so the worst case is one redundant re-handle.
That is the safe direction to fail in. It is still not a reason to skip the 15-minute quiet period.

### Hard rule

Never widen the predicate. `LIKE 'pending:%'` is the whole safety property:

- `letters_5` rows (old bare-id **and** new `<eventId>:letters_5`) → **never match** → survive.
- Settled rows (`customer.subscription.updated`, `checkout.session.completed`, …) → **never
  match** → survive.
- No Stripe event type begins with the literal `pending:`, so there is no legitimate settled row
  the pattern can hit.

---

## 6. Delete only the abandoned pending rows

```sql
-- 6a · BEFORE — record these three numbers in the incident log
SELECT count(*) AS total,
       count(*) FILTER (WHERE "type" LIKE 'pending:%')     AS pending,
       count(*) FILTER (WHERE "type" NOT LIKE 'pending:%') AS settled
FROM "StripeWebhookEvent";

-- 6b · CLEANUP (the exact statement — do not edit the predicate)
DELETE FROM "StripeWebhookEvent"
 WHERE "type" LIKE 'pending:%'
   AND "createdAt" < CURRENT_TIMESTAMP - INTERVAL '30 minutes';

-- 6c · AFTER — same three numbers
SELECT count(*) AS total,
       count(*) FILTER (WHERE "type" LIKE 'pending:%')     AS pending,
       count(*) FILTER (WHERE "type" NOT LIKE 'pending:%') AS settled
FROM "StripeWebhookEvent";
```

**Check: `settled` must be IDENTICAL in 6a and 6c.** If it moved, the predicate was edited —
stop, do not deploy, and escalate to the owner. A point-in-time restore of the database is then the
only correct recovery; do not attempt to reconstruct settled rows by hand.

Then, with traffic still stopped and ≥ 15 minutes elapsed since step 3, sweep the remainder:

```sql
-- 6d · FINAL DRAIN SWEEP — only valid when the endpoint is DISABLED and 15+ min have passed
DELETE FROM "StripeWebhookEvent" WHERE "type" LIKE 'pending:%';

SELECT count(*) AS pending_remaining_must_be_zero
FROM "StripeWebhookEvent" WHERE "type" LIKE 'pending:%';
```

**STOP CONDITION — `pending_remaining_must_be_zero` must read `0`.** If it does not, new traffic
is still arriving: the endpoint was not actually disabled. Go back to step 3. **Do not deploy the
revert while any `pending:` row exists.**

### Rehearsal result (throwaway local Postgres 16, not production)

Seeded 12 rows — 7 settled (incl. both letter-pack key shapes), 3 abandoned pending
(≥ 30 min), 2 recent pending (< 30 min):

| | total | pending | settled |
|---|---|---|---|
| before 6b | 12 | 5 | 7 |
| after 6b | 9 | 2 | 7 |
| after 6d | 7 | 0 | 7 |

`settled` never moved. `letters_5` rows surviving: 2 of 2 (both the pre-change bare-id row and the
new suffixed row). Abandoned pending left after 6b: 0. Recent pending left after 6b: 2 — deleted
only by the post-drain sweep, exactly as designed.

**Failure mode reproduced.** With the abandoned `pending:checkout.session.completed` row left in
place, the old code's claim ran as `INSERT 0 0` → "already processed" → credits never granted.
After the cleanup the identical statement ran as `INSERT 0 1` → credits granted. That single row
is the difference between a paying customer receiving their letter pack and not.

---

## 7. Deploy the rollback

Only now.

```bash
git revert --no-commit <the webhook-claim commits>   # or: git checkout <ROLLBACK_SHA> -- <paths>
npm run typecheck && npx next build
```

Owner confirms, then push to `main`; Vercel auto-deploys (~2 min). Full procedure:
`.ai/RUNBOOKS/deploy.md`. Confirm the deployed SHA is `<ROLLBACK_SHA>`:

```bash
curl -sI https://www.creditvector.app/ | grep -i x-cv-release
```

**Do not re-enable the endpoint until this reads the rollback SHA.**

---

## 8. Replay / let Stripe retry

1. Stripe Dashboard → Webhooks → `<ENDPOINT_ID>` → **Enable**. Buffered events from `<START_UTC>`
   onward begin delivering automatically. **For most rollbacks this is the whole of step 8** —
   Stripe's own retry schedule is the replay mechanism, and it is more reliable than a manual one.
2. For any event you know was in flight at `<START_UTC>` (from step 4b's counts and the Dashboard's
   event list for that window): Dashboard → Events → the event → **Resend**. Resend one at a time
   and confirm each 200 before the next.
3. Every handler is idempotent, so a resend of an already-processed subscription event is a no-op.
   The one exception you must not resend blindly is a letter-pack `checkout.session.completed`
   whose credits WERE granted — the surviving settled row is what stops the double credit, which
   is exactly why step 5 forbids deleting settled rows.

---

## 9. Verify no active event was lost

Within 30 minutes of re-enabling:

- Stripe Dashboard → Webhooks → `<ENDPOINT_ID>`: **failed deliveries in the window = 0** and
  pending retries draining toward 0.
- Every event in the `<START_UTC>` → now window shows a 2xx.
- Spot-check the money path: pick the customers behind the `pending:checkout.session.completed`
  rows counted in step 4b (ids from the **Stripe Dashboard**, not from a DB dump) and confirm
  `letterCredits` moved for each. This is the only class that could have been silently dropped,
  so it is the only class worth checking by hand.
- Confirm no subscriber's `plan` regressed: admin UI → Users → filter `subscriptionStatus=active`
  and confirm none sits on `plan=free`.

**If any event shows a non-2xx or any credit is missing: this is a money-path incident.** Resend
the specific event from the Dashboard, then reconcile the account manually.

---

## 10. Monitor

- **First hour:** watch the endpoint's delivery-failure count in the Stripe Dashboard. Any
  sustained non-2xx means the revert reintroduced a bug, not that the rollback was incomplete.
- **First 24 hours:** `reportError` output with `scope: "stripe-webhook"` and
  `scope: "stripe-billing"`. `phase: "sync-subscription"` with "Stripe subscription has no matching
  User" is the loudest sign a customer's entitlement went nowhere.
- **Ledger shape:** re-run query 4a once a day for three days. On the reverted code `pending` must
  stay at **0** forever — the old code never writes that prefix. A non-zero count means the revert
  did not fully deploy, or a stray instance is still running the new code.

---

## 11. Roll-forward is the easy direction

Redeploying the claim change needs **no data step**. Rows written by the old code are bare types,
which the new code reads as "completed" and keeps refusing duplicates on, exactly as before. That
asymmetry is the whole point of this runbook: the deploy is reversible, the data is not, and the
data step has to lead.
