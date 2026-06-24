import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, enforceRateLimit } from "@/lib/rateLimit";
import { createResetToken } from "@/lib/passwordReset";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

// Always the SAME body whether or not the account exists — prevents email
// enumeration. The actual send happens only for a real, enabled, password-holding
// account (managed agency clients have no password and can't sign in directly).
// Returns a fresh response per call (a NextResponse body is a one-shot stream).
const generic = () =>
  NextResponse.json({ ok: true, message: "If an account exists for that email, we've sent a password reset link." });

export async function POST(req: Request) {
  const limited = await enforceRateLimit(`forgot:${clientIp(req)}`, 5, 900); // 5 / 15 min per IP
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return generic(); // don't leak validation detail

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.passwordHash && !user.disabled && !user.managedByAgencyId) {
    try {
      const raw = await createResetToken(user.id);
      const base = process.env.NEXTAUTH_URL || "https://www.creditvector.app";
      const link = `${base}/reset-password?token=${raw}`;
      await sendEmail({
        to: user.email,
        subject: "Reset your CreditVector password",
        text:
          `We received a request to reset your CreditVector password.\n\n` +
          `Reset it here (this link expires in 1 hour):\n${link}\n\n` +
          `If you didn't request this, you can safely ignore this email — your password won't change.`,
      });
    } catch (e) {
      console.error("forgot-password send failed (non-fatal)", e);
    }
  }

  return generic();
}
