import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { encryptDocument, docCryptoReady } from "@/lib/docCrypto";
import type { DocType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_TYPES: DocType[] = [
  "GOV_ID_FRONT",
  "GOV_ID_BACK",
  "SSN_CARD",
  "PROOF_OF_ADDRESS",
  "UTILITY_BILL",
];
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// Metadata only — the encrypted bytes are NEVER returned here.
const META = {
  id: true,
  type: true,
  filename: true,
  mimeType: true,
  byteSize: true,
  includeInLetters: true,
  createdAt: true,
} as const;

// GET: list the signed-in user's uploaded documents (metadata only).
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const documents = await prisma.document.findMany({
    where: { userId: user.id },
    select: META,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ documents, cryptoReady: docCryptoReady() });
}

// POST: upload (or replace) one document of a given type. multipart/form-data
// with fields `type` and `file`. Bytes are encrypted before they touch the DB.
export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!docCryptoReady()) {
    return NextResponse.json({ error: "Secure document storage isn't configured yet." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const type = String(form.get("type") || "") as DocType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, WEBP, or PDF file." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (8 MB max)." }, { status: 413 });
  }

  const plaintext = Buffer.from(await file.arrayBuffer());
  if (plaintext.length === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  const { ciphertext, iv, authTag } = encryptDocument(plaintext);
  const filename = file.name.slice(0, 200) || "upload";
  // SSN cards default to EXCLUDED from letter packets; everything else defaults in.
  const includeDefault = type !== "SSN_CARD";

  const document = await prisma.document.upsert({
    where: { userId_type: { userId: user.id, type } },
    create: {
      userId: user.id,
      type,
      filename,
      mimeType: file.type,
      ciphertext,
      iv,
      authTag,
      byteSize: plaintext.length,
      includeInLetters: includeDefault,
    },
    update: {
      filename,
      mimeType: file.type,
      ciphertext,
      iv,
      authTag,
      byteSize: plaintext.length,
    },
    select: META,
  });

  return NextResponse.json({ document });
}
