import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDemoUser, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demoSeed";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ensures the public demo account exists so anyone can explore the app. Safe to
// expose: it only ever touches the single shared demo user (whose password is
// intentionally public), is idempotent, and skips the work once seeded so it
// can't be used to generate load. The seed is fully deterministic (no AI calls).
// Pass ?force=1 to refresh the demo's reports/tradelines back to the clean set.
async function handle(req: Request) {
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
        password: DEMO_PASSWORD,
      });
    }

    const tradelines = await seedDemoUser(prisma);
    return NextResponse.json({
      ok: true,
      seeded: true,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
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
