// Run: npx --no-install tsx scripts/runtime/rate-limit-failclosed.runtime.test.ts
//
// P0-10 (E-07) — the rate limiter must FAIL CLOSED.
//
// THE DEFECT (lib/rateLimit.ts:72-75 on a72a47c):
//   } catch (e) {
//     console.error("rateLimit error (failing open)", e);
//     return { ok: true, retryAfter: 0 };
//   }
// This was the only control in front of paid AI spend on every AI route
// (reports/upload 20/hr, reports/analyze 10/hr, strategist/plan 10/hr,
// identity/discrepancies 10/hr, letters/*), and it was backed by the same
// Postgres those routes use — so a single database fault removed every AI quota
// in the product at once, and login throttling with it.
//
// This guard executes the REAL limiter with a Prisma double that can be told to
// fail, and asserts on the returned decision and on the HTTP response the route
// helper builds from it.
//
// Offline. No database, no network, no keys.
import { check, loadModule, mockModule, run, section } from "./_harness";

type Bucket = { bucket: string; count: number };

const rows = new Map<string, Bucket>();
let upsertThrows = false;
let ensureThrows = false;
let upsertCalls = 0;

mockModule("lib/prisma.ts", {
  prisma: {
    $executeRawUnsafe: async () => {
      if (ensureThrows) throw new Error("guard: cannot create RateHit");
      return 0;
    },
    rateHit: {
      upsert: async ({ where }: { where: { bucket: string } }) => {
        upsertCalls++;
        if (upsertThrows) throw new Error("guard: RateHit store unavailable");
        const existing = rows.get(where.bucket);
        const next = { bucket: where.bucket, count: (existing?.count ?? 0) + 1 };
        rows.set(where.bucket, next);
        return next;
      },
    },
  },
});

const limiter = loadModule<typeof import("../../lib/rateLimit")>("lib/rateLimit.ts");

run("rate-limit-failclosed.runtime.test.ts", async () => {
  // Runs FIRST on purpose: ensureRateLimitTable() memoises success in a
  // module-level flag, so a DDL fault is only reachable before the first
  // successful call — exactly as it would be on a cold lambda.
  section("a self-heal/DDL fault denies (before the counter is ever written)");
  ensureThrows = true;
  const ddlFault = await limiter.rateLimit("guard:ddl", 100, 3600);
  check("a failure before the counter write denies", ddlFault.ok === false && ddlFault.reason === "unavailable");
  check("and no counter write was attempted", upsertCalls === 0);
  ensureThrows = false;

  section("normal operation is unchanged");
  rows.clear();
  const first = await limiter.rateLimit("guard:normal", 3, 3600);
  check("the first request under the limit is allowed", first.ok === true);
  check("an allowed request carries no denial reason", first.reason === undefined);
  await limiter.rateLimit("guard:normal", 3, 3600);
  await limiter.rateLimit("guard:normal", 3, 3600);
  const overLimit = await limiter.rateLimit("guard:normal", 3, 3600);
  check("the fourth request over a limit of 3 is denied", overLimit.ok === false);
  check("a genuine over-limit denial says so", overLimit.reason === "over-limit");
  check("it reports when the window rolls over", overLimit.retryAfter > 0);

  section("a limiter-backend fault DENIES (this is the whole finding)");
  upsertThrows = true;
  const faulted = await limiter.rateLimit("guard:fault", 100, 3600);
  check("a store fault does NOT return ok", faulted.ok === false);
  check("the denial is labelled as our fault, not the consumer's", faulted.reason === "unavailable");
  check("it still tells the caller when to retry", faulted.retryAfter > 0);

  section("the limiter never throws — callers must not need a try/catch");
  upsertThrows = true;
  let threw = false;
  try {
    await limiter.rateLimit("guard:nothrow", 100, 3600);
  } catch {
    threw = true;
  }
  check("a backend fault is reported, not thrown", threw === false);
  upsertThrows = false;

  section("the route helper turns each denial into the truthful status");
  rows.clear();
  const allowed = await limiter.enforceRateLimit("guard:http", 1, 3600);
  check("an allowed caller gets null and continues", allowed === null);

  const denied = await limiter.enforceRateLimit("guard:http", 1, 3600);
  check("a real over-limit caller gets 429", denied !== null && denied.status === 429);
  if (denied) {
    const body = (await denied.json()) as { error?: string };
    check("429 says the consumer is going too fast", /too many requests/i.test(body.error ?? ""));
    check("429 carries Retry-After", denied.headers.get("Retry-After") !== null);
  }

  upsertThrows = true;
  const unavailable = await limiter.enforceRateLimit("guard:http2", 100, 3600);
  check("a limiter fault gets 503, not 200 and not a misleading 429", unavailable !== null && unavailable.status === 503);
  if (unavailable) {
    const body = (await unavailable.json()) as { error?: string };
    check(
      "503 blames the service, never the consumer",
      !/too many requests|slow down/i.test(body.error ?? "") && (body.error ?? "").length > 20
    );
    check("503 carries Retry-After", unavailable.headers.get("Retry-After") !== null);
  }
  upsertThrows = false;

  section("non-vacuity: the assertions above cannot pass on a fail-OPEN limiter");
  // A fail-open limiter returns { ok: true, retryAfter: 0 } from the same catch,
  // so "faulted.ok === false", "reason === 'unavailable'" and the 503 branch are
  // all unreachable without the change. Recorded here so the reason a reviewer
  // must check is written down next to the checks it justifies.
  check("the fault path was really exercised (the double was called)", upsertCalls > 0);
});
