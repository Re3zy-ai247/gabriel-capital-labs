// Run: npx tsx scripts/disabled-cancellation-runtime.test.ts
//
// RUNTIME guard for the cancellation-only billing path open to a SUSPENDED account.
// Every assertion below EXECUTES the real exported handlers — app/api/billing/
// self-cancel/route.ts and app/api/stripe/portal/route.ts — and the real
// lib/session.ts and the real NextAuth callbacks, over in-file fakes for raw JWT
// decoding / prisma / next/headers / Stripe. Nothing here is a source-text
// assertion; the scope assertions that must
// be made against source live in scripts/disabled-cancellation-scope.test.ts.
//
// THE DEFECT: currentAccount() fails closed on `disabled`, which is right — but it
// makes a suspended user indistinguishable from a signed-out one on EVERY surface,
// including /api/stripe/portal. A user disabled while holding a live paid
// subscription kept being charged with no self-service way to stop it.
//
// THE FIX'S SHAPE: not a Stripe Billing Portal session. The portal's allowed
// actions come from a Billing Portal *configuration* held in the Stripe dashboard,
// not in this repo (app/api/stripe/portal/route.ts passes no `configuration`, and
// no configuration object exists in the tree), so "cancellation-only" is not
// provable from repository truth and must not be assumed for a disabled user.
// Instead the route performs the cancellation server-side with the same primitive
// app/api/admin/billing/cancel/route.ts already uses, with the subject pinned to
// the caller's own row.
//
// The self-contained fakes are deliberate: this file sits directly under scripts/
// so the existing non-recursive CI glob scripts/*.test.ts picks it up with no CI
// change and no dependency on any other work in flight.
import { NextResponse } from "next/server";
import { createPasswordSessionVersion } from "../lib/sessionVersion";

const TEST_AUTH_SECRET = "disabled-cancellation-runtime-test-secret";
process.env.NEXTAUTH_SECRET = TEST_AUTH_SECRET;

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

// ── Fake world ───────────────────────────────────────────────────────────────
interface Row {
  id: string;
  email: string;
  disabled: boolean;
  plan: string;
  role: string;
  isAgency: boolean;
  managedByAgencyId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  passwordHash: string | null;
}
const rows: Record<string, Row> = {};
function row(over: Partial<Row> & { id: string; email: string }): Row {
  const r: Row = {
    disabled: false, plan: "free", role: "USER", isAgency: false, managedByAgencyId: null,
    stripeCustomerId: null, stripeSubscriptionId: null,
    passwordHash: "$2a$10$test-password-hash", ...over,
  };
  rows[r.id] = r;
  return r;
}

// A suspended PAYING subscriber — the whole point of the path.
const suspendedPayer = row({
  id: "u_suspended", email: "payer@example.com", disabled: true, plan: "premium",
  stripeCustomerId: "cus_payer", stripeSubscriptionId: "sub_payer",
});
// A suspended account with no money attached — must fail closed.
const suspendedFree = row({ id: "u_suspended_free", email: "free@example.com", disabled: true });
// A suspended account whose stored subscription belongs to someone else's customer.
const suspendedMisstitched = row({
  id: "u_mismatch", email: "mismatch@example.com", disabled: true, plan: "premium",
  stripeCustomerId: "cus_mismatch", stripeSubscriptionId: "sub_victim",
});
// An ACTIVE subscriber. Nothing this route does may change what happens to them.
const activePayer = row({
  id: "u_active", email: "active@example.com", plan: "premium",
  stripeCustomerId: "cus_active", stripeSubscriptionId: "sub_active",
});
// The email-reuse trap: the victim moved to a new address and someone else claimed
// the old one. A stale JWT still carries the OLD address alongside the victim's id.
const emailVictim = row({
  id: "u_victim", email: "new@example.com", disabled: true, plan: "premium",
  stripeCustomerId: "cus_victim", stripeSubscriptionId: "sub_victim",
});
const emailSquatter = row({
  id: "u_squatter", email: "recycled@example.com", plan: "premium",
  stripeCustomerId: "cus_squatter", stripeSubscriptionId: "sub_squatter",
});
const blockedDemo = row({
  id: "u_demo", email: "demo@gabrielcapitallabs.com", disabled: true, plan: "premium",
  stripeCustomerId: "cus_demo", stripeSubscriptionId: "sub_demo",
});

