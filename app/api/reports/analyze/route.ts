import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import { analyzeReportText } from "@/lib/analyze";
import { decryptText } from "@/lib/docCrypto";
import { recordKaiEvent } from "@/lib/kaiEvents";
import { AiSpendRefusal, assertAiBudgetAvailable, reportParseEstimateUsd, withAiPrincipal } from "@/lib/aiMeter";

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

  // Ask BEFORE fanning out. lib/analyze.ts catches every extractor exception and
  // falls back to the deterministic parser, so without this probe a
  // budget-exhausted consumer would watch quality drop with no explanation and
  // the refusal copy would be unreachable by anyone. Read-only and advisory —
  // the bound that actually holds is the reservation inside the meter.
  try {
    // With the estimate of the call it fronts, so the probe refuses exactly where
    // the reservation would (S11 · B-R3-1). Without it there was a band —
    // `budget − estimate < spent < budget` — where this admitted and the meter
    // refused, and the whole re-analysis degraded silently.
    await assertAiBudgetAvailable(user.id, reportParseEstimateUsd());
  } catch (e) {
    if (e instanceof AiSpendRefusal) {
      return NextResponse.json({ error: e.consumerMessage }, { status: 429 });
    }
    throw e;
  }

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
  let analyzed = 0;
  let usedAiEverywhere = true;
  let aiRefusedMessage: string | null = null;
  try {
    // Attribute every nested model call to this consumer. lib/aiParse.ts calls the
    // meter with userId: null, so without this scope the daily budget would not
    // see the single most expensive surface in the product.
    await withAiPrincipal(user.id, async () => {
      for (const report of reports) {
        if (!report.rawText) continue;
        // Re-check before EACH report, not just once up front. The ceiling can be
        // crossed part-way through the fan-out, and this route's work is
        // destructive: analyzeReportText deletes and recreates the report's
        // tradelines, so starting a run whose AI step will be refused REPLACES
        // good AI-derived rows with weaker regex ones (and orphans the letters
        // keyed to them). Stop before that happens rather than after.
        try {
          await assertAiBudgetAvailable(user.id, reportParseEstimateUsd());
        } catch (e) {
          if (!(e instanceof AiSpendRefusal)) throw e;
          aiRefusedMessage = e.consumerMessage;
          break;
        }
        const result = await analyzeReportText(prisma, {
          userId: user.id,
          reportId: report.id,
          rawText: decryptText(report.rawText),
          coveredBureaus: report.bureaus,
        });
        analyzed += 1;
        if (!result.usedAI) usedAiEverywhere = false;
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

  // Nothing was re-read at all: that is a refusal, not a success.
  if (analyzed === 0 && aiRefusedMessage) {
    return NextResponse.json({ error: aiRefusedMessage }, { status: 429 });
  }

  await recordKaiEvent(user.id, "report.analyzed", {
    payload: { reportsAnalyzed: analyzed, tradelines: created },
  });

  const stoppedEarly = Math.max(0, reports.length - analyzed);
  const notices: string[] = [];
  if (aiRefusedMessage) {
    notices.push(
      `${aiRefusedMessage} ${stoppedEarly === 1 ? "1 report was" : `${stoppedEarly} reports were`} left exactly as ${stoppedEarly === 1 ? "it is" : "they are"}.`
    );
  }
  if (skipped > 0) {
    notices.push(
      `Re-analyzed your ${analyzed} most recent ${analyzed === 1 ? "report" : "reports"}. ${skipped} older ${skipped === 1 ? "report was" : "reports were"} left as they are — open one and re-analyze it on its own if you need it refreshed.`
    );
  }

  return NextResponse.json({
    ok: true,
    // Truthful accounting on three axes (S11 · B-R3-1): how many were actually
    // re-read, whether the AI reader was used for all of them, and whether a
    // spend ceiling stopped us. `ok: true` on its own said none of this, and the
    // client rendered "Re-read 5 reports" over a fully degraded result.
    reportsAnalyzed: analyzed,
    tradelines: created,
    skipped,
    usedAI: usedAiEverywhere && analyzed > 0,
    degraded: aiRefusedMessage !== null || !(usedAiEverywhere && analyzed > 0),
    aiRefused: aiRefusedMessage !== null,
    ...(notices.length > 0 ? { notice: notices.join(" ") } : {}),
  });
}
