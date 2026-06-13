import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PATCH: toggle whether this document is referenced/attached in letter packets.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const includeInLetters = Boolean(body.includeInLetters);

  const existing = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const document = await prisma.document.update({
    where: { id: params.id },
    data: { includeInLetters },
    select: { id: true, type: true, includeInLetters: true },
  });
  return NextResponse.json({ document });
}

// DELETE: permanently remove a document (and its encrypted bytes).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.document.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