let sessionUser: { id?: string; email?: string } | null = null;
let rawSessionToken: Record<string, unknown> | null = null;
const cookieJar: Record<string, string> = {};
const cookieReads: string[] = [];
const lookups: Array<Record<string, unknown>> = [];

const fakePrisma = {
  user: {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      lookups.push(where);
      if (typeof where.id === "string") return rows[where.id] ?? null;
      if (typeof where.email === "string") return Object.values(rows).find((r) => r.email === where.email) ?? null;
      return null;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      lookups.push(where);
      const found = typeof where.id === "string" ? rows[where.id] : undefined;
      if (!found) return null;
      if (where.managedByAgencyId && found.managedByAgencyId !== where.managedByAgencyId) return null;
      return found;
    },
  },
};

// Stripe fake. Every PURCHASING primitive is present and records any call, so
// "this path cannot upgrade or buy" is proven by execution, not by reading source.
const forbiddenCalls: string[] = [];
const retrieved: string[] = [];
const updated: Array<{ id: string; params: Record<string, unknown> }> = [];
const canceled: string[] = [];
const portalSessions: Array<Record<string, unknown>> = [];
interface FakeSub { id: string; customer: string; status: string; cancel_at_period_end: boolean }
const subs: Record<string, FakeSub> = {
  sub_payer: { id: "sub_payer", customer: "cus_payer", status: "active", cancel_at_period_end: false },
  sub_active: { id: "sub_active", customer: "cus_active", status: "active", cancel_at_period_end: false },
  sub_victim: { id: "sub_victim", customer: "cus_victim", status: "active", cancel_at_period_end: false },
  sub_squatter: { id: "sub_squatter", customer: "cus_squatter", status: "active", cancel_at_period_end: false },
};
let stripeConfigured = true;
let retrieveThrows = false;
const fakeStripe = {
  subscriptions: {
    retrieve: async (id: string) => {
      retrieved.push(id);
      if (retrieveThrows) throw new Error(`No such subscription: ${id}; secret sk_live_LEAKY`);
      const s = subs[id];
      if (!s) throw new Error(`No such subscription: ${id}`);
      return { ...s };
    },
    update: async (id: string, params: Record<string, unknown>) => {
      updated.push({ id, params });
      const s = subs[id];
      if (params.cancel_at_period_end === true && s) s.cancel_at_period_end = true;
      return { ...s, ...params };
    },
    cancel: async (id: string) => { canceled.push(id); return { id, status: "canceled" }; },
    create: async () => { forbiddenCalls.push("subscriptions.create"); return {}; },
  },
  checkout: { sessions: { create: async () => { forbiddenCalls.push("checkout.sessions.create"); return {}; } } },
  prices: { create: async () => { forbiddenCalls.push("prices.create"); return {}; } },
  billingPortal: {
    sessions: {
      create: async (params: Record<string, unknown>) => {
        portalSessions.push(params);
        return { url: "https://billing.stripe.com/session/live_test" };
      },
    },
  },
};

let rateLimitResponse: ReturnType<typeof NextResponse.json> | null = null;
const rateLimitKeys: string[] = [];
const audits: Array<{ action: string; actorId: string; targetId?: string }> = [];

const Mod = require("module") as { _load: (...a: unknown[]) => unknown };
const realLoad = Mod._load;
Mod._load = function patched(this: unknown, request: string, parent: unknown, isMain: boolean) {
  if (request === "next-auth") {
    return {
      getServerSession: async (options: {
        callbacks?: {
          jwt?: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
          session?: (args: Record<string, unknown>) => Promise<unknown>;
        };
      }) => {
        if (!rawSessionToken || !sessionUser) return null;
        const token = options.callbacks?.jwt
          ? await options.callbacks.jwt({ token: { ...rawSessionToken }, user: undefined })
          : { ...rawSessionToken };
        if (!options.callbacks?.session) return { user: sessionUser };
        return options.callbacks.session({
          session: {
            user: { email: sessionUser.email ?? null },
            expires: new Date(Date.now() + 60_000).toISOString(),
          },
          token,
        });
      },
    };
  }
  if (request === "next-auth/jwt") return { getToken: async () => rawSessionToken };
  if (request === "next/headers") {
    return {
      cookies: () => ({
        get: (name: string) => { cookieReads.push(name); return cookieJar[name] ? { value: cookieJar[name] } : undefined; },
      }),
    };
  }
  if (request === "./prisma" || request === "@/lib/prisma") return { prisma: fakePrisma };
  if (request === "@/lib/stripe") {
    return { getStripe: () => (stripeConfigured ? fakeStripe : null), siteUrl: () => "https://www.creditvector.app" };
  }
  if (request === "@/lib/admin") {
    return {
      logAudit: async (p: { actor: { id: string }; action: string; targetId?: string }) => {
        audits.push({ action: p.action, actorId: p.actor.id, targetId: p.targetId });
      },
    };
  }
  if (request === "@/lib/rateLimit") {
    return {
      enforceRateLimit: async (key: string) => { rateLimitKeys.push(key); return rateLimitResponse; },
      clientIp: () => "127.0.0.1",
    };
  }
  return realLoad.apply(this, [request, parent, isMain] as never);
} as never;

