# CreditVector — Stripe Agency Pro Price Sync

**Date:** 2026-07-29 · **Production truth:** `origin/main` = `dfe7a3a` · **Repository truth only**

> ## Verdict: NO CODE CHANGE REQUIRED — and none was made
>
> **The repository contains zero Stripe Price IDs.** There is nothing to replace. Prices are resolved
> at runtime by `lookup_key`, and the Agency Pro catalog is **already** on the new
> **$699 / $6,990** values.
>
> **Two stale documentation references were corrected. No code, no amounts, no other product touched.**
>
> **⚠ The real risk is on the Stripe side, not in the repository.** See §9 — if the new prices you
> created do not carry the `_v2` lookup keys, the application will create a *third* pair of prices.
>
> **⚠ And the catalog is completely unguarded.** Proven in §10: reverting Agency Pro to the archived
> $799 / $7,990 prices leaves typecheck clean and **all 70 guards green**.

---

## 1. What was asked, and what is actually there

The task was to replace the archived Agency Pro Stripe **Price IDs** with the newly active ones.
That operation has no target in this repository.

```ts
// lib/stripe.ts — resolvePrice()
const existing = await stripe.prices.list({ lookup_keys: [def.lookup], active: true, limit: 1 });
if (existing.data[0]) return existing.data[0].id;
// ...otherwise CREATE the price
```

Prices are **found-or-created by `lookup_key` at runtime**. The application never stores, reads or
hardcodes a `price_...` identifier. The in-code comment records why:

> *"The legacy `STRIPE_PRICE_ID` env override was removed 2026-07-16 — verified unset in every Vercel
> environment; lookup-key resolution is the sole production path."*

---

## 2. Old Price IDs · New Price IDs

| | Value |
|---|---|
| **Old (archived) Agency Pro Price IDs** | **Not present in the repository.** Exhaustive search for `price_[A-Za-z0-9]{8,}` across the entire `origin/main` tree (excluding `node_modules`, `.git`, `.next`) returns **zero matches** — no source file, config, JSON, YAML, markdown, `.env.example`, script, migration or seed contains one |
| **New (active) Agency Pro Price IDs** | **Not supplied, and not needed.** The task did not provide the new `price_...` values, and no repository location would consume them |

**No Price ID was invented, substituted or written.** Doing so would have required fabricating
identifiers, and would have introduced the first hardcoded price binding into a codebase that
deliberately has none.

**What the repository binds instead — already the new prices:**

| Catalog key | Lookup key | Amount (cents) | Displayed |
|---|---|---|---|
| `agency_pro_month` | `gcl_agency_pro_monthly_v2` | **69900** | **$699 / month** |
| `agency_pro_year` | `gcl_agency_pro_yearly_v2` | **699000** | **$6,990 / year** |

---

## 3. Every location Agency Pro pricing is referenced — `origin/main`

| # | Location | Content | Class | Decides what the customer is charged? |
|---|---|---|---|---|
| 1 | `lib/stripe.ts:22` | `AGENCY_PRO_PRICE_CENTS = 69900` | Amount constant | **YES** |
| 2 | `lib/stripe.ts:25-26` | `AGENCY_PRO_LEGACY_MONTH_CENTS = 79900`, `..._YEAR_CENTS = 799000` | Legacy amount constants | No — **tier mapping only** (see §5) |
| 3 | `lib/stripe.ts:102` | `agency_pro_month` → `gcl_agency_pro_monthly_v2`, 69900 | **Lookup key** | **YES** |
| 4 | `lib/stripe.ts:103` | `agency_pro_year` → `gcl_agency_pro_yearly_v2`, 699000 | **Lookup key** | **YES** |
| 5 | `lib/stripe.ts:191` | `if (lk.startsWith("gcl_agency_pro")) return "agency_pro"` | Tier mapping | No |
| 6 | `lib/stripe.ts:195-199` | amount fallback incl. legacy 79900 / 799000 | Tier mapping | No |
| 7 | `app/api/stripe/checkout/route.ts:37` | `PURCHASABLE_PLANS = ["premium", "agency"]` — **`agency_pro` absent** | Purchase gate | **YES — it refuses** |
| 8 | `app/billing/page.tsx:137` | `isAgencyPro ? '$699.00'` | Display copy | No |
| 9 | `app/pricing/PricingTiers.tsx:94` | `monthly: 699, yearly: 6990, status: "soon"` | Display copy | No |
| 10 | `.ai/executive/ChiefRevenueOfficer.md:9` | catalog stated as `agency_pro $799/$7990` | **Documentation — WRONG** | No — **corrected, §7** |
| 11 | `SETUP.md:128` | `STRIPE_PRICE_ID` documented as a live optional env var | **Documentation — WRONG** | No — **corrected, §7** |
| 12 | `.ai/PRICING-V2-ROADMAP.md:11,38` | `agency_pro ($799/mo, legacy)`; "add their price IDs to `lib/billing.ts`" | Documentation — stale | No — **reported, not changed (§8)** |
| 13 | `.ai/CURRENT-STATE.md:108,112` | records the $799 debt and the `_v2` decision | Documentation — historical record | No — correct as written |
| 14 | `.ai/ADR/ADR-0031`, `ADR-0034` | already flag the roadmap doc as stale | Documentation | No — correct as written |

