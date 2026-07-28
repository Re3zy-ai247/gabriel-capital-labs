# RC1 — Paid-path consent inventory

**Scope:** every path in this repository that can move money, grant a paid entitlement, or
change what a customer is billed. Compiled 2026-07-28 from the working tree at branch
`claude/creditvector-founder-library-jwnbhc` (Wave 2 range `27bc430..c7d1506`, plus the Wave 2.1
UI wiring described in §3).

**What this document is:** an inventory of the *paths* and their *technical* consent mechanisms.
It audits nothing else, and it makes **no legal determination**. Every question about what
consent is legally sufficient, what scope it must cover, how long it is retained, and whether any
existing customer needs re-acceptance is marked **COUNSEL REQUIRED** and left open.

**Line numbers** are as of the working tree *after* the Wave 2.1 UI wiring in §3.

**Kind of evidence:** everything below is read from source. Nothing here was observed running in
production. Statements about live Stripe Dashboard configuration are explicitly marked
**VERIFICATION REQUIRED — PRODUCTION** because they are not knowable from this repository.

---

## 1. The paths

Single entry point for all customer purchases: `POST /api/stripe/checkout`. It branches into
three distinct payment mechanisms, and **the consent mechanism is different in each branch**.

| # | Paid path | Route / branch | UI entry point(s) | Payment mechanism | Existing consent mechanism | Durable record in *this* repo | Live Stripe config dependency | Bypass risk | Required launch state |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **In-place subscription upgrade** (e.g. Professional → Agency) | `app/api/stripe/checkout/route.ts` — `billing.length === 1` branch, `stripe.subscriptions.update` | `app/pricing/PricingTiers.tsx:427` (Get Agency / Get Professional) · `app/agency/page.tsx:317` (Subscribe to Agency) · `app/billing/page.tsx:224` (Upgrade to Professional — reachable only when the account row still reads `free` while Stripe holds an active subscription) | Subscription item price swap, `proration_behavior: create_prorations`, `payment_behavior: pending_if_incomplete`. **No Checkout Session ever opens.** | **Explicit 428 gate** (Wave 2): `hasAcceptedTermsVersion(user.id)` → if absent, `isCurrentTermsVersion(body.acceptTerms)` must hold, then `recordTermsAcceptance(...)` **before** the Stripe mutation | **Yes — `TermsAcceptance` row** (`prisma/schema.prisma`, migration `20260728000000_terms_acceptance`, **authored, NOT applied**) | **None.** Stripe offers no consent mechanism on `subscriptions.update`; this path never depended on the Dashboard | **Low.** Fails closed: a direct API POST without acceptance gets 428 and Stripe is never called; no env flag disables the gate (pinned by `scripts/terms-acceptance.test.ts` §3). The UI is *not* the enforcement layer | **Migration must be applied BEFORE the code deploy.** Without the table, `findUnique` throws → 500 on every upgrade attempt. See §4 |
| 2 | **New Checkout subscription** (no active subscription on the customer) | same route — `stripe.checkout.sessions.create({ mode: "subscription" })` | same three entry points as row 1 | Stripe-hosted Checkout | `consent_collection.terms_of_service: "required"`, spread in via `CONSENT_COLLECTION` — **gated on `STRIPE_TOS_CONSENT === "1"`, default OFF** | **No.** Stripe's Session holds `consent.terms_of_service`; this repo stores only an *analytics pointer* (`tosConsent`, `checkoutSessionId`) in `track(...)` meta at `app/api/stripe/webhook/route.ts:130` — an event payload, not a consent record | **Yes, two of them:** `STRIPE_TOS_CONSENT=1` in the environment **and** a Terms of Service URL set in the live Stripe Dashboard. Neither is verifiable from this repository | **Medium.** If either dependency is unmet the checkbox never renders, **no consent is collected, and nothing in the app records that no consent was collected.** The failure is silent — `tosConsent` is simply `null` | **VERIFICATION REQUIRED — PRODUCTION.** Confirm both dependencies on a preview deploy before RC1, or accept row 2 as consentless. Consistency recommendation in §5 |
| 3 | **Letter pack — `letters_5`, $19 one-time** | same route — `body.product === "letters_5"`, `stripe.checkout.sessions.create({ mode: "payment" })` | `app/pricing/PricingTiers.tsx:303` (Buy 5 letters — $19) · `app/letters/page.tsx:342` (…or buy a one-time 5-letter pack) | Stripe-hosted Checkout, one-time payment | same `CONSENT_COLLECTION` spread, same OFF-by-default flag | **No — and weaker than row 2.** The webhook's `mode === "payment"` branch (`webhook/route.ts:134`) grants credits and records **no consent pointer at all**, not even in analytics | same as row 2 | **Medium**, same silent-inertness as row 2. Additionally `app/letters/page.tsx` ignores every non-OK response (`if (r.ok && j.url)` with no else) — a refusal there shows the customer nothing at all. Pre-existing; not introduced by Wave 2 | **VERIFICATION REQUIRED — PRODUCTION** (same two dependencies) |
| 4 | **Agency plan upgrade** (`plan: "agency"`) | not a separate branch — resolves to row 1 when an active subscription exists, row 2 when it does not | `app/agency/page.tsx:317` · `app/pricing/PricingTiers.tsx:427` (Agency card) | as row 1 / row 2 | as row 1 / row 2 | as row 1 / row 2 | as row 1 / row 2 | The *same button* takes two different consent paths depending on server-side subscription state the customer cannot see | as row 1 / row 2 |
| 5 | **Consumer plan upgrade** (`plan: "premium"`, or plan omitted) | as row 4 | `app/billing/page.tsx:224` (posts **no body**; the route reads an omitted plan as Professional) · `app/pricing/PricingTiers.tsx:427` (Professional card) | as row 1 / row 2 | as row 1 / row 2 | as row 1 / row 2 | as row 1 / row 2 | as row 4 | as row 1 / row 2 |
| 6 | **Unavailable tiers** — `agency_pro`, Professional+, Scale | same route — refused by the `PURCHASABLE_PLANS` list, `400` | no Buy button exists; `status: "soon"` cards render a `/register` link only | none — refused before any Stripe call | n/a | none | **None.** A direct POST of `plan: "agency_pro"` is refused with a plain-English 400 | **PASS as-is.** No consent surface because no purchase is possible |
| 7 | **Stripe Billing Portal** — card update, plan change, cancellation | `POST /api/stripe/portal` → `stripe.billingPortal.sessions.create` | `app/billing/page.tsx` (Manage / Cancel, Open Billing Portal) · `app/agency/page.tsx:275` · `app/pricing/PricingTiers.tsx` (portal offer after a 409) | Stripe-hosted portal | none, and none is available — Stripe owns this surface | none | Portal *configuration* (which plan changes are permitted) lives in the Dashboard | **Structural:** a plan change made inside the portal never passes through `/api/stripe/checkout`, so **the row-1 acceptance gate does not apply to it.** Whether the portal is configured to permit plan changes is **VERIFICATION REQUIRED — PRODUCTION** | **OWNER DECISION REQUIRED** on portal plan-change configuration; **COUNSEL REQUIRED** on whether portal-initiated changes need acceptance |
| 8 | **Admin provision / cancel / refund** | `POST /api/admin/billing/{provision,cancel,refund}` | admin console | operator action against Stripe (`subscriptions.cancel`, `subscriptions.update`, `refunds.create`) | none — operator paths, not customer purchases | none | live Stripe keys | An admin can grant a paid entitlement with no payment and no customer consent. That is the intended shape of an operator tool | **PASS as-is** for RC1; out of consent scope by design |
| 9 | **Agency mode enable (no billing)** | `POST /api/agency/enable` | `app/agency/page.tsx` — owner/preview block, admin-only UI | **none — grants the entitlement, charges nothing** | none | none | none | `SETUP_SECRET` or `role === "ADMIN"`. Not a paid path; listed because it grants a *paid-tier entitlement* for free | **PASS as-is.** Delete `SETUP_SECRET` from the environment post-setup (already noted in the route) |
| 10 | **Certified mail** | `POST /api/mail/prepare`, `/api/mail/[mailId]/approve`, `/api/mail/[mailId]/confirm` | mail send UI | **Not live.** `MAIL_LIVE` is OFF: `confirm` records a payment *intent* and reaches `QUEUED`, then stops. No card is charged and no provider is contacted | customer approval of the *mailing* (`approve`), which is an operational approval, not a terms acceptance | `MailManifest` status transitions | none today | Not a money-moving path in RC1 | **Re-inventory before `MAIL_LIVE=1`.** A priced path with a per-piece cost and no terms acceptance of its own |

