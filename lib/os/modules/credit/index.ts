// Kai Credit — Plugin #1 (Sprint 2). CreditVector's existing engines, WRAPPED behind the
// KaiModule contract — never rewritten. The dispute engine's valuable IP is untouched; the
// module just registers `credit.*` capabilities whose execute() delegates to the existing
// pure engines (`lib/letter` etc.). This is the reference implementation that validates the
// Kai Kernel. Zero behavior change: the output is byte-identical to calling the engine directly.
import { buildContext, renderTemplateLetter, type LetterTradeline, type LetterConsumer, type RecipientOverride } from "@/lib/letter";
import { analyzeResponse } from "@/lib/round2";
import type { Bureau } from "@prisma/client";
import type { CapabilityKey, CapabilitySpec, KaiModule, ModuleResult, OsContext } from "@/lib/os/kernel";

// The input the host loads and hands to the capability (the module stays pure — no DB reads).
export interface DraftLetterInput {
  strategyId: string;
  tradeline: LetterTradeline;
  consumer: LetterConsumer;
  targetBureau?: Bureau;
  round?: number;
  recipient?: RecipientOverride;
}
function isDraftInput(x: unknown): x is DraftLetterInput {
  return !!x && typeof x === "object" && typeof (x as DraftLetterInput).strategyId === "string" && !!(x as DraftLetterInput).tradeline && !!(x as DraftLetterInput).consumer;
}

const DRAFT = "credit.letter.draft" as CapabilityKey;
const ANALYZE = "credit.response.analyze" as CapabilityKey;

// Input for credit.response.analyze (migration #6 — Response Intelligence, AI-backed/async).
export interface AnalyzeResponseInput { originalLetter: string; responseText: string }
function isAnalyzeInput(x: unknown): x is AnalyzeResponseInput {
  return !!x && typeof x === "object" && typeof (x as AnalyzeResponseInput).originalLetter === "string" && typeof (x as AnalyzeResponseInput).responseText === "string";
}

const bad = (summary: string): ModuleResult => ({ ok: false, receipt: { summary, evidence: [] }, confidence: { level: "insufficient", basis: "guard" } });

export function creditModule(): KaiModule {
  return {
    id: "credit",
    name: "Kai Credit",
    trust: "first_party",
    capabilities: (): CapabilitySpec[] => [
      { key: DRAFT, requiredPermissions: ["letters:generate"], compliance: { regimes: ["FCRA"], permissiblePurposes: ["dispute", "goodwill", "validation", "escalation", "obsolescence"] }, reasoning: "deterministic" },
      { key: ANALYZE, requiredPermissions: ["responses:analyze"], compliance: { regimes: ["FCRA", "FDCPA"], permissiblePurposes: ["dispute", "response_analysis", "escalation"] }, reasoning: "generative" },
    ],
    async execute(_ctx: OsContext, key: CapabilityKey, input: unknown): Promise<ModuleResult> {
      // credit.letter.draft — deterministic, sync. WRAPS lib/letter unchanged (byte-identical).
      if (key === DRAFT) {
        if (!isDraftInput(input)) return bad("invalid input for credit.letter.draft");
        const ctx = buildContext(input.strategyId, input.tradeline, input.consumer, input.targetBureau, input.round ?? 1, input.recipient);
        const letter = renderTemplateLetter(input.tradeline, ctx, input.consumer);
        return {
          ok: true,
          data: { letter, strategyId: ctx.strategy.id, recipient: ctx.recipientName, round: ctx.round },
          receipt: { summary: `Drafted a ${ctx.strategy.label} letter to ${ctx.recipientName}`, evidence: [`strategy: ${ctx.strategy.id}`, `round: ${ctx.round}`, `recipient type: ${ctx.strategy.recipient}`] },
          confidence: { level: "high", basis: "deterministic FCRA-grounded template (lib/letter)" },
        };
      }
      // credit.response.analyze — AI-backed, async. WRAPS lib/round2.analyzeResponse unchanged.
      if (key === ANALYZE) {
        if (!isAnalyzeInput(input)) return bad("invalid input for credit.response.analyze");
        const analysis = await analyzeResponse(input.originalLetter, input.responseText);
        if (!analysis) return { ok: false, receipt: { summary: "No analysis available (AI not configured or response too short).", evidence: [] }, confidence: { level: "insufficient", basis: "lib/round2 returned null" } };
        return {
          ok: true,
          data: analysis,
          receipt: { summary: analysis.summary, evidence: analysis.weaknesses },
          confidence: { level: analysis.outcome === "unknown" ? "low" : "moderate", basis: `response outcome: ${analysis.outcome}` },
        };
      }
      return bad(`unknown capability ${key}`);
    },
  };
}
