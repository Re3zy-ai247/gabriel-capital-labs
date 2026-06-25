import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
  ensureBriefTables,
  listVisibleComments,
  toCommentData,
  briefCommentAuthorName,
  screenCommentBody,
} from "@/lib/brief";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function viewerOf(account: { id: string; role?: string | null } | null) {
  return account ? { id: account.id, isAdmin: account.role === "ADMIN" } : null;
}

async function publishedArticleId(slug: string): Promise<string | null> {
  if (!slug) return null;
  await ensureBriefTables();
  const a = await prisma.briefArticle.findUnique({ where: { slug }, select: { id: true, status: true } });
  return a && a.status === "published" ? a.id : null;
}

// Public list of visible comments for a published article. canDelete is computed
// against the (optional) signed-in viewer so the author/admin see a delete control.
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") || "";
  const articleId = await publishedArticleId(slug);
  if (!articleId) return NextResponse.json({ comments: [] });
  const account = await currentAccount();
  const rows = await listVisibleComments(articleId);
  return NextResponse.json({ comments: rows.map((c) => toCommentData(c, viewerOf(account))) });
}

// Post a comment. Any signed-in account (free included). Comments are CROA-screened
// on write — prohibited-claim text is rejected (422), never stored or reworded.
export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });

  const limited = await enforceRateLimit(`brief-comment:${account.id}`, 15, 3600);
  if (limited) return limited;

  const raw = await req.json().catch(() => ({}));
  const slug = typeof raw.slug === "string" ? raw.slug : "";
  const articleId = await publishedArticleId(slug);
  if (!articleId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const screened = screenCommentBody(raw.body);
  if (!screened.ok) return NextResponse.json({ error: screened.error }, { status: 422 });

  const comment = await prisma.briefComment.create({
    data: {
      articleId,
      userId: account.id,
      authorName: briefCommentAuthorName(account),
      body: screened.body,
    },
  });

  return NextResponse.json({
    ok: true,
    comment: toCommentData(comment, { id: account.id, isAdmin: account.role === "ADMIN" }),
  });
}
