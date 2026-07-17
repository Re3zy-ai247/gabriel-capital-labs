import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { platformHealth, kaiIntelligence } from "@/lib/platform/health";
import { analyticsWindow } from "@/lib/analytics/aggregate";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Executive Platform Dashboard data (Platform Phase B, Sprint 1). ADMIN-only.
// Combines the structural platform health derivation with live DB counts and
// the ProductEvent read models. Every field is measured or explicitly an
// assessment (see lib/platform/health.ts honesty law).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const health = platformHealth();

  // Live customer/system counts — measured; independent failures degrade honestly.
  let customers: { totalUsers: number; agencies: number; managedClients: number; letters: number; reports: number } | null = null;
  try {
    const [totalUsers, agencies, managedClients, letters, reports] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isAgency: true } }),
      prisma.user.count({ where: { managedByAgencyId: { not: null } } }),
      prisma.letter.count(),
      prisma.report.count(),
    ]);
    customers = { totalUsers, agencies, managedClients, letters, reports };
  } catch {
    customers = null; // DB unreachable — the dashboard says so instead of faking
  }

  const analytics = await analyticsWindow(30);
  const kai = kaiIntelligence();

  // Letter outcome intelligence — MEASURED from the DB; null when unreachable.
  let letterOutcomes: { responded: number; favorable: number } | null = null;
  try {
    const [responded, favorable] = await Promise.all([
      prisma.letter.count({ where: { responseOutcome: { not: null } } }),
      prisma.letter.count({ where: { responseOutcome: { in: ["deleted", "updated"] } } }),
    ]);
    letterOutcomes = { responded, favorable };
  } catch {
    letterOutcomes = null;
  }

  return NextResponse.json({ health, customers, analytics, kai: { ...kai, letterOutcomes } });
}
