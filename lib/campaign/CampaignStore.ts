// Persistence for campaigns. An interface so the service is testable in-memory
// and production uses a self-heal Postgres table (ADR-0001 — CREATE/ALTER IF NOT
// EXISTS, Accelerate-safe, no migration). Two invariants are enforced HERE:
//   • the approval SNAPSHOT is write-once — once a campaign has a frozen snapshot,
//     save() can never overwrite it (what was approved can't drift);
//   • the audit trail is append-only (prefix-checked on every save).
// Tenant isolation (a tenant / agency-managed client only ever touches its own
// campaigns) is enforced one layer up in CampaignService — get()/save() run only
// after CampaignService.owned() verifies ownership, and findCovering reads through
// the userId-scoped listByUser(). By-id lookups here are therefore always
// preceded by an ownership check; the store itself is intentionally id-keyed.
import { prisma } from "@/lib/prisma";
import type { Campaign } from "./CampaignModel";

export interface CampaignStore {
  create(c: Campaign): Promise<void>;
  get(id: string): Promise<Campaign | null>;
  save(c: Campaign): Promise<void>;
  listByUser(userId: string, limit?: number): Promise<Campaign[]>;
  nextSequence(userId: string): Promise<number>;
}

export class CampaignStoreError extends Error {
  constructor(message: string) { super(message); this.name = "CampaignStoreError"; }
}

// Append-only guard: the new trail must extend the old one, never rewrite it.
function assertAppendOnly(prev: unknown[], next: unknown[]): void {
  if (next.length < prev.length) throw new CampaignStoreError("audit trail cannot shrink");
  for (let i = 0; i < prev.length; i++) {
    if (JSON.stringify(prev[i]) !== JSON.stringify(next[i])) {
      throw new CampaignStoreError(`audit entry ${i} was modified — the trail is append-only`);
    }
  }
}

// ---- in-memory (guards + dry-run) -----------------------------------------
export class InMemoryCampaignStore implements CampaignStore {
  private rows = new Map<string, Campaign>();
  async create(c: Campaign): Promise<void> {
    if (this.rows.has(c.id)) throw new CampaignStoreError(`campaign ${c.id} already exists`);
    this.rows.set(c.id, structuredClone(c));
  }
  async get(id: string): Promise<Campaign | null> {
    const r = this.rows.get(id);
    return r ? structuredClone(r) : null;
  }
  async save(c: Campaign): Promise<void> {
    const existing = this.rows.get(c.id);
    if (!existing) throw new CampaignStoreError(`campaign ${c.id} not found`);
    assertAppendOnly(existing.auditTrail, c.auditTrail);
    const next = structuredClone(c);
    // Snapshot is write-once + identity is immutable.
    if (existing.snapshot) next.snapshot = existing.snapshot;
    next.userId = existing.userId;
    next.sequence = existing.sequence;
    next.createdAt = existing.createdAt;
    this.rows.set(c.id, next);
  }
  async listByUser(userId: string, limit = 50): Promise<Campaign[]> {
    return [...this.rows.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.sequence - a.sequence)
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }
  async nextSequence(userId: string): Promise<number> {
    const max = [...this.rows.values()].filter((r) => r.userId === userId).reduce((m, r) => Math.max(m, r.sequence), 0);
    return max + 1;
  }
}

// ---- production (self-heal table) -----------------------------------------
let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "Campaign" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "sequence" INTEGER NOT NULL DEFAULT 1,
      "status" TEXT NOT NULL,
      "strategyFamily" TEXT NOT NULL,
      "rationale" TEXT NOT NULL DEFAULT '',
      "userDecision" TEXT,
      "items" JSONB NOT NULL DEFAULT '[]',
      "warnings" JSONB NOT NULL DEFAULT '[]',
      "nextUnlock" JSONB NOT NULL DEFAULT '[]',
      "snapshot" JSONB,
      "createdAt" TEXT NOT NULL,
      "approvedAt" TEXT,
      "startedAt" TEXT,
      "completedAt" TEXT,
      "canceledAt" TEXT,
      "auditTrail" JSONB NOT NULL DEFAULT '[]'
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Campaign_userId_idx" ON "Campaign" ("userId", "sequence")`
  );
  tableReady = true;
}

