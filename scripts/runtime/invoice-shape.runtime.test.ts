// Run: npx --no-install tsx scripts/runtime/invoice-shape.runtime.test.ts
//
// MOCKED RUNTIME guard for the DUAL-SHAPE Stripe invoice payload. This EXECUTES the
// real app/api/stripe/webhook/route.ts against a fake Prisma and a fake Stripe and
// asserts on the WRITE THAT REACHES THE DATABASE — never on source text.
//
// THE GAP THIS CLOSES, and why a source guard was not enough. Stripe moved the
// invoice→subscription link in API version 2025-03-31.basil: it used to be the
// top-level `invoice.subscription`, and is now
// `invoice.parent.subscription_details.subscription`. Which shape arrives depends on
// the version pinned on the WEBHOOK ENDPOINT in the Dashboard, not on the version
// the SDK sends outbound, so a resolver that reads only one shape returns undefined
// on the other — and `undefined` means "not a subscription invoice", which is
// exactly the gate in front of the `past_due` write.
//
// scripts/stripe-lifecycle.test.ts pins the resolver's SOURCE TEXT. An adversarial
// review defeated that regex while leaving the behaviour broken: keeping the string
// the regex greps for while discarding the value it computes
// (`const modernId = ...; void modernId; return fromLegacy;`) makes the handler
// completely blind to the modern shape, and tsc, all top-level guards and every
// other runtime guard stay green. Under a basil-pinned endpoint that means
// invoice.payment_failed never resolves a subscription, `past_due` is never
// written, and DUNNING SILENTLY STOPS WORKING — a revenue defect with no error and
// no alert. Text assertions cannot survive an adversary who preserves the text;
// only an executed assertion on the resulting write can.
//
// WHAT IS ASSERTED. For BOTH invoice events and BOTH payload shapes, in BOTH the
// string and the expanded-object form Stripe may send:
//   · payment_failed  → the subscriber is moved to past_due
//   · payment_succeeded → current state is re-retrieved FOR THE RESOLVED ID and synced
// plus the negative case: an invoice carrying NEITHER shape must not fabricate an
// id, must not retrieve, and must not write.
//
// WHAT THIS DOES NOT PROVE: there is no Postgres and no Stripe here. Real invoice
// payloads, real API-version negotiation and real Stripe semantics are NOT
// exercised. See scripts/runtime/README.md.
import { check, section, loadModule, mockModule, requireActual, run } from "./_harness";
import { CallLog, FakePrisma, makeFakeStripe } from "./_fakes";

const log = new CallLog();
const prisma = new FakePrisma(log);

let stripeDouble: ReturnType<typeof makeFakeStripe> = makeFakeStripe(log);
const reported: unknown[] = [];
/** Every id handed to subscriptions.retrieve, in order. This is what proves WHICH
 *  shape the resolver actually read — not merely that it read something. */
const retrievedIds: string[] = [];

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

const USER_ID = "u_invoice";
const CUSTOMER = "cus_invoice_runtime";
const SUB_ID = "sub_invoice_runtime";
const PREMIUM_PRICE = { id: "price_premium", lookup_key: "gcl_premium_monthly", unit_amount: 2900 };

function subscription(status: string): Record<string, unknown> {
  return {
    id: SUB_ID,
    status,
    customer: CUSTOMER,
    current_period_end: 1900000000,
    items: { data: [{ id: "si_1", price: PREMIUM_PRICE }] },
  };
}

function resetScenario(): void {
  log.reset();
  reported.length = 0;
  retrievedIds.length = 0;
  prisma.userUpdates.length = 0;
  stripeDouble = makeFakeStripe(log, {
    retrieve: (id: string) => {
      retrievedIds.push(id);
      return subscription("active");
    },
  });
}

// ── the four payload shapes ────────────────────────────────────────────────────
// LEGACY is pre-basil; MODERN is 2025-03-31.basil and later. Stripe may send the
// link either as a bare id string or as an expanded object, so each shape has two
// forms and all four must resolve identically.
const shapes: Array<{ name: string; body: Record<string, unknown> }> = [
  { name: "LEGACY string  (invoice.subscription = 'sub_...')", body: { subscription: SUB_ID } },
  { name: "LEGACY object  (invoice.subscription = { id })", body: { subscription: { id: SUB_ID } } },
  {
    name: "MODERN string  (invoice.parent.subscription_details.subscription = 'sub_...')",
    body: { parent: { subscription_details: { subscription: SUB_ID } } },
  },
  {
    name: "MODERN object  (invoice.parent.subscription_details.subscription = { id })",
    body: { parent: { subscription_details: { subscription: { id: SUB_ID } } } },
  },
];

function invoiceEvent(id: string, type: string, shape: Record<string, unknown>): Record<string, unknown> {
  return {
    id,
    type,
    data: { object: { id: `in_${id}`, customer: CUSTOMER, ...shape } },
  };
}

async function postWebhook(evt: Record<string, unknown>): Promise<{ status: number }> {
  const req = new Request("https://runtime.test/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=0,v1=fake" },
    body: JSON.stringify(evt),
  });
  const res = await route.POST(req);
  return { status: res.status };
}

