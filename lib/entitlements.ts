import { prisma } from "./prisma";
import { CAPABILITY_MATRIX } from "@/config/capabilityMatrix";
import { grantForTier, limitForTier } from "@/lib/os/host/tierResolver";
import { planTierFromUser, ACTIVE_SUBSCRIPTION_STATES } from "@/lib/os/host/billingTier";
import type { CapabilityKey } from "@/lib/os/kernel";

// Free tier: 3 dispute letters per calendar month, no AI refinement. Purchased
// letter-pack credits are spent once the monthly free allowance is exhausted.
// Premium / Agency / Agency Pro: unlimited letters + AI.
export const FREE_LETTER_LIMIT = 3;

// ── Platform Phase B, B3 (flag-gated adapter — DEFAULT OFF) ──────────────────
// When CAPABILITY_PLATFORM=true, isPremium/agencyClientLimit derive from the
// capability matrix through the tier resolver instead of the legacy boolean
// branches. The public API shapes are frozen; the golden guard
// (scripts/platform-foundation.test.ts) asserts BYTE-IDENTICAL output between
// the two paths for every BILLING-PRODUCED user shape (bare shapes billing
// never writes are pinned there explicitly, incl. known divergences, and get a
// DB scan re-check at the B4 gate before any route flips — owner-gated).
// The GRANDFATHER CLAUSE stays with the product (sold entitlements never
// shrink): it is applied here as a per-account override on top of the matrix —
// the same override mechanism Enterprise session limits will use.
export function capabilityPlatformEnabled(): boolean {
  return process.env.CAPABILITY_PLATFORM === "true";
}

const ANALYZE = "credit.response.analyze" as CapabilityKey;

/** Matrix-derived premium: the paid axis (response.analyze), using the same
 *  flag-aware law as kernel resolve() — granted AND flagged on. */
export function isPremiumViaPlatform(user: {
  plan?: string | null;
  subscriptionStatus?: string | null;
  isAgency?: boolean | null;
}): boolean {
  const grant = grantForTier(planTierFromUser(user), CAPABILITY_MATRIX);
  return grant.capabilities.has(ANALYZE) && grant.flags.get(ANALYZE) === true;
}

/** Matrix-derived workspace cap + grandfather override. ADMIN = unlimited. */
export function agencyClientLimitViaPlatform(user: {
  role?: string | null;
  plan?: string | null;
  isAgency?: boolean | null;
  createdAt?: Date | string | null;
}): number | null {
  if (user.role === "ADMIN") return null;
  const created = user.createdAt ? new Date(user.createdAt).getTime() : Number.POSITIVE_INFINITY;
  if (created < NEW_PACKAGING_EFFECTIVE) {
    // Sold-entitlement overrides (pre-packaging accounts keep what they bought).
    if (user.plan === "agency_pro") return null;
    if (user.isAgency && user.plan !== "scale" && user.plan !== "enterprise") return 20;
  }
  return limitForTier(planTierFromUser(user), CAPABILITY_MATRIX, "CLIENT_WORKSPACE_LIMIT");
}

export interface Entitlement {
  premium: boolean;
  plan: string;
  aiRefinement: boolean;
  letterLimit: number | null; // null = unlimited; otherwise the monthly free cap
  lettersUsedThisMonth: number;
  lettersRemaining: number | null; // null = unlimited; includes purchased credits
  letterCredits: number; // one-time purchased credits remaining
  freeMonthlyRemaining: number; // free letters left this month (0 for premium)
}

const ACTIVE_STATES = ACTIVE_SUBSCRIPTION_STATES; // single canonical definition (lib/os/host/billingTier.ts)

export function isPremium(user: {
  plan?: string | null;
  subscriptionStatus?: string | null;
  isAgency?: boolean | null;
}): boolean {
  if (capabilityPlatformEnabled()) return isPremiumViaPlatform(user);
  if (user.isAgency) return true;
  if (user.plan === "premium" || user.plan === "agency" || user.plan === "agency_pro") return true;
  return Boolean(user.subscriptionStatus && ACTIVE_STATES.has(user.subscriptionStatus));
}

