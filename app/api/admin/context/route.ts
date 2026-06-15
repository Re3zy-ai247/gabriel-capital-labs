import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { impersonationContext } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lightweight probe for the app shell: is the real signed-in user an admin, and
// are they currently impersonating someone?
export async function GET() {
  const admin = await requireAdmin();
  const imp = await impersonationContext();
  return NextResponse.json({
    isAdmin: Boolean(admin),
    impersonating: imp ? { active: true, email: imp.target.email, name: imp.target.name } : { active: false },
  });
}
