// Run: npx tsx scripts/password-session-revocation.test.ts
//
// Executable attack/regression coverage for password-event JWT revocation.
// The harness uses in-memory credential rows only: it never opens a database,
// authenticates an account, or mutates production state.
import { authOptions } from "../lib/auth";
import { createHash } from "node:crypto";
import {
  createPasswordSessionVersion,
  passwordSessionVersionMatches,
  validatePasswordSessionToken,
  type SessionCredentialState,
  type SessionCredentialStateLoader,
} from "../lib/sessionVersion";
import {
  completePasswordReset,
  consumeResetToken,
  createPasswordResetEvidence,
  passwordResetEvidenceMatches,
  type PasswordResetCompletionDependencies,
  type PasswordResetCompletionTokenStore,
  type PasswordResetCredentialStore,
} from "../lib/passwordReset";

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

const secret = "test-only-nextauth-secret-with-no-production-value";
const otherSecret = "different-test-only-nextauth-secret";
const userId = "user-1";
const hashBefore = "$2a$10$before-password-event";
const hashAfterReset = "$2a$10$after-password-reset";
const hashAfterChange = "$2a$10$after-password-change";
const hashAfterAdminReset = "$2a$10$after-admin-reset";

function state(
  passwordHash: string | null,
  overrides: Partial<SessionCredentialState> = {},
): SessionCredentialState {
  return {
    passwordHash,
    disabled: false,
    identityBlocked: false,
    ...overrides,
  };
}

function loader(current: SessionCredentialState | null): SessionCredentialStateLoader {
  return async (id) => (id === userId ? current : null);
}

function tokenFor(passwordHash: string, key = secret) {
  const sessionVersion = createPasswordSessionVersion(userId, passwordHash, key);
  if (!sessionVersion) throw new Error("test setup could not mint a session version");
  return { uid: userId, sessionVersion, marker: "preserved" };
}

function isAnonymousToken(token: Record<string, unknown>): boolean {
  return token.uid === undefined && token.sessionVersion === undefined;
}

function isCancellationOnlyToken(token: Record<string, unknown>): boolean {
  return token.uid === userId &&
    token.sessionVersion !== undefined &&
    token.cancellationOnly === true &&
    Object.keys(token).length === 3;
}

type ResetTokenRow = {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    usedAt: Date | null;
};

class InMemoryResetTokenStore implements PasswordResetCompletionTokenStore {
  rows: ResetTokenRow[];
  cleanupCalls = 0;
  cleanupFailure = false;

  constructor(rows: ResetTokenRow | ResetTokenRow[]) {
    this.rows = Array.isArray(rows) ? rows : [rows];
  }

  async updateMany(args: {
    where: {
      tokenHash: string;
      usedAt: null;
      expiresAt: { gt: Date };
    };
    data: { usedAt: Date };
  }): Promise<{ count: number }> {
    const row = this.rows.find((candidate) =>
      candidate.tokenHash === args.where.tokenHash &&
      candidate.usedAt === null &&
      candidate.expiresAt > args.where.expiresAt.gt
    );
    if (
      !row ||
      row.tokenHash !== args.where.tokenHash
    ) {
      return { count: 0 };
    }
    // No await before the compare-and-set: this models one atomic database
    // UPDATE ... WHERE usedAt IS NULL winner under Promise.all concurrency.
    row.usedAt = args.data.usedAt;
    return { count: 1 };
  }

  async findUnique(args: {
    where: { tokenHash: string };
    select: { userId: true };
  }): Promise<{ userId: string } | null> {
    const row = this.rows.find((candidate) => candidate.tokenHash === args.where.tokenHash);
    return row?.tokenHash === args.where.tokenHash ? { userId: row.userId } : null;
  }

  async revokeAllForUser(userId: string): Promise<{ count: number }> {
    this.cleanupCalls++;
    if (this.cleanupFailure) throw new Error("simulated reset-token cleanup outage");
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => row.userId !== userId);
    return { count: before - this.rows.length };
  }
}

type ResetCredential = {
  id: string;
  passwordHash: string | null;
  disabled: boolean;
  email: string;
};

class InMemoryResetCredentialStore implements PasswordResetCredentialStore {
  account: ResetCredential | null;
  updateAttempts = 0;

  constructor(account: ResetCredential | null) {
    this.account = account;
  }

  async findUnique(args: {
    where: { id: string };
    select: { passwordHash: true; disabled: true; email: true };
  }): Promise<{ passwordHash: string | null; disabled: boolean; email: string } | null> {
    const account = this.account;
    if (!account || account.id !== args.where.id) return null;
    // Return a snapshot, as a database query would. Later mutations simulate a
    // password/disable race between evidence validation and the final CAS.
    return {
      passwordHash: account.passwordHash,
      disabled: account.disabled,
      email: account.email,
    };
  }

