import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { agencyClientLimit } from "@/lib/entitlements";
import { track, PRODUCT_EVENTS } from "@/lib/events";

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

// GET: the agency's client roster with light per-client stats.
export async function GET() {
  const agency = await currentAccount();
  if (!agency) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agency.isAgency) return NextResponse.json({ error: "Not an agency account." }, { status: 403 });

  const clients = await prisma.user.findMany({
    where: { managedByAgencyId: agency.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, fullName: true, name: true, city: true, state: true, createdAt: true },
  });

  const ids = clients.map((c) => c.id);
  const [tl, lt] = await Promise.all([
    ids.length ? prisma.tradeline.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: true }) : [],
    ids.length ? prisma.letter.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: true }) : [],
  ]);
  const tlMap = new Map(tl.map((r) => [r.userId, r._count]));
  const ltMap = new Map(lt.map((r) => [r.userId, r._count]));

  // Each client's most recently MAILED letter drives the follow-up clock: the
  // FCRA reinvestigation runs ~30 days from when the dispute was sent, so the
  // agent should send the next round around day 30. We surface days-since-sent,
  // the due date, and an attention flag when 30+ days have passed with no logged
  // response — then sort so the work that needs attention rises to the top.
  const mailed = ids.length
    ? await prisma.letter.findMany({
        where: { userId: { in: ids }, mailedAt: { not: null } },
        select: { userId: true, round: true, mailedAt: true, responseAt: true },
        orderBy: { mailedAt: "desc" },
      })
    : [];
  const latest = new Map<string, { round: number; mailedAt: Date; responseAt: Date | null }>();
  for (const l of mailed) {
    if (!latest.has(l.userId) && l.mailedAt) {
      latest.set(l.userId, { round: l.round, mailedAt: l.mailedAt, responseAt: l.responseAt });
    }
  }

  const now = Date.now();
  const DAY = 86_400_000;
  const out = clients.map((c) => {
    const last = latest.get(c.id);
    let lastRound: number | null = null;
    let lastSentAt: string | null = null;
    let daysSince: number | null = null;
    let nextRoundDueAt: string | null = null;
    let needsAttention = false;
    if (last) {
      lastRound = last.round;
      lastSentAt = last.mailedAt.toISOString();
      daysSince = Math.floor((now - last.mailedAt.getTime()) / DAY);
      nextRoundDueAt = new Date(last.mailedAt.getTime() + 30 * DAY).toISOString();
      needsAttention = daysSince >= 30 && !last.responseAt;
    }
    return {
      id: c.id,
      name: c.fullName || c.name || "Unnamed client",
      location: [c.city, c.state].filter(Boolean).join(", "),
      negativeItems: tlMap.get(c.id) ?? 0,
      letters: ltMap.get(c.id) ?? 0,
      lastRound,
      lastSentAt,
      daysSince,
      nextRoundDueAt,
      needsAttention,
    };
  });

  // Needs-attention first, then most-overdue (largest daysSince), then the rest.
  out.sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    return (b.daysSince ?? -1) - (a.daysSince ?? -1);
  });

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
