// Persistence for mail manifests. An interface so MailService is testable with
// an in-memory store and production uses a self-heal Postgres table (ADR-0001).
// The store is the guarantor of two invariants: identity fields are write-once
// (saveProgress never lists an identity column / re-copies them in memory), and
// the audit trail is append-only (assertAppendOnly on every progress write).
import { prisma } from "@/lib/prisma";
import type { MailManifest } from "./MailManifest";
import { assertAppendOnly, MailAuditError } from "./MailAudit";

export interface MailStore {
  create(m: MailManifest): Promise<void>;
  get(mailId: string): Promise<MailManifest | null>;
  saveProgress(m: MailManifest): Promise<void>; // status/timestamps/tracking/audit only
  listByUser(userId: string, limit?: number): Promise<MailManifest[]>;
}

export class MailStoreError extends Error {
  constructor(message: string) { super(message); this.name = "MailStoreError"; }
}

// In-memory store — deep-copied on the way in and out so callers can never
// mutate stored manifests by reference. Used by guards and dry-run.
export class InMemoryMailStore implements MailStore {
  private rows = new Map<string, MailManifest>();
  async create(m: MailManifest): Promise<void> {
    if (this.rows.has(m.mailId)) throw new MailStoreError(`mail ${m.mailId} already exists`);
    this.rows.set(m.mailId, structuredClone(m));
  }
  async get(mailId: string): Promise<MailManifest | null> {
    const r = this.rows.get(mailId);
    return r ? structuredClone(r) : null;
  }
  async saveProgress(m: MailManifest): Promise<void> {
    const existing = this.rows.get(m.mailId);
    if (!existing) throw new MailStoreError(`mail ${m.mailId} not found`);
    // Append-only audit is enforced HERE, at the store, not just by convention.
    assertAppendOnly(existing.auditTrail, m.auditTrail);
    // Enforce identity immutability even in memory.
    const next = structuredClone(m);
    next.provider = existing.provider;
    next.letterId = existing.letterId;
    next.userId = existing.userId;
    next.disputeId = existing.disputeId;
    next.tradelineId = existing.tradelineId;
    next.recipient = existing.recipient;
    next.mailClass = existing.mailClass;
    next.certified = existing.certified;
    next.pages = existing.pages;
    next.color = existing.color;
    next.doubleSided = existing.doubleSided;
    next.cost = existing.cost;
    next.createdAt = existing.createdAt;
    this.rows.set(m.mailId, next);
  }
  async listByUser(userId: string, limit = 50): Promise<MailManifest[]> {
    return [...this.rows.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }
}

// Production store — self-heal table, raw SQL (Accelerate-safe, no migration).
// CREATE IF NOT EXISTS won't add columns to an already-created table, so each
// column added after the first ship also gets an ALTER … ADD COLUMN IF NOT
// EXISTS (parameterless DDL). Timestamps are ISO TEXT so the exact strings the
// pure logic uses round-trip.
let tableReady = false;
async function ensureMailTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "MailManifest" (
      "mailId" TEXT PRIMARY KEY,
      "provider" TEXT NOT NULL,
      "letterId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "disputeId" TEXT,
      "tradelineId" TEXT,
      "recipient" JSONB NOT NULL,
      "mailClass" TEXT NOT NULL,
      "certified" BOOLEAN NOT NULL,
      "pages" INTEGER NOT NULL DEFAULT 1,
      "color" BOOLEAN NOT NULL DEFAULT false,
      "doubleSided" BOOLEAN NOT NULL DEFAULT false,
      "cost" JSONB NOT NULL,
      "status" TEXT NOT NULL,
      "providerJobId" TEXT,
      "trackingNumber" TEXT,
      "createdAt" TEXT NOT NULL,
      "printedAt" TEXT,
      "carrierAcceptedAt" TEXT,
      "deliveredAt" TEXT,
      "responseReceivedAt" TEXT,
      "closedAt" TEXT,
      "auditTrail" JSONB NOT NULL DEFAULT '[]'
    )`
  );
  // Self-heal columns added after the initial table shipped.
  for (const ddl of [
    `ALTER TABLE "MailManifest" ADD COLUMN IF NOT EXISTS "pages" INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE "MailManifest" ADD COLUMN IF NOT EXISTS "color" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "MailManifest" ADD COLUMN IF NOT EXISTS "doubleSided" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "MailManifest" ADD COLUMN IF NOT EXISTS "carrierAcceptedAt" TEXT`,
  ]) {
    await prisma.$executeRawUnsafe(ddl);
  }
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "MailManifest_userId_idx" ON "MailManifest" ("userId", "createdAt")`
  );
  tableReady = true;
}

