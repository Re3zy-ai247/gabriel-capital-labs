import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { agencyClientLimit } from "@/lib/entitlements";
import { track, PRODUCT_EVENTS } from "@/lib/events";
import { getAgencyRoster } from "@/lib/agencyRoster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Sentinel so the capacity refusal can travel out of the transaction callback
// without being mistaken for a database fault. Carries the limit that was in
// force at decision time, so the 402 copy quotes what the server actually applied.
class CapacityReached extends Error {
  constructor(readonly limit: number) {
    super("capacity_reached");
    this.name = "CapacityReached";
  }
}

// GET: the agency's client roster with light per-client stats. The computation
// itself lives in lib/agencyRoster.ts (needs-attention-first ordering) so
// Mission Control (agency-owner altitude) can reuse the identical ladder rather
// than re-deriving it (SIM-REVIEW.md finding 13 — never two independently
// specified "do this first" ladders for the same roster).
export async function GET() {
  const agency = await currentAccount();
  if (!agency) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agency.isAgency) return NextResponse.json({ error: "Not an agency account." }, { status: 403 });

  const out = await getAgencyRoster(agency.id);

  // limit rides along so the roster UI can show honest plan consumption
  // (e.g. "12 / 15") — null = unlimited/negotiated.
  return NextResponse.json({ clients: out, limit: agencyClientLimit(agency) });
}

// POST: add a managed client. They are a User row with no password (cannot log
// in) tied to this agency. Email is synthetic since the client never logs in.
export async function POST(req: Request) {
  const agency = await currentAccount();
  if (!agency) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agency.isAgency) return NextResponse.json({ error: "Not an agency account." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.fullName || "").trim();
  if (!fullName) return NextResponse.json({ error: "Client name is required." }, { status: 400 });

  // Enforce the managed-client workspace cap by tier (Agency 15 · Agency Pro 30 ·
  // Scale 50 · Enterprise custom; lib/entitlements.agencyClientLimit → resolveAgencyCapacity
  // is the source of truth). Creation-gating ONLY — existing clients are never locked.
  const limit = agencyClientLimit(agency);

  // The count and the insert MUST be one atomic act. Previously they were two
  // round trips, so two concurrent creations at 14/15 could both read 14, both
  // pass the check, and both insert — putting the agency at 16 on a 15 cap.
  // A row lock on the agency's own User row serializes every creation for THIS
  // agency (and only this agency) for the duration of the transaction, so the
  // second creation reads the first one's committed row and is refused.
  const synthethicEmail = `managed-${randomBytes(8).toString("hex")}@clients.gabrielcapitallabs.local`;

  let client: { id: string; fullName: string | null };
  try {
    client = await prisma.$transaction(async (tx) => {
      if (limit !== null) {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${agency.id} FOR UPDATE`;
        const current = await tx.user.count({ where: { managedByAgencyId: agency.id } });
        if (current >= limit) throw new CapacityReached(limit);
      }
      return tx.user.create({
        data: {
          email: synthethicEmail,
          name: fullName,
          fullName,
          addressLine1: body.addressLine1 ? String(body.addressLine1).slice(0, 200) : null,
          city: body.city ? String(body.city).slice(0, 120) : null,
          state: body.state ? String(body.state).slice(0, 60) : null,
          zip: body.zip ? String(body.zip).slice(0, 20) : null,
          managedByAgencyId: agency.id,
          isAgency: false,
        },
        select: { id: true, fullName: true },
      });
    });
  } catch (e) {
    if (e instanceof CapacityReached) {
      // Honest next-step copy: Agency Pro and Scale are not purchasable yet
      // ("Coming soon" on /pricing) — never phrase them as a buy-now action.
      const next =
        agency.plan === "scale"
          ? "Talk to us about Enterprise for custom capacity — see the pricing page."
          : agency.plan === "agency_pro"
            ? "Scale — with up to 50 client workspaces — is coming soon; see the pricing page for details."
            : "Agency Pro — with up to 30 client workspaces — is coming soon; see the pricing page for details.";
      return NextResponse.json(
        {
          error: `You've reached your plan's capacity of ${e.limit} active client workspaces. Your existing clients stay fully accessible. ${next}`,
          upgrade: true,
        },
        { status: 402 }
      );
    }
    throw e;
  }

  void track(PRODUCT_EVENTS.workspaceCreated, { userId: agency.id }); // fail-open analytics; never blocks the flow
  return NextResponse.json({ client: { id: client.id, name: client.fullName } });
}
