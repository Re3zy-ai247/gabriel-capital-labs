import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import { track, CLIENT_REPORTABLE_EVENTS, type ProductEventName } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Minimal client-event intake for the Private Alpha funnel. A signed-in browser
// may only report the whitelisted low-stakes events (onboarding + plan-viewed);
// conversions, billing, and failures are emitted server-side so they can't be
// spoofed. Fail-open: analytics never blocks the caller.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cheap abuse guard so a page can't flood the sink.
  const limited = await enforceRateLimit(`events:${user.id}`, 120, 3600);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const name = body?.name;
  if (typeof name !== "string" || !CLIENT_REPORTABLE_EVENTS.has(name)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  await track(name as ProductEventName, { userId: user.id });
  return NextResponse.json({ ok: true });
}