// The REAL session module, over the fakes above.
const session = require("../lib/session") as typeof import("../lib/session");
const { authOptions } = require("../lib/auth") as typeof import("../lib/auth");
// Route files import "@/lib/session" — hand them the very same real instance.
const outerPatched = Mod._load;
Mod._load = function patched2(this: unknown, request: string, parent: unknown, isMain: boolean) {
  if (request === "@/lib/session") return session;
  return (outerPatched as (...a: unknown[]) => unknown).apply(this, [request, parent, isMain]);
} as never;

const selfCancel = require("../app/api/billing/self-cancel/route") as {
  GET: (req: Request) => Promise<Response>;
  POST: (req: Request) => Promise<Response>;
};
const portal = require("../app/api/stripe/portal/route") as { POST: () => Promise<Response> };

function signInAs(r: Row | null, emailOverride?: string) {
  sessionUser = r ? { id: r.id, email: emailOverride ?? r.email } : null;
  const sessionVersion = r
    ? createPasswordSessionVersion(r.id, r.passwordHash, process.env.NEXTAUTH_SECRET)
    : null;
  rawSessionToken = r && sessionVersion
    ? { uid: r.id, email: emailOverride ?? r.email, sessionVersion }
    : null;
}
const authRequest = () => new Request("https://www.creditvector.app/api/billing/self-cancel");
const cancelGet = () => selfCancel.GET(authRequest());
const cancelPost = (req: Request = authRequest()) => selfCancel.POST(req);
async function body(res: Response) { return (await res.json()) as Record<string, unknown>; }
const textOf = (b: Record<string, unknown>) => JSON.stringify(b);

