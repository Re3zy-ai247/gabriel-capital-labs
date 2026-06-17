import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { canAccessCommunity } from "@/lib/community";
import { loadAttachment, docCryptoReady } from "@/lib/attachments";
import { isImageMime } from "@/lib/attachmentsShared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Streams a decrypted attachment back to an authorized viewer. Attachments are
// never public: support files are visible to the ticket owner + staff; community
// files to any Community member. Anything else gets a 404 (don't leak existence).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!docCryptoReady()) return NextResponse.json({ error: "Attachment storage unavailable" }, { status: 503 });

  const att = await loadAttachment(params.id);
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Authorize by the owning record.
  let allowed = false;
  if (att.scope === "support_message") {
    const msg = await prisma.supportTicketMessage.findUnique({
      where: { id: att.refId },
      select: { ticket: { select: { userId: true } } },
    });
    allowed = !!msg && (account.role === "ADMIN" || msg.ticket?.userId === account.id);
  } else if (att.scope === "community_thread" || att.scope === "community_reply") {
    allowed = canAccessCommunity(account);
  }
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Images render inline (thumbnails / preview); other files download.
  const disposition = isImageMime(att.mimeType) ? "inline" : "attachment";
  const filename = att.filename.replace(/"/g, "");
  return new Response(new Uint8Array(att.bytes), {
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      "Content-Length": String(att.bytes.length),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
