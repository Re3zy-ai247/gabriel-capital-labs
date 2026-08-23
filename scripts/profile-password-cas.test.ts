// Run: npx --no-install tsx scripts/profile-password-cas.test.ts
//
// Executable race/regression coverage for the signed-in password-change route.
// The real POST handler runs over in-memory auth, bcrypt, rate-limit, and Prisma
// fakes; no database, session, network, or production account is touched.

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) pass++;
  else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

type Account = {
  id: string;
  passwordHash: string | null;
  disabled: boolean;
};

type UpdateArgs = {
  where: { id: string; passwordHash: string; disabled: false };
  data: { passwordHash: string };
};

const userId = "profile-password-user";
const oldHash = "hash-H0";
const resetHash = "hash-H1";
const attackerHash = "hash-H2";
const oldPassword = "OldValid1!";
const newPassword = "NewValid2!";

let canonical: Account | null;
let sessionSnapshot: Account | null;
let updateAttempts: UpdateArgs[];
let rateLimitKeys: string[];
let bodyReads: number;
let compareCalls: Array<{ password: string; hash: string }>;
let hashCalls: string[];
let policyError: string | null;
let limitedResponse: Response | null;
let onBodyRead: () => void;
let onHash: () => void;
let forcedUpdateCount: number | null;

function resetWorld(overrides: Partial<Account> = {}) {
  canonical = { id: userId, passwordHash: oldHash, disabled: false, ...overrides };
  sessionSnapshot = { ...canonical };
  updateAttempts = [];
  rateLimitKeys = [];
  bodyReads = 0;
  compareCalls = [];
  hashCalls = [];
  policyError = null;
  limitedResponse = null;
  onBodyRead = () => undefined;
  onHash = () => undefined;
  forcedUpdateCount = null;
}

const passwordByHash: Record<string, string> = {
  [oldHash]: oldPassword,
  [resetHash]: "VictimReset3!",
  [attackerHash]: newPassword,
};

const fakeBcrypt = {
  compare: async (password: string, hash: string) => {
    compareCalls.push({ password, hash });
    return passwordByHash[hash] === password;
  },
  hash: async (password: string) => {
    hashCalls.push(password);
    onHash();
    return attackerHash;
  },
};

const fakePrisma = {
  user: {
    updateMany: async (args: UpdateArgs) => {
      updateAttempts.push(args);
      if (forcedUpdateCount !== null) return { count: forcedUpdateCount };
      if (
        !canonical ||
        canonical.id !== args.where.id ||
        canonical.passwordHash !== args.where.passwordHash ||
        canonical.disabled !== args.where.disabled
      ) {
        return { count: 0 };
      }
      canonical.passwordHash = args.data.passwordHash;
      return { count: 1 };
    },
  },
};

const Mod = require("module") as { _load: (...args: unknown[]) => unknown };
const realLoad = Mod._load;
Mod._load = function patched(this: unknown, request: string, parent: unknown, isMain: boolean) {
  if (request === "bcryptjs") return fakeBcrypt;
  if (request === "@/lib/prisma") return { prisma: fakePrisma };
  if (request === "@/lib/session") {
    return { currentAccount: async () => sessionSnapshot ? { ...sessionSnapshot } : null };
  }
  if (request === "@/lib/rateLimit") {
    return {
      enforceRateLimit: async (key: string) => {
        rateLimitKeys.push(key);
        return limitedResponse;
      },
    };
  }
  if (request === "@/lib/password") return { validatePassword: () => policyError };
  return realLoad.apply(this, [request, parent, isMain] as never);
} as never;

const profilePassword = require("../app/api/profile/password/route") as {
  POST: (req: Request) => Promise<Response>;
};
Mod._load = realLoad;

