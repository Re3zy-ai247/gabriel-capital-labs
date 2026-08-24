// Kai Explainability Layer (Sprint VII, ADR-0010 spirit). Assembles the STRUCTURED
// "why" behind a tradeline's dispute read — entirely from real, persisted product
// data and the existing deterministic engines (scoring reasons, cross-bureau
// conflict detection, obsolescence clock, statute + strategy maps). It exposes
// EVIDENCE, never chain-of-thought, and never fabricates: if a fact isn't in the
// data, it isn't asserted. No AI call. Reads only the item's own row.
import type { AccountType, Probability } from "@prisma/client";
import { getBureauData, presentBureaus, hasCrossBureauKnowledge, crossBureauConflicts } from "./bureauData";
import { BUREAU_LABEL } from "./bureaus";
import { STATUTES, type StatuteKey } from "./statutes";
import { STRATEGY_BY_ID } from "./strategies";
import { fallOffInsight, formatMonthYear, knownBureauCount, reportedDofd } from "./tradelineInsights";
import { formatCents } from "./utils";

const TYPE_LABEL: Record<string, string> = {
  REVOLVING: "revolving account", INSTALLMENT: "installment loan", MORTGAGE: "mortgage",
  COLLECTION: "collection", CHARGE_OFF: "charge-off", STUDENT_LOAN: "student loan",
  PUBLIC_RECORD: "public record", INQUIRY: "inquiry", GOVERNMENT: "government / statutory debt", OTHER: "account",
};

export interface Explanation {
  confidence: Probability;
  observed: string[]; // what Kai observed on this item
  bureauContributions: { bureau: string; note: string }[]; // which bureau data contributed
  laws: { short: string; usc: string; desc: string }[]; // which laws influenced the read
  contradictions: string[]; // which cross-bureau contradictions raised confidence
  uncertainty: string[]; // what remains uncertain — stated, never hidden
}

export interface ExplainInput {
  accountType: AccountType;
  isDebtBuyer: boolean;
  balance: number;
  probability: Probability;
  reasons: string[];
  dateOfFirstDelinquency?: Date | string | null;
  bureauData: unknown;
  creditorName?: string | null;
  recommendedStrategy?: string | null;
}

export function explainTradeline(t: ExplainInput): Explanation {
  const data = getBureauData(t.bureauData);
  const present = presentBureaus(data);

  // Observed — the scoring engine's own rationale IS the observation record; we
  // surface it verbatim rather than re-derive (single source of truth).
  const observed: string[] = [`Classified as a ${TYPE_LABEL[t.accountType] ?? "account"}${t.isDebtBuyer ? " held by a debt buyer" : ""}.`];
  for (const r of t.reasons) observed.push(r);
  const fall = fallOffInsight(t);
  if (fall?.pastWindow) observed.push(`Past its FCRA §605 reporting window based on the first-delinquency date on file.`);
  else if (fall && fall.monthsRemaining <= 24) observed.push(`Its §605 reporting window ends around ${formatMonthYear(fall.fallOffDate)}.`);

  // Which bureau data contributed — each present bureau's own reported values.
  const bureauContributions = present.map((b) => {
    const f = data[b]!;
    const bits: string[] = [];
    if (f.status) bits.push(f.status);
    if (f.balanceCents != null) bits.push(formatCents(f.balanceCents));
    return { bureau: BUREAU_LABEL[b], note: bits.length ? bits.join(" · ") : "reporting this account" };
  });

  // Which laws influenced — the statutes behind the recommended strategy, plus
  // §605 whenever the obsolescence clock is in play. Never AI-invented law.
  const lawKeys = new Set<StatuteKey>();
  const strat = t.recommendedStrategy ? STRATEGY_BY_ID[t.recommendedStrategy] : undefined;
  if (strat) strat.statutes.forEach((k) => lawKeys.add(k));
  if (fall?.pastWindow) lawKeys.add("fcra_605");
  const laws = [...lawKeys].map((k) => ({ short: STATUTES[k].short, usc: STATUTES[k].usc, desc: STATUTES[k].desc }));

  // Contradictions that raised confidence — real cross-bureau conflicts only, and
  // never on a set-aside item (it wasn't flagged, so nothing "raised confidence").
  const contradictions = t.probability === "NOT_RECOMMENDED" ? [] : crossBureauConflicts(data);

  // Uncertainty — stated plainly, never hidden (this is the trust move).
  const uncertainty: string[] = [];
  const known = knownBureauCount(t.bureauData);
  if (known === 0) {
    // Never "this bureau" when there is no bureau: an account the report never
    // attributed has ZERO known bureaus, and `hasCrossBureauKnowledge` (< 2)
    // used to fold that case into the single-bureau sentence below.
    uncertainty.push("Your report didn't say which bureau reports this account, so nothing here is attributed to a bureau and no cross-bureau comparison was possible.");
  } else if (known === 1) {
    uncertainty.push("Only one bureau's data is on file, so this read is limited to that bureau's internal accuracy — no cross-bureau claims are made.");
  } else if (contradictions.length === 0) {
    uncertainty.push("The bureaus on file agree on this account, so the dispute rests on the item's own accuracy rather than a cross-bureau conflict.");
  }
  const dofd = reportedDofd(t);
  if (!dofd) {
    uncertainty.push("No date of first delinquency is on file, so the §605 reporting-window clock can't be computed for this item.");
  } else if (dofd.precision === "month") {
    uncertainty.push("The date of first delinquency is reported as a month, not a specific day, so the §605 window below is dated to the end of that month — the latest date the report supports.");
  }
  if (t.probability === "LOW") {
    uncertainty.push("Scored LOW — the grounds here are weaker; worth a look before spending a dispute round on it.");
  }
  if (t.probability === "NOT_RECOMMENDED") {
    uncertainty.push("Set aside — government / statutory debt generally can't be disputed off a report, so a round here is unlikely to help.");
  }

  return { confidence: t.probability, observed, bureauContributions, laws, contradictions, uncertainty };
}
