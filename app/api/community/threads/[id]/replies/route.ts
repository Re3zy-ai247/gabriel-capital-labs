import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCommunityAccount, COMMUNITY_UNAVAILABLE, communityDisplayName, cleanText, LIMITS, screenCommunityText } from "@/lib/community";
import { filesFromForm, validateFiles, saveAttachments } from "@/lib/attachments";
import { enforceRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Post a human reply to a thread. Locked threads accept replies from admins only.
// Accepts multipart/form-data so a reply can carry image/PDF attachments.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: COMMUNITY_UNAVAILABLE, communityUnavailable: true }, { status: 403 });

  const { id } = await params;
  const thread = await prisma.communityThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (thread.locked && account.role !== "ADMIN") {
    return NextResponse.json({ error: "This discussion is locked." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const body = cleanText(form.get("body"), LIMITS.reply);
  const { ok: files, error: fileError } = await validateFiles(filesFromForm(form));
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
  // A reply needs either text or at least one attachment.
  if (body.length < 2 && files.length === 0) {
    return NextResponse.json({ error: "Write a reply or attach a file." }, { status: 400 });
  }

  // CROA screen BEFORE any write — same bar as thread creation. Fail-closed.
  const screened = screenCommunityText(body);
  if (!screened.ok) return NextResponse.json({ error: screened.error }, { status: 422 });

  // Write throttle: reply creation was previously unlimited.
  const limited = await enforceRateLimit(`community-reply:${account.id}`, 60, 3600);
  if (limited) return limited;

  const reply = await prisma.communityReply.create({
    data: { threadId: thread.id, authorId: account.id, authorName: communityDisplayName(account), body },
  });
  let attachments: Awaited<ReturnType<typeof saveAttachments>> = [];
  if (files.length) {
    try {
      attachments = await saveAttachments({ scope: "community_reply", refId: reply.id, uploaderId: account.id, files });
    } catch (e) {
      console.error("community attachment save failed", e);
    }
  }
  await prisma.communityThread.update({
    where: { id: thread.id },
    data: { replyCount: { increment: 1 }, lastActivityAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    reply: { id: reply.id, authorName: reply.authorName, body: reply.body, isKai: false, createdAt: reply.createdAt, canDelete: true, attachments },
  });
}
