// Run: npx --no-install tsx scripts/runtime/stripe-provision-auth.runtime.test.ts
//
// MOCKED RUNTIME guard for the Stripe catalog provisioning endpoint. This loads
// the real route only after replacing both of its privileged boundaries:
//   - admin/session lookup is an in-process fake;
//   - lib/stripe.ts is a complete fake and the Stripe SDK constructor refuses.
//
// No real environment credential is read, no network call is allowed, and the
// fake Stripe object throws if route code tries to access an SDK surface directly.
// The successful control therefore proves routing/auth behavior without invoking
// catalog, product, price, customer, or subscription behavior.
import { readFileSync } from "node:fs";
import {
  check,
  loadModule,
  mockModule,
  mockPackage,
  repoPath,
  run,
  section,
} from "./_harness";

const SETUP_SECRET = "synthetic-stripe-provision-secret-for-test-only";
const WRONG_SECRET = "synthetic-wrong-secret-for-test-only";
const QUERY_DECOY = "synthetic-query-decoy-for-test-only";

type AdminPrincipal = { id: string; email: string };
type Invocation = {
  status: number;
  body: string;
  location: string | null;
  logs: string[];
};

let adminPrincipal: AdminPrincipal | null = null;
const audits: unknown[] = [];
const fakeStripeCalls: string[] = [];
let stripeSdkConstructionAttempts = 0;
let directStripePropertyReads = 0;
let networkAttempts = 0;
let resolversReceivedOnlyRefusalDouble = true;

const refusingStripe = new Proxy(
  { boundary: "in-process-stripe-refusal-double" },
  {
    get(target, property, receiver) {
      if (property === "boundary") return Reflect.get(target, property, receiver);
      directStripePropertyReads++;
      throw new Error(`REFUSED direct Stripe property access: ${String(property)}`);
    },
  },
);

mockModule("lib/admin.ts", {
  requireAdmin: async () => adminPrincipal,
  logAudit: async (entry: unknown) => {
    audits.push(entry);
  },
});

mockModule("lib/stripe.ts", {
  PRICES: {
    synthetic_month: { testOnly: true },
    synthetic_year: { testOnly: true },
  },
  getStripe: () => {
    fakeStripeCalls.push("getStripe");
    return refusingStripe;
  },
  resolvePrice: async (stripe: unknown, key: string) => {
    resolversReceivedOnlyRefusalDouble &&= stripe === refusingStripe;
    fakeStripeCalls.push(`resolvePrice:${key}`);
    return `price_${key}_test_only`;
  },
  reconcileTaxCodes: async (stripe: unknown) => {
    resolversReceivedOnlyRefusalDouble &&= stripe === refusingStripe;
    fakeStripeCalls.push("reconcileTaxCodes");
    return ["synthetic test product"];
  },
});

// Defense in depth: even a mistaken import of the actual Stripe module cannot
// construct a client in this process.
mockPackage("stripe", {
  default: class RefusingStripeSdk {
    constructor() {
      stripeSdkConstructionAttempts++;
      throw new Error("REFUSED Stripe SDK construction in provisioning auth test");
    }
  },
});

// Install synthetic configuration before the route is loaded. Deliberately do
// not preserve/read any pre-existing credential value.
process.env.SETUP_SECRET = SETUP_SECRET;
delete process.env.STRIPE_SECRET_KEY;

const route = loadModule<{
  POST(req: Request): Promise<Response>;
  GET?: unknown;
  PUT?: unknown;
  PATCH?: unknown;
  DELETE?: unknown;
}>("app/api/admin/billing/provision/route.ts");

function request(options: { header?: string; query?: string } = {}): Request {
  const query = options.query === undefined ? "" : `?secret=${encodeURIComponent(options.query)}`;
  const headers = new Headers();
  if (options.header !== undefined) headers.set("x-setup-secret", options.header);
  return new Request(`https://runtime.test/api/admin/billing/provision${query}`, {
    method: "POST",
    headers,
  });
}

async function invoke(req: Request): Promise<Invocation> {
  const logs: string[] = [];
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
  const capture = (...values: unknown[]) => {
    logs.push(values.map((value) => String(value)).join(" "));
  };
  console.log = capture;
  console.info = capture;
  console.warn = capture;
  console.error = capture;
  console.debug = capture;
  try {
    const response = await route.POST(req);
    return {
      status: response.status,
      body: await response.text(),
      location: response.headers.get("location"),
      logs,
    };
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    console.debug = original.debug;
  }
}

function resetBoundaryEvidence(): void {
  fakeStripeCalls.length = 0;
  audits.length = 0;
  directStripePropertyReads = 0;
  resolversReceivedOnlyRefusalDouble = true;
}

