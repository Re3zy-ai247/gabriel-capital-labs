import type { Bureau, AccountType } from "@prisma/client";
import { STRATEGY_BY_ID, type Strategy } from "./strategies";
import { STATUTES } from "./statutes";
import { BUREAU_ADDRESS, BUREAU_LABEL } from "./bureaus";
import { getBureauData, presentBureaus, hasCrossBureauKnowledge, crossBureauConflicts, type BureauData } from "./bureauData";
import { obsolescenceWindowYears, bureauTextBlob } from "./obsolescence";
import { formatCents, formatDate } from "./utils";

export interface LetterTradeline {
  creditorName: string;
  originalCreditor?: string | null;
  accountNumberMask?: string | null;
  accountType?: AccountType;
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
  // True when the recipient block is mail-ready: bureau letters always are; a
  // furnisher/collector letter is complete only once a recipient address is given.
  recipientComplete: boolean;
  crossBureau: boolean;
  presentBureaus: Bureau[];
  conflicts: string[];
  data: BureauData;
  // FCRA §605 reporting window for this item (7 years, or 10 for a bankruptcy
  // public record). Used to keep the obsolescence language accurate.
  obsolescenceYears: number;
  // Dispute round (1 = first dispute). Drives the tone ladder: neutral
  // investigation in R1, method-of-verification in R2, regulatory framing by R4/5.
  round: number;
}

// Optional override of the recipient block for furnisher/collector letters, so a
// direct dispute is addressed to the actual mailing address instead of a
// "[Furnisher mailing address]" placeholder.
export interface RecipientOverride {
  name?: string | null;
  address?: string | null; // free-text, one address line per newline
}

