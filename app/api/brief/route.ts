import { NextResponse } from "next/server";
import { listPublishedArticles, toCardData } from "@/lib/brief";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public, no-auth feed of PUBLISHED Brief articles. Drives the client-side filter +
// search on /brief. Drafts/rejected are never exposed here.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") || undefined;
  const q = url.searchParams.get("q") || undefined;
  const articles = await listPublishedArticles({ category, q });
  return NextResponse.json({ articles: articles.map(toCardData) });
}
