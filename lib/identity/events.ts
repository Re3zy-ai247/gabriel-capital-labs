// Operator Identity — durable identity events (Sprint 9).
//
// Identity is the OWNER of the durable identity event stream (OPERATOR-IDENTITY.md §5).
// These are Security/Audit events: refs-only, no external delivery (ADR-0036 §5). They
// are recorded onto the SAME Event Fabric spine as everything else (no second bus): the
// same contracts (lib/eventBus/contracts.ts), the same fail-closed validation
// (validateEvent — contract + PII guard), the same publish PEP (authorizePublish), and
// the same idempotent, replay-safe durable store (appendEvent, deterministic
// tenant-scoped id). The ONLY difference from publish() is deliberate: no fanout (audit
// events are persisted, not delivered), and the gate is the identity flag, so audit
// records whenever the identity runtime runs — never coupled to the realtime bus flag.
//
// The recorder runs under a TRUSTED systemIdentity (the identity service is platform
// infrastructure): tenant = the SUBJECT's account id (server-resolved), actor = the real
// principal who caused it (server-resolved). Never built from client input.
import { getContract, currentVersion } from "@/lib/eventBus/contracts";
import { validateEvent } from "@/lib/eventBus/validate";
import { authorizePublish } from "@/lib/eventBus/publish";
import { appendEvent } from "@/lib/eventBus/store";
import { deriveEventId, systemIdentity, type DraftEvent, type EventType } from "@/lib/eventBus/envelope";
import { operatorIdentityEnabled } from "./flags";
import type { OperatorState } from "./state";
import type { OrgRole } from "./rbac";

// The identity subset of the platform event taxonomy.
export const IDENTITY_EVENT_TYPES = [
  "OPERATOR_REGISTERED",
  "OPERATOR_STATE_CHANGED",
  "ORGANIZATION_CREATED",
  "MEMBERSHIP_ADDED",
  "MEMBERSHIP_ROLE_CHANGED",
  "MEMBERSHIP_REMOVED",
] as const;
export type IdentityEventType = (typeof IDENTITY_EVENT_TYPES)[number];

export interface IdentityEventInput {
  type: IdentityEventType;
  tenantId: string; // the SUBJECT's account id (operator account / org owner account) — server-resolved
  actorId: string; // the real principal who caused it — server-resolved
  agencyId?: string | null;
  payload: Record<string, unknown>; // refs-only, per contract
  dedupeKey: string; // stable natural key (retry -> same id -> no-op)
  correlationId?: string;
}

export type RecordResult =
  | { ok: true; eventId: string; replayed: boolean }
  | { ok: false; code: "disabled" | "invalid" | "forbidden"; error: string };

// Record a durable, idempotent, refs-only identity audit event. Fail-closed at every
// step (flag off, unknown contract, invalid/PII payload, unauthorized). No fanout.
export async function recordIdentityEvent(input: IdentityEventInput): Promise<RecordResult> {
  if (!operatorIdentityEnabled()) return { ok: false, code: "disabled", error: "operator identity disabled" };

  const version = currentVersion(input.type as EventType);
  const contract = getContract(input.type, version);
  if (!contract) return { ok: false, code: "invalid", error: `unknown contract ${input.type}@${version}` };

  const valid = validateEvent(input.type, version, input.payload);
  if (!valid.ok) return { ok: false, code: "invalid", error: valid.error };
  if (!input.dedupeKey) return { ok: false, code: "invalid", error: "missing dedupeKey" };
  if (!input.tenantId || !input.actorId) return { ok: false, code: "invalid", error: "unresolved identity" };

  const identity = systemIdentity(input.tenantId, { actorId: input.actorId, agencyId: input.agencyId ?? null });
  const authz = authorizePublish(contract, identity);
  if (!authz.ok) return { ok: false, code: "forbidden", error: authz.reason };

  const source = contract.defaultSource; // "identity"
  const id = deriveEventId(input.tenantId, input.type, source, input.dedupeKey);
  const draft: DraftEvent = {
    id,
    type: input.type as EventType,
    version,
    tenantId: input.tenantId,
    agencyId: input.agencyId ?? null,
    actorId: input.actorId,
    source,
    correlationId: input.correlationId ?? id,
    payload: valid.payload,
  };
  const { event, replayed } = await appendEvent(draft); // durable + idempotent; NO fanout
  return { ok: true, eventId: event.id, replayed };
}

// ── Pure builders — construct the refs-only input for each identity event. Tested
// without a DB. `seq` (a monotonic discriminator, e.g. the row's updatedAt ms) makes
// each APPLIED transition a distinct audit record so an oscillating state/role change
// (SUSPENDED -> ACTIVE -> SUSPENDED) is never collapsed into one by idempotency. ──────

export function operatorRegisteredEvent(operator: { id: string; accountId: string }, actorId: string): IdentityEventInput {
  return {
    type: "OPERATOR_REGISTERED",
    tenantId: operator.accountId,
    actorId,
    payload: { operatorId: operator.id, accountId: operator.accountId },
    dedupeKey: `operator:${operator.id}:registered`,
  };
}

export function operatorStateChangedEvent(
  operator: { id: string; accountId: string }, from: OperatorState, to: OperatorState, actorId: string, seq: number,
): IdentityEventInput {
  return {
    type: "OPERATOR_STATE_CHANGED",
    tenantId: operator.accountId,
    actorId,
    payload: { operatorId: operator.id, from, to },
    dedupeKey: `operator:${operator.id}:state:${to}:${seq}`,
  };
}

export function organizationCreatedEvent(org: { id: string; ownerAccountId: string; kind: string }, actorId: string): IdentityEventInput {
  return {
    type: "ORGANIZATION_CREATED",
    tenantId: org.ownerAccountId,
    actorId,
    agencyId: org.id,
    payload: { organizationId: org.id, ownerAccountId: org.ownerAccountId, kind: org.kind },
    dedupeKey: `org:${org.id}:created`,
  };
}

export function membershipAddedEvent(
  m: { organizationId: string; operatorId: string; role: OrgRole }, ownerAccountId: string, actorId: string,
): IdentityEventInput {
  return {
    type: "MEMBERSHIP_ADDED",
    tenantId: ownerAccountId,
    actorId,
    agencyId: m.organizationId,
    payload: { organizationId: m.organizationId, operatorId: m.operatorId, role: m.role },
    dedupeKey: `membership:${m.organizationId}:${m.operatorId}:added`,
  };
}

export function membershipRoleChangedEvent(
  m: { organizationId: string; operatorId: string }, from: OrgRole, to: OrgRole, ownerAccountId: string, actorId: string, seq: number,
): IdentityEventInput {
  return {
    type: "MEMBERSHIP_ROLE_CHANGED",
    tenantId: ownerAccountId,
    actorId,
    agencyId: m.organizationId,
    payload: { organizationId: m.organizationId, operatorId: m.operatorId, from, to },
    dedupeKey: `membership:${m.organizationId}:${m.operatorId}:role:${to}:${seq}`,
  };
}

export function membershipRemovedEvent(
  m: { organizationId: string; operatorId: string }, ownerAccountId: string, actorId: string,
): IdentityEventInput {
  return {
    type: "MEMBERSHIP_REMOVED",
    tenantId: ownerAccountId,
    actorId,
    agencyId: m.organizationId,
    payload: { organizationId: m.organizationId, operatorId: m.operatorId },
    dedupeKey: `membership:${m.organizationId}:${m.operatorId}:removed`,
  };
}
