// Run: npx --no-install tsx scripts/password-reset-state-transition.test.ts
//
// Runtime composition coverage for reset issuance/redemption racing the real
// admin disabled-state PATCH handler. All production functions execute over an
// in-memory transactional Prisma fake; no database, Stripe, network, or account
// is touched.
import { createHash } from "node:crypto";

const AUTH_SECRET = "password-reset-state-transition-test-secret";
const priorAuthSecret = process.env.NEXTAUTH_SECRET;
process.env.NEXTAUTH_SECRET = AUTH_SECRET;

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

type UserRow = {
  id: string;
  email: string;
  passwordHash: string | null;
  disabled: boolean;
  role: string;
  plan: string;
  isAgency: boolean;
  managedByAgencyId: string | null;
};

type TokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

type Gate = { started: Deferred; release: Deferred };
function gate(): Gate {
  return { started: deferred(), release: deferred() };
}

const targetId = "target-user";
const hashBefore = "$2a$10$state-transition-before";
const hashAfter = "$2a$10$state-transition-after";
let account: UserRow;
let tokenRows: Map<string, TokenRow>;
let tokenSequence = 0;
let audits: Array<Record<string, unknown>>;
let lockEvents: string[];
let transactionTail: Promise<void>;
let rootLookupGate: Gate | null;
let rootDeleteGate: Gate | null;
let transactionDeleteGate: Gate | null;
let failRootDelete: boolean;
let failTransactionDelete: boolean;

function resetWorld(disabled = false) {
  account = {
    id: targetId,
    email: "target@example.com",
    passwordHash: hashBefore,
    disabled,
    role: "USER",
    plan: "premium",
    isAgency: false,
    managedByAgencyId: null,
  };
  tokenRows = new Map();
  audits = [];
  lockEvents = [];
  transactionTail = Promise.resolve();
  rootLookupGate = null;
  rootDeleteGate = null;
  transactionDeleteGate = null;
  failRootDelete = false;
  failTransactionDelete = false;
}

function cloneTokens(): Map<string, TokenRow> {
  return new Map(Array.from(tokenRows, ([key, row]) => [
    key,
    {
      ...row,
      expiresAt: new Date(row.expiresAt),
      usedAt: row.usedAt ? new Date(row.usedAt) : null,
    },
  ]));
}

function selectedUser(select?: Record<string, boolean>) {
  if (!select) return { ...account };
  const result: Record<string, unknown> = {};
  for (const [key, include] of Object.entries(select)) {
    if (include) result[key] = account[key as keyof UserRow];
  }
  return result;
}

const userDelegate = {
  findUnique: async ({ where, select }: {
    where: { id?: string; email?: string };
    select?: Record<string, boolean>;
  }) => {
    const matches = where.id === account.id || where.email === account.email;
    return matches ? selectedUser(select) : null;
  },
  update: async ({ where, data, select }: {
    where: { id: string };
    data: Record<string, unknown>;
    select?: Record<string, boolean>;
  }) => {
    if (where.id !== account.id) throw new Error("missing fake user");
    account = { ...account, ...data } as UserRow;
    return selectedUser(select);
  },
  updateMany: async ({ where, data }: {
    where: { id: string; passwordHash: string; disabled: false };
    data: { passwordHash: string };
  }) => {
    if (
      where.id !== account.id ||
      account.passwordHash !== where.passwordHash ||
      account.disabled !== false
    ) {
      return { count: 0 };
    }
    account.passwordHash = data.passwordHash;
    return { count: 1 };
  },
};

function deleteTokenRows(where: { userId?: string; id?: { in: string[] } }): number {
  const before = tokenRows.size;
  const ids = new Set(where.id?.in ?? []);
  for (const [tokenHash, row] of tokenRows) {
    if (row.userId === where.userId || ids.has(row.id)) tokenRows.delete(tokenHash);
  }
  return before - tokenRows.size;
}

