import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { isDemoIdentityBlocked } from "./demoIdentity";

// Self-service password reset tokens. The raw token is emailed to the user and
// NEVER stored — only its sha256 hash lives in the DB, so a database read can't be
// used to take over an account. Tokens are single-use and short-lived.

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const PASSWORD_RESET_DOMAIN = "creditvector:password-reset:v1";
const RESET_NONCE_PATTERN = /^[a-f0-9]{64}$/;
const RESET_EVIDENCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

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

type ParsedResetToken = { nonce: string; credentialEvidence: string };

function parseResetToken(raw: unknown): ParsedResetToken | null {
  if (typeof raw !== "string") return null;
  const [nonce, credentialEvidence, extra] = raw.split(".");
  if (extra !== undefined) return null;
  if (!RESET_NONCE_PATTERN.test(nonce ?? "")) return null;
  if (!RESET_EVIDENCE_PATTERN.test(credentialEvidence ?? "")) return null;
  return { nonce, credentialEvidence };
}

// The emailed link carries keyed evidence, not a password-hash derivative. The
// per-link nonce keeps even two links for the same credential state unlinkable,
// while the domain and immutable user id prevent cross-purpose/account reuse.
export function createPasswordResetEvidence(
  userId: unknown,
  passwordHash: unknown,
  nonce: unknown,
  secret: unknown,
): string | null {
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (typeof passwordHash !== "string" || passwordHash.length === 0) return null;
  if (typeof nonce !== "string" || !RESET_NONCE_PATTERN.test(nonce)) return null;
  if (typeof secret !== "string" || secret.length === 0) return null;

  return createHmac("sha256", secret)
    .update(PASSWORD_RESET_DOMAIN, "utf8")
    .update("\0", "utf8")
    .update(userId, "utf8")
    .update("\0", "utf8")
    .update(nonce, "utf8")
    .update("\0", "utf8")
    .update(passwordHash, "utf8")
    .digest("base64url");
}

export function passwordResetEvidenceMatches(
  userId: unknown,
  passwordHash: unknown,
  nonce: unknown,
  secret: unknown,
  presentedEvidence: unknown,
): boolean {
  const current = createPasswordResetEvidence(userId, passwordHash, nonce, secret);
  if (!current || typeof presentedEvidence !== "string" || !RESET_EVIDENCE_PATTERN.test(presentedEvidence)) {
    return false;
  }
  const currentBytes = Buffer.from(current, "base64url");
  const presentedBytes = Buffer.from(presentedEvidence, "base64url");
  return currentBytes.length === presentedBytes.length && timingSafeEqual(currentBytes, presentedBytes);
}

// Narrow store contract keeps the atomic claim executable in a database-free
// regression harness while production still defaults to Prisma's real delegate.
export interface PasswordResetTokenStore {
  updateMany(args: {
    where: {
      tokenHash: string;
      usedAt: null;
      expiresAt: { gt: Date };
    };
    data: { usedAt: Date };
  }): Promise<{ count: number }>;
  findUnique(args: {
    where: { tokenHash: string };
    select: { userId: true };
  }): Promise<{ userId: string } | null>;
}

export interface PasswordResetCompletionTokenStore extends PasswordResetTokenStore {
  revokeAllForUser(userId: string): Promise<{ count: number }>;
}

export interface PasswordResetCredentialStore {
  findUnique(args: {
    where: { id: string };
    select: { passwordHash: true; disabled: true; email: true };
  }): Promise<{ passwordHash: string | null; disabled: boolean; email: string } | null>;
  updateMany(args: {
    where: { id: string; passwordHash: string; disabled: false };
    data: { passwordHash: string };
  }): Promise<{ count: number }>;
}

export type PasswordResetClaim = ParsedResetToken & { userId: string };

export type PasswordResetCompletionDependencies = {
  secret: unknown;
  nodeEnv: string | undefined;
  tokenStore: PasswordResetCompletionTokenStore;
  credentialStore: PasswordResetCredentialStore;
};

