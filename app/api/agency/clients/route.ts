import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { agencyClientLimit } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  return NextResponse.json({ clients: out });
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

  // Enforce the managed-client cap by agency tier (Agency = 50, Agency Pro / admin = unlimited).
  const limit = agencyClientLimit(agency);
  if (limit !== null) {
    const current = await prisma.user.count({ where: { managedByAgencyId: agency.id } });
    if (current >= limit) {
      return NextResponse.json(
        {
          error: `You've reached your ${limit}-client limit on the Agency plan. Upgrade to Agency Pro for unlimited clients.`,
          upgrade: true,
        },
        { status: 402 }
      );
    }
  }

  const synthethicEmail = `managed-${randomBytes(8).toString("hex")}@clients.gabrielcapitallabs.local`;

  const client = await prisma.user.create({
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

  return NextResponse.json({ client: { id: client.id, name: client.fullName } });
}
