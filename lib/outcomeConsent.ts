// Outcome-contribution consent (Sprint X). MOAT.md §Rules rule 2 makes consent a
// hard precondition for the cross-user data moat: a user's outcomes only enter the
// anonymized Engine-1 corpus if they opted in. Self-heal table (ADR-0001),
// fail-open on read. Default is OFF — contribution is strictly opt-in.
import { prisma } from "@/lib/prisma";

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "OutcomeConsent" (
      "userId" TEXT NOT NULL PRIMARY KEY,
      "contribute" BOOLEAN NOT NULL DEFAULT false,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  tableReady = true;
}

export async function getOutcomeConsent(userId: string): Promise<boolean> {
  try {
    await ensureTable();
    const rows = await prisma.$queryRaw<{ contribute: boolean }[]>`
      SELECT "contribute" FROM "OutcomeConsent" WHERE "userId" = ${userId} LIMIT 1`;
    return Boolean(rows[0]?.contribute);
  } catch (e) {
    console.error("outcomeConsent: read failed (fail-open → not contributing):", e);
    return false;
  }
}

export async function setOutcomeConsent(userId: string, contribute: boolean): Promise<void> {
  await ensureTable();
  await prisma.$executeRaw`
    INSERT INTO "OutcomeConsent" ("userId","contribute","updatedAt")
    VALUES (${userId}, ${contribute}, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET "contribute" = ${contribute}, "updatedAt" = CURRENT_TIMESTAMP`;
}

// Count of contributing users — for the admin "N contributors" honesty line.
export async function consentingUserIds(): Promise<string[]> {
  try {
    await ensureTable();
    const rows = await prisma.$queryRaw<{ userId: string }[]>`
      SELECT "userId" FROM "OutcomeConsent" WHERE "contribute" = true`;
    return rows.map((r) => r.userId);
  } catch (e) {
    console.error("outcomeConsent: list failed (fail-open):", e);
    return [];
  }
}
