// Run: npx --no-install tsx scripts/runtime/suspended-payer-cancellation.runtime.test.ts
//
// M-1 — a SUSPENDED PAYER must always be able to stop being charged.
//
// THE REGRESSION this guard exists to prevent. Password-session evidence
// (lib/sessionVersion.ts) made every JWT minted before that wave read as
// anonymous, because those tokens carry `uid` and nothing else. At the same time
// `lib/auth.ts` refused a disabled account at `authorize`. Together those two
// correct-looking rules stranded exactly one population:
//
//   · a subscriber suspended TODAY loses /api/billing/self-cancel the moment the
//     session work deploys (401 "Please sign in first"), and
//   · cannot act on that advice, because sign-in refuses them.
//
// The route's own header says it exists so that "a user we disabled while they
// held a live paid subscription" is not left "getting billed with no
// self-service way to stop it". Founder law: historical commercial records are
// preserved and a payer can always stop billing themselves.
//
// THE DESIGN NOW PINNED HERE. A disabled account whose password verifies is
// admitted at `authorize` and mints password-session evidence. The jwt callback
// projects that row to `{ uid, sessionVersion, cancellationOnly: true }`; the
// session callback returns null for it, so getServerSession — and therefore
// currentAccount()/currentUser()/requireAdmin() — see nothing; middleware routes
// it to /billing/cancel and nowhere else; and sessionAccountState reports
// "disabled" so the cancellation route works. Everything else stays fail-closed,
// including the legacy version-less JWT, which remains anonymous: the remedy for
// that holder is to sign in again, which now works.
//
// Offline. No database, no network, no Stripe.
import { check, loadModule, mockModule, run, section } from "./_harness";

type Row = {
  id: string;
  email: string;
  passwordHash: string | null;
  disabled: boolean;
  role: string;
  name: string | null;
  username: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

const SECRET = "guard-only-session-secret-not-a-real-key";
process.env.NEXTAUTH_SECRET = SECRET;

const PASSWORD = "Suspended-Payer-1!";
import bcrypt from "bcryptjs";
const HASH = bcrypt.hashSync(PASSWORD, 4);

const suspended: Row = {
  id: "user_suspended",
  email: "suspended@example.test",
  passwordHash: HASH,
  disabled: true,
  role: "USER",
  name: "Suspended Payer",
  username: null,
  stripeCustomerId: "cus_guard",
  stripeSubscriptionId: "sub_guard",
};
const active: Row = { ...suspended, id: "user_active", email: "active@example.test", disabled: false };
const rows = new Map<string, Row>([
  [suspended.id, suspended],
  [active.id, active],
]);

const audits: unknown[] = [];
let stripeCancelCalls = 0;

mockModule("lib/prisma.ts", {
  prisma: {
    $executeRawUnsafe: async () => 0,
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
      findFirst: async ({ where }: { where: { OR: Array<Record<string, string>> } }) => {
        const wanted = where.OR.map((o) => Object.values(o)[0]);
        for (const row of rows.values()) if (wanted.includes(row.email)) return row;
        return null;
      },
    },
    rateHit: { upsert: async ({ where }: { where: { bucket: string } }) => ({ bucket: where.bucket, count: 1 }) },
  },
});
mockModule("lib/stripe.ts", {
  getStripe: () => ({
    subscriptions: {
      retrieve: async () => ({ id: "sub_guard", customer: "cus_guard", status: "active", cancel_at_period_end: false }),
      update: async () => {
        stripeCancelCalls++;
        return { id: "sub_guard", cancel_at_period_end: true, current_period_end: 1893456000, status: "active" };
      },
    },
  }),
});
mockModule("lib/admin.ts", {
  requireAdmin: async () => null,
  logAudit: async (entry: unknown) => {
    audits.push(entry);
  },
});

const { authOptions } = loadModule<typeof import("../../lib/auth")>("lib/auth.ts");
const session = loadModule<typeof import("../../lib/session")>("lib/session.ts");
const cancelRoute = loadModule<typeof import("../../app/api/billing/self-cancel/route")>(
  "app/api/billing/self-cancel/route.ts"
);
const mw = loadModule<typeof import("../../middleware")>("middleware.ts");

type Token = Record<string, unknown>;

/**
 * Drive the real credentials provider. next-auth 4.24.15's CredentialsProvider
 * returns `{ id, name, type, credentials: {}, authorize: () => null, options }`
 * and merges `options` during its own provider parsing — so the configured
 * authorize lives under `.options`, not at the top level.
 */
async function signIn(email: string, password: string): Promise<Token | null> {
  const provider = authOptions.providers[0] as unknown as {
    options: { authorize: (c: Record<string, string>, r: unknown) => Promise<Token | null> };
  };
  return provider.options.authorize({ email, password }, { headers: { "x-real-ip": "203.0.113.9" } });
}

/** Drive the real jwt callback exactly as NextAuth would. */
async function jwtFor(user: Token | null, token: Token = {}): Promise<Token> {
  const cb = authOptions.callbacks?.jwt as unknown as (a: {
    token: Token;
    user?: Token | null;
  }) => Promise<Token>;
  return cb(user ? { token, user } : { token });
}

async function sessionFor(token: Token): Promise<unknown> {
  const cb = authOptions.callbacks?.session as unknown as (a: { session: Token; token: Token }) => Promise<unknown>;
  return cb({ session: { user: { email: "x" } }, token });
}

