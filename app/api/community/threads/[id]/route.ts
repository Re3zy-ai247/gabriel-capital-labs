import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireCommunityAccount,
  requireCommunityAuthor,
  canAccessCommunity,
  COMMUNITY_UNAVAILABLE,
  deleteThreadAndAttachments,
} from "@/lib/community";
import { requireAdmin, logAudit } from "@/lib/admin";
import { listAttachments } from "@/lib/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Full thread + replies, plus what the viewer is allowed to do.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: COMMUNITY_UNAVAILABLE, communityUnavailable: true }, { status: 403 });

  const { id } = await params;
  const thread = await prisma.communityThread.findUnique({
    where: { id },
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
        // Members can report others' replies (and Kai's); admins moderate directly.
        canReport: !isAdmin && (r.isKai || r.authorId !== account.id),
        attachments: replyAttachments[r.id] || [],
      })),
    },
    viewer: { isAdmin, isAuthor, canModerate: isAdmin || isAuthor, canPin: isAdmin, canReportThread: !isAdmin && !isAuthor },
  });
}

// Moderation: pin/lock are ADMIN-only.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const data: { pinned?: boolean; locked?: boolean } = {};
  if (typeof raw.pinned === "boolean") data.pinned = raw.pinned;
  if (typeof raw.locked === "boolean") data.locked = raw.locked;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { id } = await params;
  const thread = await prisma.communityThread.update({ where: { id }, data });
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
//
// RC1-S6a (D-8): THE AUTHOR CHECK COMES FIRST, BEFORE AVAILABILITY.
// Withdrawing your own words is data control, not a feature. Gating it on
// whether the network happens to be switched on would strand a member's post
// where they can neither see it nor take it down, so this route resolves the
// author with requireCommunityAuthor() (identity only, no availability check),
// proves ownership, and only THEN refuses — and only a non-author/non-admin.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireCommunityAuthor();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const thread = await prisma.communityThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = account.role === "ADMIN";
  const isAuthor = thread.authorId === account.id;
  if (!isAdmin && !isAuthor) {
    // Not your content. If the network is switched off there is nothing to say
    // about someone else's post at all; if it is on, this is the ordinary
    // ownership refusal. Neither answer mentions membership or payment.
    return NextResponse.json(
      canAccessCommunity(account)
        ? { error: "You can only delete your own discussions." }
        : { error: COMMUNITY_UNAVAILABLE, communityUnavailable: true },
      { status: 403 }
    );
  }

  await deleteThreadAndAttachments(thread.id);
  if (isAdmin && !isAuthor) {
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
