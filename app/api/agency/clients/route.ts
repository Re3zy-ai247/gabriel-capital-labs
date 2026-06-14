import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";

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

  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      name: c.fullName || c.name || "Unnamed client",
      location: [c.city, c.state].filter(Boolean).join(", "),
      negativeItems: tlMap.get(c.id) ?? 0,
      letters: ltMap.get(c.id) ?? 0,
      createdAt: c.createdAt,
    })),
  });
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
