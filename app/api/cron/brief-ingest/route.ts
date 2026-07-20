import { NextResponse } from "next/server";
import { ingestBriefFeeds } from "@/lib/briefIngest";
import { reportError } from "@/lib/observability";
import { requestId } from "@/lib/log";

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
  const rid = requestId(req);
  try {
    const result = await ingestBriefFeeds({ maxPerRun: 5 });
    // `ok` is DERIVED, never asserted. It used to be a hardcoded `ok: true` that
    // survived every official source being unreachable — a run that ingested nothing
    // reported success and no one learned. A feed failure is survivable but it is not
    // success, so it is reported and alerted while still returning the run's numbers.
    const ok = result.feedErrors === 0;
    if (!ok) {
      reportError(new Error(`brief ingest: ${result.feedErrors} feed(s) unreachable`), {
        scope: "cron-brief-ingest", requestId: rid,
        feedErrors: result.feedErrors, scanned: result.scanned, created: result.created,
      });
    }
    return NextResponse.json({ ok, ...result });
  } catch (e) {
    // A throw here previously surfaced as an unexplained 500 with nothing reported.
    reportError(e, { scope: "cron-brief-ingest", phase: "run", requestId: rid });
    return NextResponse.json({ ok: false, error: "Ingest failed." }, { status: 500 });
  }
}
