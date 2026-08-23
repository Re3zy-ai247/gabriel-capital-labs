import { createHmac, timingSafeEqual } from "crypto";

// Password-session evidence stays inside NextAuth's encrypted JWT. It is keyed
// with the same secret that protects that JWT, domain-separated from NextAuth's
// own uses, and bound to the immutable user id so evidence cannot be transplanted
// between accounts. A fresh bcrypt hash (including a reset to the same password)
// therefore produces a fresh session version without adding database state.
const PASSWORD_SESSION_DOMAIN = "creditvector:password-session:v1";
const SESSION_VERSION_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type SessionCredentialState = {
  passwordHash: string | null;
  disabled: boolean;
  identityBlocked: boolean;
};

export type SessionCredentialStateLoader = (
  userId: string,
) => Promise<SessionCredentialState | null>;

type SessionToken = Record<string, unknown>;
type SignInEvidence = { id?: unknown; sessionVersion?: unknown } | null | undefined;

export function createPasswordSessionVersion(
  userId: unknown,
  passwordHash: unknown,
  secret: unknown,
): string | null {
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (typeof passwordHash !== "string" || passwordHash.length === 0) return null;
  if (typeof secret !== "string" || secret.length === 0) return null;

  return createHmac("sha256", secret)
    .update(PASSWORD_SESSION_DOMAIN, "utf8")
    .update("\0", "utf8")
    .update(userId, "utf8")
    .update("\0", "utf8")
    .update(passwordHash, "utf8")
    .digest("base64url");
}

export function isPasswordSessionVersion(value: unknown): value is string {
  return typeof value === "string" && SESSION_VERSION_PATTERN.test(value);
}

export function passwordSessionVersionMatches(
  userId: unknown,
  passwordHash: unknown,
  secret: unknown,
  presentedVersion: unknown,
): boolean {
  const currentVersion = createPasswordSessionVersion(userId, passwordHash, secret);
  if (!currentVersion || !isPasswordSessionVersion(presentedVersion)) return false;

  const current = Buffer.from(currentVersion, "base64url");
  const presented = Buffer.from(presentedVersion, "base64url");
  return current.length === presented.length && timingSafeEqual(current, presented);
}

function anonymousToken<T extends SessionToken>(): T {
  // NextAuth's session callback treats the absence of both fields as anonymous.
  // Returning a new empty token also prevents stale default claims (email/name)
  // from becoming a partially authenticated session.
  return {} as T;
}

/**
 * Validate both newly minted and existing password sessions against current
 * credential state. Missing, malformed, stale, deleted, blocked, or unavailable
 * evidence fails closed to an anonymous token. A disabled account retains only
 * its keyed identity/version plus an internal cancellation-only marker so a
 * session refresh cannot destroy its ability to stop billing; the session
 * callback must always project that marker to null.
 */
export async function validatePasswordSessionToken<T extends SessionToken>(
  token: T,
  signingInUser: SignInEvidence,
  secret: unknown,
  loadCredentialState: SessionCredentialStateLoader,
): Promise<T> {
  const isSignIn = signingInUser !== undefined && signingInUser !== null;
  const userId = isSignIn ? signingInUser.id : token.uid;
  const presentedVersion = isSignIn ? signingInUser.sessionVersion : token.sessionVersion;

  if (typeof userId !== "string" || userId.length === 0) return anonymousToken<T>();
  if (!isPasswordSessionVersion(presentedVersion)) return anonymousToken<T>();
  if (typeof secret !== "string" || secret.length === 0) return anonymousToken<T>();

  let current: SessionCredentialState | null;
  try {
    current = await loadCredentialState(userId);
  } catch {
    return anonymousToken<T>();
  }

  // Strict comparisons make malformed/partial database evidence deny access.
  if (
    !current ||
    (current.disabled !== false && current.disabled !== true) ||
    current.identityBlocked !== false
  ) {
    return anonymousToken<T>();
  }
  if (!passwordSessionVersionMatches(userId, current.passwordHash, secret, presentedVersion)) {
    return anonymousToken<T>();
  }

  if (current.disabled) {
    return {
      uid: userId,
      sessionVersion: presentedVersion,
      cancellationOnly: true,
    } as unknown as T;
  }

  // A cancellation-only cookie never regains application access merely because
  // an admin re-enabled the row. Require a fresh successful sign-in, whose user
  // evidence is independently rechecked above, before minting an active session.
  if (!isSignIn && token.cancellationOnly === true) return anonymousToken<T>();

  const activeToken: SessionToken = { ...token };
  delete activeToken.cancellationOnly;
  return { ...activeToken, uid: userId, sessionVersion: presentedVersion } as unknown as T;
}
