import { prisma } from "./prisma";

// Free tier: 3 dispute letters per calendar month, no AI refinement. Purchased
// letter-pack credits are spent once the monthly free allowance is exhausted.
// Premium / Agency / Agency Pro: unlimited letters + AI.
export const FREE_LETTER_LIMIT = 3;

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

const ACTIVE_STATES = new Set(["active", "trialing", "past_due"]);

export function isPremium(user: {
  plan?: string | null;
  subscriptionStatus?: string | null;
  isAgency?: boolean | null;
}): boolean {
  if (user.isAgency) return true;
  if (user.plan === "premium" || user.plan === "agency" || user.plan === "agency_pro") return true;
  return Boolean(user.subscriptionStatus && ACTIVE_STATES.has(user.subscriptionStatus));
}

// Managed-client cap by agency tier. ADMINs and Agency Pro are unlimited (null);
// the base Agency plan is capped; non-agency accounts can't hold clients.
export function agencyClientLimit(user: {
  role?: string | null;
  plan?: string | null;
  isAgency?: boolean | null;
}): number | null {
  if (user.role === "ADMIN") return null;
  if (user.plan === "agency_pro") return null;
  if (user.isAgency) return 50;
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
      reason: `You've used your ${FREE_LETTER_LIMIT} free dispute letters this month. Upgrade to Premium for unlimited letters, or buy a letter pack.`,
    };
  }
  return { allowed: true };
}