const transactionTokenDelegate = {
  findUnique: async ({ where }: { where: { tokenHash: string } }) => {
    const row = tokenRows.get(where.tokenHash);
    return row ? { userId: row.userId } : null;
  },
  findMany: async ({ where }: { where: { userId: string } }) =>
    Array.from(tokenRows.values())
      .filter((row) => row.userId === where.userId)
      .map((row) => ({ id: row.id })),
  updateMany: async ({ where, data }: {
    where: { tokenHash: string; usedAt: null; expiresAt: { gt: Date } };
    data: { usedAt: Date };
  }) => {
    const row = tokenRows.get(where.tokenHash);
    if (!row || row.usedAt !== null || row.expiresAt <= where.expiresAt.gt) return { count: 0 };
    row.usedAt = data.usedAt;
    return { count: 1 };
  },
  deleteMany: async ({ where }: { where: { userId: string } }) => {
    const pause = transactionDeleteGate;
    if (pause) {
      transactionDeleteGate = null;
      pause.started.resolve();
      await pause.release.promise;
    }
    if (failTransactionDelete) throw new Error("simulated transactional revocation outage");
    return { count: deleteTokenRows(where) };
  },
  create: async ({ data }: {
    data: { userId: string; tokenHash: string; expiresAt: Date };
  }) => {
    const row: TokenRow = {
      id: `token-${++tokenSequence}`,
      ...data,
      usedAt: null,
    };
    tokenRows.set(row.tokenHash, row);
    return row;
  },
};

const rootTokenDelegate = {
  ...transactionTokenDelegate,
  findUnique: async ({ where }: { where: { tokenHash: string } }) => {
    // Snapshot the query result before pausing. This models a reset request that
    // located its row immediately before a disable transaction won the User lock.
    const row = tokenRows.get(where.tokenHash);
    const result = row ? { userId: row.userId } : null;
    const pause = rootLookupGate;
    if (pause) {
      rootLookupGate = null;
      pause.started.resolve();
      await pause.release.promise;
    }
    return result;
  },
  deleteMany: async ({ where }: {
    where: { userId?: string; id?: { in: string[] } };
  }) => {
    const pause = rootDeleteGate;
    if (pause) {
      rootDeleteGate = null;
      pause.started.resolve();
      await pause.release.promise;
    }
    if (failRootDelete) throw new Error("simulated post-commit cleanup outage");
    return { count: deleteTokenRows(where) };
  },
};

const transactionClient = {
  user: userDelegate,
  passwordResetToken: transactionTokenDelegate,
  $queryRaw: async (_parts: TemplateStringsArray, userId: string) => {
    lockEvents.push(userId);
    return account.id === userId ? [{ id: userId }] : [];
  },
};

const fakePrisma = {
  user: userDelegate,
  passwordResetToken: rootTokenDelegate,
  $executeRawUnsafe: async () => 0,
  $transaction: async <T>(operation: (tx: typeof transactionClient) => Promise<T>): Promise<T> => {
    let release!: () => void;
    const predecessor = transactionTail;
    transactionTail = new Promise<void>((done) => { release = done; });
    await predecessor;
    const accountBefore = { ...account };
    const tokensBefore = cloneTokens();
    try {
      return await operation(transactionClient);
    } catch (error) {
      account = accountBefore;
      tokenRows = tokensBefore;
      throw error;
    } finally {
      release();
    }
  },
};

const Mod = require("module") as { _load: (...args: unknown[]) => unknown };
const realLoad = Mod._load;
Mod._load = function patched(this: unknown, request: string, parent: unknown, isMain: boolean) {
  if (request === "./prisma" || request === "@/lib/prisma") return { prisma: fakePrisma };
  if (request === "@/lib/admin") {
    return {
      requireAdmin: async () => ({ id: "admin-user", email: "admin@example.com" }),
      logAudit: async (entry: Record<string, unknown>) => { audits.push(entry); },
    };
  }
  return realLoad.apply(this, [request, parent, isMain] as never);
} as never;