const user = () => prisma.users.get(USER_ID);
/** Put the local row into a known starting state without going through the handler,
 *  so each scenario asserts a TRANSITION rather than inheriting the previous one. */
function setLocalStatus(status: string): void {
  const row = user();
  if (row) row.subscriptionStatus = status;
}
/** Every subscriptionStatus written during the scenario, in order. Lets a check
 *  assert the field was NOT written, which reading the final row cannot. */
const statusesWritten = (): unknown[] =>
  prisma.userUpdates.filter((u) => "subscriptionStatus" in u.data).map((u) => u.data.subscriptionStatus);

run("invoice-shape.runtime.test.ts", async () => {
  prisma.seedUser({
    id: USER_ID,
    email: "u_invoice@runtime.test",
    plan: "premium",
    stripeCustomerId: CUSTOMER,
    role: "USER",
    isAgency: false,
  });

  // ── invoice.payment_failed · every shape must reach the past_due write ──────
  // This is the dunning gate. `if (!failedSubId) break;` sits directly in front of
  // it, so a shape the resolver cannot read is a shape that silently skips it.
  let n = 0;
  for (const shape of shapes) {
    n += 1;
    section(`A${n}. invoice.payment_failed — ${shape.name}`);
    resetScenario();
    setLocalStatus("active");

    // The fixture must genuinely carry the shape under test, or the scenario is
    // vacuous — a guard that passes because the payload was malformed proves nothing.
    const evt = invoiceEvent(`evt_failed_${n}`, "invoice.payment_failed", shape.body);
    const payload = (evt.data as { object: Record<string, unknown> }).object;
    const hasLegacy = payload.subscription !== undefined;
    const hasModern = payload.parent !== undefined;
    check("the fixture carries exactly one of the two shapes, not both",
      hasLegacy !== hasModern);

    const res = await postWebhook(evt);
    check("the event is acknowledged 200", res.status === 200);
    check("the subscriber was moved to past_due — THE DUNNING WRITE HAPPENED",
      user()?.subscriptionStatus === "past_due");
    check("exactly one status write occurred, and it was past_due",
      statusesWritten().length === 1 && statusesWritten()[0] === "past_due");
    check("the handler reported no error", reported.length === 0);
  }

  // ── invoice.payment_succeeded · every shape must re-retrieve and sync ───────
  // Recovery from dunning. The resolved id is handed straight to
  // subscriptions.retrieve, so the id actually retrieved names the shape that was read.
  n = 0;
  for (const shape of shapes) {
    n += 1;
    section(`B${n}. invoice.payment_succeeded — ${shape.name}`);
    resetScenario();
    setLocalStatus("past_due");

    const res = await postWebhook(invoiceEvent(`evt_ok_${n}`, "invoice.payment_succeeded", shape.body));
    check("the event is acknowledged 200", res.status === 200);
    check("current state was re-retrieved from Stripe", log.count("stripe.subscriptions.retrieve") === 1);
    check("the retrieval used the id carried by THIS shape — the shape was genuinely read",
      retrievedIds.length === 1 && retrievedIds[0] === SUB_ID);
    check("past_due was cleared back to the live Stripe status",
      user()?.subscriptionStatus === "active");
    check("the paid plan survives the recovery", user()?.plan === "premium");
    check("the handler reported no error", reported.length === 0);
  }

  // ── the negative case · neither shape present ──────────────────────────────
  // A one-time invoice (the $19 letter pack) carries no subscription link at all.
  // The resolver must return undefined and the handler must do nothing — this is
  // the assertion that stops a "fix" that simply hardcodes a subscription id.
  section("C. an invoice carrying NEITHER shape must not fabricate a subscription");
  resetScenario();
  setLocalStatus("active");
  const c = await postWebhook(invoiceEvent("evt_neither_failed", "invoice.payment_failed", {}));
  check("the event is acknowledged 200", c.status === 200);
  check("no status write occurred", statusesWritten().length === 0);
  check("the healthy subscriber was NOT flipped to past_due", user()?.subscriptionStatus === "active");

  resetScenario();
  const d = await postWebhook(invoiceEvent("evt_neither_ok", "invoice.payment_succeeded", {}));
  check("the success event is acknowledged 200", d.status === 200);
  check("no subscription was retrieved", log.count("stripe.subscriptions.retrieve") === 0);
  check("no user row was written", prisma.userUpdates.length === 0);

  // ── the control · prove the assertions above can distinguish states ─────────
  // Without this, every "past_due was written" check could be passing for the
  // wrong reason. Here the SAME handler and the SAME fixture shape write a
  // DIFFERENT value, so the assertions are demonstrably reading real state.
  section("D. control — the same path can write a value other than past_due");
  resetScenario();
  setLocalStatus("past_due");
  await postWebhook(invoiceEvent("evt_control_ok", "invoice.payment_succeeded", { subscription: SUB_ID }));
  check("the control wrote 'active', not 'past_due'", user()?.subscriptionStatus === "active");
  check("so the past_due assertions above were reading real state, not a constant",
    statusesWritten().every((s) => s !== "past_due"));
});
