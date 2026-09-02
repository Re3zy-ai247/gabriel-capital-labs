import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCommunityAccount, COMMUNITY_UNAVAILABLE } from "@/lib/community";
import { enforceRateLimit } from "@/lib/rateLimit";
import { askKai } from "@/lib/kai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // Opus call

// Summon Kai into a thread: he reads the original post + recent replies and posts
// an expert, compliance-scrubbed answer as a reply (isKai = true).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: COMMUNITY_UNAVAILABLE, communityUnavailable: true }, { status: 403 });

  // Per-account cap before the (expensive) Opus call.
  const limited = await enforceRateLimit(`kai:${account.id}`, 20, 3600);
  if (limited) return limited;

  const { id } = await params;
  const thread = await prisma.communityThread.findUnique({
    where: { id },
    include: { replies: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const answer = await askKai({
    title: thread.title,
    body: thread.body,
    priorReplies: thread.replies.map((r) => ({ author: r.authorName, body: r.body, isKai: r.isKai })),
  });

  const reply = await prisma.communityReply.create({
    data: { threadId: thread.id, authorId: null, authorName: "Kai", body: answer.text, isKai: true },
  });
  await prisma.communityThread.update({
    where: { id: thread.id },
    data: { replyCount: { increment: 1 }, lastActivityAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    usedAI: answer.usedAI,
    reply: { id: reply.id, authorName: "Kai", body: reply.body, isKai: true, createdAt: reply.createdAt, canDelete: account.role === "ADMIN" },
  });
}
