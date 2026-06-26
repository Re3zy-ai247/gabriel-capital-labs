import { NextResponse } from "next/server";
import { ingestBriefFeeds } from "@/lib/briefIngest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel Cron entrypoint (scheduled in vercel.json). When CRON_SECRET is set in the
// project env, Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on
// each scheduled call — we require it, so the endpoint is not publicly triggerable.
// If CRON_SECRET is unset we refuse (503) rather than expose an open ingest. Never
// publishes — only creates drafts for admin review.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron not configured." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await ingestBriefFeeds({ maxPerRun: 5 });
  return NextResponse.json({ ok: true, ...result });
}
