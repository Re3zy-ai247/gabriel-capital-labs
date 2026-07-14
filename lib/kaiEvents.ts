// KaiEvent — the append-only platform event stream (ADR-0007 E1). Producers are
// one-line, fail-open calls inside existing flows; consumers (timeline, Kai Home,
// notifications, digests) render from it and never invent facts it doesn't hold.
import { prisma } from "@/lib/prisma";

export type KaiEventType =
  | "report.uploaded"
  | "report.analyzed"
  | "letter.generated"
  | "letter.mailed"
  | "response.received"
  | "dispute.resolved"
  // CreditVector Mail (Sprint VIII) — one event per lifecycle transition; the
  // canonical MailStatus rides in the payload. Timeline/case-memory consumers
  // that don't recognize it simply ignore it (their default branch).
  | "mail.status";

let kaiEventReady = false;
async function ensureKaiEventTable(): Promise<void> {
  if (kaiEventReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "KaiEvent" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "refType" TEXT,
      "refId" TEXT,
      "payload" JSONB,
      "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "KaiEvent_userId_occurredAt_idx" ON "KaiEvent" ("userId", "occurredAt")`
  );
  kaiEventReady = true;
}

/**
 * Record a platform event. NEVER throws — a failed event write must not block
 * the flow that produced it (uploads, letters, responses keep working even if
 * the event stream hiccups).
 */
export async function recordKaiEvent(
  userId: string,
  type: KaiEventType,
  opts?: { refType?: string; refId?: string; payload?: Record<string, unknown> }
): Promise<void> {
  try {
    await ensureKaiEventTable();
    await prisma.kaiEvent.create({
      data: {
        userId,
        type,
        refType: opts?.refType ?? null,
        refId: opts?.refId ?? null,
        payload: (opts?.payload as object | undefined) ?? undefined,
      },
    });
  } catch (e) {
    console.error(`kaiEvents: failed to record ${type} (fail-open):`, e);
  }
}

/** Newest-first event feed for the timeline / Kai Home. */
export async function listKaiEvents(userId: string, limit = 50) {
  try {
    await ensureKaiEventTable();
    return await prisma.kaiEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
  } catch (e) {
    console.error("kaiEvents: list failed (fail-open):", e);
    return [];
  }
}
