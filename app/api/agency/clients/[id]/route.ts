import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DELETE: permanently remove a managed client (and, via cascade, their reports,
// tradelines, letters, and documents). Only the owning agency may do this.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const agency = await currentAccount();
  if (!agency) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agency.isAgency) return NextResponse.json({ error: "Not an agency account." }, { status: 403 });

  const client = await prisma.user.findFirst({
    where: { id: params.id, managedByAgencyId: agency.id },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  await prisma.user.delete({ where: { id: client.id } });
  return NextResponse.json({ ok: true });
}
