import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupportUser, supportDisplayName, cleanSupportText, SUPPORT_LIMITS } from "@/lib/support";
import { filesFromForm, validateFiles, saveAttachments } from "@/lib/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST: add a message to a ticket. Owner replies (status -> open) or ADMIN replies
// as staff (status -> responded). Closed tickets are read-only for the owner.
// Accepts multipart/form-data so a reply can carry image/PDF attachments.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await requireSupportUser();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = account.role === "ADMIN";

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && ticket.userId !== account.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.status === "closed" && !isAdmin) return NextResponse.json({ error: "This ticket is closed." }, { status: 400 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const body = cleanSupportText(form.get("body"), SUPPORT_LIMITS.body);
  const { ok: files, error: fileError } = await validateFiles(filesFromForm(form));
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
  // A reply needs either text or at least one attachment.
  if (body.length < 1 && files.length === 0) {
    return NextResponse.json({ error: "Write a message or attach a file." }, { status: 400 });
  }

  const name = isAdmin ? "CreditVector Support" : supportDisplayName(account);
  const message = await prisma.supportTicketMessage.create({
    data: { ticketId: ticket.id, authorId: account.id, authorName: name, isStaff: isAdmin, body },
  });
  if (files.length) {
    try {
      await saveAttachments({ scope: "support_message", refId: message.id, uploaderId: account.id, files });
    } catch (e) {
      console.error("support attachment save failed", e);
    }
  }
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { lastActivityAt: new Date(), status: isAdmin ? "responded" : "open" },
  });
  return NextResponse.json({ ok: true });
}
