import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAudit } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ announcements });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim().slice(0, 160);
  const text = String(body.body || "").trim().slice(0, 1000);
  const tone = ["info", "success", "warning"].includes(body.tone) ? body.tone : "info";
  if (!title || !text) return NextResponse.json({ error: "Title and message are required." }, { status: 400 });

  const announcement = await prisma.announcement.create({ data: { title, body: text, tone } });
  await logAudit({
    actor: { id: admin.id, email: admin.email },
    action: "announcement.create",
    summary: `Published announcement: ${title}`,
    targetType: "announcement",
    targetId: announcement.id,
  });
  return NextResponse.json({ announcement });
}