type Row = Record<string, unknown>;
function rowToManifest(r: Row): MailManifest {
  return {
    mailId: r.mailId as string,
    provider: r.provider as MailManifest["provider"],
    letterId: r.letterId as string,
    userId: r.userId as string,
    disputeId: (r.disputeId as string) ?? null,
    tradelineId: (r.tradelineId as string) ?? null,
    recipient: r.recipient as MailManifest["recipient"],
    mailClass: r.mailClass as MailManifest["mailClass"],
    certified: r.certified as boolean,
    pages: Number(r.pages ?? 1),
    color: Boolean(r.color),
    doubleSided: Boolean(r.doubleSided),
    cost: r.cost as MailManifest["cost"],
    status: r.status as MailManifest["status"],
    providerJobId: (r.providerJobId as string) ?? null,
    trackingNumber: (r.trackingNumber as string) ?? null,
    createdAt: r.createdAt as string,
    printedAt: (r.printedAt as string) ?? null,
    carrierAcceptedAt: (r.carrierAcceptedAt as string) ?? null,
    deliveredAt: (r.deliveredAt as string) ?? null,
    responseReceivedAt: (r.responseReceivedAt as string) ?? null,
    closedAt: (r.closedAt as string) ?? null,
    auditTrail: (r.auditTrail as MailManifest["auditTrail"]) ?? [],
  };
}

export class PrismaMailStore implements MailStore {
  async create(m: MailManifest): Promise<void> {
    await ensureMailTable();
    await prisma.$executeRaw`
      INSERT INTO "MailManifest" (
        "mailId","provider","letterId","userId","disputeId","tradelineId",
        "recipient","mailClass","certified","pages","color","doubleSided","cost",
        "status","providerJobId","trackingNumber","createdAt","printedAt",
        "carrierAcceptedAt","deliveredAt","responseReceivedAt","closedAt","auditTrail"
      ) VALUES (
        ${m.mailId}, ${m.provider}, ${m.letterId}, ${m.userId}, ${m.disputeId}, ${m.tradelineId},
        ${JSON.stringify(m.recipient)}::jsonb, ${m.mailClass}, ${m.certified},
        ${m.pages}, ${m.color}, ${m.doubleSided},
        ${JSON.stringify(m.cost)}::jsonb, ${m.status}, ${m.providerJobId},
        ${m.trackingNumber}, ${m.createdAt}, ${m.printedAt}, ${m.carrierAcceptedAt},
        ${m.deliveredAt}, ${m.responseReceivedAt}, ${m.closedAt},
        ${JSON.stringify(m.auditTrail)}::jsonb
      )`;
  }
  async get(mailId: string): Promise<MailManifest | null> {
    await ensureMailTable();
    const rows = await prisma.$queryRaw<Row[]>`SELECT * FROM "MailManifest" WHERE "mailId" = ${mailId} LIMIT 1`;
    return rows[0] ? rowToManifest(rows[0]) : null;
  }
  async saveProgress(m: MailManifest): Promise<void> {
    await ensureMailTable();
    // Load the persisted trail and enforce append-only BEFORE writing.
    const current = await prisma.$queryRaw<{ auditTrail: MailManifest["auditTrail"] }[]>`
      SELECT "auditTrail" FROM "MailManifest" WHERE "mailId" = ${m.mailId} LIMIT 1`;
    if (!current[0]) throw new MailStoreError(`mail ${m.mailId} not found`);
    const prevTrail = current[0].auditTrail ?? [];
    assertAppendOnly(prevTrail, m.auditTrail); // throws MailAuditError on tamper
    // Identity columns are intentionally absent from SET — they can never change.
    // The optimistic guard on audit length serializes concurrent transitions:
    // last-writer-lose (0 rows) instead of silently dropping an audit entry.
    const n = await prisma.$executeRaw`
      UPDATE "MailManifest" SET
        "status" = ${m.status},
        "providerJobId" = ${m.providerJobId},
        "trackingNumber" = ${m.trackingNumber},
        "printedAt" = ${m.printedAt},
        "carrierAcceptedAt" = ${m.carrierAcceptedAt},
        "deliveredAt" = ${m.deliveredAt},
        "responseReceivedAt" = ${m.responseReceivedAt},
        "closedAt" = ${m.closedAt},
        "auditTrail" = ${JSON.stringify(m.auditTrail)}::jsonb
      WHERE "mailId" = ${m.mailId}
        AND jsonb_array_length("auditTrail") = ${prevTrail.length}`;
    if (n === 0) {
      throw new MailStoreError(`concurrent update on mail ${m.mailId} — retry from the current manifest`);
    }
  }
  async listByUser(userId: string, limit = 50): Promise<MailManifest[]> {
    await ensureMailTable();
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT * FROM "MailManifest" WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT ${take}`;
    return rows.map(rowToManifest);
  }
}

export { MailAuditError };