type Row = Record<string, unknown>;
function rowToCampaign(r: Row): Campaign {
  return {
    id: r.id as string,
    userId: r.userId as string,
    sequence: Number(r.sequence ?? 1),
    status: r.status as Campaign["status"],
    strategyFamily: r.strategyFamily as Campaign["strategyFamily"],
    rationale: (r.rationale as string) ?? "",
    userDecision: (r.userDecision as Campaign["userDecision"]) ?? null,
    items: (r.items as Campaign["items"]) ?? [],
    warnings: (r.warnings as Campaign["warnings"]) ?? [],
    nextUnlock: (r.nextUnlock as string[]) ?? [],
    snapshot: (r.snapshot as Campaign["snapshot"]) ?? null,
    createdAt: r.createdAt as string,
    approvedAt: (r.approvedAt as string) ?? null,
    startedAt: (r.startedAt as string) ?? null,
    completedAt: (r.completedAt as string) ?? null,
    canceledAt: (r.canceledAt as string) ?? null,
    auditTrail: (r.auditTrail as Campaign["auditTrail"]) ?? [],
  };
}

export class PrismaCampaignStore implements CampaignStore {
  async create(c: Campaign): Promise<void> {
    await ensureTable();
    await prisma.$executeRaw`
      INSERT INTO "Campaign" (
        "id","userId","sequence","status","strategyFamily","rationale","userDecision",
        "items","warnings","nextUnlock","snapshot","createdAt","approvedAt","startedAt",
        "completedAt","canceledAt","auditTrail"
      ) VALUES (
        ${c.id}, ${c.userId}, ${c.sequence}, ${c.status}, ${c.strategyFamily}, ${c.rationale}, ${c.userDecision},
        ${JSON.stringify(c.items)}::jsonb, ${JSON.stringify(c.warnings)}::jsonb, ${JSON.stringify(c.nextUnlock)}::jsonb,
        ${c.snapshot ? JSON.stringify(c.snapshot) : null}::jsonb, ${c.createdAt}, ${c.approvedAt}, ${c.startedAt},
        ${c.completedAt}, ${c.canceledAt}, ${JSON.stringify(c.auditTrail)}::jsonb
      )`;
  }
  async get(id: string): Promise<Campaign | null> {
    await ensureTable();
    const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM "Campaign" WHERE "id" = ${id} LIMIT 1`;
    return rows[0] ? rowToCampaign(rows[0]) : null;
  }
  async save(c: Campaign): Promise<void> {
    await ensureTable();
    const current = await prisma.$queryRaw<{ auditTrail: unknown[]; snapshot: unknown }[]>`
      SELECT "auditTrail", "snapshot" FROM "Campaign" WHERE "id" = ${c.id} LIMIT 1`;
    if (!current[0]) throw new CampaignStoreError(`campaign ${c.id} not found`);
    const prevTrail = (current[0].auditTrail as unknown[]) ?? [];
    assertAppendOnly(prevTrail, c.auditTrail);
    // Snapshot is write-once: keep the persisted one if it already exists.
    const persistedSnapshot = current[0].snapshot ?? null;
    const snapshot = persistedSnapshot ?? c.snapshot ?? null;
    // Optimistic guard on audit length serializes concurrent transitions.
    const n = await prisma.$executeRaw`
      UPDATE "Campaign" SET
        "status" = ${c.status},
        "strategyFamily" = ${c.strategyFamily},
        "rationale" = ${c.rationale},
        "userDecision" = ${c.userDecision},
        "items" = ${JSON.stringify(c.items)}::jsonb,
        "warnings" = ${JSON.stringify(c.warnings)}::jsonb,
        "nextUnlock" = ${JSON.stringify(c.nextUnlock)}::jsonb,
        "snapshot" = ${snapshot ? JSON.stringify(snapshot) : null}::jsonb,
        "approvedAt" = ${c.approvedAt},
        "startedAt" = ${c.startedAt},
        "completedAt" = ${c.completedAt},
        "canceledAt" = ${c.canceledAt},
        "auditTrail" = ${JSON.stringify(c.auditTrail)}::jsonb
      WHERE "id" = ${c.id}
        AND jsonb_array_length("auditTrail") = ${prevTrail.length}`;
    if (n === 0) throw new CampaignStoreError(`concurrent update on campaign ${c.id} — retry from the current record`);
  }
  async listByUser(userId: string, limit = 50): Promise<Campaign[]> {
    await ensureTable();
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT * FROM "Campaign" WHERE "userId" = ${userId} ORDER BY "sequence" DESC LIMIT ${take}`;
    return rows.map(rowToCampaign);
  }
  async nextSequence(userId: string): Promise<number> {
    await ensureTable();
    const rows = await prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX("sequence") AS max FROM "Campaign" WHERE "userId" = ${userId}`;
    return (rows[0]?.max ?? 0) + 1;
  }
}
