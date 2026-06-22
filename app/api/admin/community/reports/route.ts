import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ensureCommunityTables } from "@/lib/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Admin moderation queue: member-submitted reports, newest first. Each row is
// enriched with a preview of the reported content (or a "removed" flag) and the
// owning thread title for a deep-link. Open reports by default; ?status=all for history.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  await ensureCommunityTables();

  const status = new URL(req.url).searchParams.get("status") || "open";
  const where = status === "all" ? {} : { status };

  const reports = await prisma.communityReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Batch-resolve target content + owning thread titles.
  const threadIds = Array.from(new Set(reports.map((r) => r.threadId)));
  const replyTargetIds = reports.filter((r) => r.targetType === "reply").map((r) => r.targetId);
  const [threads, replies] = await Promise.all([
    prisma.communityThread.findMany({ where: { id: { in: threadIds } }, select: { id: true, title: true, body: true } }),
    prisma.communityReply.findMany({ where: { id: { in: replyTargetIds } }, select: { id: true, body: true, authorName: true, isKai: true } }),
  ]);
  const threadById = new Map(threads.map((t) => [t.id, t]));
  const replyById = new Map(replies.map((r) => [r.id, r]));

  const preview = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 240);

  const enriched = reports.map((r) => {
    const thread = threadById.get(r.threadId);
    let targetExists = false;
    let targetPreview = "";
    let targetAuthor = "";
    if (r.targetType === "thread") {
      targetExists = !!thread;
      targetPreview = thread ? preview(`${thread.title} — ${thread.body}`) : "";
    } else {
      const reply = replyById.get(r.targetId);
      targetExists = !!reply;
      targetPreview = reply ? preview(reply.body) : "";
      targetAuthor = reply ? (reply.isKai ? "Kai" : reply.authorName) : "";
    }
    return {
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      threadId: r.threadId,
      threadTitle: thread?.title ?? "(thread removed)",
      reporterName: r.reporterName,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      targetExists,
      targetPreview,
      targetAuthor,
    };
  });

  const openCount =
    status === "open" ? enriched.length : await prisma.communityReport.count({ where: { status: "open" } });

  return NextResponse.json({ reports: enriched, openCount });
}
