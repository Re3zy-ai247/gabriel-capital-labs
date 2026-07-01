import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Marketing dashboard aggregates. Only DB-backed metrics are returned as numbers;
// external-analytics metrics (traffic, social reach, SEO rank) are surfaced by the
// page as "not yet instrumented" rather than faked. Self-heal-table counts guarded.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const c = <T>(p: Promise<T>) => (p as Promise<number>).catch(() => 0);

  const [newsletterSubscribers, pushSubscribers, briefPublished, briefDrafts, briefComments] =
    await Promise.all([
      c(prisma.user.count({ where: { briefDigest: true } })),
      c(prisma.pushSubscription.count()),
      c(prisma.briefArticle.count({ where: { status: "published" } })),
      c(prisma.briefArticle.count({ where: { status: "draft" } })),
      c(prisma.briefComment.count({ where: { status: "visible" } })),
    ]);

  const agg = await prisma.briefArticle
    .aggregate({ _sum: { views: true, likeCount: true } })
    .catch(() => ({ _sum: { views: 0, likeCount: 0 } }));

  return NextResponse.json({
    audience: { newsletterSubscribers, pushSubscribers },
    brief: {
      published: briefPublished,
      drafts: briefDrafts,
      totalViews: agg._sum.views ?? 0,
      totalLikes: agg._sum.likeCount ?? 0,
      comments: briefComments,
    },
    notInstrumented: [
      "Organic traffic (connect Google Search Console / analytics)",
      "Instagram reach (connect Instagram Graph API)",
      "LinkedIn engagement (connect LinkedIn API)",
      "SEO rankings (connect a rank tracker / Search Console)",
      "Lead generation (tracked by the /gcl-leadgen agent, not the product DB)",
    ],
  });
}
