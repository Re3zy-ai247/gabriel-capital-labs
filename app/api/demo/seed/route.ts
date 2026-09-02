import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDemoUser, DEMO_EMAIL } from "@/lib/demoSeed";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// LOCAL-DEVELOPMENT ONLY. Ensures the demo account exists so the app is
// explorable without configuring auth; ?force=1 refreshes the demo's
// reports/tradelines back to the clean set. The seed is deterministic (no AI
// calls) and idempotent.
//
// It is unauthenticated and ?force=1 is destructive, so in production it must
// not exist at all. The environment guard is the containment that matters — the
// rate limiter behind it is a throttle, not a boundary (and since P0-10 it fails
// CLOSED anyway). The guard uses the same NODE_ENV predicate as
// the demo-user fallback in lib/session.ts. It never returns the demo password
// either — an endpoint must not hand out a working credential in any
// environment.
async function handle(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const limited = await enforceRateLimit(`demo-seed:${clientIp(req)}`, 5, 3600); // unauth destructive re-seed — IP throttle
  if (limited) return limited;
  const force = new URL(req.url).searchParams.get("force");
  try {
    const existing = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
      include: { _count: { select: { tradelines: true } } },
    });

    if (!force && existing && existing._count.tradelines > 0) {
      return NextResponse.json({
        ok: true,
        alreadySeeded: true,
        email: DEMO_EMAIL,
      });
    }

    const tradelines = await seedDemoUser(prisma);
    return NextResponse.json({
      ok: true,
      seeded: true,
      email: DEMO_EMAIL,
      tradelines,
    });
  } catch (e) {
    console.error("demo seed error", e);
    return NextResponse.json({ error: "Demo seed failed. Check server logs." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}
