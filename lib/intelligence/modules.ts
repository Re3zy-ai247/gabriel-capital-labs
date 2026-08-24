// The intelligence modules — each a PURE function over the loaded snapshot. No
// duplicated calculation, no new scoring, no AI, no fabrication. Where a credit
// report doesn't carry the data to answer (utilization needs credit limits we
// don't receive; payment-history detail isn't structured), the module discloses
// that honestly instead of inventing a number.
import type {
  IntelSnapshot,
} from "./snapshot";
import type {
  IntelligenceModule, Confidence, Metric, Reason, Action, ReadinessResult, RiskItem, Opportunity,
} from "./types";

const yrs = (n: number | null) => (n == null ? "—" : `${n} yr${n === 1 ? "" : "s"}`);

// Confidence = completeness of the evidence we have, never an outcome odds.
function conf(s: IntelSnapshot): Confidence {
  if (!s.hasReport) return "insufficient";
  if (s.respondedCount >= 3 || s.scoreByBureau.length > 0) return "high";
  if (s.completedInvestigations > 0) return "moderate";
  return "low";
}

// ---- Module 1: Credit Profile ---------------------------------------------
export function creditProfile(s: IntelSnapshot): IntelligenceModule {
  const metrics: Metric[] = [
    { key: "negatives", label: "Active negatives", value: String(s.negatives) },
    { key: "positives", label: "Verified positives on file", value: String(s.positives), note: s.positives === 0 ? "We parse derogatory items from your report; positive tradelines aren't imported yet." : undefined },
    { key: "open_inv", label: "Open investigations", value: String(s.openInvestigations) },
    { key: "done_inv", label: "Completed investigations", value: String(s.completedInvestigations) },
    { key: "fav_rate", label: "Favorable-change rate (your history)", value: s.favorableRate == null ? "—" : `${Math.round(s.favorableRate * 100)}%`, note: s.favorableRate == null ? "Builds once you log ≥1 bureau response." : `Across ${s.respondedCount} responded disputes — your record, not a prediction.` },
    { key: "oldest_derog", label: "Oldest derogatory", value: yrs(s.oldestDerogatoryYears) },
    { key: "youngest_derog", label: "Youngest derogatory", value: yrs(s.youngestDerogatoryYears) },
    { key: "avg_age", label: "Average account age", value: yrs(s.avgAccountAgeYears) },
    { key: "utilization", label: "Utilization", value: "Not tracked", note: "Credit-limit data isn't in the dispute report we parse, so utilization can't be computed here." },
  ];
  const reasons: Reason[] = [];
  if (s.negatives > 0) reasons.push({ text: `${s.negatives} unresolved negative item${s.negatives === 1 ? "" : "s"} on file.`, evidence: "Parsed from your uploaded report." });
  if (s.openInvestigations > 0) reasons.push({ text: `${s.openInvestigations} dispute${s.openInvestigations === 1 ? " is" : "s are"} in reinvestigation.`, evidence: "Mailed letters awaiting a bureau response." });
  const actions: Action[] = [];
  if (s.disputable > 0) actions.push({ text: `Plan a focused campaign for ${s.disputable} disputable item${s.disputable === 1 ? "" : "s"}.`, href: "/campaigns" });
  return {
    summary: s.hasReport
      ? `${s.negatives} active negative${s.negatives === 1 ? "" : "s"}, ${s.openInvestigations} open and ${s.completedInvestigations} completed investigation${s.completedInvestigations === 1 ? "" : "s"}.`
      : "No report on file yet — upload one to build your profile.",
    metrics, reasons, recommendedActions: actions, confidence: conf(s), history: s.ownHistoryLine,
    nextSteps: s.hasReport ? ["Review your campaign plan", "Log any bureau responses to sharpen your history"] : ["Upload a credit report"],
  };
}

