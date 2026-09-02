// Run: npx --no-install tsx scripts/runtime/alert-delivery.runtime.test.ts
//
// Executes the real alert primitive, admin synthetic route, and Stripe webhook
// trust boundary with all external I/O replaced by in-process fakes. No network,
// database, Stripe, Slack, or production request occurs.
import { check, section, loadModule, mockModule, run } from "./_harness";

type DeliveryResult =
  | { delivered: true }
  | { delivered: false; reason: "not_configured" | "rejected" | "network_error"; status?: number };

const SECRET_URL = "https://hooks.invalid/services/runtime-secret-placeholder";
const syntheticText = "CreditVector RC1 readiness test — synthetic production alert. No action required.";
const logged: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = [];
let localLogShouldThrow = false;

mockModule("lib/log.ts", {
  log: {
    debug: (message: string, fields?: Record<string, unknown>) => logged.push({ level: "debug", message, fields }),
    info: (message: string, fields?: Record<string, unknown>) => logged.push({ level: "info", message, fields }),
    warn: (message: string, fields?: Record<string, unknown>) => logged.push({ level: "warn", message, fields }),
    error: (message: string, fields?: Record<string, unknown>) => {
      if (localLogShouldThrow) throw new Error("synthetic local logger failure");
      logged.push({ level: "error", message, fields });
    },
  },
});

type FetchCall = { url: string; init?: RequestInit };
const fetchCalls: FetchCall[] = [];
let fetchMode: "success" | "rejected" | "network_error" = "success";
const observedTimeoutMs: number[] = [];
const nativeAbortSignalTimeout = AbortSignal.timeout.bind(AbortSignal);
Object.defineProperty(AbortSignal, "timeout", {
  configurable: true,
  value: (milliseconds: number) => {
    observedTimeoutMs.push(milliseconds);
    return nativeAbortSignalTimeout(milliseconds);
  },
});
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  fetchCalls.push({ url: String(input), init });
  if (fetchMode === "network_error") throw new Error("synthetic network failure");
  if (fetchMode === "rejected") return new Response("rejected", { status: 503 });
  return new Response(null, { status: 204 });
}) as typeof fetch;

const observability = loadModule<{
  deliverAlertWebhook(message: string, context?: Record<string, unknown>): Promise<DeliveryResult>;
  reportError(error: unknown, context?: Record<string, unknown>): void;
}>("lib/observability.ts");

type AuthorityScenario = "unauthenticated" | "non-admin" | "admin";
let authorityScenario: AuthorityScenario = "unauthenticated";
let currentAdmin: { id: string; email: string } | null = null;
let rateLimitResponse: Response | null = null;
const rateLimitCalls: Array<{ key: string; limit: number; windowSec: number }> = [];
let routeDeliveryResult: DeliveryResult = { delivered: true };
const routeDeliveryCalls: unknown[][] = [];

mockModule("lib/admin.ts", {
  requireAdmin: async () => authorityScenario === "admin" ? currentAdmin : null,
});
mockModule("lib/rateLimit.ts", {
  enforceRateLimit: async (key: string, limit: number, windowSec: number) => {
    rateLimitCalls.push({ key, limit, windowSec });
    return rateLimitResponse;
  },
});
mockModule("lib/observability.ts", {
  deliverAlertWebhook: async (...args: unknown[]) => {
    routeDeliveryCalls.push(args);
    return routeDeliveryResult;
  },
});

const alertRoute = loadModule<Record<string, unknown> & { POST(): Promise<Response> }>(
  "app/api/admin/alerts/test/route.ts"
);

let stripeEnabled = true;
let constructMode: "authenticated" | "invalid" = "authenticated";
let handlerShouldFail = false;
let claimShouldFail = false;
const externalReports: Array<{ error: unknown; context?: Record<string, unknown> }> = [];
const directStripeDeliveryCalls: unknown[][] = [];
let released = 0;
let completed = 0;

const stripeDouble = {
  webhooks: {
    constructEvent: () => {
      if (constructMode === "invalid") throw new Error("synthetic invalid signature");
      return {
        id: "evt_alert_boundary",
        type: "customer.subscription.updated",
        data: { object: { id: "sub_alert_boundary" } },
      };
    },
  },
  subscriptions: {
    retrieve: async () => {
      if (handlerShouldFail) throw new Error("synthetic trusted handler failure");
      return { id: "sub_alert_boundary" };
    },
  },
};