  async updateMany(args: {
    where: { id: string; passwordHash: string; disabled: false };
    data: { passwordHash: string };
  }): Promise<{ count: number }> {
    this.updateAttempts++;
    const account = this.account;
    if (
      !account ||
      account.id !== args.where.id ||
      account.passwordHash !== args.where.passwordHash ||
      account.disabled !== false
    ) {
      return { count: 0 };
    }
    account.passwordHash = args.data.passwordHash;
    return { count: 1 };
  }
}

function resetTokenFor(
  passwordHash: string,
  nonce: string,
  options: { id?: string; key?: unknown } = {},
): string {
  const id = options.id ?? userId;
  const evidence = createPasswordResetEvidence(
    id,
    passwordHash,
    nonce,
    options.key === undefined ? secret : options.key,
  );
  if (!evidence) throw new Error("test setup could not mint password-reset evidence");
  return `${nonce}.${evidence}`;
}

function resetRow(
  raw: string,
  options: { id?: string; expiresAt?: Date } = {},
): ResetTokenRow {
  return {
    tokenHash: createHash("sha256").update(raw).digest("hex"),
    userId: options.id ?? userId,
    expiresAt: options.expiresAt ?? new Date(Date.now() + 60_000),
    usedAt: null,
  };
}

function resetAccount(overrides: Partial<ResetCredential> = {}): ResetCredential {
  return {
    id: userId,
    passwordHash: hashBefore,
    disabled: false,
    email: "current@example.com",
    ...overrides,
  };
}

function resetDependencies(
  tokenStore: InMemoryResetTokenStore,
  credentialStore: InMemoryResetCredentialStore,
  options?: { key: unknown },
): PasswordResetCompletionDependencies {
  return { secret: options ? options.key : secret, nodeEnv: "test", tokenStore, credentialStore };
}

