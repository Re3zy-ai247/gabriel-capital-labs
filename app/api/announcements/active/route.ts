import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public: the most recent active announcement (if any), for the in-app banner.
export async function GET() {
  try {
    const a = await prisma.announcement.findFirst({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, body: true, tone: true },
    });
    return NextResponse.json({ announcement: a });
  } catch {
    // Table may not exist yet pre-migration — fail open with no banner.
    return NextResponse.json({ announcement: null });
  }
}