mockModule("lib/stripe.ts", { getStripe: () => (stripeEnabled ? stripeDouble : null) });
mockModule("lib/billing.ts", {
  syncSubscriptionToUser: async () => undefined,
  creditLetters: async () => undefined,
  claimStripeEvent: async () => {
    if (claimShouldFail) throw new Error("synthetic trusted dedupe failure");
    return "claimed";
  },
  completeStripeEvent: async () => { completed++; },
  releaseStripeEvent: async () => { released++; },
});
mockModule("lib/prisma.ts", { prisma: { user: { findFirst: async () => null, update: async () => undefined } } });
mockModule("lib/events.ts", {
  PRODUCT_EVENTS: { subscriptionCompleted: "subscription_completed" },
  track: async () => undefined,
});
mockModule("lib/observability.ts", {
  reportError: (error: unknown, context?: Record<string, unknown>) => externalReports.push({ error, context }),
  deliverAlertWebhook: async (...args: unknown[]) => {
    directStripeDeliveryCalls.push(args);
    return { delivered: true };
  },
});

process.env.STRIPE_WEBHOOK_SECRET = "whsec_runtime_test_placeholder";
const stripeRoute = loadModule<{ POST(request: Request): Promise<Response> }>(
  "app/api/stripe/webhook/route.ts"
);

function resetStripe(): void {
  stripeEnabled = true;
  constructMode = "authenticated";
  handlerShouldFail = false;
  claimShouldFail = false;
  externalReports.length = 0;
  directStripeDeliveryCalls.length = 0;
  fetchCalls.length = 0;
  logged.length = 0;
  released = 0;
  completed = 0;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_runtime_test_placeholder";
}

function externalStripeAttemptCount(): number {
  return externalReports.length + directStripeDeliveryCalls.length + fetchCalls.length;
}

function stripeRequest(signature = "t=0,v1=fake"): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("stripe-signature", signature);
  return new Request("https://runtime.test/api/stripe/webhook", {
    method: "POST",
    headers,
    body: '{"synthetic":true}',
  });
}

