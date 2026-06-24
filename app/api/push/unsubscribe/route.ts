import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { deletePushSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Remove this device's subscription for the signed-in user.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  if (!raw?.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  await deletePushSubscription(userId, raw.endpoint);
  return NextResponse.json({ ok: true });
}
