import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() });

export async function POST(req: Request) {
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
