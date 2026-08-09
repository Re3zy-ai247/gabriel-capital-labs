import type { Bureau } from "@prisma/client";
import { buildParserV2ShadowAccount } from "./parserV2";
import type { CreditTruthShadowAccount, ParserV2AccountInput } from "./types";

/**
 * Structured output consumed by the AI-v2 shadow adapter. Every account value
 * is nested under the bureau that supplied it. There is intentionally no
 * account-level status/balance/date fallback and no reported-bureaus fan-out.
 */
export interface AiParserV2ShadowOutput {
  parserVersion: string;
  accounts: ParserV2AccountInput[];
}

/**
 * Rules for the future provider-side structured-output prompt. This string is
 * dormant in Phase 1; exporting it keeps the shadow contract reviewable without
 * changing the production PARSE-SYS call.
 */
export const AI_PARSER_V2_SHADOW_RULES = [
  "Return facts only under the bureau and report section where each fact appears.",
  "Never copy, merge, or infer one bureau's value into another bureau.",
  "Use PRESENT only for an explicit source observation with a source locator.",
  "Use ABSENT_CONFIRMED only when a complete covered source explicitly establishes absence.",
  "Use UNKNOWN when a section is missing, partial, failed, outside coverage, or silent.",
  "Keep summary status and detailed status as separate observations.",
  "Preserve payment history, collection facts, charge-off, loss, transfer/sale, dispute remarks, and relevant dates.",
  "A creditor-name or entity heuristic is not a source observation and must not populate productType.",
] as const;

export function adaptAiParserV2ShadowOutput(
  output: AiParserV2ShadowOutput,
  coveredBureaus: Bureau[]
): CreditTruthShadowAccount[] {
  return output.accounts.map((account) =>
    buildParserV2ShadowAccount(account, {
      parser: "AI_V2",
      parserVersion: output.parserVersion,
      coveredBureaus,
    })
  );
}
