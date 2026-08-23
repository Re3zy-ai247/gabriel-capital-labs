// BI-COST-01 — AI metering (ADR-0006 §6). Every Anthropic call in the codebase
// goes through meteredMessage() so cost per surface is measured, not estimated.
// This is also the clean provider seam (ADR-0009): a future router/provider swap
// changes this file only, never the call sites.
//
// P0-10 (E-07) — SPEND CONTROL. Metering alone measures after the fact and fails
// open. Under a free consumer model there is no economic friction in front of
// provider spend, so this file now also carries the three controls that were
// missing:
//   1. an explicit client `timeout` and `maxRetries: 1`. The SDK defaults are a
//      10-minute timeout with automatic retries — longer than every route's
//      `maxDuration`, so retries kept spending after the function had already
//      been killed and the consumer had already seen an error;
//   2. a per-user DAILY budget, checked before the call and FAILING CLOSED;
//   3. an ambient AI principal, so surfaces that call the meter with
//      `userId: null` (lib/aiParse.ts:137 report parsing, lib/kai.ts:127,
//      lib/round2.ts:59 — the highest-volume paths) are still attributed to,
//      and budgeted against, the consumer whose request they are serving.
import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/prisma";

// List prices, USD per 1M tokens (Anthropic, checked 2026-07-12). ESTIMATE for
// dashboards — billing truth is the provider console. Matched by id substring.
const PRICES: Array<{ match: string; inPerM: number; outPerM: number }> = [
  { match: "opus", inPerM: 5, outPerM: 25 },
  { match: "sonnet", inPerM: 3, outPerM: 15 },
  { match: "haiku", inPerM: 1, outPerM: 5 },
];

function estimateCostUsd(model: string, usage: AiUsageTokens): number {
  const p = PRICES.find((x) => model.includes(x.match)) ?? PRICES[0];
  const inputCost =
    (usage.inputTokens / 1e6) * p.inPerM +
    (usage.cacheWriteTokens / 1e6) * p.inPerM * 1.25 +
    (usage.cacheReadTokens / 1e6) * p.inPerM * 0.1;
  const outputCost = (usage.outputTokens / 1e6) * p.outPerM;
  return inputCost + outputCost;
}

type AiUsageTokens = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

// Self-heal table (same pattern as ensureCommunityTables / the billing dedup
// ledger): runtime CREATE TABLE works through Accelerate where db push doesn't.
let aiUsageReady = false;
async function ensureAiUsageTable(): Promise<void> {
  if (aiUsageReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "AiUsage" (
      "id" TEXT PRIMARY KEY,
      "surface" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "userId" TEXT,
      "inputTokens" INTEGER NOT NULL DEFAULT 0,
      "outputTokens" INTEGER NOT NULL DEFAULT 0,
      "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
      "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
      "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "ok" BOOLEAN NOT NULL DEFAULT true,
      "ms" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AiUsage_surface_createdAt_idx" ON "AiUsage" ("surface", "createdAt")`
  );
  aiUsageReady = true;
}

// Recording must never break the product path — metering fails open.
async function recordAiUsage(row: {
  surface: string;
  model: string;
  userId: string | null;
  usage: AiUsageTokens;
  ok: boolean;
  ms: number;
}): Promise<void> {
  try {
    await ensureAiUsageTable();
    await prisma.aiUsage.create({
      data: {
        surface: row.surface,
        model: row.model,
        userId: row.userId,
        inputTokens: row.usage.inputTokens,
        outputTokens: row.usage.outputTokens,
        cacheReadTokens: row.usage.cacheReadTokens,
        cacheWriteTokens: row.usage.cacheWriteTokens,
        costUsd: estimateCostUsd(row.model, row.usage),
        ok: row.ok,
        ms: row.ms,
      },
    });
  } catch (e) {
    console.error("aiMeter: usage recording failed (fail-open):", e);
  }
}

// ── Ambient AI principal ─────────────────────────────────────────────────────
// The meter's `userId` argument is null on the highest-volume surfaces (report
// parsing, Kai, response analysis) because those helpers were written as pure
// library functions. Rather than edit every one of them, a route that knows who
// it is serving opens a scope: everything the request goes on to do inside that
// scope is attributed to — and budgeted against — that consumer.
const aiPrincipal = new AsyncLocalStorage<{ userId: string }>();

/** Run `fn` with every nested meter call attributed to `userId`. */
export function withAiPrincipal<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return aiPrincipal.run({ userId }, fn);
}

