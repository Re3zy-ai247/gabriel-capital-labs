// Run: npx --no-install tsx scripts/runtime/unknown-price-failclosed.runtime.test.ts
//
// MOCKED RUNTIME guard: an UNRECOGNIZED Stripe price must never provision a paid
// plan. This EXECUTES the real lib/stripe.ts planForPrice, the real
// lib/billing.ts syncSubscriptionToUser, and the real webhook route against a
// fake Prisma that records every `data` object handed to user.update — so the
// assertion is "the write did not CONTAIN a plan", which a final-state read alone
// cannot distinguish from "it wrote the same plan back".
//
// The failure this pins: a hand-created, imported or legacy Stripe price (or a
// price created at the wrong amount) arriving on an ACTIVE subscription must leave
// the account's entitlement exactly as it was, and must be reported. Revocation is
// the one direction that is always safe, so an INACTIVE subscription still writes
// plan="free" no matter what the price says.
import { check, section, loadModule, mockModule, requireActual, run } from "./_harness";
import { CallLog, FakePrisma, makeFakeStripe } from "./_fakes";

const log = new CallLog();
const prisma = new FakePrisma(log);
let stripeDouble: ReturnType<typeof makeFakeStripe> = makeFakeStripe(log);
const reported: Array<{ message: string; context: Record<string, unknown> }> = [];

mockModule("lib/prisma.ts", { prisma });
mockModule("lib/stripe.ts", {
  ...(requireActual("lib/stripe.ts") as Record<string, unknown>),
  getStripe: () => stripeDouble,
});
mockModule("lib/observability.ts", {
  reportError: (e: unknown, context: Record<string, unknown>) => {
    reported.push({ message: (e as Error)?.message ?? String(e), context });
  },
});
mockModule("lib/events.ts", {
  ...(requireActual("lib/events.ts") as Record<string, unknown>),
  track: async () => undefined,
});

// Real code under test.
const stripeLib = loadModule<{
  planForPrice(p: { lookup_key?: string | null; unit_amount?: number | null } | null): string | null;
}>("lib/stripe.ts");
const billing = loadModule<{
  syncSubscriptionToUser(sub: unknown): Promise<void>;
}>("lib/billing.ts");
process.env.STRIPE_WEBHOOK_SECRET = "whsec_runtime_test_placeholder";
const route = loadModule<{ POST(req: Request): Promise<Response> }>("app/api/stripe/webhook/route.ts");

const KNOWN_AGENCY = { id: "price_known_agency", lookup_key: "gcl_agency_monthly", unit_amount: 39900 };
const UNKNOWN_BY_KEY = { id: "price_rogue", lookup_key: "imported_legacy_plan", unit_amount: 12345 };
const UNKNOWN_NO_KEY = { id: "price_rogue_2", lookup_key: null, unit_amount: 4200 };

/** `accountId` is the User id; the Stripe customer is derived the same way seed() does. */
function subscription(accountId: string, status: string, price: Record<string, unknown>) {
  return {
    id: `sub_${accountId}`,
    status,
    customer: `cus_${accountId}`,
    current_period_end: 1900000000,
    items: { data: [{ id: "si_1", price }] },
  };
}

function seed(id: string, plan: string, isAgency = false): void {
  prisma.seedUser({
    id,
    email: `${id}@runtime.test`,
    plan,
    isAgency,
    role: "USER",
    stripeCustomerId: `cus_${id}`,
  });
}

function lastUpdateData(): Record<string, unknown> {
  return prisma.userUpdates[prisma.userUpdates.length - 1]?.data ?? {};
}

function reset(): void {
  log.reset();
  reported.length = 0;
  prisma.userUpdates.length = 0;
}