// ---- Module 2: Credit Health ----------------------------------------------
export function creditHealth(s: IntelSnapshot): IntelligenceModule {
  const derogPresent = s.collections + s.chargeOffs + s.publicRecords;
  const mix = [s.revolving && "revolving", s.installment && "installment", s.mortgage && "mortgage", s.studentLoans && "student loans"].filter(Boolean);
  const metrics: Metric[] = [
    { key: "payment_history", label: "Payment history", value: derogPresent > 0 ? "Derogatory marks present" : s.hasReport ? "No derogatory marks parsed" : "—", note: "Detailed month-by-month history isn't structured in the parsed report." },
    { key: "utilization", label: "Utilization", value: "Not tracked", note: "Requires credit limits, which aren't in the parsed report." },
    { key: "age", label: "Account age", value: yrs(s.avgAccountAgeYears) },
    { key: "mix", label: "Credit mix", value: mix.length ? mix.join(", ") : "—" },
    { key: "inquiries", label: "Inquiries", value: String(s.inquiries) },
    { key: "collections", label: "Collections", value: String(s.collections) },
    { key: "chargeoffs", label: "Charge-offs", value: String(s.chargeOffs) },
    { key: "public_records", label: "Public records", value: String(s.publicRecords) },
  ];
  const reasons: Reason[] = [];
  if (s.collections > 0) reasons.push({ text: "Collections weigh heavily and are often disputable when a collector can't validate the debt.", evidence: `${s.collections} collection account${s.collections === 1 ? "" : "s"} on file.` });
  if (s.chargeOffs > 0) reasons.push({ text: "Charge-offs frequently carry reporting errors in status/balance/dates.", evidence: `${s.chargeOffs} charge-off${s.chargeOffs === 1 ? "" : "s"} on file.` });
  if (s.publicRecords > 0) reasons.push({ text: "Public records have strict reporting-window rules under §605.", evidence: `${s.publicRecords} public record${s.publicRecords === 1 ? "" : "s"} on file.` });
  const actions: Action[] = derogPresent > 0 ? [{ text: "Challenge the strongest-grounded derogatory items first.", href: "/campaigns" }] : [];
  return {
    summary: s.hasReport ? `${derogPresent} derogatory mark${derogPresent === 1 ? "" : "s"} across collections, charge-offs, and public records.` : "Upload a report to generate your health report.",
    metrics, reasons, recommendedActions: actions, confidence: conf(s), history: s.ownHistoryLine,
    nextSteps: derogPresent > 0 ? ["Open a focused campaign on the strongest items"] : s.hasReport ? ["Keep monitoring; log score updates"] : ["Upload a credit report"],
  };
}

// ---- Module 6: Risk Analysis ----------------------------------------------
export function riskAnalysis(s: IntelSnapshot): IntelligenceModule {
  const risks: RiskItem[] = [];
  if (s.totalAccounts > 0 && s.totalAccounts < 3) risks.push({ key: "thin_file", severity: "medium", title: "Thin file", evidence: `${s.totalAccounts} account${s.totalAccounts === 1 ? "" : "s"} parsed.`, recommendedAction: "A thin file limits options; adding on-time positive history helps over time." });
  if (s.chargeOffs > 0) risks.push({ key: "chargeoffs", severity: "high", title: "Charge-offs present", evidence: `${s.chargeOffs} on file.`, recommendedAction: "Dispute inaccurate status/balance/dates under §611." });
  if (s.collections > 0) risks.push({ key: "collections", severity: "high", title: "Collections present", evidence: `${s.collections} on file.`, recommendedAction: "Demand validation (FDCPA §1692g) before anything else." });
  if (s.duplicateGroups > 0) risks.push({ key: "duplicates", severity: "medium", title: "Duplicate-looking debts", evidence: `${s.duplicateGroups} group${s.duplicateGroups === 1 ? "" : "s"} of the same debt reported more than once.`, recommendedAction: "Dispute them together as one story, not conflicting separate letters." });
  if (s.overdueWindows > 0) risks.push({ key: "overdue", severity: "high", title: "Response window(s) overdue", evidence: `${s.overdueWindows} mailed dispute${s.overdueWindows === 1 ? "" : "s"} past the ~30-day §611 window.`, recommendedAction: "Log the response or escalate — a non-answer doesn't satisfy §611." });
  if (s.openInvestigations > 0 && s.disputable > s.openInvestigations && s.overdueWindows === 0) risks.push({ key: "frivolous", severity: "low", title: "Avoid over-disputing at once", evidence: `${s.disputable} disputable with ${s.openInvestigations} already open.`, recommendedAction: "Sequence into focused campaigns; a CRA may decline disputes it deems frivolous or irrelevant (§611(a)(3)) — a case-by-case call, not a headcount." });
  // Highest severity first, so consumers (e.g. the "top signal" line) get the
  // most important risk at index 0 — not push order.
  const SEV = { high: 0, medium: 1, low: 2 } as const;
  risks.sort((a, b) => SEV[a.severity] - SEV[b.severity]);
  const reasons: Reason[] = risks.map((r) => ({ text: `${r.title} — ${r.recommendedAction}`, evidence: r.evidence }));
  return {
    summary: risks.length ? `${risks.length} risk signal${risks.length === 1 ? "" : "s"} identified from your file.` : s.hasReport ? "No elevated risk signals from the parsed data." : "Upload a report to analyze risk.",
    metrics: [{ key: "risk_count", label: "Risk signals", value: String(risks.length) }, { key: "high", label: "High-severity", value: String(risks.filter((r) => r.severity === "high").length) }],
    reasons, recommendedActions: risks.slice(0, 3).map((r) => ({ text: r.recommendedAction, href: "/campaigns" })),
    confidence: conf(s), history: s.ownHistoryLine, nextSteps: risks.length ? ["Address high-severity items in your next campaign"] : [],
  };
}

