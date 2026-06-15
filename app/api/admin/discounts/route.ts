import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { requireAdmin, logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function mapCode(pc: Stripe.PromotionCode) {
  // In recent Stripe API versions the coupon lives under `promotion.coupon`.
  const ref = pc.promotion.coupon;
  const c = ref && typeof ref !== "string" ? ref : null;
  return {
    id: pc.id,
    code: pc.code,
    active: pc.active,
    percentOff: c?.percent_off ?? null,
    amountOff: c?.amount_off != null ? c.amount_off / 100 : null,
    duration: c?.duration ?? "once",
    durationInMonths: c?.duration_in_months ?? null,
    maxRedemptions: pc.max_redemptions ?? null,
    timesRedeemed: pc.times_redeemed,
    expiresAt: pc.expires_at ? new Date(pc.expires_at * 1000).toISOString() : null,
    createdAt: new Date(pc.created * 1000).toISOString(),
  };
}

// GET: list discount (promotion) codes. POST: create a coupon + promotion code.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const list = await stripe.promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] });
  return NextResponse.json({ codes: list.data.map(mapCode) });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase();
  const kind = body.kind === "amount" ? "amount" : "percent";
  const value = Number(body.value);
  const duration: "once" | "repeating" | "forever" =
    ["once", "repeating", "forever"].includes(body.duration) ? body.duration : "once";
  const durationInMonths = body.durationInMonths ? Number(body.durationInMonths) : undefined;
  const maxRedemptions = body.maxRedemptions ? Number(body.maxRedemptions) : undefined;
  const expiresAt = body.expiresAt ? Math.floor(new Date(body.expiresAt).getTime() / 1000) : undefined;

  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return NextResponse.json({ error: "Code must be 3–40 chars: A–Z, 0–9, _ or -." }, { status: 400 });
  }
  if (kind === "percent" && !(value > 0 && value <= 100)) {
    return NextResponse.json({ error: "Percent off must be between 1 and 100." }, { status: 400 });
  }
  if (kind === "amount" && !(value > 0)) {
    return NextResponse.json({ error: "Amount off must be greater than 0." }, { status: 400 });
  }
  if (duration === "repeating" && !(durationInMonths && durationInMonths > 0)) {
    return NextResponse.json({ error: "Repeating coupons need a number of months." }, { status: 400 });
  }

  try {
    const couponParams: Stripe.CouponCreateParams = { duration };
    if (kind === "percent") couponParams.percent_off = value;
    else {
      couponParams.amount_off = Math.round(value * 100);
      couponParams.currency = "usd";
    }
    if (duration === "repeating") couponParams.duration_in_months = durationInMonths;
    const coupon = await stripe.coupons.create(couponParams);

    const promo = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
      ...(expiresAt ? { expires_at: expiresAt } : {}),
      expand: ["promotion.coupon"],
    });

    const discountLabel = kind === "percent" ? `${value}% off` : `$${value} off`;
    await logAudit({
      actor: { id: admin.id, email: admin.email },
      action: "discount.create",
      summary: `Created discount code ${code} (${discountLabel}, ${duration})`,
      targetType: "discount",
      targetId: promo.id,
      metadata: { code, kind, value, duration, durationInMonths, maxRedemptions },
    });

    return NextResponse.json({ code: mapCode(promo) });
  } catch (e) {
    console.error("discount create error", e);
    const msg = e instanceof Error ? e.message : "Could not create the discount code.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
