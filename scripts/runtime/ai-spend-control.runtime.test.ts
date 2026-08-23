// Run: npx --no-install tsx scripts/runtime/ai-spend-control.runtime.test.ts
//
// P0-10 (E-07) — AI spend must be bounded before the call, not measured after it.
//
// THE DEFECT (lib/aiMeter.ts on a72a47c):
//   · `:106` `new Anthropic({ apiKey: key })` — no `timeout`, no `maxRetries`.
//     The SDK defaults are a 10-minute timeout with automatic retries, longer
//     than every `maxDuration` in the repo, so retries kept spending after the
//     function had been killed and the consumer had already seen an error.
//   · `:60-87` metered cost AFTER the fact and failed open at `:85`. No budget,
//     no cap, no breaker existed anywhere in the tree.
//   · the highest-volume surfaces call the meter with `userId: null`
//     (lib/aiParse.ts:137 report parsing, lib/kai.ts:127, lib/round2.ts:59), so
//     any per-user control keyed on that argument alone would have missed them.
//
// This guard executes the REAL lib/aiMeter.ts with the Anthropic SDK and Prisma
// replaced by in-process doubles, and asserts on the constructor arguments the
// meter actually passes and on whether a call happened at all.
//
// Offline. No database, no network, no API key beyond a fake string.
import { check, loadModule, mockModule, run, section } from "./_harness";

type Json = Record<string, unknown>;

process.env.ANTHROPIC_API_KEY = "not-a-real-key-guard-only";

// ── Provider double ──────────────────────────────────────────────────────────
// Installed through lib/aiMeter.ts's own provider seam (setAiClientFactory).
// The package cannot be intercepted by the harness's Module._load patch:
// @anthropic-ai/sdk ships an ESM build, so `await import(...)` inside the meter
// is resolved by Node's ESM loader and never reaches the CJS hook. Substituting
// at the seam is what keeps this guard genuinely offline — an earlier draft that
// mocked the package instead reached api.anthropic.com.
const constructedWith: Json[] = [];
let messagesCreated = 0;

// ── Prisma double ────────────────────────────────────────────────────────────
// Just enough to hold AiUsage rows and answer one aggregate. `aggregateThrows`
// simulates the limiter backend being down, which is the fail-closed case.
type UsageRow = { userId: string | null; costUsd: number; createdAt: Date };
const usage: UsageRow[] = [];
let aggregateThrows = false;
let createThrows = false;

mockModule("lib/prisma.ts", {
  prisma: {
    $executeRawUnsafe: async () => 0,
    aiUsage: {
      create: async ({ data }: { data: UsageRow }) => {
        if (createThrows) throw new Error("guard: AiUsage insert unavailable");
        usage.push({ userId: data.userId, costUsd: data.costUsd, createdAt: new Date() });
        return data;
      },
      aggregate: async ({ where }: { where: { userId: string; createdAt: { gte: Date } } }) => {
        if (aggregateThrows) throw new Error("guard: usage store unavailable");
        const since = where.createdAt.gte.valueOf();
        const sum = usage
          .filter((r) => r.userId === where.userId && r.createdAt.valueOf() >= since)
          .reduce((a, r) => a + r.costUsd, 0);
        return { _sum: { costUsd: sum } };
      },
    },
  },
});

const meter = loadModule<typeof import("../../lib/aiMeter")>("lib/aiMeter.ts");

meter.setAiClientFactory((opts) => {
  constructedWith.push(opts as unknown as Json);
  return {
    messages: {
      create: async () => {
        messagesCreated++;
        return {
          model: "claude-sonnet-4-6",
          usage: { input_tokens: 30_000, output_tokens: 2_000 },
          content: [{ type: "text", text: "{}" }],
        };
      },
    },
  };
});

const REQUEST = { model: "claude-sonnet-4-6", max_tokens: 8000, messages: [] };

