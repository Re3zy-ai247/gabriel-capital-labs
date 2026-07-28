// Run: npx --no-install tsx scripts/runtime/stripe-webhook-reorder.runtime.test.ts
//
// MOCKED RUNTIME guard for OUT-OF-ORDER Stripe subscription webhooks. This EXECUTES
// the real app/api/stripe/webhook/route.ts and the real lib/billing.ts against a
// fake Prisma and a fake Stripe whose CURRENT state is controlled independently of
// the state embedded in each event payload.
//
// THE GAP THIS CLOSES. scripts/stripe-lifecycle.test.ts pins the SOURCE TEXT of the
// re-retrieval, and stripe-webhook-claim.runtime.test.ts proves the retrieval CALL
// EXECUTES. Neither proves the thing that actually protects revenue and access:
// that a `customer.subscription.deleted` followed by a DELAYED, STALE
// `customer.subscription.updated` whose payload still says `active` leaves the plan
// REVOKED. Stripe makes no ordering guarantee, so that pair is a real delivery
// order, not a hypothetical one. Handling the payload snapshot instead of current
// state would silently restore a cancelled customer's paid entitlement — a
// permanent free-access hole that no signature check, dedup ledger or claim window
// would catch.
//
// THE SHAPE OF THE PROOF. Every scenario sets two things independently:
//   · what the EVENT PAYLOAD says   (event.data.object.status)
//   · what STRIPE CURRENTLY SAYS    (subscriptions.retrieve)
// and then asserts the DB agrees with Stripe, never with the payload. Both
// directions are exercised (stale-active after delete, stale-delete after
// reactivation) and a live control case proves the assertions are not passing
// merely because the handler can never write a plan at all.
//
// WHAT THIS DOES NOT PROVE: there is no Postgres and no Stripe here. Real ON
// CONFLICT atomicity, real concurrency between two Vercel invocations, and real
// Stripe API semantics are NOT exercised. See scripts/runtime/README.md.
import { check, section, loadModule, mockModule, requireActual, run } from "./_harness";
import { CallLog, FakePrisma, makeFakeStripe } from "./_fakes";

const log = new CallLog();
const prisma = new FakePrisma(log);

let stripeDouble: ReturnType<typeof makeFakeStripe> = makeFakeStripe(log);
const reported: unknown[] = [];

mockModule("lib/prisma.ts", { prisma });
mockModule("lib/stripe.ts", {
  ...(requireActual("lib/stripe.ts") as Record<string, unknown>),
  getStripe: () => stripeDouble,
});
mockModule("lib/observability.ts", {
  reportError: (e: unknown) => {
    reported.push(e);
  },
});
mockModule("lib/events.ts", {
  ...(requireActual("lib/events.ts") as Record<string, unknown>),
  track: async (name: string) => {
    log.record(`events.track:${name}`);
  },
});

// lib/billing.ts and the route are the code under test — neither is mocked.
process.env.STRIPE_WEBHOOK_SECRET = "whsec_runtime_test_placeholder";
const route = loadModule<{ POST(req: Request): Promise<Response> }>("app/api/stripe/webhook/route.ts");

const USER_ID = "u_reorder";
const CUSTOMER = "cus_reorder_runtime";
const SUB_ID = "sub_reorder_runtime";
const AGENCY_PRICE = { id: "price_agency", lookup_key: "gcl_agency_monthly", unit_amount: 39900 };

/** A subscription object in Stripe's shape. `status` is the only thing that varies. */
function subscription(status: string): Record<string, unknown> {
  return {
    id: SUB_ID,
    status,
    customer: CUSTOMER,
    current_period_end: 1900000000,
    items: { data: [{ id: "si_1", price: AGENCY_PRICE }] },
  };
}

/**
 * What Stripe would answer RIGHT NOW if asked. Deliberately a module-level
 * variable so a scenario can make the event payload and current state DISAGREE,
 * which is the entire point of this guard.
 */
let currentStripeStatus = "active";

function resetScenario(): void {
  log.reset();
  reported.length = 0;
  prisma.userUpdates.length = 0;
  stripeDouble = makeFakeStripe(log, { retrieve: () => subscription(currentStripeStatus) });
}