async function lockPasswordResetUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<boolean> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
  `;
  return locked.length === 1 && locked[0]?.id === userId;
}

// Disabled-state transitions are security events for password-reset
// capabilities. The shared User-row lock serializes this revocation with both
// token issuance and redemption. Revocation happens before the caller's update,
// while the account is still disabled on re-enable; any error rolls the whole
// transaction back, so an account cannot be enabled without established
// revocation.
export async function withPasswordResetRevocation<T>(
  userId: string,
  transition: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  await ensurePasswordResetTable();
  return prisma.$transaction(async (tx) => {
    if (!(await lockPasswordResetUser(tx, userId))) {
      throw new Error("Password-reset revocation target no longer exists.");
    }
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    return transition(tx);
  });
}

// Issue a single-use reset token for an enabled password account. The shared
// User-row lock makes delete-then-create atomic against sibling issuers and
// disabled-state transitions. Final redemption still uses a credential-state CAS
// and invalidates every outstanding sibling after its one winner.
export async function createResetToken(userId: string): Promise<string> {
  await ensurePasswordResetTable();
  return prisma.$transaction(async (tx) => {
    if (!(await lockPasswordResetUser(tx, userId))) {
      throw new Error("Password reset is unavailable for this account.");
    }
    const account = await tx.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, disabled: true, email: true },
    });
    if (
      !account ||
      account.disabled !== false ||
      !account.passwordHash ||
      isDemoIdentityBlocked(process.env.NODE_ENV, account.email)
    ) {
      throw new Error("Password reset is unavailable for this account.");
    }

    const nonce = randomBytes(32).toString("hex");
    const credentialEvidence = createPasswordResetEvidence(
      userId,
      account.passwordHash,
      nonce,
      process.env.NEXTAUTH_SECRET,
    );
    if (!credentialEvidence) throw new Error("Password reset signing key is unavailable.");
    const raw = `${nonce}.${credentialEvidence}`;
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });
    return raw;
  });
}

// Verify + consume a raw token. Returns its claimed user/evidence when valid and
// atomically marks it used; returns null otherwise. Credential-state validation
// happens at the final password-write CAS in completePasswordReset().
export async function consumeResetToken(
  raw: string,
  store?: PasswordResetTokenStore,
): Promise<PasswordResetClaim | null> {
  const parsed = parseResetToken(raw);
  if (!parsed) return null;
  if (!store) {
    await ensurePasswordResetTable();
    store = prisma.passwordResetToken as unknown as PasswordResetTokenStore;
  }
  const tokenHash = hashToken(raw);
  const claimedAt = new Date();

  // One conditional UPDATE is the single-use decision. The previous read then
  // update sequence let two concurrent requests both observe usedAt=null and both
  // reset the password. Only one caller can now change null to claimedAt.
  const claimed = await store.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: claimedAt } },
    data: { usedAt: claimedAt },
  });
  if (claimed.count !== 1) return null;

  const row = await store.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  return typeof row?.userId === "string" && row.userId.length > 0
    ? { userId: row.userId, ...parsed }
    : null;
}

async function completePasswordResetAgainstStores(
  raw: string,
  createNewPasswordHash: () => Promise<string>,
  secret: string,
  nodeEnv: string | undefined,
  tokenStore: PasswordResetCompletionTokenStore,
  credentialStore: PasswordResetCredentialStore,
  expectedUserId?: string,
  cleanupAfterChange = true,
): Promise<boolean> {
  const claim = await consumeResetToken(raw, tokenStore);
  if (!claim || (expectedUserId !== undefined && claim.userId !== expectedUserId)) return false;

  const account = await credentialStore.findUnique({
    where: { id: claim.userId },
    select: { passwordHash: true, disabled: true, email: true },
  });
  if (
    !account ||
    account.disabled !== false ||
    !account.passwordHash ||
    isDemoIdentityBlocked(nodeEnv, account.email) ||
    !passwordResetEvidenceMatches(
      claim.userId,
      account.passwordHash,
      claim.nonce,
      secret,
      claim.credentialEvidence,
    )
  ) {
    return false;
  }

  const nextPasswordHash = await createNewPasswordHash();
  if (typeof nextPasswordHash !== "string" || nextPasswordHash.length === 0) return false;

  const changed = await credentialStore.updateMany({
    where: { id: claim.userId, passwordHash: account.passwordHash, disabled: false },
    data: { passwordHash: nextPasswordHash },
  });
  if (changed.count !== 1) return false;

  if (cleanupAfterChange) {
    // The password rotation already invalidates every sibling's keyed evidence.
    // Deleting their rows is hygiene, not the success decision: a cleanup outage
    // must not tell the caller the reset failed after the password actually changed.
    try {
      await tokenStore.revokeAllForUser(claim.userId);
    } catch {
      console.error("password-reset sibling cleanup failed after credential rotation");
    }
  }
  return true;
}

// Redeem a reset capability against the same credential state that issued it.
// Production redemption first locates the account, then takes the same User-row
// lock used by token issuance and disabled-state transitions. The atomic token
// claim and final credential/disabled CAS remain the authority decisions.
export async function completePasswordReset(
  raw: string,
  createNewPasswordHash: () => Promise<string>,
  dependencies?: PasswordResetCompletionDependencies,
): Promise<boolean> {
  const secret = dependencies ? dependencies.secret : process.env.NEXTAUTH_SECRET;
  if (typeof secret !== "string" || secret.length === 0) return false;

  if (dependencies) {
    return completePasswordResetAgainstStores(
      raw,
      createNewPasswordHash,
      secret,
      dependencies.nodeEnv,
      dependencies.tokenStore,
      dependencies.credentialStore,
    );
  }

  const parsed = parseResetToken(raw);
  if (!parsed) return false;
  await ensurePasswordResetTable();
  const tokenHash = hashToken(raw);
  const located = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  if (typeof located?.userId !== "string" || located.userId.length === 0) return false;

  const outcome = await prisma.$transaction(async (tx) => {
    if (!(await lockPasswordResetUser(tx, located.userId))) return false;
    // Snapshot exact row ids while holding the issuance/state-transition lock.
    // Post-commit cleanup can then avoid deleting a fresh link issued after this
    // reset committed and released the lock.
    const staleRows = await tx.passwordResetToken.findMany({
      where: { userId: located.userId },
      select: { id: true },
    });
    const transactionTokenStore: PasswordResetCompletionTokenStore = {
      updateMany: (args) => tx.passwordResetToken.updateMany(args),
      findUnique: (args) => tx.passwordResetToken.findUnique(args),
      // The explicit PasswordResetToken delegate keeps Consumer-deletion
      // containment statically provable across this helper boundary.
      revokeAllForUser: (userId) => tx.passwordResetToken.deleteMany({ where: { userId } }),
    };
    const completed = await completePasswordResetAgainstStores(
      raw,
      createNewPasswordHash,
      secret,
      process.env.NODE_ENV,
      transactionTokenStore,
      tx.user as unknown as PasswordResetCredentialStore,
      located.userId,
      false,
    );
    return completed ? staleRows.map((row) => row.id) : false;
  });
  if (outcome === false) return false;

  // Credential rotation and token claim have committed. Sibling deletion is
  // best-effort and targets only the rows snapshotted under the lock: stale
  // evidence cannot authorize, and a cleanup outage cannot turn real success
  // into a false error response.
  try {
    if (outcome.length > 0) {
      await prisma.passwordResetToken.deleteMany({ where: { id: { in: outcome } } });
    }
  } catch {
    console.error("password-reset sibling cleanup failed after credential rotation");
  }
  return true;
}
