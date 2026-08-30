// Run: npx --no-install tsx scripts/agency-enable-security.test.ts
//
// MOCKED RUNTIME guard for the agency-enable authority boundary. It executes
// the real route and the real setup-secret helper with only session and Prisma
// replaced by in-process doubles. No database, provider, or network is used.
import { readFileSync } from "node:fs";
import {
  check,
  loadModule,
  mockModule,
  repoPath,
  run,
  requireActual,
  section,
} from "./runtime/_harness";

const SETUP_SECRET = "synthetic-agency-enable-secret-for-test-only";
const WRONG_SECRET = "synthetic-wrong-agency-secret-for-test-only";
const BODY_ONLY_SECRET = "synthetic-body-only-agency-secret-for-test-only";

type Account = {
  id: string;
  role: "ADMIN" | "USER";
  name: string | null;
  agencyName: string | null;
};

type Invocation = {
  status: number;
  body: string;
  logs: string[];
};

type UserUpdate = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};

let account: Account | null = null;
const updates: UserUpdate[] = [];
const rateCounts = new Map<string, number>();
let networkAttempts = 0;

mockModule("lib/prisma.ts", {
  prisma: {
    $executeRawUnsafe: async () => 0,
    rateHit: {
      upsert: async ({ where }: { where: { bucket: string } }) => {
        const count = (rateCounts.get(where.bucket) ?? 0) + 1;
        rateCounts.set(where.bucket, count);
        return { bucket: where.bucket, count };
      },
    },
    user: {
      update: async (args: UserUpdate) => {
        updates.push(args);
        return args;
      },
    },
  },
});

mockModule("lib/session.ts", {
  currentAccount: async () => account,
});

const realAdmin = requireActual<typeof import("../lib/admin")>("lib/admin.ts");
mockModule("lib/admin.ts", {
  setupSecretAccepted: (req: Request) => realAdmin.setupSecretAccepted(req),
});

process.env.SETUP_SECRET = SETUP_SECRET;

const route = loadModule<{
  POST(req: Request): Promise<Response>;
  GET?: unknown;
  PUT?: unknown;
  PATCH?: unknown;
  DELETE?: unknown;
}>("app/api/agency/enable/route.ts");

function request(options: {
  header?: string;
  body?: Record<string, unknown>;
  ip?: string;
} = {}): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.header !== undefined) headers.set("x-setup-secret", options.header);
  if (options.ip !== undefined) headers.set("x-real-ip", options.ip);
  return new Request("https://runtime.test/api/agency/enable", {
    method: "POST",
    headers,
    body: JSON.stringify(options.body ?? {}),
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
    return { status: response.status, body: await response.text(), logs };
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    console.debug = original.debug;
  }
}

function containsCredential(value: string): boolean {
  return [SETUP_SECRET, WRONG_SECRET, BODY_ONLY_SECRET].some((secret) => value.includes(secret));
}

function expectDenied(label: string, before: number, result: Invocation): void {
  check(`${label}: responds 403`, result.status === 403);
  check(`${label}: performs no user mutation`, updates.length === before);
}

function expectExactAgencyMutation(
  label: string,
  before: number,
  expectedAccountId: string,
  expectedAgencyName: string,
): void {
  check(`${label}: performs exactly one mutation`, updates.length === before + 1);
  const mutation = updates.at(-1);
  const whereKeys = Object.keys(mutation?.where ?? {}).sort();
  const dataKeys = Object.keys(mutation?.data ?? {}).sort();
  check(
    `${label}: targets only the authenticated account id`,
    whereKeys.join(",") === "id" && mutation?.where.id === expectedAccountId,
  );
  check(
    `${label}: writes exactly agencyName and isAgency`,
    dataKeys.join(",") === "agencyName,isAgency",
  );
  check(`${label}: grants agency mode`, mutation?.data.isAgency === true);
  check(`${label}: preserves the server-derived agency name`, mutation?.data.agencyName === expectedAgencyName);
  check(`${label}: never writes the ADMIN role`, !("role" in (mutation?.data ?? {})));
}

