// Run: npx --no-install tsx scripts/runtime/stripe-webhook-claim.runtime.test.ts
//
// MOCKED RUNTIME guard for the three-state Stripe webhook claim. This EXECUTES the
// real app/api/stripe/webhook/route.ts and the real lib/billing.ts claim functions
// against a fake Prisma whose raw-SQL layer INTERPRETS THE STATEMENTS lib/billing.ts
// actually issues (see scripts/runtime/_fakes.ts). Deleting the pending-marker
// guard or the staleness window from that SQL changes what the fake does, so these
// assertions move with the product rather than with a regex.
//
// The five lifecycle states, end to end through POST:
//   claimed → handled → settled          (a fresh delivery)
//   completed                            (a redelivery of a settled event: 200, no re-handling)
//   in_flight                            (a live pending claim: 409, so Stripe retries)
//   stale-pending re-claim               (an abandoned claim ages out and IS re-handled)
//   handler failure → release → retry    (a 500 gives the claim back; the retry succeeds)
//
// WHAT THIS DOES NOT PROVE: there is no Postgres here. Real ON CONFLICT atomicity,
// real row locking, real concurrency between two Vercel invocations, and real
// CURRENT_TIMESTAMP semantics are NOT exercised. Those need the production or
// preview database. See scripts/runtime/README.md.
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

// lib/billing.ts is deliberately NOT mocked — it is the code under test.
const billing = loadModule<{
  claimStripeEvent(eventId: string, type: string): Promise<"claimed" | "completed" | "in_flight">;
  completeStripeEvent(eventId: string, type: string): Promise<void>;
  releaseStripeEvent(eventId: string): Promise<void>;
}>("lib/billing.ts");

// A fake signing key. This is a made-up local string, not a production secret.
process.env.STRIPE_WEBHOOK_SECRET = "whsec_runtime_test_placeholder";
const route = loadModule<{ POST(req: Request): Promise<Response> }>("app/api/stripe/webhook/route.ts");

const CUSTOMER = "cus_webhook_runtime";
const AGENCY_PRICE = { id: "price_agency", lookup_key: "gcl_agency_monthly", unit_amount: 39900 };

function subscription(status = "active", price = AGENCY_PRICE) {
  return {
    id: "sub_webhook_runtime",
    status,
    customer: CUSTOMER,
    current_period_end: 1900000000,
    items: { data: [{ id: "si_1", price }] },
  };
}

