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

  section("PLATFORM CEILING: the control that does not depend on attribution");
  // S11 · B-1 showed the shape of the hole: one call site that forgets to open a
  // principal has NO ceiling at all, because the per-user reservation is the only
  // control and it is keyed on attribution. The global ceiling is checked for
  // every call, principal or not, so a forgotten call site is still bounded.
  usage.length = 0;
  messagesCreated = 0;
  meter.resetGlobalSpendCache();
  delete process.env.AI_DAILY_BUDGET_USD_PER_USER;
  delete process.env.AI_DAILY_BUDGET_USD_GLOBAL;
  check("the platform ceiling is on by default and positive", meter.aiDailyGlobalBudgetUsd() === 50);
  process.env.AI_DAILY_BUDGET_USD_GLOBAL = "0";
  check("there is no 'unlimited' setting for it either", meter.aiDailyGlobalBudgetUsd() === 50);
  process.env.AI_DAILY_BUDGET_USD_GLOBAL = "7.5";
  check("a valid platform ceiling is honoured", meter.aiDailyGlobalBudgetUsd() === 7.5);

  // Spend past the platform ceiling using ANONYMOUS calls — no principal, no
  // ambient scope — i.e. exactly the surface B-1 found unbudgeted.
  process.env.AI_DAILY_BUDGET_USD_GLOBAL = "0.30";
  meter.resetGlobalSpendCache();
  let anonymousCalls = 0;
  let ceilingRefusal: unknown = null;
  try {
    for (let i = 0; i < 25; i++) {
      await meter.meteredMessage("response-analysis", null, REQUEST);
      anonymousCalls++;
    }
  } catch (e) {
    ceilingRefusal = e;
  }
  check("an UNATTRIBUTED call is now bounded by something", ceilingRefusal instanceof meter.AiSpendRefusal);
  check("and it is bounded quickly, not after 25 calls", anonymousCalls > 0 && anonymousCalls < 25);
  check("the provider was not called for the refused request", messagesCreated === anonymousCalls);
  if (ceilingRefusal instanceof meter.AiSpendRefusal) {
    check("the refusal names the platform ceiling, not the consumer's usage", ceilingRefusal.kind === "global-ceiling");
    const m = ceilingRefusal.consumerMessage;
    check("its copy does not blame the consumer or their credit file", /isn't about your account|not about your account/i.test(m));
    check("it says when the limit clears", /midnight UTC/i.test(m));
    check("it offers no payment path", !/upgrade|subscri|\bpay\b|premium/i.test(m));
  }

  // A read fault on the platform total must deny, exactly like the per-user one.
  meter.resetGlobalSpendCache();
  process.env.AI_DAILY_BUDGET_USD_GLOBAL = "1000";
  aggregateThrows = true;
  const beforeFault = messagesCreated;
  let globalFault: unknown = null;
  try {
    await meter.meteredMessage("response-analysis", null, REQUEST);
  } catch (e) {
    globalFault = e;
  }
  check("an unreadable platform total FAILS CLOSED", globalFault instanceof meter.AiSpendRefusal);
  check("no provider call was made", messagesCreated === beforeFault);
  aggregateThrows = false;
  meter.resetGlobalSpendCache();
  delete process.env.AI_DAILY_BUDGET_USD_GLOBAL;

  section("COVERAGE: every reachable metered call site must open a principal");
  // ── WHY THIS REPLACED AN ASSERTION ────────────────────────────────────────
  // This section used to read: "outside any principal an anonymous call is still
  // unbudgeted (documented residual)". That assertion PINNED THE HOLE OPEN. It
  // proved the mechanism works; it never proved the mechanism was APPLIED, and
  // S11 · B-1 found a consumer route reaching a `userId: null` meter call with no
  // principal — replayable at 20 calls/hour on a single letter, ≈$22/day/account
  // against a $1.00/day design. A guard that documents a gap is not a guard.
  //
  // ── METHOD ────────────────────────────────────────────────────────────────
  // Taint analysis at the level of EXPORTED SYMBOLS, not files, because
  // lib/brief.ts holds one metered export (summarizeArticle) beside a dozen
  // ordinary ones (ensureBriefTables, slugify, …) and a file-level rule would
  // accuse every Brief route in the product.
  //   1. split each source file into top-level export blocks;
  //   2. a block is TAINTED if it calls meteredMessage(..., null, ...) or calls a
  //      tainted imported symbol — UNLESS that same block opens withAiPrincipal(),
  //      which makes it a covered boundary and stops propagation;
  //   3. iterate to a fixpoint over parsed `import { … } from "…"` edges;
  //   4. any app route/page with a tainted export is a violation, unless it is on
  //      the justified exception list, and each exception verifies itself.
  const { readdirSync, statSync, readFileSync: readSrc } = await import("node:fs");
  const { join: joinPath, dirname, relative, resolve: resolvePath } = await import("node:path");
  const ROOT = joinPath(__dirname, "..", "..");

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
      const full = joinPath(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }
  const srcOf = new Map<string, string>();
  // Every predicate below runs against CODE, never prose. These files document
  // the defects they removed — lib/kai.ts:123 explains why
  // `meteredMessage("kai", null, …)` was wrong — so an un-stripped scan invents a
  // call site out of a comment. The soundness half matters more than the counting
  // half: a comment mentioning withAiPrincipal would otherwise mark a block
  // "covered" and silently suppress a real violation. `//` is only a comment when
  // it is not preceded by `:`, so URLs inside string literals survive.
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const f of [...walk(joinPath(ROOT, "app")), ...walk(joinPath(ROOT, "lib"))]) {
    srcOf.set(f, stripComments(readSrc(f, "utf8")));
  }
  const rel = (f: string) => relative(ROOT, f).split("\\").join("/");
  const meterFile = joinPath(ROOT, "lib", "aiMeter.ts");

  /** Top-level export blocks: from one column-0 `export` to the next (or EOF). */
  type Block = { name: string; text: string };
  const blocksCache = new Map<string, Block[]>();
  function blocksOf(file: string): Block[] {
    const cached = blocksCache.get(file);
    if (cached) return cached;
    const src = srcOf.get(file) ?? "";
    const starts: Array<{ name: string; at: number }> = [];
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_$]+)/gm)) {
      starts.push({ name: m[1], at: m.index ?? 0 });
    }
    const out: Block[] = [];
    for (let i = 0; i < starts.length; i++) {
      const from = starts[i].at;
      const to = i + 1 < starts.length ? starts[i + 1].at : src.length;
      out.push({ name: starts[i].name, text: src.slice(from, to) });
    }
    // Anything before the first export (module-level side effects) counts as one
    // pseudo-block, so a metered call outside any export is not invisible.
    if (starts.length === 0 || starts[0].at > 0) {
      out.unshift({ name: "<module>", text: src.slice(0, starts.length ? starts[0].at : src.length) });
    }
    blocksCache.set(file, out);
    return out;
  }

  function resolveSpecifier(fromFile: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = joinPath(ROOT, spec.slice(2));
    else if (spec.startsWith(".")) base = resolvePath(dirname(fromFile), spec);
    else return null;
    for (const c of [base + ".ts", base + ".tsx", joinPath(base, "index.ts"), joinPath(base, "index.tsx")]) {
      if (srcOf.has(c)) return c;
    }
    return null;
  }

  type Edge = { from: string; to: string; names: string[]; namespace: boolean };
  const edges: Edge[] = [];
  for (const [file, src] of srcOf) {
    for (const m of src.matchAll(/import\s+([^;]*?)\s+from\s+["']([^"']+)["']/g)) {
      const clause = m[1].trim();
      const target = resolveSpecifier(file, m[2]);
      if (!target) continue;
      if (/^\*\s+as\s+/.test(clause)) {
        edges.push({ from: file, to: target, names: [], namespace: true });
        continue;
      }
      const braces = clause.match(/\{([^}]*)\}/);
      const names = braces
        ? braces[1].split(",").map((n) => n.split(/\s+as\s+/)[0].trim()).filter(Boolean)
        : [];
      edges.push({ from: file, to: target, names, namespace: false });
    }
  }

  // 1. classify the meter call sites (analyzer sanity).
  const ANON_CALL = /meteredMessage\(\s*(?:"[^"]*"|`[^`]*`|[A-Za-z0-9_.]+)\s*,\s*null\s*,/;
  const anonymousSites: string[] = [];
  const attributedSites: string[] = [];
  for (const [file, src] of srcOf) {
    if (file === meterFile) continue;
    for (const m of src.matchAll(/meteredMessage\(\s*("[^"]*"|`[^`]*`|[A-Za-z0-9_.]+)\s*,\s*([^,]+?)\s*,/g)) {
      (m[2].trim() === "null" ? anonymousSites : attributedSites).push(`${rel(file)} (${m[1]})`);
    }
  }
  // Blindness checks, expressed so they cannot decay as coverage improves. The
  // ANONYMOUS manifest below carries the real weight: it is an exact set, so a
  // broken regex (everything drops to zero) fails it just as loudly as an
  // unreviewed new call site. These two only assert that both classes are
  // non-empty — "at least one attributed" can fail only if the product stops
  // attributing spend at all, which is itself a regression worth failing on.
  check(
    `the analyzer sees metered call sites at all (${attributedSites.length} attributed, ${anonymousSites.length} anonymous)`,
    attributedSites.length >= 1 && anonymousSites.length >= 1
  );
  check("the analyzer resolved a real import graph, not an empty one", edges.length > 50);

  // 2/3. fixpoint over tainted exports.
  const tainted = new Map<string, Map<string, string>>(); // file -> export -> reason
  function taint(file: string, name: string, why: string): boolean {
    let forFile = tainted.get(file);
    if (!forFile) tainted.set(file, (forFile = new Map()));
    if (forFile.has(name)) return false;
    forFile.set(name, why);
    return true;
  }
  for (const [file] of srcOf) {
    if (file === meterFile) continue;
    for (const b of blocksOf(file)) {
      if (ANON_CALL.test(b.text) && !/withAiPrincipal\(/.test(b.text)) {
        taint(file, b.name, "calls meteredMessage(..., null, ...) with no principal open");
      }
    }
  }
  // Everything the analyzer believes calls the meter WITHOUT a principal
  // argument, whether or not that block also opens one. Seeds (below) are the
  // uncovered subset of this; THIS set is what the manifest pins.
  const observedAnonymous = new Set<string>();
  for (const [file] of srcOf) {
    if (file === meterFile) continue;
    for (const b of blocksOf(file)) {
      if (ANON_CALL.test(b.text)) observedAnonymous.add(`${rel(file)}::${b.name}`);
    }
  }
  const seedKeys = new Set<string>();
  for (const [file, exports] of tainted) for (const name of exports.keys()) seedKeys.add(`${rel(file)}::${name}`);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      const targetTaint = tainted.get(edge.to);
      if (!targetTaint) continue;
      const imported = edge.namespace ? [...targetTaint.keys()] : edge.names.filter((n) => targetTaint.has(n));
      if (imported.length === 0) continue;
      for (const b of blocksOf(edge.from)) {
        if (/withAiPrincipal\(/.test(b.text)) continue; // covered boundary
        const called = imported.filter((n) => new RegExp(`\\b${n}\\s*\\(`).test(b.text));
        if (called.length === 0) continue;
        if (taint(edge.from, b.name, `${b.name} calls ${called.join(", ")} from ${rel(edge.to)}`)) changed = true;
      }
    }
  }
  // ── Non-emptiness, without a number that decays ──────────────────────────
  // This used to be `seedCount >= 4`, calibrated when four library exports still
  // reached the meter anonymously. That threshold got MORE likely to fail as
  // coverage got BETTER — S5 wrapping the response path and S8 giving askKai a
  // principal legitimately shrank the population below it — which is backwards
  // for a guard whose job is to notice the analyzer going blind.
  //
  // Replaced with an exact, reviewed manifest of the library exports that call
  // the meter with `null` as the principal argument. That set does not shrink
  // when a CALL SITE starts opening a principal (that is the coverage assertion's
  // job, further down); it changes only when a LIBRARY changes how it calls the
  // meter — a reviewed event, and exactly what a manifest should force someone to
  // look at. Set-equality fails in both directions: an unreviewed new anonymous
  // surface, and an analyzer that has gone silently empty.
  const ANONYMOUS_METER_MANIFEST: Array<{ key: string; why: string }> = [
    {
      key: "lib/aiParse.ts::aiExtractTradelines",
      why: "report parsing — a pure library helper with no request context; both consumer call sites (reports/upload, reports/analyze) open a principal around it",
    },
    {
      key: "lib/round2.ts::analyzeResponse",
      why: "bureau-response analysis — same shape; letters/[id]/response opens the principal (S11 · B-1)",
    },
    {
      key: "lib/brief.ts::summarizeArticle",
      why: "editorial Brief summarisation — reached only from admin/cron surfaces, which have no consumer principal to open (see EXCEPTIONS below)",
    },
  ];
  const manifestKeys = new Set(ANONYMOUS_METER_MANIFEST.map((m) => m.key));
  const unreviewed = [...observedAnonymous].filter((k) => !manifestKeys.has(k)).sort();
  const stale = [...manifestKeys].filter((k) => !observedAnonymous.has(k)).sort();
  if (unreviewed.length) console.error(`  UNREVIEWED anonymous meter surface(s): ${unreviewed.join(", ")}`);
  if (stale.length) console.error(`  MANIFEST entries no longer observed (analyzer blind, or the call site changed): ${stale.join(", ")}`);
  check("the anonymous-meter manifest is not itself empty", ANONYMOUS_METER_MANIFEST.length >= 1);
  check(
    `the analyzer observes exactly the reviewed anonymous-meter surfaces (${observedAnonymous.size} found)`,
    unreviewed.length === 0 && stale.length === 0
  );
  check(
    "every seed is one of those reviewed surfaces (seeds are their uncovered subset)",
    [...seedKeys].every((k) => manifestKeys.has(k))
  );

  // 4. violations.
  // Named exceptions: surfaces with NO consumer to attribute the spend to. Each
  // is verified below rather than trusted. This list must stay free of consumer
  // routes — that is the whole point of the section.
  const EXCEPTIONS: Array<{ file: string; why: string; mustMatch: RegExp }> = [
    { file: "app/api/admin/brief/summarize/route.ts", why: "admin-only editorial tool; operator spend", mustMatch: /requireAdmin\(/ },
    { file: "app/api/admin/brief/ingest/route.ts", why: "admin-only Brief ingestion; operator spend", mustMatch: /requireAdmin\(/ },
    { file: "app/api/admin/brief/[id]/resummarize/route.ts", why: "admin-only re-summarize; operator spend", mustMatch: /requireAdmin\(/ },
    { file: "app/api/cron/brief-ingest/route.ts", why: "platform cron behind CRON_SECRET; no consumer principal exists", mustMatch: /CRON_SECRET/ },
  ];
  const exceptionPaths = new Set(EXCEPTIONS.map((e) => e.file));
  for (const e of EXCEPTIONS) {
    const abs = joinPath(ROOT, e.file);
    check(`exception is operator-gated, not a consumer route: ${e.file}`,
      srcOf.has(abs) && e.mustMatch.test(srcOf.get(abs) ?? "") &&
      (e.file.startsWith("app/api/admin/") || e.file.startsWith("app/api/cron/")));
  }
  check("the exception list contains no consumer surface",
    EXCEPTIONS.every((e) => e.file.startsWith("app/api/admin/") || e.file.startsWith("app/api/cron/")));

  const reachingRoutes = [...tainted.keys()]
    .filter((f) => /\/app\/.*\/(route|page)\.tsx?$/.test(f.split("\\").join("/")))
    .map(rel)
    .sort();
  const violations = reachingRoutes.filter((f) => !exceptionPaths.has(f));

  check("a namespace import never hides a tainted edge from the analyzer",
    !edges.some((e) => e.namespace && tainted.has(e.to)));
  check("the covered surfaces really are recognised as covered (control)",
    !violations.includes("app/api/reports/upload/route.ts") &&
      !violations.includes("app/api/reports/analyze/route.ts"));

  if (violations.length > 0) {
    console.error("\n  UNBUDGETED METERED SURFACES — wrap the call in withAiPrincipal(user.id, () => ...):");
    for (const v of violations) {
      const reasons = [...(tainted.get(joinPath(ROOT, v))?.entries() ?? [])];
      for (const [name, why] of reasons) console.error(`    ${v} :: ${name} — ${why}`);
    }
    console.error("  (or, if the surface genuinely has no consumer principal, add a justified EXCEPTION above)\n");
  }
  check(
    `every route reaching an unattributed meter call opens a principal (${violations.length} violation(s))`,
    violations.length === 0
  );

  delete process.env.AI_DAILY_BUDGET_USD_PER_USER;
});
