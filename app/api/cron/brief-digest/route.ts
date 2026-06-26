import { NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/briefDigest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Weekly digest cron (scheduled in vercel.json). CRON_SECRET-gated like the ingest
// cron — Vercel injects `Authorization: Bearer <CRON_SECRET>`; refuse (503) if unset.
// sendWeeklyDigest itself refuses to send without a configured postal address and
// skips when nothing was published in the last 7 days.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron not configured." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendWeeklyDigest();
  return NextResponse.json(result);
}
