import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Generate a temporary password that satisfies the app's policy (10+ chars with
// upper, lower, digit, special). Returned to the admin exactly once; never logged.
function tempPassword(): string {
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const L = "abcdefghijkmnpqrstuvwxyz";
  const D = "23456789";
  const S = "!@#$%^&*?";
  const all = U + L + D + S;
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(U), pick(L), pick(D), pick(S)];
  while (chars.length < 14) chars.push(pick(all));
  // Fisher–Yates shuffle so the required classes aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// POST: reset a user's password to a fresh temporary one and return it once.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const password = tempPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash } });

  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "user.reset_password",
    summary: `Reset password for ${target.email}`,
    targetType: "user",
    targetId: target.id,
  });

  return NextResponse.json({ ok: true, tempPassword: password });
}
