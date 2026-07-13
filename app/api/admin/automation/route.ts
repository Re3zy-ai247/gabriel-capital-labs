import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Automation dashboard. The product DB can show AI-assisted output volume and the
// Brief news-automation queue (both real). The operating-layer metrics the founder
// asked for — hours saved, workflows automated, manual tasks remaining, new
// automation opportunities — live in the AIOS (the /gcl backlog + /gcl-automation
// agent), NOT the product DB, so they're surfaced by the page as AIOS-tracked
// rather than invented here.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const c = <T>(p: Promise<T>) => (p as Promise<number>).catch(() => 0);

  const [reportsAnalyzed, lettersGenerated, briefPublished, briefDrafts] = await Promise.all([
    c(prisma.report.count({ where: { analyzedAt: { not: null } } })), // AI parse
    c(prisma.letter.count()),                                          // AI-assisted drafting
    c(prisma.briefArticle.count({ where: { status: "published" } })), // AI summarization
    c(prisma.briefArticle.count({ where: { status: "draft" } })),     // news-automation queue
  ]);

  // BI-COST-01 — measured AI spend, grouped by surface, last 30 days.
  // The AiUsage table is self-heal (ADR-0001) and may not exist in prod yet:
  // on any failure we return null so the page says "not yet collecting"
  // instead of crashing (honest-metrics law).
  let aiUsage: {
    windowDays: number;
    surfaces: {
      surface: string;
      calls: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      failures: number;
      avgMs: number;
    }[];
  } | null = null;
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [grouped, failed] = await Promise.all([
      prisma.aiUsage.groupBy({
        by: ["surface"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
        _avg: { ms: true },
      }),
      prisma.aiUsage.groupBy({
        by: ["surface"],
        where: { createdAt: { gte: since }, ok: false },
        _count: { _all: true },
      }),
    ]);
    const failuresBySurface = new Map(failed.map((f) => [f.surface, f._count._all]));
    aiUsage = {
      windowDays: 30,
      surfaces: grouped
        .map((g) => ({
          surface: g.surface,
          calls: g._count._all,
          inputTokens: g._sum.inputTokens ?? 0,
          outputTokens: g._sum.outputTokens ?? 0,
          costUsd: g._sum.costUsd ?? 0,
          failures: failuresBySurface.get(g.surface) ?? 0,
          avgMs: Math.round(g._avg.ms ?? 0),
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
    };
  } catch (e) {
    // Table not created yet (expected pre-first-call) OR a real DB failure —
    // either way the card renders its honest empty state; log so an outage
    // never silently masquerades as "no usage".
    console.error("admin/automation: aiUsage aggregate unavailable:", e);
    aiUsage = null;
  }

  return NextResponse.json({
    aiOutputs: {
      reportsAnalyzed,
      lettersGenerated,
      briefArticlesPublished: briefPublished,
      total: reportsAnalyzed + lettersGenerated + briefPublished,
    },
    briefAutomation: { autoDraftsQueued: briefDrafts, published: briefPublished },
    aiUsage,
    aiosTracked: [
      "Hours saved",
      "Workflows automated",
      "Manual tasks remaining",
      "New automation opportunities",
    ],
  });
}
