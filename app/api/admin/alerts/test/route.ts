import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { enforceRateLimit } from "@/lib/rateLimit";
import { deliverAlertWebhook } from "@/lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYNTHETIC_ALERT_MESSAGE =
  "CreditVector RC1 readiness test — synthetic production alert. No action required.";

// POST-only by file convention. The handler deliberately accepts no Request, so
// neither body nor query-string data can influence the message or destination.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const limited = await enforceRateLimit(`admin-alert-test:${admin.id}`, 1, 300);
  if (limited) return limited;

  const result = await deliverAlertWebhook(SYNTHETIC_ALERT_MESSAGE);
  if (!result.delivered) {
    if (result.reason === "not_configured") {
      return NextResponse.json(
        { delivered: false, error: "Alert delivery is not configured." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { delivered: false, error: "Alert delivery failed." },
      { status: 502 }
    );
  }

  return NextResponse.json({ delivered: true });
}
