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

export type PaidPlan = "premium" | "agency" | "agency_pro";
export type BillingInterval = "month" | "year";

// Price points (cents). Annual = ~10 months (2 months free).
export const PREMIUM_PRICE_CENTS = 9900; // $99 / mo
export const AGENCY_PRICE_CENTS = 39900; // $399 / mo
export const AGENCY_PRO_PRICE_CENTS = 69900; // $699 / mo (approved packaging 2026-07-16)
// Legacy Agency Pro price points (pre-2026-07-16 provisioning was $799). Any
// subscription already on these prices must keep resolving to agency_pro.
export const AGENCY_PRO_LEGACY_MONTH_CENTS = 79900;
export const AGENCY_PRO_LEGACY_YEAR_CENTS = 799000;
export const LETTER_PACK_PRICE_CENTS = 1900; // $19 one-time
export const LETTER_PACK_CREDITS = 5;

// Backwards-compatible lookup keys (the original monthly prices keep theirs so
// existing Stripe prices are reused).
export const PREMIUM_LOOKUP_KEY = "gcl_premium_monthly";
export const AGENCY_LOOKUP_KEY = "gcl_agency_monthly";

// Stripe product tax codes (required when Managed Payments is enabled so Stripe
// can compute/remit sales tax). Consumer plans use SaaS "personal use"; the
// agency tiers are B2B → SaaS "business use". Override the IDs via env if Stripe
// changes them. Verify the human-readable label in the dashboard.
export const TAX_CODE_SAAS_PERSONAL = process.env.STRIPE_TAX_CODE_SAAS_PERSONAL || "txcd_10103000";
export const TAX_CODE_SAAS_BUSINESS = process.env.STRIPE_TAX_CODE_SAAS_BUSINESS || "txcd_10103001";

interface ProductDef {
  key: string;
  name: string;
  description: string;
  taxCode: string;
}

// One Stripe Product per plan; prices hang off it. `key` is stored in product
// metadata (gcl_product) so resolveProduct can find it again without lookup_keys.
const PRODUCTS: Record<string, ProductDef> = {
  premium: {
    key: "premium",
    name: "CreditVector — Professional",
    description: "Unlimited AI-refined dispute letters, the AI dispute strategist, and 90-day progress tracking.",
    taxCode: TAX_CODE_SAAS_PERSONAL,
  },
  agency: {
    key: "agency",
    name: "CreditVector — Agency",
    description: "Manage clients in their own workspaces with the full analysis and letter engine. Up to 15 active client workspaces — built for solo operators.",
    taxCode: TAX_CODE_SAAS_BUSINESS,
  },
  agency_pro: {
    key: "agency_pro",
    name: "CreditVector — Agency Pro",
    description: "Everything in Agency with up to 40 active client workspaces, team collaboration, analytics, and bulk actions — built for growing teams.",
    taxCode: TAX_CODE_SAAS_BUSINESS,
  },
  letters_5: {
    key: "letters_5",
    name: "CreditVector — 5 Dispute Letters",
    description: "A one-time pack of 5 additional dispute letters.",
    taxCode: TAX_CODE_SAAS_PERSONAL,
  },
};

// Older product names (pre-rebrand) mapped to their catalog key, so tax-code
// reconciliation can also fix products created before the catalog existed.
const LEGACY_PRODUCT_NAMES: Record<string, string> = {
  "Gabriel Capital Labs — Premium": "premium",
  "Gabriel Capital Labs — Agency": "agency",
};

interface PriceDef {
  lookup: string;
  product: string;
  amountCents: number;
  interval: BillingInterval | null; // null = one-time
}

// All purchasable prices, keyed by `<plan>_<interval>` (subscriptions) or product key (one-time).
export const PRICES: Record<string, PriceDef> = {
  premium_month: { lookup: PREMIUM_LOOKUP_KEY, product: "premium", amountCents: PREMIUM_PRICE_CENTS, interval: "month" },
  premium_year: { lookup: "gcl_premium_yearly", product: "premium", amountCents: 99000, interval: "year" },
  agency_month: { lookup: AGENCY_LOOKUP_KEY, product: "agency", amountCents: AGENCY_PRICE_CENTS, interval: "month" },
  agency_year: { lookup: "gcl_agency_yearly", product: "agency", amountCents: 399000, interval: "year" },
  // v2 lookup keys: Stripe prices are amount-immutable and resolvePrice matches by
  // lookup_key WITHOUT verifying unit_amount — reusing the old keys would forever
  // resolve to any already-provisioned $799 price. New keys guarantee the $699
  // catalog provisions fresh; legacy $799 subs still map to agency_pro in planForPrice.
  agency_pro_month: { lookup: "gcl_agency_pro_monthly_v2", product: "agency_pro", amountCents: AGENCY_PRO_PRICE_CENTS, interval: "month" },
  agency_pro_year: { lookup: "gcl_agency_pro_yearly_v2", product: "agency_pro", amountCents: 699000, interval: "year" },
  letters_5: { lookup: "gcl_letters_5", product: "letters_5", amountCents: LETTER_PACK_PRICE_CENTS, interval: null },
};

