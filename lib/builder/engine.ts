// The Builder Engine — PURE over the CVI snapshot + CVI readiness (both already
// loaded on the dashboard). It recommends; it calculates no new intelligence and
// invents no data. Each recommendation cites the exact data point behind it, and
// modules whose inputs aren't on file return NOT_ENOUGH_INFO.
import type { IntelSnapshot } from "@/lib/intelligence";
import type { CreditIntelligence, ReadinessResult } from "@/lib/intelligence";
import type { BuilderOS, BuilderRecommendation, BuilderStatus } from "./types";
import { NOT_ENOUGH_INFO } from "./types";

function rec(r: Omit<BuilderRecommendation, "action"> & { action?: BuilderRecommendation["action"] }): BuilderRecommendation {
  return { action: null, ...r };
}
// A module whose required inputs aren't in the file — honest, never faked.
function unavailable(id: string, label: string, needs: string, evidence: string): BuilderRecommendation {
  return rec({ id, label, status: "unavailable", why: NOT_ENOUGH_INFO, currentProfile: "—", observed: evidence, expectedImprovement: NOT_ENOUGH_INFO, dependencies: needs, estimatedTiming: "—", evidence });
}

export function buildBuilder(s: IntelSnapshot, intel: CreditIntelligence): BuilderOS {
  const profileLine = `${s.totalAccounts} account${s.totalAccounts === 1 ? "" : "s"}, ${s.negatives} active negative${s.negatives === 1 ? "" : "s"}.`;
  const rd = (g: string): ReadinessResult | undefined => intel.readiness.find((r) => r.goal === g);
  const recs: BuilderRecommendation[] = [];

  // 1. Utilization Optimization — needs credit limits we don't receive.
  recs.push(unavailable("utilization", "Utilization optimization", "Credit-limit data (not in the parsed dispute report).", "Utilization: not tracked — the report carries balances but no credit limits."));

  // 2. Credit Builder Loans
  recs.push(rec({
    id: "builder_loan", label: "Credit-builder loans",
    status: s.installment === 0 ? "recommended" : "on_track",
    why: "A credit-builder loan reports on-time installment payments to the bureaus, adding payment history and a new account type to your mix.",
    currentProfile: profileLine, observed: s.installment === 0 ? "No installment accounts on file." : `${s.installment} installment account(s) on file.`,
    expectedImprovement: "Adds on-time installment history and diversifies credit mix (an account-type factor) — the effect builds as payments post.",
    dependencies: "Choose a lender that reports to all three bureaus.", estimatedTiming: "Payments typically report monthly over the loan term.",
    evidence: `installment accounts = ${s.installment}`, action: { text: "How builder loans work", href: "/help" },
  }));

  // 3. Secured Cards
  recs.push(rec({
    id: "secured_card", label: "Secured cards",
    status: s.revolving === 0 ? "recommended" : "on_track",
    why: "A secured card adds revolving history and, kept well below its limit, on-time payment history.",
    currentProfile: profileLine, observed: `${s.revolving} revolving account(s) on file.`,
    expectedImprovement: "Adds revolving history and on-time payments; a low reported balance models responsible use.",
    dependencies: "A refundable deposit; a card that reports to all three bureaus.", estimatedTiming: "Reports monthly.",
    evidence: `revolving accounts = ${s.revolving}`, action: { text: "How secured cards work", href: "/help" },
  }));

  // 4. CLI Opportunities — needs current limits/utilization.
  recs.push(unavailable("cli", "Credit-limit-increase opportunities", "Current credit limits + utilization (not in the parsed report).", "No credit-limit data on file, so a utilization-safe CLI can't be evaluated."));

  // 5. Tradeline Growth
  recs.push(rec({
    id: "tradeline_growth", label: "Tradeline growth",
    status: s.totalAccounts < 5 ? "recommended" : "on_track",
    why: "More positive, well-managed accounts strengthen a file over time.",
    currentProfile: profileLine, observed: `${s.totalAccounts} account(s) on file. Positive tradelines aren't imported from the dispute report, so this counts what we can see.`,
    expectedImprovement: "Additional on-time accounts add payment history and mix.",
    dependencies: "None.", estimatedTiming: "Builds over months of on-time history.",
    evidence: `total accounts = ${s.totalAccounts}`,
  }));

  // 6. Age of Accounts — avg age IS available.
  recs.push(s.avgAccountAgeYears == null
    ? unavailable("age", "Age of accounts", "Account open dates (missing on file).", "No account open-dates parsed, so average age can't be computed.")
    : rec({
      id: "age", label: "Age of accounts", status: s.avgAccountAgeYears >= 5 ? "on_track" : "in_progress",
      why: "Average account age is a scoring factor — older accounts help; new ones lower the average short-term.",
      currentProfile: profileLine, observed: `Average account age ~${s.avgAccountAgeYears} years.`,
      expectedImprovement: "Keeping your oldest accounts open preserves average age.",
      dependencies: "Don't close old accounts.", estimatedTiming: "Age accrues automatically over time.",
      evidence: `avg account age = ${s.avgAccountAgeYears}y`,
    }));

  // 7. Payment History — derogatory = collections + charge-offs + public records
  //    (the same definition CVI's health module uses; excluding public records
  //    would falsely read "on track" for a public-record-only file).
  const derog = s.collections + s.chargeOffs + s.publicRecords;
  recs.push(rec({
    id: "payment_history", label: "Payment history",
    status: derog > 0 ? "in_progress" : "on_track",
    why: "Payment history is the largest scoring factor; derogatory marks weigh most, and on-time history compounds.",
    currentProfile: profileLine, observed: `${s.collections} collection(s), ${s.chargeOffs} charge-off(s), ${s.publicRecords} public record(s). Month-by-month history isn't structured in the parsed report.`,
    expectedImprovement: "Resolving derogatory items and adding on-time accounts strengthens the payment-history picture.",
    dependencies: "Ongoing on-time payments.", estimatedTiming: "On-time history compounds monthly.",
    evidence: `collections=${s.collections}, charge-offs=${s.chargeOffs}, public-records=${s.publicRecords}`, action: derog > 0 ? { text: "Work the derogatory items", href: "/campaigns" } : null,
  }));

  // 8. Business Credit — future module, locked.
  recs.push(rec({ id: "business", label: "Business credit", status: "locked", why: "A future module — no business profile (entity/EIN/DUNS/vendors) is collected, and nothing is inferred or connected externally.", currentProfile: "—", observed: "No business data on file.", expectedImprovement: NOT_ENOUGH_INFO, dependencies: "The Business Credit module.", estimatedTiming: "When the module launches.", evidence: "business profile absent" }));

  // 9. Funding Preparation — reuse CVI readiness.
  const fundGoals = ["credit_card", "personal_loan", "auto"];
  const fundReady = fundGoals.some((g) => rd(g)?.level === "ready");
  const fundUnknown = fundGoals.every((g) => !rd(g) || rd(g)!.level === "unknown");
  recs.push(rec({
    id: "funding_prep", label: "Funding preparation", status: fundUnknown ? "unavailable" : fundReady ? "on_track" : "in_progress",
    why: fundUnknown ? NOT_ENOUGH_INFO : "Whether your file is in shape for personal / auto / card funding — this is readiness, not a lending decision.",
    currentProfile: profileLine, observed: ["credit_card", "personal_loan", "auto"].map((g) => `${rd(g)?.label ?? g}: ${rd(g)?.level ?? "unknown"}`).join("; "),
    expectedImprovement: "Clearing negatives and building positive history moves these toward ready.",
    dependencies: "Resolve blocking derogatory items.", estimatedTiming: "Improves as your open disputes resolve.",
    evidence: "CVI readiness engine", action: { text: "See readiness", href: "/dashboard" },
  }));

  // 10. Mortgage Preparation — reuse CVI readiness (strictest).
  const mort = rd("mortgage");
  recs.push(rec({
    id: "mortgage_prep", label: "Mortgage preparation", status: !mort || mort.level === "unknown" ? "unavailable" : mort.level === "ready" ? "on_track" : "in_progress",
    why: !mort || mort.level === "unknown" ? NOT_ENOUGH_INFO : "Mortgage readiness uses the strictest prerequisites; clearing collections/public records/charge-offs matters most. Readiness, not a lending decision.",
    currentProfile: profileLine, observed: (mort?.reasons ?? []).slice(0, 3).map((r) => r.text.replace(/^✓ /, "")).join("; ") || "No report on file.",
    expectedImprovement: "Each resolved derogatory item moves mortgage readiness forward.",
    dependencies: "No collections / public records / charge-offs; disputes resolved.", estimatedTiming: "Improves as open items resolve.",
    evidence: "CVI readiness (mortgage)", action: { text: "See readiness", href: "/dashboard" },
  }));

  // 11. Long-Term Maintenance
  const scoresLogged = s.scoreByBureau.length > 0;
  recs.push(rec({
    id: "maintenance", label: "Long-term maintenance", status: scoresLogged ? "on_track" : "recommended",
    why: "Keeping utilization low, paying on time, and tracking your scores maintains the gains you build.",
    currentProfile: profileLine, observed: scoresLogged ? `Scores logged for ${s.scoreByBureau.length} bureau(s).` : "No scores logged yet.",
    expectedImprovement: "Consistent monitoring catches regressions early.",
    dependencies: "Log scores periodically; keep payments on time.", estimatedTiming: "Ongoing.",
    evidence: `bureaus with scores = ${s.scoreByBureau.length}`, action: { text: "Track your scores", href: "/scores" },
  }));

  const recommendedCount = recs.filter((r) => r.status === "recommended").length;
  const onTrackCount = recs.filter((r) => r.status === "on_track").length;
  return {
    summary: s.hasReport
      ? `${recommendedCount} builder move${recommendedCount === 1 ? "" : "s"} recommended · ${onTrackCount} factor${onTrackCount === 1 ? "" : "s"} already on track.`
      : "Upload a report to build your Credit Builder plan.",
    recommendations: recs, recommendedCount, onTrackCount,
    note: "Every builder recommendation is deterministic and cites the data behind it — no promised score, no invented numbers.",
  };
}

// Statuses that read as "healthy" for a quick tally (used by the UI header).
export const HEALTHY_BUILDER: ReadonlySet<BuilderStatus> = new Set<BuilderStatus>(["on_track"]);
