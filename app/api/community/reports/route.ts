import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCommunityAccount, communityDisplayName, cleanText, LIMITS } from "@/lib/community";
import { enforceRateLimit } from "@/lib/rateLimit";
import { sendAdminEmail } from "@/lib/email";
import { sendPushToAdmins } from "@/lib/push";

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

  // Alert the admin when the queue transitions from empty -> non-empty (the "first
  // open report"). Subsequent reports while the queue is non-empty don't re-email,
  // so the admin gets one nudge per needs-attention cycle, not one per report.
  // Fire-safe: any failure here (or a missing RESEND_API_KEY) never breaks the
  // member's report. The email intentionally omits the reported content (no PII) —
  // it just points the admin at the queue.
  try {
    const openCount = await prisma.communityReport.count({ where: { status: "open" } });
    if (openCount === 1) {
      const what = targetType === "thread" ? "a discussion" : "a reply";
      const base = process.env.NEXTAUTH_URL || "https://www.creditvector.app";
      await sendAdminEmail({
        subject: "New community report awaiting review",
        text:
          `A member flagged ${what} in the CreditVector Community Hub for moderation review.\n\n` +
          `Review and action it here: ${base}/admin/reports\n\n` +
          `(You're getting this because a report opened while the queue was empty. ` +
          `You won't get another until the queue is cleared.)`,
      });
      await sendPushToAdmins({ title: "New community report", body: "A member flagged content for review.", url: "/admin/reports" });
    }
  } catch (e) {
    console.error("report alert failed (non-fatal)", e);
  }

  return NextResponse.json({ ok: true });
}
