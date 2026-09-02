import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupportUser, supportCategoryLabel } from "@/lib/support";
import { listAttachments } from "@/lib/attachments";

export const dynamic = "force-dynamic";

// GET: a ticket + its messages. Owner or ADMIN only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireSupportUser();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = account.role === "ADMIN";

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && ticket.userId !== account.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachments = await listAttachments("support_message", ticket.messages.map((m) => m.id));

  return NextResponse.json({
    isAdmin,
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      categoryLabel: supportCategoryLabel(ticket.category),
      status: ticket.status,
      userName: ticket.userName,
      userEmail: ticket.userEmail,
      createdAt: ticket.createdAt,
      messages: ticket.messages.map((m) => ({
        id: m.id, authorName: m.authorName, isStaff: m.isStaff, body: m.body, createdAt: m.createdAt,
        attachments: attachments[m.id] || [],
      })),
    },
  });
}

// PATCH: ADMIN updates the ticket status (open | responded | closed).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireSupportUser();
  if (!account || account.role !== "ADMIN") return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const status = ["open", "responded", "closed"].includes(b.status) ? b.status : null;
  if (!status) return NextResponse.json({ error: "Bad status" }, { status: 400 });
  const { id } = await params;
  await prisma.supportTicket.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true });
}
