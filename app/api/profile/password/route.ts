import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import { validatePassword } from "@/lib/password";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Change the SIGNED-IN account's password (never a managed client's). Requires
// the current password and enforces the password policy on the new one.
export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(`profile-password:${account.id}`, 10, 900); // current-password brute-force guard
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  if (!account.passwordHash) {
    return NextResponse.json({ error: "This account has no password set." }, { status: 400 });
  }
  const ok = await bcrypt.compare(currentPassword, account.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });

  const policyError = validatePassword(newPassword);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  if (await bcrypt.compare(newPassword, account.passwordHash)) {
    return NextResponse.json({ error: "New password must be different from the current one." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: account.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
  return NextResponse.json({ ok: true });
}
