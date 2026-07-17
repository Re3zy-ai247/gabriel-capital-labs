import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { analyticsWindow } from "@/lib/analytics/aggregate";

export const dynamic = "force-dynamic";

// Analytics read models (Platform Phase B, Sprint 6). ADMIN-only. Real queries
// over ProductEvent; `instrumented:false` when no events exist — never faked.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
  return NextResponse.json(await analyticsWindow(days));
}
