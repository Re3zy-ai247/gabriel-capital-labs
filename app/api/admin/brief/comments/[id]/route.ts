import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";
import { ensureBriefTables } from "@/lib/brief";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Moderate a comment: remove (status 'removed', reversible) / restore ('visible'),
// or just dismiss the flag (keep it visible). Any resolving action clears the flag
// and the report ledger, so a fresh report can re-open it later.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  await ensureBriefTables();

  const existing = await prisma.briefComment.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await req.json().catch(() => ({}));
  const data: Prisma.BriefCommentUpdateInput = {};
  if (raw.status === "visible" || raw.status === "removed") data.status = raw.status;
  if (typeof raw.flagged === "boolean") data.flagged = raw.flagged;
  // Any explicit moderation decision resolves the flag.
  if (data.status !== undefined || data.flagged === false) data.flagged = false;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const comment = await prisma.briefComment.update({ where: { id: params.id }, data });
  await prisma.briefCommentReport.deleteMany({ where: { commentId: params.id } });

  const action = data.status === "removed" ? "brief.comment.remove" : data.status === "visible" ? "brief.comment.restore" : "brief.comment.dismiss";
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action,
    summary: `${action.split(".").slice(1).join(" ")} Brief comment by ${existing.authorName}`,
    targetType: "brief_comment",
    targetId: comment.id,
  });

  return NextResponse.json({ ok: true, comment });
}
