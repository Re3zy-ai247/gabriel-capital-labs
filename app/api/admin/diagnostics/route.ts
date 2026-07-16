import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const RELEASE = (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 12);

// Production configuration diagnostics (RC1 P0-2), ADMIN-ONLY. Reports env-var PRESENCE
// (booleans only — a value is NEVER returned), the release SHA, node version, and DB reachability.
// Lets the founder verify prod config (e.g. is COMPANY_POSTAL_ADDRESS set?) without exposing secrets.
const EXPECTED_ENV = [
  "DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY", "RESEND_API_KEY", "RESEND_FROM", "CRON_SECRET", "COMPANY_POSTAL_ADDRESS",
  "DOCUMENT_ENCRYPTION_KEY", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "ALERT_WEBHOOK_URL", "MAIL_LIVE", "KERNEL_DURABLE",
];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const envPresent: Record<string, boolean> = {};
  for (const k of EXPECTED_ENV) envPresent[k] = Boolean(process.env[k]);

  let db = "unknown";
  try { await prisma.$queryRaw`SELECT 1`; db = "ok"; } catch { db = "unreachable"; }

  return NextResponse.json({
    release: RELEASE,
    node: process.version,
    db,
    envPresent, // booleans only — never the values
    time: new Date().toISOString(),
  });
}
