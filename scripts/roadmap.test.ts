// Guards for the Financial Roadmap Engine (Sprint XVII). Pure — no DB.
// Run: npx tsx scripts/roadmap.test.ts
import { buildRoadmap } from "../lib/roadmap";
import type { CreditIntelligence, IntelligenceModule, ReadinessResult, ReadinessLevel } from "../lib/intelligence";
import type { FinancialMission } from "../lib/missionEngine";
import type { MissionControlData } from "../lib/missionControl";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

const mod = (metrics: { key: string; value: string }[] = []): IntelligenceModule =>
  ({ summary: "3 active negatives, 1 open and 2 completed investigations.", metrics: metrics.map((m) => ({ ...m, label: m.key })), reasons: [], recommendedActions: [], confidence: "high", history: null, nextSteps: [] });

const readi = (goal: string, level: ReadinessLevel): ReadinessResult =>
  ({ goal, label: `${goal} readiness`, level, reasons: [{ text: level === "ready" ? "✓ No collections" : "1 collection to resolve" }], nextActions: [], estimatedTimeline: "n/a", confidence: "high" });

function intel(over: Partial<CreditIntelligence> = {}): CreditIntelligence {
  return {
    generatedAtNote: "", hasReport: true,
    profile: mod([{ key: "negatives", value: "3" }, { key: "done_inv", value: "2" }, { key: "open_inv", value: "1" }, { key: "fav_rate", value: "50%" }]),
    health: mod(), risk: mod(), opportunities: [{ key: "campaign", title: "Campaign ready", detail: "", href: "/campaigns", kind: "campaign" }],
    readiness: [readi("mortgage", "not_ready"), readi("credit_card", "ready"), readi("personal_loan", "not_ready"), readi("auto", "not_ready"), readi("business_funding", "unknown")],
    builder: mod(), business: mod(), timeline: { past: ["Mailed Round 1 to Equifax"], present: [], upcoming: [] }, ...over,
  };
}
const mission = (types: string[] = ["approve_campaign"]): FinancialMission =>
  ({ queue: types.map((type) => ({ type })), waiting: [], automatic: [], timeline: [], completed: [], rewards: [], progress: {} } as unknown as FinancialMission);
function mc(over: Partial<MissionControlData> = {}): MissionControlData {
  return { firstName: "R", caseMemory: null, overnight: [], tasks: [], waiting: [], automatic: [], nextAction: null, nextUnlock: null,
    command: [{ key: "scores", title: "", stat: "+20 pts", sub: "", href: "/scores", tone: "green" }], capacity: null, deferred: [], health: [], caseHealth: "green", hasReport: true, ownHistory: null, ...over } as MissionControlData;
}
const stage = (r: ReturnType<typeof buildRoadmap>, id: string) => r.stages.find((s) => s.id === id);

// ---- no report → single stage ----
{
  const r = buildRoadmap(intel({ hasReport: false }), mission([]), mc({ hasReport: false }));
  ok("no report → one stage", r.stages.length === 1 && r.stages[0].id === "current_state");
  ok("no report → progress 0", r.progressPct === 0);
}

// ---- full journey ----
{
  const r = buildRoadmap(intel(), mission(), mc({ waiting: [{ recipient: "Experian", daysLeft: 18, text: "x", href: "/letters" }] }));
  ok("12 stages on a full file", r.stages.length === 12);
  ok("current_state is the anchor (current)", stage(r, "current_state")!.status === "current");
  ok("utilization is honestly unavailable", stage(r, "utilization")!.status === "unavailable");
  ok("business credit is a locked future module", stage(r, "business_credit")!.status === "locked");
  ok("mortgage readiness reflects not_ready → upcoming", stage(r, "mortgage_readiness")!.status === "upcoming");
  ok("waiting stage is 'waiting' with an open window", stage(r, "waiting")!.status === "waiting");
  ok("responses stage active with logged responses", stage(r, "responses")!.status === "active");
  ok("verified outcomes active with a favorable rate", stage(r, "verified_outcomes")!.status === "active");
  ok("funding readiness active (credit_card ready)", stage(r, "funding_readiness")!.status === "active");
  ok("progressPct is a number 0-100", typeof r.progressPct === "number" && r.progressPct! >= 0 && r.progressPct! <= 100);
  ok("currentStageId set", r.currentStageId === "current_state");
}

// ---- credit builder never falsely marks a positive account "done" (no positives imported) ----
{
  const r = buildRoadmap(intel({ opportunities: [{ key: "builder", title: "Builder", detail: "", href: "/x", kind: "builder" }] }), mission(), mc());
  ok("credit_builder milestone is never done from our data", stage(r, "credit_builder")!.milestones.every((m) => !m.done));
  ok("credit_builder status is upcoming (no dead ternary)", stage(r, "credit_builder")!.status === "upcoming");
}

// ---- an overdue window proves a dispute was mailed → mail_queue milestone done ----
{
  const r = buildRoadmap(intel({ opportunities: [{ key: "overdue", title: "Overdue", detail: "", href: "/x", kind: "deadline" }] }), mission(["monitor_deadline"]), mc());
  ok("overdue → mail_queue 'Dispute mailed' is done (no contradiction with active status)", stage(r, "mail_queue")!.milestones[0].done === true);
}

// ---- mortgage ready → active ----
{
  const r = buildRoadmap(intel({ readiness: [readi("mortgage", "ready"), readi("credit_card", "ready"), readi("personal_loan", "ready"), readi("auto", "ready"), readi("business_funding", "unknown")] }), mission(), mc());
  ok("mortgage ready → active", stage(r, "mortgage_readiness")!.status === "active");
}

// ---- determinism ----
{
  const a = JSON.stringify(buildRoadmap(intel(), mission(), mc({ waiting: [{ recipient: "EQ", daysLeft: 5, text: "x", href: "/x" }] })));
  const b = JSON.stringify(buildRoadmap(intel(), mission(), mc({ waiting: [{ recipient: "EQ", daysLeft: 5, text: "x", href: "/x" }] })));
  ok("buildRoadmap is deterministic", a === b);
}

// ---- CROA sweep ----
{
  const r = buildRoadmap(intel(), mission(), mc({ waiting: [{ recipient: "EQ", daysLeft: 5, text: "x", href: "/x" }] }));
  const strings = [r.note, ...r.stages.flatMap((s) => [s.label, s.summary, s.evidence, ...s.milestones.map((m) => m.text)])];
  const FORBIDDEN = /guarantee|guaranteed|will be (deleted|removed|approved)|approval odds|your score will|you will be approved/i;
  const bad = strings.find((s) => FORBIDDEN.test(s));
  ok(`no guaranteed-outcome/approval string in the roadmap${bad ? ` (offender: ${bad})` : ""}`, !bad);
  ok("readiness stages state they are NOT a lending decision", stage(r, "mortgage_readiness")!.summary.includes("not a lending decision") || stage(r, "funding_readiness")!.summary.includes("not a lending decision"));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
