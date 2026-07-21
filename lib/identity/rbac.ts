// Operator Identity — organization RBAC (Sprint 9).
//
// PURE, fail-closed. This is the RBAC EXTENSION point the platform lacks today
// (User.role is exactly {USER, ADMIN}). It is a permission-SET MAPPING — org role →
// the set of org-scoped permissions it grants — NOT a parallel authorization engine.
// The future kernel PEP (lib/os/kernel/pep.ts) is intended to consume this map so
// org-scoped decisions resolve through the SAME PEP as everything else; nothing here
// enforces access on its own. Permission names are colon-namespaced to match the
// platform convention (see lib/os/host/entitlements.ts).
//
// Fail-closed: an unknown role resolves to the EMPTY permission set (least privilege).

export const ORG_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

// OWNER is DERIVED from Organization.ownerAccountId (the single source of ownership
// truth), never minted as a membership row — so ownership can't fork into two authorities
// (the org attribute vs. a membership role) once the PEP consumes this map. Only these
// roles are assignable to a membership via the service.
export const ASSIGNABLE_ORG_ROLES = ["ADMIN", "MEMBER"] as const;
export type AssignableOrgRole = (typeof ASSIGNABLE_ORG_ROLES)[number];

export const ORG_PERMISSIONS = [
  "org:view",
  "org:members:view",
  "org:members:manage",
  "org:roles:manage",
  "org:settings:manage",
  "org:delete",
] as const;
export type OrgPermission = (typeof ORG_PERMISSIONS)[number];

// OWNER ⊃ ADMIN ⊃ MEMBER. Only OWNER may change roles, edit settings, or delete the
// org; ADMIN may manage members but not roles/settings; MEMBER may only view.
const ROLE_PERMISSIONS: Record<OrgRole, readonly OrgPermission[]> = {
  OWNER: ["org:view", "org:members:view", "org:members:manage", "org:roles:manage", "org:settings:manage", "org:delete"],
  ADMIN: ["org:view", "org:members:view", "org:members:manage"],
  MEMBER: ["org:view"],
};

export function isOrgRole(role: string): role is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(role);
}

// The permission set for a role. Unknown role → empty set (fail-closed).
export function permissionsForRole(role: string): ReadonlySet<OrgPermission> {
  const perms = (ROLE_PERMISSIONS as Record<string, readonly OrgPermission[]>)[role];
  return new Set(perms ?? []);
}

export function roleHasPermission(role: string, permission: string): boolean {
  return permissionsForRole(role).has(permission as OrgPermission);
}

// Exported for the guard test.
export const _ROLE_PERMISSIONS = ROLE_PERMISSIONS;
