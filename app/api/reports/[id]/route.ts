import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";

export const dynamic = "force-dynamic";

// Deletes one of the user's uploaded reports. Tradelines belonging to the report
// cascade-delete (schema onDelete: Cascade); letters reference tradelines with
// onDelete: SetNull, so any letters already generated are preserved.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.report.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.report.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
