import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET: the most recent admin audit entries.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const limit = Math.min(200, Number(new URL(req.url).searchParams.get("limit")) || 100);
  const entries = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ entries });
}
