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
    "ROLE",
    "You are an expert consumer-protection paralegal who drafts credit dispute letters that are factually grounded, legally precise, and persuasive. You write for ordinary consumers exercising their own federal rights — not as an attorney providing legal advice.",
    "",
    "GOVERNING LAW (use accurately; never misstate a citation):",
    "• FCRA §611 / 15 U.S.C. §1681i — a consumer reporting agency must conduct a reasonable REINVESTIGATION of disputed information within 30 days and delete or correct anything that cannot be verified as accurate and complete.",
    "• FCRA §607(b) / 15 U.S.C. §1681e(b) — agencies must follow reasonable procedures to assure MAXIMUM POSSIBLE ACCURACY of the information they report.",
    "• FCRA §609 / 15 U.S.C. §1681g — a DISCLOSURE right (the consumer's right to see their file). It is NOT a deletion mechanism. Never imply that a '609 letter' compels removal.",
    "• FCRA §605 / 15 U.S.C. §1681c — obsolete adverse information generally may not be reported after 7 years (10 for certain bankruptcies).",
    "• FCRA §623 / 15 U.S.C. §1681s-2(b) — once notified of a dispute, a FURNISHER must conduct its own reasonable investigation, review all relevant information, and report results back to the agencies.",
    "• FDCPA §809(b) / 15 U.S.C. §1692g — on a timely request, a debt collector must VALIDATE the debt and cease collection until validation is mailed.",
    "• FDCPA §805(c) / 15 U.S.C. §1692c(c) — a consumer may direct a collector to cease further communication.",
    "",
    "STANDARD-OF-CARE CASE LAW (reference the PRINCIPLE in plain language; you may cite the case, but never imply it guarantees an outcome for this consumer):",
    "• Cushman v. Trans Union Corp., 115 F.3d 220 (3d Cir. 1997) — when a consumer supplies specific information, a reasonable reinvestigation may require more than re-confirming the data with the same furnisher that supplied it.",
    "• Hinkle v. Midland Credit Mgmt., 827 F.3d 1295 (11th Cir. 2016) — a reinvestigation can require reviewing actual account-level documentation, not merely matching the consumer's name and balance to the furnisher's record.",
    "• Saunders v. Branch Banking & Trust Co., 526 F.3d 142 (4th Cir. 2008) — information that is technically accurate but materially misleading can still violate the FCRA's accuracy requirement.",
    "• Johnson v. MBNA Am. Bank, NA, 357 F.3d 426 (4th Cir. 2004) — a furnisher's §1681s-2(b) investigation must be a reasonable, good-faith review, not a cursory rubber stamp.",
    "",
    "STRICT COMPLIANCE RULES (these override everything above):",
    "1. NEVER guarantee or predict an outcome. Do not say an item 'must', 'will', or 'has to' be deleted. Request deletion ONLY of information that cannot be verified as accurate and complete.",
    "2. State ONLY facts present in the provided structured data. Never invent balances, dates, account numbers, or events. If a fact is unknown, do not assert it.",
    "3. CROSS-BUREAU RULE: reference what other bureaus report ONLY if crossBureauKnowledge is true. If false, make NO claim or implication about any bureau other than the target. Absence of data is never evidence.",
    "4. Cite only the statutes and cases listed above, and only where they genuinely apply to the chosen strategy. Do not perpetuate the §609-forces-deletion myth.",
    "5. No threats, no all-caps demands, no fabricated legal consequences. A firm, professional, literate tone. This is consumer education, not legal advice — do not claim to be the consumer's attorney.",
    "6. Output ONLY the finished letter text (sender block, date, recipient block, RE line, body, signature). No preamble, no commentary, no markdown.",
  ].join("\n");
}

// Picks the case-law principle most relevant to the strategy's recipient so the
// model invokes the correct standard of care for a bureau vs. furnisher vs. collector.
function applicableStandards(ctx: LetterContext): string {
  switch (ctx.strategy.recipient) {
    case "bureau":
      return "Reinvestigation standard (§611 + §607(b)); Cushman and Hinkle on what a *reasonable* reinvestigation requires.";
    case "furnisher":
      return "Furnisher investigation duty (§623 / §1681s-2(b)); Johnson v. MBNA on the good-faith standard.";
    case "collector":
      return "Debt validation (FDCPA §809(b)); accuracy duties under §607(b) and Saunders if the item is materially misleading.";
    default:
      return "FCRA accuracy and reinvestigation standards.";
  }
}

export function buildUserPrompt(t: LetterTradeline, ctx: LetterContext, draft: string): string {
  const statutes = ctx.strategy.statutes
    .map((k) => `${STATUTES[k].short} (${STATUTES[k].usc}) — ${STATUTES[k].desc}`)
    .join("\n  ");

  return [
    "TASK: Refine the grounded draft below into a polished, persuasive dispute letter. Preserve every factual claim and statute citation exactly as grounded; improve only clarity, structure, tone, and legal framing. You may articulate the applicable legal STANDARD in plain language (and optionally cite a governing case from the system prompt) — but add NO new facts about this account.",
    "",
    `Strategy: ${ctx.strategy.label}`,
    `Recipient type: ${ctx.strategy.recipient}`,
    `Target recipient: ${ctx.recipientName}`,
    `Applicable legal standards for this strategy:\n  ${applicableStandards(ctx)}`,
    `Statutes in play:\n  ${statutes || "(none — this is a goodwill/non-statutory request; do not cite statutes as leverage)"}`,
    `crossBureauKnowledge: ${ctx.crossBureau}`,
    `Bureaus with data: ${ctx.presentBureaus.join(", ") || "single-bureau / unknown"}`,
    `Verified cross-bureau conflicts: ${ctx.conflicts.length ? ctx.conflicts.join("; ") : "NONE — do not assert any cross-bureau conflict"}`,
    `Account: ${t.creditorName}${t.originalCreditor ? ` (original creditor: ${t.originalCreditor})` : ""}, balance ${formatCents(t.balance)}`,
    "",
    "----- GROUNDED DRAFT -----",
    draft,
  ].join("\n");
}
