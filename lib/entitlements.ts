import { prisma } from "./prisma";
import { PRODUCT_EVENTS } from "@/lib/events";
import { CAPABILITY_MATRIX } from "@/config/capabilityMatrix";
import { grantForTier, limitForTier } from "@/lib/os/host/tierResolver";
import { planTierFromUser, ACTIVE_SUBSCRIPTION_STATES } from "@/lib/os/host/billingTier";
import type { CapabilityKey } from "@/lib/os/kernel";
import { resolveAgencyCapacity } from "@/lib/agencyCapacity";

// ── RC1-S6a · THE FREE-CONSUMER INVARIANT (Founder D-3 / D-4 / P0-6) ─────────
//
// NO PAYMENT STATUS, PAYER IDENTITY, CREDIT BALANCE, PLAN, SUBSCRIPTION OR
// AGENCY RELATIONSHIP CHANGES THE ASSISTANCE A CONSUMER RECEIVES.
//
// getEntitlement() is the single resolver every consumer surface reads, and it
// is now STRUCTURALLY incapable of violating that: its parameter type cannot
// see `plan`, `subscriptionStatus`, `isAgency` or `managedByAgencyId`. A free
// account, a legacy Professional, a credit-holding account, an agency-managed
// consumer and an agency payer all receive the identical object.
//
// What survives, and why:
//   · isPremium() / agencyClientLimit() — BILLING-RECORD and B2B-capacity
//     predicates. They describe what an account row BOUGHT, never what a
//     consumer may do. No consumer-assistance surface may consult them.
//   · spendLetterCredits() — FROZEN (D-3). Purchased letter credits are a
//     historical balance that is preserved and displayed, never consumed.
//   · aiRefinement — always false (D-2). The flag survives as a dormant off
//     switch; no plan, and nothing else, can turn it on here.
//
// The REAL bounds on letter generation are capability-neutral and live
// elsewhere: the S4 consumer-assertion gate (no confirmed fact, no letter) and
// the S1 spend/rate limits. Neither reads payment state.
//
// Historical constant. NOTHING enforces a monthly letter cap any more; it is
// retained because the dormant capability matrix (config/capabilityMatrix.ts,
// zero production consumers) declares the same number and its guard pins the
// two together. Deleting it would silently drift that dormant declaration.
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

// What a consumer may do. Every field below is the SAME for every consumer —
// there is no tier to distinguish, so nothing here can encode one.
//
// `freeMonthlyRemaining` was removed deliberately. It meant "free letters left
// this month", and under an unlimited model a numeric answer is either wrong or
// meaningless — a stale 0 in this shape is exactly what would have silently
// burned a historical payer's credits (see spendLetterCredits below). No
// surface read it; `letterLimit` / `lettersRemaining` (both always null =
// unbounded) are the fields that describe capability.
export interface Entitlement {
  premium: boolean; // ALWAYS false. There is no paid advantage to hold.
  plan: string; // ALWAYS "free". The plan OF RECORD lives on the User row.
  aiRefinement: boolean; // ALWAYS false (D-2). Dormant off switch.
  letterLimit: number | null; // ALWAYS null — no plan-imposed cap exists.
  lettersUsedThisMonth: number; // History, from the append-only ledger. Not a cap.
  lettersRemaining: number | null; // ALWAYS null — unbounded, for everyone.
  letterCredits: number; // FROZEN historical balance (D-3). Displayed, never spent.
}

const ACTIVE_STATES = ACTIVE_SUBSCRIPTION_STATES; // single canonical definition (lib/os/host/billingTier.ts)

/**
 * BILLING-RECORD predicate: does this account row carry a paid plan of record?
 *
 * ⚠️ RC1-S6a: this is NOT a capability predicate and no consumer-assistance
 * surface may call it. It answers a question about billing history and about
 * B2B (Agency) account type — nothing about what a consumer is allowed to do.
 * getEntitlement() no longer consults it, and neither does the community gate.
 * Its remaining readers are the dormant capability-platform adapter and the
 * golden guard that pins the two paths byte-identical.
 */
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