// ---- Module 4: Opportunity Engine -----------------------------------------
export function opportunities(s: IntelSnapshot): Opportunity[] {
  const out: Opportunity[] = [];
  if (s.round2Ready > 0) out.push({ key: "round2", title: "Round 2 ready", detail: `${s.round2Ready} logged response${s.round2Ready === 1 ? "" : "s"} can be escalated.`, href: "/letters", kind: "dispute" });
  if (s.overdueWindows > 0) out.push({ key: "overdue", title: "Open bureau deadline passed", detail: `${s.overdueWindows} window${s.overdueWindows === 1 ? "" : "s"} overdue — log or escalate.`, href: "/letters", kind: "deadline" });
  const upcoming = s.openWindows.filter((w) => w.daysLeft > 0)[0];
  if (upcoming) out.push({ key: "deadline", title: "Upcoming response deadline", detail: `${upcoming.recipient}: ${upcoming.daysLeft} day${upcoming.daysLeft === 1 ? "" : "s"} left.`, href: "/mail", kind: "deadline" });
  if (s.obsoleteOpportunities > 0) out.push({ key: "obsolete", title: "Obsolete-item dispute (§605)", detail: `${s.obsoleteOpportunities} item${s.obsoleteOpportunities === 1 ? " is" : "s are"} past their §605 reporting window — a clean obsolescence ground.`, href: "/campaigns", kind: "dispute" });
  if (s.collections > 0) out.push({ key: "validation", title: "Debt-validation opportunity", detail: `${s.collections} collection${s.collections === 1 ? "" : "s"} to challenge under §1692g.`, href: "/campaigns", kind: "dispute" });
  if (s.disputable > 0) out.push({ key: "campaign", title: "Campaign ready", detail: `${s.disputable} disputable item${s.disputable === 1 ? "" : "s"} to sequence.`, href: "/campaigns", kind: "campaign" });
  if (!s.addressComplete && s.hasReport) out.push({ key: "address", title: "Complete your mailing address", detail: "Needed to mail disputes for you.", href: "/settings", kind: "profile" });
  if (s.totalAccounts > 0 && s.totalAccounts < 3) out.push({ key: "builder", title: "Builder opportunity", detail: "A thin file benefits from added on-time positive history.", href: "/dashboard", kind: "builder" });
  return out;
}

