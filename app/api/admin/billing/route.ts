import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function emailOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer || typeof customer === "string") return null;
  return "email" in customer ? customer.email ?? null : null;
}

// GET: recent charges (for refunds) and subscriptions (for cancellation).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const [charges, subs] = await Promise.all([
    stripe.charges.list({ limit: 25, expand: ["data.customer"] }),
    stripe.subscriptions.list({ limit: 25, status: "all", expand: ["data.customer"] }),
  ]);

  return NextResponse.json({
    charges: charges.data.map((c) => ({
      id: c.id,
      amount: c.amount / 100,
      currency: c.currency,
      status: c.status,
      paid: c.paid,
      refunded: c.refunded,
      amountRefunded: c.amount_refunded / 100,
      email: c.billing_details?.email || emailOf(c.customer),
      description: c.description,
      createdAt: new Date(c.created * 1000).toISOString(),
    })),
    subscriptions: subs.data.map((s) => ({
      id: s.id,
      status: s.status,
      email: emailOf(s.customer),
      amount: (s.items.data[0]?.price?.unit_amount ?? 0) / 100,
      cancelAtPeriodEnd: s.cancel_at_period_end,
      currentPeriodEnd: (s as unknown as { current_period_end?: number }).current_period_end
        ? new Date((s as unknown as { current_period_end: number }).current_period_end * 1000).toISOString()
        : null,
    })),
  });
}
