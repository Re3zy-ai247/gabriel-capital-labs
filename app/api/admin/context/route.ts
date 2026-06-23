import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ensureCommunityTables } from "@/lib/community";
import { impersonationContext } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lightweight probe for the app shell: is the real signed-in user an admin, are
// they currently impersonating someone, and how many community reports are open
// (drives the moderation-queue badge in the nav). The count runs only for admins
// and fails safe to 0, so the shell probe can never break.
export async function GET() {
  const admin = await requireAdmin();
  const imp = await impersonationContext();

  let openReports = 0;
  if (admin) {
    try {
      await ensureCommunityTables();
      openReports = await prisma.communityReport.count({ where: { status: "open" } });
    } catch {
      openReports = 0;
    }
  }

  return NextResponse.json({
    isAdmin: Boolean(admin),
    openReports,
    impersonating: imp ? { active: true, email: imp.target.email, name: imp.target.name } : { active: false },
  });
}
