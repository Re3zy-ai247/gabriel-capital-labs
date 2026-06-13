import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { decryptDocument, docCryptoReady } from "@/lib/docCrypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Streams the DECRYPTED document bytes — only to the authenticated owner. There
// is no public URL for these files; this route is the single access path and it
// checks ownership, decrypts on the fly, and forbids caching.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!docCryptoReady()) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const doc = await prisma.document.findFirst({ where: { id: params.id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let plaintext: Buffer;
  try {
    plaintext = decryptDocument({
      ciphertext: Buffer.from(doc.ciphertext),
      iv: Buffer.from(doc.iv),
      authTag: Buffer.from(doc.authTag),
    });
  } catch {
    return NextResponse.json({ error: "Could not decrypt this document." }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(plaintext), {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store, private",
    },
  });
}
