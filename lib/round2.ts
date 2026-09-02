import { formatCents } from "./utils";
import type { LetterContext, LetterTradeline } from "./letter";
import { meteredMessage } from "./aiMeter";

export interface ResponseAnalysis {
  outcome: "verified" | "deleted" | "updated" | "no_response" | "unknown";
  summary: string;
  weaknesses: string[];
  recommendedNextStep: string;
}

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    outcome: {
      type: "string",
      enum: ["verified", "deleted", "updated", "no_response", "unknown"],
      description:
        "What the bureau/furnisher did: verified = claimed the item is accurate and kept it; deleted = removed it; updated = changed some data; no_response = a stall/non-substantive reply; unknown = can't tell.",
    },
    summary: { type: "string", description: "2-3 sentence plain-language summary of what the response says and did." },
    weaknesses: {
      type: "array",
      items: { type: "string" },
      description:
        "Specific, factual weaknesses or procedural failures in the response that a Round 2 escalation can target (e.g. no method of verification disclosed, parroted the furnisher, ignored a specific dispute, did not provide documentation). Empty if the item was deleted.",
    },
    recommendedNextStep: { type: "string", description: "One-line recommendation for the consumer's next move." },
  },
  required: ["outcome", "summary", "weaknesses", "recommendedNextStep"],
} as const;

// AI analysis of a bureau/furnisher response to a dispute. Returns a grounded
// assessment + the weaknesses a Round 2 letter should target. Falls back to a
// neutral result when no API key is configured.
export async function analyzeResponse(
  originalLetter: string,
  responseText: string
): Promise<ResponseAnalysis | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!responseText || responseText.trim().length < 15) return null;

  const system = [
    "You analyze a credit reporting agency's or furnisher's WRITTEN RESPONSE to a consumer's FCRA/FDCPA dispute.",
    "Determine precisely what they did and identify concrete weaknesses a lawful follow-up can target.",
    "RULES: State only what the response actually says — never invent. Do not promise outcomes. If the response merely says 'verified' without disclosing HOW, that is itself a weakness under FCRA §611(a)(7) (the consumer may request the method of verification). Be specific and factual.",
  ].join("\n");

  const user = [
    "----- CONSUMER'S ORIGINAL DISPUTE LETTER -----",
    originalLetter.slice(0, 12_000),
    "",
    "----- THE BUREAU/FURNISHER RESPONSE -----",
    responseText.slice(0, 40_000),
  ].join("\n");

  const msg = await meteredMessage("response-analysis", null, {
    model: process.env.LLM_PARSE_MODEL || "claude-sonnet-4-6",
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
  } as any);

  const block = (msg.content as any[]).find((c) => c.type === "text");
  if (!block) return null;
  try {
    return JSON.parse(block.text) as ResponseAnalysis;
  } catch {
    return null;
  }
}

// RC1-S4 (L-03) — REGULATORY-COMPLAINT INTENT IS THE CONSUMER'S TO DECLARE.
//
// This prompt used to instruct the model, unconditionally, to state "the
// consumer's intent to file complaints with the CFPB and state Attorney
// General". No consumer had ever said that. It was reached by a single click
// ("Draft Round {n} targeting these weaknesses →"), persisted immediately, and —
// with the letter body read-only — could not be removed before the consumer
// signed and mailed it.
//
// It is now an explicit opt-in that only the consumer can set. The flag rides on
// `LetterContext.complaintIntent`, which `buildContext` defaults to FALSE, so
// every existing call site is safe by construction: a caller that passes nothing
// gets a letter that asserts no intent.
//
// HANDOFF (precise — for whoever wires the UI, S5's letters page + the round-2
// route, neither of which this slice owns):
//   1. `app/letters/page.tsx` adds an unchecked-by-default checkbox on the
//      Round-2 panel, worded as the consumer's own declaration (e.g. "I intend
//      to file a complaint with the CFPB and my state Attorney General if this
//      is not corrected"), and POSTs `{ complaintIntent: boolean }` to
//      `/api/letters/[id]/round2`.
//   2. `app/api/letters/[id]/round2/route.ts` reads it as
//      `const complaintIntent = body?.complaintIntent === true;` (strict ===,
//      never truthy-coercion) and passes it through as the 7th argument of
//      buildContext: `buildContext("escalation", tradeline, consumer, bureau,
//      round, undefined, { complaintIntent, assertions })`.
//   3. That same options object is how the round-2 route restores the consumer's
//      SUMMARY OF FACTUAL CONCERNS: pass the tradeline's ACTIVE ConsumerAssertion
//      rows as `assertions`. Until it does, a Round-2 letter renders WITHOUT that
//      section — honest (it asserts nothing the consumer did not confirm) but
//      less specific than it should be.
// Nothing else needs to change: this function and renderTemplateLetter both read
// the flag off the context.
export function buildRound2UserPrompt(
  t: LetterTradeline,
  ctx: LetterContext,
  draft: string,
  responseText: string,
  analysis: ResponseAnalysis | null
): string {
  return [
    "TASK: This is a ROUND 2 ESCALATION. The consumer already disputed this item and received the response quoted below. Refine the grounded escalation draft into a firm, professional follow-up that:",
    "  • References that a prior dispute was submitted and a response was received;",
    "  • Demands the METHOD OF VERIFICATION under FCRA §611(a)(7) (15 U.S.C. §1681i(a)(7)) — the name, address, and telephone number of any furnisher contacted, and a description of the procedure used to verify;",
    "  • Challenges the adequacy of the reinvestigation in plain language where the response was non-substantive (a reasonable reinvestigation may require more than re-confirming with the same furnisher — Cushman; may require account-level documentation — Hinkle);",
    ctx.complaintIntent
      ? "  • States the consumer's intent to file complaints with the CFPB and state Attorney General if the item is not corrected or deleted — the consumer has expressly opted in to this statement."
      : "  • Does NOT state, imply, or hint at any intention to file a complaint with the CFPB, a state Attorney General, or any other regulator. The consumer has NOT said they intend to do that, and you may not say it for them. Reserving a right the FCRA already gives the consumer is acceptable; declaring a plan of action is not.",
    ctx.assertions.length
      ? "Preserve every factual claim exactly: each one was confirmed by the consumer personally. Add NO new facts about the account and introduce NO new first-person statement about the consumer's records, recollection or intentions."
      : "The consumer has confirmed NO factual claims about this account. Assert none: escalate on the inadequacy of the response itself, and introduce no first-person statement about the consumer's records, recollection or intentions.",
    "Preserve every statute quote exactly. Keep the STATUTORY AUTHORITY quotes verbatim. No guarantees of outcome.",
    "",
    `Account: ${t.creditorName}${t.originalCreditor ? ` (original creditor: ${t.originalCreditor})` : ""}, balance ${formatCents(t.balance)}`,
    `Target recipient: ${ctx.recipientName}`,
    analysis
      ? `Prior-response assessment — outcome: ${analysis.outcome}; weaknesses to target: ${analysis.weaknesses.join("; ") || "(none identified)"}`
      : "Prior-response assessment: (not analyzed)",
    "",
    "----- THE BUREAU/FURNISHER RESPONSE RECEIVED -----",
    responseText.slice(0, 12_000),
    "",
    "----- GROUNDED ESCALATION DRAFT -----",
    draft,
  ].join("\n");
}
