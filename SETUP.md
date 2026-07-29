# Gabriel Capital Labs — Go-Live Setup

> ⚠️ **HISTORICAL (go-live is complete; e.g. `SETUP_SECRET` was deleted 2026-06-16).** Current env vars/services: [.ai/INTEGRATIONS.md](.ai/INTEGRATIONS.md) · owner actions: [.ai/RUNBOOKS/admin-actions.md](.ai/RUNBOOKS/admin-actions.md).

Everything in the code is done. To switch billing + accounts on, set the
environment variables below in **Vercel → Project Settings → Environment
Variables**, redeploy, then run the one-time bootstrap. ~10 minutes total.

> ⚠️ **Never put secret keys in the code or git.** They only go in Vercel env vars.

---

## 1. Rotate the leaked NextAuth secret (do this first)

The old `NEXTAUTH_SECRET` was committed to the public repo and is compromised.
Generate a new one and set it in Vercel:

```bash
openssl rand -base64 32        # paste the output as NEXTAUTH_SECRET
```

```
NEXTAUTH_SECRET = <the value you just generated>
```

Also confirm:

```
NEXTAUTH_URL = https://gabriel-capital-labs.vercel.app
```

---

## 2. Stripe

From your Stripe dashboard (the screen you sent me), copy the two keys and add:

```
STRIPE_SECRET_KEY                  = sk_test_...   (or sk_live_... when you go live)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_...   (or pk_live_...)
```

You do **not** need to create a product or price — the app auto-creates the
$99/mo "Premium" price the first time someone checks out.

### Webhook (so subscriptions sync back)

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://gabriel-capital-labs.vercel.app/api/stripe/webhook`
3. Events to send: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`
4. Copy the signing secret it gives you and add:

```
STRIPE_WEBHOOK_SECRET = whsec_...
```

> Test vs live: use `sk_test_`/`pk_test_` keys + a **test-mode** webhook while
> testing (pay with card `4242 4242 4242 4242`, any future expiry/CVC). Swap to
> `sk_live_`/`pk_live_` + a live-mode webhook when you're ready for real money.

---

## 3. AI letter refinement

```
ANTHROPIC_API_KEY = sk-ant-...     (from console.anthropic.com → API Keys)
```

Without this, Premium users still get fully-grounded template letters; with it,
Premium letters are refined by KAI, CreditVector's intelligence layer, using
FCRA/FDCPA law + case law. The free tier never calls the API.

---

## 4. Admin + demo accounts (one-time bootstrap)

Add these env vars (generate `SETUP_SECRET` with `openssl rand -hex 24`):

```
SETUP_SECRET   = <a long random string>
ADMIN_EMAIL    = admin@gabrielcapitallabs.com
ADMIN_PASSWORD = <the admin password you want>
```

**Redeploy** (so the env vars and new DB columns are live), then run once from
your terminal (substitute your real `SETUP_SECRET`):

```bash
curl -X POST https://gabriel-capital-labs.vercel.app/api/admin/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"secret":"<your SETUP_SECRET>"}'
```

You should get back `{"ok":true,...}`. This creates:

| Account | Email | Password | Use |
|---|---|---|---|
| **Admin** | `admin@gabrielcapitallabs.com` | *(your ADMIN_PASSWORD)* | `/admin` dashboard — users, MRR, conversion |
| **Demo**  | `demo@gabrielcapitallabs.com`  | `demo1234` | A loaded test account to click through the whole app |

**After it succeeds, delete `SETUP_SECRET` from Vercel** so the endpoint can't be
run again.

---

## 5. Verify

- Sign in as **demo** → Dashboard shows tradelines → generate a letter (free
  tier caps at 3/month).
- On **/pricing** click *Upgrade* → Stripe checkout → pay with `4242…` test card →
  you land on **/billing** showing **Premium** → generate an AI-refined letter.
- Sign in as **admin** → `/admin` shows the metrics.

---

## Quick env-var checklist

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | already set (Prisma Postgres) |
| `NEXTAUTH_SECRET` | ✅ | **rotate** — see step 1 |
| `NEXTAUTH_URL` | ✅ | your live URL |
| `STRIPE_SECRET_KEY` | ✅ for billing | `sk_test_`/`sk_live_` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ for billing | `pk_test_`/`pk_live_` |
| `STRIPE_WEBHOOK_SECRET` | ✅ for billing | `whsec_` |
| ~~`STRIPE_PRICE_ID`~~ | **removed 2026-07-16** | no longer read by any code. Prices resolve by `lookup_key` in `lib/stripe.ts`; setting this has no effect |
| `ANTHROPIC_API_KEY` | ✅ for AI | premium letter refinement |
| `LLM_MODEL` | optional | defaults to `claude-opus-4-8` |
| `SETUP_SECRET` | one-time | delete after bootstrap |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | one-time | your admin login |
