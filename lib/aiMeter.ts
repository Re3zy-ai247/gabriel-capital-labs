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
 * Swap the provider client. REFUSED in production — a runtime-swappable model
 * provider would be an authorization-free way to redirect every prompt in the
 * product, so the seam exists only where it is a development/verification tool.
 * Pass null to restore the real client.
 */
export function setAiClientFactory(factory: AiClientFactory | null): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("aiMeter: the provider client cannot be replaced in production");
  }
  aiClientFactory = factory ?? defaultAiClientFactory;
}

function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Pre-call gate. Sums today's recorded estimate for this user and refuses when
 * it has reached the ceiling.
 *
 * FAILS CLOSED. `recordAiUsage` below fails OPEN on purpose — a metering write
 * must never break a call the consumer already paid for in latency — but a
 * budget we cannot read is a budget we cannot enforce, and the whole point of
 * this control is that a limiter fault must not silently remove the ceiling
 * (the exact defect this repo had in lib/rateLimit.ts). Every AI route needs the
 * same database for its own work, so a database fault denies the AI step rather
 * than the product.
 *
 * The check is a gate, not a meter: the call it admits is not itself bounded, so
 * a user can finish the day at most one call above the ceiling.
 */
async function assertWithinDailyBudget(userId: string): Promise<void> {
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
    throw new AiSpendRefusal(
      "budget-unavailable",
      "I couldn't check this account's usage for today, so I stopped before running the AI step rather than guess. Please try again in a moment."
    );
  }
  if (spentUsd >= budget) {
    throw new AiSpendRefusal(
      "budget-exhausted",
      "This account has reached its daily limit for AI analysis. It resets at midnight UTC. Everything already analyzed stays available, and the rest of CreditVector keeps working in the meantime."
    );
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
  if (principal) await assertWithinDailyBudget(principal);
  const model = String(request.model || process.env.LLM_MODEL || "claude-opus-4-8");
  const started = Date.now();
  try {
    const client = await aiClientFactory(aiClientOptions(key));
    const msg = (await client.messages.create(request)) as any;
    const u = (msg as any).usage || {};
    await recordAiUsage({
      surface,
      model: String((msg as any).model || model),
      userId: principal,
      usage: {
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      },
      ok: true,
      ms: Date.now() - started,
    });
    return msg;
  } catch (e) {
    await recordAiUsage({
      surface,
      model,
      userId: principal,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      ok: false,
      ms: Date.now() - started,
    });
    throw e;
  }
}
