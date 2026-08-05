// Run: npx --no-install tsx scripts/runtime/terms-acceptance.runtime.test.ts
//
// MOCKED RUNTIME guard for B-06 — durable Terms-of-Service acceptance on the
// in-place plan upgrade. This EXECUTES the real app/api/stripe/checkout/route.ts
// and the real lib/terms.ts against fake Prisma and Stripe doubles, and asserts on
// what they DID: the status they returned, the order in which the acceptance write
// and the billing mutation happened, and which rows exist afterwards.
//
// scripts/terms-acceptance.test.ts pins the same properties by reading source. It
// cannot tell you that the route actually returned 428, or that the upsert really
// preceded subscriptions.update at execution time. This file can. Neither replaces
// production verification: no Postgres and no Stripe are involved here.
//
// Covers: ordering (acceptance before any billing mutation) · fail-closed 428 with
// zero Stripe mutation · idempotent re-acceptance under a real UNIQUE constraint ·
// a Stripe failure AFTER acceptance leaving the record intact and the purchase
// incomplete.
import { check, section, loadModule, mockModule, mockPackage, requireActual, run } from "./_harness";
import { CallLog, FakePrisma, makeFakeStripe, MUTATING_STRIPE_CALLS, type FakeUserRow } from "./_fakes";

const log = new CallLog();
const prisma = new FakePrisma(log);

// Mutable holders so each scenario can swap the Stripe double and the signed-in
// account without reloading the route (module-level state must stay warm, exactly
// as it is in a running server).
let stripeDouble: ReturnType<typeof makeFakeStripe> = makeFakeStripe(log);
let account: FakeUserRow | null = null;
const reported: unknown[] = [];
const tracked: Array<{ name: string; payload: unknown }> = [];

// ── mocks: every I/O boundary the route touches ─────────────────────────────
mockModule("lib/prisma.ts", { prisma });
mockModule("lib/auth.ts", { authOptions: {} });
mockModule("lib/session.ts", { currentAccount: async () => account });
mockModule("lib/billing.ts", {
  getOrCreateStripeCustomer: async (_s: unknown, u: FakeUserRow) => {
    log.record("billing.getOrCreateStripeCustomer");
    return u.stripeCustomerId ?? "cus_fake";
  },
});
mockModule("lib/stripe.ts", {
  ...(requireActual("lib/stripe.ts") as Record<string, unknown>),
  getStripe: () => stripeDouble,
  resolvePrice: async () => "price_letters_5",
  resolvePriceId: async (_s: unknown, plan: string, interval: string) => `price_${plan}_${interval}`,
  siteUrl: () => "https://runtime.test",
});
mockModule("lib/events.ts", {
  ...(requireActual("lib/events.ts") as Record<string, unknown>),
  track: async (name: string, payload: unknown) => {
    log.record(`events.track:${name}`);
    tracked.push({ name, payload });
  },
});
mockModule("lib/observability.ts", {
  reportError: (e: unknown) => {
    reported.push(e);
  },
});
mockModule("lib/log.ts", { requestId: () => "req_runtime_test" });
mockPackage("next-auth/next", {
  getServerSession: async () => (account ? { user: { id: account.id } } : null),
});

// ── modules under test (loaded AFTER the mocks are registered) ──────────────
const terms = loadModule<{
  CURRENT_TERMS_VERSION: string;
  TERMS_URL: string;
  hasAcceptedTermsVersion(userId: string, version?: string): Promise<boolean>;
  recordTermsAcceptance(userId: string, version: string, context: string): Promise<void>;
}>("lib/terms.ts");
const route = loadModule<{ POST(req: Request): Promise<Response> }>("app/api/stripe/checkout/route.ts");

const VERSION = terms.CURRENT_TERMS_VERSION;

function activeSubscription(priceId: string) {
  return {
    id: "sub_existing",
    status: "active",
    items: { data: [{ id: "si_existing", price: { id: priceId } }] },
  };
}

function signIn(id: string, plan = "premium"): FakeUserRow {
  const user: FakeUserRow = {
    id,
    email: `${id}@runtime.test`,
    name: "Runtime Test",
    plan,
    stripeCustomerId: `cus_${id}`,
  };
  prisma.seedUser(user);
  account = user;
  return user;
}