/** The consumer the current async context is serving, if a route declared one. */
export function currentAiPrincipal(): string | null {
  return aiPrincipal.getStore()?.userId ?? null;
}

// ── Spend controls ───────────────────────────────────────────────────────────

/**
 * Per-request wall-clock budget handed to the provider SDK. Default 45 s, kept
 * under the repo-wide `maxDuration = 60` so a single attempt cannot outlive the
 * function that is waiting for it. `maxRetries: 1` means a retried CONNECTION
 * failure can still add time; retries fire on transport/429/5xx, which fail
 * fast, so the practical worst case stays inside the function budget while the
 * pathological case (a 45 s hang, then a retry) is bounded by `maxDuration`
 * killing the function — never by a 10-minute SDK default that outlives it.
 */
export function aiRequestTimeoutMs(): number {
  const raw = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "", 10);
  if (!Number.isFinite(raw) || raw < 1000) return 45_000;
  return Math.min(raw, 60_000);
}

/**
 * Per-user DAILY spend ceiling in USD, measured against the same estimate the
 * dashboards use (`estimateCostUsd` — list prices, not billing truth). Default
 * $1.00: roughly four full report parses plus a working day of Kai turns, which
 * is far above real consumer use and far below what an automated account can
 * burn. There is deliberately no "unlimited" value — a non-positive or
 * unparseable setting falls back to the default. `AI_DAILY_BUDGET_USD_PER_USER`.
 */
export function aiDailyBudgetUsd(): number {
  const raw = Number.parseFloat(process.env.AI_DAILY_BUDGET_USD_PER_USER || "");
  if (!Number.isFinite(raw) || raw <= 0) return 1.0;
  return raw;
}

/**
 * Refusal raised instead of spending. `consumerMessage` is safe to show a
 * consumer verbatim: it states what happened and when it clears, promises
 * nothing about credit, and offers no payment path (the consumer product is
 * free — this is an abuse/cost control, not a paywall).
 */
export class AiSpendRefusal extends Error {
  readonly consumerMessage: string;
  readonly kind: "budget-exhausted" | "budget-unavailable";
  constructor(kind: "budget-exhausted" | "budget-unavailable", consumerMessage: string) {
    super(`aiMeter: ${kind}`);
    this.name = "AiSpendRefusal";
    this.kind = kind;
    this.consumerMessage = consumerMessage;
  }
}

// ── Provider seam ────────────────────────────────────────────────────────────
// ADR-0009 already names this file as the provider seam; this makes the seam an
// explicit, typed boundary instead of an inline dynamic import. Two consequences
// that matter: the client options are constructible and inspectable without a
// network call, and the offline guards can substitute a double rather than the
// suite reaching api.anthropic.com.
export type AiClientOptions = { apiKey: string; timeout: number; maxRetries: number };
export type AiClient = { messages: { create: (request: unknown) => Promise<unknown> } };
export type AiClientFactory = (opts: AiClientOptions) => Promise<AiClient> | AiClient;

/** Exactly what the provider client is constructed with. */
export function aiClientOptions(apiKey: string): AiClientOptions {
  return { apiKey, timeout: aiRequestTimeoutMs(), maxRetries: 1 };
}

const defaultAiClientFactory: AiClientFactory = async (opts) => {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic(opts) as unknown as AiClient;
};
let aiClientFactory: AiClientFactory = defaultAiClientFactory;

/**
 * Swap the provider client. Allowed ONLY in development and test — a
 * runtime-swappable model provider would be an authorization-free way to
 * redirect every prompt in the product. Written as a POSITIVE allowance, not
 * `=== "production"`: that is the fail-open shape E-11 condemned, and it would
 * leave the seam open on any runtime where NODE_ENV is unset, "staging",
 * "preview", or misspelled. Pass null to restore the real client.
 */
export function setAiClientFactory(factory: AiClientFactory | null): void {
  const env = process.env.NODE_ENV;
  if (env !== "development" && env !== "test") {
    throw new Error("aiMeter: the provider client can only be replaced in development or test");
  }
  aiClientFactory = factory ?? defaultAiClientFactory;
}

function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Conservative pre-call cost estimate, used as the RESERVATION amount. Input is
 * measured from the prompt actually being sent (~4 chars/token); output is
 * assumed to be the full `max_tokens` the caller asked for. Both err high on
 * purpose: a reservation that overstates is corrected downward the moment the
 * real usage comes back, whereas one that understates re-opens the hole.
 */
