import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCommunityAccount, communityDisplayName, cleanText, LIMITS } from "@/lib/community";
import { enforceRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A member flags a thread or reply for admin moderation review. Creates an OPEN
// CommunityReport row; admins triage it from /admin/reports. Idempotent per
// (reporter, target): re-reporting while one is still open is a no-op, so a member
// can't spam the queue. Members can't list or read reports — this POST is the only
// member-facing surface.
export async function POST(req: Request) {
  const account = await requireCommunityAccount();
  if (!account) return NextResponse.json({ error: "Members only" }, { status: 403 });

  // Cap report volume per member before any DB work.
  const limited = await enforceRateLimit(`community-report:${account.id}`, 10, 3600);
  if (limited) return limited;

  const raw = await req.json().catch(() => ({}));
  const targetType = raw.targetType === "reply" ? "reply" : raw.targetType === "thread" ? "thread" : null;
  const targetId = typeof raw.targetId === "string" ? raw.targetId : "";
  if (!targetType || !targetId) {
    return NextResponse.json({ error: "Nothing to report." }, { status: 400 });
  }

  // Resolve the owning thread + confirm the target exists.
  let threadId: string;
  if (targetType === "thread") {
    const thread = await prisma.communityThread.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
    threadId = thread.id;
  } else {
    const reply = await prisma.communityReply.findUnique({ where: { id: targetId }, select: { threadId: true } });
    if (!reply) return NextResponse.json({ error: "Not found" }, { status: 404 });
    threadId = reply.threadId;
  }

  // Idempotent: don't stack duplicate open reports from the same member.
  const existing = await prisma.communityReport.findFirst({
    where: { targetType, targetId, reporterId: account.id, status: "open" },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true, alreadyReported: true });

  const reason = cleanText(raw.reason, LIMITS.reportReason);
  await prisma.communityReport.create({
    data: {
      targetType,
      targetId,
      threadId,
      reporterId: account.id,
      reporterName: communityDisplayName(account),
      reason: reason || null,
    },
  });
  return NextResponse.json({ ok: true });
}