// Find-or-create the Stripe Product for a plan key, tagged with metadata so it's
// reused across its monthly/annual prices.
async function resolveProduct(stripe: Stripe, productKey: string): Promise<string> {
  const def = PRODUCTS[productKey];
  const list = await stripe.products.list({ active: true, limit: 100 });
  const existing = list.data.find((p) => p.metadata?.gcl_product === productKey || p.name === def.name);
  if (existing) {
    // Keep the tax code in sync (needed for Managed Payments eligibility).
    const current = typeof existing.tax_code === "string" ? existing.tax_code : existing.tax_code?.id ?? null;
    if (def.taxCode && current !== def.taxCode) {
      await stripe.products.update(existing.id, { tax_code: def.taxCode });
    }
    return existing.id;
  }
  const created = await stripe.products.create({
    name: def.name,
    description: def.description,
    tax_code: def.taxCode,
    metadata: { gcl_product: productKey },
  });
  return created.id;
}

// Ensure every recognized product (current or legacy-named) carries its correct tax
// code AND description — so a catalog copy change (e.g. the managed-client cap) reaches
// the live product, whose description is otherwise only set at creation time. Idempotent;
// returns the names updated. Run from the provision route ("Sync products to Stripe").
export async function reconcileTaxCodes(stripe: Stripe): Promise<string[]> {
  const list = await stripe.products.list({ active: true, limit: 100 });
  const updated: string[] = [];
  for (const p of list.data) {
    const key = p.metadata?.gcl_product || LEGACY_PRODUCT_NAMES[p.name] || (Object.values(PRODUCTS).find((d) => d.name === p.name)?.key ?? "");
    const def = key ? PRODUCTS[key] : undefined;
    if (!def) continue;
    const update: Stripe.ProductUpdateParams = {};
    const currentTax = typeof p.tax_code === "string" ? p.tax_code : p.tax_code?.id ?? null;
    if (def.taxCode && currentTax !== def.taxCode) update.tax_code = def.taxCode;
    if (p.description !== def.description) update.description = def.description;
    // Self-heal the display name so a catalog rename (e.g. Premium → Professional)
    // reaches the live product; product name is otherwise only set at creation.
    if (p.name !== def.name) update.name = def.name;
    if (Object.keys(update).length > 0) {
      await stripe.products.update(p.id, update);
      updated.push(p.name);
    }
  }
  return updated;
}

// Resolve a price id by catalog key. Order: existing price by lookup_key →
// create the price. (The legacy STRIPE_PRICE_ID env override was removed
// 2026-07-16 — verified unset in every Vercel environment; lookup-key
// resolution is the sole production path.)
export async function resolvePrice(stripe: Stripe, key: string): Promise<string> {
  const def = PRICES[key];
  if (!def) throw new Error(`Unknown price key: ${key}`);

  const existing = await stripe.prices.list({ lookup_keys: [def.lookup], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const product = await resolveProduct(stripe, def.product);
  const price = await stripe.prices.create({
    product,
    unit_amount: def.amountCents,
    currency: "usd",
    lookup_key: def.lookup,
    ...(def.interval ? { recurring: { interval: def.interval } } : {}),
  });
  return price.id;
}

// Resolve a subscription price for a plan + interval.
export async function resolvePriceId(
  stripe: Stripe,
  plan: PaidPlan,
  interval: BillingInterval = "month"
): Promise<string> {
  return resolvePrice(stripe, `${plan}_${interval}`);
}

// Map a subscription's price back to a plan tier (for the webhook). Checks the
// most specific lookup-key prefix first.
export function planForPrice(price: { lookup_key?: string | null; unit_amount?: number | null } | null | undefined): PaidPlan {
  const lk = price?.lookup_key ?? "";
  if (lk.startsWith("gcl_agency_pro")) return "agency_pro";
  if (lk.startsWith("gcl_agency")) return "agency";
  if (lk.startsWith("gcl_premium")) return "premium";
  const amt = price?.unit_amount ?? 0;
  if (
    amt === AGENCY_PRO_PRICE_CENTS ||
    amt === 699000 ||
    amt === AGENCY_PRO_LEGACY_MONTH_CENTS ||
    amt === AGENCY_PRO_LEGACY_YEAR_CENTS
  )
    return "agency_pro";
  if (amt === AGENCY_PRICE_CENTS || amt === 399000) return "agency";
  return "premium";
}

// Legacy single-price resolvers kept for any older callers.
export async function resolvePremiumPriceId(stripe: Stripe): Promise<string> {
  return resolvePrice(stripe, "premium_month");
}
export async function resolveAgencyPriceId(stripe: Stripe): Promise<string> {
  return resolvePrice(stripe, "agency_month");
}

// Derive the canonical site URL for redirect targets.
export function siteUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  );
}

// G-14: real MRR from live Stripe subscriptions, normalized to monthly cents.
// Definition: sums active + past_due subscription items (committed revenue —
// past_due until Stripe cancels it); EXCLUDES trialing (no money collected yet)
// and comped/entitlement-only accounts (they have no Stripe subscription).
// Yearly prices count at 1/12 per month. Returns null when Stripe is
// unconfigured or the API errors — callers fall back to a labeled estimate.
export async function liveMrrCents(): Promise<number | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    let total = 0;
    for (const status of ["active", "past_due"] as const) {
      for await (const sub of stripe.subscriptions.list({ status, limit: 100 })) {
        for (const item of sub.items.data) {
          const price = item.price;
          if (!price?.recurring || price.unit_amount == null) continue;
          const per = price.unit_amount * (item.quantity ?? 1);
          const { interval, interval_count: n } = price.recurring;
          if (interval === "month") total += per / n;
          else if (interval === "year") total += per / (12 * n);
          // week/day intervals aren't sold — skip rather than guess.
        }
      }
    }
    return Math.round(total);
  } catch (e) {
    console.error("liveMrrCents failed (falling back to estimate)", e);
    return null;
  }
}