async function postCheckout(body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const req = new Request("https://runtime.test/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await route.POST(req);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

function resetScenario(opts: { updateError?: Error } = {}): void {
  log.reset();
  tracked.length = 0;
  reported.length = 0;
  prisma.userUpdates.length = 0;
  stripeDouble = makeFakeStripe(log, {
    subscriptions: [activeSubscription("price_premium_month")],
    updateError: opts.updateError ?? null,
  });
}

run("terms-acceptance.runtime.test.ts", async () => {
  // ── 1 · acceptance is recorded BEFORE any Stripe mutation ─────────────────
  section("1. the acceptance is written BEFORE the subscription is mutated (ordering, not presence)");
  resetScenario();
  const u1 = signIn("u_order");
  const r1 = await postCheckout({ plan: "agency", interval: "month", acceptTerms: VERSION });

  check("the upgrade succeeded (the ordering assertions below are not vacuous)",
    r1.status === 200 && r1.json.upgraded === true);
  check("the acceptance was actually written at runtime",
    log.has("prisma.termsAcceptance.upsert"));
  check("Stripe was actually asked to change the subscription",
    log.has("stripe.subscriptions.update"));
  check("the acceptance write happened BEFORE stripe.subscriptions.update",
    log.before("prisma.termsAcceptance.upsert", "stripe.subscriptions.update"));
  check("no money-moving Stripe call preceded the acceptance write " +
    `(preceding: ${log.precedingCalls("prisma.termsAcceptance.upsert").join(", ") || "none"})`,
    log.precedingCalls("prisma.termsAcceptance.upsert").every((c) => !MUTATING_STRIPE_CALLS.has(c)));
  check("exactly one acceptance row exists for the account",
    prisma.termsRowsFor(u1.id).length === 1);
  check("the row records the SERVER's published version, not a client string",
    prisma.termsRowsFor(u1.id)[0]?.version === VERSION);
  check("the row records WHERE the acceptance was given",
    prisma.termsRowsFor(u1.id)[0]?.context === "stripe_subscription_upgrade");
  check("the row is keyed to the id-resolved account",
    prisma.termsRowsFor(u1.id)[0]?.userId === u1.id);

  // ── 2 · missing acceptance → 428 and NO Stripe call ───────────────────────
  section("2. an upgrade without acceptance is refused 428 and mutates nothing");
  resetScenario();
  const u2 = signIn("u_no_consent");
  const r2 = await postCheckout({ plan: "agency", interval: "month" });

  check("the response status is 428 Precondition Required", r2.status === 428);
  check("the refusal is machine-readable (termsRequired)", r2.json.termsRequired === true);
  check("the refusal names the version the customer must accept", r2.json.termsVersion === VERSION);
  check("the refusal links to the published terms", r2.json.termsUrl === terms.TERMS_URL);
  check("NO Stripe subscription was modified", !log.has("stripe.subscriptions.update"));
  check("NO Stripe Checkout Session was opened", !log.has("stripe.checkout.sessions.create"));
  check("no money-moving Stripe call happened at all " +
    `(calls: ${log.entries.join(", ")})`,
    log.entries.every((c) => !MUTATING_STRIPE_CALLS.has(c)));
  check("no acceptance row was manufactured for the refused request",
    prisma.termsRowsFor(u2.id).length === 0);
  check("no plan was written for the refused request", prisma.userUpdates.length === 0);
  check("no subscription-started event was emitted", tracked.length === 0);

  // A client that asserts a DIFFERENT version cannot choose what it is deemed to
  // have accepted — the server compares against its own constant.
  resetScenario();
  const r2b = await postCheckout({ plan: "agency", interval: "month", acceptTerms: "1999-01-01" });
  check("an assertion naming a different terms revision is still refused 428", r2b.status === 428);
  check("...and still mutates nothing in Stripe", !log.has("stripe.subscriptions.update"));
  check("...and still writes no acceptance row", prisma.termsRowsFor(u2.id).length === 0);

  resetScenario();
  const r2c = await postCheckout({ plan: "agency", interval: "month", acceptTerms: true });
  check("a truthy non-version assertion (acceptTerms: true) is refused 428", r2c.status === 428);
  check("...and mutates nothing in Stripe", !log.has("stripe.subscriptions.update"));

  // ── 3 · repeated acceptance is idempotent ─────────────────────────────────
  section("3. repeated acceptance is idempotent — the UNIQUE constraint holds");
  const u3 = signIn("u_idempotent");
  await terms.recordTermsAcceptance(u3.id, VERSION, "stripe_subscription_upgrade");
  const first = prisma.termsRowsFor(u3.id)[0];
  const firstAcceptedAt = first?.acceptedAt.getTime();
  let threw: unknown = null;
  try {
    await terms.recordTermsAcceptance(u3.id, VERSION, "stripe_subscription_upgrade");
    await terms.recordTermsAcceptance(u3.id, VERSION, "stripe_subscription_upgrade");
  } catch (e) {
    threw = e;
  }
  check("re-recording the same acceptance does not throw", threw === null);
  check("re-recording creates no duplicate row", prisma.termsRowsFor(u3.id).length === 1);
  check("the ORIGINAL acceptedAt survives (first agreement is the legal timestamp)",
    prisma.termsRowsFor(u3.id)[0]?.acceptedAt.getTime() === firstAcceptedAt);
  check("the stored row still carries its original id",
    prisma.termsRowsFor(u3.id)[0]?.id === first?.id);

  // Prove the constraint being relied on is REAL in this harness: a raw duplicate
  // create raises P2002. Without this, "no duplicate row" could be an artefact of
  // a fake that silently allows duplicates and returns the first.
  let dupCode: string | null = null;
  try {
    await prisma.termsAcceptance.create({
      data: { userId: u3.id, version: VERSION, context: "stripe_subscription_upgrade" },
    });
  } catch (e) {
    dupCode = (e as { code?: string }).code ?? null;
  }
  check("the harness enforces UNIQUE(userId, version) — a duplicate create raises P2002 " +
    "(so the idempotency checks above are not vacuous)", dupCode === "P2002");

  // Route-level idempotency: a customer who already accepted is not asked again,
  // and no second row appears.
  resetScenario();
  const r3 = await postCheckout({ plan: "agency", interval: "month" });
  check("an already-accepted customer is NOT re-prompted (no 428 without acceptTerms)",
    r3.status === 200 && r3.json.upgraded === true);
  check("the second upgrade wrote no second acceptance row",
    prisma.termsRowsFor(u3.id).length === 1);
  check("the already-accepted path skips the write entirely (no upsert issued)",
    !log.has("prisma.termsAcceptance.upsert"));

  // ── 4 · Stripe fails AFTER acceptance ─────────────────────────────────────
  section("4. Stripe fails AFTER acceptance — the record survives, the purchase does not complete");
  const stripeOutage = new Error("fake Stripe: card_declined / API failure");
  resetScenario({ updateError: stripeOutage });
  const u4 = signIn("u_stripe_fails");
  const r4 = await postCheckout({ plan: "agency", interval: "month", acceptTerms: VERSION });

  check("the acceptance was written before Stripe was called",
    log.before("prisma.termsAcceptance.upsert", "stripe.subscriptions.update"));
  check("Stripe was called and failed", log.has("stripe.subscriptions.update"));
  check("the caller gets a failure, not a success", r4.status === 500);
  check("the response does not claim an upgrade", r4.json.upgraded === undefined);
  check("the acceptance record SURVIVES the Stripe failure",
    prisma.termsRowsFor(u4.id).length === 1);
  check("the surviving record is the customer's own, at the published version",
    prisma.termsRowsFor(u4.id)[0]?.userId === u4.id &&
    prisma.termsRowsFor(u4.id)[0]?.version === VERSION);
  check("the acceptance is NOT treated as a completed purchase — no plan was written",
    prisma.userUpdates.length === 0);
  check("the account's plan is unchanged", prisma.users.get(u4.id)?.plan === "premium");
  check("no subscription-started event was emitted for the failed upgrade",
    tracked.length === 0);
  check("the failure was reported to observability", reported.length === 1);

  // The record must not be mistaken for consent to a LATER revision.
  check("acceptance of the current version does not satisfy a different version",
    (await terms.hasAcceptedTermsVersion(u4.id, VERSION)) === true &&
    (await terms.hasAcceptedTermsVersion(u4.id, "2099-01-01")) === false);

  // A retry after the outage must not double-write.
  resetScenario();
  const r4b = await postCheckout({ plan: "agency", interval: "month" });
  check("the retry after the outage succeeds without re-prompting", r4b.status === 200);
  check("the retry adds no second acceptance row", prisma.termsRowsFor(u4.id).length === 1);

  // ── 5 · users who never accepted have no row ──────────────────────────────
  section("5. nothing manufactures consent");
  check("a user who never accepted has no acceptance row",
    prisma.termsRowsFor("u_never_seen").length === 0);
  check("hasAcceptedTermsVersion is false for that user",
    (await terms.hasAcceptedTermsVersion("u_never_seen")) === false);
  check("the total row count equals exactly the accounts that explicitly accepted " +
    `(${prisma.terms.size})`,
    prisma.terms.size === 3);
});