**Environment variables:** no variable anywhere supplies a price ID. `.env.example` contains only
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_TOS_CONSENT`. No code reads
`STRIPE_PRICE_ID` — the only surviving mention is the comment recording its removal.

---

## 4. Why the archived $799 prices are already unreachable — three independent reasons

**Reason 1 — the resolver filters on `active`.** `resolvePrice` passes `active: true`, so an
**archived** price can never be returned by lookup, regardless of its key.

**Reason 2 — the lookup keys were already versioned.** The `_v2` suffix exists precisely for this
situation. From `lib/stripe.ts`:

> *"Stripe prices are amount-immutable and resolvePrice matches by lookup_key WITHOUT verifying
> unit_amount — reusing the old keys would forever resolve to any already-provisioned $799 price. New
> keys guarantee the $699 catalog provisions fresh."*

**Reason 3 — Agency Pro cannot be bought at all.** It is absent from `PURCHASABLE_PLANS`, and a
request is refused:

```ts
const PURCHASABLE_PLANS = ["premium", "agency"] as const;   // agency_pro deliberately ABSENT
// ...
"Agency Pro isn't available for purchase yet, so you can't be charged for it."   // HTTP 400
```

So `resolvePriceId(stripe, "agency_pro", …)` is **unreachable from checkout**. Neither the archived
prices nor the new ones are currently used by any customer-facing path.

---

## 5. Why editing the legacy constants would have been harmful

`AGENCY_PRO_LEGACY_MONTH_CENTS` (79900) and `AGENCY_PRO_LEGACY_YEAR_CENTS` (799000) look like exactly
the kind of "stale price" a sync task would delete. **They must stay.** They are consumed only by
`planForPrice()`, which maps a subscription's price back to a tier:

```ts
if (amt === AGENCY_PRO_PRICE_CENTS || amt === 699000
 || amt === AGENCY_PRO_LEGACY_MONTH_CENTS || amt === AGENCY_PRO_LEGACY_YEAR_CENTS)
  return "agency_pro";
