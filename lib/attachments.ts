import { prisma } from "./prisma";
import { encryptDocument, decryptDocument, docCryptoReady, type EncryptedBlob } from "./docCrypto";
import {
  ATTACH_LIMITS, ALLOWED_MIME, isAllowedMime, isImageMime, type AttachmentMeta,
} from "./attachmentsShared";

export { ATTACH_LIMITS, ALLOWED_MIME, isAllowedMime, isImageMime, type AttachmentMeta };
export { docCryptoReady };

// Encrypted attachments for support tickets and community posts. Bytes are stored
// AES-256-GCM-encrypted (same scheme + key as identity Documents, lib/docCrypto.ts)
// and never served from a public URL — only streamed back through an
// ownership/membership-checked route (app/api/attachments/[id]).
//
// `scope` + `refId` point at the owning record:
//   support_message  -> SupportTicketMessage.id
//   community_thread -> CommunityThread.id
//   community_reply  -> CommunityReply.id

export type AttachScope = "support_message" | "community_thread" | "community_reply";

// Self-heal: the Attachment table creates itself at runtime. CREATE TABLE IF NOT
// EXISTS via raw SQL works through the Accelerate proxy even though build-time
// `prisma db push` does not — so attachments work with no manual migrate. The
// Bytes columns are written through the typed client (proven by Document).
let tableReady = false;
export async function ensureAttachmentTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "Attachment" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "scope" TEXT NOT NULL,
       "refId" TEXT NOT NULL,
       "uploaderId" TEXT,
       "filename" TEXT NOT NULL,
       "mimeType" TEXT NOT NULL,
       "byteSize" INTEGER NOT NULL,
       "ciphertext" BYTEA NOT NULL,
       "iv" BYTEA NOT NULL,
       "authTag" BYTEA NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Attachment_scope_refId_idx" ON "Attachment"("scope", "refId")`
  );
  tableReady = true;
}

// Strip any path and hard-cap the length so a hostile filename can't break the UI
// or a Content-Disposition header.
function safeName(name: string): string {
  const base = (name || "file").split(/[\\/]/).pop() || "file";
  return base.replace(/[\r\n"]/g, "").slice(0, 120) || "file";
}

export interface FileValidation {
  ok: File[];
  error?: string;
}

// Validate a set of uploaded files against the type/size/count limits. Returns the
// accepted files (all-or-nothing) plus a human error when something is rejected.
export function validateFiles(files: File[]): FileValidation {
  if (files.length === 0) return { ok: [] };
  if (files.length > ATTACH_LIMITS.maxPerPost) {
    return { ok: [], error: `You can attach up to ${ATTACH_LIMITS.maxPerPost} files per message.` };
  }
  for (const f of files) {
    if (!isAllowedMime(f.type)) {
      return { ok: [], error: `"${f.name}" isn't a supported file. Attach images or PDFs.` };
    }
    if (f.size === 0) return { ok: [], error: `"${f.name}" is empty.` };
    if (f.size > ATTACH_LIMITS.maxBytes) {
      return { ok: [], error: `"${f.name}" is too large (max ${ATTACH_LIMITS.maxBytes / (1024 * 1024)}MB).` };
    }
  }
  return { ok: files };
}

// Pull the File[] out of a multipart form's "files" field, ignoring empty slots.
export function filesFromForm(form: FormData): File[] {
  return form
    .getAll("files")
    .filter((v): v is File => v instanceof File && v.size > 0);
}

// Encrypt + persist the given files for a parent record. Returns the saved metas
// for immediate render. Throws only on a genuine DB/crypto failure — callers
// should validate first and treat a throw as "message saved, attachments failed".
export async function saveAttachments(opts: {
  scope: AttachScope;
  refId: string;
  uploaderId?: string | null;
  files: File[];
}): Promise<AttachmentMeta[]> {
  if (!opts.files.length) return [];
  await ensureAttachmentTable();
  const metas: AttachmentMeta[] = [];
  for (const file of opts.files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const blob: EncryptedBlob = encryptDocument(buf);
    const row = await prisma.attachment.create({
      data: {
        scope: opts.scope,
        refId: opts.refId,
        uploaderId: opts.uploaderId ?? null,
        filename: safeName(file.name),
        mimeType: file.type,
        byteSize: buf.length,
        ciphertext: blob.ciphertext,
        iv: blob.iv,
        authTag: blob.authTag,
      },
      select: { id: true, filename: true, mimeType: true, byteSize: true },
    });
    metas.push({ ...row, isImage: isImageMime(row.mimeType) });
  }
  return metas;
}

// List attachment metadata for a set of parent records, grouped by refId.
export async function listAttachments(
  scope: AttachScope,
  refIds: string[]
): Promise<Record<string, AttachmentMeta[]>> {
  const out: Record<string, AttachmentMeta[]> = {};
  if (!refIds.length) return out;
  await ensureAttachmentTable();
  const rows = await prisma.attachment.findMany({
    where: { scope, refId: { in: refIds } },
    select: { id: true, refId: true, filename: true, mimeType: true, byteSize: true },
    orderBy: { createdAt: "asc" },
  });
  for (const r of rows) {
    (out[r.refId] ||= []).push({
      id: r.id,
      filename: r.filename,
      mimeType: r.mimeType,
      byteSize: r.byteSize,
      isImage: isImageMime(r.mimeType),
    });
  }
  return out;
}

export interface DecryptedAttachment {
  scope: string;
  refId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
}

// Fetch + decrypt one attachment by id (for the authenticated stream route). The
// CALLER is responsible for the ownership/membership check via scope + refId.
export async function loadAttachment(id: string): Promise<DecryptedAttachment | null> {
  await ensureAttachmentTable();
  const row = await prisma.attachment.findUnique({ where: { id } });
  if (!row) return null;
  const bytes = decryptDocument({ ciphertext: row.ciphertext as Buffer, iv: row.iv as Buffer, authTag: row.authTag as Buffer });
  return { scope: row.scope, refId: row.refId, filename: row.filename, mimeType: row.mimeType, bytes };
}
