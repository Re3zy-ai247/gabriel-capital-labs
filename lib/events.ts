// ProductEvent — a minimal, first-party analytics sink for evaluating the Private
// Alpha funnel (Beta Launch Strategy §5.2). Deliberately separate from the
// user-facing KaiEvent activity stream (lib/kaiEvents.ts): this table carries
// funnel/telemetry events (page views, failures) that must NOT surface in a
// user's timeline or eat its bounded fetch window. Self-heal table (ADR-0001),
// accessed via raw SQL like lib/kaiSeen.ts. Every write is fail-open — analytics
// must never break the flow that produced it. Meta is intentionally minimal and
// NEVER contains PII (no creditor names, balances, addresses, or report text).
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export const PRODUCT_EVENTS = {
  onboardingStarted: "onboarding_started",
  onboardingCompleted: "onboarding_completed",
  reportUploaded: "report_uploaded",
  strategyGenerated: "strategy_generated",
  aiPlanViewed: "ai_plan_viewed",
  disputeCreated: "dispute_created",
  disputeCompleted: "dispute_completed",
  subscriptionStarted: "subscription_started",
  subscriptionCompleted: "subscription_completed",
  failure: "failure",
} as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS];

// The subset a signed-in browser is allowed to report through POST /api/events.
// Everything else (lifecycle, billing, failures) is emitted server-side only, so
// the client can never spoof a conversion or a completed subscription.
export const CLIENT_REPORTABLE_EVENTS: ReadonlySet<string> = new Set([
  PRODUCT_EVENTS.onboardingStarted,
  PRODUCT_EVENTS.onboardingCompleted,
  PRODUCT_EVENTS.aiPlanViewed,
]);

let productEventReady = false;
async function ensureProductEventTable(): Promise<void> {
  if (productEventReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ProductEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "name" TEXT NOT NULL,
      "meta" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductEvent_name_createdAt_idx" ON "ProductEvent" ("name", "createdAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductEvent_userId_idx" ON "ProductEvent" ("userId")`
  );
  productEventReady = true;
}

/**
 * Record a product/funnel event. NEVER throws — a failed analytics write must not
 * block the flow that produced it.
 */
export async function track(
  name: ProductEventName,
  opts?: { userId?: string | null; meta?: Record<string, unknown> }
): Promise<void> {
  try {
    await ensureProductEventTable();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ProductEvent" ("id", "userId", "name", "meta") VALUES ($1, $2, $3, $4::jsonb)`,
      randomUUID(),
      opts?.userId ?? null,
      name,
      JSON.stringify(opts?.meta ?? {})
    );
  } catch (e) {
    console.error(`events: failed to record ${name} (fail-open):`, e);
  }
}
