import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { canAccessCommunity } from "@/lib/community";
import { loadAttachment, decryptAttachment, docCryptoReady } from "@/lib/attachments";
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

  // Authorize by the owning record BEFORE decrypting (loadAttachment returns the
  // bytes still encrypted, so an unauthorized request never triggers crypto work).
  // The community branches also confirm the parent still exists, so a deleted
  // post's attachments stop being downloadable even if a stray row survives.
  let allowed = false;
  if (att.scope === "support_message") {
    const msg = await prisma.supportTicketMessage.findUnique({
      where: { id: att.refId },
      select: { ticket: { select: { userId: true } } },
    });
    allowed = !!msg && (account.role === "ADMIN" || msg.ticket?.userId === account.id);
  } else if (att.scope === "community_thread") {
    if (canAccessCommunity(account)) {
      const thread = await prisma.communityThread.findUnique({ where: { id: att.refId }, select: { id: true } });
      allowed = !!thread;
    }
  } else if (att.scope === "community_reply") {
    if (canAccessCommunity(account)) {
      const reply = await prisma.communityReply.findUnique({ where: { id: att.refId }, select: { id: true } });
      allowed = !!reply;
    }
  }
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = decryptAttachment(att);

  // Images render inline (thumbnails / preview); other files download. Harden the
  // response so user-controlled bytes can't be sniffed into an executable type:
  // nosniff pins the declared Content-Type, the sandbox CSP neuters any script if a
  // payload were mislabeled as an image, and DENY blocks framing.
  const disposition = isImageMime(att.mimeType) ? "inline" : "attachment";
  const filename = att.filename.replace(/"/g, "");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      // no-store, not private/max-age. These bytes are decrypted user uploads —
      // bureau letters, IDs, dispute evidence — released only after an ownership
      // check. A one-hour browser cache outlived the session that authorized it:
      // after logout (or on a shared or borrowed device) the file was still served
      // from disk cache with no further authorization. The sibling document route
      // already used no-store; this one did not. Re-fetching costs a decrypt, which
      // is the correct price for authenticated bytes.
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Frame-Options": "DENY",
    },
  });
}
