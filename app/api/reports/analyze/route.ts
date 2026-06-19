import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { analyzeReportText } from "@/lib/analyze";
import { decryptText } from "@/lib/docCrypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Re-analyzes a report (or all of the user's reports) with the CURRENT pipeline.
// Rebuilds tradelines from stored rawText so older data benefits from
// parser/classifier/scoring upgrades.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId } = await req.json().catch(() => ({}));
  const reports = await prisma.report.findMany({
    where: { userId: user.id, ...(reportId ? { id: reportId } : {}) },
  });
  if (!reports.length) return NextResponse.json({ error: "No reports found" }, { status: 404 });

  let created = 0;
  for (const report of reports) {
    if (!report.rawText) continue;
    const result = await analyzeReportText(prisma, {
      userId: user.id,
      reportId: report.id,
      rawText: decryptText(report.rawText),
      coveredBureaus: report.bureaus,
    });
    created += result.tradelines;
  }

  return NextResponse.json({ ok: true, reportsAnalyzed: reports.length, tradelines: created });
}
