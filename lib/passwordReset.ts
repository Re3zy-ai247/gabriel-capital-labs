import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";

// Self-service password reset tokens. The raw token is emailed to the user and
// NEVER stored — only its sha256 hash lives in the DB, so a database read can't be
// used to take over an account. Tokens are single-use and short-lived.

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Self-heal: the table creates itself at runtime via CREATE TABLE IF NOT EXISTS
// (works through Accelerate even though build-time `prisma db push` doesn't) —
// mirrors ensureRateLimitTable / ensureCommunityTables.
let tableReady = false;
export async function ensurePasswordResetTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
       "tokenHash" TEXT NOT NULL,
       "expiresAt" TIMESTAMP(3) NOT NULL,
       "usedAt" TIMESTAMP(3),
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId")`
  );
  tableReady = true;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Issue a single-use reset token for a user. Invalidates the user's prior tokens
// (one live link at a time), then returns the RAW token for the emailed link.
export async function createResetToken(userId: string): Promise<string> {
  await ensurePasswordResetTable();
  const raw = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return raw;
}

// Verify + consume a raw token. Returns the userId when valid (exists, not used,
// not expired) and marks it used; returns null otherwise. Single-use.
export async function consumeResetToken(raw: string): Promise<string | null> {
  await ensurePasswordResetTable();
  if (!raw || raw.length < 32) return null;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  await prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}