run("agency-enable-security.test.ts", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    networkAttempts++;
    throw new Error("REFUSED network access in agency-enable security test");
  }) as typeof fetch;

  try {
    const routeSource = readFileSync(repoPath("app/api/agency/enable/route.ts"), "utf8");
    const pageSource = readFileSync(repoPath("app/agency/page.tsx"), "utf8");

    section("1. route and credential transport contract");
    check("the mutation is exported only as POST", typeof route.POST === "function");
    check("GET is not exported", route.GET === undefined);
    check("PUT is not exported", route.PUT === undefined);
    check("PATCH is not exported", route.PATCH === undefined);
    check("DELETE is not exported", route.DELETE === undefined);
    check("the route delegates to the shared setup-secret helper", /setupSecretAccepted\(req\)/.test(routeSource));
    check("the route does not read SETUP_SECRET directly", !/process\.env\.SETUP_SECRET/.test(routeSource));
    check("the route has no timing-naive setup-secret equality", !/(?:secret|setupSecret)[^;\n]{0,100}===|===[^;\n]{0,100}(?:secret|setupSecret)/.test(routeSource));
    check("the page sends the credential only in x-setup-secret", /"x-setup-secret"\s*:\s*secret/.test(pageSource));
    check("the page no longer serializes a body secret", !/JSON\.stringify\(\s*\{\s*secret\s*\}\s*\)/.test(pageSource));
    check("the route contains no credential logging", !/console\.(?:log|info|warn|error|debug)\s*\(/.test(routeSource));

    section("2. authentication and fail-closed denials");
    account = null;
    let before = updates.length;
    const unauthenticated = await invoke(request({ header: SETUP_SECRET, ip: "198.51.100.1" }));
    check("an unauthenticated caller receives 401", unauthenticated.status === 401);
    check("an unauthenticated caller performs no mutation", updates.length === before);

    account = { id: "consumer", role: "USER", name: "Consumer", agencyName: null };
    before = updates.length;
    const missing = await invoke(request({ ip: "198.51.100.2" }));
    expectDenied("authenticated consumer without setup authority", before, missing);

    before = updates.length;
    const wrong = await invoke(request({ header: WRONG_SECRET, ip: "198.51.100.3" }));
    expectDenied("wrong header", before, wrong);

    before = updates.length;
    const malformed = await invoke(request({ header: "   ", ip: "198.51.100.4" }));
    expectDenied("malformed header", before, malformed);

    before = updates.length;
    const bodyOnly = await invoke(request({ body: { secret: SETUP_SECRET }, ip: "198.51.100.5" }));
    expectDenied("body-only correct secret", before, bodyOnly);

    before = updates.length;
    const wrongHeaderCorrectBody = await invoke(request({
      header: WRONG_SECRET,
      body: { secret: SETUP_SECRET },
      ip: "198.51.100.6",
    }));
    expectDenied("wrong header plus correct body", before, wrongHeaderCorrectBody);

    section("3. valid setup authority and existing admin authority");
    before = updates.length;
    const valid = await invoke(request({
      header: SETUP_SECRET,
      body: {
        agencyName: "Test Agency",
        secret: BODY_ONLY_SECRET,
        id: "victim",
        userId: "victim",
        targetId: "victim",
        role: "ADMIN",
        isAgency: false,
      },
      ip: "198.51.100.7",
    }));
    check("authenticated consumer plus valid setup header succeeds", valid.status === 200);
    expectExactAgencyMutation("valid setup authority", before, "consumer", "Test Agency");
    check("caller-controlled cross-user target data is inert", !JSON.stringify(updates.at(-1)).includes("victim"));

    account = { id: "admin", role: "ADMIN", name: "Owner", agencyName: null };
    before = updates.length;
    const admin = await invoke(request({
      body: { targetId: "victim", role: "USER", isAgency: false },
      ip: "198.51.100.8",
    }));
    check("authenticated ADMIN remains an independent authority path", admin.status === 200);
    expectExactAgencyMutation("admin authority", before, "admin", "Owner");

    section("4. repeated guessing is throttled before elevation");
    account = { id: "consumer", role: "USER", name: "Consumer", agencyName: null };
    const guessingIp = "198.51.100.9";
    before = updates.length;
    for (let attempt = 0; attempt < 10; attempt++) {
      const guess = await invoke(request({ header: `${WRONG_SECRET}-${attempt}`, ip: guessingIp }));
      check(`wrong guess ${attempt + 1} is denied`, guess.status === 403);
    }
    const throttledValid = await invoke(request({ header: SETUP_SECRET, ip: guessingIp }));
    expectDenied("valid credential after ten guesses is still rate-limited", before, throttledValid);
    check("the repeated-guess bucket recorded eleven attempts", [...rateCounts.values()].includes(11));

    section("5. absent server configuration fails closed");
    delete process.env.SETUP_SECRET;
    before = updates.length;
    const absent = await invoke(request({ header: SETUP_SECRET, ip: "198.51.100.10" }));
    expectDenied("consumer path with SETUP_SECRET absent", before, absent);

    section("6. credentials are never echoed, logged, or sent externally");
    const results = [unauthenticated, missing, wrong, malformed, bodyOnly, wrongHeaderCorrectBody, valid, admin, throttledValid, absent];
    check("no response body echoes a supplied credential", results.every((result) => !containsCredential(result.body)));
    check("no captured log contains a supplied credential", results.every((result) => !containsCredential(result.logs.join("\n"))));
    check("no network call was attempted", networkAttempts === 0);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.SETUP_SECRET;
  }
});
