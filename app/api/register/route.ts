import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, enforceRateLimit } from "@/lib/rateLimit";

const schema = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() });

export async function POST(req: Request) {
  // Per-IP cap on account creation to blunt automated signup abuse.
  const limited = await enforceRateLimit(`register:${clientIp(req)}`, 5, 600);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Account already exists" }, { status: 409 });
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name, passwordHash: await bcrypt.hash(password, 10) },
  });
  return NextResponse.json({ ok: true, id: user.id });
}
