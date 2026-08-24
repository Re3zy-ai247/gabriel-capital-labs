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

// ── Self-heal readiness (S11 · NEW-4) ────────────────────────────────────────
// Three defects, one mechanism, and they compound:
//
//  1. `CREATE ... IF NOT EXISTS` is NOT atomic in Postgres. Two sessions can both
//     pass the existence check and one then fails on the `pg_type` unique index —
//     `P2010 ... Key (typname, typnamespace)=(Campaign, 2200) already exists`.
//     The live run recorded ten of these. But that error means the object EXISTS:
//     the postcondition we wanted holds. Treating it as a failure was the bug.
//  2. The old `let tableReady = false` was set only AFTER the await, so a burst of
//     concurrent first requests all issued the DDL and raced each other.
//  3. Worse, the memo latched SUCCESS for the life of the process, so a table that
//     went missing afterwards was never re-healed — every later request on that
//     lambda failed identically, which is how a dropped table turned into a
//     permanently blank Mission Control rather than a transient one.
//
// So: memoise the in-flight PROMISE (concurrent callers await one statement),
// treat "already exists" as success, clear the memo on any OTHER failure so the
// next call genuinely retries, and clear it again if a later read finds the
// relation gone.
//
// Deliberately NOT extracted into a shared module: this file and its sibling are
// granted individually and a new shared file is out of scope for this round. The
// copies are identical by intent — change one, change the other (and consider
// extracting both, plus the four in lib/{aiMeter,rateLimit,passwordReset,push}.ts,
// into lib/selfHeal.ts).
function isAlreadyExists(e: unknown): boolean {
  const text = e instanceof Error ? `${e.message} ${JSON.stringify((e as { meta?: unknown }).meta ?? "")}` : String(e);
  // 23505 unique_violation (the pg_type race), 42P07 duplicate_table,
  // 42710 duplicate_object. Prisma wraps raw failures as P2010 and carries the
  // Postgres text through, so match the text as well as the codes.
  return /already exists|duplicate key value|23505|42P07|42710/i.test(text);
}

// A relation that goes missing AFTER a successful ensure (a drop, a restore, a
// fresh branch database) is the other half of the latch: clearing the memo on
// this specific error makes the next call re-create the table.
function isMissingRelation(e: unknown): boolean {
  const text = e instanceof Error ? `${e.message} ${JSON.stringify((e as { meta?: unknown }).meta ?? "")}` : String(e);
  return /does not exist|42P01|undefined_table/i.test(text);
}

let tableReady: Promise<void> | null = null;
async function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = createTable().catch((e) => {
      tableReady = null; // retryable: never latch a failure for the process lifetime
      throw e;
    });
  }
  return tableReady;
}

async function createTable(): Promise<void> {
  try {
    await createTableStatements();
  } catch (e) {
    if (isAlreadyExists(e)) return; // another session won the race; the table is there
    throw e;
  }
}

async function createTableStatements(): Promise<void> {
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
}

// ── Legible unavailability (S11 · NEW-4c) ────────────────────────────────────
// Both exported functions already swallow their errors, so this module never
// contributed the blank screen directly — but "fail-open" and "no decisions
// exist" are indistinguishable to a caller, which is how the 13 observed
// `relation "DecisionRegistry" does not exist` errors rendered as a silently
// empty audit trail.
//
// ⚠️ HAND-OFF (outside this round's grant): lib/knowledge/loader.ts:20 and
// lib/outcomeLedger.ts:172 query "DecisionRegistry" with raw SQL and their own
// .catch(() => []), bypassing ensureTable() entirely — so on a fresh database no
// read ever creates the table, and neither call site can see this signal. They
// should route through listDecisions() (or call ensureTable first).
let lastReadUnavailable = false;

/** True when the most recent read in this process could not reach the table. */
export function decisionDataUnavailable(): boolean {
  return lastReadUnavailable;
}

/** Test seam: reset the recorded read state. */
export function resetDecisionAvailability(): void {
  lastReadUnavailable = false;
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
    if (isMissingRelation(e)) tableReady = null; // un-latch a stale success memo
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
    lastReadUnavailable = false;
    return rows.map((r) => ({
      userId: r.userId as string,
      tradelineId: (r.tradelineId as string) ?? null,
      strategyId: (r.strategyId as string) ?? null,
      confidence: r.confidence as string,
      basis: (r.basis as string[]) ?? [],
      recordedAt: r.recordedAt ? new Date(r.recordedAt as string).toISOString() : undefined,
    }));
  } catch (e) {
    lastReadUnavailable = true;
    if (isMissingRelation(e)) tableReady = null; // un-latch a stale success memo
    console.error("decisionRegistry: list unavailable (degrading, not throwing):", e);
    return [];
  }
}
