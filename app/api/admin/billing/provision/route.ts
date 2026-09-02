import { NextResponse } from "next/server";
import { getStripe, resolvePrice, reconcileTaxCodes, PRICES } from "@/lib/stripe";
import { requireAdmin, logAudit, setupSecretAccepted } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Eagerly create every catalog product/price in Stripe (they're otherwise created
// lazily on first checkout). Idempotent — existing prices are reused by lookup_key.
// Gated by an ADMIN session OR SETUP_SECRET in the x-setup-secret header (so it
// can be run headlessly without placing the reusable credential in URL logs,
// browser history, or analytics). This route intentionally exports POST only.
async function authorize(req: Request): Promise<boolean> {
  if (await requireAdmin()) return true;
  // Constant-time and throttled per source IP — see lib/admin.ts setupSecretAccepted.
  return setupSecretAccepted(req);
}

export async function POST(req: Request) {
  if (!(await authorize(req))) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const prices: Record<string, string> = {};
  for (const key of Object.keys(PRICES)) {
    prices[key] = await resolvePrice(stripe, key);
  }
  // Backfill tax codes onto every recognized product (Managed Payments needs them).
  const taxUpdated = await reconcileTaxCodes(stripe);

  const admin = await requireAdmin();
  if (admin) {
    await logAudit({
      actor: { id: admin.id, email: admin.email },
      action: "billing.provision",
      summary: `Provisioned ${Object.keys(prices).length} prices; set tax codes on ${taxUpdated.length} products`,
    });
  }
  return NextResponse.json({ ok: true, count: Object.keys(prices).length, prices, taxUpdated });
}