function event(id: string, type: string, payloadStatus: string): Record<string, unknown> {
  return { id, type, data: { object: subscription(payloadStatus) } };
}

async function postWebhook(evt: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const req = new Request("https://runtime.test/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=0,v1=fake" },
    body: JSON.stringify(evt),
  });
  const res = await route.POST(req);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

const user = () => prisma.users.get(USER_ID);
/** Every `plan` value written during the scenario, in order. Lets a check assert a
 *  field was NOT written, which reading the final row alone cannot. */
const plansWritten = (): unknown[] =>
  prisma.userUpdates.filter((u) => "plan" in u.data).map((u) => u.data.plan);

run("stripe-webhook-reorder.runtime.test.ts", async () => {
  prisma.seedUser({
    id: USER_ID,
    email: "u_reorder@runtime.test",
    plan: "free",
    stripeCustomerId: CUSTOMER,
    role: "USER",
    isAgency: false,
  });

  // ── A · the local subscription is ACTIVE ──────────────────────────────────
  // Established through the real handler rather than seeded, so the starting
  // state is one the product actually produces.
  section("A. the local subscription starts ACTIVE (written by the real handler)");
  currentStripeStatus = "active";
  resetScenario();
  const a = await postWebhook(event("evt_r_created", "customer.subscription.created", "active"));
  check("the creation event is acknowledged 200", a.status === 200);
  check("the paid plan was provisioned", user()?.plan === "agency");
  check("the agency workspace was unlocked", user()?.isAgency === true);
  check("the local status matches Stripe", user()?.subscriptionStatus === "active");

  // ── B · customer.subscription.deleted is handled ──────────────────────────
  section("B. customer.subscription.deleted arrives and REVOKES the plan");
  currentStripeStatus = "canceled";
  resetScenario();
  const b = await postWebhook(event("evt_r_deleted", "customer.subscription.deleted", "canceled"));
  check("the delete event is acknowledged 200", b.status === 200);
  check("current state was read from Stripe, not taken from the payload",
    log.count("stripe.subscriptions.retrieve") === 1);
  check("the plan was revoked to free", user()?.plan === "free");
  check("the agency workspace was revoked", user()?.isAgency === false);
  check("the local status records the cancellation", user()?.subscriptionStatus === "canceled");
  check("the ledger row for the delete is SETTLED",
    prisma.webhookEvents.get("evt_r_deleted")?.type === "customer.subscription.deleted");

  // ── C · a DELAYED STALE `updated` arrives AFTER the delete ────────────────
  // This is the reordering. The payload is a snapshot from BEFORE the
  // cancellation and still says `active`; Stripe's current state says canceled.
  section("C. a DELAYED STALE customer.subscription.updated (payload says active) arrives AFTER the delete");
  currentStripeStatus = "canceled";
  resetScenario();
  const staleEvent = event("evt_r_stale_active", "customer.subscription.updated", "active");
  const staleSnapshot = (staleEvent.data as { object: { status: string } }).object;
  check("the stale event's own payload really does say active (the scenario is not vacuous)",
    staleSnapshot.status === "active");
  check("Stripe's CURRENT state still says canceled", currentStripeStatus === "canceled");

  const c = await postWebhook(staleEvent);
  check("the stale event is acknowledged 200 (it is a real Stripe delivery, not an error)",
    c.status === 200);
  check("the handler was NOT deduped away — it claimed and ran",
    c.json.duplicate === undefined);
  check("the handler RE-RETRIEVED current state from Stripe",
    log.count("stripe.subscriptions.retrieve") === 1);
  check("the re-retrieval happened BEFORE the entitlement write",
    log.before("stripe.subscriptions.retrieve", "prisma.user.update"));
  check("the handler did reach the entitlement write (it was not silently skipped)",
    prisma.userUpdates.length === 1);
  check(`the write used CURRENT state, not the stale payload (plans written: ${JSON.stringify(plansWritten())})`,
    plansWritten().length === 1 && plansWritten()[0] === "free");
  check("the stale event could NOT restore the paid plan", user()?.plan === "free");
  check("the stale event could NOT restore the agency workspace", user()?.isAgency === false);
  check("the local status was not flipped back to active by the stale payload",
    user()?.subscriptionStatus === "canceled");
  check("no update in this scenario wrote an agency plan",
    prisma.userUpdates.every((u) => u.data.plan !== "agency"));
  check("nothing was reported as an error — this is normal, expected traffic",
    reported.length === 0);

  // ── D · duplicate delivery of the SAME stale event id ─────────────────────
  section("D. a DUPLICATE delivery of the same stale event id stays idempotent");
  resetScenario();
  const d1 = await postWebhook(event("evt_r_stale_active", "customer.subscription.updated", "active"));
  check("the duplicate is acknowledged 200 so Stripe stops retrying", d1.status === 200);
  check("the response marks it a duplicate", d1.json.duplicate === true);
  check("the handler did NOT run a second time", log.count("stripe.subscriptions.retrieve") === 0);
  check("no second entitlement write happened", prisma.userUpdates.length === 0);
  check("the plan is still revoked after the duplicate", user()?.plan === "free");

  // A duplicate of the DELETE is equally inert.
  resetScenario();
  const d2 = await postWebhook(event("evt_r_deleted", "customer.subscription.deleted", "canceled"));
  check("a duplicate of the delete event is also refused", d2.json.duplicate === true);
  check("it performed no work", log.count("stripe.subscriptions.retrieve") === 0 && prisma.userUpdates.length === 0);

  // ── E · CONTROL — the plan is restorable when Stripe CURRENTLY says active ─
  // Without this, every assertion above could pass on a handler that simply never
  // writes a plan. The control proves the revocation above was a decision, not an
  // inability.
  section("E. CONTROL — a genuine reactivation (Stripe CURRENTLY active) does restore the plan");
  currentStripeStatus = "active";
  resetScenario();
  const e = await postWebhook(event("evt_r_reactivated", "customer.subscription.updated", "active"));
  check("the reactivation is acknowledged 200", e.status === 200);
  check("the paid plan is restored when Stripe's CURRENT state is active",
    user()?.plan === "agency");
  check("the agency workspace is restored", user()?.isAgency === true);
  check("the local status follows Stripe", user()?.subscriptionStatus === "active");

  // ── F · the mirror image — a stale DELETE after a real reactivation ───────
  // The same defect in the other direction revokes a PAYING customer.
  section("F. MIRROR — a stale customer.subscription.deleted after a reactivation must NOT revoke");
  currentStripeStatus = "active";
  resetScenario();
  const f = await postWebhook(event("evt_r_stale_deleted", "customer.subscription.deleted", "canceled"));
  check("the stale delete is acknowledged 200", f.status === 200);
  check("the handler re-retrieved current state", log.count("stripe.subscriptions.retrieve") === 1);
  check("the paying customer was NOT revoked by the stale delete", user()?.plan === "agency");
  check("the agency workspace was NOT revoked", user()?.isAgency === true);
  check(`the write used CURRENT state (plans written: ${JSON.stringify(plansWritten())})`,
    plansWritten().length === 1 && plansWritten()[0] === "agency");
  check("no update in this scenario wrote a free plan",
    prisma.userUpdates.every((u) => u.data.plan !== "free"));

  // ── G · ordering is decided by Stripe's state, not by arrival order ───────
  section("G. replaying the whole reordered sequence converges on Stripe's current state");
  currentStripeStatus = "canceled";
  resetScenario();
  await postWebhook(event("evt_r_seq_deleted", "customer.subscription.deleted", "canceled"));
  await postWebhook(event("evt_r_seq_stale_a", "customer.subscription.updated", "active"));
  await postWebhook(event("evt_r_seq_stale_b", "customer.subscription.updated", "trialing"));
  check("three deliveries, three handler runs (none deduped away)",
    log.count("stripe.subscriptions.retrieve") === 3);
  check("after the whole reordered burst the plan is still revoked", user()?.plan === "free");
  check("every plan written across the burst was free, whatever the payloads said",
    plansWritten().length === 3 && plansWritten().every((p) => p === "free"));
  check("all three ledger rows are settled, none left pending",
    ["evt_r_seq_deleted", "evt_r_seq_stale_a", "evt_r_seq_stale_b"].every(
      (id) => prisma.webhookEvents.get(id)?.type.startsWith("pending:") === false
    ));
});
