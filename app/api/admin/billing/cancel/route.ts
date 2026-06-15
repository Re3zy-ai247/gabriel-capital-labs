import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireAdmin, logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { subscriptionId, immediate? }: cancel a subscription. Defaults to
// canceling at period end (the customer keeps access until then).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const { subscriptionId, immediate } = await req.json().catch(() => ({}));
  if (!subscriptionId) return NextResponse.json({ error: "Missing subscriptionId." }, { status: 400 });

  try {
    const sub = immediate
      ? await stripe.subscriptions.cancel(String(subscriptionId))
      : await stripe.subscriptions.update(String(subscriptionId), { cancel_at_period_end: true });
    await logAudit({
      actor: { id: admin.id, email: admin.email },
      action: "billing.cancel",
      summary: `Canceled subscription ${subscriptionId}${immediate ? " (immediately)" : " (at period end)"}`,
      targetType: "subscription",
      targetId: String(subscriptionId),
    });
    return NextResponse.json({ ok: true, status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end });
  } catch (e) {
    console.error("cancel error", e);
    const msg = e instanceof Error ? e.message : "Cancellation failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
