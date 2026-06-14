import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Period boundaries (UTC): week-to-date starts Monday.
function bounds() {
  const now = new Date();
  const dow = (now.getUTCDay() + 6) % 7; // 0 = Monday
  return {
    week: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow)),
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    year: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
  };
}

// Agency KPI report — clients added, letters generated, and accounts deleted,
// each as week-/month-/year-to-date plus all-time. Something for the agent to
// show for their work.
export async function GET() {
  const agency = await currentAccount();
  if (!agency) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agency.isAgency) return NextResponse.json({ error: "Not an agency account." }, { status: 403 });

  const { week, month, year } = bounds();
  const clients = await prisma.user.findMany({
    where: { managedByAgencyId: agency.id },
    select: { id: true, createdAt: true },
  });
  const ids = clients.map((c) => c.id);

  const [letters, deletions] = await Promise.all([
    ids.length
      ? prisma.letter.findMany({ where: { userId: { in: ids } }, select: { createdAt: true } })
      : Promise.resolve([]),
    prisma.agencyClientDeletion.findMany({ where: { agencyId: agency.id }, select: { deletedAt: true } }),
  ]);

  const tally = (dates: Date[]) => ({
    wtd: dates.filter((d) => d >= week).length,
    mtd: dates.filter((d) => d >= month).length,
    ytd: dates.filter((d) => d >= year).length,
    total: dates.length,
  });

  return NextResponse.json({
    activeClients: clients.length,
    clientsAdded: tally(clients.map((c) => c.createdAt)),
    letters: tally(letters.map((l) => l.createdAt)),
    deleted: tally(deletions.map((d) => d.deletedAt)),
  });
}
