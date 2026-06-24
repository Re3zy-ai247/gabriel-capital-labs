import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";
import { applyCompliance } from "@/lib/compliance";
import { ensureBriefTables, slugify } from "@/lib/brief";
import { normalizeBriefCategory, BRIEF_LIMITS } from "@/lib/briefShared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanStr(v: unknown, max: number): string {
  return (typeof v === "string" ? v : "").trim().slice(0, max);
}
function cleanTags(v: unknown): string[] {
  return Array.isArray(v)
    ? v.map((t) => cleanStr(t, BRIEF_LIMITS.tag)).filter(Boolean).slice(0, BRIEF_LIMITS.tags)
    : [];
}
function isHttpUrl(u: string): boolean {
  return /^https?:\/\/\S+/i.test(u);
}

// List all articles (incl. drafts) for the admin dashboard, with status counts.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  await ensureBriefTables();

  const status = new URL(req.url).searchParams.get("status");
  const where = status && ["draft", "published", "rejected"].includes(status) ? { status } : {};
  const [articles, draft, published, rejected] = await Promise.all([
    prisma.briefArticle.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.briefArticle.count({ where: { status: "draft" } }),
    prisma.briefArticle.count({ where: { status: "published" } }),
    prisma.briefArticle.count({ where: { status: "rejected" } }),
  ]);
  return NextResponse.json({ articles, counts: { draft, published, rejected } });
}

// Create a DRAFT. Summary + caption are run through the CROA scrubber on write, so
// stored content stays compliant regardless of admin edits. Never auto-publishes.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  await ensureBriefTables();

  const raw = await req.json().catch(() => ({}));
  const title = cleanStr(raw.title, BRIEF_LIMITS.title);
  const sourceUrl = cleanStr(raw.sourceUrl, BRIEF_LIMITS.source);
  const sourceName = cleanStr(raw.sourceName, 120) || "Source";
  const summary = applyCompliance(cleanStr(raw.summary, BRIEF_LIMITS.summary)).text;

  if (!title || !summary) return NextResponse.json({ error: "Title and summary are required." }, { status: 400 });
  if (!isHttpUrl(sourceUrl)) return NextResponse.json({ error: "Source URL must be a valid http(s) link." }, { status: 400 });

  const article = await prisma.briefArticle.create({
    data: {
      slug: slugify(title),
      title,
      summary,
      sourceUrl,
      sourceName,
      category: normalizeBriefCategory(raw.category),
      tags: cleanTags(raw.tags),
      socialCaption: applyCompliance(cleanStr(raw.socialCaption, BRIEF_LIMITS.caption)).text || null,
      status: "draft",
      authorId: admin.id,
    },
  });
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "brief.create",
    summary: `Created Brief draft "${title}"`,
    targetType: "brief_article",
    targetId: article.id,
  });
  return NextResponse.json({ ok: true, article });
}
