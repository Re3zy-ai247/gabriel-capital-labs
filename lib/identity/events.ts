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
  // ── Operator Enrollment (Slice 2) — pre-membership evidence (§2.8).
  "ENROLLMENT_REQUESTED",
  "ENROLLMENT_ACCEPTED",
  "ENROLLMENT_EXPIRED",
  "ENROLLMENT_REVOKED",
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

// ── Operator Lifecycle Runtime (Slice 1) — versioned evidence, §11.2 ──────────
// The sealed decision record the lifecycle command produces. Every field is an input to
// the decision or a provenance reference; nothing is derived from ambient state.
export interface EvidenceInput {
  policyVersion: string;
  operatorId: string;
  from: OperatorState;
  to: OperatorState;
  authorityClass: string;
  basis: string;
  actorId: string;
  commandId: string;
  effectiveAt: number;
  stepUp: boolean;
  decisionDigest: string;
  causationId: string | null;
}

// The dedupeKey is the commandId ALONE, so the derived event id is a pure function of the
// command. That is what makes the event stream the idempotency ledger: a
// replay of the same command collides on the same id, and a DIFFERENT command carrying a
// reused id is detected by comparing payloads rather than being silently swallowed.
export function buildOperatorStateChangedEvent(
  operator: { id: string; accountId: string }, evidence: EvidenceInput, actorId: string, correlationId?: string,
): IdentityEventInput {
  return {
    type: "OPERATOR_STATE_CHANGED",
    tenantId: operator.accountId,
    actorId,
    correlationId,
    payload: { ...evidence },
    dedupeKey: `operator-lifecycle:${evidence.commandId}`,
  };
}

// Build + validate + authorize a durable draft WITHOUT writing it, so the caller can
// enlist the append in its own transaction (§11). Same fail-closed ladder as
// recordIdentityEvent: contract -> payload/PII validation -> publish PEP.
export type DraftResult =
  | { ok: true; event: DraftEvent }
  | { ok: false; code: "disabled" | "invalid" | "forbidden"; error: string };