run("unknown-price-failclosed.runtime.test.ts", async () => {
  // ── 0 · the resolver itself ───────────────────────────────────────────────
  section("0. planForPrice resolves what it knows and returns null for what it does not");
  check("a known agency lookup key resolves to agency",
    stripeLib.planForPrice(KNOWN_AGENCY) === "agency");
  check("an unknown lookup key with an unknown amount resolves to null",
    stripeLib.planForPrice(UNKNOWN_BY_KEY) === null);
  check("no lookup key and an unknown amount resolves to null",
    stripeLib.planForPrice(UNKNOWN_NO_KEY) === null);
  check("a missing price resolves to null, never a paid tier",
    stripeLib.planForPrice(null) === null);

  // ── 1 · a recognized price DOES provision (control) ───────────────────────
  section("1. control — a recognized price provisions the plan it names");
  reset();
  seed("u_known", "free");
  await billing.syncSubscriptionToUser(subscription("u_known", "active", KNOWN_AGENCY));
  check("the entitlement write happened", prisma.userUpdates.length === 1);
  check("the write CONTAINS a plan", "plan" in lastUpdateData());
  check("the plan written is the one the price names", lastUpdateData().plan === "agency");
  check("agency access follows the agency subscription", lastUpdateData().isAgency === true);
  check("nothing was reported as unrecognized", reported.length === 0);

  // ── 2 · an unknown price on an ACTIVE subscription writes NO plan ─────────
  section("2. an UNRECOGNIZED price on an active subscription writes no plan at all");
  reset();
  seed("u_rogue", "premium");
  await billing.syncSubscriptionToUser(subscription("u_rogue", "active", UNKNOWN_BY_KEY));
  check("the sync still recorded the subscription's status", prisma.userUpdates.length === 1);
  check("the write does NOT contain a plan key " +
    `(keys: ${Object.keys(lastUpdateData()).join(", ")})`,
    !("plan" in lastUpdateData()));
  check("the write does NOT grant agency access", !("isAgency" in lastUpdateData()));
  check("the stored plan is unchanged", prisma.users.get("u_rogue")?.plan === "premium");
  check("the subscription id and status were still reconciled",
    lastUpdateData().subscriptionStatus === "active" &&
    lastUpdateData().stripeSubscriptionId === "sub_u_rogue");
  check("the unrecognized price was REPORTED, not swallowed",
    reported.some((r) => /Unrecognized Stripe price/.test(r.message)));
  check("the report carries the price id needed to investigate",
    reported.some((r) => r.context.priceId === UNKNOWN_BY_KEY.id));

  // ── 3 · a free account is not upgraded by an unknown price ───────────────
  section("3. an unrecognized price cannot upgrade a free account");
  reset();
  seed("u_free", "free");
  await billing.syncSubscriptionToUser(subscription("u_free", "active", UNKNOWN_NO_KEY));
  check("no plan was written", !("plan" in lastUpdateData()));
  check("the account is still free", prisma.users.get("u_free")?.plan === "free");
  check("the account did not gain agency access",
    prisma.users.get("u_free")?.isAgency !== true);

  // ── 4 · revocation is always safe ────────────────────────────────────────
  section("4. an INACTIVE subscription still revokes, whatever the price says");
  reset();
  seed("u_lapsed", "agency", true);
  await billing.syncSubscriptionToUser(subscription("u_lapsed", "canceled", UNKNOWN_BY_KEY));
  check("an inactive subscription writes plan=free even on an unknown price",
    lastUpdateData().plan === "free");
  check("agency access is revoked", lastUpdateData().isAgency === false);
  check("the stored plan is now free", prisma.users.get("u_lapsed")?.plan === "free");

  // ── 5 · end to end through the webhook route ─────────────────────────────
  section("5. end to end — an unknown price arriving by webhook provisions nothing");
  reset();
  seed("u_e2e", "premium");
  stripeDouble = makeFakeStripe(log, {
    retrieve: () => subscription("u_e2e", "active", UNKNOWN_BY_KEY),
  });
  const req = new Request("https://runtime.test/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=0,v1=fake" },
    body: JSON.stringify({
      id: "evt_unknown_price",
      type: "customer.subscription.updated",
      data: { object: subscription("u_e2e", "active", UNKNOWN_BY_KEY) },
    }),
  });
  const res = await route.POST(req);
  check("the webhook is acknowledged (Stripe must not retry forever)", res.status === 200);
  check("the handler ran", log.count("stripe.subscriptions.retrieve") === 1);
  check("no plan was written by the webhook path", !("plan" in lastUpdateData()));
  check("the account's plan is untouched", prisma.users.get("u_e2e")?.plan === "premium");
  check("the unrecognized price was reported from the webhook path",
    reported.some((r) => /Unrecognized Stripe price/.test(r.message)));

  // ── 6 · a subscription whose customer maps to nobody writes nothing ──────
  section("6. a subscription that maps to no account writes nothing and is reported");
  reset();
  await billing.syncSubscriptionToUser(subscription("u_orphan", "active", KNOWN_AGENCY));
  check("no user row was written", prisma.userUpdates.length === 0);
  check("the orphaned subscription was reported",
    reported.some((r) => /no matching User/i.test(r.message)));
});