function event(id: string, type = "customer.subscription.updated") {
  return { id, type, data: { object: subscription() } };
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

let retrieveFailures = 0;
function resetScenario(opts: { failRetrieveTimes?: number } = {}): void {
  log.reset();
  reported.length = 0;
  prisma.userUpdates.length = 0;
  retrieveFailures = opts.failRetrieveTimes ?? 0;
  stripeDouble = makeFakeStripe(log, {
    retrieve: () => {
      if (retrieveFailures > 0) {
        retrieveFailures--;
        throw new Error("fake Stripe: transient retrieve failure");
      }
      return subscription();
    },
  });
}

const rowType = (id: string): string | undefined => prisma.webhookEvents.get(id)?.type;

run("stripe-webhook-claim.runtime.test.ts", async () => {
  prisma.seedUser({
    id: "u_webhook",
    email: "u_webhook@runtime.test",
    plan: "free",
    stripeCustomerId: CUSTOMER,
    role: "USER",
    isAgency: false,
  });

  // ── A · a fresh delivery is claimed, handled, and settled ─────────────────
  section("A. a fresh event is CLAIMED, handled, then SETTLED");
  resetScenario();
  const a = await postWebhook(event("evt_fresh"));
  check("the route acknowledges 200", a.status === 200);
  check("it does not report the event as a duplicate", a.json.duplicate === undefined);
  check("the handler actually ran (Stripe was re-read for current state)",
    log.count("stripe.subscriptions.retrieve") === 1);
  check("the entitlement was written", prisma.userUpdates.length === 1);
  check("the claim was taken BEFORE the handler ran",
    log.before("sql.insertWebhookEvent", "stripe.subscriptions.retrieve"));
  check("the ledger row is now SETTLED (bare type, no pending marker) " +
    `(type=${rowType("evt_fresh")})`,
    rowType("evt_fresh") === "customer.subscription.updated");
  check("the account was provisioned from the recognized price",
    prisma.users.get("u_webhook")?.plan === "agency");

  // ── B · a redelivery of a settled event is refused ────────────────────────
  section("B. a redelivery of a COMPLETED event is acknowledged but NOT re-handled");
  resetScenario();
  const b = await postWebhook(event("evt_fresh"));
  check("the route answers 200 so Stripe stops retrying", b.status === 200);
  check("the response marks it a duplicate", b.json.duplicate === true);
  check("the handler did NOT run again", log.count("stripe.subscriptions.retrieve") === 0);
  check("no second entitlement write happened", prisma.userUpdates.length === 0);
  check("claimStripeEvent reports 'completed' directly",
    (await billing.claimStripeEvent("evt_fresh", "customer.subscription.updated")) === "completed");

  // ── C · a live pending claim is IN FLIGHT → 409, never 200 ────────────────
  section("C. a live PENDING claim yields 409 (never a 200 that would end Stripe's retries)");
  resetScenario();
  prisma.seedWebhookEvent("evt_inflight", "pending:customer.subscription.updated", new Date());
  const c = await postWebhook(event("evt_inflight"));
  check("the route answers 409, not 200", c.status === 409);
  check("the response asks Stripe to retry", c.json.retry === true);
  check("the handler did NOT run", log.count("stripe.subscriptions.retrieve") === 0);
  check("the existing pending claim was not stolen or settled",
    rowType("evt_inflight") === "pending:customer.subscription.updated");
  check("claimStripeEvent reports 'in_flight' directly",
    (await billing.claimStripeEvent("evt_inflight", "customer.subscription.updated")) === "in_flight");

  // ── D · a stale pending claim is re-claimed and handled ───────────────────
  section("D. an ABANDONED pending claim ages out and the retry is processed");
  resetScenario();
  const twentyMinutesAgo = new Date(Date.now() - 20 * 60_000);
  prisma.seedWebhookEvent("evt_stale", "pending:customer.subscription.updated", twentyMinutesAgo);
  check("claimStripeEvent re-claims a pending row older than the abandonment window",
    (await billing.claimStripeEvent("evt_stale", "customer.subscription.updated")) === "claimed");
  // Put it back in the aged-out state and drive it through the ROUTE end to end.
  prisma.seedWebhookEvent("evt_stale", "pending:customer.subscription.updated", twentyMinutesAgo);
  log.reset();
  const d = await postWebhook(event("evt_stale"));
  check("the route processes the retry rather than deduping it away", d.status === 200);
  check("the handler ran", log.count("stripe.subscriptions.retrieve") === 1);
  check("the re-claimed row is settled afterwards",
    rowType("evt_stale") === "customer.subscription.updated");
  // The window must be a real boundary, not "always re-claim".
  prisma.seedWebhookEvent("evt_recent", "pending:customer.subscription.updated", new Date(Date.now() - 60_000));
  check("a claim only one minute old is NOT re-claimed (the window is a real boundary)",
    (await billing.claimStripeEvent("evt_recent", "customer.subscription.updated")) === "in_flight");

  // ── E · handler failure releases the claim; the retry succeeds ────────────
  section("E. a handler failure RELEASES the claim so Stripe's retry can run");
  resetScenario({ failRetrieveTimes: 1 });
  const e1 = await postWebhook(event("evt_retry"));
  check("the route answers 500 so Stripe retries", e1.status === 500);
  check("the handler was attempted and failed", log.count("stripe.subscriptions.retrieve") === 1);
  check("the failure was reported to observability", reported.length === 1);
  check("the claim was GIVEN BACK — no ledger row survives to dedupe the retry",
    prisma.webhookEvents.has("evt_retry") === false);
  check("no entitlement was written by the failed attempt", prisma.userUpdates.length === 0);

  resetScenario();
  const e2 = await postWebhook(event("evt_retry"));
  check("the retry is processed (not swallowed as a duplicate)",
    e2.status === 200 && e2.json.duplicate === undefined);
  check("the handler ran on the retry", log.count("stripe.subscriptions.retrieve") === 1);
  check("the entitlement was written on the retry", prisma.userUpdates.length === 1);
  check("the retry's claim is settled", rowType("evt_retry") === "customer.subscription.updated");

  // ── F · release is scoped to PENDING rows only ────────────────────────────
  section("F. releasing never destroys a settled record");
  resetScenario();
  await billing.releaseStripeEvent("evt_fresh");
  check("a SETTLED row is not deleted by a release",
    rowType("evt_fresh") === "customer.subscription.updated");
  prisma.seedWebhookEvent("evt_pending_release", "pending:customer.subscription.updated", new Date());
  await billing.releaseStripeEvent("evt_pending_release");
  check("a PENDING row IS deleted by a release (the check above is not vacuous)",
    prisma.webhookEvents.has("evt_pending_release") === false);

  // ── G · an unhandled event type is never recorded at all ──────────────────
  section("G. an event type this app does not act on is acknowledged and left unrecorded");
  resetScenario();
  const g = await postWebhook({ id: "evt_ignored", type: "customer.created", data: { object: {} } });
  check("an unhandled type is acknowledged 200", g.status === 200);
  check("it is not written into the dedup ledger", prisma.webhookEvents.has("evt_ignored") === false);
  check("no handler work happened", log.count("stripe.subscriptions.retrieve") === 0);
});
