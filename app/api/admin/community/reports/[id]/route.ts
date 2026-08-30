import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";
import { ensureCommunityTables, deleteThreadAndAttachments, deleteReplyAndAttachments } from "@/lib/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Resolve a report from the moderation queue. ADMIN-only; audit-logged.
//   { action: "dismiss" } — reviewed, no action (content stays).
//   { action: "remove" }  — delete the reported thread/reply (sweeps attachments
//                           and auto-closes sibling open reports via the shared
//                           helpers), then mark this report actioned.
// Either way the report leaves the open queue.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  await ensureCommunityTables();

  const raw = await req.json().catch(() => ({}));
  const action = raw.action === "remove" ? "remove" : raw.action === "dismiss" ? "dismiss" : null;
  if (!action) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const { id } = await params;
  const report = await prisma.communityReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "remove") {
    // Delete the offending content if it still exists. The helpers sweep encrypted
    // attachments and close open reports against the target (including this one).
    if (report.targetType === "thread") {
      const exists = await prisma.communityThread.findUnique({ where: { id: report.targetId }, select: { id: true } });
      if (exists) await deleteThreadAndAttachments(report.targetId);
    } else {
      const reply = await prisma.communityReply.findUnique({
        where: { id: report.targetId },
        select: { id: true, threadId: true },
      });
      if (reply) await deleteReplyAndAttachments(reply.id, reply.threadId);
    }
  }

  // Stamp the resolver/status explicitly (also covers the dismiss path and sets
  // resolvedById, which the helper's bulk-close does not).
  await prisma.communityReport.update({
    where: { id: report.id },
    data: {
      status: action === "remove" ? "actioned" : "dismissed",
      resolvedById: admin.id,
      resolvedAt: new Date(),
    },
  });

  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: action === "remove" ? "community.report_remove" : "community.report_dismiss",
    summary:
      action === "remove"
        ? `Removed reported ${report.targetType} (report ${report.id})`
        : `Dismissed report on ${report.targetType} (report ${report.id})`,
    targetType: `community_${report.targetType}`,
    targetId: report.targetId,
  });

  return NextResponse.json({ ok: true });
}
