// HOST durable adapters (Postgres via Accelerate) implementing the kernel port interfaces. Kept in
// the HOST — the kernel core imports no app infra (hexagonal; constitution §12). FLAG-GATED via
// KERNEL_DURABLE and DEFAULT OFF; the kernel has NO production caller today, so this is entirely
// dormant. ADR-0028.
//
// Correctness properties (ADR-0028):
//  • Audit/Event: append() is SYNC (buffers in-process); flush() persists the batch and is AWAITED
//    by the host after dispatch — never fire-and-forget (a serverless freeze would drop it).
//  • Idempotency: 3-state, claim-before-effect. claim = atomic INSERT…ON CONFLICT (winner "won");
//    a "failed" key is reclaimable; settle records the hash-only replay receipt.
//  • Version authority: a lock-free Postgres SEQUENCE, block-reserved once per request and handed
//    out synchronously (keeps ClockSource sync). Monotonic-WITH-GAPS (not a contiguous count).
//  • HASH-ONLY: no raw body/subject/recipient is written; free-text `reason` is reduced to a
//    reason-code + a SHA-256. Tenant lives in a scoped column (reads must filter WHERE tenantId=$1).
//
// Tables self-heal at runtime (ADR-0001; `prisma db push` no-ops through Accelerate). Patterns mirror
// proven repo code: billing.ts (INSERT…ON CONFLICT dedup), MailStore (self-heal DDL), aiMeter
// (single durable write). ⚠️ NOT locally testable (no DB in this env) — requires prod-DB validation
// under injected cold-start/redelivery/crash before KERNEL_DURABLE is enabled (ADR-0028 §5). The
// claim/settle/flush LOGIC is proven via scripts/kernel-durable.test.ts against in-memory + fake-async
// stores that model these exact semantics.
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import type { AuditSink, AuditEntry, EventLog, KaiEvent, ClockSource, Version } from "@/lib/os/kernel";
import type { IdempotencyStore, IdemState, ReplayReceipt } from "@/lib/os/kernel";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// ---- Durable append-only audit (hash-only, per-row + intra-batch hash chain) ----
let auditReady = false;
async function ensureAuditTable(): Promise<void> {
  if (auditReady) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "KernelAudit" (
    "version" BIGINT PRIMARY KEY,
    "txTime" TEXT NOT NULL, "validTime" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL, "actorId" TEXT NOT NULL, "pluginId" TEXT,
    "key" TEXT NOT NULL, "correlationId" TEXT,
    "decision" TEXT NOT NULL, "reasonCode" TEXT NOT NULL, "reasonHash" TEXT NOT NULL,
    "prevHash" TEXT, "rowHash" TEXT NOT NULL )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "KernelAudit_tenant_version_idx" ON "KernelAudit"("tenantId","version")`);
  auditReady = true;
}

export function durableAudit(): AuditSink {
  const buf: AuditEntry[] = [];
  let prevHash: string | null = null;
  return {
    append(e) { buf.push(e); },                            // sync enqueue — no I/O on the hot path
    async flush() {
      if (!buf.length) return;
      await ensureAuditTable();
      const batch = buf.splice(0, buf.length);
      for (const e of batch) {
        const reason = e.reason ?? "";
        const reasonCode = (reason.split(/[\s:—-]/)[0] || "none").slice(0, 40); // structural code, not free text
        const reasonHash = sha(reason);                    // hash-only: the free text is never stored raw
        const rowHash = sha(`${prevHash ?? ""}|${e.stamp.version}|${e.tenantId}|${String(e.key)}|${e.decision}|${reasonHash}`);
        await prisma.$executeRaw`INSERT INTO "KernelAudit"
          ("version","txTime","validTime","tenantId","actorId","pluginId","key","correlationId","decision","reasonCode","reasonHash","prevHash","rowHash")
          VALUES (${Number(e.stamp.version)}, ${e.stamp.txTime}, ${e.stamp.validTime}, ${e.tenantId}, ${e.actorId}, ${e.pluginId ?? null},
                  ${String(e.key)}, ${e.correlationId ?? null}, ${e.decision}, ${reasonCode}, ${reasonHash}, ${prevHash}, ${rowHash})
          ON CONFLICT ("version") DO NOTHING`;
        prevHash = rowHash;
      }
    },
  };
}

// ---- Durable event log (SEPARATE table; keeps the kernel-supplied id as the dedupe PK) ----
let eventReady = false;
async function ensureEventTable(): Promise<void> {
  if (eventReady) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "KernelEvent" (
    "id" TEXT PRIMARY KEY, "type" TEXT NOT NULL, "tenantId" TEXT NOT NULL,
    "version" BIGINT NOT NULL, "txTime" TEXT NOT NULL, "payloadHash" TEXT NOT NULL )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "KernelEvent_tenant_version_idx" ON "KernelEvent"("tenantId","version")`);
  eventReady = true;
}

