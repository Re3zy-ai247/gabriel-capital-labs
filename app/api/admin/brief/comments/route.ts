import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ensureBriefTables } from "@/lib/brief";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Moderation queue: flagged comments first, then recent — across all articles, all
// statuses — with article context + per-comment report count. Drives /admin/brief/comments.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  await ensureBriefTables();

  const comments = await prisma.briefComment.findMany({
    orderBy: [{ flagged: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const articleIds = [...new Set(comments.map((c) => c.articleId))];
  const articles = articleIds.length
    ? await prisma.briefArticle.findMany({ where: { id: { in: articleIds } }, select: { id: true, slug: true, title: true } })
    : [];
  const aMap = new Map(articles.map((a) => [a.id, a]));

  const ids = comments.map((c) => c.id);
  const reports = ids.length
    ? await prisma.briefCommentReport.groupBy({ by: ["commentId"], where: { commentId: { in: ids } }, _count: { commentId: true } })
    : [];
  const rMap = new Map(reports.map((r) => [r.commentId, r._count.commentId]));

  const flagged = await prisma.briefComment.count({ where: { flagged: true, status: "visible" } });

  return NextResponse.json({
    comments: comments.map((c) => {
      const art = aMap.get(c.articleId);
      return {
        id: c.id,
        body: c.body,
        authorName: c.authorName,
        status: c.status,
        flagged: c.flagged,
        createdAt: c.createdAt,
        reportCount: rMap.get(c.id) ?? 0,
        article: art ? { slug: art.slug, title: art.title } : null,
      };
    }),
    counts: { flagged },
  });
}
