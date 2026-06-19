import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireSupportUser, supportDisplayName, normalizeSupportCategory, cleanSupportText, SUPPORT_LIMITS,
} from "@/lib/support";
import { filesFromForm, validateFiles, saveAttachments } from "@/lib/attachments";
import { enforceRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

// POST: open a new ticket with its first message. Accepts multipart/form-data so
// the first message can carry image/PDF attachments.
export async function POST(req: Request) {
  const account = await requireSupportUser();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Per-account cap on ticket creation to curb spam.
  const limited = await enforceRateLimit(`support:${account.id}`, 10, 3600);
  if (limited) return limited;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const subject = cleanSupportText(form.get("subject"), SUPPORT_LIMITS.subject);
  const body = cleanSupportText(form.get("body"), SUPPORT_LIMITS.body);
  if (subject.length < 3) return NextResponse.json({ error: "Add a short subject." }, { status: 400 });
  if (body.length < 5) return NextResponse.json({ error: "Please describe the issue." }, { status: 400 });

  const { ok: files, error: fileError } = await validateFiles(filesFromForm(form));
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const name = supportDisplayName(account);
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: account.id,
      userEmail: account.email ?? "",
      userName: name,
      subject,
      category: normalizeSupportCategory(form.get("category")),
      status: "open",
      messages: { create: { authorId: account.id, authorName: name, isStaff: false, body } },
    },
    include: { messages: true },
  });

  if (files.length && ticket.messages[0]) {
    try {
      await saveAttachments({ scope: "support_message", refId: ticket.messages[0].id, uploaderId: account.id, files });
    } catch (e) {
      console.error("support attachment save failed", e);
    }
  }
  return NextResponse.json({ ok: true, id: ticket.id });
}
