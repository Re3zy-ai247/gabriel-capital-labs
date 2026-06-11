import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";

export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tradelines = await prisma.tradeline.findMany({
    where: { userId: user.id },
    orderBy: [{ score: "desc" }],
  });
  return NextResponse.json({ tradelines });
}
