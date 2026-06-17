import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupportUser, supportDisplayName, cleanSupportText, SUPPORT_LIMITS } from "@/lib/support";

export const dynamic = "force-dynamic";

// POST: add a message to a ticket. Owner replies (status -> open) or ADMIN replies
// as staff (status -> responded). Closed tickets are read-only for the owner.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const account = await requireSupportUser();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = account.role === "ADMIN";

  const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && ticket.userId !== account.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.status === "closed" && !isAdmin) return NextResponse.json({ error: "This ticket is closed." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const body = cleanSupportText(b.body, SUPPORT_LIMITS.body);
  if (body.length < 1) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const name = isAdmin ? "CreditVector Support" : supportDisplayName(account);
  await prisma.supportTicketMessage.create({
    data: { ticketId: ticket.id, authorId: account.id, authorName: name, isStaff: isAdmin, body },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { lastActivityAt: new Date(), status: isAdmin ? "responded" : "open" },
  });
  return NextResponse.json({ ok: true });
}
