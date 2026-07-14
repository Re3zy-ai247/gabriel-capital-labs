// Engine 2 — Recommendation + Evidence (Sprint X, ADR-0010). Turns the
// deterministic strategy recommendation into an explained, evidence-backed
// decision: why this strategy, why this bureau, why now, alternatives, expected
// timeline, next step, and a confidence in the GROUNDS (never in the outcome).
// Everything derives from the item's OWN data + the existing rule engines
// (recommend/scoring/statutes/obsolescence/explain) — no AI, no cross-user data.
//
// Historical support (cross-user aggregate) is the ONLY part that touches Engine 1
// stats, and it is GATED: shown only when the stats clear k-anonymity AND a CCO
// sign-off has approved consumer display. Until then it returns an honest
// "still gathering data" — never a fabricated or thin number.
import type { AccountType, Probability } from "@prisma/client";
import { recommendStrategy } from "./recommend";
import { STRATEGY_BY_ID, STRATEGIES } from "./strategies";
import { STATUTES } from "./statutes";
import { explainTradeline, type ExplainInput } from "./explain";
import { getBureauData, presentBureaus, crossBureauConflicts } from "./bureauData";
import { BUREAU_LABEL } from "./bureaus";
import { fallOffInsight, formatMonthYear } from "./tradelineInsights";
import { REINVESTIGATION_DAYS } from "./forecast";
import { rankStrategiesByHistory, K_ANON_MIN, type OutcomeStats } from "./outcomeStats";

export interface IntelInput extends ExplainInput {
  accountType: AccountType;
  isDebtBuyer: boolean;
  probability: Probability;
}

export type HistoricalSupport =
  | { available: true; lines: string[]; sample: number }
  | { available: false; reason: string };

export interface RecommendationIntel {
  strategy: { id: string; label: string } | null;
  whyStrategy: string;
  whyBureau: string | null;
  whyNow: string;
  alternatives: { id: string; label: string; note: string }[];
  whyNotAlternatives: string[];
  evidence: string[];
  expectedTimeline: string;
  recommendedNextStep: string;
  caseConfidence: { label: "Strong" | "Moderate" | "Building"; basis: string };
  historicalSupport: HistoricalSupport;
}

const CONFIDENCE: Record<Probability, { label: "Strong" | "Moderate" | "Building"; note: string }> = {
  HIGH: { label: "Strong", note: "multiple deterministic signals line up on this item" },
  MEDIUM: { label: "Moderate", note: "there's a real basis, with fewer signals stacked" },
  LOW: { label: "Building", note: "the grounds are thin — worth a look before spending a round" },
  NOT_RECOMMENDED: { label: "Building", note: "set aside — a dispute here is unlikely to help" },
};

// Options for gating the cross-user historical panel. Both must be true to show
// real aggregates to a consumer (INTELLIGENCE-LAYER.md gates).
export interface IntelOptions {
  stats?: OutcomeStats | null;
  consumerDisplayApproved?: boolean; // CCO sign-off flag (env/config; false today)
}

