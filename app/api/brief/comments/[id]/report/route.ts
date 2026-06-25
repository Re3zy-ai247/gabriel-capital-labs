import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import { ensureBriefTables } from "@/lib/brief";
import { sendAdminEmail } from "@/lib/email";
import { sendPushToAdmins } from "@/lib/push";
import { BRIEF_COMMENT_LIMITS } from "@/lib/briefShared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A reader flags a comment for admin review. Idempotent per (comment, reporter)
// via the unique index, so re-reporting is a harmless no-op. The first report
// marks the comment flagged; the admin triages it at /admin/brief/comments.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Sign in to report." }, { status: 401 });

  const limited = await enforceRateLimit(`brief-comment-report:${account.id}`, 20, 3600);
  if (limited) return limited;

  await ensureBriefTables();
  const comment = await prisma.briefComment.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!comment || comment.status !== "visible") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await req.json().catch(() => ({}));
  const reason = typeof raw.reason === "string" ? raw.reason.trim().slice(0, BRIEF_COMMENT_LIMITS.reportReason) : "";

  const created = await prisma.briefCommentReport.createMany({
    data: [{ commentId: comment.id, userId: account.id, reason: reason || null }],
    skipDuplicates: true,
  });
  if (created.count === 0) return NextResponse.json({ ok: true, alreadyReported: true });

  await prisma.briefComment.update({ where: { id: comment.id }, data: { flagged: true } });

  // Alert when the queue goes empty -> non-empty: one nudge per needs-attention
  // cycle, not one per report. Fire-safe — never blocks the reader's report.
  try {
    const flaggedCount = await prisma.briefComment.count({ where: { flagged: true, status: "visible" } });
    if (flaggedCount === 1) {
      const base = process.env.NEXTAUTH_URL || "https://www.creditvector.app";
      await sendAdminEmail({
        subject: "A Brief comment was reported",
        text:
          `A reader flagged a comment on CreditVector Brief for moderation review.\n\n` +
          `Review and action it here: ${base}/admin/brief/comments\n\n` +
          `(You're getting this because a report opened while the comment queue was empty. ` +
          `You won't get another until the queue is cleared.)`,
      });
      await sendPushToAdmins({ title: "Brief comment reported", body: "A reader flagged a comment for review.", url: "/admin/brief/comments" });
    }
  } catch (e) {
    console.error("brief comment report alert failed (non-fatal)", e);
  }

  return NextResponse.json({ ok: true });
}