export function draftIdentityEvent(input: IdentityEventInput): DraftResult {
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

  const source = contract.defaultSource;
  const id = deriveEventId(input.tenantId, input.type, source, input.dedupeKey);
  return {
    ok: true,
    event: {
      id,
      type: input.type as EventType,
      version,
      tenantId: input.tenantId,
      agencyId: input.agencyId ?? null,
      actorId: input.actorId,
      source,
      correlationId: input.correlationId ?? id,
      payload: valid.payload,
    },
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

// ── Operator Enrollment (Slice 2) — pre-membership evidence builders ──────────
// PURE. Each returns the refs-only input for one enrollment fact. The dedupeKey is the
// commandId ALONE, so the derived event id is a pure function of the command and the
// event stream is the idempotency ledger (§11.2): a replay collides deterministically,
// and a reused commandId carrying different material inputs is caught by payload
// comparison rather than silently swallowed.
//
// `authorityClass: "NONE"` is a literal in every payload and in every contract: an
// enrollment fact can never be read as an authorization fact (§2.8, §5.2).

const enrollmentInput = (
  type: IdentityEventType, subjectAccountId: string, organizationId: string,
  actorId: string, commandId: string, payload: Record<string, unknown>, correlationId?: string,
): IdentityEventInput => ({
  type,
  tenantId: subjectAccountId, // the SUBJECT's account — server-resolved
  actorId,
  agencyId: organizationId,
  correlationId,
  payload,
  dedupeKey: `operator-enrollment:${commandId}`,
});

export function enrollmentRequestedEvent(
  p: {
    enrollmentId: string; organizationId: string; subjectAccountId: string;
    entry: "INVITATION" | "APPLICATION"; state: "INVITED" | "REQUESTED";
    basis: "ORGANIZATION_INVITED" | "SUBJECT_APPLIED"; policyVersion: string;
    actorId: string; commandId: string; effectiveAt: number; expiresAt: number;
    decisionDigest: string; causationId: string | null;
  }, correlationId?: string,
): IdentityEventInput {
  return enrollmentInput("ENROLLMENT_REQUESTED", p.subjectAccountId, p.organizationId, p.actorId, p.commandId, {
    enrollmentId: p.enrollmentId, organizationId: p.organizationId, subjectAccountId: p.subjectAccountId,
    entry: p.entry, state: p.state, basis: p.basis, authorityClass: "NONE",
    policyVersion: p.policyVersion, actorId: p.actorId, commandId: p.commandId,
    effectiveAt: p.effectiveAt, expiresAt: p.expiresAt,
    decisionDigest: p.decisionDigest, causationId: p.causationId,
  }, correlationId);
}

export function enrollmentAcceptedEvent(
  p: {
    enrollmentId: string; organizationId: string; subjectAccountId: string;
    entry: "INVITATION" | "APPLICATION"; from: "INVITED" | "REQUESTED";
    basis: "SUBJECT_ACCEPTED" | "ORGANIZATION_APPROVED"; policyVersion: string;
    actorId: string; commandId: string; effectiveAt: number; invitationRef: string;
    consentPurpose: "OPERATOR_ENROLLMENT" | "OPERATOR_TERMS"; consentScope: string;
    consentMechanism: "EXPLICIT_CHECKBOX" | "SIGNED_ACCEPTANCE" | "ADMINISTRATIVE_RECORD";
    consentPolicyVersion: string; consentEffectiveAt: number; consentDigest: string;
    decisionDigest: string; causationId: string | null;
  }, correlationId?: string,
): IdentityEventInput {
  return enrollmentInput("ENROLLMENT_ACCEPTED", p.subjectAccountId, p.organizationId, p.actorId, p.commandId, {
    enrollmentId: p.enrollmentId, organizationId: p.organizationId, subjectAccountId: p.subjectAccountId,
    entry: p.entry, from: p.from, to: "ACCEPTED", basis: p.basis, authorityClass: "NONE",
    policyVersion: p.policyVersion, actorId: p.actorId, commandId: p.commandId,
    effectiveAt: p.effectiveAt, invitationRef: p.invitationRef,
    consentPurpose: p.consentPurpose, consentScope: p.consentScope,
    consentMechanism: p.consentMechanism, consentPolicyVersion: p.consentPolicyVersion,
    consentEffectiveAt: p.consentEffectiveAt, consentDigest: p.consentDigest,
    decisionDigest: p.decisionDigest, causationId: p.causationId,
  }, correlationId);
}

export function enrollmentExpiredEvent(
  p: {
    enrollmentId: string; organizationId: string; subjectAccountId: string;
    from: "INVITED" | "REQUESTED"; policyVersion: string; actorId: string;
    commandId: string; effectiveAt: number; expiresAt: number;
    decisionDigest: string; causationId: string | null;
  }, correlationId?: string,
): IdentityEventInput {
  return enrollmentInput("ENROLLMENT_EXPIRED", p.subjectAccountId, p.organizationId, p.actorId, p.commandId, {
    enrollmentId: p.enrollmentId, organizationId: p.organizationId, subjectAccountId: p.subjectAccountId,
    from: p.from, to: "EXPIRED", basis: "INVITATION_LAPSED", authorityClass: "NONE",
    policyVersion: p.policyVersion, actorId: p.actorId, commandId: p.commandId,
    effectiveAt: p.effectiveAt, expiresAt: p.expiresAt,
    decisionDigest: p.decisionDigest, causationId: p.causationId,
  }, correlationId);
}

export function enrollmentRevokedEvent(
  p: {
    enrollmentId: string; organizationId: string; subjectAccountId: string;
    from: "INVITED" | "REQUESTED"; basis: "ORGANIZATION_REVOKED" | "SUBJECT_WITHDREW";
    policyVersion: string; actorId: string; commandId: string; effectiveAt: number;
    decisionDigest: string; causationId: string | null;
  }, correlationId?: string,
): IdentityEventInput {
  return enrollmentInput("ENROLLMENT_REVOKED", p.subjectAccountId, p.organizationId, p.actorId, p.commandId, {
    enrollmentId: p.enrollmentId, organizationId: p.organizationId, subjectAccountId: p.subjectAccountId,
    from: p.from, to: "REVOKED", basis: p.basis, authorityClass: "NONE",
    policyVersion: p.policyVersion, actorId: p.actorId, commandId: p.commandId,
    effectiveAt: p.effectiveAt, decisionDigest: p.decisionDigest, causationId: p.causationId,
  }, correlationId);
}
