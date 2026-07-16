import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Readiness (RC1 P0-2): can we serve real traffic — is the database reachable? A trivial
// round-trip; returns 503 on failure so an uptime monitor / load balancer can detect degradation.
// Never leaks error internals. No secrets.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready", db: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 });
  }
}
