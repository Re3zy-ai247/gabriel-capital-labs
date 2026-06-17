import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireSupportUser, supportDisplayName, normalizeSupportCategory, cleanSupportText, SUPPORT_LIMITS,
} from "@/lib/support";

export const dynamic = "force-dynamic";

// GET: list tickets. ADMIN (staff) sees all; everyone else sees only their own.
export async function GET() {
  const account = await requireSupportUser();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = account.role === "ADMIN";

  const tickets = await prisma.supportTicket.findMany({
    where: isAdmin ? {} : { userId: account.id },
    orderBy: { lastActivityAt: "desc" },
    take: 200,
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json({
    isAdmin,
    tickets: tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      category: t.category,
      status: t.status,
      userName: t.userName,
      userEmail: t.userEmail,
      messageCount: t._count.messages,
      lastActivityAt: t.lastActivityAt,
      createdAt: t.createdAt,
    })),
  });
}

// POST: open a new ticket with its first message.
export async function POST(req: Request) {
  const account = await requireSupportUser();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const subject = cleanSupportText(b.subject, SUPPORT_LIMITS.subject);
  const body = cleanSupportText(b.body, SUPPORT_LIMITS.body);
  if (subject.length < 3) return NextResponse.json({ error: "Add a short subject." }, { status: 400 });
  if (body.length < 5) return NextResponse.json({ error: "Please describe the issue." }, { status: 400 });

  const name = supportDisplayName(account);
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: account.id,
      userEmail: account.email ?? "",
      userName: name,
      subject,
      category: normalizeSupportCategory(b.category),
      status: "open",
      messages: { create: { authorId: account.id, authorName: name, isStaff: false, body } },
    },
  });
  return NextResponse.json({ ok: true, id: ticket.id });
}