// Managed-client (workspace) cap by agency tier — the live source of truth for
// creation-gating. Approved packaging (2026-07-16): Agency 15 (solo operator) ·
// Agency Pro 40 (growing team) · Scale 100 (established agency) · Enterprise
// negotiated (null until per-account entitlement config exists). ADMINs are
// unlimited. Existing clients above a cap are NEVER locked or deleted — the cap
// gates NEW workspace creation only (enforced in app/api/agency/clients POST).
//
// GRANDFATHER CLAUSE: accounts created before the packaging effective date keep
// the entitlement they were sold — Agency was marketed as "up to 20 clients" and
// Agency Pro as "unlimited clients". A sold entitlement is never retroactively
// reduced. (Prices got the same treatment: AGENCY_PRO_LEGACY_* in lib/stripe.ts.)
//
// These values must stay in lockstep with config/capabilityMatrix.ts (dormant
// Phase-B data) — a guard should compare them when the matrix activates.
const NEW_PACKAGING_EFFECTIVE = Date.UTC(2026, 6, 17); // 2026-07-17 — approved packaging ships

export function agencyClientLimit(user: {
  role?: string | null;
  plan?: string | null;
  isAgency?: boolean | null;
  createdAt?: Date | string | null;
}): number | null {
  if (capabilityPlatformEnabled()) return agencyClientLimitViaPlatform(user);
  if (user.role === "ADMIN") return null;
  const created = user.createdAt ? new Date(user.createdAt).getTime() : Number.POSITIVE_INFINITY;
  const legacy = created < NEW_PACKAGING_EFFECTIVE;
  if (user.plan === "enterprise") return null; // negotiated/unlimited until configurable entitlements land
  if (user.plan === "scale") return 100;
  if (user.plan === "agency_pro") return legacy ? null : 40; // sold "unlimited" before the change
  if (user.isAgency) return legacy ? 20 : 15; // sold "up to 20" before the change
  return 0;
}

function startOfMonthUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function getEntitlement(user: {
  id: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  isAgency?: boolean | null;
  managedByAgencyId?: string | null;
  letterCredits?: number | null;
}): Promise<Entitlement> {
  let premium = isPremium(user);
  // A managed client inherits its agency's entitlement (the agency is the payer).
  if (!premium && user.managedByAgencyId) {
    const agency = await prisma.user.findUnique({
      where: { id: user.managedByAgencyId },
      select: { plan: true, subscriptionStatus: true, isAgency: true },
    });
    if (agency && isPremium(agency)) premium = true;
  }

  const lettersUsedThisMonth = await prisma.letter.count({
    where: { userId: user.id, createdAt: { gte: startOfMonthUTC() } },
  });
  const letterCredits = Math.max(0, user.letterCredits ?? 0);

  if (premium) {
    return {
      premium: true,
      plan: "premium",
      aiRefinement: true,
      letterLimit: null,
      lettersUsedThisMonth,
      lettersRemaining: null,
      letterCredits,
      freeMonthlyRemaining: 0,
    };
  }

  const freeMonthlyRemaining = Math.max(0, FREE_LETTER_LIMIT - lettersUsedThisMonth);
  return {
    premium: false,
    plan: "free",
    aiRefinement: false,
    letterLimit: FREE_LETTER_LIMIT,
    lettersUsedThisMonth,
    lettersRemaining: freeMonthlyRemaining + letterCredits,
    letterCredits,
    freeMonthlyRemaining,
  };
}

export function canGenerateLetter(e: Entitlement): { allowed: boolean; reason?: string } {
  if (e.lettersRemaining === null) return { allowed: true };
  if (e.lettersRemaining <= 0) {
    return {
      allowed: false,
      reason: `You've used your ${FREE_LETTER_LIMIT} free dispute letters this month. Upgrade to Professional for unlimited letters, or buy a letter pack.`,
    };
  }
  return { allowed: true };
}