export function estimateRequestCostUsd(model: string, request: Record<string, unknown>): number {
  const system = typeof request.system === "string" ? request.system : JSON.stringify(request.system ?? "");
  const messages = JSON.stringify(request.messages ?? []);
  const inputTokens = Math.ceil((system.length + messages.length) / 4);
  const rawMax = Number(request.max_tokens);
  const outputTokens = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 1024;
  return estimateCostUsd(model, { inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 });
}

const BUDGET_EXHAUSTED_MESSAGE =
  "This account has reached its daily limit for AI analysis. It resets at midnight UTC. Everything already analyzed stays available, and the rest of CreditVector keeps working in the meantime.";
const BUDGET_UNAVAILABLE_MESSAGE =
  "I couldn't check this account's usage for today, so I stopped before running the AI step rather than guess. Please try again in a moment.";

/**
 * RESERVE-THEN-SPEND (M-2). Admits or refuses one call, and — when it admits —
 * writes the reservation that makes the next decision see this call's cost.
 *
 * The first version of this control read `SUM(costUsd)` before the call and
 * wrote the row after it, and claimed "at most one call above the ceiling". That
 * is true only SERIALLY. Measured concurrently, 20 requests fired together all
 * read `spent = 0` and all spent: 9.6x the ceiling, because the real bound was
 * the surface's rate limit (20 uploads/hr, 10 analyses/hr x 5 fan-out), not the
 * budget. The reservation closes that: the row is written INSIDE the same
 * transaction that reads the sum, and `SELECT ... FOR UPDATE` on the owning User
 * row serializes concurrent decisions for one consumer — the same lock the
 * password-reset revocation path uses (lib/passwordReset.ts). Concurrent callers
 * queue behind it and each sees the previous reservation.
 *
 * ADMISSION RULE: refuse when `spent + estimate > budget`, EXCEPT for the first
 * call of the day, which always runs. Without that exception a single request
 * whose estimate exceeds the whole daily budget could never run at all. So the
 * true bound is: **daily spend never exceeds the ceiling, unless one single call
 * alone exceeds it, in which case it is exceeded by exactly that one call.**
 *
 * FAILS CLOSED. `settleReservation`/`recordAiUsage` fail OPEN on purpose — a
 * metering write must never break a call already made — but a budget we cannot
 * read or reserve against is a budget we cannot enforce, and the whole point of
 * this control is that a backend fault must not silently remove the ceiling (the
 * exact defect this repo had in lib/rateLimit.ts). Every AI route needs the same
 * database for its own work, so a fault denies the AI step, not the product.
 *
 * Returns the reservation row id, to be settled with real usage after the call.
 */
