import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { eventBusEnabled } from "@/lib/eventBus/flags";
import { readSince, replayEvents, type AuthContext } from "@/lib/eventBus/store";
import { EVENT_TYPES, type EventType } from "@/lib/eventBus/envelope";

// Event Bus observability — ADMIN-ONLY, flag-gated read/replay of the platform event
// log. There is NO public publish endpoint (Sprint 8: "only internal event
// publication"): domain events are published server-side via lib/eventBus/publish. This
// endpoint only READS, and only for an admin.
//
// The read AuthContext is resolved SERVER-SIDE (isAdmin from the verified session), never
// from the query string — so there is no IDOR: a non-admin gets 403 and can never pass a
// tenant/agency scope. `?type` is validated against the known set (fail-closed to no
// filter). `mode=replay` does a bounded [from,to] replay over the durable log.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: Request) {
  if (!eventBusEnabled()) return NextResponse.json({ error: "Event bus is not enabled." }, { status: 404 });

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  // Platform-wide observability context — derived from the verified admin session.
  const ctx: AuthContext = { tenantId: admin.id, agencyId: null, isAgency: false, isAdmin: true };

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type");
  const type: EventType | undefined = typeParam && (EVENT_TYPES as readonly string[]).includes(typeParam) ? (typeParam as EventType) : undefined;
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));

  if (url.searchParams.get("mode") === "replay") {
    const events = await replayEvents(ctx, {
      fromCursor: url.searchParams.get("from"),
      toCursor: url.searchParams.get("to"),
      type,
      limit,
    });
    return NextResponse.json({ mode: "replay", events });
  }

  const { events, cursor } = await readSince(ctx, { cursor: url.searchParams.get("since"), type, limit });
  return NextResponse.json({ mode: "read", events, cursor });
}
