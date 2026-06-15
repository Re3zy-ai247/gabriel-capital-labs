import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";
import { IMPERSONATE_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST: begin impersonating (viewing the app as) the target user. Real-admin
// only; every start is audited. Sets a short-lived cookie that currentUser()
// honors. The admin's own identity/session is unchanged.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  if (params.id === admin.id) {
    return NextResponse.json({ error: "You can't impersonate yourself." }, { status: 400 });
  }
  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, name: true },
  });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "user.impersonate",
    summary: `Started impersonating ${target.email}`,
    targetType: "user",
    targetId: target.id,
  });

  const res = NextResponse.json({ ok: true, target: { id: target.id, email: target.email, name: target.name } });
  res.cookies.set(IMPERSONATE_COOKIE, target.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });
  return res;
}
