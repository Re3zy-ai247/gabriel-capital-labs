import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import { analyzeReportText } from "@/lib/analyze";
import { decryptText } from "@/lib/docCrypto";
import { recordKaiEvent } from "@/lib/kaiEvents";
import { AiSpendRefusal, withAiPrincipal } from "@/lib/aiMeter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// P0-10 (E-07): this route fans out one paid model call per report and had NO
// maxDuration, so it inherited the 10 s default — it timed out mid-fan-out after
// the tokens had already been spent. 60 matches every other AI route in the repo
// (letters/generate, identity/*, reports/upload, community ask-kai).
export const maxDuration = 60;

// P0-10 (E-07): the 10/hr limit governs the REQUEST; the work was one Sonnet call
// per report the user owns, unbounded. An account with 40 stored reports turned a
// single allowed request into 40 paid calls, ten times an hour. A re-analysis is
// only ever useful for the reports a consumer is actually looking at, so a bulk
// call now covers the newest MAX_FANOUT and says plainly how many it skipped —
// re-analysing a specific older report is still possible one id at a time, which
// is the metered path.
const MAX_FANOUT = 5;

// Re-analyzes a report (or all of the user's reports) with the CURRENT pipeline.
// Rebuilds tradelines from stored rawText so older data benefits from
// parser/classifier/scoring upgrades.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(`report-analyze:${user.id}`, 10, 3600); // fans out paid AI over all reports — cost guard
  if (limited) return limited;

  const { reportId } = await req.json().catch(() => ({}));
  const owned = await prisma.report.count({
    where: { userId: user.id, ...(reportId ? { id: reportId } : {}) },
  });
  const reports = await prisma.report.findMany({
    where: { userId: user.id, ...(reportId ? { id: reportId } : {}) },
    orderBy: { uploadedAt: "desc" },
    take: reportId ? 1 : MAX_FANOUT,
  });
  if (!reports.length) return NextResponse.json({ error: "No reports found" }, { status: 404 });
  const skipped = Math.max(0, owned - reports.length);

  let created = 0;
  try {
    // Attribute every nested model call to this consumer. lib/aiParse.ts calls the
    // meter with userId: null, so without this scope the daily budget would not
    // see the single most expensive surface in the product.
    await withAiPrincipal(user.id, async () => {
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
    });
  } catch (e) {
    // analyzeReportText falls back to the deterministic parser on an AI failure,
    // so a refusal normally never reaches here. If one does, say what happened.
    if (e instanceof AiSpendRefusal) {
      return NextResponse.json({ error: e.consumerMessage }, { status: 429 });
    }
    throw e;
  }

  await recordKaiEvent(user.id, "report.analyzed", {
    payload: { reportsAnalyzed: reports.length, tradelines: created },
  });

  return NextResponse.json({
    ok: true,
    reportsAnalyzed: reports.length,
    tradelines: created,
    // Truthful accounting: never report "all reports re-analyzed" when a cap
    // stopped short of that.
    skipped,
    ...(skipped > 0
      ? {
          notice: `Re-analyzed your ${reports.length} most recent reports. ${skipped} older ${skipped === 1 ? "report was" : "reports were"} left as they are — open one and re-analyze it on its own if you need it refreshed.`,
        }
      : {}),
  });
}