/** A request carrying the given decoded token, for the raw-JWT resolvers. */
async function requestWith(token: Token, url = "https://www.creditvector.app/billing/cancel") {
  const { encode } = await import("next-auth/jwt");
  const { NextRequest } = await import("next/server");
  const encrypted = await encode({ token, secret: SECRET, maxAge: 3600 });
  return new NextRequest(url, { headers: { authorization: `Bearer ${encodeURIComponent(encrypted)}` } });
}

run("suspended-payer-cancellation.runtime.test.ts", async () => {
  section("scenario A — the legacy JWT every signed-in user holds today");
  // Base minted `token.uid` only. It stays anonymous everywhere, including the
  // cancellation resolver: an unbound token is not password-revocable, so
  // honouring it would re-open E-02 for the one surface that can spend money.
  const legacyState = await session.sessionAccountState(
    await requestWith({ uid: suspended.id, email: suspended.email })
  );
  check("a version-less legacy JWT is anonymous, not 'disabled'", legacyState.state === "anonymous");
  const legacyCancel = await cancelRoute.GET(await requestWith({ uid: suspended.id }));
  check("so the cancellation route refuses it", legacyCancel.status === 401);
  // The remedy has to be reachable, and that is scenario B.

  section("scenario B — a suspended account can now authenticate to stop billing");
  const wrongPassword = await signIn(suspended.email, "not-the-password");
  check("a wrong password is still refused for a disabled account", wrongPassword === null);

  const signedIn = await signIn(suspended.email, PASSWORD);
  check("a suspended account with the right password is admitted at authorize", signedIn !== null);
  check(
    "and it is handed password-session evidence, not a bare id",
    typeof signedIn?.sessionVersion === "string" && (signedIn?.sessionVersion as string).length === 43
  );

  const token = await jwtFor(signedIn);
  check("the jwt callback marks it cancellation-only", token.cancellationOnly === true);
  check("the token keeps the immutable id and the evidence", token.uid === suspended.id && typeof token.sessionVersion === "string");

  section("…and that principal has NO application access");
  const projected = await sessionFor(token);
  check("the session callback projects it to null — getServerSession sees nothing", projected === null);
  check(
    "so currentAccount()/currentUser()/requireAdmin() cannot resolve it",
    projected === null
  );
  const landing = await mw.middleware(await requestWith(token, "https://www.creditvector.app/"));
  check(
    "middleware sends it to the cancellation page, not the dashboard",
    landing.status === 307 && landing.headers.get("location") === "https://www.creditvector.app/billing/cancel"
  );
  const dash = await mw.middleware(await requestWith(token, "https://www.creditvector.app/dashboard"));
  check(
    "and catches the /dashboard push app/login/page.tsx performs after sign-in",
    dash.status === 307 && dash.headers.get("location") === "https://www.creditvector.app/billing/cancel"
  );
  const onCancelPage = await mw.middleware(await requestWith(token, "https://www.creditvector.app/billing/cancel"));
  check("it is never redirected away from the cancellation page itself", onCancelPage.status === 200);

  section("…and the cancellation path actually works for it");
  const state = await session.sessionAccountState(await requestWith(token));
  check("sessionAccountState reports 'disabled'", state.state === "disabled");
  const eligibility = await cancelRoute.GET(await requestWith(token));
  check("the eligibility probe answers 200", eligibility.status === 200);
  const body = (await eligibility.json()) as { eligible?: boolean };
  check("and reports the account as eligible to cancel", body.eligible === true);

  stripeCancelCalls = 0;
  const cancelled = await cancelRoute.POST(await requestWith(token));
  check("the cancellation POST succeeds", cancelled.status === 200);
  check("it reached Stripe exactly once", stripeCancelCalls === 1);
  check("and it was audited", audits.length > 0);

  section("re-enabling does not silently upgrade a cancellation-only cookie");
  rows.set(suspended.id, { ...suspended, disabled: false });
  const refreshed = await jwtFor(null, { ...token });
  check(
    "a refreshed cancellation-only token becomes anonymous, not an active session",
    refreshed.uid === undefined && refreshed.cancellationOnly === undefined
  );
  rows.set(suspended.id, suspended);

  section("control — an ENABLED account is unaffected by any of this");
  const activeToken = await jwtFor(await signIn(active.email, PASSWORD));
  check("an enabled sign-in is not marked cancellation-only", activeToken.cancellationOnly === undefined);
  const activeSession = await sessionFor(activeToken);
  check("and it does get a real session", activeSession !== null);
  const activeLanding = await mw.middleware(await requestWith(activeToken, "https://www.creditvector.app/"));
  check(
    "the landing still forwards an enabled user to the dashboard",
    activeLanding.status === 307 && activeLanding.headers.get("location") === "https://www.creditvector.app/dashboard"
  );
  const activeDash = await mw.middleware(await requestWith(activeToken, "https://www.creditvector.app/dashboard"));
  check("and /dashboard does NOT self-redirect for an enabled user", activeDash.status === 200);
  const activeCancel = await cancelRoute.GET(await requestWith(activeToken));
  const activeBody = (await activeCancel.json()) as { eligible?: boolean; reason?: string };
  check(
    "an enabled account is reported ineligible for the cancellation-only path",
    activeCancel.status === 200 && activeBody.eligible === false && activeBody.reason === "enabled"
  );
  stripeCancelCalls = 0;
  const activePost = await cancelRoute.POST(await requestWith(activeToken));
  check("and its cancellation POST is refused 403", activePost.status === 403);
  check("no Stripe call was made for it", stripeCancelCalls === 0);
});
