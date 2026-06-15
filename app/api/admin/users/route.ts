import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/users?q=&limit= — search the real account base (excludes
// agency-managed client rows, which aren't standalone accounts).
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(100, Number(url.searchParams.get("limit")) || 50);

  const where = {
    managedByAgencyId: null as string | null,
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { username: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      plan: true,
      isAgency: true,
      disabled: true,
      subscriptionStatus: true,
      createdAt: true,
      _count: { select: { letters: true, reports: true, managedClients: true } },
    },
  });

  return NextResponse.json({ users });
}