---

## 2. What the table shows

Three live paid mechanisms, **three different consent stories**:

* **Row 1** has a durable internal record and a hard server-side gate — but the record is
  unreachable until the migration is applied.
* **Row 2** has consent held by Stripe, conditional on two dependencies invisible to this
  repository, plus a local pointer in the analytics stream.
* **Row 3** has consent held by Stripe under the same conditions, and **no local trace at all**.

A customer buying the $19 letter pack, a customer starting a $99 subscription, and a customer
moving from $99 to $399 therefore leave three different kinds of evidence — or, for rows 2 and 3
with the flag off, none.

---

## 3. What Wave 2.1 changed (UI only)

`components/TermsAccept.tsx` (new) plus wiring in the three row-1 callers. It renders the 428 as
a checkbox and a retry rather than a dead end. It is **not** an enforcement layer:

* checkbox is component-local state seeded `false` — never pre-checked, never hidden;
* the confirm action is refused until acceptance is explicit (`aria-disabled` + a hard early
  return + always-visible text, so the state is never signalled by colour alone);
* the terms **version is never constructed by the client** — it is read out of the server's own
  428 body and echoed back as an assertion, which the route re-validates against its published
  constant and does not record;
* the customer's other input survives (`/pricing` keeps the clicked tier *and* the
  monthly/annual toggle; `/agency` keeps the add-client form);
