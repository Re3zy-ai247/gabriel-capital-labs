import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";

export const dynamic = "force-dynamic";

// Lists the signed-in user's uploaded reports (newest first) with a tradeline count.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await prisma.report.findMany({
    where: { userId: user.id },
    orderBy: { uploadedAt: "desc" },
    include: { _count: { select: { tradelines: true } } },
  });

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      bureaus: r.bureaus,
      uploadedAt: r.uploadedAt,
      analyzedAt: r.analyzedAt,
      tradelines: r._count.tradelines,
    })),
  });
}