// FOUNDER D-3 — PURCHASED LETTER CREDITS ARE FROZEN.
//
// A consumer's `letterCredits` balance is a historical commercial record. It is
// preserved exactly as it stands, shown to the consumer as history, and NEVER
// consumed: assistance is free, so there is nothing to pay for. Re-authorising
// fulfilment is a Founder decision that must arrive as a reviewed commit, which
// is why this is a source constant and not an env flag an ops change could flip.
//
// Typed `boolean` on purpose: a literal `true` would make the clamp/guard logic
// below statically unreachable, and that logic is the reviewed accounting the
// product must still hold the day fulfilment is ever re-authorised.
const LETTER_CREDITS_FROZEN: boolean = true;

/**
 * THE single decrement path for purchased letter-pack credits.
 *
 * RC1-S6a: FROZEN and UNCALLED. No letter surface invokes it any more (the
 * quota it served no longer exists), and the freeze above makes it a no-op even
 * if a future caller appears — belt and braces, because the natural "free for
 * all" implementation is precisely what silently drains a historical payer's
 * prepaid balance on letters they were given for free.
 *
 * Preserved below, unchanged: the decrement is clamped to the credits actually
 * held AND conditional on the row still holding them, so a concurrent spend can
 * never drive the balance negative — a negative balance would silently eat a
 * future letter-pack purchase.
 */
export async function spendLetterCredits(
  userId: string,
  e: { premium: boolean; freeMonthlyRemaining: number; letterCredits: number },
  generated: number
): Promise<void> {
  if (LETTER_CREDITS_FROZEN) return;
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

/**
 * THE consumer capability resolver. One answer, identical for every consumer.
 *
 * The parameter type is the enforcement, not a comment: `plan`,
 * `subscriptionStatus`, `isAgency` and `managedByAgencyId` are not accepted, so
 * no future edit inside this function can branch on payment status or on who is
 * paying. Callers still pass whole user rows — the extra fields are simply
 * invisible here.
 *
 * P1-26 — MANAGED-PAYER INHERITANCE REMOVED. A consumer worked inside an agency
 * workspace used to inherit the AGENCY's paid entitlement, which made a third
 * party's billing state decide what that consumer received. A managed consumer
 * now gets exactly what every consumer gets, and the agency's plan is not read.
 */
export async function getEntitlement(user: {
  id: string;
  letterCredits?: number | null;
}): Promise<Entitlement> {
  // Monthly usage = MAX(deletable Letter rows, append-only ProductEvent ledger).
  // Kept as HISTORY, not as a meter: nothing gates on it any more. The ledger is
  // still the honest floor (a consumer may delete their own Letter rows), and the
  // MAX means the count can never read lower than it did before.
  const monthStart = startOfMonthUTC();
  const [letterRowsThisMonth, ledgerUsedThisMonth] = await Promise.all([
    prisma.letter.count({ where: { userId: user.id, createdAt: { gte: monthStart } } }),
    lettersUsedFromLedger(user.id, monthStart),
  ]);
  const lettersUsedThisMonth = Math.max(letterRowsThisMonth, ledgerUsedThisMonth);
  // Read back, never written back. The balance is reported so a historical payer
  // can still see what they hold; nothing in the product spends it (D-3).
  const letterCredits = Math.max(0, user.letterCredits ?? 0);

  // ONE return. There is no second branch to fall into and no tier to compute.
  return {
    premium: false,
    plan: "free",
    aiRefinement: false,
    letterLimit: null,
    lettersUsedThisMonth,
    lettersRemaining: null,
    letterCredits,
  };
}

/**
 * Retained so the letter surfaces keep a single named place to ask "may this
 * consumer generate?" — and the answer is now always yes. Generation is bounded
 * only by things that are not about money: the consumer-assertion gate (S4) and
 * the AI spend / rate limits (S1).
 *
 * The refusal branch is gone, not softened. It used to return
 * "Upgrade to Professional for unlimited letters, or buy a letter pack" — a
 * commercial refusal shape that must not exist anywhere a consumer can reach.
 */
export function canGenerateLetter(_e: Entitlement): { allowed: boolean; reason?: string } {
  return { allowed: true };
}
