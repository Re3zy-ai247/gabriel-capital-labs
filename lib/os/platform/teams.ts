// GIOS platform — Team & Workspace MECHANISM (Platform Phase B, Sprint 3).
// ─────────────────────────────────────────────────────────────────────────────
// STATUS: DORMANT behind TEAM_FOUNDATION (default OFF). PURE mechanism only —
// no I/O, no product vocabulary, no prisma. The ownership boundary (tierResolver
// law: GIOS never imports product data) is honored by INJECTION: the role→
// permission bundles are product data (config/rolePermissions.ts) passed in by
// the caller; persistence lives product-side in lib/platform/teamStore.ts.
// Deterministic: the invitation state machine takes `now` as an argument.
import type { Permission } from "@/lib/os/kernel";

export function teamFoundationEnabled(): boolean {
  return process.env.TEAM_FOUNDATION === "true";
}

// ── Roles (mechanism: two-role model; bundles are injected product data) ─────
export type TeamRole = "owner" | "operator";

export type RolePermissionBundles = Readonly<Record<TeamRole, ReadonlySet<Permission>>>;

const EMPTY_PERMISSIONS: ReadonlySet<Permission> = new Set();

/** Fail-closed: an unknown role gets NO permissions (never a default bundle). */
export function permissionsForRole(role: TeamRole, bundles: RolePermissionBundles): ReadonlySet<Permission> {
  return bundles[role] ?? EMPTY_PERMISSIONS;
}

// ── Invitation state machine (pure, deterministic, clock injected) ───────────
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type InvitationAction = "accept" | "revoke" | "expire";

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: TeamRole;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
}

/** Legal transitions only; terminal states never move; expiry wins (fail-closed). */
export function nextInvitationState(inv: Invitation, action: InvitationAction, now: Date): Invitation {
  if (inv.status !== "pending") return inv;
  if (now.getTime() > inv.expiresAt.getTime()) return { ...inv, status: "expired" };
  if (action === "accept") return { ...inv, status: "accepted" };
  if (action === "revoke") return { ...inv, status: "revoked" };
  if (action === "expire") return { ...inv, status: "expired" };
  return inv;
}