async function run() {
  // ── CASE 1 — RUNTIME. An ENABLED account's ordinary portal path is unchanged ──
  signInAs(activePayer);
  const p1 = await portal.POST();
  const p1b = await body(p1);
  check("1 RUNTIME enabled account still gets a portal session (200 + url)",
    p1.status === 200 && typeof p1b.url === "string");
  check("1 RUNTIME the portal was opened against the enabled user's own customer",
    portalSessions.length === 1 && portalSessions[0].customer === "cus_active");

  // ── CASE 2 — RUNTIME. A DISABLED account cannot use the ordinary portal ──────
  signInAs(suspendedPayer);
  const p2 = await portal.POST();
  check("2 RUNTIME disabled account is refused by /api/stripe/portal with 401", p2.status === 401);
  check("2 RUNTIME no portal session was minted for the disabled account", portalSessions.length === 1);
  check("2 RUNTIME currentAccount() reads the disabled account as no account",
    (await session.currentAccount()) === null);

  // ── CASE 3 — RUNTIME. A disabled PAYING user CAN cancel, and only cancel ─────
  signInAs(suspendedPayer);
  const callbackToken = await authOptions.callbacks?.jwt?.({
    token: { ...rawSessionToken },
    user: undefined,
  } as never);
  check("3 COMPOSITION the JWT callback retains only cancellation-only keyed evidence",
    callbackToken?.uid === suspendedPayer.id &&
    callbackToken?.sessionVersion === rawSessionToken?.sessionVersion &&
    callbackToken?.cancellationOnly === true &&
    Object.keys(callbackToken).length === 3);
  const callbackSession = await authOptions.callbacks?.session?.({
    session: {
      user: { email: suspendedPayer.email },
      expires: new Date(Date.now() + 60_000).toISOString(),
    },
    token: callbackToken ?? {},
  } as never);
  check("3 COMPOSITION the normal session projection is null for the disabled principal",
    callbackSession === null);
  // NextAuth re-encodes callbackToken after every session read. Feed that exact
  // minimal payload into the raw resolver to prove cancellation survives refresh.
  rawSessionToken = callbackToken ? { ...callbackToken } : null;
  const cancellationState = await session.sessionAccountState(authRequest() as never);
  check("3 COMPOSITION the narrow resolver validates the re-encoded callback JWT",
    cancellationState.state === "disabled" && cancellationState.account.id === suspendedPayer.id);
  const g3 = await body(await cancelGet());
  check("3 RUNTIME eligibility reports the suspended payer as eligible", g3.eligible === true);
  const c3 = await cancelPost();
  const c3b = await body(c3);
  check("3 RUNTIME suspended payer's cancellation succeeds (200 ok)", c3.status === 200 && c3b.ok === true);
  check("3 RUNTIME exactly one Stripe mutation was issued", updated.length === 1);
  check("3 RUNTIME it targeted the caller's OWN subscription", updated[0]?.id === "sub_payer");
  check("3 RUNTIME it scheduled cancel_at_period_end (paid time is not forfeited)",
    updated[0]?.params.cancel_at_period_end === true);
  check("3 RUNTIME nothing was canceled immediately", canceled.length === 0);
  check("3 RUNTIME the action was audited against the acting user",
    audits.some((a) => a.action === "billing.self_cancel" && a.actorId === "u_suspended" && a.targetId === "sub_payer"));
  check("3 RUNTIME the rate limiter was applied, keyed by immutable user id",
    rateLimitKeys.includes("billing:self-cancel:u_suspended"));
  check("3 RUNTIME the response body leaks no Stripe identifier",
    !/cus_|sub_|sk_live/.test(textOf(c3b)));

  // The raw-token exception is usable only with current, complete, keyed evidence.
  // These refusals happen before Stripe, and do not alter the normal callback.
  const before3Negative = updated.length;
  signInAs(suspendedPayer);
  rawSessionToken = {
    ...rawSessionToken,
    sessionVersion: createPasswordSessionVersion(
      suspendedPayer.id,
      "$2a$10$stale-password-hash",
      TEST_AUTH_SECRET,
    ),
  };
  check("3 COMPOSITION a stale password-version JWT cannot use cancellation",
    (await cancelPost()).status === 401);
  signInAs(suspendedPayer);
  rawSessionToken = { uid: suspendedPayer.id, email: suspendedPayer.email };
  check("3 COMPOSITION a malformed JWT cannot use cancellation",
    (await cancelPost()).status === 401);
  signInAs(suspendedPayer);
  const configuredSecret = process.env.NEXTAUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  check("3 COMPOSITION missing validation key fails cancellation closed",
    (await cancelPost()).status === 401);
  process.env.NEXTAUTH_SECRET = configuredSecret;
  signInAs(blockedDemo);
  check("3 COMPOSITION the blocked demo principal cannot use cancellation",
    (await cancelPost()).status === 401);
  check("3 COMPOSITION invalid raw-token evidence never reaches Stripe",
    updated.length === before3Negative);

  // ── CASE 4 — RUNTIME. A disabled NON-paying account fails closed ─────────────
  const mutationsBefore4 = updated.length;
  signInAs(suspendedFree);
  const g4 = await body(await cancelGet());
  check("4 RUNTIME eligibility reports a suspended non-payer as ineligible", g4.eligible === false);
  const c4 = await cancelPost();
  check("4 RUNTIME suspended non-payer is refused (404, nothing to cancel)", c4.status === 404);
  check("4 RUNTIME no Stripe call was made for the non-payer",
    updated.length === mutationsBefore4 && !retrieved.includes("undefined"));

  // ── CASE 5 — RUNTIME. A mutable email cannot redirect identity ───────────────
  // The stale JWT carries the victim's id but an address now owned by someone else.
  lookups.length = 0;
  signInAs(emailVictim, "recycled@example.com");
  const state5 = await session.sessionAccountState(authRequest() as never);
  check("5 RUNTIME identity followed the immutable id, not the session email",
    state5.state === "disabled" && state5.account?.id === "u_victim");
  check("5 RUNTIME the squatter who owns that address was never resolved",
    !lookups.some((w) => w.email === "recycled@example.com"));
  check("5 RUNTIME every lookup was keyed by id", lookups.length > 0 && lookups.every((w) => typeof w.id === "string"));

  // The helper must also ignore the workspace and impersonation cookies, which are
  // the other two ways one account can be resolved as another.
  cookieReads.length = 0;
  cookieJar["gcl_client"] = "u_active";
  cookieJar["gcl_impersonate"] = "u_active";
  const state5b = await session.sessionAccountState(authRequest() as never);
  check("5 RUNTIME sessionAccountState reads NO cookies at all", cookieReads.length === 0);
  check("5 RUNTIME cookies cannot redirect the resolved subject",
    state5b.state === "disabled" && state5b.account?.id === "u_victim");

  // ── CASE 6 — RUNTIME. Nobody can cancel someone else's subscription ──────────
  // (a) The handler reads NO body, so an injected subscription id is inert.
  const before6 = updated.length;
  signInAs(emailVictim);
  const c6 = await cancelPost(
    new Request("https://www.creditvector.app/api/billing/self-cancel", {
      method: "POST",
      body: JSON.stringify({ subscriptionId: "sub_squatter", immediate: true }),
      headers: { "content-type": "application/json" },
    })
  );
  check("6 RUNTIME an injected subscriptionId is ignored (200 for the caller's own sub)", c6.status === 200);
  check("6 RUNTIME the injected foreign subscription was never touched",
    !updated.slice(before6).some((u) => u.id === "sub_squatter") && !canceled.includes("sub_squatter"));
  check("6 RUNTIME only the caller's own subscription was mutated",
    updated.length === before6 + 1 && updated[before6]?.id === "sub_victim");
  check("6 RUNTIME an injected immediate:true flag cannot force an instant cancel", canceled.length === 0);

  // (b) A mis-stitched row pointing at another customer's subscription is refused.
  const before6b = updated.length;
  signInAs(suspendedMisstitched);
  const c6b = await cancelPost();
  const c6bb = await body(c6b);
  check("6 RUNTIME a subscription owned by another customer is refused (409)", c6b.status === 409);
  check("6 RUNTIME the mismatched subscription was NOT mutated", updated.length === before6b);
  check("6 RUNTIME the refusal is audited", audits.some((a) => a.action === "billing.self_cancel_refused"));
  check("6 RUNTIME the refusal leaks no Stripe identifier", !/cus_|sub_/.test(textOf(c6bb)));

  // ── CASE 10 — RUNTIME. Repeated cancellation is idempotent ──────────────────
  const before10 = updated.length;
  signInAs(suspendedPayer); // already scheduled by CASE 3
  const c10 = await cancelPost();
  const c10b = await body(c10);
  check("10 RUNTIME a repeat cancellation succeeds", c10.status === 200 && c10b.ok === true);
  check("10 RUNTIME it reports the already-canceled state", c10b.alreadyCanceled === true);
  check("10 RUNTIME NO second Stripe mutation was issued", updated.length === before10);

  subs.sub_payer.status = "canceled";
  const c10c = await body(await cancelPost());
  check("10 RUNTIME an already-canceled subscription also short-circuits",
    c10c.ok === true && c10c.alreadyCanceled === true && updated.length === before10);
  subs.sub_payer.status = "active";
  subs.sub_payer.cancel_at_period_end = false;

  // ── CASE 11 — RUNTIME. A Stripe failure gives recoverable guidance ───────────
  retrieveThrows = true;
  signInAs(suspendedPayer);
  const c11 = await cancelPost();
  const c11b = await body(c11);
  const msg11 = String(c11b.error ?? "");
  check("11 RUNTIME a Stripe failure answers 502, not a crash", c11.status === 502);
  check("11 RUNTIME the message is recoverable human guidance",
    /try again/i.test(msg11) && /support@/.test(msg11));
  check("11 RUNTIME it states nothing was changed", /nothing was changed/i.test(msg11));
  check("11 RUNTIME the Stripe error text, ids and keys are NOT echoed",
    !/No such subscription/.test(msg11) && !/sk_live/.test(msg11) && !/sub_|cus_/.test(msg11));
  check("11 RUNTIME no stack trace is returned", !/at\s+\w+\s+\(/.test(textOf(c11b)));
  retrieveThrows = false;

  // Unconfigured Stripe is also recoverable, not a 500.
  stripeConfigured = false;
  const c11c = await cancelPost();
  check("11 RUNTIME an unconfigured Stripe answers 503 with support guidance",
    c11c.status === 503 && /support@/.test(String((await body(c11c)).error ?? "")));
  stripeConfigured = true;

  // Rate-limit refusals surface as 429 and stop before any Stripe work.
  const before11d = updated.length;
  rateLimitResponse = NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const c11d = await cancelPost();
  check("11 RUNTIME an over-limit caller gets 429 and no Stripe mutation",
    c11d.status === 429 && updated.length === before11d);
  rateLimitResponse = null;

  // ── CASE 8 — RUNTIME. Direct API bypass fails ───────────────────────────────
  const before8 = updated.length;
  signInAs(null);
  const c8 = await cancelPost();
  check("8 RUNTIME an unauthenticated POST is refused with 401", c8.status === 401);
  const g8 = await cancelGet();
  check("8 RUNTIME an unauthenticated GET is refused with 401", g8.status === 401);
  // A session id with no row (deleted user) must read as anonymous, not disabled.
  sessionUser = { id: "u_does_not_exist", email: "ghost@example.com" };
  rawSessionToken = {
    uid: "u_does_not_exist",
    email: "ghost@example.com",
    sessionVersion: createPasswordSessionVersion(
      "u_does_not_exist",
      "$2a$10$deleted-account-hash",
      process.env.NEXTAUTH_SECRET,
    ),
  };
  const c8b = await cancelPost();
  check("8 RUNTIME a session pointing at no row is refused with 401", c8b.status === 401);
  check("8 RUNTIME no bypass attempt reached Stripe", updated.length === before8);

  // ── CASE 7 + CASE 1 (again) — RUNTIME. No upgrade or purchase is reachable ──
  check("7 RUNTIME no checkout session, subscription or price was EVER created",
    forbiddenCalls.length === 0);
  check("7 RUNTIME the cancellation path never minted a Billing Portal session",
    portalSessions.length === 1 && portalSessions[0].customer === "cus_active");
  check("7 RUNTIME every Stripe mutation in this run was cancel_at_period_end",
    updated.length > 0 && updated.every((u) => u.params.cancel_at_period_end === true && Object.keys(u.params).length === 1));

  // ── CASE 9 — RUNTIME. A missing Stripe customer fails closed ────────────────
  const before9 = updated.length;
  const noCustomer = row({
    id: "u_no_customer", email: "nocus@example.com", disabled: true, plan: "premium",
    stripeCustomerId: null, stripeSubscriptionId: "sub_payer",
  });
  signInAs(noCustomer);
  const c9 = await cancelPost();
  check("9 RUNTIME a row with a subscription but NO customer is refused (404)", c9.status === 404);
  check("9 RUNTIME it did not cancel the subscription it had no customer for",
    updated.length === before9 && !updated.some((u) => u.id === "sub_payer" && updated.indexOf(u) >= before9));
  const noSub = row({
    id: "u_no_sub", email: "nosub@example.com", disabled: true, plan: "premium",
    stripeCustomerId: "cus_payer", stripeSubscriptionId: null,
  });
  signInAs(noSub);
  check("9 RUNTIME a row with a customer but NO subscription is refused (404)",
    (await cancelPost()).status === 404);
  check("9 RUNTIME neither fail-closed case reached Stripe", updated.length === before9);

  // ── CASE 12 — RUNTIME. No normal application access is restored ──────────────
  // The canceller from CASE 3 is still, after cancelling, invisible to every gate.
  signInAs(suspendedPayer);
  check("12 RUNTIME currentAccount() still returns null after cancelling",
    (await session.currentAccount()) === null);
  check("12 RUNTIME currentUser() still returns null after cancelling",
    (await session.currentUser()) === null);
  cookieJar["gcl_impersonate"] = "u_active";
  cookieJar["gcl_client"] = "u_active";
  check("12 RUNTIME a disabled account cannot reach another user via cookies either",
    (await session.currentUser()) === null);
  check("12 RUNTIME the ordinary portal still refuses them after cancelling",
    (await portal.POST()).status === 401);
  check("12 RUNTIME the account row is still disabled (nothing re-enabled it)",
    rows["u_suspended"].disabled === true);
  check("12 RUNTIME the plan/role on the row were never rewritten by this path",
    rows["u_suspended"].plan === "premium" && rows["u_suspended"].role === "USER");
  delete cookieJar["gcl_impersonate"];
  delete cookieJar["gcl_client"];

  // ── CASE 1 (closing) — the enabled path is byte-for-byte the same as before ──
  signInAs(activePayer);
  const c1b = await cancelPost();
  const c1bb = await body(c1b);
  check("1 RUNTIME an ENABLED account is refused by the cancellation path (403)", c1b.status === 403);
  check("1 RUNTIME it is redirected to the ordinary billing page, not served here",
    /billing page/i.test(String(c1bb.error ?? "")));
  const g1 = await body(await cancelGet());
  check("1 RUNTIME eligibility reports an enabled account as ineligible here",
    g1.eligible === false && g1.reason === "enabled");
  check("1 RUNTIME the enabled account's subscription was never touched",
    !updated.some((u) => u.id === "sub_active") && !canceled.includes("sub_active"));
  const p1c = await portal.POST();
  check("1 RUNTIME the enabled account can still open the ordinary portal", p1c.status === 200);
  check("1 RUNTIME the ordinary portal call still passes no `configuration`",
    portalSessions.every((s) => !("configuration" in s)));

  // ── CASE 13 — RUNTIME. The route's EXPORTED SURFACE is pinned ───────────────
  // "Cancellation-only" was enforced for POST but not for the module. An
  // adversarial review appended `export async function DELETE()` calling
  // stripe.subscriptions.resume and the ENTIRE guard suite stayed green: no check
  // looked at what the module exports, and a method this file never invokes is
  // invisible to behavioural assertions. Pin the surface itself, as an ALLOWLIST —
  // a denylist of Stripe methods would have to anticipate every future one.
  //
  // Next.js treats each uppercase HTTP-verb export of a route module as a live
  // endpoint, so an unlisted verb here is not dead code: it is a reachable, ungated
  // capability on a route whose entire justification is that it has exactly one.
  const HTTP_VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  const selfCancelModule = require("../app/api/billing/self-cancel/route") as Record<string, unknown>;
  const exportedVerbs = HTTP_VERBS.filter((v) => typeof selfCancelModule[v] === "function");
  check("13 RUNTIME the route exports exactly GET and POST — no other HTTP method",
    exportedVerbs.length === 2 && exportedVerbs.includes("GET") && exportedVerbs.includes("POST"));
  const ALLOWED_EXPORTS = new Set(["GET", "POST", "dynamic", "runtime"]);
  const unexpected = Object.keys(selfCancelModule).filter((k) => !ALLOWED_EXPORTS.has(k));
  check("13 RUNTIME the route exports nothing beyond GET, POST and the route config",
    unexpected.length === 0);

  // ── CASE 14 — RUNTIME. The GET body carries no Stripe identifier ────────────
  // The handler documents "Returns booleans and human copy only — never a Stripe
  // customer or subscription id" and nothing enforced it: the only leak assertion
  // in this file was applied to the POST body. Adding the caller's own ids to the
  // GET body left all guards green. Assert the body BOTH ways — no id-shaped
  // substring, and an explicit key allowlist so a future field cannot smuggle one
  // in under a different name.
  const GET_KEYS = new Set(["eligible", "reason", "message", "error"]);
  for (const [label, row] of [
    ["suspended payer", suspendedPayer],
    ["suspended non-payer", suspendedFree],
    ["enabled account", activePayer],
  ] as Array<[string, Row]>) {
    signInAs(row);
    const g = await body(await cancelGet());
    check(`14 RUNTIME the GET body for the ${label} leaks no Stripe identifier`,
      !/cus_|sub_|sk_live|sk_test|price_/.test(textOf(g)));
    check(`14 RUNTIME the GET body for the ${label} carries only allowlisted keys`,
      Object.keys(g).every((k) => GET_KEYS.has(k)));
  }

  console.log(`\ndisabled-cancellation-runtime.test.ts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error("guard crashed", e);
  process.exit(1);
});
