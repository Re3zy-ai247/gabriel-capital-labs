import type { Bureau } from "@prisma/client";
import { STRATEGY_BY_ID, type Strategy } from "./strategies";
import { STATUTES } from "./statutes";
import { BUREAU_ADDRESS, BUREAU_LABEL } from "./bureaus";
import { getBureauData, presentBureaus, hasCrossBureauKnowledge, crossBureauConflicts, type BureauData } from "./bureauData";
import { formatCents, formatDate } from "./utils";

export interface LetterTradeline {
  creditorName: string;
  originalCreditor?: string | null;
  accountNumberMask?: string | null;
  balance: number;
  dateOfFirstDelinquency?: Date | string | null;
  bureauData: unknown;
}

export interface LetterConsumer {
  fullName?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface LetterContext {
  strategy: Strategy;
  recipientName: string;
  recipientLines: string[];
  targetBureau?: Bureau;
  consumerComplete: boolean;
  crossBureau: boolean;
  presentBureaus: Bureau[];
  conflicts: string[];
  data: BureauData;
}

export function buildContext(
  strategyId: string,
  t: LetterTradeline,
  consumer: LetterConsumer,
  targetBureau?: Bureau
): LetterContext {
  const strategy = STRATEGY_BY_ID[strategyId] ?? STRATEGY_BY_ID["fcra_611"];
  const data = getBureauData(t.bureauData);
  const present = presentBureaus(data);
  const bureau = targetBureau ?? present[0] ?? "EQUIFAX";

  let recipientName = "";
  let recipientLines: string[] = [];
  if (strategy.recipient === "bureau") {
    const addr = BUREAU_ADDRESS[bureau];
    recipientName = addr.name;
    recipientLines = addr.lines;
  } else {
    recipientName = t.creditorName;
    recipientLines = ["[Furnisher mailing address]"];
  }

  const consumerComplete = Boolean(consumer.fullName && consumer.addressLine1 && consumer.city && consumer.state && consumer.zip);

  return {
    strategy,
    recipientName,
    recipientLines,
    targetBureau: strategy.recipient === "bureau" ? bureau : undefined,
    consumerComplete,
    crossBureau: hasCrossBureauKnowledge(data),
    presentBureaus: present,
    conflicts: crossBureauConflicts(data),
    data,
  };
}

// Deterministic, compliance-safe letter. Used as the LLM's grounding draft and as
// a fallback when no LLM key is configured. CRITICAL: only emits cross-bureau
// language when crossBureau is true.
export function renderTemplateLetter(t: LetterTradeline, ctx: LetterContext, consumer: LetterConsumer): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const name = consumer.fullName || "[YOUR FULL NAME]";
  const addr1 = consumer.addressLine1 || "[YOUR ADDRESS]";
  const cityLine = consumer.city ? `${consumer.city}, ${consumer.state} ${consumer.zip}` : "[CITY, STATE ZIP]";
  const acct = t.accountNumberMask || "XXXX-XXXX";
  const statutes = ctx.strategy.statutes.map((k) => `${STATUTES[k].short} (${STATUTES[k].usc})`).join(", ");
  const bureauName = ctx.targetBureau ? BUREAU_LABEL[ctx.targetBureau] : ctx.recipientName;

  const lines: string[] = [];
  lines.push(name, addr1, cityLine, "", today, "", ctx.recipientName, ...ctx.recipientLines, "");
  lines.push(`RE: Dispute of ${t.creditorName} account ${acct}`, "");
  lines.push(`To Whom It May Concern,`, "");

  lines.push(
    `I am writing to dispute information associated with the above account that appears on ${
      ctx.targetBureau ? `my ${bureauName} consumer file` : "my consumer credit file"
    }. I am exercising my rights under ${statutes}.`,
    ""
  );

  // Factual basis — grounded strictly in what we actually know.
  lines.push("FACTUAL BASIS");
  if (ctx.crossBureau && ctx.conflicts.length) {
    lines.push(
      `Based on the data reported across the bureaus for which information is available (${ctx.presentBureaus
        .map((b) => BUREAU_LABEL[b])
        .join(", ")}), I have identified the following inconsistencies:`
    );
    ctx.conflicts.forEach((c, i) => lines.push(`  ${i + 1}. ${c}`));
  } else {
    lines.push(
      `I dispute the accuracy and completeness of this account as reported on my ${bureauName} file. I am not making any representation about how, or whether, other consumer reporting agencies report this account, because I have not reviewed those files. I request that ${bureauName} verify the accuracy and completeness of every data element below.`
    );
  }
  lines.push("");

