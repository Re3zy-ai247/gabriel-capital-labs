import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Authenticated symmetric encryption for uploaded identity documents (gov ID,
// SSN card, proof of address). We store the ciphertext, a per-record IV, and the
// GCM auth tag in Postgres — the plaintext image bytes never touch disk and are
// never exposed via a public URL. The key lives only in DOCUMENT_ENCRYPTION_KEY
// (32-byte hex) in the server environment.

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("DOCUMENT_ENCRYPTION_KEY is not set — document storage is disabled.");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("DOCUMENT_ENCRYPTION_KEY must be 32 bytes (64 hex chars).");
  }
  return key;
}

// True when encryption is configured — lets routes return a clean 503 instead of
// throwing when the key is absent (e.g. a misconfigured deploy).
export function docCryptoReady(): boolean {
  const hex = process.env.DOCUMENT_ENCRYPTION_KEY;
  return !!hex && Buffer.from(hex, "hex").length === 32;
}

export interface EncryptedBlob {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function encryptDocument(plaintext: Buffer): EncryptedBlob {
  const iv = randomBytes(12); // 96-bit nonce, recommended for GCM
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decryptDocument(blob: EncryptedBlob): Buffer {
  const decipher = createDecipheriv(ALGO, getKey(), blob.iv);
  decipher.setAuthTag(blob.authTag);
  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
}

// String-at-rest encryption for credit-report PII (Report.rawText). Same
// AES-256-GCM key/cipher as the document helpers, but serialized into a single
// self-describing column value so no schema change is needed. Format:
//   "cv1:" + base64(iv) + "." + base64(authTag) + "." + base64(ciphertext)
// The "cv1:" prefix lets readers tell ciphertext from legacy plaintext rows.
const TEXT_PREFIX = "cv1:";

// True when a stored value is one of our encrypted strings (vs legacy plaintext).
export function isEncryptedText(s: string | null | undefined): boolean {
  return !!s && s.startsWith(TEXT_PREFIX);
}

export function encryptText(plaintext: string): string {
  if (!plaintext) return plaintext; // empty string / falsy passes through unchanged
  const iv = randomBytes(12); // 96-bit nonce, recommended for GCM
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return (
    TEXT_PREFIX +
    iv.toString("base64") +
    "." +
    authTag.toString("base64") +
    "." +
    ciphertext.toString("base64")
  );
}

// Dual-read: decrypts our "cv1:" values; returns anything else verbatim so
// existing plaintext rows (and the demo seed) keep working. A "cv1:" value that
// is malformed or fails the GCM auth check throws rather than returning garbage.
export function decryptText(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(TEXT_PREFIX)) return stored; // legacy plaintext
  const parts = stored.slice(TEXT_PREFIX.length).split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted text: expected 3 base64 parts.");
  }
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
