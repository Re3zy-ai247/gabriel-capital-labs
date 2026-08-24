// Mail pricing — composed, never hardcoded. The final price a customer pays is
// built from layers so any single layer can change (per provider, per plan, per
// promo, per agency, per future white-label reseller) without touching callers.
//
//   provider cost  →  + platform fee  →  + markup  →  − plan/agency discount
//                     →  − coupon  →  total
//
// Pure functions only — fully unit-testable, no I/O, no provider knowledge.
import type { CostEstimate } from "./MailProvider";

export type PlanTier = "free" | "premium" | "agency" | "agency_pro";

// A pricing policy is data, not code — the founder (or a future white-label
// config) supplies one. Cents are integers; percentages are 0..1.
export interface PricingPolicy {
  platformFeeCents: number;      // flat CreditVector handling fee per piece
  markupRate: number;            // markup on provider cost (0.15 = +15%)
  // NOTE: certified/mail-class/page costs live in the PROVIDER estimate (single
  // source of truth) — pricing never re-adds them, so nothing is double-charged.
  // RC1-S6a (P0-6, B report S-26): the ENGINE stays — a future white-label
  // reseller policy may express one — but the PLATFORM policy below carries no
  // plan rates at all. A plan must never buy a consumer a cheaper mailing.
  planDiscountRate: Partial<Record<PlanTier, number>>;
  // Agencies can price at cost + a smaller markup; overrides markupRate when set.
  agencyMarkupRate?: number;
  whiteLabelId?: string;         // reserved: reseller-specific policy identity
  currency: "USD";
}

// The default platform policy. This is the ONLY place these numbers live; change
// them here (or pass a different policy) — never inline a price in a caller.
export const DEFAULT_PRICING_POLICY: PricingPolicy = {
  platformFeeCents: 99,
  markupRate: 0.15,
  // NEUTRALIZED (RC1-S6a · Founder D-3). This read { premium: 0.1, agency: 0.15,
  // agency_pro: 0.2 } — the one remaining surface where a consumer could SEE that
  // paying bought a better deal: a legacy Professional's mail quote was 10% lower
  // and their breakdown carried a literal "Premium discount" line. Empty means
  // every plan resolves to 0 through the unchanged `?? 0` lookup below, so the
  // quote is identical for everyone and the discount line never renders.
  // This is a hard pre-condition on MAIL_LIVE ever being turned on.
  planDiscountRate: {},
  agencyMarkupRate: 0.05,
  currency: "USD",
};

export interface Coupon {
  code: string;
  kind: "percent" | "amount"; // percent of subtotal, or flat cents off
  value: number;              // 0..1 for percent, cents for amount
}

export interface PriceInput {
  estimate: CostEstimate;      // provider's raw cost (already includes class/pages/certified)
  plan: PlanTier;
  isAgency: boolean;
  coupon?: Coupon;
  policy?: PricingPolicy;      // defaults to DEFAULT_PRICING_POLICY
}

export interface PriceLine { label: string; cents: number } // positive = charge, negative = credit

export interface PriceBreakdown {
  lines: PriceLine[];
  providerCostCents: number;
  platformFeeCents: number;
  markupCents: number;
  discountCents: number;       // plan/agency discount (>= 0)
  couponCents: number;         // coupon reduction (>= 0)
  subtotalCents: number;       // before discounts
  totalCents: number;          // final, floored at 0
  currency: "USD";
}

function round(n: number): number {
  return Math.round(n);
}

export function computePrice(input: PriceInput): PriceBreakdown {
  const policy = input.policy ?? DEFAULT_PRICING_POLICY;
  const providerCostCents = Math.max(0, round(input.estimate.providerCostCents));

  // Agencies get the (smaller) agency markup when one is configured.
  const markupRate = input.isAgency && policy.agencyMarkupRate != null
    ? policy.agencyMarkupRate
    : policy.markupRate;
  const markupCents = Math.max(0, round(providerCostCents * markupRate));
  const platformFeeCents = Math.max(0, round(policy.platformFeeCents));

  const subtotalCents = providerCostCents + platformFeeCents + markupCents;

  // Plan/agency discount applies to the subtotal.
  const discountRate = policy.planDiscountRate[input.plan] ?? 0;
  const discountCents = Math.max(0, round(subtotalCents * discountRate));

  // Coupon applies after the plan discount, on the discounted subtotal.
  const afterDiscount = Math.max(0, subtotalCents - discountCents);
  let couponCents = 0;
  if (input.coupon) {
    couponCents = input.coupon.kind === "percent"
      ? Math.max(0, round(afterDiscount * clamp01(input.coupon.value)))
      : Math.min(afterDiscount, Math.max(0, round(input.coupon.value)));
  }

  const totalCents = Math.max(0, afterDiscount - couponCents);

  const lines: PriceLine[] = [
    { label: "Postage & printing", cents: providerCostCents },
    { label: "Platform fee", cents: platformFeeCents },
    ...(markupCents ? [{ label: "Service", cents: markupCents }] : []),
    ...(discountCents ? [{ label: `${planLabel(input.plan)} discount`, cents: -discountCents }] : []),
    ...(couponCents ? [{ label: `Coupon ${input.coupon!.code}`, cents: -couponCents }] : []),
  ];

  return {
    lines, providerCostCents, platformFeeCents, markupCents,
    discountCents, couponCents, subtotalCents, totalCents, currency: policy.currency,
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function planLabel(plan: PlanTier): string {
  return { free: "Free", premium: "Premium", agency: "Agency", agency_pro: "Agency Pro" }[plan];
}
