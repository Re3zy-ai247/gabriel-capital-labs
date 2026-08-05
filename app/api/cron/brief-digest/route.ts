import { NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/briefDigest";
import { reportError } from "@/lib/observability";
import { requestId } from "@/lib/log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Weekly digest cron (scheduled in vercel.json). CRON_SECRET-gated like the ingest
// cron — Vercel injects `Authorization: Bearer <CRON_SECRET>`; refuse (503) if unset.
// sendWeeklyDigest uses the canonical server-side legal postal address and skips
// when nothing was published in the last 7 days.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron not configured." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rid = requestId(req);
  try {
    // sendWeeklyDigest returns its own honest shape (including an empty-week skip)
    // — pass it through unchanged rather than wrapping it in a competing signal.
    const result = await sendWeeklyDigest();
    return NextResponse.json(result);
  } catch (e) {
    // A throw here previously surfaced as an unexplained 500 with nothing reported —
    // a weekly job, so the next chance to notice would have been seven days later.
    reportError(e, { scope: "cron-brief-digest", phase: "run", requestId: rid });
    return NextResponse.json({ ok: false, error: "Digest failed." }, { status: 500 });
  }
}
