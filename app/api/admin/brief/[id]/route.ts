import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";
import { applyCompliance } from "@/lib/compliance";
import { ensureBriefTables } from "@/lib/brief";
import { normalizeBriefCategory, BRIEF_LIMITS } from "@/lib/briefShared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanStr(v: unknown, max: number): string {
  return (typeof v === "string" ? v : "").trim().slice(0, max);
}
function isHttpUrl(u: string): boolean {
  return /^https?:\/\/\S+/i.test(u);
}

// Edit fields and/or transition status (draft|published|rejected) + feature/pin.
// Summary/caption are re-scrubbed on write so an admin edit can't slip past the
// CROA bar; publishing stamps publishedAt the first time.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  await ensureBriefTables();

  const existing = await prisma.briefArticle.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await req.json().catch(() => ({}));
  const data: Prisma.BriefArticleUpdateInput = {};

  if (typeof raw.title === "string") data.title = cleanStr(raw.title, BRIEF_LIMITS.title);
  if (typeof raw.summary === "string") data.summary = applyCompliance(cleanStr(raw.summary, BRIEF_LIMITS.summary)).text;
  if (typeof raw.sourceName === "string") data.sourceName = cleanStr(raw.sourceName, 120);
  if (typeof raw.sourceUrl === "string") {
    const u = cleanStr(raw.sourceUrl, BRIEF_LIMITS.source);
    if (!isHttpUrl(u)) return NextResponse.json({ error: "Source URL must be a valid http(s) link." }, { status: 400 });
    data.sourceUrl = u;
  }
  if (typeof raw.category === "string") data.category = normalizeBriefCategory(raw.category);
  if (Array.isArray(raw.tags)) {
    data.tags = raw.tags.map((t: unknown) => cleanStr(t, BRIEF_LIMITS.tag)).filter(Boolean).slice(0, BRIEF_LIMITS.tags);
  }
  if (typeof raw.socialCaption === "string") {
    data.socialCaption = applyCompliance(cleanStr(raw.socialCaption, BRIEF_LIMITS.caption)).text || null;
  }
  if (typeof raw.featured === "boolean") data.featured = raw.featured;
  if (raw.status === "draft" || raw.status === "published" || raw.status === "rejected") {
    data.status = raw.status;
    if (raw.status === "published" && !existing.publishedAt) data.publishedAt = new Date();
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const article = await prisma.briefArticle.update({ where: { id: params.id }, data });
  const action = data.status === "published" ? "brief.publish" : data.status === "rejected" ? "brief.reject" : "brief.update";
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action,
    summary: `${action.split(".")[1]} Brief article "${article.title}"`,
    targetType: "brief_article",
    targetId: article.id,
  });
  return NextResponse.json({ ok: true, article });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  await ensureBriefTables();

  const existing = await prisma.briefArticle.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.briefArticle.delete({ where: { id: params.id } });
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "brief.delete",
    summary: `Deleted Brief article "${existing.title}"`,
    targetType: "brief_article",
    targetId: existing.id,
  });
  return NextResponse.json({ ok: true });
}
