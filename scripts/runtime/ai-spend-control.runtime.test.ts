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
// lib/aiMeter.ts's provider seam is allowed only in development or test (M-2b).
// Declaring the harness as `test` is what makes the substitution legal — and is
// itself the assertion that the positive allowance works.
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

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
// Models the two things the reservation depends on: rows in AiUsage, and the
// serialization `SELECT ... FOR UPDATE` really provides. The lock is honoured
// ONLY when the code under test actually issues that statement — so a version of
// lib/aiMeter.ts that reads the sum outside a transaction gets no serialization
// here and the concurrency assertion below reproduces the 9.6x overshoot.
type UsageRow = { id: string; userId: string | null; costUsd: number; ok: boolean; createdAt: Date };
const usage: UsageRow[] = [];
let aggregateThrows = false;
let createThrows = false;
let updateThrows = false;
let forUpdateAcquisitions = 0;
let nextRowId = 0;
const missingUsers = new Set<string>();

const userLockTail = new Map<string, Promise<void>>();
async function acquireUserLock(userId: string): Promise<() => void> {
  const previous = userLockTail.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  userLockTail.set(userId, previous.then(() => mine));
  await previous;
  return release;
}

function aggregateUsage({ where }: { where: { userId: string; createdAt: { gte: Date } } }) {
  if (aggregateThrows) throw new Error("guard: usage store unavailable");
  const since = where.createdAt.gte.valueOf();
  const sum = usage
    .filter((r) => r.userId === where.userId && r.createdAt.valueOf() >= since)
    .reduce((a, r) => a + r.costUsd, 0);
  return { _sum: { costUsd: sum } };
}

function createUsage({ data }: { data: Partial<UsageRow> }) {
  if (createThrows) throw new Error("guard: AiUsage insert unavailable");
  const row: UsageRow = {
    id: `usage_${++nextRowId}`,
    userId: data.userId ?? null,
    costUsd: data.costUsd ?? 0,
    ok: data.ok ?? true,
    createdAt: new Date(),
  };
  usage.push(row);
  return row;
}

mockModule("lib/prisma.ts", {
  prisma: {
    $executeRawUnsafe: async () => 0,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      // A holder, not a bare `let`: TypeScript narrows a variable assigned only
      // inside a callback and the later call would be an error on `never`.
      const held: { release: (() => void) | null } = { release: null };
      const tx = {
        $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const sql = strings.join("?");
          if (!/FOR UPDATE/i.test(sql)) return [];
          forUpdateAcquisitions++;
          const userId = String(values[0]);
          if (missingUsers.has(userId)) return [];
          held.release = await acquireUserLock(userId);
          return [{ id: userId }];
        },
        aiUsage: {
          aggregate: async (args: { where: { userId: string; createdAt: { gte: Date } } }) => aggregateUsage(args),
          create: async (args: { data: Partial<UsageRow> }) => createUsage(args),
        },
      };
      try {
        return await fn(tx);
      } finally {
        if (held.release) held.release();
      }
    },
    report: {
      count: async () => reportRows.length,
      findMany: async ({ take }: { take?: number }) => reportRows.slice(0, take ?? reportRows.length),
    },
    aiUsage: {
      create: async (args: { data: Partial<UsageRow> }) => createUsage(args),
      update: async ({ where, data }: { where: { id: string }; data: Partial<UsageRow> }) => {
        if (updateThrows) throw new Error("guard: AiUsage settlement unavailable");
        const row = usage.find((r) => r.id === where.id);
        if (!row) throw new Error("guard: no such reservation");
        if (data.costUsd !== undefined) row.costUsd = data.costUsd;
        if (data.ok !== undefined) row.ok = data.ok;
        return row;
      },
      aggregate: async (args: { where: { userId: string; createdAt: { gte: Date } } }) => aggregateUsage(args),
    },
  },
});

const reportRows = [{ id: "report_1", rawText: "cv1:stored", bureaus: ["EQUIFAX"] }];

const spendFor = (userId: string) =>
  usage.filter((r) => r.userId === userId).reduce((a, r) => a + r.costUsd, 0);

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