// ---- Module 5: Timeline Intelligence --------------------------------------
export function timelineIntel(s: IntelSnapshot): { past: string[]; present: string[]; upcoming: string[] } {
  const LABEL: Record<string, (p: Record<string, unknown>) => string> = {
    "report.uploaded": () => "Uploaded a credit report",
    "report.analyzed": (p) => `Analyzed the report (${String(p.tradelines ?? "")} accounts)`,
    "letter.generated": () => "Generated a dispute letter",
    "letter.mailed": (p) => `Mailed Round ${String(p.round ?? "")} to ${String(p.recipient ?? "the bureau")}`,
    "response.received": (p) => `Logged a response (${String(p.outcome ?? "recorded")})`,
    "dispute.resolved": () => "Marked an item resolved",
    "campaign.approved": (p) => `Approved Campaign ${String(p.sequence ?? "")}`,
    "campaign.active": (p) => `Campaign ${String(p.sequence ?? "")} underway`,
  };
  const past = s.recentEvents.map((e) => LABEL[e.type]?.(e.payload)).filter((x): x is string => Boolean(x)).slice(0, 6);
  const present: string[] = [];
  if (s.openInvestigations > 0) present.push(`${s.openInvestigations} reinvestigation${s.openInvestigations === 1 ? "" : "s"} in progress`);
  if (s.overdueWindows > 0) present.push(`${s.overdueWindows} response window${s.overdueWindows === 1 ? "" : "s"} overdue`);
  const upcoming: string[] = [];
  for (const w of s.openWindows.filter((w) => w.daysLeft > 0).slice(0, 3)) upcoming.push(`${w.recipient} response due in ~${w.daysLeft} day${w.daysLeft === 1 ? "" : "s"} (§611)`);
  if (s.obsoleteOpportunities > 0) upcoming.push(`${s.obsoleteOpportunities} item${s.obsoleteOpportunities === 1 ? " is" : "s are"} past their §605 reporting window — a clean obsolescence ground`);
  return { past, present, upcoming };
}

// ---- Module 3 + 7 + 9: Readiness engine (credit / funding / business) ------
type Check = { label: string; ok: boolean; hard: boolean; reason: string };
function evaluate(goal: string, label: string, checks: Check[], s: IntelSnapshot, timelineNote: string): ReadinessResult {
  if (!s.hasReport) return { goal, label, level: "unknown", reasons: [{ text: "No accounts have been read from your report yet." }], nextActions: [{ text: "Upload a credit report", href: "/upload" }], estimatedTimeline: "Unknown until a report is uploaded", confidence: "insufficient" };
  const failed = checks.filter((c) => !c.ok);
  const hardFails = failed.filter((c) => c.hard).length;
  const level: ReadinessResult["level"] = hardFails > 0 ? "not_ready" : failed.length > 0 ? "almost" : "ready";
  return {
    goal, label, level,
    reasons: (failed.length ? failed : checks).map((c) => ({ text: `${c.ok ? "✓ " : ""}${c.reason}` })),
    nextActions: failed.length ? [{ text: "Resolve the items above via a focused campaign", href: "/campaigns" }] : [{ text: "Keep your file clean and monitor", href: "/dashboard" }],
    estimatedTimeline: timelineNote,
    confidence: conf(s),
  };
}

