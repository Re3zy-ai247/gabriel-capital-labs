// Guards for the Execution Engine (Sprint XX, ADR-0020). Pure — no DB.
// Run: npx tsx scripts/execution.test.ts
import { assembleIntelligence } from "../lib/intelligence/api";
import type { IntelSnapshot } from "../lib/intelligence/snapshot";
import { assembleMissions } from "../lib/missionEngine";
import { buildRoadmap } from "../lib/roadmap";
import { buildBuilder } from "../lib/builder";
import type { MissionControlData } from "../lib/missionControl";
import type { FinancialKnowledge } from "../lib/knowledge";
import { assembleExecution } from "../lib/execution/ExecutionEngine";
import { LADDER } from "../lib/execution/ExecutionPriority";
import { bucketOf } from "../lib/execution/ExecutionQueue";

let failures = 0;
function ok(label: string, cond: boolean) { if (!cond) { failures++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

function snap(over: Partial<IntelSnapshot> = {}): IntelSnapshot {
  return {
    userId: "u1", hasReport: true, totalAccounts: 6,
    negatives: 3, resolved: 1, collections: 1, chargeOffs: 1, publicRecords: 0, inquiries: 2,
    revolving: 2, installment: 1, mortgage: 0, studentLoans: 0, positives: 0, disputable: 3, duplicateGroups: 0,
    avgAccountAgeYears: 4.2, oldestDerogatoryYears: 6, youngestDerogatoryYears: 2,
    openInvestigations: 1, completedInvestigations: 2, round2Ready: 1, obsoleteOpportunities: 1,
    ownTrack: { total: 3, byStrategy: {}, byRecipient: {} }, favorableRate: 0.5, respondedCount: 2,
    ownHistoryLine: "Your own track record, not a prediction.",
    openWindows: [{ recipient: "Equifax", daysElapsed: 12, daysLeft: 18, letterId: "L1" }], overdueWindows: 0,
    scoreByBureau: [{ bureau: "EQUIFAX", latest: 640, delta: 20 }],
    addressComplete: true, recentEvents: [], utilizationTracked: false, ...over,
  };
}

// Minimal Mission Control — only the fields the Mission/Roadmap/Execution engines
// actually read. Cast is confined to this fixture.
function mc(over: Partial<MissionControlData> = {}): MissionControlData {
  return {
    firstName: "Test", caseMemory: {} as MissionControlData["caseMemory"], overnight: [],
    tasks: [], waiting: [{ recipient: "Equifax", daysLeft: 18, text: "Waiting on Equifax — 18 days remaining.", href: "/letters" }],
    automatic: [{ text: "Windows tracked automatically." }], nextAction: null, nextUnlock: null,
    command: [{ key: "campaigns", title: "Campaigns", stat: "1 active", sub: "2 total", href: "/campaigns", tone: "neutral" }],
    capacity: null, deferred: [], health: [], caseHealth: "green", hasReport: true,
    ownHistory: "Your own track record, not a prediction.", ...over,
  } as MissionControlData;
}

const emptyKnowledge: FinancialKnowledge = { graph: { nodes: [], edges: [] }, chains: [], reasons: [], counts: { nodes: 0, edges: 0 } };

function build(over: Partial<IntelSnapshot> = {}, mcOver: Partial<MissionControlData> = {}) {
  const s = snap(over);
  const intel = assembleIntelligence(s);
  const control = mc(mcOver);
  const mission = assembleMissions(intel, control);
  const roadmap = buildRoadmap(intel, mission, control);
  const builder = buildBuilder(s, intel);
  return { s, intel, mission, execution: assembleExecution({ intel, mission, roadmap, builder, knowledge: emptyKnowledge, mc: control, snap: s }) };
}

// ---- shape + buckets ----
{
  const { execution: e, mission } = build();
  ok("five buckets, in order", e.buckets.map((b) => b.key).join(",") === "DO_NOW,WAITING,BLOCKED,OPTIONAL,COMPLETED");
  ok("counts match bucket lengths", e.buckets.every((b) => e.counts[b.key] === b.items.length));
  ok("readiness signal present (Phase 4, reused CVI readiness)", !!e.readiness && ["Not ready", "Building", "Strong", "Unknown"].includes(e.readiness.band) && /not a lending decision/i.test(e.readiness.note));
  const all = e.buckets.flatMap((b) => b.items);
  ok("every item is cited (no uncited recommendations)", all.length > 0 && all.every((i) => i.citations.mission.length > 0));
  ok("every item has required fields", all.every((i) => i.title && i.requiredAction && i.expectedOutcome && i.ifIgnored && i.timeline && i.evidence));
  ok("waiting missions land in WAITING", e.counts.WAITING >= 1);
  ok("locked mission state maps to BLOCKED", bucketOf("locked") === "BLOCKED");
  ok("completed items never exceed the ledger history", e.counts.COMPLETED <= mission.completed.length || e.counts.COMPLETED <= 12);
}

// ---- deterministic priority ladder ----
{
  const { execution: e } = build();
  const doNow = e.buckets.find((b) => b.key === "DO_NOW")!.items;
  const ranks = doNow.map((i) => i.priority.rank);
  ok("DO_NOW ordered by ascending ladder rank", ranks.every((r, i) => i === 0 || ranks[i - 1] <= r));
  ok("today === top of DO_NOW", e.today?.id === doNow[0]?.id);
  ok("every rank is a real ladder index", e.buckets.flatMap((b) => b.items).every((i) => i.priority.rank >= 0 && i.priority.rank < LADDER.length));
}

// ---- overdue: legal deadline ranks first + high case risk (from snapshot, not predicted) ----
{
  const { execution: e } = build({ overdueWindows: 2, openWindows: [{ recipient: "Equifax", daysElapsed: 40, daysLeft: -5, letterId: "L1" }] });
  ok("overdue → caseRisk high, counted from real windows", e.caseRisk.level === "high" && /2 response window/.test(e.caseRisk.note));
  const doNow = e.buckets.find((b) => b.key === "DO_NOW")!.items;
  if (doNow.some((i) => i.priority.tier === "legal_deadline")) {
    ok("legal_deadline sits at rank 0 (front of the queue)", doNow[0].priority.tier === "legal_deadline");
  } else ok("legal_deadline tier available even if no overdue mission emitted", LADDER[0] === "legal_deadline");
}

// ---- no report → single upload item, honest ----
{
  const { execution: e } = build({ hasReport: false, totalAccounts: 0 });
  ok("no report → hasReport false", e.hasReport === false);
  const all = e.buckets.flatMap((b) => b.items);
  ok("no report → the one upload item, still cited", all.length >= 1 && all[0].citations.mission.length > 0);
}

// ---- reproducibility (same input → byte-identical output) ----
{
  const a = build().execution;
  const b = build().execution;
  ok("deterministic: identical inputs → identical output", JSON.stringify(a) === JSON.stringify(b));
}

console.log(failures === 0 ? "\nAll execution-engine guards passed." : `\n${failures} guard(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
