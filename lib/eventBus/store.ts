// Platform Event Bus — durable store (Sprint 8). Reuses the Sprint 7 NetworkMessage
// pattern: idempotent append (deterministic id + ON CONFLICT via P2002 replay) and
// [createdAt asc, id asc] cursor reads. The migration-backed EventEnvelope table is
// a Prisma model, so access is type-safe (no hand-cast $queryRaw).
//
// TENANT + AGENCY ISOLATION IS ENFORCED HERE, on every read/replay, against a
// SERVER-RESOLVED AuthContext — never a client-supplied tenantId/agencyId (the IDOR
// the review flagged). scopeWhere() fails closed to the narrowest scope (own tenant).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DraftEvent, EventType, PlatformEvent } from "./envelope";

// The resolved read scope. Built server-side from currentAccount()/currentUser(),
// identical to how a publish resolves identity. NEVER constructed from request params.
export interface AuthContext {
  tenantId: string;
  agencyId: string | null;
  isAgency: boolean;
  isAdmin: boolean;
}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

type Row = {
  id: string; type: string; version: number; tenantId: string; agencyId: string | null;
  actorId: string; source: string; correlationId: string; payload: Prisma.JsonValue;
  redactedAt: Date | null; createdAt: Date;
};

function toEvent(r: Row): PlatformEvent {
  return {
    id: r.id, type: r.type as EventType, version: r.version, tenantId: r.tenantId,
    agencyId: r.agencyId, actorId: r.actorId, source: r.source, correlationId: r.correlationId,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
    redactedAt: r.redactedAt ? r.redactedAt.toISOString() : null,
  };
}

// The isolation WHERE. Fail-closed narrowest-first:
//   admin            -> platform-wide (no tenant filter)
//   agency account   -> its OWN tenant events OR any event scoped to its agency id
//   everyone else    -> its own tenant ONLY (a managed client cannot read the agency stream)
function scopeWhere(ctx: AuthContext): Prisma.EventEnvelopeWhereInput {
  if (ctx.isAdmin) return {};
  if (ctx.isAgency && ctx.agencyId) return { OR: [{ tenantId: ctx.tenantId }, { agencyId: ctx.agencyId }] };
  return { tenantId: ctx.tenantId };
}

// Parse a "<createdAtMs>:<id>" cursor. Malformed => null (page from the start).
function parseCursor(cursor: string | undefined | null): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const i = cursor.indexOf(":");
  if (i <= 0) return null;
  const ms = Number(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (!Number.isFinite(ms) || !id) return null;
  return { createdAt: new Date(ms), id };
}

function cursorOf(e: PlatformEvent): string {
  return `${new Date(e.createdAt).getTime()}:${e.id}`;
}

// Idempotent append. The event id is deterministic + tenant-scoped, so a retried
// publish collides on the PK and returns the ORIGINAL row (replayed:true) — never a
// duplicate, never a second fanout. Retry-safe: a thrown insert is NOT swallowed.
export async function appendEvent(draft: DraftEvent): Promise<{ event: PlatformEvent; replayed: boolean }> {
  try {
    const row = await prisma.eventEnvelope.create({
      data: {
        id: draft.id, type: draft.type, version: draft.version, tenantId: draft.tenantId,
        agencyId: draft.agencyId, actorId: draft.actorId, source: draft.source,
        correlationId: draft.correlationId, payload: draft.payload as Prisma.InputJsonValue,
      },
    });
    return { event: toEvent(row as Row), replayed: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.eventEnvelope.findUnique({ where: { id: draft.id } });
      if (existing) return { event: toEvent(existing as Row), replayed: true };
    }
    throw e; // retry-safe: surface the failure so the caller can retry cleanly
  }
}

// Forward cursor read (catch-up). Scoped to ctx; deterministic [createdAt asc, id asc].
export async function readSince(
  ctx: AuthContext,
  opts: { cursor?: string | null; limit?: number; type?: EventType } = {},
): Promise<{ events: PlatformEvent[]; cursor: string | null }> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT));
  const after = parseCursor(opts.cursor);
  const where: Prisma.EventEnvelopeWhereInput = {
    AND: [
      scopeWhere(ctx),
      ...(opts.type ? [{ type: opts.type }] : []),
      ...(after ? [{ OR: [{ createdAt: { gt: after.createdAt } }, { createdAt: after.createdAt, id: { gt: after.id } }] }] : []),
    ],
  };
  const rows = await prisma.eventEnvelope.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit });
  const events = rows.map((r) => toEvent(r as Row));
  const last = events[events.length - 1];
  return { events, cursor: last ? cursorOf(last) : (opts.cursor ?? null) };
}

// Bounded replay over SETTLED rows: [fromCursor, toCursor]. Full payloads (proves the
// log is NOT hash-only). Deterministic order; idempotent handlers make redelivery safe.
export async function replayEvents(
  ctx: AuthContext,
  opts: { fromCursor?: string | null; toCursor?: string | null; type?: EventType; limit?: number } = {},
): Promise<PlatformEvent[]> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? MAX_LIMIT));
  const from = parseCursor(opts.fromCursor);
  const to = parseCursor(opts.toCursor);
  const where: Prisma.EventEnvelopeWhereInput = {
    AND: [
      scopeWhere(ctx),
      ...(opts.type ? [{ type: opts.type }] : []),
      ...(from ? [{ OR: [{ createdAt: { gt: from.createdAt } }, { createdAt: from.createdAt, id: { gt: from.id } }] }] : []),
      ...(to ? [{ OR: [{ createdAt: { lt: to.createdAt } }, { createdAt: to.createdAt, id: { lte: to.id } }] }] : []),
    ],
  };
  const rows = await prisma.eventEnvelope.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit });
  return rows.map((r) => toEvent(r as Row));
}

// Data-subject erasure: clear the payload, keep the envelope as a tombstone (redactedAt
// set) so the immutable log's ordering/idempotency stay intact. Scoped to ctx — a
// caller can only redact within what it may read; fail-closed on a cross-scope id.
export async function redactEvent(ctx: AuthContext, id: string): Promise<boolean> {
  const found = await prisma.eventEnvelope.findFirst({ where: { AND: [scopeWhere(ctx), { id }] }, select: { id: true } });
  if (!found) return false;
  await prisma.eventEnvelope.update({ where: { id }, data: { payload: {}, redactedAt: new Date() } });
  return true;
}

// Exported for the isolation guard: proves the WHERE is narrowest-first fail-closed.
export { cursorOf, scopeWhere, parseCursor };
