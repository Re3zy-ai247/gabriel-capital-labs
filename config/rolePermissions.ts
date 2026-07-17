// CreditVector role→permission bundles — PRODUCT DATA (Platform Phase B, Sprint 3).
// Lives beside config/capabilityMatrix.ts on the product side of the ownership
// boundary and is INJECTED into the GIOS team mechanism (lib/os/platform/teams.ts).
// Composition rule (to be guard-pinned before team activation): an operator's
// EFFECTIVE permissions = tier grant ∩ role bundle — the role can only narrow
// what the plan already grants, never widen it past the PEP.
import type { Permission } from "@/lib/os/kernel";
import type { RolePermissionBundles } from "@/lib/os/platform/teams";

export const ROLE_PERMISSIONS: RolePermissionBundles = {
  owner: new Set<Permission>([
    "letters:generate", "obsolescence:check", "tradeline:read", "responses:analyze",
    "campaign:compose", "strategy:plan", "clients:manage", "community:read", "community:write",
    "team:manage", "team:invite", "clients:assign", "audit:read", "billing:manage",
  ]),
  operator: new Set<Permission>([
    "letters:generate", "obsolescence:check", "tradeline:read", "responses:analyze",
    "campaign:compose", "strategy:plan", "community:read", "community:write",
    // Operators act only on ASSIGNED clients — scope enforced by the future
    // client-ownership PDP, not by a broader permission.
    "clients:assigned:manage",
  ]),
};
