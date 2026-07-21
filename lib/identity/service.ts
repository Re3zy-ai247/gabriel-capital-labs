// Operator Identity — runtime service (Sprint 9). The single orchestration door.
//
// Every mutation runs the same fail-closed pipeline:
//   flag (OPERATOR_IDENTITY_ENABLED) → principal present → AUTHORIZE by id → validate
//   input → state-machine check → idempotent/guarded write → record durable event.
//
// AUTHORIZATION IS BY ID, NEVER BY NAME. Org mutations require the caller to BE the org
// owner (org.ownerAccountId === principal.id, resolved from the stored row) or an ADMIN —
// never a client-supplied org name/slug. This is the "organization isolation" that makes
// org spoofing and cross-org tampering impossible. Reads are self/owned-org/admin only.
//
// The write and its audit event are sequential and each idempotent (a deterministic
// event id makes a retry a no-op). A crash between the committed write and the event is
// the same at-most-once-effect window the Event Fabric's replay/reconciliation is built
// to backfill; atomic write+event coupling is a documented future hardening.
import { operatorIdentityEnabled } from "./flags";
import { type IdentityPrincipal, isAdmin } from "./principal";
import { canTransitionOperator, canTransitionMembership, type OperatorState } from "./state";
import { type OrgRole } from "./rbac";
import { createOrganizationInput, addMembershipInput, changeRoleInput, slugSchema, slugify, stateReasonSchema } from "./validation";
import * as repo from "./repository";
import {
  recordIdentityEvent,
  operatorRegisteredEvent, operatorStateChangedEvent, organizationCreatedEvent,
  membershipAddedEvent, membershipRoleChangedEvent, membershipRemovedEvent,
} from "./events";
import type { OperatorIdentity, Organization, OrganizationMembership } from "@prisma/client";

export type ErrorCode = "disabled" | "forbidden" | "invalid" | "conflict" | "not_found";
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; error: string };

const fail = (code: ErrorCode, error: string): { ok: false; code: ErrorCode; error: string } => ({ ok: false, code, error });

// Gate shared by every operation: runtime enabled + a real principal.
function gate(principal: IdentityPrincipal | null): { ok: true; principal: IdentityPrincipal } | { ok: false; code: ErrorCode; error: string } {
  if (!operatorIdentityEnabled()) return fail("disabled", "operator identity disabled");
  if (!principal || principal.disabled) return fail("forbidden", "no principal");
  return { ok: true, principal };
}

function ownsOrAdmin(principal: IdentityPrincipal, ownerAccountId: string): boolean {
  return isAdmin(principal) || principal.id === ownerAccountId;
}

// ── Operator lifecycle ───────────────────────────────────────────────────────

// An account registers its OWN operator identity. Idempotent (one per account).
export async function registerOwnOperator(principal: IdentityPrincipal | null): Promise<ServiceResult<{ operator: OperatorIdentity; created: boolean }>> {
  const g = gate(principal); if (!g.ok) return g;
  const { operator, created } = await repo.registerOperator(g.principal.id);
  if (created) await recordIdentityEvent(operatorRegisteredEvent(operator, g.principal.id));
  return { ok: true, data: { operator, created } };
}

// Change an operator's lifecycle state. ADMIN may perform any legal transition; the
// operator themselves may only DEACTIVATE their own identity. Fail-closed otherwise.
export async function transitionOperatorState(
  principal: IdentityPrincipal | null, operatorId: string, to: OperatorState, reason?: string,
): Promise<ServiceResult<{ operator: OperatorIdentity }>> {
  const g = gate(principal); if (!g.ok) return g;
  const reasonParse = stateReasonSchema.safeParse(reason);
  if (!reasonParse.success) return fail("invalid", "invalid reason");

  const operator = await repo.findOperatorById(operatorId);
  if (!operator) return fail("not_found", "operator not found");

  const isSelf = operator.accountId === g.principal.id;
  const allowed = isAdmin(g.principal) || (isSelf && to === "DEACTIVATED");
  if (!allowed) return fail("forbidden", "not authorized to transition this operator");

  const from = operator.state as OperatorState;
  if (from === to) return fail("conflict", `already ${to}`);
  if (!canTransitionOperator(from, to)) return fail("invalid", `illegal transition ${from} -> ${to}`);

  const res = await repo.transitionOperator(operatorId, from, to, reasonParse.data ?? null);
  if (res.count !== 1 || !res.operator) return fail("conflict", "state changed concurrently");

  await recordIdentityEvent(operatorStateChangedEvent(res.operator, from, to, g.principal.id, res.operator.updatedAt.getTime()));
  return { ok: true, data: { operator: res.operator } };
}

// ── Organization ─────────────────────────────────────────────────────────────

export async function createOrganization(
  principal: IdentityPrincipal | null, input: unknown,
): Promise<ServiceResult<{ organization: Organization }>> {
  const g = gate(principal); if (!g.ok) return g;
  const parsed = createOrganizationInput.safeParse(input);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "invalid input");

  const candidate = parsed.data.slug ?? slugify(parsed.data.name);
  const slug = slugSchema.safeParse(candidate);
  if (!slug.success) return fail("invalid", "could not derive a valid slug from the name; provide one");

  const res = await repo.createOrganization({ ownerAccountId: g.principal.id, name: parsed.data.name, slug: slug.data, kind: "AGENCY" });
  if (!res.ok) return fail("conflict", "slug already taken");

  await recordIdentityEvent(organizationCreatedEvent(res.org, g.principal.id));
  return { ok: true, data: { organization: res.org } };
}

