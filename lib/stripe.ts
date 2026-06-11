import Stripe from "stripe";

// Lazy singleton. We do NOT throw at import time when the key is missing, so the
// app still builds/runs without Stripe configured — billing routes return a clear
// 503 instead. Configure STRIPE_SECRET_KEY in Vercel to enable billing.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key);
  return _stripe;
}

export const PREMIUM_LOOKUP_KEY = "gcl_premium_monthly";
export const PREMIUM_PRICE_CENTS = 9900; // $99.00 / month

// Resolve the recurring $99/mo price. Order of preference:
//   1. STRIPE_PRICE_ID env var (explicit)
//   2. an existing price with our lookup_key
//   3. create the product + price on the fly (idempotent via lookup_key)
// This means the operator never has to hand-create a price in the dashboard.
export async function resolvePremiumPriceId(stripe: Stripe): Promise<string> {
  const fromEnv = process.env.STRIPE_PRICE_ID;
  if (fromEnv) return fromEnv;

  const existing = await stripe.prices.list({
    lookup_keys: [PREMIUM_LOOKUP_KEY],
    active: true,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0].id;

  const product = await stripe.products.create({
    name: "Gabriel Capital Labs — Premium",
    description:
      "Unlimited AI-refined dispute letters, the AI dispute strategist, and 90-day progress tracking.",
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PREMIUM_PRICE_CENTS,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: PREMIUM_LOOKUP_KEY,
  });
  return price.id;
}

// Derive the canonical site URL for redirect targets.
export function siteUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  );
}