async function reserveDailyBudget(
  userId: string,
  surface: string,
  model: string,
  estimateUsd: number,
): Promise<string> {
  const budget = aiDailyBudgetUsd();
  try {
    await ensureAiUsageTable();
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
      `;
      if (locked.length !== 1 || locked[0]?.id !== userId) {
        // No row to bill against. Fail closed rather than spend for a principal
        // that no longer exists.
        throw new AiSpendRefusal("budget-unavailable", BUDGET_UNAVAILABLE_MESSAGE);
      }
      const agg = await tx.aiUsage.aggregate({
        _sum: { costUsd: true },
        where: { userId, createdAt: { gte: startOfUtcDay() } },
      });
      const spentUsd = agg._sum.costUsd ?? 0;
      if (spentUsd > 0 && spentUsd + estimateUsd > budget) {
        throw new AiSpendRefusal("budget-exhausted", BUDGET_EXHAUSTED_MESSAGE);
      }
      const reservation = await tx.aiUsage.create({
        data: { surface, model, userId, costUsd: estimateUsd, ok: true, ms: 0 },
      });
      return reservation.id;
    });
  } catch (e) {
    if (e instanceof AiSpendRefusal) throw e;
    console.error("aiMeter: daily budget could not be reserved (failing closed):", e);
    throw new AiSpendRefusal("budget-unavailable", BUDGET_UNAVAILABLE_MESSAGE);
  }
}

/**
 * READ-ONLY budget probe (L-3). Throws the same AiSpendRefusal the reservation
 * would, without reserving anything.
 *
 * It exists because the refusal was previously unreachable by any consumer:
 * lib/analyze.ts catches every exception from the extractor and falls back to
 * the deterministic parser, so a budget-exhausted consumer saw quality quietly
 * drop with no explanation. A route that is ABOUT to fan out model calls can ask
 * first and say so.
 *
 * Advisory, not authoritative: being read-only it is inherently racy, and the
 * bound that actually holds is the reservation inside reserveDailyBudget.
 */
export async function assertAiBudgetAvailable(userId: string): Promise<void> {
  const budget = aiDailyBudgetUsd();
  let spentUsd: number;
  try {
    await ensureAiUsageTable();
    const agg = await prisma.aiUsage.aggregate({
      _sum: { costUsd: true },
      where: { userId, createdAt: { gte: startOfUtcDay() } },
    });
    spentUsd = agg._sum.costUsd ?? 0;
  } catch (e) {
    console.error("aiMeter: daily budget unreadable (failing closed):", e);
    throw new AiSpendRefusal("budget-unavailable", BUDGET_UNAVAILABLE_MESSAGE);
  }
  if (spentUsd >= budget) {
    throw new AiSpendRefusal("budget-exhausted", BUDGET_EXHAUSTED_MESSAGE);
  }
}

/**
 * Replace a reservation's estimate with what the call really cost. Fails OPEN:
 * the money is already spent, and a settlement failure must not turn a completed
 * call into an error. An unsettled reservation simply leaves the conservative
 * estimate standing, which is the safe direction for a ceiling.
 *
 * On the FAILURE path the reservation's cost is deliberately NOT zeroed (L-4): a
 * request that timed out at 45 s may still have been billed by the provider for
 * its input tokens, so the estimate stays on the ledger rather than recording $0
 * for work that may well have cost money.
 */
async function settleReservation(
  reservationId: string,
  outcome: { model: string; usage: AiUsageTokens; ok: boolean; ms: number },
): Promise<void> {
  try {
    await prisma.aiUsage.update({
      where: { id: reservationId },
      data: outcome.ok
        ? {
            model: outcome.model,
            inputTokens: outcome.usage.inputTokens,
            outputTokens: outcome.usage.outputTokens,
            cacheReadTokens: outcome.usage.cacheReadTokens,
            cacheWriteTokens: outcome.usage.cacheWriteTokens,
            costUsd: estimateCostUsd(outcome.model, outcome.usage),
            ok: true,
            ms: outcome.ms,
          }
        : { ok: false, ms: outcome.ms },
    });
  } catch (e) {
    console.error("aiMeter: reservation settlement failed (fail-open):", e);
  }
}

/**
 * The one sanctioned way to call the model. Drop-in for the previous
 * `new Anthropic({apiKey}) → client.messages.create(request)` blocks: same
 * request object, same return shape. Callers keep their own missing-key guards
 * and error handling; the meter records success AND failure rows.
 */
export async function meteredMessage(
  surface: string,
  userId: string | null,
  request: Record<string, unknown>
): Promise<any> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  // An explicit argument wins; otherwise inherit the route's declared principal.
  const principal = userId ?? currentAiPrincipal();
  const model = String(request.model || process.env.LLM_MODEL || "claude-opus-4-8");
  // Reserve BEFORE spending, inside a per-user lock, so concurrent requests
  // cannot all read the same pre-call sum. Anonymous surfaces (no principal and
  // no ambient scope) keep the post-hoc, fail-open metering they always had.
  const reservationId = principal
    ? await reserveDailyBudget(principal, surface, model, estimateRequestCostUsd(model, request))
    : null;
  const started = Date.now();
  try {
    const client = await aiClientFactory(aiClientOptions(key));
    const msg = (await client.messages.create(request)) as any;
    const u = (msg as any).usage || {};
    const usage: AiUsageTokens = {
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    };
    const settledModel = String((msg as any).model || model);
    if (reservationId) {
      await settleReservation(reservationId, { model: settledModel, usage, ok: true, ms: Date.now() - started });
    } else {
      await recordAiUsage({ surface, model: settledModel, userId: principal, usage, ok: true, ms: Date.now() - started });
    }
    return msg;
  } catch (e) {
    const zero: AiUsageTokens = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    if (reservationId) {
      await settleReservation(reservationId, { model, usage: zero, ok: false, ms: Date.now() - started });
    } else {
      await recordAiUsage({ surface, model, userId: principal, usage: zero, ok: false, ms: Date.now() - started });
    }
    throw e;
  }
}
