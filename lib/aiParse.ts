import type { Bureau } from "@prisma/client";
import type { ExtractedTradeline } from "./parse";

// AI-powered credit-report extraction. Turns the raw text of ANY bureau report
// (single-bureau or tri-merge, AnnualCreditReport.com, Credit Karma export, a
// pasted PDF, etc.) into structured tradelines. Grounded hard against
// hallucination: it extracts only what is explicitly present and honestly
// records which covered bureau(s) report each account — preserving the app's
// core accuracy guarantee. Returns null when no API key is configured so the
// caller can fall back to the deterministic regex parser.

const ALL_BUREAUS: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

interface AIAccount {
  creditorName: string;
  originalCreditor: string;
  accountNumberMask: string;
  accountTypeHint: string;
  balanceCents: number;
  status: string;
  dofd: string;
  dateReported: string;
  reportedByBureaus: string[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    accounts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          creditorName: { type: "string", description: "The creditor or collection agency name as printed." },
          originalCreditor: { type: "string", description: "Original creditor if this is a collection; else empty string." },
          accountNumberMask: { type: "string", description: "Masked account number as printed; else empty string." },
          accountTypeHint: {
            type: "string",
            description:
              "One of: revolving, installment, mortgage, collection, charge-off, student loan, public record, government, inquiry, other. Empty string if unclear.",
          },
          balanceCents: { type: "integer", description: "Balance in integer cents. 0 if not stated." },
          status: { type: "string", description: "Account status as printed (e.g. 'Open', 'Charge-off', 'Collection'); else empty string." },
          dofd: { type: "string", description: "Date of first delinquency, ISO yyyy-mm-dd if derivable; else empty string." },
          dateReported: { type: "string", description: "Date last reported, ISO if derivable; else empty string." },
          reportedByBureaus: {
            type: "array",
            description:
              "Which of the COVERED bureaus report this account. MUST be a subset of the covered bureaus. Never include a bureau whose report was not provided.",
            items: { type: "string", enum: ALL_BUREAUS },
          },
        },
        required: [
          "creditorName",
          "originalCreditor",
          "accountNumberMask",
          "accountTypeHint",
          "balanceCents",
          "status",
          "dofd",
          "dateReported",
          "reportedByBureaus",
        ],
      },
    },
  },
  required: ["accounts"],
} as const;

function systemPrompt(covered: Bureau[]): string {
  return [
    "You are a meticulous credit-report data extractor. You convert the raw text of a consumer credit report into structured account records.",
    "",
    "ABSOLUTE RULES:",
    "1. Extract ONLY information explicitly present in the text. Never infer, estimate, or invent a balance, date, status, or account number. If a value is not stated, return an empty string (or 0 for balanceCents).",
    "2. The covered bureaus for THIS report are: " + covered.join(", ") + ". For each account, reportedByBureaus must be a subset of these — it lists which covered bureaus actually show the account. For a single-bureau report, every account is reported by that one bureau. NEVER list a bureau that was not provided.",
    "3. Extract every distinct account/tradeline, including collections, charge-offs, and duplicates (report duplicates separately — do not merge them).",
    "4. balanceCents is integer cents: $1,477 -> 147700; $0 or unknown -> 0. The balance is the dollar amount labeled as the balance — NEVER use a list/section number (e.g. '2.6', '11.') as a balance.",
    "5. creditorName must be the clean creditor/collector name ONLY. Strip any leading list/section/outline number (e.g. '2.6 Mdg Us Inc' -> 'Mdg Us Inc', '11. Collections' is a header, not an account) and any trailing status parenthetical like '(CLOSED)' — put open/closed in the status field instead.",
    "6. NEVER output a record for non-account content. Exclude: educational/explanatory blurbs (e.g. 'Collections are accounts with outstanding debt...'), debt-to-credit ratio descriptions, payment-history tables or headers, 'Comments'/'Contact'/'Remarks' labels, bureau-name strings (e.g. 'EquifaxExperianTransUnion'), bare section headers (e.g. 'Collections', 'Public Records'), score summaries, soft inquiries, and personal-information sections. If a line reads like a sentence or a heading rather than a creditor name, it is NOT an account.",
    "7. Return strictly the structured JSON. No commentary.",
  ].join("\n");
}

export async function aiExtractTradelines(
  rawText: string,
  coveredBureaus: Bureau[]
): Promise<ExtractedTradeline[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!rawText || rawText.trim().length < 20) return null;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });

  const msg = await client.messages.create({
    // Extraction is mechanical — use a faster model by default for speed.
    model: process.env.LLM_PARSE_MODEL || "claude-sonnet-4-6",
    max_tokens: 8000,
    system: systemPrompt(coveredBureaus),
    messages: [
      {
        role: "user",
        content:
          "Extract all accounts from this credit report text. Covered bureaus: " +
          coveredBureaus.join(", ") +
          ".\n\n----- REPORT TEXT -----\n" +
          rawText.slice(0, 120_000),
      },
    ],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  } as any);

  const textBlock = (msg.content as any[]).find((c) => c.type === "text");
  if (!textBlock || !("text" in textBlock)) return null;

  let parsed: { accounts?: AIAccount[] };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return null;
  }
  const accounts = parsed.accounts ?? [];

  return accounts
    .filter((a) => a.creditorName && a.creditorName.trim().length >= 2)
    .map((a) => {
      // Honor the accuracy guarantee: only keep bureaus that were actually covered.
      const reported = (a.reportedByBureaus || []).filter((b): b is Bureau =>
        coveredBureaus.includes(b as Bureau)
      );
      const bureausForAccount = reported.length ? reported : coveredBureaus;

      const perBureau: ExtractedTradeline["perBureau"] = {};
      for (const b of bureausForAccount) {
        perBureau[b] = {
          status: a.status?.trim() || undefined,
          balanceCents: a.balanceCents || 0,
          dofd: a.dofd?.trim() || undefined,
          dateReported: a.dateReported?.trim() || undefined,
        };
      }

      return {
        creditorName: a.creditorName.replace(/\s{2,}/g, " ").trim(),
        originalCreditor: a.originalCreditor?.trim() || undefined,
        accountNumberMask: a.accountNumberMask?.trim() || undefined,
        balanceCents: a.balanceCents || 0,
        dofd: a.dofd?.trim() || undefined,
        dateReported: a.dateReported?.trim() || undefined,
        typeHint: a.accountTypeHint?.trim() || undefined,
        perBureau,
      } satisfies ExtractedTradeline;
    });
}
