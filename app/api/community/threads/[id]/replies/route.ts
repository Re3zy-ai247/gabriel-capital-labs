import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCommunityAccount, communityDisplayName, cleanText, LIMITS } from "@/lib/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Post a human reply to a thread. Locked threads accept replies from admins only.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const thread = await prisma.communityThread.findUnique({ where: { id: params.id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (thread.locked && account.role !== "ADMIN") {
    return NextResponse.json({ error: "This discussion is locked." }, { status: 403 });
  }

  const body = cleanText((await req.json().catch(() => ({}))).body, LIMITS.reply);
  if (body.length < 2) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });

  const reply = await prisma.communityReply.create({
    data: { threadId: thread.id, authorId: account.id, authorName: communityDisplayName(account), body },
  });
  await prisma.communityThread.update({
    where: { id: thread.id },
    data: { replyCount: { increment: 1 }, lastActivityAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    reply: { id: reply.id, authorName: reply.authorName, body: reply.body, isKai: false, createdAt: reply.createdAt, canDelete: true },
  });
}
