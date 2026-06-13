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