function request(body: Record<string, unknown>): Request {
  return {
    json: async () => {
      bodyReads++;
      onBodyRead();
      return body;
    },
  } as Request;
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

async function main() {
  resetWorld();
  const success = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword,
  }));
  check("a current enabled credential changes successfully",
    success.status === 200 && (await responseBody(success)).ok === true);
  check("successful change rotates only the signed-in account credential",
    canonical?.passwordHash === attackerHash && updateAttempts.length === 1);
  check("the final authority decision is an exact credential-and-enabled CAS",
    updateAttempts[0]?.where.id === userId &&
    updateAttempts[0]?.where.passwordHash === oldHash &&
    updateAttempts[0]?.where.disabled === false &&
    updateAttempts[0]?.data.passwordHash === attackerHash);
  check("the existing per-account rate-limit key is preserved",
    rateLimitKeys.length === 1 && rateLimitKeys[0] === `profile-password:${userId}`);

  // The session and old-password check both use H0, but a reset commits H1 while
  // the request is paused. The final CAS must refuse rather than overwrite H1.
  resetWorld();
  onBodyRead = () => {
    if (canonical) canonical.passwordHash = resetHash;
  };
  const resetRace = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword,
  }));
  const resetRaceBody = await responseBody(resetRace);
  check("a password reset racing an already-authorized handler wins",
    resetRace.status === 403 && resetRaceBody.error === "Current password is incorrect.");
  check("the stale profile handler cannot overwrite the reset credential",
    canonical?.passwordHash === resetHash && updateAttempts.length === 1);
  check("the stale request still proves the exploit precondition against cached H0",
    compareCalls.some((call) => call.password === oldPassword && call.hash === oldHash));

  // Disable after authentication but before the final write. The disabled:false
  // predicate is repeated at the mutation boundary and prevents credential change.
  resetWorld();
  onHash = () => {
    if (canonical) canonical.disabled = true;
  };
  const disableRace = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword,
  }));
  check("an admin disable racing password hashing refuses the stale handler",
    disableRace.status === 403 &&
    (await responseBody(disableRace)).error === "Current password is incorrect.");
  check("the disabled account retains its prior password hash",
    canonical?.disabled === true && canonical.passwordHash === oldHash);

  // Deletion and impossible update counts fail closed too; neither can recreate
  // or claim successful mutation of an absent/inconsistent principal.
  resetWorld();
  onHash = () => { canonical = null; };
  const deletionRace = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword,
  }));
  check("account deletion racing the final write fails closed",
    deletionRace.status === 403 && canonical === null);

  resetWorld();
  forcedUpdateCount = 2;
  const inconsistentCount = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword,
  }));
  check("any non-singleton CAS result is refused",
    inconsistentCount.status === 403 && (await responseBody(inconsistentCount)).error === "Current password is incorrect.");

  // Preserve all pre-CAS route gates and their public response copy.
  resetWorld();
  sessionSnapshot = null;
  const unauthorized = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword,
  }));
  check("unauthenticated copy and ordering are unchanged",
    unauthorized.status === 401 &&
    (await responseBody(unauthorized)).error === "Unauthorized" &&
    bodyReads === 0 && rateLimitKeys.length === 0 && updateAttempts.length === 0);

  resetWorld();
  limitedResponse = new Response(JSON.stringify({ error: "Too many requests." }), {
    status: 429,
    headers: { "content-type": "application/json" },
  });
  const limited = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword,
  }));
  check("rate-limit response and pre-body ordering are unchanged",
    limited.status === 429 &&
    (await responseBody(limited)).error === "Too many requests." &&
    bodyReads === 0 && updateAttempts.length === 0);

  resetWorld({ passwordHash: null });
  const noPassword = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword,
  }));
  check("passwordless-account refusal copy is unchanged",
    noPassword.status === 400 &&
    (await responseBody(noPassword)).error === "This account has no password set." &&
    compareCalls.length === 0 && updateAttempts.length === 0);

  resetWorld();
  const wrongCurrent = await profilePassword.POST(request({
    currentPassword: "WrongValid9!",
    newPassword,
  }));
  check("wrong-current-password refusal copy is unchanged",
    wrongCurrent.status === 403 &&
    (await responseBody(wrongCurrent)).error === "Current password is incorrect." &&
    hashCalls.length === 0 && updateAttempts.length === 0);

  resetWorld();
  policyError = "Password policy test refusal.";
  const policy = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword,
  }));
  check("canonical password-policy copy is still forwarded unchanged",
    policy.status === 400 &&
    (await responseBody(policy)).error === policyError &&
    hashCalls.length === 0 && updateAttempts.length === 0);

  resetWorld();
  const samePassword = await profilePassword.POST(request({
    currentPassword: oldPassword,
    newPassword: oldPassword,
  }));
  check("same-password refusal copy is unchanged",
    samePassword.status === 400 &&
    (await responseBody(samePassword)).error === "New password must be different from the current one." &&
    hashCalls.length === 0 && updateAttempts.length === 0);

  console.log(`\nprofile-password-cas.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

void main();

// Module scope: prevents TS2393 global-script collisions with sibling standalone guards.
export {};
