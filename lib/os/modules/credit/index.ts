// Kai Credit — Plugin #1 (Sprint 2). CreditVector's existing engines, WRAPPED behind the
// KaiModule contract — never rewritten. The dispute engine's valuable IP is untouched; the
// module just registers `credit.*` capabilities whose execute() delegates to the existing
// pure engines (`lib/letter` etc.). This is the reference implementation that validates the
// Kai Kernel. Zero behavior change: the output is byte-identical to calling the engine directly.
import { buildContext, renderTemplateLetter, type LetterTradeline, type LetterConsumer, type RecipientOverride } from "@/lib/letter";
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

export function creditModule(): KaiModule {
  return {
    id: "credit",
    name: "Kai Credit",
    trust: "first_party",
    capabilities: (): CapabilitySpec[] => [
      {
        key: DRAFT,
        requiredPermissions: ["letters:generate"],
        compliance: { regimes: ["FCRA"], permissiblePurposes: ["dispute", "goodwill", "validation", "escalation", "obsolescence"] },
        reasoning: "deterministic",
      },
    ],
    execute: (_ctx: OsContext, key: CapabilityKey, input: unknown): ModuleResult => {
      if (key !== DRAFT) return { ok: false, receipt: { summary: `unknown capability ${key}`, evidence: [] }, confidence: { level: "insufficient", basis: "unrecognized key" } };
      if (!isDraftInput(input)) return { ok: false, receipt: { summary: "invalid input for credit.letter.draft", evidence: [] }, confidence: { level: "insufficient", basis: "input guard" } };

      // WRAP — delegate to the existing, unchanged engine. Identical output guaranteed.
      const ctx = buildContext(input.strategyId, input.tradeline, input.consumer, input.targetBureau, input.round ?? 1, input.recipient);
      const letter = renderTemplateLetter(input.tradeline, ctx, input.consumer);

      return {
        ok: true,
        data: { letter, strategyId: ctx.strategy.id, recipient: ctx.recipientName, round: ctx.round },
        receipt: {
          summary: `Drafted a ${ctx.strategy.label} letter to ${ctx.recipientName}`,
          evidence: [`strategy: ${ctx.strategy.id}`, `round: ${ctx.round}`, `recipient type: ${ctx.strategy.recipient}`],
        },
        confidence: { level: "high", basis: "deterministic FCRA-grounded template (lib/letter)" },
      };
    },
  };
}