export function durableEventLog(): EventLog {
  const buf: KaiEvent[] = [];
  return {
    append(e) { buf.push(e); },
    async flush() {
      if (!buf.length) return;
      await ensureEventTable();
      const batch = buf.splice(0, buf.length);
      for (const e of batch) {
        await prisma.$executeRaw`INSERT INTO "KernelEvent" ("id","type","tenantId","version","txTime","payloadHash")
          VALUES (${e.id}, ${e.type}, ${e.tenantId}, ${Number(e.stamp.version)}, ${e.stamp.txTime}, ${sha(JSON.stringify(e.payload))})
          ON CONFLICT ("id") DO NOTHING`;                  // id is the dedupe key (at-least-once safe)
      }
    },
  };
}

// ---- Durable 3-state idempotency ledger (claim-before-effect; billing.ts ON CONFLICT, extended) ----
let idemReady = false;
async function ensureIdemTable(): Promise<void> {
  if (idemReady) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "KernelIdempotency" (
    "key" TEXT PRIMARY KEY, "state" TEXT NOT NULL,
    "receiptSummary" TEXT, "receiptOk" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "settledAt" TIMESTAMP(3) )`);
  idemReady = true;
}

export function durableIdempotency(): IdempotencyStore {
  return {
    async claim(key: string): Promise<IdemState> {
      await ensureIdemTable();
      // Atomic winner: INSERT PENDING; ON CONFLICT DO NOTHING → 1 row = we won, 0 rows = it existed.
      const inserted = await prisma.$executeRaw`INSERT INTO "KernelIdempotency" ("key","state") VALUES (${key}, 'pending') ON CONFLICT ("key") DO NOTHING`;
      if (inserted === 1) return "won";
      // A prior FAILED attempt is reclaimable — flip it back to pending atomically and win.
      const reclaimed = await prisma.$executeRaw`UPDATE "KernelIdempotency" SET "state"='pending', "settledAt"=NULL WHERE "key"=${key} AND "state"='failed'`;
      if (reclaimed === 1) return "won";
      const rows = await prisma.$queryRaw<{ state: IdemState }[]>`SELECT "state" FROM "KernelIdempotency" WHERE "key"=${key}`;
      return rows[0]?.state ?? "pending";
    },
    async settle(key: string, state: "committed" | "failed", receipt?: ReplayReceipt): Promise<void> {
      await ensureIdemTable();
      await prisma.$executeRaw`UPDATE "KernelIdempotency"
        SET "state"=${state}, "receiptSummary"=${receipt?.summary ?? null}, "receiptOk"=${receipt?.ok ?? null}, "settledAt"=CURRENT_TIMESTAMP
        WHERE "key"=${key}`;
    },
    async lookup(key: string) {
      await ensureIdemTable();
      const rows = await prisma.$queryRaw<{ state: IdemState; receiptSummary: string | null; receiptOk: boolean | null }[]>`
        SELECT "state","receiptSummary","receiptOk" FROM "KernelIdempotency" WHERE "key"=${key}`;
      const r = rows[0];
      if (!r) return null;
      return { state: r.state, receipt: r.receiptSummary != null ? { summary: r.receiptSummary, ok: !!r.receiptOk } : undefined };
    },
  };
}

// ---- Durable version authority: a lock-free SEQUENCE, block-reserved per request ----
// Async construction (one sequence bump), synchronous handout → ClockSource stays sync. Monotonic
// with gaps. Reserve a block large enough for a request's dispatch count; exhaustion throws (reserve
// a bigger block) rather than silently reusing a version.
let seqReady = false;
async function ensureSeq(): Promise<void> {
  if (seqReady) return;
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "kernel_version_seq"`);
  seqReady = true;
}

export async function reserveDurableClock(blockSize = 256): Promise<ClockSource> {
  await ensureSeq();
  const rows = await prisma.$queryRawUnsafe<{ block: bigint }[]>(`SELECT nextval('kernel_version_seq') AS block`);
  const blockNo = Number(rows[0]?.block ?? 0);
  let next = blockNo * blockSize;                          // non-overlapping block [blockNo*size, (blockNo+1)*size)
  const ceiling = next + blockSize;
  return {
    nextVersion(): Version {
      if (next >= ceiling) throw new Error("kernel: durable version block exhausted — reserve a larger block");
      return (next++) as unknown as Version;
    },
    now(): string { return new Date().toISOString(); },
  };
}
