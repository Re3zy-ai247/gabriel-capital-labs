import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDemoUser, seedAdminUser, DEMO_EMAIL } from "@/lib/demoSeed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One-time setup endpoint. Creates the admin login and the demo account.
// Guarded by SETUP_SECRET so it can't be triggered by the public. Idempotent.
//
// Usage (after deploy, with env vars set in Vercel):
//   curl -X POST https://YOUR_SITE/api/admin/bootstrap \
//     -H "Content-Type: application/json" \
//     -d '{"secret":"<SETUP_SECRET>"}'
export async function POST(req: Request) {
  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return NextResponse.json(
      { error: "SETUP_SECRET is not configured on the server." },
      { status: 503 }
    );
  }

  let provided = "";
  try {
    const body = await req.json();
    provided = body?.secret ?? "";
  } catch {
    // also accept the secret via header
  }
  provided = provided || req.headers.get("x-setup-secret") || "";

  if (provided !== setupSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@gabrielcapitallabs.com";
  const adminPassword = process.env.ADMIN_PASSWORD;
  try {
    // Always seed the demo account. Seed admin only if a password is provided,
    // so missing ADMIN_PASSWORD never blocks getting the demo working.
    const tradelines = await seedDemoUser(prisma);
    let admin: { email: string; role: string } | null = null;
    if (adminPassword) {
      await seedAdminUser(prisma, adminEmail, adminPassword);
      admin = { email: adminEmail, role: "ADMIN" };
    }
    return NextResponse.json({
      ok: true,
      admin,
      demo: { email: DEMO_EMAIL, tradelines },
      message: admin
        ? "Admin and demo accounts are ready. Delete SETUP_SECRET when finished."
        : "Demo account is ready. Set ADMIN_PASSWORD and re-run to create the admin login.",
    });
  } catch (e) {
    console.error("bootstrap error", e);
    return NextResponse.json({ error: "Bootstrap failed. Check server logs." }, { status: 500 });
  }
}
