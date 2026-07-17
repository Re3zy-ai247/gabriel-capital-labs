// GIOS host port + CreditVector implementation — billing → PlanTier mapping
// (Platform Phase B, B2). The PORT is the GIOS mechanism; planTierFromUser is
// CreditVector's implementation over its own DB plan strings (set by the Stripe
// webhook — money stays the system of record; this maps its OUTPUT, it never
// prices anything). Capabilities drive plans; plans never drive capabilities:
// this file only names which bundle a subscription bought.
//
// Fail-closed: unknown/missing plan → "explorer" (the free bundle), never a
// permissive default. professional_plus has no purchasable DB value yet — it
// maps only when billing can actually sell it.
import type { PlanTier } from "@/lib/os/kernel/tiers";

/** The GIOS port: any application supplies one of these. */
export interface PlanTierProvider {
  tierFor(subject: { plan?: string | null; isAgency?: boolean | null; subscriptionStatus?: string | null }): PlanTier;
}

/** Canonical Stripe-webhook "counts as subscribed" states — single definition;
 *  lib/entitlements.ts imports this (no reverse import: entitlements → here). */
export const ACTIVE_SUBSCRIPTION_STATES: ReadonlySet<string> = new Set(["active", "trialing", "past_due"]);

/** CreditVector implementation over the DB user shape the webhook maintains.
 *  isAgency is a FLOOR: an agency account whose plan string points at a consumer
 *  tier (e.g. a downgraded-then-restored record) still resolves to agency — this
 *  is what keeps the B3 adapter byte-identical with the legacy gates. */
export function planTierFromUser(user: {
  plan?: string | null;
  isAgency?: boolean | null;
  subscriptionStatus?: string | null;
}): PlanTier {
  let tier: PlanTier;
  switch (user.plan) {
    case "enterprise": tier = "enterprise"; break;
    case "scale": tier = "scale"; break;
    case "agency_pro": tier = "agency_pro"; break;
    // plan="agency" without the isAgency grant (billing-unreachable) is treated
    // as the paid consumer tier — matches the legacy gates exactly (premium
    // true via the plan list; workspace limit 0 via the isAgency check).
    case "agency": tier = user.isAgency ? "agency" : "professional"; break;
    case "professional_plus": tier = "professional_plus"; break;
    case "premium": tier = "professional"; break; // legacy DB value for Professional
    default:
      tier = user.subscriptionStatus && ACTIVE_SUBSCRIPTION_STATES.has(user.subscriptionStatus)
        ? "professional"
        : "explorer";
  }
  const consumer = tier === "explorer" || tier === "professional" || tier === "professional_plus";
  if (user.isAgency && consumer) return "agency"; // the floor
  return tier;
}

export const creditVectorPlanTierProvider: PlanTierProvider = { tierFor: planTierFromUser };
