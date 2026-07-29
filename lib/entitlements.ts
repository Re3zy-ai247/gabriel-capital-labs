import { prisma } from "./prisma";
import { PRODUCT_EVENTS } from "@/lib/events";
import { CAPABILITY_MATRIX } from "@/config/capabilityMatrix";
import { grantForTier, limitForTier } from "@/lib/os/host/tierResolver";
import { planTierFromUser, ACTIVE_SUBSCRIPTION_STATES } from "@/lib/os/host/billingTier";
import type { CapabilityKey } from "@/lib/os/kernel";
import { resolveAgencyCapacity } from "@/lib/agencyCapacity";

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
// creation-gating. Packaging v3 (ADR-0031): Agency 15 (solo operator) · Agency Pro 30
// (growing team) · Scale 50 (established agency) · Enterprise custom. The canonical
// values + effective-date grandfathering live in lib/agencyCapacity.resolveAgencyCapacity;
// this function only layers ADMIN=unlimited + the dormant CAPABILITY_PLATFORM adapter on
// top. ADMINs are unlimited. Existing clients above a cap are NEVER locked or deleted —
// the cap gates NEW workspace creation only (enforced in app/api/agency/clients POST).
//
// GRANDFATHER CLAUSE (in the resolver): accounts keep the capacity their era was sold —
// legacy Agency "up to 20", legacy Agency Pro "unlimited", v2 Pro/Scale 40/100 — a sold
// entitlement is never retroactively reduced. config/capabilityMatrix imports the same
// canonical constants, so the dormant declaration can never drift from this live gate.
const NEW_PACKAGING_EFFECTIVE = Date.UTC(2026, 6, 17); // 2026-07-17 — approved packaging ships

export function agencyClientLimit(user: {
  role?: string | null;
  plan?: string | null;
  isAgency?: boolean | null;
  createdAt?: Date | string | null;
}): number | null {
  if (capabilityPlatformEnabled()) return agencyClientLimitViaPlatform(user);
  if (user.role === "ADMIN") return null;
  // Canonical resolver (ADR-0031 §4) — THE single source of truth for workspace capacity.
  // Packaging v3 (Agency 15 · Pro 30 · Scale 50) behind effective dates, with the
  // grandfather clause preserving sold entitlements (legacy Agency 20 · Pro unlimited);
  // no cap ever shrinks retroactively. Add-on packs default to 0 (no storage yet — wired
  // by the later billing slice). Server values only; never a client-supplied capacity.
  return resolveAgencyCapacity({ plan: user.plan, isAgency: user.isAgency, createdAt: user.createdAt }).workspaceLimit;
}

function startOfMonthUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Sum this month's dispute_created events from the APPEND-ONLY ProductEvent ledger.
// Letter rows alone cannot meter usage: a user may DELETE their own letters
// (DELETE /api/letters/[id]), which would reset the free-tier meter and make the 402
// paywall bypassable. No route deletes ProductEvent rows, so the ledger is the honest
// floor. Volume is tiny (the free tier is 3/month), so a fetch + JS sum is correct and
// cheap — no JSON aggregation. Fails toward CHARGING: an event whose meta.count is
// missing or unparseable still counts as 1 letter, never 0. Raw SQL matches the other
// ProductEvent readers (lib/events.ts, lib/analytics/aggregate.ts) — self-heal table.
async function lettersUsedFromLedger(userId: string, since: Date): Promise<number> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ meta: unknown }>>(
      `SELECT "meta" FROM "ProductEvent" WHERE "userId" = $1 AND "name" = $2 AND "createdAt" >= $3`,
      userId,
      PRODUCT_EVENTS.disputeCreated,
      since
    );
    let total = 0;
    for (const r of rows) {
      const raw = (r.meta as Record<string, unknown> | null)?.count;
      const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
      total += Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    }
    return total;
  } catch (e) {
    // The ledger is a legacy self-heal table; if it is unreachable, degrade to the
    // Letter row count (today's behavior) rather than failing every entitlement read.
    console.error("entitlements: ledger usage read failed, using row count:", e);
    return 0;
  }
}

/**
 * Spend purchased letter-pack credits for letters generated beyond the free monthly
 * allowance. THE decrement path for every letter surface (generate + round 2) so the
 * accounting exists in exactly one place.
 *
 * The decrement is clamped to the credits actually held AND conditional on the row
 * still holding them, so a concurrent spend can never drive the balance negative — a
 * negative balance would silently eat a future letter-pack purchase.
 */
export async function spendLetterCredits(
  userId: string,
  e: Pick<Entitlement, "premium" | "freeMonthlyRemaining" | "letterCredits">,
  generated: number
): Promise<void> {
  if (e.premium || generated <= 0) return;
  const beyondFree = Math.max(0, generated - Math.max(0, e.freeMonthlyRemaining));
  const fromCredits = Math.min(beyondFree, Math.max(0, e.letterCredits));
  if (fromCredits <= 0) return;

  const spent = await prisma.user.updateMany({
    where: { id: userId, letterCredits: { gte: fromCredits } },
    data: { letterCredits: { decrement: fromCredits } },
  });
  if (spent.count === 0) {
    // Lost the race (or the balance was already below the amount): clamp at zero
    // instead of leaving a negative balance behind.
    await prisma.user.updateMany({
      where: { id: userId, letterCredits: { lt: fromCredits } },
      data: { letterCredits: 0 },
    });
  }
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

  // Monthly usage = MAX(deletable Letter rows, append-only ProductEvent ledger).
  // The ledger closes the delete-to-reset paywall bypass; the MAX means the meter can
  // never read LOWER than it does today, so pre-ledger accounts are not retroactively
  // granted free letters.
  const monthStart = startOfMonthUTC();
  const [letterRowsThisMonth, ledgerUsedThisMonth] = await Promise.all([
    prisma.letter.count({ where: { userId: user.id, createdAt: { gte: monthStart } } }),
    lettersUsedFromLedger(user.id, monthStart),
  ]);
  const lettersUsedThisMonth = Math.max(letterRowsThisMonth, ledgerUsedThisMonth);
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