// ── Membership (RBAC) ────────────────────────────────────────────────────────

// Load the org and authorize the caller as owner/admin. Fail-closed on a missing/
// archived org. Returns the org so the caller can stamp events with ownerAccountId.
async function authorizeOrgManage(principal: IdentityPrincipal, organizationId: string): Promise<{ ok: true; org: Organization } | { ok: false; code: ErrorCode; error: string }> {
  const org = await repo.findOrganizationById(organizationId);
  if (!org) return fail("not_found", "organization not found");
  if (org.state === "ARCHIVED") return fail("conflict", "organization is archived");
  if (!ownsOrAdmin(principal, org.ownerAccountId)) return fail("forbidden", "not the organization owner");
  return { ok: true, org };
}

export async function addMember(principal: IdentityPrincipal | null, input: unknown): Promise<ServiceResult<{ membership: OrganizationMembership; created: boolean }>> {
  const g = gate(principal); if (!g.ok) return g;
  const parsed = addMembershipInput.safeParse(input);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "invalid input");

  const authz = await authorizeOrgManage(g.principal, parsed.data.organizationId);
  if (!authz.ok) return authz;

  const operator = await repo.findOperatorById(parsed.data.operatorId);
  if (!operator) return fail("not_found", "operator not found");
  if (operator.state === "DEACTIVATED") return fail("conflict", "operator is deactivated");

  const existing = await repo.findMembership(parsed.data.organizationId, parsed.data.operatorId);
  if (existing && existing.state === "REMOVED") return fail("conflict", "membership was removed (terminal); a new decision is required");

  const { membership, created } = await repo.addMembership({ organizationId: parsed.data.organizationId, operatorId: parsed.data.operatorId, role: parsed.data.role });
  if (created) await recordIdentityEvent(membershipAddedEvent(membership, authz.org.ownerAccountId, g.principal.id));
  return { ok: true, data: { membership, created } };
}

export async function changeMemberRole(principal: IdentityPrincipal | null, input: unknown): Promise<ServiceResult<{ membership: OrganizationMembership }>> {
  const g = gate(principal); if (!g.ok) return g;
  const parsed = changeRoleInput.safeParse(input);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "invalid input");

  const authz = await authorizeOrgManage(g.principal, parsed.data.organizationId);
  if (!authz.ok) return authz;

  const membership = await repo.findMembership(parsed.data.organizationId, parsed.data.operatorId);
  if (!membership) return fail("not_found", "membership not found");
  if (membership.state !== "ACTIVE") return fail("conflict", `membership is ${membership.state}`);
  const from = membership.role as OrgRole;
  const to = parsed.data.role;
  if (from === to) return fail("conflict", `already ${to}`);

  const res = await repo.changeMembershipRole(parsed.data.organizationId, parsed.data.operatorId, from, to);
  if (res.count !== 1 || !res.membership) return fail("conflict", "role changed concurrently");

  await recordIdentityEvent(membershipRoleChangedEvent(res.membership, from, to, authz.org.ownerAccountId, g.principal.id, res.membership.updatedAt.getTime()));
  return { ok: true, data: { membership: res.membership } };
}

export async function removeMember(principal: IdentityPrincipal | null, input: { organizationId: string; operatorId: string }): Promise<ServiceResult<{ removed: true }>> {
  const g = gate(principal); if (!g.ok) return g;
  const authz = await authorizeOrgManage(g.principal, input.organizationId);
  if (!authz.ok) return authz;

  const membership = await repo.findMembership(input.organizationId, input.operatorId);
  if (!membership) return fail("not_found", "membership not found");
  if (membership.state === "REMOVED") return fail("conflict", "already removed");
  if (!canTransitionMembership(membership.state, "REMOVED")) return fail("invalid", "cannot remove from this state");

  const res = await repo.transitionMembership(input.organizationId, input.operatorId, membership.state, "REMOVED");
  if (res.count !== 1) return fail("conflict", "membership changed concurrently");

  await recordIdentityEvent(membershipRemovedEvent(membership, authz.org.ownerAccountId, g.principal.id));
  return { ok: true, data: { removed: true } };
}

// ── Reads (isolation: self / owned-org / admin) ──────────────────────────────

export async function getOperator(principal: IdentityPrincipal | null, operatorId: string): Promise<ServiceResult<{ operator: OperatorIdentity }>> {
  const g = gate(principal); if (!g.ok) return g;
  const operator = await repo.findOperatorById(operatorId);
  if (!operator) return fail("not_found", "operator not found");
  if (!(isAdmin(g.principal) || operator.accountId === g.principal.id)) return fail("forbidden", "not authorized");
  return { ok: true, data: { operator } };
}

export async function listMembersOfOrganization(principal: IdentityPrincipal | null, organizationId: string): Promise<ServiceResult<{ members: OrganizationMembership[] }>> {
  const g = gate(principal); if (!g.ok) return g;
  const authz = await authorizeOrgManage(g.principal, organizationId);
  if (!authz.ok) return authz;
  const members = await repo.listMembersOfOrganization(organizationId);
  return { ok: true, data: { members } };
}

export async function listMyMemberships(principal: IdentityPrincipal | null): Promise<ServiceResult<{ memberships: OrganizationMembership[] }>> {
  const g = gate(principal); if (!g.ok) return g;
  const operator = await repo.findOperatorByAccount(g.principal.id);
  if (!operator) return { ok: true, data: { memberships: [] } };
  const memberships = await repo.listMembershipsForOperator(operator.id);
  return { ok: true, data: { memberships } };
}
