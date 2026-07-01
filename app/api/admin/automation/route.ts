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

  return NextResponse.json({
    aiOutputs: {
      reportsAnalyzed,
      lettersGenerated,
      briefArticlesPublished: briefPublished,
      total: reportsAnalyzed + lettersGenerated + briefPublished,
    },
    briefAutomation: { autoDraftsQueued: briefDrafts, published: briefPublished },
    aiosTracked: [
      "Hours saved",
      "Workflows automated",
      "Manual tasks remaining",
      "New automation opportunities",
    ],
  });
}
