import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { eventBusEnabled } from "@/lib/eventBus/flags";
import { redactEvent, type AuthContext } from "@/lib/eventBus/store";

// Event Bus data-subject erasure — ADMIN-ONLY, flag-gated. Clears an event's payload
// and stamps redactedAt (a tombstone), keeping the envelope so the immutable log's
// ordering/idempotency stay intact. This gives an erasure request a runtime path; the
// AuthContext is resolved SERVER-SIDE from the verified admin session (platform scope),
// never from the request body. (Cascading redaction from the account-deletion flow is a
// deferred, owner-gated integration.)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(req: Request) {
  if (!eventBusEnabled()) return NextResponse.json({ error: "Event bus is not enabled." }, { status: 404 });

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = body && typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing event id." }, { status: 400 });

  const ctx: AuthContext = { tenantId: admin.id, agencyId: null, isAgency: false, isAdmin: true };
  const redacted = await redactEvent(ctx, id);
  if (!redacted) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ ok: true, redacted: true });
}
