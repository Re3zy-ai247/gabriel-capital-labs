import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDemoUser, seedAdminUser, DEMO_EMAIL } from "@/lib/demoSeed";
import { setupSecretAccepted } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Local-only setup endpoint. Creates the admin login and the demo account.
// Deployed bootstrap is intentionally unavailable: a repository-known demo
// password and a reusable setup secret are not acceptable launch surfaces.
//
// Usage (local development only):
//   curl -X POST http://localhost:3000/api/admin/bootstrap \
//     -H "x-setup-secret: <SETUP_SECRET>"
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!process.env.SETUP_SECRET) {
    return NextResponse.json(
      { error: "SETUP_SECRET is not configured on the server." },
      { status: 503 }
    );
  }

  // S11 · B-5. This route used to compare `provided !== setupSecret` with no
  // throttle — a length-and-first-byte short circuit, and an unbounded online
  // oracle. M-4 moved the other two SETUP_SECRET routes onto the shared helper
  // (constant-time over SHA-256 digests, throttled per source IP before any
  // comparison, fail-closed) and left this one behind. The environment guard
  // above means it is not production-reachable today, so this is defence in
  // depth against a future edit that relaxes that separate line — which is
  // exactly the defect M-4 exists to remove.
  //
  // Input is header-only now. The body-`secret` form is dropped deliberately: a
  // credential in a JSON body is not logged the way a query string is, but there
  // is no reason to keep two accepted shapes for one secret.
  if (!(await setupSecretAccepted(req))) {
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
