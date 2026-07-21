// Operator Identity — repository (Sprint 9).
//
// The ONLY data-access layer for the identity tables. Every write is idempotent or
// race-safe:
//   • registerOperator / addMembership — find-or-create guarded by a UNIQUE constraint
//     (accountId; (organizationId, operatorId)); a retry or a concurrent caller returns
//     the existing row, never a duplicate.
//   • transitions (operator state, membership role/state) — a GUARDED updateMany
//     `where: { ...id, <field>: from }` that is atomic: exactly one row moves only if it
//     was in `from`. count 0 => it was not in the expected state (already moved / gone /
//     concurrent) => the caller treats it as a conflict, never a blind overwrite. This
//     is what makes lost-update / double-apply impossible without a serial lock.
//
// Authorization + tenant/organization isolation live in the SERVICE (service.ts); this
// layer takes ids the service has already authorized. It never reads request/query input.
import { Prisma } from "@prisma/client";
import type { OperatorIdentity, Organization, OrganizationMembership } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OperatorState, MembershipState } from "./state";
import type { OrgRole } from "./rbac";

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// ── Operator identity ────────────────────────────────────────────────────────
export function findOperatorByAccount(accountId: string): Promise<OperatorIdentity | null> {
  return prisma.operatorIdentity.findUnique({ where: { accountId } });
}
export function findOperatorById(operatorId: string): Promise<OperatorIdentity | null> {
  return prisma.operatorIdentity.findUnique({ where: { id: operatorId } });
}

// Idempotent: ONE operator identity per account, ever. Retry/race-safe.
export async function registerOperator(accountId: string): Promise<{ operator: OperatorIdentity; created: boolean }> {
  const existing = await prisma.operatorIdentity.findUnique({ where: { accountId } });
  if (existing) return { operator: existing, created: false };
  try {
    const operator = await prisma.operatorIdentity.create({ data: { accountId } }); // state defaults PENDING
    return { operator, created: true };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const operator = await prisma.operatorIdentity.findUnique({ where: { accountId } });
      if (operator) return { operator, created: false };
    }
    throw e; // retry-safe: surface real failures
  }
}

// Race-safe guarded transition. Returns the updated row ONLY when exactly one row moved.
export async function transitionOperator(
  operatorId: string, from: OperatorState, to: OperatorState, reason?: string | null,
): Promise<{ count: number; operator: OperatorIdentity | null }> {
  const res = await prisma.operatorIdentity.updateMany({
    where: { id: operatorId, state: from },
    data: { state: to, stateReason: reason ?? null },
  });
  if (res.count !== 1) return { count: res.count, operator: null };
  const operator = await prisma.operatorIdentity.findUnique({ where: { id: operatorId } });
  return { count: 1, operator };
}

// ── Organization ─────────────────────────────────────────────────────────────
export async function createOrganization(
  input: { ownerAccountId: string; name: string; slug: string; kind?: "AGENCY" },
): Promise<{ ok: true; org: Organization } | { ok: false; error: "slug_taken" }> {
  try {
    const org = await prisma.organization.create({
      data: { ownerAccountId: input.ownerAccountId, name: input.name, slug: input.slug, kind: input.kind ?? "AGENCY" },
    });
    return { ok: true, org };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "slug_taken" };
    throw e;
  }
}
export function findOrganizationById(id: string): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { id } });
}
export function findOrganizationBySlug(slug: string): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { slug } });
}

// ── Membership ───────────────────────────────────────────────────────────────
const membershipKey = (organizationId: string, operatorId: string) => ({
  organizationId_operatorId: { organizationId, operatorId },
});

export function findMembership(organizationId: string, operatorId: string): Promise<OrganizationMembership | null> {
  return prisma.organizationMembership.findUnique({ where: membershipKey(organizationId, operatorId) });
}

// Idempotent via UNIQUE(organizationId, operatorId): a retry / duplicate add returns the
// existing row (never a second membership => no duplicate, no orphan).
export async function addMembership(
  input: { organizationId: string; operatorId: string; role: OrgRole },
): Promise<{ membership: OrganizationMembership; created: boolean }> {
  const existing = await findMembership(input.organizationId, input.operatorId);
  if (existing) return { membership: existing, created: false };
  try {
    const membership = await prisma.organizationMembership.create({
      data: { organizationId: input.organizationId, operatorId: input.operatorId, role: input.role },
    });
    return { membership, created: true };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const membership = await findMembership(input.organizationId, input.operatorId);
      if (membership) return { membership, created: false };
    }
    throw e;
  }
}

export async function changeMembershipRole(
  organizationId: string, operatorId: string, from: OrgRole, to: OrgRole,
): Promise<{ count: number; membership: OrganizationMembership | null }> {
  // The CAS guard keys on BOTH role AND state: "ACTIVE". Role and state live in
  // orthogonal columns, so guarding role alone would let a role change commit over a
  // concurrent remove/suspend (a REMOVED row emerging with an elevated role that would
  // resurface on reactivation). Requiring state ACTIVE forces a concurrent state move
  // to make this a count-0 conflict. (The subsequent read-back is a plain round-trip;
  // under heavy concurrency the returned row/audit seq may reflect a later transition —
  // non-exploitable, and atomic write+read coupling is a documented future hardening.)
  const res = await prisma.organizationMembership.updateMany({
    where: { organizationId, operatorId, role: from, state: "ACTIVE" },
    data: { role: to },
  });
  if (res.count !== 1) return { count: res.count, membership: null };
  const membership = await findMembership(organizationId, operatorId);
  return { count: 1, membership };
}

export async function transitionMembership(
  organizationId: string, operatorId: string, from: MembershipState, to: MembershipState,
): Promise<{ count: number }> {
  const res = await prisma.organizationMembership.updateMany({
    where: { organizationId, operatorId, state: from },
    data: { state: to },
  });
  return { count: res.count };
}

// Reads — the service authorizes the caller for `operatorId`/`organizationId` first.
export function listMembershipsForOperator(operatorId: string): Promise<OrganizationMembership[]> {
  return prisma.organizationMembership.findMany({ where: { operatorId }, orderBy: { createdAt: "asc" } });
}
export function listMembersOfOrganization(organizationId: string): Promise<OrganizationMembership[]> {
  return prisma.organizationMembership.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });
}