// L-3: the analyze route is the one surface that can SAY a budget refusal out
// loud — lib/analyze.ts catches every extractor exception and falls back to the
// deterministic parser, so without a pre-flight probe the refusal copy is
// unreachable by any consumer.
mockModule("lib/session.ts", { currentUserOrDemo: async () => ({ id: "user_analyze" }) });
mockModule("lib/rateLimit.ts", { enforceRateLimit: async () => null });
mockModule("lib/docCrypto.ts", { decryptText: () => "stored report text" });
mockModule("lib/kaiEvents.ts", { recordKaiEvent: async () => {} });
let analyzeRuns = 0;
mockModule("lib/analyze.ts", {
  analyzeReportText: async () => {
    analyzeRuns++;
    return { tradelines: 1, usedAI: false };
  },
});
const analyzeRoute = loadModule<{ POST(req: Request): Promise<Response>; maxDuration: number }>(
  "app/api/reports/analyze/route.ts"
);

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
  forUpdateAcquisitions = 0;
  // One Sonnet call at 8 000 max_tokens reserves ~$0.12 and settles to ~$0.12 on
  // the meter's own price table, so a $0.25 ceiling admits two.
  const estimate = meter.estimateRequestCostUsd("claude-sonnet-4-6", REQUEST);
  check(`the pre-call estimate is positive and conservative ($${estimate.toFixed(3)})`, estimate > 0);
  check(
    "the estimate assumes the full max_tokens the caller asked for",
    meter.estimateRequestCostUsd("claude-sonnet-4-6", { ...REQUEST, max_tokens: 16000 }) > estimate
  );

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
  check("the provider was NOT called for the refused request", messagesCreated === calls);
  check("the reservation really took the per-user row lock", forUpdateAcquisitions >= calls);
  const serialSpend = spendFor("user_budget");
  check(
    `serial spend never exceeds the ceiling ($${serialSpend.toFixed(3)} <= $0.25)`,
    serialSpend <= 0.25
  );
  check(
    "a settled reservation carries the ACTUAL cost, not the estimate",
    usage.filter((r) => r.userId === "user_budget").every((r) => r.costUsd > 0)
  );
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

  section("CONCURRENCY: 20 simultaneous calls cannot all read spent = $0 (M-2)");
  // The defect this replaces: read-then-write around the provider call. Measured
  // before the fix, 20 concurrent requests all passed the check and all spent —
  // $2.400 against a $0.25 ceiling, 9.6x overshoot. The surface's rate limit (20
  // uploads/hr) was the only real bound. This asserts the reservation holds.
  usage.length = 0;
  messagesCreated = 0;
  forUpdateAcquisitions = 0;
  const burst = await Promise.allSettled(
    Array.from({ length: 20 }, () => meter.meteredMessage("guard", "user_burst", REQUEST))
  );
  const fulfilled = burst.filter((r) => r.status === "fulfilled").length;
  const rejectedForBudget = burst.filter(
    (r) => r.status === "rejected" && r.reason instanceof meter.AiSpendRefusal
  ).length;
  const burstSpend = spendFor("user_burst");
  check(`only a bounded number of concurrent calls are admitted (${fulfilled}/20)`, fulfilled <= 3);
  check("every other concurrent call is refused by the budget", rejectedForBudget === 20 - fulfilled);
  check("the provider was called exactly once per admitted request", messagesCreated === fulfilled);
  check(
    `concurrent spend stays within one call of the ceiling ($${burstSpend.toFixed(3)} <= $${(0.25 + estimate).toFixed(3)})`,
    burstSpend <= 0.25 + estimate
  );
  check(
    "the burst is nowhere near the 9.6x overshoot the pre-fix code measured",
    burstSpend < 0.25 * 2
  );
  check("all 20 decisions serialized through the per-user lock", forUpdateAcquisitions === 20);

  section("a deleted principal cannot spend");
  missingUsers.add("user_gone");
  let goneRefusal: unknown = null;
  const beforeGone = messagesCreated;
  try {
    await meter.meteredMessage("guard", "user_gone", REQUEST);
  } catch (e) {
    goneRefusal = e;
  }
  check("a principal with no User row is refused", goneRefusal instanceof meter.AiSpendRefusal);
  check("and no provider call was made for it", messagesCreated === beforeGone);
  missingUsers.delete("user_gone");

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
  process.env.AI_DAILY_BUDGET_USD_PER_USER = "100";
  updateThrows = true;
  const openBefore = messagesCreated;
  const msg = await meter.meteredMessage("guard", "user_record_fault", REQUEST);
  check("a failed SETTLEMENT write does not fail the call", messagesCreated === openBefore + 1 && msg !== undefined);
  updateThrows = false;
  createThrows = true;
  const anonBefore = messagesCreated;
  const anonMsg = await meter.meteredMessage("guard", null, REQUEST);
  check("a failed anonymous usage write does not fail the call either", messagesCreated === anonBefore + 1 && anonMsg !== undefined);
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
      await meter.meteredMessage("parse", null, REQUEST); // first call always runs
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

  section("L-3: a consumer is TOLD when the budget refuses, not silently degraded");
  const analyzeRequest = () =>
    new Request("http://localhost/api/reports/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

  usage.length = 0;
  analyzeRuns = 0;
  process.env.AI_DAILY_BUDGET_USD_PER_USER = "5";
  const analyzeOk = await analyzeRoute.POST(analyzeRequest());
  check("with budget available the re-analysis runs", analyzeOk.status === 200 && analyzeRuns === 1);

  // Spend past the ceiling, then ask again.
  process.env.AI_DAILY_BUDGET_USD_PER_USER = "0.05";
  createUsage({ data: { userId: "user_analyze", costUsd: 1.0 } });
  analyzeRuns = 0;
  const analyzeRefused = await analyzeRoute.POST(analyzeRequest());
  check("an exhausted budget refuses the request outright", analyzeRefused.status === 429);
  check("and no fan-out ran", analyzeRuns === 0);
  const refusedBody = (await analyzeRefused.json()) as { error?: string };
  check(
    "the consumer sees the refusal copy verbatim, not a generic error",
    typeof refusedBody.error === "string" && /daily limit for AI analysis/i.test(refusedBody.error)
  );
  check("it still offers no payment path", !/upgrade|subscri|pay|premium/i.test(refusedBody.error ?? ""));
  check("the analyze route keeps its maxDuration", analyzeRoute.maxDuration === 60);
  delete process.env.AI_DAILY_BUDGET_USD_PER_USER;

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