```

Removing them would mean any existing subscriber still on a $799 or $7,990 price falls through to the
final `return "premium"` — **silently downgraded from Agency Pro to Professional** by the webhook, on
their next subscription event. Archiving a price in Stripe does not cancel subscriptions already on
it, so this is a live hazard, not a theoretical one.

---

## 6. Verification results

| Requirement | Result | Evidence |
|---|---|---|
| Checkout uses the new **monthly** price | **N/A — BLOCKED BY DESIGN** | `agency_pro` is not in `PURCHASABLE_PLANS`; the request returns **400**. When it is activated, `resolvePriceId(stripe, "agency_pro", "month")` resolves `gcl_agency_pro_monthly_v2` @ **69900** |
| **Annual** checkout uses the new annual price | **N/A — BLOCKED BY DESIGN** | Same gate. `interval: "year"` → `gcl_agency_pro_yearly_v2` @ **699000** |
| Upgrades reference the correct price | **PASS** | The in-place upgrade uses the *same* `priceId` from `resolvePriceId(plan, interval)` — one resolver, one catalog. Upgrading *to* `agency_pro` is refused by the same whitelist gate |
| Downgrades still work | **PASS — unaffected** | Downgrade is not a checkout operation. Checkout refuses same-or-lower tier (`tier(user.plan) >= tier(plan)` → 400); downgrades run through the Stripe Billing Portal, which is price-catalog independent |
| Billing portal remains valid | **PASS — unaffected** | `billingPortal.sessions.create({ customer, return_url })` takes no price and no configuration. Nothing in this task touches it |
| No other products changed | **PASS** | `premium` ($99/$990), `agency` ($399/$3,990) and `letters_5` ($19) are byte-unchanged. **No code file was modified at all** |
| Display copy matches the new price | **PASS** | `app/billing/page.tsx:137` `'$699.00'`; `app/pricing/PricingTiers.tsx:94` `monthly: 699, yearly: 6990` |

---

## 7. Files modified — documentation only, 2 files

No source file, configuration file, test or migration was modified.

| File | Change | Why |
|---|---|---|
| `.ai/executive/ChiefRevenueOfficer.md:9` | `agency_pro $799/$7990` → **`agency_pro $699/$6,990`** | The line claims to state "the catalog truth (`lib/stripe.ts` PRICES…)" and contradicted the money system of record. `premium` and `agency` on the same line were already correct and were left alone |
| `SETUP.md:128` | `STRIPE_PRICE_ID \| optional \| auto-created if omitted` → marked **removed 2026-07-16, no longer read by any code** | This was the repository's only remaining *price-ID* reference. It documented an env var that no code reads, and would have led an operator to set a variable with no effect |

**No pricing amount was changed.** Both edits bring documentation into agreement with code that was
already correct.

---

## 8. Reported, deliberately not changed

`.ai/PRICING-V2-ROADMAP.md` line 11 still calls Agency Pro `$799/mo, legacy`, and line 38 instructs
adding "their price IDs to `lib/billing.ts`" — an architecture that no longer exists (lookup keys, in
`lib/stripe.ts`). **This was left alone on purpose:** `ADR-0034` explicitly reviewed this exact
staleness and recorded the decision to defer it to the ADR-0031 packaging slice. Overriding a
recorded architectural decision unilaterally is out of scope for a price-sync task. **Owner
decision.** Note that lines 14 and 23 of the same document already describe the new $699 correctly,
so the file contradicts itself.

---

## 9. ⚠ The operational risk — this is what actually needs your attention

`resolvePrice` is **find-or-create by lookup key**. It does not check the amount. So:

- If the new $699 / $6,990 prices you created **carry** `gcl_agency_pro_monthly_v2` and
  `gcl_agency_pro_yearly_v2` → everything resolves correctly the moment Agency Pro is activated.
- If they **do not** carry those lookup keys → the lookup finds nothing, and the application
  **creates a third pair of Agency Pro prices** at $699/$6,990 with those keys, on the next Agency
  Pro checkout or the next run of the admin catalog sync. You would then have archived $799 prices,
  your new $699 prices sitting unused, and a second set of $699 prices created by the app.

A Stripe `lookup_key` can only be attached to **one active price at a time**, so if some *other*
active price already holds a `_v2` key, creation will conflict rather than silently duplicate.

**Check in the Stripe Dashboard before activating Agency Pro:** confirm exactly one active price
holds `gcl_agency_pro_monthly_v2` at $699, and exactly one holds `gcl_agency_pro_yearly_v2` at
$6,990. If your new prices lack the keys, `transfer_lookup_key` moves a key onto the right price
without creating anything.

`.ai/CURRENT-STATE.md:108` already carries the matching warning: *"the admin 'Sync products to
Stripe' route would create the $699 `_v2` prices — **do not run it until Agency Pro is activated for
sale.**"*

**This session performed no Stripe operation of any kind.** The Stripe MCP connector is not
authorized here, so the live catalog could not be read; the check above is yours to run.

---

## 10. ⚠ Finding — the Agency Pro catalog is completely unguarded

**No guard anywhere pins the Agency Pro amounts or lookup keys.** A search of all of `scripts/` for
`69900`, `699000` or `gcl_agency_pro` returns nothing.

**Proven, not asserted.** In an isolated `origin/main` worktree I reverted Agency Pro to exactly the
state this task was meant to fix — the archived prices *and* the old lookup keys:

```
AGENCY_PRO_PRICE_CENTS = 79900
agency_pro_month: lookup "gcl_agency_pro_monthly",  amountCents: 79900
agency_pro_year:  lookup "gcl_agency_pro_yearly",   amountCents: 799000
```

**Result: `tsc --noEmit` exit 0 · 70 / 70 guards pass · 0 fail.** Nothing went red. The file was then
restored byte-identically (`git diff --stat` empty).

So the correct catalog is held in place by nothing but the last person who edited it — and the
archived $799 prices still exist in Stripe, so a revert would silently reconnect to them the moment
Agency Pro is activated. **Recommended: add an amount-and-lookup-key assertion to a billing guard
before Agency Pro goes on sale.** That is a code change beyond this task's scope and was not made.

One guard *does* protect the purchase gate — but it ships in the unmerged PR-1-v2:
`scripts/billing-identity.test.ts:119` asserts *"agency_pro is NOT purchasable while /pricing calls it
Coming soon."* **It will fail the day you add `agency_pro` to `PURCHASABLE_PLANS`** — that is
intentional, and updating it is part of activating the tier.

---

## 11. Tests executed

All runs against `origin/main` (`dfe7a3a`) in its own isolated worktree with its own `node_modules`
and generated Prisma client. `prisma validate` used the throwaway loopback placeholder
`postgresql://throwaway:throwaway@127.0.0.1:5432/throwaway_validate?schema=public` — never a
production value.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) |
| `npx next build` | **PASS** (exit 0) |
| Full `scripts/*.test.ts` suite | **70 passed / 0 failed** |
| `agency-capacity.test.ts` | **40 / 0** |
| `capability-matrix.test.ts` | **40 / 0** |
| Mutation control (§10) | catalog reverted to $799 → **still 70 / 0** — the gap |

