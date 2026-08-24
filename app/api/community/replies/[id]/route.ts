import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireCommunityAuthor,
  canAccessCommunity,
  COMMUNITY_UNAVAILABLE,
  deleteReplyAndAttachments,
} from "@/lib/community";
import { logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Delete a reply. An admin may remove any (including Kai's); a member may remove
// their own. Keeps the parent thread's replyCount in sync.
//
// RC1-S6a (D-8): THE AUTHOR CHECK COMES FIRST, BEFORE AVAILABILITY.
// Mirrors app/api/community/threads/[id]/route.ts exactly. Deleting a THREAD
// cascades its own replies, so it does not cover the case that matters most
// here: a reply the consumer left inside SOMEONE ELSE'S thread. Gating that on
// whether the network happens to be switched on is precisely what
// lib/community.ts forbids — "the feature is off" must never become "you cannot
// take your own words down". So this resolves the author with
// requireCommunityAuthor() (identity only, no availability check), proves
// ownership, and only THEN refuses — and only a non-author/non-admin.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const account = await requireCommunityAuthor();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reply = await prisma.communityReply.findUnique({ where: { id: params.id } });
  if (!reply) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = account.role === "ADMIN";
  const isOwn = !reply.isKai && reply.authorId === account.id;
  if (!isAdmin && !isOwn) {
    // Not your content. If the network is switched off there is nothing to say
    // about someone else's reply at all; if it is on, this is the ordinary
    // ownership refusal. Neither answer mentions membership or payment.
    return NextResponse.json(
      canAccessCommunity(account)
        ? { error: "You can only delete your own replies." }
        : { error: COMMUNITY_UNAVAILABLE, communityUnavailable: true },
      { status: 403 }
    );
  }

  await deleteReplyAndAttachments(reply.id, reply.threadId);
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
