import { NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/push";
import { currentAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Store a device's Web Push subscription for the signed-in user. Idempotent
// (upsert on endpoint), so re-enabling from the same device just refreshes it.
export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  if (!raw?.endpoint || !raw?.keys?.p256dh || !raw?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await savePushSubscription(account.id, {
    endpoint: raw.endpoint,
    keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
  });
  return NextResponse.json({ ok: true });
}
