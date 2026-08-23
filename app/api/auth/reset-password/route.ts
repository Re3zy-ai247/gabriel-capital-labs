import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { clientIp, enforceRateLimit } from "@/lib/rateLimit";
import { completePasswordReset } from "@/lib/passwordReset";
import { validatePassword } from "@/lib/password";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(32), password: z.string() });

export async function POST(req: Request) {
  const limited = await enforceRateLimit(`reset:${clientIp(req)}`, 10, 900); // 10 / 15 min per IP
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { token, password } = parsed.data;
  const pwErr = validatePassword(password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  // Token claim, credential binding, password write CAS, and sibling cleanup are
  // one fail-closed primitive. The bcrypt work runs only after evidence is current.
  const completed = await completePasswordReset(token, () => bcrypt.hash(password, 10));
  if (!completed) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
