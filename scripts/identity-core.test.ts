// Run: npx tsx scripts/identity-core.test.ts
//
// The PURE Operator Identity core (Sprint 9): lifecycle state machines, org RBAC map,
// and input validation. No I/O, no DB. Proves fail-closed behavior, no resurrection
// from terminal states, RBAC least-privilege, and that the string unions match the
// Prisma enums exactly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canTransitionOperator, canTransitionOrganization, canTransitionMembership,
  isTerminalOperatorState, OPERATOR_STATES, ORGANIZATION_STATES, MEMBERSHIP_STATES, _TRANSITION_MAPS,
} from "../lib/identity/state";
import { permissionsForRole, roleHasPermission, ORG_ROLES, _ROLE_PERMISSIONS } from "../lib/identity/rbac";
import {
  slugSchema, handleSchema, slugify, createOrganizationInput, addMembershipInput, changeRoleInput, RESERVED_IDENTIFIERS, ORGANIZATION_KINDS,
} from "../lib/identity/validation";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${label}`); }
}
const schema = readFileSync(join(__dirname, "..", "prisma/schema.prisma"), "utf8");

// ── Operator lifecycle: legal edges, terminal = no resurrection ──────────────
check("PENDING -> ACTIVE", canTransitionOperator("PENDING", "ACTIVE"));
check("ACTIVE -> SUSPENDED", canTransitionOperator("ACTIVE", "SUSPENDED"));
check("SUSPENDED -> ACTIVE (reinstate)", canTransitionOperator("SUSPENDED", "ACTIVE"));
check("ACTIVE -> DEACTIVATED", canTransitionOperator("ACTIVE", "DEACTIVATED"));
check("PENDING -> DEACTIVATED", canTransitionOperator("PENDING", "DEACTIVATED"));
check("NO PENDING -> SUSPENDED (undeclared edge)", !canTransitionOperator("PENDING", "SUSPENDED"));
check("NO self-transition ACTIVE -> ACTIVE", !canTransitionOperator("ACTIVE", "ACTIVE"));
check("RESURRECTION BLOCKED: DEACTIVATED -> ACTIVE", !canTransitionOperator("DEACTIVATED", "ACTIVE"));
check("RESURRECTION BLOCKED: DEACTIVATED -> PENDING", !canTransitionOperator("DEACTIVATED", "PENDING"));
check("unknown source state denied", !canTransitionOperator("GHOST", "ACTIVE"));
check("unknown target state denied", !canTransitionOperator("ACTIVE", "ZOMBIE"));
check("DEACTIVATED is terminal", isTerminalOperatorState("DEACTIVATED"));
check("ACTIVE is not terminal", !isTerminalOperatorState("ACTIVE"));

// ── Organization + membership terminals ──────────────────────────────────────
check("org ACTIVE -> ARCHIVED", canTransitionOrganization("ACTIVE", "ARCHIVED"));
check("org ARCHIVED terminal", !canTransitionOrganization("ARCHIVED", "ACTIVE"));
check("membership ACTIVE -> REMOVED", canTransitionMembership("ACTIVE", "REMOVED"));
check("membership REMOVED terminal (no re-add via transition)", !canTransitionMembership("REMOVED", "ACTIVE"));
check("membership SUSPENDED -> ACTIVE (reinstate)", canTransitionMembership("SUSPENDED", "ACTIVE"));

// ── State unions match the Prisma enums exactly ──────────────────────────────
function enumValues(name: string): string[] {
  const m = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`));
  return m ? m[1].trim().split(/\s+/).filter(Boolean) : [];
}
check("OperatorState union === enum", JSON.stringify([...OPERATOR_STATES].sort()) === JSON.stringify(enumValues("OperatorState").sort()));
check("OrganizationState union === enum", JSON.stringify([...ORGANIZATION_STATES].sort()) === JSON.stringify(enumValues("OrganizationState").sort()));
check("MembershipState union === enum", JSON.stringify([...MEMBERSHIP_STATES].sort()) === JSON.stringify(enumValues("MembershipState").sort()));
check("OrgRole union === enum", JSON.stringify([...ORG_ROLES].sort()) === JSON.stringify(enumValues("OrgRole").sort()));
// Every transition endpoint is a declared enum value (no typos).
const opStates = new Set(OPERATOR_STATES as readonly string[]);
check("all operator transition endpoints are valid states",
  Object.entries(_TRANSITION_MAPS.operator).every(([from, tos]) => opStates.has(from) && tos.every((t) => opStates.has(t))));

