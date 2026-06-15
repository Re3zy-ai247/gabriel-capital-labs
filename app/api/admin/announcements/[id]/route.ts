import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const a = await prisma.announcement.update({ where: { id: params.id }, data: { active: body.active } });
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: body.active ? "announcement.activate" : "announcement.deactivate",
    summary: `${body.active ? "Activated" : "Deactivated"} announcement: ${a.title}`,
    targetType: "announcement",
    targetId: a.id,
  });
  return NextResponse.json({ announcement: a });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const a = await prisma.announcement.delete({ where: { id: params.id } });
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "announcement.delete",
    summary: `Deleted announcement: ${a.title}`,
    targetType: "announcement",
    targetId: a.id,
  });
  return NextResponse.json({ ok: true });
}
