import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { extractRawTradelines, toBureauData } from "@/lib/parse";
import { classifyCreditor } from "@/lib/classify";
import { scoreTradeline } from "@/lib/scoring";
import { computeDuplicateGroups } from "@/lib/dedupe";
import { presentBureaus, getBureauData } from "@/lib/bureauData";

// Re-analyzes a report (or all of the user's reports) with the CURRENT pipeline.
// This is the migration/re-analyze entry point: it rebuilds tradelines from the
// stored rawText so older data benefits from parser/classifier/scoring fixes.
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
    await prisma.tradeline.deleteMany({ where: { reportId: report.id } });

    const extracted = extractRawTradelines(report.rawText, report.bureaus);
    const records = extracted.map((ex) => {
      const cls = classifyCreditor(ex.creditorName, ex.typeHint);
      const bureauData = toBureauData(ex, report.bureaus);
      const score = scoreTradeline({
        accountType: cls.accountType,
        isDebtBuyer: cls.isDebtBuyer,
        balanceCents: ex.balanceCents,
        dateOfFirstDelinquency: ex.dofd ? new Date(ex.dofd) : null,
        bureauData,
        nonStrategic: cls.nonStrategic,
      });
      return { ex, cls, bureauData, score };
    });

    const groups = computeDuplicateGroups(
      records.map((r, i) => ({
        id: String(i),
        creditorName: r.ex.creditorName,
        originalCreditor: r.ex.originalCreditor,
        balanceCents: r.ex.balanceCents,
      }))
    );

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      await prisma.tradeline.create({
        data: {
          userId: user.id,
          reportId: report.id,
          creditorName: r.ex.creditorName,
          originalCreditor: r.ex.originalCreditor,
          accountNumberMask: r.ex.accountNumberMask,
          accountType: r.cls.accountType,
          isDebtBuyer: r.cls.isDebtBuyer,
          balance: r.ex.balanceCents,
          dateOfFirstDelinquency: r.ex.dofd ? new Date(r.ex.dofd) : null,
          bureauData: r.bureauData as object,
          score: r.score.score,
          probability: r.score.probability,
          reasons: r.score.reasons,
          disputeAngles: r.score.disputeAngles,
          duplicateGroup: groups[String(i)] ?? null,
        },
      });
      created++;
    }
    await prisma.report.update({ where: { id: report.id }, data: { analyzedAt: new Date() } });
  }

  return NextResponse.json({ ok: true, reportsAnalyzed: reports.length, tradelines: created });
}