* no status code is shown; the server's sentence is.

**`app/letters/page.tsx` was deliberately left unchanged.** It buys `product: "letters_5"`, which
is row 3 — a payment-mode Checkout Session that can never reach the row-1 gate. Wiring an
acceptance checkbox there would prompt for a gate that does not exist.

---

## 4. Release-ordering risk (highest-severity item in this document)

`lib/terms.ts` calls `prisma.termsAcceptance.findUnique` on **every** in-place upgrade and
deliberately does not catch. If the application code ships before the migration is applied, the
table does not exist, the query throws, and **every in-place upgrade returns 500**. Rows 2 and 3
are unaffected (they never reach that code), so the failure would be partial and easy to miss.

Correct order, per `.ai/RUNBOOKS/schema-change.md` and the migration's own header:
apply `20260728000000_terms_acceptance` as an owner-gated release step **first**, verify the four
forward-validation queries, **then** deploy the code.

**NOT RUN — OWNER AUTHORIZATION REQUIRED:** the migration has not been applied, and this wave was
not authorized to apply it. Production has no `_prisma_migrations` history, so a Gate D baseline
may be required before `migrate deploy` will run.

---

## 5. Technical consistency recommendation (§Part C — technical only, not a legal determination)

**Question asked:** does Stripe `consent_collection` alone satisfy the *technical* requirement for
rows 2 and 3, or is a durable internal record also needed?

**Technical answer: `consent_collection` alone is not sufficient as a technical control**, for
three reasons that are all visible in source and none of which are legal judgements:

