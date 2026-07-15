// Reference in-memory adapters (Sprint 1) — the shape a durable prod adapter must satisfy
// (Postgres append-only audit/event log, the Kai Memory Graph). Used by tests and dev.
// Audit + event logs are APPEND-ONLY here too — they expose reads but no mutation/delete.
import type { AuditEntry, AuditSink, EventLog, KaiEvent, MemoryNode, MemoryStore } from "./types";

export function inMemoryAudit(): AuditSink & { entries(): readonly AuditEntry[] } {
  const log: AuditEntry[] = [];
  return { append: (e) => void log.push(e), entries: () => log };
}

export function inMemoryEventLog(): EventLog & { events(): readonly KaiEvent[] } {
  const log: KaiEvent[] = [];
  return { append: (e) => void log.push(e), events: () => log };
}

// Tenant-partitioned store — reads are scoped by tenantId (a prod adapter enforces the same
// at the query level). Mirrors today's deterministic Knowledge Graph as the seed.
export function inMemoryMemory(seed: MemoryNode[] = []): MemoryStore {
  const byTenant = new Map<string, Map<string, MemoryNode>>();
  const put = (n: MemoryNode) => {
    const t = byTenant.get(n.tenantId) ?? new Map();
    t.set(n.id, n); byTenant.set(n.tenantId, t);
  };
  seed.forEach(put);
  return {
    read: (tenantId, id) => byTenant.get(tenantId)?.get(id) ?? null,
    write: put,
  };
}
