import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One-time, SETUP_SECRET-gated creation of the master owner account: a
// username-login admin with agency powers. Idempotent on email. Delete
// SETUP_SECRET (or this route) once the account exists.
export async function POST(req: Request) {
  const setup = process.env.SETUP_SECRET;
  if (!setup) return NextResponse.json({ error: "SETUP_SECRET not configured." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  if (String(body.secret || "") !== setup) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const username = String(body.username || "ceogabriel").trim().toLowerCase();
  const email = String(body.email || `${username}@gabrielcapitallabs.com`).trim().toLowerCase();
  const name = String(body.name || "CEOGABRIEL");
  const password = String(body.password || "");
  if (password.length < 10) {
    return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { username, name, passwordHash, role: "ADMIN", isAgency: true, agencyName: name },
    create: {
      email,
      username,
      name,
      passwordHash,
      role: "ADMIN",
      isAgency: true,
      agencyName: name,
      plan: "premium",
    },
    select: { id: true, email: true, username: true, role: true, isAgency: true },
  });

  return NextResponse.json({ ok: true, user });
}
