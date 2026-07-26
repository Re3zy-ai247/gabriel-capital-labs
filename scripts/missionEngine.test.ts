// Guards for the Financial Mission Engine (Sprint XVI). Pure — no DB.
// Run: npx tsx scripts/missionEngine.test.ts
import { assembleMissions } from "../lib/missionEngine";
import type { CreditIntelligence, Opportunity, IntelligenceModule } from "../lib/intelligence";
import type { MissionControlData } from "../lib/missionControl";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

const mod = (over: Partial<IntelligenceModule> = {}): IntelligenceModule =>
  ({ summary: "", metrics: [{ key: "done_inv", label: "Completed investigations", value: "2" }, { key: "fav_rate", label: "Favorable", value: "50%" }], reasons: [], recommendedActions: [], confidence: "high", history: null, nextSteps: [], ...over });

function intel(opps: Opportunity[], hasReport = true): CreditIntelligence {
  return {
    generatedAtNote: "", hasReport,
    profile: mod(), health: mod(), risk: mod(), opportunities: opps,
    readiness: [], builder: mod(), business: mod(),
    timeline: { past: ["Mailed Round 1 to Equifax", "Marked an item resolved"], present: [], upcoming: [] },
  };
}
function mc(over: Partial<MissionControlData> = {}): MissionControlData {
  return {
    firstName: "Rey", caseMemory: null, overnight: [], tasks: [], waiting: [], automatic: [{ text: "Windows tracked automatically." }],
    nextAction: null, nextUnlock: null, command: [{ key: "scores", title: "Score progress", stat: "+20 pts", sub: "", href: "/scores", tone: "green" }],
    capacity: null, deferred: [], health: [], caseHealth: "green", hasReport: true, ownHistory: null, ...over,
  } as MissionControlData;
}
const opp = (key: string, over: Partial<Opportunity> = {}): Opportunity => ({ key, title: key, detail: `${key} detail`, href: "/campaigns", kind: "dispute", ...over });

// ---- no report → single upload mission ----
{
  const m = assembleMissions(intel([], false), mc({ hasReport: false }));
  ok("no report → one mission (upload)", m.queue.length === 1 && m.today?.type === "upload_reports");
  ok("no report → completion 0", m.progress.overallPct === 0);
}

// ---- ranking: overdue outranks campaign; today = highest actionable ----
{
  const m = assembleMissions(intel([opp("campaign"), opp("overdue"), opp("round2"), opp("obsolete")]), mc());
  ok("today is the overdue-deadline mission (highest priority)", m.today?.type === "monitor_deadline");
  const types = m.queue.map((x) => x.type);
  ok("overdue ranks before campaign", types.indexOf("monitor_deadline") < types.indexOf("approve_campaign"));
  ok("round2 is needs_review", m.queue.find((x) => x.type === "round_2")?.state === "needs_review");
  ok("overdue → a CFPB escalation mission is added", m.queue.some((x) => x.type === "escalate_cfpb"));
  ok("unbuilt business credit stays out of the daily Mission queue", !m.queue.some((x) => x.type === "business_credit_setup"));
}

// ---- waiting missions from Mission Control windows, with progress ----
{
  const m = assembleMissions(intel([opp("campaign")]), mc({ waiting: [{ recipient: "Experian", daysLeft: 18, text: "Waiting on Experian — 18 days remaining.", href: "/letters" }] }));
  const w = m.queue.find((x) => x.type === "wait_response");
  ok("waiting mission created from a window", !!w && w.state === "waiting");
  ok("waiting mission carries deadline + progress", !!w && w.deadline === "18 days left" && w.progress === 40);
  ok("timeline includes the waiting window", m.timeline.some((t) => /Experian/.test(t.title)));
}

// ---- rewards are factual, from CVI + Mission Control ----
{
  const m = assembleMissions(intel([opp("campaign")]), mc());
  ok("reward: completed investigations", m.rewards.some((r) => r.label === "Investigations completed" && r.value === "2"));
  ok("reward: score progress", m.rewards.some((r) => r.label === "Score progress" && r.value === "+20 pts"));
  ok("completed history projected from real events", m.completed.length === 2);
  ok("automatic reused from Mission Control", m.automatic.length === 1);
}

// ---- determinism ----
{
  const a = JSON.stringify(assembleMissions(intel([opp("campaign"), opp("overdue"), opp("obsolete")]), mc({ waiting: [{ recipient: "TU", daysLeft: 5, text: "x", href: "/letters" }] })));
  const b = JSON.stringify(assembleMissions(intel([opp("campaign"), opp("overdue"), opp("obsolete")]), mc({ waiting: [{ recipient: "TU", daysLeft: 5, text: "x", href: "/letters" }] })));
  ok("assembleMissions is deterministic", a === b);
}

// ---- CROA/FTC sweep ----
{
  const m = assembleMissions(intel([opp("campaign"), opp("overdue"), opp("obsolete"), opp("validation"), opp("round2"), opp("builder")]), mc({ waiting: [{ recipient: "EQ", daysLeft: 12, text: "x", href: "/letters" }] }));
  const strings = [
    ...m.queue.flatMap((x) => [x.title, x.reason, x.evidence, x.unlocks ?? "", x.deadline ?? ""]),
    ...m.timeline.map((t) => t.title), ...m.rewards.map((r) => `${r.label} ${r.value}`), ...m.completed,
    m.progress.caseHealthNote, m.progress.estimatedCompletion, ...m.automatic,
  ];
  const FORBIDDEN = /guarantee|guaranteed|will be (deleted|removed|approved)|approval odds|your score will|points earned|badge|level up/i;
  const bad = strings.find((s) => FORBIDDEN.test(s));
  ok(`no guarantee/gamification in any mission string${bad ? ` (offender: ${bad})` : ""}`, !bad);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