1. **It is inert by default and fails silently.** `CONSENT_COLLECTION` is `{}` unless
   `STRIPE_TOS_CONSENT === "1"`. With the flag off, checkout succeeds, the customer pays, and
   `cs.consent` is `null`. Nothing refuses, warns, or records the absence. A control whose
   disabled state is indistinguishable from its enabled state at every point the application can
   observe is not a control the application can rely on.
2. **The application cannot answer "has this customer accepted?" without calling Stripe.** Row 1
   answers it with one indexed lookup. Rows 2 and 3 require a Stripe API traversal per customer,
   and row 3 does not even store the Session id to traverse from.
3. **Row 3 keeps no local trace whatsoever.** The subscription branch of the webhook records
   `tosConsent` + `checkoutSessionId` into `track(...)` meta; the `mode === "payment"` branch
   records neither. That asymmetry is not a decision anyone made — it is an omission.

**Recommended technical shape — one internal record for every paid path:** write a
`TermsAcceptance` row on the Checkout paths too, at the point Stripe reports the acceptance
(`checkout.session.completed`, when `cs.consent?.terms_of_service === "accepted"`), with
`context` values such as `stripe_checkout_subscription` / `stripe_checkout_letter_pack`. Stripe
remains the system of record for what the customer saw and clicked; the row becomes the
application's queryable index into it, exactly as row 1 already is.

**Schema impact: none.** Confirmed against the authored migration:
* `context` is a plain `TEXT` column with no `@default` and no enum — new context values need no
  DDL. Only the `TermsContext` union in `lib/terms.ts` widens.
* `@@unique([userId, version])` already makes the write idempotent per revision.
* No new column, index, constraint, or relation is required.

**So the existing migration supports this unchanged — but this wave implements none of it.** The
write would live in `app/api/stripe/webhook/route.ts` and `lib/terms.ts`, neither of which this
agent owns, and it is a behaviour change to the live billing webhook. **Proposed, not built.**

**Consequence that must go to counsel, not be decided here:** `@@unique([userId, version])` makes
acceptance **per terms revision, not per transaction**. Under the shared-record shape, a customer
who accepted while buying a letter pack would find an existing row on a later in-place upgrade and
would **not** be asked again. Whether per-revision acceptance is sufficient at each separate point
of payment is **COUNSEL REQUIRED**. If counsel requires per-transaction acceptance, the unique key
is wrong for that purpose and the change becomes a schema change — which would then need its own
ADR and its own migration, and must not be retrofitted onto this one.

---

## 6. Open items, by owner

| Item | Status | Owner |
|---|---|---|
| Apply `20260728000000_terms_acceptance` before the code deploy | NOT RUN — OWNER AUTHORIZATION REQUIRED | Owner |
| `STRIPE_TOS_CONSENT=1` + Terms URL set in the live Stripe Dashboard (rows 2, 3) | VERIFICATION REQUIRED — PRODUCTION | Owner |
| Whether the Billing Portal is configured to permit plan changes (row 7) | VERIFICATION REQUIRED — PRODUCTION | Owner |
| One shared internal acceptance record across rows 1–3 (§5) | PROPOSED — not implemented | Owner (scope) |
| Per-revision vs per-transaction acceptance | COUNSEL REQUIRED | Counsel |
| Acceptance scope, retention period, CROA/FCRA posture, any backfill | COUNSEL REQUIRED — no backfill exists and none was fabricated | Counsel |
| Disabled paying customer retains a cancellation path — `currentAccount()` returns `null` for a `disabled` account (`lib/session.ts:30`), so `POST /api/stripe/portal` answers 401 and the portal cannot be opened | OWNER DECISION REQUIRED — reported, not changed (route not owned by this wave) | Owner |
| `app/letters/page.tsx` silently swallows non-OK checkout responses (pre-existing) | Reported, not changed — outside the smallest correct diff for this wave | Owner |
