import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Flips the signed-in account into an agency account (agency MODE only — this
// never grants the platform ADMIN role). This is the OWNER/PREVIEW path — an
// existing ADMIN can enable directly, otherwise the owner provides the server's
// SETUP_SECRET. Regular customers instead unlock agency mode by purchasing the
// $399/mo subscription, which sets isAgency automatically via the Stripe webhook
// (see lib/billing.ts).
//
// SECURITY: this route used to also set role:"ADMIN", which meant anyone who
// learned SETUP_SECRET could escalate to full platform admin (refunds,
// impersonation, password resets). Admin promotion now lives ONLY in the
// SETUP_SECRET-gated bootstrap/seedAdminUser path. Still: delete SETUP_SECRET
// from the environment once setup is complete — before flipping Stripe to live.
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
    data: { isAgency: true, agencyName: agencyName || account.name || "My Agency" },
  });
  return NextResponse.json({ ok: true });
}
