import { NextResponse } from "next/server";
import { requireAdmin, logAudit } from "@/lib/admin";
import { sendWeeklyDigest } from "@/lib/briefDigest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Send the current week's digest to the admin only, as a preview — lets the owner
// see the exact email (and surfaces the "postal address not set" guard) without
// waiting for the weekly cron or having a real opted-in list.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const to = process.env.ADMIN_EMAIL || admin.email;
  const result = await sendWeeklyDigest({ testTo: to });
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "brief.digest.test",
    summary: `Sent a test Brief digest to ${to} (${result.articles} articles)`,
    targetType: "brief",
    targetId: "digest-test",
  });
  return NextResponse.json({ ...result, to });
}