run("alert-delivery.runtime.test.ts", async () => {
  section("A. awaited delivery tells the truth without exposing its destination");
  delete process.env.ALERT_WEBHOOK_URL;
  fetchCalls.length = 0;
  const missing = await observability.deliverAlertWebhook("missing destination");
  check("missing ALERT_WEBHOOK_URL fails closed", !missing.delivered && missing.reason === "not_configured");
  check("missing configuration makes no fetch attempt", fetchCalls.length === 0);

  process.env.ALERT_WEBHOOK_URL = SECRET_URL;
  fetchMode = "success";
  fetchCalls.length = 0;
  const success = await observability.deliverAlertWebhook(syntheticText);
  check("a 2xx webhook response is delivery success", success.delivered === true);
  check("delivery sends exactly one POST", fetchCalls.length === 1 && fetchCalls[0]?.init?.method === "POST");
  const successBody = JSON.parse(String(fetchCalls[0]?.init?.body)) as { text?: string; context?: unknown };
  check("the exact synthetic message is sent", successBody.text === syntheticText);
  check("no arbitrary context is added to the synthetic payload", successBody.context === undefined);
  check("delivery carries a timeout signal", fetchCalls[0]?.init?.signal instanceof AbortSignal);
  check("delivery uses the exact five-second timeout bound",
    observedTimeoutMs.at(-1) === 5_000);
  check("delivery refuses redirects instead of forwarding alert data",
    fetchCalls[0]?.init?.redirect === "error");

  fetchMode = "success";
  fetchCalls.length = 0;
  await observability.deliverAlertWebhook("x".repeat(800));
  const boundedBody = JSON.parse(String(fetchCalls[0]?.init?.body)) as { text: string };
  check("alert text is bounded to 500 characters", boundedBody.text.length === 500);

  fetchMode = "rejected";
  const rejected = await observability.deliverAlertWebhook("rejected");
  check("a non-2xx response is delivery failure", !rejected.delivered && rejected.reason === "rejected" && rejected.status === 503);

  fetchMode = "network_error";
  const networkError = await observability.deliverAlertWebhook("network error");
  check("a network error is delivery failure", !networkError.delivered && networkError.reason === "network_error");
  fetchMode = "success";
  fetchCalls.length = 0;
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const encodingError = await observability.deliverAlertWebhook("encoding error", circular);
  check("a payload encoding error is also a truthful delivery failure",
    !encodingError.delivered && encodingError.reason === "network_error");
  check("an encoding failure occurs before any outbound fetch",
    fetchCalls.length === 0);
  check("the secret URL never appears in results or structured logs",
    !JSON.stringify({ missing, success, rejected, networkError, encodingError, logged }).includes(SECRET_URL));

  section("B. ordinary reportError remains non-throwing and fire-and-forget");
  fetchMode = "network_error";
  let reportThrew = false;
  try { observability.reportError(new Error("ordinary failure"), { scope: "runtime-test" }); }
  catch { reportThrew = true; }
  await Promise.resolve();
  check("reportError does not throw when delivery fails", reportThrew === false);
  check("reportError still emits one local structured error", logged.some((entry) => entry.level === "error" && entry.message === "ordinary failure"));
  localLogShouldThrow = true;
  reportThrew = false;
  try { observability.reportError(new Error("local logger failure"), { scope: "runtime-test" }); }
  catch { reportThrew = true; }
  localLogShouldThrow = false;
  await Promise.resolve();
  check("reportError also isolates a local structured-logger failure", reportThrew === false);

  reportThrew = false;
  try { observability.reportError(Object.create(null), { scope: "runtime-test" }); }
  catch { reportThrew = true; }
  check("reportError isolates an error value that cannot be stringified", reportThrew === false);

  const hostileError = new Error("hostile");
  Object.defineProperty(hostileError, "name", { get: () => { throw new Error("hostile name getter"); } });
  Object.defineProperty(hostileError, "message", { get: () => { throw new Error("hostile message getter"); } });
  reportThrew = false;
  try { observability.reportError(hostileError, { scope: "runtime-test" }); }
  catch { reportThrew = true; }
  check("reportError isolates hostile Error property getters", reportThrew === false);

  fetchMode = "success";
  fetchCalls.length = 0;
  observability.reportError(new Error("composition failure"), { scope: "runtime-composition" });
  await Promise.resolve();
  const composedBody = JSON.parse(String(fetchCalls[0]?.init?.body)) as {
    text?: string;
    context?: Record<string, unknown>;
  };
  check("real reportError composes through the real webhook delivery primitive",
    fetchCalls.length === 1 && composedBody.text === "CreditVector error: Error: composition failure");
  check("real reportError preserves its compact safe context during delivery",
    composedBody.context?.scope === "runtime-composition");

  section("C. the synthetic endpoint is admin-only, constant-input, and throttled");
  authorityScenario = "unauthenticated";
  currentAdmin = null;
  rateLimitCalls.length = 0;
  routeDeliveryCalls.length = 0;
  const unauthenticated = await alertRoute.POST();
  check("an unauthenticated caller is denied", unauthenticated.status === 403);
  check("unauthenticated denial happens before rate limit or delivery",
    rateLimitCalls.length === 0 && routeDeliveryCalls.length === 0);

  authorityScenario = "non-admin";
  const nonAdmin = await alertRoute.POST();
  check("a signed-in non-admin is denied by the same authority boundary", nonAdmin.status === 403);

  authorityScenario = "admin";
  currentAdmin = { id: "admin_runtime", email: "admin@runtime.test" };
  rateLimitResponse = null;
  routeDeliveryResult = { delivered: true };
  const attackerRequest = new Request(
    "https://runtime.test/api/admin/alerts/test?message=attacker&destination=https://attacker.invalid",
    { method: "POST", body: '{"message":"attacker","destination":"https://attacker.invalid"}' }
  );
  const delivered = await (alertRoute.POST as unknown as (request: Request) => Promise<Response>)(attackerRequest);
  const deliveredJson = await delivered.json() as Record<string, unknown>;
  check("an admin receives a truthful success result", delivered.status === 200 && deliveredJson.delivered === true);
  check("the caller cannot choose message or destination",
    routeDeliveryCalls.length === 1 && routeDeliveryCalls[0]?.length === 1 && routeDeliveryCalls[0]?.[0] === syntheticText);
  check("the route rate-limits by immutable admin id before delivery",
    rateLimitCalls.some((call) => call.key === "admin-alert-test:admin_runtime" && call.limit === 1 && call.windowSec === 300));
  const exportedHttpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
    .filter((method) => method in alertRoute);
  check("POST is the route's only exported HTTP method",
    JSON.stringify(exportedHttpMethods) === JSON.stringify(["POST"]));

  routeDeliveryResult = { delivered: false, reason: "not_configured" };
  const notConfigured = await alertRoute.POST();
  const notConfiguredJson = await notConfigured.json() as Record<string, unknown>;
  check("missing alert configuration is a truthful 503", notConfigured.status === 503 && notConfiguredJson.delivered === false);
  routeDeliveryResult = { delivered: false, reason: "rejected", status: 503 };
  const routeRejected = await alertRoute.POST();
  const routeRejectedJson = await routeRejected.json() as Record<string, unknown>;
  check("webhook rejection is a truthful 502", routeRejected.status === 502 && routeRejectedJson.delivered === false);
  routeDeliveryResult = { delivered: false, reason: "network_error" };
  const routeNetworkError = await alertRoute.POST();
  const routeNetworkJson = await routeNetworkError.json() as Record<string, unknown>;
  check("webhook network failure is a truthful 502", routeNetworkError.status === 502 && routeNetworkJson.delivered === false);
  check("admin responses never contain the destination secret",
    !JSON.stringify({ deliveredJson, notConfiguredJson, routeRejectedJson, routeNetworkJson }).includes(SECRET_URL));

  rateLimitResponse = new Response('{"error":"Too many requests"}', { status: 429 });
  const beforeLimitedDelivery = routeDeliveryCalls.length;
  const limited = await alertRoute.POST();
  check("the existing abuse control denies repeated delivery", limited.status === 429);
  check("a throttled call makes zero external alert attempt", routeDeliveryCalls.length === beforeLimitedDelivery);

  section("D. untrusted Stripe traffic cannot reach external alerting");
  resetStripe();
  stripeEnabled = false;
  const unconfigured = await stripeRoute.POST(stripeRequest());
  check("unconfigured Stripe returns 503", unconfigured.status === 503);
  check("an unauthenticated config probe makes zero external alert attempt", externalStripeAttemptCount() === 0);
  check("the config failure remains locally structured-logged", logged.some((entry) => entry.level === "error" && entry.message === "Stripe webhook not configured"));

  resetStripe();
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const missingSecret = await stripeRoute.POST(stripeRequest());
  check("a missing signing secret returns 503", missingSecret.status === 503);
  check("a missing signing-secret probe makes zero external alert attempt", externalStripeAttemptCount() === 0);

  resetStripe();
  const missingSignature = await stripeRoute.POST(stripeRequest(""));
  check("missing Stripe signature is denied", missingSignature.status === 400);
  check("missing signature makes zero external alert attempt", externalStripeAttemptCount() === 0);

  resetStripe();
  constructMode = "invalid";
  const invalidSignature = await stripeRoute.POST(stripeRequest());
  check("invalid or malformed pre-verification input is denied", invalidSignature.status === 400);
  check("invalid signature makes zero external alert attempt", externalStripeAttemptCount() === 0);
  check("invalid signature retains safe local structured logging",
    logged.some((entry) => entry.level === "warn" && entry.message === "Stripe webhook signature rejected"));

  section("E. authenticated Stripe failures still alert without changing retry semantics");
  resetStripe();
  handlerShouldFail = true;
  const handlerFailure = await stripeRoute.POST(stripeRequest());
  check("authenticated handler failure returns 500 for Stripe retry", handlerFailure.status === 500);
  check("authenticated handler failure makes one external alert attempt",
    externalStripeAttemptCount() === 1 && externalReports[0]?.context?.phase === "handler");
  check("handler failure releases the claim and never completes it", released === 1 && completed === 0);

  resetStripe();
  claimShouldFail = true;
  const dedupeFailure = await stripeRoute.POST(stripeRequest());
  check("authenticated dedupe failure returns 500 for Stripe retry", dedupeFailure.status === 500);
  check("authenticated dedupe failure remains externally alert-worthy",
    externalStripeAttemptCount() === 1 && externalReports[0]?.context?.phase === "dedupe");
});
