import type { Bureau, PrismaClient } from "@prisma/client";
import { extractRawTradelines, toBureauData, type ExtractedTradeline } from "./parse";
import { aiExtractTradelines } from "./aiParse";
import { classifyCreditor } from "./classify";
import { scoreTradeline } from "./scoring";
import { computeDuplicateGroups } from "./dedupe";

export interface AnalyzeResult {
  tradelines: number;
  usedAI: boolean;
}

// `balance` is a 32-bit Int column (max 2,147,483,647 cents). Real-report text
// can mis-parse into a value that overflows it (or NaN), which would throw a DB
// error mid-analysis. Clamp to a safe, sane range so a single bad number never
// fails the whole upload.
const MAX_CENTS = 2_000_000_000; // $20,000,000
function safeCents(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(Math.max(0, Math.round(v)), MAX_CENTS);
}

// Parse a possibly-garbage date string; return null if it isn't a valid date so
// Prisma never receives an Invalid Date.
function safeDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  // Guard against absurd years from mis-parsed text.
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 2100) return null;
  return d;
}

// The single source of truth for turning a report's raw text into scored,
// classified, deduped tradelines. Used by upload, re-analyze, and the seed so
// they can never drift apart. Prefers AI extraction (robust across formats),
// falls back to the deterministic regex parser.
export async function analyzeReportText(
  prisma: PrismaClient,
  opts: { userId: string; reportId: string; rawText: string; coveredBureaus: Bureau[] }
): Promise<AnalyzeResult> {
  const { userId, reportId, rawText, coveredBureaus } = opts;

  let extracted: ExtractedTradeline[] = [];
  let usedAI = false;
  try {
    const ai = await aiExtractTradelines(rawText, coveredBureaus);
    if (ai && ai.length) {
      extracted = ai;
      usedAI = true;
    }
  } catch (e) {
    console.error("AI extraction failed, falling back to regex parser:", e);
  }
  if (!extracted.length) {
    extracted = extractRawTradelines(rawText, coveredBureaus);
  }

  await prisma.tradeline.deleteMany({ where: { reportId } });

  const records = extracted.map((ex) => {
    const balanceCents = safeCents(ex.balanceCents);
    const cls = classifyCreditor(ex.creditorName, ex.typeHint);
    const bureauData = toBureauData(ex, coveredBureaus);
    const score = scoreTradeline({
      accountType: cls.accountType,
      isDebtBuyer: cls.isDebtBuyer,
      balanceCents,
      dateOfFirstDelinquency: ex.dofd ? new Date(ex.dofd) : null,
      bureauData,
      nonStrategic: cls.nonStrategic,
    });
    return { ex, cls, bureauData, score, balanceCents };
  });

  const groups = computeDuplicateGroups(
    records.map((r, i) => ({
      id: String(i),
      creditorName: r.ex.creditorName,
      originalCreditor: r.ex.originalCreditor,
      balanceCents: r.balanceCents,
    }))
  );

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    await prisma.tradeline.create({
      data: {
        userId,
        reportId,
        creditorName: r.ex.creditorName,
        originalCreditor: r.ex.originalCreditor,
        accountNumberMask: r.ex.accountNumberMask,
        accountType: r.cls.accountType,
        isDebtBuyer: r.cls.isDebtBuyer,
        balance: r.balanceCents,
        dateOfFirstDelinquency: safeDate(r.ex.dofd),
        bureauData: r.bureauData as object,
        score: r.score.score,
        probability: r.score.probability,
        reasons: r.score.reasons,
        disputeAngles: r.score.disputeAngles,
        duplicateGroup: groups[String(i)] ?? null,
      },
    });
  }

  await prisma.report.update({ where: { id: reportId }, data: { analyzedAt: new Date() } });
  return { tradelines: records.length, usedAI };
}
