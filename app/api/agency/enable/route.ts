import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Flips the signed-in account into an agency account. PHASE 1 PREVIEW: gated to
// ADMIN so it can be enabled for testing. In phase 2 this is set automatically
// when the $399/mo agency subscription is active.
export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (account.role !== "ADMIN") {
    return NextResponse.json(
      { error: "The agency tier isn't available on your plan yet." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const agencyName = body?.agencyName ? String(body.agencyName).slice(0, 120) : account.agencyName;

  await prisma.user.update({
    where: { id: account.id },
    data: { isAgency: true, agencyName: agencyName || account.name || "My Agency" },
  });
  return NextResponse.json({ ok: true });
}
