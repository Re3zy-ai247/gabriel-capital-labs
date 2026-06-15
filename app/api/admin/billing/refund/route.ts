import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireAdmin, logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { chargeId }: issue a full refund on a charge.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const { chargeId } = await req.json().catch(() => ({}));
  if (!chargeId) return NextResponse.json({ error: "Missing chargeId." }, { status: 400 });

  try {
    const refund = await stripe.refunds.create({ charge: String(chargeId) });
    await logAudit({
      actor: { id: admin.id, email: admin.email },
      action: "billing.refund",
      summary: `Refunded charge ${chargeId} ($${(refund.amount / 100).toFixed(2)})`,
      targetType: "charge",
      targetId: String(chargeId),
    });
    return NextResponse.json({ ok: true, amount: refund.amount / 100 });
  } catch (e) {
    console.error("refund error", e);
    const msg = e instanceof Error ? e.message : "Refund failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