async function main() {
  // Keyed, user-bound derivation: the JWT carries no stable unkeyed derivative
  // of the password hash, and evidence cannot be transplanted across accounts.
  const version = createPasswordSessionVersion(userId, hashBefore, secret);
  check("a complete credential state produces canonical version evidence", /^[A-Za-z0-9_-]{43}$/.test(version || ""));
  check("missing auth secret fails closed", createPasswordSessionVersion(userId, hashBefore, undefined) === null);
  check("missing user id fails closed", createPasswordSessionVersion("", hashBefore, secret) === null);
  check("missing password hash fails closed", createPasswordSessionVersion(userId, null, secret) === null);
  check("auth-secret rotation changes session evidence", version !== createPasswordSessionVersion(userId, hashBefore, otherSecret));
  check("session evidence is bound to the user id", version !== createPasswordSessionVersion("user-2", hashBefore, secret));
  check("current evidence matches in constant-shape validation", passwordSessionVersionMatches(userId, hashBefore, secret, version));
  check("stale evidence does not match a rotated password hash", !passwordSessionVersionMatches(userId, hashAfterReset, secret, version));

  const oldJwt = tokenFor(hashBefore);
  const validBefore = await validatePasswordSessionToken(oldJwt, undefined, secret, loader(state(hashBefore)));
  check("a session is valid before the password event", validBefore.uid === userId);
  check("valid validation preserves unrelated JWT claims", validBefore.marker === "preserved");

  // Password reset: an old JWT is refused and a token minted from the new
  // password credential state remains valid.
  const oldAfterReset = await validatePasswordSessionToken(oldJwt, undefined, secret, loader(state(hashAfterReset)));
  check("old JWT is anonymous after password reset", isAnonymousToken(oldAfterReset));
  const newAfterReset = await validatePasswordSessionToken(tokenFor(hashAfterReset), undefined, secret, loader(state(hashAfterReset)));
  check("new JWT is valid after password reset", newAfterReset.uid === userId);

  // Password change repeats the same invariant independently.
  const resetJwt = tokenFor(hashAfterReset);
  const oldAfterChange = await validatePasswordSessionToken(resetJwt, undefined, secret, loader(state(hashAfterChange)));
  check("old JWT is anonymous after password change", isAnonymousToken(oldAfterChange));
  const newAfterChange = await validatePasswordSessionToken(tokenFor(hashAfterChange), undefined, secret, loader(state(hashAfterChange)));
  check("new JWT is valid after password change", newAfterChange.uid === userId);

  // Replays remain refused; validation never consumes or refreshes stale evidence.
  const replayOne = await validatePasswordSessionToken(oldJwt, undefined, secret, loader(state(hashAfterReset)));
  const replayTwo = await validatePasswordSessionToken(oldJwt, undefined, secret, loader(state(hashAfterReset)));
  check("replayed stale JWT is refused every time", isAnonymousToken(replayOne) && isAnonymousToken(replayTwo));

  // Two concurrent password events leave only evidence for the final credential
  // state valid; neither the original nor the intermediate token survives.
  const intermediateJwt = tokenFor(hashAfterReset);
  const [concurrentOld, concurrentIntermediate, concurrentFinal] = await Promise.all([
    validatePasswordSessionToken(oldJwt, undefined, secret, loader(state(hashAfterChange))),
    validatePasswordSessionToken(intermediateJwt, undefined, secret, loader(state(hashAfterChange))),
    validatePasswordSessionToken(tokenFor(hashAfterChange), undefined, secret, loader(state(hashAfterChange))),
  ]);
  check("concurrent password events reject the pre-event JWT", isAnonymousToken(concurrentOld));
  check("concurrent password events reject an intermediate JWT", isAnonymousToken(concurrentIntermediate));
  check("concurrent password events preserve only the final new JWT", concurrentFinal.uid === userId);

  // Malformed/inconsistent token and server evidence always fails closed.
  const malformedTokens: Array<Record<string, unknown>> = [
    {},
    { uid: userId },
    { sessionVersion: version },
    { uid: 7, sessionVersion: version },
    { uid: userId, sessionVersion: 7 },
    { uid: userId, sessionVersion: "not-a-version" },
  ];
  for (const [index, malformed] of malformedTokens.entries()) {
    const result = await validatePasswordSessionToken(malformed, undefined, secret, loader(state(hashBefore)));
    check(`malformed token ${index + 1} is anonymous`, isAnonymousToken(result));
  }
  const absentSecret = await validatePasswordSessionToken(oldJwt, undefined, undefined, loader(state(hashBefore)));
  check("missing validation key makes an existing JWT anonymous", isAnonymousToken(absentSecret));
  const deleted = await validatePasswordSessionToken(oldJwt, undefined, secret, loader(null));
  check("deleted user makes an existing JWT anonymous", isAnonymousToken(deleted));
  const disabled: Record<string, unknown> = await validatePasswordSessionToken(
    oldJwt,
    undefined,
    secret,
    loader(state(hashBefore, { disabled: true })),
  );
  check("disabled user retains only cancellation-only keyed evidence",
    isCancellationOnlyToken(disabled));
  const reenabled = await validatePasswordSessionToken(
    disabled,
    undefined,
    secret,
    loader(state(hashBefore)),
  );
  check("re-enabling does not restore an old cancellation-only session",
    isAnonymousToken(reenabled));
  const freshReenabled = await validatePasswordSessionToken(
    disabled,
    { id: userId, sessionVersion: version },
    secret,
    loader(state(hashBefore)),
  );
  check("a fresh successful sign-in after re-enable mints an active session",
    freshReenabled.uid === userId && freshReenabled.cancellationOnly === undefined);
  const blocked = await validatePasswordSessionToken(oldJwt, undefined, secret, loader(state(hashBefore, { identityBlocked: true })));
  check("blocked demo identity makes an existing JWT anonymous", isAnonymousToken(blocked));
  const noHash = await validatePasswordSessionToken(oldJwt, undefined, secret, loader(state(null)));
  check("missing current password evidence makes an existing JWT anonymous", isAnonymousToken(noHash));
  const inconsistent = await validatePasswordSessionToken(
    oldJwt,
    undefined,
    secret,
    loader({ passwordHash: hashBefore, disabled: undefined as never, identityBlocked: false }),
  );
  check("inconsistent disabled evidence fails closed", isAnonymousToken(inconsistent));
  const lookupFailure = await validatePasswordSessionToken(oldJwt, undefined, secret, async () => {
    throw new Error("simulated database outage");
  });
  check("credential-state lookup failure fails closed", isAnonymousToken(lookupFailure));

  // A sign-in races safely with password rotation: callback evidence from
  // authorize() must still match the freshly loaded row before token issuance.
  const racedSignIn = await validatePasswordSessionToken(
    { marker: "new-login" },
    { id: userId, sessionVersion: version },
    secret,
    loader(state(hashAfterReset)),
  );
  check("stale sign-in evidence cannot mint a JWT across a password event", isAnonymousToken(racedSignIn));
  const freshSignInVersion = createPasswordSessionVersion(userId, hashAfterReset, secret);
  const freshSignIn = await validatePasswordSessionToken(
    { marker: "new-login" } as Record<string, unknown>,
    { id: userId, sessionVersion: freshSignInVersion },
    secret,
    loader(state(hashAfterReset)),
  );
  check("fresh sign-in evidence mints a valid JWT", freshSignIn.uid === userId);

  // Clearing uid/version must return a genuinely absent NextAuth session. A
  // truthy `{ expires, user: undefined }` body is still `authenticated` to the
  // React client even though server-side id checks correctly reject it.
  const sessionCallback = authOptions.callbacks?.session;
  if (!sessionCallback) throw new Error("missing NextAuth session callback");
  const projectedInvalid = await sessionCallback({
    session: {
      user: { name: "Stale User", email: "stale@example.com", image: null },
      expires: new Date(Date.now() + 60_000).toISOString(),
    },
    token: {},
    user: undefined,
    newSession: undefined,
    trigger: undefined,
  } as never);
  check("invalid JWT returns no session body", projectedInvalid === null);
  const projectedDisabled = await sessionCallback({
    session: {
      user: { name: "Disabled User", email: "disabled@example.com", image: null },
      expires: new Date(Date.now() + 60_000).toISOString(),
    },
    token: disabled,
    user: undefined,
    newSession: undefined,
    trigger: undefined,
  } as never);
  check("cancellation-only JWT evidence projects no authenticated session",
    projectedDisabled === null);
  const projectedValid = await sessionCallback({
    session: {
      user: { name: "Current User", email: "current@example.com", image: null },
      expires: new Date(Date.now() + 60_000).toISOString(),
    },
    token: tokenFor(hashAfterReset),
    user: undefined,
    newSession: undefined,
    trigger: undefined,
  } as never);
  check(
    "validated new JWT projects the immutable user id",
    (projectedValid.user as { id?: string } | undefined)?.id === userId,
  );

  // Reset links carry nonce-specific, domain-separated HMAC evidence bound to
  // the credential state that issued them. No hash or unkeyed derivative leaks.
  const resetNonce = "a".repeat(64);
  const resetEvidence = createPasswordResetEvidence(userId, hashBefore, resetNonce, secret);
  check("reset evidence has the canonical keyed shape", /^[A-Za-z0-9_-]{43}$/.test(resetEvidence ?? ""));
  check("reset evidence fails closed without the auth secret",
    createPasswordResetEvidence(userId, hashBefore, resetNonce, undefined) === null);
  check("reset evidence is user-bound",
    resetEvidence !== createPasswordResetEvidence("user-2", hashBefore, resetNonce, secret));
  check("reset evidence changes for every link nonce",
    resetEvidence !== createPasswordResetEvidence(userId, hashBefore, "b".repeat(64), secret));
  check("reset evidence changes after password rotation",
    resetEvidence !== createPasswordResetEvidence(userId, hashAfterChange, resetNonce, secret));
  check("current reset evidence matches",
    passwordResetEvidenceMatches(userId, hashBefore, resetNonce, secret, resetEvidence));
  check("stale reset evidence does not match a rotated credential",
    !passwordResetEvidenceMatches(userId, hashAfterChange, resetNonce, secret, resetEvidence));

  // One raw reset token still has exactly one atomic claim winner on replay.
  const rawResetToken = resetTokenFor(hashBefore, resetNonce);
  const resetStore = new InMemoryResetTokenStore(resetRow(rawResetToken));
  const claims = await Promise.all([
    consumeResetToken(rawResetToken, resetStore),
    consumeResetToken(rawResetToken, resetStore),
  ]);
  check("concurrent reset-token replay has exactly one winner",
    claims.filter((claim) => claim?.userId === userId).length === 1);
  check("concurrent reset-token replay has exactly one refusal",
    claims.filter((claim) => claim === null).length === 1);
  check("a consumed reset token stays single-use on later replay", await consumeResetToken(rawResetToken, resetStore) === null);

  const expiredStore = new InMemoryResetTokenStore(resetRow(rawResetToken, {
    expiresAt: new Date(Date.now() - 1),
  }));
  check("expired reset token cannot win the atomic claim", await consumeResetToken(rawResetToken, expiredStore) === null);
  check("malformed reset token is refused before store access", await consumeResetToken("short", expiredStore) === null);

  // A fresh link succeeds, rotates the credential, and removes every sibling row.
  const freshRaw = resetTokenFor(hashBefore, "c".repeat(64));
  const freshSibling = resetTokenFor(hashBefore, "d".repeat(64));
  const freshTokens = new InMemoryResetTokenStore([resetRow(freshRaw), resetRow(freshSibling)]);
  const freshCredential = new InMemoryResetCredentialStore(resetAccount());
  const freshCompleted = await completePasswordReset(
    freshRaw,
    async () => hashAfterReset,
    resetDependencies(freshTokens, freshCredential),
  );
  check("a fresh reset link changes the password", freshCompleted && freshCredential.account?.passwordHash === hashAfterReset);
  check("a successful reset cleans every sibling capability",
    freshTokens.rows.length === 0 && freshTokens.cleanupCalls === 1);
  check("the successful reset link cannot replay", await consumeResetToken(freshRaw, freshTokens) === null);

  // Once the credential CAS succeeds, stale siblings are already invalid by
  // keyed evidence. Cleanup is best-effort and cannot make the endpoint claim a
  // real password change failed; retained siblings still cannot overwrite it.
  const cleanupRaw = resetTokenFor(hashBefore, "b".repeat(64));
  const cleanupSibling = resetTokenFor(hashBefore, "a".repeat(63) + "b");
  const cleanupTokens = new InMemoryResetTokenStore([
    resetRow(cleanupRaw),
    resetRow(cleanupSibling),
  ]);
  cleanupTokens.cleanupFailure = true;
  const cleanupCredential = new InMemoryResetCredentialStore(resetAccount());
  const originalConsoleError = console.error;
  let cleanupWarning = "";
  console.error = (...args: unknown[]) => { cleanupWarning += args.join(" "); };
  const completedDespiteCleanup = await completePasswordReset(
    cleanupRaw,
    async () => hashAfterReset,
    resetDependencies(cleanupTokens, cleanupCredential),
  );
  console.error = originalConsoleError;
  check("post-CAS sibling cleanup failure still reports the password change truthfully",
    completedDespiteCleanup && cleanupCredential.account?.passwordHash === hashAfterReset);
  check("post-CAS cleanup failure emits a credential-safe operational warning",
    cleanupWarning.includes("password-reset sibling cleanup failed") &&
    !cleanupWarning.includes(cleanupRaw) && !cleanupWarning.includes(userId));
  check("a sibling retained after cleanup failure is cryptographically stale",
    !(await completePasswordReset(
      cleanupSibling,
      async () => "$2a$10$cleanup-sibling-attack",
      resetDependencies(cleanupTokens, cleanupCredential),
    )) && cleanupCredential.account?.passwordHash === hashAfterReset);

  async function staleLinkIsRefused(label: string, currentHash: string, nonce: string) {
    const raw = resetTokenFor(hashBefore, nonce);
    const tokens = new InMemoryResetTokenStore(resetRow(raw));
    const credential = new InMemoryResetCredentialStore(resetAccount({ passwordHash: currentHash }));
    let hashWork = 0;
    const completed = await completePasswordReset(
      raw,
      async () => { hashWork++; return "$2a$10$attacker-chosen-password"; },
      resetDependencies(tokens, credential),
    );
    check(`${label} invalidates the outstanding reset link`, !completed);
    check(`${label} prevents an old link from overwriting the new hash`,
      credential.account?.passwordHash === currentHash && hashWork === 0);
  }

  await staleLinkIsRefused("profile password change", hashAfterChange, "e".repeat(64));
  await staleLinkIsRefused("prior password reset", hashAfterReset, "f".repeat(64));
  await staleLinkIsRefused("admin password reset", hashAfterAdminReset, "1".repeat(64));

  const disabledRaw = resetTokenFor(hashBefore, "2".repeat(64));
  const disabledTokens = new InMemoryResetTokenStore(resetRow(disabledRaw));
  const disabledCredential = new InMemoryResetCredentialStore(resetAccount({ disabled: true }));
  check("a disabled user cannot redeem an outstanding reset link",
    !(await completePasswordReset(
      disabledRaw,
      async () => hashAfterReset,
      resetDependencies(disabledTokens, disabledCredential),
    )) && disabledCredential.account?.passwordHash === hashBefore);

  const deletedRaw = resetTokenFor(hashBefore, "3".repeat(64));
  const deletedTokens = new InMemoryResetTokenStore(resetRow(deletedRaw));
  const deletedCredential = new InMemoryResetCredentialStore(null);
  check("a deleted user cannot redeem an outstanding reset link",
    !(await completePasswordReset(
      deletedRaw,
      async () => hashAfterReset,
      resetDependencies(deletedTokens, deletedCredential),
    )));

  const blockedRaw = resetTokenFor(hashBefore, "4".repeat(64), { id: "demo-user" });
  const blockedTokens = new InMemoryResetTokenStore(resetRow(blockedRaw, { id: "demo-user" }));
  const blockedCredential = new InMemoryResetCredentialStore(resetAccount({
    id: "demo-user",
    email: "demo@gabrielcapitallabs.com",
  }));
  check("a blocked demo identity cannot redeem a reset link",
    !(await completePasswordReset(
      blockedRaw,
      async () => hashAfterReset,
      resetDependencies(blockedTokens, blockedCredential),
    )));

  const noSecretRaw = resetTokenFor(hashBefore, "5".repeat(64));
  const noSecretTokens = new InMemoryResetTokenStore(resetRow(noSecretRaw));
  const noSecretCredential = new InMemoryResetCredentialStore(resetAccount());
  check("missing reset signing key fails closed before claiming the capability",
    !(await completePasswordReset(
      noSecretRaw,
      async () => hashAfterReset,
      resetDependencies(noSecretTokens, noSecretCredential, { key: undefined }),
    )) && noSecretTokens.rows[0]?.usedAt === null);

  // Two independently issued siblings can both be claimed, but the credential
  // state CAS lets only one change the password. The winner then deletes both.
  const siblingRawA = resetTokenFor(hashBefore, "6".repeat(64));
  const siblingRawB = resetTokenFor(hashBefore, "7".repeat(64));
  const siblingTokens = new InMemoryResetTokenStore([
    resetRow(siblingRawA),
    resetRow(siblingRawB),
  ]);
  const siblingCredential = new InMemoryResetCredentialStore(resetAccount());
  const siblingResults = await Promise.all([
    completePasswordReset(
      siblingRawA,
      async () => "$2a$10$sibling-a-password",
      resetDependencies(siblingTokens, siblingCredential),
    ),
    completePasswordReset(
      siblingRawB,
      async () => "$2a$10$sibling-b-password",
      resetDependencies(siblingTokens, siblingCredential),
    ),
  ]);
  check("concurrent sibling reset links have exactly one password-write winner",
    siblingResults.filter(Boolean).length === 1 && siblingResults.filter((result) => !result).length === 1);
  check("the sibling loser cannot overwrite the winner",
    siblingCredential.account?.passwordHash === "$2a$10$sibling-a-password" ||
    siblingCredential.account?.passwordHash === "$2a$10$sibling-b-password");
  check("the sibling winner cleans all reset rows",
    siblingTokens.rows.length === 0 && siblingTokens.cleanupCalls === 1);

  // Disable and password rotation can race after validation. Both are repeated in
  // the final database WHERE clause, so the reset loses without overwriting state.
  const disableRaceRaw = resetTokenFor(hashBefore, "8".repeat(64));
  const disableRaceTokens = new InMemoryResetTokenStore(resetRow(disableRaceRaw));
  const disableRaceCredential = new InMemoryResetCredentialStore(resetAccount());
  const disableRace = await completePasswordReset(
    disableRaceRaw,
    async () => {
      if (disableRaceCredential.account) disableRaceCredential.account.disabled = true;
      return hashAfterReset;
    },
    resetDependencies(disableRaceTokens, disableRaceCredential),
  );
  check("a concurrent disable beats the final reset write",
    !disableRace && disableRaceCredential.account?.passwordHash === hashBefore);

  const rotationRaceRaw = resetTokenFor(hashBefore, "9".repeat(64));
  const rotationRaceTokens = new InMemoryResetTokenStore(resetRow(rotationRaceRaw));
  const rotationRaceCredential = new InMemoryResetCredentialStore(resetAccount());
  const rotationRace = await completePasswordReset(
    rotationRaceRaw,
    async () => {
      if (rotationRaceCredential.account) rotationRaceCredential.account.passwordHash = hashAfterAdminReset;
      return hashAfterReset;
    },
    resetDependencies(rotationRaceTokens, rotationRaceCredential),
  );
  check("a concurrent admin rotation beats the final reset write",
    !rotationRace && rotationRaceCredential.account?.passwordHash === hashAfterAdminReset);

  const transplantedRaw = resetTokenFor(hashBefore, "0".repeat(64));
  const transplantedTokens = new InMemoryResetTokenStore(resetRow(transplantedRaw, { id: "user-2" }));
  const transplantedCredential = new InMemoryResetCredentialStore(resetAccount({ id: "user-2" }));
  check("reset evidence cannot be transplanted to another user row",
    !(await completePasswordReset(
      transplantedRaw,
      async () => hashAfterReset,
      resetDependencies(transplantedTokens, transplantedCredential),
    )) && transplantedCredential.account?.passwordHash === hashBefore);

  // Raw token audit: the two consumers are an exact allowlist. Middleware is
  // navigation-only; sessionAccountState is the cancellation-only resolver and
  // independently checks current keyed credential evidence before returning a row.
  const { readFileSync, readdirSync } = await import("node:fs");
  const { createRequire } = await import("node:module");
  const { dirname, join } = await import("node:path");
  const root = join(__dirname, "..");
  const runtimeRequire = createRequire(__filename);
  const nextAuthRoot = dirname(runtimeRequire.resolve("next-auth"));
  const nextAuthSessionSource = readFileSync(join(nextAuthRoot, "core/routes/session.js"), "utf8");
  const nextAuthReactSource = readFileSync(join(nextAuthRoot, "react/index.js"), "utf8");
  const nextAuthSessionRoute = (
    runtimeRequire(join(nextAuthRoot, "core/routes/session.js")) as {
      default: (params: Record<string, unknown>) => Promise<{ body: unknown }>;
    }
  ).default;

  async function runNextAuthSessionRoute(validatedToken: Record<string, unknown>) {
    const runtimeErrors: unknown[] = [];
    let encodedToken: Record<string, unknown> | undefined;
    const response = await nextAuthSessionRoute({
      options: {
        adapter: undefined,
        jwt: {
          decode: async () => ({ name: "Decoded User", email: "decoded@example.com" }),
          encode: async ({ token }: { token: Record<string, unknown> }) => {
            encodedToken = token;
            return "encoded-test-token";
          },
        },
        events: {},
        callbacks: {
          jwt: async () => validatedToken,
          session: sessionCallback,
        },
        logger: { error: (...args: unknown[]) => runtimeErrors.push(args) },
        session: { strategy: "jwt", maxAge: 60 },
      },
      sessionStore: {
        value: "encoded-stale-cookie",
        chunk: () => [],
        clean: () => [],
      },
      newSession: undefined,
      isUpdate: false,
    });
    return { response, runtimeErrors, encodedToken };
  }

  // Exercise the installed NextAuth session route, not a local approximation.
  // Its response body is precisely what getSession()/useSession() receives.
  const invalidRoute = await runNextAuthSessionRoute({});
  check("NextAuth session route returns null for invalid JWT evidence", invalidRoute.response.body === null);
  check("invalid callback does not enter NextAuth's route error path", invalidRoute.runtimeErrors.length === 0);
  check("NextAuth client classifies the null body as unauthenticated", (invalidRoute.response.body ? "authenticated" : "unauthenticated") === "unauthenticated");
  const validRoute = await runNextAuthSessionRoute(tokenFor(hashAfterReset));
  check(
    "NextAuth session route preserves a valid new session",
    (validRoute.response.body as { user?: { id?: string } }).user?.id === userId,
  );
  check("NextAuth client classifies the valid body as authenticated", (validRoute.response.body ? "authenticated" : "unauthenticated") === "authenticated");
  const disabledRoute = await runNextAuthSessionRoute(disabled);
  check("NextAuth route exposes no session for cancellation-only evidence",
    disabledRoute.response.body === null);
  check("NextAuth route re-encodes cancellation-only evidence for the billing escape hatch",
    disabledRoute.encodedToken?.uid === userId &&
    disabledRoute.encodedToken?.cancellationOnly === true);
  check("installed NextAuth forwards the callback result as its response body", /response\.body\s*=\s*updatedSession/.test(nextAuthSessionSource));
  check("installed NextAuth React client uses session truthiness for status", /session\s*\?\s*["']authenticated["']\s*:\s*["']unauthenticated["']/.test(nextAuthReactSource));

  const middleware = readFileSync(join(root, "middleware.ts"), "utf8");
  const sessionSource = readFileSync(join(root, "lib/session.ts"), "utf8");
  const resetRouteSource = readFileSync(join(root, "app/api/auth/reset-password/route.ts"), "utf8");
  const resetLibrarySource = readFileSync(join(root, "lib/passwordReset.ts"), "utf8");
  const dashboard = readFileSync(join(root, "app/dashboard/page.tsx"), "utf8");
  const sourceFiles = [
    "lib/admin.ts",
    "app/api/stripe/checkout/route.ts",
    "app/api/billing/status/route.ts",
    "app/api/push/unsubscribe/route.ts",
    "app/api/admin/impersonate/stop/route.ts",
  ].map((path) => readFileSync(join(root, path), "utf8"));
  const middlewareCode = middleware.replace(/\/\/.*$/gm, "");
  function sourceFilesUnder(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if ([".git", ".next", "node_modules", "artifacts"].includes(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) found.push(...sourceFilesUnder(path));
      else if (/\.(?:ts|tsx)$/.test(entry.name)) found.push(path);
    }
    return found;
  }
  const rawTokenConsumers = sourceFilesUnder(root)
    .filter((path) => !path.includes(`${join(root, "scripts")}/`))
    .filter((path) => /\bgetToken\s*\(/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(root.length + 1))
    .sort();
  // M-1 widened the matcher by exactly one path so a cancellation-only principal
  // is caught where app/login/page.tsx pushes it. The invariant that matters is
  // unchanged: the suspended user's only remedy must never be matched.
  //
  // RC1 S2 widened the matcher beyond ["/","/dashboard"]. The property this suite
  // protects is not the SIZE of the matcher but that this raw-getToken consumer stays
  // navigation-only and never becomes the authority on revocation: the JWT it reads
  // cannot reveal a disabled account or a rotated password version.
  check("raw getToken middleware is declared over a static literal matcher, not an inverted catch-all",
    /export const config = \{[\s\S]*?matcher: \[[\s\S]*?\],\s*\};/.test(middleware) && !/\(\?!/.test(middleware));
  check("the edge check still requires the keyed sessionVersion evidence a real password session carries",
    /typeof token\.sessionVersion === "string"/.test(middlewareCode) && /\{43\}/.test(middlewareCode));
  check("the cancellation page is never matched by middleware",
    !/matcher:[^\]]*billing/.test(middleware));
  check("raw getToken middleware performs navigation only", !/prisma|currentAccount|currentUser|requireAdmin|\.create\(|\.update\(|\.delete\(/.test(middlewareCode));
  check("raw decoded-token consumers are exactly the reviewed allowlist",
    rawTokenConsumers.length === 2 &&
    rawTokenConsumers[0] === "lib/session.ts" &&
    rawTokenConsumers[1] === "middleware.ts");
  const cancellationResolverSource = sessionSource.slice(
    sessionSource.indexOf("export async function sessionAccountState"),
    sessionSource.indexOf("export async function currentWorkspace"),
  );
  check("the cancellation-only raw consumer revalidates password evidence",
    /getToken\(/.test(cancellationResolverSource) &&
    /passwordSessionVersionMatches\(/.test(cancellationResolverSource));
  check("the cancellation-only raw consumer cannot mutate account state",
    !/prisma\.user\.(?:create|update|delete)/.test(cancellationResolverSource));
  check("middleware's dashboard destination revalidates through session gates", /currentWorkspace\(\)/.test(dashboard) && /currentUser\(\)/.test(dashboard));
  check("every direct authenticated resolver uses callback-backed getServerSession", sourceFiles.every((source) => /getServerSession\(/.test(source)));
  check("the reset route delegates to the credential-bound completion primitive",
    /completePasswordReset\(/.test(resetRouteSource) && !/prisma\.user\.update/.test(resetRouteSource));
  check("the final reset write is a credential-and-disabled-state CAS",
    /where:\s*\{\s*id: claim\.userId, passwordHash: account\.passwordHash, disabled: false\s*\}/.test(resetLibrarySource));
  check("successful reset completion cleans sibling token rows",
    /tokenStore\.revokeAllForUser\(claim\.userId\)/.test(resetLibrarySource));

  // Exercise middleware with real encrypted NextAuth JWTs. Invalid callbacks
  // re-encode `{}` with standard truthy claims; pre-wave JWTs have uid but no
  // sessionVersion. Neither may bounce the landing page into a sign-in dead end.
  const { encode } = await import("next-auth/jwt");
  const { NextRequest } = await import("next/server");
  const { middleware: landingMiddleware } = await import("../middleware");
  const priorAuthSecret = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = secret;
  async function landingResponse(payload: Record<string, unknown>, url = "https://www.creditvector.app/") {
    const encrypted = await encode({ token: payload, secret, maxAge: 60 });
    return landingMiddleware(new NextRequest(url, {
      headers: { authorization: `Bearer ${encodeURIComponent(encrypted)}` },
    }));
  }
  const validLanding = await landingResponse(tokenFor(hashBefore));
  check("middleware redirects a structurally valid session to the dashboard",
    validLanding.status === 307 && validLanding.headers.get("location") === "https://www.creditvector.app/dashboard");
  const emptyLanding = await landingResponse({});
  check("an empty re-encoded invalid callback token stays on the public landing",
    emptyLanding.status === 200 && emptyLanding.headers.get("location") === null);
  const preWaveLanding = await landingResponse({ uid: userId, email: "current@example.com" });
  check("a pre-wave JWT missing sessionVersion stays on the public landing",
    preWaveLanding.status === 200 && preWaveLanding.headers.get("location") === null);
  const malformedLanding = await landingResponse({ uid: userId, sessionVersion: "malformed" });
  check("malformed middleware session evidence stays on the public landing",
    malformedLanding.status === 200 && malformedLanding.headers.get("location") === null);
  // M-1: a cancellation-only JWT is no longer left on the landing page with no
  // onward route — it is sent to the ONE surface it can use. It is still not
  // given /dashboard, and it still has no session (asserted above).
  const cancellationOnlyLanding = await landingResponse(disabled);
  check("a cancellation-only JWT is routed to the cancellation page, never the dashboard",
    cancellationOnlyLanding.status === 307 &&
    cancellationOnlyLanding.headers.get("location") === "https://www.creditvector.app/billing/cancel");
  const cancellationOnlyDashboard = await landingResponse(disabled, "https://www.creditvector.app/dashboard");
  check("and the same is true of the /dashboard push that follows a successful sign-in",
    cancellationOnlyDashboard.status === 307 &&
    cancellationOnlyDashboard.headers.get("location") === "https://www.creditvector.app/billing/cancel");
  const validDashboard = await landingResponse(tokenFor(hashBefore), "https://www.creditvector.app/dashboard");
  check("an ENABLED session is not redirected on /dashboard (no self-redirect loop)",
    validDashboard.status === 200 && validDashboard.headers.get("location") === null);
  const demoLanding = await landingResponse({ ...tokenFor(hashBefore), email: "demo@gabrielcapitallabs.com" });
  check("a structurally valid blocked demo JWT stays on the public landing",
    demoLanding.status === 200 && demoLanding.headers.get("location") === null);
  if (priorAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = priorAuthSecret;

  console.log(`\npassword-session-revocation.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

void main();