run("ai-spend-control.runtime.test.ts", async () => {
  section("the provider client is constructed with explicit bounds");
  delete process.env.AI_REQUEST_TIMEOUT_MS;
  constructedWith.length = 0;
  await meter.meteredMessage("guard", "user_timeout", REQUEST);
  const opts = constructedWith[0] ?? {};
  check("a timeout is passed explicitly (never the SDK's 10-minute default)", typeof opts.timeout === "number");
  check(
    `the timeout is <= 60 s so it cannot outlive maxDuration (${opts.timeout} ms)`,
    typeof opts.timeout === "number" && opts.timeout <= 60_000 && opts.timeout >= 1_000
  );
  check("maxRetries is pinned to 1", opts.maxRetries === 1);
  check("the API key is still passed to the constructor only", typeof opts.apiKey === "string");

  section("the timeout is operator-tunable but cannot be raised past the ceiling");
  process.env.AI_REQUEST_TIMEOUT_MS = "9000";
  check("a valid override is honoured", meter.aiRequestTimeoutMs() === 9_000);
  process.env.AI_REQUEST_TIMEOUT_MS = "600000";
  check("an override above 60 s is clamped, not obeyed", meter.aiRequestTimeoutMs() === 60_000);
  process.env.AI_REQUEST_TIMEOUT_MS = "not-a-number";
  check("a junk override falls back to the default", meter.aiRequestTimeoutMs() === 45_000);
  delete process.env.AI_REQUEST_TIMEOUT_MS;

  section("the per-user daily budget refuses BEFORE spending");
  delete process.env.AI_DAILY_BUDGET_USD_PER_USER;
  check("the default ceiling is conservative and positive", meter.aiDailyBudgetUsd() === 1.0);
  process.env.AI_DAILY_BUDGET_USD_PER_USER = "0";
  check("there is no 'unlimited' setting — 0 falls back to the default", meter.aiDailyBudgetUsd() === 1.0);
  process.env.AI_DAILY_BUDGET_USD_PER_USER = "-5";
  check("a negative ceiling falls back to the default", meter.aiDailyBudgetUsd() === 1.0);
  process.env.AI_DAILY_BUDGET_USD_PER_USER = "0.25";
  check("a valid ceiling is honoured", meter.aiDailyBudgetUsd() === 0.25);

  usage.length = 0;
  messagesCreated = 0;
  // One Sonnet call at 30k in / 2k out ≈ $0.12 on the meter's own price table.
  let calls = 0;
  let refusal: unknown = null;
  try {
    for (let i = 0; i < 25; i++) {
      await meter.meteredMessage("guard", "user_budget", REQUEST);
      calls++;
    }
  } catch (e) {
    refusal = e;
  }
  check("the budget eventually refuses", refusal instanceof meter.AiSpendRefusal);
  check("it refused after a bounded number of calls, not on the first", calls > 0 && calls < 25);
  check(
    "the provider was NOT called for the refused request",
    messagesCreated === calls
  );
  const spent = usage.filter((r) => r.userId === "user_budget").reduce((a, r) => a + r.costUsd, 0);
  check(`recorded spend reached the ceiling before the refusal ($${spent.toFixed(3)} >= $0.25)`, spent >= 0.25);
  if (refusal instanceof meter.AiSpendRefusal) {
    const m = refusal.consumerMessage;
    check("the refusal carries a consumer-facing message", typeof m === "string" && m.length > 20);
    check("it says when the limit clears", /reset|midnight/i.test(m));
    check(
      "it offers no payment path — the consumer product is free",
      !/upgrade|subscri|pay|plan|premium|pro\b/i.test(m)
    );
    check(
      "it promises nothing about credit outcomes",
      !/delet|remove|improve|score|guarantee/i.test(m)
    );
    check("the refusal kind is explicit", refusal.kind === "budget-exhausted");
  }

  section("a different consumer is unaffected by someone else's spend");
  const before = messagesCreated;
  await meter.meteredMessage("guard", "user_other", REQUEST);
  check("the budget is per user, not global", messagesCreated === before + 1);

  section("an unreadable budget FAILS CLOSED");
  aggregateThrows = true;
  const spendBefore = messagesCreated;
  let closedRefusal: unknown = null;
  try {
    await meter.meteredMessage("guard", "user_faulty", REQUEST);
  } catch (e) {
    closedRefusal = e;
  }
  check("a budget-store fault refuses instead of spending", closedRefusal instanceof meter.AiSpendRefusal);
  check("no provider call was made", messagesCreated === spendBefore);
  if (closedRefusal instanceof meter.AiSpendRefusal) {
    check("the refusal kind distinguishes our fault from the consumer's use", closedRefusal.kind === "budget-unavailable");
    check(
      "the message blames the system, not the consumer",
      /couldn't check|try again/i.test(closedRefusal.consumerMessage)
    );
  }
  aggregateThrows = false;

  section("metering itself still fails OPEN — recording must not break a paid call");
  createThrows = true;
  process.env.AI_DAILY_BUDGET_USD_PER_USER = "100";
  const openBefore = messagesCreated;
  const msg = await meter.meteredMessage("guard", "user_record_fault", REQUEST);
  check("a failed usage WRITE does not fail the call", messagesCreated === openBefore + 1 && msg !== undefined);
  createThrows = false;

  section("the ambient principal covers the surfaces that pass userId: null");
  // lib/aiParse.ts calls meteredMessage("parse", null, …). Without the scope the
  // single most expensive surface in the product would be outside the budget.
  usage.length = 0;
  process.env.AI_DAILY_BUDGET_USD_PER_USER = "0.05";
  let scopedRefusal: unknown = null;
  await meter.withAiPrincipal("user_scoped", async () => {
    check("the principal is visible inside the scope", meter.currentAiPrincipal() === "user_scoped");
    try {
      await meter.meteredMessage("parse", null, REQUEST); // first call: budget empty
      await meter.meteredMessage("parse", null, REQUEST); // second: over the ceiling
    } catch (e) {
      scopedRefusal = e;
    }
  });
  check("a null-userId call inside the scope is budgeted against the consumer", scopedRefusal instanceof meter.AiSpendRefusal);
  check(
    "and the usage row is attributed to them rather than to nobody",
    usage.some((r) => r.userId === "user_scoped")
  );
  check("the principal does not leak outside the scope", meter.currentAiPrincipal() === null);

  section("baseline behaviour that must never return");
  const unscoped = usage.length;
  process.env.AI_DAILY_BUDGET_USD_PER_USER = "0.0001";
  // No principal, no userId: nothing to budget against. This is the pre-change
  // behaviour, and it is exactly why the scope above exists — it is asserted
  // here so a future change that silently reverts the scope is visible.
  await meter.meteredMessage("parse", null, REQUEST);
  check(
    "outside any principal an anonymous call is still unbudgeted (documented residual)",
    usage.length === unscoped + 1 && usage[usage.length - 1].userId === null
  );

  delete process.env.AI_DAILY_BUDGET_USD_PER_USER;
});
