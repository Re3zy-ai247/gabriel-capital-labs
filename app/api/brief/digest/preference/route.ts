import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { ensureDigestColumn } from "@/lib/briefDigest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Read/write the signed-in account's weekly-digest opt-in. Uses currentAccount()
// (the real account, never an agency's opened client) since it's an email pref.
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDigestColumn();
  const u = await prisma.user.findUnique({ where: { id: account.id }, select: { briefDigest: true } });
  return NextResponse.json({ briefDigest: Boolean(u?.briefDigest) });
}

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDigestColumn();
  const body = await req.json().catch(() => ({}));
  const subscribe = body.subscribe === true;
  await prisma.user.update({ where: { id: account.id }, data: { briefDigest: subscribe } });
  return NextResponse.json({ ok: true, briefDigest: subscribe });
}
