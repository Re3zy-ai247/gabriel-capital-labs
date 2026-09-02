import { createHash, timingSafeEqual } from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { isDemoIdentityBlocked } from "./demoIdentity";
import { clientIp, rateLimit } from "./rateLimit";

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

// ── SETUP_SECRET (M-4) ───────────────────────────────────────────────────────
// E-03 named `SETUP_SECRET` a god-key that was "unthrottled and non-timing-safe".
// The lane closed the query-string leak and hard-404'd bootstrap. The raw-DDL
// migration surface has since been removed; the remaining setup-secret callers
// still need a shared comparison that does not short-circuit on length or the
// first differing byte and does not permit unbounded online guessing.
//
// Remaining call sites come through here:
//   · throttled per source IP BEFORE any comparison, so the route stops being an
//     online oracle. Fails CLOSED — including when the limiter backend is down,
//     which is the correct posture for a credential check (contrast
//     app/api/billing/self-cancel, where denying strands a payer).
//   · compared in constant time over SHA-256 digests of both values, so the two
//     inputs are always the same length and the secret's LENGTH is not itself
//     leaked by a `timingSafeEqual` that throws on a mismatch.
//
// This is defence in depth, not the remedy. The remedy is deleting SETUP_SECRET
// from the production environment; /api/admin/diagnostics reports its presence.
const SETUP_SECRET_ATTEMPTS_PER_HOUR = 10;

export async function setupSecretAccepted(req: Request): Promise<boolean> {
  const setup = process.env.SETUP_SECRET;
  if (!setup) return false;
  const provided = req.headers.get("x-setup-secret");
  if (typeof provided !== "string" || provided.length === 0) return false;

  const throttle = await rateLimit(`setup-secret:${clientIp(req)}`, SETUP_SECRET_ATTEMPTS_PER_HOUR, 3600);
  if (!throttle.ok) return false;

  const presented = createHash("sha256").update(provided, "utf8").digest();
  const expected = createHash("sha256").update(setup, "utf8").digest();
  return timingSafeEqual(presented, expected);
}
