import { NextResponse } from "next/server";
import { requireAdmin, logAudit } from "@/lib/admin";
import { ingestBriefFeeds } from "@/lib/briefIngest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Manual "Fetch latest news" trigger for the admin — same ingest the cron runs, on
// demand, so the owner can pull + draft without waiting for the schedule. Drafts
// only; nothing publishes.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const result = await ingestBriefFeeds({ maxPerRun: 5 });
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "brief.ingest",
    summary: `Ran Brief ingest — ${result.created} draft(s) created from ${result.scanned} scanned`,
    targetType: "brief",
    targetId: "ingest",
  });
  return NextResponse.json({ ok: true, ...result });
}