**Billing guards that do not exist on production**, run where they actually live (the unmerged draft
PRs), since a "billing tests" claim would otherwise be misleading:

| Guard | Branch | Result |
|---|---|---|
| `billing-identity.test.ts` | `release/pr1-critical-fixes-v2` (PR **#8**) | **39 / 0** |
| `billing-integrity.test.ts` | `release/pr1-critical-fixes-v2` | **31 / 0** |
| `critical-paths.test.ts` | `release/pr1-critical-fixes-v2` | **33 / 0** |
| `stripe-lifecycle.test.ts` | `release/pr2-stripe-lifecycle-v2` (PR **#9**) | **84 / 0** |

---

## 12. Owner actions

1. **Verify the lookup keys in Stripe (§9)** — confirm one active price holds
   `gcl_agency_pro_monthly_v2` at $699 and one holds `gcl_agency_pro_yearly_v2` at $6,990. This is
   the only step that determines whether the sync is actually complete.
2. **Do not run the admin "Sync products to Stripe" route** until Agency Pro is activated for sale —
   it will create the `_v2` prices.
3. **Decide on a catalog guard (§10)** before activating the tier.
4. **Decide on `.ai/PRICING-V2-ROADMAP.md` (§8)** — currently self-contradictory, deferred by ADR-0034.
5. **Activating Agency Pro is a separate change**, not a price sync: add `agency_pro` to
   `PURCHASABLE_PLANS`, update `scripts/billing-identity.test.ts`, and flip the `/pricing` card from
   "Coming soon". Not done here.
6. Optionally authorize the **Stripe MCP connector** (claude.ai connector settings) so the live
   catalog can be read directly in a future session.

---

## 13. Constraints observed

**No pricing amount modified · no other Stripe product touched · no Stripe price created · no Stripe
API call of any kind · no deploy · no merge · no push · no production database contact · no migration
· no secret printed.** No source file, test, configuration or migration was changed — the only edits
are the two documentation corrections in §7.

**Repository truth only.** Everything above is measured from `origin/main` = `dfe7a3a`. Nothing here
is evidence about your live Stripe catalog, which this session could not read.
