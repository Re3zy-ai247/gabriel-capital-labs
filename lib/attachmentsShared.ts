// Client-safe attachment constants + pure helpers. Imported by both the browser
// (AttachmentPicker / AttachmentList) and the server (lib/attachments.ts), so it
// must NOT pull in prisma/next-only modules — see the client/server-split gotcha.

export const ATTACH_LIMITS = {
  maxBytes: 10 * 1024 * 1024, // 10 MB per file
  maxPerPost: 5, // files per message/post
};

// Images (screenshots) + PDFs — the formats consumers actually paste/upload.
export const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  isImage: boolean;
}

export function isAllowedMime(mime: string | null | undefined): boolean {
  return !!mime && ALLOWED_MIME.includes(mime.toLowerCase());
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.toLowerCase().startsWith("image/");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Authenticated stream URL for an attachment — never a public blob URL.
export function attachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}