// ── RBAC: hierarchy + least-privilege fail-closed ────────────────────────────
check("OWNER can delete the org", roleHasPermission("OWNER", "org:delete"));
check("ADMIN can manage members", roleHasPermission("ADMIN", "org:members:manage"));
check("ADMIN CANNOT delete the org", !roleHasPermission("ADMIN", "org:delete"));
check("ADMIN CANNOT change roles", !roleHasPermission("ADMIN", "org:roles:manage"));
check("MEMBER can only view", roleHasPermission("MEMBER", "org:view") && !roleHasPermission("MEMBER", "org:members:manage"));
check("unknown role -> EMPTY permission set (fail-closed)", permissionsForRole("SUPERADMIN").size === 0);
check("unknown permission string denied", !roleHasPermission("OWNER", "org:nuke"));
// Hierarchy: OWNER ⊇ ADMIN ⊇ MEMBER.
const owner = permissionsForRole("OWNER"), adminP = permissionsForRole("ADMIN"), member = permissionsForRole("MEMBER");
check("OWNER ⊇ ADMIN", [..._ROLE_PERMISSIONS.ADMIN].every((p) => owner.has(p)));
check("ADMIN ⊇ MEMBER", [..._ROLE_PERMISSIONS.MEMBER].every((p) => adminP.has(p)));
check("MEMBER ⊂ ADMIN (strictly fewer)", member.size < adminP.size && adminP.size < owner.size);

// ── Validation: slugs / handles / reserved / inputs ──────────────────────────
check("valid slug accepted", slugSchema.safeParse("acme-credit-co").success);
check("slug too short rejected", !slugSchema.safeParse("ab").success);
check("uppercase slug rejected", !slugSchema.safeParse("AcmeCo").success);
check("double-hyphen slug rejected", !slugSchema.safeParse("acme--co").success);
check("leading-hyphen slug rejected", !slugSchema.safeParse("-acme").success);
check("trailing-hyphen slug rejected", !slugSchema.safeParse("acme-").success);
check("reserved slug 'admin' rejected", !slugSchema.safeParse("admin").success);
check("reserved slug 'creditvector' rejected", !slugSchema.safeParse("creditvector").success);
check("valid handle accepted", handleSchema.safeParse("jane_doe").success);
check("handle with space rejected", !handleSchema.safeParse("jane doe").success);
check("slugify normalizes free text", slugify("  Acme Credit Co!! ") === "acme-credit-co");
check("slugify strips to bounded", slugify("!!!").length === 0);
check("RESERVED set is non-trivial", RESERVED_IDENTIFIERS.size >= 20 && RESERVED_IDENTIFIERS.has("admin"));

check("createOrganizationInput valid", createOrganizationInput.safeParse({ name: "Acme Credit" }).success);
check("createOrganizationInput rejects empty name", !createOrganizationInput.safeParse({ name: "" }).success);
check("createOrganizationInput rejects extra keys (strict)", !createOrganizationInput.safeParse({ name: "Acme", role: "OWNER" }).success);
check("addMembershipInput defaults role=MEMBER", (() => { const r = addMembershipInput.safeParse({ organizationId: "o1", operatorId: "op1" }); return r.success && r.data.role === "MEMBER"; })());
check("addMembershipInput rejects unknown role", !addMembershipInput.safeParse({ organizationId: "o1", operatorId: "op1", role: "GOD" }).success);
check("changeRoleInput requires a role", !changeRoleInput.safeParse({ organizationId: "o1", operatorId: "op1" }).success);

// ── Organization is GENERIC (not agency-locked); ownership is single-source ──
check("OrganizationKind union === schema enum", JSON.stringify([...ORGANIZATION_KINDS].sort()) === JSON.stringify(enumValues("OrganizationKind").sort()));
check("Organization is generic: >1 kind incl. ENTERPRISE (not agency-locked)", ORGANIZATION_KINDS.length >= 5 && (ORGANIZATION_KINDS as readonly string[]).includes("ENTERPRISE"));
check("createOrganizationInput accepts a non-AGENCY kind", createOrganizationInput.safeParse({ name: "Acme University", kind: "EDUCATOR" }).success);
check("createOrganizationInput rejects an unknown kind", !createOrganizationInput.safeParse({ name: "Acme", kind: "CULT" }).success);
check("addMembershipInput REJECTS OWNER (derived from ownerAccountId, not assignable)", !addMembershipInput.safeParse({ organizationId: "o1", operatorId: "op1", role: "OWNER" }).success);
check("changeRoleInput REJECTS OWNER (ownership transfer is not a role change)", !changeRoleInput.safeParse({ organizationId: "o1", operatorId: "op1", role: "OWNER" }).success);

console.log(`\nidentity-core.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