export function recommendationIntel(t: IntelInput, opts: IntelOptions = {}): RecommendationIntel {
  const rec = recommendStrategy({
    accountType: t.accountType, isDebtBuyer: t.isDebtBuyer, probability: t.probability,
    dateOfFirstDelinquency: t.dateOfFirstDelinquency, bureauData: t.bureauData, creditorName: t.creditorName,
  });
  const strat = rec.strategyId ? STRATEGY_BY_ID[rec.strategyId] : undefined;
  const data = getBureauData(t.bureauData);
  const present = presentBureaus(data);
  const conflicts = crossBureauConflicts(data);
  const fall = fallOffInsight(t);
  const explanation = explainTradeline(t);

  // Why this bureau — deterministic, from which bureaus actually report the item.
  let whyBureau: string | null = null;
  if (strat?.recipient === "bureau") {
    if (present.length > 1) {
      whyBureau = `${present.map((b) => BUREAU_LABEL[b]).join(", ")} each report this account, so the §611 reinvestigation is sent to every bureau on file${conflicts.length ? " — and they don't agree, which is the strongest lever" : ""}.`;
    } else if (present.length === 1) {
      whyBureau = `Only ${BUREAU_LABEL[present[0]]} reports this on file, so the dispute goes there.`;
    }
  } else if (strat) {
    whyBureau = `This goes directly to the ${strat.recipient === "collector" ? "collector" : "furnisher"}, not a bureau — the ${strat.recipient} owns the accuracy of what it furnishes.`;
  }

  // Why now — the timing signal (obsolescence clock or freshness).
  let whyNow: string;
  if (fall?.pastWindow) whyNow = "Now — this item is past its FCRA §605 reporting window, so obsolescence is the cleanest ground and the clock is already in your favor.";
  else if (fall && fall.monthsRemaining <= 24) whyNow = `Soon matters — its §605 window ends around ${formatMonthYear(fall.fallOffDate)}; disputing accuracy now keeps options open before then.`;
  else whyNow = "Now — the accuracy of what's reported is disputable at any time under the FCRA; there's no benefit to waiting.";

  // Alternatives — other applicable strategies for this recipient/context, with a
  // deterministic reason each exists.
  const alternatives = STRATEGIES
    .filter((s) => s.id !== rec.strategyId && s.recipient === (strat?.recipient ?? "bureau") && s.tier <= 3)
    .slice(0, 3)
    .map((s) => ({ id: s.id, label: s.label, note: s.blurb }));

  const whyNotAlternatives: string[] = [];
  if (strat) {
    if (rec.strategyId === "validation")
      whyNotAlternatives.push("A plain §611 accuracy dispute skips the collector's burden to prove it owns the debt — validation puts that burden first.");
    if (fall?.pastWindow && rec.strategyId !== "fcra_605")
      whyNotAlternatives.push("Obsolescence (§605) is also available here, but the chosen angle is stronger or faster for this item.");
    if (rec.strategyId === "fcra_611" && !conflicts.length)
      whyNotAlternatives.push("A cross-bureau inconsistency angle isn't used because the bureaus on file agree — the dispute rests on this item's own accuracy.");
  }

  // Expected timeline — the statutory window, recipient-correct.
  const expectedTimeline = strat?.recipient === "bureau"
    ? `Bureaus owe a reinvestigation within ~${REINVESTIGATION_DAYS} days of receiving a mailed dispute (§611). If you send more information mid-review, they may take up to 45.`
    : strat?.recipient === "collector"
      ? "A collector must validate the debt before continuing to collect (FDCPA §1692g); there's no fixed bureau clock."
      : "A furnisher must investigate a direct dispute (§623); keep your proof of mailing and follow up if you don't hear back.";

  const recommendedNextStep = strat
    ? `Generate the ${strat.label} and mail it — the response clock starts when it's received.`
    : "This item is set aside; no dispute is recommended.";

  const conf = CONFIDENCE[t.probability];

  // Historical support — GATED. Real aggregate only when it clears k-anonymity AND
  // a CCO sign-off approved consumer display; otherwise the honest gathering state.
  let historicalSupport: HistoricalSupport;
  const ranked = opts.stats ? rankStrategiesByHistory(opts.stats) : null;
  const cell = ranked?.find((r) => r.strategy === rec.strategyId);
  if (opts.consumerDisplayApproved && cell && cell.responded >= K_ANON_MIN) {
    historicalSupport = {
      available: true, sample: cell.responded,
      lines: [`Of ${cell.responded} past disputes using this approach that got a response, the item was changed or removed in ${Math.round(cell.favorableRate * 100)}% — a historical pattern, not a prediction of your result.`],
    };
  } else {
    historicalSupport = {
      available: false,
      reason: "CreditVector is still gathering enough completed, anonymized disputes to show platform-wide patterns. Until then, this recommendation rests on the statutes and your own file.",
    };
  }

  return {
    strategy: strat ? { id: strat.id, label: strat.label } : null,
    whyStrategy: rec.reason,
    whyBureau,
    whyNow,
    alternatives,
    whyNotAlternatives,
    evidence: explanation.observed,
    expectedTimeline,
    recommendedNextStep,
    caseConfidence: { label: conf.label, basis: `Confidence in the dispute GROUNDS (not the outcome): ${conf.note}.` },
    historicalSupport,
  };
}

// Statute reference for a strategy (for a "laws" chip row), deterministic.
export function strategyStatutes(strategyId: string | null): { short: string; usc: string }[] {
  const s = strategyId ? STRATEGY_BY_ID[strategyId] : undefined;
  if (!s) return [];
  return s.statutes.map((k) => ({ short: STATUTES[k].short, usc: STATUTES[k].usc }));
}
