// Decision Registry (Sprint X, ADR-0010 / ADR-0007 recommendation-ledger). An
// append-only record of the recommendations Kai surfaced and the DETERMINISTIC
// basis behind each — so a recommendation is always auditable ("why did Kai say
// this?") and so acted-on recommendations become part of the outcome dataset the
// engines learn from. Structured rows only (no freeform AI memory). Fail-open:
// a registry hiccup never blocks a recommendation. Self-heal table (ADR-0001).
import { prisma } from "@/lib/prisma";

export interface DecisionRecord {
  userId: string;
  tradelineId: string | null;
  strategyId: string | null;
  confidence: string;        // "Strong" | "Moderate" | "Building" (grounds, not outcome)
  basis: string[];           // the deterministic reasons cited at decision time
  recordedAt?: string;
}

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "DecisionRegistry" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tradelineId" TEXT,
      "strategyId" TEXT,
      "confidence" TEXT NOT NULL,
      "basis" JSONB NOT NULL DEFAULT '[]',
      "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DecisionRegistry_userId_idx" ON "DecisionRegistry" ("userId", "recordedAt")`
  );
  tableReady = true;
}

function id(): string {
  // Deterministic-enough unique id without Date.now in a hot path — random suffix
  // + a cuid-style prefix. Collisions are astronomically unlikely and harmless
  // (append-only). (Not security-sensitive.)
  return "dec_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// Record a surfaced/acted-on recommendation. NEVER throws — an audit-log failure
// must not break the recommendation the user is looking at. Call this from a
// discrete decision ACTION (e.g. "generate this letter"), not on every render.
export async function recordDecision(d: DecisionRecord): Promise<void> {
  try {
    await ensureTable();
    await prisma.$executeRaw`
      INSERT INTO "DecisionRegistry" ("id","userId","tradelineId","strategyId","confidence","basis")
      VALUES (${id()}, ${d.userId}, ${d.tradelineId}, ${d.strategyId}, ${d.confidence}, ${JSON.stringify(d.basis)}::jsonb)`;
  } catch (e) {
    console.error("decisionRegistry: record failed (fail-open):", e);
  }
}

// The user's own decision history, newest first. Reads only their rows.
export async function listDecisions(userId: string, limit = 50): Promise<DecisionRecord[]> {
  try {
    await ensureTable();
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM "DecisionRegistry" WHERE "userId" = ${userId} ORDER BY "recordedAt" DESC LIMIT ${take}`;
    return rows.map((r) => ({
      userId: r.userId as string,
      tradelineId: (r.tradelineId as string) ?? null,
      strategyId: (r.strategyId as string) ?? null,
      confidence: r.confidence as string,
      basis: (r.basis as string[]) ?? [],
      recordedAt: r.recordedAt ? new Date(r.recordedAt as string).toISOString() : undefined,
    }));
  } catch (e) {
    console.error("decisionRegistry: list failed (fail-open):", e);
    return [];
  }
}
