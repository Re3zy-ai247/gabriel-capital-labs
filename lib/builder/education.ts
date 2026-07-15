// Credit Builder — educational planners (Sprint XXI, Phase 2). The Builder Engine
// already produces data-driven recommendations where the file supports them and
// marks the rest NOT_ENOUGH_INFO. This layer adds the EDUCATIONAL planning tools the
// directive asked for — and draws a hard line the founder set: each planner is
// labelled either "Educational guidance" (explains how a factor works) or "Data-
// driven" (a point computed from the user's real file). It NEVER infers a number,
// NEVER estimates utilization, NEVER estimates a score. When the underlying data
// (limits, statement dates, month-by-month history) isn't on file, the planner stays
// educational — it upgrades itself to data-driven automatically when the data exists.
import type { IntelSnapshot } from "@/lib/intelligence";

export type PlannerKind = "educational" | "data-driven";

export interface BuilderPlanner {
  id: string;
  title: string;
  kind: PlannerKind;
  guidance: string[];          // how the factor works — educational, never a promise
  fromYourFile: string | null; // a real, cited data point — present only when computable
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function builderPlanners(s: IntelSnapshot): BuilderPlanner[] {
  const p: BuilderPlanner[] = [];

  // 1. Utilization — we receive balances but NOT credit limits, so utilization can't
  //    be computed. Educational only; never estimated. (utilizationTracked === false)
  p.push({
    id: "utilization", title: "Utilization", kind: "educational", fromYourFile: null,
    guidance: [
      "Utilization is your reported balance divided by your credit limit — one of the largest scoring factors.",
      "A common target is to keep each card and your overall usage below 30%, and below 10% is stronger.",
      "The balance that reports is usually your statement balance, so paying down before the statement date lowers what's reported.",
      "CreditVector doesn't receive your credit limits from a dispute report, so we show guidance here rather than a computed number.",
    ],
  });

  // 2. Payment timing — educational; we don't have due/statement dates.
  p.push({
    id: "payment_timing", title: "Payment timing", kind: "educational", fromYourFile: null,
    guidance: [
      "Two different dates matter: the statement (closing) date sets the balance that gets reported, and the due date sets whether you're late.",
      "Paying the full statement balance by the due date avoids interest; paying before the statement date lowers the reported balance.",
      "Autopay for at least the minimum protects your payment history — the largest scoring factor.",
    ],
  });

  // 3. Account aging — avg age IS on file when open dates were parsed.
  p.push(s.avgAccountAgeYears != null
    ? { id: "aging", title: "Account aging", kind: "data-driven", fromYourFile: `Average account age on file: ~${s.avgAccountAgeYears} year${s.avgAccountAgeYears === 1 ? "" : "s"}.`,
        guidance: ["Older accounts help your average age; new accounts lower it in the short term.", "Keeping your oldest accounts open preserves length of history.", "Age accrues automatically — time is the only input."] }
    : { id: "aging", title: "Account aging", kind: "educational", fromYourFile: null,
        guidance: ["Average account age is a scoring factor — older is better.", "No account open-dates were parsed from your report, so this stays educational until that data is available."] });

  // 4. Credit mix — revolving/installment counts ARE on file.
  p.push({
    id: "mix", title: "Credit mix", kind: "data-driven",
    fromYourFile: `On file: ${plural(s.revolving, "revolving account")}, ${plural(s.installment, "installment account")}, ${plural(s.mortgage, "mortgage")}.`,
    guidance: [
      "Scoring models reward a healthy mix of revolving (cards) and installment (loans) accounts.",
      "You don't need every type — mix is a minor factor next to payment history and utilization.",
      "A credit-builder loan or secured card can add a missing type as it reports.",
    ],
  });

  // 5. Inquiry aging — inquiry count IS on file.
  p.push({
    id: "inquiries", title: "Inquiry aging", kind: "data-driven",
    fromYourFile: `${plural(s.inquiries, "inquiry", "inquiries")} on file.`,
    guidance: [
      "A hard inquiry typically affects scores for about 12 months and drops off the report at about 24 months.",
      "Rate-shopping for one loan in a short window is usually treated as a single inquiry.",
      "Only inquiries you don't recognize are worth disputing — recognized applications are accurate.",
    ],
  });

  // 6. Revolving vs installment — counts on file; behavior education.
  p.push({
    id: "revolving_installment", title: "Revolving vs installment", kind: "data-driven",
    fromYourFile: `${plural(s.revolving, "revolving")} · ${plural(s.installment, "installment")} on file.`,
    guidance: [
      "Revolving accounts (cards) carry utilization — the balance you carry vs your limit matters every month.",
      "Installment accounts (loans) amortize on a fixed schedule; their impact comes from on-time payments, not utilization.",
      "Both build payment history; only revolving is sensitive to how much of the limit you use.",
    ],
  });

  // 7. Authorized users — educational (no data on file).
  p.push({
    id: "authorized_user", title: "Authorized users", kind: "educational", fromYourFile: null,
    guidance: [
      "Being added as an authorized user on a well-aged, low-utilization account can add that history to your file.",
      "It only helps if the issuer reports authorized users to the bureaus and the primary account stays in good standing.",
      "The primary holder's late payment or high balance can also flow to you — choose the account carefully.",
    ],
  });

  // 8. Statement dates — educational (no data on file).
  p.push({
    id: "statement_dates", title: "Statement dates", kind: "educational", fromYourFile: null,
    guidance: [
      "The balance reported to the bureaus is usually your balance on the statement (closing) date, not the due date.",
      "Paying down before the statement date is how you lower the utilization that gets reported.",
      "You can ask an issuer for your statement date to plan payments around it.",
    ],
  });

  return p;
}