function expectRefused(label: string, result: Invocation): void {
  check(`${label}: responds 403`, result.status === 403);
  check(`${label}: stops before the Stripe boundary`, fakeStripeCalls.length === 0);
  check(`${label}: writes no audit record`, audits.length === 0);
}

function containsCredential(value: string): boolean {
  return [SETUP_SECRET, WRONG_SECRET, QUERY_DECOY].some((credential) => value.includes(credential));
}

run("stripe-provision-auth.runtime.test.ts", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    networkAttempts++;
    throw new Error("REFUSED network access in provisioning auth test");
  }) as typeof fetch;

  try {
    section("1. method and transport surface");
    const source = readFileSync(repoPath("app/api/admin/billing/provision/route.ts"), "utf8");
    check("the mutation is exported only as POST", typeof route.POST === "function");
    check("GET is not exported", route.GET === undefined);
    check("PUT is not exported", route.PUT === undefined);
    check("PATCH is not exported", route.PATCH === undefined);
    check("DELETE is not exported", route.DELETE === undefined);
    check("the setup secret is read from x-setup-secret", /headers\.get\("x-setup-secret"\)/.test(source));
    check(
      "URL/query parsing is absent from provisioning authorization",
      !/searchParams|get\("secret"\)|new URL\(req\.url\)/.test(source),
    );
    check("the route contains no console logging", !/console\.(?:log|info|warn|error|debug)\s*\(/.test(source));
    check("the route contains no redirect", !/redirect\s*\(/.test(source));

    section("2. missing, wrong, and URL-only credentials fail closed");
    adminPrincipal = null;

    resetBoundaryEvidence();
    const missing = await invoke(request());
    expectRefused("missing header", missing);

    resetBoundaryEvidence();
    const wrong = await invoke(request({ header: WRONG_SECRET }));
    expectRefused("wrong header", wrong);

    resetBoundaryEvidence();
    const queryOnly = await invoke(request({ query: SETUP_SECRET }));
    expectRefused("query-only correct secret", queryOnly);

    resetBoundaryEvidence();
    const wrongHeaderCorrectQuery = await invoke(
      request({ header: WRONG_SECRET, query: SETUP_SECRET }),
    );
    expectRefused("wrong header plus correct query", wrongHeaderCorrectQuery);

    section("3. the canonical header authorizes and the query is inert");
    resetBoundaryEvidence();
    const headerAuthorized = await invoke(
      request({ header: SETUP_SECRET, query: QUERY_DECOY }),
    );
    check("correct x-setup-secret reaches the stubbed success path", headerAuthorized.status === 200);
    check(
      "only local Stripe doubles ran",
      fakeStripeCalls.join("|") ===
        "getStripe|resolvePrice:synthetic_month|resolvePrice:synthetic_year|reconcileTaxCodes",
    );
    check("header-only authorization does not invent an admin audit actor", audits.length === 0);
    check("every resolver receives only the refusal double", resolversReceivedOnlyRefusalDouble);
    check("the route never accesses a Stripe SDK property directly", directStripePropertyReads === 0);

    section("4. absent server configuration and admin-session compatibility");
    delete process.env.SETUP_SECRET;
    resetBoundaryEvidence();
    const unconfigured = await invoke(request({ header: SETUP_SECRET }));
    expectRefused("server secret absent", unconfigured);

    adminPrincipal = { id: "admin_test_only", email: "admin@runtime.test" };
    resetBoundaryEvidence();
    const adminAuthorized = await invoke(request({ query: SETUP_SECRET }));
    check("signed-in admin remains authorized without SETUP_SECRET", adminAuthorized.status === 200);
    check("admin success writes one local audit record", audits.length === 1);
    check("admin audit does not contain a supplied credential", !containsCredential(JSON.stringify(audits)));

    section("5. responses never echo, redirect, or log credentials");
    const results = [missing, wrong, queryOnly, wrongHeaderCorrectQuery, headerAuthorized, unconfigured, adminAuthorized];
    check(
      "no response body contains any supplied credential",
      results.every((result) => !containsCredential(result.body)),
    );
    check(
      "no response redirects or sets Location",
      results.every(
        (result) =>
          (result.status < 300 || result.status >= 400) && result.location === null,
      ),
    );
    check(
      "the route emits no logs containing credentials",
      results.every((result) => result.logs.length === 0 || !containsCredential(result.logs.join("\n"))),
    );
    check("the route emitted no runtime logs at all", results.every((result) => result.logs.length === 0));

    section("6. proof that no external Stripe effect was possible");
    check("the Stripe SDK was never constructed", stripeSdkConstructionAttempts === 0);
    check("no network call was attempted", networkAttempts === 0);
    check("no direct Stripe SDK surface was accessed", directStripePropertyReads === 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