// Split a free-text address into clean, non-empty lines for the recipient block.
function addressLines(address: string | null | undefined): string[] {
  if (!address) return [];
  return address
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function buildContext(
  strategyId: string,
  t: LetterTradeline,
  consumer: LetterConsumer,
  targetBureau?: Bureau,
  round: number = 1,
  recipient?: RecipientOverride
): LetterContext {
  const strategy = STRATEGY_BY_ID[strategyId] ?? STRATEGY_BY_ID["fcra_611"];
  const data = getBureauData(t.bureauData);
  const present = presentBureaus(data);
  const bureau = targetBureau ?? present[0] ?? "EQUIFAX";

  let recipientName = "";
  let recipientLines: string[] = [];
  let recipientComplete = true;
  if (strategy.recipient === "bureau") {
    const addr = BUREAU_ADDRESS[bureau];
    recipientName = addr.name;
    recipientLines = addr.lines;
  } else {
    recipientName = (recipient?.name?.trim() || t.creditorName);
    const provided = addressLines(recipient?.address);
    if (provided.length) {
      recipientLines = provided;
    } else {
      recipientLines = ["[Furnisher mailing address]"];
      recipientComplete = false;
    }
  }

  const consumerComplete = Boolean(consumer.fullName && consumer.addressLine1 && consumer.city && consumer.state && consumer.zip);

  return {
    strategy,
    recipientName,
    recipientLines,
    targetBureau: strategy.recipient === "bureau" ? bureau : undefined,
    consumerComplete,
    recipientComplete,
    crossBureau: hasCrossBureauKnowledge(data),
    presentBureaus: present,
    conflicts: crossBureauConflicts(data),
    data,
    obsolescenceYears: obsolescenceWindowYears({
      accountType: t.accountType ?? "OTHER",
      creditorName: t.creditorName,
      text: bureauTextBlob(data),
    }),
    round: Math.max(1, round),
  };
}

// One investigator-style finding: the fact, and the one sentence that explains
// why the fact prevents the information from being verified as accurate and
// complete. This is the FACT → WHY IT MATTERS spine — the investigation request
// itself lives in the REQUESTED ACTION section, never inside a finding.
interface Finding {
  element: string;
  fact: string;
  why: string;
}

// Builds at most five findings, grounded STRICTLY in available data. Cross-bureau
// facts are emitted only when ctx.crossBureau is true and the values actually
// differ — absence of data is never treated as a discrepancy.
function buildFindings(t: LetterTradeline, ctx: LetterContext): Finding[] {
  const data = ctx.data;
  const present = ctx.presentBureaus;
  const lbl = (b: Bureau) => BUREAU_LABEL[b];
  const findings: Finding[] = [];

  const collect = <V>(pick: (f: BureauData[Bureau]) => V | undefined | null) =>
    present
      .map((b) => ({ b, v: pick(data[b]) }))
      .filter((x) => x.v != null && String(x.v).length > 0) as { b: Bureau; v: V }[];

  // Account status
  const statuses = collect((f) => f?.status);
  if (ctx.crossBureau && new Set(statuses.map((s) => String(s.v).toLowerCase())).size > 1) {
    findings.push({
      element: "Account Status",
      fact: statuses.map((s) => `${lbl(s.b)} reports "${s.v}"`).join("; ") + ".",
      why: "These reported statuses cannot all describe the current state of the same account, and the discrepancy warrants verification.",
    });
  } else if (statuses.length) {
    findings.push({
      element: "Account Status",
      fact: `Reported as "${statuses[0].v}"${ctx.targetBureau ? ` on the ${lbl(ctx.targetBureau)} file` : ""}.`,
      why: "The reported status must be verifiable against the original account records; if it cannot be substantiated as accurate and complete, it cannot be reported as such.",
    });
  } else {
    findings.push({
      element: "Account Status",
      fact: "The account status as currently reported.",
      why: "I am unable to reconcile the reported status with my records and request that its accuracy be verified.",
    });
  }

  // Reported balance
  const balances = collect((f) => f?.balanceCents);
  if (ctx.crossBureau && new Set(balances.map((s) => s.v)).size > 1) {
    findings.push({
      element: "Reported Balance",
      fact: balances.map((s) => `${lbl(s.b)} reports ${formatCents(s.v)}`).join("; ") + ".",
      why: "A single account cannot simultaneously carry materially different balances; this inconsistency warrants verification of the correct figure, if any.",
    });
  } else {
    findings.push({
      element: "Reported Balance",
      fact: `Reported balance of ${formatCents(t.balance)}.`,
      why: "The reported balance must reconcile with the account's payment and transaction history; a balance that cannot be substantiated to the penny cannot be reported as accurate.",
    });
  }

  // Date of first delinquency
  const dofds = collect((f) => f?.dofd);
  if (ctx.crossBureau && new Set(dofds.map((s) => String(s.v))).size > 1) {
    findings.push({
      element: "Date of First Delinquency",
      fact: dofds.map((s) => `${lbl(s.b)} reports ${formatDate(s.v)}`).join("; ") + ".",
      why: "The date of first delinquency governs the seven-year reporting window under FCRA §605; inconsistent dates raise a concern that the reporting period may be misstated and warrant verification.",
    });
  } else if (t.dateOfFirstDelinquency) {
    findings.push({
      element: "Date of First Delinquency",
      fact: `Reported as ${formatDate(t.dateOfFirstDelinquency)}.`,
      why: "The date of first delinquency controls when this item must cease to be reported under FCRA §605 and must be accurate and verifiable to the original delinquency.",
    });
  }

  // Original creditor (collections) — completeness concern
  if (t.originalCreditor) {
    findings.push({
      element: "Original Creditor",
      fact: `Reported original creditor: ${t.originalCreditor}.`,
      why: "The chain from the original creditor to the current reporting party must be documented; if it cannot be substantiated, the reporting is incomplete.",
    });
  }

  // Payment history — always a completeness concern
  findings.push({
    element: "Payment History",
    fact: "The payment history associated with this account as reported.",
    why: "The payment history must be complete and accurate in every field; entries the furnisher cannot substantiate render the reporting incomplete.",
  });

  return findings.slice(0, 5);
}

// REQUESTED ACTION + the exact evidence demanded — differentiated by who the letter
// is to. A bureau owes a §611 reasonable reinvestigation; a furnisher owes its own
// §1681s-2(b) investigation; a collector owes §1692g validation. Emitting the wrong
// demand (asking a collector for a "§611 reinvestigation") is both legally wrong and
// pattern-matchable as a credit-repair template, so the demand tracks the recipient.
// Every request stays conditional ("if it cannot be verified") — never an outcome.
function requestedAction(ctx: LetterContext): string[] {
  const out: string[] = [];
  switch (ctx.strategy.id) {
    case "goodwill":
      out.push("REQUESTED ACTION");
      out.push(
        "  I am not disputing the accuracy of this item. I am respectfully asking, as a gesture of goodwill, that you consider removing or revising the reported late payment(s) in light of my broader history with the account. I understand this is a courtesy and that you are under no obligation to grant it."
      );
      return out;
    case "cease_desist":
      out.push("REQUESTED ACTION");
      out.push(
        `  Pursuant to ${STATUTES.fdcpa_805c.short} (${STATUTES.fdcpa_805c.usc}), I request that you cease further communication with me regarding this account, except as the statute expressly permits (for example, to advise that collection efforts are being terminated or to notify me of a specific remedy you intend to invoke). This letter does not acknowledge the debt and does not waive any right, including my right to dispute it or to request validation.`
      );
      return out;
    case "pay_delete":
      out.push("REQUESTED ACTION");
      out.push(
        "  Without acknowledging that this debt is owed, I am willing to resolve this account in exchange for the complete deletion of the associated tradeline from every consumer reporting agency to which you furnish it. If you accept, please confirm the arrangement in writing BEFORE any payment is made; a written agreement is a condition of any payment, because some data-furnishing agreements discourage deletion in exchange for payment."
      );
      return out;
  }

  switch (ctx.strategy.recipient) {
    case "collector":
      out.push("REQUESTED ACTION — VALIDATION OF DEBT");
      out.push(`  1. Validate this debt under ${STATUTES.fdcpa_809.short} (${STATUTES.fdcpa_809.usc}): the amount claimed, the name and address of the original creditor, and an itemized accounting of the balance.`);
      out.push("  2. Provide documentation of your authority to collect — the assignment or bill of sale evidencing the chain of title from the original creditor to you.");
      out.push("  3. Cease collection activity until validation is mailed to me.");
      out.push("  4. To the extent you continue to furnish this account to the consumer reporting agencies, conduct the investigation the FCRA requires of a furnisher and report only information you have verified as accurate and complete.");
      return out;
    case "furnisher":
      out.push("REQUESTED ACTION — FURNISHER INVESTIGATION");
      out.push(`  1. Conduct your own reasonable investigation of the disputed information under ${STATUTES.fcra_623.short} (${STATUTES.fcra_623.usc}).`);
      out.push("  2. Review the account-level records that would substantiate this reporting — the original signed agreement, the account statements or ledger, and the complete payment history — rather than re-confirming a summary tradeline.");
      out.push("  3. Report the results of your investigation to every consumer reporting agency to which you furnish this account.");
      out.push("  4. Modify, delete, or permanently block any item you find to be inaccurate, incomplete, or that cannot be verified against those records.");
      return out;
    case "bureau":
    default:
      out.push("REQUESTED ACTION — REINVESTIGATION");
      out.push(`  1. Conduct a reasonable reinvestigation of each disputed item under ${STATUTES.fcra_611.short} (${STATUTES.fcra_611.usc}).`);
      out.push("  2. Forward all relevant information to the furnisher and require it to verify each disputed element against original, account-level documentation — not merely re-match my name and balance to its own record.");
      out.push("  3. Correct or delete any information that cannot be verified as both accurate and complete.");
      out.push("  4. Disclose the method of verification under FCRA §611(a)(7): the business contacted, the procedure used, and the documentation relied upon.");
      out.push("  5. Provide an updated copy of my consumer file and written notice of the results.");
      return out;
  }
}

// The deadline sentence + round-scaled escalation — also recipient-specific, so a
// collector/furnisher is never told to "complete a §611 reinvestigation in 30 days."
function closing(ctx: LetterContext): string[] {
  // Non-dispute strategies get a matching close and NO reinvestigation/validation
  // demand and NO regulatory escalation ladder.
  if (ctx.strategy.id === "goodwill") {
    return ["Thank you for considering this request. I value the account relationship and appreciate any consideration you can extend."];
  }
  if (ctx.strategy.id === "cease_desist") {
    return [`Please treat this letter as my written cease-communication request under ${STATUTES.fdcpa_805c.short} (${STATUTES.fdcpa_805c.usc}). I am not waiving any right, including my right to dispute this debt or to request validation, and I ask that you confirm in writing that further communication will stop.`];
  }
  if (ctx.strategy.id === "pay_delete") {
    return [`This is a settlement offer and is not an acknowledgment of the debt. Please respond in writing. If we do not reach a written agreement, I reserve all rights, including the right to dispute this debt and to request validation under ${STATUTES.fdcpa_809.short} (${STATUTES.fdcpa_809.usc}).`];
  }
  const out: string[] = [];
  if (ctx.strategy.recipient === "collector") {
    // Timeliness is hedged: the §1692g(b) cease-collection duty only attaches to a
    // dispute made within 30 days of the collector's initial notice — a date we
    // don't track, so we never assert it as fact.
    out.push(`This is a written dispute. To the extent it is timely under ${STATUTES.fdcpa_809.short} (${STATUTES.fdcpa_809.usc}), please cease collection until you have mailed the validation described above. Nothing in this letter acknowledges the debt or waives any defense.`);
  } else if (ctx.strategy.recipient === "furnisher") {
    out.push(`Please complete your investigation and report the corrected results to the consumer reporting agencies under ${STATUTES.fcra_623.short} (${STATUTES.fcra_623.usc}). If an item cannot be substantiated against your account records, it should be modified, deleted, or blocked.`);
  } else {
    out.push(`Under ${STATUTES.fcra_611.short} (${STATUTES.fcra_611.usc}), please complete this reinvestigation within 30 days of receipt. If any disputed item cannot be verified as accurate and complete, it should be corrected or deleted.`);
  }
  out.push("");
  // Escalation ladder — only the regulatory framing scales with the round.
  if (ctx.round >= 4) {
    out.push(
      "This letter, together with my prior correspondence on this matter, constitutes a complete record of the disputes I have raised and the responses received. If the disputed information is not corrected or deleted, I am prepared to submit this record to the Consumer Financial Protection Bureau and my state Attorney General for review. Please preserve all records, investigation notes, verification documentation, and audit trails relating to this dispute."
    );
  } else if (ctx.round === 3) {
    out.push(
      "Because a prior response did not disclose how the disputed information was verified, I again request the method of verification and the specific source documentation relied upon. Please preserve all records related to this dispute. If the information cannot be substantiated, I reserve the right to seek review through the Consumer Financial Protection Bureau and other appropriate channels."
    );
  } else {
    out.push(
      "Please preserve all records related to this dispute. If the disputed information cannot be adequately verified or addressed, I reserve the right to seek review through the Consumer Financial Protection Bureau and other appropriate regulatory channels."
    );
  }
  return out;
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
  lines.push(`RE: ${ctx.round >= 2 ? "Continued dispute" : "Dispute"} of ${t.creditorName} account ${acct}`, "");
  lines.push(`To Whom It May Concern,`, "");

  // Purpose-built opening. The three NON-DISPUTE strategies do not challenge the
  // item's accuracy, so they open on their own terms and carry NO findings section
  // (a goodwill letter that also lists "factual concerns" contradicts itself). The
  // accuracy disputes keep the neutral, round-aware investigation frame.
  const nonDispute = ctx.strategy.id === "goodwill" || ctx.strategy.id === "cease_desist" || ctx.strategy.id === "pay_delete";
  if (ctx.strategy.id === "goodwill") {
    lines.push(
      "I am writing regarding the above account. I am not disputing the accuracy of what is reported; rather, I am asking you to consider a goodwill adjustment in light of my overall history with the account, as explained below.",
      ""
    );
  } else if (ctx.strategy.id === "cease_desist") {
    lines.push(
      "I am writing regarding the above account to make a formal request under the Fair Debt Collection Practices Act, set out below. This letter is not an acknowledgment that the debt is owed.",
      ""
    );
  } else if (ctx.strategy.id === "pay_delete") {
    lines.push(
      "I am writing to propose a resolution of the above account. This is a settlement communication and is not an acknowledgment that the debt is owed or an admission of liability.",
      ""
    );
  } else if (ctx.round >= 2) {
    lines.push(
      `I am writing to follow up on a prior dispute concerning the above account, which remains unresolved. Having reviewed the information that appears on ${
        ctx.targetBureau ? `my ${bureauName} consumer file` : "my consumer credit file"
      }, I have set out below the specific factual concerns that I am unable to reconcile, and I ask that they be addressed through a reasonable reinvestigation under ${statutes}.`,
      ""
    );
  } else {
    lines.push(
      `I am writing to bring to your attention specific information associated with the above account that appears on ${
        ctx.targetBureau ? `my ${bureauName} consumer file` : "my consumer credit file"
      } and that, based on the information currently available to me, I am unable to reconcile. I set out each concern below and respectfully request a reasonable reinvestigation under ${statutes}.`,
      ""
    );
  }

  // INVESTIGATOR SUMMARY — Data Element / Fact / Why It Matters. Grounded strictly
  // in available data; cross-bureau facts only when ctx.crossBureau is true. Emitted
  // only for accuracy disputes — never for goodwill / cease & desist / pay-for-delete.
  if (!nonDispute) {
    const findings = buildFindings(t, ctx);
    lines.push("SUMMARY OF FACTUAL CONCERNS");
    if (!ctx.crossBureau) {
      lines.push(
        `(The following concerns relate solely to how this account is reported on my ${bureauName} file. I make no representation about any other consumer reporting agency, as I have not reviewed those files.)`
      );
    }
    lines.push("");
    findings.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.element}`);
      lines.push(`   Fact: ${f.fact}`);
      lines.push(`   Why it matters: ${f.why}`);
      lines.push("");
    });
  }

  // Obsolescence grounds — the specific basis for the §605 strategy (bureau only).
  if (ctx.strategy.id === "fcra_605") {
    const windowPhrase =
      ctx.obsolescenceYears === 10
        ? "ten years for a bankruptcy of this type"
        : "seven years for most adverse information";
    lines.push(
      "GROUNDS — OBSOLESCENCE",
      `  Under ${STATUTES.fcra_605.short} (${STATUTES.fcra_605.usc}), adverse information generally may not be reported beyond ${windowPhrase}. If the reporting period for this item has expired, I request that it be treated as obsolete and removed.`,
      ""
    );
  }

  // Statutory authority — quote the actual operative law, not just the code, so the
  // recipient sees the precise obligation they are under. (Skipped for goodwill,
  // which cites no statute and makes no legal demand.)
  if (ctx.strategy.statutes.length) {
    lines.push("STATUTORY AUTHORITY");
    for (const k of ctx.strategy.statutes) {
      const s = STATUTES[k];
      lines.push(`  ${s.short} (${s.usc}):`);
      lines.push(`    ${s.text}`);
    }
    lines.push("");
  }

  // Recipient- and strategy-specific requested action + evidence, then the matching
  // deadline sentence and round-scaled escalation.
  lines.push(...requestedAction(ctx), "");
  lines.push(...closing(ctx), "");
  lines.push("Respectfully,", "", name);

  return lines.join("\n");
}

export function buildSystemPrompt(round: number = 1): string {
  const r = Math.max(1, round);
  return [
    "ROLE",
    "You are an expert consumer-protection paralegal who drafts credit dispute letters that are factually grounded, legally precise, and persuasive. You write for ordinary consumers exercising their own federal rights — not as an attorney providing legal advice. Your register is that of a compliance analyst documenting concerns, not a credit-repair template threatening litigation.",
    "",
    "INVESTIGATOR-FIRST METHOD (how to argue — this governs structure):",
    "Every disputed point follows the order FACT → WHY IT MATTERS → INVESTIGATION REQUEST. Never lead with a statute, an accusation, or a demand. State the factual concern first; explain in one sentence why it prevents the information from being verified as accurate and complete; only then invoke the law that entitles the consumer to a reinvestigation. The objective is deletion of UNVERIFIABLE information — and the lawful, higher-yield path to deletion is to compel a real reinvestigation the furnisher cannot satisfy, after which §1681i requires deletion automatically. A letter an agency can pattern-match to a credit-repair template may be deemed frivolous under FCRA §1681i(a)(3) and never investigated; an investigator-style letter compels the reinvestigation. Never demand deletion as a substitute for requesting verification first.",
    "",
    "PREFERRED FRAMING — state concerns, not verdicts. Prefer phrasing such as: 'raises concerns regarding', 'appears inconsistent with', 'cannot be readily reconciled', 'warrants verification', 'appears incomplete', 'if it cannot be substantiated', 'based on the information currently available', 'I am unable to reconcile'. Present facts that warrant investigation; do not pronounce conclusions only an adjudicator can reach.",
    "",
    "NEVER STATE AS ESTABLISHED FACT (reframe each as a concern warranting investigation):",
    "• that a law has been violated — no 'this violates the FCRA', 'you are in violation', 'this is illegal', 'this is fraud', 'you are liable';",
    "• that the agency or furnisher 'failed to investigate' — instead, a prior response 'does not appear to reflect a reasonable reinvestigation', and request the method of verification;",
    "• that an account 'is re-aged' — instead, the date of first delinquency 'appears inconsistent and warrants verification';",
    "• that a hard inquiry 'was unauthorized' — UNLESS the consumer has confirmed it; otherwise the consumer 'does not recognize any application or transaction that would authorize' it;",
    "• the §609 and Metro 2 deletion myths — §609 is a disclosure right only; Metro 2 is a formatting standard, never a deletion mandate.",
    "",
    `ROUND-BASED TONE — this letter is ROUND ${r}. Match the tone to the round and never exceed it:`,
    "• Round 1 — neutral, professional, investigation-focused; the goal is a documented reinvestigation request. The CFPB appears at most as a single reserved sentence in the closing.",
    "• Round 2 — reference the prior dispute and the response received; demand the METHOD OF VERIFICATION under FCRA §611(a)(7) (the source contacted and the procedure used); challenge the adequacy of the prior reinvestigation in plain language (Cushman; Hinkle).",
    "• Round 3 — verification-focused; press for the specific source documentation relied upon and challenge any 'verified' result that was not substantiated.",
    "• Round 4 — regulatory-review tone; summarize the chronology of unresolved disputes and frame the letter as the record supporting a CFPB / state-Attorney-General complaint.",
    "• Round 5 — comprehensive final escalation; summarize the full dispute history and preserve all rights.",
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
    "6. RECIPIENT-SPECIFIC DEMANDS — match the demand to the recipient and never mix them. A BUREAU is asked to conduct a §611 reasonable reinvestigation and to disclose the §611(a)(7) method of verification (the business contacted, the procedure used, the documentation relied upon). A FURNISHER is asked to conduct its own §1681s-2(b) investigation against account-level records (the original agreement, statements/ledger, full payment history) and to report corrections to every CRA it furnishes. A COLLECTOR is asked to validate under FDCPA §1692g (the amount, the original creditor's name and address, and the chain of title) and to cease collection until validation is mailed. NEVER demand a '§611 reinvestigation within 30 days' from a collector or furnisher, and NEVER ask a bureau to 'validate' a debt. A goodwill request makes no legal demand; a cease-and-desist or pay-for-delete adds no accuracy dispute and admits nothing.",
    "7. Output ONLY the finished letter text (sender block, date, recipient block, RE line, body, signature). No preamble, no commentary, no markdown.",
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

// ---- Phase 1A-R RB-4 / RB-6: shared letter-lifecycle helpers -----------------
// Both fixes below are deliberately DETERMINISTIC and DB-free — no AI, no
// regeneration, no schema change — so they run identically from a Server
// Component (render path) or a route handler (write path), and are
// unit-testable in scripts/letter.test.ts with zero DB/network.

// The exact literal tokens renderTemplateLetter/buildContext emit above when
// sender or recipient data is missing at generation time. Every placeholder-
// aware surface (print, download, Mail Center) keys off these SAME strings —
// one source of truth, never re-derived per caller.
export const SENDER_PLACEHOLDER_TOKENS = ["[YOUR FULL NAME]", "[YOUR ADDRESS]", "[CITY, STATE ZIP]"] as const;
export const FURNISHER_PLACEHOLDER_TOKEN = "[Furnisher mailing address]";

// RENDER-TIME SENDER RESOLUTION (RB-4). The stored Letter.body is frozen at
// generation time — deliberately: the dispute CONTENT (findings, statutes,
// requested action) must never silently change after the fact. But the
// sender block is not dispute content — it is the consumer's own CURRENT
// legal name/address, the same fields Settings already treats as live. When
// the profile was incomplete at generation, the stored body carries literal
// placeholder tokens; once the profile is completed, this substitutes the
// CURRENT profile values into a RENDERED COPY ONLY — plain string
// replacement, no AI, no regeneration, no letter credit, no DB write. The
// stored row (and the `preview` field GET /api/letters returns) is never
// touched. Each token substitutes independently, so a partially-filled
// profile still gets whatever it has replaced rather than all-or-nothing.
export function resolveSenderPlaceholders(body: string, consumer: LetterConsumer): string {
  let out = body;
  if (consumer.fullName?.trim()) out = out.replaceAll("[YOUR FULL NAME]", consumer.fullName.trim());
  if (consumer.addressLine1?.trim()) out = out.replaceAll("[YOUR ADDRESS]", consumer.addressLine1.trim());
  if (consumer.city?.trim() && consumer.state?.trim() && consumer.zip?.trim()) {
    out = out.replaceAll("[CITY, STATE ZIP]", `${consumer.city.trim()}, ${consumer.state.trim()} ${consumer.zip.trim()}`);
  }
  return out;
}

export interface PlaceholderStatus {
  senderIncomplete: boolean; // [YOUR FULL NAME] / [YOUR ADDRESS] / [CITY, STATE ZIP] still present
  recipientIncomplete: boolean; // [Furnisher mailing address] still present — no live source to auto-resolve
  hasPlaceholder: boolean;
}

// PLACEHOLDER GATE (RB-4): what the RENDERED artifact (post render-time
// resolution) still carries. The furnisher/collector recipient address has no
// "current profile" equivalent to pull from at render time — it's only ever
// fixed by adding it on the letter's own recipient field and regenerating
// (RB-6 made that regenerate free and idempotent), so this function only
// DETECTS that placeholder; it never resolves it.
export function detectPlaceholders(renderedBody: string): PlaceholderStatus {
  const senderIncomplete = SENDER_PLACEHOLDER_TOKENS.some((t) => renderedBody.includes(t));
  const recipientIncomplete = renderedBody.includes(FURNISHER_PLACEHOLDER_TOKEN);
  return { senderIncomplete, recipientIncomplete, hasPlaceholder: senderIncomplete || recipientIncomplete };
}

// ---- RB-6: idempotent-regenerate matching (pure) -----------------------------
export interface RegenerateCandidate {
  id: string;
  targetBureau: Bureau | null;
  mailedAt: Date | string | null;
}
export interface RegeneratePlan {
  toUpdate: { target: Bureau | undefined; existingId: string }[];
  toCreate: (Bureau | undefined)[];
}

// For each requested target (a specific bureau, or undefined for a single-
// recipient furnisher/collector letter), decide whether an UNMAILED existing
// letter for the same tradeline+strategy+round already covers it (→ update in
// place: no new row, no quota consumed) or whether a fresh row is genuinely
// needed (→ create, quota-gated exactly as before). A MAILED letter is NEVER
// matched for update — regenerating against a mailed target falls through to
// create, the existing unchanged behavior; the real "next round" journey is
// the dedicated /api/letters/[id]/round2 endpoint, untouched by this function.
export function planLetterRegeneration(
  targets: (Bureau | undefined)[],
  candidates: RegenerateCandidate[]
): RegeneratePlan {
  const unmailedByBureau = new Map<string, RegenerateCandidate>();
  for (const c of candidates) {
    if (c.mailedAt) continue; // mailed rows are never regenerate-matched
    const key = c.targetBureau ?? "__none__";
    if (!unmailedByBureau.has(key)) unmailedByBureau.set(key, c); // first match wins, stable
  }
  const toUpdate: RegeneratePlan["toUpdate"] = [];
  const toCreate: RegeneratePlan["toCreate"] = [];
  for (const t of targets) {
    const match = unmailedByBureau.get(t ?? "__none__");
    if (match) toUpdate.push({ target: t, existingId: match.id });
    else toCreate.push(t);
  }
  return { toUpdate, toCreate };
}

export function buildUserPrompt(t: LetterTradeline, ctx: LetterContext, draft: string): string {
  const statutes = ctx.strategy.statutes
    .map((k) => `${STATUTES[k].short} (${STATUTES[k].usc}) — ${STATUTES[k].desc}\n    Operative text: ${STATUTES[k].text}`)
    .join("\n  ");

  return [
    "TASK: Refine the grounded draft below into a polished, persuasive dispute letter. Preserve every factual claim and statute citation exactly as grounded; improve only clarity, structure, tone, and legal framing. KEEP the STATUTORY AUTHORITY section and quote the operative statutory language provided below verbatim (in quotation marks) so the recipient sees the exact obligation — do not paraphrase the quoted text. You may articulate the applicable legal STANDARD in plain language (and optionally cite a governing case from the system prompt) — but add NO new facts about this account.",
    "PRESERVE THE INVESTIGATOR STRUCTURE: each concern in the 'SUMMARY OF FACTUAL CONCERNS' section must keep the FACT → WHY IT MATTERS shape — the fact first, then one sentence on why it prevents verification. Do not collapse these into a bare list and do not convert any 'Why it matters' sentence into an accusation that a violation occurred. Honor the round-based tone for the round indicated below.",
    "",
    `Dispute round: ${ctx.round}`,
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
