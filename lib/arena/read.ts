// Server-only reader for the Arena admin inspector. Reads the existing
// VerifiedOutcome self-heal table (raw SQL, like lib/outcomeLedger.ts) and returns
// the minimal shape the pure engine folds. Fail-closed: any error (table missing,
// DB unreachable) returns [] so the inspector renders an honest empty state rather
// than throwing. Read-only — never writes.
import { prisma } from "@/lib/prisma";
import type { OutcomeRow } from "./project";

export async function readAllOutcomeRows(): Promise<OutcomeRow[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ letterId: string; userId: string; outcome: string | null }[]>(
      `SELECT "letterId", "userId", "outcome" FROM "VerifiedOutcome"`
    );
    return rows.map((r) => ({ letterId: r.letterId, userId: r.userId, outcome: r.outcome }));
  } catch {
    return [];
  }
}
