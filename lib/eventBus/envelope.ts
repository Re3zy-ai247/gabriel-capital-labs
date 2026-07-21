// Platform Event Bus — the immutable event envelope (Sprint 8).
//
// This is a SUPERSET of the kernel's KaiEvent{id,type,tenantId,stamp,payload}
// (lib/os/kernel/types.ts): same immutable-log spirit, extended with the fields a
// PLATFORM backbone needs — actorId (the principal), agencyId (the second isolation
// axis), source (emitting subsystem), correlationId (ties related events), and a
// contract `version`. It is NOT a second bus: persistence reuses the Sprint 7
// durable+cursor pattern, idempotency reuses the kernel's durable ledger, and audit
// reuses KernelAudit. The genuinely new thing is a FULL-PAYLOAD durable log
// (KernelEvent persists only a payload hash, by founder privacy directive, so it
// cannot be extended for replay).
//
// Isolation is keyed on IDS, never names. actor = the real signed-in principal
// (currentAccount().id); tenant = the DATA-OWNING scope (currentUser().id — a
// client's id when an agency has that client open); agency = the owning agency id
// (never agencyName, which is spoofable). Mirrors lib/os/host/identity.ts.
import { createHash } from "crypto";

// The closed set of platform event types. Adding one is a deliberate, reviewed
// change (a new contract in contracts.ts) — the bus fails closed on any unknown type.
export const EVENT_TYPES = [
  "DISPUTE_CREATED",
  "LETTER_GENERATED",
  "LETTER_SENT",
  "ACCOUNT_DELETED",
  "ACCOUNT_UPDATED",
  "CLIENT_CREATED",
  "CLIENT_UPDATED",
  "ACHIEVEMENT_UNLOCKED",
  "ARENA_POINTS_CHANGED",
  "MISSION_COMPLETED",
  "NOTIFICATION_CREATED",
  "SYSTEM_EVENT",
  "KAI_INSIGHT_CREATED",
  // ── Operator Identity (Sprint 9) — Security/Audit category, refs-only, no external
  // delivery (ADR-0036 §5). Recorded by lib/identity via the durable store; the
  // human-readable reason lives on the row, never in the refs-only payload.
  "OPERATOR_REGISTERED",
  "OPERATOR_STATE_CHANGED",
  "ORGANIZATION_CREATED",
  "MEMBERSHIP_ADDED",
  "MEMBERSHIP_ROLE_CHANGED",
  "MEMBERSHIP_REMOVED",
  // ── Operator Reputation (Sprint 10) — refs-only progression facts recorded by
  // lib/reputation. XP grants reuse ARENA_POINTS_CHANGED and badges reuse
  // ACHIEVEMENT_UNLOCKED (one fact type per fact — no duplicates); only the two
  // genuinely missing facts are added here.
  "OPERATOR_RANK_CHANGED",
  "MILESTONE_REACHED",
  // Canonical Reputation-domain facts (Sprint 10 Phase 6). OPERATOR_XP_CHANGED supersedes
  // the Arena-named ARENA_POINTS_CHANGED (retained, deprecated, replay-only);
  // REPUTATION_AWARD_REVERSED is the dedicated compensating-record fact.
  "OPERATOR_XP_CHANGED",
  "REPUTATION_AWARD_REVERSED",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// Who may publish an event, along the isolation axes:
//   self     — about the actor's OWN data (tenant derived server-side from the actor)
//   agency   — about a managed client (actor must be an agency)
//   platform — system/admin-initiated (SYSTEM_EVENT, notifications, Kai insights)
export type PublishScope = "self" | "agency" | "platform";

// The immutable envelope. `id` is deterministic (see deriveEventId) so publishing is
// idempotent; `payload` is typed per contract and REFS-ONLY (no value-bearing PII).
export interface PlatformEvent<T = Record<string, unknown>> {
  id: string;
  type: EventType;
  version: number;
  tenantId: string;          // data-owning scope
  agencyId: string | null;   // agency isolation axis (id, never name); null = no agency
  actorId: string;           // the real principal who caused it
  source: string;            // emitting subsystem, e.g. "letters", "arena", "system"
  correlationId: string;     // ties related events; stable across retries
  payload: T;
  createdAt: string;         // ISO — assigned by the store (DB default), echoed here
  redactedAt: string | null; // data-subject erasure tombstone (payload cleared, envelope kept)
}

// What a publisher builds — everything except the fields the STORE owns (the DB
// assigns createdAt; redactedAt is null until an erasure).
export type DraftEvent<T = Record<string, unknown>> = Omit<PlatformEvent<T>, "createdAt" | "redactedAt">;

// The resolved, SERVER-SIDE identity a publish runs under. Never built from client
// input. `trusted` marks an internal system publisher (the platform itself) — only
// server code can construct one; it satisfies the "platform" scope without a session.
export interface PublishIdentity {
  actorId: string;
  tenantId: string;
  agencyId: string | null;
  isAdmin: boolean;
  isAgency: boolean;
  grantedPermissions: ReadonlySet<string>;
  trusted: boolean;
}

// Derive the identity for a normal request. actor = the real account (principal);
// tenant = the data-owning user (a client's id when an agency has it open); agency =
// the owning agency id ONLY when the account itself is an agency, else the data
// owner's managing agency, else null. Never `account.id ?? managedByAgencyId`.
export function requestIdentity(
  account: { id: string; role?: string | null; isAgency?: boolean | null },
  dataOwner: { id: string; managedByAgencyId?: string | null },
  grantedPermissions: ReadonlySet<string>,
): PublishIdentity {
  const isAgency = account.isAgency === true;
  const agencyId = isAgency ? account.id : (dataOwner.managedByAgencyId ?? null);
  return {
    actorId: account.id,
    tenantId: dataOwner.id,
    agencyId,
    isAdmin: account.role === "ADMIN",
    isAgency,
    grantedPermissions,
    trusted: false,
  };
}

// Trusted internal system publisher (the platform itself). Constructed only by server
// code — never reachable from an HTTP request body. Used for SYSTEM_EVENT / platform
// notifications / Kai insights, scoped to a specific tenant.
export function systemIdentity(tenantId: string, opts?: { actorId?: string; agencyId?: string | null }): PublishIdentity {
  return {
    actorId: opts?.actorId ?? "system",
    tenantId,
    agencyId: opts?.agencyId ?? null,
    isAdmin: true,
    isAgency: false,
    grantedPermissions: new Set<string>(),
    trusted: true,
  };
}

// Deterministic event id — the idempotency key. Includes the event TYPE and the tenant,
// so two DIFFERENT types (or two tenants) sharing a source + dedupeKey can never collide
// on the PK and get one silently dropped as a false "replay". A retry with the same
// (tenant, type, source, dedupeKey) yields the same id → ON CONFLICT no-op → replayed.
// `version` is deliberately EXCLUDED so a retry stays idempotent across a contract-version
// bump (same logical event = same id); type is what prevents the cross-type collision.
export function deriveEventId(tenantId: string, type: string, source: string, dedupeKey: string): string {
  const h = createHash("sha256").update(`${tenantId}|${type}|${source}|${dedupeKey}`).digest("hex");
  return `evt_${h.slice(0, 32)}`;
}
