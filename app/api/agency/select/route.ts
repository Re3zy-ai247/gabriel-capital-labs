import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { currentAccount, WORKSPACE_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { clientId } opens a client's workspace; POST { clientId: null } exits
// back to the agency. The cookie is only set after verifying ownership.
export async function POST(req: Request) {
  const agency = await currentAccount();
  if (!agency) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!agency.isAgency) return NextResponse.json({ error: "Not an agency account." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const clientId = body?.clientId;

  if (!clientId) {
    const cookieStore = await cookies();
    cookieStore.delete(WORKSPACE_COOKIE);
    return NextResponse.json({ ok: true, client: null });
  }

  const client = await prisma.user.findFirst({
    where: { id: String(clientId), managedByAgencyId: agency.id },
    select: { id: true, fullName: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, client.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h working session
  });
  return NextResponse.json({ ok: true, client: { id: client.id, name: client.fullName } });
}
