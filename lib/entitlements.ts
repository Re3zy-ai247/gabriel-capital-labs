import { prisma } from "./prisma";

// Free tier: 3 dispute letters per calendar month, no AI refinement.
// Premium: unlimited letters + Opus-powered AI refinement + AI strategist.
export const FREE_LETTER_LIMIT = 3;

export interface Entitlement {
  premium: boolean;
  plan: string;
  aiRefinement: boolean;
  letterLimit: number | null; // null = unlimited
  lettersUsedThisMonth: number;
  lettersRemaining: number | null; // null = unlimited
}

// A subscription counts as active for entitlement purposes in these states.
const ACTIVE_STATES = new Set(["active", "trialing", "past_due"]);

export function isPremium(user: {
  plan?: string | null;
  subscriptionStatus?: string | null;
  isAgency?: boolean | null;
}): boolean {
  // An agency account always has full features (its $399 plan covers its clients).
  if (user.isAgency) return true;
  if (user.plan === "premium") return true;
  return Boolean(user.subscriptionStatus && ACTIVE_STATES.has(user.subscriptionStatus));
}

function startOfMonthUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Computes the user's current entitlement, counting letters generated this
// calendar month. Letters are the source of truth for usage — no separate
// counter to drift out of sync.
export async function getEntitlement(user: {
  id: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  isAgency?: boolean | null;
  managedByAgencyId?: string | null;
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
  const letterLimit = premium ? null : FREE_LETTER_LIMIT;
  const lettersRemaining =
    letterLimit === null ? null : Math.max(0, letterLimit - lettersUsedThisMonth);
  return {
    premium,
    plan: premium ? "premium" : "free",
    aiRefinement: premium,
    letterLimit,
    lettersUsedThisMonth,
    lettersRemaining,
  };
}

export function canGenerateLetter(e: Entitlement): { allowed: boolean; reason?: string } {
  if (e.letterLimit === null) return { allowed: true };
  if (e.lettersUsedThisMonth >= e.letterLimit) {
    return {
      allowed: false,
      reason: `You've used all ${e.letterLimit} free dispute letters this month. Upgrade to Premium for unlimited letters and AI refinement.`,
    };
  }
  return { allowed: true };
}
