import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { ensureBriefTables } from "@/lib/brief";
import { isBriefReactionKind } from "@/lib/briefShared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Like / bookmark a published Brief article. POST adds the reaction, DELETE
// removes it — both idempotent (the unique (article,user,kind) index makes a
// repeat add/remove a harmless no-op). Open to ANY signed-in account (free
// included); anonymous callers get 401 so the client can prompt sign-in.
// Likes keep BriefArticle.likeCount in sync; bookmarks are private (no count).
import { enforceRateLimit } from "@/lib/rateLimit";

async function resolve(req: Request): Promise<
  | { error: NextResponse }
  | { account: { id: string }; articleId: string; kind: "like" | "bookmark"; likeCount: number }
> {
  const account = await currentAccount();
  if (!account) return { error: NextResponse.json({ error: "Sign in to react." }, { status: 401 }) };

  const limited = await enforceRateLimit(`brief-react:${account.id}`, 200, 3600);
  if (limited) return { error: limited };

  const raw = await req.json().catch(() => ({}));
  const slug = typeof raw.slug === "string" ? raw.slug : "";
  const kind = raw.kind;
  if (!slug || !isBriefReactionKind(kind)) {
    return { error: NextResponse.json({ error: "Bad request." }, { status: 400 }) };
  }

  await ensureBriefTables();
  const article = await prisma.briefArticle.findUnique({
    where: { slug },
    select: { id: true, status: true, likeCount: true },
  });
  if (!article || article.status !== "published") {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { account, articleId: article.id, kind, likeCount: article.likeCount };
}

export async function POST(req: Request) {
  const r = await resolve(req);
  if ("error" in r) return r.error;
  const { account, articleId, kind } = r;
  let likeCount = r.likeCount;

  // skipDuplicates makes a repeat like/bookmark a no-op; count>0 = newly added.
  const created = await prisma.briefReaction.createMany({
    data: [{ articleId, userId: account.id, kind }],
    skipDuplicates: true,
  });
  if (kind === "like" && created.count > 0) {
    const u = await prisma.briefArticle.update({
      where: { id: articleId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    likeCount = u.likeCount;
  }

  return NextResponse.json({
    ok: true,
    likeCount,
    ...(kind === "like" ? { liked: true } : { bookmarked: true }),
  });
}

export async function DELETE(req: Request) {
  const r = await resolve(req);
  if ("error" in r) return r.error;
  const { account, articleId, kind } = r;
  let likeCount = r.likeCount;

  const del = await prisma.briefReaction.deleteMany({ where: { articleId, userId: account.id, kind } });
  if (kind === "like" && del.count > 0) {
    const u = await prisma.briefArticle.update({
      where: { id: articleId },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    });
    likeCount = Math.max(0, u.likeCount);
  }

  return NextResponse.json({
    ok: true,
    likeCount,
    ...(kind === "like" ? { liked: false } : { bookmarked: false }),
  });
}
