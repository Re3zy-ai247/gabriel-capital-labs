import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCommunityAccount } from "@/lib/community";
import { logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Delete a reply. An admin may remove any (including Kai's); a member may remove
// their own. Keeps the parent thread's replyCount in sync.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const reply = await prisma.communityReply.findUnique({ where: { id: params.id } });
  if (!reply) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = account.role === "ADMIN";
  const isOwn = !reply.isKai && reply.authorId === account.id;
  if (!isAdmin && !isOwn) {
    return NextResponse.json({ error: "You can only delete your own replies." }, { status: 403 });
  }

  await prisma.communityReply.delete({ where: { id: params.id } });
  await prisma.communityThread.update({
    where: { id: reply.threadId },
    data: { replyCount: { decrement: 1 } },
  });
  if (isAdmin && !isOwn) {
    await logAudit({
      actor: { id: account.id, email: account.email },
      action: "community.delete_reply",
      summary: `Deleted a ${reply.isKai ? "Kai " : ""}reply by ${reply.authorName}`,
      targetType: "community_reply",
      targetId: reply.id,
    });
  }
  return NextResponse.json({ ok: true });
}
