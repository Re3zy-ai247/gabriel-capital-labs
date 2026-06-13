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
  // Dispute round (1 = first dispute). Drives the tone ladder: neutral
  // investigation in R1, method-of-verification in R2, regulatory framing by R4/5.
  round: number;
}

export function buildContext(
  strategyId: string,
  t: LetterTradeline,
  consumer: LetterConsumer,
  targetBureau?: Bureau,
  round: number = 1
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

  // Round-aware opening. R1 frames a neutral investigation; R2+ reference the
  // unresolved prior dispute. The investigation request always follows the facts.
  if (ctx.round >= 2) {
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
  // in available data; cross-bureau facts only when ctx.crossBureau is true.
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

  // Statutory authority — quote the actual operative law, not just the code, so
  // the recipient sees the precise obligation they are under.
  if (ctx.strategy.statutes.length) {
    lines.push("STATUTORY AUTHORITY");
    for (const k of ctx.strategy.statutes) {
      const s = STATUTES[k];
      lines.push(`  ${s.short} (${s.usc}):`);
      lines.push(`    ${s.text}`);
    }
    lines.push("");
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

  // Closing escalates with the round. R1-2 reserve the CFPB as a single sentence;
  // R3 presses for the method of verification; R4-5 frame the letter as the
  // record supporting a regulatory complaint.
  if (ctx.round >= 4) {
    lines.push(
      "This letter, together with my prior correspondence on this matter, constitutes a complete record of the disputes I have raised and the responses received. If the disputed information is not corrected or deleted, I am prepared to submit this record to the Consumer Financial Protection Bureau and my state Attorney General for review. Please preserve all records, investigation notes, verification documentation, and audit trails relating to this dispute.",
      ""
    );
  } else if (ctx.round === 3) {
    lines.push(
      "Because a prior response did not disclose how the disputed information was verified, I again request the method of verification and the specific source documentation relied upon. Please preserve all records related to this dispute. If the information cannot be substantiated, I reserve the right to seek review through the Consumer Financial Protection Bureau and other appropriate channels.",
      ""
    );
  } else {
    lines.push(
      "Please preserve all records related to this dispute. If the disputed information cannot be adequately verified or addressed through the reinvestigation process, I reserve the right to seek review through the Consumer Financial Protection Bureau and other appropriate regulatory channels.",
      ""
    );
  }
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
