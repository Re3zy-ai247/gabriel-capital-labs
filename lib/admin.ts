import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { isDemoIdentityBlocked } from "./demoIdentity";

// True when the CURRENT session belongs to an enabled ADMIN. Privilege is
// resolved from the session's user id — NEVER from a caller-supplied email:
// users can change their own email (app/api/profile/route.ts), so an
// email-keyed lookup is a stale, user-mutable identifier to authorize on.
export async function isAdmin(): Promise<boolean> {
  return (await requireAdmin()) !== null;
}

// Returns the signed-in ADMIN's User row, or null if not signed in / not an
// admin / disabled. Resolves the REAL session identity (never an impersonated
// user), so it is the correct gate for every /api/admin/* route and for granting
// admin nav.
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "ADMIN") return null;
  // Recheck revocable identity state after resolving the JWT id. This blocks
  // both disabled admins and any historic canonical demo row that was promoted
  // before the bootstrap boundary was hardened.
  if (user.disabled) return null;
  if (isDemoIdentityBlocked(process.env.NODE_ENV, user.email)) return null;
  return user;
}

// Append a row to the admin audit log. Best-effort: a logging failure must never
// break the underlying admin action, so errors are swallowed (and surfaced in
// server logs). Pass the acting admin so we capture who did what.
export async function logAudit(params: {
  actor: { id: string; email: string };
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: params.action,
        summary: params.summary,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata as object | undefined,
      },
    });
  } catch (e) {
    console.error("audit log write failed", params.action, e);
  }
}
