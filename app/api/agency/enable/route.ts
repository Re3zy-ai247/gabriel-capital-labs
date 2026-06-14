import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Flips the signed-in account into an agency account (and promotes it to the
// owner/ADMIN role). This is the OWNER/PREVIEW path — an existing ADMIN can enable
// directly, otherwise the owner provides the server's SETUP_SECRET. Regular
// customers instead unlock agency mode by purchasing the $399/mo subscription,
// which sets isAgency automatically via the Stripe webhook (see lib/billing.ts).
export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const secret = String(body?.secret || "");
  const setupSecret = process.env.SETUP_SECRET;
  const authorized = account.role === "ADMIN" || (!!setupSecret && secret === setupSecret);
  if (!authorized) {
    return NextResponse.json(
      { error: "Incorrect setup secret — agency mode not enabled." },
      { status: 403 }
    );
  }

  const agencyName = body?.agencyName ? String(body.agencyName).slice(0, 120) : account.agencyName;
  await prisma.user.update({
    where: { id: account.id },
    data: { isAgency: true, role: "ADMIN", agencyName: agencyName || account.name || "My Agency" },
  });
  return NextResponse.json({ ok: true });
}
