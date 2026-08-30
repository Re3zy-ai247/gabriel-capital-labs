import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { ensureBriefTables } from "@/lib/brief";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Delete a comment. Allowed for the comment's author (remove your own) or an admin.
// Admins normally moderate via /admin/brief/comments (soft remove, reversible), but
// a hard delete here is fine for an author tidying up their own post.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  await ensureBriefTables();

  const { id } = await params;
  const comment = await prisma.briefComment.findUnique({ where: { id }, select: { userId: true } });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = account.role === "ADMIN";
  if (!isAdmin && comment.userId !== account.id) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  await prisma.briefComment.delete({ where: { id } });
  await prisma.briefCommentReport.deleteMany({ where: { commentId: id } });
  return NextResponse.json({ ok: true });
}
