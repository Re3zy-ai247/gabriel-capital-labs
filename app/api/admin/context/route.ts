import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ensureCommunityTables } from "@/lib/community";
import { ensureBriefTables } from "@/lib/brief";
import { impersonationContext } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lightweight probe for the app shell: is the real signed-in user an admin, are
// they currently impersonating someone, how many community reports are open, and
// how many Brief drafts await approval (these drive the nav badges). The counts run
// only for admins and each fails safe to 0, so the shell probe can never break.
export async function GET() {
  const admin = await requireAdmin();
  const imp = await impersonationContext();

  let openReports = 0;
  let pendingBrief = 0;
  let flaggedComments = 0;
  if (admin) {
    try {
      await ensureCommunityTables();
      openReports = await prisma.communityReport.count({ where: { status: "open" } });
    } catch {
      openReports = 0;
    }
    try {
      await ensureBriefTables();
      pendingBrief = await prisma.briefArticle.count({ where: { status: "draft" } });
      flaggedComments = await prisma.briefComment.count({ where: { flagged: true, status: "visible" } });
    } catch {
      pendingBrief = 0;
      flaggedComments = 0;
    }
  }

  return NextResponse.json({
    isAdmin: Boolean(admin),
    openReports,
    pendingBrief,
    flaggedComments,
    impersonating: imp ? { active: true, email: imp.target.email, name: imp.target.name } : { active: false },
  });
}
