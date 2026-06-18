import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCommunityAccount } from "@/lib/community";
import { requireAdmin, logAudit } from "@/lib/admin";
import { listAttachments, deleteAttachmentsFor } from "@/lib/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Full thread + replies, plus what the viewer is allowed to do.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const thread = await prisma.communityThread.findUnique({
    where: { id: params.id },
    include: { replies: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = account.role === "ADMIN";
  const isAuthor = thread.authorId === account.id;

  const threadAttachments = await listAttachments("community_thread", [thread.id]);
  const replyAttachments = await listAttachments("community_reply", thread.replies.map((r) => r.id));

  return NextResponse.json({
    thread: {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      category: thread.category,
      authorName: thread.authorName,
      pinned: thread.pinned,
      locked: thread.locked,
      replyCount: thread.replyCount,
      createdAt: thread.createdAt,
      attachments: threadAttachments[thread.id] || [],
      replies: thread.replies.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        body: r.body,
        isKai: r.isKai,
        createdAt: r.createdAt,
        canDelete: isAdmin || (!r.isKai && r.authorId === account.id),
        attachments: replyAttachments[r.id] || [],
      })),
    },
    viewer: { isAdmin, isAuthor, canModerate: isAdmin || isAuthor, canPin: isAdmin },
  });
}

// Moderation: pin/lock are ADMIN-only.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const data: { pinned?: boolean; locked?: boolean } = {};
  if (typeof raw.pinned === "boolean") data.pinned = raw.pinned;
  if (typeof raw.locked === "boolean") data.locked = raw.locked;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const thread = await prisma.communityThread.update({ where: { id: params.id }, data });
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "community.moderate",
    summary: `Updated thread "${thread.title}" (${JSON.stringify(data)})`,
    targetType: "community_thread",
    targetId: thread.id,
  });
  return NextResponse.json({ ok: true, pinned: thread.pinned, locked: thread.locked });
}

// Delete a thread — the author may remove their own; an admin may remove any.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const thread = await prisma.communityThread.findUnique({ where: { id: params.id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = account.role === "ADMIN";
  if (!isAdmin && thread.authorId !== account.id) {
    return NextResponse.json({ error: "You can only delete your own discussions." }, { status: 403 });
  }

  // Collect the reply ids before the delete cascades them away, so their encrypted
  // attachments can be swept too (the Attachment table has no FK to the parent).
  const replyIds = (
    await prisma.communityReply.findMany({ where: { threadId: thread.id }, select: { id: true } })
  ).map((r) => r.id);

  await prisma.communityThread.delete({ where: { id: params.id } });
  await deleteAttachmentsFor("community_thread", [thread.id]);
  await deleteAttachmentsFor("community_reply", replyIds);
  if (isAdmin && thread.authorId !== account.id) {
    await logAudit({
      actor: { id: account.id, email: account.email },
      action: "community.delete_thread",
      summary: `Deleted thread "${thread.title}"`,
      targetType: "community_thread",
      targetId: thread.id,
    });
  }
  return NextResponse.json({ ok: true });
}