  lines.push("DISPUTED DATA ELEMENTS");
  lines.push(`  • Account status`);
  lines.push(`  • Balance reported (${formatCents(t.balance)})`);
  lines.push(`  • Date of first delinquency${t.dateOfFirstDelinquency ? ` (${formatDate(t.dateOfFirstDelinquency)})` : ""}`);
  lines.push(`  • Payment history`);
  if (t.originalCreditor) lines.push(`  • Original creditor (${t.originalCreditor})`);
  lines.push("");

  // Strategy-specific demand
  if (ctx.strategy.id === "validation" || ctx.strategy.id === "fdcpa") {
    lines.push(
      `Pursuant to ${STATUTES.fdcpa_809.short} (${STATUTES.fdcpa_809.usc}), I request validation of this debt, including the name and address of the original creditor, the amount owed, and documentation establishing your authority to collect. Please cease collection activity until validation is provided.`,
      ""
    );
  }
  if (ctx.strategy.id === "fcra_605") {
    lines.push(
      `Under ${STATUTES.fcra_605.short} (${STATUTES.fcra_605.usc}), adverse information generally may not be reported beyond seven years. If this item is obsolete, I request its removal.`,
      ""
    );
  }

  lines.push("REQUESTED ACTION");
  lines.push("  1. Conduct a reasonable reinvestigation of the disputed information.");
  lines.push("  2. Verify each disputed data element with the original source documentation.");
  lines.push("  3. Correct any inaccurate or incomplete information.");
  lines.push("  4. Delete any information that cannot be verified as complete and accurate.");
  lines.push("  5. Provide the method of verification and the source(s) relied upon.");
  lines.push("");
  lines.push(
    `Under ${STATUTES.fcra_611.short} (${STATUTES.fcra_611.usc}), please complete this reinvestigation within 30 days. If any disputed information cannot be verified as complete and accurate, it should be deleted or corrected.`,
    ""
  );
  lines.push(
    "Please preserve all records related to this dispute. If this matter is not resolved, I reserve all rights available under federal and state law, including filing complaints with the Consumer Financial Protection Bureau and my state Attorney General.",
    ""
  );
  lines.push("Respectfully,", "", name);

  return lines.join("\n");
}

export function buildSystemPrompt(): string {
  return [
    "You are a paralegal assistant that drafts consumer credit dispute letters that are factually grounded and legally accurate.",
    "STRICT RULES:",
    "1. Never guarantee any outcome. Never claim an item 'must' or 'will' be deleted. Request deletion only of information that cannot be verified.",
    "2. Only state facts that are present in the provided structured data. Never invent balances, dates, or account details.",
    "3. CROSS-BUREAU RULE: Only reference what other credit bureaus report if crossBureauKnowledge is true. If it is false, do NOT claim or imply anything about bureaus other than the target — absence of data is not evidence.",
    "4. Cite only the statutes provided. Do not perpetuate the myth that FCRA §609 compels deletion; §611 governs reinvestigation.",
    "5. Keep a firm, professional, non-threatening tone. No all-caps demands.",
  ].join("\n");
}

export function buildUserPrompt(t: LetterTradeline, ctx: LetterContext, draft: string): string {
  return [
    `Strategy: ${ctx.strategy.label}`,
    `Target: ${ctx.recipientName}`,
    `crossBureauKnowledge: ${ctx.crossBureau}`,
    `Bureaus with data: ${ctx.presentBureaus.join(", ") || "single-bureau / unknown"}`,
    `Verified cross-bureau conflicts: ${ctx.conflicts.length ? ctx.conflicts.join("; ") : "NONE — do not assert any"}`,
    `Account: ${t.creditorName}, balance ${formatCents(t.balance)}`,
    "",
    "Refine the following grounded draft into a polished letter. Keep all factual claims and statute citations exactly as grounded; improve only clarity and flow. Do not add new factual claims.",
    "----- DRAFT -----",
    draft,
  ].join("\n");
}