export function readiness(s: IntelSnapshot): ReadinessResult[] {
  const openWin = s.openWindows.filter((w) => w.daysLeft > 0).map((w) => w.daysLeft);
  const timelineNote = openWin.length ? `≈${Math.max(...openWin)} days until your current response windows close (§611)` : s.disputable > 0 ? "Improves as you work through your open items" : "No blocking disputes on file";
  const noColl: Check = { label: "collections", ok: s.collections === 0, hard: true, reason: s.collections === 0 ? "No collections on file" : `${s.collections} collection(s) to resolve` };
  const noPub: Check = { label: "public", ok: s.publicRecords === 0, hard: true, reason: s.publicRecords === 0 ? "No public records" : `${s.publicRecords} public record(s) present` };
  const noCO: Check = { label: "chargeoff", ok: s.chargeOffs === 0, hard: false, reason: s.chargeOffs === 0 ? "No charge-offs" : `${s.chargeOffs} charge-off(s) present` };
  const cleanNeg: Check = { label: "negatives", ok: s.negatives === 0, hard: false, reason: s.negatives === 0 ? "No unresolved negatives" : `${s.negatives} unresolved negative(s)` };
  const notThin: Check = { label: "thin", ok: s.totalAccounts >= 3, hard: false, reason: s.totalAccounts >= 3 ? "File has enough history" : "Thin file — more positive history helps" };
  const noOpen: Check = { label: "open", ok: s.openInvestigations === 0, hard: false, reason: s.openInvestigations === 0 ? "No disputes pending" : `${s.openInvestigations} dispute(s) still in reinvestigation` };

  return [
    evaluate("mortgage", "Mortgage readiness", [noColl, noPub, noCO, cleanNeg, notThin, noOpen], s, timelineNote),
    evaluate("auto", "Auto-loan readiness", [noColl, cleanNeg, notThin], s, timelineNote),
    evaluate("personal_loan", "Personal-loan readiness", [cleanNeg, noPub], s, timelineNote),
    evaluate("credit_card", "Credit-card readiness", [cleanNeg], s, timelineNote),
    evaluate("rental", "Rental readiness", [noColl, cleanNeg], s, timelineNote),
    evaluate("employment", "Employment-screening readiness", [noPub, noColl], s, timelineNote),
    // Business funding needs a business profile we don't hold — honest unknown.
    { goal: "business_funding", label: "Business-funding readiness", level: "unknown", reasons: [{ text: "Business-credit data (entity, EIN, DUNS, vendor accounts) isn't on file yet." }], nextActions: [{ text: "Business Credit is a future module — nothing to connect externally today.", href: "/dashboard" }], estimatedTimeline: "Available when the Business Credit module launches", confidence: "insufficient" },
  ];
}

// ---- Module 8: Builder Intelligence ---------------------------------------
export function builderIntelligence(s: IntelSnapshot): IntelligenceModule {
  const reasons: Reason[] = [];
  const actions: Action[] = [];
  if (s.positives === 0) { reasons.push({ text: "No positive tradelines are imported, so on-time history isn't reflected here.", evidence: "The parser focuses on derogatory items." }); }
  if (s.totalAccounts < 3) { reasons.push({ text: "A thin file benefits most from adding on-time positive accounts.", evidence: `${s.totalAccounts} account(s) on file.` }); actions.push({ text: "Consider a secured card or credit-builder account that reports to all three bureaus." }); }
  reasons.push({ text: "Utilization improvements can't be quantified here — credit-limit data isn't in the parsed report.", evidence: "Utilization: not tracked." });
  return {
    summary: s.hasReport ? "Builder opportunities are based on file thinness and reporting gaps." : "Upload a report to assess builder opportunities.",
    metrics: [{ key: "accounts", label: "Accounts on file", value: String(s.totalAccounts) }, { key: "positives", label: "Positive tradelines", value: String(s.positives) }],
    reasons, recommendedActions: actions, confidence: s.hasReport ? "moderate" : "insufficient", history: s.ownHistoryLine,
    nextSteps: ["Credit Builder is a future module; these are the deterministic gaps it will target."],
  };
}

// ---- Module 9: Business Credit Readiness (honest scaffold) -----------------
export function businessReadiness(s: IntelSnapshot): IntelligenceModule {
  return {
    summary: "Business Credit is a future module — no external connections today.",
    metrics: [
      { key: "entity", label: "Entity status", value: "Unknown", note: "Not collected yet." },
      { key: "ein", label: "EIN", value: "Unknown", note: "Not collected yet." },
      { key: "duns", label: "DUNS readiness", value: "Unknown", note: "Not collected yet." },
      { key: "vendor", label: "Vendor readiness", value: "Unknown", note: "Not collected yet." },
    ],
    reasons: [{ text: "Business-credit readiness needs an entity/EIN/DUNS/vendor profile CreditVector doesn't hold. Nothing is inferred or connected externally." }],
    recommendedActions: [], confidence: "insufficient", history: null,
    nextSteps: ["Prerequisites will be captured when the Business Credit module launches."],
  };
}

// Coarse, honest overall readiness band for the profile summary (no fake score).
export function estimatedReadinessBand(s: IntelSnapshot): "Not ready" | "Building" | "Strong" | "Unknown" {
  if (!s.hasReport) return "Unknown";
  if (s.overdueWindows > 0 || s.negatives >= 5) return "Not ready";
  if (s.negatives === 0) return "Strong";
  return "Building";
}
