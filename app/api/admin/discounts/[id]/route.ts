import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireAdmin, logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PATCH: activate / deactivate a promotion code. (Stripe promotion codes can be
// toggled active=false to stop accepting them; the underlying coupon is kept.)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const active = Boolean(body.active);

  try {
    const pc = await stripe.promotionCodes.update(params.id, { active });
    await logAudit({
      actor: { id: admin.id, email: admin.email },
      action: active ? "discount.activate" : "discount.deactivate",
      summary: `${active ? "Activated" : "Deactivated"} discount code ${pc.code}`,
      targetType: "discount",
      targetId: pc.id,
    });
    return NextResponse.json({ ok: true, active: pc.active });
  } catch (e) {
    console.error("discount update error", e);
    return NextResponse.json({ error: "Could not update the discount code." }, { status: 400 });
  }
}