const passwordReset = require("../lib/passwordReset") as typeof import("../lib/passwordReset");
const firstPatchedLoad = Mod._load;
Mod._load = function patchedPasswordReset(this: unknown, request: string, parent: unknown, isMain: boolean) {
  if (request === "@/lib/passwordReset") return passwordReset;
  return firstPatchedLoad.apply(this, [request, parent, isMain] as never);
} as never;
const adminUsers = require("../app/api/admin/users/[id]/route") as {
  PATCH: (req: Request, context: { params: { id: string } }) => Promise<Response>;
};
Mod._load = realLoad;

function tokenHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function addResetToken(nonce: string): string {
  const evidence = passwordReset.createPasswordResetEvidence(
    targetId,
    account.passwordHash,
    nonce,
    AUTH_SECRET,
  );
  if (!evidence) throw new Error("could not mint test reset evidence");
  const raw = `${nonce}.${evidence}`;
  const row: TokenRow = {
    id: `token-${++tokenSequence}`,
    userId: targetId,
    tokenHash: tokenHash(raw),
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
  };
  tokenRows.set(row.tokenHash, row);
  return raw;
}

function patchUser(body: Record<string, unknown>): Promise<Response> {
  return adminUsers.PATCH(
    new Request(`https://www.creditvector.app/api/admin/users/${targetId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: { id: targetId } },
  );
}

function patchDisabled(disabled: boolean): Promise<Response> {
  return patchUser({ disabled });
}

async function main() {
  // An unconsumed capability cannot disappear only temporarily while disabled:
  // both transition directions revoke it inside the shared locked transaction.
  resetWorld();
  const oldRaw = addResetToken("a".repeat(64));
  const disabled = await patchDisabled(true);
  const disabledStateEstablished = account.disabled && tokenRows.size === 0;
  const reenabled = await patchDisabled(false);
  let resurrectedHashWork = 0;
  const resurrected = await passwordReset.completePasswordReset(oldRaw, async () => {
    resurrectedHashWork++;
    return hashAfter;
  });
  check("admin disable succeeds and revokes the outstanding row",
    disabled.status === 200 && disabledStateEstablished);
  check("admin re-enable succeeds after mandatory revocation", reenabled.status === 200);
  check("disable then re-enable permanently invalidates the old reset capability",
    !resurrected && resurrectedHashWork === 0 && account.passwordHash === hashBefore);
  check("both disabled-state directions take the reviewed User-row lock",
    lockEvents.filter((id) => id === targetId).length === 2);
  check("successful state transitions retain their existing audit behavior", audits.length === 2);

  // Non-state admin edits retain the original direct update path and do not
  // revoke reset capabilities merely because the same route handled them.
  resetWorld();
  const unrelatedRaw = addResetToken("1".repeat(64));
  const unrelatedUpdate = await patchUser({ plan: "free" });
  check("unrelated supported admin updates retain their existing behavior",
    unrelatedUpdate.status === 200 && account.plan === "free" && audits.length === 1);
  check("an unrelated admin update neither locks reset state nor revokes its link",
    lockEvents.length === 0 && tokenRows.has(tokenHash(unrelatedRaw)));

  // Force the disable to linearize between reset-token location and claim. The
  // real completion primitive must re-enter under the lock and lose, not redeem
  // the now-deleted in-memory claim.
  resetWorld();
  const racingRaw = addResetToken("b".repeat(64));
  const lookupPause = gate();
  rootLookupGate = lookupPause;
  let racingHashWork = 0;
  const racingReset = passwordReset.completePasswordReset(racingRaw, async () => {
    racingHashWork++;
    return hashAfter;
  });
  await lookupPause.started.promise;
  const racingDisable = await patchDisabled(true);
  lookupPause.release.resolve();
  const racingResult = await racingReset;
  check("reset racing a winning disable is refused", racingDisable.status === 200 && !racingResult);
  check("the losing reset cannot rotate credentials", account.disabled && account.passwordHash === hashBefore && racingHashWork === 0);
  check("racing disable and redemption both use the shared row-lock primitive",
    lockEvents.filter((id) => id === targetId).length === 2);

  // Revocation failure is transaction-fatal for re-enable. The user row and the
  // capability both roll back, and no success audit is written.
  resetWorld(true);
  const retainedRaw = addResetToken("c".repeat(64));
  failTransactionDelete = true;
  let enableFailed = false;
  try {
    await patchDisabled(false);
  } catch {
    enableFailed = true;
  }
  check("re-enable fails when reset revocation cannot be established", enableFailed);
  check("failed re-enable leaves the account disabled", account.disabled);
  check("failed re-enable transaction retains the outstanding row",
    tokenRows.has(tokenHash(retainedRaw)) && audits.length === 0);
  check("failed re-enable attempted revocation only after taking the row lock",
    lockEvents.length === 1 && lockEvents[0] === targetId);

  // Issuance uses the same lock. A disable already holding it commits first;
  // createResetToken then reloads disabled state and cannot mint after cleanup.
  resetWorld();
  const revokePause = gate();
  transactionDeleteGate = revokePause;
  const disableInFlight = patchDisabled(true);
  await revokePause.started.promise;
  const issueSucceeded = passwordReset.createResetToken(targetId).then(() => true, () => false);
  revokePause.release.resolve();
  const [disableResponse, issued] = await Promise.all([disableInFlight, issueSucceeded]);
  check("token issuance racing a winning disable is refused",
    disableResponse.status === 200 && !issued && account.disabled);
  check("the issuance race leaves no capability after disable", tokenRows.size === 0);
  check("racing disable and issuance both use the shared row-lock primitive",
    lockEvents.filter((id) => id === targetId).length === 2);

  // Once the credential transaction commits, cleanup failure is not a false
  // reset failure. Any retained sibling is cryptographically stale.
  resetWorld();
  const cleanupRaw = addResetToken("d".repeat(64));
  const cleanupSibling = addResetToken("e".repeat(64));
  failRootDelete = true;
  const originalConsoleError = console.error;
  let cleanupWarning = "";
  console.error = (...args: unknown[]) => { cleanupWarning += args.join(" "); };
  let cleanupCompleted = false;
  try {
    cleanupCompleted = await passwordReset.completePasswordReset(cleanupRaw, async () => hashAfter);
  } finally {
    console.error = originalConsoleError;
  }
  failRootDelete = false;
  check("post-commit cleanup outage still reports the committed reset truthfully",
    cleanupCompleted && account.passwordHash === hashAfter);
  check("cleanup warning exposes neither the raw capability nor user id",
    cleanupWarning.includes("password-reset sibling cleanup failed") &&
    !cleanupWarning.includes(cleanupRaw) && !cleanupWarning.includes(targetId));
  const staleSiblingResult = await passwordReset.completePasswordReset(
    cleanupSibling,
    async () => "$2a$10$stale-sibling-attack",
  );
  check("a sibling retained by cleanup outage cannot overwrite the new credential",
    !staleSiblingResult && account.passwordHash === hashAfter);
  check("reset completion and stale-sibling refusal both enter under the row lock",
    lockEvents.filter((id) => id === targetId).length === 2);

  // Cleanup targets the exact pre-commit row ids. A fresh link issued after the
  // reset releases its lock cannot be deleted by the older cleanup request.
  resetWorld();
  const snapshotRaw = addResetToken("f".repeat(64));
  const cleanupPause = gate();
  rootDeleteGate = cleanupPause;
  const snapshotReset = passwordReset.completePasswordReset(snapshotRaw, async () => hashAfter);
  await cleanupPause.started.promise;
  const freshRaw = await passwordReset.createResetToken(targetId);
  cleanupPause.release.resolve();
  const snapshotCompleted = await snapshotReset;
  check("post-commit cleanup preserves a fresh post-lock issuance",
    snapshotCompleted && tokenRows.size === 1 && tokenRows.has(tokenHash(freshRaw)));
  check("the preserved fresh reset link remains usable",
    await passwordReset.completePasswordReset(freshRaw, async () => "$2a$10$fresh-link-password"));
  check("reset, fresh issuance, and fresh redemption all share the row lock",
    lockEvents.filter((id) => id === targetId).length === 3);

  if (priorAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = priorAuthSecret;
  console.log(`\npassword-reset-state-transition.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

void main();
