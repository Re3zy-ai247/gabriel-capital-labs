// BI-COST-01 — AI metering (ADR-0006 §6). Every Anthropic call in the codebase
// goes through meteredMessage() so cost per surface is measured, not estimated.
// This is also the clean provider seam (ADR-0009): a future router/provider swap
// changes this file only, never the call sites.
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
  const model = String(request.model || process.env.LLM_MODEL || "claude-opus-4-8");
  const started = Date.now();
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create(request as any);
    const u = (msg as any).usage || {};
    await recordAiUsage({
      surface,
      model: String((msg as any).model || model),
      userId,
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
      userId,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      ok: false,
      ms: Date.now() - started,
    });
    throw e;
  }
}
