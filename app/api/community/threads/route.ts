import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireCommunityAccount,
  communityDisplayName,
  normalizeCategory,
  cleanText,
  CATEGORY_KEYS,
  LIMITS,
} from "@/lib/community";
import { askKai } from "@/lib/kai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // a thread can ask Kai on creation (Opus call)

// List threads (pinned first, then most recent activity), optionally filtered by
// category. Annotates each with whether Kai has answered, for the UI badge.
export async function GET(req: Request) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const url = new URL(req.url);
  const cat = url.searchParams.get("category");
  const where = cat && CATEGORY_KEYS.includes(cat) ? { category: cat } : {};

  const threads = await prisma.communityThread.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { lastActivityAt: "desc" }],
    take: 200,
  });

  const ids = threads.map((t) => t.id);
  const kaiThreads = ids.length
    ? await prisma.communityReply.findMany({
        where: { threadId: { in: ids }, isKai: true },
        distinct: ["threadId"],
        select: { threadId: true },
      })
    : [];
  const kaiSet = new Set(kaiThreads.map((r) => r.threadId));

  return NextResponse.json({
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      authorName: t.authorName,
      pinned: t.pinned,
      locked: t.locked,
      replyCount: t.replyCount,
      kaiAnswered: kaiSet.has(t.id),
      lastActivityAt: t.lastActivityAt,
      createdAt: t.createdAt,
      excerpt: t.body.slice(0, 200),
    })),
  });
}

// Create a thread. When askKai is true, Kai posts an expert reply immediately.
export async function POST(req: Request) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const title = cleanText(raw.title, LIMITS.title);
  const body = cleanText(raw.body, LIMITS.body);
  const category = normalizeCategory(raw.category);
  const wantKai = Boolean(raw.askKai);

  if (title.length < 3) return NextResponse.json({ error: "Give your discussion a title." }, { status: 400 });
  if (body.length < 3) return NextResponse.json({ error: "Add some detail to your post." }, { status: 400 });

  const thread = await prisma.communityThread.create({
    data: {
      authorId: account.id,
      authorName: communityDisplayName(account),
      category,
      title,
      body,
    },
  });

  let kaiReplied = false;
  if (wantKai) {
    try {
      const answer = await askKai({ title, body });
      await prisma.communityReply.create({
        data: { threadId: thread.id, authorId: null, authorName: "Kai", body: answer.text, isKai: true },
      });
      await prisma.communityThread.update({
        where: { id: thread.id },
        data: { replyCount: { increment: 1 }, lastActivityAt: new Date() },
      });
      kaiReplied = true;
    } catch (e) {
      console.error("Kai-on-create failed", e);
    }
  }

  return NextResponse.json({ ok: true, id: thread.id, kaiReplied });
}
